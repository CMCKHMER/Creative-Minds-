// Types for public/assets/js/cmc-writing-rubric.js — a plain ES module that
// ships to the static TOEFL page, so tsc (which only includes src/) needs this
// shim. Keep it in step with the engine's return value.
declare module '*cmc-writing-rubric.js' {
  export type RubricTone = 'high' | 'med' | 'low';

  export interface RubricFix {
    tone: RubricTone;
    title: string;
    detail: string;
  }

  export interface EssayAnalysis {
    ok: boolean;
    reason?: string;
    words: number;
    sentences: number;
    paragraphs: number;
    avgSentence: number;
    uniqueRatio: number;
    connectives: { count: number; unique: number; used: string[] };
    keywords: { coverage: number; missing: string[] };
    mechanics: {
      startsWithCapital: boolean;
      endsWithPunctuation: boolean;
      lowercaseI: number;
      doubleSpaces: number;
    };
    scores: { task: number; development: number; coherence: number; language: number };
    band: number;
    estimate: number;
    fixes: RubricFix[];
    strengths: string[];
  }

  export interface EssayOptions {
    kind?: 'email' | 'discussion';
    minWords?: number;
    prompt?: string;
  }

  export function analyseEssay(text: string, options?: EssayOptions): EssayAnalysis;
  export const RUBRIC_VERSION: string;

  const api: { analyseEssay: typeof analyseEssay; RUBRIC_VERSION: string };
  export default api;
}
