// Student authentication using Firebase Auth.
// Students are separate from teachers (who use Supabase Auth).
// Students can sign in with email/password or Google Sign-In.

import { auth, firebaseConfigured } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from 'firebase/auth';

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

const googleProvider = new GoogleAuthProvider();

/** Sign up a new student with email + password */
export async function studentSignUp(
  email: string,
  password: string,
  displayName: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!auth) return { ok: false, error: 'Firebase not configured' };
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
  if (!auth) return { ok: false, error: 'Firebase not configured' };
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Sign in failed' };
  }
}

/** Google Sign-In popup */
export async function studentGoogleSignIn(): Promise<{ ok: boolean; error?: string }> {
  if (!auth) return { ok: false, error: 'Firebase not configured' };
  try {
    await signInWithPopup(auth, googleProvider);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Google sign in failed' };
  }
}

/** Sign out the current student */
export async function studentSignOut(): Promise<void> {
  if (auth) await fbSignOut(auth);
}

/** Subscribe to student auth state changes */
export function onStudentAuthChange(callback: (student: StudentProfile | null) => void): () => void {
  if (!auth || !firebaseConfigured) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      callback({
        uid: user.uid,
        displayName: user.displayName ?? '',
        email: user.email ?? '',
        photoURL: user.photoURL,
        classCode: null,
        grade: null,
        school: null,
      });
    } else {
      callback(null);
    }
  });
}
