// Student authentication using Firebase Auth.
// Students are separate from teachers (who use Supabase Auth).
// Students can sign in with email/password or Google Sign-In.
//
// The SDK functions are dynamic-imported inside each call so that the
// firebase/auth chunk only downloads when a student actually signs in.
//
// SESSION BRIDGE: after any successful SDK sign-in, the ID token + profile
// are persisted to the same localStorage keys used by the REST path
// (firebaseAuth.ts) — `cmc-student-token` etc. Without this, every static
// worksheet page (biweek-planner, toefl-ibt, rfc2/3, games) silently skips
// score submission because they only look at localStorage.

import { firebaseConfigured, getFirebaseAuth } from './firebase';
import { clearPersistedSession, detectRoleFromEmail } from './firebaseAuth';
import type { User } from 'firebase/auth';

export interface StudentProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  classCode: string | null; // class they're enrolled in
  grade: number | null;
  school: string | null;
}

export interface StudentAuthState {
  status: 'loading' | 'not-configured' | 'signed-out' | 'signed-in';
  student: StudentProfile | null;
  error: string | null;
}

/** Sign up a new student with email + password */
export async function studentSignUp(
  email: string,
  password: string,
  displayName: string,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await getFirebaseAuth();
  if (!auth) return { ok: false, error: 'Firebase not configured' };
  const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) await updateProfile(cred.user, { displayName });
    // Bridge: make the worksheets/REST surfaces see this session too.
    await persistSessionFromSdkUser(cred.user, displayName);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Sign up failed' };
  }
}

/** Sign in an existing student */
export async function studentSignIn(
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await getFirebaseAuth();
  if (!auth) return { ok: false, error: 'Firebase not configured' };
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await persistSessionFromSdkUser(cred.user);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Sign in failed' };
  }
}

/** Google Sign-In popup */
export async function studentGoogleSignIn(): Promise<{ ok: boolean; error?: string }> {
  const auth = await getFirebaseAuth();
  if (!auth) return { ok: false, error: 'Firebase not configured' };
  const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
  try {
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    await persistSessionFromSdkUser(cred.user);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Google sign in failed' };
  }
}

/** Sign out the current student */
export async function studentSignOut(): Promise<void> {
  const auth = await getFirebaseAuth();
  if (auth) {
    const { signOut } = await import('firebase/auth');
    await signOut(auth);
  }
  // Bridge parity: clear the REST/localStorage session too (also calls
  // signOutSdk, harmless no-op when already signed out) + notify listeners.
  clearPersistedSession();
  try { window.dispatchEvent(new CustomEvent('cmc-auth-changed')); } catch { /* non-DOM */ }
}

// ── SDK → localStorage session bridge ────────────────────────────
// Mirrors the firebaseAuth.ts localStorage schema exactly, so the static
// worksheet pages and submitScore() work identically no matter which
// surface (REST modal or SDK modal) the user signed in through.

/** Decode the `exp` claim (seconds → epoch ms) of a Firebase ID token. */
function idTokenExpiryMs(idToken: string): number {
  try {
    const payload = idToken.split('.')[1] || '';
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(b64).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
    );
    const exp = Number(JSON.parse(json).exp) || 0;
    return exp ? exp * 1000 : Date.now() + 55 * 60_000;
  } catch {
    return Date.now() + 55 * 60_000; // assume ~1h token, conservative
  }
}

async function persistSessionFromSdkUser(user: User, displayNameOverride?: string): Promise<void> {
  try {
    const idToken = await user.getIdToken();
    localStorage.setItem('cmc-student-token', idToken);
    localStorage.setItem('cmc-student-name', displayNameOverride || user.displayName || user.email || '');
    localStorage.setItem('cmc-student-uid', user.uid);
    localStorage.setItem('cmc-student-email', user.email || '');
    localStorage.setItem('cmc-student-role', detectRoleFromEmail(user.email || ''));
    localStorage.setItem('cmc-student-token-expires', String(idTokenExpiryMs(idToken) - 60_000));
    localStorage.setItem('cmc-student-verified', user.emailVerified ? '1' : '0');
    // The SDK user's own refresh token works with the securetoken REST grant
    // (firebaseAuth.refreshIdToken) — persisting it lets the static
    // worksheets silently renew after the 1-hour ID token expires.
    if (user.refreshToken) localStorage.setItem('cmc-student-refresh-token', user.refreshToken);
    try { window.dispatchEvent(new CustomEvent('cmc-auth-changed')); } catch { /* non-DOM */ }
  } catch {
    /* best-effort — the SDK session itself is still valid */
  }
}

/** True when the stored REST session is missing, belongs to a different
 *  user, or its token has aged out — i.e. re-persisting is safe/useful. */
function storedSessionNeedsSync(user: User): boolean {
  try {
    const uid = localStorage.getItem('cmc-student-uid');
    if (uid !== user.uid) return true;
    const expiresAt = Number(localStorage.getItem('cmc-student-token-expires') || '0');
    return expiresAt <= Date.now() + 5 * 60_000;
  } catch {
    return true;
  }
}

function profileOf(user: User): StudentProfile {
  return {
    uid: user.uid,
    displayName: user.displayName ?? '',
    email: user.email ?? '',
    photoURL: user.photoURL,
    classCode: null,
    grade: null,
    school: null,
  };
}

/**
 * Subscribe to student auth state changes.
 *
 * Returns a synchronous unsubscribe function as before; internally the
 * firebase/auth chunk loads async first. If the caller unsubscribes before
 * the chunk arrives, no listener is ever attached.
 */
export function onStudentAuthChange(callback: (student: StudentProfile | null) => void): () => void {
  if (!firebaseConfigured) {
    callback(null);
    return () => {};
  }
  let unsubscribe: (() => void) | null = null;
  let alive = true;
  void (async () => {
    const [auth, { onAuthStateChanged }] = await Promise.all([
      getFirebaseAuth(),
      import('firebase/auth'),
    ]);
    if (!auth || !alive) {
      if (alive) callback(null);
      return;
    }
    unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      callback(user ? profileOf(user) : null);
      // Self-heal: a surviving SDK session (its persistence outlives our
      // 1-hour REST token) re-mints the localStorage token block on page
      // load — users stay "signed in" to the worksheets indefinitely.
      if (user && storedSessionNeedsSync(user)) void persistSessionFromSdkUser(user);
    });
  })();
  return () => {
    alive = false;
    unsubscribe?.();
  };
}
