import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

type UserRole = 'owner' | 'admin' | 'dispatch' | 'employee' | 'client';
type ProfileSourceType = 'staff' | 'client';

const DEFAULT_COMPANY = 'Orange Pro Clean GmbH';

const DEFAULT_NOTIFICATIONS = {
  projectUpdates: true,
  newMessages: true,
  fileUploads: true,
  billing: true,
  dispatchAlerts: true,
  reportApprovals: true,
  pushNotifications: false,
};

const DEFAULT_SYSTEM_SETTINGS = {
  companyDisplayName: DEFAULT_COMPANY,
  defaultLanguage: 'de',
  defaultTimezone: 'Europe/Zurich',
  allowClientUploads: true,
  enableEmployeePortal: true,
  enableReportApproval: true,
  enableDispatchNotifications: true,
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function normalizeMetadata(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, any>;
}

function normalizeStaffRole(role?: string | null): UserRole {
  if (role === 'owner') return 'owner';
  if (role === 'admin') return 'admin';
  if (role === 'dispatch') return 'dispatch';
  if (role === 'employee') return 'employee';

  return 'client';
}

async function getServerSupabase(locals: any, request: Request) {
  const runtimeEnv = locals?.runtime?.env;
  const hostname = new URL(request.url).hostname;
  const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1';

  const supabaseUrl = isLocalDev
    ? import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL
    : runtimeEnv?.PUBLIC_SUPABASE_URL ||
      runtimeEnv?.SUPABASE_URL ||
      import.meta.env.PUBLIC_SUPABASE_URL ||
      import.meta.env.SUPABASE_URL;

  const supabaseServiceKey = isLocalDev
    ? import.meta.env.SUPABASE_SERVICE_ROLE_KEY
    : runtimeEnv?.SUPABASE_SERVICE_ROLE_KEY ||
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Server configuration error');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getAuthenticatedUser(request: Request, cookies: any, supabase: any) {
  const cookieToken = cookies.get('sb-access-token')?.value || '';
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.replace('Bearer ', '').trim()
    : '';

  const candidates = [
    { source: 'bearer', token: bearerToken },
    { source: 'cookie', token: cookieToken },
  ].filter((candidate) => !!candidate.token);

  if (candidates.length === 0) {
    console.error('[Profile API] No authentication token found', {
      hadCookieToken: false,
      hadBearerToken: false,
    });

    throw new Error('Not authenticated');
  }

  const errors: Array<{ source: string; message: string }> = [];

  for (const candidate of candidates) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(candidate.token);

    if (!error && user) {
      return user;
    }

    errors.push({
      source: candidate.source,
      message: error?.message || 'No user returned',
    });
  }

  console.error('[Profile API] All tokens invalid', {
    hadCookieToken: !!cookieToken,
    hadBearerToken: !!bearerToken,
    errors,
  });

  throw new Error('Invalid authentication');
}

async function getProfileSource(supabase: any, userId: string) {
  const { data: staffRole, error: staffError } = await supabase
    .from('opc_staff_roles')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('can_access_portal', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (staffError) {
    throw staffError;
  }

  if (staffRole) {
    return {
      source: 'staff' as const,
      table: 'opc_staff_roles',
      record: staffRole,
    };
  }

  const { data: clientUser, error: clientError } = await supabase
    .from('opc_client_users')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('can_access_client_portal', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (clientError) {
    throw clientError;
  }

  if (clientUser) {
    return {
      source: 'client' as const,
      table: 'opc_client_users',
      record: clientUser,
    };
  }

  return null;
}

function buildProfile(sourceRecord: any, source: ProfileSourceType, authUser: any) {
  const metadata = normalizeMetadata(sourceRecord.metadata);

  const notifications = {
    ...DEFAULT_NOTIFICATIONS,
    ...(metadata.notifications || {}),
  };

  const systemSettings = {
    ...DEFAULT_SYSTEM_SETTINGS,
    ...(metadata.system_settings || {}),
  };

  const displayName =
    sourceRecord.display_name ||
    metadata.full_name ||
    metadata.name ||
    authUser.email ||
    'Orange Pro Clean User';

  const email = sourceRecord.email || authUser.email || '';
  const phone = sourceRecord.phone_raw || sourceRecord.phone_e164 || '';

  const role: UserRole =
    source === 'staff' ? normalizeStaffRole(sourceRecord.role) : 'client';

  return {
    id: authUser.id,
    source,
    email,
    name: displayName,
    full_name: displayName,
    role,
    raw_role: sourceRecord.role || null,
    company: metadata.company || systemSettings.companyDisplayName || DEFAULT_COMPANY,
    phone,
    avatar_url: metadata.avatar_url || '',
    username: metadata.username || displayName.split(' ')[0] || '',
    language: metadata.language || systemSettings.defaultLanguage || 'de',
    timezone: metadata.timezone || systemSettings.defaultTimezone || 'Europe/Zurich',
    theme: metadata.theme || 'light',
    notifications,
    system_settings: systemSettings,
    created_at: sourceRecord.created_at || authUser.created_at || null,
    updated_at: sourceRecord.updated_at || authUser.updated_at || null,
    can_access_portal:
      source === 'staff'
        ? sourceRecord.can_access_portal === true
        : sourceRecord.can_access_client_portal === true,
  };
}

export const GET: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const supabase = await getServerSupabase(locals, request);
    const user = await getAuthenticatedUser(request, cookies, supabase);

    const profileSource = await getProfileSource(supabase, user.id);

    if (!profileSource) {
      return jsonResponse(
        {
          success: false,
          error: 'No active portal profile found',
        },
        404
      );
    }

    const profile = buildProfile(
      profileSource.record,
      profileSource.source,
      user
    );

    return jsonResponse({
      success: true,
      profile,
    });
  } catch (error: any) {
    console.error('Profile GET error:', error);

    const status =
      error?.message === 'Not authenticated' ||
      error?.message === 'Invalid authentication'
        ? 401
        : 500;

    return jsonResponse(
      {
        success: false,
        error: error?.message || 'Failed to load profile',
      },
      status
    );
  }
};

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const supabase = await getServerSupabase(locals, request);
    const user = await getAuthenticatedUser(request, cookies, supabase);

    const profileSource = await getProfileSource(supabase, user.id);

    if (!profileSource) {
      return jsonResponse(
        {
          success: false,
          error: 'No active portal profile found',
        },
        404
      );
    }

    const body = (await request.json()) as Record<string, any>;
    const currentMetadata = normalizeMetadata(profileSource.record.metadata);

    const existingNotifications = {
      ...DEFAULT_NOTIFICATIONS,
      ...(currentMetadata.notifications || {}),
    };

    const existingSystemSettings = {
      ...DEFAULT_SYSTEM_SETTINGS,
      ...(currentMetadata.system_settings || {}),
    };

    const nextMetadata: Record<string, any> = {
      ...currentMetadata,
    };

    const fullName =
      body.full_name !== undefined
        ? body.full_name
        : body.name !== undefined
          ? body.name
          : undefined;

    if (fullName !== undefined) {
      nextMetadata.full_name = fullName;
      nextMetadata.name = fullName;
    }

    if (body.username !== undefined) {
      nextMetadata.username = body.username || '';
    }

    if (body.company !== undefined) {
      nextMetadata.company = body.company || DEFAULT_COMPANY;
    }

    if (body.company_name !== undefined) {
      nextMetadata.company = body.company_name || DEFAULT_COMPANY;
    }

    if (body.avatar_url !== undefined) {
      nextMetadata.avatar_url = body.avatar_url || '';
    }

    if (body.language !== undefined) {
      nextMetadata.language = body.language || 'de';
    }

    if (body.timezone !== undefined) {
      nextMetadata.timezone = body.timezone || 'Europe/Zurich';
    }

    if (body.theme !== undefined) {
      nextMetadata.theme = body.theme || 'light';
    }

    if (body.notifications && typeof body.notifications === 'object') {
      nextMetadata.notifications = {
        ...existingNotifications,
        ...body.notifications,
      };
    }

    if (body.system_settings && typeof body.system_settings === 'object') {
      nextMetadata.system_settings = {
        ...existingSystemSettings,
        ...body.system_settings,
      };
    }

    const updateData: Record<string, any> = {
      metadata: nextMetadata,
      updated_at: new Date().toISOString(),
    };

    if (fullName !== undefined) {
      updateData.display_name = fullName || null;
    }

    if (body.phone !== undefined) {
      updateData.phone_raw = body.phone || null;
    }

    const { data: updatedRecord, error: updateError } = await supabase
      .from(profileSource.table)
      .update(updateData)
      .eq('id', profileSource.record.id)
      .select()
      .single();

    if (updateError) {
      console.error('Profile update error:', updateError);

      return jsonResponse(
        {
          success: false,
          error: 'Failed to update profile',
          details: updateError.message,
        },
        500
      );
    }

    const profile = buildProfile(updatedRecord, profileSource.source, user);

    return jsonResponse({
      success: true,
      profile,
      message: 'Profile updated successfully',
    });
  } catch (error: any) {
    console.error('Profile POST error:', error);

    const status =
      error?.message === 'Not authenticated' ||
      error?.message === 'Invalid authentication'
        ? 401
        : 500;

    return jsonResponse(
      {
        success: false,
        error: error?.message || 'Internal server error',
      },
      status
    );
  }
};