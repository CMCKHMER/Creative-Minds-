// Student authentication using Firebase Auth.
// Students are separate from teachers (who use Supabase Auth).
// Students can sign in with email/password or Google Sign-In.
//
// The SDK functions are dynamic-imported inside each call so that the
// firebase/auth chunk only downloads when a student actually signs in.

import { firebaseConfigured, getFirebaseAuth } from './firebase';
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
    await signInWithEmailAndPassword(auth, email, password);
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
    await signInWithPopup(auth, new GoogleAuthProvider());
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Google sign in failed' };
  }
}

/** Sign out the current student */
export async function studentSignOut(): Promise<void> {
  const auth = await getFirebaseAuth();
  if (!auth) return;
  const { signOut } = await import('firebase/auth');
  await signOut(auth);
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
    });
  })();
  return () => {
    alive = false;
    unsubscribe?.();
  };
}
