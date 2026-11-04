/**
 * MaaSetu — connection + queue hooks.
 *
 * Both stores are tiny external stores, so any component can read the current
 * connection and the pending changes without prop drilling.
 */
import { useSyncExternalStore } from 'react';
import { getNetworkSnapshot, subscribeNetwork } from '../offline/network';
import { getQueueSnapshot, pendingCount, syncStateFor, subscribeQueue } from '../offline/queue';
import type { NetworkSnapshot, OpKind, OpStatus, QueueSnapshot } from '../offline/types';

export function useNetwork(): NetworkSnapshot {
  return useSyncExternalStore(subscribeNetwork, getNetworkSnapshot, getNetworkSnapshot);
}

export function useQueue(): QueueSnapshot {
  return useSyncExternalStore(subscribeQueue, getQueueSnapshot, getQueueSnapshot);
}

export function usePendingCount(): number {
  return pendingCount(useQueue().ops);
}

/** "Waiting to sync" / "Synced" for one record. */
export function useRecordSyncState(match: {
  kind?: OpKind[];
  recordId?: string;
  motherId?: string;
}): OpStatus | undefined {
  const queue = useQueue();
  return syncStateFor(queue.ops, match);
}
