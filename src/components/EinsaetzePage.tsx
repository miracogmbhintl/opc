import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import MirakaDashboardShell from './MirakaDashboardShell';

interface RawJob {
  [key: string]: any;
}

interface Job {
  id: string;
  title: string;
  clientName: string;
  serviceName: string;
  siteName: string;
  address: string;
  city: string;
  status: string;
  reportStatus: string;
  priority: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  estimatedHours: string;
  assignedBy: string;
  contactName: string;
  contactPhone: string;
}

type JobDateFilter = 'all' | 'today' | 'week';
type ViewerRole = 'owner' | 'admin' | 'dispatch' | 'employee' | 'client' | '';

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  black: '#0F1115',
  card: '#FFFFFF',
  soft: '#FAFAFA',
  green: '#166534',
  red: '#B91C1C',
  amber: '#92400E',
  blue: '#155E75',
};

const closedStatuses = new Set([
  'completed',
  'cancelled',
  'report_approved',
  'approved',
  'sent_to_client',
]);

const submittedStatuses = new Set([
  'submitted',
  'completed',
  'approved',
  'report_approved',
  'sent_to_client',
]);

const liveStatuses = new Set([
  'on_site',
  'onsite',
  'in_progress',
  'started',
  'running',
]);

const statusLabels: Record<string, string> = {
  all: 'Alle Status',
  scheduled: 'Geplant',
  assigned: 'Zugewiesen',
  confirmed: 'Bestätigt',
  on_site: 'Vor Ort',
  onsite: 'Vor Ort',
  in_progress: 'In Arbeit',
  started: 'Gestartet',
  running: 'Läuft',
  completed: 'Abgeschlossen',
  report_pending: 'Bericht offen',
  report_approved: 'Bericht freigegeben',
  cancelled: 'Storniert',
  draft: 'Entwurf',
  submitted: 'Eingereicht',
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

function normalizeRole(role?: string | null): ViewerRole {
  const clean = String(role || '').trim().toLowerCase();

  if (clean === 'owner') return 'owner';
  if (clean === 'admin') return 'admin';
  if (['dispatch', 'dispatcher', 'disposition'].includes(clean)) return 'dispatch';
  if (['employee', 'mitarbeiter'].includes(clean)) return 'employee';
  if (['client', 'kunde'].includes(clean)) return 'client';

  return '';
}

function isManagerRole(role?: string | null) {
  return ['owner', 'admin', 'dispatch'].includes(normalizeRole(role));
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
    ['billing_name', 'company_name', 'client_name', 'customer_name', 'full_name'],
    'Ohne Kunde'
  );

  const siteName = getFirstValue(row, ['site_name', 'location_name', 'object_name']);

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
    siteName,
    address: getFirstValue(row, ['site_address', 'address', 'address_text', 'street']),
    city: getFirstValue(row, ['site_city', 'city', 'postal_city']),
    status: getFirstValue(row, ['status', 'job_status'], 'scheduled'),
    reportStatus: getFirstValue(row, ['report_status', 'report_state']),
    priority: getFirstValue(row, ['priority'], 'normal'),
    plannedStart: getFirstValue(row, ['planned_start', 'start_time', 'scheduled_at', 'date_time']) || null,
    plannedEnd: getFirstValue(row, ['planned_end', 'end_time']) || null,
    estimatedHours: getFirstValue(row, ['estimated_hours', 'planned_hours', 'duration_hours']),
    assignedBy: getFirstValue(row, ['assigned_by_name', 'dispatcher_name', 'created_by_name', 'assigned_by']),
    contactName: getFirstValue(row, ['site_contact_name', 'contact_name', 'person_of_contact', 'onsite_contact_name']),
    contactPhone: getFirstValue(row, ['site_contact_phone', 'contact_phone', 'phone_e164', 'phone_raw']),
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

function formatTime(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
  });
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

function isActiveJob(job: Job) {
  return !closedStatuses.has(normalizeStatus(job.status));
}

function isLiveJob(job: Job, now: Date) {
  if (!isActiveJob(job)) return false;

  const normalizedStatus = normalizeStatus(job.status);

  if (liveStatuses.has(normalizedStatus)) {
    return true;
  }

  if (!job.plannedStart || !job.plannedEnd) return false;

  const startTime = new Date(job.plannedStart).getTime();
  const endTime = new Date(job.plannedEnd).getTime();
  const nowTime = now.getTime();

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return false;

  return startTime <= nowTime && nowTime <= endTime;
}

function getJobLocation(job: Job) {
  return [job.address, job.city].filter(Boolean).join(', ') || job.siteName || '';
}

function getMapsUrl(job: Job) {
  const query = getJobLocation(job) || job.clientName || job.title;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeStatus(status);

  const isCompleted = submittedStatuses.has(normalized);
  const isActive = ['assigned', 'confirmed', 'on_site', 'onsite', 'in_progress', 'started', 'running'].includes(normalized);
  const isCancelled = normalized === 'cancelled';

  const style = isCancelled
    ? { bg: '#FEF2F2', text: BRAND.red, border: '#FECACA' }
    : isCompleted
      ? { bg: '#F0FDF4', text: BRAND.green, border: '#BBF7D0' }
      : isActive
        ? { bg: '#ECFEFF', text: BRAND.blue, border: '#A5F3FC' }
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
  tone = 'neutral',
}: {
  value: number;
  label: string;
  icon?: ReactNode;
  tone?: 'neutral' | 'danger' | 'dark';
}) {
  const valueColor = tone === 'danger' ? BRAND.red : tone === 'dark' ? BRAND.black : BRAND.text;

  return (
    <div
      className="opc-jobs-metric-card"
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
          className="opc-jobs-metric-value"
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

function JobCard({ job, employeeMode }: { job: Job; employeeMode: boolean }) {
  return (
    <article className="opc-job-card" style={cardStyle}>
      <div className="opc-job-card-main">
        <div style={{ minWidth: 0 }}>
          <h3>{job.title}</h3>

          <div className="opc-job-meta">
            <span>
              <Briefcase size={14} />
              {job.serviceName}
            </span>

            <span>
              <CalendarDays size={14} />
              {formatDateTime(job.plannedStart)}
            </span>

            <span>
              <MapPin size={14} />
              {getJobLocation(job) || 'Adresse nicht hinterlegt'}
            </span>
          </div>
        </div>

        <div className="opc-job-card-side">
          <StatusBadge status={job.status} />
          <span>{formatTime(job.plannedStart)} – {formatTime(job.plannedEnd)}</span>
        </div>
      </div>

      <div className="opc-job-card-actions">
        <a className="opc-job-action dark" href={`${baseUrl}/einsatz/${job.id}`}>
          {employeeMode ? 'Einsatz öffnen' : 'Details öffnen'}
        </a>

        <a className="opc-job-action" href={getMapsUrl(job)} target="_blank" rel="noreferrer">
          <Navigation size={15} />
          Navigation
        </a>
      </div>
    </article>
  );
}

export default function EinsaetzePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<JobDateFilter>('today');
  const [now, setNow] = useState(() => new Date());
  const [viewerRole, setViewerRole] = useState<ViewerRole>('');

  const employeeMode = viewerRole === 'employee';
  const canPlanJobs = isManagerRole(viewerRole);

  useEffect(() => {
    void loadViewer();
    void loadJobs();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

  async function loadViewer() {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user || null;

      if (!authUser) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role,opc_staff_role,staff_role')
        .eq('id', authUser.id)
        .maybeSingle();

      let role = normalizeRole(profile?.role || profile?.opc_staff_role || profile?.staff_role);

      const { data: staff } = await supabase
        .from('opc_staff_roles')
        .select('role,can_manage_jobs,can_view_all_jobs')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (staff?.role) {
        role = normalizeRole(staff.role);
      }

      if (
        !isManagerRole(role) &&
        (staff?.can_manage_jobs === true || staff?.can_view_all_jobs === true)
      ) {
        role = 'dispatch';
      }

      setViewerRole(role || 'client');
    } catch {
      setViewerRole('');
    }
  }

  async function loadJobs() {
    setLoading(true);
    setErrorMessage('');

    try {
      const { data, error } = await supabase
        .from('opc_my_portal_job_feed')
        .select('*')
        .limit(300);

      if (error) throw error;

      const mappedJobs = (data || [])
        .map(mapJob)
        .filter((job) => job.id)
        .sort((a, b) => {
          const aTime = a.plannedStart ? new Date(a.plannedStart).getTime() : 0;
          const bTime = b.plannedStart ? new Date(b.plannedStart).getTime() : 0;
          return aTime - bTime;
        });

      setJobs(mappedJobs);
    } catch (error: any) {
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

      const matchesDate =
        dateFilter === 'all' ||
        (dateFilter === 'today' && isSameLocalDay(job.plannedStart, now)) ||
        (dateFilter === 'week' && isWithinWeek(job.plannedStart, now));

      if (!matchesStatus || !matchesDate) return false;

      if (!query) return true;

      return [
        job.title,
        job.clientName,
        job.serviceName,
        job.address,
        job.city,
        job.siteName,
        formatStatus(job.status),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [jobs, searchQuery, statusFilter, dateFilter, now]);

  const todayJobs = useMemo(() => jobs.filter((job) => isSameLocalDay(job.plannedStart, now)), [jobs, now]);
  const weekJobs = useMemo(() => jobs.filter((job) => isWithinWeek(job.plannedStart, now)), [jobs, now]);
  const liveJobs = useMemo(() => jobs.filter((job) => isLiveJob(job, now)), [jobs, now]);

  const submittedCount = useMemo(
    () => jobs.filter((job) => submittedStatuses.has(normalizeStatus(job.status))).length,
    [jobs],
  );

  const reportsCount = useMemo(() => {
    return jobs.filter((job) => {
      const status = normalizeStatus(job.reportStatus);
      return ['draft', 'submitted', 'report_pending', 'pending', 'open', 'in_review'].includes(status);
    }).length;
  }, [jobs]);

  if (loading) {
    return (
      <MirakaDashboardShell hideTopBar={true} requiredRole={['owner', 'admin', 'dispatch', 'employee', 'client']}>
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
    <MirakaDashboardShell
      hideTopBar={true}
      requiredRole={['owner', 'admin', 'dispatch', 'employee', 'client']}
      currentPath="/einsaetze"
    >
      <div className="opc-jobs-page" style={{ fontFamily: pageFont, color: BRAND.text }}>
        <div className="opc-jobs-hero" style={cardStyle}>
          <div>
            <span>{employeeMode ? 'Mitarbeiter Einsätze' : 'Operative Einsatzplanung'}</span>
            <h1>{employeeMode ? 'Meine Aufträge' : 'Einsätze'}</h1>
            <p>
              {employeeMode
                ? 'Deine Aufträge mit Standort, Zeit, Status und Navigation.'
                : 'Geplante, laufende und abgeschlossene Einsätze im Überblick.'}
            </p>
          </div>

          <div className="opc-jobs-hero-actions">
            <button type="button" className="opc-jobs-action" onClick={() => void loadJobs()}>
              <RefreshCw size={16} />
              Aktualisieren
            </button>

            {canPlanJobs ? (
              <a className="opc-jobs-action dark" href={`${baseUrl}/einsatz-planen`}>
                <Plus size={16} />
                Einsatz planen
              </a>
            ) : null}
          </div>
        </div>

        {errorMessage ? <div className="opc-jobs-error">{errorMessage}</div> : null}

        <div className="opc-jobs-metrics">
          <MetricCard value={todayJobs.length} label="Heute" icon={<CalendarDays size={17} />} />
          <MetricCard
            value={liveJobs.length}
            label="Live"
            icon={<Activity size={17} />}
            tone={liveJobs.length > 0 ? 'dark' : 'neutral'}
          />
          <MetricCard value={weekJobs.length} label="Diese Woche" icon={<Clock3 size={17} />} />
          <MetricCard
            value={employeeMode ? submittedCount : reportsCount}
            label={employeeMode ? 'Eingereicht' : 'Berichte offen'}
            icon={employeeMode ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
            tone={!employeeMode && reportsCount > 0 ? 'danger' : 'neutral'}
          />
        </div>

        <section className="opc-jobs-filter-panel" style={cardStyle}>
          <div className="opc-jobs-search">
            <Search size={17} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={employeeMode ? 'Meine Aufträge suchen...' : 'Einsätze suchen...'}
            />
          </div>

          <div className="opc-jobs-filter-grid">
            <SmallFilterButton active={dateFilter === 'today'} label="Heute" onClick={() => setDateFilter('today')} />
            <SmallFilterButton active={dateFilter === 'week'} label="Woche" onClick={() => setDateFilter('week')} />
            <SmallFilterButton active={dateFilter === 'all'} label="Alle" onClick={() => setDateFilter('all')} />
          </div>

          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Alle Status</option>
            {availableStatuses.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </select>
        </section>

        {filteredJobs.length === 0 ? (
          <div className="opc-jobs-empty" style={cardStyle}>
            Keine Aufträge für diese Auswahl gefunden.
          </div>
        ) : (
          <div className="opc-jobs-list">
            {filteredJobs.map((job) => (
              <JobCard key={job.id} job={job} employeeMode={employeeMode} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        .opc-jobs-page {
          padding: 0 0 140px;
        }

        .opc-jobs-page * {
          box-sizing: border-box;
        }

        .opc-jobs-hero {
          padding: 24px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 14px;
        }

        .opc-jobs-hero span {
          display: block;
          color: ${BRAND.muted};
          font-size: 12px;
          font-weight: 780;
          margin-bottom: 8px;
        }

        .opc-jobs-hero h1 {
          margin: 0;
          color: ${BRAND.text};
          font-size: 31px;
          line-height: 1.05;
          letter-spacing: -0.045em;
          font-weight: 860;
        }

        .opc-jobs-hero p {
          margin: 8px 0 0;
          color: ${BRAND.muted};
          font-size: 14px;
          line-height: 1.45;
          font-weight: 620;
        }

        .opc-jobs-hero-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .opc-jobs-action,
        .opc-job-action {
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

        .opc-jobs-action.dark,
        .opc-job-action.dark {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-jobs-error {
          border: 1px solid #FECACA;
          background: #FEF2F2;
          color: ${BRAND.red};
          padding: 14px 16px;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 720;
          margin-bottom: 14px;
        }

        .opc-jobs-metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }

        .opc-jobs-filter-panel {
          padding: 16px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px 220px;
          gap: 12px;
          align-items: center;
          margin-bottom: 18px;
        }

        .opc-jobs-search {
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

        .opc-jobs-search input {
          width: 100%;
          border: 0;
          outline: 0;
          color: ${BRAND.text};
          font-size: 14px;
          font-weight: 650;
          font-family: ${pageFont};
        }

        .opc-jobs-filter-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .opc-jobs-filter-panel select {
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
        }

        .opc-jobs-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .opc-job-card {
          padding: 18px;
        }

        .opc-job-card-main {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 18px;
          align-items: start;
        }

        .opc-job-card h3 {
          margin: 0;
          color: ${BRAND.text};
          font-size: 20px;
          line-height: 1.18;
          letter-spacing: -0.04em;
          font-weight: 860;
        }

        .opc-job-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          margin-top: 9px;
          color: ${BRAND.muted};
          font-size: 13px;
          line-height: 1.35;
          font-weight: 650;
        }

        .opc-job-meta span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .opc-job-card-side {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
        }

        .opc-job-card-side > span {
          color: ${BRAND.muted};
          font-size: 12px;
          font-weight: 720;
          white-space: nowrap;
        }

        .opc-job-card-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 16px;
        }

        .opc-jobs-empty {
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

        @media (max-width: 1180px) {
          .opc-jobs-filter-panel {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .opc-jobs-page {
            padding-bottom: 110px;
          }

          .opc-jobs-hero {
            flex-direction: column;
            align-items: stretch;
            padding: 18px;
          }

          .opc-jobs-hero h1 {
            font-size: 25px;
          }

          .opc-jobs-hero-actions,
          .opc-job-card-actions {
            flex-direction: column;
          }

          .opc-jobs-action,
          .opc-job-action {
            width: 100%;
          }

          .opc-job-card-main {
            grid-template-columns: 1fr;
          }

          .opc-job-card-side {
            align-items: flex-start;
          }

          .opc-job-card {
            padding: 15px;
          }

          .opc-job-card h3 {
            font-size: 18px;
          }
        }
      `}</style>
    </MirakaDashboardShell>
  );
}