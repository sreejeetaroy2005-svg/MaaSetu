import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { labelKeyFor } from '../data/journey';
import type { Milestone, MilestoneStatus } from '../data/model';
import { formatDate, todayIso } from '../utils/date';
import { CheckIcon, ClockIcon, DashCircleIcon } from './icons';

export type MilestonePanel = 'done' | 'due' | null;

interface MilestoneItemProps {
  milestone: Milestone;
  language: string;
  panel: MilestonePanel;
  busy: boolean;
  /** Read-only viewers (sending worker after handover, receiving worker before accepting) see no controls. */
  readOnly?: boolean;
  onOpenPanel: (panel: MilestonePanel) => void;
  onStatus: (status: MilestoneStatus, doneDate: string | null) => void;
  onDueDate: (dueDate: string | null) => void;
}

function RowButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-12 items-center gap-1.5 rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/**
 * One milestone: status (icon + word), recorded dates, and the actions a worker
 * can take. Nothing here interprets the milestone — it only records a status,
 * a date, or a correction, each written through the audit-trailed service.
 */
export function MilestoneItem({
  milestone,
  language,
  panel,
  busy,
  readOnly = false,
  onOpenPanel,
  onStatus,
  onDueDate,
}: MilestoneItemProps) {
  const { t } = useTranslation();
  const [doneDate, setDoneDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(milestone.dueDate ?? '');

  useEffect(() => {
    if (panel === 'done') setDoneDate(todayIso());
    if (panel === 'due') setDueDate(milestone.dueDate ?? '');
  }, [panel, milestone.dueDate]);

  const labelKey = labelKeyFor(milestone);
  const label = labelKey ? t(labelKey) : milestone.name;
  const Icon = milestone.status === 'done' ? CheckIcon : milestone.status === 'missed' ? DashCircleIcon : ClockIcon;
  const tone =
    milestone.status === 'done'
      ? 'bg-brand-100 text-brand-800'
      : milestone.status === 'missed'
        ? 'bg-slate-200 text-slate-700'
        : 'bg-amber-100 text-amber-900';
  const pill =
    milestone.status === 'done'
      ? 'bg-brand-700 text-white'
      : milestone.status === 'missed'
        ? 'bg-slate-700 text-white'
        : 'bg-amber-200 text-amber-900';

  return (
    <li className="rounded-2xl border-2 border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg leading-snug font-bold text-slate-900">{label}</p>
          <p className="mt-1 text-sm text-slate-600">
            {milestone.dueDate
              ? t('journey.dueOn', { date: formatDate(milestone.dueDate, language) })
              : t('journey.dueNotSet')}
          </p>
          {milestone.status === 'done' && milestone.doneDate ? (
            <p className="text-sm font-semibold text-brand-800">
              {t('journey.doneOn', { date: formatDate(milestone.doneDate, language) })}
            </p>
          ) : null}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${pill}`}>
          {t(`journey.status.${milestone.status}`)}
        </span>
      </div>

      <div className={readOnly ? 'hidden' : 'mt-3 flex flex-wrap gap-2'}>
        {milestone.status !== 'done' ? (
          <RowButton onClick={() => onOpenPanel('done')} disabled={busy}>
            <CheckIcon className="h-4 w-4" />
            {t('journey.markDone')}
          </RowButton>
        ) : null}
        {milestone.status !== 'missed' ? (
          <RowButton onClick={() => onStatus('missed', null)} disabled={busy}>
            <DashCircleIcon className="h-4 w-4" />
            {t('journey.markMissed')}
          </RowButton>
        ) : null}
        {milestone.status !== 'upcoming' ? (
          <RowButton onClick={() => onStatus('upcoming', null)} disabled={busy}>
            <ClockIcon className="h-4 w-4" />
            {t('journey.reopen')}
          </RowButton>
        ) : null}
        <RowButton onClick={() => onOpenPanel('due')} disabled={busy}>
          <ClockIcon className="h-4 w-4" />
          {t('journey.editDueDate')}
        </RowButton>
      </div>

      {panel === 'done' && !readOnly ? (
        <div className="mt-3 rounded-xl bg-slate-50 p-3">
          <label htmlFor={`done-${milestone.templateId}`} className="block text-sm font-semibold text-slate-700">
            {t('journey.doneDateLabel')}
          </label>
          <input
            id={`done-${milestone.templateId}`}
            type="date"
            value={doneDate}
            onChange={(event) => setDoneDate(event.target.value)}
            className="mt-1 min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy || !doneDate}
              onClick={() => onStatus('done', doneDate)}
              className="min-h-12 flex-1 rounded-xl bg-brand-700 px-3 font-bold text-white disabled:opacity-60"
            >
              {busy ? t('shared.saving') : t('shared.save')}
            </button>
            <button
              type="button"
              onClick={() => onOpenPanel(null)}
              className="min-h-12 rounded-xl border-2 border-slate-300 px-4 text-sm font-semibold text-slate-700"
            >
              {t('shared.cancel')}
            </button>
          </div>
        </div>
      ) : null}

      {panel === 'due' && !readOnly ? (
        <div className="mt-3 rounded-xl bg-slate-50 p-3">
          <label htmlFor={`due-${milestone.templateId}`} className="block text-sm font-semibold text-slate-700">
            {t('journey.dueDateLabel')}
          </label>
          <input
            id={`due-${milestone.templateId}`}
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="mt-1 min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onDueDate(dueDate ? dueDate : null)}
              className="min-h-12 flex-1 rounded-xl bg-brand-700 px-3 font-bold text-white disabled:opacity-60"
            >
              {busy ? t('shared.saving') : t('shared.save')}
            </button>
            {milestone.dueDate ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onDueDate(null)}
                className="min-h-12 rounded-xl border-2 border-slate-300 px-3 text-sm font-semibold text-slate-700"
              >
                {t('journey.clearDate')}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onOpenPanel(null)}
              className="min-h-12 rounded-xl border-2 border-slate-300 px-3 text-sm font-semibold text-slate-700"
            >
              {t('shared.cancel')}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
