let cachedAccessToken: string | null = null;
let cachedAccessTokenAt = 0;

const TOKEN_CACHE_TTL_MS = 30_000;

function tokenFromStoredValue(raw: string | null): string | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);

    return (
      parsed?.access_token ||
      parsed?.currentSession?.access_token ||
      parsed?.session?.access_token ||
      null
    );
  } catch {
    return null;
  }
}

export function readOpcAccessToken(force = false): string | null {
  if (typeof window === 'undefined') return null;

  if (
    !force &&
    cachedAccessToken &&
    Date.now() - cachedAccessTokenAt < TOKEN_CACHE_TTL_MS
  ) {
    return cachedAccessToken;
  }

  try {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (const key of Object.keys(storage)) {
        if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;

        const token = tokenFromStoredValue(storage.getItem(key));

        if (token) {
          cachedAccessToken = token;
          cachedAccessTokenAt = Date.now();
          return token;
        }
      }
    }
  } catch {
    // The caller handles a missing token.
  }

  cachedAccessToken = null;
  cachedAccessTokenAt = Date.now();
  return null;
}

export function clearOpcAccessTokenCache() {
  cachedAccessToken = null;
  cachedAccessTokenAt = 0;
}
