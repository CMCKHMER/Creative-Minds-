// Kid-section online homework — the teacher's score sheet.
//
// Every homework page (public/rfc3/*hw.html, doctor-fish.html) grades itself
// and, on "Submit to Teacher", stores one row in `drill_attempts`:
//   drillSlug 'unit13hw.html' · drillSource 'rfc3' ·
//   drillTitle 'Unit 13 · New Homes for Animals — Homework 2 · Relocation Mission'
//   studentName · correctCount · totalCount · scorePct · submittedAt
// The rows carry no class id (classId null), so the dashboard's class feed
// never lists them. The only places they surfaced were the homepage ticker
// and the games leaderboard, and both show "N drills · X% avg" over
// everything a student did — never the score of one homework (owner report,
// Nov 2026: "the live leaderboards don't show it so I don't know how well or
// bad they did on their assignment").
//
// This module reads the rows of ONE homework and turns them into a score
// sheet: one line per student. The pure part (parse, group, sort, CSV) has
// no network and no React so it is unit-tested.
//
// "First try": a homework page shows the right answers after "Check
// answers", and a student may correct and submit again — so the submitted
// score alone says little. Since Nov 2026 the pages also send the score of
// the student's FIRST check (`firstCorrectCount`), how many items were
// answered at that moment (`firstAnsweredCount`) and how many times they
// checked (`checkCount`). Rows handed in before that have none of these; for
// them the first SUBMISSION is the best available stand-in.

import { csvSafeText } from './csvSafe';
import { FIREBASE_PROJECT_ID } from './firebaseAuth';
import { displayStudentName } from './studentName';

export interface HomeworkRef {
  /** Page file name as the pages store it in drillSlug, e.g. 'unit13hw.html'. */
  slug: string;
  /** 1, 2 or 3 — which homework on that page. null = the whole page is ONE
   *  assignment (the Units 12–13 secure quiz has no #hw- anchor and no
   *  "Homework N" numbering, so every row of its page belongs to it). */
  number: number | null;
}

const LETTER_TO_NUMBER: Record<string, number> = { a: 1, b: 2, c: 3 };

/** './rfc3/unit13hw.html#hw-b' → { slug: 'unit13hw.html', number: 2 }. */
export function homeworkRefFromHref(href: string): HomeworkRef | null {
  const m = /([^/#?]+\.html)(?:\?[^#]*)?#hw-([a-c])$/i.exec(String(href || '').trim());
  if (!m) return null;
  return { slug: m[1], number: LETTER_TO_NUMBER[m[2].toLowerCase()] };
}

/** './rfc3/unit12-13-quiz.html' → { slug: 'unit12-13-quiz.html', number: null }.
 *  For standalone score pages that are a single assignment: the teacher's
 *  "Scores & violations" button used to feed this href into
 *  homeworkRefFromHref, get null, and render "This homework has no score
 *  sheet" — quiz submissions existed but the teacher could never see them. */
export function wholePageRefFromHref(href: string): HomeworkRef | null {
  const m = /([^/#?]+\.html)(?:[?#].*)?$/i.exec(String(href || '').trim());
  if (!m) return null;
  return { slug: m[1], number: null };
}

/** '… — Homework 2 · Relocation Mission' → 2. null when the title has none. */
export function homeworkNumberFromTitle(title: string): number | null {
  const m = /\bHomework\s*(\d+)\b/i.exec(String(title || ''));
  return m ? Number(m[1]) : null;
}

export interface HomeworkAttempt {
  id: string;
  /** Name as shown to the teacher (an email stored as a name is prettified). */
  studentName: string;
  /** True when the row was sent from a signed-in account. */
  signedIn: boolean;
  homework: number | null;
  correct: number;
  total: number;
  pct: number;
  /** Epoch ms; 0 when the row has no usable time. */
  at: number;
  /** Score of the first "Check answers" — null on rows sent before Nov 2026. */
  firstCorrect: number | null;
  /** Items answered at that first check — tells "checked an empty paper"
   *  from "tried everything". null on older rows. */
  firstAnswered: number | null;
  /** How many times the student pressed "Check answers" — null on older rows. */
  checks: number | null;
  /** Firebase uid of the signed-in account that sent the row ('' when the
   *  row was handed in without an account). Lets a student find THEIR OWN
   *  submission even if they typed their name differently. */
  studentUid: string;
  /** Integrity violations reported by the secure quiz (tab hides, screenshot
   *  keys, …). null when the page reported none — homework rows omit it. */
  violations?: number | null;
}

interface FsValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  timestampValue?: string;
}
export interface FsDoc {
  name?: string;
  fields?: Record<string, FsValue>;
}

function intOf(v: FsValue | undefined): number | null {
  if (!v) return null;
  const raw = v.integerValue ?? v.doubleValue;
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : null;
}

const pctOf = (correct: number, total: number): number =>
  total > 0 ? Math.round((correct / total) * 100) : 0;

/** One Firestore REST document → attempt. null when it is not a homework row. */
export function parseHomeworkAttempt(doc: FsDoc): HomeworkAttempt | null {
  const f = doc.fields;
  if (!f) return null;
  if ((f.drillSource?.stringValue || '') !== 'rfc3') return null;
  const total = Math.max(0, intOf(f.totalCount) ?? 0);
  const correct = Math.min(Math.max(0, intOf(f.correctCount) ?? 0), total || Number.MAX_SAFE_INTEGER);
  const t = f.submittedAt?.timestampValue ? Date.parse(f.submittedAt.timestampValue) : NaN;
  const first = intOf(f.firstCorrectCount);
  const checks = intOf(f.checkCount);
  const answered = intOf(f.firstAnsweredCount);
  const viol = intOf(f.violations);
  return {
    id: String(doc.name || '').split('/').pop() || '',
    studentName: displayStudentName(f.studentName?.stringValue) || 'No name',
    signedIn: !!f.studentUid?.stringValue,
    homework: homeworkNumberFromTitle(f.drillTitle?.stringValue || ''),
    correct,
    total,
    // The stored percentage is what the student saw; fall back to the counts.
    pct: intOf(f.scorePct) ?? pctOf(correct, total),
    at: Number.isNaN(t) ? 0 : t,
    firstCorrect: first !== null && first >= 0 && (total === 0 || first <= total) ? first : null,
    firstAnswered: first !== null && answered !== null && answered >= 0 ? Math.min(answered, total || answered) : null,
    checks: checks !== null && checks >= 1 ? checks : null,
    studentUid: (f.studentUid?.stringValue || '').trim(),
    violations: viol !== null && viol >= 0 ? viol : null,
  };
}

export interface StudentScore {
  /** Grouping key: the name, case and spacing ignored. */
  key: string;
  name: string;
  /** How many times this student pressed "Submit to Teacher". */
  submissions: number;
  /** The highest submitted score. */
  best: { correct: number; total: number; pct: number };
  /** The score before the page showed the answers (see the header note). */
  firstTry: { correct: number; total: number; pct: number };
  /** true — measured at the first "Check answers"; false — the first
   *  submission stands in for it (row sent before the pages recorded it). */
  firstTryMeasured: boolean;
  /** Items answered when the first check was made; null if unknown. */
  firstAnswered: number | null;
  /** "Check answers" presses before the first submission; null if unknown. */
  checks: number | null;
  /** Epoch ms of the first and the latest submission (0 = unknown). */
  firstAt: number;
  lastAt: number;
  /** Worst violation count across the student's submissions (quiz only). */
  violations?: number | null;
}

const nameKey = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, ' ');

/** Of several spellings that differ only in capitals and spacing, show the
 *  one written most like a name ("Sok Dara", not "sok  dara"); latest wins a tie. */
function bestSpelling(names: string[]): string {
  // "Sok Dara" (2) beats "SOK DARA" (1) beats "sok dara" (0).
  const rank = (n: string) => (/\p{Lu}/u.test(n) ? (/\p{Ll}/u.test(n) ? 2 : 1) : 0);
  let best = names[names.length - 1];
  for (let i = names.length - 2; i >= 0; i--) if (rank(names[i]) > rank(best)) best = names[i];
  return best.trim().replace(/\s+/g, ' ');
}

/**
 * One line per student. Students are matched by NAME (case and spacing
 * ignored): homework is mostly handed in without an account, so the name the
 * student typed is the only identity there is — "sok dara" and "Sok  Dara"
 * are one student, two different spellings are two lines.
 */
export function scoresByStudent(attempts: HomeworkAttempt[]): StudentScore[] {
  const groups = new Map<string, HomeworkAttempt[]>();
  for (const a of attempts) {
    const key = nameKey(a.studentName);
    const list = groups.get(key);
    if (list) list.push(a); else groups.set(key, [a]);
  }
  const out: StudentScore[] = [];
  for (const [key, list] of groups) {
    const score = scoreForAttempts(list);
    if (score) out.push({ ...score, key });
  }
  return sortScores(out, 'name');
}

/** One score line from one student's submissions (in any order). */
export function scoreForAttempts(list: HomeworkAttempt[]): StudentScore | null {
  if (list.length === 0) return null;
  // Oldest first; rows without a time keep their order at the front.
  const sorted = list.map((a, i) => ({ a, i })).sort((x, y) => (x.a.at - y.a.at) || (x.i - y.i)).map((x) => x.a);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const best = sorted.reduce((b, a) => (a.pct > b.pct || (a.pct === b.pct && a.correct > b.correct) ? a : b), first);
  // The first check of the EARLIEST submission that recorded one — a later
  // submission's "first check" is from a fresh visit, after the answers
  // were already seen.
  const measured = first.firstCorrect !== null;
  const firstCorrect = measured ? (first.firstCorrect as number) : first.correct;
  return {
    key: nameKey(first.studentName),
    name: bestSpelling(sorted.map((a) => a.studentName)),
    submissions: sorted.length,
    best: { correct: best.correct, total: best.total, pct: best.pct },
    firstTry: { correct: firstCorrect, total: first.total, pct: measured ? pctOf(firstCorrect, first.total) : first.pct },
    firstTryMeasured: measured,
    firstAnswered: measured ? first.firstAnswered : null,
    checks: first.checks,
    firstAt: first.at,
    lastAt: last.at,
    violations: sorted.reduce<number | null>(
      (mx, a) => (a.violations == null ? mx : mx === null ? a.violations : Math.max(mx, a.violations)),
      null,
    ),
  };
}

/**
 * What ONE student should see on their own homework row.
 *
 * Matching, strongest signal first:
 *   1. the signed-in uid (rows sent from an account carry `studentUid`),
 *   2. otherwise the name they are known by on this device.
 * A uid match wins outright — a student who typed "Dara 7A" on Monday and
 * "dara" on Friday is still one person to us, because the account is the
 * same. Without an account, the name is all there is (case/spacing ignored,
 * exactly like scoresByStudent groups the teacher's sheet).
 *
 * Returns null when this student has not handed in anything yet, so the card
 * can say "not submitted" instead of showing a zero.
 */
export function myHomeworkScore(
  attempts: HomeworkAttempt[],
  identity: { uid?: string | null; name?: string | null },
): StudentScore | null {
  const uid = (identity.uid || '').trim();
  // Rows are stored with displayStudentName applied (an email is never a
  // name), so the identity is normalized the same way before it is compared.
  const key = nameKey(displayStudentName(identity.name || ''));
  // 1. The account. Rows sent from it are this student's whatever name they
  //    typed, so they are pooled into ONE line (best score, every submission).
  const mine = uid ? attempts.filter((a) => a.studentUid === uid) : [];
  // 2. No account rows: fall back to the name, case and spacing ignored —
  //    but only rows that no OTHER account claimed, so signing in as one
  //    student never surfaces another account's private score.
  const byName = mine.length > 0
    ? mine
    : key ? attempts.filter((a) => !a.studentUid && nameKey(a.studentName) === key) : [];
  return scoreForAttempts(byName);
}

/** A short, non-judgemental label for a score — used on the student card. */
export function scoreBandLabel(pct: number): string {
  if (pct >= 90) return 'Excellent';
  if (pct >= 75) return 'Great work';
  if (pct >= 50) return 'Getting there';
  return 'Keep practising';
}

export type ScoreSort = 'name' | 'lowest' | 'newest';

export function sortScores(rows: StudentScore[], by: ScoreSort): StudentScore[] {
  const byName = (x: StudentScore, y: StudentScore) => x.name.localeCompare(y.name, undefined, { sensitivity: 'base' });
  const copy = [...rows];
  if (by === 'lowest') copy.sort((x, y) => (x.firstTry.pct - y.firstTry.pct) || (x.best.pct - y.best.pct) || byName(x, y));
  else if (by === 'newest') copy.sort((x, y) => (y.lastAt - x.lastAt) || byName(x, y));
  else copy.sort(byName);
  return copy;
}

export interface ScoreSummary {
  students: number;
  submissions: number;
  avgFirstTry: number;
  avgBest: number;
  /** Students whose first try was below 50%. */
  below50: number;
}

export function summarizeScores(rows: StudentScore[]): ScoreSummary {
  const n = rows.length;
  const avg = (pick: (r: StudentScore) => number) => (n ? Math.round(rows.reduce((s, r) => s + pick(r), 0) / n) : 0);
  return {
    students: n,
    submissions: rows.reduce((s, r) => s + r.submissions, 0),
    avgFirstTry: avg((r) => r.firstTry.pct),
    avgBest: avg((r) => r.best.pct),
    below50: rows.filter((r) => r.firstTry.pct < 50).length,
  };
}

/** Keep the attempts of one homework, optionally only those since `sinceMs`.
 *  `number: null` keeps the whole page (standalone assignment like the quiz). */
export function attemptsForHomework(all: HomeworkAttempt[], number: number | null, sinceMs = 0): HomeworkAttempt[] {
  return all.filter((a) => (number === null || a.homework === number) && (sinceMs <= 0 || a.at >= sinceMs));
}

/** "14 Nov, 10:32" — local time of the teacher's device. */
export function scoreWhen(at: number): string {
  if (!at) return '—';
  try {
    return new Date(at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return new Date(at).toISOString().slice(0, 16).replace('T', ' ');
  }
}

const csvCell = (v: string | number): string => {
  const s = csvSafeText(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Score sheet as CSV (opens in Excel / Google Sheets). */
export function scoresToCsv(title: string, rows: StudentScore[]): string {
  const iso = (at: number) => (at ? new Date(at).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '');
  const lines: Array<Array<string | number>> = [
    [title],
    ['Student', 'First try', 'First try %', 'First try measured', 'Answered at first check', 'Best score', 'Best %', 'Out of', 'Checks before first submit', 'Times submitted', 'First submitted', 'Last submitted'],
    ...rows.map((r) => [
      r.name,
      r.firstTry.correct, r.firstTry.pct,
      r.firstTryMeasured ? 'at first check' : 'first submission',
      r.firstAnswered ?? '',
      r.best.correct, r.best.pct, r.best.total,
      r.checks ?? '',
      r.submissions,
      iso(r.firstAt), iso(r.lastAt),
    ]),
  ];
  return lines.map((l) => l.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------
// Network — Firestore REST, public read (same access the ticker uses).
// ---------------------------------------------------------------------------

const FS_DOCS = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

/** Safety cap. A single-field equality filter needs no composite index, but
 *  it cannot be ordered by time without one — so a cap would cut an arbitrary
 *  part. The caller is told when the cap was reached. */
export const HOMEWORK_FETCH_CAP = 3000;

const slugFilter = (slug: string) => ({
  fieldFilter: { field: { fieldPath: 'drillSlug' }, op: 'EQUAL', value: { stringValue: slug } },
});

async function fsPost(path: ':runQuery' | ':runAggregationQuery', body: unknown): Promise<unknown> {
  const res = await fetch(`${FS_DOCS}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(data.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface HomeworkPageAttempts {
  /** Every homework row of the page (all three homeworks). */
  attempts: HomeworkAttempt[];
  /** True when the safety cap was reached — the list may be incomplete. */
  capped: boolean;
}

/** All submissions of one homework PAGE (its three homeworks together). */
export async function fetchHomeworkPageAttempts(slug: string): Promise<HomeworkPageAttempts> {
  const rows = (await fsPost(':runQuery', {
    structuredQuery: {
      from: [{ collectionId: 'drill_attempts' }],
      where: slugFilter(slug),
      limit: HOMEWORK_FETCH_CAP,
    },
  })) as Array<{ document?: FsDoc }>;
  const docs = (Array.isArray(rows) ? rows : []).filter((r): r is { document: FsDoc } => !!r?.document);
  return {
    attempts: docs.map((r) => parseHomeworkAttempt(r.document)).filter((a): a is HomeworkAttempt => a !== null),
    capped: docs.length >= HOMEWORK_FETCH_CAP,
  };
}

/**
 * The signed-in student's own score on ONE homework of `slug`.
 *
 * Reads the page's rows (public, same single-field query the ticker uses —
 * no composite index) and hands them to `myHomeworkScore`, so only this
 * student's line comes back. Resolves to `null` when they have not handed
 * anything in yet; rejects only if the network read fails, so the caller can
 * show "couldn't load" instead of "not submitted".
 */
export async function fetchMyHomeworkScore(
  slug: string,
  identity: { uid?: string | null; name?: string | null },
  number: number | null,
): Promise<StudentScore | null> {
  const { attempts } = await fetchHomeworkPageAttempts(slug);
  return myHomeworkScore(attemptsForHomework(attempts, number), identity);
}

/** How many rows the page has — one cheap read, used to notice new
 *  submissions without downloading the whole list again. */
export async function countHomeworkPageAttempts(slug: string): Promise<number> {
  const rows = (await fsPost(':runAggregationQuery', {
    structuredAggregationQuery: {
      structuredQuery: { from: [{ collectionId: 'drill_attempts' }], where: slugFilter(slug) },
      aggregations: [{ alias: 'count', count: {} }],
    },
  })) as Array<{ result?: { aggregateFields?: { count?: { integerValue?: string } } } }>;
  return Number(rows?.[0]?.result?.aggregateFields?.count?.integerValue ?? '0');
}
