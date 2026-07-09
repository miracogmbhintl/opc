import type { APIRoute } from 'astro';
import { getRuntimeEnv } from '../../../../lib/google-oauth';
import { getAuthenticatedContext, jsonResponse } from '../../../../lib/google-calendar';
import { resolveOpcServerAccess } from '../../../../lib/opc-server-access';

export const prerender = false;
type AnyRow = Record<string, any>;

function cleanId(value: unknown) {
  return String(value || '').trim();
}

async function legacyCalendarEventIds(serviceSupabase: any, jobId: string) {
  const results = await Promise.all([
    serviceSupabase.from('opc_calendar_events').select('id').eq('job_id', jobId),
    serviceSupabase.from('opc_calendar_events').select('id').contains('metadata', { job_id: jobId }),
    serviceSupabase.from('opc_calendar_events').select('id').contains('metadata', { source_job_id: jobId }),
  ]);

  const ids = new Set<string>();
  for (const result of results) {
    if (result.error) throw result.error;
    for (const row of result.data || []) {
      if (row?.id) ids.add(String(row.id));
    }
  }
  return Array.from(ids);
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

    const { data: existingJob, error: jobReadError } = await serviceSupabase
      .from('opc_service_jobs')
      .select('id,status,metadata')
      .eq('id', jobId)
      .maybeSingle();

    if (jobReadError) throw jobReadError;
    if (!existingJob) {
      return jsonResponse({ job_id: jobId, deleted: true, already_missing: true });
    }

    const now = new Date().toISOString();

    const { error: assignmentError } = await serviceSupabase
      .from('opc_job_assignments')
      .update({ status: 'removed', updated_at: now })
      .eq('job_id', jobId)
      .not('status', 'in', '("removed","unassigned","cancelled","canceled","deleted","inactive","rejected")');

    if (assignmentError) throw assignmentError;

    const eventIds = await legacyCalendarEventIds(serviceSupabase, jobId);

    if (eventIds.length > 0) {
      const { error: attendeeDeleteError } = await serviceSupabase
        .from('opc_calendar_event_attendees')
        .delete()
        .in('event_id', eventIds);
      if (attendeeDeleteError) throw attendeeDeleteError;

      const { error: eventDeleteError } = await serviceSupabase
        .from('opc_calendar_events')
        .delete()
        .in('id', eventIds);
      if (eventDeleteError) throw eventDeleteError;
    }

    // OPC_SERVICE_JOB_HARD_DELETE_V1
    // opc_service_jobs does not allow status='deleted'.
    // A confirmed delete therefore removes the source row itself.
    const {
      data: deletedRows,
      error: deleteError,
    } = await serviceSupabase
      .from('opc_service_jobs')
      .delete()
      .eq('id', jobId)
      .select('id');

    if (deleteError) throw deleteError;

    if (
      !Array.isArray(deletedRows) ||
      deletedRows.length === 0
    ) {
      return jsonResponse(
        {
          error:
            'Einsatz wurde nicht gelöscht. Die Einsatzzeile wurde nicht gefunden oder konnte nicht entfernt werden.',
        },
        409,
      );
    }

    return jsonResponse({
      job_id: jobId,
      deleted: true,
      hard_deleted: true,
      removed_legacy_calendar_event_count:
        eventIds.length,
      deleted_by_role: access.role,
    });
  } catch (error: any) {
    return jsonResponse({
      error: error?.message || 'Einsatz konnte nicht gelöscht werden.',
      code: error?.code || null,
    }, error?.status || 500);
  }
};
