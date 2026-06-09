import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import PortalSkeleton from './shared/PortalSkeleton';
import { readOpcPageCache, writeOpcPageCache } from '../lib/opc-page-cache';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FolderOpen,
  MessageSquare,
  Plus,
  Search,
  ShieldAlert,
  UserPlus,
  Wrench,
  X,
} from 'lucide-react';

const REQUESTS_PAGE_CACHE_KEY = 'opc:page-cache:requests:v5';

type ActiveTab = 'inquiries' | 'damages';
type ItemType = 'inquiry' | 'damage' | 'job_damage';
type StatusFilter = 'all' | 'open' | 'in_progress' | 'done';
type TypeFilter = 'all' | ItemType;
type ConversionMode = 'private' | 'corporate';

interface RawRow {
  [key: string]: any;
}

interface PortalItem {
  id: string;
  type: ItemType;
  title: string;
  description: string;
  status: string;
  statusGroup: StatusFilter;
  clientName: string;
  contactName: string;
  email: string;
  phoneRaw: string;
  phoneE164: string;
  siteName: string;
  addressText: string;
  postalCode: string;
  city: string;
  country: string;
  jobId?: string;
  clientId?: string;
  contactId?: string;
  onboardingCaseId?: string;
  inquiryId?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  count?: number;
  priority?: string;
  inquiryType?: string;
  inquiryTypeLabel?: string;
  serviceLabel?: string;
  listSubtitle?: string;
  contactLine?: string;
  addressLine?: string;
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
  borderStrong: '#D1D5DB',
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

const selectStyle: CSSProperties = {
  width: '100%',
  height: '48px',
  padding: '0 13px',
  borderRadius: '14px',
  border: `1px solid ${BRAND.border}`,
  background: '#FFFFFF',
  color: BRAND.text,
  outline: 'none',
  fontSize: '14px',
  fontWeight: 620,
  fontFamily: pageFont,
  boxSizing: 'border-box',
};

const inputStyle: CSSProperties = {
  width: '100%',
  height: '46px',
  padding: '0 13px',
  borderRadius: '13px',
  border: `1px solid ${BRAND.border}`,
  background: '#FFFFFF',
  color: BRAND.text,
  outline: 'none',
  fontSize: '14px',
  fontWeight: 560,
  fontFamily: pageFont,
  boxSizing: 'border-box',
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

function getFirstValue(row: RawRow | undefined, keys: string[], fallback = '') {
  if (!row) return fallback;

  for (const key of keys) {
    const value = row[key];

    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value);
    }
  }

  return fallback;
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

function buildJobMap(jobs: JobFeedRow[]) {
  const map = new Map<string, JobFeedRow>();

  jobs.forEach((job) => {
    if (job.job_id) {
      map.set(String(job.job_id), job);
    }
  });

  return map;
}

async function readList<T>(table: string, limit = 300): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').limit(limit);

  if (error) {
    console.warn(`[Anfragen & Schäden] ${table} konnte nicht geladen werden:`, error.message);
    return [];
  }

  const rows = ((data || []) as RawRow[]).map((row) => ({ ...row }));

  const emailKeys = [
    'email',
    'contact_email',
    'billing_email',
    'metadata.raw_form_data.email',
    'metadata.email_method_result.raw_value',
    'metadata.email_method_result.normalized_value',
  ];

  const phoneKeys = [
    'phone_raw',
    'phone',
    'contact_phone',
    'billing_phone',
    'billing_phone_e164',
    'phone_e164',
    'metadata.raw_form_data.phone',
    'metadata.phone_method_result.raw_value',
    'metadata.phone_method_result.normalized_value',
  ];

  const contactIds = uniqueCleanValues(rows.map((row) => getDeepFirstValue(row, ['contact_id'])));
  const emails = uniqueCleanValues(rows.map((row) => getDeepFirstValue(row, emailKeys)));
  const phones = uniqueCleanValues(rows.flatMap((row) => buildPhoneLookupValues(getDeepFirstValue(row, phoneKeys))));

  const contactResults: RawRow[] = [];

  if (contactIds.length > 0) {
    const { data: contactsById, error: contactIdError } = await supabase
      .from('opc_contacts')
      .select('id, full_name, first_name, last_name, company_name, email, phone_raw, phone_e164, metadata')
      .in('id', contactIds);

    if (contactIdError) {
      console.warn('[Anfragen & Schäden] opc_contacts by id konnte nicht geladen werden:', contactIdError.message);
    } else {
      contactResults.push(...((contactsById || []) as RawRow[]));
    }
  }

  if (emails.length > 0) {
    const { data: contactsByEmail, error: contactEmailError } = await supabase
      .from('opc_contacts')
      .select('id, full_name, first_name, last_name, company_name, email, phone_raw, phone_e164, metadata')
      .in('email', emails);

    if (contactEmailError) {
      console.warn('[Anfragen & Schäden] opc_contacts by email konnte nicht geladen werden:', contactEmailError.message);
    } else {
      contactResults.push(...((contactsByEmail || []) as RawRow[]));
    }
  }

  if (phones.length > 0) {
    const { data: contactsByPhoneRaw, error: contactPhoneRawError } = await supabase
      .from('opc_contacts')
      .select('id, full_name, first_name, last_name, company_name, email, phone_raw, phone_e164, metadata')
      .in('phone_raw', phones);

    if (contactPhoneRawError) {
      console.warn('[Anfragen & Schäden] opc_contacts by phone_raw konnte nicht geladen werden:', contactPhoneRawError.message);
    } else {
      contactResults.push(...((contactsByPhoneRaw || []) as RawRow[]));
    }

    const { data: contactsByPhoneE164, error: contactPhoneE164Error } = await supabase
      .from('opc_contacts')
      .select('id, full_name, first_name, last_name, company_name, email, phone_raw, phone_e164, metadata')
      .in('phone_e164', phones);

    if (contactPhoneE164Error) {
      console.warn('[Anfragen & Schäden] opc_contacts by phone_e164 konnte nicht geladen werden:', contactPhoneE164Error.message);
    } else {
      contactResults.push(...((contactsByPhoneE164 || []) as RawRow[]));
    }
  }

  const contactMapById = new Map<string, RawRow>();
  const contactMapByEmail = new Map<string, RawRow>();
  const contactMapByPhone = new Map<string, RawRow>();

  uniqueRowsById(contactResults).forEach((contact) => {
    const id = cleanValue(contact.id);
    const email = cleanValue(contact.email).toLowerCase();
    const phoneRawValues = buildPhoneLookupValues(contact.phone_raw);
    const phoneE164Values = buildPhoneLookupValues(contact.phone_e164);

    if (id) contactMapById.set(id, contact);
    if (email) contactMapByEmail.set(email, contact);

    [...phoneRawValues, ...phoneE164Values].forEach((phone) => {
      if (phone) contactMapByPhone.set(phone, contact);
    });
  });

  const rowsWithContacts = rows.map((row) => {
    const contact =
      contactMapById.get(cleanValue(row.contact_id)) ||
      contactMapByEmail.get(getDeepFirstValue(row, emailKeys).toLowerCase()) ||
      findContactByPhone(contactMapByPhone, getDeepFirstValue(row, phoneKeys));

    return mergeContactIntoRow(row, contact);
  });

  const inquiryIds = uniqueCleanValues(
    rowsWithContacts.flatMap((row) => [
      getDeepFirstValue(row, ['inquiry_id', 'customer_inquiry_id']),
      table === 'opc_inquiries' ? cleanValue(row.id) : '',
    ])
  ).filter(isUuidLike);

  const sourceExternalIds = uniqueCleanValues(
    rowsWithContacts.map((row) => getDeepFirstValue(row, ['source_external_id', 'external_id']))
  );

  const enrichedContactIds = uniqueCleanValues(rowsWithContacts.map((row) => getDeepFirstValue(row, ['contact_id'])));

  const inquiryResults: RawRow[] = [];

  if (inquiryIds.length > 0) {
    const { data: inquiriesById, error: inquiryIdError } = await supabase
      .from('opc_inquiries')
      .select('*')
      .in('id', inquiryIds);

    if (inquiryIdError) {
      console.warn('[Anfragen & Schäden] opc_inquiries by id konnte nicht geladen werden:', inquiryIdError.message);
    } else {
      inquiryResults.push(...((inquiriesById || []) as RawRow[]));
    }
  }

  if (sourceExternalIds.length > 0) {
    const { data: inquiriesByExternalId, error: inquiryExternalError } = await supabase
      .from('opc_inquiries')
      .select('*')
      .in('source_external_id', sourceExternalIds);

    if (inquiryExternalError) {
      console.warn('[Anfragen & Schäden] opc_inquiries by source_external_id konnte nicht geladen werden:', inquiryExternalError.message);
    } else {
      inquiryResults.push(...((inquiriesByExternalId || []) as RawRow[]));
    }
  }

  if (enrichedContactIds.length > 0) {
    const { data: inquiriesByContact, error: inquiryContactError } = await supabase
      .from('opc_inquiries')
      .select('*')
      .in('contact_id', enrichedContactIds)
      .order('created_at', { ascending: false })
      .limit(500);

    if (inquiryContactError) {
      console.warn('[Anfragen & Schäden] opc_inquiries by contact_id konnte nicht geladen werden:', inquiryContactError.message);
    } else {
      inquiryResults.push(...((inquiriesByContact || []) as RawRow[]));
    }
  }

  const uniqueInquiries = uniqueRowsById(inquiryResults);
  const inquiryMapById = new Map<string, RawRow>();
  const inquiryMapByExternalId = new Map<string, RawRow>();
  const inquiryMapByContactId = new Map<string, RawRow>();

  uniqueInquiries.forEach((inquiry) => {
    const id = cleanValue(inquiry.id);
    const externalId = cleanValue(inquiry.source_external_id);
    const contactId = cleanValue(inquiry.contact_id);

    if (id) inquiryMapById.set(id, inquiry);
    if (externalId) inquiryMapByExternalId.set(externalId, inquiry);
    if (contactId && !inquiryMapByContactId.has(contactId)) {
      inquiryMapByContactId.set(contactId, inquiry);
    }
  });

  const enrichedRows = rowsWithContacts.map((row) => {
    const inquiry =
      inquiryMapById.get(getDeepFirstValue(row, ['inquiry_id', 'customer_inquiry_id'])) ||
      (table === 'opc_inquiries' ? inquiryMapById.get(cleanValue(row.id)) : undefined) ||
      inquiryMapByExternalId.get(getDeepFirstValue(row, ['source_external_id', 'external_id'])) ||
      inquiryMapByContactId.get(getDeepFirstValue(row, ['contact_id']));

    return mergeInquiryIntoRow(row, inquiry);
  });

  return enrichedRows as T[];
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function cleanValue(value: unknown): string {
  if (value === null || value === undefined) return '';

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';

    const lower = trimmed.toLowerCase();
    if (
      lower === 'null' ||
      lower === 'undefined' ||
      lower === 'n/a' ||
      lower === 'none' ||
      lower === '-' ||
      lower === 'unknown'
    ) {
      return '';
    }

    return trimmed;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }

  return '';
}

function cleanDisplayValue(value: unknown): string {
  const cleaned = cleanValue(value);
  if (!cleaned) return '';

  const lower = cleaned.toLowerCase();
  if (
    lower === 'unbekannte anfrage' ||
    lower === 'ohne kunde' ||
    lower === 'neuer kunde' ||
    lower === 'anfrage'
  ) {
    return '';
  }

  return cleaned;
}

function getNestedValue(source: unknown, path: string): string {
  if (!isPlainObject(source)) return '';

  const parts = path.split('.');
  let current: any = source;

  for (const part of parts) {
    if (!isPlainObject(current) && !Array.isArray(current)) return '';
    current = current?.[part];
  }

  return cleanValue(current);
}

function getDeepFirstValue(row: RawRow | undefined, paths: string[], fallback = ''): string {
  if (!row) return fallback;

  for (const path of paths) {
    const value = path.includes('.') ? getNestedValue(row, path) : cleanValue(row?.[path]);
    if (value) return value;
  }

  return fallback;
}

function getDeepFirstDisplayValue(row: RawRow | undefined, paths: string[], fallback = ''): string {
  if (!row) return fallback;

  for (const path of paths) {
    const rawValue = path.includes('.') ? getNestedValue(row, path) : cleanValue(row?.[path]);
    const value = cleanDisplayValue(rawValue);
    if (value) return value;
  }

  return fallback;
}

function uniqueCleanValues(values: unknown[]): string[] {
  return Array.from(new Set(values.map(cleanValue).filter(Boolean)));
}

function uniqueRowsById(rows: RawRow[]): RawRow[] {
  const map = new Map<string, RawRow>();

  rows.forEach((row, index) => {
    const id = cleanValue(row.id) || `row-${index}`;
    if (!map.has(id)) map.set(id, row);
  });

  return Array.from(map.values());
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function buildPhoneLookupValues(value: unknown): string[] {
  const raw = cleanValue(value);
  if (!raw) return [];

  const compact = raw.replace(/\s+/g, '');
  const digits = compact.replace(/[^\d]/g, '');

  return uniqueCleanValues([
    raw,
    compact,
    digits,
    digits ? `+${digits}` : '',
  ]);
}

function findContactByPhone(contactMapByPhone: Map<string, RawRow>, value: unknown): RawRow | undefined {
  const values = buildPhoneLookupValues(value);

  for (const phone of values) {
    const contact = contactMapByPhone.get(phone);
    if (contact) return contact;
  }

  return undefined;
}

function mergeContactIntoRow(row: RawRow, contact?: RawRow): RawRow {
  if (!contact) return row;

  const firstName = cleanDisplayValue(contact.first_name);
  const lastName = cleanDisplayValue(contact.last_name);
  const fullName =
    cleanDisplayValue(contact.full_name) ||
    [firstName, lastName].filter(Boolean).join(' ').trim();

  const companyName = cleanDisplayValue(contact.company_name);
  const email = cleanValue(contact.email);
  const phoneRaw = cleanValue(contact.phone_raw);
  const phoneE164 = cleanValue(contact.phone_e164);

  const existingMetadata = isPlainObject(row.metadata) ? row.metadata : {};

  return {
    ...row,
    contact,
    opc_contacts: contact,

    contact_id: cleanValue(row.contact_id) || cleanValue(contact.id),

    full_name: cleanDisplayValue(row.full_name) || fullName,
    contact_full_name: cleanDisplayValue(row.contact_full_name) || fullName,
    contact_name: cleanDisplayValue(row.contact_name) || fullName,
    applicant_name: cleanDisplayValue(row.applicant_name) || fullName,
    name: cleanDisplayValue(row.name) || fullName,

    first_name: cleanDisplayValue(row.first_name) || firstName,
    contact_first_name: cleanDisplayValue(row.contact_first_name) || firstName,
    last_name: cleanDisplayValue(row.last_name) || lastName,
    contact_last_name: cleanDisplayValue(row.contact_last_name) || lastName,

    company_name: cleanDisplayValue(row.company_name) || companyName,
    contact_company_name: cleanDisplayValue(row.contact_company_name) || companyName,
    business_name: cleanDisplayValue(row.business_name) || companyName,

    email: cleanValue(row.email) || email,
    contact_email: cleanValue(row.contact_email) || email,

    phone_raw: cleanValue(row.phone_raw) || phoneRaw,
    phone: cleanValue(row.phone) || phoneRaw,
    contact_phone: cleanValue(row.contact_phone) || phoneRaw,
    phone_e164: cleanValue(row.phone_e164) || phoneE164,

    metadata: {
      ...existingMetadata,
      contact: {
        ...(isPlainObject(existingMetadata.contact) ? existingMetadata.contact : {}),
        id: cleanValue(contact.id),
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        company_name: companyName,
        email,
        phone_raw: phoneRaw,
        phone_e164: phoneE164,
      },
    },
  };
}

function mergeInquiryIntoRow(row: RawRow, inquiry?: RawRow): RawRow {
  if (!inquiry) return row;

  const rowMetadata = isPlainObject(row.metadata) ? row.metadata : {};
  const inquiryMetadata = isPlainObject(inquiry.metadata) ? inquiry.metadata : {};
  const topLevelRawFormData = isPlainObject(row.raw_form_data) ? row.raw_form_data : {};
  const rowRawFormData = isPlainObject(rowMetadata.raw_form_data) ? rowMetadata.raw_form_data : {};
  const inquiryRawFormData = isPlainObject(inquiryMetadata.raw_form_data) ? inquiryMetadata.raw_form_data : {};
  const rawFormData = {
    ...topLevelRawFormData,
    ...rowRawFormData,
    ...inquiryRawFormData,
  };

  const firstName = cleanDisplayValue(rawFormData.first_name);
  const lastName = cleanDisplayValue(rawFormData.last_name);
  const rawFullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  const rawEmail = cleanValue(rawFormData.email);
  const rawPhone = cleanValue(rawFormData.phone);
  const rawService = cleanDisplayValue(rawFormData.Reinigungsart || rawFormData.reinigungsart || rawFormData.cleaning_type);
  const rawLivingSpace = cleanDisplayValue(rawFormData.living_space_type);
  const rawStreet = cleanDisplayValue(rawFormData.street_adress_client || rawFormData.street_address_client);
  const rawZip = cleanDisplayValue(rawFormData.zipcode_adress_client || rawFormData.zipcode_address_client);
  const rawCity = cleanDisplayValue(rawFormData.city_adress_client || rawFormData.city_address_client);
  const rawMessage = cleanDisplayValue(rawFormData.message);

  return {
    ...row,

    inquiry,
    opc_inquiries: inquiry,

    inquiry_id: cleanValue(row.inquiry_id) || cleanValue(row.customer_inquiry_id) || cleanValue(inquiry.id),
    customer_inquiry_id: cleanValue(row.customer_inquiry_id) || cleanValue(row.inquiry_id) || cleanValue(inquiry.id),
    contact_id: cleanValue(row.contact_id) || cleanValue(inquiry.contact_id),

    inquiry_type: cleanValue(row.inquiry_type) || cleanValue(inquiry.inquiry_type),
    source_channel: cleanValue(row.source_channel) || cleanValue(inquiry.source_channel),
    source_form_name: cleanValue(row.source_form_name) || cleanValue(inquiry.source_form_name),
    source_external_id: cleanValue(row.source_external_id) || cleanValue(inquiry.source_external_id),
    source_page_url: cleanValue(row.source_page_url) || cleanValue(inquiry.source_page_url),

    title: cleanDisplayValue(row.title) || rawService || cleanDisplayValue(inquiry.service_category) || rawFullName,
    case_title: cleanDisplayValue(row.case_title) || rawService || rawFullName,
    inquiry_title: cleanDisplayValue(row.inquiry_title) || rawService || rawFullName,
    subject: cleanDisplayValue(row.subject) || rawService || rawFullName,

    full_name: cleanDisplayValue(row.full_name) || rawFullName,
    contact_full_name: cleanDisplayValue(row.contact_full_name) || rawFullName,
    contact_name: cleanDisplayValue(row.contact_name) || rawFullName,
    applicant_name: cleanDisplayValue(row.applicant_name) || rawFullName,
    name: cleanDisplayValue(row.name) || rawFullName,

    first_name: cleanDisplayValue(row.first_name) || firstName,
    contact_first_name: cleanDisplayValue(row.contact_first_name) || firstName,
    last_name: cleanDisplayValue(row.last_name) || lastName,
    contact_last_name: cleanDisplayValue(row.contact_last_name) || lastName,

    email: cleanValue(row.email) || rawEmail,
    contact_email: cleanValue(row.contact_email) || rawEmail,

    phone_raw: cleanValue(row.phone_raw) || rawPhone,
    phone: cleanValue(row.phone) || rawPhone,
    contact_phone: cleanValue(row.contact_phone) || rawPhone,
    phone_e164: cleanValue(row.phone_e164) || cleanValue(inquiry.phone_e164),

    service_category: cleanDisplayValue(row.service_category) || rawService || cleanDisplayValue(inquiry.service_category),
    service_requested: cleanDisplayValue(row.service_requested) || rawService,
    requested_service: cleanDisplayValue(row.requested_service) || rawService,
    service_type: cleanDisplayValue(row.service_type) || rawService,

    living_space_type: cleanDisplayValue(row.living_space_type) || rawLivingSpace,
    room_count: cleanDisplayValue(row.room_count) || cleanDisplayValue(rawFormData.room_count),
    flat_count: cleanDisplayValue(row.flat_count) || cleanDisplayValue(rawFormData.flat_count),
    quadratmeter_surface: cleanDisplayValue(row.quadratmeter_surface) || cleanDisplayValue(rawFormData.quadratmeter_surface),
    elevator_status: cleanDisplayValue(row.elevator_status) || cleanDisplayValue(rawFormData.elevator_status),

    address_text: cleanDisplayValue(row.address_text) || cleanDisplayValue(inquiry.address_text) || rawStreet,
    postal_code: cleanDisplayValue(row.postal_code) || cleanDisplayValue(inquiry.postal_code) || rawZip,
    city: cleanDisplayValue(row.city) || cleanDisplayValue(inquiry.city) || rawCity,

    message: cleanDisplayValue(row.message) || rawMessage || cleanDisplayValue(inquiry.original_message),
    description: cleanDisplayValue(row.description) || rawMessage || cleanDisplayValue(inquiry.message_summary),
    request_summary: cleanDisplayValue(row.request_summary) || rawMessage || cleanDisplayValue(inquiry.message_summary),
    summary: cleanDisplayValue(row.summary) || rawMessage || cleanDisplayValue(inquiry.message_summary),

    original_message: cleanValue(row.original_message) || cleanValue(inquiry.original_message),
    message_summary: cleanValue(row.message_summary) || cleanValue(inquiry.message_summary),

    metadata: {
      ...rowMetadata,
      ...inquiryMetadata,
      raw_form_data: rawFormData,
      inquiry: {
        id: cleanValue(inquiry.id),
        status: cleanValue(inquiry.status),
        inquiry_type: cleanValue(inquiry.inquiry_type),
        source_channel: cleanValue(inquiry.source_channel),
        source_form_name: cleanValue(inquiry.source_form_name),
        source_external_id: cleanValue(inquiry.source_external_id),
      },
    },
  };
}

function parseKeyValueMessage(value: unknown): Record<string, string> {
  const text = cleanValue(value);
  if (!text) return {};

  return text.split(/\r?\n/).reduce<Record<string, string>>((acc, line) => {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) return acc;

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (key) acc[key] = rawValue;
    return acc;
  }, {});
}

function getMessageField(row: RawRow, keys: string[]): string {
  const parsedOriginal = parseKeyValueMessage(row?.original_message);
  const parsedSummary = parseKeyValueMessage(row?.message_summary);

  for (const key of keys) {
    const value = cleanValue(parsedOriginal[key]) || cleanValue(parsedSummary[key]);
    if (value) return value;
  }

  return '';
}

function normalizeLabelValue(value: string): string {
  const normalized = cleanValue(value);
  const key = normalized.toLowerCase();

  const map: Record<string, string> = {
    haus: 'Haus',
    house: 'Haus',
    wohnung: 'Wohnung',
    apartment: 'Wohnung',
    flat: 'Wohnung',
    office: 'Büro',
    buero: 'Büro',
    büro: 'Büro',
    yes_elevator: 'Lift vorhanden',
    no_elevator: 'Kein Lift',
    elevator: 'Lift vorhanden',
    yes: 'Ja',
    no: 'Nein',
    true: 'Ja',
    false: 'Nein',
    privatkunden: 'Privatkunde',
    privatkunde: 'Privatkunde',
    private: 'Privatkunde',
    geschaeftskunden: 'Geschäftskunde',
    geschäftskunden: 'Geschäftskunde',
    baukunden: 'Baukunde',
  };

  return map[key] || normalized;
}

function buildContactNameFromRaw(row: RawRow): string {
  const firstName =
    getDeepFirstDisplayValue(row, [
      'raw_first_name',
      'first_name',
      'contact_first_name',
      'metadata.raw_form_data.first_name',
      'metadata.form_data.first_name',
      'metadata.raw.first_name',
      'metadata.contact.first_name',
      'contact.first_name',
      'opc_contacts.first_name',
    ]) ||
    getMessageField(row, ['first_name', 'Vorname']);

  const lastName =
    getDeepFirstDisplayValue(row, [
      'raw_last_name',
      'last_name',
      'contact_last_name',
      'metadata.raw_form_data.last_name',
      'metadata.form_data.last_name',
      'metadata.raw.last_name',
      'metadata.contact.last_name',
      'contact.last_name',
      'opc_contacts.last_name',
    ]) ||
    getMessageField(row, ['last_name', 'Nachname']);

  return [firstName, lastName].filter(Boolean).join(' ').trim();
}

function buildInquiryDescription(row: RawRow): string {
  const formName = getDeepFirstDisplayValue(row, [
    'source_form_name',
    'form_name',
    'metadata.source_form_name',
    'metadata.email_method_result.metadata.form_name',
    'metadata.phone_method_result.metadata.form_name',
  ]);

  const service =
    getDeepFirstDisplayValue(row, [
      'raw_reinigungsart',
      'raw_service_category',
      'raw_cleaning_type',
      'raw_form_data.Reinigungsart',
      'raw_form_data.reinigungsart',
      'raw_form_data.cleaning_type',
      'raw_reinigungsart',
      'raw_service_category',
      'raw_cleaning_type',
      'raw_form_data.Reinigungsart',
      'raw_form_data.reinigungsart',
      'raw_form_data.cleaning_type',
      'service_requested',
      'service_category',
      'requested_service',
      'service_type',
      'metadata.raw_form_data.Reinigungsart',
      'metadata.raw_form_data.reinigungsart',
      'metadata.raw_form_data.cleaning_type',
    ]) ||
    getMessageField(row, ['Reinigungsart', 'service_type', 'service_category']);

  const livingSpaceType =
    getDeepFirstDisplayValue(row, [
      'raw_living_space_type',
      'raw_living_space_type',
      'raw_form_data.living_space_type',
      'living_space_type',
      'metadata.raw_form_data.living_space_type',
      'metadata.form_data.living_space_type',
    ]) ||
    getMessageField(row, ['living_space_type']);

  const surface =
    getDeepFirstDisplayValue(row, [
      'quadratmeter_surface',
      'surface',
      'square_meters',
      'metadata.raw_form_data.quadratmeter_surface',
    ]) ||
    getMessageField(row, ['quadratmeter_surface']);

  const roomCount =
    getDeepFirstDisplayValue(row, [
      'raw_room_count',
      'raw_form_data.room_count',
      'room_count',
      'rooms',
      'metadata.raw_form_data.room_count',
    ]) ||
    getMessageField(row, ['room_count']);

  const flatCount =
    getDeepFirstDisplayValue(row, [
      'raw_flat_count',
      'raw_form_data.flat_count',
      'flat_count',
      'apartments',
      'floor',
      'metadata.raw_form_data.flat_count',
    ]) ||
    getMessageField(row, ['flat_count']);

  const elevatorStatus =
    getDeepFirstDisplayValue(row, [
      'raw_elevator_status',
      'raw_form_data.elevator_status',
      'elevator_status',
      'metadata.raw_form_data.elevator_status',
    ]) ||
    getMessageField(row, ['elevator_status']);

  const addressText = getDeepFirstDisplayValue(row, [
    'raw_street',
    'raw_address_text',
    'address_text',
    'address',
    'site_address',
    'billing_address',
    'metadata.raw_form_data.street_adress_client',
    'metadata.raw_form_data.street_address_client',
  ]);

  const postalCode = getDeepFirstDisplayValue(row, [
    'raw_zip',
    'raw_postal_code',
    'postal_code',
    'postcode',
    'zip',
    'metadata.raw_form_data.zipcode_adress_client',
    'metadata.raw_form_data.zipcode_address_client',
  ]);

  const city = getDeepFirstDisplayValue(row, [
    'raw_city',
    'city',
    'site_city',
    'metadata.raw_form_data.city_adress_client',
    'metadata.raw_form_data.city_address_client',
  ]);

  const explicitMessage =
    getDeepFirstDisplayValue(row, [
      'raw_message',
      'raw_form_data.message',
      'message',
      'notes',
      'summary',
      'description',
      'request_summary',
      'metadata.raw_form_data.message',
      'metadata.form_data.message',
    ]) ||
    getMessageField(row, ['message', 'Nachricht']);

  const addressLine = [addressText, [postalCode, city].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  const lines = [
    formName ? `Formular: ${formName}` : '',
    service ? `Reinigungsart: ${normalizeLabelValue(service)}` : '',
    livingSpaceType ? `Objekttyp: ${normalizeLabelValue(livingSpaceType)}` : '',
    surface ? `Fläche: ${surface} m²` : '',
    roomCount ? `Zimmer: ${roomCount}` : '',
    flatCount ? `Etage / Wohnung: ${flatCount}` : '',
    elevatorStatus ? `Lift: ${normalizeLabelValue(elevatorStatus)}` : '',
    addressLine ? `Adresse: ${addressLine}` : '',
    explicitMessage ? `Nachricht: ${explicitMessage}` : '',
  ].filter(Boolean);

  return lines.join('\n');
}

function mapInquiry(row: RawRow): PortalItem | null {
  const onboardingCaseId = getFirstValue(row, ['onboarding_case_id', 'case_id', 'id']);
  const inquiryId = getFirstValue(row, ['inquiry_id', 'customer_inquiry_id']);
  const contactId = getFirstValue(row, ['contact_id']);

  if (!onboardingCaseId && !inquiryId) return null;

  const status = getFirstValue(
    row,
    ['status', 'onboarding_status', 'inquiry_status', 'frontend_status'],
    'new'
  );

  const clientTypeRaw = getDeepFirstDisplayValue(row, [
    'client_type',
    'inquiry_type',
    'type',
    'form_type',
    'metadata.inquiry.inquiry_type',
    'metadata.raw_form_data.client_type',
  ]);

  const inquiryType = clientTypeRaw || getDeepFirstDisplayValue(row, ['source_channel'], 'Anfrage');
  const inquiryTypeLabel = normalizeLabelValue(inquiryType) || 'Anfrage';

  const companyName = getDeepFirstDisplayValue(row, [
    'company_name',
    'contact_company_name',
    'billing_name',
    'business_name',
    'contact.company_name',
    'opc_contacts.company_name',
    'metadata.contact.company_name',
    'metadata.raw_form_data.company_name',
    'metadata.raw_form_data.business_name',
  ]);

  const clientDisplayName = getDeepFirstDisplayValue(row, [
    'enriched_client_display_name',
    'client_display_name',
    'raw_full_name',
    'customer_display_name',
    'display_name',
    'thread_subject',
  ]);

  const rawContactName = buildContactNameFromRaw(row);

  const fullName =
    getDeepFirstDisplayValue(row, [
      'raw_full_name',
      'full_name',
      'contact_full_name',
      'contact_name',
      'applicant_name',
      'name',
      'contact.full_name',
      'opc_contacts.full_name',
      'metadata.contact.full_name',
      'metadata.contact_name',
      'metadata.raw_form_data.full_name',
      'metadata.raw_form_data.name',
    ]) ||
    rawContactName ||
    clientDisplayName;

  const serviceRaw =
    getDeepFirstDisplayValue(row, [
      'raw_reinigungsart',
      'raw_service_category',
      'raw_cleaning_type',
      'raw_form_data.Reinigungsart',
      'raw_form_data.reinigungsart',
      'raw_form_data.cleaning_type',
      'service_requested',
      'service_category',
      'requested_service',
      'service_type',
      'metadata.raw_form_data.Reinigungsart',
      'metadata.raw_form_data.reinigungsart',
      'metadata.raw_form_data.cleaning_type',
    ]) ||
    getMessageField(row, ['Reinigungsart', 'service_type', 'service_category']);

  const serviceLabel = normalizeLabelValue(serviceRaw) || 'Anfrage';

  const email =
    getDeepFirstValue(row, [
      'email',
      'contact_email',
      'billing_email',
      'contact.email',
      'opc_contacts.email',
      'metadata.raw_form_data.email',
      'metadata.form_data.email',
      'metadata.email_method_result.raw_value',
      'metadata.email_method_result.normalized_value',
    ]) ||
    getMessageField(row, ['email', 'E-Mail']);

  const phoneRaw =
    getDeepFirstValue(row, [
      'phone_raw',
      'phone',
      'contact_phone',
      'billing_phone',
      'billing_phone_e164',
      'contact.phone_raw',
      'opc_contacts.phone_raw',
      'metadata.raw_form_data.phone',
      'metadata.form_data.phone',
      'metadata.phone_method_result.raw_value',
    ]) ||
    getMessageField(row, ['phone', 'Telefon']);

  const phoneE164 = getDeepFirstValue(row, [
    'phone_e164',
    'billing_phone_e164',
    'contact.phone_e164',
    'opc_contacts.phone_e164',
    'metadata.phone_method_result.normalized_value',
  ]);

  const livingSpaceType =
    getDeepFirstDisplayValue(row, [
      'raw_living_space_type',
      'raw_form_data.living_space_type',
      'living_space_type',
      'metadata.raw_form_data.living_space_type',
    ]) ||
    getMessageField(row, ['living_space_type']);

  const siteName =
    getDeepFirstDisplayValue(row, ['site_name', 'location_name']) ||
    normalizeLabelValue(livingSpaceType);

  const addressText =
    getDeepFirstDisplayValue(row, [
      'raw_street',
      'raw_address_text',
      'raw_form_data.street_adress_client',
      'raw_form_data.street_address_client',
      'address_text',
      'address',
      'site_address',
      'billing_address',
      'metadata.raw_form_data.street_address_client',
      'metadata.raw_form_data.street_adress_client',
    ]) ||
    getMessageField(row, ['street_address_client', 'street_adress_client', 'address_text']);

  const postalCode =
    getDeepFirstDisplayValue(row, [
      'raw_zip',
      'raw_postal_code',
      'raw_form_data.zipcode_adress_client',
      'raw_form_data.zipcode_address_client',
      'postal_code',
      'postcode',
      'zip',
      'metadata.raw_form_data.zipcode_address_client',
      'metadata.raw_form_data.zipcode_adress_client',
    ]) ||
    getMessageField(row, ['zipcode_address_client', 'zipcode_adress_client', 'postal_code']);

  const city =
    getDeepFirstDisplayValue(row, [
      'raw_city',
      'raw_form_data.city_adress_client',
      'raw_form_data.city_address_client',
      'city',
      'site_city',
      'metadata.raw_form_data.city_address_client',
      'metadata.raw_form_data.city_adress_client',
    ]) ||
    getMessageField(row, ['city_address_client', 'city_adress_client', 'city']);

  const phoneDisplay = phoneE164 || phoneRaw;
  const contactLine = [email, phoneDisplay].filter(Boolean).join(' · ');
  const cityLine = [postalCode, city].filter(Boolean).join(' ').trim();
  const addressLine = [addressText, cityLine].filter(Boolean).join(', ');

  const contactName = fullName || clientDisplayName || email || phoneDisplay || '';
  const clientName =
    companyName ||
    contactName ||
    clientDisplayName ||
    email ||
    phoneDisplay ||
    'Unbekannte Anfrage';

  const listName = contactName || clientName;
  const listSubtitle = [serviceLabel, inquiryTypeLabel].filter(Boolean).join(' · ');
  const description = buildInquiryDescription(row);

  return {
    id: onboardingCaseId || inquiryId,
    type: 'inquiry',
    title: listName || clientName || 'Anfrage',
    description,
    status,
    statusGroup: getStatusGroup(status),
    clientName,
    contactName: contactName || clientName,
    email,
    phoneRaw,
    phoneE164,
    siteName,
    addressText,
    postalCode,
    city,
    country: getFirstValue(row, ['country'], 'CH'),
    clientId: getFirstValue(row, ['client_id', 'converted_client_id']) || undefined,
    contactId: contactId || undefined,
    onboardingCaseId: onboardingCaseId || undefined,
    inquiryId: inquiryId || undefined,
    createdAt:
      getFirstValue(row, ['created_at', 'submitted_at', 'onboarding_created_at', 'case_created_at']) || null,
    updatedAt: getFirstValue(row, ['updated_at', 'last_activity_at', 'case_updated_at']) || null,
    priority: getFirstValue(row, ['priority'], 'normal'),
    inquiryType,
    inquiryTypeLabel,
    serviceLabel,
    listSubtitle,
    contactLine,
    addressLine,
  };
}


function mapDamage(row: RawRow, jobMap: Map<string, JobFeedRow>): PortalItem | null {
  const id = getFirstValue(row, ['damage_report_id', 'report_id', 'id']);
  const jobId = getFirstValue(row, ['job_id', 'service_job_id']);
  const job = jobId ? jobMap.get(jobId) : undefined;

  if (!id && !jobId) return null;

  const status = getFirstValue(row, ['status', 'damage_status', 'report_status', 'state'], 'open');

  return {
    id: id || `damage-${jobId}`,
    type: 'damage',
    title: getFirstValue(row, ['damage_title', 'title', 'subject'], 'Schaden gemeldet'),
    description: getFirstValue(row, ['description', 'damage_description', 'notes', 'message', 'summary']),
    status,
    statusGroup: getStatusGroup(status),
    clientName: getFirstValue(
      row,
      ['billing_name', 'company_name', 'client_name'],
      getFirstValue(job, ['billing_name', 'company_name', 'full_name'], 'Ohne Kunde')
    ),
    contactName: getFirstValue(row, ['contact_name', 'full_name']),
    email: getFirstValue(row, ['email'], getFirstValue(job, ['email'])),
    phoneRaw: getFirstValue(row, ['phone_raw'], getFirstValue(job, ['phone_raw'])),
    phoneE164: getFirstValue(row, ['phone_e164'], getFirstValue(job, ['phone_e164'])),
    siteName: getFirstValue(row, ['site_name'], getFirstValue(job, ['site_name'])),
    addressText: getFirstValue(row, ['address_text', 'address'], getFirstValue(job, ['address_text'])),
    postalCode: getFirstValue(row, ['postal_code'], getFirstValue(job, ['postal_code'])),
    city: getFirstValue(row, ['city'], getFirstValue(job, ['city'])),
    country: getFirstValue(row, ['country'], 'CH'),
    jobId: jobId || undefined,
    clientId: getFirstValue(row, ['client_id'], getFirstValue(job, ['client_id'])) || undefined,
    createdAt:
      getFirstValue(row, ['created_at', 'reported_at', 'damage_created_at'], getFirstValue(job, ['job_updated_at', 'job_created_at'])) ||
      null,
    updatedAt: getFirstValue(row, ['updated_at', 'resolved_at']) || null,
    priority: getFirstValue(row, ['severity', 'priority'], getFirstValue(job, ['priority'], 'normal')),
  };
}

function mapJobDamageSummary(job: JobFeedRow): PortalItem | null {
  const damageCount = Number(job.damage_count || 0);

  if (!job.job_id || damageCount <= 0) return null;

  const status = job.report_status || job.status || 'open';

  return {
    id: `job-damage-${job.job_id}`,
    type: 'job_damage',
    title: `${damageCount} Schaden${damageCount === 1 ? '' : 'smeldungen'} im Einsatz`,
    description: job.title || job.service_category || 'Einsatz mit gemeldeten Schäden',
    status,
    statusGroup: getStatusGroup(status),
    clientName: job.billing_name || job.company_name || job.full_name || 'Ohne Kunde',
    contactName: job.full_name || '',
    email: job.email || '',
    phoneRaw: job.phone_raw || '',
    phoneE164: job.phone_e164 || '',
    siteName: job.site_name || '',
    addressText: job.address_text || '',
    postalCode: job.postal_code || '',
    city: job.city || '',
    country: 'CH',
    jobId: job.job_id,
    clientId: job.client_id,
    createdAt: job.job_updated_at || job.job_created_at || job.planned_start || null,
    updatedAt: job.job_updated_at || null,
    count: damageCount,
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
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '118px',
        height: '28px',
        padding: '0 12px',
        borderRadius: '999px',
        border: `1px solid ${style.border}`,
        background: style.bg,
        color: style.text,
        fontSize: '12px',
        fontWeight: 760,
        whiteSpace: 'nowrap',
      }}
    >
      {getStatusLabel(item.status)}
    </span>
  );
}

function TypeBadge({ type }: { type: ItemType }) {
  const icon =
    type === 'damage' || type === 'job_damage' ? (
      <ShieldAlert size={13} />
    ) : (
      <MessageSquare size={13} />
    );

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        height: '27px',
        padding: '0 10px',
        borderRadius: '999px',
        border: `1px solid ${BRAND.border}`,
        background: '#FFFFFF',
        color: BRAND.muted,
        fontSize: '11px',
        fontWeight: 760,
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {typeLabels[type]}
    </span>
  );
}

function MetricCard({
  label,
  value,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone?: 'neutral' | 'danger' | 'warning' | 'success';
}) {
  const valueColor =
    tone === 'danger'
      ? BRAND.red
      : tone === 'warning'
        ? BRAND.amber
        : tone === 'success'
          ? BRAND.green
          : BRAND.text;

  return (
    <div
      style={{
        ...cardStyle,
        minHeight: '112px',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
      }}
    >
      <div>
        <div
          style={{
            fontSize: '26px',
            lineHeight: 1,
            fontWeight: 820,
            letterSpacing: '-0.04em',
            color: valueColor,
            marginBottom: '12px',
          }}
        >
          {value}
        </div>

        <div
          style={{
            fontSize: '13px',
            fontWeight: 720,
            color: BRAND.muted,
          }}
        >
          {label}
        </div>
      </div>

      <div
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '13px',
          border: `1px solid ${BRAND.border}`,
          background: '#FAFAFA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: BRAND.black,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
    </div>
  );
}

function EmptyState({ activeTab, hasFilters }: { activeTab: ActiveTab; hasFilters: boolean }) {
  return (
    <div
      style={{
        padding: '78px 22px',
        textAlign: 'center',
      }}
    >
      <FolderOpen size={50} strokeWidth={1.5} color="#D1D5DB" style={{ marginBottom: '18px' }} />

      <h3
        style={{
          margin: '0 0 8px',
          fontSize: '17px',
          fontWeight: 760,
          color: BRAND.text,
        }}
      >
        {activeTab === 'inquiries' ? 'Keine Anfragen gefunden' : 'Keine Schäden gefunden'}
      </h3>

      <p
        style={{
          margin: '0 0 22px',
          fontSize: '14px',
          fontWeight: 560,
          color: BRAND.muted,
        }}
      >
        {hasFilters
          ? 'Passen Sie die Suche oder Filter an.'
          : activeTab === 'inquiries'
            ? 'Sobald Kundenanfragen eingehen, erscheinen sie hier.'
            : 'Sobald Schäden gemeldet werden, erscheinen sie hier.'}
      </p>

      <a
        href={activeTab === 'inquiries' ? `${baseUrl}/kunden` : `${baseUrl}/einsaetze`}
        style={{
          height: '44px',
          padding: '0 16px',
          borderRadius: '13px',
          background: BRAND.black,
          color: '#FFFFFF',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '9px',
          fontSize: '14px',
          fontWeight: 760,
          fontFamily: pageFont,
          textDecoration: 'none',
        }}
      >
        <ChevronRight size={17} />
        {activeTab === 'inquiries' ? 'Kunden öffnen' : 'Einsätze öffnen'}
      </a>
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
    internalNotes: item.description || '',
    allowDuplicate: false,
  };
}

function ConversionModal({
  item,
  form,
  setForm,
  submitting,
  errorMessage,
  conflictMessage,
  onClose,
  onSubmit,
}: {
  item: PortalItem;
  form: ConversionForm;
  setForm: (next: ConversionForm) => void;
  submitting: boolean;
  errorMessage: string;
  conflictMessage: string;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const update = (key: keyof ConversionForm, value: string | boolean) => {
    setForm({
      ...form,
      [key]: value,
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 17, 21, 0.42)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '22px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '760px',
          maxHeight: '90vh',
          overflow: 'auto',
          background: '#FFFFFF',
          borderRadius: '24px',
          border: `1px solid ${BRAND.border}`,
          boxShadow: '0 24px 80px rgba(15, 17, 21, 0.22)',
        }}
      >
        <div
          style={{
            padding: '22px 24px',
            borderBottom: `1px solid ${BRAND.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            gap: '18px',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <h2
              style={{
                margin: '0 0 7px',
                fontSize: '22px',
                fontWeight: 820,
                letterSpacing: '-0.035em',
                color: BRAND.text,
              }}
            >
              Anfrage als Kunde übernehmen
            </h2>

            <p
              style={{
                margin: 0,
                fontSize: '13px',
                fontWeight: 600,
                color: BRAND.muted,
                lineHeight: 1.5,
              }}
            >
              {item.title} · {item.clientName}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '13px',
              border: `1px solid ${BRAND.border}`,
              background: '#FFFFFF',
              color: BRAND.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '12px',
              marginBottom: '22px',
            }}
            className="conversion-type-grid"
          >
            <button
              type="button"
              onClick={() => update('conversionMode', 'private')}
              style={{
                border:
                  form.conversionMode === 'private'
                    ? `1px solid ${BRAND.black}`
                    : `1px solid ${BRAND.border}`,
                background: form.conversionMode === 'private' ? '#FAFAFA' : '#FFFFFF',
                borderRadius: '18px',
                padding: '16px',
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: pageFont,
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 820,
                  color: BRAND.text,
                  marginBottom: '6px',
                }}
              >
                Privatkunde / interner Kontakt
              </div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: BRAND.muted,
                  lineHeight: 1.5,
                }}
              >
                Wird intern gespeichert. Kein Portal-Login wird erstellt.
              </div>
            </button>

            <button
              type="button"
              onClick={() => update('conversionMode', 'corporate')}
              style={{
                border:
                  form.conversionMode === 'corporate'
                    ? `1px solid ${BRAND.black}`
                    : `1px solid ${BRAND.border}`,
                background: form.conversionMode === 'corporate' ? '#FAFAFA' : '#FFFFFF',
                borderRadius: '18px',
                padding: '16px',
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: pageFont,
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 820,
                  color: BRAND.text,
                  marginBottom: '6px',
                }}
              >
                Corporate-Kunde mit Portalzugang
              </div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: BRAND.muted,
                  lineHeight: 1.5,
                }}
              >
                Erstellt zusätzlich einen vorbereiteten Client-Portal-Zugang.
              </div>
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '14px',
            }}
            className="conversion-form-grid"
          >
            <label style={labelStyle}>
              Rechnungsname / Kunde
              <input
                value={form.billingName}
                onChange={(event) => update('billingName', event.target.value)}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Kontaktperson
              <input
                value={form.fullName}
                onChange={(event) => update('fullName', event.target.value)}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Firma
              <input
                value={form.companyName}
                onChange={(event) => update('companyName', event.target.value)}
                style={inputStyle}
                placeholder={form.conversionMode === 'corporate' ? 'Firma / Verwaltung' : 'Optional'}
              />
            </label>

            <label style={labelStyle}>
              E-Mail
              <input
                value={form.email}
                onChange={(event) => update('email', event.target.value)}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Telefon
              <input
                value={form.phoneRaw}
                onChange={(event) => {
                  const nextPhone = event.target.value;

                  setForm({
                    ...form,
                    phoneRaw: nextPhone,
                    phoneE164: nextPhone,
                  });
                }}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Standortname
              <input
                value={form.siteName}
                onChange={(event) => update('siteName', event.target.value)}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Adresse
              <input
                value={form.addressText}
                onChange={(event) => update('addressText', event.target.value)}
                style={inputStyle}
              />
            </label>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '120px minmax(0, 1fr)',
                gap: '12px',
              }}
            >
              <label style={labelStyle}>
                PLZ
                <input
                  value={form.postalCode}
                  onChange={(event) => update('postalCode', event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                Stadt
                <input
                  value={form.city}
                  onChange={(event) => update('city', event.target.value)}
                  style={inputStyle}
                />
              </label>
            </div>

            <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
              Interne Notiz
              <textarea
                value={form.internalNotes}
                onChange={(event) => update('internalNotes', event.target.value)}
                style={{
                  ...inputStyle,
                  height: '92px',
                  padding: '12px 13px',
                  resize: 'vertical',
                  lineHeight: 1.5,
                }}
              />
            </label>
          </div>

          {conflictMessage && (
            <div
              style={{
                marginTop: '18px',
                padding: '13px 14px',
                borderRadius: '14px',
                border: '1px solid #FDE68A',
                background: '#FFFBEB',
                color: BRAND.amber,
                fontSize: '13px',
                fontWeight: 650,
                lineHeight: 1.5,
              }}
            >
              {conflictMessage}
              <label
                style={{
                  marginTop: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: BRAND.text,
                  fontWeight: 720,
                }}
              >
                <input
                  type="checkbox"
                  checked={form.allowDuplicate}
                  onChange={(event) => update('allowDuplicate', event.target.checked)}
                />
                Trotzdem als neuen Kunden erstellen
              </label>
            </div>
          )}

          {errorMessage && (
            <div
              style={{
                marginTop: '18px',
                padding: '13px 14px',
                borderRadius: '14px',
                border: '1px solid #FCA5A5',
                background: '#FEF2F2',
                color: '#991B1B',
                fontSize: '13px',
                fontWeight: 650,
                lineHeight: 1.5,
              }}
            >
              {errorMessage}
            </div>
          )}
        </div>

        <div
          style={{
            padding: '18px 24px 24px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            borderTop: `1px solid ${BRAND.border}`,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              height: '44px',
              padding: '0 16px',
              borderRadius: '13px',
              border: `1px solid ${BRAND.border}`,
              background: '#FFFFFF',
              color: BRAND.text,
              fontSize: '14px',
              fontWeight: 720,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            Abbrechen
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !form.billingName.trim()}
            style={{
              height: '44px',
              padding: '0 18px',
              borderRadius: '13px',
              border: `1px solid ${BRAND.black}`,
              background: BRAND.black,
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 760,
              cursor: submitting || !form.billingName.trim() ? 'not-allowed' : 'pointer',
              opacity: submitting || !form.billingName.trim() ? 0.6 : 1,
            }}
          >
            {submitting ? 'Wird übernommen...' : 'Kunde erstellen'}
          </button>
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .conversion-type-grid,
          .conversion-form-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: '7px',
  color: BRAND.text,
  fontSize: '12px',
  fontWeight: 760,
};

function InquiryPreviewModal({
  item,
  onClose,
  onConvert,
}: {
  item: PortalItem;
  onClose: () => void;
  onConvert: () => void;
}) {
  const isConverted = normalizeStatus(item.status) === 'converted';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(15, 17, 21, 0.42)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '22px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          overflow: 'auto',
          background: '#FFFFFF',
          borderRadius: '24px',
          border: `1px solid ${BRAND.border}`,
          boxShadow: '0 24px 80px rgba(15, 17, 21, 0.22)',
        }}
      >
        <div
          style={{
            padding: '22px 24px',
            borderBottom: `1px solid ${BRAND.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            gap: '18px',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div style={{ marginBottom: '10px' }}>
              <StatusBadge item={item} />
            </div>

            <h2
              style={{
                margin: '0 0 7px',
                fontSize: '24px',
                fontWeight: 820,
                letterSpacing: '-0.035em',
                color: BRAND.text,
              }}
            >
              {item.clientName || item.contactName || item.title || 'Anfrage'}
            </h2>

            <p
              style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: 600,
                color: BRAND.muted,
                lineHeight: 1.5,
              }}
            >
              {[item.serviceLabel || item.title || 'Anfrage', item.inquiryTypeLabel, formatDate(item.updatedAt || item.createdAt)].filter(Boolean).join(' · ')}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '13px',
              border: `1px solid ${BRAND.border}`,
              background: '#FFFFFF',
              color: BRAND.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '14px',
              marginBottom: '20px',
            }}
            className="inquiry-preview-grid"
          >
            <div style={previewBoxStyle}>
              <span style={previewLabelStyle}>Kunde / Firma</span>
              <strong style={previewValueStyle}>{item.clientName || '—'}</strong>
            </div>

            <div style={previewBoxStyle}>
              <span style={previewLabelStyle}>Kontaktperson</span>
              <strong style={previewValueStyle}>{item.contactName || '—'}</strong>
            </div>

            <div style={previewBoxStyle}>
              <span style={previewLabelStyle}>E-Mail</span>
              <strong style={previewValueStyle}>{item.email || '—'}</strong>
            </div>

            <div style={previewBoxStyle}>
              <span style={previewLabelStyle}>Telefon</span>
              <strong style={previewValueStyle}>{item.phoneE164 || item.phoneRaw || '—'}</strong>
            </div>

            <div style={previewBoxStyle}>
              <span style={previewLabelStyle}>Typ</span>
              <strong style={previewValueStyle}>{item.inquiryTypeLabel || '—'}</strong>
            </div>

            <div style={previewBoxStyle}>
              <span style={previewLabelStyle}>Reinigungsart</span>
              <strong style={previewValueStyle}>{item.serviceLabel || '—'}</strong>
            </div>

            <div style={previewBoxStyle}>
              <span style={previewLabelStyle}>Standort</span>
              <strong style={previewValueStyle}>{item.siteName || '—'}</strong>
            </div>

            <div style={previewBoxStyle}>
              <span style={previewLabelStyle}>Adresse</span>
              <strong style={previewValueStyle}>
                {item.addressLine || [item.addressText, [item.postalCode, item.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—'}
              </strong>
            </div>
          </div>

          <div
            style={{
              border: `1px solid ${BRAND.border}`,
              borderRadius: '18px',
              padding: '16px',
              background: '#FAFAFA',
              marginBottom: '20px',
            }}
          >
            <span style={previewLabelStyle}>Beschreibung / Nachricht</span>
            <p
              style={{
                margin: '8px 0 0',
                color: BRAND.text,
                fontSize: '14px',
                fontWeight: 600,
                lineHeight: 1.65,
                whiteSpace: 'pre-wrap',
              }}
            >
              {item.description || 'Keine zusätzliche Beschreibung vorhanden.'}
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                height: '44px',
                padding: '0 16px',
                borderRadius: '13px',
                border: `1px solid ${BRAND.border}`,
                background: '#FFFFFF',
                color: BRAND.text,
                fontSize: '14px',
                fontWeight: 720,
                cursor: 'pointer',
              }}
            >
              Schliessen
            </button>

            {!isConverted && (
              <button
                type="button"
                onClick={onConvert}
                style={{
                  height: '44px',
                  padding: '0 18px',
                  borderRadius: '13px',
                  border: `1px solid ${BRAND.black}`,
                  background: BRAND.black,
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 760,
                  cursor: 'pointer',
                }}
              >
                Als Kunde übernehmen
              </button>
            )}
          </div>
        </div>

        <style>{`
          @media (max-width: 720px) {
            .inquiry-preview-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

const previewBoxStyle: CSSProperties = {
  border: `1px solid ${BRAND.border}`,
  borderRadius: '16px',
  padding: '14px',
  background: '#FFFFFF',
};

const previewLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 800,
  color: BRAND.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '7px',
};

const previewValueStyle: CSSProperties = {
  display: 'block',
  fontSize: '14px',
  fontWeight: 760,
  color: BRAND.text,
  lineHeight: 1.4,
  wordBreak: 'break-word',
};

export default function TicketsPageTranslated() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('inquiries');
  const [items, setItems] = useState<PortalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const [selectedInquiry, setSelectedInquiry] = useState<PortalItem | null>(null);
  const [conversionForm, setConversionForm] = useState<ConversionForm | null>(null);
  const [conversionSubmitting, setConversionSubmitting] = useState(false);
  const [conversionError, setConversionError] = useState('');
  const [conversionConflict, setConversionConflict] = useState('');

  const [selectedInquiryPreview, setSelectedInquiryPreview] = useState<PortalItem | null>(null);

  useEffect(() => {
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
      const [inquiriesData, damageData, jobData] = await Promise.all([
        readList<RawRow>('opc_portal_onboarding_cards', 300),
        readList<RawRow>('opc_job_damage_reports', 300),
        readList<JobFeedRow>('opc_my_portal_job_feed', 300),
      ]);

      const jobMap = buildJobMap(jobData);

      const inquiryItems = inquiriesData.map(mapInquiry).filter(Boolean) as PortalItem[];

      const damageItems = damageData
        .map((row) => mapDamage(row, jobMap))
        .filter(Boolean) as PortalItem[];

      const damageJobIds = new Set(
        damageItems.map((item) => item.jobId).filter(Boolean) as string[]
      );

      const jobDamageItems = jobData
        .filter((job) => job.job_id && !damageJobIds.has(job.job_id))
        .map(mapJobDamageSummary)
        .filter(Boolean) as PortalItem[];

      const mergedItems = [...inquiryItems, ...damageItems, ...jobDamageItems].sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });

      setItems(mergedItems);
      writeOpcPageCache<PortalItem[]>(REQUESTS_PAGE_CACHE_KEY, mergedItems);
    } catch (error: any) {
      console.error('Anfragen & Schäden konnten nicht geladen werden:', error);
      setErrorMessage(error?.message || 'Anfragen & Schäden konnten nicht geladen werden.');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }

  const metrics = useMemo(() => {
    const inquiries = items.filter((item) => item.type === 'inquiry');
    const damages = items.filter((item) => item.type === 'damage' || item.type === 'job_damage');

    return {
      inquiriesOpen: inquiries.filter((item) => item.statusGroup !== 'done').length,
      inquiriesConverted: inquiries.filter((item) => normalizeStatus(item.status) === 'converted').length,
      damagesOpen: damages.filter((item) => item.statusGroup !== 'done').length,
      done: items.filter((item) => item.statusGroup === 'done').length,
    };
  }, [items]);

  const tabItems = useMemo(() => {
    return items.filter((item) => {
      if (activeTab === 'inquiries') return item.type === 'inquiry';
      return item.type === 'damage' || item.type === 'job_damage';
    });
  }, [activeTab, items]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return tabItems.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.statusGroup === statusFilter;

      if (!matchesStatus) return false;

      const matchesType = typeFilter === 'all' || item.type === typeFilter;

      if (!matchesType) return false;

      if (!query) return true;

      return [
        item.title,
        item.description,
        item.listSubtitle,
        item.serviceLabel,
        item.inquiryTypeLabel,
        item.clientName,
        item.contactName,
        item.email,
        item.contactLine,
        item.phoneRaw,
        item.phoneE164,
        item.siteName,
        item.addressLine,
        item.addressText,
        item.postalCode,
        item.city,
        getStatusLabel(item.status),
        typeLabels[item.type],
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [tabItems, searchQuery, statusFilter, typeFilter]);

  const openItem = (item: PortalItem) => {
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
  };

  const openConversion = (item: PortalItem) => {
    setSelectedInquiry(item);
    setConversionForm(buildInitialConversionForm(item));
    setConversionError('');
    setConversionConflict('');
  };

  const closeConversion = () => {
    if (conversionSubmitting) return;

    setSelectedInquiry(null);
    setConversionForm(null);
    setConversionError('');
    setConversionConflict('');
  };

  function openInquiryPreview(item: PortalItem) {
    setSelectedInquiryPreview(item);
  }

  function closeInquiryPreview() {
    setSelectedInquiryPreview(null);
  }

  const submitConversion = async () => {
    if (!selectedInquiry || !conversionForm) return;

    setConversionSubmitting(true);
    setConversionError('');
    setConversionConflict('');

    try {
      const response = await fetch('/api/opc/convert-inquiry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
        setConversionConflict(
          result?.message ||
            'Ein ähnlicher Kunde existiert bereits. Prüfen Sie den bestehenden Eintrag oder erstellen Sie bewusst einen neuen Kunden.'
        );
        return;
      }

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Kunde konnte nicht erstellt werden.');
      }

      setSuccessMessage(
        conversionForm.conversionMode === 'corporate'
          ? 'Corporate-Kunde wurde erstellt. Der Portalzugang ist vorbereitet.'
          : 'Kunde wurde intern erstellt. Es wurde kein Portalzugang angelegt.'
      );

      closeConversion();
      await loadItems();

      window.location.href = `${baseUrl}/kunde/${result.clientId}`;
    } catch (error: any) {
      console.error('Conversion failed:', error);
      setConversionError(error?.message || 'Kunde konnte nicht erstellt werden.');
    } finally {
      setConversionSubmitting(false);
    }
  };

  const hasFilters = Boolean(searchQuery || statusFilter !== 'all' || typeFilter !== 'all');

  if (loading) {
    return <PortalSkeleton variant="table" />;
  }

  return (
    <div
      className="opc-requests-page"
      style={{
        padding: 0,
        fontFamily: pageFont,
        color: BRAND.text,
      }}
    >
      <div
        className="opc-requests-tabs"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '10px',
          marginBottom: '22px',
        }}
      >
        <button
          type="button"
          onClick={() => {
            setActiveTab('inquiries');
            setTypeFilter('all');
          }}
          style={{
            height: '48px',
            borderRadius: '15px',
            border: `1px solid ${activeTab === 'inquiries' ? BRAND.black : BRAND.border}`,
            background: activeTab === 'inquiries' ? BRAND.black : '#FFFFFF',
            color: activeTab === 'inquiries' ? '#FFFFFF' : BRAND.text,
            fontSize: '14px',
            fontWeight: 760,
            cursor: 'pointer',
            fontFamily: pageFont,
          }}
        >
          Anfragen
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('damages');
            setTypeFilter('all');
          }}
          style={{
            height: '48px',
            borderRadius: '15px',
            border: `1px solid ${activeTab === 'damages' ? BRAND.black : BRAND.border}`,
            background: activeTab === 'damages' ? BRAND.black : '#FFFFFF',
            color: activeTab === 'damages' ? '#FFFFFF' : BRAND.text,
            fontSize: '14px',
            fontWeight: 760,
            cursor: 'pointer',
            fontFamily: pageFont,
          }}
        >
          Schäden
        </button>
      </div>

      <div
        className="opc-requests-metrics"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '16px',
          marginBottom: '22px',
        }}
      >
        <MetricCard
          value={metrics.inquiriesOpen}
          label="Offene Anfragen"
          icon={<MessageSquare size={18} />}
        />

        <MetricCard
          value={metrics.inquiriesConverted}
          label="Übernommen"
          icon={<UserPlus size={18} />}
          tone="success"
        />

        <MetricCard
          value={metrics.damagesOpen}
          label="Schäden offen"
          icon={<ShieldAlert size={18} />}
          tone={metrics.damagesOpen > 0 ? 'danger' : 'neutral'}
        />

        <MetricCard
          value={metrics.done}
          label="Erledigt"
          icon={<CheckCircle2 size={18} />}
          tone="success"
        />
      </div>

      <section
        style={{
          ...cardStyle,
          padding: '18px',
          marginBottom: '22px',
        }}
      >
        <div
          className="opc-requests-controls"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 180px 190px 190px',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          <div style={{ position: 'relative', minWidth: 0 }}>
            <Search
              size={17}
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: BRAND.faint,
                pointerEvents: 'none',
              }}
            />

            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={
                activeTab === 'inquiries'
                  ? 'Suche nach Kunde, Standort, Anfrage oder Kontakt'
                  : 'Suche nach Kunde, Standort, Schaden oder Einsatz'
              }
              style={{
                width: '100%',
                height: '48px',
                padding: '0 14px 0 42px',
                borderRadius: '14px',
                border: `1px solid ${BRAND.border}`,
                background: '#FFFFFF',
                color: BRAND.text,
                outline: 'none',
                fontSize: '14px',
                fontWeight: 560,
                fontFamily: pageFont,
                boxSizing: 'border-box',
              }}
              onFocus={(event) => {
                event.currentTarget.style.borderColor = BRAND.black;
              }}
              onBlur={(event) => {
                event.currentTarget.style.borderColor = BRAND.border;
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            style={selectStyle}
          >
            <option value="all">Alle Status</option>
            <option value="open">Offen</option>
            <option value="in_progress">In Bearbeitung</option>
            <option value="done">Erledigt</option>
          </select>

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
            style={selectStyle}
          >
            <option value="all">Alle Typen</option>
            {activeTab === 'inquiries' ? (
              <option value="inquiry">Anfragen</option>
            ) : (
              <>
                <option value="damage">Schäden</option>
                <option value="job_damage">Einsatzhinweise</option>
              </>
            )}
          </select>

          <a
            href={activeTab === 'inquiries' ? `${baseUrl}/kunden` : `${baseUrl}/einsaetze`}
            style={{
              width: '100%',
              height: '48px',
              borderRadius: '14px',
              border: `1px solid ${BRAND.black}`,
              background: BRAND.black,
              color: '#FFFFFF',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '9px',
              fontSize: '14px',
              fontWeight: 760,
              fontFamily: pageFont,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box',
            }}
          >
            <Wrench size={17} />
            {activeTab === 'inquiries' ? 'Kunden öffnen' : 'Zum Einsatz'}
          </a>
        </div>
      </section>

      {successMessage && (
        <div
          style={{
            marginBottom: '22px',
            padding: '14px 16px',
            borderRadius: '14px',
            border: '1px solid #BBF7D0',
            background: '#F0FDF4',
            color: BRAND.green,
            fontSize: '14px',
            fontWeight: 650,
          }}
        >
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            marginBottom: '22px',
            padding: '14px 16px',
            borderRadius: '14px',
            border: '1px solid #FCA5A5',
            background: '#FEF2F2',
            color: '#991B1B',
            fontSize: '14px',
            fontWeight: 620,
          }}
        >
          {errorMessage}
        </div>
      )}

      <section
        style={{
          ...cardStyle,
          overflow: 'hidden',
        }}
      >
        {filteredItems.length === 0 ? (
          <EmptyState activeTab={activeTab} hasFilters={hasFilters} />
        ) : (
          <>
            <div className="opc-requests-desktop-table">
              {filteredItems.map((item, index) => (
                <button
                  key={`${item.type}-${item.id}`}
                  type="button"
                  onClick={() => openItem(item)}
                  style={{
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns:
                      activeTab === 'inquiries'
                        ? 'minmax(260px, 1.15fr) minmax(230px, 1fr) 135px 130px 180px'
                        : 'minmax(260px, 1.1fr) minmax(230px, 1fr) 135px 130px 128px',
                    alignItems: 'center',
                    gap: '20px',
                    padding: '20px 22px',
                    border: 'none',
                    borderBottom: index < filteredItems.length - 1 ? `1px solid #F3F4F6` : 'none',
                    background: '#FFFFFF',
                    textAlign: 'left',
                    cursor: item.type === 'inquiry' ? 'default' : item.jobId || item.clientId ? 'pointer' : 'default',
                    fontFamily: pageFont,
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.background =
                      item.type !== 'inquiry' && (item.jobId || item.clientId)
                        ? '#FAFAFA'
                        : '#FFFFFF';
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = '#FFFFFF';
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '15px',
                        fontWeight: 800,
                        color: BRAND.text,
                        letterSpacing: '-0.015em',
                        marginBottom: '7px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.contactName || item.clientName || item.title}
                    </div>

                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: BRAND.muted,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.listSubtitle || item.description || typeLabels[item.type]}
                    </div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 760,
                        color: BRAND.text,
                        marginBottom: '7px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.contactLine || item.email || item.phoneE164 || item.phoneRaw || item.clientName || 'Ohne Kontakt'}
                    </div>

                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 560,
                        color: BRAND.muted,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.addressLine || [item.siteName, item.addressText, item.city].filter(Boolean).join(', ') || '-'}
                    </div>
                  </div>

                  <div>
                    <TypeBadge type={item.type} />
                  </div>

                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 760,
                      color: BRAND.text,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatDate(item.updatedAt || item.createdAt)}
                  </div>

                  {activeTab === 'inquiries' ? (
                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                      }}
                    >
                      <StatusBadge item={item} />

                      {normalizeStatus(item.status) !== 'converted' && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openInquiryPreview(item);
                          }}
                          style={{
                            height: '34px',
                            padding: '0 12px',
                            borderRadius: '12px',
                            border: `1px solid ${BRAND.black}`,
                            background: BRAND.black,
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: 760,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Öffnen
                        </button>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <StatusBadge item={item} />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="opc-requests-mobile-cards">
              {filteredItems.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  style={{
                    width: '100%',
                    border: `1px solid ${BRAND.border}`,
                    borderRadius: '18px',
                    background: '#FFFFFF',
                    padding: '16px',
                    textAlign: 'left',
                    fontFamily: pageFont,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '12px',
                      marginBottom: '12px',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <h3
                        style={{
                          margin: '0 0 6px',
                          fontSize: '15px',
                          lineHeight: 1.25,
                          fontWeight: 820,
                          color: BRAND.text,
                        }}
                      >
                        {item.contactName || item.clientName || item.title}
                      </h3>

                      <p
                        style={{
                          margin: 0,
                          fontSize: '13px',
                          fontWeight: 600,
                          color: BRAND.muted,
                        }}
                      >
                        {item.contactLine || item.email || item.phoneE164 || item.phoneRaw || item.clientName || 'Ohne Kontakt'}
                      </p>
                    </div>

                    <StatusBadge item={item} />
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gap: '7px',
                      fontSize: '13px',
                      fontWeight: 560,
                      color: BRAND.muted,
                      marginBottom: '12px',
                    }}
                  >
                    <div>{item.addressLine || [item.siteName, item.addressText, item.city].filter(Boolean).join(', ') || '-'}</div>
                    <div>{item.listSubtitle || item.description || typeLabels[item.type]}</div>
                    <div>{formatDate(item.updatedAt || item.createdAt)}</div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <TypeBadge type={item.type} />

                    {activeTab === 'inquiries' && (
                      <button
                        type="button"
                        onClick={() => openInquiryPreview(item)}
                        style={{
                          height: '32px',
                          padding: '0 12px',
                          borderRadius: '999px',
                          border: `1px solid ${BRAND.black}`,
                          background: BRAND.black,
                          color: '#FFFFFF',
                          fontSize: '12px',
                          fontWeight: 760,
                          cursor: 'pointer',
                        }}
                      >
                        Anfrage öffnen
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {filteredItems.length > 0 && (
        <div
          style={{
            marginTop: '15px',
            fontSize: '13px',
            fontWeight: 620,
            color: BRAND.muted,
          }}
        >
          {filteredItems.length} von {tabItems.length} Einträgen
        </div>
      )}

      {selectedInquiryPreview && (
        <InquiryPreviewModal
          item={selectedInquiryPreview}
          onClose={closeInquiryPreview}
          onConvert={() => {
            const item = selectedInquiryPreview;
            closeInquiryPreview();
            openConversion(item);
          }}
        />
      )}

      {selectedInquiry && conversionForm && (
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
      )}

      <style>{`
        .opc-requests-mobile-cards {
          display: none;
        }

        @media (max-width: 1280px) {
          .opc-requests-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .opc-requests-controls {
            grid-template-columns: minmax(0, 1fr) 170px 180px !important;
          }

          .opc-requests-controls a {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 980px) {
          .opc-requests-tabs {
            grid-template-columns: 1fr !important;
          }

          .opc-requests-controls {
            grid-template-columns: 1fr !important;
          }

          .opc-requests-controls a {
            grid-column: auto;
          }

          .opc-requests-desktop-table {
            display: none !important;
          }

          .opc-requests-mobile-cards {
            display: flex !important;
            flex-direction: column;
            gap: 14px;
            padding: 14px;
          }
        }

        @media (max-width: 640px) {
          .opc-requests-metrics {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}