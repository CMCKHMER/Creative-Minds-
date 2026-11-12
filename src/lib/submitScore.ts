// Universal score submission for the CMC React app.
// Used by MiniMockTest, LearningGames, and any other React component
// that generates a score. Submits to Firestore via the REST API using
// the signed-in student's Firebase ID token (the same one stored in
// localStorage by firebaseAuth.ts and used by the static HTML
// worksheets).
//
// This is the React-side equivalent of the inline Firestore POST block
// injected into the standalone HTML worksheets by scripts/add_role_indicator.py
// and scripts/process_rfc2_files.py — same field schema, same auth
// pattern, same drill_attempts collection. The dashboard + ticker
// aggregate from this single collection.
//
// GUEST PLAY (Nov 2026): students used to need a verified account before
// ANY stat reached Firestore, so guests who played the games never
// appeared on the homepage ticker / leaderboards. Now guests submit
// too: their name comes from this one-time "Who's playing?" prompt
// (persisted in localStorage.cmc-player-name) and the row is written
// WITHOUT an Authorization header — the security rules carry a matching
// validated guest branch (studentUid must be empty, name/fields size-
// and range-checked; see firestore.rules → match /drill_attempts).
//
// INSTANT TICKER: every successful POST dispatches the window event
// "cmc-drill-submitted" so TickerBanner can refresh within seconds
// instead of waiting for its next 5-minute poll.

import { FIREBASE_PROJECT_ID, getValidIdToken } from './firebaseAuth';
import { displayStudentName, friendlyNameFromEmail, looksLikeEmail } from './studentName';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export type DrillSource =
  | 'biweek-planner'
  | 'toefl-ibt'
  | 'learning-games'
  | 'rfc3'
  | 'rfc2'
  | 'mini-mock'
  | 'syntax-clash'
  | 'tense-master'
  | 'writequest'
  // The Brain Lounge arcade page (#brain-lounge) — cartridges in
  // src/games/registry.ts submit here (e.g. brickforge levels reached).
  | 'brain-lounge'
  // Logged by the private (teacher-assigned) test pages after a successful
  // test_submissions POST — completion only, score 0 until the teacher grades.
  | 'assignment';

export interface ScoreSubmission {
  drillSlug: string;
  drillTitle: string;
  drillSource: DrillSource;
  studentName?: string; // overrides localStorage.cmc-student-name if provided
  scorePct: number;
  correctCount: number;
  totalCount: number;
  durationSeconds?: number | null;
}

// ---------------------------------------------------------------------------
// PLAYER NAME (guests)
// ---------------------------------------------------------------------------
// One lightweight modal, shown once per browser, asking who is playing.
// The answer persists in localStorage.cmc-player-name for 90 days so every
// later game/attempt submits silently. Vanilla DOM on purpose — submitScore
// is a lib module shared by every game surface, React or not.

const PLAYER_NAME_KEY = 'cmc-player-name';
const PLAYER_NAME_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function readStoredPlayerName(): string {
  try {
    const raw = localStorage.getItem(PLAYER_NAME_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { name?: string; at?: number };
    if (!parsed?.name || typeof parsed.at !== 'number') return '';
    if (Date.now() - parsed.at > PLAYER_NAME_TTL_MS) {
      localStorage.removeItem(PLAYER_NAME_KEY);
      return '';
    }
    return parsed.name.slice(0, 40);
  } catch {
    return '';
  }
}

function storePlayerName(name: string): void {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, JSON.stringify({ name, at: Date.now() }));
  } catch {
    /* private mode — the name just won't be remembered */
  }
}

let nameModalInFlight: Promise<string | null> | null = null;

/** The one-time "Who's playing?" modal. Resolves with the name, or null on skip.
 *  `suggestion` pre-fills the input (e.g. the friendly form of the signed-in
 *  account's email) so one tap on Save gives a real name. */
function promptForPlayerName(suggestion = ''): Promise<string | null> {
  if (nameModalInFlight) return nameModalInFlight;

  nameModalInFlight = new Promise<string | null>((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }

    const host = document.createElement('div');
    host.setAttribute('data-cmc-player-name-modal', '');
    host.innerHTML = `
      <style>
        [data-cmc-player-name-modal] { position: fixed; inset: 0; z-index: 2147483000;
          display: flex; align-items: center; justify-content: center; padding: 20px;
          background: rgba(2, 8, 20, 0.72); backdrop-filter: blur(4px); }
        [data-cmc-player-name-modal] .cmc-pn-card { width: 100%; max-width: 380px;
          background: linear-gradient(160deg, #0d1b2e 0%, #0a1424 100%);
          border: 1px solid rgba(148, 197, 255, 0.22); border-radius: 18px;
          box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.8);
          padding: 22px 22px 18px; font-family: inherit; color: #e2e8f0; }
        [data-cmc-player-name-modal] h3 { margin: 0 0 6px; font-size: 17px; font-weight: 800;
          letter-spacing: 0.01em; display: flex; align-items: center; gap: 8px; }
        [data-cmc-player-name-modal] h3 .cmc-pn-dot { width: 9px; height: 9px; border-radius: 99px;
          background: #22d3ee; box-shadow: 0 0 10px rgba(34, 211, 238, 0.9); flex: none; }
        [data-cmc-player-name-modal] p { margin: 0 0 14px; font-size: 12.5px; line-height: 1.55; color: #94a3b8; }
        [data-cmc-player-name-modal] input { width: 100%; box-sizing: border-box; padding: 10px 12px;
          font-size: 14px; font-weight: 600; color: #f1f5f9; background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(148, 197, 255, 0.28); border-radius: 10px; outline: none; }
        [data-cmc-player-name-modal] input:focus { border-color: rgba(34, 211, 238, 0.65);
          box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.18); }
        [data-cmc-player-name-modal] .cmc-pn-row { display: flex; gap: 8px; margin-top: 14px; }
        [data-cmc-player-name-modal] button { flex: 1; padding: 10px 12px; font-size: 13px; font-weight: 700;
          border-radius: 10px; border: 1px solid transparent; cursor: pointer; }
        [data-cmc-player-name-modal] .cmc-pn-save { background: linear-gradient(135deg, #22d3ee, #0ea5e9);
          color: #04121f; border: none; }
        [data-cmc-player-name-modal] .cmc-pn-save:hover { filter: brightness(1.08); }
        [data-cmc-player-name-modal] .cmc-pn-skip { background: rgba(255, 255, 255, 0.05);
          border-color: rgba(148, 163, 184, 0.25); color: #94a3b8; }
        [data-cmc-player-name-modal] .cmc-pn-skip:hover { color: #cbd5e1; }
      </style>
      <div class="cmc-pn-card" role="dialog" aria-modal="true" aria-label="Who is playing?">
        <h3><span class="cmc-pn-dot"></span>Who's playing?</h3>
        <p>Enter a name and your scores from games &amp; activities will show up on the live ticker and leaderboards.</p>
        <input class="cmc-pn-input" maxlength="40" placeholder="Your name…" autocomplete="off" />
        <div class="cmc-pn-row">
          <button type="button" class="cmc-pn-skip">Skip</button>
          <button type="button" class="cmc-pn-save">Save</button>
        </div>
      </div>`;

    const root = document.body;
    const input = host.querySelector<HTMLInputElement>('.cmc-pn-input')!;
    if (suggestion) input.value = suggestion.slice(0, 40);
    const done = (value: string | null) => {
      host.remove();
      document.removeEventListener('keydown', onKey, true);
      nameModalInFlight = null;
      resolve(value);
    };
    const save = () => {
      const name = input.value.trim().slice(0, 40);
      done(name || null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      else if (e.key === 'Escape') { e.preventDefault(); done(null); }
    };

    host.querySelector('.cmc-pn-save')!.addEventListener('click', save);
    host.querySelector('.cmc-pn-skip')!.addEventListener('click', () => done(null));
    document.addEventListener('keydown', onKey, true);
    root.appendChild(host);
    input.focus();
  });

  return nameModalInFlight;
}

/** Resolve the display name for an attempt; opens the modal when unknown.
 *
 *  An EMAIL IS NEVER A NAME (owner report: "students that sign in with their
 *  gmail are not showing names on the completion ticker"). Sessions created
 *  before the fix may still carry the account address in cmc-student-name —
 *  such values are treated as unknown here:
 *    1. any name explicitly passed by the caller wins;
 *    2. a real stored account name wins;
 *    3. a remembered guest name (cmc-player-name) wins;
 *    4. the "Who's playing?" modal asks once — pre-filled with the friendly
 *       form of the account email so signed-in students get a real name with
 *       one tap — and the answer self-heals cmc-student-name for good;
 *    5. signed-in fallback: the friendly form of the account email (a signed-
 *       in completion is NEVER dropped and NEVER shows a raw email);
 *    6. guests who skip everything return null — recorded as 'Guest'.
 */
async function resolveStudentName(explicit?: string): Promise<string | null> {
  if (explicit && explicit.trim()) return explicit.trim().slice(0, 40);
  const signedInEmail = localStorage.getItem('cmc-student-email') || '';
  const signedIn = !!localStorage.getItem('cmc-student-uid');
  const signedInName = localStorage.getItem('cmc-student-name') || '';
  if (signedInName.trim() && !looksLikeEmail(signedInName)) return signedInName.trim().slice(0, 40);
  const remembered = readStoredPlayerName();
  if (remembered && !looksLikeEmail(remembered)) return remembered;
  const prompted = await promptForPlayerName(signedIn ? friendlyNameFromEmail(signedInEmail) : ''); // null = skipped
  if (prompted) {
    if (signedIn) {
      // Self-heal the account's display name so later submissions (React or
      // the static worksheets) never ask — or fall back — again.
      try { localStorage.setItem('cmc-student-name', prompted.slice(0, 40)); } catch { /* private mode */ }
    } else {
      storePlayerName(prompted);
    }
    return prompted;
  }
  if (signedIn) {
    // Skipped, but signed in — derive a readable name from the account
    // instead of dropping the completion (the old code returned null here,
    // so these students never appeared on the ticker at all).
    return displayStudentName(signedInEmail) || 'Student';
  }
  return null;
}

// ---------------------------------------------------------------------------
// SUBMISSION
// ---------------------------------------------------------------------------

/** Lets TickerBanner (and anything else) refresh the moment a stat lands. */
function announceSubmission(): void {
  try {
    window.dispatchEvent(new CustomEvent('cmc-drill-submitted'));
  } catch {
    /* older engines — the 5-minute poll still picks the stat up */
  }
}

/**
 * Submit a drill attempt to Firestore via the REST API.
 *
 * Behavior:
 * - Signed in: POSTs to `drill_attempts` with the Firebase ID token as the
 *   `Authorization: Bearer` header and the student's real uid. Firestore
 *   security rules require `request.auth != null` and a matching uid on
 *   this path.
 * - Guest (not signed in): the row is written WITHOUT an Authorization
 *   header and with an empty studentUid — allowed by the validated guest
 *   branch in firestore.rules. The display name comes from the one-time
 *   "Who's playing?" prompt (or Skip → "Guest").
 * - The submission is non-blocking — failures are logged to the console
 *   as a warning but never throw, so the calling component's UI flow
 *   (e.g., showing a results screen) is never disrupted by a network
 *   blip or by rules that haven't been republished yet.
 */
export async function submitScore(input: ScoreSubmission): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const idToken = await getValidIdToken().catch(() => null);
  const signedIn = !!idToken;

  const studentName = await resolveStudentName(input.studentName);
  if (!studentName) {
    // No name and the prompt was skipped — still record the play as
    // "Guest" so the ticker/leaderboard reflects the activity.
    if (!signedIn) {
      const docId = await postAttempt(input, 'Guest', '', null);
      if (docId) announceSubmission();
      return docId;
    }
    return null; // signed in but truly no name available — leave silently
  }

  const studentUid = signedIn ? localStorage.getItem('cmc-student-uid') || '' : '';
  const docId = await postAttempt(input, studentName, studentUid, idToken);
  if (docId) announceSubmission();
  return docId;
}

async function postAttempt(
  input: ScoreSubmission,
  studentName: string,
  studentUid: string,
  idToken: string | null,
): Promise<string | null> {
  const classId = studentUid ? localStorage.getItem('cmc-student-classId') || '' : '';

  const body = {
    fields: {
      drillSlug: { stringValue: String(input.drillSlug).slice(0, 80) },
      drillTitle: { stringValue: String(input.drillTitle).slice(0, 120) },
      drillSource: { stringValue: String(input.drillSource).slice(0, 40) },
      studentName: { stringValue: studentName },
      studentUid: { stringValue: studentUid },
      classId: classId ? { stringValue: classId } : { nullValue: null },
      scorePct: { integerValue: String(Math.max(0, Math.min(100, Math.round(input.scorePct)))) },
      correctCount: { integerValue: String(Math.max(0, Math.round(input.correctCount))) },
      totalCount: { integerValue: String(Math.max(0, Math.round(input.totalCount))) },
      durationSeconds: input.durationSeconds != null
        ? { integerValue: String(Math.max(0, Math.round(input.durationSeconds))) }
        : { nullValue: null },
      submittedAt: { timestampValue: new Date().toISOString() },
    },
  };

  try {
    const res = await fetch(`${FIRESTORE_BASE}/drill_attempts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[submitScore] Firestore POST failed:', err?.error?.message || `HTTP ${res.status}`);
      return null;
    }
    const data = await res.json().catch(() => ({}));
    // Firestore returns { name: 'projects/.../documents/drill_attempts/{id}' }
    return data.name ? data.name.split('/').pop() : null;
  } catch (e) {
    console.warn('[submitScore] network error:', e);
    return null;
  }
}

/**
 * Submit a score and also fire the GA4 event. Combines analytics
 * tracking + Firestore score recording. Safe to call from any
 * component that just finished scoring an activity.
 */
export async function submitScoreWithAnalytics(input: ScoreSubmission): Promise<void> {
  // Fire GA4 event (non-blocking)
  import('./analytics').then(({ trackDrillComplete }) => {
    trackDrillComplete({
      drillSlug: input.drillSlug,
      drillTitle: input.drillTitle,
      source: input.drillSource as any,
      scorePct: input.scorePct,
      correct: input.correctCount,
      total: input.totalCount,
      durationSeconds: input.durationSeconds ?? 0,
    });
  }).catch(() => {});

  // Submit to Firestore
  await submitScore(input);
}
