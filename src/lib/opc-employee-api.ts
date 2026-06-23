import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export const EMPLOYEE_DOCUMENT_BUCKET = 'opc-employee-hr-documents';

export type EmployeeApiAccess = {
  user: User;
  staffRoleId: string;
  role: 'owner' | 'admin';
  isOwner: boolean;
  canManageHr: true;
  canManagePayroll: boolean;
};

type TokenCandidate = {
  source: 'bearer' | 'cookie';
  token: string;
};

export function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export function cleanText(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

export function cleanUpperCode(value: unknown, length: number) {
  const text = cleanText(value)?.toUpperCase() || null;
  if (!text) return null;
  return text.slice(0, length);
}

export function normalizeEmail(value: unknown) {
  return cleanText(value)?.toLowerCase() || null;
}

export function normalizePhone(value: unknown) {
  const raw = cleanText(value);
  if (!raw) return null;

  const trimmed = raw.replace(/\s+/g, ' ');
  const digits = trimmed.replace(/\D/g, '');

  if (!digits) return trimmed;
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('0') && digits.length >= 9) return `+41${digits.slice(1)}`;

  return trimmed;
}

export function asBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const text = String(value ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'ja', 'on'].includes(text)) return true;
  if (['false', '0', 'no', 'nein', 'off'].includes(text)) return false;
  return fallback;
}

export function asNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function safeObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, any>) };
  }
  return {};
}

export function safeArray<T = Record<string, any>>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function sanitizeFileName(name: string) {
  return String(name || 'datei')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140)
    .toLowerCase();
}

export function splitDisplayName(displayName: unknown) {
  const parts = String(displayName || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
  };
}

export function todayIsoDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function yesterdayIsoDate() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function maskIban(value: unknown) {
  const iban = String(value || '').replace(/\s+/g, '');
  if (!iban) return null;
  if (iban.length <= 8) return iban;
  return `${iban.slice(0, 4)} •••• •••• ${iban.slice(-4)}`;
}

function decodeJwtPayload(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;

    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const decoded =
      typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('utf8');

    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function getEnvValue(locals: any, key: string) {
  const runtimeEnv = locals?.runtime?.env;
  const processEnv = (globalThis as any)?.process?.env;

  return runtimeEnv?.[key] || import.meta.env?.[key] || processEnv?.[key] || '';
}

function assertServiceRoleKey(serviceRoleKey: string) {
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing.');
  }

  if (serviceRoleKey.startsWith('sb_publishable_') || serviceRoleKey.includes('anon')) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not a service-role key.');
  }

  if (serviceRoleKey.startsWith('eyJ')) {
    const payload = decodeJwtPayload(serviceRoleKey);
    const role = String(payload?.role || '').toLowerCase();
    if (role && role !== 'service_role') {
      throw new Error(`SUPABASE_SERVICE_ROLE_KEY has JWT role ${role}; service_role is required.`);
    }
  }
}

export async function getEmployeeServerSupabase(locals: any): Promise<SupabaseClient> {
  const supabaseUrl =
    getEnvValue(locals, 'SUPABASE_URL') || getEnvValue(locals, 'PUBLIC_SUPABASE_URL');
  const serviceRoleKey = getEnvValue(locals, 'SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL or PUBLIC_SUPABASE_URL is missing.');
  }

  assertServiceRoleKey(serviceRoleKey);

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'X-OPC-Admin-Route': 'employee-hr',
      },
    },
  });
}

async function getAuthenticatedUser(request: Request, cookies: any, supabase: SupabaseClient) {
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.replace('Bearer ', '').trim()
    : '';
  const cookieToken = cookies.get('sb-access-token')?.value || '';

  const candidates: TokenCandidate[] = [
    { source: 'bearer', token: bearerToken },
    { source: 'cookie', token: String(cookieToken || '') },
  ].filter((item) => Boolean(item.token)) as TokenCandidate[];

  if (!candidates.length) {
    throw new Error('Not authenticated');
  }

  const errors: Array<{ source: string; message: string }> = [];

  for (const candidate of candidates) {
    const result = await supabase.auth.getUser(candidate.token);
    const user = result?.data?.user || null;
    const error = result?.error || null;

    if (!error && user) return user;

    errors.push({
      source: candidate.source,
      message: error?.message || 'No user returned',
    });
  }

  console.error('[opc/employees] authentication failed', errors);
  throw new Error('Invalid authentication');
}

export async function requireEmployeeHrAccess({
  request,
  cookies,
  locals,
}: {
  request: Request;
  cookies: any;
  locals: any;
}) {
  const supabase = await getEmployeeServerSupabase(locals);
  const user = await getAuthenticatedUser(request, cookies, supabase);

  const { data: staffRole, error } = await supabase
    .from('opc_staff_roles')
    .select('id,user_id,role,status,can_access_portal,email,display_name')
    .eq('user_id', user.id)
    .in('status', ['active', 'aktiv', 'enabled'])
    .eq('can_access_portal', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Role lookup failed: ${error.message}`);
  }

  const role = String(staffRole?.role || '').trim().toLowerCase();

  if (!staffRole || !['owner', 'admin'].includes(role)) {
    throw new Error('Insufficient permissions');
  }

  const access: EmployeeApiAccess = {
    user,
    staffRoleId: String(staffRole.id),
    role: role as 'owner' | 'admin',
    isOwner: role === 'owner',
    canManageHr: true,
    canManagePayroll: role === 'owner',
  };

  return { supabase, access };
}

export function errorStatus(error: any) {
  const message = String(error?.message || '');
  if (message === 'Not authenticated' || message === 'Invalid authentication') return 401;
  if (message === 'Insufficient permissions') return 403;
  return 500;
}

export function throwOnError(error: any, context: string) {
  if (error) {
    throw new Error(`${context}: ${error.message || String(error)}`);
  }
}
