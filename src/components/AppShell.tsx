/**
 * MaaSetu — one shell for every signed-in screen.
 *
 * The header always answers "who am I and where am I": name, role and village,
 * a Log out button, the notification bell for workers, and the demo menu. A
 * back button is shown whenever the screen is not the person's home screen.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useUnreadNotifications } from '../hooks/useNotifications';
import { useVillages } from '../hooks/useVillages';
import { DemoTools } from './DemoTools';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ArrowLeftIcon, BellIcon, HeartIcon, LogOutIcon, UserIcon } from './icons';

interface AppShellProps {
  title?: string;
  subtitle?: string;
  /** Omit on the person's home screen. */
  backTo?: string;
  children: ReactNode;
}

export function AppShell({ title, subtitle, backTo, children }: AppShellProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, worker, mother, role, signOut } = useSession();
  const villages = useVillages();
  const unread = useUnreadNotifications(worker?.id ?? null);

  const name = worker?.name ?? mother?.name ?? '';
  const villageName = worker
    ? (villages.find((v) => v.id === worker.village)?.name ?? '')
    : mother
      ? (villages.find((v) => v.id === mother.village)?.name ?? '')
      : '';
  const roleLabel = role ? t(`role.${role}`) : '';

  const logOut = async () => {
    await signOut();
    void navigate('/', { replace: true });
  };

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="bg-brand-800 text-white">
        <div className="mx-auto w-full max-w-[30rem] px-4 pt-3 pb-3">
          <div className="flex min-h-12 items-center gap-2">
            {backTo ? (
              <Link
                to={backTo}
                aria-label={t('shared.back')}
                className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border-2 border-white/40 text-white"
              >
                <ArrowLeftIcon className="h-6 w-6" />
              </Link>
            ) : (
              <span className="flex items-center gap-2 text-lg font-extrabold tracking-wide">
                <HeartIcon className="h-6 w-6" />
                {t('app.name')}
              </span>
            )}

            <div className="ml-auto flex items-center gap-1.5">
              {worker ? (
                <Link
                  to="/notifications"
                  aria-label={
                    unread > 0
                      ? t('notifications.bellWithCount', { count: unread })
                      : t('notifications.bell')
                  }
                  className="relative flex min-h-12 min-w-12 items-center justify-center rounded-xl border-2 border-white/40 text-white"
                >
                  <BellIcon className="h-6 w-6" />
                  {unread > 0 ? (
                    <span className="absolute -top-1.5 -right-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  ) : null}
                </Link>
              ) : null}
              <DemoTools />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/10 p-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20">
              {worker ? <UserIcon className="h-6 w-6" /> : <HeartIcon className="h-6 w-6" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base leading-snug font-bold">{name}</p>
              <p className="text-sm leading-snug text-white/85">
                {roleLabel}
                {villageName ? ` · ${villageName}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void logOut()}
            className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-white/50 text-base font-bold text-white active:bg-white/10"
          >
            <LogOutIcon className="h-5 w-5" />
            {t('shared.logOut')}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[30rem] px-4 pt-4 pb-10">
        {title ? (
          <div className="mb-4">
            <h1 className="text-2xl leading-tight font-bold text-slate-900">{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-base leading-relaxed text-slate-600">{subtitle}</p>
            ) : null}
          </div>
        ) : null}

        {children}

        <footer className="mt-8 border-t border-slate-200 pt-4">
          <LanguageSwitcher />
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{t('safety.assistive')}</p>
          <p className="mt-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {profile ? t('app.syntheticBadge') : ''}
          </p>
        </footer>
      </main>
    </div>
  );
}
