import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Desktop navbar declutter guard. The top bar sits between the Menu button +
 * brand on the left and the theme toggle / Demo / user pill on the right, so
 * the primary <nav> is hard-capped at FOUR links — anything more overlaps the
 * logo at a 1280px viewport (the "cluttered navbar" regression). Every other
 * destination lives in the Quick Links drawer, the mobile menu, or the footer.
 *
 * This test reads the Navbar source so the cap cannot be silently exceeded by
 * adding "just one more link" later.
 */

const NAVBAR_SRC = readFileSync(
  resolve(process.cwd(), join('src', 'components', 'Navbar.tsx')),
  'utf8',
);

/** Links allowed in the desktop primary nav, in display order. */
const ALLOWED_PRIMARY_HREFS = [
  '#toefl-junior-assessments',
  '#toefl-ibt-mock',
  '#games',
  '#brain-lounge',
];

function primaryNavBlock(): string {
  const start = NAVBAR_SRC.indexOf('aria-label="Primary"');
  expect(start, 'desktop primary <nav> must exist in Navbar.tsx').toBeGreaterThan(-1);
  const end = NAVBAR_SRC.indexOf('</nav>', start);
  expect(end, 'primary <nav> block must be closed').toBeGreaterThan(start);
  return NAVBAR_SRC.slice(start, end);
}

describe('desktop primary navbar stays decluttered', () => {
  const nav = primaryNavBlock();
  const hrefs = [...nav.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

  it('contains exactly the four approved primary links, in order', () => {
    expect(hrefs).toEqual(ALLOWED_PRIMARY_HREFS);
  });

  it('never grows past four links', () => {
    expect(hrefs.length).toBeLessThanOrEqual(4);
  });

  it('every primary link uses the shared cmc-nav-link style', () => {
    const linkCount = (nav.match(/className="cmc-nav-link"/g) ?? []).length;
    expect(linkCount).toBe(hrefs.length);
  });

  it('Features and FAQ stay reachable elsewhere (footer / mobile menu)', () => {
    expect(NAVBAR_SRC).toContain('href="#features"'); // mobile menu keeps it
    expect(NAVBAR_SRC).toContain('href="#faq"'); // mobile menu keeps it
  });
});
