import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { getOpcSupabaseUrl, getOpcSupabaseAnonKey, getOpcSupabaseServiceRoleKey } from '../../../lib/opc-server-env';
import { resolveOpcAssignmentCandidates } from '../../../lib/opc-assignment-candidates';

export const prerender = false;


type JsonRecord = Record<string, any>;

type RecurrenceType = 'none' | 'daily' | 'weekdays' | 'monthly_count';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function requireString(value: unknown, label: string) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} fehlt.`);
  }

  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function optionalUuid(value: unknown, label: string) {
  const text = optionalString(value);
  if (!text) return null;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(`${label} enthält keine gültige UUID.`);
  }

  return text;
}

function compactPayload(payload: JsonRecord) {
  const copy: JsonRecord = { ...payload };

  Object.keys(copy).forEach((key) => {
    if (copy[key] === null || copy[key] === undefined || copy[key] === '') {
      delete copy[key];
    }
  });

  return copy;
}

function toDateOnly(date: Date) {
  const copy = new Date(date.getTime());
  const offset = copy.getTimezoneOffset();
  const local = new Date(copy.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function clampDay(year: number, monthIndex: number, day: number) {
  return Math.min(Math.max(1, day), daysInMonth(year, monthIndex));
}

function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toIsoDateTime(dateOnly: string, time: string) {
  return new Date(`${dateOnly}T${time}:00`).toISOString();
}

function getTimeFromIso(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '08:00';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function normalizeJsDayToUserDay(jsDay: number) {
  return jsDay === 0 ? 7 : jsDay;
}

function buildOccurrenceDates({
  startDate,
  endDate,
  recurrenceType,
  weekdays,
  monthlyCount,
}: {
  startDate: string;
  endDate: string;
  recurrenceType: RecurrenceType;
  weekdays: number[];
  monthlyCount: number;
}) {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (!start || !end) {
    throw new Error('Startdatum oder Enddatum der Wiederholung ist ungültig.');
  }

  if (end.getTime() < start.getTime()) {
    throw new Error('Das Enddatum der Wiederholung muss nach dem Startdatum liegen.');
  }

  if (recurrenceType === 'none') {
    return [startDate];
  }

  const dates = new Set<string>();

  if (recurrenceType === 'daily') {
    let cursor = start;
    while (cursor.getTime() <= end.getTime()) {
      dates.add(toDateOnly(cursor));
      cursor = addDays(cursor, 1);
    }
  }

  if (recurrenceType === 'weekdays') {
    if (!weekdays.length) {
      throw new Error('Bitte mindestens einen Wochentag auswählen.');
    }

    let cursor = start;
    while (cursor.getTime() <= end.getTime()) {
      const userDay = normalizeJsDayToUserDay(cursor.getDay());
      if (weekdays.includes(userDay)) {
        dates.add(toDateOnly(cursor));
      }
      cursor = addDays(cursor, 1);
    }
  }

  if (recurrenceType === 'monthly_count') {
    const safeCount = Math.max(1, Math.min(4, Number(monthlyCount || 1)));
    const startDay = start.getDate();
    const step = safeCount === 1 ? 0 : Math.floor(28 / safeCount);
    let monthCursor = new Date(start.getFullYear(), start.getMonth(), 1);

    while (monthCursor.getTime() <= end.getTime()) {
      const year = monthCursor.getFullYear();
      const month = monthCursor.getMonth();

      for (let index = 0; index < safeCount; index += 1) {
        const day = clampDay(year, month, startDay + index * step);
        const candidate = new Date(year, month, day);

        if (candidate.getTime() >= start.getTime() && candidate.getTime() <= end.getTime()) {
          dates.add(toDateOnly(candidate));
        }
      }

      monthCursor = new Date(year, month + 1, 1);
    }
  }

  const sorted = Array.from(dates).sort();

  if (!sorted.length) {
    throw new Error('Aus den Wiederholungseinstellungen konnte kein Einsatzdatum erstellt werden.');
  }

  if (sorted.length > 400) {
    throw new Error('Zu viele Einsätze auf einmal. Bitte Zeitraum reduzieren oder später schrittweise erweitern.');
  }

  return sorted;
}

async function tryInsertOne(adminClient: any, table: string, variants: JsonRecord[]) {
  let lastError: any = null;

  for (const variant of variants) {
    const payload = compactPayload(variant);
    const { data, error } = await adminClient.from(table).insert(payload).select('*').limit(1);

    if (!error) {
      return Array.isArray(data) ? data[0] : data;
    }

    lastError = error;
  }

  throw new Error(lastError?.message || `${table}: Insert fehlgeschlagen.`);
}

async function insertRecurringSeries(adminClient: any, payload: JsonRecord) {
  const compact = compactPayload(payload);
  const { data, error } = await adminClient
    .from('opc_recurring_job_series')
    .insert(compact)
    .select('id')
    .single();

  if (error) {
    throw new Error(
      `Wiederkehrende Serie konnte nicht erstellt werden. Prüfe die Migration opc_recurring_jobs_migration.sql. Originalfehler: ${error.message}`,
    );
  }

  return data?.id || null;
}

async function insertJobs(adminClient: any, payloads: JsonRecord[]): Promise<string[]> {
  const withRecurringColumns = payloads.map((payload) => compactPayload(payload));

  const { data, error } = await adminClient
    .from('opc_service_jobs')
    .insert(withRecurringColumns)
    .select('id');

  if (!error && Array.isArray(data)) {
    return data.map((row: JsonRecord) => String(row.id)).filter(Boolean);
  }

  const recurringColumnError = String(error?.message || '').toLowerCase();

  const canFallback =
    recurringColumnError.includes('recurring_series_id') ||
    recurringColumnError.includes('occurrence_date') ||
    recurringColumnError.includes('occurrence_key') ||
    recurringColumnError.includes('series_version') ||
    recurringColumnError.includes('quote_id') ||
    recurringColumnError.includes('order_confirmation_id') ||
    recurringColumnError.includes('billing_status') ||
    recurringColumnError.includes('invoice_id');

  if (!canFallback) {
    throw new Error(error?.message || 'Einsätze konnten nicht erstellt werden.');
  }

  const fallbackPayloads = payloads.map((payload) => {
    const copy = { ...payload };
    delete copy.recurring_series_id;
    delete copy.occurrence_date;
    delete copy.occurrence_key;
    delete copy.series_version;
    delete copy.quote_id;
    delete copy.order_confirmation_id;
    delete copy.billing_status;
    delete copy.invoice_id;
    return compactPayload(copy);
  });

  const fallback = await adminClient.from('opc_service_jobs').insert(fallbackPayloads).select('id');

  if (fallback.error || !Array.isArray(fallback.data)) {
    throw new Error(fallback.error?.message || 'Einsätze konnten nicht erstellt werden.');
  }

  return fallback.data.map((row: JsonRecord) => String(row.id)).filter(Boolean);
}

function buildAssignmentVariants({
  jobId,
  employee,
  note,
  staffRoleId,
  userId,
}: {
  jobId: string;
  employee: JsonRecord;
  note?: string | null;
  staffRoleId?: string | null;
  userId?: string | null;
}) {
  const now = new Date().toISOString();
  const employeeStaffId = employee.staff_role_id || null;
  const employeeUserId = employee.user_id || null;
  const employeeExternalId = employee.employee_id || employee.id || null;
  const assignedBy = staffRoleId || userId || null;

  return [
    {
      job_id: jobId,
      employee_id: employeeExternalId,
      staff_role_id: employeeStaffId,
      user_id: employeeUserId,
      employee_name: employee.display_name || employee.email || 'Mitarbeiter',
      employee_email: employee.email || null,
      employee_phone: employee.phone_e164 || employee.phone_raw || null,
      status: 'assigned',
      notes: note || null,
      assigned_by: assignedBy,
      created_at: now,
      updated_at: now,
    },
    {
      job_id: jobId,
      employee_id: employeeExternalId,
      user_id: employeeUserId,
      status: 'assigned',
      notes: note || null,
      assigned_by: assignedBy,
      created_at: now,
      updated_at: now,
    },
    {
      job_id: jobId,
      staff_role_id: employeeStaffId,
      user_id: employeeUserId,
      status: 'assigned',
      notes: note || null,
      assigned_by: assignedBy,
      created_at: now,
      updated_at: now,
    },
    {
      job_id: jobId,
      staff_id: employeeStaffId,
      status: 'assigned',
      notes: note || null,
      assigned_by: assignedBy,
      created_at: now,
      updated_at: now,
    },
    {
      job_id: jobId,
      user_id: employeeUserId,
      status: 'assigned',
      notes: note || null,
      assigned_by: assignedBy,
      created_at: now,
      updated_at: now,
    },
    {
      job_id: jobId,
      assigned_to: employeeUserId || employeeExternalId || employeeStaffId,
      status: 'assigned',
      notes: note || null,
      assigned_by: assignedBy,
      created_at: now,
      updated_at: now,
    },
  ].filter(
    (payload) =>
      Boolean(payload.employee_id) ||
      Boolean(payload.staff_role_id) ||
      Boolean(payload.staff_id) ||
      Boolean(payload.user_id) ||
      Boolean(payload.assigned_to),
  );
}


async function trySelectRows(
  adminClient: any,
  table: string,
  attempts: Array<{
    select: string;
    apply?: (query: any) => any;
  }>,
) {
  let lastError: any = null;

  for (const attempt of attempts) {
    try {
      let query = adminClient.from(table).select(attempt.select);
      if (attempt.apply) query = attempt.apply(query);
      const { data, error } = await query;

      if (!error) {
        return Array.isArray(data) ? data : [];
      }

      lastError = error;
    } catch (error) {
      lastError = error;
    }
  }

  return [];
}

async function tryInsertCalendarEvent(adminClient: any, variants: JsonRecord[]) {
  try {
    return await tryInsertOne(adminClient, 'opc_calendar_events', variants);
  } catch (error) {
    return null;
  }
}

async function tryInsertCalendarAttendee(adminClient: any, variants: JsonRecord[]) {
  try {
    return await tryInsertOne(adminClient, 'opc_calendar_event_attendees', variants);
  } catch (error) {
    return null;
  }
}

async function tryCreateTeamCalendar(adminClient: any, userId: string, staffRoleId?: string | null) {
  const now = new Date().toISOString();

  const variants = [
    {
      name: 'Orange Pro Clean Team',
      title: 'Orange Pro Clean Team',
      calendar_name: 'Orange Pro Clean Team',
      calendar_type: 'team',
      scope: 'team',
      owner_type: 'team',
      is_team_calendar: true,
      is_active: true,
      created_by: userId,
      created_by_user_id: userId,
      created_by_staff_role_id: staffRoleId || null,
      created_at: now,
      updated_at: now,
    },
    {
      name: 'Orange Pro Clean Team',
      calendar_type: 'team',
      scope: 'team',
      is_active: true,
      created_by_user_id: userId,
      created_at: now,
      updated_at: now,
    },
    {
      name: 'Orange Pro Clean Team',
      type: 'team',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      name: 'Orange Pro Clean Team',
      created_at: now,
      updated_at: now,
    },
  ];

  try {
    return await tryInsertOne(adminClient, 'opc_calendars', variants);
  } catch {
    return null;
  }
}

async function findOrCreateTeamCalendar(adminClient: any, userId: string, staffRoleId?: string | null) {
  const rows = await trySelectRows(adminClient, 'opc_calendars', [
    {
      select: 'id,name,title,calendar_name,calendar_type,scope,is_team_calendar,owner_type,is_active',
      apply: (query) => query.eq('is_team_calendar', true).limit(1),
    },
    {
      select: 'id,name,title,calendar_name,calendar_type,scope,owner_type,is_active',
      apply: (query) => query.or('calendar_type.eq.team,scope.eq.team,owner_type.eq.team').limit(1),
    },
    {
      select: 'id,name,title,calendar_name,is_active',
      apply: (query) => query.ilike('name', '%Orange Pro Clean%').limit(1),
    },
    {
      select: 'id,name,title,calendar_name,is_active',
      apply: (query) => query.ilike('calendar_name', '%Orange Pro Clean%').limit(1),
    },
    {
      select: 'id',
      apply: (query) => query.limit(1),
    },
  ]);

  if (rows[0]?.id) return rows[0];

  const created = await tryCreateTeamCalendar(adminClient, userId, staffRoleId);
  return created?.id ? created : null;
}

async function findEmployeeCalendar(adminClient: any, employee: JsonRecord) {
  const staffRoleId = employee.staff_role_id ? String(employee.staff_role_id) : null;
  const userId = employee.user_id ? String(employee.user_id) : null;
  const employeeId = employee.employee_id || employee.id
    ? String(employee.employee_id || employee.id)
    : null;

  const attempts: Array<{ select: string; apply?: (query: any) => any }> = [];

  if (staffRoleId) {
    attempts.push({
      select: 'id,staff_role_id,user_id,employee_id,name,title,calendar_name,is_active',
      apply: (query) => query.eq('staff_role_id', staffRoleId).limit(1),
    });
  }

  if (userId) {
    attempts.push({
      select: 'id,staff_role_id,user_id,employee_id,name,title,calendar_name,is_active',
      apply: (query) => query.eq('user_id', userId).limit(1),
    });
  }

  if (employeeId) {
    attempts.push({
      select: 'id,staff_role_id,user_id,employee_id,name,title,calendar_name,is_active',
      apply: (query) => query.eq('employee_id', employeeId).limit(1),
    });
  }

  attempts.push({
    select: 'id',
    apply: (query) => query.limit(0),
  });

  const rows = await trySelectRows(adminClient, 'opc_calendars', attempts);
  return rows[0]?.id ? rows[0] : null;
}

function buildCalendarEventVariants({
  calendarId,
  jobId,
  jobPayload,
  site,
  title,
  description,
  createdByUserId,
  createdByStaffRoleId,
  recurrenceEnabled,
  recurringSeriesId,
  calendarScope,
}: {
  calendarId: string;
  jobId: string;
  jobPayload: JsonRecord;
  site: JsonRecord;
  title: string;
  description: string | null;
  createdByUserId: string;
  createdByStaffRoleId?: string | null;
  recurrenceEnabled: boolean;
  recurringSeriesId?: string | null;
  calendarScope: 'team' | 'employee';
}) {
  const now = new Date().toISOString();
  const start = jobPayload.planned_start;
  const end = jobPayload.planned_end;
  const location = [site.address_text, site.postal_code, site.city, site.country].filter(Boolean).join(', ');
  const metadata = {
    source: 'create_service_job_api',
    source_type: 'service_job',
    source_job_id: jobId,
    job_id: jobId,
    client_id: jobPayload.client_id,
    client_site_id: jobPayload.client_site_id,
    recurring_series_id: recurringSeriesId || null,
    recurrence_enabled: recurrenceEnabled,
    occurrence_date: jobPayload.occurrence_date || null,
    calendar_scope: calendarScope,
    needs_google_sync: true,
    google_sync_status: 'pending',
  };

  return [
    {
      calendar_id: calendarId,
      job_id: jobId,
      title,
      description,
      location,
      starts_at: start,
      ends_at: end,
      start_time: start,
      end_time: end,
      event_type: 'job',
      status: 'confirmed',
      visibility: 'default',
      transparency: 'opaque',
      sync_status: 'pending',
      google_sync_status: 'pending',
      created_by: createdByStaffRoleId || createdByUserId,
      created_by_user_id: createdByUserId,
      created_by_staff_role_id: createdByStaffRoleId || null,
      metadata,
      created_at: now,
      updated_at: now,
    },
    {
      calendar_id: calendarId,
      related_job_id: jobId,
      source_id: jobId,
      source_type: 'service_job',
      title,
      description,
      location,
      start_time: start,
      end_time: end,
      status: 'confirmed',
      sync_status: 'pending',
      created_by_user_id: createdByUserId,
      metadata,
      created_at: now,
      updated_at: now,
    },
    {
      calendar_id: calendarId,
      job_id: jobId,
      title,
      starts_at: start,
      ends_at: end,
      status: 'confirmed',
      metadata,
      created_at: now,
      updated_at: now,
    },
    {
      calendar_id: calendarId,
      title,
      start_time: start,
      end_time: end,
      location,
      description,
      metadata,
      created_at: now,
      updated_at: now,
    },
  ];
}

function buildCalendarAttendeeVariants({
  eventId,
  employee,
}: {
  eventId: string;
  employee: JsonRecord;
}) {
  const now = new Date().toISOString();
  const name = employee.display_name || employee.email || 'Mitarbeiter';

  return [
    {
      event_id: eventId,
      staff_role_id: employee.staff_role_id || null,
      user_id: employee.user_id || null,
      employee_id: employee.employee_id || employee.id || null,
      email: employee.email || null,
      display_name: name,
      response_status: 'accepted',
      attendance_status: 'accepted',
      status: 'accepted',
      created_at: now,
      updated_at: now,
    },
    {
      calendar_event_id: eventId,
      attendee_staff_role_id: employee.staff_role_id || null,
      attendee_user_id: employee.user_id || null,
      attendee_email: employee.email || null,
      response_status: 'accepted',
      created_at: now,
      updated_at: now,
    },
    {
      event_id: eventId,
      user_id: employee.user_id || null,
      email: employee.email || null,
      status: 'accepted',
      created_at: now,
    },
  ];
}

async function createCalendarEntriesForJobs({
  adminClient,
  jobIds,
  jobPayloads,
  site,
  employees,
  createdByUserId,
  createdByStaffRoleId,
  recurrenceEnabled,
  recurringSeriesId,
}: {
  adminClient: any;
  jobIds: string[];
  jobPayloads: JsonRecord[];
  site: JsonRecord;
  employees: JsonRecord[];
  createdByUserId: string;
  createdByStaffRoleId?: string | null;
  recurrenceEnabled: boolean;
  recurringSeriesId?: string | null;
}) {
  const result = {
    attempted: 0,
    created: 0,
    attendee_links: 0,
    team_calendar_id: null as string | null,
    employee_calendar_events: 0,
    warnings: [] as string[],
  };

  const teamCalendar = await findOrCreateTeamCalendar(adminClient, createdByUserId, createdByStaffRoleId);

  if (!teamCalendar?.id) {
    result.warnings.push('Kein OPC-Teamkalender gefunden oder erstellbar. Jobs und Zuweisungen wurden trotzdem erstellt.');
    return result;
  }

  result.team_calendar_id = String(teamCalendar.id);

  for (let index = 0; index < jobIds.length; index += 1) {
    const jobId = jobIds[index];
    const jobPayload = jobPayloads[index];
    const title = jobPayload.title || 'Einsatz';
    const description = [
      jobPayload.service_category ? `Dienstleistung: ${jobPayload.service_category}` : '',
      jobPayload.service_description ? `Beschreibung: ${jobPayload.service_description}` : '',
      jobPayload.dispatcher_notes ? `Dispo-Hinweise: ${jobPayload.dispatcher_notes}` : '',
      jobPayload.internal_notes ? `Interne Hinweise: ${jobPayload.internal_notes}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    result.attempted += 1;

    const teamEvent = await tryInsertCalendarEvent(
      adminClient,
      buildCalendarEventVariants({
        calendarId: String(teamCalendar.id),
        jobId,
        jobPayload,
        site,
        title,
        description: description || null,
        createdByUserId,
        createdByStaffRoleId,
        recurrenceEnabled,
        recurringSeriesId,
        calendarScope: 'team',
      }),
    );

    const teamEventId = teamEvent?.id || teamEvent?.event_id || teamEvent?.calendar_event_id || null;

    if (teamEventId) {
      result.created += 1;

      for (const employee of employees) {
        const attendee = await tryInsertCalendarAttendee(
          adminClient,
          buildCalendarAttendeeVariants({
            eventId: String(teamEventId),
            employee,
          }),
        );

        if (attendee) result.attendee_links += 1;
      }
    } else {
      result.warnings.push(`Kalendereintrag für Einsatz ${jobId} konnte nicht erstellt werden.`);
    }
  }

  for (const employee of employees) {
    const employeeCalendar = await findEmployeeCalendar(adminClient, employee);
    if (!employeeCalendar?.id || String(employeeCalendar.id) === String(teamCalendar.id)) continue;

    for (let index = 0; index < jobIds.length; index += 1) {
      const jobId = jobIds[index];
      const jobPayload = jobPayloads[index];
      const employeeEvent = await tryInsertCalendarEvent(
        adminClient,
        buildCalendarEventVariants({
          calendarId: String(employeeCalendar.id),
          jobId,
          jobPayload,
          site,
          title: jobPayload.title || 'Einsatz',
          description: jobPayload.service_description || null,
          createdByUserId,
          createdByStaffRoleId,
          recurrenceEnabled,
          recurringSeriesId,
          calendarScope: 'employee',
        }),
      );

      if (employeeEvent) result.employee_calendar_events += 1;
    }
  }

  return result;
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const SUPABASE_URL = getOpcSupabaseUrl(locals);
    const SUPABASE_ANON_KEY = getOpcSupabaseAnonKey(locals);
    const SUPABASE_SERVICE_ROLE_KEY = getOpcSupabaseServiceRoleKey(locals);

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse(
        {
          error:
            'Supabase server configuration is missing. Check PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.',
        },
        500,
      );
    }

    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return jsonResponse({ error: 'Nicht angemeldet.' }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: 'Session ist ungültig oder abgelaufen.' }, 401);
    }

    const { data: staffRole, error: staffError } = await adminClient
      .from('opc_staff_roles')
      .select(
        `
        id,
        user_id,
        role,
        status,
        can_access_portal,
        can_manage_jobs
      `,
      )
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (staffError) {
      return jsonResponse({ error: staffError.message }, 500);
    }

    const allowedRoles = ['owner', 'admin', 'dispatch'];
    const isAllowed =
      staffRole &&
      staffRole.can_access_portal === true &&
      staffRole.can_manage_jobs === true &&
      allowedRoles.includes(staffRole.role);

    if (!isAllowed) {
      return jsonResponse({ error: 'Keine Berechtigung, Einsätze zu erstellen.' }, 403);
    }

    const body = await request.json();

    const clientId = requireString(body.client_id, 'Kunde');
    const clientSiteId = requireString(body.client_site_id, 'Standort');
    const title = requireString(body.title, 'Titel');
    const plannedStart = requireString(body.planned_start, 'Startzeit');
    const plannedEnd = requireString(body.planned_end, 'Endzeit');
    const serviceCategory = requireString(body.service_category, 'Dienstleistung');
    const quoteId = optionalUuid(body.quote_id, 'Offerte');
    const orderConfirmationId = optionalUuid(
      body.order_confirmation_id,
      'Auftragsbestätigung',
    );

    const startDate = optionalString(body.planned_date) || plannedStart.slice(0, 10);
    const startTime = optionalString(body.start_time) || getTimeFromIso(plannedStart);
    const endTime = optionalString(body.end_time) || getTimeFromIso(plannedEnd);

    const recurrence = body.recurrence && typeof body.recurrence === 'object' ? body.recurrence : {};
    const recurrenceEnabled = recurrence.enabled === true && recurrence.type && recurrence.type !== 'none';
    const recurrenceType: RecurrenceType = recurrenceEnabled ? recurrence.type : 'none';
    const recurrenceEndDate = recurrenceEnabled
      ? requireString(recurrence.end_date, 'Enddatum der Wiederholung')
      : startDate;
    const recurrenceWeekdays = Array.isArray(recurrence.weekdays)
      ? recurrence.weekdays.map((value: unknown) => Number(value)).filter((value: number) => Number.isFinite(value))
      : [];
    const monthlyCount = Number(recurrence.monthly_count || 1);

    const occurrenceDates = buildOccurrenceDates({
      startDate,
      endDate: recurrenceEndDate,
      recurrenceType,
      weekdays: recurrenceWeekdays,
      monthlyCount,
    });

    const { data: site, error: siteError } = await adminClient
      .from('opc_client_sites')
      .select('id, client_id, contact_id, site_name, address_text, postal_code, city, country')
      .eq('id', clientSiteId)
      .eq('client_id', clientId)
      .single();

    if (siteError || !site) {
      return jsonResponse(
        {
          error: 'Der ausgewählte Standort gehört nicht zu diesem Kunden oder wurde nicht gefunden.',
        },
        400,
      );
    }

    let recurringSeriesId: string | null = null;

    if (recurrenceEnabled) {
      recurringSeriesId = await insertRecurringSeries(adminClient, {
        title,
        client_id: clientId,
        client_site_id: clientSiteId,
        service_category: serviceCategory,
        service_description: body.service_description || null,
        priority: body.priority || 'normal',
        estimated_hours: Number(body.estimated_hours || 0),
        planned_start_time: startTime,
        planned_end_time: endTime,
        start_date: startDate,
        end_date: recurrenceEndDate,
        recurrence_type: recurrenceType,
        weekdays: recurrenceWeekdays.length ? recurrenceWeekdays : null,
        monthly_count: recurrenceType === 'monthly_count' ? monthlyCount : null,
        status: 'active',
        created_by: user.id,
        metadata: {
          ...(body.metadata || {}),
          created_via: 'portal_api',
          created_by_user_id: user.id,
          created_by_staff_role_id: staffRole.id,
          period_preset: recurrence.period_preset || null,
          quote_id: quoteId,
          source_quote_id: quoteId,
          order_confirmation_id: orderConfirmationId,
        },
      });
    }

    const jobPayloads = occurrenceDates.map((occurrenceDate, index) => {
      const occurrenceStart = recurrenceEnabled ? toIsoDateTime(occurrenceDate, startTime) : plannedStart;
      const occurrenceEnd = recurrenceEnabled ? toIsoDateTime(occurrenceDate, endTime) : plannedEnd;

      return {
        quote_id: quoteId,
        order_confirmation_id: orderConfirmationId,
        billing_status: 'not_ready',
        client_id: clientId,
        client_site_id: clientSiteId,
        contact_id: body.contact_id || site.contact_id || null,
        title,
        job_type: body.job_type || (recurrenceEnabled ? 'recurring' : 'cleaning'),
        status: body.status || 'scheduled',
        priority: body.priority || 'normal',
        planned_start: occurrenceStart,
        planned_end: occurrenceEnd,
        service_category: serviceCategory,
        service_description: body.service_description || null,
        estimated_hours: Number(body.estimated_hours || 0),
        dispatcher_notes: body.dispatcher_notes || null,
        employee_notes: body.employee_notes || null,
        client_notes: body.client_notes || null,
        internal_notes: body.internal_notes || null,
        report_required: body.report_required !== false,
        recurring_series_id: recurringSeriesId,
        occurrence_date: recurrenceEnabled ? occurrenceDate : null,
        occurrence_key: recurrenceEnabled ? `${recurringSeriesId || 'series'}:${occurrenceDate}:${index + 1}` : null,
        series_version: 1,
        metadata: {
          ...(body.metadata || {}),
          created_via: 'portal_api',
          created_by_user_id: user.id,
          created_by_staff_role_id: staffRole.id,
          selected_site_id: site.id,
          selected_site_name: site.site_name,
          selected_site_address: site.address_text,
          recurrence_enabled: recurrenceEnabled,
          recurrence_type: recurrenceType,
          recurring_series_id: recurringSeriesId,
          occurrence_date: occurrenceDate,
          quote_id: quoteId,
          source_quote_id: quoteId,
          order_confirmation_id: orderConfirmationId,
          created_from_quote: Boolean(quoteId),
        },
      };
    });

    const jobIds: string[] = await insertJobs(adminClient, jobPayloads);

    if (!jobIds.length) {
      return jsonResponse({ error: 'Einsatz wurde erstellt, aber keine ID wurde zurückgegeben.' }, 500);
    }

    if (body.report_required !== false) {
      const reportPayloads = jobIds.map((jobId: string, index: number) => ({
        job_id: jobId,
        client_id: clientId,
        client_site_id: clientSiteId,
        status: 'draft',
        report_title: title,
        report_summary: body.service_description || null,
        total_hours: 0,
        total_minutes: 0,
        before_photos: [],
        after_photos: [],
        time_logs: [],
        damage_reports: [],
        metadata: {
          created_via: 'portal_api',
          created_by_user_id: user.id,
          created_by_staff_role_id: staffRole.id,
          source: 'einsatz_planen',
          recurrence_enabled: recurrenceEnabled,
          recurring_series_id: recurringSeriesId,
          occurrence_date: occurrenceDates[index],
          quote_id: quoteId,
          source_quote_id: quoteId,
          order_confirmation_id: orderConfirmationId,
        },
      }));

      await adminClient.from('opc_job_reports').insert(reportPayloads);
    }

    const assignedEmployeeIds = Array.isArray(body.assigned_employee_ids)
      ? body.assigned_employee_ids.map((id: unknown) => String(id)).filter(Boolean)
      : [];

    let employeeRows: JsonRecord[] = [];

    if (assignedEmployeeIds.length > 0) {
      employeeRows = await resolveOpcAssignmentCandidates(
        adminClient,
        assignedEmployeeIds,
      );

      if (employeeRows.length !== new Set(assignedEmployeeIds).size) {
        return jsonResponse(
          {
            error:
              'Mindestens ein ausgewählter Mitarbeiter ist nicht mehr verfügbar oder darf nicht zugewiesen werden. Bitte laden Sie die Mitarbeiterauswahl neu.',
          },
          400,
        );
      }

      const assignmentNote = optionalString(body.assignment_note);

      for (const jobId of jobIds) {
        for (const employee of employeeRows) {
          try {
            await tryInsertOne(
              adminClient,
              'opc_job_assignments',
              buildAssignmentVariants({
                jobId,
                employee,
                note: assignmentNote,
                staffRoleId: staffRole.id,
                userId: user.id,
              }),
            );
          } catch {
            // Assignment insert must not destroy already-created jobs.
          }
        }
      }
    }

    const calendarSync = await createCalendarEntriesForJobs({
      adminClient,
      jobIds,
      jobPayloads,
      site,
      employees: employeeRows,
      createdByUserId: user.id,
      createdByStaffRoleId: staffRole.id,
      recurrenceEnabled,
      recurringSeriesId,
    });

    return jsonResponse({
      success: true,
      job_id: jobIds[0],
      job_ids: jobIds,
      created_count: jobIds.length,
      recurring_series_id: recurringSeriesId,
      quote_id: quoteId,
      order_confirmation_id: orderConfirmationId,
      recurrence_enabled: recurrenceEnabled,
      assigned_employee_count: employeeRows.length,
      calendar_sync: calendarSync,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Serverfehler.';
    return jsonResponse({ error: message }, 500);
  }
};