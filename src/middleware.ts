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

function isInternalOpcPage(pathname: string) {
  const prefixes = [
    '/dashboard',
    '/anfragen',
    '/anfragen-schaeden',
    '/besichtigungen',
    '/besichtigung',
    '/offerten',
    '/offerte',
    '/rechnungen',
    '/rechnung',
    '/kalender',
    '/calendar',
    '/zeiterfassung',
    '/kunden',
    '/kunde',
    '/kunde-anlegen',
    '/mitarbeiter',
    '/mitarbeiter-anlegen',
    '/einsaetze',
    '/einsatz',
    '/einsatz-planen',
    '/berichte-dateien',
    '/dokumente',
    '/qr-codes',
    '/finanzen',
    '/rechnungsautomationen',
    '/einstellungen',
  ];

  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

async function redirectClientFromInternalPortal(context: any, pathname: string) {
  if (!isInternalOpcPage(pathname)) return null;

  const token = context.cookies.get('sb-access-token')?.value || '';
  if (!token) return null;

  try {
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

    if (userError || !user) return null;

    const [staffResult, clientResult] = await Promise.all([
      serviceClient
        .from('opc_staff_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .eq('can_access_portal', true)
        .limit(1)
        .maybeSingle(),
      serviceClient
        .from('opc_client_users')
        .select('id')
        .eq('user_id', user.id)
        .eq('can_access_client_portal', true)
        .in('status', ['active', 'invited'])
        .limit(1)
        .maybeSingle(),
    ]);

    if (staffResult.data) return null;
    if (!clientResult.data) return null;

    return context.redirect('/kundenportal', 302);
  } catch (error) {
    console.warn(
      '[OPC Middleware] Client route separation failed:',
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = new URL(context.request.url).pathname;
  const clientRedirect = await redirectClientFromInternalPortal(context, pathname);

  if (clientRedirect) return clientRedirect;

  const response = await next();

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
