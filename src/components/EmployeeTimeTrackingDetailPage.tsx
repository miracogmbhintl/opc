import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import MirakaDashboardShell from './MirakaDashboardShell';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  StickyNote,
} from 'lucide-react';
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
  blue: '#155E75',
};

const OPC_BRAND = BRAND;

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

const OPC_PAGE_FONT = pageFont;

const cardStyle: CSSProperties = {
  background: BRAND.card,
  border: `1px solid ${BRAND.border}`,
  borderRadius: '20px',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

const opcSecondaryButtonStyle: CSSProperties = {
  height: '42px',
  padding: '0 14px',
  borderRadius: '13px',
  border: `1px solid ${BRAND.border}`,
  background: '#FFFFFF',
  color: BRAND.text,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  fontSize: '13px',
  fontWeight: 760,
  fontFamily: pageFont,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  textDecoration: 'none',
};

const opcResponsiveStyle = '';

type ViewerAccess = {
  userId: string;
  email: string | null;
  profileRole: string | null;
  staffRole: StaffRole | null;
  canManage: boolean;
};

type StaffRole = {
  id: string;
  user_id: string | null;
  employee_id: string | null;
  role: string;
  status: string;
  display_name: string | null;
  email: string | null;
  phone_raw: string | null;
  phone_e164: string | null;
  whatsapp_wa_id: string | null;
  can_manage_reports?: boolean | null;
  can_manage_employees?: boolean | null;
  can_manage_finance?: boolean | null;
  can_view_all_jobs?: boolean | null;
};

type TimeEntry = {
  id: string;
  user_id: string;
  staff_role_id?: string | null;
  employee_id?: string | null;
  employee_name?: string | null;
  work_date: string;
  clock_in_at?: string | null;
  clock_out_at?: string | null;
  break_started_at?: string | null;
  break_minutes?: number | null;
  total_minutes?: number | null;
  status: string;
  employee_note?: string | null;
  dispatch_note?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type TeamPresence = {
  staff_role_id: string;
  user_id: string | null;
  employee_id: string | null;
  display_name: string | null;
  role: string | null;
  email: string | null;
  phone_raw: string | null;
  phone_e164: string | null;
  whatsapp_wa_id: string | null;
  is_working: boolean;
  is_on_break: boolean;
  time_status: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  break_started_at: string | null;
  total_minutes: number | null;
  last_activity_at: string | null;
};

type Props = {
  staffRoleId?: string;
};

function pad(num: number) {
  return String(num).padStart(2, '0');
}

function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

function monthRange(monthValue: string) {
  const [yearRaw, monthRaw] = monthValue.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  return {
    startDate: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    endDate: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  };
}

function normalize(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function isManagerText(role?: string | null) {
  return ['owner', 'admin', 'dispatch', 'dispatcher', 'disposition', 'inhaber'].includes(normalize(role));
}

function isManagerStaff(staff: StaffRole | null) {
  if (!staff) return false;

  return (
    isManagerText(staff.role) ||
    staff.can_manage_reports === true ||
    staff.can_manage_employees === true ||
    staff.can_manage_finance === true ||
    staff.can_view_all_jobs === true
  );
}

function isActiveTimeEntryStatus(status?: string | null) {
  const clean = normalize(status);

  return ['open', 'on_break', 'active', 'clocked_in', 'started', 'running', 'in_progress'].includes(clean);
}

function formatMinutes(minutes?: number | null) {
  const safe = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${hours}h ${pad(mins)}m`;
}

function formatDate(value?: string | null) {
  if (!value) return '—';

  try {
    return new Intl.DateTimeFormat('de-CH', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${value}T12:00:00`));
  } catch {
    return value;
  }
}

function formatTime(value?: string | null) {
  if (!value) return '—';

  try {
    return new Intl.DateTimeFormat('de-CH', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '—';
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';

  try {
    return new Intl.DateTimeFormat('de-CH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    open: 'Aktiv',
    active: 'Aktiv',
    clocked_in: 'Aktiv',
    started: 'Aktiv',
    running: 'Aktiv',
    in_progress: 'Aktiv',
    on_break: 'Pause',
    submitted: 'Eingereicht',
    approved: 'Genehmigt',
    rejected: 'Abgelehnt',
    corrected: 'Korrigiert',
    not_clocked_in: 'Nicht aktiv',
  };

  return labels[normalize(status)] || 'Nicht aktiv';
}

function isCurrentWeek(workDate?: string | null) {
  if (!workDate) return false;

  const date = new Date(`${workDate}T12:00:00`);
  const now = new Date();

  const day = now.getDay() || 7;
  const start = new Date(now);
  start.setDate(now.getDate() - day + 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return date >= start && date <= end;
}

function liveMinutesFromEntry(entry: TimeEntry | null) {
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
    Math.floor((now - start) / 60000) -
      Number(entry.break_minutes || 0) -
      activeBreakMinutes
  );
}

function presenceToStaffRole(row: TeamPresence): StaffRole {
  return {
    id: row.staff_role_id,
    user_id: row.user_id,
    employee_id: row.employee_id,
    role: row.role || 'employee',
    status: 'active',
    display_name: row.display_name,
    email: row.email,
    phone_raw: row.phone_raw,
    phone_e164: row.phone_e164,
    whatsapp_wa_id: row.whatsapp_wa_id,
  };
}

function getContactHref(type: 'phone' | 'email' | 'whatsapp', person: StaffRole | TeamPresence | null) {
  if (!person) return '';

  if (type === 'email' && person.email) return `mailto:${person.email}`;

  if (type === 'phone') {
    const phone = person.phone_e164 || person.phone_raw;
    if (phone) return `tel:${phone}`;
  }

  if (type === 'whatsapp') {
    const phone = person.whatsapp_wa_id || person.phone_e164 || person.phone_raw;
    if (phone) return `https://wa.me/${String(phone).replace(/\D/g, '')}`;
  }

  return '';
}

function StatusBadge({ status }: { status: string }) {
  const clean = normalize(status);

  const style =
    clean === 'approved'
      ? { background: '#F0FDF4', color: '#166534', border: '#BBF7D0' }
      : clean === 'rejected'
        ? { background: '#FEF2F2', color: '#B91C1C', border: '#FECACA' }
        : clean === 'submitted'
          ? { background: '#FFFBEB', color: '#92400E', border: '#FDE68A' }
          : clean === 'on_break'
            ? { background: '#ECFEFF', color: '#155E75', border: '#A5F3FC' }
            : clean === 'open'
              ? { background: '#F0FDF4', color: '#166534', border: '#BBF7D0' }
              : { background: '#F9FAFB', color: OPC_BRAND.muted, border: OPC_BRAND.border };

  return (
    <span
      style={{
        minHeight: '28px',
        padding: '0 12px',
        borderRadius: '999px',
        border: `1px solid ${style.border}`,
        background: style.background,
        color: style.color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 760,
        whiteSpace: 'nowrap',
      }}
    >
      {statusLabel(status)}
    </span>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={infoLabelStyle}>{label}</div>
      <div style={infoValueStyle}>{value}</div>
    </div>
  );
}

function ContactButtons({ person }: { person: StaffRole | TeamPresence | null }) {
  const phoneHref = getContactHref('phone', person);
  const emailHref = getContactHref('email', person);
  const whatsappHref = getContactHref('whatsapp', person);

  return (
    <>
      {phoneHref && (
        <a href={phoneHref} style={contactButtonStyle}>
          <Phone size={16} />
          Anrufen
        </a>
      )}

      {emailHref && (
        <a href={emailHref} style={contactButtonStyle}>
          <Mail size={16} />
          E-Mail
        </a>
      )}

      {whatsappHref && (
        <a href={whatsappHref} target="_blank" rel="noreferrer" style={contactButtonStyle}>
          <MessageCircle size={16} />
          WhatsApp
        </a>
      )}
    </>
  );
}

function DetailMetricCard({ value, label, icon }: { value: string | number; label: string; icon: ReactNode }) {
  return (
    <article className="opc-detail-metric-card" style={detailMetricCardStyle}>
      <div style={{ minWidth: 0 }}>
        <div className="opc-detail-metric-value" style={detailMetricValueStyle}>{value}</div>
        <div className="opc-detail-metric-label" style={detailMetricLabelStyle}>{label}</div>
      </div>

      <div className="opc-detail-metric-icon" style={detailMetricIconStyle}>{icon}</div>
    </article>
  );
}

export default function EmployeeTimeTrackingDetailPage({ staffRoleId }: Props) {
  return (
    <MirakaDashboardShell
      title="Zeiterfassung Details"
      requiredRole={['owner', 'admin', 'dispatch', 'employee']}
      currentPath="/zeiterfassung"
      hideTopBar={true}
    >
      <EmployeeTimeTrackingDetailContent staffRoleId={staffRoleId} />
    </MirakaDashboardShell>
  );
}

function EmployeeTimeTrackingDetailContent({ staffRoleId }: Props) {
  const [viewerAccess, setViewerAccess] = useState<ViewerAccess | null>(null);
  const [targetStaffRole, setTargetStaffRole] = useState<StaffRole | null>(null);
  const [presence, setPresence] = useState<TeamPresence | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [month, setMonth] = useState(currentMonthValue());
  const [reviewNote, setReviewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [tick, setTick] = useState(0);
  const notesSectionRef = useRef<HTMLElement | null>(null);

  const canManage = viewerAccess?.canManage === true;

  const isOwnPage = Boolean(
    viewerAccess?.staffRole &&
      targetStaffRole &&
      viewerAccess.staffRole.id === targetStaffRole.id
  );

  useEffect(() => {
    void loadAll();
  }, [staffRoleId, month]);

  useEffect(() => {
    const interval = window.setInterval(() => setTick((value) => value + 1), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const activeEntry = useMemo(() => {
    return entries.find(
      (entry) =>
        entry.work_date === todayString() &&
        !entry.clock_out_at &&
        isActiveTimeEntryStatus(entry.status)
    ) || null;
  }, [entries]);

  const noteEntries = useMemo(() => {
    return entries.filter(
      (entry) =>
        Boolean(entry.employee_note && entry.employee_note.trim()) ||
        Boolean(entry.dispatch_note && entry.dispatch_note.trim())
    );
  }, [entries]);

  const metrics = useMemo(() => {
    const today = todayString();

    const todayTotal = entries
      .filter((entry) => entry.work_date === today)
      .reduce((sum, entry) => sum + (entry.id === activeEntry?.id ? liveMinutesFromEntry(entry) : Number(entry.total_minutes || 0)), 0);

    const weekTotal = entries
      .filter((entry) => isCurrentWeek(entry.work_date))
      .reduce((sum, entry) => sum + (entry.id === activeEntry?.id ? liveMinutesFromEntry(entry) : Number(entry.total_minutes || 0)), 0);

    const monthTotal = entries.reduce(
      (sum, entry) => sum + (entry.id === activeEntry?.id ? liveMinutesFromEntry(entry) : Number(entry.total_minutes || 0)),
      0
    );

    const submitted = entries.filter((entry) => normalize(entry.status) === 'submitted').length;

    return {
      todayTotal,
      weekTotal,
      monthTotal,
      submitted,
    };
  }, [entries, activeEntry, tick]);

  async function resolveViewerAccess(): Promise<ViewerAccess> {
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) throw userError;

    const user = userData.user;

    if (!user?.id) throw new Error('Nicht eingeloggt.');

    const userId = user.id;
    const email = user.email || null;

    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const profileRole =
      (profileData as any)?.role ||
      (profileData as any)?.user_role ||
      (profileData as any)?.account_role ||
      null;

    const { data: staffByUserData } = await supabase
      .from('opc_staff_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let staffRole = (staffByUserData || null) as StaffRole | null;

    if (!staffRole && email) {
      const { data: staffByEmailData } = await supabase
        .from('opc_staff_roles')
        .select('*')
        .ilike('email', email)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      staffRole = (staffByEmailData || null) as StaffRole | null;
    }

    const canManage = isManagerText(profileRole) || isManagerStaff(staffRole);

    return {
      userId,
      email,
      profileRole,
      staffRole,
      canManage,
    };
  }

  async function loadAll() {
    setLoading(true);
    setErrorMessage('');

    try {
      const targetId = staffRoleId;

      if (!targetId) {
        throw new Error('Keine Mitarbeiter-ID in der URL gefunden.');
      }

      const viewer = await resolveViewerAccess();
      setViewerAccess(viewer);

      const { data: presenceData, error: presenceError } = await supabase.rpc('opc_get_team_time_presence', {
        p_work_date: todayString(),
      });

      const presenceRows = presenceError ? [] : ((presenceData || []) as TeamPresence[]);
      const targetPresence = presenceRows.find((row) => row.staff_role_id === targetId) || null;
      setPresence(targetPresence);

      let resolvedTarget: StaffRole | null = targetPresence ? presenceToStaffRole(targetPresence) : null;

      if (!resolvedTarget) {
        const { data: targetData } = await supabase
          .from('opc_staff_roles')
          .select('*')
          .eq('id', targetId)
          .maybeSingle();

        resolvedTarget = (targetData || null) as StaffRole | null;
      }

      if (!resolvedTarget) {
        throw new Error(`Mitarbeiter wurde nicht gefunden. ID: ${targetId}`);
      }

      const viewerOwnTarget =
        viewer.staffRole?.id === resolvedTarget.id ||
        (viewer.staffRole?.user_id && viewer.staffRole.user_id === resolvedTarget.user_id) ||
        (viewer.userId && viewer.userId === resolvedTarget.user_id) ||
        (viewer.email && resolvedTarget.email && normalize(viewer.email) === normalize(resolvedTarget.email));

      if (!viewer.canManage && !viewerOwnTarget) {
        throw new Error(
          `Du hast keinen Zugriff auf diese Mitarbeiter-Zeiterfassung. Aktuelle Rolle: ${viewer.profileRole || viewer.staffRole?.role || 'unbekannt'}`
        );
      }

      setTargetStaffRole(resolvedTarget);

      await loadEntriesForTarget(resolvedTarget);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Details konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  async function loadEntriesForTarget(target: StaffRole) {
    const { startDate, endDate } = monthRange(month);

    const filters = [`staff_role_id.eq.${target.id}`];

    if (target.user_id) filters.push(`user_id.eq.${target.user_id}`);
    if (target.employee_id) filters.push(`employee_id.eq.${target.employee_id}`);

    const { data, error } = await supabase
      .from('opc_employee_time_entries')
      .select('*')
      .or(filters.join(','))
      .gte('work_date', startDate)
      .lte('work_date', endDate)
      .order('work_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    setEntries((data || []) as TimeEntry[]);
  }

  async function approveEntry(entryId: string) {
    setSaving(`approve-${entryId}`);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { error } = await supabase.rpc('opc_approve_employee_time_entry', {
        p_time_entry_id: entryId,
        p_dispatch_note: reviewNote.trim() || null,
      });

      if (error) throw error;

      setReviewNote('');
      setSuccessMessage('Zeiteintrag genehmigt.');
      await loadAll();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Zeiteintrag konnte nicht genehmigt werden.');
    } finally {
      setSaving(null);
    }
  }

  async function rejectEntry(entryId: string) {
    setSaving(`reject-${entryId}`);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { error } = await supabase.rpc('opc_reject_employee_time_entry', {
        p_time_entry_id: entryId,
        p_dispatch_note: reviewNote.trim() || null,
      });

      if (error) throw error;

      setReviewNote('');
      setSuccessMessage('Zeiteintrag abgelehnt.');
      await loadAll();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Zeiteintrag konnte nicht abgelehnt werden.');
    } finally {
      setSaving(null);
    }
  }


  function scrollToNotes() {
    notesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (loading) {
    return (
      <div style={loadingStyle}>
        <Loader2 size={20} className="spin" style={{ marginRight: 8 }} />
        Zeiterfassung Details werden geladen...
        <style>{spinStyle}</style>
      </div>
    );
  }

  if (errorMessage && !targetStaffRole) {
    return (
      <div className="opc-time-page" style={{ padding: 0, fontFamily: pageFont, color: BRAND.text }}>
        <button type="button" onClick={() => window.history.back()} style={backButtonStyle}>
          <ArrowLeft size={17} />
          Zurück
        </button>

        <div style={errorStyle}>
          <AlertTriangle size={18} />
          {errorMessage}
        </div>
      </div>
    );
  }

  if (!targetStaffRole) return null;

  const status = presence?.time_status || 'not_clocked_in';

  return (
    <div className="opc-time-page" style={{ padding: 0, fontFamily: pageFont, color: BRAND.text }}>
      <div className="opc-detail-topbar" style={topBarStyle}>
        <button type="button" onClick={() => window.history.back()} style={backButtonStyle}>
          <ArrowLeft size={17} />
          Zurück
        </button>

        <div className="opc-detail-topbar-actions" style={topBarActionsStyle}>
          {(canManage || noteEntries.length > 0) && (
            <button type="button" onClick={scrollToNotes} style={{ ...opcSecondaryButtonStyle, width: 'auto' }}>
              <StickyNote size={17} />
              Notiz
            </button>
          )}

          <button type="button" onClick={() => void loadAll()} style={{ ...opcSecondaryButtonStyle, width: 'auto' }}>
            <RefreshCw size={17} />
            Aktualisieren
          </button>
        </div>
      </div>

      {errorMessage && <div style={errorStyle}>{errorMessage}</div>}
      {successMessage && <div style={successStyle}>{successMessage}</div>}

      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>{targetStaffRole.role || 'employee'}</div>
          <h1 style={titleStyle}>{targetStaffRole.display_name || 'Mitarbeiter'}</h1>
          <p style={subtitleStyle}>
            {isOwnPage
              ? 'Eigene Zeiterfassung, Arbeitsstatus und Monatsübersicht.'
              : 'Mitarbeiter-Zeiterfassung, Live-Status und Freigabeübersicht.'}
          </p>
        </div>

        <div style={badgeWrapStyle}>
          <StatusBadge status={status} />
          <span style={badgeStyle}>{targetStaffRole.status || 'active'}</span>
        </div>
      </section>

      <div className="opc-detail-metric-grid" style={detailMetricGridStyle}>
        <DetailMetricCard value={formatMinutes(metrics.todayTotal)} label="Heute" icon={<Clock3 size={18} />} />
        <DetailMetricCard value={formatMinutes(metrics.weekTotal)} label="Diese Woche" icon={<CalendarClock size={18} />} />
        <DetailMetricCard value={formatMinutes(metrics.monthTotal)} label="Dieser Monat" icon={<CalendarClock size={18} />} />
        <DetailMetricCard value={metrics.submitted} label="Offen zur Freigabe" icon={<CheckCircle2 size={18} />} />
      </div>

      <div className="opc-detail-two-grid" style={detailGridStyle}>
        <section className="opc-info-card" style={infoCardStyle}>
          <div style={sectionHeaderStyle}>Kontakt & Rolle</div>

          <div className="opc-info-card-body" style={infoGridStyle}>
            <InfoBlock label="Name" value={targetStaffRole.display_name || '—'} />
            <InfoBlock label="Rolle" value={targetStaffRole.role || 'employee'} />
            <InfoBlock label="Telefon" value={targetStaffRole.phone_raw || targetStaffRole.phone_e164 || '—'} />
            <InfoBlock label="E-Mail" value={targetStaffRole.email || '—'} />
          </div>
        </section>

        <section className="opc-info-card" style={infoCardStyle}>
          <div style={sectionHeaderStyle}>Live-Status</div>

          <div className="opc-info-card-body" style={infoGridStyle}>
            <InfoBlock label="Status" value={statusLabel(status)} />
            <InfoBlock label="Start heute" value={formatTime(presence?.clock_in_at)} />
            <InfoBlock label="Letzte Aktivität" value={formatDateTime(presence?.last_activity_at)} />
            <InfoBlock label="Heute total" value={formatMinutes(presence?.total_minutes || metrics.todayTotal)} />
          </div>
        </section>
      </div>

      <div className="opc-contact-actions" style={contactActionsWrapStyle}>
        <ContactButtons person={targetStaffRole} />
      </div>

      <section style={{ marginTop: 22 }}>
        {entries.length === 0 ? (
          <div style={emptyStandaloneStyle}>
            <Clock3 size={24} />
            Keine Einträge vorhanden.
          </div>
        ) : (
          <div style={entryCardsWrapStyle}>
            {entries.map((entry) => {
              const total = entry.id === activeEntry?.id ? liveMinutesFromEntry(entry) : Number(entry.total_minutes || 0);
              const isSubmitted = normalize(entry.status) === 'submitted';

              return (
                <article key={entry.id} className="opc-entry-card" style={entryCardStyle}>
                  <div style={entryCardHeaderStyle}>
                    <div style={{ minWidth: 0 }}>
                      <div style={rowTitleStyle}>{formatDate(entry.work_date)}</div>
                      <div style={rowSubStyle}>
                        {formatTime(entry.clock_in_at)} – {formatTime(entry.clock_out_at)}
                      </div>
                    </div>

                    <StatusBadge status={entry.status} />
                  </div>

                  <div className="opc-entry-card-grid" style={entryStatsGridStyle}>
                    <InfoBlock label="Total" value={formatMinutes(total)} />
                    <InfoBlock label="Pause" value={formatMinutes(entry.break_minutes || 0)} />
                    <InfoBlock label="Start" value={formatTime(entry.clock_in_at)} />
                    <InfoBlock label="Ende" value={formatTime(entry.clock_out_at)} />
                  </div>

                  {canManage && isSubmitted && (
                    <div style={entryActionsStyle}>
                      <button
                        type="button"
                        onClick={() => approveEntry(entry.id)}
                        disabled={saving === `approve-${entry.id}`}
                        style={smallApproveButtonStyle}
                      >
                        Genehmigen
                      </button>

                      <button
                        type="button"
                        onClick={() => rejectEntry(entry.id)}
                        disabled={saving === `reject-${entry.id}`}
                        style={smallRejectButtonStyle}
                      >
                        Ablehnen
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {(canManage || noteEntries.length > 0) && (
        <section ref={notesSectionRef} id="zeit-notizen" style={notesSectionStyle}>
          {canManage && (
            <article style={noteCardStyle}>
              <div style={noteCardTitleStyle}>Freigabe-Notiz</div>
              <textarea
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="Optional. Beispiel: Zeiten geprüft. Diese Notiz wird beim Genehmigen oder Ablehnen gespeichert."
                style={noteTextareaStyle}
                rows={4}
              />
            </article>
          )}

          {noteEntries.length > 0 && (
            <div style={noteCardsWrapStyle}>
              {noteEntries.map((entry) => (
                <article key={`note-${entry.id}`} style={noteCardStyle}>
                  <div style={noteCardHeaderStyle}>
                    <div>
                      <div style={noteCardTitleStyle}>{formatDate(entry.work_date)}</div>
                      <div style={rowSubStyle}>
                        {formatTime(entry.clock_in_at)} – {formatTime(entry.clock_out_at)}
                      </div>
                    </div>

                    <StatusBadge status={entry.status} />
                  </div>

                  {entry.employee_note && entry.employee_note.trim() && (
                    <div style={noteBlockStyle}>
                      <div style={infoLabelStyle}>Mitarbeiter-Notiz</div>
                      <p style={noteTextStyle}>{entry.employee_note}</p>
                    </div>
                  )}

                  {entry.dispatch_note && entry.dispatch_note.trim() && (
                    <div style={noteBlockStyle}>
                      <div style={infoLabelStyle}>Dispatch-Notiz</div>
                      <p style={noteTextStyle}>{entry.dispatch_note}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <style>{`${opcResponsiveStyle}${spinStyle}`}</style>
    </div>
  );
}

const loadingStyle: CSSProperties = {
  minHeight: '60vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: OPC_BRAND.muted,
  fontSize: '14px',
  fontWeight: 650,
  fontFamily: OPC_PAGE_FONT,
};

const topBarStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  marginBottom: 22,
};

const topBarActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 10,
  flexWrap: 'wrap',
};

const backButtonStyle: CSSProperties = {
  height: '42px',
  padding: '0 14px',
  borderRadius: '13px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontSize: '13px',
  fontWeight: 760,
  fontFamily: OPC_PAGE_FONT,
  cursor: 'pointer',
};

const heroStyle: CSSProperties = {
  ...cardStyle,
  padding: '20px',
  marginBottom: '22px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '16px',
};

const eyebrowStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 820,
  color: OPC_BRAND.muted,
  marginBottom: 8,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '24px',
  lineHeight: 1.08,
  letterSpacing: '-0.04em',
  fontWeight: 820,
  color: OPC_BRAND.text,
};

const subtitleStyle: CSSProperties = {
  margin: '8px 0 0',
  fontSize: '13px',
  lineHeight: 1.45,
  color: OPC_BRAND.muted,
  fontWeight: 620,
};

const badgeWrapStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
};

const badgeStyle: CSSProperties = {
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#F8FAFC',
  color: OPC_BRAND.muted,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
  fontWeight: 760,
  whiteSpace: 'nowrap',
};


const sectionHeaderStyle: CSSProperties = {
  padding: '20px 20px 12px',
  borderBottom: '0',
  fontSize: '15px',
  fontWeight: 820,
  color: OPC_BRAND.text,
  letterSpacing: '-0.015em',
};




const detailMetricGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: '16px',
  marginBottom: '22px',
};

const detailMetricCardStyle: CSSProperties = {
  ...cardStyle,
  minHeight: '112px',
  padding: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16px',
  minWidth: 0,
  boxSizing: 'border-box',
};

const detailMetricValueStyle: CSSProperties = {
  fontSize: '26px',
  lineHeight: 1,
  letterSpacing: '-0.04em',
  fontWeight: 820,
  color: OPC_BRAND.text,
  whiteSpace: 'nowrap',
};

const detailMetricLabelStyle: CSSProperties = {
  marginTop: '12px',
  fontSize: '13px',
  lineHeight: 1.2,
  fontWeight: 720,
  color: OPC_BRAND.muted,
};

const detailMetricIconStyle: CSSProperties = {
  width: '38px',
  height: '38px',
  flex: '0 0 auto',
  borderRadius: '13px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FAFAFA',
  color: OPC_BRAND.black,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const infoCardStyle: CSSProperties = {
  ...cardStyle,
  width: '100%',
  overflow: 'hidden',
  boxSizing: 'border-box',
};

const detailGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '16px',
  marginTop: 0,
};

const infoGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '16px',
  padding: '0 20px 20px',
};

const infoLabelStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 760,
  color: OPC_BRAND.faint,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 5,
};

const infoValueStyle: CSSProperties = {
  fontSize: '14px',
  fontWeight: 720,
  color: OPC_BRAND.text,
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
};

const contactActionsWrapStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  alignItems: 'center',
  gap: '10px',
  marginTop: '12px',
  marginBottom: '22px',
};

const contactButtonStyle: CSSProperties = {
  height: '42px',
  padding: '0 14px',
  borderRadius: '13px',
  border: `1px solid ${OPC_BRAND.black}`,
  background: OPC_BRAND.black,
  color: '#FFFFFF',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontSize: '13px',
  fontWeight: 760,
  fontFamily: OPC_PAGE_FONT,
  textDecoration: 'none',
  boxSizing: 'border-box',
  whiteSpace: 'nowrap',
};


const rowTitleStyle: CSSProperties = {
  fontSize: '18px',
  lineHeight: 1.2,
  fontWeight: 840,
  color: OPC_BRAND.text,
  letterSpacing: '-0.03em',
  marginBottom: '6px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const rowSubStyle: CSSProperties = {
  fontSize: '14px',
  fontWeight: 680,
  color: OPC_BRAND.muted,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};


const smallApproveButtonStyle: CSSProperties = {
  height: 34,
  padding: '0 12px',
  borderRadius: 12,
  border: `1px solid ${OPC_BRAND.black}`,
  background: OPC_BRAND.black,
  color: '#FFFFFF',
  fontSize: 12,
  fontWeight: 760,
  cursor: 'pointer',
};

const smallRejectButtonStyle: CSSProperties = {
  height: 34,
  padding: '0 12px',
  borderRadius: 12,
  border: '1px solid #FCA5A5',
  background: '#FEF2F2',
  color: OPC_BRAND.red,
  fontSize: 12,
  fontWeight: 760,
  cursor: 'pointer',
};


const entryCardsWrapStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: '14px',
};

const entryCardStyle: CSSProperties = {
  ...cardStyle,
  width: '100%',
  padding: '20px',
  fontFamily: OPC_PAGE_FONT,
  boxSizing: 'border-box',
};

const entryCardHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '14px',
  marginBottom: '16px',
};

const entryStatsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: '12px',
};

const entryActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 10,
  flexWrap: 'wrap',
  marginTop: 18,
};

const notesSectionStyle: CSSProperties = {
  marginTop: '22px',
  scrollMarginTop: 90,
  display: 'grid',
  gap: '14px',
};




const noteCardsWrapStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 14,
};

const noteCardStyle: CSSProperties = {
  ...cardStyle,
  width: '100%',
  padding: '20px',
  boxSizing: 'border-box',
};

const noteCardHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 14,
  marginBottom: 14,
};

const noteCardTitleStyle: CSSProperties = {
  fontSize: '15px',
  fontWeight: 820,
  color: OPC_BRAND.text,
  letterSpacing: '-0.015em',
};

const noteBlockStyle: CSSProperties = {
  paddingTop: 12,
  marginTop: 12,
  borderTop: '1px solid #F3F4F6',
};

const noteTextStyle: CSSProperties = {
  margin: '7px 0 0',
  color: OPC_BRAND.muted,
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 620,
  whiteSpace: 'pre-wrap',
};

const noteTextareaStyle: CSSProperties = {
  width: '100%',
  marginTop: 12,
  padding: '13px 14px',
  minHeight: 110,
  borderRadius: 14,
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  outline: 'none',
  resize: 'vertical',
  fontSize: 14,
  fontWeight: 620,
  lineHeight: 1.45,
  fontFamily: OPC_PAGE_FONT,
  boxSizing: 'border-box',
};

const emptyStandaloneStyle: CSSProperties = {
  ...cardStyle,
  minHeight: 118,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  color: OPC_BRAND.muted,
  fontSize: '14px',
  fontWeight: 700,
};


const errorStyle: CSSProperties = {
  marginBottom: 22,
  padding: '14px 16px',
  borderRadius: '14px',
  border: '1px solid #FCA5A5',
  background: '#FEF2F2',
  color: OPC_BRAND.red,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: '14px',
  fontWeight: 700,
};

const successStyle: CSSProperties = {
  marginBottom: 22,
  padding: '14px 16px',
  borderRadius: '14px',
  border: '1px solid #BBF7D0',
  background: '#F0FDF4',
  color: OPC_BRAND.green,
  fontSize: '14px',
  fontWeight: 700,
};

const spinStyle = `
  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .opc-detail-metric-grid > *,
  .opc-detail-two-grid > *,
  .opc-entry-card-grid > * {
    min-width: 0 !important;
  }

  @media (max-width: 1180px) {
    .opc-detail-metric-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
  }

  @media (max-width: 860px) {
    .opc-detail-metric-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 10px !important;
      margin-bottom: 16px !important;
    }

    .opc-detail-metric-card {
      min-height: 96px !important;
      padding: 14px !important;
      border-radius: 20px !important;
    }

    .opc-detail-metric-value {
      font-size: 22px !important;
    }

    .opc-detail-metric-label {
      font-size: 12px !important;
      margin-top: 8px !important;
    }

    .opc-detail-metric-icon {
      width: 36px !important;
      height: 36px !important;
      border-radius: 12px !important;
    }

    .opc-detail-two-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 10px !important;
    }

    .opc-info-card {
      border-radius: 18px !important;
    }

    .opc-info-card-body {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 12px !important;
      padding: 0 14px 14px !important;
    }

    .opc-contact-actions {
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      gap: 8px !important;
      margin-bottom: 16px !important;
    }

    .opc-contact-actions a {
      height: 40px !important;
      min-width: 0 !important;
      font-size: 12px !important;
      padding: 0 8px !important;
    }

    .opc-entry-card-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 10px !important;
    }

    .opc-entry-card {
      padding: 16px !important;
      border-radius: 18px !important;
    }
  }

  @media (max-width: 560px) {
    .opc-detail-topbar {
      align-items: flex-start !important;
    }

    .opc-detail-topbar-actions {
      justify-content: flex-end !important;
      gap: 8px !important;
    }

    .opc-detail-topbar-actions button {
      height: 40px !important;
      font-size: 12px !important;
      padding: 0 10px !important;
    }
  }
`;