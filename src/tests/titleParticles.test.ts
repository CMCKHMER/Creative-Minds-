import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  LOOK_SIZE,
  Look,
  dotSpacing,
  smallTitleSpacing,
  hslToRgb,
  letterPoints,
  paramsForFont,
  particleBudget,
  scatter,
  shouldAnimateTitle,
  stepParticles,
  type PointerState,
} from '../lib/titleParticlesMath';

/** A mask with one filled rectangle. */
function rectMask(width: number, height: number, x0: number, y0: number, x1: number, y1: number): Uint8Array {
  const alpha = new Uint8Array(width * height);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) alpha[y * width + x] = 255;
  return alpha;
}

function minDistance(points: Float32Array): number {
  let min = Infinity;
  for (let i = 0; i < points.length; i += 2) {
    for (let j = i + 2; j < points.length; j += 2) {
      min = Math.min(min, Math.hypot(points[i] - points[j], points[i + 1] - points[j + 1]));
    }
  }
  return min;
}

const away: PointerState = { x: 0, y: 0, active: false, pressed: false };

describe('letterPoints', () => {
  const alpha = rectMask(60, 40, 10, 10, 50, 30); // 40 × 20 block

  it('returns nothing for an empty mask', () => {
    expect(letterPoints(new Uint8Array(100), 10, 10, 2, 1000).length).toBe(0);
    expect(letterPoints(alpha, 0, 0, 2, 1000).length).toBe(0);
  });

  it('outline only: every point lies on the border of the shape', () => {
    const pts = letterPoints(alpha, 60, 40, 1, 10000, false);
    expect(pts.length / 2).toBe(2 * 40 + 2 * 20 - 4); // every border pixel, once
    for (let i = 0; i < pts.length; i += 2) {
      const x = Math.floor(pts[i]);
      const y = Math.floor(pts[i + 1]);
      expect(x === 10 || x === 49 || y === 10 || y === 29).toBe(true);
    }
  });

  it('keeps the points apart by the spacing', () => {
    const outline = letterPoints(alpha, 60, 40, 3, 10000, false);
    expect(minDistance(outline)).toBeGreaterThanOrEqual(3);
    const filled = letterPoints(alpha, 60, 40, 3, 10000, true);
    expect(minDistance(filled)).toBeGreaterThanOrEqual(3 * 0.8 - 1e-6);
  });

  it('fill adds points inside the shape, after the outline points', () => {
    const outline = letterPoints(alpha, 60, 40, 3, 10000, false);
    const filled = letterPoints(alpha, 60, 40, 3, 10000, true);
    expect(filled.length).toBeGreaterThan(outline.length * 1.5);
    expect(Array.from(filled.slice(0, outline.length))).toEqual(Array.from(outline));
    let interior = 0;
    for (let i = 0; i < filled.length; i += 2) {
      const x = filled[i];
      const y = filled[i + 1];
      expect(x >= 10 && x <= 50 && y >= 10 && y <= 30).toBe(true); // never outside the letter
      if (x > 12 && x < 48 && y > 12 && y < 28) interior++;
    }
    expect(interior).toBeGreaterThan(10);
  });

  it('leaves holes empty (the counter of an O)', () => {
    const ring = rectMask(60, 40, 5, 5, 55, 35);
    for (let y = 15; y < 25; y++) for (let x = 20; x < 40; x++) ring[y * 60 + x] = 0;
    const pts = letterPoints(ring, 60, 40, 2, 10000, true);
    for (let i = 0; i < pts.length; i += 2) {
      expect(pts[i] > 20 && pts[i] < 40 && pts[i + 1] > 15 && pts[i + 1] < 25).toBe(false);
    }
  });

  it('never returns more than the budget, and still covers the whole shape', () => {
    const pts = letterPoints(alpha, 60, 40, 1.5, 60, true);
    expect(pts.length / 2).toBeLessThanOrEqual(60);
    expect(pts.length / 2).toBeGreaterThan(20);
    let maxX = 0;
    let maxY = 0;
    let interior = 0;
    for (let i = 0; i < pts.length; i += 2) {
      maxX = Math.max(maxX, pts[i]);
      maxY = Math.max(maxY, pts[i + 1]);
      if (pts[i] > 13 && pts[i] < 47 && pts[i + 1] > 13 && pts[i + 1] < 27) interior++;
    }
    // Widening the spacing thins the shape evenly: it does not cut off the
    // end, and it does not spend the whole budget on the outline.
    expect(maxX).toBeGreaterThan(44);
    expect(maxY).toBeGreaterThan(26);
    expect(interior).toBeGreaterThan(5);
    expect(minDistance(pts)).toBeGreaterThan(2.5); // wider than the 1.5 asked for
  });
});

describe('stepParticles', () => {
  const p = paramsForFont(100);

  function line(n: number): { home: Float32Array; pos: Float32Array; look: Uint8Array } {
    const home = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      home[i * 2] = i * 4;
      home[i * 2 + 1] = 100;
    }
    return { home, pos: Float32Array.from(home), look: new Uint8Array(n) };
  }

  it('leaves resting dots alone when no cursor is near', () => {
    const { home, pos, look } = line(50);
    const off = stepParticles(pos, home, look, 50, away, p, 1);
    expect(off).toBe(0);
    expect(Array.from(pos)).toEqual(Array.from(home));
    expect(Array.from(look).every((l) => l === Look.Rest)).toBe(true);
  });

  it('reports how far the dots travelled, so the page can stop drawing when nothing moves', () => {
    const { home, pos, look } = line(50);
    const stats = { moved: -1 };
    stepParticles(pos, home, look, 50, away, p, 1, stats);
    expect(stats.moved).toBe(0);
    pos[0] += 40;
    stepParticles(pos, home, look, 50, away, p, 1, stats);
    expect(stats.moved).toBeCloseTo(40 * p.ease, 4);
    // a cursor lying still on the title: the clearing settles and movement stops
    const pointer: PointerState = { x: 100, y: 100, active: true, pressed: false };
    for (let i = 0; i < 600; i++) stepParticles(pos, home, look, 50, pointer, p, 1, stats);
    expect(stats.moved).toBeLessThan(0.02);
  });

  it('brings scattered dots home', () => {
    const { home, pos, look } = line(50);
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    scatter(pos, home, 50, 80, rand);
    const start = stepParticles(pos, home, look, 50, away, p, 0.25);
    expect(start).toBeGreaterThan(15); // no dot starts in place
    let off = start;
    for (let i = 0; i < 300; i++) off = stepParticles(pos, home, look, 50, away, p, 1);
    expect(off).toBeLessThan(0.01);
  });

  it('the cursor opens a clearing of about the set radius', () => {
    const { home, pos, look } = line(101);
    const pointer: PointerState = { x: 202, y: 100, active: true, pressed: false };
    for (let i = 0; i < 400; i++) stepParticles(pos, home, look, 101, pointer, p, 1);
    let nearest = Infinity;
    let sparks = 0;
    for (let i = 0; i < 101; i++) {
      const d = Math.hypot(pos[i * 2] - pointer.x, pos[i * 2 + 1] - pointer.y);
      if (i % 5 === 0) {
        // every fifth dot stays behind, almost in place
        expect(Math.hypot(pos[i * 2] - home[i * 2], pos[i * 2 + 1] - home[i * 2 + 1])).toBeLessThan(p.radius * 0.1);
        if (look[i] === Look.Spark) sparks++;
      } else {
        nearest = Math.min(nearest, d);
      }
    }
    expect(nearest).toBeGreaterThan(p.radius * 0.8);
    expect(nearest).toBeLessThan(p.radius * 1.2);
    expect(sparks).toBeGreaterThan(3);

    // …and it closes again when the cursor leaves.
    let off = Infinity;
    for (let i = 0; i < 400; i++) off = stepParticles(pos, home, look, 101, away, p, 1);
    expect(off).toBeLessThan(0.01);
    expect(Array.from(look).every((l) => l === Look.Rest)).toBe(true);
  });

  it('holding the button pulls dots toward the cursor', () => {
    const { home, pos, look } = line(101);
    const pointer: PointerState = { x: 202, y: 300, active: true, pressed: true };
    for (let i = 0; i < 30; i++) stepParticles(pos, home, look, 101, pointer, p, 1);
    const i = 50; // the dot straight above the cursor
    expect(pos[i * 2 + 1]).toBeGreaterThan(home[i * 2 + 1] + 5);
    expect([Look.Pressed, Look.PressedFar]).toContain(look[i]);
  });

  it('never produces a position that is not a number, even under the cursor', () => {
    const { home, pos, look } = line(20);
    for (const pressed of [false, true]) {
      const pointer: PointerState = { x: home[2], y: home[3], active: true, pressed };
      for (let i = 0; i < 200; i++) stepParticles(pos, home, look, 20, pointer, p, 1);
      expect(Array.from(pos).every(Number.isFinite)).toBe(true);
    }
  });

  it('moves the same distance in the same time on a 60 Hz and a 120 Hz screen', () => {
    const a = line(1);
    const b = line(1);
    a.pos[0] = b.pos[0] = 200; // 200 px from home
    for (let i = 0; i < 30; i++) stepParticles(a.pos, a.home, a.look, 1, away, p, 1);
    for (let i = 0; i < 60; i++) stepParticles(b.pos, b.home, b.look, 1, away, p, 0.5);
    expect(Math.abs(a.pos[0] - b.pos[0])).toBeLessThan(0.01);
  });

  it('the clearing is the same on a fast and a slow screen, and settles when frame times wobble', () => {
    const fast = line(101);
    const slow = line(101);
    const uneven = line(101);
    const pointer: PointerState = { x: 202, y: 110, active: true, pressed: false };
    const stats = { moved: 0 };
    for (let i = 0; i < 1200; i++) stepParticles(fast.pos, fast.home, fast.look, 101, pointer, p, 0.5, stats);
    for (let i = 0; i < 300; i++) stepParticles(slow.pos, slow.home, slow.look, 101, pointer, p, 3, stats);
    const wobble = [3, 2.2, 3, 2.6, 1.4, 3, 2.9, 0.8];
    for (let i = 0; i < 400; i++) stepParticles(uneven.pos, uneven.home, uneven.look, 101, pointer, p, wobble[i % wobble.length], stats);
    expect(stats.moved).toBeLessThan(0.01); // the last, uneven run has come to rest
    for (let i = 0; i < 202; i++) {
      expect(Math.abs(fast.pos[i] - slow.pos[i])).toBeLessThan(0.05);
      expect(Math.abs(fast.pos[i] - uneven.pos[i])).toBeLessThan(0.05);
    }
  });

  it('a long pause (a hidden tab) counts as three frames at most', () => {
    const a = line(21);
    const b = line(21);
    const pointer: PointerState = { x: 44, y: 130, active: true, pressed: true };
    stepParticles(a.pos, a.home, a.look, 21, pointer, p, 600);
    stepParticles(b.pos, b.home, b.look, 21, pointer, p, 3);
    expect(Array.from(a.pos)).toEqual(Array.from(b.pos));
  });
});

describe('look, colour and size helpers', () => {
  it('has one size for every look', () => {
    expect(LOOK_SIZE.length).toBe(Object.keys(Look).length);
    expect(LOOK_SIZE[Look.Rest]).toBe(1);
  });

  it('hslToRgb matches known colours', () => {
    expect(hslToRgb(0, 1, 0.5).map((v) => Math.round(v * 255))).toEqual([255, 0, 0]);
    expect(hslToRgb(0.5, 1, 0.5).map((v) => Math.round(v * 255))).toEqual([0, 255, 255]);
    expect(hslToRgb(1 / 3, 1, 0.25).map((v) => Math.round(v * 255))).toEqual([0, 128, 0]);
    expect(hslToRgb(0.2, 0, 1)).toEqual([1, 1, 1]);
    expect(hslToRgb(1.5, 1, 0.5)).toEqual(hslToRgb(0.5, 1, 0.5)); // hue wraps
  });

  it('spacing and budget stay within their limits', () => {
    expect(dotSpacing(20)).toBe(2);
    expect(dotSpacing(102)).toBeCloseTo(2.856, 3);
    expect(dotSpacing(400)).toBe(2.9);
    // a smaller title keeps a visible grain: wider than dotSpacing from about 34 px up, never past 2.6
    expect(smallTitleSpacing(20)).toBe(2);
    expect(smallTitleSpacing(41.6)).toBeCloseTo(2.496, 3);
    expect(smallTitleSpacing(59)).toBe(2.6);
    for (const px of [16, 28, 34, 42, 59, 80]) expect(smallTitleSpacing(px)).toBeGreaterThanOrEqual(dotSpacing(px));
    expect(particleBudget(390)).toBeLessThan(particleBudget(800));
    expect(particleBudget(800)).toBeLessThan(particleBudget(1440));
  });

  it('the reaction scales with the size of the title', () => {
    expect(paramsForFont(100).radius).toBe(paramsForFont(50).radius * 2);
    expect(paramsForFont(0).radius).toBeGreaterThan(0);
  });
});

describe('shouldAnimateTitle', () => {
  const ok = { reducedMotion: false, saveData: false, webgl: true };

  it('runs on an ordinary device', () => {
    expect(shouldAnimateTitle(ok)).toBe(true);
    expect(shouldAnimateTitle({ ...ok, deviceMemory: 8, effectiveType: '4g' })).toBe(true);
  });

  it('keeps the plain title when the visitor asked for less motion or less data', () => {
    expect(shouldAnimateTitle({ ...ok, reducedMotion: true })).toBe(false);
    expect(shouldAnimateTitle({ ...ok, saveData: true })).toBe(false);
  });

  it('keeps the plain title on weak devices, slow connections and without WebGL', () => {
    expect(shouldAnimateTitle({ ...ok, deviceMemory: 2 })).toBe(false);
    expect(shouldAnimateTitle({ ...ok, deviceMemory: 1 })).toBe(false);
    expect(shouldAnimateTitle({ ...ok, effectiveType: 'slow-2g' })).toBe(false);
    expect(shouldAnimateTitle({ ...ok, effectiveType: '2g' })).toBe(false);
    expect(shouldAnimateTitle({ ...ok, effectiveType: '3g' })).toBe(false);
    expect(shouldAnimateTitle({ ...ok, webgl: false })).toBe(false);
  });
});

describe('how the effect is wired into the page', () => {
  const hero = readFileSync('src/components/Hero.tsx', 'utf8');
  const css = readFileSync('src/index.css', 'utf8');
  const hook = readFileSync('src/hooks/useTitleParticles.ts', 'utf8');
  const planner = readFileSync('src/components/BiWeekPlannerCard.tsx', 'utf8');

  it('three.js is only ever loaded on demand, never with the first page', () => {
    expect(hook).toMatch(/import\('\.\.\/lib\/titleParticles'\)/);
    for (const file of [hero, hook, planner]) {
      expect(file).not.toMatch(/from ['"]three['"]/);
      expect(file).not.toMatch(/from ['"]\.\.\/lib\/titleParticles['"]/);
    }
    expect(hero).toMatch(/useTitleParticles\(\{ section: heroRef, title: titleRef, canvas: titleCanvasRef \}\)/);
    const math = readFileSync('src/lib/titleParticlesMath.ts', 'utf8');
    expect(math).not.toMatch(/from ['"]three['"]/);
  });

  it('the real heading stays in the page for screen readers', () => {
    expect(hero).toMatch(/aria-label="Everything a teacher needs in one place\."/);
    expect(hero).toMatch(/<canvas ref=\{titleCanvasRef\} className="cmc-title-canvas" aria-hidden="true"/);
    // hidden from the eye only — display:none or visibility:hidden would also
    // take away the letter positions the dots are built from
    const rule = css.match(/\.cmc-title-as-particles \.cmc-title-solid\s*\{([^}]*)\}/);
    expect(rule?.[1]).toMatch(/opacity:\s*0/);
    expect(rule?.[1]).not.toMatch(/display|visibility/);
  });

  it('the planner heading is drawn the same way and keeps its text', () => {
    // both lines are real text inside the <h2>, each line a span that starts with its text
    expect(planner).toMatch(/<h2 id="biweek-title" ref=\{titleRef\} className=\{`cmc-h2 cmc-h2-hero\$\{headingAsDots \? ' cmc-dots-on' : ''\}`\}>/);
    expect(planner).toContain('<span className="cmc-dots-line">TOEFL ITP</span>');
    expect(planner).toContain('<span className="cmc-dots-line cmc-gradient-text" data-dot-gradient="">Bi-Weekly Planner.</span>');
    expect(planner).toMatch(/enabled: isTeacher, whenNear: true, letters: '\.cmc-dots-line', gradient: HEADING_DOTS, spacing: smallTitleSpacing/);
    expect(planner).toContain('{isTeacher && <canvas ref={canvasRef} className="cmc-title-canvas" aria-hidden="true" />}');
    const rule = css.match(/\.cmc-dots-on \.cmc-dots-line\s*\{([^}]*)\}/);
    expect(rule?.[1]).toMatch(/opacity:\s*0/);
    expect(rule?.[1]).not.toMatch(/display|visibility/);
  });

  it('the planner heading is set in the hero title\'s lettering', () => {
    const fontOf = (selector: string) => css.match(new RegExp(`\\n${selector} \\{([^}]*)\\}`))![1].match(/font-family:\s*([^;]+);/)![1];
    // the hero title and the planner heading name the same font; a plain heading does not
    expect(fontOf('\\.cmc-title')).toBe('var(--font-hero)');
    expect(fontOf('\\.cmc-h2-hero')).toBe('var(--font-hero)');
    expect(fontOf('\\.cmc-h2')).toBe('var(--font-display)');
    expect(css).toMatch(/--font-hero:\s*'Syne'/);
    // the first line is the smaller one, as in the hero (0.62 of the second)
    expect(css.match(/\.cmc-title-row-first \{([^}]*)\}/)![1]).toMatch(/font-size:\s*0\.62em/);
    expect(css.match(/\.cmc-h2-hero > span:first-child \{([^}]*)\}/)![1]).toMatch(/font-size:\s*0\.62em/);
  });

  it('the planner dots take the colours of the gradient text they stand for', () => {
    const stops = (block: string) => [...block.matchAll(/(#[0-9a-f]{6}) (\d+)%/g)].map((m) => [Number(m[2]) / 100, m[1]]);
    const dark = css.match(/\n\.cmc-gradient-text\s*\{([^}]*)\}/)![1];
    const light = css.match(/html\.light \.cmc-gradient-text\s*\{([^}]*)\}/)![1];
    const pick = (name: string) => JSON.parse(planner.match(new RegExp(`${name}: (\\[\\[.*?\\]\\]),`))![1].replace(/'/g, '"'));
    expect(pick('dark')).toEqual(stops(dark));
    expect(pick('light')).toEqual(stops(light));
  });

  it('the canvas can never swallow a click on the hero buttons', () => {
    const rule = css.match(/\.cmc-title-canvas\s*\{([^}]*)\}/);
    expect(rule?.[1]).toMatch(/pointer-events:\s*none/);
  });
});
