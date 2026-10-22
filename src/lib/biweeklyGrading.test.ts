import { describe, expect, it } from 'vitest';
import {
  gradeSubmission,
  mostMissedQuestions,
  normalizeAnswer,
  type TestKey,
} from './biweeklyGrading';

const key: TestKey = {
  testId: 'biweek-demo',
  title: 'Demo Test',
  groups: [
    { id: 'grammar-list', title: 'Grammar · 2 items' },
    { id: 'reading-list', title: 'Reading · 2 items' },
  ],
  questions: [
    { gid: 'grammar-list', qnum: 1, answer: '2' },
    { gid: 'grammar-list', qnum: 2, answer: '0|3' },
    { gid: 'reading-list', qnum: 3, answer: '1' },
    { gid: 'reading-list', qnum: 4, answer: '3' },
  ],
};

describe('normalizeAnswer', () => {
  it('passes single values through', () => {
    expect(normalizeAnswer('2')).toBe('2');
    expect(normalizeAnswer(3)).toBe('3');
  });

  it('sorts and joins multi-select parts like the template engine', () => {
    expect(normalizeAnswer([3, 0])).toBe('0|3');
    expect(normalizeAnswer(['1', '2'])).toBe('1|2');
    expect(normalizeAnswer('0|3')).toBe('0|3');
  });

  it('tells apart different sets and orders', () => {
    expect(normalizeAnswer([1, 2])).toBe(normalizeAnswer([2, 1]));
    expect(normalizeAnswer([1, 2])).not.toBe(normalizeAnswer([1, 3]));
  });
});

describe('gradeSubmission', () => {
  it('grades a perfect submission', () => {
    const r = gradeSubmission(key, { q1: '2', q2: '3|0', q3: '1', q4: '3' });
    expect(r.correctCount).toBe(4);
    expect(r.totalCount).toBe(4);
    expect(r.scorePct).toBe(100);
    expect(r.missed).toEqual([]);
    expect(r.blank).toEqual([]);
  });

  it('counts blanks as incorrect and tracks them separately', () => {
    const r = gradeSubmission(key, { q1: '2', q3: '1' });
    expect(r.correctCount).toBe(2);
    expect(r.scorePct).toBe(50);
    expect(r.blank).toEqual([2, 4]);
    expect(r.missed).toEqual([2, 4]);
  });

  it('aggregates per-skill totals', () => {
    const r = gradeSubmission(key, { q1: '0', q2: '0|3', q3: '1', q4: '1' });
    const grammar = r.perSkill.find((s) => s.id === 'grammar-list');
    const reading = r.perSkill.find((s) => s.id === 'reading-list');
    expect(grammar).toMatchObject({ correct: 1, total: 2 });
    expect(reading).toMatchObject({ correct: 1, total: 2 });
  });

  it('accepts set-equal answers in any order, like the practice engine', () => {
    const a = gradeSubmission(key, { q1: '2', q2: '3|0', q3: '1', q4: '3' });
    const b = gradeSubmission(key, { q1: '2', q2: '0|3', q3: '1', q4: '3' });
    expect(a.correctCount).toBe(b.correctCount);
  });

  it('handles an empty answers map', () => {
    const r = gradeSubmission(key, {});
    expect(r.correctCount).toBe(0);
    expect(r.blank).toEqual([1, 2, 3, 4]);
    expect(r.scorePct).toBe(0);
  });
});

describe('mostMissedQuestions', () => {
  it('flags questions missed by at least half of the submissions', () => {
    const graded = {
      s1: gradeSubmission(key, { q1: '2', q2: '0|3', q3: '9', q4: '3' }),
      s2: gradeSubmission(key, { q1: '2', q2: '0|3', q3: '9', q4: '9' }),
      s3: gradeSubmission(key, { q1: '9', q2: '0|3', q3: '1', q4: '3' }),
    };
    const missed = mostMissedQuestions(graded);
    // q3 missed 2/3 (67%), q4 missed 1/3 (33% — below threshold), q1 missed 1/3.
    expect(missed).toEqual([{ qnum: 3, missedCount: 2, rate: 2 / 3 }]);
  });

  it('returns nothing when there are no submissions', () => {
    expect(mostMissedQuestions({})).toEqual([]);
  });
});
