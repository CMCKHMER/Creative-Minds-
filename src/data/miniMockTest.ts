export type MiniMockSkill = 'Reading' | 'Listening' | 'Language Use';

export interface MiniMockQuestion {
  id: string;
  skill: MiniMockSkill;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  passage?: string[];
  audioScript?: string;
}

export const MINI_MOCK_TIME_SECONDS = 8 * 60;
export const MINI_MOCK_SKILLS: MiniMockSkill[] = ['Reading', 'Listening', 'Language Use'];

// Validate the member-only payload before using server-provided question data.
export function parseMiniMockQuestions(value: unknown): MiniMockQuestion[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) return null;
  const ids = new Set<string>();

  for (const candidate of value) {
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) return null;
    const question = candidate as Record<string, unknown>;
    const allowedKeys = new Set(['id', 'skill', 'prompt', 'choices', 'correctIndex', 'explanation', 'passage', 'audioScript']);
    if (Object.keys(question).some((key) => !allowedKeys.has(key))) return null;
    if (typeof question.id !== 'string' || !question.id || question.id.length > 80 || ids.has(question.id)) return null;
    if (typeof question.skill !== 'string' || !MINI_MOCK_SKILLS.includes(question.skill as MiniMockSkill)) return null;
    if (typeof question.prompt !== 'string' || !question.prompt || question.prompt.length > 1200) return null;
    if (!Array.isArray(question.choices) || question.choices.length < 2 || question.choices.length > 6) return null;
    if (!question.choices.every((choice) => typeof choice === 'string' && choice.length <= 1200)) return null;
    if (!Number.isInteger(question.correctIndex) || Number(question.correctIndex) < 0 || Number(question.correctIndex) >= question.choices.length) return null;
    if (typeof question.explanation !== 'string' || question.explanation.length > 1800) return null;
    if (question.passage !== undefined && (!Array.isArray(question.passage) || !question.passage.every((part) => typeof part === 'string' && part.length <= 6000))) return null;
    if (question.audioScript !== undefined && (typeof question.audioScript !== 'string' || question.audioScript.length > 6000)) return null;
    ids.add(question.id);
  }

  return value as MiniMockQuestion[];
}