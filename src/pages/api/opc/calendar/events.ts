import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import {
  getOpcSupabaseAnonKey,
  getOpcSupabaseUrl,
} from '../../../../lib/opc-server-env';

export const prerender = false;

type JsonRecord = Record<string, unknown>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
    },
  });
}

function bearerToken(request: Request) {
  const header = request.headers.get('authorization') || '';
  return header.toLowerCase().startsWith('bearer ')
    ? header.slice(7).trim()
    : '';
}

function resolveCalendarWindow(request: Request) {
  const url = new URL(request.url);
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
  defaultStart.setDate(defaultStart.getDate() - 7);
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  defaultEnd.setDate(defaultEnd.getDate() + 7);

  const requestedStart = new Date(
    url.searchParams.get('start') || defaultStart.toISOString(),
  );
  const requestedEnd = new Date(
    url.searchParams.get('end') || defaultEnd.toISOString(),
  );
  const start = Number.isFinite(requestedStart.getTime())
    ? requestedStart
    : defaultStart;
  const end = Number.isFinite(requestedEnd.getTime())
    ? requestedEnd
    : defaultEnd;
  const maxEnd = new Date(start.getTime() + 62 * 24 * 60 * 60 * 1000);
  const safeEnd = end > start && end <= maxEnd ? end : maxEnd;

  return {
    p_start: start.toISOString(),
    p_end: safeEnd.toISOString(),
  };
}

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const token = bearerToken(request);

    if (!token) {
      return jsonResponse({ error: 'Nicht angemeldet.' }, 401);
    }

    const supabase = createClient(
      getOpcSupabaseUrl(locals),
      getOpcSupabaseAnonKey(locals),
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    // OPC_CALENDAR_SINGLE_RPC_V1
    // One application request now maps to one database RPC. Jobs are projected
    // directly from opc_service_jobs and are no longer copied into calendar rows.
    const { data, error } = await supabase.rpc(
      'opc_get_calendar_feed',
      resolveCalendarWindow(request),
    );

    if (error) {
      const missingRpc =
        error.code === 'PGRST202' ||
        String(error.message || '').includes('opc_get_calendar_feed');

      return jsonResponse(
        {
          error: missingRpc
            ? 'Die Kalender-RPC ist noch nicht installiert. Bitte zuerst die erzeugte SQL-Datei im Supabase SQL Editor ausführen.'
            : error.message,
          code: error.code || null,
        },
        missingRpc ? 503 : 500,
      );
    }

    return jsonResponse((data || {}) as JsonRecord);
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Kalenderdaten konnten nicht geladen werden.',
      },
      500,
    );
  }
};
