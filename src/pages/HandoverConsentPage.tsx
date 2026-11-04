import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ConnectionNote } from '../components/ConnectionBadge';
import { EmptyState, ErrorState, LoadingState, PlaceholderNote } from '../components/StateBlock';
import { Notice } from '../components/ui';
import { CheckIcon, LockIcon, UserIcon } from '../components/icons';
import { useSession } from '../context/SessionContext';
import { motherStatus } from '../data/handover';
import type { Handover, Mother, User, Village } from '../data/model';
import { useAsyncData } from '../hooks/useAsyncData';
import { useNetwork, useQueue } from '../hooks/useOffline';
import { beginHandover, deviceAuthor, loadMotherCard } from '../offline/repo';
import { formatDate, todayIso } from '../utils/date';

interface ConsentData {
  mother: Mother;
  villages: Village[];
  users: User[];
  handovers: Handover[];
  /** Village this worker belongs to (her own). */
  fromWorker: User | null;
}

/**
 * Step 3–5 of the flow: choose where the mother is moving, show exactly what
 * will be shared, record her consent (checkbox + timestamp + who recorded it),
 * then create the pending handover. No consent → no handover, no data access.
 *
 * With no connection the consent is recorded on this phone and queued: the
 * receiving worker hears nothing until it syncs, and the screen never claims it
 * was sent.
 */
export default function HandoverConsentPage() {
  const { motherId } = useParams<{ motherId: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { worker: signedInWorker, actor: sessionActor } = useSession();
  const queue = useQueue();
  const network = useNetwork();
  const role = signedInWorker?.role ?? 'asha';
  const base = `/${role}`;
  const actor = sessionActor ?? { id: signedInWorker?.id ?? '', role };
  const author = deviceAuthor(actor, signedInWorker?.name ?? '');

  const { data, loading, error, reload } = useAsyncData<ConsentData | null>(async () => {
    if (!motherId) return null;
    const bundle = await loadMotherCard(motherId, queue.ops);
    if (!bundle) return null;
    return {
      mother: bundle.mother,
      villages: bundle.villages,
      users: bundle.users,
      handovers: bundle.handovers,
      fromWorker: signedInWorker,
    };
  }, [motherId, signedInWorker?.id, queue.ops]);

  const [toVillageId, setToVillageId] = useState('');
  const [toWorkerId, setToWorkerId] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const motherVillage = data?.mother.village ?? '';
  const otherVillages = (data?.villages ?? []).filter((v) => v.id !== motherVillage);
  const receivingWorkers = (data?.users ?? []).filter(
    (user) => user.role !== 'mother' && user.village === toVillageId,
  );

  // Default to the first other village, then its first worker.
  useEffect(() => {
    if (!data || toVillageId) return;
    const first = otherVillages[0];
    if (first) setToVillageId(first.id);
  }, [data, otherVillages, toVillageId]);

  useEffect(() => {
    if (toWorkerId && receivingWorkers.some((w) => w.id === toWorkerId)) return;
    setToWorkerId(receivingWorkers[0]?.id ?? '');
  }, [receivingWorkers, toWorkerId]);

  const status = data ? motherStatus(data.mother, data.handovers) : null;
  const alreadyActive = status !== null && (status.kind === 'movingPending' || status.kind === 'moved');
  const villageName = (id: string) => data?.villages.find((v) => v.id === id)?.name ?? '';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!data || !data.fromWorker) return;

    setFormError(null);
    setSaveError(false);

    if (!consentGiven) {
      setFormError(t('handover.errorConsent'));
      return;
    }
    if (!toVillageId || toVillageId === data.mother.village) {
      setFormError(t('handover.errorSameVillage'));
      return;
    }
    if (!toWorkerId) {
      setFormError(t('handover.errorWorker'));
      return;
    }

    setSaving(true);
    try {
      await beginHandover(
        {
          mother: data.mother,
          fromWorker: data.fromWorker,
          toVillageId,
          toWorkerId,
        },
        actor,
        author,
      );
      // Offline this only reached the queue; her card says "Not sent yet"
      // until the change is confirmed by the server.
      void navigate(`${base}/mothers/${data.mother.id}`, { replace: true });
    } catch (caught) {
      console.error('MaaSetu: handover failed', caught);
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      backTo={motherId ? `${base}/mothers/${motherId}` : base}
      title={t('handover.title')}
      subtitle={data?.mother.name}
    >
      <ConnectionNote />

      {loading ? <LoadingState label={t('shared.loading')} /> : null}
      {error ? <ErrorState onRetry={reload} /> : null}

      {!loading && !error && !data ? (
        <EmptyState
          icon={<LockIcon className="h-6 w-6" />}
          title={t('journey.missingTitle')}
          body={t('journey.missingBody')}
          action={
            <Link
              to={base}
              className="inline-flex min-h-12 items-center rounded-xl bg-brand-700 px-5 text-base font-bold text-white"
            >
              {t('journey.backToList')}
            </Link>
          }
        />
      ) : null}

      {!loading && !error && data ? (
        <>
          <section className="mt-4 rounded-3xl border-2 border-brand-100 bg-white p-4">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              {t('handover.motherLabel')}
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{data.mother.name}</h2>
            <p className="mt-1 text-base text-slate-600">
              {villageName(data.mother.village)} · {t(`language.${data.mother.language}`)}
            </p>
          </section>

          {alreadyActive && status ? (
            <section className="mt-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
              <h3 className="text-base font-bold text-amber-900">{t('handover.alreadyTitle')}</h3>
              <p className="mt-1 text-sm text-amber-900">{t('handover.alreadyBody')}</p>
              <Link
                to={`${base}/mothers/${data.mother.id}`}
                className="mt-3 inline-flex min-h-12 items-center rounded-xl bg-brand-700 px-5 text-base font-bold text-white"
              >
                {t('handover.openCard')}
              </Link>
            </section>
          ) : (
            <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-4">
              {network.status === 'offline' ? (
                <Notice tone="warn">{t('offline.startQueuedBody')}</Notice>
              ) : null}

              <div>
                <label htmlFor="to-village" className="block text-base font-semibold text-slate-800">
                  {t('handover.destinationLabel')}
                </label>
                <select
                  id="to-village"
                  value={toVillageId}
                  onChange={(event) => setToVillageId(event.target.value)}
                  className="mt-1 min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base font-semibold"
                >
                  {otherVillages.map((village) => (
                    <option key={village.id} value={village.id}>
                      {village.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="to-worker" className="block text-base font-semibold text-slate-800">
                  {t('handover.workerLabel')}
                </label>
                <select
                  id="to-worker"
                  value={toWorkerId}
                  onChange={(event) => setToWorkerId(event.target.value)}
                  className="mt-1 min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base font-semibold"
                >
                  {receivingWorkers.length === 0 ? (
                    <option value="">{t('handover.workerPlaceholder')}</option>
                  ) : (
                    receivingWorkers.map((worker) => (
                      <option key={worker.id} value={worker.id}>
                        {worker.name} · {t(`role.${worker.role}`)}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <section className="rounded-2xl border-2 border-slate-200 bg-white p-4">
                <h3 className="text-base font-bold text-slate-900">{t('handover.explainTitle')}</h3>
                <ul className="mt-2 space-y-2">
                  <li className="flex items-start gap-2 text-base text-slate-700">
                    <UserIcon className="mt-1 h-4 w-4 shrink-0 text-brand-700" />
                    {t('handover.explain1')}
                  </li>
                  <li className="flex items-start gap-2 text-base text-slate-700">
                    <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-brand-700" />
                    {t('handover.explain2')}
                  </li>
                  <li className="flex items-start gap-2 text-base text-slate-700">
                    <LockIcon className="mt-1 h-4 w-4 shrink-0 text-brand-700" />
                    {t('handover.explain3')}
                  </li>
                </ul>
                <PlaceholderNote>{t('handover.wordingNote')}</PlaceholderNote>
              </section>

              <label
                htmlFor="consent-check"
                className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-slate-300 bg-white p-4"
              >
                <input
                  id="consent-check"
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(event) => setConsentGiven(event.target.checked)}
                  className="mt-1 h-7 w-7 shrink-0 accent-brand-700"
                />
                <span className="text-base leading-relaxed font-semibold text-slate-900">
                  {t('handover.consentLabel', { name: data.mother.name })}
                </span>
              </label>

              <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
                {t('handover.recordedBy', {
                  name: data.fromWorker?.name ?? actor.id,
                  date: formatDate(todayIso(), i18n.language),
                })}
              </p>

              {formError ? (
                <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
                  {formError}
                </p>
              ) : null}
              {saveError ? (
                <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
                  {t('handover.errorSave')}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={saving || !consentGiven}
                className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-brand-700 px-4 text-base font-bold text-white disabled:opacity-50"
              >
                {saving ? t('shared.saving') : t('handover.submit')}
              </button>
              <p className="text-center text-xs text-slate-500">{t('handover.noConsentNote')}</p>
            </form>
          )}
        </>
      ) : null}
    </AppShell>
  );
}
