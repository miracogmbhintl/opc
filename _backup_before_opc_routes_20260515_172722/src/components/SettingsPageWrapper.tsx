/**
 * Settings Page Wrapper
 * Handles auth check and role detection before rendering SettingsPage
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import MirakaSidebar from './MirakaSidebar';
import SettingsPage from './SettingsPage';
import ClientSettings from './ClientSettings';

export default function SettingsPageWrapper() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'owner' | 'admin' | 'client' | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Check session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        window.location.href = `${baseUrl}/miraka-co-portal`;
        return;
      }

      // Fetch user profile
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (error || !profile) {
        console.error('Error loading profile:', error);
        window.location.href = `${baseUrl}/miraka-co-portal`;
        return;
      }

      setRole(profile.role as 'owner' | 'admin' | 'client');
      setLoading(false);
    } catch (err) {
      console.error('Auth check error:', err);
      window.location.href = `${baseUrl}/miraka-co-portal`;
    }
  };

  if (loading) {
    return null;
  }

  return (
    <>
      <MirakaSidebar role={role} currentPath="/miraka-co-portal/settings" />
      <SettingsPage role={role} />
    </>
  );
}


