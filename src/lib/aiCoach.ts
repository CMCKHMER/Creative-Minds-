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
// SWITCHING IT ON (owner, in the Firebase console for creative-minds-cambodia):
//   1. Build → AI Logic → "Get started" → choose the **Gemini Developer API**
//      backend (not Vertex) → enable it for the web app.
//   2. Build → App Check → Apps → the web app → register with
//      **reCAPTCHA Enterprise**, copy the *site key*, and paste it into
//      Firestore → site_config → ai → appCheckKey.
//   3. Nothing to redeploy in code — the SDK is a lazy import on first tap, and
//      the key is read from site_config/ai on load (see resolveAppCheckKey()).
// How to know it worked: the trend card's status line shows
// "AI coach: connected" after you press "Test connection" (see probeAICoach).
// Each failure mode below maps to one console step, so the card tells you which
// step is still missing instead of failing silently.

import { getFirebaseApp } from './firebase';
import { FIREBASE_PROJECT_ID } from './firebaseAuth';

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
    const status = classifyAiFailure(detail);
    const reason =
      status === 'quota'
        ? ('quota' as const)
        : status === 'app-check' || status === 'not-enabled'
          ? ('unavailable' as const)
          : ('failed' as const);
    return { ok: false, reason, detail: detail.slice(0, 200) };
  }
}

export const AI_COACH_MODEL = MODEL;

// ── App Check ───────────────────────────────────────────────────────
// AI Logic refuses browser calls without an App Check token. The site key is
// public (it is a reCAPTCHA Enterprise key bound to the domain), so it ships in
// the bundle; registering the domain in the console is what makes it work.

const APPCHECK_ENV = (import.meta.env.VITE_FIREBASE_APPCHECK_KEY as string | undefined)?.trim() || '';

/** The owner's console, so every checklist step is one click away. */
const CONSOLE = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}`;

/** Firestore REST base — the public site config lives here too. */
const CONFIG_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

/** Where the site key came from, and — when there is none — exactly why. */
export type AppCheckKeyLookup =
  | { key: string; from: 'env' | 'window' | 'firestore' }
  | { key: ''; from: 'none'; problem: 'not-read' | 'rules' | 'network' | 'empty'; status?: number };

let keyPromise: Promise<AppCheckKeyLookup> | null = null;

/**
 * Find the reCAPTCHA Enterprise site key, from the first place that has one:
 *
 *   1. `VITE_FIREBASE_APPCHECK_KEY` (build-time env / GitHub secret);
 *   2. `window.CMC_APPCHECK_KEY` (a tiny inline script on a static page);
 *   3. `site_config/ai` → `appCheckKey` in Firestore — PUBLIC READ, owner-only
 *      write, so the key can be pasted into the Firebase console and take
 *      effect on the next page load, with no rebuild.
 *
 * A site key is public by design (it ships inside every client bundle); the
 * secret half never leaves Google. This is why the Firestore fallback is safe.
 *
 * The failure is reported precisely: a document the rules hide (403) is a very
 * different fix from a document with no field in it, and the owner should not
 * have to guess which one they are looking at.
 */
export function lookupAppCheckKey(): Promise<AppCheckKeyLookup> {
  if (keyPromise) return keyPromise;
  keyPromise = (async (): Promise<AppCheckKeyLookup> => {
    if (APPCHECK_ENV) return { key: APPCHECK_ENV, from: 'env' };
    const globalKey =
      typeof window !== 'undefined' && typeof (window as { CMC_APPCHECK_KEY?: unknown }).CMC_APPCHECK_KEY === 'string'
        ? String((window as { CMC_APPCHECK_KEY?: string }).CMC_APPCHECK_KEY).trim()
        : '';
    if (globalKey) return { key: globalKey, from: 'window' };
    if (typeof fetch !== 'function') return { key: '', from: 'none', problem: 'not-read' };
    try {
      const res = await fetch(`${CONFIG_BASE}/site_config/ai`);
      if (res.status === 403 || res.status === 401) {
        return { key: '', from: 'none', problem: 'rules', status: res.status };
      }
      if (!res.ok) return { key: '', from: 'none', problem: 'empty', status: res.status };
      const data = (await res.json().catch(() => null)) as {
        fields?: { appCheckKey?: { stringValue?: string } };
      } | null;
      const key = (data?.fields?.appCheckKey?.stringValue || '').trim();
      return key ? { key, from: 'firestore' } : { key: '', from: 'none', problem: 'empty' };
    } catch {
      return { key: '', from: 'none', problem: 'network' };
    }
  })();
  return keyPromise;
}

/** The key itself, or '' when there is none. */
export function resolveAppCheckKey(): Promise<string> {
  return lookupAppCheckKey().then((found) => found.key);
}

/** One sentence naming the fix, for the status line under "Test connection". */
export function describeMissingAppCheckKey(lookup: AppCheckKeyLookup): string {
  if (lookup.from !== 'none') return '';
  switch (lookup.problem) {
    case 'rules':
      return `site_config/ai could not be read (HTTP ${lookup.status}) — the database rules hide it, so publish firestore-min.rules and the key will be picked up on reload`;
    case 'empty':
      return 'site_config/ai was read but has no appCheckKey string field (and no VITE_FIREBASE_APPCHECK_KEY / window.CMC_APPCHECK_KEY)';
    case 'network':
      return 'site_config/ai could not be reached (network) — and no VITE_FIREBASE_APPCHECK_KEY / window.CMC_APPCHECK_KEY';
    default:
      return 'no App Check site key in site_config/ai, VITE_FIREBASE_APPCHECK_KEY or window.CMC_APPCHECK_KEY';
  }
}

/** Synchronous hint only: true when a build-time key exists. Use
 *  resolveAppCheckKey() before deciding whether AI is available. */
export function appCheckConfigured(): boolean {
  return APPCHECK_ENV.length > 0;
}

let appCheckPromise: Promise<'on' | 'no-key' | 'failed'> | null = null;

/** Initialise App Check exactly once. Returns what actually happened, so the
 *  diagnostics can say "key missing" instead of blaming the model. */
export async function ensureAppCheck(): Promise<'on' | 'no-key' | 'failed'> {
  const key = await resolveAppCheckKey();
  if (!key) return 'no-key';
  if (typeof window === 'undefined') return 'failed';
  appCheckPromise ??= (async () => {
    try {
      const [{ initializeAppCheck, ReCaptchaEnterpriseProvider }, app] = await Promise.all([
        import('firebase/app-check'),
        getFirebaseApp(),
      ]);
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(key),
        isTokenAutoRefreshEnabled: true,
      });
      return 'on' as const;
    } catch {
      return 'failed' as const;
    }
  })();
  return appCheckPromise;
}

// ── diagnostics ─────────────────────────────────────────────────────

export type AiStatus =
  | 'connected'
  | 'not-configured'
  | 'app-check'
  | 'not-enabled'
  | 'quota'
  | 'error';

export interface AiProbe {
  status: AiStatus;
  model: string;
  /** One line, in the owner's language, naming the exact console step. */
  message: string;
  /** What was actually returned, for debugging (never shown to a student). */
  detail?: string;
}

const STEP = {
  configured:
    'Set VITE_FIREBASE_APPCHECK_KEY (or VITE_FIREBASE_APP_ID) — or simply check Firebase → Build → AI Logic.',
  appCheck:
    'App Check is missing or rejected. Firebase → Build → App Check → register this web app with reCAPTCHA Enterprise, then paste the site key into Firestore → site_config → ai → field appCheckKey (no rebuild needed).',
  notEnabled:
    'AI Logic is not switched on. Firebase → Build → AI Logic → Get started → Gemini Developer API backend, enable it for this web app.',
  quota: 'This browser has used its reviews for today. It resets at midnight.',
  projectQuota:
    'The project’s AI quota is used up (HTTP 429) — the model refused the call, not the code. Rubric scores and the rest of the site are unaffected. Free-tier quota resets daily; if the message mentions prepayment credits, Google Cloud billing for creative-minds-cambodia has run out of credits.',
  error: 'The request failed before reaching the model — check the browser console and the project quota.',
} as const;

/** Classify a raw failure into the console step that fixes it. */
export function classifyAiFailure(detail: string): AiStatus {
  const text = detail.toLowerCase();
  if (/app ?check|recaptcha|appcheck/.test(text)) return 'app-check';
  // Quota comes before permissions: a 429 is a working install, not a missing
  // console step, and "out of credits" must never look like "not enabled".
  if (/\b429\b|quota|resource[_ ]?exhausted|rate.?limit|prepay|credits? (are |is )?depleted|billing|exceeded/.test(text)) {
    return 'quota';
  }
  if (/not (been )?(enabled|configured|found|used)|has not been used|permission|api key|api_key|403|404|unauthor|disabled/.test(text)) {
    return 'not-enabled';
  }
  return 'error';
}

/**
 * Prove whether AI Logic actually works, right now, from this browser.
 *
 * Costs nothing when it fails, and one generation when it succeeds. It does not
 * touch the student's daily cap (that is for real reviews).
 */
export async function probeAICoach(
  deps: { generator?: (prompt: string) => Promise<string> } = {},
): Promise<AiProbe> {
  const model = MODEL;

  const found = await lookupAppCheckKey();
  if (!found.key) {
    // App Check is mandatory for AI Logic in a browser: fail fast with the
    // instruction, instead of a confusing 403 from the model.
    return {
      status: 'app-check',
      model,
      message: STEP.appCheck,
      detail: describeMissingAppCheckKey(found),
    };
  }

  const appCheck = await ensureAppCheck();
  if (appCheck === 'failed') {
    return { status: 'app-check', model, message: STEP.appCheck, detail: 'App Check init threw' };
  }

  const generate = deps.generator ?? defaultGenerator();
  try {
    const text = await generate('Reply with the single word: ready');
    return {
      status: 'connected',
      model,
      message: `AI coach connected · ${model}`,
      detail: text.slice(0, 80),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const status = classifyAiFailure(detail);
    return {
      status,
      model,
      message:
        status === 'not-enabled'
          ? STEP.notEnabled
          : status === 'app-check'
            ? STEP.appCheck
            : status === 'quota'
              ? STEP.projectQuota
              : STEP.error,
      detail: detail.slice(0, 200),
    };
  }
}

/** The steps, in order, for a UI that wants to show the whole checklist. */
export const AI_SETUP_STEPS: ReadonlyArray<{ id: string; label: string; href: string }> = [
  {
    id: 'ai-logic',
    label: 'Firebase → Build → AI Logic → Get started (Gemini Developer API backend)',
    href: `${CONSOLE}/ailogic`,
  },
  {
    id: 'app-check',
    label: 'Firebase → Build → App Check → register the web app with reCAPTCHA Enterprise',
    href: `${CONSOLE}/appcheck/apps`,
  },
  {
    id: 'key',
    label: 'Firestore → site_config → ai → field appCheckKey = the reCAPTCHA site key (no rebuild)',
    href: `${CONSOLE}/firestore/data/~2Fsite_config~2Fai`,
  },
  {
    id: 'probe',
    label: 'Press “Test connection” on the home trend card — it should say connected',
    href: '',
  },
];

// ── speaking second opinion ────────────────────────────────────────
// The rubric can only hear the signal. A model can hear the words. Same gates
// as the essay coach: on demand, capped, explained in plain English.

export const AI_SPEECH_MAX_BYTES = 5 * 1024 * 1024;

export type SpeechCoachResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'no-audio' | 'too-large' | 'quota' | 'unavailable' | 'failed'; detail?: string };

/** Base64 for an inline audio part (chunked so big recordings do not blow the stack). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('read-failed'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

export function speechCoachPrompt(input: {
  targetSeconds: number;
  band: number;
  stats?: Record<string, number>;
}): string {
  const stats = Object.entries(input.stats || {})
    .filter(([, value]) => Number.isFinite(value))
    .map(([key, value]) => `${key}: ${Math.round(Number(value) * 100) / 100}`)
    .join(', ');
  return [
    'You are a TOEFL speaking coach listening to a Cambodian student who speaks English as a second language.',
    `The task was ${Math.round(input.targetSeconds)} seconds long.`,
    `An on-device signal check gave ${Number(input.band).toFixed(1)} / 5 for delivery${stats ? ` (${stats})` : ''}.`,
    '',
    'Listen to the recording and reply with exactly three sentences, plain English (CEFR B1):',
    '1. one pronunciation or word-stress problem you actually heard, quoting the word;',
    '2. one thing that made the answer easy or hard to follow;',
    '3. one drill to practise this week.',
    'Do not give a band or a score. If the audio is silent or too short, say that in one sentence.',
  ].join('\n');
}

/**
 * Ask the model to listen to one recorded answer.
 *
 * @param input audio (base64 + mime) and the deterministic band it already has
 * @param deps.generator injected for tests; the default posts an inline-audio part
 */
export async function askSpeechCoach(
  input: { audioBase64: string; mimeType: string; targetSeconds: number; band: number; stats?: Record<string, number> },
  deps: { generator?: (prompt: string, audio: { base64: string; mimeType: string }) => Promise<string>; now?: number } = {},
): Promise<SpeechCoachResult> {
  const base64 = String(input.audioBase64 || '').trim();
  if (base64.length < 64) return { ok: false, reason: 'no-audio' };
  if (base64.length * 0.75 > AI_SPEECH_MAX_BYTES) return { ok: false, reason: 'too-large' };

  const now = deps.now ?? Date.now();
  const usage = typeof localStorage === 'undefined' ? { day: today(now), count: 0 } : readUsage(now);
  if (usage.count >= AI_COACH_DAILY_LIMIT) return { ok: false, reason: 'quota' };

  const generate = deps.generator ?? defaultAudioGenerator();
  try {
    const text = (
      await generate(
        speechCoachPrompt({ targetSeconds: input.targetSeconds, band: input.band, stats: input.stats }),
        { base64, mimeType: input.mimeType || 'audio/webm' },
      )
    ).trim();
    if (!text) return { ok: false, reason: 'failed', detail: 'empty-response' };
    if (typeof localStorage !== 'undefined') writeUsage({ day: usage.day, count: usage.count + 1 });
    return { ok: true, text: text.slice(0, 900) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const status = classifyAiFailure(detail);
    return {
      ok: false,
      reason:
        status === 'quota'
          ? ('quota' as const)
          : status === 'not-enabled' || status === 'app-check'
            ? ('unavailable' as const)
            : ('failed' as const),
      detail: detail.slice(0, 200),
    };
  }
}

/** Default generator for audio: one inline-data part + the coach prompt. */
export function defaultAudioGenerator(): (
  prompt: string,
  audio: { base64: string; mimeType: string },
) => Promise<string> {
  return async (prompt, audio) => {
    const [{ getAI, getGenerativeModel, GoogleAIBackend }, app] = await Promise.all([
      import('firebase/ai'),
      getFirebaseApp(),
    ]);
    await ensureAppCheck();
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    const model = getGenerativeModel(ai, { model: MODEL });
    const result = await model.generateContent([
      { type: 'inlineData', inlineData: { mimeType: audio.mimeType, data: audio.base64 } },
      { type: 'text', text: prompt },
    ]);
    return result.response.text();
  };
}

