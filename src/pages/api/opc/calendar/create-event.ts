import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

type AnyRow = Record<string, any>;

type Payload = {
  id?: string;
  calendar_id: string;
  event_type:
    | 'job_requested'
    | 'job_scheduled'
    | 'job_active'
    | 'job_completed'
    | 'internal'
    | 'absence'
    | 'blocked_time';
  status:
    | 'draft'
    | 'requested'
    | 'pending_acceptance'
    | 'confirmed'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
    | 'declined';
  title: string;
  description?: string;
  starts_at: string;
  ends_at: string;
  timezone?: string;
  location_name?: string;
  location_address?: string;
  assigned_staff_role_ids?: string[];
  requires_acceptance?: boolean;
};

function getSupabaseUrl() {
  const value =
    import.meta.env.PUBLIC_SUPABASE_URL ||
    import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.SUPABASE_URL;

  if (!value) throw new Error('Missing Supabase URL.');
  return value;
}

function getAnonKey() {
  const value =
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.SUPABASE_ANON_KEY;

  if (!value) throw new Error('Missing Supabase anon key.');
  return value;
}

function getServiceKey() {
  const value =
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY ||
    import.meta.env.SUPABASE_SERVICE_KEY ||
    import.meta.env.SERVICE_ROLE_KEY;

  if (!value) throw new Error('Missing Supabase service role key.');
  return value;
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');

  if (header?.toLowerCase().startsWith('bearer ')) {
    return header.slice(7);
  }

  return null;
}

function createUserSupabase(request: Request) {
  const token = getBearerToken(request);

  return createClient(getSupabaseUrl(), getAnonKey(), {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function createServiceSupabase() {
  return createClient(getSupabaseUrl(), getServiceKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeRole(value: unknown): string {
  const role = String(value || '').toLowerCase().trim();

  if (role === 'owner') return 'owner';
  if (role === 'admin') return 'admin';
  if (role === 'dispatch' || role === 'dispatcher' || role === 'disposition') return 'dispatch';
  if (role === 'employee' || role === 'mitarbeiter') return 'employee';
  if (role === 'client' || role === 'kunde') return 'client';

  return 'client';
}

function canManageCalendar(role: string) {
  return ['owner', 'admin', 'dispatch'].includes(normalizeRole(role));
}

async function resolveCurrentRole(
  serviceSupabase: ReturnType<typeof createClient>,
  userId: string
) {
  const { data: profile } = await serviceSupabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  const profileRole = normalizeRole(
    profile?.role || profile?.opc_staff_role || profile?.staff_role || profile?.position
  );

  if (profileRole !== 'client') return profileRole;

  const { data: staffRole } = await serviceSupabase
    .from('opc_staff_roles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return normalizeRole(staffRole?.role || staffRole?.position || staffRole?.staff_role);
}

function validatePayload(payload: Payload) {
  if (!payload.calendar_id) throw new Error('calendar_id is required.');
  if (!payload.title?.trim()) throw new Error('title is required.');
  if (!payload.starts_at) throw new Error('starts_at is required.');
  if (!payload.ends_at) throw new Error('ends_at is required.');

  const start = new Date(payload.starts_at);
  const end = new Date(payload.ends_at);

  if (Number.isNaN(start.getTime())) throw new Error('starts_at is invalid.');
  if (Number.isNaN(end.getTime())) throw new Error('ends_at is invalid.');
  if (end <= start) throw new Error('ends_at must be after starts_at.');
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const userSupabase = createUserSupabase(request);
    const serviceSupabase = createServiceSupabase();

    const {
      data: { user },
      error: userError,
    } = await userSupabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
      });
    }

    const role = await resolveCurrentRole(serviceSupabase, user.id);

    if (!canManageCalendar(role)) {
      return new Response(
        JSON.stringify({
          error: 'You do not have permission to manage calendar events.',
          role,
        }),
        { status: 403 }
      );
    }

    const payload = (await request.json()) as Payload;
    validatePayload(payload);

    const { data: calendar, error: calendarError } = await serviceSupabase
      .from('opc_calendars')
      .select('*')
      .eq('id', payload.calendar_id)
      .maybeSingle();

    if (calendarError) throw calendarError;
    if (!calendar) throw new Error('Calendar not found.');

    const eventData = {
      calendar_id: payload.calendar_id,
      event_type: payload.event_type || 'internal',
      status: payload.requires_acceptance
        ? 'pending_acceptance'
        : payload.status || 'confirmed',
      title: payload.title.trim(),
      description: payload.description || null,
      starts_at: new Date(payload.starts_at).toISOString(),
      ends_at: new Date(payload.ends_at).toISOString(),
      timezone: payload.timezone || 'Europe/Zurich',
      location_name: payload.location_name || null,
      location_address: payload.location_address || null,
      requires_acceptance: Boolean(payload.requires_acceptance),
      updated_by: user.id,
    };

    let savedEvent: AnyRow;

    if (payload.id) {
      const { data, error } = await serviceSupabase
        .from('opc_calendar_events')
        .update(eventData)
        .eq('id', payload.id)
        .select('*')
        .single();

      if (error) throw error;
      savedEvent = data;
    } else {
      const { data, error } = await serviceSupabase
        .from('opc_calendar_events')
        .insert({
          ...eventData,
          created_by: user.id,
        })
        .select('*')
        .single();

      if (error) throw error;
      savedEvent = data;
    }

    const assignedStaffRoleIds = Array.from(
      new Set((payload.assigned_staff_role_ids || []).filter(Boolean))
    );

    if (payload.id) {
      const { error: deleteError } = await serviceSupabase
        .from('opc_calendar_event_attendees')
        .delete()
        .eq('event_id', payload.id);

      if (deleteError) throw deleteError;
    }

    if (assignedStaffRoleIds.length > 0) {
      const { data: staffRows, error: staffError } = await serviceSupabase
        .from('opc_staff_roles')
        .select('*')
        .in('id', assignedStaffRoleIds);

      if (staffError) throw staffError;

      const attendeeRows = assignedStaffRoleIds.map((staffRoleId) => {
        const staff = (staffRows || []).find((row: AnyRow) => row.id === staffRoleId);

        return {
          event_id: savedEvent.id,
          staff_role_id: staffRoleId,
          user_id: staff?.user_id || staff?.auth_user_id || null,
          attendee_role: 'assigned_worker',
          status: payload.requires_acceptance ? 'needs_action' : 'accepted',
          notified_at: null,
          notification_status: 'pending',
        };
      });

      const { error: attendeeError } = await serviceSupabase
        .from('opc_calendar_event_attendees')
        .insert(attendeeRows);

      if (attendeeError) throw attendeeError;
    }

    return new Response(JSON.stringify({ event: savedEvent }), {
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Calendar event could not be saved.',
      }),
      { status: 500 }
    );
  }
};