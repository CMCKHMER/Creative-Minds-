// Bi-weekly private tests — grading module (teacher-side, Option A).
//
// The SAME comparison semantics as the practice template engine
// (public/biweek-planner/tests/_template.html): a student answer is the
// checked input values joined with "|" and sorted; a key answer may be a
// single index ("2") or a multi-select ("1|3"). Grading happens ONLY on the
// teacher's device against test_keys/{testId} — the student page never sees
// the key, never grades, never shows a score. This module is deliberately
// framework-free and side-effect-free so it can later be lifted verbatim
// into a Cloud Function (Option B) without changes.

export interface KeyQuestion {
  /** Group (section) id the question belongs to, e.g. "structure-list". */
  gid: string;
  /** 1-based question number within the whole test. */
  qnum: number;
  /** Normalized correct answer, e.g. "2" or "1|3". */
  answer: string;
}

export interface TestKeyGroup {
  id: string;
  title: string;
}

export interface TestKey {
  testId: string;
  title: string;
  groups: TestKeyGroup[];
  questions: KeyQuestion[];
}

export interface SkillResult {
  id: string;
  title: string;
  correct: number;
  total: number;
}

export interface GradeResult {
  correctCount: number;
  totalCount: number;
  scorePct: number;
  perSkill: SkillResult[];
  /** Qums the student got wrong or left blank (1-based). */
  missed: number[];
  /** Qums with no answer at all. */
  blank: number[];
}

/** Normalize any answer representation into the template's canonical
 *  "a|b|c" form: stringified parts, sorted, joined with "|". Pipe-joined
 *  strings are re-split so "3|0" and "0|3" canonicalize identically —
 *  the same comparison the practice engine performs after sorting. */
export function normalizeAnswer(answer: string | number | (string | number)[]): string {
  const parts = Array.isArray(answer) ? answer : String(answer).split('|');
  return parts.map(String).sort().join('|');
}

/** Grade a raw answers map ({ qN: "value" or "a|b" }) against a test key.
 *  Unanswered questions count as incorrect (same as the practice engine). */
export function gradeSubmission(key: TestKey, answers: Record<string, string>): GradeResult {
  const perSkill = new Map<string, SkillResult>();
  for (const g of key.groups) {
    perSkill.set(g.id, { id: g.id, title: g.title, correct: 0, total: 0 });
  }

  let correctCount = 0;
  const missed: number[] = [];
  const blank: number[] = [];

  for (const q of key.questions) {
    const skill = perSkill.get(q.gid);
    if (skill) skill.total += 1;

    const raw = answers[`q${q.qnum}`];
    const answered = typeof raw === 'string' && raw.length > 0;
    if (!answered) {
      blank.push(q.qnum);
      missed.push(q.qnum);
      continue;
    }

    if (normalizeAnswer(raw) === normalizeAnswer(q.answer)) {
      correctCount += 1;
      if (skill) skill.correct += 1;
    } else {
      missed.push(q.qnum);
    }
  }

  const totalCount = key.questions.length;
  return {
    correctCount,
    totalCount,
    scorePct: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0,
    perSkill: [...perSkill.values()],
    missed,
    blank,
  };
}

/** Questions answered wrong by 50%+ of the graded submissions — the
 *  "re-teach these" list. `graded` maps submission docId → GradeResult. */
export function mostMissedQuestions(
  graded: Record<string, GradeResult>,
  threshold = 0.5,
): { qnum: number; missedCount: number; rate: number }[] {
  const attempts = Object.keys(graded).length;
  if (attempts === 0) return [];
  const missedBy = new Map<number, number>();
  for (const result of Object.values(graded)) {
    for (const qnum of result.missed) missedBy.set(qnum, (missedBy.get(qnum) ?? 0) + 1);
  }
  return [...missedBy.entries()]
    .map(([qnum, missedCount]) => ({ qnum, missedCount, rate: missedCount / attempts }))
    .filter((m) => m.rate >= threshold)
    .sort((a, b) => b.rate - a.rate);
}
