/**
 * Server-side Supabase utilities for API routes.
 * Use these in API routes to access the authenticated user session.
 */

import { createClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';

/**
 * Create a Supabase client for server-side use with the user session from
 * cookies. Never log token values or token fragments.
 */
export function createServerSupabaseClient(cookies: AstroCookies, runtimeEnv?: Record<string, string>) {
  const url = runtimeEnv?.PUBLIC_SUPABASE_URL ?? import.meta.env.PUBLIC_SUPABASE_URL;
  const anon = runtimeEnv?.PUBLIC_SUPABASE_ANON_KEY ?? import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    console.error('[Supabase Server] Missing Supabase environment configuration.');
    throw new Error('Supabase env vars missing');
  }

  const accessToken = cookies.get('sb-access-token')?.value;

  return createClient(url, anon, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : {},
    },
  });
}

/**
 * Get the current user session from cookies.
 * Returns null if not authenticated.
 */
export async function getServerSession(cookies: AstroCookies, runtimeEnv?: Record<string, string>) {
  try {
    const client = createServerSupabaseClient(cookies, runtimeEnv);
    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (error || !user) {
      if (error) {
        console.warn('[Supabase Server] Session validation failed:', error.message);
      }
      return null;
    }

    return {
      user,
      access_token: cookies.get('sb-access-token')?.value,
    };
  } catch (error) {
    console.error(
      '[Supabase Server] Session lookup failed:',
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Check if the current request is authenticated.
 * Returns user if authenticated, null otherwise.
 */
export async function requireAuth(cookies: AstroCookies, runtimeEnv?: Record<string, string>) {
  const session = await getServerSession(cookies, runtimeEnv);
  return session?.user || null;
}
