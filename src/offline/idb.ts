/**
 * MaaSetu — tiny IndexedDB store for offline data.
 *
 * Two object stores:
 *  - `kv`     cached snapshots (workspace, profile, notifications)
 *  - `outbox` changes made on this device that still have to reach the server
 *
 * Everything degrades to an in-memory map when IndexedDB is unavailable
 * (private browsing, old WebViews), so the app keeps working for the session
 * instead of throwing.
 */

export type StoreName = 'kv' | 'outbox';

const DB_NAME = 'maasetu-offline';
const DB_VERSION = 1;
const STORES: StoreName[] = ['kv', 'outbox'];

const memory: Record<StoreName, Map<string, unknown>> = {
  kv: new Map(),
  outbox: new Map(),
};

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      console.warn('MaaSetu: IndexedDB unavailable', error);
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: name === 'kv' ? 'key' : 'id' });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn('MaaSetu: could not open IndexedDB', request.error);
      resolve(null);
    };
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
}

function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  work: (objectStore: IDBObjectStore) => IDBRequest,
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        let tx: IDBTransaction;
        try {
          tx = db.transaction(store, mode);
        } catch (error) {
          console.warn('MaaSetu: IndexedDB transaction failed', error);
          resolve(null);
          return;
        }
        const request = work(tx.objectStore(store));
        request.onsuccess = () => resolve((request.result ?? null) as T | null);
        request.onerror = () => {
          console.warn('MaaSetu: IndexedDB request failed', request.error);
          resolve(null);
        };
      }),
  );
}

/** Cached snapshots are stored as `{ key, value, savedAt }`: return the value. */
export async function idbGet<T>(key: string): Promise<T | null> {
  const record = await run<{ value?: T }>('kv', 'readonly', (store) => store.get(key));
  if (record && typeof record === 'object' && 'value' in record) {
    return (record.value ?? null) as T | null;
  }
  const fallback = memory.kv.get(key) as { value?: T } | undefined;
  return fallback?.value ?? null;
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  memory.kv.set(key, { key, value, savedAt: new Date().toISOString() });
  await run('kv', 'readwrite', (store) => store.put({ key, value, savedAt: new Date().toISOString() }));
}

export async function idbAll<T>(storeName: StoreName): Promise<T[]> {
  if (storeName === 'outbox') return idbOutboxAll<T>();
  const rows = await run<{ value?: T }[]>('kv', 'readonly', (store) => store.getAll());
  if (rows) return rows.map((row) => row.value as T);
  return [...memory.kv.values()].map((row) => (row as { value?: T }).value as T);
}

/** Outbox rows are stored whole (each one already carries its `id`). */
export async function idbPutOutbox(value: { id: string }): Promise<void> {
  memory.outbox.set(value.id, value);
  await run('outbox', 'readwrite', (store) => store.put(value));
}

export async function idbDeleteOutbox(id: string): Promise<void> {
  memory.outbox.delete(id);
  await run('outbox', 'readwrite', (store) => store.delete(id));
}

export async function idbOutboxAll<T>(): Promise<T[]> {
  const rows = await run<T[]>('outbox', 'readonly', (store) => store.getAll());
  if (rows) return rows;
  return [...memory.outbox.values()] as T[];
}

/** Drop cached snapshots (used by the demo tools "clear cache" path). */
export async function idbClearKv(): Promise<void> {
  memory.kv.clear();
  await run('kv', 'readwrite', (store) => store.clear());
}

export const idbInfo = { name: DB_NAME, version: DB_VERSION };
