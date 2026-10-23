// Private bi-weekly tests — Firestore data layer (REST transport).
//
// Same transport philosophy as assessmentDb.ts: the Firebase SDK's persisted
// session is fragile on iOS (ITP eviction), while the localStorage token +
// securetoken refresh grant used by every drill page keeps working. All calls
// run as the signed-in teacher (getValidIdToken) and are authorized by the
// test_* blocks in firestore.rules:
//
//   biweekly_tests/{testId}        public shell metadata (no answers)
//   test_keys/{testId}             THE answer key — verified teachers only
//   test_assignments/{id}          test + class + window
//   test_submissions/{a}__{uid}    raw student answers (student create-once)
//   test_scores/{a}__{uid}         computed scores — verified teachers only
//   teachers/{uid}                 append-only teacher allowlist
//
// Grading itself lives in biweeklyGrading.ts and runs in the browser on the
// teacher's device; scores are cached into test_scores so reopening the
// dashboard is instant.

import { getProjectId, getValidIdToken } from './firebaseAuth';
import type { GradeResult, SkillResult, TestKey } from './biweeklyGrading';

const BASE = `https://firestore.googleapis.com/v1/projects/${getProjectId()}/databases/(default)/documents`;

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
    throw new RestError(401, 'Your session has expired — sign in again to continue.');
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
  if (res.status === 404 && init?.method !== 'DELETE') {
    // Callers use 404 as "does not exist yet" (key install, registration).
    const err = new RestError(404, 'Not found');
    throw err;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: { message?: string } });
    if (res.status === 429) {
      throw new RestError(429, 'Firestore daily quota reached — reads and writes pause until the free-tier quota resets (around 2:00 PM Cambodia time). Try again after the reset.');
    }
    throw new RestError(res.status, body?.error?.message || `Firestore request failed (HTTP ${res.status})`);
  }
  return res.json() as Promise<T>;
}

// ── REST value coding ────────────────────────────────────────────────

type FsValue = Record<string, unknown>;
type FsFields = Record<string, FsValue>;

export function enc(value: unknown): FsValue {
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(enc) } };
  if (typeof value === 'object') {
    const fields: FsFields = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) fields[k] = enc(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function encMap(record: Record<string, unknown>): FsFields {
  const fields: FsFields = {};
  for (const [k, v] of Object.entries(record)) fields[k] = enc(v);
  return fields;
}

function dec(v: FsValue | undefined): unknown {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return ((v.arrayValue as { values?: FsValue[] }).values ?? []).map(dec);
  if ('mapValue' in v) return decFields((v.mapValue as { fields?: FsFields }).fields ?? {});
  return null;
}

function decFields(fields: FsFields): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = dec(v);
  return out;
}

const docIdOf = (name: string): string => name.split('/').pop() ?? '';

function decodeDoc(doc: { name: string; fields?: FsFields }): Record<string, unknown> & { id: string } {
  return { id: docIdOf(doc.name), ...decFields(doc.fields ?? {}) };
}

/** Firestore runQuery helper — returns decoded docs (missing ids skipped). */
async function runQuery(collectionId: string, query: Record<string, unknown>): Promise<Array<Record<string, unknown> & { id: string }>> {
  // The REST endpoint answers with a TOP-LEVEL JSON ARRAY of RunQueryResponse
  // rows ({ document, readTime } — plus readTime-only markers for skipped
  // results). Reading `.Array` off an array is always undefined, which used to
  // silently discard EVERY result: the assignments list stayed "None yet"
  // forever even though creates succeeded.
  type Row = { document?: { name: string; fields?: FsFields } };
  const res = await fsCall<Array<Row> | { Array?: Row[] }>(
    `:runQuery`,
    { method: 'POST', body: JSON.stringify({ structuredQuery: { from: [{ collectionId, allDescendants: false }], ...query } }) },
  );
  const rows: Row[] = Array.isArray(res) ? res : (res.Array ?? []);
  return rows.filter((row) => row?.document).map((row) => decodeDoc(row.document!));
}

const fieldFilter = (field: string, op: string, value: unknown) => ({
  where: { fieldFilter: { field: { fieldPath: field }, op, value: enc(value) } },
});

// ── Types ────────────────────────────────────────────────────────────

export interface AssignmentDoc {
  id: string;
  testId: string;
  title: string;
  classId: string;
  className: string;
  teacherUid: string;
  opensAt: string;
  closesAt: string;
  durationMinutes: number;
  createdAt: string;
}

export interface SubmissionDoc {
  id: string;
  assignmentId: string;
  testId: string;
  classId: string;
  studentUid: string;
  studentName: string;
  status: string;
  answers: Record<string, string>;
  integrity: Record<string, number>;
  startedAt: string | null;
  submittedAt: string;
}

export interface ScoreDoc {
  id: string;
  assignmentId: string;
  testId: string;
  studentUid: string;
  studentName: string;
  correctCount: number;
  totalCount: number;
  scorePct: number;
  perSkill: SkillResult[];
  missed: number[];
  gradedAt: string;
}

// ── Teacher registration (allowlist) ─────────────────────────────────

/** Idempotent: creates teachers/{uid} when missing (rules allow edu accounts
 *  to self-register once). Returns true when the caller IS a verified teacher
 *  afterwards. */
export async function ensureTeacherRegistration(): Promise<boolean> {
  const token = await getValidIdToken();
  if (!token) throw new RestError(401, 'Sign in first.');
  const res = await fetch(`${BASE}/teachers/${getValidUid(token)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) return true;
  if (res.status !== 404) {
    const body = await res.json().catch(() => ({}) as { error?: { message?: string } });
    throw new RestError(res.status, body?.error?.message || 'Teacher registration lookup failed.');
  }
  // 404 → not registered yet. Create the allowlist entry.
  try {
    await fsCall(`/teachers?documentId=${getValidUid(token)}`, {
      method: 'POST',
      body: JSON.stringify({ fields: { registeredAt: enc(new Date().toISOString()) } }),
    });
    return true;
  } catch (err) {
    if (err instanceof RestError && (err.status === 403 || err.status === 401)) return false;
    throw err;
  }
}

function getValidUid(token: string): string {
  // Firebase ID tokens are JWTs; the uid is the "user_id" claim.
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return String(payload.user_id || payload.sub || '');
  } catch {
    return '';
  }
}

/** The uid the REST transport (and therefore the security rules) actually
 *  sees for the current session. The dashboard can resolve a teacher's id
 *  from a DIFFERENT auth path (Supabase member flow vs the Firebase teacher
 *  pass) — but every test_* rule checks `teacherUid == request.auth.uid`
 *  against THIS token's uid, so writes must carry it. Returns null when no
 *  Firebase session exists. */
export async function getRestAuthUid(): Promise<string | null> {
  const token = await getValidIdToken();
  if (!token) return null;
  return getValidUid(token) || null;
}

// ── Test shell metadata + keys ───────────────────────────────────────

export async function putTestMeta(test: { testId: string; title: string; questionCount: number; groups: { id: string; title: string }[] }): Promise<void> {
  // PATCH the DOCUMENT path directly. (?documentId= is only valid on POST-to-
  // collection create; passing it on PATCH is rejected with HTTP 400
  // "Unknown name 'documentId'" before rules even run.)
  await fsCall(`/biweekly_tests/${encodeURIComponent(test.testId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: encMap({ ...test, updatedAt: new Date().toISOString() }) }),
  });
}

export async function getTestKey(testId: string): Promise<TestKey | null> {
  try {
    const doc = await fsCall<{ name: string; fields?: FsFields }>(`/test_keys/${encodeURIComponent(testId)}`);
    return decFields(doc.fields ?? {}) as unknown as TestKey;
  } catch (err) {
    if (err instanceof RestError && err.status === 404) return null;
    throw err;
  }
}

export async function putTestKey(key: TestKey): Promise<void> {
  await fsCall(`/test_keys/${encodeURIComponent(key.testId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: encMap(key as unknown as Record<string, unknown>) }),
  });
}

// ── Assignments ──────────────────────────────────────────────────────

export async function listAssignments(teacherUid: string): Promise<AssignmentDoc[]> {
  // Equality-only query: Firestore's automatic single-field index covers it.
  // (A where+orderBy pair would require a manually created composite index —
  // sort client-side instead so the panel works with zero console setup.)
  const docs = await runQuery('test_assignments', {
    ...fieldFilter('teacherUid', 'EQUAL', teacherUid),
    limit: 50,
  });
  return (docs as unknown as AssignmentDoc[]).sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || ''),
  );
}

export async function createAssignment(input: {
  testId: string;
  title: string;
  classId: string;
  className: string;
  teacherUid: string;
  opensAt: string;
  closesAt: string;
  durationMinutes: number;
}): Promise<AssignmentDoc> {
  const doc = await fsCall<{ name: string; fields?: FsFields }>(`/test_assignments`, {
    method: 'POST',
    // opensAt/closesAt MUST be stored as real timestamps (not ISO strings):
    // the submission rules compare them against request.time, and a string-vs-
    // timestamp comparison in rules CEL is a type error → always false → every
    // student submission would be rejected with 403.
    body: JSON.stringify({ fields: encMap({
      ...input,
      opensAt: new Date(input.opensAt),
      closesAt: new Date(input.closesAt),
      createdAt: new Date().toISOString(),
    }) }),
  });
  return decodeDoc(doc) as unknown as AssignmentDoc;
}

export async function updateAssignmentWindow(id: string, opensAt: string, closesAt: string): Promise<void> {
  await fsCall(`/test_assignments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    // Timestamps, not strings — see createAssignment (rules compare these
    // against request.time).
    body: JSON.stringify({ fields: { opensAt: enc(new Date(opensAt)), closesAt: enc(new Date(closesAt)) } }),
  });
}

export async function deleteAssignment(id: string): Promise<void> {
  await fsCall(`/test_assignments/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ── Submissions + scores ─────────────────────────────────────────────

export async function listSubmissions(assignmentId: string): Promise<SubmissionDoc[]> {
  const docs = await runQuery('test_submissions', {
    ...fieldFilter('assignmentId', 'EQUAL', assignmentId),
    limit: 200,
  });
  return (docs as unknown as SubmissionDoc[]).sort((a, b) =>
    (a.submittedAt || '').localeCompare(b.submittedAt || ''),
  );
}

export async function listScores(assignmentId: string): Promise<ScoreDoc[]> {
  const docs = await runQuery('test_scores', {
    ...fieldFilter('assignmentId', 'EQUAL', assignmentId),
    limit: 200,
  });
  return docs as unknown as ScoreDoc[];
}

/** Cache one graded submission (score doc id === submission doc id). */
export async function putScore(submission: SubmissionDoc, grade: GradeResult, gradedBy: string): Promise<void> {
  const payload: ScoreDoc = {
    id: submission.id,
    assignmentId: submission.assignmentId,
    testId: submission.testId,
    studentUid: submission.studentUid,
    studentName: submission.studentName,
    correctCount: grade.correctCount,
    totalCount: grade.totalCount,
    scorePct: grade.scorePct,
    perSkill: grade.perSkill,
    missed: grade.missed,
    gradedAt: new Date().toISOString(),
  };
  await fsCall(`/test_scores/${encodeURIComponent(submission.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: encMap({ ...payload, gradedBy }) }),
  });
}
