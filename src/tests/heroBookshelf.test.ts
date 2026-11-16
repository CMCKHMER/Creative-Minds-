// The bookshelf buttons on the hero (Nov 2026).
//
// Owner request: "i need two more buttons on the hero page. One for pdf
// uploads and another for interactive books that I will be selling, when im
// done uploading".
//
// The products do not exist yet, so the buttons must be REAL (the hero layout
// is final now) but must never lead to a 404. They open a panel that says what
// is coming. These tests pin both halves of that promise so a future edit
// cannot quietly turn them into dead links — or drop them from the hero.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const hero = read('src/components/Hero.tsx');
const app = read('src/App.tsx');
const panel = read('src/components/BookshelfComingSoonModal.tsx');

describe('hero bookshelf buttons', () => {
  it('renders both buttons in the hero action area', () => {
    expect(hero).toContain('PDF library');
    expect(hero).toContain('Interactive books');
    // both are buttons wired to props, not anchors to a page that does not exist
    expect(hero).toContain('onClick={onOpenPdfLibrary}');
    expect(hero).toContain('onClick={onOpenInteractiveBooks}');
    expect(hero).not.toMatch(/href=["']\.?\/(pdf-library|interactive-books)/);
  });

  it('marks them as not-yet-available, in the UI where the buyer sees it', () => {
    // a "Soon" chip on each — no customer should have to click to learn this
    expect(hero.match(/>\s*Soon\s*</g)?.length).toBe(2);
  });

  it('stays readable in both themes', () => {
    // The first version used pale amber / cyan utility text, and "PDF library"
    // all but vanished on the light hero. The buttons now take the theme's ink
    // colour from one class with an explicit light rule.
    const css = read('src/iridescent.css');
    expect(hero.match(/className="cmc-hero-shelf"/g)?.length).toBe(2);
    expect(hero).not.toMatch(/text-(amber|cyan)-100/);
    expect(css).toMatch(/\.cmc-hero-shelf \{[^}]*color: var\(--iri-ink\)/);
    expect(css).toMatch(/html\.light \.cmc-hero-shelf \{[^}]*color: var\(--iri-ink\)/);
  });

  it('declares both props as required, so a caller cannot silently omit one', () => {
    expect(hero).toMatch(/onOpenPdfLibrary:\s*\(\)\s*=>\s*void/);
    expect(hero).toMatch(/onOpenInteractiveBooks:\s*\(\)\s*=>\s*void/);
    // App passes both
    expect(app).toContain('onOpenPdfLibrary={() => setBookshelfShelf(\'pdf\')}');
    expect(app).toContain("onOpenInteractiveBooks={() => setBookshelfShelf('interactive')}");
  });

  it('routes both to the coming-soon panel rather than nowhere', () => {
    expect(app).toContain("import('./components/BookshelfComingSoonModal')");
    expect(app).toContain('<BookshelfComingSoonModal kind={bookshelfShelf}');
    // mounted under its own error boundary + suspense, like the demo modal
    expect(app).toMatch(/label="bookshelf-modal"[\s\S]{0,400}BookshelfComingSoonModal/);
  });

  it('has copy for each shelf that explains what is coming', () => {
    for (const shelf of ['pdf', 'interactive']) {
      expect(panel).toContain(`${shelf}: {`);
    }
    expect(panel).toContain('Not on sale yet');
    // and it is honest: it never claims the products are available
    expect(panel).not.toMatch(/buy now|add to cart|purchase today/i);
  });

  it('is a real accessible dialog', () => {
    expect(panel).toContain('role="dialog"');
    expect(panel).toContain('aria-modal="true"');
    expect(panel).toContain('aria-labelledby');
    expect(panel).toContain("e.key === 'Escape'");
    // and it restores the page scroll it froze
    expect(panel).toContain('document.body.style.overflow = prior');
  });
});
