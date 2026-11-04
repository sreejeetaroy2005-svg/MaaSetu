/**
 * MaaSetu — the care tracker.
 *
 * A parcel-tracking view of one mother's move, derived only from records that
 * already exist: the consent log entry, the handover, the "seen" marker and the
 * visit log. Nothing is stored twice and nothing is inferred about her health —
 * a stage is complete only when a stored record (confirmed by the server) says
 * so. A change still sitting on the phone shows as "Not sent yet", never as a
 * completed step.
 *
 * SAFETY: stage text comes from fixed translation templates; the only values
 * used here are names, villages and timestamps.
 */
import type { ConsentLogEntry, Handover, JourneyCard, Mother, User } from './model';
import { latestHandover, motherStatus } from './handover';

/** How long a handover may wait for acceptance before it is shown as overdue. */
export const HANDOVER_OVERDUE_HOURS = 48;

export const TRACKER_STAGE_IDS = ['planned', 'sent', 'seen', 'accepted', 'firstVisit'] as const;

export type TrackerStageId = (typeof TRACKER_STAGE_IDS)[number];

export type TrackerStageState = 'done' | 'current' | 'waiting' | 'stopped';

export interface TrackerStage {
  id: TrackerStageId;
  state: TrackerStageState;
  /** ISO time of the stored record that completes this stage. */
  at: string | null;
  /** Who did it (user id), when the record carries one. */
  byId: string | null;
  /** Village this step belongs to, when it belongs to one. */
  villageId: string | null;
}

/**
 * Handover steps still queued on this device. They are kept apart from the
 * stored records so the tracker can say "not sent yet" without pretending a
 * step happened.
 */
export interface QueuedHandoverSteps {
  /** Device time the consent was recorded offline. */
  startAt?: string | null;
  /** Who recorded that consent on this phone. */
  startById?: string | null;
  startToVillage?: string | null;
  startToWorker?: string | null;
  /** Device time an accept was queued offline. */
  acceptAt?: string | null;
  /** Device time a withdrawal was queued offline. */
  withdrawAt?: string | null;
}

export interface CareTracker {
  stages: TrackerStage[];
  doneCount: number;
  total: number;
  currentStageId: TrackerStageId | null;
  /** Consent on this phone, handover not on the server yet. */
  notSentYet: boolean;
  /** Creation time of a pending handover that has waited too long. */
  overdueSince: string | null;
  overdueHours: number;
  withdrawn: { at: string; byId: string | null } | null;
  currentVillageId: string;
  currentWorkerId: string;
  toVillageId: string | null;
  toWorkerId: string | null;
  lastUpdatedAt: string | null;
}

interface TrackerInput {
  mother: Mother;
  handovers: Handover[];
  consents: ConsentLogEntry[];
  card: JourneyCard | null;
  users: User[];
  queued?: QueuedHandoverSteps;
  /** Epoch ms — injectable so the overdue rule can be read without waiting. */
  now?: number;
}

function latestIso(values: Array<string | null | undefined>): string | null {
  const present = values.filter((value): value is string => typeof value === 'string' && value !== '');
  if (present.length === 0) return null;
  return present.sort((a, b) => a.localeCompare(b))[present.length - 1];
}

/**
 * Build the tracker for one mother. Pure: the pages pass the records they
 * already loaded, so every screen shows the same five stages.
 */
export function buildCareTracker(input: TrackerInput): CareTracker {
  const { mother, handovers, consents, card, users } = input;
  const queued = input.queued ?? {};
  const now = input.now ?? Date.now();

  const handover = latestHandover(handovers, mother.id);
  const status = motherStatus(mother, handovers);

  const granted = consents
    .filter((item) => item.motherId === mother.id && item.grantedAt)
    .sort((a, b) => (a.grantedAt ?? '').localeCompare(b.grantedAt ?? ''));
  // Tie the consent to the handover on screen: another (older, withdrawn)
  // consent must never make a live move look stopped.
  const consentForHandover = handover
    ? consents.find((item) => item.id === handover.consentId) ?? null
    : null;
  const consent = consentForHandover ?? (granted.length > 0 ? granted[granted.length - 1] : null);

  const plannedAt = consent?.grantedAt ?? queued.startAt ?? null;
  const plannedBy = consent?.recordedBy ?? queued.startById ?? null;

  /** Only records that exist on the server complete a stage. */
  const sentAt = handover?.createdAt ?? null;
  const seenAt = handover?.seenAt ?? null;
  const seenBy = handover?.seenBy ?? null;
  const acceptedAt = handover?.acceptedAt ?? null;

  // Stage 5: the first visit entered by a worker of the receiving village,
  // after her care was accepted. Nothing is computed from what the visit says.
  // Kept even if the consent is withdrawn later: the visit did happen, and a
  // withdrawal stops the move, it does not rewrite what already took place.
  let firstVisit: { at: string; byId: string } | null = null;
  if (handover && acceptedAt) {
    const receiving = new Set(
      users.filter((user) => user.village === handover.toVillage).map((user) => user.id),
    );
    const visits = (card?.visits ?? [])
      .filter((visit) => receiving.has(visit.enteredBy) && visit.enteredAt > acceptedAt)
      .sort((a, b) => a.enteredAt.localeCompare(b.enteredAt));
    if (visits.length > 0) firstVisit = { at: visits[0].enteredAt, byId: visits[0].enteredBy };
  }

  const withdrawnAt = consent?.withdrawnAt ?? handover?.revokedAt ?? queued.withdrawAt ?? null;
  const withdrawnBy =
    consent?.withdrawnBy ??
    handover?.revokedBy ??
    (queued.withdrawAt ? mother.id : null);

  const notSentYet = plannedAt !== null && sentAt === null && withdrawnAt === null;

  const raw: Array<Omit<TrackerStage, 'state'>> = [
    { id: 'planned', at: plannedAt, byId: plannedBy, villageId: null },
    {
      id: 'sent',
      at: sentAt,
      byId: handover?.fromWorkerId ?? null,
      villageId: handover?.toVillage ?? queued.startToVillage ?? null,
    },
    { id: 'seen', at: seenAt, byId: seenBy, villageId: null },
    { id: 'accepted', at: acceptedAt, byId: handover?.acceptedBy ?? null, villageId: handover?.toVillage ?? null },
    {
      id: 'firstVisit',
      at: firstVisit?.at ?? null,
      byId: firstVisit?.byId ?? null,
      villageId: handover?.toVillage ?? null,
    },
  ];

  // A withdrawal stops the tracker: nothing after the last completed step is
  // shown as still on its way, because it will not happen.
  let currentTaken = false;
  const stages: TrackerStage[] = raw.map((stage) => {
    if (stage.at) return { ...stage, state: 'done' };
    if (withdrawnAt) return { ...stage, state: 'stopped' };
    if (!currentTaken) {
      currentTaken = true;
      return { ...stage, state: 'current' };
    }
    return { ...stage, state: 'waiting' };
  });

  const doneCount = stages.filter((stage) => stage.state === 'done').length;
  const current = stages.find((stage) => stage.state === 'current') ?? null;

  const overdueSince =
    handover &&
    handover.status === 'pending' &&
    now - Date.parse(handover.createdAt) > HANDOVER_OVERDUE_HOURS * 60 * 60 * 1000
      ? handover.createdAt
      : null;

  return {
    stages,
    doneCount,
    total: stages.length,
    currentStageId: current?.id ?? null,
    notSentYet,
    overdueSince,
    overdueHours: HANDOVER_OVERDUE_HOURS,
    withdrawn: withdrawnAt ? { at: withdrawnAt, byId: withdrawnBy } : null,
    currentVillageId: status.currentVillageId,
    currentWorkerId: status.currentWorkerId,
    toVillageId: handover?.toVillage ?? queued.startToVillage ?? null,
    toWorkerId: handover?.toWorkerId ?? queued.startToWorker ?? null,
    lastUpdatedAt: latestIso([
      plannedAt,
      sentAt,
      seenAt,
      acceptedAt,
      firstVisit?.at ?? null,
      consent?.audit.updatedAt,
      handover?.audit.updatedAt,
      card?.audit.updatedAt,
    ]),
  };
}

/** Whole days a pending handover has been waiting (for the gentle reminder). */
export function overdueDays(since: string, now: number = Date.now()): number {
  const elapsed = now - Date.parse(since);
  return Math.max(1, Math.floor(elapsed / (24 * 60 * 60 * 1000)));
}
