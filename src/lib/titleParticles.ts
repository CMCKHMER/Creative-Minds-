// A heading as particles — the three.js part. Used by the hero title and by
// the TOEFL ITP Bi-Weekly Planner heading (see hooks/useTitleParticles.ts).
//
// Loaded with a dynamic import so three.js stays out of the first download
// (see manualChunks in vite.config.ts). The motion and the letter sampling
// live in titleParticlesMath.ts.
//
// The real heading stays in the page: it is the text for screen readers, it is
// what is shown until this module is ready, and it is what comes back if the
// WebGL context is lost. This module only draws dots on a canvas that covers
// the hero and reports when the dots are on screen.

import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  NormalBlending,
  OrthographicCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from 'three';
import {
  LOOK_SIZE,
  Look,
  dotSpacing,
  hslToRgb,
  letterPoints,
  paramsForFont,
  particleBudget,
  scatter,
  stepParticles,
  type DotGradient,
  type ParticleParams,
  type PointerState,
} from './titleParticlesMath';

export interface TitleParticlesOptions {
  /** The <section>: the canvas covers it and the pointer is read on it. */
  section: HTMLElement;
  /** The heading; the spans matched by `letters` hold its text. */
  title: HTMLElement;
  /** A canvas inside the section, stretched over it. */
  canvas: HTMLCanvasElement;
  /** Called with true when the dots are drawn, false when the text must come back. */
  onActive: (active: boolean) => void;
  /** Which spans inside the title are drawn. Each must start with its text. */
  letters?: string;
  /**
   * Resting colours for the spans marked `data-dot-gradient` (a line set in
   * gradient text), left to right. Every other span rests in the theme's
   * plain letter colour.
   */
  gradient?: { dark: DotGradient; light: DotGradient };
}

const VERTEX = /* glsl */ `
  attribute vec3 color;
  attribute float size;
  uniform float uPixelRatio;
  varying vec3 vColor;
  void main() {
    vColor = color;
    gl_PointSize = size * uPixelRatio;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.3, d) * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

type Rgb = [number, number, number];
interface Palette { rest: Rgb; spark: Rgb; pushed: Rgb; flying: Rgb; far: Rgb; pressHue: number; pressSat: number; pressLight: number }

const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

// Dark page: near-white letters, warm sparks. Light page: ink letters and
// deeper accents — pale dots vanish on the light background.
const DARK: Palette = { rest: hex('#f4faff'), spark: hex('#ffd24a'), pushed: hex('#ffffff'), flying: hex('#ffc933'), far: hex('#ffc933'), pressHue: 0.5, pressSat: 1, pressLight: 0.62 };
const LIGHT: Palette = { rest: hex('#0c1a2c'), spark: hex('#c2410c'), pushed: hex('#0c1a2c'), flying: hex('#c2410c'), far: hex('#c2410c'), pressHue: 0.52, pressSat: 0.9, pressLight: 0.36 };

interface Sampled {
  points: Float32Array;
  fontPx: number;
  /** the title's corner on the canvas */
  x: number;
  y: number;
  /** per point: how far along its gradient line it sits (0–1), or -1 on a plain line; null when no line is marked */
  along: Float32Array | null;
}

/** The colour at `t` (0–1) on a list of stops. */
function gradientAt(stops: Array<[number, Rgb]>, t: number): Rgb {
  if (!stops.length) return [1, 1, 1];
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [at, c] = stops[i];
    if (t <= at) {
      const [from, a] = stops[i - 1];
      const k = at > from ? (t - from) / (at - from) : 1;
      return [a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k, a[2] + (c[2] - a[2]) * k];
    }
  }
  return stops[stops.length - 1][1];
}

/**
 * The title's letters as points in the canvas's own coordinates.
 *
 * Each letter is drawn where the browser laid it out (one Range per
 * character), so wrapping, letter-spacing and kerning match the real text.
 *
 * Positions are taken from the canvas, not from the hero: the hero clips its
 * overflow but can still be scrolled inside by the browser (tabbing to a
 * button near its lower edge does it), and then the canvas and the letters
 * move together while the hero's own box stays put.
 */
function sampleTitle(canvas: HTMLElement, title: HTMLElement, budget: number, letters: string): Sampled | null {
  const origin = canvas.getBoundingClientRect();
  const box = title.getBoundingClientRect();
  if (box.width < 8 || box.height < 8) return null;

  const pad = 6;
  const scale = 2; // mask pixels per CSS pixel — half-pixel positions on curves
  const mask = document.createElement('canvas');
  mask.width = Math.ceil((box.width + pad * 2) * scale);
  mask.height = Math.ceil((box.height + pad * 2) * scale);
  const ctx = mask.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  let fontPx = 0;
  let drawn = 0;
  // Each span is drawn in its own shade of red, so a dot can be traced back
  // to the line it came from. Only the alpha decides where dots go.
  const SHADE = 20;
  const lines: Array<{ left: number; width: number; gradient: boolean }> = [];
  const range = document.createRange();
  title.querySelectorAll<HTMLElement>(letters).forEach((span) => {
    const node = span.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE || lines.length >= 11) return;
    const text = node.textContent ?? '';
    const line = span.getBoundingClientRect();
    lines.push({ left: line.left - box.left + pad, width: Math.max(1, line.width), gradient: span.hasAttribute('data-dot-gradient') });
    ctx.fillStyle = `rgb(${lines.length * SHADE},0,0)`;
    const cs = getComputedStyle(span);
    const size = parseFloat(cs.fontSize) || 16;
    fontPx = Math.max(fontPx, size);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${size * scale}px ${cs.fontFamily}`;
    const m = ctx.measureText('H');
    // A character's box runs from the font's ascent to its descent, so the
    // baseline sits one ascent below the top of the box.
    const ascent = Number.isFinite(m.fontBoundingBoxAscent) ? m.fontBoundingBoxAscent / scale : size * 0.8;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (!ch.trim()) continue;
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const r = range.getBoundingClientRect();
      if (r.width === 0) continue;
      ctx.fillText(ch, (r.left - box.left + pad) * scale, (r.top - box.top + pad + ascent) * scale);
      drawn++;
    }
  });
  if (!drawn) return null;

  const data = ctx.getImageData(0, 0, mask.width, mask.height).data;
  const alpha = new Uint8Array(mask.width * mask.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
  const pts = letterPoints(alpha, mask.width, mask.height, dotSpacing(fontPx) * scale, budget);
  if (pts.length < 200) return null; // font not painted (still loading) — keep the text

  let along: Float32Array | null = null;
  if (lines.some((l) => l.gradient)) {
    along = new Float32Array(pts.length / 2).fill(-1);
    for (let i = 0; i < pts.length; i += 2) {
      const px = Math.min(mask.width - 1, Math.max(0, Math.round(pts[i])));
      const py = Math.min(mask.height - 1, Math.max(0, Math.round(pts[i + 1])));
      const line = lines[Math.round(data[(py * mask.width + px) * 4] / SHADE) - 1];
      if (line?.gradient) along[i / 2] = Math.min(1, Math.max(0, (pts[i] / scale - line.left) / line.width));
    }
  }

  const ox = box.left - origin.left - pad;
  const oy = box.top - origin.top - pad;
  for (let i = 0; i < pts.length; i += 2) {
    pts[i] = pts[i] / scale + ox;
    pts[i + 1] = pts[i + 1] / scale + oy;
  }
  return { points: pts, fontPx, x: box.left - origin.left, y: box.top - origin.top, along };
}

/** Starts the effect. Returns the function that removes it again. */
export function mountTitleParticles({ section, title, canvas, onActive, letters = '.cmc-title-solid', gradient }: TitleParticlesOptions): () => void {
  const stopsFor = (g: DotGradient | undefined) => (g ?? []).map(([at, c]): [number, Rgb] => [at, hex(c)]);
  const gradients = { dark: stopsFor(gradient?.dark), light: stopsFor(gradient?.light) };
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
  } catch {
    onActive(false);
    return () => {};
  }
  renderer.setClearColor(0x000000, 0);
  renderer.sortObjects = false; // one object; sorting would measure a 2-D position buffer as 3-D

  const scene = new Scene();
  const camera = new OrthographicCamera(0, 1, 0, 1, -1, 1);
  const makeMaterial = () => new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { uOpacity: { value: 0 }, uPixelRatio: { value: 1 } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: NormalBlending,
  });
  let material = makeMaterial();
  let geometry = new BufferGeometry();
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  let count = 0;
  let home: Float32Array = new Float32Array(0);
  let pos = new Float32Array(0);
  let look = new Uint8Array(0);
  let colors = new Float32Array(0);
  let sizes = new Float32Array(0);
  let along: Float32Array | null = null; // see Sampled.along
  let rest: Float32Array | null = null;  // a resting colour per dot, when a line has a gradient
  let params: ParticleParams = paramsForFont(64);
  let dotSize = 2.2;
  let palette: Palette = document.documentElement.classList.contains('light') ? LIGHT : DARK;

  const pointer: PointerState = { x: 0, y: 0, active: false, pressed: false };
  let disposed = false;
  let active = false;
  let visible = true;
  let frame = 0;
  let last = 0;
  let opacity = 0;
  const stats = { moved: 0 }; // how far the dots travelled in the last step
  const builtAt = { x: 0, y: 0 }; // where the title stood on the canvas when the dots were made
  let started = false; // the first build has run
  let lost = false;    // WebGL context lost — the real title is showing
  let dirtyLook = true;
  let width = 0;
  let height = 0;

  const setActive = (next: boolean) => {
    if (active === next) return;
    active = next;
    onActive(next);
  };

  const resize = () => {
    const w = section.clientWidth;
    const h = section.clientHeight;
    if (w === width && h === height) return;
    width = w;
    height = h;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    material.uniforms.uPixelRatio.value = ratio;
    camera.right = w;
    camera.bottom = h;
    camera.updateProjectionMatrix();
  };

  /** Works out each dot's resting colour for the current theme. */
  const tintRest = () => {
    const stops = palette === LIGHT ? gradients.light : gradients.dark;
    if (!along || !stops.length) {
      rest = null;
      return;
    }
    rest = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const c = along[i] < 0 ? palette.rest : gradientAt(stops, along[i]);
      rest.set(c, i * 3);
    }
  };

  const paint = (now: number) => {
    // Hue of the held-button swirl drifts slowly, back and forth.
    const zig = (1 + Math.sin((now / 12000) * Math.PI * 2)) / 24; // cyan ↔ sky, the site's own blues
    const pressed = hslToRgb(palette.pressHue + zig, palette.pressSat, palette.pressLight);
    for (let i = 0; i < count; i++) {
      const state = look[i] as Look;
      const j = i * 3;
      if (state === Look.Rest && rest) {
        colors[j] = rest[j];
        colors[j + 1] = rest[j + 1];
        colors[j + 2] = rest[j + 2];
        sizes[i] = dotSize * LOOK_SIZE[state];
        continue;
      }
      const c = state === Look.Rest ? palette.rest
        : state === Look.Spark ? palette.spark
        : state === Look.Pushed ? palette.pushed
        : state === Look.Flying ? palette.flying
        : state === Look.Pressed ? pressed
        : palette.far;
      colors[j] = c[0];
      colors[j + 1] = c[1];
      colors[j + 2] = c[2];
      sizes[i] = dotSize * LOOK_SIZE[state];
    }
    geometry.attributes.color.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;
  };

  /** Measures the title again and rebuilds the dots. `intro` = fly in from a scatter. */
  const build = (intro: boolean) => {
    if (disposed) return;
    resize();
    started = true;
    const sampled = lost ? null : sampleTitle(canvas, title, particleBudget(section.clientWidth), letters);
    if (!sampled) {
      // Nothing to draw (title hidden, font not painted): show the real text.
      count = 0;
      if (!lost) renderer.clear();
      setActive(false);
      return;
    }
    const n = sampled.points.length / 2;
    home = sampled.points;
    builtAt.x = sampled.x;
    builtAt.y = sampled.y;
    params = paramsForFont(sampled.fontPx);
    dotSize = dotSpacing(sampled.fontPx) * 0.85; // dots nearly touch: a dotted line that still reads as a letter
    if (n !== count) {
      count = n;
      pos = new Float32Array(n * 2);
      look = new Uint8Array(n);
      colors = new Float32Array(n * 3);
      sizes = new Float32Array(n);
      geometry.dispose();
      geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(pos, 2).setUsage(DynamicDrawUsage));
      geometry.setAttribute('color', new BufferAttribute(colors, 3).setUsage(DynamicDrawUsage));
      geometry.setAttribute('size', new BufferAttribute(sizes, 1).setUsage(DynamicDrawUsage));
      points.geometry = geometry;
    }
    along = sampled.along;
    tintRest();
    if (intro) {
      scatter(pos, home, count, sampled.fontPx * 0.7, Math.random);
    } else {
      pos.set(home);
    }
    geometry.attributes.position.needsUpdate = true;
    dirtyLook = true;
    wake();
  };

  const tick = (now: number) => {
    frame = 0;
    if (disposed) return;
    const frames = last ? (now - last) / (1000 / 60) : 1;
    last = now;

    let busy = false;
    if (count && !lost) {
      const off = stepParticles(pos, home, look, count, pointer, params, frames, stats);
      const fading = opacity < 1;
      // Busy while something on the canvas is still changing: dots travelling,
      // the fade-in, or the held-button swirl cycling its colour.
      busy = stats.moved / Math.max(frames, 0.25) > 0.02 || fading || (pointer.active && pointer.pressed);
      // Everything has come to a stop with no cursor about: put the dots
      // exactly home so the last frame is the clean title.
      const landing = !busy && !pointer.active && off > 0;
      if (landing) {
        pos.set(home);
        look.fill(Look.Rest);
      }
      if (busy || landing || dirtyLook) {
        geometry.attributes.position.needsUpdate = true;
        paint(now);
        dirtyLook = false;
        if (fading) {
          opacity = Math.min(1, opacity + frames / 24); // 0.4 s fade-in
          material.uniforms.uOpacity.value = opacity;
        }
        renderer.render(scene, camera);
        setActive(true);
      }
    }

    // Sleep when nothing is changing — also with the cursor lying still on
    // the title. The next pointer event, resize or theme switch wakes it.
    if (busy && visible) {
      frame = requestAnimationFrame(tick);
    } else {
      last = 0;
    }
  };

  function wake() {
    if (disposed || frame || !visible) return;
    frame = requestAnimationFrame(tick);
  }

  // ── pointer ──────────────────────────────────────────────────────────
  const place = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    // Safety net for a move nothing above reported: the dots belong where
    // the letters are now, not where they were when the dots were made.
    const t = title.getBoundingClientRect();
    if (started && count && (Math.abs(t.left - r.left - builtAt.x) > 0.5 || Math.abs(t.top - r.top - builtAt.y) > 0.5)) scheduleRebuild();
  };
  // A finger is on the glass for a moment only — a tap has no frame between
  // down and up, and a drag is taken over by scrolling. So its push stays for
  // a little while after it lifts: a tap opens a clearing that closes again.
  let touchTimer = 0;
  const TOUCH_LINGER = 650;
  const onMove = (e: PointerEvent) => {
    place(e);
    pointer.active = true;
    wake();
  };
  const onDown = (e: PointerEvent) => {
    window.clearTimeout(touchTimer);
    place(e);
    pointer.active = true;
    // The swirl is for a held mouse button on empty hero space — never on a
    // link or a button, and never on touch (holding a finger scrolls).
    const control = (e.target as Element | null)?.closest?.('a, button, input, select, textarea, label, summary, [role="button"]');
    if (e.pointerType === 'mouse' && e.button === 0 && !control) pointer.pressed = true;
    wake();
  };
  const onUp = (e: PointerEvent) => {
    pointer.pressed = false;
    if (e.pointerType !== 'mouse' && pointer.active) {
      window.clearTimeout(touchTimer);
      touchTimer = window.setTimeout(() => {
        pointer.active = false;
        wake();
      }, TOUCH_LINGER);
    }
    wake();
  };
  const onLeave = (e: Event) => {
    // A finger lifting also fires "leave"; its push lingers (see onUp).
    if (e.type === 'pointerleave' && (e as PointerEvent).pointerType !== 'mouse') return;
    window.clearTimeout(touchTimer);
    pointer.active = false;
    pointer.pressed = false;
    wake();
  };
  section.addEventListener('pointermove', onMove, { passive: true });
  section.addEventListener('pointerdown', onDown, { passive: true });
  section.addEventListener('pointerleave', onLeave, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('pointercancel', onUp, { passive: true });
  window.addEventListener('blur', onLeave);

  // ── layout, theme, visibility ────────────────────────────────────────
  let rebuildTimer = 0;
  const scheduleRebuild = () => {
    if (!started) return; // the first build waits for the title's entrance
    window.clearTimeout(rebuildTimer);
    rebuildTimer = window.setTimeout(() => build(false), 120);
  };
  // The hero centres its content, so the title also moves when anything
  // around it changes height (the news panel filling in, a line wrapping)
  // while the title and the hero keep their own size. Watching every box
  // from the title up to the hero catches those moves.
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleRebuild) : null;
  for (let el: HTMLElement | null = title; el; el = el.parentElement) {
    resizeObserver?.observe(el);
    if (el === section) break;
  }
  window.addEventListener('resize', scheduleRebuild);
  document.fonts?.addEventListener?.('loadingdone', scheduleRebuild);

  const themeObserver = new MutationObserver(() => {
    palette = document.documentElement.classList.contains('light') ? LIGHT : DARK;
    tintRest();
    dirtyLook = true;
    wake();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  const viewObserver = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) wake();
      })
    : null;
  viewObserver?.observe(section);

  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    opacity = 0;
    material.uniforms.uOpacity.value = 0;
    setActive(false); // the real title comes back
  };
  const onRestored = () => {
    lost = false;
    // The old buffers and shader died with the old context. Start with fresh
    // objects instead of disposing the old ones: three.js would try to delete
    // them in the new context, which the browser reports as an error.
    geometry = new BufferGeometry();
    material = makeMaterial();
    points.geometry = geometry;
    points.material = material;
    count = 0; // build() makes the attributes again
    width = 0; // …and resize() the drawing buffer and the pixel ratio
    build(false);
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  // ── start: after the font is in and the title's entrance has finished ─
  const entrance = typeof title.getAnimations === 'function'
    ? title.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => undefined))
    : [];
  const fontReady = document.fonts?.ready ?? Promise.resolve();
  void Promise.all([fontReady, ...entrance]).then(() => build(true));

  return () => {
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    window.clearTimeout(rebuildTimer);
    window.clearTimeout(touchTimer);
    section.removeEventListener('pointermove', onMove);
    section.removeEventListener('pointerdown', onDown);
    section.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    window.removeEventListener('blur', onLeave);
    window.removeEventListener('resize', scheduleRebuild);
    document.fonts?.removeEventListener?.('loadingdone', scheduleRebuild);
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
    resizeObserver?.disconnect();
    themeObserver.disconnect();
    viewObserver?.disconnect();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    setActive(false);
  };
}
