import type { APIRoute } from 'astro';
import { jsonResponse } from '../../../lib/opc-ticket-admin';

export const prerender = false;

function getEnv(locals: any, key: string) {
  return String(
    locals?.runtime?.env?.[key] ||
      (import.meta as any).env?.[key] ||
      ''
  ).trim();
}

function getGoogleApiKey(locals: any) {
  return (
    getEnv(locals, 'GOOGLE_PLACES_API_KEY') ||
    getEnv(locals, 'GOOGLE_MAPS_API_KEY') ||
    getEnv(locals, 'GOOGLE_API_KEY') ||
    getEnv(locals, 'PUBLIC_GOOGLE_MAPS_API_KEY') ||
    getEnv(locals, 'VITE_GOOGLE_MAPS_API_KEY')
  );
}

function sanitizePlaceId(value: string | null) {
  return String(value || '')
    .trim()
    .replace(/^places\//, '')
    .slice(0, 220);
}

function sanitizeSessionToken(value: string | null) {
  return String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 36);
}

function getAddressComponent(components: any[], types: string[]) {
  if (!Array.isArray(components)) return '';

  const found = components.find((component) => {
    const componentTypes = component?.types || [];
    return types.some((type) => componentTypes.includes(type));
  });

  return found?.longText || found?.long_name || found?.shortText || found?.short_name || '';
}

function normalizePlace(place: any) {
  const components = Array.isArray(place?.addressComponents)
    ? place.addressComponents
    : Array.isArray(place?.address_components)
      ? place.address_components
      : [];

  const streetNumber = getAddressComponent(components, ['street_number']);
  const route = getAddressComponent(components, ['route']);

  const addressText =
    [route, streetNumber].filter(Boolean).join(' ') ||
    place?.formattedAddress ||
    place?.formatted_address ||
    '';

  return {
    id: place?.id || '',
    placeId: place?.id || '',
    name: place?.displayName?.text || place?.name || '',
    displayName: place?.displayName || null,
    formattedAddress: place?.formattedAddress || place?.formatted_address || '',
    addressText,
    postalCode: getAddressComponent(components, ['postal_code']),
    city:
      getAddressComponent(components, ['locality']) ||
      getAddressComponent(components, ['postal_town']) ||
      getAddressComponent(components, ['administrative_area_level_2']),
    country: getAddressComponent(components, ['country']),
    latitude: place?.location?.latitude ?? null,
    longitude: place?.location?.longitude ?? null,
    location: place?.location || null,
    addressComponents: components,
  };
}

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const url = new URL(request.url);

    const placeId =
      sanitizePlaceId(url.searchParams.get('placeId')) ||
      sanitizePlaceId(url.searchParams.get('place_id')) ||
      sanitizePlaceId(url.searchParams.get('id'));

    const sessionToken = sanitizeSessionToken(url.searchParams.get('sessionToken'));

    if (!placeId) {
      return jsonResponse(
        {
          ok: false,
          error: 'Place ID fehlt.',
        },
        400
      );
    }

    const apiKey = getGoogleApiKey(locals);

    if (!apiKey) {
      return jsonResponse(
        {
          ok: false,
          error:
            'Google Places API Key fehlt. Bitte GOOGLE_PLACES_API_KEY oder GOOGLE_MAPS_API_KEY in der ENV prüfen.',
        },
        500
      );
    }

    const params = new URLSearchParams({
      languageCode: 'de',
    });

    if (sessionToken) {
      params.set('sessionToken', sessionToken);
    }

    const googleResponse = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'id,displayName,formattedAddress,addressComponents,location',
        },
      }
    );

    const googleData = await googleResponse.json().catch(() => ({}));

    if (!googleResponse.ok) {
      return jsonResponse(
        {
          ok: false,
          error:
            googleData?.error?.message ||
            googleData?.message ||
            'Google Place Details konnten nicht geladen werden.',
          google_status: googleResponse.status,
          google_error: googleData?.error || googleData,
        },
        googleResponse.status
      );
    }

    return jsonResponse({
      ok: true,
      place: normalizePlace(googleData),
      raw: googleData,
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Google Place Details konnten nicht geladen werden.',
      },
      500
    );
  }
};
