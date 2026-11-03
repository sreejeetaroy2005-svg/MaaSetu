import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ArrowLeftIcon, HeartIcon } from './icons';

interface EntryShellProps {
  backTo?: string;
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

/** Layout for the screens used before sign-in: brand, language, one action. */
export function EntryShell({ backTo, title, subtitle, children }: EntryShellProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="mx-auto flex min-h-dvh w-full max-w-[30rem] flex-col px-4 pt-4 pb-8">
        <div className="flex min-h-12 items-center gap-2">
          {backTo ? (
            <Link
              to={backTo}
              aria-label={t('shared.back')}
              className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-800"
            >
              <ArrowLeftIcon className="h-6 w-6" />
            </Link>
          ) : (
            <span className="flex items-center gap-2 text-lg font-extrabold tracking-wide text-brand-800">
              <HeartIcon className="h-6 w-6" />
              {t('app.name')}
            </span>
          )}
          <div className="ml-auto">
            <LanguageSwitcher />
          </div>
        </div>

        <main className="mt-6 flex-1">
          {title ? (
            <div className="mb-4">
              <h1 className="text-2xl leading-tight font-bold text-slate-900">{title}</h1>
              {subtitle ? (
                <p className="mt-1 text-base leading-relaxed text-slate-600">{subtitle}</p>
              ) : null}
            </div>
          ) : null}
          {children}
        </main>

        <footer className="mt-8 border-t border-slate-200 pt-4">
          <p className="text-sm leading-relaxed text-slate-600">{t('safety.assistive')}</p>
          <p className="mt-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {t('app.syntheticBadge')}
          </p>
        </footer>
      </div>
    </div>
  );
}
