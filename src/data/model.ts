/**
 * MaaSetu — Firestore data model (TypeScript types).
 *
 * SAFETY (non-negotiable):
 *  - Assistive only: the app stores, shares (with consent), notifies and reminds.
 *  - It never diagnoses, scores risk, recommends treatment or flags a value
 *    as normal/abnormal.
 *  - Every record in this prototype is SYNTHETIC. No real patient data, ever.
 *
 * Conventions
 *  - Each document carries its own `id` (equal to its Firestore document id)
 *    so records stay self-describing when exported as JSON.
 *  - `synthetic` is set to {@link SYNTHETIC_FLAG} on every seeded record.
 *  - `audit` records who wrote the document and when (create + last update);
 *    every write must also append to the `auditLog` collection — see
 *    `src/services/audit.ts`.
 *  - Timestamps are ISO 8601 UTC strings so client SDK, Admin SDK and the
 *    emulator console all read them the same way.
 */

export const SYNTHETIC_FLAG = 'synthetic-prototype-v1' as const;

export type Role = 'asha' | 'anm' | 'mother';

export type Language = 'en' | 'hi' | 'mr';

export type ActorRole = Role | 'system';

/** Who performed a write and when. Present on every document. */
export interface AuditStamp {
  createdBy: string;
  createdByRole: ActorRole;
  createdAt: string;
  updatedBy: string;
  updatedByRole: ActorRole;
  updatedAt: string;
}

/** Common fields shared by every stored document. */
export interface AuditedDoc {
  id: string;
  synthetic: typeof SYNTHETIC_FLAG;
  audit: AuditStamp;
}

export interface Village extends AuditedDoc {
  id: string;
  name: string;
  block: string;
  district: string;
  state: string;
}

export interface User extends AuditedDoc {
  id: string;
  name: string;
  role: Role;
  village: string;
  /** E.164. Synthetic numbers only (99999900xx). */
  phone: string;
  language: Language;
}

export type ConsentStatus = 'pending' | 'granted' | 'withdrawn';

export interface Mother extends AuditedDoc {
  id: string;
  name: string;
  village: string;
  /** User id of the worker who registered her. */
  registeredBy: string;
  language: Language;
  consentStatus: ConsentStatus;
  /** `YYYY-MM` as entered at registration; displayed only, never computed. */
  expectedDeliveryMonth: string | null;
}

export type MilestoneStatus = 'upcoming' | 'done' | 'missed';

/**
 * A care-plan milestone. The label and the list come from the fixed template
 * in `src/data/journeyTemplate.ts` (PLACEHOLDER wording pending the clinical
 * lead). Nothing here is generated from the notes or interpreted at runtime.
 * `dueDate` stays null until a worker records a date; the app never computes
 * or suggests one.
 */
export interface Milestone {
  /** Id from the fixed template in `src/data/journeyTemplate.ts`. */
  templateId: string;
  /** Snapshot of the template label as stored with the record. */
  name: string;
  dueDate: string | null;
  status: MilestoneStatus;
  doneDate: string | null;
}

/** Earlier version of a visit entry, kept when a visit is corrected. */
export interface VisitRevision {
  date: string;
  note: string;
  editedBy: string;
  editedAt: string;
}

/**
 * A visit record. The log is append-only: correcting a visit keeps the earlier
 * version in `revisions`, and no part of the UI can delete an entry.
 */
export interface Visit {
  id: string;
  date: string;
  /** User id of the worker who recorded the visit. */
  enteredBy: string;
  /** When the entry was written (ISO 8601). */
  enteredAt: string;
  note: string;
  /** Empty until someone corrects the entry. */
  revisions: VisitRevision[];
}

export interface JourneyCard extends AuditedDoc {
  id: string;
  motherId: string;
  milestones: Milestone[];
  visits: Visit[];
}

/**
 * Handover lifecycle: a request is `pending` until the receiving worker
 * accepts; withdrawing consent moves it to `revoked` and removes the
 * receiving worker's access.
 */
export type HandoverStatus = 'pending' | 'accepted' | 'revoked';

export interface Handover extends AuditedDoc {
  id: string;
  motherId: string;
  fromVillage: string;
  toVillage: string;
  fromWorkerId: string;
  toWorkerId: string;
  status: HandoverStatus;
  /** The consent record this handover was created from. */
  consentId: string;
  createdAt: string;
  acceptedAt: string | null;
  acceptedBy: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
}

export type ConsentType = 'handover' | 'historyShare' | 'reminders';

/**
 * Consent record. `grantedBy` is the person consenting (the mother),
 * `recordedBy` is the worker who captured it on screen; both are kept because
 * the log must show who consented and who typed it in.
 */
export interface ConsentLogEntry extends AuditedDoc {
  id: string;
  motherId: string;
  type: ConsentType;
  /** Handover this consent belongs to (null for older/other consent types). */
  handoverId: string | null;
  /** null until the consent is granted. */
  grantedAt: string | null;
  grantedBy: string | null;
  recordedBy: string | null;
  /** null while the consent is still in force. */
  withdrawnAt: string | null;
  withdrawnBy: string | null;
}

/**
 * Append-only audit trail: one entry per write, on every collection.
 * This document is the trail, so it carries no nested audit stamp of its own.
 */
export interface AuditLogEntry {
  id: string;
  collection: string;
  docId: string;
  action: 'create' | 'update';
  by: string;
  byRole: ActorRole;
  at: string;
  /** Field names touched (updates only). */
  changes?: string[];
  synthetic: typeof SYNTHETIC_FLAG;
}

/** Firestore collection names, in one place. */
export const COLLECTIONS = {
  villages: 'villages',
  users: 'users',
  mothers: 'mothers',
  journeyCards: 'journeyCards',
  handovers: 'handovers',
  consentLog: 'consentLog',
  auditLog: 'auditLog',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
