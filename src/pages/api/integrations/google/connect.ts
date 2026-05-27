import type { APIRoute } from 'astro';
import { buildGoogleAuthUrl, getRuntimeEnv, randomBase64Url } from '../../../../lib/google-oauth';
import { getAuthenticatedContext, jsonResponse } from '../../../../lib/google-calendar';

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : (globalThis as any).Buffer.from(bytes).toString('base64');

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hashState(state: string): Promise<string> {
  const encoded = new TextEncoder().encode(state);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
  return toBase64Url(digest);
}

async function handleConnect(context: Parameters<APIRoute>[0]) {
  const env = getRuntimeEnv(context);

  try {
    const { supabase, user } = await getAuthenticatedContext(context.request, env);

    const state = randomBase64Url(32);
    const stateHash = await hashState(state);
    const codeVerifier = randomBase64Url(64);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabase
      .from('opc_google_oauth_states')
      .delete()
      .eq('user_id', user.id);

    const { error } = await supabase.from('opc_google_oauth_states').insert({
      user_id: user.id,
      state_hash: stateHash,
      code_verifier: codeVerifier,
      return_path: '/einstellungen',
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
      metadata: {
        source: 'settings_system_google_calendar',
      },
    });

    if (error) throw error;

    const authUrl = await buildGoogleAuthUrl({
      env,
      requestUrl: context.request.url,
      state,
      codeVerifier,
    });

    return jsonResponse({
      success: true,
      auth_url: authUrl,
      authUrl,
      url: authUrl,
    });
  } catch (error: any) {
    return jsonResponse(
      {
        success: false,
        error: error?.message || 'Google Verbindung konnte nicht gestartet werden.',
      },
      error?.status || 500
    );
  }
}

export const GET: APIRoute = async (context) => handleConnect(context);
export const POST: APIRoute = async (context) => handleConnect(context);