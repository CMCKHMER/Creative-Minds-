import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(process.cwd());
const PUBLIC = resolve(ROOT, 'public/rfc-change3');
const worksheetBook = JSON.parse(readFileSync(resolve(PUBLIC, 'data.json'), 'utf8')) as {
  units: Array<{ number: number; title: string }>;
};
const wordList = JSON.parse(readFileSync(resolve(PUBLIC, 'word-list.json'), 'utf8')) as {
  book: string;
  units: Array<{
    number: number;
    title: string;
    words: Array<{ word: string; pos: string; definition: string; example: string }>;
  }>;
};
const reviewTests = JSON.parse(readFileSync(resolve(PUBLIC, 'review-tests.json'), 'utf8')) as {
  book: string;
  tests: Array<{
    number: number;
    title: string;
    unitsLabel: string;
    wordBank: string[];
    fillIns: Array<{ number: number; prompt: string; answer: string }>;
    vocabularyChoices: Array<{ number: number; choices: string[]; answer: number }>;
    reading: {
      passage: string;
      questions: Array<{ number: number; choices: string[]; answer: number; sentence?: string }>;
    };
    cloze: {
      passage: string;
      gaps: Array<{ number: number; choices: string[]; answer: string }>;
      questions: Array<{ number: number; choices: string[]; answer: number }>;
    };
    writtenGroups: Array<{
      passage: string;
      questions: Array<{
        number: number;
        type: 'short-answer' | 'unscramble';
        model: string;
        accepted?: string[];
        chunks?: string[];
        answer?: string[];
      }>;
    }>;
  }>;
};

function normalize(value: string): string {
  return value.toLocaleLowerCase('en').replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function sortedChunks(chunks: string[]): string[] {
  return chunks.map(normalize).sort();
}

describe('Kid 8 — Reading Future Change 3 Word List and Review Tests', () => {
  it('transcribes all 16 vocabulary units and all entries from the supplied Word List', () => {
    expect(wordList.book).toBe('Reading Future Change 3');
    expect(wordList.units.map((unit) => unit.number)).toEqual(Array.from({ length: 16 }, (_, index) => index + 1));
    expect(wordList.units.map((unit) => unit.title)).toEqual(worksheetBook.units.map((unit) => unit.title));
    expect(wordList.units.map((unit) => unit.words.length)).toEqual([
      15, 15, 15, 15, 15, 15, 16, 15, 15, 16, 15, 15, 16, 15, 15, 15,
    ]);
    expect(wordList.units.flatMap((unit) => unit.words)).toHaveLength(243);
    for (const unit of wordList.units) {
      for (const word of unit.words) {
        expect(word.word.trim()).not.toBe('');
        expect(word.pos.trim(), `${unit.number} · ${word.word} part of speech`).not.toBe('');
        expect(word.definition.trim(), `${unit.number} · ${word.word} definition`).not.toBe('');
        expect(word.example.trim(), `${unit.number} · ${word.word} example`).not.toBe('');
      }
    }
  });

  it('includes four complete 15-question review tests spanning Units 1–16', () => {
    expect(reviewTests.book).toBe('Reading Future Change 3');
    expect(reviewTests.tests.map((test) => test.number)).toEqual([1, 2, 3, 4]);
    expect(reviewTests.tests.map((test) => test.unitsLabel)).toEqual(['Units 1–4', 'Units 5–8', 'Units 9–12', 'Units 13–16']);

    for (const test of reviewTests.tests) {
      expect(test.wordBank).toHaveLength(5);
      expect(test.fillIns.map((item) => item.number)).toEqual([1, 2, 3]);
      for (const item of test.fillIns) {
        expect(item.prompt.match(/___/g)).toHaveLength(1);
        expect(test.wordBank).toContain(item.answer);
      }
      expect(test.vocabularyChoices.map((item) => item.number)).toEqual([4, 5]);
      expect(test.reading.questions.map((item) => item.number)).toEqual([6, 7, 8]);
      expect(test.cloze.questions.map((item) => item.number)).toEqual([9, 10]);
      expect(test.cloze.gaps.map((gap) => gap.number)).toEqual([1, 2, 3]);
      expect(test.writtenGroups.flatMap((group) => group.questions).map((question) => question.number)).toEqual([12, 13, 14, 15]);

      const questionNumbers = [
        ...test.fillIns.map((item) => item.number),
        ...test.vocabularyChoices.map((item) => item.number),
        ...test.reading.questions.map((item) => item.number),
        ...test.cloze.questions.map((item) => item.number),
        11,
        ...test.writtenGroups.flatMap((group) => group.questions.map((question) => question.number)),
      ].sort((a, b) => a - b);
      expect(questionNumbers).toEqual(Array.from({ length: 15 }, (_, index) => index + 1));
      expect(test.fillIns.length + test.vocabularyChoices.length + test.reading.questions.length + test.cloze.questions.length + 1 + test.writtenGroups.flatMap((group) => group.questions).length).toBe(15);

      for (const question of [...test.vocabularyChoices, ...test.reading.questions, ...test.cloze.questions]) {
        expect(question.choices.length, `${test.title} question ${question.number} options`).toBe(3);
        expect(question.answer, `${test.title} question ${question.number} answer index`).toBeGreaterThanOrEqual(0);
        expect(question.answer, `${test.title} question ${question.number} answer index`).toBeLessThan(question.choices.length);
      }
      for (const gap of test.cloze.gaps) {
        expect(gap.choices).toContain(gap.answer);
      }
      for (const question of test.writtenGroups.flatMap((group) => group.questions)) {
        expect(question.model.trim(), `${test.title} question ${question.number} model`).not.toBe('');
        if (question.type === 'short-answer') expect(question.accepted?.length).toBeGreaterThan(0);
        else {
          expect(question.chunks?.length).toBeGreaterThan(0);
          expect(question.answer?.length).toBe(question.chunks?.length);
          expect(sortedChunks(question.chunks || [])).toEqual(sortedChunks(question.answer || []));
        }
      }
    }
  });

  it('wires both new live pages into the shared theme, account gate, and page scripts', () => {
    const pages = [
      ['word-list.html', './word-list.js', './word-list.json'],
      ['review-tests.html', './review-tests.js', './review-tests.json'],
    ] as const;
    for (const [page, script, data] of pages) {
      const html = readFileSync(resolve(PUBLIC, page), 'utf8');
      expect(html, page).toContain("CMC_GATE.guard('account'");
      expect(html, page).toContain('./live-worksheet.css');
      expect(html, page).toContain('./change3-extra.js');
      expect(html, page).toContain(script);
      expect(readFileSync(resolve(PUBLIC, script.slice(2)), 'utf8')).toContain(`new URL('${data}'`);
      expect(html, page).toContain('./word-list.html');
      expect(html, page).toContain('./review-tests.html');
      expect(html, page).toContain('./dictation.html');
      expect(html, page).toContain('./unscramble.html');
    }
    expect(readFileSync(resolve(PUBLIC, 'review-tests.html'), 'utf8')).toContain('./teacher-key-gate.js');
    expect(readFileSync(resolve(PUBLIC, 'review-tests.html'), 'utf8')).toContain('The supplied PDF has no answer key');
  });
});
