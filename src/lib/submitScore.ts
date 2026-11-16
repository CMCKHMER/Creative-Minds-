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
// ACCOUNT REQUIRED (Nov 2026): only signed-in accounts submit scores. Guests
// can sample a couple of game rounds, but those runs stay on the device —
// no score rows, no ticker entries, no name prompt. This matches the
// firestore.rules drill_attempts branch (verified, authenticated writers
// only).
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
// PLAYER NAME (signed-in accounts only)
// ---------------------------------------------------------------------------
// Guests never reach Firestore any more (account-required policy): their
// sampled game rounds run locally and submitScore() short-circuits. Signed-in
// accounts resolve a display name from the session; when the session has no
// real name we ask ONCE (the answer self-heals cmc-student-name) — an email
// is never shown as a name.

/** Resolve the display name for a signed-in attempt; asks once when unknown.
 *
 *  Order:
 *    1. any name explicitly passed by the caller wins;
 *    2. a real stored account name wins;
 *    3. the one-time prompt (pre-filled with the friendly form of the account
 *       email) — the answer self-heals cmc-student-name;
 *    4. the friendly form of the account email (a signed-in completion is
 *       never dropped and never shows a raw address).
 */
async function resolveStudentName(explicit?: string): Promise<string | null> {
  if (explicit && explicit.trim()) return explicit.trim().slice(0, 40);
  const signedInEmail = localStorage.getItem('cmc-student-email') || '';
  const signedInName = localStorage.getItem('cmc-student-name') || '';
  if (signedInName.trim() && !looksLikeEmail(signedInName)) return signedInName.trim().slice(0, 40);
  const prompted = await promptForStudentName(friendlyNameFromEmail(signedInEmail));
  if (prompted) {
    try { localStorage.setItem('cmc-student-name', prompted.slice(0, 40)); } catch { /* private mode */ }
    return prompted;
  }
  return displayStudentName(signedInEmail) || 'Student';
}

let nameModalInFlight: Promise<string | null> | null = null;

/** One-time "What name should we show?" prompt for signed-in accounts whose
 *  session carries no display name. Resolves with the name, or null on skip. */
function promptForStudentName(suggestion = ''): Promise<string | null> {
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
      <div class="cmc-pn-card" role="dialog" aria-modal="true" aria-label="What name should we show?">
        <h3><span class="cmc-pn-dot"></span>What name should we show?</h3>
        <p>Your scores from games &amp; activities appear on the live ticker and leaderboards.</p>
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
 * - Guest (not signed in): NOTHING is written. Guests may sample a couple of
 *   game rounds locally, but scores require an account (see gameAccess.ts).
 * - The submission is non-blocking — failures are logged to the console
 *   as a warning but never throw, so the calling component's UI flow
 *   (e.g., showing a results screen) is never disrupted by a network
 *   blip or by rules that haven't been republished yet.
 */
export async function submitScore(input: ScoreSubmission): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  // ACCOUNT REQUIRED: guests may sample a couple of rounds, but nothing they
  // do is written to Firestore — no score rows, no name prompt, no ticker
  // entry. Signed-in accounts only from here on.
  const idToken = await getValidIdToken().catch(() => null);
  if (!idToken) return null;

  const idTokenUid = uidFromIdToken(idToken);
  if (!idTokenUid) return null; // unreadable token — nothing to attribute
  const studentUid = localStorage.getItem('cmc-student-uid') || idTokenUid;
  if (studentUid !== idTokenUid) return null; // stale/mismatched local mirror

  const studentName = await resolveStudentName(input.studentName);
  if (!studentName) return null;

  const docId = await postAttempt(input, studentName, studentUid, idToken);
  if (docId) announceSubmission();
  return docId;
}

/** uid claim of a Firebase ID token (JWT payload `user_id` / `sub`), or ''. */
export function uidFromIdToken(idToken: string | null): string {
  try {
    const payload = (idToken || '').split('.')[1];
    if (!payload) return '';
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    // The payload is UTF-8 (display names can be Khmer) — decode it as such.
    const json = new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)));
    const claims = JSON.parse(json) as { user_id?: unknown; sub?: unknown };
    const uid = claims.user_id ?? claims.sub;
    return typeof uid === 'string' ? uid : '';
  } catch {
    return '';
  }
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
