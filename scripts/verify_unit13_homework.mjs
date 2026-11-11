// Verify the Kid 11 Unit 13 homework feature (owner request, Nov 2026):
//
//   "this is a 3 homework file. implement to kid 11 unit 13 homework. make
//    sure when teacher assigns 1 homework, only that one can be completed.
//    this keeps students from seeing the others till teacher shares it."
//
// The teacher's unit13hw.html (New Homes for Animals — Homework 1 Field
// Notebook 30 pts, Homework 2 Relocation Mission 25 pts, Homework 3 Campaign
// Studio 16 pts) is attached 1:1 to public/rfc3/unit13hw.html with the site's
// homework furniture. EACH homework is gated by its own Firestore doc
// (biweekly_tests/hw-kid11-u13-hw1|2|3 — public read, teacher-only write, no
// rules change):
//   · students see ONLY the shared homeworks — unshared tabs are hidden and
//     a deep link to an unshared homework falls back to the first shared one;
//   · no homework shared → full-page locked overlay;
//   · teachers get a preview banner and can preview any homework;
//   · the Kid 11 card carries one share switch per homework; unshared Unit 13
//     rows are completely invisible to students.
// Plus the shipped furniture: Submit-to-Teacher per active homework
// (drill_attempts guest branch, name gate), Share menu, back-to-CMC, and the
// name/date readability fix mirrored from Doctor Fish.
import { chromium } from 'playwright';
import { readFile, readdir } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const SRC_TEACHER = '/home/z/my-project/upload/unit13hw.html';
const PORT = 8953; const BASE = `http://127.0.0.1:${PORT}`;
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
const U13_ROUTE = '**/documents/biweekly_tests/hw-kid11-u13-hw*';
const DF_ROUTE = '**/documents/biweekly_tests/hw-kid11-doctor-fish*';
const docBody = (doc, shared) => JSON.stringify({
  name: `projects/demo/databases/(default)/documents/biweekly_tests/${doc}`,
  fields: { shared: { booleanValue: shared } },
});
function routeU13(shared) {
  return (route) => {
    const url = route.request().url();
    const m = /hw-kid11-u13-(hw[123])/.exec(url);
    if (!m) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: docBody(`hw-kid11-u13-${m[1]}`, shared[m[1]]) });
  };
}
const routeDF = (shared) => (route) => route.fulfill({ status: 200, contentType: 'application/json', body: docBody('hw-kid11-doctor-fish', shared) });

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
console.log('static · dist/rfc3/unit13hw.html');
let ws = '';
try { ws = await readFile(join(DIST, 'rfc3/unit13hw.html'), 'utf8'); } catch {}
ok(ws.length > 70000, 'worksheet shipped into dist/ (non-trivial size)', `${ws.length} bytes`);

// 1a. Answer keys — every graded key survives the build in teacher order.
const seq = (text) => [...text.matchAll(/data-(?:answer|correct|solution)="([^"]+)"/g)].map(m => m[1]);
const KEY = [
  // HW1 · 1.1 word meanings, 1.2 gap fill, 1.3 comprehension, 1.4 true/false, 1.5 phrasal verbs
  'e', 'd', 'b', 'f', 'h', 'g', 'a', 'c',
  'disaster', 'ruin', 'wildlife', 'suitable', 'strategy', 'assist|assisted', 'finally', 'put into action|put the plan into action|put their plan into action',
  'b', 'a', 'c', 'b', 'a',
  'F', 'T', 'T', 'F', 'T',
  'd', 'a', 'b', 'c',
  // HW2 · 2.1 mission order (solution), 2.2 cause→effect, 2.3 sort, 2.4 decisions, 2.5 main idea
  'study,decide,search,prepare,strategy,action',
  'c', 'a', 'e', 'b', 'd',
  'research', 'action', 'research', 'action', 'research', 'action',
  'b', 'c', 'a', 'b',
  'c', 'a', 'b',
  // HW3 · 3.1 fact/opinion sort, 3.6 closing message
  'fact', 'opinion', 'fact', 'opinion', 'fact', 'opinion', 'fact', 'opinion',
  'b',
];
const builtKeys = seq(ws);
ok(builtKeys.length === 58 && JSON.stringify(builtKeys) === JSON.stringify(KEY), 'all 58 graded keys present in order (HW1 30 + HW2 19 + HW3 9)', `got ${builtKeys.length}`);
try {
  const teacherSrc = await readFile(SRC_TEACHER, 'utf8');
  ok(JSON.stringify(seq(teacherSrc)) === JSON.stringify(builtKeys), 'graded keys match the teacher\'s unit13hw.html byte-for-byte (1:1 attachment)');
} catch { console.log('  (teacher source file unavailable — KEY pin only)'); }
ok(ws.includes('w-report') && ws.includes('w-slogan') && ws.includes('w-campaign') && ws.includes('w-i1') && ws.includes('w-p2'), 'all 7 live-checklist write tasks present (1+1+3+2)');
ok(ws.includes('50–80 words') && ws.includes("unit:'chars'"), 'write-task checklists kept from the teacher file');

// 1b. Furniture pins.
for (const [needle, label] of [
  ['Submit to Teacher', 'submit-to-teacher button present'],
  ['function submitCompletion', 'completion submit handler present'],
  ['documents/drill_attempts', 'posts to the drill_attempts pipeline'],
  ["drillSource: { stringValue: 'rfc3' }", 'drillSource rfc3 (Kid 11 book source)'],
  ["drillSlug:   { stringValue: 'unit13hw.html' }", 'drillSlug pinned to unit13hw.html'],
  ['Homework 1 · Field Notebook', 'HW1 title on the completion payload'],
  ['Homework 2 · Relocation Mission', 'HW2 title on the completion payload'],
  ['Homework 3 · Campaign Studio', 'HW3 title on the completion payload'],
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
ok(!/TODO|XXX|【/.test(ws), 'no leftover placeholders');

// 1c. Name/date readability fix (mirrored from Doctor Fish).
ok(ws.includes('.meta input{color:var(--ink)!important;caret-color:var(--ink)!important'), 'hero inputs: dark text + caret pinned (!important beats any later generic rule)');
ok(ws.includes('.meta input::placeholder{color:#6d7a72;opacity:1;font-weight:600}'), 'hero inputs: placeholder visible and opaque');
ok(ws.includes('-webkit-text-fill-color:var(--ink)'), 'hero inputs: autofill keeps dark text');

// 1d. Per-homework share gate pins.
for (const [needle, label] of [
  ['hw-kid11-u13-hw1', 'gate reads share doc 1'],
  ['hw-kid11-u13-hw2', 'gate reads share doc 2'],
  ['hw-kid11-u13-hw3', 'gate reads share doc 3'],
  ['d.fields.shared.booleanValue === true', 'gate opens only on shared:true'],
  ['hw-pending', 'content hidden while the share state resolves'],
  ['Homework not shared yet', 'locked overlay for students'],
  ['Ask your teacher to share it from the <b>Kid 11 card</b>', 'lock message points at the Kid 11 card switch'],
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
  ok(hub.includes('unit13hw.html#hw-a') && hub.includes('unit13hw.html#hw-b') && hub.includes('unit13hw.html#hw-c'), 'Kid 11 card links all three Unit 13 homeworks');
  ok(hub.includes('hw-kid11-u13-hw1') && hub.includes('hw-kid11-u13-hw2') && hub.includes('hw-kid11-u13-hw3') && hub.includes('hw-kid11-doctor-fish'), 'card polls all four share docs');
  ok(hub.includes('hideUntilShared'), 'hide-until-shared rule shipped (students never see unassigned homework)');
  ok(hub.includes('Unit 13 · Homework 1 — Field Notebook'), 'HW1 row title');
  ok(hub.includes('Unit 13 · Homework 2 — Relocation Mission'), 'HW2 row title');
  ok(hub.includes('Unit 13 · Homework 3 — Campaign Studio'), 'HW3 row title');
  ok(hub.includes('students only see the homeworks you have opened'), 'teacher caption explains per-homework sharing');
}

// ── 3. worksheet behavior in a real browser ──────────────────────────────
console.log('browser · worksheet — share gate');
const browser = await chromium.launch();

// 3a. Student + NOTHING shared → locked overlay, all tabs hidden.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.route(U13_ROUTE, routeU13(sharedState));
  await page.goto(`${BASE}/rfc3/unit13hw.html`, { waitUntil: 'load' });
  await page.waitForSelector('#hwGate', { timeout: 8000 });
  ok(await page.locator('#hwGate').isVisible(), 'locked overlay shown when no homework is shared');
  ok(((await page.locator('#hwGate h1').textContent()) || '').includes('Homework not shared yet'), 'overlay headline');
  ok(await page.locator('[data-answer]').first().isHidden(), 'worksheet questions hidden behind the gate');
  ok(await page.locator('.switch-btn[data-mode="a"]').isHidden(), 'HW1 tab hidden from students');
  ok(await page.locator('.switch-btn[data-mode="b"]').isHidden(), 'HW2 tab hidden from students');
  ok(await page.locator('.switch-btn[data-mode="c"]').isHidden(), 'HW3 tab hidden from students');
  await page.screenshot({ path: join(SHOTS, 'unit13-locked.png'), fullPage: false });
  await ctx.close();
}

// 3b. Teacher + nothing shared → preview works, banner explains, all tabs.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const [k, v] of Object.entries(TEACHER_SEED)) await ctx.addInitScript(([key, val]) => localStorage.setItem(key, val), [k, v]);
  const page = await ctx.newPage();
  await page.route(U13_ROUTE, routeU13(sharedState));
  await page.goto(`${BASE}/rfc3/unit13hw.html`, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  ok(await page.locator('#hwGate').count() === 0, 'teacher bypasses the lock (no overlay)');
  ok(await page.locator('#hwBanner').isVisible(), 'teacher preview banner visible while locked for students');
  ok(await page.locator('.switch-btn[data-mode="a"]').isVisible(), 'teacher sees HW1 tab');
  ok(await page.locator('.switch-btn[data-mode="b"]').isVisible(), 'teacher sees HW2 tab');
  ok(await page.locator('.switch-btn[data-mode="c"]').isVisible(), 'teacher sees HW3 tab');
  // Teachers may preview any homework by deep link (query param forces a real
  // navigation — a hash-only change would be same-document and not re-run the gate).
  await page.goto(`${BASE}/rfc3/unit13hw.html?preview=hw-b#hw-b`, { waitUntil: 'load' });
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
  await page.route(U13_ROUTE, routeU13(mine));
  await page.goto(`${BASE}/rfc3/unit13hw.html#hw-b`, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  ok(await page.locator('#hwGate').count() === 0, 'shared homework opens for students (no overlay)');
  ok(await page.locator('.switch-btn[data-mode="a"]').isVisible(), 'HW1 tab visible for students');
  ok(await page.locator('.switch-btn[data-mode="b"]').isHidden(), 'HW2 tab does not exist for students (only HW1 assigned)');
  ok(await page.locator('.switch-btn[data-mode="c"]').isHidden(), 'HW3 tab does not exist for students');
  // Deep link #hw-b must NOT reveal Homework 2 — fall back to the first shared.
  ok(await page.locator('#hw-a').isVisible(), 'deep link to an unshared homework falls back to Homework 1');
  ok(await page.locator('#hw-b').isHidden(), 'Homework 2 content stays hidden behind the deep link');
  ok(await page.locator('#hw-c').isHidden(), 'Homework 3 content stays hidden');
  ok(await page.evaluate(() => document.body.dataset.mode) === 'a', 'active homework is the one the teacher assigned');
  await page.screenshot({ path: join(SHOTS, 'unit13-hw1-only.png'), fullPage: false });
  await ctx.close();
}

console.log('browser · worksheet — completion submit (student, HW1)');
const submits = [];
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const mine = { hw1: true, hw2: false, hw3: false };
  await page.route(U13_ROUTE, routeU13(mine));
  await page.route('**/documents/drill_attempts*', async (route) => {
    const req = route.request();
    submits.push({ headers: req.headers(), body: JSON.parse(req.postData() || '{}') });
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"name":"projects/demo/databases/(default)/documents/drill_attempts/verify"}' });
  });
  await page.goto(`${BASE}/rfc3/unit13hw.html`, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  // Name/date readability — the shipped fix.
  const nameStyles = await page.locator('#hw-a .meta input').first().evaluate((el) => {
    const cs = getComputedStyle(el);
    const ph = getComputedStyle(el, '::placeholder').color;
    return { bg: cs.backgroundColor, color: cs.color, placeholder: ph, caret: cs.caretColor };
  });
  const rgba = (s) => (s.match(/rgba?\(([^)]+)\)/) || [])[1]?.split(',').map(Number) || [];
  const [cr, cg, cb2] = rgba(nameStyles.color);
  ok(cr < 100 && cg < 120 && cb2 < 120, 'name field text is dark ink (readable on the white box)', nameStyles.color);
  ok(nameStyles.placeholder.startsWith('rgb(109, 122, 114') || nameStyles.placeholder.startsWith('rgba(109, 122, 114'), 'placeholder is a visible opaque grey', nameStyles.placeholder);

  // Name gate: no name → blocked, no POST.
  await page.locator('.hw-bar #submitBtn').click();
  await page.waitForTimeout(400);
  ok(submits.length === 0, 'submit without a name is blocked (no POST)');
  ok(((await page.locator('#cmcToast').textContent()) || '').includes('Add your name first'), 'name gate toast explains why');

  // Fill the name — it mirrors into the other two heroes.
  await page.locator('#hw-a .meta input').first().fill('Dara Kim');
  await page.locator('#hw-a .meta input').nth(1).fill('2026-11-11');
  await page.evaluate(() => {
    const root = document.getElementById('hw-b');
    root.querySelectorAll('.meta input').forEach((inp) => inp.dispatchEvent(new Event('input', { bubbles: true })));
  });
  ok((await page.locator('#hw-b .meta input').first().inputValue()) === 'Dara Kim', 'name mirrors into Homework 2 hero');
  ok((await page.locator('#hw-b .meta input').nth(1).inputValue()) === '2026-11-11', 'date mirrors into Homework 2 hero');

  // Blank submit → 0/30 payload through the guest branch.
  await page.getByRole('button', { name: 'Check Notebook' }).click();
  await page.waitForTimeout(300);
  ok(((await page.locator('#hw-a .score-line').textContent()) || '').trim() === '0 / 30 points', 'HW1 blanks score 0 / 30 points');
  await page.locator('.hw-bar #submitBtn').click();
  await page.waitForTimeout(500);
  ok(submits.length === 1, 'named blank submit POSTs once');
  {
    const b = submits[0]?.body?.fields ?? {};
    const h = submits[0]?.headers ?? {};
    ok(b.drillSlug?.stringValue === 'unit13hw.html', 'payload drillSlug unit13hw.html');
    ok((b.drillTitle?.stringValue || '').includes('Homework 1 · Field Notebook'), 'payload names Homework 1');
    ok(b.drillSource?.stringValue === 'rfc3', 'payload drillSource rfc3');
    ok(b.studentName?.stringValue === 'Dara Kim', 'payload carries the student name');
    ok(b.studentUid?.stringValue === '', 'guest branch: studentUid empty');
    ok(b.totalCount?.integerValue === '30' && b.correctCount?.integerValue === '0' && b.scorePct?.integerValue === '0', 'blank run scores 0/30 → 0%');
    ok(b.classId && b.classId.nullValue === null, 'classId null (guest-branch compliant)');
    ok(!h.authorization, 'guest POST carries no Authorization header');
  }

  // Answer every 1.1 word-meaning correctly → 8/30 on the next submit.
  await page.evaluate(() => {
    const answers = ['e', 'd', 'b', 'f', 'h', 'g', 'a', 'c'];
    document.querySelectorAll('#hw-a .task')[1].querySelectorAll('.g-item').forEach((q, i) => {
      const sel = q.querySelector('select');
      sel.value = answers[i];
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
  await page.getByRole('button', { name: 'Check Notebook' }).click();
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

// 3d. Teacher on the open page: switch to Mission, submit names Homework 2.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const [k, v] of Object.entries(TEACHER_SEED)) await ctx.addInitScript(([key, val]) => localStorage.setItem(key, val), [k, v]);
  const page = await ctx.newPage();
  await page.route(U13_ROUTE, routeU13(sharedState));
  await page.route('**/documents/drill_attempts*', async (route) => {
    const req = route.request();
    submits.push({ headers: req.headers(), body: JSON.parse(req.postData() || '{}') });
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"name":"x"}' });
  });
  await page.goto(`${BASE}/rfc3/unit13hw.html`, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.locator('.switch-btn[data-mode="b"]').click();
  ok(await page.locator('#hw-b').isVisible(), 'teacher can switch to Homework 2');
  await page.locator('.hw-bar #submitBtn').click();
  await page.waitForTimeout(500);
  {
    const b = submits[submits.length - 1]?.body?.fields ?? {};
    ok((b.drillTitle?.stringValue || '').includes('Homework 2 · Relocation Mission'), 'Mission submit names Homework 2');
    ok(b.studentName?.stringValue === 'Teacher Verify', 'signed-in name prefilled from the session (mirrored to HW2 hero)');
    ok(b.totalCount?.integerValue === '25', 'Homework 2 grades out of 25 points');
  }
  await page.locator('.switch-btn[data-mode="c"]').click();
  await page.locator('.hw-bar #submitBtn').click();
  await page.waitForTimeout(500);
  {
    const b = submits[submits.length - 1]?.body?.fields ?? {};
    ok((b.drillTitle?.stringValue || '').includes('Homework 3 · Campaign Studio'), 'Campaign submit names Homework 3');
    ok(b.totalCount?.integerValue === '16', 'Homework 3 grades out of 16 points');
  }
  await ctx.close();
}

// 3e. Gate auto-unlock: teacher shares HW1 in another tab → gate lifts, tab appears.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const mine = { hw1: false, hw2: false, hw3: false };
  await page.route(U13_ROUTE, routeU13(mine));
  await page.goto(`${BASE}/rfc3/unit13hw.html`, { waitUntil: 'load' });
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
  await page.route(U13_ROUTE, routeU13(mine));
  await page.goto(`${BASE}/rfc3/unit13hw.html#hw-b`, { waitUntil: 'load' });
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
console.log('browser · Kid 11 card — per-homework switches');
// 4a. Teacher: three Unit 13 rows with switches; PATCH opens exactly one.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  for (const [k, v] of Object.entries(TEACHER_SEED)) await ctx.addInitScript(([key, val]) => localStorage.setItem(key, val), [k, v]);
  const page = await ctx.newPage();
  const patches = [];
  await page.route(U13_ROUTE, (route) => {
    const req = route.request();
    const m = /hw-kid11-u13-(hw[123])/.exec(req.url());
    if (req.method() === 'PATCH') {
      const body = JSON.parse(req.postData() || '{}');
      patches.push({ doc: m?.[1], body });
      if (body.fields?.shared?.booleanValue === true) sharedState[m[1]] = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: docBody(`hw-kid11-u13-${m[1]}`, sharedState[m[1]]) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: docBody(`hw-kid11-u13-${m[1]}`, sharedState[m[1]]) });
  });
  await page.route(DF_ROUTE, routeDF(false));
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
  // 4a-fold. Owner request: "add a more button so the card does not get too
  // long" — the homework list starts folded to two rows behind a More
  // control, and the fold ALWAYS carries every open homework so assigned
  // work is never hidden behind it.
  const moreBtn = kid11card.locator('button[aria-expanded]');
  ok(await moreBtn.count() === 1, 'folded card carries exactly one More control');
  ok((await moreBtn.getAttribute('aria-expanded')) === 'false', 'fold starts collapsed (aria-expanded=false)');
  ok(((await moreBtn.textContent()) || '').includes('More homeworks · 2 more'), 'fold label counts the two rows still folded away', await moreBtn.textContent());
  ok(await kid11card.locator('button[aria-label*="Share Unit 13 · Homework 1"][aria-label*="with students"]').count() === 1, 'folded card keeps the Homework 1 switch (first two rows stay visible)');
  ok(await kid11card.locator('button[aria-label*="Share Unit 13 · Homework 2"][aria-label*="with students"]').count() === 0, 'fold hides the Homework 2 switch');
  ok(await kid11card.locator('button[aria-label*="Share Unit 13 · Homework 3"][aria-label*="with students"]').count() === 0, 'fold hides the Homework 3 switch');
  await moreBtn.click();
  await page.waitForTimeout(400);
  ok((await moreBtn.getAttribute('aria-expanded')) === 'true', 'More unfolds the homework list');
  ok(((await moreBtn.textContent()) || '').includes('Show less'), 'unfolded control flips to Show less');
  ok(await kid11card.locator('button[aria-label*="Share Unit 13 · Homework 1"][aria-label*="with students"]').count() === 1, 'teacher sees the share switch for Homework 1');
  ok(await kid11card.locator('button[aria-label*="Share Unit 13 · Homework 2"][aria-label*="with students"]').count() === 1, 'teacher sees the share switch for Homework 2');
  ok(await kid11card.locator('button[aria-label*="Share Unit 13 · Homework 3"][aria-label*="with students"]').count() === 1, 'teacher sees the share switch for Homework 3');
  ok((await kid11card.textContent())?.includes('Not shared — students can’t see this homework until you open it.'), 'teacher rows explain that unshared homework is invisible to students');
  // Assign ONLY Homework 1.
  await kid11card.locator('button[aria-label*="Share Unit 13 · Homework 1"][aria-label*="with students"]').click();
  await page.waitForTimeout(800);
  ok(patches.length === 1 && patches[0].doc === 'hw1', 'switch PATCHes Homework 1\'s own share doc', JSON.stringify(patches.map(p => p.doc)));
  ok(patches[0]?.body?.fields?.homeworkId?.stringValue === 'kid-11-homework-u13-hw1', 'PATCH carries the homework id');
  const hw1Link = kid11card.locator('a[aria-label*="Unit 13 · Homework 1 — Field Notebook"]');
  ok(await hw1Link.count() === 1, 'assigned homework row flips open — Open link appears');
  ok((await hw1Link.getAttribute('href'))?.endsWith('/rfc3/unit13hw.html#hw-a'), 'open row deep links to Homework 1');
  ok(await kid11card.locator('a[aria-label*="Unit 13 · Homework 2"]').count() === 0, 'unshared Homework 2 stays invisible on the card');
  ok(await kid11card.locator('a[aria-label*="Unit 13 · Homework 3"]').count() === 0, 'unshared Homework 3 stays invisible on the card');
  const shareBtn = kid11card.locator('button[aria-label^="Share Unit 13 · Homework 1"][aria-label*="homework link"]');
  ok(await shareBtn.count() === 1, 'open row offers the link Share button');
  await shareBtn.click();
  await page.waitForTimeout(500);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  ok(clip.endsWith('/rfc3/unit13hw.html#hw-a'), 'card Share button copies the absolute homework URL', clip);
  // Fold again — the assigned homework must stay on the folded card.
  await moreBtn.click();
  await page.waitForTimeout(400);
  ok(((await moreBtn.textContent()) || '').includes('More homeworks · 2 more'), 'Show less folds the list back with the count label', await moreBtn.textContent());
  ok(await kid11card.locator('a[aria-label*="Unit 13 · Homework 1 — Field Notebook"]').count() === 1, 'assigned Homework 1 stays visible on the folded card');
  ok(await kid11card.locator('button[aria-label*="Share Unit 13 · Homework 2"][aria-label*="with students"]').count() === 0, 'folded card hides the Homework 2 switch again');
  await kid11card.screenshot({ path: join(SHOTS, 'unit13-kid11-card.png') });
  await ctx.close();
}

// 4b. Student: only the assigned homework row exists; Doctor Fish stays as before.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const mine = { hw1: true, hw2: false, hw3: false };
  await page.route(U13_ROUTE, routeU13(mine));
  await page.route(DF_ROUTE, routeDF(false));
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
  ok(await kid11card.locator('a[aria-label*="Unit 13 · Homework 1 — Field Notebook"]').count() === 1, 'student sees the assigned Homework 1 row');
  ok(((await kid11card.textContent())?.includes('Unit 13 · Homework 2 — Relocation Mission')) === false, 'student never sees the unshared Homework 2 row');
  ok(((await kid11card.textContent())?.includes('Unit 13 · Homework 3 — Campaign Studio')) === false, 'student never sees the unshared Homework 3 row');
  ok(await kid11card.locator('button[aria-label*="with students"]').count() === 0, 'students never see any teacher key switch');
  ok(((await kid11card.textContent())?.includes('Locked — your teacher opens this homework')) === true, 'Doctor Fish keeps its locked-row announcement for students');
  ok((await kid11card.textContent())?.includes('Your teacher opens each homework here'), 'student-facing caption');
  ok(await kid11card.locator('button[aria-expanded]').count() === 0, 'student with the assigned homework in view: no fold control (nothing more to show them)');
  await kid11card.screenshot({ path: join(SHOTS, 'unit13-kid11-card-student.png') });
  await ctx.close();
}

// 4c. Fold safety — an open homework beyond the first two rows still shows
// on the folded card. The fold must never hide assigned work behind More.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const [k, v] of Object.entries(TEACHER_SEED)) await ctx.addInitScript(([key, val]) => localStorage.setItem(key, val), [k, v]);
  const page = await ctx.newPage();
  await page.route(U13_ROUTE, routeU13({ hw1: false, hw2: false, hw3: true }));
  await page.route(DF_ROUTE, routeDF(false));
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
  const moreBtn = kid11card.locator('button[aria-expanded]');
  ok(((await moreBtn.textContent()) || '').includes('More homeworks · 1 more'), 'fold label counts only the one still-hidden row', await moreBtn.textContent());
  ok(await kid11card.locator('a[aria-label*="Unit 13 · Homework 3 — Campaign Studio"]').count() === 1, 'open Homework 3 shows on the folded card without expanding');
  ok(await kid11card.locator('button[aria-label*="Share Unit 13 · Homework 2"][aria-label*="with students"]').count() === 0, 'the still-locked Homework 2 stays folded away');
  await ctx.close();
}

// 4d. Student fold — viewer-visible rows only: the assigned homework shows
// with no fold control, and the fold is never a peek at locked homework.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.route(U13_ROUTE, routeU13({ hw1: false, hw2: false, hw3: true }));
  await page.route(DF_ROUTE, routeDF(false));
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
  ok(await kid11card.locator('a[aria-label*="Unit 13 · Homework 3 — Campaign Studio"]').count() === 1, 'student sees the one assigned homework (Homework 3) on the folded card');
  ok(await kid11card.locator('button[aria-expanded]').count() === 0, 'student: no fold control — the fold never gates what the teacher assigned');
  ok(((await kid11card.textContent())?.includes('Unit 13 · Homework 1 — Field Notebook')) === false, 'unshared Homework 1 stays invisible under the fold');
  ok(((await kid11card.textContent())?.includes('Unit 13 · Homework 2 — Relocation Mission')) === false, 'unshared Homework 2 stays invisible under the fold');
  await ctx.close();
}

// ── 5. mobile ──────────────────────────────────────────────────────────
console.log('browser · mobile worksheet');
{
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true });
  const page = await ctx.newPage();
  const mine = { hw1: true, hw2: false, hw3: false };
  await page.route(U13_ROUTE, routeU13(mine));
  await page.goto(`${BASE}/rfc3/unit13hw.html`, { waitUntil: 'load' });
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
  await page.screenshot({ path: join(SHOTS, 'unit13-mobile.png') });
  await ctx.close();
}

await browser.close();
server.close();

console.log(`\nverify_unit13_homework: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
