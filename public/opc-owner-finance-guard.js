(() => {
  if (window.__OPC_OWNER_FINANCE_GUARD__) return;
  window.__OPC_OWNER_FINANCE_GUARD__ = true;

  const root = document.documentElement;
  const previousVisibility = root.style.visibility;
  root.style.visibility = 'hidden';

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
      return null;
    }

    return null;
  };

  const redirect = (path) => {
    window.location.replace(path);
  };

  const token = readAccessToken();

  if (!token) {
    redirect('/');
    return;
  }

  fetch('/api/opc/access/owner', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
    },
  })
    .then((response) => {
      if (!response.ok) {
        redirect('/dashboard');
        return;
      }

      root.style.visibility = previousVisibility;
    })
    .catch(() => redirect('/dashboard'));
})();
