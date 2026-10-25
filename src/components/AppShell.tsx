import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { Role } from '../data/model';
import { ArrowLeftIcon } from './icons';
import { LanguageSwitcher } from './LanguageSwitcher';
import { RoleSwitcher } from './RoleSwitcher';

interface AppShellProps {
  /** Which role area this screen belongs to (shown in the header). */
  roleArea: Role;
  title?: string;
  /** Route for the header back button; omitted on home screens. */
  backTo?: string;
  children: ReactNode;
}

/**
 * Mobile-first shell for every screen: 360px layout, header with the language
 * switcher, the demo role switcher in the footer, and the standing safety note.
 */
export function AppShell({ roleArea, title, backTo, children }: AppShellProps) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[30rem] flex-col px-4 pt-4 pb-8">
      <header>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {backTo ? (
              <Link
                to={backTo}
                aria-label={t('shared.back')}
                className="flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-800"
              >
                <ArrowLeftIcon className="h-6 w-6" />
              </Link>
            ) : null}
            <span className="truncate text-sm font-bold tracking-wide text-brand-800 uppercase">
              {t('app.name')}
            </span>
          </div>
          <LanguageSwitcher />
        </div>

        <p className="mt-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {t(`role.${roleArea}`)} · {t('app.syntheticBadge')}
        </p>

        {title ? (
          <h1 className="mt-1 text-2xl leading-tight font-bold text-slate-900">{title}</h1>
        ) : null}
      </header>

      <main className="mt-4 flex-1">{children}</main>

      <footer className="mt-10 border-t border-slate-200 pt-4">
        <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {t('roleSwitcher.label')}
        </p>
        <RoleSwitcher />
        <p className="mt-4 text-sm leading-relaxed text-slate-600">{t('safety.assistive')}</p>
      </footer>
    </div>
  );
}
