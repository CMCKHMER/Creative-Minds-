// Verify "connect all games to the leaderboards + a share button for each
// game or assignment" (owner request, Nov 2026).
//
// Static pins: the five injected share-fab pages, the rfc1 trio's leaderboard
// POSTs (signed-in + guest branch + email guard), the rfc3/unscramble share
// button, and the built leaderboard/games-page bundles. Browser: a guest
// dictation POSTs a rules-compliant drill_attempts row (payload pinned), the
// share fab opens and copies, the games-page cards carry 13 Share buttons (Reason Lab joined the library)
// with a working clipboard round-trip, and the Developer's Picks card shares.
import { chromium } from 'playwright';
import { readFile, readdir } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const PUB = '/home/z/my-project/tmp/cmc-site/public';
const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const PORT = 8963; const BASE = `http://127.0.0.1:${PORT}`;
mkdirSync('/home/z/my-project/tmp/cmc-site/scripts/qa', { recursive: true });
const SHOTS = '/home/z/my-project/tmp/cmc-site/scripts/qa';

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}${extra ? ' — ' + extra : ''}`); }
};

// ── 1. static: share kits present everywhere they were missing ────────────
console.log('static · share kits');
const FAB_PAGES = ['voice-quest.html', 'word-forge.html', 'writequest.html', 'syntax-clash-pro.html', 'arcade/galica/index.html'];
for (const p of FAB_PAGES) {
  const t = await readFile(join(PUB, p), 'utf8').catch(() => '');
  ok(t.includes('id="cmc-share-fab"') && t.includes('cmc-share-fab-panel') && t.includes('wa.me'),
    `share fab injected: ${p}`);
  const m = t.match(/<script>\(function\(\)\{var T=document\.title[\s\S]*?<\/script>\s*<\/body>/);
  ok(!!m, `injected script present: ${p}`);
  if (m) { try { new Function(m[0].replace(/<\/script>\s*<\/body>/, '').replace(/^<script>/, '')); ok(true, `injected script parses: ${p}`); } catch (e) { ok(false, `injected script parses: ${p}`, String(e)); } }
}

console.log('static · rfc1 trio leaderboard POSTs');
for (const p of ['rfc1/dictation.html', 'rfc1/unit-test.html', 'rfc1/unscramble.html']) {
  const t = await readFile(join(PUB, p), 'utf8');
  ok(t.includes("drillSource:{stringValue:'rfc1'}"), `${p}: drillSource rfc1`);
  ok(t.includes('cmc-player-name'), `${p}: guest branch reads cmc-player-name`);
  ok(t.includes('/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/'), `${p}: email is never a display name`);
  ok(t.includes("'Authorization':'Bearer '+_tok"), `${p}: signed-in token branch`);
  ok(t.includes('{nullValue:null}'), `${p}: classId null on the guest branch`);
}

console.log('static · rfc3/unscramble share button');
{
  const t = await readFile(join(PUB, 'rfc3/unscramble.html'), 'utf8');
  ok(t.includes('btn btn-share') && t.includes('shareWorksheet()'), 'unscramble: ⤴ Share toolbar button');
  ok(t.includes('id="sharePanel"') && t.includes('shareWhatsApp'), 'unscramble: share panel + channels');
  ok(t.includes('.share-panel,#toast'), 'unscramble: share UI print-hidden');
}

// ── 2. dist bundles: leaderboard source filter + card share chips ─────────
console.log('static · built bundles');
const assets = await readdir(join(DIST, 'assets'));
let board = '', lg = '';
for (const f of assets.filter((x) => x.endsWith('.js'))) {
  const t = await readFile(join(DIST, 'assets', f), 'utf8');
  if (t.includes('"brain-lounge"') && t.includes('"tense-master"') && t.includes('"rfc1"')) board = f;
  if (t.includes('with your class`') && t.includes('Game link copied')) lg = f;
}
ok(!!board, 'leaderboard bundle carries the source-based game filter', board || 'not found');
if (board) {
  const t = await readFile(join(DIST, 'assets', board), 'utf8');
  ok(t.includes('["learning-games","brain-lounge","tense-master","rfc1","rfc2","rfc3"]'), 'filter covers every game source (assignment excluded)');
  ok(t.includes('"Tense Master"') && t.includes('"Galica · Arcade Shooter"'), 'KNOWN names for tense-master + galica');
  ok(t.includes('drillTitle||'), 'recent activity prefers the attempt drillTitle');
}
ok(!!lg, 'games-page bundle carries the card share chips', lg || 'not found');
if (lg) {
  const t = await readFile(join(DIST, 'assets', lg), 'utf8');
  ok(t.includes('Share the Ghost Mountain reading & quiz'), 'Developer\'s Picks card has its own share button');
  ok(t.includes('paste it anywhere'), 'card share toast feedback');
}

// ── 3. browser ────────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, BASE).pathname);
    if (p.endsWith('/')) p += 'index.html';
    const data = await readFile(normalize(join(DIST, p)));
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
    res.writeHead(200, { 'Content-Type': types[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(PORT, r));

console.log('browser · rfc1 dictation guest POST + share fab + card shares');
const posts = [];
const browser = await chromium.launch();
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await ctx.addInitScript(() => {
    localStorage.setItem('cmc-player-name', JSON.stringify({ name: 'Sokha', at: Date.now() }));
    localStorage.removeItem('cmc-student-token');
  });
  const page = await ctx.newPage();
  await page.route('**/documents/drill_attempts*', async (route) => {
    posts.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"name":"projects/demo/databases/(default)/documents/drill_attempts/v"}' });
  });

  // 3a. rfc1/dictation: guest checks answers → rules-compliant POST.
  await page.goto(`${BASE}/rfc1/dictation.html`, { waitUntil: 'load' });
  const unitPicked = await page.evaluate(() => {
    const sel = document.getElementById('unitSelect') || document.querySelector('select');
    if (!sel) return false;
    const opt = [...sel.options].find((o) => o.value);
    if (!opt) return false;
    sel.value = opt.value; sel.dispatchEvent(new Event('change'));
    return true;
  });
  ok(unitPicked, 'dictation: unit selected');
  await page.waitForTimeout(300);
  await page.evaluate(() => { if (typeof checkAnswers === 'function') checkAnswers(); else if (typeof window.checkAnswers === 'function') window.checkAnswers(); });
  await page.waitForTimeout(700);
  ok(posts.length === 1, 'dictation check fires exactly one leaderboard POST');
  const f = posts[0]?.fields ?? {};
  ok(f.drillSource?.stringValue === 'rfc1', 'payload drillSource rfc1');
  ok(f.studentName?.stringValue === 'Sokha', 'guest name rides from cmc-player-name (not an email)');
  ok(f.studentUid?.stringValue === '', 'guest branch: studentUid empty');
  ok(f.classId?.nullValue === null, 'guest branch: classId null');
  ok(f.drillSlug?.stringValue === 'dictation.html', 'payload drillSlug dictation.html');
  ok((f.drillTitle?.stringValue || '').includes('Dictation'), 'payload drillTitle carries the sheet type', f.drillTitle?.stringValue);
  ok(f.totalCount?.integerValue !== '0', 'totalCount is the unit question count', f.totalCount?.integerValue);

  // 3b. voice-quest: fab opens the panel, Copy writes the URL.
  await page.goto(`${BASE}/voice-quest.html`, { waitUntil: 'load' });
  ok(await page.locator('#cmc-share-fab').isVisible(), 'voice-quest: share fab visible');
  await page.locator('#cmc-share-fab').click();
  ok(await page.locator('#cmc-share-fab-panel.open').count() === 1, 'voice-quest: fab opens the share panel');
  await page.locator('#cmc-share-fab-panel [data-c="copy"]').click();
  await page.waitForTimeout(400);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  ok(clip.endsWith('/voice-quest.html'), 'voice-quest: Copy game link copies the page URL', clip);
  ok(await page.locator('#cmc-share-fab-toast.show').count() === 1, 'voice-quest: toast confirms the copy');
  await page.keyboard.press('Escape');
  ok(await page.locator('#cmc-share-fab-panel.open').count() === 0, 'voice-quest: Escape closes the panel');

  // 3c. rfc3/unscramble: the new toolbar Share button toggles the panel
  // (the toolbar renders once a unit is selected).
  await page.goto(`${BASE}/rfc3/unscramble.html`, { waitUntil: 'load' });
  await page.evaluate(() => {
    const sel = document.getElementById('unitSelect') || document.querySelector('select');
    const opt = sel && [...sel.options].find((o) => o.value);
    if (sel && opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change')); }
  });
  await page.waitForTimeout(500);
  const shareBtn = page.locator('button.btn-share');
  ok(await shareBtn.count() === 1, 'unscramble: one ⤴ Share button in the toolbar');
  await shareBtn.click();
  ok(await page.locator('#sharePanel.open').count() === 1, 'unscramble: share panel opens');
  await page.keyboard.press('Escape');
  ok(await page.locator('#sharePanel.open').count() === 0, 'unscramble: Escape closes the panel');

  // 3d. games page: every card carries a Share chip; one copies.
  await page.goto(`${BASE}/index.html#games`, { waitUntil: 'load' });
  await page.waitForSelector('button[aria-label$="with your class"]', { timeout: 15000 });
  const cardShares = await page.locator('button[aria-label$="with your class"]').count();
  ok(cardShares === 13, 'games page: all 13 registry cards carry a Share chip', String(cardShares));
  ok(await page.locator('button[aria-label="Share the Ghost Mountain reading & quiz"]').count() === 1, 'Developer\'s Picks card share present');
  await page.locator('button[aria-label$="with your class"]').first().click();
  await page.waitForTimeout(400);
  const toastText = await page.locator('[data-cmc-share-toast]').textContent().catch(() => '');
  ok((toastText || '').includes('copied'), 'card share copies + toasts on desktop', toastText || 'no toast');
  await page.screenshot({ path: join(SHOTS, 'share-connect-games.png') });
  await ctx.close();
}

// 3e. mobile: fab never overflows the viewport.
{
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/arcade/galica/`, { waitUntil: 'load' });
  ok(await page.locator('#cmc-share-fab').isVisible(), 'galica: share fab visible on mobile');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(overflow === 0, 'galica mobile: zero horizontal overflow', `${overflow}px`);
  await page.screenshot({ path: join(SHOTS, 'share-connect-galica.png') });
  await ctx.close();
}

await browser.close();
server.close();

console.log(`\nverify_share_connect: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
