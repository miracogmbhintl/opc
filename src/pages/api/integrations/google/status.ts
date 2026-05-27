import type { APIRoute } from 'astro';
import { getRuntimeEnv } from '../../../../lib/google-oauth';
import {
  getAuthenticatedContext,
  getOwnGoogleAccount,
  jsonResponse,
  publicGoogleAccount,
} from '../../../../lib/google-calendar';

export const GET: APIRoute = async (context) => {
  const env = getRuntimeEnv(context);

  try {
    const { supabase, user } = await getAuthenticatedContext(context.request, env);
    const account = await getOwnGoogleAccount(supabase, user.id);

    return jsonResponse({
      success: true,
      ...publicGoogleAccount(account),
    });
  } catch (error: any) {
    return jsonResponse(
      {
        success: false,
        error: error?.message || 'Google Status konnte nicht geladen werden.',
      },
      error?.status || 500
    );
  }
};
