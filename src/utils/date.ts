/**
 * Date helpers. Dates are stored as `YYYY-MM-DD` strings (local calendar day)
 * and timestamps as ISO 8601 UTC strings. Formatting only — no arithmetic on
 * care milestones, so nothing about a date can be interpreted as clinical.
 */
import type { Language } from '../data/model';

const LOCALES: Record<Language, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
};

function localeFor(language: string): string {
  return LOCALES[language as Language] ?? 'en-IN';
}

/** `YYYY-MM-DD` in the device's local timezone. */
export function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** `2026-11-20` → `20 Nov 2026` (localised). */
export function formatDate(iso: string | null, language: string): string {
  if (!iso) return '';
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(localeFor(language), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** Full ISO timestamp → `12 Oct 2026, 3:40 pm` (localised). */
export function formatDateTime(iso: string, language: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(localeFor(language), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/** `2026-11` → `Nov 2026` (localised); used for the expected delivery month. */
export function formatMonth(ym: string | null, language: string): string {
  if (!ym) return '';
  const date = new Date(`${ym}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return ym;
  return new Intl.DateTimeFormat(localeFor(language), {
    month: 'short',
    year: 'numeric',
  }).format(date);
}
