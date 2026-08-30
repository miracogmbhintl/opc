import type { APIRoute } from 'astro';
import { getRuntimeEnv } from '../../../lib/google-oauth';
import { getAuthenticatedContext } from '../../../lib/google-calendar';
import { resolveOpcServerAccess } from '../../../lib/opc-server-access';

export const prerender = false;

type UpdateClientBody = {
  clientId?: string;
  id?: string;
  resolvedClientId?: string;
  editedClient?: Record<string, any>;
  client?: Record<string, any>;
  [key: string]: any;
};

const ALLOWED_SITE_TYPES = new Set([
  'office', 'residential', 'construction_site', 'staircase', 'commercial', 'mixed',
  'retail', 'restaurant', 'hotel', 'school', 'medical', 'warehouse', 'industrial', 'other',
]);

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}

function clean(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeEmail(value: unknown) {
  const text = clean(value);
  return text ? text.toLowerCase() : null;
}

function normalizeSiteType(value: unknown) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return 'other';
  const map: Record<string, string> = {
    'büro': 'office', buero: 'office', office: 'office', privat: 'residential',
    wohnung: 'residential', residential: 'residential', baustelle: 'construction_site',
    construction: 'construction_site', construction_site: 'construction_site',
    treppenhaus: 'staircase', staircase: 'staircase', gewerbe: 'commercial',
    commercial: 'commercial', gemischt: 'mixed', mixed: 'mixed', retail: 'retail',
    restaurant: 'restaurant', hotel: 'hotel', school: 'school', medical: 'medical',
    warehouse: 'warehouse', industrial: 'industrial', sonstiges: 'other', other: 'other',
  };
  const mapped = map[text] || text;
  return ALLOWED_SITE_TYPES.has(mapped) ? mapped : 'other';
}

function pickEditedClient(body: UpdateClientBody) {
  if (body.editedClient && typeof body.editedClient === 'object') return body.editedClient;
  if (body.client && typeof body.client === 'object') return body.client;
  return body;
}

function pickClientId(body: UpdateClientBody, editedClient: Record<string, any>) {
  return clean(
    body.clientId || body.resolvedClientId || body.id ||
    editedClient.clientId || editedClient.resolvedClientId || editedClient.id,
  );
}

function buildClientPayload(editedClient: Record<string, any>) {
  const billingName = clean(editedClient.billing_name) || clean(editedClient.company_name) || clean(editedClient.full_name);
  if (!billingName) throw Object.assign(new Error('Billing name is required.'), { status: 400 });

  const email = normalizeEmail(editedClient.billing_email) || normalizeEmail(editedClient.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error('Invalid email address.'), { status: 400 });
  }

  return {
    billing_name: billingName,
    billing_email: email,
    billing_phone_e164: clean(editedClient.billing_phone_e164) || clean(editedClient.phone_e164) || clean(editedClient.phone_raw),
    billing_address: clean(editedClient.billing_address),
    internal_notes: clean(editedClient.internal_notes),
    client_type: clean(editedClient.client_type) || 'unknown',
    status: clean(editedClient.status) || 'active',
  };
}

function buildContactPayload(editedClient: Record<string, any>) {
  return {
    full_name: clean(editedClient.full_name),
    company_name: clean(editedClient.company_name) || clean(editedClient.billing_name),
    email: normalizeEmail(editedClient.email) || normalizeEmail(editedClient.billing_email),
    phone_raw: clean(editedClient.phone_raw) || clean(editedClient.phone_e164) || clean(editedClient.billing_phone_e164),
    phone_e164: clean(editedClient.phone_e164) || clean(editedClient.phone_raw) || clean(editedClient.billing_phone_e164),
  };
}

function buildSitePayload(editedClient: Record<string, any>) {
  return {
    primary_site_id: clean(editedClient.primary_site_id),
    site_name: clean(editedClient.primary_site_name) || clean(editedClient.company_name) || clean(editedClient.billing_name) || 'Hauptstandort',
    site_type: normalizeSiteType(editedClient.primary_site_type),
    status: 'active',
    address_text: clean(editedClient.primary_site_address),
    postal_code: clean(editedClient.primary_site_postal_code),
    city: clean(editedClient.primary_site_city),
    country: clean(editedClient.primary_site_country) || 'CH',
  };
}

export const POST: APIRoute = async (context) => {
  const requestId = Date.now().toString(36);
  try {
    const env = getRuntimeEnv(context);
    const { supabase, user } = await getAuthenticatedContext(context.request, env);
    const access = await resolveOpcServerAccess(supabase, user);
    if (!access.canManageClients) {
      return jsonResponse({ success: false, error: 'Insufficient permissions.', requestId }, 403);
    }

    const contentLength = Number(context.request.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > 1_000_000) {
      return jsonResponse({ success: false, error: 'Request is too large.', requestId }, 413);
    }

    const body = (await context.request.json().catch(() => ({}))) as UpdateClientBody;
    const editedClient = pickEditedClient(body);
    const clientId = pickClientId(body, editedClient);
    if (!clientId) {
      return jsonResponse({ success: false, error: 'Missing clientId.', requestId }, 400);
    }

    const { data: result, error } = await supabase.rpc('opc_update_client_atomic', {
      p_client_id: clientId,
      p_client: buildClientPayload(editedClient),
      p_contact: buildContactPayload(editedClient),
      p_site: buildSitePayload(editedClient),
      p_actor_user_id: user.id,
    });

    if (error) throw new Error(`Client update failed: ${error.message}`);
    if (!result?.client?.id || !result?.site?.id) throw new Error('Atomic client update returned incomplete data.');

    const client = result.client;
    const contact = result.contact || null;
    const site = result.site;

    return jsonResponse({
      success: true,
      requestId,
      clientId: client.id,
      contactId: contact?.id || client.contact_id || null,
      primarySiteId: site.id,
      billingName: client.billing_name,
      status: client.status,
      billingPhone: client.billing_phone_e164 || null,
      contactPhoneRaw: contact?.phone_raw || null,
      contactPhoneE164: contact?.phone_e164 || null,
    });
  } catch (error: any) {
    console.error(`[opc/update-client-details] ${requestId} failed:`, error);
    return jsonResponse(
      { success: false, error: error?.message || 'Client could not be updated.', requestId },
      Number(error?.status || (/permission/i.test(error?.message || '') ? 403 : 500)),
    );
  }
};

export const GET: APIRoute = async () => {
  return jsonResponse({ success: true, route: 'opc/update-client-details', status: 'live' });
};
