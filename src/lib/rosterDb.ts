// School roster + registration — Firestore data layer (REST transport, the
// same one the Daily Assessment workspace uses; see assessmentDb.ts for why).
//
//   roster_seats/{seatKey}
//       one per student on a published class list. The id is a hash of the
//       school ID and the name (roster.ts seatKeyOf), so a student can fetch
//       their own seat and nobody can browse the list.
//       classId, studentId, className, studentName, schoolId, teacherUid,
//       claimedBy (uid | null), claimedEmail, claimedName, claimedAt, updatedAt
//   student_links/{uid}
//       which seat an account is registered as: { uid, seatKey, linkedAt }.
//       Everything else (class, name) is read through the seat, so a class
//       transfer never leaves a stale copy behind.
//
// A registration is ONE atomic commit of two writes — the seat takes the
// account, the account takes the seat — and firestore.rules checks each write
// against the other (getAfter). So an account can hold one seat, a seat one
// account, and neither half can exist alone.

import { encodeFields, fsCall, RestError } from './assessmentDb';
import { getProjectId } from './firebaseAuth';
import { planSeatSync, planSize, seatKeyOf, type RosterRow, type SeatDoc, type SeatPlan } from './roster';

type Fields = Record<string, unknown>;

const docName = (path: string): string =>
  `projects/${getProjectId()}/databases/(default)/documents/${path}`;

const str = (f: Fields, k: string): string => {
  const v = f[k] as Record<string, unknown> | undefined;
  return v && typeof v.stringValue === 'string' ? v.stringValue : '';
};
const time = (f: Fields, k: string): number | null => {
  const v = f[k] as Record<string, unknown> | undefined;
  const iso = v && typeof v.timestampValue === 'string' ? v.timestampValue
    : v && typeof v.stringValue === 'string' ? v.stringValue : '';
  return iso ? Date.parse(iso) || null : null;
};

function toSeat(name: string, f: Fields, updateTime?: string): SeatDoc {
  return {
    updateTime,
    key: name.split('/').pop() ?? '',
    classId: str(f, 'classId'),
    studentId: str(f, 'studentId'),
    className: str(f, 'className'),
    studentName: str(f, 'studentName'),
    schoolId: str(f, 'schoolId'),
    teacherUid: str(f, 'teacherUid'),
    claimedBy: str(f, 'claimedBy') || null,
    claimedEmail: str(f, 'claimedEmail'),
    claimedName: str(f, 'claimedName'),
    claimedAt: time(f, 'claimedAt'),
  };
}

/** GET one document; null when it does not exist. */
async function getDoc(path: string): Promise<{ name: string; fields: Fields; updateTime?: string } | null> {
  try {
    const d = await fsCall<{ name: string; fields?: Fields; updateTime?: string }>(`/${path}`);
    return { name: d.name, fields: d.fields ?? {}, updateTime: d.updateTime };
  } catch (e) {
    if (e instanceof RestError && e.status === 404) return null;
    throw e;
  }
}

async function commit(writes: unknown[]): Promise<void> {
  // a commit takes at most 500 writes; stay well under it
  for (let i = 0; i < writes.length; i += 200) {
    try {
      await fsCall(':commit', { method: 'POST', body: JSON.stringify({ writes: writes.slice(i, i + 200) }) });
    } catch (e) {
      // a precondition did not hold: the list moved under us (a student registered a moment ago)
      if (e instanceof RestError && [400, 404, 409].includes(e.status) && /precondition|already.?exists|not.?found|aborted/i.test(e.message)) {
        throw new RestError(409, 'The registration list changed while this was being saved — a student may have just registered. Nothing was lost: press Refresh and try again.');
      }
      throw e;
    }
  }
}

/** Withdraw a seat nobody holds — refused by the database if it changed since it was read. */
const withdraw = (seat: SeatDoc) => ({
  delete: docName(`roster_seats/${seat.key}`),
  currentDocument: seat.updateTime ? { updateTime: seat.updateTime } : { exists: true },
});

// ── teacher side ────────────────────────────────────────────────────────

/** Every seat filed under a class. Teachers only (the rules refuse a student). */
export async function listClassSeats(classId: string): Promise<SeatDoc[]> {
  const rows = await fsCall<unknown[]>(':runQuery', {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'roster_seats' }],
        where: { fieldFilter: { field: { fieldPath: 'classId' }, op: 'EQUAL', value: { stringValue: classId } } },
        limit: 500,
      },
    }),
  });
  return (Array.isArray(rows) ? rows : [])
    .map((r) => (r as { document?: { name: string; fields?: Fields; updateTime?: string } }).document)
    .filter((d): d is { name: string; fields?: Fields; updateTime?: string } => !!d)
    .map((d) => toSeat(d.name, d.fields ?? {}, d.updateTime));
}

/** Seats that already exist under these keys (in whatever class). */
async function getSeatsByKey(keys: string[]): Promise<SeatDoc[]> {
  const out: SeatDoc[] = [];
  for (let i = 0; i < keys.length; i += 100) {
    const found = await fsCall<unknown[]>(':batchGet', {
      method: 'POST',
      body: JSON.stringify({ documents: keys.slice(i, i + 100).map((k) => docName(`roster_seats/${k}`)) }),
    });
    for (const r of Array.isArray(found) ? found : []) {
      const d = (r as { found?: { name: string; fields?: Fields; updateTime?: string } }).found;
      if (d) out.push(toSeat(d.name, d.fields ?? {}, d.updateTime));
    }
  }
  return out;
}

/** Derive the seat key of every row of a class list. */
export async function keyRoster(students: Array<{ id: string; name: string; schoolId: string }>): Promise<RosterRow[]> {
  return Promise.all(students.map(async (s) => ({
    studentId: s.id, name: s.name, schoolId: s.schoolId, key: await seatKeyOf(s.schoolId, s.name),
  })));
}

export interface RegistrationSnapshot {
  rows: RosterRow[];
  seats: SeatDoc[];
  plan: SeatPlan;
}

/** Read the published seats of a class and work out what publishing again would change. */
export async function readRegistration(input: {
  classId: string;
  className: string;
  students: Array<{ id: string; name: string; schoolId: string }>;
}): Promise<RegistrationSnapshot> {
  const rows = await keyRoster(input.students);
  const seats = await listClassSeats(input.classId);
  const have = new Set(seats.map((s) => s.key));
  const unknown = [...new Set(rows.map((r) => r.key).filter((k) => k && !have.has(k)))];
  const foreignSeats = unknown.length ? await getSeatsByKey(unknown) : [];
  const plan = planSeatSync({ classId: input.classId, className: input.className, rows, classSeats: seats, foreignSeats });
  return { rows, seats, plan };
}

/** Publish the class list: make the seats match the plan. Claims are kept
 *  wherever the student is still on the list. */
export async function publishRegistration(input: {
  classId: string;
  className: string;
  teacherUid: string;
  plan: SeatPlan;
}): Promise<number> {
  const { classId, className, teacherUid, plan } = input;
  const now = new Date().toISOString();
  const details = (row: RosterRow) => ({
    classId, className, teacherUid, studentId: row.studentId, studentName: row.name, schoolId: row.schoolId, updatedAt: now,
  });
  const detailMask = { fieldPaths: Object.keys(details({ studentId: '', name: '', schoolId: '', key: '' })) };
  const writes: unknown[] = [];
  for (const row of plan.create) {
    writes.push({
      update: { name: docName(`roster_seats/${row.key}`), ...encodeFields({ ...details(row), claimedBy: null, claimedEmail: '', claimedName: '', claimedAt: null }) },
      currentDocument: { exists: false },
    });
  }
  for (const row of [...plan.update, ...plan.adopt.map((a) => a.row)]) {
    writes.push({
      update: { name: docName(`roster_seats/${row.key}`), ...encodeFields(details(row)) },
      updateMask: detailMask,
      currentDocument: { exists: true },
    });
  }
  for (const { row, from } of plan.rekey) {
    // the corrected seat carries the old seat's account over
    writes.push({
      update: {
        name: docName(`roster_seats/${row.key}`),
        ...encodeFields({
          ...details(row), claimedBy: from.claimedBy, claimedEmail: from.claimedEmail, claimedName: from.claimedName,
          claimedAt: from.claimedAt ? new Date(from.claimedAt).toISOString() : null,
        }),
      },
      currentDocument: { exists: false },
    });
    writes.push({ delete: docName(`roster_seats/${from.key}`) });
    if (from.claimedBy) {
      writes.push({
        update: { name: docName(`student_links/${from.claimedBy}`), ...encodeFields({ seatKey: row.key }) },
        updateMask: { fieldPaths: ['seatKey'] },
        currentDocument: { exists: true },
      });
    }
  }
  for (const seat of plan.remove) {
    if (seat.claimedBy) {
      writes.push({ delete: docName(`roster_seats/${seat.key}`) });
      writes.push({ delete: docName(`student_links/${seat.claimedBy}`) });
    } else writes.push(withdraw(seat));
  }
  await commit(writes);
  return planSize(plan);
}

/** Take an account off a seat, so the student (or the right student) can register again. */
export async function releaseSeat(seat: SeatDoc): Promise<void> {
  const writes: unknown[] = [{
    update: { name: docName(`roster_seats/${seat.key}`), ...encodeFields({ claimedBy: null, claimedEmail: '', claimedName: '', claimedAt: null }) },
    updateMask: { fieldPaths: ['claimedBy', 'claimedEmail', 'claimedName', 'claimedAt'] },
    currentDocument: { exists: true },
  }];
  if (seat.claimedBy) writes.push({ delete: docName(`student_links/${seat.claimedBy}`) });
  await commit(writes);
}

/** Close registration: seats nobody has taken are withdrawn; registered students stay. */
export async function closeRegistration(classId: string): Promise<number> {
  // read now, not from the screen: a student may have registered since the last refresh
  const open = (await listClassSeats(classId)).filter((s) => !s.claimedBy);
  await commit(open.map(withdraw));
  return open.length;
}

// ── student side ────────────────────────────────────────────────────────

export interface MyRegistration {
  seatKey: string;
  className: string;
  studentName: string;
  schoolId: string;
}

/** The seat this account is registered as, or null. */
export async function getMyRegistration(uid: string): Promise<MyRegistration | null> {
  const link = await getDoc(`student_links/${uid}`);
  if (!link) return null;
  const seatKey = str(link.fields, 'seatKey');
  if (!seatKey) return null;
  const seat = await getDoc(`roster_seats/${seatKey}`);
  if (!seat) return { seatKey, className: '', studentName: '', schoolId: '' };
  const s = toSeat(seat.name, seat.fields);
  return { seatKey, className: s.className, studentName: s.studentName, schoolId: s.schoolId };
}

export type ClaimResult =
  | { ok: true; registration: MyRegistration }
  | { ok: false; reason: 'not-found' | 'taken' | 'already-registered' | 'incomplete' | 'denied' | 'error'; message: string };

const CLAIM_MESSAGES = {
  'incomplete': 'Type your school ID and your full name.',
  'not-found': 'We could not find that school ID and name on a class list. Check the spelling against your student card, or ask your teacher whether registration is open for your class.',
  'taken': 'This student is already registered with another account. If that was not you, tell your teacher — they can release it.',
  'already-registered': 'This account is already registered as a student. Ask your teacher if the class is wrong.',
  'denied': 'The database refused the registration. Sign out, sign in again and retry; if it keeps failing, tell your teacher.',
  'error': 'The registration could not be saved just now. Check the connection and try again.',
} as const;

const refuse = (reason: keyof typeof CLAIM_MESSAGES): ClaimResult => ({ ok: false, reason, message: CLAIM_MESSAGES[reason] });

/** Register the signed-in account as the student with this school ID and name. */
export async function claimSeat(input: {
  uid: string;
  email: string;
  displayName: string;
  schoolId: string;
  name: string;
}): Promise<ClaimResult> {
  const key = await seatKeyOf(input.schoolId, input.name);
  if (!key) return refuse('incomplete');
  try {
    const found = await getDoc(`roster_seats/${key}`);
    if (!found) return refuse('not-found');
    const seat = toSeat(found.name, found.fields);
    const registration: MyRegistration = { seatKey: key, className: seat.className, studentName: seat.studentName, schoolId: seat.schoolId };
    if (seat.claimedBy && seat.claimedBy !== input.uid) return refuse('taken');
    const mine = await getDoc(`student_links/${input.uid}`);
    if (mine) return str(mine.fields, 'seatKey') === key ? { ok: true, registration } : refuse('already-registered');
    const now = new Date().toISOString();
    const writes: unknown[] = [];
    if (!seat.claimedBy) {
      writes.push({
        update: {
          name: docName(`roster_seats/${key}`),
          ...encodeFields({ claimedBy: input.uid, claimedEmail: input.email, claimedName: input.displayName, claimedAt: now }),
        },
        updateMask: { fieldPaths: ['claimedBy', 'claimedEmail', 'claimedName', 'claimedAt'] },
        currentDocument: { exists: true },
      });
    }
    writes.push({
      update: { name: docName(`student_links/${input.uid}`), ...encodeFields({ uid: input.uid, seatKey: key, linkedAt: now }) },
      currentDocument: { exists: false },
    });
    try {
      await commit(writes);
    } catch (e) {
      // somebody else may have taken the seat between the read and the write
      const again = await getDoc(`roster_seats/${key}`).catch(() => null);
      const holder = again ? toSeat(again.name, again.fields).claimedBy : null;
      if (holder && holder !== input.uid) return refuse('taken');
      if (e instanceof RestError && (e.status === 403 || e.status === 401)) return refuse('denied');
      return refuse('error');
    }
    return { ok: true, registration };
  } catch (e) {
    if (e instanceof RestError && (e.status === 403 || e.status === 401)) return refuse('denied');
    return refuse('error');
  }
}
