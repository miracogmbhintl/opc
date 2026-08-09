/**
 * Settings Page Wrapper
 * Uses the canonical OPC auth profile instead of reading a second role source directly.
 */

import { useEffect, useState } from 'react';
import { baseUrl } from '../lib/base-url';
import { loadOpcAuthProfile, refreshOpcAuthProfile } from '../lib/opc-auth-cache';
import MirakaSidebar from './MirakaSidebar';
import SettingsPage from './SettingsPage';

export default function SettingsPageWrapper() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'owner' | 'admin' | 'client' | null>(null);

  useEffect(() => {
    void checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const cached = await loadOpcAuthProfile();
      const profile = await refreshOpcAuthProfile(true).catch(() => cached);

      if (!profile) {
        window.location.href = `${baseUrl}/`;
        return;
      }

      const resolvedRole = profile.role === 'owner' ? 'owner' : profile.role === 'admin' ? 'admin' : 'client';
      setRole(resolvedRole);
      setLoading(false);
    } catch (error) {
      console.error('Settings auth check error:', error);
      window.location.href = `${baseUrl}/`;
    }
  }

  if (loading || !role) return null;

  return (
    <>
      <MirakaSidebar role={role} currentPath="/einstellungen" />
      <SettingsPage role={role} />
    </>
  );
}
