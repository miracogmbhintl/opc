import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_NOTIFICATIONS = {
  projectUpdates: true,
  newMessages: true,
  fileUploads: true,
  billing: true,
  dispatchAlerts: true,
  reportApprovals: true,
  pushNotifications: false,
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
    console.error('[Notifications API] No authentication token found', {
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

  console.error('[Notifications API] All tokens invalid', {
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

function normalizeNotificationBody(body: Record<string, any>) {
  return {
    projectUpdates:
      body.projectUpdates ??
      body.notify_project_updates ??
      DEFAULT_NOTIFICATIONS.projectUpdates,

    newMessages:
      body.newMessages ??
      body.notify_new_messages ??
      DEFAULT_NOTIFICATIONS.newMessages,

    fileUploads:
      body.fileUploads ??
      body.notify_file_uploads ??
      DEFAULT_NOTIFICATIONS.fileUploads,

    billing:
      body.billing ??
      body.notify_billing ??
      DEFAULT_NOTIFICATIONS.billing,

    dispatchAlerts:
      body.dispatchAlerts ??
      body.notify_dispatch_alerts ??
      DEFAULT_NOTIFICATIONS.dispatchAlerts,

    reportApprovals:
      body.reportApprovals ??
      body.notify_report_approvals ??
      DEFAULT_NOTIFICATIONS.reportApprovals,

    pushNotifications:
      body.pushNotifications ??
      body.push_notifications_enabled ??
      DEFAULT_NOTIFICATIONS.pushNotifications,
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

    const metadata = normalizeMetadata(profileSource.record.metadata);

    const preferences = {
      ...DEFAULT_NOTIFICATIONS,
      ...(metadata.notifications || {}),
    };

    return jsonResponse({
      success: true,
      preferences,
    });
  } catch (error: any) {
    console.error('Notification GET error:', error);

    const status =
      error?.message === 'Not authenticated' ||
      error?.message === 'Invalid authentication'
        ? 401
        : 500;

    return jsonResponse(
      {
        success: false,
        error: error?.message || 'Failed to load notification preferences',
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
    const incomingPreferences = normalizeNotificationBody(body);

    const metadata = normalizeMetadata(profileSource.record.metadata);

    const nextMetadata = {
      ...metadata,
      notifications: {
        ...DEFAULT_NOTIFICATIONS,
        ...(metadata.notifications || {}),
        ...incomingPreferences,
      },
    };

    const { data: updatedRecord, error: updateError } = await supabase
      .from(profileSource.table)
      .update({
        metadata: nextMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileSource.record.id)
      .select()
      .single();

    if (updateError) {
      console.error('Notification preferences update error:', updateError);

      return jsonResponse(
        {
          success: false,
          error: 'Failed to update notification preferences',
          details: updateError.message,
        },
        500
      );
    }

    const updatedMetadata = normalizeMetadata(updatedRecord.metadata);

    return jsonResponse({
      success: true,
      preferences: {
        ...DEFAULT_NOTIFICATIONS,
        ...(updatedMetadata.notifications || {}),
      },
      message: 'Notification preferences updated successfully',
    });
  } catch (error: any) {
    console.error('Notification POST error:', error);

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