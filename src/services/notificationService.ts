/**
 * MaaSetu — notifications.
 *
 * Notifications are fixed, translated handover messages (no health details).
 * They are created by `handoverService` together with the handover/consent
 * change; this module only reads them and records that one was opened.
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { COLLECTIONS, type Notification } from '../data/model';
import { nowIso, updateDoc, type Actor } from './audit';
import { db, firestoreStore } from './firebase';

export async function listNotifications(userId: string): Promise<Notification[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.notifications), where('recipientUserId', '==', userId)),
  );
  return snap.docs
    .map((doc) => doc.data() as Notification)
    .sort((a, b) => b.audit.createdAt.localeCompare(a.audit.createdAt));
}

/** Mark one notification as read; the update is audit-trailed as well. */
export async function markNotificationRead(
  notification: Notification,
  actor: Actor,
): Promise<Notification> {
  if (notification.readAt) return notification;
  return updateDoc(firestoreStore, COLLECTIONS.notifications, notification, { readAt: nowIso() }, actor);
}
