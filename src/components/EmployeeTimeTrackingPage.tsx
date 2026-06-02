import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import MirakaDashboardShell from './MirakaDashboardShell';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coffee,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  UserRound,
  Users,
} from 'lucide-react';

type ActiveTab = 'my_time' | 'team_live' | 'approvals';
type StatusFilter = 'all' | 'open' | 'on_break' | 'submitted' | 'approved' | 'rejected';


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


interface StaffRole {
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
}

interface TimeEntry {
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
}

interface TeamPresence {
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
}

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

function normalizeStatus(status?: string | null) {
  return String(status || '').trim().toLowerCase();
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

  return labels[normalizeStatus(status)] || 'Nicht aktiv';
}

function statusGroup(status?: string | null): StatusFilter {
  const clean = normalizeStatus(status);

  if (clean === 'open') return 'open';
  if (clean === 'on_break') return 'on_break';
  if (clean === 'submitted') return 'submitted';
  if (clean === 'approved') return 'approved';
  if (clean === 'rejected') return 'rejected';

  return 'all';
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

function liveMinutes(entry: TimeEntry | null) {
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

function isManagerRole(staff: StaffRole | null) {
  if (!staff) return false;

  const role = normalizeStatus(staff.role);

  return (
    ['owner', 'admin', 'dispatch'].includes(role) ||
    staff.can_manage_reports === true ||
    staff.can_manage_employees === true ||
    staff.can_manage_finance === true ||
    staff.can_view_all_jobs === true
  );
}

function getContactHref(type: 'phone' | 'email' | 'whatsapp', person: TeamPresence | StaffRole) {
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
  const clean = normalizeStatus(status);

  const style =
    clean === 'rejected'
      ? { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' }
      : clean === 'approved'
        ? { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' }
        : clean === 'open'
          ? { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' }
          : clean === 'on_break'
            ? { bg: '#ECFEFF', text: '#155E75', border: '#A5F3FC' }
            : clean === 'submitted'
              ? { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' }
              : { bg: '#F9FAFB', text: BRAND.muted, border: BRAND.border };

  return (
    <span
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
      {statusLabel(status)}
    </span>
  );
}

function DetailStatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div
      className="opc-time-detail-card"
      style={{
        ...cardStyle,
        minHeight: '96px',
        padding: '18px',
        borderRadius: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        fontFamily: pageFont,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          className="opc-time-detail-card-value"
          style={{
            fontSize: '22px',
            lineHeight: 1.05,
            fontWeight: 840,
            letterSpacing: '-0.04em',
            color: BRAND.text,
            marginBottom: '8px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {value}
        </div>

        <div
          className="opc-time-detail-card-label"
          style={{
            fontSize: '12px',
            fontWeight: 720,
            color: BRAND.muted,
            lineHeight: 1.2,
          }}
        >
          {label}
        </div>
      </div>

      {icon && (
        <div
          className="opc-time-detail-card-icon"
          style={{
            width: '36px',
            height: '36px',
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


function ContactButtons({ person }: { person: TeamPresence | StaffRole }) {
  const phoneHref = getContactHref('phone', person);
  const emailHref = getContactHref('email', person);
  const whatsappHref = getContactHref('whatsapp', person);

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
      {phoneHref && (
        <a href={phoneHref} style={iconButtonStyle} title="Anrufen">
          <Phone size={15} />
        </a>
      )}

      {emailHref && (
        <a href={emailHref} style={iconButtonStyle} title="E-Mail">
          <Mail size={15} />
        </a>
      )}

      {whatsappHref && (
        <a href={whatsappHref} target="_blank" rel="noreferrer" style={iconButtonStyle} title="WhatsApp">
          <MessageCircle size={15} />
        </a>
      )}
    </div>
  );
}


function OPCTabs({
  tabs,
}: {
  tabs: Array<{
    key: string;
    label: string;
    active: boolean;
    onClick: () => void;
  }>;
}) {
  return (
    <div
      className="opc-time-tab-buttons"
      style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        marginBottom: '22px',
        overflowX: 'auto',
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={tab.onClick}
          style={{
            height: '48px',
            minWidth: '176px',
            padding: '0 18px',
            borderRadius: '14px',
            border: tab.active ? `1px solid ${BRAND.black}` : `1px solid ${BRAND.border}`,
            background: tab.active ? BRAND.black : '#FFFFFF',
            color: tab.active ? '#FFFFFF' : BRAND.text,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 760,
            fontFamily: pageFont,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: tab.active ? 'none' : '0 1px 2px rgba(15, 17, 21, 0.04)',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}


function OPCMetricsGrid({ children }: { children: ReactNode }) {
  return (
    <div
      className="opc-time-metrics"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '16px',
        marginBottom: '22px',
      }}
    >
      {children}
    </div>
  );
}

function OPCMetricCard({
  value,
  label,
  icon,
}: {
  value: ReactNode;
  label: string;
  icon?: ReactNode;
  tone?: 'success' | 'danger' | 'neutral';
}) {
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
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: '26px',
            lineHeight: 1,
            fontWeight: 820,
            letterSpacing: '-0.04em',
            color: BRAND.text,
            marginBottom: '12px',
            whiteSpace: 'nowrap',
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

      {icon && (
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
      )}
    </div>
  );
}

function OPCToolbar({ children, columns }: { children: ReactNode; columns: string }) {
  return (
    <section
      className="opc-time-filter-card"
      style={{
        ...cardStyle,
        padding: '18px',
        marginBottom: '22px',
      }}
    >
      <div
        className="opc-time-controls"
        style={{
          display: 'grid',
          gridTemplateColumns: columns,
          gap: '12px',
          alignItems: 'center',
        }}
      >
        {children}
      </div>
    </section>
  );
}

function OPCListCard({ children }: { children: ReactNode }) {
  return (
    <section
      style={{
        ...cardStyle,
        overflow: 'hidden',
        marginBottom: '22px',
      }}
    >
      {children}
    </section>
  );
}

const opcSelectStyle: CSSProperties = {
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

const opcBlackButtonStyle: CSSProperties = {
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
};

const opcSecondaryButtonStyle: CSSProperties = {
  height: '48px',
  padding: '0 16px',
  borderRadius: '14px',
  border: `1px solid ${BRAND.border}`,
  background: '#FFFFFF',
  color: BRAND.text,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '9px',
  fontSize: '14px',
  fontWeight: 760,
  fontFamily: pageFont,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const opcResponsiveStyle = `
  .opc-time-metrics > * {
    min-width: 0 !important;
  }

  .opc-time-tab-buttons::-webkit-scrollbar {
    display: none;
  }

  .opc-time-detail-cards > *,
  .opc-time-work-grid > *,
  .opc-team-presence-grid > * {
    min-width: 0 !important;
  }

  .opc-team-person-card {
    transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
  }

  .opc-team-person-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(15, 17, 21, 0.08) !important;
    border-color: ${BRAND.borderStrong} !important;
  }

  .opc-team-person-card:focus-visible {
    box-shadow: 0 0 0 3px rgba(15, 17, 21, 0.12) !important;
    border-color: ${BRAND.black} !important;
  }



  .opc-time-section-title {
    font-family: ${pageFont};
  }

  .opc-time-capture-card,
  .opc-time-entry-card,
  .opc-time-detail-card {
    font-family: ${pageFont};
  }

  .opc-time-capture-card textarea::placeholder,
  .opc-time-controls input::placeholder {
    color: ${BRAND.faint};
    font-weight: 560;
  }

  @media (max-width: 1180px) {
    .opc-time-metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }

    .opc-time-controls {
      grid-template-columns: minmax(0, 1fr) 160px 170px 170px !important;
    }
  }

  @media (max-width: 860px) {
    .opc-time-metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 10px !important;
    }

    .opc-time-metrics > div {
      min-height: 96px !important;
      padding: 14px !important;
    }

    .opc-time-metrics > div > div:first-child > div:first-child {
      font-size: 22px !important;
    }

    .opc-time-filter-card {
      padding: 12px !important;
      margin-bottom: 14px !important;
    }

    .opc-time-controls {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 8px !important;
    }

    .opc-time-controls > :first-child,
    .opc-time-refresh-button {
      grid-column: 1 / -1 !important;
    }

    .opc-time-controls input,
    .opc-time-controls select,
    .opc-time-controls button {
      height: 42px !important;
      border-radius: 12px !important;
      font-size: 13px !important;
    }

    .opc-time-tab-buttons {
      gap: 8px !important;
      margin-bottom: 16px !important;
    }

    .opc-time-tab-buttons button {
      height: 42px !important;
      padding: 0 10px !important;
      flex: 1 1 0 !important;
      min-width: 0 !important;
      font-size: 13px !important;
    }

    .opc-time-section-title {
      margin-bottom: 10px !important;
      font-size: 15px !important;
      font-weight: 820 !important;
      letter-spacing: -0.02em !important;
    }

    .opc-time-detail-cards {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 10px !important;
      margin-bottom: 14px !important;
    }

    .opc-time-detail-card {
      min-height: 82px !important;
      padding: 13px 14px !important;
      border-radius: 16px !important;
    }

    .opc-time-detail-card-value {
      font-size: 18px !important;
      margin-bottom: 6px !important;
      letter-spacing: -0.035em !important;
    }

    .opc-time-detail-card-label {
      font-size: 11px !important;
      font-weight: 720 !important;
    }

    .opc-time-detail-card-icon {
      width: 32px !important;
      height: 32px !important;
      border-radius: 12px !important;
    }

    .opc-time-work-grid {
      grid-template-columns: 1fr !important;
      gap: 0 !important;
    }

    .opc-time-capture-card {
      margin-bottom: 14px !important;
      border-radius: 18px !important;
    }

    .opc-time-card-header {
      padding: 15px 16px !important;
      font-size: 14px !important;
      font-weight: 820 !important;
    }

    .opc-time-capture-card > div:last-child {
      padding: 16px !important;
    }

    .opc-time-capture-card label {
      font-size: 12px !important;
      font-weight: 760 !important;
    }

    .opc-time-capture-card textarea {
      min-height: 78px !important;
      border-radius: 13px !important;
      padding: 11px 12px !important;
      font-size: 13px !important;
      line-height: 1.45 !important;
    }

    .opc-team-presence-grid {
      grid-template-columns: 1fr !important;
      gap: 12px !important;
      margin-bottom: 16px !important;
    }

    .opc-team-person-card {
      min-height: 172px !important;
      padding: 16px !important;
    }

    .opc-time-action-buttons {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 10px !important;
    }

    .opc-time-action-buttons button {
      width: 100% !important;
      min-width: 0 !important;
    }

    .opc-time-entries-section {
      margin-bottom: 16px !important;
    }

    .opc-time-entry-independent-list {
      gap: 10px !important;
    }

    .opc-time-entry-card {
      padding: 15px 16px !important;
      border-radius: 18px !important;
    }

    .opc-time-entry-card > div:first-child {
      margin-bottom: 12px !important;
      gap: 10px !important;
    }

    .opc-time-entry-title {
      font-size: 15px !important;
      margin-bottom: 4px !important;
      letter-spacing: -0.025em !important;
    }

    .opc-time-entry-subtitle {
      font-size: 12px !important;
      font-weight: 700 !important;
    }

    .opc-time-entry-card-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 10px 16px !important;
      margin-bottom: 10px !important;
    }

    .opc-time-entry-meta-label {
      font-size: 10px !important;
      margin-bottom: 3px !important;
      letter-spacing: 0.055em !important;
    }

    .opc-time-entry-meta-value {
      font-size: 12px !important;
      font-weight: 760 !important;
    }

    .opc-time-entry-note {
      font-size: 12px !important;
      font-weight: 640 !important;
    }

    .opc-time-entry-actions {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
  }
`;

export default function EmployeeTimeTrackingPage() {
  return (
    <MirakaDashboardShell
      title="Zeiterfassung"
      requiredRole={['owner', 'admin', 'dispatch', 'employee']}
      currentPath="/zeiterfassung"
      hideTopBar={true}
    >
      <EmployeeTimeTrackingContent />
    </MirakaDashboardShell>
  );
}

function EmployeeTimeTrackingContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('my_time');
  const [staffRole, setStaffRole] = useState<StaffRole | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [teamPresence, setTeamPresence] = useState<TeamPresence[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);

  const [month, setMonth] = useState(currentMonthValue());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [note, setNote] = useState('');
  const [clockOutNote, setClockOutNote] = useState('');
  const [reviewNote, setReviewNote] = useState('');

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [tick, setTick] = useState(0);

  const canManageTeam = isManagerRole(staffRole);

  useEffect(() => {
    void loadAll(true);
  }, [month]);

  useEffect(() => {
    const interval = window.setInterval(() => setTick((value) => value + 1), 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('opc_employee_time_entries_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'opc_employee_time_entries',
        },
        () => {
          void loadAll(false);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [month]);

  const ownEntries = useMemo(() => {
    if (!staffRole?.user_id) return entries;
    return entries.filter((entry) => entry.user_id === staffRole.user_id);
  }, [entries, staffRole]);

  const visibleEntries = canManageTeam ? entries : ownEntries;

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return visibleEntries.filter((entry) => {
      if (statusFilter !== 'all' && statusGroup(entry.status) !== statusFilter) return false;

      if (!query) return true;

      return [
        entry.employee_name,
        entry.work_date,
        statusLabel(entry.status),
        entry.employee_note,
        entry.dispatch_note,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [visibleEntries, searchQuery, statusFilter]);

  const submittedEntries = useMemo(() => {
    return entries.filter((entry) => normalizeStatus(entry.status) === 'submitted');
  }, [entries]);

  const stats = useMemo(() => {
    const today = todayString();

    const todayTotal = ownEntries
      .filter((entry) => entry.work_date === today)
      .reduce((sum, entry) => sum + (entry.id === activeEntry?.id ? liveMinutes(entry) : Number(entry.total_minutes || 0)), 0);

    const weekTotal = ownEntries
      .filter((entry) => isCurrentWeek(entry.work_date))
      .reduce((sum, entry) => sum + (entry.id === activeEntry?.id ? liveMinutes(entry) : Number(entry.total_minutes || 0)), 0);

    const monthTotal = ownEntries.reduce(
      (sum, entry) => sum + (entry.id === activeEntry?.id ? liveMinutes(entry) : Number(entry.total_minutes || 0)),
      0
    );

    const workedDays = new Set(
      ownEntries
        .filter((entry) => Number(entry.total_minutes || 0) > 0 || entry.clock_in_at)
        .map((entry) => entry.work_date)
    ).size;

    const targetMinutes = workedDays * 8 * 60;
    const saldo = monthTotal - targetMinutes;

    return {
      todayTotal,
      weekTotal,
      monthTotal,
      saldo,
    };
  }, [ownEntries, activeEntry, tick]);

  const teamStats = useMemo(() => {
    return {
      working: teamPresence.filter((person) => person.is_working && !person.is_on_break).length,
      onBreak: teamPresence.filter((person) => person.is_on_break).length,
      workedToday: teamPresence.filter((person) => person.clock_in_at).length,
      totalStaff: teamPresence.length,
    };
  }, [teamPresence]);

  async function loadAll(showLoader = true) {
    if (showLoader) setLoading(true);

    setErrorMessage('');

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) throw userError;

      const userId = userData.user?.id;

      if (!userId) throw new Error('Nicht eingeloggt.');

      const { data: staffData, error: staffError } = await supabase
        .from('opc_staff_roles')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (staffError) throw staffError;

      const resolvedStaff = (staffData || null) as StaffRole | null;
      setStaffRole(resolvedStaff);

      const { startDate, endDate } = monthRange(month);

      const { data: entriesData, error: entriesError } = await supabase
        .from('opc_employee_time_entries')
        .select('*')
        .gte('work_date', startDate)
        .lte('work_date', endDate)
        .order('work_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (entriesError) throw entriesError;

      const safeEntries = (entriesData || []) as TimeEntry[];
      setEntries(safeEntries);

      const active = safeEntries.find(
        (entry) =>
          entry.user_id === userId &&
          entry.work_date === todayString() &&
          !entry.clock_out_at &&
          ['open', 'on_break'].includes(normalizeStatus(entry.status))
      );

      setActiveEntry(active || null);

      const { data: presenceData, error: presenceError } = await supabase.rpc('opc_get_team_time_presence', {
        p_work_date: todayString(),
      });

      if (presenceError) {
        console.warn('Team presence could not be loaded:', presenceError);
        setTeamPresence([]);
      } else {
        setTeamPresence((presenceData || []) as TeamPresence[]);
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Zeiterfassung konnte nicht geladen werden.');
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  async function runAction(action: string, callback: () => Promise<void>) {
    setActionLoading(action);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await callback();
      await loadAll(false);
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
      setSuccessMessage('Eingestempelt.');
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
      setSuccessMessage('Ausgestempelt und zur Prüfung eingereicht.');
    });
  }

  async function approveEntry(entryId: string) {
    await runAction(`approve-${entryId}`, async () => {
      const { error } = await supabase.rpc('opc_approve_employee_time_entry', {
        p_time_entry_id: entryId,
        p_dispatch_note: reviewNote.trim() || null,
      });

      if (error) throw error;

      setReviewNote('');
      setSuccessMessage('Zeiteintrag genehmigt.');
    });
  }

  async function rejectEntry(entryId: string) {
    await runAction(`reject-${entryId}`, async () => {
      const { error } = await supabase.rpc('opc_reject_employee_time_entry', {
        p_time_entry_id: entryId,
        p_dispatch_note: reviewNote.trim() || null,
      });

      if (error) throw error;

      setReviewNote('');
      setSuccessMessage('Zeiteintrag abgelehnt.');
    });
  }

  const isActive = Boolean(activeEntry && !activeEntry.clock_out_at);
  const isOnBreak = normalizeStatus(activeEntry?.status) === 'on_break';

  if (loading) {
    return (
      <div style={loadingStyle}>
        <Loader2 size={20} className="spin" style={{ marginRight: 8 }} />
        Zeiterfassung wird geladen...
        <style>{spinStyle}</style>
      </div>
    );
  }

  return (
    <div className="opc-time-page" style={{ padding: 0, fontFamily: pageFont, color: BRAND.text }}>
      <OPCTabs
        tabs={[
          {
            key: 'my_time',
            label: 'Meine Zeiterfassung',
            active: activeTab === 'my_time',
            onClick: () => setActiveTab('my_time'),
          },
          {
            key: 'team_live',
            label: 'Team Live',
            active: activeTab === 'team_live',
            onClick: () => setActiveTab('team_live'),
          },
        ]}
      />

      {activeTab === 'my_time' && (
        <OPCMetricsGrid>
          <OPCMetricCard value={formatMinutes(stats.todayTotal)} label="Heute" icon={<Clock3 size={18} />} />
          <OPCMetricCard value={formatMinutes(stats.weekTotal)} label="Diese Woche" icon={<CalendarDays size={18} />} />
          <OPCMetricCard value={formatMinutes(stats.monthTotal)} label="Dieser Monat" icon={<Clock3 size={18} />} />
          <OPCMetricCard
            value={`${stats.saldo < 0 ? '-' : '+'}${formatMinutes(Math.abs(stats.saldo))}`}
            label="Saldo"
            icon={<CheckCircle2 size={18} />}
            tone={stats.saldo < 0 ? 'danger' : 'success'}
          />
        </OPCMetricsGrid>
      )}

      {activeTab === 'team_live' && (
        <OPCMetricsGrid>
          <OPCMetricCard value={teamStats.working} label="Arbeiten aktuell" icon={<Users size={18} />} />
          <OPCMetricCard value={teamStats.onBreak} label="In Pause" icon={<Coffee size={18} />} />
          <OPCMetricCard value={teamStats.workedToday} label="Heute aktiv" icon={<Clock3 size={18} />} />
          <OPCMetricCard value={teamStats.totalStaff} label="Mitarbeiter" icon={<UserRound size={18} />} />
        </OPCMetricsGrid>
      )}

      {activeTab === 'approvals' && canManageTeam && (
        <OPCMetricsGrid>
          <OPCMetricCard value={submittedEntries.length} label="Offen zur Freigabe" icon={<Clock3 size={18} />} />
          <OPCMetricCard value={entries.filter((entry) => normalizeStatus(entry.status) === 'approved').length} label="Genehmigt" icon={<CheckCircle2 size={18} />} tone="success" />
          <OPCMetricCard value={entries.filter((entry) => normalizeStatus(entry.status) === 'rejected').length} label="Abgelehnt" icon={<LogOut size={18} />} tone="danger" />
          <OPCMetricCard value={entries.length} label="Einträge gesamt" icon={<CalendarDays size={18} />} />
        </OPCMetricsGrid>
      )}

      {(activeTab === 'my_time' || activeTab === 'approvals') && (
        <OPCToolbar columns="minmax(0, 1fr) 170px 180px 190px">
          <div style={{ position: 'relative', minWidth: 0 }}>
            <Search size={17} style={searchIconStyle} />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Suche nach Datum, Status, Notiz oder Mitarbeiter"
              style={inputWithIconStyle}
            />
          </div>

          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            style={monthInputStyle}
          />

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

          <button
            type="button"
            onClick={() => void loadAll(false)}
            disabled={Boolean(actionLoading)}
            className="opc-time-refresh-button"
            style={opcBlackButtonStyle}
          >
            <RefreshCw size={17} />
            <span>Aktualisieren</span>
          </button>
        </OPCToolbar>
      )}

      {activeTab === 'team_live' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => void loadAll(false)}
            disabled={Boolean(actionLoading)}
            className="opc-time-team-refresh-button"
            style={{ ...opcSecondaryButtonStyle, width: 'auto', minWidth: 150 }}
          >
            <RefreshCw size={17} />
            <span>Aktualisieren</span>
          </button>
        </div>
      )}

      {errorMessage && <div style={errorStyle}>{errorMessage}</div>}
      {successMessage && <div style={successStyle}>{successMessage}</div>}

      {activeTab === 'my_time' && (
        <>
          <div className="opc-time-section-title" style={contentSectionTitleStyle}>Heute</div>

          <div className="opc-time-detail-cards" style={todayDetailsGridStyle}>
            <DetailStatCard
              label="Status"
              value={isActive ? statusLabel(activeEntry?.status) : 'Nicht aktiv'}
              icon={<Clock3 size={18} />}
            />
            <DetailStatCard label="Start" value={formatTime(activeEntry?.clock_in_at)} icon={<LogIn size={18} />} />
            <DetailStatCard label="Pause" value={formatMinutes(activeEntry?.break_minutes || 0)} icon={<Coffee size={18} />} />
            <DetailStatCard
              label="Live"
              value={isActive ? formatMinutes(liveMinutes(activeEntry)) : formatMinutes(stats.todayTotal)}
              icon={<Clock3 size={18} />}
            />
          </div>

          <div className="opc-time-work-grid" style={workGridStyle}>
            <section className="opc-time-capture-card" style={actionCardStyle}>
              <div className="opc-time-card-header" style={sectionHeaderStyle}>Zeit erfassen</div>

              <div style={cardBodyStyle}>
                {!isActive && (
                  <label style={labelStyle}>
                    Startnotiz
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Optional. Beispiel: Dienstwagen übernommen, Fahrt begonnen."
                      style={textareaStyle}
                    />
                  </label>
                )}

                {isActive && (
                  <label style={labelStyle}>
                    Notiz zum Ausstempeln
                    <textarea
                      value={clockOutNote}
                      onChange={(event) => setClockOutNote(event.target.value)}
                      placeholder="Optional. Beispiel: Tag abgeschlossen, Material aufgefüllt."
                      style={textareaStyle}
                    />
                  </label>
                )}

                <div className="opc-time-action-buttons" style={actionRowStyle}>
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => void clockIn()}
                      disabled={actionLoading === 'clock_in'}
                      style={{ ...opcBlackButtonStyle, width: 'auto', minWidth: '176px' }}
                    >
                      {actionLoading === 'clock_in' ? <Loader2 size={17} className="spin" /> : <LogIn size={17} />}
                      Einstempeln
                    </button>
                  )}

                  {isActive && !isOnBreak && (
                    <button
                      type="button"
                      onClick={() => void startBreak()}
                      disabled={actionLoading === 'break_start'}
                      style={{ ...opcSecondaryButtonStyle, width: 'auto', minWidth: '176px' }}
                    >
                      {actionLoading === 'break_start' ? <Loader2 size={17} className="spin" /> : <Coffee size={17} />}
                      Pause starten
                    </button>
                  )}

                  {isActive && isOnBreak && (
                    <button
                      type="button"
                      onClick={() => void endBreak()}
                      disabled={actionLoading === 'break_end'}
                      style={{ ...opcSecondaryButtonStyle, width: 'auto', minWidth: '176px' }}
                    >
                      {actionLoading === 'break_end' ? <Loader2 size={17} className="spin" /> : <Coffee size={17} />}
                      Pause beenden
                    </button>
                  )}

                  {isActive && (
                    <button
                      type="button"
                      onClick={() => void clockOut()}
                      disabled={actionLoading === 'clock_out'}
                      style={{ ...dangerButtonStyle, minWidth: '176px' }}
                    >
                      {actionLoading === 'clock_out' ? <Loader2 size={17} className="spin" /> : <LogOut size={17} />}
                      Ausstempeln
                    </button>
                  )}
                </div>
              </div>
            </section>
          </div>

          <TimeEntriesList entries={ownEntries} activeEntry={activeEntry} title="Meine Einträge" />
        </>
      )}

      {activeTab === 'team_live' && (
        <TeamPresenceCards people={teamPresence} />
      )}

      {activeTab === 'approvals' && canManageTeam && (
        <>
          <section style={actionCardStyle}>
            <div style={sectionHeaderStyle}>Freigabe-Notiz</div>
            <div style={{ padding: 20 }}>
              <label style={labelStyle}>
                Dispatch/Admin Notiz
                <input
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                  placeholder="Optional. Beispiel: geprüft, Zeiten plausibel."
                  style={inputStyle}
                />
              </label>
            </div>
          </section>

          <TimeEntriesList
            entries={filteredEntries}
            activeEntry={activeEntry}
            title="Alle Zeiteinträge"
            showActions
            onApprove={approveEntry}
            onReject={rejectEntry}
            actionLoading={actionLoading}
          />
        </>
      )}

      <style>{`${opcResponsiveStyle}${spinStyle}`}</style>
    </div>
  );
}

function TeamPresenceCards({ people }: { people: TeamPresence[] }) {
  if (people.length === 0) {
    return (
      <section
        style={{
          ...cardStyle,
          ...emptyStyle,
          marginBottom: 22,
        }}
      >
        <Users size={24} />
        <strong>Kein Teamstatus vorhanden.</strong>
        <span>Falls leer, prüfe die RPC-Funktion opc_get_team_time_presence.</span>
      </section>
    );
  }

  return (
    <section className="opc-team-presence-grid" style={teamPresenceGridStyle}>
      {people.map((person) => {
        const openDetail = () => {
          window.location.href = `/zeiterfassung/${person.staff_role_id}`;
        };

        return (
          <article
            key={person.staff_role_id}
            role="button"
            tabIndex={0}
            className="opc-team-person-card"
            onClick={openDetail}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openDetail();
              }
            }}
            style={teamPresenceCardStyle}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={teamPersonNameStyle}>{person.display_name || 'Mitarbeiter'}</div>
                <div style={teamPersonRoleStyle}>{person.role || 'employee'}</div>
              </div>

              <StatusBadge status={person.time_status} />
            </div>

            <div style={teamPersonInfoGridStyle}>
              <div>
                <div style={teamPersonMetaLabelStyle}>Start</div>
                <div style={teamPersonMetaValueStyle}>{formatTime(person.clock_in_at)}</div>
              </div>

              <div>
                <div style={teamPersonMetaLabelStyle}>Letzte Aktivität</div>
                <div style={teamPersonMetaValueStyle}>{formatDateTime(person.last_activity_at)}</div>
              </div>
            </div>

            <div
              style={teamPersonFooterStyle}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <span style={teamPersonDetailHintStyle}>Details öffnen</span>
              <ContactButtons person={person} />
            </div>
          </article>
        );
      })}
    </section>
  );
}

function TimeEntriesList({
  entries,
  activeEntry,
  title,
  showActions = false,
  onApprove,
  onReject,
  actionLoading,
}: {
  entries: TimeEntry[];
  activeEntry: TimeEntry | null;
  title: string;
  showActions?: boolean;
  onApprove?: (entryId: string) => void;
  onReject?: (entryId: string) => void;
  actionLoading?: string | null;
}) {
  return (
    <section className="opc-time-entries-section" style={{ marginBottom: 22 }}>
      <div className="opc-time-section-title" style={{ ...contentSectionTitleStyle, marginBottom: 14 }}>{title}</div>

      {entries.length === 0 ? (
        <div
          style={{
            ...cardStyle,
            ...emptyStyle,
          }}
        >
          <Clock3 size={24} />
          <strong>Keine Einträge vorhanden.</strong>
          <span>Sobald Zeiten erfasst werden, erscheinen sie hier.</span>
        </div>
      ) : (
        <div className="opc-time-entry-independent-list" style={entryIndependentListStyle}>
          {entries.map((entry) => {
            const total = entry.id === activeEntry?.id ? liveMinutes(entry) : Number(entry.total_minutes || 0);
            const isSubmitted = normalizeStatus(entry.status) === 'submitted';

            return (
              <article key={entry.id} className="opc-time-entry-card" style={entryIndependentCardStyle}>
                <div style={entryCardHeaderStyle}>
                  <div style={{ minWidth: 0 }}>
                    <h3 className="opc-time-entry-title" style={entryCardTitleStyle}>{formatDate(entry.work_date)}</h3>
                    <p className="opc-time-entry-subtitle" style={entryCardSubtitleStyle}>{entry.employee_name || 'Mitarbeiter'}</p>
                  </div>

                  <StatusBadge status={entry.status} />
                </div>

                <div className="opc-time-entry-card-grid" style={entryCardGridStyle}>
                  <div>
                    <div className="opc-time-entry-meta-label" style={entryMetaLabelStyle}>Start</div>
                    <div className="opc-time-entry-meta-value" style={entryMetaValueStyle}>{formatTime(entry.clock_in_at)}</div>
                  </div>

                  <div>
                    <div className="opc-time-entry-meta-label" style={entryMetaLabelStyle}>Ende</div>
                    <div className="opc-time-entry-meta-value" style={entryMetaValueStyle}>{formatTime(entry.clock_out_at)}</div>
                  </div>

                  <div>
                    <div className="opc-time-entry-meta-label" style={entryMetaLabelStyle}>Total</div>
                    <div className="opc-time-entry-meta-value" style={entryMetaValueStyle}>{formatMinutes(total)}</div>
                  </div>

                  <div>
                    <div className="opc-time-entry-meta-label" style={entryMetaLabelStyle}>Pause</div>
                    <div className="opc-time-entry-meta-value" style={entryMetaValueStyle}>{formatMinutes(entry.break_minutes || 0)}</div>
                  </div>
                </div>

                <div className="opc-time-entry-note" style={entryNoteStyle}>{entry.employee_note || 'Keine Notiz'}</div>

                {showActions && isSubmitted && (
                  <div className="opc-time-entry-actions" style={entryActionGridStyle}>
                    <button
                      type="button"
                      onClick={() => onApprove?.(entry.id)}
                      disabled={actionLoading === `approve-${entry.id}`}
                      style={{ ...smallApproveButtonStyle, width: '100%' }}
                    >
                      Genehmigen
                    </button>

                    <button
                      type="button"
                      onClick={() => onReject?.(entry.id)}
                      disabled={actionLoading === `reject-${entry.id}`}
                      style={{ ...smallRejectButtonStyle, width: '100%' }}
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
  );
}


const entryIndependentListStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: '12px',
};

const entryIndependentCardStyle: CSSProperties = {
  ...cardStyle,
  padding: '18px',
  borderRadius: '18px',
  minWidth: 0,
  fontFamily: OPC_PAGE_FONT,
};

const entryCardHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  marginBottom: '12px',
};

const entryCardTitleStyle: CSSProperties = {
  margin: '0 0 6px',
  fontSize: '17px',
  lineHeight: 1.2,
  fontWeight: 840,
  letterSpacing: '-0.03em',
  color: BRAND.text,
};

const entryCardSubtitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '13px',
  fontWeight: 700,
  color: BRAND.muted,
};

const entryCardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: '12px',
  marginBottom: '12px',
};

const entryMetaLabelStyle: CSSProperties = {
  marginBottom: '4px',
  fontSize: '11px',
  fontWeight: 760,
  color: BRAND.faint,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const entryMetaValueStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 760,
  color: BRAND.text,
  whiteSpace: 'nowrap',
};

const entryNoteStyle: CSSProperties = {
  color: BRAND.muted,
  fontSize: '12px',
  fontWeight: 640,
  lineHeight: 1.45,
};

const entryActionGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
  marginTop: 14,
};

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

const searchIconStyle: CSSProperties = {
  position: 'absolute',
  left: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  color: OPC_BRAND.faint,
  pointerEvents: 'none',
};

const inputWithIconStyle: CSSProperties = {
  width: '100%',
  height: '48px',
  padding: '0 14px 0 42px',
  borderRadius: '14px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  outline: 'none',
  fontSize: '14px',
  fontWeight: 560,
  fontFamily: OPC_PAGE_FONT,
  boxSizing: 'border-box',
};

const monthInputStyle: CSSProperties = {
  ...inputWithIconStyle,
  padding: '0 13px',
};

const inputStyle: CSSProperties = {
  width: '100%',
  height: '48px',
  padding: '0 13px',
  borderRadius: 14,
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  outline: 'none',
  fontSize: 13,
  fontWeight: 560,
  fontFamily: OPC_PAGE_FONT,
  boxSizing: 'border-box',
};

const actionCardStyle: CSSProperties = {
  ...cardStyle,
  marginBottom: 18,
  overflow: 'hidden',
  borderRadius: 18,
};

const contentSectionTitleStyle: CSSProperties = {
  margin: '0 0 12px',
  fontSize: '15px',
  fontWeight: 820,
  color: OPC_BRAND.text,
  letterSpacing: '-0.02em',
};

const cardBodyStyle: CSSProperties = {
  padding: 18,
};

const todayDetailsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: '16px',
  marginBottom: '18px',
};

const workGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.72fr)',
  gap: '20px',
  alignItems: 'start',
};

const sectionHeaderStyle: CSSProperties = {
  padding: '16px 18px',
  borderBottom: '1px solid #F3F4F6',
  fontSize: '14px',
  fontWeight: 820,
  color: OPC_BRAND.text,
};

const sectionHeaderSmallStyle: CSSProperties = {
  ...sectionHeaderStyle,
  padding: '16px 18px',
};

const dailyGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, 0.75fr)',
  gap: 20,
  padding: 20,
};

const infoGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 18,
  marginBottom: 18,
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

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  fontSize: 12,
  fontWeight: 760,
  color: OPC_BRAND.text,
};

const textareaStyle: CSSProperties = {
  width: '100%',
  minHeight: 84,
  resize: 'vertical',
  padding: '12px 13px',
  borderRadius: 14,
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  outline: 'none',
  fontSize: 13,
  fontWeight: 560,
  fontFamily: OPC_PAGE_FONT,
  lineHeight: 1.5,
  boxSizing: 'border-box',
};

const actionRowStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  marginTop: 16,
};

const stepsPanelStyle: CSSProperties = {
  border: `1px solid ${BRAND.border}`,
  borderRadius: 18,
  overflow: 'hidden',
  background: '#FFFFFF',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

const desktopRowStyle: CSSProperties = {
  width: '100%',
  display: 'grid',
  gridTemplateColumns: 'minmax(180px, 0.95fr) minmax(230px, 1.4fr) 120px 120px 120px minmax(180px, 1fr)',
  alignItems: 'center',
  gap: '20px',
  padding: '20px 22px',
  border: 'none',
  background: '#FFFFFF',
  textAlign: 'left',
  fontFamily: OPC_PAGE_FONT,
};

const teamRowStyle: CSSProperties = {
  width: '100%',
  display: 'grid',
  gridTemplateColumns: 'minmax(240px, 1.4fr) 140px 120px 170px minmax(150px, 0.8fr)',
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

const linkCellStyle: CSSProperties = {
  border: 0,
  background: 'transparent',
  padding: 0,
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: OPC_PAGE_FONT,
  minWidth: 0,
};

const dangerButtonStyle: CSSProperties = {
  height: '48px',
  padding: '0 16px',
  borderRadius: '14px',
  border: '1px solid #FCA5A5',
  background: '#FEF2F2',
  color: OPC_BRAND.red,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 9,
  fontSize: '14px',
  fontWeight: 760,
  fontFamily: OPC_PAGE_FONT,
  cursor: 'pointer',
};

const iconButtonStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 12,
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
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

const emptyStyle: CSSProperties = {
  minHeight: '160px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  gap: '10px',
  padding: '24px',
  color: OPC_BRAND.muted,
  textAlign: 'center',
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

const teamPresenceGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 16,
  marginBottom: 22,
};

const teamPresenceCardStyle: CSSProperties = {
  ...cardStyle,
  padding: '20px',
  minHeight: 190,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: 16,
  cursor: 'pointer',
  outline: 'none',
  fontFamily: OPC_PAGE_FONT,
};

const teamPersonNameStyle: CSSProperties = {
  fontSize: '17px',
  lineHeight: 1.2,
  fontWeight: 840,
  letterSpacing: '-0.025em',
  color: OPC_BRAND.text,
  marginBottom: 7,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const teamPersonRoleStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: OPC_BRAND.muted,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const teamPersonInfoGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
};

const teamPersonMetaLabelStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 780,
  color: OPC_BRAND.faint,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 5,
};

const teamPersonMetaValueStyle: CSSProperties = {
  fontSize: '13px',
  lineHeight: 1.35,
  fontWeight: 720,
  color: OPC_BRAND.text,
};

const teamPersonFooterStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  paddingTop: 14,
  borderTop: '1px solid #F3F4F6',
};

const teamPersonDetailHintStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 760,
  color: OPC_BRAND.muted,
  whiteSpace: 'nowrap',
};

const errorStyle: CSSProperties = {
  marginBottom: '22px',
  padding: '14px 16px',
  borderRadius: '14px',
  border: '1px solid #FCA5A5',
  background: '#FEF2F2',
  color: OPC_BRAND.red,
  fontSize: '14px',
  fontWeight: 620,
};

const successStyle: CSSProperties = {
  marginBottom: '22px',
  padding: '14px 16px',
  borderRadius: '14px',
  border: '1px solid #BBF7D0',
  background: '#F0FDF4',
  color: OPC_BRAND.green,
  fontSize: '14px',
  fontWeight: 620,
};

const spinStyle = `
  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (max-width: 980px) {
    .opc-time-detail-cards {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 10px !important;
    }

    .opc-time-work-grid {
      grid-template-columns: 1fr !important;
      gap: 0 !important;
    }
  }
`;
