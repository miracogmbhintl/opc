import type { APIRoute } from 'astro';
import {
  authenticateOpcRequest,
  resolveOpcJobAccess,
} from '../../../../lib/opc-job-access';

export const prerender = false;

const JOB_MEDIA_BUCKET = 'opc-job-media';
const INACTIVE_ASSIGNMENT_STATUSES = new Set([
  'removed',
  'unassigned',
  'cancelled',
  'canceled',
  'deleted',
  'inactive',
  'rejected',
  'declined',
]);

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}

function requestWithCookieBearer(request: Request, cookieToken: string) {
  if (request.headers.get('authorization')) return request;
  if (!cookieToken) return request;

  const headers = new Headers(request.headers);
  headers.set('Authorization', `Bearer ${cookieToken}`);

  return new Request(request.url, {
    method: request.method,
    headers,
  });
}

function safeStoragePath(value: string) {
  const path = clean(value).replace(/^\/+/, '');
  if (!path || path.includes('..') || path.includes('\\')) return '';
  return path;
}

function jobIdFromStoragePath(path: string) {
  return path.match(/(?:^|\/)jobs\/([0-9a-f-]{36})(?:\/|$)/i)?.[1] || '';
}

async function canonicalEmployeeIds(serviceClient: any, userId: string, staffRoleIds: string[]) {
  const ids = new Set<string>();

  const byUser = await serviceClient
    .from('opc_employees')
    .select('id')
    .eq('user_id', userId);

  if (!byUser.error) {
    for (const row of byUser.data || []) {
      if (row?.id) ids.add(String(row.id));
    }
  }

  if (staffRoleIds.length) {
    const byStaffRole = await serviceClient
      .from('opc_employees')
      .select('id')
      .in('staff_role_id', staffRoleIds);

    if (!byStaffRole.error) {
      for (const row of byStaffRole.data || []) {
        if (row?.id) ids.add(String(row.id));
      }
    }
  }

  return ids;
}

async function canViewJob(
  serviceClient: any,
  userId: string,
  jobId: string,
  access: Awaited<ReturnType<typeof resolveOpcJobAccess>>,
) {
  if (access.canViewAllJobs) return true;
  if (!access.canViewAssignedJobs) return false;

  const employeeIds = new Set(access.employeeIds);
  const canonicalIds = await canonicalEmployeeIds(serviceClient, userId, access.staffRoleIds);
  for (const id of canonicalIds) employeeIds.add(id);

  const { data: assignments, error } = await serviceClient
    .from('opc_job_assignments')
    .select('employee_id,status')
    .eq('job_id', jobId);

  if (error) throw new Error(`Einsatz-Zugriff konnte nicht geprüft werden: ${error.message}`);

  return (assignments || []).some((row: any) => {
    const employeeId = clean(row?.employee_id);
    const status = clean(row?.status || 'assigned').toLowerCase();
    return employeeIds.has(employeeId) && !INACTIVE_ASSIGNMENT_STATUSES.has(status);
  });
}

export const GET: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const url = new URL(request.url);
    const storagePath = safeStoragePath(url.searchParams.get('path') || '');

    if (!storagePath) {
      return json({ error: 'Ungültiger Medienpfad.' }, 400);
    }

    const pathJobId = jobIdFromStoragePath(storagePath);
    if (!pathJobId) {
      return json({ error: 'Einsatz konnte aus dem Medienpfad nicht bestimmt werden.' }, 400);
    }

    const cookieToken = clean(cookies.get('sb-access-token')?.value);
    const authRequest = requestWithCookieBearer(request, cookieToken);
    const authenticated = await authenticateOpcRequest(authRequest, locals);

    if ('error' in authenticated) {
      return json({ error: authenticated.error }, authenticated.status);
    }

    const { user, serviceClient } = authenticated;
    const access = await resolveOpcJobAccess(serviceClient, user);

    if (!await canViewJob(serviceClient, user.id, pathJobId, access)) {
      return json({ error: 'Keine Berechtigung für diese Einsatzdatei.' }, 403);
    }

    const { data: mediaRow, error: mediaError } = await serviceClient
      .from('opc_job_media')
      .select('id,job_id,storage_path,file_url')
      .eq('storage_path', storagePath)
      .limit(1)
      .maybeSingle();

    if (mediaError) {
      throw new Error(`Medienreferenz konnte nicht geladen werden: ${mediaError.message}`);
    }

    if (mediaRow?.job_id && String(mediaRow.job_id) !== pathJobId) {
      return json({ error: 'Medienreferenz stimmt nicht mit dem Einsatz überein.' }, 409);
    }

    const { data: signed, error: signedError } = await serviceClient.storage
      .from(JOB_MEDIA_BUCKET)
      .createSignedUrl(storagePath, 5 * 60);

    if (signedError || !signed?.signedUrl) {
      const publicFallback = clean(mediaRow?.file_url);
      if (publicFallback.includes('/storage/v1/object/public/opc-job-media/')) {
        return new Response(null, {
          status: 302,
          headers: {
            Location: publicFallback,
            'Cache-Control': 'private, no-store, max-age=0',
            'Referrer-Policy': 'no-referrer',
          },
        });
      }

      throw new Error(`Medienlink konnte nicht erstellt werden: ${signedError?.message || 'Keine URL erhalten.'}`);
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: signed.signedUrl,
        'Cache-Control': 'private, no-store, max-age=0',
        Pragma: 'no-cache',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error: any) {
    console.error('[opc/jobs/media-file] failed', error);
    return json({ error: error?.message || 'Einsatzdatei konnte nicht geladen werden.' }, 500);
  }
};
