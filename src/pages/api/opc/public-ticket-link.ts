import type { APIRoute } from 'astro';
import {
  createOpcServiceClient,
  getOpcRuntimeEnv,
  getSupabaseProjectRef,
  jsonResponse,
} from '../../../lib/opc-ticket-admin';

export const prerender = false;

const QR_LINK_TABLE = 'opc_facility_public_links';
const FACILITY_TABLE = 'opc_facilities';
const SITE_TABLE = 'opc_client_sites';

function bestSiteLabel(site: Record<string, any> | null | undefined) {
  if (!site) return null;

  const title =
    site.site_name ||
    site.name ||
    site.address_text ||
    site.address ||
    site.id ||
    null;

  const address = [site.address_text, site.postal_code, site.city].filter(Boolean).join(', ');

  if (title && address && !String(title).includes(address)) {
    return `${title} · ${address}`;
  }

  return title;
}

function bestFacilityLabel(facility: Record<string, any> | null | undefined) {
  if (!facility) return null;

  const title =
    facility.name ||
    facility.label ||
    facility.area_name ||
    facility.facility_name ||
    facility.title ||
    null;

  const details = [facility.floor, facility.area_type].filter(Boolean).join(' · ');

  if (title && details) return `${title} · ${details}`;

  return title;
}

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token')?.trim();

    if (!token) {
      return jsonResponse(
        {
          ok: false,
          error: 'Token fehlt.',
        },
        400
      );
    }

    const supabase = createOpcServiceClient(locals);

    const { data: publicLink, error: publicLinkError } = await supabase
      .from(QR_LINK_TABLE)
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (publicLinkError) {
      const env = getOpcRuntimeEnv(locals);

      return jsonResponse(
        {
          ok: false,
          error: `QR-Code konnte nicht geladen werden: ${publicLinkError.message}`,
          debug: {
            table: QR_LINK_TABLE,
            supabase_project_ref: getSupabaseProjectRef(env.supabaseUrl),
            env_source_mode: env.sourceMode,
          },
        },
        500
      );
    }

    if (!publicLink || publicLink.is_active !== true) {
      return jsonResponse(
        {
          ok: false,
          error: 'Dieser QR-Code ist nicht aktiv oder wurde nicht gefunden.',
        },
        404
      );
    }

    const [facilityResult, siteResult] = await Promise.all([
      publicLink.facility_id
        ? supabase.from(FACILITY_TABLE).select('*').eq('id', publicLink.facility_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      publicLink.site_id
        ? supabase.from(SITE_TABLE).select('*').eq('id', publicLink.site_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    return jsonResponse({
      ok: true,
      token: publicLink.token,
      title: publicLink.public_title || 'Meldung erstellen',
      description:
        publicLink.public_description ||
        'Der Standort wurde automatisch erkannt. Beschreiben Sie kurz, was geprüft werden soll.',
      site_label: bestSiteLabel(siteResult.data),
      facility_label: bestFacilityLabel(facilityResult.data),
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Interner Fehler beim Laden des QR-Codes.',
      },
      500
    );
  }
};