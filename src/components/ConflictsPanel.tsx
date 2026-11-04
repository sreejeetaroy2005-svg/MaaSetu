/**
 * MaaSetu — two versions of the same record.
 *
 * An offline change that meets a newer server version is never thrown away and
 * never overwrites it. Both versions are written to a conflict record with
 * author and time, and shown here side by side.
 */
import { useTranslation } from 'react-i18next';
import type { ConflictRecord } from '../data/model';
import { formatDateTime } from '../utils/date';
import { AlertIcon } from './icons';

export function ConflictsPanel({
  conflicts,
  names,
  language,
}: {
  conflicts: ConflictRecord[];
  names: Record<string, string>;
  language: string;
}) {
  const { t } = useTranslation();
  if (conflicts.length === 0) return null;

  const describe = (conflict: ConflictRecord) => {
    if (conflict.kind === 'visit.edit') return t('conflict.fieldVisit');
    if (conflict.kind === 'handover') return t('conflict.fieldHandover');
    return t('conflict.fieldMilestone');
  };

  return (
    <section className="mt-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
      <h2 className="flex items-center gap-2 text-lg font-bold text-amber-900">
        <AlertIcon className="h-5 w-5 shrink-0" />
        {t('conflict.title')}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-amber-900">{t('conflict.body')}</p>

      <ul className="mt-3 space-y-3">
        {conflicts.map((conflict) => (
          <li key={conflict.id} className="rounded-xl border border-amber-300 bg-white p-3">
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">{describe(conflict)}</p>
            <div className="mt-2 space-y-2">
              <div className="rounded-lg bg-brand-50 p-2">
                <p className="text-xs font-bold text-brand-800">{t('conflict.yours')}</p>
                <p className="text-base font-semibold break-words text-slate-900">
                  {conflict.ours.value || t('shared.notSet')}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  {t('conflict.by', {
                    name: names[conflict.ours.by] ?? conflict.ours.byName ?? t('journey.unknownWorker'),
                    when: formatDateTime(conflict.ours.at, language),
                  })}
                </p>
              </div>
              <div className="rounded-lg bg-slate-100 p-2">
                <p className="text-xs font-bold text-slate-700">{t('conflict.theirs')}</p>
                <p className="text-base font-semibold break-words text-slate-900">
                  {conflict.theirs.value || t('shared.notSet')}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  {t('conflict.by', {
                    name: names[conflict.theirs.by] ?? conflict.theirs.by ?? t('journey.unknownWorker'),
                    when: formatDateTime(conflict.theirs.at, language),
                  })}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-600">{t('conflict.kept')}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
