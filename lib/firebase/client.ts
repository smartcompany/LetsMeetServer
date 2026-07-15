import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

/** Public Firebase web config (same as Flutter DefaultFirebaseOptions.web) */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyC7GHNBsS21CL7ZKa-5MGd_6ogOk4v8g4k',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'letsmeet-8def5.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'letsmeet-8def5',
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'letsmeet-8def5.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '225419812075',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:225419812075:web:7421d1841d06782f8972ae',
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function getFirebaseClientAuth(): Auth {
  if (!app) {
    app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);
  }
  if (!auth) {
    auth = getAuth(app);
  }
  return auth;
}
