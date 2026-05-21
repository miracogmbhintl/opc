import type { APIRoute } from 'astro';

/**
 * GET /api/auth/check-cookies
 * 
 * Debug endpoint to check what cookies are being received
 */
export const GET: APIRoute = async ({ cookies, request }) => {
  console.log('[Auth Check] Checking cookies...');
  
  const accessToken = cookies.get('sb-access-token');
  const refreshToken = cookies.get('sb-refresh-token');
  
  console.log('[Auth Check] Access token cookie:', accessToken ? `present (${accessToken.value?.substring(0, 20)}...)` : 'MISSING');
  console.log('[Auth Check] Refresh token cookie:', refreshToken ? 'present' : 'MISSING');
  
  // Also check the request headers for cookie header
  const cookieHeader = request.headers.get('cookie');
  console.log('[Auth Check] Cookie header:', cookieHeader ? 'present' : 'MISSING');
  
  return new Response(JSON.stringify({
    hasAccessToken: !!accessToken?.value,
    hasRefreshToken: !!refreshToken?.value,
    hasCookieHeader: !!cookieHeader,
    cookieHeaderPreview: cookieHeader?.substring(0, 100) || null
  }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};


