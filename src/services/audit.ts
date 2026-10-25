/**
 * MaaSetu — audit-trail write helpers.
 *
 * Every write to Firestore MUST go through {@link createDoc} or
 * {@link updateDoc}. They stamp the document with who/when and append an
 * entry to the `auditLog` collection, so the trail survives even if a
 * document is later edited or deleted.
 *
 * The helpers are SDK-agnostic: the caller supplies a tiny {@link AuditStore}
 * adapter (client SDK in the app, Admin SDK in `scripts/seed.ts`).
 */
import {
  COLLECTIONS,
  SYNTHETIC_FLAG,
  type ActorRole,
  type AuditLogEntry,
  type AuditStamp,
  type Role,
} from '../data/model';

export interface Actor {
  id: string;
  role: ActorRole;
}

/** Used by the seed script only — never for real user writes. */
export const SEED_ACTOR: Actor = { id: 'system:seed', role: 'system' };

export function nowIso(): string {
  return new Date().toISOString();
}

/** Fresh stamp for a brand-new document. */
export function newAudit(actor: Actor, at: string = nowIso()): AuditStamp {
  return {
    createdBy: actor.id,
    createdByRole: actor.role,
    createdAt: at,
    updatedBy: actor.id,
    updatedByRole: actor.role,
    updatedAt: at,
  };
}

/** Keep the original creation stamp, move the update stamp forward. */
export function touchAudit(previous: AuditStamp, actor: Actor, at: string = nowIso()): AuditStamp {
  return {
    ...previous,
    updatedBy: actor.id,
    updatedByRole: actor.role,
    updatedAt: at,
  };
}

/** Minimal write surface shared by the client and admin Firestore SDKs. */
export interface AuditStore {
  write(collection: string, id: string, data: Record<string, unknown>, merge?: boolean): Promise<void>;
}

let auditSeq = 0;

function auditLogId(at: string, collection: string, docId: string): string {
  auditSeq += 1;
  return `${at}_${collection}_${docId}_${auditSeq}`.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function auditEntry(
  collection: string,
  docId: string,
  action: 'create' | 'update',
  stamp: { by: string; byRole: ActorRole; at: string },
  changes?: string[],
): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: auditLogId(stamp.at, collection, docId),
    collection,
    docId,
    action,
    by: stamp.by,
    byRole: stamp.byRole,
    at: stamp.at,
    synthetic: SYNTHETIC_FLAG,
  };
  if (changes && changes.length > 0) entry.changes = changes;
  return entry;
}

/** Create a document: write it with an `audit` stamp, then log the write. */
export async function createDoc<T extends { id: string; audit: AuditStamp; synthetic: typeof SYNTHETIC_FLAG }>(
  store: AuditStore,
  collection: string,
  doc: T,
): Promise<void> {
  await store.write(collection, doc.id, doc as unknown as Record<string, unknown>);
  const entry = auditEntry(collection, doc.id, 'create', {
    by: doc.audit.createdBy,
    byRole: doc.audit.createdByRole,
    at: doc.audit.createdAt,
  });
  await store.write(COLLECTIONS.auditLog, entry.id, entry as unknown as Record<string, unknown>);
}

/**
 * Patch a document: keep the creation stamp, refresh the update stamp, log it,
 * and return the merged document so callers can render it without a re-read.
 */
export async function updateDoc<T extends { id: string; audit: AuditStamp; synthetic: typeof SYNTHETIC_FLAG }>(
  store: AuditStore,
  collection: string,
  doc: T,
  patch: Partial<T>,
  actor: Actor,
  at: string = nowIso(),
): Promise<T> {
  const previous = doc.audit;
  const merged: T = { ...doc, ...patch, audit: touchAudit(previous, actor, at) };
  await store.write(collection, merged.id, merged as unknown as Record<string, unknown>, true);
  const entry = auditEntry(
    collection,
    merged.id,
    'update',
    { by: actor.id, byRole: actor.role as Role, at },
    Object.keys(patch),
  );
  await store.write(COLLECTIONS.auditLog, entry.id, entry as unknown as Record<string, unknown>);
  return merged;
}
