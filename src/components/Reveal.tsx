import { type ReactNode } from 'react';
import { useReveal } from '../hooks/useReveal';

interface RevealProps {
  /** The element tag to render. Defaults to 'div'. */
  as?: keyof React.JSX.IntrinsicElements;
  /** Apply the stagger variant — children will reveal in sequence. */
  stagger?: boolean;
  /** Extra Tailwind classes on the wrapper. */
  className?: string;
  /** Content. */
  children: ReactNode;
  /** Optional id for the element. */
  id?: string;
  /** Optional aria-labelledby for accessibility. */
  'aria-labelledby'?: string;
}

/**
 * <Reveal> — a tiny wrapper that adds the cmc-reveal fade+slide animation
 * to its content the first time the element scrolls into view.
 *
 * Respects prefers-reduced-motion (handled inside useReveal — the inView
 * flag flips to true immediately when reduced-motion is requested, so the
 * element shows with no animation).
 *
 * Usage:
 *   <Reveal as="section" className="cmc-section py-20">...</Reveal>
 *   <Reveal stagger className="grid lg:grid-cols-3">...8 cards...</Reveal>
 */
export function Reveal({ as: Tag = 'div', stagger = false, className = '', children, ...rest }: RevealProps) {
  const { ref, inView } = useReveal<HTMLElement>();
  // The ref is typed as HTMLElement because we don't know the concrete tag
  // at compile time — we cast at the JSX site.
  const refProp = ref as unknown as React.Ref<HTMLElement>;
  const cls = `cmc-reveal ${stagger ? 'cmc-stagger ' : ''}${inView ? 'cmc-reveal--in' : ''} ${className}`.trim();
  // @ts-expect-error — dynamic Tag with a generic ref
  return <Tag ref={refProp} className={cls} {...rest}>{children}</Tag>;
}
