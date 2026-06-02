import { useEffect, useMemo, useState, type CSSProperties } from 'react';
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
} from 'lucide-react';
import {
  OPCPageShell,
  OPCMetricsGrid,
  OPCMetricCard,
  OPCListCard,
  OPC_BRAND,
  OPC_PAGE_FONT,
  opcResponsiveStyle,
  opcSelectStyle,
  opcInputStyle,
  opcSecondaryButtonStyle,
} from './opc/OPCPageTop';

type StatusFilter = 'all' | 'open' | 'on_break' | 'submitted' | 'approved' | 'rejected';

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

  const style: CSSProperties =
    clean === 'approved'
      ? { background: '#DCFCE7', color: OPC_BRAND.green }
      : clean === 'rejected'
        ? { background: '#FEF2F2', color: OPC_BRAND.red }
        : clean === 'submitted'
          ? { background: '#FFFBEB', color: '#92400E' }
          : clean === 'on_break'
            ? { background: '#ECFEFF', color: OPC_BRAND.blue }
            : clean === 'open'
              ? { background: '#F0FDF4', color: OPC_BRAND.green }
              : { background: '#F8FAFC', color: OPC_BRAND.muted };

  return (
    <span
      style={{
        minHeight: '30px',
        padding: '0 12px',
        borderRadius: '999px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 760,
        whiteSpace: 'nowrap',
        ...style,
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
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {phoneHref && (
        <a href={phoneHref} style={contactButtonStyle}>
          <Phone size={15} />
          Anrufen
        </a>
      )}

      {emailHref && (
        <a href={emailHref} style={contactButtonStyle}>
          <Mail size={15} />
          E-Mail
        </a>
      )}

      {whatsappHref && (
        <a href={whatsappHref} target="_blank" rel="noreferrer" style={contactButtonStyle}>
          <MessageCircle size={15} />
          WhatsApp
        </a>
      )}
    </div>
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [reviewNote, setReviewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [tick, setTick] = useState(0);

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
        ['open', 'on_break'].includes(normalize(entry.status))
    ) || null;
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (statusFilter === 'all') return entries;
    return entries.filter((entry) => normalize(entry.status) === statusFilter);
  }, [entries, statusFilter]);

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
      <OPCPageShell>
        <button type="button" onClick={() => window.history.back()} style={backButtonStyle}>
          <ArrowLeft size={17} />
          Zurück
        </button>

        <div style={errorStyle}>
          <AlertTriangle size={18} />
          {errorMessage}
        </div>
      </OPCPageShell>
    );
  }

  if (!targetStaffRole) return null;

  const status = presence?.time_status || 'not_clocked_in';

  return (
    <OPCPageShell>
      <div style={topBarStyle}>
        <button type="button" onClick={() => window.history.back()} style={backButtonStyle}>
          <ArrowLeft size={17} />
          Zurück
        </button>

        <button type="button" onClick={() => void loadAll()} style={{ ...opcSecondaryButtonStyle, width: 'auto' }}>
          <RefreshCw size={17} />
          Aktualisieren
        </button>
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

      <OPCMetricsGrid>
        <OPCMetricCard value={formatMinutes(metrics.todayTotal)} label="Heute" icon={<Clock3 size={18} />} />
        <OPCMetricCard value={formatMinutes(metrics.weekTotal)} label="Diese Woche" icon={<CalendarClock size={18} />} />
        <OPCMetricCard value={formatMinutes(metrics.monthTotal)} label="Dieser Monat" icon={<CalendarClock size={18} />} />
        <OPCMetricCard value={metrics.submitted} label="Offen zur Freigabe" icon={<CheckCircle2 size={18} />} />
      </OPCMetricsGrid>

      {canManage && (
        <section style={actionCardStyle}>
          <div style={sectionHeaderStyle}>Bearbeitung</div>

          <div style={editGridStyle}>
            <label style={labelStyle}>
              Monat
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                style={opcInputStyle}
              />
            </label>

            <label style={labelStyle}>
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                style={opcSelectStyle}
              >
                <option value="all">Alle Status</option>
                <option value="open">Aktiv</option>
                <option value="on_break">Pause</option>
                <option value="submitted">Eingereicht</option>
                <option value="approved">Genehmigt</option>
                <option value="rejected">Abgelehnt</option>
              </select>
            </label>

            <label style={labelStyle}>
              Freigabe-Notiz
              <input
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="Optional. Beispiel: Zeiten geprüft."
                style={opcInputStyle}
              />
            </label>
          </div>
        </section>
      )}

      <div style={detailGridStyle}>
        <OPCListCard>
          <div style={sectionHeaderStyle}>Kontakt & Rolle</div>

          <div style={infoGridStyle}>
            <InfoBlock label="Name" value={targetStaffRole.display_name || '—'} />
            <InfoBlock label="Rolle" value={targetStaffRole.role || 'employee'} />
            <InfoBlock label="Telefon" value={targetStaffRole.phone_raw || targetStaffRole.phone_e164 || '—'} />
            <InfoBlock label="E-Mail" value={targetStaffRole.email || '—'} />
          </div>

          <div style={{ padding: '0 20px 20px' }}>
            <ContactButtons person={targetStaffRole} />
          </div>
        </OPCListCard>

        <OPCListCard>
          <div style={sectionHeaderStyle}>Live-Status</div>

          <div style={infoGridStyle}>
            <InfoBlock label="Status" value={statusLabel(status)} />
            <InfoBlock label="Start heute" value={formatTime(presence?.clock_in_at)} />
            <InfoBlock label="Letzte Aktivität" value={formatDateTime(presence?.last_activity_at)} />
            <InfoBlock label="Heute total" value={formatMinutes(presence?.total_minutes || metrics.todayTotal)} />
          </div>
        </OPCListCard>
      </div>

      <section style={{ marginTop: 22 }}>
        <OPCListCard>
          <div style={sectionHeaderStyle}>Zeiteinträge</div>

          {filteredEntries.length === 0 ? (
            <div style={emptyStyle}>
              <Clock3 size={24} />
              Keine Einträge vorhanden.
            </div>
          ) : (
            <>
              <div className="opc-requests-desktop-table">
                {filteredEntries.map((entry, index) => {
                  const total = entry.id === activeEntry?.id ? liveMinutesFromEntry(entry) : Number(entry.total_minutes || 0);
                  const isSubmitted = normalize(entry.status) === 'submitted';

                  return (
                    <div
                      key={entry.id}
                      style={{
                        ...entryRowStyle,
                        borderBottom: index < filteredEntries.length - 1 ? '1px solid #F3F4F6' : 'none',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={rowTitleStyle}>{formatDate(entry.work_date)}</div>
                        <div style={rowSubStyle}>Pause {formatMinutes(entry.break_minutes || 0)}</div>
                      </div>

                      <div style={dateStyle}>{formatTime(entry.clock_in_at)}</div>
                      <div style={dateStyle}>{formatTime(entry.clock_out_at)}</div>
                      <div style={dateStyle}>{formatMinutes(total)}</div>

                      <div>
                        <StatusBadge status={entry.status} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
                        {canManage && isSubmitted ? (
                          <>
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
                          </>
                        ) : (
                          <span style={badgeStyle}>Keine Aktion</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="opc-requests-mobile-cards">
                {filteredEntries.map((entry) => {
                  const total = entry.id === activeEntry?.id ? liveMinutesFromEntry(entry) : Number(entry.total_minutes || 0);

                  return (
                    <div key={entry.id} style={mobileCardStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                        <div>
                          <div style={rowTitleStyle}>{formatDate(entry.work_date)}</div>
                          <div style={rowSubStyle}>
                            {formatTime(entry.clock_in_at)} – {formatTime(entry.clock_out_at)}
                          </div>
                        </div>
                        <StatusBadge status={entry.status} />
                      </div>

                      <div style={{ display: 'grid', gap: 7, color: OPC_BRAND.muted, fontSize: 13 }}>
                        <span>Total: {formatMinutes(total)}</span>
                        <span>Pause: {formatMinutes(entry.break_minutes || 0)}</span>
                        <span>{entry.employee_note || 'Keine Notiz'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </OPCListCard>
      </section>

      <style>{`${opcResponsiveStyle}${spinStyle}`}</style>
    </OPCPageShell>
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
  background: '#FFFFFF',
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: '20px',
  padding: '22px',
  marginBottom: '22px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 18,
};

const eyebrowStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 820,
  color: OPC_BRAND.muted,
  marginBottom: 8,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '28px',
  lineHeight: 1.1,
  letterSpacing: '-0.04em',
  fontWeight: 860,
  color: OPC_BRAND.text,
};

const subtitleStyle: CSSProperties = {
  margin: '10px 0 0',
  fontSize: '14px',
  lineHeight: 1.55,
  color: OPC_BRAND.muted,
  fontWeight: 560,
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

const actionCardStyle: CSSProperties = {
  background: '#FFFFFF',
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: '20px',
  marginBottom: 22,
  overflow: 'hidden',
};

const sectionHeaderStyle: CSSProperties = {
  padding: '18px 20px',
  borderBottom: '1px solid #F3F4F6',
  fontSize: '15px',
  fontWeight: 820,
  color: OPC_BRAND.text,
};

const editGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '180px 180px 1fr',
  gap: 14,
  padding: 20,
};

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  fontSize: 13,
  fontWeight: 760,
  color: OPC_BRAND.text,
};

const detailGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 22,
};

const infoGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 18,
  padding: 20,
};

const infoLabelStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 760,
  color: OPC_BRAND.faint,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 7,
};

const infoValueStyle: CSSProperties = {
  fontSize: '14px',
  fontWeight: 720,
  color: OPC_BRAND.text,
  lineHeight: 1.35,
};

const contactButtonStyle: CSSProperties = {
  height: '38px',
  padding: '0 13px',
  borderRadius: '13px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontSize: '12px',
  fontWeight: 760,
  fontFamily: OPC_PAGE_FONT,
  textDecoration: 'none',
};

const entryRowStyle: CSSProperties = {
  width: '100%',
  display: 'grid',
  gridTemplateColumns: 'minmax(180px, 1fr) 110px 110px 110px 140px minmax(180px, 1fr)',
  alignItems: 'center',
  gap: '20px',
  padding: '20px 22px',
  border: 'none',
  background: '#FFFFFF',
  textAlign: 'left',
  fontFamily: OPC_PAGE_FONT,
};

const rowTitleStyle: CSSProperties = {
  fontSize: '15px',
  fontWeight: 800,
  color: OPC_BRAND.text,
  letterSpacing: '-0.015em',
  marginBottom: '7px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const rowSubStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: OPC_BRAND.muted,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const dateStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 760,
  color: OPC_BRAND.text,
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

const mobileCardStyle: CSSProperties = {
  width: '100%',
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: '18px',
  background: '#FFFFFF',
  padding: '16px',
  textAlign: 'left',
  fontFamily: OPC_PAGE_FONT,
  boxSizing: 'border-box',
};

const emptyStyle: CSSProperties = {
  minHeight: 150,
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

  .opc-requests-mobile-cards {
    display: none;
  }

  @media (max-width: 980px) {
    [style*="grid-template-columns: repeat(2"],
    [style*="grid-template-columns: 180px 180px 1fr"] {
      grid-template-columns: 1fr !important;
    }

    .opc-requests-desktop-table {
      display: none !important;
    }

    .opc-requests-mobile-cards {
      display: flex !important;
      flex-direction: column;
      gap: 14px;
      padding: 14px;
    }
  }
`;