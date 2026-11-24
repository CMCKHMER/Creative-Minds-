// Magnetic tilt for a single hero CTA (docs/button-motion.md).
//
// The pointer position inside the button becomes a small 3D rotation plus the
// centre of a specular glare — the "lit glass object" feel from the Button Lab
// without the toy-cube look. Deliberately narrow:
//
//   · hover-capable pointers only — a phone has nothing to track, and touch
//     users get the press-depth state instead (.cmc-press / :active);
//   · off under prefers-reduced-motion;
//   · clamped to MAX_TILT_DEG and to the element's own box, so a fast pointer
//     can never spin it;
//   · gives up on zero-size elements (hidden CTA, jsdom) instead of writing
//     NaN into a CSS custom property.
//
// CSS side: .cmc-tilt in src/motion.css.
import { useEffect, useRef } from 'react';

export const MAX_TILT_DEG = 8;

export interface TiltValues {
  /** rotateX in degrees — negative when the pointer is high (top edge tips back). */
  x: number;
  /** rotateY in degrees — positive when the pointer is to the right. */
  y: number;
  /** Glare centre, percent of the element box. */
  gx: number;
  gy: number;
}

/** Pure tilt maths, exported so the mapping can be tested without a browser. */
export function tiltFromPointer(fractionX: number, fractionY: number): TiltValues {
  const clamp = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5);
  const fx = clamp(fractionX);
  const fy = clamp(fractionY);
  return {
    x: (0.5 - fy) * 2 * MAX_TILT_DEG,
    y: (fx - 0.5) * 2 * MAX_TILT_DEG,
    gx: fx * 100,
    gy: fy * 100,
  };
}

/** True when the tilt is worth wiring up at all on this device. */
export function tiltSupported(win: Window | undefined = typeof window === 'undefined' ? undefined : window): boolean {
  if (!win || typeof win.matchMedia !== 'function') return false;
  if (win.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return win.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

/** Attach to the CTA: `<button ref={useMagneticTilt()} className="cmc-tilt">`. */
export function useMagneticTilt<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || !tiltSupported()) return;

    const apply = (values: TiltValues) => {
      el.style.setProperty('--cmc-tilt-x', `${values.x.toFixed(2)}deg`);
      el.style.setProperty('--cmc-tilt-y', `${values.y.toFixed(2)}deg`);
      el.style.setProperty('--cmc-tilt-gx', `${values.gx.toFixed(1)}%`);
      el.style.setProperty('--cmc-tilt-gy', `${values.gy.toFixed(1)}%`);
    };

    const reset = () => apply(tiltFromPointer(0.5, 0.5));

    const onMove = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) return; // hidden or not laid out
      apply(tiltFromPointer((event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height));
    };

    reset();
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', reset);
    el.addEventListener('pointercancel', reset);
    el.addEventListener('blur', reset);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', reset);
      el.removeEventListener('pointercancel', reset);
      el.removeEventListener('blur', reset);
    };
  }, [enabled]);

  return ref;
}

export default useMagneticTilt;
