"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { detectResult, replay } from "./chessRules";
import type { GameResult, PublicGame } from "./types";

/** Extra controls that only exist when playing against the computer. */
export interface SoloInfo {
  levelName: string;
  levelGlyph: string;
  /** true while the computer is choosing (or about to play) its move */
  thinking: boolean;
  canUndo: boolean;
  undo: () => void;
  /** go back to the difficulty picker */
  newGame: () => void;
}

export interface GameController {
  game: PublicGame | null;
  error: string | null;
  toast: string | null;
  move: (from: string, to: string, promotion?: string) => Promise<void>;
  act: (action: "resign" | "offer_draw" | "accept_draw" | "decline_draw" | "rematch") => Promise<void>;
  solo?: SoloInfo;
}

export function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  return [toast, setToast] as const;
}

/** Pass-and-play on one screen. */
export function useLocalGame(): GameController {
  const [moves, setMoves] = useState<string[]>([]);
  const [result, setResult] = useState<GameResult | null>(null);
  const [toast] = useToast();

  const game = useMemo<PublicGame>(() => {
    const chess = replay(moves);
    return {
      id: "LOCAL",
      version: moves.length,
      status: result ? "finished" : "active",
      whiteName: "White",
      blackName: "Black",
      whiteSeated: true,
      blackSeated: true,
      moves,
      fen: chess.fen(),
      turn: chess.turn(),
      inCheck: chess.inCheck(),
      result,
      drawOffer: null,
      rematchId: null,
      you: "both",
    };
  }, [moves, result]);

  const move = useCallback(
    async (from: string, to: string, promotion?: string) => {
      const chess = replay(moves);
      try {
        const m = chess.move({ from, to, promotion });
        setMoves((prev) => [...prev, m.san]);
        const res = detectResult(chess, m.color);
        if (res) setResult(res);
      } catch {
        /* illegal – ignore */
      }
    },
    [moves],
  );

  const act = useCallback<GameController["act"]>(
    async (action) => {
      if (action === "resign") {
        const turn = replay(moves).turn();
        setResult({ winner: turn === "w" ? "b" : "w", reason: "resignation" });
      } else if (action === "offer_draw" || action === "accept_draw") {
        setResult({ winner: "draw", reason: "agreement" });
      } else if (action === "rematch") {
        setMoves([]);
        setResult(null);
      }
    },
    [moves],
  );

  return { game, error: null, toast, move, act };
}
