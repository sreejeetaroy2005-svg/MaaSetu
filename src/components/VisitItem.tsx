import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Visit } from '../data/model';
import type { VisitInput } from '../services/journeyService';
import { formatDate, formatDateTime } from '../utils/date';
import { PencilIcon } from './icons';

interface VisitItemProps {
  visit: Visit;
  /** Worker id → name, for "entered by" and edit history. */
  names: Record<string, string>;
  language: string;
  editing: boolean;
  busy: boolean;
  /** Read-only viewers see the entry and its history, but no edit control. */
  readOnly?: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: (input: VisitInput) => void;
}

/**
 * One visit entry. The note is shown exactly as typed and is never
 * interpreted. Correcting an entry keeps the earlier version in a history
 * list — there is no delete control anywhere.
 */
export function VisitItem({
  visit,
  names,
  language,
  editing,
  busy,
  readOnly = false,
  onStartEdit,
  onCancel,
  onSave,
}: VisitItemProps) {
  const { t } = useTranslation();
  const [date, setDate] = useState(visit.date);
  const [note, setNote] = useState(visit.note);

  useEffect(() => {
    if (editing) {
      setDate(visit.date);
      setNote(visit.note);
    }
  }, [editing, visit.date, visit.note]);

  const enteredByName = names[visit.enteredBy] ?? t('journey.unknownWorker');

  if (editing && !readOnly) {
    return (
      <li className="rounded-2xl border-2 border-brand-300 bg-white p-4">
        <p className="text-sm font-bold text-slate-700">{t('journey.editVisitTitle')}</p>
        <label htmlFor={`visit-date-${visit.id}`} className="mt-2 block text-sm font-semibold text-slate-700">
          {t('journey.visitDate')}
        </label>
        <input
          id={`visit-date-${visit.id}`}
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="mt-1 min-h-12 w-full rounded-xl border-2 border-slate-300 px-3 text-base"
        />
        <label htmlFor={`visit-note-${visit.id}`} className="mt-2 block text-sm font-semibold text-slate-700">
          {t('journey.visitNote')}
        </label>
        <textarea
          id={`visit-note-${visit.id}`}
          value={note}
          rows={3}
          onChange={(event) => setNote(event.target.value)}
          className="mt-1 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !date || note.trim().length === 0}
            onClick={() => onSave({ date, note })}
            className="min-h-12 flex-1 rounded-xl bg-brand-700 px-3 font-bold text-white disabled:opacity-60"
          >
            {busy ? t('shared.saving') : t('shared.save')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 rounded-xl border-2 border-slate-300 px-4 text-sm font-semibold text-slate-700"
          >
            {t('shared.cancel')}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">{t('journey.keepHistory')}</p>
      </li>
    );
  }

  return (
    <li className="rounded-2xl border-2 border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-slate-900">{formatDate(visit.date, language)}</p>
          <p className="mt-1 text-base leading-relaxed break-words whitespace-pre-wrap text-slate-800">
            {visit.note}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {t('journey.enteredBy', {
              name: enteredByName,
              date: formatDateTime(visit.enteredAt, language),
            })}
          </p>
        </div>
        {readOnly ? null : (
          <button
            type="button"
            onClick={onStartEdit}
            className="flex min-h-12 shrink-0 items-center gap-1 rounded-xl border-2 border-slate-300 px-3 text-sm font-semibold text-slate-800"
          >
            <PencilIcon className="h-4 w-4" />
            {t('journey.editVisit')}
          </button>
        )}
      </div>

      {visit.revisions.length > 0 ? (
        <details className="mt-2">
          <summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold text-brand-800">
            {t('journey.history')} ({visit.revisions.length})
          </summary>
          <ul className="mt-1 space-y-2 border-l-2 border-slate-200 pl-3">
            {visit.revisions.map((revision, index) => (
              <li key={`${visit.id}-rev-${index}`} className="text-xs leading-relaxed text-slate-600">
                <p className="font-semibold">{formatDate(revision.date, language)}</p>
                <p className="break-words whitespace-pre-wrap">{revision.note}</p>
                <p>
                  {t('journey.historyItem', {
                    name: names[revision.editedBy] ?? t('journey.unknownWorker'),
                    editedAt: formatDateTime(revision.editedAt, language),
                  })}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}
