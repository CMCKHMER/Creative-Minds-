// Practice attempts — the React side of AI Phase 01's Score Trajectory.
//
// The TOEFL practice pages (static HTML) write into
//
//   practice_attempts/{uid}/attempts/{attemptId}
//
// through public/assets/js/cmc-practice-attempts.js. This module reads the very
// same documents for the app (home page trend card) with the same field shapes
// and the same trajectory maths, pinned equal by src/tests/practiceAttempts.test.ts.
//
// A band is 0–5 on the rubric's half-point grid; nothing here invents a score.

import { FIREBASE_PROJECT_ID, getValidIdToken } from './firebaseAuth';
import { uidFromIdToken } from './submitScore';

export type PracticeSkill = 'writing' | 'speaking';

export interface PracticeAttempt {
  id: string;
  skill: string;
  band: number;
  traits: Record<string, number>;
  stats: Record<string, number>;
  text: string;
  createdAt: number;
}

export interface TrajectoryPoint {
  band: number;
  createdAt: number;
}

export interface Trajectory {
  count: number;
  points: TrajectoryPoint[];
  latest: number;
  previous: number;
  delta: number;
  best: number;
  direction: 'up' | 'down' | 'flat' | 'first';
}

const BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

function num(value: unknown): number {
  const v = value as { doubleValue?: unknown; integerValue?: unknown } | undefined;
  if (!v) return 0;
  if (v.doubleValue != null) return Number(v.doubleValue);
  if (v.integerValue != null) return Number(v.integerValue);
  return 0;
}

function mapNum(value: unknown): Record<string, number> {
  const v = value as { mapValue?: { fields?: Record<string, unknown> } } | undefined;
  const out: Record<string, number> = {};
  const fields = v?.mapValue?.fields;
  if (fields) {
    for (const [key, field] of Object.entries(fields)) out[key] = num(field);
  }
  return out;
}

/** Firestore REST document -> plain attempt (mirror of the static-page module). */
export function fromDocument(doc: unknown): PracticeAttempt | null {
  const d = doc as { name?: string; fields?: Record<string, unknown> } | null;
  if (!d?.fields) return null;
  const f = d.fields as Record<string, { stringValue?: string; timestampValue?: string }>;
  const parsed = f.createdAt?.timestampValue ? Date.parse(f.createdAt.timestampValue) : 0;
  return {
    id: d.name ? String(d.name).split('/').pop() || '' : '',
    skill: f.skill?.stringValue || '',
    band: num(f.band),
    traits: mapNum(f.traits),
    stats: mapNum(f.stats),
    text: f.text?.stringValue || '',
    createdAt: Number.isFinite(parsed) ? parsed : 0,
  };
}

/**
 * The trend a student sees. Identical maths to
 * public/assets/js/cmc-practice-attempts.js#buildTrajectory.
 */
export function buildTrajectory(
  attempts: Array<Partial<PracticeAttempt>>,
  options: { limit?: number } = {},
): Trajectory {
  const limit = Number.isFinite(options.limit) ? (options.limit as number) : 8;
  const clean = (Array.isArray(attempts) ? attempts : [])
    .filter((a) => a && Number.isFinite(a.band))
    .filter((a) => (a.band as number) >= 0 && (a.band as number) <= 5)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  const points = clean.slice(-limit).map((a) => ({
    band: Math.round((a.band as number) * 2) / 2,
    createdAt: a.createdAt || 0,
  }));

  if (!points.length) {
    return { count: 0, points: [], latest: 0, previous: 0, delta: 0, best: 0, direction: 'first' };
  }

  const latest = points[points.length - 1].band;
  const previous = points.length > 1 ? points[points.length - 2].band : 0;
  const delta = points.length > 1 ? Math.round((latest - previous) * 2) / 2 : 0;
  const best = points.reduce((max, p) => Math.max(max, p.band), 0);
  const direction = points.length < 2 ? 'first' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';

  return { count: points.length, points, latest, previous, delta, best, direction };
}

async function myUid(): Promise<string | null> {
  const token = await getValidIdToken({ sdkFallback: false }).catch(() => null);
  if (!token) return null;
  return uidFromIdToken(token) || null;
}

/** The signed-in student's attempts, newest first. Empty when signed out. */
export async function loadMyAttempts(limit = 20): Promise<PracticeAttempt[]> {
  const uid = await myUid();
  if (!uid) return [];
  const token = await getValidIdToken({ sdkFallback: false }).catch(() => null);
  if (!token) return [];
  try {
    const res = await fetch(
      `${BASE}/practice_attempts/${encodeURIComponent(uid)}/attempts?pageSize=${Math.min(100, Math.max(1, limit))}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return [];
    const data = (await res.json().catch(() => ({}))) as { documents?: unknown[] };
    const docs = Array.isArray(data.documents) ? data.documents : [];
    return docs
      .map(fromDocument)
      .filter((a): a is PracticeAttempt => Boolean(a))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

/** Both skills' trends for the home card. */
export async function loadMyTrajectory(limit = 8): Promise<{
  attempts: PracticeAttempt[];
  writing: Trajectory;
  speaking: Trajectory;
  lastEssay: string;
  lastWriting: PracticeAttempt | null;
  lastSpeaking: PracticeAttempt | null;
}> {
  const attempts = await loadMyAttempts(limit * 3);
  const writingAttempts = attempts.filter((a) => a.skill === 'writing');
  const speakingAttempts = attempts.filter((a) => a.skill === 'speaking');
  const lastWriting = writingAttempts.find((a) => a.text && a.text.trim().length > 40) || null;
  const lastEssay = lastWriting?.text || '';
  return {
    attempts,
    writing: buildTrajectory(writingAttempts, { limit }),
    speaking: buildTrajectory(speakingAttempts, { limit }),
    lastEssay,
    lastWriting,
    lastSpeaking: speakingAttempts[0] || null,
  };
}

export const PRACTICE_ATTEMPTS_COLLECTION = 'practice_attempts';

// ── teacher review ──────────────────────────────────────────────────
// A teacher can read any student's attempts (rules: isVerifiedTeacher) and
// leave one review per attempt in practice_reviews/{attemptId}. The attempt
// itself is never modified.

export interface PracticeReview {
  attemptId: string;
  studentUid: string;
  reviewerUid: string;
  reviewerName: string;
  /** null = "the automatic band stands". */
  band: number | null;
  comment: string;
  createdAt: number;
}

async function teacherToken(): Promise<{ token: string; uid: string } | null> {
  const token = await getValidIdToken().catch(() => null);
  if (!token) return null;
  const uid = uidFromIdToken(token);
  if (!uid) return null;
  return { token, uid };
}

/** Any student's attempts, for a verified teacher. Empty on refusal. */
export async function loadStudentAttempts(studentUid: string, limit = 20): Promise<PracticeAttempt[]> {
  if (!studentUid) return [];
  const auth = await teacherToken();
  if (!auth) return [];
  try {
    const res = await fetch(
      `${BASE}/practice_attempts/${encodeURIComponent(studentUid)}/attempts?pageSize=${Math.min(100, Math.max(1, limit))}`,
      { headers: { Authorization: `Bearer ${auth.token}` } },
    );
    if (!res.ok) return [];
    const data = (await res.json().catch(() => ({}))) as { documents?: unknown[] };
    const docs = Array.isArray(data.documents) ? data.documents : [];
    return docs
      .map(fromDocument)
      .filter((a): a is PracticeAttempt => Boolean(a))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function reviewFromDocument(doc: unknown): PracticeReview | null {
  const d = doc as { name?: string; fields?: Record<string, unknown> } | null;
  if (!d?.fields) return null;
  type FieldValue = {
    stringValue?: string;
    doubleValue?: unknown;
    integerValue?: unknown;
    nullValue?: unknown;
    timestampValue?: string;
  };
  const f = d.fields as Record<string, FieldValue>;
  const bandRaw = f.band;
  const band = bandRaw == null || bandRaw.nullValue != null ? null : num(bandRaw);
  return {
    attemptId: f.attemptId?.stringValue || '',
    studentUid: f.studentUid?.stringValue || '',
    reviewerUid: f.reviewerUid?.stringValue || '',
    reviewerName: f.reviewerName?.stringValue || '',
    band,
    comment: f.comment?.stringValue || '',
    createdAt: f.createdAt?.timestampValue ? Date.parse(f.createdAt.timestampValue) || 0 : 0,
  };
}

/** The review for one attempt, or null when none exists / not readable. */
export async function loadPracticeReview(attemptId: string): Promise<PracticeReview | null> {
  if (!attemptId) return null;
  const auth = await teacherToken();
  if (!auth) return null;
  try {
    const res = await fetch(`${BASE}/practice_reviews/${encodeURIComponent(attemptId)}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (!res.ok) return null;
    return reviewFromDocument(await res.json().catch(() => null));
  } catch {
    return null;
  }
}

/**
 * Upsert the teacher's review of one attempt.
 *
 * @returns { ok, error } — the UI shows the error instead of pretending it saved.
 */
export async function savePracticeReview(input: {
  attemptId: string;
  studentUid: string;
  band: number | null;
  comment: string;
  reviewerName?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const auth = await teacherToken();
  if (!auth) return { ok: false, error: 'Sign in as a verified teacher to review.' };
  if (!input.attemptId || !input.studentUid) return { ok: false, error: 'Missing attempt.' };
  if (input.band != null && (input.band < 0 || input.band > 5)) return { ok: false, error: 'Band must be 0–5.' };
  const comment = String(input.comment || '').trim().slice(0, 600);

  const body = {
    fields: {
      attemptId: { stringValue: input.attemptId },
      studentUid: { stringValue: input.studentUid },
      reviewerUid: { stringValue: auth.uid },
      reviewerName: { stringValue: String(input.reviewerName || '').slice(0, 80) },
      band: input.band == null
        ? { nullValue: null }
        : { doubleValue: Math.round(input.band * 2) / 2 },
      comment: { stringValue: comment },
      createdAt: { timestampValue: new Date().toISOString() },
    },
  };

  try {
    const res = await fetch(`${BASE}/practice_reviews/${encodeURIComponent(input.attemptId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { ok: false, error: err.error?.message || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export const PRACTICE_REVIEWS_COLLECTION = 'practice_reviews';
