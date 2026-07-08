import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import OwnerBillingReadyWidget from './OwnerBillingReadyWidget';
import {
  AlertCircle,
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
  Activity,
  Briefcase,
  MessageSquare,
} from 'lucide-react';

interface DashboardStats {
  totalClients: number;
  activeJobs: number;
  overdueJobs: number;
  openReports: number;
  unreadMessages: number;
  jobsThisWeek: number;
}

interface ServiceJob {
  job_id: string;
  title: string;
  status: string;
  priority?: string | null;
  planned_start?: string | null;
  planned_end?: string | null;
  billing_name?: string | null;
  site_name?: string | null;
  service_category?: string | null;
  report_status?: string | null;
}

interface InboxItem {
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

interface UrgentItem {
  id: string;
  type: 'job' | 'message' | 'report';
  title: string;
  subtitle: string;
  urgency: 'high' | 'medium' | 'low';
  icon: React.ReactNode;
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
  approved: 'Freigegeben',
  sent_to_client: 'An Kunde gesendet',
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
  approved: { bg: '#DCFCE7', text: '#166534', chart: '#22C55E' },
  sent_to_client: { bg: '#EEF2FF', text: '#3730A3', chart: '#6366F1' },
};

function formatStatus(status?: string | null) {
  if (!status) return 'Unbekannt';
  return statusLabels[status] || status.replace(/_/g, ' ');
}

function getStatusStyle(status?: string | null) {
  if (!status) return { bg: '#F3F4F6', text: '#374151', chart: '#9CA3AF' };
  return statusColors[status] || { bg: '#F3F4F6', text: '#374151', chart: '#9CA3AF' };
}

function formatDate(dateString?: string | null) {
  if (!dateString) return '-';

  return new Date(dateString).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: 'short',
  });
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

function getDaysUntil(dateString?: string | null) {
  if (!dateString) return 'Kein Datum';

  const deadline = new Date(dateString);
  const now = new Date();
  const days = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (days < 0) return `${Math.abs(days)} Tage überfällig`;
  if (days === 0) return 'Heute';
  if (days === 1) return 'Morgen';
  return `in ${days} Tagen`;
}

async function readList<T>(table: string, limit = 50): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').limit(limit);

  if (error) {
    console.warn(`[AdminDashboardHome] ${table} konnte nicht geladen werden:`, error.message);
    return [];
  }

  return (data || []) as T[];
}

async function readSingle(table: string): Promise<any | null> {
  const { data, error } = await supabase.from(table).select('*').maybeSingle();

  if (error) {
    console.warn(`[AdminDashboardHome] ${table} konnte nicht geladen werden:`, error.message);
    return null;
  }

  return data;
}

export default function AdminDashboardHome() {
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    activeJobs: 0,
    overdueJobs: 0,
    openReports: 0,
    unreadMessages: 0,
    jobsThisWeek: 0,
  });

  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [urgentItems, setUrgentItems] = useState<UrgentItem[]>([]);
  const [jobStatuses, setJobStatuses] = useState<StatusItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [upcomingJobs, setUpcomingJobs] = useState<ServiceJob[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [metricsData, jobsData, inboxData, reportsData, clientsData] = await Promise.all([
      readSingle('opc_portal_dashboard_metrics'),
      readList<ServiceJob>('opc_my_portal_job_feed', 80),
      readList<InboxItem>('opc_my_conversation_inbox', 20),
      readList<ReportItem>('opc_portal_report_feed', 40),
      readList<any>('opc_portal_client_cards', 40),
    ]);

    const now = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const activeJobs = jobsData.filter(
      (job) => !['completed', 'cancelled', 'report_approved'].includes(job.status)
    ).length;

    const overdueJobs = jobsData.filter((job) => {
      if (!job.planned_start) return false;
      return (
        new Date(job.planned_start) < now &&
        !['completed', 'cancelled', 'report_approved'].includes(job.status)
      );
    }).length;

    const openReports = reportsData.filter((report) => {
      const status = report.report_status || report.status;
      return status && !['approved', 'sent_to_client'].includes(status);
    }).length;

    const unreadMessages = inboxData.filter((message) => Boolean(message.unread)).length;

    const jobsThisWeek = jobsData.filter((job) => {
      if (!job.planned_start) return false;
      return new Date(job.planned_start) >= oneWeekAgo;
    }).length;

    setStats({
      totalClients: Number(metricsData?.total_clients ?? metricsData?.client_count ?? clientsData.length ?? 0),
      activeJobs: Number(metricsData?.active_jobs ?? metricsData?.open_jobs ?? activeJobs),
      overdueJobs: Number(metricsData?.overdue_jobs ?? overdueJobs),
      openReports: Number(metricsData?.open_reports ?? metricsData?.pending_reports ?? openReports),
      unreadMessages: Number(metricsData?.unread_messages ?? unreadMessages),
      jobsThisWeek: Number(metricsData?.jobs_this_week ?? jobsThisWeek),
    });

    const sortedJobs = [...jobsData].sort((a, b) => {
      const aTime = a.planned_start ? new Date(a.planned_start).getTime() : 0;
      const bTime = b.planned_start ? new Date(b.planned_start).getTime() : 0;
      return bTime - aTime;
    });

    setJobs(sortedJobs.slice(0, 6));

    setUpcomingJobs(
      [...jobsData]
        .filter((job) => job.planned_start && !['completed', 'cancelled', 'report_approved'].includes(job.status))
        .sort((a, b) => new Date(a.planned_start || '').getTime() - new Date(b.planned_start || '').getTime())
        .slice(0, 5)
    );

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

    const urgent: UrgentItem[] = [];

    jobsData
      .filter((job) => {
        if (!job.planned_start) return false;
        return (
          new Date(job.planned_start) < now &&
          !['completed', 'cancelled', 'report_approved'].includes(job.status)
        );
      })
      .slice(0, 3)
      .forEach((job) => {
        urgent.push({
          id: job.job_id,
          type: 'job',
          title: job.title || job.service_category || 'Einsatz',
          subtitle: `${job.billing_name || job.site_name || '-'} · ${getDaysUntil(job.planned_start)}`,
          urgency: 'high',
          icon: <XCircle size={16} />,
        });
      });

    reportsData
      .filter((report) => {
        const status = report.report_status || report.status;
        return status && !['approved', 'sent_to_client'].includes(status);
      })
      .slice(0, 2)
      .forEach((report, index) => {
        urgent.push({
          id: report.report_id || report.job_id || `report-${index}`,
          type: 'report',
          title: report.report_title || report.title || 'Bericht offen',
          subtitle: report.billing_name || report.site_name || 'Freigabe erforderlich',
          urgency: 'medium',
          icon: <FileTextIcon />,
        });
      });

    inboxData
      .filter((message) => Boolean(message.unread))
      .slice(0, 2)
      .forEach((message, index) => {
        urgent.push({
          id: message.conversation_id || message.thread_id || `message-${index}`,
          type: 'message',
          title: message.participant_name || message.sender_display || 'Neue Nachricht',
          subtitle: message.last_message || message.message_text_original || 'Ungelesene Nachricht',
          urgency: 'medium',
          icon: <MessageSquare size={16} />,
        });
      });

    setUrgentItems(urgent.slice(0, 5));

    const activity: ActivityItem[] = [];

    sortedJobs.slice(0, 3).forEach((job) => {
      activity.push({
        id: `job-${job.job_id}`,
        actor: job.billing_name || job.site_name || 'Einsatz',
        action: 'Status',
        target: formatStatus(job.status),
        time: formatDateTime(job.planned_start),
      });
    });

    inboxData.slice(0, 2).forEach((message, index) => {
      activity.push({
        id: `message-${message.conversation_id || message.thread_id || index}`,
        actor: message.participant_name || message.sender_display || 'Nachricht',
        action: 'gesendet',
        target: message.last_message || message.message_text_original || 'Ohne Text',
        time: formatDateTime(message.last_message_at || message.created_at),
      });
    });

    setRecentActivity(activity);
  };

  const getStatusBadge = (status?: string | null) => {
    const colors = getStatusStyle(status);

    return (
      <span
        style={{
          display: 'inline-block',
          padding: '4px 10px',
          borderRadius: '10px',
          fontSize: '12px',
          fontWeight: 600,
          background: colors.bg,
          color: colors.text,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        {formatStatus(status)}
      </span>
    );
  };

  const getUrgencyColor = (urgency: 'high' | 'medium' | 'low') => {
    switch (urgency) {
      case 'high':
        return '#EF4444';
      case 'medium':
        return '#F59E0B';
      case 'low':
        return '#6B7280';
    }
  };

  const totalJobs = jobStatuses.reduce((sum, item) => sum + item.count, 0);
  const attentionCount = stats.overdueJobs + stats.openReports + stats.unreadMessages;

  return (
    <div style={{ padding: '0', paddingBottom: '140px' }}>
      <div className="dashboard-header" style={{ marginBottom: '18px' }}>
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#1A1A1A',
            margin: '0 0 6px 0',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
            letterSpacing: '-0.03em',
          }}
        >
          Disposition
        </h1>

        <p
          style={{
            fontSize: '13px',
            color: '#6B7280',
            margin: 0,
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
            fontWeight: 500,
          }}
        >
          {stats.activeJobs} aktive Einsätze • {stats.openReports} offene Berichte • {attentionCount} benötigen Aufmerksamkeit
        </p>
      </div>

      <OwnerBillingReadyWidget />

      {urgentItems.length > 0 && (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '18px',
            padding: '20px',
            marginBottom: '18px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <AlertCircle size={18} style={{ color: '#EF4444' }} />
            <h3
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: '#1A1A1A',
                margin: 0,
              }}
            >
              Benötigt Aufmerksamkeit
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {urgentItems.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (item.type === 'job') {
                    window.location.href = `${baseUrl}/einsatz/${item.id}`;
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: '#FAFBFC',
                  borderRadius: '12px',
                  border: '1px solid #E5E7EB',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                  <div style={{ color: getUrgencyColor(item.urgency), flexShrink: 0, display: 'flex' }}>
                    {item.icon}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#1A1A1A',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.title}
                    </p>

                    <p
                      style={{
                        fontSize: '12px',
                        color: '#6B7280',
                        margin: 0,
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.subtitle}
                    </p>
                  </div>
                </div>

                <ChevronRight size={18} style={{ color: '#9CA3AF', flexShrink: 0 }} />
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
          marginBottom: '18px',
        }}
      >
        {[
          { label: 'Aktive Einsätze', value: stats.activeJobs, color: '#1A1A1A', sub: 'In Bearbeitung' },
          { label: 'Überfällig', value: stats.overdueJobs, color: '#EF4444', sub: 'Prüfen' },
          { label: 'Offene Berichte', value: stats.openReports, color: '#F59E0B', sub: 'Freigabe offen' },
          { label: 'Ungelesen', value: stats.unreadMessages, color: '#1A1A1A', sub: 'Nachrichten' },
          { label: 'Kunden', value: stats.totalClients, color: '#1A1A1A', sub: 'Aktive Konten' },
          { label: 'Einsätze 7d', value: stats.jobsThisWeek, color: '#1A1A1A', sub: 'Diese Woche' },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '18px',
              padding: '20px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                color: '#6B7280',
                marginBottom: '8px',
                fontWeight: 600,
                letterSpacing: '0.3px',
                textTransform: 'uppercase',
              }}
            >
              {item.label}
            </div>

            <div style={{ fontSize: '32px', fontWeight: 700, color: item.color, lineHeight: 1, marginBottom: '4px' }}>
              {item.value}
            </div>

            <div style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 500 }}>{item.sub}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '18px',
          padding: '20px',
          marginBottom: '18px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Activity size={18} style={{ color: '#1A1A1A' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
            Einsatzstatus
          </h3>
        </div>

        {jobStatuses.length === 0 ? (
          <p style={{ margin: 0, fontSize: '13px', color: '#6B7280', fontWeight: 500 }}>
            Noch keine Einsatzdaten vorhanden.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {jobStatuses.map((status) => (
              <div key={status.status} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#6B7280' }}>
                    {formatStatus(status.status)}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#1A1A1A' }}>
                    {status.count}
                  </span>
                </div>

                <div
                  style={{
                    width: '100%',
                    height: '6px',
                    background: '#F3F4F6',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${totalJobs > 0 ? (status.count / totalJobs) * 100 : 0}%`,
                      height: '100%',
                      background: status.color,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            ))}

            <div
              style={{
                marginTop: '8px',
                paddingTop: '14px',
                borderTop: '1px solid #E5E7EB',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: 600 }}>Total Einsätze</span>
              <span style={{ fontSize: '28px', fontWeight: 700, color: '#1A1A1A', lineHeight: 1 }}>
                {totalJobs}
              </span>
            </div>
          </div>
        )}
      </div>

      {upcomingJobs.length > 0 && (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '18px',
            padding: '20px',
            marginBottom: '18px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Calendar size={18} style={{ color: '#1A1A1A' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
              Nächste Einsätze
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {upcomingJobs.map((job) => (
              <div
                key={job.job_id}
                onClick={() => (window.location.href = `${baseUrl}/einsatz/${job.job_id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: '#FAFBFC',
                  borderRadius: '12px',
                  border: '1px solid #E5E7EB',
                  cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1A1A1A',
                      margin: '0 0 4px 0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {job.title || job.service_category || 'Einsatz'}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 500 }}>
                      {job.billing_name || job.site_name || '-'}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280' }}>
                      • {formatDate(job.planned_start)}
                    </span>
                  </div>
                </div>

                <div style={{ marginLeft: '12px', flexShrink: 0 }}>{getStatusBadge(job.status)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '18px',
          padding: '20px',
          marginBottom: '18px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
        }}
      >
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1A1A1A', margin: '0 0 14px 0' }}>
          Schnellaktionen
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          <ActionLink href={`${baseUrl}/kunde-anlegen`} icon={<Users size={16} />} label="Kunde anlegen" dark />
          <ActionLink href={`${baseUrl}/einsatz-planen`} icon={<Plus size={16} />} label="Einsatz planen" />
          <ActionLink href={`${baseUrl}/berichte-dateien`} icon={<Upload size={16} />} label="Dateien" />
          <ActionLink href={`${baseUrl}/anfragen-schaeden`} icon={<Ticket size={16} />} label="Anfrage / Schaden" />
          <ActionLink href={`${baseUrl}/kunden/invoice`} icon={<FileSpreadsheet size={16} />} label="Rechnung / Bericht" full />
        </div>
      </div>

      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '18px',
          padding: '20px',
          marginBottom: '18px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
            Aktuelle Einsätze
          </h3>

          <a
            href={`${baseUrl}/einsaetze`}
            style={{
              fontSize: '13px',
              color: '#1A1A1A',
              textDecoration: 'none',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>Alle anzeigen</span>
            <ChevronRight size={16} />
          </a>
        </div>

        {jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 20px', color: '#6B7280' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                margin: '0 auto 12px',
                background: '#F3F4F6',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FolderOpen size={20} style={{ color: '#9CA3AF' }} />
            </div>

            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0, fontWeight: 500 }}>
              Keine aktuellen Einsätze
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {jobs.map((job) => (
              <div
                key={job.job_id}
                onClick={() => (window.location.href = `${baseUrl}/einsatz/${job.job_id}`)}
                style={{
                  padding: '14px',
                  background: '#FAFBFC',
                  borderRadius: '12px',
                  border: '1px solid #E5E7EB',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#1A1A1A',
                        margin: '0 0 4px 0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {job.title || job.service_category || 'Einsatz'}
                    </p>

                    <p style={{ fontSize: '12px', color: '#6B7280', margin: 0, fontWeight: 500 }}>
                      {job.billing_name || job.site_name || '-'} · {formatDate(job.planned_start)}
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
          marginBottom: '18px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
        }}
      >
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1A1A1A', margin: '0 0 14px 0' }}>
          Letzte Aktivität
        </h3>

        {recentActivity.length === 0 ? (
          <p style={{ margin: 0, fontSize: '13px', color: '#6B7280', fontWeight: 500 }}>
            Noch keine Aktivität vorhanden.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentActivity.map((activity, index) => (
              <div
                key={activity.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
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
                    marginTop: '6px',
                    flexShrink: 0,
                  }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', color: '#1A1A1A', margin: '0 0 2px 0', fontWeight: 500 }}>
                    <span style={{ fontWeight: 700 }}>{activity.actor}</span> {activity.action}{' '}
                    <span style={{ fontWeight: 600 }}>{activity.target}</span>
                  </p>

                  <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0, fontWeight: 500 }}>
                    {activity.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .dashboard-header {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function ActionLink({
  href,
  icon,
  label,
  dark = false,
  full = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  dark?: boolean;
  full?: boolean;
}) {
  return (
    <a
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '14px 16px',
        background: dark ? '#1A1A1A' : '#F3F4F6',
        color: dark ? '#FFFFFF' : '#1A1A1A',
        fontSize: '14px',
        fontWeight: 600,
        borderRadius: '12px',
        textDecoration: 'none',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 0.2s ease',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
        gridColumn: full ? 'span 2' : undefined,
      }}
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}

function FileTextIcon() {
  return <Briefcase size={16} />;
}