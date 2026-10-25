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
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  COLLECTIONS,
  SYNTHETIC_FLAG,
  type ConsentLogEntry,
  type Handover,
  type Mother,
  type User,
} from '../data/model';
import { createDoc, newAudit, nowIso, updateDoc, type Actor } from './audit';
import { db, firestoreStore } from './firebase';

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

/* ------------------------------------------------------------------ reads */

export async function listAllHandovers(): Promise<Handover[]> {
  const snap = await getDocs(collection(db, COLLECTIONS.handovers));
  return snap.docs.map((d) => d.data() as Handover);
}

export async function listConsentLogs(motherId: string): Promise<ConsentLogEntry[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.consentLog), where('motherId', '==', motherId)),
  );
  return snap.docs
    .map((d) => d.data() as ConsentLogEntry)
    .sort((a, b) => (a.grantedAt ?? '').localeCompare(b.grantedAt ?? ''));
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

  return updateDoc(
    firestoreStore,
    COLLECTIONS.handovers,
    handover,
    { status: 'accepted', acceptedAt: nowIso(), acceptedBy: actor.id },
    actor,
  );
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
  const nextConsent = await updateDoc(
    firestoreStore,
    COLLECTIONS.consentLog,
    consent,
    { withdrawnAt: at, withdrawnBy: actor.id },
    actor,
    at,
  );
  const nextHandover = await updateDoc(
    firestoreStore,
    COLLECTIONS.handovers,
    handover,
    { status: 'revoked', revokedAt: at, revokedBy: actor.id },
    actor,
    at,
  );
  await updateDoc(
    firestoreStore,
    COLLECTIONS.mothers,
    mother,
    { consentStatus: 'withdrawn' },
    actor,
    at,
  );

  return { handover: nextHandover, consent: nextConsent };
}
