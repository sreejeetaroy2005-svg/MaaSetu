/**
 * MaaSetu — connection indicator.
 *
 * Online / Slow connection / Offline, each with its own colour *and* icon and
 * word, because colour alone is not a signal everyone can read.
 */
import { useTranslation } from 'react-i18next';
import { useNetwork } from '../hooks/useOffline';
import { GaugeIcon, WifiIcon, WifiOffIcon } from './icons';

export function ConnectionBadge({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const { t } = useTranslation();
  const network = useNetwork();
  const status = network.status;

  const Icon = status === 'online' ? WifiIcon : status === 'slow' ? GaugeIcon : WifiOffIcon;
  const label = t(`offline.state.${status}`);

  const tone =
    variant === 'dark'
      ? status === 'online'
        ? 'border-emerald-300/50 bg-emerald-500/20 text-emerald-50'
        : status === 'slow'
          ? 'border-amber-300/60 bg-amber-500/25 text-amber-50'
          : 'border-red-300/60 bg-red-500/25 text-white'
      : status === 'online'
        ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
        : status === 'slow'
          ? 'border-amber-300 bg-amber-50 text-amber-900'
          : 'border-red-300 bg-red-50 text-red-900';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-bold ${tone}`}
      title={t(`offline.hint.${status}`)}
      aria-live="polite"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </span>
  );
}

/** Full-width explanation, used where there is room (cards, banners). */
export function ConnectionNote() {
  const { t } = useTranslation();
  const network = useNetwork();
  if (network.status === 'online') return null;
  return (
    <p
      role="status"
      className={`mt-2 rounded-xl border-2 px-3 py-2 text-sm leading-relaxed font-semibold ${
        network.status === 'slow'
          ? 'border-amber-300 bg-amber-50 text-amber-900'
          : 'border-slate-300 bg-slate-100 text-slate-800'
      }`}
    >
      {t(`offline.hint.${network.status}`)}
    </p>
  );
}
