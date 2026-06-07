import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  AlertTriangle,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coffee,
  LogIn,
  LogOut,
  MapPin,
  Navigation,
  RefreshCw,
  StickyNote,
} from 'lucide-react';
import MirakaDashboardShell from './MirakaDashboardShell';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';

type JsonRecord = Record<string, any>;

type StaffRole = {
  id: string;
  user_id?: string | null;
  employee_id?: string | null;
  role?: string | null;
  status?: string | null;
  display_name?: string | null;
  email?: string | null;
  phone_raw?: string | null;
  phone_e164?: string | null;
  can_view_all_jobs?: boolean | null;
  can_manage_jobs?: boolean | null;
};

type JobCardItem = {
  id: string;
  title: string;
  clientName: string;
  serviceName: string;
  siteName: string;
  address: string;
  city: string;
  status: string;
  priority: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  estimatedHours: string;
  assignedBy: string;
  contactName: string;
  contactPhone: string;
  dispatcherNotes: string;
  employeeNotes: string;
};

type TimeEntry = {
  id: string;
  job_id?: string | null;
  user_id?: string | null;
  staff_role_id?: string | null;
  employee_id?: string | null;
  employee_name?: string | null;
  work_date?: string | null;
  clock_in_at?: string | null;
  clock_out_at?: string | null;
  break_started_at?: string | null;
  break_minutes?: number | null;
  total_minutes?: number | null;
  status?: string | null;
  submitted_at?: string | null;
  employee_note?: string | null;
};

type LoadState = {
  loading: boolean;
  error: string;
  actionMessage: string;
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
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, "Helvetica Neue", Segoe UI, Roboto, sans-serif';

const cardStyle: CSSProperties = {
  background: BRAND.card,
  border: `1px solid ${BRAND.border}`,
  borderRadius: '20px',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

const closedJobStatuses = new Set(['completed', 'cancelled', 'approved', 'report_approved', 'sent_to_client']);
const submittedJobStatuses = new Set(['submitted', 'completed', 'approved', 'report_approved', 'sent_to_client']);
const liveJobStatuses = new Set(['on_site', 'onsite', 'in_progress', 'started', 'running']);

const statusLabels: Record<string, string> = {
  scheduled: 'Geplant',
  assigned: 'Zugewiesen',
  confirmed: 'Bestätigt',
  on_site: 'Vor Ort',
  onsite: 'Vor Ort',
  in_progress: 'In Arbeit',
  submitted: 'Eingereicht',
  completed: 'Abgeschlossen',
  approved: 'Freigegeben',
  report_pending: 'Bericht offen',
  report_approved: 'Bericht freigegeben',
  sent_to_client: 'An Kunde gesendet',
  cancelled: 'Storniert',
};

function normalizeStatus(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function formatStatus(value?: string | null) {
  const clean = normalizeStatus(value);
  if (!clean) return 'Unbekannt';
  return statusLabels[clean] || clean.replace(/_/g, ' ');
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function todayString(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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

function formatTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDate(value?: string | null) {
  if (!value) return 'Nicht geplant';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Nicht geplant';

  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDuration(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${hours}h ${pad(mins)}m`;
}

function getFirstValue(row: JsonRecord, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') return String(value);
  }

  return fallback;
}

function mapJob(row: JsonRecord): JobCardItem {
  const serviceName = getFirstValue(row, ['service_category', 'service_name', 'job_type', 'category'], 'Einsatz');
  const clientName = getFirstValue(row, ['billing_name', 'company_name', 'client_name', 'customer_name', 'full_name'], 'Ohne Kunde');
  const siteName = getFirstValue(row, ['site_name', 'location_name', 'object_name']);
  const title = getFirstValue(row, ['title', 'job_title', 'project_title'], `${serviceName} · ${clientName}`);

  return {
    id: getFirstValue(row, ['job_id', 'id', 'project_id']),
    title,
    clientName,
    serviceName,
    siteName,
    address: getFirstValue(row, ['site_address', 'address', 'address_text', 'street']),
    city: getFirstValue(row, ['site_city', 'city', 'postal_city']),
    status: getFirstValue(row, ['status', 'job_status'], 'scheduled'),
    priority: getFirstValue(row, ['priority'], 'normal'),
    plannedStart: getFirstValue(row, ['planned_start', 'start_time', 'scheduled_at', 'date_time']) || null,
    plannedEnd: getFirstValue(row, ['planned_end', 'end_time']) || null,
    estimatedHours: getFirstValue(row, ['estimated_hours', 'duration_hours', 'planned_hours']),
    assignedBy: getFirstValue(row, ['assigned_by_name', 'dispatcher_name', 'created_by_name', 'assigned_by']),
    contactName: getFirstValue(row, ['site_contact_name', 'contact_name', 'person_of_contact', 'onsite_contact_name']),
    contactPhone: getFirstValue(row, ['site_contact_phone', 'contact_phone', 'phone_e164', 'phone_raw']),
    dispatcherNotes: getFirstValue(row, ['dispatcher_notes', 'internal_notes', 'access_notes', 'cleaning_notes']),
    employeeNotes: getFirstValue(row, ['employee_notes']),
  };
}

function jobAddress(job: JobCardItem) {
  return [job.address, job.city].filter(Boolean).join(', ');
}

function mapsUrl(job: JobCardItem) {
  const query = jobAddress(job) || job.siteName || job.clientName;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function isToday(value?: string | null, reference = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  return date >= startOfDay(reference) && date <= endOfDay(reference);
}

function isWithinDays(value: string | null, days: number, reference = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  return date >= startOfDay(reference) && date <= endOfDay(addDays(reference, days));
}

function isJobLive(job: JobCardItem, now = new Date()) {
  const status = normalizeStatus(job.status);
  if (liveJobStatuses.has(status)) return true;

  if (!job.plannedStart || !job.plannedEnd) return false;

  const start = new Date(job.plannedStart).getTime();
  const end = new Date(job.plannedEnd).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) return false;

  const current = now.getTime();
  return current >= start && current <= end && !closedJobStatuses.has(status);
}

function isOpenDayEntry(entry: TimeEntry | null) {
  if (!entry) return false;
  const status = normalizeStatus(entry.status);
  return Boolean(entry.clock_in_at) && !entry.clock_out_at && !['submitted', 'approved', 'closed', 'completed'].includes(status);
}

function calculateLiveMinutes(entry: TimeEntry | null) {
  if (!entry?.clock_in_at) return 0;
  if (entry.clock_out_at) return Number(entry.total_minutes || 0);

  const start = new Date(entry.clock_in_at).getTime();
  if (Number.isNaN(start)) return 0;

  let activeBreakMinutes = 0;

  if (entry.break_started_at) {
    const breakStart = new Date(entry.break_started_at).getTime();
    if (!Number.isNaN(breakStart)) {
      activeBreakMinutes = Math.max(0, Math.floor((Date.now() - breakStart) / 60000));
    }
  }

  return Math.max(0, Math.floor((Date.now() - start) / 60000) - Number(entry.break_minutes || 0) - activeBreakMinutes);
}

function getTimeStatusLabel(entry: TimeEntry | null) {
  if (!entry?.clock_in_at) return 'Nicht eingestempelt';
  if (entry.clock_out_at) return 'Eingereicht';
  if (entry.break_started_at || normalizeStatus(entry.status) === 'on_break') return 'Pause';
  return 'Eingestempelt';
}

function StatusBadge({ status }: { status?: string | null }) {
  const clean = normalizeStatus(status);
  const isDone = submittedJobStatuses.has(clean);
  const isLive = liveJobStatuses.has(clean);
  const isCancelled = clean === 'cancelled';

  const style = isCancelled
    ? { background: '#FEF2F2', color: BRAND.red, border: '#FECACA' }
    : isDone
      ? { background: '#F0FDF4', color: BRAND.green, border: '#BBF7D0' }
      : isLive
        ? { background: '#ECFEFF', color: BRAND.blue, border: '#A5F3FC' }
        : { background: '#F9FAFB', color: BRAND.muted, border: BRAND.border };

  return (
    <span
      className="opc-employee-status-badge"
      style={{ background: style.background, color: style.color, borderColor: style.border }}
    >
      {formatStatus(status)}
    </span>
  );
}

function MetricCard({ label, value, icon, tone = 'neutral' }: { label: string; value: ReactNode; icon: ReactNode; tone?: 'neutral' | 'danger' | 'dark' }) {
  const valueColor = tone === 'danger' ? BRAND.red : tone === 'dark' ? BRAND.black : BRAND.text;

  return (
    <div className="opc-employee-metric" style={cardStyle}>
      <div>
        <strong style={{ color: valueColor }}>{value}</strong>
        <span>{label}</span>
      </div>
      <div className="opc-employee-metric-icon">{icon}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="opc-employee-empty">{text}</div>;
}

export default function EmployeeDashboardPage() {
  return (
    <MirakaDashboardShell
      title="Mitarbeiter Übersicht"
      requiredRole={['owner', 'admin', 'dispatch', 'employee']}
      currentPath="/mitarbeiter"
      hideTopBar={true}
    >
      <EmployeeDashboardContent />
    </MirakaDashboardShell>
  );
}

function EmployeeDashboardContent() {
  const [state, setState] = useState<LoadState>({ loading: true, error: '', actionMessage: '' });
  const [staff, setStaff] = useState<StaffRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobCardItem[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0);

  const todayKey = todayString();

  const loadData = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '', actionMessage: '' }));

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const authUser = authData?.user || null;

      if (authError || !authUser) {
        throw new Error('Benutzer konnte nicht geladen werden. Bitte neu einloggen.');
      }

      setUserId(authUser.id);

      let staffRole: StaffRole | null = null;

      const { data: staffByUser } = await supabase
        .from('opc_staff_roles')
        .select('id,user_id,employee_id,role,status,display_name,email,phone_raw,phone_e164,can_view_all_jobs,can_manage_jobs')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (staffByUser) {
        staffRole = staffByUser as StaffRole;
      } else if (authUser.email) {
        const { data: staffByEmail } = await supabase
          .from('opc_staff_roles')
          .select('id,user_id,employee_id,role,status,display_name,email,phone_raw,phone_e164,can_view_all_jobs,can_manage_jobs')
          .ilike('email', authUser.email)
          .maybeSingle();

        staffRole = (staffByEmail as StaffRole | null) || null;
      }

      setStaff(staffRole);

      const [jobsResult, timeResult] = await Promise.all([
        supabase.from('opc_my_portal_job_feed').select('*').limit(300),
        supabase
          .from('opc_job_time_logs')
          .select('*')
          .eq('work_date', todayKey)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (jobsResult.error) throw jobsResult.error;
      if (timeResult.error) throw timeResult.error;

      const mappedJobs = ((jobsResult.data || []) as JsonRecord[])
        .map(mapJob)
        .filter((job) => job.id)
        .sort((a, b) => {
          const aTime = a.plannedStart ? new Date(a.plannedStart).getTime() : 0;
          const bTime = b.plannedStart ? new Date(b.plannedStart).getTime() : 0;
          return aTime - bTime;
        });

      setJobs(mappedJobs);
      setTimeEntries((timeResult.data || []) as TimeEntry[]);
      setState((current) => ({ ...current, loading: false, error: '' }));
    } catch (error: any) {
      setState({
        loading: false,
        error: error?.message || 'Mitarbeiter Übersicht konnte nicht geladen werden.',
        actionMessage: '',
      });
    }
  }, [todayKey]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((current) => current + 1), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const ownTimeEntries = useMemo(() => {
    const ids = [userId, staff?.id, staff?.employee_id].filter(Boolean).map(String);

    if (!ids.length) return timeEntries;

    return timeEntries.filter((entry) => {
      const entryIds = [entry.user_id, entry.staff_role_id, entry.employee_id].filter(Boolean).map(String);
      return entryIds.length === 0 || entryIds.some((id) => ids.includes(id));
    });
  }, [staff?.employee_id, staff?.id, timeEntries, userId]);

  const dayEntry = useMemo(() => {
    return (
      ownTimeEntries.find((entry) => !entry.job_id && isOpenDayEntry(entry)) ||
      ownTimeEntries.find((entry) => !entry.job_id) ||
      null
    );
  }, [ownTimeEntries]);

  const todaysJobs = useMemo(() => jobs.filter((job) => isToday(job.plannedStart)), [jobs]);
  const weekJobs = useMemo(() => jobs.filter((job) => isWithinDays(job.plannedStart, 7)), [jobs]);
  const activeJobs = useMemo(() => jobs.filter((job) => isJobLive(job)), [jobs, tick]);
  const nextJob = useMemo(() => {
    const now = Date.now();
    return (
      jobs
        .filter((job) => job.plannedStart && !closedJobStatuses.has(normalizeStatus(job.status)))
        .filter((job) => new Date(job.plannedStart as string).getTime() >= now - 15 * 60 * 1000)
        .sort((a, b) => new Date(a.plannedStart as string).getTime() - new Date(b.plannedStart as string).getTime())[0] || null
    );
  }, [jobs, tick]);

  const submittedTodayCount = useMemo(
    () => todaysJobs.filter((job) => submittedJobStatuses.has(normalizeStatus(job.status))).length,
    [todaysJobs],
  );

  const warningCount = useMemo(() => {
    return todaysJobs.filter((job) => {
      const status = normalizeStatus(job.status);
      return !submittedJobStatuses.has(status) && !closedJobStatuses.has(status);
    }).length;
  }, [todaysJobs]);

  const currentMinutes = useMemo(() => calculateLiveMinutes(dayEntry), [dayEntry, tick]);
  const isWorking = isOpenDayEntry(dayEntry);
  const isOnBreak = Boolean(dayEntry?.break_started_at || normalizeStatus(dayEntry?.status) === 'on_break');

  async function refreshAfterAction(message: string) {
    await loadData();
    setState((current) => ({ ...current, actionMessage: message }));
  }

  async function handleStartDay() {
    if (!userId) return;

    setSaving(true);
    setState((current) => ({ ...current, actionMessage: '', error: '' }));

    const now = new Date().toISOString();
    const payload: JsonRecord = {
      user_id: userId,
      staff_role_id: staff?.id || null,
      employee_id: staff?.employee_id || null,
      employee_name: staff?.display_name || staff?.email || 'Mitarbeiter',
      work_date: todayKey,
      clock_in_at: now,
      status: 'open',
      employee_note: 'Arbeitstag gestartet',
      created_at: now,
      updated_at: now,
    };

    Object.keys(payload).forEach((key) => {
      if (payload[key] === null || payload[key] === undefined || payload[key] === '') delete payload[key];
    });

    try {
      const { error } = await supabase.from('opc_job_time_logs').insert(payload);
      if (error) throw error;
      await refreshAfterAction('Arbeitstag wurde gestartet.');
    } catch (error: any) {
      setState((current) => ({ ...current, error: error?.message || 'Arbeitstag konnte nicht gestartet werden.' }));
    } finally {
      setSaving(false);
    }
  }

  async function handleStartBreak() {
    if (!dayEntry?.id) return;

    setSaving(true);
    setState((current) => ({ ...current, actionMessage: '', error: '' }));

    try {
      const { error } = await supabase
        .from('opc_job_time_logs')
        .update({ break_started_at: new Date().toISOString(), status: 'on_break', updated_at: new Date().toISOString() })
        .eq('id', dayEntry.id);

      if (error) throw error;
      await refreshAfterAction('Pause wurde gestartet.');
    } catch (error: any) {
      setState((current) => ({ ...current, error: error?.message || 'Pause konnte nicht gestartet werden.' }));
    } finally {
      setSaving(false);
    }
  }

  async function handleEndBreak() {
    if (!dayEntry?.id || !dayEntry.break_started_at) return;

    setSaving(true);
    setState((current) => ({ ...current, actionMessage: '', error: '' }));

    const breakStart = new Date(dayEntry.break_started_at).getTime();
    const additionalMinutes = Number.isNaN(breakStart) ? 0 : Math.max(0, Math.floor((Date.now() - breakStart) / 60000));
    const nextBreakMinutes = Number(dayEntry.break_minutes || 0) + additionalMinutes;

    try {
      const { error } = await supabase
        .from('opc_job_time_logs')
        .update({ break_started_at: null, break_minutes: nextBreakMinutes, status: 'open', updated_at: new Date().toISOString() })
        .eq('id', dayEntry.id);

      if (error) throw error;
      await refreshAfterAction('Pause wurde beendet.');
    } catch (error: any) {
      setState((current) => ({ ...current, error: error?.message || 'Pause konnte nicht beendet werden.' }));
    } finally {
      setSaving(false);
    }
  }

  async function handleEndDay() {
    if (!dayEntry?.id || !dayEntry.clock_in_at) return;

    setSaving(true);
    setState((current) => ({ ...current, actionMessage: '', error: '' }));

    const totalMinutes = calculateLiveMinutes(dayEntry);
    const now = new Date().toISOString();

    try {
      const { error } = await supabase
        .from('opc_job_time_logs')
        .update({
          clock_out_at: now,
          break_started_at: null,
          total_minutes: totalMinutes,
          status: 'submitted',
          submitted_at: now,
          updated_at: now,
        })
        .eq('id', dayEntry.id);

      if (error) throw error;
      await refreshAfterAction('Arbeitstag wurde eingereicht.');
    } catch (error: any) {
      setState((current) => ({ ...current, error: error?.message || 'Arbeitstag konnte nicht beendet werden.' }));
    } finally {
      setSaving(false);
    }
  }

  if (state.loading) {
    return <div className="opc-employee-loading">Mitarbeiter Übersicht wird geladen...</div>;
  }

  return (
    <div className="opc-employee-page" style={{ fontFamily: pageFont }}>
      {state.error ? <div className="opc-employee-message opc-employee-error">{state.error}</div> : null}
      {state.actionMessage ? <div className="opc-employee-message opc-employee-success">{state.actionMessage}</div> : null}

      <section className="opc-employee-hero" style={cardStyle}>
        <div>
          <span className="opc-employee-eyebrow">Mitarbeiter App</span>
          <h1>Guten Tag{staff?.display_name ? `, ${staff.display_name}` : ''}</h1>
          <p>Heute ist {new Intl.DateTimeFormat('de-CH', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())}.</p>
        </div>

        <button type="button" className="opc-employee-refresh" onClick={() => void loadData()} disabled={saving}>
          <RefreshCw size={16} />
          Aktualisieren
        </button>
      </section>

      <section className="opc-employee-clock-card" style={cardStyle}>
        <div className="opc-employee-clock-main">
          <div className="opc-employee-clock-icon"><Clock3 size={22} /></div>
          <div>
            <span>Arbeitszeit</span>
            <strong>{getTimeStatusLabel(dayEntry)}</strong>
            <small>{dayEntry?.clock_in_at ? `Seit ${formatTime(dayEntry.clock_in_at)} · ${formatDuration(currentMinutes)}` : 'Noch nicht gestartet'}</small>
          </div>
        </div>

        <div className="opc-employee-clock-actions">
          {!isWorking ? (
            <button type="button" className="opc-employee-btn opc-employee-btn-dark" disabled={saving} onClick={() => void handleStartDay()}>
              <LogIn size={16} />
              Arbeitstag starten
            </button>
          ) : isOnBreak ? (
            <button type="button" className="opc-employee-btn opc-employee-btn-dark" disabled={saving} onClick={() => void handleEndBreak()}>
              <Coffee size={16} />
              Pause beenden
            </button>
          ) : (
            <button type="button" className="opc-employee-btn" disabled={saving} onClick={() => void handleStartBreak()}>
              <Coffee size={16} />
              Pause starten
            </button>
          )}

          {isWorking ? (
            <button type="button" className="opc-employee-btn opc-employee-btn-danger" disabled={saving} onClick={() => void handleEndDay()}>
              <LogOut size={16} />
              Arbeitstag beenden
            </button>
          ) : null}
        </div>
      </section>

      <div className="opc-employee-metrics">
        <MetricCard label="Einsätze heute" value={todaysJobs.length} icon={<CalendarDays size={17} />} />
        <MetricCard label="Aktuell laufend" value={activeJobs.length} icon={<Clock3 size={17} />} tone={activeJobs.length > 0 ? 'dark' : 'neutral'} />
        <MetricCard label="Eingereicht" value={submittedTodayCount} icon={<CheckCircle2 size={17} />} />
        <MetricCard label="Offen prüfen" value={warningCount} icon={<AlertTriangle size={17} />} tone={warningCount > 0 ? 'danger' : 'neutral'} />
      </div>

      <div className="opc-employee-grid">
        <main className="opc-employee-main">
          <section className="opc-employee-section" style={cardStyle}>
            <div className="opc-employee-section-head">
              <div>
                <h2>Heute zugewiesen</h2>
                <p>Alle Einsätze, die heute für dich relevant sind.</p>
              </div>
              <a href={`${baseUrl}/einsaetze`}>Alle Einsätze</a>
            </div>

            {todaysJobs.length === 0 ? (
              <EmptyState text="Heute sind keine Einsätze zugewiesen." />
            ) : (
              <div className="opc-employee-job-list">
                {todaysJobs.map((job) => <EmployeeJobCard key={job.id} job={job} />)}
              </div>
            )}
          </section>

          <section className="opc-employee-section" style={cardStyle}>
            <div className="opc-employee-section-head">
              <div>
                <h2>Diese Woche</h2>
                <p>Die nächsten geplanten Einsätze aus deinem Jobfeed.</p>
              </div>
            </div>

            {weekJobs.length === 0 ? (
              <EmptyState text="Für die nächsten 7 Tage sind keine Einsätze sichtbar." />
            ) : (
              <div className="opc-employee-week-list">
                {weekJobs.slice(0, 8).map((job) => <EmployeeCompactJobRow key={job.id} job={job} />)}
              </div>
            )}
          </section>
        </main>

        <aside className="opc-employee-aside">
          <section className="opc-employee-section" style={cardStyle}>
            <div className="opc-employee-section-head compact">
              <div>
                <h2>Nächster Einsatz</h2>
                <p>Direkt öffnen oder Navigation starten.</p>
              </div>
            </div>

            {nextJob ? <EmployeeJobCard job={nextJob} compact /> : <EmptyState text="Kein nächster Einsatz gefunden." />}
          </section>

          <section className="opc-employee-section" style={cardStyle}>
            <div className="opc-employee-section-head compact">
              <div>
                <h2>Hinweise</h2>
                <p>Was heute noch beachtet werden sollte.</p>
              </div>
            </div>

            <div className="opc-employee-note-list">
              <div>
                <StickyNote size={16} />
                <span>Vorher-/Nachher-Medien werden im Einsatz hochgeladen.</span>
              </div>
              <div>
                <Clock3 size={16} />
                <span>Einsatzzeiten werden direkt im jeweiligen Einsatz erfasst.</span>
              </div>
              <div>
                <AlertTriangle size={16} />
                <span>Probleme oder Schäden über Tickets & Schäden melden.</span>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <style>{`
        .opc-employee-page {
          color: ${BRAND.text};
          padding-bottom: 120px;
        }

        .opc-employee-loading {
          min-height: 60vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${BRAND.muted};
          font-size: 14px;
          font-weight: 650;
          font-family: ${pageFont};
        }

        .opc-employee-message {
          padding: 14px 16px;
          border-radius: 16px;
          font-size: 14px;
          font-weight: 720;
          margin-bottom: 14px;
        }

        .opc-employee-error {
          border: 1px solid #FECACA;
          background: #FEF2F2;
          color: ${BRAND.red};
        }

        .opc-employee-success {
          border: 1px solid #BBF7D0;
          background: #F0FDF4;
          color: ${BRAND.green};
        }

        .opc-employee-hero {
          padding: 24px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 14px;
        }

        .opc-employee-eyebrow {
          display: block;
          margin-bottom: 8px;
          color: ${BRAND.muted};
          font-size: 12px;
          font-weight: 780;
        }

        .opc-employee-hero h1 {
          margin: 0;
          font-size: 30px;
          line-height: 1.05;
          letter-spacing: -0.045em;
          font-weight: 860;
        }

        .opc-employee-hero p {
          margin: 8px 0 0;
          color: ${BRAND.muted};
          font-size: 14px;
          font-weight: 650;
        }

        .opc-employee-refresh,
        .opc-employee-btn,
        .opc-employee-card-action,
        .opc-employee-section-head a {
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
          text-decoration: none;
          cursor: pointer;
          font-family: ${pageFont};
          white-space: nowrap;
        }

        .opc-employee-btn-dark {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-employee-btn-danger {
          background: #FEF2F2;
          border-color: #FECACA;
          color: ${BRAND.red};
        }

        .opc-employee-clock-card {
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 14px;
        }

        .opc-employee-clock-main {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }

        .opc-employee-clock-icon,
        .opc-employee-metric-icon {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          border: 1px solid ${BRAND.border};
          background: ${BRAND.soft};
          color: ${BRAND.black};
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
        }

        .opc-employee-clock-main span,
        .opc-employee-clock-main small {
          display: block;
          color: ${BRAND.muted};
          font-size: 12px;
          font-weight: 720;
        }

        .opc-employee-clock-main strong {
          display: block;
          margin: 3px 0;
          color: ${BRAND.text};
          font-size: 23px;
          line-height: 1;
          font-weight: 860;
          letter-spacing: -0.04em;
        }

        .opc-employee-clock-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .opc-employee-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .opc-employee-metric {
          min-height: 96px;
          padding: 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .opc-employee-metric strong {
          display: block;
          font-size: 25px;
          line-height: 1;
          letter-spacing: -0.04em;
          font-weight: 860;
          margin-bottom: 9px;
        }

        .opc-employee-metric span {
          display: block;
          color: ${BRAND.muted};
          font-size: 13px;
          font-weight: 720;
        }

        .opc-employee-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(310px, 0.65fr);
          gap: 18px;
          align-items: start;
        }

        .opc-employee-main,
        .opc-employee-aside {
          display: flex;
          flex-direction: column;
          gap: 18px;
          min-width: 0;
        }

        .opc-employee-section {
          padding: 20px;
        }

        .opc-employee-section-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }

        .opc-employee-section-head.compact {
          margin-bottom: 14px;
        }

        .opc-employee-section-head h2 {
          margin: 0;
          color: ${BRAND.text};
          font-size: 18px;
          line-height: 1.2;
          letter-spacing: -0.035em;
          font-weight: 860;
        }

        .opc-employee-section-head p {
          margin: 5px 0 0;
          color: ${BRAND.muted};
          font-size: 13px;
          line-height: 1.45;
          font-weight: 620;
        }

        .opc-employee-job-list,
        .opc-employee-week-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .opc-employee-job-card {
          border: 1px solid ${BRAND.border};
          border-radius: 18px;
          background: #FFFFFF;
          padding: 18px;
          display: grid;
          gap: 14px;
        }

        .opc-employee-job-card.compact {
          padding: 16px;
        }

        .opc-employee-job-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
        }

        .opc-employee-job-title {
          margin: 0;
          color: ${BRAND.text};
          font-size: 19px;
          line-height: 1.18;
          letter-spacing: -0.035em;
          font-weight: 860;
        }

        .opc-employee-job-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          color: ${BRAND.muted};
          font-size: 13px;
          font-weight: 680;
          margin-top: 8px;
        }

        .opc-employee-status-badge {
          min-height: 29px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 780;
          white-space: nowrap;
        }

        .opc-employee-job-info-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .opc-employee-info-cell {
          border: 1px solid ${BRAND.border};
          border-radius: 14px;
          background: ${BRAND.soft};
          padding: 12px;
        }

        .opc-employee-info-cell span {
          display: block;
          color: ${BRAND.muted};
          font-size: 11px;
          font-weight: 760;
          margin-bottom: 4px;
        }

        .opc-employee-info-cell strong {
          display: block;
          color: ${BRAND.text};
          font-size: 13px;
          line-height: 1.35;
          font-weight: 780;
        }

        .opc-employee-card-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .opc-employee-card-action.dark {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-employee-compact-row {
          border: 1px solid ${BRAND.border};
          border-radius: 16px;
          background: #FFFFFF;
          padding: 14px 16px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
          text-decoration: none;
        }

        .opc-employee-compact-row strong {
          display: block;
          color: ${BRAND.text};
          font-size: 14px;
          font-weight: 820;
          line-height: 1.25;
        }

        .opc-employee-compact-row span {
          display: block;
          color: ${BRAND.muted};
          font-size: 12px;
          font-weight: 650;
          margin-top: 4px;
        }

        .opc-employee-note-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .opc-employee-note-list div {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          border: 1px solid ${BRAND.border};
          border-radius: 14px;
          padding: 12px;
          background: ${BRAND.soft};
          color: ${BRAND.muted};
          font-size: 13px;
          line-height: 1.45;
          font-weight: 650;
        }

        .opc-employee-empty {
          min-height: 92px;
          border: 1px dashed ${BRAND.borderStrong};
          border-radius: 18px;
          background: ${BRAND.soft};
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${BRAND.muted};
          text-align: center;
          padding: 18px;
          font-size: 13px;
          font-weight: 650;
        }

        @media (max-width: 1180px) {
          .opc-employee-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .opc-employee-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .opc-employee-hero,
          .opc-employee-clock-card,
          .opc-employee-section-head,
          .opc-employee-job-top {
            flex-direction: column;
            align-items: stretch;
          }

          .opc-employee-hero h1 {
            font-size: 25px;
          }

          .opc-employee-metrics,
          .opc-employee-job-info-grid {
            grid-template-columns: 1fr;
          }

          .opc-employee-clock-actions,
          .opc-employee-card-actions {
            flex-direction: column;
          }

          .opc-employee-btn,
          .opc-employee-card-action,
          .opc-employee-refresh,
          .opc-employee-section-head a {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

function EmployeeJobCard({ job, compact = false }: { job: JobCardItem; compact?: boolean }) {
  return (
    <article className={`opc-employee-job-card ${compact ? 'compact' : ''}`}>
      <div className="opc-employee-job-top">
        <div>
          <h3 className="opc-employee-job-title">{job.title}</h3>
          <div className="opc-employee-job-meta">
            <span><Briefcase size={13} /> {job.serviceName}</span>
            <span><CalendarDays size={13} /> {formatDate(job.plannedStart)}</span>
            <span><MapPin size={13} /> {jobAddress(job) || job.siteName || 'Adresse nicht hinterlegt'}</span>
          </div>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {!compact ? (
        <div className="opc-employee-job-info-grid">
          <InfoCell label="Kunde" value={job.clientName} />
          <InfoCell label="Dauer" value={job.estimatedHours ? `${job.estimatedHours} h` : 'Nicht hinterlegt'} />
          <InfoCell label="Kontakt vor Ort" value={job.contactName || job.contactPhone || 'Nicht hinterlegt'} />
          <InfoCell label="Zugewiesen durch" value={job.assignedBy || 'Disposition'} />
        </div>
      ) : null}

      <div className="opc-employee-card-actions">
        <a className="opc-employee-card-action dark" href={`${baseUrl}/einsatz/${job.id}`}>
          Einsatz öffnen
        </a>
        <a className="opc-employee-card-action" href={mapsUrl(job)} target="_blank" rel="noreferrer">
          <Navigation size={15} />
          Navigation
        </a>
      </div>
    </article>
  );
}

function EmployeeCompactJobRow({ job }: { job: JobCardItem }) {
  return (
    <a className="opc-employee-compact-row" href={`${baseUrl}/einsatz/${job.id}`}>
      <div>
        <strong>{job.title}</strong>
        <span>{job.clientName} · {formatDate(job.plannedStart)}</span>
      </div>
      <StatusBadge status={job.status} />
    </a>
  );
}

function InfoCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="opc-employee-info-cell">
      <span>{label}</span>
      <strong>{value || 'Nicht hinterlegt'}</strong>
    </div>
  );
}
