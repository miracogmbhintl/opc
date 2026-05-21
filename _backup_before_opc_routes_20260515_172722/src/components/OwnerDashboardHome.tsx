import { useState, useEffect, lazy, Suspense } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import {
  Clock,
  XCircle,
  Users,
  FolderOpen,
  Ticket,
  ChevronRight,
  Plus,
  Upload,
  FileSpreadsheet,
  Calendar,
  AlertTriangle,
  Briefcase,
  MessageSquare,
} from 'lucide-react';

const ProjectPipelineChart = lazy(() => import('./widgets/shared/ProjectPipelineChart'));

interface DashboardStats {
  totalClients: number;
  activeJobs: number;
  scheduledJobs: number;
  openReports: number;
  unreadMessages: number;
  urgentItems: number;
  completedThisMonth: number;
  jobsThisWeek: number;
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

interface ClientCard {
  client_id: string;
  billing_name?: string | null;
  company_name?: string | null;
  full_name?: string | null;
  site_name?: string | null;
  primary_site_name?: string | null;
  city?: string | null;
  primary_site_city?: string | null;
}

interface InboxMessage {
  conversation_id?: string;
  thread_id?: string;
  participant_name?: string | null;
  sender_display?: string | null;
  last_message?: string | null;
  message_text_original?: string | null;
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

interface StatusItem {
  status: string;
  count: number;
  color: string;
}

interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
}

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
  sent_to_client: 'An Kunde gesendet',
  approved: 'Freigegeben',
};

const statusColors: Record<string, { bg: string; text: string; chart: string }> = {
  scheduled: { bg: '#DBEAFE', text: '#1E40AF', chart: '#3B82F6' },
  assigned: { bg: '#E0F2FE', text: '#075985', chart: '#0284C7' },
  confirmed: { bg: '#EDE9FE', text: '#5B21B6', chart: '#8B5CF6' },
  on_site: { bg: '#FEF3C7', text: '#92400E', chart: '#F59E0B' },
  onsite: { bg: '#FEF3C7', text: '#92400E', chart: '#F59E0B' },
  in_progress: { bg: '#FFEDD5', text: '#9A3412', chart: '#F97316' },
  completed: { bg: '#DCFCE7', text: '#166534', chart: '#22C55E' },
  report_pending: { bg: '#FEF9C3', text: '#854D0E', chart: '#EAB308' },
  report_approved: { bg: '#D1FAE5', text: '#065F46', chart: '#10B981' },
  cancelled: { bg: '#FEE2E2', text: '#991B1B', chart: '#EF4444' },
  draft: { bg: '#F3F4F6', text: '#374151', chart: '#9CA3AF' },
  sent_to_client: { bg: '#EEF2FF', text: '#3730A3', chart: '#6366F1' },
  approved: { bg: '#DCFCE7', text: '#166534', chart: '#22C55E' },
};

function getNumberMetric(source: any, keys: string[], fallback = 0): number {
  if (!source) return fallback;

  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }

  return fallback;
}

function formatStatus(status?: string | null): string {
  if (!status) return 'Unbekannt';
  return statusLabels[status] || status.replace(/_/g, ' ');
}

function getStatusStyle(status?: string | null) {
  if (!status) return { bg: '#F3F4F6', text: '#374151', chart: '#9CA3AF' };
  return statusColors[status] || { bg: '#F3F4F6', text: '#374151', chart: '#9CA3AF' };
}

function formatDateTime(dateString?: string | null) {
  if (!dateString) return '-';

  return new Date(dateString).toLocaleString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(dateString?: string | null) {
  if (!dateString) return '-';

  return new Date(dateString).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: 'short',
  });
}

function getTimeDistance(dateString?: string | null) {
  if (!dateString) return 'Kein Datum';

  const target = new Date(dateString);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `${Math.abs(diffDays)} Tage überfällig`;
  if (diffDays === 0) return 'Heute';
  if (diffDays === 1) return 'Morgen';
  return `in ${diffDays} Tagen`;
}

async function readList<T>(table: string, select = '*', limit = 50): Promise<T[]> {
  const { data, error } = await supabase.from(table).select(select).limit(limit);

  if (error) {
    console.warn(`[OwnerDashboardHome] ${table} konnte nicht geladen werden:`, error.message);
    return [];
  }

  return (data || []) as T[];
}

async function readSingle(table: string, select = '*'): Promise<any | null> {
  const { data, error } = await supabase.from(table).select(select).maybeSingle();

  if (error) {
    console.warn(`[OwnerDashboardHome] ${table} konnte nicht geladen werden:`, error.message);
    return null;
  }

  return data;
}

export default function OwnerDashboardHome() {
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    activeJobs: 0,
    scheduledJobs: 0,
    openReports: 0,
    unreadMessages: 0,
    urgentItems: 0,
    completedThisMonth: 0,
    jobsThisWeek: 0,
  });

  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [clients, setClients] = useState<ClientCard[]>([]);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [jobStatuses, setJobStatuses] = useState<StatusItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    try {
      const [metricsData, jobsData, clientsData, inboxData, reportsData] = await Promise.all([
        readSingle('opc_portal_dashboard_metrics'),
        readList<ServiceJob>('opc_my_portal_job_feed', '*', 80),
        readList<ClientCard>('opc_portal_client_cards', '*', 40),
        readList<InboxMessage>('opc_my_conversation_inbox', '*', 20),
        readList<ReportItem>('opc_portal_report_feed', '*', 40),
      ]);

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const activeJobCount = jobsData.filter(
        (job) => !['completed', 'cancelled', 'report_approved'].includes(job.status)
      ).length;

      const scheduledJobCount = jobsData.filter((job) =>
        ['scheduled', 'assigned', 'confirmed'].includes(job.status)
      ).length;

      const completedThisMonth = jobsData.filter((job) => {
        if (job.status !== 'completed' || !job.planned_end) return false;
        return new Date(job.planned_end) >= firstDayOfMonth;
      }).length;

      const jobsThisWeek = jobsData.filter((job) => {
        if (!job.planned_start) return false;
        return new Date(job.planned_start) >= oneWeekAgo;
      }).length;

      const openReports = reportsData.filter((report) => {
        const status = report.report_status || report.status;
        return status && !['approved', 'sent_to_client'].includes(status);
      }).length;

      const unreadMessages = inboxData.filter((message) => Boolean(message.unread)).length;

      const urgentItems = jobsData.filter((job) => {
        if (!job.planned_start) return false;
        const date = new Date(job.planned_start);
        return (
          date < now &&
          !['completed', 'cancelled', 'report_approved'].includes(job.status)
        );
      }).length;

      setStats({
        totalClients: getNumberMetric(metricsData, ['total_clients', 'client_count'], clientsData.length),
        activeJobs: getNumberMetric(metricsData, ['active_jobs', 'open_jobs'], activeJobCount),
        scheduledJobs: getNumberMetric(metricsData, ['scheduled_jobs'], scheduledJobCount),
        openReports: getNumberMetric(metricsData, ['open_reports', 'pending_reports'], openReports),
        unreadMessages: getNumberMetric(metricsData, ['unread_messages'], unreadMessages),
        urgentItems: getNumberMetric(metricsData, ['urgent_items', 'overdue_jobs'], urgentItems),
        completedThisMonth: getNumberMetric(metricsData, ['completed_this_month'], completedThisMonth),
        jobsThisWeek: getNumberMetric(metricsData, ['jobs_this_week'], jobsThisWeek),
      });

      const sortedJobs = [...jobsData].sort((a, b) => {
        const aTime = a.planned_start ? new Date(a.planned_start).getTime() : 0;
        const bTime = b.planned_start ? new Date(b.planned_start).getTime() : 0;
        return bTime - aTime;
      });

      setJobs(sortedJobs.slice(0, 10));
      setClients(clientsData.slice(0, 8));
      setMessages(inboxData.slice(0, 6));
      setReports(reportsData.slice(0, 8));

      const statusCounts: Record<string, number> = {};
      jobsData.forEach((job) => {
        const status = job.status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      setJobStatuses(
        Object.entries(statusCounts)
          .map(([status, count]) => ({
            status,
            count,
            color: getStatusStyle(status).chart,
          }))
          .sort((a, b) => b.count - a.count)
      );

      const activity: ActivityItem[] = [];

      sortedJobs.slice(0, 3).forEach((job) => {
        activity.push({
          id: `job-${job.job_id}`,
          actor: job.billing_name || job.site_name || 'Einsatz',
          action: 'hat einen Einsatz im Status',
          target: formatStatus(job.status),
          time: formatDateTime(job.planned_start),
        });
      });

      inboxData.slice(0, 2).forEach((message, index) => {
        activity.push({
          id: `message-${message.conversation_id || message.thread_id || index}`,
          actor: message.participant_name || message.sender_display || 'Nachricht',
          action: 'hat eine Nachricht gesendet',
          target: message.last_message || message.message_text_original || 'Ohne Text',
          time: formatDateTime(message.last_message_at || message.created_at),
        });
      });

      setRecentActivity(activity);
    } catch (error) {
      console.error('Error loading OPC dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status?: string | null) => {
    const colors = getStatusStyle(status);

    return (
      <span
        style={{
          display: 'inline-block',
          padding: '4px 11px',
          borderRadius: '10px',
          fontSize: '13px',
          fontWeight: 700,
          background: colors.bg,
          color: colors.text,
          textTransform: 'uppercase',
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
        }}
      >
        {formatStatus(status)}
      </span>
    );
  };

  if (loading) {
    return null;
  }

  const totalJobs = jobStatuses.reduce((sum, status) => sum + status.count, 0);
  const attentionCount = stats.urgentItems + stats.openReports + stats.unreadMessages;

  const chartData = jobStatuses
    .filter((status) => status.count > 0)
    .map((status) => ({
      name: formatStatus(status.status),
      value: status.count,
      color: status.color,
    }));

  const upcomingJobs = jobs
    .filter((job) => job.planned_start && !['completed', 'cancelled'].includes(job.status))
    .sort((a, b) => new Date(a.planned_start || '').getTime() - new Date(b.planned_start || '').getTime())
    .slice(0, 5);

  return (
    <div style={{ padding: '0', paddingBottom: '140px' }}>
      <div className="dashboard-header" style={{ marginBottom: '18px' }}>
        <h1
          style={{
            fontSize: '34px',
            fontWeight: 700,
            color: '#1A1A1A',
            margin: '0 0 6px 0',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
            letterSpacing: '-0.03em',
          }}
        >
          Orange Pro Clean Dashboard
        </h1>
        <p
          style={{
            fontSize: '16px',
            color: '#6B7280',
            margin: 0,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
            fontWeight: 600,
            letterSpacing: '0.01em',
          }}
        >
          {stats.activeJobs} AKTIVE EINSÄTZE • {stats.openReports} OFFENE BERICHTE •{' '}
          {attentionCount} BRAUCHEN AUFMERKSAMKEIT
        </p>
      </div>

      {upcomingJobs.length > 0 && (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '18px',
            padding: '20px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              marginBottom: '16px',
            }}
          >
            <Calendar size={20} style={{ color: '#1A1A1A' }} />
            <h3
              style={{
                fontSize: '20px',
                fontWeight: 800,
                color: '#1A1A1A',
                margin: 0,
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
                letterSpacing: '-0.01em',
              }}
            >
              Nächste Einsätze
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {upcomingJobs.map((job) => (
              <div
                key={job.job_id}
                onClick={() =>
                  (window.location.href = `${baseUrl}/miraka-co-portal/project/${job.job_id}`)
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  background: '#FAFBFC',
                  borderRadius: '12px',
                  border: '1px solid #E5E7EB',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#F3F4F6';
                  e.currentTarget.style.borderColor = '#1A1A1A';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#FAFBFC';
                  e.currentTarget.style.borderColor = '#E5E7EB';
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#1A1A1A',
                      margin: '0 0 4px 0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {job.title || job.service_category || 'Einsatz'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '14px', color: '#6B7280', fontWeight: 600 }}>
                      {job.billing_name || job.site_name || '-'}
                    </span>
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: 800,
                        color:
                          job.planned_start && new Date(job.planned_start) < new Date()
                            ? '#EF4444'
                            : '#6B7280',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {getTimeDistance(job.planned_start)}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    marginLeft: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    flexShrink: 0,
                  }}
                >
                  {getStatusBadge(job.status)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        {[
          { label: 'Aktive Einsätze', value: stats.activeJobs, color: '#1A1A1A' },
          { label: 'Kunden', value: stats.totalClients, color: '#1A1A1A' },
          { label: 'Einsätze diese Woche', value: stats.jobsThisWeek, color: '#1A1A1A' },
          { label: 'Abgeschlossen diesen Monat', value: stats.completedThisMonth, color: '#22C55E' },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '16px',
              padding: '18px 20px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div
              style={{
                fontSize: '13px',
                color: '#6B7280',
                marginBottom: '8px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {item.label}
            </div>
            <div style={{ fontSize: '44px', fontWeight: 800, color: item.color, lineHeight: 1 }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '18px',
          padding: '24px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
        }}
      >
        <h3
          style={{
            fontSize: '22px',
            fontWeight: 800,
            color: '#1A1A1A',
            margin: '0 0 24px 0',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
            letterSpacing: '-0.01em',
          }}
        >
          Einsatzstatus
        </h3>

        {chartData.length > 0 ? (
          <div
            className="pipeline-chart-container"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px',
            }}
          >
            <Suspense
              fallback={
                <div
                  style={{
                    width: '100%',
                    maxWidth: '280px',
                    height: '280px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6B7280',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      border: '3px solid #E5E7EB',
                      borderTopColor: '#1A1A1A',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                </div>
              }
            >
              <ProjectPipelineChart data={chartData} totalProjects={totalJobs} />
            </Suspense>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                width: '100%',
              }}
            >
              {jobStatuses.map((status) => (
                <div
                  key={status.status}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    background: '#FAFBFC',
                    borderRadius: '10px',
                    border: '1px solid #E5E7EB',
                  }}
                >
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '3px',
                      background: status.color,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#1A1A1A',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatStatus(status.status)}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: '17px',
                      fontWeight: 800,
                      color: '#1A1A1A',
                      flexShrink: 0,
                    }}
                  >
                    {status.count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, color: '#6B7280', fontWeight: 600 }}>
            Noch keine Einsatzdaten vorhanden.
          </p>
        )}
      </div>

      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '18px',
          padding: '24px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
        }}
      >
        <h3
          style={{
            fontSize: '22px',
            fontWeight: 800,
            color: '#1A1A1A',
            margin: '0 0 18px 0',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
            letterSpacing: '-0.01em',
          }}
        >
          Schnellaktionen
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
          }}
        >
          <a
            href={`${baseUrl}/miraka-co-portal/create-client`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '0',
              height: '62px',
              background: '#1A1A1A',
              color: '#FFFFFF',
              fontSize: '16px',
              fontWeight: 700,
              borderRadius: '18px',
              textDecoration: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
            }}
          >
            <Users size={19} />
            <span>Kunde anlegen</span>
          </a>

          <a
            href={`${baseUrl}/miraka-co-portal/create-project`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '0',
              height: '62px',
              background: '#F3F4F6',
              color: '#1A1A1A',
              fontSize: '16px',
              fontWeight: 700,
              borderRadius: '18px',
              textDecoration: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
            }}
          >
            <Plus size={19} />
            <span>Einsatz planen</span>
          </a>

          <a
            href={`${baseUrl}/miraka-co-portal/files`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '0',
              height: '62px',
              background: '#F3F4F6',
              color: '#1A1A1A',
              fontSize: '16px',
              fontWeight: 700,
              borderRadius: '18px',
              textDecoration: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
            }}
          >
            <Upload size={19} />
            <span>Dateien hochladen</span>
          </a>

          <a
            href={`${baseUrl}/miraka-co-portal/tickets`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '0',
              height: '62px',
              background: '#F3F4F6',
              color: '#1A1A1A',
              fontSize: '16px',
              fontWeight: 700,
              borderRadius: '18px',
              textDecoration: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
            }}
          >
            <Ticket size={19} />
            <span>Anfrage / Schaden</span>
          </a>
        </div>
      </div>

      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '18px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <h3
            style={{
              fontSize: '20px',
              fontWeight: 800,
              color: '#1A1A1A',
              margin: 0,
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
              letterSpacing: '-0.01em',
            }}
          >
            Aktuelle Einsätze
          </h3>

          <a
            href={`${baseUrl}/miraka-co-portal/projects`}
            style={{
              fontSize: '15px',
              color: '#1A1A1A',
              textDecoration: 'none',
              fontWeight: 700,
              transition: 'opacity 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>Alle anzeigen</span>
            <ChevronRight size={16} />
          </a>
        </div>

        {jobs.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 20px',
              color: '#6B7280',
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                margin: '0 auto 14px',
                background: '#F3F4F6',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FolderOpen size={24} style={{ color: '#9CA3AF' }} />
            </div>
            <p style={{ fontSize: '15px', color: '#6B7280', margin: 0, fontWeight: 600 }}>
              Keine Einsätze gefunden
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {jobs.slice(0, 6).map((job) => (
              <div
                key={job.job_id}
                onClick={() =>
                  (window.location.href = `${baseUrl}/miraka-co-portal/project/${job.job_id}`)
                }
                style={{
                  padding: '14px 16px',
                  background: '#FAFBFC',
                  borderRadius: '12px',
                  border: '1px solid #E5E7EB',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#F3F4F6';
                  e.currentTarget.style.borderColor = '#1A1A1A';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#FAFBFC';
                  e.currentTarget.style.borderColor = '#E5E7EB';
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '14px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        color: '#1A1A1A',
                        margin: '0 0 4px 0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {job.title || job.service_category || 'Einsatz'}
                    </p>

                    <p
                      style={{
                        fontSize: '14px',
                        color: '#6B7280',
                        margin: 0,
                        fontWeight: 600,
                      }}
                    >
                      {job.billing_name || job.site_name || '-'} • {formatDate(job.planned_start)}
                    </p>
                  </div>

                  <div style={{ flexShrink: 0 }}>{getStatusBadge(job.status)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '18px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
        }}
      >
        <h3
          style={{
            fontSize: '20px',
            fontWeight: 800,
            color: '#1A1A1A',
            margin: '0 0 16px 0',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
            letterSpacing: '-0.01em',
          }}
        >
          Letzte Aktivität
        </h3>

        {recentActivity.length === 0 ? (
          <p style={{ margin: 0, color: '#6B7280', fontWeight: 600 }}>
            Noch keine Aktivität vorhanden.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentActivity.map((activity, index) => (
              <div
                key={activity.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  paddingBottom: index < recentActivity.length - 1 ? '12px' : '0',
                  borderBottom: index < recentActivity.length - 1 ? '1px solid #F3F4F6' : 'none',
                }}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#1A1A1A',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: '15px',
                      color: '#1A1A1A',
                      margin: 0,
                      fontWeight: 500,
                      lineHeight: 1.5,
                    }}
                  >
                    <span style={{ fontWeight: 800 }}>{activity.actor}</span>{' '}
                    {activity.action}{' '}
                    <span style={{ fontWeight: 700 }}>{activity.target}</span>
                  </p>
                </div>
                <span
                  style={{
                    fontSize: '13px',
                    color: '#9CA3AF',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    flexShrink: 0,
                    letterSpacing: '0.02em',
                  }}
                >
                  {activity.time}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .dashboard-header {
            display: none !important;
          }

          .pipeline-chart-container > div:first-child {
            max-width: 240px !important;
            height: 240px !important;
          }
        }
      `}</style>
    </div>
  );
}