import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Legacy Miraka invoice-number endpoint.
 *
 * OPC invoices now use the canonical `opc_invoices` numbering flow. The old
 * endpoint used an admin Supabase client and only checked whether an arbitrary
 * Authorization header existed, so it must not remain reachable in production.
 */
export const GET: APIRoute = async () =>
  new Response(
    JSON.stringify({
      error: 'Legacy invoice-number endpoint is disabled.',
    }),
    {
      status: 410,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  );
