import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import {
  getOpcSupabaseAnonKey,
  getOpcSupabaseServiceRoleKey,
  getOpcSupabaseUrl,
} from '../../../../lib/opc-server-env';
import { syncJobCalendarState } from '../../../../lib/opc-calendar-job-sync';

type AnyRow = Record<string, any>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function bearerToken(request: Request) {
  const header = request.headers.get('authorization') || '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}

function normalizeRole(value: unknown) {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'dispatcher' || role === 'disposition') return 'dispatch';
  if (role === 'administrator') return 'admin';
  if (role === 'inhaber') return 'owner';
  return role;
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const url = getOpcSupabaseUrl(locals);
    const anonKey = getOpcSupabaseAnonKey(locals);
    const serviceRoleKey = getOpcSupabaseServiceRoleKey(locals);
    const token = bearerToken(request);

    if (!token) return jsonResponse({ error: 'Nicht angemeldet.' }, 401);

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const serviceClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) return jsonResponse({ error: 'Session ist ungültig.' }, 401);

    const { data: staffRows, error: staffError } = await serviceClient
      .from('opc_staff_roles')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (staffError) throw staffError;

    const allowed = (staffRows || []).some((row: AnyRow) => {
      const role = normalizeRole(row.role);
      return (
        ['owner', 'admin', 'dispatch'].includes(role) ||
        row.can_manage_jobs === true ||
        row.can_manage_calendar === true
      );
    });

    if (!allowed) return jsonResponse({ error: 'Keine Berechtigung für Kalender-Synchronisation.' }, 403);

    const payload = await request.json().catch(() => null);
    let jobId = String(payload?.job_id || '').trim();
    const assignmentId = String(payload?.remove_assignment_id || '').trim();
    let removedAssignmentId: string | null = null;

    if (assignmentId) {
      const { data: assignment, error: assignmentError } = await serviceClient
        .from('opc_job_assignments')
        .select('*')
        .eq('id', assignmentId)
        .maybeSingle();

      if (assignmentError) throw assignmentError;
      if (!assignment) return jsonResponse({ error: 'Zuweisung wurde nicht gefunden.' }, 404);

      const assignmentJobId = String(assignment.job_id || '').trim();
      if (!assignmentJobId) {
        return jsonResponse({ error: 'Die Zuweisung besitzt keine Einsatz-ID.' }, 400);
      }

      if (jobId && jobId !== assignmentJobId) {
        return jsonResponse({ error: 'Zuweisung und Einsatz stimmen nicht überein.' }, 409);
      }

      jobId = assignmentJobId;

      const { data: deletedRows, error: deleteError } = await serviceClient
        .from('opc_job_assignments')
        .delete()
        .eq('id', assignmentId)
        .select('id');

      if (deleteError) throw deleteError;
      if (!deletedRows?.length) {
        return jsonResponse({ error: 'Zuweisung konnte nicht entfernt werden.' }, 409);
      }

      removedAssignmentId = assignmentId;
    }

    if (!jobId) return jsonResponse({ error: 'job_id fehlt.' }, 400);

    const result = await syncJobCalendarState({
      supabase: serviceClient,
      jobId,
      actorUserId: user.id,
    });

    return jsonResponse({
      success: true,
      removed_assignment_id: removedAssignmentId,
      sync: result,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Kalender-Synchronisation fehlgeschlagen.',
      },
      500,
    );
  }
};
