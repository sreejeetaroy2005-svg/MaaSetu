import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { TrackerProgress } from '../components/CareTracker';
import { ConnectionNote } from '../components/ConnectionBadge';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { RejectedChanges } from '../components/SyncStatus';
import { StatusBadge } from '../components/StatusBadge';
import { Card, Notice, SectionTitle } from '../components/ui';
import { ChevronRightIcon, PlusIcon, UserIcon } from '../components/icons';
import { useSession } from '../context/SessionContext';
import { motherStatus, statusVillageId } from '../data/handover';
import { buildCareTracker } from '../data/tracker';
import { labelKeyFor, nextMilestone } from '../data/journey';
import type { ConsentLogEntry, Handover, JourneyCard, Mother, User, Village } from '../data/model';
import { useAsyncData } from '../hooks/useAsyncData';
import { useQueue } from '../hooks/useOffline';
import { formatDate } from '../utils/date';
import { loadWorkspace, type Workspace } from '../offline/repo';

interface HomeData {
  villages: Village[];
  names: Record<string, string>;
  mothers: Mother[];
  incoming: Handover[];
  handovers: Handover[];
  cards: JourneyCard[];
  allMothers: Mother[];
  consents: ConsentLogEntry[];
  users: User[];
}

function buildHome(workspace: Workspace, worker: User | null): HomeData {
  const names: Record<string, string> = Object.fromEntries(
    workspace.users.map((user) => [user.id, user.name]),
  );
  for (const mother of workspace.mothers) names[mother.id] = mother.name;

  if (!worker) {
    return {
      villages: workspace.villages,
      names,
      mothers: [],
      incoming: [],
      handovers: workspace.handovers,
      cards: workspace.cards,
      allMothers: workspace.mothers,
      consents: workspace.consents,
      users: workspace.users,
    };
  }

  const homeMothers = workspace.mothers.filter((mother) => mother.village === worker.village);
  const acceptedIds = workspace.handovers
    .filter((handover) => handover.toVillage === worker.village && handover.status === 'accepted')
    .map((handover) => handover.motherId);
  const acceptedMothers = workspace.mothers.filter((mother) => acceptedIds.includes(mother.id));
  const mine = [...homeMothers, ...acceptedMothers].filter(
    (mother, index, list) => list.findIndex((item) => item.id === mother.id) === index,
  );

  return {
    villages: workspace.villages,
    names,
    mothers: mine,
    incoming: workspace.handovers.filter(
      (handover) => handover.toVillage === worker.village && handover.status === 'pending',
    ),
    handovers: workspace.handovers,
    cards: workspace.cards,
    allMothers: workspace.mothers,
    consents: workspace.consents,
    users: workspace.users,
  };
}

/**
 * ASHA / ANM home. Two sections from the same cached snapshot:
 *  - Incoming mothers: pending handovers addressed to this village
 *  - My mothers: everyone in this village, plus anyone accepted into its care
 *
 * The snapshot is the one kept on the device, so this screen opens with no
 * connection and shows any visit or milestone still waiting to sync.
 */
export default function WorkerHome() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { worker } = useSession();
  const queue = useQueue();
  const role = worker?.role ?? 'asha';
  const base = `/${role}`;

  const { data, loading, error, reload } = useAsyncData<HomeData>(async () => {
    const workspace = await loadWorkspace(queue.ops);
    return buildHome(workspace, worker);
  }, [worker?.id, worker?.village, queue.ops]);

  const villageName = (id: string) => data?.villages.find((village) => village.id === id)?.name ?? '';
  const cardsByMother = new Map((data?.cards ?? []).map((card) => [card.motherId, card]));

  return (
    <AppShell title={t('worker.title')} subtitle={t('worker.subtitle')}>
      <ConnectionNote />
      <RejectedChanges />

      {loading ? <LoadingState label={t('shared.loading')} /> : null}
      {error ? <ErrorState onRetry={reload} /> : null}

      {!loading && !error && data ? (
        <>
          {data.incoming.length > 0 ? (
            <section className="mt-4 mb-6">
              <div className="flex items-center gap-2">
                <SectionTitle>{t('worker.incomingTitle')}</SectionTitle>
                <span className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-2 text-sm font-bold text-white">
                  {data.incoming.length}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{t('worker.incomingHint')}</p>

              <ul className="mt-3 space-y-3">
                {data.incoming.map((handover) => {
                  const mother = data.allMothers.find((m) => m.id === handover.motherId);
                  if (!mother) return null;
                  const tracked = buildCareTracker({
                    mother,
                    handovers: data.handovers,
                    consents: data.consents,
                    card: cardsByMother.get(mother.id) ?? null,
                    users: data.users,
                  });
                  return (
                    <li key={handover.id}>
                      <Link
                        to={`${base}/mothers/${mother.id}`}
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
                          <TrackerProgress
                            done={tracked.doneCount}
                            total={tracked.total}
                            className="mt-1"
                          />
                        </span>
                        <ChevronRightIcon className="h-6 w-6 shrink-0 text-amber-700" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <div className="mt-4 flex items-baseline justify-between gap-2">
            <SectionTitle>
              {t('worker.myMothers', { village: villageName(worker?.village ?? '') })}
            </SectionTitle>
            <p className="shrink-0 text-sm font-semibold text-slate-600">
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
                const tracked = status.handover
                  ? buildCareTracker({
                      mother,
                      handovers: data.handovers,
                      consents: data.consents,
                      card,
                      users: data.users,
                    })
                  : null;
                return (
                  <li key={mother.id}>
                    <Link
                      to={`${base}/mothers/${mother.id}`}
                      className="flex min-h-24 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm active:border-brand-600"
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
                        {tracked ? (
                          <TrackerProgress
                            done={tracked.doneCount}
                            total={tracked.total}
                            className="mt-1"
                          />
                        ) : null}
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
            onClick={() => void navigate(`${base}/register`)}
            className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-base font-bold text-white"
          >
            <PlusIcon className="h-5 w-5" />
            {t('worker.newMother')}
          </button>

          {data.mothers.length > 0 ? (
            <Card className="mt-4">
              <Notice tone="info">{t('worker.auditNote')}</Notice>
            </Card>
          ) : null}
        </>
      ) : null}
    </AppShell>
  );
}
