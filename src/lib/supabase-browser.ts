import { createClient } from '@supabase/supabase-js';

/**
 * Returns a new Supabase client using public env variables.
 */
export function getSupabaseClient() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY must be provided');
  }
  return createClient(url, anonKey);
}
