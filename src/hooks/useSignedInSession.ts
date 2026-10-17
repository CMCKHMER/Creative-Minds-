import { useEffect, useState } from 'react';
import { restoreSession } from '../lib/firebaseAuth';

/**
 * Tiny hook that re-renders on `cmc-auth-changed` events. Use this in
 * any component that needs to know whether a user is currently signed
 * in (and, if so, their display name + email + role) — without
 * subscribing to the full `useFirebaseAuth` API surface.
 *
 * Returns `null` when no session is in localStorage, otherwise the
 * restored session (with role + email + displayName).
 */
export function useSignedInSession() {
  const [session, setSession] = useState(() => restoreSession());

  useEffect(() => {
    const sync = () => setSession(restoreSession());
    sync(); // re-hydrate on mount
    window.addEventListener('cmc-auth-changed', sync);
    window.addEventListener('storage', sync); // cross-tab changes
    return () => {
      window.removeEventListener('cmc-auth-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return session;
}
