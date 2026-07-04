import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import {
  getOpcSupabaseAnonKey,
  getOpcSupabaseServiceRoleKey,
  getOpcSupabaseUrl,
} from '../../../../lib/opc-server-env';
import { syncJobCalendarState } from '../../../../lib/opc-calendar-job-sync';

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

    const allowed = (staffRows || []).some((row: Record<string, any>) => {
      const role = normalizeRole(row.role);
      return ['owner', 'admin', 'dispatch'].includes(role) || row.can_manage_jobs === true;
    });

    if (!allowed) return jsonResponse({ error: 'Keine Berechtigung für Kalender-Backfill.' }, 403);

    const payload = await request.json().catch(() => ({}));
    const daysBack = Math.max(0, Math.min(365, Number(payload?.days_back ?? 90)));
    const daysForward = Math.max(1, Math.min(730, Number(payload?.days_forward ?? 400)));
    const limit = Math.max(1, Math.min(2000, Number(payload?.limit ?? 1000)));
    const fromIso = new Date(Date.now() - daysBack * 86400000).toISOString();
    const toIso = new Date(Date.now() + daysForward * 86400000).toISOString();

    const { data: jobs, error: jobsError } = await serviceClient
      .from('opc_service_jobs')
      .select('id,planned_start,planned_end')
      .not('planned_start', 'is', null)
      .not('planned_end', 'is', null)
      .gte('planned_end', fromIso)
      .lte('planned_start', toIso)
      .order('planned_start', { ascending: true })
      .limit(limit);

    if (jobsError) throw jobsError;

    const results: Record<string, any>[] = [];
    const errors: Record<string, any>[] = [];

    for (const job of jobs || []) {
      try {
        results.push(
          await syncJobCalendarState({
            supabase: serviceClient,
            jobId: String(job.id),
            actorUserId: user.id,
          }),
        );
      } catch (error) {
        errors.push({
          job_id: job.id,
          error: error instanceof Error ? error.message : 'Unbekannter Fehler',
        });
      }
    }

    return jsonResponse({
      success: errors.length === 0,
      processed: (jobs || []).length,
      synced: results.length,
      failed: errors.length,
      errors: errors.slice(0, 50),
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Kalender-Backfill fehlgeschlagen.' },
      500,
    );
  }
};
