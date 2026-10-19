import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KID_GRADE_RESOURCES } from '../data/kidGradeResources';
import { TOEFL_JUNIOR_ASSESSMENTS } from '../data/toeflJuniorAssessments';
import { CLASSROOM_ASSIGNMENTS } from '../data/assignments';
import { MINI_MOCK_SKILLS, parseMiniMockQuestions } from '../data/miniMockTest';

/**
 * Data-file integrity: catches the "data drifted from the tool" bug class —
 * answer keys that do not match any choice, JSON banks that no longer parse,
 * headline feeds with a stale count — before they ship.
 */

const ROOT = resolve(process.cwd());
const PUBLIC_DIR = resolve(ROOT, 'public');

interface ChoiceQuestion {
  prompt: string;
  choices?: string[];
  answer: string;
}

function letterPrefix(value: string): string {
  const match = /^([A-H])\./.exec(value.trim());
  return match ? match[1] : '';
}

function allQuestions(): Array<{ where: string; question: ChoiceQuestion }> {
  const out: Array<{ where: string; question: ChoiceQuestion }> = [];
  for (const assignment of Object.values(CLASSROOM_ASSIGNMENTS)) {
    for (const section of assignment.sections) {
      for (const question of section.questions) {
        out.push({ where: `assignments:${assignment.resourceId}`, question });
      }
    }
  }
  for (const assessment of TOEFL_JUNIOR_ASSESSMENTS) {
    for (const section of assessment.assignment.sections) {
      for (const question of section.questions) {
        out.push({ where: `toefl-junior:${assessment.id}`, question });
      }
    }
  }
  return out;
}

describe('assignment answer keys stay consistent with their choices', () => {
  const choiceQuestions = allQuestions().filter(({ question }) => Array.isArray(question.choices));

  it('has multiple-choice questions to check', () => {
    expect(choiceQuestions.length).toBeGreaterThanOrEqual(20);
  });

  it('every answer is exactly one of the offered choices (or matches a single letter prefix)', () => {
    const problems: string[] = [];
    for (const { where, question } of choiceQuestions) {
      const choices = question.choices as string[];
      if (new Set(choices).size !== choices.length) {
        problems.push(`${where}: duplicate choices for "${question.prompt.slice(0, 40)}…"`);
      }
      const exact = choices.includes(question.answer);
      const answerPrefix = letterPrefix(question.answer);
      const matchingPrefixes = choices.filter((choice) => letterPrefix(choice) === answerPrefix && answerPrefix !== '');
      if (!exact && matchingPrefixes.length !== 1) {
        problems.push(`${where}: answer "${question.answer.slice(0, 50)}…" matches no choice`);
      }
    }
    expect(problems, 'answer-key inconsistencies:\n' + problems.join('\n')).toEqual([]);
  });
});

describe('mini-mock question bank', () => {
  it('public bank parses into valid questions with unique ids and all three skills', () => {
    const raw = JSON.parse(readFileSync(resolve(PUBLIC_DIR, 'data', 'mini-mock-bank.json'), 'utf8'));
    const questions = parseMiniMockQuestions(raw);
    expect(questions).not.toBeNull();
    const bank = questions ?? [];
    expect(bank.length).toBeGreaterThanOrEqual(8);
    expect(new Set(bank.map((question) => question.id)).size).toBe(bank.length);
    for (const skill of MINI_MOCK_SKILLS) {
      expect(bank.some((question) => question.skill === skill), `no ${skill} questions in the bank`).toBe(true);
    }
    for (const question of bank) {
      expect(question.choices.length).toBeGreaterThanOrEqual(3);
      expect(question.correctIndex).toBeGreaterThanOrEqual(0);
      expect(question.correctIndex).toBeLessThan(question.choices.length);
      expect(question.prompt.trim()).not.toBe('');
      expect(question.explanation?.trim()).not.toBe('');
    }
  });

  it('private-data copy stays in sync with the served public copy', () => {
    const publicBank = readFileSync(resolve(PUBLIC_DIR, 'data', 'mini-mock-bank.json'), 'utf8');
    const privateBank = readFileSync(resolve(ROOT, 'private-data', 'mini-mock-bank.json'), 'utf8');
    expect(privateBank).toBe(publicBank);
  });
});

describe('news headline feed', () => {
  interface Headline {
    title: string;
    link: string;
    source: string;
  }
  const feed = JSON.parse(readFileSync(resolve(PUBLIC_DIR, 'news', 'headlines.json'), 'utf8'));

  it('declares a count that matches the array and keeps 30 fresh items', () => {
    expect(Array.isArray(feed.headlines)).toBe(true);
    expect(feed.count).toBe(feed.headlines.length);
    expect(feed.count).toBe(30);
  });

  it('every headline has a title, link, and source', () => {
    for (const headline of feed.headlines as Headline[]) {
      expect(headline.title?.trim()).toBeTruthy();
      expect(headline.link?.trim()).toBeTruthy();
      expect(headline.source?.trim()).toBeTruthy();
    }
  });
});

describe('kid grade resource pathway files', () => {
  it('every local material href points at a file in public/', () => {
    const missing: string[] = [];
    for (const grade of KID_GRADE_RESOURCES) {
      for (const material of grade.materials) {
        if (!material.href.startsWith('./')) continue; // absolute/external links are covered by the asset crawler
        const target = resolve(PUBLIC_DIR, material.href.replace(/^\.\//, ''));
        if (!existsSync(target)) missing.push(`grade ${grade.grade}: ${material.href}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
