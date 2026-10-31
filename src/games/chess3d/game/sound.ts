
export type SfxKind = "move" | "capture" | "swing" | "check" | "castle" | "promote" | "mate" | "select" | "end" | "start";

let ctx: AudioContext | null = null;
let muted = false;
let noiseBuf: AudioBuffer | null = null;

if (typeof window !== "undefined") {
  muted = window.localStorage.getItem("chess3d:muted") === "1";
}

export function isMuted() {
  return muted;
}

export function setMuted(v: boolean) {
  muted = v;
  if (typeof window !== "undefined") window.localStorage.setItem("chess3d:muted", v ? "1" : "0");
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noise(c: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function tone(c: AudioContext, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) {
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function hiss(c: AudioContext, dur: number, vol: number, f0: number, f1: number, delay = 0, q = 1) {
  const t = c.currentTime + delay;
  const s = c.createBufferSource();
  s.buffer = noise(c);
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(c.destination);
  s.start(t);
  s.stop(t + dur + 0.05);
}

export function playSfx(kind: SfxKind) {
  if (muted) return;
  const c = audio();
  if (!c) return;
  switch (kind) {
    case "move":
      tone(c, "sine", 190, 80, 0.14, 0.5);
      hiss(c, 0.05, 0.25, 2500, 900, 0, 0.8);
      break;
    case "castle":
      tone(c, "sine", 190, 80, 0.14, 0.45);
      tone(c, "sine", 160, 70, 0.16, 0.45, 0.22);
      break;
    case "swing":
      hiss(c, 0.32, 0.22, 500, 3200, 0, 1.4);
      break;
    case "capture":
      tone(c, "sine", 140, 45, 0.3, 0.7);
      hiss(c, 0.18, 0.5, 1800, 500, 0, 0.7);
      tone(c, "triangle", 1180, 1100, 0.45, 0.12);
      tone(c, "triangle", 1760, 1700, 0.35, 0.08);
      break;
    case "check":
      tone(c, "square", 660, 660, 0.12, 0.12);
      tone(c, "square", 880, 880, 0.2, 0.12, 0.13);
      break;
    case "promote":
      [523, 659, 784, 1046].forEach((f, i) => tone(c, "triangle", f, f, 0.3, 0.2, i * 0.09));
      break;
    case "mate":
      [392, 330, 262, 196].forEach((f, i) => tone(c, "sawtooth", f, f * 0.98, 0.5, 0.16, i * 0.18));
      break;
    case "end":
      [440, 554, 659].forEach((f, i) => tone(c, "triangle", f, f, 0.5, 0.18, i * 0.12));
      break;
    case "start":
      tone(c, "triangle", 392, 392, 0.2, 0.2);
      tone(c, "triangle", 523, 523, 0.3, 0.2, 0.12);
      break;
    case "select":
      tone(c, "sine", 620, 760, 0.06, 0.12);
      break;
  }
}
