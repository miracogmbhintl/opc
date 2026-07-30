import { useEffect, useMemo, useState } from 'react';
import type { UserProfile } from '../lib/supabase';
import { readCachedOpcAuthProfile, refreshOpcAuthProfile } from '../lib/opc-auth-cache';
import DashboardHomeRouter from './DashboardHomeRouter';
import OpcClientDashboardHome from './OpcClientDashboardHome';

function normalizeRole(role?: string | null) {
  const clean = String(role || '').trim().toLowerCase();
  if (clean === 'kunde') return 'client';
  return clean;
}

export default function DashboardHomeEntry() {
  const initialProfile = useMemo(() => readCachedOpcAuthProfile(), []);
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile);
  const [loading, setLoading] = useState(!initialProfile);

  useEffect(() => {
    let mounted = true;

    async function resolveProfile() {
      try {
        const liveProfile = await refreshOpcAuthProfile(true);
        if (mounted && liveProfile) setProfile(liveProfile);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void resolveProfile();

    return () => {
      mounted = false;
    };
  }, []);

  if (normalizeRole(profile?.role) === 'client' && profile) {
    return <OpcClientDashboardHome profile={profile} />;
  }

  if (loading && !profile) {
    return null;
  }

  return <DashboardHomeRouter />;
}
