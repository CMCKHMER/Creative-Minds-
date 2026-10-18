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

/* ===== Visual effects — confetti burst (for game completion) ===== */

/**
 * Fire a confetti burst from the center-top of the viewport. Uses DOM
 * elements with CSS animations (no canvas needed). Each piece is a
 * small colored div that falls + rotates, then auto-removes after 3s.
 *
 * Call this from a game's "complete" handler for a satisfying payoff.
 */
export function fireConfetti(count: number = 80): void {
  if (typeof document === 'undefined') return;
  ensureConfettiCSS();
  const colors = ['#10b981', '#d29922', '#39d2c0', '#c084fc', '#f85149', '#ffcc33', '#00f0ff', '#fbbf24'];
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.style.cssText = [
      'position:fixed', 'top:0',
      `left:${Math.random() * 100}%`,
      `width:${6 + Math.random() * 8}px`,
      `height:${6 + Math.random() * 8}px`,
      `background:${colors[Math.floor(Math.random() * colors.length)]}`,
      'border-radius:2px', 'z-index:99998', 'pointer-events:none',
      `animation:cmc-confetti-fall ${1.5 + Math.random() * 1.5}s ease-in forwards`,
      `animation-delay:${Math.random() * 0.3}s`,
      `transform:rotate(${Math.random() * 360}deg)`,
    ].join(';');
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 3000);
  }
}

let confettiCSSInjected = false;
export function ensureConfettiCSS(): void {
  if (confettiCSSInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes cmc-confetti-fall {
      0% { transform: translateY(0) rotate(0deg); opacity: 1; }
      100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
  confettiCSSInjected = true;
}
