import { createClient, SupabaseClient } from '@supabase/supabase-js';

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  // Guard: Only run in browser
  if (typeof window === 'undefined') {
    throw new Error('getSupabaseClient() can only be called in browser context. Use getSupabase() for SSR.');
  }

  if (clientInstance) {
    return clientInstance;
  }

  // In browser, these are embedded at build time as string literals
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    
    throw new Error(
      'Supabase configuration missing. Please ensure PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are set.'
    );
  }

  // Validate URL format
  try {
    new URL(supabaseUrl);
  } catch (e) {
    throw new Error('Invalid Supabase URL format');
  }
  
  clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    }
  });
  
  return clientInstance;
}

// Export singleton instance with lazy initialization
// This is safe because it only evaluates when accessed in browser
export const supabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    return client[prop as keyof SupabaseClient];
  }
});
