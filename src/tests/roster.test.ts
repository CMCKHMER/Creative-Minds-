// School roster + registration (Nov 2026).
//
// Owner brief: the site becomes the school's learning management system, and
// every score has to land on one student record. Step one is tying an account
// to a real student on a class list — Kid 5 to Kid 11, morning and afternoon.
//
// These tests pin the three things that must not drift:
//   · the teacher's device and the student's device derive the SAME seat from
//     an ID and a name, however the student types them;
//   · publishing a class list again never drops a registered student who is
//     still on the list (corrected spelling, class transfer);
//   · the database rules allow a registration only as the atomic pair
//     "seat takes account + account takes seat".
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  compareClassNames, kidClassPresets, missingKidClasses, normalizeSchoolId, normalizeStudentName, parseKidClassName,
  parseRosterPaste, planSeatSync, planSize, registrationState, seatKeyOf,
  type RosterRow, type SeatDoc,
} from '../lib/roster';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('the classes: Kid 5 to Kid 11, morning and afternoon', () => {
  it('is fourteen classes, one per level and shift', () => {
    const all = kidClassPresets();
    expect(all).toHaveLength(14);
    expect(all[0].name).toBe('Kid 5 — Morning');
    expect(all[13].name).toBe('Kid 11 — Afternoon');
    expect(new Set(all.map((c) => c.name)).size).toBe(14);
  });

  it('recognises a class the teacher already made, however it is written', () => {
    expect(parseKidClassName('Kid 7 — Morning')).toEqual({ level: 7, shift: 'Morning' });
    expect(parseKidClassName('kid7 AM')).toEqual({ level: 7, shift: 'Morning' });
    expect(parseKidClassName('KID 07 (afternoon shift)')).toEqual({ level: 7, shift: 'Afternoon' });
    expect(parseKidClassName('Kid 11 p.m.')).toEqual({ level: 11, shift: 'Afternoon' });
    // not one of ours
    expect(parseKidClassName('Grade 7 — Morning')).toBeNull();
    expect(parseKidClassName('Kid 7')).toBeNull();
    // "Kid 1" must not be read out of "Kid 11", and "pm" not out of "campus"
    expect(parseKidClassName('Kid 11 Morning')?.level).toBe(11);
    expect(parseKidClassName('Kid 6 campus')).toBeNull();
  });

  it('lists them Kid 5 to Kid 11, morning before afternoon, other classes after', () => {
    const shuffled = ['Kid 10 — Morning', 'Reading club', 'Kid 5 — Afternoon', 'Kid 11 — Afternoon', 'Kid 5 — Morning', 'Class 10', 'Kid 9 — Afternoon', 'Class 2'];
    expect([...shuffled].sort(compareClassNames)).toEqual([
      'Kid 5 — Morning', 'Kid 5 — Afternoon', 'Kid 9 — Afternoon', 'Kid 10 — Morning', 'Kid 11 — Afternoon',
      'Class 2', 'Class 10', 'Reading club',
    ]);
    expect(kidClassPresets().map((p) => p.name).reverse().sort(compareClassNames)).toEqual(kidClassPresets().map((p) => p.name));
  });

  it('creates only what is missing', () => {
    expect(missingKidClasses([])).toHaveLength(14);
    const missing = missingKidClasses(['Kid 5 — Morning', 'kid 6 pm', 'My other class']);
    expect(missing).toHaveLength(12);
    expect(missing.map((m) => m.name)).not.toContain('Kid 5 — Morning');
    expect(missing.map((m) => m.name)).not.toContain('Kid 6 — Afternoon');
    expect(missingKidClasses(kidClassPresets().map((p) => p.name))).toEqual([]);
  });
});

describe('matching a student to the class list', () => {
  it('reads an ID the same way whatever the punctuation', () => {
    expect(normalizeSchoolId('s-0123')).toBe('S0123');
    expect(normalizeSchoolId(' S 0123 ')).toBe('S0123');
    expect(normalizeSchoolId('S0123')).toBe('S0123');
    // a leading zero is part of the ID
    expect(normalizeSchoolId('0123')).not.toBe(normalizeSchoolId('123'));
  });

  it('reads a name the same way in either order, any case, any punctuation', () => {
    const want = normalizeStudentName('Sok Dara');
    for (const typed of ['sok dara', 'DARA SOK', '  Dara   Sok ', 'Sok, Dara', 'Sok-Dara']) {
      expect(normalizeStudentName(typed), typed).toBe(want);
    }
    expect(normalizeStudentName('Sok Dara')).not.toBe(normalizeStudentName('Sok Dana'));
    // Khmer script survives (vowel signs are marks, not letters)
    expect(normalizeStudentName('សុខ ដារ៉ា')).toBe(normalizeStudentName('ដារ៉ា សុខ'));
    expect(normalizeStudentName('សុខ ដារ៉ា')).not.toBe('');
  });

  it('gives the teacher and the student the same seat key', async () => {
    const teacher = await seatKeyOf('S-0123', 'Sok Dara');
    const student = await seatKeyOf('s0123', 'dara sok');
    expect(teacher).toMatch(/^[0-9a-f]{64}$/);
    expect(student).toBe(teacher);
    // a different ID or a different name is a different seat
    expect(await seatKeyOf('S0124', 'Sok Dara')).not.toBe(teacher);
    expect(await seatKeyOf('S0123', 'Sok Dana')).not.toBe(teacher);
    // the key is not simply the two glued together: "AB" + "C" is not "A" + "BC"
    expect(await seatKeyOf('1', '2 x')).not.toBe(await seatKeyOf('12', 'x'));
  });

  it('gives no key to a row that is missing its ID or its name', async () => {
    expect(await seatKeyOf('', 'Sok Dara')).toBe('');
    expect(await seatKeyOf('S0123', '  ')).toBe('');
    expect(await seatKeyOf('---', 'Sok Dara')).toBe('');
  });
});

describe('pasting a class list', () => {
  it('reads the usual shapes', () => {
    const { rows, skipped } = parseRosterPaste([
      'ID, Name',
      'S0123, Sok Dara',
      'S0124\tChan Sophea',
      'S0125; Lim Vuthy',
      'S0126 Keo Pisey',
      'Meas Bopha, S0127',
      '6, S0128, Heng Sokha',
      '',
    ].join('\n'));
    expect(skipped).toEqual([]);
    expect(rows).toEqual([
      { schoolId: 'S0123', name: 'Sok Dara' },
      { schoolId: 'S0124', name: 'Chan Sophea' },
      { schoolId: 'S0125', name: 'Lim Vuthy' },
      { schoolId: 'S0126', name: 'Keo Pisey' },
      { schoolId: 'S0127', name: 'Meas Bopha' },
      { schoolId: 'S0128', name: 'Heng Sokha' },
    ]);
  });

  it('says why a line was not used instead of guessing', () => {
    const { rows, skipped } = parseRosterPaste('S0123, Sok Dara\nChan Sophea\nS0125\ns-0123, dara sok');
    expect(rows).toHaveLength(1);
    expect(skipped.map((s) => [s.line, s.reason])).toEqual([
      [2, 'no school ID on this line'],
      [3, 'no name on this line'],
      [4, 'the same student is on the list twice'],
    ]);
  });
});

describe('publishing the class list as seats', () => {
  const row = (studentId: string, schoolId: string, name: string, key = `k-${schoolId}`): RosterRow => ({ studentId, schoolId, name, key });
  const seat = (over: Partial<SeatDoc> & { key: string; studentId: string }): SeatDoc => ({
    classId: 'c1', className: 'Kid 7 — Morning', studentName: '', schoolId: '', teacherUid: 't',
    claimedBy: null, claimedEmail: '', claimedName: '', claimedAt: null, ...over,
  });
  const plan = (rows: RosterRow[], classSeats: SeatDoc[] = [], foreignSeats: SeatDoc[] = []) =>
    planSeatSync({ classId: 'c1', className: 'Kid 7 — Morning', rows, classSeats, foreignSeats });

  it('opens a seat for every complete row the first time', () => {
    const p = plan([row('a', 'S1', 'Sok Dara'), row('b', 'S2', 'Chan Sophea')]);
    expect(p.create.map((r) => r.studentId)).toEqual(['a', 'b']);
    expect(planSize(p)).toBe(2);
  });

  it('changes nothing when nothing changed', () => {
    const rows = [row('a', 'S1', 'Sok Dara')];
    const p = plan(rows, [seat({ key: 'k-S1', studentId: 'a', studentName: 'Sok Dara', schoolId: 'S1', claimedBy: 'u1' })]);
    expect(planSize(p)).toBe(0);
    expect(p.unchanged).toBe(1);
  });

  it('holds back rows without an ID or a name, and duplicates, and says which', () => {
    const p = plan([
      row('a', 'S1', 'Sok Dara'),
      row('b', '', 'Chan Sophea', ''),
      row('c', 'S3', '', ''),
      row('d', 'S1', 'Dara Sok', 'k-S1'),
      row('e', '', '', ''), // an unfilled line of the table: not a problem
    ]);
    expect(p.create.map((r) => r.studentId)).toEqual(['a']);
    expect(p.problems.map((x) => [x.row.studentId, x.reason])).toEqual([['b', 'no-id'], ['c', 'no-name'], ['d', 'duplicate']]);
  });

  it('keeps the account when the teacher corrects a spelling', () => {
    // the row is the same student (same row id) but its key changed
    const old = seat({ key: 'k-old', studentId: 'a', claimedBy: 'u1', claimedEmail: 'dara@example.com' });
    const p = plan([row('a', 'S1', 'Sok Dara', 'k-new')], [old]);
    expect(p.rekey).toEqual([{ row: row('a', 'S1', 'Sok Dara', 'k-new'), from: old }]);
    expect(p.remove).toEqual([]);
    expect(p.create).toEqual([]);
    // new seat + old seat removed + the account re-pointed
    expect(planSize(p)).toBe(3);
  });

  it('moves a transferred student here, account and all', () => {
    const there = seat({ key: 'k-S1', studentId: 'old-row', classId: 'c2', className: 'Kid 7 — Afternoon', claimedBy: 'u1' });
    const p = plan([row('a', 'S1', 'Sok Dara')], [], [there]);
    expect(p.adopt).toEqual([{ row: row('a', 'S1', 'Sok Dara'), from: there }]);
    expect(p.create).toEqual([]);
  });

  it('withdraws the seat of a student who left the list', () => {
    const gone = seat({ key: 'k-S9', studentId: 'z', claimedBy: 'u9' });
    const p = plan([row('a', 'S1', 'Sok Dara')], [gone]);
    expect(p.remove).toEqual([gone]);
    // the seat and the account's link both go
    expect(planSize(p)).toBe(1 + 2);
  });

  it('does not hand one student\'s account to another when two rows swap', () => {
    // row a took the key row b used to have; b's old seat must not be re-keyed onto a
    const seatB = seat({ key: 'k-S2', studentId: 'b', claimedBy: 'uB' });
    const p = plan([row('a', 'S2', 'Chan Sophea', 'k-S2'), row('b', 'S7', 'Chan Sophea', 'k-S7')], [seatB]);
    expect(p.update.map((r) => r.studentId)).toEqual(['a']);
    expect(p.rekey).toEqual([]);
    expect(p.create.map((r) => r.studentId)).toEqual(['b']);
  });

  it('labels each line for the teacher', () => {
    const r = row('a', 'S1', 'Sok Dara');
    expect(registrationState(r, undefined)).toBe('not-published');
    expect(registrationState(r, seat({ key: 'k-S1', studentId: 'a' }))).toBe('open');
    expect(registrationState(r, seat({ key: 'k-S1', studentId: 'a', claimedBy: 'u1' }))).toBe('registered');
    expect(registrationState(row('b', '', 'X', ''), undefined)).toBe('problem');
    expect(registrationState(r, undefined, 'duplicate')).toBe('problem');
  });
});

describe('the database rules for registration', () => {
  const rules = read('firestore.rules');
  const seats = rules.slice(rules.indexOf('match /roster_seats/{seatKey}'), rules.indexOf('match /student_links/{uid}'));
  const links = rules.slice(rules.indexOf('match /student_links/{uid}'), rules.indexOf('Private bi-weekly test system'));

  it('lets a student fetch a seat but never browse the list', () => {
    expect(seats).toContain('allow get: if isVerifiedUser();');
    expect(seats).toContain('allow list: if isCmcTeacher();');
    expect(seats).not.toMatch(/allow (read|list): if (true|isVerifiedUser\(\))/);
  });

  it('lets a student take only a free seat, in their own name, touching nothing else', () => {
    expect(seats).toContain('resource.data.claimedBy == null');
    expect(seats).toContain('request.resource.data.claimedBy == request.auth.uid');
    expect(seats).toContain(".hasOnly(['claimedBy', 'claimedEmail', 'claimedName', 'claimedAt'])");
  });

  it('ties the two halves of a registration together', () => {
    // the seat write needs the account's link to point at it when the commit lands…
    expect(seats).toContain('getAfter(/databases/$(database)/documents/student_links/$(request.auth.uid)).data.seatKey == seatKey');
    // …and the link write needs the seat to name the account
    expect(links).toContain('getAfter(/databases/$(database)/documents/roster_seats/$(request.resource.data.seatKey)).data.claimedBy == uid');
  });

  it('gives an account one seat for good: only a teacher can change or remove a link', () => {
    expect(links).toContain('allow update, delete: if isCmcTeacher();');
    expect(links).toContain("request.resource.data.keys().hasOnly(['uid', 'seatKey', 'linkedAt'])");
    expect(links).toContain('request.auth.uid == uid');
    expect(links).not.toMatch(/allow (update|delete)[^;]*request\.auth\.uid == uid/);
  });

  it('writes exactly the fields the rules allow', () => {
    const db = read('src/lib/rosterDb.ts');
    expect(db).toContain("updateMask: { fieldPaths: ['claimedBy', 'claimedEmail', 'claimedName', 'claimedAt'] }");
    expect(db).toContain('encodeFields({ uid: input.uid, seatKey: key, linkedAt: now })');
    // the claim and the link travel in one commit
    expect(db).toMatch(/writes\.push\(\{\s*update: \{ name: docName\(`student_links\/\$\{input\.uid\}`\)[\s\S]{0,200}currentDocument: \{ exists: false \}/);
  });
});

describe('where registration shows up', () => {
  it('is a tab of the assessment workspace, with the Kid 5–11 set-up next to New class', () => {
    const ws = read('src/components/AssessmentWorkspace.tsx');
    expect(ws).toContain("{ key: 'registration', label: 'Registration', icon: UserCheck }");
    expect(ws).toContain('<RegistrationTab');
    expect(ws).toContain('<KidClassesModal');
    expect(ws).toContain('Kid 5–11 classes');
  });

  it('is offered to a signed-in student on the Live Class Results page', () => {
    const dash = read('src/components/FirebaseDashboard.tsx');
    expect(dash).toContain('<StudentRegistrationCard');
    expect(dash).toMatch(/isStudent && studentUid && \(\s*<StudentRegistrationCard/);
  });
});
