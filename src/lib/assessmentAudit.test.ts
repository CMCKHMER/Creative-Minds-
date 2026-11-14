// Pins for the assessment audit — the tutor agent's "look for missed input"
// brain (owner: "Ai needs to be working looking for missed input and
// assessment feedback"). Pure functions: no Firestore, no clock.
import { describe, expect, it } from 'vitest';
import { auditMissedInputs, buildAssessmentFeedback } from './assessmentAudit';
import { newStudentRow, weekKeyOf } from './assessmentDb';
import type { AssessmentStudentDoc } from './assessmentDb';

// Mon 9 Nov 2026 — the week containing "today" in these tests.
const WEEK = '2026-11-09';

function student(name: string, weeks: Record<string, Record<string, number | string>> = {}, flat: Record<string, number | string> = {}): AssessmentStudentDoc {
  return {
    ...newStudentRow(),
    ...flat,
    id: `s-${name.toLowerCase()}`,
    name,
    weeks: Object.fromEntries(Object.entries(weeks).map(([k, v]) => [k, { ...v }])),
  } as unknown as AssessmentStudentDoc;
}

describe('auditMissedInputs', () => {
  it('flags a student with no entry while classmates have one', () => {
    const dara = student('Dara', { [WEEK]: { listening: 4, speaking: 3 } });
    const bora = student('Bora');
    const report = auditMissedInputs([dara, bora], WEEK);
    expect(report.emptyWeek).toBe(false);
    const boraFinding = report.week.find((f) => f.studentName === 'Bora');
    expect(boraFinding?.kind).toBe('no-entry');
    expect(boraFinding?.detail).toContain('no entry at all');
    // Dara is complete (the class pattern = what she recorded).
    expect(report.week.find((f) => f.studentName === 'Dara')).toBeUndefined();
    expect(report.headline).toContain('1 missed input');
  });

  it('flags partial entries against the class recording pattern, by whole areas', () => {
    // Class pattern: listening + homework. Bora only did listening.
    const dara = student('Dara', { [WEEK]: { listening: 4, speaking: 3, hwDay1: 80, hwDay2: 90 } });
    const chan = student('Chan', { [WEEK]: { listening: 5, speaking: 4, hwDay1: 70 } });
    const bora = student('Bora', { [WEEK]: { listening: 3, speaking: 2 } });
    const report = auditMissedInputs([dara, chan, bora], WEEK);
    const boraFinding = report.week.find((f) => f.studentName === 'Bora');
    expect(boraFinding?.kind).toBe('partial-entry');
    expect(boraFinding?.missingAreas).toEqual(['Homework']);
    expect(boraFinding?.detail).toContain('Homework');
  });

  it('never flags areas the class did not record that week', () => {
    // Only homework recorded class-wide — missing PBL/quizzes is NOT flagged.
    const dara = student('Dara', { [WEEK]: { hwDay1: 80 } });
    const bora = student('Bora', { [WEEK]: { hwDay1: 60 } });
    const report = auditMissedInputs([dara, bora], WEEK);
    expect(report.week).toHaveLength(0);
    expect(report.headline).toContain('No missed inputs');
  });

  it('stays quiet for a brand-new class with no data anywhere', () => {
    const dara = student('Dara');
    const report = auditMissedInputs([dara], WEEK);
    expect(report.started).toBe(false);
    expect(report.week).toHaveLength(0);
    expect(report.headline).toContain('Nobody has recorded anything yet');
  });

  it('flags the whole roster on a fresh week when the class has history', () => {
    // A new Monday: nobody has recorded the current week yet, but the class
    // has weeks of history — that IS the missed input the teacher must fill.
    const hist = { '2026-11-02': { listening: 4, speaking: 4 } };
    const dara = student('Dara', hist);
    const bora = student('Bora', hist);
    const report = auditMissedInputs([dara, bora], WEEK);
    expect(report.started).toBe(true);
    expect(report.emptyWeek).toBe(true);
    expect(report.week).toHaveLength(2);
    expect(report.headline).toBe(`2 missed inputs found for Week of 9 Nov 2026.`);
    expect(report.week[0].detail).toContain('nobody has recorded this week so far');
  });

  it('flags students whose original record is empty (only when someone has one)', () => {
    const filled = student('Dara', {}, { listening: 4, speaking: 3, quizT1Q1: 80 });
    const emptyRec = student('Bora');
    const report = auditMissedInputs([filled, emptyRec], null);
    expect(report.initial).toHaveLength(1);
    expect(report.initial[0].studentName).toBe('Bora');
    expect(report.initial[0].detail).toContain('original record has no scores');
    // A brand-new empty class flags nobody.
    expect(auditMissedInputs([student('Chan')], null).initial).toHaveLength(0);
  });

  it('treats a notes-only week entry as no scores', () => {
    const dara = student('Dara', { [WEEK]: { listening: 4 } });
    const bora = { ...student('Bora', { [WEEK]: { listeningNotes: 'absent most days' } }) } as AssessmentStudentDoc;
    const report = auditMissedInputs([dara, bora], WEEK);
    const boraFinding = report.week.find((f) => f.studentName === 'Bora');
    expect(boraFinding?.kind).toBe('no-entry');
    expect(boraFinding?.detail).toContain('only notes, no scores');
  });

  it('does not flag a student who only missed the (not yet recorded) current week', () => {
    // Bora has weeks of history but nothing for the CURRENT week — that IS a
    // missed input for the current week (kind no-entry), not "missing-initial".
    const hist = { '2026-11-02': { listening: 4, speaking: 4 } };
    const bora = student('Bora', hist);
    const dara = student('Dara', { ...hist, [WEEK]: { listening: 5 } });
    const report = auditMissedInputs([dara, bora], WEEK);
    const boraFinding = report.week.find((f) => f.studentName === 'Bora');
    expect(boraFinding?.kind).toBe('no-entry');
    expect(report.initial).toHaveLength(0);
  });
});

describe('buildAssessmentFeedback', () => {
  it('builds a grounded trend + week line per student', () => {
    const dara = student('Dara', {
      '2026-11-02': { listening: 3, speaking: 3 },
      [WEEK]: { listening: 4, speaking: 4, hwDay1: 50 },
    }, { listening: 2, speaking: 2 });
    const lines = buildAssessmentFeedback([dara], WEEK);
    expect(lines).toHaveLength(1);
    const text = lines[0].text;
    expect(text).toContain('Dara:');
    // 2 skill areas recorded initially (2/5 → 40% each → overall 40), then
    // listening+speaking 4/5 (80%) + homework 50 → overall 65.
    expect(text).toMatch(/\d+% overall \(\+\d+ vs the previous record/);
    expect(text).toContain('strongest Listening & speaking (80%)');
    expect(text).toContain('weakest Homework (50%)');
  });

  it('says when there is nothing for the selected week yet', () => {
    const dara = student('Dara', { '2026-11-02': { listening: 4, speaking: 3 } }, { listening: 3 });
    const lines = buildAssessmentFeedback([dara], WEEK);
    expect(lines[0].text).toContain(`No scores for Week of`);
  });

  it('covers students with no scores at all without crashing', () => {
    const lines = buildAssessmentFeedback([student('Bora')], WEEK);
    expect(lines[0].text).toBe('Bora: no scores recorded yet.');
  });
});

describe('week sync anchor', () => {
  it('the current week key matches the actual calendar (Mon 9 Nov 2026 today)', () => {
    // The workspace opens on this key — pin the Cambodia-local Monday math.
    expect(weekKeyOf(new Date(2026, 10, 14))).toBe(WEEK); // Sat 14 Nov 2026
    expect(weekKeyOf(new Date(2026, 10, 9))).toBe(WEEK);  // Mon 9 Nov 2026
  });
});
