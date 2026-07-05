import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import {
  getOpcSupabaseAnonKey,
  getOpcSupabaseServiceRoleKey,
  getOpcSupabaseUrl,
} from './opc-server-env';

export type OpcOperationalRole = 'owner' | 'admin' | 'dispatch' | 'employee' | 'client';

type AnyRow = Record<string, any>;

const ACTIVE_STATUSES = new Set(['active', 'aktiv']);

export function normalizeOpcOperationalRole(value: unknown): OpcOperationalRole {
  const role = String(value || '').trim().toLowerCase();

  if (['owner', 'inhaber', 'godmode', 'god_mode'].includes(role)) return 'owner';
  if (['admin', 'administrator'].includes(role)) return 'admin';
  if (['dispatch', 'dispatcher', 'disposition', 'disponent'].includes(role)) return 'dispatch';
  if (['employee', 'mitarbeiter', 'staff', 'cleaner', 'reinigung'].includes(role)) return 'employee';
  return 'client';
}

export function isOpcJobManagerRole(role: unknown) {
  return ['owner', 'admin', 'dispatch'].includes(normalizeOpcOperationalRole(role));
}

function profileRole(profile: AnyRow | null): OpcOperationalRole {
  if (profile?.is_owner === true) return 'owner';
  if (profile?.is_admin === true) return 'admin';

  return normalizeOpcOperationalRole(
    profile?.role || profile?.opc_staff_role || profile?.staff_role || profile?.position,
  );
}

function activeStaffRows(rows: AnyRow[]) {
  return rows.filter((row) => {
    const status = String(row?.status || 'active').trim().toLowerCase();
    return ACTIVE_STATUSES.has(status) && row?.can_access_portal !== false;
  });
}

function uniqueStrings(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
        .map((value) => String(value)),
    ),
  );
}

export type OpcJobAccess = {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: OpcOperationalRole;
  canViewAllJobs: boolean;
  canManageJobs: boolean;
  canViewAssignedJobs: boolean;
  primaryStaffRoleId: string | null;
  staffRoleIds: string[];
  employeeIds: string[];
};

export async function authenticateOpcRequest(request: Request, locals?: any) {
  const url = getOpcSupabaseUrl(locals);
  const anonKey = getOpcSupabaseAnonKey(locals);
  const serviceKey = getOpcSupabaseServiceRoleKey(locals);
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return { error: 'Not authenticated' as const, status: 401 as const };
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();

  if (error || !user) {
    return { error: 'Invalid authentication' as const, status: 401 as const };
  }

  return { user, serviceClient, url, serviceKey };
}

export async function resolveOpcJobAccess(
  serviceClient: SupabaseClient,
  user: User,
): Promise<OpcJobAccess> {
  const [{ data: profile }, staffByUser] = await Promise.all([
    serviceClient.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
    serviceClient.from('opc_staff_roles').select('*').eq('user_id', user.id),
  ]);

  let rows = (staffByUser.data || []) as AnyRow[];

  if (rows.length === 0 && user.email) {
    const staffByEmail = await serviceClient
      .from('opc_staff_roles')
      .select('*')
      .ilike('email', user.email);

    if (!staffByEmail.error) rows = (staffByEmail.data || []) as AnyRow[];
  }

  const staffRows = activeStaffRows(rows);
  const legacyRole = profileRole((profile || null) as AnyRow | null);
  const staffRoles = staffRows.map((row) => normalizeOpcOperationalRole(row.role));

  let role: OpcOperationalRole = 'client';

  if (legacyRole === 'owner' || staffRoles.includes('owner')) {
    role = 'owner';
  } else if (legacyRole === 'admin' || staffRoles.includes('admin')) {
    role = 'admin';
  } else if (
    legacyRole === 'dispatch' ||
    staffRoles.includes('dispatch') ||
    staffRows.some((row) => row.can_manage_jobs === true || row.can_view_all_jobs === true)
  ) {
    role = 'dispatch';
  } else if (legacyRole === 'employee' || staffRoles.includes('employee')) {
    role = 'employee';
  }

  const canManageJobs = isOpcJobManagerRole(role);
  const canViewAllJobs = canManageJobs;
  const canViewAssignedJobs =
    canViewAllJobs ||
    role === 'employee' ||
    staffRows.some((row) => row.can_view_assigned_jobs === true);

  const primaryRow =
    staffRows.find((row) => normalizeOpcOperationalRole(row.role) === role) ||
    staffRows[0] ||
    null;

  return {
    userId: user.id,
    email: user.email || primaryRow?.email || null,
    displayName:
      primaryRow?.display_name ||
      profile?.full_name ||
      profile?.display_name ||
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      user.email ||
      null,
    role,
    canViewAllJobs,
    canManageJobs,
    canViewAssignedJobs,
    primaryStaffRoleId: primaryRow?.id ? String(primaryRow.id) : null,
    staffRoleIds: uniqueStrings(staffRows.map((row) => row.id)),
    employeeIds: uniqueStrings(staffRows.map((row) => row.employee_id)),
  };
}
