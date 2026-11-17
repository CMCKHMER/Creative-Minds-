import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PAGE_GROUPS, SITE_PAGES, resolveRoute } from '../lib/sitePages';

/**
 * Regression guard — announcements are what a visitor sees first.
 *
 * The site owner asked for the "News & announcements" board to be at the
 * TOP of the home page because it is news and info that visitors should see
 * first. Since Nov 2026 the home page is the hero plus one card per page
 * (owner request: no long scroll), and the board is a page of its own — so
 * the wish is now kept by these invariants:
 *   - the cards come straight after the hero, with nothing in between;
 *   - the first group of cards is News and its first card is Announcements;
 *   - that card shows the newest post titles, read live;
 *   - the board renders once, on its own page, at its old address.
 */
const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, '..', ...parts), 'utf8');
const appSrc = read('App.tsx');
const boardSrc = read('components', 'AnnouncementBoard.tsx');
const directorySrc = read('components', 'SectionDirectory.tsx');
const glassSrc = read('glass.css');

describe('announcements come first on the home page', () => {
  it('renders the announcement board exactly once', () => {
    expect(appSrc.split('<AnnouncementBoard />').length - 1).toBe(1);
  });

  it('puts the cards directly under the hero', () => {
    // Anchor on the Hero JSX (its sidePanel prop is unique to that usage).
    const heroAnchor = appSrc.indexOf('sidePanel={<NewsSidePanel onSeeAll={openNewsPage} />}');
    const cards = appSrc.indexOf('<SectionDirectory />');
    expect(heroAnchor).toBeGreaterThan(-1);
    expect(cards, 'the cards must render after the hero').toBeGreaterThan(heroAnchor);
    // Nothing but the end of the Hero tag and a comment sits between them.
    const between = appSrc.slice(heroAnchor, cards).replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    expect(between.match(/<[A-Za-z]+/g) ?? [], 'no element between the hero and the cards').toEqual(['<NewsSidePanel']);
  });

  it('makes Announcements the first card of the first group', () => {
    expect(PAGE_GROUPS[0].id).toBe('news');
    expect(SITE_PAGES[0].id).toBe('announcements');
    expect(SITE_PAGES[0].group).toBe('news');
  });

  it('shows the newest posts on that card', () => {
    expect(directorySrc).toContain("page.id === 'announcements'");
    expect(directorySrc).toContain('<AnnouncementsCard');
    expect(directorySrc).toContain('fetchTeasers(');
  });

  it('keeps the announcements card the same size as every other card', () => {
    // Owner: "make this card smaller. no need for it STRETCH. KEEP ALL
    // CARDS THE SAME AND CONSISTANT" — it used to span two grid columns
    // and take 3fr of a special 3fr/2fr News row.
    expect(glassSrc).not.toContain('.cmc-page-card--news { grid-column: span 2; }');
    expect(glassSrc).not.toContain("data-group='news'] .cmc-directory-grid");
    expect(glassSrc).not.toMatch(/\.cmc-page-card--news\s*\{[^}]*grid-column/);
    // The one shared grid every card sits in, announcements included.
    expect(glassSrc).toContain('.cmc-directory-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(208px, 1fr));');
    expect(directorySrc).toContain('cmc-page-card cmc-page-card--news group');
  });

  it('keeps the board at its old address, with the blog strip under it', () => {
    expect(resolveRoute('#announcements')).toBe('announcements');
    expect(resolveRoute('#blog')).toBe('announcements');
    const page = appSrc.slice(appSrc.indexOf("case 'announcements':"), appSrc.indexOf("case 'daily-assessment':"));
    expect(page).toContain('<AnnouncementBoard />');
    expect(page).toContain('<BlogSection />');
    expect(page.indexOf('<AnnouncementBoard />')).toBeLessThan(page.indexOf('<BlogSection />'));
  });

  it('board keeps its public anchor and pinned-first copy', () => {
    expect(boardSrc).toContain('id="announcements"');
    expect(boardSrc).toContain('Pinned posts stay highlighted at the top.');
  });
});
