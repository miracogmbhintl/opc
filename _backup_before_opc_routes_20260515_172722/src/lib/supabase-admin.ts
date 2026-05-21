import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _adminClient: SupabaseClient | null = null;

/**
 * Admin client with Service Role key - ONLY use server-side
 * NEVER expose this to the client
 * 
 * IMPORTANT: In Cloudflare Workers, ALWAYS pass runtimeEnv:
 *   getSupabaseAdmin(Astro.locals.runtime?.env)
 *   getSupabaseAdmin(context.locals.runtime?.env)
 */
export function getSupabaseAdmin(runtimeEnv?: Record<string, string>): SupabaseClient {
  // Don't cache in Workers - always create fresh when env is passed
  if (runtimeEnv) {
    const url = runtimeEnv.PUBLIC_SUPABASE_URL;
    const serviceRole = 
      runtimeEnv.SUPABASE_SERVICE_ROLE_KEY || 
      runtimeEnv.SUPABASE_SERVICE_ROLE;

    if (!url || !serviceRole) {
      throw new Error('Supabase admin credentials missing from runtime env');
    }

    return createClient(url, serviceRole, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  // Use cached instance for local dev
  if (_adminClient) return _adminClient;

  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const serviceRole = 
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY || 
    import.meta.env.SUPABASE_SERVICE_ROLE;

  if (!url || !serviceRole) {
    throw new Error('Supabase admin credentials missing');
  }

  _adminClient = createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return _adminClient;
}
