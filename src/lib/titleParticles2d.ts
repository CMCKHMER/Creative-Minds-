// A heading as particles — the plain 2-D canvas painter.
//
// Draws the dots of titleParticlesCore.ts with nothing but the canvas API, so
// a stand-alone page can have the effect without three.js (which is most of
// the weight of the home page's version). Used by src/standalone/
// plannerTitle.ts for the TOEFL ITP Bi-Weekly Planner page.

import type { DotPainter } from './titleParticlesCore';

/** Colours are grouped into this many steps per channel before drawing. */
const STEPS = 16;
const KEYS = STEPS * STEPS * STEPS;

/** Draws the dots as filled circles. Throws when the browser gives no 2-D context. */
export function canvasPainter(canvas: HTMLCanvasElement): DotPainter {
  const maybe = canvas.getContext('2d');
  if (!maybe) throw new Error('no 2-D canvas');
  const ctx: CanvasRenderingContext2D = maybe;

  let ratio = 1;
  let count = 0;
  let pos: Float32Array = new Float32Array(0);
  let colors: Float32Array = new Float32Array(0);
  let sizes: Float32Array = new Float32Array(0);
  let keys = new Uint16Array(0);   // each dot's colour group
  let order = new Uint32Array(0);  // dot indices, grouped by colour
  const starts = new Uint32Array(KEYS + 1);

  const wipe = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return {
    resize(w, h, pixelRatio) {
      ratio = pixelRatio;
      canvas.width = Math.max(1, Math.round(w * ratio));
      canvas.height = Math.max(1, Math.round(h * ratio));
    },
    setDots(p, c, s, n) {
      pos = p;
      colors = c;
      sizes = s;
      count = n;
      keys = new Uint16Array(n);
      order = new Uint32Array(n);
    },
    draw(opacity) {
      wipe();
      if (!count || opacity <= 0) return;

      // One fill per colour instead of one per dot: sort the dots by colour
      // group (a counting sort — no allocation, one pass each way).
      starts.fill(0);
      const q = STEPS - 1;
      for (let i = 0; i < count; i++) {
        const j = i * 3;
        const key = (Math.round(colors[j] * q) * STEPS + Math.round(colors[j + 1] * q)) * STEPS + Math.round(colors[j + 2] * q);
        keys[i] = key;
        starts[key + 1]++;
      }
      for (let k = 0; k < KEYS; k++) starts[k + 1] += starts[k];
      for (let i = 0; i < count; i++) order[starts[keys[i]]++] = i;
      // starts[k] now holds the END of group k; a group begins where the one before ends

      // Drawn in device pixels (the transform is the identity after wipe()).
      ctx.globalAlpha = Math.min(1, opacity);
      const TAU = Math.PI * 2;
      const w = canvas.width;
      const h = canvas.height;
      let from = 0;
      for (let k = 0; k < KEYS && from < count; k++) {
        const to = starts[k];
        if (to === from) continue;
        // the group is painted in the colour of its first dot — the others differ by less than one step
        const j = order[from] * 3;
        ctx.fillStyle = `rgb(${Math.round(colors[j] * 255)},${Math.round(colors[j + 1] * 255)},${Math.round(colors[j + 2] * 255)})`;
        ctx.beginPath();
        for (let n = from; n < to; n++) {
          const i = order[n];
          const x = pos[i * 2] * ratio;
          const y = pos[i * 2 + 1] * ratio;
          if (x < -8 || y < -8 || x > w + 8 || y > h + 8) continue;
          const d = sizes[i] * ratio; // the dot's diameter in device pixels
          // Always draw smooth sub-pixel anti-aliased circles rather than
          // snapping small dots to integer-pixel squares (which clumped into
          // blocky blotches while dispersing).
          const r = Math.max(0.65, d * 0.46);
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, TAU);
        }
        ctx.fill();
        from = to;
      }
      ctx.globalAlpha = 1;
    },
    clear: wipe,
    dispose() {
      wipe();
    },
  };
}
