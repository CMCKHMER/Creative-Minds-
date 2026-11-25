// Types for public/assets/js/cmc-speaking-rubric.js (plain ES module shipped to
// the static TOEFL speaking page). Keep in step with the engine's return value.
declare module '*cmc-speaking-rubric.js' {
  export type SpeechTone = 'high' | 'med' | 'low';

  export interface SpeechFix {
    tone: SpeechTone;
    title: string;
    detail: string;
  }

  export interface SpeechAnalysis {
    ok: boolean;
    reason?: 'silent' | 'short';
    seconds: number;
    speechSeconds: number;
    pauseRatio: number;
    pauses: number;
    longPauses: number;
    longestPause: number;
    wordsPerMinute: number;
    level: number;
    levelVariation: number;
    clipping: number;
    trailingSilence: number;
    scores: { fluency: number; clarity: number; pacing: number };
    band: number;
    fixes: SpeechFix[];
    strengths: string[];
  }

  export interface SpeechOptions {
    targetSeconds?: number;
    kind?: 'repeat' | 'interview';
  }

  export function analyseSpeech(pcm: Float32Array, sampleRate: number, options?: SpeechOptions): SpeechAnalysis;
  export function analyseAudioBlob(blob: Blob, options?: SpeechOptions): Promise<SpeechAnalysis | null>;
  export const RUBRIC_VERSION: string;

  const api: {
    analyseSpeech: typeof analyseSpeech;
    analyseAudioBlob: typeof analyseAudioBlob;
    RUBRIC_VERSION: string;
  };
  export default api;
}
