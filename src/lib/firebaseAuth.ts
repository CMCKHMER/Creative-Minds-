// Firebase Authentication via REST API — no SDK required.
//
// The static HTML pages in public/ (toefl-ibt, biweek-planner, rfc3, etc.)
// already submit scores to Firestore using the Firebase ID Token stored in
// localStorage as `cmc-student-token`. This module produces the same
// token via the Firebase Auth REST API, so a React-side sign-in here is
// recognized by every standalone HTML page in the same project.
//
// Required env vars (in .env.local or build env):
//   VITE_FIREBASE_API_KEY   — Firebase Web API key (Project Settings → General)
//   VITE_FIREBASE_PROJECT_ID — defaults to "creative-minds-cambodia"
//
// Docs: https://firebase.google.com/docs/reference/rest/auth

const API_KEY = (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined)?.trim();
export const FIREBASE_PROJECT_ID =
  (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined)?.trim()
  || 'creative-minds-cambodia';

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

function parseAuthError(e: unknown): string {
  const err = (e as AuthError)?.error;
  const raw = err?.message || (e instanceof Error ? e.message : 'Authentication failed.');
  // Firebase returns codes like "EMAIL_EXISTS: ..." — strip the prefix.
  const colonIdx = raw.indexOf(':');
  return colonIdx > 0 && colonIdx < 40 ? raw.slice(colonIdx + 1).trim() : raw;
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
    throw new Error(parseAuthError(data));
  }
  const r = data as RawAuthResponse;
  const expiresInSec = Number(r.expiresIn || '3600');
  return {
    idToken: r.idToken,
    refreshToken: r.refreshToken,
    localId: r.localId,
    email: r.email,
    displayName: r.displayName ?? null,
    emailVerified: r.emailVerified ?? false,
    expiresIn: expiresInSec,
    expiresAt: Date.now() + expiresInSec * 1000,
  };
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName?: string;
  school?: string;
  role?: string;
}

export async function signUpWithEmail(input: SignUpInput): Promise<FirebaseSession> {
  const session = await authFetch('/accounts:signUp', {
    email: input.email,
    password: input.password,
    returnSecureToken: true,
    displayName: input.displayName || undefined,
  });
  // Persist extra profile fields alongside the token so the static HTML
  // pages and any future Firestore writes can read them.
  persistSession(session, {
    displayName: input.displayName,
    school: input.school,
    role: input.role,
  });
  // Send email verification (non-blocking — the user can still sign in
  // immediately, but won't be "verified" until they click the link).
  void sendEmailVerification(session.idToken).catch(() => {});
  return session;
}

export interface SignInInput {
  email: string;
  password: string;
}

export async function signInWithEmail(input: SignInInput): Promise<FirebaseSession> {
  const session = await authFetch('/accounts:signInWithPassword', {
    email: input.email,
    password: input.password,
    returnSecureToken: true,
  });
  // Load any previously saved profile fields from localStorage.
  const profile = loadStoredProfile(session.localId);
  persistSession(session, profile);
  return session;
}

export async function sendEmailVerification(idToken: string): Promise<void> {
  if (!API_KEY) return;
  const url = `${BASE}/accounts:sendOobCode?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestType: 'VERIFY_EMAIL', idToken }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(parseAuthError(data));
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
    throw new Error(parseAuthError(data));
  }
}

interface StoredProfile {
  displayName?: string;
  school?: string;
  role?: string;
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
    const role = profile.role || detectRoleFromEmail(session.email);
    localStorage.setItem('cmc-student-token', session.idToken);
    localStorage.setItem('cmc-student-name', session.displayName || profile.displayName || session.email);
    localStorage.setItem('cmc-student-uid', session.localId);
    localStorage.setItem('cmc-student-email', session.email);
    localStorage.setItem('cmc-student-role', role);
    localStorage.setItem('cmc-student-token-expires', String(session.expiresAt));
    localStorage.setItem('cmc-student-verified', session.emailVerified ? '1' : '0');
    localStorage.setItem(
      profileKey(session.localId),
      JSON.stringify({
        displayName: profile.displayName || session.displayName || undefined,
        school: profile.school,
        role,
      }),
    );
  } catch {
    /* localStorage might be unavailable (private mode) — best-effort only */
  }
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
    if (uid) localStorage.removeItem(profileKey(uid));
  } catch {
    /* noop */
  }
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

export function restoreSession(): RestoredSession | null {
  try {
    const idToken = localStorage.getItem('cmc-student-token');
    if (!idToken) return null;
    const localId = localStorage.getItem('cmc-student-uid') || '';
    const email = localStorage.getItem('cmc-student-email') || '';
    const displayName = localStorage.getItem('cmc-student-name') || email;
    const emailVerified = localStorage.getItem('cmc-student-verified') === '1';
    const expiresAtRaw = localStorage.getItem('cmc-student-token-expires');
    const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : 0;
    // Prefer the stored role; fall back to detecting from the email so the
    // session is correct even if the role was added in a later release.
    const storedRole = localStorage.getItem('cmc-student-role') as 'teacher' | 'student' | null;
    const role = storedRole || detectRoleFromEmail(email);
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

export function getProjectId(): string {
  return FIREBASE_PROJECT_ID;
}
