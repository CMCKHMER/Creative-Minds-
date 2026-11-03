// Insight AI — the assessment workspace's on-device trend analyst.
//
// Answers one teacher question: "who is rising, who is falling, and who needs
// attention right now?" — from the RAW roster on screen (the original flat
// record + the chronological weekly entries). Deliberately NOT the week-view
// effective docs: those blend the selected week into the flat fields and would
// double-count the selected week as a second Initial record.
//
// Everything here is deterministic, pure, and computed in the browser — no
// model calls, no network, no keys, no student data leaving the device.
//
// Model:
//   series      Initial record first, then weeks in ascending key order;
//               each point is that record's overall % (0 = not assessed, skipped)
//   slope       least-squares fit of overall % over step index (pts per step);
//               ≥ +2 rising, ≤ −2 falling, in between steady
//   volatility  σ of the step-to-step deltas; σ ≥ 12 pts = choppy history
//   urgent      falling AND latest overall < 50
//   watch       falling (but not urgent) OR volatile history
//   engagement  homework + participation series slope ≤ −2 → engagement dip

import { areaScores, emptyStudentScores, type AreaScores } from './assessmentScoring';
import type { AssessmentStudentDoc, AssessmentWeekEntry } from './assessmentDb';

export const RISING_BAND = 2;    // pts per step
export const VOLATILE_SIGMA = 12; // pts of delta σ

const AREA_LABELS: Array<{ key: keyof Omit<AreaScores, 'overall'>; label: string }> = [
  { key: 'listening', label: 'Listening & Speaking' },
  { key: 'reading', label: 'Reading' },
  { key: 'pbl', label: 'PBL' },
  { key: 'quiz', label: 'Quizzes' },
  { key: 'homework', label: 'Homework' },
  { key: 'participation', label: 'Participation' },
];

export type Trend = 'rising' | 'falling' | 'steady' | 'needs-data';

export interface SeriesPoint {
  label: string;   // "Initial record" | "Week of …"
  overall: number; // overall % at that step (always > 0)
  areas: AreaScores;
}

export interface StudentInsight {
  student: AssessmentStudentDoc;
  series: SeriesPoint[];
  slope: number;
  volatility: number;
  first: number;
  latest: number;
  trend: Trend;
  flags: { urgent: boolean; watch: boolean; engagementDrop: boolean };
  weakest: { label: string; score: number } | null;
  strongest: { label: string; score: number } | null;
  narrative: string;
  actions: string[];
}

export interface ClassInsights {
  insights: StudentInsight[];
  rising: StudentInsight[];
  falling: StudentInsight[];
  steady: StudentInsight[];
  needsData: StudentInsight[];
  pulse: { rising: number; falling: number; steady: number; needsData: number; tracked: number };
  topMover: StudentInsight | null;
  topFaller: StudentInsight | null;
  urgentCount: number;
  areaMovements: Array<{ label: string; delta: number }>;
  recommendations: string[];
}

// ── Series construction ──────────────────────────────────────────────

function overallOf(record: object): number {
  return areaScores({ ...emptyStudentScores(), ...(record as Record<string, unknown>) } as AssessmentStudentDoc).overall;
}

function areasOf(record: object): AreaScores {
  return areaScores({ ...emptyStudentScores(), ...(record as Record<string, unknown>) } as AssessmentStudentDoc);
}

/** Chronological series: Initial (flat) record first, then each week that has
 *  actual data, ascending by week key. Points with no assessed area (overall
 *  0) are skipped — a blank week is "not assessed", not a zero. */
export function buildSeries(student: AssessmentStudentDoc): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  const flatOverall = overallOf(student);
  if (flatOverall > 0) {
    points.push({ label: 'Initial record', overall: flatOverall, areas: areasOf(student) });
  }
  const weeks = Object.entries(student.weeks ?? {})
    .filter(([, entry]) => entry && Object.keys(entry).length > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  for (const [key, entry] of weeks) {
    const overall = overallOf(entry as AssessmentWeekEntry);
    if (overall <= 0) continue;
    points.push({ label: `Week of ${key}`, overall, areas: areasOf(entry as AssessmentWeekEntry) });
  }
  return points;
}

// ── Math helpers ─────────────────────────────────────────────────────

/** Least-squares slope of y over its index (pts per step). */
export function leastSquaresSlope(ys: number[]): number {
  const n = ys.length;
  if (n < 2) return 0;
  const mx = (n - 1) / 2;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - mx) * (ys[i] - my);
    den += (i - mx) * (i - mx);
  }
  return den === 0 ? 0 : num / den;
}

/** Population σ of the step-to-step deltas (0 for fewer than 2 deltas). */
export function deltaSigma(ys: number[]): number {
  if (ys.length < 3) return 0;
  const deltas: number[] = [];
  for (let i = 1; i < ys.length; i++) deltas.push(ys[i] - ys[i - 1]);
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const variance = deltas.reduce((a, b) => a + (b - mean) * (b - mean), 0) / deltas.length;
  return Math.round(Math.sqrt(variance) * 10) / 10;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

// ── Per-student insight ──────────────────────────────────────────────

export function buildStudentInsight(student: AssessmentStudentDoc): StudentInsight {
  const series = buildSeries(student);
  const overalls = series.map((p) => p.overall);
  const slope = Math.round(leastSquaresSlope(overalls) * 10) / 10;
  const volatility = deltaSigma(overalls);
  const first = overalls[0] ?? 0;
  const latest = overalls[overalls.length - 1] ?? 0;

  const trend: Trend =
    series.length < 2 ? 'needs-data'
      : slope <= -RISING_BAND ? 'falling'
        : slope >= RISING_BAND ? 'rising'
          : 'steady';

  // Engagement: homework + participation mean at each step.
  const engagement = series.map((p) => {
    const vals = [p.areas.homework, p.areas.participation].filter((v) => v > 0);
    return mean(vals);
  });
  const engagementDrop = series.length >= 2 && leastSquaresSlope(engagement) <= -RISING_BAND;

  const urgent = trend === 'falling' && latest > 0 && latest < 50;
  const watch = !urgent && (trend === 'falling' || volatility >= VOLATILE_SIGMA);

  // Weakest / strongest area from the LATEST record with data.
  const lastAreas = series.length ? series[series.length - 1].areas : areasOf(student);
  const scored = AREA_LABELS
    .map(({ key, label }) => ({ label, score: lastAreas[key] }))
    .filter((a) => a.score > 0)
    .sort((a, b) => a.score - b.score);
  const weakest = scored.length ? scored[0] : null;
  const strongest = scored.length ? scored[scored.length - 1] : null;

  const name = student.name || 'This student';
  let narrative: string;
  const actions: string[] = [];
  if (trend === 'needs-data') {
    narrative = series.length === 0
      ? `${name} has no recorded scores yet — record an Initial assessment or a weekly entry to start tracking.`
      : `${name} has only one recorded assessment (${latest}%). Record one more week to unlock a trend.`;
    actions.push('Record this week\'s scores to start the trend line');
  } else if (urgent) {
    narrative = `${name} is falling fast — ${first}% → ${latest}% (about ${Math.round(slope)} pts per step) and the latest score is under 50%.`;
    actions.push('Have a one-to-one check-in this week');
    actions.push('Review the two most recent week entries for the dip');
  } else if (trend === 'falling') {
    narrative = `${name} is trending down — ${first}% → ${latest}% (about ${Math.round(slope)} pts per step).`;
    actions.push('Compare the last two weeks to find the drop');
    actions.push('Set a small, specific goal for next week');
  } else if (trend === 'rising') {
    narrative = `${name} is rising — ${first}% → ${latest}% (about +${Math.round(slope)} pts per step).`;
    actions.push('Acknowledge the improvement in class');
    actions.push('Consider stretch material to keep the momentum');
  } else {
    narrative = volatility >= VOLATILE_SIGMA
      ? `${name} is steady on average (${first}% → ${latest}%) but the week-to-week swings are large (σ ${volatility} pts).`
      : `${name} is steady — ${first}% → ${latest}% across ${series.length} recordings.`;
    if (volatility >= VOLATILE_SIGMA) actions.push('Check what differs between the high and low weeks');
  }
  if (engagementDrop) {
    narrative += ' Homework/participation is also sliding.';
    actions.push('Follow up on missing homework before it becomes a pattern');
  }
  if (weakest && weakest.score < 50) {
    actions.push(`Focus next week on ${weakest.label.toLowerCase()} (${weakest.score}%)`);
  }

  return {
    student, series, slope, volatility, first, latest, trend,
    flags: { urgent, watch, engagementDrop },
    weakest, strongest, narrative, actions,
  };
}

// ── Class rollup ─────────────────────────────────────────────────────

export function buildClassInsights(students: AssessmentStudentDoc[]): ClassInsights {
  const insights = students.map(buildStudentInsight);
  const by = (t: Trend) => insights.filter((i) => i.trend === t);
  const rising = by('rising');
  const falling = by('falling');
  const steady = by('steady');
  const needsData = by('needs-data');
  const urgentCount = insights.filter((i) => i.flags.urgent).length;

  const topMover = rising.length
    ? rising.reduce((a, b) => (b.slope > a.slope ? b : a))
    : null;
  const topFaller = falling.length
    ? falling.reduce((a, b) => (b.slope < a.slope ? b : a))
    : null;

  // Class-mean movement per area: latest record vs first record, averaged
  // over the students that have data for that step.
  const areaMovements = AREA_LABELS.map(({ key, label }) => {
    const firsts: number[] = [];
    const lasts: number[] = [];
    for (const i of insights) {
      if (i.series.length === 0) continue;
      const f = i.series[0].areas[key];
      const l = i.series[i.series.length - 1].areas[key];
      if (f > 0) firsts.push(f);
      if (l > 0) lasts.push(l);
    }
    const delta = firsts.length && lasts.length
      ? Math.round(mean(lasts) - mean(firsts))
      : 0;
    return { label, delta };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const recommendations: string[] = [];
  if (urgentCount > 0) {
    const names = insights.filter((i) => i.flags.urgent).map((i) => i.student.name || 'unnamed').slice(0, 3).join(', ');
    recommendations.push(`${urgentCount} student${urgentCount === 1 ? '' : 's'} need urgent follow-up: ${names}.`);
  }
  const engagementDrops = insights.filter((i) => i.flags.engagementDrop);
  if (engagementDrops.length > 0) {
    recommendations.push(`${engagementDrops.length} student${engagementDrops.length === 1 ? '' : 's'} show an engagement dip (homework/participation sliding) — check in before it hits scores.`);
  }
  const worstArea = areaMovements.find((a) => a.delta < -2);
  if (worstArea) {
    recommendations.push(`${worstArea.label} moved ${worstArea.delta} pts across the class this period — worth a class-wide review.`);
  }
  if (topFaller) {
    recommendations.push(`Fastest faller: ${topFaller.student.name || 'unnamed'} (${topFaller.first}% → ${topFaller.latest}%).`);
  }
  if (topMover) {
    recommendations.push(`Biggest climber: ${topMover.student.name || 'unnamed'} (${topMover.first}% → ${topMover.latest}%) — a good candidate for peer-support roles.`);
  }
  if (recommendations.length === 0) {
    recommendations.push('No red flags this period — keep the weekly recordings coming to keep trends fresh.');
  }

  return {
    insights, rising, falling, steady, needsData,
    pulse: { rising: rising.length, falling: falling.length, steady: steady.length, needsData: needsData.length, tracked: insights.length },
    topMover, topFaller, urgentCount, areaMovements, recommendations,
  };
}

// ── Keyword assistant (deterministic Q&A over the rollup) ────────────

export const SUGGESTION_CHIPS = [
  'Who is falling?',
  'Who is rising?',
  'Anyone urgent?',
  'Class overview',
  'Engagement dips',
  'Weakest area',
] as const;

function nameOf(i: StudentInsight): string {
  return i.student.name || 'unnamed';
}

function listRisers(c: ClassInsights): string {
  if (c.rising.length === 0) return 'No one is rising yet — record another week so trends can form.';
  return [
    `${c.rising.length} student${c.rising.length === 1 ? '' : 's'} trending up:`,
    ...c.rising.map((i) => `• ${nameOf(i)}: ${i.first}% → ${i.latest}% (${i.slope >= 0 ? '+' : ''}${i.slope} pts/step)`),
  ].join('\n');
}

function listFallers(c: ClassInsights): string {
  if (c.falling.length === 0) return 'Good news — no student is trending down right now.';
  return [
    `${c.falling.length} student${c.falling.length === 1 ? '' : 's'} trending down:`,
    ...c.falling.map((i) => `• ${nameOf(i)}: ${i.first}% → ${i.latest}% (${i.slope} pts/step)${i.flags.urgent ? ' — URGENT' : ''}`),
  ].join('\n');
}

function listUrgent(c: ClassInsights): string {
  const urgent = c.insights.filter((i) => i.flags.urgent);
  if (urgent.length === 0) return 'No urgent cases — nobody is both falling and below 50%.';
  return [
    `${urgent.length} urgent case${urgent.length === 1 ? '' : 's'} (falling + under 50%):`,
    ...urgent.map((i) => `• ${nameOf(i)}: ${i.first}% → ${i.latest}% — ${i.actions[0] ?? 'follow up this week'}`),
  ].join('\n');
}

function overview(c: ClassInsights): string {
  const lines = [
    `Tracking ${c.pulse.tracked} student${c.pulse.tracked === 1 ? '' : 's'}: ${c.pulse.rising} rising · ${c.pulse.falling} falling · ${c.pulse.steady} steady · ${c.pulse.needsData} needs data.`,
    c.urgentCount > 0 ? `${c.urgentCount} urgent case${c.urgentCount === 1 ? '' : 's'} need follow-up.` : 'No urgent cases.',
  ];
  const top = c.areaMovements[0];
  if (top && top.delta !== 0) {
    lines.push(`Biggest class-level move: ${top.label} ${top.delta > 0 ? '+' : ''}${top.delta} pts.`);
  }
  return lines.join('\n');
}

function engagement(c: ClassInsights): string {
  const drops = c.insights.filter((i) => i.flags.engagementDrop);
  if (drops.length === 0) return 'No engagement dips — homework and participation are holding steady for everyone tracked.';
  return [
    `${drops.length} engagement dip${drops.length === 1 ? '' : 's'} (homework/participation sliding):`,
    ...drops.map((i) => `• ${nameOf(i)} — ${i.actions[0] ?? 'follow up'}`),
  ].join('\n');
}

function areas(c: ClassInsights, weakest: boolean): string {
  const ranked = c.insights
    .filter((i) => (weakest ? i.weakest : i.strongest))
    .map((i) => ({ name: nameOf(i), ...(weakest ? i.weakest! : i.strongest!) }));
  if (ranked.length === 0) return weakest ? 'No area scores recorded yet.' : 'No area scores recorded yet.';
  const cls = c.areaMovements;
  const extremes = weakest
    ? [...cls].sort((a, b) => a.delta - b.delta)[0]
    : [...cls].sort((a, b) => b.delta - a.delta)[0];
  return [
    weakest ? 'Weakest area per student (latest record):' : 'Strongest area per student (latest record):',
    ...ranked.slice(0, 8).map((r) => `• ${r.name}: ${r.label} (${r.score}%)`),
    extremes && extremes.delta !== 0
      ? `Class level: ${extremes.label} ${extremes.delta > 0 ? '+' : ''}${extremes.delta} pts this period.`
      : '',
  ].filter(Boolean).join('\n');
}

/** Deterministic keyword Q&A. Returns { text, matched } — matched=false gives
 *  the help text so the UI can suggest what to ask. */
export function answerInsightQuestion(question: string, c: ClassInsights): { text: string; matched: boolean } {
  const q = question.trim().toLowerCase();
  if (!q) return { text: 'Ask about a student by name, or try "Who is falling?"', matched: false };

  // A known student name takes priority.
  const hit = c.insights.find((i) => {
    const n = i.student.name.trim().toLowerCase();
    return n.length > 1 && q.includes(n);
  });
  if (hit) {
    return {
      text: [hit.narrative, hit.actions.length ? `Next steps:\n${hit.actions.map((a) => `• ${a}`).join('\n')}` : ''].filter(Boolean).join('\n\n'),
      matched: true,
    };
  }

  if (/\b(fall|falling|drop|dropping|decline|declining|down|worse|slipping)\b/.test(q)) return { text: listFallers(c), matched: true };
  if (/\b(rise|rising|improv|better|up\b|climb|gaining)\b/.test(q)) return { text: listRisers(c), matched: true };
  if (/\b(urgent|risk|at risk|danger|critical|help now)\b/.test(q)) return { text: listUrgent(c), matched: true };
  if (/\b(engage|homework|participation|attendance)\b/.test(q)) return { text: engagement(c), matched: true };
  if (/\b(weakest|weak|struggl|worst|lowest)\b/.test(q)) return { text: areas(c, true), matched: true };
  if (/\b(strongest|strong|best|highest|top)\b/.test(q)) return { text: areas(c, false), matched: true };
  if (/\b(overview|summary|pulse|class|how are|status|report)\b/.test(q)) return { text: overview(c), matched: true };
  if (/\b(volatile|inconsistent|swings)\b/.test(q)) {
    const vol = c.insights.filter((i) => i.volatility >= VOLATILE_SIGMA);
    return {
      text: vol.length === 0
        ? 'No volatile histories — everyone\'s week-to-week swings are small.'
        : `Volatile histories (σ ≥ ${VOLATILE_SIGMA} pts):\n${vol.map((i) => `• ${nameOf(i)} (σ ${i.volatility})`).join('\n')}`,
      matched: true,
    };
  }
  return {
    text: 'I can answer things like "Who is falling?", "Anyone urgent?", "Class overview", "Engagement dips", "Weakest area" — or ask about any student by name.',
    matched: false,
  };
}
