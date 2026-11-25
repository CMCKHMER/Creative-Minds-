/* ============================================================
   CMC AI LOGIC — the optional "listen to my answer" call on the
   static TOEFL speaking page (AI Phase 01, second opinion).
   ------------------------------------------------------------
   The on-device rubric (cmc-speaking-rubric.js) can only hear the
   signal: pauses, pace, level, clipping. It cannot hear words. This
   module sends ONE recording to Gemini through Firebase AI Logic and
   returns three sentences about pronunciation and clarity.

   WHY IT IS A SEPARATE, LAZY MODULE
     · the Firebase SDK (~250 KB) loads only when a student taps the
       button — page load is untouched;
     · if App Check / AI Logic is not enabled the button never renders,
       so nobody taps a dead control;
     · the audio leaves the device only on that tap, never on record.

   SETUP (owner): see docs/ai-phase-01.md §4. In short:
     Firebase → Build → AI Logic → Gemini Developer API backend,
     Firebase → Build → App Check → reCAPTCHA Enterprise,
     then paste that site key into Firestore → site_config → ai → appCheckKey.
     Both this page and the React app read it from there on load, so the owner
     never needs a rebuild; window.CMC_APPCHECK_KEY / VITE_FIREBASE_APPCHECK_KEY
     still win when they are set.

   The React app has its own typed twin (src/lib/aiCoach.ts) with the same
   prompts and the same guards; the essay prompt is not duplicated here because
   essays are scored in the app, not on this page.
   ============================================================ */

const SDK_VERSION = '13.0.0';
const SDK_BASE = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDNUq0ru99XKh08D887Xk63h36MPOlXWwc',
  authDomain: 'creative-minds-cambodia.firebaseapp.com',
  projectId: 'creative-minds-cambodia',
  storageBucket: 'creative-minds-cambodia.firebasestorage.app',
  messagingSenderId: '519217757765',
  appId: '1:519217757765:web:23e086ba196b341ce2ed2c',
};

const MODEL = 'gemini-2.5-flash';
const DAILY_LIMIT = 10;
const USAGE_KEY = 'cmc-ai-coach-usage';
const MAX_BYTES = 5 * 1024 * 1024;

let sdkPromise = null;

// Public read / owner-only write, so the site key can be pasted into the
// Firebase console (Firestore → site_config → ai → appCheckKey) and take effect
// on the next page load — no rebuild, no redeploy. A reCAPTCHA Enterprise site
// key is public by design; the secret half never leaves Google.
const CONFIG_URL =
  'https://firestore.googleapis.com/v1/projects/creative-minds-cambodia/databases/(default)/documents/site_config/ai';

let keyPromise = null;

function inlineKey() {
  if (typeof window === 'undefined') return '';
  var key = window.CMC_APPCHECK_KEY;
  return typeof key === 'string' ? key.trim() : '';
}

/** The site key from the page global, else from site_config/ai (cached). */
export function resolveAppCheckKey() {
  if (keyPromise) return keyPromise;
  keyPromise = (async function () {
    var inline = inlineKey();
    if (inline) return inline;
    try {
      var res = await fetch(CONFIG_URL);
      if (!res.ok) return '';
      var data = await res.json();
      var fields = data && data.fields;
      var key = fields && fields.appCheckKey && fields.appCheckKey.stringValue;
      key = typeof key === 'string' ? key.trim() : '';
      if (key && typeof window !== 'undefined') window.CMC_APPCHECK_KEY = key;
      return key;
    } catch (error) {
      return '';
    }
  })();
  return keyPromise;
}

/** Called once on page load so the button is already decided when a student
 *  finishes recording (a 45-second answer is plenty of time for one read). */
export function refreshAiConfig() {
  return resolveAppCheckKey();
}

function appCheckKey() {
  return inlineKey();
}

/** Test hook: forget the cached key (a page load never needs this twice). */
export function resetAiConfigCache() {
  keyPromise = null;
}

/** True only when the owner has wired App Check — otherwise hide the button. */
export function aiConfigured() {
  return inlineKey().length > 0;
}

function usageToday(now) {
  const day = new Date(now).toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || parsed.day !== day) return { day, count: 0 };
    return { day, count: Number(parsed.count) || 0 };
  } catch {
    return { day, count: 0 };
  }
}

function recordUse(usage) {
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify({ day: usage.day, count: usage.count + 1 }));
  } catch { /* private mode */ }
}

export function remainingUses(now = Date.now()) {
  return Math.max(0, DAILY_LIMIT - usageToday(now).count);
}

/** Chunked base64 (big recordings would blow the call stack with spread). */
export function blobToBase64(blob) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onerror = function () { reject(reader.error || new Error('read-failed')); };
    reader.onload = function () {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

/** The prompt: same contract as the app — no new band, three plain sentences. */
export function speechPrompt(input) {
  const stats = Object.keys(input.stats || {})
    .filter(function (k) { return Number.isFinite(input.stats[k]); })
    .map(function (k) { return k + ': ' + Math.round(Number(input.stats[k]) * 100) / 100; })
    .join(', ');
  return [
    'You are a TOEFL speaking coach listening to a Cambodian student who speaks English as a second language.',
    'The task was ' + Math.round(input.targetSeconds) + ' seconds long.',
    'An on-device signal check gave ' + Number(input.band).toFixed(1) + ' / 5 for delivery' +
      (stats ? ' (' + stats + ')' : '') + '.',
    '',
    'Listen to the recording and reply with exactly three sentences, plain English (CEFR B1):',
    '1. one pronunciation or word-stress problem you actually heard, quoting the word;',
    '2. one thing that made the answer easy or hard to follow;',
    '3. one drill to practise this week.',
    'Do not give a band or a score. If the audio is silent or too short, say that in one sentence.',
  ].join('\n');
}

/** Load the Firebase modular SDK from Google's CDN, once. */
async function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = Promise.all([
      import(`${SDK_BASE}/firebase-app.js`),
      import(`${SDK_BASE}/firebase-ai.js`),
      import(`${SDK_BASE}/firebase-app-check.js`),
    ]).then(function (mods) {
      const appMod = mods[0];
      const aiMod = mods[1];
      const checkMod = mods[2];
      const app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(FIREBASE_CONFIG);
      if (appCheckKey()) {
        try {
          checkMod.initializeAppCheck(app, {
            provider: new checkMod.ReCaptchaEnterpriseProvider(appCheckKey()),
            isTokenAutoRefreshEnabled: true,
          });
        } catch (e) { /* already initialised on a previous tap */ }
      }
      const ai = aiMod.getAI(app, { backend: new aiMod.GoogleAIBackend() });
      return { aiMod, ai };
    });
  }
  return sdkPromise;
}

function classify(detail) {
  const text = String(detail || '').toLowerCase();
  if (/app ?check|recaptcha/.test(text)) return 'app-check';
  if (/not (been )?(enabled|configured|found|used)|has not been used|permission|api key|403|404|unauthenticated/.test(text)) {
    return 'unavailable';
  }
  return 'failed';
}

/**
 * Ask the model to listen to one recording.
 *
 * @param {{ blob: Blob, targetSeconds: number, band: number,
 *           stats?: Record<string, number> }} input
 * @returns {Promise<{ok: true, text: string} |
 *   {ok: false, reason: 'not-configured'|'no-audio'|'too-large'|'quota'|'unavailable'|'failed', detail?: string}>}
 */
export async function askAboutRecording(input) {
  if (!(await resolveAppCheckKey())) return { ok: false, reason: 'not-configured' };
  if (!input || !input.blob || !input.blob.size) return { ok: false, reason: 'no-audio' };
  if (input.blob.size > MAX_BYTES) return { ok: false, reason: 'too-large' };

  const now = Date.now();
  const usage = usageToday(now);
  if (usage.count >= DAILY_LIMIT) return { ok: false, reason: 'quota' };

  let base64;
  try {
    base64 = await blobToBase64(input.blob);
  } catch (error) {
    return { ok: false, reason: 'failed', detail: 'could not read the recording' };
  }

  try {
    const { aiMod, ai } = await loadSdk();
    const model = aiMod.getGenerativeModel(ai, { model: MODEL });
    const result = await model.generateContent([
      {
        type: 'inlineData',
        inlineData: { mimeType: input.blob.type || 'audio/webm', data: base64 },
      },
      {
        type: 'text',
        text: speechPrompt({
          targetSeconds: input.targetSeconds,
          band: input.band,
          stats: input.stats,
        }),
      },
    ]);
    const text = String(result.response.text() || '').trim();
    if (!text) return { ok: false, reason: 'failed', detail: 'empty response' };
    recordUse(usage);
    return { ok: true, text: text.slice(0, 900) };
  } catch (error) {
    const detail = error && error.message ? error.message : String(error);
    return { ok: false, reason: classify(detail), detail: detail.slice(0, 200) };
  }
}

export const AI_MODEL = MODEL;
export const AI_DAILY_LIMIT = DAILY_LIMIT;

export default {
  aiConfigured,
  resolveAppCheckKey,
  refreshAiConfig,
  askAboutRecording,
  remainingUses,
  speechPrompt,
  blobToBase64,
  AI_MODEL,
  AI_DAILY_LIMIT,
};
