import { useTranslation } from 'react-i18next';
import type { MotherStatus } from '../data/handover';
import { CheckIcon, ClockIcon, DashCircleIcon, UserIcon } from './icons';

interface StatusBadgeProps {
  status: MotherStatus;
  /** Name of the village to show (current village, or destination when moving). */
  villageName: string;
  className?: string;
}

/**
 * One status for every screen: with her village, moving (pending), with the
 * receiving village, or consent withdrawn. Icon + word, never colour alone.
 */
export function StatusBadge({ status, villageName, className = '' }: StatusBadgeProps) {
  const { t } = useTranslation();

  const tone =
    status.kind === 'atHome'
      ? 'bg-brand-100 text-brand-800'
      : status.kind === 'movingPending'
        ? 'bg-amber-100 text-amber-900'
        : status.kind === 'moved'
          ? 'bg-sky-100 text-sky-900'
          : 'bg-slate-200 text-slate-700';

  const Icon =
    status.kind === 'atHome'
      ? UserIcon
      : status.kind === 'movingPending'
        ? ClockIcon
        : status.kind === 'moved'
          ? CheckIcon
          : DashCircleIcon;

  const label =
    status.kind === 'atHome'
      ? t('status.atHome', { village: villageName })
      : status.kind === 'movingPending'
        ? t('status.movingPending', { village: villageName })
        : status.kind === 'moved'
          ? t('status.moved', { village: villageName })
          : t('status.consentWithdrawn');

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${tone} ${className}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </span>
  );
}
