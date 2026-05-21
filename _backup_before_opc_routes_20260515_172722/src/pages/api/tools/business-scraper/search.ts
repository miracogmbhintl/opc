import type { APIRoute } from 'astro';
import { requireAuth } from '../../../../lib/supabase-server';
import {
  createLeadSource,
  insertLeadSourceItems,
  upsertLeadFromBusiness,
  updateLeadSourceItemMatch,
  logLeadActivity
} from '../../../../lib/supabase-leads';

interface Business {
  place_id: string;
  business_name: string;
  industry: string;
  rating: number | null;
  review_count: number | null;
  phone: string | null;
  international_phone: string | null;
  address: string;
  formatted_address: string;
  website: string | null;
  lat: number;
  lng: number;
  business_status: string | null;
  opening_hours: {
    open_now: boolean | null;
    weekday_text: string[];
  } | null;
  price_level: number | null;
  types: string[];
  url: string | null;
  vicinity: string | null;
  reviews: Array<{
    author_name: string;
    rating: number;
    text: string;
    time: number;
    relative_time_description: string;
  }>;
  plus_code: {
    global_code: string;
    compound_code: string;
  } | null;
  utc_offset_minutes: number | null;
  wheelchair_accessible_entrance: boolean | null;
  editorial_summary: string | null;
}

interface SearchBody {
  keywords: string[];
  locations: string[];
  radius: number;
  radiusUnit: 'km' | 'mi';
  maxResults: number;
}

function toRadiusKm(radius: number, radiusUnit: 'km' | 'mi'): number {
  return radiusUnit === 'km' ? radius : radius * 1.60934;
}

function toRadiusMeters(radius: number, radiusUnit: 'km' | 'mi'): number {
  return Math.round(toRadiusKm(radius, radiusUnit) * 1000);
}

function buildSourceTitle(keywords: string[], location: string): string {
  return `${keywords.join(', ')} in ${location}`;
}

function extractCityCountry(formattedAddress?: string | null): {
  city: string | null;
  country: string | null;
} {
  if (!formattedAddress) return { city: null, country: null };

  const parts = formattedAddress
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    city: parts.length >= 2 ? parts[parts.length - 2] : null,
    country: parts.length >= 1 ? parts[parts.length - 1] : null
  };
}

function mapPriceLevel(value?: string | null): number | null {
  switch (value) {
    case 'PRICE_LEVEL_FREE':
    case 'PRICE_LEVEL_INEXPENSIVE':
      return 1;
    case 'PRICE_LEVEL_MODERATE':
      return 2;
    case 'PRICE_LEVEL_EXPENSIVE':
      return 3;
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return 4;
    default:
      return null;
  }
}

async function geocodeLocation(apiKey: string, location: string) {
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    location
  )}&key=${apiKey}`;

  const response = await fetch(geocodeUrl);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('🔴 GEOCODE_HTTP_ERROR:', {
      status: response.status,
      statusText: response.statusText,
      errorText,
      location
    });
    throw new Error(`Geocoding API returned ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  if (data.status !== 'OK' || !data.results?.[0]) {
    console.error('🔴 GEOCODE_ERROR:', {
      status: data.status,
      error_message: data.error_message,
      location,
      full_response: JSON.stringify(data)
    });
    throw new Error(`Location not found: ${data.status}${data.error_message ? ` - ${data.error_message}` : ''}`);
  }

  return data.results[0].geometry.location as { lat: number; lng: number };
}

async function searchPlacesForKeyword(
  apiKey: string,
  keyword: string,
  lat: number,
  lng: number,
  radiusMeters: number,
  maxResultCount: number
) {
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.types,places.formattedAddress,places.location,places.rating,places.userRatingCount'
    },
    body: JSON.stringify({
      textQuery: keyword,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMeters
        }
      },
      maxResultCount
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('🔴 PLACES_SEARCH_ERROR:', {
      status: response.status,
      statusText: response.statusText,
      errorText,
      keyword,
      lat,
      lng,
      radiusMeters
    });
    throw new Error(`Text Search failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.places ?? [];
}

async function fetchPlaceDetails(apiKey: string, placeId: string) {
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'id,displayName,types,formattedAddress,location,nationalPhoneNumber,internationalPhoneNumber,websiteUri,rating,userRatingCount,businessStatus,currentOpeningHours,priceLevel,googleMapsUri,plusCode,utcOffsetMinutes,accessibilityOptions,editorialSummary,reviews'
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('🔴 PLACE_DETAILS_ERROR:', {
      status: response.status,
      statusText: response.statusText,
      errorText,
      placeId
    });
    throw new Error(`Place Details failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

function normalizeBusiness(detail: any): Business {
  return {
    place_id: detail.id || '',
    business_name: detail.displayName?.text || 'Unknown',
    industry: detail.types?.[0]?.replace(/_/g, ' ') || 'General',
    rating: detail.rating ?? null,
    review_count: detail.userRatingCount ?? null,
    phone: detail.nationalPhoneNumber ?? null,
    international_phone: detail.internationalPhoneNumber ?? null,
    address: detail.formattedAddress || '',
    formatted_address: detail.formattedAddress || '',
    website: detail.websiteUri ?? null,
    lat: detail.location?.latitude ?? 0,
    lng: detail.location?.longitude ?? 0,
    business_status: detail.businessStatus ?? null,
    opening_hours: detail.currentOpeningHours
      ? {
          open_now: detail.currentOpeningHours.openNow ?? null,
          weekday_text: detail.currentOpeningHours.weekdayDescriptions ?? []
        }
      : null,
    price_level: mapPriceLevel(detail.priceLevel),
    types: detail.types ?? [],
    url: detail.googleMapsUri ?? null,
    vicinity: null,
    reviews: Array.isArray(detail.reviews)
      ? detail.reviews.slice(0, 5).map((review: any) => ({
          author_name: review.authorAttribution?.displayName || 'Anonymous',
          rating: review.rating || 0,
          text: review.text?.text || '',
          time: review.publishTime ? new Date(review.publishTime).getTime() : 0,
          relative_time_description:
            review.relativePublishTimeDescription || ''
        }))
      : [],
    plus_code: detail.plusCode
      ? {
          global_code: detail.plusCode.globalCode || '',
          compound_code: detail.plusCode.compoundCode || ''
        }
      : null,
    utc_offset_minutes: detail.utcOffsetMinutes ?? null,
    wheelchair_accessible_entrance:
      detail.accessibilityOptions?.wheelchairAccessibleEntrance ?? null,
    editorial_summary: detail.editorialSummary?.text ?? null
  };
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  try {
    const runtimeEnv = locals?.runtime?.env as Record<string, string> | undefined;
    
    // IMPORTANT: Use server-specific key for backend Geocoding + Places API
    // Browser map uses separate GOOGLE_MAPS_BROWSER_KEY in the Astro page
    const GOOGLE_MAPS_SERVER_KEY =
      runtimeEnv?.GOOGLE_MAPS_SERVER_KEY || 
      runtimeEnv?.GOOGLE_API_KEY || 
      import.meta.env.GOOGLE_MAPS_SERVER_KEY || 
      import.meta.env.GOOGLE_API_KEY || 
      '';

    console.log('🔵 [PERSISTENCE AUDIT] Step 1: Auth check starting');
    const user = await requireAuth(cookies, runtimeEnv);

    if (!user) {
      console.log('🔴 [PERSISTENCE AUDIT] Step 1: Auth FAILED - returning 401');
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    console.log('🟢 [PERSISTENCE AUDIT] Step 1: Auth OK - user.id:', user.id);

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return new Response(JSON.stringify({ error: 'Content-Type must be application/json' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let body: SearchBody;
    try {
      body = await request.json() as SearchBody;
    } catch (parseError) {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { keywords, locations, radius, radiusUnit, maxResults } = body;

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return new Response(JSON.stringify({ error: 'keywords must be a non-empty array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!Array.isArray(locations) || locations.length === 0) {
      return new Response(JSON.stringify({ error: 'locations must be a non-empty array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!Number.isFinite(radius) || radius <= 0) {
      return new Response(JSON.stringify({ error: 'radius must be a positive number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (radiusUnit !== 'km' && radiusUnit !== 'mi') {
      return new Response(JSON.stringify({ error: 'radiusUnit must be km or mi' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!GOOGLE_MAPS_SERVER_KEY) {
      return new Response(JSON.stringify({ error: 'Google API server key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const locationQuery = locations[0];
    const radiusKm = toRadiusKm(radius, radiusUnit);
    const radiusMeters = toRadiusMeters(radius, radiusUnit);

    if (radiusMeters > 50000) {
      return new Response(
        JSON.stringify({
          error: 'Radius cannot exceed 50km (31 miles) due to Google Places API limits.'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const { lat, lng } = await geocodeLocation(GOOGLE_MAPS_SERVER_KEY, locationQuery);

    const allBusinesses: Business[] = [];
    const seenPlaceIds = new Set<string>();

    for (const keyword of keywords) {
      const remaining = Math.max(1, Math.min(20, maxResults - allBusinesses.length));
      if (remaining <= 0) break;

      const places = await searchPlacesForKeyword(
        GOOGLE_MAPS_SERVER_KEY,
        keyword,
        lat,
        lng,
        radiusMeters,
        remaining
      );

      for (const place of places) {
        const placeId = place.id;
        if (!placeId || seenPlaceIds.has(placeId)) continue;

        seenPlaceIds.add(placeId);

        try {
          const detail = await fetchPlaceDetails(GOOGLE_MAPS_SERVER_KEY, placeId);
          const business = normalizeBusiness(detail);

          if (business.place_id) {
            allBusinesses.push(business);
          }
        } catch (detailError) {
          console.error('[search.ts] detail fetch failed for', placeId, detailError);
        }

        if (allBusinesses.length >= maxResults) break;
      }

      if (allBusinesses.length >= maxResults) break;
    }

    console.log('🔵 [PERSISTENCE AUDIT] Step 2: About to call createLeadSource');
    console.log('🔵 [PERSISTENCE AUDIT] Step 2: businessCount =', allBusinesses.length);
    
    const sourceId = await createLeadSource({
      runtimeEnv,
      createdBy: user.id,
      organizationId: null,
      title: buildSourceTitle(keywords, locationQuery),
      searchKeywords: keywords,
      locationQuery,
      radiusKm,
      filters: {
        radius,
        radiusUnit,
        maxResults
      },
      rawRequest: body as unknown as Record<string, unknown>,
      resultCount: allBusinesses.length,
      sourceStatus: 'completed'
    });

    console.log('🟢 [PERSISTENCE AUDIT] Step 2: createLeadSource SUCCESS - sourceId:', sourceId);

    await logLeadActivity({
      runtimeEnv,
      actorUserId: user.id,
      organizationId: null,
      sourceId,
      actorRole: null,
      action: 'scraper_search_created',
      details: {
        keywords,
        locationQuery,
        radiusKm
      }
    });

    const sourceItems = allBusinesses.map((business, index) => {
      const { city, country } = extractCityCountry(
        business.formatted_address || business.address
      );

      return {
        sourceId,
        rowNumber: index + 1,
        externalId: business.place_id,
        sourceBusinessName: business.business_name,
        sourceCategory: business.industry,
        sourceAddress: business.formatted_address || business.address,
        sourceCity: city,
        sourceCountry: country,
        sourcePhone: business.phone || business.international_phone,
        sourceEmail: null,
        sourceWebsite: business.website,
        sourceRating: business.rating,
        sourceReviewCount: business.review_count,
        latitude: business.lat,
        longitude: business.lng,
        rawPayload: business as unknown as Record<string, unknown>
      };
    });

    console.log('🔵 [PERSISTENCE AUDIT] Step 3: About to call insertLeadSourceItems');
    console.log('🔵 [PERSISTENCE AUDIT] Step 3: itemCount =', sourceItems.length);

    const insertedItems = await insertLeadSourceItems(runtimeEnv, sourceItems);
    
    console.log('🟢 [PERSISTENCE AUDIT] Step 3: insertLeadSourceItems SUCCESS - inserted:', insertedItems.length);
    
    const insertedByExternalId = new Map(
      insertedItems.map((item) => [item.external_id, item.id])
    );

    console.log('🔵 [PERSISTENCE AUDIT] Step 4: About to enter upsertLeadFromBusiness loop');
    
    let successCount = 0;
    let failCount = 0;

    for (const business of allBusinesses) {
      try {
        const { city, country } = extractCityCountry(
          business.formatted_address || business.address
        );

        console.log('🔵 [PERSISTENCE AUDIT] Step 4: Upserting lead for place_id:', business.place_id);

        const leadId = await upsertLeadFromBusiness({
          runtimeEnv,
          createdBy: user.id,
          organizationId: null,
          googlePlaceId: business.place_id,
          canonicalName: business.business_name,
          displayName: business.business_name,
          websiteUrl: business.website,
          primaryPhone: business.phone || business.international_phone,
          primaryEmail: null,
          category: business.industry,
          subcategory: business.types?.[1] || null,
          fullAddress: business.formatted_address || business.address,
          city,
          state: null,
          postalCode: null,
          country,
          latitude: business.lat,
          longitude: business.lng,
          rating: business.rating,
          reviewCount: business.review_count,
          metadata: {
            types: business.types,
            url: business.url,
            business_status: business.business_status
          }
        });

        console.log('🟢 [PERSISTENCE AUDIT] Step 4: Lead upserted - leadId:', leadId);
        successCount++;

        const sourceItemId = insertedByExternalId.get(business.place_id);
        if (sourceItemId) {
          await updateLeadSourceItemMatch(runtimeEnv, sourceItemId, leadId);
          console.log('🟢 [PERSISTENCE AUDIT] Step 4: Updated match for item:', sourceItemId);
        }
      } catch (upsertError: any) {
        failCount++;
        console.error('🔴 [PERSISTENCE AUDIT] Step 4: FAILED to upsert lead for', business.place_id);
        console.error('🔴 [PERSISTENCE AUDIT] Error:', upsertError?.message || upsertError);
        // Continue processing remaining businesses instead of throwing
      }
    }

    console.log('🟢 [PERSISTENCE AUDIT] Step 4: Loop complete - success:', successCount, 'failed:', failCount);

    await logLeadActivity({
      runtimeEnv,
      actorUserId: user.id,
      organizationId: null,
      sourceId,
      actorRole: null,
      action: 'scraper_results_persisted',
      details: {
        resultCount: allBusinesses.length,
        successCount,
        failCount
      }
    });

    console.log('🔵 [PERSISTENCE AUDIT] Step 5: About to return response');

    return new Response(
      JSON.stringify({
        sourceId,
        businesses: allBusinesses,
        count: allBusinesses.length,
        successCount,
        failCount
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('🔴 [PERSISTENCE AUDIT] FATAL ERROR:', error?.message || error);
    console.error('🔴 [PERSISTENCE AUDIT] Stack:', error?.stack);

    // Return a proper JSON error response, never HTML
    return new Response(
      JSON.stringify({
        error: error?.message || 'Search failed',
        details: error?.stack || 'No stack trace available'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
