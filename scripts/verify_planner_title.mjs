// TOEFL ITP Bi-Weekly Planner heading as particles — browser check.
//
// Owner request: "make a change to the weekly toefl text like in the hero
// area". The heading of the planner section on the home page (teachers only)
// is drawn as dots by the same effect as the hero title
// (src/lib/titleParticles.ts through src/hooks/useTitleParticles.ts).
// This loads the built site as a signed-in teacher and checks:
//
//   1. the heading switches to dots and keeps its text, id and section name;
//   2. dots are where the letters are, line 1 plain, line 2 in the colours of
//      the gradient text, left to right;
//   3. the cursor pushes the dots apart and they come home again;
//   4. the light theme uses ink and the deeper gradient;
//   5. the canvas takes no clicks ("Open the planner" still works);
//   6. with "reduce motion" the plain heading stays and no canvas is drawn;
//   7. a visitor who is not a teacher gets no canvas at all;
//   8. no page errors, no three.js / WebGL warnings.
//
//   node scripts/verify_planner_title.mjs
//   PLANNER_DIST=dir   serve another folder (default ../dist)
//   PLANNER_SHOTS=dir  also save screenshots
//   PW_CHROMIUM=/path  use this Chromium binary (with playwright-core)
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import('playwright').catch(() => import('playwright-core'));

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(process.env.PLANNER_DIST || join(HERE, '..', 'dist'));
const SHOTS = process.env.PLANNER_SHOTS ? resolve(process.env.PLANNER_SHOTS) : null;
const PORT = 8963;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

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

/** The home page, scrolled to the planner. `who`: 'teacher' or 'visitor'. */
async function open({ who = 'teacher', theme = 'dark', width = 1280, height = 900, reducedMotion = 'no-preference' } = {}) {
  // serviceWorkers 'block': the sandboxed single-process Chromium dies when a
  // second context registers the site's service worker. It also shares
  // localStorage between contexts, so every page sets or clears its own keys.
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width, height }, reducedMotion });
  await context.addInitScript(([token, who, theme]) => {
    try {
      const keys = { 'cmc-student-token': token, 'cmc-student-token-expires': String(Date.now() + 3600e3), 'cmc-student-role': 'teacher', 'cmc-student-email': 'bora@school.edu.kh', 'cmc-student-name': 'Bora', 'cmc-student-uid': 'teacher-1' };
      for (const [k, v] of Object.entries(keys)) { if (who === 'teacher') localStorage.setItem(k, v); else localStorage.removeItem(k); }
      localStorage.setItem('cmc-theme', theme);
    } catch { /* storage blocked */ }
  }, [TOKEN, who, theme]);
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(String(e)));
  page.on('console', (m) => {
    const text = m.text();
    if (m.type() === 'warning' && /THREE|WebGL/.test(text) && !/ReadPixels/.test(text)) problems.push(`warning: ${text}`);
  });
  await page.route('**/*', (route) => (route.request().url().startsWith(ORIGIN) ? route.continue() : route.abort()));
  await page.goto(`${ORIGIN}/`, { waitUntil: 'load' });
  await page.waitForSelector('#toefl-itp-planner', { state: 'attached', timeout: 20000 });
  await page.evaluate(() => document.getElementById('toefl-itp-planner').scrollIntoView({ block: 'start' }));
  return { page, problems };
}

/** Puts the heading mid-screen and waits until nothing moves any more. */
async function settle(page) {
  await page.evaluate(() => document.getElementById('biweek-title').scrollIntoView({ block: 'center' }));
  await page.mouse.move(2, 2);
  await page.waitForTimeout(2600);
}

/** What is painted over each line of the heading: counts of coloured pixels. */
async function linesPainted(page) {
  const rects = await page.evaluate(() => [...document.querySelectorAll('#biweek-title .cmc-dots-line')].map((s) => { const r = s.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }));
  const out = [];
  for (const r of rects) {
    const clip = { x: Math.floor(r.x), y: Math.floor(r.y), width: Math.ceil(r.width), height: Math.ceil(r.height) };
    const png = (await page.screenshot({ clip })).toString('base64');
    out.push(await page.evaluate(async (data) => {
      const img = await new Promise((done) => { const i = new Image(); i.onload = () => done(i); i.src = `data:image/png;base64,${data}`; });
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      // the page behind the heading is the most common colour of the top row
      const bg = [d[0], d[1], d[2]];
      const half = [{ n: 0, r: 0, g: 0, b: 0 }, { n: 0, r: 0, g: 0, b: 0 }];
      let minX = Infinity, maxX = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) < 150) continue;
        const h = half[x < c.width / 2 ? 0 : 1];
        h.n++; h.r += d[i]; h.g += d[i + 1]; h.b += d[i + 2];
        if (x < minX) minX = x; if (x > maxX) maxX = x;
      }
      const avg = (h) => (h.n ? [h.r / h.n, h.g / h.n, h.b / h.n].map(Math.round) : null);
      return { painted: half[0].n + half[1].n, left: avg(half[0]), right: avg(half[1]), spanOfWidth: maxX < 0 ? 0 : (maxX - minX) / c.width };
    }, png));
  }
  return out;
}

// ── 1–3, 5, 8: teacher, dark page ────────────────────────────────────────
{
  const { page, problems } = await open();
  await page.waitForSelector('#biweek-title', { timeout: 20000 });
  const plain = await page.evaluate(() => { const h = document.getElementById('biweek-title'); return { dots: h.classList.contains('cmc-dots-on'), lines: h.querySelectorAll('.cmc-dots-line').length }; });
  check(plain.lines === 2, 'the heading has its two lines as real text', `${plain.lines} lines`);
  const on = await page.waitForSelector('#biweek-title.cmc-dots-on', { timeout: 45000 }).then(() => true, () => false);
  check(on, 'the heading switches to dots when the section is on screen');
  await settle(page);
  const state = await page.evaluate(() => {
    const h = document.getElementById('biweek-title'), s = document.getElementById('toefl-itp-planner'), c = s.querySelector('canvas.cmc-title-canvas');
    return { text: [...h.querySelectorAll('.cmc-dots-line')].map((x) => x.textContent), labelled: s.getAttribute('aria-labelledby'), tag: h.tagName,
      opacity: [...h.querySelectorAll('.cmc-dots-line')].map((x) => getComputedStyle(x).opacity), display: [...h.querySelectorAll('.cmc-dots-line')].map((x) => getComputedStyle(x).visibility),
      canvas: c ? { hidden: c.getAttribute('aria-hidden'), events: getComputedStyle(c).pointerEvents, covers: Math.abs(c.clientWidth - s.clientWidth) < 2 && Math.abs(c.clientHeight - s.clientHeight) < 2 } : null };
  });
  check(state.tag === 'H2' && state.text.join(' ') === 'TOEFL ITP Bi-Weekly Planner.' && state.labelled === 'biweek-title', 'the <h2> keeps its text and still names the section', state.text.join(' / '));
  check(state.opacity.every((o) => o === '0') && state.display.every((v) => v === 'visible'), 'the letters are hidden from the eye only', `opacity ${state.opacity.join(',')}`);
  check(!!state.canvas && state.canvas.hidden === 'true' && state.canvas.events === 'none' && state.canvas.covers, 'the canvas covers the section, is hidden from screen readers and takes no clicks');

  const rest = await linesPainted(page);
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'planner-dark.png') });
  check(rest.length === 2 && rest.every((l) => l.painted > 400 && l.spanOfWidth > 0.9), 'dots are drawn across the full width of both lines', rest.map((l) => `${l.painted}px over ${Math.round(l.spanOfWidth * 100)}%`).join(' · '));
  const [one, two] = rest;
  const grey = (c) => !!c && Math.max(...c) - Math.min(...c) < 26;
  check(grey(one.left) && grey(one.right) && one.left[0] > 150, 'line 1 rests in the plain letter colour (near white)', `${one.left} | ${one.right}`);
  // gradient: cyan and teal on the left half (green well above red, blue no
  // higher than green), turning indigo on the right half (blue above green)
  check(!!two.left && !!two.right && two.left[1] - two.left[0] > 25 && two.left[2] - two.left[1] < 8 && two.right[2] - two.right[1] > 15, 'line 2 runs from teal on the left to indigo on the right', `${two.left} → ${two.right}`);

  // the cursor opens a clearing; the dots come home when it leaves
  const box = await page.evaluate(() => { const r = document.querySelector('#biweek-title .cmc-dots-line').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.move(box.x + box.w * 0.3, box.y + box.h * 0.5, { steps: 6 });
  await page.waitForTimeout(600);
  const pushed = await linesPainted(page);
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'planner-hover.png') });
  await page.mouse.move(2, 2, { steps: 4 });
  // home within a second or two on an idle machine; a loaded one is later
  let back = [];
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(2000);
    back = await linesPainted(page);
    if (Math.abs(back[0].painted - one.painted) <= one.painted * 0.02) break;
  }
  check(Math.abs(pushed[0].painted - one.painted) > one.painted * 0.04, 'the cursor pushes the dots of the first line apart', `${one.painted} → ${pushed[0].painted} px on the line`);
  check(Math.abs(back[0].painted - one.painted) <= one.painted * 0.02, 'the dots come home when the cursor leaves', `${back[0].painted} px (was ${one.painted})`);

  const href = await page.evaluate(() => { const a = document.querySelector('#toefl-itp-planner a[aria-label="Open the TOEFL ITP Bi-Weekly Planner"]'); const r = a.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { hit: a === top || a.contains(top), href: a.getAttribute('href') }; });
  check(href.hit && href.href === './biweek-planner/', '"Open the planner" is still the thing under the cursor', href.href);
  check(problems.length === 0, 'no page errors or WebGL warnings (dark)', problems.join(' | ').slice(0, 200));
}

// ── 4: light page ────────────────────────────────────────────────────────
{
  const { page, problems } = await open({ theme: 'light' });
  const on = await page.waitForSelector('#biweek-title.cmc-dots-on', { timeout: 45000 }).then(() => true, () => false);
  await settle(page);
  const [one, two] = on ? await linesPainted(page) : [{}, {}];
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'planner-light.png') });
  check(on && !!one.left && Math.max(...one.left) < 110, 'light page: line 1 is drawn in ink', on ? `${one.left}` : 'no dots');
  check(on && !!two.left && !!two.right && two.left[2] > two.left[0] + 40 && two.right[0] > two.left[0] + 20, 'light page: line 2 uses the deeper gradient', on ? `${two.left} → ${two.right}` : 'no dots');
  check(problems.length === 0, 'no page errors or WebGL warnings (light)', problems.join(' | ').slice(0, 200));
}

// ── phone ────────────────────────────────────────────────────────────────
{
  const { page } = await open({ width: 393, height: 852 });
  const on = await page.waitForSelector('#biweek-title.cmc-dots-on', { timeout: 45000 }).then(() => true, () => false);
  await settle(page);
  const lines = on ? await linesPainted(page) : [];
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'planner-phone.png') });
  check(on && lines.length === 2 && lines.every((l) => l.painted > 150 && l.spanOfWidth > 0.9) && overflow <= 0, 'phone (393 px): both lines are drawn, the page does not scroll sideways', lines.map((l) => `${l.painted}px`).join(' · '));
}

// ── 6: reduce motion ─────────────────────────────────────────────────────
{
  const { page } = await open({ reducedMotion: 'reduce' });
  await page.waitForSelector('#biweek-title', { timeout: 20000 });
  await settle(page);
  const s = await page.evaluate(() => { const h = document.getElementById('biweek-title'); return { dots: h.classList.contains('cmc-dots-on'), opacity: [...h.querySelectorAll('.cmc-dots-line')].map((x) => getComputedStyle(x).opacity), fetched: performance.getEntriesByType('resource').some((r) => /three\.module|titleParticles/.test(r.name)) }; });
  check(!s.dots && s.opacity.every((o) => o === '1') && !s.fetched, 'reduce motion: the plain heading stays and three.js is not downloaded', `opacity ${s.opacity.join(',')}`);
}

// ── 7: not a teacher ─────────────────────────────────────────────────────
{
  const { page, problems } = await open({ who: 'visitor' });
  await page.waitForSelector('#toefl-itp-planner .cmc-planner-locked', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const s = await page.evaluate(() => { const sec = document.getElementById('toefl-itp-planner'); return { locked: !!sec.querySelector('.cmc-planner-locked'), heading: !!document.getElementById('biweek-title'), canvas: sec.querySelectorAll('canvas').length }; });
  check(s.locked && !s.heading && s.canvas === 0, 'a visitor sees the sign-in card, with no heading and no canvas', JSON.stringify(s));
  check(problems.length === 0, 'no page errors (visitor)', problems.join(' | ').slice(0, 200));
}

await browser.close();
server.close();
console.log(`\nverify_planner_title: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
