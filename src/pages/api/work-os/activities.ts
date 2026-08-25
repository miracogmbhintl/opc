import type { APIRoute } from 'astro';

// This legacy endpoint exposed every column of work_os_activity_log with
// select('*') and has no active frontend consumer. Keep the route explicit so
// stale clients fail closed instead of silently exposing future schema fields.
export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      error: 'Work OS activity endpoint has been retired. Use scoped board/task APIs.',
    }),
    {
      status: 410,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'private, no-store, max-age=0',
      },
    },
  );
};
