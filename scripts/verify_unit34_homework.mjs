// Verify the Kid 11 Unit 3 + Unit 4 homework feature (owner request, Nov 2026):
//
//   "implement these homwork lesson in kid 11 like the rest"
//
// The teacher's Unit 3 · Pocahontas file (Homework 1 The Archive Record 30 pts,
// Homework 2 Timeline Historian 27 pts, Homework 3 Museum Interpreter 16 pts
// = 73 graded units) and Unit 4 · Walt Disney file (Homework 1 The Storyboard
// Desk 30 pts, Homework 2 Timeline Producer 29 pts, Homework 3 Legacy Writer
// 16 pts = 75 graded units) ship as public/rfc3/unit3hw.html and
// public/rfc3/unit4hw.html with the SAME site furniture Units 2/13/14/15
// shipped. EACH homework is gated by its own Firestore doc
// (biweekly_tests/hw-kid11-u3-hw1|2|3 and hw-kid11-u4-hw1|2|3 — public read,
// teacher-only write, no rules change): students see ONLY the shared
// homework, no-homework → full-page locked overlay, teachers get a preview
// banner, and the Kid 11 card carries one share switch per homework
// (18 homework rows now).
import { chromium } from 'playwright';
import { readFile, readdir } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const PORT = 8961; const BASE = `http://127.0.0.1:${PORT}`;
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

const ALL_PREFIXES = ['hw-kid11-u2-', 'hw-kid11-u13-', 'hw-kid11-u14-', 'hw-kid11-u15-', 'hw-kid11-u3-', 'hw-kid11-u4-'];
const docBody = (doc, shared) => JSON.stringify({
  name: `projects/demo/databases/(default)/documents/biweekly_tests/${doc}`,
  fields: { shared: { booleanValue: shared } },
});
const routeClosed = (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' });
function routeDocs(prefix, state) {
  return (route) => {
    const url = route.request().url();
    const m = new RegExp(prefix.replace(/-/g, '\\-') + '(hw[123])').exec(url);
    if (!m) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    if (route.request().method() === 'PATCH') {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.fields?.shared?.booleanValue === true) state[m[1]] = true;
      if (body.fields?.shared?.booleanValue === false) state[m[1]] = false;
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: docBody(`${prefix}${m[1]}`, state[m[1]]) });
  };
}
const routeOthers = (prefix) => ALL_PREFIXES.filter((p) => p !== prefix).map((p) => [`**/documents/biweekly_tests/${p}hw*`, routeClosed]);

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

// ── the two units under test ──────────────────────────────────────────────
const UNITS = [
  {
    key: 'u3', file: 'unit3hw.html', unit: 'Unit 3 · Pocahontas', person: 'Pocahontas',
    prefix: 'hw-kid11-u3-', doc: 'hw-kid11-u3', slug: 'unit3hw.html',
    hw: ['The Archive Record', 'Timeline Historian', 'Museum Interpreter'],
    totals: [30, 27, 16], graded: 73, wm: ['g', 'f', 'e', 'a', 'h', 'b', 'd', 'c'],
    check: ['Check the Record', 'File the Timeline', 'Open the Exhibit'],
    bad: ['unit4hw', 'Walt Disney', 'unit2hw', 'unit13hw', 'unit15hw', 'doctor-fish', 'Doctor Fish',
          'Spa Intake', 'Treatment Analyst', 'Health Writer', 'Museum Docent', 'da Vinci',
          'Storyboard', 'Legacy Writer', 'hw-kid11-u4-'],
  },
  {
    key: 'u4', file: 'unit4hw.html', unit: 'Unit 4 · Walt Disney', person: 'Walt Disney',
    prefix: 'hw-kid11-u4-', doc: 'hw-kid11-u4', slug: 'unit4hw.html',
    hw: ['The Storyboard Desk', 'Timeline Producer', 'Legacy Writer'],
    totals: [30, 29, 16], graded: 75, wm: ['c', 'f', 'b', 'h', 'a', 'd', 'e', 'g'],
    check: ['Check Storyboard', 'Approve the Cut', 'Publish Feature'],
    bad: ['unit3hw', 'Pocahontas', 'unit2hw', 'unit13hw', 'unit15hw', 'doctor-fish', 'Doctor Fish',
          'Spa Intake', 'Treatment Analyst', 'Health Writer', 'Museum Docent', 'Museum Interpreter',
          'da Vinci', 'Archive Record', 'hw-kid11-u3-'],
  },
];

// Ordered key sequences extracted from the teacher uploads (HW1 → HW3).
const SEQ = {
  u3: ['g','f','e','a','h','b','d','c','leader','nickname','playful','marry','religion','relationship','worse','conflict|conflicts','b','c','a','b','c','T','T','F','T','F','d','a','b','c','born,grew,met1607,rolfe,married,england','b','c','d','a','c','a','b','d','e','supported','disputed','supported','disputed','supported','disputed','supported','disputed','b','a','c','fact','opinion','fact','opinion','fact','opinion','fact','opinion','b'],
  u4: ['c','f','b','h','a','d','e','g','cartoon','deliver','management','give up','studio','cancer','decade','courage','b','c','a','b','c','F','T','T','F','T','d','a','b','c','young,first,study,second,studio,film,park,legacy','c','a','b','d','e','key','detail','key','detail','key','detail','key','detail','b','a','c','b','c','a','b','fact','opinion','fact','opinion','fact','opinion','fact','opinion','b'],
};

// ── static checks on both worksheet builds ────────────────────────────────
const seq = (text) => [...text.matchAll(/data-(?:answer|correct|solution)="([^"]+)"/g)].map(m => m[1]);
for (const U of UNITS) {
  console.log(`static · dist/rfc3/${U.file}`);
  let ws = '';
  try { ws = await readFile(join(DIST, `rfc3/${U.file}`), 'utf8'); } catch {}
  ok(ws.length > 100000, `${U.file} shipped into dist/ (non-trivial size)`, `${ws.length} bytes`);
  const builtKeys = seq(ws);
  ok(builtKeys.length === SEQ[U.key].length && JSON.stringify(builtKeys) === JSON.stringify(SEQ[U.key]),
     `all ${SEQ[U.key].length} key attributes present in teacher order (${U.graded} graded units: HW1 ${U.totals[0]} + HW2 ${U.totals[1]} + HW3 ${U.totals[2]})`, `got ${builtKeys.length}`);
  try {
    const src = await readFile(`/home/z/my-project/upload/${U.file.replace('hw.html', '')}.html`, 'utf8');
    ok(JSON.stringify(seq(src)) === JSON.stringify(builtKeys), `graded keys match the teacher's ${U.file.replace('hw.html', '.html')} byte-for-byte (1:1 attachment)`);
  } catch { console.log('  (teacher source unavailable — KEY pin only)'); }
  ok((ws.match(/id="w-/g) || []).length === 8, 'all 8 write-task sections present');
  for (const [needle, label] of [
    ['id="submitBtn"', 'Submit-to-Teacher completion button present'],
    ['function submitCompletion', 'completion submit handler present'],
    ['documents/drill_attempts', 'posts to the drill_attempts pipeline'],
    [`drillSlug:   { stringValue: '${U.slug}' }`, `drillSlug is ${U.slug}`],
    [`Homework 1 · ${U.hw[0]}`, 'HW1 title on the completion payload'],
    [`Homework 2 · ${U.hw[1]}`, 'HW2 title on the completion payload'],
    [`Homework 3 · ${U.hw[2]}`, 'HW3 title on the completion payload'],
    ["drillSource: { stringValue: 'rfc3' }", 'drillSource rfc3'],
    ['Add your name first', 'name gate before submit'],
    ['cmcLooksLikeEmail', 'email-as-name guard shipped'],
    ['Back to CMC', 'back-to-CMC button'],
    ['wa.me', 'share: WhatsApp'],
    ['data-cmc-copy', 'share: copy link'],
    [`${U.prefix}hw1`, 'gate reads share doc 1'],
    [`${U.prefix}hw2`, 'gate reads share doc 2'],
    [`${U.prefix}hw3`, 'gate reads share doc 3'],
    ['d.fields.shared.booleanValue === true', 'gate opens only on shared:true'],
    ['Homework not shared yet', 'locked overlay for students'],
    [`Unit ${U.key.slice(1)} homework</b> (${U.person})`, 'lock message names the unit'],
    ['firstSharedMode', 'deep links fall back to the first shared homework'],
    ['window.CMC_HW_SETMODE=setMode;window.CMC_HW_GRADE=grade;', 'gate→engine bridge hooks shipped'],
    ['.meta input{color:var(--ink)!important;caret-color:var(--ink)!important;font-weight:600}', 'hero inputs: theme ink pinned (readable)'],
    ['.meta input::placeholder{color:#93a8ab;opacity:1;font-weight:600}', 'hero inputs: placeholder override shipped'],
  ]) ok(ws.includes(needle), label);
  for (const b of U.bad) ok(!ws.includes(b), `no ${b} leftover in the ${U.key} file`);
  ok(!/TODO|XXX|【/.test(ws), 'no leftover placeholders');
}

// ── Kid 11 card bundle carries both units ─────────────────────────────────
console.log('static · KidGradeHub bundle');
{
  const assets = await readdir(join(DIST, 'assets'));
  const hubChunk = assets.find((f) => f.startsWith('KidGradeHub-') && f.endsWith('.js'));
  ok(!!hubChunk, 'KidGradeHub chunk exists in dist/assets');
  if (hubChunk) {
    const hub = await readFile(join(DIST, 'assets', hubChunk), 'utf8');
    for (const U of UNITS) {
      ok(hub.includes(`${U.slug}#hw-a`) && hub.includes(`${U.slug}#hw-b`) && hub.includes(`${U.slug}#hw-c`), `card links all three ${U.unit} homeworks`);
      ok(hub.includes(`${U.prefix}hw1`) && hub.includes(`${U.prefix}hw2`) && hub.includes(`${U.prefix}hw3`), `card polls the three ${U.unit} share docs`);
      for (let i = 0; i < 3; i++) ok(hub.includes(`Unit ${U.key.slice(1)} · Homework ${i + 1} — ${U.hw[i]}`), `row title U${U.key.slice(1)} HW${i + 1}`);
    }
    ok(hub.includes('hw-kid11-u13-hw1') && hub.includes('hw-kid11-u14-hw1') && hub.includes('hw-kid11-u15-hw1') && hub.includes('hw-kid11-u2-hw1'), 'card still polls the Unit 2/13/14/15 share docs (18 homework rows)');
    ok(hub.includes('More homeworks'), 'card fold control still shipped');
  }
}

// ── browser battery per unit ──────────────────────────────────────────────
const browser = await chromium.launch();

for (const U of UNITS) {
  const n = U.key.slice(1);
  const prefix = U.prefix;
  const docRoute = `**/documents/biweekly_tests/${prefix}hw*`;

  console.log(`browser · ${U.unit} — share gate`);
  // 1. Student + nothing shared → locked overlay.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.route(docRoute, routeDocs(prefix, { hw1: false, hw2: false, hw3: false }));
    for (const [r, h] of routeOthers(prefix)) await page.route(r, h);
    await page.goto(`${BASE}/rfc3/${U.file}`, { waitUntil: 'load' });
    await page.waitForSelector('#hwGate', { timeout: 8000 });
    ok(await page.locator('#hwGate').isVisible(), `${U.key}: locked overlay shown when no homework is shared`);
    ok(((await page.locator('#hwGate p').textContent()) || '').includes(U.person), `${U.key}: overlay names ${U.person}`);
    ok(await page.locator('[data-answer]').first().isHidden(), `${U.key}: worksheet questions hidden behind the gate`);
    for (const m of ['a', 'b', 'c']) ok(await page.locator(`.tab[data-mode="${m}"]`).isHidden(), `${U.key}: HW${m} tab hidden from students`);
    await page.screenshot({ path: join(SHOTS, `${U.key}-locked.png`), fullPage: false });
    await ctx.close();
  }

  // 2. Teacher preview + deep link.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    for (const [k, v] of Object.entries(TEACHER_SEED)) await ctx.addInitScript(([key, val]) => localStorage.setItem(key, val), [k, v]);
    const page = await ctx.newPage();
    await page.route(docRoute, routeDocs(prefix, { hw1: false, hw2: false, hw3: false }));
    for (const [r, h] of routeOthers(prefix)) await page.route(r, h);
    await page.goto(`${BASE}/rfc3/${U.file}`, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    ok(await page.locator('#hwGate').count() === 0, `${U.key}: teacher bypasses the lock`);
    ok(await page.locator('#hwBanner').isVisible(), `${U.key}: teacher preview banner visible`);
    ok(await page.locator(`.tab[data-mode="b"]`).isVisible(), `${U.key}: teacher sees HW2 tab`);
    await page.goto(`${BASE}/rfc3/${U.file}?preview=hw-b#hw-b`, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    ok(await page.locator('#hw-b').isVisible(), `${U.key}: teacher deep link #hw-b previews Homework 2`);
    ok(await page.locator('#hw-a').isHidden(), `${U.key}: HW1 hidden while previewing Homework 2`);
    await ctx.close();
  }

  // 3. Student + ONLY HW1 shared → one tab; deep link falls back.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.route(docRoute, routeDocs(prefix, { hw1: true, hw2: false, hw3: false }));
    for (const [r, h] of routeOthers(prefix)) await page.route(r, h);
    await page.goto(`${BASE}/rfc3/${U.file}#hw-b`, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    ok(await page.locator('#hwGate').count() === 0, `${U.key}: shared homework opens for students`);
    ok(await page.locator('.tab[data-mode="a"]').isVisible(), `${U.key}: HW1 tab visible for students`);
    ok(await page.locator('.tab[data-mode="b"]').isHidden(), `${U.key}: HW2 tab does not exist for students`);
    ok(await page.locator('#hw-a').isVisible(), `${U.key}: deep link to an unshared homework falls back to Homework 1`);
    ok(await page.evaluate(() => document.body.dataset.mode) === 'a', `${U.key}: active homework is the assigned one`);
    await ctx.close();
  }

  console.log(`browser · ${U.unit} — completion submit (student, HW1)`);
  const submits = [];
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.route(docRoute, routeDocs(prefix, { hw1: true, hw2: false, hw3: false }));
    for (const [r, h] of routeOthers(prefix)) await page.route(r, h);
    await page.route('**/documents/drill_attempts*', async (route) => {
      const req = route.request();
      submits.push({ headers: req.headers(), body: JSON.parse(req.postData() || '{}') });
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"name":"projects/demo/databases/(default)/documents/drill_attempts/verify"}' });
    });
    await page.goto(`${BASE}/rfc3/${U.file}`, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    const nameStyles = await page.locator('#hw-a .meta input').first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, color: cs.color };
    });
    const rgba = (s) => (s.match(/rgba?\(([^)]+)\)/) || [])[1]?.split(',').map(Number) || [];
    const [cr, cg, cb2] = rgba(nameStyles.color);
    const [br, bg2, bb] = rgba(nameStyles.bg);
    ok(cr < 90 && cg < 110 && cb2 < 110, `${U.key}: name field text is dark ink on the white box`, nameStyles.color);
    ok(br > 235 && bg2 > 235 && bb > 235, `${U.key}: name field sits on an opaque white box`, nameStyles.bg);
    await page.locator('.hw-bar #submitBtn').click();
    await page.waitForTimeout(400);
    ok(submits.length === 0, `${U.key}: submit without a name is blocked`);
    ok(((await page.locator('#cmcToast').textContent()) || '').includes('Add your name first'), `${U.key}: name gate toast explains why`);
    await page.locator('#hw-a .meta input').first().fill('Dara Kim');
    await page.locator('#hw-a .meta input').nth(1).fill('2026-11-14');
    await page.evaluate(() => {
      const root = document.getElementById('hw-b');
      root.querySelectorAll('.meta input').forEach((inp) => inp.dispatchEvent(new Event('input', { bubbles: true })));
    });
    ok((await page.locator('#hw-b .meta input').first().inputValue()) === 'Dara Kim', `${U.key}: name mirrors into Homework 2 hero`);
    await page.getByRole('button', { name: U.check[0] }).click();
    await page.waitForTimeout(300);
    ok(((await page.locator('#hw-a .score-line').textContent()) || '').trim() === `0 / ${U.totals[0]} points`, `${U.key}: HW1 blanks score 0 / ${U.totals[0]} points`);
    await page.locator('.hw-bar #submitBtn').click();
    await page.waitForTimeout(500);
    ok(submits.length === 1, `${U.key}: named blank submit POSTs once`);
    {
      const b = submits[0]?.body?.fields ?? {};
      const h = submits[0]?.headers ?? {};
      ok(b.drillSlug?.stringValue === U.slug, `${U.key}: payload drillSlug ${U.slug}`);
      ok(b.drillTitle?.stringValue === `${U.unit} — Homework 1 · ${U.hw[0]}`, `${U.key}: payload names Homework 1 · ${U.hw[0]}`, b.drillTitle?.stringValue);
      ok(b.drillSource?.stringValue === 'rfc3', `${U.key}: payload drillSource rfc3`);
      ok(b.studentName?.stringValue === 'Dara Kim', `${U.key}: payload carries the student name`);
      ok(b.studentUid?.stringValue === '', `${U.key}: guest branch: studentUid empty`);
      ok(b.totalCount?.integerValue === String(U.totals[0]) && b.correctCount?.integerValue === '0' && b.scorePct?.integerValue === '0', `${U.key}: blank run scores 0/${U.totals[0]} → 0%`);
      ok(b.classId && b.classId.nullValue === null, `${U.key}: classId null`);
      ok(!h.authorization, `${U.key}: guest POST carries no Authorization header`);
    }
    // Answer the 8 word meanings correctly → 8/30 on the next submit.
    await page.evaluate((answers) => {
      const sels = [...document.querySelectorAll('#hw-a select')].slice(0, 8);
      sels.forEach((sel, i) => { sel.value = answers[i]; sel.dispatchEvent(new Event('change', { bubbles: true })); });
    }, U.wm);
    await page.getByRole('button', { name: U.check[0] }).click();
    await page.waitForTimeout(300);
    ok(((await page.locator('#hw-a .score-line').textContent()) || '').trim() === `8 / ${U.totals[0]} points`, `${U.key}: 8 correct word meanings score 8 / ${U.totals[0]} points`);
    await page.locator('.hw-bar #submitBtn').click();
    await page.waitForTimeout(500);
    {
      const b = submits[1]?.body?.fields ?? {};
      ok(b.correctCount?.integerValue === '8' && b.scorePct?.integerValue === '27', `${U.key}: partial run scores 8/${U.totals[0]} → 27%`, JSON.stringify(b));
    }
    await ctx.close();
  }

  // 4. Teacher on the open page: HW2 + HW3 submits carry their own totals.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    for (const [k, v] of Object.entries(TEACHER_SEED)) await ctx.addInitScript(([key, val]) => localStorage.setItem(key, val), [k, v]);
    const page = await ctx.newPage();
    await page.route(docRoute, routeDocs(prefix, { hw1: true, hw2: true, hw3: true }));
    for (const [r, h] of routeOthers(prefix)) await page.route(r, h);
    await page.route('**/documents/drill_attempts*', async (route) => {
      const req = route.request();
      submits.push({ headers: req.headers(), body: JSON.parse(req.postData() || '{}') });
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"name":"x"}' });
    });
    await page.goto(`${BASE}/rfc3/${U.file}`, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    await page.locator('.tab[data-mode="b"]').click();
    await page.locator('.hw-bar #submitBtn').click();
    await page.waitForTimeout(500);
    {
      const b = submits[submits.length - 1]?.body?.fields ?? {};
      ok((b.drillTitle?.stringValue || '').includes(`Homework 2 · ${U.hw[1]}`), `${U.key}: ${U.hw[1]} submit names Homework 2`);
      ok(b.totalCount?.integerValue === String(U.totals[1]), `${U.key}: Homework 2 grades out of ${U.totals[1]} points`);
    }
    await page.locator('.tab[data-mode="c"]').click();
    await page.locator('.hw-bar #submitBtn').click();
    await page.waitForTimeout(500);
    {
      const b = submits[submits.length - 1]?.body?.fields ?? {};
      ok((b.drillTitle?.stringValue || '').includes(`Homework 3 · ${U.hw[2]}`), `${U.key}: ${U.hw[2]} submit names Homework 3`);
      ok(b.totalCount?.integerValue === String(U.totals[2]), `${U.key}: Homework 3 grades out of ${U.totals[2]} points`);
    }
    await ctx.close();
  }

  // 5. Gate auto-unlock + re-lock, live.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const mine = { hw1: false, hw2: false, hw3: false };
    await page.route(docRoute, routeDocs(prefix, mine));
    for (const [r, h] of routeOthers(prefix)) await page.route(r, h);
    await page.goto(`${BASE}/rfc3/${U.file}`, { waitUntil: 'load' });
    await page.waitForSelector('#hwGate', { timeout: 8000 });
    ok(await page.locator('#hwGateCheck').isVisible(), `${U.key}: gate offers a Check-again button`);
    mine.hw1 = true;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(() => !document.getElementById('hwGate'), null, { timeout: 8000 });
    ok(true, `${U.key}: sharing Homework 1 in another tab drops the gate without a reload`);
    ok(await page.locator('.tab[data-mode="a"]').isVisible(), `${U.key}: HW1 tab appears after the unlock`);
    mine.hw1 = false;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForSelector('#hwGate', { timeout: 8000 });
    ok(await page.locator('#hwGate').isVisible(), `${U.key}: closing the homework re-locks the page live`);
    await ctx.close();
  }

  // 6. Auto-switch: shared HW2 closed under the student → falls back to HW1.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const mine = { hw1: true, hw2: true, hw3: false };
    await page.route(docRoute, routeDocs(prefix, mine));
    for (const [r, h] of routeOthers(prefix)) await page.route(r, h);
    await page.goto(`${BASE}/rfc3/${U.file}#hw-b`, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    ok(await page.locator('#hw-b').isVisible(), `${U.key}: student opens shared Homework 2 via deep link`);
    mine.hw2 = false;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(600);
    ok(await page.locator('.tab[data-mode="b"]').isHidden(), `${U.key}: HW2 tab vanishes the moment the teacher closes it`);
    ok(await page.locator('#hw-a').isVisible(), `${U.key}: page auto-switches to the still-shared Homework 1`);
    await ctx.close();
  }

  // 7. Kid 11 card — switches, PATCH to the unit's own docs, fold safety.
  console.log(`browser · Kid 11 card — ${U.unit} switches + fold`);
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
    for (const [k, v] of Object.entries(TEACHER_SEED)) await ctx.addInitScript(([key, val]) => localStorage.setItem(key, val), [k, v]);
    const page = await ctx.newPage();
    const patches = [];
    const state = { hw1: false, hw2: false, hw3: false };
    await page.route(docRoute, (route) => {
      const req = route.request();
      const m = new RegExp(prefix.replace(/-/g, '\\-') + '(hw[123])').exec(req.url());
      if (!m) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
      if (req.method() === 'PATCH') {
        const body = JSON.parse(req.postData() || '{}');
        patches.push({ doc: m[1], body });
        if (body.fields?.shared?.booleanValue === true) state[m[1]] = true;
        return route.fulfill({ status: 200, contentType: 'application/json', body: docBody(`${prefix}${m[1]}`, state[m[1]]) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: docBody(`${prefix}${m[1]}`, state[m[1]]) });
    });
    for (const [r, h] of routeOthers(prefix)) await page.route(r, h);
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
    ok(((await kid11card.textContent())?.includes('22 resources')), 'Kid 11 badge counts 22 resources (4 sheets + six 3-homework units)');
    const moreBtn = kid11card.locator('button[aria-expanded]');
    ok(await moreBtn.count() === 1, 'folded card carries exactly one More control');
    ok(((await moreBtn.textContent()) || '').includes('More homeworks · 16 more'), 'fold label counts the sixteen rows still folded away (18 rows now)', await moreBtn.textContent());
    await moreBtn.click();
    await page.waitForTimeout(400);
    for (let i = 0; i < 3; i++) {
      ok(await kid11card.locator(`button[aria-label*="Share Unit ${n} · Homework ${i + 1}"][aria-label*="with students"]`).count() === 1,
        `teacher sees the share switch for ${U.unit} Homework ${i + 1}`);
    }
    // Assign ONLY the unit's Homework 3 (rows 15/18 — the last rows on the card).
    await kid11card.locator(`button[aria-label*="Share Unit ${n} · Homework 3"][aria-label*="with students"]`).click();
    await page.waitForTimeout(800);
    ok(patches.length === 1 && patches[0].doc === 'hw3', `switch PATCHes ${U.unit} Homework 3's own share doc`, JSON.stringify(patches.map(p => p.doc)));
    ok(patches[0]?.body?.fields?.homeworkId?.stringValue === `kid-11-homework-${U.key}-hw3`, `PATCH carries the ${U.key} homework id`);
    const hw3Link = kid11card.locator(`a[aria-label*="Unit ${n} · Homework 3 — ${U.hw[2]}"]`);
    ok(await hw3Link.count() === 1, 'assigned homework row flips open — Open link appears');
    ok((await hw3Link.getAttribute('href'))?.endsWith(`/rfc3/${U.file}#hw-c`), `open row deep links to ${U.key} Homework 3`);
    const shareBtn = kid11card.locator(`button[aria-label^="Share Unit ${n} · Homework 3"][aria-label*="homework link"]`);
    ok(await shareBtn.count() === 1, 'open row offers the link Share button');
    await shareBtn.click();
    await page.waitForTimeout(500);
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    ok(clip.endsWith(`/rfc3/${U.file}#hw-c`), `card Share button copies the absolute ${U.key} homework URL`, clip);
    await moreBtn.click();
    await page.waitForTimeout(400);
    ok(((await moreBtn.textContent()) || '').includes('More homeworks · 15 more'), 'folded label drops to 15 (the assigned row rides along)', await moreBtn.textContent());
    ok(await kid11card.locator(`a[aria-label*="Unit ${n} · Homework 3 — ${U.hw[2]}"]`).count() === 1, `assigned ${U.key} Homework 3 stays visible on the folded card`);
    await kid11card.screenshot({ path: join(SHOTS, `${U.key}-kid11-card.png`) });
    await ctx.close();
  }

  // 8. Student isolation on the card.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.route(docRoute, routeDocs(prefix, { hw1: true, hw2: false, hw3: false }));
    for (const [r, h] of routeOthers(prefix)) await page.route(r, h);
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
    ok(await kid11card.locator(`a[aria-label*="Unit ${n} · Homework 1 — ${U.hw[0]}"]`).count() === 1, `student sees the assigned ${U.unit} Homework 1 row`);
    for (const [other, title] of [['Unit 13 · Homework 1 — Field Notebook', 'u13'], ['Unit 14 · Homework 1 — Spa Intake File', 'u14'], ['Unit 15 · Homework 1 — Lab Induction', 'u15'], ['Unit 2 · Homework 1 — Museum Docent', 'u2']]) {
      ok(((await kid11card.textContent())?.includes(title)) === false, `student never sees the unshared ${other} row`);
    }
    const otherUnit = U.key === 'u3' ? UNITS[1] : UNITS[0];
    ok(((await kid11card.textContent())?.includes(`${otherUnit.unit} · Homework 1 — ${otherUnit.hw[0]}`)) === false, `student never sees the unshared ${otherUnit.unit} rows`);
    ok(await kid11card.locator('button[aria-label*="with students"]').count() === 0, `${U.key}: students never see any teacher key switch`);
    await ctx.close();
  }

  // 9. Mobile.
  {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true });
    const page = await ctx.newPage();
    await page.route(docRoute, routeDocs(prefix, { hw1: true, hw2: false, hw3: false }));
    for (const [r, h] of routeOthers(prefix)) await page.route(r, h);
    await page.goto(`${BASE}/rfc3/${U.file}`, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(overflow === 0, `${U.key}: mobile zero horizontal overflow`, `${overflow}px`);
    await page.evaluate(() => {
      const tb = document.querySelector('#hw-a .toolbar');
      window.scrollTo({ top: tb.getBoundingClientRect().top + window.scrollY - 30 + 700, behavior: 'instant' });
    });
    await page.waitForTimeout(300);
    const toolbarTop = await page.locator('#hw-a .toolbar').first().evaluate((el) => el.getBoundingClientRect().top);
    ok(Math.abs(toolbarTop - 68) < 14, `${U.key}: mobile homework toolbar sticks under the fixed header`, `top=${Math.round(toolbarTop)}`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(SHOTS, `${U.key}-mobile.png`) });
    await ctx.close();
  }
}

await browser.close();
server.close();
console.log(`\nverify_unit34_homework: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
