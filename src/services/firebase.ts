/**
 * MaaSetu — Firebase client bootstrap.
 *
 * Development runs against the local Emulator Suite (Auth 9099, Firestore
 * 8080) so no live Firebase project is needed yet. Emulators are used in
 * dev builds only; a production build talks to whatever project the VITE_
 * variables point at (still empty at this step).
 */
import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getFirestore, setDoc } from 'firebase/firestore';
import type { AuditStore } from './audit';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'maasetu-demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'maasetu-demo',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? 'demo-app-id',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

/** Emulator mode: dev builds only, until real auth lands. */
export const usingEmulators: boolean = import.meta.env.DEV;

if (usingEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

/** `AuditStore` backed by the client Firestore SDK. */
export const firestoreStore: AuditStore = {
  async write(collection, id, data, merge = false) {
    await setDoc(doc(db, collection, id), data, { merge });
  },
};
