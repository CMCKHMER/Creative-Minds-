import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ChevronRight, ClipboardList, Sparkles, TrendingUp, Trophy, Users, X } from 'lucide-react';
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
  // Teacher-assigned tests (drillSource === 'assignment'). Counted separately
  // so the "drills" numbers stay pure drills — assignment submissions are
  // logged by the private test pages with score 0 (grading is teacher-side),
  // so mixing them into the drill stats/leaderboard would fake 0% averages.
  assignmentsWeek: number;
  assignmentsTotal: number;
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
  assignmentsWeek: 46,
  assignmentsTotal: 512,
};

// ---------------------------------------------------------------------------
// FIRESTORE REST API
// ---------------------------------------------------------------------------
// Preferred path: ONE read of the pre-aggregated ticker_stats/latest doc
// (see SERVER-AGGREGATED STATS below — written every 5 minutes by the
// rollupTicker Cloud Function).
//
// Fallback path (used while the doc is missing/stale): three query shapes,
// all public-read under the security rules:
//   1. runQuery            — every attempt in the last 7 days (leaderboard +
//                            today/this-week/active counts). Reads billed =
//                            docs returned, so it stays small no matter how
//                            big the collection grows.
//   2. runAggregationQuery — exact all-time count (the old documents.list
//                            approach capped "All-time drills" at 100).
//   3. runAggregationQuery — exact assignment-submission count (single-field
//                            equality filter — no composite index needed).
// Net effect per poll on the fallback path: ~2 + (docs in the last week)
// reads instead of a flat 100.

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

interface FirestoreField {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  timestampValue?: string;
}

interface FirestoreDoc {
  fields?: Record<string, FirestoreField>;
}

interface FirestoreErrorBody {
  error?: { message?: string };
}

/** Firestore REST value filter used in runQuery/runAggregationQuery bodies. */
interface FieldFilterBody {
  fieldFilter: {
    field: { fieldPath: string };
    op: 'EQUAL' | 'GREATER_THAN_OR_EQUAL';
    value: Record<string, string>;
  };
}

async function fireStorePost(path: ':runQuery' | ':runAggregationQuery', body: unknown): Promise<unknown> {
  const res = await fetch(`${FIRESTORE_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as FirestoreErrorBody;
    const msg = data.error?.message || `HTTP ${res.status}`;
    throw new Error(`Firestore query failed: ${msg}`);
  }
  return res.json();
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

/** Every attempt from `sinceMs` (inclusive), newest first. */
async function fetchWeekAttempts(sinceMs: number, limit = 1000): Promise<DrillAttempt[]> {
  const rows = (await fireStorePost(':runQuery', {
    structuredQuery: {
      from: [{ collectionId: 'drill_attempts' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'submittedAt' },
          op: 'GREATER_THAN_OR_EQUAL',
          value: { timestampValue: new Date(sinceMs).toISOString() },
        },
      },
      orderBy: [{ field: { fieldPath: 'submittedAt' }, direction: 'DESCENDING' }],
      limit,
    },
  })) as Array<{ document?: FirestoreDoc }>;
  return rows
    .filter((r): r is { document: FirestoreDoc } => !!r?.document)
    .map((r) => parseDoc(r.document))
    .filter((d): d is DrillAttempt => d !== null);
}

/** Exact document count, optionally filtered (auto-indexed filters only). */
async function countAttempts(filter?: FieldFilterBody): Promise<number> {
  const rows = (await fireStorePost(':runAggregationQuery', {
    structuredAggregationQuery: {
      structuredQuery: {
        from: [{ collectionId: 'drill_attempts' }],
        ...(filter ? { where: filter } : {}),
      },
      aggregations: [{ alias: 'count', count: {} }],
    },
  })) as Array<{ result?: { aggregateFields?: { count?: { integerValue?: string } } } }>;
  return Number(rows?.[0]?.result?.aggregateFields?.count?.integerValue ?? '0');
}

// ---------------------------------------------------------------------------
// SERVER-AGGREGATED STATS (Blaze plan)
// ---------------------------------------------------------------------------
// The rollupTicker Cloud Function (functions/index.js) recomputes the exact
// same stats every 5 minutes — week window + two count() aggregations — and
// writes them to ticker_stats/latest. When that document is fresh, one GET
// per poll replaces all three queries: per-visitor cost is a single read no
// matter how busy the week is, and the aggregate is shared by every open
// tab instead of recomputed per tab.
//
// SAFETY: if the document is missing (function not deployed yet), stale
// (>20 min — the function runs every 5, so 4 missed runs means trouble), or
// malformed, we return null and the caller falls back to the query path.
// The ticker works identically before, during and after the function deploy.

const SERVER_STATS_STALE_MS = 20 * 60_000;

interface ServerStatsFields {
  drillsToday?: FirestoreField;
  drillsThisWeek?: FirestoreField;
  activeStudents?: FirestoreField;
  totalDrills?: FirestoreField;
  assignmentsWeek?: FirestoreField;
  assignmentsTotal?: FirestoreField;
  updatedAt?: FirestoreField;
  leaderboard?: {
    arrayValue?: { values?: Array<{ mapValue?: { fields?: Record<string, FirestoreField> } }> };
  };
}

function numField(f: FirestoreField | undefined): number {
  return Number(f?.integerValue ?? f?.doubleValue ?? NaN);
}

/** The pre-aggregated ticker doc, or null when absent/stale/malformed. */
async function fetchServerAggregate(): Promise<TickerData | null> {
  try {
    const res = await fetch(`${FIRESTORE_BASE}/ticker_stats/latest`);
    if (!res.ok) return null;
    const doc = (await res.json()) as { fields?: ServerStatsFields };
    const f = doc.fields;
    if (!f) return null;

    const updatedAtRaw = f.updatedAt?.stringValue || f.updatedAt?.timestampValue;
    const updatedAt = updatedAtRaw ? Date.parse(updatedAtRaw) : NaN;
    const stats: AggregateStats = {
      drillsToday: numField(f.drillsToday),
      drillsThisWeek: numField(f.drillsThisWeek),
      activeStudents: numField(f.activeStudents),
      totalDrills: numField(f.totalDrills),
      assignmentsWeek: numField(f.assignmentsWeek),
      assignmentsTotal: numField(f.assignmentsTotal),
    };
    const complete = Object.values(stats).every((n) => Number.isFinite(n) && n >= 0);
    const fresh = Number.isFinite(updatedAt) && Date.now() - updatedAt <= SERVER_STATS_STALE_MS;
    if (!complete || !fresh) return null;

    // Same empty-project rule as the query path: a reachable project with
    // zero attempts ever keeps the demo board so the ticker isn't blank.
    if (stats.totalDrills === 0) return demoData();

    const leaderboard: LeaderEntry[] = [];
    for (const v of f.leaderboard?.arrayValue?.values ?? []) {
      const lf = v.mapValue?.fields;
      const name = lf?.name?.stringValue;
      if (!name) continue;
      const drills = numField(lf.drills);
      const avgScore = numField(lf.avgScore);
      if (Number.isFinite(drills) && Number.isFinite(avgScore)) {
        leaderboard.push({ name, drills, avgScore, source: 'live' });
      }
    }

    return { stats, leaderboard, source: 'live', fetchedAt: Date.now() };
  } catch {
    return null; // any problem → silent fallback to the query path
  }
}

// ---------------------------------------------------------------------------
// AGGREGATION
// ---------------------------------------------------------------------------

function aggregate(weekAttempts: DrillAttempt[], allTimeTotal: number, assignmentsTotalExact: number): TickerData {
  const now = Date.now();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayMs = startOfToday.getTime();
  const startOfWeekMs = startOfTodayMs - 6 * 24 * 60 * 60 * 1000; // last 7 days

  let drillsToday = 0;
  let drillsThisWeek = 0;
  let assignmentsWeek = 0;
  const studentSet = new Set<string>();
  const perName: Record<string, { drills: number; scoreSum: number }> = {};

  for (const a of weekAttempts) {
    if (!a.submittedAt) continue;
    if (a.drillSource === 'assignment') {
      // Assigned tests: counted in their own stats and toward "active
      // students", but NOT in the leaderboard — the submission is logged
      // before the teacher grades it, so its scorePct is always 0 and
      // would drag every average toward 0%.
      assignmentsWeek += 1;
      studentSet.add(a.studentName);
      continue;
    }
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
      // Exact totals come from count() aggregation queries — never capped
      // by the page size, unlike the old newest-100 fetch.
      totalDrills: allTimeTotal,
      activeStudents: studentSet.size,
      drillsToday,
      drillsThisWeek,
      assignmentsWeek,
      assignmentsTotal: assignmentsTotalExact,
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

// 5-minute poll, visibility-gated, plus a 10-minute cooldown after any 429.
// Firestore free tier allows 50K document reads/day — the old 250-docs-every-30s
// poll exhausted that quota in under two hours of one open tab, and even the
// later 100-docs-every-2-min poll still burned 72K reads in a single open day.
// Once the rollupTicker Cloud Function is deployed, a poll costs exactly ONE
// read (the pre-aggregated ticker_stats/latest doc) as long as it is fresh.
const REFRESH_MS = 300_000; // 5 min while visible
const WEEK_LIMIT = 1000; // week-window query cap — a week with more attempts than this would undercount today/week stats
const QUOTA_COOLDOWN_MS = 600_000; // 10 min pause after a 429

export function TickerBanner({ onOpenTeacherPass }: TickerBannerProps) {
  const [data, setData] = useState<TickerData>(() => demoData());
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    // Quota cooldown: after a 429 the project is exhausted — stop reading for
    // 10 minutes so one struggling tab doesn't deepen the shortage.
    let cooldownUntil = 0;

    async function refresh() {
      // Quota guard: never poll while the tab is hidden — background tabs
      // cost the same Firestore reads but nobody sees the result.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (Date.now() < cooldownUntil) return;
      setLoading(true);
      try {
        // Preferred: the Cloud Function's pre-aggregated doc — one read.
        const server = await fetchServerAggregate();
        if (cancelled) return;
        if (server) {
          setData(server);
          setLastError(null);
          return;
        }

        // Fallback: run the queries ourselves (server doc missing/stale).
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const weekStartMs = startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000;
        const [weekAttempts, allTimeTotal, assignmentsTotal] = await Promise.all([
          fetchWeekAttempts(weekStartMs, WEEK_LIMIT),
          countAttempts(),
          countAttempts({
            fieldFilter: {
              field: { fieldPath: 'drillSource' },
              op: 'EQUAL',
              value: { stringValue: 'assignment' },
            },
          }),
        ]);
        if (cancelled) return;
        if (allTimeTotal === 0) {
          // Firestore reachable but the project has never had an attempt —
          // keep the demo board so the ticker isn't blank on day 1. A quiet
          // WEEK with real history still shows LIVE (zeros are accurate).
          setData(demoData());
          setLastError(null);
        } else {
          setData(aggregate(weekAttempts, allTimeTotal, assignmentsTotal));
          setLastError(null);
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Failed to load live stats';
        if (/429|Quota/i.test(msg)) cooldownUntil = Date.now() + QUOTA_COOLDOWN_MS;
        setLastError(msg);
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
    // Catch up immediately when the visitor returns to the tab.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
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

  const items = useMemo(
    () => buildTickerItems(data, loading, onOpenTeacherPass, lastError),
    [data, loading, onOpenTeacherPass, lastError],
  );

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

function buildTickerItems(
d: TickerData,
isLoading: boolean,
onOpenTeacherPass: (() => void) | undefined,
lastError: string | null,
): React.ReactNode[] {
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

  // Stats: teacher-assigned tests (private bi-weekly tests). Their own
  // numbers — submissions arrive before grading, so they are completions
  // even though no score exists yet.
  nodes.push(
    <TickerStat key="assign-week" icon={<ClipboardList className="h-3.5 w-3.5" />} label="Assignment tests this week" value={d.stats.assignmentsWeek} />
  );
  nodes.push(separator);
  nodes.push(
    <TickerStat key="assign-total" icon={<ClipboardList className="h-3.5 w-3.5" />} label="Assignment tests total" value={d.stats.assignmentsTotal} />
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
