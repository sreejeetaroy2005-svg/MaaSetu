import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { Card, Notice, SectionTitle } from '../components/ui';
import { ChevronRightIcon, PlusIcon, UserIcon } from '../components/icons';
import { useSession } from '../context/SessionContext';
import { motherStatus, statusVillageId } from '../data/handover';
import { labelKeyFor, nextMilestone } from '../data/journey';
import type { Handover, JourneyCard, Mother, User, Village } from '../data/model';
import { useAsyncData } from '../hooks/useAsyncData';
import { listAllHandovers } from '../services/handoverService';
import { listAllMothers, listAllUsers, listJourneyCards, listVillages } from '../services/journeyService';
import { formatDate } from '../utils/date';

interface HomeData {
  villages: Village[];
  names: Record<string, string>;
  mothers: Mother[];
  incoming: Handover[];
  handovers: Handover[];
  cards: JourneyCard[];
  allMothers: Mother[];
}

/**
 * ASHA / ANM home. Two sections from the same data layer:
 *  - Incoming mothers: pending handovers addressed to this village
 *  - My mothers: everyone in this village, plus anyone accepted into its care
 */
export default function WorkerHome() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { worker } = useSession();
  const role = worker?.role ?? 'asha';
  const base = `/${role}`;

  const { data, loading, error, reload } = useAsyncData<HomeData>(async () => {
    const [villages, allMothers, handovers, cards, users] = await Promise.all([
      listVillages(),
      listAllMothers(),
      listAllHandovers(),
      listJourneyCards(),
      listAllUsers(),
    ]);
    const names = Object.fromEntries(users.map((user: User) => [user.id, user.name]));

    if (!worker) {
      return { villages, names, mothers: [], incoming: [], handovers, cards, allMothers };
    }

    const homeMothers = allMothers.filter((mother) => mother.village === worker.village);
    const acceptedIds = handovers
      .filter((h) => h.toVillage === worker.village && h.status === 'accepted')
      .map((h) => h.motherId);
    const acceptedMothers = allMothers.filter((mother) => acceptedIds.includes(mother.id));
    const mine = [...homeMothers, ...acceptedMothers].filter(
      (mother, index, list) => list.findIndex((m) => m.id === mother.id) === index,
    );

    return {
      villages,
      names,
      mothers: mine,
      incoming: handovers.filter((h) => h.toVillage === worker.village && h.status === 'pending'),
      handovers,
      cards,
      allMothers,
    };
  }, [worker?.id, worker?.village]);

  const villageName = (id: string) => data?.villages.find((village) => village.id === id)?.name ?? '';
  const cardsByMother = new Map((data?.cards ?? []).map((card) => [card.motherId, card]));

  return (
    <AppShell title={t('worker.title')} subtitle={t('worker.subtitle')}>
      {loading ? <LoadingState label={t('shared.loading')} /> : null}
      {error ? <ErrorState onRetry={reload} /> : null}

      {!loading && !error && data ? (
        <>
          {data.incoming.length > 0 ? (
            <section className="mb-6">
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
                        </span>
                        <ChevronRightIcon className="h-6 w-6 shrink-0 text-amber-700" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <div className="flex items-baseline justify-between gap-2">
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
