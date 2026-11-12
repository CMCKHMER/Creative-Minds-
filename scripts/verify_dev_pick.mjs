// Verify Developer's Picks — Ghost Mountain reading & quiz (owner request,
// Nov 2026: "make this into one of my personal reading and quiz and implement
// on a new card, called developers picks", from the Canva worksheet at
// https://canva.link/ytexbk8rmyqfkri).
//
// Checks the built page 1:1 against the Canva worksheet (8 reading articles,
// 4-moment timeline, schematic-map labels, 8 vocabulary terms, all 8 Part A
// questions with every option, the content note, the footer line, the 4 real
// source links), pins the leaderboard pipeline, verifies the games page
// carries the Developer's Picks card + the leaderboard slug wiring, then
// plays the quiz in a real browser: 7/8 with instant-feedback pins, the
// identity gate, the exact POST payload, retake → 8/8 auto-send, share
// clipboard, reload persistence (identity + writing autosave), mobile.
import { chromium } from 'playwright';
import { readFile, readdir } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const PORT = 8962; const BASE = `http://127.0.0.1:${PORT}`;
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
    const data = await readFile(normalize(join(DIST, p)));
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
    res.writeHead(200, { 'Content-Type': types[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(PORT, r));

// ── 1. static: the page is a 1:1 transcription of the Canva worksheet ─────
console.log('static · dist/dev-pick-ghost-mountain.html');
let ws = '';
try { ws = await readFile(join(DIST, 'dev-pick-ghost-mountain.html'), 'utf8'); } catch {}
ok(ws.length > 30000, 'page shipped into dist/ (non-trivial size)', `${ws.length} bytes`);
ok(ws.includes('<title>Ghost Mountain · Reading &amp; Quiz — CMC Developer\'s Picks</title>'), 'family-consistent page title');

for (const [needle, label] of [
  // header + content note (verbatim from the design)
  ['History · Reading &amp; Response Worksheet', 'eyebrow line from the design (uppercased on render)'],
  ['Ghost Mountain: A Reading on Memory, History, and Human Courage', 'main title verbatim'],
  ['Read the account, study the evidence, and answer in your own words.', 'intro line verbatim'],
  ['This reading discusses displacement, violence, landmines, death, and grief. It does not include graphic descriptions or images.', 'content note verbatim'],
  // the 8 reading articles
  ['Ghost Mountain, also called <strong>Phnom Khmaoch</strong>', 'reading 1: location + Khmer name'],
  ['From 1975 to 1979, Cambodians suffered under the Khmer Rouge.', 'reading 2: before the tragedy'],
  ['Early in 1979, Vietnamese forces overthrew the Khmer Rouge government.', 'reading 3: displacement'],
  ['UNHCR records that <strong>more than 42,000 people</strong>', 'reading 4: forced return figure'],
  ['steep terrain and landmines, which are explosive devices hidden in or on the ground', 'reading 5: the descent'],
  ['On <strong>19 October 1979</strong>, Thailand announced', 'reading 6: asylum announcement'],
  ['The death toll is <strong>not known with certainty</strong>', 'reading 7: uncertainty'],
  ['estimates of up to <strong>3,000 killed</strong> and <strong>7,000 unaccounted for</strong>', 'reading 7: DC-Cam estimates'],
  ['“Unaccounted for” means a person’s fate was not established', 'reading 7: unaccounted ≠ death'],
  ['Survivor memories describe cries for help', 'reading 8: remembered name'],
  // timeline
  ['<time>1975</time>', 'timeline 1975'],
  ['<time>Early 1979</time>', 'timeline early 1979'],
  ['<time>June 1979</time>', 'timeline June 1979'],
  ['<time>19 October 1979</time>', 'timeline 19 Oct 1979'],
  // visuals section labels
  ['Schematic • not to scale • not an exact route', 'map: not-to-scale label'],
  ['<b>Reported hazards:</b> steep terrain · landmines', 'map: hazards callout'],
  ['Illustration • not the historical route', 'map: route label'],
  ['No unverified photograph is presented as evidence of the June 1979 forced descent.', 'visuals: no-photograph line'],
  // vocabulary (8 terms)
  ['<dt>Refugee</dt>', 'vocab: refugee'], ['<dt>Forced return</dt>', 'vocab: forced return'],
  ['<dt>Asylum</dt>', 'vocab: asylum'], ['<dt>Landmine</dt>', 'vocab: landmine'],
  ['<dt>Displacement</dt>', 'vocab: displacement'], ['<dt>Survivor</dt>', 'vocab: survivor'],
  ['<dt>Unaccounted for</dt>', 'vocab: unaccounted for'], ['<dt>Estimate</dt>', 'vocab: estimate'],
  // Part B / C
  ['Why does it matter that sources give different estimates', 'Part B prompt 1'],
  ['What responsibilities might governments and international organisations have toward refugees?', 'Part B prompt 2'],
  ['How might the remembered name “Ghost Mountain” shape the way people understand this history?', 'Part B prompt 3'],
  ['What key moments turned displacement into a second tragedy at Ghost Mountain?', 'Part C prompt'],
  ['Teacher review · not auto-graded', 'Part B/C not auto-graded tag'],
  ['gmp-w1', 'writing autosave key 1'], ['gmp-wc', 'writing autosave key C'],
  // footer + sources (the 4 REAL links from the design)
  ['A respectful learning activity about history, evidence, and remembrance.', 'footer line verbatim'],
  ['https://www.unhcr.org/africa/sites/afr/files/legacy-pdf/3ebf9bad0.pdf', 'source 1: UNHCR PDF'],
  ['https://www.dccam.org/hill-tribes-memory-community-center/hill-tribes-memory-community-center-refugee-camps-a-cambodian-perspective-august-6-2025/', 'source 2: DC-Cam'],
  ['https://data.unhcr.org/fr/documents/download/91169', 'source 3: UNHCR data portal'],
  ['https://www.refworld.org/reference/themreport/unga/1979/91472', 'source 4: Refworld 1979'],
  // quiz furniture + pipeline
  ['a: 0, why:', 'quiz data with feedback'], ['8. Why is the place remembered as Ghost Mountain?', 'Q8 verbatim'],
  ["'Near Preah Vihear Temple in Cambodia’s northern Dangrêk Mountains'", 'Q1 option verbatim'],
  ["'More than 42,000'", 'Q4 option verbatim'],
  ["'The death toll is uncertain; estimates differ, and missing people are not confirmed deaths'", 'Q7 option verbatim'],
  ['drillSlug: { stringValue: \'dev-pick-ghost-mountain.html\' }', 'payload drillSlug'],
  ["drillTitle: { stringValue: 'Ghost Mountain · Reading & Quiz' }", 'payload drillTitle'],
  ["drillSource: { stringValue: 'learning-games' }", 'payload drillSource learning-games'],
  ['looksEmail', 'email-as-name guard shipped'],
  ['securetoken.googleapis.com/v1/token', 'expired sessions refresh via securetoken'],
  ["'Authorization': 'Bearer ' + tok", 'signed-in students post under their session token'],
  ['https://cmckhmer.github.io/Creative-Minds-/#games', 'bottom-bar Class leaderboard link'],
  ['data-cmc-copy', 'share: copy link'], ['wa.me', 'share: WhatsApp'], ['t.me/share', 'share: Telegram'], ['mailto:', 'share: Email'],
  ['Developer\'s Pick', 'page carries the Developer\'s Pick eyebrow'],
]) ok(ws.includes(needle), label);
ok(!ws.includes('inviteMode'), 'no inviteMode key (rules guard satisfied)');
ok(!/TODO|XXX|【/.test(ws), 'no leftover placeholders');
ok((ws.match(/opts: \[/g) || []).length === 8, 'all 8 Part A questions present');
ok((ws.match(/<dt>/g) || []).length === 8, 'all 8 vocabulary terms present');
ok((ws.match(/<article>/g) || []).length === 8, 'all 8 reading articles present');

// ── 2. games page bundles: Developer's Picks card + leaderboard wiring ───
console.log('static · games page bundles');
const assets = await readdir(join(DIST, 'assets'));
let cardHit = '', boardHit = '';
for (const f of assets.filter((x) => x.endsWith('.js'))) {
  const t = await readFile(join(DIST, 'assets', f), 'utf8');
  if (t.includes('dev-pick-ghost-mountain.html') && t.includes('Ghost Mountain · A Reading on Memory, History & Human Courage')) cardHit = f;
  const slugFilter = t.includes('startsWith("dev-pick-ghost-mountain")') || t.includes("startsWith('dev-pick-ghost-mountain')");
  if (slugFilter && t.includes('dev-pick-ghost-mountain.html') && t.includes('Ghost Mountain · Reading & Quiz')) boardHit = f;
}
ok(!!cardHit, 'games-page bundle carries the Developer\'s Picks card', cardHit || 'not found');
if (cardHit) {
  const t = await readFile(join(DIST, 'assets', cardHit), 'utf8');
  ok(t.includes('Developer'), 'card section labelled Developer\'s Pick');
  ok(t.includes('rebuilt 1:1 from the Creativeminds Canva worksheet'), 'card carries the detailed description');
  ok(t.includes('content note is shown up front'), 'card discloses the content note');
  ok(t.includes('🏆 Class leaderboard'), 'card has the Class leaderboard scroll link');
  ok(t.includes('Open the reading & quiz'), 'card opens the reading & quiz');
}
ok(!!boardHit, 'leaderboard bundle learns the ghost-mountain slug', boardHit || 'not found');

// ── 3. browser: play the quiz 7/8 → identity gate → SEND → retake 8/8 ────
console.log('browser · quiz playthrough (7/8, then retake 8/8)');
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
  await page.goto(`${BASE}/dev-pick-ghost-mountain.html`, { waitUntil: 'load' });
  await page.waitForSelector('#quiz .q', { timeout: 8000 });
  ok(await page.locator('#quiz .q').count() === 8, 'quiz renders all 8 questions');
  ok(await page.locator('#cmc-back-btn').isVisible(), 'back-to-CMC pill visible');
  ok(((await page.locator('#scoreText').textContent()) || '').includes('0 / 8'), 'score starts 0 / 8');

  // Q1 answered WRONG — instant feedback, question locks, score unchanged.
  await page.locator('.q[data-qi="0"] .opt input').nth(1).check();
  ok(((await page.locator('[data-fb="0"]').textContent()) || '').startsWith('✗'), 'Q1 wrong: instant ✗ feedback');
  ok(await page.locator('.q[data-qi="0"]').evaluate((n) => n.classList.contains('locked')), 'Q1 locked after first choice');
  ok(((await page.locator('#scoreText').textContent()) || '').includes('0 / 8'), 'wrong answer does not score');

  // Q2–Q8 answered correctly (data-a index per question).
  const answers = [0, 1, 2, 1, 1, 2, 2, 1];
  for (let i = 1; i < 8; i++) {
    await page.locator(`.q[data-qi="${i}"] .opt input`).nth(answers[i]).check();
  }
  ok(((await page.locator('[data-fb="1"]').textContent()) || '').startsWith('✓'), 'Q2 correct: instant ✓ feedback');
  ok(((await page.locator('#scoreText').textContent()) || '').includes('7 / 8'), 'score reads 7 / 8');

  // No identity → completion must NOT auto-post; the status asks for the name.
  await page.waitForTimeout(700);
  ok(posts.length === 0, 'no auto-post without a name (identity gate)');
  ok(((await page.locator('#cmcLbStatus').textContent()) || '').includes('name'), 'status asks for the name');

  // Key in name + ID, then SEND.
  await page.locator('#cmcNameIn').fill('Dara');
  await page.locator('#cmcIdIn').fill('9B');
  await page.locator('#cmcLbSend').click();
  await page.waitForTimeout(700);
  ok(posts.length === 1, 'SEND posts the quiz run once');
  const b = posts[0]?.body?.fields ?? {};
  ok(b.drillSlug?.stringValue === 'dev-pick-ghost-mountain.html', 'payload drillSlug dev-pick-ghost-mountain.html');
  ok(b.drillTitle?.stringValue === 'Ghost Mountain · Reading & Quiz', 'payload drillTitle Ghost Mountain · Reading & Quiz', b.drillTitle?.stringValue);
  ok(b.drillSource?.stringValue === 'learning-games', 'payload drillSource learning-games');
  ok(b.studentName?.stringValue === 'Dara · 9B', 'name AND ID ride together in the identity', b.studentName?.stringValue);
  ok(b.studentUid?.stringValue === '', 'guest branch: studentUid empty');
  ok(b.classId && b.classId.nullValue === null, 'classId null (guest-branch compliant)');
  ok(b.correctCount?.integerValue === '7' && b.totalCount?.integerValue === '8', 'payload counts 7/8');
  ok(b.scorePct?.integerValue === '88', 'scorePct 88 (7/8 rounded)', b.scorePct?.integerValue);
  ok(!posts[0].headers.authorization, 'guest POST carries no Authorization header');

  // Retake → all 8 correct → auto-send fires (name now present).
  await page.locator('#resetBtn').click();
  ok(((await page.locator('#scoreText').textContent()) || '').includes('0 / 8'), 'retake resets the score');
  for (let i = 0; i < 8; i++) await page.locator(`.q[data-qi="${i}"] .opt input`).nth(answers[i]).check();
  await page.waitForTimeout(700);
  ok(posts.length === 2, 'perfect retake auto-posts once');
  ok(posts[1]?.body?.fields?.scorePct?.integerValue === '100', 'retake payload pct 100 (8/8)', posts[1]?.body?.fields?.scorePct?.integerValue);
  ok(((await page.locator('#cmcLbStatus').textContent()) || '').includes('8 / 8'), 'status confirms the 8/8 post');

  // Writing autosave: type into Part B1 + Part C, check the word counter.
  await page.locator('#w1').fill('Estimates differ, so a careful reader says "up to" and "unaccounted for", not exact totals.');
  await page.locator('#wc').fill('One two three four five');
  ok(((await page.locator('#wcCount').textContent()) || '').includes('5 words'), 'Part C word counter live', await page.locator('#wcCount').textContent());

  // Share kit (page is a plain flow — bar is reachable here).
  await page.locator('[data-cmc-share]').click();
  ok(await page.locator('#cmcShare.show').count() === 1, 'share menu opens');
  await page.locator('[data-cmc-copy]').click();
  await page.waitForTimeout(400);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  ok(clip.endsWith('/dev-pick-ghost-mountain.html'), 'Copy assignment link copies the page URL', clip);

  // Reload: identity AND writing come back.
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#quiz .q', { timeout: 8000 });
  ok((await page.locator('#cmcNameIn').inputValue()) === 'Dara', 'name prefilled on return');
  ok((await page.locator('#cmcIdIn').inputValue()) === '9B', 'ID prefilled on return');
  ok((await page.locator('#w1').inputValue()).includes('unaccounted for'), 'Part B writing autosaved');
  await page.screenshot({ path: join(SHOTS, 'devpick-quiz.png'), fullPage: false });
  await ctx.close();
}

// 3b. mobile: no horizontal overflow.
{
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/dev-pick-ghost-mountain.html`, { waitUntil: 'load' });
  await page.waitForSelector('#quiz .q', { timeout: 8000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(overflow === 0, 'mobile: zero horizontal overflow', `${overflow}px`);
  await page.screenshot({ path: join(SHOTS, 'devpick-mobile.png') });
  await ctx.close();
}

await browser.close();
server.close();

console.log(`\nverify_dev_pick: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
