import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '../components/AppShell';
import { ErrorState, LoadingState } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { CheckIcon, ClockIcon, DashCircleIcon, ListIcon, UserIcon } from '../components/icons';
import { useSession } from '../context/SessionContext';
import { hasActiveHandover, motherStatus, statusVillageId } from '../data/handover';
import { doneMilestones, labelKeyFor, nextMilestone } from '../data/journey';
import { MOTHER_MESSAGE_KEYS } from '../data/journeyTemplate';
import type { ConsentLogEntry, Handover, JourneyCard, Mother, User, Village } from '../data/model';
import { useAsyncData } from '../hooks/useAsyncData';
import { changeLanguage } from '../i18n';
import { listConsentLogs, listAllHandovers, withdrawConsent } from '../services/handoverService';
import { fetchJourneyCard, listAllMothers, listAllUsers, listVillages } from '../services/journeyService';
import { formatDate } from '../utils/date';

interface MotherData {
  mothers: Mother[];
  villages: Village[];
  users: User[];
  mother: Mother | null;
  card: JourneyCard | null;
  handovers: Handover[];
  consents: ConsentLogEntry[];
}

/**
 * The mother's own screen: read-only except for consent, which is hers to
 * withdraw. Shows her current village, current health worker, done/next
 * milestones and the consent she gave — never advice or interpretation.
 */
export default function MotherHome() {
  const { t, i18n } = useTranslation();
  const { demoMotherId, setDemoMotherId, actorFor } = useSession();
  const [syncedMotherId, setSyncedMotherId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [withdrawnNow, setWithdrawnNow] = useState(false);

  const { data, loading, error, reload } = useAsyncData<MotherData>(async () => {
    const [mothers, villages, users, handovers] = await Promise.all([
      listAllMothers(),
      listVillages(),
      listAllUsers(),
      listAllHandovers(),
    ]);
    const mother = mothers.find((m) => m.id === demoMotherId) ?? mothers[0] ?? null;
    if (!mother) {
      return { mothers, villages, users, mother: null, card: null, handovers: [], consents: [] };
    }
    const [card, consents] = await Promise.all([
      fetchJourneyCard(mother.id),
      listConsentLogs(mother.id),
    ]);
    return {
      mothers,
      villages,
      users,
      mother,
      card,
      handovers: handovers.filter((h) => h.motherId === mother.id),
      consents,
    };
  }, [demoMotherId]);

  // Only repair a stored demo identity that no longer exists in the data;
  // never override a selection the user just made.
  useEffect(() => {
    if (loading || error || !data?.mother) return;
    if (!data.mothers.some((mother) => mother.id === demoMotherId)) {
      setDemoMotherId(data.mother.id);
    }
  }, [data, loading, error, demoMotherId, setDemoMotherId]);

  // Her screen opens in her chosen language, once per selected mother.
  useEffect(() => {
    const mother = data?.mother;
    if (mother && syncedMotherId !== mother.id) {
      setSyncedMotherId(mother.id);
      void changeLanguage(mother.language);
    }
  }, [data, syncedMotherId]);

  const mother = data?.mother ?? null;
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
      await withdrawConsent(mother, handover, activeConsent, actorFor('mother'));
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
    <AppShell roleArea="mother" title={t('mother.title')}>
      {loading ? <LoadingState label={t('shared.loading')} /> : null}
      {error ? <ErrorState onRetry={reload} /> : null}

      {!loading && !error && data && mother && status ? (
        <>
          <section className="rounded-2xl border-2 border-slate-200 bg-white p-4">
            <label
              htmlFor="mother-select"
              className="text-xs font-semibold tracking-wide text-slate-500 uppercase"
            >
              {t('mother.viewAs')}
            </label>
            <select
              id="mother-select"
              value={mother.id}
              onChange={(event) => setDemoMotherId(event.target.value)}
              className="mt-1 min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base font-semibold text-slate-900"
            >
              {data.mothers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </section>

          <section className="mt-4 rounded-3xl border-2 border-brand-100 bg-white p-5">
            <h2 className="text-3xl leading-tight font-bold text-slate-900">{mother.name}</h2>
            <div className="mt-2">
              <StatusBadge status={status} villageName={villageName(statusVillageId(status))} />
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-3">
              <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-800">
                  <UserIcon className="h-5 w-5" />
                </span>
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    {t('mother.currentWorker')}
                  </dt>
                  <dd className="text-lg font-bold text-slate-900">
                    {workerName(status.currentWorkerId) || t('journey.unknownWorker')}
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-800">
                  <ListIcon className="h-5 w-5" />
                </span>
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    {t('mother.currentVillage')}
                  </dt>
                  <dd className="text-lg font-bold text-slate-900">
                    {villageName(status.currentVillageId)}
                  </dd>
                </div>
              </div>
            </dl>

            <p className="mt-3 text-base leading-relaxed text-slate-700">
              {t(MOTHER_MESSAGE_KEYS.intro)}
            </p>
          </section>

          {card === null ? (
            <section className="mt-6 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5 text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <ListIcon className="h-6 w-6" />
              </div>
              <p className="text-xl font-bold text-slate-900">{t('mother.noCardTitle')}</p>
              <p className="mt-1 text-base text-slate-600">{t('mother.noCardBody')}</p>
            </section>
          ) : (
            <>
              <section className="mt-6">
                <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-800">
                    <CheckIcon className="h-5 w-5" />
                  </span>
                  {t('mother.doneTitle')}
                </h2>
                {done.length === 0 ? (
                  <p className="mt-2 rounded-2xl bg-slate-100 p-4 text-lg leading-relaxed text-slate-700">
                    {t(MOTHER_MESSAGE_KEYS.doneEmpty)}
                  </p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {done.map((milestone) => {
                      const key = labelKeyFor(milestone);
                      return (
                        <li
                          key={milestone.templateId}
                          className="flex items-start gap-3 rounded-2xl border-2 border-brand-100 bg-white p-4"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white">
                            <CheckIcon className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xl leading-snug font-bold text-slate-900">
                              {key ? t(key) : milestone.name}
                            </span>
                            <span className="block text-lg text-slate-600">
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
                <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-900">
                    <ClockIcon className="h-5 w-5" />
                  </span>
                  {t('mother.nextTitle')}
                </h2>
                {next === null ? (
                  <p className="mt-2 rounded-2xl bg-slate-100 p-4 text-lg leading-relaxed text-slate-700">
                    {t(MOTHER_MESSAGE_KEYS.nextEmpty)}
                  </p>
                ) : (
                  <div className="mt-3 flex items-start gap-3 rounded-2xl border-2 border-amber-200 bg-white p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900">
                      <ClockIcon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xl leading-snug font-bold text-slate-900">
                        {(() => {
                          const key = labelKeyFor(next);
                          return key ? t(key) : next.name;
                        })()}
                      </span>
                      <span className="block text-lg font-semibold text-slate-700">
                        {next.dueDate ? formatDate(next.dueDate, i18n.language) : t('journey.dueNotSet')}
                      </span>
                    </span>
                  </div>
                )}
              </section>
            </>
          )}

          {handover && activeConsent && hasActiveHandover(status) ? (
            <section className="mt-8 rounded-2xl border-2 border-slate-200 bg-white p-4">
              <h2 className="text-xl font-bold text-slate-900">{t('mother.consentTitle')}</h2>
              <p className="mt-1 text-base leading-relaxed text-slate-700">
                {t('mother.consentGiven', {
                  date: formatDate(activeConsent.grantedAt?.slice(0, 10) ?? null, i18n.language),
                  name: workerName(activeConsent.recordedBy ?? ''),
                })}
              </p>

              {confirmOpen ? (
                <div className="mt-3 rounded-2xl border-2 border-red-200 bg-red-50 p-4">
                  <h3 className="text-base font-bold text-red-900">{t('mother.withdrawConfirmTitle')}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-red-900">
                    {t('mother.withdrawConfirmBody', {
                      village: villageName(handover.toVillage),
                    })}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void withdraw()}
                      disabled={busy}
                      className="min-h-12 flex-1 rounded-xl bg-red-700 px-4 text-base font-bold text-white disabled:opacity-60"
                    >
                      {busy ? t('shared.saving') : t('mother.withdrawConfirmYes')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmOpen(false)}
                      className="min-h-12 rounded-xl border-2 border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700"
                    >
                      {t('mother.withdrawConfirmNo')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-red-700 bg-white px-4 text-base font-bold text-red-800"
                >
                  <DashCircleIcon className="h-5 w-5" />
                  {t('mother.withdraw')}
                </button>
              )}

              {actionError ? (
                <p role="alert" className="mt-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
                  {t('mother.withdrawError')}
                </p>
              ) : null}
            </section>
          ) : null}

          {withdrawnNow || status.kind === 'consentWithdrawn' ? (
            <section className="mt-6 rounded-2xl border-2 border-slate-300 bg-slate-100 p-4">
              <h2 className="text-lg font-bold text-slate-800">{t('mother.withdrawnTitle')}</h2>
              <p className="mt-1 text-base leading-relaxed text-slate-700">
                {t('mother.withdrawnBody', { village: villageName(status.currentVillageId) })}
              </p>
            </section>
          ) : null}

          <p className="mt-6 text-sm leading-relaxed text-slate-500">{t('mother.readonly')}</p>
        </>
      ) : null}
    </AppShell>
  );
}
