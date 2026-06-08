import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import { readOpcPageCache, writeOpcPageCache } from '../lib/opc-page-cache';
import {
  Activity,
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

const DASHBOARD_PAGE_CACHE_KEY = 'opc:page-cache:dashboard-home';

interface DashboardStats {
  todayJobs: number;
  liveJobs: number;
  overdueJobs: number;
  openReports: number;
  newInquiries: number;
  openTickets: number;
  activeEmployees: number;
  jobsThisWeek: number;
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

interface InquiryItem {
  id?: string;
  inquiry_id?: string;
  status?: string | null;
  source_channel?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface TicketItem {
  id?: string;
  ticket_id?: string;
  status?: string | null;
  priority?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface TimeLogItem {
  id?: string;
  employee_id?: string | null;
  user_id?: string | null;
  profile_id?: string | null;
  status?: string | null;
  start_time?: string | null;
  started_at?: string | null;
  clock_in?: string | null;
  end_time?: string | null;
  ended_at?: string | null;
  clock_out?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

type DashboardTab = 'today' | 'live' | 'week' | 'overdue' | 'reports';

interface DashboardPageCache {
  stats: DashboardStats;
  jobs: ServiceJob[];
  activeTab: DashboardTab;
}

const EMPTY_DASHBOARD_STATS: DashboardStats = {
  todayJobs: 0,
  liveJobs: 0,
  overdueJobs: 0,
  openReports: 0,
  newInquiries: 0,
  openTickets: 0,
  activeEmployees: 0,
  jobsThisWeek: 0,
  unreadMessages: 0,
  urgentItems: 0,
};

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

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

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

const LIVE_JOB_STATUSES = new Set(['on_site', 'onsite', 'in_progress', 'started', 'running']);
const CLOSED_INQUIRY_STATUSES = new Set(['closed', 'converted', 'spam', 'archived', 'resolved', 'done', 'completed']);
const CLOSED_TICKET_STATUSES = new Set(['closed', 'resolved', 'done', 'completed', 'cancelled', 'archived']);
const CLOSED_TIME_LOG_STATUSES = new Set(['submitted', 'approved', 'cancelled', 'rejected', 'completed', 'closed']);

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
  fontSize: '16px',
  lineHeight: 1.25,
  fontWeight: 820,
  letterSpacing: '-0.02em',
  color: BRAND.text,
};

function navigateTo(href: string) {
  window.location.href = href;
}

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

function formatDateTime(dateString?: string | null) {
  if (!dateString) return '-';

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
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

function getJobLocation(job: ServiceJob) {
  if (job.site_name && job.billing_name && job.site_name !== job.billing_name) return job.site_name;
  return job.site_name || '';
}

function getJobCardTitle(job: ServiceJob) {
  const rawTitle = String(job.title || '').trim();
  const service = String(job.service_category || '').trim();
  const client = getJobClient(job);

  if (rawTitle) return rawTitle;
  if (!client || client === 'Ohne Kunde') return service || 'Einsatz';

  return `${service || 'Einsatz'} · ${client}`;
}

function normalizeLine(value?: string | null) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function uniqueJobDetails(job: ServiceJob) {
  const titleKey = normalizeLine(getJobCardTitle(job));
  const seen = new Set<string>([titleKey]);
  const details: string[] = [];

  const add = (value?: string | null) => {
    const clean = String(value || '').trim();
    const key = normalizeLine(clean);

    if (!clean || !key || seen.has(key)) return;

    seen.add(key);
    details.push(clean);
  };

  add(getJobClient(job));
  add(job.service_category);
  add(getJobLocation(job));
  add(formatDateTime(job.planned_start));

  return details;
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

function isLiveJob(job: ServiceJob, now = new Date()) {
  const status = normalizeStatus(job.status);

  if (LIVE_JOB_STATUSES.has(status)) return true;
  if (!job.planned_start || !job.planned_end) return false;

  const start = new Date(job.planned_start).getTime();
  const end = new Date(job.planned_end).getTime();
  const current = now.getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) return false;

  return current >= start && current <= end && !isClosedJob(job);
}

function isNewInquiry(inquiry: InquiryItem) {
  const status = normalizeStatus(inquiry.status);

  if (!status) return true;

  return !CLOSED_INQUIRY_STATUSES.has(status);
}

function isOpenTicket(ticket: TicketItem) {
  const status = normalizeStatus(ticket.status);

  if (!status) return true;

  return !CLOSED_TICKET_STATUSES.has(status);
}

function isActiveTimeLog(log: TimeLogItem) {
  const status = normalizeStatus(log.status);
  const hasEnd = Boolean(log.end_time || log.ended_at || log.clock_out);

  if (hasEnd) return false;
  if (!status) return Boolean(log.start_time || log.started_at || log.clock_in);

  return !CLOSED_TIME_LOG_STATUSES.has(status);
}

function countActiveEmployees(logs: TimeLogItem[]) {
  const activeLogs = logs.filter(isActiveTimeLog);
  const uniqueEmployees = new Set<string>();

  activeLogs.forEach((log) => {
    const employeeKey = log.employee_id || log.user_id || log.profile_id;

    if (employeeKey) uniqueEmployees.add(employeeKey);
  });

  return uniqueEmployees.size || activeLogs.length;
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

  const style = isDanger
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
        justifyContent: 'center',
        minHeight: '29px',
        padding: '0 15px',
        borderRadius: '999px',
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.text,
        fontSize: '12px',
        fontWeight: 780,
        letterSpacing: '-0.01em',
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
        height: '26px',
        padding: '0 10px',
        borderRadius: '999px',
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        color: styles.color,
        fontSize: '12px',
        fontWeight: 720,
        letterSpacing: '-0.01em',
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
  href,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  subline: string;
  icon: ReactNode;
  href: string;
  tone?: 'neutral' | 'danger' | 'dark';
}) {
  const valueColor = tone === 'danger' ? BRAND.red : BRAND.text;

  return (
    <button
      type="button"
      onClick={() => navigateTo(href)}
      className="opc-dashboard-metric-card"
      style={{
        ...cardStyle,
        minHeight: '112px',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        width: '100%',
        textAlign: 'left',
        fontFamily: pageFont,
        cursor: 'pointer',
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
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: '26px',
            lineHeight: 1,
            fontWeight: 820,
            letterSpacing: '-0.04em',
            color: valueColor,
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
            lineHeight: 1.25,
          }}
        >
          {label}
        </div>

        <div
          className="opc-dashboard-metric-subline"
          style={{
            marginTop: '4px',
            fontSize: '12px',
            fontWeight: 620,
            color: BRAND.faint,
            lineHeight: 1.25,
          }}
        >
          {subline}
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
    </button>
  );
}

function ActionButton({
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
    <button
      type="button"
      onClick={() => navigateTo(href)}
      style={{
        width: '100%',
        height: '48px',
        borderRadius: '14px',
        border: dark ? `1px solid ${BRAND.black}` : `1px solid ${BRAND.border}`,
        background: dark ? BRAND.black : '#FFFFFF',
        color: dark ? '#FFFFFF' : BRAND.text,
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
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function JobCard({ job }: { job: ServiceJob }) {
  const details = uniqueJobDetails(job);

  return (
    <button
      type="button"
      onClick={() => navigateTo(`${baseUrl}/einsatz/${job.job_id}`)}
      className="opc-dashboard-job-card"
      style={{
        width: '100%',
        border: `1px solid ${BRAND.border}`,
        borderRadius: '20px',
        background: '#FFFFFF',
        padding: '20px 22px',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: '18px',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: pageFont,
        boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
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
      <div style={{ minWidth: 0 }}>
        <div
          className="opc-dashboard-job-title"
          style={{
            fontSize: '20px',
            fontWeight: 820,
            color: BRAND.text,
            letterSpacing: '-0.04em',
            lineHeight: 1.2,
            marginBottom: '10px',
          }}
        >
          {getJobCardTitle(job)}
        </div>

        <div
          className="opc-dashboard-job-details"
          style={{
            color: BRAND.muted,
            fontSize: '16px',
            fontWeight: 720,
            lineHeight: 1.45,
            display: 'grid',
            gap: '5px',
          }}
        >
          {details.map((detail) => (
            <span key={detail}>{detail}</span>
          ))}
        </div>
      </div>

      <div
        className="opc-dashboard-job-badges"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '10px',
        }}
      >
        <StatusBadge status={job.status} />
        <TimeBadge value={job.planned_start} />
      </div>
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
    { key: 'live', label: 'Live' },
    { key: 'week', label: 'Woche' },
    { key: 'overdue', label: 'Überfällig' },
    { key: 'reports', label: 'Berichte' },
  ];

  return (
    <div
      className="opc-dashboard-tabs"
      style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        marginBottom: '0',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
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
              height: '48px',
              minWidth: '128px',
              padding: '0 18px',
              borderRadius: '14px',
              border: active ? `1px solid ${BRAND.black}` : `1px solid ${BRAND.border}`,
              background: active ? BRAND.black : '#FFFFFF',
              color: active ? '#FFFFFF' : BRAND.text,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 760,
              fontFamily: pageFont,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: active ? 'none' : '0 1px 2px rgba(15, 17, 21, 0.04)',
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
    <button
      type="button"
      onClick={() => navigateTo(href)}
      style={{
        width: '100%',
        border: `1px solid ${BRAND.border}`,
        borderRadius: '15px',
        background: '#FFFFFF',
        padding: '13px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        fontFamily: pageFont,
        cursor: 'pointer',
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
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        minHeight: '92px',
        border: `1px dashed ${BRAND.borderStrong}`,
        borderRadius: '20px',
        background: '#FAFAFA',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: BRAND.muted,
        fontSize: '13px',
        fontWeight: 650,
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
  const [stats, setStats] = useState<DashboardStats>(EMPTY_DASHBOARD_STATS);

  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [activeTab, setActiveTab] = useState<DashboardTab>('today');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = readOpcPageCache<DashboardPageCache>(DASHBOARD_PAGE_CACHE_KEY);

    if (cached) {
      setStats({ ...EMPTY_DASHBOARD_STATS, ...cached.stats });
      setJobs(cached.jobs);
      setActiveTab(cached.activeTab);
      setLoading(false);
      return;
    }

    void loadData();
  }, []);

  async function loadData(options: { background?: boolean } = {}) {
    const isBackground = Boolean(options.background);

    if (!isBackground) setLoading(true);

    try {
      const [jobsData, inboxData, reportsData, inquiriesData, ticketsData, timeLogsData] = await Promise.all([
        readList<ServiceJob>('opc_my_portal_job_feed', '*', 150),
        readList<InboxMessage>('opc_my_conversation_inbox', '*', 30),
        readList<ReportItem>('opc_portal_report_feed', '*', 100),
        readList<InquiryItem>('opc_inquiries', '*', 100),
        readList<TicketItem>('opc_tickets', '*', 100),
        readList<TimeLogItem>('opc_job_time_logs', '*', 100),
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

      const liveJobs = operationalJobs.filter((job) => isLiveJob(job, now));
      const openReports = reportsData.filter(isOpenReport);
      const newInquiries = inquiriesData.filter(isNewInquiry);
      const openTickets = ticketsData.filter(isOpenTicket);
      const activeEmployees = countActiveEmployees(timeLogsData);
      const unreadMessages = inboxData.filter((message) => Boolean(message.unread)).length;

      const nextStats: DashboardStats = {
        todayJobs: todayJobs.length,
        liveJobs: liveJobs.length,
        overdueJobs: overdueJobs.length,
        openReports: openReports.length,
        newInquiries: newInquiries.length,
        openTickets: openTickets.length,
        activeEmployees,
        jobsThisWeek: weekJobs.length,
        unreadMessages,
        urgentItems: overdueJobs.length + openReports.length + newInquiries.length + openTickets.length + unreadMessages,
      };

      setStats(nextStats);

      const sortedVisibleJobs = [...visibleJobs].sort((a, b) => {
        const aTime = a.planned_start ? new Date(a.planned_start).getTime() : 0;
        const bTime = b.planned_start ? new Date(b.planned_start).getTime() : 0;
        return bTime - aTime;
      });

      setJobs(sortedVisibleJobs);

      const nextActiveTab: DashboardTab = todayJobs.length === 0 && overdueJobs.length > 0 ? 'overdue' : 'today';

      setActiveTab(nextActiveTab);

      writeOpcPageCache<DashboardPageCache>(DASHBOARD_PAGE_CACHE_KEY, {
        stats: nextStats,
        jobs: sortedVisibleJobs,
        activeTab: nextActiveTab,
      });
    } catch (error) {
      console.error('Error loading OPC dashboard:', error);
    } finally {
      if (!isBackground) setLoading(false);
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

  const liveJobs = useMemo(() => {
    const now = new Date();

    return jobs
      .filter((job) => !isClosedJob(job))
      .filter((job) => isLiveJob(job, now))
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
    if (activeTab === 'live') return liveJobs;
    if (activeTab === 'week') return weekJobs;
    if (activeTab === 'overdue') return overdueJobs;
    return reportJobs;
  }, [activeTab, todayJobs, liveJobs, weekJobs, overdueJobs, reportJobs]);

  const tabCounts: Record<DashboardTab, number> = {
    today: todayJobs.length,
    live: liveJobs.length,
    week: weekJobs.length,
    overdue: overdueJobs.length,
    reports: reportJobs.length,
  };

  const tabEmptyText: Record<DashboardTab, string> = {
    today: 'Heute sind keine Einsätze geplant.',
    live: 'Aktuell läuft kein Einsatz.',
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
          fontFamily: pageFont,
        }}
      >
        Dashboard wird geladen...
      </div>
    );
  }

  return (
    <div className="opc-dashboard-page">
      <div className="opc-mobile-dashboard-action-wrap">
        <button
          type="button"
          onClick={() => navigateTo(`${baseUrl}/einsatz-planen`)}
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
            border: `1px solid ${BRAND.black}`,
            color: '#FFFFFF',
            fontSize: '14px',
            fontWeight: 760,
            fontFamily: pageFont,
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
        >
          <Plus size={17} />
          Einsatz planen
        </button>
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
        <main style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
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
              href={`${baseUrl}/einsaetze?filter=today`}
            />

            <MetricCard
              label="Live Einsätze"
              value={stats.liveJobs}
              subline="Aktuell laufend"
              icon={<Activity size={17} />}
              href={`${baseUrl}/einsaetze?filter=live`}
              tone={stats.liveJobs > 0 ? 'dark' : 'neutral'}
            />

            <MetricCard
              label="Überfällig"
              value={stats.overdueJobs}
              subline="Operativ relevant"
              icon={<AlertTriangle size={17} />}
              href={`${baseUrl}/einsaetze?filter=overdue`}
              tone={stats.overdueJobs > 0 ? 'danger' : 'neutral'}
            />

            <MetricCard
              label="Berichte"
              value={stats.openReports}
              subline="Zur Prüfung"
              icon={<FileText size={17} />}
              href={`${baseUrl}/berichte-dateien?filter=open`}
            />

            <MetricCard
              label="Neue Anfragen"
              value={stats.newInquiries}
              subline="Website, Portal, WhatsApp"
              icon={<MessageSquare size={17} />}
              href={`${baseUrl}/anfragen?filter=new`}
              tone={stats.newInquiries > 0 ? 'dark' : 'neutral'}
            />

            <MetricCard
              label="Tickets & Schäden"
              value={stats.openTickets}
              subline="Offene Meldungen"
              icon={<AlertTriangle size={17} />}
              href={`${baseUrl}/anfragen-schaeden?filter=open`}
              tone={stats.openTickets > 0 ? 'danger' : 'neutral'}
            />

            <MetricCard
              label="Mitarbeiter aktiv"
              value={stats.activeEmployees}
              subline="Eingestempelt"
              icon={<Users size={17} />}
              href={`${baseUrl}/zeiterfassung?filter=active`}
              tone={stats.activeEmployees > 0 ? 'dark' : 'neutral'}
            />

            <MetricCard
              label="Diese Woche"
              value={stats.jobsThisWeek}
              subline="Nächste 7 Tage"
              icon={<Clock3 size={17} />}
              href={`${baseUrl}/einsaetze?filter=week`}
            />
          </div>

          <div className="opc-dashboard-list-heading">
            <div style={{ minWidth: 0 }}>
              <h2 style={sectionTitleStyle}>Einsätze</h2>
              <p
                style={{
                  margin: '6px 0 0',
                  color: BRAND.muted,
                  fontSize: '13px',
                  fontWeight: 600,
                  lineHeight: 1.45,
                }}
              >
                Heute, live laufende Einsätze, kommende Termine und offene Berichte.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigateTo(`${baseUrl}/einsaetze`)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                minHeight: '36px',
                padding: '0 14px',
                borderRadius: '999px',
                background: '#FFFFFF',
                border: `1px solid ${BRAND.border}`,
                color: BRAND.muted,
                fontSize: '13px',
                fontWeight: 740,
                fontFamily: pageFont,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              Alle anzeigen
              <ChevronRight size={15} />
            </button>
          </div>

          <DashboardTabs activeTab={activeTab} onChange={setActiveTab} counts={tabCounts} />

          {tabJobs.length === 0 ? (
            <EmptyState text={tabEmptyText[activeTab]} />
          ) : (
            <div className="opc-dashboard-job-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tabJobs.slice(0, 8).map((job) => (
                <JobCard key={job.job_id} job={job} />
              ))}
            </div>
          )}
        </main>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
          <section style={{ ...cardStyle, padding: '20px' }}>
            <h2 style={{ ...sectionTitleStyle, marginBottom: '16px' }}>Schnellaktionen</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
              <ActionButton href={`${baseUrl}/einsatz-planen`} icon={<Plus size={17} />} label="Einsatz planen" dark />
              <ActionButton href={`${baseUrl}/kunde-anlegen`} icon={<Users size={17} />} label="Kunde anlegen" />
              <ActionButton href={`${baseUrl}/berichte-dateien`} icon={<Upload size={17} />} label="Bericht prüfen" />
              <ActionButton href={`${baseUrl}/anfragen-schaeden`} icon={<MessageSquare size={17} />} label="Anfrage / Schaden" />
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
                  flexShrink: 0,
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
          font-family: ${pageFont};
        }

        .opc-dashboard-page * {
          box-sizing: border-box;
        }

        .opc-mobile-dashboard-action-wrap {
          display: none;
          margin-bottom: 18px;
        }

        .opc-mobile-dashboard-action {
          display: none !important;
        }

        .opc-dashboard-list-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
        }

        .opc-dashboard-tabs::-webkit-scrollbar {
          display: none;
        }

        .opc-dashboard-tabs {
          scrollbar-width: none;
        }

        .opc-dashboard-metric-card:focus-visible {
          outline: 2px solid ${BRAND.black};
          outline-offset: 2px;
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

          .opc-dashboard-list-heading {
            align-items: flex-start !important;
            flex-direction: column !important;
            gap: 10px !important;
          }

          .opc-dashboard-list-heading button {
            width: 100% !important;
            justify-content: space-between !important;
            min-height: 42px !important;
          }

          .opc-dashboard-tabs {
            gap: 8px !important;
          }

          .opc-dashboard-tabs button {
            height: 42px !important;
            min-width: 0 !important;
            flex: 1 1 0 !important;
            padding: 0 10px !important;
            font-size: 13px !important;
          }
        }

        @media (max-width: 560px) {
          .opc-dashboard-page {
            padding-bottom: 120px !important;
          }

          .opc-metric-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 10px !important;
          }

          .opc-metric-grid > * {
            min-width: 0 !important;
          }

          .opc-dashboard-metric-card {
            min-height: 96px !important;
            padding: 14px !important;
          }

          .opc-dashboard-metric-card > div:first-child > div:first-child {
            font-size: 22px !important;
          }

          .opc-dashboard-metric-subline {
            display: none !important;
          }

          .opc-dashboard-job-card {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
            padding: 18px !important;
          }

          .opc-dashboard-job-title {
            font-size: 16px !important;
            letter-spacing: -0.025em !important;
            margin-bottom: 8px !important;
          }

          .opc-dashboard-job-details {
            font-size: 13px !important;
            font-weight: 650 !important;
            gap: 4px !important;
          }

          .opc-dashboard-job-badges {
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
          }
        }
      `}</style>
    </div>
  );
}
