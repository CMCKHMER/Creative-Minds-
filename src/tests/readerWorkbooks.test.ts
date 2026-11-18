import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getReaderWorkbook, READER_WORKBOOKS, type WorkbookActivity } from '../data/readerWorkbooks';
import {
  ensurePromiseWithResolvers,
  libraryTargetFromHash,
  parseCatalog,
  searchBooks,
} from '../lib/library';
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
      case 'category-sort':
        for (const item of activity.items) answers[item.id] = item.answer;
        break;
      case 'error-fix':
        for (const item of activity.items) answers[item.id] = item.answer;
        break;
      case 'open-prompts':
      case 'book-report':
        break;
    }
  }
  return answers;
}

describe('Kid 1–11 reader workbooks: catalogue & assets', () => {
  const expectedBooks: ReadonlyArray<{ id: string; pages: number; hasContents: boolean }> = [
    { id: 'kid-1-the-brave-tin-soldier', pages: 20, hasContents: true },
    { id: 'kid-2-hansel-and-gretel', pages: 20, hasContents: true },
    { id: 'kid-3-jack-and-the-magic-beans', pages: 20, hasContents: true },
    { id: 'kid-4-the-trojan-horse', pages: 20, hasContents: true },
    { id: 'kid-5-daedalus-and-icarus', pages: 20, hasContents: true },
    { id: 'kid-6-heidi', pages: 19, hasContents: false },
    { id: 'kid-7-gullivers-travels', pages: 20, hasContents: false },
    { id: 'kid-8-beauty-and-the-beast', pages: 21, hasContents: true },
    { id: 'kid-9-the-gift-of-the-magi', pages: 21, hasContents: true },
    { id: 'kid-10-the-last-lesson', pages: 22, hasContents: true },
    { id: 'kid-11-the-count-of-monte-cristo', pages: 22, hasContents: true },
  ];

  it('registers all eleven Kid 1–11 books in catalog.json with real PDFs, covers, and workbooks', () => {
    const raw = JSON.parse(readFileSync(resolve(root, 'public/library/catalog.json'), 'utf8')) as unknown;
    const catalog = parseCatalog(raw);
    expect(catalog.problems).toEqual([]);
    expect(READER_WORKBOOKS).toHaveLength(11);
    expect(READER_WORKBOOKS.map((wb) => wb.gradeNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

    for (const { id, pages } of expectedBooks) {
      const book = catalog.books.find((entry) => entry.id === id);
      expect(book, id).toBeDefined();
      expect(book?.shelf).toBe('Kids readers');
      expect(book?.pages).toBe(pages);
      expect(book?.workbook).toBe(id);
      expect(book?.cover).toBeTruthy();
      const coverFile = resolve(root, 'public', (book?.cover ?? '').replace(/^\.\//, ''));
      expect(existsSync(coverFile), `cover for ${id}`).toBe(true);
      expect(book?.source.kind).toBe('pdf');
      if (book?.source.kind === 'pdf') {
        const pdfFile = resolve(root, 'public', book.source.url.replace(/^\.\//, ''));
        expect(existsSync(pdfFile), `pdf for ${id}`).toBe(true);
      }
      const wb = getReaderWorkbook(book?.workbook);
      expect(wb, `workbook for ${id}`).not.toBeNull();
      expect(wb?.sections).toHaveLength(7);
      for (const sec of wb?.sections ?? []) {
        expect(sec.pdfPage, `${id}:${sec.id} pdfPage`).toBeGreaterThanOrEqual(1);
        expect(sec.pdfPage, `${id}:${sec.id} pdfPage <= ${pages}`).toBeLessThanOrEqual(pages);
      }
    }
  });

  it('resolves #library/<id> and #library/<id>/workbook routes cleanly across Kid 1–11', () => {
    for (const { id } of expectedBooks) {
      expect(libraryTargetFromHash(`#library/${id}`)).toEqual({ bookId: id, mode: 'read' });
      expect(libraryTargetFromHash(`#library/${id}/workbook`)).toEqual({ bookId: id, mode: 'workbook' });
    }
    expect(libraryTargetFromHash('#library/kid-3-jack-and-the-magic-beans/other')).toBeNull();
    expect(resolveRoute('#library/kid-11-the-count-of-monte-cristo/workbook', 'home')).toBe('library');
    expect(isInPageAnchor('#library/kid-11-the-count-of-monte-cristo/workbook')).toBe(false);
  });

  it('filters the Kids readers shelf and finds all eleven books by grade, title, and author', () => {
    const raw = JSON.parse(readFileSync(resolve(root, 'public/library/catalog.json'), 'utf8')) as unknown;
    const { books, shelves } = parseCatalog(raw);
    expect(shelves).toContain('Kids readers');
    expect(shelves).toContain('Fiction');
    expect(searchBooks(books, '', 'Kids readers')).toHaveLength(11);
    expect(searchBooks(books, 'tin soldier andersen').map((b) => b.id)).toEqual(['kid-1-the-brave-tin-soldier']);
    expect(searchBooks(books, 'hansel grimm').map((b) => b.id)).toEqual(['kid-2-hansel-and-gretel']);
    expect(searchBooks(books, 'magic beans').map((b) => b.id)).toEqual(['kid-3-jack-and-the-magic-beans']);
    expect(searchBooks(books, 'trojan virgil').map((b) => b.id)).toEqual(['kid-4-the-trojan-horse']);
    expect(searchBooks(books, 'icarus ovid').map((b) => b.id)).toEqual(['kid-5-daedalus-and-icarus']);
    expect(searchBooks(books, 'heidi spyri').map((b) => b.id)).toEqual(['kid-6-heidi']);
    expect(searchBooks(books, 'gulliver swift').map((b) => b.id)).toEqual(['kid-7-gullivers-travels']);
    expect(searchBooks(books, 'beauty beast beaumont').map((b) => b.id)).toEqual(['kid-8-beauty-and-the-beast']);
    expect(searchBooks(books, 'magi henry').map((b) => b.id)).toEqual(['kid-9-the-gift-of-the-magi']);
    expect(searchBooks(books, 'last lesson daudet').map((b) => b.id)).toEqual(['kid-10-the-last-lesson']);
    expect(searchBooks(books, 'monte cristo dumas').map((b) => b.id)).toEqual(['kid-11-the-count-of-monte-cristo']);
  });

  it('ships valid cleaned PDFs with embedded chapter bookmarks (Node 20+ and pdf.js)', async () => {
    const files = expectedBooks.map(({ id, pages, hasContents }) => ({
      rel: `public/library/books/${id}.pdf`,
      pages,
      hasContents,
    }));

    // Binary PDF validation runs on every Node version (including Node 20 in CI).
    for (const { rel, pages, hasContents } of files) {
      const buf = readFileSync(resolve(root, rel));
      const latin = buf.toString('latin1');
      expect(latin.startsWith('%PDF-1.'), `${rel} header`).toBe(true);
      expect(latin.slice(-64).includes('%%EOF'), `${rel} trailer`).toBe(true);
      const pageCounts = [...latin.matchAll(/\/Type\s*\/Pages\b[\s\S]{0,200}?\/Count\s+(\d+)/g)]
        .map((m) => Number(m[1]));
      expect(pageCounts.length, `${rel} /Pages tree`).toBeGreaterThan(0);
      expect(Math.max(...pageCounts), `${rel} page count`).toBe(pages);
      expect(/\/Outlines\s+\d+\s+0\s+R/.test(latin), `${rel} /Outlines`).toBe(true);
      const titles = [...latin.matchAll(/\/Title\s*\(([^)]+)\)/g)].map((m) => m[1]);
      expect(titles, `${rel} common bookmarks`).toEqual(
        expect.arrayContaining(['Cover', 'Part A: Story Focus', 'Part B: Skill Focus']),
      );
      if (hasContents) {
        expect(titles, `${rel} Contents bookmark`).toContain('Contents');
      }
    }

    // Full pdf.js parse when the host Node meets pdfjs-dist@6 engines (>= 22.13).
    const nodeMajor = Number(process.versions.node.split('.')[0] ?? '0');
    const proc = process as NodeJS.Process & { getBuiltinModule?: (id: string) => unknown };
    if (nodeMajor >= 22 && typeof proc.getBuiltinModule === 'function') {
      ensurePromiseWithResolvers();
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      for (const { rel, pages, hasContents } of files) {
        const bytes = new Uint8Array(readFileSync(resolve(root, rel)));
        const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
        const doc = await task.promise;
        expect(doc.numPages, rel).toBe(pages);
        const outline = await doc.getOutline();
        expect(outline && outline.length, `${rel} top-level bookmarks`).toBeGreaterThanOrEqual(
          hasContents ? 5 : 4,
        );
        const totalBookmarks = (outline ?? []).reduce(
          (sum, entry) => sum + 1 + (entry.items?.length ?? 0),
          0,
        );
        expect(totalBookmarks, `${rel} total bookmarks`).toBeGreaterThanOrEqual(16);
        await task.destroy();
      }
    }
  });

  it('polyfills Promise.withResolvers when missing on older browsers or runtimes', async () => {
    const ctor = Promise as PromiseConstructor & {
      withResolvers?: <T>() => {
        promise: Promise<T>;
        resolve: (value: T | PromiseLike<T>) => void;
        reject: (reason?: unknown) => void;
      };
    };
    const original = Object.getOwnPropertyDescriptor(ctor, 'withResolvers');
    try {
      delete ctor.withResolvers;
      expect(ctor.withResolvers).toBeUndefined();
      ensurePromiseWithResolvers();
      expect(typeof ctor.withResolvers).toBe('function');

      const ok = ctor.withResolvers!<number>();
      ok.resolve(42);
      await expect(ok.promise).resolves.toBe(42);

      const fail = ctor.withResolvers!<never>();
      fail.reject(new Error('boom'));
      await expect(fail.promise).rejects.toThrow('boom');
    } finally {
      if (original) {
        Object.defineProperty(ctor, 'withResolvers', original);
      } else {
        delete ctor.withResolvers;
      }
    }
  });
});

describe('Kid 1–11 reader workbooks: answer-key integrity & grading', () => {
  it.each(READER_WORKBOOKS)('$gradeLabel ($title) has unique item IDs, valid options, and grades 0% → 100%', (wb) => {
    const allActivities = wb.sections.flatMap((s) => s.activities);
    const blank = gradeWorkbook(wb, {});
    expect(blank.answered).toBe(0);
    expect(blank.correct).toBe(0);
    expect(blank.pct).toBe(0);
    expect(blank.total).toBeGreaterThan(85);
    expect(blank.total).toBeLessThanOrEqual(500);

    // Every answer across every activity type must have a unique ID and be reachable from its UI.
    const seenIds = new Set<string>();
    const claimId = (id: string) => {
      expect(seenIds.has(id), `duplicate ${id}`).toBe(false);
      seenIds.add(id);
    };

    for (const act of allActivities) {
      claimId(act.id);
      if (act.kind === 'bank-fill') {
        const bank = act.wordBank.map((w) => w.toLowerCase());
        for (const item of act.items) {
          claimId(item.id);
          expect(bank, `${item.id} answer in bank`).toContain(item.answer.toLowerCase());
        }
      } else if (act.kind === 'multi-blank') {
        const bank = act.wordBank.map((w) => w.toLowerCase());
        for (const s of act.sentences) {
          for (const p of s.parts) {
            if (typeof p === 'object') {
              claimId(p.id);
              expect(bank, `${p.id} answer in bank`).toContain(p.answer.toLowerCase());
            }
          }
        }
      } else if (act.kind === 'cause-effect') {
        const bank = act.wordBank.map((w) => w.toLowerCase());
        for (const row of act.rows) {
          for (const p of [...row.cause, ...row.effect]) {
            if (typeof p === 'object') {
              claimId(p.id);
              expect(bank, `${p.id} answer in bank`).toContain(p.answer.toLowerCase());
            }
          }
        }
      } else if (act.kind === 'binary-choice') {
        for (const item of act.items) {
          claimId(item.id);
          expect(item.options, `${item.id} answer in binary options`).toContain(item.answer);
        }
      } else if (act.kind === 'true-false') {
        for (const item of act.items) {
          claimId(item.id);
          expect(['T', 'F']).toContain(item.answer);
        }
      } else if (act.kind === 'match-qa') {
        const keys = act.options.map((o) => o.key);
        for (const item of act.items) {
          claimId(item.id);
          expect(keys, `${item.id} answer in match options`).toContain(item.answer);
        }
      } else if (act.kind === 'mcq') {
        for (const item of act.items) {
          claimId(item.id);
          expect(item.options.map((o) => o.key), `${item.id} answer in mcq options`).toContain(item.answer);
        }
      } else if (act.kind === 'unscramble') {
        for (const item of act.items) {
          claimId(item.id);
          if (item.syllables) {
            // Reassembling all word-part syllables must match the exact non-space characters of the answer.
            const fromChunks = item.chunks.join('').toLowerCase().replace(/\s+/g, '').split('').sort().join('');
            const fromAnswer = item.answer.toLowerCase().replace(/\s+/g, '').split('').sort().join('');
            expect(fromChunks, `${item.id} syllable parts`).toBe(fromAnswer);
          } else {
            // Reassembling all word tiles must produce the exact words of the target sentence.
            expect(item.chunks.join(' ').split(/\s+/).sort(), `${item.id} word tiles`).toEqual(
              item.answer.split(/\s+/).sort(),
            );
          }
        }
      } else if (act.kind === 'word-search') {
        for (const word of act.words) claimId(word.id);
      } else if (act.kind === 'crossword') {
        for (const clue of act.clues) claimId(clue.id);
      } else if (act.kind === 'sequence') {
        for (const item of act.items) claimId(item.id);
        const answers = act.items.map((item) => item.answer).sort((a, b) => a - b);
        expect(answers).toEqual(Array.from({ length: act.count }, (_, idx) => idx + 1));
      } else if (act.kind === 'category-sort') {
        const keys = act.categories.map((c) => c.key);
        const used = new Set<string>();
        for (const item of act.items) {
          claimId(item.id);
          expect(keys, `${item.id} answer in category keys`).toContain(item.answer);
          used.add(item.answer);
        }
        // Every declared category (including Extra) must be populated by at least one phrase.
        expect(used.size, `${act.id} populates every category`).toBe(keys.length);
      } else if (act.kind === 'error-fix') {
        for (const item of act.items) {
          claimId(item.id);
          // Leaving the unedited sentence untouched must grade wrong.
          const unedited = gradeWorkbook(wb, { [item.id]: item.wrong });
          expect(unedited.byItem[item.id]?.answered, `${item.id} unedited answered`).toBe(true);
          expect(unedited.byItem[item.id]?.correct, `${item.id} unedited must be wrong`).toBe(false);
          // Alternate accepted rewrites and missing trailing punctuation must grade right.
          const noPeriod = gradeWorkbook(wb, { [item.id]: item.answer.replace(/\.$/, '') });
          expect(noPeriod.byItem[item.id]?.correct, `${item.id} without trailing period`).toBe(true);
          for (const alt of item.accepts ?? []) {
            const altGrade = gradeWorkbook(wb, { [item.id]: alt });
            expect(altGrade.byItem[item.id]?.correct, `${item.id} alternate rewrite`).toBe(true);
          }
        }
      } else if (act.kind === 'open-prompts') {
        for (const prompt of act.prompts) claimId(prompt.id);
      }
    }

    const perfect = gradeWorkbook(wb, perfectAnswersFor(allActivities));
    expect(perfect.answered).toBe(perfect.total);
    expect(perfect.correct).toBe(perfect.total);
    expect(perfect.pct).toBe(100);
  });

  it.each([
    { id: 'kid-2-hansel-and-gretel', size: 8, count: 6 },
    { id: 'kid-5-daedalus-and-icarus', size: 10, count: 6 },
    { id: 'kid-6-heidi', size: 10, count: 6 },
  ])('verifies every word path in $id ($size×$size word search)', ({ id, size, count }) => {
    const wb = getReaderWorkbook(id)!;
    const ws = wb.sections
      .flatMap((s) => s.activities)
      .find((a): a is Extract<WorkbookActivity, { kind: 'word-search' }> => a.kind === 'word-search')!;
    expect(ws.grid).toHaveLength(size);
    for (const row of ws.grid) expect(row).toHaveLength(size);
    expect(ws.words).toHaveLength(count);
    for (const word of ws.words) {
      const forward = wordSearchLine(ws.grid, word.start, word.end);
      const backward = wordSearchLine(ws.grid, word.end, word.start);
      expect(forward?.word, `${id}:${word.answer}`).toBe(word.answer);
      expect(backward?.reversed, `${id}:${word.answer} reversed`).toBe(word.answer);
    }
  });

  it.each([
    { id: 'kid-3-jack-and-the-magic-beans', count: 10 },
    { id: 'kid-4-the-trojan-horse', count: 10 },
    { id: 'kid-7-gullivers-travels', count: 8 },
    { id: 'kid-8-beauty-and-the-beast', count: 10 },
    { id: 'kid-9-the-gift-of-the-magi', count: 10 },
  ])('verifies every intersecting cell in $id crossword with zero letter collisions', ({ id, count }) => {
    const wb = getReaderWorkbook(id)!;
    const cw = wb.sections
      .flatMap((s) => s.activities)
      .find((a): a is Extract<WorkbookActivity, { kind: 'crossword' }> => a.kind === 'crossword')!;
    expect(cw.clues).toHaveLength(count);
    const grid = buildCrosswordGrid(cw.rows, cw.cols, cw.clues);

    for (const clue of cw.clues) {
      for (let i = 0; i < clue.answer.length; i += 1) {
        const r = clue.direction === 'down' ? clue.row + i : clue.row;
        const c = clue.direction === 'across' ? clue.col + i : clue.col;
        expect(r, `${id}:${clue.id} row in bounds`).toBeLessThan(cw.rows);
        expect(c, `${id}:${clue.id} col in bounds`).toBeLessThan(cw.cols);
        expect(grid[r]?.[c]?.solution, `${id}:${clue.id}[${i}] at (${r},${c})`).toBe(clue.answer[i]);
      }
    }
  });
});

describe('Kid 1–11 reader workbooks: state, Firestore payload & offline outbox', () => {
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
      bookId: 'kid-11-the-count-of-monte-cristo',
      drillSlug: 'reader-kid11-count-of-monte-cristo',
      drillTitle: 'Kid 11 · The Count of Monte Cristo — Workbook',
      studentName: 'Bora 11A',
      correctCount: 102,
      totalCount: 115,
      scorePct: 89,
      firstCorrectCount: 96,
      firstAnsweredCount: 115,
      checkCount: 1,
      queuedAt: 1000,
    };

    const failed = await submitWorkbookToTeacher(payload);
    expect(failed.ok).toBe(false);
    expect(failed.queued).toBe(true);
    expect(failed.message).toContain('Not sent yet');
    expect(readWorkbookOutbox()).toHaveLength(1);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ name: 'projects/x/documents/drill_attempts/abc' }), { status: 200 }),
    );
    const flushed = await flushWorkbookOutbox('reader-kid11-count-of-monte-cristo');
    expect(flushed).toEqual({ sent: 1, remaining: 0 });
    expect(store.has(WORKBOOK_OUTBOX_KEY)).toBe(false);
  });

  it('round-trips submitted workbook docs through both teacher Scores and student My score', () => {
    const payloadA = buildFirestoreWorkbookDoc(
      {
        bookId: 'kid-9-the-gift-of-the-magi',
        drillSlug: 'reader-kid9-gift-of-the-magi',
        drillTitle: 'Kid 9 · The Gift of the Magi — Workbook',
        studentName: 'Dara 9A',
        correctCount: 100,
        totalCount: 108,
        scorePct: 93,
        firstCorrectCount: 86,
        firstAnsweredCount: 108,
        checkCount: 2,
        queuedAt: 2000,
      },
      { uid: 'uid-dara', classId: 'Kid 9 — Morning' },
    );
    const payloadB = buildFirestoreWorkbookDoc(
      {
        bookId: 'kid-9-the-gift-of-the-magi',
        drillSlug: 'reader-kid9-gift-of-the-magi',
        drillTitle: 'Kid 9 · The Gift of the Magi — Workbook',
        studentName: 'Bopha 9A',
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
    const dara = myHomeworkScore(whole, { uid: 'uid-dara', name: 'Dara 9A' });
    expect(dara).toMatchObject({
      name: 'Dara 9A',
      firstTry: { correct: 86, total: 108, pct: 80 },
      best: { correct: 100, total: 108, pct: 93 },
      firstTryMeasured: true,
    });

    const bopha = myHomeworkScore(whole, { uid: '', name: 'bopha 9a' });
    expect(bopha).toMatchObject({
      name: 'Bopha 9A',
      firstTry: { correct: 76, total: 108, pct: 70 },
    });

    const stranger = myHomeworkScore(whole, { uid: 'uid-other', name: 'Dara 9A' });
    // Signed-in stranger cannot see Dara's uid-owned submission even with the same display name.
    expect(stranger).toBeNull();
  });

  it('gives all eleven Kid 1–11 workbooks distinct, Firestore-compliant drillSlugs and drillTitles', () => {
    const slugs = new Set<string>();
    const titles = new Set<string>();
    for (const wb of READER_WORKBOOKS) {
      expect(wb.drillSlug.length).toBeGreaterThan(0);
      expect(wb.drillSlug.length).toBeLessThanOrEqual(80);
      expect(wb.drillTitle.length).toBeGreaterThan(0);
      expect(wb.drillTitle.length).toBeLessThanOrEqual(120);
      expect(slugs.has(wb.drillSlug), `duplicate slug ${wb.drillSlug}`).toBe(false);
      expect(titles.has(wb.drillTitle), `duplicate title ${wb.drillTitle}`).toBe(false);
      slugs.add(wb.drillSlug);
      titles.add(wb.drillTitle);

      const grade = gradeWorkbook(wb, {});
      const doc = buildFirestoreWorkbookDoc(
        {
          bookId: wb.id,
          drillSlug: wb.drillSlug,
          drillTitle: wb.drillTitle,
          studentName: `Student K${wb.gradeNumber}`,
          correctCount: grade.total,
          totalCount: grade.total,
          scorePct: 100,
          firstCorrectCount: grade.total,
          firstAnsweredCount: grade.total,
          checkCount: 1,
          queuedAt: 5000 + wb.gradeNumber,
        },
        null,
      );
      const parsed = parseHomeworkAttempt({
        name: `projects/x/documents/drill_attempts/k${wb.gradeNumber}`,
        fields: doc.fields as never,
      });
      expect(parsed?.studentName).toBe(`Student K${wb.gradeNumber}`);
      expect(parsed?.homework).toBeNull();
      expect(parsed?.pct).toBe(100);
      expect(parsed?.correct).toBe(grade.total);
      expect(parsed?.total).toBe(grade.total);
    }
  });
});
