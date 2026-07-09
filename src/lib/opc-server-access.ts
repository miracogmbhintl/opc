type AnyRow = Record<string, any>;

export type OpcServerAccess = {
  role: 'owner' | 'admin' | 'dispatch' | 'employee' | 'client';
  staffRole: AnyRow | null;
  profile: AnyRow | null;
  canManageJobs: boolean;
  canManageCalendar: boolean;
};

export function normalizeOpcServerRole(value: unknown): OpcServerAccess['role'] {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'godmode' || role === 'owner' || role === 'inhaber') return 'owner';
  if (role === 'admin' || role === 'administrator') return 'admin';
  if (role === 'dispatch' || role === 'dispatcher' || role === 'disposition') return 'dispatch';
  if (role === 'employee' || role === 'mitarbeiter' || role === 'staff') return 'employee';
  return 'client';
}

function strongestRole(values: unknown[]): OpcServerAccess['role'] {
  const rank: Record<OpcServerAccess['role'], number> = {
    owner: 5,
    admin: 4,
    dispatch: 3,
    employee: 2,
    client: 1,
  };

  return values
    .map(normalizeOpcServerRole)
    .sort((left, right) => rank[right] - rank[left])[0] || 'client';
}

export async function resolveOpcServerAccess(serviceSupabase: any, user: AnyRow): Promise<OpcServerAccess> {
  const [staffResult, profileResult] = await Promise.all([
    serviceSupabase
      .from('opc_staff_roles')
      .select('id,user_id,employee_id,role,status,can_access_portal,can_manage_jobs,can_view_all_jobs')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .eq('can_access_portal', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    serviceSupabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle(),
  ]);

  if (staffResult.error) throw staffResult.error;

  const staffRole = staffResult.data || null;
  const profile = profileResult.error ? null : profileResult.data || null;
  const role = strongestRole([
    staffRole?.role,
    profile?.role,
    profile?.opc_staff_role,
    profile?.staff_role,
    profile?.is_owner === true ? 'owner' : null,
    profile?.is_admin === true ? 'admin' : null,
    user?.app_metadata?.role,
    user?.app_metadata?.app_role,
    user?.user_metadata?.role,
    user?.user_metadata?.app_role,
  ]);

  const elevatedRole = ['owner', 'admin', 'dispatch'].includes(role);

  return {
    role,
    staffRole,
    profile,
    canManageJobs:
      elevatedRole ||
      staffRole?.can_manage_jobs === true ||
      staffRole?.can_view_all_jobs === true,
    canManageCalendar: elevatedRole,
  };
}
