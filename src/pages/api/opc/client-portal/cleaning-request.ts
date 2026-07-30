import type { APIRoute } from 'astro';
import {
  authenticateOpcClientPortalRequest,
  opcClientPortalJson,
} from '../../../../lib/opc-client-portal-server';

export const prerender = false;

const MEDIA_BUCKET = 'opc-ticket-media';
const MAX_FILES = 8;
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

function serviceLabel(value: string) {
  const labels: Record<string, string> = {
    maintenance: 'Unterhaltsreinigung',
    special: 'Spezialreinigung',
    emergency: 'Notreinigung',
    move: 'Umzugsreinigung',
    window: 'Fenster- und Glasreinigung',
    construction: 'Baureinigung',
    deep: 'Grundreinigung',
    office: 'Büroreinigung',
    change_request: 'Änderungsanfrage zu Auftrag',
    other: 'Andere Reinigung',
  };
  return labels[value] || 'Reinigungsanfrage';
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
    email: clientUser.email || contact.email || client.billing_email || access.user.email || '',
    phone:
      clientUser.phone_e164 ||
      clientUser.phone_raw ||
      contact.phone_e164 ||
      contact.phone_raw ||
      client.billing_phone_e164 ||
      '',
  };
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const authenticated = await authenticateOpcClientPortalRequest(request, locals);
    if ('error' in authenticated) {
      return opcClientPortalJson({ ok: false, error: authenticated.error }, authenticated.status);
    }
    if (!authenticated.access.permissions.canCreateRequests) {
      return opcClientPortalJson({ ok: false, error: 'Für dieses Kundenkonto dürfen keine Anfragen erstellt werden.' }, 403);
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return opcClientPortalJson({ ok: false, error: 'Ungültiges Anfrageformat.' }, 400);
    }

    const form = await request.formData();
    const serviceCategory = clean(form.get('service_category'), 80) || 'other';
    const allowedServices = new Set([
      'maintenance',
      'special',
      'emergency',
      'move',
      'window',
      'construction',
      'deep',
      'office',
      'change_request',
      'other',
    ]);
    if (!allowedServices.has(serviceCategory)) {
      return opcClientPortalJson({ ok: false, error: 'Bitte eine gültige Reinigungsart auswählen.' }, 400);
    }

    const title = clean(form.get('title'), 180) || serviceLabel(serviceCategory);
    const description = clean(form.get('description'), 5000);
    const siteId = clean(form.get('site_id'), 120) || null;
    const priority = clean(form.get('priority'), 40) || (serviceCategory === 'emergency' ? 'high' : 'normal');
    const jobId = clean(form.get('job_id'), 120) || null;
    const preferredDate = clean(form.get('preferred_date'), 80) || null;
    const addressText = clean(form.get('address_text'), 500) || null;
    const postalCode = clean(form.get('postal_code'), 40) || null;
    const city = clean(form.get('city'), 120) || null;
    const country = clean(form.get('country'), 120) || 'Schweiz';
    const buildingSize = clean(form.get('building_size_m2'), 40) || null;
    const floors = clean(form.get('floors'), 40) || null;
    const requestedServices = clean(form.get('requested_services'), 3000) || null;
    const notes = clean(form.get('notes'), 3000) || null;

    if (!description) {
      return opcClientPortalJson({ ok: false, error: 'Bitte beschreiben Sie die gewünschte Reinigung.' }, 400);
    }

    let site: AnyRow | null = null;
    if (siteId) {
      const siteResult = await authenticated.serviceClient
        .from('opc_client_sites')
        .select('*')
        .eq('id', siteId)
        .eq('client_id', authenticated.access.clientId)
        .maybeSingle();
      if (siteResult.error || !siteResult.data) {
        return opcClientPortalJson({ ok: false, error: 'Der ausgewählte Standort gehört nicht zu diesem Kundenkonto.' }, 400);
      }
      site = siteResult.data;
    }

    if (!site && (!addressText || !postalCode || !city)) {
      return opcClientPortalJson({ ok: false, error: 'Bitte einen Standort auswählen oder die Adresse vollständig angeben.' }, 400);
    }

    if (jobId) {
      const jobResult = await authenticated.serviceClient
        .from('opc_service_jobs')
        .select('id')
        .eq('id', jobId)
        .eq('client_id', authenticated.access.clientId)
        .maybeSingle();
      if (jobResult.error || !jobResult.data) {
        return opcClientPortalJson({ ok: false, error: 'Der referenzierte Auftrag gehört nicht zu diesem Kundenkonto.' }, 400);
      }
    }

    const files = form.getAll('files').filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (files.length > MAX_FILES) {
      return opcClientPortalJson({ ok: false, error: `Bitte maximal ${MAX_FILES} Dateien hochladen.` }, 400);
    }
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) return opcClientPortalJson({ ok: false, error: 'Eine Datei ist grösser als 15 MB.' }, 400);
      if (!ALLOWED_TYPES.has(file.type)) return opcClientPortalJson({ ok: false, error: 'Erlaubt sind Bilder, PDF- und Word-Dateien.' }, 400);
    }

    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
    const ticketNumber = `RA-${datePart}-${suffix}`;
    const identity = portalIdentity(authenticated.access);

    const ticketResult = await authenticated.serviceClient
      .from('opc_tickets')
      .insert({
        ticket_number: ticketNumber,
        source: 'client_portal',
        status: 'new',
        priority: ['low', 'normal', 'high'].includes(priority) ? priority : 'normal',
        category: serviceCategory === 'change_request' ? 'other' : 'cleaning_needed',
        title,
        description,
        reporter_name: identity.display_name,
        reporter_phone: identity.phone || null,
        reporter_email: identity.email || null,
        client_id: authenticated.access.clientId,
        site_id: siteId,
        site_name: site?.site_name || null,
        address_text: site?.address_text || addressText,
        postal_code: site?.postal_code || postalCode,
        city: site?.city || city,
        country: site?.country || country,
        metadata: {
          source: 'opc_customer_portal',
          request_kind: 'cleaning_request',
          service_category: serviceCategory,
          service_label: serviceLabel(serviceCategory),
          preferred_date: preferredDate,
          building_size_m2: buildingSize,
          floors,
          requested_services: requestedServices,
          notes,
          related_job_id: jobId,
          created_by_auth_user_id: authenticated.user.id,
          created_at: now.toISOString(),
        },
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select('*')
      .single();

    if (ticketResult.error) throw new Error(`Reinigungsanfrage konnte nicht erstellt werden: ${ticketResult.error.message}`);
    const ticket = ticketResult.data;

    const mediaRows: AnyRow[] = [];
    for (const file of files) {
      const fileName = `${crypto.randomUUID()}-${cleanFileName(file.name)}`;
      const storagePath = `${ticket.id}/client/${fileName}`;
      const upload = await authenticated.serviceClient.storage
        .from(MEDIA_BUCKET)
        .upload(storagePath, new Uint8Array(await file.arrayBuffer()), {
          contentType: file.type,
          upsert: false,
        });
      if (upload.error) throw new Error(`Datei konnte nicht hochgeladen werden: ${upload.error.message}`);
      mediaRows.push({
        ticket_id: ticket.id,
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
      if (mediaInsert.error) throw new Error(`Dateien konnten nicht gespeichert werden: ${mediaInsert.error.message}`);
    }

    const eventRows: AnyRow[] = [{
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
      event_type: 'created',
      message: `${serviceLabel(serviceCategory)} wurde über das Kundenportal angefragt.`,
      actor_type: 'client',
      actor_user_id: authenticated.user.id,
      actor_name: identity.display_name,
      actor_email: identity.email || null,
      new_status: 'new',
      metadata: { source: 'opc_customer_portal', service_category: serviceCategory, related_job_id: jobId },
    }];

    if (mediaRows.length) {
      eventRows.push({
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number,
        event_type: 'media_uploaded',
        message: `${mediaRows.length} Datei(en) wurden zur Anfrage hochgeladen.`,
        actor_type: 'client',
        actor_user_id: authenticated.user.id,
        actor_name: identity.display_name,
        actor_email: identity.email || null,
        metadata: { uploaded_count: mediaRows.length },
      });
    }

    const eventInsert = await authenticated.serviceClient.from('opc_ticket_events').insert(eventRows);
    if (eventInsert.error) {
      console.warn('[opc/client-portal/cleaning-request] event insert failed', eventInsert.error.message);
    }

    return opcClientPortalJson({
      ok: true,
      ticket,
      message: 'Ihre Reinigungsanfrage wurde an Orange Pro Clean übermittelt.',
    }, 201);
  } catch (error: any) {
    return opcClientPortalJson({ ok: false, error: error?.message || 'Reinigungsanfrage konnte nicht erstellt werden.' }, 500);
  }
};
