// Kid-section homework — "the teacher can see how each student did".
//
// Reported by the owner: homework is assigned from the Kid Program cards,
// students press "Submit to Teacher", and the only screens that moved were
// the live leaderboards (ticker, games board) — which show "N drills · X%
// avg" per student, never the score of the homework. The scores were stored
// all along; no screen listed them per homework.
//
// This verifier plays the flow in a headless browser against an in-memory
// Firestore that enforces the guest branch of the drill_attempts rules:
//
//   1. a student does a homework, presses Check, corrects answers and
//      presses Submit WITHOUT checking again — the stored score is the paper
//      as handed in (it used to be the stale score of the last check), and
//      the row also carries the score of the first check;
//   2. the first check survives a page reload (a corrected paper is not a
//      "first try") and a second submission;
//   3. the same on a page built with the other homework engine (IIFE);
//   4. the teacher opens the Kid Program card → Scores: one line per
//      student with first try, best score and how often it was handed in;
//      other homeworks and other pages are not mixed in; old rows without a
//      recorded first check are marked;
//   5. the sheet picks up a new submission by itself;
//   6. students (no teacher session) get no Scores button.
//
//   node scripts/verify_kid_homework.mjs
//   KIDHW_DIST=public     serve another folder (default ../dist)
//   KIDHW_SHOTS=/dir      also save screenshots of the sheet (dark + light)
//   PW_CHROMIUM=/path     use this Chromium binary (with playwright-core)
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import('playwright').catch(() => import('playwright-core'));

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(process.env.KIDHW_DIST || join(HERE, '..', 'dist'));
const SHOTS = process.env.KIDHW_SHOTS ? resolve(process.env.KIDHW_SHOTS) : null;

// One ORIGIN per person: some headless Chromium builds share localStorage
// across browser contexts, and teacher and students need separate storage.
const PORT = 8940;
const ORIGIN = (n) => `http://127.0.0.1:${PORT + n}`;
const servers = [];
for (let n = 0; n < 5; n++) {
  const server = createServer(async (req, res) => {
    try {
      const file = normalize(decodeURIComponent(new URL(req.url, ORIGIN(0)).pathname));
      const data = await readFile(join(DIST, file.endsWith('/') ? file + 'index.html' : file));
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(PORT + n, '127.0.0.1', r));
  servers.push(server);
}

// ── in-memory Firestore (REST) ──────────────────────────────────────────
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (claims) => `${b64u({ alg: 'none' })}.${b64u(claims)}.sig`;
const TEACHER = { user_id: 'teacher-1', email: 'bora@school.edu.kh', email_verified: true };

const SHARED = new Set(['hw-kid11-u13-hw1', 'hw-kid11-u4-hw1']);
const db = { attempts: [], listReads: 0, countReads: 0 };
const violations = [];
const DAY = 86_400_000;

const str = (f) => (f && typeof f.stringValue === 'string' ? f.stringValue : undefined);
const int = (f) => (f && 'integerValue' in f && /^-?\d+$/.test(String(f.integerValue)) ? Number(f.integerValue) : undefined);
const between = (n, lo, hi) => typeof n === 'number' && n >= lo && n <= hi;

/** firestore.rules → match /drill_attempts/{attemptId} → guest create branch. */
function guestCreateAllowed(f) {
  if ('inviteMode' in f && f.inviteMode.booleanValue !== false) return 'inviteMode';
  if (str(f.studentUid) !== '') return 'studentUid must be empty';
  const name = str(f.studentName);
  if (name === undefined || name.length < 1 || name.length > 40) return 'studentName';
  const slug = str(f.drillSlug);
  if (slug === undefined || slug.length < 1 || slug.length > 80) return 'drillSlug';
  const title = str(f.drillTitle);
  if (title === undefined || title.length < 1 || title.length > 120) return 'drillTitle';
  const source = str(f.drillSource);
  if (source === undefined || source.length < 1 || source.length > 40) return 'drillSource';
  if (!between(int(f.scorePct), 0, 100)) return 'scorePct';
  if (!between(int(f.correctCount), 0, 10000)) return 'correctCount';
  if (!between(int(f.totalCount), 0, 10000)) return 'totalCount';
  if ('classId' in f && !('nullValue' in f.classId)) return 'classId must be null';
  return null;
}

function seed(fields, agoMs) {
  const id = `seed-${db.attempts.length + 1}`;
  db.attempts.push({
    name: `projects/demo/databases/(default)/documents/drill_attempts/${id}`,
    fields: {
      drillSource: { stringValue: 'rfc3' }, studentUid: { stringValue: '' }, classId: { nullValue: null },
      submittedAt: { timestampValue: new Date(Date.now() - agoMs).toISOString() },
      ...fields,
    },
  });
}
const row = (slug, title, name, correct, total) => ({
  drillSlug: { stringValue: slug }, drillTitle: { stringValue: title }, studentName: { stringValue: name },
  correctCount: { integerValue: String(correct) }, totalCount: { integerValue: String(total) },
  scorePct: { integerValue: String(Math.round((correct / total) * 100)) },
});
const U13 = 'Unit 13 · New Homes for Animals — ';

function firestore(method, url, body) {
  const path = new URL(url).pathname;
  const share = /\/documents\/biweekly_tests\/([\w-]+)$/.exec(path);
  if (share && method === 'GET') {
    if (!SHARED.has(share[1])) return { code: 404, body: { error: { code: 404, status: 'NOT_FOUND' } } };
    return { code: 200, body: { name: `projects/demo/databases/(default)/documents/biweekly_tests/${share[1]}`, fields: { shared: { booleanValue: true } } } };
  }
  if (path.endsWith('/documents/drill_attempts') && method === 'POST') {
    const f = body.fields || {};
    const why = guestCreateAllowed(f);
    if (why) { violations.push(`drill_attempts create refused: ${why}`); return { code: 403, body: { error: { code: 403, status: 'PERMISSION_DENIED' } } }; }
    const name = `projects/demo/databases/(default)/documents/drill_attempts/live-${db.attempts.length + 1}`;
    db.attempts.push({ name, fields: f });
    return { code: 200, body: { name, fields: f } };
  }
  const where = (q) => q?.where?.fieldFilter;
  const match = (q) => {
    const w = where(q);
    if (!w) return db.attempts;
    const field = w.field?.fieldPath;
    if (w.op === 'EQUAL') return db.attempts.filter((a) => str(a.fields[field]) === w.value?.stringValue);
    if (w.op === 'GREATER_THAN_OR_EQUAL' && field === 'submittedAt') return db.attempts.filter((a) => a.fields.submittedAt?.timestampValue >= w.value?.timestampValue);
    return [];
  };
  if (path.endsWith('/documents:runQuery') && method === 'POST') {
    const q = body.structuredQuery;
    if (q?.from?.[0]?.collectionId !== 'drill_attempts') return { code: 200, body: [{ readTime: new Date().toISOString() }] };
    if (where(q)?.field?.fieldPath === 'drillSlug') db.listReads += 1;
    const docs = match(q).slice(0, q.limit || 5000);
    return { code: 200, body: docs.length ? docs.map((document) => ({ document })) : [{ readTime: new Date().toISOString() }] };
  }
  if (path.endsWith('/documents:runAggregationQuery') && method === 'POST') {
    const q = body.structuredAggregationQuery?.structuredQuery;
    if (q?.from?.[0]?.collectionId !== 'drill_attempts') return { code: 200, body: [{ result: { aggregateFields: { count: { integerValue: '0' } } } }] };
    if (where(q)?.field?.fieldPath === 'drillSlug') db.countReads += 1;
    return { code: 200, body: [{ result: { aggregateFields: { count: { integerValue: String(match(q).length) } } } }] };
  }
  return { code: 404, body: { error: { code: 404, status: 'NOT_FOUND' } } }; // other collections: not part of this test
}

// ── browser ─────────────────────────────────────────────────────────────

const browser = await chromium.launch({ headless: true, ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM, args: ['--no-sandbox', '--disable-gpu', '--single-process', '--no-zygote'] } : {}) });
const results = [];
const ok = (name, cond, detail) => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined && detail !== '' ? ' — ' + detail : ''}`);
const pageErrors = [];
// A crash (browser gone, selector missing) still prints what was checked so far.
process.on('uncaughtException', (e) => {
  console.log(results.join('\n'));
  console.log(`\nCRASHED after ${results.length} checks: ${String(e?.message || e).split('\n')[0]}`);
  if (pageErrors.length) console.log('page errors: ' + pageErrors.join('; '));
  process.exit(2);
});
process.on('unhandledRejection', (e) => { throw e; });

async function makeContext(label, viewport = { width: 1280, height: 900 }) {
  // Service workers off: the sandboxed single-process Chromium dies when a
  // second context registers the site's worker. Not part of this test.
  const ctx = await browser.newContext({ viewport, acceptDownloads: true, serviceWorkers: 'block' });
  await ctx.route('**/*', async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.startsWith('http://127.0.0.1:')) return route.continue();
    if (url.includes('firestore.googleapis.com')) {
      let body = {};
      try { body = JSON.parse(req.postData() || '{}'); } catch { /* GET */ }
      const out = firestore(req.method(), url, body);
      return route.fulfill({ status: out.code, contentType: 'application/json', body: JSON.stringify(out.body) });
    }
    return route.abort(); // fonts, analytics, CDNs — not part of this test
  });
  ctx.on('page', (p) => {
    p.on('pageerror', (e) => pageErrors.push(`${label}: ${String(e.message).slice(0, 160)}`));
    p.on('crash', () => pageErrors.push(`${label}: the page crashed`));
  });
  return ctx;
}
// Contexts are never closed mid-run: with --single-process (the sandboxed
// Chromium) closing one context ends the whole browser.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000, step = 150) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(step);
  }
}
const fieldsOf = (i) => db.attempts[i]?.fields ?? {};
const lastFields = () => fieldsOf(db.attempts.length - 1);

/** Answer the next `n` unanswered auto-graded items of a homework correctly. */
const answerNext = (page, root, n) => page.evaluate(([root, n]) => {
  let done = 0;
  for (const q of document.querySelectorAll(`${root} .g-item`)) {
    if (done >= n) break;
    const key = q.getAttribute('data-answer');
    const sel = q.querySelector('select');
    const inp = q.querySelector('input');
    if (sel) {
      if (sel.value !== '') continue;
      sel.value = key; sel.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (inp) {
      if (inp.value !== '') continue;
      inp.value = key.split('|')[0]; inp.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      if (q.querySelector('.opt.picked')) continue;
      const b = [...q.querySelectorAll('.opt')].find((o) => o.getAttribute('data-val') === key);
      if (!b) continue;
      b.click();
    }
    done += 1;
  }
  return done;
}, [root, n]);
const typeName = (page, root, name) => page.evaluate(([root, name]) => {
  const inp = [...document.querySelectorAll(`${root} .meta input`)].find((i) => !(i.getAttribute('aria-label') || '').toLowerCase().includes('date'));
  inp.value = name; inp.dispatchEvent(new Event('input', { bubbles: true }));
}, [root, name]);
const scoreLine = (page, root) => page.evaluate((root) => (document.querySelector(`${root} .score-line`).textContent || '').trim(), root);
const pressCheck = (page, root) => page.evaluate((root) => document.querySelector(`${root} [data-action="check"]`).click(), root);
async function submit(page) {
  const before = db.attempts.length;
  await page.evaluate(() => document.getElementById('submitBtn').click());
  return until(async () => db.attempts.length > before, 8000);
}
async function openHomework(ctx, origin, file) {
  const page = await ctx.newPage();
  await page.goto(`${origin}/rfc3/${file}#hw-a`, { waitUntil: 'domcontentloaded' });
  // the share gate reads its doc, then shows Homework 1
  await until(() => page.evaluate(() => { const a = document.getElementById('hw-a'); return !!a && !a.hidden && document.body.dataset.mode === 'a' && !document.getElementById('hwGate'); }));
  await sleep(300);
  return page;
}

// ── 1. student on unit13hw.html (engine with a global grade()) ──────────
const daraCtx = await makeContext('student-1');
let dara = await openHomework(daraCtx, ORIGIN(1), 'unit13hw.html');
await typeName(dara, '#hw-a', 'Sok Dara');
ok('student 1: five items answered', (await answerNext(dara, '#hw-a', 5)) === 5);
await pressCheck(dara, '#hw-a');
ok('student 1: first check scores 5 / 30', (await scoreLine(dara, '#hw-a')) === '5 / 30 points', await scoreLine(dara, '#hw-a'));
ok('student 1: the page shows the right answers after a check', await dara.evaluate(() => [...document.querySelectorAll('#hw-a .g-item .fb')].some((f) => /✘ Answer: \S/.test(f.textContent || ''))));
ok('student 1: ten more items answered', (await answerNext(dara, '#hw-a', 10)) === 10);
ok('student 1: the open result panel still says 5 / 30 (not checked again)', (await scoreLine(dara, '#hw-a')) === '5 / 30 points');
ok('student 1: Submit stores a row', await submit(dara));
{
  const f = lastFields();
  ok('student 1: the stored score is the paper as handed in — 15 / 30', int(f.correctCount) === 15 && int(f.totalCount) === 30 && int(f.scorePct) === 50, `${int(f.correctCount)}/${int(f.totalCount)} ${int(f.scorePct)}%`);
  ok('student 1: the row names the homework', str(f.drillSlug) === 'unit13hw.html' && str(f.drillTitle) === `${U13}Homework 1 · Field Notebook` && str(f.drillSource) === 'rfc3', str(f.drillTitle));
  ok('student 1: the row carries the first check — 5 right, 5 answered, 1 check', int(f.firstCorrectCount) === 5 && int(f.firstAnsweredCount) === 5 && int(f.checkCount) === 1, JSON.stringify({ first: f.firstCorrectCount, answered: f.firstAnsweredCount, checks: f.checkCount }));
  ok('student 1: guest row — no account, no class', str(f.studentUid) === '' && 'nullValue' in (f.classId || {}));
}

// ── 2. reload: the corrected paper is not a new first try ───────────────
await dara.goto("about:blank");
dara = await openHomework(daraCtx, ORIGIN(1), 'unit13hw.html');
await typeName(dara, '#hw-a', 'sok  dara'); // other capitals and spacing — same student
await answerNext(dara, '#hw-a', 22);
await pressCheck(dara, '#hw-a');
ok('student 1 after reload: check scores 22 / 30', (await scoreLine(dara, '#hw-a')) === '22 / 30 points', await scoreLine(dara, '#hw-a'));
ok('student 1 after reload: second Submit stores a row', await submit(dara));
{
  const f = lastFields();
  ok('student 1 after reload: score 22 / 30, first check still 5, two checks', int(f.correctCount) === 22 && int(f.firstCorrectCount) === 5 && int(f.checkCount) === 2, JSON.stringify({ c: f.correctCount, first: f.firstCorrectCount, checks: f.checkCount }));
}
// Homework 2 of the same page keeps its own record.
ok('student 1: no first-try record leaked to Homework 2', await dara.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('cmc-hw-first:')).every((k) => k.startsWith('cmc-hw-first:unit13hw.html:a:'))));
await dara.goto("about:blank");

// ── 3. the other engine (IIFE pages): submit without any check ──────────
const linaCtx = await makeContext('student-2');
const lina = await openHomework(linaCtx, ORIGIN(2), 'unit4hw.html');
await typeName(lina, '#hw-a', 'Lina Meas');
await answerNext(lina, '#hw-a', 8);
ok('student 2 (unit 4): Submit without a check stores a row', await submit(lina));
{
  const f = lastFields();
  ok('student 2 (unit 4): 8 / 30, first check = the submission, 1 check', str(f.drillSlug) === 'unit4hw.html' && int(f.correctCount) === 8 && int(f.totalCount) === 30 && int(f.firstCorrectCount) === 8 && int(f.checkCount) === 1, JSON.stringify({ c: f.correctCount, t: f.totalCount, first: f.firstCorrectCount, checks: f.checkCount }));
}
await answerNext(lina, '#hw-a', 4);
await pressCheck(lina, '#hw-a');
await answerNext(lina, '#hw-a', 3);
ok('student 2 (unit 4): second Submit stores a row', await submit(lina));
{
  const f = lastFields();
  ok('student 2 (unit 4): fixed after the check and not checked again → 15 / 30, first check still 8, 2 checks', int(f.correctCount) === 15 && int(f.firstCorrectCount) === 8 && int(f.checkCount) === 2, JSON.stringify({ c: f.correctCount, first: f.firstCorrectCount, checks: f.checkCount }));
}
await lina.close();

// ── rows from before this change, other homeworks, other pages ──────────
seed(row('unit13hw.html', `${U13}Homework 1 · Field Notebook`, 'Chan Thy', 12, 30), 5 * DAY);        // no first-check fields
seed(row('unit13hw.html', `${U13}Homework 1 · Field Notebook`, 'Old Term', 27, 30), 40 * DAY);       // older than 30 days
seed(row('unit13hw.html', `${U13}Homework 2 · Relocation Mission`, 'Sok Dara', 20, 25), 2 * DAY);    // another homework
seed(row('unit15hw.html', 'Unit 15 · DNA Bank — Homework 1 · Lab Induction', 'Other Page', 30, 30), DAY); // another page
seed({ ...row('unit13hw.html', 'New Homes for Animals', 'No Number', 9, 30) }, 60 * DAY);            // title without a homework number
seed({ ...row('unit13hw.html', `${U13}Homework 1 · Field Notebook`, 'Game Row', 30, 30), drillSource: { stringValue: 'learning-games' } }, DAY); // not a homework row

// ── 4. teacher: Kid Program card → Scores ───────────────────────────────
const teacherCtx = await makeContext('teacher');
await teacherCtx.addInitScript(([token]) => {
  try {
    localStorage.setItem('cmc-student-token', token);
    localStorage.setItem('cmc-student-token-expires', String(Date.now() + 3600e3));
    localStorage.setItem('cmc-student-role', 'teacher');
    localStorage.setItem('cmc-student-email', 'bora@school.edu.kh');
    localStorage.setItem('cmc-student-name', 'Bora');
    localStorage.setItem('cmc-student-uid', 'teacher-1');
  } catch (e) { /* storage blocked */ }
}, [jwt(TEACHER)]);
const home = await teacherCtx.newPage();
// The Kid Program is a page of its own (src/lib/sitePages.ts): /#kid-grades.
await home.goto(`${ORIGIN(0)}/index.html#kid-grades`, { waitUntil: 'domcontentloaded' });
const toKidSection = (page) => until(() => page.evaluate(() => {
  const s = document.getElementById('kid-grades');
  if (!s) return false;
  s.scrollIntoView();
  return !!document.querySelector('#kid-grades article');
}), 20000);
ok('teacher: the Kid Program section loads', await toKidSection(home));
const HW1 = '[data-hw-scores="kid-11-homework-u13-hw1"]';
ok('teacher: the shared Unit 13 · Homework 1 row has a Scores button', await until(() => home.evaluate((s) => !!document.querySelector(s), HW1)));
const buttonCount = await home.evaluate(() => document.querySelectorAll('[data-hw-scores]').length);
const rowCount = await home.evaluate(() => document.querySelectorAll('#kid-grades .group\\/hw').length);
ok('teacher: every homework row shown has its Scores button', buttonCount > 0 && buttonCount === rowCount, `${buttonCount} buttons / ${rowCount} rows`);
await home.locator(HW1).click(); // a real click — the button takes the focus
const sheet = '[data-kid-hw-scores]';
ok('teacher: the score sheet opens', await until(() => home.evaluate((s) => !!document.querySelector(`${s} [role="dialog"]`), sheet)));
ok('teacher: the sheet names the homework', ((await home.evaluate((s) => document.querySelector(`${s} h2`)?.textContent, sheet)) || '').includes('Unit 13 · Homework 1 — Field Notebook'));
await until(() => home.evaluate((s) => document.querySelectorAll(`${s} [data-score-row]`).length > 0, sheet));

const readRows = () => home.evaluate((s) => [...document.querySelectorAll(`${s} [data-score-row]`)].map((tr) => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  return { name: txt(tr.querySelector('th')), first: txt(tr.querySelector('[data-first-try]')), best: txt(tr.querySelector('[data-best]')), times: txt(tr.children[4]) };
}), sheet);
let rows = await readRows();
ok('teacher: one line per student of THIS homework, by name', rows.map((r) => r.name).join(' | ') === 'Chan Thy | Old Term | Sok Dara', rows.map((r) => r.name).join(' | '));
{
  const d = rows.find((r) => r.name === 'Sok Dara');
  ok('teacher: Sok Dara — first try 17% 5/30', !!d && d.first.startsWith('17% 5/30'), d?.first);
  ok('teacher: Sok Dara — best score 73% 22/30', !!d && d.best === '73% 22/30', d?.best);
  ok('teacher: Sok Dara — handed in 2 times (two spellings, one student)', !!d && d.times === '2 times', d?.times);
  ok('teacher: Sok Dara — "only 5 of 30 answered when first checked"', !!d && d.first.includes('only 5 of 30 answered when first checked'), d?.first);
  ok('teacher: Sok Dara — the first try is a measured one (no *)', !!d && !d.first.includes('*'), d?.first);
  const c = rows.find((r) => r.name === 'Chan Thy');
  ok('teacher: Chan Thy (old row) — 40% 12/30, marked * as a first submission', !!c && c.first.startsWith('40% 12/30*') && c.best === '40% 12/30' && c.times === 'once', JSON.stringify(c));
}
{
  const s = await home.evaluate((s) => ({
    students: document.querySelector(`${s} [data-summary-students]`)?.textContent,
    first: document.querySelector(`${s} [data-summary-first]`)?.textContent,
    best: document.querySelector(`${s} [data-summary-best]`)?.textContent,
    notes: document.querySelector(`${s} [role="dialog"]`)?.textContent || '',
  }), sheet);
  // first tries 40, 90, 17 → 49 · best 40, 90, 73 → 68
  ok('teacher: summary — 3 students, average first try 49%, average best 68%', /^3\s*students$/.test((s.students || '').trim()) && s.first === '49%' && s.best === '68%', `${s.students} · ${s.first} · ${s.best}`);
  ok('teacher: the sheet explains First try and the * mark', s.notes.includes('before the page showed the right answers') && s.notes.includes('* Handed in before'));
  ok('teacher: the row without a homework number is counted, not mixed in', s.notes.includes('1 older submission from this page does not say which homework'));
}
if (SHOTS) await home.screenshot({ path: join(SHOTS, 'kidhw-sheet-dark.png'), animations: 'disabled' });

await home.selectOption(`${sheet} select[aria-label="Order of the students"]`, 'lowest');
rows = await readRows();
ok('teacher: "Lowest first try first" puts the weakest first', rows.map((r) => r.name).join(' | ') === 'Sok Dara | Chan Thy | Old Term', rows.map((r) => r.name).join(' | '));
await home.selectOption(`${sheet} select[aria-label="Which submissions to show"]`, '30');
rows = await readRows();
ok('teacher: "Last 30 days" leaves out the 40-day-old row', rows.map((r) => r.name).join(' | ') === 'Sok Dara | Chan Thy', rows.map((r) => r.name).join(' | '));
await home.selectOption(`${sheet} select[aria-label="Which submissions to show"]`, 'all');
await home.selectOption(`${sheet} select[aria-label="Order of the students"]`, 'name');

// download
{
  let csv = null;
  try {
    const [download] = await Promise.all([
      home.waitForEvent('download', { timeout: 8000 }),
      home.evaluate((s) => [...document.querySelectorAll(`${s} button`)].find((b) => (b.textContent || '').includes('Download')).click(), sheet),
    ]);
    const path = await download.path();
    csv = path ? await readFile(path, 'utf8') : null;
    ok('teacher: the download is named after the homework', /^scores-unit-13-homework-1-field-notebook\.csv$/.test(download.suggestedFilename()), download.suggestedFilename());
  } catch (e) {
    ok('teacher: Download produces a file', false, String(e.message).slice(0, 120));
  }
  if (csv !== null) {
    const lines = csv.replace(/^\uFEFF/, '').trim().split('\r\n');
    ok('teacher: the file has a header and one line per student', lines.length === 5 && lines[1].startsWith('Student,First try,First try %') && lines.some((l) => l.startsWith('Sok Dara,5,17,at first check,5,22,73,30,')), lines.slice(1).join(' ⏎ '));
  }
}

// ── 5. a new submission arrives while the sheet is open ─────────────────
const listsBefore = db.listReads;
seed({ ...row('unit13hw.html', `${U13}Homework 1 · Field Notebook`, 'Late Student', 30, 30), firstCorrectCount: { integerValue: '24' }, firstAnsweredCount: { integerValue: '30' }, checkCount: { integerValue: '2' } }, 0);
const arrived = await until(async () => (await readRows()).some((r) => r.name === 'Late Student'), 32000, 500);
ok('teacher: the new submission appears by itself (no Refresh)', !!arrived);
{
  const l = (await readRows()).find((r) => r.name === 'Late Student');
  ok('teacher: Late Student — first try 80% 24/30, checked 2 times, best 100% 30/30', !!l && l.first.startsWith('80% 24/30') && l.first.includes('checked 2 times') && !l.first.includes('only') && l.best === '100% 30/30', JSON.stringify(l));
}
ok('teacher: watching costs count reads; the list is downloaded again only when something changed', db.countReads >= 2 && db.listReads - listsBefore === 1, `${db.countReads} counts, ${db.listReads - listsBefore} list read(s) for the new row`);

if (SHOTS) {
  await home.evaluate(() => { document.documentElement.classList.add('light'); });
  await sleep(200);
  await home.screenshot({ path: join(SHOTS, 'kidhw-sheet-light.png'), animations: 'disabled' });
  await home.evaluate(() => { document.documentElement.classList.remove('light'); });
}

await home.keyboard.press('Escape');
ok('teacher: Esc closes the sheet', await until(() => home.evaluate((s) => !document.querySelector(s), sheet), 4000));
ok('teacher: focus returns to the Scores button', await home.evaluate((s) => document.activeElement === document.querySelector(s), HW1));

// a homework nobody handed in yet
await home.evaluate(() => {
  const more = [...document.querySelectorAll('#kid-grades button')].find((b) => /More homeworks/.test(b.textContent || ''));
  if (more) more.click();
});
const HW3 = '[data-hw-scores="kid-11-homework-u13-hw3"]';
if (await until(() => home.evaluate((s) => !!document.querySelector(s), HW3), 4000)) {
  await home.evaluate((s) => document.querySelector(s).click(), HW3);
  const empty = await until(() => home.evaluate((s) => document.querySelector(`${s} [data-score-empty]`)?.textContent || '', sheet), 6000);
  ok('teacher: a homework nobody handed in says so', !!empty && empty.includes('No one has handed in this homework yet'), empty || '');
  if (SHOTS) await home.screenshot({ path: join(SHOTS, 'kidhw-sheet-empty.png'), animations: 'disabled' });
  await home.keyboard.press('Escape');
} else {
  ok('teacher: the Unit 13 · Homework 3 row is reachable behind "More homeworks"', false);
}
if (SHOTS) {
  await home.evaluate(() => document.querySelector('[data-hw-scores="kid-11-homework-u13-hw1"]').scrollIntoView({ block: 'center' }));
  await sleep(300);
  await home.screenshot({ path: join(SHOTS, 'kidhw-card-dark.png'), animations: 'disabled' });
  await home.evaluate(() => { document.documentElement.classList.add('light'); });
  await sleep(300);
  await home.screenshot({ path: join(SHOTS, 'kidhw-card-light.png'), animations: 'disabled' });
}
await home.close();

// ── 6. a student on the homepage: no Scores button ──────────────────────
const visitorCtx = await makeContext('visitor');
const visitor = await visitorCtx.newPage();
await visitor.goto(`${ORIGIN(3)}/index.html#kid-grades`, { waitUntil: 'domcontentloaded' });
ok('student: the Kid Program section loads', await toKidSection(visitor));
ok('student: the shared homework row is there', await until(() => visitor.evaluate(() => !!document.querySelector('#kid-grades a[href*="unit13hw.html#hw-a"]'))));
ok('student: no Scores button anywhere', (await visitor.evaluate(() => document.querySelectorAll('[data-hw-scores]').length)) === 0);
await visitor.close();

ok('the database refused nothing', violations.length === 0, violations.join('; '));
ok('no page errors', pageErrors.length === 0, pageErrors.join('; '));

await browser.close();
servers.forEach((s) => s.close());
console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed} passed, ${failed} failed (served: ${DIST})`);
process.exit(failed ? 1 : 0);
