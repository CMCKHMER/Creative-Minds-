// Kid-section homework score sheet (src/lib/kidHomework.ts).
//
// Owner report, Nov 2026: "for the assigned home work for the kid section, i
// need to get their completion score because the live leaderboards dont show
// it so i dont know how well or bad they did on their assignment".
// The scores were stored; no screen listed them per homework.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KID_GRADE_RESOURCES } from '../data/kidGradeResources';
import {
  attemptsForHomework, homeworkNumberFromTitle, homeworkRefFromHref, myHomeworkScore,
  parseHomeworkAttempt, scoreBandLabel, scoresByStudent, scoresToCsv, sortScores, summarizeScores,
} from '../lib/kidHomework';
import type { FsDoc, HomeworkAttempt } from '../lib/kidHomework';

const ROOT = resolve(__dirname, '../..');
const homework = KID_GRADE_RESOURCES.flatMap((g) => g.materials).filter((m) => m.kind === 'Online homework');
const pages = [...new Set(homework.map((m) => homeworkRefFromHref(m.href)?.slug))];

const T0 = Date.parse('2026-11-10T08:00:00Z');
const HOUR = 3_600_000;

function doc(over: Record<string, unknown> = {}, id = 'a1'): FsDoc {
  const base: Record<string, unknown> = {
    drillSlug: { stringValue: 'unit13hw.html' },
    drillTitle: { stringValue: 'Unit 13 · New Homes for Animals — Homework 2 · Relocation Mission' },
    drillSource: { stringValue: 'rfc3' },
    studentName: { stringValue: 'Sok Dara' },
    studentUid: { stringValue: '' },
    scorePct: { integerValue: '80' },
    correctCount: { integerValue: '20' },
    totalCount: { integerValue: '25' },
    submittedAt: { timestampValue: new Date(T0).toISOString() },
  };
  return { name: `projects/p/databases/(default)/documents/drill_attempts/${id}`, fields: { ...base, ...over } as FsDoc['fields'] };
}
function attempt(name: string, correct: number, atHours: number, extra: Partial<HomeworkAttempt> = {}): HomeworkAttempt {
  return {
    id: `${name}-${atHours}`, studentName: name, signedIn: false, homework: 1,
    correct, total: 30, pct: Math.round((correct / 30) * 100), at: T0 + atHours * HOUR,
    firstCorrect: null, firstAnswered: null, checks: null, studentUid: '', ...extra,
  };
}

describe('kid homework — which homework a row belongs to', () => {
  it('every homework on the Kid cards maps to a page and a number 1–3', () => {
    expect(homework.length).toBeGreaterThanOrEqual(18);
    for (const m of homework) {
      const ref = homeworkRefFromHref(m.href);
      expect(ref, m.href).not.toBeNull();
      expect([1, 2, 3]).toContain(ref!.number);
      // the card title and the link agree on the number
      expect(homeworkNumberFromTitle(m.title), m.title).toBe(ref!.number);
    }
  });

  it('reads the page file and the homework letter from the link', () => {
    expect(homeworkRefFromHref('./rfc3/unit13hw.html#hw-b')).toEqual({ slug: 'unit13hw.html', number: 2 });
    expect(homeworkRefFromHref('./rfc3/doctor-fish.html#hw-c')).toEqual({ slug: 'doctor-fish.html', number: 3 });
    expect(homeworkRefFromHref('https://cmckhmer.github.io/Creative-Minds-/rfc3/word-list.html')).toBeNull();
  });

  it('reads the homework number from the title the pages store', () => {
    expect(homeworkNumberFromTitle('Unit 13 · New Homes for Animals — Homework 2 · Relocation Mission')).toBe(2);
    expect(homeworkNumberFromTitle('Unit 14 · Doctor Fish — Homework 3 · Health Writer')).toBe(3);
    expect(homeworkNumberFromTitle('Unit 14 · Doctor Fish')).toBeNull();
  });

  it('each page stores exactly the slug and the titles the sheet looks for', () => {
    expect(pages.length).toBeGreaterThanOrEqual(6);
    for (const slug of pages) {
      const html = readFileSync(resolve(ROOT, 'public/rfc3', slug!), 'utf8');
      expect(html, slug).toContain(`drillSlug:   { stringValue: '${slug}' }`);
      expect(html, slug).toContain("drillSource: { stringValue: 'rfc3' }");
      for (const [letter, n] of [['a', 1], ['b', 2], ['c', 3]] as const) {
        expect(html, `${slug} ${letter}`).toMatch(new RegExp(`\\n    ${letter}: 'Homework ${n} · [^']+'`));
      }
    }
  });
});

describe('kid homework — the pages send what the sheet needs', () => {
  it('every homework page grades again at submit and sends the first check', () => {
    for (const slug of pages) {
      const html = readFileSync(resolve(ROOT, 'public/rfc3', slug!), 'utf8');
      const score = /function cmcCurrentScore\(root\) \{([\s\S]*?)\n {2}\}\n/.exec(html)?.[1] ?? '';
      // no "only when the panel is closed" condition — a stale checked score must not be sent
      expect(score, slug).not.toContain('panel.hidden');
      expect(score, slug).toMatch(/\n {4}(grade\(root\);|if \(window\.CMC_HW_GRADE\) window\.CMC_HW_GRADE\(root\);)\n/);
      expect(html, slug).toContain(`var CMC_TRY_PREFIX = 'cmc-hw-first:${slug}:';`);
      for (const field of ['firstCorrectCount', 'firstAnsweredCount', 'checkCount']) {
        expect(html, `${slug} ${field}`).toContain(`body.${field} = { integerValue:`);
      }
      // the fields the Firestore rules check stay exactly as they were
      for (const field of ['drillSlug', 'drillTitle', 'drillSource', 'studentName', 'studentUid', 'scorePct', 'correctCount', 'totalCount', 'classId', 'submittedAt']) {
        expect(html, `${slug} ${field}`).toMatch(new RegExp(`\\n {6}${field}: +\\{ `));
      }
    }
  });
});

describe('kid homework — reading a stored row', () => {
  it('parses a row and prettifies an email stored as a name', () => {
    const a = parseHomeworkAttempt(doc({ studentName: { stringValue: 'mam.ry@aii.edu.kh' }, studentUid: { stringValue: 'u1' } }, 'xyz'));
    expect(a).toMatchObject({ id: 'xyz', studentName: 'Mam Ry', signedIn: true, homework: 2, correct: 20, total: 25, pct: 80, at: T0, firstCorrect: null, firstAnswered: null, checks: null });
  });

  it('reads the first-check fields when the page sent them', () => {
    const a = parseHomeworkAttempt(doc({ firstCorrectCount: { integerValue: '11' }, firstAnsweredCount: { integerValue: '19' }, checkCount: { integerValue: '3' } }));
    expect(a).toMatchObject({ firstCorrect: 11, firstAnswered: 19, checks: 3 });
  });

  it('ignores impossible first-check values instead of showing them', () => {
    const a = parseHomeworkAttempt(doc({ firstCorrectCount: { integerValue: '99' }, checkCount: { integerValue: '0' } }));
    expect(a).toMatchObject({ firstCorrect: null, firstAnswered: null, checks: null });
  });

  it('skips rows that are not homework (games post under the same collection)', () => {
    expect(parseHomeworkAttempt(doc({ drillSource: { stringValue: 'learning-games' } }))).toBeNull();
    expect(parseHomeworkAttempt({})).toBeNull();
  });
});

describe('kid homework — one line per student', () => {
  it('keeps homeworks apart and applies the "since" filter', () => {
    const all = [attempt('A', 10, 0), attempt('B', 12, 30, { homework: 2 }), attempt('C', 14, 50), attempt('D', 9, 5, { homework: null })];
    expect(attemptsForHomework(all, 1).map((a) => a.studentName)).toEqual(['A', 'C']);
    expect(attemptsForHomework(all, 2).map((a) => a.studentName)).toEqual(['B']);
    expect(attemptsForHomework(all, 1, T0 + 40 * HOUR).map((a) => a.studentName)).toEqual(['C']);
  });

  it('merges spellings that differ only in capitals and spacing, and shows the best one', () => {
    const rows = scoresByStudent([attempt('Sok  Dara', 15, 0), attempt('sok dara', 22, 2), attempt('SOK DARA ', 18, 4), attempt('Sok Darra', 30, 1)]);
    expect(rows.map((r) => r.name)).toEqual(['Sok Dara', 'Sok Darra']);
    expect(rows[0].submissions).toBe(3);
    // all capitals is still better than none; the latest spelling wins a tie
    expect(scoresByStudent([attempt('sok dara', 1, 0), attempt('SOK DARA', 2, 1)])[0].name).toBe('SOK DARA');
    expect(scoresByStudent([attempt('Sok dara', 1, 0), attempt('Sok Dara', 2, 1)])[0].name).toBe('Sok Dara');
  });

  it('best = highest handed in, first try = the first check of the first submission', () => {
    const [r] = scoresByStudent([
      attempt('Sok Dara', 22, 3, { firstCorrect: 5, firstAnswered: 5, checks: 2 }),   // second submission
      attempt('Sok Dara', 15, 0, { firstCorrect: 5, firstAnswered: 5, checks: 1 }),   // first submission
      attempt('Sok Dara', 19, 6, { firstCorrect: 19, firstAnswered: 30, checks: 1 }), // a later visit — not a first try
    ]);
    expect(r.submissions).toBe(3);
    expect(r.best).toEqual({ correct: 22, total: 30, pct: 73 });
    expect(r.firstTry).toEqual({ correct: 5, total: 30, pct: 17 });
    expect(r.firstTryMeasured).toBe(true);
    expect(r.firstAnswered).toBe(5);
    expect(r.checks).toBe(1);
    expect(r.firstAt).toBe(T0);
    expect(r.lastAt).toBe(T0 + 6 * HOUR);
  });

  it('a row from before the pages recorded the first check falls back to the first submission — and says so', () => {
    const [r] = scoresByStudent([attempt('Chan Thy', 12, 0), attempt('Chan Thy', 28, 1)]);
    expect(r.firstTry).toEqual({ correct: 12, total: 30, pct: 40 });
    expect(r.firstTryMeasured).toBe(false);
    expect(r.firstAnswered).toBeNull();
    expect(r.best.correct).toBe(28);
  });

  it('never invents a score: nobody handed in → no lines, averages 0', () => {
    expect(scoresByStudent([])).toEqual([]);
    expect(summarizeScores([])).toEqual({ students: 0, submissions: 0, avgFirstTry: 0, avgBest: 0, below50: 0 });
  });

  it('sorts by name, by lowest first try, by newest', () => {
    const rows = scoresByStudent([
      attempt('Bora', 27, 0), attempt('chan', 12, 5), attempt('Dara', 5, 2, { firstCorrect: 5, checks: 1 }), attempt('Dara', 22, 9, { firstCorrect: 5, checks: 2 }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(['Bora', 'chan', 'Dara']);
    expect(sortScores(rows, 'lowest').map((r) => r.name)).toEqual(['Dara', 'chan', 'Bora']);
    expect(sortScores(rows, 'newest').map((r) => r.name)).toEqual(['Dara', 'chan', 'Bora']);
    expect(rows.map((r) => r.name)).toEqual(['Bora', 'chan', 'Dara']); // sorting returns a copy
  });

  it('summary: students, submissions, both averages, how many started below 50%', () => {
    const rows = scoresByStudent([
      attempt('Bora', 27, 0), attempt('Chan', 12, 5), attempt('Dara', 15, 2, { firstCorrect: 5, checks: 1 }), attempt('Dara', 22, 9, { firstCorrect: 5, checks: 2 }),
    ]);
    // first tries 90, 40, 17 → 49 · best 90, 40, 73 → 68
    expect(summarizeScores(rows)).toEqual({ students: 3, submissions: 4, avgFirstTry: 49, avgBest: 68, below50: 2 });
  });
});

describe('kid homework — a student sees their OWN score', () => {
  const ID = { uid: 'uid-dara', name: 'Sok Dara' };

  it('finds the line of the signed-in account, whatever name was typed', () => {
    const rows = [
      attempt('Dara 7A', 18, 0, { studentUid: 'uid-dara' }),
      attempt('dara', 27, 2, { studentUid: 'uid-dara' }),
      attempt('Sok Dara', 9, 1),            // another student, same-ish name
      attempt('Sok Dara', 12, 1),           // handed in without an account
    ];
    const mine = myHomeworkScore(rows, ID);
    expect(mine).not.toBeNull();
    // Both of the account's spellings pool into ONE line.
    expect(mine!.submissions).toBe(2);
    expect(mine!.best.pct).toBe(90);
    expect(mine!.firstTry.pct).toBe(60); // first submission: 18/30
  });

  it('falls back to the typed name when the row carries no account', () => {
    const rows = [
      attempt('  SOK   dara ', 21, 0),
      attempt('Someone Else', 3, 1),
    ];
    const mine = myHomeworkScore(rows, { uid: 'uid-not-used', name: 'Sok Dara' });
    // The name matches, but the row belongs to no account — allowed, because
    // the account has no rows of its own on this homework.
    expect(mine!.best.correct).toBe(21);
    expect(mine!.name).toBe('SOK dara');
  });

  it('never shows a row that belongs to another ACCOUNT', () => {
    // A namesake signed in with a different account: their row is claimed by
    // that uid, so it can never be served to this student.
    const rows = [attempt('Sok Dara', 30, 0, { studentUid: 'uid-someone-else' })];
    expect(myHomeworkScore(rows, ID)).toBeNull();

    // An account-less row under the typed name is still found (most homework
    // is handed in without an account) — but the other account's perfect
    // score is not counted into this student's line.
    const mixed = [
      attempt('Sok Dara', 30, 0, { studentUid: 'uid-someone-else' }),
      attempt('Sok Dara', 6, 1),
    ];
    const mine = myHomeworkScore(mixed, ID);
    expect(mine!.submissions).toBe(1);
    expect(mine!.best.correct).toBe(6);
  });

  it('ignores other students entirely — one line, never a class list', () => {
    const rows = [
      attempt('Sok Dara', 24, 0, { studentUid: 'uid-dara' }),
      attempt('A B', 30, 0, { studentUid: 'uid-a' }),
      attempt('C D', 30, 0, { studentUid: 'uid-c' }),
    ];
    const mine = myHomeworkScore(rows, ID);
    expect(mine!.name.toLowerCase()).toContain('dara');
    expect(mine!.best.correct).toBe(24);
    // The other students' perfect scores do not change my "best".
    expect(mine!.best.pct).toBe(80);
  });

  it('nobody handed in → null, so the card says "nothing yet" instead of 0%', () => {
    expect(myHomeworkScore([], ID)).toBeNull();
    expect(myHomeworkScore([attempt('Other Kid', 10, 0)], ID)).toBeNull();
  });

  it('an empty identity matches nothing (no accidental "first student")', () => {
    const rows = [attempt('Sok Dara', 10, 0), attempt('', 5, 1)];
    expect(myHomeworkScore(rows, { uid: '', name: '' })).toBeNull();
    expect(myHomeworkScore(rows, { uid: '   ', name: '   ' })).toBeNull();
  });

  it('labels the score in words a student can act on', () => {
    expect(scoreBandLabel(100)).toBe('Excellent');
    expect(scoreBandLabel(90)).toBe('Excellent');
    expect(scoreBandLabel(80)).toBe('Great work');
    expect(scoreBandLabel(75)).toBe('Great work');
    expect(scoreBandLabel(60)).toBe('Getting there');
    expect(scoreBandLabel(50)).toBe('Getting there');
    expect(scoreBandLabel(20)).toBe('Keep practising');
    expect(scoreBandLabel(0)).toBe('Keep practising');
  });

  it('matches a name the same way the rows were stored (emails prettified)', () => {
    // Rows sent by a Gmail sign-in without a display name store the email;
    // parseHomeworkAttempt prettifies it to "Mam Ry". The identity must be
    // normalized identically or the student would never find their own row.
    const rows = [parseHomeworkAttempt(doc({ studentName: { stringValue: 'mam.ry@aii.edu.kh' } }))!];
    expect(myHomeworkScore(rows, { uid: '', name: 'Mam Ry' })!.submissions).toBe(1);
    expect(myHomeworkScore(rows, { uid: '', name: 'mam.ry@aii.edu.kh' })!.submissions).toBe(1);
  });

  it('reads the account uid off the stored row', () => {
    const parsed = parseHomeworkAttempt(doc({ studentUid: { stringValue: 'uid-dara' } }));
    expect(parsed!.studentUid).toBe('uid-dara');
    expect(parseHomeworkAttempt(doc())!.studentUid).toBe('');
    // A row without the field at all (older rows) is still safe.
    const bare = doc();
    delete (bare.fields as Record<string, unknown>).studentUid;
    expect(parseHomeworkAttempt(bare)!.studentUid).toBe('');
  });
});

describe('kid homework — download', () => {
  it('writes a header and one line per student; names cannot run as formulas', () => {
    const rows = scoresByStudent([
      attempt('Dara, Sok', 15, 0, { firstCorrect: 5, firstAnswered: 5, checks: 1 }),
      attempt('=HYPERLINK("http://x","Click")', 30, 1),
    ]);
    const lines = scoresToCsv('Kid 11 — Unit 13 · Homework 1 — Field Notebook', rows).trim().split('\r\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe('Kid 11 — Unit 13 · Homework 1 — Field Notebook');
    expect(lines[1]).toBe('Student,First try,First try %,First try measured,Answered at first check,Best score,Best %,Out of,Checks before first submit,Times submitted,First submitted,Last submitted');
    expect(lines[2]).toBe(`"'=HYPERLINK(""http://x"",""Click"")",30,100,first submission,,30,100,30,,1,2026-11-10 09:00 UTC,2026-11-10 09:00 UTC`);
    expect(lines[3]).toBe('"Dara, Sok",5,17,at first check,5,15,50,30,1,1,2026-11-10 08:00 UTC,2026-11-10 08:00 UTC');
  });
});
