// TOEFL ITP Bi-Weekly Planner PAGE: its title as particles — browser check.
//
// Owner request: "change font in bi weekly to the same as the hero main header
// text". The title of /biweek-planner/ is drawn as dots by the same engine as
// the home page's hero title, with a 2-D canvas instead of three.js
// (public/biweek-planner/title-dots.js, built from src/standalone/
// plannerTitle.ts). This loads the built page as a signed-in teacher and checks:
//
//   1. the title switches to dots and stays a real <h1> with its text;
//   2. dots are where the letters are — line 1 plain, line 2 in the page's
//      gradient, left to right;
//   3. the cursor pushes the dots apart and they come home again;
//   4. the light theme (also when switched with the page's own button) uses
//      ink and the deeper gradient;
//   5. the canvas takes no clicks (the week cards and buttons still work);
//   6. with "reduce motion" the plain title stays and no canvas is added;
//   7. no three.js is downloaded and nothing is reported in the console.
//
//   node scripts/verify_planner_page_title.mjs
//   PAGE_DIST=dir    serve another folder (default ../dist)
//   PAGE_SHOTS=dir   also save screenshots
//   PAGE_FONT=/x/syne.woff2  answer the Google Fonts request with this file
//                    (offline the title falls back to a system font; every
//                    check still holds)
//   PW_CHROMIUM=/path  use this Chromium binary (with playwright-core)
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import('playwright').catch(() => import('playwright-core'));

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(process.env.PAGE_DIST || join(HERE, '..', 'dist'));
const SHOTS = process.env.PAGE_SHOTS ? resolve(process.env.PAGE_SHOTS) : null;
const FONT = process.env.PAGE_FONT ? resolve(process.env.PAGE_FONT) : null;
const PORT = 8964;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

const server = createServer(async (req, res) => {
  let path = decodeURIComponent((req.url || '/').split('?')[0]);
  if (path.endsWith('/')) path += 'index.html';
  const file = path === '/__title-font.woff2' && FONT ? FONT : join(DIST, normalize(path));
  if (file !== FONT && !file.startsWith(DIST)) { res.writeHead(403).end(); return; }
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

/** The planner page as a signed-in teacher. */
async function open({ theme = 'dark', width = 1280, height = 900, reducedMotion = 'no-preference' } = {}) {
  // serviceWorkers 'block': the sandboxed single-process Chromium dies when a
  // second context registers the site's service worker. It also shares
  // localStorage between contexts, so every page sets its own keys.
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width, height }, reducedMotion });
  await context.addInitScript(([token, theme]) => {
    try {
      const keys = { 'cmc-student-token': token, 'cmc-student-token-expires': String(Date.now() + 3600e3), 'cmc-student-role': 'teacher', 'cmc-student-email': 'bora@school.edu.kh', 'cmc-student-name': 'Bora', 'cmc-student-uid': 'teacher-1' };
      for (const [k, v] of Object.entries(keys)) localStorage.setItem(k, v);
      if (!sessionStorage.getItem('theme-set')) { localStorage.setItem('cmc-theme', theme); localStorage.removeItem('biweek-theme'); sessionStorage.setItem('theme-set', '1'); }
    } catch { /* storage blocked */ }
  }, [TOKEN, theme]);
  const page = await context.newPage();
  const problems = [];
  const fetched = [];
  page.on('pageerror', (e) => problems.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) problems.push(`console: ${m.text()}`); });
  page.on('request', (r) => fetched.push(r.url()));
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(ORIGIN)) return route.continue();
    if (FONT && /fonts\.googleapis\.com/.test(url)) {
      return route.fulfill({ contentType: 'text/css', body: `@font-face{font-family:'Syne';font-weight:700 800;src:url(${ORIGIN}/__title-font.woff2) format('woff2')}` });
    }
    return route.abort();
  });
  await page.goto(`${ORIGIN}/biweek-planner/`, { waitUntil: 'load' });
  await page.waitForSelector('.bp-title', { timeout: 20000 });
  return { page, problems, fetched };
}

const dotsOn = (page) => page.waitForSelector('.bp-title.bp-title-as-dots', { timeout: 45000 }).then(() => true, () => false);

/** How many pixels of the canvas are painted. */
const inked = (page) => page.evaluate(() => {
  const c = document.querySelector('.bp-hero canvas.bp-title-canvas');
  if (!c) return -1;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 127) n++;
  return n;
});

/**
 * Parks the cursor away from the title and waits until nothing moves any more:
 * the dots fly in from all over the hero, and how long that takes depends on
 * how busy the machine is.
 */
async function settle(page) {
  await page.mouse.move(2, 2);
  let last = -2;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1200);
    const now = await inked(page);
    if (now === last && now > 0) return;
    last = now;
  }
}

/**
 * What the CANVAS shows over each line of the title (the hero photo behind it
 * would spoil a screenshot): counts and average colours of the painted pixels.
 */
const linesPainted = (page) => page.evaluate(() => {
  const canvas = document.querySelector('.bp-hero canvas.bp-title-canvas');
  if (!canvas) return [];
  const box = canvas.getBoundingClientRect();
  const k = canvas.width / box.width;
  const g = canvas.getContext('2d');
  return [...document.querySelectorAll('.bp-title .bp-title-solid')].map((span) => {
    const r = span.getBoundingClientRect();
    const x0 = Math.max(0, Math.floor((r.left - box.left) * k)), y0 = Math.max(0, Math.floor((r.top - box.top) * k));
    const w = Math.ceil(r.width * k), h = Math.ceil(r.height * k);
    const d = g.getImageData(x0, y0, w, h).data;
    const half = [{ n: 0, r: 0, g: 0, b: 0 }, { n: 0, r: 0, g: 0, b: 0 }];
    let minX = Infinity, maxX = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] < 128) continue;
      const side = half[x < w / 2 ? 0 : 1];
      side.n++; side.r += d[i]; side.g += d[i + 1]; side.b += d[i + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
    }
    const avg = (s) => (s.n ? [s.r / s.n, s.g / s.n, s.b / s.n].map(Math.round) : null);
    return { painted: half[0].n + half[1].n, left: avg(half[0]), right: avg(half[1]), spanOfWidth: maxX < 0 ? 0 : (maxX - minX) / w, area: w * h };
  });
});

// ── 1–3, 5, 7: dark page ─────────────────────────────────────────────────
{
  const { page, problems, fetched } = await open();
  const before = await page.evaluate(() => ({ locked: !!document.querySelector('.cmc-teacher-gate, #cmcTeacherGate'), lines: document.querySelectorAll('.bp-title .bp-title-solid').length }));
  check(before.lines === 2, 'the title has its two lines as real text', `${before.lines} lines`);
  const on = await dotsOn(page);
  check(on, 'the title switches to dots');
  await settle(page);
  const state = await page.evaluate(() => {
    const h = document.querySelector('.bp-title'), s = document.querySelector('.bp-hero'), c = s.querySelector('canvas.bp-title-canvas');
    const solid = [...h.querySelectorAll('.bp-title-solid')];
    return { tag: h.tagName, text: solid.map((x) => x.textContent), font: getComputedStyle(h).fontFamily, weight: getComputedStyle(h).fontWeight,
      opacity: solid.map((x) => getComputedStyle(x).opacity), visibility: solid.map((x) => getComputedStyle(x).visibility),
      echo: getComputedStyle(h.querySelector('.bp-title-echo')).opacity, h1s: document.querySelectorAll('h1').length,
      canvas: c ? { hidden: c.getAttribute('aria-hidden'), events: getComputedStyle(c).pointerEvents, covers: Math.abs(c.clientWidth - s.clientWidth) < 2 && Math.abs(c.clientHeight - s.clientHeight) < 2, count: s.querySelectorAll('canvas').length } : null };
  });
  check(state.tag === 'H1' && state.h1s === 1 && state.text.join(' ') === 'TOEFL ITP Bi-Weekly Planner', 'the <h1> keeps its text', state.text.join(' / '));
  check(/^["']?Syne/.test(state.font) && state.weight === '800', 'the title is set in the hero lettering (Syne 800)', `${state.font} ${state.weight}`);
  check(state.opacity.every((o) => o === '0') && state.visibility.every((v) => v === 'visible'), 'the letters are hidden from the eye only', `opacity ${state.opacity.join(',')}`);
  check(Math.abs(Number(state.echo) - 0.28) < 0.02, 'the outline echo stays faintly behind the dots, as in the hero', `opacity ${state.echo}`);
  check(!!state.canvas && state.canvas.count === 1 && state.canvas.hidden === 'true' && state.canvas.events === 'none' && state.canvas.covers, 'one canvas covers the hero, is hidden from screen readers and takes no clicks');

  const rest = await linesPainted(page);
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'page-dark.png') });
  check(rest.length === 2 && rest.every((l) => l.painted > 400 && l.spanOfWidth > 0.9), 'dots are drawn across the full width of both lines', rest.map((l) => `${l.painted}px over ${Math.round(l.spanOfWidth * 100)}%`).join(' · '));
  const [one, two] = rest;
  const grey = (c) => !!c && Math.max(...c) - Math.min(...c) < 26;
  check(grey(one.left) && grey(one.right) && one.left[0] > 200, 'line 1 rests in the plain letter colour (near white)', `${one.left} | ${one.right}`);
  check(!!two.left && !!two.right && two.left[1] - two.left[0] > 25 && two.left[2] - two.left[1] < 12 && two.right[2] - two.right[1] > 8, 'line 2 runs from cyan and teal on the left towards indigo on the right', `${two.left} → ${two.right}`);

  // the cursor opens a clearing; the dots come home when it leaves
  const box = await page.evaluate(() => { const r = document.querySelector('.bp-title-row--accent .bp-title-solid').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.move(box.x + box.w * 0.3, box.y + box.h * 0.5, { steps: 6 });
  await page.waitForTimeout(600);
  const pushed = await linesPainted(page);
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'page-hover.png') });
  await page.mouse.move(2, 2, { steps: 4 });
  // home within a second or two on an idle machine; a loaded one is later
  let back = [];
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(2000);
    back = await linesPainted(page);
    if (Math.abs(back[1].painted - two.painted) <= two.painted * 0.02) break;
  }
  check(Math.abs(pushed[1].painted - two.painted) > two.painted * 0.04, 'the cursor pushes the dots of the second line apart', `${two.painted} → ${pushed[1].painted} px on the line`);
  check(Math.abs(back[1].painted - two.painted) <= two.painted * 0.02, 'the dots come home when the cursor leaves', `${back[1].painted} px (was ${two.painted})`);

  // nothing on the screen lost its clicks (the buttons at the top lie over the hero)
  const hits = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('a[href], button')) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth || getComputedStyle(el).visibility !== 'visible') continue;
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      out.push(el === top || el.contains(top));
    }
    return out;
  });
  check(hits.length > 0 && hits.every(Boolean), 'every link and button on the screen is still the thing under the cursor', `${hits.filter(Boolean).length} of ${hits.length}`);

  // the page's own theme button re-inks the dots without a reload
  await page.evaluate(() => window.toggleTheme());
  await page.waitForTimeout(1500);
  const flipped = await linesPainted(page);
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'page-switched.png') });
  check(!!flipped[0]?.left && Math.max(...flipped[0].left) < 110, 'switching to the light theme with the page button turns line 1 to ink', `${flipped[0]?.left}`);
  await page.evaluate(() => window.toggleTheme());

  check(!fetched.some((u) => /three/i.test(u)), 'three.js is not downloaded for this page', `${fetched.filter((u) => /\.js(\?|$)/.test(u)).length} scripts`);
  check(problems.length === 0, 'no page errors (dark)', problems.join(' | ').slice(0, 200));
}

// ── 4: light page ────────────────────────────────────────────────────────
{
  const { page, problems } = await open({ theme: 'light' });
  const on = await dotsOn(page);
  await settle(page);
  const [one, two] = on ? await linesPainted(page) : [{}, {}];
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'page-light.png') });
  check(on && !!one.left && Math.max(...one.left) < 110, 'light page: line 1 is drawn in ink', on ? `${one.left}` : 'no dots');
  check(on && !!two.left && !!two.right && two.left[2] > two.left[0] + 40 && two.right[0] > two.left[0] + 20, 'light page: line 2 uses the deeper gradient', on ? `${two.left} → ${two.right}` : 'no dots');
  check(problems.length === 0, 'no page errors (light)', problems.join(' | ').slice(0, 200));
}

// ── phone ────────────────────────────────────────────────────────────────
{
  const { page } = await open({ width: 393, height: 852 });
  const on = await dotsOn(page);
  await settle(page);
  const lines = on ? await linesPainted(page) : [];
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'page-phone.png') });
  // the second line wraps here ("Bi-Weekly" / "Planner"), so its dots end short of the block's right edge
  check(on && lines.length === 2 && lines.every((l) => l.painted > 150 && l.spanOfWidth > 0.6) && overflow <= 0, 'phone (393 px): both lines are drawn, the page does not scroll sideways', `${lines.map((l) => `${l.painted}px over ${Math.round(l.spanOfWidth * 100)}%`).join(' · ')}, ${overflow}px too wide`);
}

// ── 6: reduce motion ─────────────────────────────────────────────────────
{
  const { page, problems } = await open({ reducedMotion: 'reduce' });
  await page.waitForTimeout(4000);
  const s = await page.evaluate(() => { const h = document.querySelector('.bp-title'); return { dots: h.classList.contains('bp-title-as-dots'), canvas: document.querySelectorAll('.bp-hero canvas').length, opacity: [...h.querySelectorAll('.bp-title-solid')].map((x) => getComputedStyle(x).opacity) }; });
  check(!s.dots && s.canvas === 0 && s.opacity.every((o) => o === '1'), 'reduce motion: the plain title stays and no canvas is added', `opacity ${s.opacity.join(',')}`);
  check(problems.length === 0, 'no page errors (reduce motion)', problems.join(' | ').slice(0, 200));
}

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
