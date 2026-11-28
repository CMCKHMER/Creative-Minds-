import { useEffect } from 'react';
import { shouldAnimateTitle, smallTitleSpacing } from '../lib/titleParticlesMath';

const HEADING_SELECTOR = [
  '.cmc-section h2:not(#biweek-title)',
  '.cmc-page-body h2:not(#biweek-title)',
  '.cmc-directory-title',
  '.cmc-directory-group-head h3',
  '.cmc-page-more h3',
  '.cmc-board-title',
].join(',');

type HeadingEffect = {
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  cancelled: boolean;
  near?: IntersectionObserver;
  dispose?: () => void;
};

/** Adds the same pointer-responsive dot dispersion used by the hero to every
 *  section heading. It watches lazy-loaded page sections and only builds an
 *  effect when its heading is near the viewport. */
export function SectionHeadingParticles() {
  useEffect(() => {
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
    if (!shouldAnimateTitle({
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        || window.matchMedia('(forced-colors: active)').matches,
      saveData: nav.connection?.saveData === true,
      deviceMemory: nav.deviceMemory,
      effectiveType: nav.connection?.effectiveType,
      webgl: true,
    }) || !hasWebgl()) return;

    const effects = new Map<HTMLElement, HeadingEffect>();
    let stopped = false;
    let scanFrame = 0;

    const remove = (heading: HTMLElement, effect: HeadingEffect) => {
      effect.cancelled = true;
      effect.near?.disconnect();
      effect.dispose?.();
      effect.canvas.remove();
      heading.classList.remove('cmc-heading-particles-active');
      effects.delete(heading);
      if (![...effects.values()].some((entry) => entry.host === effect.host)) {
        effect.host.classList.remove('cmc-title-particle-stage');
      }
    };

    const mount = (heading: HTMLElement, effect: HeadingEffect) => {
      if (stopped || effect.cancelled) return;
      import('../lib/titleParticles')
        .then(({ mountTitleParticles }) => {
          if (stopped || effect.cancelled) return;
          effect.dispose = mountTitleParticles({
            section: effect.host,
            title: heading,
            canvas: effect.canvas,
            letters: '*',
            spacing: smallTitleSpacing,
            onActive: (active) => heading.classList.toggle('cmc-heading-particles-active', active),
          });
        })
        .catch(() => remove(heading, effect));
    };

    const scan = () => {
      if (stopped) return;
      const current = new Set(document.querySelectorAll<HTMLElement>(HEADING_SELECTOR));
      for (const [heading, effect] of effects) {
        if (!current.has(heading) || !heading.isConnected) remove(heading, effect);
      }
      for (const heading of current) {
        if (effects.has(heading) || !heading.textContent?.trim() || heading.closest('.cmc-hero')) continue;
        // Use the smallest section-level box for each title to keep its canvas
        // light while still giving dispersed dots room to travel.
        const host = heading.closest<HTMLElement>(
          '.cmc-directory-group-head, .cmc-directory-head, .cmc-board, .cmc-section, section',
        ) ?? heading.parentElement;
        if (!host) continue;

        const canvas = document.createElement('canvas');
        canvas.className = 'cmc-title-canvas cmc-section-title-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        host.classList.add('cmc-title-particle-stage');
        host.append(canvas);
        const effect: HeadingEffect = { host, canvas, cancelled: false };
        effects.set(heading, effect);

        if (typeof IntersectionObserver !== 'function') {
          mount(heading, effect);
        } else {
          effect.near = new IntersectionObserver(([entry]) => {
            if (!entry?.isIntersecting || effect.cancelled) return;
            effect.near?.disconnect();
            effect.near = undefined;
            mount(heading, effect);
          }, { rootMargin: '320px 0px' });
          effect.near.observe(heading);
        }
      }
    };

    scan();
    const observer = new MutationObserver(() => {
      if (scanFrame) return;
      scanFrame = window.requestAnimationFrame(() => {
        scanFrame = 0;
        scan();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      stopped = true;
      observer.disconnect();
      if (scanFrame) window.cancelAnimationFrame(scanFrame);
      for (const [heading, effect] of effects) remove(heading, effect);
    };
  }, []);

  return null;
}
