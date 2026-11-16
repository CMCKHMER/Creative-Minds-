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
import { clearPersistedSession, restoreSession } from './firebaseAuth';
import { createStudentProfile } from './firebaseDb';
import {
  fetchTeacherAccessConfig,
  isAccountType,
  readCachedTeacherAccess,
  resolveEffectiveAccess,
  savePendingSignupMeta,
  upsertUserProfileDoc,
  writeCachedTeacherAccess,
  type AccountType,
  type TeacherAccessConfig,
} from './userProfile';
import type { User } from 'firebase/auth';

export interface StudentProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  classCode: string | null; // class they're enrolled in
  grade: number | null;
  school: string | null;
  /** Self-identified category ('student' | 'teacher' | 'user'); null until chosen. */
  accountType?: AccountType | null;
  /** True when this account holds verified teacher privileges. */
  teacherVerified?: boolean;
}

export interface StudentAuthState {
  status: 'loading' | 'not-configured' | 'signed-out' | 'signed-in';
  student: StudentProfile | null;
  error: string | null;
}

/** Sign up a new student with email + password.
 *  SECURITY: the account is created unverified — the verification link is
 *  sent, the fresh session is torn down immediately, and the caller shows
 *  a check-your-inbox state. The student signs in only AFTER clicking it. */
export async function studentSignUp(
  email: string,
  password: string,
  displayName: string,
  profile?: { grade?: number; school?: string; accountType?: AccountType; teachingRole?: string },
): Promise<{ ok: boolean; error?: string; pendingVerification?: boolean; uid?: string; email?: string }> {
  const auth = await getFirebaseAuth();
  if (!auth) return { ok: false, error: 'Firebase not configured' };
  const { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signOut } = await import('firebase/auth');
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) await updateProfile(cred.user, { displayName });
    const accountType: AccountType = isAccountType(profile?.accountType)
      ? profile.accountType
      : 'student';
    // Remember the chosen category so the owner can classify the account
    // even before the verification email is clicked.
    savePendingSignupMeta(email, {
      accountType,
      displayName: displayName?.trim() || undefined,
      school: profile?.school?.trim() || undefined,
      grade: profile?.grade != null ? String(profile.grade) : undefined,
      teachingRole: profile?.teachingRole?.trim() || undefined,
    });
    try {
      const idToken = await cred.user.getIdToken();
      void upsertUserProfileDoc({
        uid: cred.user.uid,
        idToken,
        email: cred.user.email || email,
        displayName,
        accountType,
        emailVerified: false,
        school: profile?.school,
        grade: profile?.grade != null ? String(profile.grade) : undefined,
        teachingRole: profile?.teachingRole,
        isNewSignup: true,
      });
    } catch { /* classification sync is best-effort */ }
    // Create the Firestore profile doc while the (unverified) auth context
    // still exists — students/{uid} create is the one write allowed pre-
    // verification, updates need verification.
    try {
      await createStudentProfile(cred.user.uid, {
        displayName,
        email,
        grade: profile?.grade,
        school: profile?.school,
      });
    } catch { /* profile is re-creatable; verification flow must not block */ }
    // Send the proof-of-ownership link.
    try {
      await sendEmailVerification(cred.user, {
        url: `${window.location.origin}${window.location.pathname}`,
        handleCodeInApp: false,
      });
    } catch { /* best-effort — sign-in resends automatically */ }
    // Tear the session down: no usable session exists until verified.
    await signOut(auth);
    clearPersistedSession();
    return { ok: true, pendingVerification: true, uid: cred.user.uid, email: cred.user.email || email };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Sign up failed' };
  }
}

/** Sign in an existing student.
 *  SECURITY GATE: email/password accounts without a verified email get no
 *  session — a fresh verification link is sent and a typed result is
 *  returned so the UI can show the check-your-inbox state. */
export async function studentSignIn(
  email: string,
  password: string,
  accountType?: AccountType,
): Promise<{ ok: boolean; error?: string; needsVerification?: boolean }> {
  const auth = await getFirebaseAuth();
  if (!auth) return { ok: false, error: 'Firebase not configured' };
  const { signInWithEmailAndPassword, sendEmailVerification, signOut } = await import('firebase/auth');
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (!cred.user.emailVerified) {
      try {
        await sendEmailVerification(cred.user, {
          url: `${window.location.origin}${window.location.pathname}`,
          handleCodeInApp: false,
        });
      } catch { /* best-effort — the user can retry */ }
      await signOut(auth);
      clearPersistedSession();
      return {
        ok: false,
        needsVerification: true,
        error: `Please verify your email before signing in. We just sent a fresh verification link to ${cred.user.email || email} — open it, tap “Verify”, then sign in again.`,
      };
    }
    await persistSessionFromSdkUser(cred.user, undefined, accountType);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Sign in failed' };
  }
}

/** Google Sign-In popup */
export async function studentGoogleSignIn(
  accountType?: AccountType,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await getFirebaseAuth();
  if (!auth) return { ok: false, error: 'Firebase not configured' };
  const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
  try {
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    await persistSessionFromSdkUser(cred.user, undefined, accountType);
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

/** Resolve (and persist) the account classification for an SDK user, then
 *  mirror the full session block into localStorage. */
async function persistSessionFromSdkUser(
  user: User,
  displayNameOverride?: string,
  explicitAccountType?: AccountType,
): Promise<void> {
  // Verification gate — an unverified SDK account must never bridge into
  // the localStorage session the worksheets use for authenticated writes
  // (covers the onAuthStateChanged self-heal path too).
  if (!user.emailVerified) { clearPersistedSession(); return; }
  try {
    const idToken = await user.getIdToken();
    const email = user.email || '';
    const previous = restoreSession();
    const previousType = previous && previous.localId === user.uid ? previous.accountType : null;
    const chosen: AccountType | null = isAccountType(explicitAccountType)
      ? explicitAccountType
      : isAccountType(previousType)
        ? previousType
        : null;

    // Live list when reachable (it also refreshes the cache); the cached copy
    // keeps offline/blocked networks working.
    let teacherAccess: TeacherAccessConfig = readCachedTeacherAccess();
    try {
      teacherAccess = await fetchTeacherAccessConfig();
      writeCachedTeacherAccess(teacherAccess);
    } catch { /* offline — cached list is good enough */ }

    const access = resolveEffectiveAccess({
      uid: user.uid,
      email,
      emailVerified: user.emailVerified,
      accountType: chosen,
      teacherAccess,
    });

    localStorage.setItem('cmc-student-token', idToken);
    // An email is NEVER a display name: Google/Gmail sign-ins can return an
    // empty displayName (supervised child accounts, directory privacy).
    localStorage.setItem('cmc-student-name', displayNameOverride || user.displayName || '');
    localStorage.setItem('cmc-student-uid', user.uid);
    localStorage.setItem('cmc-student-email', email);
    // Admins pin to 'teacher'; verified teachers keep 'teacher'; everyone
    // else — students, general users, unverified teachers — is 'student'.
    localStorage.setItem('cmc-student-role', access.role);
    localStorage.setItem('cmc-account-type', access.accountType);
    localStorage.setItem('cmc-teacher-verified', access.isVerifiedTeacher ? '1' : '0');
    if (!chosen && !access.isAdmin) localStorage.removeItem('cmc-account-type');
    localStorage.setItem('cmc-student-token-expires', String(idTokenExpiryMs(idToken) - 60_000));
    localStorage.setItem('cmc-student-verified', user.emailVerified ? '1' : '0');
    // The SDK user's own refresh token works with the securetoken REST grant
    // (firebaseAuth.refreshIdToken) — persisting it lets the static
    // worksheets silently renew after the 1-hour ID token expires.
    if (user.refreshToken) localStorage.setItem('cmc-student-refresh-token', user.refreshToken);

    // Keep the owner's user directory current (classification + verification).
    if (chosen || access.isAdmin) {
      void upsertUserProfileDoc({
        uid: user.uid,
        idToken,
        email,
        displayName: displayNameOverride || user.displayName || undefined,
        accountType: access.accountType,
        emailVerified: user.emailVerified,
        isNewSignup: !previous || previous.localId !== user.uid,
      });
    }
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
  const session = restoreSession();
  const access = resolveEffectiveAccess({
    uid: user.uid,
    email: user.email ?? '',
    emailVerified: user.emailVerified,
    accountType: session && session.localId === user.uid ? session.accountType : null,
    teacherAccess: readCachedTeacherAccess(),
  });
  return {
    uid: user.uid,
    displayName: user.displayName ?? '',
    email: user.email ?? '',
    photoURL: user.photoURL,
    classCode: null,
    grade: null,
    school: null,
    accountType: access.accountType,
    teacherVerified: access.isVerifiedTeacher,
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
