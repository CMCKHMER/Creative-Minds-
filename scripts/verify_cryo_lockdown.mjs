// Verify the Cryo-Vault Lockdown learning game (owner request, Nov 2026):
//
//   "ok i want you to implement this game in the game section with a detailed
//    description of the game on the card. Allow teacher to share to the class
//    for a competitive class assignment. link to leader boards. Allow students
//    to key in name and id"
//
// The teacher's game (public/cryo-lockdown.html — 6 security terminals built
// on the Unit 15 DNA Bank reading, coolant timer, 6-digit vault code, score
// 1000 + 2×s + 100×hints − 25×errors) ships 1:1 with CMC furniture:
//   · games-page card with the detailed description + 🏆 Class leaderboard link;
//   · GameLeaderboard learns the cryo-lockdown slug (runs appear on the board);
//   · students key NAME + ID (briefing sheet, persisted, email-guarded);
//   · every finished run posts one drill_attempts doc (drillSource
//     'learning-games', guest branch or signed-in token with securetoken
//     refresh) — name and ID ride together in the public identity;
//   · Share-with-class kit (Copy Link / WhatsApp / Telegram / Email) with the
//     competitive assignment text; back-to-CMC pill.
// This verifier plays a FULL winning run in a real browser by solving all six
// terminals, entering the vault code, and pinning the exact POST payload.
import { chromium } from 'playwright';
import { readFile, readdir } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const PORT = 8960; const BASE = `http://127.0.0.1:${PORT}`;
mkdirSync('/home/z/my-project/tmp/cmc-site/scripts/qa', { recursive: true });
const SHOTS = '/home/z/my-project/tmp/cmc-site/scripts/qa';

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}${extra ? ' — ' + extra : ''}`); }
};

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, BASE).pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(DIST, p));
    const data = await readFile(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(PORT, r));

// ── 1. static checks on the built game page ──────────────────────────────
console.log('static · dist/cryo-lockdown.html');
let ws = '';
try { ws = await readFile(join(DIST, 'cryo-lockdown.html'), 'utf8'); } catch {}
ok(ws.length > 80000, 'game shipped into dist/ (non-trivial size)', `${ws.length} bytes`);
ok(ws.includes('<title>Cryo-Vault Lockdown · DNA Bank — CMC Learning Game</title>'), 'family-consistent page title');

// 1a. the game itself is a faithful 1:1 copy (keys + scoring untouched)
for (const [needle, label] of [
  ["easy:{label:'TRAINEE',time:720,hints:4,penalty:0,hintCost:10", 'TRAINEE protocol intact'],
  ["normal:{label:'TECHNICIAN',time:540,hints:3,penalty:10,hintCost:20", 'TECHNICIAN protocol intact'],
  ["hard:{label:'SPECIALIST',time:390,hints:2,penalty:20,hintCost:30", 'SPECIALIST protocol intact'],
  ['var score=Math.max(0,Math.round(1000+S.time*2+S.hints*100-S.errors*25));', 'score formula intact (1000 + 2×s + 100×hints − 25×errors)'],
  ["solution:['bees','plants','eaters','food','env']", 'SEQUENCE RELAY key intact'],
  ("answers:[['extinct'],['global'],['samples','sample'],['support']]", 'CLOZE SEAL keys intact'),
  ("{t:'Laws alone have stopped species from disappearing.',a:'F'}", 'TRUTH SCAN key intact'),
  ["What is the final purpose of the DNA bank?", 'MAIN SIGNAL comprehension intact'],
  ['A power surge has sealed the cryo-vault', 'briefing story intact'],
  ['INITIATE LOCKDOWN', 'start button intact'],
]) ok(ws.includes(needle), label);
ok((ws.match(/\{id:\d+,name:'/g) || []).length === 6, 'all 6 security terminals intact');

// 1b. CMC furniture needles
for (const [needle, label] of [
  ['id="cmc-back-btn"', 'back-to-CMC pill (same fixture as syntax-clash/writequest)'],
  ['.hud{padding-right:170px}', 'HUD leaves room for the pill (z-order fixture)'],
  ['id="cmcNameIn"', 'briefing NAME input'],
  ['id="cmcIdIn"', 'briefing ID input'],
  ['OPERATIVE IDENTITY — NAME', 'briefing identity block label'],
  ['id="cmcLbName"', 'result-sheet NAME input'],
  ['id="cmcLbId"', 'result-sheet ID input'],
  ['id="cmcLbSend"', 'SEND SCORE button'],
  ['CLASS LEADERBOARD — POST THIS RUN', 'result-sheet leaderboard block'],
  ["new CustomEvent('cryo:run'", 'engine dispatches the run event (win + lose)'],
  ["document.addEventListener('cryo:run'", 'furniture listens for finished runs'],
  ["drillSlug: { stringValue: 'cryo-lockdown.html' }", 'payload drillSlug cryo-lockdown.html'],
  ["drillSource: { stringValue: 'learning-games' }", "payload drillSource 'learning-games' (games leaderboard feed)"],
  ["drillTitle: { stringValue: 'Cryo-Vault Lockdown · '", 'payload names the difficulty'],
  ["'Authorization': 'Bearer ' + tok", 'signed-in students post under their session token'],
  ['securetoken.googleapis.com/v1/token', 'expired sessions refresh via securetoken'],
  ['classId: (function () { var c = ls(\'cmc-student-classId\'); return c ? { stringValue: c } : { nullValue: null }; })()', 'classId null for guests (rules-compliant guest branch)'],
  ['looksEmail', 'email-as-name guard shipped (ticker name fix)'],
  ['https://cmckhmer.github.io/Creative-Minds-/#games', 'Class leaderboard link targets the games page'],
  ['wa.me', 'share: WhatsApp'],
  ['t.me/share', 'share: Telegram'],
  ['mailto:', 'share: Email'],
  ['data-cmc-copy', 'share: copy assignment link'],
  ['CMC class challenge', 'competitive class-assignment share text'],
]) ok(ws.includes(needle), label);
ok(!ws.includes('inviteMode'), 'no inviteMode key (rules guard satisfied)');
ok(!/TODO|XXX|【/.test(ws), 'no leftover placeholders');

// ── 2. games-page bundles: card + leaderboard wiring ─────────────────────
console.log('static · games page bundles');
const assets = await readdir(join(DIST, 'assets'));
let cardHit = '', boardHit = '';
for (const f of assets.filter((x) => x.endsWith('.js'))) {
  const t = await readFile(join(DIST, 'assets', f), 'utf8');
  if (t.includes('cryo-lockdown.html') && t.includes('Cryo-Vault Lockdown · DNA Bank Escape')) cardHit = f;
  const slugFilter = t.includes('startsWith("cryo-lockdown")') || t.includes("startsWith('cryo-lockdown')");
  if (slugFilter && t.includes('cryo-lockdown.html') && t.includes('Cryo-Vault Lockdown')) boardHit = f;
}
ok(!!cardHit, 'games-page bundle registers the card (title + external URL)', cardHit || 'not found');
if (cardHit) {
  const t = await readFile(join(DIST, 'assets', cardHit), 'utf8');
  ok(t.includes('escape-room reading challenge'), 'card carries the detailed description');
  ok(t.includes('key in their name and ID'), 'card description mentions name + ID entry');
  ok(t.includes('competitive class assignment'), 'card description mentions the teacher share kit');
  ok(t.includes('🏆 Class leaderboard'), 'card renders the Class leaderboard link');
  ok(t.includes('cmc-game-leaderboard'), 'leaderboard scroll anchor shipped');
}
ok(!!boardHit, 'leaderboard bundle learns the cryo-lockdown slug', boardHit || 'not found');
// ── 3. browser: full winning playthrough + payload pins ──────────────────
console.log('browser · full winning run (student keys name + ID)');
const posts = [];
const browser = await chromium.launch();
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const page = await ctx.newPage();
  await page.route('**/documents/drill_attempts*', async (route) => {
    const req = route.request();
    posts.push({ headers: req.headers(), body: JSON.parse(req.postData() || '{}') });
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"name":"projects/demo/databases/(default)/documents/drill_attempts/verify"}' });
  });
  await page.goto(`${BASE}/cryo-lockdown.html`, { waitUntil: 'load' });
  await page.waitForSelector('#briefing', { timeout: 8000 });
  ok(await page.locator('#cmc-back-btn').isVisible(), 'back-to-CMC pill visible');
  ok(await page.locator('#cmcNameIn').isVisible(), 'briefing shows the NAME field');
  ok(await page.locator('#cmcIdIn').isVisible(), 'briefing shows the ID field');

  // Student keys in name + ID on the briefing sheet.
  await page.locator('#cmcNameIn').fill('Dara Kim');
  await page.locator('#cmcIdIn').fill('7A-12');
  const stored = await page.evaluate(() => ({
    pn: localStorage.getItem('cmc-player-name'),
    id: localStorage.getItem('cmc-player-id'),
  }));
  ok((stored.pn || '').includes('Dara Kim'), 'name persisted to localStorage');
  ok(stored.id === '7A-12', 'ID persisted to localStorage');

  await page.locator('#startBtn').click();
  await page.waitForTimeout(300);
  ok(await page.locator('#briefing').isHidden(), 'INITIATE LOCKDOWN starts the run');
  ok(await page.locator('.term').count() === 6, 'six security terminals on the board');

  // Share-with-class kit (usable while playing — no overlay covers the bar).
  await page.locator('[data-cmc-share]').click();
  ok(await page.locator('#cmcShare.show').count() === 1, 'share menu opens mid-run');
  await page.locator('[data-cmc-copy]').click();
  await page.waitForTimeout(400);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  ok(clip.endsWith('/cryo-lockdown.html'), 'Copy assignment link copies the game URL', clip);
  await page.evaluate(() => document.getElementById('cmcShare').classList.add('show'));
  await page.locator('[data-cmc-close]').click();
  ok(await page.locator('#cmcShare.show').count() === 0, 'share menu closes');

  // Solve every terminal (any order; data-i = PUZZLES index).
  for (let i = 0; i < 6; i++) {
    await page.locator(`.term[data-i="${i}"]`).click();
    await page.waitForSelector('#modalWrap:not([hidden])', { timeout: 5000 });
    const solved = await page.evaluate((idx) => {
      const root = document.querySelector('#modalBody .pz');
      if (root.querySelector('.pz-row')) { // WORD LOCK — vocabulary match
        root.querySelectorAll('.pz-row').forEach((r) => { r.querySelector('select').value = r.getAttribute('data-key'); });
        return 'match';
      }
      const ol = root.querySelector('ol');
      if (ol) { // SEQUENCE RELAY — cause & effect order
        ['bees', 'plants', 'eaters', 'food', 'env'].forEach((k) => ol.appendChild(ol.querySelector(`li[data-key="${k}"]`)));
        return 'order';
      }
      if (root.querySelector('.tray')) { // SAMPLE SORT — cause/effect classify
        root.querySelectorAll('.card').forEach((c) => root.querySelector(`.bin[data-bin="${c.getAttribute('data-correct')}"] .binbody`).appendChild(c));
        return 'sort';
      }
      if (root.querySelector('.cloze input')) { // CLOZE SEAL — gap fill
        ['extinct', 'global', 'samples', 'support'].forEach((w, j) => { root.querySelectorAll('.cloze input')[j].value = w; });
        return 'cloze';
      }
      const qs = root.querySelectorAll('.pz-q');
      if (qs[0] && qs[0].querySelector('.opt[data-val="T"]')) { // TRUTH SCAN
        qs.forEach((q) => q.querySelector(`.opt[data-val="${q.getAttribute('data-key')}"]`).click());
        return 'tf';
      }
      qs.forEach((q) => q.querySelector(`.opt[data-val="${q.getAttribute('data-key')}"]`).click()); // MAIN SIGNAL
      return 'mcq';
    }, i);
    ok(!!solved, `terminal ${i + 1} solved (${solved})`);
    await page.locator('#submitBtn').click();
    await page.waitForSelector('#modalWrap[hidden]', { state: 'attached', timeout: 5000 });
    await page.waitForTimeout(120);
  }
  ok(((await page.locator('#keyMsg').textContent()) || '').includes('ALL DIGITS RELEASED'), 'all 6 digits released — keypad enabled');

  // Read the released digits in slot order and type the vault code.
  const code = await page.$$eval('#codeSlots .slot', (els) => els.map((e) => e.textContent.trim()).join(''));
  ok(/^[0-9]{6}$/.test(code), 'six code digits visible in the slots', code);
  for (const d of code) await page.locator('.key', { hasText: d }).first().click();
  await page.locator('.key.enter').click();

  await page.waitForSelector('#resultOverlay:not([hidden])', { timeout: 9000 });
  ok(((await page.locator('#resultTitle').textContent()) || '').includes('Vault'), 'vault opens — mission report shown');
  ok(await page.locator('#cmcLb').isVisible(), 'mission report carries the class-leaderboard block');
  ok((await page.locator('#cmcLbName').inputValue()) === 'Dara Kim', 'name mirrored onto the report');
  ok((await page.locator('#cmcLbId').inputValue()) === '7A-12', 'ID mirrored onto the report');
  await page.waitForTimeout(700);

  // Auto-send fired once with the merged public identity.
  ok(posts.length === 1, 'finished run auto-posted once to drill_attempts', String(posts.length));
  const b = posts[0]?.body?.fields ?? {};
  const h = posts[0]?.headers ?? {};
  ok(b.drillSlug?.stringValue === 'cryo-lockdown.html', 'payload drillSlug cryo-lockdown.html');
  ok((b.drillTitle?.stringValue || '').startsWith('Cryo-Vault Lockdown · '), 'payload drillTitle names the difficulty', b.drillTitle?.stringValue);
  ok(b.drillSource?.stringValue === 'learning-games', 'payload drillSource learning-games');
  ok(b.studentName?.stringValue === 'Dara Kim · 7A-12', 'name AND ID ride together in the public identity', b.studentName?.stringValue);
  ok((b.studentName?.stringValue || '').length <= 40, 'identity within the rules\' 40-char name limit');
  ok(b.studentUid?.stringValue === '', 'guest branch: studentUid empty');
  ok(b.classId && b.classId.nullValue === null, 'classId null (guest-branch compliant)');
  ok(b.correctCount?.integerValue === '6' && b.totalCount?.integerValue === '6', 'payload counts 6/6 terminals');
  const pct = Number(b.scorePct?.integerValue || '0');
  ok(pct >= 55 && pct <= 100, 'winning scorePct in range (vault open ≥ 55%)', String(pct));
  ok(!!b.submittedAt?.timestampValue, 'payload timestamped');
  ok(!h.authorization, 'guest POST carries no Authorization header');
  await page.screenshot({ path: join(SHOTS, 'cryo-win.png') });

  // Manual re-send after editing the ID (teacher demo / retry path).
  await page.locator('#cmcLbId').fill('7B-03');
  await page.locator('#cmcLbSend').click();
  await page.waitForTimeout(600);
  ok(posts.length === 2, 'SEND SCORE re-posts on demand');
  ok(posts[1]?.body?.fields?.studentName?.stringValue === 'Dara Kim · 7B-03', 're-send carries the updated ID', posts[1]?.body?.fields?.studentName?.stringValue);
  ok(((await page.locator('#cmcLbStatus').textContent()) || '').includes('✓'), 'status line confirms the post');

  // Identity survives a reload (returning student).
  await page.goto(`${BASE}/cryo-lockdown.html`, { waitUntil: 'load' });
  await page.waitForSelector('#briefing', { timeout: 8000 });
  ok((await page.locator('#cmcNameIn').inputValue()) === 'Dara Kim', 'name prefilled on return');
  ok((await page.locator('#cmcIdIn').inputValue()) === '7B-03', 'latest ID prefilled on return (the re-send updated it)');
  await ctx.close();
}

// 3b. mobile: no horizontal overflow, HUD keeps the pill clear.
{
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/cryo-lockdown.html`, { waitUntil: 'load' });
  await page.waitForSelector('#briefing', { timeout: 8000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(overflow === 0, 'mobile: zero horizontal overflow', `${overflow}px`);
  const pillBox = await page.locator('#cmc-back-btn').boundingBox();
  ok(!!pillBox && pillBox.y >= 0 && pillBox.x + pillBox.width <= 393, 'mobile: back pill on screen (icon-only mode)');
  await page.screenshot({ path: join(SHOTS, 'cryo-mobile.png') });
  await ctx.close();
}

await browser.close();
server.close();

console.log(`\nverify_cryo_lockdown: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
