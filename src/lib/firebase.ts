// Firebase initialization for the CMC app.
// Used alongside Supabase — Supabase handles teacher auth/profiles,
// Firebase handles student auth, real-time score tracking (Firestore),
// and class management.
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

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDemoApiKeyReplaceMe',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'creative-minds-demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'creative-minds-demo',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'creative-minds-demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:000000000000:web:0000000000000000000000',
};

export const firebaseConfigured = !firebaseConfig.apiKey.includes('DemoApiKey');

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (firebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export { app, auth, db, storage };
