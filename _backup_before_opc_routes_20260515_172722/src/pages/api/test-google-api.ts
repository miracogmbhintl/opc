import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  const GOOGLE_API_KEY = locals?.runtime?.env?.GOOGLE_API_KEY || import.meta.env.GOOGLE_API_KEY || '';

  const tests = {
    keyExists: !!GOOGLE_API_KEY,
    keyLength: GOOGLE_API_KEY.length,
    keyPrefix: GOOGLE_API_KEY.substring(0, 8) + '...',
    geocodingTest: null as any,
    placesTest: null as any
  };

  if (!GOOGLE_API_KEY) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Google API key not found in environment variables',
      tests
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Test 1: Geocoding API
  try {
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=San+Francisco,CA&key=${GOOGLE_API_KEY}`;
    const geocodeRes = await fetch(geocodeUrl);
    const geocodeData = await geocodeRes.json();
    
    tests.geocodingTest = {
      status: geocodeData.status,
      success: geocodeData.status === 'OK',
      error: geocodeData.error_message || null
    };
  } catch (error: any) {
    tests.geocodingTest = {
      success: false,
      error: error.message
    };
  }

  // Test 2: Places API (New) - Text Search
  try {
    const searchUrl = 'https://places.googleapis.com/v1/places:searchText';
    const searchBody = {
      textQuery: 'coffee shops in San Francisco',
      maxResultCount: 5
    };

    const searchRes = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName'
      },
      body: JSON.stringify(searchBody)
    });

    const searchData = await searchRes.json();
    
    tests.placesTest = {
      status: searchRes.status,
      success: searchRes.status === 200,
      placesFound: searchData.places?.length || 0,
      error: searchData.error?.message || null
    };
  } catch (error: any) {
    tests.placesTest = {
      success: false,
      error: error.message
    };
  }

  const allSuccess = tests.geocodingTest?.success && tests.placesTest?.success;

  return new Response(JSON.stringify({
    success: allSuccess,
    message: allSuccess 
      ? '✅ All tests passed! Your Google API key is working correctly.' 
      : '❌ Some tests failed. Check the details below.',
    tests,
    recommendations: !allSuccess ? [
      !tests.geocodingTest?.success && 'Enable Geocoding API in Google Cloud Console',
      !tests.placesTest?.success && 'Enable Places API (New) in Google Cloud Console',
      'Make sure billing is enabled in your Google Cloud project',
      'Check API key restrictions are not too strict'
    ].filter(Boolean) : []
  }, null, 2), {
    status: allSuccess ? 200 : 500,
    headers: { 'Content-Type': 'application/json' }
  });
};
