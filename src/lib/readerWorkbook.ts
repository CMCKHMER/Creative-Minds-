/*
 * Pure grading, local autosave, and offline-resilient teacher hand-in for the
 * Kid 1–6 interactive reader workbooks (src/data/readerWorkbooks.ts).
 */

import type {
  CrosswordClue,
  MultiBlankSlot,
  ReaderWorkbookMeta,
  WorkbookActivity,
  WorkbookSection,
} from '../data/readerWorkbooks';
import { FIREBASE_PROJECT_ID, getValidIdToken } from './firebaseAuth';
import { displayStudentName, friendlyNameFromEmail, looksLikeEmail } from './studentName';
import { uidFromIdToken } from './submitScore';

const FIRESTORE_DRILL_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/drill_attempts`;

export const workbookStateKey = (bookId: string): string => `cmc-reader-wb-state:${bookId}`;
export const WORKBOOK_OUTBOX_KEY = 'cmc-reader-wb-outbox';

// ── Text normalization & item grading ───────────────────────────────────────

export function normalizeWord(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function normalizeSentence(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\s+([.?!,])$/, '$1')
    .replace(/[.?!]+$/, '')
    .toLowerCase();
}

export interface GradedEntry {
  id: string;
  sectionId: string;
  expected: string;
  given: string;
  answered: boolean;
  correct: boolean;
}

export interface SectionGrade {
  answered: number;
  correct: number;
  total: number;
}

export interface WorkbookGrade {
  answered: number;
  correct: number;
  total: number;
  pct: number;
  byItem: Record<string, GradedEntry>;
  bySection: Record<string, SectionGrade>;
}

function collectSlots(parts: ReadonlyArray<string | MultiBlankSlot>): MultiBlankSlot[] {
  return parts.filter((part): part is MultiBlankSlot => typeof part === 'object' && part !== null);
}

function gradeActivity(
  sectionId: string,
  activity: WorkbookActivity,
  answers: Record<string, string>,
  push: (entry: GradedEntry) => void,
): void {
  const checkWord = (id: string, expected: string) => {
    const raw = (answers[id] ?? '').trim();
    const answered = raw.length > 0;
    const correct = answered && normalizeWord(raw) === normalizeWord(expected);
    push({ id, sectionId, expected, given: raw, answered, correct });
  };

  switch (activity.kind) {
    case 'bank-fill':
      for (const item of activity.items) checkWord(item.id, item.answer);
      return;
    case 'multi-blank':
      for (const sentence of activity.sentences) {
        for (const slot of collectSlots(sentence.parts)) checkWord(slot.id, slot.answer);
      }
      return;
    case 'cause-effect':
      for (const row of activity.rows) {
        for (const slot of collectSlots(row.cause)) checkWord(slot.id, slot.answer);
        for (const slot of collectSlots(row.effect)) checkWord(slot.id, slot.answer);
      }
      return;
    case 'binary-choice':
      for (const item of activity.items) checkWord(item.id, item.answer);
      return;
    case 'true-false':
      for (const item of activity.items) checkWord(item.id, item.answer);
      return;
    case 'match-qa':
      for (const item of activity.items) checkWord(item.id, item.answer);
      return;
    case 'mcq':
      for (const item of activity.items) checkWord(item.id, item.answer);
      return;
    case 'word-search':
      for (const word of activity.words) checkWord(word.id, word.answer);
      return;
    case 'crossword':
      for (const clue of activity.clues) checkWord(clue.id, clue.answer);
      return;
    case 'sequence':
      for (const item of activity.items) checkWord(item.id, String(item.answer));
      return;
    case 'unscramble':
      for (const item of activity.items) {
        const raw = (answers[item.id] ?? '').trim();
        const answered = raw.length > 0;
        const correct = answered && normalizeSentence(raw) === normalizeSentence(item.answer);
        push({ id: item.id, sectionId, expected: item.answer, given: raw, answered, correct });
      }
      return;
    case 'open-prompts':
    case 'book-report':
      // Personal writing & book report: autosaved + printable, not auto-scored.
      return;
  }
}

export function gradeWorkbook(
  workbook: ReaderWorkbookMeta,
  answers: Record<string, string>,
): WorkbookGrade {
  const byItem: Record<string, GradedEntry> = {};
  const bySection: Record<string, SectionGrade> = {};
  let answered = 0;
  let correct = 0;
  let total = 0;

  for (const section of workbook.sections) {
    const sec: SectionGrade = { answered: 0, correct: 0, total: 0 };
    for (const activity of section.activities) {
      gradeActivity(section.id, activity, answers, (entry) => {
        byItem[entry.id] = entry;
        sec.total += 1;
        total += 1;
        if (entry.answered) {
          sec.answered += 1;
          answered += 1;
        }
        if (entry.correct) {
          sec.correct += 1;
          correct += 1;
        }
      });
    }
    bySection[section.id] = sec;
  }

  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((correct / total) * 100))) : 0;
  return { answered, correct, total, pct, byItem, bySection };
}

export function countSectionItems(section: WorkbookSection): number {
  let count = 0;
  for (const activity of section.activities) {
    gradeActivity(section.id, activity, {}, () => { count += 1; });
  }
  return count;
}

// ── Word-search & crossword geometry ────────────────────────────────────────

export interface WordSearchSelection {
  cells: Array<readonly [number, number]>;
  word: string;
  reversed: string;
}

/** Straight horizontal, vertical, or 45° diagonal line between two grid cells. */
export function wordSearchLine(
  grid: readonly string[],
  start: readonly [number, number],
  end: readonly [number, number],
): WordSearchSelection | null {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const [r1, c1] = start;
  const [r2, c2] = end;
  if (r1 < 0 || c1 < 0 || r2 < 0 || c2 < 0 || r1 >= rows || r2 >= rows || c1 >= cols || c2 >= cols) {
    return null;
  }
  const dr = r2 - r1;
  const dc = c2 - c1;
  const steps = Math.max(Math.abs(dr), Math.abs(dc));
  if (steps === 0) return null;
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
  const sr = Math.sign(dr);
  const sc = Math.sign(dc);
  const cells: Array<readonly [number, number]> = [];
  let word = '';
  for (let i = 0; i <= steps; i += 1) {
    const r = r1 + sr * i;
    const c = c1 + sc * i;
    const ch = grid[r]?.[c];
    if (!ch) return null;
    cells.push([r, c]);
    word += ch.toLowerCase();
  }
  return { cells, word, reversed: [...word].reverse().join('') };
}

export interface CrosswordCell {
  row: number;
  col: number;
  solution: string;
  number: number | null;
  acrossId: string | null;
  downId: string | null;
}

/** Builds a 2-D matrix of active cells (null for dark spacer squares). */
export function buildCrosswordGrid(
  rows: number,
  cols: number,
  clues: readonly CrosswordClue[],
): Array<Array<CrosswordCell | null>> {
  const matrix: Array<Array<CrosswordCell | null>> = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null),
  );
  for (const clue of clues) {
    const letters = clue.answer.toLowerCase();
    for (let i = 0; i < letters.length; i += 1) {
      const r = clue.direction === 'down' ? clue.row + i : clue.row;
      const c = clue.direction === 'across' ? clue.col + i : clue.col;
      if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
      const existing = matrix[r]?.[c] ?? null;
      const cell: CrosswordCell = existing ?? {
        row: r,
        col: c,
        solution: letters[i] ?? '',
        number: null,
        acrossId: null,
        downId: null,
      };
      if (i === 0 && cell.number === null) cell.number = clue.number;
      if (clue.direction === 'across') cell.acrossId = clue.id;
      else cell.downId = clue.id;
      matrix[r]![c] = cell;
    }
  }
  return matrix;
}

// ── Saved workbook progress ─────────────────────────────────────────────────

export interface FirstCheckSnapshot {
  correct: number;
  answered: number;
  total: number;
}

export interface SubmissionReceipt {
  correct: number;
  total: number;
  pct: number;
  at: number;
  name: string;
}

export interface SavedWorkbookState {
  answers: Record<string, string>;
  notes: Record<string, string>;
  studentName: string;
  firstCheck: FirstCheckSnapshot | null;
  checkCount: number;
  lastSubmitted: SubmissionReceipt | null;
  updatedAt: number;
}

export function emptyWorkbookState(defaultName = ''): SavedWorkbookState {
  return {
    answers: {},
    notes: {},
    studentName: defaultName,
    firstCheck: null,
    checkCount: 0,
    lastSubmitted: null,
    updatedAt: 0,
  };
}

function cleanStringMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' && key.length <= 80) out[key] = value.slice(0, 2000);
  }
  return out;
}

export function parseWorkbookState(stored: string | null, fallbackName = ''): SavedWorkbookState {
  if (!stored) return emptyWorkbookState(fallbackName);
  try {
    const raw = JSON.parse(stored) as Partial<SavedWorkbookState>;
    if (!raw || typeof raw !== 'object') return emptyWorkbookState(fallbackName);
    const fc = raw.firstCheck;
    const firstCheck = fc
      && typeof fc.correct === 'number'
      && typeof fc.answered === 'number'
      && typeof fc.total === 'number'
      ? { correct: Math.max(0, Math.floor(fc.correct)), answered: Math.max(0, Math.floor(fc.answered)), total: Math.max(0, Math.floor(fc.total)) }
      : null;
    const sub = raw.lastSubmitted;
    const lastSubmitted = sub
      && typeof sub.correct === 'number'
      && typeof sub.total === 'number'
      && typeof sub.pct === 'number'
      && typeof sub.at === 'number'
      ? {
          correct: Math.max(0, Math.floor(sub.correct)),
          total: Math.max(0, Math.floor(sub.total)),
          pct: Math.max(0, Math.min(100, Math.round(sub.pct))),
          at: sub.at,
          name: typeof sub.name === 'string' ? sub.name.slice(0, 40) : '',
        }
      : null;
    const savedName = typeof raw.studentName === 'string' ? raw.studentName.trim().slice(0, 40) : '';
    return {
      answers: cleanStringMap(raw.answers),
      notes: cleanStringMap(raw.notes),
      studentName: savedName && !looksLikeEmail(savedName) ? savedName : fallbackName,
      firstCheck,
      checkCount: typeof raw.checkCount === 'number' && raw.checkCount >= 0 ? Math.floor(raw.checkCount) : 0,
      lastSubmitted,
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
    };
  } catch {
    return emptyWorkbookState(fallbackName);
  }
}

export function isTeacherLocalSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const token = window.localStorage.getItem('cmc-student-token');
    const role = window.localStorage.getItem('cmc-student-role');
    const email = (window.localStorage.getItem('cmc-student-email') || '').toLowerCase();
    const uid = window.localStorage.getItem('cmc-student-uid') || '';
    return Boolean(token && (role === 'teacher' || email.includes('edu') || uid === '5iLvnjzmV8QY7WFZhyTq6PIgcI63'));
  } catch {
    return false;
  }
}

export function readStoredStudentDefaultName(): string {
  if (typeof window === 'undefined') return '';
  try {
    const stored = (window.localStorage.getItem('cmc-student-name') || '').trim();
    if (stored && !looksLikeEmail(stored)) return stored.slice(0, 40);
    const email = (window.localStorage.getItem('cmc-student-email') || '').trim();
    if (email) return friendlyNameFromEmail(email).slice(0, 40);
    return '';
  } catch {
    return '';
  }
}

export function loadWorkbookState(bookId: string): SavedWorkbookState {
  const fallback = readStoredStudentDefaultName();
  if (typeof window === 'undefined') return emptyWorkbookState(fallback);
  try {
    return parseWorkbookState(window.localStorage.getItem(workbookStateKey(bookId)), fallback);
  } catch {
    return emptyWorkbookState(fallback);
  }
}

export function saveWorkbookState(bookId: string, state: SavedWorkbookState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      workbookStateKey(bookId),
      JSON.stringify({ ...state, updatedAt: Date.now() }),
    );
  } catch {
    /* private mode: the workbook still works for this session */
  }
}

/** Quick progress summary for Reading Room & Kid Program cards. */
export function readWorkbookProgress(workbook: ReaderWorkbookMeta): {
  answered: number;
  total: number;
  pctDone: number;
  lastSubmitted: SubmissionReceipt | null;
} {
  const state = loadWorkbookState(workbook.id);
  const grade = gradeWorkbook(workbook, state.answers);
  const pctDone = grade.total > 0 ? Math.round((grade.answered / grade.total) * 100) : 0;
  return {
    answered: grade.answered,
    total: grade.total,
    pctDone,
    lastSubmitted: state.lastSubmitted,
  };
}

// ── Submit to Teacher + Device Outbox ───────────────────────────────────────

export interface WorkbookSubmissionPayload {
  bookId: string;
  drillSlug: string;
  drillTitle: string;
  studentName: string;
  correctCount: number;
  totalCount: number;
  scorePct: number;
  firstCorrectCount: number | null;
  firstAnsweredCount: number | null;
  checkCount: number;
  queuedAt: number;
}

export function cleanSubmitName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const safe = looksLikeEmail(trimmed) ? displayStudentName(trimmed) : trimmed;
  return safe.trim().slice(0, 40);
}

export function readWorkbookOutbox(): WorkbookSubmissionPayload[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(WORKBOOK_OUTBOX_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (item): item is WorkbookSubmissionPayload =>
        Boolean(item)
        && typeof item === 'object'
        && typeof item.bookId === 'string'
        && typeof item.drillSlug === 'string'
        && typeof item.drillTitle === 'string'
        && typeof item.studentName === 'string'
        && typeof item.correctCount === 'number'
        && typeof item.totalCount === 'number'
        && typeof item.scorePct === 'number',
    );
  } catch {
    return [];
  }
}

function writeWorkbookOutbox(items: WorkbookSubmissionPayload[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (items.length === 0) window.localStorage.removeItem(WORKBOOK_OUTBOX_KEY);
    else window.localStorage.setItem(WORKBOOK_OUTBOX_KEY, JSON.stringify(items.slice(-20)));
  } catch {
    /* private mode */
  }
}

function upsertOutbox(entry: WorkbookSubmissionPayload): void {
  const key = normalizeWord(entry.studentName);
  const rest = readWorkbookOutbox().filter(
    (item) => !(item.drillSlug === entry.drillSlug && normalizeWord(item.studentName) === key),
  );
  rest.push(entry);
  writeWorkbookOutbox(rest);
}

function dropFromOutbox(drillSlug: string, studentName: string): void {
  const key = normalizeWord(studentName);
  const rest = readWorkbookOutbox().filter(
    (item) => !(item.drillSlug === drillSlug && normalizeWord(item.studentName) === key),
  );
  writeWorkbookOutbox(rest);
}

export function buildFirestoreWorkbookDoc(
  payload: WorkbookSubmissionPayload,
  auth: { uid: string; classId: string } | null,
): { fields: Record<string, unknown> } {
  const safeTotal = Math.max(0, Math.min(500, Math.round(payload.totalCount)));
  const safeCorrect = Math.max(0, Math.min(safeTotal, Math.round(payload.correctCount)));
  const safePct = Math.max(0, Math.min(100, Math.round(payload.scorePct)));
  const fields: Record<string, unknown> = {
    drillSlug: { stringValue: payload.drillSlug.slice(0, 64) },
    drillTitle: { stringValue: payload.drillTitle.slice(0, 160) },
    // Matches the classroom homework rule branch in firestore.rules so both
    // signed-in students and named classroom learners can submit cleanly.
    drillSource: { stringValue: 'rfc3' },
    studentName: { stringValue: cleanSubmitName(payload.studentName) },
    studentUid: { stringValue: auth ? auth.uid : '' },
    classId: auth && auth.classId ? { stringValue: auth.classId.slice(0, 40) } : { nullValue: null },
    scorePct: { integerValue: String(safePct) },
    correctCount: { integerValue: String(safeCorrect) },
    totalCount: { integerValue: String(safeTotal) },
    checkCount: { integerValue: String(Math.max(0, Math.round(payload.checkCount))) },
    submittedAt: { timestampValue: new Date().toISOString() },
  };
  if (payload.firstCorrectCount !== null) {
    fields.firstCorrectCount = { integerValue: String(Math.max(0, Math.min(safeTotal, Math.round(payload.firstCorrectCount)))) };
  }
  if (payload.firstAnsweredCount !== null) {
    fields.firstAnsweredCount = { integerValue: String(Math.max(0, Math.min(safeTotal, Math.round(payload.firstAnsweredCount)))) };
  }
  return { fields };
}

async function sendPayloadOnce(payload: WorkbookSubmissionPayload): Promise<boolean> {
  const name = cleanSubmitName(payload.studentName);
  if (!name) return false;
  const cleanPayload: WorkbookSubmissionPayload = { ...payload, studentName: name };

  // 1. Prefer the signed-in CMC session (getValidIdToken handles renewal with
  //    application/x-www-form-urlencoded).
  const token = await getValidIdToken({ keepSessionOnUnverified: true }).catch(() => null);
  const tokenUid = uidFromIdToken(token);
  const storedUid = typeof window !== 'undefined' ? (window.localStorage.getItem('cmc-student-uid') || tokenUid) : '';
  const uid = token && tokenUid && storedUid === tokenUid ? tokenUid : '';

  if (token && uid) {
    const classId = (window.localStorage.getItem('cmc-student-classId') || '').trim();
    try {
      const signedRes = await fetch(FIRESTORE_DRILL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(buildFirestoreWorkbookDoc(cleanPayload, { uid, classId })),
      });
      if (signedRes.ok) return true;
      // Network/server outage: stop and let the outbox retry under the account later.
      if (signedRes.status !== 401 && signedRes.status !== 403) return false;
    } catch {
      return false;
    }
  }

  // 2. Classroom fallback: validated rfc3 guest branch (empty studentUid,
  //    1–40 char studentName, classId null).
  try {
    const guestRes = await fetch(FIRESTORE_DRILL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildFirestoreWorkbookDoc(cleanPayload, null)),
    });
    return guestRes.ok;
  } catch {
    return false;
  }
}

function announceDrillSubmitted(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('cmc-drill-submitted'));
  } catch {
    /* older browsers fall back to polling */
  }
}

export interface WorkbookSubmitResult {
  ok: boolean;
  queued: boolean;
  message: string;
  receipt: SubmissionReceipt | null;
}

export async function submitWorkbookToTeacher(
  payload: WorkbookSubmissionPayload,
): Promise<WorkbookSubmitResult> {
  const name = cleanSubmitName(payload.studentName);
  if (!name) {
    return {
      ok: false,
      queued: false,
      message: 'Please write your name at the top before sending to your teacher.',
      receipt: null,
    };
  }
  const normalized: WorkbookSubmissionPayload = { ...payload, studentName: name };
  const ok = await sendPayloadOnce(normalized);
  if (ok) {
    dropFromOutbox(normalized.drillSlug, name);
    announceDrillSubmitted();
    import('./analytics')
      .then(({ trackDrillComplete }) => {
        trackDrillComplete({
          drillSlug: normalized.drillSlug,
          drillTitle: normalized.drillTitle,
          source: 'learning-games',
          scorePct: normalized.scorePct,
          correct: normalized.correctCount,
          total: normalized.totalCount,
          durationSeconds: 0,
        });
      })
      .catch(() => {});
    const receipt: SubmissionReceipt = {
      correct: normalized.correctCount,
      total: normalized.totalCount,
      pct: normalized.scorePct,
      at: Date.now(),
      name,
    };
    return {
      ok: true,
      queued: false,
      message: `Submitted! ${receipt.correct}/${receipt.total} (${receipt.pct}%) sent to your teacher for ${name}.`,
      receipt,
    };
  }

  upsertOutbox(normalized);
  return {
    ok: false,
    queued: true,
    message: 'Not sent yet — saved on this device. It will send automatically when the connection returns, or press Retry.',
    receipt: null,
  };
}

/** Retries any unsent workbook hand-ins stored on this device. */
export async function flushWorkbookOutbox(forSlug?: string): Promise<{ sent: number; remaining: number }> {
  const all = readWorkbookOutbox();
  if (all.length === 0) return { sent: 0, remaining: 0 };
  let sent = 0;
  for (const item of all) {
    if (forSlug && item.drillSlug !== forSlug) continue;
    const ok = await sendPayloadOnce(item);
    if (ok) {
      sent += 1;
      dropFromOutbox(item.drillSlug, item.studentName);
      // Stamp the saved receipt for that book so the student sees it succeeded.
      const prev = loadWorkbookState(item.bookId);
      saveWorkbookState(item.bookId, {
        ...prev,
        lastSubmitted: {
          correct: item.correctCount,
          total: item.totalCount,
          pct: item.scorePct,
          at: Date.now(),
          name: item.studentName,
        },
      });
    }
  }
  if (sent > 0) announceDrillSubmitted();
  const remaining = readWorkbookOutbox().filter((item) => !forSlug || item.drillSlug === forSlug).length;
  return { sent, remaining };
}
