import { type SupabaseClient } from '@supabase/supabase-js';
import { createOpcSupabaseAdmin } from './opc-server-env';

/**
 * Admin client with Service Role key - ONLY use server-side.
 * Never import this from browser/client components.
 *
 * Cloudflare Pages/Workers runtime:
 *   getSupabaseAdmin(Astro.locals.runtime?.env)
 *   getSupabaseAdmin(context.locals.runtime?.env)
 *
 * Local Astro dev:
 *   getSupabaseAdmin()
 */
export function getSupabaseAdmin(runtimeEnvOrLocals?: any): SupabaseClient {
  return createOpcSupabaseAdmin(runtimeEnvOrLocals);
}
