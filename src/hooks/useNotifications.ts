/**
 * MaaSetu — unread-notification count for the header bell.
 *
 * Reads the copy kept on the device (so it works offline) and counts again
 * whenever a change is queued, so marking a message read with no connection
 * drops the badge straight away instead of waiting for a sync.
 */
import { useEffect, useState } from 'react';
import { loadNotifications } from '../offline/repo';
import { useQueue } from './useOffline';

export function useUnreadNotifications(userId: string | null): number {
  const queue = useQueue();
  const [unread, setUnread] = useState(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!userId) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    loadNotifications(userId, queue.ops)
      .then((items) => {
        if (!cancelled) setUnread(items.filter((item) => !item.readAt).length);
      })
      .catch((error: unknown) => {
        console.error('MaaSetu: could not count notifications', error);
        if (!cancelled) setUnread(0);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, queue.ops, nonce]);

  // Another worker's action arrives while this phone has the app open. The
  // shell mounts once, so the count is re-read when the person comes back to
  // the app instead of staying at the number it had at sign-in.
  useEffect(() => {
    const refresh = () => setNonce((value) => value + 1);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return unread;
}
