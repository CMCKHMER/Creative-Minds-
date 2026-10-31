/**
 * Player-stats submission for Arena Chess 3D.
 *
 * drill_attempts models every game as a scored drill so the shared
 * scoreboard pipeline (submitScore → Firestore REST) accepts it:
 *   win  → 1/1 = 100 %
 *   draw → 1/2 =  50 %
 *   loss → 0/1 =   0 %
 * The correct/total pair mirrors the percentage exactly (same invariant
 * the quiz drills keep), and the Lounge leaderboard decodes the pair
 * back into a W-D-L record — see src/lib/brainLoungeStats.ts.
 */
import { submitScore } from "../../../lib/submitScore";
import type { ChessOutcome } from "./online";

export const CHESS_DRILL_SLUG = "chess3d";
export const CHESS_DRILL_TITLE = "Arena Chess 3D · Brain Lounge";

export function chessScoreFields(outcome: ChessOutcome): { scorePct: number; correctCount: number; totalCount: number } {
  if (outcome === "win") return { scorePct: 100, correctCount: 1, totalCount: 1 };
  if (outcome === "draw") return { scorePct: 50, correctCount: 1, totalCount: 2 };
  return { scorePct: 0, correctCount: 0, totalCount: 1 };
}

/** Silent no-op for guests — anonymous play stays anonymous. */
export function submitChessResult(outcome: ChessOutcome): void {
  void submitScore({
    drillSlug: CHESS_DRILL_SLUG,
    drillTitle: CHESS_DRILL_TITLE,
    drillSource: "brain-lounge",
    ...chessScoreFields(outcome),
  });
}
