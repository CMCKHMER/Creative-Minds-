/*
 * The glass frame for pages that bring their own header — Play Lab, Brain
 * Lounge, Teacher Tools and Cambodia News. Each used to carry a copy of the
 * same dark top bar and dark hero band; they now share one top bar and one
 * hero board in the look of the home page (src/glass.css): frosted pane on
 * the left, glass spheres on the right, thin lettering, pill buttons.
 */
import type { ReactNode } from 'react';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

/** Sticky top bar: the page's name on the left, theme switch and the way
 *  back to the cards on the right. */
export function GlassPageBar({
  href, label, icon: Icon, name, accent, onBack,
}: {
  /** The page's own hash, e.g. `#games`. */
  href: string;
  /** Accessible name of the brand link. */
  label: string;
  icon: LucideIcon;
  /** First part of the name, set in the ink colour. */
  name: string;
  /** Second part, set in the accent colour. */
  accent: string;
  onBack: () => void;
}) {
  return (
    <div className="cmc-subbar">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 sm:px-8">
        <a href={href} className="cmc-subbar-brand" aria-label={label}>
          <span className="cmc-subbar-mark" aria-hidden="true"><Icon className="h-4 w-4" /></span>
          <span className="truncate">{name} <span className="cmc-subbar-accent">{accent}</span></span>
        </a>
        <span className="flex items-center gap-2.5">
          <ThemeToggle />
          <button type="button" onClick={onBack} className="cmc-subbar-back">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Back to CMC</span>
            <span className="sm:hidden">Back</span>
          </button>
        </span>
      </div>
    </div>
  );
}

/** The hero board of a page: eyebrow, large thin title, one paragraph and a
 *  row of small facts, on a frosted pane beside the glass spheres. */
export function GlassPageHero({
  eyebrow, eyebrowIcon: EyebrowIcon, title, lead, children, view = 'a',
}: {
  eyebrow: string;
  eyebrowIcon: LucideIcon;
  /** Usually two lines; wrap the second in <em> for the gradient lettering. */
  title: ReactNode;
  lead: ReactNode;
  /** The row of facts under the paragraph (use <GlassFact>). */
  children?: ReactNode;
  /** Which part of the sphere picture shows, so the pages are not identical. */
  view?: 'a' | 'b' | 'c' | 'd';
}) {
  return (
    <section className={`cmc-board cmc-board--${view}`}>
      <div className="cmc-board-art" aria-hidden="true" />
      <div className="cmc-board-pane" aria-hidden="true" />
      <div className="cmc-board-inner">
        <p className="cmc-board-eyebrow">
          <span className="cmc-board-eyebrow-rule" aria-hidden="true" />
          <EyebrowIcon className="h-3.5 w-3.5" aria-hidden="true" /> {eyebrow}
        </p>
        <h1 className="cmc-board-title">{title}</h1>
        <p className="cmc-board-lead">{lead}</p>
        {children && <div className="cmc-board-facts">{children}</div>}
      </div>
    </section>
  );
}

export function GlassFact({ children }: { children: ReactNode }) {
  return <span className="cmc-board-fact">{children}</span>;
}
