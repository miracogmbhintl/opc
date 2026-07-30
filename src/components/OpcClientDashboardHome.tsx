import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  AlertTriangle,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Loader2,
  MapPin,
  MessageSquare,
  RefreshCw,
  WalletCards,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import MirakaDashboardShell from './MirakaDashboardShell';
import PortalSkeleton from './shared/PortalSkeleton';

type AnyRow = Record<string, any>;

type PortalIdentity = {
  user_id: string;
  client_id: string;
  display_name: string;
  email: string;
  phone: string;
  company_name: string;
  permissions: Record<string, boolean>;
};

type PortalDataset = {
  sites: AnyRow[];
  jobs: AnyRow[];
  reports: AnyRow[];
  tickets: AnyRow[];
  quotes: AnyRow[];
  invoices: AnyRow[];
  documents: AnyRow[];
};

type PortalResponse = {
  ok: boolean;
  error?: string;
  portal?: PortalIdentity;
  data?: PortalDataset;
};

const emptyDataset: PortalDataset = {
  sites: [],
  jobs: [],
  reports: [],
  tickets: [],
  quotes: [],
  invoices: [],
  documents: [],
};

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

function buildUrl(path: string) {
  return `${String(baseUrl || '').replace(/\/$/, '')}${path}`;
}

function normalize(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function firstValue(row: AnyRow | null | undefined, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value);
    }
  }
  return fallback;
}

function jobTitle(row: AnyRow) {
  return firstValue(row, ['title', 'job_title', 'service_category', 'job_type'], 'Reinigungsauftrag');
}

function jobStart(row: AnyRow) {
  return firstValue(row, ['planned_start', 'start_time', 'scheduled_at', 'date_time']);
}

function jobEnd(row: AnyRow) {
  return firstValue(row, ['planned_end', 'end_time']);
}

function formatDateTime(value: unknown) {
  if (!value) return 'Termin folgt';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'Termin folgt';
  return date.toLocaleString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function locationFor(job: AnyRow, sites: Map<string, AnyRow>) {
  const site = sites.get(String(job.client_site_id || job.site_id || ''));
  const siteLabel = firstValue(site, ['site_name', 'name', 'title']);
  const address = firstValue(site, ['address_text', 'formatted_address', 'street', 'address']);
  const city = [firstValue(site, ['postal_code', 'zip']), firstValue(site, ['city'])]
    .filter(Boolean)
    .join(' ');
  const fullAddress = [address, city].filter(Boolean).join(', ');
  return [siteLabel, fullAddress].filter(Boolean).join(' · ') || firstValue(job, ['site_name', 'site_address', 'city'], 'Standort gemäss Auftrag');
}

function statusLabel(status: unknown) {
  const clean = normalize(status);
  const labels: Record<string, string> = {
    new: 'Neu',
    open: 'Offen',
    scheduled: 'Geplant',
    assigned: 'Zugewiesen',
    confirmed: 'Bestätigt',
    in_progress: 'In Bearbeitung',
    on_site: 'Vor Ort',
    completed: 'Abgeschlossen',
    approved: 'Freigegeben',
    report_approved: 'Bericht freigegeben',
    sent_to_client: 'An Kunde gesendet',
    published: 'Veröffentlicht',
    resolved: 'Erledigt',
    closed: 'Geschlossen',
    accepted: 'Angenommen',
    sent: 'Versendet',
    paid: 'Bezahlt',
    overdue: 'Überfällig',
    partially_paid: 'Teilbezahlt',
  };
  return labels[clean] || clean.replace(/_/g, ' ') || 'Unbekannt';
}

function StatusPill({ status }: { status: unknown }) {
  const clean = normalize(status);
  const done = ['completed', 'approved', 'report_approved', 'sent_to_client', 'published', 'resolved', 'closed', 'accepted', 'paid'].includes(clean);
  const active = ['in_progress', 'on_site', 'started', 'running', 'open', 'new'].includes(clean);
  const danger = ['overdue', 'cancelled', 'declined', 'expired', 'rejected'].includes(clean);
  const style = done
    ? { background: '#F0FDF4', color: BRAND.green, border: '#BBF7D0' }
    : active
      ? { background: '#FFFBEB', color: BRAND.amber, border: '#FDE68A' }
      : danger
        ? { background: '#FEF2F2', color: BRAND.red, border: '#FECACA' }
        : { background: '#F9FAFB', color: BRAND.muted, border: BRAND.border };

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
        background: style.background,
        color: style.color,
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {statusLabel(status)}
    </span>
  );
}

function MetricCard({ value, label, tone = 'neutral' }: { value: string | number; label: string; tone?: 'neutral' | 'success' | 'warning' }) {
  const valueColor = tone === 'success' ? BRAND.green : tone === 'warning' ? BRAND.amber : BRAND.text;
  return (
    <div style={{ ...cardStyle, padding: 18, minHeight: 96 }}>
      <div style={{ fontSize: 24, fontWeight: 860, letterSpacing: '-0.04em', marginBottom: 10, color: valueColor }}>{value}</div>
      <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 720 }}>{label}</div>
    </div>
  );
}

function DocumentRow({ icon, title, subtitle, href, status }: { icon: ReactNode; title: string; subtitle: string; href: string; status: unknown }) {
  return (
    <a href={buildUrl(href)} className="opc-client-document-row">
      <span className="opc-client-document-icon">{icon}</span>
      <span style={{ minWidth: 0 }}>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      <StatusPill status={status} />
    </a>
  );
}

export default function OpcClientDashboardHome() {
  const [identity, setIdentity] = useState<PortalIdentity | null>(null);
  const [data, setData] = useState<PortalDataset>(emptyDataset);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function load(showLoader = false) {
    if (showLoader) setLoading(true);
    else setRefreshing(true);
    setError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Ihre Sitzung ist abgelaufen.');

      const response = await fetch(buildUrl('/api/opc/client-portal/data'), {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      const result = await response.json().catch(() => null) as PortalResponse | null;
      if (!response.ok || !result?.ok || !result.portal) {
        throw new Error(result?.error || 'Kundenportal konnte nicht geladen werden.');
      }

      setIdentity(result.portal);
      setData(result.data || emptyDataset);
    } catch (err: any) {
      setError(err?.message || 'Kundenportal konnte nicht geladen werden.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load(true);
  }, []);

  const dashboard = useMemo(() => {
    const now = Date.now();
    const sites = new Map(data.sites.map((site) => [String(site.id), site]));
    const sortedJobs = [...data.jobs].sort((a, b) => {
      const aTime = new Date(jobStart(a)).getTime();
      const bTime = new Date(jobStart(b)).getTime();
      return (Number.isFinite(aTime) ? aTime : Number.MAX_SAFE_INTEGER) - (Number.isFinite(bTime) ? bTime : Number.MAX_SAFE_INTEGER);
    });
    const upcoming = sortedJobs.filter((job) => {
      const time = new Date(jobStart(job)).getTime();
      return Number.isFinite(time) && time >= now && !['completed', 'cancelled', 'report_approved', 'approved', 'sent_to_client'].includes(normalize(job.status));
    });
    const active = data.jobs.filter((job) => ['assigned', 'confirmed', 'in_progress', 'on_site', 'started', 'running'].includes(normalize(job.status)));
    const completed = data.jobs.filter((job) => ['completed', 'report_approved', 'approved', 'sent_to_client'].includes(normalize(job.status)));
    const openTickets = data.tickets.filter((ticket) => ['new', 'open', 'in_progress'].includes(normalize(ticket.status)));
    const openInvoices = data.invoices.filter((invoice) => ['sent', 'open', 'overdue', 'pending', 'partially_paid'].includes(normalize(invoice.status)));
    const recentJobs = [...upcoming, ...sortedJobs.filter((job) => !upcoming.includes(job))].slice(0, 4);
    const latestReport = [...data.reports].sort((a, b) => new Date(firstValue(b, ['report_date', 'updated_at', 'created_at'])).getTime() - new Date(firstValue(a, ['report_date', 'updated_at', 'created_at'])).getTime())[0];
    const latestInvoice = [...data.invoices].sort((a, b) => new Date(firstValue(b, ['issue_date', 'created_at'])).getTime() - new Date(firstValue(a, ['issue_date', 'created_at'])).getTime())[0];

    return {
      sites,
      upcoming,
      active,
      completed,
      openTickets,
      openInvoices,
      nextJob: upcoming[0] || null,
      recentJobs,
      latestReport,
      latestInvoice,
    };
  }, [data]);

  return (
    <MirakaDashboardShell hideTopBar requiredRole="client" currentPath="/dashboard">
      {loading ? (
        <PortalSkeleton variant="dashboard" />
      ) : error || !identity ? (
        <div style={errorPageStyle}>
          <AlertTriangle size={24} />
          <strong>Kundenportal nicht verfügbar</strong>
          <span>{error || 'Das Kundenkonto konnte nicht geladen werden.'}</span>
          <button type="button" onClick={() => void load(true)} style={secondaryButtonStyle}>Erneut versuchen</button>
        </div>
      ) : (
        <div className="opc-client-dashboard" style={{ fontFamily: pageFont, color: BRAND.text, paddingBottom: 120 }}>
          <section style={{ ...cardStyle, padding: 24, marginBottom: 16 }}>
            <div className="opc-client-dashboard-hero">
              <div>
                <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Kunden-Dashboard</div>
                <h1 style={{ margin: 0, fontSize: 31, lineHeight: 1.05, letterSpacing: '-0.045em', fontWeight: 880 }}>
                  Guten Tag, {identity.display_name.split(/\s+/)[0] || identity.display_name}
                </h1>
                <p style={{ margin: '9px 0 0', color: BRAND.muted, fontSize: 14, lineHeight: 1.5, fontWeight: 620 }}>
                  Prüfen Sie Ihre nächsten Reinigungstermine, freigegebenen Berichte, Anfragen und Rechnungen für {identity.company_name}.
                </p>
              </div>

              <button type="button" onClick={() => void load(false)} style={secondaryButtonStyle} disabled={refreshing}>
                {refreshing ? <Loader2 size={16} className="opc-client-spin" /> : <RefreshCw size={16} />}
                Aktualisieren
              </button>
            </div>
          </section>

          <div className="opc-client-dashboard-main-grid">
            <section style={{ ...cardStyle, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
                <div>
                  <h2 style={sectionTitleStyle}>Nächster Einsatz</h2>
                  <p style={sectionDescriptionStyle}>Der nächste bestätigte oder geplante Auftrag.</p>
                </div>
                {dashboard.nextJob ? <StatusPill status={dashboard.nextJob.status} /> : null}
              </div>

              {dashboard.nextJob ? (
                <div style={{ display: 'grid', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 860, lineHeight: 1.18, letterSpacing: '-0.035em' }}>{jobTitle(dashboard.nextJob)}</div>
                    <div style={{ marginTop: 8, color: BRAND.muted, fontSize: 13, fontWeight: 650 }}>
                      {firstValue(dashboard.nextJob, ['service_category', 'job_type'], 'Reinigung')}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 9, color: BRAND.muted, fontSize: 13, fontWeight: 650 }}>
                    <span style={detailLineStyle}><CalendarDays size={15} />{formatDateTime(jobStart(dashboard.nextJob))}</span>
                    <span style={detailLineStyle}><MapPin size={15} />{locationFor(dashboard.nextJob, dashboard.sites)}</span>
                  </div>

                  <div className="opc-client-dashboard-action-grid">
                    <a href={buildUrl(`/kundenportal/auftrag/${dashboard.nextJob.id}`)} style={primaryButtonStyle}><Briefcase size={16} />Auftrag öffnen</a>
                    <a href={buildUrl('/kundenportal/auftraege')} style={secondaryButtonStyle}>Alle Aufträge</a>
                  </div>
                </div>
              ) : (
                <div style={emptyPanelStyle}>Derzeit ist kein weiterer Einsatz geplant.</div>
              )}
            </section>

            <section style={{ ...cardStyle, padding: 20 }}>
              <div style={{ marginBottom: 18 }}>
                <h2 style={sectionTitleStyle}>Neueste Dokumente</h2>
                <p style={sectionDescriptionStyle}>Zuletzt freigegebene Berichte und Finanzdokumente.</p>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {dashboard.latestReport ? (
                  <DocumentRow
                    icon={<FileText size={17} />}
                    title={firstValue(dashboard.latestReport, ['report_title', 'title'], 'Einsatzbericht')}
                    subtitle={formatDate(firstValue(dashboard.latestReport, ['report_date', 'updated_at', 'created_at']))}
                    href="/kundenportal/dokumente"
                    status={dashboard.latestReport.status}
                  />
                ) : null}
                {dashboard.latestInvoice ? (
                  <DocumentRow
                    icon={<WalletCards size={17} />}
                    title={firstValue(dashboard.latestInvoice, ['title', 'invoice_title'], 'Rechnung')}
                    subtitle={`${firstValue(dashboard.latestInvoice, ['invoice_number'])} · ${formatMoney(firstValue(dashboard.latestInvoice, ['total_chf', 'total_amount']))}`}
                    href={`/kundenportal/rechnung/${dashboard.latestInvoice.id}`}
                    status={dashboard.latestInvoice.status}
                  />
                ) : null}
                {!dashboard.latestReport && !dashboard.latestInvoice ? <div style={emptyPanelStyle}>Noch keine Dokumente freigegeben.</div> : null}
              </div>
            </section>
          </div>

          <div className="opc-client-dashboard-metrics">
            <MetricCard value={dashboard.upcoming.length} label="Bevorstehende Einsätze" />
            <MetricCard value={dashboard.active.length} label="Aktive Aufträge" />
            <MetricCard value={dashboard.openTickets.length} label="Offene Anfragen" tone={dashboard.openTickets.length ? 'warning' : 'neutral'} />
            <MetricCard value={dashboard.openInvoices.length} label="Offene Rechnungen" tone={dashboard.openInvoices.length ? 'warning' : 'neutral'} />
          </div>

          <section style={{ ...cardStyle, padding: 20 }}>
            <div className="opc-client-current-header">
              <div>
                <h2 style={sectionTitleStyle}>Aktuelle Aufträge</h2>
                <p style={sectionDescriptionStyle}>Ihre nächsten und zuletzt bearbeiteten Reinigungseinsätze.</p>
              </div>
              <a href={buildUrl('/kundenportal/auftraege')} style={secondaryButtonStyle}>Alle Aufträge</a>
            </div>

            {dashboard.recentJobs.length === 0 ? (
              <div style={emptyPanelStyle}>Keine Aufträge gefunden.</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {dashboard.recentJobs.map((job) => (
                  <article key={String(job.id)} className="opc-client-dashboard-job-row">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 17, fontWeight: 850, letterSpacing: '-0.03em', marginBottom: 6 }}>{jobTitle(job)}</div>
                      <div className="opc-client-dashboard-job-meta">
                        <span>{formatDateTime(jobStart(job))}</span>
                        <span>{locationFor(job, dashboard.sites)}</span>
                        {jobEnd(job) ? <span>{formatTime(jobStart(job))} – {formatTime(jobEnd(job))}</span> : null}
                      </div>
                    </div>

                    <div className="opc-client-dashboard-job-actions">
                      <StatusPill status={job.status} />
                      <a href={buildUrl(`/kundenportal/auftrag/${job.id}`)} style={secondaryButtonStyle}>Öffnen</a>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <style>{`
            @keyframes opc-client-spin { to { transform: rotate(360deg); } }
            .opc-client-spin { animation: opc-client-spin .9s linear infinite; }
            .opc-client-dashboard-hero,
            .opc-client-current-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 18px;
            }
            .opc-client-dashboard-main-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 16px;
              margin-bottom: 16px;
            }
            .opc-client-dashboard-metrics {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 14px;
              margin: 16px 0;
            }
            .opc-client-dashboard-action-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 10px;
            }
            .opc-client-document-row {
              min-height: 70px;
              display: grid;
              grid-template-columns: 42px minmax(0, 1fr) auto;
              align-items: center;
              gap: 12px;
              padding: 12px;
              border: 1px solid ${BRAND.border};
              border-radius: 16px;
              color: ${BRAND.text};
              text-decoration: none;
              background: #FFFFFF;
            }
            .opc-client-document-row strong {
              display: block;
              margin-bottom: 5px;
              font-size: 14px;
              font-weight: 820;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .opc-client-document-row small {
              display: block;
              color: ${BRAND.muted};
              font-size: 12px;
              font-weight: 650;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .opc-client-document-icon {
              width: 42px;
              height: 42px;
              border-radius: 14px;
              border: 1px solid ${BRAND.border};
              background: ${BRAND.soft};
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .opc-client-dashboard-job-row {
              min-height: 86px;
              display: grid;
              grid-template-columns: minmax(0, 1fr) auto;
              align-items: center;
              gap: 18px;
              padding: 16px 18px;
              border: 1px solid ${BRAND.border};
              border-radius: 16px;
              background: #FFFFFF;
            }
            .opc-client-dashboard-job-meta {
              color: ${BRAND.muted};
              font-size: 13px;
              font-weight: 650;
              display: flex;
              flex-wrap: wrap;
              gap: 8px 14px;
            }
            .opc-client-dashboard-job-actions {
              display: flex;
              align-items: center;
              justify-content: flex-end;
              gap: 10px;
            }
            @media (max-width: 1180px) {
              .opc-client-dashboard-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            }
            @media (max-width: 860px) {
              .opc-client-dashboard-main-grid { grid-template-columns: 1fr; }
              .opc-client-dashboard-hero,
              .opc-client-current-header { flex-direction: column; }
              .opc-client-dashboard-job-row { grid-template-columns: 1fr; }
              .opc-client-dashboard-job-actions { justify-content: flex-start; flex-wrap: wrap; }
            }
            @media (max-width: 620px) {
              .opc-client-dashboard-metrics,
              .opc-client-dashboard-action-grid { grid-template-columns: 1fr; }
              .opc-client-dashboard-hero button,
              .opc-client-current-header a { width: 100%; }
              .opc-client-document-row { grid-template-columns: 42px minmax(0, 1fr); }
              .opc-client-document-row > span:last-child { grid-column: 2; justify-self: start; }
            }
          `}</style>
        </div>
      )}
    </MirakaDashboardShell>
  );
}

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 860,
  letterSpacing: '-0.03em',
};

const sectionDescriptionStyle: CSSProperties = {
  margin: '6px 0 0',
  color: BRAND.muted,
  fontSize: 13,
  fontWeight: 620,
  lineHeight: 1.5,
};

const detailLineStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'flex-start',
  gap: 7,
};

const emptyPanelStyle: CSSProperties = {
  minHeight: 160,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  color: BRAND.muted,
  fontSize: 14,
  fontWeight: 650,
  background: BRAND.soft,
  borderRadius: 16,
  padding: 20,
};

const errorPageStyle: CSSProperties = {
  minHeight: '60vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  color: BRAND.muted,
  fontFamily: pageFont,
};
