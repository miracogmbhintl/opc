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

function sanitizeInput(value: string | null) {
  return String(value || '').trim().slice(0, 220);
}

function sanitizeSessionToken(value: string | null) {
  return String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 36);
}

function normalizeSuggestions(data: any) {
  const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];

  return suggestions
    .map((item: any) => {
      const prediction = item?.placePrediction;
      if (!prediction) return null;

      const placeId = prediction.placeId || '';
      const placeResource = prediction.place || '';
      const label = prediction.text?.text || '';
      const mainText = prediction.structuredFormat?.mainText?.text || label;
      const secondaryText = prediction.structuredFormat?.secondaryText?.text || '';

      if (!placeId || !label) return null;

      return {
        placeId,
        place: placeResource,
        label,
        mainText,
        secondaryLabel: secondaryText,
      };
    })
    .filter(Boolean);
}

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const url = new URL(request.url);

    const input =
      sanitizeInput(url.searchParams.get('q')) ||
      sanitizeInput(url.searchParams.get('input'));

    const sessionToken = sanitizeSessionToken(url.searchParams.get('sessionToken'));

    if (!input || input.length < 3) {
      return jsonResponse({
        ok: true,
        suggestions: [],
      });
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

    const body: Record<string, any> = {
      input,
      languageCode: 'de',
      regionCode: 'CH',
      includedRegionCodes: ['CH', 'DE', 'FR', 'AT'],
      includeQueryPredictions: false,
    };

    if (sessionToken) {
      body.sessionToken = sessionToken;
    }

    const googleResponse = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'suggestions.placePrediction.place,suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
      },
      body: JSON.stringify(body),
    });

    const googleData = await googleResponse.json().catch(() => ({}));

    if (!googleResponse.ok) {
      return jsonResponse(
        {
          ok: false,
          error:
            googleData?.error?.message ||
            googleData?.message ||
            'Google Places Autocomplete konnte nicht geladen werden.',
          google_status: googleResponse.status,
          google_error: googleData?.error || googleData,
        },
        googleResponse.status
      );
    }

    return jsonResponse({
      ok: true,
      suggestions: normalizeSuggestions(googleData),
      raw: googleData,
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Google Places Autocomplete konnte nicht geladen werden.',
      },
      500
    );
  }
};
