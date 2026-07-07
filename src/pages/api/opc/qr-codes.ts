import type { APIRoute } from 'astro';
import {
  createOpcServiceClient,
  getOpcRuntimeEnv,
  getSupabaseProjectRef,
  jsonResponse,
} from '../../../lib/opc-ticket-admin';
export const prerender = false;

type AuthResult =
  | {
      user: {
        id: string;
        email?: string | null;
      };
      error: null;
      isDevFallback?: boolean;
    }
  | {
      user: null;
      error: string;
      isDevFallback?: boolean;
    };

const SITE_TABLE = 'opc_client_sites';
const FACILITY_TABLE = 'opc_facilities';
const QR_LINK_TABLE = 'opc_facility_public_links';

function parseCookies(cookieHeader: string | null) {
  const cookies: Record<string, string> = {};

  if (!cookieHeader) return cookies;

  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rawValueParts] = part.trim().split('=');
    if (!rawKey) continue;

    const rawValue = rawValueParts.join('=');

    try {
      cookies[rawKey] = decodeURIComponent(rawValue);
    } catch {
      cookies[rawKey] = rawValue;
    }
  }

  return cookies;
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization') || '';

  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

function extractTokenFromCookieValue(value: string | undefined) {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('eyJ') && trimmed.split('.').length === 3) {
    return trimmed;
  }

  if (trimmed.startsWith('base64-')) {
    try {
      const decoded = atob(trimmed.replace('base64-', ''));
      const parsed = JSON.parse(decoded);

      if (parsed?.access_token) return parsed.access_token;
      if (parsed?.currentSession?.access_token) return parsed.currentSession.access_token;
      if (parsed?.session?.access_token) return parsed.session.access_token;
    } catch {
      return null;
    }
  }

  try {
    const parsed = JSON.parse(trimmed);

    if (typeof parsed === 'string') {
      if (parsed.startsWith('eyJ') && parsed.split('.').length === 3) return parsed;
      return null;
    }

    if (Array.isArray(parsed)) {
      const possibleToken = parsed.find(
        (entry) =>
          typeof entry === 'string' &&
          entry.startsWith('eyJ') &&
          entry.split('.').length === 3
      );

      if (possibleToken) return possibleToken;
    }

    if (parsed?.access_token) return parsed.access_token;
    if (parsed?.currentSession?.access_token) return parsed.currentSession.access_token;
    if (parsed?.session?.access_token) return parsed.session.access_token;
  } catch {
    return null;
  }

  return null;
}

function getAccessTokenFromRequest(request: Request) {
  const bearer = getBearerToken(request);
  if (bearer) return bearer;

  const cookies = parseCookies(request.headers.get('cookie'));

  const directCookieNames = [
    'sb-access-token',
    'access_token',
    'supabase-access-token',
    'opc_auth_token',
    'mco_auth_token',
  ];

  for (const name of directCookieNames) {
    const token = extractTokenFromCookieValue(cookies[name]);
    if (token) return token;
  }

  for (const [cookieName, cookieValue] of Object.entries(cookies)) {
    const lowerName = cookieName.toLowerCase();

    if (
      lowerName.startsWith('sb-') ||
      lowerName.includes('supabase') ||
      lowerName.includes('auth') ||
      lowerName.includes('token')
    ) {
      const token = extractTokenFromCookieValue(cookieValue);
      if (token) return token;
    }
  }

  return null;
}

async function requireUser(request: Request, locals: unknown): Promise<AuthResult> {
  const token = getAccessTokenFromRequest(request);

  if (!token) {
    if (import.meta.env.DEV) {
      return {
        user: {
          id: '00000000-0000-0000-0000-000000000000',
          email: 'dev@orangeproclean.local',
        },
        error: null,
        isDevFallback: true,
      };
    }

    return {
      user: null,
      error: 'Nicht angemeldet.',
    };
  }

  const supabase = createOpcServiceClient(locals);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    if (import.meta.env.DEV) {
      return {
        user: {
          id: '00000000-0000-0000-0000-000000000000',
          email: 'dev@orangeproclean.local',
        },
        error: null,
        isDevFallback: true,
      };
    }

    return {
      user: null,
      error: 'Ungültige Anmeldung.',
    };
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email,
    },
    error: null,
  };
}

function cleanString(value: unknown, maxLength = 500) {
  if (typeof value !== 'string') return null;

  const cleaned = value
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return null;

  return cleaned.slice(0, maxLength);
}

function generatePublicToken() {
  return `opf_${crypto.randomUUID().replace(/-/g, '').slice(0, 24).toUpperCase()}`;
}

function bestSiteLabel(site: Record<string, any> | null | undefined) {
  if (!site) return 'Unbekannter Standort';

  const title =
    site.site_name ||
    site.name ||
    site.location_name ||
    site.title ||
    site.address_text ||
    site.address ||
    site.full_address ||
    site.id ||
    'Unbekannter Standort';

  const address = [site.address_text, site.postal_code, site.city].filter(Boolean).join(', ');

  if (address && !String(title).includes(address)) {
    return `${title} · ${address}`;
  }

  return String(title);
}

function bestClientLabelFromSite(site: Record<string, any> | null | undefined) {
  if (!site) return 'Unbekannter Kunde';

  return String(
    site.client_name ||
      site.company_name ||
      site.customer_name ||
      site.business_name ||
      site.site_name ||
      site.name ||
      site.address_text ||
      site.client_id ||
      'Unbekannter Kunde'
  );
}

function bestFacilityLabel(facility: Record<string, any> | null | undefined) {
  if (!facility) return 'Unbekannte Facility';

  const title =
    facility.name ||
    facility.label ||
    facility.area_name ||
    facility.facility_name ||
    facility.title ||
    facility.id ||
    'Unbekannte Facility';

  const details = [facility.floor, facility.area_type].filter(Boolean).join(' · ');

  if (details) return `${title} · ${details}`;

  return String(title);
}

async function loadOptionalTable(supabase: any, table: string) {
  try {
    const { data, error } = await supabase.from(table).select('*').limit(1000);

    if (error) {
      return {
        data: [],
        warning: `${table}: ${error.message}`,
      };
    }

    return {
      data: data || [],
      warning: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';

    return {
      data: [],
      warning: `${table}: ${message}`,
    };
  }
}

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const auth = await requireUser(request, locals);

    if (!auth.user) {
      return jsonResponse(
        {
          ok: false,
          error: auth.error,
        },
        401
      );
    }

    const supabase = createOpcServiceClient(locals);

    const { data: sitesRaw, error: sitesError } = await supabase
      .from(SITE_TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (sitesError) {
      return jsonResponse(
        {
          ok: false,
          error: `Standorte konnten nicht geladen werden: ${sitesError.message}`,
          debug: {
            site_table: SITE_TABLE,
            hint: 'Die API nutzt jetzt ausschliesslich opc_client_sites.',
          },
        },
        500
      );
    }

    const sites = sitesRaw || [];

    const [linksResult, facilitiesResult] = await Promise.all([
      loadOptionalTable(supabase, QR_LINK_TABLE),
      loadOptionalTable(supabase, FACILITY_TABLE),
    ]);

    const warnings = [linksResult.warning, facilitiesResult.warning].filter(Boolean);

    const facilities = facilitiesResult.data || [];
    const rawLinks = linksResult.data || [];

    const facilityMap = new Map(facilities.map((item: any) => [item.id, item]));
    const siteMap = new Map(sites.map((site: any) => [String(site.id), site]));

    const links = rawLinks
      .map((link: any) => {
        const facility = facilityMap.get(link.facility_id);
        const site = siteMap.get(String(link.site_id));

        return {
          id: link.id,
          token: link.token,
          label: link.label,
          public_title: link.public_title,
          public_description: link.public_description,
          is_active: link.is_active,
          use_count: link.use_count || 0,
          last_used_at: link.last_used_at,
          created_at: link.created_at,
          updated_at: link.updated_at,

          client_id: link.client_id,
          site_id: link.site_id,
          facility_id: link.facility_id,

          client_label: bestClientLabelFromSite(site),
          site_label: bestSiteLabel(site),
          facility_label: bestFacilityLabel(facility),

          report_path: `/report/${link.token}`,
        };
      })
      .sort((a: any, b: any) => {
        return String(b.created_at || '').localeCompare(String(a.created_at || ''));
      });

    const siteOptions = sites
      .filter((site: any) => site?.id)
      .map((site: any) => ({
        id: String(site.id),
        client_id: site.client_id ? String(site.client_id) : null,
        label: bestSiteLabel(site),
        raw: site,
      }))
      .sort((a: any, b: any) => String(a.label).localeCompare(String(b.label), 'de'));

    const facilityOptions = facilities
      .filter((facility: any) => facility?.id)
      .map((facility: any) => ({
        id: String(facility.id),
        client_id: facility.client_id ? String(facility.client_id) : null,
        site_id: String(facility.site_id),
        label: bestFacilityLabel(facility),
        raw: facility,
      }))
      .sort((a: any, b: any) => String(a.label).localeCompare(String(b.label), 'de'));

    return jsonResponse({
      ok: true,
      siteTableName: SITE_TABLE,
      devFallbackAuth: Boolean(auth.isDevFallback),
      warnings,
      links,
      sites: siteOptions,
      facilities: facilityOptions,
      debug: {
        site_table: SITE_TABLE,
        sites_count: siteOptions.length,
        facilities_count: facilityOptions.length,
        links_count: links.length,
        first_site: siteOptions[0] || null,
      },
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Interner Fehler beim Laden der QR-Codes.',
      },
      500
    );
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const auth = await requireUser(request, locals);

    if (!auth.user) {
      return jsonResponse(
        {
          ok: false,
          error: auth.error,
        },
        401
      );
    }

    const body = await request.json();

    const siteId = cleanString(body.site_id, 100);
    const clientIdFromBody = cleanString(body.client_id, 100);

    const existingFacilityId = cleanString(body.facility_id, 100);
    const facilityName = cleanString(body.facility_name, 180);

    const floor = cleanString(body.floor, 80);
    const areaType = cleanString(body.area_type, 120);

    const label = cleanString(body.label, 180);
    const publicTitle = cleanString(body.public_title, 180);
    const publicDescription = cleanString(body.public_description, 500);

    if (!siteId) {
      return jsonResponse(
        {
          ok: false,
          error: 'Bitte Standort auswählen.',
        },
        400
      );
    }

    if (!existingFacilityId && !facilityName) {
      return jsonResponse(
        {
          ok: false,
          error: 'Bitte Facility / Bereich eintragen.',
        },
        400
      );
    }

    const supabase = createOpcServiceClient(locals);

    const { data: site, error: siteError } = await supabase
      .from(SITE_TABLE)
      .select('*')
      .eq('id', siteId)
      .maybeSingle();

if (siteError) {
  const env = getOpcRuntimeEnv(locals);

  return jsonResponse(
    {
      ok: false,
      error: `Standort konnte nicht geladen werden: ${siteError.message}`,
      debug: {
        site_table: SITE_TABLE,
        supabase_project_ref: env.supabaseUrl
          ? getSupabaseProjectRef(env.supabaseUrl)
          : 'supabaseUrl not defined',
        env_source_mode: env.sourceMode,
        // If this Project Ref does not match the Supabase project where opc_client_sites exists, Astro is reading the wrong ENV values.
        hint:
          'Wenn diese Project Ref nicht dem Supabase-Projekt entspricht, in dem opc_client_sites existiert, liest Astro die falschen ENV-Werte.',
      },
    },
    500
  );
}

    if (!site) {
      return jsonResponse(
        {
          ok: false,
          error: 'Standort wurde nicht gefunden.',
        },
        404
      );
    }

    const inferredClientId = clientIdFromBody || site.client_id || null;
    let facilityId = existingFacilityId;

    if (facilityId) {
      const { data: existingFacility, error: existingFacilityError } = await supabase
        .from(FACILITY_TABLE)
        .select('*')
        .eq('id', facilityId)
        .maybeSingle();

      if (existingFacilityError) {
        return jsonResponse(
          {
            ok: false,
            error: `Facility konnte nicht geprüft werden: ${existingFacilityError.message}`,
          },
          500
        );
      }

      if (!existingFacility) {
        return jsonResponse(
          {
            ok: false,
            error: 'Bestehende Facility wurde nicht gefunden.',
          },
          404
        );
      }
    }

    if (!facilityId) {
      const fallbackFacilityName =
        facilityName || label || site.site_name || site.address_text || 'Facility';

      const { data: facility, error: facilityError } = await supabase
        .from(FACILITY_TABLE)
        .insert({
          client_id: inferredClientId,
          site_id: site.id,
          name: fallbackFacilityName,
          floor,
          area_type: areaType,
          is_active: true,
          metadata: {
            created_from: 'qr_code_overview',
            source: 'portal',
            source_site_table: SITE_TABLE,
          },
        })
        .select('*')
        .single();

      if (facilityError || !facility) {
        return jsonResponse(
          {
            ok: false,
            error: `Facility konnte nicht erstellt werden: ${
              facilityError?.message || 'Unbekannter Datenbankfehler'
            }`,
          },
          500
        );
      }

      facilityId = facility.id;
    }

    const token = generatePublicToken();

    const { data: publicLink, error: publicLinkError } = await supabase
      .from(QR_LINK_TABLE)
      .insert({
        token,
        client_id: inferredClientId,
        site_id: site.id,
        facility_id: facilityId,
        label: label || facilityName || site.site_name || 'QR-Code',
        public_title: publicTitle || 'Meldung erstellen',
        public_description:
          publicDescription ||
          'Der Standort wurde automatisch erkannt. Beschreiben Sie kurz, was geprüft werden soll.',
        is_active: true,
        created_by: auth.isDevFallback ? null : auth.user.id,
        metadata: {
          created_from: 'qr_code_overview',
          source: 'portal',
          source_site_table: SITE_TABLE,
        },
      })
      .select('*')
      .single();

    if (publicLinkError || !publicLink) {
      return jsonResponse(
        {
          ok: false,
          error: `QR-Code-Link konnte nicht erstellt werden: ${
            publicLinkError?.message || 'Unbekannter Datenbankfehler'
          }`,
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      siteTableName: SITE_TABLE,
      link: {
        id: publicLink.id,
        token: publicLink.token,
        report_path: `/report/${publicLink.token}`,
      },
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Interner Fehler beim Erstellen des QR-Codes.',
      },
      500
    );
  }
};