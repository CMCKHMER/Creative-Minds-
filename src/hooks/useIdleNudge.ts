// Idle nudge (docs/button-motion.md, candidate 5 in docs/lab/buttons.html).
//
// A control that has been ignored for a while breathes twice and shows its
// hint. This is the one "alive" effect that carries meaning: it only fires
// when the user is stuck, and any interaction silences it immediately, so it
// never turns into a permanent attention magnet.
//
// Toggling is a single class (`is-nudging`) so the whole behaviour lives in
// CSS (src/motion.css) and costs one timer.
import { useEffect, useRef } from 'react';

export const IDLE_NUDGE_MS = 6000;

/**
 * Add `ref={useIdleNudge()}` and `className="cmc-nudge"` to the control.
 * `idleMs` is the quiet period before the first nudge.
 */
export function useIdleNudge<T extends HTMLElement>(idleMs: number = IDLE_NUDGE_MS, enabled = true) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    if (typeof window === 'undefined') return;
    // Respect the OS preference: no nudge animation at all.
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const stop = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      el.classList.remove('is-nudging');
    };

    const arm = () => {
      stop();
      timer = setTimeout(() => el.classList.add('is-nudging'), idleMs);
    };

    // Any sign of life silences the nudge; leaving the zone re-arms it.
    const onActivity = () => stop();
    const onLeave = () => arm();

    arm();
    el.addEventListener('pointerenter', onActivity);
    el.addEventListener('pointerdown', onActivity);
    el.addEventListener('focusin', onActivity);
    el.addEventListener('keydown', onActivity);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('focusout', onLeave);

    return () => {
      stop();
      el.removeEventListener('pointerenter', onActivity);
      el.removeEventListener('pointerdown', onActivity);
      el.removeEventListener('focusin', onActivity);
      el.removeEventListener('keydown', onActivity);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('focusout', onLeave);
    };
  }, [idleMs, enabled]);

  return ref;
}

export default useIdleNudge;
