// Verify the Kid 11 Unit 15 homework feature (owner request, Nov 2026):
//
//   "another on needing the same implementation-"  (Unit 15 · DNA Bank file)
//
// The teacher's unit15.html (DNA Bank — Homework 1 Lab Induction 30 pts,
// Homework 2 Chain-Reaction Analyst 28 pts, Homework 3 Conservation
// Campaigner 16 pts) ships 1:1 to public/rfc3/unit15hw.html with the SAME
// site furniture Unit 13 got. EACH homework is gated by its own Firestore
// doc (biweekly_tests/hw-kid11-u15-hw1|2|3 — public read, teacher-only
// write, no rules change):
//   · students see ONLY the shared homeworks — unshared tabs are hidden and
//     a deep link to an unshared homework falls back to the first shared one;
//   · no homework shared → full-page locked overlay;
//   · teachers get a preview banner and can preview any homework by deep link;
//   · the Kid 11 card carries one share switch per homework; unshared Unit 15
//     rows are completely invisible to students;
//   · the card fold always carries open homework (Unit 15 rows sit beyond the
//     first two, so an assigned Unit 15 homework must survive the fold).
// Plus the shipped furniture: Submit-to-Teacher per active homework
// (drill_attempts guest branch, name gate), Share menu, back-to-CMC.
import { chromium } from 'playwright';
import { readFile, readdir } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const SRC_TEACHER = '/home/z/my-project/upload/unit15.html';
const PORT = 8955; const BASE = `http://127.0.0.1:${PORT}`;
mkdirSync('/home/z/my-project/tmp/cmc-site/scripts/qa', { recursive: true });
const SHOTS = '/home/z/my-project/tmp/cmc-site/scripts/qa';

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}${extra ? ' — ' + extra : ''}`); }
};

// ── static server over dist/ ─────────────────────────────────────────────
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

// Mutable share state used by every route below.
const sharedState = { hw1: false, hw2: false, hw3: false };
const U15_ROUTE = '**/documents/biweekly_tests/hw-kid11-u15-hw*';
const U13_ROUTE = '**/documents/biweekly_tests/hw-kid11-u13-hw*';
const DF_ROUTE = '**/documents/biweekly_tests/hw-kid11-u14-hw*';
// Unit 13 and the three Unit 14 (Doctor Fish) docs stay CLOSED for every
// Unit 15 scenario here — closed docs must never leak to the real network.
const routeOtherClosed = (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' });
const docBody = (doc, shared) => JSON.stringify({
  name: `projects/demo/databases/(default)/documents/biweekly_tests/${doc}`,
  fields: { shared: { booleanValue: shared } },
});
function routeU15(shared) {
  return (route) => {
    const url = route.request().url();
    const m = /hw-kid11-u15-(hw[123])/.exec(url);
    if (!m) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: docBody(`hw-kid11-u15-${m[1]}`, shared[m[1]]) });
  };
}

const TEACHER_JWT = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ email_verified: true, email: 'teacher@school.edu', user_id: 'teacher-uid-1' })).toString('base64url') + '.sig';
const TEACHER_SEED = {
  'cmc-student-token': TEACHER_JWT,
  'cmc-student-token-expires': String(Date.now() + 3600_000),
  'cmc-student-refresh-token': 'verify-refresh-token',
  'cmc-student-role': 'teacher',
  'cmc-student-email': 'teacher@school.edu',
  'cmc-student-uid': 'teacher-uid-1',
  'cmc-student-name': 'Teacher Verify',
};

// ── 1. static checks on the worksheet build ──────────────────────────────
console.log('static · dist/rfc3/unit15hw.html');
let ws = '';
try { ws = await readFile(join(DIST, 'rfc3/unit15hw.html'), 'utf8'); } catch {}
ok(ws.length > 70000, 'worksheet shipped into dist/ (non-trivial size)', `${ws.length} bytes`);

// 1a. Answer keys — every graded key survives the build in teacher order.
const seq = (text) => [...text.matchAll(/data-(?:answer|correct|solution)="([^"]+)"/g)].map(m => m[1]);
const KEY = [
  // HW1 · 1.1 word meanings, 1.2 gap fill, 1.3 comprehension, 1.4 true/false, 1.5 acronyms
  'h', 'e', 'a', 'g', 'c', 'f', 'd', 'b',
  'laws|law', 'issue', 'global', 'samples|sample', 'evolved|evolve', 'knowledge', 'support', 'crucial',
  'b', 'c', 'a', 'b', 'c',
  'F', 'F', 'T', 'T', 'F',
  'd', 'a', 'b', 'c',
  // HW2 · 2.1 cascade order (solution), 2.2 cause→effect, 2.3 sort, 2.4 predictions, 2.5 claim check
  'bees,plants,eaters,food,environment',
  'c', 'a', 'b', 'd', 'e', 'f',
  'cause', 'effect', 'cause', 'effect', 'cause', 'effect', 'cause', 'effect',
  'b', 'c', 'a', 'b',
  'b', 'c', 'a', 'a',
  // HW3 · 3.1 fact/opinion sort, 3.6 closing message
  'fact', 'opinion', 'fact', 'opinion', 'fact', 'opinion', 'fact', 'opinion',
  'c',
];
const builtKeys = seq(ws);
ok(builtKeys.length === 62 && JSON.stringify(builtKeys) === JSON.stringify(KEY), 'all 62 key attributes present in order (74 graded units: HW1 30 + HW2 28 + HW3 16)', `got ${builtKeys.length}`);
try {
  const teacherSrc = await readFile(SRC_TEACHER, 'utf8');
  ok(JSON.stringify(seq(teacherSrc)) === JSON.stringify(builtKeys), 'graded keys match the teacher\'s unit15.html byte-for-byte (1:1 attachment)');
} catch { console.log('  (teacher source file unavailable — KEY pin only)'); }
ok(ws.includes('w-analysis') && ws.includes('w-slogan') && ws.includes('w-campaign') && ws.includes('w-q1') && ws.includes('w-a2'), 'all 8 live-checklist write tasks present (HW2 1 + HW3 7)');
ok(ws.includes('50–80 words') && ws.includes("unit:'chars'"), 'write-task checklists kept from the teacher file');

// 1b. Furniture needles — the same homework fixture Unit 13 shipped.
for (const [needle, label] of [
  ['id="submitBtn"', 'Submit-to-Teacher completion button present'],
  ['Submit to Teacher', 'submit button label'],
  ['function submitCompletion', 'completion submit handler present'],
  ['documents/drill_attempts', 'posts to the drill_attempts pipeline'],
  ["drillSource: { stringValue: 'rfc3' }", 'drillSource rfc3 (Kid 11 book source)'],
  ["drillSlug:   { stringValue: 'unit15hw.html' }", 'drillSlug pinned to unit15hw.html'],
  ['Homework 1 · Lab Induction', 'HW1 title on the completion payload'],
  ['Homework 2 · Chain-Reaction Analyst', 'HW2 title on the completion payload'],
  ['Homework 3 · Conservation Campaigner', 'HW3 title on the completion payload'],
  ['cmc-student-token', 'signed-in students submit under their session token'],
  ['cmc-student-refresh-token', 'expired sessions refresh via securetoken'],
  ['classId:       { nullValue: null }', 'classId null (guest-branch compliant)'],
  ['Add your name first', 'name gate before submit'],
  ['Back to CMC', 'back-to-CMC button (rfc3 worksheet pattern)'],
  ['wa.me', 'share: WhatsApp'],
  ['t.me/share', 'share: Telegram'],
  ['mailto:', 'share: Email'],
  ['data-cmc-copy', 'share: copy link'],
]) ok(ws.includes(needle), label);
ok(!ws.includes('inviteMode'), 'no inviteMode key (rules notInviteMode guard satisfied)');
ok(!ws.includes('u13hw') && !ws.includes('New Homes for Animals'), 'no Unit 13 leftovers in the Unit 15 file');
ok(!/TODO|XXX|【/.test(ws), 'no leftover placeholders');

// 1c. Name/date fields stay readable (unit15 hero theme: light ink on dark input).
ok(ws.includes('background:rgba(0,0,0,.35);border-radius:6px;padding:9px 12px;font:inherit;color:var(--ink)'), 'hero inputs: opaque dark box + theme ink (readable)');
ok(ws.includes('.meta input::placeholder{color:#7b8ca8}') && ws.includes('.meta input::placeholder{color:#6d7a72;opacity:1;font-weight:600}'), 'hero inputs: worksheet placeholder kept + furniture placeholder override shipped');

// 1d. Per-homework share gate pins.
for (const [needle, label] of [
  ['hw-kid11-u15-hw1', 'gate reads share doc 1'],
  ['hw-kid11-u15-hw2', 'gate reads share doc 2'],
  ['hw-kid11-u15-hw3', 'gate reads share doc 3'],
  ['d.fields.shared.booleanValue === true', 'gate opens only on shared:true'],
  ['hw-pending', 'content hidden while the share state resolves'],
  ['Homework not shared yet', 'locked overlay for students'],
  ['Ask your teacher to share it from the <b>Kid 11 card</b>', 'lock message points at the Kid 11 card switch'],
  ['Unit 15 homework</b> (DNA Bank)', 'lock message names Unit 15 · DNA Bank'],
  ['hw-teacher-locked', 'teacher preview state'],
  ['Share with students', 'banner tells the teacher which switch opens it'],
  ['btn.hidden = !teacher && known[h.mode] !== true', 'students: unshared homework tabs do not exist'],
  ['firstSharedMode', 'deep links fall back to the first shared homework'],
]) ok(ws.includes(needle), label);

// ── 2. Kid 11 card bundle carries the multi-homework section ─────────────
console.log('static · KidGradeHub bundle');
const assets = await readdir(join(DIST, 'assets'));
const hubChunk = assets.find((f) => f.startsWith('KidGradeHub-') && f.endsWith('.js'));
ok(!!hubChunk, 'KidGradeHub chunk exists in dist/assets');
if (hubChunk) {
  const hub = await readFile(join(DIST, 'assets', hubChunk), 'utf8');
  ok(hub.includes('Online homework'), 'Online homework section in the Kid 11 card bundle');
  ok(hub.includes('unit15hw.html#hw-a') && hub.includes('unit15hw.html#hw-b') && hub.includes('unit15hw.html#hw-c'), 'Kid 11 card links all three Unit 15 homeworks');
  ok(hub.includes('hw-kid11-u15-hw1') && hub.includes('hw-kid11-u15-hw2') && hub.includes('hw-kid11-u15-hw3'), 'card polls the three Unit 15 share docs');
  ok(hub.includes('Unit 15 · Homework 1 — Lab Induction'), 'U15 HW1 row title');
  ok(hub.includes('Unit 15 · Homework 2 — Chain-Reaction Analyst'), 'U15 HW2 row title');
  ok(hub.includes('Unit 15 · Homework 3 — Conservation Campaigner'), 'U15 HW3 row title');
  ok(hub.includes('hideUntilShared'), 'hide-until-shared rule shipped (students never see unassigned homework)');
  ok(hub.includes('More homeworks'), 'card fold control still shipped (7 homework rows now)');
}

// ── 3. worksheet behavior in a real browser ──────────────────────────────
console.log('browser · worksheet — share gate');
const browser = await chromium.launch();

// 3a. Student + NOTHING shared → locked overlay, all tabs hidden.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.route(U15_ROUTE, routeU15(sharedState));
  await page.route(U13_ROUTE, routeOtherClosed);
  await page.route(DF_ROUTE, routeOtherClosed);
  await page.goto(`${BASE}/rfc3/unit15hw.html`, { waitUntil: 'load' });
  await page.waitForSelector('#hwGate', { timeout: 8000 });
  ok(await page.locator('#hwGate').isVisible(), 'locked overlay shown when no homework is shared');
  ok(((await page.locator('#hwGate h1').textContent()) || '').includes('Homework not shared yet'), 'overlay headline');
  ok(((await page.locator('#hwGate p').textContent()) || '').includes('DNA Bank'), 'overlay names the Unit 15 DNA Bank homework');
  ok(await page.locator('[data-answer]').first().isHidden(), 'worksheet questions hidden behind the gate');
  ok(await page.locator('.switch-btn[data-mode="a"]').isHidden(), 'HW1 tab hidden from students');
  ok(await page.locator('.switch-btn[data-mode="b"]').isHidden(), 'HW2 tab hidden from students');
  ok(await page.locator('.switch-btn[data-mode="c"]').isHidden(), 'HW3 tab hidden from students');
  await page.screenshot({ path: join(SHOTS, 'unit15-locked.png'), fullPage: false });
  await ctx.close();
}

// 3b. Teacher + nothing shared → preview works, banner explains, all tabs.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const [k, v] of Object.entries(TEACHER_SEED)) await ctx.addInitScript(([key, val]) => localStorage.setItem(key, val), [k, v]);
  const page = await ctx.newPage();
  await page.route(U15_ROUTE, routeU15(sharedState));
  await page.route(U13_ROUTE, routeOtherClosed);
  await page.route(DF_ROUTE, routeOtherClosed);
  await page.goto(`${BASE}/rfc3/unit15hw.html`, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  ok(await page.locator('#hwGate').count() === 0, 'teacher bypasses the lock (no overlay)');
  ok(await page.locator('#hwBanner').isVisible(), 'teacher preview banner visible while locked for students');
  ok(await page.locator('.switch-btn[data-mode="a"]').isVisible(), 'teacher sees HW1 tab');
  ok(await page.locator('.switch-btn[data-mode="b"]').isVisible(), 'teacher sees HW2 tab');
  ok(await page.locator('.switch-btn[data-mode="c"]').isVisible(), 'teacher sees HW3 tab');
  await page.goto(`${BASE}/rfc3/unit15hw.html?preview=hw-b#hw-b`, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  ok(await page.locator('#hw-b').isVisible(), 'teacher deep link #hw-b previews Homework 2');
  ok(await page.locator('#hw-a').isHidden(), 'HW1 hidden while previewing Homework 2');
  await ctx.close();
}

// 3c. Student + ONLY HW1 shared → exactly one tab; deep link to HW2 falls back.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const mine = { hw1: true, hw2: false, hw3: false };
  await page.route(U15_ROUTE, routeU15(mine));
  await page.route(U13_ROUTE, routeOtherClosed);
  await page.route(DF_ROUTE, routeOtherClosed);
  await page.goto(`${BASE}/rfc3/unit15hw.html#hw-b`, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  ok(await page.locator('#hwGate').count() === 0, 'shared homework opens for students (no overlay)');
  ok(await page.locator('.switch-btn[data-mode="a"]').isVisible(), 'HW1 tab visible for students');
  ok(await page.locator('.switch-btn[data-mode="b"]').isHidden(), 'HW2 tab does not exist for students (only HW1 assigned)');
  ok(await page.locator('.switch-btn[data-mode="c"]').isHidden(), 'HW3 tab does not exist for students');
  ok(await page.locator('#hw-a').isVisible(), 'deep link to an unshared homework falls back to Homework 1');
  ok(await page.locator('#hw-b').isHidden(), 'Homework 2 content stays hidden behind the deep link');
  ok(await page.locator('#hw-c').isHidden(), 'Homework 3 content stays hidden');
  ok(await page.evaluate(() => document.body.dataset.mode) === 'a', 'active homework is the one the teacher assigned');
  await page.screenshot({ path: join(SHOTS, 'unit15-hw1-only.png'), fullPage: false });
  await ctx.close();
}

console.log('browser · worksheet — completion submit (student, HW1)');
const submits = [];
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const mine = { hw1: true, hw2: false, hw3: false };
  await page.route(U15_ROUTE, routeU15(mine));
  await page.route(U13_ROUTE, routeOtherClosed);
  await page.route(DF_ROUTE, routeOtherClosed);
  await page.route('**/documents/drill_attempts*', async (route) => {
    const req = route.request();
    submits.push({ headers: req.headers(), body: JSON.parse(req.postData() || '{}') });
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"name":"projects/demo/databases/(default)/documents/drill_attempts/verify"}' });
  });
  await page.goto(`${BASE}/rfc3/unit15hw.html`, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  // Name/date readability — computed styles on the Unit 15 hero.
  const nameStyles = await page.locator('#hw-a .meta input').first().evaluate((el) => {
    const cs = getComputedStyle(el);
    const ph = getComputedStyle(el, '::placeholder').color;
    return { bg: cs.backgroundColor, color: cs.color, placeholder: ph, caret: cs.caretColor };
  });
  const rgba = (s) => (s.match(/rgba?\(([^)]+)\)/) || [])[1]?.split(',').map(Number) || [];
  const [cr, cg, cb2] = rgba(nameStyles.color);
  const [br, bg2, bb] = rgba(nameStyles.bg);
  ok(cr > 180 && cg > 180 && cb2 > 180, 'name field text is light ink on the dark input (readable)', nameStyles.color);
  ok(br < 40 && bg2 < 40 && bb < 60, 'name field sits on an opaque dark box', nameStyles.bg);
  ok(nameStyles.placeholder.startsWith('rgb(109, 122, 114') || nameStyles.placeholder.startsWith('rgba(109, 122, 114'), 'placeholder is the shared homework-furniture grey, visible on the dark box', nameStyles.placeholder);

  // Name gate: no name → blocked, no POST.
  await page.locator('.hw-bar #submitBtn').click();
  await page.waitForTimeout(400);
  ok(submits.length === 0, 'submit without a name is blocked (no POST)');
  ok(((await page.locator('#cmcToast').textContent()) || '').includes('Add your name first'), 'name gate toast explains why');

  // Fill the name — it mirrors into the other two heroes.
  await page.locator('#hw-a .meta input').first().fill('Dara Kim');
  await page.locator('#hw-a .meta input').nth(1).fill('2026-11-12');
  await page.evaluate(() => {
    const root = document.getElementById('hw-b');
    root.querySelectorAll('.meta input').forEach((inp) => inp.dispatchEvent(new Event('input', { bubbles: true })));
  });
  ok((await page.locator('#hw-b .meta input').first().inputValue()) === 'Dara Kim', 'name mirrors into Homework 2 hero');
  ok((await page.locator('#hw-b .meta input').nth(1).inputValue()) === '2026-11-12', 'date mirrors into Homework 2 hero');

  // Blank submit → 0/30 payload through the guest branch.
  await page.getByRole('button', { name: 'Run Lab Check' }).click();
  await page.waitForTimeout(300);
  ok(((await page.locator('#hw-a .score-line').textContent()) || '').trim() === '0 / 30 points', 'HW1 blanks score 0 / 30 points');
  await page.locator('.hw-bar #submitBtn').click();
  await page.waitForTimeout(500);
  ok(submits.length === 1, 'named blank submit POSTs once');
  {
    const b = submits[0]?.body?.fields ?? {};
    const h = submits[0]?.headers ?? {};
    ok(b.drillSlug?.stringValue === 'unit15hw.html', 'payload drillSlug unit15hw.html');
    ok(b.drillTitle?.stringValue === 'Unit 15 · DNA Bank — Homework 1 · Lab Induction', 'payload names Unit 15 · Homework 1 · Lab Induction', b.drillTitle?.stringValue);
    ok(b.drillSource?.stringValue === 'rfc3', 'payload drillSource rfc3');
    ok(b.studentName?.stringValue === 'Dara Kim', 'payload carries the student name');
    ok(b.studentUid?.stringValue === '', 'guest branch: studentUid empty');
    ok(b.totalCount?.integerValue === '30' && b.correctCount?.integerValue === '0' && b.scorePct?.integerValue === '0', 'blank run scores 0/30 → 0%');
    ok(b.classId && b.classId.nullValue === null, 'classId null (guest-branch compliant)');
    ok(!h.authorization, 'guest POST carries no Authorization header');
  }

  // Answer every 1.1 word-meaning correctly → 8/30 on the next submit.
  await page.evaluate(() => {
    const answers = ['h', 'e', 'a', 'g', 'c', 'f', 'd', 'b'];
    document.querySelectorAll('#hw-a .task')[1].querySelectorAll('.g-item').forEach((q, i) => {
      const sel = q.querySelector('select');
      sel.value = answers[i];
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
  await page.getByRole('button', { name: 'Run Lab Check' }).click();
  await page.waitForTimeout(300);
  ok(((await page.locator('#hw-a .score-line').textContent()) || '').trim() === '8 / 30 points', '8 correct word meanings score 8 / 30 points');
  await page.locator('.hw-bar #submitBtn').click();
  await page.waitForTimeout(500);
  {
    const b = submits[1]?.body?.fields ?? {};
    ok(b.correctCount?.integerValue === '8' && b.scorePct?.integerValue === '27', 'partial run scores 8/30 → 27%', JSON.stringify(b));
  }
  await ctx.close();
}

// 3d. Teacher on the open page: switch to Analyst, submit names Homework 2.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const [k, v] of Object.entries(TEACHER_SEED)) await ctx.addInitScript(([key, val]) => localStorage.setItem(key, val), [k, v]);
  const page = await ctx.newPage();
  await page.route(U15_ROUTE, routeU15(sharedState));
  await page.route(U13_ROUTE, routeOtherClosed);
  await page.route(DF_ROUTE, routeOtherClosed);
  await page.route('**/documents/drill_attempts*', async (route) => {
    const req = route.request();
    submits.push({ headers: req.headers(), body: JSON.parse(req.postData() || '{}') });
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"name":"x"}' });
  });
  await page.goto(`${BASE}/rfc3/unit15hw.html`, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.locator('.switch-btn[data-mode="b"]').click();
  ok(await page.locator('#hw-b').isVisible(), 'teacher can switch to Homework 2');
  await page.locator('.hw-bar #submitBtn').click();
  await page.waitForTimeout(500);
  {
    const b = submits[submits.length - 1]?.body?.fields ?? {};
    ok((b.drillTitle?.stringValue || '').includes('Homework 2 · Chain-Reaction Analyst'), 'Analyst submit names Homework 2');
    ok(b.studentName?.stringValue === 'Teacher Verify', 'signed-in name prefilled from the session (mirrored to HW2 hero)');
    ok(b.totalCount?.integerValue === '28', 'Homework 2 grades out of 28 points');
  }
  await page.locator('.switch-btn[data-mode="c"]').click();
  await page.locator('.hw-bar #submitBtn').click();
  await page.waitForTimeout(500);
  {
    const b = submits[submits.length - 1]?.body?.fields ?? {};
    ok((b.drillTitle?.stringValue || '').includes('Homework 3 · Conservation Campaigner'), 'Campaigner submit names Homework 3');
    ok(b.totalCount?.integerValue === '16', 'Homework 3 grades out of 16 points');
  }
  await ctx.close();
}

// 3e. Gate auto-unlock: teacher shares HW1 in another tab → gate lifts, tab appears.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const mine = { hw1: false, hw2: false, hw3: false };
  await page.route(U15_ROUTE, routeU15(mine));
  await page.route(U13_ROUTE, routeOtherClosed);
  await page.route(DF_ROUTE, routeOtherClosed);
  await page.goto(`${BASE}/rfc3/unit15hw.html`, { waitUntil: 'load' });
  await page.waitForSelector('#hwGate', { timeout: 8000 });
  ok(await page.locator('#hwGateCheck').isVisible(), 'gate offers a Check-again button');
  mine.hw1 = true; // teacher flips the switch on the card (another tab)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(() => !document.getElementById('hwGate'), null, { timeout: 8000 });
  ok(true, 'sharing Homework 1 in another tab drops the gate without a reload');
  ok(await page.evaluate(() => document.documentElement.classList.contains('hw-open')), 'page flips to hw-open state');
  ok(await page.locator('.switch-btn[data-mode="a"]').isVisible(), 'HW1 tab appears for the student');
  ok(await page.locator('.switch-btn[data-mode="b"]').isHidden(), 'HW2 tab still hidden after the unlock');
  ok(await page.locator('#hw-a').isVisible(), 'Homework 1 content visible after the auto-unlock');
  // Now the teacher closes HW1 again → everything re-locks live.
  mine.hw1 = false;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForSelector('#hwGate', { timeout: 8000 });
  ok(await page.locator('#hwGate').isVisible(), 'closing the homework re-locks the page without a reload');
  ok(await page.evaluate(() => document.documentElement.classList.contains('hw-pending')), 'page flips back to hw-pending');
  await ctx.close();
}

// 3f. Auto-switch: student on HW2 (shared) when the teacher closes it → falls back to HW1.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const mine = { hw1: true, hw2: true, hw3: false };
  await page.route(U15_ROUTE, routeU15(mine));
  await page.route(U13_ROUTE, routeOtherClosed);
  await page.route(DF_ROUTE, routeOtherClosed);
  await page.goto(`${BASE}/rfc3/unit15hw.html#hw-b`, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  ok(await page.locator('#hw-b').isVisible(), 'student opens shared Homework 2 via deep link');
  ok(await page.locator('.switch-btn[data-mode="b"]').isVisible(), 'HW2 tab visible while shared');
  mine.hw2 = false; // teacher closes Homework 2
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(600);
  ok(await page.locator('.switch-btn[data-mode="b"]').isHidden(), 'HW2 tab vanishes the moment the teacher closes it');
  ok(await page.locator('#hw-b').isHidden(), 'Homework 2 content hides live');
  ok(await page.locator('#hw-a').isVisible(), 'page auto-switches to the still-shared Homework 1');
  ok(await page.evaluate(() => document.body.dataset.mode) === 'a', 'active homework switched to Homework 1');
  await ctx.close();
}

// ── 4. Kid 11 card ───────────────────────────────────────────────────────
console.log('browser · Kid 11 card — Unit 15 switches + fold safety');
// 4a. Teacher: three Unit 15 rows with switches; PATCH opens exactly one;
//     the assigned Unit 15 row (beyond the first two) survives the fold.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  for (const [k, v] of Object.entries(TEACHER_SEED)) await ctx.addInitScript(([key, val]) => localStorage.setItem(key, val), [k, v]);
  const page = await ctx.newPage();
  const patches = [];
  await page.route(U15_ROUTE, (route) => {
    const req = route.request();
    const m = /hw-kid11-u15-(hw[123])/.exec(req.url());
    if (req.method() === 'PATCH') {
      const body = JSON.parse(req.postData() || '{}');
      patches.push({ doc: m?.[1], body });
      if (body.fields?.shared?.booleanValue === true) sharedState[m[1]] = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: docBody(`hw-kid11-u15-${m[1]}`, sharedState[m[1]]) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: docBody(`hw-kid11-u15-${m[1]}`, sharedState[m[1]]) });
  });
  await page.route(U13_ROUTE, routeOtherClosed);
  await page.route(DF_ROUTE, routeOtherClosed);
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const el = document.getElementById('kid-grades');
    if (el && !document.body.textContent?.includes('Online homework')) {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
    return document.body.textContent?.includes('Online homework') ?? false;
  }, null, { timeout: 30000 });
  await page.waitForTimeout(600);
  const kid11card = page.locator('#kid-grades article').filter({ hasText: 'Reading Future Create 3' });
  ok(((await kid11card.textContent())?.includes('13 resources')), 'Kid 11 badge counts 13 resources (4 sheets + three Unit 14 + three Unit 13 + three Unit 15 homeworks)');
  // Folded: teacher sees the first two rows (the two Unit 14 · Doctor Fish
  // homeworks); the seven others — including all Unit 13 and Unit 15 rows —
  // stay folded away.
  const moreBtn = kid11card.locator('button[aria-expanded]');
  ok(await moreBtn.count() === 1, 'folded card carries exactly one More control');
  ok((await moreBtn.getAttribute('aria-expanded')) === 'false', 'fold starts collapsed (aria-expanded=false)');
  ok(((await moreBtn.textContent()) || '').includes('More homeworks · 7 more'), 'fold label counts the seven rows still folded away', await moreBtn.textContent());
  ok(await kid11card.locator('button[aria-label*="Share Unit 15 · Homework 1"][aria-label*="with students"]').count() === 0, 'fold hides the Unit 15 Homework 1 switch');
  await moreBtn.click();
  await page.waitForTimeout(400);
  ok((await moreBtn.getAttribute('aria-expanded')) === 'true', 'More unfolds the homework list');
  ok(await kid11card.locator('button[aria-label*="Share Unit 15 · Homework 1"][aria-label*="with students"]').count() === 1, 'teacher sees the share switch for Unit 15 Homework 1');
  ok(await kid11card.locator('button[aria-label*="Share Unit 15 · Homework 2"][aria-label*="with students"]').count() === 1, 'teacher sees the share switch for Unit 15 Homework 2');
  ok(await kid11card.locator('button[aria-label*="Share Unit 15 · Homework 3"][aria-label*="with students"]').count() === 1, 'teacher sees the share switch for Unit 15 Homework 3');
  // Assign ONLY Unit 15 Homework 1.
  await kid11card.locator('button[aria-label*="Share Unit 15 · Homework 1"][aria-label*="with students"]').click();
  await page.waitForTimeout(800);
  ok(patches.length === 1 && patches[0].doc === 'hw1', 'switch PATCHes Unit 15 Homework 1\'s own share doc', JSON.stringify(patches.map(p => p.doc)));
  ok(patches[0]?.body?.fields?.homeworkId?.stringValue === 'kid-11-homework-u15-hw1', 'PATCH carries the Unit 15 homework id');
  const hw1Link = kid11card.locator('a[aria-label*="Unit 15 · Homework 1 — Lab Induction"]');
  ok(await hw1Link.count() === 1, 'assigned homework row flips open — Open link appears');
  ok((await hw1Link.getAttribute('href'))?.endsWith('/rfc3/unit15hw.html#hw-a'), 'open row deep links to Unit 15 Homework 1');
  ok(await kid11card.locator('a[aria-label*="Unit 15 · Homework 2"]').count() === 0, 'unshared Unit 15 Homework 2 stays invisible on the card');
  ok(await kid11card.locator('a[aria-label*="Unit 15 · Homework 3"]').count() === 0, 'unshared Unit 15 Homework 3 stays invisible on the card');
  const shareBtn = kid11card.locator('button[aria-label^="Share Unit 15 · Homework 1"][aria-label*="homework link"]');
  ok(await shareBtn.count() === 1, 'open row offers the link Share button');
  await shareBtn.click();
  await page.waitForTimeout(500);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  ok(clip.endsWith('/rfc3/unit15hw.html#hw-a'), 'card Share button copies the absolute Unit 15 homework URL', clip);
  // Fold again — the assigned Unit 15 homework (row 7 of 9) must stay visible.
  await moreBtn.click();
  await page.waitForTimeout(400);
  ok(((await moreBtn.textContent()) || '').includes('More homeworks · 6 more'), 'folded label drops to 6 (the assigned Unit 15 row rides along)', await moreBtn.textContent());
  ok(await kid11card.locator('a[aria-label*="Unit 15 · Homework 1 — Lab Induction"]').count() === 1, 'assigned Unit 15 Homework 1 stays visible on the folded card (fold never hides open work)');
  ok(await kid11card.locator('button[aria-label*="Share Unit 15 · Homework 2"][aria-label*="with students"]').count() === 0, 'folded card hides the Unit 15 Homework 2 switch again');
  await kid11card.screenshot({ path: join(SHOTS, 'unit15-kid11-card.png') });
  await ctx.close();
}

// 4b. Student: only the assigned Unit 15 row exists; Unit 13 rows stay hidden.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const mine = { hw1: true, hw2: false, hw3: false };
  await page.route(U15_ROUTE, routeU15(mine));
  await page.route(U13_ROUTE, routeOtherClosed);
  await page.route(DF_ROUTE, routeOtherClosed);
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const el = document.getElementById('kid-grades');
    if (el && !document.body.textContent?.includes('Online homework')) {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
    return document.body.textContent?.includes('Online homework') ?? false;
  }, null, { timeout: 30000 });
  await page.waitForTimeout(600);
  const kid11card = page.locator('#kid-grades article').filter({ hasText: 'Reading Future Create 3' });
  ok(await kid11card.locator('a[aria-label*="Unit 15 · Homework 1 — Lab Induction"]').count() === 1, 'student sees the assigned Unit 15 Homework 1 row');
  ok(((await kid11card.textContent())?.includes('Unit 15 · Homework 2 — Chain-Reaction Analyst')) === false, 'student never sees the unshared Unit 15 Homework 2 row');
  ok(((await kid11card.textContent())?.includes('Unit 15 · Homework 3 — Conservation Campaigner')) === false, 'student never sees the unshared Unit 15 Homework 3 row');
  ok(((await kid11card.textContent())?.includes('Unit 13 · Homework 1 — Field Notebook')) === false, 'student still never sees the unshared Unit 13 rows');
  ok(await kid11card.locator('button[aria-label*="with students"]').count() === 0, 'students never see any teacher key switch');
  ok(await kid11card.locator('button[aria-expanded]').count() === 0, 'student with the assigned homework in view: no fold control');
  await kid11card.screenshot({ path: join(SHOTS, 'unit15-kid11-card-student.png') });
  await ctx.close();
}

// ── 5. mobile ──────────────────────────────────────────────────────────
console.log('browser · mobile worksheet');
{
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true });
  const page = await ctx.newPage();
  const mine = { hw1: true, hw2: false, hw3: false };
  await page.route(U15_ROUTE, routeU15(mine));
  await page.route(U13_ROUTE, routeOtherClosed);
  await page.route(DF_ROUTE, routeOtherClosed);
  await page.goto(`${BASE}/rfc3/unit15hw.html`, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(overflow === 0, 'mobile: zero horizontal overflow', `${overflow}px`);
  await page.evaluate(() => {
    const tb = document.querySelector('#hw-a .toolbar');
    window.scrollTo({ top: tb.getBoundingClientRect().top + window.scrollY - 30 + 700, behavior: 'instant' });
  });
  await page.waitForTimeout(300);
  const toolbarTop = await page.locator('#hw-a .toolbar').first().evaluate((el) => el.getBoundingClientRect().top);
  ok(Math.abs(toolbarTop - 66) < 12, 'mobile: homework toolbar still sticks under the fixed header', `top=${Math.round(toolbarTop)}`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(SHOTS, 'unit15-mobile.png') });
  await ctx.close();
}

await browser.close();
server.close();

console.log(`\nverify_unit15_homework: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
