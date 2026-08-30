import type { APIRoute } from 'astro';
import { getRuntimeEnv } from '../../../../lib/google-oauth';
import { getAuthenticatedContext, jsonResponse } from '../../../../lib/google-calendar';
import { resolveOpcServerAccess } from '../../../../lib/opc-server-access';

export const prerender = false;

function cleanId(value: unknown) {
  return String(value || '').trim();
}

export const POST: APIRoute = async (context) => {
  const env = getRuntimeEnv(context);

  try {
    const { supabase: serviceSupabase, user } = await getAuthenticatedContext(context.request, env);
    const access = await resolveOpcServerAccess(serviceSupabase, user);

    if (!access.canManageJobs) {
      return jsonResponse({ error: 'Nur Owner, Admin oder Disposition dürfen Einsätze löschen.' }, 403);
    }

    const body = await context.request.json().catch(() => null);
    const jobId = cleanId(body?.job_id || body?.p_job_id);
    if (!jobId) return jsonResponse({ error: 'job_id fehlt.' }, 400);

    const { data, error } = await serviceSupabase.rpc('opc_delete_service_job_atomic', {
      p_job_id: jobId,
      p_actor_user_id: user.id,
    });

    if (error) throw error;

    return jsonResponse({
      ...(data || {}),
      job_id: jobId,
      deleted_by_role: access.role,
    });
  } catch (error: any) {
    return jsonResponse({
      error: error?.message || 'Einsatz konnte nicht gelöscht werden.',
      code: error?.code || null,
    }, error?.status || 500);
  }
};
