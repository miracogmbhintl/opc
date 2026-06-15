import type { SupabaseClient } from '@supabase/supabase-js';

type JsonRecord = Record<string, any>;

export type OpcOfflineMutation = {
  id: string;
  createdAt: string;
  attempts: number;
  lastError?: string | null;
  operation: 'insert' | 'update' | 'delete';
  table: string;
  payload?: JsonRecord | null;
  variants?: JsonRecord[] | null;
  idColumn?: string | null;
  idValue?: string | null;
  meta?: JsonRecord | null;
};

const QUEUE_KEY = 'opc:offline-action-queue:v1';
const MAX_ATTEMPTS = 12;
const DEBUG_PREFIX = '[OPC Offline Queue]';

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function isOfflineNow() {
  if (typeof navigator === 'undefined') return false;
  return navigator.onLine === false;
}


export function createOfflineUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // RFC4122-ish fallback for old mobile browsers.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function createOfflineId(prefix = 'offline') {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${prefix}-${random}`;
}

export function isProbablyNetworkError(error: unknown) {
  if (isOfflineNow()) return true;

  const message = String(
    (error as any)?.message ||
      (error as any)?.error_description ||
      (error as any)?.details ||
      (error as any)?.hint ||
      error ||
      '',
  ).toLowerCase();

  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('fetch failed') ||
    message.includes('load failed') ||
    message.includes('the internet connection appears to be offline') ||
    message.includes('offline') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('connection')
  );
}

function readQueueUnsafe(): OpcOfflineMutation[] {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item) => item && typeof item === 'object' && item.id && item.operation && item.table);
  } catch {
    return [];
  }
}

function writeQueueUnsafe(queue: OpcOfflineMutation[]) {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(
      new CustomEvent('opc-offline-queue-changed', {
        detail: { count: queue.length },
      }),
    );
  } catch (error) {
    console.warn(`${DEBUG_PREFIX} could not write queue`, error);
  }
}

export function getOpcOfflineQueue() {
  return readQueueUnsafe();
}

export function getOpcOfflineQueueCount() {
  return readQueueUnsafe().length;
}

export function clearOpcOfflineQueue() {
  writeQueueUnsafe([]);
}

export function enqueueOpcOfflineMutation(input: Omit<OpcOfflineMutation, 'id' | 'createdAt' | 'attempts'> & { id?: string }) {
  const now = new Date().toISOString();
  const mutation: OpcOfflineMutation = {
    id: input.id || createOfflineId('mutation'),
    createdAt: now,
    attempts: 0,
    lastError: null,
    operation: input.operation,
    table: input.table,
    payload: input.payload || null,
    variants: input.variants || null,
    idColumn: input.idColumn || null,
    idValue: input.idValue || null,
    meta: input.meta || null,
  };

  const queue = readQueueUnsafe();
  queue.push(mutation);
  writeQueueUnsafe(queue);
  return mutation;
}

function compactPayload(payload: JsonRecord | null | undefined) {
  const clean: JsonRecord = {};

  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value !== undefined) clean[key] = value;
  });

  return clean;
}

async function insertWithVariants(client: SupabaseClient, mutation: OpcOfflineMutation) {
  const variants = mutation.variants?.length ? mutation.variants : mutation.payload ? [mutation.payload] : [];
  let lastError: any = null;

  for (const variant of variants) {
    const payload = compactPayload(variant);

    try {
      const response = await client.from(mutation.table).insert(payload).select('*').limit(1);

      if (!response.error) return;

      const message = String(response.error.message || '').toLowerCase();
      const isDuplicate =
        message.includes('duplicate key') ||
        message.includes('already exists') ||
        (response.error as any).code === '23505';

      if (isDuplicate) return;

      lastError = response.error;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`${mutation.table}: queued insert failed`);
}

async function updateById(client: SupabaseClient, mutation: OpcOfflineMutation) {
  if (!mutation.idColumn || !mutation.idValue) {
    throw new Error(`${mutation.table}: queued update is missing idColumn/idValue`);
  }

  const payload = compactPayload(mutation.payload || {});
  const response = await client
    .from(mutation.table)
    .update(payload)
    .eq(mutation.idColumn, mutation.idValue)
    .select('*')
    .limit(1);

  if (response.error) throw response.error;

  if (!Array.isArray(response.data) || response.data.length === 0) {
    throw new Error(`${mutation.table}: queued update found no row (${mutation.idColumn}=${mutation.idValue})`);
  }
}

async function deleteById(client: SupabaseClient, mutation: OpcOfflineMutation) {
  if (!mutation.idColumn || !mutation.idValue) {
    throw new Error(`${mutation.table}: queued delete is missing idColumn/idValue`);
  }

  const response = await client.from(mutation.table).delete().eq(mutation.idColumn, mutation.idValue);
  if (response.error) throw response.error;
}

async function runMutation(client: SupabaseClient, mutation: OpcOfflineMutation) {
  if (mutation.operation === 'insert') {
    await insertWithVariants(client, mutation);
    return;
  }

  if (mutation.operation === 'update') {
    await updateById(client, mutation);
    return;
  }

  if (mutation.operation === 'delete') {
    await deleteById(client, mutation);
    return;
  }

  throw new Error(`Unsupported offline mutation operation: ${mutation.operation}`);
}

export async function syncOpcOfflineActionQueue(client: SupabaseClient) {
  if (!isBrowser()) return { synced: 0, remaining: 0 };
  if (isOfflineNow()) return { synced: 0, remaining: getOpcOfflineQueueCount() };

  const queue = readQueueUnsafe();
  if (!queue.length) return { synced: 0, remaining: 0 };

  const remaining: OpcOfflineMutation[] = [];
  let synced = 0;

  for (const mutation of queue) {
    try {
      await runMutation(client, mutation);
      synced += 1;
    } catch (error) {
      const message = String((error as any)?.message || error || 'Synchronisierung fehlgeschlagen.');

      if (isProbablyNetworkError(error)) {
        remaining.push({
          ...mutation,
          attempts: mutation.attempts + 1,
          lastError: message,
        });
        continue;
      }

      const nextAttempts = mutation.attempts + 1;
      if (nextAttempts < MAX_ATTEMPTS) {
        remaining.push({
          ...mutation,
          attempts: nextAttempts,
          lastError: message,
        });
      } else {
        console.error(`${DEBUG_PREFIX} dropping mutation after max attempts`, mutation, error);
      }
    }
  }

  writeQueueUnsafe(remaining);
  return { synced, remaining: remaining.length };
}

export function installOpcOfflineQueueAutoSync(client: SupabaseClient, onChange?: (count: number) => void) {
  if (!isBrowser()) return () => undefined;

  let syncing = false;

  const runSync = async () => {
    if (syncing || isOfflineNow()) {
      onChange?.(getOpcOfflineQueueCount());
      return;
    }

    syncing = true;
    try {
      await syncOpcOfflineActionQueue(client);
    } finally {
      syncing = false;
      onChange?.(getOpcOfflineQueueCount());
    }
  };

  const handleOnline = () => void runSync();
  const handleStorage = () => onChange?.(getOpcOfflineQueueCount());
  const handleQueueChange = () => onChange?.(getOpcOfflineQueueCount());

  window.addEventListener('online', handleOnline);
  window.addEventListener('storage', handleStorage);
  window.addEventListener('opc-offline-queue-changed', handleQueueChange as EventListener);

  const interval = window.setInterval(() => {
    void runSync();
  }, 30000);

  void runSync();

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('opc-offline-queue-changed', handleQueueChange as EventListener);
    window.clearInterval(interval);
  };
}
