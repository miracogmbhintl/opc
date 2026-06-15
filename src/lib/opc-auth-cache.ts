import { supabase, type UserProfile, type UserRole } from './supabase';

/**
 * Persistent OPC profile cache.
 *
 * Staff should stay logged in on mobile. Supabase already persists the session;
 * this cache keeps the normalized OPC role/profile available across browser
 * restarts and temporary network outages. It is only profile metadata, not the
 * Supabase session itself.
 */
const AUTH_CACHE_KEY = 'opc:auth-profile-cache:v4:persistent';
const LEGACY_AUTH_CACHE_KEYS = ['opc:auth-profile-cache', 'opc:auth-profile-cache:v2', 'opc:auth-profile-cache:v3'];
const AUTH_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

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

function isBrowser() {
  return typeof window !== 'undefined';
}

function normalizeRole(value: unknown): UserRole {
  const role = String(value || '').toLowerCase().trim();

  if (role === 'godmode') return 'owner';
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

function isNetworkLikeError(error: unknown) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;

  const message = String((error as any)?.message || error || '').toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('fetch failed') ||
    message.includes('offline') ||
    message.includes('timeout') ||
    message.includes('connection')
  );
}

function profileFromLegacyLocalStorage(): UserProfile | null {
  if (!isBrowser()) return null;

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
  if (!isBrowser()) return;

  try {
    for (const key of LEGACY_AUTH_CACHE_KEYS) {
      window.sessionStorage.removeItem(key);
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore cache cleanup failures.
  }
}

export function readCachedOpcAuthProfile(maxAgeMs = AUTH_CACHE_MAX_AGE_MS): UserProfile | null {
  if (!isBrowser()) return null;

  cleanupLegacyAuthCaches();

  try {
    const raw = window.localStorage.getItem(AUTH_CACHE_KEY) || window.sessionStorage.getItem(AUTH_CACHE_KEY);

    if (!raw) return profileFromLegacyLocalStorage();

    const parsed = JSON.parse(raw) as AuthCachePayload;
    if (!parsed?.profile || typeof parsed.savedAt !== 'number') return profileFromLegacyLocalStorage();

    if (Date.now() - parsed.savedAt > maxAgeMs) {
      window.localStorage.removeItem(AUTH_CACHE_KEY);
      window.sessionStorage.removeItem(AUTH_CACHE_KEY);
      return profileFromLegacyLocalStorage();
    }

    return parsed.profile;
  } catch {
    return profileFromLegacyLocalStorage();
  }
}

export function writeCachedOpcAuthProfile(profile: UserProfile) {
  if (!isBrowser()) return;

  cleanupLegacyAuthCaches();

  try {
    const payload: AuthCachePayload = {
      savedAt: Date.now(),
      profile,
    };

    const serialized = JSON.stringify(payload);

    window.localStorage.setItem(AUTH_CACHE_KEY, serialized);
    window.sessionStorage.setItem(AUTH_CACHE_KEY, serialized);
    window.localStorage.setItem('mco_user_role', profile.role);
    window.localStorage.setItem(
      'mco_user_data',
      JSON.stringify({
        id: profile.id,
        email: profile.email,
        name: profile.full_name,
        full_name: profile.full_name,
        username: profile.full_name || profile.email || 'User',
      }),
    );
    window.localStorage.setItem(
      'mco_auth',
      JSON.stringify({
        id: profile.id,
        email: profile.email,
        name: profile.full_name,
        full_name: profile.full_name,
        username: profile.full_name || profile.email || 'User',
      }),
    );
  } catch {
    // Cache failure should not block the app.
  }
}

export function clearCachedOpcAuthProfile() {
  if (!isBrowser()) return;

  try {
    window.sessionStorage.removeItem(AUTH_CACHE_KEY);
    window.localStorage.removeItem(AUTH_CACHE_KEY);
    for (const key of LEGACY_AUTH_CACHE_KEYS) {
      window.sessionStorage.removeItem(key);
      window.localStorage.removeItem(key);
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

  const cachedProfile = readCachedOpcAuthProfile();

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    if (cachedProfile && isNetworkLikeError(sessionError)) return cachedProfile;
    return null;
  }

  const user = session?.user || null;
  if (!user) return null;

  try {
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

    if (!legacyProfile) return cachedProfile || null;

    const profile: UserProfile = {
      ...legacyProfile,
      id: user.id,
      email: legacyProfile.email || user.email || '',
      full_name: legacyProfile.full_name || legacyProfile.name || user.email || 'User',
      role: normalizeRole(legacyProfile.role || legacyProfile.opc_staff_role || legacyProfile.staff_role),
    } as UserProfile;

    writeCachedOpcAuthProfile(profile);
    return profile;
  } catch (error) {
    if (cachedProfile && isNetworkLikeError(error)) return cachedProfile;
    if (cachedProfile) return cachedProfile;
    return null;
  }
}
