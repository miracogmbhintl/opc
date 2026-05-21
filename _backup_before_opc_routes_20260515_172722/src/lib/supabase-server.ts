/**
 * Server-side Supabase utilities for API routes
 * Use these in API routes to access authenticated user session
 */

import { createClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';

/**
 * Create a Supabase client for server-side use with user session from cookies
 */
export function createServerSupabaseClient(cookies: AstroCookies, runtimeEnv?: Record<string, string>) {
  const url = runtimeEnv?.PUBLIC_SUPABASE_URL ?? import.meta.env.PUBLIC_SUPABASE_URL;
  const anon = runtimeEnv?.PUBLIC_SUPABASE_ANON_KEY ?? import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  console.log('[Supabase Server] Creating client...');
  console.log('[Supabase Server] URL present:', !!url);
  console.log('[Supabase Server] Anon key present:', !!anon);

  if (!url || !anon) {
    console.error('[Supabase Server] ❌ Missing env vars');
    throw new Error('Supabase env vars missing');
  }

  // Get auth tokens from cookies
  const accessToken = cookies.get('sb-access-token')?.value;
  const refreshToken = cookies.get('sb-refresh-token')?.value;

  console.log('[Supabase Server] Access token from cookie:', accessToken ? `present (${accessToken.substring(0, 20)}...)` : 'MISSING');
  console.log('[Supabase Server] Refresh token from cookie:', refreshToken ? 'present' : 'MISSING');

  // Create client with session if available
  const client = createClient(url, anon, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    global: {
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`
          }
        : {}
    }
  });

  console.log('[Supabase Server] ✅ Client created with auth:', !!accessToken);

  return client;
}

/**
 * Get the current user session from cookies
 * Returns null if not authenticated
 */
export async function getServerSession(cookies: AstroCookies, runtimeEnv?: Record<string, string>) {
  try {
    console.log('[Supabase Server] Getting session from cookies...');
    
    const client = createServerSupabaseClient(cookies, runtimeEnv);
    
    // Try to get the current user using the access token
    const { data: { user }, error } = await client.auth.getUser();
    
    if (error) {
      console.error('[Supabase Server] ❌ Error getting user:', error.message);
      return null;
    }
    
    if (!user) {
      console.log('[Supabase Server] ❌ No user found');
      return null;
    }

    console.log('[Supabase Server] ✅ User authenticated:', user.id);
    
    return {
      user,
      access_token: cookies.get('sb-access-token')?.value
    };
  } catch (error) {
    console.error('[Supabase Server] ❌ Error getting session:', error);
    return null;
  }
}

/**
 * Check if the current request is authenticated
 * Returns user if authenticated, null otherwise
 */
export async function requireAuth(cookies: AstroCookies, runtimeEnv?: Record<string, string>) {
  console.log('[Supabase Server] requireAuth called');
  const session = await getServerSession(cookies, runtimeEnv);
  
  if (!session?.user) {
    console.log('[Supabase Server] ❌ requireAuth: Not authenticated');
    return null;
  }
  
  console.log('[Supabase Server] ✅ requireAuth: User authenticated:', session.user.id);
  return session.user;
}

