
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { aiClient } from "./ai/client";
import { levelById, type LevelId } from "./ai/levels";
import { detectResult, replay } from "./chessRules";
import { getPlayerName } from "./player";
import type { Color, GameResult, PublicGame } from "./types";
import { useToast, type GameController } from "./useGame";

export interface SoloConfig {
  level: LevelId;
  color: Color;
}

function uciHistory(moves: string[]): string[] {
  return replay(moves)
    .history({ verbose: true })
    .map((m) => m.from + m.to + (m.promotion ?? ""));
}

/** Human vs. computer. The engine runs in a Web Worker; its reply is committed like any other move. */
export function useSoloGame(config: SoloConfig, onExit: () => void): GameController {
  const level = levelById(config.level);
  const [human, setHuman] = useState<Color>(config.color);
  const ai: Color = human === "w" ? "b" : "w";
  const [moves, setMoves] = useState<string[]>([]);
  const [result, setResult] = useState<GameResult | null>(null);
  const [toast, setToast] = useToast();
  const [name] = useState(() => (typeof window === "undefined" ? "" : getPlayerName()));

  const movesRef = useRef<string[]>([]);
  const resultRef = useRef<GameResult | null>(null);

  const finish = useCallback((res: GameResult) => {
    resultRef.current = res;
    setResult(res);
  }, []);

  const commit = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      if (resultRef.current) return false;
      const chess = replay(movesRef.current);
      try {
        const m = chess.move({ from, to, promotion });
        const next = [...movesRef.current, m.san];
        movesRef.current = next;
        setMoves(next);
        const res = detectResult(chess, m.color);
        if (res) finish(res);
        return true;
      } catch {
        return false;
      }
    },
    [finish],
  );

  const turn: Color = moves.length % 2 === 0 ? "w" : "b";
  const thinking = !result && turn === ai;

  // the computer's turn
  useEffect(() => {
    if (result || turn !== ai) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = performance.now();

    const fallback = () => {
      // should never happen – but never leave the human stuck waiting
      const options = replay(movesRef.current).moves({ verbose: true });
      if (!options.length) return;
      const pick = options[Math.floor(Math.random() * options.length)];
      commit(pick.from, pick.to, pick.promotion);
    };

    aiClient.request("move", uciHistory(moves), level.id).then((res) => {
      if (cancelled) return;
      const wait = Math.max(0, level.minThinkMs - (performance.now() - started));
      timer = setTimeout(() => {
        if (cancelled) return;
        if (!res.ok || !res.from || !res.to || !commit(res.from, res.to, res.promotion)) fallback();
      }, wait);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      aiClient.cancel();
    };
  }, [moves, result, turn, ai, level, commit]);

  const move = useCallback<GameController["move"]>(
    async (from, to, promotion) => {
      const cur = movesRef.current;
      if ((cur.length % 2 === 0 ? "w" : "b") !== human) return;
      commit(from, to, promotion);
    },
    [commit, human],
  );

  const canUndo = !result && (turn === human ? 2 : 1) <= moves.length;
  const undo = useCallback(() => {
    if (resultRef.current) return;
    const cur = movesRef.current;
    const t: Color = cur.length % 2 === 0 ? "w" : "b";
    const count = t === human ? 2 : 1;
    if (count > cur.length) return;
    const next = cur.slice(0, cur.length - count);
    movesRef.current = next;
    setMoves(next);
  }, [human]);

  const act = useCallback<GameController["act"]>(
    async (action) => {
      if (action === "resign") {
        if (!resultRef.current) finish({ winner: ai, reason: "resignation" });
      } else if (action === "offer_draw") {
        if (resultRef.current) return;
        const len = movesRef.current.length;
        const res = await aiClient.request("eval", uciHistory(movesRef.current), level.id);
        if (!res.ok || resultRef.current || movesRef.current.length !== len) return;
        const stm: Color = len % 2 === 0 ? "w" : "b";
        const aiScore = (stm === ai ? 1 : -1) * (res.score ?? 0);
        if (aiScore <= -60) finish({ winner: "draw", reason: "agreement" });
        else setToast(`${level.name} declines your draw offer.`);
      } else if (action === "rematch") {
        movesRef.current = [];
        resultRef.current = null;
        setMoves([]);
        setResult(null);
        setHuman((c) => (c === "w" ? "b" : "w"));
      }
    },
    [ai, finish, level, setToast],
  );

  const game = useMemo<PublicGame>(() => {
    const chess = replay(moves);
    const me = name.trim() || "You";
    const bot = `${level.name} · AI`;
    return {
      id: "SOLO",
      version: moves.length + (result ? 1 : 0),
      status: result ? "finished" : "active",
      whiteName: human === "w" ? me : bot,
      blackName: human === "b" ? me : bot,
      whiteSeated: true,
      blackSeated: true,
      moves,
      fen: chess.fen(),
      turn: chess.turn(),
      inCheck: chess.inCheck(),
      result,
      drawOffer: null,
      rematchId: null,
      you: human,
    };
  }, [moves, result, human, name, level]);

  return {
    game,
    error: null,
    toast,
    move,
    act,
    solo: { levelName: level.name, levelGlyph: level.glyph, thinking, canUndo, undo, newGame: onExit },
  };
}
