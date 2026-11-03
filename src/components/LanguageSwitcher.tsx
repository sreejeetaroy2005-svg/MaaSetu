import { useTranslation } from 'react-i18next';
import { LANGUAGES, LANGUAGE_LABELS, changeLanguage, type LanguageCode } from '../i18n';
import { GlobeIcon } from './icons';

/** EN / हिं / मरा switcher (48px targets). All three languages ship together. */
export function LanguageSwitcher({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const { t, i18n } = useTranslation();
  const dark = variant === 'dark';

  return (
    <div role="group" aria-label={t('language.label')} className="flex items-center gap-1.5">
      <GlobeIcon className={`h-5 w-5 shrink-0 ${dark ? 'text-white/80' : 'text-slate-500'}`} />
      {LANGUAGES.map((code: LanguageCode) => {
        const active = i18n.language === code;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={active}
            onClick={() => void changeLanguage(code)}
            className={[
              'min-h-12 min-w-12 rounded-xl border-2 px-2 text-sm font-bold transition-colors',
              active
                ? dark
                  ? 'border-white bg-white text-brand-800'
                  : 'border-brand-700 bg-brand-700 text-white'
                : dark
                  ? 'border-white/40 bg-transparent text-white'
                  : 'border-slate-300 bg-white text-slate-800',
            ].join(' ')}
          >
            {LANGUAGE_LABELS[code]}
          </button>
        );
      })}
    </div>
  );
}
