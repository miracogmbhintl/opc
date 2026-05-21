import type { APIRoute } from 'astro';
import { createOpcServiceClient, jsonResponse } from '../../../lib/opc-ticket-admin';

export const prerender = false;

const TICKET_TABLE = 'opc_tickets';
const SITE_TABLE = 'opc_client_sites';
const FACILITY_TABLE = 'opc_facilities';
const MEDIA_TABLE = 'opc_ticket_media';
const EVENTS_TABLE = 'opc_ticket_events';

function cleanString(value: unknown, maxLength = 1000) {
  if (typeof value !== 'string') return null;

  const cleaned = value
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

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

    if (typeof parsed === 'string' && parsed.startsWith('eyJ') && parsed.split('.').length === 3) {
      return parsed;
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
  const authHeader = request.headers.get('authorization') || '';

  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  const cookies = parseCookies(request.headers.get('cookie'));

  for (const name of [
    'sb-access-token',
    'access_token',
    'supabase-access-token',
    'opc_auth_token',
    'mco_auth_token',
  ]) {
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

async function requireUser(request: Request, locals: unknown) {
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
      isDevFallback: false,
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
      isDevFallback: false,
    };
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email,
    },
    error: null,
    isDevFallback: false,
  };
}

function bestSiteLabel(site: any) {
  if (!site) return 'Unbekannter Standort';

  const title =
    site.site_name ||
    site.name ||
    site.address_text ||
    site.address ||
    site.id ||
    'Unbekannter Standort';

  const address = [site.address_text, site.postal_code, site.city].filter(Boolean).join(', ');

  if (address && !String(title).includes(address)) {
    return `${title} · ${address}`;
  }

  return String(title);
}

function bestFacilityLabel(facility: any) {
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

function mapStatus(status: string | null | undefined) {
  if (!status) return 'new';
  if (status === 'open') return 'new';
  if (status === 'in-progress') return 'in_progress';
  return status;
}

function mapPriority(priority: string | null | undefined) {
  if (!priority) return 'normal';
  if (priority === 'medium') return 'normal';
  if (priority === 'urgent') return 'high';
  return priority;
}

async function loadTicketDetail(supabase: any, ticketId: string) {
  const { data: ticket, error: ticketError } = await supabase
    .from(TICKET_TABLE)
    .select('*')
    .eq('id', ticketId)
    .maybeSingle();

  if (ticketError) {
    throw new Error(`Ticket konnte nicht geladen werden: ${ticketError.message}`);
  }

  if (!ticket) {
    return null;
  }

  const [siteResult, facilityResult, mediaResult, eventsResult] = await Promise.all([
    ticket.site_id
      ? supabase.from(SITE_TABLE).select('*').eq('id', ticket.site_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    ticket.facility_id
      ? supabase.from(FACILITY_TABLE).select('*').eq('id', ticket.facility_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from(MEDIA_TABLE).select('*').eq('ticket_id', ticket.id).order('created_at', { ascending: true }),
    supabase.from(EVENTS_TABLE).select('*').eq('ticket_id', ticket.id).order('created_at', { ascending: false }),
  ]);

  const mediaRows = mediaResult.data || [];

  const media = await Promise.all(
    mediaRows.map(async (row: any) => {
      const bucket = row.bucket_id || 'opc-ticket-media';
      const path = row.storage_path;

      let signed_url: string | null = null;

      if (bucket && path) {
        const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
        signed_url = data?.signedUrl || null;
      }

      return {
        ...row,
        signed_url,
      };
    })
  );

  return {
    ...ticket,
    status: mapStatus(ticket.status),
    priority: mapPriority(ticket.priority),
    site: siteResult.data || null,
    facility: facilityResult.data || null,
    site_label: bestSiteLabel(siteResult.data),
    facility_label: bestFacilityLabel(facilityResult.data),
    media,
    events: eventsResult.data || [],
  };
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

    const url = new URL(request.url);
    const ticketId = url.searchParams.get('id');

    const supabase = createOpcServiceClient(locals);

    if (ticketId) {
      const ticket = await loadTicketDetail(supabase, ticketId);

      if (!ticket) {
        return jsonResponse(
          {
            ok: false,
            error: 'Ticket wurde nicht gefunden.',
          },
          404
        );
      }

      return jsonResponse({
        ok: true,
        ticket,
      });
    }

    const { data: ticketsRaw, error: ticketsError } = await supabase
      .from(TICKET_TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (ticketsError) {
      return jsonResponse(
        {
          ok: false,
          error: `Tickets konnten nicht geladen werden: ${ticketsError.message}`,
        },
        500
      );
    }

    const tickets = ticketsRaw || [];

    const siteIds = Array.from(new Set(tickets.map((t: any) => t.site_id).filter(Boolean)));
    const facilityIds = Array.from(new Set(tickets.map((t: any) => t.facility_id).filter(Boolean)));
    const ticketIds = tickets.map((t: any) => t.id).filter(Boolean);

    const [sitesResult, facilitiesResult, mediaResult] = await Promise.all([
      siteIds.length
        ? supabase.from(SITE_TABLE).select('*').in('id', siteIds)
        : Promise.resolve({ data: [], error: null }),
      facilityIds.length
        ? supabase.from(FACILITY_TABLE).select('*').in('id', facilityIds)
        : Promise.resolve({ data: [], error: null }),
      ticketIds.length
        ? supabase.from(MEDIA_TABLE).select('id,ticket_id').in('ticket_id', ticketIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const siteMap = new Map((sitesResult.data || []).map((site: any) => [site.id, site]));
    const facilityMap = new Map((facilitiesResult.data || []).map((facility: any) => [facility.id, facility]));

    const mediaCountMap = new Map<string, number>();
    for (const media of mediaResult.data || []) {
      mediaCountMap.set(media.ticket_id, (mediaCountMap.get(media.ticket_id) || 0) + 1);
    }

    const mappedTickets = tickets.map((ticket: any) => {
      const site = siteMap.get(ticket.site_id);
      const facility = facilityMap.get(ticket.facility_id);

      return {
        ...ticket,
        status: mapStatus(ticket.status),
        priority: mapPriority(ticket.priority),
        site_label: bestSiteLabel(site),
        facility_label: bestFacilityLabel(facility),
        media_count: mediaCountMap.get(ticket.id) || 0,
      };
    });

    return jsonResponse({
      ok: true,
      tickets: mappedTickets,
      debug: {
        count: mappedTickets.length,
      },
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Interner Fehler beim Laden der Tickets.',
      },
      500
    );
  }
};

export const PATCH: APIRoute = async ({ request, locals }) => {
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

    const ticketId = cleanString(body.id, 120);
    const action = cleanString(body.action, 80);

    if (!ticketId) {
      return jsonResponse(
        {
          ok: false,
          error: 'Ticket-ID fehlt.',
        },
        400
      );
    }

    const supabase = createOpcServiceClient(locals);

    const { data: existingTicket, error: existingError } = await supabase
      .from(TICKET_TABLE)
      .select('*')
      .eq('id', ticketId)
      .maybeSingle();

    if (existingError || !existingTicket) {
      return jsonResponse(
        {
          ok: false,
          error: existingError?.message || 'Ticket wurde nicht gefunden.',
        },
        404
      );
    }

    if (action === 'status') {
      const newStatus = cleanString(body.status, 80);

      const allowedStatuses = new Set(['new', 'in_progress', 'resolved', 'closed']);

      if (!newStatus || !allowedStatuses.has(newStatus)) {
        return jsonResponse(
          {
            ok: false,
            error: 'Ungültiger Status.',
          },
          400
        );
      }

      const oldStatus = existingTicket.status;

      const { error: updateError } = await supabase
        .from(TICKET_TABLE)
        .update({
          status: newStatus,
        })
        .eq('id', ticketId);

      if (updateError) {
        return jsonResponse(
          {
            ok: false,
            error: `Status konnte nicht aktualisiert werden: ${updateError.message}`,
          },
          500
        );
      }

      await supabase.from(EVENTS_TABLE).insert({
        ticket_id: ticketId,
        event_type: 'status_changed',
        message: `Status wurde von ${oldStatus} auf ${newStatus} geändert.`,
        actor_type: auth.isDevFallback ? 'dev' : 'staff',
        old_status: oldStatus,
        new_status: newStatus,
        metadata: {
          changed_by: auth.user.id,
        },
      });

      return jsonResponse({
        ok: true,
      });
    }

    if (action === 'note') {
      const note = cleanString(body.note, 2000);

      if (!note) {
        return jsonResponse(
          {
            ok: false,
            error: 'Notiz fehlt.',
          },
          400
        );
      }

      const { error: noteError } = await supabase.from(EVENTS_TABLE).insert({
        ticket_id: ticketId,
        event_type: 'internal_note',
        message: note,
        actor_type: auth.isDevFallback ? 'dev' : 'staff',
        metadata: {
          created_by: auth.user.id,
          created_by_email: auth.user.email || null,
        },
      });

      if (noteError) {
        return jsonResponse(
          {
            ok: false,
            error: `Notiz konnte nicht gespeichert werden: ${noteError.message}`,
          },
          500
        );
      }

      return jsonResponse({
        ok: true,
      });
    }

    return jsonResponse(
      {
        ok: false,
        error: 'Ungültige Aktion.',
      },
      400
    );
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Interner Fehler beim Aktualisieren des Tickets.',
      },
      500
    );
  }
};