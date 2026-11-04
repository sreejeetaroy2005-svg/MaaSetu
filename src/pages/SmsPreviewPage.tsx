/**
 * MaaSetu — mock SMS fallback.
 *
 * When the receiving worker cannot be reached in the app, this screen shows the
 * message that would be sent instead. Nothing is sent: there is no SMS gateway
 * call anywhere in this prototype, and the text carries no health details.
 */
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { EmptyState, LoadingState } from '../components/StateBlock';
import { Card, Notice } from '../components/ui';
import { SmsIcon } from '../components/icons';
import { latestHandover } from '../data/handover';
import { useAsyncData } from '../hooks/useAsyncData';
import { loadWorkspace } from '../offline/repo';

export default function SmsPreviewPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const motherId = params.get('mother');

  const { data, loading } = useAsyncData(async () => {
    const workspace = await loadWorkspace();
    const mother = workspace.mothers.find((item) => item.id === motherId) ?? null;
    if (!mother) return null;
    const handover = latestHandover(workspace.handovers, mother.id);
    const villageName = (id: string) => workspace.villages.find((v) => v.id === id)?.name ?? '';
    const workerName = (id: string) => workspace.users.find((u) => u.id === id)?.name ?? '';
    return {
      mother,
      fromVillage: villageName(handover?.fromVillage ?? mother.village),
      toVillage: villageName(handover?.toVillage ?? ''),
      workerName: workerName(handover?.fromWorkerId ?? mother.registeredBy),
      receiverPhone:
        workspace.users.find((u) => u.id === handover?.toWorkerId)?.phone ?? t('sms.unknownNumber'),
    };
  }, [motherId]);

  return (
    <AppShell backTo="/asha" title={t('sms.title')} subtitle={t('sms.subtitle')}>
      {loading ? <LoadingState label={t('shared.loading')} /> : null}

      {!loading && !data ? (
        <EmptyState
          icon={<SmsIcon className="h-6 w-6" />}
          title={t('sms.noMother')}
          body={t('sms.noMotherBody')}
        />
      ) : null}

      {data ? (
        <>
          <Notice tone="warn">{t('sms.whenUnreachable')}</Notice>

          <Card className="mt-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">{t('sms.mockLabel')}</h2>
              <SmsIcon className="h-5 w-5 shrink-0 text-slate-500" />
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {t('sms.to')}: {data.receiverPhone}
            </p>
            <p className="mt-3 rounded-2xl bg-slate-100 p-3 text-base leading-relaxed text-slate-900">
              {t('sms.message', {
                name: data.mother.name,
                fromVillage: data.fromVillage,
                toVillage: data.toVillage,
                workerName: data.workerName,
              })}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{t('sms.noHealthDetails')}</p>
          </Card>
        </>
      ) : null}
    </AppShell>
  );
}
