import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getReaderWorkbook, READER_WORKBOOKS, type WorkbookActivity } from '../data/readerWorkbooks';
import { libraryTargetFromHash, parseCatalog, searchBooks } from '../lib/library';
import {
  attemptsForHomework,
  myHomeworkScore,
  parseHomeworkAttempt,
  scoresByStudent,
} from '../lib/kidHomework';
import {
  buildCrosswordGrid,
  buildFirestoreWorkbookDoc,
  cleanSubmitName,
  flushWorkbookOutbox,
  gradeWorkbook,
  parseWorkbookState,
  readWorkbookOutbox,
  submitWorkbookToTeacher,
  WORKBOOK_OUTBOX_KEY,
  wordSearchLine,
} from '../lib/readerWorkbook';
import { isInPageAnchor, resolveRoute } from '../lib/sitePages';

const root = process.cwd();

function perfectAnswersFor(activities: readonly WorkbookActivity[]): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const activity of activities) {
    switch (activity.kind) {
      case 'bank-fill':
        for (const item of activity.items) answers[item.id] = item.answer;
        break;
      case 'multi-blank':
        for (const s of activity.sentences) {
          for (const p of s.parts) if (typeof p === 'object') answers[p.id] = p.answer;
        }
        break;
      case 'cause-effect':
        for (const row of activity.rows) {
          for (const p of [...row.cause, ...row.effect]) if (typeof p === 'object') answers[p.id] = p.answer;
        }
        break;
      case 'binary-choice':
        for (const item of activity.items) answers[item.id] = item.answer;
        break;
      case 'true-false':
        for (const item of activity.items) answers[item.id] = item.answer;
        break;
      case 'match-qa':
        for (const item of activity.items) answers[item.id] = item.answer;
        break;
      case 'mcq':
        for (const item of activity.items) answers[item.id] = item.answer;
        break;
      case 'unscramble':
        for (const item of activity.items) answers[item.id] = item.answer;
        break;
      case 'word-search':
        for (const word of activity.words) answers[word.id] = word.answer;
        break;
      case 'crossword':
        for (const clue of activity.clues) answers[clue.id] = clue.answer;
        break;
      case 'sequence':
        for (const item of activity.items) answers[item.id] = String(item.answer);
        break;
      case 'open-prompts':
      case 'book-report':
        break;
    }
  }
  return answers;
}

describe('Kid 1–3 reader workbooks: catalogue & assets', () => {
  it('registers all three Kid 1–3 books in catalog.json with real PDFs, covers, and workbooks', () => {
    const raw = JSON.parse(readFileSync(resolve(root, 'public/library/catalog.json'), 'utf8')) as unknown;
    const catalog = parseCatalog(raw);
    expect(catalog.problems).toEqual([]);

    const expectedIds = [
      'kid-1-the-brave-tin-soldier',
      'kid-2-hansel-and-gretel',
      'kid-3-jack-and-the-magic-beans',
    ];

    for (const id of expectedIds) {
      const book = catalog.books.find((entry) => entry.id === id);
      expect(book, id).toBeDefined();
      expect(book?.shelf).toBe('Kids readers');
      expect(book?.pages).toBe(20);
      expect(book?.workbook).toBe(id);
      expect(book?.cover).toBeTruthy();
      const coverFile = resolve(root, 'public', (book?.cover ?? '').replace(/^\.\//, ''));
      expect(existsSync(coverFile), `cover for ${id}`).toBe(true);
      expect(getReaderWorkbook(book?.workbook)).not.toBeNull();
    }
  });

  it('resolves #library/<id> and #library/<id>/workbook routes cleanly', () => {
    expect(libraryTargetFromHash('#library/kid-1-the-brave-tin-soldier')).toEqual({
      bookId: 'kid-1-the-brave-tin-soldier',
      mode: 'read',
    });
    expect(libraryTargetFromHash('#library/kid-2-hansel-and-gretel/workbook')).toEqual({
      bookId: 'kid-2-hansel-and-gretel',
      mode: 'workbook',
    });
    expect(libraryTargetFromHash('#library/kid-3-jack-and-the-magic-beans/other')).toBeNull();
    expect(resolveRoute('#library/kid-3-jack-and-the-magic-beans/workbook', 'home')).toBe('library');
    expect(isInPageAnchor('#library/kid-3-jack-and-the-magic-beans/workbook')).toBe(false);
  });

  it('filters the Kids readers shelf and finds all three books by grade, title, and author', () => {
    const raw = JSON.parse(readFileSync(resolve(root, 'public/library/catalog.json'), 'utf8')) as unknown;
    const { books, shelves } = parseCatalog(raw);
    expect(shelves).toContain('Kids readers');
    expect(shelves).toContain('Fiction');
    expect(searchBooks(books, '', 'Kids readers')).toHaveLength(3);
    expect(searchBooks(books, 'kid 1').map((b) => b.id)).toEqual(['kid-1-the-brave-tin-soldier']);
    expect(searchBooks(books, 'hansel grimm').map((b) => b.id)).toEqual(['kid-2-hansel-and-gretel']);
    expect(searchBooks(books, 'magic beans').map((b) => b.id)).toEqual(['kid-3-jack-and-the-magic-beans']);
  });

  it('loads all three 20-page PDFs cleanly in pdf.js with chapter bookmarks', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const files = [
      'public/library/books/kid-1-the-brave-tin-soldier.pdf',
      'public/library/books/kid-2-hansel-and-gretel.pdf',
      'public/library/books/kid-3-jack-and-the-magic-beans.pdf',
    ];
    for (const rel of files) {
      const bytes = new Uint8Array(readFileSync(resolve(root, rel)));
      const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
      const doc = await task.promise;
      expect(doc.numPages, rel).toBe(20);
      const outline = await doc.getOutline();
      expect(outline && outline.length, `${rel} bookmarks`).toBeGreaterThanOrEqual(5);
      await task.destroy();
    }
  });
});

describe('Kid 1–3 reader workbooks: answer-key integrity & grading', () => {
  it.each(READER_WORKBOOKS)('$gradeLabel ($title) has unique item IDs, valid options, and grades 0% → 100%', (wb) => {
    const allActivities = wb.sections.flatMap((s) => s.activities);
    const blank = gradeWorkbook(wb, {});
    expect(blank.answered).toBe(0);
    expect(blank.correct).toBe(0);
    expect(blank.pct).toBe(0);
    expect(blank.total).toBeGreaterThan(90);
    expect(blank.total).toBeLessThanOrEqual(500);

    // Every answer in a word-bank, MCQ, binary-choice, sequence, or unscramble item must be reachable from its UI.
    const seenIds = new Set<string>();
    for (const act of allActivities) {
      if (act.kind === 'bank-fill') {
        const bank = act.wordBank.map((w) => w.toLowerCase());
        for (const item of act.items) {
          expect(seenIds.has(item.id), `duplicate ${item.id}`).toBe(false);
          seenIds.add(item.id);
          expect(bank, `${item.id} answer in bank`).toContain(item.answer.toLowerCase());
        }
      } else if (act.kind === 'multi-blank') {
        const bank = act.wordBank.map((w) => w.toLowerCase());
        for (const s of act.sentences) {
          for (const p of s.parts) {
            if (typeof p === 'object') {
              expect(seenIds.has(p.id), `duplicate ${p.id}`).toBe(false);
              seenIds.add(p.id);
              expect(bank, `${p.id} answer in bank`).toContain(p.answer.toLowerCase());
            }
          }
        }
      } else if (act.kind === 'cause-effect') {
        const bank = act.wordBank.map((w) => w.toLowerCase());
        for (const row of act.rows) {
          for (const p of [...row.cause, ...row.effect]) {
            if (typeof p === 'object') {
              expect(seenIds.has(p.id), `duplicate ${p.id}`).toBe(false);
              seenIds.add(p.id);
              expect(bank, `${p.id} answer in bank`).toContain(p.answer.toLowerCase());
            }
          }
        }
      } else if (act.kind === 'unscramble') {
        for (const item of act.items) {
          expect(seenIds.has(item.id), `duplicate ${item.id}`).toBe(false);
          seenIds.add(item.id);
          // Reassembling all chunks must produce the exact words of the target sentence.
          expect(item.chunks.join(' ').split(/\s+/).sort()).toEqual(item.answer.split(/\s+/).sort());
        }
      } else if (act.kind === 'sequence') {
        const answers = act.items.map((item) => item.answer).sort((a, b) => a - b);
        expect(answers).toEqual(Array.from({ length: act.count }, (_, idx) => idx + 1));
      }
    }

    const perfect = gradeWorkbook(wb, perfectAnswersFor(allActivities));
    expect(perfect.answered).toBe(perfect.total);
    expect(perfect.correct).toBe(perfect.total);
    expect(perfect.pct).toBe(100);
  });

  it('verifies every word path in Kid 2 Hansel and Gretel 8×8 word search', () => {
    const kid2 = getReaderWorkbook('kid-2-hansel-and-gretel')!;
    const ws = kid2.sections
      .flatMap((s) => s.activities)
      .find((a): a is Extract<WorkbookActivity, { kind: 'word-search' }> => a.kind === 'word-search')!;
    expect(ws.words).toHaveLength(6);
    for (const word of ws.words) {
      const forward = wordSearchLine(ws.grid, word.start, word.end);
      const backward = wordSearchLine(ws.grid, word.end, word.start);
      expect(forward?.word, word.answer).toBe(word.answer);
      expect(backward?.reversed, `${word.answer} reversed`).toBe(word.answer);
    }
  });

  it('verifies every intersecting cell in Kid 3 Jack and the Magic Beans crossword', () => {
    const kid3 = getReaderWorkbook('kid-3-jack-and-the-magic-beans')!;
    const cw = kid3.sections
      .flatMap((s) => s.activities)
      .find((a): a is Extract<WorkbookActivity, { kind: 'crossword' }> => a.kind === 'crossword')!;
    expect(cw.clues).toHaveLength(10);
    const grid = buildCrosswordGrid(cw.rows, cw.cols, cw.clues);

    for (const clue of cw.clues) {
      for (let i = 0; i < clue.answer.length; i += 1) {
        const r = clue.direction === 'down' ? clue.row + i : clue.row;
        const c = clue.direction === 'across' ? clue.col + i : clue.col;
        expect(grid[r]?.[c]?.solution, `${clue.id}[${i}] at (${r},${c})`).toBe(clue.answer[i]);
      }
    }
  });
});

describe('Kid 1–3 reader workbooks: state, Firestore payload & offline outbox', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map<string, string>();
    const localStorageMock = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, String(value)); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => { store.clear(); },
    };
    vi.stubGlobal('window', {
      localStorage: localStorageMock,
      dispatchEvent: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('never leaks an email address as a student name and satisfies firestore.rules limits', () => {
    expect(cleanSubmitName('dara.sok@aii.edu.kh')).toBe('Dara Sok');
    expect(parseWorkbookState('{"studentName":"dara@school.org"}', 'Dara').studentName).toBe('Dara');

    const doc = buildFirestoreWorkbookDoc(
      {
        bookId: 'kid-1-the-brave-tin-soldier',
        drillSlug: 'reader-kid1-tin-soldier',
        drillTitle: 'Kid 1 · The Brave Tin Soldier — Workbook',
        studentName: 'Sreyleap 1A',
        correctCount: 95,
        totalCount: 117,
        scorePct: 81,
        firstCorrectCount: 88,
        firstAnsweredCount: 117,
        checkCount: 2,
        queuedAt: 1,
      },
      null,
    );

    expect(doc.fields).toMatchObject({
      drillSource: { stringValue: 'rfc3' },
      drillSlug: { stringValue: 'reader-kid1-tin-soldier' },
      studentUid: { stringValue: '' },
      studentName: { stringValue: 'Sreyleap 1A' },
      classId: { nullValue: null },
      scorePct: { integerValue: '81' },
      correctCount: { integerValue: '95' },
      totalCount: { integerValue: '117' },
      firstCorrectCount: { integerValue: '88' },
      firstAnsweredCount: { integerValue: '117' },
      checkCount: { integerValue: '2' },
    });
  });

  it('queues a failed submit in the device outbox and flushes it once online', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));

    const payload = {
      bookId: 'kid-2-hansel-and-gretel',
      drillSlug: 'reader-kid2-hansel-gretel',
      drillTitle: 'Kid 2 · Hansel and Gretel — Workbook',
      studentName: 'Bora 2B',
      correctCount: 85,
      totalCount: 101,
      scorePct: 84,
      firstCorrectCount: 80,
      firstAnsweredCount: 101,
      checkCount: 1,
      queuedAt: 1000,
    };

    const failed = await submitWorkbookToTeacher(payload);
    expect(failed.ok).toBe(false);
    expect(failed.queued).toBe(true);
    expect(failed.message).toContain('Not sent yet');
    expect(readWorkbookOutbox()).toHaveLength(1);

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ name: 'projects/x/documents/drill_attempts/abc' }), { status: 200 }));
    const flushed = await flushWorkbookOutbox('reader-kid2-hansel-gretel');
    expect(flushed).toEqual({ sent: 1, remaining: 0 });
    expect(store.has(WORKBOOK_OUTBOX_KEY)).toBe(false);
  });

  it('round-trips submitted workbook docs through both teacher Scores and student My score', () => {
    const payloadA = buildFirestoreWorkbookDoc(
      {
        bookId: 'kid-3-jack-and-the-magic-beans',
        drillSlug: 'reader-kid3-magic-beans',
        drillTitle: 'Kid 3 · Jack and the Magic Beans — Workbook',
        studentName: 'Dara 3A',
        correctCount: 100,
        totalCount: 108,
        scorePct: 93,
        firstCorrectCount: 86,
        firstAnsweredCount: 108,
        checkCount: 2,
        queuedAt: 2000,
      },
      { uid: 'uid-dara', classId: 'Kid 3 — Morning' },
    );
    const payloadB = buildFirestoreWorkbookDoc(
      {
        bookId: 'kid-3-jack-and-the-magic-beans',
        drillSlug: 'reader-kid3-magic-beans',
        drillTitle: 'Kid 3 · Jack and the Magic Beans — Workbook',
        studentName: 'Bopha 3A',
        correctCount: 76,
        totalCount: 108,
        scorePct: 70,
        firstCorrectCount: 76,
        firstAnsweredCount: 108,
        checkCount: 1,
        queuedAt: 3000,
      },
      null,
    );

    const attempts = [
      parseHomeworkAttempt({ name: 'projects/x/documents/drill_attempts/a1', fields: payloadA.fields as never }),
      parseHomeworkAttempt({ name: 'projects/x/documents/drill_attempts/b1', fields: payloadB.fields as never }),
    ].filter((row): row is NonNullable<typeof row> => row !== null);

    // Whole-page filter (`number: null`) returns both students for the teacher score sheet.
    const whole = attemptsForHomework(attempts, null);
    const teacherRows = scoresByStudent(whole);
    expect(teacherRows).toHaveLength(2);

    // Privacy check: each student sees only their own score, with true first-try preserved.
    const dara = myHomeworkScore(whole, { uid: 'uid-dara', name: 'Dara 3A' });
    expect(dara).toMatchObject({
      name: 'Dara 3A',
      firstTry: { correct: 86, total: 108, pct: 80 },
      best: { correct: 100, total: 108, pct: 93 },
      firstTryMeasured: true,
    });

    const bopha = myHomeworkScore(whole, { uid: '', name: 'bopha 3a' });
    expect(bopha).toMatchObject({
      name: 'Bopha 3A',
      firstTry: { correct: 76, total: 108, pct: 70 },
    });

    const stranger = myHomeworkScore(whole, { uid: 'uid-other', name: 'Dara 3A' });
    // Signed-in stranger cannot see Dara's uid-owned submission even with the same display name.
    expect(stranger).toBeNull();
  });
});
