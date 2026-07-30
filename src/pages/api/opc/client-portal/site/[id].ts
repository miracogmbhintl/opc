import type { APIRoute } from 'astro';
import {
  authenticateOpcClientPortalRequest,
  opcClientPortalJson,
} from '../../../../../lib/opc-client-portal-server';

export const prerender = false;

type AnyRow = Record<string, any>;

function clean(value: unknown, max = 2000) {
  return String(value ?? '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, max);
}

function objectValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as AnyRow
    : {};
}

async function loadSite(serviceClient: any, clientId: string, siteId: string) {
  const result = await serviceClient
    .from('opc_client_sites')
    .select('*')
    .eq('id', siteId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (result.error) throw new Error(`Standort konnte nicht geladen werden: ${result.error.message}`);
  return result.data || null;
}

export const GET: APIRoute = async ({ request, locals, params }) => {
  try {
    const authenticated = await authenticateOpcClientPortalRequest(request, locals);
    if ('error' in authenticated) {
      return opcClientPortalJson({ ok: false, error: authenticated.error }, authenticated.status);
    }

    const siteId = clean(params.id, 120);
    const site = await loadSite(authenticated.serviceClient, authenticated.access.clientId, siteId);
    if (!site) return opcClientPortalJson({ ok: false, error: 'Standort wurde nicht gefunden.' }, 404);

    const [jobsResult, ticketsResult] = await Promise.all([
      authenticated.serviceClient
        .from('opc_service_jobs')
        .select('*')
        .eq('client_id', authenticated.access.clientId)
        .eq('client_site_id', siteId)
        .order('planned_start', { ascending: false })
        .limit(100),
      authenticated.serviceClient
        .from('opc_tickets')
        .select('*')
        .eq('client_id', authenticated.access.clientId)
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    return opcClientPortalJson({
      ok: true,
      detail: {
        site,
        jobs: jobsResult.data || [],
        tickets: ticketsResult.data || [],
      },
    });
  } catch (error: any) {
    return opcClientPortalJson({ ok: false, error: error?.message || 'Standort konnte nicht geladen werden.' }, 500);
  }
};

export const PATCH: APIRoute = async ({ request, locals, params }) => {
  try {
    const authenticated = await authenticateOpcClientPortalRequest(request, locals);
    if ('error' in authenticated) {
      return opcClientPortalJson({ ok: false, error: authenticated.error }, authenticated.status);
    }

    const siteId = clean(params.id, 120);
    const current = await loadSite(authenticated.serviceClient, authenticated.access.clientId, siteId);
    if (!current) return opcClientPortalJson({ ok: false, error: 'Standort wurde nicht gefunden.' }, 404);

    const body = (await request.json().catch(() => ({}))) as AnyRow;
    const updates: AnyRow = { updated_at: new Date().toISOString() };

    for (const [key, max] of [
      ['site_name', 180],
      ['address_text', 500],
      ['postal_code', 40],
      ['city', 120],
      ['country', 120],
      ['site_type', 80],
    ] as Array<[string, number]>) {
      const value = clean(body[key], max);
      if (value) updates[key] = value;
    }

    const metadata = {
      ...objectValue(current.metadata),
      client_notes: clean(body.client_notes, 3000) || objectValue(current.metadata).client_notes || null,
      access_notes: clean(body.access_notes, 3000) || objectValue(current.metadata).access_notes || null,
      building_size_m2: clean(body.building_size_m2, 40) || objectValue(current.metadata).building_size_m2 || null,
      floors: clean(body.floors, 40) || objectValue(current.metadata).floors || null,
      last_client_update_at: new Date().toISOString(),
      last_client_update_by: authenticated.user.id,
    };
    updates.metadata = metadata;

    const result = await authenticated.serviceClient
      .from('opc_client_sites')
      .update(updates)
      .eq('id', siteId)
      .eq('client_id', authenticated.access.clientId)
      .select('*')
      .single();

    if (result.error) throw new Error(`Standort konnte nicht gespeichert werden: ${result.error.message}`);

    return opcClientPortalJson({ ok: true, site: result.data, message: 'Standort wurde aktualisiert.' });
  } catch (error: any) {
    return opcClientPortalJson({ ok: false, error: error?.message || 'Standort konnte nicht gespeichert werden.' }, 500);
  }
};