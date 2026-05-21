import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function getEnvValue(key: string) {
  const importMetaEnv = (import.meta as any)?.env || {};
  const processEnv = (globalThis as any)?.process?.env || {};

  return importMetaEnv[key] || processEnv[key] || '';
}

function getSupabaseConfig() {
  const supabaseUrl =
    getEnvValue('PUBLIC_SUPABASE_URL') ||
    getEnvValue('SUPABASE_URL');

  const anonKey = getEnvValue('PUBLIC_SUPABASE_ANON_KEY');

  const serviceRoleKey =
    getEnvValue('SUPABASE_SERVICE_ROLE_KEY') ||
    getEnvValue('SUPABASE_SERVICE_ROLE') ||
    getEnvValue('SUPABASE_SERVICE_KEY');

  if (!supabaseUrl) {
    throw new Error('PUBLIC_SUPABASE_URL or SUPABASE_URL is missing.');
  }

  if (!anonKey) {
    throw new Error('PUBLIC_SUPABASE_ANON_KEY is missing.');
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing.');
  }

  return {
    supabaseUrl,
    anonKey,
    serviceRoleKey,
  };
}

function getAdminSupabase() {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'X-OPC-Route': 'resolve-login',
      },
    },
  });
}

function getAuthSupabase() {
  const { supabaseUrl, anonKey } = getSupabaseConfig();

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'X-OPC-Route': 'resolve-login-auth',
      },
    },
  });
}

function parseCookieHeader(cookieHeader: string) {
  const parsedCookies: Record<string, string> = {};

  cookieHeader.split(';').forEach((part) => {
    const index = part.indexOf('=');
    if (index === -1) return;

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    if (!key) return;

    parsedCookies[key] = value;
  });

  return parsedCookies;
}

function normaliseToken(value: unknown) {
  if (!value) return '';

  let token = String(value).trim();

  if (!token) return '';

  try {
    token = decodeURIComponent(token);
  } catch {
    // Keep original token.
  }

  token = token.replace(/^Bearer\s+/i, '').trim();

  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }

  try {
    const parsed = JSON.parse(token);

    if (typeof parsed === 'string') return normaliseToken(parsed);
    if (parsed?.access_token) return normaliseToken(parsed.access_token);
    if (parsed?.currentSession?.access_token) return normaliseToken(parsed.currentSession.access_token);
    if (parsed?.session?.access_token) return normaliseToken(parsed.session.access_token);
    if (Array.isArray(parsed) && parsed[0]) return normaliseToken(parsed[0]);
  } catch {
    // Not JSON. Continue.
  }

  return token;
}

async function getAuthenticatedUser(request: Request, cookies: any, authSupabase: any) {
  const authHeader =
    request.headers.get('authorization') ||
    request.headers.get('Authorization') ||
    '';

  const candidates = [
    { source: 'authorization_header', token: normaliseToken(authHeader) },
    { source: 'astro_cookie:sb-access-token', token: normaliseToken(cookies.get('sb-access-token')?.value) },
  ].filter((candidate) => Boolean(candidate.token));

  const parsedCookies = parseCookieHeader(request.headers.get('cookie') || '');

  for (const [cookieName, cookieValue] of Object.entries(parsedCookies)) {
    const lowerName = cookieName.toLowerCase();

    if (
      lowerName.includes('access') ||
      lowerName.includes('auth') ||
      lowerName.startsWith('sb-')
    ) {
      candidates.push({
        source: `cookie_header:${cookieName}`,
        token: normaliseToken(cookieValue),
      });
    }
  }

  const seen = new Set<string>();
  const uniqueCandidates = candidates.filter((candidate) => {
    if (!candidate.token || seen.has(candidate.token)) return false;
    seen.add(candidate.token);
    return true;
  });

  if (uniqueCandidates.length === 0) {
    throw new Error('Not authenticated');
  }

  const errors: Array<{ source: string; message: string }> = [];

  for (const candidate of uniqueCandidates) {
    const { data, error } = await authSupabase.auth.getUser(candidate.token);

    if (!error && data?.user) {
      return {
        user: data.user,
        source: candidate.source,
      };
    }

    errors.push({
      source: candidate.source,
      message: error?.message || 'No user returned',
    });
  }

  console.error('[opc/resolve-login] Authentication failed:', errors);

  throw new Error('Invalid authentication');
}

async function linkClientUserByEmailIfMissing(supabaseAdmin: any, user: any) {
  const email = String(user.email || '').trim().toLowerCase();

  if (!email) return null;

  const { data: clientUser, error } = await supabaseAdmin
    .from('opc_client_users')
    .select('id, user_id, client_id, email, status, can_access_client_portal')
    .ilike('email', email)
    .is('user_id', null)
    .eq('can_access_client_portal', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[opc/resolve-login] Client user email link lookup failed:', error.message);
    return null;
  }

  if (!clientUser?.id) return null;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('opc_client_users')
    .update({
      user_id: user.id,
      status: clientUser.status === 'active' ? 'active' : 'invited',
      updated_at: new Date().toISOString(),
      metadata: {
        source: 'resolve_login_email_link',
        auth_user_id: user.id,
        linked_at: new Date().toISOString(),
      },
    })
    .eq('id', clientUser.id)
    .select('id, user_id, client_id, email, status, can_access_client_portal')
    .single();

  if (updateError) {
    console.warn('[opc/resolve-login] Client user email link update failed:', updateError.message);
    return null;
  }

  return updated;
}

async function resolveStaffAccess(supabaseAdmin: any, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('opc_staff_roles')
    .select('id, role, display_name, email, status, can_access_portal')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Staff role lookup failed: ${error.message}`);
  }

  if (!data || data.can_access_portal !== true) return null;

  return data;
}

async function resolveClientAccess(supabaseAdmin: any, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('opc_client_users')
    .select(
      'id, client_id, contact_id, role, status, display_name, email, can_access_client_portal'
    )
    .eq('user_id', userId)
    .eq('can_access_client_portal', true)
    .in('status', ['active', 'invited'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Client portal user lookup failed: ${error.message}`);
  }

  if (!data) return null;

  const now = new Date().toISOString();

  await supabaseAdmin
    .from('opc_client_users')
    .update({
      status: 'active',
      activated_at: data.status === 'active' ? undefined : now,
      last_login_at: now,
      updated_at: now,
    })
    .eq('id', data.id);

  return {
    ...data,
    status: 'active',
  };
}

async function resolveLegacyAccess(supabaseAdmin: any, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('id, email, role, name, full_name, can_access_portal')
    .eq('id', userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[opc/resolve-login] Legacy profile lookup failed:', error.message);
    return null;
  }

  if (!data) return null;
  if (data.can_access_portal === false) return null;

  const role = String(data.role || '').toLowerCase();

  if (!['owner', 'admin', 'dispatch', 'dispatcher', 'employee', 'client'].includes(role)) {
    return null;
  }

  return data;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const supabaseAdmin = getAdminSupabase();
    const authSupabase = getAuthSupabase();
    const authResult = await getAuthenticatedUser(request, cookies, authSupabase);
    const user = authResult.user;

    await linkClientUserByEmailIfMissing(supabaseAdmin, user);

    const staff = await resolveStaffAccess(supabaseAdmin, user.id);

    if (staff) {
      return jsonResponse({
        success: true,
        accessType: 'staff',
        role: staff.role || 'staff',
        redirectTo: '/dashboard',
        authenticatedVia: authResult.source,
        user: {
          id: user.id,
          email: user.email,
          name: staff.display_name || user.email,
        },
      });
    }

    const clientUser = await resolveClientAccess(supabaseAdmin, user.id);

    if (clientUser) {
      return jsonResponse({
        success: true,
        accessType: 'client',
        role: clientUser.role || 'client',
        redirectTo: '/kundenportal',
        authenticatedVia: authResult.source,
        user: {
          id: user.id,
          email: user.email,
          name: clientUser.display_name || user.email,
        },
        clientId: clientUser.client_id,
        clientUserId: clientUser.id,
      });
    }

    const legacy = await resolveLegacyAccess(supabaseAdmin, user.id);

    if (legacy) {
      return jsonResponse({
        success: true,
        accessType: 'legacy',
        role: legacy.role || 'client',
        redirectTo: '/dashboard',
        authenticatedVia: authResult.source,
        user: {
          id: user.id,
          email: user.email,
          name: legacy.full_name || legacy.name || user.email,
        },
      });
    }

    return jsonResponse(
      {
        success: false,
        error: 'Für diesen Benutzer ist kein Orange Pro Clean Portalzugriff freigeschaltet.',
      },
      403
    );
  } catch (error: any) {
    console.error('[opc/resolve-login] failed:', error);

    const message = error?.message || 'Login konnte nicht geprüft werden.';

    const status =
      message === 'Not authenticated' || message === 'Invalid authentication'
        ? 401
        : 500;

    return jsonResponse(
      {
        success: false,
        error: message,
      },
      status
    );
  }
};

export const GET: APIRoute = async () => {
  try {
    const { supabaseUrl } = getSupabaseConfig();

    return jsonResponse({
      success: true,
      route: 'opc/resolve-login',
      status: 'live',
      projectHost: (() => {
        try {
          return new URL(supabaseUrl).host;
        } catch {
          return 'invalid-url';
        }
      })(),
    });
  } catch (error: any) {
    return jsonResponse(
      {
        success: false,
        error: error?.message || 'Route configuration error.',
      },
      500
    );
  }
};
