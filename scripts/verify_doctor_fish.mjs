// Verify the Kid 11 online-homework feature (owner requests, Nov 2026):
//
//   1. "the name date area text cant be seen" — the purple homework hero's
//      Name/Date inputs used to render white-on-white: the worksheet's own
//      generic `input[type=text]{background:#fff}` rule landed after
//      `.meta input` in the cascade and won, while the white text color
//      survived. The rebuilt hero (.hw-meta) pins its colors with !important;
//      this verifier asserts the computed styles can never regress to an
//      opaque white background with light text.
//   2. "the html file goes with this units homework and should be attached
//      to the first" — the teacher's drfish.html (Home Assignments 1 & 2,
//      Newsroom + Clinic) IS the worksheet of the first online homework.
//      Every graded key (data-answer / data-correct / data-solution), every
//      sort card and every write task must survive the build 1:1.
//   3. "can only be done if teacher shares the home" — share gate: the page
//      reads biweekly_tests/hw-kid11-doctor-fish (public read, teacher-only
//      write — no rules change). Not shared → students get a locked overlay
//      and the Kid 11 card row is locked; the teacher gets a preview banner
//      on the page and a Share-with-students key switch on the card.
//   Plus the shipped furniture: Submit-to-Teacher completion button
//   (drill_attempts pipeline, guest branch), Share menu, back-to-CMC.
import { chromium } from 'playwright';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { mkdirSync } from 'node:fs';

const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const SRC_TEACHER = '/home/z/my-project/upload/drfish.html';
const PORT = 8951; const BASE = `http://127.0.0.1:${PORT}`;
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

const HW_ROUTE = '**/documents/biweekly_tests/hw-kid11-doctor-fish*';
const hwDocBody = JSON.stringify({ name: 'projects/demo/databases/(default)/documents/biweekly_tests/hw-kid11-doctor-fish', fields: { shared: { booleanValue: true }, title: { stringValue: 'Doctor Fish · Unit 14 · Kid 11 Online Homework' } } });
// A hand-minted JWT whose payload decodes to email_verified:true — enough
// for getValidIdToken() to hand it back to the PATCH in the teacher context.
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
ok(ws.length > 40000, 'worksheet shipped into dist/ (non-trivial size)', `${ws.length} bytes`);

const seq = (text) => [...text.matchAll(/data-(?:answer|correct|solution)="([^"]+)"/g)].map(m => m[1]);
const KEY = [
  'garra rufa', 'turkey', '3000|about 3000|around 3000', '21|21 days|twenty-one days', 'nutrients|nutrient', 'dead',
  'fact', 'opinion', 'fact', 'opinion', 'fact', 'opinion', 'fact', 'opinion',
  'hook,who,detail,payoff',
  'd', 'e', 'a', 'b', 'c',
  'benefit', 'limitation', 'benefit', 'limitation', 'benefit', 'limitation', 'benefit', 'limitation',
  'b', 'b', 'a', 'b',
];
const builtKeys = seq(ws);
ok(builtKeys.length === 32 && JSON.stringify(builtKeys) === JSON.stringify(KEY), 'all 32 graded keys present in order (A1 6 + A2 8 + A4 1 + B1 5 + B2 8 + B3 3 + B6 1)', `got ${builtKeys.length}`);
try {
  const teacherSrc = await readFile(SRC_TEACHER, 'utf8');
  ok(JSON.stringify(seq(teacherSrc)) === JSON.stringify(builtKeys), 'graded keys match the teacher\'s drfish.html byte-for-byte (1:1 attachment)');
  ok(teacherSrc.replace(/data-(?:answer|correct|solution)="[^"]*"/g, '').split(/\s+/).filter(t => t.startsWith('data-correct')).length === 0, 'no invented keys');
} catch { console.log('  (teacher source file unavailable — KEY pin only)'); }
ok(ws.includes('hook,who,detail,payoff') && ws.includes('data-solution='), 'ordering task with its solution key present');

for (const [needle, label] of [
  ['Submit to Teacher', 'submit-to-teacher button present'],
  ['function submitCompletion', 'completion submit handler present'],
  ['documents/drill_attempts', 'posts to the drill_attempts pipeline'],
  ["drillSource: { stringValue: 'rfc3' }", 'drillSource rfc3 (Kid 11 book source)'],
  ["drillSlug:   { stringValue: 'doctor-fish.html' }", 'drillSlug pinned to doctor-fish.html'],
  ['Home Assignment 1 · Newsroom', 'assignment-A title on the completion payload'],
  ['Home Assignment 2 · Clinic', 'assignment-B title on the completion payload'],
  ['cmc-student-token', 'signed-in students submit under their session token'],
  ['cmc-student-refresh-token', 'expired sessions refresh via securetoken'],
  ['classId:       { nullValue: null }', 'classId null (guest-branch compliant)'],
  ['studentUid:  { stringValue: uid }', 'studentUid empty for guests / real uid signed-in'],
  ['Add your name first', 'name gate before submit'],
  ['Back to CMC', 'back-to-CMC button (rfc3 worksheet pattern)'],
  ['wa.me', 'share: WhatsApp'],
  ['t.me/share', 'share: Telegram'],
  ['mailto:', 'share: Email'],
  ['data-cmc-copy', 'share: copy link'],
]) ok(ws.includes(needle), label);
ok(!ws.includes('inviteMode'), 'no inviteMode key (rules notInviteMode guard satisfied)');
ok(!/TODO|XXX|【/.test(ws), 'no leftover placeholders');

// The reported bug: name/date text invisible. The hero inputs must pin an
// opaque-enough translucent background + white text with !important, and an
// autofill fix, so the later generic input rule can never flip them white.
ok(ws.includes('.hw-meta input{background:rgba(255,255,255,.16)!important'), 'hero inputs: translucent background pinned (!important beats the generic rule)');
ok(ws.includes('color:#fff!important;caret-color:#fff'), 'hero inputs: white text + caret pinned');
ok(ws.includes('-webkit-text-fill-color:#fff'), 'hero inputs: autofill keeps white text');
ok(ws.includes('id="stuName"') && ws.includes('id="stuDate"'), 'hero Name and Date fields present');

// Share gate pins.
for (const [needle, label] of [
  ['biweekly_tests/hw-kid11-doctor-fish', 'gate reads the homework share doc'],
  ["d.fields.shared.booleanValue === true", 'gate opens only on shared:true'],
  ['hw-pending', 'content hidden while the share state resolves'],
  ['Homework not shared yet', 'locked overlay for students'],
  ['Ask your teacher to share it from the <b>Kid 11 card</b>', 'lock message points at the Kid 11 card switch'],
  ['hw-teacher-locked', 'teacher preview state'],
  ['Share with students', 'banner tells the teacher which switch opens it'],
]) ok(ws.includes(needle), label);

// ── 2. Kid 11 card bundle carries the homework section + gate copy ──────
console.log('static · KidGradeHub bundle');
const assets = await readdir(join(DIST, 'assets'));
const hubChunk = assets.find((f) => f.startsWith('KidGradeHub-') && f.endsWith('.js'));
ok(!!hubChunk, 'KidGradeHub chunk exists in dist/assets');
if (hubChunk) {
  const hub = await readFile(join(DIST, 'assets', hubChunk), 'utf8');
  ok(hub.includes('Online homework'), 'Online homework section in the Kid 11 card bundle');
  ok(hub.includes('doctor-fish.html'), 'Kid 11 card links the Doctor Fish worksheet');
  ok(hub.includes('Submit to Teacher'), 'card copy explains the submit button');
  ok(hub.includes('biweekly_tests/') && hub.includes('hw-kid11-doctor-fish'), 'card reads/writes the share doc');
  ok(hub.includes('homework with students'), 'teacher share switch present');
  ok(hub.includes('Locked — your teacher opens this homework'), 'locked-row copy for students');
}

// ── 3. worksheet behavior in a real browser ──────────────────────────────
console.log('browser · worksheet — share gate');
const browser = await chromium.launch();

// 3a. Student + homework NOT shared → locked overlay, worksheet hidden.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u13-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u15-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  const page = await ctx.newPage();
  await page.route(HW_ROUTE, (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  await page.goto(`${BASE}/rfc3/doctor-fish.html`, { waitUntil: 'load' });
  await page.waitForSelector('#hwGate', { timeout: 8000 });
  ok(await page.locator('#hwGate').isVisible(), 'locked overlay shown when the teacher has not shared the homework');
  ok(((await page.locator('#hwGate h1').textContent()) || '').includes('Homework not shared yet'), 'overlay headline');
  ok(await page.locator('[data-answer]').first().isHidden(), 'worksheet questions hidden behind the gate');
  await page.screenshot({ path: join(SHOTS, 'doctor-fish-locked.png'), fullPage: false });
  await ctx.close();
}

// 3b. Teacher + homework NOT shared → preview works, banner explains.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u13-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u15-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  for (const [k, v] of Object.entries(TEACHER_SEED)) await ctx.addInitScript(([key, val]) => localStorage.setItem(key, val), [k, v]);
  const page = await ctx.newPage();
  await page.route(HW_ROUTE, (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  await page.goto(`${BASE}/rfc3/doctor-fish.html`, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  ok(await page.locator('#hwGate').count() === 0, 'teacher bypasses the lock (no overlay)');
  ok(await page.locator('#hwBanner').isVisible(), 'teacher preview banner visible while locked for students');
  ok(await page.locator('[data-answer]').first().isVisible(), 'worksheet usable for the teacher');
  await ctx.close();
}

console.log('browser · worksheet — open homework (student)');
const submits = [];
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u13-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u15-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const page = await ctx.newPage();
  await page.route(HW_ROUTE, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: hwDocBody }));
  await page.route('**/documents/drill_attempts*', async (route) => {
    const req = route.request();
    submits.push({ headers: req.headers(), body: JSON.parse(req.postData() || '{}') });
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"name":"projects/demo/databases/(default)/documents/drill_attempts/verify"}' });
  });
  await page.goto(`${BASE}/rfc3/doctor-fish.html`, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  ok(await page.locator('#hwGate').count() === 0, 'shared homework opens for students (no overlay)');
  ok(await page.locator('#hwBanner').isHidden(), 'no teacher banner for students');
  ok((await page.title()).includes('Doctor Fish'), 'worksheet page loads with its own title');
  ok(await page.locator('#cmc-back-btn').count() === 1, 'back-to-CMC button renders');

  // THE reported bug — name/date text must be readable: translucent purple
  // backdrop, white text, never an opaque white box.
  const nameStyles = await page.locator('#stuName').evaluate((el) => {
    const cs = getComputedStyle(el);
    const ph = getComputedStyle(el, '::placeholder').color;
    return { bg: cs.backgroundColor, color: cs.color, placeholder: ph, caret: cs.caretColor };
  });
  const rgba = (s) => (s.match(/rgba?\(([^)]+)\)/) || [])[1]?.split(',').map(Number) || [];
  const [br, bg_, bb, ba] = rgba(nameStyles.bg);
  const [cr, cg, cb2] = rgba(nameStyles.color);
  ok(ba !== undefined && ba < 1, 'hero input background is translucent (bug fix: never opaque white)', nameStyles.bg);
  ok(cr > 240 && cg > 240 && cb2 > 240, 'hero input text is white', nameStyles.color);
  ok(nameStyles.placeholder.startsWith('rgba(255, 255, 255'), 'placeholder is white too', nameStyles.placeholder);

  // Assignment A: grade with blanks → 0/22, then a perfect run → 22/22.
  await page.getByRole('button', { name: 'Submit to Editor' }).click();
  await page.waitForTimeout(300);
  ok(((await page.locator('#assignment-a .score-line').textContent()) || '').trim() === '0 / 22 points', 'assignment A blanks score 0 / 22 points');

  await page.evaluate(() => {
    document.querySelectorAll('#assignment-a .g-item').forEach((q) => {
      const key = q.getAttribute('data-answer').split('|')[0];
      const sel = q.querySelector('select'); if (sel) { sel.value = key; return; }
      const inp = q.querySelector('input'); if (inp) { inp.value = key; return; }
      const b = q.querySelector(`.opt[data-val="${key}"]`); if (b) b.click();
    });
    document.querySelectorAll('#assignment-a .sort-task .tray .sort-card').forEach((card) => {
      const bin = document.querySelector(`#assignment-a .bin[data-bin="${card.getAttribute('data-correct')}"]`);
      card.click(); bin.click();
    });
    const task = document.querySelector('#assignment-a .order-task');
    const list = task.querySelector('.order-list');
    task.getAttribute('data-solution').split(',').forEach((k) => list.appendChild(list.querySelector(`li[data-key="${k}"]`)));
    const headline = document.querySelector('#w-headline input');
    headline.value = 'Tiny Fish Big Cure — Turkey Living Skin Doctors';
    headline.dispatchEvent(new Event('input', { bubbles: true }));
    const texts = {
      'w-thus': 'Few nutrients survive in the hot spring water; thus, the fish are always hungry and eat dead skin.',
      'w-moreover': 'The fish remove dead skin; moreover, they never harm the healthy skin of the visitors.',
      'w-inparticular': 'Many animals help people; fish, in particular doctor fish, can help our skin a lot.',
    };
    for (const [id, val] of Object.entries(texts)) {
      const ta = document.querySelector(`#${id} textarea`);
      ta.value = val;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await page.getByRole('button', { name: 'Submit to Editor' }).click();
  await page.waitForTimeout(300);
  ok(((await page.locator('#assignment-a .score-line').textContent()) || '').trim() === '22 / 22 points', 'assignment A perfect run scores 22 / 22 points');

  // Name gate first, then the guest completion POST for assignment A.
  await page.locator('#stuName').fill('');
  await page.locator('#submitBtn').click();
  await page.waitForTimeout(400);
  const toast = await page.locator('#cmcToast').textContent();
  ok(!!toast && toast.includes('Add your name first'), 'empty name → warning toast, no submit', `toast="${toast}"`);
  ok(submits.length === 0, 'no Firestore POST without a name');

  await page.locator('#stuName').fill('Dara Verify');
  await page.locator('#submitBtn').click();
  await page.waitForFunction(() => document.getElementById('submitBtn')?.textContent?.includes('Submitted to teacher'), null, { timeout: 8000 }).catch(() => {});
  ok(submits.length === 1, 'completion POST fired exactly once', `${submits.length}`);
  if (submits.length === 1) {
    const f = submits[0].body.fields || {};
    const v = (k) => f[k] && (f[k].stringValue ?? f[k].integerValue ?? f[k].timestampValue);
    ok(v('drillSlug') === 'doctor-fish.html', 'payload drillSlug', JSON.stringify(f.drillSlug));
    ok(v('drillTitle') === 'Unit 14 · Doctor Fish — Home Assignment 1 · Newsroom', 'payload drillTitle (assignment A)', JSON.stringify(f.drillTitle));
    ok(v('drillSource') === 'rfc3', 'payload drillSource rfc3');
    ok(v('studentName') === 'Dara Verify', 'payload studentName');
    ok(v('studentUid') === '', 'payload studentUid empty (guest branch)');
    ok(v('scorePct') === '100' && v('correctCount') === '22' && v('totalCount') === '22', 'payload score 22/22 → pct 100');
    ok(f.classId && f.classId.nullValue === null, 'payload classId null');
    ok(!!v('submittedAt'), 'payload submittedAt timestamp');
    ok(!('inviteMode' in (submits[0].body.fields || {})), 'payload carries no inviteMode key');
    ok(!submits[0].headers['authorization'], 'guest POST sends no Authorization header');
  }

  // Assignment B: switch modes, submit un-graded → auto-check 0/21.
  await page.locator('.switch-btn[data-mode="b"]').click();
  await page.waitForTimeout(300);
  ok(await page.locator('#assignment-b').isVisible(), 'switcher reveals Home Assignment 2 (Clinic)');
  await page.locator('#submitBtn').click();
  await page.waitForFunction(() => document.getElementById('submitBtn')?.textContent?.includes('Submitted to teacher'), null, { timeout: 8000 }).catch(() => {});
  const last = submits.at(-1);
  ok(submits.length === 2 && last, 'assignment-B completion POST fired');
  if (last) {
    const f = last.body.fields || {};
    ok(f.drillTitle?.stringValue === 'Unit 14 · Doctor Fish — Home Assignment 2 · Clinic', 'assignment-B payload title', JSON.stringify(f.drillTitle));
    ok(f.totalCount?.integerValue === '21' && f.correctCount?.integerValue === '0' && f.scorePct?.integerValue === '0', 'assignment-B auto-check scores 0/21');
  }

  // Hero name/date flow into the assignment sheets.
  await page.locator('#stuName').fill('Dara Verify');
  await page.locator('#stuDate').fill('2026-11-11');
  const mirrored = await page.evaluate(() => ({
    name: document.querySelector('#assignment-b .meta input[aria-label="Your name"]')?.value,
    date: document.querySelector('#assignment-b .meta input[aria-label="Date"]')?.value,
  }));
  ok(mirrored.name === 'Dara Verify' && mirrored.date === '2026-11-11', 'hero name/date sync into the assignment sheets');

  // Share menu → Copy Link.
  await page.locator('.hw-bar [data-cmc-share]').click();
  await page.waitForTimeout(250);
  ok(await page.locator('#cmcShare').evaluate((el) => el.classList.contains('open')), 'share menu opens (no native share sheet on desktop)');
  await page.locator('#cmcShare [data-cmc-copy]').click();
  await page.waitForTimeout(350);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  ok(clip.endsWith('/rfc3/doctor-fish.html'), 'copy-link puts the homework URL on the clipboard', clip);

  await page.screenshot({ path: join(SHOTS, 'doctor-fish-submitted.png'), fullPage: false });
  await ctx.close();
}

// ── 4. Kid 11 card on the SPA ────────────────────────────────────────────
console.log('browser · Kid 11 card');
// 4a. Visitor + not shared → locked row.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u13-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u15-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  const page = await ctx.newPage();
  await page.route(HW_ROUTE, (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const el = document.getElementById('kid-grades');
    if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' });
    else window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
  });
  await page.waitForSelector('#kid-grades article', { timeout: 20000 });
  await page.waitForFunction(() => document.body.textContent?.includes('Online homework'), null, { timeout: 15000 });
  await page.waitForTimeout(600);
  const kid11card = page.locator('#kid-grades article').filter({ hasText: 'Reading Future Create 3' });
  ok(await kid11card.count() === 1, 'Kid 11 card renders with its book heading');
  ok((await kid11card.textContent())?.includes('11 resources'), 'Kid 11 badge counts the homework (11 resources: 4 sheets + Doctor Fish + 3 Unit 13 + 3 Unit 15 homeworks)');
  ok(await kid11card.locator('a[aria-label*="homework: Doctor Fish"]').count() === 0, 'no Open link while the homework is locked');
  ok((await kid11card.textContent())?.includes('Locked — your teacher opens this homework'), 'locked-row copy shown to visitors');
  await kid11card.screenshot({ path: join(SHOTS, 'doctor-fish-kid11-card-locked.png') });
  await ctx.close();
}
// 4b. Teacher + not shared → key switch; PATCH flips the row open.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u13-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u15-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  for (const [k, v] of Object.entries(TEACHER_SEED)) await ctx.addInitScript(([key, val]) => localStorage.setItem(key, val), [k, v]);
  const page = await ctx.newPage();
  let patches = 0;
  await page.route(HW_ROUTE, async (route) => {
    const req = route.request();
    if (req.method() === 'PATCH') {
      patches++;
      const body = JSON.parse(req.postData() || '{}');
      if (body.fields?.shared?.booleanValue !== true) { await route.fulfill({ status: 400, contentType: 'application/json', body: '{}' }); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: hwDocBody });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' });
  });
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const el = document.getElementById('kid-grades');
    if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await page.waitForFunction(() => document.body.textContent?.includes('Online homework'), null, { timeout: 15000 });
  await page.waitForTimeout(600);
  const kid11card = page.locator('#kid-grades article').filter({ hasText: 'Reading Future Create 3' });
  const switchBtn = kid11card.locator('button[aria-label*="Share Doctor Fish"][aria-label*="with students"]');
  ok(await switchBtn.count() === 1, 'teacher sees the Share-with-students key switch');
  await switchBtn.click();
  await page.waitForTimeout(700);
  ok(patches === 1, 'switch PATCHes the share doc once', `${patches}`);
  const hwLink = kid11card.locator('a[aria-label*="homework: Doctor Fish"]');
  ok(await hwLink.count() === 1, 'row flips open after the switch — Open link appears');
  ok((await hwLink.getAttribute('href'))?.endsWith('/rfc3/doctor-fish.html'), 'homework link points at the worksheet');
  const shareBtn = kid11card.locator('button[aria-label^="Share Doctor Fish"][aria-label*="homework link"]');
  ok(await shareBtn.count() === 1, 'open row offers the link Share button');
  await shareBtn.click();
  await page.waitForTimeout(500);
  const clip2 = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  ok(clip2.endsWith('/rfc3/doctor-fish.html'), 'card Share button copies the absolute homework URL (clipboard fallback)', clip2);
  await kid11card.screenshot({ path: join(SHOTS, 'doctor-fish-kid11-card.png') });
  await ctx.close();
}
// 4c. Student + shared → open row without any teacher switch.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u13-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u15-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  const page = await ctx.newPage();
  await page.route(HW_ROUTE, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: hwDocBody }));
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const el = document.getElementById('kid-grades');
    if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await page.waitForFunction(() => document.body.textContent?.includes('Online homework'), null, { timeout: 15000 });
  await page.waitForTimeout(600);
  const kid11card = page.locator('#kid-grades article').filter({ hasText: 'Reading Future Create 3' });
  ok(await kid11card.locator('a[aria-label*="homework: Doctor Fish"]').count() === 1, 'shared homework shows the Open link for students');
  ok(await kid11card.locator('button[aria-label*="with students"]').count() === 0, 'students never see the teacher key switch');
  ok((await kid11card.textContent())?.includes('Your teacher opens each homework here'), 'student-facing caption');
  await ctx.close();
}
// 4d. Teacher signs in AFTER the card mounted → the switch appears without a reload.
//     Pins the cmc-auth-changed re-sync (owner report: "telling me to sign in when i am already").
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u13-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u15-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  const page = await ctx.newPage();
  await page.route(HW_ROUTE, (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  await page.route('**/securetoken.googleapis.com/**', (route) => route.fulfill({ status: 400, contentType: 'application/json', body: '{}' }));
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  // Keep nudging the scroll until the lazy KidGradeHub chunk mounts — a
  // single scrollIntoView can race the section's IntersectionObserver.
  await page.waitForFunction(() => {
    const el = document.getElementById('kid-grades');
    if (el && !document.body.textContent?.includes('Online homework')) {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
    return document.body.textContent?.includes('Online homework') ?? false;
  }, null, { timeout: 30000 });
  await page.waitForTimeout(400);
  const kid11card = page.locator('#kid-grades article').filter({ hasText: 'Reading Future Create 3' });
  ok(await kid11card.locator('button[aria-label*="with students"]').count() === 0, 'signed-out visitor: no share switch at first');
  // The owner signs in (another tab / the auth modal) — the card must light the switch up WITHOUT a reload.
  for (const [k, v] of Object.entries(TEACHER_SEED)) await page.evaluate(([key, val]) => localStorage.setItem(key, val), [k, v]);
  await page.evaluate(() => window.dispatchEvent(new Event('cmc-auth-changed')));
  await page.waitForTimeout(400);
  ok(await kid11card.locator('button[aria-label*="Share Doctor Fish"][aria-label*="with students"]').count() === 1, 'teacher sign-in after mount lights the share switch without a reload (cmc-auth-changed re-sync)');
  await ctx.close();
}
// 4e. Switch failures are CLASSIFIED — an already-signed-in teacher is never blanket-told to sign in.
{
  // Expired mirror, no refresh token, no SDK session → "expired" + Sign in action, never a PATCH.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u13-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u15-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  const page = await ctx.newPage();
  let patches = 0;
  await page.route(HW_ROUTE, (route) => {
    if (route.request().method() === 'PATCH') { patches++; return route.fulfill({ status: 200, contentType: 'application/json', body: hwDocBody }); }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' });
  });
  await page.route('**/securetoken.googleapis.com/**', (route) => route.fulfill({ status: 400, contentType: 'application/json', body: '{}' }));
  for (const [k, v] of Object.entries(TEACHER_SEED)) {
    if (k === 'cmc-student-token-expires' || k === 'cmc-student-refresh-token') continue; // expired, pre-refresh-token session
    await ctx.addInitScript(([key, val]) => localStorage.setItem(key, val), [k, v]);
  }
  await ctx.addInitScript(() => localStorage.setItem('cmc-student-token-expires', String(Date.now() - 60_000)));
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  // Keep nudging the scroll until the lazy KidGradeHub chunk mounts — a
  // single scrollIntoView can race the section's IntersectionObserver.
  await page.waitForFunction(() => {
    const el = document.getElementById('kid-grades');
    if (el && !document.body.textContent?.includes('Online homework')) {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
    return document.body.textContent?.includes('Online homework') ?? false;
  }, null, { timeout: 30000 });
  await page.waitForTimeout(400);
  const kid11card = page.locator('#kid-grades article').filter({ hasText: 'Reading Future Create 3' });
  await kid11card.locator('button[aria-label*="Share Doctor Fish"][aria-label*="with students"]').click();
  await page.waitForTimeout(700);
  ok(patches === 0, 'expired session: no PATCH is fired');
  ok((await kid11card.textContent())?.includes('Your sign-in expired before the share could be saved'), 'expired session gets its own message (not "check you are signed in as a teacher")');
  ok(await kid11card.locator('button:has-text("Sign in")').count() === 1, 'expired session offers a Sign in action');
  ok(await kid11card.locator('button:has-text("Try again")').count() === 1, 'expired session offers Try again');
  await ctx.close();
}
{
  // Unverified email → verify-your-inbox message; the session must SURVIVE the failed share.
  const UNVERIFIED_JWT = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ email_verified: false, email: 'owner@cmcedu.info', user_id: 'teacher-uid-1' })).toString('base64url') + '.sig';
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u13-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u15-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  const page = await ctx.newPage();
  await page.route(HW_ROUTE, (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  await page.route('**/securetoken.googleapis.com/**', (route) => route.fulfill({ status: 400, contentType: 'application/json', body: '{}' }));
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  // Keep nudging the scroll until the lazy KidGradeHub chunk mounts — a
  // single scrollIntoView can race the section's IntersectionObserver.
  await page.waitForFunction(() => {
    const el = document.getElementById('kid-grades');
    if (el && !document.body.textContent?.includes('Online homework')) {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
    return document.body.textContent?.includes('Online homework') ?? false;
  }, null, { timeout: 30000 });
  // Seed AFTER boot: ensureFreshSession() legally wipes unverified sessions
  // at startup, so the toggle's own classification is what we pin here.
  for (const [k, v] of Object.entries({ ...TEACHER_SEED, 'cmc-student-token': UNVERIFIED_JWT, 'cmc-student-email': 'owner@cmcedu.info' })) {
    await page.evaluate(([key, val]) => localStorage.setItem(key, val), [k, v]);
  }
  await page.evaluate(() => window.dispatchEvent(new Event('cmc-auth-changed')));
  await page.waitForTimeout(400);
  const kid11card = page.locator('#kid-grades article').filter({ hasText: 'Reading Future Create 3' });
  await kid11card.locator('button[aria-label*="Share Doctor Fish"][aria-label*="with students"]').click();
  await page.waitForTimeout(700);
  ok((await kid11card.textContent())?.includes('email is verified'), 'unverified email gets the verify-your-inbox message');
  ok((await kid11card.textContent())?.includes('owner@cmcedu.info'), 'verify message names the account email');
  ok(await page.evaluate(() => !!localStorage.getItem('cmc-student-token')), 'failed share on an unverified account does NOT wipe the session (keepSessionOnUnverified)');
  await ctx.close();
}
{
  // Firebase 403 → permission message + Try again.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u13-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u15-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  const page = await ctx.newPage();
  await page.route(HW_ROUTE, (route) => {
    if (route.request().method() === 'PATCH') return route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":{"code":403}}' });
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' });
  });
  for (const [k, v] of Object.entries(TEACHER_SEED)) await ctx.addInitScript(([key, val]) => localStorage.setItem(key, val), [k, v]);
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  // Keep nudging the scroll until the lazy KidGradeHub chunk mounts — a
  // single scrollIntoView can race the section's IntersectionObserver.
  await page.waitForFunction(() => {
    const el = document.getElementById('kid-grades');
    if (el && !document.body.textContent?.includes('Online homework')) {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
    return document.body.textContent?.includes('Online homework') ?? false;
  }, null, { timeout: 30000 });
  await page.waitForTimeout(400);
  const kid11card = page.locator('#kid-grades article').filter({ hasText: 'Reading Future Create 3' });
  await kid11card.locator('button[aria-label*="Share Doctor Fish"][aria-label*="with students"]').click();
  await page.waitForTimeout(700);
  ok((await kid11card.textContent())?.includes('Firebase rejected the share write'), 'Firebase 403 gets the permission message');
  await ctx.close();
}
// 4f. Gate page: homework shared (or teacher sign-in) in another tab lifts the lock WITHOUT a reload.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u13-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u15-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  const page = await ctx.newPage();
  let shared = false;
  await page.route(HW_ROUTE, (route) => route.fulfill({ status: shared ? 200 : 404, contentType: 'application/json', body: shared ? hwDocBody : '{"error":{"code":404}}' }));
  await page.goto(`${BASE}/rfc3/doctor-fish.html`, { waitUntil: 'load' });
  await page.waitForSelector('#hwGate', { timeout: 8000 });
  ok(await page.locator('#hwGate').isVisible(), 'gate up while the homework is locked');
  ok(await page.locator('#hwGateCheck').isVisible(), 'gate offers a Check-again button');
  ok((await page.locator('#hwGate').textContent())?.includes('no refresh needed'), 'gate copy promises the no-reload unlock');
  await page.locator('#hwGateCheck').click();
  await page.waitForTimeout(500);
  ok(await page.locator('#hwGate').isVisible(), 'Check again keeps the gate while the doc says locked');
  // The teacher flips the switch on the card (another tab) → the gate must lift by itself.
  shared = true;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(() => !document.getElementById('hwGate'), null, { timeout: 8000 });
  ok(true, 'sharing the homework in another tab drops the gate without a reload (visibility re-check)');
  ok(await page.evaluate(() => document.documentElement.classList.contains('hw-open')), 'page flips to hw-open state');
  ok(await page.locator('[data-answer]').first().isVisible(), 'worksheet visible after the auto-unlock');
  await ctx.close();
}
// ── 5. mobile: no horizontal scroll, sticky toolbar still sticks ────────
console.log('browser · mobile worksheet');
{
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true });
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u13-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  await ctx.route('**/documents/biweekly_tests/hw-kid11-u15-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  const page = await ctx.newPage();
  await page.route(HW_ROUTE, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: hwDocBody }));
  await page.goto(`${BASE}/rfc3/doctor-fish.html`, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(overflow === 0, 'mobile: zero horizontal overflow (the fixed bg glows are clipped)', `${overflow}px`);
  // Scroll PAST the toolbar's static position (instantly — the page uses
  // scroll-behavior:smooth, which would race the measurement otherwise).
  await page.evaluate(() => {
    const tb = document.querySelector('#assignment-a .toolbar');
    window.scrollTo({ top: tb.getBoundingClientRect().top + window.scrollY - 30 + 700, behavior: 'instant' });
  });
  await page.waitForTimeout(300);
  const toolbarTop = await page.locator('#assignment-a .toolbar').first().evaluate((el) => el.getBoundingClientRect().top);
  ok(Math.abs(toolbarTop - 64) < 12, 'mobile: assignment toolbar still sticks under the fixed header (overflow-x:clip did not break sticky)', `top=${Math.round(toolbarTop)}`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(SHOTS, 'doctor-fish-mobile.png') });
  await ctx.close();
}

await browser.close();
server.close();

console.log(`\nverify_doctor_fish: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
