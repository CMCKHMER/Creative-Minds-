import { useEffect, useRef, useState } from 'react';

/**
 * useReveal — IntersectionObserver-driven scroll reveal.
 *
 * Returns a ref to attach to any element, plus an `inView` boolean that
 * becomes true the first time the element enters the viewport. Use it
 * to add `cmc-reveal` and `cmc-reveal--in` classes for the fade+slide
 * animation defined in index.css.
 *
 * Example:
 *   const ref = useReveal<HTMLDivElement>();
 *   return <section ref={ref} className={`cmc-reveal ${ref.inView ? 'cmc-reveal--in' : ''}`}>...</section>;
 *
 * (Actually we return { ref, inView } so the caller can destructure both.)
 */
export function useReveal<T extends Element = HTMLDivElement>(options?: IntersectionObserverInit) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const target = ref.current;
    if (!target) return;

    // Respect reduced-motion: skip the observer, show immediately.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true);
      return;
    }

    if (!('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -10% 0px', ...options },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [options]);

  return { ref, inView };
}

/**
 * useCountUp — animate a number from 0 (or `from`) to `target` over `duration` ms
 * the first time the element enters the viewport. Returns { ref, value }.
 *
 * The ref should be attached to the element containing the number so the
 * IntersectionObserver triggers the count-up animation.
 *
 * The `format` function is held in a ref so changes to its identity (which
 * happen on every render of the caller if it's defined inline, e.g. the
 * default `(n) => String(n)`) do NOT re-trigger the count-up effect —
 * otherwise the animation would restart from 0 on every render and never
 * complete, leaving the visible value stuck near 0.
 */
export function useCountUp<T extends Element = HTMLSpanElement>(
  target: number,
  { from = 0, duration = 1400, format = (n: number) => String(n) }: { from?: number; duration?: number; format?: (n: number) => string } = {},
) {
  const ref = useRef<T>(null);
  const [value, setValue] = useState(format(from));
  // Hold the latest format in a ref so the count-up effect doesn't
  // depend on format's identity (which would cause a re-render feedback loop).
  const formatRef = useRef(format);
  useEffect(() => { formatRef.current = format; });

  useEffect(() => {
    const targetEl = ref.current;
    if (!targetEl) return;

    const fmt = formatRef.current;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(fmt(target));
      return;
    }

    if (!('IntersectionObserver' in window)) {
      setValue(fmt(target));
      return;
    }

    let rafId: number | null = null;
    let observer: IntersectionObserver | null = null;
    let started = false;

    const start = () => {
      if (started) return; // guard against duplicate fires
      started = true;
      const startTime = performance.now();
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = easeOut(t);
        const current = Math.round(from + (target - from) * eased);
        setValue(formatRef.current(current));
        if (t < 1) {
          rafId = requestAnimationFrame(step);
        } else {
          setValue(formatRef.current(target));
        }
      };
      rafId = requestAnimationFrame(step);
    };

    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          start();
          observer?.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(targetEl);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
    // Intentionally NOT including `format` — held in formatRef.
    // Intentionally NOT including `from`/`target`/`duration` changes mid-animation
    // — those should be stable; if they change, re-running the effect would
    // restart from `from` which is rarely what the caller wants.
  }, [target, from, duration]);

  return { ref, value };
}
