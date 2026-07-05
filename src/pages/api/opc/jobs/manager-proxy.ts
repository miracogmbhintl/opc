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

const JOB_RPCS = new Set([
  'opc_delete_service_job',
  'opc_append_job_note',
  'opc_get_job_assignments',
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
  const restPath = parsed.pathname.split('/rest/v1/')[1] || '';
  const parts = restPath.split('/').filter(Boolean);

  if (parts[0] === 'rpc') {
    const rpc = parts[1] || '';
    if (!JOB_RPCS.has(rpc)) return null;

    return {
      kind: 'rpc' as const,
      name: rpc,
      pathAndQuery: `${parsed.pathname}${parsed.search}`,
    };
  }

  const table = parts[0] || '';

  if (!table || (!READ_ONLY_TABLES.has(table) && !MANAGED_TABLES.has(table))) {
    return null;
  }

  return {
    kind: 'table' as const,
    name: table,
    pathAndQuery: `${parsed.pathname}${parsed.search}`,
  };
}

function copyHeader(source: Headers, target: Headers, name: string) {
  const value = source.get(name);
  if (value) target.set(name, value);
}

const handler: APIRoute = async ({ request, locals }) => {
  try {
    const target = resolveTarget(request);

    if (!target) {
      return json({ error: 'Unsupported job data target.' }, 400);
    }

    const method = request.method.toUpperCase();
    const allowedMethods =
      target.kind === 'rpc'
        ? new Set(['GET', 'HEAD', 'POST'])
        : READ_ONLY_TABLES.has(target.name)
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

export const GET = handler;
export const HEAD = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
