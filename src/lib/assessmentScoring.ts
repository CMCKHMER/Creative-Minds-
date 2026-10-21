// Daily Student Assessment Records — scoring engine.
//
// Pure, side-effect-free port of the legacy Student Assessment Records app's
// scoring model (cmckhmer/Student-Assesment-Records index.html, v4.5), with one
// deliberate fix: a blank field means "not assessed", so partially assessed
// students are no longer penalized (legacy divided by fixed totals).
//
//   listening    = mean of the four 0–5 skill ratings that have been entered, ×20
//                  (0 means "not assessed" — partial assessments aren't penalized;
//                  the legacy app divided by 20 unconditionally, which scored a
//                  student assessed on 2 of 4 skills at half marks — fixed here)
//   reading      = mean of the four 0–5 reading ratings entered, ×20
//   pbl          = average of the PBL criteria that have been entered (0–100 each)
//   quiz         = per-term average of the 5 quizzes, then averaged across terms
//                  (a missing term falls back to the term that has scores)
//   homework     = average of the homework days that have been entered
//   participation= average of the participation days that have been entered
//   overall      = average of every area that has a non-zero score
//
// A score of 0 means "not assessed yet" — never a real zero — so 0 areas are
// excluded from averages exactly like the legacy app did.

export interface AssessmentStudentScores {
  // Listening & speaking — each 0–5
  listening: number;
  speaking: number;
  pronunciation: number;
  fluency: number;
  listeningNotes: string;
  // Reading — each 0–5
  comprehension: number;
  vocabulary: number;
  readingSpeed: number;
  accuracy: number;
  readingNotes: string;
  // PBL — each 0–100
  pblSubject: number;
  pblPresentation: number;
  pblLanguage: number;
  pblFocusPoints: number;
  pblNotes: string;
  // Quizzes — each 0–100, 5 per term, 2 terms
  quizT1Q1: number;
  quizT1Q2: number;
  quizT1Q3: number;
  quizT1Q4: number;
  quizT1Q5: number;
  quizT2Q1: number;
  quizT2Q2: number;
  quizT2Q3: number;
  quizT2Q4: number;
  quizT2Q5: number;
  quizNotes: string;
  // Homework — each 0–100, 5 days
  hwDay1: number;
  hwDay2: number;
  hwDay3: number;
  hwDay4: number;
  hwDay5: number;
  hwNotes: string;
  // Participation — each 0–100, 5 days
  partDay1: number;
  partDay2: number;
  partDay3: number;
  partDay4: number;
  partDay5: number;
  partNotes: string;
}

/** Blank record used when a new student row is added. */
export function emptyStudentScores(): AssessmentStudentScores {
  return {
    listening: 0, speaking: 0, pronunciation: 0, fluency: 0, listeningNotes: '',
    comprehension: 0, vocabulary: 0, readingSpeed: 0, accuracy: 0, readingNotes: '',
    pblSubject: 0, pblPresentation: 0, pblLanguage: 0, pblFocusPoints: 0, pblNotes: '',
    quizT1Q1: 0, quizT1Q2: 0, quizT1Q3: 0, quizT1Q4: 0, quizT1Q5: 0,
    quizT2Q1: 0, quizT2Q2: 0, quizT2Q3: 0, quizT2Q4: 0, quizT2Q5: 0, quizNotes: '',
    hwDay1: 0, hwDay2: 0, hwDay3: 0, hwDay4: 0, hwDay5: 0, hwNotes: '',
    partDay1: 0, partDay2: 0, partDay3: 0, partDay4: 0, partDay5: 0, partNotes: '',
  };
}

/** Mean of the entered values (unrounded); 0 when nothing was entered. */
function rawMean(values: Array<number | '' | null | undefined>): number {
  const entered = values.filter((v) => v !== '' && v !== null && v !== undefined && (Number(v) || 0) > 0);
  if (entered.length === 0) return 0;
  return entered.reduce<number>((a, b) => a + (Number(b) || 0), 0) / entered.length;
}

/** Mean of the entered values, rounded to an integer percentage; 0 when none. */
function meanOf(values: Array<number | '' | null | undefined>): number {
  const r = rawMean(values);
  return r === 0 ? 0 : Math.round(r);
}

export function listeningScore(s: AssessmentStudentScores): number {
  // raw mean (0–5) × 20, rounded once — no premature integer rounding
  return Math.round(rawMean([s.listening, s.speaking, s.pronunciation, s.fluency]) * 20);
}

export function readingScore(s: AssessmentStudentScores): number {
  return Math.round(rawMean([s.comprehension, s.vocabulary, s.readingSpeed, s.accuracy]) * 20);
}

export function pblScore(s: AssessmentStudentScores): number {
  return meanOf([s.pblSubject, s.pblPresentation, s.pblLanguage, s.pblFocusPoints]);
}

function quizTermAverage(s: AssessmentStudentScores, term: 1 | 2): number {
  const fields = term === 1
    ? [s.quizT1Q1, s.quizT1Q2, s.quizT1Q3, s.quizT1Q4, s.quizT1Q5]
    : [s.quizT2Q1, s.quizT2Q2, s.quizT2Q3, s.quizT2Q4, s.quizT2Q5];
  return meanOf(fields);
}

export function quizScore(s: AssessmentStudentScores): number {
  const t1 = quizTermAverage(s, 1);
  const t2 = quizTermAverage(s, 2);
  if (t1 > 0 && t2 > 0) return Math.round((t1 + t2) / 2);
  return t1 > 0 ? t1 : t2;
}

export function homeworkScore(s: AssessmentStudentScores): number {
  return meanOf([s.hwDay1, s.hwDay2, s.hwDay3, s.hwDay4, s.hwDay5]);
}

export function participationScore(s: AssessmentStudentScores): number {
  return meanOf([s.partDay1, s.partDay2, s.partDay3, s.partDay4, s.partDay5]);
}

export interface AreaScores {
  listening: number;
  reading: number;
  pbl: number;
  quiz: number;
  homework: number;
  participation: number;
  overall: number;
}

/** Every area score for one student, plus the overall aggregate. */
export function areaScores(s: AssessmentStudentScores): AreaScores {
  const listening = listeningScore(s);
  const reading = readingScore(s);
  const pbl = pblScore(s);
  const quiz = quizScore(s);
  const homework = homeworkScore(s);
  const participation = participationScore(s);
  const areas = [listening, reading, pbl, quiz, homework, participation].filter((v) => v > 0);
  const overall = areas.length === 0 ? 0 : Math.round(areas.reduce((a, b) => a + b, 0) / areas.length);
  return { listening, reading, pbl, quiz, homework, participation, overall };
}

/** Report-card colour bucket used across the workspace UI (matches legacy thresholds). */
export function scoreTone(score: number): 'good' | 'mid' | 'low' | 'none' {
  if (score <= 0) return 'none';
  if (score >= 70) return 'good';
  if (score >= 50) return 'mid';
  return 'low';
}
