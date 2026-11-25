// Types for public/assets/js/cmc-ai-logic.js — the lazy Firebase AI Logic
// helper on the static TOEFL speaking page.
declare module '*cmc-ai-logic.js' {
  export type AiReason = 'not-configured' | 'no-audio' | 'too-large' | 'quota' | 'unavailable' | 'failed';

  export type AiResult =
    | { ok: true; text: string }
    | { ok: false; reason: AiReason; detail?: string };

  export interface RecordingInput {
    blob: Blob;
    targetSeconds: number;
    band: number;
    stats?: Record<string, number>;
  }

  /** Site key from window.CMC_APPCHECK_KEY or site_config/ai (cached). */
  export function resolveAppCheckKey(): Promise<string>;
  /** Fire the key read once on page load. */
  export function refreshAiConfig(): Promise<string>;
  /** Test hook: forget the cached key. */
  export function resetAiConfigCache(): void;
  export function aiConfigured(): boolean;
  export function remainingUses(now?: number): number;
  export function blobToBase64(blob: Blob): Promise<string>;
  export function speechPrompt(input: {
    targetSeconds: number;
    band: number;
    stats?: Record<string, number>;
  }): string;
  export function askAboutRecording(input: RecordingInput): Promise<AiResult>;

  export const AI_MODEL: string;
  export const AI_DAILY_LIMIT: number;

  const api: {
    aiConfigured: typeof aiConfigured;
    resolveAppCheckKey: typeof resolveAppCheckKey;
    refreshAiConfig: typeof refreshAiConfig;
    askAboutRecording: typeof askAboutRecording;
    remainingUses: typeof remainingUses;
    speechPrompt: typeof speechPrompt;
    blobToBase64: typeof blobToBase64;
    AI_MODEL: string;
    AI_DAILY_LIMIT: number;
  };
  export default api;
}
