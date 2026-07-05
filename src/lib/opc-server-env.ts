import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type EnvLike = Record<string, string | undefined> | undefined | null;

type KnownEnvKey =
  | 'PUBLIC_SUPABASE_URL'
  | 'SUPABASE_URL'
  | 'PUBLIC_SUPABASE_ANON_KEY'
  | 'SUPABASE_ANON_KEY'
  | 'SUPABASE_SERVICE_ROLE_KEY'
  | 'SUPABASE_SERVICE_ROLE'
  | 'SUPABASE_SERVICE_KEY'
  | 'SERVICE_ROLE_KEY'
  | 'EDGE_FUNCTION_BASE'
  | 'GOOGLE_API_KEY'
  | 'GOOGLE_MAPS_API_KEY'
  | 'GOOGLE_CLIENT_ID'
  | 'GOOGLE_CLIENT_SECRET'
  | 'GOOGLE_REDIRECT_URI'
  | 'GOOGLE_TOKEN_ENCRYPTION_KEY'
  | 'GITHUB_TOKEN'
  | 'OPC_DEBUG_API'
  | 'EURO_OFFICE_URL'
  | 'EURO_OFFICE_JWT_SECRET'
  | 'PUBLIC_SITE_URL'
  | 'PUBLIC_APP_URL'
  | 'PUBLIC_BASE_URL'
  | 'SITE_URL';

const STATIC_ASTRO_ENV: Partial<Record<KnownEnvKey, string | undefined>> = {
  PUBLIC_SUPABASE_URL: import.meta.env.PUBLIC_SUPABASE_URL,
  SUPABASE_URL: import.meta.env.SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY: import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_ANON_KEY: import.meta.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_SERVICE_ROLE: import.meta.env.SUPABASE_SERVICE_ROLE,
  SUPABASE_SERVICE_KEY: import.meta.env.SUPABASE_SERVICE_KEY,
  SERVICE_ROLE_KEY: import.meta.env.SERVICE_ROLE_KEY,
  EDGE_FUNCTION_BASE: import.meta.env.EDGE_FUNCTION_BASE,
  GOOGLE_API_KEY: import.meta.env.GOOGLE_API_KEY,
  GOOGLE_MAPS_API_KEY: import.meta.env.GOOGLE_MAPS_API_KEY,
  GOOGLE_CLIENT_ID: import.meta.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: import.meta.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: import.meta.env.GOOGLE_REDIRECT_URI,
  GOOGLE_TOKEN_ENCRYPTION_KEY: import.meta.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
  GITHUB_TOKEN: import.meta.env.GITHUB_TOKEN,
  OPC_DEBUG_API: import.meta.env.OPC_DEBUG_API,
  EURO_OFFICE_URL: import.meta.env.EURO_OFFICE_URL,
  EURO_OFFICE_JWT_SECRET: import.meta.env.EURO_OFFICE_JWT_SECRET,
  PUBLIC_SITE_URL: import.meta.env.PUBLIC_SITE_URL,
  PUBLIC_APP_URL: import.meta.env.PUBLIC_APP_URL,
  PUBLIC_BASE_URL: import.meta.env.PUBLIC_BASE_URL,
  SITE_URL: import.meta.env.SITE_URL,
};

function readProcessEnvValue(key: string): string {
  try {
    const processEnv = (globalThis as any)?.process?.env as EnvLike;
    return String(processEnv?.[key] || '').trim();
  } catch {
    return '';
  }
}

function readStaticAstroEnvValue(key: string): string {
  return String(STATIC_ASTRO_ENV[key as KnownEnvKey] || '').trim();
}

export function getOpcRuntimeEnv(source?: any): EnvLike {
  if (!source) return {};

  if (source?.runtime?.env) return source.runtime.env as EnvLike;
  if (source?.locals?.runtime?.env) return source.locals.runtime.env as EnvLike;
  if (source?.platform?.env) return source.platform.env as EnvLike;
  if (source?.locals?.platform?.env) return source.locals.platform.env as EnvLike;
  if (source?.env) return source.env as EnvLike;

  return source as EnvLike;
}

export function getOpcServerEnvValue(source: any, key: string): string {
  const runtimeEnv = getOpcRuntimeEnv(source);

  const value =
    runtimeEnv?.[key] ||
    readStaticAstroEnvValue(key) ||
    readProcessEnvValue(key) ||
    '';

  return String(value || '').trim();
}

export function getOpcSupabaseUrl(source?: any): string {
  const value =
    getOpcServerEnvValue(source, 'SUPABASE_URL') ||
    getOpcServerEnvValue(source, 'PUBLIC_SUPABASE_URL');

  if (!value) {
    throw new Error('SUPABASE_URL or PUBLIC_SUPABASE_URL is missing.');
  }

  return value.replace(/\/$/, '');
}

export function getOpcSupabaseAnonKey(source?: any): string {
  const value =
    getOpcServerEnvValue(source, 'PUBLIC_SUPABASE_ANON_KEY') ||
    getOpcServerEnvValue(source, 'SUPABASE_ANON_KEY');

  if (!value) {
    throw new Error('PUBLIC_SUPABASE_ANON_KEY is missing.');
  }

  return value;
}

function decodeBase64Url(input: string) {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

  if (typeof atob === 'function') {
    return atob(padded);
  }

  const BufferCtor = (globalThis as any)?.Buffer;

  if (BufferCtor) {
    return BufferCtor.from(padded, 'base64').toString('utf8');
  }

  return '';
}

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    if (!token.startsWith('eyJ')) return null;

    const parts = token.split('.');
    if (parts.length < 2) return null;

    return JSON.parse(decodeBase64Url(parts[1]));
  } catch {
    return null;
  }
}

export function getOpcSupabaseServiceRoleKey(source?: any): string {
  const value =
    getOpcServerEnvValue(source, 'SUPABASE_SERVICE_ROLE_KEY') ||
    getOpcServerEnvValue(source, 'SUPABASE_SERVICE_ROLE') ||
    getOpcServerEnvValue(source, 'SUPABASE_SERVICE_KEY') ||
    getOpcServerEnvValue(source, 'SERVICE_ROLE_KEY');

  if (!value) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing.');
  }

  const lowerValue = value.toLowerCase();

  if (value.startsWith('sb_publishable_') || lowerValue.includes('anon')) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not a service-role key. It looks like an anon or publishable key.');
  }

  const payload = decodeJwtPayload(value);
  const role = String(payload?.role || '').toLowerCase();

  if (role && role !== 'service_role') {
    throw new Error(`SUPABASE_SERVICE_ROLE_KEY has wrong JWT role "${role}". Expected "service_role".`);
  }

  return value;
}

export function getOpcSupabaseServerConfig(source?: any) {
  return {
    supabaseUrl: getOpcSupabaseUrl(source),
    anonKey: getOpcSupabaseAnonKey(source),
    serviceRoleKey: getOpcSupabaseServiceRoleKey(source),
  };
}

export function getOpcOfficeConfig(source?: any) {
  const serverUrl = getOpcServerEnvValue(source, 'EURO_OFFICE_URL').replace(/\/+$/, '');
  const jwtSecret = getOpcServerEnvValue(source, 'EURO_OFFICE_JWT_SECRET');

  if (!serverUrl) {
    throw new Error('EURO_OFFICE_URL is missing.');
  }

  if (!/^https?:\/\//i.test(serverUrl)) {
    throw new Error('EURO_OFFICE_URL must be an absolute HTTP or HTTPS URL.');
  }

  if (!jwtSecret || jwtSecret.length < 24) {
    throw new Error('EURO_OFFICE_JWT_SECRET must contain at least 24 characters.');
  }

  return {
    serverUrl,
    jwtSecret,
    apiScriptUrl: `${serverUrl}/web-apps/apps/api/documents/api.js`,
  };
}

export function getOpcPublicOrigin(source: any, request?: Request) {
  const configured =
    getOpcServerEnvValue(source, 'PUBLIC_SITE_URL') ||
    getOpcServerEnvValue(source, 'PUBLIC_APP_URL') ||
    getOpcServerEnvValue(source, 'PUBLIC_BASE_URL') ||
    getOpcServerEnvValue(source, 'SITE_URL');

  if (configured) return configured.replace(/\/+$/, '');
  if (request) return new URL(request.url).origin;

  throw new Error('A public application origin could not be resolved.');
}

export function createOpcSupabaseAdmin(source?: any): SupabaseClient {
  const { supabaseUrl, serviceRoleKey } = getOpcSupabaseServerConfig(source);

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createOpcSupabaseUserClient(source: any, token?: string | null): SupabaseClient {
  const supabaseUrl = getOpcSupabaseUrl(source);
  const anonKey = getOpcSupabaseAnonKey(source);

  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
