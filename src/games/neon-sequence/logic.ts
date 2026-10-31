/**
 * Neon Sequence — pure game logic (no DOM, unit-testable).
 *
 * Classic "repeat the growing pattern" play:
 *   level 1 shows 1 pad → player repeats it
 *   level 2 shows 2 pads → …
 * A run ends on the first wrong tap. Score = levels CLEARED.
 */

/** The four Simon-style pads, in play order. */
export const PAD_COUNT = 4;

export interface PadTheme {
  /** Tailwind classes for the resting pad. */
  rest: string;
  /** Tailwind classes while the pad is lit. */
  lit: string;
  /** WebAudio oscillator frequency for the pad's tone (Hz). */
  toneHz: number;
  /** Accessible name. */
  label: string;
}

export const PAD_THEMES: PadTheme[] = [
  { rest: 'bg-cyan-500/15 border-cyan-300/30', lit: 'bg-cyan-300 border-cyan-100 shadow-[0_0_36px_rgba(103,232,249,0.65)]', toneHz: 261.6, label: 'Cyan pad' },
  { rest: 'bg-fuchsia-500/15 border-fuchsia-300/30', lit: 'bg-fuchsia-300 border-fuchsia-100 shadow-[0_0_36px_rgba(240,171,252,0.65)]', toneHz: 329.6, label: 'Fuchsia pad' },
  { rest: 'bg-amber-500/15 border-amber-300/30', lit: 'bg-amber-300 border-amber-100 shadow-[0_0_36px_rgba(252,211,77,0.65)]', toneHz: 392.0, label: 'Amber pad' },
  { rest: 'bg-emerald-500/15 border-emerald-300/30', lit: 'bg-emerald-300 border-emerald-100 shadow-[0_0_36px_rgba(110,231,183,0.65)]', toneHz: 523.3, label: 'Emerald pad' },
];

/** Pick the next pad from an injectable RNG (defaults to Math.random). */
export function pickPad(rng: () => number = Math.random): number {
  return Math.min(PAD_COUNT - 1, Math.max(0, Math.floor(rng() * PAD_COUNT)));
}

/** Append one random pad. Returns a NEW array — the sequence is immutable. */
export function growSequence(sequence: number[], rng: () => number = Math.random): number[] {
  return [...sequence, pickPad(rng)];
}

/** Fresh run: a one-pad sequence. */
export function newSequence(rng: () => number = Math.random): number[] {
  return growSequence([], rng);
}

/** Total watch-flash duration (ms) for a level's playback. */
export function playbackMs(sequenceLength: number): number {
  return sequenceLength * flashMs(sequenceLength);
}

/** Per-pad flash window (ms). Shrinks with level, clamped for playability. */
export function flashMs(sequenceLength: number): number {
  return Math.max(220, 640 - (sequenceLength - 1) * 55);
}

/** Levels cleared → percent for the drill_attempts scoreboard (cap 100). */
export function scorePct(levelsCleared: number): number {
  return Math.min(100, Math.max(0, levelsCleared * 10));
}

/** Arcade "stage" total used as totalCount on the scoreboard (10 stages). */
export const TOTAL_STAGES = 10;

/** Local-storage key for the personal best (levels cleared). */
export const BEST_STORAGE_KEY = 'cmc-brain-lounge-neon-sequence-best';

export function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_STORAGE_KEY) || '0') || 0;
  } catch {
    return 0;
  }
}

export function writeBest(levelsCleared: number): void {
  try {
    localStorage.setItem(BEST_STORAGE_KEY, String(levelsCleared));
  } catch {
    /* private mode — best just won't persist */
  }
}
