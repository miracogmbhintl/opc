import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import {
  getOpcSupabaseAnonKey,
  getOpcSupabaseServiceRoleKey,
  getOpcSupabaseUrl,
} from '../../../../lib/opc-server-env';

type AnyRow = Record<string, any>;

type EffectiveRole = 'owner' | 'admin' | 'dispatch' | 'employee' | 'client';

function normalizeRole(value: unknown): EffectiveRole {
  const role = String(value || '').trim().toLowerCase();

  if (role === 'owner' || role === 'inhaber' || role === 'godmode') return 'owner';
  if (role === 'admin' || role === 'administrator') return 'admin';
  if (role === 'dispatch' || role === 'dispatcher' || role === 'disposition') return 'dispatch';
  if (role === 'employee' || role === 'mitarbeiter' || role === 'staff') return 'employee';
  return 'client';
}

function isManagerRole(role: EffectiveRole) {
  return role === 'owner' || role === 'admin' || role === 'dispatch';
}

function profileRole(profile: AnyRow | null): EffectiveRole {
  if (profile?.is_owner === true) return 'owner';
  if (profile?.is_admin === true) return 'admin';

  return normalizeRole(
    profile?.role || profile?.opc_staff_role || profile?.staff_role || profile?.position,
  );
}

function effectiveRole(profile: AnyRow | null, staffRows: AnyRow[]): EffectiveRole {
  const activeRows = staffRows.filter((row) => {
    const status = String(row.status || 'active').trim().toLowerCase();
    return status === 'active' && row.can_access_portal !== false;
  });
  const legacyRole = profileRole(profile);

  if (legacyRole === 'owner' || activeRows.some((row) => normalizeRole(row.role) === 'owner')) {
    return 'owner';
  }

  if (legacyRole === 'admin' || activeRows.some((row) => normalizeRole(row.role) === 'admin')) {
    return 'admin';
  }

  if (
    legacyRole === 'dispatch' ||
    activeRows.some((row) => normalizeRole(row.role) === 'dispatch') ||
    activeRows.some((row) => row.can_manage_jobs === true || row.can_view_all_jobs === true)
  ) {
    return 'dispatch';
  }

  if (legacyRole === 'employee' || activeRows.some((row) => normalizeRole(row.role) === 'employee')) {
    return 'employee';
  }

  return 'client';
}

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  return authorization.replace(/^Bearer\s+/i, '').trim();
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

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const url = getOpcSupabaseUrl(locals);
    const anonKey = getOpcSupabaseAnonKey(locals);
    const serviceKey = getOpcSupabaseServiceRoleKey(locals);
    const token = bearerToken(request);

    if (!token) return json({ error: 'Not authenticated' }, 401);

    const userSupabase = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const serviceSupabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userSupabase.auth.getUser();

    if (userError || !user) return json({ error: 'Invalid authentication' }, 401);

    const [{ data: profile }, staffByUser] = await Promise.all([
      serviceSupabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
      serviceSupabase.from('opc_staff_roles').select('*').eq('user_id', user.id),
    ]);

    let staffRows = staffByUser.data || [];

    if (staffRows.length === 0 && user.email) {
      const staffByEmail = await serviceSupabase
        .from('opc_staff_roles')
        .select('*')
        .ilike('email', user.email);

      if (!staffByEmail.error) staffRows = staffByEmail.data || [];
    }

    const role = effectiveRole(profile || null, staffRows);

    if (!isManagerRole(role)) {
      return json({ error: 'Manager access required', currentRole: role }, 403);
    }

    const detailResult = await serviceSupabase
      .from('opc_job_detail_view')
      .select('*')
      .limit(2000);

    let jobs = detailResult.data || [];

    if (detailResult.error) {
      const fallbackResult = await serviceSupabase
        .from('opc_service_jobs')
        .select('*')
        .limit(2000);

      if (fallbackResult.error) throw fallbackResult.error;
      jobs = fallbackResult.data || [];
    }

    jobs.sort((left: AnyRow, right: AnyRow) => {
      const leftTime = left.planned_start ? new Date(left.planned_start).getTime() : 0;
      const rightTime = right.planned_start ? new Date(right.planned_start).getTime() : 0;
      return leftTime - rightTime;
    });

    return json({
      jobs,
      currentRole: role,
      canViewAllJobs: true,
      canManageJobs: true,
    });
  } catch (error: any) {
    console.error('[opc/jobs/manager-feed] failed', error);
    return json(
      {
        error:
          error?.message ||
          error?.details ||
          error?.hint ||
          error?.code ||
          'Jobs could not be loaded.',
      },
      500,
    );
  }
};
