// Daily Student Assessment Records — Firestore data layer.
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
// Security (firestore.rules): teachers only — the signed-in account's email
// must contain "edu" (the same heuristic RoleGate uses site-wide). The old
// Sheets endpoint was readable AND writable by anyone on the internet.
//
// Writes are per-document patches (updateDoc) instead of the legacy
// clear-and-rewrite-the-whole-sheet save, so two teachers can no longer
// overwrite each other's entire class, and every row carries its own
// updatedAt/updatedBy audit stamp. Reads are realtime via onSnapshot, so the
// workspace mirrors what other teachers type within milliseconds.

import { getFirebaseDb } from './firebase';
import type { Firestore } from 'firebase/firestore';
import { emptyStudentScores, type AssessmentStudentScores } from './assessmentScoring';

/** db handle + every firestore helper, resolved together (memoized lazy singleton upstream). */
async function fs(): Promise<{ db: Firestore } & typeof import('firebase/firestore') | null> {
  const db = await getFirebaseDb();
  if (!db) return null;
  return { db, ...(await import('firebase/firestore')) };
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
  createdAt: number | null; // epoch ms (null until server timestamp lands)
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
  updatedAt: number | null;
  updatedBy: string;
}

export function newStudentRow(): Omit<AssessmentStudentDoc, 'id' | 'updatedAt' | 'updatedBy'> {
  return {
    name: '', schoolId: '', sponsorship: 'Pending', amount: '', comments: '', teacherComment: '',
    ...emptyStudentScores(),
  };
}

/** Convert a Firestore doc snapshot to a plain student record (safe field access). */
function toStudent(id: string, data: Record<string, unknown>): AssessmentStudentDoc {
  const num = (k: string): number => {
    const v = data[k];
    const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
    return Number.isFinite(n) ? n : 0;
  };
  const str = (k: string): string => (typeof data[k] === 'string' ? (data[k] as string) : '');
  const ts = data.updatedAt;
  return {
    id,
    name: str('name'), schoolId: str('schoolId'), sponsorship: str('sponsorship') || 'Pending',
    amount: str('amount'), comments: str('comments'), teacherComment: str('teacherComment'),
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
    updatedAt: ts && typeof ts === 'object' && 'toMillis' in (ts as object)
      ? (ts as { toMillis: () => number }).toMillis()
      : null,
    updatedBy: str('updatedBy'),
  };
}

function toClass(id: string, data: Record<string, unknown>): AssessmentClassDoc {
  const str = (k: string): string => (typeof data[k] === 'string' ? (data[k] as string) : '');
  const ms = (v: unknown): number | null =>
    v && typeof v === 'object' && 'toMillis' in (v as object)
      ? (v as { toMillis: () => number }).toMillis()
      : null;
  return {
    id,
    name: str('name'), schoolName: str('schoolName'), teacherName: str('teacherName'),
    teacherUid: str('teacherUid'), teacherEmail: str('teacherEmail'), remarks: str('remarks'),
    createdAt: ms(data.createdAt), updatedAt: ms(data.updatedAt),
  };
}

// ── Classes ──────────────────────────────────────────────────────────

/** All assessment classes owned by the given teacher uid, newest activity first. */
export async function listAssessmentClasses(teacherUid: string): Promise<AssessmentClassDoc[]> {
  const f = await fs();
  if (!f) return [];
  try {
    const snap = await f.getDocs(f.query(
      f.collection(f.db, 'assessment_classes'),
      f.where('teacherUid', '==', teacherUid),
    ));
    const rows = snap.docs.map((d) => toClass(d.id, d.data()));
    rows.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    return rows;
  } catch (e) {
    console.warn('[assessment] listAssessmentClasses failed:', e);
    throw e;
  }
}

export async function createAssessmentClass(input: {
  teacherUid: string;
  teacherEmail: string;
  schoolName: string;
  name: string;
  teacherName: string;
}): Promise<string | null> {
  const f = await fs();
  if (!f) return null;
  const ref = await f.addDoc(f.collection(f.db, 'assessment_classes'), {
    schoolName: input.schoolName.trim(),
    name: input.name.trim(),
    teacherName: input.teacherName.trim(),
    teacherUid: input.teacherUid,
    teacherEmail: input.teacherEmail,
    remarks: '',
    createdAt: f.serverTimestamp(),
    updatedAt: f.serverTimestamp(),
  });
  return ref.id;
}

/** Patch class-level metadata (school/teacher names, overall remarks). */
export async function updateAssessmentClass(
  classId: string,
  patch: Partial<Pick<AssessmentClassDoc, 'schoolName' | 'teacherName' | 'remarks' | 'name'>>,
): Promise<void> {
  const f = await fs();
  if (!f) return;
  await f.updateDoc(f.doc(f.db, 'assessment_classes', classId), {
    ...patch,
    updatedAt: f.serverTimestamp(),
  });
}

// ── Students (realtime) ──────────────────────────────────────────────

/** Realtime subscription to a class roster. Returns an unsubscribe function. */
export function subscribeAssessmentStudents(
  classId: string,
  onUpdate: (students: AssessmentStudentDoc[]) => void,
  onError: (e: unknown) => void,
): () => void {
  let unsub: (() => void) | null = null;
  let cancelled = false;
  void (async () => {
    const f = await fs();
    if (!f || cancelled) {
      if (!cancelled) onError(new Error('Firebase not configured'));
      return;
    }
    try {
      unsub = f.onSnapshot(
        f.collection(f.db, 'assessment_classes', classId, 'students'),
        (snap) => {
          const rows = snap.docs.map((d) => toStudent(d.id, d.data()));
          rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
          onUpdate(rows);
        },
        (err) => onError(err),
      );
    } catch (e) {
      onError(e);
    }
  })();
  return () => { cancelled = true; unsub?.(); };
}

export async function addAssessmentStudent(
  classId: string,
  record: ReturnType<typeof newStudentRow>,
  actorEmail: string,
): Promise<string | null> {
  const f = await fs();
  if (!f) return null;
  const ref = await f.addDoc(f.collection(f.db, 'assessment_classes', classId, 'students'), {
    ...record,
    updatedAt: f.serverTimestamp(),
    updatedBy: actorEmail,
  });
  await f.updateDoc(f.doc(f.db, 'assessment_classes', classId), { updatedAt: f.serverTimestamp() });
  return ref.id;
}

/** Per-field patch — the unit of save in the workspace (debounced per row). */
export async function patchAssessmentStudent(
  classId: string,
  studentId: string,
  patch: Record<string, string | number>,
  actorEmail: string,
): Promise<void> {
  const f = await fs();
  if (!f) return;
  await f.updateDoc(f.doc(f.db, 'assessment_classes', classId, 'students', studentId), {
    ...patch,
    updatedAt: f.serverTimestamp(),
    updatedBy: actorEmail,
  });
}

export async function removeAssessmentStudent(classId: string, studentId: string): Promise<void> {
  const f = await fs();
  if (!f) return;
  await f.deleteDoc(f.doc(f.db, 'assessment_classes', classId, 'students', studentId));
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
  return addAssessmentStudent(classId, rest as ReturnType<typeof newStudentRow>, actorEmail);
}
