type AnyRow = Record<string, any>;

const REMOVED_ASSIGNMENT_STATUSES = new Set([
  'removed',
  'unassigned',
  'cancelled',
  'canceled',
  'deleted',
  'inactive',
  'rejected',
]);

function clean(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function isActiveAssignment(row: AnyRow) {
  return !REMOVED_ASSIGNMENT_STATUSES.has(normalize(row.status || row.assignment_status));
}

function jobEventStatus(status: unknown) {
  const value = normalize(status);

  if (['completed', 'approved', 'report_pending', 'report_approved', 'sent_to_client'].includes(value)) {
    return 'completed';
  }

  if (['in_progress', 'in-progress', 'started', 'running', 'on_site', 'on-site', 'onsite'].includes(value)) {
    return 'in_progress';
  }

  if (['cancelled', 'canceled', 'rejected'].includes(value)) return 'cancelled';
  if (['draft', 'pending', 'requested'].includes(value)) return 'requested';

  return 'confirmed';
}

function jobEventType(status: unknown) {
  const normalizedStatus = jobEventStatus(status);
  if (normalizedStatus === 'completed') return 'job_completed';
  if (normalizedStatus === 'in_progress') return 'job_active';
  if (normalizedStatus === 'requested') return 'job_requested';
  return 'job_scheduled';
}

function eventDescription(job: AnyRow) {
  return [
    job.service_category ? `Dienstleistung: ${job.service_category}` : '',
    job.service_description ? `Beschreibung: ${job.service_description}` : '',
    job.dispatcher_notes ? `Dispo-Hinweise: ${job.dispatcher_notes}` : '',
    job.employee_notes ? `Mitarbeiter-Hinweise: ${job.employee_notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function siteAddress(site: AnyRow | null) {
  if (!site) return null;
  return clean([site.address_text, site.postal_code, site.city, site.country].filter(Boolean).join(', '));
}

function staffDisplayName(staff: AnyRow) {
  return clean(staff.display_name || staff.full_name || staff.name || staff.email) || 'Mitarbeiter';
}

async function findOrCreateTeamCalendar(supabase: any, actorUserId: string) {
  const { data: existing, error: existingError } = await supabase
    .from('opc_calendars')
    .select('*')
    .eq('calendar_type', 'team')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1);

  if (existingError) throw existingError;
  if (existing?.[0]) return existing[0];

  const { data: created, error: createError } = await supabase
    .from('opc_calendars')
    .insert({
      calendar_type: 'team',
      owner_user_id: null,
      owner_staff_role_id: null,
      name: 'Orange Pro Clean – Gesamtes Team',
      description: 'Allgemeiner Firmenkalender für alle Portalbenutzer.',
      is_private: false,
      is_active: true,
      created_by: actorUserId,
    })
    .select('*')
    .single();

  if (createError) throw createError;
  return created;
}

async function findOrCreatePersonalCalendar(supabase: any, staff: AnyRow, actorUserId: string) {
  const staffRoleId = clean(staff.id);
  const userId = clean(staff.user_id || staff.auth_user_id);

  let query = supabase.from('opc_calendars').select('*').eq('is_active', true);

  if (staffRoleId && userId) {
    query = query.or(`owner_staff_role_id.eq.${staffRoleId},owner_user_id.eq.${userId}`);
  } else if (staffRoleId) {
    query = query.eq('owner_staff_role_id', staffRoleId);
  } else if (userId) {
    query = query.eq('owner_user_id', userId);
  } else {
    throw new Error('Mitarbeiter besitzt weder staff-role-id noch user-id.');
  }

  const { data: existing, error: existingError } = await query
    .order('created_at', { ascending: true })
    .limit(1);

  if (existingError) throw existingError;
  if (existing?.[0]) return existing[0];

  const role = normalize(staff.role);
  const calendarType = ['owner', 'admin', 'dispatch'].includes(role) ? 'admin' : 'employee';

  const { data: created, error: createError } = await supabase
    .from('opc_calendars')
    .insert({
      calendar_type: calendarType,
      owner_user_id: userId,
      owner_staff_role_id: staffRoleId,
      name: `${staffDisplayName(staff)} – Privat`,
      description: 'Privater persönlicher Kalender.',
      is_private: true,
      is_active: true,
      created_by: actorUserId,
    })
    .select('*')
    .single();

  if (createError) throw createError;
  return created;
}

async function resolveAssignedStaff(supabase: any, jobId: string) {
  const [{ data: assignments, error: assignmentError }, { data: staffRows, error: staffError }] =
    await Promise.all([
      supabase.from('opc_job_assignments').select('*').eq('job_id', jobId),
      supabase.from('opc_staff_roles').select('*').eq('status', 'active'),
    ]);

  if (assignmentError) throw assignmentError;
  if (staffError) throw staffError;

  const staff = (staffRows || []) as AnyRow[];
  const byId = new Map(staff.filter((row) => row.id).map((row) => [String(row.id), row]));
  const byUserId = new Map(
    staff
      .filter((row) => row.user_id || row.auth_user_id)
      .map((row) => [String(row.user_id || row.auth_user_id), row]),
  );
  const byEmployeeId = new Map(
    staff.filter((row) => row.employee_id).map((row) => [String(row.employee_id), row]),
  );

  const resolved = new Map<string, AnyRow>();

  for (const assignment of (assignments || []).filter(isActiveAssignment)) {
    const identifiers = unique(
      [
        assignment.staff_role_id,
        assignment.staff_id,
        assignment.employee_id,
        assignment.user_id,
        assignment.employee_user_id,
        assignment.assigned_to,
      ]
        .filter(Boolean)
        .map(String),
    );

    let match: AnyRow | undefined;

    for (const identifier of identifiers) {
      match = byId.get(identifier) || byUserId.get(identifier) || byEmployeeId.get(identifier);
      if (match) break;
    }

    if (match?.id) resolved.set(String(match.id), match);
  }

  return Array.from(resolved.values());
}

function canonicalEventPayload(params: {
  calendarId: string;
  job: AnyRow;
  site: AnyRow | null;
  actorUserId: string;
  scope: 'team' | 'employee';
  staffRoleId?: string | null;
}) {
  const { calendarId, job, site, actorUserId, scope, staffRoleId } = params;
  const address = siteAddress(site);
  const metadata = {
    ...(job.metadata && typeof job.metadata === 'object' ? job.metadata : {}),
    source: 'job_sync',
    source_type: 'service_job',
    source_job_id: job.id,
    job_id: job.id,
    calendar_scope: scope,
    assigned_staff_role_id: staffRoleId || null,
    synced_at: new Date().toISOString(),
  };

  return {
    calendar_id: calendarId,
    event_type: jobEventType(job.status),
    status: jobEventStatus(job.status),
    title: clean(job.title) || clean(job.service_category) || 'Einsatz',
    description: clean(eventDescription(job)),
    starts_at: job.planned_start,
    ends_at: job.planned_end,
    timezone: 'Europe/Zurich',
    is_all_day: false,
    location_name: clean(site?.site_name),
    location_address: address,
    client_id: clean(job.client_id),
    contact_id: clean(job.contact_id),
    client_site_id: clean(job.client_site_id),
    job_id: String(job.id),
    source_channel: 'portal',
    requires_acceptance: false,
    updated_by: actorUserId,
    metadata,
  };
}

async function upsertJobEvent(
  supabase: any,
  params: {
    calendarId: string;
    job: AnyRow;
    site: AnyRow | null;
    actorUserId: string;
    scope: 'team' | 'employee';
    staffRoleId?: string | null;
  },
) {
  const payload = canonicalEventPayload(params);
  const { data: existingRows, error: findError } = await supabase
    .from('opc_calendar_events')
    .select('*')
    .eq('job_id', String(params.job.id))
    .eq('calendar_id', params.calendarId)
    .order('created_at', { ascending: true });

  if (findError) throw findError;

  const existing = existingRows?.[0] || null;
  let event: AnyRow;

  if (existing) {
    const { data, error } = await supabase
      .from('opc_calendar_events')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw error;
    event = data;
  } else {
    const { data, error } = await supabase
      .from('opc_calendar_events')
      .insert({
        ...payload,
        created_by: params.actorUserId,
        google_sync_status: 'not_synced',
        google_sync_error: null,
      })
      .select('*')
      .single();

    if (error) throw error;
    event = data;
  }

  const duplicateIds = (existingRows || []).slice(1).map((row: AnyRow) => row.id).filter(Boolean);
  if (duplicateIds.length > 0) {
    await supabase.from('opc_calendar_events').delete().in('id', duplicateIds);
  }

  return event;
}

function isGeneratedPersonalEvent(event: AnyRow) {
  const metadata = event.metadata && typeof event.metadata === 'object' ? event.metadata : {};
  return (
    metadata.calendar_scope === 'employee' ||
    metadata.source === 'job_sync' ||
    metadata.source === 'create_service_job_api'
  );
}

export async function syncJobCalendarState(params: {
  supabase: any;
  jobId: string;
  actorUserId: string;
}) {
  const { supabase, jobId, actorUserId } = params;

  const { data: job, error: jobError } = await supabase
    .from('opc_service_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError) throw jobError;

  if (!job?.planned_start || !job?.planned_end) {
    return {
      job_id: jobId,
      skipped: true,
      reason: 'planned_start_or_end_missing',
    };
  }

  let site: AnyRow | null = null;
  if (job.client_site_id) {
    const { data, error } = await supabase
      .from('opc_client_sites')
      .select('*')
      .eq('id', job.client_site_id)
      .maybeSingle();
    if (error) throw error;
    site = data || null;
  }

  const [teamCalendar, assignedStaff] = await Promise.all([
    findOrCreateTeamCalendar(supabase, actorUserId),
    resolveAssignedStaff(supabase, jobId),
  ]);

  const teamEvent = await upsertJobEvent(supabase, {
    calendarId: String(teamCalendar.id),
    job,
    site,
    actorUserId,
    scope: 'team',
  });

  const { error: deleteAttendeesError } = await supabase
    .from('opc_calendar_event_attendees')
    .delete()
    .eq('event_id', teamEvent.id);

  if (deleteAttendeesError) throw deleteAttendeesError;

  if (assignedStaff.length > 0) {
    const attendeeRows = assignedStaff.map((staff) => ({
      event_id: teamEvent.id,
      staff_role_id: staff.id,
      user_id: staff.user_id || staff.auth_user_id || null,
      attendee_role: 'assigned_worker',
      status: 'accepted',
      notified_at: null,
      notification_status: 'pending',
    }));

    const { error: attendeeError } = await supabase
      .from('opc_calendar_event_attendees')
      .insert(attendeeRows);

    if (attendeeError) throw attendeeError;
  }

  // OPC_SINGLE_CALENDAR_EVENT_PER_JOB_V1
  // Ein Einsatz besitzt systemweit exakt einen sichtbaren Kalenderdatensatz:
  // den kanonischen Eintrag im allgemeinen Teamkalender.
  const { data: allJobEvents, error: allJobEventsError } = await supabase
    .from('opc_calendar_events')
    .select('*')
    .eq('job_id', jobId);

  if (allJobEventsError) throw allJobEventsError;

  const duplicateIds = (allJobEvents || [])
    .filter((event: AnyRow) => String(event.id) !== String(teamEvent.id))
    .map((event: AnyRow) => event.id)
    .filter(Boolean);

  if (duplicateIds.length > 0) {
    const { error: duplicateAttendeeDeleteError } = await supabase
      .from('opc_calendar_event_attendees')
      .delete()
      .in('event_id', duplicateIds);

    if (duplicateAttendeeDeleteError) throw duplicateAttendeeDeleteError;

    const { error: duplicateDeleteError } = await supabase
      .from('opc_calendar_events')
      .delete()
      .in('id', duplicateIds);

    if (duplicateDeleteError) throw duplicateDeleteError;
  }

  return {
    job_id: jobId,
    skipped: false,
    team_calendar_id: teamCalendar.id,
    team_event_id: teamEvent.id,
    assigned_staff_role_ids: assignedStaff.map((staff) => staff.id),
    personal_calendar_ids: [],
    removed_stale_event_count: duplicateIds.length,
  };
}
