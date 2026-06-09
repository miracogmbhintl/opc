import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

function normalizeRole(value: unknown) {
  const role = String(value || '').toLowerCase().trim();

  if (role === 'owner') return 'owner';
  if (role === 'admin') return 'admin';
  if (role === 'dispatch' || role === 'dispatcher' || role === 'disposition') return 'dispatch';
  if (role === 'employee' || role === 'mitarbeiter' || role === 'staff') return 'employee';
  if (role === 'client' || role === 'kunde') return 'client';

  return 'client';
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
      .select('id, email, full_name, role, client_id, created_at')
      .eq('id', session.user.id)
      .maybeSingle();

    const { data: staffRole } = await supabase
      .from('opc_staff_roles')
      .select('id, user_id, employee_id, email, display_name, role, status, can_access_portal')
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

    const enrichedProfile = {
      ...(profile || {}),
      id: session.user.id,
      email: staffRole?.email || profile?.email || session.user.email || '',
      full_name: staffRole?.display_name || profile?.full_name || session.user.email || 'User',
      role: staffRole ? normalizeRole(staffRole.role) : normalizeRole(profile?.role),
      opc_staff_role_id: staffRole?.id || null,
      employee_id: staffRole?.employee_id || null,
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
