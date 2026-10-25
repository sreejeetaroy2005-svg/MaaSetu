import { useTranslation } from 'react-i18next';
import { buildActivity } from '../data/handover';
import type { ConsentLogEntry, Handover } from '../data/model';
import { formatDateTime } from '../utils/date';
import { CheckIcon, ClockIcon, DashCircleIcon, PencilIcon } from './icons';

interface ActivityListProps {
  handovers: Handover[];
  consents: ConsentLogEntry[];
  names: Record<string, string>;
  villages: Record<string, string>;
  language: string;
}

/**
 * Recorded activity for a mother: consent given, handover requested, accepted,
 * consent withdrawn. Read-only history taken from the stored records.
 */
export function ActivityList({ handovers, consents, names, villages, language }: ActivityListProps) {
  const { t } = useTranslation();
  const events = buildActivity(handovers, consents);

  if (events.length === 0) {
    return <p className="mt-2 text-base text-slate-600">{t('journey.noActivity')}</p>;
  }

  return (
    <ul className="mt-2 space-y-2">
      {events.map((event) => {
        const Icon =
          event.kind === 'accepted'
            ? CheckIcon
            : event.kind === 'withdrawn'
              ? DashCircleIcon
              : event.kind === 'consent'
                ? PencilIcon
                : ClockIcon;
        const tone =
          event.kind === 'accepted'
            ? 'bg-brand-100 text-brand-800'
            : event.kind === 'withdrawn'
              ? 'bg-slate-200 text-slate-700'
              : 'bg-amber-100 text-amber-900';
        const who = event.byId ? (names[event.byId] ?? t('journey.unknownWorker')) : '';
        const village = event.villageId ? (villages[event.villageId] ?? '') : '';

        const label =
          event.kind === 'requested'
            ? t('journey.activityRequested', { village, name: who })
            : event.kind === 'consent'
              ? t('journey.activityConsent', { name: who })
              : event.kind === 'accepted'
                ? t('journey.activityAccepted', { name: who })
                : t('journey.activityWithdrawn', { name: who });

        return (
          <li key={event.id} className="flex items-start gap-2 rounded-xl bg-slate-50 p-3">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-800">{label}</span>
              <span className="block text-xs text-slate-500">
                {formatDateTime(event.at, language)}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
