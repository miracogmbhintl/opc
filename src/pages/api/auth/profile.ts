import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

function normalizeRole(value: unknown) {
  const role = String(value || '').toLowerCase().trim();

  if (role === 'owner' || role === 'godmode') return 'owner';
  if (role === 'admin' || role === 'administrator') return 'admin';
  if (role === 'dispatch' || role === 'dispatcher' || role === 'disposition') return 'dispatch';
  if (role === 'employee' || role === 'mitarbeiter' || role === 'staff') return 'employee';
  if (role === 'client' || role === 'kunde') return 'client';

  return 'client';
}

function resolveProfileRole(profile: Record<string, any> | null | undefined) {
  if (profile?.is_owner === true) return 'owner';
  if (profile?.is_admin === true) return 'admin';

  return normalizeRole(profile?.role || profile?.opc_staff_role || profile?.staff_role);
}

function resolveStaffRole(staffRole: Record<string, any> | null | undefined, profileRole: string) {
  if (!staffRole) return profileRole;

  const explicitRole = normalizeRole(staffRole.role);

  if (['owner', 'admin', 'dispatch'].includes(explicitRole)) return explicitRole;
  if (['owner', 'admin', 'dispatch'].includes(profileRole)) return profileRole;

  if (staffRole.can_manage_jobs === true || staffRole.can_view_all_jobs === true) {
    return 'dispatch';
  }

  if (explicitRole === 'employee') return 'employee';

  return profileRole || 'client';
}

export const GET: APIRoute = async ({ locals }) => {
  try {
    const session = locals?.runtime?.session || locals?.session;

    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    const { data: staffRole } = await supabase
      .from('opc_staff_roles')
      .select(
        'id, user_id, employee_id, email, display_name, role, status, can_access_portal, can_manage_jobs, can_view_all_jobs',
      )
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .eq('can_access_portal', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!profile && !staffRole) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const profileRole = resolveProfileRole(profile);
    const effectiveRole = resolveStaffRole(staffRole, profileRole);

    const enrichedProfile = {
      ...(profile || {}),
      id: session.user.id,
      email: staffRole?.email || profile?.email || session.user.email || '',
      full_name: staffRole?.display_name || profile?.full_name || session.user.email || 'User',
      role: effectiveRole,
      opc_staff_role_id: staffRole?.id || null,
      employee_id: staffRole?.employee_id || null,
      can_manage_jobs:
        staffRole?.can_manage_jobs === true || ['owner', 'admin', 'dispatch'].includes(effectiveRole),
      can_view_all_jobs:
        staffRole?.can_view_all_jobs === true || ['owner', 'admin', 'dispatch'].includes(effectiveRole),
      last_sign_in_at: session.user.last_sign_in_at || null,
    };

    return new Response(JSON.stringify(enrichedProfile), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Profile API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
