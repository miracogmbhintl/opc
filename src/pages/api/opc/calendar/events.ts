import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

type AnyRow = Record<string, any>;

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

function isAdminRole(role: string) {
  return ['owner', 'admin', 'dispatch'].includes(normalizeRole(role));
}

function normalizeStaff(row: AnyRow) {
  const role = normalizeRole(row.role || row.position || row.staff_role);

  return {
    id: row.id,
    user_id: row.user_id || row.auth_user_id || null,
    name:
      row.display_name ||
      row.full_name ||
      row.name ||
      row.email ||
      row.phone_raw ||
      row.phone_e164 ||
      'Teammitglied',
    role,
    is_admin: isAdminRole(role),
    is_active: String(row.status || 'active').toLowerCase() === 'active',
  };
}

async function resolveCurrentUserContext(
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

  const { data: staffRoles } = await serviceSupabase
    .from('opc_staff_roles')
    .select('*')
    .eq('user_id', userId);

  const staffRoleRows = staffRoles || [];
  const firstStaffRole = staffRoleRows[0];

  const staffRole = normalizeRole(
    firstStaffRole?.role || firstStaffRole?.position || firstStaffRole?.staff_role
  );

  // OPC staff permissions are the source of truth for internal users.
  // This prevents an old user_profiles.role value such as admin/owner from
  // giving an employee planning rights in the calendar.
  const currentRole = firstStaffRole ? staffRole : profileRole;

  return {
    currentRole,
    profile: profile || null,
    staffRoleIds: staffRoleRows.map((row: AnyRow) => row.id).filter(Boolean),
  };
}

export const GET: APIRoute = async ({ request }) => {
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

    const context = await resolveCurrentUserContext(serviceSupabase, user.id);
    const currentRole = context.currentRole;

    const [
      calendarsResult,
      staffResult,
      notificationsResult,
    ] = await Promise.all([
      serviceSupabase
        .from('opc_calendars')
        .select('*')
        .eq('is_active', true)
        .order('calendar_type', { ascending: true })
        .order('name', { ascending: true }),

      serviceSupabase
        .from('opc_staff_roles')
        .select('*')
        .order('created_at', { ascending: true }),

      serviceSupabase
        .from('opc_calendar_notifications')
        .select('*')
        .or(
          [
            `recipient_user_id.eq.${user.id}`,
            context.staffRoleIds.length > 0
              ? `recipient_staff_role_id.in.(${context.staffRoleIds.join(',')})`
              : 'recipient_staff_role_id.is.null',
          ].join(',')
        )
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (calendarsResult.error) throw calendarsResult.error;
    if (staffResult.error) throw staffResult.error;

    const allCalendars = calendarsResult.data || [];

    const visibleCalendars = allCalendars.filter((calendar: AnyRow) => {
      if (isAdminRole(currentRole)) return true;

      if (normalizeRole(currentRole) === 'employee') {
        return (
          calendar.calendar_type === 'employee' ||
          calendar.calendar_type === 'team' ||
          calendar.owner_user_id === user.id ||
          context.staffRoleIds.includes(calendar.owner_staff_role_id)
        );
      }

      return calendar.owner_user_id === user.id;
    });

    const visibleCalendarIds = visibleCalendars.map((calendar: AnyRow) => calendar.id);

    let events: AnyRow[] = [];
    let attendees: AnyRow[] = [];

    if (visibleCalendarIds.length > 0) {
      const [eventsResult, attendeesResult] = await Promise.all([
        serviceSupabase
          .from('opc_calendar_events')
          .select('*')
          .in('calendar_id', visibleCalendarIds)
          .gte('ends_at', new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString())
          .lte('starts_at', new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString())
          .order('starts_at', { ascending: true }),

        serviceSupabase
          .from('opc_calendar_event_attendees')
          .select('*')
          .order('created_at', { ascending: true }),
      ]);

      if (eventsResult.error) throw eventsResult.error;
      if (attendeesResult.error) throw attendeesResult.error;

      events = eventsResult.data || [];
      attendees = attendeesResult.data || [];
    }

    const eventsWithAttendees = events.map((event: AnyRow) => ({
      ...event,
      attendees: attendees.filter((attendee: AnyRow) => attendee.event_id === event.id),
    }));

    const staff = (staffResult.data || [])
      .map(normalizeStaff)
      .filter((row) => row.id && row.is_active);

    return new Response(
      JSON.stringify({
        calendars: visibleCalendars,
        events: eventsWithAttendees,
        staff,
        notifications: notificationsResult.error ? [] : notificationsResult.data || [],
        currentUserId: user.id,
        currentRole,
      }),
      { status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Calendar data could not be loaded.',
      }),
      { status: 500 }
    );
  }
};