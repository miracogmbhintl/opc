type SafeNavigateOptions = {
  replace?: boolean;
  throttleMs?: number;
};

type LastNavigation = {
  href: string;
  at: number;
};

const MEMORY_KEY = '__opc_last_navigation__';

let memoryLastNavigation: LastNavigation = {
  href: '',
  at: 0,
};

function normalizeTargetHref(href: string): {
  href: string;
  sameOrigin: boolean;
} {
  if (typeof window === 'undefined') {
    return {
      href,
      sameOrigin: true,
    };
  }

  const targetUrl = new URL(href, window.location.origin);
  const sameOrigin = targetUrl.origin === window.location.origin;

  return {
    href: sameOrigin
      ? `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`
      : targetUrl.href,
    sameOrigin,
  };
}

function readLastNavigation(): LastNavigation {
  if (typeof window === 'undefined') return memoryLastNavigation;

  try {
    const raw = window.sessionStorage.getItem(MEMORY_KEY);
    if (!raw) return memoryLastNavigation;

    const parsed = JSON.parse(raw) as LastNavigation;

    if (!parsed || typeof parsed.href !== 'string' || typeof parsed.at !== 'number') {
      return memoryLastNavigation;
    }

    return parsed;
  } catch {
    return memoryLastNavigation;
  }
}

function writeLastNavigation(next: LastNavigation) {
  memoryLastNavigation = next;

  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(MEMORY_KEY, JSON.stringify(next));
  } catch {
    // Navigation still works without sessionStorage.
  }
}

export function isSameBrowserRoute(href: string): boolean {
  if (typeof window === 'undefined') return false;

  const target = normalizeTargetHref(href);
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  return target.sameOrigin && target.href === current;
}

export function safeNavigate(href: string, options: SafeNavigateOptions = {}) {
  if (typeof window === 'undefined') return;
  if (!href || typeof href !== 'string') return;

  const throttleMs = options.throttleMs ?? 900;
  const target = normalizeTargetHref(href);
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (target.sameOrigin && target.href === current) {
    return;
  }

  const now = Date.now();
  const last = readLastNavigation();

  if (last.href === target.href && now - last.at < throttleMs) {
    return;
  }

  writeLastNavigation({
    href: target.href,
    at: now,
  });

  if (options.replace) {
    window.location.replace(target.href);
    return;
  }

  window.location.assign(target.href);
}
