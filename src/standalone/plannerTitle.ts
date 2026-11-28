// TOEFL ITP Bi-Weekly Planner page (public/biweek-planner/index.html):
// its title drawn as particles, like the hero title of the home page.
//
// That page is plain HTML outside the React app, so this file is bundled on
// its own into public/biweek-planner/title-dots.js by
// scripts/build_planner_title.mjs (run by `npm run build`). It uses the same
// engine as the home page with the 2-D canvas painter — no three.js.
//
// The <h1> stays the real text. Where the effect is not welcome (reduced
// motion, forced colours, data saver, a slow connection, little memory — see
// shouldAnimateTitle) nothing happens and the page looks as it always did.

import { mountDots } from '../lib/titleParticlesCore';
import { canvasPainter } from '../lib/titleParticles2d';
import { shouldAnimateTitle, smallTitleSpacing, type DotGradient } from '../lib/titleParticlesMath';

// White-and-gold stops matching the section-heading palette in the page CSS.
const GRADIENT: { dark: DotGradient; light: DotGradient } = {
  dark: [[0, '#ffffff'], [0.5, '#f2c66d'], [1, '#ffffff']],
  light: [[0, '#ffffff'], [0.5, '#f2c66d'], [1, '#ffffff']],
};

function start(): void {
  const section = document.querySelector<HTMLElement>('.bp-hero');
  const title = section?.querySelector<HTMLElement>('.bp-title');
  if (!section || !title || section.querySelector('.bp-title-canvas')) return;

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const welcome = shouldAnimateTitle({
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || window.matchMedia('(forced-colors: active)').matches,
    saveData: nav.connection?.saveData === true,
    deviceMemory: nav.deviceMemory,
    effectiveType: nav.connection?.effectiveType,
    webgl: true, // not needed here: the dots are drawn on a 2-D canvas
  });
  if (!welcome) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'bp-title-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  section.appendChild(canvas);

  try {
    mountDots({
      section,
      title,
      canvas,
      letters: '.bp-title-solid',
      gradient: GRADIENT,
      spacing: smallTitleSpacing,
      isLight: () => document.documentElement.getAttribute('data-theme') === 'light',
      onActive: (active) => title.classList.toggle('bp-title-as-dots', active),
    }, canvasPainter(canvas));
  } catch {
    canvas.remove(); // no canvas support: the plain title stays
  }
}

const whenIdle = () => {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(start, { timeout: 2500 });
  else window.setTimeout(start, 600);
};
if (document.readyState === 'complete') whenIdle();
else window.addEventListener('load', whenIdle, { once: true });
