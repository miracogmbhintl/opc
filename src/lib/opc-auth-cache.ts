import { supabase, type UserProfile, type UserRole } from './supabase';

/**
 * Persistent OPC profile cache.
 *
 * Staff should stay logged in on mobile. Supabase already persists the session;
 * this cache keeps the normalized OPC role/profile available across browser
 * restarts and temporary network outages. It is only profile metadata, not the
 * Supabase session itself.
 */
const AUTH_CACHE_KEY = 'opc:auth-profile-cache:v5:persistent';
const LEGACY_AUTH_CACHE_KEYS = [
  'opc:auth-profile-cache',
  'opc:auth-profile-cache:v2',
  'opc:auth-profile-cache:v3',
  'opc:auth-profile-cache:v4:persistent',
];
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

function isExplicitlyLoggedOut() {
  if (!isBrowser()) return false;

  try {
    return (
      window.sessionStorage.getItem('mco_logged_out') === 'true' ||
      window.localStorage.getItem('mco_logged_out') === 'true'
    );
  } catch {
    return false;
  }
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

function normalizeStaffRole(
  row: StaffRoleRow | null | undefined,
  profileRole: UserRole = 'client',
): UserRole {
  if (!row) return profileRole;

  const explicitRole = normalizeRole(row.role);

  if (explicitRole === 'owner' || profileRole === 'owner') return 'owner';
  if (explicitRole === 'admin' || profileRole === 'admin') return 'admin';
  if (explicitRole === 'dispatch' || profileRole === 'dispatch') return 'dispatch';

  // Operational permissions must win over a stale legacy employee label.
  // This is the dispatch-admin case: full planning access without finance access.
  if (row.can_manage_jobs === true || row.can_view_all_jobs === true) {
    return 'dispatch';
  }

  if (explicitRole === 'employee') return 'employee';

  return profileRole === 'client' ? 'employee' : profileRole;
}

function normalizeLegacyProfileRole(profile: Record<string, any> | null | undefined): UserRole {
  if (profile?.is_owner === true) return 'owner';
  if (profile?.is_admin === true) return 'admin';

  return normalizeRole(profile?.role || profile?.opc_staff_role || profile?.staff_role);
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

const AUTH_PROFILE_NETWORK_TIMEOUT_MS = 4500;
const AUTH_PROFILE_REFRESH_COOLDOWN_MS = 60_000;
const AUTH_PROFILE_SHARED_REFRESH_KEY = 'opc:auth-profile-refresh-at:v1';
const AUTH_PROFILE_SHARED_REFRESH_COOLDOWN_MS = 5 * 60_000;

let authProfileRequestInFlight: Promise<UserProfile | null> | null = null;
let lastAuthProfileRefreshAt = 0;

function sharedAuthRefreshIsRecent() {
  if (typeof window === 'undefined') return false;

  try {
    const value = Number(
      window.localStorage.getItem(
        AUTH_PROFILE_SHARED_REFRESH_KEY,
      ) || 0,
    );

    return (
      Number.isFinite(value) &&
      value > 0 &&
      Date.now() - value <
        AUTH_PROFILE_SHARED_REFRESH_COOLDOWN_MS
    );
  } catch {
    return false;
  }
}

function markSharedAuthRefresh() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      AUTH_PROFILE_SHARED_REFRESH_KEY,
      String(Date.now()),
    );
  } catch {
    // The in-memory cooldown remains available.
  }
}

function withAuthTimeout<T>(
  request: PromiseLike<T>,
  label: string,
  timeoutMs = AUTH_PROFILE_NETWORK_TIMEOUT_MS,
): Promise<T> {
  return Promise.race([
    Promise.resolve(request),
    new Promise<T>((_, reject) => {
      globalThis.setTimeout(() => {
        reject(new Error(`${label} timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

function explicitRoleValue(value: unknown) {
  const clean = String(value || '').toLowerCase().trim();

  return [
    'godmode',
    'owner',
    'admin',
    'dispatch',
    'dispatcher',
    'disposition',
    'employee',
    'mitarbeiter',
    'staff',
    'client',
    'kunde',
  ].includes(clean);
}

async function fetchActiveStaffRoleByUser(
  userId: string,
  email?: string | null,
): Promise<StaffRoleRow | null> {
  const fields =
    'id,user_id,employee_id,role,display_name,email,status,can_access_portal,can_manage_jobs,can_view_all_jobs';

  const byUser = await withAuthTimeout(
    supabase
      .from('opc_staff_roles')
      .select(fields)
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('can_access_portal', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    'opc_staff_roles by user',
  );

  if (!byUser.error && byUser.data) return byUser.data as StaffRoleRow;

  // Never double the request load when Supabase is timing out.
  if (byUser.error && isNetworkLikeError(byUser.error)) throw byUser.error;
  if (!email) return null;

  const byEmail = await withAuthTimeout(
    supabase
      .from('opc_staff_roles')
      .select(fields)
      .ilike('email', email)
      .eq('status', 'active')
      .eq('can_access_portal', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    'opc_staff_roles by email',
  );

  if (!byEmail.error && byEmail.data) return byEmail.data as StaffRoleRow;
  return null;
}

async function fetchLiveOpcAuthProfile(
  cachedProfile: UserProfile | null,
): Promise<UserProfile | null> {
  const {
    data: { session },
    error: sessionError,
  } = await withAuthTimeout(
    supabase.auth.getSession(),
    'Supabase session',
    3500,
  );

  if (sessionError) {
    if (cachedProfile && isNetworkLikeError(sessionError)) return cachedProfile;
    return null;
  }

  const user = session?.user || null;

  if (!user) {
    if (cachedProfile && !isExplicitlyLoggedOut()) return cachedProfile;
    return null;
  }

  const [staffRoleResult, legacyProfileResult] = await Promise.allSettled([
    fetchActiveStaffRoleByUser(user.id, user.email),
    withAuthTimeout(
      supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(),
      'user_profiles',
    ),
  ]);

  const staffRole =
    staffRoleResult.status === 'fulfilled' ? staffRoleResult.value : null;

  const legacyQuery =
    legacyProfileResult.status === 'fulfilled' ? legacyProfileResult.value : null;

  const legacyProfile =
    legacyQuery && !legacyQuery.error ? legacyQuery.data || null : null;

  const legacyRole = normalizeLegacyProfileRole(legacyProfile);

  if (staffRole) {
    let employeeName = '';
    let employeeEmail = '';

    const needsEmployeeFallback =
      Boolean(staffRole.employee_id) &&
      (!staffRole.display_name || !staffRole.email);

    if (needsEmployeeFallback && staffRole.employee_id) {
      try {
        const employeeResult = await withAuthTimeout(
          supabase
            .from('employees')
            .select('full_name,email')
            .eq('id', staffRole.employee_id)
            .maybeSingle(),
          'employees profile fallback',
          3000,
        );

        employeeName = employeeResult.data?.full_name || '';
        employeeEmail = employeeResult.data?.email || '';
      } catch {
        // Staff role data is sufficient to enter the portal.
      }
    }

    const profile: UserProfile = {
      id: user.id,
      email: staffRole.email || employeeEmail || user.email || '',
      full_name:
        staffRole.display_name ||
        employeeName ||
        user.user_metadata?.full_name ||
        user.email ||
        'User',
      role: normalizeStaffRole(staffRole, legacyRole),
      created_at: '',
      updated_at: '',
    };

    writeCachedOpcAuthProfile(profile);
    return profile;
  }

  if (legacyProfile) {
    const profile: UserProfile = {
      ...legacyProfile,
      id: user.id,
      email: legacyProfile.email || user.email || '',
      full_name:
        legacyProfile.full_name ||
        legacyProfile.name ||
        user.user_metadata?.full_name ||
        user.email ||
        'User',
      role: normalizeLegacyProfileRole(legacyProfile),
    } as UserProfile;

    writeCachedOpcAuthProfile(profile);
    return profile;
  }

  const metadataRole =
    user.user_metadata?.app_role ||
    user.user_metadata?.role ||
    user.app_metadata?.app_role ||
    user.app_metadata?.role;

  if (explicitRoleValue(metadataRole)) {
    const profile: UserProfile = {
      id: user.id,
      email: user.email || '',
      full_name:
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email ||
        'User',
      role: normalizeRole(metadataRole),
      created_at: '',
      updated_at: '',
    };

    writeCachedOpcAuthProfile(profile);
    return profile;
  }

  return cachedProfile || null;
}

export async function refreshOpcAuthProfile(
  force = false,
): Promise<UserProfile | null> {
  cleanupLegacyAuthCaches();
  const cachedProfile = readCachedOpcAuthProfile();

  if (
    !force &&
    cachedProfile &&
    (
      Date.now() - lastAuthProfileRefreshAt <
        AUTH_PROFILE_REFRESH_COOLDOWN_MS ||
      sharedAuthRefreshIsRecent()
    )
  ) {
    return cachedProfile;
  }

  if (authProfileRequestInFlight) return authProfileRequestInFlight;

  lastAuthProfileRefreshAt = Date.now();
  markSharedAuthRefresh();

  authProfileRequestInFlight = fetchLiveOpcAuthProfile(cachedProfile)
    .catch((error) => {
      if (cachedProfile) {
        console.warn(
          '[OPC Auth] Live-Profil nicht erreichbar; Cache wird verwendet.',
          String((error as any)?.message || error || ''),
        );
        return cachedProfile;
      }

      console.warn(
        '[OPC Auth] Profil konnte nicht geladen werden.',
        String((error as any)?.message || error || ''),
      );
      return null;
    })
    .finally(() => {
      authProfileRequestInFlight = null;
    });

  return authProfileRequestInFlight;
}

export async function loadOpcAuthProfile(): Promise<UserProfile | null> {
  cleanupLegacyAuthCaches();
  const cachedProfile = readCachedOpcAuthProfile();

  // Shell, router and sidebar render immediately from one persistent cache.
  if (cachedProfile && !isExplicitlyLoggedOut()) {
    if (
      !authProfileRequestInFlight &&
      Date.now() - lastAuthProfileRefreshAt >= AUTH_PROFILE_REFRESH_COOLDOWN_MS
    ) {
      void refreshOpcAuthProfile();
    }

    return cachedProfile;
  }

  // First login without cache: all callers share exactly one request.
  return refreshOpcAuthProfile(true);
}
