import { getSupabaseAdmin } from './supabase-admin';

type RuntimeEnv = Record<string, string> | undefined;

export interface LeadSourceCreateInput {
  runtimeEnv?: RuntimeEnv;
  createdBy: string;
  organizationId?: string | null;
  title: string;
  searchKeywords: string[];
  locationQuery: string;
  radiusKm: number;
  filters: Record<string, unknown>;
  rawRequest: Record<string, unknown>;
  resultCount: number;
  sourceStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  errorMessage?: string | null;
}

export interface LeadSourceItemInsertInput {
  sourceId: string;
  rowNumber: number;
  externalId: string;
  sourceBusinessName: string;
  sourceCategory?: string | null;
  sourceAddress?: string | null;
  sourceCity?: string | null;
  sourceCountry?: string | null;
  sourcePhone?: string | null;
  sourceEmail?: string | null;
  sourceWebsite?: string | null;
  sourceRating?: number | null;
  sourceReviewCount?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  rawPayload: Record<string, unknown>;
}

export interface LeadUpsertInput {
  runtimeEnv?: RuntimeEnv;
  createdBy: string;
  organizationId?: string | null;
  googlePlaceId: string;
  canonicalName: string;
  displayName?: string | null;
  websiteUrl?: string | null;
  primaryPhone?: string | null;
  primaryEmail?: string | null;
  category?: string | null;
  subcategory?: string | null;
  fullAddress?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  metadata?: Record<string, unknown>;
}

export interface LeadActivityLogInput {
  runtimeEnv?: RuntimeEnv;
  actorUserId: string;
  organizationId?: string | null;
  leadId?: string | null;
  sourceId?: string | null;
  actorRole?: string | null;
  action: string;
  details?: Record<string, unknown>;
}

export interface LeadExportLogInput {
  runtimeEnv?: RuntimeEnv;
  generatedBy: string;
  organizationId?: string | null;
  sourceId?: string | null;
  exportType: 'csv' | 'pdf';
  exportScope: 'current_results' | 'saved_list' | 'approved_leads' | 'all_filtered';
  rowCount: number;
  fileSizeMb?: number | null;
  filePath?: string | null;
}

function getAdmin(runtimeEnv?: RuntimeEnv) {
  return getSupabaseAdmin(runtimeEnv);
}

function extractWebsiteDomain(websiteUrl?: string | null): string | null {
  if (!websiteUrl) return null;

  try {
    const url = new URL(websiteUrl);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function buildNormalizedHash(input: LeadSourceItemInsertInput): string {
  const parts = [
    input.externalId || '',
    input.sourceBusinessName || '',
    input.sourceAddress || '',
    input.sourceCity || '',
    input.sourceCountry || ''
  ];

  return parts.map((v) => v.toLowerCase().trim()).join('|');
}

export async function createLeadSource(input: LeadSourceCreateInput): Promise<string> {
  const supabase = getAdmin(input.runtimeEnv);

  const payload = {
    organization_id: input.organizationId ?? null,
    created_by: input.createdBy,
    source_type: 'scraper_search' as const,
    title: input.title,
    source_status: input.sourceStatus,
    search_keywords: input.searchKeywords,
    location_query: input.locationQuery,
    radius_km: input.radiusKm,
    csv_file_name: null,
    csv_storage_path: null,
    filters: input.filters ?? {},
    raw_request: input.rawRequest ?? {},
    result_count: input.resultCount,
    error_message: input.errorMessage ?? null,
    completed_at:
      input.sourceStatus === 'completed' ||
      input.sourceStatus === 'failed' ||
      input.sourceStatus === 'cancelled'
        ? new Date().toISOString()
        : null
  };

  const { data, error } = await supabase
    .from('lead_sources')
    .insert(payload)
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function insertLeadSourceItems(
  runtimeEnv: RuntimeEnv,
  items: LeadSourceItemInsertInput[]
): Promise<Array<{ id: string; external_id: string | null }>> {
  if (items.length === 0) return [];

  const supabase = getAdmin(runtimeEnv);

  const rows = items.map((item) => ({
    source_id: item.sourceId,
    matched_lead_id: null,
    row_number: item.rowNumber,
    external_id: item.externalId,
    source_business_name: item.sourceBusinessName,
    source_category: item.sourceCategory ?? null,
    source_address: item.sourceAddress ?? null,
    source_city: item.sourceCity ?? null,
    source_country: item.sourceCountry ?? null,
    source_phone: item.sourcePhone ?? null,
    source_email: item.sourceEmail ?? null,
    source_website: item.sourceWebsite ?? null,
    source_rating: item.sourceRating ?? null,
    source_review_count: item.sourceReviewCount ?? null,
    latitude: item.latitude ?? null,
    longitude: item.longitude ?? null,
    normalized_hash: buildNormalizedHash(item),
    raw_payload: item.rawPayload,
    processing_status: 'raw' as const
  }));

  const { data, error } = await supabase
    .from('lead_source_items')
    .insert(rows)
    .select('id, external_id');

  if (error) throw error;
  return data ?? [];
}

export async function upsertLeadFromBusiness(input: LeadUpsertInput): Promise<string> {
  const supabase = getAdmin(input.runtimeEnv);
  const now = new Date().toISOString();

  let query = supabase
    .from('leads')
    .select(
      'id, organization_id, website_url, website_domain, primary_phone, primary_email, category, subcategory, full_address, city, state, postal_code, country, latitude, longitude, rating, review_count, metadata'
    )
    .eq('google_place_id', input.googlePlaceId)
    .is('deleted_at', null)
    .limit(1);

  if (input.organizationId) {
    query = query.eq('organization_id', input.organizationId);
  } else {
    query = query.is('organization_id', null);
  }

  const { data: existingRows, error: existingError } = await query;
  if (existingError) throw existingError;

  const existing = existingRows?.[0] ?? null;

  if (existing) {
    const updatePayload = {
      website_url: input.websiteUrl || existing.website_url || null,
      website_domain:
        extractWebsiteDomain(input.websiteUrl) ||
        existing.website_domain ||
        null,
      primary_phone: input.primaryPhone || existing.primary_phone || null,
      primary_email: input.primaryEmail || existing.primary_email || null,
      category: input.category || existing.category || null,
      subcategory: input.subcategory || existing.subcategory || null,
      full_address: input.fullAddress || existing.full_address || null,
      city: input.city || existing.city || null,
      state: input.state || existing.state || null,
      postal_code: input.postalCode || existing.postal_code || null,
      country: input.country || existing.country || null,
      latitude: input.latitude ?? existing.latitude ?? null,
      longitude: input.longitude ?? existing.longitude ?? null,
      rating: input.rating ?? existing.rating ?? null,
      review_count: input.reviewCount ?? existing.review_count ?? null,
      last_seen_at: now,
      updated_at: now,
      metadata: {
        ...(existing.metadata ?? {}),
        ...(input.metadata ?? {})
      }
    };

    const { data, error } = await supabase
      .from('leads')
      .update(updatePayload)
      .eq('id', existing.id)
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  const insertPayload = {
    organization_id: input.organizationId ?? null,
    created_by: input.createdBy,
    assigned_to: null,
    canonical_name: input.canonicalName,
    display_name: input.displayName ?? null,
    legal_name: null,
    source_origin: 'scraper' as const,
    google_place_id: input.googlePlaceId,
    website_url: input.websiteUrl ?? null,
    website_domain: extractWebsiteDomain(input.websiteUrl),
    primary_email: input.primaryEmail ?? null,
    primary_phone: input.primaryPhone ?? null,
    category: input.category ?? null,
    subcategory: input.subcategory ?? null,
    full_address: input.fullAddress ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    postal_code: input.postalCode ?? null,
    country: input.country ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    rating: input.rating ?? null,
    review_count: input.reviewCount ?? null,
    current_stage: 'new' as const,
    intern_status: 'pending' as const,
    owner_status: 'pending' as const,
    priority_level: 'medium' as const,
    online_presence_score: null,
    website_quality_score: null,
    opportunity_score: null,
    service_fit_score: null,
    suggested_services: null,
    estimated_price_min: null,
    estimated_price_max: null,
    summary: null,
    pain_points: null,
    internal_notes: null,
    tags: null,
    metadata: input.metadata ?? {},
    source_first_seen_at: now,
    last_seen_at: now,
    converted_client_id: null
  };

  const { data, error } = await supabase
    .from('leads')
    .insert(insertPayload)
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function updateLeadSourceItemMatch(
  runtimeEnv: RuntimeEnv,
  itemId: string,
  matchedLeadId: string
): Promise<void> {
  const supabase = getAdmin(runtimeEnv);

  const { error } = await supabase
    .from('lead_source_items')
    .update({
      matched_lead_id: matchedLeadId,
      processing_status: 'matched'
    })
    .eq('id', itemId);

  if (error) throw error;
}

export async function logLeadActivity(input: LeadActivityLogInput): Promise<void> {
  const supabase = getAdmin(input.runtimeEnv);

  const { error } = await supabase.from('lead_activity_logs').insert({
    organization_id: input.organizationId ?? null,
    lead_id: input.leadId ?? null,
    source_id: input.sourceId ?? null,
    actor_user_id: input.actorUserId,
    actor_role: input.actorRole ?? null,
    action: input.action,
    details: input.details ?? {}
  });

  if (error) {
    console.error('[lead_activity_logs] insert failed', error);
  }
}

export async function logLeadExport(input: LeadExportLogInput): Promise<void> {
  const supabase = getAdmin(input.runtimeEnv);

  const { error } = await supabase.from('lead_exports').insert({
    organization_id: input.organizationId ?? null,
    source_id: input.sourceId ?? null,
    generated_by: input.generatedBy,
    export_type: input.exportType,
    file_path: input.filePath ?? null,
    file_size_mb: input.fileSizeMb ?? null,
    export_scope: input.exportScope,
    row_count: input.rowCount
  });

  if (error) {
    console.error('[lead_exports] insert failed', error);
  }
}
