import { createClient } from '@supabase/supabase-js';

type RuntimeLocals = {
  runtime?: {
    env?: Record<string, string | undefined>;
  };
};

function getRuntimeEnv(locals?: unknown) {
  return (locals as RuntimeLocals | undefined)?.runtime?.env ?? {};
}

function cleanEnv(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim();
  return cleaned || undefined;
}

function pickEnvValue(keys: string[], sources: Array<Record<string, any>>) {
  for (const source of sources) {
    for (const key of keys) {
      const value = cleanEnv(source[key]);
      if (value) return value;
    }
  }

  return undefined;
}

export function getOpcRuntimeEnv(locals?: unknown) {
  const runtimeEnv = getRuntimeEnv(locals);

  /**
   * Important:
   * In local Astro + Cloudflare dev, locals.runtime.env can contain old Wrangler values.
   * For local development, prefer import.meta.env first.
   * For production, prefer runtime bindings first.
   */
  const sources =
    import.meta.env.DEV
      ? [import.meta.env, runtimeEnv]
      : [runtimeEnv, import.meta.env];

  const supabaseUrl = pickEnvValue(
    [
      'SUPABASE_URL',
      'PUBLIC_SUPABASE_URL',
      'VITE_SUPABASE_URL',
      'VITE_PUBLIC_SUPABASE_URL',
      'ASTRO_SUPABASE_URL',
      'ASTRO_PUBLIC_SUPABASE_URL',
    ],
    sources
  );

  const serviceRoleKey = pickEnvValue(
    [
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_SERVICE_KEY',
      'SUPABASE_SECRET_KEY',
      'SERVICE_ROLE_KEY',
    ],
    sources
  );

  if (!supabaseUrl) {
    throw new Error(
      'Missing SUPABASE_URL or PUBLIC_SUPABASE_URL. Check .env, .env.local, .dev.vars and Wrangler secrets.'
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. Check .env, .env.local, .dev.vars and Wrangler secrets.'
    );
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    sourceMode: import.meta.env.DEV ? 'import-meta-first-dev' : 'runtime-first-production',
  };
}

export function getSupabaseProjectRef(url: string | undefined) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('.supabase.co', '');
  } catch {
    return null;
  }
}

export function createOpcServiceClient(locals?: unknown) {
  const { supabaseUrl, serviceRoleKey } = getOpcRuntimeEnv(locals);

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'orange-pro-clean-portal',
      },
    },
  });
}

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export function sanitizePublicText(value: FormDataEntryValue | null, maxLength: number) {
  if (typeof value !== 'string') return null;

  const cleaned = value
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return null;

  return cleaned.slice(0, maxLength);
}

export function sanitizeTicketCategory(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return 'general';

  const allowed = new Set([
    'damage',
    'cleaning_needed',
    'recleaning',
    'material_missing',
    'complaint',
    'praise',
    'general',
    'other',
  ]);

  return allowed.has(value) ? value : 'general';
}

export function getClientIp(request: Request, clientAddress?: string) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  const realIp = request.headers.get('x-real-ip');

  return (
    cfConnectingIp ||
    forwardedFor?.split(',')[0]?.trim() ||
    realIp ||
    clientAddress ||
    null
  );
}

export function safeFileName(filename: string) {
  const fallback = 'upload';

  const cleaned = filename
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\-+|\-+$/g, '')
    .slice(0, 120);

  return cleaned || fallback;
}

export function isAllowedTicketImage(file: File) {
  const allowedMimeTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ]);

  return allowedMimeTypes.has(file.type);
}