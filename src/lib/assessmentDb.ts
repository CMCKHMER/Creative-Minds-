// Daily Student Assessment Records — Firestore data layer (REST transport).
//
// Replaces the retired Google Apps Script → Google Sheets backend of the
// standalone Student-Assesment-Records site. Everything lives in the SAME
// Firebase project (creative-minds-cambodia) the rest of the CMC site uses:
//
//   assessment_classes/{classId}
//       schoolName, name, teacherName, teacherUid, teacherEmail,
//       remarks, createdAt, updatedAt
//   assessment_classes/{classId}/students/{studentId}
//       name, schoolId, sponsorship, amount, comments, teacherComment,
//       …all scoring fields (see assessmentScoring.ts)…
//       updatedAt, updatedBy
//
// WHY REST (and not the Firebase SDK / onSnapshot): the workspace used to be
// the only Firestore surface whose auth depended on the SDK's own persisted
// session (IndexedDB). That session dies silently in the field — Safari ITP
// evicts script-writable storage after 7 days of no interaction, Chrome can
// evict under storage pressure, and anyone whose last UI sign-in predates the
// SDK bridge never had it at all. When it dies the workspace showed
// "No classes yet" plus a misleading "publish the security rules" error even
// though every other sign of being signed in was intact. The static worksheet
// pages never had this problem because they call the Firestore REST API with
// the localStorage ID token (auto-refreshed through the securetoken grant by
// getValidIdToken). The workspace now uses the exact same transport, so it
// works anywhere drill-score submission works — no SDK state required.
//
// Realtime: onSnapshot is replaced by a visibility-aware 6-second poll —
// co-teacher edits land within seconds, at a quota cost of ~600 reads per
// hour of active grading (the Spark free tier allows 50k reads/day).
//
// Security (firestore.rules): teachers only — the signed-in account's email
// must contain "edu" (the same heuristic RoleGate uses site-wide). Writes are
// per-document patches (updateDoc-style), so two teachers cannot overwrite
// each other's whole class, and every row carries its own updatedAt/updatedBy
// audit stamp.
//
// Self-healing roster lookup: classes are queried by teacherUid; if that
// returns nothing but the caller's email matches (uid changed — e.g. the
// account was recreated), the classes are recovered by teacherEmail and
// re-stamped with the current uid so subsequent loads query directly.

import { getProjectId, getValidIdToken } from './firebaseAuth';
import { emptyStudentScores, type AssessmentStudentScores } from './assessmentScoring';

const BASE = `https://firestore.googleapis.com/v1/projects/${getProjectId()}/databases/(default)/documents`;

// ── REST plumbing ────────────────────────────────────────────────────

/** Error with an HTTP status so the UI can tell "session expired" (401)
 *  from "rules denied" (403) from "network/offline" (0 / fetch throw). */
export class RestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function fsCall<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
  const token = await getValidIdToken();
  if (!token) {
    throw new RestError(401, 'Your session has expired — sign in again to reconnect to the records database.');
  }
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new RestError(0, 'Network unreachable — check the connection and try again.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: { message?: string } });
    if (res.status === 429) {
      throw new RestError(429, 'Firestore daily quota reached — reads and writes pause until the free-tier quota resets (around 2:00 PM Cambodia time). Try again after the reset.');
    }
    const raw = body?.error?.message || `Firestore request failed (HTTP ${res.status})`;
    throw new RestError(res.status, raw);
  }
  return res.json() as Promise<T>;
}

type Fields = Record<string, unknown>;

const docIdOf = (name: string): string => name.split('/').pop() ?? '';

/** Encode a JS value into a Firestore REST typed value. All score fields are
 *  integers; everything else ships as a string. */
function enc(value: unknown): Record<string, unknown> {
  if (typeof value === 'number') return { integerValue: String(Math.round(value)) };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (value === null || value === undefined) return { nullValue: null };
  return { stringValue: String(value) };
}

function encodeFields(record: Record<string, unknown>): { fields: Fields } {
  const fields: Fields = {};
  for (const [k, v] of Object.entries(record)) fields[k] = enc(v);
  return { fields };
}

// ── Types ────────────────────────────────────────────────────────────

export interface AssessmentClassDoc {
  id: string;
  name: string;
  schoolName: string;
  teacherName: string;
  teacherUid: string;
  teacherEmail: string;
  remarks: string;
  createdAt: number | null; // epoch ms (null until a server/client timestamp lands)
  updatedAt: number | null;
}

export interface AssessmentStudentDoc extends AssessmentStudentScores {
  id: string;
  name: string;
  schoolId: string;
  sponsorship: string;
  amount: string;
  comments: string;
  teacherComment: string;
  /** Weekly entries keyed by the week's Monday date (ISO "YYYY-MM-DD").
   *  Each entry holds the same score/notes fields as the top level. The
   *  top-level (flat) fields keep the ORIGINAL pre-weekly record so older
   *  data and exports stay intact. */
  weeks: Record<string, AssessmentWeekEntry>;
  updatedAt: number | null;
  updatedBy: string;
}

/** One week's scores for one student — sparse by design: only fields the
 *  teacher actually entered are present. Values mirror the flat field
 *  types (numbers for scores, strings for notes). */
export type AssessmentWeekEntry = Record<string, number | string>;

/** Fields that identify the student (roster-level) — they always live in
 *  the flat document, never inside a week entry. */
export const STUDENT_IDENTITY_FIELDS: ReadonlySet<string> = new Set([
  'name', 'schoolId', 'sponsorship', 'amount', 'comments', 'teacherComment',
]);

/** Monday of the week containing `date` (local time), as "YYYY-MM-DD".
 *  Cambodia has no DST and teachers' devices use local time, so a local
 *  Monday is the correct week key everywhere. */
export function weekKeyOf(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const shift = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - shift);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** "Week of 26 Oct 2026" style label for a "YYYY-MM-DD" week key. */
export function formatWeekLabel(key: string): string {
  const d = new Date(`${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  return `Week of ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function newStudentRow(): Omit<AssessmentStudentDoc, 'id' | 'updatedAt' | 'updatedBy'> {
  return {
    name: '', schoolId: '', sponsorship: 'Pending', amount: '', comments: '', teacherComment: '',
    weeks: {},
    ...emptyStudentScores(),
  };
}

/** Convert a Firestore REST document's typed fields to a plain student record. */
function toStudent(id: string, data: Fields): AssessmentStudentDoc {
  const num = (k: string): number => {
    const v = data[k] as Record<string, unknown> | undefined;
    if (!v) return 0;
    if (typeof v.integerValue === 'string') return parseInt(v.integerValue, 10) || 0;
    if (typeof v.doubleValue === 'number') return v.doubleValue;
    return 0;
  };
  const str = (k: string): string => {
    const v = data[k] as Record<string, unknown> | undefined;
    return v && typeof v.stringValue === 'string' ? v.stringValue : '';
  };
  // weeks: map<weekKey, map<field, value>> — parse only the leaf shapes we
  // ship (numbers and strings); anything else is ignored defensively.
  const weeks: Record<string, AssessmentWeekEntry> = {};
  const wv = data.weeks as Record<string, unknown> | undefined;
  const wMap = wv && typeof wv === 'object' ? (wv.mapValue as { fields?: Fields } | undefined) : undefined;
  for (const [key, raw] of Object.entries(wMap?.fields ?? {})) {
    const inner = (raw as { mapValue?: { fields?: Fields } }).mapValue?.fields;
    if (!inner) continue;
    const entry: AssessmentWeekEntry = {};
    for (const [fk, fv] of Object.entries(inner)) {
      const leaf = fv as Record<string, unknown>;
      if (typeof leaf.integerValue === 'string') entry[fk] = parseInt(leaf.integerValue, 10) || 0;
      else if (typeof leaf.stringValue === 'string') entry[fk] = leaf.stringValue;
    }
    if (Object.keys(entry).length) weeks[key] = entry;
  }
  const ts = data.updatedAt as Record<string, unknown> | undefined;
  const iso = ts && typeof ts.timestampValue === 'string' ? ts.timestampValue : null;
  return {
    id,
    name: str('name'), schoolId: str('schoolId'), sponsorship: str('sponsorship') || 'Pending',
    amount: str('amount'), comments: str('comments'), teacherComment: str('teacherComment'),
    weeks,
    listening: num('listening'), speaking: num('speaking'), pronunciation: num('pronunciation'),
    fluency: num('fluency'), listeningNotes: str('listeningNotes'),
    comprehension: num('comprehension'), vocabulary: num('vocabulary'), readingSpeed: num('readingSpeed'),
    accuracy: num('accuracy'), readingNotes: str('readingNotes'),
    pblSubject: num('pblSubject'), pblPresentation: num('pblPresentation'),
    pblLanguage: num('pblLanguage'), pblFocusPoints: num('pblFocusPoints'), pblNotes: str('pblNotes'),
    quizT1Q1: num('quizT1Q1'), quizT1Q2: num('quizT1Q2'), quizT1Q3: num('quizT1Q3'),
    quizT1Q4: num('quizT1Q4'), quizT1Q5: num('quizT1Q5'),
    quizT2Q1: num('quizT2Q1'), quizT2Q2: num('quizT2Q2'), quizT2Q3: num('quizT2Q3'),
    quizT2Q4: num('quizT2Q4'), quizT2Q5: num('quizT2Q5'), quizNotes: str('quizNotes'),
    hwDay1: num('hwDay1'), hwDay2: num('hwDay2'), hwDay3: num('hwDay3'), hwDay4: num('hwDay4'),
    hwDay5: num('hwDay5'), hwNotes: str('hwNotes'),
    partDay1: num('partDay1'), partDay2: num('partDay2'), partDay3: num('partDay3'),
    partDay4: num('partDay4'), partDay5: num('partDay5'), partNotes: str('partNotes'),
    updatedAt: iso ? Date.parse(iso) || null : null,
    updatedBy: str('updatedBy'),
  };
}

function toClass(id: string, data: Fields): AssessmentClassDoc {
  const str = (k: string): string => {
    const v = data[k] as Record<string, unknown> | undefined;
    return v && typeof v.stringValue === 'string' ? v.stringValue : '';
  };
  const ms = (k: string): number | null => {
    const v = data[k] as Record<string, unknown> | undefined;
    const iso = v && typeof v.timestampValue === 'string' ? v.timestampValue : null;
    return iso ? Date.parse(iso) || null : null;
  };
  return {
    id,
    name: str('name'), schoolName: str('schoolName'), teacherName: str('teacherName'),
    teacherUid: str('teacherUid'), teacherEmail: str('teacherEmail'), remarks: str('remarks'),
    createdAt: ms('createdAt'), updatedAt: ms('updatedAt'),
  };
}

// ── Classes ──────────────────────────────────────────────────────────

async function queryClasses(field: 'teacherUid' | 'teacherEmail', value: string): Promise<AssessmentClassDoc[]> {
  const rows = await fsCall<unknown[]>(':runQuery', {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'assessment_classes' }],
        where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } },
        limit: 100,
      },
    }),
  });
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r && typeof r === 'object' && (r as { document?: unknown }).document)
    .map((r) => {
      const doc = (r as { document: { name: string; fields?: Fields } }).document;
      return toClass(docIdOf(doc.name), doc.fields ?? {});
    });
}

/** All assessment classes owned by the given teacher, newest activity first.
 *  Falls back to a teacherEmail match (and re-stamps the found classes with
 *  the current uid) when the uid query comes back empty — this recovers the
 *  roster after an account recreation. */
export async function listAssessmentClasses(teacherUid: string, teacherEmail?: string): Promise<AssessmentClassDoc[]> {
  const byUid = await queryClasses('teacherUid', teacherUid);
  if (byUid.length) {
    byUid.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    return byUid;
  }
  if (teacherEmail) {
    const byEmail = await queryClasses('teacherEmail', teacherEmail);
    if (byEmail.length) {
      // Heal: adopt the recovered classes into the current uid (fire-and-forget).
      for (const c of byEmail) {
        if (c.teacherUid === teacherUid) continue;
        void fsCall(`/assessment_classes/${c.id}?updateMask.fieldPaths=teacherUid&updateMask.fieldPaths=updatedAt`, {
          method: 'PATCH',
          body: JSON.stringify(encodeFields({ teacherUid, updatedAt: new Date().toISOString() })),
        }).catch(() => { /* best-effort repair */ });
      }
      byEmail.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      return byEmail;
    }
  }
  return [];
}

export async function createAssessmentClass(input: {
  teacherUid: string;
  teacherEmail: string;
  schoolName: string;
  name: string;
  teacherName: string;
}): Promise<string | null> {
  const doc = await fsCall<{ name: string }>('/assessment_classes', {
    method: 'POST',
    body: JSON.stringify(encodeFields({
      schoolName: input.schoolName.trim(),
      name: input.name.trim(),
      teacherName: input.teacherName.trim(),
      teacherUid: input.teacherUid,
      teacherEmail: input.teacherEmail,
      remarks: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
  });
  return docIdOf(doc.name);
}

/** Patch class-level metadata (school/teacher names, overall remarks). */
export async function updateAssessmentClass(
  classId: string,
  patch: Partial<Pick<AssessmentClassDoc, 'schoolName' | 'teacherName' | 'remarks' | 'name'>>,
): Promise<void> {
  const record = { ...patch, updatedAt: new Date().toISOString() };
  const masks = [...Object.keys(patch), 'updatedAt']
    .map((k) => `updateMask.fieldPaths=${k}`)
    .join('&');
  await fsCall(`/assessment_classes/${classId}?${masks}`, {
    method: 'PATCH',
    body: JSON.stringify(encodeFields(record)),
  });
}

// ── Students (polled "realtime") ─────────────────────────────────────

/** Subscribe to a class roster. Pulls immediately, then polls every 6s while
 *  the tab is visible (quota-kind). First-load errors surface through
 *  onError; transient re-poll failures stay quiet so a flaky network never
 *  wipes a graded roster off the screen. Returns an unsubscribe function. */
export function subscribeAssessmentStudents(
  classId: string,
  onUpdate: (students: AssessmentStudentDoc[]) => void,
  onError: (e: unknown) => void,
): () => void {
  let stopped = false;
  let hasData = false;
  const pull = async (): Promise<void> => {
    try {
      const data = await fsCall<{ documents?: { name: string; fields?: Fields }[] }>(
        `/assessment_classes/${classId}/students?pageSize=300`,
      );
      const rows = (data.documents ?? []).map((d) => toStudent(docIdOf(d.name), d.fields ?? {}));
      rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      hasData = true;
      if (!stopped) onUpdate(rows);
    } catch (e) {
      if (!stopped && !hasData) onError(e);
    }
  };
  void pull();
  const timer = setInterval(() => {
    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void pull();
  }, 6000);
  return () => { stopped = true; clearInterval(timer); };
}

export async function addAssessmentStudent(
  classId: string,
  record: ReturnType<typeof newStudentRow> | Record<string, unknown>,
  actorEmail: string,
): Promise<string | null> {
  const doc = await fsCall<{ name: string }>(`/assessment_classes/${classId}/students`, {
    method: 'POST',
    body: JSON.stringify(encodeFields({
      ...record,
      updatedAt: new Date().toISOString(),
      updatedBy: actorEmail,
    })),
  });
  // Touch the class doc's updatedAt (best-effort — sorts the class list).
  void fsCall(`/assessment_classes/${classId}?updateMask.fieldPaths=updatedAt`, {
    method: 'PATCH',
    body: JSON.stringify(encodeFields({ updatedAt: new Date().toISOString() })),
  }).catch(() => { /* non-fatal */ });
  return docIdOf(doc.name);
}

/** Per-field patch — the unit of save in the workspace (debounced per row). */
export async function patchAssessmentStudent(
  classId: string,
  studentId: string,
  patch: Record<string, string | number>,
  actorEmail: string,
): Promise<void> {
  const record = { ...patch, updatedAt: new Date().toISOString(), updatedBy: actorEmail };
  const masks = [...Object.keys(patch), 'updatedAt', 'updatedBy']
    .map((k) => `updateMask.fieldPaths=${k}`)
    .join('&');
  await fsCall(`/assessment_classes/${classId}/students/${studentId}?${masks}`, {
    method: 'PATCH',
    body: JSON.stringify(encodeFields(record)),
  });
}

export async function removeAssessmentStudent(classId: string, studentId: string): Promise<void> {
  await fsCall(`/assessment_classes/${classId}/students/${studentId}`, { method: 'DELETE' });
}

// ── Weekly entries (weeks.<weekKey>.<field> map leaves) ─────────────

/** Build the nested REST body for dotted field paths, e.g.
 *  ["weeks.2026-10-26.listening", "updatedAt"] →
 *  { fields: { weeks: { mapValue: { fields: { "2026-10-26": { mapValue:
 *  { fields: { listening: … } } } } } } }, updatedAt: … }.
 *  Week keys are ISO dates (digits + hyphens), so the dot-separated path
 *  segments stay unambiguous. */
function buildNestedBody(dottedKeys: string[], values: Record<string, unknown>): { fields: Fields } {
  const root: Fields = {};
  for (const path of dottedKeys) {
    const segments = path.split('.');
    let cursor: Fields = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      const next = cursor[seg] as { mapValue?: { fields: Fields } } | undefined;
      if (next?.mapValue) cursor = next.mapValue.fields;
      else {
        const fresh: Fields = {};
        cursor[seg] = { mapValue: { fields: fresh } };
        cursor = fresh;
      }
    }
    cursor[segments[segments.length - 1]] = enc(values[path]);
  }
  return { fields: root };
}

/** Save (parts of) one week's entry for a student. Each field patches the
 *  single leaf weeks.<weekKey>.<field>, so two teachers editing different
 *  fields — or different weeks — never overwrite each other. */
export async function patchAssessmentStudentWeek(
  classId: string,
  studentId: string,
  weekKey: string,
  patch: Record<string, string | number>,
  actorEmail: string,
): Promise<void> {
  const dottedKeys: string[] = [];
  const values: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    const path = `weeks.${weekKey}.${k}`;
    dottedKeys.push(path);
    values[path] = v;
  }
  const masks = [...dottedKeys, 'updatedAt', 'updatedBy']
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join('&');
  const body = buildNestedBody(dottedKeys, values);
  await fsCall(`/assessment_classes/${classId}/students/${studentId}?${masks}`, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: {
        ...body.fields,
        updatedAt: enc(new Date().toISOString()),
        updatedBy: enc(actorEmail),
      },
    }),
  });
}

/** Remove a student's whole week entry (masked-but-absent leaf deletes the
 *  map key). Used by the workspace's "delete week" control. */
export async function clearAssessmentWeek(
  classId: string,
  studentId: string,
  weekKey: string,
): Promise<void> {
  const masks = [
    `updateMask.fieldPaths=${encodeURIComponent(`weeks.${weekKey}`)}`,
    'updateMask.fieldPaths=updatedAt',
  ].join('&');
  await fsCall(`/assessment_classes/${classId}/students/${studentId}?${masks}`, {
    method: 'PATCH',
    body: JSON.stringify(encodeFields({ updatedAt: new Date().toISOString() })),
  });
}

export async function duplicateAssessmentStudent(
  classId: string,
  student: AssessmentStudentDoc,
  actorEmail: string,
): Promise<string | null> {
  // shallow copy minus the doc-managed fields (id / timestamps / actor)
  const rest = { ...student } as Record<string, unknown>;
  delete rest.id;
  delete rest.updatedAt;
  delete rest.updatedBy;
  return addAssessmentStudent(classId, rest, actorEmail);
}
