// Firestore database operations for the CMC app.
// Collections:
//   students/{uid}      — student profiles (grade, class, school)
//   classes/{classId}   — teacher-created classes (teacher_uid, name, code, program)
//   classes/{classId}/enrollments/{studentUid} — enrollment records
//   drill_attempts/{attemptId} — every drill submission (real-time)
//   classes/{classId}/assignments/{assignmentId} — teacher-assigned drills

import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';

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

// ── Classes ──────────────────────────────────────────────────────────

export async function createClass(input: {
  teacherUid: string;
  name: string;
  program: string;
  gradeLevel: string;
}): Promise<string | null> {
  if (!db) return null;
  try {
    const code = 'CMC-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const ref = await addDoc(collection(db, 'classes'), {
      teacherUid: input.teacherUid,
      name: input.name,
      program: input.program,
      gradeLevel: input.gradeLevel,
      code,
      isActive: true,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  } catch (e) {
    console.warn('[firestore] createClass:', e);
    return null;
  }
}

export async function listTeacherClasses(teacherUid: string) {
  if (!db) return [];
  try {
    const q = query(collection(db, 'classes'), where('teacherUid', '==', teacherUid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('[firestore] listTeacherClasses:', e);
    return [];
  }
}

export async function getClassByCode(code: string) {
  if (!db) return null;
  try {
    const q = query(collection(db, 'classes'), where('code', '==', code.toUpperCase()), limit(1));
    const snap = await getDocs(q);
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
  if (!db) return false;
  try {
    await setDoc(doc(db, 'classes', classId, 'enrollments', studentUid), {
      studentName,
      enrolledAt: serverTimestamp(),
    });
    // Also update student profile
    await updateDoc(doc(db, 'students', studentUid), { classId });
    return true;
  } catch (e) {
    console.warn('[firestore] enrollStudent:', e);
    return false;
  }
}

export async function listClassEnrollments(classId: string) {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'classes', classId, 'enrollments'));
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
  if (!db) return null;
  try {
    const ref = await addDoc(collection(db, 'drill_attempts'), {
      ...input,
      classId: input.classId ?? null,
      durationSeconds: input.durationSeconds ?? null,
      submittedAt: serverTimestamp(),
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
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, 'drill_attempts'),
    where('classId', '==', classId),
    orderBy('submittedAt', 'desc'),
    limit(100),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

/** Real-time listener for a single student's attempts */
export function subscribeToStudentAttempts(
  studentUid: string,
  callback: (attempts: any[]) => void,
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, 'drill_attempts'),
    where('studentUid', '==', studentUid),
    orderBy('submittedAt', 'desc'),
    limit(50),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

/** Get all attempts for a teacher (across all their classes) */
export async function listTeacherAttempts(teacherUid: string) {
  if (!db) return [];
  try {
    // Get teacher's classes first
    const classes = await listTeacherClasses(teacherUid);
    const classIds = classes.map((c: any) => c.id);
    if (!classIds.length) return [];
    // Query attempts for those classes
    const q = query(
      collection(db, 'drill_attempts'),
      where('classId', 'in', classIds),
      orderBy('submittedAt', 'desc'),
      limit(200),
    );
    const snap = await getDocs(q);
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
  if (!db) return false;
  try {
    await setDoc(doc(db, 'students', uid), {
      ...data,
      classId: null,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (e) {
    console.warn('[firestore] createStudentProfile:', e);
    return false;
  }
}

export async function getStudentProfile(uid: string) {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'students', uid));
    if (!snap.exists()) return null;
    return { uid: snap.id, ...snap.data() };
  } catch (e) {
    console.warn('[firestore] getStudentProfile:', e);
    return null;
  }
}

export async function updateStudentProfile(uid: string, updates: Record<string, any>) {
  if (!db) return false;
  try {
    await updateDoc(doc(db, 'students', uid), updates);
    return true;
  } catch (e) {
    console.warn('[firestore] updateStudentProfile:', e);
    return false;
  }
}
