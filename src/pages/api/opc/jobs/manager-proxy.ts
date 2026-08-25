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
  'opc_append_job_note',
  'opc_get_job_assignments',
]);

const UUID_FILTER = /^eq\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      searchParams: parsed.searchParams,
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
    searchParams: parsed.searchParams,
  };
}

function copyHeader(source: Headers, target: Headers, name: string) {
  const value = source.get(name);
  if (value) target.set(name, value);
}

function hasScopedMutationFilter(target: ReturnType<typeof resolveTarget>) {
  if (!target || target.kind !== 'table') return false;

  const idFilter = target.searchParams.get('id') || '';
  const jobFilter = target.searchParams.get('job_id') || '';
  const assignmentFilter = target.searchParams.get('assignment_id') || '';

  return [idFilter, jobFilter, assignmentFilter].some((value) => UUID_FILTER.test(value));
}

function tableMethods(table: string) {
  if (READ_ONLY_TABLES.has(table)) return new Set(['GET', 'HEAD']);

  // Service-job creation and deletion have purpose-built APIs with stronger
  // invariants. The bridge may only read or patch an explicitly scoped job.
  if (table === 'opc_service_jobs' || table === 'opc_jobs') {
    return new Set(['GET', 'HEAD', 'PATCH']);
  }

  return new Set(['GET', 'HEAD', 'POST', 'PATCH', 'DELETE']);
}

function parseJsonBody(body: string | undefined) {
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function bodyHasJobScope(body: unknown) {
  if (Array.isArray(body)) return body.length > 0 && body.every(bodyHasJobScope);
  if (!body || typeof body !== 'object') return false;
  const row = body as Record<string, unknown>;
  return Boolean(row.job_id || row.id || row.assignment_id);
}

const handler: APIRoute = async ({ request, locals }) => {
  try {
    const target = resolveTarget(request);

    if (!target) {
      return json({ error: 'Unsupported job data target.' }, 400);
    }

    const method = request.method.toUpperCase();
    const allowedMethods = target.kind === 'rpc'
      ? new Set(['GET', 'HEAD', 'POST'])
      : tableMethods(target.name);

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

    let body: string | undefined;
    if (method !== 'GET' && method !== 'HEAD') {
      body = await request.text();
    }

    if (target.kind === 'table' && ['PATCH', 'DELETE'].includes(method)) {
      if (!hasScopedMutationFilter(target)) {
        return json({ error: 'Manager mutation requires an explicit UUID record/job filter.' }, 400);
      }
    }

    if (target.kind === 'table' && method === 'POST') {
      const parsedBody = parseJsonBody(body);
      if (!bodyHasJobScope(parsedBody)) {
        return json({ error: 'Manager insert requires an explicit job/record scope.' }, 400);
      }
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
        error: error?.message || 'Manager job operation failed.',
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
