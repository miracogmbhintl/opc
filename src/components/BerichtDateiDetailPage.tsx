import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Pencil,
  RefreshCw,
  Save,
  Send,
  X,
} from 'lucide-react';
import MirakaDashboardShell from './MirakaDashboardShell';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';

interface BerichtDateiDetailPageProps {
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
  clientNotes: string;
  beforePhotos: MediaItem[];
  afterPhotos: MediaItem[];
  otherMedia: MediaItem[];
  damageReports: DamageItem[];
  timeLogs: TimeLogItem[];
  rawReport: JsonRecord | null;
  rawJob: JsonRecord | null;
};

type EditDraft = {
  reportTitle: string;
  reportSummary: string;
  status: string;
  totalHours: string;
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
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
  rejected: 'Abgelehnt',
  scheduled: 'Geplant',
  assigned: 'Zugewiesen',
  confirmed: 'Bestätigt',
  on_site: 'Vor Ort',
  onsite: 'Vor Ort',
  in_progress: 'In Arbeit',
};

function normalize(value?: string | null) {
  return String(value || '').trim().toLowerCase();
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

function roleKey(role?: string | null) {
  const clean = normalize(role);

  if (clean === 'owner' || clean === 'inhaber') return 'owner';
  if (clean === 'admin' || clean === 'administrator') return 'admin';
  if (clean === 'dispatch' || clean === 'dispatcher' || clean === 'disposition') return 'dispatch';
  if (clean === 'employee' || clean === 'mitarbeiter') return 'employee';
  if (clean === 'client' || clean === 'kunde' || clean === 'customer') return 'client';

  return clean || 'employee';
}

function isManagerRole(role?: string | null) {
  return ['owner', 'admin', 'dispatch', 'manager'].includes(roleKey(role));
}

function parseJsonArray(value: unknown): JsonArray {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => (item && typeof item === 'object' ? (item as JsonRecord) : { value: item }));
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parseJsonArray(parsed);
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

function getRouteIdsFromPath() {
  if (typeof window === 'undefined') {
    return { reportId: '', jobId: '' };
  }

  const path = window.location.pathname || '';
  const jobMatch = path.match(/\/bericht\/job\/([^/?#]+)/i);
  const reportMatch = jobMatch ? null : path.match(/\/bericht\/([^/?#]+)/i);

  return {
    reportId: reportMatch?.[1] ? decodeURIComponent(reportMatch[1]) : '',
    jobId: jobMatch?.[1] ? decodeURIComponent(jobMatch[1]) : '',
  };
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

  if (['submitted', 'report_pending', 'in_review'].includes(clean)) {
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

function cleanNumber(value: string) {
  const trimmed = String(value || '').trim().replace(',', '.');
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanNullable(value: string) {
  const trimmed = String(value || '').trim();
  return trimmed.length ? trimmed : null;
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

function getMapsUrl(report: ReportDetail) {
  const query = joinAddress(report) || report.siteName || getDisplayName(report);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function getMediaUrl(item: JsonRecord) {
  return String(item.file_url || item.public_url || item.media_url || item.url || item.signed_url || item.value || '');
}

function getMediaPath(item: JsonRecord) {
  return String(item.storage_path || item.file_path || item.path || item.file_name || item.original_filename || '');
}

function isImageMedia(item: MediaItem) {
  const mime = item.mimeType.toLowerCase();
  const path = item.path.toLowerCase();
  const url = item.url.toLowerCase();

  return mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|heic|heif|avif)(\?|$)/i.test(path) || /\.(png|jpe?g|webp|gif|heic|heif|avif)(\?|$)/i.test(url);
}

function isVideoMedia(item: MediaItem) {
  const mime = item.mimeType.toLowerCase();
  const path = item.path.toLowerCase();
  const url = item.url.toLowerCase();

  return mime.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi)(\?|$)/i.test(path) || /\.(mp4|mov|webm|m4v|avi)(\?|$)/i.test(url);
}

function normalizeMedia(item: JsonRecord, fallbackType: string, index: number): MediaItem {
  const type = String(
    item.media_type || item.media_phase || item.photo_kind || item.section || item.phase || fallbackType || 'document',
  ).toLowerCase();

  const url = getMediaUrl(item);
  const path = getMediaPath(item);
  const name = String(
    item.file_name ||
      item.original_filename ||
      item.name ||
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

function mergeReportDetail(reportRow: JsonRecord | null, jobRow: JsonRecord | null): ReportDetail {
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

  const totalHoursRaw =
    reportSource.total_hours ??
    reportRow?.total_hours ??
    jobRow?.final_hours ??
    null;

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
    clientNotes: getFirstValue(jobRow, ['client_notes']),
    beforePhotos: feedBeforePhotos.length ? feedBeforePhotos : jobMedia.before,
    afterPhotos: feedAfterPhotos.length ? feedAfterPhotos : jobMedia.after,
    otherMedia: feedOtherMedia.length ? feedOtherMedia : jobMedia.other,
    damageReports: damageRows.map(normalizeDamage),
    timeLogs: timeLogRows.map(normalizeTimeLog),
    rawReport: reportRow,
    rawJob: jobRow,
  };
}

async function fetchFirst(table: string, column: string, value: string) {
  const { data, error } = await supabase.from(table).select('*').eq(column, value).limit(1);

  if (error) throw error;

  return Array.isArray(data) && data.length > 0 ? (data[0] as JsonRecord) : null;
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

async function tryUpdateReportById(report: ReportDetail, payload: JsonRecord) {
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

  let lastError: any = null;

  for (const attempt of attempts) {
    try {
      const response = await supabase
        .from(attempt.table)
        .update(clean)
        .eq(attempt.column, attempt.value)
        .select('id')
        .limit(1);

      if (!response.error && Array.isArray(response.data) && response.data.length > 0) {
        return response.data[0];
      }

      lastError = response.error || new Error(`${attempt.table}: keine Zeile aktualisiert.`);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(lastError?.message || 'Bericht konnte nicht aktualisiert werden.');
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

function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="opc-split-header">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="opc-detail-card">
      <h3>{title}</h3>
      <div className="opc-detail-card-body">{children}</div>
    </section>
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

export default function BerichtDateiDetailPage({ reportId: reportIdProp = '', jobId: jobIdProp = '' }: BerichtDateiDetailPageProps) {
  const routeIds = useMemo(() => getRouteIdsFromPath(), []);
  const reportId = reportIdProp || routeIds.reportId;
  const jobIdFromRoute = jobIdProp || routeIds.jobId;

  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [access, setAccess] = useState<AccessState>({ loading: true, userId: null, role: null, canEdit: false });

  const reportJobId = report?.jobId || jobIdFromRoute;
  const totalMediaCount = (report?.beforePhotos.length || 0) + (report?.afterPhotos.length || 0) + (report?.otherMedia.length || 0);
  const computedTotalHours = useMemo(() => {
    if (report?.totalHours !== null && report?.totalHours !== undefined && !Number.isNaN(Number(report.totalHours))) {
      return report.totalHours;
    }

    const minutes = (report?.timeLogs || []).reduce((sum, log) => sum + Number(log.durationMinutes || 0), 0);
    return minutes > 0 ? minutes / 60 : null;
  }, [report]);

  const makeEditDraft = useCallback((source: ReportDetail): EditDraft => {
    return {
      reportTitle: source.reportTitle || '',
      reportSummary: source.reportSummary || '',
      status: source.status || 'draft',
      totalHours: source.totalHours !== null && source.totalHours !== undefined ? String(source.totalHours) : '',
    };
  }, []);

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
        const reportRow = await tryLoadReportRow(reportId, jobIdFromRoute);
        const resolvedJobId = jobIdFromRoute || getFirstValue(reportRow, ['job_id']);
        const jobRow = await tryLoadJobRow(resolvedJobId);

        if (!reportRow && !jobRow) {
          throw new Error('Bericht konnte nicht gefunden werden.');
        }

        const nextReport = mergeReportDetail(reportRow, jobRow);
        setReport(nextReport);
        setEditDraft(makeEditDraft(nextReport));

        const nextAccess = await loadAccess();
        setAccess(nextAccess);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Bericht konnte nicht geladen werden.';
        setDatabaseError(message);
        setReport(null);
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [jobIdFromRoute, loadAccess, makeEditDraft, reportId],
  );

  useEffect(() => {
    void loadReport(true);
  }, [loadReport]);

  const updateDraft = (field: keyof EditDraft, value: string) => {
    setEditDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  async function runReportAction(action: string, callback: () => Promise<void>) {
    setActionLoading(action);
    setActionError(null);
    setActionMessage(null);

    try {
      await callback();
      await loadReport(false);
    } catch (error: any) {
      setActionError(error?.message || 'Aktion konnte nicht ausgeführt werden.');
    } finally {
      setActionLoading(null);
    }
  }

  const handleSaveReport = async () => {
    if (!report || !editDraft || !access.canEdit) return;

    await runReportAction('save', async () => {
      await tryUpdateReportById(report, {
        report_title: cleanNullable(editDraft.reportTitle),
        report_summary: cleanNullable(editDraft.reportSummary),
        status: cleanNullable(editDraft.status),
        total_hours: cleanNumber(editDraft.totalHours),
      });

      setEditMode(false);
      setActionMessage('Bericht wurde gespeichert.');
    });
  };

  const handleApproveReport = async () => {
    if (!report || !access.canEdit) return;

    await runReportAction('approve', async () => {
      await tryUpdateReportById(report, {
        status: 'approved',
        approved_at: new Date().toISOString(),
      });

      setActionMessage('Bericht wurde freigegeben.');
    });
  };

  const handleMarkSent = async () => {
    if (!report || !access.canEdit) return;

    await runReportAction('sent', async () => {
      await tryUpdateReportById(report, {
        status: 'sent_to_client',
        sent_to_client_at: new Date().toISOString(),
      });

      setActionMessage('Bericht wurde als an Kunde gesendet markiert.');
    });
  };

  const renderMediaList = (items: MediaItem[], emptyText: string) => {
    if (!items.length) return <div className="opc-empty-box">{emptyText}</div>;

    return (
      <div className="opc-media-grid">
        {items.map((item) => (
          <a key={item.id} className="opc-media-item" href={item.url || '#'} target="_blank" rel="noreferrer">
            <div className="opc-media-preview">
              {item.url && isImageMedia(item) ? (
                <img src={item.url} alt={item.name} loading="lazy" />
              ) : item.url && isVideoMedia(item) ? (
                <video src={item.url} muted playsInline preload="metadata" />
              ) : (
                <div className="opc-media-placeholder">{item.label.slice(0, 2).toUpperCase()}</div>
              )}
            </div>

            <div className="opc-media-copy">
              <span>{item.label}</span>
              <strong>{item.name}</strong>
              {item.createdAt ? <small>{formatShortDate(item.createdAt)}</small> : null}
            </div>
          </a>
        ))}
      </div>
    );
  };

  const renderTimeLogs = () => {
    if (!report) return null;

    return (
      <section className="opc-section-card" style={cardStyle}>
        <SectionHeader title="Zeiterfassung" />

        {report.timeLogs.length === 0 ? (
          <div className="opc-empty-box">Keine Zeiten für diesen Bericht vorhanden.</div>
        ) : (
          <div className="opc-time-list">
            {report.timeLogs.map((log) => (
              <div key={log.id} className="opc-time-row-card">
                <div>
                  <strong>{log.employeeName}</strong>
                  <span>{formatShortDate(log.startedAt)}</span>
                </div>

                <div className="opc-time-row-meta">
                  <span>{formatTime(log.startedAt)} – {formatTime(log.endedAt)}</span>
                  <span>Total {formatMinutes(log.durationMinutes)}</span>
                  <span>Pause {formatMinutes(log.breakMinutes)}</span>
                </div>

                <StatusBadge status={log.status} />

                {log.notes ? <p>{log.notes}</p> : null}
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  const renderDamageReports = () => {
    if (!report) return null;

    return (
      <section className="opc-section-card" style={cardStyle}>
        <SectionHeader title="Schäden & Hinweise" />

        {report.damageReports.length === 0 ? (
          <div className="opc-empty-box">Keine Schäden oder Probleme dokumentiert.</div>
        ) : (
          <div className="opc-damage-list">
            {report.damageReports.map((damage) => (
              <div key={damage.id} className="opc-damage-card">
                <div className="opc-damage-top">
                  <div>
                    <strong>{damage.title}</strong>
                    <span>{formatShortDate(damage.createdAt)}</span>
                  </div>
                  <StatusBadge status={damage.status} />
                </div>

                {damage.description ? <p>{damage.description}</p> : null}

                <div className="opc-damage-bottom">
                  <span>Priorität: {damage.priority || 'normal'}</span>
                  <span>{damage.photoCount} Fotos</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  const renderNotes = () => {
    if (!report) return null;

    const rows = [
      { title: 'Zusammenfassung', value: report.reportSummary, visible: true },
      { title: 'Servicebeschreibung', value: report.serviceDescription, visible: true },
      { title: 'Zugang / Objekt', value: report.accessNotes, visible: access.canEdit },
      { title: 'Reinigungshinweise', value: report.cleaningNotes, visible: true },
      { title: 'Dispo-Notizen', value: report.dispatcherNotes, visible: access.canEdit },
      { title: 'Interne Notizen', value: report.internalNotes, visible: access.canEdit },
      { title: 'Kunden-Notizen', value: report.clientNotes, visible: true },
    ].filter((row) => row.visible && row.value);

    return (
      <section className="opc-section-card" style={cardStyle}>
        <SectionHeader title="Bericht & Notizen" />

        {rows.length === 0 ? (
          <div className="opc-empty-box">Keine Notizen vorhanden.</div>
        ) : (
          <div className="opc-message-list">
            {rows.map((row) => (
              <div key={row.title} className="opc-message-card">
                <strong>{row.title}</strong>
                <p>{row.value}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  const renderEditPanel = () => {
    if (!report || !editDraft || !editMode || !access.canEdit) return null;

    return (
      <section className="opc-edit-panel" style={cardStyle}>
        <div className="opc-edit-header">
          <h2>Bericht bearbeiten</h2>
          <div className="opc-edit-actions">
            <button type="button" className="opc-btn opc-btn-light" onClick={() => setEditMode(false)}>
              <X size={15} />
              Abbrechen
            </button>
            <button type="button" className="opc-btn opc-btn-dark" disabled={Boolean(actionLoading)} onClick={() => void handleSaveReport()}>
              {actionLoading === 'save' ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
              Speichern
            </button>
          </div>
        </div>

        <div className="opc-form-grid">
          <label>
            Titel
            <input style={inputStyle()} value={editDraft.reportTitle} onChange={(event) => updateDraft('reportTitle', event.target.value)} />
          </label>

          <label>
            Status
            <select style={inputStyle()} value={editDraft.status} onChange={(event) => updateDraft('status', event.target.value)}>
              <option value="draft">Entwurf</option>
              <option value="submitted">Zur Freigabe</option>
              <option value="in_review">In Prüfung</option>
              <option value="approved">Freigegeben</option>
              <option value="sent_to_client">An Kunde gesendet</option>
              <option value="rejected">Abgelehnt</option>
            </select>
          </label>

          <label>
            Total Stunden
            <input style={inputStyle()} value={editDraft.totalHours} onChange={(event) => updateDraft('totalHours', event.target.value)} />
          </label>
        </div>

        <label className="opc-edit-summary-label">
          Zusammenfassung
          <textarea
            style={{ ...inputStyle(), minHeight: 110, resize: 'vertical' }}
            value={editDraft.reportSummary}
            onChange={(event) => updateDraft('reportSummary', event.target.value)}
          />
        </label>
      </section>
    );
  };

  return (
    <MirakaDashboardShell
      title="Berichtdetails"
      requiredRole={['owner', 'admin', 'dispatch', 'employee', 'client']}
      currentPath="/berichte-dateien"
      hideTopBar={true}
      fullWidth={false}
    >
      <div className="opc-page" style={{ fontFamily: pageFont }}>
        <a href={`${baseUrl}/berichte-dateien`} className="opc-back-link">
          <ArrowLeft size={15} />
          Zurück zu Berichte & Dateien
        </a>

        {loading && !report ? <div className="opc-loading-card">Bericht wird geladen.</div> : null}
        {!loading && databaseError ? <div className="opc-error-card">{databaseError}</div> : null}

        {!loading && !databaseError && report ? (
          <>
            {actionError ? <div className="opc-error-card">{actionError}</div> : null}
            {actionMessage ? <div className="opc-action-message">{actionMessage}</div> : null}

            <section className="opc-hero-card" style={cardStyle}>
              <div className="opc-hero-main">
                <div>
                  <div className="opc-eyebrow">{report.serviceCategory || 'Bericht'}</div>
                  <h1>{report.reportTitle || report.jobTitle || 'Bericht'}</h1>
                  <div className="opc-hero-meta">
                    <span>{getDisplayName(report)}</span>
                    <span>{report.siteName || joinAddress(report) || 'Standort nicht hinterlegt'}</span>
                    <span>{formatDate(report.plannedStart)}</span>
                  </div>
                </div>
                <StatusBadge status={report.status} label={report.frontendStatusLabel} />
              </div>

              <div className={access.canEdit ? 'opc-hero-button-bar four' : 'opc-hero-button-bar two'}>
                <a className="opc-btn opc-btn-light" href={getMapsUrl(report)} target="_blank" rel="noreferrer">
                  <MapPin size={16} />
                  Navigation
                </a>

                <a className="opc-btn opc-btn-dark" href={reportJobId ? `${baseUrl}/einsatz/${reportJobId}` : `${baseUrl}/einsaetze`}>
                  <Briefcase size={16} />
                  Einsatz öffnen
                </a>

                {access.canEdit ? (
                  <button
                    type="button"
                    className="opc-btn opc-btn-light"
                    onClick={() => {
                      setEditDraft(makeEditDraft(report));
                      setEditMode((current) => !current);
                    }}
                  >
                    <Pencil size={16} />
                    {editMode ? 'Bearbeitung schliessen' : 'Bericht bearbeiten'}
                  </button>
                ) : null}

                {access.canEdit ? (
                  <button type="button" className="opc-btn opc-btn-light" disabled={Boolean(actionLoading)} onClick={() => void loadReport(false)}>
                    <RefreshCw size={16} />
                    Aktualisieren
                  </button>
                ) : null}
              </div>
            </section>

            <div className="opc-metrics-grid">
              <MetricCard label="Status" value={formatStatus(report.status, report.frontendStatusLabel)} icon={<CheckCircle2 size={18} />} />
              <MetricCard label="Stunden" value={formatHours(computedTotalHours)} helper={`${report.timeLogs.length} Zeitlog${report.timeLogs.length === 1 ? '' : 's'}`} icon={<Clock3 size={18} />} />
              <MetricCard label="Medien" value={totalMediaCount} helper={`${report.beforePhotos.length} vorher · ${report.afterPhotos.length} nachher`} icon={<ImageIcon size={18} />} />
              <MetricCard label="Schäden" value={report.damageReports.length} icon={<AlertTriangle size={18} />} />
            </div>

            {renderEditPanel()}

            {access.canEdit ? (
              <section className="opc-approval-card" style={cardStyle}>
                <SectionHeader title="Freigabe" />
                <div className="opc-approval-actions">
                  <button type="button" className="opc-btn opc-btn-light" disabled={Boolean(actionLoading)} onClick={() => void handleApproveReport()}>
                    {actionLoading === 'approve' ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />}
                    Bericht freigeben
                  </button>
                  <a
                    className="opc-btn opc-btn-dark"
                    href={report.reportId ? `${baseUrl}/bericht/senden/${report.reportId}` : reportJobId ? `${baseUrl}/bericht/senden/job/${reportJobId}` : `${baseUrl}/berichte-dateien`}
                  >
                    <Send size={15} />
                    Kundenansicht vorbereiten
                  </a>
                  <button type="button" className="opc-btn opc-btn-light" disabled={Boolean(actionLoading)} onClick={() => void handleMarkSent()}>
                    {actionLoading === 'sent' ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
                    Als gesendet markieren
                  </button>
                </div>
              </section>
            ) : null}

            <div className="opc-section-title-row">
              <h2 className="opc-section-title">Berichtdaten</h2>
            </div>

            <div className="opc-detail-strip">
              <DetailCard title="Bericht">
                <MiniField label="Bericht-ID" value={report.reportId} />
                <MiniField label="Status" value={<StatusBadge status={report.status} label={report.frontendStatusLabel} />} />
                <MiniField label="Erstellt" value={formatDate(report.createdAt)} />
                <MiniField label="Aktualisiert" value={formatDate(report.updatedAt)} />
              </DetailCard>

              <DetailCard title="Einsatz">
                <MiniField label="Einsatz-ID" value={report.jobId} />
                <MiniField label="Titel" value={report.jobTitle} />
                <MiniField label="Status" value={formatStatus(report.jobStatus)} />
                <MiniField label="Service" value={report.serviceCategory} />
              </DetailCard>

              <DetailCard title="Termin">
                <MiniField label="Start" value={formatDate(report.plannedStart)} />
                <MiniField label="Ende" value={formatDate(report.plannedEnd)} />
                <MiniField label="Ist-Start" value={formatDate(report.actualStart)} />
                <MiniField label="Ist-Ende" value={formatDate(report.actualEnd)} />
              </DetailCard>

              <DetailCard title="Kunde">
                <MiniField label="Name" value={getDisplayName(report)} />
                <MiniField label="E-Mail" value={report.email ? <a className="opc-inline-link" href={`mailto:${report.email}`}>{report.email}</a> : null} />
                <MiniField label="Telefon" value={report.phone} />
                <MiniField label="Client-ID" value={report.clientId} />
              </DetailCard>

              <DetailCard title="Standort">
                <MiniField label="Standort" value={report.siteName} />
                <MiniField label="Typ" value={report.siteType} />
                <MiniField label="Adresse" value={joinAddress(report)} />
                <MiniField label="Site-ID" value={report.clientSiteId} />
              </DetailCard>
            </div>

            <div className="opc-main-grid">
              <div className="opc-left-col">
                {renderNotes()}

                <section className="opc-section-card" style={cardStyle}>
                  <SectionHeader title="Vorher / Nachher Medien" />

                  <div className="opc-media-section">
                    <div className="opc-media-header"><h3>Vorher</h3></div>
                    {renderMediaList(report.beforePhotos, 'Noch keine Vorher-Medien vorhanden.')}
                  </div>

                  <div className="opc-media-section">
                    <div className="opc-media-header"><h3>Nachher</h3></div>
                    {renderMediaList(report.afterPhotos, 'Noch keine Nachher-Medien vorhanden.')}
                  </div>

                  {report.otherMedia.length ? (
                    <div className="opc-media-section">
                      <div className="opc-media-header"><h3>Weitere Dateien</h3></div>
                      {renderMediaList(report.otherMedia, 'Keine weiteren Dateien vorhanden.')}
                    </div>
                  ) : null}
                </section>
              </div>

              <aside className="opc-right-col">
                {renderTimeLogs()}
                {renderDamageReports()}

                <section className="opc-section-card" style={cardStyle}>
                  <SectionHeader title="Kurzinfo" />
                  <div className="opc-rows compact">
                    <MiniField label="Freigegeben" value={formatDate(report.approvedAt)} />
                    <MiniField label="Gesendet" value={formatDate(report.sentToClientAt)} />
                    <MiniField label="Fotos" value={`${report.beforePhotos.length + report.afterPhotos.length}`} />
                    <MiniField label="Dateien" value={`${totalMediaCount}`} />
                  </div>
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
          padding: 0 0 96px;
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
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
        }

        .opc-eyebrow {
          font-size: 12px;
          color: ${BRAND.muted};
          font-weight: 760;
          margin-bottom: 6px;
        }

        .opc-hero-card h1 {
          margin: 0;
          font-size: 31px;
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

        .opc-hero-button-bar {
          display: grid;
          gap: 10px;
          margin-top: 18px;
          width: 100%;
        }

        .opc-hero-button-bar.two {
          grid-template-columns: repeat(2, minmax(0, 1fr));
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
          font-weight: 820;
          letter-spacing: -0.04em;
          color: ${BRAND.text};
        }

        .opc-metric-label {
          margin-top: 10px;
          font-size: 13px;
          font-weight: 720;
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

        .opc-edit-panel,
        .opc-approval-card,
        .opc-section-card,
        .opc-detail-card {
          background: #FFFFFF;
          border: 1px solid ${BRAND.border};
          border-radius: 20px;
          box-shadow: 0 1px 2px rgba(15,23,42,0.04);
        }

        .opc-edit-panel,
        .opc-approval-card,
        .opc-section-card {
          padding: 16px;
          min-width: 0;
          width: 100%;
          max-width: 100%;
          overflow: hidden;
          margin-bottom: 14px;
        }

        .opc-edit-header,
        .opc-split-header,
        .opc-media-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 13px;
        }

        .opc-edit-header h2,
        .opc-split-header h2 {
          margin: 0;
          font-size: 17px;
          line-height: 1.15;
          font-weight: 860;
          letter-spacing: -0.035em;
          color: ${BRAND.text};
        }

        .opc-edit-actions,
        .opc-approval-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .opc-form-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 11px;
        }

        .opc-form-grid label,
        .opc-edit-summary-label {
          display: grid;
          gap: 6px;
          font-size: 12px;
          font-weight: 820;
          color: #374151;
        }

        .opc-edit-summary-label {
          margin-top: 11px;
        }

        .opc-section-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 18px;
        }

        .opc-section-title {
          margin: 0 0 10px;
          font-size: 19px;
          line-height: 1.15;
          font-weight: 860;
          color: ${BRAND.text};
          letter-spacing: -0.035em;
        }

        .opc-detail-strip {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding: 0 2px 10px;
          margin: 0 -2px 16px;
          scroll-snap-type: x mandatory;
          scrollbar-width: thin;
        }

        .opc-detail-card {
          padding: 16px;
          min-width: 310px;
          flex: 0 0 310px;
          scroll-snap-align: start;
        }

        .opc-detail-card h3,
        .opc-media-header h3 {
          margin: 0 0 10px;
          font-size: 13px;
          font-weight: 860;
          color: ${BRAND.text};
          letter-spacing: -0.02em;
        }

        .opc-detail-card-body,
        .opc-rows {
          display: grid;
          gap: 0;
        }

        .opc-mini-field {
          display: grid;
          grid-template-columns: minmax(96px, 0.8fr) minmax(0, 1.2fr);
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

        .opc-inline-link {
          color: ${BRAND.text};
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .opc-main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
          gap: 14px;
          align-items: start;
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
        }

        .opc-left-col,
        .opc-right-col {
          display: grid;
          gap: 14px;
          min-width: 0;
          width: 100%;
          max-width: 100%;
        }

        .opc-note-box,
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
          white-space: pre-wrap;
        }

        .opc-message-list,
        .opc-time-list,
        .opc-damage-list {
          display: grid;
          gap: 9px;
        }

        .opc-message-card,
        .opc-time-row-card,
        .opc-damage-card {
          border: 1px solid #F3F4F6;
          border-radius: 14px;
          padding: 11px;
          background: #FAFAFA;
        }

        .opc-message-card strong,
        .opc-time-row-card strong,
        .opc-damage-card strong {
          display: block;
          font-size: 12px;
          font-weight: 840;
          color: ${BRAND.text};
        }

        .opc-message-card p,
        .opc-time-row-card p,
        .opc-damage-card p {
          margin: 8px 0 0;
          font-size: 12px;
          line-height: 1.5;
          font-weight: 620;
          color: #374151;
          word-break: break-word;
          overflow-wrap: anywhere;
          white-space: pre-wrap;
        }

        .opc-time-row-card {
          display: grid;
          gap: 10px;
        }

        .opc-time-row-card > div:first-child span,
        .opc-damage-top span,
        .opc-damage-bottom span {
          display: block;
          margin-top: 3px;
          font-size: 11px;
          font-weight: 650;
          color: ${BRAND.muted};
        }

        .opc-time-row-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          font-size: 12px;
          font-weight: 720;
          color: ${BRAND.muted};
        }

        .opc-damage-top,
        .opc-damage-bottom {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .opc-damage-bottom {
          align-items: center;
          margin-top: 10px;
        }

        .opc-media-section {
          margin-top: 14px;
          padding-top: 13px;
          border-top: 1px solid #F3F4F6;
        }

        .opc-media-section:first-of-type {
          margin-top: 0;
          padding-top: 0;
          border-top: 0;
        }

        .opc-media-header {
          margin-bottom: 8px;
        }

        .opc-media-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .opc-media-item {
          display: grid;
          grid-template-columns: 86px minmax(0, 1fr);
          gap: 10px;
          min-height: 86px;
          border: 1px solid #F3F4F6;
          border-radius: 14px;
          padding: 8px;
          background: #FAFAFA;
          text-decoration: none;
          color: ${BRAND.text};
          overflow: hidden;
        }

        .opc-media-preview {
          width: 86px;
          height: 70px;
          border-radius: 11px;
          overflow: hidden;
          background: #F3F4F6;
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${BRAND.muted};
          font-size: 12px;
          font-weight: 800;
        }

        .opc-media-preview img,
        .opc-media-preview video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .opc-media-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .opc-media-copy {
          min-width: 0;
          display: grid;
          align-content: center;
          gap: 4px;
        }

        .opc-media-copy span {
          font-size: 10px;
          font-weight: 760;
          color: ${BRAND.muted};
          text-transform: uppercase;
        }

        .opc-media-copy strong,
        .opc-media-copy small {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .opc-media-copy strong {
          font-size: 12px;
          font-weight: 820;
          color: ${BRAND.text};
        }

        .opc-media-copy small {
          font-size: 11px;
          color: ${BRAND.faint};
          font-weight: 650;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 1180px) {
          .opc-main-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .opc-right-col {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            align-items: start;
          }

          .opc-hero-button-bar.four {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .opc-form-grid {
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

          .opc-hero-card {
            padding: 16px;
            border-radius: 18px !important;
            margin-bottom: 10px;
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
          .opc-hero-button-bar.two,
          .opc-hero-button-bar.four,
          .opc-form-grid,
          .opc-main-grid,
          .opc-left-col,
          .opc-right-col {
            grid-template-columns: 1fr;
            gap: 10px;
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

          .opc-edit-panel,
          .opc-approval-card,
          .opc-section-card {
            padding: 14px;
            border-radius: 18px !important;
          }

          .opc-edit-header,
          .opc-split-header {
            align-items: flex-start;
            margin-bottom: 10px;
          }

          .opc-edit-header h2,
          .opc-split-header h2 {
            font-size: 16px;
          }

          .opc-edit-actions,
          .opc-approval-actions {
            display: grid;
            grid-template-columns: 1fr;
            width: 100%;
          }

          .opc-btn {
            width: 100%;
            height: 42px;
            border-radius: 13px;
          }

          .opc-section-title {
            margin: 16px 0 8px;
            font-size: 17px;
          }

          .opc-detail-strip {
            gap: 10px;
            padding: 0 2px 8px;
            margin: 0 -2px 12px;
          }

          .opc-detail-card {
            min-width: min(304px, calc(100vw - 34px));
            flex-basis: min(304px, calc(100vw - 34px));
            padding: 14px;
            border-radius: 17px;
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

          .opc-message-card,
          .opc-time-row-card,
          .opc-damage-card,
          .opc-note-box,
          .opc-empty-box {
            border-radius: 13px;
            padding: 10px;
          }

          .opc-media-grid {
            grid-template-columns: 1fr;
          }

          .opc-media-item {
            grid-template-columns: 74px minmax(0, 1fr);
            min-height: 78px;
          }

          .opc-media-preview {
            width: 74px;
            height: 62px;
          }
        }
      `}</style>
    </MirakaDashboardShell>
  );
}
