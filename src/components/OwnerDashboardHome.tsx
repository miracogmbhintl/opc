import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import { readOpcPageCache } from '../lib/opc-page-cache';
import { readCachedOpcAuthProfile } from '../lib/opc-auth-cache';
import {
  Activity,
  AlertTriangle,
  Banknote,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileText,
  FolderOpen,
  HandCoins,
  MessageSquare,
  Plus,
  ReceiptText,
  Upload,
  Users,
  WalletCards,
} from 'lucide-react';

// OPC_DASHBOARD_SPLIT_PERSISTENT_CACHE_V1
// Core cards and finance use separate user-scoped snapshots. A core refresh can
// therefore never erase a valid finance snapshot, and both survive navigation,
// app restarts and a later login by the same user.
const LEGACY_DASHBOARD_PAGE_CACHE_KEY = 'opc:page-cache:dashboard-home:v9-progressive-cache';
const DASHBOARD_CORE_CACHE_KEY = 'opc:dashboard:core-snapshot:v10';
const DASHBOARD_FINANCE_CACHE_KEY = 'opc:dashboard:finance-snapshot:v10';
const DASHBOARD_CORE_TTL_MS = 5 * 60 * 1000;
const DASHBOARD_FINANCE_TTL_MS = 10 * 60 * 1000;
const DASHBOARD_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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
  actual_end?: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
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
  onboarding_status?: string | null;
  inquiry_status?: string | null;
  frontend_status?: string | null;
  client_id?: string | null;
  converted_client_id?: string | null;
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
  staff_role_id?: string | null;
  user_id?: string | null;
  profile_id?: string | null;
  job_id?: string | null;
  status?: string | null;
  start_time?: string | null;
  started_at?: string | null;
  clock_in?: string | null;
  clock_in_at?: string | null;
  end_time?: string | null;
  ended_at?: string | null;
  clock_out?: string | null;
  clock_out_at?: string | null;
  break_started_at?: string | null;
  work_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface StaffIdentityItem {
  id?: string;
  employee_id?: string | null;
  user_id?: string | null;
}

interface FinanceSummary {
  totalOutstanding: number;
  openOutstanding: number;
  openInvoices: number;
  overdueInvoices: number;
  openQuotes: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  activeEmployees: number;
  payrollDue: number;
  expensesTracked: boolean;
}

type FinanceRow = Record<string, any>;
type FinancePreviewTab = 'invoices' | 'quotes' | 'payroll' | 'finance' | 'reminders';

interface FinanceDocumentPreview {
  id: string;
  title: string;
  number: string;
  status: string;
  amount: number;
  balance?: number;
  dateLabel: string;
  href: string;
}

interface PayrollPreview {
  id: string;
  name: string;
  amount: number;
  status: string;
}

interface FinancePreviewData {
  invoices: FinanceDocumentPreview[];
  quotes: FinanceDocumentPreview[];
  reminders: FinanceDocumentPreview[];
  payroll: PayrollPreview[];
}

type DashboardTab = 'today' | 'live' | 'week' | 'overdue' | 'reports';

interface DashboardPageCache {
  stats: DashboardStats;
  finance: FinanceSummary;
  financePreviews?: FinancePreviewData;
  jobs: ServiceJob[];
  activeTab: DashboardTab;
}

interface DashboardCoreSnapshotData {
  stats: DashboardStats;
  jobs: ServiceJob[];
  activeTab: DashboardTab;
}

interface DashboardFinanceSnapshotData {
  finance: FinanceSummary;
  financePreviews: FinancePreviewData;
}

type DashboardPersistentSlice<T> = {
  savedAt: number;
  userId: string;
  data: T;
};

type DashboardReadableSlice<T> = {
  savedAt: number;
  data: T;
};

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

const EMPTY_FINANCE_SUMMARY: FinanceSummary = {
  totalOutstanding: 0,
  openOutstanding: 0,
  openInvoices: 0,
  overdueInvoices: 0,
  openQuotes: 0,
  monthlyRevenue: 0,
  monthlyExpenses: 0,
  activeEmployees: 0,
  payrollDue: 0,
  expensesTracked: false,
};

const EMPTY_FINANCE_PREVIEWS: FinancePreviewData = {
  invoices: [],
  quotes: [],
  reminders: [],
  payroll: [],
};

function dashboardCacheUserId() {
  return String(readCachedOpcAuthProfile()?.id || '').trim();
}

function readDashboardPersistentSlice<T>(
  key: string,
  maxAgeMs = DASHBOARD_SNAPSHOT_MAX_AGE_MS,
): DashboardReadableSlice<T> | null {
  if (typeof window === 'undefined') return null;

  const userId = dashboardCacheUserId();
  if (!userId) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as DashboardPersistentSlice<T>;
    if (
      !parsed ||
      parsed.userId !== userId ||
      typeof parsed.savedAt !== 'number' ||
      !parsed.data
    ) {
      return null;
    }

    if (Date.now() - parsed.savedAt > maxAgeMs) {
      window.localStorage.removeItem(key);
      return null;
    }

    return {
      savedAt: parsed.savedAt,
      data: parsed.data,
    };
  } catch {
    return null;
  }
}

function writeDashboardPersistentSlice<T>(
  key: string,
  data: T,
  savedAt = Date.now(),
) {
  if (typeof window === 'undefined') return;

  const userId = dashboardCacheUserId();
  if (!userId) return;

  try {
    const payload: DashboardPersistentSlice<T> = {
      savedAt,
      userId,
      data,
    };

    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Storage failure must not block dashboard rendering.
  }
}

function dashboardPersistentSliceIsFresh<T>(
  slice: DashboardReadableSlice<T> | null,
  ttlMs: number,
) {
  return Boolean(slice && Date.now() - slice.savedAt < ttlMs);
}

function readDashboardBootstrapCache() {
  let core = readDashboardPersistentSlice<DashboardCoreSnapshotData>(
    DASHBOARD_CORE_CACHE_KEY,
  );
  let finance = readDashboardPersistentSlice<DashboardFinanceSnapshotData>(
    DASHBOARD_FINANCE_CACHE_KEY,
  );

  // One-time migration from the previous combined session cache.
  if ((!core || !finance) && typeof window !== 'undefined') {
    const legacy = readOpcPageCache<DashboardPageCache>(
      LEGACY_DASHBOARD_PAGE_CACHE_KEY,
      DASHBOARD_SNAPSHOT_MAX_AGE_MS,
    );

    if (legacy) {
      if (!core) {
        writeDashboardPersistentSlice<DashboardCoreSnapshotData>(
          DASHBOARD_CORE_CACHE_KEY,
          {
            stats: { ...EMPTY_DASHBOARD_STATS, ...legacy.stats },
            jobs: legacy.jobs || [],
            activeTab: legacy.activeTab || 'today',
          },
          Date.now() - DASHBOARD_CORE_TTL_MS - 1000,
        );
        core = readDashboardPersistentSlice<DashboardCoreSnapshotData>(
          DASHBOARD_CORE_CACHE_KEY,
        );
      }

      if (!finance) {
        writeDashboardPersistentSlice<DashboardFinanceSnapshotData>(
          DASHBOARD_FINANCE_CACHE_KEY,
          {
            finance: { ...EMPTY_FINANCE_SUMMARY, ...legacy.finance },
            financePreviews: {
              ...EMPTY_FINANCE_PREVIEWS,
              ...(legacy.financePreviews || {}),
            },
          },
          Date.now() - DASHBOARD_FINANCE_TTL_MS - 1000,
        );
        finance = readDashboardPersistentSlice<DashboardFinanceSnapshotData>(
          DASHBOARD_FINANCE_CACHE_KEY,
        );
      }
    }
  }

  return { core, finance };
}

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

const COMPLETED_JOB_STATUSES = new Set([
  'completed',
  'report_approved',
  'approved',
  'sent_to_client',
]);

const CLOSED_JOB_STATUSES = new Set([
  ...COMPLETED_JOB_STATUSES,
  'cancelled',
  'rejected',
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
const CLOSED_INQUIRY_STATUSES = new Set(['closed', 'converted', 'spam', 'archived', 'resolved', 'done', 'completed', 'rejected', 'abgelehnt', 'archiviert']);
const CLOSED_TICKET_STATUSES = new Set(['closed', 'resolved', 'done', 'completed', 'cancelled', 'archived']);
const CLOSED_TIME_LOG_STATUSES = new Set(['submitted', 'approved', 'cancelled', 'rejected', 'completed', 'closed']);
const ACTIVE_TIME_LOG_STATUSES = new Set(['open', 'on_break', 'active', 'clocked_in', 'in_progress', 'running', 'started']);

const STALE_JOB_DAYS = 120;
const OPEN_INVOICE_STATUSES = new Set(['sent', 'viewed', 'partially_paid', 'overdue', 'open']);
const OPEN_QUOTE_STATUSES = new Set(['draft', 'ready', 'sent', 'viewed', 'open']);
const ACTIVE_EMPLOYEE_STATUSES = new Set(['active', 'aktiv', 'enabled']);

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
  ready: 'Bereit',
  sent: 'Gesendet',
  viewed: 'Gesehen',
  accepted: 'Angenommen',
  declined: 'Abgelehnt',
  expired: 'Abgelaufen',
  converted_to_job: 'Einsatz erstellt',
  invoiced: 'Verrechnet',
  paid: 'Bezahlt',
  partially_paid: 'Teilweise bezahlt',
  overdue: 'Überfällig',
  open: 'Offen',
  active: 'Aktiv',
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

function scheduleDashboardTask(task: () => void, timeout = 1800) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    const idleWindow = window as typeof window & {
      requestIdleCallback: (
        callback: () => void,
        options?: { timeout: number },
      ) => number;
    };

    idleWindow.requestIdleCallback(task, { timeout });
    return;
  }

  window.setTimeout(task, timeout);
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

function formatMoney(value: number) {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
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

function startOfWeek(date: Date) {
  const copy = startOfDay(date);
  const day = copy.getDay();
  const distanceToMonday = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + distanceToMonday);
  return copy;
}

function endOfWeek(date: Date) {
  return endOfDay(addDays(startOfWeek(date), 6));
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

function isCompletedJob(job: ServiceJob) {
  return COMPLETED_JOB_STATUSES.has(normalizeStatus(job.status));
}

function getJobCompletionDate(job: ServiceJob) {
  const value = job.completed_at || job.actual_end || job.planned_end || job.updated_at || job.planned_start;
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isOpenReportStatus(status?: string | null) {
  const normalized = normalizeStatus(status);

  if (!normalized) return false;

  return OPEN_REPORT_STATUSES.has(normalized);
}

function isOpenReport(report: ReportItem) {
  const status = normalizeStatus(report.report_status || report.status);
  return Boolean(status && OPEN_REPORT_STATUSES.has(status));
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
  if (isClosedJob(job) || job.actual_end || job.completed_at) return false;

  const status = normalizeStatus(job.status);
  const current = now.getTime();
  const start = job.planned_start ? new Date(job.planned_start).getTime() : Number.NaN;
  const end = job.planned_end ? new Date(job.planned_end).getTime() : Number.NaN;

  if (Number.isFinite(start) && Number.isFinite(end) && current >= start && current <= end) {
    return true;
  }

  if (!LIVE_JOB_STATUSES.has(status)) return false;

  const recentReference = Number.isFinite(start)
    ? start
    : job.updated_at
      ? new Date(job.updated_at).getTime()
      : Number.NaN;

  if (!Number.isFinite(recentReference)) return false;

  const ageMs = current - recentReference;
  return ageMs >= -5 * 60_000 && ageMs <= 20 * 60 * 60_000;
}

function isNewInquiry(inquiry: InquiryItem) {
  if (inquiry.converted_client_id) return false;

  const status = normalizeStatus(
    inquiry.status ||
      inquiry.onboarding_status ||
      inquiry.inquiry_status ||
      inquiry.frontend_status,
  );

  if (!status) return true;

  return !CLOSED_INQUIRY_STATUSES.has(status);
}

function isOpenTicket(ticket: TicketItem) {
  const status = normalizeStatus(ticket.status);

  if (!status) return true;

  return !CLOSED_TICKET_STATUSES.has(status);
}

function localIsoDate(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function timeLogStartValue(log: TimeLogItem) {
  return log.start_time || log.started_at || log.clock_in || log.clock_in_at || log.created_at || null;
}

function isActiveTimeLog(log: TimeLogItem, now = new Date()) {
  const status = normalizeStatus(log.status);
  const startValue = timeLogStartValue(log);
  const hasEnd = Boolean(log.end_time || log.ended_at || log.clock_out || log.clock_out_at);

  if (!startValue || hasEnd) return false;
  if (!ACTIVE_TIME_LOG_STATUSES.has(status)) return false;

  if (log.work_date && String(log.work_date).slice(0, 10) !== localIsoDate(now)) return false;

  const startedAt = new Date(startValue).getTime();
  if (!Number.isFinite(startedAt)) return false;

  const ageMs = now.getTime() - startedAt;
  return ageMs >= -5 * 60_000 && ageMs <= 20 * 60 * 60_000;
}

function countActiveEmployees(logs: TimeLogItem[], staffRows: StaffIdentityItem[], now = new Date()) {
  const staffByRoleId = new Map(staffRows.filter((row) => row.id).map((row) => [String(row.id), row]));
  const staffByUserId = new Map(staffRows.filter((row) => row.user_id).map((row) => [String(row.user_id), row]));
  const uniqueEmployees = new Set<string>();

  logs.filter((log) => isActiveTimeLog(log, now)).forEach((log) => {
    const staff =
      (log.staff_role_id ? staffByRoleId.get(String(log.staff_role_id)) : undefined) ||
      (log.user_id ? staffByUserId.get(String(log.user_id)) : undefined);

    const employeeKey =
      log.employee_id ||
      staff?.employee_id ||
      log.user_id ||
      staff?.user_id ||
      log.staff_role_id ||
      log.profile_id;

    if (employeeKey) uniqueEmployees.add(String(employeeKey));
  });

  return uniqueEmployees.size;
}

function rowTimestamp(row: { updated_at?: string | null; created_at?: string | null }) {
  const value = row.updated_at || row.created_at || '';
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function dedupeLatest<T>(rows: T[], getKey: (row: T, index: number) => string) {
  const map = new Map<string, T>();

  rows.forEach((row, index) => {
    const key = getKey(row, index);
    const existing = map.get(key);

    if (!existing || rowTimestamp(row as any) >= rowTimestamp(existing as any)) {
      map.set(key, row);
    }
  });

  return Array.from(map.values());
}

async function readList<T>(table: string, select = '*', limit = 50): Promise<T[]> {
  const { data, error } = await supabase.from(table).select(select).limit(limit);

  if (error) {
    console.warn(`[OPC Dashboard] ${table} konnte nicht geladen werden:`, error.message);
    throw error;
  }

  return (data || []) as T[];
}

function financeClean(value: unknown) {
  return String(value ?? '').trim();
}

function financeNormalize(value: unknown) {
  return financeClean(value).toLowerCase();
}

function financeNumber(value: unknown) {
  const parsed = Number(String(value ?? 0).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function financeRound(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function financeIsoDate(value: unknown) {
  const match = financeClean(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}

function financeMonthRange() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  const year = local.getFullYear();
  const monthIndex = local.getMonth();
  const month = String(monthIndex + 1).padStart(2, '0');
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();

  return {
    today: local.toISOString().slice(0, 10),
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

function invoiceBalance(invoice: FinanceRow) {
  const explicit = financeNumber(invoice.balance_chf ?? invoice.balance ?? invoice.open_amount_chf);
  if (explicit > 0) return explicit;

  if (!OPEN_INVOICE_STATUSES.has(financeNormalize(invoice.status))) return 0;

  const total = financeNumber(invoice.total_chf ?? invoice.total_amount ?? invoice.total);
  const paid = financeNumber(invoice.paid_chf ?? invoice.paid_amount_chf ?? invoice.paid_amount);
  return Math.max(total - paid, 0);
}

function invoiceIsOverdue(invoice: FinanceRow, today: string) {
  if (invoiceBalance(invoice) <= 0) return false;
  if (financeNormalize(invoice.status) === 'overdue') return true;

  const dueDate = financeIsoDate(invoice.due_date);
  return Boolean(dueDate && dueDate < today);
}

function invoicePaymentDate(invoice: FinanceRow) {
  return financeIsoDate(
    invoice.paid_at || invoice.payment_date || invoice.updated_at || invoice.issue_date || invoice.created_at,
  );
}

function invoicePaidAmount(invoice: FinanceRow) {
  const paid = financeNumber(invoice.paid_chf ?? invoice.paid_amount_chf ?? invoice.paid_amount);
  if (paid > 0) return paid;
  if (financeNormalize(invoice.status) === 'paid') {
    return financeNumber(invoice.total_chf ?? invoice.total_amount ?? invoice.total);
  }
  return 0;
}

function financeObject(value: unknown): FinanceRow {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as FinanceRow) }
    : {};
}

function contractActiveOn(contract: FinanceRow, workDate: string) {
  const status = financeNormalize(contract.status);
  if (['cancelled', 'canceled', 'draft', 'inactive', 'terminated'].includes(status)) return false;

  const validFrom = financeIsoDate(contract.valid_from) || '0000-01-01';
  const validUntil = financeIsoDate(contract.valid_until) || '9999-12-31';
  return validFrom <= workDate && validUntil >= workDate;
}

function employeeHourlyOverride(employee: FinanceRow) {
  const metadata = financeObject(employee.metadata);
  const override = financeObject(metadata.payroll_hourly_rate_override);
  const rate = financeNumber(override.hourly_rate_chf);
  const validFrom = financeIsoDate(override.valid_from);

  if (rate <= 0 || !validFrom) return null;

  return {
    employee_id: employee.id,
    salary_type: 'hourly',
    hourly_rate_chf: rate,
    monthly_salary_chf: 0,
    valid_from: validFrom,
    valid_until: financeIsoDate(override.valid_until) || null,
    status: 'active',
    __priority: 1000,
  } as FinanceRow;
}

function financeContractForDate(contracts: FinanceRow[], workDate: string, salaryType?: string) {
  return contracts
    .filter((contract) => contractActiveOn(contract, workDate))
    .filter((contract) => !salaryType || financeNormalize(contract.salary_type) === salaryType)
    .sort((a, b) => {
      const priority = financeNumber(b.__priority) - financeNumber(a.__priority);
      if (priority) return priority;
      return financeClean(b.valid_from).localeCompare(financeClean(a.valid_from));
    })[0] || null;
}

function financeEntryMinutes(entry: FinanceRow) {
  const stored = financeNumber(entry.total_minutes);
  if (stored > 0) return stored;

  const start = new Date(entry.clock_in_at || entry.start_time || entry.started_at || 0).getTime();
  const end = new Date(entry.clock_out_at || entry.end_time || entry.ended_at || 0).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;

  return Math.max(0, Math.floor((end - start) / 60000) - financeNumber(entry.break_minutes));
}

async function readFinanceDashboardDirect(): Promise<{
  summary: FinanceSummary;
  previews: FinancePreviewData;
}> {
  try {
    const range = financeMonthRange();
    const monthStartTimestamp = `${range.from}T00:00:00`;
    const monthEndTimestamp = `${range.to}T23:59:59`;

    // Dashboard-Abfragen bleiben bewusst klein. Die Detailseiten laden ihre eigenen vollständigen Listen.
    const [openInvoiceResponse, latestInvoiceResponse, monthlyInvoiceResponse, openQuoteResponse, latestQuoteResponse, employeeResponse] =
      await Promise.all([
        supabase
          .from('opc_invoices')
          .select('id,invoice_number,status,title,issue_date,due_date,total_chf,balance_chf,paid_chf,created_at,updated_at,client_snapshot')
          .in('status', Array.from(OPEN_INVOICE_STATUSES))
          .order('created_at', { ascending: false })
          .limit(120),
        supabase
          .from('opc_invoices')
          .select('id,invoice_number,status,title,issue_date,due_date,total_chf,balance_chf,paid_chf,created_at,updated_at,client_snapshot')
          .order('created_at', { ascending: false })
          .limit(2),
        supabase
          .from('opc_invoices')
          .select('id,status,total_chf,paid_chf,issue_date,created_at,updated_at')
          .in('status', ['paid', 'partially_paid'])
          .gte('updated_at', monthStartTimestamp)
          .lte('updated_at', monthEndTimestamp)
          .order('updated_at', { ascending: false })
          .limit(120),
        supabase
          .from('opc_quotes')
          .select('id,quote_number,status,title,quote_type,issue_date,valid_until,total_chf,created_at,updated_at')
          .in('status', Array.from(OPEN_QUOTE_STATUSES))
          .order('created_at', { ascending: false })
          .limit(120),
        supabase
          .from('opc_quotes')
          .select('id,quote_number,status,title,quote_type,issue_date,valid_until,total_chf,created_at,updated_at')
          .order('created_at', { ascending: false })
          .limit(2),
        supabase
          .from('opc_employees')
          .select('id,legal_first_name,legal_last_name,preferred_name,status,payroll_in_scope,portal_access_only,metadata')
          .in('status', Array.from(ACTIVE_EMPLOYEE_STATUSES))
          .order('created_at', { ascending: false })
          .limit(80),
      ]);

    const warn = (label: string, error: any) => {
      if (error) console.warn(`[OPC Dashboard] ${label}:`, error.message || error);
    };

    warn('Offene Rechnungen konnten nicht geladen werden', openInvoiceResponse.error);
    warn('Rechnungsvorschau konnte nicht geladen werden', latestInvoiceResponse.error);
    warn('Monatseinnahmen konnten nicht geladen werden', monthlyInvoiceResponse.error);
    warn('Offene Offerten konnten nicht geladen werden', openQuoteResponse.error);
    warn('Offertenvorschau konnte nicht geladen werden', latestQuoteResponse.error);
    warn('Mitarbeiterübersicht konnte nicht geladen werden', employeeResponse.error);

    const primaryFinanceError = [
      openInvoiceResponse.error,
      latestInvoiceResponse.error,
      monthlyInvoiceResponse.error,
      openQuoteResponse.error,
      latestQuoteResponse.error,
      employeeResponse.error,
    ].find(Boolean);

    if (primaryFinanceError) throw primaryFinanceError;

    const openInvoices = (openInvoiceResponse.data || []) as FinanceRow[];
    const latestInvoices = (latestInvoiceResponse.data || []) as FinanceRow[];
    const monthlyInvoices = (monthlyInvoiceResponse.data || []) as FinanceRow[];
    const openQuotes = (openQuoteResponse.data || []) as FinanceRow[];
    const latestQuotes = (latestQuoteResponse.data || []) as FinanceRow[];
    const activeEmployees = ((employeeResponse.data || []) as FinanceRow[]).filter(
      (employee) => employee.portal_access_only !== true,
    );

    const outstandingRows = openInvoices
      .map((invoice) => ({ invoice, balance: invoiceBalance(invoice) }))
      .filter((row) => row.balance > 0);
    const overdueRows = outstandingRows.filter(({ invoice }) => invoiceIsOverdue(invoice, range.today));
    const overdueIds = new Set(overdueRows.map(({ invoice }) => financeClean(invoice.id)));

    const totalOutstanding = outstandingRows.reduce((sum, row) => sum + row.balance, 0);
    const openOutstanding = outstandingRows
      .filter(({ invoice }) => !overdueIds.has(financeClean(invoice.id)))
      .reduce((sum, row) => sum + row.balance, 0);
    const monthlyRevenue = monthlyInvoices
      .filter((invoice) => {
        const date = invoicePaymentDate(invoice);
        return date >= range.from && date <= range.to && invoicePaidAmount(invoice) > 0;
      })
      .reduce((sum, invoice) => sum + invoicePaidAmount(invoice), 0);

    const employeeIds = activeEmployees.map((employee) => financeClean(employee.id)).filter(Boolean);
    let contracts: FinanceRow[] = [];
    let timeEntries: FinanceRow[] = [];

    if (employeeIds.length) {
      const [contractResponse, timeResponse] = await Promise.all([
        supabase
          .from('opc_employment_contracts')
          .select('employee_id,salary_type,hourly_rate_chf,monthly_salary_chf,valid_from,valid_until,status')
          .in('employee_id', employeeIds)
          .order('valid_from', { ascending: false })
          .limit(250),
        supabase
          .from('opc_employee_time_entries')
          .select('employee_id,work_date,total_minutes,break_minutes,clock_in_at,clock_out_at,status')
          .in('employee_id', employeeIds)
          .eq('status', 'approved')
          .gte('work_date', range.from)
          .lte('work_date', range.to)
          .order('work_date', { ascending: false })
          .limit(500),
      ]);

      warn('Arbeitsverträge konnten nicht geladen werden', contractResponse.error);
      warn('Genehmigte Arbeitszeiten konnten nicht geladen werden', timeResponse.error);

      if (contractResponse.error) throw contractResponse.error;
      if (timeResponse.error) throw timeResponse.error;

      contracts = (contractResponse.data || []) as FinanceRow[];
      timeEntries = (timeResponse.data || []) as FinanceRow[];
    }

    const contractsByEmployee = new Map<string, FinanceRow[]>();
    for (const contract of contracts) {
      const employeeId = financeClean(contract.employee_id);
      if (!employeeId) continue;
      const rows = contractsByEmployee.get(employeeId) || [];
      rows.push(contract);
      contractsByEmployee.set(employeeId, rows);
    }

    for (const employee of activeEmployees) {
      const override = employeeHourlyOverride(employee);
      if (!override) continue;
      const employeeId = financeClean(employee.id);
      const rows = contractsByEmployee.get(employeeId) || [];
      rows.unshift(override);
      contractsByEmployee.set(employeeId, rows);
    }

    const payrollByEmployee = new Map<string, number>();
    const monthlyEmployees = new Set<string>();

    for (const employee of activeEmployees) {
      if (employee.payroll_in_scope === false) continue;
      const employeeId = financeClean(employee.id);
      const employeeContracts = contractsByEmployee.get(employeeId) || [];
      const monthlyContract = financeContractForDate(employeeContracts, range.to, 'monthly');

      if (monthlyContract) {
        const amount = financeNumber(monthlyContract.monthly_salary_chf);
        if (amount > 0) {
          payrollByEmployee.set(employeeId, amount);
          monthlyEmployees.add(employeeId);
        }
      }
    }

    for (const entry of timeEntries) {
      const employeeId = financeClean(entry.employee_id);
      if (!employeeId || monthlyEmployees.has(employeeId)) continue;
      const workDate = financeIsoDate(entry.work_date);
      if (!workDate) continue;

      const hourlyContract = financeContractForDate(
        contractsByEmployee.get(employeeId) || [],
        workDate,
        'hourly',
      );
      if (!hourlyContract) continue;

      const amount =
        (financeEntryMinutes(entry) / 60) * financeNumber(hourlyContract.hourly_rate_chf);
      payrollByEmployee.set(employeeId, (payrollByEmployee.get(employeeId) || 0) + amount);
    }

    const payrollDue = Array.from(payrollByEmployee.values()).reduce((sum, amount) => sum + amount, 0);

    const employeeName = (employee: FinanceRow) =>
      financeClean(employee.preferred_name) ||
      [financeClean(employee.legal_first_name), financeClean(employee.legal_last_name)].filter(Boolean).join(' ') ||
      'Mitarbeiter';

    const mapInvoicePreview = (invoice: FinanceRow): FinanceDocumentPreview => ({
      id: financeClean(invoice.id),
      title: financeClean(invoice.title) || 'Rechnung',
      number: financeClean(invoice.invoice_number) || 'Ohne Rechnungsnummer',
      status: financeNormalize(invoice.status) || 'open',
      amount: financeNumber(invoice.total_chf),
      balance: invoiceBalance(invoice),
      dateLabel: [
        formatDate(invoice.issue_date || invoice.created_at),
        invoice.due_date ? `fällig bis ${formatDate(invoice.due_date)}` : '',
      ].filter(Boolean).join(' · '),
      href: `${baseUrl}/rechnung/${financeClean(invoice.id)}`,
    });

    const mapQuotePreview = (quote: FinanceRow): FinanceDocumentPreview => ({
      id: financeClean(quote.id),
      title: financeClean(quote.title || quote.quote_type) || 'Offerte',
      number: financeClean(quote.quote_number) || 'Ohne Offertennummer',
      status: financeNormalize(quote.status) || 'draft',
      amount: financeNumber(quote.total_chf),
      dateLabel: [
        formatDate(quote.issue_date || quote.created_at),
        quote.valid_until ? `gültig bis ${formatDate(quote.valid_until)}` : '',
      ].filter(Boolean).join(' · '),
      href: `${baseUrl}/offerte/${financeClean(quote.id)}`,
    });

    const payroll = activeEmployees
      .map((employee) => ({
        id: financeClean(employee.id),
        name: employeeName(employee),
        amount: financeRound(payrollByEmployee.get(financeClean(employee.id)) || 0),
        status: employee.payroll_in_scope === false ? 'Nicht in Lohnabrechnung' : 'Aktueller Monat',
      }))
      .filter((employee) => employee.amount > 0 || employee.status !== 'Nicht in Lohnabrechnung')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 2);

    return {
      summary: {
        totalOutstanding: financeRound(totalOutstanding),
        openOutstanding: financeRound(openOutstanding),
        openInvoices: outstandingRows.length,
        overdueInvoices: overdueRows.length,
        openQuotes: openQuotes.length,
        monthlyRevenue: financeRound(monthlyRevenue),
        monthlyExpenses: 0,
        activeEmployees: activeEmployees.length,
        payrollDue: financeRound(payrollDue),
        expensesTracked: false,
      },
      previews: {
        invoices: latestInvoices.map(mapInvoicePreview).slice(0, 2),
        quotes: latestQuotes.map(mapQuotePreview).slice(0, 2),
        reminders: overdueRows
          .sort((a, b) => financeClean(a.invoice.due_date).localeCompare(financeClean(b.invoice.due_date)))
          .slice(0, 2)
          .map(({ invoice }) => mapInvoicePreview(invoice)),
        payroll,
      },
    };
  } catch (error) {
    console.warn('[OPC Dashboard] Direkte Finanzdaten konnten nicht geladen werden:', error);
    throw error;
  }
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
  value: number | string;
  subline?: string;
  icon: ReactNode;
  href: string;
  tone?: 'neutral' | 'danger' | 'dark';
}) {
  void tone;
  const valueColor = BRAND.text;

  return (
    <button
      type="button"
      onClick={() => navigateTo(href)}
      className="opc-dashboard-metric-card"
      aria-label={`${label}: ${value}${subline ? `. ${subline}` : ''}`}
      style={{
        ...cardStyle,
        minHeight: '96px',
        padding: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
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
            fontSize: '25px',
            lineHeight: 1,
            fontWeight: 820,
            letterSpacing: '-0.04em',
            color: valueColor,
            marginBottom: '10px',
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
            display: 'none',
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
        padding: '18px',
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
            fontWeight: 860,
            color: BRAND.text,
            letterSpacing: '-0.04em',
            lineHeight: 1.18,
            marginBottom: '9px',
          }}
        >
          {getJobCardTitle(job)}
        </div>

        <div
          className="opc-dashboard-job-details"
          style={{
            color: BRAND.muted,
            fontSize: '13px',
            fontWeight: 650,
            lineHeight: 1.35,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px 14px',
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

function MiniStat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <button
      type="button"
      onClick={() => navigateTo(href)}
      style={{
        width: '100%',
        height: '48px',
        border: `1px solid ${BRAND.border}`,
        borderRadius: '14px',
        background: '#FFFFFF',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        color: BRAND.text,
        fontFamily: pageFont,
        cursor: 'pointer',
      }}
    >
      <span style={{ color: BRAND.text, fontSize: '14px', fontWeight: 760 }}>{label}</span>
      <span style={{ color: BRAND.text, fontSize: '15px', fontWeight: 820 }}>{value}</span>
    </button>
  );
}

function FinanceTabButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        height: '48px',
        borderRadius: '14px',
        border: active ? `1px solid ${BRAND.black}` : `1px solid ${BRAND.border}`,
        background: active ? BRAND.black : '#FFFFFF',
        color: active ? '#FFFFFF' : BRAND.text,
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
      {label}
    </button>
  );
}

function FinanceDocumentPreviewCard({ item, kind }: { item: FinanceDocumentPreview; kind: 'invoice' | 'quote' }) {
  return (
    <article style={{ ...cardStyle, padding: '18px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: '18px',
          alignItems: 'start',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              color: BRAND.text,
              fontSize: '18px',
              lineHeight: 1.2,
              fontWeight: 840,
              letterSpacing: '-0.03em',
            }}
          >
            {item.title}
          </h3>
          <div
            style={{
              marginTop: '9px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px 14px',
              color: BRAND.muted,
              fontSize: '13px',
              lineHeight: 1.4,
              fontWeight: 650,
            }}
          >
            <span>{item.number}</span>
            <span>{item.dateLabel}</span>
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <StatusBadge status={item.status} />
          <div style={{ marginTop: '9px', color: BRAND.text, fontSize: '18px', fontWeight: 840 }}>
            {formatMoney(item.amount)}
          </div>
          {kind === 'invoice' ? (
            <div style={{ marginTop: '3px', color: BRAND.muted, fontSize: '12px', fontWeight: 680 }}>
              Offen: {formatMoney(item.balance || 0)}
            </div>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigateTo(item.href)}
        style={{
          marginTop: '16px',
          minHeight: '42px',
          padding: '0 16px',
          borderRadius: '13px',
          border: `1px solid ${BRAND.black}`,
          background: BRAND.black,
          color: '#FFFFFF',
          fontSize: '13px',
          fontWeight: 760,
          fontFamily: pageFont,
          cursor: 'pointer',
        }}
      >
        {kind === 'invoice' ? 'Rechnung öffnen' : 'Offerte öffnen'}
      </button>
    </article>
  );
}

function PayrollPreviewCard({ item }: { item: PayrollPreview }) {
  return (
    <article style={{ ...cardStyle, padding: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, color: BRAND.text, fontSize: '18px', fontWeight: 840, letterSpacing: '-0.03em' }}>
            {item.name}
          </h3>
          <div style={{ marginTop: '8px', color: BRAND.muted, fontSize: '13px', fontWeight: 650 }}>{item.status}</div>
        </div>
        <strong style={{ color: BRAND.text, fontSize: '19px', fontWeight: 840, whiteSpace: 'nowrap' }}>
          {formatMoney(item.amount)}
        </strong>
      </div>
    </article>
  );
}

function FinanceMoreButton({ href, label }: { href: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => navigateTo(href)}
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
      }}
    >
      {label}
      <ChevronRight size={16} />
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
  const bootstrapCache = useMemo(() => readDashboardBootstrapCache(), []);
  const bootstrapCore = bootstrapCache.core?.data || null;
  const bootstrapFinance = bootstrapCache.finance?.data || null;

  const [stats, setStats] = useState<DashboardStats>(() => ({
    ...EMPTY_DASHBOARD_STATS,
    ...(bootstrapCore?.stats || {}),
  }));
  const [finance, setFinance] = useState<FinanceSummary>(() => ({
    ...EMPTY_FINANCE_SUMMARY,
    ...(bootstrapFinance?.finance || {}),
  }));
  const [financePreviews, setFinancePreviews] = useState<FinancePreviewData>(() => ({
    ...EMPTY_FINANCE_PREVIEWS,
    ...(bootstrapFinance?.financePreviews || {}),
  }));
  const [activeFinanceTab, setActiveFinanceTab] = useState<FinancePreviewTab>('invoices');
  const [financeLoading, setFinanceLoading] = useState(() => !bootstrapFinance);

  const [jobs, setJobs] = useState<ServiceJob[]>(() => bootstrapCore?.jobs || []);
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => bootstrapCore?.activeTab || 'today');
  const [loading, setLoading] = useState(() => !bootstrapCore);

  useEffect(() => {
    const coreFresh = dashboardPersistentSliceIsFresh(
      bootstrapCache.core,
      DASHBOARD_CORE_TTL_MS,
    );
    const financeFresh = dashboardPersistentSliceIsFresh(
      bootstrapCache.finance,
      DASHBOARD_FINANCE_TTL_MS,
    );

    // The eight top cards are already painted synchronously from localStorage.
    // When missing or stale, refresh them immediately instead of waiting for idle time.
    if (!coreFresh) {
      void loadData({ background: Boolean(bootstrapCore) });
    } else {
      setLoading(false);
    }

    let financeTimer = 0;

    if (!financeFresh) {
      // Finance never blocks authentication or the first eight cards. It starts on
      // a deterministic short delay and keeps a stale snapshot visible while refreshing.
      financeTimer = window.setTimeout(() => {
        void loadFinanceData({ background: Boolean(bootstrapFinance) });
      }, bootstrapCore ? 700 : 1100);
    } else {
      setFinanceLoading(false);
    }

    return () => {
      if (financeTimer) window.clearTimeout(financeTimer);
    };
  }, []);

  async function loadData(options: { background?: boolean } = {}) {
    const isBackground = Boolean(options.background);

    if (!isBackground) setLoading(true);

    try {
      // The eight top cards are the authentication priority. Inbox data is
      // started separately and must not delay those cards.
      const inboxPromise = readList<InboxMessage>('opc_my_conversation_inbox', '*', 80)
        .catch((error) => {
          console.warn('[OPC Dashboard] Nachrichtenzähler konnte nicht geladen werden:', error);
          return null as InboxMessage[] | null;
        });

      const [jobsData, reportsData, inquiriesData, ticketsData] = await Promise.all([
        readList<ServiceJob>('opc_my_portal_job_feed', '*', 180),
        readList<ReportItem>('opc_portal_report_feed', '*', 120),
        readList<InquiryItem>('opc_portal_onboarding_cards', '*', 120),
        readList<TicketItem>('opc_tickets', '*', 120),
      ]);

      const [jobTimeLogsData, employeeTimeEntriesData, staffRows] =
        await Promise.all([
          readList<TimeLogItem>('opc_job_time_logs', '*', 120),
          readList<TimeLogItem>('opc_employee_time_entries', '*', 120),
          readList<StaffIdentityItem>(
            'opc_staff_roles',
            'id,employee_id,user_id',
            120,
          ),
        ]);

      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      const weekStart = startOfWeek(now);
      const weekEnd = endOfWeek(now);

      const uniqueJobs = dedupeLatest(jobsData, (job, index) => job.job_id || `job-${index}`);
      const uniqueReports = dedupeLatest(
        reportsData,
        (report, index) => report.report_id || report.job_id || `report-${index}`,
      );
      const uniqueInquiries = dedupeLatest(
        inquiriesData,
        (inquiry, index) => inquiry.inquiry_id || inquiry.id || `inquiry-${index}`,
      );
      const uniqueTickets = dedupeLatest(
        ticketsData,
        (ticket, index) => ticket.ticket_id || ticket.id || `ticket-${index}`,
      );

      const visibleJobs = uniqueJobs.filter((job) => !isStaleHistoricJob(job, now));
      const operationalJobs = visibleJobs.filter((job) => !isClosedJob(job));

      const todayJobs = operationalJobs.filter((job) => {
        if (!job.planned_start) return false;
        const planned = new Date(job.planned_start);
        return planned >= todayStart && planned <= todayEnd;
      });

      // OPC_DASHBOARD_WEEK_ALL_PLANNED_V1
      // The weekly dashboard covers every job scheduled for this calendar week:
      // planned, assigned, live and completed. It is no longer a completion-only metric.
      const weekJobs = visibleJobs.filter((job) => {
        if (!job.planned_start) return false;
        const planned = new Date(job.planned_start);
        return planned >= weekStart && planned <= weekEnd;
      });

      const liveJobs = operationalJobs.filter((job) => isLiveJob(job, now));
      const liveJobIds = new Set(liveJobs.map((job) => job.job_id));
      const overdueJobs = operationalJobs.filter((job) => {
        if (liveJobIds.has(job.job_id)) return false;
        if (normalizeStatus(job.status) === 'report_pending') return false;

        const dueValue = job.planned_end || job.planned_start;
        if (!dueValue) return false;

        const dueAt = new Date(dueValue).getTime();
        return Number.isFinite(dueAt) && dueAt < now.getTime();
      });

      const openReports = uniqueReports.filter(isOpenReport);
      const newInquiries = uniqueInquiries.filter(isNewInquiry);
      const openTickets = uniqueTickets.filter(isOpenTicket);
      const activeEmployees = countActiveEmployees(
        [...employeeTimeEntriesData, ...jobTimeLogsData],
        staffRows,
        now,
      );
      // Keep the previous unread value for the first-card paint. The inbox result
      // updates the secondary attention area immediately after the core snapshot.
      const unreadMessages = stats.unreadMessages;

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

      const nextActiveTab: DashboardTab = todayJobs.length > 0
        ? 'today'
        : liveJobs.length > 0
          ? 'live'
          : weekJobs.length > 0
            ? 'week'
            : 'reports';

      setActiveTab(nextActiveTab);

      writeDashboardPersistentSlice<DashboardCoreSnapshotData>(
        DASHBOARD_CORE_CACHE_KEY,
        {
          stats: nextStats,
          jobs: sortedVisibleJobs,
          activeTab: nextActiveTab,
        },
      );

      void inboxPromise
        .then((inboxData) => {
          if (!inboxData) return;

          const nextUnreadMessages = inboxData.filter((message) => Boolean(message.unread)).length;

          setStats((currentStats) => {
            const nextStatsWithInbox: DashboardStats = {
              ...currentStats,
              unreadMessages: nextUnreadMessages,
              urgentItems:
                currentStats.overdueJobs +
                currentStats.openReports +
                currentStats.newInquiries +
                currentStats.openTickets +
                nextUnreadMessages,
            };

            const currentCore = readDashboardPersistentSlice<DashboardCoreSnapshotData>(
              DASHBOARD_CORE_CACHE_KEY,
            );

            writeDashboardPersistentSlice<DashboardCoreSnapshotData>(
              DASHBOARD_CORE_CACHE_KEY,
              {
                stats: nextStatsWithInbox,
                jobs: currentCore?.data.jobs || sortedVisibleJobs,
                activeTab: currentCore?.data.activeTab || nextActiveTab,
              },
            );

            return nextStatsWithInbox;
          });
        });
    } catch (error) {
      console.error('Error loading OPC dashboard:', error);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }

  async function loadFinanceData(options: { background?: boolean } = {}) {
    if (!options.background) setFinanceLoading(true);

    try {
      const result = await readFinanceDashboardDirect();
      setFinance(result.summary);
      setFinancePreviews(result.previews);

      writeDashboardPersistentSlice<DashboardFinanceSnapshotData>(
        DASHBOARD_FINANCE_CACHE_KEY,
        {
          finance: result.summary,
          financePreviews: result.previews,
        },
      );
    } catch (error) {
      // Keep the last valid snapshot visible and retry on a later dashboard visit.
      console.warn('[OPC Dashboard] Finanzvorschau konnte nicht aktualisiert werden:', error);
    } finally {
      setFinanceLoading(false);
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
        return bTime - aTime;
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
        return bTime - aTime;
      });
  }, [jobs]);

  const weekJobs = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);

    return jobs
      .filter((job) => {
        if (!job.planned_start) return false;
        const planned = new Date(job.planned_start);
        return planned >= weekStart && planned <= weekEnd;
      })
      .sort((a, b) => {
        const aTime = a.planned_start ? new Date(a.planned_start).getTime() : 0;
        const bTime = b.planned_start ? new Date(b.planned_start).getTime() : 0;
        return bTime - aTime;
      });
  }, [jobs]);

  const overdueJobs = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now);

    return jobs
      .filter((job) => !isClosedJob(job))
      .filter((job) => {
        if (!job.planned_start) return false;
        const planned = new Date(job.planned_start);
        return planned >= weekStart && planned < todayStart;
      })
      .sort((a, b) => {
        const aTime = a.planned_start ? new Date(a.planned_start).getTime() : 0;
        const bTime = b.planned_start ? new Date(b.planned_start).getTime() : 0;
        return bTime - aTime;
      });
  }, [jobs]);

  const reportJobs = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);

    return jobs
      .filter((job) => isOpenReportStatus(job.report_status))
      .filter((job) => {
        const relevantDate = job.planned_start || job.updated_at;
        if (!relevantDate) return false;
        const date = new Date(relevantDate);
        return date >= weekStart && date <= weekEnd;
      })
      .sort((a, b) => {
        const aTime = new Date(a.planned_start || a.updated_at || 0).getTime();
        const bTime = new Date(b.planned_start || b.updated_at || 0).getTime();
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
    week: 'In dieser Woche sind keine Einsätze geplant.',
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
    <div className="opc-dashboard-page" style={{ fontFamily: pageFont }}>
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
        <main style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '12px',
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
              label="Offene Anfragen"
              value={stats.newInquiries}
              subline="Kundenanfragen & Bewerbungen"
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
              subline="Geplant diese Woche"
              icon={<Clock3 size={17} />}
              href={`${baseUrl}/einsaetze?filter=week`}
            />
          </div>

          <section className="opc-dashboard-jobs-section">
            <div className="opc-dashboard-list-heading">
              <h2 style={sectionTitleStyle}>Einsätze</h2>

              <button
                type="button"
                onClick={() => navigateTo(`${baseUrl}/einsaetze`)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  minHeight: '42px',
                  padding: '0 16px',
                  borderRadius: '13px',
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
                Alle Einsätze
                <ChevronRight size={15} />
              </button>
            </div>

            <div style={{ marginTop: '16px' }}>
              <DashboardTabs activeTab={activeTab} onChange={setActiveTab} counts={tabCounts} />
            </div>

            {tabJobs.length === 0 ? (
              <div style={{ marginTop: '14px' }}>
                <EmptyState text={tabEmptyText[activeTab]} />
              </div>
            ) : (
              <div
                className="opc-dashboard-job-list"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  maxHeight: '680px',
                  overflowY: 'auto',
                  padding: '14px 4px 2px 0',
                }}
              >
                {tabJobs.slice(0, 20).map((job) => (
                  <JobCard key={job.job_id} job={job} />
                ))}
              </div>
            )}
          </section>

          <div className="opc-dashboard-list-heading opc-finance-heading">
            <h2 style={sectionTitleStyle}>Finanzen</h2>

            <button
              type="button"
              onClick={() => navigateTo(`${baseUrl}/finanzen`)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                minHeight: '42px',
                padding: '0 16px',
                borderRadius: '13px',
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
              Alle Finanzen
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="opc-finance-metric-grid">
            <MetricCard
              label="Geschuldet gesamt"
              value={formatMoney(finance.totalOutstanding)}
              icon={<HandCoins size={17} />}
              href={`${baseUrl}/rechnung?filter=open`}
            />
            <MetricCard
              label="Offen, nicht überfällig"
              value={formatMoney(finance.openOutstanding)}
              icon={<Banknote size={17} />}
              href={`${baseUrl}/rechnung?filter=open`}
            />
            <MetricCard
              label="Offene Rechnungen"
              value={finance.openInvoices}
              icon={<ReceiptText size={17} />}
              href={`${baseUrl}/rechnung?filter=open`}
            />
            <MetricCard
              label="Überfällige Rechnungen"
              value={finance.overdueInvoices}
              icon={<AlertTriangle size={17} />}
              href={`${baseUrl}/rechnung?filter=overdue`}
            />
            <MetricCard
              label="Offene Offerten"
              value={finance.openQuotes}
              icon={<FileText size={17} />}
              href={`${baseUrl}/offerten?filter=open`}
            />
            <MetricCard
              label="Monatseinnahmen"
              value={formatMoney(finance.monthlyRevenue)}
              icon={<WalletCards size={17} />}
              href={`${baseUrl}/finanzen`}
            />
            <MetricCard
              label={finance.expensesTracked ? 'Monatsausgaben' : 'Monatsausgaben'}
              value={formatMoney(finance.monthlyExpenses)}
              icon={<Banknote size={17} />}
              href={`${baseUrl}/finanzen?section=expenses`}
            />
            <MetricCard
              label="Mitarbeiter gesamt"
              value={finance.activeEmployees}
              icon={<Users size={17} />}
              href={`${baseUrl}/mitarbeiter`}
            />
            <MetricCard
              label="Löhne dieses Monats"
              value={formatMoney(finance.payrollDue)}
              icon={<HandCoins size={17} />}
              href={`${baseUrl}/finanzen?section=payroll`}
            />
          </div>

          <div className="opc-finance-actions-grid" aria-label="Finanzvorschau auswählen">
            <FinanceTabButton
              active={activeFinanceTab === 'invoices'}
              label="Rechnungen"
              icon={<ReceiptText size={17} />}
              onClick={() => setActiveFinanceTab('invoices')}
            />
            <FinanceTabButton
              active={activeFinanceTab === 'quotes'}
              label="Offerten"
              icon={<FileText size={17} />}
              onClick={() => setActiveFinanceTab('quotes')}
            />
            <FinanceTabButton
              active={activeFinanceTab === 'payroll'}
              label="Löhne"
              icon={<HandCoins size={17} />}
              onClick={() => setActiveFinanceTab('payroll')}
            />
            <FinanceTabButton
              active={activeFinanceTab === 'finance'}
              label="Finanzen"
              icon={<WalletCards size={17} />}
              onClick={() => setActiveFinanceTab('finance')}
            />
            <FinanceTabButton
              active={activeFinanceTab === 'reminders'}
              label="Mahnungen"
              icon={<AlertTriangle size={17} />}
              onClick={() => setActiveFinanceTab('reminders')}
            />
          </div>

          <section className="opc-finance-preview-section" aria-live="polite">
            {financeLoading &&
            financePreviews.invoices.length === 0 &&
            financePreviews.quotes.length === 0 &&
            financePreviews.payroll.length === 0 ? (
              <EmptyState text="Finanzvorschau wird geladen …" />
            ) : activeFinanceTab === 'invoices' ? (
              <>
                <div className="opc-finance-preview-list">
                  {financePreviews.invoices.length ? (
                    financePreviews.invoices.map((item) => (
                      <FinanceDocumentPreviewCard key={item.id} item={item} kind="invoice" />
                    ))
                  ) : (
                    <EmptyState text="Keine Rechnungen für die Vorschau gefunden." />
                  )}
                </div>
                <FinanceMoreButton href={`${baseUrl}/rechnungen`} label="Weitere Rechnungen" />
              </>
            ) : activeFinanceTab === 'quotes' ? (
              <>
                <div className="opc-finance-preview-list">
                  {financePreviews.quotes.length ? (
                    financePreviews.quotes.map((item) => (
                      <FinanceDocumentPreviewCard key={item.id} item={item} kind="quote" />
                    ))
                  ) : (
                    <EmptyState text="Keine Offerten für die Vorschau gefunden." />
                  )}
                </div>
                <FinanceMoreButton href={`${baseUrl}/offerten`} label="Weitere Offerten" />
              </>
            ) : activeFinanceTab === 'payroll' ? (
              <>
                <div className="opc-finance-preview-list">
                  {financePreviews.payroll.length ? (
                    financePreviews.payroll.map((item) => <PayrollPreviewCard key={item.id} item={item} />)
                  ) : (
                    <EmptyState text="Für diesen Monat ist noch keine Lohnvorschau verfügbar." />
                  )}
                </div>
                <FinanceMoreButton href={`${baseUrl}/finanzen?section=payroll`} label="Löhne öffnen" />
              </>
            ) : activeFinanceTab === 'reminders' ? (
              <>
                <div className="opc-finance-preview-list">
                  {financePreviews.reminders.length ? (
                    financePreviews.reminders.map((item) => (
                      <FinanceDocumentPreviewCard key={item.id} item={item} kind="invoice" />
                    ))
                  ) : (
                    <EmptyState text="Keine überfälligen Rechnungen gefunden." />
                  )}
                </div>
                <FinanceMoreButton href={`${baseUrl}/rechnungen?filter=overdue`} label="Mahnungen öffnen" />
              </>
            ) : (
              <>
                <div className="opc-finance-overview-preview">
                  <MetricCard
                    label="Monatseinnahmen"
                    value={formatMoney(finance.monthlyRevenue)}
                    icon={<WalletCards size={17} />}
                    href={`${baseUrl}/finanzen`}
                  />
                  <MetricCard
                    label="Geschuldet gesamt"
                    value={formatMoney(finance.totalOutstanding)}
                    icon={<HandCoins size={17} />}
                    href={`${baseUrl}/finanzen`}
                  />
                </div>
                <FinanceMoreButton href={`${baseUrl}/finanzen`} label="Finanzen öffnen" />
              </>
            )}
          </section>
        </main>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
          <section style={{ ...cardStyle, padding: '20px' }}>
            <h2 style={{ ...sectionTitleStyle, marginBottom: '16px' }}>Schnellaktionen</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
              <ActionButton href={`${baseUrl}/einsatz-planen`} icon={<Plus size={17} />} label="Einsatz planen" dark />
              <ActionButton href={`${baseUrl}/kunde-anlegen`} icon={<Users size={17} />} label="Kunde anlegen" />
              <ActionButton href={`${baseUrl}/berichte-dateien`} icon={<Upload size={17} />} label="Bericht prüfen" />
              <ActionButton href={`${baseUrl}/anfragen`} icon={<MessageSquare size={17} />} label="Anfragen öffnen" />
            </div>
          </section>

          <section style={{ ...cardStyle, padding: '20px' }}>
            <h2 style={{ ...sectionTitleStyle, marginBottom: '16px' }}>Aufmerksamkeit</h2>

            <div style={{ display: 'grid', gap: '10px' }}>
              <MiniStat
                label="Überfällige Einsätze"
                value={stats.overdueJobs}
                href={`${baseUrl}/einsaetze?filter=overdue`}
              />
              <MiniStat
                label="Offene Berichte"
                value={stats.openReports}
                href={`${baseUrl}/berichte-dateien?filter=open`}
              />
              <MiniStat
                label="Ungelesene Nachrichten"
                value={stats.unreadMessages}
                href={`${baseUrl}/anfragen?filter=unread`}
              />
            </div>
          </section>
        </aside>
      </div>

      <style>{`
        .opc-dashboard-page {
          padding: 0 0 140px;
          color: ${BRAND.text};
          font-family: ${pageFont} !important;
        }

        .opc-dashboard-page,
        .opc-dashboard-page * {
          box-sizing: border-box;
          font-family: ${pageFont} !important;
        }

        .opc-dashboard-page button,
        .opc-dashboard-page a,
        .opc-dashboard-page input,
        .opc-dashboard-page select,
        .opc-dashboard-page textarea {
          font-family: ${pageFont} !important;
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

        .opc-dashboard-job-list {
          scrollbar-width: thin;
          scrollbar-color: ${BRAND.borderStrong} transparent;
        }

        .opc-dashboard-job-list::-webkit-scrollbar {
          width: 8px;
        }

        .opc-dashboard-job-list::-webkit-scrollbar-thumb {
          background: ${BRAND.borderStrong};
          border-radius: 999px;
        }

        .opc-finance-heading {
          margin-top: 8px;
        }

        .opc-finance-metric-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .opc-finance-actions-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
        }

        .opc-finance-preview-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .opc-finance-preview-list {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .opc-finance-overview-preview {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
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

          .opc-finance-metric-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }

          .opc-finance-actions-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
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
            gap: 12px !important;
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

          .opc-finance-metric-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .opc-finance-actions-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 560px) {
          .opc-dashboard-page {
            padding-bottom: 120px !important;
          }

          .opc-metric-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 12px !important;
          }

          .opc-metric-grid > * {
            min-width: 0 !important;
          }

          .opc-dashboard-metric-card {
            min-height: 96px !important;
            padding: 18px !important;
          }

          .opc-dashboard-metric-card > div:first-child > div:first-child {
            font-size: 25px !important;
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
            font-size: 18px !important;
            font-weight: 860 !important;
            letter-spacing: -0.04em !important;
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

          .opc-dashboard-jobs-section {
            padding: 16px !important;
          }

          .opc-finance-metric-grid,
          .opc-finance-actions-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}