(() => {
  if (window.__OPC_MANAGER_JOB_BRIDGE__) return;
  window.__OPC_MANAGER_JOB_BRIDGE__ = true;

  const originalFetch = window.fetch.bind(window);
  const managedTables = new Set([
    'opc_job_detail_view',
    'opc_my_portal_job_feed',
    'opc_service_jobs',
    'opc_jobs',
    'opc_job_assignments',
    'opc_job_time_logs',
    'opc_job_media',
    'opc_job_damage_reports',
    'opc_job_reports',
    'opc_reports',
  ]);

  let accessPromise = null;
  let isManager = false;
  let selectedAll = false;

  function tokenFromStorage() {
    try {
      for (const key of Object.keys(localStorage)) {
        if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
        const value = JSON.parse(localStorage.getItem(key) || '{}');
        const token = value.access_token || value.currentSession?.access_token || value.session?.access_token;
        if (token) return token;
      }
    } catch {}
    return '';
  }

  function bearer(headers) {
    return String(headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || tokenFromStorage();
  }

  function managerRole(role) {
    return ['owner', 'admin', 'dispatch'].includes(String(role || '').toLowerCase());
  }

  async function access(token) {
    if (!accessPromise) {
      accessPromise = originalFetch('/api/opc/jobs/access', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      }).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Access check failed');
        isManager = data.canManageJobs === true && data.canViewAllJobs === true && managerRole(data.role);
        chooseAllJobs();
        return data;
      }).catch((error) => {
        accessPromise = null;
        throw error;
      });
    }
    return accessPromise;
  }

  function syntheticResponse(data, headers) {
    const row = {
      id: data.primaryStaffRoleId || data.userId,
      user_id: data.userId,
      employee_id: data.employeeIds?.[0] || null,
      email: data.email,
      display_name: data.displayName,
      role: data.role,
      opc_staff_role: data.role,
      staff_role: data.role,
      status: 'active',
      can_access_portal: true,
      can_manage_jobs: data.canManageJobs,
      can_view_all_jobs: data.canViewAllJobs,
      can_view_assigned_jobs: data.canViewAssignedJobs,
      is_owner: data.role === 'owner',
      is_admin: data.role === 'admin',
    };
    const objectMode = String(headers.get('accept') || '').includes('application/vnd.pgrst.object+json');
    return new Response(JSON.stringify(objectMode ? row : [row]), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/1' },
    });
  }

  async function proxy(input, init, url, method, headers, token) {
    let body;
    if (method !== 'GET' && method !== 'HEAD') {
      body = input instanceof Request ? await input.clone().text() : init.body;
    }
    const forwarded = new Headers({ Authorization: `Bearer ${token}` });
    for (const name of ['accept', 'content-type', 'prefer', 'range', 'range-unit']) {
      const value = headers.get(name);
      if (value) forwarded.set(name, value);
    }
    return originalFetch(`/api/opc/jobs/manager-proxy?target=${encodeURIComponent(url.pathname + url.search)}`, {
      method,
      cache: 'no-store',
      headers: forwarded,
      body,
    });
  }

  function chooseAllJobs() {
    if (!isManager || selectedAll || !location.pathname.includes('/einsaetze')) return;
    requestAnimationFrame(() => {
      const buttons = document.querySelectorAll('.opc-jobs-date-buttons button');
      const all = Array.from(buttons).find((button) => button.textContent?.trim() === 'Alle');
      if (!all) return;
      selectedAll = true;
      if (!all.classList.contains('active')) all.click();
    });
  }

  new MutationObserver(chooseAllJobs).observe(document.documentElement, { childList: true, subtree: true });

  window.fetch = async (input, init = {}) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request ? request.url : String(input), location.origin);
    const method = String(init.method || request?.method || 'GET').toUpperCase();
    const headers = new Headers(init.headers || request?.headers || undefined);

    if (!url.pathname.includes('/rest/v1/')) return originalFetch(input, init);

    const table = url.pathname.split('/rest/v1/')[1]?.split('/')[0] || '';
    const select = String(url.searchParams.get('select') || '');
    const token = bearer(headers);
    if (!token) return originalFetch(input, init);

    const roleQuery = method === 'GET' && (
      (table === 'user_profiles' && select.includes('role')) ||
      (table === 'opc_staff_roles' && (select.includes('can_manage_jobs') || select.includes('can_view_all_jobs')))
    );

    if (roleQuery) {
      try { return syntheticResponse(await access(token), headers); }
      catch { return originalFetch(input, init); }
    }

    if (!managedTables.has(table)) return originalFetch(input, init);

    try {
      const response = await proxy(input, init, url, method, headers, token);
      if (response.status === 401 || response.status === 403) return originalFetch(input, init);
      return response;
    } catch {
      return originalFetch(input, init);
    }
  };

  const initialToken = tokenFromStorage();
  if (initialToken) access(initialToken).catch(() => {});
})();
