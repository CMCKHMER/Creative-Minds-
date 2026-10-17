import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ChevronRight, Sparkles, TrendingUp, Trophy, Users, X } from 'lucide-react';
import { FIREBASE_PROJECT_ID } from '../lib/firebaseAuth';

interface TickerBannerProps {
  /** Called when the user clicks the "Be the first teacher" CTA in the
   *  ticker — opens the auth modal so they can claim a leaderboard slot. */
  onOpenTeacherPass?: () => void;
}

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface DrillAttempt {
  drillSource: string;
  studentName: string;
  scorePct: number;
  submittedAt: number; // epoch ms
}

interface AggregateStats {
  totalDrills: number;
  activeStudents: number;
  drillsToday: number;
  drillsThisWeek: number;
}

interface LeaderEntry {
  name: string;
  drills: number;
  avgScore: number;
  source: string; // 'live' or 'demo'
}

interface TickerData {
  stats: AggregateStats;
  leaderboard: LeaderEntry[];
  source: 'live' | 'demo';
  fetchedAt: number;
}

// ---------------------------------------------------------------------------
// FALLBACK DEMO DATA
// ---------------------------------------------------------------------------
//
// Shown when Firestore is unreachable (no auth, security rules deny
// public read, or the network request fails). The numbers stay plausible
// and the LIVE/DEMO badge tells the user which is which. Once a single
// real drill_attempt document is fetched, we switch to LIVE.

const DEMO_LEADERBOARD: LeaderEntry[] = [
  { name: 'Sophea K.',       drills: 142, avgScore: 88, source: 'demo' },
  { name: 'Mr. Dara V.',     drills: 119, avgScore: 84, source: 'demo' },
  { name: 'Ms. Linna C.',    drills: 96,  avgScore: 91, source: 'demo' },
  { name: 'Rithy N.',        drills: 78,  avgScore: 79, source: 'demo' },
  { name: 'Ms. Kanha P.',    drills: 64,  avgScore: 86, source: 'demo' },
  { name: 'Chanthou M.',     drills: 51,  avgScore: 82, source: 'demo' },
];

const DEMO_STATS: AggregateStats = {
  totalDrills: 3428,
  activeStudents: 219,
  drillsToday: 184,
  drillsThisWeek: 1172,
};

// ---------------------------------------------------------------------------
// FIRESTORE REST API
// ---------------------------------------------------------------------------

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

interface FirestoreField {
  stringValue?: string;
  integerValue?: string;
  timestampValue?: string;
}

interface FirestoreDoc {
  fields?: Record<string, FirestoreField>;
}

interface FirestoreListResponse {
  documents?: FirestoreDoc[];
  error?: { message?: string };
}

function parseDoc(doc: FirestoreDoc): DrillAttempt | null {
  const f = doc.fields;
  if (!f) return null;
  const submittedAtRaw = f.submittedAt?.timestampValue;
  return {
    drillSource: f.drillSource?.stringValue || 'unknown',
    studentName: f.studentName?.stringValue || 'Anonymous',
    scorePct: Number(f.scorePct?.integerValue || '0'),
    submittedAt: submittedAtRaw ? Date.parse(submittedAtRaw) : 0,
  };
}

async function fetchRecentDrills(limit = 250): Promise<DrillAttempt[]> {
  // Public read on `drill_attempts` is usually restricted by Firestore
  // security rules, so this will often 403 in production. We catch that
  // and fall back to the DEMO data so the ticker always has something
  // to show.
  const url = `${FIRESTORE_BASE}/drill_attempts?pageSize=${limit}&orderBy=submittedAt%20desc`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({} as FirestoreListResponse));
    const msg = (data as FirestoreListResponse).error?.message || `HTTP ${res.status}`;
    throw new Error(`Firestore list failed: ${msg}`);
  }
  const data = (await res.json()) as FirestoreListResponse;
  if (!data.documents) return [];
  return data.documents.map(parseDoc).filter((d): d is DrillAttempt => d !== null);
}

// ---------------------------------------------------------------------------
// AGGREGATION
// ---------------------------------------------------------------------------

function aggregate(attempts: DrillAttempt[]): TickerData {
  const now = Date.now();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayMs = startOfToday.getTime();
  const startOfWeekMs = startOfTodayMs - 6 * 24 * 60 * 60 * 1000; // last 7 days

  let drillsToday = 0;
  let drillsThisWeek = 0;
  const studentSet = new Set<string>();
  const perName: Record<string, { drills: number; scoreSum: number }> = {};

  for (const a of attempts) {
    if (!a.submittedAt) continue;
    if (a.submittedAt >= startOfTodayMs) drillsToday += 1;
    if (a.submittedAt >= startOfWeekMs) drillsThisWeek += 1;
    if (a.submittedAt >= startOfWeekMs) studentSet.add(a.studentName);

    if (!perName[a.studentName]) perName[a.studentName] = { drills: 0, scoreSum: 0 };
    perName[a.studentName].drills += 1;
    perName[a.studentName].scoreSum += a.scorePct;
  }

  const leaderboard: LeaderEntry[] = Object.entries(perName)
    .map(([name, v]) => ({
      name,
      drills: v.drills,
      avgScore: Math.round(v.scoreSum / v.drills),
      source: 'live' as const,
    }))
    .sort((a, b) => b.drills - a.drills || b.avgScore - a.avgScore)
    .slice(0, 6);

  return {
    stats: {
      totalDrills: attempts.length,
      activeStudents: studentSet.size,
      drillsToday,
      drillsThisWeek,
    },
    leaderboard,
    source: 'live',
    fetchedAt: now,
  };
}

function demoData(): TickerData {
  return {
    stats: { ...DEMO_STATS },
    leaderboard: [...DEMO_LEADERBOARD],
    source: 'demo',
    fetchedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------

const REFRESH_MS = 30_000; // 30s

export function TickerBanner({ onOpenTeacherPass }: TickerBannerProps) {
  const [data, setData] = useState<TickerData>(() => demoData());
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      setLoading(true);
      try {
        const attempts = await fetchRecentDrills();
        if (cancelled) return;
        if (attempts.length === 0) {
          // Firestore reachable but empty — keep the demo board so the
          // ticker isn't blank on day 1.
          setData(demoData());
          setLastError(null);
        } else {
          setData(aggregate(attempts));
          setLastError(null);
        }
      } catch (e) {
        if (cancelled) return;
        setLastError(e instanceof Error ? e.message : 'Failed to load live stats');
        // Only fall back if we don't already have live data
        setData((prev) => (prev.source === 'live' ? prev : demoData()));
      } finally {
        if (!cancelled) setLoading(false);
        fetchedRef.current = true;
      }
    }

    // Slight delay so the homepage paint isn't blocked by the Firestore call
    const t = window.setTimeout(refresh, 800);
    const interval = window.setInterval(refresh, REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      window.clearInterval(interval);
    };
  }, []);

  // Persist dismissal so the banner doesn't nag users who already closed it
  // during this session.
  useEffect(() => {
    if (!visible) {
      try { sessionStorage.setItem('cmc-ticker-dismissed', '1'); } catch { /* ignore */ }
    }
  }, [visible]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('cmc-ticker-dismissed') === '1') {
        setVisible(false);
      }
    } catch { /* ignore */ }
  }, []);

  const items = useMemo(() => buildTickerItems(data, loading), [data, loading]);

  if (!visible) return null;

  const sourceBadge = data.source === 'live'
    ? <span title="Live data — real student submissions to Firestore" className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-200 uppercase"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />Live</span>
    : <span title="No real student submissions yet — these are sample numbers. As soon as a signed-in student completes a worksheet, the ticker flips to LIVE." className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-200 uppercase"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Demo</span>;

  return (
    <div
      role="region"
      aria-label="Live activity ticker"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-cyan-300/15 bg-[#04111c]/95 backdrop-blur-md"
    >
      {/* Two stacked layers: a thin progress bar on top when loading, and
          the marquee below. Both inside the same fixed container so the
          ticker stays anchored to the bottom of the viewport. */}
      {loading && (
        <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden">
          <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-cyan-300 to-transparent animate-[ticker-progress_1.2s_linear_infinite]" />
        </div>
      )}

      <div className="relative flex items-stretch">
        {/* LEFT — sticky label badge (always visible, marquee scrolls past it) */}
        <div className="hidden sm:flex shrink-0 items-center gap-2 px-4 py-2.5 border-r border-white/10 bg-gradient-to-r from-cyan-500/10 to-transparent">
          <Activity className="h-4 w-4 text-cyan-300" aria-hidden="true" />
          <span className="text-[10px] font-bold tracking-[0.18em] text-cyan-200 uppercase whitespace-nowrap">
            Live Activity
          </span>
          {sourceBadge}
        </div>

        {/* CENTER — scrolling marquee */}
        <div className="relative flex-1 overflow-hidden">
          {/* edge fade masks */}
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-12 bg-gradient-to-r from-[#04111c] to-transparent" aria-hidden="true" />
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-12 bg-gradient-to-l from-[#04111c] to-transparent" aria-hidden="true" />

          <div className="flex w-max animate-[ticker-scroll_60s_linear_infinite] hover:[animation-play-state:paused]">
            {/* Render items twice so the marquee loops seamlessly */}
            {[...items, ...items].map((node, i) => (
              <span key={i} className="inline-flex items-center">{node}</span>
            ))}
          </div>
        </div>

        {/* RIGHT — close button */}
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Dismiss live activity ticker"
          className="shrink-0 px-3 text-slate-500 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* inline keyframes (Tailwind 4 arbitrary values can't define keyframes
          inline, so we register them globally here) */}
      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes ticker-progress {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );

  // ----- Ticker item builder -------------------------------------------------

  function buildTickerItems(d: TickerData, isLoading: boolean): React.ReactNode[] {
    const separator = (
      <span aria-hidden="true" className="px-3 text-slate-600">·</span>
    );

    const nodes: React.ReactNode[] = [];

    // Stat: drills today
    nodes.push(
      <TickerStat key="today" icon={<TrendingUp className="h-3.5 w-3.5" />} label="Drills today" value={d.stats.drillsToday} />
    );
    nodes.push(separator);

    // Stat: drills this week
    nodes.push(
      <TickerStat key="week" icon={<Activity className="h-3.5 w-3.5" />} label="This week" value={d.stats.drillsThisWeek} />
    );
    nodes.push(separator);

    // Stat: active students
    nodes.push(
      <TickerStat key="active" icon={<Users className="h-3.5 w-3.5" />} label="Active students" value={d.stats.activeStudents} />
    );
    nodes.push(separator);

    // Stat: total drills
    nodes.push(
      <TickerStat key="total" icon={<Sparkles className="h-3.5 w-3.5" />} label="All-time drills" value={d.stats.totalDrills} />
    );
    nodes.push(separator);

    // Leaderboard header
    nodes.push(
      <span key="leader-header" className="inline-flex items-center gap-1.5 px-2 text-[11px] font-bold uppercase tracking-wider text-amber-200">
        <Trophy className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
        Top Teachers
      </span>
    );
    nodes.push(separator);

    // Leaderboard entries
    d.leaderboard.forEach((entry, idx) => {
      const medal = idx === 0 ? 'text-amber-300' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-orange-400' : 'text-slate-500';
      nodes.push(
        <span key={`leader-${idx}`} className="inline-flex items-center gap-2 whitespace-nowrap px-2">
          <span className={`text-[11px] font-bold ${medal}`}>#{idx + 1}</span>
          <span className="text-[12px] font-semibold text-white">{entry.name}</span>
          <span className="text-[11px] text-slate-400">{entry.drills} drills</span>
          <span className="text-[11px] text-emerald-300">{entry.avgScore}% avg</span>
        </span>
      );
      nodes.push(separator);
    });

    // CTA — be the next teacher on the board
    nodes.push(
      <button
        key="cta"
        type="button"
        onClick={onOpenTeacherPass}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold text-cyan-200 transition hover:bg-cyan-300/20 hover:text-white"
      >
        Be the next <ChevronRight className="h-3 w-3" aria-hidden="true" />
      </button>
    );
    nodes.push(separator);

    // Status footer line — show last fetched timestamp + error if any
    if (lastError) {
      nodes.push(
        <span key="err" className="inline-flex items-center gap-1.5 whitespace-nowrap px-2 text-[10px] text-rose-300/80">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
          {lastError.length > 80 ? lastError.slice(0, 77) + '...' : lastError}
        </span>
      );
    } else {
      const ago = Math.max(0, Math.round((Date.now() - d.fetchedAt) / 1000));
      nodes.push(
        <span key="updated" className="inline-flex items-center gap-1.5 whitespace-nowrap px-2 text-[10px] text-slate-500">
          {isLoading ? 'refreshing…' : `updated ${ago}s ago`}
        </span>
      );
    }

    return nodes;
  }
}

function TickerStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap px-2">
      <span className="text-cyan-300/80">{icon}</span>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-[13px] font-bold text-white tabular-nums">{value.toLocaleString()}</span>
    </span>
  );
}
