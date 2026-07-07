import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import PortalSkeleton from './shared/PortalSkeleton';
import { readOpcPageCache, writeOpcPageCache } from '../lib/opc-page-cache';
import {
  CheckCircle2,
  ChevronRight,
  FolderOpen,
  MessageSquare,
  Search,
  ShieldAlert,
  UserPlus,
  Wrench,
  X,
} from 'lucide-react';

const REQUESTS_PAGE_CACHE_KEY = 'opc:page-cache:requests:v12-all-inquiries';

type ActiveTab = 'all' | 'inquiries' | 'applications';
type ItemType = 'inquiry' | 'damage' | 'job_damage';
type StatusFilter = 'all' | 'open' | 'in_progress' | 'done';
type TypeFilter = 'all' | 'inquiry' | 'application';
type ConversionMode = 'private' | 'corporate';

interface RawRow {
  [key: string]: any;
}

interface JobFeedRow {
  job_id?: string;
  title?: string;
  status?: string;
  priority?: string;
  planned_start?: string;
  planned_end?: string;
  client_id?: string;
  billing_name?: string;
  company_name?: string;
  full_name?: string;
  email?: string;
  phone_raw?: string;
  phone_e164?: string;
  client_site_id?: string;
  site_name?: string;
  address_text?: string;
  postal_code?: string;
  city?: string;
  damage_count?: number;
  report_status?: string;
  job_created_at?: string;
  job_updated_at?: string;
  [key: string]: any;
}

interface PortalItem {
  id: string;
  type: ItemType;
  title: string;
  description: string;
  detailDescription: string;
  status: string;
  statusGroup: StatusFilter;
  clientName: string;
  contactName: string;
  email: string;
  phoneRaw: string;
  phoneE164: string;
  contactLine: string;
  siteName: string;
  addressText: string;
  postalCode: string;
  city: string;
  country: string;
  locationLine: string;
  jobId?: string;
  clientId?: string;
  contactId?: string;
  onboardingCaseId?: string;
  inquiryId?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  count?: number;
  priority?: string;
  isApplication?: boolean;
  inquiryCategory?: string;
  sourceFormName?: string;
  sourceLabel?: string;
  clientTypeLabel?: string;
  reasonLabel?: string;
  objectTypeLabel?: string;
  roomCount?: string;
  surfaceLabel?: string;
  floorLabel?: string;
  elevatorLabel?: string;
  formMessage?: string;
}

interface ConversionForm {
  conversionMode: ConversionMode;
  billingName: string;
  fullName: string;
  companyName: string;
  email: string;
  phoneRaw: string;
  phoneE164: string;
  addressText: string;
  postalCode: string;
  city: string;
  country: string;
  siteName: string;
  internalNotes: string;
  allowDuplicate: boolean;
}

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  black: '#0F1115',
  card: '#FFFFFF',
  soft: '#FAFAFA',
  red: '#B91C1C',
  amber: '#92400E',
  green: '#166534',
};

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

const cardStyle: CSSProperties = {
  background: BRAND.card,
  border: `1px solid ${BRAND.border}`,
  borderRadius: '20px',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

const statusLabels: Record<string, string> = {
  new: 'Neu',
  open: 'Offen',
  pending: 'Offen',
  submitted: 'Eingereicht',
  info_missing: 'Info fehlt',
  in_progress: 'In Bearbeitung',
  'in-progress': 'In Bearbeitung',
  in_review: 'In Prüfung',
  offer_preparation: 'Offerte vorbereiten',
  offer_sent: 'Offerte gesendet',
  accepted: 'Akzeptiert',
  converted: 'Übernommen',
  rejected: 'Abgelehnt',
  resolved: 'Erledigt',
  closed: 'Geschlossen',
  completed: 'Abgeschlossen',
  archived: 'Archiviert',
  angefragt: 'Angefragt',
  qualifiziert: 'Qualifiziert',
  angebot_gesendet: 'Offerte gesendet',
  gebucht: 'Gebucht',
  abgelehnt: 'Abgelehnt',
  archiviert: 'Archiviert',
  approved: 'Freigegeben',
  report_approved: 'Freigegeben',
  sent_to_client: 'An Kunde gesendet',
  cancelled: 'Storniert',
};

const typeLabels: Record<ItemType, string> = {
  inquiry: 'Anfrage',
  damage: 'Schaden',
  job_damage: 'Einsatzhinweis',
};

function cleanValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (typeof value !== 'string') return '';

  const trimmed = value.trim().replace(/[\s,]+$/g, '').trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  if (['null', 'undefined', 'n/a', 'none', '-', 'unknown'].includes(lower)) return '';
  return trimmed;
}

function cleanDisplayValue(value: unknown): string {
  const cleaned = cleanValue(value);
  if (!cleaned) return '';

  const lower = cleaned.toLowerCase();
  if (
    [
      'unbekannte anfrage',
      'ohne kunde',
      'neuer kunde',
      'anfrage',
      'keine',
      'kein',
      'privat',
      'private',
      'unknown',
    ].includes(lower)
  ) {
    return '';
  }

  return cleaned;
}

function getFirstValue(row: RawRow | undefined, keys: string[], fallback = '') {
  if (!row) return fallback;

  for (const key of keys) {
    const value = cleanValue(row[key]);
    if (value) return value;
  }

  return fallback;
}

function getPathValue(row: RawRow | undefined, path: string): string {
  if (!row) return '';

  const parts = path.split('.');
  let current: any = row;

  for (const part of parts) {
    if (!current || typeof current !== 'object') return '';
    current = current[part];
  }

  return cleanValue(current);
}

function getAnyValue(row: RawRow | undefined, paths: string[], fallback = ''): string {
  if (!row) return fallback;

  for (const path of paths) {
    const value = path.includes('.') ? getPathValue(row, path) : cleanValue(row[path]);
    if (value) return value;
  }

  return fallback;
}

function getAnyDisplayValue(row: RawRow | undefined, paths: string[], fallback = ''): string {
  if (!row) return fallback;

  for (const path of paths) {
    const raw = path.includes('.') ? getPathValue(row, path) : cleanValue(row[path]);
    const value = cleanDisplayValue(raw);
    if (value) return value;
  }

  return fallback;
}

function parseKeyValueMessage(value: unknown): Record<string, string> {
  const text = cleanValue(value);
  if (!text) return {};

  return text.split(/\r?\n/).reduce<Record<string, string>>((acc, line) => {
    const separator = line.indexOf(':');
    if (separator === -1) return acc;

    const key = line.slice(0, separator).trim();
    const val = line.slice(separator + 1).trim();
    if (key && val) acc[key] = val;
    return acc;
  }, {});
}

function getMessageField(row: RawRow, keys: string[]) {
  const original = parseKeyValueMessage(row.original_message);
  const summary = parseKeyValueMessage(row.message_summary);

  for (const key of keys) {
    const value = cleanValue(original[key]) || cleanValue(summary[key]);
    if (value) return value;
  }

  return '';
}

function normalizeStatus(status?: string | null) {
  return String(status || '').trim().toLowerCase();
}

function getStatusLabel(status?: string | null) {
  const normalized = normalizeStatus(status);
  if (!normalized) return 'Offen';
  return statusLabels[normalized] || normalized.replace(/_/g, ' ');
}

function getStatusGroup(status?: string | null): StatusFilter {
  const normalized = normalizeStatus(status);

  if (
    [
      'converted',
      'rejected',
      'resolved',
      'closed',
      'completed',
      'approved',
      'report_approved',
      'sent_to_client',
      'cancelled',
      'archived',
      'abgelehnt',
      'archiviert',
    ].includes(normalized)
  ) {
    return 'done';
  }

  if (
    [
      'in_progress',
      'in-progress',
      'in_review',
      'submitted',
      'info_missing',
      'offer_preparation',
      'offer_sent',
      'accepted',
      'angefragt',
      'qualifiziert',
      'angebot_gesendet',
      'gebucht',
      'assigned',
      'confirmed',
      'on_site',
      'onsite',
    ].includes(normalized)
  ) {
    return 'in_progress';
  }

  return 'open';
}

function normalizeLabelValue(value: string): string {
  const cleaned = cleanValue(value);
  const key = cleaned.toLowerCase();

  const map: Record<string, string> = {
    webflow: 'Website',
    website: 'Website',
    whatsapp: 'WhatsApp',
    portal: 'Portal',
    other: 'Import',
    privatkunden: 'Privatkunde',
    privatkunde: 'Privatkunde',
    private: 'Privatkunde',
    geschaeftskunden: 'Geschäftskunde',
    geschäftskunden: 'Geschäftskunde',
    commercial: 'Geschäftskunde',
    allgemeine_fragen: 'Allgemeine Frage',
    allgemeine_frage: 'Allgemeine Frage',
    kontakt: 'Allgemeine Frage',
    kontaktformular: 'Allgemeine Frage',
    haus: 'Haus',
    house: 'Haus',
    wohnung: 'Wohnung',
    apartment: 'Wohnung',
    flat: 'Wohnung',
    yes: 'Ja',
    no: 'Nein',
    true: 'Ja',
    false: 'Nein',
    yes_elevator: 'Lift vorhanden',
    no_elevator: 'Kein Lift',
  };

  return map[key] || cleaned;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function buildFullName(firstName: string, lastName: string): string {
  return [cleanDisplayValue(firstName), cleanDisplayValue(lastName)].filter(Boolean).join(' ').trim();
}

function getSourceLabel(row: RawRow): string {
  const channel = getAnyValue(row, ['source_channel']).toLowerCase();
  const form = getAnyValue(row, ['source_form_name', 'onboarding_data.source_form_name']).toLowerCase();
  const url = getAnyValue(row, ['source_page_url']).toLowerCase();

  if (channel === 'webflow' || form.includes('formular') || url.includes('orangeproclean.ch')) return 'Website';
  if (channel === 'whatsapp') return 'WhatsApp';
  if (channel === 'portal') return 'Portal';
  if (channel === 'other') return 'Import';
  return channel ? normalizeLabelValue(channel) : 'Anfrage';
}

function getCategoryLabel(row: RawRow): string {
  const type = getAnyValue(row, ['inquiry_type', 'client_type', 'metadata.inquiry_type']).toLowerCase();
  const form = getAnyValue(row, ['source_form_name', 'onboarding_data.source_form_name']).toLowerCase();
  const url = getAnyValue(row, ['source_page_url']).toLowerCase();

  if (type.includes('geschaeft') || type.includes('geschäft') || form.includes('geschäft') || form.includes('geschaeft') || url.includes('business')) return 'Geschäftskunde';
  if (type.includes('privat') || form.includes('privat') || url.includes('privat')) return 'Privatkunde';
  if (type.includes('allgemein') || form.includes('kontakt')) return 'Allgemeine Frage';

  return normalizeLabelValue(type) || 'Anfrage';
}

function getInquiryCategory(row: RawRow) {
  return (
    getAnyValue(row, ['metadata.classification.category']) ||
    getFirstValue(row, ['classification_category', 'inquiry_category'])
  ).toLowerCase();
}

function isApplicationInquiry(row: RawRow) {
  const explicitCategory = getInquiryCategory(row);
  const sourceForm = getFirstValue(row, ['source_form_name', 'onboarding_data.source_form_name']).toLowerCase();
  const inquiryType = getFirstValue(row, ['inquiry_type', 'client_type', 'metadata.inquiry_type']).toLowerCase();
  const message = getFirstValue(
    row,
    ['message', 'original_message', 'notes', 'summary', 'description', 'request_summary', 'raw_message'],
  ).toLowerCase();
  const title = getFirstValue(row, ['title', 'case_title', 'inquiry_title', 'subject']).toLowerCase();
  const haystack = [sourceForm, inquiryType, title, message].join(' ');

  // Customer intent wins over a stale or incorrect AI/database classification.
  // This prevents normal quote and cleaning requests from being shown as applications.
  const strongCustomerSignals = [
    'offerte',
    'angebot',
    'kostenvoranschlag',
    'preis',
    'kosten',
    'auszugsreinigung',
    'umzugsreinigung',
    'endreinigung',
    'unterhaltsreinigung',
    'fensterreinigung',
    'baureinigung',
    'wohnungsreinigung',
    'reinigung buchen',
    'freie kapazität',
    'freie kapazitaet',
    'termin vereinbaren',
  ];
  const customerSignalCount = strongCustomerSignals.filter((signal) => haystack.includes(signal)).length;
  const customerTypeSignal = [
    'privatkunde',
    'geschäftskunde',
    'geschaeftskunde',
    'customer_inquiry',
    'quote_request',
    'offer_request',
  ].some((signal) => inquiryType.includes(signal) || explicitCategory === signal);

  const explicitApplicationForm = [
    'bewerbung',
    'karriere',
    'career',
    'job_application',
    'stellenbewerbung',
  ].some((signal) => sourceForm.includes(signal));

  const strongApplicationSignals = [
    'ich bewerbe mich',
    'meine bewerbung',
    'bewerbung als',
    'lebenslauf',
    'curriculum vitae',
    ' cv ',
    'arbeitsstelle',
    'stelle als',
    'reinigungskraft',
    'arbeitserfahrung',
    'erfahrung in der reinigung',
    'habe gearbeitet',
    'gearbeitet bei',
    'zertifiziert',
    'zertifikat',
    'arbeitsbewilligung',
    'vollzeit',
    'teilzeit',
    'pensum',
    'stundenlohn',
    'lavoro',
  ];
  const applicationSignalCount = strongApplicationSignals.filter((signal) => ` ${haystack} `.includes(signal)).length;
  const explicitApplicationCategory = ['bewerbung', 'job_application', 'application', 'candidate'].includes(explicitCategory);

  if (customerSignalCount >= 1 || customerTypeSignal) {
    return explicitApplicationForm && applicationSignalCount >= 1 && customerSignalCount === 0;
  }

  if (explicitApplicationForm) return true;
  if (explicitApplicationCategory && applicationSignalCount >= 1) return true;

  // Text-only fallback requires at least two independent application signals.
  return applicationSignalCount >= 2;
}

function getPersonName(row: RawRow): string {
  const firstName =
    getAnyDisplayValue(row, [
      'raw_first_name',
      'raw_form_data.first_name',
      'metadata.raw_form_data.first_name',
      'metadata.raw_payload.first_name',
      'contact.first_name',
      'opc_contacts.first_name',
    ]) || getMessageField(row, ['first_name', 'Vorname', 'Name']);

  const lastName =
    getAnyDisplayValue(row, [
      'raw_last_name',
      'raw_form_data.last_name',
      'metadata.raw_form_data.last_name',
      'metadata.raw_payload.last_name',
      'contact.last_name',
      'opc_contacts.last_name',
    ]) || getMessageField(row, ['last_name', 'Nachname']);

  return (
    getAnyDisplayValue(row, ['raw_full_name', 'enriched_client_display_name', 'client_display_name']) ||
    buildFullName(firstName, lastName) ||
    getAnyDisplayValue(row, ['contact.full_name', 'opc_contacts.full_name', 'full_name', 'contact_full_name', 'contact_name', 'name'])
  );
}

function getCompanyName(row: RawRow): string {
  return getAnyDisplayValue(row, [
    'raw_form_data.company',
    'metadata.raw_form_data.company',
    'company_name',
    'contact.company_name',
    'opc_contacts.company_name',
    'business_name',
    'billing_name',
  ]);
}

function getEmailValue(row: RawRow): string {
  return (
    getAnyValue(row, [
      'raw_email',
      'raw_form_data.email',
      'metadata.raw_form_data.email',
      'metadata.raw_payload.email',
      'email',
      'contact_email',
      'billing_email',
      'contact.email',
      'opc_contacts.email',
    ]) || getMessageField(row, ['email', 'E-Mail'])
  );
}

function getPhoneRawValue(row: RawRow): string {
  return (
    getAnyValue(row, [
      'raw_phone',
      'raw_form_data.phone',
      'metadata.raw_form_data.phone',
      'metadata.raw_payload.phone',
      'phone_raw',
      'phone',
      'contact_phone',
      'billing_phone',
      'contact.phone_raw',
      'opc_contacts.phone_raw',
    ]) || getMessageField(row, ['phone', 'Telefon'])
  );
}

function getPhoneE164Value(row: RawRow): string {
  return getAnyValue(row, ['phone_e164', 'billing_phone_e164', 'contact.phone_e164', 'opc_contacts.phone_e164']);
}

function getInquiryReason(row: RawRow): string {
  const service =
    getAnyDisplayValue(row, [
      'raw_reinigungsart',
      'enriched_service_category',
      'service_category',
      'service_requested',
      'requested_service',
      'service_type',
      'raw_form_data.Reinigungsart',
      'raw_form_data.reinigungsart',
      'metadata.raw_form_data.Reinigungsart',
      'metadata.raw_payload.Reinigungsart',
    ]) || getMessageField(row, ['Reinigungsart', 'service_category', 'service_type']);

  return service ? normalizeLabelValue(service) : 'Anfrage';
}

function getObjectType(row: RawRow): string {
  return normalizeLabelValue(
    getAnyDisplayValue(row, [
      'raw_living_space_type',
      'living_space_type',
      'object_type',
      'raw_form_data.living_space_type',
      'metadata.raw_form_data.living_space_type',
      'metadata.raw_payload.living_space_type',
    ]) || getMessageField(row, ['living_space_type', 'Objektart'])
  );
}

function getMessageValue(row: RawRow, keys: string[], fallbackPaths: string[]) {
  return getAnyDisplayValue(row, fallbackPaths) || getMessageField(row, keys);
}

function buildContactLine(email: string, phoneRaw: string, phoneE164: string): string {
  return [email, phoneE164 || phoneRaw].filter(Boolean).join(' · ');
}

function buildLocationLine(objectType: string, address: string, postalCode: string, city: string) {
  const zipCity = [postalCode, city].filter(Boolean).join(' ');
  if (address && zipCity) return [objectType, `${address}, ${zipCity}`].filter(Boolean).join(' · ');
  return [objectType, address, city].filter(Boolean).join(' · ');
}

async function readList<T>(table: string, limit = 300): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').limit(limit);

  if (error) {
    console.warn(`[Tickets] ${table} konnte nicht geladen werden:`, error.message);
    return [];
  }

  const rows = ((data || []) as RawRow[]).map((row) => ({ ...row }));
  const contactIds = Array.from(new Set(rows.map((row) => cleanValue(row.contact_id)).filter(Boolean)));

  if (!contactIds.length) return rows as T[];

  const { data: contacts, error: contactError } = await supabase
    .from('opc_contacts')
    .select('id, full_name, first_name, last_name, company_name, email, phone_raw, phone_e164, metadata')
    .in('id', contactIds);

  if (contactError) return rows as T[];

  const contactMap = new Map<string, RawRow>();
  ((contacts || []) as RawRow[]).forEach((contact) => {
    const id = cleanValue(contact.id);
    if (id) contactMap.set(id, contact);
  });

  return rows.map((row) => {
    const contact = contactMap.get(cleanValue(row.contact_id));
    return contact ? { ...row, contact, opc_contacts: contact } : row;
  }) as T[];
}

function buildJobMap(jobs: JobFeedRow[]) {
  const map = new Map<string, JobFeedRow>();
  jobs.forEach((job) => {
    if (job.job_id) map.set(String(job.job_id), job);
  });
  return map;
}

function mapInquiry(row: RawRow): PortalItem | null {
  const onboardingCaseId = getFirstValue(row, ['onboarding_case_id', 'case_id', 'id']);
  const inquiryId = getFirstValue(row, ['inquiry_id', 'customer_inquiry_id']);
  const contactId = getFirstValue(row, ['contact_id']);

  if (!onboardingCaseId && !inquiryId) return null;

  const status = getFirstValue(row, ['status', 'onboarding_status', 'inquiry_status', 'frontend_status'], 'new');
  const sourceLabel = getSourceLabel(row);
  const categoryLabel = getCategoryLabel(row);
  const reasonLabel = getInquiryReason(row);
  const objectTypeLabel = getObjectType(row);
  const roomCount = getMessageValue(row, ['room_count', 'Zimmer'], ['raw_room_count', 'room_count', 'rooms', 'raw_form_data.room_count', 'metadata.raw_form_data.room_count']);
  const surfaceLabel = getMessageValue(row, ['quadratmeter_surface', 'Fläche'], ['raw_quadratmeter_surface', 'quadratmeter_surface', 'surface', 'square_meters', 'raw_form_data.quadratmeter_surface', 'metadata.raw_form_data.quadratmeter_surface']);
  const floorLabel = getMessageValue(row, ['flat_count', 'Etage'], ['raw_flat_count', 'flat_count', 'floor', 'raw_form_data.flat_count', 'metadata.raw_form_data.flat_count']);
  const elevatorLabel = normalizeLabelValue(getMessageValue(row, ['elevator_status', 'Lift'], ['raw_elevator_status', 'elevator_status', 'raw_form_data.elevator_status', 'metadata.raw_form_data.elevator_status']));

  const personName = getPersonName(row);
  const companyName = getCompanyName(row);
  const email = getEmailValue(row);
  const phoneRaw = getPhoneRawValue(row);
  const phoneE164 = getPhoneE164Value(row);
  const phoneDisplay = phoneE164 || phoneRaw;
  const isCorporate = categoryLabel === 'Geschäftskunde';
  const clientName = (isCorporate ? companyName || personName : personName || companyName) || email || phoneDisplay || 'Unbekannte Anfrage';
  const contactName = personName || email || phoneDisplay || clientName;
  const addressText = getMessageValue(row, ['street_adress_client', 'street_address_client', 'Adresse'], ['raw_street', 'enriched_address_text', 'address_text', 'address', 'site_address', 'billing_address', 'raw_form_data.street_adress_client', 'raw_form_data.street_address_client', 'metadata.raw_form_data.street_adress_client', 'metadata.raw_payload.street_adress_client']);
  const postalCode = getMessageValue(row, ['zipcode_adress_client', 'zipcode_address_client', 'PLZ'], ['raw_zip', 'enriched_postal_code', 'postal_code', 'postcode', 'zip', 'raw_form_data.zipcode_adress_client', 'metadata.raw_form_data.zipcode_adress_client']);
  const city = getMessageValue(row, ['city_adress_client', 'city_address_client', 'location', 'Ort'], ['raw_city', 'enriched_city', 'city', 'site_city', 'raw_form_data.city_adress_client', 'metadata.raw_form_data.city_adress_client', 'raw_form_data.location', 'metadata.raw_form_data.location']);
  const formMessage = getMessageValue(row, ['message', 'Nachricht'], ['raw_message', 'raw_form_data.message', 'metadata.raw_form_data.message', 'metadata.raw_payload.message', 'message', 'original_message', 'message_summary']);

  const description = [sourceLabel, categoryLabel, reasonLabel && reasonLabel !== 'Anfrage' ? reasonLabel : '']
    .filter(Boolean)
    .join(' · ') || 'Anfrage';

  return {
    id: onboardingCaseId || inquiryId,
    type: 'inquiry',
    title: clientName,
    description,
    detailDescription: formMessage,
    status,
    statusGroup: getStatusGroup(status),
    clientName,
    contactName,
    email,
    phoneRaw,
    phoneE164,
    contactLine: buildContactLine(email, phoneRaw, phoneE164),
    siteName: objectTypeLabel,
    addressText,
    postalCode,
    city,
    country: getFirstValue(row, ['country'], 'CH'),
    locationLine: buildLocationLine(objectTypeLabel, addressText, postalCode, city),
    clientId: getFirstValue(row, ['client_id', 'converted_client_id']) || undefined,
    contactId: contactId || undefined,
    onboardingCaseId: onboardingCaseId || undefined,
    inquiryId: inquiryId || undefined,
    createdAt: getFirstValue(row, ['created_at', 'submitted_at', 'onboarding_created_at', 'case_created_at']) || null,
    updatedAt: getFirstValue(row, ['updated_at', 'last_activity_at', 'case_updated_at']) || null,
    priority: getFirstValue(row, ['priority'], 'normal'),
    isApplication: isApplicationInquiry(row),
    inquiryCategory: getInquiryCategory(row),
    sourceFormName: getFirstValue(row, ['source_form_name']),
    sourceLabel,
    clientTypeLabel: categoryLabel,
    reasonLabel,
    objectTypeLabel,
    roomCount,
    surfaceLabel,
    floorLabel,
    elevatorLabel,
    formMessage,
  };
}

function mapDamage(row: RawRow, jobMap: Map<string, JobFeedRow>): PortalItem | null {
  const id = getFirstValue(row, ['damage_report_id', 'report_id', 'id']);
  const jobId = getFirstValue(row, ['job_id', 'service_job_id']);
  const job = jobId ? jobMap.get(jobId) : undefined;

  if (!id && !jobId) return null;

  const status = getFirstValue(row, ['status', 'damage_status', 'report_status', 'state'], 'open');
  const title = getFirstValue(row, ['damage_title', 'title', 'subject'], 'Schaden gemeldet');
  const description = getFirstValue(row, ['description', 'damage_description', 'notes', 'message', 'summary']);
  const clientName = getFirstValue(row, ['billing_name', 'company_name', 'client_name'], getFirstValue(job, ['billing_name', 'company_name', 'full_name'], 'Ohne Kunde'));
  const addressText = getFirstValue(row, ['address_text', 'address'], getFirstValue(job, ['address_text']));
  const postalCode = getFirstValue(row, ['postal_code'], getFirstValue(job, ['postal_code']));
  const city = getFirstValue(row, ['city'], getFirstValue(job, ['city']));
  const siteName = getFirstValue(row, ['site_name'], getFirstValue(job, ['site_name']));
  const email = getFirstValue(row, ['email'], getFirstValue(job, ['email']));
  const phoneRaw = getFirstValue(row, ['phone_raw'], getFirstValue(job, ['phone_raw']));
  const phoneE164 = getFirstValue(row, ['phone_e164'], getFirstValue(job, ['phone_e164']));

  return {
    id: id || `damage-${jobId}`,
    type: 'damage',
    title,
    description,
    detailDescription: description,
    status,
    statusGroup: getStatusGroup(status),
    clientName,
    contactName: getFirstValue(row, ['contact_name', 'full_name']),
    email,
    phoneRaw,
    phoneE164,
    contactLine: buildContactLine(email, phoneRaw, phoneE164),
    siteName,
    addressText,
    postalCode,
    city,
    country: getFirstValue(row, ['country'], 'CH'),
    locationLine: [siteName, addressText, [postalCode, city].filter(Boolean).join(' ')].filter(Boolean).join(' · '),
    jobId: jobId || undefined,
    clientId: getFirstValue(row, ['client_id'], getFirstValue(job, ['client_id'])) || undefined,
    createdAt: getFirstValue(row, ['created_at', 'reported_at', 'damage_created_at'], getFirstValue(job, ['job_updated_at', 'job_created_at'])) || null,
    updatedAt: getFirstValue(row, ['updated_at', 'resolved_at']) || null,
    priority: getFirstValue(row, ['severity', 'priority'], getFirstValue(job, ['priority'], 'normal')),
  };
}

function mapJobDamageSummary(job: JobFeedRow): PortalItem | null {
  const count = Number(job.damage_count || 0);
  if (!job.job_id || count <= 0) return null;

  const status = job.report_status || job.status || 'open';
  const clientName = job.billing_name || job.company_name || job.full_name || 'Ohne Kunde';
  const locationLine = [job.site_name, job.address_text, [job.postal_code, job.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ');

  return {
    id: `job-damage-${job.job_id}`,
    type: 'job_damage',
    title: `${count} Schaden${count === 1 ? '' : 'smeldungen'} im Einsatz`,
    description: job.title || 'Einsatz mit gemeldeten Schäden',
    detailDescription: job.title || '',
    status,
    statusGroup: getStatusGroup(status),
    clientName,
    contactName: job.full_name || '',
    email: job.email || '',
    phoneRaw: job.phone_raw || '',
    phoneE164: job.phone_e164 || '',
    contactLine: buildContactLine(job.email || '', job.phone_raw || '', job.phone_e164 || ''),
    siteName: job.site_name || '',
    addressText: job.address_text || '',
    postalCode: job.postal_code || '',
    city: job.city || '',
    country: 'CH',
    locationLine,
    jobId: job.job_id,
    clientId: job.client_id,
    createdAt: job.job_updated_at || job.job_created_at || job.planned_start || null,
    updatedAt: job.job_updated_at || null,
    count,
    priority: job.priority || 'normal',
  };
}

function StatusBadge({ item }: { item: PortalItem }) {
  const group = item.statusGroup;
  const style =
    group === 'done'
      ? { bg: '#F0FDF4', text: BRAND.green, border: '#BBF7D0' }
      : group === 'in_progress'
        ? { bg: '#FFFBEB', text: BRAND.amber, border: '#FDE68A' }
        : { bg: '#F9FAFB', text: BRAND.muted, border: BRAND.border };

  return (
    <span className="opc-ticket-status" style={{ background: style.bg, color: style.text, borderColor: style.border }}>
      {getStatusLabel(item.status)}
    </span>
  );
}

function TypeBadge({ item }: { item: PortalItem }) {
  const isApplication = item.isApplication === true;

  return (
    <span className="opc-ticket-type">
      {isApplication ? <UserPlus size={13} /> : <MessageSquare size={13} />}
      {isApplication ? 'Bewerbung' : 'Anfrage'}
    </span>
  );
}

function MetricCard({ label, value, icon, tone = 'neutral' }: { label: string; value: number; icon: ReactNode; tone?: 'neutral' | 'danger' | 'warning' | 'success' }) {
  void tone;

  return (
    <div className="opc-ticket-metric" style={cardStyle}>
      <div>
        <div className="opc-ticket-metric-value">{value}</div>
        <div className="opc-ticket-metric-label">{label}</div>
      </div>
      <div className="opc-ticket-metric-icon">{icon}</div>
    </div>
  );
}

function EmptyState({ activeTab, hasFilters }: { activeTab: ActiveTab; hasFilters: boolean }) {
  const title =
    activeTab === 'applications'
      ? 'Keine Bewerbungen gefunden.'
      : activeTab === 'inquiries'
        ? 'Keine Kundenanfragen gefunden.'
        : 'Keine Anfragen gefunden.';

  return (
    <div className="opc-ticket-empty">
      <FolderOpen size={44} strokeWidth={1.5} color="#D1D5DB" />
      <h3>{title}</h3>
      <p>
        {hasFilters
          ? 'Passen Sie die Suche oder Filter an.'
          : 'Neue Anfragen und Bewerbungen erscheinen hier.'}
      </p>
    </div>
  );
}

function buildInitialConversionForm(item: PortalItem): ConversionForm {
  return {
    conversionMode: 'private',
    billingName: item.clientName || item.contactName || 'Neuer Kunde',
    fullName: item.contactName || item.clientName || '',
    companyName: '',
    email: item.email || '',
    phoneRaw: item.phoneRaw || item.phoneE164 || '',
    phoneE164: item.phoneE164 || item.phoneRaw || '',
    addressText: item.addressText || '',
    postalCode: item.postalCode || '',
    city: item.city || '',
    country: item.country || 'CH',
    siteName: item.siteName || item.clientName || 'Hauptstandort',
    internalNotes: item.detailDescription || item.description || '',
    allowDuplicate: false,
  };
}

function InquiryPreviewModal({ item, onClose, onConvert }: { item: PortalItem; onClose: () => void; onConvert: () => void }) {
  const isConverted = normalizeStatus(item.status) === 'converted';
  const canConvert = !isConverted && item.isApplication !== true;

  return (
    <div className="opc-modal-backdrop" role="dialog" aria-modal="true">
      <div className="opc-modal-card">
        <div className="opc-modal-head">
          <div>
            <StatusBadge item={item} />
            <h2>{item.title || 'Anfrage'}</h2>
            <p>{item.description || 'Anfrage'} · {formatDate(item.updatedAt || item.createdAt)}</p>
          </div>
          <button type="button" className="opc-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="opc-preview-grid">
          <PreviewBox label="Kunde / Firma" value={item.clientName} />
          <PreviewBox label="Kontaktperson" value={item.contactName} />
          <PreviewBox label="E-Mail" value={item.email} />
          <PreviewBox label="Telefon" value={item.phoneE164 || item.phoneRaw} />
          <PreviewBox label="Typ" value={item.clientTypeLabel} />
          <PreviewBox label="Reinigungsart" value={item.reasonLabel || item.description} />
          <PreviewBox label="Standort" value={[item.objectTypeLabel || item.siteName, item.surfaceLabel ? `${item.surfaceLabel} m²` : '', item.roomCount ? `${item.roomCount} Zimmer` : '', item.floorLabel ? `Etage ${item.floorLabel}` : '', item.elevatorLabel].filter(Boolean).join(' · ')} />
          <PreviewBox label="Adresse" value={item.addressText ? [item.addressText, [item.postalCode, item.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') : ''} />
        </div>

        <div className="opc-preview-message">
          <span>Beschreibung / Nachricht</span>
          <p>{item.detailDescription || item.formMessage || 'Keine zusätzliche Nachricht vorhanden.'}</p>
        </div>

        <div className="opc-modal-actions">
          <button type="button" className="opc-btn-light" onClick={onClose}>Schliessen</button>
          {canConvert ? <button type="button" className="opc-btn-dark" onClick={onConvert}>Als Kunde übernehmen</button> : null}
        </div>
      </div>
    </div>
  );
}

function PreviewBox({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="opc-preview-box">
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  );
}

function ConversionModal({ item, form, setForm, submitting, errorMessage, conflictMessage, onClose, onSubmit }: { item: PortalItem; form: ConversionForm; setForm: (next: ConversionForm) => void; submitting: boolean; errorMessage: string; conflictMessage: string; onClose: () => void; onSubmit: () => void }) {
  const update = (key: keyof ConversionForm, value: string | boolean) => setForm({ ...form, [key]: value });

  return (
    <div className="opc-modal-backdrop" role="dialog" aria-modal="true">
      <div className="opc-modal-card large">
        <div className="opc-modal-head">
          <div>
            <h2>Anfrage als Kunde übernehmen</h2>
            <p>{item.title} · {item.clientName}</p>
          </div>
          <button type="button" className="opc-modal-close" onClick={onClose} disabled={submitting}><X size={18} /></button>
        </div>

        <div className="opc-conversion-type-grid">
          <button type="button" className={form.conversionMode === 'private' ? 'active' : ''} onClick={() => update('conversionMode', 'private')}>
            <strong>Privatkunde / interner Kontakt</strong>
            <span>Wird intern gespeichert. Kein Portal-Login wird erstellt.</span>
          </button>
          <button type="button" className={form.conversionMode === 'corporate' ? 'active' : ''} onClick={() => update('conversionMode', 'corporate')}>
            <strong>Corporate-Kunde mit Portalzugang</strong>
            <span>Bereitet den Client-Portal-Zugang vor.</span>
          </button>
        </div>

        <div className="opc-conversion-grid">
          <label>Rechnungsname / Kunde<input value={form.billingName} onChange={(event) => update('billingName', event.target.value)} /></label>
          <label>Kontaktperson<input value={form.fullName} onChange={(event) => update('fullName', event.target.value)} /></label>
          <label>Firma<input value={form.companyName} onChange={(event) => update('companyName', event.target.value)} /></label>
          <label>E-Mail<input value={form.email} onChange={(event) => update('email', event.target.value)} /></label>
          <label>Telefon<input value={form.phoneRaw} onChange={(event) => { const next = event.target.value; setForm({ ...form, phoneRaw: next, phoneE164: next }); }} /></label>
          <label>Standortname<input value={form.siteName} onChange={(event) => update('siteName', event.target.value)} /></label>
          <label>Adresse<input value={form.addressText} onChange={(event) => update('addressText', event.target.value)} /></label>
          <div className="opc-conversion-zip-city">
            <label>PLZ<input value={form.postalCode} onChange={(event) => update('postalCode', event.target.value)} /></label>
            <label>Stadt<input value={form.city} onChange={(event) => update('city', event.target.value)} /></label>
          </div>
          <label className="full">Interne Notiz<textarea value={form.internalNotes} onChange={(event) => update('internalNotes', event.target.value)} /></label>
        </div>

        {conflictMessage ? (
          <div className="opc-conflict-box">
            {conflictMessage}
            <label><input type="checkbox" checked={form.allowDuplicate} onChange={(event) => update('allowDuplicate', event.target.checked)} /> Trotzdem als neuen Kunden erstellen</label>
          </div>
        ) : null}

        {errorMessage ? <div className="opc-inline-error">{errorMessage}</div> : null}

        <div className="opc-modal-actions">
          <button type="button" className="opc-btn-light" onClick={onClose} disabled={submitting}>Abbrechen</button>
          <button type="button" className="opc-btn-dark" onClick={onSubmit} disabled={submitting || !form.billingName.trim()}>
            {submitting ? 'Wird übernommen...' : 'Kunde erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TicketsPageTranslated() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [items, setItems] = useState<PortalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const didLoadRef = useRef(false);

  const [selectedInquiry, setSelectedInquiry] = useState<PortalItem | null>(null);
  const [conversionForm, setConversionForm] = useState<ConversionForm | null>(null);
  const [conversionSubmitting, setConversionSubmitting] = useState(false);
  const [conversionError, setConversionError] = useState('');
  const [conversionConflict, setConversionConflict] = useState('');
  const [selectedInquiryPreview, setSelectedInquiryPreview] = useState<PortalItem | null>(null);

  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;

    const cachedItems = readOpcPageCache<PortalItem[]>(REQUESTS_PAGE_CACHE_KEY);

    if (cachedItems) {
      setItems(cachedItems);
      setLoading(false);
      void loadItems({ background: true });
      return;
    }

    void loadItems();
  }, []);

  async function loadItems(options: { background?: boolean } = {}) {
    const isBackground = Boolean(options.background);
    if (!isBackground) setLoading(true);
    setErrorMessage('');

    try {
      const inquiriesData = await readList<RawRow>('opc_portal_onboarding_cards', 5000);
      const inquiryItems = inquiriesData.map(mapInquiry).filter(Boolean) as PortalItem[];

      const merged = inquiryItems.sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });

      setItems(merged);
      writeOpcPageCache<PortalItem[]>(REQUESTS_PAGE_CACHE_KEY, merged);
    } catch (error: any) {
      console.error('Anfragen konnten nicht geladen werden:', error);
      setErrorMessage(error?.message || 'Anfragen konnten nicht geladen werden.');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }

  const metrics = useMemo(() => {
    const inquiries = items.filter((item) => item.type === 'inquiry');
    const customerInquiries = inquiries.filter((item) => !item.isApplication);
    const applications = inquiries.filter((item) => item.isApplication);

    return {
      allOpen: inquiries.filter((item) => item.statusGroup !== 'done').length,
      inquiriesOpen: customerInquiries.filter((item) => item.statusGroup !== 'done').length,
      applicationsOpen: applications.filter((item) => item.statusGroup !== 'done').length,
      done: inquiries.filter((item) => item.statusGroup === 'done').length,
    };
  }, [items]);

  const tabItems = useMemo(() => {
    return items.filter((item) => {
      if (item.type !== 'inquiry') return false;
      if (activeTab === 'applications') return item.isApplication === true;
      if (activeTab === 'inquiries') return item.isApplication !== true;
      return true;
    });
  }, [activeTab, items]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return tabItems.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.statusGroup === statusFilter;
      const matchesType =
        typeFilter === 'all' ||
        (typeFilter === 'application' ? item.isApplication === true : item.isApplication !== true);
      if (!matchesStatus || !matchesType) return false;
      if (!query) return true;

      return [
        item.title,
        item.description,
        item.detailDescription,
        item.clientName,
        item.contactName,
        item.email,
        item.phoneRaw,
        item.phoneE164,
        item.siteName,
        item.addressText,
        item.postalCode,
        item.city,
        item.locationLine,
        getStatusLabel(item.status),
        typeLabels[item.type],
        item.isApplication ? 'Bewerbung' : 'Kundenanfrage',
      ].join(' ').toLowerCase().includes(query);
    });
  }, [tabItems, searchQuery, statusFilter, typeFilter]);

  const hasFilters = Boolean(searchQuery || statusFilter !== 'all' || typeFilter !== 'all');

  function openInquiryPreview(item: PortalItem) {
    setSelectedInquiryPreview(item);
  }

  function openConversion(item: PortalItem) {
    setSelectedInquiry(item);
    setConversionForm(buildInitialConversionForm(item));
    setConversionError('');
    setConversionConflict('');
  }

  function closeConversion() {
    if (conversionSubmitting) return;
    setSelectedInquiry(null);
    setConversionForm(null);
    setConversionError('');
    setConversionConflict('');
  }

  function openItem(item: PortalItem) {
    if (item.type === 'inquiry') {
      openInquiryPreview(item);
      return;
    }

    if (item.jobId) {
      window.location.href = `${baseUrl}/einsatz/${item.jobId}`;
      return;
    }

    if (item.clientId) {
      window.location.href = `${baseUrl}/kunde/${item.clientId}`;
    }
  }

  async function submitConversion() {
    if (!selectedInquiry || !conversionForm) return;

    setConversionSubmitting(true);
    setConversionError('');
    setConversionConflict('');

    try {
      const response = await fetch('/api/opc/convert-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiryId: selectedInquiry.inquiryId,
          onboardingCaseId: selectedInquiry.onboardingCaseId,
          contactId: selectedInquiry.contactId,
          conversionMode: conversionForm.conversionMode,
          billingName: conversionForm.billingName,
          fullName: conversionForm.fullName,
          companyName: conversionForm.companyName,
          email: conversionForm.email,
          phoneRaw: conversionForm.phoneRaw,
          phoneE164: conversionForm.phoneE164,
          addressText: conversionForm.addressText,
          postalCode: conversionForm.postalCode,
          city: conversionForm.city,
          country: conversionForm.country,
          siteName: conversionForm.siteName,
          internalNotes: conversionForm.internalNotes,
          allowDuplicate: conversionForm.allowDuplicate,
        }),
      });

      const result = (await response.json()) as any;

      if (response.status === 409) {
        setConversionConflict(result?.message || 'Ein ähnlicher Kunde existiert bereits.');
        return;
      }

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Kunde konnte nicht erstellt werden.');
      }

      setSuccessMessage(
        conversionForm.conversionMode === 'corporate'
          ? 'Corporate-Kunde wurde erstellt. Der Portalzugang ist vorbereitet.'
          : 'Kunde wurde intern erstellt. Es wurde kein Portalzugang angelegt.',
      );

      closeConversion();
      await loadItems();

      if (result.clientId) {
        window.location.href = `${baseUrl}/kunde/${result.clientId}`;
      }
    } catch (error: any) {
      setConversionError(error?.message || 'Kunde konnte nicht erstellt werden.');
    } finally {
      setConversionSubmitting(false);
    }
  }

  if (loading) return <PortalSkeleton variant="table" />;

  return (
    <div className="opc-requests-page" style={{ fontFamily: pageFont, color: BRAND.text }}>
      <div className="opc-requests-tabs">
        <button
          type="button"
          className={activeTab === 'all' ? 'active' : ''}
          onClick={() => {
            setActiveTab('all');
            setTypeFilter('all');
          }}
        >
          Alle Anfragen
        </button>
        <button
          type="button"
          className={activeTab === 'inquiries' ? 'active' : ''}
          onClick={() => {
            setActiveTab('inquiries');
            setTypeFilter('inquiry');
          }}
        >
          Kundenanfragen
        </button>
        <button
          type="button"
          className={activeTab === 'applications' ? 'active' : ''}
          onClick={() => {
            setActiveTab('applications');
            setTypeFilter('application');
          }}
        >
          Bewerbungen
        </button>
      </div>

      <div className="opc-requests-metrics">
        <MetricCard value={metrics.allOpen} label="Offene Anfragen" icon={<MessageSquare size={18} />} />
        <MetricCard value={metrics.inquiriesOpen} label="Kundenanfragen" icon={<MessageSquare size={18} />} />
        <MetricCard value={metrics.applicationsOpen} label="Bewerbungen" icon={<UserPlus size={18} />} tone={metrics.applicationsOpen > 0 ? 'warning' : 'neutral'} />
        <MetricCard value={metrics.done} label="Erledigt" icon={<CheckCircle2 size={18} />} tone="success" />
      </div>

      <section className="opc-requests-filter-card" style={cardStyle}>
        <div className="opc-requests-controls">
          <div className="opc-requests-search">
            <Search size={17} />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Suche nach Name, E-Mail, Telefon, Anfrage oder Bewerbung"
            />
          </div>

          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="all">Alle Status</option>
            <option value="open">Offen</option>
            <option value="in_progress">In Bearbeitung</option>
            <option value="done">Erledigt</option>
          </select>

          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}>
            <option value="all">Alle Typen</option>
            <option value="inquiry">Kundenanfragen</option>
            <option value="application">Bewerbungen</option>
          </select>

          <a href={`${baseUrl}/kunden`} data-astro-prefetch="false">
            <Wrench size={17} />
            Kunden öffnen
          </a>
        </div>
      </section>

      {successMessage ? <div className="opc-success-card">{successMessage}</div> : null}
      {errorMessage ? <div className="opc-error-card">{errorMessage}</div> : null}

      {filteredItems.length === 0 ? (
        <section className="opc-requests-empty-card" style={cardStyle}>
          <EmptyState activeTab={activeTab} hasFilters={hasFilters} />
        </section>
      ) : (
        <div className="opc-requests-list">
          {filteredItems.map((item) => (
            <button key={`${item.type}-${item.id}`} type="button" className="opc-request-row" style={cardStyle} onClick={() => openItem(item)}>
              <div className="opc-request-card-main">
                <div className="opc-request-card-copy">
                  <h3>{item.title}</h3>

                  <div className="opc-request-meta">
                    <span>{typeLabels[item.type]}</span>
                    <span>{formatDate(item.updatedAt || item.createdAt)}</span>
                    <span>{item.contactLine || item.clientName || '—'}</span>
                    <span>{item.locationLine || [item.siteName, item.addressText, item.city].filter(Boolean).join(', ') || 'Standort nicht hinterlegt'}</span>
                  </div>
                </div>

                <div className="opc-request-card-side">
                  <StatusBadge item={item} />
                </div>
              </div>

              <div className="opc-request-card-footer">
                <TypeBadge item={item} />
              </div>

              <div className="opc-request-card-actions">
                <span className="opc-request-action dark">Details öffnen</span>
                <span className="opc-request-action">
                  {item.isApplication
                    ? 'Bewerbung ansehen'
                    : normalizeStatus(item.status) !== 'converted'
                      ? 'Kunde übernehmen'
                      : 'Anfrage ansehen'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {filteredItems.length > 0 ? <div className="opc-count-line">{filteredItems.length} von {tabItems.length} Einträgen</div> : null}

      {selectedInquiryPreview ? (
        <InquiryPreviewModal
          item={selectedInquiryPreview}
          onClose={() => setSelectedInquiryPreview(null)}
          onConvert={() => {
            const item = selectedInquiryPreview;
            setSelectedInquiryPreview(null);
            openConversion(item);
          }}
        />
      ) : null}

      {selectedInquiry && conversionForm ? (
        <ConversionModal
          item={selectedInquiry}
          form={conversionForm}
          setForm={setConversionForm}
          submitting={conversionSubmitting}
          errorMessage={conversionError}
          conflictMessage={conversionConflict}
          onClose={closeConversion}
          onSubmit={submitConversion}
        />
      ) : null}

      <style>{`
        .opc-requests-page,
        .opc-requests-page * {
          box-sizing: border-box;
        }

        .opc-requests-page {
          width: 100%;
          padding: 0 0 140px;
          font-family: ${pageFont};
        }

        .opc-requests-tabs {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 14px;
        }

        .opc-requests-tabs button {
          min-height: 46px;
          border-radius: 14px;
          border: 1px solid ${BRAND.border};
          background: #FFFFFF;
          color: ${BRAND.muted};
          font-family: ${pageFont};
          font-size: 13px;
          font-weight: 820;
          cursor: pointer;
          white-space: nowrap;
        }

        .opc-requests-tabs button.active {
          border-color: ${BRAND.black};
          background: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-requests-metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }

        .opc-ticket-metric {
          min-height: 96px;
          padding: 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .opc-ticket-metric-value {
          font-size: 25px;
          line-height: 1;
          font-weight: 820;
          letter-spacing: -0.04em;
          color: ${BRAND.text};
          margin-bottom: 10px;
        }

        .opc-ticket-metric-label {
          font-size: 13px;
          font-weight: 720;
          color: ${BRAND.muted};
        }

        .opc-ticket-metric-icon {
          width: 38px;
          height: 38px;
          border-radius: 13px;
          border: 1px solid ${BRAND.border};
          background: #FAFAFA;
          color: ${BRAND.black};
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
        }

        .opc-requests-filter-card {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          padding: 16px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          align-items: stretch;
          margin-bottom: 18px;
          overflow: visible;
        }

        .opc-requests-controls {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          align-items: stretch;
          width: 100%;
          min-width: 0;
        }

        .opc-requests-search {
          grid-column: 1 / -1;
          width: 100%;
          min-width: 0;
          height: 46px;
          border: 1px solid ${BRAND.border};
          border-radius: 14px;
          background: #FFFFFF;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 12px;
          color: ${BRAND.muted};
        }

        .opc-requests-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          color: ${BRAND.text};
          font-size: 14px;
          font-weight: 650;
          font-family: ${pageFont};
        }

        .opc-requests-search input::placeholder {
          color: #9CA3AF;
          font-weight: 700;
        }

        .opc-requests-controls select,
        .opc-requests-controls a {
          width: 100%;
          min-width: 0;
          height: 46px;
          min-height: 46px;
          border: 1px solid ${BRAND.border};
          border-radius: 14px;
          color: ${BRAND.text};
          padding: 0 14px;
          font-size: 13px;
          font-weight: 820;
          font-family: ${pageFont};
          outline: 0;
          box-sizing: border-box;
        }

        .opc-requests-controls select {
          appearance: none;
          -webkit-appearance: none;
          background-color: #FFFFFF;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M5 7.5L10 12.5L15 7.5' stroke='%23111827' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
          background-size: 14px 14px;
          padding: 0 42px 0 14px;
          line-height: 46px;
        }

        .opc-requests-controls a {
          grid-column: 1 / -1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          text-decoration: none;
          font-weight: 820;
        }

        .opc-requests-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .opc-request-row {
          width: 100%;
          min-width: 0;
          padding: 18px;
          border: 1px solid ${BRAND.border};
          background: #FFFFFF;
          color: ${BRAND.text};
          font-family: ${pageFont};
          text-align: left;
          cursor: pointer;
        }

        .opc-request-card-main {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 18px;
          align-items: start;
        }

        .opc-request-card-copy {
          min-width: 0;
        }

        .opc-request-card-copy h3 {
          margin: 0;
          color: ${BRAND.text};
          font-size: 20px;
          line-height: 1.18;
          letter-spacing: -0.04em;
          font-weight: 860;
        }

        .opc-request-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          margin-top: 9px;
          color: ${BRAND.muted};
          font-size: 13px;
          line-height: 1.35;
          font-weight: 650;
        }

        .opc-request-meta span {
          display: inline-flex;
          align-items: center;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
        }

        .opc-request-card-side {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: flex-start;
          gap: 8px;
        }

        .opc-request-card-footer {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }

        .opc-request-card-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 16px;
        }

        .opc-request-action {
          width: 100%;
          min-width: 0;
          min-height: 42px;
          border-radius: 13px;
          border: 1px solid ${BRAND.border};
          background: #FFFFFF;
          color: ${BRAND.text};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 14px;
          font-size: 13px;
          font-weight: 760;
          font-family: ${pageFont};
          text-decoration: none;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .opc-request-action.dark {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-ticket-status,
        .opc-ticket-type,
        .opc-open-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          white-space: nowrap;
          font-size: 12px;
          font-weight: 760;
          border: 1px solid;
        }

        .opc-ticket-status {
          min-width: 98px;
          height: 28px;
          padding: 0 12px;
        }

        .opc-ticket-type {
          width: max-content;
          height: 27px;
          gap: 6px;
          padding: 0 10px;
          background: #FFFFFF;
          color: ${BRAND.muted};
          border-color: ${BRAND.border};
        }

        .opc-open-pill {
          height: 30px;
          padding: 0 11px;
          color: #FFFFFF;
          border-color: ${BRAND.black};
          background: ${BRAND.black};
        }

        .opc-request-date,
        .opc-request-actions,
        .opc-request-main,
        .opc-request-contact {
          display: none;
        }

        .opc-requests-empty-card {
          overflow: hidden;
        }

        .opc-ticket-empty {
          padding: 70px 22px;
          text-align: center;
          display: grid;
          place-items: center;
          gap: 8px;
        }

        .opc-ticket-empty h3 {
          margin: 6px 0 0;
          font-size: 17px;
          font-weight: 760;
          color: ${BRAND.text};
        }

        .opc-ticket-empty p {
          margin: 0;
          color: ${BRAND.muted};
          font-size: 14px;
          font-weight: 560;
        }

        .opc-success-card,
        .opc-error-card,
        .opc-inline-error,
        .opc-conflict-box {
          margin-bottom: 14px;
          padding: 13px 14px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 650;
          line-height: 1.5;
        }

        .opc-success-card {
          border: 1px solid #BBF7D0;
          background: #F0FDF4;
          color: ${BRAND.green};
        }

        .opc-error-card,
        .opc-inline-error {
          border: 1px solid #FCA5A5;
          background: #FEF2F2;
          color: #991B1B;
        }

        .opc-conflict-box {
          border: 1px solid #FDE68A;
          background: #FFFBEB;
          color: ${BRAND.amber};
          display: grid;
          gap: 10px;
        }

        .opc-conflict-box label {
          display: flex;
          align-items: center;
          gap: 8px;
          color: ${BRAND.text};
          font-weight: 720;
        }

        .opc-count-line {
          margin-top: 15px;
          font-size: 13px;
          font-weight: 620;
          color: ${BRAND.muted};
        }

        .opc-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(15, 17, 21, 0.42);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 22px;
        }

        .opc-modal-card {
          width: 100%;
          max-width: 720px;
          max-height: 90vh;
          overflow: auto;
          background: #FFFFFF;
          border: 1px solid ${BRAND.border};
          border-radius: 24px;
          box-shadow: 0 24px 80px rgba(15, 17, 21, 0.22);
          padding: 24px;
          font-family: ${pageFont};
        }

        .opc-modal-card.large {
          max-width: 760px;
        }

        .opc-modal-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
          padding-bottom: 18px;
          margin-bottom: 18px;
          border-bottom: 1px solid ${BRAND.border};
        }

        .opc-modal-head h2 {
          margin: 10px 0 7px;
          font-size: 24px;
          font-weight: 820;
          letter-spacing: -0.035em;
          color: ${BRAND.text};
        }

        .opc-modal-head p {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: ${BRAND.muted};
          line-height: 1.5;
        }

        .opc-modal-close {
          width: 38px;
          height: 38px;
          border-radius: 13px;
          border: 1px solid ${BRAND.border};
          background: #FFFFFF;
          color: ${BRAND.text};
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex: 0 0 auto;
        }

        .opc-preview-grid,
        .opc-conversion-grid,
        .opc-conversion-type-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .opc-preview-grid,
        .opc-conversion-type-grid {
          margin-bottom: 20px;
        }

        .opc-preview-box,
        .opc-preview-message,
        .opc-conversion-type-grid button {
          border: 1px solid ${BRAND.border};
          border-radius: 16px;
          background: #FFFFFF;
          padding: 14px;
        }

        .opc-preview-box span,
        .opc-preview-message span {
          display: block;
          font-size: 11px;
          font-weight: 800;
          color: ${BRAND.muted};
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 7px;
        }

        .opc-preview-box strong {
          display: block;
          font-size: 14px;
          font-weight: 760;
          color: ${BRAND.text};
          line-height: 1.4;
          word-break: break-word;
        }

        .opc-preview-message {
          background: #FAFAFA;
          margin-bottom: 20px;
        }

        .opc-preview-message p {
          margin: 8px 0 0;
          color: ${BRAND.text};
          font-size: 14px;
          font-weight: 600;
          line-height: 1.65;
          white-space: pre-wrap;
        }

        .opc-conversion-type-grid button {
          text-align: left;
          cursor: pointer;
          font-family: ${pageFont};
        }

        .opc-conversion-type-grid button.active {
          border-color: ${BRAND.black};
          background: #FAFAFA;
        }

        .opc-conversion-type-grid strong,
        .opc-conversion-type-grid span {
          display: block;
        }

        .opc-conversion-type-grid strong {
          font-size: 14px;
          font-weight: 820;
          color: ${BRAND.text};
          margin-bottom: 6px;
        }

        .opc-conversion-type-grid span {
          font-size: 12px;
          font-weight: 600;
          color: ${BRAND.muted};
          line-height: 1.5;
        }

        .opc-conversion-grid label {
          display: grid;
          gap: 7px;
          color: ${BRAND.text};
          font-size: 12px;
          font-weight: 760;
        }

        .opc-conversion-grid label.full {
          grid-column: 1 / -1;
        }

        .opc-conversion-grid input,
        .opc-conversion-grid textarea {
          width: 100%;
          border: 1px solid ${BRAND.border};
          border-radius: 13px;
          background: #FFFFFF;
          color: ${BRAND.text};
          outline: none;
          font-size: 14px;
          font-weight: 560;
          font-family: ${pageFont};
          box-sizing: border-box;
        }

        .opc-conversion-grid input {
          height: 46px;
          padding: 0 13px;
        }

        .opc-conversion-grid textarea {
          min-height: 92px;
          padding: 12px 13px;
          resize: vertical;
          line-height: 1.5;
        }

        .opc-conversion-zip-city {
          display: grid;
          grid-template-columns: 120px minmax(0, 1fr);
          gap: 12px;
        }

        .opc-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 20px;
        }

        .opc-btn-light,
        .opc-btn-dark {
          height: 44px;
          padding: 0 16px;
          border-radius: 13px;
          font-family: ${pageFont};
          font-size: 14px;
          font-weight: 720;
          cursor: pointer;
        }

        .opc-btn-light {
          border: 1px solid ${BRAND.border};
          background: #FFFFFF;
          color: ${BRAND.text};
        }

        .opc-btn-dark {
          border: 1px solid ${BRAND.black};
          background: ${BRAND.black};
          color: #FFFFFF;
        }

        @media (max-width: 720px) {
          .opc-requests-page {
            padding-bottom: 110px;
          }

          .opc-requests-metrics {
            gap: 12px;
          }

          .opc-ticket-metric {
            min-height: 96px;
            padding: 18px;
          }

          .opc-ticket-metric-value {
            font-size: 25px;
          }

          .opc-ticket-metric-label {
            font-size: 13px;
          }

          .opc-ticket-metric-icon {
            display: flex;
          }

          .opc-requests-controls {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .opc-requests-controls a {
            grid-column: 1 / -1;
          }

          .opc-request-row {
            padding: 15px;
            border-radius: 18px !important;
          }

          .opc-request-card-main {
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 12px;
          }

          .opc-request-card-copy h3 {
            font-size: 18px;
          }

          .opc-request-meta {
            gap: 5px;
          }

          .opc-request-meta span {
            width: 100%;
          }

          .opc-ticket-status {
            min-width: 0;
          }

          .opc-request-card-actions {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }

          .opc-request-action {
            min-height: 42px;
            padding: 0 8px;
            font-size: 12px;
          }

          .opc-modal-card {
            padding: 18px;
            border-radius: 22px;
          }

          .opc-preview-grid,
          .opc-conversion-grid,
          .opc-conversion-type-grid {
            grid-template-columns: 1fr;
          }

          .opc-conversion-zip-city {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
