import { supabase, type UserProfile, type UserRole } from './supabase';

/**
 * Versioned cache key. The previous cache could keep an old admin/owner role
 * after a staff account was changed to employee. Bumping the key forces a fresh
 * permission read after this patch is deployed.
 */
const AUTH_CACHE_KEY = 'opc:auth-profile-cache:v3';
const LEGACY_AUTH_CACHE_KEYS = ['opc:auth-profile-cache', 'opc:auth-profile-cache:v2'];
const AUTH_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

type AuthCachePayload = {
  savedAt: number;
  profile: UserProfile;
};

type StaffRoleRow = {
  id?: string | null;
  user_id?: string | null;
  employee_id?: string | null;
  role?: string | null;
  display_name?: string | null;
  email?: string | null;
  status?: string | null;
  can_access_portal?: boolean | null;
  can_manage_jobs?: boolean | null;
  can_view_all_jobs?: boolean | null;
};

function normalizeRole(value: unknown): UserRole {
  const role = String(value || '').toLowerCase().trim();

  if (role === 'owner') return 'owner';
  if (role === 'admin') return 'admin';
  if (role === 'dispatch' || role === 'dispatcher' || role === 'disposition') return 'dispatch';
  if (role === 'employee' || role === 'mitarbeiter' || role === 'staff') return 'employee';
  if (role === 'client' || role === 'kunde') return 'client';

  return 'client';
}

function normalizeStaffRole(row: StaffRoleRow | null | undefined): UserRole {
  if (!row) return 'client';

  const explicitRole = normalizeRole(row.role);

  if (explicitRole === 'owner' || explicitRole === 'admin' || explicitRole === 'dispatch') {
    return explicitRole;
  }

  if (explicitRole === 'employee') {
    return 'employee';
  }

  if (row.can_manage_jobs === true || row.can_view_all_jobs === true) {
    return 'dispatch';
  }

  return 'employee';
}

function profileFromLegacyLocalStorage(): UserProfile | null {
  if (typeof window === 'undefined') return null;

  try {
    const rawUserData = window.localStorage.getItem('mco_user_data') || window.localStorage.getItem('mco_auth');
    const cachedRole = window.localStorage.getItem('mco_user_role');

    if (!rawUserData || !cachedRole) return null;

    const cached = JSON.parse(rawUserData);
    if (!cached?.id) return null;

    return {
      id: cached.id,
      email: cached.email || '',
      full_name: cached.full_name || cached.name || cached.username || cached.email || 'User',
      role: normalizeRole(cachedRole),
      created_at: cached.created_at || '',
      updated_at: cached.updated_at || '',
    } as UserProfile;
  } catch {
    return null;
  }
}

function cleanupLegacyAuthCaches() {
  if (typeof window === 'undefined') return;

  try {
    for (const key of LEGACY_AUTH_CACHE_KEYS) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore cache cleanup failures.
  }
}

export function readCachedOpcAuthProfile(maxAgeMs = AUTH_CACHE_MAX_AGE_MS): UserProfile | null {
  if (typeof window === 'undefined') return null;

  cleanupLegacyAuthCaches();

  try {
    const raw = window.sessionStorage.getItem(AUTH_CACHE_KEY);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as AuthCachePayload;
    if (!parsed?.profile || typeof parsed.savedAt !== 'number') return null;

    if (Date.now() - parsed.savedAt > maxAgeMs) {
      window.sessionStorage.removeItem(AUTH_CACHE_KEY);
      return null;
    }

    return parsed.profile;
  } catch {
    return null;
  }
}

export function writeCachedOpcAuthProfile(profile: UserProfile) {
  if (typeof window === 'undefined') return;

  cleanupLegacyAuthCaches();

  try {
    const payload: AuthCachePayload = {
      savedAt: Date.now(),
      profile,
    };

    window.sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(payload));
    window.localStorage.setItem('mco_user_role', profile.role);
    window.localStorage.setItem(
      'mco_user_data',
      JSON.stringify({
        id: profile.id,
        email: profile.email,
        name: profile.full_name,
        full_name: profile.full_name,
        username: profile.full_name || profile.email || 'User',
      })
    );
    window.localStorage.setItem(
      'mco_auth',
      JSON.stringify({
        id: profile.id,
        email: profile.email,
        name: profile.full_name,
        full_name: profile.full_name,
        username: profile.full_name || profile.email || 'User',
      })
    );
  } catch {
    // Cache failure should not block the app.
  }
}

export function clearCachedOpcAuthProfile() {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(AUTH_CACHE_KEY);
    for (const key of LEGACY_AUTH_CACHE_KEYS) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore.
  }
}

async function fetchActiveStaffRoleByUser(userId: string, email?: string | null): Promise<StaffRoleRow | null> {
  const fields = 'id,user_id,employee_id,role,display_name,email,status,can_access_portal,can_manage_jobs,can_view_all_jobs';

  const byUser = await supabase
    .from('opc_staff_roles')
    .select(fields)
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('can_access_portal', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!byUser.error && byUser.data) return byUser.data as StaffRoleRow;

  if (!email) return null;

  const byEmail = await supabase
    .from('opc_staff_roles')
    .select(fields)
    .ilike('email', email)
    .eq('status', 'active')
    .eq('can_access_portal', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!byEmail.error && byEmail.data) return byEmail.data as StaffRoleRow;

  return null;
}

export async function loadOpcAuthProfile(): Promise<UserProfile | null> {
  cleanupLegacyAuthCaches();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const staffRole = await fetchActiveStaffRoleByUser(user.id, user.email);

  if (staffRole) {
    let employeeName = '';
    let employeeEmail = '';

    if (staffRole.employee_id) {
      const { data: employee } = await supabase
        .from('employees')
        .select('full_name, email')
        .eq('id', staffRole.employee_id)
        .maybeSingle();

      employeeName = employee?.full_name || '';
      employeeEmail = employee?.email || '';
    }

    const profile: UserProfile = {
      id: user.id,
      email: staffRole.email || employeeEmail || user.email || '',
      full_name: staffRole.display_name || employeeName || user.email || 'User',
      role: normalizeStaffRole(staffRole),
      created_at: '',
      updated_at: '',
    };

    writeCachedOpcAuthProfile(profile);
    return profile;
  }

  const { data: legacyProfile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!legacyProfile) return null;

  const profile: UserProfile = {
    ...legacyProfile,
    id: user.id,
    email: legacyProfile.email || user.email || '',
    full_name: legacyProfile.full_name || legacyProfile.name || user.email || 'User',
    role: normalizeRole(legacyProfile.role || legacyProfile.opc_staff_role || legacyProfile.staff_role),
  } as UserProfile;

  writeCachedOpcAuthProfile(profile);
  return profile;
}
