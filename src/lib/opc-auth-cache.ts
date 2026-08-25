import { supabase, type UserProfile, type UserRole } from './supabase';

/**
 * Persistent OPC profile cache.
 *
 * The cache is UI metadata only. It may make navigation faster and preserve
 * labels while a device is offline, but it must never create an authenticated
 * state on its own. A persisted Supabase session for the same user is required
 * before cached permissions are trusted.
 */
const AUTH_CACHE_KEY = 'opc:auth-profile-cache:v5:persistent';
const LEGACY_AUTH_CACHE_KEYS = [
  'opc:auth-profile-cache',
  'opc:auth-profile-cache:v2',
  'opc:auth-profile-cache:v3',
  'opc:auth-profile-cache:v4:persistent',
];
const AUTH_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const AUTH_PROFILE_NETWORK_TIMEOUT_MS = 4500;
const AUTH_PROFILE_REFRESH_COOLDOWN_MS = 60_000;
const AUTH_PROFILE_SHARED_REFRESH_KEY = 'opc:auth-profile-refresh-at:v1';
const AUTH_PROFILE_SHARED_REFRESH_COOLDOWN_MS = 5 * 60_000;
const ACTIVE_STAFF_STATUSES = ['active', 'aktiv', 'enabled'];

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

let authProfileRequestInFlight: Promise<UserProfile | null> | null = null;
let lastAuthProfileRefreshAt = 0;

function isBrowser() {
  return typeof window !== 'undefined';
}

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
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

  if (role === 'godmode' || role === 'owner') return 'owner';
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

  // Preserve the existing dispatch-admin compatibility behavior while the
  // permission model is being centralized server-side.
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
  if (isOffline()) return true;

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

function withAuthTimeout<T>(
  request: PromiseLike<T>,
  label: string,
  timeoutMs = AUTH_PROFILE_NETWORK_TIMEOUT_MS,
): Promise<T> {
  return Promise.race([
    Promise.resolve(request),
    new Promise<T>((_, reject) => {
      globalThis.setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
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
      opc_staff_role_id: cached.opc_staff_role_id || cached.staff_id || null,
      employee_id: cached.employee_id || null,
      can_manage_jobs: cached.can_manage_jobs === true,
      can_view_all_jobs: cached.can_view_all_jobs === true,
      can_manage_calendar: cached.can_manage_calendar === true,
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
    // Cache cleanup must not block the app.
  }
}

function sharedAuthRefreshIsRecent() {
  if (!isBrowser()) return false;

  try {
    const value = Number(window.localStorage.getItem(AUTH_PROFILE_SHARED_REFRESH_KEY) || 0);
    return (
      Number.isFinite(value) &&
      value > 0 &&
      Date.now() - value < AUTH_PROFILE_SHARED_REFRESH_COOLDOWN_MS
    );
  } catch {
    return false;
  }
}

function markSharedAuthRefresh() {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(AUTH_PROFILE_SHARED_REFRESH_KEY, String(Date.now()));
  } catch {
    // The in-memory cooldown remains available.
  }
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
    const serialized = JSON.stringify({ savedAt: Date.now(), profile } satisfies AuthCachePayload);
    window.localStorage.setItem(AUTH_CACHE_KEY, serialized);
    window.sessionStorage.setItem(AUTH_CACHE_KEY, serialized);

    const legacyProfile = {
      id: profile.id,
      email: profile.email,
      name: profile.full_name,
      full_name: profile.full_name,
      username: profile.full_name || profile.email || 'User',
      role: profile.role,
      opc_staff_role_id: profile.opc_staff_role_id || null,
      staff_id: profile.opc_staff_role_id || null,
      employee_id: profile.employee_id || null,
      can_manage_jobs: profile.can_manage_jobs === true,
      can_view_all_jobs: profile.can_view_all_jobs === true,
      can_manage_calendar: profile.can_manage_calendar === true,
    };

    // Keep these during the transition because older pages still read them.
    window.localStorage.setItem('mco_user_role', profile.role);
    window.localStorage.setItem('mco_user_data', JSON.stringify(legacyProfile));
    window.localStorage.setItem('mco_auth', JSON.stringify(legacyProfile));
  } catch {
    // Cache failure must not block the app.
  }
}

export function clearCachedOpcAuthProfile() {
  if (!isBrowser()) return;

  try {
    window.sessionStorage.removeItem(AUTH_CACHE_KEY);
    window.localStorage.removeItem(AUTH_CACHE_KEY);
    window.localStorage.removeItem(AUTH_PROFILE_SHARED_REFRESH_KEY);
    for (const key of LEGACY_AUTH_CACHE_KEYS) {
      window.sessionStorage.removeItem(key);
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage cleanup failures.
  }
}

async function getPersistedSessionUserId(): Promise<string | null> {
  try {
    const {
      data: { session },
      error,
    } = await withAuthTimeout(supabase.auth.getSession(), 'Supabase session', 3500);

    if (error) {
      if (isOffline()) return readCachedOpcAuthProfile()?.id || null;
      return null;
    }

    return session?.user?.id || null;
  } catch (error) {
    if (isOffline() && isNetworkLikeError(error)) return readCachedOpcAuthProfile()?.id || null;
    return null;
  }
}

async function fetchActiveStaffRoleByUser(
  userId: string,
  email?: string | null,
): Promise<StaffRoleRow | null> {
  // Only select columns that are proven to exist in the checked-in production
  // schema history. Optional compatibility permissions remain in cached or
  // legacy profile metadata until the live schema audit verifies them.
  const fields =
    'id,user_id,employee_id,role,display_name,email,status,can_access_portal,can_manage_jobs,can_view_all_jobs';

  const byUser = await withAuthTimeout(
    supabase
      .from('opc_staff_roles')
      .select(fields)
      .eq('user_id', userId)
      .in('status', ACTIVE_STAFF_STATUSES)
      .eq('can_access_portal', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    'opc_staff_roles by user',
  );

  if (!byUser.error && byUser.data) return byUser.data as StaffRoleRow;
  if (byUser.error && isNetworkLikeError(byUser.error)) throw byUser.error;
  if (!email) return null;

  const byEmail = await withAuthTimeout(
    supabase
      .from('opc_staff_roles')
      .select(fields)
      .ilike('email', email)
      .in('status', ACTIVE_STAFF_STATUSES)
      .eq('can_access_portal', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    'opc_staff_roles by email',
  );

  if (!byEmail.error && byEmail.data) return byEmail.data as StaffRoleRow;
  if (byEmail.error && isNetworkLikeError(byEmail.error)) throw byEmail.error;
  return null;
}

async function fetchLiveOpcAuthProfile(cachedProfile: UserProfile | null): Promise<UserProfile | null> {
  const {
    data: { session },
    error: sessionError,
  } = await withAuthTimeout(supabase.auth.getSession(), 'Supabase session', 3500);

  if (sessionError) {
    if (isOffline() && cachedProfile) return cachedProfile;
    return null;
  }

  const user = session?.user || null;
  if (!user) return null;

  // A cache from another user must never cross an account boundary.
  const sameUserCache = cachedProfile?.id === user.id ? cachedProfile : null;

  const [staffRoleResult, legacyProfileResult] = await Promise.allSettled([
    fetchActiveStaffRoleByUser(user.id, user.email),
    withAuthTimeout(
      supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
      'user_profiles',
    ),
  ]);

  const staffRole = staffRoleResult.status === 'fulfilled' ? staffRoleResult.value : null;
  const legacyQuery = legacyProfileResult.status === 'fulfilled' ? legacyProfileResult.value : null;
  const legacyProfile = legacyQuery && !legacyQuery.error ? legacyQuery.data || null : null;
  const legacyRole = normalizeLegacyProfileRole(legacyProfile);

  if (staffRole) {
    let employeeName = '';
    let employeeEmail = '';

    if (staffRole.employee_id && (!staffRole.display_name || !staffRole.email)) {
      try {
        const employeeResult = await withAuthTimeout(
          supabase.from('employees').select('full_name,email').eq('id', staffRole.employee_id).maybeSingle(),
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
      opc_staff_role_id: staffRole.id || null,
      employee_id: staffRole.employee_id || null,
      can_manage_jobs: staffRole.can_manage_jobs === true,
      can_view_all_jobs: staffRole.can_view_all_jobs === true,
      can_manage_calendar:
        sameUserCache?.can_manage_calendar === true ||
        (legacyProfile as any)?.can_manage_calendar === true,
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

  // Only use stale profile metadata when a real session for the same user
  // exists and the role source was temporarily unavailable.
  const liveLookupHadNetworkFailure =
    (staffRoleResult.status === 'rejected' && isNetworkLikeError(staffRoleResult.reason)) ||
    (legacyProfileResult.status === 'rejected' && isNetworkLikeError(legacyProfileResult.reason));

  if (sameUserCache && liveLookupHadNetworkFailure) return sameUserCache;
  return null;
}

export async function refreshOpcAuthProfile(force = false): Promise<UserProfile | null> {
  cleanupLegacyAuthCaches();

  if (isExplicitlyLoggedOut()) return null;

  const cachedProfile = readCachedOpcAuthProfile();
  const sessionUserId = await getPersistedSessionUserId();

  if (!sessionUserId) {
    if (!isOffline()) clearCachedOpcAuthProfile();
    return null;
  }

  const sameUserCache = cachedProfile?.id === sessionUserId ? cachedProfile : null;

  if (
    !force &&
    sameUserCache &&
    (Date.now() - lastAuthProfileRefreshAt < AUTH_PROFILE_REFRESH_COOLDOWN_MS || sharedAuthRefreshIsRecent())
  ) {
    return sameUserCache;
  }

  if (authProfileRequestInFlight) return authProfileRequestInFlight;

  lastAuthProfileRefreshAt = Date.now();
  markSharedAuthRefresh();

  authProfileRequestInFlight = fetchLiveOpcAuthProfile(sameUserCache)
    .catch((error) => {
      if (sameUserCache && isOffline() && isNetworkLikeError(error)) {
        return sameUserCache;
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

  if (isExplicitlyLoggedOut()) return null;

  const cachedProfile = readCachedOpcAuthProfile();
  const sessionUserId = await getPersistedSessionUserId();

  if (!sessionUserId) {
    if (!isOffline()) clearCachedOpcAuthProfile();
    return null;
  }

  if (cachedProfile?.id === sessionUserId) {
    if (
      !authProfileRequestInFlight &&
      Date.now() - lastAuthProfileRefreshAt >= AUTH_PROFILE_REFRESH_COOLDOWN_MS
    ) {
      void refreshOpcAuthProfile();
    }

    return cachedProfile;
  }

  // First login, changed account, or stale cache: resolve the live profile.
  return refreshOpcAuthProfile(true);
}
