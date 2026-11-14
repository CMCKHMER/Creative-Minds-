// Assessment audit — the tutor agent's "look for missed input" brain.
//
// Owner request: "Ai needs to be working looking for missed input and
// assessment feedback." Two deterministic, on-device scans over the loaded
// class records — no model calls, no network, nothing leaves the browser:
//
//   auditMissedInputs(students, weekKey)
//     → which students are missing inputs for the selected week (no entry at
//       all, or whole areas the rest of the class already recorded), plus
//       students whose original (pre-weekly) record was never filled in.
//       "Expected" is DERIVED FROM THE CLASS'S OWN RECORDING PATTERN for that
//       week — the agent never assumes a fixed template, so teachers who only
//       record homework + participation are not flagged for skipping PBL.
//
//   buildAssessmentFeedback(students, weekKey)
//     → one grounded feedback line per student: the recorded trend (from the
//       same series the insights tab uses) plus the selected week's
//       strongest/weakest area, ready to read out or save as a note.

import type { AssessmentStudentDoc, AssessmentWeekEntry } from './assessmentDb';
import { formatWeekLabel } from './assessmentDb';
import { areaScores, emptyStudentScores, type AreaScores } from './assessmentScoring';
import { buildSeries } from './insightEngine';

// ── Area vocabulary ──────────────────────────────────────────────────

/** The six score areas in the records, their member fields and labels. */
export const AUDIT_AREAS: Array<{ area: keyof AreaScores; label: string; fields: string[] }> = [
  { area: 'listening', label: 'Listening & speaking', fields: ['listening', 'speaking', 'pronunciation', 'fluency'] },
  { area: 'reading', label: 'Reading', fields: ['comprehension', 'vocabulary', 'readingSpeed', 'accuracy'] },
  { area: 'pbl', label: 'PBL project', fields: ['pblSubject', 'pblPresentation', 'pblLanguage', 'pblFocusPoints'] },
  { area: 'quiz', label: 'Quizzes', fields: ['quizT1Q1', 'quizT1Q2', 'quizT1Q3', 'quizT1Q4', 'quizT1Q5', 'quizT2Q1', 'quizT2Q2', 'quizT2Q3', 'quizT2Q4', 'quizT2Q5'] },
  { area: 'homework', label: 'Homework', fields: ['hwDay1', 'hwDay2', 'hwDay3', 'hwDay4', 'hwDay5'] },
  { area: 'participation', label: 'Participation', fields: ['partDay1', 'partDay2', 'partDay3', 'partDay4', 'partDay5'] },
];

const notesOnly = (entry: Record<string, unknown>): boolean =>
  Object.entries(entry).every(([k, v]) => k.endsWith('Notes') || !(Number(v) > 0));

/** Fields with a recorded (>0) value on one entry. */
function recordedFields(entry: AssessmentWeekEntry | Record<string, unknown>): Set<string> {
  const out = new Set<string>();
  for (const [k, v] of Object.entries(entry)) {
    if (!k.endsWith('Notes') && Number(v) > 0) out.add(k);
  }
  return out;
}

/** Areas with at least one recorded value on one entry. */
function recordedAreas(entry: AssessmentWeekEntry | Record<string, unknown>): Set<keyof AreaScores> {
  const fields = recordedFields(entry);
  const out = new Set<keyof AreaScores>();
  for (const a of AUDIT_AREAS) {
    if (a.fields.some((f) => fields.has(f))) out.add(a.area);
  }
  return out;
}

// ── Missed inputs ────────────────────────────────────────────────────

export type MissedInputKind = 'no-entry' | 'partial-entry' | 'missing-initial';

export interface MissedInput {
  studentId: string;
  studentName: string;
  kind: MissedInputKind;
  /** Areas the class recorded this week but this student did not. */
  missingAreas: string[];
  /** One human sentence the UI can show directly. */
  detail: string;
}

export interface MissedInputReport {
  /** Findings for the selected week (no-entry + partial-entry). */
  week: MissedInput[];
  /** Students whose original record has no scores at all. */
  initial: MissedInput[];
  /** True when nobody has any score for the selected week yet. */
  emptyWeek: boolean;
  /** True when the class has SOME recorded data to compare against — a
   *  brand-new empty class stays quiet instead of flagging everyone. */
  started: boolean;
  /** Human summary the AI thread opens with. */
  headline: string;
}

const hasAnyData = (students: AssessmentStudentDoc[]): boolean =>
  students.some((s) =>
    areaScores(s).overall > 0 ||
    Object.values(s.weeks ?? {}).some((e) => e && Object.keys(e).length > 0 && !notesOnly(e as Record<string, unknown>)));

export function auditMissedInputs(
  students: AssessmentStudentDoc[],
  weekKey: string | null,
): MissedInputReport {
  const nameOf = (s: AssessmentStudentDoc) => s.name || 'Unnamed student';
  const week: MissedInput[] = [];
  const initial: MissedInput[] = [];
  const started = hasAnyData(students);
  let emptyWeek = false;

  if (!started) {
    return {
      week: [], initial: [], emptyWeek: !weekKey ? false : true, started: false,
      headline: 'Nobody has recorded anything yet — key the first scores and I will start looking for missed inputs.',
    };
  }

  if (weekKey) {
    const entries = students
      .map((s) => ({ s, entry: (s.weeks ?? {})[weekKey] }))
      .filter(({ entry }) => entry && Object.keys(entry).length > 0);
    emptyWeek = entries.length === 0;

    // The class's own recording pattern this week: every area any classmate
    // recorded defines what a complete entry looks like.
    const expected = new Set<keyof AreaScores>();
    for (const { entry } of entries) {
      if (notesOnly(entry as Record<string, unknown>)) continue;
      for (const a of recordedAreas(entry)) expected.add(a);
    }

    for (const { s, entry } of entries) {
      if (notesOnly(entry as Record<string, unknown>)) {
        week.push({
          studentId: s.id, studentName: nameOf(s), kind: 'no-entry', missingAreas: [],
          detail: `${nameOf(s)} — only notes, no scores for ${formatWeekLabel(weekKey)}.`,
        });
        continue;
      }
      const got = recordedAreas(entry);
      const missing = AUDIT_AREAS.filter((a) => expected.has(a.area) && !got.has(a.area));
      if (missing.length > 0) {
        week.push({
          studentId: s.id, studentName: nameOf(s), kind: 'partial-entry',
          missingAreas: missing.map((a) => a.label),
          detail: `${nameOf(s)} — missing ${missing.map((a) => a.label).join(', ')} for ${formatWeekLabel(weekKey)} (the rest of the class has them).`,
        });
      }
    }
    for (const s of students) {
      const entry = (s.weeks ?? {})[weekKey];
      if (!entry || Object.keys(entry).length === 0 || notesOnly(entry as Record<string, unknown>)) {
        if (!week.some((f) => f.studentId === s.id)) {
          week.push({
            studentId: s.id, studentName: nameOf(s), kind: 'no-entry', missingAreas: [],
            detail: emptyWeek
              ? `${nameOf(s)} — no entry for ${formatWeekLabel(weekKey)} yet (nobody has recorded this week so far).`
              : `${nameOf(s)} — no entry at all for ${formatWeekLabel(weekKey)}.`,
          });
        }
      }
    }
  }

  // Original record never filled in (only meaningful when someone HAS one).
  const withInitial = students.filter((s) => areaScores(s).overall > 0);
  if (withInitial.length > 0) {
    for (const s of students) {
      if (areaScores(s).overall <= 0) {
        const weekEntryExists = Object.values(s.weeks ?? {}).some((e) => e && Object.keys(e).length > 0 && !notesOnly(e as Record<string, unknown>));
        if (!weekEntryExists) {
          initial.push({
            studentId: s.id, studentName: nameOf(s), kind: 'missing-initial', missingAreas: [],
            detail: `${nameOf(s)} — the original record has no scores anywhere (no weeks recorded either).`,
          });
        }
      }
    }
  }

  const total = week.length + initial.length;
  const headline = total === 0
    ? weekKey
      ? `No missed inputs — every student has the areas the class recorded for ${formatWeekLabel(weekKey)}.`
      : 'No missed inputs on this roster.'
    : `${total} missed input${total === 1 ? '' : 's'} found${weekKey ? ` for ${formatWeekLabel(weekKey)}` : ''}.`;
  return { week, initial, emptyWeek, started, headline };
}

// ── Assessment feedback ──────────────────────────────────────────────

export interface FeedbackLine {
  studentId: string;
  studentName: string;
  /** 1–2 grounded sentences: trend + this week's strongest/weakest area. */
  text: string;
}

const TREND_TEXT: Record<string, string> = {
  rising: 'improving week over week',
  falling: 'slipping week over week',
  steady: 'holding steady',
  'needs-data': 'not enough recorded history for a trend yet',
};

export function buildAssessmentFeedback(
  students: AssessmentStudentDoc[],
  weekKey: string | null,
): FeedbackLine[] {
  const lines: FeedbackLine[] = [];
  for (const s of students) {
    const name = s.name || 'Unnamed student';
    const series = buildSeries(s);
    const parts: string[] = [];

    if (series.length >= 2) {
      const delta = series[series.length - 1].overall - series[series.length - 2].overall;
      const lastDelta = series[series.length - 1].overall - series[0].overall;
      const trend = TREND_TEXT[delta >= 2 ? 'rising' : delta <= -2 ? 'falling' : 'steady'] ?? TREND_TEXT.steady;
      parts.push(`${name}: ${series[series.length - 1].overall}% overall (${delta >= 0 ? '+' : ''}${delta} vs the previous record, ${lastDelta >= 0 ? '+' : ''}${lastDelta} since the first) — ${trend}.`);
    } else if (series.length === 1) {
      parts.push(`${name}: ${series[0].overall}% overall — ${TREND_TEXT['needs-data']}.`);
    } else {
      parts.push(`${name}: no scores recorded yet.`);
    }

    const entry = weekKey ? (s.weeks ?? {})[weekKey] : undefined;
    if (series.length === 0) {
      // No scores anywhere — the week line would be redundant noise.
      lines.push({ studentId: s.id, studentName: name, text: `${name}: no scores recorded yet.` });
      continue;
    }
    if (entry && Object.keys(entry).length > 0 && !notesOnly(entry as Record<string, unknown>)) {
      const areas = areaScores({ ...emptyStudentScores(), ...(entry as Record<string, unknown>) } as AssessmentStudentDoc);
      const rated = (['listening', 'reading', 'pbl', 'quiz', 'homework', 'participation'] as Array<keyof AreaScores>)
        .map((a) => ({ a, v: areas[a] }))
        .filter((x) => x.v > 0)
        .sort((x, y) => y.v - x.v);
      if (rated.length > 0) {
        const best = rated[0];
        const worst = rated[rated.length - 1];
        const labelOf = (a: keyof AreaScores) => AUDIT_AREAS.find((x) => x.area === a)?.label ?? a;
        parts.push(worst.a === best.a
          ? `This week only ${labelOf(best.a)} was assessed (${best.v}%).`
          : `This week: strongest ${labelOf(best.a)} (${best.v}%), weakest ${labelOf(worst.a)} (${worst.v}%).`);
      }
    } else if (weekKey) {
      parts.push(`No scores for ${formatWeekLabel(weekKey)} yet.`);
    }
    lines.push({ studentId: s.id, studentName: name, text: parts.join(' ') });
  }
  return lines;
}
