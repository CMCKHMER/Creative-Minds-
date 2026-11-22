'use strict';

// Creative Minds Cambodia — Kid 11 daily homework archive (pure logic).
//
// Used in two places:
//   1. functions/index.js — the scheduled exportHomeworkSheets Cloud Function
//      (Blaze plan), which builds one ready-made score sheet per homework per
//      day and stores it in Firestore at homework_exports/<slug>__hw<n>.
//   2. src/tests/homeworkExport.test.ts — unit tests that pin the PARITY
//      CONTRACT with the teacher's live score sheet (src/lib/kidHomework.ts:
//      parseHomeworkAttempt / scoresByStudent / scoresToCsv). A teacher must
//      see the same names, first-try scores and columns in the archived CSV
//      as in the sheet on screen; if the client's grouping rules change, this
//      module and its test move together.
//
// WHY AN ARCHIVE AT ALL
//   The live sheet re-reads the whole drill_attempts page list every time a
//   teacher opens it (and again whenever the row count changes). That is the
//   right shape for "who handed in just now", but it is a poor record: the
//   list is capped, it costs a full read per view, and nothing survives a
//   term-end cleanup of drill_attempts. The function pays that read ONCE per
//   homework page per day (6 queries/day at the school's volume) and stores a
//   small CSV string that a teacher downloads instantly.
//
// COST
//   288-ish reads/day and 18 small writes/day — under 1% of the Firestore free
//   tier that still applies on Blaze. No Storage, no egress, one more
//   Cloud Scheduler job (the first three are free). maxInstances: 1 in
//   index.js, so a stuck run cannot fan out.

const DAY_MS = 24 * 60 * 60 * 1000;

/** The six Grade-11 online-homework pages (Kids 11 → Reading Future Create 3). */
const KID11_HOMEWORK_SLUGS = [
  'unit2hw.html',
  'unit3hw.html',
  'unit4hw.html',
  'unit13hw.html',
  'unit15hw.html',
  'doctor-fish.html',
];

/** Fallback titles when a homework has no submissions yet (no row to copy
 *  the title from). Keep in sync with HW_LABELS in the six pages. */
const HOMEWORK_TITLES = {
  'unit2hw.html': ['Unit 2 · Leonardo da Vinci', 'Museum Docent', 'Timeline Curator', 'Exhibition Critic'],
  'unit3hw.html': ['Unit 3 · Pocahontas', 'The Archive Record', 'Timeline Historian', 'Museum Interpreter'],
  'unit4hw.html': ['Unit 4 · Walt Disney', 'The Storyboard Desk', 'Timeline Producer', 'Legacy Writer'],
  'unit13hw.html': ['Unit 13 · New Homes for Animals', 'Field Notebook', 'Relocation Mission', 'Campaign Studio'],
  'unit15hw.html': ['Unit 15 · DNA Bank', 'Lab Induction', 'Chain-Reaction Analyst', 'Conservation Campaigner'],
  'doctor-fish.html': ['Unit 14 · Doctor Fish', 'Spa Intake File', 'Treatment Analyst', 'Health Writer'],
};

const EMAIL_LIKE_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLAIN_NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?%?$/i;

/** Same rule as src/lib/studentName.ts — an email is NEVER a display name. */
function looksLikeEmail(value) {
  if (!value) return false;
  return EMAIL_LIKE_RE.test(String(value).trim());
}

function friendlyNameFromEmail(email) {
  const local = String(email || '').split('@')[0].trim();
  if (!local) return '';
  const words = local.split(/[._+-]+/).map((w) => w.trim()).filter(Boolean);
  if (words.length === 0) return local.slice(0, 40);
  return words
    .map((w) => (w.charAt(0).toUpperCase() + w.slice(1)).slice(0, 40))
    .join(' ')
    .trim()
    .slice(0, 40);
}

function displayStudentName(name) {
  const s = String(name == null ? '' : name).trim();
  if (!s) return '';
  if (looksLikeEmail(s)) return friendlyNameFromEmail(s) || s;
  return s;
}

/** '… — Homework 2 · Relocation Mission' → 2. null when the title has none. */
function homeworkNumberFromTitle(title) {
  const m = /\bHomework\s*(\d+)\b/i.exec(String(title || ''));
  return m ? Number(m[1]) : null;
}

/** Spreadsheet formula guard — same as src/lib/csvSafe.ts. */
function csvSafeText(value) {
  const s = String(value == null ? '' : value);
  if (!/^[=+\-@\t\r]/.test(s)) return s;
  if (PLAIN_NUMBER.test(s)) return s;
  return `'${s}`;
}

function csvCell(value) {
  const s = csvSafeText(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Firestore value (integer/double) → rounded number, or null. */
function intOf(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** submittedAt as written by the pages (ISO string) or by the Admin SDK
 *  (Timestamp/Date/number) → epoch ms. 0 when unusable, like the client. */
function timeOf(value) {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value) {
    const t = Date.parse(value);
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
}

const pctOf = (correct, total) => (total > 0 ? Math.round((correct / total) * 100) : 0);

/**
 * One drill_attempts document (Admin SDK `data()` shape) → attempt row.
 * Mirrors parseHomeworkAttempt in src/lib/kidHomework.ts exactly.
 * Returns null for anything that is not a Kid 11 (rfc3) row.
 */
function parseHomeworkRow(data) {
  if (!data || typeof data !== 'object') return null;
  if (String(data.drillSource || '') !== 'rfc3') return null;
  const total = Math.max(0, intOf(data.totalCount) || 0);
  const correct = Math.min(Math.max(0, intOf(data.correctCount) || 0), total || Number.MAX_SAFE_INTEGER);
  const first = intOf(data.firstCorrectCount);
  const checks = intOf(data.checkCount);
  const answered = intOf(data.firstAnsweredCount);
  return {
    studentName: displayStudentName(data.studentName) || 'No name',
    signedIn: !!String(data.studentUid || '').trim(),
    homework: homeworkNumberFromTitle(data.drillTitle),
    title: typeof data.drillTitle === 'string' ? data.drillTitle : '',
    correct,
    total,
    pct: intOf(data.scorePct) == null ? pctOf(correct, total) : intOf(data.scorePct),
    at: timeOf(data.submittedAt),
    firstCorrect: first !== null && first >= 0 && (total === 0 || first <= total) ? first : null,
    firstAnswered:
      first !== null && answered !== null && answered >= 0
        ? Math.min(answered, total || answered)
        : null,
    checks: checks !== null && checks >= 1 ? checks : null,
    studentUid: String(data.studentUid || '').trim(),
  };
}

const nameKey = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');

function bestSpelling(names) {
  const rank = (n) => (/[A-Z]/.test(n) ? (/[a-z]/.test(n) ? 2 : 1) : 0);
  let best = names[names.length - 1];
  for (let i = names.length - 2; i >= 0; i--) if (rank(names[i]) > rank(best)) best = names[i];
  return best.trim().replace(/\s+/g, ' ');
}

/** One score line from one student's submissions — mirrors scoreForAttempts. */
function scoreForAttempts(list) {
  if (!list || list.length === 0) return null;
  const sorted = list
    .map((a, i) => ({ a, i }))
    .sort((x, y) => x.a.at - y.a.at || x.i - y.i)
    .map((x) => x.a);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const best = sorted.reduce(
    (b, a) => (a.pct > b.pct || (a.pct === b.pct && a.correct > b.correct) ? a : b),
    first,
  );
  const measured = first.firstCorrect !== null;
  const firstCorrect = measured ? first.firstCorrect : first.correct;
  return {
    key: nameKey(first.studentName),
    name: bestSpelling(sorted.map((a) => a.studentName)),
    submissions: sorted.length,
    best: { correct: best.correct, total: best.total, pct: best.pct },
    firstTry: {
      correct: firstCorrect,
      total: first.total,
      pct: measured ? pctOf(firstCorrect, first.total) : first.pct,
    },
    firstTryMeasured: measured,
    firstAnswered: measured ? first.firstAnswered : null,
    checks: first.checks,
    firstAt: first.at,
    lastAt: last.at,
  };
}

/** One line per student, sorted by name — mirrors scoresByStudent(). */
function scoresByStudent(attempts) {
  const groups = new Map();
  for (const a of attempts) {
    const key = nameKey(a.studentName);
    const list = groups.get(key);
    if (list) list.push(a);
    else groups.set(key, [a]);
  }
  const out = [];
  for (const [key, list] of groups) {
    const score = scoreForAttempts(list);
    if (score) out.push({ ...score, key });
  }
  return out.sort((x, y) => x.name.localeCompare(y.name, undefined, { sensitivity: 'base' }));
}

/** Score sheet as CSV — same rows/columns as scoresToCsv() on the client. */
function scoresToCsv(title, rows) {
  const iso = (at) => (at ? `${new Date(at).toISOString().slice(0, 16).replace('T', ' ')} UTC` : '');
  const lines = [
    [title],
    [
      'Student', 'First try', 'First try %', 'First try measured', 'Answered at first check',
      'Best score', 'Best %', 'Out of', 'Checks before first submit', 'Times submitted',
      'First submitted', 'Last submitted',
    ],
    ...rows.map((r) => [
      r.name,
      r.firstTry.correct, r.firstTry.pct,
      r.firstTryMeasured ? 'at first check' : 'first submission',
      r.firstAnswered == null ? '' : r.firstAnswered,
      r.best.correct, r.best.pct, r.best.total,
      r.checks == null ? '' : r.checks,
      r.submissions,
      iso(r.firstAt), iso(r.lastAt),
    ]),
  ];
  return `${lines.map((l) => l.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

/** 'unit13hw.html', 2 → 'unit13hw__hw2' (Firestore-safe doc id). */
function exportDocId(slug, homework) {
  const base = String(slug || '').replace(/\.html$/i, '').replace(/[^a-z0-9_-]+/gi, '-');
  return `${base}__hw${homework}`;
}

/**
 * Build the three day's archive documents for ONE homework page.
 *
 * @param {{slug: string, rows: Array<object>, now: number,
 *          maxCsvChars?: number}} input
 *        `rows` are parseHomeworkRow() results for the whole page.
 * @returns {Array<{docId: string, fields: object}>} always three documents
 *        (homeworks 1–3), so the teacher's sheet can tell "nothing handed in"
 *        apart from "archive not generated yet".
 */
function buildHomeworkExports({ slug, rows, now, maxCsvChars = 400_000 }) {
  const stamp = new Date(now);
  const out = [];
  for (const number of [1, 2, 3]) {
    const mine = (rows || []).filter((r) => r.homework === number);
    const scored = scoresByStudent(mine);
    const withTitle = mine.find((r) => r.title);
    const fallback = HOMEWORK_TITLES[slug];
    const title = withTitle
      ? withTitle.title
      : fallback
        ? `${fallback[0]} — Homework ${number} · ${fallback[number] || ''}`.trim()
        : `${slug} · Homework ${number}`;

    // A runaway page must never produce a 1 MiB document: keep the newest
    // students (the sheet sorts by name, so drop from the end) and record how
    // many were left out.
    let csv = '';
    let omitted = 0;
    if (scored.length) {
      csv = scoresToCsv(title, scored);
      while (csv.length > maxCsvChars && scored.length > 1) {
        omitted += 1;
        scored.pop();
        csv = scoresToCsv(title, scored);
      }
      if (csv.length > maxCsvChars) {
        // A single row that is still over the cap (impossible in practice).
        omitted += scored.length;
        scored.length = 0;
        csv = '';
      }
    }

    out.push({
      docId: exportDocId(slug, number),
      fields: {
        slug,
        homework: number,
        title,
        generatedAt: stamp,
        students: scored.length,
        submissions: mine.length,
        rowCount: scored.length,
        omitted,
        csv,
      },
    });
  }
  return out;
}

module.exports = {
  DAY_MS,
  KID11_HOMEWORK_SLUGS,
  HOMEWORK_TITLES,
  displayStudentName,
  friendlyNameFromEmail,
  looksLikeEmail,
  homeworkNumberFromTitle,
  csvSafeText,
  csvCell,
  parseHomeworkRow,
  scoresByStudent,
  scoreForAttempts,
  scoresToCsv,
  exportDocId,
  buildHomeworkExports,
};
