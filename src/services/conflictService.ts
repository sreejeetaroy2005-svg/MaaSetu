/**
 * MaaSetu — conflict records.
 *
 * When a change queued on a device meets a newer version on the server, both
 * versions are kept and this record is written, so the card can show exactly
 * what happened, who wrote what and when. Nothing is overwritten silently.
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { ConflictRecord } from '../data/model';
import { COLLECTIONS } from '../data/model';
import { db } from './firebase';

export async function listConflictsForMother(motherId: string): Promise<ConflictRecord[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.conflicts), where('motherId', '==', motherId)),
  );
  return snap.docs
    .map((doc) => doc.data() as ConflictRecord)
    .sort((a, b) => b.audit.createdAt.localeCompare(a.audit.createdAt));
}

export async function listAllConflicts(): Promise<ConflictRecord[]> {
  const snap = await getDocs(collection(db, COLLECTIONS.conflicts));
  return snap.docs
    .map((doc) => doc.data() as ConflictRecord)
    .sort((a, b) => b.audit.createdAt.localeCompare(a.audit.createdAt));
}
