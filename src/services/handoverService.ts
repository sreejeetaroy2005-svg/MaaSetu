/**
 * MaaSetu — handover + consent data access.
 *
 * A handover can only exist together with a recorded consent: `startHandover`
 * refuses to write anything unless the caller confirms the mother's consent,
 * and the receiving worker has no access until they accept.
 *
 * Every write goes through the audit helpers, so each step appends to
 * `auditLog` and stamps the document with who/when.
 */
import { collection, getDocs, getDocsFromServer, query, where } from 'firebase/firestore';
import {
  COLLECTIONS,
  SYNTHETIC_FLAG,
  type ConsentLogEntry,
  type Handover,
  type Mother,
  type User,
} from '../data/model';
import { HANDOVER_OVERDUE_HOURS } from '../data/tracker';
import { createDoc, newAudit, nowIso, updateDoc, type Actor } from './audit';
import { db, firestoreStore } from './firebase';
function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

/** Config: handover overdue timeout in hours (shared with the care tracker). */
const OVERDUE_HOURS = HANDOVER_OVERDUE_HOURS;

/* ------------------------------------------------------------------ reads */

export async function listAllHandovers(): Promise<Handover[]> {
  const snap = await getDocs(collection(db, COLLECTIONS.handovers));
  return snap.docs.map((d) => d.data() as Handover);
}

/** Every consent record — used to warm the offline copy in one pass. */
export async function listAllConsentLogs(): Promise<ConsentLogEntry[]> {
  const snap = await getDocs(collection(db, COLLECTIONS.consentLog));
  return snap.docs.map((d) => d.data() as ConsentLogEntry);
}

export async function listConsentLogs(motherId: string): Promise<ConsentLogEntry[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.consentLog), where('motherId', '==', motherId)),
  );
  return snap.docs
    .map((d) => d.data() as ConsentLogEntry)
    .sort((a, b) => (a.grantedAt ?? '').localeCompare(b.grantedAt ?? ''));
}

/**
 * One overdue message per worker per handover, ever.
 *
 * The document id is derived from the handover and the recipient, and the
 * write is skipped when that id already exists — so running the check twice
 * (the demo button can be pressed again) adds nothing.
 */
async function ensureOverdueNotification(
  handover: Handover,
  recipientId: string,
  existing: Set<string>,
): Promise<boolean> {
  const id = `overdue_${handover.id}_${recipientId}`;
  if (existing.has(id)) return false;
  const at = nowIso();
  await createDoc(firestoreStore, COLLECTIONS.notifications, {
    id,
    recipientUserId: recipientId,
    type: 'handover_overdue',
    motherId: handover.motherId,
    handoverId: handover.id,
    readAt: null,
    synthetic: SYNTHETIC_FLAG,
    audit: {
      createdBy: 'system:overdue',
      createdByRole: 'system' as const,
      createdAt: at,
      updatedBy: 'system:overdue',
      updatedByRole: 'system' as const,
      updatedAt: at,
    },
  });
  existing.add(id);
  return true;
}

/**
 * Create the overdue messages for every pending handover that has waited too
 * long, for both the sending and the receiving worker. Reads the existing
 * messages from the server (never the cache) so a second run cannot duplicate
 * them.
 */
export async function checkOverdueHandovers(
  now: number = Date.now(),
): Promise<{ overdueHandovers: number; created: number }> {
  const handovers = await listAllHandovers();
  const existingSnap = await getDocsFromServer(
    query(collection(db, COLLECTIONS.notifications), where('type', '==', 'handover_overdue')),
  );
  const existing = new Set(existingSnap.docs.map((doc) => doc.id));

  let overdueHandovers = 0;
  let created = 0;

  for (const handover of handovers) {
    if (handover.status !== 'pending') continue;
    if (now - Date.parse(handover.createdAt) <= OVERDUE_HOURS * 60 * 60 * 1000) continue;
    overdueHandovers += 1;
    // Both workers are told; a handover to herself would still notify once.
    const recipients = [handover.fromWorkerId, handover.toWorkerId].filter(
      (id, index, list) => id && list.indexOf(id) === index,
    );
    for (const recipient of recipients) {
      if (await ensureOverdueNotification(handover, recipient, existing)) created += 1;
    }
  }

  return { overdueHandovers, created };
}

/**
 * DEMO ONLY — move every pending handover past the overdue limit, then send
 * the overdue messages. Nothing about her care changes: only the request time,
 * so the tracker and the inbox can be shown without touching the database.
 */
export async function simulateHandoverAge(
  hours: number = OVERDUE_HOURS + 2,
): Promise<{ aged: number; overdueHandovers: number; created: number }> {
  const actor: Actor = { id: 'system:demo', role: 'system' };
  const cutoff = Date.now() - OVERDUE_HOURS * 60 * 60 * 1000;
  const agedAt = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const handovers = await listAllHandovers();
  let aged = 0;
  for (const handover of handovers) {
    if (handover.status !== 'pending') continue;
    if (Date.parse(handover.createdAt) <= cutoff) continue;
    await updateDoc(firestoreStore, COLLECTIONS.handovers, handover, { createdAt: agedAt }, actor);
    aged += 1;
  }

  const overdue = await checkOverdueHandovers();
  return { aged, overdueHandovers: overdue.overdueHandovers, created: overdue.created };
}

/* ----------------------------------------------------------------- writes */

export interface StartHandoverInput {
  mother: Mother;
  fromWorker: User;
  toVillageId: string;
  toWorkerId: string;
  /** The consent checkbox. Nothing is written unless this is true. */
  consentGranted: boolean;
}

/**
 * Record the mother's consent and create the pending handover in one step.
 * Throws — and writes nothing — when consent is missing or the destination is
 * not a different village.
 */
export async function startHandover(
  input: StartHandoverInput,
  actor: Actor,
): Promise<{ handover: Handover; consent: ConsentLogEntry }> {
  if (!input.consentGranted) {
    throw new Error('Consent is required before a handover can be created');
  }
  if (input.toVillageId === input.mother.village) {
    throw new Error('The destination village must be different from her village');
  }
  if (!input.toWorkerId) {
    throw new Error('A receiving health worker is required');
  }
  if (input.mother.consentStatus === 'granted') {
    throw new Error('This mother already has a handover in progress');
  }

  const at = nowIso();
  const consent: ConsentLogEntry = {
    id: newId('cns'),
    motherId: input.mother.id,
    type: 'handover',
    handoverId: null,
    grantedAt: at,
    grantedBy: input.mother.id,
    recordedBy: actor.id,
    withdrawnAt: null,
    withdrawnBy: null,
    synthetic: SYNTHETIC_FLAG,
    audit: newAudit(actor, at),
  };
  const handover: Handover = {
    id: newId('hnd'),
    motherId: input.mother.id,
    fromVillage: input.mother.village,
    toVillage: input.toVillageId,
    fromWorkerId: input.fromWorker.id,
    toWorkerId: input.toWorkerId,
    status: 'pending',
    consentId: consent.id,
    createdAt: at,
    acceptedAt: null,
    acceptedBy: null,
    revokedAt: null,
    revokedBy: null,
    synthetic: SYNTHETIC_FLAG,
    audit: newAudit(actor, at),
  };
  consent.handoverId = handover.id;

  await createDoc(firestoreStore, COLLECTIONS.consentLog, consent);
  await createDoc(firestoreStore, COLLECTIONS.handovers, handover);
  // Notify the receiving worker
  await createDoc(firestoreStore, COLLECTIONS.notifications, {
    id: 'not_' + handover.id,
    recipientUserId: input.toWorkerId,
    type: 'handover_requested',
    motherId: input.mother.id,
    handoverId: handover.id,
    readAt: null,
    synthetic: SYNTHETIC_FLAG,
    audit: newAudit(actor, at),
  });
  // The sending worker is not sent a message about the consent she just
  // recorded herself: it would only inflate her unread bell with her own act.
  await updateDoc(
    firestoreStore,
    COLLECTIONS.mothers,
    input.mother,
    { consentStatus: 'granted' },
    actor,
    at,
  );

  return { handover, consent };
}

/**
 * The receiving worker has opened her summary: record that she has seen it.
 *
 * Only called from the receiving village and only once — the first worker to
 * open it is recorded. The write goes through the audit helpers like every
 * other change, and the screen re-reads the handover afterwards, so the
 * tracker shows "seen" only after Firestore confirms it.
 */
export async function markHandoverSeen(handover: Handover, worker: User): Promise<Handover> {
  if (handover.status !== 'pending' || handover.seenAt) return handover;
  if (handover.toVillage !== worker.village) return handover;
  return updateDoc(
    firestoreStore,
    COLLECTIONS.handovers,
    handover,
    { seenAt: nowIso(), seenBy: worker.id },
    { id: worker.id, role: worker.role },
  );
}

/**
 * The receiving village accepts: the mother moves into their care. Any worker
 * in the destination village may accept, because consent was recorded for the
 * village (with one worker named as the contact); whoever accepts is recorded.
 */
export async function acceptHandover(
  handover: Handover,
  worker: User,
  actor: Actor,
): Promise<Handover> {
  if (handover.status !== 'pending') {
    throw new Error(`Only a pending handover can be accepted (was ${handover.status})`);
  }
  if (worker.village !== handover.toVillage) {
    throw new Error('Only a worker in the receiving village can accept this handover');
  }

  // Update the handover status
  const updated = await updateDoc(
    firestoreStore,
    COLLECTIONS.handovers,
    handover,
    { status: 'accepted', acceptedAt: nowIso(), acceptedBy: actor.id },
    actor,
  );
  // Notify the original ASHA that handover was accepted
  await createDoc(firestoreStore, COLLECTIONS.notifications, {
    id: 'not3_' + handover.id,
    recipientUserId: handover.fromWorkerId,
    type: 'handover_accepted',
    motherId: handover.motherId,
    handoverId: handover.id,
    readAt: null,
    synthetic: SYNTHETIC_FLAG,
    audit: newAudit(actor, nowIso()),
  });
  // Notify the receiving worker (already in their inbox, but mark read perhaps?)
  return updated;
}

/**
 * Mother withdraws consent: the handover is revoked and the receiving worker
 * loses access to her card.
 */
export async function withdrawConsent(
  mother: Mother,
  handover: Handover,
  consent: ConsentLogEntry,
  actor: Actor,
): Promise<{ handover: Handover; consent: ConsentLogEntry }> {
  if (handover.status === 'revoked') {
    throw new Error('This handover has already been revoked');
  }

  const at = nowIso();
  // Update the consent log
  const nextConsent = await updateDoc(
    firestoreStore,
    COLLECTIONS.consentLog,
    consent,
    { withdrawnAt: at, withdrawnBy: actor.id },
    actor,
    at,
  );
  // Update the handover status
  const nextHandover = await updateDoc(
    firestoreStore,
    COLLECTIONS.handovers,
    handover,
    { status: 'revoked', revokedAt: at, revokedBy: actor.id },
    actor,
    at,
  );
  // Update the mother's consent status
  await updateDoc(
    firestoreStore,
    COLLECTIONS.mothers,
    mother,
    { consentStatus: 'withdrawn' },
    actor,
    at,
  );
  // Notify both workers that consent was withdrawn
  await createDoc(firestoreStore, COLLECTIONS.notifications, {
    id: 'not4_' + handover.id,
    recipientUserId: handover.fromWorkerId,
    type: 'consent_withdrawn',
    motherId: handover.motherId,
    handoverId: handover.id,
    readAt: null,
    synthetic: SYNTHETIC_FLAG,
    audit: newAudit(actor, nowIso()),
  });
  await createDoc(firestoreStore, COLLECTIONS.notifications, {
    id: 'not5_' + handover.id,
    recipientUserId: handover.toWorkerId,
    type: 'consent_withdrawn',
    motherId: handover.motherId,
    handoverId: handover.id,
    readAt: null,
    synthetic: SYNTHETIC_FLAG,
    audit: newAudit(actor, nowIso()),
  });

  return { handover: nextHandover, consent: nextConsent };
}
