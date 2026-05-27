import type { APIRoute } from 'astro';
import { getRuntimeEnv } from '../../../../lib/google-oauth';
import {
  getAuthenticatedContext,
  getOwnGoogleAccount,
  jsonResponse,
} from '../../../../lib/google-calendar';

export const POST: APIRoute = async (context) => {
  const env = getRuntimeEnv(context);

  try {
    const { supabase, user } = await getAuthenticatedContext(context.request, env);
    const account = await getOwnGoogleAccount(supabase, user.id);

    if (account?.id) {
      const { error } = await supabase
        .from('opc_google_accounts')
        .update({
          status: 'disconnected',
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', account.id);

      if (error) throw error;
    }

    return jsonResponse({
      success: true,
      connected: false,
    });
  } catch (error: any) {
    return jsonResponse(
      {
        success: false,
        error: error?.message || 'Google Verbindung konnte nicht getrennt werden.',
      },
      error?.status || 500
    );
  }
};
