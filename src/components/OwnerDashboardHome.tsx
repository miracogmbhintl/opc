import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileText,
  FolderOpen,
  MessageSquare,
  Plus,
  Upload,
  Users,
} from 'lucide-react';

interface DashboardStats {
  todayJobs: number;
  jobsThisWeek: number;
  overdueJobs: number;
  openReports: number;
  unreadMessages: number;
  urgentItems: number;
}

interface ServiceJob {
  job_id: string;
  title: string;
  status: string;
  priority?: string | null;
  planned_start?: string | null;
  planned_end?: string | null;
  service_category?: string | null;
  billing_name?: string | null;
  site_name?: string | null;
  report_status?: string | null;
}

interface InboxMessage {
  conversation_id?: string;
  thread_id?: string;
  participant_name?: string | null;
  sender_display?: string | null;
  last_message?: string | null;
  unread?: boolean | null;
  last_message_at?: string | null;
  created_at?: string | null;
}

interface ReportItem {
  report_id?: string;
  job_id?: string;
  status?: string | null;
  report_status?: string | null;
  report_title?: string | null;
  title?: string | null;
  billing_name?: string | null;
  site_name?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

type DashboardTab = 'today' | 'week' | 'overdue' | 'reports';

const BRAND = {
  bg: '#FFFFFF',
  card: '#FFFFFF',
  cardSoft: '#FAFAFA',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  black: '#0F1115',
  red: '#B91C1C',
  amber: '#92400E',
  green: '#166534',
};

const CLOSED_JOB_STATUSES = new Set([
  'completed',
  'cancelled',
  'report_approved',
  'approved',
  'sent_to_client',
]);

const OPEN_REPORT_STATUSES = new Set([
  'draft',
  'submitted',
  'report_pending',
  'pending',
  'open',
  'in_review',
]);

const STALE_JOB_DAYS = 120;

const statusLabels: Record<string, string> = {
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
  sent_to_client: 'An Kunde gesendet',
  approved: 'Freigegeben',
};

const cardStyle: CSSProperties = {
  background: BRAND.card,
  border: `1px solid ${BRAND.border}`,
  borderRadius: '20px',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '17px',
  lineHeight: 1.25,
  fontWeight: 760,
  letterSpacing: '-0.025em',
  color: BRAND.text,
};

function normalizeStatus(status?: string | null) {
  return String(status || '').trim().toLowerCase();
}

function formatStatus(status?: string | null): string {
  const normalized = normalizeStatus(status);

  if (!normalized) return 'Unbekannt';

  return statusLabels[normalized] || normalized.replace(/_/g, ' ');
}

function formatDate(dateString?: string | null) {
  if (!dateString) return '-';

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: 'short',
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

function getTimeDistance(dateString?: string | null) {
  if (!dateString) return { label: 'Kein Datum', tone: 'neutral' as const };

  const target = new Date(dateString);

  if (Number.isNaN(target.getTime())) {
    return { label: 'Kein Datum', tone: 'neutral' as const };
  }

  const todayStart = startOfDay(new Date());
  const targetStart = startOfDay(target);
  const diffMs = targetStart.getTime() - todayStart.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: `${Math.abs(diffDays)} Tage überfällig`, tone: 'danger' as const };
  }

  if (diffDays === 0) return { label: 'Heute', tone: 'dark' as const };
  if (diffDays === 1) return { label: 'Morgen', tone: 'neutral' as const };

  return { label: `in ${diffDays} Tagen`, tone: 'neutral' as const };
}

function getJobName(job: ServiceJob) {
  return job.title || job.service_category || 'Einsatz';
}

function getJobClient(job: ServiceJob) {
  return job.billing_name || job.site_name || 'Ohne Kunde';
}

function isClosedJob(job: ServiceJob) {
  return CLOSED_JOB_STATUSES.has(normalizeStatus(job.status));
}

function isOpenReportStatus(status?: string | null) {
  const normalized = normalizeStatus(status);

  if (!normalized) return false;

  return OPEN_REPORT_STATUSES.has(normalized);
}

function isOpenReport(report: ReportItem) {
  const status = normalizeStatus(report.report_status || report.status);

  if (!status) return false;

  return !['approved', 'sent_to_client', 'report_approved', 'completed', 'cancelled'].includes(status);
}

function isStaleHistoricJob(job: ServiceJob, now = new Date()) {
  if (!job.planned_start) return false;

  const planned = new Date(job.planned_start);

  if (Number.isNaN(planned.getTime())) return false;

  const ageDays = Math.floor((now.getTime() - planned.getTime()) / (1000 * 60 * 60 * 24));

  if (ageDays <= STALE_JOB_DAYS) return false;

  const status = normalizeStatus(job.status);

  return !['on_site', 'onsite', 'in_progress', 'report_pending'].includes(status);
}

async function readList<T>(table: string, select = '*', limit = 50): Promise<T[]> {
  const { data, error } = await supabase.from(table).select(select).limit(limit);

  if (error) {
    console.warn(`[OPC Dashboard] ${table} konnte nicht geladen werden:`, error.message);
    return [];
  }

  return (data || []) as T[];
}

function StatusBadge({ status }: { status?: string | null }) {
  const normalized = normalizeStatus(status);

  const isDanger = normalized === 'cancelled';
  const isDone = ['completed', 'approved', 'report_approved', 'sent_to_client'].includes(normalized);
  const isActive = ['on_site', 'onsite', 'in_progress'].includes(normalized);

  const style =
    isDanger
      ? { bg: '#FEF2F2', text: BRAND.red, border: '#FECACA' }
      : isDone
        ? { bg: '#F0FDF4', text: BRAND.green, border: '#BBF7D0' }
        : isActive
          ? { bg: '#F9FAFB', text: BRAND.black, border: BRAND.borderStrong }
          : { bg: '#F9FAFB', text: BRAND.muted, border: BRAND.border };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: '25px',
        padding: '0 10px',
        borderRadius: '999px',
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.text,
        fontSize: '11px',
        fontWeight: 740,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {formatStatus(status)}
    </span>
  );
}

function TimeBadge({ value }: { value?: string | null }) {
  const distance = getTimeDistance(value);

  const styles =
    distance.tone === 'danger'
      ? { bg: '#FEF2F2', color: BRAND.red, border: '#FECACA' }
      : distance.tone === 'dark'
        ? { bg: '#F9FAFB', color: BRAND.black, border: BRAND.borderStrong }
        : { bg: '#FFFFFF', color: BRAND.muted, border: BRAND.border };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: '24px',
        padding: '0 9px',
        borderRadius: '999px',
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        color: styles.color,
        fontSize: '11px',
        fontWeight: 720,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      {distance.label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  subline,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  subline: string;
  icon: ReactNode;
  tone?: 'neutral' | 'danger' | 'dark';
}) {
  const valueColor = tone === 'danger' ? BRAND.red : BRAND.text;

  return (
    <div
      style={{
        ...cardStyle,
        padding: '18px',
        minHeight: '112px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '14px',
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            color: BRAND.muted,
            fontSize: '11px',
            fontWeight: 760,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            lineHeight: 1.35,
          }}
        >
          {label}
        </div>

        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '12px',
            background: '#F9FAFB',
            border: `1px solid ${BRAND.border}`,
            color: BRAND.black,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>

      <div>
        <div
          style={{
            fontSize: '28px',
            lineHeight: 1,
            fontWeight: 820,
            letterSpacing: '-0.045em',
            color: valueColor,
            marginBottom: '6px',
          }}
        >
          {value}
        </div>

        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: BRAND.faint,
          }}
        >
          {subline}
        </div>
      </div>
    </div>
  );
}

function ActionLink({
  href,
  icon,
  label,
  dark = false,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  dark?: boolean;
}) {
  return (
    <a
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        minHeight: '46px',
        padding: '12px 14px',
        borderRadius: '15px',
        background: dark ? BRAND.black : '#FFFFFF',
        border: dark ? `1px solid ${BRAND.black}` : `1px solid ${BRAND.border}`,
        color: dark ? '#FFFFFF' : BRAND.text,
        fontSize: '13px',
        fontWeight: 720,
        textDecoration: 'none',
      }}
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}

function JobRow({ job }: { job: ServiceJob }) {
  return (
    <button
      type="button"
      onClick={() => {
        window.location.href = `${baseUrl}/einsatz/${job.job_id}`;
      }}
      style={{
        width: '100%',
        border: `1px solid ${BRAND.border}`,
        borderRadius: '15px',
        background: '#FFFFFF',
        padding: '15px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.borderColor = BRAND.borderStrong;
        event.currentTarget.style.background = '#FAFAFA';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.borderColor = BRAND.border;
        event.currentTarget.style.background = '#FFFFFF';
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 760,
            color: BRAND.text,
            letterSpacing: '-0.01em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: '5px',
          }}
        >
          {getJobName(job)}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            color: BRAND.muted,
            fontSize: '12px',
            fontWeight: 620,
          }}
        >
          <span>{getJobClient(job)}</span>
          <span>·</span>
          <span>{formatDate(job.planned_start)}</span>
          <TimeBadge value={job.planned_start} />
        </div>
      </div>

      <StatusBadge status={job.status} />
    </button>
  );
}

function DashboardTabs({
  activeTab,
  onChange,
  counts,
}: {
  activeTab: DashboardTab;
  onChange: (tab: DashboardTab) => void;
  counts: Record<DashboardTab, number>;
}) {
  const tabs: Array<{ key: DashboardTab; label: string }> = [
    { key: 'today', label: 'Heute' },
    { key: 'week', label: 'Diese Woche' },
    { key: 'overdue', label: 'Überfällig' },
    { key: 'reports', label: 'Berichte offen' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
      }}
    >
      {tabs.map((tab) => {
        const active = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            style={{
              height: '34px',
              padding: '0 12px',
              borderRadius: '999px',
              border: `1px solid ${active ? BRAND.black : BRAND.border}`,
              background: active ? BRAND.black : '#FFFFFF',
              color: active ? '#FFFFFF' : BRAND.muted,
              fontSize: '12px',
              fontWeight: 720,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {tab.label} · {counts[tab.key] || 0}
          </button>
        );
      })}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
  href,
}: {
  label: string;
  value: number;
  tone: 'danger' | 'warning' | 'dark' | 'neutral';
  href: string;
}) {
  const color =
    tone === 'danger'
      ? BRAND.red
      : tone === 'warning'
        ? BRAND.amber
        : tone === 'dark'
          ? BRAND.black
          : BRAND.green;

  return (
    <a
      href={href}
      style={{
        border: `1px solid ${BRAND.border}`,
        borderRadius: '15px',
        background: '#FFFFFF',
        padding: '13px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        textDecoration: 'none',
      }}
    >
      <span
        style={{
          color: BRAND.muted,
          fontSize: '12px',
          fontWeight: 720,
        }}
      >
        {label}
      </span>

      <span
        style={{
          color,
          fontSize: '18px',
          fontWeight: 820,
          letterSpacing: '-0.04em',
        }}
      >
        {value}
      </span>
    </a>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        minHeight: '92px',
        border: `1px dashed ${BRAND.borderStrong}`,
        borderRadius: '15px',
        background: '#FAFAFA',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: BRAND.muted,
        fontSize: '13px',
        fontWeight: 620,
        textAlign: 'center',
        padding: '18px',
      }}
    >
      <FolderOpen size={17} style={{ marginRight: '8px' }} />
      {text}
    </div>
  );
}

export default function OwnerDashboardHome() {
  const [stats, setStats] = useState<DashboardStats>({
    todayJobs: 0,
    jobsThisWeek: 0,
    overdueJobs: 0,
    openReports: 0,
    unreadMessages: 0,
    urgentItems: 0,
  });

  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [activeTab, setActiveTab] = useState<DashboardTab>('today');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    try {
      const [jobsData, inboxData, reportsData] = await Promise.all([
        readList<ServiceJob>('opc_my_portal_job_feed', '*', 150),
        readList<InboxMessage>('opc_my_conversation_inbox', '*', 30),
        readList<ReportItem>('opc_portal_report_feed', '*', 100),
      ]);

      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      const weekEnd = endOfDay(addDays(now, 7));

      const visibleJobs = jobsData.filter((job) => !isStaleHistoricJob(job, now));
      const operationalJobs = visibleJobs.filter((job) => !isClosedJob(job));

      const todayJobs = operationalJobs.filter((job) => {
        if (!job.planned_start) return false;
        const planned = new Date(job.planned_start);
        return planned >= todayStart && planned <= todayEnd;
      });

      const weekJobs = operationalJobs.filter((job) => {
        if (!job.planned_start) return false;
        const planned = new Date(job.planned_start);
        return planned >= todayStart && planned <= weekEnd;
      });

      const overdueJobs = operationalJobs.filter((job) => {
        if (!job.planned_start) return false;
        return new Date(job.planned_start) < todayStart;
      });

      const openReports = reportsData.filter(isOpenReport);

      const unreadMessages = inboxData.filter((message) => Boolean(message.unread)).length;

      setStats({
        todayJobs: todayJobs.length,
        jobsThisWeek: weekJobs.length,
        overdueJobs: overdueJobs.length,
        openReports: openReports.length,
        unreadMessages,
        urgentItems: overdueJobs.length + openReports.length + unreadMessages,
      });

      const sortedVisibleJobs = [...visibleJobs].sort((a, b) => {
        const aTime = a.planned_start ? new Date(a.planned_start).getTime() : 0;
        const bTime = b.planned_start ? new Date(b.planned_start).getTime() : 0;
        return bTime - aTime;
      });

      setJobs(sortedVisibleJobs);

      if (todayJobs.length === 0 && overdueJobs.length > 0) {
        setActiveTab('overdue');
      } else {
        setActiveTab('today');
      }
    } catch (error) {
      console.error('Error loading OPC dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  const todayJobs = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    return jobs
      .filter((job) => !isClosedJob(job))
      .filter((job) => {
        if (!job.planned_start) return false;
        const planned = new Date(job.planned_start);
        return planned >= todayStart && planned <= todayEnd;
      })
      .sort((a, b) => {
        const aTime = a.planned_start ? new Date(a.planned_start).getTime() : 0;
        const bTime = b.planned_start ? new Date(b.planned_start).getTime() : 0;
        return aTime - bTime;
      });
  }, [jobs]);

  const weekJobs = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekEnd = endOfDay(addDays(now, 7));

    return jobs
      .filter((job) => !isClosedJob(job))
      .filter((job) => {
        if (!job.planned_start) return false;
        const planned = new Date(job.planned_start);
        return planned >= todayStart && planned <= weekEnd;
      })
      .sort((a, b) => {
        const aTime = a.planned_start ? new Date(a.planned_start).getTime() : 0;
        const bTime = b.planned_start ? new Date(b.planned_start).getTime() : 0;
        return aTime - bTime;
      });
  }, [jobs]);

  const overdueJobs = useMemo(() => {
    const todayStart = startOfDay(new Date());

    return jobs
      .filter((job) => !isClosedJob(job))
      .filter((job) => {
        if (!job.planned_start) return false;
        return new Date(job.planned_start) < todayStart;
      })
      .sort((a, b) => {
        const aTime = a.planned_start ? new Date(a.planned_start).getTime() : 0;
        const bTime = b.planned_start ? new Date(b.planned_start).getTime() : 0;
        return bTime - aTime;
      });
  }, [jobs]);

  const reportJobs = useMemo(() => {
    return jobs
      .filter((job) => isOpenReportStatus(job.report_status))
      .sort((a, b) => {
        const aTime = a.planned_start ? new Date(a.planned_start).getTime() : 0;
        const bTime = b.planned_start ? new Date(b.planned_start).getTime() : 0;
        return bTime - aTime;
      });
  }, [jobs]);

  const tabJobs = useMemo(() => {
    if (activeTab === 'today') return todayJobs;
    if (activeTab === 'week') return weekJobs;
    if (activeTab === 'overdue') return overdueJobs;
    return reportJobs;
  }, [activeTab, todayJobs, weekJobs, overdueJobs, reportJobs]);

  const tabCounts: Record<DashboardTab, number> = {
    today: todayJobs.length,
    week: weekJobs.length,
    overdue: overdueJobs.length,
    reports: reportJobs.length,
  };

  const tabEmptyText: Record<DashboardTab, string> = {
    today: 'Heute sind keine Einsätze geplant.',
    week: 'In den nächsten 7 Tagen sind keine Einsätze geplant.',
    overdue: 'Keine operativ relevanten überfälligen Einsätze.',
    reports: 'Keine offenen Berichte in der Einsatzliste.',
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '70vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: BRAND.muted,
          fontSize: '14px',
          fontWeight: 650,
        }}
      >
        Dashboard wird geladen...
      </div>
    );
  }

  return (
    <div className="opc-dashboard-page">
      <div className="opc-mobile-dashboard-action-wrap">
        <a
          href={`${baseUrl}/einsatz-planen`}
          className="opc-mobile-dashboard-action"
          style={{
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '9px',
            height: '44px',
            width: '100%',
            padding: '0 16px',
            borderRadius: '14px',
            background: BRAND.black,
            color: '#FFFFFF',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 760,
            whiteSpace: 'nowrap',
          }}
        >
          <Plus size={17} />
          Einsatz planen
        </a>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.35fr) minmax(310px, 0.65fr)',
          gap: '20px',
          alignItems: 'start',
        }}
        className="opc-dashboard-grid"
      >
        <main style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: '14px',
            }}
            className="opc-metric-grid"
          >
            <MetricCard
              label="Heute"
              value={stats.todayJobs}
              subline="Geplante Einsätze"
              icon={<CalendarDays size={17} />}
            />

            <MetricCard
              label="Diese Woche"
              value={stats.jobsThisWeek}
              subline="Nächste 7 Tage"
              icon={<Clock3 size={17} />}
            />

            <MetricCard
              label="Überfällig"
              value={stats.overdueJobs}
              subline="Operativ relevant"
              icon={<AlertTriangle size={17} />}
              tone={stats.overdueJobs > 0 ? 'danger' : 'neutral'}
            />

            <MetricCard
              label="Berichte offen"
              value={stats.openReports}
              subline="Zur Prüfung"
              icon={<FileText size={17} />}
            />
          </div>

          <section style={{ ...cardStyle, padding: '20px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '16px',
                marginBottom: '16px',
              }}
              className="opc-section-header"
            >
              <div>
                <h2 style={sectionTitleStyle}>Einsätze</h2>
                <p
                  style={{
                    margin: '6px 0 0',
                    color: BRAND.muted,
                    fontSize: '13px',
                    fontWeight: 580,
                    lineHeight: 1.45,
                  }}
                >
                  Heute, kommende Einsätze, überfällige Punkte und offene Berichte.
                </p>
              </div>

              <a
                href={`${baseUrl}/einsaetze`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  color: BRAND.muted,
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: 720,
                  whiteSpace: 'nowrap',
                }}
              >
                Alle anzeigen
                <ChevronRight size={15} />
              </a>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <DashboardTabs activeTab={activeTab} onChange={setActiveTab} counts={tabCounts} />
            </div>

            {tabJobs.length === 0 ? (
              <EmptyState text={tabEmptyText[activeTab]} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {tabJobs.slice(0, 8).map((job) => (
                  <JobRow key={job.job_id} job={job} />
                ))}
              </div>
            )}
          </section>
        </main>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <section style={{ ...cardStyle, padding: '20px' }}>
            <h2 style={{ ...sectionTitleStyle, marginBottom: '16px' }}>Schnellaktionen</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
              <ActionLink href={`${baseUrl}/einsatz-planen`} icon={<Plus size={17} />} label="Einsatz planen" dark />
              <ActionLink href={`${baseUrl}/kunde-anlegen`} icon={<Users size={17} />} label="Kunde anlegen" />
              <ActionLink href={`${baseUrl}/berichte-dateien`} icon={<Upload size={17} />} label="Bericht prüfen" />
              <ActionLink href={`${baseUrl}/anfragen-schaeden`} icon={<MessageSquare size={17} />} label="Anfrage / Schaden" />
            </div>
          </section>

          <section style={{ ...cardStyle, padding: '20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '12px',
                  background: '#F9FAFB',
                  border: `1px solid ${BRAND.border}`,
                  color: stats.urgentItems > 0 ? BRAND.red : BRAND.black,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={17} />
              </div>

              <div>
                <h2 style={sectionTitleStyle}>Aufmerksamkeit</h2>
                <p
                  style={{
                    margin: '4px 0 0',
                    color: BRAND.muted,
                    fontSize: '12px',
                    fontWeight: 620,
                  }}
                >
                  Punkte, die geprüft werden sollten
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '10px' }}>
              <MiniStat
                label="Überfällige Einsätze"
                value={stats.overdueJobs}
                tone={stats.overdueJobs > 0 ? 'danger' : 'neutral'}
                href={`${baseUrl}/einsaetze?filter=overdue`}
              />

              <MiniStat
                label="Offene Berichte"
                value={stats.openReports}
                tone={stats.openReports > 0 ? 'warning' : 'neutral'}
                href={`${baseUrl}/berichte-dateien?filter=open`}
              />

              <MiniStat
                label="Ungelesene Nachrichten"
                value={stats.unreadMessages}
                tone={stats.unreadMessages > 0 ? 'dark' : 'neutral'}
                href={`${baseUrl}/anfragen-schaeden?filter=unread`}
              />
            </div>
          </section>
        </aside>
      </div>

      <style>{`
        .opc-dashboard-page {
          padding: 0 0 140px;
          color: ${BRAND.text};
        }

        .opc-mobile-dashboard-action-wrap {
          display: none;
          margin-bottom: 18px;
        }

        .opc-mobile-dashboard-action {
          display: none !important;
        }

        @media (max-width: 1180px) {
          .opc-dashboard-grid {
            grid-template-columns: 1fr !important;
          }

          .opc-metric-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 820px) {
          .opc-mobile-dashboard-action-wrap {
            display: block !important;
          }

          .opc-mobile-dashboard-action {
            display: inline-flex !important;
          }

          .opc-section-header {
            flex-direction: column !important;
            align-items: flex-start !important;
          }

          .opc-section-header a {
            width: 100% !important;
            justify-content: space-between !important;
          }
        }

        @media (max-width: 560px) {
          .opc-metric-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}