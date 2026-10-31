/**
 * Brain Lounge player-stats aggregation (pure, unit-tested).
 *
 * The lounge's drill_attempts rows all carry drillSource 'brain-lounge'
 * but each cartridge encodes its run differently:
 *
 *  • brickforge — a level-run: scorePct = levels cleared × 10 (10 stages
 *    max), correct/total mirrors that same ratio (see
 *    src/games/brickforge/scoring.ts).
 *  • chess3d — one duel: win → 1/1 (100 %), draw → 1/2 (50 %),
 *    loss → 0/1 (0 %); the pair decodes back into a W-D-L record (see
 *    src/games/chess3d/game/stats.ts).
 */

export interface LoungeAttempt {
  studentName: string;
  drillSlug: string;
  drillSource: string;
  scorePct: number;
  correctCount: number;
  totalCount: number;
  submittedAt: number; // epoch ms
}

export interface BrickEntry {
  name: string;
  plays: number;
  bestLevel: number; // 0-10 milestone stages cleared
  bestPct: number;
  lastPlayed: number;
}

export interface ChessRecord {
  name: string;
  wins: number;
  draws: number;
  losses: number;
  lastPlayed: number;
}

/** Points on the chess ladder: 2 per win, 1 per draw (loss = 0). */
export function chessPoints(record: ChessRecord): number {
  return record.wins * 2 + record.draws;
}

export function isBrickforgeAttempt(a: LoungeAttempt): boolean {
  return a.drillSource === "brain-lounge" && a.drillSlug === "brickforge";
}

export function isChessAttempt(a: LoungeAttempt): boolean {
  return a.drillSource === "brain-lounge" && a.drillSlug === "chess3d";
}

export function aggregateBrickforge(attempts: LoungeAttempt[]): BrickEntry[] {
  const byName = new Map<string, BrickEntry>();
  for (const a of attempts) {
    if (!isBrickforgeAttempt(a)) continue;
    let entry = byName.get(a.studentName);
    if (!entry) {
      entry = { name: a.studentName, plays: 0, bestLevel: 0, bestPct: 0, lastPlayed: 0 };
      byName.set(a.studentName, entry);
    }
    entry.plays += 1;
    if (a.scorePct > entry.bestPct) {
      entry.bestPct = a.scorePct;
      entry.bestLevel = Math.min(10, Math.round(a.scorePct / 10));
    }
    entry.lastPlayed = Math.max(entry.lastPlayed, a.submittedAt);
  }
  return [...byName.values()].sort(
    (x, y) => y.bestPct - x.bestPct || y.plays - x.plays || y.lastPlayed - x.lastPlayed,
  );
}

export function aggregateChess(attempts: LoungeAttempt[]): ChessRecord[] {
  const byName = new Map<string, ChessRecord>();
  for (const a of attempts) {
    if (!isChessAttempt(a)) continue;
    let entry = byName.get(a.studentName);
    if (!entry) {
      entry = { name: a.studentName, wins: 0, draws: 0, losses: 0, lastPlayed: 0 };
      byName.set(a.studentName, entry);
    }
    // Decode the outcome from the correct/total pair (win 1/1, draw 1/2, loss 0/1).
    if (a.totalCount === 1 && a.correctCount === 1) entry.wins += 1;
    else if (a.totalCount === 2 && a.correctCount === 1) entry.draws += 1;
    else if (a.totalCount === 1 && a.correctCount === 0) entry.losses += 1;
    entry.lastPlayed = Math.max(entry.lastPlayed, a.submittedAt);
  }
  return [...byName.values()].sort(
    (x, y) =>
      chessPoints(y) - chessPoints(x) ||
      y.wins - x.wins ||
      x.losses - y.losses || // fewer losses break ties
      y.lastPlayed - x.lastPlayed,
  );
}

export function timeAgo(epochMs: number): string {
  if (!epochMs) return "just now";
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
