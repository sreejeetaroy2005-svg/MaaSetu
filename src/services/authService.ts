/**
 * MaaSetu — sign-in (phone + OTP).
 *
 * This is the ONLY module that talks to Firebase Auth, so the prototype's
 * sign-in can be replaced with a real SMS gateway later without touching the
 * screens. Registration/profile lookup stays in Firestore (`users` for
 * workers, `mothers` for mothers) so a mother signs in only if an ASHA has
 * already registered her phone number.
 *
 * Development uses the Auth emulator. The emulator's own phone endpoints are
 * called directly for the "send code" step and the resulting session is
 * redeemed with `signInWithCredential`; that keeps the Firebase Auth session
 * real while skipping the SDK's reCAPTCHA Enterprise lookup, which the
 * emulator does not implement (it answers 501 and logs a console error).
 * The issued code is also readable from the emulator so the demo can show it.
 *
 * If the emulator is not running, the demo code falls back to a per-tab demo
 * session so the prototype can still be demonstrated offline; that fallback is
 * clearly limited to dev builds.
 */
import { PhoneAuthProvider, signInWithCredential, signOut as firebaseSignOut, type User as FirebaseUser } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { Mother, User } from '../data/model';

export const DEMO_OTP = '123456';

const DEMO_SESSION_KEY = 'maasetu.demo-session';

/** Matches connectAuthEmulator(auth, 'http://127.0.0.1:9099') in firebase.ts. */
const AUTH_EMULATOR = 'http://127.0.0.1:9099';

export type Profile =
  | { kind: 'worker'; worker: User }
  | { kind: 'mother'; mother: Mother };

/** A code has been sent; `verificationId` is the session it belongs to. */
export interface OtpChallenge {
  verificationId: string;
}

interface EmulatorVerificationCode {
  code: string;
  phoneNumber: string;
  sessionInfo: string;
}

/** `9876543210`, `+91 98765 43210` → `+919876543210`. */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return `+${digits}`;
}

export function isValidPhone(input: string): boolean {
  const digits = input.replace(/\D/g, '');
  return digits.length === 10 || (digits.length === 12 && digits.startsWith('91'));
}

function apiKey(): string {
  return auth.app.options.apiKey ?? 'demo-api-key';
}

/**
 * Dev only: ask the Auth emulator to issue a code. The emulator needs no
 * reCAPTCHA token, so this is the whole "send" step.
 */
async function startEmulatorChallenge(phone: string): Promise<OtpChallenge> {
  const response = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${encodeURIComponent(apiKey())}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: normalizePhone(phone) }),
    },
  );
  if (!response.ok) throw new Error(`sendVerificationCode failed: ${response.status}`);
  const body = (await response.json()) as { sessionInfo?: string };
  if (!body.sessionInfo) throw new Error('sendVerificationCode returned no session');
  return { verificationId: body.sessionInfo };
}

/**
 * Dev only: the codes the emulator has issued, newest last. Used to show the
 * real code on screen (and by the demo menu, which has no one to read an SMS).
 */
async function listEmulatorCodes(): Promise<EmulatorVerificationCode[]> {
  const projectId = auth.app.options.projectId ?? 'maasetu-demo';
  const response = await fetch(
    `${AUTH_EMULATOR}/emulator/v1/projects/${encodeURIComponent(projectId)}/verificationCodes`,
    { headers: { Accept: 'application/json' } },
  );
  if (!response.ok) throw new Error(`Auth emulator codes list failed: ${response.status}`);
  const body = (await response.json()) as { verificationCodes?: EmulatorVerificationCode[] };
  return body.verificationCodes ?? [];
}

/** Dev only: the most recent code the emulator issued for this number. */
export async function latestEmulatorCode(phone: string): Promise<string | null> {
  try {
    const codes = await listEmulatorCodes();
    const normalized = normalizePhone(phone);
    const forThisPhone = codes.filter((item) => item.phoneNumber === normalized);
    return forThisPhone[forThisPhone.length - 1]?.code ?? null;
  } catch {
    return null;
  }
}

/** Start phone sign-in: sends a code and returns the challenge to complete. */
export async function sendOtp(phone: string): Promise<OtpChallenge> {
  if (!import.meta.env.DEV) {
    // Production swap point: signInWithPhoneNumber(auth, normalizePhone(phone), verifier)
    throw new Error('MaaSetu: phone sign-in is wired to the Auth emulator only');
  }
  return startEmulatorChallenge(phone);
}

/** Complete phone sign-in with the SMS code; returns the Firebase Auth user. */
export async function confirmOtp(challenge: OtpChallenge, code: string): Promise<FirebaseUser> {
  const credential = PhoneAuthProvider.credential(challenge.verificationId, code.trim());
  const result = await signInWithCredential(auth, credential);
  return result.user;
}

/**
 * Dev-only fallback used when the Auth emulator is unreachable: accepts the
 * demo code and keeps a per-tab session. Never available in a production
 * build, and it grants nothing beyond the profile already in Firestore.
 */
export function startDemoSession(phone: string, code: string): boolean {
  if (!import.meta.env.DEV) return false;
  if (code.trim() !== DEMO_OTP) return false;
  sessionStorage.setItem(DEMO_SESSION_KEY, normalizePhone(phone));
  return true;
}

export function readDemoSession(): string | null {
  if (!import.meta.env.DEV) return null;
  return sessionStorage.getItem(DEMO_SESSION_KEY);
}

export function clearDemoSession(): void {
  sessionStorage.removeItem(DEMO_SESSION_KEY);
}

/**
 * Demo-tools shortcut: sign in straight to a seed account using the code the
 * emulator just issued, falling back to the per-tab demo session if the Auth
 * emulator is not running. Used only by the header's demo menu.
 */
export async function demoSignIn(phone: string): Promise<boolean> {
  try {
    const challenge = await sendOtp(phone);
    const code = await latestEmulatorCode(phone);
    if (!code) throw new Error('no code issued');
    await confirmOtp(challenge, code);
    clearDemoSession();
    return true;
  } catch (error) {
    console.warn('MaaSetu: emulator sign-in unavailable, using the demo session', error);
    return startDemoSession(phone, DEMO_OTP);
  }
}

/** Sign out of Firebase Auth and drop any demo session. */
export async function signOutUser(): Promise<void> {
  clearDemoSession();
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('MaaSetu: sign out failed', error);
  }
}

/**
 * Whose record matches this phone number? Workers are checked first, then
 * mothers registered by an ASHA. Returns null when nobody matches: the screen
 * then tells the person to register (worker) or ask her ASHA (mother).
 */
export async function resolveProfile(phone: string): Promise<Profile | null> {
  const normalized = normalizePhone(phone);

  const workerSnap = await getDocs(
    query(collection(db, 'users'), where('phone', '==', normalized), limit(1)),
  );
  const workerDoc = workerSnap.docs[0];
  if (workerDoc) return { kind: 'worker', worker: workerDoc.data() as User };

  const motherSnap = await getDocs(
    query(collection(db, 'mothers'), where('phone', '==', normalized), limit(1)),
  );
  const motherDoc = motherSnap.docs[0];
  if (motherDoc) return { kind: 'mother', mother: motherDoc.data() as Mother };

  return null;
}

/** Re-read one profile by id so the header/list reflect edits made by others. */
export async function fetchProfile(
  kind: Profile['kind'],
  id: string,
): Promise<Profile | null> {
  const collectionName = kind === 'worker' ? 'users' : 'mothers';
  const snap = await getDoc(doc(db, collectionName, id));
  if (!snap.exists()) return null;
  return kind === 'worker'
    ? { kind: 'worker', worker: snap.data() as User }
    : { kind: 'mother', mother: snap.data() as Mother };
}
