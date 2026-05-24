import { useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabase-browser';

export default function AuthRedirectHandler() {
  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.href = '/dashboard';
      } else {
        window.location.href = '/';
      }
    });
  }, []);
  return null;
}
