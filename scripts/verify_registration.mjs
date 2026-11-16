// School registration — browser check of the whole path, teacher and student.
//
// Step one of the school backend: an account is tied to a real student on a
// class list (Kid 5 to Kid 11, morning and afternoon). This script walks it
// with separate signed-in browsers — one teacher, two students — against an
// in-memory copy of the database that applies the roster_seats and
// student_links rules from firestore.rules, written out in JS. A write the
// real rules would refuse is refused here too, so the app and the rules are
// checked against each other. (It is a mirror: the real rules still have to
// be published and tried once in Firebase.)
//
//   rules     the rule model refuses the cheats and allows a registration
//   classes   the teacher sets up the fourteen classes in one go
//   publish   paste a class list, open registration
//   register  wrong name refused; right ID + name lands in the right class;
//             a second account cannot take the same student
//   private   a second teacher sees none of the first teacher's classes,
//             students or seats, and cannot take a student over
//   teacher   the teacher sees who registered; a corrected spelling keeps the
//             account; release frees a seat; close withdraws the open ones
//   phone     no sideways scroll on a phone, teacher tab and student card
//
//   node scripts/verify_registration.mjs
//   REG_DIST=dir        serve another folder (default ../dist)
//   REG_SHOTS=dir       also save screenshots
//   PW_CHROMIUM=/path   use this Chromium binary (with playwright-core)
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeFake, makeOpener } from './qa/school_fake.mjs';
const { chromium } = await import('playwright').catch(() => import('playwright-core'));

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(process.env.REG_DIST || join(HERE, '..', 'dist'));
const SHOTS = process.env.REG_SHOTS ? resolve(process.env.REG_SHOTS) : null;
const PORT = 8990;
const { openPage, close: closeServers } = makeOpener(DIST, PORT);

let pass = 0;
let fail = 0;
const fails = [];
const ok = (c, msg, extra) => {
  if (c) pass++;
  else {
    fail++;
    fails.push(msg + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 500) : ''));
  }
  console.log((c ? '  ok  ' : '  FAIL') + ' ' + msg + (!c && extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 500) : ''));
};
const shot = async (page, name) => {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `registration-${name}.png`) });
};
const waitFor = async (fn, ms = 12000) => {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > ms) return v;
    await new Promise((r) => setTimeout(r, 150));
  }
};
const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const TEACHER = { uid: 'teacher-1', email: 'sreyneang@cmc.edu.kh', name: 'Teacher Sreyneang', type: 'teacher' };
const TEACHER2 = { uid: 'teacher-2', email: 'vannak@cmc.edu.kh', name: 'Teacher Vannak', type: 'teacher' };
const DARA = { uid: 'stu-dara', email: 'dara.family@gmail.com', name: 'Dara', type: 'student' };
const SOPHEA = { uid: 'stu-sophea', email: 'sophea.home@gmail.com', name: 'Sophea', type: 'student' };
const UNVERIFIED = { uid: 'stu-new', email: 'new@gmail.com', name: 'New', type: 'student', verified: false };

// ── 1 · the rule model on its own ───────────────────────────────────────────
function checkRules() {
  console.log('\nrules');
  const fake = makeFake();
  const S = (v) => ({ stringValue: v });
  const N = { nullValue: null };
  const name = (p) => `projects/p/databases/(default)/documents/${p}`;
  const seatFields = (over = {}) => ({ classId: S('c1'), studentId: S('r1'), className: S('Kid 7 — Morning'), studentName: S('Sok Dara'), schoolId: S('S0701'), teacherUid: S(TEACHER.uid), claimedBy: N, claimedEmail: S(''), claimedName: S(''), claimedAt: N, ...over });
  const mk = (key, over) => fake.call(TEACHER, 'POST', ':commit', { writes: [{ update: { name: name(`roster_seats/${key}`), fields: seatFields(over) }, currentDocument: { exists: false } }] });
  const claim = (user, key, extra = {}) => ({
    update: { name: name(`roster_seats/${key}`), fields: { claimedBy: S(user.uid), claimedEmail: S(user.email), claimedName: S(user.name), claimedAt: { timestampValue: '2026-11-14T02:00:00Z' }, ...extra } },
    updateMask: { fieldPaths: ['claimedBy', 'claimedEmail', 'claimedName', 'claimedAt', ...Object.keys(extra)] },
    currentDocument: { exists: true },
  });
  const link = (user, key, uid = user.uid, extra = {}) => ({
    update: { name: name(`student_links/${uid}`), fields: { uid: S(uid), seatKey: S(key), linkedAt: { timestampValue: '2026-11-14T02:00:00Z' }, ...extra } },
    currentDocument: { exists: false },
  });
  const commit = (user, writes) => fake.call(user, 'POST', ':commit', { writes }).status;

  ok(mk('seatA').status === 200 && mk('seatB').status === 200, 'a teacher can publish seats');
  ok(commit(DARA, [{ update: { name: name('roster_seats/mine'), fields: seatFields() }, currentDocument: { exists: false } }]) === 403, 'a student cannot create a seat');
  ok(fake.call(DARA, 'POST', ':runQuery', { structuredQuery: { from: [{ collectionId: 'roster_seats' }] } }).status === 403, 'a student cannot list the seats (the class list cannot be browsed)');
  ok(fake.call(DARA, 'GET', '/roster_seats/seatA').status === 200, 'a student who knows the key can fetch that one seat');
  ok(fake.call(UNVERIFIED, 'GET', '/roster_seats/seatA').status === 403, 'an unverified account cannot fetch a seat');
  ok(commit(DARA, [claim(DARA, 'seatA')]) === 403, 'taking a seat without the account link is refused');
  ok(commit(DARA, [link(DARA, 'seatA')]) === 403, 'linking an account to a seat it has not taken is refused');
  ok(commit(DARA, [claim(DARA, 'seatA', { className: S('Kid 11 — Afternoon') }), link(DARA, 'seatA')]) === 403, 'a student cannot change the class while registering');
  ok(commit(DARA, [claim(SOPHEA, 'seatA'), link(DARA, 'seatA', SOPHEA.uid)]) === 403, 'a student cannot register somebody else\'s account');
  ok(commit(DARA, [claim(DARA, 'seatA'), link(DARA, 'seatA', DARA.uid, { role: S('teacher') })]) === 403, 'a link carries nothing but uid, seat and time');
  ok(commit(UNVERIFIED, [claim(UNVERIFIED, 'seatA'), link(UNVERIFIED, 'seatA')]) === 403, 'an unverified account cannot register');
  ok(commit(DARA, [claim(DARA, 'seatA'), link(DARA, 'seatA')]) === 200, 'seat + link in one commit is a registration');
  ok(fake.link(DARA.uid).seatKey === 'seatA' && fake.seats().find((s) => s.key === 'seatA').claimedBy === DARA.uid, 'both halves are stored');
  ok(commit(SOPHEA, [claim(SOPHEA, 'seatA'), link(SOPHEA, 'seatA')]) === 403, 'a taken seat cannot be taken again');
  ok(commit(DARA, [claim(DARA, 'seatB'), link(DARA, 'seatB')]) !== 200, 'a registered account cannot take a second seat');
  ok(commit(DARA, [claim(DARA, 'seatB'), { update: { name: name(`student_links/${DARA.uid}`), fields: { seatKey: S('seatB') } }, updateMask: { fieldPaths: ['seatKey'] } }]) === 403, 'a student cannot move their own link to another seat');
  ok(commit(DARA, [{ delete: name(`student_links/${DARA.uid}`) }]) === 403, 'a student cannot delete their own link');
  ok(commit(DARA, [{ update: { name: name('roster_seats/seatA'), fields: { claimedBy: N } }, updateMask: { fieldPaths: ['claimedBy'] } }]) === 403, 'a student cannot give a seat back and pick again');
  ok(fake.call(SOPHEA, 'GET', `/student_links/${DARA.uid}`).status === 403, 'a student cannot read another account\'s link');
  ok(fake.call(DARA, 'GET', `/student_links/${DARA.uid}`).status === 200, 'a student can read their own link');
  // a seat is withdrawn only if it is still as the teacher last saw it
  const seen = fake.call(TEACHER, 'GET', '/roster_seats/seatB').json.updateTime;
  ok(commit(SOPHEA, [claim(SOPHEA, 'seatB'), link(SOPHEA, 'seatB')]) === 200, 'a second student registers');
  ok(commit(TEACHER, [{ delete: name('roster_seats/seatB'), currentDocument: { updateTime: seen } }]) === 400 && fake.link(SOPHEA.uid) !== null, 'a seat taken a moment ago is not withdrawn from under the student');
  ok(commit(TEACHER, [{ update: { name: name('roster_seats/seatA'), fields: { claimedBy: N } }, updateMask: { fieldPaths: ['claimedBy'] } }, { delete: name(`student_links/${DARA.uid}`) }]) === 200, 'a teacher can release a seat');
  ok(fake.link(DARA.uid) === null, 'the release removes the link');

  // private per teacher
  const q = (user, coll, filters) => fake.call(user, 'POST', ':runQuery', {
    structuredQuery: { from: [{ collectionId: coll }], where: { compositeFilter: { op: 'AND', filters: filters.map(([f, v]) => ({ fieldFilter: { field: { fieldPath: f }, op: 'EQUAL', value: S(v) } })) } } },
  });
  const cls = fake.call(TEACHER, 'POST', '/assessment_classes', { fields: { name: S('Kid 7 — Morning'), teacherUid: S(TEACHER.uid), teacherEmail: S(TEACHER.email) } });
  const cid = cls.json.name.split('/').pop();
  ok(cls.status === 200, 'a teacher creates a class of their own');
  ok(fake.call(TEACHER, 'POST', `/assessment_classes/${cid}/students`, { fields: { name: S('Sok Dara'), quiz: S('18') } }).status === 200, 'and records a student in it');
  ok(fake.call(TEACHER2, 'POST', '/assessment_classes', { fields: { name: S('Mine'), teacherUid: S(TEACHER.uid) } }).status === 403, 'a class cannot be created in another teacher\'s name');
  ok(fake.call(TEACHER2, 'GET', `/assessment_classes/${cid}`).status === 403, 'another teacher cannot open the class');
  ok(fake.call(TEACHER2, 'GET', `/assessment_classes/${cid}/students`).status === 403, 'nor read its student records');
  ok(fake.call(TEACHER2, 'POST', `/assessment_classes/${cid}/students`, { fields: { name: S('X') } }).status === 403, 'nor add to them');
  ok(q(TEACHER2, 'assessment_classes', [['teacherUid', TEACHER.uid]]).status === 403, 'nor list the classes of that teacher');
  ok(fake.call(TEACHER2, 'POST', ':runQuery', { structuredQuery: { from: [{ collectionId: 'assessment_classes' }] } }).status === 403, 'nor list every class');
  ok(fake.call(TEACHER2, 'PATCH', `/assessment_classes/${cid}?updateMask.fieldPaths=teacherUid`, { fields: { teacherUid: S(TEACHER2.uid) } }).status === 403, 'nor take the class over');
  const own = q(TEACHER2, 'assessment_classes', [['teacherUid', TEACHER2.uid]]);
  ok(own.status === 200 && !own.json.some((r) => r.document), 'their own list is simply empty');
  ok(q(TEACHER, 'assessment_classes', [['teacherUid', TEACHER.uid]]).json.filter((r) => r.document).length === 1, 'the owner still sees the class');
  ok(fake.call(TEACHER, 'GET', `/assessment_classes/${cid}/students`).json.documents.length === 1, 'and its records');
  ok(q(TEACHER2, 'roster_seats', [['classId', 'c1']]).status === 403, 'another teacher cannot list the seats of a class');
  ok(q(TEACHER2, 'roster_seats', [['classId', 'c1'], ['teacherUid', TEACHER.uid]]).status === 403, 'not even by naming the owner');
  ok(q(TEACHER, 'roster_seats', [['classId', 'c1'], ['teacherUid', TEACHER.uid]]).json.filter((r) => r.document).length === 2, 'the owner lists their own seats');
  ok(commit(TEACHER2, [{ delete: name('roster_seats/seatA') }]) === 403, 'another teacher cannot withdraw a seat');
  ok(commit(TEACHER2, [{ update: { name: name('roster_seats/seatB'), fields: { claimedBy: N } }, updateMask: { fieldPaths: ['claimedBy'] } }, { delete: name(`student_links/${SOPHEA.uid}`) }]) === 403, 'nor release another teacher\'s student');
  ok(commit(TEACHER2, [{ update: { name: name('roster_seats/seatA'), fields: { teacherUid: S(TEACHER2.uid), classId: S('c9') } }, updateMask: { fieldPaths: ['teacherUid', 'classId'] } }]) === 403, 'nor move a seat into their own class');
  ok(commit(TEACHER2, [{ update: { name: name('roster_seats/seatZ'), fields: seatFields() }, currentDocument: { exists: false } }]) === 403, 'nor publish a seat under another teacher\'s name');
  ok(fake.link(SOPHEA.uid) !== null, 'the student of the first teacher is untouched');
}

// ── 2 · the whole path in browsers ──────────────────────────────────────────
async function openWorkspace(page) {
  await page.goto(`${page.base}/#daily-assessment`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open the assessment workspace' }).click({ timeout: 20000 });
  await page.getByTestId('assessment-workspace').waitFor({ timeout: 20000 });
}
const rowStates = (page) => page.$$eval('[data-testid="registration-row"]', (rows) => rows.map((r) => `${r.cells[0].textContent.trim()}=${r.dataset.state}`));
async function openStudent(page) {
  await page.goto(`${page.base}/#live-results`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-testid="student-registration"][data-state]').waitFor({ timeout: 20000 });
}
const cardState = (page) => page.getAttribute('[data-testid="student-registration"][data-state]', 'data-state');
async function register(page, id, name) {
  await page.fill('#reg-school-id', id);
  await page.fill('#reg-full-name', name);
  // the button carries a looping glow, which Playwright reads as "still moving"
  await page.getByRole('button', { name: /find my class/i }).click({ force: true });
}

async function walk(browser) {
  const fake = makeFake();

  console.log('\nclasses');
  const T = await openPage(browser, fake, TEACHER);
  await openWorkspace(T);
  await T.getByTestId('kid-classes-open').click();
  await T.getByTestId('kid-classes-list').waitFor();
  ok((await T.$$eval('[data-testid="kid-classes-list"] li', (l) => l.length)) === 14, 'the set-up lists fourteen classes');
  await shot(T, 'kid-classes');
  await T.getByTestId('kid-classes-create').click();
  await waitFor(() => fake.classes().length === 14);
  const classes = fake.classes();
  ok(classes.length === 14, 'fourteen classes are created', classes.length);
  ok(classes.every((c) => c.teacherUid === TEACHER.uid), 'each belongs to the teacher who made them');
  await T.getByTestId('kid-classes-list').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  const options = await T.$$eval('select[aria-label="Select assessment class"] option', (o) => o.map((x) => x.textContent));
  ok(options.length === 14 && options[0] === 'Kid 5 — Morning' && options[1] === 'Kid 5 — Afternoon' && options[13] === 'Kid 11 — Afternoon', 'the class menu runs Kid 5 to Kid 11, morning then afternoon', options);
  await T.getByTestId('kid-classes-open').click();
  await T.getByTestId('kid-classes-list').waitFor();
  ok(await T.getByTestId('kid-classes-create').isDisabled(), 'running the set-up again creates nothing');
  await T.keyboard.press('Escape');
  ok(fake.classes().length === 14, 'still fourteen');

  console.log('\npublish');
  const kid7 = classes.find((c) => c.name === 'Kid 7 — Morning');
  await T.selectOption('select[aria-label="Select assessment class"]', kid7.id);
  await T.getByRole('button', { name: 'Registration', exact: true }).click();
  await T.getByTestId('registration-tab').waitFor();
  await waitFor(async () => !/checking/i.test(await T.getByTestId('registration-headline').textContent()));
  ok(/not open/i.test(await T.getByTestId('registration-headline').textContent()), 'a new class starts with registration not open');
  await T.getByTestId('roster-paste').fill('ID, Name\nS0701, Sok Dara\nS0702\tChan Sophea\nS0703, Lim Vuthy\nKeo Pisey');
  const summary = await T.getByTestId('roster-paste-summary').textContent();
  ok(/3 read/.test(summary) && /1 skipped/.test(summary), 'the paste reads three students and says one line was skipped', summary);
  await T.getByTestId('roster-paste-add').click();
  await waitFor(() => fake.students(kid7.id).length === 3);
  ok(fake.students(kid7.id).length === 3, 'three students are on the class list');
  await waitFor(async () => (await rowStates(T)).length === 3);
  ok((await rowStates(T)).every((s) => s.endsWith('=not-published')), 'they are not open for registration yet', await rowStates(T));
  ok(fake.seats().length === 0, 'nothing is published before the teacher says so');
  await T.getByTestId('registration-publish').click();
  await waitFor(() => fake.seats().length === 3);
  ok(fake.seats().length === 3, 'opening registration publishes three seats', fake.seats().length);
  ok(fake.seats().every((s) => s.className === 'Kid 7 — Morning' && s.classId === kid7.id && s.claimedBy === null && /^[0-9a-f]{64}$/.test(s.key)), 'each seat is free, filed under the class, and keyed by a hash');
  await waitFor(async () => (await rowStates(T)).every((s) => s.endsWith('=open')));
  ok((await rowStates(T)).every((s) => s.endsWith('=open')), 'the teacher sees three students waiting', await rowStates(T));
  ok(/#live-results$/.test(await T.getByTestId('registration-url').textContent()), 'the address to give students is shown');
  await shot(T, 'teacher-open');

  console.log('\nregister');
  const D = await openPage(browser, fake, DARA);
  await openStudent(D);
  ok((await cardState(D)) === 'form', 'a signed-in student is asked for school ID and name');
  await shot(D, 'student-form');
  await register(D, 'S0701', 'Sok Dana');
  await D.getByTestId('student-registration-error').waitFor({ timeout: 10000 });
  ok(/could not find/i.test(await D.getByTestId('student-registration-error').textContent()), 'the wrong name is refused, with a reason');
  ok(fake.link(DARA.uid) === null, 'and nothing is stored');
  await register(D, 's-0701', 'dara SOK');
  await D.locator('[data-testid="student-registration"][data-state="registered"]').waitFor({ timeout: 10000 });
  const card = await D.getByTestId('student-registration').textContent();
  ok(/Kid 7 — Morning/.test(card) && /Sok Dara/.test(card), 'the right ID and name, typed loosely, land in Kid 7 — Morning', card);
  const daraSeat = fake.seats().find((s) => s.schoolId === 'S0701');
  ok(daraSeat.claimedBy === DARA.uid && daraSeat.claimedEmail === DARA.email, 'the seat names the account');
  ok(fake.link(DARA.uid).seatKey === daraSeat.key, 'the account points at the seat');
  await shot(D, 'student-registered');

  const P = await openPage(browser, fake, SOPHEA);
  await openStudent(P);
  await register(P, 'S0701', 'Sok Dara');
  await P.getByTestId('student-registration-error').waitFor({ timeout: 10000 });
  ok(/already registered with another account/i.test(await P.getByTestId('student-registration-error').textContent()), 'a second account cannot take the same student');
  ok(fake.seats().find((s) => s.schoolId === 'S0701').claimedBy === DARA.uid, 'the seat still belongs to the first account');
  await register(P, 'S0702', 'Chan Sophea');
  await P.locator('[data-testid="student-registration"][data-state="registered"]').waitFor({ timeout: 10000 });
  ok(fake.link(SOPHEA.uid) !== null, 'the second student registers as herself');
  await D.reload({ waitUntil: 'domcontentloaded' });
  await D.locator('[data-testid="student-registration"][data-state]').waitFor({ timeout: 20000 });
  ok((await cardState(D)) === 'registered', 'the registration is still there after a reload');

  console.log('\nprivate');
  const T2 = await openPage(browser, fake, TEACHER2);
  await openWorkspace(T2);
  const menu2 = await waitFor(async () => {
    const o = await T2.$$eval('select[aria-label="Select assessment class"] option', (x) => x.map((y) => y.textContent));
    return o.length ? o : null;
  });
  ok(menu2 && menu2.length === 1 && /no classes/i.test(menu2[0]), 'a second teacher sees none of the first teacher\'s classes', menu2);
  ok(!(await T2.getByTestId('assessment-workspace').textContent()).includes('Sok Dara'), 'and none of the students');
  await T2.getByTestId('kid-classes-open').click();
  await T2.getByTestId('kid-classes-list').waitFor();
  await T2.getByTestId('kid-classes-create').click();
  await waitFor(() => fake.classes().length === 28);
  ok(fake.classes().filter((c) => c.teacherUid === TEACHER2.uid).length === 14, 'the second teacher sets up their own fourteen classes');
  await T2.getByTestId('kid-classes-list').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  const menu2b = await T2.$$eval('select[aria-label="Select assessment class"] option', (x) => x.length);
  ok(menu2b === 14, 'and sees exactly those fourteen', menu2b);
  const kid7b = fake.classes().find((c) => c.name === 'Kid 7 — Morning' && c.teacherUid === TEACHER2.uid);
  await T2.selectOption('select[aria-label="Select assessment class"]', kid7b.id);
  await T2.getByRole('button', { name: 'Registration', exact: true }).click();
  await T2.getByTestId('registration-tab').waitFor();
  await T2.getByTestId('roster-paste').fill('S0701, Sok Dara\nS0799, Pich Ratana');
  await T2.getByTestId('roster-paste-add').click();
  await waitFor(async () => (await rowStates(T2)).length === 2);
  const states2 = await waitFor(async () => {
    const st = await rowStates(T2);
    return st.includes('Sok Dara=problem') ? st : null;
  });
  ok(!!states2 && states2.includes('Pich Ratana=not-published'), 'a student who is on the first teacher\'s list is flagged, not taken over', states2 || (await rowStates(T2)));
  ok(/another teacher/i.test(await T2.getByTestId('registration-tab').textContent()), 'and the reason is given');
  await T2.getByTestId('registration-publish').click();
  await waitFor(() => fake.seats().some((x) => x.schoolId === 'S0799'));
  ok(fake.seats().filter((x) => x.teacherUid === TEACHER2.uid).length === 1, 'only the second teacher\'s own student is published');
  ok(fake.seats().find((x) => x.schoolId === 'S0701').teacherUid === TEACHER.uid && fake.seats().find((x) => x.schoolId === 'S0701').claimedBy === DARA.uid, 'the first teacher\'s student keeps seat and account');
  ok(!(await T2.getByTestId('registration-tab').textContent()).includes(DARA.email), 'the second teacher is not shown the account behind it');

  console.log('\nteacher');
  await T.getByRole('button', { name: 'Refresh registration' }).click();
  await waitFor(async () => (await rowStates(T)).filter((s) => s.endsWith('=registered')).length === 2);
  const states = await rowStates(T);
  ok(states.filter((s) => s.endsWith('=registered')).length === 2 && states.includes('Lim Vuthy=open'), 'the teacher sees two registered and one waiting', states);
  ok(/2 registered · 1 waiting/.test(await T.getByTestId('registration-counts').textContent()), 'and the count says so');
  ok((await T.getByTestId('registration-tab').textContent()).includes(DARA.email), 'with the account each one used');
  await shot(T, 'teacher-registered');

  // the teacher corrects a spelling in the Roster tab
  const daraRow = fake.students(kid7.id).find((s) => s.schoolId === 'S0701');
  fake.docs.get(daraRow.path).fields.name = { stringValue: 'Sok Darra' };
  await waitFor(async () => /Update registration \(\d+\)/.test(await T.getByTestId('registration-publish').textContent()), 30000);
  ok(/Update registration \(\d+\)/.test(await T.getByTestId('registration-publish').textContent()), 'a corrected spelling is offered as an update');
  await T.getByTestId('registration-publish').click();
  await waitFor(() => fake.seats().some((s) => s.studentName === 'Sok Darra'));
  const moved = fake.seats().find((s) => s.studentName === 'Sok Darra');
  ok(!!moved && moved.claimedBy === DARA.uid && moved.key !== daraSeat.key, 'the corrected seat keeps the account');
  ok(!fake.seats().some((s) => s.key === daraSeat.key), 'the old seat is gone');
  ok(fake.link(DARA.uid).seatKey === (moved && moved.key), 'the account follows to the corrected seat');
  ok(fake.seats().filter((x) => x.teacherUid === TEACHER.uid).length === 3, 'still three seats', fake.seats().length);
  await D.reload({ waitUntil: 'domcontentloaded' });
  await D.locator('[data-testid="student-registration"][data-state]').waitFor({ timeout: 20000 });
  ok((await cardState(D)) === 'registered' && /Sok Darra/.test(await D.getByTestId('student-registration').textContent()), 'the student is still registered, under the corrected name');

  // release
  await waitFor(async () => (await rowStates(T)).includes('Chan Sophea=registered'));
  await T.locator('[data-testid="registration-row"]', { hasText: 'Chan Sophea' }).getByRole('button', { name: /release/i }).click();
  await waitFor(() => fake.link(SOPHEA.uid) === null);
  ok(T.asked.length === 1 && T.asked[0].includes(SOPHEA.email), 'the teacher is asked first, with the account named', T.asked);
  ok(fake.link(SOPHEA.uid) === null && fake.seats().find((s) => s.schoolId === 'S0702').claimedBy === null, 'release frees the seat and unlinks the account');
  await P.reload({ waitUntil: 'domcontentloaded' });
  await P.locator('[data-testid="student-registration"][data-state]').waitFor({ timeout: 20000 });
  ok((await cardState(P)) === 'form', 'the released student is asked to register again');

  // close
  await waitFor(async () => !(await T.getByRole('button', { name: 'Close registration' }).isDisabled()));
  await T.getByRole('button', { name: 'Close registration' }).click();
  const mine = () => fake.seats().filter((x) => x.teacherUid === TEACHER.uid);
  await waitFor(() => mine().length === 1);
  ok(mine().length === 1 && mine()[0].claimedBy === DARA.uid, 'closing withdraws the open seats and keeps the registered student', mine().map((x) => x.studentName));
  ok(fake.seats().some((x) => x.teacherUid === TEACHER2.uid), 'and leaves the other teacher\'s seats alone');
  await register(P, 'S0702', 'Chan Sophea');
  await P.getByTestId('student-registration-error').waitFor({ timeout: 10000 });
  ok(/could not find/i.test(await P.getByTestId('student-registration-error').textContent()), 'after closing, a late student is told to ask the teacher');

  ok(fake.log.length === 0, 'the app never sent a write the rules refuse', fake.log);
  for (const [who, page] of [['teacher', T], ['teacher 2', T2], ['student 1', D], ['student 2', P]]) ok(page.errors.length === 0, `no page errors (${who})`, page.errors);

  console.log('\nphone');
  const fake2 = makeFake();
  const Tp = await openPage(browser, fake2, TEACHER, { w: 393, h: 852 });
  await openWorkspace(Tp);
  await Tp.getByTestId('kid-classes-open').click();
  await Tp.getByTestId('kid-classes-list').waitFor();
  ok((await sideways(Tp)) <= 1, 'no sideways scroll with the set-up open', await sideways(Tp));
  await shot(Tp, 'phone-kid-classes');
  await Tp.getByTestId('kid-classes-create').click();
  await waitFor(() => fake2.classes().length === 14);
  await Tp.getByTestId('kid-classes-list').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  await Tp.getByRole('button', { name: 'Registration', exact: true }).click();
  await Tp.getByTestId('registration-tab').waitFor();
  await Tp.getByTestId('roster-paste').fill('S0501, Sok Dara\nS0502, Chan Sophea');
  await Tp.getByTestId('roster-paste-add').click();
  await waitFor(async () => (await rowStates(Tp)).length === 2);
  await Tp.getByTestId('registration-publish').click();
  await waitFor(() => fake2.seats().length === 2);
  ok(fake2.seats().length === 2 && fake2.seats()[0].className === 'Kid 5 — Morning', 'the teacher can publish from a phone');
  ok((await sideways(Tp)) <= 1, 'no sideways scroll on the registration tab', await sideways(Tp));
  await Tp.evaluate(() => document.querySelector('[data-testid="registration-tab"]').scrollIntoView({ block: 'start' }));
  await shot(Tp, 'phone-teacher');
  const Sp = await openPage(browser, fake2, DARA, { w: 393, h: 852 });
  await openStudent(Sp);
  ok((await sideways(Sp)) <= 1, 'no sideways scroll on the student card', await sideways(Sp));
  await Sp.evaluate(() => document.querySelector('[data-testid="student-registration"]').scrollIntoView({ block: 'center' }));
  await shot(Sp, 'phone-student-form');
  await register(Sp, 'S0501', 'Dara Sok');
  await Sp.locator('[data-testid="student-registration"][data-state="registered"]').waitFor({ timeout: 10000 });
  ok(fake2.link(DARA.uid) !== null, 'the student can register from a phone');
  ok((await sideways(Sp)) <= 1, 'no sideways scroll once registered', await sideways(Sp));
  await shot(Sp, 'phone-student-registered');
  ok(Tp.errors.length === 0 && Sp.errors.length === 0, 'no page errors on the phone', [...Tp.errors, ...Sp.errors]);
}

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`No build in ${DIST}. Run "npm run build" first.`);
  process.exit(2);
}
checkRules();
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--no-sandbox', '--disable-gpu', '--single-process', '--no-zygote'],
});
try {
  await walk(browser);
} catch (e) {
  ok(false, 'the walk ran to the end', String(e.stack || e).slice(0, 600));
} finally {
  await browser.close().catch(() => {});
  closeServers();
}
console.log(`\n${pass} passed, ${fail} failed`);
for (const f of fails) console.log('  FAIL ' + f);
process.exit(fail ? 1 : 0);
