/**
 * MaaSetu — connection status.
 *
 * Three states, not two: on a 2G village connection "online" is not a useful
 * answer. The status comes from three signals:
 *  - `navigator.onLine` (the device's own view)
 *  - a tiny probe request to this origin, measured in milliseconds
 *  - the browser's Network Information API, when it exists
 *
 * A demo toggle can pretend the phone is offline without touching Wi-Fi; it is
 * honoured here, so every screen (and the sync engine) behaves exactly as it
 * would with the radio off.
 */
import { nowIso } from '../services/audit';
import type { ConnectionStatus, NetworkSnapshot } from './types';

const SIMULATE_KEY = 'maasetu.simulate-offline';
const PROBE_URL = '/ping.txt';
const PROBE_TIMEOUT_MS = 4000;
const SLOW_MS = 1200;
const POLL_MS = 20000;

const listeners = new Set<() => void>();

let snapshot: NetworkSnapshot = {
  status: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'online',
  simulated: readSimulated(),
  latencyMs: null,
  checkedAt: null,
};

let started = false;
let pollTimer: number | null = null;

function readSimulated(): boolean {
  try {
    return localStorage.getItem(SIMULATE_KEY) === '1';
  } catch {
    return false;
  }
}

function emit(patch: Partial<NetworkSnapshot>): void {
  const next = { ...snapshot, ...patch };
  if (
    next.status === snapshot.status &&
    next.simulated === snapshot.simulated &&
    next.latencyMs === snapshot.latencyMs &&
    next.checkedAt === snapshot.checkedAt
  ) {
    return;
  }
  snapshot = next;
  for (const listener of listeners) listener();
}

export function getNetworkSnapshot(): NetworkSnapshot {
  return snapshot;
}

export function subscribeNetwork(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True when changes must be queued instead of written straight away. */
export function isOffline(): boolean {
  return snapshot.status === 'offline';
}

export function isSlow(): boolean {
  return snapshot.status === 'slow';
}

/** Demo tools: pretend the connection is gone (and drop it again). */
export function setSimulatedOffline(value: boolean): void {
  try {
    if (value) localStorage.setItem(SIMULATE_KEY, '1');
    else localStorage.removeItem(SIMULATE_KEY);
  } catch {
    /* private mode: the toggle still works for this session */
  }
  emit({ simulated: value, status: value ? 'offline' : 'online', latencyMs: null });
  if (!value) void probeConnection();
}

function effectiveTypeSlow(): boolean {
  const connection = (
    navigator as Navigator & {
      connection?: { effectiveType?: string; saveData?: boolean };
    }
  ).connection;
  if (!connection) return false;
  if (connection.saveData) return true;
  return connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g';
}

/** One probe; resolves to the new status. */
export async function probeConnection(): Promise<ConnectionStatus> {
  if (snapshot.simulated) {
    emit({ status: 'offline', latencyMs: null, checkedAt: nowIso() });
    return 'offline';
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    emit({ status: 'offline', latencyMs: null, checkedAt: nowIso() });
    return 'offline';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const startedAt = performance.now();
  try {
    await fetch(`${PROBE_URL}?probe=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    const status: ConnectionStatus = latencyMs > SLOW_MS || effectiveTypeSlow() ? 'slow' : 'online';
    emit({ status, latencyMs, checkedAt: nowIso() });
    return status;
  } catch {
    emit({ status: 'offline', latencyMs: null, checkedAt: nowIso() });
    return 'offline';
  } finally {
    clearTimeout(timer);
  }
}

/** Watch the connection for the lifetime of the app (idempotent). */
export function startNetworkWatcher(): void {
  if (started) return;
  started = true;

  const onOnline = () => {
    void probeConnection();
  };
  const onOffline = () => emit({ status: 'offline', latencyMs: null, checkedAt: nowIso() });

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void probeConnection();
  });

  pollTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void probeConnection();
  }, POLL_MS);

  void probeConnection();
}

export function stopNetworkWatcher(): void {
  if (pollTimer !== null) window.clearInterval(pollTimer);
  pollTimer = null;
  started = false;
}
