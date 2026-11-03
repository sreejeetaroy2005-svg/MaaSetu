/**
 * MaaSetu — who is using the app right now.
 *
 * The session comes from Firebase Auth (phone-OTP) plus the matching Firestore
 * record: a `users` document for an ASHA/ANM, or a `mothers` document for a
 * mother whose phone an ASHA registered. There is no default role and no
 * stored identity, so a fresh start always lands on the welcome screen.
 *
 * Auth persistence is per browser tab (see services/firebase.ts): a reload
 * keeps the session, closing the tab signs out.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  readDemoSession,
  resolveProfile,
  signOutUser,
  type Profile,
} from '../services/authService';
import { auth } from '../services/firebase';
import type { Actor } from '../services/audit';
import type { Mother, Role, User } from '../data/model';

type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

interface SessionValue {
  status: SessionStatus;
  profile: Profile | null;
  role: Role | null;
  worker: User | null;
  mother: Mother | null;
  /** Audit actor for writes: the worker, or the mother for her own consent. */
  actor: Actor | null;
  signOut: () => Promise<void>;
  /** Re-resolve the profile (used after the dev demo sign-in). */
  refresh: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      const phone = firebaseUser?.phoneNumber ?? readDemoSession();

      if (!phone) {
        if (!cancelled) {
          setProfile(null);
          setStatus('signedOut');
        }
        return;
      }

      setStatus('loading');
      resolveProfile(phone)
        .then((next) => {
          if (cancelled) return;
          // A verified phone that matches no record: drop the Auth session so
          // the person can correct the number instead of holding a stray login.
          if (!next && firebaseUser) void signOutUser();
          setProfile(next);
          setStatus(next ? 'signedIn' : 'signedOut');
        })
        .catch((error: unknown) => {
          console.error('MaaSetu: could not load the signed-in profile', error);
          if (!cancelled) {
            setProfile(null);
            setStatus('signedOut');
          }
        });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [nonce]);

  const signOut = useCallback(async () => {
    await signOutUser();
    setProfile(null);
    setStatus('signedOut');
  }, []);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  const value = useMemo<SessionValue>(() => {
    const worker = profile?.kind === 'worker' ? profile.worker : null;
    const mother = profile?.kind === 'mother' ? profile.mother : null;
    return {
      status,
      profile,
      role: worker ? worker.role : mother ? 'mother' : null,
      worker,
      mother,
      actor: worker
        ? { id: worker.id, role: worker.role }
        : mother
          ? { id: mother.id, role: 'mother' }
          : null,
      signOut,
      refresh,
    };
  }, [status, profile, signOut, refresh]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>');
  return context;
}

/** Path of the signed-in person's home screen. */
export function homePathFor(profile: Profile | null): string {
  if (!profile) return '/';
  return profile.kind === 'worker' ? `/${profile.worker.role}` : '/mother';
}
