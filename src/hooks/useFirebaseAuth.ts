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
 */
export function useFirebaseAuth(): FirebaseAuthState & FirebaseAuthActions {
  const [session, setSession] = useState<RestoredSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSession(restoreSession());
    setHydrated(true);
  }, []);

  return {
    isConfigured: firebaseConfigured,
    session,
    hydrated,

    async signUp(input) {
      const s = await signUpWithEmail(input);
      const restored = restoreSession()!;
      setSession(restored);
      return restored;
    },

    async signIn(input) {
      const s = await signInWithEmail(input);
      const restored = restoreSession()!;
      setSession(restored);
      return restored;
    },

    signOut() {
      clearPersistedSession();
      setSession(null);
    },
  };
}
