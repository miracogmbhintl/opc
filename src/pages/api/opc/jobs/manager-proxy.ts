import type { APIRoute } from 'astro';
import {
  authenticateOpcRequest,
  resolveOpcJobAccess,
} from '../../../../lib/opc-job-access';

const READ_ONLY_TABLES = new Set([
  'opc_job_detail_view',
  'opc_my_portal_job_feed',
  'opc_staff_roles',
]);

const MANAGED_TABLES = new Set([
  'opc_service_jobs',
  'opc_jobs',
  'opc_job_assignments',
  'opc_job_time_logs',
  'opc_job_media',
  'opc_job_damage_reports',
  'opc_job_reports',
  'opc_reports',
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}

function resolveTarget(request: Request) {
  const requestUrl = new URL(request.url);
  const target = requestUrl.searchParams.get('target') || '';

  if (!target.startsWith('/rest/v1/')) return null;

  const parsed = new URL(target, 'https://opc.internal');
  const table = parsed.pathname.split('/rest/v1/')[1]?.split('/')[0] || '';

  if (!table || (!READ_ONLY_TABLES.has(table) && !MANAGED_TABLES.has(table))) {
    return null;
  }

  return {
    table,
    pathAndQuery: `${parsed.pathname}${parsed.search}`,
  };
}

function copyHeader(source: Headers, target: Headers, name: string) {
  const value = source.get(name);
  if (value) target.set(name, value);
}

export const ALL: APIRoute = async ({ request, locals }) => {
  try {
    const target = resolveTarget(request);

    if (!target) {
      return json({ error: 'Unsupported job data target.' }, 400);
    }

    const method = request.method.toUpperCase();
    const allowedMethods = READ_ONLY_TABLES.has(target.table)
      ? new Set(['GET', 'HEAD'])
      : new Set(['GET', 'HEAD', 'POST', 'PATCH', 'DELETE']);

    if (!allowedMethods.has(method)) {
      return json({ error: 'Unsupported job data operation.' }, 405);
    }

    const authenticated = await authenticateOpcRequest(request, locals);

    if ('error' in authenticated) {
      return json({ error: authenticated.error }, authenticated.status);
    }

    const access = await resolveOpcJobAccess(authenticated.serviceClient, authenticated.user);

    if (!access.canViewAllJobs || !access.canManageJobs) {
      return json(
        {
          error: 'Manager access required.',
          currentRole: access.role,
        },
        403,
      );
    }

    const upstreamHeaders = new Headers({
      apikey: authenticated.serviceKey,
      Authorization: `Bearer ${authenticated.serviceKey}`,
      'Cache-Control': 'no-cache',
    });

    copyHeader(request.headers, upstreamHeaders, 'accept');
    copyHeader(request.headers, upstreamHeaders, 'content-type');
    copyHeader(request.headers, upstreamHeaders, 'prefer');
    copyHeader(request.headers, upstreamHeaders, 'range');
    copyHeader(request.headers, upstreamHeaders, 'range-unit');

    const body = method === 'GET' || method === 'HEAD' ? undefined : await request.text();
    const upstream = await fetch(`${authenticated.url}${target.pathAndQuery}`, {
      method,
      headers: upstreamHeaders,
      body: body || undefined,
    });

    const responseHeaders = new Headers({
      'Cache-Control': 'private, no-store, max-age=0',
    });

    for (const name of [
      'content-type',
      'content-range',
      'preference-applied',
      'location',
      'range-unit',
    ]) {
      copyHeader(upstream.headers, responseHeaders, name);
    }

    return new Response(method === 'HEAD' ? null : await upstream.arrayBuffer(), {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error('[opc/jobs/manager-proxy] failed', error);
    return json(
      {
        error:
          error?.message ||
          error?.details ||
          error?.hint ||
          error?.code ||
          'Manager job operation failed.',
      },
      500,
    );
  }
};
