import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals, request }) => {
  const diagnostics = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    url: request.url,
    runtime: {
      hasRuntime: !!locals?.runtime,
      hasEnv: !!locals?.runtime?.env,
      envKeys: locals?.runtime?.env ? Object.keys(locals.runtime.env) : []
    }
  };

  return new Response(JSON.stringify(diagnostics, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
};
