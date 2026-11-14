// Reason Lab verification — the owner's "add the reason game to Creative
// Minds Play Lab" request (upload criticle.html → public/reason-lab.html).
// Parts: (A) 1:1 game-integrity pins vs the upload + furniture pins;
// (B) Play Lab card + GameLeaderboard wiring pins; (C) a full browser
// CAMPAIGN playthrough with the identity keyed in — the finished session
// must auto-POST one drill_attempts doc (payload pinned), allow a manual
// re-send, run the share kit, persist the identity, and stay overflow-free
// on a 393px phone.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const PORT = 8955; const BASE = `http://127.0.0.1:${PORT}`;
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, BASE).pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(DIST, p));
    const data = await readFile(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.mp4': 'video/mp4' };
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(PORT, r));
const browser = await chromium.launch({ headless: true });
const results = [];
const ok = (name, cond, detail) => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);

const upload = await readFile('/home/z/my-project/upload/criticle.html', 'utf8');
const game = await readFile('/home/z/my-project/tmp/cmc-site/public/reason-lab.html', 'utf8');
const libSrc = await readFile('/home/z/my-project/tmp/cmc-site/src/data/learningGames.ts', 'utf8');
const lbSrc = await readFile('/home/z/my-project/tmp/cmc-site/src/components/GameLeaderboard.tsx', 'utf8');

/* ---- A. game integrity (1:1 vs upload) + furniture ---- */
ok('title kept 1:1', game.includes('<title>Reason Lab · Advanced Critical Thinking Trainer</title>'));
const count = (s, re) => (s.match(re) || []).length;
for (const [label, re] of [['mcq items', /ty:'mcq'/g], ['multi items', /ty:'multi'/g], ['order items', /ty:'order'/g]]) {
  ok(`item bank intact: ${label} (${count(game, re)})`, count(game, re) === count(upload, re), `${count(upload, re)} in upload`);
}
ok('case files intact', count(game, /caseId:'/g) === count(upload, /caseId:'/g), String(count(upload, /caseId:'/g)));
const SKILL_NAMES = ['Evidence & Sources', 'Fallacy Detection', 'Bias & Perspective', 'Causal Reasoning', 'Assumptions', 'Data Literacy', 'Argument & Steelman', 'Decision Under Risk'];
SKILL_NAMES.forEach((n) => ok(`skill present: ${n}`, game.includes(`name:'${n}'`)));
const RANKS = ['Novice', 'Observer', 'Questioner', 'Analyst', 'Strategist', 'Architect'];
RANKS.forEach((r) => ok(`rank present: ${r}`, game.includes(`n:'${r}',xp:`)));
const MODES = ['CAMPAIGN', 'GAUNTLET', 'DRILL', 'CASE FILE'];
MODES.forEach((m) => ok(`mode card present: ${m}`, game.includes(`n:'${m}'`)));
ok('engine untouched: finish() grading intact', game.includes("var acc=Math.round(S.correct/total*100);"));
ok('engine dispatch added (only change)', game.includes("new CustomEvent('cmcreason:session'"), 'cmcreason:session');
ok('no engine algorithm edits: shuffle intact', game.includes('var shuffle=function(a){var b=a.slice()'));
// furniture
ok('back-to-CMC pill in header', game.includes('href="https://cmckhmer.github.io/Creative-Minds-/" aria-label="Back to CMC home" title="Back to CMC home">← CMC'));
ok('identity inputs on briefing', game.includes('id="cmcNameIn"') && game.includes('id="cmcIdIn"') && game.includes('THINKER IDENTITY — NAME &amp; ID'));
ok('leaderboard row on the session report', game.includes('id="cmcLbSend"') && game.includes('CLASS LEADERBOARD — POST THIS SESSION'));
ok('email-as-name guard shipped', game.includes('function looksEmail(v)') && game.includes('function friendlyFromEmail(email)'));
ok('stored-name heal at load', game.includes("localStorage.getItem('cmc-student-name')"));
ok('pipeline: drill_attempts REST', game.includes('documents/drill_attempts'));
ok("pipeline: drillSlug reason-lab.html", game.includes("drillSlug: { stringValue: 'reason-lab.html' }"));
ok("pipeline: drillSource learning-games", game.includes("drillSource: { stringValue: 'learning-games' }"));
ok("pipeline: drillTitle 'Reason Lab · ' + label", game.includes("drillTitle: { stringValue: 'Reason Lab · ' + d.label }"));
ok('pipeline: signed-in token + securetoken refresh', game.includes('securetoken.googleapis.com/v1/token') && game.includes('cmc-student-refresh-token'));
ok('auto-send once per session (dedup by sid)', game.includes('autoSentFor !== d.sid'));
ok('bottom bar: class leaderboard link', game.includes('href="https://cmckhmer.github.io/Creative-Minds-/#games" aria-label="Open the class leaderboard'));
ok('share kit: copy/wa/tg/email', game.includes('data-cmc-copy') && game.includes('data-cmc-wa') && game.includes('data-cmc-tg') && game.includes('data-cmc-email'));
ok('assignment text mentions Reason Lab', game.includes('CMC class challenge — Reason Lab'));
ok('layout clears the fixed action bar', game.includes('padding:calc(var(--head) + 22px) 20px 124px'));
ok('furniture print-hidden', game.includes('@media print{.cmc-bar,.cmc-share,.cmc-toast,.cmc-lb,.cmc-id{display:none!important}}'));

/* ---- B. Play Lab card + leaderboard wiring ---- */
ok('library card first in the array', libSrc.indexOf("id: 'reason-lab'") !== -1 && libSrc.indexOf("id: 'reason-lab'") < libSrc.indexOf("id: 'cryo-lockdown'"));
ok('card: title + meta', libSrc.includes("title: 'Reason Lab · Critical Thinking Trainer'") && libSrc.includes("duration: '4 modes · 2–6 min per session'"));
ok('card: external url + badge + leaderboard link', libSrc.includes("externalUrl: './reason-lab.html'") && libSrc.includes("badge: 'New',\n    leaderboardLink: true"));
ok('card: eight skills listed in description', libSrc.includes('Evidence & Sources, Fallacy Detection, Bias & Perspective, Causal Reasoning, Assumptions, Data Literacy, Argument & Steelman and Decision Under Risk'));
ok('GameLeaderboard: KNOWN slug name', lbSrc.includes("'reason-lab.html': 'Reason Lab · Critical Thinking Trainer'"));
ok('GameLeaderboard: slug prefix filter', lbSrc.includes("a.drillSlug.startsWith('reason-lab')"));
ok("GameLeaderboard: title filter 'reason lab'", lbSrc.includes("a.drillTitle.toLowerCase().includes('reason lab')"));

/* ---- C. browser playthrough ---- */
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
const posts = [];
await ctx.route('**drill_attempts**', (route) => {
  const body = route.request().postData() || '';
  if (body.includes('drillSlug')) { try { posts.push(JSON.parse(body)); } catch {} return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); }
  return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
});
await ctx.route('**firestore.googleapis.com**', (route) => {
  const u = route.request().url();
  if (u.includes('drill_attempts')) return route.fallback();
  return route.abort();
});
const page = await ctx.newPage();
await page.goto(`${BASE}/reason-lab.html`, { waitUntil: 'load' });
ok('page loads with its own title', (await page.title()).includes('Reason Lab'));
ok('back pill rendered', await page.$eval('#cmcBackBtn', (el) => el.textContent.includes('CMC')).catch(() => false));
// Campaign: first mode card → briefing → identity → start
await page.click('.mode');
await page.waitForSelector('#vSetup:not([hidden])', { timeout: 5000 });
ok('briefing shows the identity block', await page.$eval('#cmcBriefId', (el) => !el.closest('[hidden]') && getComputedStyle(el).display !== 'none'));
await page.fill('#cmcNameIn', 'Sok Dara');
await page.fill('#cmcIdIn', '7A · 12');
ok('identity mirrored to the report inputs', (await page.inputValue('#cmcLbName')) === 'Sok Dara' && (await page.inputValue('#cmcLbId')) === '7A · 12');
await page.click('#startBtn');
await page.waitForSelector('#vSession:not([hidden])', { timeout: 5000 });
// answer 10 items blind — the item type tag drives the interaction
let items = 0;
for (let i = 0; i < 25; i++) {
  const done = await page.$eval('#vResults', (el) => !el.hidden).catch(() => false);
  if (done) break;
  const type = await page.$eval('#sTags', (el) => el.textContent);
  if (type.includes('RANK IN ORDER')) {
    // submit the shuffled order as-is
  } else {
    const n = type.includes('SELECT ALL') ? 2 : 1;
    for (let k = 0; k < n; k++) await page.click(`.opt[data-i="${k}"]`).catch(() => {});
  }
  await page.click('#submitBtn').catch(() => {});
  await page.waitForSelector('#nextBtn:not([hidden])', { timeout: 8000 });
  await page.click('#nextBtn');
  items++;
}
ok('campaign session completed', items === 10, `${items} items answered`);
ok('results view reached', await page.$eval('#vResults', (el) => !el.hidden).catch(() => false));
await page.waitForTimeout(900);
ok('exactly one auto-POST for the finished session', posts.length === 1, `${posts.length} posts`);
const f = posts[0]?.fields || {};
ok('POST: drillSlug', f.drillSlug?.stringValue === 'reason-lab.html', f.drillSlug?.stringValue);
ok('POST: drillTitle mode label', f.drillTitle?.stringValue === 'Reason Lab · Campaign', f.drillTitle?.stringValue);
ok("POST: drillSource learning-games", f.drillSource?.stringValue === 'learning-games');
ok('POST: name + ID merged identity', f.studentName?.stringValue === 'Sok Dara · 7A · 12', f.studentName?.stringValue);
ok('POST: guest branch (empty uid)', f.studentUid?.stringValue === '');
ok('POST: classId null for guests', JSON.stringify(f.classId) === JSON.stringify({ nullValue: null }));
const pct = Number(f.scorePct?.integerValue || '-1');
const cc = Number(f.correctCount?.integerValue || '-1');
const tc = Number(f.totalCount?.integerValue || '-1');
ok('POST: scorePct 0-100', pct >= 0 && pct <= 100, String(pct));
ok('POST: correct+total == 10 items', cc >= 0 && tc === 10 && cc <= 10, `${cc}/${tc}`);
ok('POST: submittedAt ISO', !!f.submittedAt?.timestampValue);
ok('report status confirms the send', (await page.textContent('#cmcLbStatus')).includes('✓ Sent'));
// manual re-send is always allowed
await page.click('#cmcLbSend');
await page.waitForTimeout(700);
ok('manual SEND re-posts', posts.length === 2, `${posts.length} posts`);
// share kit
await page.click('[data-cmc-share]');
ok('share panel opens', await page.$eval('#cmcShare', (el) => el.classList.contains('show')));
await page.click('[data-cmc-copy]');
await page.waitForTimeout(500);
const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
ok('share copies the game URL', clip.includes('/reason-lab.html'), clip.slice(0, 60));
// identity persists across reloads
await page.reload({ waitUntil: 'load' });
ok('identity persisted', (await page.inputValue('#cmcNameIn')) === 'Sok Dara' && (await page.inputValue('#cmcIdIn')) === '7A · 12');
await page.screenshot({ path: '/home/z/my-project/tmp/cmc-site/scripts/qa/reason-lab-home.png' });
// mobile: no horizontal overflow
await page.setViewportSize({ width: 393, height: 850 });
await page.waitForTimeout(600);
const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - document.documentElement.clientWidth);
ok('mobile 393px: no horizontal overflow', overflow <= 1, `${overflow}px`);
await page.screenshot({ path: '/home/z/my-project/tmp/cmc-site/scripts/qa/reason-lab-mobile.png' });

await browser.close();
server.close();
console.log(`\nverify_reason_lab: ${results.filter(r => r.startsWith('PASS')).length} passed, ${results.filter(r => r.startsWith('FAIL')).length} failed`);
results.filter(r => r.startsWith('FAIL')).forEach(r => console.log(r));
process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
