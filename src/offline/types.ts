/**
 * MaaSetu — offline types.
 *
 * A change made on this device becomes a {@link PendingOp}. The op keeps the
 * version it was made against (`baseUpdatedAt`) so the sync engine can tell a
 * clean change from a conflicting one, and it keeps both clocks:
 *  - `enteredAt` — device time, when the person wrote it
 *  - `syncedAt`  — server time, when the change actually reached Firestore
 */
import type { ActorRole, AudienceSyncState } from '../data/model';

export type OpKind =
  | 'visit.add'
  | 'visit.edit'
  | 'milestone.status'
  | 'milestone.dueDate'
  | 'handover.start'
  | 'handover.accept'
  | 'consent.withdraw'
  | 'notification.read';

export type OpStatus = 'waiting' | 'syncing' | 'synced' | 'failed' | 'rejected';

/** Who typed it, on which device, and when (device clock). */
export interface DeviceAuthor {
  id: string;
  name: string;
  role: ActorRole;
}

export interface PendingOp {
  id: string;
  kind: OpKind;
  /** Mother this change belongs to (used to badge her card and rows). */
  motherId: string;
  /** Journey card id, when the change touches one. */
  cardId?: string;
  /** Record id inside the card (visit id) or milestone template id. */
  recordId?: string;
  payload: Record<string, unknown>;
  /** `audit.updatedAt` of the document version this change was written against. */
  baseUpdatedAt?: string;
  author: DeviceAuthor;
  /** ISO string from the device clock. */
  enteredAt: string;
  status: OpStatus;
  attempts: number;
  /** Epoch ms — the backoff gate. */
  nextAttemptAt: number;
  lastError?: string;
  /** Rejection reason shown to the person, e.g. `consent_withdrawn`. */
  rejectedReason?: string;
  /** Set when the server accepted the change. */
  serverAt?: string;
  syncedAt?: string;
  conflictId?: string;
}

/** Aggregate state the UI renders (stable identity for useSyncExternalStore). */
export interface QueueSnapshot {
  ready: boolean;
  ops: PendingOp[];
  syncing: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export type ConnectionStatus = 'online' | 'slow' | 'offline';

export interface NetworkSnapshot {
  status: ConnectionStatus;
  simulated: boolean;
  latencyMs: number | null;
  checkedAt: string | null;
}

/**
 * Per-record sync badge, resolved from the queue:
 * - `waiting` / `syncing` / `failed` → "Waiting to sync"
 * - `synced`                        → "Synced"
 * - `rejected`                      → the server refused it (message required)
 */
export type RecordSyncState = Exclude<OpStatus, 'synced'> | 'synced' | undefined;

export type { AudienceSyncState };
