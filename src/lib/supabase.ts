import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

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
