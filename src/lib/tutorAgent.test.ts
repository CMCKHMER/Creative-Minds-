// Tutor agent parser — the record-keeping half of the assessment AI Tutor.
//
// These tests pin every parsing rule the workspace relies on: student
// resolution (word boundaries), score field aliases with clamping, quiz
// term handling (span reservation so "term 2 quiz 3" never double-files
// Term 1), sequential daily entry, add/note/clear commands, week targeting,
// and the fall-through to the insight Q&A.

import { describe, expect, it } from 'vitest';
import { emptyStudentScores } from './assessmentScoring';
import type { AssessmentStudentDoc } from './assessmentDb';
import { findStudentByMention, parseTutorCommand, TUTOR_HELP } from './tutorAgent';

function student(over: Partial<AssessmentStudentDoc> = {}): AssessmentStudentDoc {
  return {
    id: 's1',
    name: 'Sokha',
    schoolId: '',
    sponsorship: 'Pending',
    amount: '',
    comments: '',
    teacherComment: '',
    weeks: {},
    ...emptyStudentScores(),
    updatedAt: null,
    updatedBy: '',
    ...over,
  };
}

const ROSTER = [
  student({ id: 'a', name: 'Dara' }),
  student({ id: 'b', name: 'Bora' }),
  student({ id: 'c', name: 'Ly' }),
];
const CTX = { students: ROSTER, weekKey: '2026-11-09' };

describe('findStudentByMention', () => {
  it('matches whole words only', () => {
    expect(findStudentByMention('Bora is falling', ROSTER)?.id).toBe('b');
    expect(findStudentByMention('who is falling?', ROSTER)).toBeNull(); // "Ly" must not match "falling"
  });
  it('is case-insensitive', () => {
    expect(findStudentByMention('dara listening 4', ROSTER)?.id).toBe('a');
  });
});

describe('record-scores parsing', () => {
  it('parses 0–5 skills with clamping and labels', () => {
    const r = parseTutorCommand('Dara listening 4 speaking 3 pronunciation 9', CTX);
    const intent = r.intents[0];
    expect(intent.kind).toBe('record-scores');
    if (intent.kind !== 'record-scores') return;
    expect(intent.studentId).toBe('a');
    expect(intent.fields).toEqual({ listening: 4, speaking: 3, pronunciation: 5 });
    expect(intent.target).toBe('week');
    expect(r.summary.join(' ')).toMatch(/Week of/);
  });

  it('parses reading skills, pbl criteria, and quizzes with span reservation', () => {
    const r = parseTutorCommand('Bora comprehension 4 vocab 3 speed 2 accuracy 5 pbl presentation 85 term 2 quiz 3 70 quiz 1 85', CTX);
    expect(r.intents[0].kind).toBe('record-scores');
    if (r.intents[0].kind !== 'record-scores') return;
    expect(r.intents[0].fields).toEqual({
      comprehension: 4, vocabulary: 3, readingSpeed: 2, accuracy: 5,
      pblPresentation: 85, quizT2Q3: 70, quizT1Q1: 85,
    });
  });

  it('parses sequential homework and participation days', () => {
    const r = parseTutorCommand('hw 80 85 90 part 70 for Dara', CTX);
    expect(r.intents[0].kind).toBe('record-scores');
    if (r.intents[0].kind !== 'record-scores') return;
    expect(r.intents[0].fields).toEqual({ hwDay1: 80, hwDay2: 85, hwDay3: 90, partDay1: 70 });
  });

  it('explicit day numbers beat sequential fill', () => {
    const r = parseTutorCommand('Dara hw day2 90', CTX);
    expect(r.intents[0].kind).toBe('record-scores');
    if (r.intents[0].kind !== 'record-scores') return;
    expect(r.intents[0].fields).toEqual({ hwDay2: 90 });
  });

  it('"initial" targets the original record even with a week selected', () => {
    const r = parseTutorCommand('Dara listening 5 — into the initial record', CTX);
    expect(r.intents[0].kind).toBe('record-scores');
    if (r.intents[0].kind !== 'record-scores') return;
    expect(r.intents[0].target).toBe('initial');
    expect(r.summary.join(' ')).toMatch(/Initial record/);
  });

  it('scores without a student get a helpful problem', () => {
    const r = parseTutorCommand('listening 4 speaking 3', CTX);
    expect(r.intents).toHaveLength(0);
    expect(r.problem).toMatch(/no student name/i);
  });

  it('unknown students get a helpful problem', () => {
    const r = parseTutorCommand('Sokha listening 4', CTX);
    expect(r.intents).toHaveLength(0);
    expect(r.problem).toMatch(/no student name|couldn't find/i);
  });
});

describe('record maintenance commands', () => {
  it('adds a student', () => {
    const r = parseTutorCommand('add student Sreyleap', CTX);
    expect(r.intents[0]).toEqual({ kind: 'add-student', name: 'Sreyleap' });
  });

  it('saves a note for a known student', () => {
    const r = parseTutorCommand('note for Dara: much better participation this week', CTX);
    expect(r.intents[0]).toEqual({ kind: 'set-note', studentId: 'a', studentName: 'Dara', text: 'much better participation this week' });
  });

  it('notes for unknown students do not write', () => {
    const r = parseTutorCommand('note for Sokha: great week', CTX);
    expect(r.intents).toHaveLength(0);
    expect(r.problem).toMatch(/couldn't find/i);
  });

  it('clears the selected week for a named student', () => {
    const r = parseTutorCommand('clear the week for Bora', CTX);
    expect(r.intents[0]).toEqual({ kind: 'clear-week', studentId: 'b', studentName: 'Bora', weekKey: '2026-11-09' });
  });

  it('refuses to clear a week when none is selected', () => {
    const r = parseTutorCommand('clear the week for Bora', { students: ROSTER, weekKey: null });
    expect(r.intents).toHaveLength(0);
    expect(r.problem).toMatch(/no week is selected/i);
  });

  it('help returns the syntax sheet', () => {
    const r = parseTutorCommand('help', CTX);
    expect(r.problem).toBe(TUTOR_HELP);
    expect(TUTOR_HELP).toMatch(/hw 80 85/);
  });
});

describe('fall-through to the insight Q&A', () => {
  it('questions about the class produce no intents', () => {
    expect(parseTutorCommand('Who is falling?', CTX).intents).toHaveLength(0);
    expect(parseTutorCommand('Class overview', CTX).intents).toHaveLength(0);
    expect(parseTutorCommand('What about Dara?', CTX).intents).toHaveLength(0);
  });

  it('empty input is inert', () => {
    expect(parseTutorCommand('   ', CTX).intents).toHaveLength(0);
  });
});
