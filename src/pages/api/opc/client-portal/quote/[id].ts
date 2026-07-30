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
  return !['', 'draft', 'ready'].includes(status);
}

function sanitize(row: AnyRow) {
  const next = { ...row };
  for (const key of ['internal_notes', 'private_notes', 'created_by', 'updated_by']) {
    delete next[key];
  }
  return next;
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
        { ok: false, error: 'Offerten sind für dieses Kundenkonto nicht freigegeben.' },
        403,
      );
    }

    const quoteId = String(params.id || '').trim();
    if (!quoteId) {
      return opcClientPortalJson({ ok: false, error: 'Offerten-ID fehlt.' }, 400);
    }

    const quoteResult = await authenticated.serviceClient
      .from('opc_quotes')
      .select('*')
      .eq('id', quoteId)
      .eq('client_id', authenticated.access.clientId)
      .maybeSingle();

    if (quoteResult.error) {
      throw new Error(`Offerte konnte nicht geladen werden: ${quoteResult.error.message}`);
    }

    if (!quoteResult.data || !isVisible(quoteResult.data)) {
      return opcClientPortalJson({ ok: false, error: 'Offerte wurde nicht gefunden.' }, 404);
    }

    const itemsResult = await authenticated.serviceClient
      .from('opc_quote_items')
      .select('*')
      .eq('quote_id', quoteId)
      .order('sort_order', { ascending: true });

    if (itemsResult.error) {
      throw new Error(`Offertenpositionen konnten nicht geladen werden: ${itemsResult.error.message}`);
    }

    return opcClientPortalJson({
      ok: true,
      portal: serializeAccess(authenticated.access),
      detail: {
        quote: sanitize(quoteResult.data),
        items: (itemsResult.data || []).map(sanitize),
      },
    });
  } catch (error: any) {
    console.error('[opc/client-portal/quote] failed', error);
    return opcClientPortalJson(
      { ok: false, error: error?.message || 'Offerte konnte nicht geladen werden.' },
      500,
    );
  }
};
