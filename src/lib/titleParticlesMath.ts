// Hero title as particles — the pure part (no DOM, no three.js).
//
// Owner request, Nov 2026: animate the bold hero title like "Text Particles
// with ThreeJS" (webflow.com/made-in-webflow/website/text-particles-with-threejs,
// custom code credited to Sanprieto, codepen.io/sanprieto/pen/XWNjBdb). In
// that piece the letters are drawn as dots along their outlines; the cursor
// pushes the dots away and they ease back; holding the mouse button pulls
// them into a swirl around the cursor.
//
// This is a rebuild of that behaviour, not a copy of its code. The reference
// takes its dots from a typeface file, which would mean a different font
// from the page. Here the dots come from the title's own letters: the title
// is drawn to a mask with the page's font and the letters' edges and insides
// become the dots (`letterPoints`). The motion (`stepParticles`) works in
// CSS pixels and does not depend on the screen's refresh rate.
//
// Everything here works on plain typed arrays so it is unit-tested.

/**
 * A mask of letters → evenly spaced points.
 *
 * First the outline: a pixel is on the edge when it is inside a letter
 * (alpha ≥ threshold) and at least one of its four neighbours is outside (or
 * it lies on the mask border). Edge pixels are taken in scan order and one is
 * kept only when no kept point lies closer than `spacing`, so the outline
 * becomes a row of separate dots.
 *
 * Then, with `fill`, the inside: a honeycomb of points at the same spacing,
 * kept where it falls inside a letter and clear of the outline dots. This is
 * what keeps a bold title bold — outline dots alone leave it hollow.
 *
 * When the result is more than `max` points the spacing is widened and the
 * whole pass repeated.
 *
 * @param alpha    one alpha value per pixel (row by row)
 * @param spacing  smallest distance between two points, in mask pixels
 * @returns        [x0, y0, x1, y1, …] in mask pixels, outline points first
 */
export function letterPoints(
  alpha: ArrayLike<number>, width: number, height: number, spacing: number, max: number, fill = true, threshold = 128,
): Float32Array {
  if (width <= 0 || height <= 0 || max < 1) return new Float32Array(0);
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && alpha[y * width + x] >= threshold;

  const edge: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] < threshold) continue;
      if (inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1)) continue;
      edge.push(x + 0.5, y + 0.5);
    }
  }
  if (!edge.length) return new Float32Array(0);

  let gap = Math.max(1, spacing);
  let kept: number[] = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    const grid = new Spaced(width, height, gap);
    for (let i = 0; i < edge.length; i += 2) grid.offer(edge[i], edge[i + 1], gap);
    if (fill) {
      const rowStep = gap * Math.sqrt(3) / 2;
      for (let row = 0, y = gap / 2; y < height; row++, y += rowStep) {
        for (let x = row % 2 ? gap : gap / 2; x < width; x += gap) {
          if (!inside(Math.floor(x), Math.floor(y))) continue;
          // A fill point may sit a little nearer to the outline than the
          // outline's own dots sit to each other; nearer still would only
          // thicken the outline.
          grid.offer(x, y, gap * 0.8);
        }
      }
    }
    kept = grid.points;
    if (kept.length / 2 <= max) break;
    // Outline points fall in step with the spacing, fill points with its
    // square; the square root of the excess is right for a filled title and
    // merely takes another round for an outline.
    gap *= Math.max(1.06, Math.sqrt(kept.length / 2 / max));
  }
  const n = Math.min(kept.length / 2, Math.floor(max));
  return Float32Array.from(kept.slice(0, n * 2));
}

/** Collects points, refusing any that comes too close to one already taken. */
class Spaced {
  readonly points: number[] = [];
  private readonly cols: number;
  private readonly rows: number;
  private readonly cells: Int32Array[];
  private readonly size: number;

  constructor(width: number, height: number, gap: number) {
    this.size = gap;
    this.cols = Math.ceil(width / gap) + 1;
    this.rows = Math.ceil(height / gap) + 1;
    // Up to four points can share a cell of side `gap` when the fill is
    // allowed nearer than `gap` to the outline.
    this.cells = [0, 1, 2, 3].map(() => new Int32Array(this.cols * this.rows).fill(-1));
  }

  /** Takes (x, y) unless a taken point is closer than `clear`. */
  offer(x: number, y: number, clear: number): boolean {
    const cx = Math.floor(x / this.size);
    const cy = Math.floor(y / this.size);
    const clear2 = clear * clear;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = cy + dy;
      if (ny < 0 || ny >= this.rows) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        if (nx < 0 || nx >= this.cols) continue;
        for (const layer of this.cells) {
          const k = layer[ny * this.cols + nx];
          if (k === -1) break;
          const ex = this.points[k] - x;
          const ey = this.points[k + 1] - y;
          if (ex * ex + ey * ey < clear2) return false;
        }
      }
    }
    const at = cy * this.cols + cx;
    const layer = this.cells.find((l) => l[at] === -1);
    if (!layer) return false;
    layer[at] = this.points.length;
    this.points.push(x, y);
    return true;
  }
}

/** Distance between neighbouring dots, in CSS pixels, for a title set in `fontPx`. */
export function dotSpacing(fontPx: number): number {
  return Math.min(2.9, Math.max(2, fontPx * 0.028));
}

/** How the dots react — every length is in CSS pixels. */
export interface ParticleParams {
  /** Radius of the clearing the cursor opens in the letters. */
  radius: number;
  /** Share of the way home a dot travels per 60 Hz frame. */
  ease: number;
  /** The same while the button is held — slow, so the swirl can build. */
  pressEase: number;
  /** A dot further than this from home counts as "flying" (colour + size). */
  flying: number;
  /** While pressed: beyond this distance from home a dot takes the accent colour. */
  farFlying: number;
  /** Step per frame of every fifth dot: it barely moves, so it stays behind in the clearing. */
  sparkStep: number;
}

/** Parameters for a title whose larger line is set in `fontPx`. */
export function paramsForFont(fontPx: number): ParticleParams {
  const f = Math.max(12, fontPx);
  return {
    radius: f * 0.8,        // a clearing a little under two lines across
    ease: 0.05,
    pressEase: 0.01,
    flying: f * 0.5,
    farFlying: f * 3.5,
    sparkStep: f * 0.002,
  };
}

/** What a dot is doing — it sets the dot's colour and size. */
export const Look = { Rest: 0, Spark: 1, Pushed: 2, Flying: 3, Pressed: 4, PressedFar: 5 } as const;
export type Look = (typeof Look)[keyof typeof Look];

/** Size of a dot relative to the base size, per look. */
export const LOOK_SIZE: readonly number[] = [1, 1 / 1.2, 1.3, 1 / 1.8, 1, 1];

export interface PointerState {
  /** Cursor position; `active` false = no cursor over the hero. */
  x: number;
  y: number;
  active: boolean;
  /** Mouse button held. */
  pressed: boolean;
}

/**
 * One frame of the motion.
 *
 * Every dot eases toward its home. Not pressed: it is also pushed away from
 * the cursor with a force that falls with the square of the distance (every
 * fifth dot is moved only a hair — the sparks left behind in the clearing).
 * Pressed: the force is reversed — the dots are pulled in and overshoot —
 * and the way home is slow, so they swirl around the cursor.
 *
 * @param pos    current positions [x, y, …] — updated in place
 * @param home   the letter outline [x, y, …]
 * @param look   one Look per dot — written
 * @param frames elapsed time in 60 Hz frames (1 = 16.7 ms)
 * @param stats  optional; `moved` receives the furthest any dot travelled in
 *               this step — 0 means the picture did not change
 * @returns      the largest distance of any dot from home after the step
 */
export function stepParticles(
  pos: Float32Array, home: Float32Array, look: Uint8Array, count: number,
  pointer: PointerState, p: ParticleParams, frames: number, stats?: { moved: number },
): number {
  const dt = Math.min(Math.max(frames, 0.25), 3);
  const baseEase = pointer.active && pointer.pressed ? p.pressEase : p.ease;
  const ease = 1 - Math.pow(1 - baseEase, dt);
  // A push that lasts `dt` frames while the dot is also easing home adds up
  // to push · gain. With this gain a dot comes to rest at the same place at
  // any frame rate (offset = push / baseEase) — with plain `push · dt` the
  // resting place shifts with the frame time, and on a screen whose frame
  // time wobbles the dots never stop trembling.
  const gain = ease / baseEase;
  // Force such that the clearing settles at `radius`: area / r² = ease · r.
  const area = p.ease * p.radius * p.radius * p.radius;
  const reach2 = (p.radius * 6) * (p.radius * 6);       // beyond this the force is nothing
  const minD2 = (p.radius * 0.15) * (p.radius * 0.15);  // no division by zero under the cursor
  let maxOff2 = 0;
  let maxMove2 = 0;

  for (let i = 0; i < count; i++) {
    const ix = i * 2;
    const iy = ix + 1;
    const hx = home[ix];
    const hy = home[iy];
    // The way home …
    let px = pos[ix] + (hx - pos[ix]) * ease;
    let py = pos[iy] + (hy - pos[iy]) * ease;
    let state: Look = Look.Rest;

    // … plus the cursor's push, measured from where the dot was when the
    // step began (measured after the easing, the resting place would again
    // depend on the frame time).
    if (pointer.active) {
      const dx = pointer.x - pos[ix];
      const dy = pointer.y - pos[iy];
      const d2 = dx * dx + dy * dy;
      if (pointer.pressed) {
        const f = (area / Math.max(d2, minD2)) * gain;
        const d = Math.sqrt(d2) || 1;
        px += (dx / d) * f;
        py += (dy / d) * f;
        state = Look.Pressed;
        if (Math.abs(px - hx) > p.farFlying || Math.abs(py - hy) > p.farFlying) state = Look.PressedFar;
      } else if (d2 < reach2) {
        const d = Math.sqrt(d2) || 1;
        if (i % 5 === 0) {
          px -= (dx / d) * p.sparkStep * gain;
          py -= (dy / d) * p.sparkStep * gain;
          if (d2 < p.radius * p.radius * 4) state = Look.Spark;
        } else {
          const f = (area / Math.max(d2, minD2)) * gain;
          px -= (dx / d) * f;
          py -= (dy / d) * f;
          if (d2 < p.radius * p.radius * 4) state = Look.Pushed;
        }
      }
    }

    const mx = px - pos[ix];
    const my = py - pos[iy];
    if (mx * mx + my * my > maxMove2) maxMove2 = mx * mx + my * my;
    pos[ix] = px;
    pos[iy] = py;

    const ox = px - hx;
    const oy = py - hy;
    const off2 = ox * ox + oy * oy;
    if (off2 > maxOff2) maxOff2 = off2;
    // The two axes are tested separately (a square, not a circle) — cheap.
    if (state !== Look.Pressed && state !== Look.PressedFar && (Math.abs(ox) > p.flying || Math.abs(oy) > p.flying)) state = Look.Flying;
    look[i] = state;
  }
  if (stats) stats.moved = Math.sqrt(maxMove2);
  return Math.sqrt(maxOff2);
}

/** Scatter the dots around their homes — the start of the "assemble" intro. */
export function scatter(pos: Float32Array, home: Float32Array, count: number, spread: number, rand: () => number): void {
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    // sqrt → even over the disc; a floor so no dot starts in place
    const r = spread * (0.25 + 0.75 * Math.sqrt(rand()));
    pos[i * 2] = home[i * 2] + Math.cos(a) * r;
    pos[i * 2 + 1] = home[i * 2 + 1] + Math.sin(a) * r;
  }
}

/** h, s, l in 0–1 → [r, g, b] in 0–1 (the held-button swirl cycles its hue). */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = ((h % 1) + 1) % 1;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    const u = ((t % 1) + 1) % 1;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  return [channel(hue + 1 / 3), channel(hue), channel(hue - 1 / 3)];
}

/** How many dots a hero of this width gets. */
export function particleBudget(heroWidth: number): number {
  if (heroWidth < 640) return 9000;
  if (heroWidth < 1024) return 14000;
  return 22000;
}

export interface DeviceHints {
  reducedMotion: boolean;
  saveData: boolean;
  /** navigator.deviceMemory in GB, when the browser tells. */
  deviceMemory?: number;
  /** navigator.connection.effectiveType, when the browser tells. */
  effectiveType?: string;
  webgl: boolean;
}

/**
 * Whether to load the effect at all. The plain title stays for visitors who
 * asked for less motion or less data, on weak devices and slow connections
 * (the effect needs three.js, a download of its own), and without WebGL.
 */
export function shouldAnimateTitle(d: DeviceHints): boolean {
  if (d.reducedMotion || d.saveData || !d.webgl) return false;
  if (typeof d.deviceMemory === 'number' && d.deviceMemory <= 2) return false;
  if (d.effectiveType && /(^|-)2g$|^3g$/.test(d.effectiveType)) return false;
  return true;
}
