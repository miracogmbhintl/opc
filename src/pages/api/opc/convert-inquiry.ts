import type { APIContext } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

type ConversionMode = 'private' | 'corporate';

interface ConvertInquiryPayload {
  inquiryId?: string | null;
  onboardingCaseId?: string | null;
  contactId?: string | null;
  conversionMode: ConversionMode;
  billingName: string;
  fullName?: string;
  companyName?: string;
  email?: string;
  phoneRaw?: string;
  phoneE164?: string;
  addressText?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  siteName?: string;
  internalNotes?: string;
  allowDuplicate?: boolean;
}

const supabaseUrl =
  import.meta.env.SUPABASE_URL ||
  import.meta.env.PUBLIC_SUPABASE_URL ||
  import.meta.env.PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY ||
  import.meta.env.SUPABASE_SERVICE_ROLE ||
  import.meta.env.SUPABASE_SERVICE_KEY;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function clean(value?: string | null) {
  const text = String(value || '').trim();
  return text || null;
}

function parseAddressParts(address?: string | null, postalCode?: string | null, city?: string | null) {
  const rawAddress = clean(address);
  const rawPostal = clean(postalCode);
  const rawCity = clean(city);

  if (!rawAddress) {
    return {
      addressText: null,
      postalCode: rawPostal,
      city: rawCity,
    };
  }

  const match = rawAddress.match(/^(.*?)[,\s]+(\d{4})[,\s]+(.+)$/);

  if (!match) {
    return {
      addressText: rawAddress,
      postalCode: rawPostal,
      city: rawCity,
    };
  }

  return {
    addressText: clean(match[1]),
    postalCode: rawPostal || clean(match[2]),
    city: rawCity || clean(match[3]),
  };
}

function buildBillingAddress(addressText?: string | null, postalCode?: string | null, city?: string | null) {
  const street = clean(addressText);
  const postal = clean(postalCode);
  const town = clean(city);

  if (!street && !postal && !town) return null;

  const cityLine = [postal, town].filter(Boolean).join(' ');

  return [street, cityLine].filter(Boolean).join(', ');
}

function isUuid(value?: string | null) {
  if (!value) return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function splitName(fullName?: string | null) {
  const cleaned = clean(fullName);

  if (!cleaned) {
    return {
      firstName: null,
      lastName: null,
    };
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] || null,
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
  };
}

async function findExistingClientByContact(contactId: string) {
  const { data, error } = await supabaseAdmin
    .from('opc_clients')
    .select('id, contact_id, billing_name, client_type, status')
    .eq('contact_id', contactId)
    .maybeSingle();

  if (error) {
    throw new Error(`Duplicate check failed: ${error.message}`);
  }

  return data || null;
}

async function findDuplicateClient(payload: ConvertInquiryPayload) {
  const email = clean(payload.email);
  const phone = clean(payload.phoneE164) || clean(payload.phoneRaw);

  const matchingContacts: any[] = [];

  if (email) {
    const { data, error } = await supabaseAdmin
      .from('opc_contacts')
      .select('id, full_name, company_name, email, phone_raw, phone_e164')
      .ilike('email', email);

    if (error) {
      throw new Error(`Email duplicate check failed: ${error.message}`);
    }

    matchingContacts.push(...(data || []));
  }

  if (phone) {
    const { data: phoneE164Matches, error: phoneE164Error } = await supabaseAdmin
      .from('opc_contacts')
      .select('id, full_name, company_name, email, phone_raw, phone_e164')
      .eq('phone_e164', phone);

    if (phoneE164Error) {
      throw new Error(`Phone duplicate check failed: ${phoneE164Error.message}`);
    }

    const { data: phoneRawMatches, error: phoneRawError } = await supabaseAdmin
      .from('opc_contacts')
      .select('id, full_name, company_name, email, phone_raw, phone_e164')
      .eq('phone_raw', phone);

    if (phoneRawError) {
      throw new Error(`Phone duplicate check failed: ${phoneRawError.message}`);
    }

    matchingContacts.push(...(phoneE164Matches || []), ...(phoneRawMatches || []));
  }

  const uniqueContacts = Array.from(
    new Map(matchingContacts.map((contact) => [contact.id, contact])).values()
  );

  if (uniqueContacts.length === 0) return null;

  const contactIds = uniqueContacts.map((contact) => contact.id);

  const { data: clients, error } = await supabaseAdmin
    .from('opc_clients')
    .select('id, contact_id, billing_name, client_type, status')
    .in('contact_id', contactIds);

  if (error) {
    throw new Error(`Client duplicate check failed: ${error.message}`);
  }

  if (!clients || clients.length === 0) return null;

  const client = clients[0];
  const contact = uniqueContacts.find((item) => item.id === client.contact_id);

  return {
    client,
    contact,
  };
}

async function createOrUpdateContact(payload: ConvertInquiryPayload, useExistingContact: boolean) {
  const fullName = clean(payload.fullName) || clean(payload.billingName) || 'Unbekannter Kontakt';
  const companyName =
    payload.conversionMode === 'corporate'
      ? clean(payload.companyName) || clean(payload.billingName)
      : clean(payload.companyName);

  const { firstName, lastName } = splitName(fullName);

  const contactPayload = {
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    company_name: companyName,
    email: clean(payload.email),
    phone_raw: clean(payload.phoneRaw) || clean(payload.phoneE164),
    phone_e164: clean(payload.phoneE164) || clean(payload.phoneRaw),
    lifecycle_stage: 'client',
  };

  if (useExistingContact && isUuid(payload.contactId)) {
    const { data, error } = await supabaseAdmin
      .from('opc_contacts')
      .update(contactPayload)
      .eq('id', payload.contactId)
      .select('id')
      .single();

    if (error) {
      throw new Error(`Contact update failed: ${error.message}`);
    }

    return data.id as string;
  }

  const { data, error } = await supabaseAdmin
    .from('opc_contacts')
    .insert(contactPayload)
    .select('id')
    .single();

  if (error) {
    throw new Error(`Contact creation failed: ${error.message}`);
  }

  const contactId = data.id as string;

  const contactMethods = [];

  if (clean(payload.email)) {
    contactMethods.push({
      contact_id: contactId,
      method_type: 'email',
      raw_value: clean(payload.email),
      normalized_value: clean(payload.email)?.toLowerCase(),
      label: 'E-Mail',
      is_primary: true,
      is_verified: false,
      source_channel: 'portal',
      metadata: {
        source: 'inquiry_conversion',
      },
    });
  }

  if (clean(payload.phoneRaw) || clean(payload.phoneE164)) {
    contactMethods.push({
      contact_id: contactId,
      method_type: 'phone',
      raw_value: clean(payload.phoneRaw) || clean(payload.phoneE164),
      normalized_value: clean(payload.phoneE164) || clean(payload.phoneRaw),
      label: 'Telefon',
      is_primary: !clean(payload.email),
      is_verified: false,
      source_channel: 'portal',
      metadata: {
        source: 'inquiry_conversion',
      },
    });
  }

  if (contactMethods.length > 0) {
    const { error: methodError } = await supabaseAdmin
      .from('opc_contact_methods')
      .insert(contactMethods);

    if (methodError) {
      console.warn('[convert-inquiry] Contact methods were not created:', methodError.message);
    }
  }

  return contactId;
}

export async function POST({ request }: APIContext) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        {
          error:
            'Supabase server configuration is missing. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
        },
        500
      );
    }

    const payload = (await request.json()) as ConvertInquiryPayload;

    if (!payload || !payload.billingName || !payload.conversionMode) {
      return jsonResponse(
        {
          error: 'Missing required fields: billingName and conversionMode.',
        },
        400
      );
    }

    const clientType =
      payload.conversionMode === 'corporate' ? 'geschaeftskunden' : 'privatkunden';

    if (payload.contactId && isUuid(payload.contactId) && !payload.allowDuplicate) {
      const existingClientForContact = await findExistingClientByContact(payload.contactId);

      if (existingClientForContact) {
        return jsonResponse(
          {
            conflict: true,
            message: 'Dieser Kontakt ist bereits mit einem Kunden verbunden.',
            client: existingClientForContact,
          },
          409
        );
      }
    }

    if (!payload.allowDuplicate) {
      const duplicate = await findDuplicateClient(payload);

      if (duplicate) {
        return jsonResponse(
          {
            conflict: true,
            message:
              'Ein Kunde mit gleicher E-Mail oder Telefonnummer existiert bereits.',
            client: duplicate.client,
            contact: duplicate.contact,
          },
          409
        );
      }
    }

    const shouldUseExistingContact = isUuid(payload.contactId) && !payload.allowDuplicate;
    const contactId = await createOrUpdateContact(payload, shouldUseExistingContact);

    const parsedAddress = parseAddressParts(
      payload.addressText,
      payload.postalCode,
      payload.city
    );

    const billingAddress = buildBillingAddress(
      parsedAddress.addressText,
      parsedAddress.postalCode,
      parsedAddress.city
    );

    const { data: client, error: clientError } = await supabaseAdmin
      .from('opc_clients')
      .insert({
        contact_id: contactId,
        client_type: clientType,
        status: 'active',
        billing_name: clean(payload.billingName),
        billing_email: clean(payload.email),
        billing_phone_e164: clean(payload.phoneE164) || clean(payload.phoneRaw),
        billing_address: billingAddress || null,
        internal_notes: clean(payload.internalNotes),
        metadata: {
          source: 'inquiry_conversion',
          conversion_mode: payload.conversionMode,
          onboarding_case_id: isUuid(payload.onboardingCaseId)
            ? payload.onboardingCaseId
            : null,
          inquiry_id: isUuid(payload.inquiryId) ? payload.inquiryId : null,
          portal_access_requested: payload.conversionMode === 'corporate',
        },
      })
      .select('id')
      .single();

    if (clientError) {
      throw new Error(`Client creation failed: ${clientError.message}`);
    }

    const clientId = client.id as string;

    const { data: site, error: siteError } = await supabaseAdmin
      .from('opc_client_sites')
      .insert({
        client_id: clientId,
        contact_id: contactId,
        site_name:
          clean(payload.siteName) ||
          clean(payload.companyName) ||
          clean(payload.billingName) ||
          'Hauptstandort',
        site_type: payload.conversionMode === 'corporate' ? 'commercial' : 'residential',
        status: 'active',
        address_text: parsedAddress.addressText,
        postal_code: parsedAddress.postalCode,
        city: parsedAddress.city,
        country: clean(payload.country) || 'CH',
        is_primary: true,
        service_requirements: {},
        metadata: {
          source: 'inquiry_conversion',
        },
      })
      .select('id')
      .single();

    if (siteError) {
      throw new Error(`Client site creation failed: ${siteError.message}`);
    }

    const { error: linkError } = await supabaseAdmin
      .from('opc_client_contact_links')
      .insert({
        client_id: clientId,
        contact_id: contactId,
        role_label:
          payload.conversionMode === 'corporate'
            ? 'Hauptkontakt'
            : 'Privatkunde',
        is_primary: true,
        receives_reports: payload.conversionMode === 'corporate',
        receives_invoices: true,
        receives_operations_updates: true,
        metadata: {
          source: 'inquiry_conversion',
        },
      });

    if (linkError) {
      throw new Error(`Client contact link creation failed: ${linkError.message}`);
    }

    let clientUserId: string | null = null;

    if (payload.conversionMode === 'corporate') {
      const { data: clientUser, error: clientUserError } = await supabaseAdmin
        .from('opc_client_users')
        .insert({
          client_id: clientId,
          contact_id: contactId,
          user_id: null,
          role: 'owner',
          status: 'invited',
          display_name: clean(payload.fullName) || clean(payload.billingName),
          email: clean(payload.email),
          phone_raw: clean(payload.phoneRaw) || clean(payload.phoneE164),
          phone_e164: clean(payload.phoneE164) || clean(payload.phoneRaw),
          can_access_client_portal: true,
          can_view_jobs: true,
          can_view_reports: true,
          can_view_media: true,
          can_view_damage_reports: true,
          can_view_invoices: true,
          can_create_requests: true,
          can_send_messages: true,
          receives_reports: true,
          receives_invoices: true,
          receives_operations_updates: true,
          metadata: {
            source: 'inquiry_conversion',
            invitation_pending: true,
          },
          invited_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (clientUserError) {
        throw new Error(`Client portal user creation failed: ${clientUserError.message}`);
      }

      clientUserId = clientUser.id as string;
    }

    if (isUuid(payload.onboardingCaseId)) {
      const { error: onboardingError } = await supabaseAdmin
        .from('opc_onboarding_cases')
        .update({
          status: 'converted',
          client_type: clientType,
          converted_client_id: clientId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.onboardingCaseId);

      if (onboardingError) {
        console.warn(
          '[convert-inquiry] Onboarding case was not updated:',
          onboardingError.message
        );
      }
    }

    const { error: activityError } = await supabaseAdmin
      .from('opc_client_activity')
      .insert({
        client_id: clientId,
        contact_id: contactId,
        onboarding_case_id: isUuid(payload.onboardingCaseId)
          ? payload.onboardingCaseId
          : null,
        inquiry_id: isUuid(payload.inquiryId) ? payload.inquiryId : null,
        activity_type: 'converted_from_inquiry',
        message:
          payload.conversionMode === 'corporate'
            ? 'Anfrage wurde als Corporate-Kunde mit Portalzugang übernommen.'
            : 'Anfrage wurde als interner Privatkunde übernommen.',
        metadata: {
          source: 'inquiry_conversion',
          conversion_mode: payload.conversionMode,
          client_type: clientType,
          client_user_id: clientUserId,
          site_id: site.id,
        },
      });

    if (activityError) {
      console.warn('[convert-inquiry] Activity was not created:', activityError.message);
    }

    return jsonResponse({
      success: true,
      clientId,
      contactId,
      siteId: site.id,
      clientUserId,
      portalAccessCreated: payload.conversionMode === 'corporate',
    });
  } catch (error: any) {
    console.error('[convert-inquiry] failed:', error);

    return jsonResponse(
      {
        error: error?.message || 'Conversion failed.',
      },
      500
    );
  }
}