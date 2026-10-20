// Universal score submission for the CMC React app.
// Used by MiniMockTest, LearningGames, and any other React component
// that generates a score. Submits to Firestore via the REST API using
// the signed-in student's Firebase ID token (the same one stored in
// localStorage by firebaseAuth.ts and used by the static HTML
// worksheets).
//
// This is the React-side equivalent of the inline Firestore POST block
// injected into the standalone HTML worksheets by scripts/add_role_indicator.py
// and scripts/process_rfc2_files.py — same field schema, same auth
// pattern, same drill_attempts collection. The dashboard + ticker
// aggregate from this single collection.

import { FIREBASE_PROJECT_ID, getValidIdToken } from './firebaseAuth';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export type DrillSource =
  | 'biweek-planner'
  | 'toefl-ibt'
  | 'learning-games'
  | 'rfc3'
  | 'rfc2'
  | 'mini-mock'
  | 'syntax-clash'
  | 'tense-master'
  | 'writequest';

export interface ScoreSubmission {
  drillSlug: string;
  drillTitle: string;
  drillSource: DrillSource;
  studentName?: string; // overrides localStorage.cmc-student-name if provided
  scorePct: number;
  correctCount: number;
  totalCount: number;
  durationSeconds?: number | null;
}

/**
 * Submit a drill attempt to Firestore via the REST API.
 *
 * Behavior:
 * - If the user is not signed in (no `cmc-student-token` in localStorage),
 *   the function is a silent no-op (returns null). This matches the
 *   behavior of the static HTML worksheets' inline POST block.
 * - If the user IS signed in, the function POSTs to
 *   `drill_attempts` using the user's Firebase ID token as the
 *   `Authorization: Bearer` header. Firestore security rules require
 *   `request.auth != null` for create, so this is the canonical path.
 * - Expired/near-expiry tokens are silently refreshed first via the
 *   securetoken grant (getValidIdToken) — a session that has simply aged
 *   past the 1-hour ID-token lifetime no longer loses its submission.
 * - The studentUid field is populated from `cmc-student-uid` in
 *   localStorage (set by firebaseAuth.ts at sign-in). Earlier versions
 *   of this function wrongly stored the JWT itself as studentUid.
 *
 * The submission is non-blocking — failures are logged to the console
 * as a warning but never throw, so the calling component's UI flow
 * (e.g., showing a results screen) is never disrupted by a network
 * blip.
 */
export async function submitScore(input: ScoreSubmission): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const idToken = await getValidIdToken();
  if (!idToken) return null; // No signed-in student — silent skip

  const studentUid = localStorage.getItem('cmc-student-uid') || '';
  const studentName = input.studentName || localStorage.getItem('cmc-student-name') || '';
  if (!studentName) return null;

  const body = {
    fields: {
      drillSlug: { stringValue: input.drillSlug },
      drillTitle: { stringValue: input.drillTitle },
      drillSource: { stringValue: input.drillSource },
      studentName: { stringValue: studentName },
      studentUid: { stringValue: studentUid },
      classId: { nullValue: null },
      scorePct: { integerValue: String(Math.round(input.scorePct)) },
      correctCount: { integerValue: String(input.correctCount) },
      totalCount: { integerValue: String(input.totalCount) },
      durationSeconds: input.durationSeconds != null
        ? { integerValue: String(input.durationSeconds) }
        : { nullValue: null },
      submittedAt: { timestampValue: new Date().toISOString() },
    },
  };

  try {
    const res = await fetch(`${FIRESTORE_BASE}/drill_attempts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[submitScore] Firestore POST failed:', err?.error?.message || `HTTP ${res.status}`);
      return null;
    }
    const data = await res.json().catch(() => ({}));
    // Firestore returns { name: 'projects/.../documents/drill_attempts/{id}' }
    return data.name ? data.name.split('/').pop() : null;
  } catch (e) {
    console.warn('[submitScore] network error:', e);
    return null;
  }
}

/**
 * Submit a score and also fire the GA4 event. Combines analytics
 * tracking + Firestore score recording. Safe to call from any
 * component that just finished scoring an activity.
 */
export async function submitScoreWithAnalytics(input: ScoreSubmission): Promise<void> {
  // Fire GA4 event (non-blocking)
  import('./analytics').then(({ trackDrillComplete }) => {
    trackDrillComplete({
      drillSlug: input.drillSlug,
      drillTitle: input.drillTitle,
      source: input.drillSource as any,
      scorePct: input.scorePct,
      correct: input.correctCount,
      total: input.totalCount,
      durationSeconds: input.durationSeconds ?? 0,
    });
  }).catch(() => {});

  // Submit to Firestore
  await submitScore(input);
}
