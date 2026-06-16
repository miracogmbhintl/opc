import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { getOpcSupabaseUrl, getOpcSupabaseAnonKey, getOpcSupabaseServiceRoleKey } from '../../../../lib/opc-server-env';

type AnyRow = Record<string, any>;

function getSupabaseUrl(locals?: any) {
  return getOpcSupabaseUrl(locals);
}

function getAnonKey(locals?: any) {
  return getOpcSupabaseAnonKey(locals);
}

function getServiceKey(locals?: any) {
  return getOpcSupabaseServiceRoleKey(locals);
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');

  if (header?.toLowerCase().startsWith('bearer ')) {
    return header.slice(7);
  }

  return null;
}

function createUserSupabase(request: Request, locals?: any) {
  const token = getBearerToken(request);

  return createClient(getSupabaseUrl(locals), getAnonKey(locals), {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function createServiceSupabase(locals?: any) {
  return createClient(getSupabaseUrl(locals), getServiceKey(locals), {
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
    employee_id: row.employee_id || null,
    name:
      row.display_name ||
      row.full_name ||
      row.name ||
      row.email ||
      row.phone_raw ||
      row.phone_e164 ||
      'Teammitglied',
    email: row.email || null,
    role,
    is_admin: isAdminRole(role),
    is_active: String(row.status || 'active').toLowerCase() === 'active',
    can_view_all_jobs: row.can_view_all_jobs === true,
    can_view_assigned_jobs: row.can_view_assigned_jobs === true,
    can_submit_time_logs: row.can_submit_time_logs === true,
  };
}

function chooseEffectiveRole(staffRows: AnyRow[], profileRole: string) {
  const activeRows = staffRows.filter(
    (row) => String(row.status || 'active').toLowerCase() === 'active'
  );

  if (activeRows.some((row) => normalizeRole(row.role) === 'owner')) return 'owner';
  if (activeRows.some((row) => normalizeRole(row.role) === 'admin')) return 'admin';
  if (activeRows.some((row) => normalizeRole(row.role) === 'dispatch')) return 'dispatch';
  if (activeRows.some((row) => normalizeRole(row.role) === 'employee')) return 'employee';

  return profileRole;
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
  const activeStaffRoleRows = staffRoleRows.filter(
    (row: AnyRow) => String(row.status || 'active').toLowerCase() === 'active'
  );

  const currentRole = chooseEffectiveRole(activeStaffRoleRows, profileRole);

  const staffRoleIds = activeStaffRoleRows
    .map((row: AnyRow) => row.id)
    .filter(Boolean);

  const employeeIds = activeStaffRoleRows
    .map((row: AnyRow) => row.employee_id)
    .filter(Boolean);

  const canViewAllJobs =
    isAdminRole(currentRole) ||
    activeStaffRoleRows.some((row: AnyRow) => row.can_view_all_jobs === true);

  const canViewAssignedJobs =
    canViewAllJobs ||
    activeStaffRoleRows.some((row: AnyRow) => row.can_view_assigned_jobs === true);

  return {
    currentRole,
    profile: profile || null,
    staffRoleIds,
    employeeIds,
    canViewAllJobs,
    canViewAssignedJobs,
  };
}

function isJobCalendarEvent(event: AnyRow) {
  const eventType = String(event.event_type || '').toLowerCase();

  return Boolean(
    event.job_id ||
      event.client_id ||
      event.client_site_id ||
      eventType.startsWith('job_')
  );
}


async function fetchAllRows(
  serviceSupabase: ReturnType<typeof createClient>,
  tableName: string,
  buildQuery: (from: number, to: number) => any,
  pageSize = 1000
) {
  const rows: AnyRow[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const result = await buildQuery(from, to);

    if (result.error) throw result.error;

    const page = result.data || [];
    rows.push(...page);

    if (page.length < pageSize) break;

    from += pageSize;
  }

  return rows;
}

function canEmployeeSeeEvent(
  event: AnyRow,
  calendarById: Map<string, AnyRow>,
  assignedJobIds: Set<string>,
  context: Awaited<ReturnType<typeof resolveCurrentUserContext>>,
  userId: string
) {
  const calendar = calendarById.get(event.calendar_id);

  if (!calendar) return false;

  const ownsCalendar =
    calendar.owner_user_id === userId ||
    (calendar.owner_staff_role_id && context.staffRoleIds.includes(calendar.owner_staff_role_id));

  if (ownsCalendar) return true;

  if (isJobCalendarEvent(event)) {
    if (!event.job_id) return false;
    return assignedJobIds.has(event.job_id);
  }

  if (calendar.calendar_type === 'team') {
    return true;
  }

  return false;
}

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const userSupabase = createUserSupabase(request, locals);
    const serviceSupabase = createServiceSupabase(locals);

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
    const normalizedCurrentRole = normalizeRole(currentRole);

    const [calendarsResult, staffResult, notificationsResult] = await Promise.all([
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
      if (context.canViewAllJobs || isAdminRole(currentRole)) return true;

      if (normalizedCurrentRole === 'employee') {
        return (
          calendar.calendar_type === 'team' ||
          calendar.owner_user_id === user.id ||
          context.staffRoleIds.includes(calendar.owner_staff_role_id)
        );
      }

      return calendar.owner_user_id === user.id;
    });

    const visibleCalendarIds = visibleCalendars.map((calendar: AnyRow) => calendar.id);
    const calendarById = new Map(visibleCalendars.map((calendar: AnyRow) => [calendar.id, calendar]));

    let assignedJobIds = new Set<string>();

    if (
      !context.canViewAllJobs &&
      normalizedCurrentRole === 'employee' &&
      context.canViewAssignedJobs &&
      context.employeeIds.length > 0
    ) {
      const { data: assignedRows, error: assignedError } = await serviceSupabase
        .from('opc_job_assignments')
        .select('job_id')
        .in('employee_id', context.employeeIds)
        .not('job_id', 'is', null);

      if (assignedError) throw assignedError;

      assignedJobIds = new Set(
        (assignedRows || [])
          .map((row: AnyRow) => row.job_id)
          .filter(Boolean)
      );
    }

    let events: AnyRow[] = [];
    let attendees: AnyRow[] = [];

    if (visibleCalendarIds.length > 0) {
      const timeMin = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString();
      const timeMax = new Date(Date.now() + 1000 * 60 * 60 * 24 * 400).toISOString();

      const rawEvents = await fetchAllRows(
        serviceSupabase,
        'opc_calendar_events',
        (from, to) =>
          serviceSupabase
            .from('opc_calendar_events')
            .select('*')
            .in('calendar_id', visibleCalendarIds)
            .gte('ends_at', timeMin)
            .lte('starts_at', timeMax)
            .order('starts_at', { ascending: true })
            .range(from, to)
      );

      events =
        context.canViewAllJobs || isAdminRole(currentRole)
          ? rawEvents
          : rawEvents.filter((event: AnyRow) =>
              canEmployeeSeeEvent(event, calendarById, assignedJobIds, context, user.id)
            );

      attendees = await fetchAllRows(
        serviceSupabase,
        'opc_calendar_event_attendees',
        (from, to) =>
          serviceSupabase
            .from('opc_calendar_event_attendees')
            .select('*')
            .order('created_at', { ascending: true })
            .range(from, to)
      );
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
        currentEmployeeIds: context.employeeIds,
        canViewAllJobs: context.canViewAllJobs,
        canViewAssignedJobs: context.canViewAssignedJobs,
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
