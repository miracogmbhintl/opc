import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  const GOOGLE_API_KEY = 
    locals?.runtime?.env?.GOOGLE_API_KEY || 
    import.meta.env.GOOGLE_API_KEY;

  const diagnostics = {
    apiKeyPresent: !!GOOGLE_API_KEY,
    apiKeyLength: GOOGLE_API_KEY?.length || 0,
    apiKeyPrefix: GOOGLE_API_KEY?.substring(0, 10) || 'N/A',
    timestamp: new Date().toISOString()
  };

  // Test Geocoding API
  let geocodeTest = { status: 'not_tested', error: null };
  if (GOOGLE_API_KEY) {
    try {
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=Berlin&key=${GOOGLE_API_KEY}`;
      const response = await fetch(geocodeUrl);
      const data = await response.json();
      geocodeTest = {
        status: data.status,
        error: data.error_message || null
      };
    } catch (err) {
      geocodeTest = {
        status: 'fetch_failed',
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }

  // Test Places API (new)
  let placesTest = { status: 'not_tested', error: null };
  if (GOOGLE_API_KEY) {
    try {
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName'
        },
        body: JSON.stringify({
          textQuery: 'restaurant in Berlin',
          maxResultCount: 1
        })
      });
      
      if (response.ok) {
        placesTest = { status: 'OK', error: null };
      } else {
        const errorText = await response.text();
        placesTest = {
          status: `HTTP_${response.status}`,
          error: errorText
        };
      }
    } catch (err) {
      placesTest = {
        status: 'fetch_failed',
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }

  return new Response(
    JSON.stringify({
      diagnostics,
      tests: {
        geocoding: geocodeTest,
        places: placesTest
      },
      requiredAPIs: [
        'Geocoding API',
        'Places API (New)'
      ],
      setupInstructions: 'https://console.cloud.google.com/apis/library'
    }, null, 2),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
};
