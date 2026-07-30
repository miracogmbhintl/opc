import type { APIRoute } from 'astro';
import {
  authenticateOpcClientPortalRequest,
  opcClientPortalJson,
} from '../../../../lib/opc-client-portal-server';

export const prerender = false;

type AnyRow = Record<string, any>;

function clean(value: unknown, max = 1000) {
  return String(value ?? '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, max);
}

function normalize(value: unknown) {
  return clean(value, 1000)
    .toLocaleLowerCase('de-CH')
    .replace(/[.,;:/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addressKey(row: AnyRow) {
  return [
    normalize(row.address_text),
    normalize(row.postal_code),
    normalize(row.city),
    normalize(row.country || 'Schweiz'),
  ].join('|');
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const authenticated = await authenticateOpcClientPortalRequest(request, locals);
    if ('error' in authenticated) {
      return opcClientPortalJson({ ok: false, error: authenticated.error }, authenticated.status);
    }

    const body = (await request.json().catch(() => ({}))) as AnyRow;
    const siteName = clean(body.site_name, 180) || 'Weiterer Standort';
    const addressText = clean(body.address_text, 500);
    const postalCode = clean(body.postal_code, 40);
    const city = clean(body.city, 120);
    const country = clean(body.country, 120) || 'Schweiz';
    const siteType = clean(body.site_type, 80) || 'other';

    if (!addressText || !postalCode || !city) {
      return opcClientPortalJson({ ok: false, error: 'Strasse, PLZ und Ort müssen vollständig sein.' }, 400);
    }

    const existingResult = await authenticated.serviceClient
      .from('opc_client_sites')
      .select('*')
      .eq('client_id', authenticated.access.clientId);

    if (existingResult.error) {
      throw new Error(`Standorte konnten nicht geprüft werden: ${existingResult.error.message}`);
    }

    const requestedKey = addressKey({ address_text: addressText, postal_code: postalCode, city, country });
    const duplicate = (existingResult.data || []).find((row: AnyRow) => addressKey(row) === requestedKey);
    if (duplicate) {
      return opcClientPortalJson({ ok: true, reused: true, site: duplicate, message: 'Dieser Standort ist bereits vorhanden.' });
    }

    const result = await authenticated.serviceClient
      .from('opc_client_sites')
      .insert({
        client_id: authenticated.access.clientId,
        contact_id: authenticated.access.contactId || null,
        site_name: siteName,
        site_type: siteType,
        status: 'active',
        address_text: addressText,
        postal_code: postalCode,
        city,
        country,
        is_primary: false,
        metadata: {
          created_from: 'opc_customer_portal',
          created_by_auth_user_id: authenticated.user.id,
          created_at: new Date().toISOString(),
          client_notes: clean(body.client_notes, 3000) || null,
          access_notes: clean(body.access_notes, 3000) || null,
          building_size_m2: clean(body.building_size_m2, 40) || null,
          floors: clean(body.floors, 40) || null,
        },
      })
      .select('*')
      .single();

    if (result.error) throw new Error(`Standort konnte nicht erstellt werden: ${result.error.message}`);

    return opcClientPortalJson({ ok: true, reused: false, site: result.data, message: 'Standort wurde ergänzt.' }, 201);
  } catch (error: any) {
    return opcClientPortalJson({ ok: false, error: error?.message || 'Standort konnte nicht erstellt werden.' }, 500);
  }
};