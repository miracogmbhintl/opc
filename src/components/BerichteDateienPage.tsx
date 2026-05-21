import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import MirakaDashboardShell from './MirakaDashboardShell';
import PortalSkeleton from './shared/PortalSkeleton';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Image as ImageIcon,
  Search,
  Send,
  Upload,
} from 'lucide-react';

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

  return addressLine || '-';
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

function FileSummary({ report }: { report: ReportRow }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
      }}
    >
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

export default function BerichteDateienPage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');

  useEffect(() => {
    void loadReports();
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
  }, [reports, searchQuery, statusFilter, contentFilter]);

  const openReport = (report: ReportRow) => {
    if (!report.jobId) return;

    window.location.href = `${baseUrl}/einsatz/${report.jobId}`;
  };

  if (loading) {
    return (
      <MirakaDashboardShell hideTopBar={true}>
        <PortalSkeleton variant="dashboard" />
      </MirakaDashboardShell>
    );
  }

    return (
    <MirakaDashboardShell hideTopBar={true}>
      <div
        className="opc-reports-page"
        style={{
          padding: 0,
          fontFamily: pageFont,
          color: BRAND.text,
        }}
      >
        <div
          className="opc-reports-header"
          style={{
            marginBottom: '28px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '20px',
          }}
        >
        </div>
        <div
          className="opc-reports-metrics"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: '16px',
            marginBottom: '22px',
          }}
        >
          <MetricCard
            value={metrics.openReports}
            label="Berichte offen"
            icon={<FileText size={18} />}
          />

          <MetricCard
            value={metrics.reviewReports}
            label="Zur Freigabe"
            icon={<Clock3 size={18} />}
            tone={metrics.reviewReports > 0 ? 'warning' : 'neutral'}
          />

          <MetricCard
            value={metrics.approvedReports}
            label="Freigegeben"
            icon={<CheckCircle2 size={18} />}
            tone="success"
          />

          <MetricCard
            value={metrics.missingPhotos}
            label="Fehlende Fotos"
            icon={<ImageIcon size={18} />}
            tone={metrics.missingPhotos > 0 ? 'danger' : 'neutral'}
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
            className="opc-reports-controls"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 180px 190px 230px',
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
                placeholder="Suche nach Kunde, Standort, Einsatz oder Bericht"
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
              <option value="review">Zur Freigabe</option>
              <option value="approved">Freigegeben</option>
              <option value="sent_to_client">An Kunde gesendet</option>
              <option value="missing_photos">Fehlende Fotos</option>
            </select>

            <select
              value={contentFilter}
              onChange={(event) => setContentFilter(event.target.value as ContentFilter)}
              style={selectStyle}
            >
              <option value="all">Alle Inhalte</option>
              <option value="photos">Mit Fotos</option>
              <option value="damage">Mit Schäden</option>
              <option value="time_logs">Mit Zeitlogs</option>
              <option value="missing_time">Ohne Zeiten</option>
            </select>

            <a
              href={`${baseUrl}/einsaetze`}
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
              <Upload size={17} />
              Datei hinzufügen
            </a>
          </div>
        </section>

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
          {filteredReports.length === 0 ? (
            <div
              style={{
                padding: '78px 22px',
                textAlign: 'center',
              }}
            >
              <FileText
                size={50}
                strokeWidth={1.5}
                color="#D1D5DB"
                style={{ marginBottom: '18px' }}
              />

              <h3
                style={{
                  margin: '0 0 8px',
                  fontSize: '17px',
                  fontWeight: 760,
                  color: BRAND.text,
                }}
              >
                Keine Berichte gefunden
              </h3>

              <p
                style={{
                  margin: '0 0 22px',
                  fontSize: '14px',
                  fontWeight: 560,
                  color: BRAND.muted,
                }}
              >
                Sobald Einsätze abgeschlossen oder Dateien hochgeladen werden, erscheinen sie hier.
              </p>

              <a
                href={`${baseUrl}/einsaetze`}
                style={{
                  height: '44px',
                  padding: '0 16px',
                  borderRadius: '13px',
                  border: 'none',
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
                Einsätze öffnen
              </a>
            </div>
          ) : (
            <>
              <div className="opc-reports-desktop-table">
                {filteredReports.map((report, index) => (
                  <button
                    key={report.reportId || report.jobId}
                    type="button"
                    onClick={() => openReport(report)}
                    disabled={!report.jobId}
                    style={{
                      width: '100%',
                      display: 'grid',
                      gridTemplateColumns:
                        'minmax(260px, 1.1fr) minmax(230px, 1fr) 150px 190px 90px 138px',
                      alignItems: 'center',
                      gap: '20px',
                      padding: '20px 22px',
                      border: 'none',
                      borderBottom:
                        index < filteredReports.length - 1 ? `1px solid #F3F4F6` : 'none',
                      background: '#FFFFFF',
                      textAlign: 'left',
                      cursor: report.jobId ? 'pointer' : 'default',
                      fontFamily: pageFont,
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = report.jobId ? '#FAFAFA' : '#FFFFFF';
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
                        {report.reportTitle || report.jobTitle}
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
                        {report.serviceCategory || 'Einsatz'}
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
                        {report.billingName}
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
                        {getLocationText(report)}
                      </div>
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 760,
                          color: BRAND.text,
                          whiteSpace: 'nowrap',
                          marginBottom: '7px',
                        }}
                      >
                        {formatDate(report.plannedStart)}
                      </div>

                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 560,
                          color: BRAND.muted,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {report.reportUpdatedAt ? `Aktualisiert ${formatDate(report.reportUpdatedAt)}` : 'Nicht aktualisiert'}
                      </div>
                    </div>

                    <FileSummary report={report} />

                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 800,
                        color: BRAND.text,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatHours(report.totalHours)}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <StatusBadge report={report} />
                    </div>
                  </button>
                ))}
              </div>

              <div className="opc-reports-mobile-cards">
                {filteredReports.map((report) => (
                  <button
                    key={report.reportId || report.jobId}
                    type="button"
                    onClick={() => openReport(report)}
                    disabled={!report.jobId}
                    style={{
                      width: '100%',
                      border: `1px solid ${BRAND.border}`,
                      borderRadius: '18px',
                      background: '#FFFFFF',
                      padding: '16px',
                      textAlign: 'left',
                      cursor: report.jobId ? 'pointer' : 'default',
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
                          {report.reportTitle || report.jobTitle}
                        </h3>

                        <p
                          style={{
                            margin: 0,
                            fontSize: '13px',
                            fontWeight: 600,
                            color: BRAND.muted,
                          }}
                        >
                          {report.billingName}
                        </p>
                      </div>

                      <StatusBadge report={report} />
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
                      <div>{getLocationText(report)}</div>
                      <div>{formatDateTime(report.plannedStart)}</div>
                      <div>{formatHours(report.totalHours)}</div>
                    </div>

                    <FileSummary report={report} />
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        {filteredReports.length > 0 && (
          <div
            style={{
              marginTop: '15px',
              fontSize: '13px',
              fontWeight: 620,
              color: BRAND.muted,
            }}
          >
            {filteredReports.length} von {reports.length} Berichten
          </div>
        )}

        <style>{`
          .opc-reports-mobile-cards {
            display: none;
          }

          @media (max-width: 1280px) {
            .opc-reports-metrics {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }

            .opc-reports-controls {
              grid-template-columns: minmax(0, 1fr) 170px 180px !important;
            }

            .opc-reports-controls a {
              grid-column: 1 / -1;
            }
          }

          @media (max-width: 980px) {
            .opc-reports-header {
              flex-direction: column !important;
              align-items: stretch !important;
            }

            .opc-reports-top-action {
              width: 100% !important;
            }

            .opc-reports-controls {
              grid-template-columns: 1fr !important;
            }

            .opc-reports-controls a {
              grid-column: auto;
            }

            .opc-reports-desktop-table {
              display: none !important;
            }

            .opc-reports-mobile-cards {
              display: flex !important;
              flex-direction: column;
              gap: 14px;
              padding: 14px;
            }
          }

          @media (max-width: 640px) {
            .opc-reports-metrics {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    </MirakaDashboardShell>
  );
}

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