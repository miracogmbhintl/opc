import type { APIRoute } from 'astro';
import { createOpcServiceClient, jsonResponse } from '../../../lib/opc-ticket-admin';

export const prerender = false;

const QR_LINK_TABLE = 'opc_facility_public_links';
const FACILITY_TABLE = 'opc_facilities';
const SITE_TABLE = 'opc_client_sites';
const TICKET_TABLE = 'opc_tickets';
const TICKET_MEDIA_TABLE = 'opc_ticket_media';
const TICKET_EVENTS_TABLE = 'opc_ticket_events';
const SUBMISSION_TABLE = 'opc_public_ticket_submissions';
const TICKET_MEDIA_BUCKET = 'opc-ticket-media';

const MAX_IMAGES = 5;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_BYTES = 55 * 1024 * 1024;
const PUBLIC_TICKET_HOURLY_LIMIT = 10;
const FALLBACK_IDEMPOTENCY_BUCKET_MS = 10 * 60 * 1000;

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
  return [
    'damage',
    'cleaning_needed',
    'recleaning',
    'material_missing',
    'complaint',
    'praise',
    'other',
  ].includes(raw) ? raw : 'other';
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

  const titles: Record<string, string> = {
    damage: 'Schaden gemeldet',
    cleaning_needed: 'Reinigung notwendig',
    recleaning: 'Nachreinigung nötig',
    material_missing: 'Material fehlt',
    complaint: 'Beschwerde',
    praise: 'Positives Feedback',
  };
  return titles[category] || 'Neue Meldung';
}

function parseNumber(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null;
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function getClientIp(request: Request, clientAddress?: string) {
  return request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    clientAddress ||
    'unknown';
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function loadSite(supabase: any, siteId: string | null) {
  if (!siteId) return null;
  const { data, error } = await supabase.from(SITE_TABLE).select('*').eq('id', siteId).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function loadFacility(supabase: any, facilityId: string | null) {
  if (!facilityId) return null;
  const { data, error } = await supabase.from(FACILITY_TABLE).select('*').eq('id', facilityId).maybeSingle();
  if (error) throw error;
  return data || null;
}

function bestSiteName(site: any) {
  return site?.site_name || site?.name || site?.title || site?.address_text || null;
}

function bestFacilityName(facility: any) {
  return facility?.facility_name || facility?.name || facility?.label || facility?.area_name || null;
}

async function buildFallbackIdempotencyKey(params: {
  token: string;
  category: string;
  description: string;
  reporterName: string;
  reporterPhone: string;
  reporterEmail: string;
  address: string;
  facilityArea: string;
  images: File[];
}) {
  const bucket = Math.floor(Date.now() / FALLBACK_IDEMPOTENCY_BUCKET_MS);
  const fileSignature = params.images
    .map((file) => `${file.name}:${file.size}:${file.type}`)
    .sort()
    .join('|');

  return sha256Hex([
    params.token,
    params.category,
    params.description,
    params.reporterName,
    params.reporterPhone,
    params.reporterEmail,
    params.address,
    params.facilityArea,
    fileSignature,
    String(bucket),
  ].join('||'));
}

async function findTicketBySubmissionKey(supabase: any, publicLinkId: string, idempotencyKey: string) {
  const { data, error } = await supabase
    .from(TICKET_TABLE)
    .select('id,ticket_number')
    .eq('public_link_id', publicLinkId)
    .contains('metadata', { public_submission_key: idempotencyKey })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function markReservation(supabase: any, reservationId: string, values: Record<string, unknown>) {
  const { error } = await supabase
    .from(SUBMISSION_TABLE)
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', reservationId);
  if (error) throw error;
}

async function logTicketEvent(supabase: any, event: Record<string, unknown>) {
  const { error } = await supabase.from(TICKET_EVENTS_TABLE).insert(event);
  if (error) console.warn('[public-ticket] event logging failed:', error.message);
}

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  let reservationId: string | null = null;
  let supabase: any = null;

  try {
    const contentType = request.headers.get('content-type') || '';
    const contentLength = Number(request.headers.get('content-length') || 0);

    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return jsonResponse({ ok: false, error: 'Ungültiges Anfrageformat.' }, 400);
    }
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return jsonResponse({ ok: false, error: 'Meldung ist zu groß.' }, 413);
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
      return jsonResponse({ ok: false, error: 'Bitte kurz beschreiben, was geprüft werden soll.' }, 400);
    }
    if (reporterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporterEmail)) {
      return jsonResponse({ ok: false, error: 'Bitte eine gültige E-Mail-Adresse eingeben.' }, 400);
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
        return jsonResponse({ ok: false, error: 'Bitte nur JPG, PNG, WEBP, HEIC oder HEIF Bilder hochladen.' }, 400);
      }
    }

    supabase = createOpcServiceClient(locals);

    const { data: publicLink, error: publicLinkError } = await supabase
      .from(QR_LINK_TABLE)
      .select('*')
      .eq('token', token)
      .maybeSingle();
    if (publicLinkError) throw publicLinkError;
    if (!publicLink || publicLink.is_active !== true) {
      return jsonResponse({ ok: false, error: 'Dieser QR-Code ist nicht aktiv oder wurde nicht gefunden.' }, 404);
    }

    const linkType = normalizeLinkType(publicLink.link_type);
    const isGeneral = linkType === 'general';
    if (isGeneral && !googleFormattedAddress && !manualAddress) {
      return jsonResponse({ ok: false, error: 'Bitte eine Adresse suchen oder manuell eintragen.' }, 400);
    }

    const [site, facility] = isGeneral
      ? [null, null]
      : await Promise.all([
          loadSite(supabase, publicLink.site_id || null),
          loadFacility(supabase, publicLink.facility_id || null),
        ]);

    const addressText = isGeneral
      ? googleFormattedAddress || manualAddress
      : site?.address_text || site?.address || null;

    const explicitIdempotencyKey = sanitizeText(formData.get('submission_id'), 200) ||
      String(request.headers.get('idempotency-key') || '').trim().slice(0, 200);
    const idempotencyKey = explicitIdempotencyKey || await buildFallbackIdempotencyKey({
      token,
      category,
      description,
      reporterName,
      reporterPhone,
      reporterEmail,
      address: addressText || '',
      facilityArea,
      images,
    });

    const rawIp = getClientIp(request, clientAddress);
    const clientFingerprint = await sha256Hex(`${token}|${rawIp}|${request.headers.get('user-agent') || ''}`);

    const { data: reservation, error: reservationError } = await supabase.rpc(
      'opc_reserve_public_ticket_submission',
      {
        p_public_link_id: publicLink.id,
        p_idempotency_key: idempotencyKey,
        p_client_fingerprint: clientFingerprint,
        p_hourly_limit: PUBLIC_TICKET_HOURLY_LIMIT,
      },
    );

    if (reservationError) {
      const message = reservationError.message || 'Meldung konnte nicht reserviert werden.';
      if (message.includes('RATE_LIMIT')) {
        return jsonResponse({ ok: false, error: 'Zu viele Meldungen in kurzer Zeit. Bitte versuchen Sie es später erneut.' }, 429);
      }
      throw reservationError;
    }

    reservationId = String(reservation?.reservation_id || '');
    if (!reservationId) throw new Error('Submission-Reservierung konnte nicht erstellt werden.');

    if (reservation?.ticket_id) {
      return jsonResponse({
        ok: true,
        duplicate: true,
        ticket_id: reservation.ticket_id,
        ticket_number: reservation.ticket_number || null,
        media_warning_count: Number(reservation.media_warning_count || 0),
      });
    }

    if (reservation?.existing === true && !reservation?.ticket_id) {
      return jsonResponse(
        { ok: false, retryable: true, error: 'Diese Meldung wird bereits verarbeitet. Bitte nicht erneut absenden.' },
        409,
      );
    }

    const alreadyCreated = await findTicketBySubmissionKey(supabase, publicLink.id, idempotencyKey);
    if (alreadyCreated) {
      await markReservation(supabase, reservationId, {
        ticket_id: alreadyCreated.id,
        ticket_number: alreadyCreated.ticket_number || null,
        state: 'complete',
        completed_at: new Date().toISOString(),
      });
      return jsonResponse({
        ok: true,
        duplicate: true,
        ticket_id: alreadyCreated.id,
        ticket_number: alreadyCreated.ticket_number || null,
      });
    }

    let googleComponents: any = null;
    if (googleComponentsRaw) {
      try { googleComponents = JSON.parse(googleComponentsRaw); }
      catch { googleComponents = null; }
    }

    const source = isGeneral ? 'public_qr_general' : 'public_qr';
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
        public_submission_key: idempotencyKey,
        client_fingerprint: clientFingerprint,
        user_agent: String(request.headers.get('user-agent') || '').slice(0, 500) || null,
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

    let ticket: any = null;
    const { data: insertedTicket, error: ticketError } = await supabase
      .from(TICKET_TABLE)
      .insert(ticketInsert)
      .select('*')
      .maybeSingle();

    if (ticketError || !insertedTicket) {
      if (ticketError?.code === '23505') {
        ticket = await findTicketBySubmissionKey(supabase, publicLink.id, idempotencyKey);
      }
      if (!ticket) {
        await markReservation(supabase, reservationId, { state: 'failed' }).catch(() => undefined);
        throw new Error(`Ticket konnte nicht erstellt werden: ${ticketError?.message || 'Unbekannter Fehler'}`);
      }
    } else {
      ticket = insertedTicket;
    }

    await markReservation(supabase, reservationId, {
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number || null,
      state: 'ticket_created',
    });

    const uploadedMediaRows: any[] = [];
    const mediaWarnings: string[] = [];

    for (const image of images) {
      const safeName = cleanFileName(image.name || 'bild.jpg') || 'bild.jpg';
      const fileName = `${crypto.randomUUID()}-${safeName}`;
      const storagePath = `${ticket.id}/${fileName}`;

      try {
        const buffer = await image.arrayBuffer();
        const { error: uploadError } = await supabase.storage
          .from(TICKET_MEDIA_BUCKET)
          .upload(storagePath, new Uint8Array(buffer), {
            contentType: image.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        uploadedMediaRows.push({
          ticket_id: ticket.id,
          bucket_id: TICKET_MEDIA_BUCKET,
          storage_path: storagePath,
          original_filename: image.name || fileName,
          mime_type: image.type,
          file_size_bytes: image.size,
          uploaded_by_type: 'public',
        });
      } catch (error: any) {
        mediaWarnings.push(`${image.name || 'Bild'}: ${error?.message || 'Upload fehlgeschlagen'}`);
        await logTicketEvent(supabase, {
          ticket_id: ticket.id,
          event_type: 'media_upload_failed',
          message: 'Bild-Upload ist fehlgeschlagen.',
          actor_type: 'public',
          visibility: 'internal',
          metadata: { filename: image.name || null, error: error?.message || 'Upload fehlgeschlagen' },
        });
      }
    }

    if (uploadedMediaRows.length > 0) {
      const { error: mediaError } = await supabase.from(TICKET_MEDIA_TABLE).insert(uploadedMediaRows);
      if (mediaError) {
        mediaWarnings.push(`Medien konnten nicht dem Ticket zugeordnet werden: ${mediaError.message}`);
        const paths = uploadedMediaRows.map((row) => row.storage_path).filter(Boolean);
        if (paths.length > 0) {
          const { error: cleanupError } = await supabase.storage.from(TICKET_MEDIA_BUCKET).remove(paths);
          if (cleanupError) {
            console.warn('[public-ticket] orphan media cleanup failed:', cleanupError.message);
          }
        }
        uploadedMediaRows.length = 0;
      }
    }

    await logTicketEvent(supabase, {
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number || null,
      event_type: 'created',
      message: isGeneral ? 'Allgemeine QR-Code Meldung wurde erstellt.' : 'Ticket wurde erstellt.',
      actor_type: 'public',
      new_status: 'new',
      visibility: 'internal',
      metadata: {
        source,
        link_type: linkType,
        public_link_id: publicLink.id,
        address_text: addressText || null,
        media_warning_count: mediaWarnings.length,
      },
    });

    if (uploadedMediaRows.length > 0) {
      await logTicketEvent(supabase, {
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number || null,
        event_type: 'media_uploaded',
        message: `${uploadedMediaRows.length} Bild(er) wurden hochgeladen.`,
        actor_type: 'public',
        visibility: 'internal',
        metadata: { uploaded_count: uploadedMediaRows.length },
      });
    }

    const completedAt = new Date().toISOString();
    await markReservation(supabase, reservationId, {
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number || null,
      state: 'complete',
      media_warning_count: mediaWarnings.length,
      completed_at: completedAt,
    });

    const { error: usageError } = await supabase.rpc('opc_mark_public_link_used', {
      p_public_link_id: publicLink.id,
    });
    if (usageError) console.warn('[public-ticket] QR usage counter failed:', usageError.message);

    return jsonResponse({
      ok: true,
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number || null,
      uploaded_media_count: uploadedMediaRows.length,
      media_warning_count: mediaWarnings.length,
      media_warnings: mediaWarnings,
    });
  } catch (error: any) {
    if (reservationId && supabase) {
      await markReservation(supabase, reservationId, { state: 'failed' }).catch(() => undefined);
    }

    console.error('[opc/create-public-ticket] failed:', error);
    return jsonResponse(
      { ok: false, error: error?.message || 'Meldung konnte nicht erstellt werden.' },
      error?.status || 500,
    );
  }
};
