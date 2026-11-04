/**
 * MaaSetu — the care tracker, on screen.
 *
 * One vertical timeline of the move, built from {@link buildCareTracker}. Two
 * audiences, same steps:
 *  - the mother sees a large, plain timeline ("Your new health worker has seen
 *    your details"), her current worker and a Call button
 *  - her workers see the same steps with timestamps and who did each one
 *
 * A stage is only ever drawn as complete when a stored record says so; a
 * change still on the phone is labelled "Not sent yet".
 */
import { useTranslation } from 'react-i18next';
import {
  overdueDays,
  type CareTracker as CareTrackerModel,
  type TrackerStage,
  type TrackerStageState,
} from '../data/tracker';
import { formatDateTime } from '../utils/date';
import { AlertIcon, CheckIcon, ClockIcon, DashCircleIcon, PhoneIcon, RefreshIcon } from './icons';

const CIRCLE: Record<TrackerStageState, string> = {
  done: 'bg-emerald-600 text-white',
  current: 'bg-amber-100 text-amber-900 ring-2 ring-amber-500',
  waiting: 'bg-slate-100 text-slate-500',
  stopped: 'bg-slate-200 text-slate-500',
};

function StageIcon({ state }: { state: TrackerStageState }) {
  if (state === 'done') return <CheckIcon className="h-5 w-5" />;
  if (state === 'current') return <ClockIcon className="h-5 w-5" />;
  return <DashCircleIcon className="h-5 w-5" />;
}

export interface CareTrackerProps {
  /** While the records are loading, draw the skeleton instead of nothing. */
  loading?: boolean;
  tracker: CareTrackerModel | null;
  names: Record<string, string>;
  villages: Record<string, string>;
  language: string;
  /** `mother` → simple wording and a Call button; `worker` → timestamps + who. */
  audience: 'mother' | 'worker';
  /** Her current worker's phone, for the Call button (mother view only). */
  workerPhone?: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  className?: string;
}

/** Skeleton so the timeline never pops in as a blank block. */
export function CareTrackerSkeleton() {
  return (
    <section
      aria-hidden="true"
      className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="h-6 w-36 animate-pulse rounded bg-slate-200" />
      <div className="mt-4 space-y-4">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-200" />
            <div className="h-4 flex-1 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function CareTracker({
  loading = false,
  tracker,
  names,
  villages,
  language,
  audience,
  workerPhone = null,
  onRefresh,
  refreshing = false,
  className = '',
}: CareTrackerProps) {
  const { t } = useTranslation();
  if (loading) return <CareTrackerSkeleton />;
  if (!tracker) return null;

  const person = (id: string | null) => (id ? names[id] ?? t('tracker.personUnknown') : t('tracker.personUnknown'));
  const village = (id: string | null) => (id ? villages[id] ?? '' : '');

  const stageLabel = (stage: TrackerStage) =>
    audience === 'mother' ? t(`tracker.motherStage.${stage.id}`) : t(`tracker.stage.${stage.id}`);

  return (
    <section className={`mt-4 ${className}`.trim()}>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-slate-900">{t('tracker.title')}</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{t('tracker.subtitle')}</p>
          </div>
          <span
            className="shrink-0 rounded-full bg-brand-100 px-3 py-1 text-sm font-bold text-brand-800"
            aria-label={t('tracker.progressLabel', {
              done: tracker.doneCount,
              total: tracker.total,
            })}
          >
            {t('tracker.progress', { done: tracker.doneCount, total: tracker.total })}
          </span>
        </div>

        {tracker.notSentYet ? (
          <div role="status" className="mt-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
            <p className="flex items-center gap-2 text-base font-bold text-amber-900">
              <ClockIcon className="h-5 w-5 shrink-0" />
              {t('tracker.notSentYet')}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-amber-900">{t('tracker.notSentYetBody')}</p>
          </div>
        ) : null}

        {audience === 'worker' && tracker.overdueSince && !tracker.withdrawn ? (
          <div className="mt-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
            <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
              <ClockIcon className="h-4 w-4 shrink-0" />
              {t('tracker.overdue', { count: overdueDays(tracker.overdueSince) })}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-amber-900">
              {t('tracker.overdueBody', { village: village(tracker.toVillageId) })}
            </p>
          </div>
        ) : null}

        <ol className="mt-4">
          {tracker.stages.map((stage, index) => (
            <li key={stage.id} className="relative flex gap-3 pb-4 last:pb-0">
              {index < tracker.stages.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={`absolute top-11 bottom-0 left-[19px] w-0.5 ${
                    stage.state === 'done' ? 'bg-emerald-200' : 'bg-slate-200'
                  }`}
                />
              ) : null}
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${CIRCLE[stage.state]}`}
              >
                <StageIcon state={stage.state} />
              </span>
              <div
                className={`min-w-0 flex-1 ${
                  stage.state === 'current' ? 'rounded-xl bg-brand-50 px-2 py-1' : ''
                }`}
              >
                <p
                  className={`text-base leading-snug font-bold ${
                    stage.state === 'waiting' || stage.state === 'stopped'
                      ? 'text-slate-500'
                      : 'text-slate-900'
                  }`}
                >
                  {stageLabel(stage)}
                </p>

                {stage.at ? (
                  <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
                    {audience === 'worker'
                      ? t(`tracker.detail.${stage.id}`, {
                          name: person(stage.byId),
                          when: formatDateTime(stage.at, language),
                          village: village(stage.villageId),
                        })
                      : formatDateTime(stage.at, language)}
                  </p>
                ) : stage.state === 'current' ? (
                  <p className="mt-0.5 text-sm font-semibold text-brand-800">
                    {audience === 'worker' && tracker.notSentYet && stage.id === 'sent'
                      ? t('tracker.notSentYet')
                      : t('tracker.current')}
                  </p>
                ) : stage.state === 'stopped' ? (
                  <p className="mt-0.5 text-sm text-slate-500">{t('tracker.stopped')}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        {tracker.withdrawn ? (
          <div className="mt-4 rounded-xl border-2 border-slate-300 bg-slate-100 p-3">
            <p className="flex items-center gap-2 text-base font-bold text-slate-900">
              <AlertIcon className="h-5 w-5 shrink-0" />
              {t('tracker.withdrawnTitle')}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">
              {audience === 'mother'
                ? t('tracker.motherWithdrawnBody', {
                    when: formatDateTime(tracker.withdrawn.at, language),
                  })
                : t('tracker.withdrawnBody', {
                    when: formatDateTime(tracker.withdrawn.at, language),
                  })}
            </p>
            {audience === 'worker' ? (
              <p className="mt-1 text-sm leading-relaxed text-slate-700">
                {t('tracker.withdrawnBy', {
                  name: person(tracker.withdrawn.byId),
                  when: formatDateTime(tracker.withdrawn.at, language),
                })}
              </p>
            ) : null}
          </div>
        ) : null}

        {audience === 'mother' && workerPhone ? (
          <a
            href={`tel:${workerPhone}`}
            className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 px-4 text-base font-bold text-white"
          >
            <PhoneIcon className="h-5 w-5" />
            {t('tracker.call', { name: person(tracker.currentWorkerId) })}
          </a>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
          <p className="text-sm text-slate-500">
            {tracker.lastUpdatedAt
              ? t('tracker.lastUpdated', {
                  when: formatDateTime(tracker.lastUpdatedAt, language),
                })
              : t('tracker.lastUpdatedUnknown')}
          </p>
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 disabled:opacity-60"
            >
              <RefreshIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? t('tracker.refreshing') : t('tracker.refresh')}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Small "3 of 5" bar for the handover list. */
export function TrackerProgress({
  done,
  total,
  className = '',
}: {
  done: number;
  total: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <span className={`inline-flex items-center gap-2 ${className}`.trim()}>
      <span className="h-2 w-16 shrink-0 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
        <span className="block h-full rounded-full bg-brand-600" style={{ width: `${percent}%` }} />
      </span>
      <span
        className="text-[13px] font-bold text-slate-700"
        aria-label={t('tracker.progressLabel', { done, total })}
      >
        {t('tracker.progress', { done, total })}
      </span>
    </span>
  );
}
