/**
 * MaaSetu — handover domain rules.
 *
 * Everything about "where is this mother right now, who cares for her and who
 * may see her card" is derived here from the handover + consent records, so
 * every screen shows the same answer. Pure functions only; nothing is stored
 * twice and nothing is inferred about her health.
 */
import type { ConsentLogEntry, Handover, Mother, User } from './model';

export type MotherStatusKind = 'atHome' | 'movingPending' | 'moved' | 'consentWithdrawn';

export interface MotherStatus {
  kind: MotherStatusKind;
  /** Village she is actually in right now. */
  currentVillageId: string;
  /** Worker who currently cares for her. */
  currentWorkerId: string;
  /** The most recent handover for her, if any. */
  handover: Handover | null;
}

/** Most recent handover for a mother (by creation time). */
export function latestHandover(handovers: Handover[], motherId: string): Handover | null {
  const mine = handovers
    .filter((h) => h.motherId === motherId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return mine[0] ?? null;
}

/**
 * The mother's status at any moment:
 *  - atHome            → with her home village worker
 *  - movingPending     → still home, waiting for the receiving worker to accept
 *  - moved             → accepted, she is with the receiving village
 *  - consentWithdrawn  → she revoked consent and is back home
 */
export function motherStatus(mother: Mother, handovers: Handover[]): MotherStatus {
  const handover = latestHandover(handovers, mother.id);

  if (!handover) {
    return {
      kind: 'atHome',
      currentVillageId: mother.village,
      currentWorkerId: mother.registeredBy,
      handover: null,
    };
  }

  if (handover.status === 'accepted') {
    return {
      kind: 'moved',
      currentVillageId: handover.toVillage,
      // The worker who accepted, or the named receiver if it was accepted
      // on her behalf by another worker in the same village.
      currentWorkerId: handover.acceptedBy ?? handover.toWorkerId,
      handover,
    };
  }

  if (handover.status === 'pending') {
    return {
      kind: 'movingPending',
      currentVillageId: handover.fromVillage,
      currentWorkerId: handover.fromWorkerId,
      handover,
    };
  }

  return {
    kind: 'consentWithdrawn',
    currentVillageId: handover.fromVillage,
    currentWorkerId: handover.fromWorkerId || mother.registeredBy,
    handover,
  };
}

/** True while a handover is pending or accepted (consent in force). */
export function hasActiveHandover(status: MotherStatus): boolean {
  return status.kind === 'movingPending' || status.kind === 'moved';
}

export type MotherAccess = 'edit' | 'read' | 'blocked';

/**
 * Who may open this mother's card, and whether they may write to it.
 *
 *  - a worker in her home village: full access, read-only once she has moved
 *  - a worker in the receiving village: blocked before a handover exists;
 *    read-only while it is pending; full access once accepted; blocked again
 *    after the consent is withdrawn
 *  - everyone else: blocked
 *
 * Consent is recorded for a village (plus the named receiving worker as the
 * contact), so the receiving village's team shares the accepted card.
 */
export function accessFor(
  worker: User | null,
  mother: Mother,
  handovers: Handover[],
): MotherAccess {
  if (!worker) return 'blocked';

  const status = motherStatus(mother, handovers);
  const handover = status.handover;

  if (worker.village === mother.village) {
    return handover?.status === 'accepted' ? 'read' : 'edit';
  }

  if (handover && handover.toVillage === worker.village) {
    if (handover.status === 'pending') return 'read';
    if (handover.status === 'accepted') return 'edit';
    return 'blocked';
  }

  return 'blocked';
}

/** Village shown on the status badge (destination while moving / moved). */
export function statusVillageId(status: MotherStatus): string {
  if ((status.kind === 'movingPending' || status.kind === 'moved') && status.handover) {
    return status.handover.toVillage;
  }
  return status.currentVillageId;
}

export interface ActivityEvent {
  id: string;
  at: string;
  kind: 'requested' | 'consent' | 'accepted' | 'withdrawn';
  byId: string | null;
  villageId: string | null;
}

/**
 * Timeline of what happened for a mother, newest first, built only from the
 * stored handover + consent records (no generated text about her health).
 */
export function buildActivity(
  handovers: Handover[],
  consents: ConsentLogEntry[],
): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const handover of handovers) {
    events.push({
      id: `${handover.id}-requested`,
      at: handover.createdAt,
      kind: 'requested',
      byId: handover.fromWorkerId,
      villageId: handover.toVillage,
    });
    if (handover.acceptedAt) {
      events.push({
        id: `${handover.id}-accepted`,
        at: handover.acceptedAt,
        kind: 'accepted',
        byId: handover.acceptedBy,
        villageId: handover.toVillage,
      });
    }
  }

  for (const consent of consents) {
    if (consent.grantedAt) {
      events.push({
        id: `${consent.id}-granted`,
        at: consent.grantedAt,
        kind: 'consent',
        byId: consent.recordedBy ?? consent.grantedBy,
        villageId: null,
      });
    }
    if (consent.withdrawnAt) {
      events.push({
        id: `${consent.id}-withdrawn`,
        at: consent.withdrawnAt,
        kind: 'withdrawn',
        byId: consent.withdrawnBy,
        villageId: null,
      });
    }
  }

  return events.sort((a, b) => b.at.localeCompare(a.at));
}
