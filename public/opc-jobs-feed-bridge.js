(() => {
  if (window.__OPC_JOBS_FEED_BRIDGE__) return;
  window.__OPC_JOBS_FEED_BRIDGE__ = true;

  const nativeFetch = window.fetch.bind(window);
  let cachedFeedPromise = null;
  let cachedToken = '';
  let observedProfileRole = '';

  const normalizeRole = (value) => {
    const role = String(value || '').trim().toLowerCase();
    if (role === 'owner' || role === 'inhaber' || role === 'godmode') return 'owner';
    if (role === 'admin' || role === 'administrator') return 'admin';
    if (role === 'dispatch' || role === 'dispatcher' || role === 'disposition') return 'dispatch';
    if (role === 'employee' || role === 'mitarbeiter' || role === 'staff') return 'employee';
    if (role === 'client' || role === 'kunde') return 'client';
    return '';
  };

  const isManagerRole = (role) => ['owner', 'admin', 'dispatch'].includes(normalizeRole(role));

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
      // The normal application auth flow remains the fallback.
    }

    return null;
  };

  const readBearerToken = (headers) => {
    const authorization = String(headers.get('authorization') || '').trim();
    return authorization.replace(/^Bearer\s+/i, '').trim() || readAccessToken();
  };

  const responseHeaders = (length) => ({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Range': length > 0 ? `0-${length - 1}/${length}` : '*/0',
  });

  const jsonResponse = (body, status = 200) => {
    const length = Array.isArray(body) ? body.length : body ? 1 : 0;
    return new Response(JSON.stringify(body), {
      status,
      headers: responseHeaders(length),
    });
  };

  const clearFeedCache = () => {
    cachedFeedPromise = null;
    cachedToken = '';
  };

  document.addEventListener('astro:page-load', clearFeedCache);

  const fetchJsonFeed = async (path, token) => {
    const response = await nativeFetch(path, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
    const payload = await response.json().catch(() => null);
    return { response, payload };
  };

  const loadFeed = async (token) => {
    if (!token) throw new Error('Missing access token');

    if (!cachedFeedPromise || cachedToken !== token) {
      cachedToken = token;
      cachedFeedPromise = (async () => {
        const managerAttempt = await fetchJsonFeed('/api/opc/jobs/manager-feed', token);

        if (managerAttempt.response.ok) {
          return managerAttempt.payload || {};
        }

        const regularAttempt = await fetchJsonFeed('/api/opc/jobs/feed', token);

        if (!regularAttempt.response.ok) {
          throw new Error(
            regularAttempt.payload?.error ||
              managerAttempt.payload?.error ||
              'Einsätze konnten nicht geladen werden.',
          );
        }

        return regularAttempt.payload || {};
      })().catch((error) => {
        clearFeedCache();
        throw error;
      });
    }

    return cachedFeedPromise;
  };

  const rememberProfileRole = async (url, input, init) => {
    const originalResponse = await nativeFetch(input, init);

    try {
      const originalPayload = await originalResponse.clone().json();
      const originalRow = Array.isArray(originalPayload) ? originalPayload[0] : originalPayload;
      observedProfileRole = normalizeRole(
        originalRow?.role || originalRow?.opc_staff_role || originalRow?.staff_role,
      );

      if (!isManagerRole(observedProfileRole)) {
        const expandedUrl = new URL(url.toString());
        expandedUrl.searchParams.set(
          'select',
          'role,opc_staff_role,staff_role,is_admin,is_owner',
        );

        const expandedResponse = await nativeFetch(expandedUrl.toString(), init);
        if (expandedResponse.ok) {
          const expandedPayload = await expandedResponse.json().catch(() => null);
          const expandedRow = Array.isArray(expandedPayload) ? expandedPayload[0] : expandedPayload;

          if (expandedRow?.is_owner === true) observedProfileRole = 'owner';
          else if (expandedRow?.is_admin === true) observedProfileRole = 'admin';
          else {
            observedProfileRole = normalizeRole(
              expandedRow?.role || expandedRow?.opc_staff_role || expandedRow?.staff_role,
            );
          }
        }
      }
    } catch {
      // Preserve the original Supabase response when optional role enrichment fails.
    }

    return originalResponse;
  };

  window.fetch = async (input, init = {}) => {
    const inputRequest = input instanceof Request ? input : null;
    const requestUrl = inputRequest ? inputRequest.url : String(input);
    const url = new URL(requestUrl, window.location.origin);
    const method = String(init.method || inputRequest?.method || 'GET').toUpperCase();
    const headers = new Headers(init.headers || inputRequest?.headers || undefined);

    const isJobMutation =
      method !== 'GET' &&
      (url.pathname.includes('/rest/v1/opc_service_jobs') ||
        url.pathname.includes('/rest/v1/opc_job_assignments') ||
        url.pathname.endsWith('/api/opc/create-service-job'));

    if (isJobMutation) {
      const response = await nativeFetch(input, init);
      if (response.ok) clearFeedCache();
      return response;
    }

    if (method !== 'GET' || !url.pathname.includes('/rest/v1/')) {
      return nativeFetch(input, init);
    }

    const table = url.pathname.split('/rest/v1/')[1]?.split('/')[0] || '';
    const select = String(url.searchParams.get('select') || '');
    const token = readBearerToken(headers);

    const isViewerProfileQuery =
      table === 'user_profiles' &&
      select.includes('role') &&
      select.includes('opc_staff_role') &&
      select.includes('staff_role');

    if (isViewerProfileQuery) {
      return rememberProfileRole(url, input, init);
    }

    const isViewerStaffQuery =
      table === 'opc_staff_roles' &&
      select.includes('role') &&
      select.includes('can_manage_jobs') &&
      select.includes('can_view_all_jobs') &&
      !select.includes('display_name');

    const isJobsQuery = [
      'opc_job_detail_view',
      'opc_service_jobs',
      'opc_my_portal_job_feed',
    ].includes(table);

    if ((!isViewerStaffQuery && !isJobsQuery) || !token) {
      return nativeFetch(input, init);
    }

    try {
      const feed = await loadFeed(token);

      if (isViewerStaffQuery) {
        const feedRole = normalizeRole(feed.currentRole);
        const effectiveRole = isManagerRole(observedProfileRole)
          ? observedProfileRole
          : feed.canViewAllJobs === true
            ? (isManagerRole(feedRole) ? feedRole : 'dispatch')
            : feedRole || 'employee';

        return jsonResponse({
          role: effectiveRole,
          can_manage_jobs: feed.canViewAllJobs === true || isManagerRole(effectiveRole),
          can_view_all_jobs: feed.canViewAllJobs === true || isManagerRole(effectiveRole),
        });
      }

      return jsonResponse(Array.isArray(feed.jobs) ? feed.jobs : []);
    } catch {
      return nativeFetch(input, init);
    }
  };
})();
