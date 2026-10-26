// Firebase Auth REST API — no SDK required for the sign-in call itself.
//
// The static HTML pages in public/ (toefl-ibt, biweek-planner, rfc3, etc.)
// already submit scores to Firestore using the Firebase ID Token stored in
// localStorage as `cmc-student-token`. This module produces the same
// token via the Firebase Auth REST API, so a React-side sign-in here is
// recognized by every standalone HTML page in the same project.
//
// After a successful REST sign-in the session is ALSO mirrored into the
// Firebase SDK auth state (lazy, fire-and-forget) so SDK surfaces — the
// dashboard's realtime listeners, the leaderboard — see the same user.
// Conversely studentAuth.ts persists this module's localStorage keys when
// the SDK path signs someone in. The two auth systems stay in sync.
//
// Expired ID tokens are refreshed through the securetoken grant using the
// persisted `cmc-student-refresh-token` (see getValidIdToken / ensureFreshSession).
//
// Config comes from ./firebase (single source of truth: env var with a
// verified fallback) so the REST and SDK paths can never disagree on the
// API key or project id.

import { firebaseConfig } from './firebase';

const API_KEY = (firebaseConfig.apiKey || '').trim();
export const FIREBASE_PROJECT_ID = (firebaseConfig.projectId || '').trim() || 'creative-minds-cambodia';

export const firebaseConfigured = Boolean(API_KEY);

const BASE = 'https://identitytoolkit.googleapis.com/v1';

export interface FirebaseSession {
  idToken: string;
  refreshToken: string;
  localId: string;
  email: string;
  displayName?: string | null;
  emailVerified: boolean;
  expiresIn: number; // seconds until idToken expires
  expiresAt: number; // epoch ms when idToken expires
  /** True when the verification email was dispatched successfully at
   *  sign-up; false means the UI should steer the user to "Resend". */
  verificationSent?: boolean;
  /**
   * Role — populated by signUpWithEmail / signInWithEmail after the
   * session is persisted to localStorage. Auto-detected from the email
   * domain (contains "edu" → 'teacher', else 'student'). Callers should
   * prefer `session.role` for UI affordances; `restoreSession()` is the
   * canonical source for non-React code.
   */
  role?: 'teacher' | 'student';
}

interface RawAuthResponse {
  idToken: string;
  refreshToken: string;
  localId: string;
  email: string;
  displayName?: string | null;
  emailVerified?: boolean;
  expiresIn?: string;
}

interface AuthError {
  error?: {
    code?: number;
    message?: string;
    errors?: { message?: string; reason?: string }[];
  };
}

// Firebase Identity Toolkit error codes — used to map raw API errors to
// friendly, actionable user-facing messages. See:
// https://firebase.google.com/docs/reference/rest/auth#section-error-codes
export type FirebaseAuthErrorCode =
  | 'EMAIL_EXISTS'
  | 'EMAIL_NOT_FOUND'
  | 'INVALID_PASSWORD'
  | 'WEAK_PASSWORD'
  | 'TOO_MANY_ATTEMPTS_TRY_LATER'
  | 'OPERATION_NOT_ALLOWED'
  | 'EMAIL_NOT_VERIFIED'
  | 'INVALID_EMAIL'
  | 'USER_DISABLED'
  | 'USER_NOT_FOUND'
  | 'EXPIRED_ID_TOKEN'
  | 'INVALID_ID_TOKEN'
  | 'unknown';

export interface FirebaseAuthError extends Error {
  code: FirebaseAuthErrorCode;
  rawMessage: string;
  /** Sign-ins blocked by the verification gate carry the (unpersisted)
   *  session so the UI can offer a working "Resend verification" button. */
  pendingSession?: FirebaseSession;
}

/**
 * Map a raw Firebase Auth REST error response to a friendly error with a
 * known code so the calling UI can branch on it (e.g., show a "Sign in
 * instead?" button when sign-up returns EMAIL_EXISTS).
 */
function toAuthError(e: unknown): FirebaseAuthError {
  const err = (e as AuthError)?.error;
  const raw = err?.message || (e instanceof Error ? e.message : 'Authentication failed.');

  // Firebase REST errors look like: "EMAIL_EXISTS" or "WEAK_PASSWORD : Password
  // should be at least 6 characters" or "INVALID_PASSWORD : The password is
  // invalid or the user does not have a password."
  const colonIdx = raw.indexOf(':');
  const codeRaw = colonIdx > 0 && colonIdx < 40 ? raw.slice(0, colonIdx).trim() : raw.trim();
  const detailRaw = colonIdx > 0 && colonIdx < 40 ? raw.slice(colonIdx + 1).trim() : '';

  const KNOWN_CODES: readonly string[] = [
    'EMAIL_EXISTS', 'EMAIL_NOT_FOUND', 'INVALID_PASSWORD', 'WEAK_PASSWORD',
    'TOO_MANY_ATTEMPTS_TRY_LATER', 'OPERATION_NOT_ALLOWED', 'INVALID_EMAIL',
    'USER_DISABLED', 'USER_NOT_FOUND', 'EXPIRED_ID_TOKEN', 'INVALID_ID_TOKEN',
    'EMAIL_NOT_VERIFIED',
  ];
  const code = (KNOWN_CODES.includes(codeRaw) ? codeRaw : 'unknown') as FirebaseAuthErrorCode;

  // Friendly messages — leave the specific actionable guidance to the
  // calling UI (it knows the current mode: sign-up vs sign-in vs reset).
  const friendly: Record<FirebaseAuthErrorCode, string> = {
    EMAIL_EXISTS: 'An account with this email already exists. Try signing in instead, or use "Forgot password?" to reset.',
    EMAIL_NOT_FOUND: 'No account exists with this email. Try creating a new account instead.',
    INVALID_PASSWORD: 'Wrong password. Double-check it, or use "Forgot password?" to reset.',
    WEAK_PASSWORD: 'Password must be at least 8 characters and not commonly used. Try a longer, more unique password.',
    TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts. Wait a minute or two and try again. (This protects against automated attacks.)',
    OPERATION_NOT_ALLOWED: 'Email/Password sign-in is not enabled for this Firebase project. Contact the site administrator.',
    EMAIL_NOT_VERIFIED: 'Please verify your email before signing in. We just sent a fresh verification link to your inbox — open it, click “Verify”, then sign in again.',
    INVALID_EMAIL: 'That email address looks malformed. Check for typos (e.g., missing @ or .com).',
    USER_DISABLED: 'This account has been disabled by an administrator. Contact the site administrator.',
    USER_NOT_FOUND: 'No account exists with this email. Try creating a new account instead.',
    EXPIRED_ID_TOKEN: 'Your session has expired. Please sign in again.',
    INVALID_ID_TOKEN: 'Your session is invalid. Please sign in again.',
    unknown: detailRaw || raw || 'Authentication failed. Please try again.',
  };

  const error = new Error(friendly[code]) as FirebaseAuthError;
  error.code = code;
  error.rawMessage = raw;
  return error;
}

/** For backward compatibility — anywhere that still calls parseAuthError. */
export function parseAuthError(e: unknown): string {
  return toAuthError(e).message;
}

async function authFetch(endpoint: string, body: Record<string, unknown>): Promise<FirebaseSession> {
  if (!API_KEY) {
    throw new Error('Firebase is not configured. Set VITE_FIREBASE_API_KEY in your .env.local.');
  }
  const url = `${BASE}${endpoint}?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data: RawAuthResponse | AuthError = await res.json().catch(() => ({}));
  if (!res.ok || !(data as RawAuthResponse).idToken) {
    throw toAuthError(data);
  }
  const r = data as RawAuthResponse;
  const expiresInSec = Number(r.expiresIn || '3600');
  return {
    idToken: r.idToken,
    refreshToken: r.refreshToken,
    localId: r.localId,
    email: r.email,
    displayName: r.displayName ?? null,
    // The REST responses (signUp / signInWithPassword) do NOT include an
    // emailVerified field — the server-minted `email_verified` claim inside
    // the ID token is the only reliable signal. Verified live Oct 2026.
    emailVerified: tokenEmailVerified(r.idToken) ?? r.emailVerified ?? false,
    expiresIn: expiresInSec,
    expiresAt: Date.now() + expiresInSec * 1000,
  };
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName?: string;
  school?: string;
  /** Account role ('teacher' | 'student'). Callers should pass the
   *  email-detected role here — NOT the free-text teaching-role select
   *  value — so the persisted `cmc-student-role` stays a clean enum. */
  role?: 'teacher' | 'student';
  /** Where the email-verification link should send the user. */
  continueUrl?: string;
  /** Free-text teaching role for the stored profile (e.g. "ESL / TOEFL
   *  Teacher"). Profile metadata only — never used for gating. */
  teachingRole?: string;
}

export async function signUpWithEmail(input: SignUpInput): Promise<FirebaseSession> {
  const session = await authFetch('/accounts:signUp', {
    email: input.email,
    password: input.password,
    returnSecureToken: true,
    displayName: input.displayName || undefined,
  });
  // SECURITY: every account starts unverified. A usable session is NOT
  // persisted to localStorage and NOT mirrored into the SDK auth state —
  // the user must first prove the address is theirs by clicking the
  // verification link in their inbox. The returned session exists only so
  // the calling UI can show the check-your-inbox state and offer "Resend".
  try {
    await sendEmailVerification(session.idToken, input.continueUrl);
    session.verificationSent = true;
  } catch {
    session.verificationSent = false; // UI steers the user to "Resend"
  }
  // Role detection (email domain contains "edu" → teacher) so callers can
  // tailor the success message. Profile fields (school, teaching role) are
  // re-collected by persistSession on the first VERIFIED sign-in.
  // Admin accounts always resolve to the teacher role — every gate opens.
  session.role = isAdminUid(session.localId)
    ? 'teacher'
    : input.role || detectRoleFromEmail(session.email);
  return session;
}

export interface SignInInput {
  email: string;
  password: string;
  /** Where a fresh verification email should land the user (unverified
   *  sign-ins only). */
  continueUrl?: string;
}

export async function signInWithEmail(input: SignInInput): Promise<FirebaseSession> {
  const session = await authFetch('/accounts:signInWithPassword', {
    email: input.email,
    password: input.password,
    returnSecureToken: true,
  });
  // SECURITY GATE: only accounts with a verified email may hold a session.
  // Unverified attempts are refused BEFORE anything is persisted or
  // mirrored into the SDK, and a fresh verification link is sent so the
  // user is never stuck with a dead one.
  if (!session.emailVerified) {
    void sendEmailVerification(session.idToken, input.continueUrl).catch(() => { /* best-effort */ });
    const err = toAuthError({ error: { message: 'EMAIL_NOT_VERIFIED' } });
    err.pendingSession = session;
    throw err;
  }
  // Load any previously saved profile fields from localStorage.
  const profile = loadStoredProfile(session.localId);
  persistSession(session, profile);
  // Mirror the session into the SDK auth state (dashboard/listeners).
  bridgeToSdk(input.email, input.password);
  // Enrich the returned session with the role (see signUpWithEmail for
  // the full explanation — FirebaseSession itself doesn't include role).
  const restored = restoreSession();
  return restored ? { ...session, role: restored.role } : session;
}

export async function sendEmailVerification(idToken: string, continueUrl?: string): Promise<void> {
  if (!API_KEY) return;
  const url = `${BASE}/accounts:sendOobCode?key=${API_KEY}`;
  const body: Record<string, unknown> = { requestType: 'VERIFY_EMAIL', idToken };
  // Land the user back on the mini-mock anchor after they click the
  // verification link in their email.
  if (continueUrl) {
    body.continueUrl = continueUrl;
    body.handleCodeInApp = false;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw toAuthError(data);
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  if (!API_KEY) {
    throw new Error('Firebase is not configured. Set VITE_FIREBASE_API_KEY.');
  }
  const url = `${BASE}/accounts:sendOobCode?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw toAuthError(data);
  }
}

interface StoredProfile {
  displayName?: string;
  school?: string;
  role?: string;
  teachingRole?: string;
}

/**
 * Site-owner admin grant (Oct 2026).
 *
 * Keyed by Firebase UID — not email — because the UID is immutable across
 * email changes and is already public (it appears on the live `classes`
 * docs as teacherUid). The listed account owns every class on the project
 * (verified via the public classes collection, Oct 2026).
 *
 * Role VALUE stays the existing 'teacher' enum on purpose: every gate on
 * the site — the React `session.role === 'teacher'` checks AND the static
 * pages' `localStorage['cmc-student-role'] === 'teacher'` check — opens
 * with zero per-consumer changes, and no static page can be missed.
 * Server-side, firestore.rules ORs the same UID into isCmcTeacher() and
 * waives the teachers/{uid} allowlist requirement (isCmcAdmin).
 */
export const ADMIN_UIDS: readonly string[] = ['5iLvnjzmV8QY7WFZhyTq6PIgcI63'];

/** True when the given uid carries the site-owner admin grant. */
export function isAdminUid(uid?: string | null): boolean {
  return !!uid && ADMIN_UIDS.includes(uid);
}

/**
 * Detect role from email domain. Per the user's rule:
 *   - Email domain contains "edu" (e.g., `.edu.kh`, `.edu`, `education.*`)
 *     → teacher
 *   - Anything else → student
 *
 * Examples:
 *   teacher@school.edu.kh → teacher
 *   teacher@university.edu → teacher
 *   jane@gmail.com → student
 *   john@example.com → student
 *
 * This is a soft check — the role is also persisted to Firestore
 * `users/{uid}.role` so the server has the authoritative record.
 */
export function detectRoleFromEmail(email: string): 'teacher' | 'student' {
  const domain = (email.split('@')[1] || '').toLowerCase();
  if (!domain) return 'student';
  // Domain contains "edu" anywhere → teacher.
  // Catches `.edu`, `.edu.kh`, `.edu.au`, `education.*`, etc.
  return domain.includes('edu') ? 'teacher' : 'student';
}

/** Check whether an email is acceptable for a teacher signup. */
export function isTeacherEmail(email: string): boolean {
  return detectRoleFromEmail(email) === 'teacher';
}

function profileKey(localId: string): string {
  return `cmc-profile:${localId}`;
}

function loadStoredProfile(localId: string): StoredProfile {
  try {
    const raw = localStorage.getItem(profileKey(localId));
    return raw ? (JSON.parse(raw) as StoredProfile) : {};
  } catch {
    return {};
  }
}

function persistSession(session: FirebaseSession, profile: StoredProfile): void {
  try {
    // Auto-detect role from email if not explicitly provided. This is the
    // canonical rule: email domain contains "edu" → teacher, else student.
    // `profile.role` must be the account enum ('teacher' | 'student') —
    // free-text teaching roles are stored separately as `teachingRole`.
    // Admin accounts are pinned to 'teacher' regardless of what a stale
    // stored profile says, so the persisted role never downgrades them.
    const role = isAdminUid(session.localId)
      ? 'teacher'
      : profile.role === 'teacher' || profile.role === 'student'
        ? profile.role
        : detectRoleFromEmail(session.email);
    localStorage.setItem('cmc-student-token', session.idToken);
    localStorage.setItem('cmc-student-name', session.displayName || profile.displayName || session.email);
    localStorage.setItem('cmc-student-uid', session.localId);
    localStorage.setItem('cmc-student-email', session.email);
    localStorage.setItem('cmc-student-role', role);
    localStorage.setItem('cmc-student-token-expires', String(session.expiresAt));
    localStorage.setItem('cmc-student-verified', session.emailVerified ? '1' : '0');
    // Keep the refresh token so expired ID tokens can be silently renewed
    // (refreshIdToken) without asking the user to sign in again.
    localStorage.setItem('cmc-student-refresh-token', session.refreshToken);
    localStorage.setItem(
      profileKey(session.localId),
      JSON.stringify({
        displayName: profile.displayName || session.displayName || undefined,
        school: profile.school,
        role,
        teachingRole: profile.teachingRole,
      }),
    );
  } catch {
    /* localStorage might be unavailable (private mode) — best-effort only */
  }
}

// ── Token refresh (securetoken grant) ──────────────────────────────
// Firebase ID tokens live ~1 hour. The refresh token returned at sign-in
// can mint fresh ID tokens for months. Without this, every worksheet
// submission silently fails once the stored token ages out.

/** localStorage read that never throws (private mode / disabled storage). */
function storedValue(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

/** Exchange the stored refresh token for a fresh ID token. Updates
 *  localStorage (token, expiry, rotated refresh token) and dispatches
 *  `cmc-auth-changed`. Returns the new ID token, or null on failure. */
export async function refreshIdToken(): Promise<string | null> {
  const refreshToken = storedValue('cmc-student-refresh-token');
  if (!refreshToken || !API_KEY) return null;
  try {
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data?.id_token) return null;
    try {
      const expiresInMs = (Number(data.expires_in) || 3600) * 1000;
      localStorage.setItem('cmc-student-token', data.id_token);
      // Mark expiry 1 minute early so getValidIdToken refreshes preemptively.
      localStorage.setItem('cmc-student-token-expires', String(Date.now() + expiresInMs - 60_000));
      if (data.refresh_token) localStorage.setItem('cmc-student-refresh-token', data.refresh_token);
    } catch { /* best-effort */ }
    try { window.dispatchEvent(new CustomEvent('cmc-auth-changed')); } catch { /* non-DOM */ }
    return data.id_token as string;
  } catch {
    return null;
  }
}

/** Returns a currently-valid ID token — the stored one when it still has
 *  >5 minutes of life, otherwise a refreshed one. Null when there is no
 *  session, refresh failed, or the account's email is not verified —
 *  unverified sessions must not authenticate writes anywhere on the site. */
export async function getValidIdToken(): Promise<string | null> {
  const token = storedValue('cmc-student-token');
  if (!token) return null;
  const expiresAt = Number(storedValue('cmc-student-token-expires') || '0');
  const current = expiresAt > Date.now() + 5 * 60_000 ? token : await refreshIdToken();
  if (!current) return null;
  if (tokenEmailVerified(current) === false) {
    clearPersistedSession();
    return null;
  }
  return current;
}

/** Boot-time session self-heal: silently refresh an expired/near-expiry
 *  token so worksheet submissions keep working without re sign-in.
 *  Also the verification enforcement point for restored sessions: any
 *  session whose (refreshed) token says email_verified=false is dropped —
 *  this cleans up sessions minted before the requirement existed. */
export async function ensureFreshSession(): Promise<RestoredSession | null> {
  const session = restoreSession();
  if (!session) return null;
  const expiresAt = Number(storedValue('cmc-student-token-expires') || '0');
  if (expiresAt <= Date.now() + 5 * 60_000) await refreshIdToken();
  const current = restoreSession() ?? session;
  if (!current.emailVerified) {
    clearPersistedSession();
    return null;
  }
  return current;
}

// ── SDK session mirror ────────────────────────────────────────────
// The REST session (localStorage) and the SDK auth state are two separate
// worlds. These bridges keep them aligned so both halves of the app —
// static worksheet POSTs (localStorage token) and dashboard realtime
// listeners (SDK auth) — always see the same signed-in user.

function bridgeToSdk(email: string, password: string): void {
  void import('./firebase').then(async ({ getFirebaseAuth }) => {
    const auth = await getFirebaseAuth();
    if (!auth) return;
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    await signInWithEmailAndPassword(auth, email, password);
  }).catch(() => {
    /* silent — the SDK session is a best-effort mirror of the REST one */
  });
}

function signOutSdk(): void {
  void import('./firebase').then(async ({ getFirebaseAuth }) => {
    const auth = await getFirebaseAuth();
    if (!auth) return;
    const { signOut } = await import('firebase/auth');
    await signOut(auth);
  }).catch(() => { /* silent */ });
}

export function clearPersistedSession(): void {
  try {
    const uid = localStorage.getItem('cmc-student-uid');
    localStorage.removeItem('cmc-student-token');
    localStorage.removeItem('cmc-student-name');
    localStorage.removeItem('cmc-student-uid');
    localStorage.removeItem('cmc-student-email');
    localStorage.removeItem('cmc-student-role');
    localStorage.removeItem('cmc-student-token-expires');
    localStorage.removeItem('cmc-student-verified');
    localStorage.removeItem('cmc-student-refresh-token');
    if (uid) localStorage.removeItem(profileKey(uid));
  } catch {
    /* noop */
  }
  // Keep the SDK auth state in sync — a lingering SDK session would make
  // the dashboard still show the user after the REST session is gone.
  signOutSdk();
}

export interface RestoredSession {
  idToken: string;
  localId: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  isExpired: boolean;
  role: 'teacher' | 'student';
}

/** Decode the `email_verified` claim from a Firebase ID token (JWT) with
 *  no network call. Null when the claim can't be read — callers then fall
 *  back to the locally stored flag. The claim is minted by the server, so
 *  a freshly refreshed token always reflects current verification state. */
export function tokenEmailVerified(idToken: string): boolean | null {
  try {
    const payload = idToken.split('.')[1] || '';
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(b64).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
    );
    const claim = (JSON.parse(json) as { email_verified?: boolean }).email_verified;
    return typeof claim === 'boolean' ? claim : null;
  } catch {
    return null;
  }
}

export function restoreSession(): RestoredSession | null {
  try {
    const idToken = localStorage.getItem('cmc-student-token');
    if (!idToken) return null;
    const localId = localStorage.getItem('cmc-student-uid') || '';
    const email = localStorage.getItem('cmc-student-email') || '';
    const displayName = localStorage.getItem('cmc-student-name') || email;
    // The server-minted token claim is authoritative (a token refreshed
    // after clicking the verification link flips to true); the localStorage
    // flag is only a fallback for tokens we can't decode.
    const claimedVerified = tokenEmailVerified(idToken);
    const emailVerified = claimedVerified ?? localStorage.getItem('cmc-student-verified') === '1';
    const expiresAtRaw = localStorage.getItem('cmc-student-token-expires');
    const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : 0;
    // Prefer the stored role; fall back to detecting from the email so the
    // session is correct even if the role was added in a later release.
    // Admin accounts always resolve to 'teacher' — this also upgrades an
    // ALREADY signed-in pre-grant session (stored role 'student') without
    // requiring a fresh sign-in.
    const storedRole = localStorage.getItem('cmc-student-role') as 'teacher' | 'student' | null;
    const role = isAdminUid(localId) ? 'teacher' : storedRole || detectRoleFromEmail(email);
    return {
      idToken,
      localId,
      email,
      displayName,
      emailVerified,
      isExpired: expiresAt > 0 && Date.now() >= expiresAt,
      role,
    };
  } catch {
    return null;
  }
}

/** Normalize a fresh (in-memory) FirebaseSession into the persisted-session
 *  shape shared by the hook and the auth modal. */
export function toRestoredSession(session: FirebaseSession): RestoredSession {
  return {
    idToken: session.idToken,
    localId: session.localId,
    email: session.email,
    displayName: session.displayName || session.email,
    emailVerified: session.emailVerified,
    isExpired: session.expiresAt > 0 && Date.now() >= session.expiresAt,
    role: isAdminUid(session.localId)
      ? 'teacher'
      : session.role === 'teacher' || session.role === 'student'
        ? session.role
        : detectRoleFromEmail(session.email),
  };
}

export function getProjectId(): string {
  return FIREBASE_PROJECT_ID;
}
