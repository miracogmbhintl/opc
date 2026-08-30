import type { APIRoute } from 'astro';
import { getEnvValue, getRuntimeEnv, type RuntimeEnv } from '../../../../lib/google-oauth';
import {
  createGoogleCalendarEvent,
  fetchGoogleJson,
  getAuthenticatedContext,
  getOwnGoogleAccount,
  getValidGoogleAccessToken,
  jsonResponse,
} from '../../../../lib/google-calendar';

type AnyRow = Record<string, any>;

function normalizeRole(value: unknown): string {
  const role = String(value || '').toLowerCase().trim();
  if (role === 'owner' || role === 'inhaber') return 'owner';
  if (role === 'admin' || role === 'administrator') return 'admin';
  if (role === 'dispatch' || role === 'dispatcher' || role === 'disposition') return 'dispatch';
  if (role === 'employee' || role === 'mitarbeiter') return 'employee';
  return 'client';
}

function canManageCalendar(role: string) {
  return ['owner', 'admin', 'dispatch'].includes(normalizeRole(role));
}

function cleanString(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function cleanArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)));
}

function parseEmailList(value: unknown): string[] {
  if (!value) return [];
  const rawItems = Array.isArray(value)
    ? value
    : String(value).split(/[;,\n]/g).map((item) => item.trim());

  return Array.from(new Set(
    rawItems
      .map((item) => String(item || '').trim().toLowerCase())
      .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
  ));
}

function mergeUniqueEmails(...groups: string[][]): string[] {
  return Array.from(new Set(groups.flat().map((email) => String(email || '').trim().toLowerCase()).filter(Boolean)));
}

function extractMeetLink(event: any): string | null {
  if (event?.hangoutLink) return event.hangoutLink;
  const entryPoints = event?.conferenceData?.entryPoints;
  if (!Array.isArray(entryPoints)) return null;
  return entryPoints.find((entry: any) => entry?.entryPointType === 'video' && entry?.uri)?.uri || null;
}

async function resolveStaffRole(serviceSupabase: any, userId: string) {
  const { data, error } = await serviceSupabase
    .from('opc_staff_roles')
    .select('id,role,status,can_access_portal')
    .eq('user_id', userId)
    .in('status', ['active', 'aktiv', 'enabled'])
    .eq('can_access_portal', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

function assertValidPeriod(startsAtInput: unknown, endsAtInput: unknown) {
  const startsAt = new Date(String(startsAtInput || ''));
  const endsAt = new Date(String(endsAtInput || ''));

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw Object.assign(new Error('Start- oder Endzeit ist ungültig.'), { status: 400 });
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw Object.assign(new Error('Endzeit muss nach der Startzeit liegen.'), { status: 400 });
  }

  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

async function updateGoogleCalendarEvent(params: {
  supabase: any;
  env: RuntimeEnv;
  account: AnyRow;
  requestUrl: string;
  googleCalendarId: string;
  googleEventId: string;
  input: AnyRow;
}) {
  const accessToken = await getValidGoogleAccessToken({
    supabase: params.supabase,
    env: params.env,
    account: params.account,
    requestUrl: params.requestUrl,
  });

  const attendeeEmails = mergeUniqueEmails(params.input.attendeeEmails || []);
  const reminderMinutes = Number(params.input.reminder_minutes ?? 30);
  const visibility = String(params.input.visibility || 'default');

  const body: Record<string, any> = {
    summary: params.input.title || 'Orange Pro Clean Termin',
    description: params.input.description || '',
    location: params.input.location_address || params.input.location_name || '',
    attendees: attendeeEmails.map((email) => ({ email })),
    guestsCanInviteOthers: params.input.guests_can_invite_others !== false,
    guestsCanModify: Boolean(params.input.guests_can_modify),
    guestsCanSeeOtherGuests: params.input.guests_can_see_other_guests !== false,
    visibility: ['default', 'public', 'private'].includes(visibility) ? visibility : 'default',
    reminders: Number.isFinite(reminderMinutes) && reminderMinutes >= 0
      ? { useDefault: false, overrides: [{ method: 'popup', minutes: reminderMinutes }] }
      : { useDefault: true },
  };

  if (params.input.is_all_day) {
    body.start = { date: String(params.input.starts_at).slice(0, 10) };
    body.end = { date: String(params.input.ends_at).slice(0, 10) };
  } else {
    body.start = {
      dateTime: params.input.starts_at,
      timeZone: params.input.timezone || 'Europe/Zurich',
    };
    body.end = {
      dateTime: params.input.ends_at,
      timeZone: params.input.timezone || 'Europe/Zurich',
    };
  }

  let conferenceRequestId: string | null = null;
  if (params.input.createMeetLink) {
    conferenceRequestId = globalThis.crypto.randomUUID();
    body.conferenceData = {
      createRequest: {
        requestId: conferenceRequestId,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(params.googleCalendarId)}/events/${encodeURIComponent(params.googleEventId)}`,
  );
  url.searchParams.set('conferenceDataVersion', params.input.createMeetLink ? '1' : '0');
  url.searchParams.set('sendUpdates', attendeeEmails.length > 0 ? 'all' : 'none');

  const googleEvent = await fetchGoogleJson({
    accessToken,
    url: url.toString(),
    init: {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  });

  return {
    google_calendar_id: params.googleCalendarId,
    google_event_id: googleEvent.id || params.googleEventId,
    google_html_link: googleEvent.htmlLink || null,
    google_meet_link: extractMeetLink(googleEvent),
    google_conference_id: googleEvent?.conferenceData?.conferenceId || null,
    google_conference_request_id: conferenceRequestId,
    google_meet_space_name: googleEvent?.conferenceData?.conferenceSolution?.name || null,
  };
}

async function syncSavedEventToGoogle(params: {
  serviceSupabase: any;
  env: RuntimeEnv;
  requestUrl: string;
  userId: string;
  event: AnyRow;
  payload: AnyRow;
  attendeeEmails: string[];
}) {
  if (params.payload.sync_google_calendar === false) return params.event;

  const account = await getOwnGoogleAccount(params.serviceSupabase, params.userId);
  if (!account || account.status !== 'connected') {
    const { data } = await params.serviceSupabase
      .from('opc_calendar_events')
      .update({
        google_sync_status: 'not_synced',
        google_sync_error: 'Google Kalender ist nicht verbunden.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.event.id)
      .select('*')
      .single();
    return data || params.event;
  }

  try {
    const input = {
      title: params.event.title,
      description: params.event.description,
      starts_at: params.event.starts_at,
      ends_at: params.event.ends_at,
      timezone: params.event.timezone || 'Europe/Zurich',
      is_all_day: Boolean(params.event.is_all_day),
      location_name: params.event.location_name,
      location_address: params.event.location_address,
      attendeeEmails: params.attendeeEmails,
      createMeetLink: Boolean(params.payload.create_google_meet),
      reminder_minutes: Number(params.payload.reminder_minutes ?? 30),
      visibility: params.payload.visibility || 'default',
      guests_can_invite_others: params.payload.guests_can_invite_others !== false,
      guests_can_modify: Boolean(params.payload.guests_can_modify),
      guests_can_see_other_guests: params.payload.guests_can_see_other_guests !== false,
    };

    const googleResult = params.event.google_event_id && params.event.google_calendar_id
      ? await updateGoogleCalendarEvent({
          supabase: params.serviceSupabase,
          env: params.env,
          account,
          requestUrl: params.requestUrl,
          googleCalendarId: params.event.google_calendar_id,
          googleEventId: params.event.google_event_id,
          input,
        })
      : await createGoogleCalendarEvent({
          supabase: params.serviceSupabase,
          env: params.env,
          account,
          requestUrl: params.requestUrl,
          input,
        });

    const syncedAt = new Date().toISOString();
    const nextMetadata = {
      ...(params.event.metadata || {}),
      google_sync: {
        synced_at: syncedAt,
        synced_by: params.userId,
        create_meet_link: Boolean(params.payload.create_google_meet),
        google_event_id: googleResult.google_event_id,
      },
    };

    const { data, error } = await params.serviceSupabase
      .from('opc_calendar_events')
      .update({
        google_account_id: account.id,
        google_calendar_id: googleResult.google_calendar_id,
        google_event_id: googleResult.google_event_id,
        google_html_link: googleResult.google_html_link,
        google_meet_link: googleResult.google_meet_link,
        google_conference_id: googleResult.google_conference_id,
        google_conference_request_id: googleResult.google_conference_request_id,
        google_meet_space_name: googleResult.google_meet_space_name,
        google_sync_status: 'synced',
        google_sync_error: null,
        google_last_synced_at: syncedAt,
        metadata: nextMetadata,
        updated_at: syncedAt,
      })
      .eq('id', params.event.id)
      .select('*')
      .single();

    if (error) throw error;
    return data || params.event;
  } catch (error: any) {
    const message = error?.message || 'Google Kalender konnte nicht synchronisiert werden.';
    const { data } = await params.serviceSupabase
      .from('opc_calendar_events')
      .update({
        google_sync_status: 'not_synced',
        google_sync_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.event.id)
      .select('*')
      .single();

    return data || {
      ...params.event,
      google_sync_status: 'not_synced',
      google_sync_error: message,
    };
  }
}

export const POST: APIRoute = async (context) => {
  const env = getRuntimeEnv(context);

  try {
    const { supabase: serviceSupabase, user } = await getAuthenticatedContext(context.request, env);
    const payload = await context.request.json().catch(() => null);

    if (!payload || typeof payload !== 'object') {
      return jsonResponse({ error: 'Ungültige Anfrage.' }, 400);
    }

    const calendarId = cleanString(payload.calendar_id);
    const title = cleanString(payload.title);
    if (!calendarId) return jsonResponse({ error: 'calendar_id fehlt.' }, 400);
    if (!title) return jsonResponse({ error: 'Titel fehlt.' }, 400);
    if (!payload.starts_at || !payload.ends_at) {
      return jsonResponse({ error: 'Start- und Endzeit fehlen.' }, 400);
    }

    const { startsAt, endsAt } = assertValidPeriod(payload.starts_at, payload.ends_at);
    const staffRole = await resolveStaffRole(serviceSupabase, user.id);
    const currentRole = normalizeRole(staffRole?.role);
    if (!staffRole || !canManageCalendar(currentRole)) {
      return jsonResponse({ error: 'Keine Berechtigung für Kalenderänderungen.' }, 403);
    }

    const { data: calendar, error: calendarError } = await serviceSupabase
      .from('opc_calendars')
      .select('id,is_active')
      .eq('id', calendarId)
      .eq('is_active', true)
      .maybeSingle();
    if (calendarError) throw calendarError;
    if (!calendar) return jsonResponse({ error: 'Kalender wurde nicht gefunden.' }, 404);

    let existingEvent: AnyRow | null = null;
    if (payload.id) {
      const { data, error } = await serviceSupabase
        .from('opc_calendar_events')
        .select('*')
        .eq('id', payload.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse({ error: 'Kalendereintrag wurde nicht gefunden.' }, 404);
      existingEvent = data;
    }

    const assignedStaffRoleIds = cleanArray(payload.assigned_staff_role_ids);
    let staffRows: AnyRow[] = [];
    if (assignedStaffRoleIds.length > 0) {
      const { data, error } = await serviceSupabase
        .from('opc_staff_roles')
        .select('id,user_id,email,status,can_access_portal')
        .in('id', assignedStaffRoleIds)
        .in('status', ['active', 'aktiv', 'enabled'])
        .eq('can_access_portal', true);
      if (error) throw error;
      staffRows = data || [];

      if (staffRows.length !== assignedStaffRoleIds.length) {
        return jsonResponse({ error: 'Mindestens ein zugewiesener Mitarbeiter ist nicht mehr aktiv.' }, 409);
      }
    }

    const typedAttendeeEmails = mergeUniqueEmails(
      parseEmailList(payload.attendee_emails),
      parseEmailList(payload.guest_emails),
      parseEmailList(payload.guestEmails),
      parseEmailList(payload.attendeeEmails),
    );
    const staffAttendeeEmails = staffRows
      .map((staff) => String(staff.email || '').trim().toLowerCase())
      .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    const attendeeEmails = mergeUniqueEmails(typedAttendeeEmails, staffAttendeeEmails);

    const attendeeRows = staffRows.map((staff) => ({
      staff_role_id: staff.id,
      user_id: staff.user_id || null,
      attendee_role: 'assigned_worker',
      status: payload.requires_acceptance ? 'needs_action' : 'accepted',
      notified_at: null,
      notification_status: 'pending',
    }));

    const localEventPayload: AnyRow = {
      calendar_id: calendarId,
      event_type: cleanString(payload.event_type) || 'internal',
      status: cleanString(payload.status) || 'confirmed',
      title,
      description: cleanString(payload.description),
      starts_at: startsAt,
      ends_at: endsAt,
      timezone: cleanString(payload.timezone) || 'Europe/Zurich',
      is_all_day: Boolean(payload.is_all_day),
      location_name: cleanString(payload.location_name),
      location_address: cleanString(payload.location_address),
      client_id: cleanString(payload.client_id),
      contact_id: cleanString(payload.contact_id),
      client_site_id: cleanString(payload.client_site_id),
      inquiry_id: cleanString(payload.inquiry_id),
      job_id: cleanString(payload.job_id),
      source_channel: cleanString(payload.source_channel) || 'portal',
      source_external_id: cleanString(payload.source_external_id),
      requires_acceptance: Boolean(payload.requires_acceptance),
      metadata: {
        ...(existingEvent?.metadata || {}),
        ...(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
        source: 'portal',
        guest_attendee_emails: typedAttendeeEmails,
        google_meet_options: {
          reminder_minutes: Number(payload.reminder_minutes ?? payload.metadata?.google_meet_options?.reminder_minutes ?? 30),
          guests_can_invite_others: payload.guests_can_invite_others ?? payload.metadata?.google_meet_options?.guests_can_invite_others ?? true,
          guests_can_modify: payload.guests_can_modify ?? payload.metadata?.google_meet_options?.guests_can_modify ?? false,
          guests_can_see_other_guests: payload.guests_can_see_other_guests ?? payload.metadata?.google_meet_options?.guests_can_see_other_guests ?? true,
          visibility: payload.visibility || payload.metadata?.google_meet_options?.visibility || 'default',
        },
      },
    };

    const { data: savedEvent, error: saveError } = await serviceSupabase.rpc(
      'opc_save_calendar_event_atomic',
      {
        p_event_id: existingEvent?.id || null,
        p_payload: localEventPayload,
        p_attendees: attendeeRows,
        p_actor_user_id: user.id,
      },
    );
    if (saveError) throw saveError;
    if (!savedEvent?.id) throw new Error('Kalendereintrag konnte nicht atomar gespeichert werden.');

    const eventWithGoogleSync = await syncSavedEventToGoogle({
      serviceSupabase,
      env,
      requestUrl: context.request.url,
      userId: user.id,
      event: savedEvent,
      payload,
      attendeeEmails,
    });

    return jsonResponse({
      event: eventWithGoogleSync,
      google_sync_status: eventWithGoogleSync.google_sync_status || 'not_synced',
      google_sync_error: eventWithGoogleSync.google_sync_error || null,
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || 'Calendar event could not be saved.' },
      error?.status || 500,
    );
  }
};
