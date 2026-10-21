// Firestore database operations for the CMC app.
// Collections:
//   students/{uid}      — student profiles (grade, class, school)
//   classes/{classId}   — teacher-created classes (teacher_uid, name, code, program)
//   classes/{classId}/enrollments/{studentUid} — enrollment records
//   drill_attempts/{attemptId} — every drill submission (real-time)
//   classes/{classId}/assignments/{assignmentId} — teacher-assigned drills
//
// The firestore SDK chunk is dynamic-imported on first use, so it stays out
// of the initial page-load bundle. Public function signatures are unchanged.

import { getFirebaseDb } from './firebase';
import type { Firestore, serverTimestamp } from 'firebase/firestore';

export interface DrillAttemptDoc {
  drillSlug: string;
  drillTitle: string;
  drillSource: 'biweek-planner' | 'toefl-ibt' | 'learning-games' | 'rfc3';
  studentUid: string;
  studentName: string;
  classId: string | null;
  scorePct: number;
  correctCount: number;
  totalCount: number;
  durationSeconds: number | null;
  submittedAt: ReturnType<typeof serverTimestamp>;
}

/** db handle + every firestore helper, resolved together (memoized by the lazy singleton upstream). */
async function fs(): Promise<{ db: Firestore } & typeof import('firebase/firestore') | null> {
  const db = await getFirebaseDb();
  if (!db) return null;
  return { db, ...(await import('firebase/firestore')) };
}

/** Normalizes submittedAt (Firestore Timestamp | ISO string | epoch ms) to epoch ms. */
function toMillis(v: any): number {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  const t = Date.parse(v);
  return Number.isNaN(t) ? 0 : t;
}

// ── Classes ──────────────────────────────────────────────────────────

export async function createClass(input: {
  teacherUid: string;
  name: string;
  program: string;
  gradeLevel: string;
}): Promise<string | null> {
  const f = await fs();
  if (!f) return null;
  try {
    const code = 'CMC-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const ref = await f.addDoc(f.collection(f.db, 'classes'), {
      teacherUid: input.teacherUid,
      name: input.name,
      program: input.program,
      gradeLevel: input.gradeLevel,
      code,
      isActive: true,
      createdAt: f.serverTimestamp(),
    });
    return ref.id;
  } catch (e) {
    console.warn('[firestore] createClass:', e);
    return null;
  }
}

export async function listTeacherClasses(teacherUid: string) {
  const f = await fs();
  if (!f) return [];
  try {
    const q = f.query(f.collection(f.db, 'classes'), f.where('teacherUid', '==', teacherUid));
    const snap = await f.getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('[firestore] listTeacherClasses:', e);
    return [];
  }
}

export async function getClassByCode(code: string) {
  const f = await fs();
  if (!f) return null;
  try {
    const q = f.query(f.collection(f.db, 'classes'), f.where('code', '==', code.toUpperCase()), f.limit(1));
    const snap = await f.getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as any;
  } catch (e) {
    console.warn('[firestore] getClassByCode:', e);
    return null;
  }
}

// ── Enrollments ──────────────────────────────────────────────────────

// teacherUid is stamped onto the enrollment doc so the security rules can
// authorize teacher-side enrollment cleanup (class deletion) with a plain
// `resource.data.teacherUid` check — no rules `get()` calls, no batch limits.
export async function enrollStudent(classId: string, studentUid: string, studentName: string, teacherUid?: string) {
  const f = await fs();
  if (!f) return false;
  try {
    await f.setDoc(f.doc(f.db, 'classes', classId, 'enrollments', studentUid), {
      studentName,
      ...(teacherUid ? { teacherUid } : {}),
      enrolledAt: f.serverTimestamp(),
    });
    // Also stamp the student profile. setDoc+merge (not updateDoc) so this
    // succeeds even when the student has no profile document yet — REST-path
    // sign-ups don't create one.
    await f.setDoc(f.doc(f.db, 'students', studentUid), { classId }, { merge: true });
    return true;
  } catch (e) {
    console.warn('[firestore] enrollStudent:', e);
    return false;
  }
}

export async function listClassEnrollments(classId: string) {
  const f = await fs();
  if (!f) return [];
  try {
    const snap = await f.getDocs(f.collection(f.db, 'classes', classId, 'enrollments'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('[firestore] listClassEnrollments:', e);
    return [];
  }
}

/**
 * Deletes a class and, best-effort, its enrollment records.
 *
 * Rules only allow the class owner (resource.data.teacherUid) to delete the
 * class doc. Enrollment cleanup runs first and tolerates failure — docs the
 * rules refuse to remove (e.g. enrollments created before teacherUid was
 * stamped) simply stay behind as harmless orphans: nothing queries a deleted
 * class's subcollection, and the class code can no longer be joined because
 * the lookup doc is gone.
 */
export async function deleteClassTeacher(classId: string): Promise<boolean> {
  const f = await fs();
  if (!f) return false;
  try {
    try {
      const snap = await f.getDocs(f.collection(f.db, 'classes', classId, 'enrollments'));
      const results = await Promise.allSettled(snap.docs.map(d => f.deleteDoc(d.ref)));
      const blocked = results.filter(r => r.status === 'rejected').length;
      if (blocked) console.warn(`[firestore] deleteClassTeacher: ${blocked} enrollment doc(s) could not be removed (left as orphans)`);
    } catch { /* subcollection read failing must not block the class delete */ }
    await f.deleteDoc(f.doc(f.db, 'classes', classId));
    return true;
  } catch (e) {
    console.warn('[firestore] deleteClassTeacher:', e);
    return false;
  }
}

// ── Drill Attempts (real-time) ──────────────────────────────────────

export async function submitDrillAttempt(input: {
  studentUid: string;
  studentName: string;
  classId?: string | null;
  drillSlug: string;
  drillTitle: string;
  drillSource: string;
  scorePct: number;
  correctCount: number;
  totalCount: number;
  durationSeconds?: number | null;
}): Promise<string | null> {
  const f = await fs();
  if (!f) return null;
  try {
    const ref = await f.addDoc(f.collection(f.db, 'drill_attempts'), {
      ...input,
      classId: input.classId ?? null,
      durationSeconds: input.durationSeconds ?? null,
      submittedAt: f.serverTimestamp(),
    });
    return ref.id;
  } catch (e) {
    console.warn('[firestore] submitDrillAttempt:', e);
    return null;
  }
}

/** Real-time listener for all drill attempts in a class */
export function subscribeToClassAttempts(
  classId: string,
  callback: (attempts: any[]) => void,
): () => void {
  let unsubscribe: (() => void) | null = null;
  let alive = true;
  void (async () => {
    const f = await fs();
    if (!f) {
      if (alive) callback([]);
      return;
    }
    const q = f.query(
      f.collection(f.db, 'drill_attempts'),
      f.where('classId', '==', classId),
      f.limit(200),
    );
    if (!alive) return;
    unsubscribe = f.onSnapshot(q, (snap) => {
      // Sorted client-side: where + orderBy(submittedAt) would require a
      // composite index that was never created, and the query would fail
      // silently (empty list) on every dashboard load.
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      rows.sort((a: any, b: any) => toMillis(b.submittedAt) - toMillis(a.submittedAt));
      callback(rows);
    });
  })();
  return () => {
    alive = false;
    unsubscribe?.();
  };
}

/** Real-time listener for a single student's attempts */
export function subscribeToStudentAttempts(
  studentUid: string,
  callback: (attempts: any[]) => void,
): () => void {
  let unsubscribe: (() => void) | null = null;
  let alive = true;
  void (async () => {
    const f = await fs();
    if (!f) {
      if (alive) callback([]);
      return;
    }
    const q = f.query(
      f.collection(f.db, 'drill_attempts'),
      f.where('studentUid', '==', studentUid),
      f.limit(100),
    );
    if (!alive) return;
    unsubscribe = f.onSnapshot(q, (snap) => {
      // Client-side sort — avoids the (studentUid, submittedAt) composite index.
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      rows.sort((a: any, b: any) => toMillis(b.submittedAt) - toMillis(a.submittedAt));
      callback(rows);
    });
  })();
  return () => {
    alive = false;
    unsubscribe?.();
  };
}

/** Get all attempts for a teacher (across all their classes) */
export async function listTeacherAttempts(teacherUid: string) {
  const f = await fs();
  if (!f) return [];
  try {
    // Get teacher's classes first
    const classes = await listTeacherClasses(teacherUid);
    const classIds = classes.map((c: any) => c.id);
    if (!classIds.length) return [];
    // Query attempts for those classes. Client-side sort avoids the
    // (classId, submittedAt) composite index that `in` + orderBy needs.
    const q = f.query(
      f.collection(f.db, 'drill_attempts'),
      f.where('classId', 'in', classIds),
      f.limit(200),
    );
    const snap = await f.getDocs(q);
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    rows.sort((a: any, b: any) => toMillis(b.submittedAt) - toMillis(a.submittedAt));
    return rows;
  } catch (e) {
    console.warn('[firestore] listTeacherAttempts:', e);
    return [];
  }
}

// ── Student Profile ──────────────────────────────────────────────────

export async function createStudentProfile(uid: string, data: {
  displayName: string;
  email: string;
  grade?: number;
  school?: string;
}) {
  const f = await fs();
  if (!f) return false;
  try {
    await f.setDoc(f.doc(f.db, 'students', uid), {
      ...data,
      classId: null,
      createdAt: f.serverTimestamp(),
    });
    return true;
  } catch (e) {
    console.warn('[firestore] createStudentProfile:', e);
    return false;
  }
}

export async function getStudentProfile(uid: string) {
  const f = await fs();
  if (!f) return null;
  try {
    const snap = await f.getDoc(f.doc(f.db, 'students', uid));
    if (!snap.exists()) return null;
    return { uid: snap.id, ...snap.data() };
  } catch (e) {
    console.warn('[firestore] getStudentProfile:', e);
    return null;
  }
}

export async function updateStudentProfile(uid: string, updates: Record<string, any>) {
  const f = await fs();
  if (!f) return false;
  try {
    await f.updateDoc(f.doc(f.db, 'students', uid), updates);
    return true;
  } catch (e) {
    console.warn('[firestore] updateStudentProfile:', e);
    return false;
  }
}
