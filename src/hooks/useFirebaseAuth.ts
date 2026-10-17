import { useEffect, useState } from 'react';
import {
  clearPersistedSession,
  firebaseConfigured,
  restoreSession,
  signInWithEmail,
  signUpWithEmail,
  type RestoredSession,
} from '../lib/firebaseAuth';

export interface FirebaseAuthState {
  isConfigured: boolean;
  session: RestoredSession | null;
  // Convenience booleans derived from session.role.
  isTeacher: boolean;
  isStudent: boolean;
  // True once we've checked localStorage on mount. Use this to gate any
  // first-paint UI that depends on knowing whether a user is signed in.
  hydrated: boolean;
}

export interface FirebaseAuthActions {
  signUp: (input: { email: string; password: string; displayName?: string; school?: string; role?: string }) => Promise<RestoredSession>;
  signIn: (input: { email: string; password: string }) => Promise<RestoredSession>;
  signOut: () => void;
}

/**
 * Subscribe to Firebase auth state.
 *
 * Because we use the REST API (no SDK), there's no real-time listener —
 * we hydrate from localStorage on mount and refresh whenever the calling
 * component invokes `signUp`, `signIn`, or `signOut`. That's enough for
 * a teacher-facing landing page; the static HTML pages already pick up
 * the same `cmc-student-token` from localStorage on their own load.
 *
 * Role (`teacher` / `student`) is auto-detected from the email domain
 * (contains "edu" → teacher) and stored in localStorage as
 * `cmc-student-role`. Both React and the static HTML worksheets read
 * from the same key so the role is consistent across the whole site.
 */
export function useFirebaseAuth(): FirebaseAuthState & FirebaseAuthActions {
  const [session, setSession] = useState<RestoredSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSession(restoreSession());
    setHydrated(true);
  }, []);

  const isTeacher = session?.role === 'teacher';
  const isStudent = session?.role === 'student';

  return {
    isConfigured: firebaseConfigured,
    session,
    isTeacher,
    isStudent,
    hydrated,

    async signUp(input) {
      await signUpWithEmail(input);
      const restored = restoreSession()!;
      setSession(restored);
      window.dispatchEvent(new CustomEvent('cmc-auth-changed'));
      return restored;
    },

    async signIn(input) {
      await signInWithEmail(input);
      const restored = restoreSession()!;
      setSession(restored);
      window.dispatchEvent(new CustomEvent('cmc-auth-changed'));
      return restored;
    },

    signOut() {
      clearPersistedSession();
      setSession(null);
      window.dispatchEvent(new CustomEvent('cmc-auth-changed'));
    },
  };
}
