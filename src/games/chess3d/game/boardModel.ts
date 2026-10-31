
import { Chess } from "chess.js";
import { useEffect, useRef, useState } from "react";
import { buildTimeline } from "./timeline";
import type { Color, PieceType } from "./types";

export interface PieceState {
  id: string;
  type: PieceType;
  color: Color;
  square: string;
  dead?: boolean;
}

export interface BoardAction {
  key: number;
  san: string;
  color: Color;
  moverId: string;
  /** type of the mover *before* promotion */
  moverType: PieceType;
  from: string;
  to: string;
  victimId?: string;
  victimType?: PieceType;
  victimColor?: Color;
  victimSquare?: string;
  promotion?: PieceType;
  rook?: { id: string; from: string; to: string };
  check: boolean;
  mate: boolean;
}

export interface BoardView {
  pieces: PieceState[];
  action: BoardAction | null;
}

const BACK_RANK: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];

function initialPieces(): PieceState[] {
  const pieces: PieceState[] = [];
  const files = "abcdefgh";
  for (let f = 0; f < 8; f++) {
    pieces.push({ id: `w${BACK_RANK[f]}${f}`, type: BACK_RANK[f], color: "w", square: `${files[f]}1` });
    pieces.push({ id: `wp${f}`, type: "p", color: "w", square: `${files[f]}2` });
    pieces.push({ id: `bp${f}`, type: "p", color: "b", square: `${files[f]}7` });
    pieces.push({ id: `b${BACK_RANK[f]}${f}`, type: BACK_RANK[f], color: "b", square: `${files[f]}8` });
  }
  return pieces;
}

/**
 * Tracks every piece with a stable identity, so the 3D scene can animate
 * individual figures (walk, attack, fall) instead of re-rendering a FEN.
 */
export class BoardModel {
  chess = new Chess();
  pieces: PieceState[] = initialPieces();
  applied: string[] = [];
  private key = 0;

  reset(moves: string[]) {
    this.chess = new Chess();
    this.pieces = initialPieces();
    this.applied = [];
    for (const san of moves) this.step(san);
    this.pieces = this.pieces.filter((p) => !p.dead);
  }

  snapshot(): PieceState[] {
    return this.pieces.map((p) => ({ ...p }));
  }

  private step(san: string): BoardAction {
    const move = this.chess.move(san);
    const live = (sq: string) => this.pieces.find((p) => !p.dead && p.square === sq);

    const mover = live(move.from);
    if (!mover) throw new Error(`No piece on ${move.from}`);

    let victim: PieceState | undefined;
    if (move.flags.includes("e")) victim = live(move.to[0] + move.from[1]);
    else if (move.captured) victim = live(move.to);

    let rook: BoardAction["rook"];
    if (move.flags.includes("k") || move.flags.includes("q")) {
      const rank = move.from[1];
      const kingSide = move.flags.includes("k");
      const rookFrom = `${kingSide ? "h" : "a"}${rank}`;
      const rookTo = `${kingSide ? "f" : "d"}${rank}`;
      const r = live(rookFrom);
      if (r) {
        rook = { id: r.id, from: rookFrom, to: rookTo };
        r.square = rookTo;
      }
    }

    const action: BoardAction = {
      key: ++this.key,
      san: move.san,
      color: move.color,
      moverId: mover.id,
      moverType: mover.type,
      from: move.from,
      to: move.to,
      victimId: victim?.id,
      victimType: victim?.type,
      victimColor: victim?.color,
      victimSquare: victim?.square,
      promotion: move.promotion as PieceType | undefined,
      rook,
      check: this.chess.inCheck(),
      mate: this.chess.isCheckmate(),
    };

    if (victim) victim.dead = true;
    mover.square = move.to;
    if (move.promotion) mover.type = move.promotion as PieceType;
    this.applied.push(move.san);
    return action;
  }

  /**
   * Advance one move towards `moves`. Returns null if already in sync.
   * If the lists diverge (or we are far behind) the board snaps instead of animating.
   */
  sync(moves: string[]): (BoardView & { remaining: number }) | null {
    const a = this.applied;
    const isPrefix = a.length <= moves.length && a.every((m, i) => m === moves[i]);
    if (isPrefix && a.length === moves.length) return null;

    if (!isPrefix) {
      this.reset(moves);
      return { pieces: this.snapshot(), action: null, remaining: 0 };
    }

    this.pieces = this.pieces.filter((p) => !p.dead);
    if (moves.length - a.length > 3) {
      // too far behind: snap to just before the final move
      for (let i = a.length; i < moves.length - 1; i++) this.step(moves[i]);
      this.pieces = this.pieces.filter((p) => !p.dead);
    }

    const action = this.step(moves[this.applied.length]);
    return { pieces: this.snapshot(), action, remaining: moves.length - this.applied.length };
  }
}

/** React binding: keeps a BoardModel in sync with a SAN move list and queues animations. */
export function useBoardModel(moves: string[], speed: number) {
  const [model] = useState(() => {
    const m = new BoardModel();
    m.reset(moves);
    return m;
  });
  const [view, setView] = useState<BoardView>(() => ({ pieces: model.snapshot(), action: null }));
  const busyUntil = useRef(0);
  const speedRef = useRef(speed);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      const wait = busyUntil.current - performance.now();
      if (wait > 10) {
        timer = setTimeout(run, wait);
        return;
      }
      const res = model.sync(moves);
      if (!res) return;
      if (res.action) {
        busyUntil.current = performance.now() + (buildTimeline(res.action).total * 1000) / speedRef.current;
      }
      setView({ pieces: res.pieces, action: res.action });
      if (res.remaining > 0) run();
    };
    run();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [moves, model]);

  // Remove fallen pieces from the scene once their animation is finished.
  useEffect(() => {
    if (!view.pieces.some((p) => p.dead)) return;
    const ms = view.action ? (buildTimeline(view.action).total * 1000) / speed + 1200 : 0;
    const t = setTimeout(() => {
      setView((v) => ({ ...v, pieces: v.pieces.filter((p) => !p.dead) }));
    }, ms);
    return () => clearTimeout(t);
  }, [view, speed]);

  const isBusy = () => performance.now() < busyUntil.current;
  return { pieces: view.pieces, action: view.action, isBusy };
}
