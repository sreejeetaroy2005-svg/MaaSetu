/**
 * MaaSetu — the offline write queue.
 *
 * Every change made on this device goes through here. Online it is applied
 * immediately; offline (or on a failing connection) it is kept in IndexedDB
 * with the device clock and the author, and replayed in order when the network
 * comes back. The queue is the single source of truth for the "Waiting to
 * sync" / "Synced" badges and the "Pending changes: N" counter.
 */
import { nowIso } from '../services/audit';
import { idbDeleteOutbox, idbOutboxAll, idbPutOutbox } from './idb';
import type { OpKind, OpStatus, PendingOp, QueueSnapshot } from './types';

const listeners = new Set<() => void>();
const MAX_KEPT = 200;

let snapshot: QueueSnapshot = {
  ready: false,
  ops: [],
  syncing: false,
  lastSyncedAt: null,
  lastError: null,
};

function emit(patch: Partial<QueueSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  for (const listener of listeners) listener();
}

export function getQueueSnapshot(): QueueSnapshot {
  return snapshot;
}

export function subscribeQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function sortOps(ops: PendingOp[]): PendingOp[] {
  return [...ops].sort((a, b) => a.enteredAt.localeCompare(b.enteredAt));
}

/** Load persisted changes once, at start-up. */
export async function initQueue(): Promise<void> {
  if (snapshot.ready) return;
  const rows = await idbOutboxAll<PendingOp>();
  const ops = sortOps(
    rows.filter((row) => row && typeof row.id === 'string' && typeof row.kind === 'string'),
  );
  emit({ ops, ready: true });
}

async function persist(op: PendingOp): Promise<void> {
  await idbPutOutbox(op);
}

export interface NewOp {
  kind: OpKind;
  motherId: string;
  cardId?: string;
  recordId?: string;
  payload: Record<string, unknown>;
  baseUpdatedAt?: string;
  author: PendingOp['author'];
  enteredAt: string;
}

/** Add a change to the queue (device time + author are stamped here). */
export async function enqueue(input: NewOp): Promise<PendingOp> {
  const op: PendingOp = {
    ...input,
    id: `op_${crypto.randomUUID()}`,
    status: 'waiting',
    attempts: 0,
    nextAttemptAt: 0,
  };
  const ops = sortOps([...snapshot.ops, op]).slice(-MAX_KEPT);
  emit({ ops });
  await persist(op);
  return op;
}

export async function patchOp(id: string, patch: Partial<PendingOp>): Promise<PendingOp | null> {
  let updated: PendingOp | null = null;
  const ops = snapshot.ops.map((op) => {
    if (op.id !== id) return op;
    updated = { ...op, ...patch };
    return updated;
  });
  emit({ ops });
  if (updated) await persist(updated);
  return updated;
}

export async function removeOp(id: string): Promise<void> {
  emit({ ops: snapshot.ops.filter((op) => op.id !== id) });
  await idbDeleteOutbox(id);
}

/** Manual retry: clear the backoff and let the engine try again now. */
export async function resetForRetry(): Promise<void> {
  const ops: PendingOp[] = [];
  for (const op of snapshot.ops) {
    if (op.status === 'waiting' || op.status === 'failed') {
      const next = { ...op, status: 'waiting' as OpStatus, attempts: 0, nextAttemptAt: 0 };
      ops.push(next);
      await persist(next);
    } else {
      ops.push(op);
    }
  }
  emit({ ops: sortOps(ops), lastError: null });
}

export function setSyncing(syncing: boolean): void {
  emit({ syncing });
}

export function setLastError(lastError: string | null): void {
  emit({ lastError });
}

export function markLastSynced(at: string = nowIso()): void {
  emit({ lastSyncedAt: at, lastError: null });
}

/* --------------------------------------------------------------- selectors */

export function pendingOps(ops: PendingOp[] = snapshot.ops): PendingOp[] {
  return ops.filter((op) => op.status === 'waiting' || op.status === 'syncing' || op.status === 'failed');
}

export function pendingCount(ops: PendingOp[] = snapshot.ops): number {
  return pendingOps(ops).length;
}

export function rejectedOps(ops: PendingOp[] = snapshot.ops): PendingOp[] {
  return ops.filter((op) => op.status === 'rejected');
}

/** The badge state for one record (a visit, a milestone, a handover). */
export function syncStateFor(
  ops: PendingOp[],
  match: { kind?: OpKind[]; recordId?: string; motherId?: string },
): OpStatus | undefined {
  const candidates = ops.filter((op) => {
    if (match.kind && !match.kind.includes(op.kind)) return false;
    if (match.recordId !== undefined && op.recordId !== match.recordId) return false;
    if (match.motherId !== undefined && op.motherId !== match.motherId) return false;
    return true;
  });
  if (candidates.length === 0) return undefined;
  const latest = candidates[candidates.length - 1];
  return latest?.status;
}

/** Newest queued change of one kind for a mother (used by the card banners). */
export function latestOpFor(
  ops: PendingOp[],
  kind: OpKind[],
  motherId: string,
): PendingOp | undefined {
  return [...ops]
    .filter((op) => op.motherId === motherId && kind.includes(op.kind))
    .sort((a, b) => b.enteredAt.localeCompare(a.enteredAt))[0];
}

export function opsForMother(ops: PendingOp[], motherId: string): PendingOp[] {
  return ops.filter((op) => op.motherId === motherId);
}
