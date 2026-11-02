import { Suspense, memo, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * LazyMount — defer a below-the-fold homepage section until it matters.
 *
 * Until the placeholder scrolls within `rootMargin` (800 px) of the viewport,
 * the section's React tree is NOT mounted: none of its effects run, none of
 * its Firestore reads fire, none of its images load. If the section element
 * is lazy-loaded (React.lazy), its chunk download also waits for the same
 * trigger — below-fold code leaves the initial bundle entirely.
 *
 * The placeholder keeps the section's `id` and an approximate `minHeight`
 * so in-page anchors (Quick Links, #daily-assessment, …) still land in the
 * right place, and layout shift is bounded while the real content streams in.
 *
 * The whole wrapper is memoized: App-level state changes (Quick Drawer,
 * modals, hash routes) no longer re-render the mounted sections underneath —
 * their props are stable callbacks, so they only re-render for their own
 * state.
 */
export const LazyMount = memo(function LazyMount({
  id,
  minHeight = 420,
  children,
}: {
  /** Section anchor id — lives on the placeholder until the content takes over. */
  id?: string;
  /** Approximate rendered height (px) of the section, for the placeholder. */
  minHeight?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (armed) return;
    const el = ref.current;
    // No IntersectionObserver (very old browsers / broken engines): mount
    // immediately rather than showing placeholders forever.
    if (!el || typeof IntersectionObserver === 'undefined') {
      setArmed(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setArmed(true);
          io.disconnect();
        }
      },
      // Arm well before the section is visible so the chunk download and
      // first render finish above the fold edge while the user scrolls.
      { rootMargin: '800px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [armed]);

  return (
    <div ref={ref} id={armed ? undefined : id}>
      {armed ? (
        <Suspense fallback={<div style={{ minHeight }} aria-hidden="true" />}>{children}</Suspense>
      ) : (
        <div style={{ minHeight }} aria-hidden="true" />
      )}
    </div>
  );
});
