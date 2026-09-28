import type { MiniMockQuestion, MiniMockSkill } from '../data/miniMockTest';

export function countCorrect(questions: MiniMockQuestion[], answers: Record<string, number>): number {
  return questions.filter((question) => answers[question.id] === question.correctIndex).length;
}

export function scoreBySkill(
  skill: MiniMockSkill,
  questions: MiniMockQuestion[],
  answers: Record<string, number>,
): { correct: number; total: number } {
  const items = questions.filter((question) => question.skill === skill);
  return {
    correct: items.filter((question) => answers[question.id] === question.correctIndex).length,
    total: items.length,
  };
}

export function formatTestTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, '0');
  const remainder = (safeSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}