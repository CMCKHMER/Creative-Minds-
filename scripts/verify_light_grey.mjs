// Verify the light-grey site-wide background (owner request, Nov 2026).
// Stage 3: the palette is DEEPENED one slate step (owner: "can't tell the
// difference") — page canvas #cbd5e1 (slate-300), sheets #e2e8f0 (slate-200).
// Static: every light --bg / light body background in public/ is #cbd5e1 and
// the pre-paint layers match. Browser: toggling light mode computes
// rgb(203,213,225) on the page element for each family (React home, games
// page, biweek planner, a biweek test, an rfc worksheet, TOEFL iBT), and dark
// mode is untouched (still its own dark base).
import { chromium } from 'playwright';
import { readFile, readdir } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const PUB = '/home/z/my-project/tmp/cmc-site/public';
const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const PORT = 8965; const BASE = `http://127.0.0.1:${PORT}`;
mkdirSync('/home/z/my-project/tmp/cmc-site/scripts/qa', { recursive: true });
const SHOTS = '/home/z/my-project/tmp/cmc-site/scripts/qa';
const GREY_RGB = 'rgb(203, 213, 225)';

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}${extra ? ' — ' + extra : ''}`); }
};

// ── 1. static sweep across every public page ──────────────────────────────
console.log('static · light backgrounds');
const RE = /--bg:\s*#f8fafc|--bg:\s*#eef2f7|background(-color)?:\s*#eef2f7|background(-color)?:\s*#f8fafc|--bg:\s*#e2e8f0|--s2:\s*#eef2f7|--surface-2:\s*#eef2f7/;
let off = 0, withLight = 0, prePaint = 0;
for (const p of (await readdir(PUB, { recursive: true })).filter((f) => f.endsWith('.html'))) {
  const t = await readFile(join(PUB, p), 'utf8');
  if (/body\.light|data-theme=.light.|html\.light/.test(t)) withLight++;
  if (RE.test(t)) { off++; console.log(`  off-palette: ${p}`); }
  // the rfc pre-paint inline style must also carry the grey (color:#f8fafc
  // TEXT values on dark heroes are legitimate and never flagged)
  if (t.includes('data-cm-pre') && /background(-color)?:\s*(#eef2f7|#f8fafc)/.test(t)) { off++; prePaint++; console.log(`  pre-paint off-palette: ${p}`); }
}
ok(off === 0, `no off-palette light background in any of the pages (${withLight} carry light themes)`);

const pins = [
  ['biweek-planner/tests/diagnostic.html', '--bg:#cbd5e1', 'test page --bg slate-300 grey'],
  ['biweek-planner/index.html', '--bg:#cbd5e1', 'planner --bg slate-300 grey'],
  ['rfc1/dictation.html', '--er:#dc2626;background:#cbd5e1', 'rfc body.light canvas slate-300'],
  ['rfc1/dictation.html', "#cbd5e1!important", 'rfc no-flash layer slate-300'],
  ['toefl-ibt/index.html', 'background: #cbd5e1 !important', 'toefl light body slate-300'],
  ['toefl-ibt/toeflreading-MIGRATED.html', 'background:#cbd5e1!important', 'MIGRATED light body slate-300'],
  ['studio/index.html', 'background:#cbd5e1', 'studio light background slate-300'],
  ['biweek-planner/teacher-gate.js', "var bg = light ? '#cbd5e1' : '#020617';", 'teacher-gate overlay light bg slate-300'],
  ['biweek-planner/student-invite.js', "bg: light ? '#cbd5e1' : '#020617',", 'student-invite overlay light bg slate-300'],
  // stage 2 (owner: the big white SHEETS must go grey too) + stage 3 (deepened)
  ['rfc1/dictation.html', 'body.light .container{background:rgba(226,232,240,.92)', 'rfc1 sheet slate-200 (.92 grey, not white)'],
  ['rfc1/dictation.html', '--s2:#e2e8f0', 'rfc1 --s2 token slate-200'],
  ['rfc3/dictation.html', 'body.light .container{background:rgba(226,232,240,.92)', 'rfc3 sheet slate-200'],
  ['rfc3/dictation.html', '--surface-2:#e2e8f0', 'rfc3 --surface-2 token slate-200'],
  ['rfc2/rfc2dic.html', 'body.light .container{background:rgba(226,232,240,.92)', 'rfc2 sheet slate-200'],
];
for (const [f, needle, label] of pins) {
  const t = await readFile(join(PUB, f), 'utf8');
  ok(t.includes(needle), label);
}

// ── 2. built bundle: React light page base unchanged at slate-200 ─────────
{
  const css = assets => assets.filter(a => a.endsWith('.css'));
  const assets = await readdir(join(DIST, 'assets'));
  let found = false;
  for (const f of css(assets) ) {
    const t = await readFile(join(DIST, 'assets', f), 'utf8');
    if (t.includes('#cbd5e1') && t.includes('html.light')) { found = true; break; }
  }
  ok(found, 'built CSS keeps the html.light #cbd5e1 page base');
  // stage 2: solid Tailwind bg-white greys under the light theme (assignment
  // paper, toggle knob, hover states) + the raised-card token is tinted
  let sheetOverride = false, cardToken = false;
  for (const f of css(assets)) {
    const t = await readFile(join(DIST, 'assets', f), 'utf8');
    if (t.includes('html.light .bg-white{background-color:#e2e8f0}')) sheetOverride = true;
    if (t.includes('--cmc-l-card:#e2e8f0') || t.includes('--cmc-l-card:rgba(226')) cardToken = true;
  }
  ok(sheetOverride, 'built CSS greys solid bg-white under the light theme (slate-200)');
  ok(cardToken, 'built CSS carries the tinted raised-card token');
}

// ── 3. browser: computed page background in light mode ───────────────────
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, BASE).pathname);
    if (p.endsWith('/')) p += 'index.html';
    const data = await readFile(normalize(join(DIST, p)));
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
    res.writeHead(200, { 'Content-Type': types[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(PORT, r));

console.log('browser · computed light-mode backgrounds');
const browser = await chromium.launch();
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const bgOf = async () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  // React home: set the master toggle key before load
  for (const [path, label] of [['/index.html', 'React home'], ['/index.html#games', 'games page']]) {
    await page.addInitScript(() => localStorage.setItem('cmc-theme', 'light'));
    await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
    await page.waitForTimeout(900);
    const bg = await bgOf();
    ok(bg === GREY_RGB, `${label}: light body = ${GREY_RGB}`, bg);
    // the Developer's Picks memorial card must keep DARK card + LIGHT text
    // in light mode (owner report: description invisible on light theme)
    if (path === '/index.html#games') {
      await page.waitForSelector('[aria-labelledby="devpicks-title"]', { timeout: 8000 });
      const c = await page.evaluate(() => {
        const sec = document.querySelector('[aria-labelledby="devpicks-title"]');
        const gc = (el) => (el ? getComputedStyle(el).color : 'missing');
        const find = (txt) => [...sec.querySelectorAll('span')].find((s) => txt.test(s.textContent));
        const heroChip = [...document.querySelectorAll('[data-keep-dark] span')].find((s) => /Learning Games room/i.test(s.textContent));
        const lum = (col) => { const m = col.match(/\d+/g); return m ? +m[0] + +m[1] + +m[2] : 0; };
        return {
          desc: gc(sec.querySelector('p')),
          meta: gc(sec.querySelector('div.border-t')),
          chip: gc(find(/Developer/i)),
          cardBg: getComputedStyle(sec.querySelector('div')).backgroundImage,
          hero: gc(heroChip), heroLum: lum(gc(heroChip)),
        };
      });
      ok(c.desc === 'rgb(203, 213, 225)', `devpick description light on dark card (${c.desc})`, c.desc);
      ok(c.meta === 'rgb(148, 163, 184)', `devpick meta line light (${c.meta})`, c.meta);
      ok(c.chip === 'rgb(253, 230, 138)', `devpick amber chip light (${c.chip})`, c.chip);
      ok(c.cardBg.includes('linear-gradient'), 'devpick card background still the dark gradient');
      ok(c.heroLum > 350, `hero chip text light on dark hero (${c.hero})`, c.hero);
    }
    await page.screenshot({ path: join(SHOTS, `grey-${label.toLowerCase().replace(/\s+/g, '-')}.png`) });
  }
  // static families: flip their own toggles after load
  const staticCases = [
    ['/biweek-planner/index.html', 'planner', 'html[data-theme="light"]'],
    ['/biweek-planner/tests/diagnostic.html', 'biweek test', 'html[data-theme="light"]'],
    ['/rfc1/dictation.html', 'rfc dictation', 'body.light'],
    ['/toefl-ibt/index.html', 'toefl-ibt', 'html[data-theme="light"]'],
  ];
  for (const [path, label, marker] of staticCases) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
    await page.evaluate((m) => {
      if (m === 'body.light') document.body.classList.add('light');
      else document.documentElement.setAttribute('data-theme', 'light');
      try { localStorage.setItem('cmc-theme', 'light'); } catch {}
    }, marker);
    await page.waitForTimeout(400);
    const bg = await bgOf();
    ok(bg === GREY_RGB, `${label}: light body = ${GREY_RGB}`, bg);
    if (label === 'rfc dictation') {
      // stage 2: the big sheet (.container) must compute GREY, not white
      const sheet = await page.evaluate(() => getComputedStyle(document.querySelector('.container')).backgroundColor);
      ok(sheet === 'rgba(226, 232, 240, 0.92)', 'rfc dictation: sheet = grey rgba(226,232,240,.92)', sheet);
    }
    await page.screenshot({ path: join(SHOTS, `grey-${label.toLowerCase().replace(/\s+/g, '-')}.png`) });
  }
  // stage 2: any solid bg-white element computes grey under the light theme
  {
    await page.goto(`${BASE}/index.html#games`, { waitUntil: 'load' });
    await page.waitForTimeout(900);
    const probe = await page.evaluate(() => {
      const el = document.createElement('div');
      el.className = 'bg-white';
      document.body.appendChild(el);
      const c = getComputedStyle(el).backgroundColor;
      el.remove();
      return c;
    });
    ok(probe === 'rgb(226, 232, 240)', 'React light: solid bg-white computes slate-200 grey (assignment paper family)', probe);
  }
  // stage 4 (owner screenshot: the Bi-Weekly Test Scores spreadsheet grid
  // rendered dark in light mode with hard-to-see text — "change the area to
  // white so text can be seen clearly"). The dashboard scores card must
  // compute a WHITE paper surface with dark ink; dark mode keeps the dark card.
  await ctx.route('**firestore.googleapis.com**', (route) => route.abort());
  await ctx.route('**documents:runQuery**', (route) => {
    const body = route.request().postData() || '';
    if (!body.includes('drill_attempts')) return route.abort();
    const doc = (name, pct, correct, total, iso) => ({
      document: { fields: {
        studentName: { stringValue: name }, drillTitle: { stringValue: 'Diagnostic · Week 12' },
        drillSlug: { stringValue: 'diagnostic.html' }, classId: { stringValue: 'Kid 11' },
        scorePct: { integerValue: String(pct) }, correctCount: { integerValue: String(correct) },
        totalCount: { integerValue: String(total) }, submittedAt: { timestampValue: iso },
      } },
    });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        doc('Sok Dara', 44, 4, 9, '2026-11-08T15:43:00Z'),
        doc('Chan Bora', 92, 11, 12, '2026-11-09T09:10:00Z'),
      ]),
    });
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('cmc-student-token', 'x'.repeat(40));
      localStorage.setItem('cmc-student-role', 'teacher');
      localStorage.setItem('cmc-student-uid', 'uid-t');
      localStorage.setItem('cmc-student-name', 'SheetQa');
      localStorage.setItem('cmc-student-email', 't@e.edu');
      localStorage.setItem('cmc-student-verified', '1');
      localStorage.setItem('cmc-student-token-expires', String(Date.now() + 3600000));
    } catch {}
  });
  {
    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    // the dashboard is LazyMount-ed — its chunk downloads only when the mount
    // point nears the viewport, so scroll until the section exists (same
    // recipe as verify_command_center.mjs)
    for (let i = 0; i < 40 && !(await page.evaluate(() => !!document.getElementById('firebase-dashboard'))); i++) {
      await page.evaluate(() => window.scrollBy(0, 900));
      await page.waitForTimeout(300);
    }
    await page.evaluate(() => document.getElementById('firebase-dashboard')?.scrollIntoView({ behavior: 'instant' }));
    await page.waitForSelector('#firebase-dashboard.cmc-cmdc', { timeout: 20000 });
    await page.waitForSelector('.cmc-scores-card table tbody tr', { timeout: 15000 });
    const c = await page.evaluate(() => {
      const card = document.querySelector('.cmc-scores-card');
      const grid = card.querySelector('[class*="max-h-[420px]"]');
      const span = card.querySelector('tbody td span');
      const th = card.querySelector('thead th:nth-child(2)');
      return {
        cardBg: getComputedStyle(card).backgroundColor,
        gridBg: grid ? getComputedStyle(grid).backgroundColor : 'missing',
        cellInk: span ? getComputedStyle(span).color : 'missing',
        headBg: th ? getComputedStyle(th).backgroundColor : 'missing',
        firstCell: span ? span.textContent : 'missing',
      };
    });
    ok(c.cardBg === 'rgb(255, 255, 255)', `scores card: white paper surface in light mode (${c.cardBg})`, c.cardBg);
    ok(c.gridBg === 'rgb(255, 255, 255)', `scores grid: cell area white (${c.gridBg})`, c.gridBg);
    ok(c.cellInk === 'rgb(15, 23, 42)', `scores cells: dark ink (${c.cellInk})`, c.cellInk);
    ok(c.headBg === 'rgb(241, 245, 249)', `scores header rail: light grey (${c.headBg})`, c.headBg);
    ok((c.firstCell || '').includes('Bora') || (c.firstCell || '').includes('Dara'), 'scores grid: fed attempts reached the sheet', c.firstCell);
    const cardEl = await page.$('.cmc-scores-card');
    await cardEl.screenshot({ path: join(SHOTS, 'grey-scores-card.png') });
  }
  // same card in DARK mode: untouched dark surface + light ink
  {
    await page.addInitScript(() => { try { localStorage.setItem('cmc-theme', 'dark'); } catch {} });
    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    // the dashboard is LazyMount-ed — its chunk downloads only when the mount
    // point nears the viewport, so scroll until the section exists (same
    // recipe as verify_command_center.mjs)
    for (let i = 0; i < 40 && !(await page.evaluate(() => !!document.getElementById('firebase-dashboard'))); i++) {
      await page.evaluate(() => window.scrollBy(0, 900));
      await page.waitForTimeout(300);
    }
    await page.evaluate(() => document.getElementById('firebase-dashboard')?.scrollIntoView({ behavior: 'instant' }));
    await page.waitForSelector('#firebase-dashboard.cmc-cmdc', { timeout: 20000 });
    await page.waitForSelector('.cmc-scores-card table tbody tr', { timeout: 15000 });
    const c = await page.evaluate(() => {
      const card = document.querySelector('.cmc-scores-card');
      const grid = card.querySelector('[class*="max-h-[420px]"]');
      const span = card.querySelector('tbody td span');
      return { gridBg: getComputedStyle(grid).backgroundColor, ink: getComputedStyle(span).color };
    });
    ok(/oklab|rgba\(2, 6, 23/.test(c.gridBg), `scores grid: dark mode keeps its dark surface (${c.gridBg})`, c.gridBg);
    ok(/oklch/.test(c.ink) || c.ink === 'rgb(203, 213, 225)', `scores cells: dark mode keeps light ink (${c.ink})`, c.ink);
  }
  // dark untouched: same pages back in dark keep a dark base
  await page.goto(`${BASE}/biweek-planner/tests/diagnostic.html`, { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.setItem('cmc-theme', 'dark'); document.documentElement.setAttribute('data-theme', 'dark'); });
  await page.waitForTimeout(300);
  const darkBg = await bgOf();
  ok(darkBg !== GREY_RGB && darkBg.includes('rgb('), 'biweek test: dark mode still dark', darkBg);
  await ctx.close();
}
await browser.close();
server.close();

console.log(`\nverify_light_grey: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
