import { describe, expect, it } from 'vitest';
import { parseMiniMockQuestions, MINI_MOCK_SKILLS, type MiniMockQuestion } from '../data/miniMockTest';
import { countCorrect, formatTestTime, scoreBySkill } from './mockScoring';

const sampleQuestions: MiniMockQuestion[] = [
  { id: 'read-1', skill: 'Reading', prompt: 'Choose.', choices: ['A', 'B'], correctIndex: 1, explanation: 'B is supported.' },
  { id: 'listen-1', skill: 'Listening', prompt: 'Listen.', choices: ['A', 'B'], correctIndex: 0, explanation: 'A is supported.' },
];

describe('mini mock assessment safety and scoring helpers', () => {
  it('validates a well-formed server-supplied question set', () => {
    expect(parseMiniMockQuestions(sampleQuestions)).toEqual(sampleQuestions);
  });

  it('rejects malformed server question banks and duplicate identifiers', () => {
    expect(parseMiniMockQuestions({})).toBeNull();
    expect(parseMiniMockQuestions([{ ...sampleQuestions[0], correctIndex: 2 }])).toBeNull();
    expect(parseMiniMockQuestions([sampleQuestions[0], sampleQuestions[0]])).toBeNull();
    expect(parseMiniMockQuestions([{ ...sampleQuestions[0], answer: 'secret answer' }])).toBeNull();
  });

  it('calculates score by answer key and skill', () => {
    const answers = { 'read-1': 1, 'listen-1': 1 };
    expect(countCorrect(sampleQuestions, answers)).toBe(1);
    expect(scoreBySkill('Reading', sampleQuestions, answers)).toEqual({ correct: 1, total: 1 });
    expect(scoreBySkill('Language Use', sampleQuestions, answers)).toEqual({ correct: 0, total: 0 });
  });

  it('formats timer values and exposes only the three tested skill labels', () => {
    expect(formatTestTime(480)).toBe('08:00');
    expect(formatTestTime(61)).toBe('01:01');
    expect(MINI_MOCK_SKILLS).toEqual(['Reading', 'Listening', 'Language Use']);
  });
});