// Verify the light-grey site-wide background (owner request, Nov 2026).
// Static: every light --bg / light body background in public/ is #e2e8f0 and
// the pre-paint layers match. Browser: toggling light mode computes
// rgb(226,232,240) on the page element for each family (React home, games
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
const GREY_RGB = 'rgb(226, 232, 240)';

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}${extra ? ' — ' + extra : ''}`); }
};

// ── 1. static sweep across every public page ──────────────────────────────
console.log('static · light backgrounds');
const RE = /--bg:\s*#f8fafc|--bg:\s*#eef2f7|background(-color)?:\s*#eef2f7|background(-color)?:\s*#f8fafc/;
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
  ['biweek-planner/tests/diagnostic.html', '--bg:#e2e8f0', 'test page --bg grey'],
  ['biweek-planner/index.html', '--bg:#e2e8f0', 'planner --bg grey'],
  ['rfc1/dictation.html', 'background:#e2e8f0', 'rfc body.light background grey'],
  ['rfc1/dictation.html', "#e2e8f0!important", 'rfc pre-paint layer grey'],
  ['toefl-ibt/index.html', 'background: #e2e8f0 !important', 'toefl light body grey'],
  ['toefl-ibt/toeflreading-MIGRATED.html', 'background:#e2e8f0!important', 'MIGRATED light body grey'],
  ['studio/index.html', 'background:#e2e8f0', 'studio light background grey'],
  ['biweek-planner/teacher-gate.js', "var bg = light ? '#e2e8f0' : '#020617';", 'teacher-gate overlay light bg grey'],
  ['biweek-planner/student-invite.js', "bg: light ? '#e2e8f0' : '#020617',", 'student-invite overlay light bg grey'],
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
    if (t.includes('#e2e8f0') && t.includes('html.light')) { found = true; break; }
  }
  ok(found, 'built CSS keeps the html.light #e2e8f0 page base');
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
    await page.screenshot({ path: join(SHOTS, `grey-${label.toLowerCase().replace(/\s+/g, '-')}.png`) });
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
