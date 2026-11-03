/**
 * MaaSetu — route guards.
 *
 * No screen behind the sign-in is reachable without a session: without one the
 * app sends the visitor to the welcome screen. A person who opens another
 * role's page is sent to her own home instead of seeing someone else's data.
 */
import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { homePathFor, useSession } from '../context/SessionContext';
import type { Role } from '../data/model';
import { HeartIcon } from './icons';

export function FullPageLoading() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-50 px-6">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-700 text-white">
        <HeartIcon className="h-8 w-8" />
      </span>
      <p className="text-base font-semibold text-slate-700">{t('shared.loading')}</p>
    </div>
  );
}

/**
 * Welcome and sign-in screens: only for visitors without a session.
 *
 * Only the first check shows the loading screen. Later checks (for example
 * while a just-verified phone number is matched to a record) keep the form on
 * screen, so an OTP form never loses the number or the message it is showing.
 */
export function SignedOutOnly({ children }: { children: ReactNode }) {
  const { status, profile } = useSession();
  const resolvedOnce = useRef(false);
  if (status !== 'loading') resolvedOnce.current = true;
  if (profile) return <Navigate to={homePathFor(profile)} replace />;
  if (status === 'loading' && !resolvedOnce.current) return <FullPageLoading />;
  return <>{children}</>;
}

type WorkerRole = Extract<Role, 'asha' | 'anm'>;

export function RequireWorker({
  role,
  children,
}: {
  role?: WorkerRole;
  children: ReactNode;
}) {
  const { status, profile } = useSession();
  if (status === 'loading') return <FullPageLoading />;
  if (!profile) return <Navigate to="/" replace />;
  if (profile.kind === 'mother') return <Navigate to="/mother" replace />;
  if (role && profile.worker.role !== role) {
    return <Navigate to={homePathFor(profile)} replace />;
  }
  return <>{children}</>;
}

export function RequireMother({ children }: { children: ReactNode }) {
  const { status, profile } = useSession();
  if (status === 'loading') return <FullPageLoading />;
  if (!profile) return <Navigate to="/" replace />;
  if (profile.kind === 'worker') return <Navigate to={homePathFor(profile)} replace />;
  return <>{children}</>;
}
