import { describe, expect, it } from 'vitest';
import {
  areaScores,
  emptyStudentScores,
  homeworkScore,
  listeningScore,
  participationScore,
  pblScore,
  quizScore,
  readingScore,
  scoreTone,
} from './assessmentScoring';

const withPartial = (patch: Record<string, number | string>) => ({
  ...emptyStudentScores(),
  ...patch,
});

describe('assessmentScoring — legacy formula port', () => {
  it('blank student has zero everywhere', () => {
    const s = areaScores(emptyStudentScores());
    expect(s).toEqual({
      listening: 0, reading: 0, pbl: 0, quiz: 0, homework: 0, participation: 0, overall: 0,
    });
  });

  it('listening: mean of entered 0–5 skills ×20 (partial assessment not penalized)', () => {
    // Legacy divided by 20 unconditionally: 5+5 → 50. New semantics: mean(5,5)=5 → 100.
    expect(listeningScore(withPartial({ listening: 5, speaking: 5 }))).toBe(100);
    expect(listeningScore(withPartial({ listening: 4, speaking: 3, pronunciation: 5, fluency: 3 }))).toBe(75);
    expect(listeningScore(withPartial({ listening: 5 }))).toBe(100);
  });

  it('reading: same shape as listening', () => {
    expect(readingScore(withPartial({ comprehension: 5, vocabulary: 4, readingSpeed: 5, accuracy: 2 }))).toBe(80);
    expect(readingScore(withPartial({ accuracy: 1 }))).toBe(20);
  });

  it('pbl: average of entered 0–100 criteria', () => {
    expect(pblScore(withPartial({ pblSubject: 80, pblPresentation: 60 }))).toBe(70);
    expect(pblScore(withPartial({ pblSubject: 90 }))).toBe(90);
  });

  it('quiz: per-term mean of entered quizzes, then cross-term mean; missing term falls back', () => {
    // Term 1: mean(80, 90) = 85; term 2 empty → 85
    expect(quizScore(withPartial({ quizT1Q1: 80, quizT1Q2: 90 }))).toBe(85);
    // Both terms: t1 mean(100, 80)=90, t2 mean(60)=60 → 75
    expect(quizScore(withPartial({ quizT1Q1: 100, quizT1Q2: 80, quizT2Q3: 60 }))).toBe(75);
    // Full five per term: t1 mean(50×5)=50, t2 mean(90,90)=90 → 70
    expect(quizScore(withPartial({
      quizT1Q1: 50, quizT1Q2: 50, quizT1Q3: 50, quizT1Q4: 50, quizT1Q5: 50,
      quizT2Q1: 90, quizT2Q2: 90,
    }))).toBe(70);
  });

  it('homework / participation: mean of entered days', () => {
    expect(homeworkScore(withPartial({ hwDay1: 100, hwDay2: 50 }))).toBe(75);
    expect(participationScore(withPartial({ partDay3: 70 }))).toBe(70);
  });

  it('overall: mean of non-zero areas only', () => {
    // listening 100 + reading 80 → overall 90 (pbl/quiz/hw/part not assessed)
    expect(areaScores(withPartial({ listening: 5, comprehension: 4 })).overall).toBe(90);
    // All six areas
    const all = areaScores(withPartial({
      listening: 5, speaking: 5,               // 100
      comprehension: 4, vocabulary: 4,          // 80
      pblSubject: 70,                           // 70
      quizT1Q1: 60,                             // 60
      hwDay1: 50,                               // 50
      partDay1: 40,                             // 40
    }));
    expect(all.overall).toBe(67); // mean(100,80,70,60,50,40) = 400/6 = 66.67 → 67
  });

  it('scoreTone matches the legacy 70/50 thresholds', () => {
    expect(scoreTone(85)).toBe('good');
    expect(scoreTone(70)).toBe('good');
    expect(scoreTone(69)).toBe('mid');
    expect(scoreTone(50)).toBe('mid');
    expect(scoreTone(49)).toBe('low');
    expect(scoreTone(0)).toBe('none');
  });
});
