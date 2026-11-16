import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  DIRECTORY_HASH, PAGE_GROUPS, SITE_PAGES, findPage, hashKey, isInPageAnchor, neighbours,
  pagesInGroup, resolveRoute,
} from '../lib/sitePages';
import { parseTeasers, teaserAge, teaserUrl } from '../lib/announcementTeaser';

/**
 * One card per page (owner request, Nov 2026: "make each section its own
 * page linked to a card on the hero page… get rid of the long scrolling").
 *
 * These tests keep three promises:
 *   1. every page has a card and a body, and nothing is stacked on the home
 *      page again;
 *   2. every address that worked on the long page still opens the right page;
 *   3. every in-app link points at something that exists.
 */
const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');
const appSrc = readFileSync(join(src, 'App.tsx'), 'utf8');

/** The anchors the one-page home had — bookmarks and shared links use them. */
const OLD_ANCHORS = [
  'announcements', 'blog', 'daily-assessment', 'toefl-ibt-mock', 'lms-workspace', 'firebase-dashboard',
  'toefl-itp-planner', 'kid-grades', 'gep-isec', 'interactive-demo', 'features', 'toefl-mini-test',
  'toefl-junior-assessments', 'resources', 'roi-calc', 'pricing', 'faq',
  'games', 'teacher-tools', 'news', 'brain-lounge',
];

describe('the map of pages', () => {
  it('has unique ids and aliases', () => {
    const keys = SITE_PAGES.flatMap((page) => [page.id, ...(page.aliases ?? [])]);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('never uses a home hash as a page id', () => {
    for (const key of ['top', 'home', DIRECTORY_HASH]) expect(findPage(key)).toBeUndefined();
  });

  it('puts every page in a group and leaves no group empty', () => {
    const groups = new Set(PAGE_GROUPS.map((group) => group.id));
    for (const page of SITE_PAGES) expect(groups.has(page.group), page.id).toBe(true);
    for (const group of PAGE_GROUPS) expect(pagesInGroup(group.id).length, group.id).toBeGreaterThan(0);
  });

  it('gives every card a name and a line of text that fit a small card', () => {
    for (const page of SITE_PAGES) {
      expect(page.title.length, page.id).toBeGreaterThan(2);
      expect(page.title.length, page.id).toBeLessThanOrEqual(26);
      expect(page.blurb.length, page.id).toBeGreaterThan(10);
      expect(page.blurb.length, page.id).toBeLessThanOrEqual(60);
    }
  });

  it('keeps cards of one group together, in group order', () => {
    const order = PAGE_GROUPS.map((group) => group.id);
    const seen = SITE_PAGES.map((page) => order.indexOf(page.group));
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });
});

describe('addresses', () => {
  it('opens the home page for no hash, #top, #home and #sections', () => {
    for (const hash of ['', '#', '#top', '#home', `#${DIRECTORY_HASH}`]) {
      expect(resolveRoute(hash, 'pricing'), hash).toBe('home');
    }
  });

  it('opens every page by its id, from anywhere', () => {
    for (const page of SITE_PAGES) {
      expect(resolveRoute(`#${page.id}`), page.id).toBe(page.id);
      expect(resolveRoute(`#${page.id}`, 'faq'), page.id).toBe(page.id);
    }
  });

  it('still opens every address of the old one-page home', () => {
    for (const anchor of OLD_ANCHORS) {
      expect(resolveRoute(`#${anchor}`), anchor).not.toBe('home');
    }
    expect(resolveRoute('#firebase-dashboard')).toBe('live-results');
    expect(resolveRoute('#blog')).toBe('announcements');
  });

  it('treats any other hash as an anchor inside the page already open', () => {
    expect(resolveRoute('#privacy-notice', 'pricing')).toBe('pricing');
    expect(resolveRoute('#privacy-notice')).toBe('home');
    expect(isInPageAnchor('#privacy-notice')).toBe(true);
    expect(isInPageAnchor('#pricing')).toBe(false);
    expect(isInPageAnchor('#top')).toBe(false);
    expect(isInPageAnchor('')).toBe(false);
  });

  it('reads hashes with or without #, and survives a broken escape', () => {
    expect(hashKey('#pricing')).toBe('pricing');
    expect(hashKey('pricing')).toBe('pricing');
    expect(hashKey('#kid%2Dgrades')).toBe('kid-grades');
    expect(hashKey('#%E0%A4%A')).toBe('%E0%A4%A');
    expect(resolveRoute('#%E0%A4%A', 'faq')).toBe('faq');
  });

  it('steps round the pages in card order', () => {
    const first = SITE_PAGES[0];
    const last = SITE_PAGES[SITE_PAGES.length - 1];
    expect(neighbours(first.id)?.previous.id).toBe(last.id);
    expect(neighbours(last.id)?.next.id).toBe(first.id);
    expect(neighbours(SITE_PAGES[3].id)?.next.id).toBe(SITE_PAGES[4].id);
    expect(neighbours('nope')).toBeNull();
  });
});

describe('App.tsx', () => {
  it('has a body for every section page and a route for every page with its own header', () => {
    for (const page of SITE_PAGES) {
      if (page.kind === 'section') {
        expect(appSrc, page.id).toContain(`case '${page.id}':`);
      } else {
        expect(appSrc, page.id).toContain(`if (route === '${page.id}')`);
      }
    }
  });

  it('has no body for a page that is not on the map', () => {
    const cases = [...appSrc.matchAll(/case '([a-z0-9-]+)':/g)].map((match) => match[1]);
    expect(cases.length).toBe(SITE_PAGES.filter((page) => page.kind === 'section').length);
    for (const id of cases) expect(findPage(id)?.kind, id).toBe('section');
  });

  it('stacks no section on the home page', () => {
    const home = appSrc.slice(appSrc.indexOf('<Hero'), appSrc.indexOf('{/* Footer */}'));
    expect(home).toContain('<SectionDirectory />');
    expect(home).not.toContain('<LazyMount');
  });
});

describe('links inside the app', () => {
  const HOME = new Set(['top', 'home', DIRECTORY_HASH]);
  /** Anchors that are real elements rather than pages. */
  const ELEMENTS = new Set(['privacy-notice']);
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name !== 'tests') walk(join(dir, entry.name));
      } else if (/\.(tsx|ts)$/.test(entry.name)) {
        files.push(join(dir, entry.name));
      }
    }
  };
  walk(src);

  it('every hash link points at a page, the home page or a known element', () => {
    const bad: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/href="#([A-Za-z0-9_-]+)"/g)) {
        const key = match[1];
        if (!HOME.has(key) && !ELEMENTS.has(key) && !findPage(key)) bad.push(`${file.slice(src.length + 1)} → #${key}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('every page opened from App.tsx exists', () => {
    const opened = [...appSrc.matchAll(/openPage\('([a-z0-9-]+)'\)/g)].map((match) => match[1]);
    expect(opened.length).toBeGreaterThan(10);
    for (const id of opened) expect(findPage(id), id).toBeDefined();
  });
});

describe('the announcements card', () => {
  const doc = (id: string, title: string, iso: string, pinned = false) => ({
    name: `projects/p/databases/(default)/documents/announcements/${id}`,
    fields: { title: { stringValue: title }, createdAt: { timestampValue: iso }, pinned: { booleanValue: pinned } },
  });

  it('asks for three fields only — never the post body or its picture', () => {
    const url = teaserUrl();
    expect(url).toContain('/announcements?');
    expect(url).toContain('mask.fieldPaths=title');
    expect(url).toContain('mask.fieldPaths=pinned');
    expect(url).toContain('mask.fieldPaths=createdAt');
    expect(url).not.toContain('body');
    expect(url).not.toContain('imageUrl');
  });

  it('lists pinned posts first, then the newest, and stops at the limit', () => {
    const list = parseTeasers({
      documents: [
        doc('a', 'Newest', '2026-11-10T00:00:00Z'),
        doc('b', 'Older', '2026-11-01T00:00:00Z'),
        doc('c', 'Pinned and old', '2026-09-01T00:00:00Z', true),
        doc('d', 'Oldest', '2026-08-01T00:00:00Z'),
      ],
    });
    expect(list.map((post) => post.id)).toEqual(['c', 'a', 'b']);
    expect(list[0].pinned).toBe(true);
  });

  it('leaves out posts with no title or no id, and never throws', () => {
    expect(parseTeasers({ documents: [doc('a', '   ', '2026-11-10T00:00:00Z'), { fields: {} }, null, doc('b', 'Real', 'not a date')] }))
      .toEqual([{ id: 'b', title: 'Real', pinned: false, createdAt: 0 }]);
    expect(parseTeasers(null)).toEqual([]);
    expect(parseTeasers({ documents: 'x' })).toEqual([]);
    expect(parseTeasers({})).toEqual([]);
  });

  it('words the age of a post', () => {
    const now = Date.parse('2026-11-14T12:00:00Z');
    expect(teaserAge(0, now)).toBe('');
    expect(teaserAge(now - 3_600_000, now)).toBe('today');
    expect(teaserAge(now - 30 * 3_600_000, now)).toBe('yesterday');
    expect(teaserAge(now - 3 * 86_400_000, now)).toBe('3 days ago');
    expect(teaserAge(now - 20 * 86_400_000, now)).not.toMatch(/ago|today|yesterday/);
  });
});
