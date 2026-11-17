/*
 * The map of the site: every part of the old one-page home is a page of its
 * own, opened from a card on the home page (owner request, Nov 2026 — "get
 * rid of the long scrolling looking for sections").
 *
 * A page is addressed by its hash (`/#pricing`), exactly the anchor the
 * section had on the long page, so every old link, bookmark and menu entry
 * still lands on the right thing.
 *
 * Pure data + pure functions (no React, no DOM) so the routing rules are
 * covered by src/tests/sitePages.test.ts.
 */

export type PageGroupId = 'news' | 'tests' | 'programs' | 'classroom' | 'about';

export interface PageGroup {
  id: PageGroupId;
  title: string;
  hint: string;
}

/** The order of the groups is the order of the rows on the home page.
 *  "News" is first on purpose: announcements are what a visitor should see
 *  first (owner request, guarded by announcementsPlacement.test.ts). */
export const PAGE_GROUPS: readonly PageGroup[] = [
  { id: 'news', title: 'News', hint: 'What is new at CMC and in Cambodian education' },
  { id: 'tests', title: 'Tests & practice', hint: 'TOEFL mock tests, assessments and daily records' },
  { id: 'programs', title: 'Programs & materials', hint: 'Kid, GEP and ISEC pathways, handouts and games' },
  { id: 'classroom', title: 'Classroom', hint: 'Tools for the lesson and live class results' },
  { id: 'about', title: 'About CMC', hint: 'What is inside, plans and answers' },
];

export type PageIcon =
  | 'megaphone' | 'newspaper' | 'graduation' | 'timer' | 'clipboard' | 'calendar' | 'notebook'
  | 'kids' | 'languages' | 'library' | 'gamepad' | 'brain' | 'dice' | 'layout' | 'activity'
  | 'book' | 'wand' | 'grid' | 'package' | 'list' | 'lightbulb' | 'calculator' | 'tag' | 'help' | 'mail';

export interface SitePage {
  /** The hash without `#` — also the DOM id of the section on its page. */
  id: string;
  /** Short name on the card and in the page bar. */
  title: string;
  /** One line under the name on the card. */
  blurb: string;
  group: PageGroupId;
  icon: PageIcon;
  /** 'section' = a former home section shown inside the shared page frame;
   *  'standalone' = a page that brings its own header (games, news, …). */
  kind: 'section' | 'standalone';
  /** Older anchors that must open this page. */
  aliases?: readonly string[];
  /** Small label on the card: who can use it. */
  badge?: 'Teachers' | 'Members' | 'Admin';
}

export const SITE_PAGES: readonly SitePage[] = [
  // ── News ──
  { id: 'announcements', title: 'Announcements', blurb: 'News and notices from the CMC team, pinned posts first.', group: 'news', icon: 'megaphone', kind: 'section', aliases: ['blog'] },
  { id: 'news', title: 'Cambodia education news', blurb: 'Daily headlines on schools and scholarships.', group: 'news', icon: 'newspaper', kind: 'standalone' },

  // ── Tests & practice ──
  { id: 'toefl-ibt-mock', title: 'TOEFL iBT full mock test', blurb: 'Full 4-section exam with audio, recording and timer.', group: 'tests', icon: 'graduation', kind: 'section' },
  { id: 'toefl-mini-test', title: 'TOEFL mini mock', blurb: 'A short timed practice set for members.', group: 'tests', icon: 'timer', kind: 'section', badge: 'Members' },
  { id: 'toefl-junior-assessments', title: 'TOEFL Junior assessments', blurb: 'Ready assessment packs with keys.', group: 'tests', icon: 'clipboard', kind: 'section' },
  { id: 'toefl-itp-planner', title: 'TOEFL ITP planner', blurb: 'The 8-week bi-weekly study plan and its tests.', group: 'tests', icon: 'calendar', kind: 'section', badge: 'Teachers' },
  { id: 'daily-assessment', title: 'Daily assessment records', blurb: 'Day-by-day student records in one workspace.', group: 'tests', icon: 'notebook', kind: 'section' },

  // ── Programs & materials ──
  { id: 'kid-grades', title: 'Kid 5–12 pathway', blurb: 'Reading Future worksheets and homework by grade.', group: 'programs', icon: 'kids', kind: 'section' },
  { id: 'gep-isec', title: 'GEP & ISEC', blurb: 'Adult-level program resources and drills.', group: 'programs', icon: 'languages', kind: 'section' },
  { id: 'resources', title: 'Resource library', blurb: 'Assignment packs and handouts with teacher keys.', group: 'programs', icon: 'library', kind: 'section' },
  { id: 'library', title: 'Reading room', blurb: 'Books to read on the site, page by page, on any device.', group: 'programs', icon: 'book', kind: 'standalone', aliases: ['reading-room', 'books', 'ebooks'] },
  { id: 'games', title: 'Learning games', blurb: 'Eight short games for vocabulary, grammar and reading.', group: 'programs', icon: 'gamepad', kind: 'standalone' },
  { id: 'brain-lounge', title: 'The Brain Lounge', blurb: 'Arcade games for memory, reflexes and logic.', group: 'programs', icon: 'brain', kind: 'standalone' },

  // ── Classroom ──
  { id: 'teacher-tools', title: 'Teacher tools', blurb: 'Dice roller, Wheel of Names and the Studio.', group: 'classroom', icon: 'dice', kind: 'standalone' },
  { id: 'lms-workspace', title: 'Creative Minds Studio', blurb: 'Design worksheets, posters and slides in the browser.', group: 'classroom', icon: 'layout', kind: 'section', badge: 'Teachers' },
  { id: 'live-results', title: 'Live class results', blurb: 'Scores as they arrive, and each student over time.', group: 'classroom', icon: 'activity', kind: 'section', aliases: ['firebase-dashboard'] },
  { id: 'interactive-demo', title: 'Try it live', blurb: 'Auto-grader, worksheet maker and roster to try out.', group: 'classroom', icon: 'wand', kind: 'section' },

  // ── About CMC ──
  { id: 'features', title: 'Features', blurb: 'What every part of the site does.', group: 'about', icon: 'grid', kind: 'section' },
  { id: 'toolkit', title: 'A look inside', blurb: 'The materials that are ready to use today.', group: 'about', icon: 'package', kind: 'section' },
  { id: 'whats-live', title: 'What is live', blurb: 'Which parts are finished and which are planned.', group: 'about', icon: 'list', kind: 'section' },
  { id: 'practice-notes', title: 'Useful practice', blurb: 'What teachers can preview and use in this build.', group: 'about', icon: 'lightbulb', kind: 'section' },
  { id: 'roi-calc', title: 'Time calculator', blurb: 'Estimate the marking hours you get back.', group: 'about', icon: 'calculator', kind: 'section' },
  { id: 'pricing', title: 'Pricing', blurb: 'What is included today, with no pretend plans.', group: 'about', icon: 'tag', kind: 'section' },
  { id: 'faq', title: 'Questions & answers', blurb: 'Searchable answers to common questions.', group: 'about', icon: 'help', kind: 'section' },
  { id: 'get-started', title: 'Get a teacher account', blurb: 'Open the member practice room and class assignments.', group: 'about', icon: 'mail', kind: 'section' },
  // Site-owner only — every account plus teacher verification. The panel
  // itself enforces the strict admin check (see AdminUsersPanel.tsx).
  { id: 'users-admin', title: 'Users & teachers', blurb: 'Every account, and one-click teacher verification.', group: 'about', icon: 'clipboard', kind: 'section' },
];

/** The hash that shows the home page scrolled to its cards. */
export const DIRECTORY_HASH = 'sections';

/** Hashes that always mean "the home page". */
const HOME_HASHES: ReadonlySet<string> = new Set(['', 'top', 'home', DIRECTORY_HASH]);

const PAGE_BY_KEY: ReadonlyMap<string, SitePage> = (() => {
  const map = new Map<string, SitePage>();
  for (const page of SITE_PAGES) {
    map.set(page.id, page);
    for (const alias of page.aliases ?? []) map.set(alias, page);
  }
  return map;
})();

/** `#pricing` → `pricing`; tolerant of a missing `#` and of bad escapes. */
export function hashKey(hash: string): string {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export function findPage(key: string): SitePage | undefined {
  return PAGE_BY_KEY.get(key);
}

/**
 * Which page a hash shows. `'home'` for the home page.
 *
 * A hash that is neither a page nor a home hash is an anchor inside the page
 * that is already open (`#privacy-notice` in the footer, a heading id, …):
 * the page stays where it is, so `current` is returned unchanged.
 */
export function resolveRoute(hash: string, current: string = 'home'): string {
  const key = hashKey(hash);
  if (HOME_HASHES.has(key)) return 'home';
  const page = PAGE_BY_KEY.get(key);
  if (page) return page.id;
  // `#library/<book>` is a book open in the Reading room.
  if (key.startsWith('library/')) return 'library';
  return current;
}

export function isInPageAnchor(hash: string): boolean {
  const key = hashKey(hash);
  return !HOME_HASHES.has(key) && !PAGE_BY_KEY.has(key) && !key.startsWith('library/');
}

export function pagesInGroup(group: PageGroupId): SitePage[] {
  return SITE_PAGES.filter((page) => page.group === group);
}

/** The page before and after `id` in card order (wraps round), for the
 *  "previous / next" buttons in the page bar. */
export function neighbours(id: string): { previous: SitePage; next: SitePage } | null {
  const index = SITE_PAGES.findIndex((page) => page.id === id);
  if (index < 0) return null;
  const count = SITE_PAGES.length;
  return {
    previous: SITE_PAGES[(index - 1 + count) % count],
    next: SITE_PAGES[(index + 1) % count],
  };
}
