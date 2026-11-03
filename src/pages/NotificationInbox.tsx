import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { BellIcon } from '../components/icons';
import { useSession } from '../context/SessionContext';
import type { Handover, Mother, Notification, User, Village } from '../data/model';
import { useAsyncData } from '../hooks/useAsyncData';
import { listAllHandovers } from '../services/handoverService';
import { listAllMothers, listAllUsers, listVillages } from '../services/journeyService';
import { listNotifications, markNotificationRead } from '../services/notificationService';
import { formatDate, formatDateTime } from '../utils/date';

interface InboxData {
  notifications: Notification[];
  mothers: Mother[];
  villages: Village[];
  users: User[];
  handovers: Handover[];
}

/**
 * In-app inbox: newest first, one fixed translated message per handover event
 * (mother name, villages and worker names only — never health details). Tapping
 * an entry marks it read and opens the mother's card, where normal access rules
 * still apply.
 */
export default function NotificationInbox() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { worker, actor } = useSession();
  const role = worker?.role ?? 'asha';
  const base = `/${role}`;

  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsyncData<InboxData>(async () => {
    if (!worker) {
      return { notifications: [], mothers: [], villages: [], users: [], handovers: [] };
    }
    const [notifications, mothers, villages, users, handovers] = await Promise.all([
      listNotifications(worker.id),
      listAllMothers(),
      listVillages(),
      listAllUsers(),
      listAllHandovers(),
    ]);
    return { notifications, mothers, villages, users, handovers };
  }, [worker?.id]);

  const motherName = (id: string) => data?.mothers.find((m) => m.id === id)?.name ?? '';
  const villageName = (id: string | null | undefined) =>
    id ? (data?.villages.find((v) => v.id === id)?.name ?? '') : '';
  const workerName = (id: string | null | undefined) =>
    id ? (data?.users.find((u) => u.id === id)?.name ?? '') : '';

  const textFor = (notification: Notification): string => {
    const handover = data?.handovers.find((h) => h.id === notification.handoverId) ?? null;
    const name = motherName(notification.motherId);

    switch (notification.type) {
      case 'handover_requested':
        return t('notifications.handover_requested', {
          name,
          fromVillage: villageName(handover?.fromVillage),
          toVillage: villageName(handover?.toVillage),
        });
      case 'handover_accepted':
        return t('notifications.handover_accepted', {
          name,
          workerName: workerName(handover?.acceptedBy ?? handover?.toWorkerId),
        });
      case 'handover_overdue':
        return t('notifications.handover_overdue', {
          name,
          sinceDate: handover ? formatDate(handover.createdAt.slice(0, 10), i18n.language) : '',
        });
      case 'consent_withdrawn':
        return t('notifications.consent_withdrawn', {
          name,
          villageName: villageName(handover?.fromVillage),
        });
      default:
        return t('notifications.generic', { name });
    }
  };

  const openNotification = async (notification: Notification) => {
    if (!actor) return;
    setBusyId(notification.id);
    try {
      await markNotificationRead(notification, actor);
    } catch (caught) {
      console.error('MaaSetu: could not mark notification as read', caught);
    } finally {
      setBusyId(null);
    }
    void navigate(`${base}/mothers/${notification.motherId}`);
  };

  const unread = data?.notifications.filter((n) => n.readAt === null).length ?? 0;

  return (
    <AppShell
      backTo={base}
      title={t('notifications.title')}
      subtitle={unread > 0 ? t('notifications.unreadCount', { count: unread }) : undefined}
    >
      {loading ? <LoadingState label={t('shared.loading')} /> : null}
      {error ? <ErrorState onRetry={reload} /> : null}

      {!loading && !error && data && data.notifications.length === 0 ? (
        <EmptyState
          icon={<BellIcon className="h-6 w-6" />}
          title={t('notifications.emptyTitle')}
          body={t('notifications.emptyBody')}
        />
      ) : null}

      {!loading && !error && data && data.notifications.length > 0 ? (
        <ul className="space-y-3">
          {data.notifications.map((notification) => {
            const unreadItem = notification.readAt === null;
            return (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => void openNotification(notification)}
                  disabled={busyId === notification.id}
                  className={[
                    'flex min-h-20 w-full items-start gap-3 rounded-2xl border p-4 text-left disabled:opacity-70',
                    unreadItem
                      ? 'border-brand-300 bg-brand-50'
                      : 'border-slate-200 bg-white',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                      unreadItem ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-500',
                    ].join(' ')}
                  >
                    <BellIcon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={[
                        'block text-base leading-relaxed',
                        unreadItem ? 'font-bold text-slate-900' : 'font-medium text-slate-700',
                      ].join(' ')}
                    >
                      {textFor(notification)}
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-slate-500">
                      {formatDateTime(notification.audit.createdAt, i18n.language)}
                      {unreadItem ? ` · ${t('notifications.unread')}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </AppShell>
  );
}
