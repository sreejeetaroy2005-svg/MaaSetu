import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { ChevronRightIcon, PlusIcon, UserIcon } from '../components/icons';
import { useSession } from '../context/SessionContext';
import { motherStatus, statusVillageId } from '../data/handover';
import { labelKeyFor, nextMilestone } from '../data/journey';
import type { Handover, JourneyCard, Mother, Role, User, Village } from '../data/model';
import { useAsyncData } from '../hooks/useAsyncData';
import { listAllHandovers } from '../services/handoverService';
import {
  listAllMothers,
  listAllUsers,
  listJourneyCards,
  listVillages,
  listWorkersByRole,
} from '../services/journeyService';
import { formatDate } from '../utils/date';

type WorkerRole = Extract<Role, 'asha' | 'anm'>;

interface HomeData {
  workers: User[];
  villages: Village[];
  names: Record<string, string>;
  worker: User | null;
  mothers: Mother[];
  incoming: Handover[];
  handovers: Handover[];
  cards: JourneyCard[];
  allMothers: Mother[];
}

/**
 * ASHA / ANM home. Two sections from the same data layer:
 *  - Incoming mothers: pending handovers addressed to this worker (badge count)
 *  - My mothers: mothers in this village, plus anyone accepted into this
 *    worker's care, each with her current status.
 */
export default function WorkerHome({ role }: { role: WorkerRole }) {
  const { t, i18n } = useTranslation();
  const { workerIdFor, setWorkerId } = useSession();
  const navigate = useNavigate();
  const selectedId = workerIdFor(role);

  const { data, loading, error, reload } = useAsyncData<HomeData>(async () => {
    const [workers, villages, allMothers, handovers, cards, users] = await Promise.all([
      listWorkersByRole(role),
      listVillages(),
      listAllMothers(),
      listAllHandovers(),
      listJourneyCards(),
      listAllUsers(),
    ]);
    const worker = workers.find((w) => w.id === selectedId) ?? workers[0] ?? null;
    const names = Object.fromEntries(users.map((u) => [u.id, u.name]));

    if (!worker) {
      return {
        workers,
        villages,
        names,
        worker: null,
        mothers: [],
        incoming: [],
        handovers,
        cards,
        allMothers,
      };
    }

    const homeMothers = allMothers.filter((m) => m.village === worker.village);
    // Consent is recorded for a village, so the receiving village's team shares
    // the accepted mothers; the named worker is the contact for a pending one.
    const acceptedIds = handovers
      .filter((h) => h.toVillage === worker.village && h.status === 'accepted')
      .map((h) => h.motherId);
    const acceptedMothers = allMothers.filter((m) => acceptedIds.includes(m.id));

    const mine = [...homeMothers, ...acceptedMothers].filter(
      (mother, index, list) => list.findIndex((m) => m.id === mother.id) === index,
    );

    return {
      workers,
      villages,
      names,
      worker,
      mothers: mine,
      incoming: handovers.filter((h) => h.toVillage === worker.village && h.status === 'pending'),
      handovers,
      cards,
      allMothers,
    };
  }, [role, selectedId]);

  // Only repair a stored demo identity that no longer exists in the data;
  // never override a selection the user just made.
  useEffect(() => {
    if (loading || error || !data?.worker) return;
    if (!data.workers.some((worker) => worker.id === selectedId)) {
      setWorkerId(role, data.worker.id);
    }
  }, [data, loading, error, role, selectedId, setWorkerId]);

  const villageName = (id: string) => data?.villages.find((v) => v.id === id)?.name ?? '';
  const cardsByMother = new Map((data?.cards ?? []).map((card) => [card.motherId, card]));

  return (
    <AppShell roleArea={role} title={t('worker.title')}>
      {loading ? <LoadingState label={t('shared.loading')} /> : null}
      {error ? <ErrorState onRetry={reload} /> : null}

      {!loading && !error && data ? (
        <>
          <section className="rounded-2xl border-2 border-slate-200 bg-white p-4">
            <label
              htmlFor="worker-select"
              className="text-xs font-semibold tracking-wide text-slate-500 uppercase"
            >
              {t('worker.signedInAs')}
            </label>
            <select
              id="worker-select"
              value={data.worker?.id ?? ''}
              onChange={(event) => setWorkerId(role, event.target.value)}
              className="mt-1 min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base font-semibold text-slate-900"
            >
              {data.workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name} · {villageName(worker.village)}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">{t('worker.villageLine', { village: villageName(data.worker?.village ?? '') })}</p>
          </section>

          {data.incoming.length > 0 ? (
            <section className="mt-6">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{t('worker.incomingTitle')}</h2>
                <span
                  aria-label={t('worker.incomingCount', { count: data.incoming.length })}
                  className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-2 text-sm font-bold text-white"
                >
                  {data.incoming.length}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{t('worker.incomingHint')}</p>

              <ul className="mt-3 space-y-3">
                {data.incoming.map((handover) => {
                  const mother = data.allMothers.find((m) => m.id === handover.motherId);
                  if (!mother) return null;
                  return (
                    <li key={handover.id}>
                      <Link
                        to={`/${role}/mothers/${mother.id}`}
                        className="flex min-h-24 items-center gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 active:border-amber-500"
                      >
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-900">
                          <UserIcon className="h-6 w-6" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-lg font-bold text-slate-900">
                            {mother.name}
                          </span>
                          <span className="block text-sm text-slate-700">
                            {t('worker.incomingFrom', {
                              village: villageName(handover.fromVillage),
                              name: data.names[handover.fromWorkerId] ?? '',
                            })}
                          </span>
                          <span className="mt-1 block text-sm font-bold text-amber-900">
                            {t('worker.pendingAccept')}
                          </span>
                        </span>
                        <ChevronRightIcon className="h-6 w-6 shrink-0 text-amber-700" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <div className="mt-6 flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900">
              {t('worker.myMothers', { village: villageName(data.worker?.village ?? '') })}
            </h2>
            <p className="text-sm font-semibold text-slate-600">
              {t('worker.count', { count: data.mothers.length })}
            </p>
          </div>

          {data.mothers.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                icon={<UserIcon className="h-6 w-6" />}
                title={t('worker.emptyTitle')}
                body={t('worker.emptyBody')}
              />
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {data.mothers.map((mother) => {
                const card = cardsByMother.get(mother.id) ?? null;
                const next = nextMilestone(card);
                const nextKey = next ? labelKeyFor(next) : null;
                const status = motherStatus(mother, data.handovers);
                return (
                  <li key={mother.id}>
                    <Link
                      to={`/${role}/mothers/${mother.id}`}
                      className="flex min-h-24 items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white p-4 active:border-brand-600"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-800">
                        <UserIcon className="h-6 w-6" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-lg font-bold text-slate-900">
                          {mother.name}
                        </span>
                        <span className="mt-1 block">
                          <StatusBadge
                            status={status}
                            villageName={villageName(statusVillageId(status))}
                          />
                        </span>
                        <span className="mt-1 block text-sm font-semibold text-brand-800">
                          {next ? (
                            <>
                              {t('worker.nextLabel')}: {nextKey ? t(nextKey) : next.name}
                              {next.dueDate
                                ? ` · ${formatDate(next.dueDate, i18n.language)}`
                                : ` · ${t('worker.noDatedMilestone')}`}
                            </>
                          ) : (
                            <span className="font-normal text-slate-500">
                              {t('worker.noDatedMilestone')}
                            </span>
                          )}
                        </span>
                      </span>
                      <ChevronRightIcon className="h-6 w-6 shrink-0 text-slate-400" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={() => void navigate(`/${role}/register`)}
            className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 px-4 text-base font-bold text-white"
          >
            <PlusIcon className="h-5 w-5" />
            {t('worker.newMother')}
          </button>
        </>
      ) : null}
    </AppShell>
  );
}
