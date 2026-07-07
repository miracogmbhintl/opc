import type { APIRoute } from 'astro';
import {
  createOpcSupabaseAdmin,
  createOpcSupabaseUserClient,
} from '../../../lib/opc-server-env';
import {
  loadOpcAssignmentCandidates,
  normalizeOpcAssignmentRole,
} from '../../../lib/opc-assignment-candidates';

export const prerender = false;

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  return authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
}

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return jsonResponse({ success: false, error: 'Nicht angemeldet.' }, 401);
    }

    const userClient = createOpcSupabaseUserClient(locals, token);
    const adminClient = createOpcSupabaseAdmin(locals);
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ success: false, error: 'Session ist ungültig oder abgelaufen.' }, 401);
    }

    const { data: staffRows, error: staffError } = await adminClient
      .from('opc_staff_roles')
      .select('id,role,status,can_access_portal,can_manage_jobs,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (staffError) {
      throw new Error(`Berechtigung konnte nicht geprüft werden: ${staffError.message}`);
    }

    const activeStaffRows = (staffRows || []).filter((row) => {
      const status = String(row.status || '').trim().toLowerCase();
      return !status || ['active', 'aktiv', 'enabled'].includes(status);
    });
    const metadataRole = normalizeOpcAssignmentRole(
      user.app_metadata?.role || user.app_metadata?.app_role,
    );
    const staffRoles = activeStaffRows.map((row) => normalizeOpcAssignmentRole(row.role));
    const role =
      metadataRole === 'owner' || staffRoles.includes('owner')
        ? 'owner'
        : metadataRole === 'admin' || staffRoles.includes('admin')
          ? 'admin'
          : metadataRole === 'dispatch' || staffRoles.includes('dispatch')
            ? 'dispatch'
            : metadataRole;
    const canManageJobs =
      ['owner', 'admin', 'dispatch'].includes(role) ||
      activeStaffRows.some((row) => row.can_manage_jobs === true);

    if (!canManageJobs) {
      return jsonResponse(
        { success: false, error: 'Keine Berechtigung, Mitarbeiter zuzuweisen.' },
        403,
      );
    }

    const candidates = await loadOpcAssignmentCandidates(adminClient);

    return jsonResponse({
      success: true,
      count: candidates.length,
      candidates,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Mitarbeiter konnten nicht geladen werden.';
    console.error('[opc/assignment-candidates] GET failed', error);
    return jsonResponse({ success: false, error: message }, 500);
  }
};
