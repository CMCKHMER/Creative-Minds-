export type Color = "w" | "b";
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

export interface GameResult {
  winner: Color | "draw";
  reason: string;
}

export interface PublicGame {
  id: string;
  version: number;
  status: "waiting" | "active" | "finished";
  whiteName: string | null;
  blackName: string | null;
  whiteSeated: boolean;
  blackSeated: boolean;
  moves: string[];
  fen: string;
  turn: Color;
  inCheck: boolean;
  result: GameResult | null;
  drawOffer: Color | null;
  rematchId: string | null;
  /** Seat of the requesting player. `both` is used for local pass-and-play. */
  you: Color | "both" | null;
}

export interface LobbyGame {
  id: string;
  status: "waiting" | "active";
  whiteName: string | null;
  blackName: string | null;
  moveCount: number;
  updatedAt: string;
}

export const PIECE_NAMES: Record<PieceType, string> = {
  p: "Footman",
  n: "Charger",
  b: "Bishop",
  r: "Bastion",
  q: "Queen",
  k: "King",
};

export const PIECE_GLYPH: Record<Color, Record<PieceType, string>> = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};
