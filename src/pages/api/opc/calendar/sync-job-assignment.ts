import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import {
  getOpcSupabaseAnonKey,
  getOpcSupabaseUrl,
} from '../../../../lib/opc-server-env';

export const prerender = false;

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

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const token = bearerToken(request);

    if (!token) {
      return jsonResponse({ error: 'Nicht angemeldet.' }, 401);
    }

    const payload = await request.json().catch(() => null);
    const jobId = String(payload?.job_id || '').trim();

    if (!jobId) {
      return jsonResponse({ error: 'job_id fehlt.' }, 400);
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

    // OPC_ASSIGNMENT_SINGLE_RPC_V2
    // Permission check, add/remove/replace, status update and returned assignment
    // state happen transactionally in PostgreSQL. No calendar synchronization is
    // needed because jobs are read directly into the calendar feed.
    const { data, error } = await supabase.rpc(
      'opc_apply_job_assignment',
      {
        p_job_id: jobId,
        p_add_employee_id:
          String(payload?.add_employee_id || payload?.employee_id || '').trim() ||
          null,
        p_remove_assignment_id:
          String(payload?.remove_assignment_id || '').trim() || null,
        p_replace_assignment_id:
          String(payload?.replace_assignment_id || '').trim() || null,
        p_notes:
          String(payload?.assignment_note || payload?.notes || '').trim() ||
          null,
      },
    );

    if (error) {
      const missingRpc =
        error.code === 'PGRST202' ||
        String(error.message || '').includes('opc_apply_job_assignment');

      return jsonResponse(
        {
          error: missingRpc
            ? 'Die Zuweisungs-RPC ist noch nicht installiert. Bitte zuerst die erzeugte SQL-Datei im Supabase SQL Editor ausführen.'
            : error.message,
          code: error.code || null,
        },
        missingRpc ? 503 : 500,
      );
    }

    return jsonResponse({
      success: true,
      ...(data && typeof data === 'object' ? data : {}),
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Zuweisung konnte nicht gespeichert werden.',
      },
      500,
    );
  }
};
