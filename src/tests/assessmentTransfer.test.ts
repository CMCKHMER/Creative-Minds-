// Assessment class transfer + lossless encoding.
//
// Pins the two integrity guarantees of the transfer feature:
//   1. transferRecordOf ships EVERY student stat (flat scores, notes, identity,
//      sponsorship, full weekly history) and strips only doc-managed fields.
//   2. enc() encodes record-shaped data (the `weeks` map) as nested mapValue —
//      never the "[object Object]" stringification that used to silently
//      destroy every weekly entry on duplicate/transfer.

import { describe, expect, it } from 'vitest';
import { emptyStudentScores } from '../lib/assessmentScoring';
import type { AssessmentStudentDoc } from '../lib/assessmentDb';
import { enc, transferRecordOf } from '../lib/assessmentDb';

function fullStudent(): AssessmentStudentDoc {
  return {
    id: 'stu-123',
    name: 'Sokha Chen',
    schoolId: 'CM-0042',
    sponsorship: 'Partial',
    amount: '$20',
    comments: 'Needs encouragement',
    teacherComment: 'Great progress in reading',
    listening: 4, speaking: 3, pronunciation: 4, fluency: 3, listeningNotes: 'Louder, please',
    comprehension: 3, vocabulary: 4, readingSpeed: 3, accuracy: 4, readingNotes: '',
    pblSubject: 80, pblPresentation: 75, pblLanguage: 70, pblFocusPoints: 85, pblNotes: '',
    quizT1Q1: 90, quizT1Q2: 80, quizT1Q3: 70, quizT1Q4: 0, quizT1Q5: 0,
    quizT2Q1: 0, quizT2Q2: 0, quizT2Q3: 0, quizT2Q4: 0, quizT2Q5: 0, quizNotes: '',
    hwDay1: 100, hwDay2: 80, hwDay3: 0, hwDay4: 0, hwDay5: 0, hwNotes: '',
    partDay1: 90, partDay2: 70, partDay3: 0, partDay4: 0, partDay5: 0, partNotes: '',
    weeks: {
      '2026-10-26': { listening: 5, speaking: 5, listeningNotes: 'Excellent week' },
      '2026-11-02': { quizT1Q1: 95, partDay1: 100 },
    },
    updatedAt: 1793980000000,
    updatedBy: 'teacher@example.com',
  };
}

describe('enc — Firestore REST typed values', () => {
  it('numbers round-trip as integerValue strings (rounded)', () => {
    expect(enc(42)).toEqual({ integerValue: '42' });
    expect(enc(41.6)).toEqual({ integerValue: '42' });
    expect(enc(0)).toEqual({ integerValue: '0' });
  });

  it('booleans ship as booleanValue', () => {
    expect(enc(true)).toEqual({ booleanValue: true });
  });

  it('null and undefined ship as nullValue', () => {
    expect(enc(null)).toEqual({ nullValue: null });
    expect(enc(undefined)).toEqual({ nullValue: null });
  });

  it('strings ship as stringValue', () => {
    expect(enc('hello')).toEqual({ stringValue: 'hello' });
  });

  it('plain objects ship as nested mapValue, not strings', () => {
    expect(enc({ a: 1, b: 'x' })).toEqual({
      mapValue: { fields: { a: { integerValue: '1' }, b: { stringValue: 'x' } } },
    });
  });

  it('empty objects ship as an empty mapValue', () => {
    expect(enc({})).toEqual({ mapValue: { fields: {} } });
  });

  it('a weeks-shaped map encodes week keys → field leaves', () => {
    const out = enc({ '2026-10-26': { listening: 5, listeningNotes: 'Excellent week' } });
    const leaf = (out.mapValue as { fields: Record<string, { mapValue: { fields: Record<string, unknown> } }> })
      .fields['2026-10-26'].mapValue.fields;
    expect(leaf.listening).toEqual({ integerValue: '5' });
    expect(leaf.listeningNotes).toEqual({ stringValue: 'Excellent week' });
  });

  it('deeply nested objects stay lossless (map inside map inside map)', () => {
    const out = enc({ lvl1: { lvl2: { lvl3: 7 } } }) as {
      mapValue: { fields: Record<string, unknown> };
    };
    const lvl3 = ((out.mapValue.fields.lvl1 as never as { mapValue: { fields: Record<string, unknown> } }).mapValue.fields.lvl2 as { mapValue: { fields: Record<string, unknown> } }).mapValue.fields.lvl3;
    expect(lvl3).toEqual({ integerValue: '7' });
  });
});

describe('transferRecordOf — the transfer/duplicate payload', () => {
  it('strips ONLY the doc-managed fields (id, updatedAt, updatedBy)', () => {
    const record = transferRecordOf(fullStudent()) as Record<string, unknown>;
    expect(record).not.toHaveProperty('id');
    expect(record).not.toHaveProperty('updatedAt');
    expect(record).not.toHaveProperty('updatedBy');
  });

  it('keeps identity, sponsorship, notes, and every score group', () => {
    const record = transferRecordOf(fullStudent()) as Record<string, unknown>;
    expect(record.name).toBe('Sokha Chen');
    expect(record.schoolId).toBe('CM-0042');
    expect(record.sponsorship).toBe('Partial');
    expect(record.comments).toBe('Needs encouragement');
    expect(record.teacherComment).toBe('Great progress in reading');
    expect(record.listening).toBe(4);
    expect(record.pblSubject).toBe(80);
    expect(record.quizT1Q1).toBe(90);
    expect(record.hwDay1).toBe(100);
    expect(record.partDay2).toBe(70);
  });

  it('keeps the FULL weekly history intact', () => {
    const record = transferRecordOf(fullStudent()) as Record<string, unknown>;
    const weeks = record.weeks as Record<string, Record<string, number | string>>;
    expect(Object.keys(weeks).sort()).toEqual(['2026-10-26', '2026-11-02']);
    expect(weeks['2026-10-26'].listening).toBe(5);
    expect(weeks['2026-10-26'].listeningNotes).toBe('Excellent week');
    expect(weeks['2026-11-02'].quizT1Q1).toBe(95);
  });

  it('the payload encodes without any "[object Object]" corruption', () => {
    const body = enc(transferRecordOf(fullStudent()));
    expect(JSON.stringify(body)).not.toContain('[object Object]');
    // …and the weekly leaves survive the trip as real integers:
    const root = (body as { mapValue: { fields: Record<string, unknown> } }).mapValue.fields;
    const weeks = root.weeks as { mapValue: { fields: Record<string, unknown> } };
    const leaf = weeks.mapValue.fields['2026-11-02'] as { mapValue: { fields: Record<string, unknown> } };
    expect(leaf.mapValue.fields.quizT1Q1).toEqual({ integerValue: '95' });
  });

  it('duplicate and transfer payloads are byte-identical for the same student', () => {
    const s = fullStudent();
    const empty = studentWithNoWeeks();
    expect(transferRecordOf(s)).toEqual(transferRecordOf(s));
    expect(transferRecordOf(empty)).not.toHaveProperty('id');
  });

  function studentWithNoWeeks(): AssessmentStudentDoc {
    return {
      id: 'zz', name: 'Blank', schoolId: '', sponsorship: 'Pending', amount: '', comments: '', teacherComment: '',
      weeks: {}, ...emptyStudentScores(), updatedAt: null, updatedBy: '',
    };
  }
});
