// Verify the Daily Student Assessment Records workspace (owner request:
// "Assessment area needs a bug check") — drives the REAL built workspace
// against an in-memory Firestore REST fake, exercising the flows the
// teacher uses daily:
//
//   1. teacher gate → open workspace → create class → class list order
//      (updatedAt written as an ISO string must be read back — "newest
//      activity first" silently never worked when the reader only accepted
//      Firestore timestampValue);
//   2. roster: add students, key identity fields, score cells (0–5 cap,
//      replace-on-focus entry model), debounced saves with correct masks;
//   3. weekly entries: "This week" selector shows the selected week even
//      before any score exists, scores patch weeks.<monday>.<field> leaves;
//   4. AI Insights: pulse chips render, assistant answers keyword questions
//      and per-student questions.
//
// Later sections (tutor agent) pin the agent's record-keeping flows.

import { chromium } from 'playwright';
import { readFile, readdir } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const PORT = 8956; const BASE = `http://127.0.0.1:${PORT}`;
mkdirSync('/home/z/my-project/tmp/cmc-site/scripts/qa', { recursive: true });
const SHOTS = '/home/z/my-project/tmp/cmc-site/scripts/qa';

let pass = 0, fail = 0;
const ws = (page) => page.locator('[data-testid="assessment-workspace"]');
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

// ── in-memory Firestore REST fake (assessment_classes only) ─────────────
const dec = (v) => {
  if (!v || typeof v !== 'object') return v;
  if (typeof v.integerValue === 'string') return parseInt(v.integerValue, 10) || 0;
  if (typeof v.doubleValue === 'number') return v.doubleValue;
  if (typeof v.stringValue === 'string') return v.stringValue;
  if (typeof v.booleanValue === 'boolean') return v.booleanValue;
  if (v.nullValue === null) return null;
  if (v.mapValue?.fields) return Object.fromEntries(Object.entries(v.mapValue.fields).map(([k, x]) => [k, dec(x)]));
  return undefined;
};
const enc = (v) => {
  if (typeof v === 'number') return { integerValue: String(Math.round(v)) };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
  return { stringValue: String(v) };
};
const encl = (o) => ({ fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)])) });
const idOf = (name) => String(name).split('/').pop();

const db = {
  classes: new Map(),   // cid → { fields: plain, seq }
  students: new Map(),  // cid → Map(sid → plain)
  seq: 0,
  patches: [],          // audit log of every student PATCH body+mask
  reqs: [],             // request log for failure dumps
};
const deepSet = (obj, path, value) => {
  const segs = path.split('.');
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    if (typeof cur[segs[i]] !== 'object' || cur[segs[i]] === null) cur[segs[i]] = {};
    cur = cur[segs[i]];
  }
  cur[segs[segs.length - 1]] = value;
};
const deepDelete = (obj, path) => {
  const segs = path.split('.');
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    if (typeof cur[segs[i]] !== 'object' || cur[segs[i]] === null) return;
    cur = cur[segs[i]];
  }
  delete cur[segs[segs.length - 1]];
};

const FS_PAT = '**/firestore.googleapis.com/**';
function handleFs(route) {
  const url = new URL(route.request().url());
  const path = decodeURIComponent(url.pathname);
  const method = route.request().method();
  let body = {};
  try { body = route.request().postData() ? JSON.parse(route.request().postData()) : {}; } catch { return route.abort(); }
  // Class lookups run as a root-level documents:runQuery — the collection
  // name rides in the structuredQuery body, not the URL.
  const isAssessment = path.includes('assessment_classes')
    || (String(path).endsWith(':runQuery') && JSON.stringify(body).includes('assessment_classes'));
  if (!isAssessment) {
    // The homepage's Firebase SDK listener also talks to Firestore (Listen
    // channel with a non-JSON body) — abort it like an offline network so
    // the page's own error handling deals with it.
    return route.abort();
  }
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Goog-Api-Client, X-Firebase-GMPID',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  };
  if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  const masks = url.searchParams.getAll('updateMask.fieldPaths');
  const rest = path.replace(/^.*\/documents\/?/, '');
  db.reqs.push(`${method} ${rest}${masks.length ? ' :: ' + masks.join(',') : ''}`);
  const json = (obj, status = 200) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(obj) });

  // runQuery — class lookup by teacherUid or teacherEmail (REST transport;
  // the endpoint is a root-level documents:runQuery)
  if (path.endsWith(':runQuery') && body.structuredQuery) {
    const where = body.structuredQuery?.where?.fieldFilter;
    const field = where?.field?.fieldPath;
    const value = where?.value?.stringValue;
    const docs = [...db.classes.entries()]
      .filter(([, c]) => (field === 'teacherUid' ? c.fields.teacherUid : c.fields.teacherEmail) === value)
      .map(([cid, c]) => ({ document: { name: `projects/p/databases/(default)/documents/assessment_classes/${cid}`, fields: encl(c.fields).fields } }));
    return json(docs);
  }
  const rest2 = path.includes('/documents/') ? path.replace(/^.*\/documents\//, '') : '';
  const m = rest2.match(/^assessment_classes(?:\/([^/]+))?(?:\/students(?:\/([^/?]+))?)?$/);
  if (!m) return json({ error: { message: 'not found' } }, 404);
  const [, cid, sid] = m;

  if (!cid && method === 'POST') { // create class
    const id = `cls-${++db.seq}`;
    db.classes.set(id, { fields: Object.fromEntries(Object.entries(body.fields).map(([k, v]) => [k, dec(v)])) });
    db.students.set(id, new Map());
    return json({ name: `projects/p/databases/(default)/documents/assessment_classes/${id}` });
  }
  if (cid && !sid && method === 'PATCH') { // class meta patch
    const c = db.classes.get(cid);
    if (!c) return json({ error: { message: 'no class' } }, 404);
    const decoded = Object.fromEntries(Object.entries(body.fields).map(([k, v]) => [k, dec(v)]));
    for (const mask of masks) {
      if (decoded[mask] !== undefined) c.fields[mask] = decoded[mask];
      else deepDelete(c.fields, mask);
    }
    return json({ name: `projects/p/databases/(default)/documents/assessment_classes/${cid}`, fields: encl(c.fields).fields });
  }
  if (cid && method === 'GET' && !sid) { // list students
    const rows = [...(db.students.get(cid) ?? new Map()).entries()]
      .map(([id, s]) => ({ name: `projects/p/databases/(default)/documents/assessment_classes/${cid}/students/${id}`, fields: encl(s).fields }));
    return json({ documents: rows });
  }
  if (cid && method === 'POST' && !sid) { // add student
    const id = `stu-${++db.seq}`;
    db.students.get(cid).set(id, Object.fromEntries(Object.entries(body.fields).map(([k, v]) => [k, dec(v)])));
    return json({ name: `projects/p/databases/(default)/documents/assessment_classes/${cid}/students/${id}` });
  }
  if (cid && sid && method === 'PATCH') { // student patch (flat or week leaves)
    const roster = db.students.get(cid);
    const s = roster?.get(sid);
    if (!s) return json({ error: { message: 'no student' } }, 404);
    const decoded = Object.fromEntries(Object.entries(body.fields).map(([k, v]) => [k, dec(v)]));
    db.patches.push({ cid, sid, masks, decoded });
    for (const mask of masks) {
      const segs = mask.split('.');
      // resolve the decoded value at this path
      let cur = decoded, okPath = true;
      for (const seg of segs) { if (cur && typeof cur === 'object' && seg in cur) cur = cur[seg]; else { okPath = false; break; } }
      if (okPath) deepSet(s, mask, cur);
      else deepDelete(s, mask);
    }
    return json({ name: `projects/p/databases/(default)/documents/assessment_classes/${cid}/students/${sid}`, fields: encl(s).fields });
  }
  if (cid && sid && method === 'DELETE') {
    db.students.get(cid)?.delete(sid);
    return json({});
  }
  return json({ error: { message: 'unhandled' } }, 404);
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
  'cmc-student-verified': '1',
};

// ── 1. static pins ───────────────────────────────────────────────────────
console.log('static · assessment bundle');
let hubChunk = '';
try {
  const assets = await readdir(join(DIST, 'assets'));
  hubChunk = assets.find((a) => /^AssessmentWorkspace-.*\.js$/.test(a)) ?? '';
} catch {}
ok(!!hubChunk, 'AssessmentWorkspace chunk exists in dist/assets');
if (hubChunk) {
  const chunk = await readFile(join(DIST, 'assets', hubChunk), 'utf8');
  ok(chunk.includes('Assessment workspace'), 'workspace chrome text shipped');
  ok(chunk.includes('sanitizeScoreText') === false, 'scoring sanitizer inlined into the shared lib chunk (not duplicated)');
}

// ── 2. browser flows ─────────────────────────────────────────────────────
const browser = await chromium.launch();

// The workspace's week key is the Monday containing today (local time) —
// the same math the app uses (Cambodia: no DST, UTC+7).
const mondayKey = (() => {
  const d = new Date();
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

async function newTeacherPage(routes = []) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  for (const [k, v] of Object.entries(TEACHER_SEED)) await ctx.addInitScript(([key, val]) => localStorage.setItem(key, val), [k, v]);
  await ctx.route(FS_PAT, handleFs);
  for (const r of routes) await ctx.route(...r);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, page, errors };
}

const openWorkspace = async (page) => {
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const el = document.getElementById('daily-assessment');
    if (el && !document.body.textContent?.includes('Open the assessment workspace')) {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
    return document.body.textContent?.includes('Open the assessment workspace') ?? false;
  }, null, { timeout: 30000 });
  await page.getByRole('button', { name: 'Open the assessment workspace' }).click();
  await page.waitForSelector('[data-testid="assessment-workspace"]', { timeout: 20000 });
  await page.waitForTimeout(400);
};

// 2a. class creation + ordering
console.log('browser · class create + newest-first ordering');
{
  const { ctx, page, errors } = await newTeacherPage();
  await openWorkspace(page);
  ok(errors.length === 0, 'workspace opens with no page errors', errors.join(' | '));
  ok(((await page.textContent('[data-testid="assessment-workspace"]')) || '').includes('No assessment class yet'), 'empty state before first class');

  await ws(page).getByRole('button', { name: /New class/ }).click();
  await page.fill('input[placeholder="e.g. Creative Minds Academy"]', 'Creative Minds Academy');
  await page.fill('input[placeholder="e.g. Grade 7 — Morning"]', 'Grade 7 — Morning');
  await ws(page).getByRole('button', { name: 'Create class' }).dispatchEvent('click');
  await page.waitForTimeout(700);
  const bar = await page.textContent('[data-testid="assessment-workspace"]');
  ok(bar.includes('Creative Minds Academy · Grade 7 — Morning'), 'created class becomes active', bar.slice(0, 120));
  if (!bar.includes('Grade 7 — Morning')) {
    const modal = await page.locator('div[aria-label="Create assessment class"]').textContent().catch(() => '');
    console.log('  DBG modal:', modal?.slice(0, 300));
    console.log('  DBG reqs:', JSON.stringify(db.reqs.slice(-8), null, 1));
    console.log('  DBG errors:', errors.join(' | '));
  }

  // second class — created later, must sort FIRST (newest activity first)
  await ws(page).getByRole('button', { name: /New class/ }).click();
  await page.fill('input[placeholder="e.g. Creative Minds Academy"]', 'Creative Minds Academy');
  await page.fill('input[placeholder="e.g. Grade 7 — Morning"]', 'Grade 8 — Afternoon');
  await ws(page).getByRole('button', { name: 'Create class' }).dispatchEvent('click');
  await page.waitForTimeout(700);
  const options = await page.locator('select[aria-label="Select assessment class"] option').allTextContents();
  ok(options[0]?.includes('Grade 8 — Afternoon'), 'newest class sorts first (updatedAt ordering works)', JSON.stringify(options));
  ok(errors.length === 0, 'class creation produces no page errors', errors.join(' | '));
  await page.screenshot({ path: join(SHOTS, 'assessment-classes.png'), fullPage: false });
  await ctx.close();
}

// 2b. roster + score keying (flat) + cap + debounced save masks
console.log('browser · roster + score keying');
{
  const { ctx, page, errors } = await newTeacherPage();
  await openWorkspace(page);
  await ws(page).getByRole('button', { name: /New class/ }).click();
  await page.fill('input[placeholder="e.g. Grade 7 — Morning"]', 'Grade 7 — Morning');
  await ws(page).getByRole('button', { name: 'Create class' }).dispatchEvent('click');
  await page.waitForTimeout(700);
  await ws(page).getByRole('button', { name: 'Add student', exact: true }).click();
  await page.waitForTimeout(900);
  ok(await page.locator('input[placeholder="Student name"]').count() === 1, 'added student row appears on the roster');
  await page.locator('input[placeholder="Student name"]').fill('Dara');
  await page.waitForTimeout(1100); // debounce 700ms
  const namePatch = db.patches.find((p) => p.masks.includes('name'));
  ok(!!namePatch && namePatch.decoded.name === 'Dara', 'name edit PATCHes the student doc with the name mask', JSON.stringify(db.patches));

  // Listening tab: 0–5 cell — keying "45" must cap at 4 (single digit)
  await ws(page).getByRole('button', { name: 'Listening & Speaking' }).click();
  const cell = ws(page).locator('table input[type="number"]').first();
  await cell.click();
  await page.keyboard.type('45');
  await page.waitForTimeout(300);
  ok((await cell.inputValue()) === '4', '0–5 cell caps at one digit ("45" keys as 4)', await cell.inputValue());
  await page.waitForTimeout(900);
  const listeningMask = db.patches.find((p) => p.masks.includes(`weeks.${mondayKey}.listening`));
  ok(!!listeningMask && listeningMask.decoded.weeks[mondayKey].listening === 4,
    'listening score PATCHes weeks.<current monday>.listening (workspace opens synced to the actual date)', JSON.stringify(db.patches.at(-1)));

  // focus-replace model: typing 3 replaces, not appends
  await cell.click();
  await page.keyboard.type('3');
  await page.waitForTimeout(1100);
  const last = db.patches.at(-1);
  ok(last?.decoded.weeks[mondayKey].listening === 3, 'focused cell replaces the value (3, not 43)', JSON.stringify(last));

  // roster Overall column reflects the saved score (listening 3/5 → 60%)
  await ws(page).getByRole('button', { name: 'Roster', exact: true }).click();
  const overall = await ws(page).locator('table tbody tr td .cmc-stat-num').first().textContent();
  ok(overall?.trim() === '60%', 'roster Overall recomputes from keyed skills (3/5 → 60%)', overall ?? '');
  ok(errors.length === 0, 'score keying produces no page errors', errors.join(' | '));
  await page.screenshot({ path: join(SHOTS, 'assessment-roster.png') });
  await ctx.close();
}

// 2c. weekly entries — selector + week-leaf patches
console.log('browser · weekly entries');
{
  const { ctx, page, errors } = await newTeacherPage();
  await openWorkspace(page);
  await ws(page).getByRole('button', { name: /New class/ }).click();
  await page.fill('input[placeholder="e.g. Grade 7 — Morning"]', 'Grade 7 — Morning');
  await ws(page).getByRole('button', { name: 'Create class' }).dispatchEvent('click');
  await page.waitForTimeout(700);
  await ws(page).getByRole('button', { name: 'Add student', exact: true }).click();
  await page.waitForTimeout(900);
  await page.locator('input[placeholder="Student name"]').fill('Dara');
  await page.waitForTimeout(900);

  // The workspace now OPENS on the actual current week (owner: "sync the
  // date with the actual date") — the "This week" button is already active
  // (disabled) and the selector lists the week marked as current.
  ok(await ws(page).getByRole('button', { name: 'This week' }).isDisabled(), 'workspace opens on the actual current week ("This week" already active)');
  const sel = ws(page).locator('select[aria-label="Assessment week"]');
  const selectedLabel = await sel.evaluate((el) => el.options[el.selectedIndex]?.textContent ?? '');
  ok(/Week of /.test(selectedLabel) && selectedLabel.includes('— current week'), 'week selector opens on the current week and marks it', selectedLabel);
  const caption = await page.textContent('[data-testid="assessment-workspace"]');
  ok(caption.includes('Recording into Week of') && caption.includes('(current week)'), 'caption names the recording week as current');

  await ws(page).getByRole('button', { name: 'Homework', exact: true }).click();
  const cell = ws(page).locator('table input[type="number"]').first();
  await cell.click();
  await page.keyboard.type('80');
  await page.waitForTimeout(1100);
  const weekMask = db.patches.at(-1)?.masks.find((m) => m.startsWith('weeks.'));
  ok(weekMask === `weeks.${mondayKey}.hwDay1`, 'week score PATCHes the weeks.<current monday>.hwDay1 leaf', JSON.stringify(db.patches.at(-1)?.masks));

  // switching back to Initial shows the flat value (homework day blank there)
  await ws(page).locator('select[aria-label="Assessment week"]').selectOption('__base__');
  await page.waitForTimeout(300);
  const flatCell = await ws(page).locator('table input[type="number"]').first().inputValue();
  ok(flatCell === '', 'Initial record stays blank after a week-only entry (no bleed)', flatCell);
  // and the selector still offers the current week even with data elsewhere
  const optLabels = await sel.evaluate((el) => [...el.options].map((o) => o.textContent));
  ok(optLabels.some((t) => t?.includes('— current week')), 'current week stays listed in the selector after leaving it', JSON.stringify(optLabels));
  ok(errors.length === 0, 'weekly flows produce no page errors', errors.join(' | '));
  await page.screenshot({ path: join(SHOTS, 'assessment-week.png') });
  await ctx.close();
}

// 2d. AI Insights tab + assistant
console.log('browser · AI insights tab');
{
  const { ctx, page, errors } = await newTeacherPage();
  await openWorkspace(page);
  await ws(page).getByRole('button', { name: /New class/ }).click();
  await page.fill('input[placeholder="e.g. Grade 7 — Morning"]', 'Grade 7 — Morning');
  await ws(page).getByRole('button', { name: 'Create class' }).dispatchEvent('click');
  await page.waitForTimeout(700);
  await ws(page).getByRole('button', { name: 'Add student', exact: true }).click();
  await page.waitForTimeout(700);
  await page.locator('input[placeholder="Student name"]').fill('Dara');
  await page.waitForTimeout(900);
  await ws(page).getByRole('button', { name: 'Add student', exact: true }).click();
  await page.waitForTimeout(700);
  await page.locator('input[placeholder="Student name"]').nth(1).fill('Bora');
  await page.waitForTimeout(900);

  await ws(page).getByRole('button', { name: /AI (Insights|Tutor)/ }).click();
  await page.waitForTimeout(500);
  const tab = await page.textContent('[data-testid="insights-tab"]');
  ok(!!tab, 'insights tab renders with students present');
  // record history directly through the fake so trends exist — find the
  // class whose roster actually holds Dara + Bora (seq ids are shared)
  let roster = null;
  for (const r of db.students.values()) {
    if ([...r.values()].some((st) => st.name === 'Dara') && [...r.values()].some((st) => st.name === 'Bora')) { roster = r; break; }
  }
  if (!roster) throw new Error('harness: roster with Dara+Bora not found');
  const daraId = [...roster.entries()].find(([, s]) => s.name === 'Dara')?.[0];
  const boraId = [...roster.entries()].find(([, s]) => s.name === 'Bora')?.[0];
  const iso = (d) => ({ timestampValue: d });
  const wk = (listening) => encl({ listening, speaking: listening, pronunciation: listening, fluency: listening });
  roster.get(daraId).weeks = {
    '2026-10-26': { listening: 2, speaking: 2, pronunciation: 2, fluency: 2 },
    '2026-11-02': { listening: 4, speaking: 4, pronunciation: 4, fluency: 4 },
  };
  roster.get(boraId).weeks = {
    '2026-10-26': { listening: 4, speaking: 4, pronunciation: 4, fluency: 4 },
    '2026-11-02': { listening: 1, speaking: 1, pronunciation: 1, fluency: 1 },
  };
  roster.get(daraId).updatedAt = iso(new Date().toISOString());
  await ws(page).getByRole('button', { name: 'Roster', exact: true }).click();
  await page.waitForTimeout(1200); // let the 6s poll pick up the history
  await ws(page).getByRole('button', { name: /AI (Insights|Tutor)/ }).click();
  await page.waitForTimeout(500);
  const pulse = await page.textContent('[data-testid="insights-tab"]');
  ok(pulse.includes('Rising') && pulse.includes('Falling'), 'pulse grid renders rising/falling after history exists');
  const askInput = ws(page).locator('input[aria-label*="assistant" i], input[aria-label*="tutor" i], input[aria-label*="Ask" i]').first();
  await askInput.fill('Who is falling?');
  await askInput.press('Enter');
  await page.waitForTimeout(400);
  const thread = await page.textContent('[data-testid="insights-tab"]');
  ok(thread.includes('Bora') && /trending down|falling/i.test(thread), 'assistant answers "Who is falling?" with Bora');
  await askInput.fill('What about Dara?');
  await askInput.press('Enter');
  await page.waitForTimeout(400);
  const thread2 = await page.textContent('[data-testid="insights-tab"]');
  ok(/Dara/.test(thread2) && /rising/i.test(thread2), 'assistant answers a per-student question with the trend narrative');

  // Missed inputs — the agent actively scans the selected (current) week:
  // Dara and Bora have history but nothing recorded for the current week.
  const missed = await page.textContent('[data-testid="insights-tab"]');
  ok(missed.includes('Missed inputs (2)'), 'missed-input panel lists both students for the current week', missed.slice(0, 400));
  ok(missed.includes('no entry for') && missed.includes('nobody has recorded this week so far'), 'panel details name the missing work');
  await ws(page).getByRole('button', { name: 'Find missed inputs' }).click();
  await page.waitForTimeout(400);
  const threadM = await page.textContent('[data-testid="insights-tab"]');
  ok(threadM.includes('I scanned the records for missed inputs'), '"Find missed inputs" posts the scan report in the thread');
  await ws(page).getByRole('button', { name: 'Assessment feedback' }).click();
  await page.waitForTimeout(400);
  const threadF = await page.textContent('[data-testid="insights-tab"]');
  ok(threadF.includes('Assessment feedback — Week of') && threadF.includes('Dara:') && threadF.includes('Bora:'), '"Assessment feedback" drafts a grounded line per student');
  await askInput.fill('any missed inputs?');
  await askInput.press('Enter');
  await page.waitForTimeout(400);
  ok(((await page.textContent('[data-testid="insights-tab"]')) || '').includes('2 missed inputs'), '"missed inputs" question routes to the agent scan');
  ok(errors.length === 0, 'insights tab produces no page errors', errors.join(' | '));
  await page.screenshot({ path: join(SHOTS, 'assessment-insights.png') });
  await ctx.close();
}

// ── 3. tutor agent — keyed-in stats + record maintenance ────────────────
console.log('browser · tutor agent records stats');
const openReadyClass = async (page) => {
  await openWorkspace(page);
  await ws(page).getByRole('button', { name: /New class/ }).click();
  await page.fill('input[placeholder="e.g. Grade 7 — Morning"]', 'Tutor Demo');
  await ws(page).getByRole('button', { name: 'Create class' }).dispatchEvent('click');
  await page.waitForTimeout(800);
  const clsId = [...db.classes.keys()].at(-1); // the class the fake just created
  await ws(page).getByRole('button', { name: 'Add student', exact: true }).click();
  await page.waitForTimeout(400); // optimistic insert paints immediately now
  await ws(page).locator('input[placeholder="Student name"]').fill('Dara');
  await page.waitForTimeout(900);
  await ws(page).getByRole('button', { name: /AI Tutor/ }).click();
  await page.waitForTimeout(400);
  return clsId;
};
const askAgent = async (page, text) => {
  const askInput = ws(page).locator('input[aria-label="Ask the tutor agent"]');
  await askInput.fill(text);
  await askInput.press('Enter');
  await page.waitForTimeout(350);
};
const applyCard = async (page) => {
  await ws(page).getByRole('button', { name: 'Apply to records' }).first().dispatchEvent('click');
  await page.waitForTimeout(900);
};

{
  const { ctx, page, errors } = await newTeacherPage();
  const clsId = await openReadyClass(page);
  const patchBase = db.patches.length; // patches BEFORE this section belong to earlier flows
  const sectPatches = () => db.patches.slice(patchBase);

  // draft card — nothing is saved until Apply
  await askAgent(page, 'Dara listening 4 speaking 3');
  let tabText = await ws(page).textContent();
  ok(tabText.includes('Apply to records'), 'keyed stats render a confirmation card (draft, not saved)');
  ok(tabText.includes('Listening 4/5') && tabText.includes('Speaking 3/5'), 'card lists the parsed skills', tabText.slice(-400));
  ok(!sectPatches().some((p) => p.masks.some((m) => m.endsWith('.listening'))), 'no PATCH before Apply (draft stays a draft)');

  await applyCard(page);
  const rec = sectPatches().find((p) => p.masks.some((m) => m.endsWith('.listening')) && p.masks.some((m) => m.endsWith('.speaking')));
  ok(!!rec && rec.decoded.weeks[mondayKey].listening === 4 && rec.decoded.weeks[mondayKey].speaking === 3,
    'Apply PATCHes listening+speaking into the current week through the same db layer', JSON.stringify(sectPatches()));
  ok(((await ws(page).textContent()) || '').includes('Saved to the records.'), 'card confirms the save');
  // roster reflects the agent's write: listening area = mean(4,3)*20 = 70
  await ws(page).getByRole('button', { name: 'Roster', exact: true }).click();
  await page.waitForTimeout(400);
  const overall = await ws(page).locator('table tbody tr td .cmc-stat-num').first().textContent();
  ok(overall?.trim() === '70%', 'roster Overall recomputes from agent-recorded skills (70%)', overall ?? '');

  // the thread (and its Undo) survives peeking at another tab
  await ws(page).getByRole('button', { name: /AI Tutor/ }).click();
  await page.waitForTimeout(300);
  ok(await ws(page).getByRole('button', { name: 'Undo' }).first().isVisible(), 'agent card + Undo survive a tab switch (thread stays mounted)');

  // undo writes the previous values back
  await ws(page).getByRole('button', { name: 'Undo' }).first().dispatchEvent('click');
  await page.waitForTimeout(900);
  const undoPatch = db.patches.at(-1);
  ok(undoPatch?.decoded.weeks[mondayKey].listening === 0 && undoPatch?.decoded.weeks[mondayKey].speaking === 0, 'Undo writes the previous values back (0 = not assessed)', JSON.stringify(undoPatch));
  await ws(page).getByRole('button', { name: 'Roster', exact: true }).click();
  await page.waitForTimeout(400);
  const overall2 = await ws(page).locator('table tbody tr td .cmc-stat-num').first().textContent();
  ok(overall2?.trim() === '—', 'Overall clears after the undo', overall2 ?? '');

  // add a student through the agent
  await ws(page).getByRole('button', { name: /AI Tutor/ }).click();
  await page.waitForTimeout(300);
  await askAgent(page, 'add student Sreyleap');
  await applyCard(page);
  const added = [...(db.students.get(clsId) ?? new Map()).values()].some((st) => st.name === 'Sreyleap');
  ok(added, 'agent adds a roster row through addAssessmentStudent');
  ok(((await ws(page).textContent()) || '').includes('Sreyleap'), 'new student appears on the roster');

  // note through the agent
  await askAgent(page, 'note for Dara: much better participation this week');
  await applyCard(page);
  const notePatch = db.patches.filter((p) => p.masks.includes('teacherComment')).at(-1);
  ok(!!notePatch && notePatch.decoded.teacherComment === 'much better participation this week', 'agent saves teacher feedback into the record', JSON.stringify(notePatch));

  // errors are humane, not stack traces
  await askAgent(page, 'note for Ghost: hello');
  tabText = await ws(page).textContent();
  ok(tabText.includes("couldn't find"), 'unknown student gets a humane problem message');

  // questions still route to the insight Q&A
  await askAgent(page, 'Class overview');
  tabText = await ws(page).textContent();
  ok(/Tracking \d+ students/.test(tabText), 'class questions still answer from the saved history');
  ok(errors.length === 0, 'tutor agent flows produce no page errors', errors.join(' | '));
  await page.screenshot({ path: join(SHOTS, 'assessment-tutor.png') });
  await ctx.close();
}

// 3b. agent + selected week — scores must land in the week entry
console.log('browser · tutor agent week targeting');
{
  const { ctx, page, errors } = await newTeacherPage();
  await openReadyClass(page);
  // The workspace already opens on the actual current week — no week switch
  // needed before keying daily stats.
  await askAgent(page, 'Dara hw 80 90');
  await applyCard(page);
  const wk = db.patches.filter((p) => p.masks.some((m) => m.startsWith('weeks.'))).at(-1);
  const maskStr = JSON.stringify(wk?.masks ?? []);
  ok(/weeks\.\d{4}-\d{2}-\d{2}\.hwDay1/.test(maskStr) && /hwDay2/.test(maskStr), 'keyed daily stats land in weeks.<monday>.hwDay1+hwDay2', maskStr);
  ok(errors.length === 0, 'week-targeted agent writes produce no page errors', errors.join(' | '));
  await page.screenshot({ path: join(SHOTS, 'assessment-tutor-week.png') });
  await ctx.close();
}

await browser.close();
server.close();
console.log(`\nverify_assessment: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
