import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

// OPC_SUPABASE_REST_DEDUPE_V1
// Several React islands/components can ask for the same read during one paint.
// Reuse the exact GET instead of opening duplicate Supabase REST connections.
type OpcRestSnapshot = {
  at: number;
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
  body: ArrayBuffer;
};

const OPC_REST_DEDUPE_WINDOW_MS = 15_000;
const opcRestInFlight = new Map<string, Promise<Response>>();
const opcRestRecent = new Map<string, OpcRestSnapshot>();

const OPC_AUTH_COOKIE_SYNC_KEY = 'opc:auth-cookie-sync-at:v1';
const OPC_AUTH_COOKIE_SYNC_INTERVAL_MS = 5 * 60_000;
const OPC_AUTH_PROFILE_REFRESH_KEY = 'opc:auth-profile-refresh-at:v1';
const OPC_JOB_ACCESS_CACHE_KEY = '__opc_jobs_access_response_session_v3__';
const OPC_AUTH_CACHE_KEYS = [
  'opc:auth-profile-cache:v5:persistent',
  'opc:auth-profile-cache:v4:persistent',
  'opc:auth-profile-cache:v3',
  'opc:auth-profile-cache:v2',
  'opc:auth-profile-cache',
];

let opcAuthLifecycleInstalled = false;
let opcAuthCookieSyncInFlight: Promise<boolean> | null = null;

function responseFromOpcSnapshot(snapshot: OpcRestSnapshot) {
  return new Response(snapshot.body.slice(0), {
    status: snapshot.status,
    statusText: snapshot.statusText,
    headers: snapshot.headers,
  });
}

async function opcDedupedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let request: Request;

  try {
    request = input instanceof Request
      ? new Request(input, init)
      : new Request(input, init);
  } catch {
    return globalThis.fetch(input, init);
  }

  const url = new URL(request.url);
  const isSupabaseRestRead =
    request.method === 'GET' &&
    url.pathname.includes('/rest/v1/');

  if (!isSupabaseRestRead) {
    if (
      request.method !== 'GET' &&
      url.pathname.includes('/rest/v1/')
    ) {
      opcRestRecent.clear();
    }

    return globalThis.fetch(request);
  }

  const key = [
    request.method,
    request.url,
    request.headers.get('authorization') || '',
    request.headers.get('apikey') || '',
  ].join('::');

  const cached = opcRestRecent.get(key);
  if (
    cached &&
    Date.now() - cached.at < OPC_REST_DEDUPE_WINDOW_MS
  ) {
    return responseFromOpcSnapshot(cached);
  }

  const existing = opcRestInFlight.get(key);
  if (existing) {
    return (await existing).clone();
  }

  const requestPromise = globalThis.fetch(request);
  opcRestInFlight.set(key, requestPromise);

  try {
    const response = await requestPromise;
    const contentType = response.headers.get('content-type') || '';

    if (
      response.ok &&
      contentType.toLowerCase().includes('application/json')
    ) {
      try {
        const body = await response.clone().arrayBuffer();
        const headers: Array<[string, string]> = [];
        response.headers.forEach((value, name) => {
          headers.push([name, value]);
        });

        opcRestRecent.set(key, {
          at: Date.now(),
          status: response.status,
          statusText: response.statusText,
          headers,
          body,
        });

        if (opcRestRecent.size > 100) {
          const oldestKey = opcRestRecent.keys().next().value;
          if (oldestKey) opcRestRecent.delete(oldestKey);
        }
      } catch {
        // A normal uncached response is still returned.
      }
    }

    return response.clone();
  } finally {
    opcRestInFlight.delete(key);
  }
}

function setLegacySessionKeys(session: Session) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem('mco_logged_out');
    window.sessionStorage.removeItem('mco_logged_out');
    window.localStorage.setItem('opc_auth_token', session.access_token);
    window.localStorage.setItem('opc_user_id', session.user.id);
    window.localStorage.setItem('opc_user_email', session.user.email || '');
  } catch {
    // Legacy compatibility storage must never block authentication.
  }
}

function clearOpcBrowserAuthState() {
  if (typeof window === 'undefined') return;

  try {
    for (const key of OPC_AUTH_CACHE_KEYS) {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    }

    window.localStorage.removeItem(OPC_AUTH_COOKIE_SYNC_KEY);
    window.localStorage.removeItem(OPC_AUTH_PROFILE_REFRESH_KEY);
    window.sessionStorage.removeItem(OPC_JOB_ACCESS_CACHE_KEY);

    window.localStorage.removeItem('mco_auth');
    window.localStorage.removeItem('mco_auth_token');
    window.localStorage.removeItem('mco_user_role');
    window.localStorage.removeItem('mco_user_data');
    window.localStorage.removeItem('opc_auth_token');
    window.localStorage.removeItem('opc_access');
    window.localStorage.removeItem('opc_user_id');
    window.localStorage.removeItem('opc_user_email');

    window.sessionStorage.removeItem('mco_auth_target');
    window.sessionStorage.removeItem('mco_auth_ready');

    // This marker prevents old compatibility caches from reopening the app
    // while the SDK has no session. A successful sign-in removes it again.
    window.localStorage.setItem('mco_logged_out', 'true');
    window.sessionStorage.setItem('mco_logged_out', 'true');
  } catch {
    // A storage failure must not prevent Supabase from signing out.
  }
}

async function clearOpcServerSession() {
  if (typeof window === 'undefined') return false;

  try {
    const response = await globalThis.fetch('/api/auth/set-session', {
      method: 'DELETE',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function syncOpcServerSession(session: Session, force = false) {
  if (typeof window === 'undefined') return false;

  setLegacySessionKeys(session);

  if (!force) {
    try {
      const lastSync = Number(window.localStorage.getItem(OPC_AUTH_COOKIE_SYNC_KEY) || 0);
      if (
        Number.isFinite(lastSync) &&
        lastSync > 0 &&
        Date.now() - lastSync < OPC_AUTH_COOKIE_SYNC_INTERVAL_MS
      ) {
        return true;
      }
    } catch {
      // Continue with a real sync.
    }
  }

  if (opcAuthCookieSyncInFlight) return opcAuthCookieSyncInFlight;

  opcAuthCookieSyncInFlight = (async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);

    try {
      const response = await globalThis.fetch('/api/auth/set-session', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        }),
        signal: controller.signal,
      });

      if (response.ok) {
        try {
          window.localStorage.setItem(OPC_AUTH_COOKIE_SYNC_KEY, String(Date.now()));
        } catch {
          // The cookie itself is authoritative; timestamp storage is optional.
        }
      }

      return response.ok;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timeout);
    }
  })().finally(() => {
    opcAuthCookieSyncInFlight = null;
  });

  return opcAuthCookieSyncInFlight;
}

function installOpcAuthLifecycle(client: SupabaseClient) {
  if (typeof window === 'undefined' || opcAuthLifecycleInstalled) return;
  opcAuthLifecycleInstalled = true;

  client.auth.onAuthStateChange((event, session) => {
    // Supabase recommends avoiding awaited SDK work directly inside the auth
    // callback. Schedule the bridge work on the next task instead.
    window.setTimeout(() => {
      if (event === 'SIGNED_OUT' || !session) {
        if (event === 'SIGNED_OUT') {
          clearOpcBrowserAuthState();
          void clearOpcServerSession();
        }
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        void syncOpcServerSession(session, true);
      }
    }, 0);
  });

  // Repair the server cookie when the app opens with a persisted browser
  // session. This closes the half-authenticated state after browser restarts.
  void client.auth.getSession().then(({ data }) => {
    if (data.session) void syncOpcServerSession(data.session, true);
  });

  window.addEventListener('online', () => {
    void client.auth.getSession().then(({ data }) => {
      if (data.session) void syncOpcServerSession(data.session, true);
    });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;

    void client.auth.getSession().then(({ data }) => {
      if (data.session) void syncOpcServerSession(data.session, false);
    });
  });
}

export function getSupabase(runtimeEnv?: Record<string, string>) {
  if (_client) return _client;

  const url =
    runtimeEnv?.PUBLIC_SUPABASE_URL ??
    import.meta.env.PUBLIC_SUPABASE_URL;

  const anon =
    runtimeEnv?.PUBLIC_SUPABASE_ANON_KEY ??
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error('Supabase env vars missing');
  }

  _client = createClient(url, anon, {
    global: { fetch: opcDedupedFetch },
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  });

  installOpcAuthLifecycle(_client);
  return _client;
}

/**
 * Browser-only convenience export.
 * Do not use in SSR / API / middleware.
 */
export const supabase =
  typeof window !== 'undefined'
    ? getSupabase()
    : (null as never);

export type UserRole = 'owner' | 'admin' | 'dispatch' | 'employee' | 'client';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  company?: string;
  phone?: string;
  avatar_url?: string;
  opc_staff_role_id?: string | null;
  employee_id?: string | null;
  can_manage_jobs?: boolean;
  can_view_all_jobs?: boolean;
  can_manage_calendar?: boolean;
  created_at: string;
  updated_at: string;
}

export async function getUserProfile(userId: string, runtimeEnv?: Record<string, string>): Promise<UserProfile | null> {
  try {
    const client = getSupabase(runtimeEnv);
    const { data, error } = await client
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    return data as UserProfile;
  } catch (error) {
    console.error('Failed to get user profile:', error);
    return null;
  }
}

export async function getCurrentUser(runtimeEnv?: Record<string, string>) {
  try {
    const client = getSupabase(runtimeEnv);
    const { data: { user }, error } = await client.auth.getUser();

    if (error || !user) {
      return { user: null, profile: null };
    }

    const profile = await getUserProfile(user.id, runtimeEnv);
    return { user, profile };
  } catch (error) {
    console.error('Failed to get current user:', error);
    return { user: null, profile: null };
  }
}

export function getDashboardRoute(role: UserRole): string {
  switch (role) {
    case 'owner':
    case 'admin':
    case 'dispatch':
    case 'client':
    case 'employee':
      return '/dashboard';
    default:
      return '/';
  }
}
