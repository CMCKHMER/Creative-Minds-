// Bi-weekly tests — "what the teacher sees is what the student did".
//
// Reported by the owner: a test was shared from the planner, a student
// answered every question, and the teacher's live results showed a row
// with 9 questions and 4 correct. The planner's Results tab was reading
// the PUBLIC drill_attempts feed, which stopped receiving invite attempts
// on 9 Nov 2026 (they go to the private invite_attempts collection). It
// therefore showed only results from before that date — when the
// Orientation Diagnostic still had 9 questions — and never the new one.
//
// This verifier plays the whole flow in a headless browser against an
// in-memory Firestore that is shaped after FIRESTORE and enforces the
// relevant blocks of firestore.rules (teachers, invite_codes,
// invite_attempts, drill_attempts' inviteMode guard, teacher_secrets):
//
//   1. the teacher opens the planner hub and shares a test — the window
//      states the real question count, and the invite code is registered
//      to the teacher before the link can be copied;
//   2. a student opens the link, answers EVERY question (a known number
//      right) and submits;
//   3. the teacher's Results tab shows that attempt, scored against the
//      test's own key: right count, real total;
//   4. a result recorded for an earlier version of the test (4/9) is listed
//      apart, labelled, and not mistaken for the current test;
//   5. without the installed answer key the row says "Not scored yet"
//      instead of a wrong number.
//
//   node scripts/verify_biweek_results.mjs
//   BIWEEK_DIST=public        serve another folder (default ../dist)
//   SEAL_KEY_FILE=/path       the school's answer-seal code (never committed;
//                             default .secrets/answer-seal.private.json).
//                             Without it the scored checks are skipped.
//   PW_CHROMIUM=/path         use this Chromium binary (with playwright-core)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import('playwright').catch(() => import('playwright-core'));

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DIST = resolve(process.env.BIWEEK_DIST || join(ROOT, 'dist'));
const KEY_FILE = resolve(process.env.SEAL_KEY_FILE || join(ROOT, '.secrets/answer-seal.private.json'));
const HAS_KEY = existsSync(KEY_FILE);
// BIWEEK_NO_COUNT=1: the database refuses count queries — the feed must still update (slower).
const NO_COUNT = process.env.BIWEEK_NO_COUNT === '1';
const SEAL_CODE = HAS_KEY ? (() => {
  const text = readFileSync(KEY_FILE, 'utf8').trim();
  try { return JSON.parse(text).key; } catch { return text; }
})() : null;

// One ORIGIN per person: some headless Chromium builds share localStorage
// across browser contexts, and teacher and student need separate sessions.
const PORT = 8970;
const ORIGIN = (n) => `http://127.0.0.1:${PORT + n}`;
const servers = [];
for (let n = 0; n < 6; n++) { // teacher + up to five students
  const server = createServer(async (req, res) => {
    try {
      const file = normalize(decodeURIComponent(new URL(req.url, ORIGIN(0)).pathname));
      const data = await readFile(join(DIST, file.endsWith('/') ? file + 'index.html' : file));
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(PORT + n, '127.0.0.1', r));
  servers.push(server);
}

// ── strict in-memory Firestore (REST) ───────────────────────────────────
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (claims) => `${b64u({ alg: 'none' })}.${b64u(claims)}.sig`;
const claimsOf = (header) => {
  const m = /^Bearer\s+(.+)$/.exec(header || '');
  if (!m) return null;
  try { return JSON.parse(Buffer.from(m[1].split('.')[1], 'base64url').toString('utf8')); } catch { return null; }
};
const TEACHER = { user_id: 'teacher-1', email: 'bora@school.edu.kh', email_verified: true };
const OTHER_TEACHER_UID = 'teacher-2';

const db = {
  teachers: new Set(),
  inviteCodes: new Map([['TAKEN-CODE', OTHER_TEACHER_UID]]),
  inviteAttempts: [],
  drillAttempts: [],
  sealCode: SEAL_CODE,
  // how the dashboard reads the teacher's invite attempts: whole list vs. count
  reads: { inviteLists: 0, inviteCounts: 0 },
};
const violations = [];
const refuse = (what) => { violations.push(what); return { code: 403, body: { error: { code: 403, status: 'PERMISSION_DENIED', message: 'Missing or insufficient permissions.' } } }; };
const refuseQuietly = () => ({ code: 403, body: { error: { code: 403, status: 'PERMISSION_DENIED', message: 'Missing or insufficient permissions.' } } });
const notFound = (name) => ({ code: 404, body: { error: { code: 404, status: 'NOT_FOUND', message: `Document "${name}" not found.` } } });
const exists = (name) => ({ code: 409, body: { error: { code: 409, status: 'ALREADY_EXISTS', message: `Document already exists: ${name}` } } });

const isCmcTeacher = (a) => !!a && a.email_verified === true && typeof a.email === 'string' && /@[^@]*edu[^@]*$/i.test(a.email);
const isVerifiedTeacher = (a) => isCmcTeacher(a) && db.teachers.has(a.user_id);
const val = (f) => {
  if (!f) return undefined;
  if ('stringValue' in f) return f.stringValue;
  if ('integerValue' in f) return Number(f.integerValue);
  if ('booleanValue' in f) return f.booleanValue;
  if ('nullValue' in f) return null;
  if ('timestampValue' in f) return f.timestampValue;
  return f;
};
const isInt = (f) => !!f && 'integerValue' in f;
const isStr = (f) => !!f && 'stringValue' in f;
const DOCS = 'projects/creative-minds-cambodia/databases/(default)/documents';

function firestore(method, url, auth, body) {
  const u = new URL(url);
  const path = decodeURIComponent(u.pathname).split('/documents')[1] || '';
  const documentId = u.searchParams.get('documentId');

  if (path === ':runAggregationQuery' && method === 'POST') {
    // COUNT query: allowed exactly where the list query is allowed.
    const q = (body.structuredAggregationQuery || {}).structuredQuery || {};
    const coll = q.from && q.from[0] && q.from[0].collectionId;
    const ff = q.where && q.where.fieldFilter;
    const aggs = (body.structuredAggregationQuery || {}).aggregations || [];
    if (coll === 'drill_attempts' && aggs.length === 1 && aggs[0].count) { // public feed (site counters): anyone may count it
      return { code: 200, body: [{ result: { aggregateFields: { [aggs[0].alias]: { integerValue: String(db.drillAttempts.length) } } }, readTime: new Date().toISOString() }] };
    }
    if (coll !== 'invite_attempts' || !ff || ff.field.fieldPath !== 'teacherUid' || aggs.length !== 1 || !aggs[0].count) return refuse(`aggregation query on ${coll}`);
    if (!isVerifiedTeacher(auth) || val(ff.value) !== auth.user_id) return refuseQuietly();
    if (NO_COUNT) return refuseQuietly(); // rehearse a database that will not answer count queries
    db.reads.inviteCounts += 1;
    const n = db.inviteAttempts.filter((d) => val(d.fields.teacherUid) === auth.user_id).length;
    return { code: 200, body: [{ result: { aggregateFields: { [aggs[0].alias]: { integerValue: String(n) } } }, readTime: new Date().toISOString() }] };
  }

  if (path === ':runQuery' && method === 'POST') {
    const q = body.structuredQuery || {};
    const coll = q.from && q.from[0] && q.from[0].collectionId;
    const filters = !q.where ? [] : q.where.fieldFilter ? [q.where.fieldFilter] : (q.where.compositeFilter.filters || []).map((f) => f.fieldFilter);
    const want = Object.fromEntries(filters.map((f) => [f.field.fieldPath, val(f.value)]));
    let rows;
    if (coll === 'invite_attempts') {
      // Owner-only read: the query itself must be limited to the caller.
      if (!isVerifiedTeacher(auth) || want.teacherUid !== auth.user_id) return refuseQuietly();
      if (Object.keys(want).length === 1) db.reads.inviteLists += 1; // every attempt of the teacher (dashboard)
      rows = db.inviteAttempts;
    } else if (coll === 'drill_attempts') {
      rows = db.drillAttempts;
    } else return refuse(`runQuery on ${coll}`);
    const hits = rows.filter((d) => Object.keys(want).every((k) => val(d.fields[k]) === want[k])).slice(0, q.limit || 1000);
    const readTime = new Date().toISOString();
    return { code: 200, body: hits.length ? hits.map((d) => ({ document: d, readTime })) : [{ readTime }] };
  }

  const seg = path.split('/').filter(Boolean);
  if (seg[0] === 'teachers') {
    if (method === 'GET' && seg[1]) return !auth ? refuseQuietly() : db.teachers.has(seg[1]) ? { code: 200, body: { name: `${DOCS}/teachers/${seg[1]}`, fields: {} } } : notFound(`teachers/${seg[1]}`);
    if (method === 'POST' && !seg[1]) {
      if (!auth || auth.user_id !== documentId || !isCmcTeacher(auth)) return refuseQuietly();
      if (db.teachers.has(documentId)) return exists(`teachers/${documentId}`);
      db.teachers.add(documentId);
      return { code: 200, body: { name: `${DOCS}/teachers/${documentId}`, fields: body.fields } };
    }
  }
  if (seg[0] === 'invite_codes') {
    if (method === 'GET' && seg[1]) {
      return db.inviteCodes.has(seg[1])
        ? { code: 200, body: { name: `${DOCS}/invite_codes/${seg[1]}`, fields: { teacherUid: { stringValue: db.inviteCodes.get(seg[1]) } } } }
        : notFound(`invite_codes/${seg[1]}`);
    }
    if (method === 'POST' && !seg[1]) {
      const f = body.fields || {};
      if (!isVerifiedTeacher(auth) || val(f.teacherUid) !== auth.user_id || !documentId || documentId.length < 8 || documentId.length > 32) return refuseQuietly();
      if (db.inviteCodes.has(documentId)) return exists(`invite_codes/${documentId}`);
      db.inviteCodes.set(documentId, auth.user_id);
      return { code: 200, body: { name: `${DOCS}/invite_codes/${documentId}`, fields: f } };
    }
    if (method === 'POST' && seg[1]) return { code: 400, body: { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'Document parent name lacks "/" at index.' } } };
  }
  if (seg[0] === 'invite_attempts' && method === 'POST' && !seg[1]) {
    const f = body.fields || {};
    const code = val(f.inviteCode);
    const okShape = !!auth
      && isStr(f.teacherUid) && val(f.teacherUid).length > 0
      && isStr(f.inviteCode) && code.length >= 3 && code.length <= 32
      && db.inviteCodes.get(code) === val(f.teacherUid)
      && isStr(f.studentName) && val(f.studentName).length >= 1 && val(f.studentName).length <= 60
      && isStr(f.studentCode) && val(f.studentCode).length <= 24
      && isStr(f.drillSlug) && val(f.drillSlug).length >= 1 && val(f.drillSlug).length <= 80
      && isStr(f.drillTitle) && val(f.drillTitle).length >= 1 && val(f.drillTitle).length <= 120
      && isInt(f.scorePct) && val(f.scorePct) >= 0 && val(f.scorePct) <= 100
      && isInt(f.correctCount) && val(f.correctCount) >= 0 && val(f.correctCount) <= 10000
      && isInt(f.totalCount) && val(f.totalCount) >= 0 && val(f.totalCount) <= 10000
      && (!('classId' in f) || val(f.classId) === null)
      && (!('sealed' in f) || 'booleanValue' in f.sealed)
      && (!('sheet' in f) || (isStr(f.sheet) && val(f.sheet).length <= 20000));
    if (!okShape) return refuse(`invite_attempts create refused (code ${code})`);
    const name = `${DOCS}/invite_attempts/a${db.inviteAttempts.length + 1}`;
    db.inviteAttempts.push({ name, fields: f });
    return { code: 200, body: { name, fields: f } };
  }
  if (seg[0] === 'drill_attempts' && method === 'POST' && !seg[1]) {
    const f = body.fields || {};
    if ('inviteMode' in f && val(f.inviteMode) !== false) return refuse('an invite attempt was posted to the public drill_attempts feed');
    const name = `${DOCS}/drill_attempts/d${db.drillAttempts.length + 1}`;
    db.drillAttempts.push({ name, fields: f });
    return { code: 200, body: { name, fields: f } };
  }
  if (seg[0] === 'teacher_secrets' && seg[1] === 'answer-seal' && method === 'GET') {
    if (!isVerifiedTeacher(auth)) return refuseQuietly();
    return db.sealCode
      ? { code: 200, body: { name: `${DOCS}/teacher_secrets/answer-seal`, fields: { key: { stringValue: db.sealCode } } } }
      : notFound('teacher_secrets/answer-seal');
  }
  // Other features of these pages (class lists, analytics) are not part of
  // this test: refused, but not counted against it.
  return refuseQuietly();
}

// ── browser ─────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true, ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM, args: ['--no-sandbox', '--disable-gpu', '--single-process', '--no-zygote'] } : {}) });
const results = [];
const ok = (name, cond, detail) => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
const skip = (name, why) => results.push(`SKIP  ${name} — ${why}`);
const pageErrors = [];
let students = 0;

async function makeContext(label) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/*', async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.startsWith('http://127.0.0.1:')) return route.continue();
    if (url.includes('firestore.googleapis.com')) {
      let body = {};
      try { body = JSON.parse(req.postData() || '{}'); } catch { /* GET */ }
      const out = firestore(req.method(), url, claimsOf(req.headers().authorization), body);
      return route.fulfill({ status: out.code, contentType: 'application/json', body: JSON.stringify(out.body) });
    }
    if (url.includes('identitytoolkit.googleapis.com') && url.includes('accounts:signUp')) {
      const body = JSON.parse(req.postData() || '{}');
      const uid = `student-${++students}`;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        idToken: jwt({ user_id: uid, email: body.email, email_verified: false }), localId: uid, refreshToken: `rt-${uid}`, expiresIn: '3600' }) });
    }
    return route.abort(); // fonts, analytics, CDNs — not part of this test
  });
  ctx.on('page', (p) => p.on('pageerror', (e) => pageErrors.push(`${label}: ${String(e.message).slice(0, 160)}`)));
  return ctx;
}
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

const counts = JSON.parse(await readFile(join(DIST, 'biweek-planner/test-counts.json'), 'utf8')).tests;
const sealedKey = (slug) => JSON.parse(execFileSync('node', [join(HERE, 'seal_tests.mjs'), '--open', slug, KEY_FILE], { encoding: 'utf8' }));

// ── teacher ─────────────────────────────────────────────────────────────
const teacherCtx = await makeContext('teacher');
await teacherCtx.addInitScript(([token]) => {
  try {
    localStorage.setItem('cmc-student-token', token);
    localStorage.setItem('cmc-student-token-expires', String(Date.now() + 3600e3));
    localStorage.setItem('cmc-student-role', 'teacher');
    localStorage.setItem('cmc-student-email', 'bora@school.edu.kh');
    localStorage.setItem('cmc-student-name', 'Bora');
  } catch (e) { /* storage blocked */ }
}, [jwt(TEACHER)]);
const hub = await teacherCtx.newPage();
await hub.goto(`${ORIGIN(0)}/biweek-planner/index.html`, { waitUntil: 'domcontentloaded' });
await until(() => hub.evaluate(() => document.querySelectorAll('.bp-share').length > 10));

async function openShare(file) {
  await hub.evaluate(() => { const m = document.getElementById('bp-share-modal'); if (m && !m.hidden) document.getElementById('bp-modal-x').click(); });
  await hub.evaluate((f) => document.querySelector(`.bp-share[data-file="${f}"]`).click(), file);
}
const hint = () => hub.evaluate(() => document.getElementById('bp-code-hint').textContent);
const copyOff = () => hub.evaluate(() => document.getElementById('bp-copy').disabled);
async function typeCode(code) {
  await hub.evaluate((c) => { const i = document.getElementById('bp-code'); i.value = c; i.dispatchEvent(new Event('input', { bubbles: true })); }, code);
}

// 1. the share window states the real question count
await openShare('diagnostic.html');
const diag = counts.diagnostic;
const countText = await until(() => hub.evaluate(() => document.getElementById('bp-modal-count').textContent));
ok('share window states the Diagnostic\'s real question count', !!countText && countText.startsWith(`${diag.total} questions`), countText || 'no count shown');
ok('…and the parts add up to it', diag.parts.reduce((n, p) => n + p.total, 0) === diag.total && diag.parts.every((p) => (countText || '').includes(` ${p.total}`)), countText || '');
const tip = await hub.evaluate(() => document.querySelector('.bp-share[data-file="structure.html"]').closest('.bp-test-row').querySelector('a').title);
ok('every test button says how many questions it has', tip.endsWith(`${counts.structure.total} questions`), tip);

// 2. the invite code is registered before the link can be used
const autoCode = await hub.evaluate(() => document.getElementById('bp-code').value);
await until(async () => (await hint()).startsWith('✓'));
ok('a new teacher code is registered to the teacher', db.inviteCodes.get(autoCode) === TEACHER.user_id && !(await copyOff()), `${autoCode} → ${db.inviteCodes.get(autoCode)}`);
ok('a teacher who never opened the dashboard is put on the teachers list', db.teachers.has(TEACHER.user_id));
await typeCode('BORA');
await sleep(300);
ok('a code the database would refuse (too short) cannot be shared', (await copyOff()) && /8 to 24/.test(await hint()), await hint());
await typeCode('TAKEN-CODE');
await until(async () => /Another teacher/.test(await hint()));
ok('a code that belongs to another teacher cannot be shared', (await copyOff()) && db.inviteCodes.get('TAKEN-CODE') === OTHER_TEACHER_UID, await hint());
await typeCode('BORA-2026');
await until(async () => (await hint()).startsWith('✓'));
ok('a typed code is registered too', db.inviteCodes.get('BORA-2026') === TEACHER.user_id && !(await copyOff()));
const link = await hub.evaluate(() => document.getElementById('bp-link').value);
ok('the student link carries the registered code', /tests\/diagnostic\.html\?invite=BORA-2026$/.test(link), link);

// ── student ─────────────────────────────────────────────────────────────
let studentNo = 0;
/** A student answers EVERY question of `slug`, `right` of them correctly. */
async function studentTakes(slug, name, right) {
  const origin = ORIGIN(1 + studentNo++);
  const ctx = await makeContext(`student ${name}`);
  const page = await ctx.newPage();
  await page.goto(`${origin}/biweek-planner/tests/${slug}.html?invite=BORA-2026`, { waitUntil: 'domcontentloaded' });
  await until(() => page.evaluate(() => !!document.getElementById('ci-start')));
  await page.fill('#ci-name', name);
  await page.fill('#ci-sid', 'CMC-0142');
  await page.check('#ci-honor');
  await page.click('#ci-start');
  await until(() => page.evaluate(() => !document.documentElement.classList.contains('cmc-invite-locked')));
  await sleep(500);
  const key = HAS_KEY ? sealedKey(slug) : null;
  const answered = await page.evaluate(({ key, right }) => {
    const norm = (a) => (Array.isArray(a) ? a.map(String).sort().join('|') : String(a));
    const cards = [...document.querySelectorAll('.question-card')];
    let n = 0;
    cards.forEach((card, i) => {
      const inputs = [...card.querySelectorAll('input')];
      const [bank, row] = (card.dataset.sid || ':').split(':');
      const want = key && key.banks[bank] ? norm(key.banks[bank][Number(row)]).split('|') : null;
      let pick;
      if (want && i < right) pick = inputs.filter((inp) => want.includes(inp.value));
      else if (want) pick = [inputs.find((inp) => !want.includes(inp.value))];
      else pick = [inputs[0]];
      pick.filter(Boolean).forEach((inp) => { inp.disabled = false; inp.checked = true; inp.dispatchEvent(new Event('change', { bubbles: true })); });
      if (card.querySelector('input:checked')) n += 1;
    });
    return { cards: cards.length, answered: n };
  }, { key, right });
  const before = db.inviteAttempts.length;
  await page.evaluate(() => window.doSubmit());
  await until(async () => db.inviteAttempts.length > before, 15000);
  return { ...answered, doc: db.inviteAttempts[db.inviteAttempts.length - 1], stored: db.inviteAttempts.length > before };
}

const RIGHT = 17;
const taken = await studentTakes('diagnostic', 'Sok Dara', RIGHT);
ok('the student sees exactly the stated number of questions', taken.cards === diag.total, `${taken.cards} cards, ${diag.total} stated`);
ok('the student answered every question', taken.answered === diag.total, `${taken.answered}/${taken.cards}`);
ok('the attempt is stored for the teacher who owns the code', taken.stored && val(taken.doc.fields.teacherUid) === TEACHER.user_id);
if (taken.stored) {
  const sheet = JSON.parse(val(taken.doc.fields.sheet) || '{}').a || {};
  ok('the stored answer sheet holds every answer', Object.keys(sheet).length === diag.total && val(taken.doc.fields.totalCount) === diag.total,
    `${Object.keys(sheet).length} answers, total ${val(taken.doc.fields.totalCount)}`);
  ok('the student\'s device did not grade (sealed test)', val(taken.doc.fields.sealed) === true && val(taken.doc.fields.correctCount) === 0);
}
ok('nothing went to the public score feed', db.drillAttempts.length === 0);

// A result from the time the Diagnostic had 9 questions (public feed, as it
// was recorded before 9 Nov 2026) — the row the owner was shown.
db.drillAttempts.push({ name: `${DOCS}/drill_attempts/old1`, fields: {
  drillSlug: { stringValue: 'diagnostic.html' }, drillTitle: { stringValue: 'Orientation Diagnostic' }, drillSource: { stringValue: 'biweek-planner' },
  studentName: { stringValue: 'Earlier Attempt' }, studentCode: { stringValue: 'T-1' }, inviteCode: { stringValue: 'TEACHER-OLD1' }, inviteMode: { booleanValue: true },
  scorePct: { integerValue: '44' }, correctCount: { integerValue: '4' }, totalCount: { integerValue: '9' }, durationSeconds: { integerValue: '300' },
  submittedAt: { timestampValue: '2026-11-08T17:00:00.000Z' }, answers: { stringValue: '1:A; 2:B' },
} });

// 3 + 4. the teacher's Results tab
const resultsText = async () => hub.evaluate(() => document.getElementById('bp-results-wrap').innerText);
const currentRows = () => hub.evaluate(() => {
  const tables = document.querySelectorAll('#bp-results-wrap table');
  const rows = (t) => (t ? [...t.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => td.innerText.trim())) : []);
  return { current: rows(document.querySelector('#bp-results-wrap > table')), older: rows(document.querySelector('#bp-results-wrap > div table')), tables: tables.length };
});
await hub.evaluate(() => document.getElementById('bp-tab-results').click());
await until(async () => (await resultsText()).includes('Sok Dara'));
let view = await currentRows();
const meta = await hub.evaluate(() => document.getElementById('bp-results-meta').textContent);
ok('Results states the test\'s question count', meta.startsWith(`This test has ${diag.total} questions.`), meta);
const mine = view.current.find((r) => r[0] === 'Sok Dara');
if (HAS_KEY) {
  const pct = Math.round((RIGHT / diag.total) * 100);
  ok('the new attempt is shown, scored against the test\'s own key', !!mine && mine[3].replace(/\s+/g, ' ') === `${pct}% (${RIGHT}/${diag.total})`, mine ? mine[3] : 'row missing');
} else {
  skip('the new attempt is scored against the test\'s own key', 'no SEAL_KEY_FILE');
  ok('the new attempt is shown', !!mine, mine ? mine[3] : 'row missing');
}
ok('the 9-question result is NOT listed as a result of the current test', !view.current.some((r) => r[0] === 'Earlier Attempt'));
const older = view.older.find((r) => r[0] === 'Earlier Attempt');
const text = await resultsText();
ok('…it is listed apart as an earlier version, with both counts named', !!older && /\(4\/9\)/.test(older[3]) && /Earlier version of this test/.test(text) && text.includes(`had 9 questions; it now has ${diag.total}`),
  older ? older[3] : 'row missing');

// A second test on the same week card: 25 questions stay 25.
if (HAS_KEY) {
  const st = counts.structure;
  const taken2 = await studentTakes('structure', 'Chan Vanna', 20);
  await openShare('structure.html');
  const c2 = await until(() => hub.evaluate(() => document.getElementById('bp-modal-count').textContent));
  await hub.evaluate(() => document.getElementById('bp-tab-results').click());
  await until(async () => (await resultsText()).includes('Chan Vanna'));
  view = await currentRows();
  const row = view.current.find((r) => r[0] === 'Chan Vanna');
  ok(`"${st.title}": stated ${st.total}, answered ${taken2.answered}, scored out of ${st.total}`,
    (c2 || '').startsWith(`${st.total} questions`) && taken2.cards === st.total && taken2.answered === st.total && !!row && row[3].replace(/\s+/g, ' ') === `${Math.round((20 / st.total) * 100)}% (20/${st.total})`,
    `${c2} | ${row ? row[3] : 'row missing'}`);
  ok('a test shows only its own results', !view.current.some((r) => r[0] === 'Sok Dara') && view.older.length === 0);
} else skip('second test (25 questions)', 'no SEAL_KEY_FILE');

// 4b. the dashboard on the main page: the "Bi-Weekly Test Scores" sheet and
// the share panel. Run only against a built site (the hub alone has no dashboard).
if (existsSync(join(DIST, 'assets'))) {
  // The teacher's browser still holds the sheet as it was saved before this
  // fix: six columns, and the old 9-question row with nothing to explain it.
  await hub.evaluate(() => {
    const when = '2026-11-08T17:00:00.000Z';
    const rows = [
      { cells: ['Student', 'Class', 'Score %', 'Correct', 'Total', 'Submitted'] },
      { cells: ['Earlier Attempt', '', '44', '4', '9', '8 Nov'], sig: JSON.stringify(['Earlier Attempt', 'diagnostic.html', when]) },
      { cells: ['', '', '', '', '', ''] },
    ];
    localStorage.setItem('cmc.liveSheet.v1.diagnostic.html', JSON.stringify({ v: 1, rows }));
  });
  const dash = await teacherCtx.newPage();
  // Live class results is a page of its own (src/lib/sitePages.ts): /#live-results.
  await dash.goto(`${ORIGIN(0)}/index.html#live-results`, { waitUntil: 'domcontentloaded' });
  const found = await until(async () => {
    await dash.evaluate(() => {
      const el = document.querySelector('.cmc-scores-card') || document.getElementById('firebase-dashboard');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
      else window.scrollBy({ top: 1400, behavior: 'instant' });
    });
    return dash.evaluate(() => !!document.querySelector('.cmc-scores-card table'));
  }, 60000, 400);
  ok('dashboard: the score sheet opens for the signed-in teacher', !!found);
  if (found) {
    const sheetOf = (title) => dash.evaluate((t) => {
      const card = document.querySelector('.cmc-scores-card');
      const tab = [...card.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
      if (!tab) return null;
      tab.click();
      return new Promise((done) => setTimeout(() => done(
        // header row (thead) first; the leading row-number column is dropped
        [...card.querySelectorAll('table tr')].map((tr) => [...tr.children].slice(1).map((td) => (td.querySelector('input') ? td.querySelector('input').value : td.innerText).trim())),
      ), 300));
    }, title);
    const NOTE = `Earlier version of this test (9 questions; it now has ${diag.total})`;
    const grid = await until(async () => {
      const g = await sheetOf(diag.title);
      return g && g.some((r) => r.includes('Sok Dara')) ? g : null;
    }, 20000, 500);
    const head = grid ? grid[0] : [];
    const col = (name) => head.indexOf(name);
    const rowOf = (g, name) => (g || []).find((r) => r.includes(name));
    const cells = (r, ...names) => (r ? names.map((n) => r[col(n)]) : []);
    ok('dashboard sheet: the result that came through the invite link is on the sheet', !!rowOf(grid, 'Sok Dara'), grid ? `${grid.length} rows` : 'the test has no tab');
    if (grid && HAS_KEY) {
      const got = cells(rowOf(grid, 'Sok Dara'), 'Score %', 'Correct', 'Total');
      ok('dashboard sheet: scored out of the real number of questions', got.join('/') === `${Math.round((RIGHT / diag.total) * 100)}/${RIGHT}/${diag.total}`, got.join(' / '));
    } else skip('dashboard sheet: scored out of the real number of questions', 'no SEAL_KEY_FILE');
    const old = rowOf(grid, 'Earlier Attempt');
    ok('dashboard sheet: the saved "4 of 9" row is now explained in a Note column', col('Note') >= 0 && !!old && cells(old, 'Correct', 'Total', 'Note').join('|') === `4|9|${NOTE}`,
      old ? cells(old, 'Correct', 'Total', 'Note').join(' | ') : 'row missing');
    ok('dashboard sheet: the new result is above the old one', !!grid && grid.findIndex((r) => r.includes('Sok Dara')) === 1 && grid.findIndex((r) => r.includes('Earlier Attempt')) > 1,
      grid ? grid.slice(1, 3).map((r) => r[col('Student')]).join(' > ') : '');

    // A student finishes while the teacher has the sheet open.
    if (HAS_KEY) {
      await studentTakes('diagnostic', 'Late Student', diag.total);
      await dash.evaluate(() => [...document.querySelectorAll('.cmc-scores-card button')].find((b) => b.textContent.trim() === 'Refresh').click());
      const g2 = await until(async () => {
        const g = await sheetOf(diag.title);
        return g && g.some((r) => r.includes('Late Student')) ? g : null;
      }, 20000, 500);
      ok('dashboard sheet: after Refresh a new result is the first row, 23 of 23', !!g2 && g2[1].includes('Late Student') && cells(g2[1], 'Correct', 'Total').join('/') === `${diag.total}/${diag.total}`,
        g2 ? g2.slice(1, 4).map((r) => `${r[col('Student')]} ${r[col('Correct')]}/${r[col('Total')]}`).join(' > ') : 'row missing');
    }

    // The "Attempt Feed · Live" under Live Class Results — the screen the
    // owner was watching. It must show what came through the share link.
    const feedRows = () => dash.evaluate(() => {
      const box = document.querySelector('[data-attempt-feed]');
      if (!box) return null;
      box.scrollIntoView({ behavior: 'instant', block: 'center' });
      return [...box.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td, i) => (i === 2 ? td.innerText.replace(/\s+/g, '') : td.innerText.replace(/\s+/g, ' ').trim())));
    });
    const showAll = () => dash.evaluate(() => {
      const b = [...document.querySelectorAll('[data-attempt-feed] button')].find((x) => /^Show all/.test(x.textContent.trim()));
      if (b) b.click();
    });
    const feed = await until(async () => {
      await showAll();
      const rows = await feedRows();
      return rows && rows.some((r) => r[0] === 'Sok Dara') ? rows : null;
    }, 20000, 500);
    const feedRow = (rows, name) => (rows || []).find((r) => r[0] === name);
    ok('dashboard feed: the test taken through the share link is in the Attempt Feed', !!feedRow(feed, 'Sok Dara'), feed ? `${feed.length} rows` : 'feed missing or empty');
    if (HAS_KEY) {
      const r = feedRow(feed, 'Sok Dara');
      ok('dashboard feed: it is scored out of the real number of questions', !!r && r[2] === `${Math.round((RIGHT / diag.total) * 100)}%(${RIGHT}/${diag.total})` && /Share link/i.test(r[1]),
        r ? `${r[1]} | ${r[2]}` : 'row missing');

      // Live: a student finishes while the teacher only watches — no click.
      const before = { ...db.reads };
      await studentTakes('diagnostic', 'Live Watcher', 12);
      const t0 = Date.now();
      const live = await until(async () => {
        const rows = await feedRows();
        return rows && rows[0] && rows[0][0] === 'Live Watcher' ? rows : null;
      }, NO_COUNT ? 90000 : 40000, 500);
      ok(`dashboard feed: a new result appears by itself, at the top${NO_COUNT ? ' (count queries refused: once-a-minute fallback)' : ''}`, !!live && live[0][2] === `${Math.round((12 / diag.total) * 100)}%(12/${diag.total})`,
        live ? `${live[0][0]} ${live[0][2]} after ${Math.round((Date.now() - t0) / 1000)} s` : 'did not appear in time');
      if (!NO_COUNT) {
        // Quota: while nothing changes the feed asks only for the COUNT.
        await sleep(1000);
        const mid = { ...db.reads };
        await sleep(33000);
        const after = { ...db.reads };
        ok('dashboard feed: the list was downloaded once for the new result', mid.inviteLists - before.inviteLists === 1, `${mid.inviteLists - before.inviteLists} list reads`);
        ok('dashboard feed: while idle it only asks how many results exist (1 read each)', after.inviteLists === mid.inviteLists && after.inviteCounts - mid.inviteCounts >= 2,
          `in 33 s: ${after.inviteLists - mid.inviteLists} list reads, ${after.inviteCounts - mid.inviteCounts} count reads`);
      }
    } else skip('dashboard feed: scoring and live update', 'no SEAL_KEY_FILE');
    if (process.env.BIWEEK_SHOT) { // optional picture of the feed, for a human to look at
      await sleep(900);
      const clip = await dash.evaluate(() => {
        const r = document.querySelector('[data-attempt-feed]').getBoundingClientRect();
        return { x: Math.max(0, r.left - 8), y: Math.max(0, r.top - 8), width: r.width + 16, height: Math.min(r.height + 16, window.innerHeight) };
      });
      await dash.screenshot({ path: process.env.BIWEEK_SHOT, clip, animations: 'disabled', timeout: 15000 }).catch((e) => console.log('screenshot failed:', String(e.message).slice(0, 200)));
    }

    // The share panel above the sheet.
    const panel = await until(() => dash.evaluate(() => {
      const state = document.querySelector('[data-code-state]');
      if (!state || state.getAttribute('data-code-state') === 'checking') return null;
      const link = document.querySelector('[data-invite-link]');
      const count = document.querySelector('[data-test-count]');
      return { state: state.getAttribute('data-code-state'), link: link ? link.textContent : '', count: count ? count.textContent : '' };
    }), 15000);
    ok('dashboard panel: the invite code is registered before a link is offered', !!panel && panel.state === 'ok' && panel.link.includes('?invite=BORA-2026'), panel ? `${panel.state} ${panel.link}` : 'panel missing');
    ok('dashboard panel: the selected test states its question count', !!panel && /This test has \d+ questions/.test(panel.count), panel ? panel.count : '');
  }
  await dash.close();
} else skip('dashboard checks', 'not a built site (no assets/ folder)');

// 5. no installed key → "Not scored yet", never a wrong number
db.sealCode = null;
await hub.reload({ waitUntil: 'domcontentloaded' });
await until(() => hub.evaluate(() => document.querySelectorAll('.bp-share').length > 10));
await openShare('diagnostic.html');
await hub.evaluate(() => document.getElementById('bp-tab-results').click());
await until(async () => (await resultsText()).includes('Sok Dara'));
view = await currentRows();
const unscored = view.current.find((r) => r[0] === 'Sok Dara');
const text2 = await resultsText();
ok('without the installed answer key the row says "Not scored yet"', !!unscored && /Not scored yet/.test(unscored[3]) && unscored[3].includes(`${diag.total} questions`) && /answer key is not installed/.test(text2),
  unscored ? unscored[3].replace(/\s+/g, ' ') : 'row missing');

ok('the database refused nothing', violations.length === 0, violations.join(' | '));
ok('no page errors', pageErrors.length === 0, pageErrors.join(' | '));

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${failed} failed, ${results.filter((r) => r.startsWith('SKIP')).length} skipped (served: ${DIST})`);
await browser.close().catch(() => {});
servers.forEach((s) => s.close());
process.exit(failed ? 1 : 0);
