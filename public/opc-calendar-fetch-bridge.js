(() => {
  if (window.__OPC_CALENDAR_FETCH_BRIDGE__) return;
  window.__OPC_CALENDAR_FETCH_BRIDGE__ = true;

  const nativeFetch = window.fetch.bind(window);

  const readAccessToken = () => {
    try {
      for (const key of Object.keys(window.localStorage)) {
        if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;

        const raw = window.localStorage.getItem(key);
        if (!raw) continue;

        const parsed = JSON.parse(raw);
        const token =
          parsed?.access_token ||
          parsed?.currentSession?.access_token ||
          parsed?.session?.access_token ||
          null;

        if (token) return token;
      }
    } catch {
      // Authentication handling remains with the normal application flow.
    }

    return null;
  };

  const extractJobIdFromFilter = (value) => {
    const text = String(value || '');
    return text.startsWith('eq.') ? text.slice(3) : null;
  };

  const syncJob = (jobId, token) => {
    if (!jobId || !token) return;

    void nativeFetch('/api/opc/calendar/sync-job-assignment', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ job_id: jobId }),
    }).catch(() => undefined);
  };

  window.fetch = async (input, init = {}) => {
    const inputRequest = input instanceof Request ? input : null;
    const requestUrl = inputRequest ? inputRequest.url : String(input);
    const url = new URL(requestUrl, window.location.origin);
    const method = String(init.method || inputRequest?.method || 'GET').toUpperCase();
    const headers = new Headers(init.headers || inputRequest?.headers || undefined);
    const token =
      String(headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim() ||
      readAccessToken();

    const isCalendarSync =
      url.origin === window.location.origin &&
      url.pathname === '/api/opc/calendar/sync-job-assignment';

    if (isCalendarSync && token && !headers.has('authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const nextInit = {
      ...init,
      headers,
    };
    const response = await nativeFetch(input, nextInit);

    if (!response.ok || !token) return response;

    const isSupabaseRest = url.pathname.includes('/rest/v1/');
    if (!isSupabaseRest) return response;

    let jobId = null;

    if (url.pathname.endsWith('/opc_service_jobs') && ['PATCH', 'PUT'].includes(method)) {
      jobId = extractJobIdFromFilter(url.searchParams.get('id'));
    }

    if (url.pathname.endsWith('/opc_job_assignments') && method === 'POST') {
      try {
        const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
        const first = Array.isArray(body) ? body[0] : body;
        jobId = first?.job_id || null;
      } catch {
        // The regular assignment flow also calls the explicit sync endpoint.
      }
    }

    if (url.pathname.endsWith('/opc_job_assignments') && ['DELETE', 'PATCH'].includes(method)) {
      jobId = extractJobIdFromFilter(url.searchParams.get('job_id')) || jobId;
    }

    if (jobId) syncJob(String(jobId), token);

    return response;
  };
})();
