// Guest game-sampling & content-access rules.
//
// Policy (owner directive):
//  - Non-signed-up visitors (guests) can ONLY sample select games (capped
//    preview) and CANNOT download anything — every locked action directs
//    them to create a free account.
//  - Students and General Users share the exact same privileges: full access
//    to all games, practice tests, worksheets/homework, and student-copy
//    downloads (teacher keys & teacher tools stay locked).
//  - Verified Teachers have full access across the site (including Teacher
//    Tools, Studio, Bi-Weekly Planner, Daily Assessment workspace, answer
//    keys, and all downloads) — EXCEPT admin areas.
//  - Site Admins have full access including admin areas.

import type { RestoredSession } from './firebaseAuth';

/** In-page Learning Games a non-signed-up visitor may sample (preview-capped). */
export const SAMPLE_LEARNING_GAME_IDS: ReadonlySet<string> = new Set([
  'affix-architect',
  'sound-match',
  'context-clue-sleuth',
]);

/** Maximum number of questions a guest may preview in a sample Learning Game. */
export const GUEST_SAMPLE_QUESTION_LIMIT = 2;

/** Brain Lounge arcade cartridges a non-signed-up visitor may sample (1-level trial). */
export const SAMPLE_BRAIN_GAME_IDS: ReadonlySet<string> = new Set([
  'brickforge',
]);

/** Maximum level a guest may play in BrickForge before the sign-up gate appears. */
export const GUEST_BRICKFORGE_MAX_LEVEL = 1;

/** True when a valid, email-verified CMC account is signed in. */
export function hasActiveAccount(session?: RestoredSession | null): boolean {
  return Boolean(session && session.idToken && session.emailVerified);
}

/** True when the signed-in user is a Verified Teacher (or site Admin). */
export function hasVerifiedTeacherAccess(session?: RestoredSession | null): boolean {
  return Boolean(hasActiveAccount(session) && session?.role === 'teacher');
}

/** True when a non-signed-up visitor may open a limited sample of this Learning Game. */
export function isSampleLearningGame(gameId: string): boolean {
  return SAMPLE_LEARNING_GAME_IDS.has(gameId);
}

/** True when a non-signed-up visitor may launch a 1-level sample of this Brain Lounge cartridge. */
export function isSampleBrainGame(gameId: string): boolean {
  return SAMPLE_BRAIN_GAME_IDS.has(gameId);
}

/** True when a user is allowed to download or print a resource copy.
 *  - Guests: NEVER allowed to download anything.
 *  - Student / General User: allowed to download 'student' copies only.
 *  - Verified Teacher / Admin: allowed to download both 'student' and 'teacher' copies. */
export function canDownloadCopy(
  session: RestoredSession | null | undefined,
  copy: 'student' | 'teacher' = 'student',
): boolean {
  if (!hasActiveAccount(session)) return false;
  if (copy === 'teacher') return hasVerifiedTeacherAccess(session);
  return true;
}

/** Check whether a round index (0-based) is reachable in a Learning Game. */
export function canPlayGameRound(
  session: RestoredSession | null | undefined,
  gameId: string,
  roundIndex: number,
): boolean {
  if (hasActiveAccount(session)) return true;
  if (!isSampleLearningGame(gameId)) return false;
  return roundIndex >= 0 && roundIndex < GUEST_SAMPLE_QUESTION_LIMIT;
}
