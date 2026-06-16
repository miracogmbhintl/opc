import type { APIContext } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { getOpcServerEnvValue } from '../../../lib/opc-server-env';

export const prerender = false;

type ProfileSource = {
  source: string;
  token: string;
};

type AuthResult = {
  user: any;
  authenticatedVia: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function clean(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeEmail(value: unknown) {
  const email = clean(value);
  return email ? email.toLowerCase() : null;
}

function isValidEmail(email: string | null) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getEnvValue(locals: any, key: string) {
  return getOpcServerEnvValue(locals, key);
}

function decodeBase64Url(input: string) {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

  if (typeof atob === 'function') {
    return atob(padded);
  }

  const BufferCtor = (globalThis as any).Buffer;
  if (BufferCtor) {
    return BufferCtor.from(padded, 'base64').toString('utf8');
  }

  throw new Error('No base64 decoder available.');
}

function decodeJwtPayload(token: string) {
  try {
    if (!token.startsWith('eyJ')) return null;

    const parts = token.split('.');

    if (parts.length < 2) return null;

    return JSON.parse(decodeBase64Url(parts[1]));
  } catch {
    return null;
  }
}

function assertServiceRoleKey(serviceRoleKey: string) {
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing.');
  }

  const lowerKey = serviceRoleKey.toLowerCase();

  if (serviceRoleKey.startsWith('sb_publishable_') || lowerKey.includes('anon')) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not a service-role key. It looks like an anon or publishable key.'
    );
  }

  const jwtPayload = decodeJwtPayload(serviceRoleKey);
  const role = String(jwtPayload?.role || '').toLowerCase();

  if (role && role !== 'service_role') {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY has wrong JWT role "${role}". Expected "service_role".`
    );
  }
}

function getSupabaseConfig(locals: any) {
  const supabaseUrl =
    getEnvValue(locals, 'PUBLIC_SUPABASE_URL') ||
    getEnvValue(locals, 'SUPABASE_URL');

  const anonKey = getEnvValue(locals, 'PUBLIC_SUPABASE_ANON_KEY');

  const serviceRoleKey =
    getEnvValue(locals, 'SUPABASE_SERVICE_ROLE_KEY') ||
    getEnvValue(locals, 'SUPABASE_SERVICE_ROLE') ||
    getEnvValue(locals, 'SUPABASE_SERVICE_KEY');

  if (!supabaseUrl) {
    throw new Error('PUBLIC_SUPABASE_URL or SUPABASE_URL is missing.');
  }

  if (!anonKey) {
    throw new Error('PUBLIC_SUPABASE_ANON_KEY is missing.');
  }

  assertServiceRoleKey(serviceRoleKey);

  return {
    supabaseUrl,
    anonKey,
    serviceRoleKey,
  };
}

function getAdminSupabase(locals: any) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig(locals);

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'X-OPC-Route': 'grant-client-portal-access',
      },
    },
  });
}

function getAuthSupabase(locals: any) {
  const { supabaseUrl, anonKey } = getSupabaseConfig(locals);

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'X-OPC-Route': 'grant-client-portal-access-auth',
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

function decodeMaybe(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizePossibleAccessToken(value: unknown) {
  if (!value) return '';

  let token = String(value).trim();

  if (!token) return '';

  token = decodeMaybe(token);
  token = token.replace(/^Bearer\s+/i, '').trim();

  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }

  try {
    const parsed = JSON.parse(token);

    if (typeof parsed === 'string') {
      return normalizePossibleAccessToken(parsed);
    }

    if (parsed?.access_token) {
      return normalizePossibleAccessToken(parsed.access_token);
    }

    if (parsed?.currentSession?.access_token) {
      return normalizePossibleAccessToken(parsed.currentSession.access_token);
    }

    if (parsed?.session?.access_token) {
      return normalizePossibleAccessToken(parsed.session.access_token);
    }

    if (Array.isArray(parsed) && parsed[0]) {
      return normalizePossibleAccessToken(parsed[0]);
    }
  } catch {
    // Not JSON. Continue.
  }

  return token;
}

function normalizePossibleRefreshToken(value: unknown) {
  if (!value) return '';

  let token = String(value).trim();

  if (!token) return '';

  token = decodeMaybe(token);

  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }

  try {
    const parsed = JSON.parse(token);

    if (typeof parsed === 'string') {
      return normalizePossibleRefreshToken(parsed);
    }

    if (parsed?.refresh_token) {
      return normalizePossibleRefreshToken(parsed.refresh_token);
    }

    if (parsed?.currentSession?.refresh_token) {
      return normalizePossibleRefreshToken(parsed.currentSession.refresh_token);
    }

    if (parsed?.session?.refresh_token) {
      return normalizePossibleRefreshToken(parsed.session.refresh_token);
    }

    if (Array.isArray(parsed) && parsed[1]) {
      return normalizePossibleRefreshToken(parsed[1]);
    }
  } catch {
    // Not JSON. Continue.
  }

  return token;
}

function addAccessCandidate(
  candidates: ProfileSource[],
  seen: Set<string>,
  source: string,
  rawToken: unknown
) {
  const token = normalizePossibleAccessToken(rawToken);

  if (!token || seen.has(token)) return;

  seen.add(token);
  candidates.push({ source, token });
}

function addRefreshCandidate(
  candidates: ProfileSource[],
  seen: Set<string>,
  source: string,
  rawToken: unknown
) {
  const token = normalizePossibleRefreshToken(rawToken);

  if (!token || seen.has(token)) return;

  seen.add(token);
  candidates.push({ source, token });
}

function setSessionCookies(cookies: any, session: any) {
  const accessToken = session?.access_token;
  const refreshToken = session?.refresh_token;

  if (accessToken) {
    cookies.set('sb-access-token', accessToken, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60,
    });
  }

  if (refreshToken) {
    cookies.set('sb-refresh-token', refreshToken, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

async function getAuthenticatedUser(
  request: Request,
  cookies: any,
  authSupabase: any
): Promise<AuthResult> {
  const accessCandidates: ProfileSource[] = [];
  const refreshCandidates: ProfileSource[] = [];
  const seenAccess = new Set<string>();
  const seenRefresh = new Set<string>();

  const authHeader =
    request.headers.get('authorization') ||
    request.headers.get('Authorization') ||
    '';

  addAccessCandidate(accessCandidates, seenAccess, 'authorization_header', authHeader);

  const accessCookieNames = [
    'sb-access-token',
    'supabase-access-token',
    'access_token',
    'access-token',
    'opc-access-token',
    'opc_access_token',
  ];

  const refreshCookieNames = [
    'sb-refresh-token',
    'supabase-refresh-token',
    'refresh_token',
    'refresh-token',
    'opc-refresh-token',
    'opc_refresh_token',
  ];

  for (const cookieName of accessCookieNames) {
    addAccessCandidate(
      accessCandidates,
      seenAccess,
      `astro_cookie:${cookieName}`,
      cookies.get(cookieName)?.value
    );
  }

  for (const cookieName of refreshCookieNames) {
    addRefreshCandidate(
      refreshCandidates,
      seenRefresh,
      `astro_cookie:${cookieName}`,
      cookies.get(cookieName)?.value
    );
  }

  const rawCookieHeader = request.headers.get('cookie') || '';
  const parsedCookies = parseCookieHeader(rawCookieHeader);

  for (const [cookieName, cookieValue] of Object.entries(parsedCookies)) {
    const lowerName = cookieName.toLowerCase();

    if (lowerName.includes('refresh')) {
      addRefreshCandidate(refreshCandidates, seenRefresh, `cookie_header:${cookieName}`, cookieValue);
      continue;
    }

    if (
      lowerName.includes('access') ||
      lowerName.includes('auth') ||
      lowerName.startsWith('sb-')
    ) {
      addAccessCandidate(accessCandidates, seenAccess, `cookie_header:${cookieName}`, cookieValue);
    }

    if (lowerName.includes('auth') || lowerName.startsWith('sb-')) {
      addRefreshCandidate(refreshCandidates, seenRefresh, `cookie_header:${cookieName}`, cookieValue);
    }
  }

  const accessErrors: Array<{ source: string; message: string }> = [];
  const refreshErrors: Array<{ source: string; message: string }> = [];

  for (const candidate of accessCandidates) {
    const result = await authSupabase.auth.getUser(candidate.token);
    const user = result?.data?.user || null;
    const error = result?.error || null;

    if (!error && user) {
      return {
        user,
        authenticatedVia: candidate.source,
      };
    }

    accessErrors.push({
      source: candidate.source,
      message: error?.message || 'No user returned',
    });
  }

  for (const candidate of refreshCandidates) {
    const result = await authSupabase.auth.refreshSession({
      refresh_token: candidate.token,
    });

    const user = result?.data?.user || result?.data?.session?.user || null;
    const session = result?.data?.session || null;
    const error = result?.error || null;

    if (!error && user && session?.access_token) {

      setSessionCookies(cookies, session);

      return {
        user,
        authenticatedVia: candidate.source,
      };
    }

    refreshErrors.push({
      source: candidate.source,
      message: error?.message || 'No user/session returned',
    });
  }

  if (accessCandidates.length === 0 && refreshCandidates.length === 0) {
    console.error('[grant-client-portal-access] No auth token candidates found.', {
      hasAuthorizationHeader: Boolean(authHeader),
      cookieNames: Object.keys(parsedCookies),
    });

    throw new Error('Not authenticated');
  }

  console.error('[grant-client-portal-access] Authentication failed:', {
    accessCandidatesChecked: accessCandidates.map((candidate) => candidate.source),
    refreshCandidatesChecked: refreshCandidates.map((candidate) => candidate.source),
    accessErrors,
    refreshErrors,
  });

  throw new Error('Invalid authentication');
}

async function assertCanManageClients(supabase: any, userId: string) {
  const { data: staffRole, error: staffRoleError } = await supabase
    .from('opc_staff_roles')
    .select(
      'id, role, status, can_access_portal, can_manage_clients, can_manage_onboarding'
    )
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (staffRoleError) {
    throw new Error(`Staff role lookup failed: ${staffRoleError.message}`);
  }

  const opcRole = String(staffRole?.role || '').toLowerCase();

  if (
    staffRole &&
    staffRole.can_access_portal === true &&
    (
      staffRole.can_manage_clients === true ||
      staffRole.can_manage_onboarding === true ||
      ['owner', 'admin', 'dispatch'].includes(opcRole)
    )
  ) {
    return {
      source: 'opc_staff_roles',
      role: opcRole || 'staff',
    };
  }

  const { data: legacyProfile, error: legacyProfileError } = await supabase
    .from('user_profiles')
    .select('id, role')
    .eq('id', userId)
    .limit(1)
    .maybeSingle();

  if (legacyProfileError) {
    console.warn(
      '[grant-client-portal-access] Legacy profile lookup failed:',
      legacyProfileError.message
    );
  }

  const legacyRole = String(legacyProfile?.role || '').toLowerCase();

  if (['owner', 'admin', 'dispatch'].includes(legacyRole)) {
    return {
      source: 'user_profiles',
      role: legacyRole,
    };
  }

  throw new Error('Insufficient permissions');
}

function getRequestOrigin(request: Request) {
  const envOrigin =
    getEnvValue({}, 'PUBLIC_SITE_URL') ||
    getEnvValue({}, 'PUBLIC_APP_URL') ||
    getEnvValue({}, 'PUBLIC_BASE_URL') ||
    getEnvValue({}, 'SITE_URL');

  if (envOrigin) return envOrigin.replace(/\/+$/, '');

  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function getClientPortalRedirectUrl(request: Request, locals: any) {
  const explicit =
    getEnvValue(locals, 'CLIENT_PORTAL_REDIRECT_URL') ||
    getEnvValue(locals, 'PUBLIC_CLIENT_PORTAL_URL');

  if (explicit) return explicit;

  return `${getRequestOrigin(request)}/kundenportal`;
}

function isPrivateClientType(clientType: unknown) {
  const type = String(clientType || '').trim().toLowerCase();

  return [
    'privat',
    'private',
    'privatkunden',
    'private_client',
    'regular_private',
  ].includes(type);
}

async function findAuthUserByEmail(supabaseAdmin: any, email: string) {
  const targetEmail = email.toLowerCase();
  let page = 1;
  const perPage = 100;

  while (page <= 20) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Auth user lookup failed: ${error.message}`);
    }

    const users = data?.users || [];
    const match = users.find((user: any) => String(user.email || '').toLowerCase() === targetEmail);

    if (match) return match;

    if (users.length < perPage) return null;

    page += 1;
  }

  return null;
}

async function inviteOrFindAuthUser({
  supabaseAdmin,
  email,
  displayName,
  clientId,
  contactId,
  redirectTo,
}: {
  supabaseAdmin: any;
  email: string;
  displayName: string;
  clientId: string;
  contactId: string | null;
  redirectTo: string;
}) {
  const existingAuthUser = await findAuthUserByEmail(supabaseAdmin, email);

  if (existingAuthUser) {
    const { data: updated, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      existingAuthUser.id,
      {
        user_metadata: {
          ...(existingAuthUser.user_metadata || {}),
          display_name: displayName,
          full_name: displayName,
          opc_role: 'client',
          opc_client_id: clientId,
          opc_contact_id: contactId,
          portal: 'orange_pro_clean',
        },
        app_metadata: {
          ...(existingAuthUser.app_metadata || {}),
          opc_role: 'client',
          opc_client_id: clientId,
        },
      }
    );

    if (updateError) {
      throw new Error(`Auth user metadata update failed: ${updateError.message}`);
    }

    return {
      user: updated?.user || existingAuthUser,
      inviteSent: false,
      authAction: 'existing_user_linked',
    };
  }

  const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo,
      data: {
        display_name: displayName,
        full_name: displayName,
        opc_role: 'client',
        opc_client_id: clientId,
        opc_contact_id: contactId,
        portal: 'orange_pro_clean',
      },
    }
  );

  if (!inviteError && invited?.user) {
    return {
      user: invited.user,
      inviteSent: true,
      authAction: 'invite_sent',
    };
  }

  const message = String(inviteError?.message || '').toLowerCase();

  if (
    message.includes('already') ||
    message.includes('registered') ||
    message.includes('exists')
  ) {
    const fallbackUser = await findAuthUserByEmail(supabaseAdmin, email);

    if (fallbackUser) {
      return {
        user: fallbackUser,
        inviteSent: false,
        authAction: 'existing_user_found_after_invite_conflict',
      };
    }
  }

  throw new Error(`Client auth invite failed: ${inviteError?.message || 'Unknown Supabase auth error'}`);
}

async function logClientActivity({
  supabaseAdmin,
  clientId,
  contactId,
  clientUserId,
  authUserId,
  portalStatus,
  authAction,
  invitedBy,
}: {
  supabaseAdmin: any;
  clientId: string;
  contactId: string | null;
  clientUserId: string;
  authUserId: string | null;
  portalStatus: string;
  authAction: string;
  invitedBy: string;
}) {
  const { error } = await supabaseAdmin
    .from('opc_client_activity')
    .insert({
      client_id: clientId,
      contact_id: contactId,
      activity_type: 'portal_access_granted',
      message: 'Portalzugang wurde über die Kundenübersicht freigeschaltet.',
      created_by: invitedBy,
      metadata: {
        source: 'clients_page',
        client_user_id: clientUserId,
        auth_user_id: authUserId,
        status: portalStatus,
        auth_action: authAction,
      },
    });

  if (error) {
    console.warn('[grant-client-portal-access] Activity was not created:', error.message);
  }
}

export async function POST({ request, locals, cookies }: APIContext) {
  const requestId = Date.now().toString(36);

  try {
    const supabaseAdmin = getAdminSupabase(locals);
    const authSupabase = getAuthSupabase(locals);
    const authResult = await getAuthenticatedUser(request, cookies, authSupabase);

    await assertCanManageClients(supabaseAdmin, authResult.user.id);

    const payload = (await request.json().catch(() => ({}))) as any;
    const clientId = clean(payload?.clientId);

    if (!clientId) {
      return jsonResponse({ success: false, error: 'Missing clientId.', requestId }, 400);
    }

    const { data: client, error: clientError } = await supabaseAdmin
      .from('opc_clients')
      .select('id, contact_id, client_type, billing_name, billing_email, billing_phone_e164, status')
      .eq('id', clientId)
      .maybeSingle();

    if (clientError) {
      throw new Error(`Client lookup failed: ${clientError.message}`);
    }

    if (!client) {
      return jsonResponse({ success: false, error: 'Client not found.', requestId }, 404);
    }

    if (isPrivateClientType(client.client_type)) {
      return jsonResponse(
        {
          success: false,
          error:
            'Portalzugang ist nur für Geschäftskunden vorgesehen. Bitte den Kundentyp zuerst auf Geschäftskunde setzen.',
          requestId,
        },
        400
      );
    }

    let contact: any = null;

    if (client.contact_id) {
      const { data: contactData, error: contactError } = await supabaseAdmin
        .from('opc_contacts')
        .select('id, full_name, company_name, email, phone_raw, phone_e164')
        .eq('id', client.contact_id)
        .maybeSingle();

      if (contactError) {
        throw new Error(`Contact lookup failed: ${contactError.message}`);
      }

      contact = contactData || null;
    }

    const displayName =
      clean(contact?.full_name) ||
      clean(contact?.company_name) ||
      clean(client.billing_name) ||
      'Portal-Kunde';

    const email =
      normalizeEmail(contact?.email) ||
      normalizeEmail(client.billing_email);

    if (!isValidEmail(email)) {
      return jsonResponse(
        {
          success: false,
          error:
            'Für diesen Kunden ist keine gültige E-Mail hinterlegt. Bitte zuerst Kontakt- oder Rechnungs-E-Mail ergänzen.',
          requestId,
        },
        400
      );
    }

    const phoneRaw =
      clean(contact?.phone_raw) ||
      clean(contact?.phone_e164) ||
      clean(client.billing_phone_e164);

    const phoneE164 =
      clean(contact?.phone_e164) ||
      clean(contact?.phone_raw) ||
      clean(client.billing_phone_e164);

    const redirectTo = getClientPortalRedirectUrl(request, locals);

    const authSetup = await inviteOrFindAuthUser({
      supabaseAdmin,
      email,
      displayName,
      clientId,
      contactId: client.contact_id,
      redirectTo,
    });

    const authUserId = authSetup.user?.id || null;

    const { data: existingClientUser, error: existingClientUserError } = await supabaseAdmin
      .from('opc_client_users')
      .select('id, user_id, status')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingClientUserError) {
      throw new Error(`Portal user lookup failed: ${existingClientUserError.message}`);
    }

    const now = new Date().toISOString();

    const portalPayload = {
      client_id: clientId,
      contact_id: client.contact_id,
      user_id: authUserId,
      role: 'owner',
      status: existingClientUser?.status === 'active' ? 'active' : 'invited',
      display_name: displayName,
      email,
      phone_raw: phoneRaw,
      phone_e164: phoneE164,
      can_access_client_portal: true,
      can_view_jobs: true,
      can_view_reports: true,
      can_view_media: true,
      can_view_damage_reports: true,
      can_view_invoices: true,
      can_create_requests: true,
      can_send_messages: true,
      receives_reports: true,
      receives_invoices: true,
      receives_operations_updates: true,
      invited_at: existingClientUser?.status === 'active' ? existingClientUser?.invited_at || now : now,
      updated_at: now,
      metadata: {
        source: 'manual_portal_grant',
        auth_action: authSetup.authAction,
        auth_user_id: authUserId,
        redirect_to: redirectTo,
        invited_by: authResult.user.id,
        last_granted_at: now,
      },
    };

    let clientUserId: string;
    let portalStatus: string;

    if (existingClientUser?.id) {
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('opc_client_users')
        .update(portalPayload)
        .eq('id', existingClientUser.id)
        .select('id, status')
        .single();

      if (updateError) {
        throw new Error(`Portal user update failed: ${updateError.message}`);
      }

      clientUserId = updatedUser.id;
      portalStatus = updatedUser.status;
    } else {
      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('opc_client_users')
        .insert({
          ...portalPayload,
          created_at: now,
        })
        .select('id, status')
        .single();

      if (insertError) {
        throw new Error(`Portal user creation failed: ${insertError.message}`);
      }

      clientUserId = newUser.id;
      portalStatus = newUser.status;
    }

    const { error: clientUpdateError } = await supabaseAdmin
      .from('opc_clients')
      .update({
        client_type: client.client_type || 'geschaeftskunden',
        updated_at: now,
        metadata: {
          portal_access_created: true,
          portal_user_id: clientUserId,
          portal_auth_user_id: authUserId,
          portal_invited_at: now,
        },
      })
      .eq('id', clientId);

    if (clientUpdateError) {
      console.warn('[grant-client-portal-access] Client metadata update failed:', clientUpdateError.message);
    }

    await logClientActivity({
      supabaseAdmin,
      clientId,
      contactId: client.contact_id,
      clientUserId,
      authUserId,
      portalStatus,
      authAction: authSetup.authAction,
      invitedBy: authResult.user.id,
    });

    return jsonResponse({
      success: true,
      requestId,
      clientId,
      clientUserId,
      authUserId,
      email,
      status: portalStatus,
      inviteSent: authSetup.inviteSent,
      authAction: authSetup.authAction,
      redirectTo,
      message: authSetup.inviteSent
        ? 'Portalzugang wurde erstellt und die Einladung wurde gesendet.'
        : 'Portalzugang wurde mit einem bestehenden Auth-Benutzer verknüpft.',
    });
  } catch (error: any) {
    console.error(`[grant-client-portal-access] ${requestId} failed:`, error);

    const message = error?.message || 'Portalzugang konnte nicht erstellt werden.';

    const status =
      message === 'Not authenticated' || message === 'Invalid authentication'
        ? 401
        : message === 'Insufficient permissions'
          ? 403
          : 500;

    return jsonResponse(
      {
        success: false,
        error: message,
        requestId,
      },
      status
    );
  }
}

export async function GET({ locals }: APIContext) {
  try {
    const { supabaseUrl } = getSupabaseConfig(locals);

    return jsonResponse({
      success: true,
      route: 'opc/grant-client-portal-access',
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
        route: 'opc/grant-client-portal-access',
        error: error?.message || 'Route configuration error.',
      },
      500
    );
  }
}
