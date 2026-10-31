import { Sfx } from "./audio";
import { buildLevel, COLS, type BrickKind } from "./levels";
import { bestScore } from "./highscores";

export const W = 480;
export const H = 720;

export type Phase = "start" | "playing" | "paused" | "gameover";
type PowerType = "multi" | "wide" | "fire" | "slow" | "life";

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  stuck: boolean;
  offset: number;
  trail: { x: number; y: number }[];
  dead: boolean;
}

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  kind: BrickKind;
  flash: number;
  scale: number;
  wob: number;
  wobV: number;
  delay: number;
  dead: boolean;
}

interface Power {
  x: number;
  y: number;
  vy: number;
  type: PowerType;
  t: number;
  dead: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  kind: "spark" | "shard" | "ring" | "ember";
  grav: number;
  rot: number;
  vr: number;
}

interface FloatText {
  x: number;
  y: number;
  vy: number;
  text: string;
  life: number;
  max: number;
  color: string;
  size: number;
}

interface Banner {
  text: string;
  sub: string;
  t: number;
  max: number;
}

const TIER: Record<string, { a: string; b: string; c: string }> = {
  "1": { a: "#ffb066", b: "#ff6a1f", c: "#8f2f08" },
  "2": { a: "#c3d0e2", b: "#7f92ad", c: "#36414f" },
  "3": { a: "#ff7b7b", b: "#d92a2a", c: "#5c0b0b" },
  gold: { a: "#fff5b8", b: "#ffc632", c: "#8a5a00" },
  anvil: { a: "#5d6573", b: "#2b3038", c: "#0f1216" },
};

export const POWER_INFO: Record<PowerType, { color: string; label: string; name: string }> = {
  multi: { color: "#6fe3ff", label: "×3", name: "MULTIBALL" },
  wide: { color: "#9dff6a", label: "◀▶", name: "WIDE PADDLE" },
  fire: { color: "#ff5533", label: "🔥", name: "FIREBALL" },
  slow: { color: "#c79bff", label: "◔", name: "SLOW TIME" },
  life: { color: "#ff7ab8", label: "♥", name: "EXTRA LIFE" },
};

const FONT = "'Chakra Petch', 'Segoe UI', system-ui, sans-serif";

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  sfx = new Sfx();

  phase: Phase = "start";
  onPhase: (p: Phase) => void = () => {};

  score = 0;
  level = 1;
  lives = 3;
  best = 0;
  combo = 0;
  comboTimer = 0;
  maxCombo = 0;
  bricksBroken = 0;
  comboPulse = 0;

  paddle = { x: W / 2, y: H - 58, w: 96, h: 14, targetW: 96, prevX: W / 2, vx: 0, squash: 0, glow: 0 };
  balls: Ball[] = [];
  bricks: Brick[] = [];
  powers: Power[] = [];
  particles: Particle[] = [];
  texts: FloatText[] = [];
  embers: Particle[] = [];

  shake = 0;
  shakeX = 0;
  shakeY = 0;
  flash = 0;
  flashColor = "#ffffff";
  hitstop = 0;
  time = 0;

  wideT = 0;
  fireT = 0;
  slowT = 0;

  launchTimer = 0;
  levelClear = false;
  levelClearT = 0;
  banner: Banner | null = null;
  dangerT = 0;

  keys = { left: false, right: false };
  pointerX: number | null = null;
  touchLastX: number | null = null;
  touchStart = { x: 0, y: 0, t: 0, moved: false };

  private raf = 0;
  private lastTime = 0;
  private brickCache = new Map<string, HTMLCanvasElement>();
  private dpr = 1;
  private destroyed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("no 2d context");
    this.ctx = ctx;
    this.best = bestScore();
    this.initEmbers();
    this.bindInput();
    this.resetPaddleBall();
    this.loadLevel(1);
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ---------- lifecycle ----------
  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.unbindInput();
  }

  resize(cssW: number, cssH: number) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.round(W * this.dpr);
    this.canvas.height = Math.round(H * this.dpr);
    this.brickCache.clear();
  }

  private setPhase(p: Phase) {
    if (this.phase === p) return;
    this.phase = p;
    this.onPhase(p);
  }

  start() {
    this.sfx.unlock();
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.combo = 0;
    this.maxCombo = 0;
    this.bricksBroken = 0;
    this.best = bestScore();
    this.powers = [];
    this.particles = [];
    this.texts = [];
    this.wideT = this.fireT = this.slowT = 0;
    this.levelClear = false;
    this.banner = null;
    this.flash = 0;
    this.shake = 0;
    this.paddle.targetW = 96;
    this.paddle.w = 96;
    this.loadLevel(1);
    this.resetPaddleBall();
    this.launchTimer = 2.2;
    this.setPhase("playing");
    this.showBanner("LEVEL 1", "STOKE THE FORGE", 1.4);
  }

  pause() {
    if (this.phase === "playing") {
      this.setPhase("paused");
    }
  }
  resume() {
    if (this.phase === "paused") {
      this.sfx.unlock();
      this.lastTime = performance.now();
      this.setPhase("playing");
    }
  }
  togglePause() {
    if (this.phase === "playing") this.pause();
    else if (this.phase === "paused") this.resume();
  }
  quitToMenu() {
    this.setPhase("start");
    this.loadLevel(1);
    this.resetPaddleBall();
    this.powers = [];
    this.banner = null;
  }
  toggleMute() {
    this.sfx.setMuted(!this.sfx.muted);
    return this.sfx.muted;
  }

  // ---------- setup ----------
  private initEmbers() {
    this.embers = [];
    for (let i = 0; i < 34; i++) {
      this.embers.push({
        x: rand(0, W),
        y: rand(0, H),
        vx: rand(-8, 8),
        vy: rand(-30, -10),
        life: rand(0, 6),
        max: rand(5, 9),
        color: Math.random() < 0.7 ? "#ff8a3d" : "#ffd27a",
        size: rand(1, 2.6),
        kind: "ember",
        grav: 0,
        rot: 0,
        vr: 0,
      });
    }
  }

  private loadLevel(level: number) {
    const specs = buildLevel(level);
    const margin = 16;
    const gap = 4;
    const bw = (W - margin * 2 - gap * (COLS - 1)) / COLS;
    const bh = 20;
    const top = 76;
    this.bricks = specs.map((s) => ({
      x: margin + s.col * (bw + gap),
      y: top + s.row * (bh + gap),
      w: bw,
      h: bh,
      hp: s.hp,
      maxHp: s.hp,
      kind: s.kind,
      flash: 0,
      scale: 0,
      wob: 0,
      wobV: 0,
      delay: s.row * 0.06 + s.col * 0.02,
      dead: false,
    }));
  }

  private resetPaddleBall() {
    this.paddle.x = W / 2;
    this.paddle.prevX = W / 2;
    this.paddle.vx = 0;
    this.balls = [this.makeBall(true)];
    this.launchTimer = 3;
  }

  private makeBall(stuck: boolean): Ball {
    return { x: this.paddle.x, y: this.paddle.y - 8 - 7, vx: 0, vy: 0, r: 7, stuck, offset: 0, trail: [], dead: false };
  }

  private ballSpeed() {
    const base = Math.min(400 + (this.level - 1) * 22, 660);
    return base * (this.slowT > 0 ? 0.7 : 1);
  }

  // ---------- input ----------
  private onKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    const k = e.key;
    // let focused overlay buttons handle their own activation
    if (tag === "BUTTON" && (k === " " || k === "Enter")) return;
    if (k === "ArrowLeft" || k === "a" || k === "A") {
      this.keys.left = true;
      this.pointerX = null;
      e.preventDefault();
    } else if (k === "ArrowRight" || k === "d" || k === "D") {
      this.keys.right = true;
      this.pointerX = null;
      e.preventDefault();
    } else if (k === " " || k === "ArrowUp" || k === "w" || k === "W") {
      e.preventDefault();
      if (this.phase === "playing") this.launch();
      else if (this.phase === "start") this.start();
      else if (this.phase === "paused") this.resume();
    } else if (k === "p" || k === "P" || k === "Escape") {
      e.preventDefault();
      this.togglePause();
    } else if (k === "m" || k === "M") {
      this.toggleMute();
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    const k = e.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") this.keys.left = false;
    if (k === "ArrowRight" || k === "d" || k === "D") this.keys.right = false;
  };

  private toGameX(clientX: number) {
    const r = this.canvas.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * W;
  }
  private scaleFactor() {
    const r = this.canvas.getBoundingClientRect();
    return W / r.width;
  }

  private onPointerDown = (e: PointerEvent) => {
    this.sfx.unlock();
    if (e.pointerType === "mouse") {
      this.pointerX = this.toGameX(e.clientX);
      if (this.phase === "playing") this.launch();
    } else {
      this.touchLastX = e.clientX;
      this.touchStart = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
      this.pointerX = null;
    }
    this.keys.left = this.keys.right = false;
  };
  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "mouse") {
      if (this.phase === "playing") this.pointerX = this.toGameX(e.clientX);
      return;
    }
    if (this.touchLastX === null) return;
    const dx = (e.clientX - this.touchLastX) * this.scaleFactor() * 1.3;
    this.touchLastX = e.clientX;
    if (Math.abs(e.clientX - this.touchStart.x) > 8) this.touchStart.moved = true;
    if (this.phase === "playing") {
      this.paddle.x = clamp(this.paddle.x + dx, this.paddle.w / 2 + 6, W - this.paddle.w / 2 - 6);
    }
  };
  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") {
      const dt = performance.now() - this.touchStart.t;
      if (!this.touchStart.moved && dt < 350 && this.phase === "playing") this.launch();
      this.touchLastX = null;
    }
  };
  private onBlur = () => {
    if (this.phase === "playing") this.pause();
  };
  private onVis = () => {
    if (document.hidden && this.phase === "playing") this.pause();
  };

  private bindInput() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVis);
  }
  private unbindInput() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVis);
  }

  private launch() {
    if (this.levelClear) return;
    let launched = false;
    for (const b of this.balls) {
      if (!b.stuck) continue;
      b.stuck = false;
      const sp = this.ballSpeed();
      const dir = this.paddle.vx > 40 ? 1 : this.paddle.vx < -40 ? -1 : Math.random() < 0.5 ? -1 : 1;
      const ang = rand(0.28, 0.45) * dir;
      b.vx = Math.sin(ang) * sp;
      b.vy = -Math.cos(ang) * sp;
      launched = true;
    }
    if (launched) {
      this.sfx.launch();
      this.paddle.squash = 1;
      this.burst(this.paddle.x, this.paddle.y - 8, 8, "#ffb066", 160, "spark");
    }
  }

  // ---------- juice helpers ----------
  private addShake(a: number) {
    this.shake = Math.min(this.shake + a, 22);
  }
  private burst(x: number, y: number, n: number, color: string, speed: number, kind: Particle["kind"], size = 3) {
    if (this.particles.length > 420) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(speed * 0.3, speed);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0,
        max: rand(0.3, 0.7),
        color,
        size: rand(size * 0.5, size * 1.4),
        kind,
        grav: kind === "shard" ? 700 : 300,
        rot: Math.random() * Math.PI,
        vr: rand(-10, 10),
      });
    }
  }
  private ring(x: number, y: number, color: string, size: number) {
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.35, color, size, kind: "ring", grav: 0, rot: 0, vr: 0 });
  }
  private floatText(x: number, y: number, text: string, color: string, size = 16) {
    if (this.texts.length > 40) this.texts.shift();
    this.texts.push({ x, y, vy: -60, text, life: 0, max: 0.8, color, size });
  }
  private showBanner(text: string, sub: string, max: number) {
    this.banner = { text, sub, t: 0, max };
  }

  // ---------- game logic ----------
  private loop = (now: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.05) dt = 0.05;
    if (this.phase === "playing") this.update(dt);
    else this.updateAmbient(dt);
    this.render();
  };

  private updateAmbient(dt: number) {
    this.time += dt;
    for (const e of this.embers) {
      e.life += dt;
      e.x += (e.vx + Math.sin(this.time * 1.3 + e.y * 0.02) * 10) * dt;
      e.y += e.vy * dt;
      if (e.y < -10 || e.life > e.max) {
        e.x = rand(0, W);
        e.y = H + 10;
        e.life = 0;
      }
    }
    this.shake = Math.max(0, this.shake - this.shake * 8 * dt);
    this.shakeX = rand(-1, 1) * this.shake;
    this.shakeY = rand(-1, 1) * this.shake;
    this.flash = Math.max(0, this.flash - dt * 3);
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > this.banner.max) this.banner = null;
    }
    this.updateParticles(dt);
  }

  private updateParticles(dt: number) {
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life += dt;
      if (p.life >= p.max) {
        ps[i] = ps[ps.length - 1];
        ps.pop();
        continue;
      }
      p.vy += p.grav * dt;
      p.vx *= 1 - 1.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    const ts = this.texts;
    for (let i = ts.length - 1; i >= 0; i--) {
      const t = ts[i];
      t.life += dt;
      t.y += t.vy * dt;
      t.vy *= 1 - 3 * dt;
      if (t.life >= t.max) ts.splice(i, 1);
    }
  }

  private update(dt: number) {
    this.updateAmbient(dt);
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }

    // timers
    if (this.wideT > 0) {
      this.wideT -= dt;
      if (this.wideT <= 0) this.paddle.targetW = 96;
    }
    if (this.fireT > 0) this.fireT -= dt;
    if (this.slowT > 0) this.slowT -= dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    this.comboPulse = Math.max(0, this.comboPulse - dt * 4);
    this.dangerT = Math.max(0, this.dangerT - dt);

    // paddle
    const p = this.paddle;
    p.prevX = p.x;
    const dir = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    if (dir !== 0) {
      p.vx = lerp(p.vx, dir * 860, 1 - Math.pow(0.0005, dt));
      p.x += p.vx * dt;
    } else if (this.pointerX !== null) {
      p.x = lerp(p.x, this.pointerX, 1 - Math.pow(0.000001, dt));
    } else {
      p.vx = lerp(p.vx, 0, 1 - Math.pow(0.001, dt));
      if (Math.abs(p.vx) > 5) p.x += p.vx * dt;
    }
    p.w = lerp(p.w, p.targetW, 1 - Math.pow(0.001, dt));
    p.x = clamp(p.x, p.w / 2 + 6, W - p.w / 2 - 6);
    p.vx = (p.x - p.prevX) / Math.max(dt, 0.0001);
    p.squash = Math.max(0, p.squash - dt * 6);
    p.glow = Math.max(0, p.glow - dt * 3);

    // bricks intro & wobble
    for (const b of this.bricks) {
      if (b.dead) continue;
      if (b.delay > 0) b.delay -= dt;
      else if (b.scale < 1) b.scale = Math.min(1, b.scale + dt * 5);
      b.flash = Math.max(0, b.flash - dt * 5);
      if (b.wob !== 0 || b.wobV !== 0) {
        b.wobV += -b.wob * 400 * dt;
        b.wobV *= 1 - 8 * dt;
        b.wob += b.wobV * dt;
        if (Math.abs(b.wob) < 0.05 && Math.abs(b.wobV) < 1) b.wob = b.wobV = 0;
      }
    }

    if (this.levelClear) {
      this.levelClearT -= dt;
      if (this.levelClearT <= 0) this.nextLevel();
      return;
    }

    // balls
    const speed = this.ballSpeed();
    for (const ball of this.balls) {
      if (ball.dead) continue;
      if (ball.stuck) {
        ball.x = p.x + ball.offset;
        ball.y = p.y - p.h / 2 - ball.r - 1;
        continue;
      }
      // trail
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > 10) ball.trail.shift();

      // enforce speed
      const cur = Math.hypot(ball.vx, ball.vy) || 1;
      const target = lerp(cur, speed, 1 - Math.pow(0.02, dt));
      ball.vx = (ball.vx / cur) * target;
      ball.vy = (ball.vy / cur) * target;
      // avoid too-flat trajectories
      const minVy = target * 0.22;
      if (Math.abs(ball.vy) < minVy) {
        const s = Math.sign(ball.vy) || -1;
        ball.vy = s * minVy;
        const nx = Math.sqrt(Math.max(0, target * target - minVy * minVy));
        ball.vx = Math.sign(ball.vx || 1) * nx;
      }

      const dist = target * dt;
      const steps = Math.max(1, Math.ceil(dist / 5));
      const sdt = dt / steps;
      for (let s = 0; s < steps && !ball.dead; s++) {
        this.stepBall(ball, sdt);
      }
    }

    // stuck-ball auto launch
    if (this.balls.some((b) => b.stuck && !b.dead)) {
      this.launchTimer -= dt;
      if (this.launchTimer <= 0) this.launch();
    }

    // remove dead balls
    const alive = this.balls.filter((b) => !b.dead);
    if (alive.length === 0 && this.balls.length > 0) {
      this.loseLife();
    } else {
      this.balls = alive;
    }

    // powerups
    for (const pw of this.powers) {
      pw.t += dt;
      pw.vy = Math.min(pw.vy + 200 * dt, 240);
      pw.y += pw.vy * dt;
      if (pw.y > H + 20) pw.dead = true;
      if (
        pw.y + 10 >= p.y - p.h / 2 &&
        pw.y - 10 <= p.y + p.h / 2 &&
        pw.x >= p.x - p.w / 2 - 12 &&
        pw.x <= p.x + p.w / 2 + 12
      ) {
        pw.dead = true;
        this.applyPower(pw);
      }
    }
    this.powers = this.powers.filter((pw) => !pw.dead);

    // level clear check
    if (!this.bricks.some((b) => !b.dead && b.kind !== "anvil")) {
      this.startLevelClear();
    }
  }

  private stepBall(ball: Ball, dt: number) {
    const px = ball.x;
    const py = ball.y;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    const r = ball.r;

    // walls
    if (ball.x - r < 0) {
      ball.x = r;
      ball.vx = Math.abs(ball.vx);
      this.wallHit(ball.x, ball.y);
    } else if (ball.x + r > W) {
      ball.x = W - r;
      ball.vx = -Math.abs(ball.vx);
      this.wallHit(ball.x, ball.y);
    }
    if (ball.y - r < 48) {
      ball.y = 48 + r;
      ball.vy = Math.abs(ball.vy);
      this.wallHit(ball.x, ball.y);
    }
    if (ball.y - r > H) {
      ball.dead = true;
      return;
    }

    // paddle
    const p = this.paddle;
    const top = p.y - p.h / 2;
    if (
      ball.vy > 0 &&
      ball.y + r >= top &&
      ball.y - r <= p.y + p.h / 2 + 4 &&
      ball.x >= p.x - p.w / 2 - r &&
      ball.x <= p.x + p.w / 2 + r &&
      py + r <= top + 6
    ) {
      const rel = clamp((ball.x - p.x) / (p.w / 2), -1, 1);
      const ang = rel * 1.05 + clamp(p.vx / 2500, -0.15, 0.15);
      const sp = Math.hypot(ball.vx, ball.vy);
      ball.vx = Math.sin(ang) * sp;
      ball.vy = -Math.abs(Math.cos(ang) * sp);
      ball.y = top - r;
      p.squash = 1;
      p.glow = 1;
      this.combo = 0;
      this.sfx.paddle();
      this.burst(ball.x, top, 6, "#ffb066", 140, "spark", 2);
      this.addShake(1.2);
      return;
    }

    // bricks
    let hit: Brick | null = null;
    let bestD = Infinity;
    for (const b of this.bricks) {
      if (b.dead || b.scale < 0.6) continue;
      const cx = clamp(ball.x, b.x, b.x + b.w);
      const cy = clamp(ball.y, b.y, b.y + b.h);
      const dx = ball.x - cx;
      const dy = ball.y - cy;
      const d = dx * dx + dy * dy;
      if (d < r * r && d < bestD) {
        bestD = d;
        hit = b;
      }
    }
    if (!hit) return;

    const fire = this.fireT > 0 && hit.kind !== "anvil";
    if (!fire) {
      // resolve side using previous position
      if (py + r <= hit.y + 1) {
        ball.vy = -Math.abs(ball.vy);
        ball.y = hit.y - r;
      } else if (py - r >= hit.y + hit.h - 1) {
        ball.vy = Math.abs(ball.vy);
        ball.y = hit.y + hit.h + r;
      } else if (px < hit.x) {
        ball.vx = -Math.abs(ball.vx);
        ball.x = hit.x - r;
      } else if (px > hit.x + hit.w) {
        ball.vx = Math.abs(ball.vx);
        ball.x = hit.x + hit.w + r;
      } else {
        ball.vy = -ball.vy;
      }
    }
    this.damageBrick(hit, ball, fire);
  }

  private wallHit(x: number, y: number) {
    this.sfx.wall();
    this.burst(x, y, 3, "#ffd27a", 90, "spark", 1.5);
  }

  private damageBrick(b: Brick, ball: Ball, fire: boolean) {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    if (b.kind === "anvil") {
      b.flash = 1;
      b.wob = ball.vy > 0 ? 3 : -3;
      this.sfx.anvil();
      this.burst(ball.x, ball.y, 6, "#c3d0e2", 160, "spark", 2);
      this.addShake(2);
      return;
    }
    b.hp -= fire ? b.hp : 1;
    if (b.hp > 0) {
      b.flash = 1;
      b.wob = ball.vy > 0 ? 4 : -4;
      this.combo++;
      this.comboTimer = 4;
      const gain = 10 * Math.max(1, this.combo);
      this.score += gain;
      this.sfx.brickHit(this.combo);
      this.burst(ball.x, ball.y, 6, TIER[String(b.hp + 1)].a, 180, "spark", 2);
      this.addShake(1.5);
      return;
    }
    // destroyed
    b.dead = true;
    this.bricksBroken++;
    this.combo++;
    this.comboTimer = 4;
    this.comboPulse = 1;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    const mult = Math.max(1, this.combo);
    const base = b.kind === "gold" ? 250 : 50 * b.maxHp;
    const gain = base * mult;
    this.score += gain;
    if (this.score > this.best) this.best = this.score;
    const tier = b.kind === "gold" ? TIER.gold : TIER[String(b.maxHp)];
    this.burst(cx, cy, b.kind === "gold" ? 22 : 12 + b.maxHp * 3, tier.b, 260, "shard", 4);
    this.burst(cx, cy, 8, tier.a, 200, "spark", 2);
    this.ring(cx, cy, tier.a, b.kind === "gold" ? 60 : 36);
    this.floatText(cx, cy - 6, `+${gain}`, b.kind === "gold" ? "#fff5b8" : "#ffffff", mult >= 4 ? 20 : 15);
    if (this.combo >= 3 && this.combo % 3 === 0) {
      this.floatText(W / 2, 330, `COMBO ×${this.combo}`, "#ffd27a", 26);
    }
    this.addShake(b.kind === "gold" ? 9 : 3 + b.maxHp * 1.5);
    if (b.kind === "gold") {
      this.sfx.goldBreak();
      this.flash = 0.35;
      this.flashColor = "#ffe08a";
      this.hitstop = 0.05;
      this.spawnPower(cx, cy);
    } else {
      this.sfx.brickBreak(this.combo);
      if (b.maxHp >= 2) this.hitstop = 0.025;
      if (Math.random() < 0.13) this.spawnPower(cx, cy);
    }
  }

  private spawnPower(x: number, y: number) {
    const table: [PowerType, number][] = [
      ["multi", 26],
      ["wide", 24],
      ["fire", 18],
      ["slow", 20],
      ["life", this.lives >= 5 ? 0 : 12],
    ];
    const total = table.reduce((s, t) => s + t[1], 0);
    let r = Math.random() * total;
    let type: PowerType = "multi";
    for (const [t, w] of table) {
      if (r < w) {
        type = t;
        break;
      }
      r -= w;
    }
    this.powers.push({ x, y, vy: 40, type, t: 0, dead: false });
  }

  private applyPower(pw: Power) {
    const info = POWER_INFO[pw.type];
    this.sfx.power();
    this.paddle.glow = 1;
    this.floatText(this.paddle.x, this.paddle.y - 30, info.name, info.color, 18);
    this.ring(this.paddle.x, this.paddle.y, info.color, 70);
    this.burst(this.paddle.x, this.paddle.y, 14, info.color, 220, "spark", 2.5);
    this.addShake(3);
    this.score += 100;
    switch (pw.type) {
      case "multi": {
        const src = this.balls.filter((b) => !b.dead && !b.stuck);
        const out: Ball[] = [];
        for (const b of src) {
          if (this.balls.length + out.length >= 12) break;
          const sp = Math.hypot(b.vx, b.vy) || this.ballSpeed();
          const a = Math.atan2(b.vy, b.vx);
          for (const da of [-0.45, 0.45]) {
            out.push({
              x: b.x,
              y: b.y,
              vx: Math.cos(a + da) * sp,
              vy: Math.sin(a + da) * sp,
              r: b.r,
              stuck: false,
              offset: 0,
              trail: [],
              dead: false,
            });
          }
        }
        if (src.length === 0) {
          // all stuck: spawn extra stuck balls
          const nb = this.makeBall(true);
          nb.offset = 20;
          const nb2 = this.makeBall(true);
          nb2.offset = -20;
          out.push(nb, nb2);
        }
        this.balls.push(...out);
        break;
      }
      case "wide":
        this.wideT = 12;
        this.paddle.targetW = 150;
        break;
      case "fire":
        this.fireT = 8;
        break;
      case "slow":
        this.slowT = 8;
        break;
      case "life":
        this.lives = Math.min(5, this.lives + 1);
        break;
    }
  }

  private loseLife() {
    this.lives--;
    this.combo = 0;
    this.sfx.loseLife();
    this.addShake(14);
    this.flash = 0.5;
    this.flashColor = "#ff3b3b";
    this.dangerT = 1;
    this.hitstop = 0.12;
    this.fireT = 0;
    this.slowT = 0;
    this.wideT = 0;
    this.paddle.targetW = 96;
    this.powers = [];
    this.burst(this.paddle.x, H - 10, 30, "#ff5533", 400, "spark", 3);
    if (this.lives <= 0) {
      this.balls = [];
      this.sfx.gameOver();
      this.setPhase("gameover");
      return;
    }
    this.resetPaddleBall();
    this.showBanner(`${this.lives} ${this.lives === 1 ? "LIFE" : "LIVES"} LEFT`, "TAP OR SPACE TO LAUNCH", 1.2);
  }

  private startLevelClear() {
    this.levelClear = true;
    this.levelClearT = 2.0;
    const bonus = 500 * this.level + this.lives * 150;
    this.score += bonus;
    if (this.score > this.best) this.best = this.score;
    this.sfx.levelClear();
    this.flash = 0.4;
    this.flashColor = "#ffe08a";
    this.addShake(6);
    this.showBanner(`LEVEL ${this.level} FORGED`, `BONUS +${bonus}`, 2.0);
    for (let i = 0; i < 6; i++) {
      this.burst(rand(60, W - 60), rand(120, 320), 14, i % 2 ? "#ffd27a" : "#ff8a3d", 260, "spark", 3);
    }
    this.balls = [];
    this.powers = [];
  }

  private nextLevel() {
    this.level++;
    this.levelClear = false;
    this.fireT = this.slowT = 0;
    this.wideT = 0;
    this.paddle.targetW = 96;
    this.loadLevel(this.level);
    this.resetPaddleBall();
    this.launchTimer = 3;
    this.showBanner(`LEVEL ${this.level}`, "HEAT RISING", 1.4);
  }

  // ---------- rendering ----------
  private brickSprite(b: Brick): HTMLCanvasElement {
    const key = `${b.kind}-${b.maxHp}-${b.hp}-${Math.round(b.w)}-${b.h}`;
    let c = this.brickCache.get(key);
    if (c) return c;
    const s = 2;
    c = document.createElement("canvas");
    c.width = Math.ceil(b.w * s);
    c.height = Math.ceil(b.h * s);
    const g = c.getContext("2d")!;
    g.scale(s, s);
    const tier = b.kind === "gold" ? TIER.gold : b.kind === "anvil" ? TIER.anvil : TIER[String(b.hp)];
    const w = b.w;
    const h = b.h;
    const rr = 4;
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, tier.a);
    grad.addColorStop(0.45, tier.b);
    grad.addColorStop(1, tier.c);
    g.fillStyle = grad;
    roundRect(g, 0, 0, w, h, rr);
    g.fill();
    // top bevel
    g.fillStyle = "rgba(255,255,255,0.35)";
    roundRect(g, 2, 1.5, w - 4, 3, 2);
    g.fill();
    // bottom shade
    g.fillStyle = "rgba(0,0,0,0.35)";
    roundRect(g, 2, h - 4, w - 4, 2.5, 2);
    g.fill();
    if (b.kind === "anvil") {
      g.strokeStyle = "rgba(255,255,255,0.15)";
      g.lineWidth = 1.5;
      for (const x of [6, w - 6]) {
        g.beginPath();
        g.arc(x, h / 2, 2, 0, Math.PI * 2);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(w / 2 - 6, 5);
      g.lineTo(w / 2 + 6, h - 5);
      g.moveTo(w / 2 + 6, 5);
      g.lineTo(w / 2 - 6, h - 5);
      g.stroke();
    } else if (b.kind === "gold") {
      g.fillStyle = "rgba(255,255,255,0.55)";
      g.beginPath();
      g.moveTo(w * 0.25, 2);
      g.lineTo(w * 0.35, 2);
      g.lineTo(w * 0.2, h - 2);
      g.lineTo(w * 0.1, h - 2);
      g.closePath();
      g.fill();
    } else if (b.maxHp === 2) {
      g.fillStyle = "rgba(0,0,0,0.3)";
      for (const x of [5, w - 5]) {
        g.beginPath();
        g.arc(x, h / 2, 1.6, 0, Math.PI * 2);
        g.fill();
      }
    }
    // cracks
    const dmg = b.maxHp - b.hp;
    if (dmg > 0 && b.kind === "normal") {
      g.strokeStyle = "rgba(20,10,5,0.75)";
      g.lineWidth = 1.2;
      g.lineCap = "round";
      const cracks = dmg === 1 ? 1 : 2;
      for (let i = 0; i < cracks; i++) {
        const sx = w * (0.3 + i * 0.4);
        g.beginPath();
        g.moveTo(sx, 0);
        g.lineTo(sx - 4, h * 0.35);
        g.lineTo(sx + 3, h * 0.6);
        g.lineTo(sx - 2, h);
        g.stroke();
        g.beginPath();
        g.moveTo(sx - 4, h * 0.35);
        g.lineTo(sx - 10, h * 0.5);
        g.stroke();
      }
    }
    // outline
    g.strokeStyle = "rgba(0,0,0,0.5)";
    g.lineWidth = 1;
    roundRect(g, 0.5, 0.5, w - 1, h - 1, rr);
    g.stroke();
    this.brickCache.set(key, c);
    return c;
  }

  private render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0a0c12");
    bg.addColorStop(0.7, "#14100f");
    bg.addColorStop(1, "#2a1408");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // forge glow at bottom
    const fg = ctx.createRadialGradient(W / 2, H + 60, 20, W / 2, H + 60, 420);
    const danger = this.dangerT > 0 ? this.dangerT : 0;
    fg.addColorStop(0, `rgba(255,${Math.round(120 - danger * 80)},40,${0.35 + danger * 0.3})`);
    fg.addColorStop(1, "rgba(255,90,20,0)");
    ctx.fillStyle = fg;
    ctx.fillRect(0, H - 420, W, 420);

    // subtle grid
    ctx.strokeStyle = "rgba(255,255,255,0.025)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 40) {
      ctx.moveTo(x + 0.5, 48);
      ctx.lineTo(x + 0.5, H);
    }
    for (let y = 48; y <= H; y += 40) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
    }
    ctx.stroke();

    // embers
    for (const e of this.embers) {
      const a = Math.sin((e.life / e.max) * Math.PI) * 0.7;
      ctx.globalAlpha = a;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);

    this.drawBricks(ctx);
    this.drawPowers(ctx);
    this.drawPaddle(ctx);
    this.drawBalls(ctx);
    this.drawParticles(ctx);
    this.drawTexts(ctx);

    ctx.restore();

    this.drawHUD(ctx);
    this.drawBanner(ctx);

    // flash
    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(1, this.flash);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    // vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  private drawBricks(ctx: CanvasRenderingContext2D) {
    for (const b of this.bricks) {
      if (b.dead || b.scale <= 0) continue;
      const spr = this.brickSprite(b);
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const s = easeOutBack(b.scale);
      if (s !== 1 || b.wob !== 0) {
        ctx.save();
        ctx.translate(cx, cy + b.wob);
        ctx.scale(s, s);
        ctx.drawImage(spr, -b.w / 2, -b.h / 2, b.w, b.h);
        if (b.flash > 0) {
          ctx.globalAlpha = b.flash * 0.8;
          ctx.fillStyle = "#ffffff";
          roundRect(ctx, -b.w / 2, -b.h / 2, b.w, b.h, 4);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      } else {
        ctx.drawImage(spr, b.x, b.y, b.w, b.h);
        if (b.flash > 0) {
          ctx.globalAlpha = b.flash * 0.8;
          ctx.fillStyle = "#ffffff";
          roundRect(ctx, b.x, b.y, b.w, b.h, 4);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      // gold shimmer
      if (b.kind === "gold") {
        const t = (this.time * 1.5 + b.x * 0.01) % 2;
        if (t < 0.6) {
          ctx.globalAlpha = Math.sin((t / 0.6) * Math.PI) * 0.5;
          ctx.fillStyle = "#ffffff";
          roundRect(ctx, b.x, b.y, b.w, b.h, 4);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  private drawPowers(ctx: CanvasRenderingContext2D) {
    for (const pw of this.powers) {
      const info = POWER_INFO[pw.type];
      const bob = Math.sin(pw.t * 8) * 2;
      ctx.save();
      ctx.translate(pw.x, pw.y + bob);
      // glow
      ctx.globalAlpha = 0.35 + Math.sin(pw.t * 10) * 0.15;
      ctx.fillStyle = info.color;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // capsule
      ctx.fillStyle = "#141820";
      roundRect(ctx, -17, -11, 34, 22, 8);
      ctx.fill();
      ctx.strokeStyle = info.color;
      ctx.lineWidth = 2;
      roundRect(ctx, -17, -11, 34, 22, 8);
      ctx.stroke();
      ctx.fillStyle = info.color;
      ctx.font = `700 13px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(info.label, 0, 1);
      ctx.restore();
    }
  }

  private drawPaddle(ctx: CanvasRenderingContext2D) {
    const p = this.paddle;
    const sq = p.squash;
    const sy = 1 - sq * 0.35;
    const sx = 1 + sq * 0.12;
    ctx.save();
    ctx.translate(p.x, p.y + sq * 3);
    ctx.scale(sx, sy);
    const w = p.w;
    const h = p.h;
    // glow
    const glowA = 0.25 + p.glow * 0.5 + (this.fireT > 0 ? 0.2 : 0);
    const gc = this.fireT > 0 ? "#ff5533" : this.wideT > 0 ? "#9dff6a" : "#ff8a3d";
    ctx.globalAlpha = glowA;
    ctx.fillStyle = gc;
    roundRect(ctx, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 10);
    ctx.fill();
    ctx.globalAlpha = 1;
    // body
    const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    grad.addColorStop(0, "#5c6675");
    grad.addColorStop(0.5, "#2f3641");
    grad.addColorStop(1, "#171b22");
    ctx.fillStyle = grad;
    roundRect(ctx, -w / 2, -h / 2, w, h, 7);
    ctx.fill();
    // hot edge
    ctx.fillStyle = gc;
    roundRect(ctx, -w / 2 + 4, -h / 2 + 1.5, w - 8, 3, 2);
    ctx.fill();
    // end caps
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    roundRect(ctx, -w / 2 + 2, -h / 2 + 2, 10, h - 4, 4);
    ctx.fill();
    roundRect(ctx, w / 2 - 12, -h / 2 + 2, 10, h - 4, 4);
    ctx.fill();
    ctx.restore();
  }

  private drawBalls(ctx: CanvasRenderingContext2D) {
    const fire = this.fireT > 0;
    for (const b of this.balls) {
      if (b.dead) continue;
      // trail
      const n = b.trail.length;
      for (let i = 0; i < n; i++) {
        const t = b.trail[i];
        const f = (i + 1) / (n + 1);
        ctx.globalAlpha = f * (fire ? 0.5 : 0.3);
        ctx.fillStyle = fire ? (i % 2 ? "#ffcc33" : "#ff5533") : "#ffb066";
        ctx.beginPath();
        ctx.arc(t.x, t.y, b.r * f * (fire ? 1.2 : 0.9), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // glow
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 3.2);
      g.addColorStop(0, fire ? "rgba(255,120,50,0.8)" : "rgba(255,180,110,0.7)");
      g.addColorStop(1, "rgba(255,120,50,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 3.2, 0, Math.PI * 2);
      ctx.fill();
      // core
      const cg = ctx.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, b.r);
      cg.addColorStop(0, "#ffffff");
      cg.addColorStop(0.6, fire ? "#ffd27a" : "#fff1dc");
      cg.addColorStop(1, fire ? "#ff5a1f" : "#ffb066");
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();

      if (b.stuck) {
        // launch hint arrow
        const a = 0.4 + Math.sin(this.time * 6) * 0.3;
        ctx.globalAlpha = a;
        ctx.strokeStyle = "#ffd27a";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(b.x, b.y - 14);
        ctx.lineTo(b.x, b.y - 60);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(b.x - 6, b.y - 54);
        ctx.lineTo(b.x, b.y - 64);
        ctx.lineTo(b.x + 6, b.y - 54);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const f = 1 - p.life / p.max;
      if (p.kind === "ring") {
        ctx.globalAlpha = f * 0.8;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * f + 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - f * f) + 4, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      ctx.globalAlpha = f;
      ctx.fillStyle = p.color;
      if (p.kind === "shard") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * f + 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawTexts(ctx: CanvasRenderingContext2D) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const t of this.texts) {
      const f = t.life / t.max;
      const a = f < 0.7 ? 1 : 1 - (f - 0.7) / 0.3;
      const s = 1 + (1 - Math.min(1, f * 5)) * 0.6;
      ctx.globalAlpha = a;
      ctx.font = `700 ${t.size * s}px ${FONT}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawHUD(ctx: CanvasRenderingContext2D) {
    // top bar
    ctx.fillStyle = "rgba(8,9,14,0.85)";
    ctx.fillRect(0, 0, W, 48);
    const lg = ctx.createLinearGradient(0, 0, W, 0);
    lg.addColorStop(0, "rgba(255,138,61,0)");
    lg.addColorStop(0.5, "rgba(255,138,61,0.8)");
    lg.addColorStop(1, "rgba(255,138,61,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(0, 47, W, 1.5);

    ctx.textBaseline = "middle";
    // score
    ctx.textAlign = "left";
    ctx.font = `500 10px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText("SCORE", 14, 14);
    ctx.font = `700 22px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(this.score).padStart(6, "0"), 14, 31);

    // level
    ctx.textAlign = "center";
    ctx.font = `500 10px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText("LEVEL", W / 2, 14);
    ctx.font = `700 22px ${FONT}`;
    ctx.fillStyle = "#ffb066";
    ctx.fillText(String(this.level), W / 2, 31);

    // best
    ctx.textAlign = "right";
    ctx.font = `500 10px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText("BEST", W - 14, 14);
    ctx.font = `700 14px ${FONT}`;
    ctx.fillStyle = "#ffd27a";
    ctx.fillText(String(this.best).padStart(6, "0"), W - 14, 31);

    // lives (flames) - drawn beside level
    for (let i = 0; i < 5; i++) {
      const x = W / 2 - 40 - i * 14 - 20;
      const on = i < this.lives;
      drawFlame(ctx, x, 26, on ? 1 : 0.15, this.time + i);
    }
    // combo indicator
    if (this.combo >= 2 && this.phase === "playing") {
      const s = 1 + this.comboPulse * 0.25;
      ctx.save();
      ctx.translate(W / 2 + 70, 26);
      ctx.scale(s, s);
      ctx.textAlign = "left";
      ctx.font = `700 15px ${FONT}`;
      ctx.fillStyle = "#ffd27a";
      ctx.fillText(`×${this.combo}`, 0, 0);
      ctx.restore();
    }

    // active power timers
    const timers: [number, string, number][] = [];
    if (this.fireT > 0) timers.push([this.fireT / 8, POWER_INFO.fire.color, 0]);
    if (this.wideT > 0) timers.push([this.wideT / 12, POWER_INFO.wide.color, 1]);
    if (this.slowT > 0) timers.push([this.slowT / 8, POWER_INFO.slow.color, 2]);
    timers.forEach(([f, color], i) => {
      const y = 56 + i * 6;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(W - 100, y, 86, 3);
      ctx.fillStyle = color;
      ctx.fillRect(W - 100, y, 86 * f, 3);
    });

    // launch countdown
    const stuck = this.balls.find((b) => b.stuck && !b.dead);
    if (stuck && this.phase === "playing" && !this.levelClear && this.launchTimer < 2.6) {
      ctx.textAlign = "center";
      ctx.font = `500 13px ${FONT}`;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillText("TAP · CLICK · SPACE TO LAUNCH", W / 2, H - 110);
    }
  }

  private drawBanner(ctx: CanvasRenderingContext2D) {
    const b = this.banner;
    if (!b) return;
    const f = b.t / b.max;
    const inA = Math.min(1, b.t / 0.2);
    const outA = f > 0.8 ? 1 - (f - 0.8) / 0.2 : 1;
    const a = Math.min(inA, outA);
    const s = easeOutBack(Math.min(1, b.t / 0.3));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(W / 2, H * 0.5);
    ctx.scale(s, s);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    roundRect(ctx, -170, -40, 340, 80, 12);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 30px ${FONT}`;
    ctx.fillStyle = "#ffb066";
    ctx.fillText(b.text, 0, -10);
    ctx.font = `500 13px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(b.sub, 0, 18);
    ctx.restore();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function drawFlame(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number, t: number) {
  const w = Math.sin(t * 9) * 0.8;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.fillStyle = "#ff8a3d";
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.quadraticCurveTo(6 + w, -2, 4, 4);
  ctx.quadraticCurveTo(0, 8, -4, 4);
  ctx.quadraticCurveTo(-6 - w, -2, 0, -9);
  ctx.fill();
  ctx.fillStyle = "#ffe08a";
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.quadraticCurveTo(3, 1, 2, 4);
  ctx.quadraticCurveTo(0, 6, -2, 4);
  ctx.quadraticCurveTo(-3, 1, 0, -3);
  ctx.fill();
  ctx.restore();
}
