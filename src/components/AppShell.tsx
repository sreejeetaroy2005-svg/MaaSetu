/**
 * MaaSetu — one shell for every signed-in screen.
 *
 * One app column, 480px at most and centred in the browser window, so nothing
 * ever sits off to one side. The header is two compact rows: the app name with
 * the bell, demo menu and language on the right, then the signed-in person's
 * name, role and village with a small Log out button on the same row.
 *
 * The back link sits at the top of the content, under the header, so the header
 * always answers "who am I and where am I".
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useUnreadNotifications } from '../hooks/useNotifications';
import { useVillages } from '../hooks/useVillages';
import { DemoTools } from './DemoTools';
import { LanguageSwitcher } from './LanguageSwitcher';
import { SyncBar } from './SyncStatus';
import { ArrowLeftIcon, BellIcon, HeartIcon, LogOutIcon } from './icons';

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
  const roleLine = [roleLabel, villageName].filter(Boolean).join(' · ');

  const logOut = async () => {
    await signOut();
    void navigate('/', { replace: true });
  };

  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-slate-50">
        <header className="bg-brand-800 text-white">
          <div className="flex items-center gap-2 px-4 pt-2.5">
            <div className="flex min-h-11 min-w-0 items-center gap-2">
              <HeartIcon className="h-6 w-6 shrink-0" />
              <span className="truncate text-lg leading-tight font-extrabold tracking-wide">
                {t('app.name')}
              </span>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {worker ? (
                <Link
                  to="/notifications"
                  aria-label={
                    unread > 0
                      ? t('notifications.bellWithCount', { count: unread })
                      : t('notifications.bell')
                  }
                  className="relative flex min-h-11 min-w-11 items-center justify-center rounded-xl border-2 border-white/40 text-white"
                >
                  <BellIcon className="h-6 w-6" />
                  {unread > 0 ? (
                    <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[13px] leading-none font-bold text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  ) : null}
                </Link>
              ) : null}
              <DemoTools />
              <LanguageSwitcher compact variant="dark" />
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 pt-1.5 pb-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-base leading-tight font-bold">{name}</p>
              <p className="truncate text-[16px] leading-tight text-white/85">{roleLine}</p>
            </div>
            <button
              type="button"
              onClick={() => void logOut()}
              className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border-2 border-white/50 px-3 text-base font-bold text-white active:bg-white/10"
            >
              <LogOutIcon className="h-4 w-4 shrink-0" />
              {t('shared.logOut')}
            </button>
          </div>

          <SyncBar />
        </header>

        <main className="px-4 pt-4 pb-10">
          {backTo ? (
            <Link
              to={backTo}
              className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-3 text-base font-semibold text-slate-800"
            >
              <ArrowLeftIcon className="h-5 w-5 shrink-0" />
              {t('shared.back')}
            </Link>
          ) : null}

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
    </div>
  );
}
