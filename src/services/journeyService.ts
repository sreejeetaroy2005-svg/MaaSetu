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
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
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
  village: string;
  language: Language;
  /** `YYYY-MM` as chosen in the form. */
  expectedDeliveryMonth: string;
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
    language: input.language,
    consentStatus: 'pending',
    expectedDeliveryMonth: input.expectedDeliveryMonth,
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
