// The dashboard's "Attempt Feed · Live".
//
// Regression for the owner's report (14 Nov 2026): the Diagnostic was shared
// with the planner's Share button, a student took all 23 questions, and the
// live feed showed nothing new — only an older "4 of 9" row from the
// 9-question Diagnostic. The feed read class drills only; results of share
// links live in another collection and were never merged in.

import { describe, expect, it } from 'vitest';
import { buildAttemptFeed, feedStats, feedWhen, toMillis } from '../lib/attemptFeed';
import { inviteRows } from '../lib/inviteScores';
import type { InviteScores } from '../lib/inviteScores';
import type { TestCounts } from '../lib/testCounts';

const counts: TestCounts = {
  diagnostic: { title: 'Orientation Diagnostic', kicker: 'Week 2', total: 23, parts: [] },
};

/** What Firestore hands back for a class drill: a Timestamp-like submittedAt. */
const stamp = (iso: string) => ({ toMillis: () => Date.parse(iso), toDate: () => new Date(iso) });

const oldDiagnostic = {
  id: 'old1', classId: 'class-a', studentName: 'Earlier Attempt', studentUid: 'u-old',
  drillSlug: 'diagnostic.html', drillTitle: 'Orientation Diagnostic', drillSource: 'biweek-planner',
  scorePct: 44, correctCount: 4, totalCount: 9, submittedAt: stamp('2026-11-08T17:00:00.000Z'),
};
const vocabDrill = {
  id: 'd2', classId: 'class-b', studentName: 'Chan Vanna', studentUid: 'u-2',
  drillSlug: 'vocab-1', drillTitle: 'Vocabulary 1', drillSource: 'drill',
  scorePct: 90, correctCount: 9, totalCount: 10, submittedAt: stamp('2026-11-10T02:00:00.000Z'),
};

const invite = (over: Partial<InviteScores> = {}): InviteScores => ({
  attempts: [{
    studentName: 'Sok Dara', drillTitle: 'Orientation Diagnostic', drillSlug: 'diagnostic.html', classId: '',
    scorePct: 74, correctCount: 17, totalCount: 23, submittedAt: '2026-11-14T03:00:00.000Z', viaInvite: true,
  }],
  unscored: 0,
  waiting: [],
  state: 'ok',
  ...over,
});

describe('attempt feed — class drills and share-link results in one list', () => {
  it('the test that was just shared is in the feed, above the older 9-question row', () => {
    const feed = buildAttemptFeed({ classAttempts: [oldDiagnostic], selectedClass: null, invite: invite(), counts });
    expect(feed.map((r) => r.studentName)).toEqual(['Sok Dara', 'Earlier Attempt']);
    expect(feed[0]).toMatchObject({ kind: 'scored', viaInvite: true, correctCount: 17, totalCount: 23, scorePct: 74, earlier: false, nowTotal: 23 });
    expect(feed[1]).toMatchObject({ kind: 'scored', viaInvite: false, correctCount: 4, totalCount: 9, earlier: true, nowTotal: 23 });
  });

  it('without the share-link results the feed is what it was — only the old row (the reported symptom)', () => {
    const feed = buildAttemptFeed({ classAttempts: [oldDiagnostic], selectedClass: null, invite: null, counts });
    expect(feed).toHaveLength(1);
    expect(feed[0].totalCount).toBe(9);
  });

  it('a class filter never hides share-link results (they belong to no class)', () => {
    const feed = buildAttemptFeed({ classAttempts: [oldDiagnostic, vocabDrill], selectedClass: 'class-b', invite: invite(), counts });
    expect(feed.map((r) => r.studentName)).toEqual(['Sok Dara', 'Chan Vanna']);
  });

  it('a teacher with no class at all still sees share-link results', () => {
    const feed = buildAttemptFeed({ classAttempts: [], selectedClass: null, invite: invite(), counts });
    expect(feed).toHaveLength(1);
    expect(feed[0].studentName).toBe('Sok Dara');
  });

  it('an attempt that cannot be graded yet is listed without a score, with the test\'s question count', () => {
    const scores = invite({
      attempts: [],
      unscored: 1,
      waiting: [{ studentName: 'Sok Dara', drillTitle: 'Orientation Diagnostic', drillSlug: 'diagnostic.html', submittedAt: '2026-11-14T03:00:00.000Z' }],
    });
    const feed = buildAttemptFeed({ classAttempts: [oldDiagnostic], selectedClass: null, invite: scores, counts });
    expect(feed[0]).toMatchObject({ studentName: 'Sok Dara', kind: 'waiting', nowTotal: 23, earlier: false });
  });

  it('only bi-weekly tests are compared with the count file: another drill with the same slug is left alone', () => {
    const other = { ...oldDiagnostic, id: 'x', drillSource: 'drill' };
    const [row] = buildAttemptFeed({ classAttempts: [other], selectedClass: null, invite: null, counts });
    expect(row.earlier).toBe(false);
    expect(row.nowTotal).toBeUndefined();
  });

  it('assignments keep their "pending grade" state', () => {
    const a = { ...vocabDrill, id: 'as1', drillSource: 'assignment', scorePct: 0 };
    expect(buildAttemptFeed({ classAttempts: [a], selectedClass: null, invite: null, counts })[0].kind).toBe('assignment');
  });

  it('sorts across both sources by time; rows without a time go last', () => {
    const noTime = { ...vocabDrill, id: 'nt', studentName: 'No Time', submittedAt: null };
    const feed = buildAttemptFeed({ classAttempts: [noTime, oldDiagnostic, vocabDrill], selectedClass: null, invite: invite(), counts });
    expect(feed.map((r) => r.studentName)).toEqual(['Sok Dara', 'Chan Vanna', 'Earlier Attempt', 'No Time']);
    expect(new Set(feed.map((r) => r.key)).size).toBe(feed.length);
  });

  it('reads every shape of submission time', () => {
    const iso = '2026-11-14T03:00:00.000Z';
    const ms = Date.parse(iso);
    expect(toMillis(iso)).toBe(ms);
    expect(toMillis(ms)).toBe(ms);
    expect(toMillis(stamp(iso))).toBe(ms);
    expect(toMillis({ seconds: ms / 1000 })).toBe(ms);
    expect(toMillis('not a date')).toBe(0);
    expect(toMillis(null)).toBe(0);
    expect(feedWhen(0)).toBe('—');
    expect(feedWhen(ms)).not.toBe('—');
  });

  it('headline numbers count share-link results; unscored rows stay out of the average', () => {
    const scores = invite({
      waiting: [{ studentName: 'Late Student', drillTitle: 'Orientation Diagnostic', drillSlug: 'diagnostic.html', submittedAt: '2026-11-14T03:30:00.000Z' }],
      unscored: 1,
    });
    const feed = buildAttemptFeed({ classAttempts: [oldDiagnostic, vocabDrill], selectedClass: null, invite: scores, counts });
    const s = feedStats(feed, Date.parse('2026-11-14T04:00:00.000Z'));
    expect(s.total).toBe(4);
    expect(s.uniqueStudents).toBe(4);
    expect(s.recentCount).toBe(2); // the two share-link attempts of today
    expect(s.avgScore).toBe(Math.round((44 + 90 + 74) / 3));
    expect(feedStats([], 0)).toEqual({ total: 0, avgScore: 0, uniqueStudents: 0, recentCount: 0 });
  });
});

describe('share-link attempts → feed rows', () => {
  it('a sealed attempt without an open key is returned as "waiting", one entry per attempt', () => {
    const doc = {
      studentName: 'Sok Dara', drillSlug: 'diagnostic.html', drillTitle: 'Orientation Diagnostic',
      submittedAt: '2026-11-14T03:00:00.000Z', sealed: true, sheet: JSON.stringify({ v: 1, a: { 'a:0': '1' } }),
    };
    const out = inviteRows([doc, { ...doc, studentName: 'Chan Vanna' }], () => null);
    expect(out.attempts).toHaveLength(0);
    expect(out.unscored).toBe(2);
    expect(out.waiting.map((w) => w.studentName)).toEqual(['Sok Dara', 'Chan Vanna']);
    expect(out.waiting[0]).toMatchObject({ drillSlug: 'diagnostic.html', drillTitle: 'Orientation Diagnostic', submittedAt: '2026-11-14T03:00:00.000Z' });
  });
});
