import type { APIRoute } from 'astro';
import { getRuntimeEnv, getGoogleScopes } from '../../../../lib/google-oauth';
import {
  encryptSecret,
  exchangeGoogleCode,
  getSupabaseServiceClient,
  jsonResponse,
} from '../../../../lib/google-calendar';

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

export const GET: APIRoute = async (context) => {
  const env = getRuntimeEnv(context);
  const url = new URL(context.request.url);

  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const googleError = url.searchParams.get('error') || '';

  const redirectToSettings = (status: string) => {
    const target = new URL('/einstellungen', url.origin);
    target.searchParams.set('google', status);
    return Response.redirect(target.toString(), 302);
  };

  try {
    if (googleError) {
      return redirectToSettings('error');
    }

    if (!code || !state) {
      return jsonResponse(
        {
          success: false,
          error: 'Google Callback ist unvollständig.',
        },
        400
      );
    }

    const supabase = getSupabaseServiceClient(env);
    const stateHash = await hashState(state);

    const { data: stateRow, error: stateError } = await supabase
      .from('opc_google_oauth_states')
      .select('*')
      .eq('state_hash', stateHash)
      .is('consumed_at', null)
      .maybeSingle();

    if (stateError) throw stateError;

    if (!stateRow) {
      return jsonResponse(
        {
          success: false,
          error: 'Google OAuth State wurde nicht gefunden oder bereits verwendet.',
        },
        400
      );
    }

    if (stateRow.expires_at && new Date(stateRow.expires_at).getTime() < Date.now()) {
      await supabase
        .from('opc_google_oauth_states')
        .update({
          consumed_at: new Date().toISOString(),
        })
        .eq('id', stateRow.id);

      return jsonResponse(
        {
          success: false,
          error: 'Google OAuth State ist abgelaufen.',
        },
        400
      );
    }

    const tokenPayload = await exchangeGoogleCode({
      env,
      requestUrl: context.request.url,
      code,
      codeVerifier: stateRow.code_verifier,
    });

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
      },
    });

    const userInfo = await userInfoResponse.json().catch(() => null);

    if (!userInfoResponse.ok) {
      throw new Error(
        userInfo?.error_description ||
          userInfo?.error ||
          'Google Nutzerprofil konnte nicht geladen werden.'
      );
    }

    const accessTokenEncrypted = await encryptSecret(tokenPayload.access_token, env);
    const refreshTokenEncrypted = tokenPayload.refresh_token
      ? await encryptSecret(tokenPayload.refresh_token, env)
      : null;

    const expiresAt = new Date(
      Date.now() + Number(tokenPayload.expires_in || 3600) * 1000
    ).toISOString();

    const { data: existingAccount } = await supabase
      .from('opc_google_accounts')
      .select('*')
      .eq('user_id', stateRow.user_id)
      .maybeSingle();

    const accountPayload: Record<string, any> = {
      user_id: stateRow.user_id,
      google_email: userInfo?.email || null,
      google_user_id: userInfo?.sub || null,
      access_token_encrypted: accessTokenEncrypted,
      scopes: String(tokenPayload.scope || getGoogleScopes().join(' '))
        .split(/\s+/)
        .filter(Boolean),
      token_expires_at: expiresAt,
      status: 'connected',
      last_error: null,
      updated_at: new Date().toISOString(),
    };

    if (refreshTokenEncrypted) {
      accountPayload.refresh_token_encrypted = refreshTokenEncrypted;
    }

    if (existingAccount?.id) {
      const { error: updateError } = await supabase
        .from('opc_google_accounts')
        .update(accountPayload)
        .eq('id', existingAccount.id);

      if (updateError) throw updateError;
    } else {
      accountPayload.created_at = new Date().toISOString();

      const { error: insertError } = await supabase
        .from('opc_google_accounts')
        .insert(accountPayload);

      if (insertError) throw insertError;
    }

    await supabase
      .from('opc_google_oauth_states')
      .update({
        consumed_at: new Date().toISOString(),
      })
      .eq('id', stateRow.id);

    return redirectToSettings('connected');
  } catch (callbackError: any) {
    console.error('[Google Callback]', callbackError);
    return redirectToSettings('error');
  }
};