import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Play, RotateCcw, Volume2, VolumeX, Zap } from 'lucide-react';
import type { BrainGameProps } from '../registry';
import {
  PAD_THEMES,
  TOTAL_STAGES,
  BEST_STORAGE_KEY,
  flashMs,
  growSequence,
  newSequence,
  playbackMs,
  readBest,
  scorePct,
  writeBest,
} from './logic';
import { ensureConfettiCSS, fireConfetti, isGameSoundMuted, playCompleteSound, playWrongSound, toggleGameSound } from '../../lib/gameSound';
import { submitScore } from '../../lib/submitScore';

type Phase = 'idle' | 'watching' | 'your-turn' | 'game-over';

/**
 * Neon Sequence — sample Brain Lounge cartridge.
 * Simon-style memory game: watch the pads, repeat the pattern.
 * Exists to demonstrate the cartridge plug-in format — copy this file's
 * structure for new React games (see src/games/registry.ts header).
 */
export default function NeonSequence({ onExit }: BrainGameProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [sequence, setSequence] = useState<number[]>([]);
  const [activePad, setActivePad] = useState<number | null>(null);
  const [inputIndex, setInputIndex] = useState(0);
  const [best, setBest] = useState(0);
  const [soundMuted, setSoundMuted] = useState(false);
  const [runsPlayed, setRunsPlayed] = useState(0);

  // Timers for the watch-phase playback — cleared on unmount / new run.
  const timersRef = useRef<number[]>([]);
  const padResetTimerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sequenceRef = useRef<number[]>([]);
  const inputIndexRef = useRef(0);
  const bestRef = useRef(0);
  const newBestRef = useRef(false);
  const phaseRef = useRef<Phase>('idle');

  useEffect(() => {
    setBest(readBest());
    setSoundMuted(isGameSoundMuted());
    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      if (padResetTimerRef.current) window.clearTimeout(padResetTimerRef.current);
      void audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  const setPhaseSynced = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  /** Short synthesized tone for a pad — no audio assets needed. */
  const beep = useCallback((pad: number, durationMs = 260) => {
    if (isGameSoundMuted()) return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      void ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = PAD_THEMES[pad]?.toneHz ?? 330;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch {
      /* audio unavailable — the game is fully playable silently */
    }
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    if (padResetTimerRef.current) window.clearTimeout(padResetTimerRef.current);
  }, []);

  /** Play the current sequence, then hand over to the player. */
  const playSequence = useCallback((seq: number[]) => {
    clearTimers();
    setPhaseSynced('watching');
    setActivePad(null);
    const flash = flashMs(seq.length);
    seq.forEach((pad, i) => {
      timersRef.current.push(window.setTimeout(() => {
        setActivePad(pad);
        beep(pad, flash * 0.55);
      }, i * flash));
      timersRef.current.push(window.setTimeout(() => setActivePad(null), i * flash + flash * 0.6));
    });
    timersRef.current.push(window.setTimeout(() => {
      inputIndexRef.current = 0;
      setInputIndex(0);
      setPhaseSynced('your-turn');
    }, playbackMs(seq.length)));
  }, [beep, clearTimers, setPhaseSynced]);

  const startRun = useCallback(() => {
    clearTimers();
    newBestRef.current = false;
    setRunsPlayed((runs) => runs + 1);
    const seq = newSequence();
    sequenceRef.current = seq;
    setSequence(seq);
    playSequence(seq);
  }, [clearTimers, playSequence]);

  const endRun = useCallback((clearedLevels: number) => {
    setPhaseSynced('game-over');
    playWrongSound();
    if (newBestRef.current && clearedLevels > 0) {
      playCompleteSound();
      ensureConfettiCSS();
      fireConfetti(70);
    }
    // Scoreboard: signed-in players land on the drill_attempts board.
    // submitScore is a silent no-op for guests — anonymous play is fine.
    void submitScore({
      drillSlug: 'neon-sequence',
      drillTitle: 'Neon Sequence · Brain Lounge',
      drillSource: 'brain-lounge',
      scorePct: scorePct(clearedLevels),
      correctCount: clearedLevels,
      totalCount: TOTAL_STAGES,
    });
  }, [setPhaseSynced]);

  /** Player tapped a pad during their turn. */
  const tapPad = useCallback((pad: number) => {
    if (phaseRef.current !== 'your-turn') return;
    beep(pad, 180);
    setActivePad(pad);
    if (padResetTimerRef.current) window.clearTimeout(padResetTimerRef.current);
    padResetTimerRef.current = window.setTimeout(() => setActivePad(null), 170);

    const seq = sequenceRef.current;
    const idx = inputIndexRef.current;
    if (seq[idx] !== pad) {
      endRun(seq.length - 1); // cleared everything up to the previous level
      return;
    }
    if (idx + 1 === seq.length) {
      // Level cleared → grow the pattern and play the next round.
      const cleared = seq.length;
      if (cleared > bestRef.current) {
        bestRef.current = cleared;
        newBestRef.current = true;
        writeBest(cleared);
        setBest(cleared);
      }
      const next = growSequence(seq);
      sequenceRef.current = next;
      setSequence(next);
      timersRef.current.push(window.setTimeout(() => playSequence(next), 620));
      setPhaseSynced('watching'); // freeze input during the hand-over gap
      inputIndexRef.current = -1; // ignore taps until playback hands back
    } else {
      inputIndexRef.current = idx + 1;
      setInputIndex(idx + 1);
    }
  }, [beep, endRun, playSequence, setPhaseSynced]);

  // Keyboard play: 1–4 map to the four pads.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phaseRef.current !== 'your-turn') return;
      const idx = ['1', '2', '3', '4'].indexOf(e.key);
      if (idx >= 0) tapPad(idx);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tapPad]);

  const level = sequence.length;
  const statusText = phase === 'watching'
    ? 'Watch closely…'
    : phase === 'your-turn'
      ? `Your turn — pad ${Math.min(inputIndex + 1, level)} of ${level}`
      : phase === 'game-over'
        ? `Run over — ${sequence.length - 1} ${sequence.length - 1 === 1 ? 'level' : 'levels'} cleared. Start again to beat it!`
        : 'Press start, watch the pattern, repeat it. One wrong tap ends the run.';

  return (
    <div className="mx-auto max-w-lg">
      {/* Game header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-4">
        <button type="button" onClick={onExit} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Lounge shelf
        </button>
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className="rounded-lg border border-fuchsia-300/25 bg-fuchsia-300/10 px-2.5 py-1.5 text-fuchsia-200">LEVEL {Math.max(1, level)}</span>
          <span className="rounded-lg border border-amber-200/25 bg-amber-200/10 px-2.5 py-1.5 text-amber-200" title={`Stored in ${BEST_STORAGE_KEY}`}>BEST {best}</span>
          <button type="button" onClick={() => setSoundMuted(toggleGameSound())} aria-label={soundMuted ? 'Unmute game sounds' : 'Mute game sounds'} className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:bg-white/5 hover:text-white">
            {soundMuted ? <VolumeX className="h-3.5 w-3.5" aria-hidden="true" /> : <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Status line */}
      <p role="status" aria-live="polite" className="mt-4 text-center text-xs font-semibold text-slate-300">{statusText}</p>

      {/* The four pads */}
      <div className="mt-5 grid grid-cols-2 gap-3" aria-label="Neon Sequence pads">
        {PAD_THEMES.map((theme, pad) => {
          const lit = activePad === pad;
          const interactive = phase === 'your-turn';
          return (
            <button
              key={theme.label}
              type="button"
              aria-label={`${theme.label}${interactive ? '' : ' (locked while the pattern plays)'}`}
              disabled={!interactive}
              onClick={() => tapPad(pad)}
              className={`aspect-square rounded-2xl border-2 transition-all duration-100 outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${lit ? theme.lit : theme.rest} ${interactive ? 'cursor-pointer hover:brightness-125 active:scale-[0.97]' : 'cursor-default opacity-80'} ${phase === 'game-over' && lit ? 'animate-pulse' : ''}`}
            />
          );
        })}
      </div>

      {/* Controls */}
      <div className="mt-6 flex flex-col items-center gap-3">
        {phase === 'idle' && (
          <button type="button" onClick={startRun} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-300 to-cyan-300 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-fuchsia-500/20 transition hover:brightness-110 active:scale-95">
            <Play className="h-4 w-4" aria-hidden="true" /> Start run
          </button>
        )}
        {phase === 'game-over' && (
          <button type="button" onClick={startRun} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-300 to-cyan-300 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-fuchsia-500/20 transition hover:brightness-110 active:scale-95">
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Play again
          </button>
        )}
        <p className="text-center text-[10px] leading-relaxed text-slate-500">
          <Zap className="mr-1 inline h-3 w-3 text-amber-300" aria-hidden="true" />
          Mouse, touch or keys 1–4 · {TOTAL_STAGES} stages to clear · personal best saved in this browser
          {runsPlayed > 0 && <span> · {runsPlayed} {runsPlayed === 1 ? 'run' : 'runs'} this visit</span>}
        </p>
      </div>
    </div>
  );
}
