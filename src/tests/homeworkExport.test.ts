import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  KID11_HOMEWORK_SLUGS,
  buildHomeworkExports,
  displayStudentName,
  exportDocId,
  parseHomeworkRow,
  scoresByStudent,
  scoresToCsv,
} from '../../functions/lib/homeworkExport.cjs';
import {
  homeworkExportDocId,
  parseHomeworkArchive,
  parseHomeworkAttempt,
  scoreForAttempts,
  scoresByStudent as clientScoresByStudent,
  scoresToCsv as clientScoresToCsv,
} from '../lib/kidHomework';
import type { FsDoc, HomeworkAttempt } from '../lib/kidHomework';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(resolve(root, ...parts), 'utf8');

/**
 * Kid 11 daily homework archive (Blaze).
 *
 * The exportHomeworkSheets Cloud Function builds a CSV score sheet per
 * homework per day. These tests pin two things:
 *   1. the PARITY CONTRACT with the live teacher sheet (src/lib/kidHomework.ts)
 *      — a teacher must see the same names, first-try scores and columns in
 *      the archived file as in the sheet on screen;
 *   2. the ops contract — the function is scheduled once a day with
 *      maxInstances 1, writes only homework_exports, and the rules keep those
 *      documents teacher-readable and client-unwritable.
 */

const HW1_TITLE = 'Unit 13 · New Homes for Animals — Homework 1 · Field Notebook';
const HW2_TITLE = 'Unit 13 · New Homes for Animals — Homework 2 · Relocation Mission';
const NOW = Date.parse('2026-11-16T21:00:00+07:00');

/** Admin SDK `data()` shape — what the Cloud Function sees. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    drillSource: 'rfc3',
    drillSlug: 'unit13hw.html',
    drillTitle: HW1_TITLE,
    studentName: 'Dara Kim',
    studentUid: '',
    scorePct: 80,
    correctCount: 24,
    totalCount: 30,
    firstCorrectCount: 20,
    firstAnsweredCount: 26,
    checkCount: 2,
    submittedAt: '2026-11-16T10:00:00.000Z',
    ...overrides,
  };
}

/** The same row as a Firestore REST document — what the client parses. */
function restDoc(data: ReturnType<typeof row>): FsDoc {
  const fields: Record<string, Record<string, unknown>> = {
    drillSource: { stringValue: String(data.drillSource) },
    drillSlug: { stringValue: String(data.drillSlug) },
    drillTitle: { stringValue: String(data.drillTitle) },
    studentName: { stringValue: String(data.studentName) },
    studentUid: { stringValue: String(data.studentUid) },
    scorePct: { integerValue: String(data.scorePct) },
    correctCount: { integerValue: String(data.correctCount) },
    totalCount: { integerValue: String(data.totalCount) },
    firstCorrectCount: { integerValue: String(data.firstCorrectCount) },
    firstAnsweredCount: { integerValue: String(data.firstAnsweredCount) },
    checkCount: { integerValue: String(data.checkCount) },
    submittedAt: { timestampValue: String(data.submittedAt) },
  };
  return { name: 'projects/demo/databases/(default)/documents/drill_attempts/x', fields } as unknown as FsDoc;
}

const parsed = (rows: Array<ReturnType<typeof row>>) =>
  rows.map((r) => parseHomeworkRow(r)).filter((r) => r !== null);

describe('kid 11 homework archive — row parsing', () => {
  it('keeps only rfc3 rows and derives the homework number from the title', () => {
    expect(parseHomeworkRow(row({ drillSource: 'drill' }))).toBeNull();
    expect(parseHomeworkRow(null)).toBeNull();
    expect(parseHomeworkRow(row())?.homework).toBe(1);
    expect(parseHomeworkRow(row({ drillTitle: HW2_TITLE }))?.homework).toBe(2);
    expect(parseHomeworkRow(row({ drillTitle: 'No number here' }))?.homework).toBeNull();
  });

  it('never treats an email as a student name (same rule as the site)', () => {
    expect(displayStudentName('mam.ry@aii.edu.kh')).toBe('Mam Ry');
    expect(displayStudentName('Sok Dara')).toBe('Sok Dara');
    expect(parseHomeworkRow(row({ studentName: 'mam.ry@aii.edu.kh' }))?.studentName).toBe('Mam Ry');
  });

  it('clamps impossible counts and tolerates missing timestamps', () => {
    const r = parseHomeworkRow(row({ correctCount: 99, totalCount: 30, submittedAt: 'not a date' }));
    expect(r?.correct).toBe(30);
    expect(r?.at).toBe(0);
    expect(parseHomeworkRow(row({ correctCount: -5, totalCount: 30 }))?.correct).toBe(0);
  });
});

describe('kid 11 homework archive — parity with the live score sheet', () => {
  const rows = [
    row({ studentName: 'Dara Kim', submittedAt: '2026-11-16T09:00:00.000Z', scorePct: 40, correctCount: 12 }),
    row({ studentName: 'dara  kim', submittedAt: '2026-11-16T11:00:00.000Z', scorePct: 90, correctCount: 27 }),
    row({ studentName: 'Sokha', studentUidName: '', submittedAt: '2026-11-16T10:30:00.000Z', drillTitle: HW2_TITLE, scorePct: 60, correctCount: 15, totalCount: 25 }),
  ];

  it('groups one line per student, exactly like scoresByStudent()', () => {
    const server = scoresByStudent(parsed(rows));
    const client = clientScoresByStudent(
      rows.map((r) => parseHomeworkAttempt(restDoc(r))).filter((a): a is HomeworkAttempt => a !== null),
    );
    expect(server.length).toBe(client.length);
    expect(server.map((s) => s.name)).toEqual(client.map((s) => s.name));
    expect(server.map((s) => s.submissions)).toEqual(client.map((s) => s.submissions));
    expect(server.map((s) => s.best)).toEqual(client.map((s) => s.best));
    expect(server.map((s) => s.firstTry)).toEqual(client.map((s) => s.firstTry));
    expect(server.map((s) => s.firstTryMeasured)).toEqual(client.map((s) => s.firstTryMeasured));
    expect(server.map((s) => s.firstAnswered)).toEqual(client.map((s) => s.firstAnswered));
    expect(server.map((s) => s.checks)).toEqual(client.map((s) => s.checks));
    // "dara kim" and "Dara Kim" are one student: first try from the EARLIEST
    // submission, best score from the highest one.
    const dara = server.find((s) => s.key === 'dara kim');
    expect(dara?.submissions).toBe(2);
    expect(dara?.firstTry).toEqual({ correct: 20, total: 30, pct: 67 });
    expect(dara?.best).toEqual({ correct: 27, total: 30, pct: 90 });
    expect(dara?.firstTryMeasured).toBe(true);
    expect(dara?.checks).toBe(2);
  });

  it('produces a byte-identical CSV to the live sheet', () => {
    const server = scoresByStudent(parsed(rows));
    const client = clientScoresByStudent(
      rows.map((r) => parseHomeworkAttempt(restDoc(r))).filter((a): a is HomeworkAttempt => a !== null),
    );
    expect(scoresToCsv(HW1_TITLE, server)).toBe(clientScoresToCsv(HW1_TITLE, client));
  });

  it('falls back to the first submission when no first-check was recorded', () => {
    const oldRows = parsed([row({ firstCorrectCount: -1, firstAnsweredCount: -1, checkCount: 0, scorePct: 55, correctCount: 16 })]);
    const [line] = scoresByStudent(oldRows);
    expect(line.firstTryMeasured).toBe(false);
    expect(line.firstTry).toEqual({ correct: 16, total: 30, pct: 55 });
    expect(line.checks).toBeNull();
    // Same fallback on the client, for the same row.
    const client = scoreForAttempts([
      parseHomeworkAttempt(restDoc(row({ firstCorrectCount: 0, firstAnsweredCount: 0, checkCount: 0, scorePct: 55, correctCount: 16 })))!,
    ]);
    expect(client?.firstTryMeasured).toBe(true); // firstCorrect=0 is a real measurement
  });

  it('escapes CSV-injection attempts and embedded commas/quotes', () => {
    const evil = scoresByStudent(
      parsed([row({ studentName: '=HYPERLINK("http://evil","Click")' }), row({ studentName: 'Kim, "K"' })]),
    );
    const csv = scoresToCsv('T', evil);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('"Kim, ""K"""');
    const dataLines = csv.split('\r\n').slice(2).filter(Boolean);
    const evilLine = dataLines.find((l) => l.includes('HYPERLINK')) || '';
    expect(evilLine.startsWith(`"'=HYPERLINK`)).toBe(true);
    const commaLine = dataLines.find((l) => l.includes('Kim')) || '';
    expect(commaLine.startsWith('"Kim, ""K"""')).toBe(true);
    // No data row may begin with a live formula character.
    for (const line of dataLines) expect(/^[=+@]/.test(line)).toBe(false);
  });
});

describe('kid 11 homework archive — documents', () => {
  it('writes one document per homework, always three, with the page split', () => {
    const rows = parsed([
      row({ studentName: 'A', drillTitle: HW1_TITLE }),
      row({ studentName: 'B', drillTitle: HW2_TITLE, totalCount: 25, correctCount: 20, scorePct: 80 }),
    ]);
    const docs = buildHomeworkExports({ slug: 'unit13hw.html', rows, now: NOW });
    expect(docs.map((d) => d.docId)).toEqual(['unit13hw__hw1', 'unit13hw__hw2', 'unit13hw__hw3']);
    expect(docs[0].fields.students).toBe(1);
    expect(docs[0].fields.title).toBe(HW1_TITLE);
    expect(docs[1].fields.students).toBe(1);
    expect(docs[1].fields.title).toBe(HW2_TITLE);
    // A homework with no submissions still gets a document (so the sheet can
    // say "nothing handed in" instead of "archive missing"), with no CSV.
    expect(docs[2].fields.students).toBe(0);
    expect(docs[2].fields.csv).toBe('');
    expect(docs[2].fields.title).toBe('Unit 13 · New Homes for Animals — Homework 3 · Campaign Studio');
    expect(docs[0].fields.generatedAt).toEqual(new Date(NOW));
  });

  it('caps the CSV so a runaway page can never write a 1 MiB document', () => {
    const rows = parsed(Array.from({ length: 40 }, (_, i) => row({ studentName: `Student ${i}`, submittedAt: `2026-11-16T10:${String(i).padStart(2, '0')}:00.000Z` })));
    const docs = buildHomeworkExports({ slug: 'unit13hw.html', rows, now: NOW, maxCsvChars: 600 });
    const doc = docs[0].fields;
    expect(doc.csv.length).toBeLessThanOrEqual(600);
    expect(doc.omitted).toBeGreaterThan(0);
    expect(doc.omitted + doc.students).toBe(40);
  });

  it('doc ids are Firestore-safe and match the client helper', () => {
    for (const slug of KID11_HOMEWORK_SLUGS) {
      for (const n of [1, 2, 3]) {
        const id = exportDocId(slug, n);
        expect(id).toMatch(/^[a-z0-9_-]+$/);
        expect(id).toBe(homeworkExportDocId(slug, n));
        expect(id).toContain('__hw' + n);
      }
    }
    for (const slug of KID11_HOMEWORK_SLUGS) expect(existsSync(resolve(root, 'public/rfc3', slug))).toBe(true);
  });
});

describe('kid 11 homework archive — client reader', () => {
  it('parses the stored document', () => {
    const archive = parseHomeworkArchive({
      fields: {
        title: { stringValue: HW1_TITLE },
        students: { integerValue: '12' },
        submissions: { integerValue: '15' },
        omitted: { integerValue: '0' },
        csv: { stringValue: 'T\r\nH\r\n' },
        generatedAt: { timestampValue: '2026-11-16T14:00:00.000Z' },
      },
    } as FsDoc);
    expect(archive).toEqual({
      students: 12,
      submissions: 15,
      omitted: 0,
      csv: 'T\r\nH\r\n',
      generatedAt: Date.parse('2026-11-16T14:00:00.000Z'),
      title: HW1_TITLE,
    });
    expect(parseHomeworkArchive({ fields: {} } as FsDoc)).toEqual({
      students: 0, submissions: 0, omitted: 0, csv: '', generatedAt: 0, title: '',
    });
    expect(parseHomeworkArchive({} as FsDoc)).toBeNull();
  });
});

describe('kid 11 homework archive — ops contract', () => {
  const fn = read('functions', 'index.js');
  const rules = read('firestore.rules');
  const minRules = read('firestore-min.rules');
  const sheet = read('src', 'components', 'KidHomeworkScores.tsx');

  it('schedules one run a day, in Cambodia time, with maxInstances 1', () => {
    expect(fn).toContain('exports.exportHomeworkSheets = onSchedule(');
    expect(fn).toContain("schedule: '0 21 * * *'");
    expect(fn).toContain("timeZone: 'Asia/Phnom_Penh'");
    expect(fn).toContain('maxInstances: 1');
    expect(fn).toContain("db.doc(`homework_exports/${docId}`)");
    expect(fn).toContain('KID11_HOMEWORK_SLUGS');
    // Same cap as the client's page read — no unbounded scans.
    expect(fn).toContain('.limit(3000)');
  });

  it('reads only the six Grade-11 homework pages, one equality filter each', () => {
    expect(KID11_HOMEWORK_SLUGS).toEqual([
      'unit2hw.html', 'unit3hw.html', 'unit4hw.html',
      'unit13hw.html', 'unit15hw.html', 'doctor-fish.html',
    ]);
    expect(fn).toContain(".where('drillSlug', '==', slug)");
    // No orderBy/range pair in the export path → the automatic single-field
    // index is enough (rollupTicker's own range+orderBy stays where it is).
    const exportFn = fn.slice(fn.indexOf('exports.exportHomeworkSheets'));
    expect(exportFn).not.toContain('.orderBy(');
  });

  it('keeps homework_exports teacher-readable and client-unwritable', () => {
    for (const source of [rules, minRules]) {
      expect(source).toContain('match /homework_exports/{docId}');
      expect(source).toMatch(/match \/homework_exports\/\{docId\} \{\s*allow read: if isVerifiedTeacher\(\);\s*allow write: if false;/);
    }
  });

  it('surfaces the archive in the teacher score sheet', () => {
    expect(sheet).toContain('fetchHomeworkArchive');
    expect(sheet).toContain('Download nightly archive');
    expect(sheet).toContain('homeworkExportDocId');
  });

  it('never runs the archive for a whole-page assignment (the quiz has no #hw- number)', () => {
    expect(sheet).toContain('if (!ref || ref.number === null) return;');
  });
});
