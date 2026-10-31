/**
 * Online duel helpers for Arena Chess 3D — pure logic, unit-tested.
 *
 * The realtime channel is a Firestore document per room
 * (chess_rooms/{code}, see firestore.rules). Both clients keep an
 * onSnapshot listener and replay the SAN move list through chess.js, so
 * the board state is derived — never trusted — from the shared document.
 * Rules only enforce identity (verified accounts, seats) and document
 * shape; move legality is validated client-side by both sides.
 */
import type { GameResult } from "./types";

/** No I/1/O/0 — room codes are read aloud across a classroom. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LEN = 5;

export function generateRoomCode(rand: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < ROOM_CODE_LEN; i++) {
    out += ROOM_CODE_ALPHABET[Math.floor(rand() * ROOM_CODE_ALPHABET.length)];
  }
  return out;
}

export function isRoomCode(value: string): boolean {
  return new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LEN}}$`).test(value);
}

/** Shape of the chess_rooms/{code} document shared by both players. */
export interface RoomData {
  code: string;
  hostUid: string;
  hostName: string;
  /** Host's seat colour in game 1 — later games swap deterministically. */
  hostColor: "w" | "b";
  guestUid: string | null;
  guestName: string | null;
  status: "waiting" | "active" | "finished" | "closed";
  moves: string[];
  result: GameResult | null;
  drawOffer: "w" | "b" | null;
  /** Rematch counter — colours derive from it, so every client agrees. */
  gameNo: number;
  updatedAt?: string;
}

export function otherColor(c: "w" | "b"): "w" | "b" {
  return c === "w" ? "b" : "w";
}

/** Host's seat for game N — colours swap after every rematch. */
export function hostColorForGame(base: "w" | "b", gameNo: number): "w" | "b" {
  const swapped = (Math.max(1, Math.floor(gameNo)) - 1) % 2 === 1;
  return swapped ? otherColor(base) : base;
}

/** The requesting player's seat, or null for a bystander. */
export function seatFor(room: RoomData, uid: string): "w" | "b" | null {
  if (room.hostUid === uid) return hostColorForGame(room.hostColor, room.gameNo);
  if (room.guestUid === uid) return otherColor(hostColorForGame(room.hostColor, room.gameNo));
  return null;
}

export type ChessOutcome = "win" | "draw" | "loss";

export function outcomeFor(result: GameResult, you: "w" | "b"): ChessOutcome {
  if (result.winner === "draw") return "draw";
  return result.winner === you ? "win" : "loss";
}

/** Colour of the side that made the nth (1-based count) move. */
export function lastMoverColor(moveCount: number): "w" | "b" {
  return moveCount % 2 === 1 ? "w" : "b";
}
