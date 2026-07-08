(() => {
  if (window.__OPC_CALENDAR_FETCH_BRIDGE__) return;
  window.__OPC_CALENDAR_FETCH_BRIDGE__ = true;

  // OPC_CALENDAR_EXPLICIT_SYNC_ONLY_V1
  // Database writes no longer trigger hidden follow-up calendar requests.
  // The application calls the canonical sync endpoint exactly once per action.
  const nativeFetch = window.fetch.bind(window);

  const readAccessToken = () => {
    try {
      for (const storage of [window.localStorage, window.sessionStorage]) {
        for (const key of Object.keys(storage)) {
          if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;

          const raw = storage.getItem(key);
          if (!raw) continue;

          const parsed = JSON.parse(raw);
          const token =
            parsed?.access_token ||
            parsed?.currentSession?.access_token ||
            parsed?.session?.access_token ||
            null;

          if (token) return token;
        }
      }
    } catch {
      // The explicit caller will handle a missing session.
    }

    return null;
  };

  window.fetch = (input, init = {}) => {
    const inputRequest = input instanceof Request ? input : null;
    const requestUrl = inputRequest ? inputRequest.url : String(input);
    const url = new URL(requestUrl, window.location.origin);

    if (
      url.origin !== window.location.origin ||
      url.pathname !== '/api/opc/calendar/sync-job-assignment'
    ) {
      return nativeFetch(input, init);
    }

    const headers = new Headers(init.headers || inputRequest?.headers || undefined);
    const token = readAccessToken();

    if (token && !headers.has('authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return nativeFetch(input, {
      ...init,
      headers,
    });
  };
})();
