// Insight AI engine — deterministic trend analysis.
//
// These tests pin the whole analysis model: series construction (Initial +
// chronological weeks), least-squares slope bands, volatility σ, urgent/watch/
// engagement flags, class rollups, and the keyword assistant routing.

import { describe, expect, it } from 'vitest';
import { emptyStudentScores, type AssessmentStudentScores } from '../lib/assessmentScoring';
import type { AssessmentStudentDoc, AssessmentWeekEntry } from '../lib/assessmentDb';
import {
  answerInsightQuestion,
  buildClassInsights,
  buildSeries,
  buildStudentInsight,
  deltaSigma,
  leastSquaresSlope,
  SUGGESTION_CHIPS,
} from '../lib/insightEngine';

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

/** A week entry where every listening/speaking skill is `n` (0–5 each). */
function week(listening: number): AssessmentWeekEntry {
  return { listening, speaking: listening, pronunciation: listening, fluency: listening };
}

/** Flat record whose four listening skills are all `n`. */
function flat(listening: number): Partial<AssessmentStudentDoc> {
  return { listening, speaking: listening, pronunciation: listening, fluency: listening } as Partial<AssessmentStudentScores> as Partial<AssessmentStudentDoc>;
}

describe('buildSeries', () => {
  it('starts with the Initial record then weeks in ascending key order', () => {
    const s = student({
      ...flat(2), // Initial: 40%
      weeks: {
        '2026-11-02': week(4), // 80%
        '2026-10-26': week(3), // 60%
      },
    });
    const series = buildSeries(s);
    expect(series.map((p) => p.label)).toEqual(['Initial record', 'Week of 2026-10-26', 'Week of 2026-11-02']);
    expect(series.map((p) => p.overall)).toEqual([40, 60, 80]);
  });

  it('skips week entries that are empty or have no assessed areas', () => {
    const s = student({
      ...flat(3),
      weeks: { '2026-10-26': {}, '2026-11-02': week(4), '2026-11-09': { listening: 0 } },
    });
    expect(buildSeries(s).map((p) => p.label)).toEqual(['Initial record', 'Week of 2026-11-02']);
  });

  it('returns an empty series for a student with no recorded scores', () => {
    expect(buildSeries(student())).toEqual([]);
  });
});

describe('slope + volatility math', () => {
  it('least-squares slope: +10 for a perfect rise, −10 for a fall', () => {
    expect(leastSquaresSlope([50, 60, 70])).toBeCloseTo(10, 5);
    expect(leastSquaresSlope([70, 60, 50])).toBeCloseTo(-10, 5);
  });

  it('least-squares slope is 0 for fewer than two points', () => {
    expect(leastSquaresSlope([])).toBe(0);
    expect(leastSquaresSlope([72])).toBe(0);
  });

  it('deltaSigma: 0 for a constant series, 30 for perfect swings 50/80/50', () => {
    expect(deltaSigma([60, 60, 60])).toBe(0);
    expect(deltaSigma([50, 80, 50])).toBe(30);
  });
});

describe('buildStudentInsight — trend bands and flags', () => {
  it('needs-data when there is only one recording', () => {
    const i = buildStudentInsight(student({ ...flat(3) }));
    expect(i.trend).toBe('needs-data');
    expect(i.latest).toBe(60);
    expect(i.flags.watch).toBe(false);
  });

  it('rising when slope ≥ +2, and the narrative says so', () => {
    const i = buildStudentInsight(student({ ...flat(2), weeks: { '2026-10-26': week(3), '2026-11-02': week(4) } }));
    expect(i.trend).toBe('rising');
    expect(i.latest).toBe(80);
    expect(i.narrative).toMatch(/rising/);
  });

  it('falling when slope ≤ −2, and the narrative says so', () => {
    const i = buildStudentInsight(student({ ...flat(4), weeks: { '2026-10-26': week(3), '2026-11-02': week(2) } }));
    expect(i.trend).toBe('falling');
    expect(i.narrative).toMatch(/falling|trending down/);
  });

  it('urgent = falling AND latest under 50', () => {
    const i = buildStudentInsight(student({ ...flat(4), weeks: { '2026-10-26': week(2), '2026-11-02': week(1) } }));
    expect(i.trend).toBe('falling');
    expect(i.latest).toBe(20);
    expect(i.flags.urgent).toBe(true);
  });

  it('falling but still ≥ 50 → watch, not urgent', () => {
    const i = buildStudentInsight(student({ ...flat(5), weeks: { '2026-10-26': week(4), '2026-11-02': week(3) } }));
    expect(i.trend).toBe('falling');
    expect(i.latest).toBe(60);
    expect(i.flags.urgent).toBe(false);
    expect(i.flags.watch).toBe(true);
  });

  it('steady average but volatile history (σ ≥ 12) → watch with a swings narrative', () => {
    const i = buildStudentInsight(student({ ...flat(2), weeks: { '2026-10-26': week(4), '2026-11-02': week(2) } }));
    // 40 → 80 → 40: slope 0 (steady) but σ 40
    expect(i.trend).toBe('steady');
    expect(i.volatility).toBeGreaterThanOrEqual(12);
    expect(i.flags.watch).toBe(true);
    expect(i.narrative).toMatch(/swings are large/);
  });

  it('flags an engagement dip when homework + participation slide', () => {
    const wk = (part: number, hw: number): AssessmentWeekEntry => ({ partDay1: part, hwDay1: hw });
    const i = buildStudentInsight(student({
      ...flat(3),
      partDay1: 90, hwDay1: 90,
      weeks: { '2026-10-26': wk(60, 60), '2026-11-02': wk(20, 20) },
    }));
    expect(i.flags.engagementDrop).toBe(true);
    expect(i.narrative).toMatch(/Homework\/participation is also sliding/);
  });

  it('no engagement dip when homework + participation hold steady', () => {
    const wk = (part: number, hw: number): AssessmentWeekEntry => ({ partDay1: part, hwDay1: hw });
    const i = buildStudentInsight(student({
      ...flat(3),
      partDay1: 80, hwDay1: 80,
      weeks: { '2026-10-26': wk(80, 80), '2026-11-02': wk(80, 80) },
    }));
    expect(i.flags.engagementDrop).toBe(false);
  });
});

describe('buildStudentInsight — areas and actions', () => {
  it('weakest/strongest come from the latest record', () => {
    const i = buildStudentInsight(student({
      listening: 5, speaking: 5, pronunciation: 5, fluency: 5, // 100
      comprehension: 1, vocabulary: 1, readingSpeed: 1, accuracy: 1, // 20
      weeks: { '2026-10-26': { listening: 5, speaking: 5, pronunciation: 5, fluency: 5, comprehension: 1, vocabulary: 1, readingSpeed: 1, accuracy: 1 } },
    }));
    expect(i.strongest?.label).toBe('Listening & Speaking');
    expect(i.weakest?.label).toBe('Reading');
    expect(i.weakest?.score).toBe(20);
  });

  it('urgent students get a check-in action; falling students get next steps', () => {
    const urgent = buildStudentInsight(student({ ...flat(4), weeks: { '2026-10-26': week(2), '2026-11-02': week(1) } }));
    expect(urgent.actions.some((a) => /check-in/i.test(a))).toBe(true);
    const falling = buildStudentInsight(student({ ...flat(4), weeks: { '2026-10-26': week(3), '2026-11-02': week(3) } }));
    expect(falling.actions.length).toBeGreaterThan(0);
  });
});

describe('buildClassInsights — rollup', () => {
  function roster() {
    return [
      student({ id: 'a', name: 'Ana', ...flat(2), weeks: { '2026-10-26': week(3), '2026-11-02': week(4) } }), // rising
      student({ id: 'b', name: 'Bora', ...flat(4), weeks: { '2026-10-26': week(2), '2026-11-02': week(1) } }), // falling urgent
      student({ id: 'c', name: 'Chan', ...flat(3), weeks: { '2026-10-26': week(3) } }), // steady (two identical recordings)
      student({ id: 'd', name: 'Dara', ...flat(3) }), // needs-data (Initial only)
    ];
  }

  it('pulse counts by trend', () => {
    const c = buildClassInsights(roster());
    expect(c.pulse).toEqual({ rising: 1, falling: 1, steady: 1, needsData: 1, tracked: 4 });
    expect(c.urgentCount).toBe(1);
  });

  it('topMover/topFaller pick the extreme slopes', () => {
    const c = buildClassInsights(roster());
    expect(c.topMover?.student.id).toBe('a');
    expect(c.topFaller?.student.id).toBe('b');
  });

  it('areaMovements compute class-level first→last deltas', () => {
    const c = buildClassInsights([
      student({ id: 'a', ...flat(2), weeks: { '2026-11-02': week(5) } }), // listening 40 → 100
      student({ id: 'b', ...flat(3) }), // listening 60 → 60
    ]);
    const listening = c.areaMovements.find((a) => a.label === 'Listening & Speaking');
    // class mean first = (40+60)/2 = 50, last = (100+60)/2 = 80 → +30
    expect(listening?.delta).toBe(30);
    expect(c.areaMovements[0].label).toBe('Listening & Speaking'); // sorted by |delta|
  });

  it('recommendations always have at least one line', () => {
    const c = buildClassInsights([student({ id: 'a', ...flat(3), weeks: { '2026-10-26': week(3) } })]);
    expect(c.recommendations.length).toBeGreaterThan(0);
  });
});

describe('answerInsightQuestion — keyword routing', () => {
  const c = buildClassInsights([
    student({ id: 'a', name: 'Ana', ...flat(2), weeks: { '2026-10-26': week(3), '2026-11-02': week(4) } }),
    student({ id: 'b', name: 'Bora', ...flat(4), weeks: { '2026-10-26': week(2), '2026-11-02': week(1) } }),
  ]);

  it('a student name returns that student\'s narrative and actions', () => {
    const r = answerInsightQuestion('What about Bora?', c);
    expect(r.matched).toBe(true);
    expect(r.text).toMatch(/Bora/);
    expect(r.text).toMatch(/falling|trending down/);
  });

  it('"who is falling" lists the fallers', () => {
    const r = answerInsightQuestion(SUGGESTION_CHIPS[0], c);
    expect(r.matched).toBe(true);
    expect(r.text).toMatch(/Bora/);
  });

  it('"who is rising" lists the risers', () => {
    const r = answerInsightQuestion('Who is rising?', c);
    expect(r.matched).toBe(true);
    expect(r.text).toMatch(/Ana/);
  });

  it('"anyone urgent" routes to the urgent list', () => {
    const r = answerInsightQuestion('Anyone urgent?', c);
    expect(r.matched).toBe(true);
    expect(r.text).toMatch(/urgent case/i);
  });

  it('weakest-area questions route to the area breakdown', () => {
    const r = answerInsightQuestion('What is the weakest area?', c);
    expect(r.matched).toBe(true);
    expect(r.text).toMatch(/Weakest area per student/);
  });

  it('overview questions give the class pulse', () => {
    const r = answerInsightQuestion('Class overview', c);
    expect(r.matched).toBe(true);
    expect(r.text).toMatch(/Tracking 2 students/);
  });

  it('gibberish and empty questions fall back to help text', () => {
    expect(answerInsightQuestion('zzz qqq xxx', c).matched).toBe(false);
    expect(answerInsightQuestion('', c).matched).toBe(false);
    expect(SUGGESTION_CHIPS.length).toBeGreaterThan(3);
  });
});
