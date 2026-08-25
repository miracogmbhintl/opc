import type { APIRoute } from 'astro';

export const prerender = false;

function response() {
  return new Response(
    JSON.stringify({
      error: 'Legacy login endpoint is disabled. Use the current Supabase login flow.',
    }),
    {
      status: 410,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  );
}

/**
 * This endpoint previously imported the browser-only Supabase singleton inside
 * an Astro server route. The canonical OPC authentication flow signs in in the
 * browser and synchronizes its validated session through `/api/auth/set-session`.
 * Keeping a second password endpoint live creates divergent session semantics
 * and, on the server, the browser-only client is intentionally unavailable.
 */
export const POST: APIRoute = async () => response();
