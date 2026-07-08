import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

const OPC_REST_DEDUPE_WINDOW_MS = 1200;
const opcRestInFlight = new Map<string, Promise<Response>>();
const opcRestRecent = new Map<string, OpcRestSnapshot>();

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
    }
  });
  
  return _client;
}

/**
 * ⚠️ Browser-only convenience export
 * Do NOT use in SSR / API / middleware
 */
export const supabase =
  typeof window !== 'undefined'
    ? getSupabase()
    : (null as never);

// Type definitions and utilities
export type UserRole = 'owner' | 'admin' | 'dispatch' | 'employee' | 'client';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  company?: string;
  phone?: string;
  avatar_url?: string;
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
      return '/dashboard';
    case 'employee':
      return '/dashboard';
    default:
      return '/';
  }
}
