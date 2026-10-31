// Type declarations for functions/lib/aggregate.cjs — shared ticker logic.
// Lets the vitest suite (src/tests/tickerAggregate.test.ts) import the same
// module the Cloud Function runs in production.

export interface TickerAttempt {
  drillSource: string;
  studentName: string;
  scorePct: number;
  submittedAt: number; // epoch ms
}

export interface TickerTotals {
  totalDrills: number;
  assignmentsTotal: number;
}

export interface TickerStats {
  totalDrills: number;
  activeStudents: number;
  drillsToday: number;
  drillsThisWeek: number;
  assignmentsWeek: number;
  assignmentsTotal: number;
}

export interface TickerLeaderEntry {
  name: string;
  drills: number;
  avgScore: number;
}

export const DAY_MS: number;
export const ICT_OFFSET_MS: number;
export function startOfTodayMs(now: number): number;
export function weekStartMs(now: number): number;
export function computeTickerStats(
  attempts: TickerAttempt[],
  now: number,
  totals: TickerTotals,
): { stats: TickerStats; leaderboard: TickerLeaderEntry[] };
