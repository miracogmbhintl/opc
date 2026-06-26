import { useEffect, useRef, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  MapPin,
  Navigation,
  Plus,
  Repeat,
  Save,
  Search,
  UserPlus,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import MirakaDashboardShell from './MirakaDashboardShell';

interface RawJob {
  [key: string]: any;
}

type JsonRecord = Record<string, any>;

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
  recurringSeriesId: string;
  recurrenceType: string;
  occurrenceDate: string;
  hasActiveTimeLog: boolean;
}

type JobDateFilter = 'all' | 'today' | 'week' | 'custom';
type JobTypeFilter = 'all' | 'recurring';
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
  in_progress: 'In Bearbeitung',
  active: 'Aktiv',
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

function getBooleanFlag(row: RawJob, keys: string[]) {
  return keys.some((key) => {
    const value = row?.[key];
    if (value === true) return true;
    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'ja', 'active', 'open'].includes(value.trim().toLowerCase());
    }
    if (typeof value === 'number') return value > 0;
    return Boolean(value);
  });
}

function hasOpenTimeLogInRow(row: RawJob) {
  const rawLogs = row?.time_logs;
  const logs = Array.isArray(rawLogs) ? rawLogs : [];

  return logs.some((log: any) => {
    const ended = log?.ended_at || log?.end_time || log?.clock_out_at || log?.finished_at;
    const status = normalizeStatus(log?.status);

    return !ended && !['submitted', 'completed', 'approved', 'rejected', 'closed'].includes(status);
  });
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
    recurringSeriesId: getFirstValue(row, ['recurring_series_id', 'series_id', 'recurrence_series_id']),
    recurrenceType: getFirstValue(row, ['recurrence_type', 'recurring_type', 'repeat_type']),
    occurrenceDate: getFirstValue(row, ['occurrence_date', 'service_date']),
    hasActiveTimeLog:
      getBooleanFlag(row, [
        'has_active_time_log',
        'active_time_log_id',
        'open_time_log_id',
        'is_clocked_in',
        'is_active',
        'currently_active',
      ]) || hasOpenTimeLogInRow(row),
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

function isActiveJob(job: Job) {
  return !closedStatuses.has(normalizeStatus(job.status));
}

function isLiveJob(job: Job, _now: Date) {
  if (!isActiveJob(job)) return false;
  if (job.hasActiveTimeLog) return true;

  const normalizedStatus = normalizeStatus(job.status);

  return liveStatuses.has(normalizedStatus);
}

function getOperationalStatus(job: Job) {
  const normalizedStatus = normalizeStatus(job.status);

  if (['cancelled', 'rejected', 'inactive'].includes(normalizedStatus)) {
    return normalizedStatus;
  }

  if (submittedStatuses.has(normalizedStatus)) {
    return 'completed';
  }

  if (job.hasActiveTimeLog) {
    return 'in_progress';
  }

  if (liveStatuses.has(normalizedStatus)) {
    return 'in_progress';
  }

  return 'scheduled';
}

function isCompletedJob(job: Job) {
  return getOperationalStatus(job) === 'completed';
}

function isOpenJob(job: Job) {
  const operationalStatus = getOperationalStatus(job);
  return !['completed', 'cancelled', 'rejected', 'inactive'].includes(operationalStatus);
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
      ? { bg: '#F3F4F6', text: BRAND.text, border: BRAND.border }
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
          <StatusBadge status={getOperationalStatus(job)} />
          <span>{formatTime(job.plannedStart)} – {formatTime(job.plannedEnd)}</span>
        </div>
      </div>

      <div className="opc-job-card-actions">
        <a className="opc-job-action dark" href={`${baseUrl}/einsatz/${job.id}`} data-astro-prefetch="false">
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

function EinsaetzeOverview() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<JobDateFilter>('today');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState<JobTypeFilter>('all');
  const [showDatePopover, setShowDatePopover] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [viewerRole, setViewerRole] = useState<ViewerRole>('');
  const didLoadViewerRef = useRef(false);
  const lastJobsLoadRoleRef = useRef<ViewerRole | ''>('');

  const employeeMode = viewerRole === 'employee';
  const canPlanJobs = isManagerRole(viewerRole);

  useEffect(() => {
    if (didLoadViewerRef.current) return;
    didLoadViewerRef.current = true;
    void loadViewer();
  }, []);

  useEffect(() => {
    if (!viewerRole) return;
    if (lastJobsLoadRoleRef.current === viewerRole) return;

    lastJobsLoadRoleRef.current = viewerRole;
    void loadJobs(viewerRole);
  }, [viewerRole]);

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

      if (!authUser) {
        setViewerRole('client');
        return;
      }

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
        role !== 'employee' &&
        !isManagerRole(role) &&
        (staff?.can_manage_jobs === true || staff?.can_view_all_jobs === true)
      ) {
        role = 'dispatch';
      }

      setViewerRole(role || 'client');
    } catch {
      setViewerRole('client');
    }
  }

  async function loadJobs(roleOverride: ViewerRole = viewerRole) {
    setLoading(true);
    setErrorMessage('');

    try {
      const managerMode = isManagerRole(roleOverride);
      let data: any[] | null = null;
      let error: any = null;

      if (managerMode) {
        const detailResponse = await supabase
          .from('opc_job_detail_view')
          .select('*')
          .limit(2000);

        data = detailResponse.data || null;
        error = detailResponse.error;

        if (error) {
          const fallbackResponse = await supabase
            .from('opc_service_jobs')
            .select('*')
            .limit(2000);

          data = fallbackResponse.data || null;
          error = fallbackResponse.error;
        }
      } else {
        const response = await supabase
          .from('opc_my_portal_job_feed')
          .select('*')
          .limit(500);

        data = response.data || null;
        error = response.error;
      }

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
        statusFilter === 'all' ||
        (statusFilter === 'open_jobs' && isOpenJob(job)) ||
        (statusFilter === 'completed_jobs' && isCompletedJob(job)) ||
        normalizeStatus(job.status) === normalizeStatus(statusFilter);

      const isRecurringJob = Boolean(job.recurringSeriesId || job.recurrenceType || job.occurrenceDate);

      const matchesDate =
        dateFilter === 'all' ||
        (dateFilter === 'today' && isSameLocalDay(job.plannedStart, now)) ||
        (dateFilter === 'week' && isWithinWeek(job.plannedStart, now)) ||
        (dateFilter === 'custom' && isWithinCustomDateRange(job.plannedStart, customDateStart, customDateEnd));

      const matchesType = jobTypeFilter === 'all' || (jobTypeFilter === 'recurring' && isRecurringJob);

      if (!matchesStatus || !matchesDate || !matchesType) return false;

      if (!query) return true;

      return [
        job.title,
        job.clientName,
        job.serviceName,
        job.address,
        job.city,
        job.siteName,
        formatStatus(getOperationalStatus(job)),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [jobs, searchQuery, statusFilter, dateFilter, customDateStart, customDateEnd, jobTypeFilter, now]);

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

          <div className="opc-jobs-date-buttons" aria-label="Zeitraum filtern">
            <button
              type="button"
              className={dateFilter === 'today' ? 'active' : ''}
              onClick={() => {
                setDateFilter('today');
                setShowDatePopover(false);
              }}
            >
              Heute
            </button>

            <button
              type="button"
              className={dateFilter === 'week' ? 'active' : ''}
              onClick={() => {
                setDateFilter('week');
                setShowDatePopover(false);
              }}
            >
              Woche
            </button>

            <button
              type="button"
              className={dateFilter === 'all' ? 'active' : ''}
              onClick={() => {
                setDateFilter('all');
                setShowDatePopover(false);
              }}
            >
              Alle
            </button>
          </div>

          {canPlanJobs ? (
            <div className="opc-jobs-date-plan-row">
              <div className="opc-date-popover-wrap">
                <button
                  type="button"
                  className={`opc-date-popup-trigger ${dateFilter === 'custom' ? 'active' : ''}`}
                  onClick={() => setShowDatePopover((current) => !current)}
                >
                  <CalendarDays size={15} />
                  {dateFilter === 'custom'
                    ? `${customDateStart || 'Start'} – ${customDateEnd || 'Ende'}`
                    : 'Datum auswählen'}
                </button>

                {showDatePopover ? (
                  <div className="opc-date-popover">
                    <div className="opc-date-popover-title">Datumsbereich</div>

                    <label>
                      <span>Von</span>
                      <input
                        type="date"
                        value={customDateStart}
                        onChange={(event) => {
                          setCustomDateStart(event.target.value);
                          setDateFilter('custom');
                        }}
                      />
                    </label>

                    <label>
                      <span>Bis</span>
                      <input
                        type="date"
                        value={customDateEnd}
                        onChange={(event) => {
                          setCustomDateEnd(event.target.value);
                          setDateFilter('custom');
                        }}
                      />
                    </label>

                    <div className="opc-date-popover-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setCustomDateStart('');
                          setCustomDateEnd('');
                          setDateFilter('today');
                          setShowDatePopover(false);
                        }}
                      >
                        Zurücksetzen
                      </button>

                      <button
                        type="button"
                        className="dark"
                        onClick={() => {
                          setDateFilter('custom');
                          setShowDatePopover(false);
                        }}
                      >
                        Anwenden
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <a className="opc-jobs-plan-button" href={`${baseUrl}/einsatz-planen`} data-astro-prefetch="false">
                <Plus size={16} />
                Einsatz planen
              </a>
            </div>
          ) : null}

          <div className="opc-jobs-select-row">
            <select value={jobTypeFilter} onChange={(event) => setJobTypeFilter(event.target.value as JobTypeFilter)}>
              <option value="all">Alle Auftragsarten</option>
              <option value="recurring">Wiederkehrende Einsätze</option>
            </select>

            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Alle Status</option>
              <option value="open_jobs">Offene Einsätze</option>
              <option value="completed_jobs">Abgeschlossene Einsätze</option>
              {availableStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>
          </div>
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

        .opc-jobs-hero h1 {
          margin: 0;
          color: ${BRAND.text};
          font-size: 31px;
          line-height: 1.05;
          letter-spacing: -0.045em;
          font-weight: 860;
        }

        .opc-jobs-hero-actions {
          display: grid;
          grid-template-columns: repeat(2, max-content);
          gap: 10px;
          justify-content: flex-end;
          align-items: center;
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
          width: 100%;
          max-width: 100%;
          min-width: 0;
          padding: 16px;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          margin-bottom: 18px;
          overflow: hidden;
        }

        .opc-jobs-search {
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

        .opc-jobs-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          color: ${BRAND.text};
          font-size: 14px;
          font-weight: 650;
          font-family: ${pageFont};
        }

        .opc-jobs-date-buttons {
          flex: 1 1 300px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          min-width: 0;
        }

        .opc-jobs-date-buttons button {
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

        .opc-jobs-date-buttons button.active {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-jobs-filter-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .opc-jobs-custom-date-row {
          flex: 1 1 250px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          min-width: 0;
        }

        .opc-jobs-custom-date-row input {
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

        .opc-jobs-filter-panel select {
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

        .opc-jobs-filter-panel {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 12px !important;
          align-items: stretch !important;
          overflow: visible !important;
        }

        .opc-jobs-search {
          flex: unset !important;
          width: 100% !important;
          height: 46px;
        }

        .opc-jobs-date-buttons {
          flex: unset !important;
          width: 100% !important;
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 8px !important;
        }

        .opc-jobs-date-buttons button {
          width: 100%;
          height: 46px;
        }

        .opc-jobs-date-plan-row {
          width: 100%;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 8px;
          align-items: stretch;
          position: relative;
        }

        .opc-date-popover-wrap {
          position: relative;
          min-width: 0;
        }

        .opc-date-popup-trigger,
        .opc-jobs-plan-button {
          width: 100%;
          min-height: 46px;
          border-radius: 14px;
          border: 1px solid ${BRAND.border};
          background: #FFFFFF;
          color: ${BRAND.text};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 12px;
          font-size: 13px;
          font-weight: 820;
          font-family: ${pageFont};
          text-decoration: none;
          cursor: pointer;
          white-space: nowrap;
        }

        .opc-date-popup-trigger.active,
        .opc-jobs-plan-button {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-date-popover {
          position: absolute;
          left: 0;
          top: calc(100% + 8px);
          width: min(360px, 86vw);
          z-index: 20;
          padding: 14px;
          border: 1px solid ${BRAND.border};
          border-radius: 18px;
          background: #FFFFFF;
          box-shadow: 0 18px 44px rgba(15, 17, 21, 0.14);
          display: grid;
          gap: 10px;
        }

        .opc-date-popover-title {
          color: ${BRAND.text};
          font-size: 13px;
          font-weight: 860;
          letter-spacing: -0.02em;
        }

        .opc-date-popover label {
          display: grid;
          gap: 6px;
          color: ${BRAND.muted};
          font-size: 12px;
          font-weight: 760;
        }

        .opc-date-popover input {
          width: 100%;
          height: 42px;
          border: 1px solid ${BRAND.border};
          border-radius: 13px;
          background: #FFFFFF;
          color: ${BRAND.text};
          padding: 0 11px;
          font-size: 13px;
          font-weight: 760;
          font-family: ${pageFont};
          outline: none;
        }

        .opc-date-popover-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 2px;
        }

        .opc-date-popover-actions button {
          min-height: 40px;
          border-radius: 12px;
          border: 1px solid ${BRAND.border};
          background: #FFFFFF;
          color: ${BRAND.text};
          font-size: 12px;
          font-weight: 800;
          font-family: ${pageFont};
          cursor: pointer;
        }

        .opc-date-popover-actions button.dark {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-jobs-select-row {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .opc-jobs-select-row select {
          flex: unset !important;
          width: 100% !important;
          min-width: 0 !important;
          height: 46px;
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

        @media (max-width: 1280px) {
          .opc-jobs-filter-panel {
            align-items: stretch;
          }

          .opc-jobs-date-buttons,
          .opc-jobs-custom-date-row,
          .opc-jobs-filter-panel select {
            flex: 1 1 100%;
          }

          .opc-jobs-date-buttons {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .opc-jobs-page {
            padding-bottom: 110px;
          }

          .opc-jobs-date-plan-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .opc-jobs-select-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .opc-date-popup-trigger,
          .opc-jobs-plan-button {
            min-height: 46px;
            font-size: 12px;
            padding: 0 8px;
          }

          .opc-date-popover {
            width: min(340px, calc(100vw - 48px));
          }

          .opc-job-card-actions {
            flex-direction: column;
          }

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

type RecurrenceMode = 'none' | 'daily' | 'weekdays' | 'monthly';
type PeriodPreset = 'custom' | '3m' | '6m' | '12m';

type StaffOption = {
  id: string;
  user_id?: string | null;
  employee_id?: string | null;
  display_name?: string | null;
  email?: string | null;
  phone_e164?: string | null;
  phone_raw?: string | null;
  role?: string | null;
  status?: string | null;
};

type ClientOption = {
  id: string;
  billing_name?: string | null;
  company_name?: string | null;
  full_name?: string | null;
  email?: string | null;
};

type SiteOption = {
  id: string;
  client_id?: string | null;
  site_name?: string | null;
  name?: string | null;
  address_text?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
};

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mo' },
  { value: 2, label: 'Di' },
  { value: 3, label: 'Mi' },
  { value: 4, label: 'Do' },
  { value: 5, label: 'Fr' },
  { value: 6, label: 'Sa' },
  { value: 0, label: 'So' },
];

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function toInputDate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function addMonthsToInputDate(inputDate: string, months: number) {
  const date = inputDate ? new Date(`${inputDate}T00:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  date.setMonth(date.getMonth() + months);
  return toInputDate(date);
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function addHoursToTime(startTime: string, hoursValue: string | number) {
  const [rawHour, rawMinute] = String(startTime || '08:00').split(':');
  const hours = Number.parseInt(rawHour || '8', 10);
  const minutes = Number.parseInt(rawMinute || '0', 10);
  const duration = Number(String(hoursValue || '2').replace(',', '.'));
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 2;
  const totalMinutes = hours * 60 + minutes + Math.round(safeDuration * 60);
  const nextHour = Math.floor(totalMinutes / 60) % 24;
  const nextMinute = totalMinutes % 60;
  return `${pad2(nextHour)}:${pad2(nextMinute)}`;
}

function durationHoursBetweenTimes(startTime: string, endTime: string) {
  const [startHourRaw, startMinuteRaw] = String(startTime || '').split(':');
  const [endHourRaw, endMinuteRaw] = String(endTime || '').split(':');

  const startHour = Number(startHourRaw);
  const startMinute = Number(startMinuteRaw);
  const endHour = Number(endHourRaw);
  const endMinute = Number(endMinuteRaw);

  if (
    !Number.isFinite(startHour) ||
    !Number.isFinite(startMinute) ||
    !Number.isFinite(endHour) ||
    !Number.isFinite(endMinute)
  ) {
    return '';
  }

  const startTotal = startHour * 60 + startMinute;
  let endTotal = endHour * 60 + endMinute;

  // Supports jobs that end after midnight.
  if (endTotal < startTotal) endTotal += 24 * 60;

  const durationMinutes = endTotal - startTotal;
  if (durationMinutes <= 0) return '';

  return String(Number((durationMinutes / 60).toFixed(2)));
}

function parseInputDate(inputDate: string) {
  const date = new Date(`${inputDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function combineLocalDateTime(inputDate: string, inputTime: string) {
  const date = new Date(`${inputDate}T${inputTime || '08:00'}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cleanNullable(value: string) {
  const clean = String(value || '').trim();
  return clean.length ? clean : null;
}

function cleanNumber(value: string) {
  const number = Number(String(value || '').trim().replace(',', '.'));
  return Number.isFinite(number) ? number : null;
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

function normalizeText(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function getClientLabel(client: ClientOption) {
  return client.billing_name || client.company_name || client.full_name || client.email || 'Kunde';
}

function getSiteLabel(site: SiteOption) {
  return site.site_name || site.name || site.address_text || site.address || 'Standort';
}

function buildOccurrenceDates({
  recurrenceMode,
  startDate,
  endDate,
  selectedWeekdays,
  monthlyCount,
}: {
  recurrenceMode: RecurrenceMode;
  startDate: string;
  endDate: string;
  selectedWeekdays: number[];
  monthlyCount: string;
}) {
  const start = parseInputDate(startDate);
  if (!start) return [];

  if (recurrenceMode === 'none') return [toInputDate(start)];

  const end = parseInputDate(endDate) || start;
  const safeEnd = end < start ? start : end;
  const dates = new Set<string>();

  if (recurrenceMode === 'daily' || recurrenceMode === 'weekdays') {
    let cursor = new Date(start);

    while (cursor <= safeEnd) {
      const weekday = cursor.getDay();
      if (recurrenceMode === 'daily' || selectedWeekdays.includes(weekday)) {
        dates.add(toInputDate(cursor));
      }
      cursor = addDays(cursor, 1);
    }
  }

  if (recurrenceMode === 'monthly') {
    const count = Math.min(4, Math.max(1, Number.parseInt(monthlyCount || '1', 10) || 1));
    const anchorDay = start.getDate();
    const stepDays = count <= 1 ? 0 : Math.max(6, Math.round(28 / count));
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);

    while (cursor <= safeEnd) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      const monthDays = daysInMonth(year, month);

      for (let index = 0; index < count; index += 1) {
        const day = Math.min(monthDays, anchorDay + index * stepDays);
        const occurrence = new Date(year, month, day);

        if (occurrence >= start && occurrence <= safeEnd) {
          dates.add(toInputDate(occurrence));
        }
      }

      cursor = new Date(year, month + 1, 1);
    }
  }

  return Array.from(dates).sort();
}

async function tryInsertOne(table: string, variants: JsonRecord[]) {
  let lastError: any = null;

  for (const variant of variants) {
    const payload = compactPayload(variant);

    try {
      const response = await supabase.from(table).insert(payload).select('*').limit(1);

      if (!response.error) {
        return {
          data: Array.isArray(response.data) ? response.data[0] : null,
          payload,
          error: null,
        };
      }

      lastError = response.error;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(lastError?.message || `${table}: Insert konnte nicht erstellt werden.`);
}

async function tryInsertJob(variants: JsonRecord[]) {
  let lastError: any = null;

  for (const table of ['opc_service_jobs', 'opc_jobs']) {
    try {
      return await tryInsertOne(table, variants);
    } catch (error: any) {
      lastError = error;
    }
  }

  throw new Error(lastError?.message || 'Einsatz konnte nicht gespeichert werden.');
}

function PlanSectionCard({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="opc-plan-card" style={cardStyle}>
      <div className="opc-plan-card-header">
        <div className="opc-plan-card-icon">{icon}</div>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function PlanField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="opc-plan-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function EinsatzPlanningView() {
  const today = useMemo(() => toInputDate(new Date()), []);

  const [title, setTitle] = useState('');
  const [serviceCategory, setServiceCategory] = useState('Unterhaltsreinigung');
  const [serviceDescription, setServiceDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [status, setStatus] = useState('scheduled');

  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [siteId, setSiteId] = useState('');
  const [siteOptions, setSiteOptions] = useState<SiteOption[]>([]);
  const [siteName, setSiteName] = useState('');
  const [addressText, setAddressText] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');

  const [startDate, setStartDate] = useState(today);
  const [startTime, setStartTime] = useState('08:00');
  const [estimatedHours, setEstimatedHours] = useState('2');
  const [endTime, setEndTime] = useState(() => addHoursToTime('08:00', '2'));
  const [autoEndTime, setAutoEndTime] = useState(true);

  const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceMode>('none');
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [monthlyCount, setMonthlyCount] = useState('1');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('3m');
  const [seriesEndDate, setSeriesEndDate] = useState(() => addMonthsToInputDate(today, 3));

  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [internalNotes, setInternalNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const occurrenceDates = useMemo(
    () =>
      buildOccurrenceDates({
        recurrenceMode,
        startDate,
        endDate: recurrenceMode === 'none' ? startDate : seriesEndDate,
        selectedWeekdays,
        monthlyCount,
      }),
    [monthlyCount, recurrenceMode, selectedWeekdays, seriesEndDate, startDate],
  );

  useEffect(() => {
    if (!autoEndTime) return;
    setEndTime(addHoursToTime(startTime, estimatedHours || '2'));
  }, [autoEndTime, estimatedHours, startTime]);

  useEffect(() => {
    if (periodPreset === '3m') setSeriesEndDate(addMonthsToInputDate(startDate, 3));
    if (periodPreset === '6m') setSeriesEndDate(addMonthsToInputDate(startDate, 6));
    if (periodPreset === '12m') setSeriesEndDate(addMonthsToInputDate(startDate, 12));
  }, [periodPreset, startDate]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialOptions() {
      const [staffResponse, clientsResponse] = await Promise.allSettled([
        supabase
          .from('opc_staff_roles')
          .select('id,user_id,employee_id,display_name,email,phone_e164,phone_raw,role,status')
          .order('display_name', { ascending: true }),
        supabase
          .from('opc_clients')
          .select('id,billing_name,company_name,full_name,email')
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      if (cancelled) return;

      if (staffResponse.status === 'fulfilled' && !staffResponse.value.error && Array.isArray(staffResponse.value.data)) {
        const rows = (staffResponse.value.data as StaffOption[]).filter((staff) => {
          const role = normalizeText(staff.role);
          const staffStatus = normalizeText(staff.status);
          const isEmployee = ['employee', 'mitarbeiter', 'cleaner', 'reinigung', ''].includes(role);
          const isActive = !staffStatus || ['active', 'aktiv', 'enabled'].includes(staffStatus);
          return staff.id && isEmployee && isActive;
        });

        setStaffOptions(rows);
      }

      if (clientsResponse.status === 'fulfilled' && !clientsResponse.value.error && Array.isArray(clientsResponse.value.data)) {
        setClientOptions(clientsResponse.value.data as ClientOption[]);
      }
    }

    void loadInitialOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSites() {
      if (!clientId) {
        setSiteOptions([]);
        return;
      }

      const { data, error } = await supabase
        .from('opc_client_sites')
        .select('id,client_id,site_name,name,address_text,address,postal_code,city')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!cancelled && !error && Array.isArray(data)) {
        setSiteOptions(data as SiteOption[]);
      }
    }

    void loadSites();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const selectedClient = useMemo(
    () => clientOptions.find((client) => client.id === clientId) || null,
    [clientId, clientOptions],
  );


  function handleClientChange(nextClientId: string) {
    setClientId(nextClientId);
    setSiteId('');

    const client = clientOptions.find((item) => item.id === nextClientId);
    if (client) {
      setClientName(getClientLabel(client));
    }
  }

  function handleSiteChange(nextSiteId: string) {
    setSiteId(nextSiteId);

    const site = siteOptions.find((item) => item.id === nextSiteId);
    if (site) {
      setSiteName(getSiteLabel(site));
      setAddressText(site.address_text || site.address || '');
      setPostalCode(site.postal_code || '');
      setCity(site.city || '');
    }
  }

  function setPreset(value: PeriodPreset) {
    setPeriodPreset(value);

    if (value === '3m') setSeriesEndDate(addMonthsToInputDate(startDate, 3));
    if (value === '6m') setSeriesEndDate(addMonthsToInputDate(startDate, 6));
    if (value === '12m') setSeriesEndDate(addMonthsToInputDate(startDate, 12));
  }

  function toggleStaff(staffId: string) {
    setSelectedStaffIds((current) =>
      current.includes(staffId) ? current.filter((id) => id !== staffId) : [...current, staffId],
    );
  }

  function buildJobPayload(date: string, recurringSeriesId: string | null) {
    const plannedStart = combineLocalDateTime(date, startTime);
    const plannedEnd = combineLocalDateTime(date, endTime);
    const clientLabel = clientName.trim() || (selectedClient ? getClientLabel(selectedClient) : 'Kunde');
    const safeTitle = title.trim() || `${serviceCategory || 'Einsatz'} · ${clientLabel}`;
    const now = new Date().toISOString();
    const computedStatus = selectedStaffIds.length > 0 && status === 'scheduled' ? 'assigned' : status;

    return {
      title: safeTitle,
      job_title: safeTitle,
      service_category: cleanNullable(serviceCategory),
      service_description: cleanNullable(serviceDescription),
      job_type: cleanNullable(serviceCategory),
      status: computedStatus,
      job_status: computedStatus,
      priority,
      planned_start: plannedStart?.toISOString() || null,
      planned_end: plannedEnd?.toISOString() || null,
      start_time: plannedStart?.toISOString() || null,
      end_time: plannedEnd?.toISOString() || null,
      estimated_hours: cleanNumber(estimatedHours),
      planned_hours: cleanNumber(estimatedHours),
      client_id: clientId || null,
      client_site_id: siteId || null,
      site_id: siteId || null,
      billing_name: cleanNullable(clientName),
      client_name: cleanNullable(clientName),
      customer_name: cleanNullable(clientName),
      site_name: cleanNullable(siteName),
      location_name: cleanNullable(siteName),
      address_text: cleanNullable(addressText),
      site_address: cleanNullable(addressText),
      postal_code: cleanNullable(postalCode),
      city: cleanNullable(city),
      site_city: cleanNullable(city),
      internal_notes: cleanNullable(internalNotes),
      dispatcher_notes: cleanNullable(internalNotes),
      recurrence_type: recurrenceMode !== 'none' ? recurrenceMode : null,
      recurring_series_id: recurringSeriesId,
      occurrence_date: date,
      occurrence_key: recurringSeriesId ? `${recurringSeriesId}:${date}` : null,
      series_version: recurringSeriesId ? 1 : null,
      created_at: now,
      updated_at: now,
    };
  }

  function buildJobVariants(date: string, recurringSeriesId: string | null) {
    const full = buildJobPayload(date, recurringSeriesId);
    const minimal = {
      title: full.title,
      service_category: full.service_category,
      service_description: full.service_description,
      status: full.status,
      priority: full.priority,
      planned_start: full.planned_start,
      planned_end: full.planned_end,
      estimated_hours: full.estimated_hours,
      client_id: full.client_id,
      client_site_id: full.client_site_id,
      internal_notes: full.internal_notes,
      dispatcher_notes: full.dispatcher_notes,
      created_at: full.created_at,
      updated_at: full.updated_at,
    };
    const noRecurrence = { ...full };
    delete noRecurrence.recurring_series_id;
    delete noRecurrence.occurrence_date;
    delete noRecurrence.occurrence_key;
    delete noRecurrence.series_version;
    delete noRecurrence.recurrence_type;

    return [
      full,
      noRecurrence,
      minimal,
      {
        title: full.title,
        status: full.status,
        planned_start: full.planned_start,
        planned_end: full.planned_end,
        created_at: full.created_at,
        updated_at: full.updated_at,
      },
    ];
  }

  async function createRecurringSeries() {
    if (recurrenceMode === 'none') return null;

    const fallbackId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
    const now = new Date().toISOString();

    try {
      const inserted = await tryInsertOne('opc_recurring_job_series', [
        {
          title: title.trim() || serviceCategory || 'Wiederkehrender Einsatz',
          client_id: clientId || null,
          client_site_id: siteId || null,
          service_category: cleanNullable(serviceCategory),
          service_description: cleanNullable(serviceDescription),
          priority,
          estimated_hours: cleanNumber(estimatedHours),
          planned_start_time: startTime,
          planned_end_time: endTime,
          start_date: startDate,
          end_date: seriesEndDate,
          recurrence_type: recurrenceMode,
          weekdays: recurrenceMode === 'weekdays' ? selectedWeekdays : null,
          monthly_count: recurrenceMode === 'monthly' ? Number(monthlyCount || 1) : null,
          status: 'active',
          internal_notes: cleanNullable(internalNotes),
          created_at: now,
          updated_at: now,
        },
        {
          id: fallbackId,
          title: title.trim() || serviceCategory || 'Wiederkehrender Einsatz',
          client_id: clientId || null,
          start_date: startDate,
          end_date: seriesEndDate,
          recurrence_type: recurrenceMode,
          status: 'active',
          created_at: now,
          updated_at: now,
        },
      ]);

      return String(inserted.data?.id || fallbackId);
    } catch {
      return fallbackId;
    }
  }

  async function assignStaffToJob(jobId: string) {
    if (!jobId || selectedStaffIds.length === 0) return;

    const now = new Date().toISOString();

    for (const staffId of selectedStaffIds) {
      const staff = staffOptions.find((item) => item.id === staffId);
      if (!staff) continue;

      await tryInsertOne('opc_job_assignments', [
        {
          job_id: jobId,
          staff_role_id: staff.id,
          user_id: staff.user_id || null,
          employee_id: staff.employee_id || null,
          employee_name: staff.display_name || staff.email || 'Mitarbeiter',
          employee_email: staff.email || null,
          employee_phone: staff.phone_e164 || staff.phone_raw || null,
          status: 'assigned',
          created_at: now,
          updated_at: now,
        },
        {
          job_id: jobId,
          staff_role_id: staff.id,
          user_id: staff.user_id || null,
          employee_id: staff.employee_id || null,
          status: 'assigned',
          created_at: now,
          updated_at: now,
        },
        {
          job_id: jobId,
          staff_role_id: staff.id,
          user_id: staff.user_id || null,
          status: 'assigned',
          created_at: now,
          updated_at: now,
        },
        {
          job_id: jobId,
          employee_id: staff.employee_id || staff.id,
          status: 'assigned',
          created_at: now,
          updated_at: now,
        },
        {
          job_id: jobId,
          user_id: staff.user_id || null,
          status: 'assigned',
          created_at: now,
          updated_at: now,
        },
      ]);
    }
  }

  async function handleSave() {
    if (saving) return;

    setSaving(true);
    setMessage('');
    setErrorMessage('');

    try {
      if (!startDate || !startTime || !endTime) {
        throw new Error('Bitte Datum, Startzeit und Endzeit ausfüllen.');
      }

      if (recurrenceMode === 'weekdays' && selectedWeekdays.length === 0) {
        throw new Error('Bitte mindestens einen Wochentag auswählen.');
      }

      if (recurrenceMode !== 'none' && occurrenceDates.length === 0) {
        throw new Error('Für diese Wiederholung wurden keine Einsatztage gefunden.');
      }

      const recurringSeriesId = await createRecurringSeries();
      const createdJobIds: string[] = [];

      for (const date of occurrenceDates) {
        const inserted = await tryInsertJob(buildJobVariants(date, recurringSeriesId));
        const createdId = String(inserted.data?.id || inserted.data?.job_id || '');

        if (createdId) {
          createdJobIds.push(createdId);
          await assignStaffToJob(createdId);
        }
      }

      setMessage(
        occurrenceDates.length === 1
          ? 'Einsatz wurde gespeichert.'
          : `${occurrenceDates.length} einzelne Einsätze wurden aus der Wiederholung erstellt.`,
      );
    } catch (error: any) {
      setErrorMessage(error?.message || 'Einsatz konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  const plannedPreviewStart = combineLocalDateTime(startDate, startTime)?.toISOString() || null;
  const plannedPreviewEnd = combineLocalDateTime(startDate, endTime)?.toISOString() || null;
  const planClientLabel = clientName.trim() || (selectedClient ? getClientLabel(selectedClient) : 'Kunde noch nicht gewählt');
  const planSiteLabel = siteName.trim() || 'Standort noch nicht gewählt';
  const planTitle = title.trim() || 'Einsatz planen';
  const planStatusLabel = statusLabels[status] || formatStatus(status);

  return (
    <MirakaDashboardShell
      hideTopBar={true}
      requiredRole={['owner', 'admin', 'dispatch']}
      currentPath="/einsaetze"
    >
      <div className="opc-plan-page" style={{ fontFamily: pageFont, color: BRAND.text }}>
        <a href={`${baseUrl}/einsaetze`} className="opc-back-link opc-plan-top-back">
          ← Zurück zu Einsätze
        </a>

        {errorMessage ? <div className="opc-plan-error">{errorMessage}</div> : null}
        {message ? <div className="opc-plan-message">{message}</div> : null}

        <div className="opc-plan-metrics-grid">
          <div className="opc-plan-metric-card">
            <div>
              <div className="opc-plan-metric-value">{planStatusLabel}</div>
              <div className="opc-plan-metric-label">Status</div>
            </div>
            <div className="opc-plan-metric-icon"><CheckCircle2 size={18} /></div>
          </div>

          <div className="opc-plan-metric-card">
            <div>
              <div className="opc-plan-metric-value">{formatTime(plannedPreviewStart)}</div>
              <div className="opc-plan-metric-label">Geplant</div>
              <div className="opc-plan-metric-helper">{formatDateTime(plannedPreviewStart)}</div>
            </div>
            <div className="opc-plan-metric-icon"><CalendarDays size={18} /></div>
          </div>

          <div className="opc-plan-metric-card">
            <div>
              <div className="opc-plan-metric-value">{estimatedHours || '—'} h</div>
              <div className="opc-plan-metric-label">Dauer</div>
              <div className="opc-plan-metric-helper">Ende {formatTime(plannedPreviewEnd)}</div>
            </div>
            <div className="opc-plan-metric-icon"><Clock3 size={18} /></div>
          </div>

          <div className="opc-plan-metric-card">
            <div>
              <div className="opc-plan-metric-value">Erforderlich</div>
              <div className="opc-plan-metric-label">Bericht</div>
            </div>
            <div className="opc-plan-metric-icon"><FileText size={18} /></div>
          </div>
        </div>

        <div className="opc-plan-grid single">
          <div className="opc-plan-main">
            <PlanSectionCard title="Kunde und Standort" icon={<Briefcase size={17} />}>
              <div className="opc-plan-two-row">
                <PlanField label="Kunde *">
                  <select value={clientId} onChange={(event) => handleClientChange(event.target.value)}>
                    <option value="">Kunde auswählen</option>
                    {clientOptions.map((client) => (
                      <option key={client.id} value={client.id}>{getClientLabel(client)}</option>
                    ))}
                  </select>
                </PlanField>

                <PlanField label="Standort *">
                  <select value={siteId} onChange={(event) => handleSiteChange(event.target.value)} disabled={!clientId || siteOptions.length === 0}>
                    <option value="">Zuerst Kunden auswählen</option>
                    {siteOptions.map((site) => (
                      <option key={site.id} value={site.id}>{getSiteLabel(site)}</option>
                    ))}
                  </select>
                </PlanField>
              </div>

              <div className="opc-selected-site-box">
                <span>Ausgewählter Standort</span>
                <strong>{siteName || addressText || 'Wählen Sie zuerst einen Kunden aus.'}</strong>
                {addressText || postalCode || city ? (
                  <p>{[addressText, postalCode, city].filter(Boolean).join(', ')}</p>
                ) : null}
              </div>

              <details className="opc-plan-expandable-card opc-plan-manual-location">
                <summary>Manuelle Kundendaten / Standortdaten</summary>

                <div className="opc-form-grid">
                  <PlanField label="Kundenname manuell">
                    <input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Kundenname" />
                  </PlanField>

                  <PlanField label="Standortname">
                    <input value={siteName} onChange={(event) => setSiteName(event.target.value)} placeholder="Objekt / Standort" />
                  </PlanField>

                  <PlanField label="Adresse">
                    <input value={addressText} onChange={(event) => setAddressText(event.target.value)} placeholder="Strasse und Nummer" />
                  </PlanField>

                  <PlanField label="PLZ">
                    <input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} placeholder="PLZ" />
                  </PlanField>

                  <PlanField label="Ort">
                    <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ort" />
                  </PlanField>
                </div>
              </details>
            </PlanSectionCard>

            <PlanSectionCard title="Einsatzdaten" icon={<CalendarDays size={17} />}>
              <div className="opc-plan-two-row">
                <PlanField label="Dienstleistung *">
                  <input value={serviceCategory} onChange={(event) => setServiceCategory(event.target.value)} placeholder="Allgemeine Reinigung" />
                </PlanField>

                <PlanField label="Datum *">
                  <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value || today)} />
                </PlanField>
              </div>

              <div className="opc-plan-three-row">
                <PlanField label="Startzeit *">
                  <input
                    type="time"
                    value={startTime}
                    onChange={(event) => {
                      const nextStart = event.target.value;
                      setStartTime(nextStart);

                      if (!autoEndTime) {
                        const nextHours = durationHoursBetweenTimes(nextStart, endTime);
                        if (nextHours) setEstimatedHours(nextHours);
                      }
                    }}
                  />
                </PlanField>

                <PlanField label="Endzeit *">
                  <input
                    type="time"
                    value={endTime}
                    onChange={(event) => {
                      const nextEnd = event.target.value;
                      setAutoEndTime(false);
                      setEndTime(nextEnd);

                      const nextHours = durationHoursBetweenTimes(startTime, nextEnd);
                      if (nextHours) setEstimatedHours(nextHours);
                    }}
                  />
                </PlanField>

                <PlanField label="Geschätzte Stunden">
                  <input inputMode="decimal" value={estimatedHours} onChange={(event) => setEstimatedHours(event.target.value)} />
                </PlanField>
              </div>

              <div className="opc-plan-two-row">
                <PlanField label="Status">
                  <select value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option value="scheduled">Geplant</option>
                    <option value="assigned">Zugewiesen</option>
                    <option value="confirmed">Bestätigt</option>
                  </select>
                </PlanField>

                <PlanField label="Priorität">
                  <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                    <option value="low">Niedrig</option>
                    <option value="normal">Normal</option>
                    <option value="high">Hoch</option>
                    <option value="urgent">Dringend</option>
                  </select>
                </PlanField>
              </div>

              <PlanField label="Beschreibung">
                <textarea value={serviceDescription} onChange={(event) => setServiceDescription(event.target.value)} placeholder="Beschreiben Sie kurz, was vor Ort erledigt werden soll." />
              </PlanField>

              <button type="button" className="opc-soft-button" onClick={() => { setAutoEndTime(true); setEndTime(addHoursToTime(startTime, estimatedHours || '2')); }}>
                <Clock3 size={15} />
                Endzeit automatisch berechnen
              </button>
            </PlanSectionCard>

            <PlanSectionCard title="Wiederholung" icon={<Repeat size={17} />}>
              <div className="opc-form-grid">
                <PlanField label="Wiederholung">
                  <select value={recurrenceMode} onChange={(event) => setRecurrenceMode(event.target.value as RecurrenceMode)}>
                    <option value="none">Keine Wiederholung</option>
                    <option value="daily">Täglich</option>
                    <option value="weekdays">Bestimmte Wochentage</option>
                    <option value="monthly">Monatlich</option>
                  </select>
                </PlanField>

                {recurrenceMode !== 'none' ? (
                  <PlanField label="Zeitraum">
                    <select value={periodPreset} onChange={(event) => setPreset(event.target.value as PeriodPreset)}>
                      <option value="3m">3 Monate</option>
                      <option value="6m">6 Monate</option>
                      <option value="12m">12 Monate</option>
                      <option value="custom">Eigenes Enddatum</option>
                    </select>
                  </PlanField>
                ) : null}

                {recurrenceMode !== 'none' ? (
                  <PlanField label="Ende der Serie">
                    <input
                      type="date"
                      value={seriesEndDate}
                      onChange={(event) => {
                        setPeriodPreset('custom');
                        setSeriesEndDate(event.target.value);
                      }}
                    />
                  </PlanField>
                ) : null}

                {recurrenceMode === 'monthly' ? (
                  <PlanField label="Anzahl pro Monat">
                    <select value={monthlyCount} onChange={(event) => setMonthlyCount(event.target.value)}>
                      <option value="1">1x monatlich</option>
                      <option value="2">2x monatlich</option>
                      <option value="3">3x monatlich</option>
                      <option value="4">4x monatlich</option>
                    </select>
                  </PlanField>
                ) : null}
              </div>

              {recurrenceMode === 'weekdays' ? (
                <div className="opc-weekday-row">
                  {WEEKDAY_OPTIONS.map((day) => {
                    const active = selectedWeekdays.includes(day.value);
                    return (
                      <button
                        type="button"
                        key={day.value}
                        className={active ? 'active' : ''}
                        onClick={() => {
                          setSelectedWeekdays((current) =>
                            current.includes(day.value)
                              ? current.filter((item) => item !== day.value)
                              : [...current, day.value].sort(),
                          );
                        }}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </PlanSectionCard>

            <PlanSectionCard title="Mitarbeiter zuweisen" icon={<UserPlus size={17} />}>
              <div className="opc-staff-select-list">
                {staffOptions.length === 0 ? (
                  <div className="opc-empty-box">Keine Mitarbeiter gefunden.</div>
                ) : (
                  staffOptions.map((staff) => {
                    const active = selectedStaffIds.includes(staff.id);
                    return (
                      <button
                        type="button"
                        key={staff.id}
                        className={active ? 'active' : ''}
                        onClick={() => toggleStaff(staff.id)}
                      >
                        <strong>{staff.display_name || staff.email || 'Mitarbeiter'}</strong>
                        <span>{staff.email || staff.phone_e164 || staff.phone_raw || 'Kontakt nicht hinterlegt'}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </PlanSectionCard>

            <details className="opc-plan-expandable-card opc-plan-internal-notes">
              <summary>
                <span>
                  <FileText size={17} />
                  Interne Hinweise
                </span>
                <strong>Selten benötigt</strong>
              </summary>

              <textarea
                value={internalNotes}
                onChange={(event) => setInternalNotes(event.target.value)}
                placeholder="Interne Hinweise für Disposition, Admin oder Team. Diese Hinweise sind nicht für Kunden gedacht."
              />
            </details>

            <div className="opc-plan-bottom-actions" style={cardStyle}>
              <a className="opc-save-button light" href={`${baseUrl}/einsaetze`}>
                Abbrechen
              </a>

              <button type="button" className="opc-save-button" disabled={saving} onClick={() => void handleSave()}>
                {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                {saving ? 'Speichert...' : 'Einsatz erstellen'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .opc-plan-page {
          padding: 0 0 140px;
        }

        .opc-plan-page * {
          box-sizing: border-box;
        }

        .opc-plan-top-back {
          margin-bottom: 14px;
        }

        .opc-plan-hero {
          position: relative;
          padding: 24px;
          margin-bottom: 14px;
        }

        .opc-plan-hero-main {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
          padding-right: 64px;
        }

        .opc-plan-status-dot {
          position: absolute;
          top: 20px;
          right: 20px;
          width: 42px;
          height: 42px;
          border-radius: 999px;
          border: 1px solid #FDE68A;
          background: #FEF3C7;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .opc-plan-status-dot span {
          width: 18px;
          height: 18px;
          border-radius: 999px;
          display: block;
          background: #F59E0B;
        }

        .opc-plan-eyebrow {
          font-size: 12px;
          color: ${BRAND.muted};
          font-weight: 760;
          margin-bottom: 6px;
        }

        .opc-plan-hero h1 {
          margin: 0;
          color: ${BRAND.text};
          font-size: 29px;
          line-height: 1.05;
          letter-spacing: -0.045em;
          font-weight: 860;
        }

        .opc-plan-hero-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          margin-top: 9px;
          font-size: 13px;
          font-weight: 720;
          color: ${BRAND.muted};
        }

        .opc-plan-hero-button-bar {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 18px;
          width: 100%;
        }

        .opc-plan-hero-button-bar .opc-save-button {
          width: 100%;
          height: 46px;
        }

        .opc-plan-metrics-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .opc-plan-metric-card {
          min-height: 74px;
          padding: 16px 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          background: #FFFFFF;
          border: 1px solid ${BRAND.border};
          border-radius: 18px;
          box-shadow: 0 1px 2px rgba(15,23,42,0.04);
        }

        .opc-plan-metric-value {
          font-size: 22px;
          line-height: 1.05;
          font-weight: 860;
          letter-spacing: -0.035em;
          color: ${BRAND.text};
        }

        .opc-plan-metric-label {
          margin-top: 5px;
          font-size: 12px;
          font-weight: 820;
          color: ${BRAND.muted};
        }

        .opc-plan-metric-helper {
          margin-top: 4px;
          font-size: 11px;
          font-weight: 680;
          color: #9CA3AF;
        }

        .opc-plan-metric-icon {
          width: 36px;
          height: 36px;
          border: 1px solid ${BRAND.border};
          border-radius: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${BRAND.black};
          background: #FAFAFA;
          flex: 0 0 auto;
        }

        .opc-back-link {
          display: inline-flex;
          align-items: center;
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

        .opc-plan-hero h1 {
          margin: 0;
          color: ${BRAND.text};
          font-size: 31px;
          line-height: 1.05;
          letter-spacing: -0.045em;
          font-weight: 860;
        }

        .opc-save-button,
        .opc-soft-button {
          min-height: 44px;
          border-radius: 14px;
          border: 1px solid ${BRAND.black};
          background: ${BRAND.black};
          color: #FFFFFF;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 16px;
          font-size: 13px;
          font-weight: 800;
          font-family: ${pageFont};
          cursor: pointer;
          white-space: nowrap;
          text-decoration: none;
        }

        .opc-save-button.full {
          width: 100%;
        }

        .opc-save-button.light {
          border-color: ${BRAND.border};
          background: #FFFFFF;
          color: ${BRAND.text};
        }


        .opc-save-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .opc-soft-button {
          margin-top: 12px;
          border-color: ${BRAND.border};
          background: #FFFFFF;
          color: ${BRAND.text};
        }

        .opc-plan-error,
        .opc-plan-message {
          border-radius: 16px;
          padding: 14px 16px;
          font-size: 13px;
          font-weight: 720;
          margin-bottom: 14px;
        }

        .opc-plan-error {
          border: 1px solid #FECACA;
          background: #FEF2F2;
          color: ${BRAND.red};
        }

        .opc-plan-message {
          border: 1px solid #BBF7D0;
          background: #F0FDF4;
          color: ${BRAND.green};
        }

        .opc-plan-top-back {
          margin-bottom: 14px;
        }

        .opc-plan-two-row {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 12px;
        }

        .opc-plan-three-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 12px;
        }

        .opc-selected-site-box {
          border: 1px solid #F3F4F6;
          border-radius: 16px;
          background: #FAFAFA;
          padding: 13px 14px;
          margin-top: 12px;
          color: ${BRAND.text};
        }

        .opc-selected-site-box span {
          display: block;
          color: ${BRAND.muted};
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 5px;
        }

        .opc-selected-site-box strong {
          display: block;
          font-size: 13px;
          font-weight: 820;
          color: ${BRAND.text};
        }

        .opc-selected-site-box p {
          margin: 4px 0 0;
          color: ${BRAND.muted};
          font-size: 12px;
          font-weight: 650;
        }

        .opc-plan-expandable-card {
          background: #FFFFFF;
          border: 1px solid ${BRAND.border};
          border-radius: 20px;
          box-shadow: 0 1px 2px rgba(15,23,42,0.04);
          padding: 0;
          overflow: hidden;
        }

        .opc-plan-expandable-card summary {
          min-height: 58px;
          padding: 0 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          cursor: pointer;
          list-style: none;
          color: ${BRAND.text};
          font-size: 18px;
          font-weight: 860;
          letter-spacing: -0.035em;
        }

        .opc-plan-expandable-card summary::-webkit-details-marker {
          display: none;
        }

        .opc-plan-expandable-card summary span {
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }

        .opc-plan-expandable-card summary strong {
          color: ${BRAND.muted};
          font-size: 12px;
          font-weight: 760;
          letter-spacing: 0;
        }

        .opc-plan-expandable-card[open] summary {
          border-bottom: 1px solid #F3F4F6;
        }

        .opc-plan-expandable-card textarea {
          width: calc(100% - 36px);
          min-height: 110px;
          margin: 18px;
          border: 1px solid ${BRAND.border};
          border-radius: 14px;
          background: #FFFFFF;
          color: ${BRAND.text};
          padding: 10px 12px;
          font-size: 14px;
          font-weight: 650;
          font-family: ${pageFont};
          outline: none;
          resize: vertical;
        }

        .opc-plan-manual-location {
          margin-top: 12px;
          background: #FAFAFA;
        }

        .opc-plan-manual-location .opc-form-grid {
          padding: 18px;
        }

        .opc-plan-bottom-actions {
          padding: 14px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .opc-plan-bottom-actions .opc-save-button {
          width: 100%;
        }

        .opc-plan-grid.single {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 14px;
          align-items: start;
        }

        .opc-plan-main {
          display: grid;
          gap: 14px;
        }

        .opc-plan-card,
        .opc-plan-bottom-save {
          padding: 18px;
        }

        .opc-plan-card-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }

        .opc-plan-card-header h2 {
          margin: 0;
          color: ${BRAND.text};
          font-size: 18px;
          line-height: 1.15;
          letter-spacing: -0.035em;
          font-weight: 860;
        }

        .opc-plan-card-icon {
          width: 36px;
          height: 36px;
          border: 1px solid ${BRAND.border};
          border-radius: 13px;
          background: #FAFAFA;
          color: ${BRAND.black};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
        }

        .opc-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .opc-plan-field {
          display: grid;
          gap: 7px;
          font-size: 12px;
          font-weight: 820;
          color: #374151;
        }

        .opc-plan-field span {
          display: block;
        }

        .opc-plan-field input,
        .opc-plan-field select,
        .opc-plan-field textarea,
        .opc-plan-card textarea {
          width: 100%;
          min-height: 44px;
          border: 1px solid ${BRAND.border};
          border-radius: 14px;
          background: #FFFFFF;
          color: ${BRAND.text};
          padding: 10px 12px;
          font-size: 14px;
          font-weight: 650;
          font-family: ${pageFont};
          outline: none;
        }

        .opc-plan-field textarea,
        .opc-plan-card textarea {
          min-height: 110px;
          resize: vertical;
          margin-top: 12px;
        }

        .opc-weekday-row {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 8px;
          margin-top: 12px;
        }

        .opc-weekday-row button,
        .opc-staff-select-list button {
          min-height: 42px;
          border: 1px solid ${BRAND.border};
          border-radius: 13px;
          background: #FFFFFF;
          color: ${BRAND.text};
          font-size: 13px;
          font-weight: 780;
          font-family: ${pageFont};
          cursor: pointer;
        }

        .opc-weekday-row button.active,
        .opc-staff-select-list button.active {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-staff-select-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .opc-staff-select-list button {
          min-height: 74px;
          padding: 12px;
          text-align: left;
          display: grid;
          align-content: center;
          gap: 4px;
        }

        .opc-staff-select-list strong,
        .opc-staff-select-list span {
          display: block;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .opc-staff-select-list strong {
          font-size: 13px;
          font-weight: 840;
        }

        .opc-staff-select-list span {
          font-size: 12px;
          font-weight: 640;
          color: inherit;
          opacity: 0.72;
        }

        .opc-empty-box {
          grid-column: 1 / -1;
          min-height: 52px;
          border: 1px solid #F3F4F6;
          border-radius: 14px;
          padding: 13px;
          background: #FAFAFA;
          color: ${BRAND.muted};
          font-size: 13px;
          font-weight: 650;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 740px) {
          .opc-plan-two-row,
          .opc-plan-three-row,
          .opc-plan-bottom-actions {
            grid-template-columns: 1fr;
          }

          .opc-plan-expandable-card summary {
            min-height: 54px;
            padding: 0 14px;
            font-size: 17px;
          }

          .opc-plan-expandable-card textarea {
            width: calc(100% - 28px);
            margin: 14px;
          }

          .opc-plan-hero {
            padding: 18px;
          }

          .opc-plan-hero-main {
            padding-right: 52px;
          }

          .opc-plan-hero h1 {
            font-size: 25px;
          }

          .opc-plan-hero-button-bar,
          .opc-plan-metrics-grid {
            grid-template-columns: 1fr;
          }

          .opc-plan-status-dot {
            top: 16px;
            right: 16px;
            width: 38px;
            height: 38px;
          }

          .opc-plan-page {
            padding: 0 8px 110px;
          }

          .opc-plan-hero {
            padding: 16px;
            display: grid;
            gap: 12px;
          }

          .opc-plan-hero h1 {
            font-size: 25px;
          }

          .opc-save-button {
            width: 100%;
          }

          .opc-form-grid,
          .opc-staff-select-list {
            grid-template-columns: 1fr;
          }

          .opc-weekday-row {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .opc-plan-card,
          .opc-plan-bottom-save {
            padding: 14px;
            border-radius: 18px !important;
          }
        }
      `}</style>
    </MirakaDashboardShell>
  );
}

export default function EinsaetzePage() {
  const isPlanningPath =
    typeof window !== 'undefined' &&
    /\/einsatz-planen\/?$/i.test(window.location.pathname || '');

  if (isPlanningPath) {
    return <EinsatzPlanningView />;
  }

  return <EinsaetzeOverview />;
}

