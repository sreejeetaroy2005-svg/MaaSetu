/**
 * MaaSetu — offline-aware data access.
 *
 * Reads: when the connection is up, load from Firestore and keep a snapshot on
 * the device; when it is down (or the read fails), serve the snapshot. Pending
 * changes on this device are applied on top, so a visit typed in a village with
 * no signal is still there after a reload.
 *
 * Writes: online they go straight to the audited services; offline they are
 * applied locally and queued, and the caller gets `queued: true` so the screen
 * can say "Waiting to sync" instead of pretending the change was saved.
 */
import { nowIso } from '../services/audit';
import type { Actor } from '../services/audit';
import {
  type ConflictRecord,
  type ConsentLogEntry,
  type Handover,
  type JourneyCard,
  type MilestoneStatus,
  type Mother,
  type Notification,
  type User,
  type Village,
  type Visit,
} from '../data/model';
import { withMilestoneDueDate, withMilestoneStatus } from '../data/journey';
import {
  listAllConsentLogs,
  listAllHandovers,
  startHandover,
  withdrawConsent,
} from '../services/handoverService';
import {
  addVisit,
  editVisit,
  fetchJourneyCard,
  listAllMothers,
  listAllUsers,
  listJourneyCards,
  listVillages,
  saveMilestoneDueDate,
  saveMilestoneStatus,
  type VisitInput,
} from '../services/journeyService';
import { listConflictsForMother } from '../services/conflictService';
import { listNotifications, markNotificationRead } from '../services/notificationService';
import { idbGet, idbSet } from './idb';
import { isOffline } from './network';
import { enqueue } from './queue';
import { requestSync } from './sync';
import type { DeviceAuthor, PendingOp } from './types';

const WORKSPACE_KEY = 'workspace.v2';
const NOTIFICATIONS_KEY = (userId: string) => `notifications.v2.${userId}`;
const PROFILE_KEY = 'profile.v2';

export interface Workspace {
  villages: Village[];
  users: User[];
  mothers: Mother[];
  cards: JourneyCard[];
  handovers: Handover[];
  consents: ConsentLogEntry[];
  cachedAt: string;
}

export interface StoredProfile {
  phone: string;
  kind: 'worker' | 'mother';
  id: string;
  savedAt: string;
}

/* --------------------------------------------------------------- utilities */

export function deviceAuthor(actor: Actor | null, name: string): DeviceAuthor {
  return {
    id: actor?.id ?? '',
    name: name || actor?.id || '',
    role: actor?.role ?? 'system',
  };
}

/** Apply changes still queued on this device on top of a stored card. */
export function withPendingChanges(card: JourneyCard, ops: PendingOp[]): JourneyCard {
  let next = card;
  for (const op of ops) {
    if (op.cardId !== card.id) continue;
    if (op.status === 'synced' || op.status === 'rejected') continue;
    switch (op.kind) {
      case 'visit.add': {
        const visit = op.payload.visit as Visit;
        if (!next.visits.some((item) => item.id === visit.id)) {
          next = { ...next, visits: [...next.visits, visit] };
        }
        break;
      }
      case 'visit.edit': {
        next = {
          ...next,
          visits: next.visits.map((item) =>
            item.id === op.recordId
              ? { ...item, date: String(op.payload.date ?? item.date), note: String(op.payload.note ?? item.note) }
              : item,
          ),
        };
        break;
      }
      case 'milestone.status': {
        next = {
          ...next,
          milestones: withMilestoneStatus(
            next.milestones,
            String(op.payload.templateId),
            op.payload.status as MilestoneStatus,
            (op.payload.doneDate as string | null) ?? null,
          ),
        };
        break;
      }
      case 'milestone.dueDate': {
        next = {
          ...next,
          milestones: withMilestoneDueDate(
            next.milestones,
            String(op.payload.templateId),
            (op.payload.dueDate as string | null) ?? null,
          ),
        };
        break;
      }
      default:
        break;
    }
  }
  return next;
}

/* ------------------------------------------------------------------ reads */

/** A snapshot written by another build (or half-written) is ignored, not rendered. */
function isWorkspace(value: unknown): value is Workspace {
  const candidate = value as Workspace | null;
  return (
    !!candidate &&
    Array.isArray(candidate.villages) &&
    Array.isArray(candidate.users) &&
    Array.isArray(candidate.mothers) &&
    Array.isArray(candidate.cards) &&
    Array.isArray(candidate.handovers) &&
    Array.isArray(candidate.consents)
  );
}

async function cachedWorkspace(): Promise<Workspace | null> {
  const stored = await idbGet<Workspace>(WORKSPACE_KEY);
  return isWorkspace(stored) ? stored : null;
}

/**
 * The whole prototype dataset in one snapshot: it is a few dozen documents, so
 * one cached read makes every screen work offline instead of a query per page.
 */
export async function loadWorkspace(ops: PendingOp[] = []): Promise<Workspace> {
  if (!isOffline()) {
    try {
      const [villages, users, mothers, cards, handovers, consents] = await Promise.all([
        listVillages(),
        listAllUsers(),
        listAllMothers(),
        listJourneyCards(),
        listAllHandovers(),
        listAllConsentLogs(),
      ]);
      const workspace: Workspace = {
        villages,
        users,
        mothers,
        cards,
        handovers,
        consents,
        cachedAt: nowIso(),
      };
      await idbSet(WORKSPACE_KEY, workspace);
      return applyOps(workspace, ops);
    } catch (error) {
      console.warn('MaaSetu: could not refresh offline data, using the copy on this device', error);
    }
  }

  const cached = await cachedWorkspace();
  if (cached) return applyOps(cached, ops);
  throw new Error('offline-no-cache');
}

function applyOps(workspace: Workspace, ops: PendingOp[]): Workspace {
  if (ops.length === 0) return workspace;
  return {
    ...workspace,
    cards: workspace.cards.map((card) => withPendingChanges(card, ops)),
  };
}

export interface MotherCardBundle {
  mother: Mother;
  card: JourneyCard | null;
  consents: ConsentLogEntry[];
  conflicts: ConflictRecord[];
  villageName: string;
  users: User[];
  villages: Village[];
  /** Only this mother's handovers, oldest first. */
  handovers: Handover[];
}

export async function loadMotherCard(
  motherId: string,
  ops: PendingOp[] = [],
): Promise<MotherCardBundle | null> {
  const workspace = await loadWorkspace(ops);
  const mother = workspace.mothers.find((item) => item.id === motherId) ?? null;
  if (!mother) return null;
  const villageName =
    workspace.villages.find((item) => item.id === mother.village)?.name ?? mother.village;

  let card = workspace.cards.find((item) => item.motherId === motherId) ?? null;
  if (!isOffline()) {
    try {
      const fresh = await fetchJourneyCard(motherId);
      if (fresh) card = withPendingChanges(fresh, ops);
    } catch {
      /* keep the cached card */
    }
  }

  let conflicts: ConflictRecord[] = [];
  try {
    conflicts = await listConflictsForMother(motherId);
  } catch {
    conflicts = [];
  }

  return {
    mother,
    card,
    consents: workspace.consents.filter((item) => item.motherId === motherId),
    conflicts,
    villageName,
    users: workspace.users,
    villages: workspace.villages,
    handovers: workspace.handovers.filter((item) => item.motherId === motherId),
  };
}

export async function loadNotifications(
  userId: string,
  ops: PendingOp[] = [],
): Promise<Notification[]> {
  const applyReads = (items: Notification[]): Notification[] =>
    items.map((item) => {
      const queuedRead = ops.some(
        (op) =>
          op.kind === 'notification.read' &&
          op.status !== 'synced' &&
          op.status !== 'rejected' &&
          (op.payload.notification as Notification | undefined)?.id === item.id,
      );
      return queuedRead && !item.readAt ? { ...item, readAt: nowIso() } : item;
    });

  if (!isOffline()) {
    try {
      const items = await listNotifications(userId);
      await idbSet(NOTIFICATIONS_KEY(userId), items);
      return applyReads(items);
    } catch (error) {
      console.warn('MaaSetu: could not refresh notifications', error);
    }
  }

  const cached = await idbGet<Notification[]>(NOTIFICATIONS_KEY(userId));
  return applyReads(Array.isArray(cached) ? cached : []);
}

/** Warm the device right after an online sign-in. Failures are not fatal. */
export async function prepareOfflineData(workerId: string | null): Promise<void> {
  try {
    await loadWorkspace();
    if (workerId) await loadNotifications(workerId);
  } catch (error) {
    console.warn('MaaSetu: could not prepare offline data', error);
  }
}

/* ------------------------------------------------------------- profile */

export async function cacheProfile(phone: string, profile: { kind: 'worker' | 'mother'; id: string }): Promise<void> {
  await idbSet(PROFILE_KEY, { phone, ...profile, savedAt: nowIso() } satisfies StoredProfile);
}

export async function readCachedProfile(phone: string): Promise<StoredProfile | null> {
  const stored = await idbGet<StoredProfile>(PROFILE_KEY);
  return stored && stored.phone === phone ? stored : null;
}

export async function clearCachedProfile(): Promise<void> {
  await idbSet(PROFILE_KEY, null);
}

/** Who was signed in on this phone, read from the copy kept on the device. */
export async function loadCachedProfile(
  phone: string,
): Promise<{ kind: 'worker'; worker: User } | { kind: 'mother'; mother: Mother } | null> {
  const stored = await idbGet<StoredProfile>(PROFILE_KEY);
  if (!stored || stored.phone !== phone) return null;
  const workspace = await cachedWorkspace();
  if (!workspace) return null;
  if (stored.kind === 'worker') {
    const worker = workspace.users.find((item) => item.id === stored.id);
    return worker ? { kind: 'worker', worker } : null;
  }
  const mother = workspace.mothers.find((item) => item.id === stored.id);
  return mother ? { kind: 'mother', mother } : null;
}

/* --------------------------------------------------------------- writes */

export interface WriteOutcome<T> {
  value: T;
  queued: boolean;
}

export async function recordVisit(
  card: JourneyCard,
  input: VisitInput,
  actor: Actor,
  author: DeviceAuthor,
): Promise<WriteOutcome<JourneyCard>> {
  if (!isOffline()) {
    return { value: await addVisit(card, input, actor), queued: false };
  }

  const visit: Visit = {
    id: `vst_${crypto.randomUUID()}`,
    date: input.date,
    enteredBy: author.id,
    enteredAt: nowIso(),
    note: input.note.trim(),
    revisions: [],
    pendingSync: true,
    syncedAt: null,
  };
  await enqueue({
    kind: 'visit.add',
    motherId: card.motherId,
    cardId: card.id,
    recordId: visit.id,
    payload: { visit },
    baseUpdatedAt: card.audit.updatedAt,
    author,
    enteredAt: visit.enteredAt,
  });
  requestSync();
  return { value: { ...card, visits: [...card.visits, visit] }, queued: true };
}

export async function correctVisit(
  card: JourneyCard,
  visitId: string,
  input: VisitInput,
  actor: Actor,
  author: DeviceAuthor,
): Promise<WriteOutcome<JourneyCard>> {
  if (!isOffline()) {
    return { value: await editVisit(card, visitId, input, actor), queued: false };
  }

  const baseVisit = card.visits.find((item) => item.id === visitId);
  if (!baseVisit) return { value: card, queued: false };
  await enqueue({
    kind: 'visit.edit',
    motherId: card.motherId,
    cardId: card.id,
    recordId: visitId,
    payload: { date: input.date, note: input.note.trim(), baseVisit },
    baseUpdatedAt: card.audit.updatedAt,
    author,
    enteredAt: nowIso(),
  });
  requestSync();
  return {
    value: {
      ...card,
      visits: card.visits.map((item) =>
        item.id === visitId
          ? { ...item, date: input.date, note: input.note.trim(), pendingSync: true }
          : item,
      ),
    },
    queued: true,
  };
}

export async function setMilestoneStatus(
  card: JourneyCard,
  templateId: string,
  status: MilestoneStatus,
  doneDate: string | null,
  actor: Actor,
  author: DeviceAuthor,
): Promise<WriteOutcome<JourneyCard>> {
  if (!isOffline()) {
    return {
      value: await saveMilestoneStatus(card, templateId, status, doneDate, actor),
      queued: false,
    };
  }

  const base = card.milestones.find((item) => item.templateId === templateId);
  await enqueue({
    kind: 'milestone.status',
    motherId: card.motherId,
    cardId: card.id,
    recordId: templateId,
    payload: { templateId, status, doneDate, base },
    baseUpdatedAt: card.audit.updatedAt,
    author,
    enteredAt: nowIso(),
  });
  requestSync();
  return {
    value: {
      ...card,
      milestones: withMilestoneStatus(card.milestones, templateId, status, doneDate),
    },
    queued: true,
  };
}

export async function setMilestoneDueDate(
  card: JourneyCard,
  templateId: string,
  dueDate: string | null,
  actor: Actor,
  author: DeviceAuthor,
): Promise<WriteOutcome<JourneyCard>> {
  if (!isOffline()) {
    return {
      value: await saveMilestoneDueDate(card, templateId, dueDate, actor),
      queued: false,
    };
  }

  const base = card.milestones.find((item) => item.templateId === templateId);
  await enqueue({
    kind: 'milestone.dueDate',
    motherId: card.motherId,
    cardId: card.id,
    recordId: templateId,
    payload: { templateId, dueDate, base },
    baseUpdatedAt: card.audit.updatedAt,
    author,
    enteredAt: nowIso(),
  });
  requestSync();
  return {
    value: { ...card, milestones: withMilestoneDueDate(card.milestones, templateId, dueDate) },
    queued: true,
  };
}

export interface StartHandoverOutcome {
  queued: boolean;
}

/**
 * Consent + handover. Offline nothing leaves the device: the consent is kept
 * here with the device clock and the receiving worker hears about it only
 * after the change syncs.
 */
export async function beginHandover(
  input: {
    mother: Mother;
    fromWorker: User;
    toVillageId: string;
    toWorkerId: string;
  },
  actor: Actor,
  author: DeviceAuthor,
): Promise<StartHandoverOutcome> {
  if (!isOffline()) {
    await startHandover({ ...input, consentGranted: true }, actor);
    return { queued: false };
  }

  await enqueue({
    kind: 'handover.start',
    motherId: input.mother.id,
    payload: {
      mother: input.mother,
      fromWorker: input.fromWorker,
      toVillageId: input.toVillageId,
      toWorkerId: input.toWorkerId,
    },
    baseUpdatedAt: input.mother.audit.updatedAt,
    author,
    enteredAt: nowIso(),
  });
  requestSync();
  return { queued: true };
}

export async function acceptHandoverOffline(
  handover: Handover,
  worker: User,
  actor: Actor,
  author: DeviceAuthor,
): Promise<{ queued: boolean }> {
  if (!isOffline()) {
    const { acceptHandover } = await import('../services/handoverService');
    await acceptHandover(handover, worker, actor);
    return { queued: false };
  }

  await enqueue({
    kind: 'handover.accept',
    motherId: handover.motherId,
    payload: { handoverId: handover.id, worker },
    baseUpdatedAt: handover.audit.updatedAt,
    author,
    enteredAt: nowIso(),
  });
  requestSync();
  return { queued: true };
}

export async function withdrawConsentOffline(
  mother: Mother,
  handover: Handover,
  consent: ConsentLogEntry,
  actor: Actor,
  author: DeviceAuthor,
): Promise<{ queued: boolean }> {
  if (!isOffline()) {
    await withdrawConsent(mother, handover, consent, actor);
    return { queued: false };
  }

  await enqueue({
    kind: 'consent.withdraw',
    motherId: mother.id,
    payload: { mother, handoverId: handover.id, consent },
    baseUpdatedAt: handover.audit.updatedAt,
    author,
    enteredAt: nowIso(),
  });
  requestSync();
  return { queued: true };
}

export async function markReadOffline(
  notification: Notification,
  actor: Actor,
  author: DeviceAuthor,
): Promise<{ queued: boolean }> {
  if (!isOffline()) {
    await markNotificationRead(notification, actor);
    return { queued: false };
  }

  await enqueue({
    kind: 'notification.read',
    motherId: notification.motherId,
    payload: { notification: { ...notification, readAt: nowIso() } },
    author,
    enteredAt: nowIso(),
  });
  requestSync();
  return { queued: true };
}
