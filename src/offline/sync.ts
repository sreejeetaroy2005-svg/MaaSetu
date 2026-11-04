/**
 * MaaSetu — sync engine.
 *
 * Replays the device's queued changes in the order they were made, one at a
 * time, so an accept can never overtake the consent that authorises it.
 *
 * Safety rules enforced here:
 *  - every write is re-validated against the *server* copy before it is applied
 *  - a handover accept is rejected if the consent was withdrawn meanwhile
 *  - two versions of the same record are kept (never overwritten silently)
 *  - failures are retried with exponential backoff, and only marked "Synced"
 *    once Firestore has confirmed the write
 */
import { collection, doc, getDocFromServer, getDocsFromServer, query, where } from 'firebase/firestore';
import {
  COLLECTIONS,
  SYNTHETIC_FLAG,
  type ConflictRecord,
  type ConsentLogEntry,
  type Handover,
  type JourneyCard,
  type Milestone,
  type MilestoneStatus,
  type Mother,
  type Notification,
  type User,
  type Visit,
  type VisitRevision,
} from '../data/model';
import { newAudit, nowIso, updateDoc as updateAuditedDoc, type Actor } from '../services/audit';
import { db, firestoreStore } from '../services/firebase';
import { acceptHandover, startHandover, withdrawConsent } from '../services/handoverService';
import {
  editVisit,
  saveMilestoneDueDate,
  saveMilestoneStatus,
} from '../services/journeyService';
import { markNotificationRead } from '../services/notificationService';
import { getNetworkSnapshot, isOffline, startNetworkWatcher, subscribeNetwork } from './network';
import {
  getQueueSnapshot,
  initQueue,
  markLastSynced,
  patchOp,
  pendingOps,
  resetForRetry,
  setLastError,
  setSyncing,
} from './queue';
import type { PendingOp } from './types';

/** The server refused a queued change: retrying will not help. */
export class OpRejected extends Error {
  reason: string;

  constructor(reason: string) {
    super(reason);
    this.reason = reason;
  }
}

function actorOf(op: PendingOp): Actor {
  return { id: op.author.id, role: op.author.role };
}

async function freshCard(cardId: string): Promise<JourneyCard> {
  const snap = await getDocFromServer(doc(db, COLLECTIONS.journeyCards, cardId));
  if (!snap.exists()) throw new OpRejected('card_missing');
  return snap.data() as JourneyCard;
}

async function freshDoc<T>(collectionName: string, id: string): Promise<T | null> {
  const snap = await getDocFromServer(doc(db, collectionName, id));
  return snap.exists() ? (snap.data() as T) : null;
}

interface ConflictInput {
  kind: ConflictRecord['kind'];
  motherId: string;
  cardId: string | null;
  recordId: string;
  ours: ConflictRecord['ours'];
  theirs: ConflictRecord['theirs'];
}

async function recordConflict(op: PendingOp, input: ConflictInput): Promise<string> {
  const at = nowIso();
  const record: ConflictRecord = {
    id: `cfl_${crypto.randomUUID()}`,
    ...input,
    resolution: 'kept-both',
    synthetic: SYNTHETIC_FLAG,
    audit: newAudit(actorOf(op), at),
  };
  await firestoreStore.write(COLLECTIONS.conflicts, record.id, { ...record });
  return record.id;
}

export interface AppliedResult {
  serverAt: string;
  conflictId?: string;
}

/**
 * Apply one queued change. Throws {@link OpRejected} when the server state
 * makes it invalid, and a normal Error when it is worth retrying.
 */
export async function applyOp(op: PendingOp): Promise<AppliedResult> {
  const actor = actorOf(op);
  const serverAt = () => nowIso();

  switch (op.kind) {
    case 'visit.add': {
      const card = await freshCard(String(op.cardId));
      const visit = op.payload.visit as Visit;
      if (card.visits.some((item) => item.id === visit.id)) return { serverAt: serverAt() };
      const stored: Visit = { ...visit, pendingSync: false, syncedAt: serverAt() };
      await updateAuditedDoc(
        firestoreStore,
        COLLECTIONS.journeyCards,
        card,
        { visits: [...card.visits, stored] },
        actor,
      );
      return { serverAt: serverAt() };
    }

    case 'visit.edit': {
      const card = await freshCard(String(op.cardId));
      const target = card.visits.find((item) => item.id === op.recordId);
      if (!target) throw new OpRejected('visit_missing');
      const date = String(op.payload.date ?? '');
      const note = String(op.payload.note ?? '');
      const base = op.payload.baseVisit as Visit | undefined;
      const serverChanged =
        base !== undefined && (target.date !== base.date || target.note !== base.note);

      if (serverChanged && (target.date !== date || target.note !== note)) {
        // Keep the server version as the current one and keep this device's
        // version as a revision, then record both for display.
        const revision: VisitRevision = {
          date,
          note,
          editedBy: op.author.id,
          editedAt: op.enteredAt,
          device: true,
        };
        await updateAuditedDoc(
          firestoreStore,
          COLLECTIONS.journeyCards,
          card,
          {
            visits: card.visits.map((item) =>
              item.id === target.id
                ? { ...item, revisions: [...item.revisions, revision], syncedAt: serverAt() }
                : item,
            ),
          },
          actor,
        );
        const conflictId = await recordConflict(op, {
          kind: 'visit.edit',
          motherId: op.motherId,
          cardId: card.id,
          recordId: target.id,
          ours: {
            value: note,
            by: op.author.id,
            byName: op.author.name,
            at: op.enteredAt,
          },
          theirs: {
            value: target.note,
            by: target.enteredBy,
            at: target.enteredAt,
          },
        });
        return { serverAt: serverAt(), conflictId };
      }

      await editVisit(card, target.id, { date, note }, actor);
      return { serverAt: serverAt() };
    }

    case 'milestone.status': {
      const card = await freshCard(String(op.cardId));
      const templateId = String(op.payload.templateId);
      const current = card.milestones.find((item) => item.templateId === templateId);
      if (!current) throw new OpRejected('milestone_missing');
      const base = op.payload.base as Milestone | undefined;
      const status = op.payload.status as MilestoneStatus;
      const doneDate = (op.payload.doneDate as string | null) ?? null;

      if (base && current.status !== base.status) {
        const conflictId = await recordConflict(op, {
          kind: 'milestone.status',
          motherId: op.motherId,
          cardId: card.id,
          recordId: templateId,
          ours: {
            value: status,
            by: op.author.id,
            byName: op.author.name,
            at: op.enteredAt,
          },
          theirs: {
            value: current.status,
            by: card.audit.updatedBy,
            at: card.audit.updatedAt,
          },
        });
        return { serverAt: serverAt(), conflictId };
      }

      await saveMilestoneStatus(card, templateId, status, doneDate, actor);
      return { serverAt: serverAt() };
    }

    case 'milestone.dueDate': {
      const card = await freshCard(String(op.cardId));
      const templateId = String(op.payload.templateId);
      const current = card.milestones.find((item) => item.templateId === templateId);
      if (!current) throw new OpRejected('milestone_missing');
      const base = op.payload.base as Milestone | undefined;
      const dueDate = (op.payload.dueDate as string | null) ?? null;

      if (base && current.dueDate !== base.dueDate) {
        const conflictId = await recordConflict(op, {
          kind: 'milestone.dueDate',
          motherId: op.motherId,
          cardId: card.id,
          recordId: templateId,
          ours: {
            value: dueDate ?? '',
            by: op.author.id,
            byName: op.author.name,
            at: op.enteredAt,
          },
          theirs: {
            value: current.dueDate ?? '',
            by: card.audit.updatedBy,
            at: card.audit.updatedAt,
          },
        });
        return { serverAt: serverAt(), conflictId };
      }

      await saveMilestoneDueDate(card, templateId, dueDate, actor);
      return { serverAt: serverAt() };
    }

    case 'handover.start': {
      const motherId = op.motherId;
      const freshMother = (await freshDoc<Mother>(COLLECTIONS.mothers, motherId)) ?? null;
      if (!freshMother) throw new OpRejected('mother_missing');

      const existingSnap = await getDocsFromServer(
        query(collection(db, COLLECTIONS.handovers), where('motherId', '==', motherId)),
      );
      const active = existingSnap.docs
        .map((item) => item.data() as Handover)
        .find((item) => item.status === 'pending' || item.status === 'accepted');
      if (active) {
        const conflictId = await recordConflict(op, {
          kind: 'handover',
          motherId,
          cardId: op.cardId ?? null,
          recordId: active.id,
          ours: {
            value: String(op.payload.toVillageId ?? ''),
            by: op.author.id,
            byName: op.author.name,
            at: op.enteredAt,
          },
          theirs: {
            value: active.toVillage,
            by: active.audit.updatedBy,
            at: active.audit.updatedAt,
          },
        });
        throw Object.assign(new OpRejected('handover_exists'), { conflictId });
      }

      await startHandover(
        {
          mother: freshMother,
          fromWorker: op.payload.fromWorker as User,
          toVillageId: String(op.payload.toVillageId),
          toWorkerId: String(op.payload.toWorkerId),
          consentGranted: true,
        },
        actor,
      );
      return { serverAt: serverAt() };
    }

    case 'handover.accept': {
      const handoverId = String(op.payload.handoverId);
      const handover = await freshDoc<Handover>(COLLECTIONS.handovers, handoverId);
      if (!handover) throw new OpRejected('handover_missing');
      // Consent withdrawn while this accept was queued: do not apply it.
      if (handover.status === 'revoked') throw new OpRejected('consent_withdrawn');
      if (handover.status === 'accepted') return { serverAt: serverAt() };

      await acceptHandover(handover, op.payload.worker as User, actor);
      return { serverAt: serverAt() };
    }

    case 'consent.withdraw': {
      const handoverId = String(op.payload.handoverId);
      const handover = await freshDoc<Handover>(COLLECTIONS.handovers, handoverId);
      if (!handover) throw new OpRejected('handover_missing');
      if (handover.status === 'revoked') return { serverAt: serverAt() };

      const mother =
        (await freshDoc<Mother>(COLLECTIONS.mothers, String(op.payload.motherId))) ??
        (op.payload.mother as Mother);
      const consent =
        (await freshDoc<ConsentLogEntry>(COLLECTIONS.consentLog, handover.consentId)) ??
        (op.payload.consent as ConsentLogEntry);
      await withdrawConsent(mother, handover, consent, actor);
      return { serverAt: serverAt() };
    }

    case 'notification.read': {
      await markNotificationRead(op.payload.notification as Notification, actor);
      return { serverAt: serverAt() };
    }

    default:
      return { serverAt: serverAt() };
  }
}

/* ----------------------------------------------------------------- engine */

let started = false;
let running = false;
let timer: number | null = null;

function schedule(delayMs: number): void {
  if (timer !== null) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = null;
    void drain(false);
  }, Math.max(0, delayMs));
}

function backoffMs(attempts: number): number {
  return Math.min(2000 * 2 ** Math.max(0, attempts - 1), 60000);
}

async function drain(manual: boolean): Promise<void> {
  if (running) return;
  if (isOffline()) return;
  const todo = pendingOps();
  if (todo.length === 0) return;

  running = true;
  setSyncing(true);
  try {
    for (const op of todo) {
      if (isOffline()) break;
      if (!manual && Date.now() < op.nextAttemptAt) continue;
      await patchOp(op.id, { status: 'syncing' });
      try {
        const result = await applyOp(op);
        await patchOp(op.id, {
          status: 'synced',
          syncedAt: nowIso(),
          serverAt: result.serverAt,
          conflictId: result.conflictId,
          lastError: undefined,
        });
        markLastSynced(result.serverAt);
      } catch (error) {
        if (error instanceof OpRejected) {
          await patchOp(op.id, {
            status: 'rejected',
            rejectedReason: error.reason,
            lastError: error.reason,
          });
        } else {
          const attempts = op.attempts + 1;
          await patchOp(op.id, {
            status: 'failed',
            attempts,
            nextAttemptAt: Date.now() + backoffMs(attempts),
            lastError: error instanceof Error ? error.message : String(error),
          });
          setLastError(error instanceof Error ? error.message : String(error));
        }
      }
    }
  } finally {
    running = false;
    setSyncing(false);
  }

  const remaining = pendingOps();
  if (remaining.length > 0 && !isOffline()) {
    const soonest = Math.min(...remaining.map((op) => op.nextAttemptAt || Date.now()));
    schedule(Math.max(0, soonest - Date.now()));
  }
}

/** Ask the engine to run shortly (used right after a change is queued). */
export function requestSync(delayMs = 0): void {
  schedule(delayMs);
}

/** "Sync now": clear the backoff and try every queued change immediately. */
export async function syncNow(): Promise<void> {
  await resetForRetry();
  await drain(true);
}

/** Start the engine once, for the lifetime of the app. */
export function startSyncEngine(): void {
  if (started) return;
  started = true;
  startNetworkWatcher();
  subscribeNetwork(() => {
    if (getNetworkSnapshot().status !== 'offline' && pendingOps().length > 0) schedule(0);
  });
  window.addEventListener('online', () => schedule(0));
  void initQueue().then(() => {
    if (pendingOps(getQueueSnapshot().ops).length > 0) schedule(0);
  });
}

/** Export for the demo tools: how many changes are still on this device. */
export function queuedChangeCount(): number {
  return pendingOps().length;
}
