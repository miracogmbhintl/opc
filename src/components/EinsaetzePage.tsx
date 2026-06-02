import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import MirakaDashboardShell from './MirakaDashboardShell';
import { Activity, CalendarDays, FileText, Plus, Search } from 'lucide-react';

interface RawJob {
  [key: string]: any;
}

interface Job {
  id: string;
  title: string;
  clientName: string;
  serviceName: string;
  address: string;
  city: string;
  status: string;
  reportStatus: string;
  plannedStart: string | null;
  plannedEnd: string | null;
}

type JobDateFilter = 'all' | 'today';

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  black: '#0F1115',
  card: '#FFFFFF',
  soft: '#FAFAFA',
};

const closedStatuses = new Set([
  'completed',
  'cancelled',
  'report_approved',
  'approved',
  'sent_to_client',
]);

const statusLabels: Record<string, string> = {
  all: 'Alle Status',
  scheduled: 'Geplant',
  assigned: 'Zugewiesen',
  confirmed: 'Bestätigt',
  on_site: 'Vor Ort',
  onsite: 'Vor Ort',
  in_progress: 'In Arbeit',
  completed: 'Abgeschlossen',
  report_pending: 'Bericht offen',
  report_approved: 'Bericht freigegeben',
  cancelled: 'Storniert',
  draft: 'Entwurf',
  submitted: 'Zur Prüfung',
  approved: 'Freigegeben',
  sent_to_client: 'An Kunde gesendet',
};

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

const cardStyle: CSSProperties = {
  background: BRAND.card,
  border: `1px solid ${BRAND.border}`,
  borderRadius: '20px',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

function getFirstValue(row: RawJob, keys: string[], fallback = '') {
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

function formatStatus(status?: string | null) {
  const normalized = normalizeStatus(status);

  if (!normalized) return 'Unbekannt';

  return statusLabels[normalized] || normalized.replace(/_/g, ' ');
}

function mapJob(row: RawJob): Job {
  const serviceName = getFirstValue(
    row,
    ['service_category', 'service_name', 'job_type', 'category'],
    'Einsatz'
  );

  const clientName = getFirstValue(
    row,
    ['billing_name', 'company_name', 'client_name', 'customer_name', 'site_name'],
    'Ohne Kunde'
  );

  const title = getFirstValue(
    row,
    ['title', 'job_title', 'project_title'],
    `${serviceName} · ${clientName}`
  );

  return {
    id: getFirstValue(row, ['job_id', 'id', 'project_id']),
    title,
    clientName,
    serviceName,
    address: getFirstValue(row, ['site_address', 'address', 'address_text', 'street']),
    city: getFirstValue(row, ['site_city', 'city', 'postal_city']),
    status: getFirstValue(row, ['status', 'job_status'], 'scheduled'),
    reportStatus: getFirstValue(row, ['report_status', 'report_state']),
    plannedStart: getFirstValue(row, ['planned_start', 'start_time', 'scheduled_at', 'date_time']) || null,
    plannedEnd: getFirstValue(row, ['planned_end', 'end_time']) || null,
  };
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

function formatTimeOnly(value?: string | null) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isSameLocalDay(value: string | null | undefined, referenceDate: Date) {
  if (!value) return false;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return false;

  return (
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth() &&
    date.getDate() === referenceDate.getDate()
  );
}

function isActiveJob(job: Job) {
  return !closedStatuses.has(normalizeStatus(job.status));
}

function isLiveJob(job: Job, now: Date) {
  if (!isActiveJob(job)) return false;

  const normalizedStatus = normalizeStatus(job.status);

  if (['on_site', 'onsite', 'in_progress'].includes(normalizedStatus)) {
    return true;
  }

  if (!job.plannedStart || !job.plannedEnd) return false;

  const startTime = new Date(job.plannedStart).getTime();
  const endTime = new Date(job.plannedEnd).getTime();
  const nowTime = now.getTime();

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return false;

  return startTime <= nowTime && nowTime <= endTime;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeStatus(status);

  const isCompleted = ['completed', 'approved', 'report_approved', 'sent_to_client'].includes(normalized);
  const isActive = ['assigned', 'confirmed', 'on_site', 'onsite', 'in_progress'].includes(normalized);
  const isCancelled = normalized === 'cancelled';

  const style = isCancelled
    ? { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' }
    : isCompleted
      ? { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' }
      : isActive
        ? { bg: '#ECFEFF', text: '#155E75', border: '#A5F3FC' }
        : { bg: '#F9FAFB', text: BRAND.muted, border: BRAND.border };

  return (
    <span
      className="opc-status-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '98px',
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
      {formatStatus(status)}
    </span>
  );
}

function MetricCard({
  value,
  label,
  icon,
}: {
  value: number;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <div
      className="opc-jobs-metric-card"
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
          className="opc-jobs-metric-value"
          style={{
            fontSize: '26px',
            lineHeight: 1,
            fontWeight: 820,
            letterSpacing: '-0.04em',
            color: BRAND.text,
            marginBottom: '12px',
          }}
        >
          {value}
        </div>

        <div
          className="opc-jobs-metric-label"
          style={{
            fontSize: '13px',
            fontWeight: 720,
            color: BRAND.muted,
          }}
        >
          {label}
        </div>
      </div>

      {icon && (
        <div
          className="opc-jobs-metric-icon"
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
      )}
    </div>
  );
}

function SmallFilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: '36px',
        width: '100%',
        borderRadius: '12px',
        border: `1px solid ${active ? BRAND.black : BRAND.border}`,
        background: active ? BRAND.black : '#FFFFFF',
        color: active ? '#FFFFFF' : BRAND.muted,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '13px',
        fontWeight: 760,
        fontFamily: pageFont,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

export default function EinsaetzePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<JobDateFilter>('all');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    void loadJobs();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

  async function loadJobs() {
    setLoading(true);
    setErrorMessage('');

    try {
      const { data, error } = await supabase
        .from('opc_my_portal_job_feed')
        .select('*')
        .limit(300);

      if (error) {
        throw error;
      }

      const mappedJobs = (data || [])
        .map(mapJob)
        .filter((job) => job.id)
        .sort((a, b) => {
          const aTime = a.plannedStart ? new Date(a.plannedStart).getTime() : 0;
          const bTime = b.plannedStart ? new Date(b.plannedStart).getTime() : 0;
          return bTime - aTime;
        });

      setJobs(mappedJobs);
    } catch (error: any) {
      console.error('Einsätze konnten nicht geladen werden:', error);
      setErrorMessage(error?.message || 'Einsätze konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  const availableStatuses = useMemo(() => {
    const statuses = Array.from(
      new Set<string>(jobs.map((job) => normalizeStatus(job.status)).filter(Boolean))
    );

    return statuses.sort((a, b) => formatStatus(a).localeCompare(formatStatus(b), 'de'));
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return jobs.filter((job) => {
      const matchesStatus =
        statusFilter === 'all' || normalizeStatus(job.status) === normalizeStatus(statusFilter);
      const matchesDate = dateFilter === 'all' || isSameLocalDay(job.plannedStart, now);

      if (!matchesStatus || !matchesDate) return false;

      if (!query) return true;

      return [
        job.title,
        job.clientName,
        job.serviceName,
        job.address,
        job.city,
        formatStatus(job.status),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [jobs, searchQuery, statusFilter, dateFilter, now]);

  const todayJobs = useMemo(() => jobs.filter((job) => isSameLocalDay(job.plannedStart, now)), [jobs, now]);
  const liveJobs = useMemo(() => jobs.filter((job) => isLiveJob(job, now)), [jobs, now]);
  const activeJobs = useMemo(() => jobs.filter(isActiveJob), [jobs]);
  const reportsCount = useMemo(() => {
    return jobs.filter((job) => {
      const status = normalizeStatus(job.reportStatus);
      return ['draft', 'submitted', 'report_pending', 'pending', 'open', 'in_review'].includes(status);
    }).length;
  }, [jobs]);

  if (loading) {
    return (
      <MirakaDashboardShell hideTopBar={true}>
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
          Einsätze werden geladen...
        </div>
      </MirakaDashboardShell>
    );
  }

  return (
    <MirakaDashboardShell hideTopBar={true}>
      <div
        className="opc-jobs-page"
        style={{
          padding: 0,
          fontFamily: pageFont,
          color: BRAND.text,
        }}
      >
        
        <div
          className="opc-jobs-metrics"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: '16px',
            marginBottom: '22px',
          }}
        >
          <MetricCard value={jobs.length} label="Alle Einsätze" icon={<CalendarDays size={18} />} />
          <MetricCard value={activeJobs.length} label="Aktive Einsätze" icon={<CalendarDays size={18} />} />
          <MetricCard value={liveJobs.length} label="Live Einsätze" icon={<Activity size={18} />} />
          <MetricCard value={reportsCount} label="Berichte" icon={<FileText size={18} />} />
        </div>

        <section
          style={{
            ...cardStyle,
            padding: '18px',
            marginBottom: '22px',
          }}
        >
          <div
            className="opc-jobs-controls"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 220px 176px',
              gap: '12px',
              alignItems: 'start',
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
                placeholder="Suche nach Kunde, Standort, Aufgabe oder Stadt"
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
              onChange={(event) => setStatusFilter(event.target.value)}
              style={{
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
              }}
            >
              <option value="all">Alle Status</option>
              {availableStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>

            <div className="opc-jobs-action-stack">
              <button
                type="button"
                onClick={() => {
                  window.location.href = `${baseUrl}/einsatz-planen`;
                }}
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
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = '#1A1A1A';
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = BRAND.black;
                }}
              >
                <Plus size={17} />
                Einsatz planen
              </button>

              <div
                className="opc-jobs-date-switch"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '8px',
                  marginTop: '8px',
                }}
              >
                <SmallFilterButton
                  active={dateFilter === 'today'}
                  label={`Heute (${todayJobs.length})`}
                  onClick={() => setDateFilter('today')}
                />
                <SmallFilterButton
                  active={dateFilter === 'all'}
                  label="Alle"
                  onClick={() => setDateFilter('all')}
                />
              </div>
            </div>
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
          className="opc-jobs-list-section"
          style={{
            display: 'block',
          }}
        >
          {filteredJobs.length === 0 ? (
            <div
              style={{
                ...cardStyle,
                padding: '78px 22px',
                textAlign: 'center',
              }}
            >
              <CalendarDays
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
                Keine Einsätze gefunden
              </h3>

              <p
                style={{
                  margin: '0 0 22px',
                  fontSize: '14px',
                  fontWeight: 560,
                  color: BRAND.muted,
                }}
              >
                Passen Sie die Suche oder den Statusfilter an.
              </p>

              <button
                type="button"
                onClick={() => {
                  window.location.href = `${baseUrl}/einsatz-planen`;
                }}
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
                  cursor: 'pointer',
                }}
              >
                <Plus size={17} />
                Einsatz planen
              </button>
            </div>
          ) : (
            <>
              <div
                className="opc-jobs-desktop-table"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {filteredJobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => {
                      window.location.href = `${baseUrl}/einsatz/${job.id}`;
                    }}
                    style={{
                      ...cardStyle,
                      width: '100%',
                      display: 'grid',
                      gridTemplateColumns: 'minmax(260px, 1.1fr) minmax(220px, 0.8fr) minmax(190px, 0.7fr) 130px',
                      alignItems: 'center',
                      gap: '22px',
                      padding: '20px 22px',
                      borderRadius: '18px',
                      background: '#FFFFFF',
                      boxSizing: 'border-box',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: pageFont,
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = '#FAFAFA';
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
                        {job.title}
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
                        {job.clientName}
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
                        {job.serviceName}
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
                        {[job.address, job.city].filter(Boolean).join(', ') || '-'}
                      </div>
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 800,
                          color: BRAND.text,
                          marginBottom: '7px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatDateTime(job.plannedStart)}
                      </div>

                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 560,
                          color: BRAND.muted,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {job.plannedEnd ? `bis ${formatTimeOnly(job.plannedEnd)}` : '-'}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <StatusBadge status={job.status} />
                    </div>
                  </button>
                ))}
              </div>

              <div className="opc-jobs-mobile-cards">
                {filteredJobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => {
                      window.location.href = `${baseUrl}/einsatz/${job.id}`;
                    }}
                    style={{
                      width: '100%',
                      border: `1px solid ${BRAND.border}`,
                      borderRadius: '18px',
                      background: '#FFFFFF',
                      boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
                      padding: '16px',
                      textAlign: 'left',
                      cursor: 'pointer',
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
                          {job.title}
                        </h3>

                        <p
                          style={{
                            margin: 0,
                            fontSize: '13px',
                            fontWeight: 600,
                            color: BRAND.muted,
                          }}
                        >
                          {job.clientName}
                        </p>
                      </div>

                      <StatusBadge status={job.status} />
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gap: '6px',
                        fontSize: '13px',
                        fontWeight: 560,
                        color: BRAND.muted,
                      }}
                    >
                      <div>{job.serviceName}</div>
                      <div>{[job.address, job.city].filter(Boolean).join(', ') || '-'}</div>
                      <div>{formatDateTime(job.plannedStart)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        {filteredJobs.length > 0 && (
          <div
            style={{
              marginTop: '15px',
              fontSize: '13px',
              fontWeight: 620,
              color: BRAND.muted,
            }}
          >
            {filteredJobs.length} von {jobs.length} Einsätzen
          </div>
        )}

        <style>{`
          .opc-jobs-mobile-cards {
            display: none;
          }

          @media (max-width: 1180px) {
            .opc-jobs-metrics {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }

            .opc-jobs-controls {
              grid-template-columns: minmax(0, 1fr) 190px 160px !important;
            }

            .opc-jobs-desktop-table button {
              grid-template-columns: minmax(220px, 1fr) minmax(180px, 0.8fr) minmax(170px, 0.65fr) 120px !important;
            }
          }

          @media (max-width: 860px) {
            .opc-jobs-header {
              margin-bottom: 20px !important;
            }

            .opc-jobs-metrics {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 10px !important;
              margin-bottom: 16px !important;
            }

            .opc-jobs-metrics > * {
              min-width: 0 !important;
            }

            .opc-jobs-metric-card {
              min-height: 96px !important;
              padding: 14px !important;
              border-radius: 18px !important;
              gap: 10px !important;
            }

            .opc-jobs-metric-value {
              font-size: 24px !important;
              margin-bottom: 8px !important;
            }

            .opc-jobs-metric-label {
              font-size: 12px !important;
              line-height: 1.2 !important;
            }

            .opc-jobs-metric-icon {
              width: 34px !important;
              height: 34px !important;
              border-radius: 12px !important;
            }

            .opc-jobs-controls {
              grid-template-columns: 1fr !important;
            }

            .opc-jobs-action-stack {
              width: 100% !important;
            }

            .opc-jobs-date-switch {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }

            .opc-jobs-desktop-table {
              display: none !important;
            }

            .opc-jobs-mobile-cards {
              display: flex !important;
              flex-direction: column;
              gap: 12px;
              padding: 0;
            }

            .opc-status-badge {
              min-width: 84px !important;
              padding: 0 10px !important;
              font-size: 11px !important;
            }
          }
        `}</style>
      </div>
    </MirakaDashboardShell>
  );
}