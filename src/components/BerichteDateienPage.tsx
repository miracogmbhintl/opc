import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  Clock3,
  FileText,
  Image as ImageIcon,
  MapPin,
  Search,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import MirakaDashboardShell from './MirakaDashboardShell';

interface RawReport {
  [key: string]: any;
}

interface ReportRow {
  reportId: string;
  jobId: string;
  clientId: string;
  clientSiteId: string;
  reportStatus: string;
  reportTitle: string;
  reportSummary: string;
  totalHours: number | null;
  beforePhotoCount: number;
  afterPhotoCount: number;
  damageCount: number;
  timeLogCount: number;
  approvedAt: string | null;
  sentToClientAt: string | null;
  jobTitle: string;
  jobStatus: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  serviceCategory: string;
  billingName: string;
  siteName: string;
  addressText: string;
  postalCode: string;
  city: string;
  reportCreatedAt: string | null;
  reportUpdatedAt: string | null;
  frontendStatusLabel: string;
}

type StatusFilter = 'all' | 'open' | 'review' | 'approved' | 'sent_to_client' | 'missing_photos';
type ContentFilter = 'all' | 'photos' | 'damage' | 'time_logs' | 'missing_time';
type ReportDateFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'last30' | 'custom';

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
  draft: 'Offen',
  open: 'Offen',
  pending: 'Offen',
  submitted: 'Zur Freigabe',
  report_pending: 'Zur Freigabe',
  in_review: 'Zur Freigabe',
  approved: 'Freigegeben',
  report_approved: 'Freigegeben',
  sent_to_client: 'An Kunde gesendet',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
};

const filePillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  height: '26px',
  padding: '0 9px',
  borderRadius: '999px',
  border: `1px solid ${BRAND.border}`,
  background: '#FFFFFF',
  color: BRAND.muted,
  fontSize: '11px',
  fontWeight: 720,
  whiteSpace: 'nowrap',
};

function getFirstValue(row: RawReport, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = row?.[key];

    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value);
    }
  }

  return fallback;
}

function normalizeStatus(status?: string | null) {
  return String(status || '').trim().toLowerCase();
}

function formatStatus(status?: string | null, frontendLabel?: string | null) {
  if (frontendLabel && String(frontendLabel).trim()) {
    return String(frontendLabel);
  }

  const normalized = normalizeStatus(status);

  if (!normalized) return 'Offen';

  return statusLabels[normalized] || normalized.replace(/_/g, ' ');
}

function getStatusGroup(status?: string | null): StatusFilter {
  const normalized = normalizeStatus(status);

  if (['sent_to_client', 'sent'].includes(normalized)) return 'sent_to_client';
  if (['approved', 'report_approved'].includes(normalized)) return 'approved';
  if (['submitted', 'report_pending', 'in_review'].includes(normalized)) return 'review';

  return 'open';
}

function parseJsonArray(value: unknown): unknown[] {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) return parsed;

      if (parsed && typeof parsed === 'object') {
        return Object.values(parsed);
      }

      return [];
    } catch {
      return [];
    }
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>);
  }

  return [];
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

function formatDateTime(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatHours(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';

  return `${Number(value).toLocaleString('de-CH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} h`;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function getReportReferenceDate(report: ReportRow) {
  return report.plannedStart || report.reportUpdatedAt || report.reportCreatedAt || null;
}

function isSameLocalDay(value: string | null | undefined, referenceDate: Date) {
  if (!value) return false;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return false;

  return date >= startOfDay(referenceDate) && date <= endOfDay(referenceDate);
}

function isWithinWeek(value: string | null | undefined, referenceDate: Date) {
  if (!value) return false;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return false;

  return date >= startOfDay(referenceDate) && date <= endOfDay(addDays(referenceDate, 7));
}

function isPreviousLocalDay(value: string | null | undefined, referenceDate: Date) {
  if (!value) return false;

  const yesterday = addDays(referenceDate, -1);
  return isSameLocalDay(value, yesterday);
}

function isWithinCurrentMonth(value: string | null | undefined, referenceDate: Date) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59, 999);

  return date >= start && date <= end;
}

function isWithinLastDays(value: string | null | undefined, referenceDate: Date, days: number) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  return date >= startOfDay(addDays(referenceDate, -days + 1)) && date <= endOfDay(referenceDate);
}

function formatInputDateLabel(value: string) {
  if (!value) return '';

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const reportDateFilterLabels: Record<ReportDateFilter, string> = {
  all: 'Alle Zeiträume',
  today: 'Heute',
  yesterday: 'Gestern',
  week: 'Diese Woche',
  month: 'Dieser Monat',
  last30: 'Letzte 30 Tage',
  custom: 'Eigenes Datum',
};

function getReportDateFilterLabel(filter: ReportDateFilter, startValue: string, endValue: string) {
  if (filter !== 'custom') return reportDateFilterLabels[filter];

  if (startValue && endValue) return `${formatInputDateLabel(startValue)} – ${formatInputDateLabel(endValue)}`;
  if (startValue) return `Ab ${formatInputDateLabel(startValue)}`;
  if (endValue) return `Bis ${formatInputDateLabel(endValue)}`;

  return reportDateFilterLabels.custom;
}

function isWithinCustomDateRange(value: string | null | undefined, startValue: string, endValue: string) {
  if (!value || (!startValue && !endValue)) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const start = startValue ? new Date(`${startValue}T00:00:00`) : null;
  const end = endValue ? new Date(`${endValue}T23:59:59.999`) : null;

  if (start && !Number.isNaN(start.getTime()) && date < start) return false;
  if (end && !Number.isNaN(end.getTime()) && date > end) return false;

  return true;
}

function mapReport(row: RawReport): ReportRow {
  const beforePhotos = parseJsonArray(row.before_photos);
  const afterPhotos = parseJsonArray(row.after_photos);
  const damageReports = parseJsonArray(row.damage_reports);
  const timeLogs = parseJsonArray(row.time_logs);

  const serviceCategory = getFirstValue(row, ['service_category'], 'Einsatz');
  const billingName = getFirstValue(row, ['billing_name', 'company_name', 'client_name'], 'Ohne Kunde');
  const siteName = getFirstValue(row, ['site_name'], '');
  const jobTitle = getFirstValue(row, ['job_title', 'title'], `${serviceCategory} · ${billingName}`);

  return {
    reportId: getFirstValue(row, ['report_id', 'id']),
    jobId: getFirstValue(row, ['job_id']),
    clientId: getFirstValue(row, ['client_id']),
    clientSiteId: getFirstValue(row, ['client_site_id']),
    reportStatus: getFirstValue(row, ['report_status', 'status'], 'draft'),
    reportTitle: getFirstValue(row, ['report_title'], jobTitle),
    reportSummary: getFirstValue(row, ['report_summary']),
    totalHours:
      row.total_hours === null || row.total_hours === undefined
        ? null
        : Number(row.total_hours),
    beforePhotoCount: beforePhotos.length,
    afterPhotoCount: afterPhotos.length,
    damageCount: damageReports.length,
    timeLogCount: timeLogs.length,
    approvedAt: getFirstValue(row, ['approved_at']) || null,
    sentToClientAt: getFirstValue(row, ['sent_to_client_at']) || null,
    jobTitle,
    jobStatus: getFirstValue(row, ['job_status']),
    plannedStart: getFirstValue(row, ['planned_start']) || null,
    plannedEnd: getFirstValue(row, ['planned_end']) || null,
    serviceCategory,
    billingName,
    siteName,
    addressText: getFirstValue(row, ['address_text']),
    postalCode: getFirstValue(row, ['postal_code']),
    city: getFirstValue(row, ['city']),
    reportCreatedAt: getFirstValue(row, ['report_created_at', 'created_at']) || null,
    reportUpdatedAt: getFirstValue(row, ['report_updated_at', 'updated_at']) || null,
    frontendStatusLabel: getFirstValue(row, ['frontend_status_label']),
  };
}

function hasMissingPhotos(report: ReportRow) {
  return report.beforePhotoCount === 0 || report.afterPhotoCount === 0;
}

function getLocationText(report: ReportRow) {
  const addressLine = [report.addressText, report.postalCode, report.city].filter(Boolean).join(', ');

  if (report.siteName && addressLine) return `${report.siteName} · ${addressLine}`;
  if (report.siteName) return report.siteName;

  return addressLine || 'Adresse nicht hinterlegt';
}

function getReportUpdateText(report: ReportRow) {
  if (report.sentToClientAt) return `Gesendet ${formatDate(report.sentToClientAt)}`;
  if (report.approvedAt) return `Freigegeben ${formatDate(report.approvedAt)}`;
  if (report.reportUpdatedAt) return `Aktualisiert ${formatDate(report.reportUpdatedAt)}`;
  if (report.reportCreatedAt) return `Erstellt ${formatDate(report.reportCreatedAt)}`;

  return 'Noch nicht aktualisiert';
}

function StatusBadge({ report }: { report: ReportRow }) {
  const group = getStatusGroup(report.reportStatus);

  const style =
    group === 'sent_to_client'
      ? { bg: '#F9FAFB', text: BRAND.black, border: BRAND.borderStrong }
      : group === 'approved'
        ? { bg: '#F0FDF4', text: BRAND.green, border: '#BBF7D0' }
        : group === 'review'
          ? { bg: '#FFFBEB', text: BRAND.amber, border: '#FDE68A' }
          : { bg: '#F9FAFB', text: BRAND.muted, border: BRAND.border };

  return (
    <span
      className="opc-report-status-badge"
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
      {formatStatus(report.reportStatus, report.frontendStatusLabel)}
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
  tone?: 'neutral' | 'danger' | 'warning' | 'success' | 'dark';
}) {
  const valueColor =
    tone === 'danger'
      ? BRAND.red
      : tone === 'warning'
        ? BRAND.amber
        : tone === 'success'
          ? BRAND.green
          : tone === 'dark'
            ? BRAND.black
            : BRAND.text;

  return (
    <div
      className="opc-reports-metric-card"
      style={{
        ...cardStyle,
        minHeight: '96px',
        padding: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
      }}
    >
      <div>
        <div
          className="opc-reports-metric-value"
          style={{
            fontSize: '25px',
            lineHeight: 1,
            fontWeight: 820,
            letterSpacing: '-0.04em',
            color: valueColor,
            marginBottom: '10px',
          }}
        >
          {value}
        </div>

        <div
          className="opc-reports-metric-label"
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
        className="opc-reports-metric-icon"
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

function FileSummary({ report }: { report: ReportRow }) {
  return (
    <div className="opc-report-file-summary">
      <span style={filePillStyle}>
        <ImageIcon size={13} />
        {report.beforePhotoCount + report.afterPhotoCount} Fotos
      </span>

      <span style={filePillStyle}>
        <AlertTriangle size={13} />
        {report.damageCount} Schäden
      </span>

      <span style={filePillStyle}>
        <Clock3 size={13} />
        {report.timeLogCount} Zeiten
      </span>
    </div>
  );
}

function ReportCard({ report }: { report: ReportRow }) {
  const title = report.reportTitle || report.jobTitle || 'Bericht';
  const detailHref = report.reportId
    ? `${baseUrl}/bericht/${report.reportId}`
    : report.jobId
      ? `${baseUrl}/bericht/job/${report.jobId}`
      : `${baseUrl}/berichte-dateien`;
  const jobHref = report.jobId ? `${baseUrl}/einsatz/${report.jobId}` : `${baseUrl}/einsaetze`;

  return (
    <article className="opc-report-card" style={cardStyle}>
      <div className="opc-report-card-main">
        <div style={{ minWidth: 0 }}>
          <h3>{title}</h3>

          <div className="opc-report-meta">
            <span>
              <FileText size={14} />
              {report.serviceCategory || 'Einsatz'}
            </span>

            <span>
              <CalendarDays size={14} />
              {formatDateTime(report.plannedStart)}
            </span>

            <span>
              <MapPin size={14} />
              {getLocationText(report)}
            </span>
          </div>

          {report.reportSummary ? <p className="opc-report-summary-text">{report.reportSummary}</p> : null}
        </div>

        <div className="opc-report-card-side">
          <StatusBadge report={report} />
          <span>{formatHours(report.totalHours)} · {getReportUpdateText(report)}</span>
        </div>
      </div>

      <div className="opc-report-card-footer">
        <FileSummary report={report} />
      </div>

      <div className="opc-report-card-actions">
        <a className="opc-report-action dark" href={detailHref}>
          Details öffnen
        </a>

        <a className="opc-report-action" href={jobHref}>
          Einsatz öffnen
        </a>
      </div>
    </article>
  );
}

export default function BerichteDateienPage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [dateFilter, setDateFilter] = useState<ReportDateFilter>('all');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    void loadReports();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

  async function loadReports() {
    setLoading(true);
    setErrorMessage('');

    try {
      const { data, error } = await supabase
        .from('opc_portal_report_feed')
        .select('*')
        .limit(300);

      if (error) throw error;

      const mappedReports = (data || [])
        .map(mapReport)
        .filter((report) => report.reportId || report.jobId)
        .sort((a, b) => {
          const aTime = new Date(a.reportUpdatedAt || a.reportCreatedAt || a.plannedStart || 0).getTime();
          const bTime = new Date(b.reportUpdatedAt || b.reportCreatedAt || b.plannedStart || 0).getTime();

          return bTime - aTime;
        });

      setReports(mappedReports);
    } catch (error: any) {
      console.error('Berichte konnten nicht geladen werden:', error);
      setErrorMessage(error?.message || 'Berichte konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  const metrics = useMemo(() => {
    const openReports = reports.filter((report) => {
      const group = getStatusGroup(report.reportStatus);
      return group === 'open' || group === 'review';
    }).length;

    const reviewReports = reports.filter((report) => getStatusGroup(report.reportStatus) === 'review').length;

    const approvedReports = reports.filter((report) => {
      const group = getStatusGroup(report.reportStatus);
      return group === 'approved' || group === 'sent_to_client';
    }).length;

    const missingPhotos = reports.filter(hasMissingPhotos).length;

    return {
      openReports,
      reviewReports,
      approvedReports,
      missingPhotos,
    };
  }, [reports]);

  const filteredReports = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return reports.filter((report) => {
      const statusGroup = getStatusGroup(report.reportStatus);
      const reportDate = getReportReferenceDate(report);

      const matchesStatus =
        statusFilter === 'all' ||
        statusFilter === statusGroup ||
        (statusFilter === 'missing_photos' && hasMissingPhotos(report));

      if (!matchesStatus) return false;

      const matchesContent =
        contentFilter === 'all' ||
        (contentFilter === 'photos' && report.beforePhotoCount + report.afterPhotoCount > 0) ||
        (contentFilter === 'damage' && report.damageCount > 0) ||
        (contentFilter === 'time_logs' && report.timeLogCount > 0) ||
        (contentFilter === 'missing_time' && report.timeLogCount === 0);

      if (!matchesContent) return false;

      const matchesDate =
        dateFilter === 'all' ||
        (dateFilter === 'today' && isSameLocalDay(reportDate, now)) ||
        (dateFilter === 'yesterday' && isPreviousLocalDay(reportDate, now)) ||
        (dateFilter === 'week' && isWithinWeek(reportDate, now)) ||
        (dateFilter === 'month' && isWithinCurrentMonth(reportDate, now)) ||
        (dateFilter === 'last30' && isWithinLastDays(reportDate, now, 30)) ||
        (dateFilter === 'custom' && isWithinCustomDateRange(reportDate, customDateStart, customDateEnd));

      if (!matchesDate) return false;

      if (!query) return true;

      return [
        report.reportTitle,
        report.reportSummary,
        report.jobTitle,
        report.serviceCategory,
        report.billingName,
        report.siteName,
        report.addressText,
        report.postalCode,
        report.city,
        formatStatus(report.reportStatus, report.frontendStatusLabel),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [reports, searchQuery, statusFilter, contentFilter, dateFilter, customDateStart, customDateEnd, now]);

  if (loading) {
    return (
      <MirakaDashboardShell hideTopBar={true} requiredRole={['owner', 'admin', 'dispatch', 'client']}>
        <div
          style={{
            minHeight: '60vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: BRAND.muted,
            fontSize: '14px',
            fontWeight: 650,
            fontFamily: pageFont,
          }}
        >
          Berichte werden geladen...
        </div>
      </MirakaDashboardShell>
    );
  }

  return (
    <MirakaDashboardShell
      hideTopBar={true}
      requiredRole={['owner', 'admin', 'dispatch', 'client']}
      currentPath="/berichte-dateien"
    >
      <div className="opc-reports-page" style={{ fontFamily: pageFont, color: BRAND.text }}>
        {errorMessage ? <div className="opc-reports-error">{errorMessage}</div> : null}

        <div className="opc-reports-metrics">
          <MetricCard value={metrics.openReports} label="Berichte offen" icon={<FileText size={17} />} />
          <MetricCard
            value={metrics.reviewReports}
            label="Zur Freigabe"
            icon={<Clock3 size={17} />}
            tone={metrics.reviewReports > 0 ? 'warning' : 'neutral'}
          />
          <MetricCard
            value={metrics.approvedReports}
            label="Freigegeben"
            icon={<CheckCircle2 size={17} />}
            tone="success"
          />
          <MetricCard
            value={metrics.missingPhotos}
            label="Fehlende Fotos"
            icon={<ImageIcon size={17} />}
            tone={metrics.missingPhotos > 0 ? 'danger' : 'neutral'}
          />
        </div>

        <section className="opc-reports-filter-panel" style={cardStyle}>
          <div className="opc-reports-search">
            <Search size={17} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Berichte suchen..."
            />
          </div>

          <div className="opc-reports-date-picker">
            <button
              type="button"
              className={dateMenuOpen ? 'active' : ''}
              onClick={() => setDateMenuOpen((current) => !current)}
              aria-expanded={dateMenuOpen}
            >
              <CalendarDays size={16} />
              <span>Zeitraum: {getReportDateFilterLabel(dateFilter, customDateStart, customDateEnd)}</span>
              <ChevronDown size={16} />
            </button>

            {dateMenuOpen ? (
              <div className="opc-reports-date-menu">
                {(['all', 'today', 'yesterday', 'week', 'month', 'last30'] as ReportDateFilter[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={dateFilter === option ? 'active' : ''}
                    onClick={() => {
                      setDateFilter(option);
                      setDateMenuOpen(false);
                    }}
                  >
                    {reportDateFilterLabels[option]}
                  </button>
                ))}

                <button
                  type="button"
                  className={dateFilter === 'custom' ? 'active' : ''}
                  onClick={() => setDateFilter('custom')}
                >
                  Eigenes Datum
                </button>

                {dateFilter === 'custom' ? (
                  <div className="opc-reports-date-menu-custom">
                    <input
                      type="date"
                      value={customDateStart}
                      onChange={(event) => {
                        setCustomDateStart(event.target.value);
                        setDateFilter('custom');
                      }}
                    />
                    <input
                      type="date"
                      value={customDateEnd}
                      onChange={(event) => {
                        setCustomDateEnd(event.target.value);
                        setDateFilter('custom');
                      }}
                    />
                    <button type="button" onClick={() => setDateMenuOpen(false)}>
                      Anwenden
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="opc-reports-select-row">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Alle Status</option>
              <option value="open">Offen</option>
              <option value="review">Zur Freigabe</option>
              <option value="approved">Freigegeben</option>
              <option value="sent_to_client">An Kunde gesendet</option>
              <option value="missing_photos">Fehlende Fotos</option>
            </select>

            <select value={contentFilter} onChange={(event) => setContentFilter(event.target.value as ContentFilter)}>
              <option value="all">Alle Inhalte</option>
              <option value="photos">Mit Fotos</option>
              <option value="damage">Mit Schäden</option>
              <option value="time_logs">Mit Zeitlogs</option>
              <option value="missing_time">Ohne Zeiten</option>
            </select>
          </div>
        </section>

        {filteredReports.length === 0 ? (
          <div className="opc-reports-empty" style={cardStyle}>
            Keine Berichte für diese Auswahl gefunden.
          </div>
        ) : (
          <div className="opc-reports-list">
            {filteredReports.map((report) => (
              <ReportCard key={report.reportId || report.jobId} report={report} />
            ))}
          </div>
        )}

        {filteredReports.length > 0 ? (
          <div className="opc-reports-count">
            {filteredReports.length} von {reports.length} Berichten
          </div>
        ) : null}
      </div>

      <style>{`
        .opc-reports-page {
          padding: 0 0 140px;
        }

        .opc-reports-page * {
          box-sizing: border-box;
        }

        .opc-reports-hero {
          padding: 24px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 14px;
        }

        .opc-reports-hero h1 {
          margin: 0;
          color: ${BRAND.text};
          font-size: 31px;
          line-height: 1.05;
          letter-spacing: -0.045em;
          font-weight: 860;
        }

        .opc-reports-hero-actions {
          display: grid;
          grid-template-columns: repeat(2, max-content);
          gap: 10px;
          justify-content: flex-end;
          align-items: center;
        }

        .opc-reports-action,
        .opc-report-action {
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
        }

        .opc-reports-action.dark,
        .opc-report-action.dark {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-reports-error {
          border: 1px solid #FECACA;
          background: #FEF2F2;
          color: ${BRAND.red};
          padding: 14px 16px;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 720;
          margin-bottom: 14px;
        }

        .opc-reports-metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }

        .opc-reports-filter-panel {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          padding: 16px;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          margin-bottom: 18px;
          overflow: visible;
        }

        .opc-reports-search {
          flex: 1 1 260px;
          min-width: 0;
          height: 44px;
          border: 1px solid ${BRAND.border};
          border-radius: 14px;
          background: #FFFFFF;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 12px;
          color: ${BRAND.muted};
        }

        .opc-reports-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          color: ${BRAND.text};
          font-size: 14px;
          font-weight: 650;
          font-family: ${pageFont};
        }


        .opc-reports-date-picker {
          position: relative;
          flex: 0 1 260px;
          min-width: 220px;
        }

        .opc-reports-date-picker > button {
          width: 100%;
          height: 44px;
          min-width: 0;
          border: 1px solid ${BRAND.border};
          border-radius: 14px;
          background: #FFFFFF;
          color: ${BRAND.text};
          padding: 0 12px;
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 13px;
          font-weight: 800;
          font-family: ${pageFont};
          cursor: pointer;
          white-space: nowrap;
        }

        .opc-reports-date-picker > button span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .opc-reports-date-picker > button.active {
          border-color: ${BRAND.black};
        }

        .opc-reports-date-menu {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          z-index: 40;
          display: grid;
          gap: 7px;
          padding: 10px;
          border: 1px solid ${BRAND.border};
          border-radius: 16px;
          background: #FFFFFF;
          box-shadow: 0 18px 45px rgba(15, 17, 21, 0.13);
        }

        .opc-reports-date-menu > button,
        .opc-reports-date-menu-custom > button {
          width: 100%;
          height: 40px;
          border: 1px solid ${BRAND.border};
          border-radius: 12px;
          background: #FFFFFF;
          color: ${BRAND.text};
          padding: 0 11px;
          font-size: 13px;
          font-weight: 760;
          font-family: ${pageFont};
          text-align: left;
          cursor: pointer;
        }

        .opc-reports-date-menu > button.active,
        .opc-reports-date-menu-custom > button {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
          text-align: center;
        }

        .opc-reports-date-menu-custom {
          display: grid;
          grid-template-columns: 1fr;
          gap: 7px;
          padding-top: 2px;
        }

        .opc-reports-date-menu-custom input {
          width: 100%;
          height: 40px;
          border: 1px solid ${BRAND.border};
          border-radius: 12px;
          background: #FFFFFF;
          color: ${BRAND.text};
          padding: 0 10px;
          font-size: 13px;
          font-weight: 760;
          font-family: ${pageFont};
          outline: 0;
        }

        .opc-reports-select-row {
          flex: 1 1 390px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          min-width: 0;
        }

        .opc-reports-date-buttons {
          flex: 1 1 300px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          min-width: 0;
        }

        .opc-reports-date-buttons button {
          height: 44px;
          min-width: 0;
          border: 1px solid ${BRAND.border};
          border-radius: 14px;
          background: #FFFFFF;
          color: ${BRAND.muted};
          padding: 0 12px;
          font-size: 13px;
          font-weight: 820;
          font-family: ${pageFont};
          cursor: pointer;
          white-space: nowrap;
        }

        .opc-reports-date-buttons button.active {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-reports-custom-date-row {
          flex: 1 1 250px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          min-width: 0;
        }

        .opc-reports-custom-date-row input {
          height: 44px;
          border: 1px solid ${BRAND.border};
          border-radius: 14px;
          background: #FFFFFF;
          color: ${BRAND.text};
          padding: 0 12px;
          font-size: 13px;
          font-weight: 760;
          font-family: ${pageFont};
          outline: 0;
          width: 100%;
          min-width: 0;
        }

        .opc-reports-filter-panel select {
          flex: 1 1 190px;
          height: 44px;
          border: 1px solid ${BRAND.border};
          border-radius: 14px;
          background: #FFFFFF;
          color: ${BRAND.text};
          padding: 0 12px;
          font-size: 13px;
          font-weight: 760;
          font-family: ${pageFont};
          outline: 0;
          width: 100%;
          min-width: 0;
        }

        .opc-reports-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .opc-report-card {
          padding: 18px;
        }

        .opc-report-card-main {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 18px;
          align-items: start;
        }

        .opc-report-card h3 {
          margin: 0;
          color: ${BRAND.text};
          font-size: 20px;
          line-height: 1.18;
          letter-spacing: -0.04em;
          font-weight: 860;
        }

        .opc-report-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          margin-top: 9px;
          color: ${BRAND.muted};
          font-size: 13px;
          line-height: 1.35;
          font-weight: 650;
        }

        .opc-report-meta span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .opc-report-summary-text {
          margin: 10px 0 0;
          color: ${BRAND.muted};
          font-size: 13px;
          line-height: 1.45;
          font-weight: 620;
        }

        .opc-report-card-side {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
        }

        .opc-report-card-side > span {
          color: ${BRAND.muted};
          font-size: 12px;
          font-weight: 720;
          white-space: nowrap;
        }

        .opc-report-card-footer {
          margin-top: 14px;
        }

        .opc-report-file-summary {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .opc-report-card-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 16px;
        }

        .opc-reports-empty {
          min-height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${BRAND.muted};
          font-size: 14px;
          font-weight: 650;
          text-align: center;
          padding: 22px;
        }

        .opc-reports-count {
          margin-top: 15px;
          font-size: 13px;
          font-weight: 620;
          color: ${BRAND.muted};
        }

        @media (max-width: 1280px) {
          .opc-reports-filter-panel {
            align-items: stretch;
          }

          .opc-reports-date-picker,
          .opc-reports-select-row {
            flex: 1 1 100%;
          }
        }

        @media (max-width: 720px) {
          .opc-reports-page {
            padding-bottom: 110px;
          }

          .opc-reports-hero {
            grid-template-columns: 1fr;
            align-items: stretch;
            padding: 18px;
          }

          .opc-reports-hero h1 {
            font-size: 25px;
          }

          .opc-reports-hero-actions {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            width: 100%;
          }

          .opc-reports-action {
            width: 100%;
          }

          .opc-report-card-actions {
            flex-direction: column;
          }

          .opc-report-action {
            width: 100%;
          }

          .opc-report-card-main {
            grid-template-columns: 1fr;
          }

          .opc-report-card-side {
            align-items: flex-start;
          }

          .opc-report-card {
            padding: 15px;
          }

          .opc-report-card h3 {
            font-size: 18px;
          }
        }
      `}</style>
    </MirakaDashboardShell>
  );
}
