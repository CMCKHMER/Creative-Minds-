// Verify the Kid 11 Unit 14 homework feature (owner request, Nov 2026):
//
//   "ok i want you to remove the dr fish test and updated with this 3 part
//    one. implement it like the last ones"
//
// The old 2-assignment Doctor Fish page is REPLACED at the same url
// (public/rfc3/doctor-fish.html) with the teacher's 3-homework file
// (unit14.html — Homework 1 Spa Intake File 30 pts, Homework 2 Treatment
// Analyst 26 pts, Homework 3 Health Writer 16 pts = 72 graded units) with
// the SAME site furniture Units 13/15 shipped. EACH homework is gated by
// its own Firestore doc (biweekly_tests/hw-kid11-u14-hw1|2|3 — public read,
// teacher-only write, no rules change):
//   · students see ONLY the shared homeworks — unshared tabs are hidden and
//     a deep link to an unshared homework falls back to the first shared one;
//   · no homework shared → full-page locked overlay;
//   · teachers get a preview banner and can preview any homework by deep link;
//   · the Kid 11 card carries one share switch per homework (9 rows now);
//   · the card fold always carries open homework (an assigned Unit 14 row
//     beyond the first two must survive the fold).
// Plus the shipped furniture: Submit-to-Teacher per active homework
// (drill_attempts guest branch, name gate, email-as-name guards), Share
// menu, back-to-CMC, teacher preview banner.
import { chromium } from 'playwright';
import { readFile, readdir } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const SRC_TEACHER = '/home/z/my-project/upload/unit14.html';
const PORT = 8957; const BASE = `http://127.0.0.1:${PORT}`;
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
const U14_ROUTE = '**/documents/biweekly_tests/hw-kid11-u14-hw*';
const U13_ROUTE = '**/documents/biweekly_tests/hw-kid11-u13-hw*';
const U15_ROUTE = '**/documents/biweekly_tests/hw-kid11-u15-hw*';
// Unit 13 and Unit 15 stay CLOSED for every Unit 14 scenario here — closed
// docs must never leak to the real network.
const routeOtherClosed = (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' });
const docBody = (doc, shared) => JSON.stringify({
  name: `projects/demo/databases/(default)/documents/biweekly_tests/${doc}`,
  fields: { shared: { booleanValue: shared } },
});
function routeU14(shared) {
  return (route) => {
    const url = route.request().url();
    const m = /hw-kid11-u14-(hw[123])/.exec(url);
    if (!m) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: docBody(`hw-kid11-u14-${m[1]}`, shared[m[1]]) });
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
console.log('static · dist/rfc3/doctor-fish.html');
let ws = '';
try { ws = await readFile(join(DIST, 'rfc3/doctor-fish.html'), 'utf8'); } catch {}
ok(ws.length > 100000, 'worksheet shipped into dist/ (non-trivial size)', `${ws.length} bytes`);

// 1a. Answer keys — every graded key survives the build in teacher order.
const seq = (text) => [...text.matchAll(/data-(?:answer|correct|solution)="([^"]+)"/g)].map(m => m[1]);
const KEY = [
  // HW1 · 1.1 word meanings, 1.2 gap fill, 1.3 comprehension, 1.4 true/false, 1.5 conjunctive adverbs
  'h', 'b', 'd', 'f', 'a', 'e', 'c', 'g',
  'in particular', 'spring', 'treat', 'nutrients|nutrient', 'surround', 'severe', 'permanent', 'suffering from|suffer from',
  'b', 'c', 'a', 'b', 'c',
  'T', 'T', 'F', 'F', 'T',
  'd', 'a', 'b', 'd',
  // HW2 · 2.1 visitor journey (solution), 2.2 cause→effect, 2.3 sort, 2.4 brochure check, 2.5 main idea
  'arrive,sit,surround,eat,result',
  'c', 'a', 'b', 'd', 'e',
  'benefit', 'limitation', 'benefit', 'limitation', 'benefit', 'limitation', 'benefit', 'limitation',
  'b', 'a', 'c', 'a',
  'c', 'b', 'a',
  // HW3 · 3.1 fact/opinion sort, 3.6 balanced verdict
  'fact', 'opinion', 'fact', 'opinion', 'fact', 'opinion', 'fact', 'opinion',
  'b',
];
const builtKeys = seq(ws);
ok(builtKeys.length === 60 && JSON.stringify(builtKeys) === JSON.stringify(KEY), 'all 60 key attributes present in order (72 graded units: HW1 30 + HW2 26 + HW3 16)', `got ${builtKeys.length}`);
try {
  const teacherSrc = await readFile(SRC_TEACHER, 'utf8');
  ok(JSON.stringify(seq(teacherSrc)) === JSON.stringify(builtKeys), 'graded keys match the teacher\'s unit14.html byte-for-byte (1:1 attachment)');
} catch { console.log('  (teacher source file unavailable — KEY pin only)'); }
ok(ws.includes('w-summary') && ws.includes('w-headline') && ws.includes('w-feature') && ws.includes('w-r1') && ws.includes('w-p2'), 'all 8 live-checklist write tasks present (HW2 1 + HW3 7)');
ok(ws.includes('50–80 words') && ws.includes("unit:'chars'"), 'write-task checklists kept from the teacher file');
ok(ws.includes('Spa <em>Intake File</em>') && ws.includes('Treatment Analyst') && ws.includes('Health Writer'), 'the three homework heroes ship 1:1');
ok(ws.includes('garra rufa') && ws.includes('3,000 visitors') && ws.includes('21 days'), 'reading passage kept');

// 1b. Furniture needles — the same homework fixture Units 13/15 shipped.
for (const [needle, label] of [
  ['id="submitBtn"', 'Submit-to-Teacher completion button present'],
  ['Submit to Teacher', 'submit button label'],
  ['function submitCompletion', 'completion submit handler present'],
  ['documents/drill_attempts', 'posts to the drill_attempts pipeline'],
  ["drillSource: { stringValue: 'rfc3' }", 'drillSource rfc3 (Kid 11 book source)'],
  ["drillSlug:   { stringValue: 'doctor-fish.html' }", 'drillSlug stays doctor-fish.html (historical ticker rows group)'],
  ['Homework 1 · Spa Intake File', 'HW1 title on the completion payload'],
  ['Homework 2 · Treatment Analyst', 'HW2 title on the completion payload'],
  ['Homework 3 · Health Writer', 'HW3 title on the completion payload'],
  ['cmc-student-token', 'signed-in students submit under their session token'],
  ['cmc-student-refresh-token', 'expired sessions refresh via securetoken'],
  ['classId:       { nullValue: null }', 'classId null (guest-branch compliant)'],
  ['Add your name first', 'name gate before submit'],
  ['cmcLooksLikeEmail', 'email-as-name guard shipped (ticker name fix)'],
  ['cmcNameOf', 'email-as-name resolver shipped'],
  ['Back to CMC', 'back-to-CMC button (rfc3 worksheet pattern)'],
  ['wa.me', 'share: WhatsApp'],
  ['t.me/share', 'share: Telegram'],
  ['mailto:', 'share: Email'],
  ['data-cmc-copy', 'share: copy link'],
]) ok(ws.includes(needle), label);
ok(!ws.includes('inviteMode'), 'no inviteMode key (rules notInviteMode guard satisfied)');
ok(!ws.includes('unit13hw') && !ws.includes('New Homes for Animals'), 'no Unit 13 leftovers in the Unit 14 file');
ok(!ws.includes('unit15hw') && !ws.includes('DNA Bank'), 'no Unit 15 leftovers in the Unit 14 file');
ok(!ws.includes('Newsroom') && !ws.includes('FILE 14-NEWS'), 'no old 2-assignment Doctor Fish leftovers');
ok(!/TODO|XXX|【/.test(ws), 'no leftover placeholders');

// 1c. Name/date fields stay readable (unit14 hero theme: dark ink on white boxes).
ok(ws.includes('.meta input{color:var(--ink)!important;caret-color:var(--ink)!important;font-weight:600}'), 'hero inputs: theme ink pinned (readable)');
ok(ws.includes('.meta input::placeholder{color:#93a8ab;opacity:1;font-weight:600}'), 'hero inputs: furniture placeholder override shipped');

// 1d. Per-homework share gate pins.
for (const [needle, label] of [
  ['hw-kid11-u14-hw1', 'gate reads share doc 1'],
  ['hw-kid11-u14-hw2', 'gate reads share doc 2'],
  ['hw-kid11-u14-hw3', 'gate reads share doc 3'],
  ['d.fields.shared.booleanValue === true', 'gate opens only on shared:true'],
  ['hw-pending', 'content hidden while the share state resolves'],
  ['Homework not shared yet', 'locked overlay for students'],
  ['Ask your teacher to share it from the <b>Kid 11 card</b>', 'lock message points at the Kid 11 card switch'],
  ['Unit 14 homework</b> (Doctor Fish)', 'lock message names Unit 14 · Doctor Fish'],
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
  ok(hub.includes('doctor-fish.html#hw-a') && hub.includes('doctor-fish.html#hw-b') && hub.includes('doctor-fish.html#hw-c'), 'Kid 11 card links all three Unit 14 homeworks');
  ok(hub.includes('hw-kid11-u14-hw1') && hub.includes('hw-kid11-u14-hw2') && hub.includes('hw-kid11-u14-hw3'), 'card polls the three Unit 14 share docs');
  ok(hub.includes('Unit 14 · Homework 1 — Spa Intake File'), 'U14 HW1 row title');
  ok(hub.includes('Unit 14 · Homework 2 — Treatment Analyst'), 'U14 HW2 row title');
  ok(hub.includes('Unit 14 · Homework 3 — Health Writer'), 'U14 HW3 row title');
  ok(hub.includes('hideUntilShared'), 'hide-until-shared rule shipped (students never see unassigned homework)');
  ok(hub.includes('More homeworks'), 'card fold control still shipped (9 homework rows now)');
}

// ── 3. worksheet behavior in a real browser ──────────────────────────────
console.log('browser · worksheet — share gate');
const browser = await chromium.launch();

// 3a. Student + NOTHING shared → locked overlay, all tabs hidden.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.route(U14_ROUTE, routeU14(sharedState));
  await page.route(U13_ROUTE, routeOtherClosed);
  await page.route(U15_ROUTE, routeOtherClosed);
  await page.goto(`${BASE}/rfc3/doctor-fish.html`, { waitUntil: 'load' });
  await page.waitForSelector('#hwGate', { timeout: 8000 });
  ok(await page.locator('#hwGate').isVisible(), 'locked overlay shown when no homework is shared');
  ok(((await page.locator('#hwGate h1').textContent()) || '').includes('Homework not shared yet'), 'overlay headline');
  ok(((await page.locator('#hwGate p').textContent()) || '').includes('Doctor Fish'), 'overlay names the Unit 14 Doctor Fish homework');
  ok(await page.locator('[data-answer]').first().isHidden(), 'worksheet questions hidden behind the gate');
  ok(await page.locator('.tab[data-mode="a"]').isHidden(), 'HW1 tab hidden from students');
  ok(await page.locator('.tab[data-mode="b"]').isHidden(), 'HW2 tab hidden from students');
  ok(await page.locator('.tab[data-mode="c"]').isHidden(), 'HW3 tab hidden from students');
  await page.screenshot({ path: join(SHOTS, 'unit14-locked.png'), fullPage: false });
  await ctx.close();
}

// 3b. Teacher + nothing shared → preview works, banner explains, all tabs.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const [k, v] of Object.entries(TEACHER_SEED)) await ctx.addInitScript(([key, val]) => localStorage.setItem(key, val), [k, v]);
  const page = await ctx.newPage();
  await page.route(U14_ROUTE, routeU14(sharedState));
  await page.route(U13_ROUTE, routeOtherClosed);
  await page.route(U15_ROUTE, routeOtherClosed);
  await page.goto(`${BASE}/rfc3/doctor-fish.html`, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  ok(await page.locator('#hwGate').count() === 0, 'teacher bypasses the lock (no overlay)');
  ok(await page.locator('#hwBanner').isVisible(), 'teacher preview banner visible while locked for students');
  ok(await page.locator('.tab[data-mode="a"]').isVisible(), 'teacher sees HW1 tab');
  ok(await page.locator('.tab[data-mode="b"]').isVisible(), 'teacher sees HW2 tab');
  ok(await page.locator('.tab[data-mode="c"]').isVisible(), 'teacher sees HW3 tab');
  await page.goto(`${BASE}/rfc3/doctor-fish.html?preview=hw-b#hw-b`, { waitUntil: 'load' });
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
  await page.route(U14_ROUTE, routeU14(mine));
  await page.route(U13_ROUTE, routeOtherClosed);
  await page.route(U15_ROUTE, routeOtherClosed);
  await page.goto(`${BASE}/rfc3/doctor-fish.html#hw-b`, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  ok(await page.locator('#hwGate').count() === 0, 'shared homework opens for students (no overlay)');
  ok(await page.locator('.tab[data-mode="a"]').isVisible(), 'HW1 tab visible for students');
  ok(await page.locator('.tab[data-mode="b"]').isHidden(), 'HW2 tab does not exist for students (only HW1 assigned)');
  ok(await page.locator('.tab[data-mode="c"]').isHidden(), 'HW3 tab does not exist for students');
  ok(await page.locator('#hw-a').isVisible(), 'deep link to an unshared homework falls back to Homework 1');
  ok(await page.locator('#hw-b').isHidden(), 'Homework 2 content stays hidden behind the deep link');
  ok(await page.locator('#hw-c').isHidden(), 'Homework 3 content stays hidden');
  ok(await page.evaluate(() => document.body.dataset.mode) === 'a', 'active homework is the one the teacher assigned');
  await page.screenshot({ path: join(SHOTS, 'unit14-hw1-only.png'), fullPage: false });
  await ctx.close();
}

console.log('browser · worksheet — completion submit (student, HW1)');
const submits = [];
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const mine = { hw1: true, hw2: false, hw3: false };
  await page.route(U14_ROUTE, routeU14(mine));
  await page.route(U13_ROUTE, routeOtherClosed);
  await page.route(U15_ROUTE, routeOtherClosed);
  await page.route('**/documents/drill_attempts*', async (route) => {
    const req = route.request();
    submits.push({ headers: req.headers(), body: JSON.parse(req.postData() || '{}') });
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"name":"projects/demo/databases/(default)/documents/drill_attempts/verify"}' });
  });
  await page.goto(`${BASE}/rfc3/doctor-fish.html`, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  // Name/date readability — computed styles on the Unit 14 hero (light box).
  const nameStyles = await page.locator('#hw-a .meta input').first().evaluate((el) => {
    const cs = getComputedStyle(el);
    const ph = getComputedStyle(el, '::placeholder').color;
    return { bg: cs.backgroundColor, color: cs.color, placeholder: ph, caret: cs.caretColor };
  });
  const rgba = (s) => (s.match(/rgba?\(([^)]+)\)/) || [])[1]?.split(',').map(Number) || [];
  const [cr, cg, cb2] = rgba(nameStyles.color);
  const [br, bg2, bb] = rgba(nameStyles.bg);
  ok(cr < 90 && cg < 110 && cb2 < 110, 'name field text is dark theme ink on the white box (readable)', nameStyles.color);
  ok(br > 235 && bg2 > 235 && bb > 235, 'name field sits on an opaque white box', nameStyles.bg);
  ok(nameStyles.placeholder.startsWith('rgb(147, 168, 171') || nameStyles.placeholder.startsWith('rgba(147, 168, 171'), 'placeholder is the shared homework-furniture grey, visible on the white box', nameStyles.placeholder);

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
  await page.getByRole('button', { name: 'Check Intake File' }).click();
  await page.waitForTimeout(300);
  ok(((await page.locator('#hw-a .score-line').textContent()) || '').trim() === '0 / 30 points', 'HW1 blanks score 0 / 30 points');
  await page.locator('.hw-bar #submitBtn').click();
  await page.waitForTimeout(500);
  ok(submits.length === 1, 'named blank submit POSTs once');
  {
    const b = submits[0]?.body?.fields ?? {};
    const h = submits[0]?.headers ?? {};
    ok(b.drillSlug?.stringValue === 'doctor-fish.html', 'payload drillSlug doctor-fish.html');
    ok(b.drillTitle?.stringValue === 'Unit 14 · Doctor Fish — Homework 1 · Spa Intake File', 'payload names Unit 14 · Homework 1 · Spa Intake File', b.drillTitle?.stringValue);
    ok(b.drillSource?.stringValue === 'rfc3', 'payload drillSource rfc3');
    ok(b.studentName?.stringValue === 'Dara Kim', 'payload carries the student name');
    ok(b.studentUid?.stringValue === '', 'guest branch: studentUid empty');
    ok(b.totalCount?.integerValue === '30' && b.correctCount?.integerValue === '0' && b.scorePct?.integerValue === '0', 'blank run scores 0/30 → 0%');
    ok(b.classId && b.classId.nullValue === null, 'classId null (guest-branch compliant)');
    ok(!h.authorization, 'guest POST carries no Authorization header');
  }

  // Answer every 1.1 word-meaning correctly → 8/30 on the next submit.
  await page.evaluate(() => {
    const answers = ['h', 'b', 'd', 'f', 'a', 'e', 'c', 'g'];
    document.querySelectorAll('#hw-a .task')[1].querySelectorAll('.g-item').forEach((q, i) => {
      const sel = q.querySelector('select');
      sel.value = answers[i];
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
  await page.getByRole('button', { name: 'Check Intake File' }).click();
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
  await page.route(U14_ROUTE, routeU14(sharedState));
  await page.route(U13_ROUTE, routeOtherClosed);
  await page.route(U15_ROUTE, routeOtherClosed);
  await page.route('**/documents/drill_attempts*', async (route) => {
    const req = route.request();
    submits.push({ headers: req.headers(), body: JSON.parse(req.postData() || '{}') });
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"name":"x"}' });
  });
  await page.goto(`${BASE}/rfc3/doctor-fish.html`, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.locator('.tab[data-mode="b"]').click();
  ok(await page.locator('#hw-b').isVisible(), 'teacher can switch to Homework 2');
  await page.locator('.hw-bar #submitBtn').click();
  await page.waitForTimeout(500);
  {
    const b = submits[submits.length - 1]?.body?.fields ?? {};
    ok((b.drillTitle?.stringValue || '').includes('Homework 2 · Treatment Analyst'), 'Analyst submit names Homework 2');
    ok(b.studentName?.stringValue === 'Teacher Verify', 'signed-in name prefilled from the session (mirrored to HW2 hero)');
    ok(b.totalCount?.integerValue === '26', 'Homework 2 grades out of 26 points');
  }
  await page.locator('.tab[data-mode="c"]').click();
  await page.locator('.hw-bar #submitBtn').click();
  await page.waitForTimeout(500);
  {
    const b = submits[submits.length - 1]?.body?.fields ?? {};
    ok((b.drillTitle?.stringValue || '').includes('Homework 3 · Health Writer'), 'Health Writer submit names Homework 3');
    ok(b.totalCount?.integerValue === '16', 'Homework 3 grades out of 16 points');
  }
  await ctx.close();
}

// 3e. Gate auto-unlock: teacher shares HW1 in another tab → gate lifts, tab appears.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const mine = { hw1: false, hw2: false, hw3: false };
  await page.route(U14_ROUTE, routeU14(mine));
  await page.route(U13_ROUTE, routeOtherClosed);
  await page.route(U15_ROUTE, routeOtherClosed);
  await page.goto(`${BASE}/rfc3/doctor-fish.html`, { waitUntil: 'load' });
  await page.waitForSelector('#hwGate', { timeout: 8000 });
  ok(await page.locator('#hwGateCheck').isVisible(), 'gate offers a Check-again button');
  mine.hw1 = true; // teacher flips the switch on the card (another tab)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(() => !document.getElementById('hwGate'), null, { timeout: 8000 });
  ok(true, 'sharing Homework 1 in another tab drops the gate without a reload');
  ok(await page.evaluate(() => document.documentElement.classList.contains('hw-open')), 'page flips to hw-open state');
  ok(await page.locator('.tab[data-mode="a"]').isVisible(), 'HW1 tab appears for the student');
  ok(await page.locator('.tab[data-mode="b"]').isHidden(), 'HW2 tab still hidden after the unlock');
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
  await page.route(U14_ROUTE, routeU14(mine));
  await page.route(U13_ROUTE, routeOtherClosed);
  await page.route(U15_ROUTE, routeOtherClosed);
  await page.goto(`${BASE}/rfc3/doctor-fish.html#hw-b`, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  ok(await page.locator('#hw-b').isVisible(), 'student opens shared Homework 2 via deep link');
  ok(await page.locator('.tab[data-mode="b"]').isVisible(), 'HW2 tab visible while shared');
  mine.hw2 = false; // teacher closes Homework 2
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(600);
  ok(await page.locator('.tab[data-mode="b"]').isHidden(), 'HW2 tab vanishes the moment the teacher closes it');
  ok(await page.locator('#hw-b').isHidden(), 'Homework 2 content hides live');
  ok(await page.locator('#hw-a').isVisible(), 'page auto-switches to the still-shared Homework 1');
  ok(await page.evaluate(() => document.body.dataset.mode) === 'a', 'active homework switched to Homework 1');
  await ctx.close();
}

// ── 4. Kid 11 card ───────────────────────────────────────────────────────
console.log('browser · Kid 11 card — Unit 14 switches + fold safety');
// 4a. Teacher: three Unit 14 rows with switches; PATCH opens exactly one;
//     the assigned Unit 14 row (beyond the first two) survives the fold.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  for (const [k, v] of Object.entries(TEACHER_SEED)) await ctx.addInitScript(([key, val]) => localStorage.setItem(key, val), [k, v]);
  const page = await ctx.newPage();
  const patches = [];
  await page.route(U14_ROUTE, (route) => {
    const req = route.request();
    const m = /hw-kid11-u14-(hw[123])/.exec(req.url());
    if (req.method() === 'PATCH') {
      const body = JSON.parse(req.postData() || '{}');
      patches.push({ doc: m?.[1], body });
      if (body.fields?.shared?.booleanValue === true) sharedState[m[1]] = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: docBody(`hw-kid11-u14-${m[1]}`, sharedState[m[1]]) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: docBody(`hw-kid11-u14-${m[1]}`, sharedState[m[1]]) });
  });
  await page.route(U13_ROUTE, routeOtherClosed);
  await page.route(U15_ROUTE, routeOtherClosed);
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
  ok(await kid11card.locator('button[aria-label*="Share Unit 14 · Homework 1"][aria-label*="with students"]').count() === 1, 'teacher sees the share switch for Unit 14 Homework 1');
  ok(await kid11card.locator('button[aria-label*="Share Unit 14 · Homework 2"][aria-label*="with students"]').count() === 1, 'teacher sees the share switch for Unit 14 Homework 2');
  ok(await kid11card.locator('button[aria-label*="Share Unit 14 · Homework 3"][aria-label*="with students"]').count() === 1, 'teacher sees the share switch for Unit 14 Homework 3');
  // Assign ONLY Unit 14 Homework 3 (row 3 — beyond the first two rows).
  await kid11card.locator('button[aria-label*="Share Unit 14 · Homework 3"][aria-label*="with students"]').click();
  await page.waitForTimeout(800);
  ok(patches.length === 1 && patches[0].doc === 'hw3', 'switch PATCHes Unit 14 Homework 3\'s own share doc', JSON.stringify(patches.map(p => p.doc)));
  ok(patches[0]?.body?.fields?.homeworkId?.stringValue === 'kid-11-homework-u14-hw3', 'PATCH carries the Unit 14 homework id');
  const hw3Link = kid11card.locator('a[aria-label*="Unit 14 · Homework 3 — Health Writer"]');
  ok(await hw3Link.count() === 1, 'assigned homework row flips open — Open link appears');
  ok((await hw3Link.getAttribute('href'))?.endsWith('/rfc3/doctor-fish.html#hw-c'), 'open row deep links to Unit 14 Homework 3');
  ok(await kid11card.locator('a[aria-label*="Unit 14 · Homework 1"]').count() === 0, 'unshared Unit 14 Homework 1 shows locked (no open link)');
  ok(await kid11card.locator('a[aria-label*="Unit 14 · Homework 2"]').count() === 0, 'unshared Unit 14 Homework 2 shows locked (no open link)');
  const shareBtn = kid11card.locator('button[aria-label^="Share Unit 14 · Homework 3"][aria-label*="homework link"]');
  ok(await shareBtn.count() === 1, 'open row offers the link Share button');
  await shareBtn.click();
  await page.waitForTimeout(500);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  ok(clip.endsWith('/rfc3/doctor-fish.html#hw-c'), 'card Share button copies the absolute Unit 14 homework URL', clip);
  // Fold again — the assigned Unit 14 homework (row 3 of 9) must stay visible.
  await moreBtn.click();
  await page.waitForTimeout(400);
  ok(((await moreBtn.textContent()) || '').includes('More homeworks · 6 more'), 'folded label drops to 6 (the assigned Unit 14 row rides along)', await moreBtn.textContent());
  ok(await kid11card.locator('a[aria-label*="Unit 14 · Homework 3 — Health Writer"]').count() === 1, 'assigned Unit 14 Homework 3 stays visible on the folded card (fold never hides open work)');
  ok(await kid11card.locator('button[aria-label*="Share Unit 15 · Homework 2"][aria-label*="with students"]').count() === 0, 'folded card hides the Unit 15 Homework 2 switch again');
  await kid11card.screenshot({ path: join(SHOTS, 'unit14-kid11-card.png') });
  await ctx.close();
}

// 4b. Student: only the assigned Unit 14 row exists; Unit 13/15 rows stay hidden.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const mine = { hw1: true, hw2: false, hw3: false };
  await page.route(U14_ROUTE, routeU14(mine));
  await page.route(U13_ROUTE, routeOtherClosed);
  await page.route(U15_ROUTE, routeOtherClosed);
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
  ok(await kid11card.locator('a[aria-label*="Unit 14 · Homework 1 — Spa Intake File"]').count() === 1, 'student sees the assigned Unit 14 Homework 1 row');
  ok(((await kid11card.textContent())?.includes('Unit 14 · Homework 2 — Treatment Analyst')) === false, 'student never sees the unshared Unit 14 Homework 2 row');
  ok(((await kid11card.textContent())?.includes('Unit 14 · Homework 3 — Health Writer')) === false, 'student never sees the unshared Unit 14 Homework 3 row');
  ok(((await kid11card.textContent())?.includes('Unit 13 · Homework 1 — Field Notebook')) === false, 'student still never sees the unshared Unit 13 rows');
  ok(((await kid11card.textContent())?.includes('Unit 15 · Homework 1 — Lab Induction')) === false, 'student still never sees the unshared Unit 15 rows');
  ok(await kid11card.locator('button[aria-label*="with students"]').count() === 0, 'students never see any teacher key switch');
  ok(await kid11card.locator('button[aria-expanded]').count() === 0, 'student with the assigned homework in view: no fold control');
  await kid11card.screenshot({ path: join(SHOTS, 'unit14-kid11-card-student.png') });
  await ctx.close();
}

// ── 5. mobile ──────────────────────────────────────────────────────────
console.log('browser · mobile worksheet');
{
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true });
  const page = await ctx.newPage();
  const mine = { hw1: true, hw2: false, hw3: false };
  await page.route(U14_ROUTE, routeU14(mine));
  await page.route(U13_ROUTE, routeOtherClosed);
  await page.route(U15_ROUTE, routeOtherClosed);
  await page.goto(`${BASE}/rfc3/doctor-fish.html`, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(overflow === 0, 'mobile: zero horizontal overflow', `${overflow}px`);
  await page.evaluate(() => {
    const tb = document.querySelector('#hw-a .toolbar');
    window.scrollTo({ top: tb.getBoundingClientRect().top + window.scrollY - 30 + 700, behavior: 'instant' });
  });
  await page.waitForTimeout(300);
  const toolbarTop = await page.locator('#hw-a .toolbar').first().evaluate((el) => el.getBoundingClientRect().top);
  ok(Math.abs(toolbarTop - 68) < 12, 'mobile: homework toolbar still sticks under the fixed header', `top=${Math.round(toolbarTop)}`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(SHOTS, 'unit14-mobile.png') });
  await ctx.close();
}

await browser.close();
server.close();

console.log(`\nverify_unit14_homework: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
