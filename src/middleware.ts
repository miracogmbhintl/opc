import { defineMiddleware } from 'astro:middleware';
import { createClient } from '@supabase/supabase-js';
import {
  getOpcSupabaseAnonKey,
  getOpcSupabaseServiceRoleKey,
  getOpcSupabaseUrl,
} from './lib/opc-server-env';
import { syncJobCalendarState } from './lib/opc-calendar-job-sync';

function bearerToken(request: Request) {
  const header = request.headers.get('authorization') || '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  const pathname = new URL(context.request.url).pathname;

  if (
    context.request.method !== 'POST' ||
    pathname !== '/api/opc/create-service-job' ||
    !response.ok
  ) {
    return response;
  }

  try {
    const payload = await response.clone().json();
    const jobIds = Array.from(
      new Set(
        [payload?.job_id, ...(Array.isArray(payload?.job_ids) ? payload.job_ids : [])]
          .filter(Boolean)
          .map(String),
      ),
    );

    if (jobIds.length === 0) return response;

    const token = bearerToken(context.request);
    if (!token) return response;

    const url = getOpcSupabaseUrl(context.locals);
    const anonKey = getOpcSupabaseAnonKey(context.locals);
    const serviceRoleKey = getOpcSupabaseServiceRoleKey(context.locals);
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const serviceClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) return response;

    for (const jobId of jobIds) {
      try {
        await syncJobCalendarState({
          supabase: serviceClient,
          jobId,
          actorUserId: user.id,
        });
      } catch (error) {
        console.warn(
          `[OPC Middleware] Calendar sync failed for new job ${jobId}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  } catch (error) {
    console.warn(
      '[OPC Middleware] Post-create calendar synchronization failed:',
      error instanceof Error ? error.message : error,
    );
  }

  return response;
});
