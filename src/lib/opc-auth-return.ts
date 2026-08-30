const OPC_AUTH_RETURN_KEY = 'opc:auth-return-to:v1';
const MAX_AGE_MS = 18 * 60 * 60 * 1000;

type ReturnTarget = {
  href: string;
  at: number;
};

function browser() {
  return typeof window !== 'undefined';
}

function normalizeInternalHref(value: string): string | null {
  if (!browser()) return null;

  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return null;

    if (
      url.pathname === '/' ||
      url.pathname === '/login' ||
      url.pathname === '/logout' ||
      url.pathname === '/forgot-password' ||
      url.pathname === '/reset-password' ||
      url.pathname === '/set-password' ||
      url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/_astro/')
    ) {
      return null;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function rememberOpcAuthReturnTarget(href?: string) {
  if (!browser()) return;

  const candidate =
    href ||
    `${window.location.pathname}${window.location.search}${window.location.hash}`;

  const normalized = normalizeInternalHref(candidate);
  if (!normalized) return;

  try {
    window.sessionStorage.setItem(
      OPC_AUTH_RETURN_KEY,
      JSON.stringify({ href: normalized, at: Date.now() }),
    );
  } catch {
    // Dashboard remains the fallback.
  }
}

export function peekOpcAuthReturnTarget(): string | null {
  if (!browser()) return null;

  try {
    const raw = window.sessionStorage.getItem(OPC_AUTH_RETURN_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ReturnTarget;

    if (
      !parsed ||
      typeof parsed.href !== 'string' ||
      typeof parsed.at !== 'number' ||
      Date.now() - parsed.at > MAX_AGE_MS
    ) {
      clearOpcAuthReturnTarget();
      return null;
    }

    const normalized = normalizeInternalHref(parsed.href);
    if (!normalized) {
      clearOpcAuthReturnTarget();
      return null;
    }

    return normalized;
  } catch {
    clearOpcAuthReturnTarget();
    return null;
  }
}

export function consumeOpcAuthReturnTarget(): string | null {
  const target = peekOpcAuthReturnTarget();
  clearOpcAuthReturnTarget();
  return target;
}

export function clearOpcAuthReturnTarget() {
  if (!browser()) return;

  try {
    window.sessionStorage.removeItem(OPC_AUTH_RETURN_KEY);
  } catch {
    // Logout continues.
  }
}
