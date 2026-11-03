import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { Card } from '../components/ui';
import { buttonClass } from '../components/ui';
import { HeartIcon } from '../components/icons';
import { useSession } from '../context/SessionContext';
import type { Handover, Mother, User, Village } from '../data/model';
import { useAsyncData } from '../hooks/useAsyncData';
import { listAllHandovers } from '../services/handoverService';
import { listAllMothers, listAllUsers, listVillages } from '../services/journeyService';
import { formatDateTime } from '../utils/date';

interface PreviewData {
  handover: Handover | null;
  mother: Mother | null;
  villages: Village[];
  users: User[];
}

/**
 * MOCK ONLY — what the WhatsApp message would look like. Nothing is sent and
 * no API is called. The text carries the mother's name, the two villages and
 * the worker's name; it never mentions any health detail.
 */
export default function WhatsAppPreviewPage() {
  const { t, i18n } = useTranslation();
  const { worker } = useSession();
  const role = worker?.role ?? 'asha';
  const base = `/${role}`;

  const { data, loading, error, reload } = useAsyncData<PreviewData>(async () => {
    const [handovers, mothers, villages, users] = await Promise.all([
      listAllHandovers(),
      listAllMothers(),
      listVillages(),
      listAllUsers(),
    ]);
    const mine = handovers
      .filter((h) => worker && (h.fromWorkerId === worker.id || h.toWorkerId === worker.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const handover = mine[0] ?? null;
    return {
      handover,
      mother: handover ? (mothers.find((m) => m.id === handover.motherId) ?? null) : null,
      villages,
      users,
    };
  }, [worker?.id]);

  const villageName = (id: string | null | undefined) =>
    id ? (data?.villages.find((v) => v.id === id)?.name ?? '') : '';
  const workerName = (id: string | null | undefined) =>
    id ? (data?.users.find((u) => u.id === id)?.name ?? '') : '';

  return (
    <AppShell backTo={base} title={t('whatsapp.title')} subtitle={t('whatsapp.subtitle')}>
      {loading ? <LoadingState label={t('shared.loading')} /> : null}
      {error ? <ErrorState onRetry={reload} /> : null}

      {!loading && !error && (!data || !data.handover || !data.mother) ? (
        <EmptyState
          icon={<HeartIcon className="h-6 w-6" />}
          title={t('whatsapp.noMother')}
          body={t('whatsapp.noMotherBody')}
          action={
            <Link to={base} className={buttonClass('primary')}>
              {t('whatsapp.noMotherAction')}
            </Link>
          }
        />
      ) : null}

      {!loading && !error && data && data.handover && data.mother ? (
        <>
          <Card className="bg-[#e7ffdb] border-[#c8e6b8]">
            <div className="flex items-center gap-2 border-b border-[#c8e6b8] pb-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25d366] text-white">
                <HeartIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-slate-900">MaaSetu</p>
                <p className="text-xs text-slate-600">{t('whatsapp.mockLabel')}</p>
              </div>
            </div>

            <p className="mt-3 rounded-xl bg-white p-3 text-base leading-relaxed text-slate-900">
              {t('whatsapp.message', {
                name: data.mother.name,
                fromVillage: villageName(data.handover.fromVillage),
                toVillage: villageName(data.handover.toVillage),
                workerName: workerName(data.handover.fromWorkerId),
              })}
            </p>

            <p className="mt-2 text-right text-xs text-slate-600">
              {formatDateTime(data.handover.createdAt, i18n.language)}
            </p>
          </Card>

          <p className="mt-3 text-sm leading-relaxed text-slate-600">{t('whatsapp.noHealthDetails')}</p>
        </>
      ) : null}
    </AppShell>
  );
}
