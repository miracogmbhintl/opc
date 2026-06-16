import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { getOpcServerEnvValue } from '../../../lib/opc-server-env';

export const prerender = false;

type ProfileSource = {
  source: string;
  token: string;
};

type AuthResult = {
  user: any;
  session?: any | null;
  authenticatedVia: string;
};

type UpdateClientBody = {
  clientId?: string;
  id?: string;
  resolvedClientId?: string;
  editedClient?: Record<string, any>;
  client?: Record<string, any>;
  [key: string]: any;
};

const ALLOWED_SITE_TYPES = new Set([
  'office',
  'residential',
  'construction_site',
  'staircase',
  'commercial',
  'mixed',
  'retail',
  'restaurant',
  'hotel',
  'school',
  'medical',
  'warehouse',
  'industrial',
  'other',
]);

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
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
  const text = clean(value);
  return text ? text.toLowerCase() : null;
}

function normalizeSiteType(value: unknown) {
  const text = String(value || '').trim().toLowerCase();

  if (!text) return 'other';

  const map: Record<string, string> = {
    büro: 'office',
    buero: 'office',
    office: 'office',
    privat: 'residential',
    wohnung: 'residential',
    residential: 'residential',
    baustelle: 'construction_site',
    construction: 'construction_site',
    construction_site: 'construction_site',
    treppenhaus: 'staircase',
    staircase: 'staircase',
    gewerbe: 'commercial',
    commercial: 'commercial',
    gemischt: 'mixed',
    mixed: 'mixed',
    retail: 'retail',
    restaurant: 'restaurant',
    hotel: 'hotel',
    school: 'school',
    medical: 'medical',
    warehouse: 'warehouse',
    industrial: 'industrial',
    sonstiges: 'other',
    other: 'other',
  };

  const mapped = map[text] || text;

  return ALLOWED_SITE_TYPES.has(mapped) ? mapped : 'other';
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
    getEnvValue(locals, 'SUPABASE_SERVICE_ROLE');

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

function getServerSupabase(locals: any) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig(locals);

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'X-OPC-Route': 'update-client-details',
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
        'X-OPC-Route': 'update-client-details-auth',
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
        session: null,
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
        session,
        authenticatedVia: candidate.source,
      };
    }

    refreshErrors.push({
      source: candidate.source,
      message: error?.message || 'No user/session returned',
    });
  }

  if (accessCandidates.length === 0 && refreshCandidates.length === 0) {

    throw new Error('Not authenticated');
  }

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
      '[opc/update-client-details] Legacy profile lookup failed:',
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

function pickEditedClient(body: UpdateClientBody) {
  if (body.editedClient && typeof body.editedClient === 'object') {
    return body.editedClient;
  }

  if (body.client && typeof body.client === 'object') {
    return body.client;
  }

  return body;
}

function pickClientId(body: UpdateClientBody, editedClient: Record<string, any>) {
  return clean(
    body.clientId ||
      body.resolvedClientId ||
      body.id ||
      editedClient.clientId ||
      editedClient.resolvedClientId ||
      editedClient.id
  );
}

function hasAnyContactValue(editedClient: Record<string, any>) {
  return Boolean(
    clean(editedClient.full_name) ||
      clean(editedClient.company_name) ||
      normalizeEmail(editedClient.email) ||
      normalizeEmail(editedClient.billing_email) ||
      clean(editedClient.phone_raw) ||
      clean(editedClient.phone_e164) ||
      clean(editedClient.billing_phone_e164)
  );
}

function buildClientPayload(editedClient: Record<string, any>) {
  const billingName =
    clean(editedClient.billing_name) ||
    clean(editedClient.company_name) ||
    clean(editedClient.full_name);

  if (!billingName) {
    throw new Error('Billing name is required.');
  }

  return {
    billing_name: billingName,
    billing_email:
      normalizeEmail(editedClient.billing_email) ||
      normalizeEmail(editedClient.email),
    billing_phone_e164:
      clean(editedClient.billing_phone_e164) ||
      clean(editedClient.phone_e164) ||
      clean(editedClient.phone_raw),
    billing_address: clean(editedClient.billing_address),
    internal_notes: clean(editedClient.internal_notes),
    client_type: clean(editedClient.client_type) || 'unknown',
    status: clean(editedClient.status) || 'active',
    updated_at: new Date().toISOString(),
  };
}

function buildContactPayload(editedClient: Record<string, any>) {
  return {
    full_name: clean(editedClient.full_name),
    company_name:
      clean(editedClient.company_name) ||
      clean(editedClient.billing_name),
    email:
      normalizeEmail(editedClient.email) ||
      normalizeEmail(editedClient.billing_email),
    phone_raw:
      clean(editedClient.phone_raw) ||
      clean(editedClient.phone_e164) ||
      clean(editedClient.billing_phone_e164),
    phone_e164:
      clean(editedClient.phone_e164) ||
      clean(editedClient.phone_raw) ||
      clean(editedClient.billing_phone_e164),
    updated_at: new Date().toISOString(),
  };
}

function buildSitePayload(editedClient: Record<string, any>) {
  return {
    site_name:
      clean(editedClient.primary_site_name) ||
      clean(editedClient.company_name) ||
      clean(editedClient.billing_name) ||
      'Hauptstandort',
    site_type: normalizeSiteType(editedClient.primary_site_type),
    status: 'active',
    address_text: clean(editedClient.primary_site_address),
    postal_code: clean(editedClient.primary_site_postal_code),
    city: clean(editedClient.primary_site_city),
    country: clean(editedClient.primary_site_country) || 'CH',
    is_primary: true,
    updated_at: new Date().toISOString(),
  };
}

async function getExistingClient(supabase: any, clientId: string) {
  const { data: client, error } = await supabase
    .from('opc_clients')
    .select('id, contact_id, billing_name, metadata')
    .eq('id', clientId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Client lookup failed: ${error.message}`);
  }

  if (!client) {
    throw new Error('Client not found');
  }

  return client;
}

async function getPrimarySiteId({
  supabase,
  clientId,
  editedClient,
}: {
  supabase: any;
  clientId: string;
  editedClient: Record<string, any>;
}) {
  const providedSiteId = clean(editedClient.primary_site_id);

  if (providedSiteId) {
    return providedSiteId;
  }

  const { data: primarySite, error: primarySiteError } = await supabase
    .from('opc_client_sites')
    .select('id')
    .eq('client_id', clientId)
    .eq('is_primary', true)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (primarySiteError) {
    throw new Error(`Primary site lookup failed: ${primarySiteError.message}`);
  }

  if (primarySite?.id) {
    return primarySite.id;
  }

  const { data: firstSite, error: firstSiteError } = await supabase
    .from('opc_client_sites')
    .select('id')
    .eq('client_id', clientId)
    .neq('status', 'archived')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (firstSiteError) {
    throw new Error(`Fallback site lookup failed: ${firstSiteError.message}`);
  }

  return firstSite?.id || null;
}

async function ensureContact({
  supabase,
  existingClient,
  editedClient,
  clientId,
}: {
  supabase: any;
  existingClient: any;
  editedClient: Record<string, any>;
  clientId: string;
}) {
  const existingContactId =
    clean(existingClient.contact_id) || clean(editedClient.contact_id);

  if (existingContactId) {
    return existingContactId;
  }

  if (!hasAnyContactValue(editedClient)) {
    return null;
  }

  const contactPayload = {
    ...buildContactPayload(editedClient),
    lifecycle_stage: 'client',
    source_first: 'manual_client_detail_update',
    source_last: 'manual_client_detail_update',
    metadata: {
      created_from: 'client_detail_update',
      client_id: clientId,
    },
  };

  const { data: createdContact, error: contactCreateError } = await supabase
    .from('opc_contacts')
    .insert(contactPayload)
    .select('id')
    .single();

  if (contactCreateError) {
    throw new Error(`Contact creation failed: ${contactCreateError.message}`);
  }

  const { error: clientContactLinkError } = await supabase
    .from('opc_clients')
    .update({
      contact_id: createdContact.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientId);

  if (clientContactLinkError) {
    throw new Error(
      `Client contact link update failed: ${clientContactLinkError.message}`
    );
  }

  return createdContact.id;
}

async function updateClientDetails({
  supabase,
  clientId,
  editedClient,
  userId,
}: {
  supabase: any;
  clientId: string;
  editedClient: Record<string, any>;
  userId: string;
}) {
  const existingClient = await getExistingClient(supabase, clientId);

  const contactId = await ensureContact({
    supabase,
    existingClient,
    editedClient,
    clientId,
  });

  const clientPayload = buildClientPayload(editedClient);

  const { data: updatedClient, error: clientUpdateError } = await supabase
    .from('opc_clients')
    .update(clientPayload)
    .eq('id', clientId)
    .select('id, contact_id, billing_name, status')
    .single();

  if (clientUpdateError) {
    throw new Error(`Client update failed: ${clientUpdateError.message}`);
  }

  if (contactId) {
    const contactPayload = buildContactPayload(editedClient);

    const { error: contactUpdateError } = await supabase
      .from('opc_contacts')
      .update(contactPayload)
      .eq('id', contactId);

    if (contactUpdateError) {
      throw new Error(`Contact update failed: ${contactUpdateError.message}`);
    }
  }

  const primarySiteId = await getPrimarySiteId({
    supabase,
    clientId,
    editedClient,
  });

  const sitePayload = buildSitePayload(editedClient);

  let finalPrimarySiteId = primarySiteId;

  if (primarySiteId) {
    const { data: updatedSite, error: siteUpdateError } = await supabase
      .from('opc_client_sites')
      .update(sitePayload)
      .eq('id', primarySiteId)
      .eq('client_id', clientId)
      .select('id')
      .single();

    if (siteUpdateError) {
      throw new Error(`Client site update failed: ${siteUpdateError.message}`);
    }

    finalPrimarySiteId = updatedSite.id;
  } else {
    const insertPayload = {
      ...sitePayload,
      client_id: clientId,
      contact_id: contactId,
      service_requirements: {},
      metadata: {
        source: 'client_detail_manual_edit',
        created_by: userId,
      },
    };

    const { data: newSite, error: siteInsertError } = await supabase
      .from('opc_client_sites')
      .insert(insertPayload)
      .select('id')
      .single();

    if (siteInsertError) {
      throw new Error(`Client site creation failed: ${siteInsertError.message}`);
    }

    finalPrimarySiteId = newSite.id;
  }

  if (finalPrimarySiteId) {
    const { error: demoteOtherSitesError } = await supabase
      .from('opc_client_sites')
      .update({
        is_primary: false,
        updated_at: new Date().toISOString(),
      })
      .eq('client_id', clientId)
      .neq('id', finalPrimarySiteId);

    if (demoteOtherSitesError) {
      console.warn(
        '[opc/update-client-details] Could not demote other sites:',
        demoteOtherSitesError.message
      );
    }
  }

  try {
    await supabase.from('opc_client_activity').insert({
      client_id: clientId,
      contact_id: contactId,
      activity_type: 'client_updated',
      message: `Kundendaten wurden aktualisiert: ${updatedClient.billing_name}`,
      created_by: userId,
      metadata: {
        source: 'client_detail_update',
        primary_site_id: finalPrimarySiteId,
      },
    });
  } catch (activityError: any) {
    console.warn(
      '[opc/update-client-details] Activity creation failed:',
      activityError?.message || activityError
    );
  }

  return {
    clientId,
    contactId,
    primarySiteId: finalPrimarySiteId,
    billingName: updatedClient.billing_name,
    status: updatedClient.status,
    billingPhone: clientPayload.billing_phone_e164,
    contactPhoneRaw: contactId ? buildContactPayload(editedClient).phone_raw : null,
    contactPhoneE164: contactId ? buildContactPayload(editedClient).phone_e164 : null,
  };
}

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const requestId = Date.now().toString(36);

  try {
    const supabaseAdmin = getServerSupabase(locals);
    const authSupabase = getAuthSupabase(locals);
    const authResult = await getAuthenticatedUser(request, cookies, authSupabase);

    await assertCanManageClients(supabaseAdmin, authResult.user.id);

    let body: UpdateClientBody;

    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          error: 'Invalid JSON body.',
          requestId,
        },
        400
      );
    }

    const editedClient = pickEditedClient(body);
    const clientId = pickClientId(body, editedClient);

    if (!clientId) {
      return jsonResponse(
        {
          success: false,
          error: 'clientId is required.',
          requestId,
        },
        400
      );
    }

    const result = await updateClientDetails({
      supabase: supabaseAdmin,
      clientId,
      editedClient,
      userId: authResult.user.id,
    });

    return jsonResponse({
      success: true,
      message: 'Client details updated successfully.',
      requestId,
      authenticatedVia: authResult.authenticatedVia,
      ...result,
    });
  } catch (error: any) {
    console.error(`[opc/update-client-details] ${requestId} failed:`, error);

    const message = error?.message || 'Client details could not be updated.';

    const status =
      message === 'Not authenticated' || message === 'Invalid authentication'
        ? 401
        : message === 'Insufficient permissions'
          ? 403
          : message === 'Client not found'
            ? 404
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
};

export const GET: APIRoute = async ({ locals }) => {
  try {
    const { supabaseUrl } = getSupabaseConfig(locals);

    return jsonResponse({
      success: true,
      route: 'opc/update-client-details',
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
        route: 'opc/update-client-details',
        error: error?.message || 'Route configuration error.',
      },
      500
    );
  }
};
