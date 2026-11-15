// The teacher's "Attempt Feed · Live" on the dashboard — one list, newest
// first, of everything students have handed in.
//
// The feed used to be built from ONE source: `drill_attempts` rows that
// carry one of the teacher's class ids. A bi-weekly test taken through the
// teacher's own share link is stored somewhere else (the private
// `invite_attempts` collection, no class id), so it never reached the feed.
// A teacher who shared the 23-question Diagnostic and then watched the feed
// saw nothing new — only the last older row, e.g. a "4 of 9" result from
// the 9-question Diagnostic the test replaced.
//
// This module merges both sources. It is pure (no network, no React) so
// the rules below are unit-tested:
//   · invite results are always in the feed — they have no class, so the
//     class filter must not hide them;
//   · an attempt that is stored but cannot be graded yet (answer key not
//     open) is listed WITHOUT a score, never with a made-up one;
//   · a bi-weekly result scored out of a different number of questions
//     than the test has today is marked as an earlier version.

import type { InviteScores } from './inviteScores';
import { currentTotal, isEarlierVersion } from './testCounts';
import type { TestCounts } from './testCounts';

export interface FeedRow {
  key: string;
  studentName: string;
  /** Identity for "how many students": account id when known, else the name. */
  who: string;
  drill: string;
  /** Epoch ms of the submission; 0 when unknown. */
  at: number;
  /** scored — has a score · assignment — waits for the teacher's grading ·
   *  waiting — stored, not graded yet because the answer key is not open. */
  kind: 'scored' | 'assignment' | 'waiting';
  scorePct: number;
  correctCount: number;
  totalCount: number;
  /** Taken through this teacher's share (invite) link. */
  viaInvite: boolean;
  /** How many questions the test has today — set for bi-weekly tests. */
  nowTotal?: number;
  /** True when the row was scored on an earlier version of the test. */
  earlier: boolean;
}

/** Firestore Timestamp | { seconds } | ISO string | epoch ms → epoch ms. */
export function toMillis(v: unknown): number {
  if (!v) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof v === 'object') {
    const o = v as { toMillis?: () => number; seconds?: number };
    if (typeof o.toMillis === 'function') return o.toMillis();
    if (typeof o.seconds === 'number') return o.seconds * 1000;
  }
  return 0;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export interface FeedInput {
  /** drill_attempts rows of the teacher's classes (Firestore documents). */
  classAttempts: Array<Record<string, unknown>>;
  /** Class filter of the dashboard, or null for all classes. */
  selectedClass: string | null;
  /** Results of this teacher's share links, or null while not loaded. */
  invite: InviteScores | null;
  /** Question counts of the bi-weekly tests today, or null if unknown. */
  counts: TestCounts | null;
}

export function buildAttemptFeed({ classAttempts, selectedClass, invite, counts }: FeedInput): FeedRow[] {
  const rows: FeedRow[] = [];

  classAttempts.forEach((a, i) => {
    if (selectedClass && a.classId !== selectedClass) return;
    const slug = String(a.drillSlug ?? '');
    const biweekly = a.drillSource === 'biweek-planner';
    const nowTotal = biweekly ? currentTotal(counts, slug) : undefined;
    const totalCount = num(a.totalCount);
    rows.push({
      key: `c:${String(a.id ?? i)}`,
      studentName: String(a.studentName ?? ''),
      who: String(a.studentUid ?? '') || String(a.studentName ?? ''),
      drill: String(a.drillTitle ?? '') || slug || 'Drill',
      at: toMillis(a.submittedAt),
      kind: a.drillSource === 'assignment' ? 'assignment' : 'scored',
      scorePct: num(a.scorePct),
      correctCount: num(a.correctCount),
      totalCount,
      viaInvite: false,
      nowTotal,
      earlier: biweekly && isEarlierVersion(totalCount, nowTotal),
    });
  });

  if (invite) {
    invite.attempts.forEach((a, i) => {
      const nowTotal = currentTotal(counts, a.drillSlug);
      rows.push({
        key: `i:${a.studentName}|${a.drillSlug}|${a.submittedAt}|${i}`,
        studentName: a.studentName,
        who: a.studentName,
        drill: a.drillTitle,
        at: toMillis(a.submittedAt),
        kind: 'scored',
        scorePct: num(a.scorePct),
        correctCount: num(a.correctCount),
        totalCount: num(a.totalCount),
        viaInvite: true,
        nowTotal,
        earlier: isEarlierVersion(num(a.totalCount), nowTotal),
      });
    });
    invite.waiting.forEach((w, i) => {
      rows.push({
        key: `w:${w.studentName}|${w.drillSlug}|${w.submittedAt}|${i}`,
        studentName: w.studentName,
        who: w.studentName,
        drill: w.drillTitle,
        at: toMillis(w.submittedAt),
        kind: 'waiting',
        scorePct: 0,
        correctCount: 0,
        totalCount: 0,
        viaInvite: true,
        nowTotal: currentTotal(counts, w.drillSlug),
        earlier: false,
      });
    });
  }

  // Newest first; rows without a time go last, in their original order.
  return rows
    .map((row, i) => ({ row, i }))
    .sort((x, y) => (y.row.at - x.row.at) || (x.i - y.i))
    .map((x) => x.row);
}

/** "14 Nov, 10:32" — a live feed needs the time of day, not just the date. */
export function feedWhen(at: number): string {
  if (!at) return '—';
  try {
    return new Date(at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return new Date(at).toISOString().slice(0, 16).replace('T', ' ');
  }
}

export interface FeedStats { total: number; avgScore: number; uniqueStudents: number; recentCount: number }

/** Headline numbers above the feed. Only rows that HAVE a score count
 *  toward the average (assignments wait for grading, "waiting" rows for
 *  the answer key); every row counts as activity. */
export function feedStats(rows: FeedRow[], now: number): FeedStats {
  const scored = rows.filter((r) => r.kind === 'scored');
  return {
    total: rows.length,
    avgScore: scored.length ? Math.round(scored.reduce((sum, r) => sum + r.scorePct, 0) / scored.length) : 0,
    uniqueStudents: new Set(rows.map((r) => r.who)).size,
    recentCount: rows.filter((r) => r.at > 0 && now - r.at < 86_400_000).length,
  };
}
