import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '../components/AppShell';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { Button, Card, Notice, SectionTitle } from '../components/ui';
import { CheckIcon, ClockIcon, DashCircleIcon, ListIcon, UserIcon } from '../components/icons';
import { useSession } from '../context/SessionContext';
import { hasActiveHandover, motherStatus, statusVillageId } from '../data/handover';
import { doneMilestones, labelKeyFor, nextMilestone } from '../data/journey';
import { MOTHER_MESSAGE_KEYS } from '../data/journeyTemplate';
import type { ConsentLogEntry, Handover, JourneyCard, User, Village } from '../data/model';
import { useAsyncData } from '../hooks/useAsyncData';
import { changeLanguage } from '../i18n';
import { listAllHandovers, listConsentLogs, withdrawConsent } from '../services/handoverService';
import { fetchJourneyCard, listAllUsers, listVillages } from '../services/journeyService';
import { formatDate } from '../utils/date';

interface MotherData {
  villages: Village[];
  users: User[];
  card: JourneyCard | null;
  handovers: Handover[];
  consents: ConsentLogEntry[];
}

/**
 * The mother's own screen: read-only except for consent, which is hers to
 * withdraw. Shows her current village, current health worker and done/next
 * milestones — never advice or interpretation.
 */
export default function MotherHome() {
  const { t, i18n } = useTranslation();
  const { mother, actor } = useSession();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [withdrawnNow, setWithdrawnNow] = useState(false);
  const [languageSynced, setLanguageSynced] = useState(false);

  const { data, loading, error, reload } = useAsyncData<MotherData>(async () => {
    const [villages, users, handovers] = await Promise.all([
      listVillages(),
      listAllUsers(),
      listAllHandovers(),
    ]);
    if (!mother) return { villages, users, card: null, handovers: [], consents: [] };
    const [card, consents] = await Promise.all([
      fetchJourneyCard(mother.id),
      listConsentLogs(mother.id),
    ]);
    return {
      villages,
      users,
      card,
      handovers: handovers.filter((h) => h.motherId === mother.id),
      consents,
    };
  }, [mother?.id]);

  // Her screen opens in her own language, once.
  useEffect(() => {
    if (!mother || languageSynced) return;
    setLanguageSynced(true);
    if (i18n.language !== mother.language) void changeLanguage(mother.language);
  }, [mother, i18n.language, languageSynced]);

  const card = data?.card ?? null;
  const handovers = data?.handovers ?? [];
  const consents = data?.consents ?? [];
  const status = mother ? motherStatus(mother, handovers) : null;
  const handover = status?.handover ?? null;
  const activeConsent = consents.find((c) => c.handoverId === handover?.id) ?? null;
  const villageName = (id: string) => data?.villages.find((v) => v.id === id)?.name ?? '';
  const workerName = (id: string) => data?.users.find((u) => u.id === id)?.name ?? '';

  const done = card ? doneMilestones(card) : [];
  const next = nextMilestone(card);

  const withdraw = async () => {
    if (!mother || !handover || !activeConsent) return;
    setBusy(true);
    setActionError(false);
    try {
      await withdrawConsent(mother, handover, activeConsent, actor ?? { id: mother.id, role: 'mother' });
      setConfirmOpen(false);
      setWithdrawnNow(true);
      reload();
    } catch (caught) {
      console.error('MaaSetu: withdraw consent failed', caught);
      setActionError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title={t('mother.title')} subtitle={t('mother.subtitle')}>
      {loading ? <LoadingState label={t('shared.loading')} /> : null}
      {error ? <ErrorState onRetry={reload} /> : null}

      {!loading && !error && !mother ? (
        <EmptyState
          icon={<UserIcon className="h-6 w-6" />}
          title={t('mother.notFoundTitle')}
          body={t('mother.notFoundBody')}
        />
      ) : null}

      {!loading && !error && mother && status ? (
        <>
          <Card>
            <StatusBadge status={status} villageName={villageName(statusVillageId(status))} />

            <dl className="mt-4 space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-800">
                  <UserIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    {t('mother.currentWorker')}
                  </dt>
                  <dd className="truncate text-lg font-bold text-slate-900">
                    {workerName(status.currentWorkerId) || t('journey.unknownWorker')}
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-800">
                  <ListIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    {t('mother.currentVillage')}
                  </dt>
                  <dd className="truncate text-lg font-bold text-slate-900">
                    {villageName(status.currentVillageId)}
                  </dd>
                </div>
              </div>
            </dl>

            <p className="mt-3 text-base leading-relaxed text-slate-700">
              {t(MOTHER_MESSAGE_KEYS.intro)}
            </p>
          </Card>

          {card === null ? (
            <div className="mt-6">
              <EmptyState
                icon={<ListIcon className="h-6 w-6" />}
                title={t('mother.noCardTitle')}
                body={t('mother.noCardBody')}
              />
            </div>
          ) : (
            <>
              <section className="mt-6">
                <SectionTitle className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-800">
                    <CheckIcon className="h-5 w-5" />
                  </span>
                  {t('mother.doneTitle')}
                </SectionTitle>
                {done.length === 0 ? (
                  <p className="mt-2 rounded-xl bg-slate-100 p-4 text-base leading-relaxed text-slate-700">
                    {t(MOTHER_MESSAGE_KEYS.doneEmpty)}
                  </p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {done.map((milestone) => {
                      const key = labelKeyFor(milestone);
                      return (
                        <li
                          key={milestone.templateId}
                          className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-white p-4"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white">
                            <CheckIcon className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-lg leading-snug font-bold text-slate-900">
                              {key ? t(key) : milestone.name}
                            </span>
                            <span className="block text-base text-slate-600">
                              {formatDate(milestone.doneDate ?? milestone.dueDate, i18n.language)}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="mt-8">
                <SectionTitle className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-900">
                    <ClockIcon className="h-5 w-5" />
                  </span>
                  {t('mother.nextTitle')}
                </SectionTitle>
                {next === null ? (
                  <p className="mt-2 rounded-xl bg-slate-100 p-4 text-base leading-relaxed text-slate-700">
                    {t(MOTHER_MESSAGE_KEYS.nextEmpty)}
                  </p>
                ) : (
                  <div className="mt-3 flex items-start gap-3 rounded-2xl border border-amber-200 bg-white p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900">
                      <ClockIcon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg leading-snug font-bold text-slate-900">
                        {(() => {
                          const key = labelKeyFor(next);
                          return key ? t(key) : next.name;
                        })()}
                      </span>
                      <span className="block text-base font-semibold text-slate-700">
                        {next.dueDate ? formatDate(next.dueDate, i18n.language) : t('journey.dueNotSet')}
                      </span>
                    </span>
                  </div>
                )}
              </section>
            </>
          )}

          {handover && activeConsent && hasActiveHandover(status) ? (
            <Card className="mt-8">
              <SectionTitle>{t('mother.consentTitle')}</SectionTitle>
              <p className="mt-1 text-base leading-relaxed text-slate-700">
                {t('mother.consentGiven', {
                  date: formatDate(activeConsent.grantedAt?.slice(0, 10) ?? null, i18n.language),
                  name: workerName(activeConsent.recordedBy ?? ''),
                })}
              </p>

              {confirmOpen ? (
                <div className="mt-3 rounded-xl border-2 border-red-200 bg-red-50 p-4">
                  <h3 className="text-base font-bold text-red-900">
                    {t('mother.withdrawConfirmTitle')}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-red-900">
                    {t('mother.withdrawConfirmBody', { village: villageName(handover.toVillage) })}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="danger" onClick={() => void withdraw()} disabled={busy}>
                      {busy ? t('shared.saving') : t('mother.withdrawConfirmYes')}
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                      {t('mother.withdrawConfirmNo')}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  full
                  className="mt-3 border-red-600 text-red-700"
                  onClick={() => setConfirmOpen(true)}
                >
                  <DashCircleIcon className="h-5 w-5" />
                  {t('mother.withdraw')}
                </Button>
              )}

              {actionError ? (
                <Notice tone="error" className="mt-2">
                  {t('mother.withdrawError')}
                </Notice>
              ) : null}
            </Card>
          ) : null}

          {withdrawnNow || status.kind === 'consentWithdrawn' ? (
            <Notice tone="warn" className="mt-6">
              {t('mother.withdrawnTitle')} {t('mother.withdrawnBody', { village: villageName(status.currentVillageId) })}
            </Notice>
          ) : null}

          <p className="mt-6 text-sm leading-relaxed text-slate-500">{t('mother.readonly')}</p>
        </>
      ) : null}
    </AppShell>
  );
}
