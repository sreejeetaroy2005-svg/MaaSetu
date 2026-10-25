/**
 * MaaSetu — i18n bootstrap.
 *
 * All UI text lives in `src/i18n/locales/*.json` (English, Hindi, Marathi);
 * nothing user-facing is hard-coded in components.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import hi from './locales/hi.json';
import mr from './locales/mr.json';

export const LANGUAGES = ['en', 'hi', 'mr'] as const;
export type LanguageCode = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  en: 'EN',
  hi: 'हिं',
  mr: 'मरा',
};

const STORAGE_KEY = 'maasetu.language';

function initialLanguage(): LanguageCode {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && (LANGUAGES as readonly string[]).includes(saved)) return saved as LanguageCode;
  const browser = navigator.language.slice(0, 2);
  if (browser === 'hi') return 'hi';
  if (browser === 'mr') return 'mr';
  return 'en';
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { common: en },
    hi: { common: hi },
    mr: { common: mr },
  },
  lng: initialLanguage(),
  fallbackLng: 'en',
  ns: ['common'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export async function changeLanguage(code: LanguageCode): Promise<void> {
  localStorage.setItem(STORAGE_KEY, code);
  document.documentElement.lang = code;
  await i18n.changeLanguage(code);
}

document.documentElement.lang = i18n.language;

export default i18n;
