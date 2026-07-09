import type { APIRoute } from 'astro';
import { getRuntimeEnv } from '../../../../lib/google-oauth';
import {
  getAuthenticatedContext,
  getOwnGoogleAccount,
  getValidGoogleAccessToken,
  jsonResponse,
} from '../../../../lib/google-calendar';
import { resolveOpcServerAccess } from '../../../../lib/opc-server-access';

export const prerender = false;
type AnyRow = Record<string, any>;

function cleanId(value: unknown) {
  return String(value || '').trim();
}

function eventJobId(event: AnyRow) {
  const metadata =
    event?.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata)
      ? event.metadata
      : {};

  return cleanId(event?.job_id || metadata?.job_id || metadata?.source_job_id);
}

async function deleteGoogleEventBestEffort(params: {
  serviceSupabase: any;
  env: ReturnType<typeof getRuntimeEnv>;
  requestUrl: string;
  userId: string;
  event: AnyRow;
}) {
  const googleEventId = cleanId(params.event.google_event_id);
  const googleCalendarId = cleanId(params.event.google_calendar_id);
  if (!googleEventId || !googleCalendarId) return null;

  try {
    let account: AnyRow | null = null;

    if (params.event.google_account_id) {
      const { data, error } = await params.serviceSupabase
        .from('opc_google_accounts')
        .select('*')
        .eq('id', params.event.google_account_id)
        .maybeSingle();
      if (error) throw error;
      account = data || null;
    }

    if (!account) {
      account = await getOwnGoogleAccount(params.serviceSupabase, params.userId);
    }

    if (!account) {
      return 'Lokaler Eintrag gelöscht; kein Google-Konto für die Remote-Löschung gefunden.';
    }

    const accessToken = await getValidGoogleAccessToken({
      supabase: params.serviceSupabase,
      env: params.env,
      account,
      requestUrl: params.requestUrl,
    });

    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(googleCalendarId)}/events/${encodeURIComponent(googleEventId)}`,
    );
    url.searchParams.set('sendUpdates', 'all');

    const response = await fetch(url.toString(), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok && response.status !== 404) {
      return `Lokaler Eintrag gelöscht; Google-Löschung fehlgeschlagen (HTTP ${response.status}).`;
    }

    return null;
  } catch (error: any) {
    return 'Lokaler Eintrag gelöscht; Google-Löschung fehlgeschlagen: ' +
      (error?.message || 'Unbekannter Fehler.');
  }
}

export const POST: APIRoute = async (context) => {
  const env = getRuntimeEnv(context);

  try {
    const { supabase: serviceSupabase, user } = await getAuthenticatedContext(context.request, env);
    const access = await resolveOpcServerAccess(serviceSupabase, user);

    if (!access.canManageCalendar) {
      return jsonResponse({
        error: 'Nur Owner, Admin oder Disposition dürfen Kalendereinträge löschen.',
      }, 403);
    }

    const body = await context.request.json().catch(() => null);
    const eventId = cleanId(body?.event_id || body?.id);
    if (!eventId) return jsonResponse({ error: 'event_id fehlt.' }, 400);

    const { data: event, error: eventReadError } = await serviceSupabase
      .from('opc_calendar_events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();

    if (eventReadError) throw eventReadError;
    if (!event) {
      return jsonResponse({ event_id: eventId, deleted: true, already_missing: true });
    }

    const jobId = eventJobId(event);
    if (jobId) {
      return jsonResponse({
        error: 'Dieser Kalendereintrag gehört zu einem Einsatz. Bitte den Einsatz auf der Einsatzseite löschen.',
        job_id: jobId,
      }, 409);
    }

    const googleWarning = await deleteGoogleEventBestEffort({
      serviceSupabase,
      env,
      requestUrl: context.request.url,
      userId: user.id,
      event,
    });

    const { error: attendeeDeleteError } = await serviceSupabase
      .from('opc_calendar_event_attendees')
      .delete()
      .eq('event_id', eventId);
    if (attendeeDeleteError) throw attendeeDeleteError;

    const { data: deletedRows, error: eventDeleteError } = await serviceSupabase
      .from('opc_calendar_events')
      .delete()
      .eq('id', eventId)
      .select('id');

    if (eventDeleteError) throw eventDeleteError;
    if (!Array.isArray(deletedRows) || deletedRows.length === 0) {
      return jsonResponse({ error: 'Kalendereintrag wurde nicht gelöscht.' }, 409);
    }

    return jsonResponse({
      event_id: eventId,
      deleted: true,
      deleted_by_role: access.role,
      warning: googleWarning,
    });
  } catch (error: any) {
    return jsonResponse({
      error: error?.message || 'Kalendereintrag konnte nicht gelöscht werden.',
      code: error?.code || null,
    }, error?.status || 500);
  }
};
