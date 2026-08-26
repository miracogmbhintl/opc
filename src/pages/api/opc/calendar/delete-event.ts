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
  const metadata = event?.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata)
    ? event.metadata
    : {};
  return cleanId(event?.job_id || metadata?.job_id || metadata?.source_job_id);
}

async function deleteGoogleEvent(params: {
  serviceSupabase: any;
  env: ReturnType<typeof getRuntimeEnv>;
  requestUrl: string;
  userId: string;
  event: AnyRow;
}) {
  const googleEventId = cleanId(params.event.google_event_id);
  const googleCalendarId = cleanId(params.event.google_calendar_id);
  if (!googleEventId || !googleCalendarId) return null;

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

  if (!account) account = await getOwnGoogleAccount(params.serviceSupabase, params.userId);
  if (!account) throw new Error('Kein Google-Konto für die Remote-Löschung gefunden.');

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
    throw new Error(`Google-Löschung fehlgeschlagen (HTTP ${response.status}).`);
  }

  return null;
}

export const POST: APIRoute = async (context) => {
  const env = getRuntimeEnv(context);

  try {
    const { supabase: serviceSupabase, user } = await getAuthenticatedContext(context.request, env);
    const access = await resolveOpcServerAccess(serviceSupabase, user);

    if (!access.canManageCalendar) {
      return jsonResponse({ error: 'Nur Owner, Admin oder Disposition dürfen Kalendereinträge löschen.' }, 403);
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
    if (!event) return jsonResponse({ event_id: eventId, deleted: true, already_missing: true });

    const jobId = eventJobId(event);
    if (jobId) {
      return jsonResponse({
        error: 'Dieser Kalendereintrag gehört zu einem Einsatz. Bitte den Einsatz auf der Einsatzseite löschen.',
        job_id: jobId,
      }, 409);
    }

    let cleanupId: string | null = null;
    if (cleanId(event.google_event_id) && cleanId(event.google_calendar_id)) {
      const { data: queued, error: queueError } = await serviceSupabase
        .from('opc_calendar_external_cleanup_queue')
        .insert({
          calendar_event_id: event.id,
          google_account_id: event.google_account_id || null,
          google_calendar_id: event.google_calendar_id,
          google_event_id: event.google_event_id,
          requested_by: user.id,
          status: 'pending',
        })
        .select('id')
        .single();
      if (queueError) throw queueError;
      cleanupId = queued.id;
    }

    const { data: localDeleted, error: localDeleteError } = await serviceSupabase.rpc(
      'opc_delete_calendar_event_local_atomic',
      { p_event_id: event.id },
    );
    if (localDeleteError) throw localDeleteError;
    if (localDeleted !== true) {
      throw Object.assign(new Error('Kalendereintrag wurde lokal nicht gelöscht.'), { status: 409 });
    }

    let googleWarning: string | null = null;
    if (cleanupId) {
      try {
        await deleteGoogleEvent({
          serviceSupabase,
          env,
          requestUrl: context.request.url,
          userId: user.id,
          event,
        });

        const { error: queueDoneError } = await serviceSupabase
          .from('opc_calendar_external_cleanup_queue')
          .update({
            status: 'done',
            attempts: 1,
            last_error: null,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', cleanupId);
        if (queueDoneError) {
          console.warn('[calendar/delete] Google deleted but queue finalization failed:', queueDoneError.message);
        }
      } catch (error: any) {
        googleWarning = `Lokaler Eintrag gelöscht; Google-Löschung ist zur Wiederholung vorgemerkt: ${error?.message || 'Unbekannter Fehler.'}`;
        const { error: queueFailError } = await serviceSupabase
          .from('opc_calendar_external_cleanup_queue')
          .update({
            status: 'failed',
            attempts: 1,
            last_error: error?.message || 'Unbekannter Google-Fehler',
            updated_at: new Date().toISOString(),
          })
          .eq('id', cleanupId);
        if (queueFailError) {
          console.warn('[calendar/delete] cleanup queue error update failed:', queueFailError.message);
        }
      }
    }

    return jsonResponse({
      event_id: eventId,
      deleted: true,
      deleted_by_role: access.role,
      google_cleanup_id: cleanupId,
      warning: googleWarning,
    });
  } catch (error: any) {
    return jsonResponse({
      error: error?.message || 'Kalendereintrag konnte nicht gelöscht werden.',
      code: error?.code || null,
    }, error?.status || 500);
  }
};
