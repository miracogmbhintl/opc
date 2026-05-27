import type { APIRoute } from 'astro';
import { getRuntimeEnv } from '../../../../lib/google-oauth';
import {
  fetchGoogleJson,
  getAuthenticatedContext,
  getOwnGoogleAccount,
  getValidGoogleAccessToken,
  jsonResponse,
} from '../../../../lib/google-calendar';

function canWrite(accessRole: string) {
  return ['owner', 'writer'].includes(String(accessRole || '').toLowerCase());
}

export const GET: APIRoute = async (context) => {
  const env = getRuntimeEnv(context);

  try {
    const { supabase, user } = await getAuthenticatedContext(context.request, env);
    const account = await getOwnGoogleAccount(supabase, user.id);

    if (!account || account.status !== 'connected') {
      return jsonResponse({
        success: true,
        connected: false,
        calendars: [],
        selected_calendar_id: null,
      });
    }

    const accessToken = await getValidGoogleAccessToken({
      supabase,
      env,
      account,
      requestUrl: context.request.url,
    });

    const payload = await fetchGoogleJson({
      accessToken,
      url: 'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader',
    });

    const calendars = Array.isArray(payload?.items)
      ? payload.items.map((item: any) => ({
          id: item.id,
          summary: item.summary,
          description: item.description || '',
          primary: Boolean(item.primary),
          accessRole: item.accessRole,
          backgroundColor: item.backgroundColor,
          foregroundColor: item.foregroundColor,
          timeZone: item.timeZone,
          canWrite: canWrite(item.accessRole),
        }))
      : [];

    let selectedCalendarId = account.selected_calendar_id || null;

    if (!selectedCalendarId) {
      const writablePrimary = calendars.find((calendar: any) => calendar.primary && calendar.canWrite);
      const writableFirst = calendars.find((calendar: any) => calendar.canWrite);
      const selected = writablePrimary || writableFirst || null;

      if (selected) {
        selectedCalendarId = selected.id;

        await supabase
          .from('opc_google_accounts')
          .update({
            selected_calendar_id: selected.id,
            selected_calendar_name: selected.summary,
            selected_calendar_access_role: selected.accessRole,
            updated_at: new Date().toISOString(),
          })
          .eq('id', account.id);
      }
    }

    return jsonResponse({
      success: true,
      connected: true,
      calendars,
      selected_calendar_id: selectedCalendarId,
    });
  } catch (error: any) {
    return jsonResponse(
      {
        success: false,
        connected: true,
        calendars: [],
        error: error?.message || 'Google Kalender konnten nicht geladen werden.',
      },
      error?.status || 500
    );
  }
};
