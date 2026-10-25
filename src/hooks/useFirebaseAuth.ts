import { useEffect, useState } from 'react';
import {
  clearPersistedSession,
  ensureFreshSession,
  firebaseConfigured,
  restoreSession,
  signInWithEmail,
  signUpWithEmail,
  toRestoredSession,
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
  signUp: (input: { email: string; password: string; displayName?: string; school?: string; role?: 'teacher' | 'student'; teachingRole?: string }) => Promise<RestoredSession>;
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
    const sync = () => {
      setSession(restoreSession());
      setHydrated(true);
    };
    sync(); // hydrate on mount
    // Silent self-heal: if the stored ID token has aged past its ~1h life,
    // exchange the persisted refresh token for a fresh one so worksheet
    // score submissions keep working instead of silently failing.
    void ensureFreshSession().then((s) => {
      if (s) setSession(s);
    });
    // Also listen for 'cmc-auth-changed' events — these are dispatched
    // by TeacherPassModal (which calls signUpWithEmail / signInWithEmail
    // directly from firebaseAuth.ts, NOT via this hook's signUp/signIn
    // methods) and by useSignedInSession's signOut. Without this
    // listener, the hook's `session` state would stay stale (null) even
    // after the user signs in via the modal — which caused the MiniMockTest
    // to show "Secure membership is not configured" even for signed-in
    // Firebase users.
    window.addEventListener('cmc-auth-changed', sync);
    window.addEventListener('storage', sync); // cross-tab sync
    return () => {
      window.removeEventListener('cmc-auth-changed', sync);
      window.removeEventListener('storage', sync);
    };
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
      // SECURITY: no session is persisted until the email is verified —
      // the hook state stays signed-out and the caller shows the
      // check-your-inbox flow using the returned info.
      const session = await signUpWithEmail(input);
      return toRestoredSession(session);
    },

    async signIn(input) {
      // Only verified sessions get past signInWithEmail, so persisting
      // here is safe.
      const session = await signInWithEmail(input);
      const restored = toRestoredSession(session);
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
