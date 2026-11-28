import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(process.cwd());
const PUBLIC = resolve(ROOT, 'public/rfc-change3');
const worksheetData = JSON.parse(readFileSync(resolve(PUBLIC, 'data.json'), 'utf8')) as {
  book: string;
  units: Array<{
    number: number;
    title: string;
    track: string;
    dictation: { passage: string; answers: string[][] };
    unscramble: {
      passage: string;
      sentences: Array<{ letter: string; chunks: string[]; answer: string[] }>;
      placements: string[];
    };
  }>;
};

function normalizeChunk(chunk: string): string {
  return chunk.toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function sortedChunks(chunks: string[]): string[] {
  return chunks.map(normalizeChunk).sort();
}

describe('Kid 8 — Reading Future Change 3 live worksheets', () => {
  it('contains all 16 consecutive units and their supplied track numbers', () => {
    expect(worksheetData.book).toBe('Reading Future Change 3');
    expect(worksheetData.units.map((unit) => unit.number)).toEqual(Array.from({ length: 16 }, (_, index) => index + 1));
    for (const unit of worksheetData.units) {
      expect(unit.title.trim(), `unit ${unit.number} title`).not.toBe('');
      expect(unit.track, `unit ${unit.number} track`).toBe(String(unit.number * 2 + 1).padStart(2, '0'));
    }
  });

  it('provides exactly 15 numbered dictation blanks with accepted answers in every unit', () => {
    for (const unit of worksheetData.units) {
      const markers = [...unit.dictation.passage.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1]));
      expect(markers, `unit ${unit.number} dictation markers`).toEqual(Array.from({ length: 15 }, (_, index) => index + 1));
      expect(unit.dictation.answers, `unit ${unit.number} answer count`).toHaveLength(15);
      expect(unit.dictation.answers.every((answers) => answers.length > 0 && answers.every((answer) => answer.trim().length > 0))).toBe(true);
    }
  });

  it('provides four complete sentence puzzles and four keyed passage placements per unit', () => {
    for (const unit of worksheetData.units) {
      const data = unit.unscramble;
      const markers = [...data.passage.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1]));
      expect(markers, `unit ${unit.number} passage gaps`).toEqual([1, 2, 3, 4]);
      expect(data.sentences.map((sentence) => sentence.letter), `unit ${unit.number} sentence letters`).toEqual(['A', 'B', 'C', 'D']);
      expect(data.placements, `unit ${unit.number} placements`).toHaveLength(4);
      expect(data.placements.every((letter) => ['A', 'B', 'C', 'D'].includes(letter))).toBe(true);
      for (const sentence of data.sentences) {
        expect(sentence.chunks.length, `unit ${unit.number} ${sentence.letter} chunks`).toBeGreaterThan(0);
        expect(sortedChunks(sentence.chunks), `unit ${unit.number} ${sentence.letter} chunks/answer`).toEqual(sortedChunks(sentence.answer));
        expect(sentence.answer.length, `unit ${unit.number} ${sentence.letter} answer`).toBe(sentence.chunks.length);
      }
    }
  });

  it('loads the shared live engine, source data, print styles, and account gate from both pages', () => {
    for (const page of ['dictation.html', 'unscramble.html']) {
      const html = readFileSync(resolve(PUBLIC, page), 'utf8');
      expect(html, page).toContain("CMC_GATE.guard('account'");
      expect(html, page).toContain('./live-worksheet.css');
      expect(html, page).toContain('./live-worksheet.js');
      expect(html, page).toContain('./teacher-key-gate.js');
      expect(readFileSync(resolve(PUBLIC, 'live-worksheet.js'), 'utf8')).toContain("new URL('./data.json'");
    }
  });
});
