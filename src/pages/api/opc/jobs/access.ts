import type { APIRoute } from 'astro';
import {
  authenticateOpcRequest,
  resolveOpcJobAccess,
} from '../../../../lib/opc-job-access';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const authenticated = await authenticateOpcRequest(request, locals);

    if ('error' in authenticated) {
      return json({ error: authenticated.error }, authenticated.status);
    }

    const access = await resolveOpcJobAccess(authenticated.serviceClient, authenticated.user);

    return json(access);
  } catch (error: any) {
    console.error('[opc/jobs/access] failed', error);
    return json(
      {
        error:
          error?.message ||
          error?.details ||
          error?.hint ||
          error?.code ||
          'Access could not be resolved.',
      },
      500,
    );
  }
};
