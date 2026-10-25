import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Role } from '../data/model';
import type { Actor } from '../services/audit';

type WorkerRole = Extract<Role, 'asha' | 'anm'>;

/**
 * Demo identities (seed ids). There is no sign-in yet, so each role area uses
 * one of the synthetic workers/mothers from the seed. Phone-OTP auth will
 * replace this context in a later step — nothing here is real identity.
 */
const DEMO_DEFAULT_ID: Record<Role, string> = {
  asha: 'usr_asha_meena',
  anm: 'usr_anm_priya',
  mother: 'mtr_savitri',
};

const STORAGE_KEY = 'maasetu.demo-identity';

type Identity = Record<Role, string>;

function loadIdentity(): Identity {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Identity>;
      return { ...DEMO_DEFAULT_ID, ...parsed };
    }
  } catch {
    // Corrupt or unavailable storage: fall back to the demo defaults.
  }
  return { ...DEMO_DEFAULT_ID };
}

interface SessionValue {
  /** Selected demo worker for a worker area (ASHA or ANM). */
  workerIdFor: (role: WorkerRole) => string;
  setWorkerId: (role: WorkerRole, id: string) => void;
  /** Selected demo mother for the read-only mother area. */
  demoMotherId: string;
  setDemoMotherId: (id: string) => void;
  /** Who a write is attributed to in the audit trail. */
  actorFor: (role: Role) => Actor;
}

const SessionContext = createContext<SessionValue | null>(null);

/** Demo-session state; persisted per device, per role. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity>(loadIdentity);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  }, [identity]);

  const value = useMemo<SessionValue>(
    () => ({
      workerIdFor: (role) => identity[role],
      setWorkerId: (role, id) => setIdentity((prev) => ({ ...prev, [role]: id })),
      demoMotherId: identity.mother,
      setDemoMotherId: (id) => setIdentity((prev) => ({ ...prev, mother: id })),
      actorFor: (role) => ({ id: identity[role], role }),
    }),
    [identity],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
