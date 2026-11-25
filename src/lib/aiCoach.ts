// AI Coach — the optional "second opinion" on top of AI Phase 01's rubric.
//
// The rubric engine (public/assets/js/cmc-writing-rubric.js) is deterministic:
// it counts words, linkers, structure and mechanics, cheaply and privately. What
// it cannot do is *read* an argument and say "your second reason is weaker than
// your first". That is what this module asks a model for — once per click, never
// automatically — using Firebase AI Logic (the owner's Firebase project), so no
// personal API key or billing account is held in the client.
//
// GUARD RAILS
//   · opt-in: only runs when the student taps "Ask the AI coach";
//   · capped: AI_COACH_DAILY_LIMIT calls per browser per day;
//   · short: the essay is trimmed to AI_COACH_MAX_ESSAY characters;
//   · honest: the model is told the deterministic band and told NOT to invent a
//     new score — it explains, it does not grade;
//   · degradable: if AI Logic is not enabled (App Check / backend), the caller
//     gets { ok:false, reason:'unavailable' } and the UI keeps working.
//
// To switch it on in the Firebase console (owner, ~5 minutes):
//   1. Build → AI Logic → get started → backend "Gemini Developer API".
//   2. App Check → register the web app with reCAPTCHA Enterprise and add the
//      site key to App Check initialisation (Firebase requires App Check for
//      AI Logic calls from a browser).
//   3. Nothing to redeploy here — the SDK loads lazily on first tap.

import { getFirebaseApp } from './firebase';

export const AI_COACH_DAILY_LIMIT = 10;
export const AI_COACH_MAX_ESSAY = 2400;

const USAGE_KEY = 'cmc-ai-coach-usage';
const MODEL = (import.meta.env.VITE_AI_COACH_MODEL as string | undefined) || 'gemini-2.5-flash';

export interface CoachRequest {
  essay: string;
  band: number;
  traits?: Record<string, number>;
  fixes?: string[];
}

export type CoachResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'no-essay' | 'quota' | 'unavailable' | 'failed'; detail?: string };

interface Usage {
  day: string;
  count: number;
}

function today(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function readUsage(now = Date.now()): Usage {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Usage>) : null;
    if (!parsed || parsed.day !== today(now)) return { day: today(now), count: 0 };
    return { day: parsed.day, count: Number(parsed.count) || 0 };
  } catch {
    return { day: today(now), count: 0 };
  }
}

function writeUsage(usage: Usage): void {
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  } catch {
    /* private mode — the cap then only lasts for the session */
  }
}

/** How many "ask the coach" taps are left today. */
export function remainingCoachUses(now = Date.now()): number {
  if (typeof localStorage === 'undefined') return AI_COACH_DAILY_LIMIT;
  return Math.max(0, AI_COACH_DAILY_LIMIT - readUsage(now).count);
}

/**
 * The prompt. Deliberately tight: the model adds judgement, not another score,
 * and is told the reader is a learner writing English as a second language.
 */
export function coachPrompt(request: CoachRequest): string {
  const essay = String(request.essay || '').trim().slice(0, AI_COACH_MAX_ESSAY);
  const traits = Object.entries(request.traits || {})
    .filter(([, value]) => Number.isFinite(value))
    .map(([key, value]) => `${key}: ${Number(value).toFixed(1)}/5`)
    .join(', ');
  const fixes = (request.fixes || []).slice(0, 3).join('; ');

  return [
    'You are a patient TOEFL writing coach for a Cambodian student who writes English as a second language.',
    'You will be given their e-mail response and an automatic rubric read-out.',
    '',
    `Automatic rubric band: ${Number(request.band).toFixed(1)} / 5.`,
    traits ? `Trait scores: ${traits}.` : '',
    fixes ? `The automatic checker already flagged: ${fixes}.` : '',
    '',
    'Do NOT give a new band or score. Do not rewrite the essay.',
    'Reply with exactly three sentences in plain English (CEFR B1, no idioms):',
    '1. the single strongest thing in the writing, quoting a short phrase from it;',
    '2. the one change that would improve it most, explained with an example phrase they could use;',
    '3. one sentence they should practise next time.',
    'If the text is too short to judge, say so in one sentence instead.',
    '',
    '--- STUDENT RESPONSE ---',
    essay || '(empty)',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/** Default generator: Firebase AI Logic, loaded lazily so it costs nothing
 *  until someone taps the button. Throws when AI Logic is not enabled. */
export function defaultGenerator(): (prompt: string) => Promise<string> {
  return async (prompt: string) => {
    const [{ getAI, getGenerativeModel, GoogleAIBackend }, app] = await Promise.all([
      import('firebase/ai'),
      getFirebaseApp(),
    ]);
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    const model = getGenerativeModel(ai, { model: MODEL });
    const result = await model.generateContent(prompt);
    return result.response.text();
  };
}

/**
 * Ask the model for a second opinion.
 *
 * @param request essay + the deterministic band it already has
 * @param deps.generator injected for tests (defaults to Firebase AI Logic)
 */
export async function askCoach(
  request: CoachRequest,
  deps: { generator?: (prompt: string) => Promise<string>; now?: number } = {},
): Promise<CoachResult> {
  const essay = String(request.essay || '').trim();
  if (essay.length < 40) return { ok: false, reason: 'no-essay' };

  const now = deps.now ?? Date.now();
  const usage = typeof localStorage === 'undefined' ? { day: today(now), count: 0 } : readUsage(now);
  if (usage.count >= AI_COACH_DAILY_LIMIT) return { ok: false, reason: 'quota' };

  const generate = deps.generator ?? defaultGenerator();
  try {
    const text = (await generate(coachPrompt({ ...request, essay }))).trim();
    if (!text) return { ok: false, reason: 'failed', detail: 'empty-response' };
    if (typeof localStorage !== 'undefined') writeUsage({ day: usage.day, count: usage.count + 1 });
    return { ok: true, text: text.slice(0, 900) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    // A missing/disabled AI Logic backend is the expected failure — surface it
    // as a calm "not enabled", not as a crash or a scary stack trace.
    const unavailable = /app ?check|permission|not (been )?(enabled|configured)|api key|400|401|403|404/i.test(detail);
    return { ok: false, reason: unavailable ? 'unavailable' : 'failed', detail: detail.slice(0, 200) };
  }
}

export const AI_COACH_MODEL = MODEL;
