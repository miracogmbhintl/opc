import type { APIRoute } from 'astro';

/**
 * POST /api/auth/set-session
 * 
 * Called from client after successful Supabase login
 * Sets HTTP-only cookies with the session tokens
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { access_token, refresh_token } = body;

    console.log('[Auth Set-Session] POST request received');
    console.log('[Auth Set-Session] Has access_token:', !!access_token);
    console.log('[Auth Set-Session] Has refresh_token:', !!refresh_token);

    if (!access_token) {
      console.error('[Auth Set-Session] Missing access_token');
      return new Response(JSON.stringify({ error: 'access_token required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Determine if we're in production (HTTPS) or development (HTTP)
    const isProduction = request.url.startsWith('https://');
    
    console.log('[Auth Set-Session] Environment:', isProduction ? 'production' : 'development');
    console.log('[Auth Set-Session] Setting cookies...');

    // Set HTTP-only cookies
    // These will be sent with all subsequent API requests
    cookies.set('sb-access-token', access_token, {
      path: '/',
      httpOnly: true,
      secure: isProduction, // Only require HTTPS in production
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    if (refresh_token) {
      cookies.set('sb-refresh-token', refresh_token, {
        path: '/',
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });
    }

    console.log('[Auth Set-Session] ✅ Session cookies set successfully');
    console.log('[Auth Set-Session] Cookie flags:', { 
      httpOnly: true, 
      secure: isProduction, 
      sameSite: 'lax' 
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Auth Set-Session] ❌ Error setting session cookies:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * DELETE /api/auth/set-session
 * 
 * Called when user logs out
 * Clears the session cookies
 */
export const DELETE: APIRoute = async ({ cookies }) => {
  try {
    console.log('[Auth Set-Session] DELETE request received');
    
    cookies.delete('sb-access-token', { path: '/' });
    cookies.delete('sb-refresh-token', { path: '/' });

    console.log('[Auth Set-Session] ✅ Session cookies cleared');

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Auth Set-Session] ❌ Error clearing session cookies:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

