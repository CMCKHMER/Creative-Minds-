import { useEffect, useState, type ReactNode } from 'react';
import { Crown, Flame, RefreshCw, Swords, TrendingUp, Trophy } from 'lucide-react';
import { FIREBASE_PROJECT_ID } from '../lib/firebaseAuth';
import {
  aggregateBrickforge,
  aggregateChess,
  chessPoints,
  timeAgo,
  type BrickEntry,
  type ChessRecord,
  type LoungeAttempt,
} from '../lib/brainLoungeStats';
import { useSignedInPlayerName } from './GameLeaderboard';

/**
 * Brain Lounge leaderboard — player stats for the arcade cartridges.
 *
 * Reads the same public drill_attempts collection the Learning Games
 * leaderboard uses, filtered to drillSource 'brain-lounge'. Guests can
 * watch; only signed-in players land on the board (submitScore is a
 * silent no-op without a session).
 *
 * Polls every 5 minutes with the same quota discipline as
 * GameLeaderboard: hidden tabs never fetch, and a 429 freezes reads for
 * 10 minutes (the Firestore free tier is 50K reads/day — 100 docs per
 * poll, so one busy afternoon already matters).
 */

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const REFRESH_MS = 300_000;
const QUOTA_COOLDOWN_MS = 600_000;
const MAX_ROWS = 6;

async function fetchLoungeAttempts(): Promise<LoungeAttempt[]> {
  const url = `${FIRESTORE_BASE}/drill_attempts?pageSize=100&orderBy=submittedAt%20desc`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json().catch(() => ({}));
  if (!data.documents) return [];
  return (data.documents as any[]).map((doc) => {
    const f = doc.fields || {};
    const submittedAtRaw = f.submittedAt?.timestampValue;
    return {
      studentName: f.studentName?.stringValue || 'Anonymous',
      drillSlug: f.drillSlug?.stringValue || 'unknown',
      drillSource: f.drillSource?.stringValue || 'unknown',
      scorePct: Number(f.scorePct?.integerValue || '0'),
      correctCount: Number(f.correctCount?.integerValue || '0'),
      totalCount: Number(f.totalCount?.integerValue || '0'),
      submittedAt: submittedAtRaw ? Date.parse(submittedAtRaw) : 0,
    };
  });
}

function BoardShell({
  icon,
  title,
  subtitle,
  accent,
  loading,
  lastFetch,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  accent: 'brick' | 'chess';
  loading: boolean;
  lastFetch: number;
  children: ReactNode;
}) {
  const accentRing = accent === 'brick' ? 'border-orange-400/25' : 'border-emerald-300/25';
  const accentIcon = accent === 'brick' ? 'from-orange-300/15 to-amber-500/10 text-orange-200' : 'from-emerald-300/15 to-teal-500/10 text-emerald-200';
  return (
    <div className={`flex flex-col rounded-2xl border ${accentRing} bg-slate-950/60 p-5 backdrop-blur-xl`}>
      <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-3.5">
        <div className="flex items-center gap-2.5">
          <span className={`grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-gradient-to-br ${accentIcon}`}>
            {icon}
          </span>
          <div>
            <p className="text-sm font-bold text-white">{title}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">{subtitle}</p>
          </div>
        </div>
        {loading ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-500" aria-hidden="true" />
        ) : (
          lastFetch > 0 && (
            <span className="text-[9px] uppercase tracking-wider text-slate-600" title="Leaderboard data age">
              {timeAgo(lastFetch)}
            </span>
          )
        )}
      </div>
      <div className="mt-3.5 flex-1">{children}</div>
    </div>
  );
}

function EmptyBoard({ line }: { line: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 p-5 text-center">
      <p className="text-xs text-slate-500">{line}</p>
      <p className="mt-1 text-[10px] text-slate-600">Sign in and play a run — your stats land here automatically.</p>
    </div>
  );
}

function rankColor(index: number): string {
  return index === 0 ? 'text-amber-300' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-orange-400' : 'text-slate-500';
}

function BrickBoard({ entries, you, loading, lastFetch }: { entries: BrickEntry[]; you: string | null; loading: boolean; lastFetch: number }) {
  return (
    <BoardShell
      icon={<Flame className="h-4.5 w-4.5" aria-hidden="true" />}
      title="BrickForge"
      subtitle="Deepest forge run · level reached"
      accent="brick"
      loading={loading}
      lastFetch={lastFetch}
    >
      {entries.length === 0 ? (
        <EmptyBoard line="No forge runs recorded yet." />
      ) : (
        <ol className="space-y-1.5">
          {entries.slice(0, MAX_ROWS).map((entry, index) => {
            const isYou = you && entry.name === you;
            return (
              <li
                key={entry.name}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition ${
                  isYou
                    ? 'border-orange-300/40 bg-orange-300/[0.06] shadow-[0_0_0_1px_rgba(251,146,60,0.25)]'
                    : 'border-white/8 bg-slate-950/40 hover:bg-slate-950/60'
                }`}
              >
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${rankColor(index)} ${index < 3 ? 'bg-white/5' : ''}`}>
                  {index < 3 ? <Crown className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white">
                    {entry.name}
                    {isYou && <span className="ml-1.5 rounded bg-orange-300/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-orange-200">You</span>}
                  </p>
                  <p className="text-[9px] text-slate-500">
                    {entry.plays} {entry.plays === 1 ? 'run' : 'runs'} · last {timeAgo(entry.lastPlayed)}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs font-bold text-orange-200">Lv {entry.bestLevel}</span>
              </li>
            );
          })}
        </ol>
      )}
    </BoardShell>
  );
}

function ChessBoard({ records, you, loading, lastFetch }: { records: ChessRecord[]; you: string | null; loading: boolean; lastFetch: number }) {
  return (
    <BoardShell
      icon={<Swords className="h-4.5 w-4.5" aria-hidden="true" />}
      title="Arena Chess 3D"
      subtitle="Duel ladder · 2 pts per win, 1 per draw"
      accent="chess"
      loading={loading}
      lastFetch={lastFetch}
    >
      {records.length === 0 ? (
        <EmptyBoard line="No duels recorded yet." />
      ) : (
        <ol className="space-y-1.5">
          {records.slice(0, MAX_ROWS).map((record, index) => {
            const isYou = you && record.name === you;
            return (
              <li
                key={record.name}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition ${
                  isYou
                    ? 'border-emerald-300/40 bg-emerald-300/[0.06] shadow-[0_0_0_1px_rgba(52,211,153,0.25)]'
                    : 'border-white/8 bg-slate-950/40 hover:bg-slate-950/60'
                }`}
              >
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${rankColor(index)} ${index < 3 ? 'bg-white/5' : ''}`}>
                  {index < 3 ? <Crown className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white">
                    {record.name}
                    {isYou && <span className="ml-1.5 rounded bg-emerald-300/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-200">You</span>}
                  </p>
                  <p className="text-[9px] text-slate-500">
                    <span className="text-emerald-300">{record.wins}W</span> · <span className="text-slate-300">{record.draws}D</span> · <span className="text-red-300">{record.losses}L</span>
                    {' '}· last {timeAgo(record.lastPlayed)}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs font-bold text-emerald-200">{chessPoints(record)} pts</span>
              </li>
            );
          })}
        </ol>
      )}
    </BoardShell>
  );
}

export function LoungeLeaderboard() {
  const [attempts, setAttempts] = useState<LoungeAttempt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState(0);
  const you = useSignedInPlayerName();

  useEffect(() => {
    let cancelled = false;
    let cooldownUntil = 0;
    async function refresh() {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (Date.now() < cooldownUntil) return;
      try {
        const result = await fetchLoungeAttempts();
        if (cancelled) return;
        setAttempts(result);
        setError(null);
        setLastFetch(Date.now());
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Could not load the leaderboard';
        if (/429|Quota/i.test(msg)) cooldownUntil = Date.now() + QUOTA_COOLDOWN_MS;
        setError(msg);
      }
    }
    const t = window.setTimeout(refresh, 400);
    const interval = window.setInterval(refresh, REFRESH_MS);
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

  const brick = aggregateBrickforge(attempts);
  const chess = aggregateChess(attempts);
  const totalRuns =
    brick.reduce((sum, e) => sum + e.plays, 0) +
    chess.reduce((sum, r) => sum + r.wins + r.draws + r.losses, 0);
  const players = new Set([...brick, ...chess].map((e) => e.name)).size;
  const firstLoad = lastFetch === 0 && !error;

  return (
    <section aria-label="Lounge leaderboard" className="mt-16">
      <div className="border-b border-white/10 pb-5">
        <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.17em] text-amber-300">
          <Trophy className="h-3 w-3" aria-hidden="true" /> Player stats
        </p>
        <h2 className="mt-2 font-[var(--font-display)] text-2xl font-bold tracking-tight text-white sm:text-3xl">Lounge leaderboard</h2>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-400">
          Signed-in players track their record here automatically — the deepest BrickForge run and the Arena Chess 3D duel ladder.
          {!you && ' Sign in with your CMC account to claim your spot.'}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
        <span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">{totalRuns} recorded {totalRuns === 1 ? 'run' : 'runs'}</span>
        <span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">{players} ranked {players === 1 ? 'player' : 'players'}</span>
        <span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">Updates every 5 minutes</span>
      </div>

      {error && (
        <p role="status" className="mt-4 rounded-xl border border-amber-200/20 bg-amber-200/5 px-4 py-3 text-xs text-amber-200/80">
          Leaderboard unavailable right now — {error}. Your runs are still recorded.
        </p>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <BrickBoard entries={brick} you={you} loading={firstLoad} lastFetch={lastFetch} />
        <ChessBoard records={chess} you={you} loading={firstLoad} lastFetch={lastFetch} />
      </div>

      {!you && (
        <p className="mt-4 text-[10px] leading-relaxed text-slate-600">
          <TrendingUp className="mr-1 inline h-3 w-3 text-cyan-300/60" aria-hidden="true" />
          Guests can play everything — stats only attach to the board once you sign in.
        </p>
      )}
    </section>
  );
}
