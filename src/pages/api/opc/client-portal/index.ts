import type { APIRoute } from 'astro';
import {
  authenticateOpcClientPortalRequest,
  opcClientPortalJson,
} from '../../../../lib/opc-client-portal-server';

export const prerender = false;

type AnyRow = Record<string, any>;

type PortalDataset = {
  sites: AnyRow[];
  jobs: AnyRow[];
  reports: AnyRow[];
  tickets: AnyRow[];
  quotes: AnyRow[];
  invoices: AnyRow[];
  documents: AnyRow[];
};

function cleanString(value: unknown, maxLength = 2000) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, maxLength);
}

function serializeAccess(access: any) {
  const client = access.client || {};
  const contact = access.contact || {};
  const clientUser = access.clientUser || {};

  return {
    user_id: access.user.id,
    client_id: access.clientId,
    contact_id: access.contactId,
    display_name:
      clientUser.display_name ||
      contact.full_name ||
      contact.company_name ||
      client.billing_name ||
      access.user.email ||
      'Kunde',
    email: clientUser.email || contact.email || client.billing_email || access.user.email || '',
    phone:
      clientUser.phone_e164 ||
      clientUser.phone_raw ||
      contact.phone_e164 ||
      contact.phone_raw ||
      client.billing_phone_e164 ||
      '',
    company_name: client.billing_name || contact.company_name || 'Kundenkonto',
    client_type: client.client_type || null,
    status: client.status || null,
    permissions: access.permissions,
  };
}

async function safeList(
  warnings: string[],
  label: string,
  request: PromiseLike<{ data: any; error: any }>,
): Promise<AnyRow[]> {
  try {
    const result = await request;

    if (result.error) {
      warnings.push(`${label}: ${result.error.message}`);
      return [];
    }

    return Array.isArray(result.data) ? result.data : [];
  } catch (error: any) {
    warnings.push(`${label}: ${error?.message || 'Unbekannter Fehler'}`);
    return [];
  }
}

async function loadPortalDataset(serviceClient: any, clientId: string): Promise<{
  data: PortalDataset;
  warnings: string[];
}> {
  const warnings: string[] = [];

  const [sites, jobs, reports, tickets, quotes, invoices, documents] = await Promise.all([
    safeList(
      warnings,
      'Standorte',
      serviceClient
        .from('opc_client_sites')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true })
        .limit(200),
    ),
    safeList(
      warnings,
      'Aufträge',
      serviceClient
        .from('opc_service_jobs')
        .select('*')
        .eq('client_id', clientId)
        .order('planned_start', { ascending: false })
        .limit(300),
    ),
    safeList(
      warnings,
      'Berichte',
      serviceClient
        .from('opc_job_reports')
        .select('*')
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false })
        .limit(300),
    ),
    safeList(
      warnings,
      'Anfragen',
      serviceClient
        .from('opc_tickets')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(300),
    ),
    safeList(
      warnings,
      'Offerten',
      serviceClient
        .from('opc_quotes')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(200),
    ),
    safeList(
      warnings,
      'Rechnungen',
      serviceClient
        .from('opc_invoices')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(300),
    ),
    safeList(
      warnings,
      'Dokumente',
      serviceClient
        .from('opc_documents')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(300),
    ),
  ]);

  return {
    data: {
      sites,
      jobs,
      reports,
      tickets,
      quotes,
      invoices,
      documents,
    },
    warnings,
  };
}

async function loadJobDetail(
  serviceClient: any,
  clientId: string,
  jobId: string,
) {
  const warnings: string[] = [];

  const jobResult = await serviceClient
    .from('opc_service_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (jobResult.error) {
    throw new Error(`Auftrag konnte nicht geladen werden: ${jobResult.error.message}`);
  }

  if (!jobResult.data) return null;

  const [reports, sites, assignments] = await Promise.all([
    safeList(
      warnings,
      'Auftragsberichte',
      serviceClient
        .from('opc_job_reports')
        .select('*')
        .eq('client_id', clientId)
        .eq('job_id', jobId)
        .order('updated_at', { ascending: false })
        .limit(100),
    ),
    safeList(
      warnings,
      'Standort',
      serviceClient
        .from('opc_client_sites')
        .select('*')
        .eq('client_id', clientId)
        .eq('id', jobResult.data.client_site_id || jobResult.data.site_id)
        .limit(1),
    ),
    safeList(
      warnings,
      'Auftragszuweisungen',
      serviceClient
        .from('opc_job_assignments')
        .select('id,job_id,status,created_at,updated_at')
        .eq('job_id', jobId)
        .limit(50),
    ),
  ]);

  return {
    job: jobResult.data,
    reports,
    site: sites[0] || null,
    assignment_statuses: assignments.map((row) => ({
      status: row.status || null,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
    })),
    warnings,
  };
}

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const authenticated = await authenticateOpcClientPortalRequest(request, locals);

    if ('error' in authenticated) {
      return opcClientPortalJson(
        { ok: false, error: authenticated.error },
        authenticated.status,
      );
    }

    const url = new URL(request.url);
    const jobId = cleanString(url.searchParams.get('job_id'), 120);

    if (jobId) {
      const detail = await loadJobDetail(
        authenticated.serviceClient,
        authenticated.access.clientId,
        jobId,
      );

      if (!detail) {
        return opcClientPortalJson(
          { ok: false, error: 'Auftrag wurde nicht gefunden.' },
          404,
        );
      }

      return opcClientPortalJson({
        ok: true,
        portal: serializeAccess(authenticated.access),
        detail,
      });
    }

    const dataset = await loadPortalDataset(
      authenticated.serviceClient,
      authenticated.access.clientId,
    );

    return opcClientPortalJson({
      ok: true,
      portal: serializeAccess(authenticated.access),
      data: dataset.data,
      warnings: dataset.warnings,
    });
  } catch (error: any) {
    console.error('[opc/client-portal] GET failed', error);

    return opcClientPortalJson(
      {
        ok: false,
        error: error?.message || 'Kundenportal konnte nicht geladen werden.',
      },
      500,
    );
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const authenticated = await authenticateOpcClientPortalRequest(request, locals);

    if ('error' in authenticated) {
      return opcClientPortalJson(
        { ok: false, error: authenticated.error },
        authenticated.status,
      );
    }

    const body = (await request.json().catch(() => ({}))) as AnyRow;
    const action = cleanString(body.action, 80);

    if (action !== 'create_request') {
      return opcClientPortalJson({ ok: false, error: 'Ungültige Aktion.' }, 400);
    }

    if (!authenticated.access.permissions.canCreateRequests) {
      return opcClientPortalJson(
        { ok: false, error: 'Für dieses Kundenkonto dürfen keine Anfragen erstellt werden.' },
        403,
      );
    }

    const title = cleanString(body.title, 180);
    const description = cleanString(body.description, 3000);
    const category = cleanString(body.category, 80);
    const priority = cleanString(body.priority, 40) || 'normal';
    const siteId = cleanString(body.site_id, 120) || null;

    if (!title || !description) {
      return opcClientPortalJson(
        { ok: false, error: 'Titel und Beschreibung sind erforderlich.' },
        400,
      );
    }

    if (!['cleaning_needed', 'damage'].includes(category)) {
      return opcClientPortalJson(
        { ok: false, error: 'Bitte eine gültige Anfrageart auswählen.' },
        400,
      );
    }

    if (!['low', 'normal', 'high'].includes(priority)) {
      return opcClientPortalJson(
        { ok: false, error: 'Bitte eine gültige Priorität auswählen.' },
        400,
      );
    }

    if (siteId) {
      const siteCheck = await authenticated.serviceClient
        .from('opc_client_sites')
        .select('id')
        .eq('id', siteId)
        .eq('client_id', authenticated.access.clientId)
        .maybeSingle();

      if (siteCheck.error || !siteCheck.data) {
        return opcClientPortalJson(
          { ok: false, error: 'Der ausgewählte Standort gehört nicht zu diesem Kundenkonto.' },
          400,
        );
      }
    }

    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
    const ticketNumber = `${category === 'damage' ? 'SH' : 'TK'}-${datePart}-${suffix}`;
    const portal = serializeAccess(authenticated.access);

    const insertResult = await authenticated.serviceClient
      .from('opc_tickets')
      .insert({
        ticket_number: ticketNumber,
        source: 'client_portal',
        status: 'new',
        priority,
        category,
        title,
        description,
        reporter_name: portal.display_name,
        reporter_phone: portal.phone || null,
        reporter_email: portal.email || null,
        client_id: authenticated.access.clientId,
        site_id: siteId,
        metadata: {
          source: 'opc_customer_portal',
          created_by_auth_user_id: authenticated.user.id,
          created_at: now.toISOString(),
        },
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select('*')
      .single();

    if (insertResult.error) {
      throw new Error(`Anfrage konnte nicht erstellt werden: ${insertResult.error.message}`);
    }

    const eventResult = await authenticated.serviceClient
      .from('opc_ticket_events')
      .insert({
        ticket_id: insertResult.data.id,
        event_type: 'created',
        message: 'Kundenanfrage wurde über das Kundenportal erstellt.',
        actor_type: 'client',
        new_status: 'new',
        metadata: {
          created_by_auth_user_id: authenticated.user.id,
          source: 'opc_customer_portal',
        },
      });

    if (eventResult.error) {
      console.warn('[opc/client-portal] Ticket event was not created', eventResult.error.message);
    }

    return opcClientPortalJson({
      ok: true,
      ticket: insertResult.data,
      message: 'Ihre Anfrage wurde erstellt.',
    });
  } catch (error: any) {
    console.error('[opc/client-portal] POST failed', error);

    return opcClientPortalJson(
      {
        ok: false,
        error: error?.message || 'Anfrage konnte nicht erstellt werden.',
      },
      500,
    );
  }
};
