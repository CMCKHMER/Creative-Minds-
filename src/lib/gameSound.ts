// Sound effects for the Learning Games page — synthesized via the Web Audio
// API (no external sound files needed, works offline, ~2KB total).
//
// Three sounds:
//   - correct:   a bright 2-note ascending chime (C5 → E5)
//   - wrong:     a short low buzz (A2, sawtooth, 180ms)
//   - complete:  a 4-note victory fanfare (C5 → E5 → G5 → C6)
//
// Respects the user's 'prefers-reduced-motion' setting (silences all sounds
// if the user has that preference enabled). Also respects a manual mute
// toggle stored in localStorage as 'cmc-game-sound'.
//
// All sounds are non-blocking — they fire and forget. If the audio context
// is suspended (Chrome's autoplay policy requires a user gesture), the
// first sound call will resume it.

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioCtx) return audioCtx;
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
    return audioCtx;
  } catch {
    return null;
  }
}

function isMuted(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    return localStorage.getItem('cmc-game-sound') === 'off';
  } catch {
    return false;
  }
}

function tone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  type: OscillatorType = 'sine',
  gain: number = 0.15,
): void {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  // Envelope: quick attack, exponential decay
  g.gain.setValueAtTime(0, startTime);
  g.gain.linearRampToValueAtTime(gain, startTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

/** Play a bright ascending 2-note chime when the user answers correctly. */
export function playCorrectSound(): void {
  if (isMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const now = ctx.currentTime;
  // C5 (523.25 Hz) → E5 (659.25 Hz), 120ms each
  tone(ctx, 523.25, now, 0.12, 'sine', 0.15);
  tone(ctx, 659.25, now + 0.08, 0.16, 'sine', 0.12);
}

/** Play a short low buzz when the user answers incorrectly. */
export function playWrongSound(): void {
  if (isMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const now = ctx.currentTime;
  // A2 (110 Hz), sawtooth, 180ms — slightly dissonant for "wrong"
  tone(ctx, 110, now, 0.18, 'sawtooth', 0.08);
  tone(ctx, 116.54, now, 0.18, 'sawtooth', 0.04);
}

/** Play a 4-note victory fanfare when the user completes a game. */
export function playCompleteSound(): void {
  if (isMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const now = ctx.currentTime;
  // C5 → E5 → G5 → C6, 150ms each, with a slight overlap
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    tone(ctx, freq, now + i * 0.12, 0.2, 'sine', 0.14);
    // Add a harmonic an octave up at lower gain for richness
    tone(ctx, freq * 2, now + i * 0.12, 0.15, 'triangle', 0.04);
  });
}

/** Toggle the mute state and return the new state (true = muted). */
export function toggleGameSound(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const current = localStorage.getItem('cmc-game-sound') === 'off';
    const next = current ? 'on' : 'off';
    localStorage.setItem('cmc-game-sound', next);
    return next === 'off';
  } catch {
    return false;
  }
}

/** Check if sounds are currently muted. */
export function isGameSoundMuted(): boolean {
  return isMuted();
}
