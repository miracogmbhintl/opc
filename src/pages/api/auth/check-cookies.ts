import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Historical cookie diagnostics returned a preview of the raw Cookie header,
 * weakening the HttpOnly boundary around the Supabase session. Keep the route
 * non-functional so old bookmarks fail safely without exposing auth state.
 */
export const GET: APIRoute = async () =>
  new Response(
    JSON.stringify({ error: 'Diagnostic endpoint disabled.' }),
    {
      status: 410,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  );
