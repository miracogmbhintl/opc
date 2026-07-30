import type { APIRoute } from 'astro';
import {
  authenticateOpcClientPortalRequest,
  opcClientPortalJson,
} from '../../../../../lib/opc-client-portal-server';

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
    permissions: access.permissions,
  };
}

function isVisible(row: AnyRow) {
  if (metadata(row).client_visible === true) return true;
  const status = String(row.status || '').trim().toLowerCase();
  return !['', 'draft'].includes(status);
}

function sanitize(row: AnyRow | null | undefined) {
  if (!row) return null;
  const next = { ...row };
  for (const key of ['internal_notes', 'private_notes', 'created_by', 'updated_by']) {
    delete next[key];
  }
  return next;
}

function objectValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as AnyRow
    : null;
}

function firstUrl(row: AnyRow) {
  const meta = metadata(row);
  for (const key of [
    'download_url',
    'file_url',
    'public_url',
    'pdf_url',
    'document_url',
    'signed_url',
    'attachment_url',
    'invoice_pdf_url',
  ]) {
    const value = row[key] || meta[key];
    if (value) return String(value);
  }
  return '';
}

export const GET: APIRoute = async ({ request, locals, params }) => {
  try {
    const authenticated = await authenticateOpcClientPortalRequest(request, locals);

    if ('error' in authenticated) {
      return opcClientPortalJson(
        { ok: false, error: authenticated.error },
        authenticated.status,
      );
    }

    if (!authenticated.access.permissions.canViewInvoices) {
      return opcClientPortalJson(
        { ok: false, error: 'Rechnungen sind für dieses Kundenkonto nicht freigegeben.' },
        403,
      );
    }

    const invoiceId = String(params.id || '').trim();
    if (!invoiceId) {
      return opcClientPortalJson({ ok: false, error: 'Rechnungs-ID fehlt.' }, 400);
    }

    const invoiceResult = await authenticated.serviceClient
      .from('opc_invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('client_id', authenticated.access.clientId)
      .maybeSingle();

    if (invoiceResult.error) {
      throw new Error(`Rechnung konnte nicht geladen werden: ${invoiceResult.error.message}`);
    }

    if (!invoiceResult.data || !isVisible(invoiceResult.data)) {
      return opcClientPortalJson({ ok: false, error: 'Rechnung wurde nicht gefunden.' }, 404);
    }

    const rawInvoice = invoiceResult.data as AnyRow;
    const siteId = rawInvoice.client_site_id || rawInvoice.site_id || null;
    const [itemsResult, siteResult] = await Promise.all([
      authenticated.serviceClient
        .from('opc_invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('sort_order', { ascending: true }),
      siteId
        ? authenticated.serviceClient
            .from('opc_client_sites')
            .select('*')
            .eq('id', siteId)
            .eq('client_id', authenticated.access.clientId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (itemsResult.error) {
      throw new Error(`Rechnungspositionen konnten nicht geladen werden: ${itemsResult.error.message}`);
    }

    const invoice = sanitize(rawInvoice) as AnyRow;
    if (!objectValue(invoice.client_snapshot)) {
      invoice.client_snapshot = sanitize(authenticated.access.client) || {};
    }
    if (!objectValue(invoice.contact_snapshot) && authenticated.access.contact) {
      invoice.contact_snapshot = sanitize(authenticated.access.contact) || {};
    }
    if (!objectValue(invoice.site_snapshot) && siteResult.data) {
      invoice.site_snapshot = sanitize(siteResult.data) || {};
    }

    const originalUrl = firstUrl(invoice);
    if (originalUrl) invoice.download_url = originalUrl;

    return opcClientPortalJson({
      ok: true,
      portal: serializeAccess(authenticated.access),
      detail: {
        invoice,
        items: (itemsResult.data || []).map((row: AnyRow) => sanitize(row)),
      },
    });
  } catch (error: any) {
    console.error('[opc/client-portal/invoice] failed', error);
    return opcClientPortalJson(
      { ok: false, error: error?.message || 'Rechnung konnte nicht geladen werden.' },
      500,
    );
  }
};
