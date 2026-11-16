// One card per page — browser check.
//
// Owner request (Nov 2026): "make the hero page more compact by making each
// section its own page linked to a card on the hero page. I want to get rid
// of the long scrolling looking for sections." The map of pages is
// src/lib/sitePages.ts. This loads the built site and checks:
//
//   1. the home page is short: hero, quick-launch strip, cards, footer — and
//      no section is stacked on it;
//   2. there is one card per page, Announcements first;
//   3. a card opens its page at the top, with the strip that names it;
//      "All pages" and the browser's Back button return to the cards;
//   4. every old address (/#pricing, /#firebase-dashboard, …) opens its page;
//   5. every section page shows its content, with no error and no sideways
//      scroll, on a laptop and on a phone;
//   6. the filter box narrows the cards;
//   7. menu links, the footer and the Quick Links drawer land on pages;
//   8. the four pages with their own header wear the glass board, in both
//      themes, and their Back button returns to the cards.
//
//   node scripts/verify_pages.mjs
//   PAGES_DIST=dir     serve another folder (default ../dist)
//   PAGES_SHOTS=dir    also save screenshots
//   PW_CHROMIUM=/path  use this Chromium binary (with playwright-core)
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import('playwright').catch(() => import('playwright-core'));

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(process.env.PAGES_DIST || join(HERE, '..', 'dist'));
const SHOTS = process.env.PAGES_SHOTS ? resolve(process.env.PAGES_SHOTS) : null;
const PORT = 8967;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

// The map of pages, read from the source so this file cannot drift from it.
const mapSrc = await readFile(join(HERE, '..', 'src', 'lib', 'sitePages.ts'), 'utf8');
const PAGES = [...mapSrc.matchAll(/\{ id: '([a-z0-9-]+)', title: '([^']+)', blurb: '[^']*', group: '([a-z]+)', icon: '[a-z]+', kind: '(section|standalone)'/g)]
  .map(([, id, title, group, kind]) => ({ id, title, group, kind }));
const SECTION_PAGES = PAGES.filter((p) => p.kind === 'section');
const STANDALONE = PAGES.filter((p) => p.kind === 'standalone');

const server = createServer(async (req, res) => {
  let path = decodeURIComponent((req.url || '/').split('?')[0]);
  if (path.endsWith('/')) path += 'index.html';
  const file = join(DIST, normalize(path));
  if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
  try {
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(PORT, '127.0.0.1', done));

let passed = 0;
let failed = 0;
const check = (ok, label, detail = '') => {
  if (ok) passed++; else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail !== '' ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--no-sandbox', '--disable-gpu', '--single-process', '--no-zygote'],
});

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const TOKEN = `${b64u({ alg: 'none' })}.${b64u({ user_id: 'teacher-1', email: 'bora@school.edu.kh', email_verified: true })}.sig`;

/** A fake announcements feed, so the first card can be checked offline. */
const FEED = JSON.stringify({
  documents: [
    { name: 'p/announcements/a1', fields: { title: { stringValue: 'Term 2 timetable is out' }, createdAt: { timestampValue: new Date(Date.now() - 2 * 86400e3).toISOString() }, pinned: { booleanValue: false } } },
    { name: 'p/announcements/a2', fields: { title: { stringValue: 'Welcome to the new CMC' }, createdAt: { timestampValue: '2026-01-05T00:00:00Z' }, pinned: { booleanValue: true } } },
    { name: 'p/announcements/a3', fields: { title: { stringValue: 'Mock test week' }, createdAt: { timestampValue: new Date(Date.now() - 9 * 86400e3).toISOString() }, pinned: { booleanValue: false } } },
    { name: 'p/announcements/a4', fields: { title: { stringValue: 'An older note' }, createdAt: { timestampValue: '2026-02-01T00:00:00Z' }, pinned: { booleanValue: false } } },
  ],
});

async function open(path, { who = 'visitor', theme = 'dark', width = 1366, height = 860 } = {}) {
  // serviceWorkers 'block': the sandboxed single-process Chromium dies when a
  // second context registers the site's service worker. It also shares
  // localStorage between contexts, so every page sets or clears its own keys.
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width, height } });
  await context.addInitScript(([token, who, theme]) => {
    try {
      const keys = { 'cmc-student-token': token, 'cmc-student-token-expires': String(Date.now() + 3600e3), 'cmc-student-role': 'teacher', 'cmc-student-email': 'bora@school.edu.kh', 'cmc-student-name': 'Bora', 'cmc-student-uid': 'teacher-1' };
      for (const [k, v] of Object.entries(keys)) { if (who === 'teacher') localStorage.setItem(k, v); else localStorage.removeItem(k); }
      localStorage.setItem('cmc-theme', theme);
    } catch { /* storage blocked */ }
  }, [TOKEN, who, theme]);
  const page = await context.newPage();
  const problems = [];
  const feedRequests = [];
  page.on('pageerror', (e) => problems.push(String(e)));
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(ORIGIN)) return route.continue();
    if (/firestore\.googleapis\.com\/.*\/announcements\?/.test(url) && /mask\.fieldPaths=title/.test(url)) {
      feedRequests.push(url);
      return route.fulfill({ contentType: 'application/json', body: FEED });
    }
    return route.abort();
  });
  await page.goto(`${ORIGIN}${path}`, { waitUntil: 'load' });
  await page.waitForSelector('.cmc-app', { timeout: 20000 });
  return { page, problems, feedRequests, close: () => page.close() };
}

const routeOf = (page) => page.evaluate(() => document.querySelector('.cmc-app')?.getAttribute('data-route') ?? '');
const scrollY = (page) => page.evaluate(() => Math.round(window.scrollY));
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const pageHeight = (page) => page.evaluate(() => document.documentElement.scrollHeight);
const waitRoute = (page, id) => page.waitForFunction((id) => document.querySelector('.cmc-app')?.getAttribute('data-route') === id, id, { timeout: 15000 }).then(() => true, () => false);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) }); };

/** Waits until a section page has real content (its lazy chunk has rendered). */
async function waitBody(page) {
  return page.waitForFunction(() => {
    const body = document.querySelector('.cmc-page-body');
    return !!body && (body.textContent || '').trim().length > 80 && !!body.querySelector('h1, h2, h3');
  }, null, { timeout: 30000 }).then(() => true, () => false);
}

// ── 1 + 2 · the home page ────────────────────────────────────────────
{
  const { page, problems, feedRequests, close } = await open('/');
  await page.waitForSelector('.cmc-directory .cmc-page-card', { timeout: 20000 });
  check(await routeOf(page) === 'home', 'the home page opens with no hash');

  const cards = await page.$$eval('.cmc-directory .cmc-page-card', (els) => els.map((el) => ({ id: el.getAttribute('data-page'), href: el.getAttribute('href') })));
  check(cards.length === PAGES.length, 'one card per page', `${cards.length} cards, ${PAGES.length} pages`);
  check(cards.every((card, i) => card.id === PAGES[i].id && card.href === `#${PAGES[i].id}`), 'cards are in map order and link to their page');
  check(cards[0]?.id === 'announcements', 'Announcements is the first card');

  const groups = await page.$$eval('.cmc-directory-group', (els) => els.map((el) => el.getAttribute('data-group')));
  check(groups[0] === 'news' && groups.length === 5, 'five groups of cards, News first', groups.join(', '));

  // Home is short. The one-page home was 21 595 px tall at this window size.
  const height = await pageHeight(page);
  check(height < 3600, 'the home page is short', `${height} px (was 21595)`);
  check(await page.locator('main .cmc-section').count() === 0, 'no section is stacked on the home page');
  const directoryTop = await page.$eval('#sections', (el) => Math.round(el.getBoundingClientRect().top + window.scrollY));
  check(directoryTop < 1300, 'the cards start within a screen and a half', `${directoryTop} px`);
  check(await overflow(page) <= 0, 'home page: no sideways scroll');

  // The first card shows the newest posts, pinned first.
  await page.waitForSelector('.cmc-page-card--news .cmc-page-card-post', { timeout: 15000 }).catch(() => {});
  const posts = await page.$$eval('.cmc-page-card--news .cmc-page-card-post', (els) => els.map((el) => el.textContent.trim()));
  check(posts.length === 3, 'the Announcements card lists three posts', String(posts.length));
  check(/Welcome to the new CMC/.test(posts[0] || '') && /pinned/.test(posts[0] || ''), 'the pinned post is first', posts[0]);
  check(/Term 2 timetable is out/.test(posts[1] || '') && /2 days ago/.test(posts[1] || ''), 'then the newest, with its age', posts[1]);
  check(feedRequests.length === 1 && !/body|imageUrl/.test(feedRequests[0]), 'one small request, without post bodies or pictures');
  await shot(page, 'pages-home');

  // ── 6 · the filter box ──
  await page.fill('.cmc-directory-search input', 'toefl');
  const found = await page.$$eval('.cmc-directory .cmc-page-card', (els) => els.map((el) => el.getAttribute('data-page')));
  check(found.length >= 3 && found.length < PAGES.length && found.every((id) => /toefl/.test(id)), 'typing "toefl" leaves the TOEFL cards', found.join(', '));
  await page.fill('.cmc-directory-search input', 'zzzz');
  check(await page.locator('.cmc-directory .cmc-page-card').count() === 0 && await page.locator('.cmc-directory-empty').count() === 1, 'no match: a message and a way back');
  await page.click('.cmc-directory-empty button');
  check(await page.locator('.cmc-directory .cmc-page-card').count() === PAGES.length, 'the way back shows every card again');

  // ── 3 · a card opens its page ──
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.click('.cmc-page-card[data-page="pricing"]');
  check(await waitRoute(page, 'pricing'), 'the Pricing card opens the Pricing page');
  check(page.url().endsWith('#pricing'), 'the address is /#pricing');
  check(await scrollY(page) === 0, 'the page opens at its top', `scrollY ${await scrollY(page)}`);
  check(await waitBody(page), 'the Pricing page shows its content');
  check((await page.textContent('.cmc-page-bar-crumb strong')) === 'Pricing', 'the strip names the page');
  check(/Pricing/.test(await page.title()), 'so does the tab title', await page.title());
  check(await page.locator('.cmc-directory').count() === 0 && await page.locator('.cmc-hero').count() === 0, 'the hero and the cards are not on a section page');
  check(await page.locator('.cmc-page-more .cmc-page-card').count() >= 3, 'the neighbouring pages are offered at the foot');
  await shot(page, 'pages-pricing');

  // next / previous
  await page.click('.cmc-page-bar-steps a:last-child');
  check(await waitRoute(page, 'faq'), '"next" goes to the next card (Questions & answers)');
  check(await scrollY(page) === 0, 'and opens at its top');
  await page.click('.cmc-page-bar-steps a:first-child');
  check(await waitRoute(page, 'pricing'), '"previous" goes back one');

  // an anchor inside the page keeps the page
  await page.evaluate(() => { window.location.hash = 'privacy-notice'; });
  await page.waitForTimeout(400);
  check(await routeOf(page) === 'pricing', '#privacy-notice (footer) keeps the page that is open');

  // All pages → the cards
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('.cmc-page-bar-back');
  check(await waitRoute(page, 'home'), '"All pages" returns to the home page');
  await page.waitForSelector('#sections');
  const top = await page.$eval('#sections', (el) => Math.round(el.getBoundingClientRect().top));
  check(top >= 0 && top < 200, 'with the cards at the top of the window', `${top} px from the top`);

  // Back / forward
  await page.goBack();
  check(await waitRoute(page, 'pricing'), 'the Back button returns to the page');
  check(page.url().endsWith('#privacy-notice'), 'to the footer anchor it was left at', page.url().replace(ORIGIN, ''));
  await page.goForward();
  check(await waitRoute(page, 'home'), 'and Forward to the cards');

  // ── 7 · menu, footer, drawer ──
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('nav[aria-label="Primary"] a[href="#toefl-ibt-mock"]');
  check(await waitRoute(page, 'toefl-ibt-mock'), 'menu: TOEFL iBT opens its page');
  check(await waitBody(page), 'which shows its content');
  await page.click('footer a[href="#resources"]');
  check(await waitRoute(page, 'resources'), 'footer: Assignment library opens the Resource library page');
  check(await scrollY(page) === 0, 'at its top, not at the footer');
  await page.click('header a[href="#top"]');
  check(await waitRoute(page, 'home') && await scrollY(page) === 0, 'the logo returns to the top of the home page');

  await page.click('button[title="Open Quick Navigation Menu"]');
  const drawerItem = page.locator('button.w-full.text-left').filter({ hasText: 'Kid Program · Grades 5–12' }).first();
  const inDrawer = await drawerItem.waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false);
  check(inDrawer, 'Quick Links: the drawer lists Kid Program');
  if (inDrawer) {
    await drawerItem.click();
    check(await waitRoute(page, 'kid-grades'), 'Quick Links: Kid Program opens its page');
    check(await scrollY(page) === 0, 'at its top');
  }

  check(problems.length === 0, 'no page errors on the tour', problems.slice(0, 2).join(' | '));
  await close();
}

// ── 4 · old addresses ────────────────────────────────────────────────
{
  const { page, problems, close } = await open('/#pricing');
  check(await waitRoute(page, 'pricing') && await waitBody(page), 'a direct link to /#pricing opens the page');
  check(await scrollY(page) === 0, 'at its top');
  for (const [hash, id] of [['firebase-dashboard', 'live-results'], ['blog', 'announcements'], ['toefl-mini-test', 'toefl-mini-test'], ['sections', 'home'], ['top', 'home']]) {
    await page.evaluate((hash) => { window.location.hash = hash; }, hash);
    check(await waitRoute(page, id), `/#${hash} opens ${id === 'home' ? 'the home page' : id}`);
  }
  check(problems.length === 0, 'no page errors', problems.slice(0, 2).join(' | '));
  await close();
}

// ── 5 · every section page, laptop and phone ─────────────────────────
for (const [label, size] of [['laptop', { width: 1366, height: 860 }], ['phone', { width: 393, height: 852 }]]) {
  const { page, problems, close } = await open('/', { who: 'teacher', ...size });
  await page.waitForSelector('.cmc-directory .cmc-page-card', { timeout: 20000 });
  check(await overflow(page) <= 0, `${label}: home page has no sideways scroll`);
  if (label === 'phone') {
    const height = await pageHeight(page);
    check(height < 6200, 'phone: the home page is short', `${height} px`);
    await shot(page, 'pages-home-phone');
  }
  const broken = [];
  for (const p of SECTION_PAGES) {
    await page.evaluate((id) => { window.location.hash = id; }, p.id);
    const opened = await waitRoute(page, p.id);
    const shown = opened && await waitBody(page);
    const state = await page.evaluate(() => ({
      y: Math.round(window.scrollY),
      over: document.documentElement.scrollWidth - window.innerWidth,
      failed: /This section could not be loaded\./.test(document.querySelector('.cmc-page-body')?.textContent || ''),
      name: document.querySelector('.cmc-page-bar-crumb strong')?.textContent || '',
    }));
    const ok = opened && shown && state.y === 0 && state.over <= 0 && !state.failed && state.name === p.title;
    if (!ok) broken.push(`${p.id} ${JSON.stringify({ opened, shown, ...state })}`);
  }
  check(broken.length === 0, `${label}: all ${SECTION_PAGES.length} section pages open at the top, show content and fit the width`, broken.join(' ; '));
  check(problems.length === 0, `${label}: no page errors on any section page`, problems.slice(0, 2).join(' | '));
  await close();
}

// ── 8 · pages with their own header ──────────────────────────────────
for (const theme of ['dark', 'light']) {
  const { page, problems, close } = await open('/', { who: 'teacher', theme });
  await page.waitForSelector('.cmc-directory .cmc-page-card', { timeout: 20000 });
  const bad = [];
  for (const p of STANDALONE) {
    await page.evaluate((id) => { window.location.hash = id; }, p.id);
    const ready = await page.waitForSelector('.cmc-subpage .cmc-board .cmc-board-title', { timeout: 20000 }).then(() => true, () => false);
    const state = ready ? await page.evaluate(() => {
      const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
      const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const title = document.querySelector('.cmc-board-title');
      const main = document.querySelector('.cmc-subpage');
      const pane = document.querySelector('.cmc-board-pane');
      return {
        y: Math.round(window.scrollY),
        over: document.documentElement.scrollWidth - window.innerWidth,
        bar: !!document.querySelector('.cmc-subbar .cmc-subbar-back'),
        toggle: !!document.querySelector('.cmc-subbar button[aria-label*="theme" i], .cmc-subbar button[title*="theme" i], .cmc-subbar button[aria-pressed]'),
        titleLum: Number(lum(rgb(getComputedStyle(title).color)).toFixed(2)),
        titleWeight: getComputedStyle(title).fontWeight,
        mainBg: getComputedStyle(main).backgroundColor,
        blur: /blur/.test(getComputedStyle(pane).backdropFilter || getComputedStyle(pane).webkitBackdropFilter || ''),
        art: /glass-hero-(dark|light)/.exec(getComputedStyle(document.querySelector('.cmc-board-art')).backgroundImage)?.[1] || '',
      };
    }) : null;
    const ok = !!state && state.y === 0 && state.over <= 0 && state.bar && state.blur
      && state.art === theme && state.titleWeight === '300'
      && /rgba\(0, 0, 0, 0\)|transparent/.test(state.mainBg)
      && (theme === 'dark' ? state.titleLum > 0.8 : state.titleLum < 0.2);
    if (!ok) bad.push(`${p.id} ${JSON.stringify(state)}`);
    if (p.id === 'games') await shot(page, `pages-games-${theme}`);
  }
  check(bad.length === 0, `${theme}: Play Lab, Brain Lounge, Teacher Tools and News wear the glass board`, bad.join(' ; '));
  await page.click('.cmc-subbar-back');
  check(await waitRoute(page, 'home'), `${theme}: their Back button returns to the home page`);
  const top = await page.$eval('#sections', (el) => Math.round(el.getBoundingClientRect().top)).catch(() => -1);
  check(top >= 0 && top < 200, `${theme}: at the cards`, `${top} px from the top`);
  check(problems.length === 0, `${theme}: no page errors`, problems.slice(0, 2).join(' | '));
  await close();
}

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
