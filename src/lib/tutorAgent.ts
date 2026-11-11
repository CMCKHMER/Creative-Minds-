// Tutor agent — the assessment workspace's record-keeping assistant brain.
//
// Owner request: "get the Ai function working like a tutor agent which
// handles keyed in stats and can maintain the records." The previous
// assistant could only ANSWER questions about the saved records; the tutor
// agent also WRITES: the teacher types stats in plain language and the agent
// parses them into concrete record operations that are applied through the
// exact same Firestore data layer the tables use (same masks, same audit
// stamps, same rules — nothing new server-side).
//
//   "Dara listening 4 speaking 3 quiz 2 85"      → scores into the record
//   "hw 80 85 90 70 100 for Bora"                → homework days 1–5
//   "add student Sreyleap"                       → roster row
//   "note for Dara: much better participation"   → teacher feedback field
//   "clear the week for Bora"                    → delete that week entry
//
// Deliberately deterministic and on-device: no model calls, no network, no
// keys, and no student data leaves the browser. Parsing is pure so the
// vitest suite can pin every rule.

import type { AssessmentStudentDoc } from './assessmentDb';
import { formatWeekLabel } from './assessmentDb';

export type TutorIntent =
  | { kind: 'add-student'; name: string }
  | { kind: 'record-scores'; studentId: string; studentName: string; fields: Record<string, number>; target: 'week' | 'initial' }
  | { kind: 'set-note'; studentId: string; studentName: string; text: string }
  | { kind: 'clear-week'; studentId: string; studentName: string; weekKey: string };

export interface TutorParseResult {
  intents: TutorIntent[];
  /** Human summary shown on the confirmation card ("nothing applied yet"). */
  summary: string[];
  /** Non-empty when the command was understood as a record operation but is
   *  missing something (no such student, nothing to record…). */
  problem: string | null;
}

export interface TutorParseCtx {
  students: AssessmentStudentDoc[];
  /** The workspace's selected assessment week — null = Initial record. */
  weekKey: string | null;
}

export const TUTOR_HELP = [
  'I keep your records — type stats in plain language and I file them:',
  '• "Dara listening 4 speaking 3" — 0–5 skills',
  '• "comprehension 4 vocab 3 speed 2 accuracy 5" — reading skills',
  '• "pbl presentation 85 focus 90" — 0–100 criteria',
  '• "quiz 1 85" · "term 2 quiz 3 70" — quizzes (0–100)',
  '• "hw 80 85 90 70 100" or "hw day2 90" — homework days',
  '• "part 70 80" — participation days',
  '• "add student Sreyleap" — new roster row',
  '• "note for Dara: much better participation" — teacher feedback',
  '• "clear the week for Bora" — delete that week\'s entry',
  'Scores go to the selected week (or say "initial" for the original record).',
  'Everything else — "who is falling?", a student\'s name — I answer from the saved history.',
].join('\n');

// ── Field aliases (order matters: longest/most specific first) ───────

interface FieldRule {
  re: RegExp;
  field: string;
  max: number;
  label: string;
}

const FIELD_RULES: FieldRule[] = [
  // Quizzes — "term 2 quiz 3" handled before plain "quiz 3" (rules run in
  // order and a match RESERVES its span, so later rules can't double-book it)
  { re: /\bterm\s*([12])\s*quiz\s*(?:q\s*)?([1-5])\b/i, field: 'quizT$1Q$2', max: 100, label: 'Term $1 quiz $2' },
  { re: /\bquiz\s*t([12])\s*q?\s*([1-5])\b/i, field: 'quizT$1Q$2', max: 100, label: 'Term $1 quiz $2' },
  { re: /\bquiz\s*(?:q\s*)?([1-5])\b/i, field: 'quizT1Q$1', max: 100, label: 'Term 1 quiz $1' },
  // Reading skills (0–5)
  { re: /\b(?:comprehension|understanding)\b/i, field: 'comprehension', max: 5, label: 'Comprehension' },
  { re: /\b(?:vocab(?:ulary)?)\b/i, field: 'vocabulary', max: 5, label: 'Vocabulary' },
  { re: /\b(?:read(?:ing)?\s*speed|speed)\b/i, field: 'readingSpeed', max: 5, label: 'Reading speed' },
  { re: /\baccuracy\b/i, field: 'accuracy', max: 5, label: 'Accuracy' },
  // Listening & speaking skills (0–5)
  { re: /\blisten(?:ing)?\b/i, field: 'listening', max: 5, label: 'Listening' },
  { re: /\bspeak(?:ing)?\b/i, field: 'speaking', max: 5, label: 'Speaking' },
  { re: /\bpronunciation\b/i, field: 'pronunciation', max: 5, label: 'Pronunciation' },
  { re: /\bfluency\b/i, field: 'fluency', max: 5, label: 'Fluency' },
  // PBL criteria (0–100)
  { re: /\b(?:pbl\s*subject|subject)\b/i, field: 'pblSubject', max: 100, label: 'PBL subject knowledge' },
  { re: /\b(?:pbl\s*presentation|presentation)\b/i, field: 'pblPresentation', max: 100, label: 'PBL presentation' },
  { re: /\b(?:pbl\s*language|language\s*use)\b/i, field: 'pblLanguage', max: 100, label: 'PBL language use' },
  { re: /\bfocus(?:\s*points)?\b/i, field: 'pblFocusPoints', max: 100, label: 'PBL focus points' },
  // Homework / participation days (0–100)
  { re: /\b(?:hw|homework)\s*day\s*([1-5])\b/i, field: 'hwDay$1', max: 100, label: 'Homework day $1' },
  { re: /\b(?:part|participation)\s*day\s*([1-5])\b/i, field: 'partDay$1', max: 100, label: 'Participation day $1' },
];

/** `field`/`label` templates may carry $1/$2 capture groups — expand them. */
function expandRule(rule: FieldRule, match: RegExpMatchArray): { field: string; label: string; max: number } {
  return {
    field: rule.field.replace(/\$(\d)/g, (_, g) => match[Number(g)] ?? ''),
    label: rule.label.replace(/\$(\d)/g, (_, g) => match[Number(g)] ?? ''),
    max: rule.max,
  };
}

const clamp = (n: number, max: number): number => Math.min(Math.max(Math.round(n), 0), max);

// ── Student resolution ───────────────────────────────────────────────

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Word-boundary name match (a two-letter name like "Ly" must never match
 *  inside "falling" — the old substring test allowed that). */
export function findStudentByMention(text: string, students: AssessmentStudentDoc[]): AssessmentStudentDoc | null {
  for (const s of students) {
    const name = (s.name || '').trim();
    if (name.length > 1 && new RegExp(`(^|[^\\p{L}])${escapeRe(name)}([^\\p{L}]|$)`, 'iu').test(text)) return s;
  }
  return null;
}

const titleCase = (s: string): string =>
  s.trim().split(/\s+/).map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');

// ── Parser ───────────────────────────────────────────────────────────

export function parseTutorCommand(raw: string, ctx: TutorParseCtx): TutorParseResult {
  const input = raw.trim();
  if (!input) return { intents: [], summary: [], problem: null };

  // 1. help
  if (/^(help|what can you (do|record)|how (do|to) (i )?record)/i.test(input)) {
    return { intents: [], summary: [], problem: TUTOR_HELP };
  }

  // 2. add student
  const addM = input.match(/^add\s+(?:a\s+|new\s+)?student\s+(?:named\s+)?([A-Za-z][A-Za-z\s'.-]{0,49})$/i);
  if (addM) {
    const name = titleCase(addM[1]);
    return {
      intents: [{ kind: 'add-student', name }],
      summary: [`Add **${name}** to the roster (empty record, ready to score).`],
      problem: null,
    };
  }

  // 3. note for <student>: <text>  (also "feedback for X: …")
  const noteM = input.match(/^(?:note|feedback)\s+(?:for|on)\s+(.+?)\s*[:,]\s*(.+)$/i);
  if (noteM) {
    const student = findStudentByMention(noteM[1], ctx.students);
    if (!student) {
      return { intents: [], summary: [], problem: `I couldn't find "${noteM[1].trim()}" on this roster — add the student first, then leave the note.` };
    }
    const text = noteM[2].trim().slice(0, 400);
    return {
      intents: [{ kind: 'set-note', studentId: student.id, studentName: student.name, text }],
      summary: [`Save teacher feedback for **${student.name}**: "${text}"`],
      problem: null,
    };
  }

  // 4. clear week (for <student>?)
  const clearM = input.match(/^(?:clear|delete|remove)\s+(?:the\s+)?week(?:\s+(?:entry|scores|data))?(?:\s+(?:for|of|from)\s+(.+))?$/i);
  if (clearM) {
    if (!ctx.weekKey) {
      return { intents: [], summary: [], problem: 'No week is selected — pick a week above, then ask me to clear it.' };
    }
    const mention = (clearM[1] ?? '').trim();
    if (mention) {
      const student = findStudentByMention(mention, ctx.students);
      if (!student) return { intents: [], summary: [], problem: `I couldn't find "${mention}" on this roster.` };
      return {
        intents: [{ kind: 'clear-week', studentId: student.id, studentName: student.name, weekKey: ctx.weekKey }],
        summary: [`Delete **${student.name}**'s entry for ${formatWeekLabel(ctx.weekKey)} (other weeks and the initial record stay).`],
        problem: null,
      };
    }
    return { intents: [], summary: [], problem: 'Tell me whose week to clear — e.g. "clear the week for Bora".' };
  }

  // 5. score recording — resolve the student first
  const target: 'week' | 'initial' = /\b(initial|original)\b/i.test(input) ? 'initial' : (ctx.weekKey ? 'week' : 'initial');
  const student = findStudentByMention(input, ctx.students);

  const fields: Record<string, number> = {};
  const labels: string[] = [];

  // Explicit alias+number pairs, most specific first. Each accepted match
  // RESERVES its text span so a later, looser rule can never double-book
  // the same words ("term 2 quiz 3 70" must not ALSO file Term 1 quiz 3).
  const taken: Array<[number, number]> = [];
  const overlaps = (a: number, b: number): boolean => taken.some(([s, e]) => a < e && b > s);
  for (const rule of FIELD_RULES) {
    const re = new RegExp(rule.re.source + '\\s*(?:is|=|:|score\\s*)?\\s*(\\d{1,3})', 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(input))) {
      const start = m.index;
      const end = start + m[0].length;
      if (overlaps(start, end)) continue;
      const { field, label, max } = expandRule(rule, m);
      const value = clamp(parseInt(m[m.length - 1], 10), max);
      if (fields[field] === undefined) {
        fields[field] = value;
        labels.push(`${label} ${value}${max === 5 ? '/5' : ''}`);
        taken.push([start, end]);
      }
    }
  }

  // Sequential daily entry: "hw 80 85 90 70 100" / "part 70 80" — fills the
  // days in order, but only for areas without an explicit day number above.
  for (const [areaRe, prefix] of [
    [/\b(?:hw|homework)\b((?:\s*(?:is|=|:)?\s*\d{1,3})+)/i, 'hwDay'],
    [/\b(?:part|participation)\b((?:\s*(?:is|=|:)?\s*\d{1,3})+)/i, 'partDay'],
  ] as Array<[RegExp, string]>) {
    const m = input.match(areaRe);
    if (!m) continue;
    const nums = (m[1].match(/\d{1,3}/g) ?? []).map((n) => clamp(parseInt(n, 10), 100));
    const hasExplicitDay = Object.keys(fields).some((f) => f.startsWith(prefix));
    if (!hasExplicitDay && nums.length) {
      nums.slice(0, 5).forEach((n, i) => {
        const field = `${prefix}${i + 1}`;
        if (fields[field] === undefined) {
          fields[field] = n;
          labels.push(`${prefix === 'hwDay' ? 'Homework' : 'Participation'} day ${i + 1} ${n}`);
        }
      });
    }
  }

  if (!student && Object.keys(fields).length > 0) {
    return { intents: [], summary: [], problem: 'I see scores but no student name — tell me who they belong to, e.g. "Dara listening 4".' };
  }
  if (student && Object.keys(fields).length === 0) {
    // A student was mentioned but nothing recordable — treat as a question
    // about that student (the insight Q&A knows them).
    return { intents: [], summary: [], problem: null };
  }
  if (student && Object.keys(fields).length > 0) {
    const dest = target === 'week' && ctx.weekKey
      ? formatWeekLabel(ctx.weekKey)
      : 'the Initial record';
    return {
      intents: [{ kind: 'record-scores', studentId: student.id, studentName: student.name, fields, target }],
      summary: [`Record for **${student.name}** → ${dest}:`, ...labels.map((l) => `• ${l}`)],
      problem: null,
    };
  }

  // 6. everything else — the insight Q&A owns it
  return { intents: [], summary: [], problem: null };
}
