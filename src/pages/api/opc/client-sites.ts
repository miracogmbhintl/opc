import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { getOpcServerEnvValue } from '../../../lib/opc-server-env';

export const prerender = false;

type CreateClientSiteBody = {
  client_id?: string;
  contact_id?: string | null;
  site_name?: string;
  address_text?: string;
  postal_code?: string;
  city?: string;
  country?: string;
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeAddressPart(value: unknown) {
  return clean(value)
    .toLocaleLowerCase('de-CH')
    .replace(/[.,;:/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addressKey(value: {
  address_text?: unknown;
  postal_code?: unknown;
  city?: unknown;
  country?: unknown;
}) {
  return [
    normalizeAddressPart(value.address_text),
    normalizeAddressPart(value.postal_code),
    normalizeAddressPart(value.city),
    normalizeAddressPart(value.country || 'Schweiz'),
  ].join('|');
}

function getServerSupabase(locals: any) {
  const supabaseUrl =
    getOpcServerEnvValue(locals, 'SUPABASE_URL') ||
    getOpcServerEnvValue(locals, 'PUBLIC_SUPABASE_URL');

  const serviceRoleKey =
    getOpcServerEnvValue(locals, 'SUPABASE_SERVICE_ROLE_KEY') ||
    getOpcServerEnvValue(locals, 'SUPABASE_SERVICE_ROLE');

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL fehlt.');
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY fehlt.');
  }

  const lowerKey = serviceRoleKey.toLowerCase();

  if (
    serviceRoleKey.startsWith('sb_publishable_') ||
    lowerKey.includes('anon')
  ) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY enthält keinen gültigen Service-Role-Key.'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'X-OPC-Route': 'client-sites',
      },
    },
  });
}

function getAccessToken(request: Request, cookies: any) {
  const authorization = request.headers.get('authorization') || '';

  if (/^Bearer\s+/i.test(authorization)) {
    return authorization.replace(/^Bearer\s+/i, '').trim();
  }

  return clean(cookies.get('sb-access-token')?.value);
}

async function assertCanManageClientSites(
  supabaseAdmin: any,
  accessToken: string
) {
  if (!accessToken) {
    throw new Error('Nicht authentifiziert.');
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !user) {
    throw new Error('Ungültige oder abgelaufene Sitzung.');
  }

  const { data: staffRole, error: roleError } = await supabaseAdmin
    .from('opc_staff_roles')
    .select(
      'id,role,status,can_access_portal,can_manage_clients'
    )
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (roleError) {
    throw new Error(`Rollenprüfung fehlgeschlagen: ${roleError.message}`);
  }

  const role = clean(staffRole?.role).toLowerCase();

  if (
    !staffRole ||
    !staffRole.can_access_portal ||
    !['owner', 'admin', 'dispatch'].includes(role)
  ) {
    throw new Error(
      'Keine Berechtigung zum Erstellen von Kundenstandorten.'
    );
  }

  return user;
}

export const POST: APIRoute = async ({
  request,
  locals,
  cookies,
}) => {
  try {
    const supabaseAdmin = getServerSupabase(locals);
    const accessToken = getAccessToken(request, cookies);

    const user = await assertCanManageClientSites(
      supabaseAdmin,
      accessToken
    );

    const body = (await request.json()) as CreateClientSiteBody;

    const clientId = clean(body.client_id);
    const contactId = clean(body.contact_id) || null;
    const siteName = clean(body.site_name) || 'Weitere Adresse';
    const addressText = clean(body.address_text);
    const postalCode = clean(body.postal_code);
    const city = clean(body.city);
    const country = clean(body.country) || 'Schweiz';

    if (!clientId) {
      return jsonResponse(
        {
          success: false,
          error: 'Kunde fehlt.',
        },
        400
      );
    }

    if (!addressText || !postalCode || !city) {
      return jsonResponse(
        {
          success: false,
          error: 'Strasse, PLZ und Ort müssen vollständig sein.',
        },
        400
      );
    }

    const { data: client, error: clientError } = await supabaseAdmin
      .from('opc_clients')
      .select('id,contact_id,billing_name,company_name')
      .eq('id', clientId)
      .maybeSingle();

    if (clientError) {
      throw new Error(
        `Kunde konnte nicht geprüft werden: ${clientError.message}`
      );
    }

    if (!client) {
      return jsonResponse(
        {
          success: false,
          error: 'Kunde wurde nicht gefunden.',
        },
        404
      );
    }

    const { data: existingSites, error: existingError } =
      await supabaseAdmin
        .from('opc_client_sites')
        .select(
          'id,client_id,contact_id,site_name,site_type,status,address_text,postal_code,city,country,is_primary,metadata'
        )
        .eq('client_id', clientId);

    if (existingError) {
      throw new Error(
        `Standorte konnten nicht geprüft werden: ${existingError.message}`
      );
    }

    const requestedKey = addressKey({
      address_text: addressText,
      postal_code: postalCode,
      city,
      country,
    });

    const duplicate = (existingSites || []).find(
      (candidate: any) =>
        addressKey(candidate) === requestedKey
    );

    if (duplicate) {
      return jsonResponse({
        success: true,
        reused: true,
        site: duplicate,
      });
    }

    const { data: site, error: insertError } = await supabaseAdmin
      .from('opc_client_sites')
      .insert({
        client_id: clientId,
        contact_id: contactId || client.contact_id || null,
        site_name: siteName,
        site_type: 'other',
        status: 'active',
        address_text: addressText,
        postal_code: postalCode,
        city,
        country,
        is_primary: false,
        metadata: {
          created_from: 'site_inspection',
          address_group: 'weitere_adressen',
          created_by: user.id,
          created_at: new Date().toISOString(),
        },
      })
      .select(
        'id,client_id,contact_id,site_name,site_type,status,address_text,postal_code,city,country,is_primary,metadata'
      )
      .single();

    if (insertError) {
      throw new Error(
        `Weitere Adresse konnte nicht gespeichert werden: ${insertError.message}`
      );
    }

    return jsonResponse(
      {
        success: true,
        reused: false,
        site,
      },
      201
    );
  } catch (error: any) {
    const message =
      error?.message || 'Weitere Adresse konnte nicht gespeichert werden.';

    const status =
      message.includes('authentifiziert') ||
      message.includes('Sitzung')
        ? 401
        : message.includes('Berechtigung')
          ? 403
          : 500;

    return jsonResponse(
      {
        success: false,
        error: message,
      },
      status
    );
  }
};
