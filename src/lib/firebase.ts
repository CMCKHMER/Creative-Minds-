// Firebase initialization for the CMC app.
// Used alongside Supabase — Supabase handles teacher auth/profiles,
// Firebase handles student auth, real-time score tracking (Firestore),
// and class management.
//
// The SDK is loaded lazily: every export below either returns plain data
// (firebaseConfig, firebaseConfigured) or a Promise that dynamic-imports
// only the SDK piece that is needed. This keeps ~500 KB of Firebase code
// out of the initial page-load critical path — it is fetched when an auth
// surface (dashboard, student modal) actually mounts.
//
// To configure: either set these env vars in .env.local:
//   VITE_FIREBASE_API_KEY=
//   VITE_FIREBASE_AUTH_DOMAIN=
//   VITE_FIREBASE_PROJECT_ID=
//   VITE_FIREBASE_STORAGE_BUCKET=
//   VITE_FIREBASE_MESSAGING_SENDER_ID=
//   VITE_FIREBASE_APP_ID=
//
// Or paste your firebaseConfig object directly below.

import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  // Valid web API key for creative-minds-cambodia (verified live). The env
  // var wins when set; this fallback keeps builds working without .env.local.
  // NOTE: an earlier copy of this key was hand-mangled (0↔O/6) and invalid.
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDNUq0ru99XKh08D887Xk63h36MPOlXWwc',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'creative-minds-cambodia.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'creative-minds-cambodia',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'creative-minds-cambodia.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '519217757765',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:519217757765:web:23e086ba196b341ce2ed2c',
};

export const firebaseConfigured = !firebaseConfig.apiKey.includes('DemoApiKey');

export { firebaseConfig };

// ── Lazy singletons ─────────────────────────────────────────────────
// Each getter memoizes its promise, so the SDK initializes exactly once
// no matter how many callers race on the first call.

let appPromise: Promise<FirebaseApp> | null = null;

function firebaseApp(): Promise<FirebaseApp> {
  appPromise ??= import('firebase/app').then(({ initializeApp }) => initializeApp(firebaseConfig));
  return appPromise;
}

/** Resolve the Firebase Auth instance, or null when Firebase is not configured / init failed. */
export function getFirebaseAuth(): Promise<Auth | null> {
  if (!firebaseConfigured) return Promise.resolve(null);
  return firebaseApp()
    .then(async (app) => (await import('firebase/auth')).getAuth(app))
    .catch((e) => {
      console.warn('[firebase] auth init failed:', e);
      return null;
    });
}

/** Resolve the Firestore instance, or null when Firebase is not configured / init failed. */
export function getFirebaseDb(): Promise<Firestore | null> {
  if (!firebaseConfigured) return Promise.resolve(null);
  return firebaseApp()
    .then(async (app) => (await import('firebase/firestore')).getFirestore(app))
    .catch((e) => {
      console.warn('[firebase] firestore init failed:', e);
      return null;
    });
}

/** Resolve the Storage instance, or null when Firebase is not configured / init failed. */
export function getFirebaseStorage(): Promise<FirebaseStorage | null> {
  if (!firebaseConfigured) return Promise.resolve(null);
  return firebaseApp()
    .then(async (app) => (await import('firebase/storage')).getStorage(app))
    .catch((e) => {
      console.warn('[firebase] storage init failed:', e);
      return null;
    });
}
