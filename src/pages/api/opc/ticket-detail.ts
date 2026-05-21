import type { APIRoute } from 'astro';
import { createOpcServiceClient, jsonResponse } from '../../../lib/opc-ticket-admin';

export const prerender = false;

const DEFAULT_BUCKET = 'opc-ticket-media';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function pickFirst(...values: any[]) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== '') return value;
  }
  return null;
}

function normalizeSite(row: any) {
  if (!row) return null;

  return {
    id: row.id,
    client_id: row.client_id || row.customer_id || null,
    site_name: pickFirst(row.site_name, row.name, row.title, row.location_name),
    address_text: pickFirst(row.address_text, row.address, row.street, row.street_address),
    postal_code: pickFirst(row.postal_code, row.zip, row.zip_code),
    city: pickFirst(row.city, row.town),
    country: pickFirst(row.country, row.country_code),
    raw: row,
  };
}

function normalizeFacility(row: any) {
  if (!row) return null;

  return {
    id: row.id,
    site_id: row.site_id || row.client_site_id || null,
    facility_name: pickFirst(row.facility_name, row.name, row.title, row.label, row.area_name),
    floor: pickFirst(row.floor, row.level),
    area_type: pickFirst(row.area_type, row.type, row.category),
    raw: row,
  };
}

async function maybeSingleFrom(supabase: any, table: string, id: string) {
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

async function loadSite(supabase: any, siteId: string | null | undefined) {
  if (!siteId || !isUuid(siteId)) return { site: null, error: null };

  const candidates = ['opc_client_sites', 'user_client_site', 'user_client_sites'];

  for (const table of candidates) {
    const result = await maybeSingleFrom(supabase, table, siteId);
    if (result.data) return { site: normalizeSite(result.data), error: null };
  }

  return { site: null, error: 'Standort konnte nicht aus Standort-Tabellen geladen werden.' };
}

async function loadFacility(supabase: any, facilityId: string | null | undefined) {
  if (!facilityId || !isUuid(facilityId)) return { facility: null, error: null };

  const candidates = ['opc_facilities', 'user_facilities', 'opc_client_facilities'];

  for (const table of candidates) {
    const result = await maybeSingleFrom(supabase, table, facilityId);
    if (result.data) return { facility: normalizeFacility(result.data), error: null };
  }

  return { facility: null, error: 'Facility konnte nicht aus Facility-Tabellen geladen werden.' };
}

async function loadClient(supabase: any, clientId: string | null | undefined) {
  if (!clientId || !isUuid(clientId)) return { client: null, error: null };

  const candidates = ['opc_clients', 'clients', 'user_clients'];

  for (const table of candidates) {
    const { data, error } = await supabase.from(table).select('*').eq('id', clientId).maybeSingle();

    if (!error && data) {
      return {
        client: {
          id: data.id,
          name: pickFirst(data.company_name, data.name, data.client_name, data.display_name),
          raw: data,
        },
        error: null,
      };
    }
  }

  return { client: null, error: null };
}

async function loadMediaWithUrls(supabase: any, ticketId: string) {
  const { data, error } = await supabase
    .from('opc_ticket_media')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) return { media: [], error: error.message };

  const media = await Promise.all(
    (data || []).map(async (row: any) => {
      const bucketId = row.bucket_id || DEFAULT_BUCKET;
      const storagePath = row.storage_path;

      let signed_url: string | null = null;
      let public_url: string | null = null;

      if (storagePath) {
        const { data: signedData } = await supabase.storage
          .from(bucketId)
          .createSignedUrl(storagePath, 60 * 60);

        signed_url = signedData?.signedUrl || null;

        const { data: publicData } = supabase.storage.from(bucketId).getPublicUrl(storagePath);
        public_url = publicData?.publicUrl || null;
      }

      return {
        ...row,
        signed_url,
        public_url,
        display_url: signed_url || public_url,
      };
    })
  );

  return { media, error: null };
}

async function loadEvents(supabase: any, ticketId: string) {
  const { data, error } = await supabase
    .from('opc_ticket_events')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false });

  if (error) return { events: [], error: error.message };

  return { events: data || [], error: null };
}

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const url = new URL(request.url);
    const id = String(url.searchParams.get('id') || '').trim();

    if (!id || !isUuid(id)) {
      return jsonResponse({ ok: false, error: 'Ungültige Ticket-ID.' }, 400);
    }

    const supabase = createOpcServiceClient(locals);

    const { data: ticket, error: ticketError } = await supabase
      .from('opc_tickets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (ticketError) {
      return jsonResponse(
        { ok: false, error: `Ticket konnte nicht geladen werden: ${ticketError.message}` },
        500
      );
    }

    if (!ticket) {
      return jsonResponse({ ok: false, error: 'Ticket wurde nicht gefunden.' }, 404);
    }

    const [siteResult, facilityResult, clientResult, mediaResult, eventsResult] = await Promise.all([
      loadSite(supabase, ticket.site_id),
      loadFacility(supabase, ticket.facility_id),
      loadClient(supabase, ticket.client_id),
      loadMediaWithUrls(supabase, id),
      loadEvents(supabase, id),
    ]);

    const site = siteResult.site;
    const facility = facilityResult.facility;
    const client = clientResult.client;

    const enrichedTicket = {
      ...ticket,

      client_name: pickFirst(ticket.client_name, client?.name),
      site_name: pickFirst(ticket.site_name, site?.site_name),
      address_text: pickFirst(ticket.address_text, site?.address_text),
      postal_code: pickFirst(ticket.postal_code, site?.postal_code),
      city: pickFirst(ticket.city, site?.city),
      country: pickFirst(ticket.country, site?.country),

      facility_name: pickFirst(ticket.facility_name, facility?.facility_name),
      floor: pickFirst(ticket.floor, facility?.floor),
      area_type: pickFirst(ticket.area_type, facility?.area_type),

      site,
      facility,
      client,
    };

    return jsonResponse({
      ok: true,
      ticket: enrichedTicket,
      media: mediaResult.media,
      events: eventsResult.events,
      warnings: {
        site_error: siteResult.error,
        facility_error: facilityResult.error,
        client_error: clientResult.error,
        media_error: mediaResult.error,
        events_error: eventsResult.error,
      },
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Ticket-Detail konnte nicht geladen werden.',
      },
      500
    );
  }
};
