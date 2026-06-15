import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Send,
  X,
} from 'lucide-react';
import MirakaDashboardShell from './MirakaDashboardShell';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';

interface BerichtClientSendPageProps {
  reportId?: string;
  jobId?: string;
}

type JsonRecord = Record<string, any>;
type JsonArray = JsonRecord[];

type AccessState = {
  loading: boolean;
  userId: string | null;
  role: string | null;
  canEdit: boolean;
};

type MediaItem = {
  id: string;
  type: string;
  label: string;
  name: string;
  url: string;
  path: string;
  mimeType: string;
  createdAt: string | null;
};

type TimeLogItem = {
  id: string;
  employeeName: string;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number;
  breakMinutes: number;
  status: string;
  notes: string;
};

type DamageItem = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string | null;
  photoCount: number;
};

type DocumentItem = {
  id: string;
  title: string;
  type: string;
  url: string;
  source: string;
  createdAt: string | null;
};

type SectionDraft = {
  key: string;
  title: string;
  content: string;
  checked: boolean;
  internal: boolean;
  locked?: boolean;
};

type MediaDraft = MediaItem & {
  checked: boolean;
  caption: string;
};

type TimeLogDraft = TimeLogItem & {
  checked: boolean;
  clientNote: string;
};

type DamageDraft = DamageItem & {
  checked: boolean;
  clientNote: string;
};

type DocumentDraft = DocumentItem & {
  checked: boolean;
  note: string;
};

type ReportDetail = {
  reportId: string;
  jobId: string;
  clientId: string;
  clientSiteId: string;
  status: string;
  frontendStatusLabel: string;
  reportTitle: string;
  reportSummary: string;
  totalHours: number | null;
  approvedAt: string | null;
  sentToClientAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  jobTitle: string;
  jobStatus: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  serviceCategory: string;
  serviceDescription: string;
  estimatedHours: string;
  finalHours: string;
  billingName: string;
  companyName: string;
  clientName: string;
  fullName: string;
  email: string;
  phone: string;
  siteName: string;
  siteType: string;
  addressText: string;
  postalCode: string;
  city: string;
  country: string;
  accessNotes: string;
  cleaningNotes: string;
  dispatcherNotes: string;
  internalNotes: string;
  employeeNotes: string;
  clientNotes: string;
  beforePhotos: MediaItem[];
  afterPhotos: MediaItem[];
  otherMedia: MediaItem[];
  damageReports: DamageItem[];
  timeLogs: TimeLogItem[];
  documents: DocumentItem[];
  rawReport: JsonRecord | null;
  rawJob: JsonRecord | null;
};

type ClientPackage = {
  id?: string;
  publicToken?: string;
  status?: string;
  title?: string;
  introText?: string;
  sections?: JsonArray;
  media?: JsonArray;
  documents?: JsonArray;
  timeLogs?: JsonArray;
  damages?: JsonArray;
  metadata?: JsonRecord;
  approvedAt?: string | null;
  sentToClientAt?: string | null;
};

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  black: '#0F1115',
  card: '#FFFFFF',
  soft: '#FAFAFA',
  green: '#166534',
  red: '#B91C1C',
  amber: '#92400E',
  blue: '#155E75',
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
  draft: 'Entwurf',
  open: 'Offen',
  pending: 'Offen',
  submitted: 'Zur Freigabe',
  report_pending: 'Zur Freigabe',
  in_review: 'In Prüfung',
  approved: 'Freigegeben',
  report_approved: 'Freigegeben',
  sent_to_client: 'An Kunde gesendet',
  sent: 'An Kunde gesendet',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
  rejected: 'Abgelehnt',
  scheduled: 'Geplant',
  assigned: 'Zugewiesen',
  confirmed: 'Bestätigt',
  on_site: 'Vor Ort',
  onsite: 'Vor Ort',
  in_progress: 'In Arbeit',
  before_photo: 'Vorher',
  after_photo: 'Nachher',
  damage_photo: 'Schaden',
  general_photo: 'Allgemein',
  document: 'Dokument',
  invoice: 'Rechnung',
  rechnung: 'Rechnung',
  quote: 'Offerte',
  offerte: 'Offerte',
  order_confirmation: 'Auftragsbestätigung',
  contract: 'Vertrag',
  vertrag: 'Vertrag',
};

function normalize(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function roleKey(role?: string | null) {
  const clean = normalize(role);

  if (clean === 'godmode' || clean === 'superadmin' || clean === 'super_admin') return 'godmode';
  if (clean === 'owner' || clean === 'inhaber') return 'owner';
  if (clean === 'admin' || clean === 'administrator') return 'admin';
  if (clean === 'dispatch' || clean === 'dispatcher' || clean === 'disposition') return 'dispatch';
  if (clean === 'manager') return 'manager';
  if (clean === 'employee' || clean === 'mitarbeiter') return 'employee';
  if (clean === 'client' || clean === 'kunde' || clean === 'customer') return 'client';

  return clean || 'employee';
}

function isManagerRole(role?: string | null) {
  return ['godmode', 'owner', 'admin', 'dispatch', 'manager'].includes(roleKey(role));
}

function getFirstValue(row: JsonRecord | null | undefined, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = row?.[key];

    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value);
    }
  }

  return fallback;
}

function parseJsonArray(value: unknown): JsonArray {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => (item && typeof item === 'object' ? (item as JsonRecord) : { value: item }));
  }

  if (typeof value === 'string') {
    try {
      return parseJsonArray(JSON.parse(value));
    } catch {
      return value.trim() ? [{ value }] : [];
    }
  }

  if (typeof value === 'object') {
    return Object.values(value as JsonRecord).map((item) =>
      item && typeof item === 'object' ? (item as JsonRecord) : { value: item },
    );
  }

  return [];
}

function safeMetadata(value: unknown): JsonRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) return { ...(value as JsonRecord) };
  return {};
}

function compactPayload(payload: JsonRecord) {
  const copy: JsonRecord = { ...payload };

  Object.keys(copy).forEach((key) => {
    if (copy[key] === null || copy[key] === undefined || copy[key] === '') {
      delete copy[key];
    }
  });

  return copy;
}

function formatStatus(status?: string | null, frontendLabel?: string | null) {
  if (frontendLabel && String(frontendLabel).trim()) return String(frontendLabel);

  const clean = normalize(status);
  if (!clean) return 'Offen';

  return statusLabels[clean] || clean.replace(/_/g, ' ');
}

function getReportStatusStyle(status?: string | null) {
  const clean = normalize(status);

  if (['sent_to_client', 'sent'].includes(clean)) {
    return { background: '#F9FAFB', color: BRAND.black, border: BRAND.borderStrong };
  }

  if (['approved', 'report_approved', 'completed'].includes(clean)) {
    return { background: '#F0FDF4', color: BRAND.green, border: '#BBF7D0' };
  }

  if (['submitted', 'report_pending', 'in_review', 'draft'].includes(clean)) {
    return { background: '#FFFBEB', color: BRAND.amber, border: '#FDE68A' };
  }

  if (['cancelled', 'rejected'].includes(clean)) {
    return { background: '#FEF2F2', color: BRAND.red, border: '#FECACA' };
  }

  return { background: '#F9FAFB', color: BRAND.muted, border: BRAND.border };
}

function formatDate(value?: string | null) {
  if (!value) return 'Nicht hinterlegt';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Nicht hinterlegt';

  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatShortDate(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatTime(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatHours(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';

  return `${Number(value).toLocaleString('de-CH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} h`;
}

function formatMinutes(minutes?: number | null) {
  const safe = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;

  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}

function joinAddress(report: ReportDetail | JsonRecord | null) {
  if (!report) return '';

  const row = report as any;

  return [row.addressText || row.address_text, row.postalCode || row.postal_code, row.city, row.country]
    .filter(Boolean)
    .join(', ');
}

function getDisplayName(report: ReportDetail | JsonRecord | null) {
  if (!report) return 'Unbekannter Kunde';

  const row = report as any;

  return (
    row.billingName ||
    row.billing_name ||
    row.companyName ||
    row.company_name ||
    row.clientName ||
    row.client_name ||
    row.fullName ||
    row.full_name ||
    row.siteName ||
    row.site_name ||
    'Unbekannter Kunde'
  );
}

function getRouteIdsFromPath() {
  if (typeof window === 'undefined') {
    return { reportId: '', jobId: '' };
  }

  const path = window.location.pathname || '';
  const jobMatch = path.match(/\/bericht\/senden\/job\/([^/?#]+)/i);
  const reportMatch = jobMatch ? null : path.match(/\/bericht\/senden\/([^/?#]+)/i);

  return {
    reportId: reportMatch?.[1] ? decodeURIComponent(reportMatch[1]) : '',
    jobId: jobMatch?.[1] ? decodeURIComponent(jobMatch[1]) : '',
  };
}

function getMediaUrl(item: JsonRecord) {
  return String(item.file_url || item.public_url || item.media_url || item.url || item.signed_url || item.download_url || item.value || '');
}

function getMediaPath(item: JsonRecord) {
  return String(item.storage_path || item.file_path || item.path || item.file_name || item.original_filename || '');
}

function isImageMedia(item: MediaItem | MediaDraft) {
  const mime = String(item.mimeType || '').toLowerCase();
  const path = String(item.path || '').toLowerCase();
  const url = String(item.url || '').toLowerCase();

  return mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|heic|heif|avif)(\?|$)/i.test(path) || /\.(png|jpe?g|webp|gif|heic|heif|avif)(\?|$)/i.test(url);
}

function isVideoMedia(item: MediaItem | MediaDraft) {
  const mime = String(item.mimeType || '').toLowerCase();
  const path = String(item.path || '').toLowerCase();
  const url = String(item.url || '').toLowerCase();

  return mime.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi)(\?|$)/i.test(path) || /\.(mp4|mov|webm|m4v|avi)(\?|$)/i.test(url);
}

function normalizeMedia(item: JsonRecord, fallbackType: string, index: number): MediaItem {
  const type = String(
    item.media_type || item.media_phase || item.photo_kind || item.section || item.phase || item.type || fallbackType || 'document',
  ).toLowerCase();

  const url = getMediaUrl(item);
  const path = getMediaPath(item);
  const name = String(
    item.file_name ||
      item.original_filename ||
      item.name ||
      item.title ||
      path.split('/').filter(Boolean).pop() ||
      url.split('/').filter(Boolean).pop()?.split('?')[0] ||
      'Datei öffnen',
  );

  return {
    id: String(item.id || item.media_id || item.storage_path || item.file_path || item.url || `${fallbackType}-${index}`),
    type,
    label: formatStatus(type),
    name,
    url,
    path,
    mimeType: String(item.mime_type || item.content_type || item.file_type || ''),
    createdAt: getFirstValue(item, ['created_at', 'uploaded_at']) || null,
  };
}

function normalizeTimeLog(item: JsonRecord, index: number): TimeLogItem {
  const metadata = safeMetadata(item.metadata);

  return {
    id: String(item.id || item.time_log_id || `time-${index}`),
    employeeName: getFirstValue(item, ['employee_name', 'display_name', 'staff_name', 'email'], 'Mitarbeiter'),
    startedAt: getFirstValue(item, ['started_at', 'start_time', 'clock_in_at', 'created_at']) || null,
    endedAt: getFirstValue(item, ['ended_at', 'end_time', 'clock_out_at', 'finished_at']) || null,
    durationMinutes: Number(item.duration_minutes || item.total_minutes || 0),
    breakMinutes: Number(metadata.break_minutes || item.break_minutes || 0),
    status: getFirstValue(item, ['status'], 'submitted'),
    notes: getFirstValue(item, ['notes', 'employee_note', 'note']),
  };
}

function normalizeDamage(item: JsonRecord, index: number): DamageItem {
  const photos = parseJsonArray(item.media || item.photos || item.images);

  return {
    id: String(item.id || item.damage_id || `damage-${index}`),
    title: getFirstValue(item, ['title', 'damage_type', 'category'], 'Schaden / Problem'),
    description: getFirstValue(item, ['description', 'notes', 'message']),
    status: getFirstValue(item, ['status'], 'open'),
    priority: getFirstValue(item, ['priority'], 'normal'),
    createdAt: getFirstValue(item, ['created_at', 'reported_at']) || null,
    photoCount: photos.length,
  };
}

function normalizeDocument(item: JsonRecord, index: number, source = 'documents'): DocumentItem {
  const url = getMediaUrl(item);
  const path = getMediaPath(item);
  const type = String(item.document_type || item.doc_type || item.file_type || item.type || item.category || item.kind || 'document').toLowerCase();
  const title = String(
    item.title ||
      item.document_title ||
      item.name ||
      item.file_name ||
      item.original_filename ||
      path.split('/').filter(Boolean).pop() ||
      url.split('/').filter(Boolean).pop()?.split('?')[0] ||
      formatStatus(type),
  );

  return {
    id: String(item.id || item.document_id || item.file_id || item.storage_path || item.file_path || item.url || `${source}-${index}`),
    title,
    type,
    url,
    source,
    createdAt: getFirstValue(item, ['created_at', 'uploaded_at', 'issued_at']) || null,
  };
}

function splitJobMedia(jobMedia: JsonArray) {
  const before: MediaItem[] = [];
  const after: MediaItem[] = [];
  const other: MediaItem[] = [];

  jobMedia.forEach((raw, index) => {
    const media = normalizeMedia(raw, 'document', index);
    const type = media.type.toLowerCase();

    if (type === 'before_photo' || type.includes('before') || type.includes('vorher')) {
      before.push(media);
    } else if (type === 'after_photo' || type.includes('after') || type.includes('nachher')) {
      after.push(media);
    } else {
      other.push(media);
    }
  });

  return { before, after, other };
}

function mergeReportDetail(reportRow: JsonRecord | null, jobRow: JsonRecord | null, documents: DocumentItem[]): ReportDetail {
  const serviceCategory = getFirstValue(reportRow, ['service_category']) || getFirstValue(jobRow, ['service_category', 'job_type'], 'Einsatz');
  const billingName = getFirstValue(reportRow, ['billing_name', 'company_name', 'client_name']) || getDisplayName(jobRow);
  const jobTitle =
    getFirstValue(reportRow, ['job_title', 'title']) ||
    getFirstValue(jobRow, ['title', 'job_title'], `${serviceCategory} · ${billingName}`);

  const feedBeforePhotos = parseJsonArray(reportRow?.before_photos).map((item, index) => normalizeMedia(item, 'before_photo', index));
  const feedAfterPhotos = parseJsonArray(reportRow?.after_photos).map((item, index) => normalizeMedia(item, 'after_photo', index));
  const feedOtherMedia = parseJsonArray(reportRow?.media || reportRow?.files || reportRow?.documents).map((item, index) => normalizeMedia(item, 'document', index));
  const jobMedia = splitJobMedia(parseJsonArray(jobRow?.media));

  const reportObject = reportRow?.report && typeof reportRow.report === 'object' ? (reportRow.report as JsonRecord) : null;
  const reportSource = reportObject || reportRow || {};

  const totalHoursRaw = reportSource.total_hours ?? reportRow?.total_hours ?? jobRow?.final_hours ?? null;

  const timeLogRows = parseJsonArray(reportRow?.time_logs).length
    ? parseJsonArray(reportRow?.time_logs)
    : parseJsonArray(jobRow?.time_logs);

  const damageRows = parseJsonArray(reportRow?.damage_reports).length
    ? parseJsonArray(reportRow?.damage_reports)
    : parseJsonArray(jobRow?.damage_reports);

  return {
    reportId: getFirstValue(reportSource, ['report_id', 'id']) || getFirstValue(reportRow, ['report_id', 'id']),
    jobId: getFirstValue(reportRow, ['job_id']) || getFirstValue(jobRow, ['job_id', 'id']),
    clientId: getFirstValue(reportRow, ['client_id']) || getFirstValue(jobRow, ['client_id']),
    clientSiteId: getFirstValue(reportRow, ['client_site_id']) || getFirstValue(jobRow, ['client_site_id', 'site_id']),
    status: getFirstValue(reportSource, ['report_status', 'status']) || getFirstValue(reportRow, ['report_status', 'status'], 'draft'),
    frontendStatusLabel: getFirstValue(reportRow, ['frontend_status_label']),
    reportTitle: getFirstValue(reportSource, ['report_title', 'title']) || jobTitle,
    reportSummary: getFirstValue(reportSource, ['report_summary', 'summary', 'description']),
    totalHours: totalHoursRaw === null || totalHoursRaw === undefined || totalHoursRaw === '' ? null : Number(totalHoursRaw),
    approvedAt: getFirstValue(reportSource, ['approved_at']) || getFirstValue(reportRow, ['approved_at']) || null,
    sentToClientAt: getFirstValue(reportSource, ['sent_to_client_at']) || getFirstValue(reportRow, ['sent_to_client_at']) || null,
    createdAt: getFirstValue(reportSource, ['report_created_at', 'created_at']) || getFirstValue(reportRow, ['report_created_at', 'created_at']) || null,
    updatedAt: getFirstValue(reportSource, ['report_updated_at', 'updated_at']) || getFirstValue(reportRow, ['report_updated_at', 'updated_at']) || null,
    jobTitle,
    jobStatus: getFirstValue(reportRow, ['job_status']) || getFirstValue(jobRow, ['status', 'job_status']),
    plannedStart: getFirstValue(reportRow, ['planned_start']) || getFirstValue(jobRow, ['planned_start', 'start_time']) || null,
    plannedEnd: getFirstValue(reportRow, ['planned_end']) || getFirstValue(jobRow, ['planned_end', 'end_time']) || null,
    actualStart: getFirstValue(jobRow, ['actual_start']) || null,
    actualEnd: getFirstValue(jobRow, ['actual_end']) || null,
    serviceCategory,
    serviceDescription: getFirstValue(reportRow, ['service_description']) || getFirstValue(jobRow, ['service_description']),
    estimatedHours: getFirstValue(reportRow, ['estimated_hours']) || getFirstValue(jobRow, ['estimated_hours', 'planned_hours']),
    finalHours: getFirstValue(reportRow, ['final_hours']) || getFirstValue(jobRow, ['final_hours']),
    billingName,
    companyName: getFirstValue(reportRow, ['company_name']) || getFirstValue(jobRow, ['company_name']),
    clientName: getFirstValue(reportRow, ['client_name']) || getFirstValue(jobRow, ['client_name', 'customer_name']),
    fullName: getFirstValue(reportRow, ['full_name']) || getFirstValue(jobRow, ['full_name']),
    email: getFirstValue(reportRow, ['email']) || getFirstValue(jobRow, ['email']),
    phone: getFirstValue(reportRow, ['phone_e164', 'phone_raw']) || getFirstValue(jobRow, ['phone_e164', 'phone_raw']),
    siteName: getFirstValue(reportRow, ['site_name']) || getFirstValue(jobRow, ['site_name', 'location_name']),
    siteType: getFirstValue(reportRow, ['site_type']) || getFirstValue(jobRow, ['site_type']),
    addressText: getFirstValue(reportRow, ['address_text']) || getFirstValue(jobRow, ['address_text', 'site_address']),
    postalCode: getFirstValue(reportRow, ['postal_code']) || getFirstValue(jobRow, ['postal_code']),
    city: getFirstValue(reportRow, ['city']) || getFirstValue(jobRow, ['city', 'site_city']),
    country: getFirstValue(reportRow, ['country']) || getFirstValue(jobRow, ['country']),
    accessNotes: getFirstValue(jobRow, ['access_notes']),
    cleaningNotes: getFirstValue(jobRow, ['cleaning_notes']),
    dispatcherNotes: getFirstValue(jobRow, ['dispatcher_notes']),
    internalNotes: getFirstValue(jobRow, ['internal_notes']),
    employeeNotes: getFirstValue(jobRow, ['employee_notes']),
    clientNotes: getFirstValue(jobRow, ['client_notes']),
    beforePhotos: feedBeforePhotos.length ? feedBeforePhotos : jobMedia.before,
    afterPhotos: feedAfterPhotos.length ? feedAfterPhotos : jobMedia.after,
    otherMedia: feedOtherMedia.length ? feedOtherMedia : jobMedia.other,
    damageReports: damageRows.map(normalizeDamage),
    timeLogs: timeLogRows.map(normalizeTimeLog),
    documents,
    rawReport: reportRow,
    rawJob: jobRow,
  };
}

function buildInitialSections(report: ReportDetail, existingPackage: ClientPackage | null): Record<string, SectionDraft> {
  const defaults: SectionDraft[] = [
    {
      key: 'summary',
      title: 'Zusammenfassung',
      content: report.reportSummary,
      checked: Boolean(report.reportSummary),
      internal: false,
    },
    {
      key: 'service_description',
      title: 'Servicebeschreibung',
      content: report.serviceDescription,
      checked: Boolean(report.serviceDescription),
      internal: false,
    },
    {
      key: 'cleaning_notes',
      title: 'Reinigungshinweise',
      content: report.cleaningNotes,
      checked: Boolean(report.cleaningNotes),
      internal: false,
    },
    {
      key: 'client_notes',
      title: 'Kunden-Notizen',
      content: report.clientNotes,
      checked: Boolean(report.clientNotes),
      internal: false,
    },
    {
      key: 'access_notes',
      title: 'Zugang / Objekt',
      content: report.accessNotes,
      checked: false,
      internal: true,
    },
    {
      key: 'dispatcher_notes',
      title: 'Dispo-Notizen',
      content: report.dispatcherNotes,
      checked: false,
      internal: true,
    },
    {
      key: 'employee_notes',
      title: 'Mitarbeiter-Notizen',
      content: report.employeeNotes,
      checked: false,
      internal: true,
    },
    {
      key: 'internal_notes',
      title: 'Interne Notizen',
      content: report.internalNotes,
      checked: false,
      internal: true,
    },
  ].filter((section) => String(section.content || '').trim());

  const byKey = new Map(defaults.map((section) => [section.key, section]));

  parseJsonArray(existingPackage?.sections).forEach((item) => {
    const key = String(item.key || item.id || '').trim();
    if (!key) return;

    const current = byKey.get(key) || {
      key,
      title: String(item.title || 'Abschnitt'),
      content: '',
      checked: false,
      internal: Boolean(item.internal),
    };

    byKey.set(key, {
      ...current,
      title: String(item.title || current.title),
      content: String(item.content || item.value || current.content || ''),
      checked: item.checked !== false,
      internal: Boolean(item.internal ?? current.internal),
    });
  });

  return Object.fromEntries(Array.from(byKey.values()).map((section) => [section.key, section]));
}

function hydrateMedia(items: MediaItem[], existing: JsonArray, defaultChecked: boolean): Record<string, MediaDraft> {
  const existingById = new Map(existing.map((item) => [String(item.id || item.media_id || item.key || ''), item]));

  return Object.fromEntries(
    items.map((item) => {
      const old = existingById.get(item.id);
      return [
        item.id,
        {
          ...item,
          checked: old ? old.checked !== false : defaultChecked,
          caption: String(old?.caption || old?.note || item.name || ''),
        },
      ];
    }),
  );
}

function hydrateTimeLogs(items: TimeLogItem[], existing: JsonArray): Record<string, TimeLogDraft> {
  const existingById = new Map(existing.map((item) => [String(item.id || item.time_log_id || item.key || ''), item]));

  return Object.fromEntries(
    items.map((item) => {
      const old = existingById.get(item.id);
      return [
        item.id,
        {
          ...item,
          checked: old ? old.checked !== false : false,
          clientNote: String(old?.client_note || old?.note || ''),
        },
      ];
    }),
  );
}

function hydrateDamages(items: DamageItem[], existing: JsonArray): Record<string, DamageDraft> {
  const existingById = new Map(existing.map((item) => [String(item.id || item.damage_id || item.key || ''), item]));

  return Object.fromEntries(
    items.map((item) => {
      const old = existingById.get(item.id);
      return [
        item.id,
        {
          ...item,
          checked: old ? old.checked !== false : false,
          clientNote: String(old?.client_note || old?.note || item.description || ''),
        },
      ];
    }),
  );
}

function hydrateDocuments(items: DocumentItem[], existing: JsonArray): Record<string, DocumentDraft> {
  const existingById = new Map(existing.map((item) => [String(item.id || item.document_id || item.key || ''), item]));
  const output: Record<string, DocumentDraft> = {};

  items.forEach((item) => {
    const old = existingById.get(item.id);
    output[item.id] = {
      ...item,
      checked: old ? old.checked !== false : false,
      note: String(old?.note || ''),
    };
  });

  existing.forEach((old, index) => {
    const id = String(old.id || old.document_id || old.key || `manual-${index}`);
    if (output[id]) return;

    output[id] = {
      id,
      title: String(old.title || old.name || 'Dokument'),
      type: String(old.type || 'document'),
      url: String(old.url || ''),
      source: String(old.source || 'manual'),
      createdAt: String(old.created_at || old.createdAt || '') || null,
      checked: old.checked !== false,
      note: String(old.note || ''),
    };
  });

  return output;
}

async function fetchFirst(table: string, column: string, value: string) {
  const { data, error } = await supabase.from(table).select('*').eq(column, value).limit(1);

  if (error) throw error;

  return Array.isArray(data) && data.length > 0 ? (data[0] as JsonRecord) : null;
}

async function fetchMany(table: string, column: string, value: string, limit = 50) {
  const { data, error } = await supabase.from(table).select('*').eq(column, value).limit(limit);

  if (error) throw error;

  return Array.isArray(data) ? (data as JsonArray) : [];
}

async function tryLoadReportRow(reportId: string, jobId: string) {
  const attempts: Array<() => Promise<JsonRecord | null>> = [];

  if (reportId) {
    attempts.push(() => fetchFirst('opc_portal_report_feed', 'report_id', reportId));
    attempts.push(() => fetchFirst('opc_portal_report_feed', 'id', reportId));
    attempts.push(() => fetchFirst('opc_job_reports', 'id', reportId));
    attempts.push(() => fetchFirst('opc_job_reports', 'report_id', reportId));
  }

  if (jobId) {
    attempts.push(() => fetchFirst('opc_portal_report_feed', 'job_id', jobId));
    attempts.push(() => fetchFirst('opc_job_reports', 'job_id', jobId));
  }

  let lastError: any = null;

  for (const attempt of attempts) {
    try {
      const row = await attempt();
      if (row) return row;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError && !jobId) throw lastError;
  return null;
}

async function tryLoadJobRow(jobId: string) {
  if (!jobId) return null;

  const attempts: Array<() => Promise<JsonRecord | null>> = [
    () => fetchFirst('opc_job_detail_view', 'job_id', jobId),
    () => fetchFirst('opc_job_detail_view', 'id', jobId),
    () => fetchFirst('opc_service_jobs', 'id', jobId),
    () => fetchFirst('opc_service_jobs', 'job_id', jobId),
  ];

  for (const attempt of attempts) {
    try {
      const row = await attempt();
      if (row) return row;
    } catch {
      // Continue with fallbacks.
    }
  }

  return null;
}

async function tryLoadDocuments(jobId: string, clientId: string, reportId: string) {
  const output: DocumentItem[] = [];
  const seen = new Set<string>();

  const addRows = (rows: JsonArray, source: string) => {
    rows.forEach((row, index) => {
      const doc = normalizeDocument(row, output.length + index, source);
      const key = doc.id || doc.url || `${doc.title}-${doc.type}`;
      if (!key || seen.has(key)) return;
      seen.add(key);
      output.push(doc);
    });
  };

  const attempts: Array<() => Promise<void>> = [];

  if (jobId) {
    attempts.push(async () => addRows(await fetchMany('opc_job_documents', 'job_id', jobId), 'opc_job_documents'));
    attempts.push(async () => addRows(await fetchMany('opc_documents', 'job_id', jobId), 'opc_documents'));
    attempts.push(async () => addRows(await fetchMany('opc_generated_documents', 'job_id', jobId), 'opc_generated_documents'));
    attempts.push(async () => addRows(await fetchMany('project_files', 'job_id', jobId), 'project_files'));
  }

  if (reportId) {
    attempts.push(async () => addRows(await fetchMany('opc_report_documents', 'report_id', reportId), 'opc_report_documents'));
    attempts.push(async () => addRows(await fetchMany('opc_generated_documents', 'report_id', reportId), 'opc_generated_documents'));
  }

  if (clientId) {
    attempts.push(async () => addRows(await fetchMany('opc_client_documents', 'client_id', clientId), 'opc_client_documents'));
    attempts.push(async () => addRows(await fetchMany('project_files', 'client_id', clientId), 'project_files'));
  }

  for (const attempt of attempts) {
    try {
      await attempt();
    } catch {
      // Optional tables may not exist yet.
    }
  }

  return output;
}

async function tryLoadPackage(reportId: string, jobId: string): Promise<ClientPackage | null> {
  const attempts: Array<() => Promise<JsonRecord | null>> = [];

  if (reportId) attempts.push(() => fetchFirst('opc_client_report_packages', 'report_id', reportId));
  if (jobId) attempts.push(() => fetchFirst('opc_client_report_packages', 'job_id', jobId));

  for (const attempt of attempts) {
    try {
      const row = await attempt();
      if (row) {
        return {
          id: getFirstValue(row, ['id']),
          publicToken: getFirstValue(row, ['public_token']),
          status: getFirstValue(row, ['status'], 'draft'),
          title: getFirstValue(row, ['title']),
          introText: getFirstValue(row, ['intro_text']),
          sections: parseJsonArray(row.sections),
          media: parseJsonArray(row.media),
          documents: parseJsonArray(row.documents),
          timeLogs: parseJsonArray(row.time_logs),
          damages: parseJsonArray(row.damages),
          metadata: safeMetadata(row.metadata),
          approvedAt: getFirstValue(row, ['approved_at']) || null,
          sentToClientAt: getFirstValue(row, ['sent_to_client_at']) || null,
        };
      }
    } catch {
      // Table may not exist until SQL migration is applied.
    }
  }

  return null;
}

async function savePackageRow(existingId: string | undefined, payload: JsonRecord) {
  const clean = compactPayload({ ...payload, updated_at: new Date().toISOString() });

  if (existingId) {
    const { data, error } = await supabase
      .from('opc_client_report_packages')
      .update(clean)
      .eq('id', existingId)
      .select('*')
      .limit(1);

    if (error) throw error;
    if (Array.isArray(data) && data[0]) return data[0] as JsonRecord;
  }

  const { data, error } = await supabase
    .from('opc_client_report_packages')
    .insert(compactPayload({ ...clean, created_at: new Date().toISOString() }))
    .select('*')
    .limit(1);

  if (error) throw error;

  return Array.isArray(data) && data[0] ? (data[0] as JsonRecord) : null;
}

async function tryUpdateReportStatus(report: ReportDetail, payload: JsonRecord) {
  const clean = compactPayload({ ...payload, updated_at: new Date().toISOString() });
  const attempts: Array<{ table: string; column: string; value: string }> = [];

  if (report.reportId) {
    attempts.push({ table: 'opc_job_reports', column: 'id', value: report.reportId });
    attempts.push({ table: 'opc_job_reports', column: 'report_id', value: report.reportId });
    attempts.push({ table: 'opc_reports', column: 'id', value: report.reportId });
  }

  if (report.jobId) {
    attempts.push({ table: 'opc_job_reports', column: 'job_id', value: report.jobId });
    attempts.push({ table: 'opc_reports', column: 'job_id', value: report.jobId });
  }

  for (const attempt of attempts) {
    try {
      const { data, error } = await supabase.from(attempt.table).update(clean).eq(attempt.column, attempt.value).select('id').limit(1);
      if (!error && Array.isArray(data) && data.length > 0) return;
    } catch {
      // Best effort.
    }
  }
}

function StatusBadge({ status, label }: { status?: string | null; label?: string | null }) {
  const style = getReportStatusStyle(status);

  return (
    <span
      className="opc-status-badge"
      style={{ background: style.background, color: style.color, borderColor: style.border }}
    >
      {formatStatus(status, label)}
    </span>
  );
}

function MetricCard({ label, value, helper, icon }: { label: string; value: ReactNode; helper?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="opc-metric-card">
      <div>
        <div className="opc-metric-value">{value}</div>
        <div className="opc-metric-label">{label}</div>
        {helper ? <div className="opc-metric-helper">{helper}</div> : null}
      </div>
      {icon ? <div className="opc-metric-icon">{icon}</div> : null}
    </div>
  );
}

function MiniField({ label, value }: { label: string; value: ReactNode }) {
  const hasValue = value !== null && value !== undefined && value !== '';

  return (
    <div className="opc-mini-field">
      <span>{label}</span>
      <strong>{hasValue ? value : 'Nicht hinterlegt'}</strong>
    </div>
  );
}

function SectionHeader({ title, helper }: { title: string; helper?: ReactNode }) {
  return (
    <div className="opc-split-header">
      <div>
        <h2>{title}</h2>
        {helper ? <p>{helper}</p> : null}
      </div>
    </div>
  );
}

function ToggleRow({
  checked,
  title,
  helper,
  danger,
  onChange,
}: {
  checked: boolean;
  title: string;
  helper?: ReactNode;
  danger?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`opc-toggle-row ${checked ? 'is-active' : ''} ${danger ? 'is-danger' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="opc-toggle-box">{checked ? <CheckCircle2 size={16} /> : null}</span>
      <span className="opc-toggle-copy">
        <strong>{title}</strong>
        {helper ? <small>{helper}</small> : null}
      </span>
    </label>
  );
}

function inputStyle(): CSSProperties {
  return {
    width: '100%',
    minHeight: 42,
    border: `1px solid ${BRAND.border}`,
    borderRadius: 14,
    padding: '10px 12px',
    fontSize: 14,
    fontWeight: 650,
    color: BRAND.text,
    outline: 'none',
    background: '#FFFFFF',
    fontFamily: pageFont,
    boxSizing: 'border-box',
  };
}

export default function BerichtClientSendPage({ reportId: reportIdProp = '', jobId: jobIdProp = '' }: BerichtClientSendPageProps) {
  const routeIds = useMemo(() => getRouteIdsFromPath(), []);
  const reportId = reportIdProp || routeIds.reportId;
  const jobIdFromRoute = jobIdProp || routeIds.jobId;

  const [report, setReport] = useState<ReportDetail | null>(null);
  const [clientPackage, setClientPackage] = useState<ClientPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [access, setAccess] = useState<AccessState>({ loading: true, userId: null, role: null, canEdit: false });

  const [titleDraft, setTitleDraft] = useState('');
  const [introDraft, setIntroDraft] = useState('');
  const [sections, setSections] = useState<Record<string, SectionDraft>>({});
  const [mediaItems, setMediaItems] = useState<Record<string, MediaDraft>>({});
  const [timeLogs, setTimeLogs] = useState<Record<string, TimeLogDraft>>({});
  const [damages, setDamages] = useState<Record<string, DamageDraft>>({});
  const [documents, setDocuments] = useState<Record<string, DocumentDraft>>({});
  const [manualDocTitle, setManualDocTitle] = useState('');
  const [manualDocType, setManualDocType] = useState('document');
  const [manualDocUrl, setManualDocUrl] = useState('');

  const selectedSections = useMemo(() => Object.values(sections as Record<string, SectionDraft>).filter((item) => item.checked && item.content.trim()), [sections]);
  const selectedMedia = useMemo(() => Object.values(mediaItems as Record<string, MediaDraft>).filter((item) => item.checked), [mediaItems]);
  const selectedTimeLogs = useMemo(() => Object.values(timeLogs as Record<string, TimeLogDraft>).filter((item) => item.checked), [timeLogs]);
  const selectedDamages = useMemo(() => Object.values(damages as Record<string, DamageDraft>).filter((item) => item.checked), [damages]);
  const selectedDocuments = useMemo(() => Object.values(documents as Record<string, DocumentDraft>).filter((item) => item.checked), [documents]);

  const totalSelectedItems = selectedSections.length + selectedMedia.length + selectedTimeLogs.length + selectedDamages.length + selectedDocuments.length;
  const reportJobId = report?.jobId || jobIdFromRoute;

  const loadAccess = useCallback(async () => {
    const fallback: AccessState = { loading: false, userId: null, role: null, canEdit: false };

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user || null;
      if (!user) return fallback;

      let profileRole = '';
      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role,opc_staff_role,staff_role')
          .eq('id', user.id)
          .maybeSingle();

        profileRole = String(profile?.role || profile?.opc_staff_role || profile?.staff_role || '').toLowerCase();
      } catch {
        profileRole = '';
      }

      let staffRow: JsonRecord | null = null;
      try {
        const { data, error } = await supabase
          .from('opc_staff_roles')
          .select('id,user_id,role,status,can_manage_jobs,can_view_all_jobs')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!error && Array.isArray(data) && data.length > 0) staffRow = data[0] as JsonRecord;
      } catch {
        staffRow = null;
      }

      const role = String(staffRow?.role || profileRole || user.user_metadata?.role || user.app_metadata?.role || '').toLowerCase();
      const canEdit = isManagerRole(role) || staffRow?.can_manage_jobs === true || staffRow?.can_view_all_jobs === true;

      return { loading: false, userId: user.id, role: role || null, canEdit };
    } catch {
      return fallback;
    }
  }, []);

  const hydrateState = useCallback((nextReport: ReportDetail, nextPackage: ClientPackage | null) => {
    setTitleDraft(nextPackage?.title || nextReport.reportTitle || nextReport.jobTitle || 'Bericht');
    setIntroDraft(
      nextPackage?.introText ||
        `Guten Tag\n\nNachfolgend finden Sie den freigegebenen Bericht zu ${nextReport.jobTitle || nextReport.serviceCategory || 'Ihrem Einsatz'}.`,
    );

    setSections(buildInitialSections(nextReport, nextPackage));

    setMediaItems({
      ...hydrateMedia(nextReport.beforePhotos, parseJsonArray(nextPackage?.media).filter((item) => String(item.type || '').includes('before')), true),
      ...hydrateMedia(nextReport.afterPhotos, parseJsonArray(nextPackage?.media).filter((item) => String(item.type || '').includes('after')), true),
      ...hydrateMedia(nextReport.otherMedia, parseJsonArray(nextPackage?.media), false),
    });

    setTimeLogs(hydrateTimeLogs(nextReport.timeLogs, parseJsonArray(nextPackage?.timeLogs)));
    setDamages(hydrateDamages(nextReport.damageReports, parseJsonArray(nextPackage?.damages)));
    setDocuments(hydrateDocuments(nextReport.documents, parseJsonArray(nextPackage?.documents)));
  }, []);

  const loadReport = useCallback(
    async (showLoader = true) => {
      if (!reportId && !jobIdFromRoute) {
        setDatabaseError('Keine Bericht-ID oder Einsatz-ID vorhanden.');
        setLoading(false);
        return;
      }

      if (showLoader) setLoading(true);
      setDatabaseError(null);
      setActionError(null);

      try {
        const nextAccess = await loadAccess();
        setAccess(nextAccess);

        if (!nextAccess.canEdit) {
          throw new Error('Keine Berechtigung. Diese Seite ist nur für Admin, Owner oder Disposition gedacht.');
        }

        const reportRow = await tryLoadReportRow(reportId, jobIdFromRoute);
        const resolvedJobId = jobIdFromRoute || getFirstValue(reportRow, ['job_id']);
        const jobRow = await tryLoadJobRow(resolvedJobId);

        if (!reportRow && !jobRow) {
          throw new Error('Bericht konnte nicht gefunden werden.');
        }

        const resolvedReportId = getFirstValue(reportRow, ['report_id', 'id']) || reportId;
        const resolvedClientId = getFirstValue(reportRow, ['client_id']) || getFirstValue(jobRow, ['client_id']);
        const docs = await tryLoadDocuments(resolvedJobId, resolvedClientId, resolvedReportId);
        const nextReport = mergeReportDetail(reportRow, jobRow, docs);
        const nextPackage = await tryLoadPackage(nextReport.reportId, nextReport.jobId);

        setReport(nextReport);
        setClientPackage(nextPackage);
        hydrateState(nextReport, nextPackage);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Kundenansicht konnte nicht geladen werden.';
        setDatabaseError(message);
        setReport(null);
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [hydrateState, jobIdFromRoute, loadAccess, reportId],
  );

  useEffect(() => {
    void loadReport(true);
  }, [loadReport]);

  function updateSection(key: string, patch: Partial<SectionDraft>) {
    setSections((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }

  function updateMedia(key: string, patch: Partial<MediaDraft>) {
    setMediaItems((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }

  function updateTimeLog(key: string, patch: Partial<TimeLogDraft>) {
    setTimeLogs((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }

  function updateDamage(key: string, patch: Partial<DamageDraft>) {
    setDamages((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }

  function updateDocument(key: string, patch: Partial<DocumentDraft>) {
    setDocuments((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }

  function addManualDocument() {
    const title = manualDocTitle.trim();
    const url = manualDocUrl.trim();

    if (!title && !url) return;

    const id = `manual-${Date.now()}`;
    setDocuments((current) => ({
      ...current,
      [id]: {
        id,
        title: title || url || 'Dokument',
        type: manualDocType || 'document',
        url,
        source: 'manual',
        createdAt: new Date().toISOString(),
        checked: true,
        note: '',
      },
    }));

    setManualDocTitle('');
    setManualDocUrl('');
    setManualDocType('document');
  }

  function buildPayload(nextStatus = clientPackage?.status || 'draft') {
    const now = new Date().toISOString();
    const isApproved = nextStatus === 'approved' || nextStatus === 'sent_to_client';
    const isSent = nextStatus === 'sent_to_client';

    return {
      report_id: report?.reportId || null,
      job_id: report?.jobId || null,
      client_id: report?.clientId || null,
      client_site_id: report?.clientSiteId || null,
      status: nextStatus,
      title: titleDraft.trim() || report?.reportTitle || report?.jobTitle || 'Bericht',
      intro_text: introDraft.trim(),
      sections: selectedSections.map((section) => ({
        key: section.key,
        title: section.title,
        content: section.content,
        internal: section.internal,
        checked: true,
      })),
      media: selectedMedia.map((item) => ({
        id: item.id,
        type: item.type,
        label: item.label,
        name: item.name,
        url: item.url,
        path: item.path,
        mime_type: item.mimeType,
        caption: item.caption,
        created_at: item.createdAt,
        checked: true,
      })),
      documents: selectedDocuments.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        url: item.url,
        source: item.source,
        note: item.note,
        created_at: item.createdAt,
        checked: true,
      })),
      time_logs: selectedTimeLogs.map((item) => ({
        id: item.id,
        employee_name: item.employeeName,
        started_at: item.startedAt,
        ended_at: item.endedAt,
        duration_minutes: item.durationMinutes,
        break_minutes: item.breakMinutes,
        status: item.status,
        client_note: item.clientNote,
        checked: true,
      })),
      damages: selectedDamages.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        status: item.status,
        priority: item.priority,
        created_at: item.createdAt,
        photo_count: item.photoCount,
        client_note: item.clientNote,
        checked: true,
      })),
      metadata: {
        source: 'bericht_client_send_page',
        job_title: report?.jobTitle || null,
        service_category: report?.serviceCategory || null,
        client_name: report ? getDisplayName(report) : null,
        planned_start: report?.plannedStart || null,
        updated_by: access.userId,
        selected_item_count: totalSelectedItems,
      },
      approved_at: isApproved ? clientPackage?.approvedAt || now : null,
      approved_by: isApproved ? access.userId : null,
      sent_to_client_at: isSent ? clientPackage?.sentToClientAt || now : null,
      sent_by: isSent ? access.userId : null,
      updated_by: access.userId,
      created_by: clientPackage?.id ? undefined : access.userId,
    };
  }

  async function saveClientPackage(nextStatus = clientPackage?.status || 'draft') {
    if (!report || !access.canEdit) return null;

    const row = await savePackageRow(clientPackage?.id, buildPayload(nextStatus));
    const nextPackage = row
      ? {
          id: getFirstValue(row, ['id']),
          publicToken: getFirstValue(row, ['public_token']),
          status: getFirstValue(row, ['status'], nextStatus),
          title: getFirstValue(row, ['title']),
          introText: getFirstValue(row, ['intro_text']),
          sections: parseJsonArray(row.sections),
          media: parseJsonArray(row.media),
          documents: parseJsonArray(row.documents),
          timeLogs: parseJsonArray(row.time_logs),
          damages: parseJsonArray(row.damages),
          metadata: safeMetadata(row.metadata),
          approvedAt: getFirstValue(row, ['approved_at']) || null,
          sentToClientAt: getFirstValue(row, ['sent_to_client_at']) || null,
        }
      : null;

    if (nextPackage) setClientPackage(nextPackage);
    return nextPackage;
  }

  async function runAction(action: string, callback: () => Promise<void>) {
    setActionLoading(action);
    setActionError(null);
    setActionMessage(null);

    try {
      await callback();
    } catch (error: any) {
      setActionError(error?.message || 'Aktion konnte nicht ausgeführt werden.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSaveDraft() {
    await runAction('save', async () => {
      await saveClientPackage('draft');
      setActionMessage('Kundenansicht wurde als Entwurf gespeichert.');
    });
  }

  async function handleApproveClientView() {
    await runAction('approve', async () => {
      await saveClientPackage('approved');
      setActionMessage('Kundenansicht wurde freigegeben.');
    });
  }

  async function handleMarkSent() {
    if (!report) return;

    await runAction('sent', async () => {
      await saveClientPackage('sent_to_client');
      await tryUpdateReportStatus(report, {
        status: 'sent_to_client',
        sent_to_client_at: new Date().toISOString(),
      });
      setActionMessage('Kundenansicht wurde gespeichert und als gesendet markiert.');
    });
  }

  const renderMediaPreview = (items: MediaDraft[]) => {
    if (!items.length) return <div className="opc-empty-box">Keine Medien ausgewählt.</div>;

    return (
      <div className="opc-preview-media-grid">
        {items.map((item) => (
          <a key={item.id} className="opc-preview-media" href={item.url || '#'} target="_blank" rel="noreferrer">
            <div className="opc-preview-media-thumb">
              {item.url && isImageMedia(item) ? (
                <img src={item.url} alt={item.name} loading="lazy" />
              ) : item.url && isVideoMedia(item) ? (
                <video src={item.url} muted playsInline preload="metadata" />
              ) : (
                <FileText size={22} />
              )}
            </div>
            <strong>{item.caption || item.name}</strong>
            <span>{item.label}</span>
          </a>
        ))}
      </div>
    );
  };

  return (
    <MirakaDashboardShell
      title="Kundenansicht vorbereiten"
      requiredRole={['owner', 'admin', 'dispatch']}
      currentPath="/berichte-dateien"
      hideTopBar={true}
      fullWidth={false}
    >
      <div className="opc-page" style={{ fontFamily: pageFont }}>
        <a href={report?.reportId ? `${baseUrl}/bericht/${report.reportId}` : `${baseUrl}/berichte-dateien`} className="opc-back-link">
          <ArrowLeft size={15} />
          Zurück zu Berichtdetails
        </a>

        {loading && !report ? <div className="opc-loading-card">Kundenansicht wird geladen.</div> : null}
        {!loading && databaseError ? <div className="opc-error-card">{databaseError}</div> : null}

        {!loading && !databaseError && report ? (
          <>
            {actionError ? <div className="opc-error-card">{actionError}</div> : null}
            {actionMessage ? <div className="opc-action-message">{actionMessage}</div> : null}

            <section className="opc-hero-card" style={cardStyle}>
              <div className="opc-hero-main">
                <div>
                  <div className="opc-eyebrow">Kundenansicht</div>
                  <h1>{titleDraft || report.reportTitle || report.jobTitle || 'Bericht'}</h1>
                  <div className="opc-hero-meta">
                    <span>{getDisplayName(report)}</span>
                    <span>{report.siteName || joinAddress(report) || 'Standort nicht hinterlegt'}</span>
                    <span>{formatDate(report.plannedStart)}</span>
                  </div>
                </div>
                <StatusBadge status={clientPackage?.status || 'draft'} />
              </div>

              <div className="opc-hero-button-bar four">
                <a className="opc-btn opc-btn-light" href={report.reportId ? `${baseUrl}/bericht/${report.reportId}` : `${baseUrl}/berichte-dateien`}>
                  <FileText size={16} />
                  Adminbericht
                </a>

                <a className="opc-btn opc-btn-light" href={reportJobId ? `${baseUrl}/einsatz/${reportJobId}` : `${baseUrl}/einsaetze`}>
                  <Briefcase size={16} />
                  Einsatz öffnen
                </a>

                <button type="button" className="opc-btn opc-btn-light" disabled={Boolean(actionLoading)} onClick={() => void loadReport(false)}>
                  <RefreshCw size={16} />
                  Aktualisieren
                </button>

                <button type="button" className="opc-btn opc-btn-dark" disabled={Boolean(actionLoading)} onClick={() => void handleSaveDraft()}>
                  {actionLoading === 'save' ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                  Entwurf speichern
                </button>
              </div>
            </section>

            <div className="opc-metrics-grid">
              <MetricCard label="Ausgewählt" value={totalSelectedItems} helper="Elemente für Kunde" icon={<CheckCircle2 size={18} />} />
              <MetricCard label="Abschnitte" value={selectedSections.length} helper={`${Object.keys(sections).length} verfügbar`} icon={<FileText size={18} />} />
              <MetricCard label="Medien" value={selectedMedia.length} helper={`${Object.keys(mediaItems).length} verfügbar`} icon={<ImageIcon size={18} />} />
              <MetricCard label="Dokumente" value={selectedDocuments.length} helper={`${Object.keys(documents).length} verfügbar`} icon={<Link2 size={18} />} />
            </div>

            <div className="opc-send-layout">
              <div className="opc-control-col">
                <section className="opc-section-card" style={cardStyle}>
                  <SectionHeader title="Grunddaten" helper="Diese Texte bilden den Kopf der Kundenansicht." />

                  <div className="opc-form-stack">
                    <label>
                      Titel für Kunde
                      <input style={inputStyle()} value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} />
                    </label>

                    <label>
                      Einleitung für Kunde
                      <textarea
                        style={{ ...inputStyle(), minHeight: 108, resize: 'vertical' }}
                        value={introDraft}
                        onChange={(event) => setIntroDraft(event.target.value)}
                      />
                    </label>
                  </div>
                </section>

                <section className="opc-section-card" style={cardStyle}>
                  <SectionHeader title="Berichtabschnitte" helper="Interne Inhalte bleiben deaktiviert, bis sie aktiv angehakt werden." />

                  <div className="opc-select-list">
                    {Object.values(sections as Record<string, SectionDraft>).map((section) => (
                      <div key={section.key} className="opc-select-editor">
                        <ToggleRow
                          checked={section.checked}
                          title={section.title}
                          helper={section.internal ? 'Interner Inhalt. Nur senden, wenn geprüft.' : 'Client-fähiger Inhalt.'}
                          danger={section.internal}
                          onChange={(checked) => updateSection(section.key, { checked })}
                        />

                        {section.checked ? (
                          <textarea
                            style={{ ...inputStyle(), minHeight: 96, resize: 'vertical' }}
                            value={section.content}
                            onChange={(event) => updateSection(section.key, { content: event.target.value })}
                          />
                        ) : null}
                      </div>
                    ))}

                    {Object.keys(sections).length === 0 ? <div className="opc-empty-box">Keine Berichtabschnitte vorhanden.</div> : null}
                  </div>
                </section>

                <section className="opc-section-card" style={cardStyle}>
                  <SectionHeader title="Medien" helper="Fotos und Videos können einzeln freigegeben und beschriftet werden." />

                  <div className="opc-select-list compact">
                    {Object.values(mediaItems as Record<string, MediaDraft>).map((item) => (
                      <div key={item.id} className="opc-media-control-row">
                        <ToggleRow
                          checked={item.checked}
                          title={item.name}
                          helper={`${item.label}${item.createdAt ? ` · ${formatShortDate(item.createdAt)}` : ''}`}
                          onChange={(checked) => updateMedia(item.id, { checked })}
                        />

                        {item.checked ? (
                          <input
                            style={inputStyle()}
                            value={item.caption}
                            placeholder="Beschriftung für Kunde"
                            onChange={(event) => updateMedia(item.id, { caption: event.target.value })}
                          />
                        ) : null}
                      </div>
                    ))}

                    {Object.keys(mediaItems).length === 0 ? <div className="opc-empty-box">Keine Medien vorhanden.</div> : null}
                  </div>
                </section>

                <section className="opc-section-card" style={cardStyle}>
                  <SectionHeader title="Zeiten & Schäden" helper="Zeitlogs und Schäden werden nicht automatisch an Kunden gegeben." />

                  <div className="opc-two-control-grid">
                    <div>
                      <h3>Zeiterfassung</h3>
                      <div className="opc-select-list compact">
                        {Object.values(timeLogs as Record<string, TimeLogDraft>).map((log) => (
                          <div key={log.id} className="opc-select-editor">
                            <ToggleRow
                              checked={log.checked}
                              title={`${log.employeeName} · ${formatMinutes(log.durationMinutes)}`}
                              helper={`${formatTime(log.startedAt)} – ${formatTime(log.endedAt)}`}
                              onChange={(checked) => updateTimeLog(log.id, { checked })}
                            />
                            {log.checked ? (
                              <input
                                style={inputStyle()}
                                value={log.clientNote}
                                placeholder="Optionale Kundennotiz zur Zeit"
                                onChange={(event) => updateTimeLog(log.id, { clientNote: event.target.value })}
                              />
                            ) : null}
                          </div>
                        ))}
                        {Object.keys(timeLogs).length === 0 ? <div className="opc-empty-box">Keine Zeitlogs vorhanden.</div> : null}
                      </div>
                    </div>

                    <div>
                      <h3>Schäden & Hinweise</h3>
                      <div className="opc-select-list compact">
                        {Object.values(damages as Record<string, DamageDraft>).map((damage) => (
                          <div key={damage.id} className="opc-select-editor">
                            <ToggleRow
                              checked={damage.checked}
                              title={damage.title}
                              helper={`${formatStatus(damage.status)}${damage.createdAt ? ` · ${formatShortDate(damage.createdAt)}` : ''}`}
                              danger
                              onChange={(checked) => updateDamage(damage.id, { checked })}
                            />
                            {damage.checked ? (
                              <textarea
                                style={{ ...inputStyle(), minHeight: 76, resize: 'vertical' }}
                                value={damage.clientNote}
                                placeholder="Kundentext zum Schaden / Hinweis"
                                onChange={(event) => updateDamage(damage.id, { clientNote: event.target.value })}
                              />
                            ) : null}
                          </div>
                        ))}
                        {Object.keys(damages).length === 0 ? <div className="opc-empty-box">Keine Schäden vorhanden.</div> : null}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="opc-section-card" style={cardStyle}>
                  <SectionHeader title="Dokumente" helper="Rechnungen, Offerten, Auftragsbestätigungen, Verträge oder manuelle Links." />

                  <div className="opc-document-add-box">
                    <div className="opc-form-grid-three">
                      <input style={inputStyle()} value={manualDocTitle} placeholder="Titel" onChange={(event) => setManualDocTitle(event.target.value)} />
                      <select style={inputStyle()} value={manualDocType} onChange={(event) => setManualDocType(event.target.value)}>
                        <option value="document">Dokument</option>
                        <option value="rechnung">Rechnung</option>
                        <option value="offerte">Offerte</option>
                        <option value="order_confirmation">Auftragsbestätigung</option>
                        <option value="vertrag">Vertrag</option>
                      </select>
                      <input style={inputStyle()} value={manualDocUrl} placeholder="Datei-URL / Link" onChange={(event) => setManualDocUrl(event.target.value)} />
                    </div>
                    <button type="button" className="opc-btn opc-btn-light opc-full-btn" onClick={addManualDocument}>
                      <Plus size={15} />
                      Dokument hinzufügen
                    </button>
                  </div>

                  <div className="opc-select-list compact">
                    {Object.values(documents as Record<string, DocumentDraft>).map((doc) => (
                      <div key={doc.id} className="opc-select-editor">
                        <ToggleRow
                          checked={doc.checked}
                          title={doc.title}
                          helper={`${formatStatus(doc.type)} · ${doc.source}`}
                          onChange={(checked) => updateDocument(doc.id, { checked })}
                        />
                        {doc.checked ? (
                          <input
                            style={inputStyle()}
                            value={doc.note}
                            placeholder="Optionale Notiz zum Dokument"
                            onChange={(event) => updateDocument(doc.id, { note: event.target.value })}
                          />
                        ) : null}
                      </div>
                    ))}
                    {Object.keys(documents).length === 0 ? <div className="opc-empty-box">Keine Dokumente gefunden. Du kannst oben manuell einen Link hinzufügen.</div> : null}
                  </div>
                </section>
              </div>

              <aside className="opc-preview-col">
                <section className="opc-preview-card" style={cardStyle}>
                  <div className="opc-preview-top">
                    <div>
                      <span>Kundenansicht</span>
                      <h2>{titleDraft || report.reportTitle || 'Bericht'}</h2>
                    </div>
                    <Eye size={20} />
                  </div>

                  <div className="opc-client-meta">
                    <MiniField label="Kunde" value={getDisplayName(report)} />
                    <MiniField label="Standort" value={report.siteName || joinAddress(report)} />
                    <MiniField label="Termin" value={formatDate(report.plannedStart)} />
                  </div>

                  {introDraft.trim() ? <p className="opc-preview-intro">{introDraft}</p> : null}

                  {selectedSections.length ? (
                    <div className="opc-preview-section-stack">
                      {selectedSections.map((section) => (
                        <section key={section.key}>
                          <h3>{section.title}</h3>
                          {section.internal ? <span className="opc-internal-warning">Aus internem Inhalt übernommen</span> : null}
                          <p>{section.content}</p>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <div className="opc-empty-box">Noch keine Textabschnitte ausgewählt.</div>
                  )}

                  <div className="opc-preview-block">
                    <h3>Medien</h3>
                    {renderMediaPreview(selectedMedia)}
                  </div>

                  {selectedTimeLogs.length ? (
                    <div className="opc-preview-block">
                      <h3>Zeiterfassung</h3>
                      <div className="opc-preview-lines">
                        {selectedTimeLogs.map((log) => (
                          <div key={log.id}>
                            <strong>{formatShortDate(log.startedAt)} · {formatMinutes(log.durationMinutes)}</strong>
                            <span>{formatTime(log.startedAt)} – {formatTime(log.endedAt)}</span>
                            {log.clientNote ? <p>{log.clientNote}</p> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {selectedDamages.length ? (
                    <div className="opc-preview-block">
                      <h3>Schäden & Hinweise</h3>
                      <div className="opc-preview-lines">
                        {selectedDamages.map((damage) => (
                          <div key={damage.id}>
                            <strong>{damage.title}</strong>
                            <span>{formatStatus(damage.status)}</span>
                            <p>{damage.clientNote || damage.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {selectedDocuments.length ? (
                    <div className="opc-preview-block">
                      <h3>Dokumente</h3>
                      <div className="opc-document-preview-list">
                        {selectedDocuments.map((doc) => (
                          <a key={doc.id} href={doc.url || '#'} target="_blank" rel="noreferrer">
                            <FileText size={16} />
                            <span>
                              <strong>{doc.title}</strong>
                              <small>{formatStatus(doc.type)}{doc.note ? ` · ${doc.note}` : ''}</small>
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>

                <section className="opc-section-card opc-send-actions" style={cardStyle}>
                  <SectionHeader title="Freigabe & Versand" helper="Speichert einen separaten, geprüften Snapshot für den Kunden." />
                  <button type="button" className="opc-btn opc-btn-light opc-full-btn" disabled={Boolean(actionLoading)} onClick={() => void handleSaveDraft()}>
                    {actionLoading === 'save' ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                    Entwurf speichern
                  </button>
                  <button type="button" className="opc-btn opc-btn-dark opc-full-btn" disabled={Boolean(actionLoading)} onClick={() => void handleApproveClientView()}>
                    {actionLoading === 'approve' ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />}
                    Für Kunde freigeben
                  </button>
                  <button type="button" className="opc-btn opc-btn-dark opc-full-btn" disabled={Boolean(actionLoading)} onClick={() => void handleMarkSent()}>
                    {actionLoading === 'sent' ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
                    Als gesendet markieren
                  </button>

                  {clientPackage?.publicToken ? (
                    <div className="opc-token-box">
                      <strong>Kundenpaket gespeichert</strong>
                      <span>Token: {clientPackage.publicToken}</span>
                    </div>
                  ) : null}
                </section>
              </aside>
            </div>
          </>
        ) : null}
      </div>

      <style>{`
        .opc-page {
          width: 100%;
          max-width: none;
          margin: 0;
          padding: 0 0 34px;
          color: ${BRAND.text};
          overflow-x: hidden;
        }

        .opc-page * {
          box-sizing: border-box;
        }

        .opc-back-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          height: 38px;
          padding: 0 14px;
          margin-bottom: 14px;
          border: 1px solid ${BRAND.border};
          border-radius: 999px;
          color: ${BRAND.text};
          text-decoration: none;
          font-size: 13px;
          font-weight: 760;
          background: #FFFFFF;
        }

        .opc-loading-card,
        .opc-error-card,
        .opc-action-message {
          border-radius: 18px;
          padding: 16px 18px;
          font-size: 14px;
          font-weight: 720;
          margin-bottom: 14px;
        }

        .opc-loading-card {
          border: 1px solid ${BRAND.border};
          color: ${BRAND.muted};
          background: #FFFFFF;
        }

        .opc-error-card {
          border: 1px solid #FECACA;
          color: #991B1B;
          background: #FEF2F2;
        }

        .opc-action-message {
          border: 1px solid #BBF7D0;
          color: #166534;
          background: #F0FDF4;
        }

        .opc-hero-card {
          padding: 24px;
          margin-bottom: 14px;
        }

        .opc-hero-main {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
        }

        .opc-eyebrow {
          font-size: 12px;
          color: ${BRAND.muted};
          font-weight: 760;
          margin-bottom: 6px;
        }

        .opc-hero-card h1 {
          margin: 0;
          font-size: 29px;
          line-height: 1.05;
          font-weight: 860;
          letter-spacing: -0.045em;
          color: ${BRAND.text};
        }

        .opc-hero-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          margin-top: 9px;
          font-size: 13px;
          font-weight: 720;
          color: ${BRAND.muted};
        }

        .opc-hero-button-bar {
          display: grid;
          gap: 10px;
          margin-top: 18px;
          width: 100%;
        }

        .opc-hero-button-bar.four {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .opc-btn {
          height: 44px;
          border-radius: 14px;
          padding: 0 16px;
          border: 1px solid ${BRAND.border};
          font-size: 13px;
          font-weight: 820;
          font-family: inherit;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          white-space: nowrap;
          text-decoration: none;
        }

        .opc-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .opc-btn-dark {
          background: ${BRAND.black};
          color: #FFFFFF;
          border-color: ${BRAND.black};
        }

        .opc-btn-light {
          background: #FFFFFF;
          color: ${BRAND.text};
          border-color: ${BRAND.border};
        }

        .opc-full-btn {
          width: 100%;
        }

        .opc-status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 31px;
          padding: 6px 12px;
          border: 1px solid;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 820;
          white-space: nowrap;
        }

        .opc-metrics-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }

        .opc-metric-card {
          min-height: 96px;
          padding: 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          background: #FFFFFF;
          border: 1px solid ${BRAND.border};
          border-radius: 20px;
          box-shadow: 0 1px 2px rgba(15,23,42,0.04);
        }

        .opc-metric-value {
          font-size: 25px;
          line-height: 1;
          font-weight: 860;
          letter-spacing: -0.04em;
          color: ${BRAND.text};
        }

        .opc-metric-label {
          margin-top: 8px;
          font-size: 13px;
          font-weight: 820;
          color: ${BRAND.muted};
        }

        .opc-metric-helper {
          margin-top: 4px;
          font-size: 11px;
          font-weight: 680;
          color: ${BRAND.faint};
        }

        .opc-metric-icon {
          width: 38px;
          height: 38px;
          border: 1px solid ${BRAND.border};
          border-radius: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${BRAND.black};
          background: #FAFAFA;
          flex: 0 0 auto;
        }

        .opc-send-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(380px, 0.95fr);
          gap: 14px;
          align-items: start;
        }

        .opc-control-col,
        .opc-preview-col {
          display: grid;
          gap: 14px;
          min-width: 0;
        }

        .opc-section-card,
        .opc-preview-card {
          padding: 18px;
          min-width: 0;
          overflow: hidden;
        }

        .opc-preview-col {
          position: sticky;
          top: 14px;
        }

        .opc-split-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 13px;
        }

        .opc-split-header h2 {
          margin: 0;
          font-size: 17px;
          line-height: 1.15;
          font-weight: 860;
          letter-spacing: -0.035em;
          color: ${BRAND.text};
        }

        .opc-split-header p {
          margin: 5px 0 0;
          font-size: 12px;
          line-height: 1.4;
          font-weight: 650;
          color: ${BRAND.muted};
        }

        .opc-form-stack {
          display: grid;
          gap: 11px;
        }

        .opc-form-stack label,
        .opc-select-editor label {
          display: grid;
          gap: 6px;
          font-size: 12px;
          font-weight: 820;
          color: #374151;
        }

        .opc-select-list {
          display: grid;
          gap: 12px;
        }

        .opc-select-list.compact {
          gap: 9px;
        }

        .opc-select-editor,
        .opc-media-control-row {
          display: grid;
          gap: 8px;
          padding: 10px;
          border: 1px solid #F3F4F6;
          border-radius: 16px;
          background: #FAFAFA;
        }

        .opc-toggle-row {
          display: grid;
          grid-template-columns: 26px minmax(0, 1fr);
          gap: 10px;
          align-items: start;
          cursor: pointer;
        }

        .opc-toggle-row input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        .opc-toggle-box {
          width: 26px;
          height: 26px;
          border-radius: 999px;
          border: 1px solid ${BRAND.borderStrong};
          background: #FFFFFF;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #FFFFFF;
        }

        .opc-toggle-row.is-active .opc-toggle-box {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
        }

        .opc-toggle-row.is-danger.is-active .opc-toggle-box {
          background: ${BRAND.amber};
          border-color: ${BRAND.amber};
        }

        .opc-toggle-copy {
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .opc-toggle-copy strong {
          font-size: 13px;
          font-weight: 820;
          color: ${BRAND.text};
        }

        .opc-toggle-copy small {
          font-size: 11px;
          line-height: 1.35;
          font-weight: 650;
          color: ${BRAND.muted};
        }

        .opc-empty-box {
          min-height: 48px;
          border: 1px solid #F3F4F6;
          border-radius: 14px;
          padding: 12px;
          background: #FAFAFA;
          color: ${BRAND.muted};
          font-size: 13px;
          line-height: 1.45;
          font-weight: 650;
        }

        .opc-two-control-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .opc-two-control-grid h3 {
          margin: 0 0 8px;
          font-size: 13px;
          font-weight: 860;
          color: ${BRAND.text};
        }

        .opc-document-add-box {
          display: grid;
          gap: 9px;
          padding: 12px;
          border: 1px solid #F3F4F6;
          border-radius: 16px;
          background: #FAFAFA;
          margin-bottom: 12px;
        }

        .opc-form-grid-three {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 160px minmax(0, 1fr);
          gap: 9px;
        }

        .opc-preview-card {
          background: #FFFFFF;
        }

        .opc-preview-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          padding-bottom: 14px;
          border-bottom: 1px solid #F3F4F6;
          margin-bottom: 14px;
        }

        .opc-preview-top span {
          display: block;
          color: ${BRAND.muted};
          font-size: 12px;
          font-weight: 780;
          margin-bottom: 5px;
        }

        .opc-preview-top h2 {
          margin: 0;
          font-size: 24px;
          line-height: 1.08;
          letter-spacing: -0.04em;
          font-weight: 860;
          color: ${BRAND.text};
        }

        .opc-client-meta {
          display: grid;
          gap: 0;
          margin-bottom: 14px;
        }

        .opc-mini-field {
          display: grid;
          grid-template-columns: 96px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
          min-height: 34px;
          padding: 7px 0;
          border-top: 1px solid #F3F4F6;
        }

        .opc-mini-field:first-child {
          border-top: 0;
        }

        .opc-mini-field span {
          font-size: 12px;
          font-weight: 720;
          color: ${BRAND.muted};
        }

        .opc-mini-field strong {
          font-size: 12px;
          line-height: 1.35;
          font-weight: 820;
          color: ${BRAND.text};
          text-align: right;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .opc-preview-intro {
          margin: 0 0 14px;
          padding: 13px;
          border: 1px solid #F3F4F6;
          border-radius: 15px;
          background: #FAFAFA;
          color: #374151;
          font-size: 13px;
          line-height: 1.55;
          font-weight: 650;
          white-space: pre-wrap;
        }

        .opc-preview-section-stack {
          display: grid;
          gap: 12px;
        }

        .opc-preview-section-stack section,
        .opc-preview-block {
          padding: 13px;
          border: 1px solid #F3F4F6;
          border-radius: 15px;
          background: #FFFFFF;
        }

        .opc-preview-section-stack h3,
        .opc-preview-block h3 {
          margin: 0 0 9px;
          font-size: 14px;
          font-weight: 860;
          color: ${BRAND.text};
        }

        .opc-preview-section-stack p,
        .opc-preview-lines p {
          margin: 0;
          white-space: pre-wrap;
          color: #374151;
          font-size: 13px;
          line-height: 1.55;
          font-weight: 650;
        }

        .opc-internal-warning {
          display: inline-flex;
          margin: -2px 0 8px;
          padding: 4px 8px;
          border-radius: 999px;
          background: #FFFBEB;
          color: ${BRAND.amber};
          font-size: 10px;
          font-weight: 820;
        }

        .opc-preview-block {
          margin-top: 12px;
        }

        .opc-preview-media-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .opc-preview-media {
          display: grid;
          gap: 7px;
          text-decoration: none;
          color: ${BRAND.text};
        }

        .opc-preview-media-thumb {
          height: 120px;
          border-radius: 14px;
          overflow: hidden;
          background: #F3F4F6;
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${BRAND.muted};
        }

        .opc-preview-media-thumb img,
        .opc-preview-media-thumb video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .opc-preview-media strong {
          font-size: 12px;
          font-weight: 820;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .opc-preview-media span {
          font-size: 11px;
          color: ${BRAND.muted};
          font-weight: 650;
        }

        .opc-preview-lines {
          display: grid;
          gap: 9px;
        }

        .opc-preview-lines > div {
          padding-top: 9px;
          border-top: 1px solid #F3F4F6;
        }

        .opc-preview-lines > div:first-child {
          padding-top: 0;
          border-top: 0;
        }

        .opc-preview-lines strong,
        .opc-preview-lines span {
          display: block;
        }

        .opc-preview-lines strong {
          font-size: 12px;
          font-weight: 820;
          color: ${BRAND.text};
        }

        .opc-preview-lines span {
          margin-top: 3px;
          font-size: 11px;
          color: ${BRAND.muted};
          font-weight: 650;
        }

        .opc-document-preview-list {
          display: grid;
          gap: 8px;
        }

        .opc-document-preview-list a {
          display: grid;
          grid-template-columns: 32px minmax(0, 1fr);
          gap: 9px;
          align-items: center;
          padding: 10px;
          border: 1px solid #F3F4F6;
          border-radius: 14px;
          background: #FAFAFA;
          color: ${BRAND.text};
          text-decoration: none;
        }

        .opc-document-preview-list strong,
        .opc-document-preview-list small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .opc-document-preview-list strong {
          font-size: 12px;
          font-weight: 820;
        }

        .opc-document-preview-list small {
          margin-top: 3px;
          font-size: 11px;
          color: ${BRAND.muted};
          font-weight: 650;
        }

        .opc-send-actions {
          display: grid;
          gap: 9px;
        }

        .opc-token-box {
          padding: 12px;
          border: 1px solid #F3F4F6;
          border-radius: 15px;
          background: #FAFAFA;
          display: grid;
          gap: 4px;
          color: ${BRAND.text};
        }

        .opc-token-box strong {
          font-size: 12px;
          font-weight: 820;
        }

        .opc-token-box span {
          font-size: 11px;
          font-weight: 650;
          color: ${BRAND.muted};
          word-break: break-all;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 1180px) {
          .opc-send-layout {
            grid-template-columns: minmax(0, 1fr);
          }

          .opc-preview-col {
            position: static;
          }

          .opc-hero-button-bar.four {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 740px) {
          .opc-page {
            padding: 0 8px 96px;
          }

          .opc-back-link {
            height: 34px;
            padding: 0 12px;
            margin-bottom: 10px;
            font-size: 12px;
          }

          .opc-hero-card,
          .opc-section-card,
          .opc-preview-card {
            padding: 14px;
            border-radius: 18px !important;
          }

          .opc-hero-main {
            display: grid;
            gap: 12px;
          }

          .opc-hero-card h1 {
            font-size: 22px;
            line-height: 1.1;
          }

          .opc-hero-meta {
            display: grid;
            gap: 4px;
            font-size: 12px;
          }

          .opc-hero-button-bar,
          .opc-hero-button-bar.four,
          .opc-form-grid-three,
          .opc-two-control-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .opc-btn {
            width: 100%;
            height: 42px;
            border-radius: 13px;
          }

          .opc-metrics-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            margin-bottom: 14px;
          }

          .opc-metric-card {
            min-height: 96px;
            padding: 14px;
            border-radius: 16px;
          }

          .opc-metric-value {
            font-size: 20px;
          }

          .opc-metric-label {
            font-size: 11px;
          }

          .opc-metric-helper,
          .opc-metric-icon {
            display: none;
          }

          .opc-split-header h2 {
            font-size: 16px;
          }

          .opc-preview-top h2 {
            font-size: 20px;
          }

          .opc-mini-field {
            grid-template-columns: 92px minmax(0, 1fr);
            min-height: 31px;
            padding: 6px 0;
          }

          .opc-mini-field span,
          .opc-mini-field strong {
            font-size: 11px;
          }

          .opc-preview-media-grid {
            grid-template-columns: 1fr;
          }

          .opc-preview-media-thumb {
            height: 150px;
          }
        }
      `}</style>
    </MirakaDashboardShell>
  );
}
