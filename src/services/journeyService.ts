/**
 * MaaSetu — journey-card data access.
 *
 * Reads use the client Firestore SDK. Every write goes through the
 * audit-trailed helpers in `services/audit.ts`, so each change carries who/when
 * on the document and appends an entry to `auditLog`.
 *
 * There is deliberately NO delete function here: milestones and visit entries
 * are never removed from this app. Visits can be corrected, and the earlier
 * version is kept in `visit.revisions`.
 */
import { collection, doc, getDoc, getDocs, limit, query, setDoc, where } from 'firebase/firestore';
import {
  milestonesFromTemplate,
  withMilestoneDueDate,
  withMilestoneStatus,
} from '../data/journey';
import {
  COLLECTIONS,
  SYNTHETIC_FLAG,
  type JourneyCard,
  type Language,
  type MilestoneStatus,
  type Mother,
  type Role,
  type User,
  type Village,
  type Visit,
  type VisitRevision,
} from '../data/model';
import { createDoc, newAudit, nowIso, updateDoc, type Actor } from './audit';
import { db, firestoreStore } from './firebase';

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function byName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------------ reads */

export async function listWorkersByRole(role: Role): Promise<User[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.users), where('role', '==', role)),
  );
  return byName(snap.docs.map((d) => d.data() as User));
}

export async function listAllUsers(): Promise<User[]> {
  const snap = await getDocs(collection(db, COLLECTIONS.users));
  return byName(snap.docs.map((d) => d.data() as User));
}

export async function listVillages(): Promise<Village[]> {
  const snap = await getDocs(collection(db, COLLECTIONS.villages));
  return byName(snap.docs.map((d) => d.data() as Village));
}

export async function fetchVillage(id: string): Promise<Village | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.villages, id));
  return snap.exists() ? (snap.data() as Village) : null;
}

export async function listMothersInVillage(villageId: string): Promise<Mother[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.mothers), where('village', '==', villageId)),
  );
  return byName(snap.docs.map((d) => d.data() as Mother));
}

export async function listAllMothers(): Promise<Mother[]> {
  const snap = await getDocs(collection(db, COLLECTIONS.mothers));
  return byName(snap.docs.map((d) => d.data() as Mother));
}

export async function fetchMother(motherId: string): Promise<Mother | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.mothers, motherId));
  return snap.exists() ? (snap.data() as Mother) : null;
}

/** Prototype scale (a few dozen cards): read once and index by mother. */
export async function listJourneyCards(): Promise<JourneyCard[]> {
  const snap = await getDocs(collection(db, COLLECTIONS.journeyCards));
  return snap.docs.map((d) => d.data() as JourneyCard);
}

export async function fetchJourneyCard(motherId: string): Promise<JourneyCard | null> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.journeyCards),
      where('motherId', '==', motherId),
      limit(1),
    ),
  );
  const first = snap.docs[0];
  return first ? (first.data() as JourneyCard) : null;
}

/* ----------------------------------------------------------------- writes */

export interface RegisterMotherInput {
  name: string;
  /** E.164 phone number she will sign in with (synthetic in this prototype). */
  phone: string;
  village: string;
  language: Language;
  /** `YYYY-MM` as chosen in the form. */
  expectedDeliveryMonth: string;
}

/** A phone number can only belong to one person in the demo dataset. */
export async function phoneAlreadyUsed(phone: string): Promise<boolean> {
  const [workers, mothers] = await Promise.all([
    getDocs(query(collection(db, COLLECTIONS.users), where('phone', '==', phone), limit(1))),
    getDocs(query(collection(db, COLLECTIONS.mothers), where('phone', '==', phone), limit(1))),
  ]);
  return workers.size > 0 || mothers.size > 0;
}

export interface RegisterWorkerInput {
  name: string;
  role: 'asha' | 'anm';
  village: string;
  phone: string;
  language: Language;
}

/** Create a worker account. Sign-in itself is phone-OTP, handled by authService. */
export async function registerWorker(
  input: RegisterWorkerInput,
  actor: Actor,
): Promise<User> {
  const at = nowIso();
  const worker: User = {
    id: newId('usr'),
    name: input.name.trim(),
    role: input.role,
    village: input.village,
    phone: input.phone,
    language: input.language,
    synthetic: SYNTHETIC_FLAG,
    audit: newAudit(actor, at),
  };
  await createDoc(firestoreStore, COLLECTIONS.users, worker);
  return worker;
}

/**
 * Register a mother and create her journey card from the fixed template.
 * Consent status starts as `pending` — the consent flow is a later step.
 */
export async function registerMother(
  input: RegisterMotherInput,
  actor: Actor,
): Promise<{ mother: Mother; card: JourneyCard }> {
  const at = nowIso();
  const mother: Mother = {
    id: newId('mtr'),
    name: input.name.trim(),
    village: input.village,
    registeredBy: actor.id,
    phone: input.phone,
    language: input.language,
    consentStatus: 'pending',
    expectedDeliveryMonth: input.expectedDeliveryMonth,
    currentHandoverId: null,
    synthetic: SYNTHETIC_FLAG,
    audit: newAudit(actor, at),
  };
  const card: JourneyCard = {
    id: newId('jrn'),
    motherId: mother.id,
    milestones: milestonesFromTemplate(),
    visits: [],
    synthetic: SYNTHETIC_FLAG,
    audit: newAudit(actor, at),
  };

  await createDoc(firestoreStore, COLLECTIONS.mothers, mother);
  await createDoc(firestoreStore, COLLECTIONS.journeyCards, card);
  return { mother, card };
}

/** Record a milestone status change (and its date when marked done). */
export async function saveMilestoneStatus(
  card: JourneyCard,
  templateId: string,
  status: MilestoneStatus,
  doneDate: string | null,
  actor: Actor,
): Promise<JourneyCard> {
  const milestones = withMilestoneStatus(card.milestones, templateId, status, doneDate);
  return updateDoc(firestoreStore, COLLECTIONS.journeyCards, card, { milestones }, actor);
}

/** Record the due date for one milestone. No date is ever calculated here. */
export async function saveMilestoneDueDate(
  card: JourneyCard,
  templateId: string,
  dueDate: string | null,
  actor: Actor,
): Promise<JourneyCard> {
  const milestones = withMilestoneDueDate(card.milestones, templateId, dueDate);
  return updateDoc(firestoreStore, COLLECTIONS.journeyCards, card, { milestones }, actor);
}

export interface VisitInput {
  date: string;
  note: string;
}

/** Append a visit to the log. */
export async function addVisit(
  card: JourneyCard,
  input: VisitInput,
  actor: Actor,
): Promise<JourneyCard> {
  const visit: Visit = {
    id: newId('vst'),
    date: input.date,
    enteredBy: actor.id,
    enteredAt: nowIso(),
    note: input.note.trim(),
    revisions: [],
  };
  return updateDoc(
    firestoreStore,
    COLLECTIONS.journeyCards,
    card,
    { visits: [...card.visits, visit] },
    actor,
  );
}

/**
 * Correct a visit. The previous date and note are pushed into `revisions`, so
 * the earlier version stays visible in the log's history.
 */
export async function editVisit(
  card: JourneyCard,
  visitId: string,
  input: VisitInput,
  actor: Actor,
): Promise<JourneyCard> {
  const target = card.visits.find((v) => v.id === visitId);
  if (!target) throw new Error(`Visit ${visitId} not found`);

  const revision: VisitRevision = {
    date: target.date,
    note: target.note,
    editedBy: actor.id,
    editedAt: nowIso(),
  };
  const visits = card.visits.map((visit) =>
    visit.id === visitId
      ? { ...visit, date: input.date, note: input.note.trim(), revisions: [...visit.revisions, revision] }
      : visit,
  );
  return updateDoc(firestoreStore, COLLECTIONS.journeyCards, card, { visits }, actor);
}

/**
 * Writes synthetic seed data (villages, users, mothers, journey cards) to Firestore.
 * Safe to press twice — uses getDoc + exists check before each write.
 */
export async function loadDemoData(): Promise<void> {
  const at = nowIso();

  // Villages (idempotent: setDoc on existing doc is a no-op)
  await setDoc(doc(collection(db, 'villages'), 'ammapur'), {
    name: 'Ammapur',
    ashaPhone: '+919999990001',
    anmPhone: '+919999990004',
  });
  await setDoc(doc(collection(db, 'villages'), 'devgaon'), {
    name: 'Devgaon',
    ashaPhone: '+919999990003',
    anmPhone: '+919999990101',
  });

  // Users (workers)
  const usersRef = collection(db, 'users');
  await setDoc(doc(usersRef, 'usr_asha_meena'), {
    name: 'Meena Waghmare',
    role: 'asha',
    village: 'ammapur',
    phone: '+919999990001',
    language: 'en',
  });
  await setDoc(doc(usersRef, 'usr_anm_rekha'), {
    name: 'Rekha Yadav',
    role: 'anm',
    village: 'devgaon',
    phone: '+919999990004',
    language: 'en',
  });

  // Mothers
  const mothersRef = collection(db, 'mothers');
  await setDoc(doc(mothersRef, 'mtr_pooja_rathor'), {
    name: 'Pooja Rathor',
    village: 'ammapur',
    registeredBy: 'usr_asha_meena',
    phone: '+919999990002',
    language: 'en',
    consentStatus: 'pending',
    expectedDeliveryMonth: '2026-11',
    currentHandoverId: null,
    synthetic: 'synthetic-prototype-v1',
    audit: { createdBy: 'system', createdByRole: 'system', createdAt: at },
  });
  await setDoc(doc(mothersRef, 'mtr_savitri_pawar'), {
    name: 'Savitri Pawar',
    village: 'ammapur',
    registeredBy: 'usr_asha_meena',
    phone: '+919999990101',
    language: 'en',
    consentStatus: 'pending',
    expectedDeliveryMonth: '2026-11',
    currentHandoverId: null,
    synthetic: 'synthetic-prototype-v1',
    audit: { createdBy: 'system', createdByRole: 'system', createdAt: at },
  });

  // Journey cards (template-based)
  const cardsRef = collection(db, 'journeyCards');
  await setDoc(doc(cardsRef, 'card_pooja_delivery'), {
    motherId: 'mtr_pooja_rathor',
    currentMilestone: 'delivery',
    done: false,
    notes: [],
    synthetic: 'synthetic-prototype-v1',
    audit: { createdBy: 'system', createdByRole: 'system', createdAt: at },
  });
  await setDoc(doc(cardsRef, 'card_savitri_delivery'), {
    motherId: 'mtr_savitri_pawar',
    currentMilestone: 'delivery',
    done: false,
    notes: [],
    synthetic: 'synthetic-prototype-v1',
    audit: { createdBy: 'system', createdByRole: 'system', createdAt: at },
  });
}
