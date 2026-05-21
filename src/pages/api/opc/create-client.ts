import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

type ProfileSource = {
  source: 'bearer' | 'cookie';
  token: string;
};

const MAX_CERTIFICATE_SIZE = 10 * 1024 * 1024;
const CERTIFICATE_BUCKET = 'client-files';

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
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
  if (!fullName) {
    return {
      firstName: null,
      lastName: null,
    };
  }

  const parts = fullName.split(/\s+/).filter(Boolean);

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
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
  const fileName = file.name.toLowerCase();

  return (
    allowedTypes.includes(file.type) ||
    allowedExtensions.some((extension) => fileName.endsWith(extension))
  );
}

function buildAddressText(street: string | null, streetNumber: string | null) {
  return [street, streetNumber].filter(Boolean).join(' ').trim() || null;
}

function buildBillingAddress({
  street,
  streetNumber,
  city,
  state,
  zipCode,
  country,
}: {
  street: string | null;
  streetNumber: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
}) {
  return [
    [street, streetNumber].filter(Boolean).join(' ').trim(),
    [zipCode, city].filter(Boolean).join(' ').trim(),
    state,
    country,
  ]
    .filter(Boolean)
    .join(', ');
}

function decodeJwtPayload(token: string) {
  try {
    const parts = token.split('.');

    if (parts.length < 2) {
      return null;
    }

    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const paddedPayload =
      payload + '='.repeat((4 - (payload.length % 4)) % 4);

    const decoded =
      typeof atob === 'function'
        ? atob(paddedPayload)
        : Buffer.from(paddedPayload, 'base64').toString('utf8');

    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function assertServerKeyLooksSafe(serviceRoleKey: string) {
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing.');
  }

  if (
    serviceRoleKey.startsWith('sb_publishable_') ||
    serviceRoleKey.includes('anon')
  ) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not a server service-role key. It looks like a publishable or anon key.'
    );
  }

  if (serviceRoleKey.startsWith('eyJ')) {
    const payload = decodeJwtPayload(serviceRoleKey);
    const role = String(payload?.role || '').toLowerCase();

    if (role && role !== 'service_role') {
      throw new Error(
        `SUPABASE_SERVICE_ROLE_KEY has wrong JWT role: ${role}. Expected service_role.`
      );
    }
  }
}

function getEnvValue(locals: any, key: string) {
  const runtimeEnv = locals?.runtime?.env;
  const processEnv = (globalThis as any)?.process?.env;

  return (
    runtimeEnv?.[key] ||
    import.meta.env?.[key] ||
    processEnv?.[key] ||
    ''
  );
}

async function getServerSupabase(locals: any) {
  const supabaseUrl =
    getEnvValue(locals, 'SUPABASE_URL') ||
    getEnvValue(locals, 'PUBLIC_SUPABASE_URL');

  const serviceRoleKey = getEnvValue(locals, 'SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL or PUBLIC_SUPABASE_URL is missing.');
  }

  assertServerKeyLooksSafe(serviceRoleKey);

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'X-OPC-Admin-Route': 'create-client',
      },
    },
  });
}

async function getAuthenticatedUser(request: Request, cookies: any, supabase: any) {
  const cookieToken = cookies.get('sb-access-token')?.value || '';
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.replace('Bearer ', '').trim()
    : '';

  const allCandidates: ProfileSource[] = [
    { source: 'bearer', token: String(bearerToken || '') },
    { source: 'cookie', token: String(cookieToken || '') },
  ];

  const candidates: ProfileSource[] = allCandidates.filter((item) => Boolean(item.token));

  if (candidates.length === 0) {
    throw new Error('Not authenticated');
  }

  const errors: Array<{ source: string; message: string }> = [];

  for (const candidate of candidates) {
    const result = await supabase.auth.getUser(candidate.token);

    const user = result?.data?.user || null;
    const error = result?.error || null;

    if (!error && user) {
      return user;
    }

    errors.push({
      source: candidate.source,
      message: error?.message || 'No user returned',
    });
  }

  console.error('[opc/create-client] Authentication failed:', errors);

  throw new Error('Invalid authentication');
}
async function assertCanCreateClients(supabase: any, userId: string) {
  const { data: staffRole, error } = await supabase
    .from('opc_staff_roles')
    .select('id, role, status, can_access_portal, can_manage_clients')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('can_access_portal', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Role lookup failed: ${error.message}`);
  }

  const role = String(staffRole?.role || '').toLowerCase();

  if (!staffRole || !['owner', 'admin', 'dispatch'].includes(role)) {
    return false;
  }

  return true;
}

async function findOrCreateContact({
  supabase,
  companyName,
  fullName,
  email,
  phone,
  preferredContact,
  internalNotes,
  website,
  industry,
  taxId,
  createdBy,
}: {
  supabase: any;
  companyName: string;
  fullName: string;
  email: string;
  phone: string | null;
  preferredContact: string;
  internalNotes: string | null;
  website: string | null;
  industry: string | null;
  taxId: string | null;
  createdBy: string;
}) {
  const { firstName, lastName } = splitName(fullName);

  let existingContact: any = null;

  if (email) {
    const { data, error } = await supabase
      .from('opc_contacts')
      .select('*')
      .eq('email', email)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Contact lookup failed: ${error.message}`);
    }

    existingContact = data;
  }

  if (!existingContact && phone) {
    const { data, error } = await supabase
      .from('opc_contacts')
      .select('*')
      .or(`phone_raw.eq.${phone},phone_e164.eq.${phone}`)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Contact phone lookup failed: ${error.message}`);
    }

    existingContact = data;
  }

  const contactPayload = {
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    company_name: companyName,
    email,
    phone_raw: phone,
    phone_e164: phone,
    preferred_language: 'de',
    lifecycle_stage: 'client',
    source_first: existingContact?.source_first || 'manual_client_create',
    source_last: 'manual_client_create',
    notes: internalNotes,
    metadata: {
      ...(existingContact?.metadata || {}),
      website,
      industry,
      tax_id: taxId,
      preferred_contact: preferredContact,
      last_created_from: 'kunde-anlegen',
      last_created_by: createdBy,
    },
    updated_at: new Date().toISOString(),
  };

  if (existingContact) {
    const { data: updatedContact, error } = await supabase
      .from('opc_contacts')
      .update(contactPayload)
      .eq('id', existingContact.id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Contact update failed: ${error.message}`);
    }

    return updatedContact;
  }

  const { data: newContact, error } = await supabase
    .from('opc_contacts')
    .insert(contactPayload)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Contact creation failed: ${error.message}`);
  }

  return newContact;
}

async function uploadBusinessCertificate({
  supabase,
  clientId,
  certificate,
}: {
  supabase: any;
  clientId: string;
  certificate: File | null;
}) {
  if (!certificate || !certificate.name || certificate.size === 0) {
    return null;
  }

  if (certificate.size > MAX_CERTIFICATE_SIZE) {
    throw new Error('Business certificate is larger than 10MB.');
  }

  if (!isAllowedCertificateType(certificate)) {
    throw new Error('Business certificate must be PDF, JPG or PNG.');
  }

  const safeName = sanitizeFileName(certificate.name);
  const path = `opc-clients/${clientId}/business-certificate/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(CERTIFICATE_BUCKET)
    .upload(path, certificate, {
      contentType: certificate.type || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  return {
    bucket: CERTIFICATE_BUCKET,
    path,
    filename: certificate.name,
    size: certificate.size,
    type: certificate.type || null,
    uploaded_at: new Date().toISOString(),
  };
}

async function createClientRecord({
  supabase,
  form,
  createdBy,
}: {
  supabase: any;
  form: FormData;
  createdBy: string;
}) {
  const companyName = clean(form.get('companyName'));
  const fullName = clean(form.get('fullName'));
  const email = normalizeEmail(form.get('email'));
  const phone = clean(form.get('phone'));
  const website = clean(form.get('website'));
  const industry = clean(form.get('industry'));
  const taxId = clean(form.get('taxId'));
  const preferredContact = clean(form.get('preferredContact')) || 'email';
  const clientType = clean(form.get('clientType')) || 'geschaeftskunden';

  const billingStreet = clean(form.get('billingStreet')) || clean(form.get('street'));
  const billingStreetNumber =
    clean(form.get('billingStreetNumber')) || clean(form.get('streetNumber'));
  const billingCity = clean(form.get('billingCity')) || clean(form.get('city'));
  const billingState = clean(form.get('billingState')) || clean(form.get('state'));
  const billingZipCode = clean(form.get('billingZipCode')) || clean(form.get('zipCode'));
  const billingCountry = clean(form.get('billingCountry')) || clean(form.get('country')) || 'Schweiz';

  const siteStreet = clean(form.get('siteStreet')) || clean(form.get('street'));
  const siteStreetNumber =
    clean(form.get('siteStreetNumber')) || clean(form.get('streetNumber'));
  const siteCity = clean(form.get('siteCity')) || clean(form.get('city'));
  const siteState = clean(form.get('siteState')) || clean(form.get('state'));
  const siteZipCode = clean(form.get('siteZipCode')) || clean(form.get('zipCode'));
  const siteCountry = clean(form.get('siteCountry')) || clean(form.get('country')) || 'Schweiz';

  const internalNotes = clean(form.get('internalNotes'));
  const certificate = form.get('businessCertificate') as File | null;

  if (!companyName) {
    return jsonResponse({ success: false, error: 'Company name is required.' }, 400);
  }

  if (!fullName) {
    return jsonResponse({ success: false, error: 'Contact person is required.' }, 400);
  }

  if (!email) {
    return jsonResponse({ success: false, error: 'Email address is required.' }, 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return jsonResponse({ success: false, error: 'Invalid email address.' }, 400);
  }

  const siteAddressText = buildAddressText(siteStreet, siteStreetNumber);

  const billingAddress = buildBillingAddress({
    street: billingStreet,
    streetNumber: billingStreetNumber,
    city: billingCity,
    state: billingState,
    zipCode: billingZipCode,
    country: billingCountry,
  });

  const contact = await findOrCreateContact({
    supabase,
    companyName,
    fullName,
    email,
    phone,
    preferredContact,
    internalNotes,
    website,
    industry,
    taxId,
    createdBy,
  });

  const { data: client, error: clientError } = await supabase
    .from('opc_clients')
    .insert({
      contact_id: contact.id,
      client_type: clientType,
      status: 'active',
      billing_name: companyName,
      billing_email: email,
      billing_phone_e164: phone,
      billing_address: billingAddress || null,
      internal_notes: internalNotes,
      metadata: {
        website,
        industry,
        tax_id: taxId,
        preferred_contact: preferredContact,
        created_from: 'kunde-anlegen',
        created_by: createdBy,
        billing_address_parts: {
          street: billingStreet,
          street_number: billingStreetNumber,
          city: billingCity,
          state: billingState,
          zip_code: billingZipCode,
          country: billingCountry,
        },
        portal_access_created: false,
      },
    })
    .select('*')
    .single();

  if (clientError) {
    throw new Error(`Client creation failed: ${clientError.message}`);
  }

  const { data: site, error: siteError } = await supabase
    .from('opc_client_sites')
    .insert({
      client_id: client.id,
      contact_id: contact.id,
      site_name: companyName,
      site_type: 'other',
      status: 'active',
      address_text: siteAddressText,
      postal_code: siteZipCode,
      city: siteCity,
      country: siteCountry,
      is_primary: true,
      metadata: {
        state: siteState,
        street: siteStreet,
        street_number: siteStreetNumber,
        created_from: 'kunde-anlegen',
      },
    })
    .select('*')
    .single();

  if (siteError) {
    throw new Error(`Client site creation failed: ${siteError.message}`);
  }

  const { error: linkError } = await supabase
    .from('opc_client_contact_links')
    .insert({
      client_id: client.id,
      contact_id: contact.id,
      role_label: 'Hauptkontakt',
      is_primary: true,
      receives_reports: true,
      receives_invoices: true,
      receives_operations_updates: true,
      metadata: {
        preferred_contact: preferredContact,
        created_from: 'kunde-anlegen',
      },
    });

  if (linkError) {
    throw new Error(`Client contact link creation failed: ${linkError.message}`);
  }

  let certificateMeta: Record<string, unknown> | null = null;
  let certificateUploadWarning: string | null = null;

  try {
    certificateMeta = await uploadBusinessCertificate({
      supabase,
      clientId: client.id,
      certificate,
    });
  } catch (uploadError: any) {
    certificateUploadWarning =
      uploadError?.message || 'Business certificate could not be uploaded.';
  }

  if (certificateMeta) {
    const { error: metadataUpdateError } = await supabase
      .from('opc_clients')
      .update({
        metadata: {
          ...(client.metadata || {}),
          business_certificate: certificateMeta,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', client.id);

    if (metadataUpdateError) {
      certificateUploadWarning = metadataUpdateError.message;
    }
  }

  const { error: activityError } = await supabase
    .from('opc_client_activity')
    .insert({
      client_id: client.id,
      contact_id: contact.id,
      activity_type: 'client_created',
      message: `Kunde wurde manuell angelegt: ${companyName}`,
      created_by: createdBy,
      metadata: {
        source: 'kunde-anlegen',
        site_id: site.id,
        certificate_uploaded: Boolean(certificateMeta),
        certificate_warning: certificateUploadWarning,
      },
    });

  if (activityError) {
    console.warn('[opc/create-client] Activity creation failed:', activityError.message);
  }

  return jsonResponse({
    success: true,
    clientId: client.id,
    contactId: contact.id,
    siteId: site.id,
    certificate: certificateMeta,
    certificateWarning: certificateUploadWarning,
    message: 'Client created successfully.',
  });
}

export const GET: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const supabase = await getServerSupabase(locals);
    const user = await getAuthenticatedUser(request, cookies, supabase);
    const canCreate = await assertCanCreateClients(supabase, user.id);

    if (!canCreate) {
      return jsonResponse({ success: false, error: 'Insufficient permissions.' }, 403);
    }

    const { data: clients, error: clientsError } = await supabase
      .from('opc_clients')
      .select(
        'id, contact_id, client_type, status, billing_name, billing_email, billing_phone_e164, created_at, metadata'
      )
      .order('created_at', { ascending: false })
      .limit(10);

    if (clientsError) {
      throw new Error(clientsError.message);
    }

    const contactIds = [
      ...new Set((clients || []).map((client: any) => client.contact_id).filter(Boolean)),
    ];

    let contactsById = new Map<string, any>();

    if (contactIds.length > 0) {
      const { data: contacts, error: contactsError } = await supabase
        .from('opc_contacts')
        .select('id, full_name, company_name, email, phone_raw, phone_e164')
        .in('id', contactIds);

      if (contactsError) {
        throw new Error(contactsError.message);
      }

      contactsById = new Map((contacts || []).map((contact: any) => [contact.id, contact]));
    }

    const mappedClients = (clients || []).map((client: any) => {
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
    });

    return jsonResponse({
      success: true,
      clients: mappedClients,
    });
  } catch (error: any) {
    console.error('[opc/create-client] GET failed:', error);

    const status =
      error?.message === 'Not authenticated' ||
      error?.message === 'Invalid authentication'
        ? 401
        : 500;

    return jsonResponse(
      {
        success: false,
        error: error?.message || 'Clients could not be loaded.',
      },
      status
    );
  }
};

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const supabase = await getServerSupabase(locals);
    const user = await getAuthenticatedUser(request, cookies, supabase);
    const canCreate = await assertCanCreateClients(supabase, user.id);

    if (!canCreate) {
      return jsonResponse({ success: false, error: 'Insufficient permissions.' }, 403);
    }

    const form = await request.formData();

    return await createClientRecord({
      supabase,
      form,
      createdBy: user.id,
    });
  } catch (error: any) {
    console.error('[opc/create-client] POST failed:', error);

    const status =
      error?.message === 'Not authenticated' ||
      error?.message === 'Invalid authentication'
        ? 401
        : 500;

    return jsonResponse(
      {
        success: false,
        error: error?.message || 'Client could not be created.',
      },
      status
    );
  }
};