import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import {
  getOpcSupabaseAnonKey,
  getOpcSupabaseServiceRoleKey,
  getOpcSupabaseUrl,
} from '../../../../lib/opc-server-env';

type AnyRow = Record<string, any>;

function normalizeRole(value: unknown) {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'owner' || role === 'inhaber' || role === 'godmode') return 'owner';
  return role;
}

function bearerToken(request: Request) {
  return String(request.headers.get('authorization') || '')
    .replace(/^Bearer\s+/i, '')
    .trim();
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
    const token = bearerToken(request);
    if (!token) return json({ owner: false }, 401);

    const url = getOpcSupabaseUrl(locals);
    const userClient = createClient(url, getOpcSupabaseAnonKey(locals), {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const serviceClient = createClient(url, getOpcSupabaseServiceRoleKey(locals), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) return json({ owner: false }, 401);

    const [{ data: profile }, staffByUser] = await Promise.all([
      serviceClient.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
      serviceClient.from('opc_staff_roles').select('*').eq('user_id', user.id),
    ]);

    let staffRows: AnyRow[] = staffByUser.data || [];

    if (staffRows.length === 0 && user.email) {
      const byEmail = await serviceClient
        .from('opc_staff_roles')
        .select('*')
        .ilike('email', user.email);

      if (!byEmail.error) staffRows = byEmail.data || [];
    }

    const profileIsOwner =
      profile?.is_owner === true ||
      normalizeRole(profile?.role || profile?.opc_staff_role || profile?.staff_role) === 'owner';
    const staffIsOwner = staffRows.some((row) => {
      const status = String(row.status || 'active').trim().toLowerCase();
      return status === 'active' && row.can_access_portal !== false && normalizeRole(row.role) === 'owner';
    });

    if (!profileIsOwner && !staffIsOwner) {
      return json({ owner: false }, 403);
    }

    return json({ owner: true });
  } catch (error) {
    console.error('[opc/access/owner] failed', error);
    return json({ owner: false }, 500);
  }
};
