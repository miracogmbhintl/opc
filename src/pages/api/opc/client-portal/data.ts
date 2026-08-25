import type { APIRoute } from 'astro';
import {
  authenticateOpcClientPortalRequest,
  opcClientPortalJson,
} from '../../../../lib/opc-client-portal-server';

export const prerender = false;

type AnyRow = Record<string, any>;
type LoadWarning = { section: string; message: string };
type RowsResult = { rows: AnyRow[]; warning: LoadWarning | null };

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

function emptyRows(): RowsResult {
  return { rows: [], warning: null };
}

async function rows(request: PromiseLike<{ data: any; error: any }>, label: string): Promise<RowsResult> {
  try {
    const result = await request;

    if (result.error) {
      const message = String(result.error.message || result.error);
      console.error(`[opc/client-portal/data] ${label}:`, message);
      return {
        rows: [],
        warning: { section: label, message },
      };
    }

    return {
      rows: Array.isArray(result.data) ? result.data as AnyRow[] : [],
      warning: null,
    };
  } catch (error: any) {
    const message = String(error?.message || error || 'Unbekannter Datenfehler');
    console.error(`[opc/client-portal/data] ${label}:`, message);
    return {
      rows: [],
      warning: { section: label, message },
    };
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

function sanitizePortalDocument(row: AnyRow) {
  const document = sanitizeDocument(row);

  if (document.id) {
    document.download_url =
      `/api/opc/client-portal/document-download?document_id=${encodeURIComponent(String(document.id))}`;
  }

  // Never expose raw private storage coordinates to the browser. The download
  // bridge performs a fresh ownership/visibility check before signing the file.
  delete document.storage_path;
  delete document.storage_bucket;

  return document;
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

function warningList(results: RowsResult[]) {
  return results
    .map((result) => result.warning)
    .filter((warning): warning is LoadWarning => Boolean(warning));
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

    const [sitesResult, jobsResult, ticketsResult, quotesResult, invoicesResult, documentsResult] = await Promise.all([
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
        : Promise.resolve(emptyRows()),
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
        : Promise.resolve(emptyRows()),
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
        : Promise.resolve(emptyRows()),
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
        : Promise.resolve(emptyRows()),
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
        : Promise.resolve(emptyRows()),
    ]);

    const jobs = jobsResult.rows.map(sanitizeJob);
    const jobIds = jobs.map((job) => String(job.id || '')).filter(Boolean);

    const reportsResult = access.permissions.canViewReports && jobIds.length
      ? await rows(
          serviceClient
            .from('opc_job_reports')
            .select('*')
            .in('job_id', jobIds)
            .order('updated_at', { ascending: false })
            .limit(300),
          'Berichte',
        )
      : emptyRows();

    const allResults = [
      sitesResult,
      jobsResult,
      ticketsResult,
      quotesResult,
      invoicesResult,
      documentsResult,
      reportsResult,
    ];
    const warnings = warningList(allResults);

    return opcClientPortalJson({
      ok: true,
      partial: warnings.length > 0,
      warnings,
      portal: serializeAccess(access),
      data: {
        sites: sitesResult.rows,
        jobs,
        reports: reportsResult.rows.filter(clientVisibleReport).map(sanitizeDocument),
        tickets: ticketsResult.rows.map((row) => stripPrivateFields(row, ['internal_notes', 'private_notes', 'created_by', 'updated_by'])),
        quotes: quotesResult.rows.filter(clientVisibleQuote).map(sanitizeDocument),
        invoices: invoicesResult.rows.filter(clientVisibleInvoice).map(sanitizeDocument),
        documents: documentsResult.rows.filter(clientVisibleDocument).map(sanitizePortalDocument),
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
