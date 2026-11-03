/**
 * MaaSetu — live unread-notification count for the header bell.
 *
 * Listens to the signed-in worker's notifications only, so the badge always
 * matches what is in her inbox (and disappears as soon as she reads them).
 */
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { COLLECTIONS, type Notification } from '../data/model';
import { db } from '../services/firebase';

export function useUnreadNotifications(userId: string | null): number {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!userId) {
      setUnread(0);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.notifications),
      where('recipientUserId', '==', userId),
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const count = snap.docs.filter(
          (doc) => (doc.data() as Notification).readAt === null,
        ).length;
        setUnread(count);
      },
      (error) => {
        console.error('MaaSetu: could not watch notifications', error);
        setUnread(0);
      },
    );

    return unsubscribe;
  }, [userId]);

  return unread;
}
