import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Role } from '../data/model';

/** All three role areas, in display order. */
export const ROLES: Role[] = ['asha', 'anm', 'mother'];

/** Route for each role area. */
export const ROLE_PATH: Record<Role, string> = {
  asha: '/asha',
  anm: '/anm',
  mother: '/mother',
};

const STORAGE_KEY = 'maasetu.role';

interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

/**
 * Temporary role switcher (step 1): picks which role area to open and
 * remembers it on this device. Real phone-OTP auth replaces it later.
 */
export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return ROLES.includes(saved as Role) ? (saved as Role) : 'asha';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, role);
  }, [role]);

  const value = useMemo(() => ({ role, setRole }), [role]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used inside <RoleProvider>');
  return ctx;
}
