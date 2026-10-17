// Universal score submission for the CMC React app.
// Used by MiniMockTest, LearningGames, and any other component that
// generates a score. Submits to Firestore via the Firebase SDK.

import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { submitDrillAttempt } from './firebaseDb';

export interface ScoreSubmission {
  drillSlug: string;
  drillTitle: string;
  drillSource: 'biweek-planner' | 'toefl-ibt' | 'learning-games' | 'rfc3' | 'mini-mock' | 'syntax-clash' | 'tense-master';
  studentName: string;
  scorePct: number;
  correctCount: number;
  totalCount: number;
  durationSeconds?: number | null;
}

/**
 * Submit a score to Firestore. Safe no-op if Firebase isn't configured
 * or if no student is signed in.
 */
export async function submitScore(input: ScoreSubmission): Promise<string | null> {
  if (!db) return null;

  // Check if student is signed in (from localStorage — set by student auth)
  const studentToken = typeof window !== 'undefined' ? localStorage.getItem('cmc-student-token') : null;
  const studentName = typeof window !== 'undefined' ? localStorage.getItem('cmc-student-name') : null;

  if (!studentToken || !studentName) return null; // No student signed in — skip silently

  try {
    const ref = await addDoc(collection(db, 'drill_attempts'), {
      drillSlug: input.drillSlug,
      drillTitle: input.drillTitle,
      drillSource: input.drillSource,
      studentName: studentName,
      studentUid: studentToken, // Using token as UID proxy for static pages
      classId: null,
      scorePct: input.scorePct,
      correctCount: input.correctCount,
      totalCount: input.totalCount,
      durationSeconds: input.durationSeconds ?? null,
      submittedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (e) {
    console.warn('[submitScore] failed:', e);
    return null;
  }
}

/**
 * Submit a score and also fire the GA4 event.
 * Combines analytics tracking + Firestore score recording.
 */
export async function submitScoreWithAnalytics(input: ScoreSubmission): Promise<void> {
  // Fire GA4 event
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
