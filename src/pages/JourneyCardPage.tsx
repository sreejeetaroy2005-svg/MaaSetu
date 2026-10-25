import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ActivityList } from '../components/ActivityList';
import { AppShell } from '../components/AppShell';
import { MilestoneItem, type MilestonePanel } from '../components/MilestoneItem';
import { EmptyState, ErrorState, LoadingState, PlaceholderNote } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { VisitItem } from '../components/VisitItem';
import { ArrowRightIcon, ListIcon, LockIcon, PlusIcon } from '../components/icons';
import { useSession } from '../context/SessionContext';
import { accessFor, motherStatus, statusVillageId } from '../data/handover';
import type {
  ConsentLogEntry,
  Handover,
  JourneyCard,
  MilestoneStatus,
  Mother,
  Role,
  User,
  Village,
} from '../data/model';
import { useAsyncData } from '../hooks/useAsyncData';
import { acceptHandover, listAllHandovers, listConsentLogs } from '../services/handoverService';
import {
  addVisit,
  editVisit,
  fetchJourneyCard,
  fetchMother,
  listAllUsers,
  listVillages,
  saveMilestoneDueDate,
  saveMilestoneStatus,
} from '../services/journeyService';
import { formatDate, formatMonth, todayIso } from '../utils/date';

type WorkerRole = Extract<Role, 'asha' | 'anm'>;

interface CardData {
  mother: Mother;
  card: JourneyCard | null;
  users: User[];
  villages: Village[];
  handovers: Handover[];
  consents: ConsentLogEntry[];
}

/**
 * Journey card for one mother, wired to the handover lifecycle:
 *  - her worker can edit until a handover is accepted
 *  - the receiving worker sees a read-only summary until they accept
 *  - after acceptance the receiving worker edits, the sending worker reads
 *  - after a withdrawal only her home village can open the card
 */
export default function JourneyCardPage({ role }: { role: WorkerRole }) {
  const { motherId } = useParams<{ motherId: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { actorFor } = useSession();
  const actor = actorFor(role);

  const { data, loading, error, reload } = useAsyncData<CardData | null>(async () => {
    if (!motherId) return null;
    const [mother, card, users, villages, handovers, consents] = await Promise.all([
      fetchMother(motherId),
      fetchJourneyCard(motherId),
      listAllUsers(),
      listVillages(),
      listAllHandovers(),
      listConsentLogs(motherId),
    ]);
    if (!mother) return null;
    return {
      mother,
      card,
      users,
      villages,
      handovers: handovers.filter((h) => h.motherId === mother.id),
      consents,
    };
  }, [motherId]);

  const [card, setCard] = useState<JourneyCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [panel, setPanel] = useState<{ templateId: string; kind: Exclude<MilestonePanel, null> } | null>(
    null,
  );
  const [visitFormOpen, setVisitFormOpen] = useState(false);
  const [visitDate, setVisitDate] = useState(todayIso());
  const [visitNote, setVisitNote] = useState('');
  const [editingVisit, setEditingVisit] = useState<string | null>(null);

  useEffect(() => {
    setCard(data?.card ?? null);
  }, [data]);

  const names: Record<string, string> = Object.fromEntries(
    (data?.users ?? []).map((user) => [user.id, user.name]),
  );
  const villageNames: Record<string, string> = Object.fromEntries(
    (data?.villages ?? []).map((village) => [village.id, village.name]),
  );
  const villageName = (id: string) => villageNames[id] ?? '';

  const worker = data?.users.find((user) => user.id === actor.id) ?? null;
  const status = data ? motherStatus(data.mother, data.handovers) : null;
  const access = data ? accessFor(worker, data.mother, data.handovers) : 'blocked';
  const handover = status?.handover ?? null;
  const workerVillageId = worker?.village ?? '';
  /** The receiving village's team (they share the accepted card). */
  const isReceivingVillage = handover !== null && handover.toVillage === workerVillageId;
  const canEdit = access === 'edit';
  const canStartHandover =
    canEdit && status !== null && (status.kind === 'atHome' || status.kind === 'consentWithdrawn');

  const runWrite = async (work: () => Promise<JourneyCard>) => {
    if (!card || !canEdit) return;
    setBusy(true);
    setSaveError(false);
    try {
      setCard(await work());
      setPanel(null);
      setEditingVisit(null);
      setVisitFormOpen(false);
      setVisitNote('');
    } catch (caught) {
      console.error('MaaSetu: save failed', caught);
      setSaveError(true);
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    if (!handover || !worker) return;
    setBusy(true);
    setSaveError(false);
    try {
      await acceptHandover(handover, worker, actor);
      reload();
    } catch (caught) {
      console.error('MaaSetu: accept failed', caught);
      setSaveError(true);
    } finally {
      setBusy(false);
    }
  };

  const changeStatus =
    (templateId: string) => (next: MilestoneStatus, doneDate: string | null) => {
      if (!card) return;
      void runWrite(() => saveMilestoneStatus(card, templateId, next, doneDate, actor));
    };

  const changeDueDate = (templateId: string) => (dueDate: string | null) => {
    if (!card) return;
    void runWrite(() => saveMilestoneDueDate(card, templateId, dueDate, actor));
  };

  const submitVisit = (event: FormEvent) => {
    event.preventDefault();
    if (!card || !visitDate || visitNote.trim().length === 0) return;
    void runWrite(() => addVisit(card, { date: visitDate, note: visitNote }, actor));
  };

  return (
    <AppShell roleArea={role} backTo={`/${role}`} title={t('journey.title')}>
      {loading ? <LoadingState label={t('journey.loading')} /> : null}
      {error ? <ErrorState onRetry={reload} /> : null}

      {!loading && !error && !data ? (
        <EmptyState
          icon={<ListIcon className="h-6 w-6" />}
          title={t('journey.missingTitle')}
          body={t('journey.missingBody')}
        />
      ) : null}

      {/* Someone outside her care (or a receiving worker after withdrawal) */}
      {!loading && !error && data && access === 'blocked' ? (
        <EmptyState
          icon={<LockIcon className="h-6 w-6" />}
          title={t('journey.noAccessTitle')}
          body={t('journey.noAccessBody')}
          action={
            <Link
              to={`/${role}`}
              className="inline-flex min-h-12 items-center rounded-xl bg-brand-700 px-5 text-base font-bold text-white"
            >
              {t('journey.backToList')}
            </Link>
          }
        />
      ) : null}

      {!loading && !error && data && access !== 'blocked' && status ? (
        <>
          <section className="rounded-3xl border-2 border-brand-100 bg-white p-4">
            <h2 className="text-2xl leading-tight font-bold text-slate-900">{data.mother.name}</h2>
            <div className="mt-2">
              <StatusBadge status={status} villageName={villageName(statusVillageId(status))} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
              <div>
                <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  {t('journey.currentVillage')}
                </dt>
                <dd className="text-base font-semibold text-slate-900">
                  {villageName(status.currentVillageId)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  {t('journey.currentWorker')}
                </dt>
                <dd className="text-base font-semibold text-slate-900">
                  {names[status.currentWorkerId] ?? t('journey.unknownWorker')}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  {t('journey.language')}
                </dt>
                <dd className="text-base font-semibold text-slate-900">
                  {t(`language.${data.mother.language}`)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  {t('journey.expectedDelivery')}
                </dt>
                <dd className="text-base font-semibold text-slate-900">
                  {data.mother.expectedDeliveryMonth
                    ? formatMonth(data.mother.expectedDeliveryMonth, i18n.language)
                    : t('shared.notSet')}
                </dd>
              </div>
            </dl>

            {canStartHandover ? (
              <button
                type="button"
                onClick={() => void navigate(`/${role}/mothers/${data.mother.id}/handover`)}
                className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-brand-700 bg-white px-4 text-base font-bold text-brand-800"
              >
                <ArrowRightIcon className="h-5 w-5" />
                {t('handover.movingButton')}
              </button>
            ) : null}
          </section>

          {saveError ? (
            <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
              {t('journey.saveError')}
            </p>
          ) : null}

          {status.kind === 'movingPending' && handover ? (
            <section className="mt-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
              <h3 className="text-base font-bold text-amber-900">
                {isReceivingVillage
                  ? t('journey.readonlyAcceptTitle')
                  : t('journey.handoverWaitingTitle')}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-amber-900">
                {isReceivingVillage
                  ? t('journey.readonlyAcceptBody')
                  : t('journey.handoverWaitingBody', {
                      name: names[handover.toWorkerId] ?? '',
                      village: villageName(handover.toVillage),
                    })}
              </p>
              {isReceivingVillage ? (
                <button
                  type="button"
                  onClick={() => void accept()}
                  disabled={busy}
                  className="mt-3 min-h-14 w-full rounded-2xl bg-brand-700 px-4 text-base font-bold text-white disabled:opacity-60"
                >
                  {busy ? t('shared.saving') : t('journey.acceptButton')}
                </button>
              ) : null}
            </section>
          ) : null}

          {status.kind === 'moved' && handover ? (
            <section
              className={`mt-4 rounded-2xl border-2 p-4 ${
                isReceivingVillage ? 'border-brand-300 bg-brand-50' : 'border-sky-300 bg-sky-50'
              }`}
            >
              <h3 className={`text-base font-bold ${isReceivingVillage ? 'text-brand-900' : 'text-sky-900'}`}>
                {isReceivingVillage ? t('journey.youCareTitle') : t('journey.readonlyHeadTitle')}
              </h3>
              <p className={`mt-1 text-sm leading-relaxed ${isReceivingVillage ? 'text-brand-900' : 'text-sky-900'}`}>
                {isReceivingVillage
                  ? t('journey.youCareBody')
                  : t('journey.readonlyHeadBody', {
                      village: villageName(handover.toVillage),
                      name: names[handover.toWorkerId] ?? '',
                    })}
              </p>
            </section>
          ) : null}

          {status.kind === 'consentWithdrawn' && handover ? (
            <section className="mt-4 rounded-2xl border-2 border-slate-300 bg-slate-100 p-4">
              <h3 className="text-base font-bold text-slate-800">{t('journey.revokedTitle')}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">
                {t('journey.revokedBody', { village: villageName(handover.fromVillage) })}
              </p>
            </section>
          ) : null}

          <section className="mt-6">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-xl font-bold text-slate-900">{t('journey.milestones')}</h2>
              {!canEdit ? (
                <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-bold text-slate-700">
                  {t('journey.readonlyNote')}
                </span>
              ) : null}
            </div>
            <PlaceholderNote>{t('journey.milestoneHint')}</PlaceholderNote>

            {card === null ? (
              <div className="mt-3">
                <EmptyState
                  icon={<ListIcon className="h-6 w-6" />}
                  title={t('journey.noCardTitle')}
                  body={t('journey.noCardBody')}
                />
              </div>
            ) : card.milestones.length === 0 ? (
              <p className="mt-3 text-base text-slate-600">{t('journey.noMilestones')}</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {card.milestones.map((milestone) => (
                  <MilestoneItem
                    key={milestone.templateId}
                    milestone={milestone}
                    language={i18n.language}
                    busy={busy}
                    readOnly={!canEdit}
                    panel={panel?.templateId === milestone.templateId ? panel.kind : null}
                    onOpenPanel={(kind) =>
                      setPanel(kind ? { templateId: milestone.templateId, kind } : null)
                    }
                    onStatus={changeStatus(milestone.templateId)}
                    onDueDate={changeDueDate(milestone.templateId)}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-bold text-slate-900">{t('journey.visits')}</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{t('journey.keepHistory')}</p>

            {card === null ? null : !canEdit ? null : visitFormOpen ? (
              <form
                onSubmit={submitVisit}
                className="mt-3 rounded-2xl border-2 border-brand-300 bg-white p-4"
              >
                <label htmlFor="visit-date" className="block text-sm font-semibold text-slate-700">
                  {t('journey.visitDate')}
                </label>
                <input
                  id="visit-date"
                  type="date"
                  value={visitDate}
                  onChange={(event) => setVisitDate(event.target.value)}
                  className="mt-1 min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base"
                />
                <label htmlFor="visit-note" className="mt-2 block text-sm font-semibold text-slate-700">
                  {t('journey.visitNote')}
                </label>
                <textarea
                  id="visit-note"
                  rows={3}
                  value={visitNote}
                  onChange={(event) => setVisitNote(event.target.value)}
                  placeholder={t('journey.visitNotePlaceholder')}
                  className="mt-1 w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-base"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={busy || !visitDate || visitNote.trim().length === 0}
                    className="min-h-12 flex-1 rounded-xl bg-brand-700 px-3 font-bold text-white disabled:opacity-60"
                  >
                    {busy ? t('shared.saving') : t('journey.saveVisit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisitFormOpen(false)}
                    className="min-h-12 rounded-xl border-2 border-slate-300 px-4 text-sm font-semibold text-slate-700"
                  >
                    {t('shared.cancel')}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setVisitDate(todayIso());
                  setVisitNote('');
                  setVisitFormOpen(true);
                }}
                className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-brand-700 bg-white px-4 text-base font-bold text-brand-800"
              >
                <PlusIcon className="h-5 w-5" />
                {t('journey.addVisit')}
              </button>
            )}

            {card && card.visits.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  icon={<ListIcon className="h-6 w-6" />}
                  title={t('journey.noVisits')}
                  body={t('journey.noVisitsBody')}
                />
              </div>
            ) : null}

            {card && card.visits.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {[...card.visits].reverse().map((visit) => (
                  <VisitItem
                    key={visit.id}
                    visit={visit}
                    names={names}
                    language={i18n.language}
                    editing={editingVisit === visit.id}
                    busy={busy}
                    readOnly={!canEdit}
                    onStartEdit={() => setEditingVisit(visit.id)}
                    onCancel={() => setEditingVisit(null)}
                    onSave={(input) => void runWrite(() => editVisit(card, visit.id, input, actor))}
                  />
                ))}
              </ul>
            ) : null}
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-bold text-slate-900">{t('journey.activity')}</h2>
            <ActivityList
              handovers={data.handovers}
              consents={data.consents}
              names={names}
              villages={villageNames}
              language={i18n.language}
            />
          </section>

          <p className="mt-4 text-xs text-slate-500">
            {t('journey.lastUpdated')}: {formatDate(card?.audit.updatedAt.slice(0, 10) ?? null, i18n.language)}
          </p>
        </>
      ) : null}
    </AppShell>
  );
}
