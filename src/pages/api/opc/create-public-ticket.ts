import type { APIRoute } from 'astro';
import { createOpcServiceClient, jsonResponse } from '../../../lib/opc-ticket-admin';

export const prerender = false;

const QR_LINK_TABLE = 'opc_facility_public_links';
const FACILITY_TABLE = 'opc_facilities';
const SITE_TABLE = 'opc_client_sites';
const TICKET_TABLE = 'opc_tickets';
const TICKET_MEDIA_TABLE = 'opc_ticket_media';
const TICKET_EVENTS_TABLE = 'opc_ticket_events';
const TICKET_MEDIA_BUCKET = 'opc-ticket-media';

const MAX_IMAGES = 5;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

function sanitizeText(value: FormDataEntryValue | null, max = 500) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function sanitizeLongText(value: FormDataEntryValue | null, max = 3000) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function sanitizeCategory(value: FormDataEntryValue | null) {
  const raw = sanitizeText(value, 80);

  if (
    [
      'damage',
      'cleaning_needed',
      'recleaning',
      'material_missing',
      'complaint',
      'praise',
      'other',
    ].includes(raw)
  ) {
    return raw;
  }

  return 'other';
}

function normalizeLinkType(value: unknown) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'general' || raw === 'mass_print' || raw === 'public_general') return 'general';
  return 'facility';
}

function cleanFileName(value: string) {
  return String(value || 'bild')
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 160);
}

function getTitleFromCategory(category: string, isGeneral: boolean) {
  if (isGeneral) {
    if (category === 'damage') return 'Allgemeine Schadensmeldung';
    if (category === 'recleaning') return 'Allgemeine Nachreinigung';
    return 'Allgemeine QR-Code Meldung';
  }

  if (category === 'damage') return 'Schaden gemeldet';
  if (category === 'cleaning_needed') return 'Reinigung notwendig';
  if (category === 'recleaning') return 'Nachreinigung nötig';
  if (category === 'material_missing') return 'Material fehlt';
  if (category === 'complaint') return 'Beschwerde';
  if (category === 'praise') return 'Positives Feedback';

  return 'Neue Meldung';
}

function parseNumber(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null;
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function getClientIp(request: Request, clientAddress?: string) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    clientAddress ||
    null
  );
}

async function loadSite(supabase: any, siteId: string | null) {
  if (!siteId) return null;

  const { data } = await supabase.from(SITE_TABLE).select('*').eq('id', siteId).maybeSingle();
  return data || null;
}

async function loadFacility(supabase: any, facilityId: string | null) {
  if (!facilityId) return null;

  const { data } = await supabase.from(FACILITY_TABLE).select('*').eq('id', facilityId).maybeSingle();
  return data || null;
}

function bestSiteName(site: any) {
  if (!site) return null;
  return site.site_name || site.name || site.title || site.address_text || null;
}

function bestFacilityName(facility: any) {
  if (!facility) return null;
  return facility.facility_name || facility.name || facility.label || facility.area_name || null;
}

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return jsonResponse({ ok: false, error: 'Ungültiges Anfrageformat.' }, 400);
    }

    const formData = await request.formData();

    const token = sanitizeText(formData.get('token'), 160);
    const category = sanitizeCategory(formData.get('category'));
    const description = sanitizeLongText(formData.get('description'), 3000);

    const reporterName = sanitizeText(formData.get('reporter_name'), 120);
    const reporterPhone = sanitizeText(formData.get('reporter_phone'), 80);
    const reporterEmail = sanitizeText(formData.get('reporter_email'), 160);

    const manualAddress = sanitizeText(formData.get('manual_address'), 600);
    const facilityArea = sanitizeText(formData.get('facility_area'), 180);

    const googlePlaceId = sanitizeText(formData.get('google_place_id'), 220);
    const googlePlaceName = sanitizeText(formData.get('google_place_name'), 300);
    const googleFormattedAddress = sanitizeText(formData.get('google_formatted_address'), 700);
    const googleAddressText = sanitizeText(formData.get('google_address_text'), 500);
    const googlePostalCode = sanitizeText(formData.get('google_postal_code'), 80);
    const googleCity = sanitizeText(formData.get('google_city'), 160);
    const googleCountry = sanitizeText(formData.get('google_country'), 160);
    const googleComponentsRaw = sanitizeLongText(formData.get('google_address_components'), 6000);

    const latitude = parseNumber(formData.get('google_latitude'));
    const longitude = parseNumber(formData.get('google_longitude'));

    if (!token) return jsonResponse({ ok: false, error: 'QR-Code Token fehlt.' }, 400);

    if (!description) {
      return jsonResponse(
        { ok: false, error: 'Bitte kurz beschreiben, was geprüft werden soll.' },
        400
      );
    }

    const imageEntries = formData.getAll('images');
    const images = imageEntries.filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (images.length > MAX_IMAGES) {
      return jsonResponse({ ok: false, error: `Bitte maximal ${MAX_IMAGES} Bilder hochladen.` }, 400);
    }

    for (const image of images) {
      if (image.size > MAX_FILE_SIZE_BYTES) {
        return jsonResponse({ ok: false, error: 'Ein Bild ist grösser als 10 MB.' }, 400);
      }

      if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
        return jsonResponse(
          { ok: false, error: 'Bitte nur JPG, PNG, WEBP, HEIC oder HEIF Bilder hochladen.' },
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
        { ok: false, error: `QR-Code konnte nicht geladen werden: ${publicLinkError.message}` },
        500
      );
    }

    if (!publicLink || publicLink.is_active !== true) {
      return jsonResponse(
        { ok: false, error: 'Dieser QR-Code ist nicht aktiv oder wurde nicht gefunden.' },
        404
      );
    }

    const linkType = normalizeLinkType(publicLink.link_type);
    const isGeneral = linkType === 'general';

    if (isGeneral && !googleFormattedAddress && !manualAddress) {
      return jsonResponse(
        { ok: false, error: 'Bitte eine Adresse suchen oder manuell eintragen.' },
        400
      );
    }

    const [site, facility] = isGeneral
      ? [null, null]
      : await Promise.all([
          loadSite(supabase, publicLink.site_id || null),
          loadFacility(supabase, publicLink.facility_id || null),
        ]);

    const source = isGeneral ? 'public_qr_general' : 'public_qr';

    let googleComponents: any = null;

    if (googleComponentsRaw) {
      try {
        googleComponents = JSON.parse(googleComponentsRaw);
      } catch {
        googleComponents = googleComponentsRaw;
      }
    }

    const addressText = isGeneral
      ? googleFormattedAddress || manualAddress
      : site?.address_text || site?.address || null;

    const ticketInsert = {
      source,
      status: 'new',
      priority: 'normal',
      category,
      title: getTitleFromCategory(category, isGeneral),
      description,

      reporter_name: reporterName || null,
      reporter_phone: reporterPhone || null,
      reporter_email: reporterEmail || null,

      client_id: isGeneral ? null : publicLink.client_id || site?.client_id || null,
      site_id: isGeneral ? null : publicLink.site_id || null,
      facility_id: isGeneral ? null : publicLink.facility_id || null,
      public_link_id: publicLink.id,

      site_name: isGeneral ? googlePlaceName || 'Allgemeiner QR-Code' : bestSiteName(site),
      address_text: addressText,
      postal_code: isGeneral ? googlePostalCode || null : site?.postal_code || null,
      city: isGeneral ? googleCity || null : site?.city || null,
      country: isGeneral ? googleCountry || null : site?.country || null,

      facility_name: isGeneral ? facilityArea || null : bestFacilityName(facility),
      floor: isGeneral ? null : facility?.floor || null,
      area_type: isGeneral ? facilityArea || null : facility?.area_type || null,

      google_place_id: isGeneral ? googlePlaceId || null : null,
      latitude: isGeneral ? latitude : null,
      longitude: isGeneral ? longitude : null,

      metadata: {
        source,
        link_type: linkType,
        public_qr_mode: isGeneral ? 'general' : 'facility',
        client_ip: getClientIp(request, clientAddress),
        user_agent: request.headers.get('user-agent'),
        google_place_id: googlePlaceId || null,
        google_place_name: googlePlaceName || null,
        google_formatted_address: googleFormattedAddress || null,
        google_address_text: googleAddressText || null,
        google_postal_code: googlePostalCode || null,
        google_city: googleCity || null,
        google_country: googleCountry || null,
        google_latitude: latitude,
        google_longitude: longitude,
        google_address_components: googleComponents,
        manual_address: manualAddress || null,
        facility_area: facilityArea || null,
      },
    };

    const { data: ticket, error: ticketError } = await supabase
      .from(TICKET_TABLE)
      .insert(ticketInsert)
      .select('*')
      .maybeSingle();

    if (ticketError || !ticket) {
      return jsonResponse(
        { ok: false, error: `Ticket konnte nicht erstellt werden: ${ticketError?.message || 'Unbekannter Fehler'}` },
        500
      );
    }

    const uploadedMediaRows: any[] = [];

    for (const image of images) {
      const extension = cleanFileName(image.name).split('.').pop() || 'jpg';
      const fileName = `${crypto.randomUUID()}-${cleanFileName(image.name || `bild.${extension}`)}`;
      const storagePath = `${ticket.id}/${fileName}`;

      const buffer = await image.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from(TICKET_MEDIA_BUCKET)
        .upload(storagePath, new Uint8Array(buffer), {
          contentType: image.type,
          upsert: false,
        });

      if (uploadError) {
        await supabase.from(TICKET_EVENTS_TABLE).insert({
          ticket_id: ticket.id,
          event_type: 'media_upload_failed',
          message: 'Bild-Upload ist fehlgeschlagen.',
          actor_type: 'public',
          old_status: null,
          new_status: null,
          visibility: 'internal',
          metadata: {
            filename: image.name || fileName,
            error: uploadError.message,
          },
        });

        return jsonResponse(
          {
            ok: false,
            ticket_id: ticket.id,
            ticket_number: ticket.ticket_number || null,
            error: `Bild konnte nicht hochgeladen werden: ${uploadError.message}`,
          },
          500
        );
      }

      uploadedMediaRows.push({
        ticket_id: ticket.id,
        bucket_id: TICKET_MEDIA_BUCKET,
        storage_path: storagePath,
        original_filename: image.name || fileName,
        mime_type: image.type,
        file_size_bytes: image.size,
        uploaded_by_type: 'public',
      });
    }

    if (uploadedMediaRows.length > 0) {
      const { error: mediaError } = await supabase.from(TICKET_MEDIA_TABLE).insert(uploadedMediaRows);

      if (mediaError) {
        await supabase.from(TICKET_EVENTS_TABLE).insert({
          ticket_id: ticket.id,
          event_type: 'media_log_failed',
          message: 'Bild wurde hochgeladen, aber konnte nicht im Ticket gespeichert werden.',
          actor_type: 'public',
          old_status: null,
          new_status: null,
          visibility: 'internal',
          metadata: {
            error: mediaError.message,
            uploaded_media_count: uploadedMediaRows.length,
          },
        });

        return jsonResponse(
          {
            ok: false,
            ticket_id: ticket.id,
            ticket_number: ticket.ticket_number || null,
            error: `Bild wurde hochgeladen, aber konnte nicht im Ticket gespeichert werden: ${mediaError.message}`,
          },
          500
        );
      }
    }

    await supabase.from(TICKET_EVENTS_TABLE).insert([
      {
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number || null,
        event_type: 'created',
        message: isGeneral
          ? 'Allgemeine QR-Code Meldung wurde erstellt.'
          : 'Ticket wurde erstellt.',
        actor_type: 'public',
        old_status: null,
        new_status: 'new',
        visibility: 'internal',
        metadata: {
          source,
          link_type: linkType,
          public_link_id: publicLink.id,
          site_id: publicLink.site_id || null,
          facility_id: publicLink.facility_id || null,
          google_place_id: googlePlaceId || null,
          address_text: addressText || null,
        },
      },
      ...(uploadedMediaRows.length > 0
        ? [
            {
              ticket_id: ticket.id,
              ticket_number: ticket.ticket_number || null,
              event_type: 'media_uploaded',
              message: `${uploadedMediaRows.length} Bild(er) wurden hochgeladen.`,
              actor_type: 'public',
              old_status: null,
              new_status: null,
              visibility: 'internal',
              metadata: { uploaded_count: uploadedMediaRows.length },
            },
          ]
        : []),
    ]);

    await supabase
      .from(QR_LINK_TABLE)
      .update({
        use_count: Number(publicLink.use_count || 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', publicLink.id);

    return jsonResponse({
      ok: true,
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number || null,
      source,
      uploaded_media_count: uploadedMediaRows.length,
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Interner Fehler beim Erstellen der Meldung.',
      },
      500
    );
  }
};
