
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Move } from "chess.js";
import { useBoardModel } from "./boardModel";
import { replay } from "./chessRules";
import { isMuted, playSfx, setMuted, type SfxKind } from "./sound";
import type { GameController, SoloInfo } from "./useGame";
import { PIECE_GLYPH, type Color, type PieceType, type PublicGame } from "./types";

const ChessScene = lazy(() => import("./three/ChessScene"));

const VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const PROMO: PieceType[] = ["q", "r", "b", "n"];
const PROMO_NAME: Record<string, string> = { q: "Queen", r: "Bastion", b: "Bishop", n: "Charger" };

function resultText(game: PublicGame): { title: string; sub: string } {
  const r = game.result!;
  const reason = r.reason.charAt(0).toUpperCase() + r.reason.slice(1);
  if (r.winner === "draw") return { title: "Draw", sub: reason };
  const winnerName = r.winner === "w" ? "White" : "Black";
  if (game.you === "w" || game.you === "b") {
    return game.you === r.winner
      ? { title: "Victory!", sub: `You won by ${r.reason}` }
      : { title: "Defeat", sub: `${winnerName} won by ${r.reason}` };
  }
  return { title: `${winnerName} wins`, sub: `By ${r.reason}` };
}

function IconButton({
  onClick,
  title,
  active,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`grid h-10 w-10 place-items-center rounded-xl border text-lg backdrop-blur transition hover:scale-105 ${
        active
          ? "border-amber-300/60 bg-amber-300/20 text-amber-100"
          : "border-white/10 bg-slate-900/70 text-slate-200 hover:bg-slate-800/80"
      }`}
    >
      {children}
    </button>
  );
}

function PlayerCard({
  color,
  name,
  active,
  captured,
  advantage,
  you,
  thinking,
}: {
  color: Color;
  name: string;
  active: boolean;
  captured: PieceType[];
  advantage: number;
  you: boolean;
  thinking?: boolean;
}) {
  return (
    <div
      className={`pointer-events-auto flex min-w-[210px] items-center gap-3 rounded-2xl border px-3 py-2 backdrop-blur transition ${
        active ? "border-amber-300/60 bg-slate-900/85 shadow-[0_0_30px_rgba(251,191,36,0.25)]" : "border-white/10 bg-slate-900/65"
      }`}
    >
      <div
        className={`grid h-10 w-10 place-items-center rounded-full text-2xl ${
          color === "w" ? "bg-stone-100 text-slate-900" : "bg-slate-950 text-stone-100 ring-1 ring-white/20"
        }`}
      >
        {PIECE_GLYPH[color].k}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-white">{name}</span>
          {you && <span className="rounded bg-amber-300/20 px-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">you</span>}
          {thinking ? (
            <span className="text-[11px] italic text-amber-200/90">
              thinking<span className="animate-pulse">…</span>
            </span>
          ) : (
            active && <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          )}
        </div>
        <div className="flex h-5 items-center gap-0.5 text-[15px] leading-none text-slate-300">
          {captured.map((t, i) => (
            <span key={i} className="-mr-1">
              {PIECE_GLYPH[color === "w" ? "b" : "w"][t]}
            </span>
          ))}
          {advantage > 0 && <span className="ml-2 text-xs font-semibold text-emerald-300">+{advantage}</span>}
        </div>
      </div>
    </div>
  );
}

export default function GameView({ ctrl, mode, onExit }: { ctrl: GameController; mode: "local" | "solo"; onExit: () => void }) {
  const { game, error, toast, move, act } = ctrl;

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#080b12] px-6 text-center text-slate-200">
        <div className="max-w-md rounded-3xl border border-white/10 bg-slate-900/70 p-8">
          <div className="text-5xl">♞</div>
          <h1 className="mt-4 text-xl font-semibold">Table unavailable</h1>
          <p className="mt-2 text-slate-400">{error}</p>
          <button onClick={onExit} className="mt-6 inline-block rounded-xl bg-amber-400 px-5 py-2.5 font-semibold text-slate-900 hover:bg-amber-300">
            Back to the lounge
          </button>
        </div>
      </div>
    );
  }
  if (!game) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#080b12] text-sm tracking-[0.3em] text-amber-200/70">
        TAKING A SEAT…
      </div>
    );
  }
  return (
    <GameInner game={game} move={move} act={act} toast={toast} mode={mode} solo={ctrl.solo} onExit={onExit} />
  );
}

function GameInner({
  game,
  move,
  act,
  toast,
  mode,
  solo,
  onExit,
}: {
  game: PublicGame;
  move: GameController["move"];
  act: GameController["act"];
  toast: string | null;
  mode: "local" | "solo";
  solo?: SoloInfo;
  onExit: () => void;
}) {
  const [speed, setSpeed] = useState(1);
  const [muted, setMutedState] = useState(false);
  const [blood, setBlood] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const [flipSignal, setFlipSignal] = useState(0);
  const [autoFlip, setAutoFlip] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const movesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSpeed(window.localStorage.getItem("chess3d:fast") === "1" ? 1.8 : 1);
    setMutedState(isMuted());
    setBlood(window.localStorage.getItem("chess3d:blood") !== "0");
  }, []);

  const { pieces, action, isBusy } = useBoardModel(game.moves, speed);
  const chess = useMemo(() => replay(game.moves), [game.moves]);
  const turn = chess.turn();
  const you = game.you;
  const active = game.status === "active";
  const canMove = active && (you === "both" || you === turn);
  const side: Color = you === "b" ? "b" : "w";

  const history = useMemo(() => chess.history({ verbose: true }) as Move[], [chess]);
  const lastMove = history.length ? { from: history[history.length - 1].from, to: history[history.length - 1].to } : null;

  const legal = useMemo(() => {
    if (!selected) return [] as Move[];
    return chess.moves({ square: selected as never, verbose: true }) as Move[];
  }, [chess, selected]);
  const targets = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const m of legal) map.set(m.to, map.get(m.to) || m.flags.includes("c") || m.flags.includes("e"));
    return [...map.entries()].map(([square, capture]) => ({ square, capture }));
  }, [legal]);

  const checkSquare = useMemo(() => {
    if (!chess.inCheck()) return null;
    for (const row of chess.board()) for (const p of row) if (p && p.type === "k" && p.color === turn) return p.square;
    return null;
  }, [chess, turn]);

  const { capturedByW, capturedByB, advantage } = useMemo(() => {
    const byW: PieceType[] = [];
    const byB: PieceType[] = [];
    for (const m of history) if (m.captured) (m.color === "w" ? byW : byB).push(m.captured as PieceType);
    const order = (a: PieceType, b: PieceType) => VALUE[b] - VALUE[a];
    byW.sort(order);
    byB.sort(order);
    const sum = (l: PieceType[]) => l.reduce((s, t) => s + VALUE[t], 0);
    return { capturedByW: byW, capturedByB: byB, advantage: sum(byW) - sum(byB) };
  }, [history]);

  // reset selection whenever the position changes
  useEffect(() => {
    setSelected(null);
    setPromo(null);
    setConfirmResign(false);
  }, [game.moves.length]);

  useEffect(() => {
    movesEnd.current?.scrollIntoView({ block: "end" });
  }, [game.moves.length]);

  // local pass-and-play: optionally swing the camera to the player to move
  const prevTurn = useRef(turn);
  useEffect(() => {
    if (mode === "local" && autoFlip && prevTurn.current !== turn && active) {
      const t = setTimeout(() => setFlipSignal((s) => s + 1), 1400 / speed);
      prevTurn.current = turn;
      return () => clearTimeout(t);
    }
    prevTurn.current = turn;
  }, [turn, autoFlip, mode, active, speed]);

  // result modal after the final animation has played
  useEffect(() => {
    if (!game.result) {
      setShowResult(false);
      return;
    }
    const delay = game.result.reason === "checkmate" ? 3600 / speed : 700;
    const t = setTimeout(() => {
      setShowResult(true);
      if (game.result?.reason !== "checkmate") playSfx("end");
    }, delay);
    return () => clearTimeout(t);
  }, [game.result, speed]);

  const prevStatus = useRef(game.status);
  useEffect(() => {
    if (prevStatus.current === "waiting" && game.status === "active") playSfx("start");
    prevStatus.current = game.status;
  }, [game.status]);

  const isMine = useCallback(
    (c: Color) => (you === "both" ? true : you === c),
    [you],
  );

  const canClick = useCallback(
    (sq: string) => {
      if (!canMove) return false;
      if (targets.some((t) => t.square === sq)) return true;
      const p = chess.get(sq as never);
      return !!p && p.color === turn && isMine(p.color);
    },
    [canMove, targets, chess, turn, isMine],
  );

  const onSquare = useCallback(
    (sq: string) => {
      if (!canMove || isBusy() || promo) return;
      if (selected) {
        const options = legal.filter((m) => m.to === sq);
        if (options.length) {
          if (options.some((m) => m.promotion)) setPromo({ from: selected, to: sq });
          else void move(selected, sq);
          return;
        }
      }
      const p = chess.get(sq as never);
      if (p && p.color === turn && isMine(p.color) && sq !== selected) {
        setSelected(sq);
        playSfx("select");
      } else {
        setSelected(null);
      }
    },
    [canMove, isBusy, promo, selected, legal, chess, turn, isMine, move],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
        setPromo(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onSfx = useCallback((k: SfxKind) => playSfx(k), []);

  const whiteName = game.whiteName ?? (game.whiteSeated ? "White" : "Waiting…");
  const blackName = game.blackName ?? (game.blackSeated ? "Black" : "Waiting…");
  const topColor: Color = side === "w" ? "b" : "w";
  const bottomColor: Color = side;
  const nameOf = (c: Color) => (c === "w" ? whiteName : blackName);
  const capturedOf = (c: Color) => (c === "w" ? capturedByW : capturedByB);
  const advOf = (c: Color) => (c === "w" ? Math.max(0, advantage) : Math.max(0, -advantage));

  let status: string;
  if (game.status === "waiting") status = "Waiting for an opponent to join…";
  else if (game.status === "finished") status = game.result ? resultText(game).title : "Game over";
  else if (you === "both") status = `${turn === "w" ? "White" : "Black"} to move`;
  else if (you === null) status = `Spectating · ${turn === "w" ? "White" : "Black"} to move`;
  else status = canMove ? "Your move" : mode === "solo" && solo ? `${solo.levelName} is thinking…` : "Opponent is thinking…";
  if (active && game.moves.length && chess.inCheck()) status += " · Check!";

  const pairs: { n: number; w: string; b?: string }[] = [];
  for (let i = 0; i < game.moves.length; i += 2) pairs.push({ n: i / 2 + 1, w: game.moves[i], b: game.moves[i + 1] });

  const seated = you === "w" || you === "b";
  const opponentOffered = seated && game.drawOffer && game.drawOffer !== you;
  const iOffered = seated && game.drawOffer === you;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#080b12] text-slate-100 select-none">
      <div className="absolute inset-0 lg:right-[19.5rem]">
        <Suspense
          fallback={
            <div className="grid h-full w-full place-items-center text-sm tracking-[0.3em] text-amber-200/70">
              SETTING THE BOARD…
            </div>
          }
        >
          <ChessScene
            pieces={pieces}
            action={action}
            speed={speed}
            selectedSquare={selected}
            targets={targets}
            lastMove={lastMove}
            checkSquare={checkSquare}
            interactive={canMove}
            side={side}
            flipSignal={flipSignal}
            canClick={canClick}
            onSquare={onSquare}
            onSfx={onSfx}
            blood={blood}
          />
        </Suspense>
      </div>

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={onExit}
            className="grid h-10 place-items-center rounded-xl border border-white/10 bg-slate-900/70 px-3 text-sm font-medium backdrop-blur hover:bg-slate-800/80"
          >
            ← Lounge shelf
          </button>
          {mode === "local" && (
            <span className="grid h-10 place-items-center rounded-xl border border-white/10 bg-slate-900/70 px-3 text-sm text-slate-300 backdrop-blur">
              Pass &amp; play
            </span>
          )}
          {mode === "solo" && solo && (
            <span className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 px-3 text-sm text-slate-200 backdrop-blur">
              <span className="text-lg text-amber-200">{solo.levelGlyph}</span>
              <span>
                vs <b className="font-semibold text-white">{solo.levelName}</b>
              </span>
            </span>
          )}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <IconButton title="Flip the board" onClick={() => setFlipSignal((s) => s + 1)}>
            ⟳
          </IconButton>
          {mode === "local" && (
            <IconButton title="Auto-turn camera each move" active={autoFlip} onClick={() => setAutoFlip((v) => !v)}>
              ⇅
            </IconButton>
          )}
          <button
            onClick={() => {
              const next = !blood;
              setBlood(next);
              window.localStorage.setItem("chess3d:blood", next ? "1" : "0");
            }}
            title={blood ? "Blood: on (click to turn off)" : "Blood: off (click to turn on)"}
            aria-pressed={blood}
            className={`flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold backdrop-blur transition hover:scale-105 ${
              blood ? "border-red-400/60 bg-red-900/50 text-red-100" : "border-white/10 bg-slate-900/70 text-slate-400 hover:bg-slate-800/80"
            }`}
          >
            <span className="text-base">🩸</span>
            <span className="hidden sm:inline">Blood {blood ? "on" : "off"}</span>
          </button>
          <IconButton
            title={speed > 1 ? "Animations: fast" : "Animations: cinematic"}
            active={speed > 1}
            onClick={() => {
              const next = speed > 1 ? 1 : 1.8;
              setSpeed(next);
              window.localStorage.setItem("chess3d:fast", next > 1 ? "1" : "0");
            }}
          >
            ⚡
          </IconButton>
          <IconButton
            title={muted ? "Sound off" : "Sound on"}
            active={!muted}
            onClick={() => {
              setMuted(!muted);
              setMutedState(!muted);
              if (muted) playSfx("select");
            }}
          >
            {muted ? "🔇" : "🔊"}
          </IconButton>
        </div>
      </div>

      {/* player cards */}
      <div className="pointer-events-none absolute left-3 top-16 flex flex-col gap-2">
        <PlayerCard
          color={topColor}
          name={nameOf(topColor)}
          active={active && turn === topColor}
          captured={capturedOf(topColor)}
          advantage={advOf(topColor)}
          you={you === topColor}
          thinking={!!solo?.thinking && turn === topColor}
        />
      </div>
      <div className="pointer-events-none absolute bottom-24 left-3 lg:bottom-4">
        <PlayerCard
          color={bottomColor}
          name={nameOf(bottomColor)}
          active={active && turn === bottomColor}
          captured={capturedOf(bottomColor)}
          advantage={advOf(bottomColor)}
          you={you === bottomColor}
        />
      </div>

      {/* status pill */}
      <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center lg:top-3">
        <div
          className={`rounded-full border px-5 py-2 text-sm font-semibold backdrop-blur ${
            active && chess.inCheck()
              ? "border-red-400/60 bg-red-950/70 text-red-100"
              : canMove
                ? "border-emerald-300/50 bg-emerald-950/60 text-emerald-100"
                : "border-white/10 bg-slate-900/70 text-slate-200"
          }`}
        >
          {status}
        </div>
      </div>

      {/* side panel */}
      <aside className="pointer-events-auto absolute bottom-3 right-3 top-16 hidden w-72 flex-col gap-3 lg:flex">
        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur">
          <div className="border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Moves
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-sm">
            {pairs.length === 0 && <p className="px-1 py-4 text-center text-slate-500">No moves yet — white opens.</p>}
            {pairs.map((p) => (
              <div key={p.n} className="grid grid-cols-[2rem_1fr_1fr] gap-1 rounded px-1 py-0.5 odd:bg-white/[0.03]">
                <span className="text-slate-500">{p.n}.</span>
                <span className="text-slate-100">{p.w}</span>
                <span className="text-slate-100">{p.b ?? ""}</span>
              </div>
            ))}
            <div ref={movesEnd} />
          </div>
        </div>
        <Actions
          seated={seated}
          active={active}
          mode={mode}
          opponentOffered={!!opponentOffered}
          iOffered={!!iOffered}
          confirmResign={confirmResign}
          setConfirmResign={setConfirmResign}
          act={act}
          solo={solo}
        />
      </aside>

      {/* mobile action bar */}
      <div className="pointer-events-auto absolute inset-x-3 bottom-3 lg:hidden">
        <Actions
          seated={seated}
          active={active}
          mode={mode}
          opponentOffered={!!opponentOffered}
          iOffered={!!iOffered}
          confirmResign={confirmResign}
          setConfirmResign={setConfirmResign}
          act={act}
          solo={solo}
          compact
          lastSan={game.moves[game.moves.length - 1]}
        />
      </div>

      {/* promotion picker */}
      {promo && (
        <div className="absolute inset-0 grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]">
          <div className="rounded-3xl border border-amber-200/20 bg-slate-950/90 p-6 text-center shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Promote your footman</h3>
            <div className="mt-4 grid grid-cols-4 gap-3">
              {PROMO.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    const p = promo;
                    setPromo(null);
                    void move(p.from, p.to, t);
                  }}
                  className="group flex w-20 flex-col items-center gap-1 rounded-2xl border border-white/10 bg-slate-900 px-2 py-3 transition hover:-translate-y-1 hover:border-amber-300/60 hover:bg-slate-800"
                >
                  <span className="text-4xl text-amber-100">{PIECE_GLYPH[turn][t]}</span>
                  <span className="text-xs text-slate-400 group-hover:text-amber-200">{PROMO_NAME[t]}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setPromo(null)} className="mt-4 text-sm text-slate-400 hover:text-white">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* result */}
      {game.result && showResult && (
        <div className="absolute inset-0 grid place-items-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-amber-200/20 bg-slate-950/90 p-8 text-center shadow-2xl">
            <div className="text-6xl">
              {game.result.winner === "draw" ? "🤝" : seated && game.result.winner !== you ? "🏳️" : "👑"}
            </div>
            <h2 className="mt-3 text-3xl font-bold text-amber-200">{resultText(game).title}</h2>
            <p className="mt-1 text-slate-300">{resultText(game).sub}</p>
            <div className="mt-6 flex flex-col gap-2">
              {(seated || mode === "local") && (
                <button
                  onClick={() => void act("rematch")}
                  disabled={!!game.rematchId}
                  className="rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-900 transition hover:bg-amber-300 disabled:opacity-60"
                >
                  {game.rematchId
                    ? "Starting rematch…"
                    : mode === "local"
                      ? "Play again"
                      : mode === "solo"
                        ? "Play again (swap colours)"
                        : "Rematch (swap colours)"}
                </button>
              )}
              {mode === "solo" && solo && (
                <button
                  onClick={solo.newGame}
                  className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 font-medium hover:bg-slate-800"
                >
                  Change difficulty
                </button>
              )}
              <button
                onClick={() => setShowResult(false)}
                className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 font-medium hover:bg-slate-800"
              >
                Review the board
              </button>
              <button onClick={onExit} className="rounded-xl px-4 py-2 text-sm text-slate-400 hover:text-white">
                Back to the lounge
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center lg:bottom-6">
          <div className="rounded-xl border border-red-300/30 bg-red-950/85 px-4 py-2 text-sm text-red-100 backdrop-blur">{toast}</div>
        </div>
      )}
    </div>
  );
}

function Actions({
  seated,
  active,
  mode,
  opponentOffered,
  iOffered,
  confirmResign,
  setConfirmResign,
  act,
  solo,
  compact,
  lastSan,
}: {
  seated: boolean;
  active: boolean;
  mode: "local" | "solo";
  opponentOffered: boolean;
  iOffered: boolean;
  confirmResign: boolean;
  setConfirmResign: (v: boolean) => void;
  act: GameController["act"];
  solo?: SoloInfo;
  compact?: boolean;
  lastSan?: string;
}) {
  const canAct = active && (seated || mode === "local");
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-900/75 p-3 backdrop-blur">
      {opponentOffered && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
          <span>Opponent offers a draw</span>
          <span className="flex gap-1">
            <button onClick={() => void act("accept_draw")} className="rounded-lg bg-emerald-500 px-2.5 py-1 font-semibold text-slate-900 hover:bg-emerald-400">
              Accept
            </button>
            <button onClick={() => void act("decline_draw")} className="rounded-lg bg-slate-700 px-2.5 py-1 hover:bg-slate-600">
              Decline
            </button>
          </span>
        </div>
      )}
      {compact && lastSan && <div className="text-center font-mono text-xs text-slate-400">Last move: {lastSan}</div>}
      <div className={`grid gap-2 ${solo ? "grid-cols-3" : "grid-cols-2"}`}>
        {solo && (
          <button
            disabled={!active || !solo.canUndo}
            onClick={solo.undo}
            title="Take back your last move"
            className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm font-medium transition hover:bg-slate-700 disabled:opacity-40"
          >
            ↶ Undo
          </button>
        )}
        <button
          disabled={!canAct || iOffered || opponentOffered || !!solo?.thinking}
          onClick={() => void act("offer_draw")}
          className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm font-medium transition hover:bg-slate-700 disabled:opacity-40"
        >
          {iOffered ? "Draw offered…" : mode === "local" ? "Agree draw" : solo ? "Draw" : "Offer draw"}
        </button>
        {confirmResign ? (
          <button
            onClick={() => {
              setConfirmResign(false);
              void act("resign");
            }}
            className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
          >
            {solo ? "Sure?" : "Confirm resign"}
          </button>
        ) : (
          <button
            disabled={!canAct}
            onClick={() => setConfirmResign(true)}
            className="rounded-xl border border-red-400/30 bg-red-950/50 px-3 py-2 text-sm font-medium text-red-200 transition hover:bg-red-900/60 disabled:opacity-40"
          >
            Resign
          </button>
        )}
      </div>
    </div>
  );
}
