import type { APIRoute } from 'astro';
import {
  authenticateOpcClientPortalRequest,
  opcClientPortalJson,
} from '../../../../../lib/opc-client-portal-server';

export const prerender = false;

const MEDIA_BUCKET = 'opc-ticket-media';
const MAX_FILES = 6;
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

type AnyRow = Record<string, any>;

function clean(value: unknown, max = 3000) {
  return String(value ?? '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, max);
}

function cleanFileName(value: string) {
  return String(value || 'datei')
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 160);
}

function portalIdentity(access: any) {
  const client = access.client || {};
  const contact = access.contact || {};
  const clientUser = access.clientUser || {};
  return {
    display_name:
      clientUser.display_name ||
      contact.full_name ||
      contact.company_name ||
      client.billing_name ||
      access.user.email ||
      'Kunde',
    company_name: client.billing_name || contact.company_name || 'Kundenkonto',
    email: clientUser.email || contact.email || client.billing_email || access.user.email || '',
  };
}

function isStaffActor(value: unknown) {
  return ['staff', 'owner', 'admin', 'dispatch', 'employee', 'internal', 'dev']
    .includes(clean(value, 40).toLowerCase());
}

function sanitizeEvent(row: AnyRow, clientName: string) {
  const eventType = clean(row.event_type, 80).toLowerCase();
  const message = clean(row.message, 3000);
  if (eventType === 'internal_note' || message.toLowerCase().startsWith('interne notiz:')) return null;

  return {
    id: row.id,
    event_type: eventType || 'update',
    message,
    actor_type: isStaffActor(row.actor_type) ? 'staff' : 'client',
    actor_name: isStaffActor(row.actor_type)
      ? 'Orange Pro Clean'
      : clean(row.actor_name || row.metadata?.actor_name, 180) || clientName,
    old_status: row.old_status || null,
    new_status: row.new_status || null,
    created_at: row.created_at || null,
  };
}

async function loadTicket(serviceClient: any, clientId: string, ticketId: string) {
  const result = await serviceClient
    .from('opc_tickets')
    .select('*')
    .eq('id', ticketId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (result.error) throw new Error(`Anfrage konnte nicht geladen werden: ${result.error.message}`);
  return result.data || null;
}

async function loadDetail(serviceClient: any, access: any, ticketId: string) {
  const ticket = await loadTicket(serviceClient, access.clientId, ticketId);
  if (!ticket) return null;

  const [siteResult, eventResult, mediaResult] = await Promise.all([
    ticket.site_id
      ? serviceClient
          .from('opc_client_sites')
          .select('*')
          .eq('id', ticket.site_id)
          .eq('client_id', access.clientId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    serviceClient
      .from('opc_ticket_events')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true }),
    serviceClient
      .from('opc_ticket_media')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true }),
  ]);

  const media = await Promise.all((mediaResult.data || []).map(async (row: AnyRow) => {
    const bucket = row.bucket_id || MEDIA_BUCKET;
    const path = row.storage_path;
    let displayUrl: string | null = null;
    if (path) {
      const signed = await serviceClient.storage.from(bucket).createSignedUrl(path, 60 * 60);
      displayUrl = signed.data?.signedUrl || null;
    }
    return {
      id: row.id,
      original_filename: row.original_filename || 'Datei',
      mime_type: row.mime_type || null,
      file_size_bytes: row.file_size_bytes || null,
      created_at: row.created_at || null,
      display_url: displayUrl,
    };
  }));

  const identity = portalIdentity(access);
  const events = (eventResult.data || [])
    .map((row: AnyRow) => sanitizeEvent(row, identity.display_name))
    .filter(Boolean);

  const safeTicket = { ...ticket };
  for (const key of ['internal_notes', 'private_notes', 'assigned_to_user_id', 'resolved_by_user_id']) {
    delete safeTicket[key];
  }

  return { ticket: safeTicket, site: siteResult.data || null, events, media };
}

export const GET: APIRoute = async ({ request, locals, params }) => {
  try {
    const authenticated = await authenticateOpcClientPortalRequest(request, locals);
    if ('error' in authenticated) {
      return opcClientPortalJson({ ok: false, error: authenticated.error }, authenticated.status);
    }

    const ticketId = clean(params.id, 120);
    if (!ticketId) return opcClientPortalJson({ ok: false, error: 'Ticket-ID fehlt.' }, 400);

    const detail = await loadDetail(authenticated.serviceClient, authenticated.access, ticketId);
    if (!detail) return opcClientPortalJson({ ok: false, error: 'Anfrage wurde nicht gefunden.' }, 404);

    return opcClientPortalJson({
      ok: true,
      portal: portalIdentity(authenticated.access),
      detail,
    });
  } catch (error: any) {
    return opcClientPortalJson({ ok: false, error: error?.message || 'Anfrage konnte nicht geladen werden.' }, 500);
  }
};

export const PATCH: APIRoute = async ({ request, locals, params }) => {
  try {
    const authenticated = await authenticateOpcClientPortalRequest(request, locals);
    if ('error' in authenticated) {
      return opcClientPortalJson({ ok: false, error: authenticated.error }, authenticated.status);
    }

    const ticketId = clean(params.id, 120);
    const current = await loadTicket(authenticated.serviceClient, authenticated.access.clientId, ticketId);
    if (!current) return opcClientPortalJson({ ok: false, error: 'Anfrage wurde nicht gefunden.' }, 404);

    const body = (await request.json().catch(() => ({}))) as AnyRow;
    const updates: AnyRow = { updated_at: new Date().toISOString() };
    const changes: string[] = [];

    const title = clean(body.title, 180);
    const description = clean(body.description, 5000);
    const priority = clean(body.priority, 40);
    const category = clean(body.category, 80);
    const siteId = clean(body.site_id, 120) || null;

    if (title && title !== current.title) {
      updates.title = title;
      changes.push('Titel wurde angepasst.');
    }
    if (description && description !== current.description) {
      updates.description = description;
      changes.push('Beschreibung wurde angepasst.');
    }
    if (['low', 'normal', 'high'].includes(priority) && priority !== current.priority) {
      updates.priority = priority;
      changes.push(`Priorität wurde auf ${priority} gesetzt.`);
    }
    if (['damage', 'cleaning_needed', 'recleaning', 'material_missing', 'complaint', 'praise', 'other'].includes(category) && category !== current.category) {
      updates.category = category;
      changes.push('Anfrageart wurde angepasst.');
    }

    if (siteId !== (current.site_id || null)) {
      if (siteId) {
        const siteCheck = await authenticated.serviceClient
          .from('opc_client_sites')
          .select('id')
          .eq('id', siteId)
          .eq('client_id', authenticated.access.clientId)
          .maybeSingle();
        if (siteCheck.error || !siteCheck.data) {
          return opcClientPortalJson({ ok: false, error: 'Der Standort gehört nicht zu diesem Kundenkonto.' }, 400);
        }
      }
      updates.site_id = siteId;
      changes.push('Standort wurde angepasst.');
    }

    if (!changes.length) {
      return opcClientPortalJson({ ok: true, ticket: current, message: 'Keine Änderungen erkannt.' });
    }

    const updatedResult = await authenticated.serviceClient
      .from('opc_tickets')
      .update(updates)
      .eq('id', ticketId)
      .eq('client_id', authenticated.access.clientId)
      .select('*')
      .single();

    if (updatedResult.error) {
      throw new Error(`Anfrage konnte nicht aktualisiert werden: ${updatedResult.error.message}`);
    }

    const identity = portalIdentity(authenticated.access);
    const eventResult = await authenticated.serviceClient.from('opc_ticket_events').insert({
      ticket_id: ticketId,
      ticket_number: current.ticket_number || null,
      event_type: 'internal_update',
      message: changes.join(' '),
      actor_type: 'client',
      actor_user_id: authenticated.user.id,
      actor_name: identity.display_name,
      actor_email: identity.email || null,
      old_status: current.status || null,
      new_status: current.status || null,
      metadata: { source: 'opc_customer_portal', changes: updates },
    });

    if (eventResult.error) {
      console.warn('[opc/client-portal/ticket] update event failed', eventResult.error.message);
    }

    return opcClientPortalJson({ ok: true, ticket: updatedResult.data, message: 'Änderungen wurden gespeichert.' });
  } catch (error: any) {
    return opcClientPortalJson({ ok: false, error: error?.message || 'Anfrage konnte nicht aktualisiert werden.' }, 500);
  }
};

export const POST: APIRoute = async ({ request, locals, params }) => {
  try {
    const authenticated = await authenticateOpcClientPortalRequest(request, locals);
    if ('error' in authenticated) {
      return opcClientPortalJson({ ok: false, error: authenticated.error }, authenticated.status);
    }

    const ticketId = clean(params.id, 120);
    const ticket = await loadTicket(authenticated.serviceClient, authenticated.access.clientId, ticketId);
    if (!ticket) return opcClientPortalJson({ ok: false, error: 'Anfrage wurde nicht gefunden.' }, 404);

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return opcClientPortalJson({ ok: false, error: 'Ungültiges Anfrageformat.' }, 400);
    }

    const form = await request.formData();
    const comment = clean(form.get('comment'), 4000);
    const files = form.getAll('files').filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (!comment && !files.length) {
      return opcClientPortalJson({ ok: false, error: 'Bitte eine Nachricht oder Datei hinzufügen.' }, 400);
    }
    if (files.length > MAX_FILES) {
      return opcClientPortalJson({ ok: false, error: `Bitte maximal ${MAX_FILES} Dateien hochladen.` }, 400);
    }
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) return opcClientPortalJson({ ok: false, error: 'Eine Datei ist grösser als 15 MB.' }, 400);
      if (!ALLOWED_TYPES.has(file.type)) return opcClientPortalJson({ ok: false, error: 'Erlaubt sind Bilder, PDF- und Word-Dateien.' }, 400);
    }

    const identity = portalIdentity(authenticated.access);
    const mediaRows: AnyRow[] = [];
    for (const file of files) {
      const fileName = `${crypto.randomUUID()}-${cleanFileName(file.name)}`;
      const storagePath = `${ticketId}/client/${fileName}`;
      const upload = await authenticated.serviceClient.storage
        .from(MEDIA_BUCKET)
        .upload(storagePath, new Uint8Array(await file.arrayBuffer()), {
          contentType: file.type,
          upsert: false,
        });
      if (upload.error) throw new Error(`Datei konnte nicht hochgeladen werden: ${upload.error.message}`);
      mediaRows.push({
        ticket_id: ticketId,
        bucket_id: MEDIA_BUCKET,
        storage_path: storagePath,
        original_filename: file.name || fileName,
        mime_type: file.type,
        file_size_bytes: file.size,
        uploaded_by_type: 'public',
      });
    }

    if (mediaRows.length) {
      const mediaInsert = await authenticated.serviceClient.from('opc_ticket_media').insert(mediaRows);
      if (mediaInsert.error) throw new Error(`Dateien konnten nicht im Ticket gespeichert werden: ${mediaInsert.error.message}`);
    }

    const eventRows: AnyRow[] = [];
    if (comment) {
      eventRows.push({
        ticket_id: ticketId,
        ticket_number: ticket.ticket_number || null,
        event_type: 'internal_update',
        message: comment,
        actor_type: 'client',
        actor_user_id: authenticated.user.id,
        actor_name: identity.display_name,
        actor_email: identity.email || null,
        metadata: { source: 'opc_customer_portal', kind: 'client_comment' },
      });
    }
    if (mediaRows.length) {
      eventRows.push({
        ticket_id: ticketId,
        ticket_number: ticket.ticket_number || null,
        event_type: 'media_uploaded',
        message: `${mediaRows.length} Datei(en) wurden hinzugefügt.`,
        actor_type: 'client',
        actor_user_id: authenticated.user.id,
        actor_name: identity.display_name,
        actor_email: identity.email || null,
        metadata: { source: 'opc_customer_portal', uploaded_count: mediaRows.length },
      });
    }
    if (eventRows.length) {
      const eventInsert = await authenticated.serviceClient.from('opc_ticket_events').insert(eventRows);
      if (eventInsert.error) {
        console.warn('[opc/client-portal/ticket] event insert failed', eventInsert.error.message);
      }
    }

    await authenticated.serviceClient
      .from('opc_tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', ticketId)
      .eq('client_id', authenticated.access.clientId);

    return opcClientPortalJson({ ok: true, message: 'Ergänzung wurde gespeichert.' });
  } catch (error: any) {
    return opcClientPortalJson({ ok: false, error: error?.message || 'Ergänzung konnte nicht gespeichert werden.' }, 500);
  }
};
