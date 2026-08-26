import type { APIRoute } from 'astro';
import {
  createServerSupabaseClient,
  requireAuth,
} from '../../../lib/supabase-server';

export const prerender = false;

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
  if (explicitRole === 'employee') return 'employee';

  if (['owner', 'admin', 'dispatch'].includes(profileRole)) return profileRole;

  if (staffRole.can_manage_jobs === true || staffRole.can_view_all_jobs === true) {
    return 'dispatch';
  }

  return profileRole || 'client';
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}

export const GET: APIRoute = async ({ cookies, locals }) => {
  try {
    const user = await requireAuth(cookies, locals?.runtime?.env);
    if (!user) return json({ error: 'Not authenticated' }, 401);

    const supabase = createServerSupabaseClient(cookies, locals?.runtime?.env);

    const [{ data: profile, error: profileError }, { data: staffRole, error: staffError }] =
      await Promise.all([
        supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('opc_staff_roles')
          .select(
            'id, user_id, employee_id, email, display_name, role, status, can_access_portal, can_manage_jobs, can_view_all_jobs',
          )
          .eq('user_id', user.id)
          .in('status', ['active', 'aktiv', 'enabled'])
          .eq('can_access_portal', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    if (profileError) {
      console.warn('[Auth Profile] User profile lookup failed:', profileError.message);
    }
    if (staffError) {
      console.warn('[Auth Profile] Staff lookup failed:', staffError.message);
    }

    if (!profile && !staffRole) {
      return json({ error: 'Profile not found' }, 404);
    }

    const profileRole = resolveProfileRole(profile);
    const effectiveRole = resolveStaffRole(staffRole, profileRole);

    return json({
      ...(profile || {}),
      id: user.id,
      email: staffRole?.email || profile?.email || user.email || '',
      full_name: staffRole?.display_name || profile?.full_name || user.email || 'User',
      role: effectiveRole,
      opc_staff_role_id: staffRole?.id || null,
      employee_id: staffRole?.employee_id || null,
      can_manage_jobs:
        staffRole?.can_manage_jobs === true || ['owner', 'admin', 'dispatch'].includes(effectiveRole),
      can_view_all_jobs:
        staffRole?.can_view_all_jobs === true || ['owner', 'admin', 'dispatch'].includes(effectiveRole),
      last_sign_in_at: user.last_sign_in_at || null,
    });
  } catch (error) {
    console.error(
      '[Auth Profile] GET failed:',
      error instanceof Error ? error.message : error,
    );
    return json({ error: 'Internal server error' }, 500);
  }
};
