import type { APIRoute } from 'astro';
import {
  createOpcServiceClient,
  getClientIp,
  isAllowedTicketImage,
  jsonResponse,
  safeFileName,
  sanitizePublicText,
  sanitizeTicketCategory,
} from '../../../lib/opc-ticket-admin';

export const prerender = false;

const QR_LINK_TABLE = 'opc_facility_public_links';
const TICKET_TABLE = 'opc_tickets';
const TICKET_MEDIA_TABLE = 'opc_ticket_media';
const TICKET_EVENTS_TABLE = 'opc_ticket_events';
const TICKET_MEDIA_BUCKET = 'opc-ticket-media';

const MAX_IMAGES = 5;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function getTitleFromCategory(category: string) {
  if (category === 'damage') return 'Schaden gemeldet';
  if (category === 'cleaning_needed') return 'Reinigung notwendig';
  if (category === 'recleaning') return 'Nachreinigung nötig';
  if (category === 'material_missing') return 'Material fehlt';
  if (category === 'complaint') return 'Beschwerde';
  if (category === 'praise') return 'Positives Feedback';

  return 'Neue Meldung';
}

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return jsonResponse(
        {
          ok: false,
          error: 'Ungültiges Anfrageformat.',
        },
        400
      );
    }

    const formData = await request.formData();

    const token = sanitizePublicText(formData.get('token'), 140);
    const category = sanitizeTicketCategory(formData.get('category'));
    const description = sanitizePublicText(formData.get('description'), 2000);

    const reporterName = sanitizePublicText(formData.get('reporter_name'), 120);
    const reporterPhone = sanitizePublicText(formData.get('reporter_phone'), 80);
    const reporterEmail = sanitizePublicText(formData.get('reporter_email'), 160);

    if (!token) {
      return jsonResponse(
        {
          ok: false,
          error: 'QR-Code Token fehlt.',
        },
        400
      );
    }

    if (!description) {
      return jsonResponse(
        {
          ok: false,
          error: 'Bitte kurz beschreiben, was geprüft werden soll.',
        },
        400
      );
    }

    const imageEntries = formData.getAll('images');
    const images = imageEntries.filter((entry): entry is File => entry instanceof File);

    if (images.length > MAX_IMAGES) {
      return jsonResponse(
        {
          ok: false,
          error: `Bitte maximal ${MAX_IMAGES} Bilder hochladen.`,
        },
        400
      );
    }

    for (const image of images) {
      if (image.size > MAX_FILE_SIZE_BYTES) {
        return jsonResponse(
          {
            ok: false,
            error: 'Ein Bild ist zu gross. Maximal erlaubt sind 10 MB pro Bild.',
          },
          400
        );
      }

      if (!isAllowedTicketImage(image)) {
        return jsonResponse(
          {
            ok: false,
            error: 'Bitte nur JPG, PNG, WebP, HEIC oder HEIF hochladen.',
          },
          400
        );
      }
    }

    const supabase = createOpcServiceClient(locals);

    const { data: publicLink, error: publicLinkError } = await supabase
      .from(QR_LINK_TABLE)
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (publicLinkError) {
      return jsonResponse(
        {
          ok: false,
          error: `QR-Code konnte nicht geprüft werden: ${publicLinkError.message}`,
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

    const ip = getClientIp(request, clientAddress);
    const userAgent = request.headers.get('user-agent');

    const { data: ticket, error: ticketError } = await supabase
      .from(TICKET_TABLE)
      .insert({
        source: 'public_qr',
        status: 'new',
        priority: category === 'damage' ? 'high' : 'normal',
        category,

        client_id: publicLink.client_id || null,
        site_id: publicLink.site_id || null,
        facility_id: publicLink.facility_id || null,
        public_link_id: publicLink.id,

        title: getTitleFromCategory(category),
        description,

        reporter_name: reporterName,
        reporter_phone: reporterPhone,
        reporter_email: reporterEmail,

        submitted_ip: ip,
        submitted_user_agent: userAgent,

        metadata: {
          submitted_from: 'public_qr_form',
          token,
          has_images: images.length > 0,
          image_count: images.length,
        },
      })
      .select('id, ticket_number')
      .single();

    if (ticketError || !ticket) {
      return jsonResponse(
        {
          ok: false,
          error: `Ticket konnte nicht erstellt werden: ${
            ticketError?.message || 'Unbekannter Datenbankfehler'
          }`,
        },
        500
      );
    }

    const uploadedMediaRows: any[] = [];

    for (const image of images) {
      const filename = safeFileName(image.name || 'ticket-image');
      const storagePath = `${ticket.id}/${crypto.randomUUID()}-${filename}`;

      const { error: uploadError } = await supabase.storage
        .from(TICKET_MEDIA_BUCKET)
        .upload(storagePath, image, {
          contentType: image.type,
          upsert: false,
        });

      if (uploadError) {
        await supabase.from(TICKET_EVENTS_TABLE).insert({
          ticket_id: ticket.id,
          event_type: 'media_upload_failed',
          message: 'Ein Bild konnte nicht hochgeladen werden.',
          actor_type: 'system',
          metadata: {
            filename,
            mime_type: image.type,
            file_size_bytes: image.size,
            upload_error: uploadError.message,
          },
        });

        continue;
      }

      uploadedMediaRows.push({
        ticket_id: ticket.id,
        bucket_id: TICKET_MEDIA_BUCKET,
        storage_path: storagePath,
        original_filename: filename,
        mime_type: image.type,
        file_size_bytes: image.size,
        uploaded_by_type: 'public',
        metadata: {
          source: 'public_qr_form',
        },
      });
    }

    if (uploadedMediaRows.length > 0) {
      const { error: mediaInsertError } = await supabase
        .from(TICKET_MEDIA_TABLE)
        .insert(uploadedMediaRows);

      if (mediaInsertError) {
        await supabase.from(TICKET_EVENTS_TABLE).insert({
          ticket_id: ticket.id,
          event_type: 'media_metadata_failed',
          message: 'Bild-Metadaten konnten nicht vollständig gespeichert werden.',
          actor_type: 'system',
          metadata: {
            error: mediaInsertError.message,
            uploaded_count: uploadedMediaRows.length,
          },
        });
      } else {
        await supabase.from(TICKET_EVENTS_TABLE).insert({
          ticket_id: ticket.id,
          event_type: 'media_uploaded',
          message: `${uploadedMediaRows.length} Bild(er) wurden hochgeladen.`,
          actor_type: 'public',
          metadata: {
            uploaded_count: uploadedMediaRows.length,
          },
        });
      }
    }

    await supabase
      .from(QR_LINK_TABLE)
      .update({
        last_used_at: new Date().toISOString(),
        use_count: Number(publicLink.use_count || 0) + 1,
      })
      .eq('id', publicLink.id);

    return jsonResponse({
      ok: true,
      ticketId: ticket.id,
      ticketNumber: ticket.ticket_number,
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Interner Fehler beim Erstellen der Meldung.',
      },
      500
    );
  }
};