import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Game, W, H, type Phase } from "./engine";
import {
  addScore,
  loadScores,
  qualifies,
  loadLastName,
  saveLastName,
  type ScoreEntry,
} from "./highscores";
import { MILESTONE_STAGES, milestonePct } from "./scoring";
import { submitScore } from "../../lib/submitScore";
import type { BrainGameProps } from "../registry";
import "./brickforge.css";

/**
 * BrickForge — Brain Lounge cartridge.
 * Ported from the author's standalone Vite build: canvas brick-breaker with
 * combos, power-ups, a Hall of Smiths (localStorage, kept as-built) and a
 * synthesized WebAudio soundtrack. The only changes from the original App
 * are the lounge exit button, stage-aware canvas sizing, and the run-over
 * submission to the shared CMC scoreboard.
 */

const TOPBAR = 48;
// Chrome around the canvas inside the lounge stage (sticky lounge navbar,
// stage header, panel paddings) — keeps the whole viewport on screen
// without scrolling on typical laptops.
const STAGE_CHROME = 210;

export default function BrickForge({ onExit }: BrainGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [phase, setPhase] = useState<Phase>("start");
  const [size, setSize] = useState({ w: W, h: H });
  const [muted, setMuted] = useState(false);
  const [scores, setScores] = useState<ScoreEntry[]>(() => loadScores());
  const [tick, setTick] = useState(0);

  // Create the engine once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const instance = new Game(canvas);
    setMuted(instance.sfx.muted);
    instance.onPhase = (p) => {
      setPhase(p);
      setTick((t) => t + 1);
      if (p === "gameover") {
        // Shared scoreboard: levels cleared of 10 milestone stages.
        // submitScore is a silent no-op for guests — anonymous play is fine.
        void submitScore({
          drillSlug: "brickforge",
          drillTitle: "BrickForge · Brain Lounge",
          drillSource: "brain-lounge",
          scorePct: milestonePct(instance.level),
          correctCount: Math.min(instance.level, MILESTONE_STAGES),
          totalCount: MILESTONE_STAGES,
        });
      }
    };
    setGame(instance); // state, not a ref read during render
    return () => {
      instance.destroy();
    };
  }, []);

  // Responsive sizing inside the lounge stage
  useLayoutEffect(() => {
    const compute = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Lounge shelf px-5/sm:px-8 + stage panel p-5/sm:p-8 + borders.
      const availW = Math.min(vw - 96, 620);
      const availH = Math.max(vh - STAGE_CHROME, 340);
      const scale = Math.min(availW / W, availH / H);
      const w = Math.floor(W * scale);
      const h = Math.floor(H * scale);
      setSize({ w, h });
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
    };
  }, []);

  useEffect(() => {
    game?.resize(size.w, size.h);
  }, [game, size]);

  const start = useCallback(() => {
    game?.sfx.select();
    game?.start();
  }, [game]);

  const toggleMute = () => {
    if (!game) return;
    game.sfx.unlock();
    setMuted(game.toggleMute());
  };

  return (
    <div className="brickforge-root mx-auto flex w-full flex-col items-center overflow-hidden rounded-2xl forge-bg text-white select-none">
      {/* Top bar */}
      <header
        className="flex w-full items-center justify-between gap-2 px-3"
        style={{ height: TOPBAR, maxWidth: size.w + 24 }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-white/50 transition hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Lounge shelf
          </button>
          <span className="hidden sm:inline" aria-hidden="true">⚒️</span>
          <span className="hidden text-sm font-bold tracking-[0.2em] text-orange-300 sm:inline">BRICKFORGE</span>
        </div>
        <div className="flex items-center gap-2">
          <IconButton onClick={toggleMute} label={muted ? "Unmute (M)" : "Mute (M)"}>
            {muted ? "🔇" : "🔊"}
          </IconButton>
          {(phase === "playing" || phase === "paused") && (
            <IconButton onClick={() => game?.togglePause()} label="Pause (P)">
              {phase === "paused" ? "▶" : "❚❚"}
            </IconButton>
          )}
        </div>
      </header>

      {/* Game viewport */}
      <div
        className="relative mx-auto overflow-hidden rounded-xl shadow-[0_0_60px_-10px_rgba(255,120,40,0.45)] ring-1 ring-orange-500/30"
        style={{ width: size.w, height: size.h }}
      >
        <canvas
          ref={canvasRef}
          className="block"
          style={{ touchAction: "none", width: size.w, height: size.h }}
        />

        {phase === "start" && <StartOverlay onStart={start} scores={scores} />}
        {phase === "paused" && (
          <PauseOverlay
            onResume={() => game?.resume()}
            onRestart={() => game?.start()}
            onQuit={() => game?.quitToMenu()}
          />
        )}
        {phase === "gameover" && game && (
          <GameOverOverlay
            key={tick}
            game={game}
            onRestart={start}
            onScoresChanged={() => setScores(loadScores())}
          />
        )}
      </div>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.currentTarget.blur();
        onClick();
      }}
      className="h-9 min-w-9 cursor-pointer rounded-lg bg-white/5 text-sm ring-1 ring-white/10 transition hover:bg-white/10 active:scale-95"
    >
      {children}
    </button>
  );
}

function Overlay({
  children,
  dim = true,
  onBackdrop,
}: {
  children: ReactNode;
  dim?: boolean;
  onBackdrop?: () => void;
}) {
  return (
    <div
      onClick={(e) => {
        if (onBackdrop && e.target === e.currentTarget) onBackdrop();
      }}
      className={`overlay-in absolute inset-0 flex flex-col items-center justify-center overflow-y-auto p-5 text-center ${dim ? "bg-black/70 backdrop-blur-[3px]" : ""}`}
    >
      {children}
    </div>
  );
}

function PrimaryButton({ children, onClick, autoFocus }: { children: ReactNode; onClick: () => void; autoFocus?: boolean }) {
  return (
    <button
      type="button"
      autoFocus={autoFocus}
      onClick={onClick}
      className="btn-forge cursor-pointer rounded-xl px-8 py-3 text-base font-bold tracking-[0.15em] text-black transition-transform active:scale-95"
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-xl bg-white/5 px-6 py-2.5 text-sm font-semibold tracking-[0.12em] ring-1 ring-white/15 transition hover:bg-white/10 active:scale-95"
    >
      {children}
    </button>
  );
}

function ScoreTable({ scores, highlight, compact }: { scores: ScoreEntry[]; highlight?: number; compact?: boolean }) {
  const list = compact ? scores.slice(0, 5) : scores;
  if (list.length === 0) {
    return <p className="mt-2 text-xs tracking-wider text-white/40">NO RECORDS YET — BE THE FIRST SMITH</p>;
  }
  return (
    <table className="mt-2 w-full max-w-[300px] text-sm">
      <tbody>
        {list.map((s, i) => (
          <tr
            key={`${s.date}-${i}`}
            className={`${highlight === i + 1 ? "row-glow font-bold text-orange-300" : "text-white/80"}`}
          >
            <td className="w-6 py-1 pr-2 text-right text-white/40">{i + 1}</td>
            <td className="max-w-[120px] truncate py-1 text-left tracking-wider">{s.name}</td>
            <td className="py-1 text-xs text-white/40">L{s.level}</td>
            <td className="py-1 text-right tabular-nums">{s.score.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StartOverlay({ onStart, scores }: { onStart: () => void; scores: ScoreEntry[] }) {
  const [showScores, setShowScores] = useState(false);
  return (
    <Overlay onBackdrop={onStart}>
      <div className="mb-1 text-[10px] tracking-[0.5em] text-orange-300/70">CREATIVE MINDS EDITION</div>
      <h1 className="title-glow text-5xl font-bold leading-none tracking-tight sm:text-6xl">
        BRICK<span className="text-orange-400">FORGE</span>
      </h1>
      <p className="mt-3 max-w-[300px] text-sm text-white/60">
        Smash the wall, chain combos, catch power-ups. Don&apos;t let the ember drop.
      </p>

      <div className="mt-6">
        <PrimaryButton onClick={onStart} autoFocus>
          START FORGING
        </PrimaryButton>
      </div>
      <p className="mt-3 text-[11px] tracking-wider text-white/40">PRESS SPACE OR TAP</p>

      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] tracking-wider text-white/50">
        <span className="text-right">← → / A D</span>
        <span className="text-left text-white/80">MOVE</span>
        <span className="text-right">MOUSE / DRAG</span>
        <span className="text-left text-white/80">MOVE</span>
        <span className="text-right">SPACE / TAP</span>
        <span className="text-left text-white/80">LAUNCH</span>
        <span className="text-right">P / ESC</span>
        <span className="text-left text-white/80">PAUSE</span>
      </div>

      <button
        type="button"
        onClick={() => setShowScores((s) => !s)}
        className="mt-5 cursor-pointer text-xs tracking-[0.2em] text-orange-300/80 transition hover:text-orange-200"
      >
        {showScores ? "HIDE" : "HALL OF SMITHS"} {showScores ? "▲" : "▼"}
      </button>
      {showScores && <ScoreTable scores={scores} compact />}
    </Overlay>
  );
}

function PauseOverlay({ onResume, onRestart, onQuit }: { onResume: () => void; onRestart: () => void; onQuit: () => void }) {
  return (
    <Overlay>
      <h2 className="text-4xl font-bold tracking-[0.2em] text-orange-300">PAUSED</h2>
      <p className="mt-1 text-xs tracking-wider text-white/50">THE FORGE COOLS…</p>
      <div className="mt-6 flex w-48 flex-col gap-3">
        <PrimaryButton onClick={onResume} autoFocus>
          RESUME
        </PrimaryButton>
        <GhostButton onClick={onRestart}>RESTART</GhostButton>
        <GhostButton onClick={onQuit}>MAIN MENU</GhostButton>
      </div>
      <p className="mt-4 text-[11px] tracking-wider text-white/40">P / ESC / SPACE TO RESUME</p>
    </Overlay>
  );
}

function GameOverOverlay({
  game,
  onRestart,
  onScoresChanged,
}: {
  game: Game;
  onRestart: () => void;
  onScoresChanged: () => void;
}) {
  const score = game.score;
  const [canSave] = useState(() => qualifies(score));
  const [saved, setSaved] = useState(false);
  const [rank, setRank] = useState<number | undefined>(undefined);
  const [name, setName] = useState(() => loadLastName());
  const [scores, setScores] = useState<ScoreEntry[]>(() => loadScores());
  const inputRef = useRef<HTMLInputElement>(null);

  const save = useCallback(() => {
    const n = (name.trim() || "SMITH").toUpperCase().slice(0, 12);
    saveLastName(n);
    const r = addScore({ name: n, score, level: game.level, date: Date.now() });
    setRank(r);
    setScores(loadScores());
    setSaved(true);
    onScoresChanged();
    game.sfx.select();
  }, [name, score, game, onScoresChanged]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT") return; // the form handles Enter
      if (tag === "BUTTON" && (e.key === "Enter" || e.key === " ")) return; // native click
      if (e.key === "Enter" || e.key === " " || e.key === "r" || e.key === "R") {
        e.preventDefault();
        if (canSave && !saved) save();
        else onRestart();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canSave, saved, save, onRestart]);

  useEffect(() => {
    if (canSave && !saved) inputRef.current?.focus();
  }, [canSave, saved]);

  const showForm = canSave && !saved;

  return (
    <Overlay>
      <div className="text-[10px] tracking-[0.5em] text-red-300/70">THE EMBER FADED</div>
      <h2 className="title-glow-red text-4xl font-bold tracking-[0.15em] text-red-400">GAME OVER</h2>

      <div className="mt-4 text-[11px] tracking-[0.3em] text-white/50">FINAL SCORE</div>
      <div className="text-5xl font-bold leading-tight tabular-nums text-orange-300">{score.toLocaleString()}</div>

      <div className="mt-3 flex gap-5 text-xs tracking-wider text-white/60">
        <span>
          LEVEL <b className="text-white">{game.level}</b>
        </span>
        <span>
          BRICKS <b className="text-white">{game.bricksBroken}</b>
        </span>
        <span>
          MAX COMBO <b className="text-white">×{game.maxCombo}</b>
        </span>
      </div>

      {showForm ? (
        <form
          className="mt-5 flex flex-col items-center gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="new-record text-sm font-bold tracking-[0.2em] text-orange-300">★ NEW HIGH SCORE ★</div>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value.toUpperCase().slice(0, 12))}
            placeholder="YOUR NAME"
            maxLength={12}
            autoComplete="off"
            className="w-56 rounded-lg bg-black/50 px-3 py-2 text-center font-bold tracking-[0.2em] text-white outline-none ring-1 ring-orange-400/50 placeholder:text-white/30 focus:ring-orange-300"
          />
          <PrimaryButton onClick={save}>SAVE RECORD</PrimaryButton>
          <button
            type="button"
            onClick={onRestart}
            className="cursor-pointer text-[11px] tracking-wider text-white/40 transition hover:text-white/70"
          >
            SKIP &amp; PLAY AGAIN
          </button>
        </form>
      ) : (
        <>
          <div className="mt-4 text-[10px] tracking-[0.3em] text-white/40">HALL OF SMITHS</div>
          <ScoreTable scores={scores} highlight={rank} compact />
          <div className="mt-5">
            <PrimaryButton onClick={onRestart} autoFocus>
              PLAY AGAIN
            </PrimaryButton>
          </div>
          <p className="mt-2 text-[11px] tracking-wider text-white/40">ENTER / R / SPACE TO RESTART</p>
          <button
            type="button"
            onClick={() => game.quitToMenu()}
            className="mt-2 cursor-pointer text-[11px] tracking-wider text-white/40 transition hover:text-white/70"
          >
            MAIN MENU
          </button>
        </>
      )}
    </Overlay>
  );
}
