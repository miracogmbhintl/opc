import type { APIRoute } from 'astro';

/**
 * POST /api/auth/set-session
 *
 * Called from client after successful Supabase login.
 * Sets HTTP-only cookies with the session tokens.
 *
 * Normal successful requests stay quiet.
 * To temporarily debug, set AUTH_DEBUG=true or PUBLIC_AUTH_DEBUG=true.
 */

const JSON_HEADERS = {
  'Content-Type': 'application/json',
};

function isAuthDebugEnabled() {
  const value = String(
    import.meta.env.AUTH_DEBUG ??
      import.meta.env.PUBLIC_AUTH_DEBUG ??
      ''
  )
    .toLowerCase()
    .trim();

  return value === 'true' || value === '1' || value === 'yes';
}

function debugLog(...args: unknown[]) {
  if (isAuthDebugEnabled()) {
    console.log('[Auth Set-Session]', ...args);
  }
}

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    let body: any = {};

    try {
      body = await request.json();
    } catch {
      console.warn('[Auth Set-Session] Invalid JSON body');
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const { access_token, refresh_token } = body;

    if (!access_token) {
      console.warn('[Auth Set-Session] Missing access_token');
      return jsonResponse({ error: 'access_token required' }, 400);
    }

    const isProduction = request.url.startsWith('https://');

    debugLog('Setting session cookies', {
      hasAccessToken: Boolean(access_token),
      hasRefreshToken: Boolean(refresh_token),
      environment: isProduction ? 'production' : 'development',
      cookieFlags: {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
      },
    });

    cookies.set('sb-access-token', access_token, {
      path: '/',
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    if (refresh_token) {
      cookies.set('sb-refresh-token', refresh_token, {
        path: '/',
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('[Auth Set-Session] Error setting session cookies:', error);

    return jsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
};

/**
 * DELETE /api/auth/set-session
 *
 * Called when user logs out.
 * Clears the session cookies.
 */

export const DELETE: APIRoute = async ({ cookies }) => {
  try {
    cookies.delete('sb-access-token', { path: '/' });
    cookies.delete('sb-refresh-token', { path: '/' });

    debugLog('Session cookies cleared');

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('[Auth Set-Session] Error clearing session cookies:', error);

    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};