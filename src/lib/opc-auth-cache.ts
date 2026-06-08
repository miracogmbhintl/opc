import { supabase, type UserProfile, type UserRole } from './supabase';

const AUTH_CACHE_KEY = 'opc:auth-profile-cache';
const AUTH_CACHE_MAX_AGE_MS = 30 * 60 * 1000;

type AuthCachePayload = {
  savedAt: number;
  profile: UserProfile;
};

function normalizeRole(value: unknown): UserRole {
  const role = String(value || '').toLowerCase().trim();

  if (role === 'owner') return 'owner';
  if (role === 'admin') return 'admin';
  if (role === 'dispatch' || role === 'dispatcher' || role === 'disposition') return 'dispatch';
  if (role === 'employee' || role === 'mitarbeiter') return 'employee';
  if (role === 'client' || role === 'kunde') return 'client';

  return 'client';
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

export function readCachedOpcAuthProfile(maxAgeMs = AUTH_CACHE_MAX_AGE_MS): UserProfile | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(AUTH_CACHE_KEY);

    if (!raw) {
      return profileFromLegacyLocalStorage();
    }

    const parsed = JSON.parse(raw) as AuthCachePayload;
    if (!parsed?.profile || typeof parsed.savedAt !== 'number') return profileFromLegacyLocalStorage();

    if (Date.now() - parsed.savedAt > maxAgeMs) {
      window.sessionStorage.removeItem(AUTH_CACHE_KEY);
      return profileFromLegacyLocalStorage();
    }

    return parsed.profile;
  } catch {
    return profileFromLegacyLocalStorage();
  }
}

export function writeCachedOpcAuthProfile(profile: UserProfile) {
  if (typeof window === 'undefined') return;

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
  } catch {
    // Ignore.
  }
}

export async function loadOpcAuthProfile(): Promise<UserProfile | null> {
  const cached = readCachedOpcAuthProfile();
  if (cached) return cached;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data: staffRole, error: staffError } = await supabase
    .from('opc_staff_roles')
    .select('role, display_name, email, status, can_access_portal, employee_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('can_access_portal', true)
    .maybeSingle();

  if (!staffError && staffRole) {
    let employeeName = '';
    let employeeEmail = '';

    if ((staffRole as any).employee_id) {
      const { data: employee } = await supabase
        .from('employees')
        .select('full_name, email')
        .eq('id', (staffRole as any).employee_id)
        .maybeSingle();

      employeeName = employee?.full_name || '';
      employeeEmail = employee?.email || '';
    }

    const profile: UserProfile = {
      id: user.id,
      email: (staffRole as any).email || employeeEmail || user.email || '',
      full_name: (staffRole as any).display_name || employeeName || user.email || 'User',
      role: normalizeRole((staffRole as any).role),
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
