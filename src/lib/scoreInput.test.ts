import { describe, expect, it } from 'vitest';
import { sanitizeScoreText } from './scoreInput';

// Score cells: 0–5 rubric skills (Listening/Reading) and 0–100
// criteria/days (PBL, Quizzes, Homework, Participation).
describe('sanitizeScoreText', () => {
  it('keeps plain in-range typing untouched', () => {
    expect(sanitizeScoreText('3', 5)).toBe('3');
    expect(sanitizeScoreText('0', 5)).toBe('0');
    expect(sanitizeScoreText('', 5)).toBe('');
    expect(sanitizeScoreText('45', 100)).toBe('45');
    expect(sanitizeScoreText('100', 100)).toBe('100');
  });

  it('caps a 0–5 cell to a single digit — no silent snap to the 5 cap', () => {
    expect(sanitizeScoreText('10', 5)).toBe('1');
    expect(sanitizeScoreText('45', 5)).toBe('4');
    expect(sanitizeScoreText('35', 5)).toBe('3');
    expect(sanitizeScoreText('999999', 5)).toBe('9');
  });

  it('caps a 0–100 cell to three digits', () => {
    expect(sanitizeScoreText('1234', 100)).toBe('123');
    expect(sanitizeScoreText('007', 100)).toBe('007'); // leading zeros kept; caller parseInts
  });

  it('strips non-digit garbage down to its digits, then caps', () => {
    expect(sanitizeScoreText('a1b2', 5)).toBe('1');
    expect(sanitizeScoreText('-4', 5)).toBe('4');
    expect(sanitizeScoreText('12x', 100)).toBe('12');
    expect(sanitizeScoreText('abc', 5)).toBe('');
  });

  it('handles degenerate max values defensively', () => {
    expect(sanitizeScoreText('9', 0)).toBe('9'); // cap falls back to 1 digit
    expect(sanitizeScoreText('12', 5.7)).toBe('1'); // fractional max truncates to 5 → 1 digit
    expect(sanitizeScoreText('123', 100.9)).toBe('123');
  });
});
