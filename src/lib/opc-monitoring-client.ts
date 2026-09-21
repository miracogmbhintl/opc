import { readCachedOpcAuthProfile } from './opc-auth-cache';
import { readOpcAccessToken } from './opc-browser-session';

export type OpcMonitoringSeverity = 'critical' | 'error' | 'warning' | 'info';

export type OpcMonitoringInput = {
  severity?: OpcMonitoringSeverity;
  source?: string;
  eventType?: string;
  message: string;
  route?: string;
  stack?: string;
  context?: Record<string, unknown>;
};

declare global {
  interface Window {
    __opcMonitoringInstalled?: boolean;
  }
}

let transportFetch: typeof window.fetch | null = null;
let monitoringAuthReady = false;
const recentFingerprints = new Map<string, number>();

function clean(value: unknown, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function safeJson(value: unknown) {
  try {
    return JSON.parse(
      JSON.stringify(value, (_key, item) => {
        if (typeof item === 'string') {
          return item
            .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]')
            .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]')
            .slice(0, 4000);
        }

        if (item instanceof Error) {
          return {
            name: item.name,
            message: clean(item.message),
            stack: clean(item.stack, 12000),
          };
        }

        return item;
      }),
    );
  } catch {
    return {};
  }
}

function hashText(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `opc-${(hash >>> 0).toString(16)}`;
}

function detectBrowser() {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent || '';

  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\//i.test(ua)) return 'Opera';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/CriOS\//i.test(ua)) return 'Chrome iOS';
  if (/Chrome\//i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua) && /Version\//i.test(ua)) return 'Safari';

  return 'Browser';
}

function detectDevice() {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent || '';

  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Linux/i.test(ua)) return 'Linux';

  return 'Unknown';
}

function getLanguage() {
  if (typeof window === 'undefined') return '';

  try {
    return (
      window.localStorage.getItem('mco_language') ||
      window.localStorage.getItem('lang') ||
      navigator.language ||
      ''
    );
  } catch {
    return navigator.language || '';
  }
}

function getSessionId() {
  if (typeof window === 'undefined') return '';

  const key = 'opc:monitoring-session:v1';

  try {
    let current = window.sessionStorage.getItem(key);

    if (!current) {
      current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `opc-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      window.sessionStorage.setItem(key, current);
    }

    return current;
  } catch {
    return '';
  }
}

function normalizeRoute(value?: string) {
  if (typeof window === 'undefined') return clean(value, 500);

  if (value) {
    try {
      return new URL(value, window.location.origin).pathname;
    } catch {
      return clean(value, 500);
    }
  }

  return window.location.pathname;
}

export async function reportOpcMonitoringEvent(input: OpcMonitoringInput) {
  if (typeof window === 'undefined') return;

  const message = clean(input.message);
  if (!message) return;

  // OPC_PERFORMANCE_STAGE2_20260904
  // Monitoring is an authenticated internal endpoint. During initial boot the
  // browser can render before the Supabase access token has been restored.
  // Sending at that point only creates slow 401 requests and additional error
  // traffic. Drop pre-auth telemetry; real authenticated errors continue to
  // be reported as soon as a token exists.
  const token = readOpcAccessToken();
  if (!token || !monitoringAuthReady) return;

  const profile = readCachedOpcAuthProfile();
  const route = normalizeRoute(input.route);
  const source = clean(input.source || 'Frontend', 120);
  const eventType = clean(input.eventType || 'Runtime Error', 160);
  const fingerprint = hashText(
    [
      source.toLowerCase(),
      eventType.toLowerCase(),
      message.replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, ':id'),
      route,
    ].join('|'),
  );

  const now = Date.now();
  const previous = recentFingerprints.get(fingerprint) || 0;

  if (now - previous < 1500) return;
  recentFingerprints.set(fingerprint, now);

  const body = {
    severity: input.severity || 'error',
    source,
    eventType,
    message,
    route,
    stack: clean(input.stack, 12000),
    context: safeJson(input.context || {}),
    fingerprint,
    userLabel:
      clean((profile as any)?.display_name || (profile as any)?.full_name || (profile as any)?.email, 200),
    language: clean(getLanguage(), 40),
    browser: clean(detectBrowser(), 80),
    device: clean(detectDevice(), 80),
    userAgent: clean(navigator.userAgent, 1200),
    sessionId: clean(getSessionId(), 180),
  };

  const send = transportFetch || window.fetch.bind(window);

  try {
    await send('/api/opc/monitoring/events', {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Monitoring must never break the portal.
  }
}

function installFetchMonitor() {
  if (typeof window === 'undefined') return;

  const original = transportFetch || window.fetch.bind(window);
  transportFetch = original;

  window.fetch = (async (...args: Parameters<typeof fetch>) => {
    const startedAt = performance.now();
    const input = args[0];
    const init = args[1];

    let pathname = '';

    try {
      const raw =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      pathname = new URL(raw, window.location.origin).pathname;
    } catch {
      pathname = '';
    }

    const isMonitoringRequest = pathname === '/api/opc/monitoring/events';

    try {
      const response = await original(...args);

      // OPC_FINAL_CLEANUP_20260904
      // The access token can exist in browser storage a moment before the
      // server-side auth cookie is established. Monitoring is intentionally
      // enabled only after /api/auth/set-session succeeds, preventing the two
      // avoidable 401 telemetry requests seen during initial page boot.
      if (pathname === '/api/auth/set-session' && response.ok) {
        monitoringAuthReady = true;
      }

      if (!isMonitoringRequest && response.status >= 500) {
        void reportOpcMonitoringEvent({
          severity: response.status >= 503 ? 'critical' : 'error',
          source: 'API',
          eventType: `HTTP ${response.status}`,
          message: `${String(init?.method || 'GET').toUpperCase()} ${pathname || 'API'} returned ${response.status}`,
          route: window.location.pathname,
          context: {
            endpoint: pathname,
            method: String(init?.method || 'GET').toUpperCase(),
            status: response.status,
            durationMs: Math.round(performance.now() - startedAt),
          },
        });
      }

      return response;
    } catch (error: any) {
      if (!isMonitoringRequest) {
        void reportOpcMonitoringEvent({
          severity: 'error',
          source: 'Network',
          eventType: 'Fetch Failure',
          message: clean(error?.message || `Network request failed: ${pathname || 'unknown endpoint'}`),
          route: window.location.pathname,
          stack: clean(error?.stack, 12000),
          context: {
            endpoint: pathname,
            method: String(init?.method || 'GET').toUpperCase(),
            durationMs: Math.round(performance.now() - startedAt),
          },
        });
      }

      throw error;
    }
  }) as typeof window.fetch;
}

export function installOpcMonitoring() {
  if (typeof window === 'undefined') return;
  if (window.__opcMonitoringInstalled) return;

  window.__opcMonitoringInstalled = true;
  transportFetch = window.fetch.bind(window);

  window.addEventListener(
    'error',
    (event: ErrorEvent | Event) => {
      const errorEvent = event as ErrorEvent;

      if (errorEvent.error || errorEvent.message) {
        const error = errorEvent.error as Error | undefined;

        void reportOpcMonitoringEvent({
          severity: 'critical',
          source: 'Frontend',
          eventType: 'Runtime Crash',
          message: clean(error?.message || errorEvent.message || 'Uncaught browser error'),
          stack: clean(error?.stack, 12000),
          context: {
            filename: clean(errorEvent.filename, 800),
            line: errorEvent.lineno || null,
            column: errorEvent.colno || null,
          },
        });

        return;
      }

      const target = event.target as HTMLElement | null;
      const sourceUrl =
        target && 'src' in target
          ? clean((target as any).src, 800)
          : target && 'href' in target
            ? clean((target as any).href, 800)
            : '';

      if (sourceUrl) {
        void reportOpcMonitoringEvent({
          severity: 'warning',
          source: 'Resource',
          eventType: 'Resource Load Failure',
          message: `Resource could not be loaded: ${normalizeRoute(sourceUrl)}`,
          context: {
            tagName: target?.tagName || '',
            resource: normalizeRoute(sourceUrl),
          },
        });
      }
    },
    true,
  );

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const error = reason instanceof Error ? reason : null;

    void reportOpcMonitoringEvent({
      severity: 'critical',
      source: 'Frontend',
      eventType: 'Unhandled Promise',
      message: clean(error?.message || reason || 'Unhandled promise rejection'),
      stack: clean(error?.stack, 12000),
      context: {
        reason: safeJson(reason),
      },
    });
  });

  const originalConsoleError = console.error.bind(console);

  console.error = (...args: unknown[]) => {
    originalConsoleError(...args);

    const error = args.find((item) => item instanceof Error) as Error | undefined;
    const text = args.map((item) => (item instanceof Error ? item.message : clean(item, 1000))).join(' ');

    if (
      error ||
      /uncaught|unhandled|the above error occurred|error boundary|render error/i.test(text)
    ) {
      void reportOpcMonitoringEvent({
        severity: 'error',
        source: 'Frontend',
        eventType: 'Console Error',
        message: clean(error?.message || text || 'Frontend console error'),
        stack: clean(error?.stack, 12000),
      });
    }
  };

  installFetchMonitor();
}

if (typeof window !== 'undefined') {
  installOpcMonitoring();
}
