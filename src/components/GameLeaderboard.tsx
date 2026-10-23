import { useEffect, useState } from 'react';
import { RefreshCw, Trophy, Users, Clock3, Award, TrendingUp } from 'lucide-react';
import { FIREBASE_PROJECT_ID, restoreSession } from '../lib/firebaseAuth';
import { submitScore } from '../lib/submitScore';

/**
 * Game leaderboard + recent activity side panel for the Learning Games page.
 *
 * Pulls drill_attempts from Firestore where drillSource === 'learning-games'
 * (the source set by syntax-clash-pro.html and any in-React game submissions
 * that go through submitScore()). Aggregates by player name into a top-10
 * leaderboard + a recent activity feed (last 5 attempts).
 *
 * Same Firestore project + collection as the homepage ticker banner +
 * FirebaseDashboard, so every play shows up across all three views.
 *
 * Non-signed-in users see the leaderboard but their own plays don't submit
 * (submitScore is a silent no-op without a Firebase token in localStorage).
 * That's intentional — anonymous practice is allowed, but the leaderboard
 * is for players who chose to identify themselves.
 */

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

interface Attempt {
  studentName: string;
  drillSlug: string;
  drillTitle: string;
  scorePct: number;
  correctCount: number;
  totalCount: number;
  submittedAt: number; // epoch ms
}

interface LeaderEntry {
  name: string;
  plays: number;
  bestPct: number;
  lastPlayed: number; // epoch ms
}

// 5-minute poll with a 10-minute quota cooldown. Firestore free tier allows
// 50K document reads/day — this page fetches 100 docs per poll, so a 2-min
// interval burned through the whole daily quota in one open afternoon and
// every Firestore call site-wide started returning 429 until midnight PT.
const REFRESH_MS = 300_000; // 5 min while visible
const QUOTA_COOLDOWN_MS = 600_000; // 10 min pause after a 429
const MAX_LEADERBOARD = 10;
const MAX_RECENT = 5;

/** Game display name from a drill slug — pretty-prints "syntax-clash-practice"
 * as "Syntax Clash Pro" etc. Falls back to the slug title-cased. */
function gameNameFromSlug(slug: string): string {
  const KNOWN: Record<string, string> = {
    'syntax-clash-practice': 'Syntax Clash Pro',
    'syntax-clash-survival': 'Syntax Clash Pro · Survival',
    'syntax-clash-time': 'Syntax Clash Pro · Time Attack',
    'syntax-clash-speed': 'Syntax Clash Pro · Speed',
    'syntax-clash-daily': 'Syntax Clash Pro · Daily',
    'syntax-clash-judge': 'Syntax Clash Pro · Judge',
    'syntax-clash-fix': 'Syntax Clash Pro · Fix',
    'syntax-clash-spot': 'Syntax Clash Pro · Spot',
    'writequest-sentence': 'WriteQuest · Sentence',
    'writequest-paragraph': 'WriteQuest · Paragraph',
    'writequest-studio': 'WriteQuest · Studio',
    'writequest-home': 'WriteQuest · Home',
    'word-forge-quiz': 'Word Forge · Quiz',
    'word-forge-match': 'Word Forge · Match',
  };
  if (KNOWN[slug]) return KNOWN[slug];
  // Fall back to title-case of the slug
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

async function fetchGameAttempts(): Promise<Attempt[]> {
  // Firestore list with a filter on drillSource = 'learning-games'. REST API
  // supports runQuery for filter+order, but list with where is simpler here:
  // we fetch the 100 most recent attempts and filter client-side. Kept
  // deliberately small — each polled read counts against the 50K/day free
  // Firestore quota.
  const url = `${FIRESTORE_BASE}/drill_attempts?pageSize=100&orderBy=submittedAt%20desc`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json().catch(() => ({}));
  if (!data.documents) return [];
  const all: Attempt[] = data.documents.map((doc: any) => {
    const f = doc.fields || {};
    const submittedAtRaw = f.submittedAt?.timestampValue;
    return {
      studentName: f.studentName?.stringValue || 'Anonymous',
      drillSlug: f.drillSlug?.stringValue || 'unknown',
      drillTitle: f.drillTitle?.stringValue || '',
      scorePct: Number(f.scorePct?.integerValue || '0'),
      correctCount: Number(f.correctCount?.integerValue || '0'),
      totalCount: Number(f.totalCount?.integerValue || '0'),
      submittedAt: submittedAtRaw ? Date.parse(submittedAtRaw) : 0,
    };
  });
  // Filter to learning-games only (syntax-clash + writequest + word-forge + future React games)
  return all.filter(a =>
    a.drillSlug.startsWith('syntax-clash') ||
    a.drillSlug.startsWith('writequest') ||
    a.drillSlug.startsWith('word-forge') ||
    a.drillTitle.toLowerCase().includes('syntax clash') ||
    a.drillTitle.toLowerCase().includes('writequest') ||
    a.drillTitle.toLowerCase().includes('word forge')
  );
}

function aggregateLeaderboard(attempts: Attempt[]): LeaderEntry[] {
  const byName: Record<string, LeaderEntry> = {};
  for (const a of attempts) {
    if (!byName[a.studentName]) {
      byName[a.studentName] = {
        name: a.studentName,
        plays: 0,
        bestPct: 0,
        lastPlayed: 0,
      };
    }
    const entry = byName[a.studentName];
    entry.plays += 1;
    entry.bestPct = Math.max(entry.bestPct, a.scorePct);
    entry.lastPlayed = Math.max(entry.lastPlayed, a.submittedAt);
  }
  // Sort by best % desc, then by plays desc, then by most-recent asc
  return Object.values(byName)
    .sort((a, b) => b.bestPct - a.bestPct || b.plays - a.plays || b.lastPlayed - a.lastPlayed)
    .slice(0, MAX_LEADERBOARD);
}

function timeAgo(epochMs: number): string {
  if (!epochMs) return 'just now';
  const diff = Date.now() - epochMs;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(epochMs).toLocaleDateString();
}

interface GameLeaderboardProps {
  /** Highlight a specific player (the signed-in user) — their row gets a
   * glowing border + "you" badge. */
  highlightPlayer?: string | null;
}

export function GameLeaderboard({ highlightPlayer }: GameLeaderboardProps) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    // Quota cooldown: after a 429 the project is exhausted — stop reading for
    // 10 minutes so one struggling tab doesn't deepen the shortage.
    let cooldownUntil = 0;
    async function refresh() {
      // Quota guard: skip polling while the tab is hidden.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (Date.now() < cooldownUntil) return;
      setLoading(true);
      try {
        const result = await fetchGameAttempts();
        if (cancelled) return;
        setAttempts(result);
        setError(null);
        setLastFetch(Date.now());
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Could not load the leaderboard';
        if (/429|Quota/i.test(msg)) cooldownUntil = Date.now() + QUOTA_COOLDOWN_MS;
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    // Slight delay so the page paint isn't blocked
    const t = window.setTimeout(refresh, 400);
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

  const leaderboard = aggregateLeaderboard(attempts);
  const recent = [...attempts].sort((a, b) => b.submittedAt - a.submittedAt).slice(0, MAX_RECENT);
  const totalPlays = attempts.length;
  const uniquePlayers = leaderboard.length;
  const avgScore = totalPlays > 0
    ? Math.round(attempts.reduce((sum, a) => sum + a.scorePct, 0) / totalPlays)
    : 0;

  return (
    <aside
      aria-label="Game leaderboard"
      className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 backdrop-blur-xl sm:p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-amber-200/20 bg-gradient-to-br from-amber-300/15 to-amber-500/10 text-amber-200">
            <Trophy className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[9px] font-bold tracking-[0.16em] text-slate-500 uppercase">Live leaderboard</p>
            <p className="mt-0.5 text-sm font-bold text-white">Top players</p>
          </div>
        </div>
        {loading ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-500" aria-hidden="true" />
        ) : (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-200"
            title={`Last refreshed ${timeAgo(lastFetch)}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-white/8 bg-slate-950/40 p-2.5 text-center">
          <p className="font-[var(--font-display)] text-lg font-bold text-cyan-300">{totalPlays}</p>
          <p className="text-[9px] uppercase tracking-wider text-slate-500">Plays</p>
        </div>
        <div className="rounded-lg border border-white/8 bg-slate-950/40 p-2.5 text-center">
          <p className="font-[var(--font-display)] text-lg font-bold text-violet-300">{uniquePlayers}</p>
          <p className="text-[9px] uppercase tracking-wider text-slate-500">Players</p>
        </div>
        <div className="rounded-lg border border-white/8 bg-slate-950/40 p-2.5 text-center">
          <p className="font-[var(--font-display)] text-lg font-bold text-emerald-300">{avgScore}%</p>
          <p className="text-[9px] uppercase tracking-wider text-slate-500">Avg</p>
        </div>
      </div>

      {/* Leaderboard list */}
      <div className="mt-5">
        <p className="mb-2 text-[9px] font-bold tracking-[0.16em] text-slate-500 uppercase">Top {Math.min(MAX_LEADERBOARD, uniquePlayers)} players</p>
        {leaderboard.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-5 text-center">
            <Users className="mx-auto h-6 w-6 text-slate-600" aria-hidden="true" />
            <p className="mt-2 text-xs text-slate-500">
              {error ? 'Leaderboard unavailable' : 'No plays yet'}
            </p>
            <p className="mt-1 text-[10px] text-slate-600">
              {error ? error : 'Be the first to play + sign in to claim the top spot!'}
            </p>
          </div>
        ) : (
          <ol className="space-y-1.5">
            {leaderboard.map((entry, index) => {
              const isYou = highlightPlayer && entry.name === highlightPlayer;
              const medalColor = index === 0 ? 'text-amber-300' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-orange-400' : 'text-slate-500';
              return (
                <li
                  key={entry.name}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition ${
                    isYou
                      ? 'border-cyan-200/40 bg-cyan-200/[0.06] shadow-[0_0_0_1px_rgba(34,211,238,0.25)]'
                      : 'border-white/8 bg-slate-950/40 hover:bg-slate-950/60'
                  }`}
                >
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${medalColor} ${index < 3 ? 'bg-white/5' : ''}`}>
                    {index < 3 ? (
                      <Award className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white">
                      {entry.name}
                      {isYou && (
                        <span className="ml-1.5 rounded bg-cyan-200/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-cyan-200">
                          You
                        </span>
                      )}
                    </p>
                    <p className="text-[9px] text-slate-500">
                      {entry.plays} {entry.plays === 1 ? 'play' : 'plays'} · last {timeAgo(entry.lastPlayed)}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-xs font-bold text-emerald-200">
                    {entry.bestPct}%
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Recent activity */}
      <div className="mt-6 border-t border-white/8 pt-4">
        <p className="mb-2 flex items-center gap-1.5 text-[9px] font-bold tracking-[0.16em] text-slate-500 uppercase">
          <Clock3 className="h-3 w-3" aria-hidden="true" />
          Recent activity
        </p>
        {recent.length === 0 ? (
          <p className="text-[10px] text-slate-600">No recent plays.</p>
        ) : (
          <ul className="space-y-1.5">
            {recent.map((a, i) => (
              <li key={`${a.studentName}-${a.submittedAt}-${i}`} className="flex items-start gap-2 text-[11px]">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/5 text-[9px] font-bold text-cyan-200">
                  {a.studentName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-slate-300">
                    <span className="font-semibold text-white">{a.studentName}</span>{' '}
                    <span className="text-slate-500">played</span>{' '}
                    <span className="text-slate-300">{gameNameFromSlug(a.drillSlug)}</span>
                  </p>
                  <p className="text-[9px] text-slate-600">
                    {a.correctCount}/{a.totalCount} correct ({a.scorePct}%) · {timeAgo(a.submittedAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Hint when not signed in */}
      {!highlightPlayer && (
        <p className="mt-4 border-t border-white/8 pt-3 text-[10px] leading-relaxed text-slate-600">
          <TrendingUp className="mr-1 inline h-3 w-3 text-cyan-300/60" aria-hidden="true" />
          Sign in to land on the leaderboard — your best score per game is tracked.
        </p>
      )}
    </aside>
  );
}

/** Hook version — for components that just want the player name to highlight
 * in the leaderboard (the signed-in user's row gets a "You" badge). */
export function useSignedInPlayerName(): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => {
      const s = restoreSession();
      setName(s?.displayName || s?.email || null);
    };
    sync();
    window.addEventListener('cmc-auth-changed', sync);
    return () => window.removeEventListener('cmc-auth-changed', sync);
  }, []);
  return name;
}

/** Convenience wrapper for in-React games (the syntax-clash / writequest
 * standalone HTML games already have their own inline Firestore POST).
 * In-page React games should call this in their "game complete" handler. */
export async function submitGameScore(input: {
  gameSlug: string;
  gameTitle: string;
  correctCount: number;
  totalCount: number;
}): Promise<void> {
  const pct = input.totalCount > 0 ? Math.round((input.correctCount / input.totalCount) * 100) : 0;
  await submitScore({
    drillSlug: input.gameSlug,
    drillTitle: input.gameTitle,
    drillSource: 'learning-games',
    scorePct: pct,
    correctCount: input.correctCount,
    totalCount: input.totalCount,
  });
}
