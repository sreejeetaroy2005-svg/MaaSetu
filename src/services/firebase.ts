/**
 * MaaSetu — Firebase client bootstrap.
 *
 * Production (VITE_USE_EMULATORS != 'true'):
 *   Talks to the real Firebase project configured by VITE_FIREBASE_* env vars.
 *   Phone auth uses RecaptchaVerifier (invisible) + signInWithPhoneNumber.
 *   Firestore queries always carry a real Firebase Auth user credential.
 *
 * Local development (VITE_USE_EMULATORS == 'true'):
 *   Connects to the local Emulator Suite (Auth 9099, Firestore 8080).
 *   reCAPTCHA verification is disabled for testing.
 *
 * Auth persistence is `browserSessionPersistence`: a reload keeps the session
 * in the same tab, and closing the tab signs out — the app must never reopen
 * on someone else's screen.
 */
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserSessionPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  doc,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
} from 'firebase/firestore';
import type { AuditStore } from './audit';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'maasetu-demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'maasetu-demo',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? 'demo-app-id',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

/**
 * Firestore keeps an IndexedDB copy of every document this app has read, and
 * shares it across tabs, so a refresh with no connection still opens on the
 * data this phone already had. Writes queued by our own outbox carry the
 * who/when the app needs, so this layer is only the cache.
 */
function createFirestore() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (error) {
    console.warn('MaaSetu: persistent cache unavailable, using memory cache', error);
    return getFirestore(app);
  }
}

export const db = createFirestore();

/**
 * `true` only when VITE_USE_EMULATORS=true (local development).
 * Never true in a production / hosted build.
 */
export const usingEmulators: boolean = import.meta.env.VITE_USE_EMULATORS === 'true';

/**
 * `true` when demo UI mode is enabled (shows demo numbers, demo tools menu,
 * and load demo data button). Fully independent of usingEmulators.
 */
export const demoMode: boolean = import.meta.env.VITE_DEMO_MODE === 'true';

if (usingEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  // The Auth emulator accepts any 6-digit code, so no reCAPTCHA is needed.
  auth.settings.appVerificationDisabledForTesting = true;
}

void setPersistence(auth, browserSessionPersistence).catch((error: unknown) => {
  console.error('MaaSetu: could not set auth persistence', error);
});

/** `AuditStore` backed by the client Firestore SDK. */
export const firestoreStore: AuditStore = {
  async write(collection, id, data, merge = false) {
    await setDoc(doc(db, collection, id), data, { merge });
  },
};
