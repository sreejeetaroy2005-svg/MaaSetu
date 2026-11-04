/**
 * MaaSetu — sync state in the UI.
 *
 * The header bar carries the connection, the "Pending changes: N" counter and
 * the manual "Sync now" button. Each record (a visit, a milestone, a handover)
 * carries its own small "Waiting to sync" / "Synced" chip.
 *
 * Wording rule: a queued change is never described as sent. Until Firestore
 * confirms it, the chip says the change is on this phone only.
 */
import { useTranslation } from 'react-i18next';
import { syncNow } from '../offline/sync';
import { removeOp } from '../offline/queue';
import { useNetwork, usePendingCount, useQueue } from '../hooks/useOffline';
import type { OpStatus, PendingOp } from '../offline/types';
import { AlertIcon, CheckIcon, CloudDoneIcon, ClockIcon, RefreshIcon } from './icons';

export function SyncBar() {
  const { t } = useTranslation();
  const network = useNetwork();
  const queue = useQueue();
  const count = usePendingCount();
  const offline = network.status === 'offline';

  return (
    <div className="flex items-center gap-2 border-t border-white/15 px-4 py-1.5">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-bold ${
          network.status === 'online'
            ? 'border-emerald-300/50 bg-emerald-500/20 text-emerald-50'
            : network.status === 'slow'
              ? 'border-amber-300/60 bg-amber-500/25 text-amber-50'
              : 'border-red-300/60 bg-red-500/25 text-white'
        }`}
        aria-live="polite"
      >
        {network.status === 'online' ? <CloudDoneIcon className="h-4 w-4" /> : <AlertIcon className="h-4 w-4" />}
        {t(`offline.state.${network.status}`)}
      </span>

      <p className="min-w-0 flex-1 truncate text-xs font-semibold text-white/90">
        {count > 0 ? t('offline.pendingCount', { count }) : t('offline.allSynced')}
      </p>

      {count > 0 ? (
        <button
          type="button"
          onClick={() => void syncNow()}
          disabled={offline || queue.syncing}
          className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg border border-white/60 px-2 text-xs font-bold text-white active:bg-white/10 disabled:opacity-50"
        >
          <RefreshIcon className={`h-3.5 w-3.5 ${queue.syncing ? 'animate-spin' : ''}`} />
          {queue.syncing ? t('offline.syncing') : t('offline.syncNow')}
        </button>
      ) : null}
    </div>
  );
}

/** The per-record chip. */
export function SyncChip({ state, className = '' }: { state: OpStatus | undefined; className?: string }) {
  const { t } = useTranslation();
  if (!state) return null;

  const tone =
    state === 'synced'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : state === 'rejected'
        ? 'bg-red-50 text-red-800 border-red-200'
        : state === 'failed'
          ? 'bg-red-50 text-red-800 border-red-200'
          : 'bg-amber-50 text-amber-900 border-amber-200';

  const Icon = state === 'synced' ? CheckIcon : state === 'waiting' || state === 'syncing' ? ClockIcon : AlertIcon;
  const label =
    state === 'synced'
      ? t('offline.synced')
      : state === 'syncing'
        ? t('offline.syncing')
        : state === 'rejected'
          ? t('offline.rejected')
          : state === 'failed'
            ? t('offline.failed')
            : t('offline.waitingToSync');

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[13px] font-bold ${tone} ${className}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </span>
  );
}

/**
 * A change the server refused. Shown wherever the person is, because the reason
 * matters: an accept whose consent was withdrawn is never applied, and saying
 * so is the whole point of queueing it instead of pretending it worked.
 */
export function RejectedChanges() {
  const { t } = useTranslation();
  const queue = useQueue();
  const rejected = queue.ops.filter((op) => op.status === 'rejected');
  if (rejected.length === 0) return null;

  const describe = (op: PendingOp) => {
    if (op.kind === 'handover.accept' && op.rejectedReason === 'consent_withdrawn') {
      return { title: t('offline.rejectedAcceptTitle'), body: t('offline.rejectedAcceptBody') };
    }
    if (op.kind === 'handover.accept' || op.kind === 'handover.start') {
      return { title: t('offline.rejectedHandoverTitle'), body: t('offline.rejectedHandoverBody') };
    }
    if (op.kind === 'visit.add' || op.kind === 'visit.edit') {
      return { title: t('offline.visitMissingTitle'), body: t('offline.visitMissingBody') };
    }
    return { title: t('offline.rejected'), body: t('offline.rejectedHandoverBody') };
  };

  return (
    <div className="mt-3 space-y-2">
      {rejected.map((op) => {
        const copy = describe(op);
        return (
          <section
            key={op.id}
            role="alert"
            className="rounded-2xl border-2 border-red-300 bg-red-50 p-3"
          >
            <h2 className="flex items-center gap-2 text-base font-bold text-red-900">
              <AlertIcon className="h-5 w-5 shrink-0" />
              {copy.title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-red-900">{copy.body}</p>
            <button
              type="button"
              onClick={() => void removeOp(op.id)}
              className="mt-2 min-h-11 rounded-lg border-2 border-red-300 bg-white px-3 text-sm font-bold text-red-800"
            >
              {t('offline.dismiss')}
            </button>
          </section>
        );
      })}
    </div>
  );
}

/** Banner for a change that is queued on this device (consent, accept, withdrawal). */
export function QueuedNotice({
  tone = 'warn',
  title,
  body,
}: {
  tone?: 'warn' | 'info';
  title: string;
  body: string;
}) {
  return (
    <section
      role="status"
      className={`mt-3 rounded-2xl border-2 p-4 ${
        tone === 'warn' ? 'border-amber-300 bg-amber-50' : 'border-slate-300 bg-slate-100'
      }`}
    >
      <h3 className={`flex items-center gap-2 text-base font-bold ${tone === 'warn' ? 'text-amber-900' : 'text-slate-900'}`}>
        <ClockIcon className="h-5 w-5 shrink-0" />
        {title}
      </h3>
      <p className={`mt-1 text-sm leading-relaxed ${tone === 'warn' ? 'text-amber-900' : 'text-slate-800'}`}>
        {body}
      </p>
    </section>
  );
}
