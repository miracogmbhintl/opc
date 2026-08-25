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
    '/work-os',
  ];

  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function customerPortalDestination(pathname: string) {
  if (pathname === '/einsaetze' || pathname.startsWith('/einsatz/')) {
    return '/kundenportal/auftraege';
  }

  if (pathname === '/anfragen-schaeden' || pathname.startsWith('/anfragen-schaeden/')) {
    return '/kundenportal/anfragen';
  }

  if (
    pathname === '/berichte-dateien' ||
    pathname.startsWith('/berichte-dateien/') ||
    pathname === '/dokumente' ||
    pathname.startsWith('/dokumente/')
  ) {
    return '/kundenportal/dokumente';
  }

  if (
    pathname === '/offerten' ||
    pathname.startsWith('/offerte/') ||
    pathname === '/rechnungen' ||
    pathname.startsWith('/rechnung/') ||
    pathname === '/finanzen'
  ) {
    return '/kundenportal/finanzen';
  }

  if (pathname === '/einstellungen' || pathname.startsWith('/einstellungen/')) {
    return '/kundenportal/einstellungen';
  }

  return '/kundenportal';
}

function matchesApiPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isPublicOpcApi(pathname: string) {
  const prefixes = [
    '/api/opc/public-ticket-link',
    '/api/opc/create-public-ticket',
    '/api/opc/google-place-autocomplete',
    '/api/opc/google-place-details',
  ];

  return prefixes.some((prefix) => matchesApiPrefix(pathname, prefix));
}

function isClientOpcApi(pathname: string) {
  const prefixes = [
    '/api/opc/client-portal',
    '/api/opc/jobs/access',
  ];

  return prefixes.some((prefix) => matchesApiPrefix(pathname, prefix));
}

function isRestrictedInternalApi(pathname: string) {
  if (pathname.startsWith('/api/work-os/')) return true;

  if (!pathname.startsWith('/api/opc/')) return false;
  if (isPublicOpcApi(pathname)) return false;
  if (isClientOpcApi(pathname)) return false;
  return true;
}

function apiAccessResponse(error: string, status: number) {
  return new Response(
    JSON.stringify({ ok: false, error }),
    {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'private, no-store, max-age=0',
      },
    },
  );
}

async function enforceClientPortalSeparation(context: any, pathname: string) {
  const internalPage = isInternalOpcPage(pathname);
  const restrictedApi = isRestrictedInternalApi(pathname);

  if (!internalPage && !restrictedApi) return null;

  const token =
    context.cookies.get('sb-access-token')?.value ||
    bearerToken(context.request);

  if (!token) {
    if (restrictedApi) {
      return apiAccessResponse('Nicht angemeldet.', 401);
    }

    return null;
  }

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

    if (userError || !user) {
      if (restrictedApi) {
        return apiAccessResponse('Sitzung ist ungültig oder abgelaufen.', 401);
      }

      return null;
    }

    const [staffResult, clientResult] = await Promise.all([
      serviceClient
        .from('opc_staff_roles')
        .select('id')
        .eq('user_id', user.id)
        .in('status', ['active', 'aktiv', 'enabled'])
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

    if (staffResult.data) {
      // A small set of legacy Work OS handlers expects a request-scoped
      // `locals.session`. Populate it from the same user/token that has just
      // passed the canonical staff check instead of maintaining a second auth
      // mechanism in those endpoints.
      context.locals.session = {
        user,
        access_token: token,
      };
      return null;
    }

    if (restrictedApi) {
      return apiAccessResponse(
        'Diese interne Funktion ist nur für aktive Mitarbeiterkonten freigegeben.',
        403,
      );
    }

    if (!clientResult.data) return null;

    return context.redirect(customerPortalDestination(pathname), 302);
  } catch (error) {
    console.warn(
      '[OPC Middleware] Access separation failed:',
      error instanceof Error ? error.message : error,
    );

    if (restrictedApi) {
      return apiAccessResponse('Interne Zugriffsprüfung ist fehlgeschlagen.', 503);
    }

    return null;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = new URL(context.request.url).pathname;
  const separationResponse = await enforceClientPortalSeparation(context, pathname);

  if (separationResponse) return separationResponse;

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
