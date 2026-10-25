import { useTranslation } from 'react-i18next';
import { LANGUAGES, LANGUAGE_LABELS, changeLanguage, type LanguageCode } from '../i18n';

/** EN / हिं / मरा switcher (48px targets). All three languages ship together. */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  return (
    <div role="group" aria-label={t('language.label')} className="flex shrink-0 items-center gap-1">
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
                ? 'border-brand-700 bg-brand-700 text-white'
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
