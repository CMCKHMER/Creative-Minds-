// Tiny WebAudio synth for juicy, asset-free sound effects.
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem("brickforge_muted") === "1";
    } catch {
      this.muted = false;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem("brickforge_muted", m ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (this.master) this.master.gain.value = m ? 0 : 0.35;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.35;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = "square",
    vol = 0.5,
    slideTo?: number,
    delay = 0,
  ) {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol = 0.3, hp = 800) {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  brickHit(combo: number) {
    const f = 380 * Math.pow(2, Math.min(combo, 14) / 12);
    this.tone(f, 0.07, "square", 0.35);
  }
  brickBreak(combo: number) {
    const f = 520 * Math.pow(2, Math.min(combo, 16) / 12);
    this.tone(f, 0.12, "triangle", 0.5, f * 1.5);
    this.noise(0.09, 0.25, 1500);
  }
  goldBreak() {
    this.tone(880, 0.1, "triangle", 0.5);
    this.tone(1320, 0.12, "triangle", 0.5, undefined, 0.06);
    this.tone(1760, 0.18, "triangle", 0.5, undefined, 0.12);
    this.noise(0.15, 0.2, 2000);
  }
  anvil() {
    this.tone(160, 0.12, "sawtooth", 0.35, 90);
    this.noise(0.05, 0.3, 400);
  }
  paddle() {
    this.tone(220, 0.09, "sine", 0.6, 140);
    this.noise(0.04, 0.12, 600);
  }
  wall() {
    this.tone(300, 0.04, "sine", 0.25, 200);
  }
  launch() {
    this.tone(300, 0.15, "square", 0.3, 700);
  }
  power() {
    this.tone(523, 0.08, "square", 0.3);
    this.tone(659, 0.08, "square", 0.3, undefined, 0.07);
    this.tone(784, 0.08, "square", 0.3, undefined, 0.14);
    this.tone(1047, 0.16, "square", 0.3, undefined, 0.21);
  }
  loseLife() {
    this.tone(400, 0.35, "sawtooth", 0.4, 60);
    this.noise(0.3, 0.3, 200);
  }
  levelClear() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((n, i) => this.tone(n, 0.18, "triangle", 0.4, undefined, i * 0.09));
    this.tone(1568, 0.5, "triangle", 0.4, undefined, notes.length * 0.09);
  }
  gameOver() {
    [440, 415, 392, 330].forEach((n, i) => this.tone(n, 0.3, "sawtooth", 0.3, undefined, i * 0.22));
  }
  select() {
    this.tone(660, 0.06, "square", 0.25, 990);
  }
}
