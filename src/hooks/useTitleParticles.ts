import { useEffect, useState, type RefObject } from 'react';
import { shouldAnimateTitle, type DotGradient } from '../lib/titleParticlesMath';

export interface UseTitleParticlesOptions {
  /** The section the canvas covers; the pointer is read on it. */
  section: RefObject<HTMLElement | null>;
  /** The heading whose letters become dots. */
  title: RefObject<HTMLElement | null>;
  /** A canvas inside the section, stretched over it. */
  canvas: RefObject<HTMLCanvasElement | null>;
  /** False while the heading is not on the page (default true). */
  enabled?: boolean;
  /** Start only once the section is close to the screen — for headings far down the page. */
  whenNear?: boolean;
  /** Which spans hold the letters (default: the hero's `.cmc-title-solid`). */
  letters?: string;
  /** Colours for spans marked `data-dot-gradient`. Pass a constant, not a new object per render. */
  gradient?: { dark: DotGradient; light: DotGradient };
}

/**
 * Draws a heading as particles (three.js, src/lib/titleParticles.ts).
 *
 * The heading stays the real text. The effect is fetched only when the
 * browser is idle and only where it is welcome — see shouldAnimateTitle —
 * so with reduced motion, data saver, a slow connection, little memory or no
 * WebGL nothing is downloaded and the plain heading stays.
 *
 * @returns true while the dots are on screen (hide the real letters then).
 */
export function useTitleParticles({ section, title, canvas, enabled = true, whenNear = false, letters, gradient }: UseTitleParticlesOptions): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sectionEl = section.current;
    const titleEl = title.current;
    const canvasEl = canvas.current;
    if (!enabled || !sectionEl || !titleEl || !canvasEl) return;

    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean; effectiveType?: string };
    };
    const hasWebgl = () => {
      try {
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
        return Boolean(gl);
      } catch {
        return false;
      }
    };
    const welcome = shouldAnimateTitle({
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        || window.matchMedia('(forced-colors: active)').matches,
      saveData: nav.connection?.saveData === true,
      deviceMemory: nav.deviceMemory,
      effectiveType: nav.connection?.effectiveType,
      webgl: true, // probed below, and only when everything else says yes
    });
    if (!welcome) return;

    let cancelled = false;
    let dispose: (() => void) | undefined;
    let idleHandle = 0;
    let usedIdle = false;
    let nearObserver: IntersectionObserver | undefined;

    const start = () => {
      if (cancelled || !hasWebgl()) return;
      import('../lib/titleParticles')
        .then(({ mountTitleParticles }) => {
          if (cancelled) return;
          dispose = mountTitleParticles({ section: sectionEl, title: titleEl, canvas: canvasEl, onActive: setActive, letters, gradient });
        })
        .catch(() => { /* offline or blocked: the plain heading stays */ });
    };
    const whenIdle = () => {
      usedIdle = typeof window.requestIdleCallback === 'function';
      idleHandle = usedIdle ? window.requestIdleCallback(start, { timeout: 2500 }) : window.setTimeout(start, 900);
    };

    if (whenNear && typeof IntersectionObserver === 'function') {
      nearObserver = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        nearObserver?.disconnect();
        nearObserver = undefined;
        whenIdle();
      }, { rootMargin: '400px 0px' });
      nearObserver.observe(sectionEl);
    } else {
      whenIdle();
    }

    return () => {
      cancelled = true;
      nearObserver?.disconnect();
      if (idleHandle) {
        if (usedIdle) window.cancelIdleCallback(idleHandle);
        else window.clearTimeout(idleHandle);
      }
      dispose?.();
    };
  }, [section, title, canvas, enabled, whenNear, letters, gradient]);

  return active;
}
