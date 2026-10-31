import { Chess } from "chess.js";
import type { Color, GameResult } from "./types";

/** Rebuild a chess.js instance from a SAN move list. */
export function replay(moves: string[]): Chess {
  const chess = new Chess();
  for (const san of moves) chess.move(san);
  return chess;
}

/** Work out whether the position on the board has ended the game. */
export function detectResult(chess: Chess, lastMover: Color): GameResult | null {
  if (chess.isCheckmate()) return { winner: lastMover, reason: "checkmate" };
  if (chess.isStalemate()) return { winner: "draw", reason: "stalemate" };
  if (chess.isInsufficientMaterial()) return { winner: "draw", reason: "insufficient material" };
  if (chess.isThreefoldRepetition()) return { winner: "draw", reason: "threefold repetition" };
  if (chess.isDraw()) return { winner: "draw", reason: "fifty-move rule" };
  return null;
}
