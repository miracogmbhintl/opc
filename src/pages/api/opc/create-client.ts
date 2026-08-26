import type { APIRoute } from 'astro';
import { getRuntimeEnv } from '../../../lib/google-oauth';
import { getAuthenticatedContext } from '../../../lib/google-calendar';
import { resolveOpcServerAccess } from '../../../lib/opc-server-access';

export const prerender = false;

const MAX_CERTIFICATE_SIZE = 10 * 1024 * 1024;
const CERTIFICATE_BUCKET = 'client-files';

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}

function clean(value: FormDataEntryValue | string | null | undefined) {
  const text = String(value || '').trim();
  return text || null;
}

function normalizeEmail(value: FormDataEntryValue | string | null | undefined) {
  const text = clean(value);
  return text ? text.toLowerCase() : null;
}

function splitName(fullName: string | null) {
  const parts = String(fullName || '').split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || null,
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
  };
}

function sanitizeFileName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
}

function isAllowedCertificateType(file: File) {
  const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
  const lower = file.name.toLowerCase();
  return allowedTypes.has(file.type) || ['.pdf', '.jpg', '.jpeg', '.png'].some((ext) => lower.endsWith(ext));
}

function buildAddressText(street: string | null, streetNumber: string | null) {
  return [street, streetNumber].filter(Boolean).join(' ').trim() || null;
}

function buildBillingAddress(parts: {
  street: string | null;
  streetNumber: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
}) {
  return [
    [parts.street, parts.streetNumber].filter(Boolean).join(' ').trim(),
    [parts.zipCode, parts.city].filter(Boolean).join(' ').trim(),
    parts.state,
    parts.country,
  ].filter(Boolean).join(', ');
}

async function requireClientManager(request: Request, env: ReturnType<typeof getRuntimeEnv>) {
  const authenticated = await getAuthenticatedContext(request, env);
  const access = await resolveOpcServerAccess(authenticated.supabase, authenticated.user);
  if (!access.canManageClients) {
    throw Object.assign(new Error('Insufficient permissions.'), { status: 403 });
  }
  return { ...authenticated, access };
}

async function uploadBusinessCertificate(supabase: any, clientId: string, certificate: File | null) {
  if (!certificate || !certificate.name || certificate.size === 0) return null;
  if (certificate.size > MAX_CERTIFICATE_SIZE) throw new Error('Business certificate is larger than 10MB.');
  if (!isAllowedCertificateType(certificate)) throw new Error('Business certificate must be PDF, JPG or PNG.');

  const path = `opc-clients/${clientId}/business-certificate/${Date.now()}-${sanitizeFileName(certificate.name)}`;
  const { error } = await supabase.storage.from(CERTIFICATE_BUCKET).upload(path, certificate, {
    contentType: certificate.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) throw new Error(error.message);

  return {
    bucket: CERTIFICATE_BUCKET,
    path,
    filename: certificate.name,
    size: certificate.size,
    type: certificate.type || null,
    uploaded_at: new Date().toISOString(),
  };
}

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const env = getRuntimeEnv({ request, locals } as any);
    const { supabase } = await requireClientManager(request, env);

    const { data: clients, error } = await supabase
      .from('opc_clients')
      .select('id, contact_id, client_type, status, billing_name, billing_email, billing_phone_e164, created_at, metadata')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;

    const contactIds = [...new Set((clients || []).map((row: any) => row.contact_id).filter(Boolean))];
    let contactsById = new Map<string, any>();
    if (contactIds.length) {
      const { data: contacts, error: contactError } = await supabase
        .from('opc_contacts')
        .select('id, full_name, company_name, email, phone_raw, phone_e164')
        .in('id', contactIds);
      if (contactError) throw contactError;
      contactsById = new Map((contacts || []).map((row: any) => [row.id, row]));
    }

    return jsonResponse({
      success: true,
      clients: (clients || []).map((client: any) => {
        const contact = contactsById.get(client.contact_id);
        return {
          id: client.id,
          contact_id: client.contact_id,
          company_name: client.billing_name || contact?.company_name || 'Unbekannt',
          client_name: contact?.full_name || client.billing_name || 'Unbekannt',
          email: client.billing_email || contact?.email || '',
          phone: client.billing_phone_e164 || contact?.phone_e164 || contact?.phone_raw || '',
          status: client.status || 'active',
          client_type: client.client_type || 'unknown',
          created_at: client.created_at,
          has_portal_access: false,
        };
      }),
    });
  } catch (error: any) {
    console.error('[opc/create-client] GET failed:', error);
    return jsonResponse(
      { success: false, error: error?.message || 'Clients could not be loaded.' },
      Number(error?.status || 500),
    );
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > 12 * 1024 * 1024) {
      return jsonResponse({ success: false, error: 'Request is too large.' }, 413);
    }

    const env = getRuntimeEnv({ request, locals } as any);
    const { supabase, user } = await requireClientManager(request, env);
    const form = await request.formData();

    const clientMode = clean(form.get('clientMode')) || 'private';
    const firstName = clean(form.get('firstName'));
    const lastName = clean(form.get('lastName'));
    const submittedFullName = clean(form.get('fullName'));
    const submittedCompanyName = clean(form.get('companyName'));
    const email = normalizeEmail(form.get('email'));
    const phone = clean(form.get('phone'));
    const fullName = submittedFullName || [firstName, lastName].filter(Boolean).join(' ').trim() || submittedCompanyName || email || phone || 'Unbenannter Kontakt';
    const companyName = submittedCompanyName || (clientMode === 'private' ? fullName : null) || fullName || 'Unbenannter Kunde';
    const split = splitName(fullName);

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ success: false, error: 'Invalid email address.' }, 400);
    }

    const website = clean(form.get('website'));
    const industry = clean(form.get('industry'));
    const taxId = clean(form.get('taxId'));
    const preferredContact = clean(form.get('preferredContact')) || 'email';
    const internalNotes = clean(form.get('internalNotes'));
    const clientType = clean(form.get('clientType')) || (clientMode === 'company' ? 'geschaeftskunden' : 'privatkunden');

    const billingStreet = clean(form.get('billingStreet')) || clean(form.get('street'));
    const billingStreetNumber = clean(form.get('billingStreetNumber')) || clean(form.get('streetNumber'));
    const billingCity = clean(form.get('billingCity')) || clean(form.get('city'));
    const billingState = clean(form.get('billingState')) || clean(form.get('state'));
    const billingZipCode = clean(form.get('billingZipCode')) || clean(form.get('zipCode'));
    const billingCountry = clean(form.get('billingCountry')) || clean(form.get('country')) || 'Schweiz';

    const siteStreet = clean(form.get('siteStreet')) || clean(form.get('street'));
    const siteStreetNumber = clean(form.get('siteStreetNumber')) || clean(form.get('streetNumber'));
    const siteCity = clean(form.get('siteCity')) || clean(form.get('city'));
    const siteState = clean(form.get('siteState')) || clean(form.get('state'));
    const siteZipCode = clean(form.get('siteZipCode')) || clean(form.get('zipCode'));
    const siteCountry = clean(form.get('siteCountry')) || clean(form.get('country')) || 'Schweiz';

    const metadata = {
      website,
      industry,
      tax_id: taxId,
      preferred_contact: preferredContact,
      client_mode: clientMode,
      first_name: firstName,
      last_name: lastName,
      created_from: 'kunde-anlegen',
      created_by: user.id,
      portal_access_created: false,
    };

    const { data: atomicResult, error: atomicError } = await supabase.rpc('opc_create_client_atomic', {
      p_client: {
        client_type: clientType,
        status: 'active',
        billing_name: companyName,
        billing_email: email,
        billing_phone_e164: phone,
        billing_address: buildBillingAddress({
          street: billingStreet,
          streetNumber: billingStreetNumber,
          city: billingCity,
          state: billingState,
          zipCode: billingZipCode,
          country: billingCountry,
        }) || null,
        internal_notes: internalNotes,
        metadata,
      },
      p_contact: {
        full_name: fullName,
        first_name: firstName || split.firstName,
        last_name: lastName || split.lastName,
        company_name: clientMode === 'company' ? companyName : null,
        email,
        phone_raw: phone,
        phone_e164: phone,
        preferred_language: 'de',
        lifecycle_stage: 'client',
        source_first: 'manual_client_create',
        source_last: 'manual_client_create',
        notes: internalNotes,
        metadata,
      },
      p_site: {
        site_name: companyName,
        site_type: 'other',
        status: 'active',
        address_text: buildAddressText(siteStreet, siteStreetNumber),
        postal_code: siteZipCode,
        city: siteCity,
        country: siteCountry,
        metadata: {
          state: siteState,
          street: siteStreet,
          street_number: siteStreetNumber,
          created_from: 'kunde-anlegen',
        },
      },
      p_link: {
        role_label: 'Hauptkontakt',
        receives_reports: true,
        receives_invoices: true,
        receives_operations_updates: true,
        metadata,
      },
      p_actor_user_id: user.id,
    });

    if (atomicError) throw new Error(`Client creation failed: ${atomicError.message}`);

    const client = atomicResult?.client;
    const contact = atomicResult?.contact;
    const site = atomicResult?.site;
    if (!client?.id || !contact?.id || !site?.id) throw new Error('Atomic client creation returned incomplete data.');

    let certificateMeta: Record<string, unknown> | null = null;
    let certificateWarning: string | null = null;
    const certificate = form.get('businessCertificate') as File | null;

    try {
      certificateMeta = await uploadBusinessCertificate(supabase, client.id, certificate);
      if (certificateMeta) {
        const { error: metadataError } = await supabase
          .from('opc_clients')
          .update({
            metadata: { ...(client.metadata || {}), business_certificate: certificateMeta },
            updated_at: new Date().toISOString(),
          })
          .eq('id', client.id);
        if (metadataError) {
          await supabase.storage.from(CERTIFICATE_BUCKET).remove([String(certificateMeta.path)]);
          certificateMeta = null;
          throw metadataError;
        }
      }
    } catch (error: any) {
      certificateWarning = error?.message || 'Business certificate could not be uploaded.';
    }

    const { error: activityError } = await supabase.from('opc_client_activity').insert({
      client_id: client.id,
      contact_id: contact.id,
      activity_type: 'created',
      message: `Kunde wurde manuell angelegt: ${companyName || fullName}`,
      created_by: user.id,
      metadata: {
        source: 'kunde-anlegen',
        site_id: site.id,
        certificate_uploaded: Boolean(certificateMeta),
        certificate_warning: certificateWarning,
      },
    });
    if (activityError) console.warn('[opc/create-client] activity logging failed:', activityError.message);

    return jsonResponse({
      success: true,
      clientId: client.id,
      contactId: contact.id,
      siteId: site.id,
      certificate: certificateMeta,
      certificateWarning,
      message: 'Client created successfully.',
    });
  } catch (error: any) {
    console.error('[opc/create-client] POST failed:', error);
    return jsonResponse(
      { success: false, error: error?.message || 'Client could not be created.' },
      Number(error?.status || 500),
    );
  }
};
