import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

type AutoAidSettingsRow = {
  id: string;
  provider: string;
  enabled: boolean;
  api_base_url: string | null;
  api_key_encrypted: string | null;
  api_key_last4: string | null;
  api_key_set_at: string | null;
  access_token_encrypted?: string | null;
  access_token_last4?: string | null;
  access_token_set_at?: string | null;
  access_token_expires_at?: string | null;
  refresh_token_encrypted?: string | null;
  refresh_token_last4?: string | null;
  refresh_token_set_at?: string | null;
  oauth_client_id?: string | null;
  pull_interval_minutes: number | null;
  ingest_mode: 'pull_only' | 'push_only' | 'pull_and_push' | null;
  settings: Record<string, unknown> | null;
  updated_at: string | null;
};

const DEFAULT_AUTOAID_SETTINGS = {
  provider: 'autoaid',
  enabled: false,
  api_base_url: 'https://api-production.autoaid.de/cc/v3.0',
  oauth_client_id: 'connectedCarApi',
  pull_interval_minutes: 15,
  ingest_mode: 'pull_and_push' as const,
  settings: {
    sync_devices: true,
    sync_vehicles: true,
    sync_trips: true,
    sync_events: true,
    normalize_locations: true,
    detect_stops: true,
    match_jobs: false,
  },
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getRuntimeEnv(locals: any, request: Request) {
  const hostname = new URL(request.url).hostname;
  const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1';
  const runtimeEnv = locals?.runtime?.env || {};

  return {
    supabaseUrl: isLocalDev
      ? import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL
      : runtimeEnv.PUBLIC_SUPABASE_URL || runtimeEnv.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL,
    supabaseServiceKey: isLocalDev
      ? import.meta.env.SUPABASE_SERVICE_ROLE_KEY
      : runtimeEnv.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    autoAidSecret: isLocalDev
      ? import.meta.env.AUTOAID_SETTINGS_SECRET
      : runtimeEnv.AUTOAID_SETTINGS_SECRET || import.meta.env.AUTOAID_SETTINGS_SECRET,
  };
}

async function getServerSupabase(locals: any, request: Request) {
  const env = getRuntimeEnv(locals, request);

  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    throw new Error('Server configuration error');
  }

  return createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getAuthenticatedUser(request: Request, cookies: any, supabase: any) {
  const cookieToken = cookies.get('sb-access-token')?.value || '';
  const authHeader = request.headers.get('authorization') || '';
  const explicitHeader = request.headers.get('x-opc-auth-token') || '';
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.replace('Bearer ', '').trim()
    : '';

  const candidates = [bearerToken, explicitHeader, cookieToken].filter(Boolean);

  if (!candidates.length) {
    throw new Error('Not authenticated');
  }

  for (const token of candidates) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (!error && user) return user;
  }

  throw new Error('Invalid authentication');
}

async function assertOwner(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('opc_staff_roles')
    .select('id, role, status, can_access_portal')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('can_access_portal', true)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Owner permission required');

  return data;
}

function normalizeBaseUrl(value: unknown) {
  const raw = String(value || DEFAULT_AUTOAID_SETTINGS.api_base_url).trim();
  const withoutTrailingSlash = raw.replace(/\/+$/, '');

  if (!/^https:\/\//i.test(withoutTrailingSlash)) {
    throw new Error('AutoAid API URL muss mit https:// beginnen');
  }

  return withoutTrailingSlash;
}

function normalizeInterval(value: unknown) {
  const numeric = Number(value || DEFAULT_AUTOAID_SETTINGS.pull_interval_minutes);

  if (!Number.isFinite(numeric) || numeric < 1 || numeric > 1440) {
    throw new Error('Pull-Intervall muss zwischen 1 und 1440 Minuten liegen');
  }

  return Math.round(numeric);
}

function normalizeIngestMode(value: unknown): 'pull_only' | 'push_only' | 'pull_and_push' {
  if (value === 'pull_only' || value === 'push_only' || value === 'pull_and_push') {
    return value;
  }

  return DEFAULT_AUTOAID_SETTINGS.ingest_mode;
}

function normalizeOauthClientId(value: unknown) {
  const raw = String(value || DEFAULT_AUTOAID_SETTINGS.oauth_client_id).trim();
  return raw || DEFAULT_AUTOAID_SETTINGS.oauth_client_id;
}

function normalizeTokenExpiry(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Access Token Ablaufzeit ist ungültig');
  }

  return parsed.toISOString();
}

function tokenLast4(value: string) {
  return value.slice(-4);
}

function toBase64(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

async function deriveEncryptionKey(secret: string) {
  const encoded = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest('SHA-256', encoded);

  return crypto.subtle.importKey(
    'raw',
    digest,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
}

async function encryptSecret(value: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveEncryptionKey(secret);
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    new TextEncoder().encode(value)
  );

  return `v1:${toBase64(iv)}:${toBase64(new Uint8Array(encrypted))}`;
}

function publicSettings(row?: AutoAidSettingsRow | null) {
  const legacyKeyConfigured = Boolean(row?.api_key_encrypted);
  const accessTokenConfigured = Boolean(row?.access_token_encrypted);
  const refreshTokenConfigured = Boolean(row?.refresh_token_encrypted || row?.api_key_encrypted);

  return {
    provider: 'autoaid',
    enabled: row?.enabled ?? DEFAULT_AUTOAID_SETTINGS.enabled,
    api_base_url: row?.api_base_url || DEFAULT_AUTOAID_SETTINGS.api_base_url,
    oauth_client_id: row?.oauth_client_id || DEFAULT_AUTOAID_SETTINGS.oauth_client_id,
    api_key_configured: legacyKeyConfigured,
    api_key_last4: row?.api_key_last4 || '',
    api_key_set_at: row?.api_key_set_at || null,
    access_token_configured: accessTokenConfigured,
    access_token_last4: row?.access_token_last4 || '',
    access_token_set_at: row?.access_token_set_at || null,
    access_token_expires_at: row?.access_token_expires_at || null,
    refresh_token_configured: refreshTokenConfigured,
    refresh_token_last4: row?.refresh_token_last4 || row?.api_key_last4 || '',
    refresh_token_set_at: row?.refresh_token_set_at || row?.api_key_set_at || null,
    pull_interval_minutes: row?.pull_interval_minutes || DEFAULT_AUTOAID_SETTINGS.pull_interval_minutes,
    ingest_mode: row?.ingest_mode || DEFAULT_AUTOAID_SETTINGS.ingest_mode,
    settings: {
      ...DEFAULT_AUTOAID_SETTINGS.settings,
      ...(row?.settings || {}),
    },
    updated_at: row?.updated_at || null,
  };
}

async function loadAutoAidSettings(supabase: any) {
  const { data, error } = await supabase
    .from('opc_integration_settings')
    .select('*')
    .eq('provider', 'autoaid')
    .maybeSingle();

  if (error) throw error;
  return data as AutoAidSettingsRow | null;
}

export const GET: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const supabase = await getServerSupabase(locals, request);
    const user = await getAuthenticatedUser(request, cookies, supabase);
    await assertOwner(supabase, user.id);

    const row = await loadAutoAidSettings(supabase);

    return jsonResponse({
      success: true,
      settings: publicSettings(row),
    });
  } catch (error: any) {
    const status =
      error?.message === 'Not authenticated' || error?.message === 'Invalid authentication'
        ? 401
        : error?.message === 'Owner permission required'
          ? 403
          : 500;

    console.error('[AutoAid settings] GET failed', error);

    return jsonResponse(
      {
        success: false,
        error: error?.message || 'AutoAid Einstellungen konnten nicht geladen werden',
      },
      status
    );
  }
};

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const supabase = await getServerSupabase(locals, request);
    const env = getRuntimeEnv(locals, request);
    const user = await getAuthenticatedUser(request, cookies, supabase);
    await assertOwner(supabase, user.id);

    const body = (await request.json()) as Record<string, any>;
    const existing = await loadAutoAidSettings(supabase);

    const updatePayload: Record<string, any> = {
      provider: 'autoaid',
      enabled: Boolean(body.enabled),
      api_base_url: normalizeBaseUrl(body.api_base_url),
      oauth_client_id: normalizeOauthClientId(body.oauth_client_id),
      access_token_expires_at: normalizeTokenExpiry(body.access_token_expires_at),
      pull_interval_minutes: normalizeInterval(body.pull_interval_minutes),
      ingest_mode: normalizeIngestMode(body.ingest_mode),
      settings: {
        ...DEFAULT_AUTOAID_SETTINGS.settings,
        ...(existing?.settings || {}),
        ...(body.settings && typeof body.settings === 'object' ? body.settings : {}),
        credential_mode: 'oauth_refresh_token',
      },
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (!existing) {
      updatePayload.created_by = user.id;
    }

    const shouldClearTokens = body.clear_tokens === true || body.clear_api_key === true;

    if (shouldClearTokens) {
      updatePayload.api_key_encrypted = null;
      updatePayload.api_key_last4 = null;
      updatePayload.api_key_set_at = null;
      updatePayload.access_token_encrypted = null;
      updatePayload.access_token_last4 = null;
      updatePayload.access_token_set_at = null;
      updatePayload.access_token_expires_at = null;
      updatePayload.refresh_token_encrypted = null;
      updatePayload.refresh_token_last4 = null;
      updatePayload.refresh_token_set_at = null;
    }

    const nextAccessToken = typeof body.access_token === 'string' ? body.access_token.trim() : '';
    const nextRefreshToken = typeof body.refresh_token === 'string' ? body.refresh_token.trim() : '';
    const legacyApiKey = typeof body.api_key === 'string' ? body.api_key.trim() : '';

    if (nextAccessToken || nextRefreshToken || legacyApiKey) {
      if (!env.autoAidSecret) {
        throw new Error('AUTOAID_SETTINGS_SECRET fehlt in der Server-Konfiguration');
      }
    }

    if (nextAccessToken && !/^\*+$/.test(nextAccessToken)) {
      updatePayload.access_token_encrypted = await encryptSecret(nextAccessToken, env.autoAidSecret);
      updatePayload.access_token_last4 = tokenLast4(nextAccessToken);
      updatePayload.access_token_set_at = new Date().toISOString();
    }

    if (nextRefreshToken && !/^\*+$/.test(nextRefreshToken)) {
      updatePayload.refresh_token_encrypted = await encryptSecret(nextRefreshToken, env.autoAidSecret);
      updatePayload.refresh_token_last4 = tokenLast4(nextRefreshToken);
      updatePayload.refresh_token_set_at = new Date().toISOString();
      updatePayload.api_key_encrypted = null;
      updatePayload.api_key_last4 = null;
      updatePayload.api_key_set_at = null;
    } else if (legacyApiKey && !/^\*+$/.test(legacyApiKey)) {
      updatePayload.refresh_token_encrypted = await encryptSecret(legacyApiKey, env.autoAidSecret);
      updatePayload.refresh_token_last4 = tokenLast4(legacyApiKey);
      updatePayload.refresh_token_set_at = new Date().toISOString();
      updatePayload.api_key_encrypted = null;
      updatePayload.api_key_last4 = null;
      updatePayload.api_key_set_at = null;
    }

    const { data, error } = await supabase
      .from('opc_integration_settings')
      .upsert(updatePayload, { onConflict: 'provider' })
      .select('*')
      .single();

    if (error) throw error;

    return jsonResponse({
      success: true,
      settings: publicSettings(data as AutoAidSettingsRow),
      message: 'AutoAid Einstellungen gespeichert',
    });
  } catch (error: any) {
    const status =
      error?.message === 'Not authenticated' || error?.message === 'Invalid authentication'
        ? 401
        : error?.message === 'Owner permission required'
          ? 403
          : 500;

    console.error('[AutoAid settings] POST failed', error);

    return jsonResponse(
      {
        success: false,
        error: error?.message || 'AutoAid Einstellungen konnten nicht gespeichert werden',
      },
      status
    );
  }
};
