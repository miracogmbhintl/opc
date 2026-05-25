type CacheRecord<T> = {
  savedAt: number;
  data: T;
};

const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;

export function readOpcPageCache<T>(key: string, maxAgeMs = DEFAULT_MAX_AGE_MS): T | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheRecord<T>;

    if (!parsed || typeof parsed.savedAt !== 'number') return null;

    const isExpired = Date.now() - parsed.savedAt > maxAgeMs;
    if (isExpired) return null;

    return parsed.data;
  } catch {
    return null;
  }
}

export function writeOpcPageCache<T>(key: string, data: T) {
  if (typeof window === 'undefined') return;

  try {
    const payload: CacheRecord<T> = {
      savedAt: Date.now(),
      data,
    };

    window.sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage errors.
  }
}

export function removeOpcPageCache(key: string) {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage errors.
  }
}
