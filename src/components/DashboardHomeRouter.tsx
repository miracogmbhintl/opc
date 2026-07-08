import { useEffect, useRef, useMemo, useState, type CSSProperties } from 'react';
import {
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coffee,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  Navigation,
  RefreshCw,
} from 'lucide-react';
import { supabase, type UserProfile } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import { loadOpcAuthProfile, readCachedOpcAuthProfile } from '../lib/opc-auth-cache';
import OwnerDashboardHome from './OwnerDashboardHome';

type EmployeeEntryStatus = 'open' | 'on_break' | 'submitted' | 'approved' | 'rejected' | string;

interface RawJob {
  [key: string]: any;
}

interface EmployeeDashboardJob {
  id: string;
  title: string;
  clientName: string;
  serviceName: string;
  siteName: string;
  address: string;
  city: string;
  status: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  contactName: string;
  contactPhone: string;
}

interface EmployeeTimeEntry {
  id: string;
  user_id: string;
  work_date: string;
  clock_in_at?: string | null;
  clock_out_at?: string | null;
  break_started_at?: string | null;
  break_minutes?: number | null;
  total_minutes?: number | null;
  status: EmployeeEntryStatus;
  employee_note?: string | null;
}

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
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

const primaryButtonStyle: CSSProperties = {
  minHeight: '48px',
  borderRadius: '14px',
  border: `1px solid ${BRAND.black}`,
  background: BRAND.black,
  color: '#FFFFFF',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '9px',
  padding: '0 16px',
  fontSize: '14px',
  fontWeight: 780,
  fontFamily: pageFont,
  cursor: 'pointer',
  textDecoration: 'none',
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: '48px',
  borderRadius: '14px',
  border: `1px solid ${BRAND.border}`,
  background: '#FFFFFF',
  color: BRAND.text,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '9px',
  padding: '0 16px',
  fontSize: '14px',
  fontWeight: 760,
  fontFamily: pageFont,
  cursor: 'pointer',
  textDecoration: 'none',
};

const dangerButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  borderColor: '#FECACA',
  color: BRAND.red,
};

function pad(num: number) {
  return String(num).padStart(2, '0');
}

function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
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

function normalizeRole(role?: string | null) {
  const clean = String(role || '').trim().toLowerCase();
  if (['owner', 'admin', 'dispatch', 'employee', 'client'].includes(clean)) return clean;
  if (clean === 'dispatcher' || clean === 'disposition') return 'dispatch';
  if (clean === 'mitarbeiter') return 'employee';
  return 'client';
}

function normalizeStatus(status?: string | null) {
  return String(status || '').trim().toLowerCase();
}

function getFirstValue(row: RawJob, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') return String(value);
  }
  return fallback;
}

function mapJob(row: RawJob): EmployeeDashboardJob {
  const serviceName = getFirstValue(row, ['service_category', 'service_name', 'job_type', 'category'], 'Einsatz');
  const clientName = getFirstValue(row, ['billing_name', 'company_name', 'client_name', 'customer_name', 'full_name'], 'Ohne Kunde');
  const title = getFirstValue(row, ['title', 'job_title', 'project_title'], `${serviceName} · ${clientName}`);

  return {
    id: getFirstValue(row, ['job_id', 'id', 'project_id']),
    title,
    clientName,
    serviceName,
    siteName: getFirstValue(row, ['site_name', 'location_name', 'object_name']),
    address: getFirstValue(row, ['site_address', 'address', 'address_text', 'street']),
    city: getFirstValue(row, ['site_city', 'city', 'postal_city']),
    status: getFirstValue(row, ['status', 'job_status'], 'scheduled'),
    plannedStart: getFirstValue(row, ['planned_start', 'start_time', 'scheduled_at', 'date_time']) || null,
    plannedEnd: getFirstValue(row, ['planned_end', 'end_time']) || null,
    contactName: getFirstValue(row, ['site_contact_name', 'contact_name', 'person_of_contact', 'onsite_contact_name']),
    contactPhone: getFirstValue(row, ['site_contact_phone', 'contact_phone', 'phone_e164', 'phone_raw']),
  };
}

function formatTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMinutes(minutes?: number | null) {
  const safe = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${hours}h ${pad(mins)}m`;
}

function liveMinutes(entry: EmployeeTimeEntry | null) {
  if (!entry?.clock_in_at) return 0;
  if (entry.clock_out_at) return Number(entry.total_minutes || 0);

  const start = new Date(entry.clock_in_at).getTime();
  const now = Date.now();
  let activeBreakMinutes = 0;

  if (entry.break_started_at) {
    activeBreakMinutes = Math.max(
      0,
      Math.floor((now - new Date(entry.break_started_at).getTime()) / 60000)
    );
  }

  return Math.max(
    0,
    Math.floor((now - start) / 60000) - Number(entry.break_minutes || 0) - activeBreakMinutes
  );
}

function isToday(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date >= startOfDay(now) && date <= endOfDay(now);
}

function getLocation(job: EmployeeDashboardJob) {
  return [job.address, job.city].filter(Boolean).join(', ') || job.siteName || '';
}

function getMapsUrl(job: EmployeeDashboardJob) {
  const query = getLocation(job) || job.clientName || job.title;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    scheduled: 'Geplant',
    assigned: 'Zugewiesen',
    confirmed: 'Bestätigt',
    on_site: 'Vor Ort',
    onsite: 'Vor Ort',
    in_progress: 'In Arbeit',
    started: 'Gestartet',
    running: 'Läuft',
    completed: 'Abgeschlossen',
    submitted: 'Eingereicht',
    approved: 'Freigegeben',
    sent_to_client: 'An Kunde gesendet',
    open: 'Eingestempelt',
    on_break: 'Pause',
    not_active: 'Nicht aktiv',
  };

  const clean = normalizeStatus(status);
  return labels[clean] || clean.replace(/_/g, ' ') || 'Unbekannt';
}

function StatusPill({ status }: { status?: string | null }) {
  const clean = normalizeStatus(status);
  const active = ['open', 'on_site', 'onsite', 'in_progress', 'started', 'running'].includes(clean);
  const submitted = ['submitted', 'completed', 'approved', 'sent_to_client'].includes(clean);
  const pause = clean === 'on_break';

  const style = pause
    ? { bg: '#ECFEFF', text: BRAND.blue, border: '#A5F3FC' }
    : active
      ? { bg: '#F0FDF4', text: BRAND.green, border: '#BBF7D0' }
      : submitted
        ? { bg: '#FFFBEB', text: BRAND.amber, border: '#FDE68A' }
        : { bg: '#F9FAFB', text: BRAND.muted, border: BRAND.border };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 28,
        padding: '0 12px',
        borderRadius: 999,
        border: `1px solid ${style.border}`,
        background: style.bg,
        color: style.text,
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {statusLabel(status)}
    </span>
  );
}

function MetricCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ ...cardStyle, padding: 18, minHeight: 96 }}>
      <div style={{ fontSize: 24, fontWeight: 860, letterSpacing: '-0.04em', marginBottom: 10 }}>{value}</div>
      <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 720 }}>{label}</div>
    </div>
  );
}

function EmployeeDashboardContent({ profile }: { profile: UserProfile }) {
  const [jobs, setJobs] = useState<EmployeeDashboardJob[]>([]);
  const [activeEntry, setActiveEntry] = useState<EmployeeTimeEntry | null>(null);
  const [note, setNote] = useState('');
  const [clockOutNote, setClockOutNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [tick, setTick] = useState(0);
  const didInitialDashboardLoadRef = useRef(false);

  useEffect(() => {
    if (didInitialDashboardLoadRef.current) return;
    didInitialDashboardLoadRef.current = true;
    void loadDashboard(true);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setTick((value) => value + 1), 30000);
    return () => window.clearInterval(interval);
  }, []);

  async function loadDashboard(showLoader = false) {
    if (showLoader) setLoading(true);
    setErrorMessage('');

    try {
      const { data: authData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = authData.user?.id;
      if (!userId) throw new Error('Nicht eingeloggt.');

      const jobsResult = await supabase
        .from('opc_my_portal_job_feed')
        .select('*')
        .limit(120);

      if (jobsResult.error) throw jobsResult.error;

      const mappedJobs = (jobsResult.data || [])
        .map(mapJob)
        .filter((job) => job.id)
        .sort((a, b) => {
          const aTime = a.plannedStart ? new Date(a.plannedStart).getTime() : 0;
          const bTime = b.plannedStart ? new Date(b.plannedStart).getTime() : 0;
          return aTime - bTime;
        });

      setJobs(mappedJobs);

      const entryResult = await supabase
        .from('opc_employee_time_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('work_date', todayString())
        .in('status', ['open', 'on_break'])
        .is('clock_out_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (entryResult.error) throw entryResult.error;
      setActiveEntry((entryResult.data || null) as EmployeeTimeEntry | null);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Mitarbeiter-Dashboard konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  async function runAction(action: string, callback: () => Promise<void>) {
    setActionLoading(action);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await callback();
      await loadDashboard(false);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Aktion konnte nicht ausgeführt werden.');
    } finally {
      setActionLoading(null);
    }
  }

  async function clockIn() {
    await runAction('clock_in', async () => {
      const { error } = await supabase.rpc('opc_clock_in_employee', {
        p_employee_note: note.trim() || null,
      });
      if (error) throw error;
      setNote('');
      setSuccessMessage('Arbeitstag gestartet.');
    });
  }

  async function startBreak() {
    if (!activeEntry?.id) return;
    await runAction('break_start', async () => {
      const { error } = await supabase.rpc('opc_start_employee_break', {
        p_time_entry_id: activeEntry.id,
        p_note: null,
      });
      if (error) throw error;
      setSuccessMessage('Pause gestartet.');
    });
  }

  async function endBreak() {
    if (!activeEntry?.id) return;
    await runAction('break_end', async () => {
      const { error } = await supabase.rpc('opc_end_employee_break', {
        p_time_entry_id: activeEntry.id,
        p_note: null,
      });
      if (error) throw error;
      setSuccessMessage('Pause beendet.');
    });
  }

  async function clockOut() {
    if (!activeEntry?.id) return;
    await runAction('clock_out', async () => {
      const { error } = await supabase.rpc('opc_clock_out_employee', {
        p_time_entry_id: activeEntry.id,
        p_employee_note: clockOutNote.trim() || null,
      });
      if (error) throw error;
      setClockOutNote('');
      setSuccessMessage('Arbeitstag eingereicht.');
    });
  }

  const isActive = Boolean(activeEntry && !activeEntry.clock_out_at);
  const isOnBreak = normalizeStatus(activeEntry?.status) === 'on_break';

  const todayJobs = useMemo(() => jobs.filter((job) => isToday(job.plannedStart)), [jobs]);
  const nextJob = useMemo(() => {
    const now = Date.now();
    return jobs.find((job) => {
      const start = job.plannedStart ? new Date(job.plannedStart).getTime() : 0;
      return start >= now && isToday(job.plannedStart);
    }) || todayJobs[0] || null;
  }, [jobs, todayJobs]);

  const submittedToday = useMemo(
    () => todayJobs.filter((job) => ['submitted', 'completed', 'approved', 'sent_to_client'].includes(normalizeStatus(job.status))).length,
    [todayJobs]
  );

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: BRAND.muted, fontFamily: pageFont, fontWeight: 700 }}>
        <Loader2 size={18} style={{ marginRight: 8, animation: 'opc-dashboard-spin 0.9s linear infinite' }} />
        Mitarbeiter-Dashboard wird geladen...
        <style>{`@keyframes opc-dashboard-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="opc-employee-dashboard" style={{ fontFamily: pageFont, color: BRAND.text, paddingBottom: 120 }}>
      <section style={{ ...cardStyle, padding: 24, marginBottom: 16 }}>
        <div className="opc-employee-dashboard-hero">
          <div>
            <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Mitarbeiter-Dashboard</div>
            <h1 style={{ margin: 0, fontSize: 31, lineHeight: 1.05, letterSpacing: '-0.045em', fontWeight: 880 }}>
              Guten Tag, {profile.full_name || profile.email || 'Mitarbeiter'}
            </h1>
            <p style={{ margin: '9px 0 0', color: BRAND.muted, fontSize: 14, lineHeight: 1.5, fontWeight: 620 }}>
              Starte deinen Arbeitstag, prüfe deine heutigen Einsätze und öffne direkt Navigation oder Einsatzdetails.
            </p>
          </div>

          <button type="button" onClick={() => void loadDashboard(false)} style={secondaryButtonStyle} disabled={Boolean(actionLoading)}>
            <RefreshCw size={16} />
            Aktualisieren
          </button>
        </div>
      </section>

      {errorMessage ? <div style={{ border: '1px solid #FECACA', background: '#FEF2F2', color: BRAND.red, padding: '14px 16px', borderRadius: 16, fontSize: 13, fontWeight: 720, marginBottom: 14 }}>{errorMessage}</div> : null}
      {successMessage ? <div style={{ border: '1px solid #BBF7D0', background: '#F0FDF4', color: BRAND.green, padding: '14px 16px', borderRadius: 16, fontSize: 13, fontWeight: 720, marginBottom: 14 }}>{successMessage}</div> : null}

      <div className="opc-employee-dashboard-grid">
        <section style={{ ...cardStyle, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 860, letterSpacing: '-0.03em' }}>Arbeitstag</h2>
              <p style={{ margin: '6px 0 0', color: BRAND.muted, fontSize: 13, fontWeight: 620 }}>Allgemeine Tages-Zeiterfassung.</p>
            </div>
            <StatusPill status={isActive ? activeEntry?.status : 'not_active'} />
          </div>

          <div className="opc-employee-time-stats">
            <MetricCard value={isActive ? formatTime(activeEntry?.clock_in_at) : '—'} label="Start" />
            <MetricCard value={isActive ? formatMinutes(liveMinutes(activeEntry)) : '0h 00m'} label="Live" />
          </div>

          {!isActive ? (
            <label style={{ display: 'grid', gap: 8, marginTop: 16, color: BRAND.text, fontSize: 13, fontWeight: 760 }}>
              Startnotiz optional
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Beispiel: Dienstwagen übernommen, Fahrt begonnen."
                style={{ minHeight: 96, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: 12, resize: 'vertical', fontFamily: pageFont }}
              />
            </label>
          ) : (
            <label style={{ display: 'grid', gap: 8, marginTop: 16, color: BRAND.text, fontSize: 13, fontWeight: 760 }}>
              Notiz zum Ausstempeln optional
              <textarea
                value={clockOutNote}
                onChange={(event) => setClockOutNote(event.target.value)}
                placeholder="Beispiel: Tag abgeschlossen, Material aufgefüllt."
                style={{ minHeight: 96, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: 12, resize: 'vertical', fontFamily: pageFont }}
              />
            </label>
          )}

          <div className="opc-employee-action-row">
            {!isActive ? (
              <button type="button" onClick={() => void clockIn()} disabled={actionLoading === 'clock_in'} style={primaryButtonStyle}>
                {actionLoading === 'clock_in' ? <Loader2 size={16} /> : <LogIn size={16} />}
                Arbeitstag starten
              </button>
            ) : null}

            {isActive && !isOnBreak ? (
              <button type="button" onClick={() => void startBreak()} disabled={actionLoading === 'break_start'} style={secondaryButtonStyle}>
                {actionLoading === 'break_start' ? <Loader2 size={16} /> : <Coffee size={16} />}
                Pause starten
              </button>
            ) : null}

            {isActive && isOnBreak ? (
              <button type="button" onClick={() => void endBreak()} disabled={actionLoading === 'break_end'} style={secondaryButtonStyle}>
                {actionLoading === 'break_end' ? <Loader2 size={16} /> : <Coffee size={16} />}
                Pause beenden
              </button>
            ) : null}

            {isActive ? (
              <button type="button" onClick={() => void clockOut()} disabled={actionLoading === 'clock_out'} style={dangerButtonStyle}>
                {actionLoading === 'clock_out' ? <Loader2 size={16} /> : <LogOut size={16} />}
                Arbeitstag beenden
              </button>
            ) : null}
          </div>
        </section>

        <section style={{ ...cardStyle, padding: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 860, letterSpacing: '-0.03em' }}>Nächster Einsatz</h2>
          <p style={{ margin: '6px 0 18px', color: BRAND.muted, fontSize: 13, fontWeight: 620 }}>Der nächste geplante Auftrag für heute.</p>

          {nextJob ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 860, lineHeight: 1.18, letterSpacing: '-0.035em' }}>{nextJob.title}</div>
                <div style={{ marginTop: 8, color: BRAND.muted, fontSize: 13, fontWeight: 650 }}>{nextJob.clientName}</div>
              </div>

              <div style={{ display: 'grid', gap: 8, color: BRAND.muted, fontSize: 13, fontWeight: 650 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><CalendarDays size={15} /> {formatDateTime(nextJob.plannedStart)}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Clock3 size={15} /> {formatTime(nextJob.plannedStart)} – {formatTime(nextJob.plannedEnd)}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><MapPin size={15} /> {getLocation(nextJob) || 'Adresse nicht hinterlegt'}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <a href={`${baseUrl}/einsatz/${nextJob.id}`} data-astro-prefetch="false" style={primaryButtonStyle}><Briefcase size={16} /> Einsatz öffnen</a>
                <a href={getMapsUrl(nextJob)} target="_blank" rel="noreferrer" style={secondaryButtonStyle}><Navigation size={16} /> Navigation</a>
              </div>
            </div>
          ) : (
            <div style={{ minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: BRAND.muted, fontSize: 14, fontWeight: 650, background: BRAND.soft, borderRadius: 16 }}>
              Für heute ist kein weiterer Einsatz geplant.
            </div>
          )}
        </section>
      </div>

      <div className="opc-employee-dashboard-metrics">
        <MetricCard value={todayJobs.length} label="Einsätze heute" />
        <MetricCard value={submittedToday} label="Heute eingereicht" />
        <MetricCard value={jobs.length} label="Sichtbare Einsätze" />
        <MetricCard value={isOnBreak ? 'Pause' : isActive ? 'Aktiv' : 'Nicht aktiv'} label="Tagesstatus" />
      </div>

      <section style={{ ...cardStyle, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 860, letterSpacing: '-0.03em' }}>Heutige Einsätze</h2>
            <p style={{ margin: '6px 0 0', color: BRAND.muted, fontSize: 13, fontWeight: 620 }}>Zugewiesene Jobs mit Navigation und Status.</p>
          </div>
          <a href={`${baseUrl}/einsaetze`} data-astro-prefetch="false" style={secondaryButtonStyle}>Alle Einsätze</a>
        </div>

        {todayJobs.length === 0 ? (
          <div style={{ minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: BRAND.muted, fontSize: 14, fontWeight: 650, background: BRAND.soft, borderRadius: 16 }}>
            Keine Einsätze für heute gefunden.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {todayJobs.map((job) => (
              <article key={job.id} className="opc-employee-job-card">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 850, letterSpacing: '-0.03em', marginBottom: 6 }}>{job.title}</div>
                  <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 650, display: 'flex', flexWrap: 'wrap', gap: '8px 14px' }}>
                    <span>{formatTime(job.plannedStart)} – {formatTime(job.plannedEnd)}</span>
                    <span>{job.clientName}</span>
                    <span>{getLocation(job) || 'Adresse offen'}</span>
                  </div>
                </div>

                <div className="opc-employee-job-actions">
                  <StatusPill status={job.status} />
                  <a href={`${baseUrl}/einsatz/${job.id}`} data-astro-prefetch="false" style={secondaryButtonStyle}>Öffnen</a>
                  <a href={getMapsUrl(job)} target="_blank" rel="noreferrer" style={secondaryButtonStyle}><Navigation size={15} /> Maps</a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <style>{`
        .opc-employee-dashboard-hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
        }

        .opc-employee-dashboard-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 16px;
          margin-bottom: 16px;
        }

        .opc-employee-time-stats,
        .opc-employee-dashboard-metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .opc-employee-dashboard-metrics {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-bottom: 16px;
        }

        .opc-employee-action-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 16px;
        }

        .opc-employee-job-card {
          border: 1px solid ${BRAND.border};
          border-radius: 16px;
          padding: 15px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
        }

        .opc-employee-job-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }

        @media (max-width: 920px) {
          .opc-employee-dashboard-hero,
          .opc-employee-dashboard-grid,
          .opc-employee-job-card {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: stretch;
          }

          .opc-employee-dashboard-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .opc-employee-job-actions {
            justify-content: flex-start;
          }
        }

        @media (max-width: 620px) {
          .opc-employee-dashboard h1 {
            font-size: 25px !important;
          }

          .opc-employee-time-stats,
          .opc-employee-dashboard-metrics {
            grid-template-columns: 1fr;
          }

          .opc-employee-action-row,
          .opc-employee-action-row button,
          .opc-employee-dashboard a {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

export default function DashboardHomeRouter() {
  const initialProfile = useMemo(
    () => readCachedOpcAuthProfile(),
    [],
  );
  const [profile, setProfile] = useState<UserProfile | null>(
    initialProfile,
  );
  const [loading, setLoading] = useState(!initialProfile);
  const didProfileLoadRef = useRef(Boolean(initialProfile));

  useEffect(() => {
    if (didProfileLoadRef.current) return;
    didProfileLoadRef.current = true;

    let mounted = true;

    async function loadProfile() {
      try {
        const nextProfile = await loadOpcAuthProfile();
        if (mounted) setProfile(nextProfile);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: BRAND.muted, fontFamily: pageFont, fontWeight: 700 }}>
        Dashboard wird geladen...
      </div>
    );
  }

  if (normalizeRole(profile?.role) === 'employee' && profile) {
    return <EmployeeDashboardContent profile={profile} />;
  }

  return <OwnerDashboardHome />;
}
