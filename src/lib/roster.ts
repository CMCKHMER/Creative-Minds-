// School roster + registration — the pure rules (no network, no DOM).
//
// Owner brief (Nov 2026): the site is turning into the school's learning
// management system, and every score, homework and attendance mark has to
// land on ONE student record. That only works if an account is tied to a
// real student on a class list. The classes for now are Kid 5 to Kid 11,
// each with a morning and an afternoon shift.
//
// How registration works:
//   1. The teacher keeps the class list (school ID + name) in the Daily
//      Assessment workspace and opens registration for the class.
//   2. That publishes one "seat" per student. A seat's document id is a hash
//      of the school ID and the name, so a seat can be looked up only by
//      somebody who knows both; the class list itself stays teacher-only.
//   3. A signed-in student types their school ID and full name. If a seat
//      matches and nobody has taken it, the account is linked to it — one
//      account per student, one student per account (firestore.rules).
//
// This file holds everything that must give the same answer on the teacher's
// device and on the student's: how an ID and a name are normalised, how the
// seat key is derived, how a pasted list is read, and what has to change when
// the class list is published again.

export const KID_LEVELS = [5, 6, 7, 8, 9, 10, 11] as const;
export const KID_SHIFTS = ['Morning', 'Afternoon'] as const;
export type KidShift = (typeof KID_SHIFTS)[number];

export interface KidClassPreset {
  level: number;
  shift: KidShift;
  /** The class name as it is created, e.g. "Kid 7 — Morning". */
  name: string;
}

/** The fourteen classes: Kid 5 to Kid 11, morning and afternoon. */
export function kidClassPresets(): KidClassPreset[] {
  const out: KidClassPreset[] = [];
  for (const level of KID_LEVELS) {
    for (const shift of KID_SHIFTS) out.push({ level, shift, name: `Kid ${level} — ${shift}` });
  }
  return out;
}

/** Read "Kid 7 — Morning", "kid7 AM", "KID 07 (afternoon shift)" … as a level and a shift. */
export function parseKidClassName(name: string): { level: number; shift: KidShift } | null {
  const text = String(name ?? '').normalize('NFKC').toLowerCase();
  const level = /\bkid\s*0?(\d{1,2})\b/.exec(text);
  if (!level) return null;
  const shift: KidShift | null = /\b(morning|a\.?m\.?)(?![a-z])/.test(text)
    ? 'Morning'
    : /\b(afternoon|p\.?m\.?)(?![a-z])/.test(text)
      ? 'Afternoon'
      : null;
  if (!shift) return null;
  return { level: Number(level[1]), shift };
}

/** The preset classes that do not exist yet, judged by name. */
export function missingKidClasses(existingNames: string[]): KidClassPreset[] {
  const have = new Set(
    existingNames
      .map(parseKidClassName)
      .filter((v): v is { level: number; shift: KidShift } => v !== null)
      .map((v) => `${v.level}|${v.shift}`),
  );
  return kidClassPresets().filter((p) => !have.has(`${p.level}|${p.shift}`));
}

/** A school ID as it is compared: letters and digits only, upper case.
 *  "s-0123", "S 0123" and "S0123" are the same ID. */
export function normalizeSchoolId(raw: string): string {
  return String(raw ?? '').normalize('NFKC').toUpperCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/** A name as it is compared: lower case, punctuation dropped, and the words
 *  SORTED — so "Sok Dara", "dara sok" and "Sok, Dara" are the same student.
 *  Family-name-first and given-name-first are both common on class lists. */
export function normalizeStudentName(raw: string): string {
  return String(raw ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean)
    .sort()
    .join(' ');
}

const SEAT_KEY_PREFIX = 'cmc-seat-v1';

/** The seat document id for a student: SHA-256 of the normalised ID and name.
 *  Returns '' when either part is missing — such a row cannot be registered. */
export async function seatKeyOf(schoolId: string, name: string): Promise<string> {
  const id = normalizeSchoolId(schoolId);
  const who = normalizeStudentName(name);
  if (!id || !who) return '';
  const bytes = new TextEncoder().encode(`${SEAT_KEY_PREFIX}|${id}|${who}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── a pasted class list ─────────────────────────────────────────────────

export interface PastedRow { schoolId: string; name: string }
export interface PasteResult {
  rows: PastedRow[];
  /** Lines that could not be used, with the reason in plain words. */
  skipped: Array<{ line: number; text: string; reason: string }>;
}

const HEADER_WORDS = /^(no\.?|#|id|student id|school id|name|student|student name|full name)$/i;

/**
 * Read a class list pasted from a spreadsheet or typed by hand: one student
 * per line, the school ID and the name separated by a tab, a comma or a
 * semicolon — or just a space when the ID comes first ("S0123 Sok Dara").
 * The ID is the cell that contains a digit, so "Sok Dara, S0123" works too,
 * and a leading row number ("1, S0123, Sok Dara") is ignored.
 */
export function parseRosterPaste(text: string): PasteResult {
  const rows: PastedRow[] = [];
  const skipped: PasteResult['skipped'] = [];
  const seen = new Set<string>();
  const lines = String(text ?? '').split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const skip = (reason: string) => skipped.push({ line: index + 1, text: line, reason });
    let cells = line.split(/[\t,;]+/).map((c) => c.trim()).filter(Boolean);
    if (cells.length === 1) {
      // "S0123 Sok Dara": split on the first space when the first word carries a digit
      const m = /^(\S*\d\S*)\s+(.+)$/.exec(line);
      if (m) cells = [m[1], m[2]];
    }
    if (cells.every((c) => HEADER_WORDS.test(c))) return; // a header row
    const hasDigit = (c: string) => /\d/.test(c);
    if (cells.length >= 3 && /^\d{1,3}\.?$/.test(cells[0]) && cells.slice(1).some(hasDigit)) cells = cells.slice(1);
    if (cells.length < 2) { skip(hasDigit(line) ? 'no name on this line' : 'no school ID on this line'); return; }
    const idAt = cells.findIndex(hasDigit);
    const at = idAt === -1 ? 0 : idAt;
    const schoolId = cells[at];
    const name = cells.filter((_, i) => i !== at).join(' ').replace(/\s+/g, ' ').trim();
    if (!normalizeSchoolId(schoolId)) { skip('no school ID on this line'); return; }
    if (!normalizeStudentName(name)) { skip('no name on this line'); return; }
    const key = `${normalizeSchoolId(schoolId)}|${normalizeStudentName(name)}`;
    if (seen.has(key)) { skip('the same student is on the list twice'); return; }
    seen.add(key);
    rows.push({ schoolId, name });
  });
  return { rows, skipped };
}

// ── publishing the class list as seats ──────────────────────────────────

/** A student row of the class list, with its seat key already derived. */
export interface RosterRow {
  studentId: string;
  name: string;
  schoolId: string;
  /** '' when the row has no ID or no name yet. */
  key: string;
}

export interface SeatDoc {
  key: string;
  classId: string;
  studentId: string;
  className: string;
  studentName: string;
  schoolId: string;
  teacherUid: string;
  /** uid of the account registered as this student, or null. */
  claimedBy: string | null;
  claimedEmail: string;
  claimedName: string;
  claimedAt: number | null;
  /** When the database last changed this seat. Sent back with a withdrawal,
   *  so a seat is only withdrawn if nobody took it in the meantime. */
  updateTime?: string;
}

export type SeatProblem = 'no-id' | 'no-name' | 'duplicate';

export interface SeatPlan {
  /** New students: a seat is created. */
  create: RosterRow[];
  /** Same student, details changed (class renamed, name re-cased …). */
  update: RosterRow[];
  /** The student has a seat under ANOTHER class (transferred): it moves here and keeps its account. */
  adopt: Array<{ row: RosterRow; from: SeatDoc }>;
  /** The ID or the name was corrected: the seat moves to the new key and keeps its account. */
  rekey: Array<{ row: RosterRow; from: SeatDoc }>;
  /** Seats of this class with no student behind them any more. */
  remove: SeatDoc[];
  /** Rows that cannot be registered yet, and why. */
  problems: Array<{ row: RosterRow; reason: SeatProblem }>;
  unchanged: number;
}

/**
 * Work out what has to change so the published seats match the class list.
 * `classSeats` are the seats currently filed under this class; `foreignSeats`
 * are seats that already exist under one of this list's keys in another class.
 * Pure: the caller turns the plan into writes.
 */
export function planSeatSync(input: {
  classId: string;
  className: string;
  rows: RosterRow[];
  classSeats: SeatDoc[];
  foreignSeats: SeatDoc[];
}): SeatPlan {
  const { classId, className, rows, classSeats, foreignSeats } = input;
  const plan: SeatPlan = { create: [], update: [], adopt: [], rekey: [], remove: [], problems: [], unchanged: 0 };
  const byKey = new Map(classSeats.map((s) => [s.key, s]));
  const byStudent = new Map(classSeats.map((s) => [s.studentId, s]));
  const foreign = new Map(foreignSeats.filter((s) => s.classId !== classId).map((s) => [s.key, s]));
  const wanted = new Set<string>();
  const usable: RosterRow[] = [];

  for (const row of rows) {
    if (!row.key) {
      // a completely blank row is just an unfilled line of the table
      if (!normalizeSchoolId(row.schoolId) && !normalizeStudentName(row.name)) continue;
      plan.problems.push({ row, reason: normalizeSchoolId(row.schoolId) ? 'no-name' : 'no-id' });
      continue;
    }
    if (wanted.has(row.key)) { plan.problems.push({ row, reason: 'duplicate' }); continue; }
    wanted.add(row.key);
    usable.push(row);
  }

  const kept = new Set<string>(); // keys of class seats that stay or move
  for (const row of usable) {
    const here = byKey.get(row.key);
    if (here) {
      kept.add(here.key);
      const same = here.studentId === row.studentId && here.studentName === row.name
        && here.schoolId === row.schoolId && here.className === className;
      if (same) plan.unchanged++; else plan.update.push(row);
      continue;
    }
    const elsewhere = foreign.get(row.key);
    if (elsewhere) { plan.adopt.push({ row, from: elsewhere }); continue; }
    const old = byStudent.get(row.studentId);
    if (old && !wanted.has(old.key) && !kept.has(old.key)) {
      kept.add(old.key);
      plan.rekey.push({ row, from: old });
      continue;
    }
    plan.create.push(row);
  }
  for (const seat of classSeats) if (!kept.has(seat.key)) plan.remove.push(seat);
  return plan;
}

/** How many writes a plan needs — a commit takes at most 500. */
export function planSize(plan: SeatPlan): number {
  return plan.create.length + plan.update.length + plan.adopt.length
    + plan.rekey.reduce((n, r) => n + 2 + (r.from.claimedBy ? 1 : 0), 0)
    + plan.remove.reduce((n, s) => n + 1 + (s.claimedBy ? 1 : 0), 0);
}

export type RegistrationState = 'registered' | 'open' | 'not-published' | 'problem';

/** One line of the teacher's registration table. */
export function registrationState(row: RosterRow, seat: SeatDoc | undefined, problem?: SeatProblem): RegistrationState {
  if (problem || !row.key) return 'problem';
  if (!seat) return 'not-published';
  return seat.claimedBy ? 'registered' : 'open';
}

/** Order for a class menu: Kid 5 to Kid 11, morning before afternoon; any
 *  other class after them, by name ("Class 2" before "Class 10"). */
export function compareClassNames(a: string, b: string): number {
  const ka = parseKidClassName(a);
  const kb = parseKidClassName(b);
  if (ka && kb) {
    return ka.level - kb.level
      || KID_SHIFTS.indexOf(ka.shift) - KID_SHIFTS.indexOf(kb.shift)
      || a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  }
  if (ka) return -1;
  if (kb) return 1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/** Where a student goes to register: the Live Class Results page. */
export function registrationUrl(): string {
  if (typeof window === 'undefined') return '#live-results';
  return `${window.location.origin}${window.location.pathname}#live-results`;
}
