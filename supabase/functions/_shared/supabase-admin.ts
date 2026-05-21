/**
 * Supabase Client Helpers
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

export function createAdminClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase admin environment variables");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createUserClient(authToken: string): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase user environment variables");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function getUserFromToken(
  authToken: string,
): Promise<{ id: string; email?: string } | null> {
  try {
    const client = createUserClient(authToken);
    const { data, error } = await client.auth.getUser();

    if (error || !data.user) return null;

    return {
      id: data.user.id,
      email: data.user.email,
    };
  } catch {
    return null;
  }
}