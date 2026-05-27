import type { APIRoute } from 'astro';
import { getRuntimeEnv } from '../../../../lib/google-oauth';
import {
  fetchGoogleJson,
  getAuthenticatedContext,
  getOwnGoogleAccount,
  getValidGoogleAccessToken,
  jsonResponse,
} from '../../../../lib/google-calendar';

export const POST: APIRoute = async (context) => {
  const env = getRuntimeEnv(context);

  try {
    const { supabase, user } = await getAuthenticatedContext(context.request, env);
    const body = await context.request.json().catch(() => ({}));

    const calendarId = String(body.calendar_id || body.calendarId || '').trim();

    if (!calendarId) {
      return jsonResponse(
        {
          success: false,
          error: 'calendar_id ist erforderlich.',
        },
        400
      );
    }

    const account = await getOwnGoogleAccount(supabase, user.id);

    if (!account || account.status !== 'connected') {
      return jsonResponse(
        {
          success: false,
          error: 'Google Kalender ist nicht verbunden.',
        },
        409
      );
    }

    const accessToken = await getValidGoogleAccessToken({
      supabase,
      env,
      account,
      requestUrl: context.request.url,
    });

    const calendar = await fetchGoogleJson({
      accessToken,
      url: `https://www.googleapis.com/calendar/v3/users/me/calendarList/${encodeURIComponent(calendarId)}`,
    });

    const accessRole = String(calendar.accessRole || '');

    if (!['owner', 'writer'].includes(accessRole.toLowerCase())) {
      return jsonResponse(
        {
          success: false,
          error: 'Dieser Google Kalender ist nur lesbar. Bitte einen beschreibbaren Kalender auswählen.',
        },
        400
      );
    }

    const { data, error } = await supabase
      .from('opc_google_accounts')
      .update({
        selected_calendar_id: calendar.id,
        selected_calendar_name: calendar.summary,
        selected_calendar_access_role: accessRole,
        updated_at: new Date().toISOString(),
      })
      .eq('id', account.id)
      .select('*')
      .single();

    if (error) throw error;

    return jsonResponse({
      success: true,
      account: data,
    });
  } catch (error: any) {
    return jsonResponse(
      {
        success: false,
        error: error?.message || 'Google Kalender konnte nicht ausgewählt werden.',
      },
      error?.status || 500
    );
  }
};
