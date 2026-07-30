import type { APIRoute } from 'astro';
import {
  authenticateOpcClientPortalRequest,
  opcClientPortalJson,
} from '../../../../lib/opc-client-portal-server';

export const prerender = false;

type AnyRow = Record<string, any>;

function metadata(row: AnyRow | null | undefined) {
  const value = row?.metadata;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
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

async function rows(request: PromiseLike<{ data: any; error: any }>, label: string) {
  try {
    const result = await request;
    if (result.error) {
      console.warn(`[opc/client-portal/data] ${label}:`, result.error.message);
      return [] as AnyRow[];
    }
    return Array.isArray(result.data) ? result.data as AnyRow[] : [];
  } catch (error: any) {
    console.warn(`[opc/client-portal/data] ${label}:`, error?.message || error);
    return [] as AnyRow[];
  }
}

function stripPrivateFields(row: AnyRow, privateKeys: string[]) {
  const next = { ...row };
  for (const key of privateKeys) delete next[key];
  return next;
}

function sanitizeJob(row: AnyRow) {
  return stripPrivateFields(row, [
    'internal_notes',
    'dispatcher_notes',
    'employee_notes',
    'private_notes',
    'created_by',
    'updated_by',
  ]);
}

function sanitizeDocument(row: AnyRow) {
  return stripPrivateFields(row, [
    'internal_notes',
    'private_notes',
    'created_by',
    'updated_by',
  ]);
}

function clientVisibleReport(row: AnyRow) {
  if (metadata(row).client_visible === true) return true;
  const status = String(row.status || '').trim().toLowerCase();
  return [
    'approved',
    'report_approved',
    'sent_to_client',
    'published',
    'released',
    'completed',
  ].includes(status);
}

function clientVisibleQuote(row: AnyRow) {
  if (metadata(row).client_visible === true) return true;
  const status = String(row.status || '').trim().toLowerCase();
  return !['', 'draft', 'ready'].includes(status);
}

function clientVisibleInvoice(row: AnyRow) {
  if (metadata(row).client_visible === true) return true;
  const status = String(row.status || '').trim().toLowerCase();
  return !['', 'draft'].includes(status);
}

function clientVisibleDocument(row: AnyRow) {
  if (metadata(row).client_visible === false) return false;
  const status = String(row.status || '').trim().toLowerCase();
  return !['internal', 'private', 'draft'].includes(status);
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

    const { serviceClient, access } = authenticated;
    const clientId = access.clientId;

    const [sitesRaw, jobsRaw, ticketsRaw, quotesRaw, invoicesRaw, documentsRaw] = await Promise.all([
      rows(
        serviceClient
          .from('opc_client_sites')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: true })
          .limit(200),
        'Standorte',
      ),
      access.permissions.canViewJobs
        ? rows(
            serviceClient
              .from('opc_service_jobs')
              .select('*')
              .eq('client_id', clientId)
              .order('planned_start', { ascending: false })
              .limit(300),
            'Aufträge',
          )
        : Promise.resolve([]),
      access.permissions.canViewDamageReports
        ? rows(
            serviceClient
              .from('opc_tickets')
              .select('*')
              .eq('client_id', clientId)
              .order('created_at', { ascending: false })
              .limit(300),
            'Anfragen',
          )
        : Promise.resolve([]),
      access.permissions.canViewInvoices
        ? rows(
            serviceClient
              .from('opc_quotes')
              .select('*')
              .eq('client_id', clientId)
              .order('created_at', { ascending: false })
              .limit(200),
            'Offerten',
          )
        : Promise.resolve([]),
      access.permissions.canViewInvoices
        ? rows(
            serviceClient
              .from('opc_invoices')
              .select('*')
              .eq('client_id', clientId)
              .order('created_at', { ascending: false })
              .limit(300),
            'Rechnungen',
          )
        : Promise.resolve([]),
      access.permissions.canViewReports
        ? rows(
            serviceClient
              .from('opc_documents')
              .select('*')
              .eq('client_id', clientId)
              .order('created_at', { ascending: false })
              .limit(300),
            'Dokumente',
          )
        : Promise.resolve([]),
    ]);

    const jobs = jobsRaw.map(sanitizeJob);
    const jobIds = jobs.map((job) => String(job.id || '')).filter(Boolean);

    const reportsRaw = access.permissions.canViewReports && jobIds.length
      ? await rows(
          serviceClient
            .from('opc_job_reports')
            .select('*')
            .in('job_id', jobIds)
            .order('updated_at', { ascending: false })
            .limit(300),
          'Berichte',
        )
      : [];

    return opcClientPortalJson({
      ok: true,
      portal: serializeAccess(access),
      data: {
        sites: sitesRaw,
        jobs,
        reports: reportsRaw.filter(clientVisibleReport).map(sanitizeDocument),
        tickets: ticketsRaw.map((row) => stripPrivateFields(row, ['internal_notes', 'private_notes', 'created_by', 'updated_by'])),
        quotes: quotesRaw.filter(clientVisibleQuote).map(sanitizeDocument),
        invoices: invoicesRaw.filter(clientVisibleInvoice).map(sanitizeDocument),
        documents: documentsRaw.filter(clientVisibleDocument).map(sanitizeDocument),
      },
    });
  } catch (error: any) {
    console.error('[opc/client-portal/data] failed', error);
    return opcClientPortalJson(
      { ok: false, error: error?.message || 'Kundenportal-Daten konnten nicht geladen werden.' },
      500,
    );
  }
};
