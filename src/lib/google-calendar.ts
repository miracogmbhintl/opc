import { createClient } from '@supabase/supabase-js';
import {
  getEnvValue,
  getGoogleClientId,
  getGoogleClientSecret,
  getGoogleRedirectUri,
  type RuntimeEnv,
} from './google-oauth';

export type GoogleAccountRow = Record<string, any>;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};

  if (!cookieHeader) return cookies;

  for (const part of cookieHeader.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    if (key) cookies[key] = decodeURIComponent(value);
  }

  return cookies;
}

function parseStoredToken(raw: string | null | undefined): string {
  if (!raw) return '';

  const candidates = [raw];

  if (raw.startsWith('base64-')) {
    try {
      candidates.push(atob(raw.replace(/^base64-/, '')));
    } catch {
      // ignore
    }
  }

  for (const candidate of candidates) {
    if (candidate.includes('.') && !candidate.trim().startsWith('{')) return candidate.trim();

    try {
      const parsed = JSON.parse(candidate);

      if (Array.isArray(parsed) && typeof parsed[0] === 'string') return parsed[0];
      if (typeof parsed?.access_token === 'string') return parsed.access_token;
      if (typeof parsed?.currentSession?.access_token === 'string') return parsed.currentSession.access_token;
      if (typeof parsed?.session?.access_token === 'string') return parsed.session.access_token;
    } catch {
      // ignore
    }
  }

  return '';
}

export function getAccessTokenFromRequest(request: Request): string {
  const customToken =
    request.headers.get('x-opc-auth-token') ||
    request.headers.get('X-OPC-Auth-Token');

  if (customToken?.includes('.')) return customToken.trim();

  const authHeader =
    request.headers.get('authorization') ||
    request.headers.get('Authorization');

  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  const cookies = parseCookies(request.headers.get('cookie'));

  return (
    parseStoredToken(cookies['sb-access-token']) ||
    parseStoredToken(cookies['opc_auth_token']) ||
    parseStoredToken(cookies['sb-wxvjygnrcszclyuobsxw-auth-token']) ||
    ''
  );
}

export function getSupabaseServiceClient(env: RuntimeEnv) {
  const supabaseUrl = getEnvValue(env, [
    'SUPABASE_URL',
    'PUBLIC_SUPABASE_URL',
    'VITE_SUPABASE_URL',
  ]);

  const serviceRoleKey = getEnvValue(env, [
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SERVICE_KEY',
  ]);

  if (!supabaseUrl) {
    throw Object.assign(new Error('SUPABASE_URL fehlt.'), { status: 500 });
  }

  if (!serviceRoleKey) {
    throw Object.assign(new Error('SUPABASE_SERVICE_ROLE_KEY fehlt.'), { status: 500 });
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function getAuthenticatedContext(request: Request, env: RuntimeEnv) {
  const accessToken = getAccessTokenFromRequest(request);

  if (!accessToken) {
    throw Object.assign(new Error('Ungültige oder abgelaufene Sitzung.'), { status: 401 });
  }

  const supabase = getSupabaseServiceClient(env);
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data?.user) {
    throw Object.assign(new Error('Ungültige oder abgelaufene Sitzung.'), { status: 401 });
  }

  return {
    supabase,
    user: data.user,
    accessToken,
  };
}

function normalizeBase64(value: string): string {
  return value.replace(/-/g, '+').replace(/_/g, '/');
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return typeof btoa === 'function'
    ? btoa(binary)
    : (globalThis as any).Buffer.from(bytes).toString('base64');
}

function fromBase64(value: string): Uint8Array {
  const normalized = normalizeBase64(value);
  const binary =
    typeof atob === 'function'
      ? atob(normalized)
      : (globalThis as any).Buffer.from(normalized, 'base64').toString('binary');

  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function getEncryptionKey(env: RuntimeEnv): Promise<CryptoKey> {
  const secret = getEnvValue(env, ['GOOGLE_TOKEN_ENCRYPTION_KEY']);

  if (!secret) {
    throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY fehlt.');
  }

  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(secret)
  );

  return globalThis.crypto.subtle.importKey(
    'raw',
    digest,
    {
      name: 'AES-GCM',
    },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptSecret(value: string, env: RuntimeEnv): Promise<string | null> {
  if (!value) return null;

  const key = await getEncryptionKey(env);
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);

  const encrypted = await globalThis.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    new TextEncoder().encode(value)
  );

  return `v1:${toBase64(iv.buffer)}:${toBase64(encrypted)}`;
}

export async function decryptSecret(value: string | null | undefined, env: RuntimeEnv): Promise<string> {
  if (!value) return '';

  if (!value.startsWith('v1:')) {
    return value;
  }

  const [, ivRaw, encryptedRaw] = value.split(':');

  if (!ivRaw || !encryptedRaw) {
    throw new Error('Ungültiges Token-Format.');
  }

  const key = await getEncryptionKey(env);
  const decrypted = await globalThis.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: fromBase64(ivRaw),
    },
    key,
    fromBase64(encryptedRaw)
  );

  return new TextDecoder().decode(decrypted);
}

export async function getOwnGoogleAccount(supabase: any, userId: string): Promise<GoogleAccountRow | null> {
  const { data, error } = await supabase
    .from('opc_google_accounts')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data || null;
}

export function publicGoogleAccount(account: GoogleAccountRow | null) {
  if (!account) {
    return {
      connected: false,
      account: null,
    };
  }

  return {
    connected: account.status === 'connected' || account.status === 'needs_reconnect',
    account: {
      id: account.id,
      google_email: account.google_email,
      google_user_id: account.google_user_id,
      selected_calendar_id: account.selected_calendar_id,
      selected_calendar_name: account.selected_calendar_name,
      selected_calendar_access_role: account.selected_calendar_access_role,
      scopes: account.scopes || [],
      status: account.status,
      last_error: account.last_error,
      token_expires_at: account.token_expires_at,
      updated_at: account.updated_at,
    },
  };
}

async function googleTokenRequest(params: {
  env: RuntimeEnv;
  requestUrl: string;
  body: URLSearchParams;
}) {
  const clientId = getGoogleClientId(params.env);
  const clientSecret = getGoogleClientSecret(params.env);

  if (!clientId) throw new Error('GOOGLE_CLIENT_ID fehlt.');
  if (!clientSecret) throw new Error('GOOGLE_CLIENT_SECRET fehlt.');

  params.body.set('client_id', clientId);
  params.body.set('client_secret', clientSecret);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.body.toString(),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error_description || payload?.error || 'Google Token Request fehlgeschlagen.');
  }

  return payload;
}

export async function exchangeGoogleCode(params: {
  env: RuntimeEnv;
  requestUrl: string;
  code: string;
  codeVerifier: string;
}) {
  const body = new URLSearchParams();

  body.set('code', params.code);
  body.set('code_verifier', params.codeVerifier);
  body.set('grant_type', 'authorization_code');
  body.set('redirect_uri', getGoogleRedirectUri(params.env, params.requestUrl));

  return googleTokenRequest({
    env: params.env,
    requestUrl: params.requestUrl,
    body,
  });
}

export async function refreshGoogleAccessToken(params: {
  supabase: any;
  env: RuntimeEnv;
  account: GoogleAccountRow;
  requestUrl: string;
}) {
  const refreshToken = await decryptSecret(params.account.refresh_token_encrypted, params.env);

  if (!refreshToken) {
    throw new Error('Google Refresh Token fehlt. Bitte Google neu verbinden.');
  }

  const body = new URLSearchParams();

  body.set('grant_type', 'refresh_token');
  body.set('refresh_token', refreshToken);

  const payload = await googleTokenRequest({
    env: params.env,
    requestUrl: params.requestUrl,
    body,
  });

  const accessTokenEncrypted = await encryptSecret(payload.access_token, params.env);
  const expiresAt = new Date(Date.now() + Number(payload.expires_in || 3600) * 1000).toISOString();

  const updatePayload: Record<string, any> = {
    access_token_encrypted: accessTokenEncrypted,
    token_expires_at: expiresAt,
    status: 'connected',
    last_error: null,
    updated_at: new Date().toISOString(),
  };

  if (payload.refresh_token) {
    updatePayload.refresh_token_encrypted = await encryptSecret(payload.refresh_token, params.env);
  }

  const { data, error } = await params.supabase
    .from('opc_google_accounts')
    .update(updatePayload)
    .eq('id', params.account.id)
    .select('*')
    .single();

  if (error) throw error;

  return {
    account: data,
    accessToken: payload.access_token as string,
  };
}

export async function getValidGoogleAccessToken(params: {
  supabase: any;
  env: RuntimeEnv;
  account: GoogleAccountRow;
  requestUrl: string;
}): Promise<string> {
  const expiresAt = params.account.token_expires_at
    ? new Date(params.account.token_expires_at).getTime()
    : 0;

  if (expiresAt > Date.now() + 60_000) {
    const token = await decryptSecret(params.account.access_token_encrypted, params.env);
    if (token) return token;
  }

  const refreshed = await refreshGoogleAccessToken(params);
  return refreshed.accessToken;
}

export async function fetchGoogleJson(params: {
  accessToken: string;
  url: string;
  init?: RequestInit;
}) {
  const response = await fetch(params.url, {
    ...(params.init || {}),
    headers: {
      Accept: 'application/json',
      ...(params.init?.headers || {}),
      Authorization: `Bearer ${params.accessToken}`,
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.error_description || 'Google API Fehler.');
  }

  return payload;
}

function extractMeetLink(event: any): string | null {
  if (event?.hangoutLink) return event.hangoutLink;

  const entryPoints = event?.conferenceData?.entryPoints;
  if (!Array.isArray(entryPoints)) return null;

  const videoEntry = entryPoints.find((entry: any) => {
    return entry?.entryPointType === 'video' && entry?.uri;
  });

  return videoEntry?.uri || null;
}

export async function createGoogleCalendarEvent(params: {
  supabase: any;
  env: RuntimeEnv;
  account: GoogleAccountRow;
  requestUrl: string;
  input: {
    title: string;
    description?: string;
    starts_at: string;
    ends_at: string;
    timezone?: string;
    is_all_day?: boolean;
    location_name?: string;
    location_address?: string;
    attendeeEmails?: string[];
    createMeetLink?: boolean;
  };
}) {
  const accessToken = await getValidGoogleAccessToken({
    supabase: params.supabase,
    env: params.env,
    account: params.account,
    requestUrl: params.requestUrl,
  });

  const calendarId = params.account.selected_calendar_id || 'primary';
  const attendeeEmails = Array.from(
    new Set((params.input.attendeeEmails || []).map((email) => String(email).trim()).filter(Boolean))
  );

  const requestId = globalThis.crypto.randomUUID();

  const body: Record<string, any> = {
    summary: params.input.title || 'Orange Pro Clean Termin',
    description: params.input.description || '',
    location:
      params.input.location_address ||
      params.input.location_name ||
      '',
    attendees: attendeeEmails.map((email) => ({ email })),
  };

  if (params.input.is_all_day) {
    body.start = { date: params.input.starts_at.slice(0, 10) };
    body.end = { date: params.input.ends_at.slice(0, 10) };
  } else {
    body.start = {
      dateTime: params.input.starts_at,
      timeZone: params.input.timezone || 'Europe/Zurich',
    };
    body.end = {
      dateTime: params.input.ends_at,
      timeZone: params.input.timezone || 'Europe/Zurich',
    };
  }

  if (params.input.createMeetLink) {
    body.conferenceData = {
      createRequest: {
        requestId,
        conferenceSolutionKey: {
          type: 'hangoutsMeet',
        },
      },
    };
  }

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
  );

  url.searchParams.set('conferenceDataVersion', params.input.createMeetLink ? '1' : '0');
  url.searchParams.set('sendUpdates', attendeeEmails.length > 0 ? 'all' : 'none');

  const googleEvent = await fetchGoogleJson({
    accessToken,
    url: url.toString(),
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  });

  return {
    google_calendar_id: calendarId,
    google_event_id: googleEvent.id || null,
    google_html_link: googleEvent.htmlLink || null,
    google_meet_link: extractMeetLink(googleEvent),
    google_conference_id: googleEvent?.conferenceData?.conferenceId || null,
    google_conference_request_id: params.input.createMeetLink ? requestId : null,
    google_meet_space_name: googleEvent?.conferenceData?.conferenceSolution?.name || null,
  };
}
