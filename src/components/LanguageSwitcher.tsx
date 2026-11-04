import { useTranslation } from 'react-i18next';
import { LANGUAGES, LANGUAGE_LABELS, changeLanguage, type LanguageCode } from '../i18n';
import { GlobeIcon } from './icons';

interface LanguageSwitcherProps {
  variant?: 'light' | 'dark';
  /** One 44px dropdown, for the compact header where three pills would crowd. */
  compact?: boolean;
}

/**
 * Language control. Three 44px pills by default; `compact` swaps them for a
 * native dropdown so the header row never overlaps the app name. All three
 * languages always ship together.
 */
export function LanguageSwitcher({ variant = 'light', compact = false }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation();
  const dark = variant === 'dark';

  if (compact) {
    return (
      <select
        aria-label={t('language.label')}
        value={i18n.language}
        onChange={(event) => void changeLanguage(event.target.value as LanguageCode)}
        className={[
          'min-h-11 rounded-xl border-2 px-1.5 text-base font-bold',
          dark
            ? 'border-white/40 bg-transparent text-white'
            : 'border-slate-300 bg-white text-slate-800',
        ].join(' ')}
      >
        {LANGUAGES.map((code: LanguageCode) => (
          <option key={code} value={code} lang={code} className="text-slate-900">
            {LANGUAGE_LABELS[code]}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div role="group" aria-label={t('language.label')} className="flex flex-wrap items-center gap-1.5">
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
              'min-h-11 min-w-11 rounded-xl border-2 px-2 text-base font-bold transition-colors',
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
