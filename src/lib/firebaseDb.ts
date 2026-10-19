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

export async function enrollStudent(classId: string, studentUid: string, studentName: string) {
  const f = await fs();
  if (!f) return false;
  try {
    await f.setDoc(f.doc(f.db, 'classes', classId, 'enrollments', studentUid), {
      studentName,
      enrolledAt: f.serverTimestamp(),
    });
    // Also update student profile
    await f.updateDoc(f.doc(f.db, 'students', studentUid), { classId });
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
      f.orderBy('submittedAt', 'desc'),
      f.limit(100),
    );
    if (!alive) return;
    unsubscribe = f.onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
      f.orderBy('submittedAt', 'desc'),
      f.limit(50),
    );
    if (!alive) return;
    unsubscribe = f.onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
    // Query attempts for those classes
    const q = f.query(
      f.collection(f.db, 'drill_attempts'),
      f.where('classId', 'in', classIds),
      f.orderBy('submittedAt', 'desc'),
      f.limit(200),
    );
    const snap = await f.getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
