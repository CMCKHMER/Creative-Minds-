/**
 * useOnlineGame — Arena Chess 3D over a Firestore room document, via the
 * REST room channel (roomClient.ts — works for every signed-in player
 * regardless of sign-in flavour; see that file's header for why the SDK
 * listener was rejected).
 *
 * The board state is always derived by replaying the shared SAN move
 * list through chess.js, so both clients converge without trusting each
 * other. Own moves are mirrored optimistically and confirmed by the next
 * poll (~1 s). Rematches swap colours deterministically via the gameNo
 * counter, so double clicks can never split the two clients.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRoom, RoomAuthError, updateRoom } from "./roomClient";
import { detectResult, replay } from "./chessRules";
import { hostColorForGame, otherColor, outcomeFor, seatFor } from "./online";
import type { RoomData } from "./online";
import { submitChessResult } from "./stats";
import type { Color, GameResult, PublicGame } from "./types";
import { useToast, type GameController } from "./useGame";

export interface OnlineIdentity {
  uid: string;
  name: string;
}

/** Poll cadence: brisk while the table is live, relaxed once it's over. */
const POLL_ACTIVE_MS = 1200;
const POLL_IDLE_MS = 5000;

export function useOnlineGame(config: { code: string; identity: OnlineIdentity }): GameController {
  const { code, identity } = config;
  const [room, setRoom] = useState<RoomData | null>(null);
  const [moves, setMoves] = useState<string[]>([]);
  const [result, setResult] = useState<GameResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useToast();

  const roomRef = useRef<RoomData | null>(null);
  const movesRef = useRef<string[]>([]);
  const seatRef = useRef<Color | null>(null);
  const resultRef = useRef<GameResult | null>(null);
  const submittedGameNo = useRef(0);

  /** Apply one room snapshot — the single path every poll flows through. */
  const applyRoom = useCallback((data: RoomData) => {
    roomRef.current = data;
    setRoom(data);
    seatRef.current = seatFor(data, identity.uid);
    if (data.status === "closed") {
      setError("This room was closed by its host.");
      return;
    }
    const chess = replay(data.moves);
    const detected = detectResult(chess, data.moves.length % 2 === 1 ? "w" : "b");
    const finalResult = data.result ?? detected;
    if (finalResult && !resultRef.current) {
      resultRef.current = finalResult;
      setResult(finalResult);
    }
    // One stats row per finished game, per player.
    if (finalResult && seatRef.current && submittedGameNo.current !== data.gameNo) {
      submittedGameNo.current = data.gameNo;
      submitChessResult(outcomeFor(finalResult, seatRef.current));
    }
    movesRef.current = data.moves;
    setMoves(data.moves);
  }, [identity.uid]);

  // ── poll loop ───────────────────────────────────────────────────────
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const data = await getRoom(code);
        if (stopped) return;
        if (data == null) {
          setError("This room was closed by its host.");
          return;
        }
        applyRoom(data);
        setError(null);
      } catch (e) {
        if (stopped) return;
        if (e instanceof RoomAuthError) {
          setError("Only signed-in CMC members can reach the online tables — sign in and try again.");
          return;
        }
        // Transient network hiccup — keep polling quietly.
        console.warn("[chess3d] room poll failed:", e);
      }
      if (!stopped) {
        const live = roomRef.current && roomRef.current.status !== "finished" && roomRef.current.status !== "closed";
        timer = setTimeout(() => void tick(), live ? POLL_ACTIVE_MS : POLL_IDLE_MS);
      }
    };

    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [code, applyRoom]);

  const seat = room ? seatFor(room, identity.uid) : null;

  // ── moves ───────────────────────────────────────────────────────────
  const move = useCallback<GameController["move"]>(
    async (from, to, promotion) => {
      const current = roomRef.current;
      const mySeat = seatRef.current;
      if (!current || !mySeat || current.guestUid == null) return;
      if (resultRef.current) return;
      const chess = replay(movesRef.current);
      if (chess.turn() !== mySeat) return;
      let san: string;
      try {
        const m = chess.move({ from, to, promotion });
        san = m.san;
      } catch {
        return; // illegal — ignore
      }
      const nextMoves = [...movesRef.current, san];
      const res = detectResult(chess, chess.turn() === "w" ? "b" : "w");
      // Optimistic local mirror; the next poll echoes the same state.
      movesRef.current = nextMoves;
      setMoves(nextMoves);
      if (res) {
        resultRef.current = res;
        setResult(res);
      }
      try {
        await updateRoom(code, {
          moves: nextMoves,
          ...(res ? { status: "finished" as const, result: res, drawOffer: null } : { drawOffer: null }),
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        if (!(e instanceof RoomAuthError)) console.warn("[chess3d] move write failed:", e);
        setToast("That move did not reach the table — check your connection.");
      }
    },
    [code, setToast],
  );

  // ── resign / draws / rematch ────────────────────────────────────────
  const act = useCallback<GameController["act"]>(
    async (action) => {
      const current = roomRef.current;
      const mySeat = seatRef.current;
      if (!current || !mySeat) return;
      const stamp = () => ({ updatedAt: new Date().toISOString() });

      if (action === "resign") {
        if (resultRef.current || current.status === "finished") return;
        const res: GameResult = { winner: otherColor(mySeat), reason: "resignation" };
        resultRef.current = res;
        setResult(res);
        try {
          await updateRoom(code, { status: "finished", result: res, drawOffer: null, ...stamp() });
        } catch (e) {
          console.warn("[chess3d] resign write failed:", e);
        }
      } else if (action === "offer_draw") {
        if (resultRef.current) return;
        if (current.drawOffer === mySeat) {
          setToast("You already offered a draw.");
          return;
        }
        try {
          await updateRoom(code, { drawOffer: mySeat, ...stamp() });
          setToast("Draw offered.");
        } catch (e) {
          console.warn("[chess3d] draw offer failed:", e);
        }
      } else if (action === "accept_draw") {
        if (resultRef.current || current.drawOffer == null || current.drawOffer === mySeat) return;
        const res: GameResult = { winner: "draw", reason: "agreement" };
        resultRef.current = res;
        setResult(res);
        try {
          await updateRoom(code, { status: "finished", result: res, drawOffer: null, ...stamp() });
        } catch (e) {
          console.warn("[chess3d] draw accept failed:", e);
        }
      } else if (action === "decline_draw") {
        if (current.drawOffer == null || current.drawOffer === mySeat) return;
        try {
          await updateRoom(code, { drawOffer: null, ...stamp() });
          setToast("Draw declined.");
        } catch (e) {
          console.warn("[chess3d] draw decline failed:", e);
        }
      } else if (action === "rematch") {
        if (current.status !== "finished") return;
        // gameNo drives the seat colours, so both clients derive the same
        // swap even if two rematch clicks race (the last write wins and
        // simply rolls another fresh game).
        movesRef.current = [];
        setMoves([]);
        resultRef.current = null;
        setResult(null);
        try {
          await updateRoom(code, {
            gameNo: current.gameNo + 1,
            moves: [],
            status: "active",
            result: null,
            drawOffer: null,
            ...stamp(),
          });
        } catch (e) {
          console.warn("[chess3d] rematch failed:", e);
          setToast("Rematch did not start — check your connection.");
        }
      }
    },
    [code, setToast],
  );

  const game = useMemo<PublicGame | null>(() => {
    if (!room) return null;
    const chess = replay(moves);
    const hostSeatNow = hostColorForGame(room.hostColor, room.gameNo);
    const hostIsWhite = hostSeatNow === "w";
    return {
      id: `ONLINE-${room.code}-g${room.gameNo}`,
      version: room.moves.length + room.gameNo * 10000,
      status: result || room.result ? "finished" : room.guestUid ? "active" : "waiting",
      whiteName: hostIsWhite ? room.hostName : room.guestName,
      blackName: hostIsWhite ? room.guestName : room.hostName,
      whiteSeated: hostIsWhite ? true : room.guestUid != null,
      blackSeated: hostIsWhite ? room.guestUid != null : true,
      moves,
      fen: chess.fen(),
      turn: chess.turn(),
      inCheck: chess.inCheck(),
      result: result ?? room.result ?? null,
      drawOffer: room.drawOffer,
      rematchId: null,
      you: seat,
    };
  }, [room, moves, result, seat]);

  return { game, error, toast, move, act };
}
