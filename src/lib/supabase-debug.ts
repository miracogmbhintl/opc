// Diagnostic file to check environment variables
export function checkSupabaseEnv() {
  console.log('=== SUPABASE ENV DIAGNOSTICS ===');
  console.log('1. import.meta.env object keys:', Object.keys(import.meta.env));
  console.log('2. PUBLIC_SUPABASE_URL:', import.meta.env.PUBLIC_SUPABASE_URL);
  console.log('3. PUBLIC_SUPABASE_ANON_KEY:', import.meta.env.PUBLIC_SUPABASE_ANON_KEY ? `SET (${import.meta.env.PUBLIC_SUPABASE_ANON_KEY.substring(0, 10)}...)` : 'MISSING');
  console.log('4. Process env (if available):', typeof process !== 'undefined' ? 'Available' : 'Not available in browser');
  console.log('================================');
  
  return {
    url: import.meta.env.PUBLIC_SUPABASE_URL,
    keySet: !!import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    allKeys: Object.keys(import.meta.env)
  };
}
