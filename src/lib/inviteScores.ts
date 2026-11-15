// Invite-link results → rows for the teacher's score sheet.
//
// Students who take a test through a teacher's invite link are recorded in
// the PRIVATE `invite_attempts` collection (owner-only read), not in the
// public `drill_attempts` feed the score sheet was built on. Until this
// module existed the sheet therefore never showed a single invite result
// made after 9 Nov 2026 — only older rows, some of them for an earlier
// version of the test — which made a fresh, complete attempt look like
// "9 questions, 4 correct".
//
// The test pages are sealed, so a student's device cannot grade: each
// attempt carries the raw answer sheet and is graded HERE, against the
// test's own answer key. The total is always the key's size.

import { gradeSheet, openAnswerKey, parseSheet, sealCodeMatches } from './answerSeal';
import type { AnswerKeyMap } from './answerSeal';
import type { BiweeklyAttempt } from './biweeklyScores';
import { loadSealFiles } from './sealFiles';
import {
  countInviteAttempts, ensureTeacherRegistration, getAnswerSealCode, getRestAuthUid, listAllInviteAttempts, RestError,
} from './testDb';
import type { InviteAttemptDoc } from './testDb';
import { testSlug } from './testCounts';

export type InviteScoresState =
  | 'ok'        // read (and graded where needed)
  | 'signin'    // no teacher session — nothing read
  | 'denied'    // the rules refused this account
  | 'error';    // network / unexpected

/** An attempt that is safely stored but cannot be graded on this device yet
 *  (the answer key is not open). It has no score — never show one. */
export interface WaitingAttempt {
  studentName: string;
  drillTitle: string;
  drillSlug: string;
  submittedAt: string;
}

export interface InviteScores {
  attempts: BiweeklyAttempt[];
  /** Sealed attempts that are saved but could not be graded (key not open). */
  unscored: number;
  /** The same attempts, one entry each (unscored === waiting.length). */
  waiting: WaitingAttempt[];
  state: InviteScoresState;
}

/** Pure part: turn stored invite attempts into sheet rows. `keyFor` returns
 *  the opened answer key of a test slug, or null when it cannot be opened.
 *  Sealed attempts without a key are counted, not shown with a made-up score. */
export function inviteRows(
  docs: Array<Partial<InviteAttemptDoc>>,
  keyFor: (slug: string) => AnswerKeyMap | null,
): { attempts: BiweeklyAttempt[]; unscored: number; waiting: WaitingAttempt[] } {
  const attempts: BiweeklyAttempt[] = [];
  const waiting: WaitingAttempt[] = [];
  for (const d of docs) {
    const drillSlug = String(d.drillSlug ?? '');
    const base = {
      studentName: String(d.studentName ?? '') || 'Unknown',
      drillTitle: String(d.drillTitle ?? '') || drillSlug || 'Bi-weekly test',
      drillSlug,
      classId: '',
      submittedAt: String(d.submittedAt ?? ''),
      viaInvite: true,
    };
    if (d.sealed === true) {
      const sheet = parseSheet(d.sheet);
      const key = keyFor(testSlug(drillSlug));
      if (!sheet || !key) {
        waiting.push({ studentName: base.studentName, drillTitle: base.drillTitle, drillSlug, submittedAt: base.submittedAt });
        continue;
      }
      const g = gradeSheet(sheet, key);
      attempts.push({ ...base, scorePct: g.pct, correctCount: g.correct, totalCount: g.total });
    } else {
      attempts.push({
        ...base,
        scorePct: Number(d.scorePct ?? 0) || 0,
        correctCount: Number(d.correctCount ?? 0) || 0,
        totalCount: Number(d.totalCount ?? 0) || 0,
      });
    }
  }
  return { attempts, unscored: waiting.length, waiting };
}

/** This teacher's invite results, graded. Never throws. */
export async function fetchInviteScores(): Promise<InviteScores> {
  try {
    const uid = await getRestAuthUid();
    if (!uid) return { attempts: [], unscored: 0, waiting: [], state: 'signin' };
    // The rules know a teacher by the teachers list; make sure we are on it.
    await ensureTeacherRegistration().catch(() => false);
    const docs = await listAllInviteAttempts(uid);

    const keys = new Map<string, AnswerKeyMap | null>();
    const sealedSlugs = [...new Set(docs.filter((d) => d.sealed === true).map((d) => testSlug(String(d.drillSlug ?? ''))))];
    if (sealedSlugs.length) {
      try {
        const found = await getAnswerSealCode();
        const { pub, bundle } = await loadSealFiles();
        if (found && (await sealCodeMatches(pub, found.code))) {
          for (const slug of sealedSlugs) {
            keys.set(slug, await openAnswerKey(pub, bundle, found.code, slug).catch(() => null));
          }
        }
      } catch {
        // key not readable — the sealed attempts stay "not scored yet"
      }
    }
    return { ...inviteRows(docs, (slug) => keys.get(slug) ?? null), state: 'ok' };
  } catch (err) {
    const denied = err instanceof RestError && (err.status === 403 || err.status === 401);
    return { attempts: [], unscored: 0, waiting: [], state: denied ? 'denied' : 'error' };
  }
}

/** Cheap "has anything new arrived?" probe for the live feed: the number of
 *  this teacher's invite attempts (one billed read), or null when it cannot
 *  be told (signed out, offline, refused) — callers then simply keep what
 *  they show and try again later. Never throws. */
export async function inviteAttemptCount(): Promise<number | null> {
  try {
    const uid = await getRestAuthUid();
    if (!uid) return null;
    return await countInviteAttempts(uid);
  } catch {
    return null;
  }
}
