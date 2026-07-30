import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  ExternalLink,
  FileText,
  Home,
  Loader2,
  LockKeyhole,
  LogOut,
  MapPin,
  Menu,
  MessageSquareWarning,
  Plus,
  ReceiptText,
  Send,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { supabase, type UserProfile } from '../lib/supabase';
import {
  clearCachedOpcAuthProfile,
  loadOpcAuthProfile,
} from '../lib/opc-auth-cache';
import { baseUrl } from '../lib/base-url';
import { safeNavigate } from '../lib/opc-navigation-guard';

type AnyRow = Record<string, any>;

type PortalSection =
  | 'overview'
  | 'orders'
  | 'order-detail'
  | 'sites'
  | 'documents'
  | 'requests'
  | 'finance'
  | 'settings';

type PortalIdentity = {
  user_id: string;
  client_id: string;
  contact_id?: string | null;
  display_name: string;
  email: string;
  phone: string;
  company_name: string;
  client_type?: string | null;
  status?: string | null;
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
  detail?: {
    job: AnyRow;
    reports: AnyRow[];
    site: AnyRow | null;
    assignment_statuses?: AnyRow[];
    warnings?: string[];
  };
  warnings?: string[];
};

type NavItem = {
  section: PortalSection;
  href: string;
  label: string;
  icon: typeof Home;
};

const LOGO_URL =
  'https://cdn.prod.website-files.com/6944470386300e196e5fc347/6949534529e8342842456097_REGULAR%20COLOR%20ORANGE%20PRO%20CLEAN%20LOGO%20ORIGINAL.png';

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  black: '#0F1115',
  soft: '#F7F7F7',
  orange: '#FF7A00',
  green: '#166534',
  greenBg: '#F0FDF4',
  amber: '#92400E',
  amberBg: '#FFFBEB',
  red: '#B91C1C',
  redBg: '#FEF2F2',
};

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, "Helvetica Neue", Arial, sans-serif';

const emptyDataset: PortalDataset = {
  sites: [],
  jobs: [],
  reports: [],
  tickets: [],
  quotes: [],
  invoices: [],
  documents: [],
};

const navItems: NavItem[] = [
  { section: 'overview', href: '/kundenportal', label: 'Übersicht', icon: Home },
  { section: 'orders', href: '/kundenportal/auftraege', label: 'Meine Aufträge', icon: ClipboardList },
  { section: 'sites', href: '/kundenportal/standorte', label: 'Standorte', icon: Building2 },
  { section: 'documents', href: '/kundenportal/dokumente', label: 'Berichte & Dokumente', icon: FileText },
  { section: 'requests', href: '/kundenportal/anfragen', label: 'Anfragen & Schäden', icon: MessageSquareWarning },
  { section: 'finance', href: '/kundenportal/finanzen', label: 'Offerten & Rechnungen', icon: ReceiptText },
  { section: 'settings', href: '/kundenportal/einstellungen', label: 'Einstellungen', icon: Settings },
];

function buildUrl(path: string) {
  const cleanBase = String(baseUrl || '').replace(/\/$/, '');
  return `${cleanBase}${path}`;
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

function numberValue(row: AnyRow | null | undefined, keys: string[]) {
  for (const key of keys) {
    const value = Number(row?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function formatDate(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(value: unknown) {
  if (!value) return 'Termin folgt';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'Termin folgt';
  return date.toLocaleString('de-CH', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function getInitials(value: string) {
  const parts = String(value || '')
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (!parts.length) return 'K';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function statusLabel(status: unknown) {
  const clean = normalize(status);
  const labels: Record<string, string> = {
    draft: 'Entwurf',
    new: 'Neu',
    open: 'Offen',
    scheduled: 'Geplant',
    assigned: 'Zugewiesen',
    confirmed: 'Bestätigt',
    on_site: 'Vor Ort',
    onsite: 'Vor Ort',
    in_progress: 'In Bearbeitung',
    started: 'Gestartet',
    running: 'Läuft',
    completed: 'Abgeschlossen',
    submitted: 'Eingereicht',
    approved: 'Freigegeben',
    report_approved: 'Bericht freigegeben',
    sent_to_client: 'An Kunde gesendet',
    resolved: 'Erledigt',
    closed: 'Geschlossen',
    accepted: 'Angenommen',
    declined: 'Abgelehnt',
    sent: 'Versendet',
    paid: 'Bezahlt',
    overdue: 'Überfällig',
    cancelled: 'Storniert',
  };
  return labels[clean] || clean.replace(/_/g, ' ') || 'Unbekannt';
}

function statusTone(status: unknown) {
  const clean = normalize(status);
  if (['completed', 'approved', 'report_approved', 'sent_to_client', 'paid', 'resolved', 'closed', 'accepted'].includes(clean)) {
    return { color: BRAND.green, background: BRAND.greenBg, border: '#BBF7D0' };
  }
  if (['overdue', 'cancelled', 'declined', 'rejected'].includes(clean)) {
    return { color: BRAND.red, background: BRAND.redBg, border: '#FECACA' };
  }
  if (['in_progress', 'on_site', 'onsite', 'started', 'running', 'open', 'new'].includes(clean)) {
    return { color: BRAND.amber, background: BRAND.amberBg, border: '#FDE68A' };
  }
  return { color: BRAND.muted, background: '#F9FAFB', border: BRAND.border };
}

function StatusBadge({ status }: { status: unknown }) {
  const tone = statusTone(status);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 28,
        padding: '0 10px',
        borderRadius: 999,
        border: `1px solid ${tone.border}`,
        background: tone.background,
        color: tone.color,
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {statusLabel(status)}
    </span>
  );
}

function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <section
      style={{
        background: '#FFFFFF',
        border: `1px solid ${BRAND.border}`,
        borderRadius: 20,
        boxShadow: '0 1px 2px rgba(15,17,21,0.04)',
        ...style,
      }}
    >
      {children}
    </section>
  );
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="opc-client-page-title">
      <div>
        <div className="opc-client-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="opc-client-primary-button" href={buildUrl(href)}>
      {children}
    </a>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card style={{ padding: 28, textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 840, marginBottom: 7 }}>{title}</div>
      <div style={{ color: BRAND.muted, fontSize: 13, lineHeight: 1.6 }}>{description}</div>
    </Card>
  );
}

function documentUrl(row: AnyRow) {
  return firstValue(row, [
    'download_url',
    'file_url',
    'public_url',
    'pdf_url',
    'document_url',
    'signed_url',
  ]);
}

function siteLabel(site: AnyRow | null | undefined) {
  return firstValue(site, ['site_name', 'name', 'title', 'address_text'], 'Standort');
}

function siteAddress(site: AnyRow | null | undefined) {
  return [
    firstValue(site, ['address_text', 'street', 'address']),
    firstValue(site, ['postal_code', 'zip']),
    firstValue(site, ['city']),
  ]
    .filter(Boolean)
    .join(', ');
}

function jobStart(job: AnyRow) {
  return firstValue(job, ['planned_start', 'start_time', 'scheduled_at', 'date_time']);
}

function jobStatus(job: AnyRow) {
  return firstValue(job, ['status', 'job_status'], 'scheduled');
}

function jobTitle(job: AnyRow) {
  return firstValue(job, ['title', 'job_title', 'service_category', 'job_type'], 'Reinigungsauftrag');
}

function reportTitle(report: AnyRow) {
  return firstValue(report, ['report_title', 'title', 'name'], 'Einsatzbericht');
}

function documentRow(
  row: AnyRow,
  options: { titleKeys: string[]; numberKeys?: string[]; statusKeys?: string[]; dateKeys?: string[]; amountKeys?: string[] },
) {
  const title = firstValue(row, options.titleKeys, 'Dokument');
  const number = firstValue(row, options.numberKeys || []);
  const status = firstValue(row, options.statusKeys || []);
  const date = firstValue(row, options.dateKeys || ['created_at', 'updated_at']);
  const amount = options.amountKeys?.length ? numberValue(row, options.amountKeys) : null;
  const url = documentUrl(row);

  return (
    <div className="opc-client-document-row" key={String(row.id || `${title}-${number}-${date}`)}>
      <div className="opc-client-document-icon"><FileText size={18} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 820 }}>{title}</div>
        <div className="opc-client-row-meta">
          {number ? <span>{number}</span> : null}
          {date ? <span>{formatDate(date)}</span> : null}
          {amount !== null ? <span>{formatMoney(amount)}</span> : null}
        </div>
      </div>
      {status ? <StatusBadge status={status} /> : null}
      {url ? (
        <a className="opc-client-icon-button" href={url} target="_blank" rel="noreferrer" title="Dokument öffnen">
          <ExternalLink size={17} />
        </a>
      ) : null}
    </div>
  );
}

function ClientSidebar({
  section,
  identity,
  collapsed,
  mobileOpen,
  onToggle,
  onCloseMobile,
  onLogout,
}: {
  section: PortalSection;
  identity: PortalIdentity;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  onCloseMobile: () => void;
  onLogout: () => void;
}) {
  const width = collapsed ? 82 : 286;

  return (
    <>
      {mobileOpen ? <button className="opc-client-mobile-backdrop" type="button" onClick={onCloseMobile} aria-label="Menü schliessen" /> : null}
      <aside
        className={`opc-client-sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}
        style={{ width }}
      >
        <div className="opc-client-sidebar-logo">
          {collapsed ? <div className="opc-client-logo-mark">O</div> : <img src={LOGO_URL} alt="Orange Pro Clean GmbH" />}
        </div>

        <div className="opc-client-portal-label">
          <ShieldCheck size={15} />
          {!collapsed ? <span>Kundenportal</span> : null}
        </div>

        <button className="opc-client-collapse-button" type="button" onClick={onToggle}>
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed ? <span>Einklappen</span> : null}
        </button>

        <nav className="opc-client-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = section === item.section || (section === 'order-detail' && item.section === 'orders');
            return (
              <a
                key={item.section}
                href={buildUrl(item.href)}
                className={active ? 'active' : ''}
                title={collapsed ? item.label : undefined}
                onClick={onCloseMobile}
              >
                <Icon size={19} />
                {!collapsed ? <span>{item.label}</span> : null}
              </a>
            );
          })}
        </nav>

        <div className="opc-client-sidebar-profile">
          <div className="opc-client-avatar">{getInitials(identity.display_name)}</div>
          {!collapsed ? (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="opc-client-profile-name">{identity.display_name}</div>
              <div className="opc-client-profile-company">{identity.company_name}</div>
            </div>
          ) : null}
          <button type="button" onClick={onLogout} title="Abmelden"><LogOut size={18} /></button>
        </div>
      </aside>
    </>
  );
}

function OverviewPage({ identity, data }: { identity: PortalIdentity; data: PortalDataset }) {
  const now = Date.now();
  const completed = new Set(['completed', 'approved', 'report_approved', 'sent_to_client']);
  const openTicketStatuses = new Set(['new', 'open', 'in_progress']);
  const openInvoiceStatuses = new Set(['draft', 'sent', 'open', 'overdue', 'pending']);

  const upcomingJobs = data.jobs
    .filter((job) => {
      const time = new Date(jobStart(job)).getTime();
      return Number.isFinite(time) && time >= now && !completed.has(normalize(jobStatus(job)));
    })
    .sort((a, b) => new Date(jobStart(a)).getTime() - new Date(jobStart(b)).getTime());

  const activeJobs = data.jobs.filter((job) =>
    ['assigned', 'confirmed', 'on_site', 'onsite', 'in_progress', 'started', 'running'].includes(normalize(jobStatus(job))),
  );
  const openTickets = data.tickets.filter((ticket) => openTicketStatuses.has(normalize(ticket.status)));
  const openInvoices = data.invoices.filter((invoice) => openInvoiceStatuses.has(normalize(invoice.status)));
  const nextJob = upcomingJobs[0] || null;
  const latestReport = data.reports[0] || null;
  const latestInvoice = data.invoices[0] || null;
  const firstName = identity.display_name.split(/\s+/)[0] || identity.display_name;

  return (
    <>
      <PageTitle
        eyebrow="Kundenportal"
        title={`Guten Tag, ${firstName}`}
        description={`Alle Informationen zu ${identity.company_name}: Aufträge, Termine, Berichte, Dokumente und Anfragen.`}
        action={<PrimaryLink href="/kundenportal/anfragen"><Plus size={16} /> Neue Anfrage</PrimaryLink>}
      />

      <div className="opc-client-metric-grid">
        <Card style={{ padding: 20 }}><CalendarDays size={18} /><strong>{upcomingJobs.length}</strong><span>Bevorstehende Einsätze</span></Card>
        <Card style={{ padding: 20 }}><ClipboardList size={18} /><strong>{activeJobs.length}</strong><span>Aktive Aufträge</span></Card>
        <Card style={{ padding: 20 }}><MessageSquareWarning size={18} /><strong>{openTickets.length}</strong><span>Offene Anfragen</span></Card>
        <Card style={{ padding: 20 }}><CircleDollarSign size={18} /><strong>{openInvoices.length}</strong><span>Offene Rechnungen</span></Card>
      </div>

      <div className="opc-client-overview-grid">
        <Card style={{ padding: 22 }}>
          <div className="opc-client-card-heading"><div><span>Nächster Einsatz</span><h2>{nextJob ? jobTitle(nextJob) : 'Kein Termin geplant'}</h2></div><CalendarDays size={20} /></div>
          {nextJob ? (
            <>
              <div className="opc-client-detail-line"><Clock3 size={16} /><span>{formatDateTime(jobStart(nextJob))}</span></div>
              <div className="opc-client-detail-line"><MapPin size={16} /><span>{firstValue(nextJob, ['site_name', 'site_address', 'address_text', 'city'], 'Standort gemäss Auftrag')}</span></div>
              <div style={{ marginTop: 18 }}><PrimaryLink href={`/kundenportal/auftrag/${nextJob.id}`}>Auftrag öffnen <ChevronRight size={16} /></PrimaryLink></div>
            </>
          ) : <p className="opc-client-muted-copy">Sobald ein neuer Einsatz bestätigt ist, erscheint er an dieser Stelle.</p>}
        </Card>

        <Card style={{ padding: 22 }}>
          <div className="opc-client-card-heading"><div><span>Letzter Bericht</span><h2>{latestReport ? reportTitle(latestReport) : 'Noch kein Bericht'}</h2></div><FileText size={20} /></div>
          {latestReport ? (
            <>
              <div className="opc-client-detail-line"><CheckCircle2 size={16} /><span>{statusLabel(latestReport.status)}</span></div>
              <div className="opc-client-detail-line"><CalendarDays size={16} /><span>{formatDate(firstValue(latestReport, ['report_date', 'completed_at', 'updated_at', 'created_at']))}</span></div>
              <div style={{ marginTop: 18 }}><PrimaryLink href="/kundenportal/dokumente">Berichte ansehen <ChevronRight size={16} /></PrimaryLink></div>
            </>
          ) : <p className="opc-client-muted-copy">Freigegebene Einsatzberichte werden hier automatisch angezeigt.</p>}
        </Card>

        <Card style={{ padding: 22 }}>
          <div className="opc-client-card-heading"><div><span>Letzte Rechnung</span><h2>{latestInvoice ? firstValue(latestInvoice, ['invoice_number', 'number'], 'Rechnung') : 'Keine Rechnung'}</h2></div><ReceiptText size={20} /></div>
          {latestInvoice ? (
            <>
              <div className="opc-client-detail-line"><CircleDollarSign size={16} /><span>{formatMoney(numberValue(latestInvoice, ['total_chf', 'grand_total_chf', 'total_amount', 'amount']))}</span></div>
              <div className="opc-client-detail-line"><CalendarDays size={16} /><span>Fällig: {formatDate(firstValue(latestInvoice, ['due_date', 'payment_due_date']))}</span></div>
              <div style={{ marginTop: 18 }}><PrimaryLink href="/kundenportal/finanzen">Finanzen öffnen <ChevronRight size={16} /></PrimaryLink></div>
            </>
          ) : <p className="opc-client-muted-copy">Offerten und Rechnungen werden nach Freigabe in diesem Portal bereitgestellt.</p>}
        </Card>
      </div>
    </>
  );
}

function OrdersPage({ data }: { data: PortalDataset }) {
  const sorted = [...data.jobs].sort((a, b) => new Date(jobStart(b)).getTime() - new Date(jobStart(a)).getTime());
  const sites = new Map(data.sites.map((site) => [String(site.id), site]));

  return (
    <>
      <PageTitle eyebrow="Aufträge" title="Meine Aufträge" description="Geplante, laufende und abgeschlossene Reinigungsaufträge Ihres Unternehmens." />
      {sorted.length ? (
        <div className="opc-client-list-grid">
          {sorted.map((job) => {
            const site = sites.get(String(job.client_site_id || job.site_id || ''));
            return (
              <a className="opc-client-order-card" href={buildUrl(`/kundenportal/auftrag/${job.id}`)} key={String(job.id)}>
                <div className="opc-client-order-card-top"><div className="opc-client-document-icon"><ClipboardList size={19} /></div><StatusBadge status={jobStatus(job)} /></div>
                <h2>{jobTitle(job)}</h2>
                <div className="opc-client-detail-line"><CalendarDays size={15} /><span>{formatDateTime(jobStart(job))}</span></div>
                <div className="opc-client-detail-line"><MapPin size={15} /><span>{site ? `${siteLabel(site)}${siteAddress(site) ? ` · ${siteAddress(site)}` : ''}` : firstValue(job, ['site_name', 'site_address', 'city'], 'Standort gemäss Auftrag')}</span></div>
                <div className="opc-client-card-footer"><span>{firstValue(job, ['service_category', 'job_type'], 'Reinigung')}</span><ChevronRight size={17} /></div>
              </a>
            );
          })}
        </div>
      ) : <EmptyState title="Noch keine Aufträge" description="Bestätigte Reinigungsaufträge erscheinen automatisch in diesem Bereich." />}
    </>
  );
}

function OrderDetailPage({ detail }: { detail: NonNullable<PortalResponse['detail']> }) {
  const job = detail.job;
  const site = detail.site;
  return (
    <>
      <div style={{ marginBottom: 16 }}><a className="opc-client-back-link" href={buildUrl('/kundenportal/auftraege')}><ChevronLeft size={17} /> Zurück zu meinen Aufträgen</a></div>
      <PageTitle eyebrow="Auftragsdetails" title={jobTitle(job)} description={firstValue(job, ['service_description'], 'Informationen und freigegebene Dokumentation zu diesem Auftrag.')} action={<StatusBadge status={jobStatus(job)} />} />

      <div className="opc-client-two-column">
        <Card style={{ padding: 22 }}>
          <h2 className="opc-client-section-title">Termin und Standort</h2>
          <div className="opc-client-detail-line"><CalendarDays size={17} /><span>{formatDateTime(jobStart(job))}</span></div>
          <div className="opc-client-detail-line"><Clock3 size={17} /><span>Geplantes Ende: {formatDateTime(firstValue(job, ['planned_end', 'end_time']))}</span></div>
          <div className="opc-client-detail-line"><MapPin size={17} /><span>{site ? `${siteLabel(site)}${siteAddress(site) ? ` · ${siteAddress(site)}` : ''}` : 'Standort gemäss Auftrag'}</span></div>
        </Card>

        <Card style={{ padding: 22 }}>
          <h2 className="opc-client-section-title">Vereinbarte Leistung</h2>
          <div className="opc-client-key-value"><span>Dienstleistung</span><strong>{firstValue(job, ['service_category', 'job_type'], 'Reinigung')}</strong></div>
          <div className="opc-client-key-value"><span>Geschätzter Aufwand</span><strong>{numberValue(job, ['estimated_hours', 'planned_hours']) || '—'} Std.</strong></div>
          <div className="opc-client-key-value"><span>Priorität</span><strong>{statusLabel(firstValue(job, ['priority'], 'normal'))}</strong></div>
        </Card>
      </div>

      {firstValue(job, ['client_notes']) ? (
        <Card style={{ padding: 22, marginTop: 16 }}><h2 className="opc-client-section-title">Ihre Hinweise</h2><p className="opc-client-body-copy">{firstValue(job, ['client_notes'])}</p></Card>
      ) : null}

      <Card style={{ padding: 22, marginTop: 16 }}>
        <h2 className="opc-client-section-title">Berichte zu diesem Auftrag</h2>
        {detail.reports.length ? detail.reports.map((report) => documentRow(report, {
          titleKeys: ['report_title', 'title'],
          numberKeys: ['report_number'],
          statusKeys: ['status'],
          dateKeys: ['report_date', 'completed_at', 'updated_at'],
        })) : <p className="opc-client-muted-copy">Für diesen Auftrag wurde noch kein Bericht freigegeben.</p>}
      </Card>
    </>
  );
}

function SitesPage({ data }: { data: PortalDataset }) {
  return (
    <>
      <PageTitle eyebrow="Objekte" title="Standorte" description="Ihre hinterlegten Liegenschaften, Filialen und Reinigungsobjekte." />
      {data.sites.length ? (
        <div className="opc-client-list-grid">
          {data.sites.map((site) => {
            const jobs = data.jobs.filter((job) => String(job.client_site_id || job.site_id || '') === String(site.id));
            return (
              <Card key={String(site.id)} style={{ padding: 22 }}>
                <div className="opc-client-order-card-top"><div className="opc-client-document-icon"><Building2 size={19} /></div><span className="opc-client-small-label">{jobs.length} Aufträge</span></div>
                <h2 className="opc-client-card-title">{siteLabel(site)}</h2>
                <div className="opc-client-detail-line"><MapPin size={16} /><span>{siteAddress(site) || 'Adresse nicht hinterlegt'}</span></div>
                {firstValue(site, ['site_type']) ? <div className="opc-client-detail-line"><Building2 size={16} /><span>{firstValue(site, ['site_type'])}</span></div> : null}
              </Card>
            );
          })}
        </div>
      ) : <EmptyState title="Keine Standorte hinterlegt" description="Sobald ein Objekt einem Kundenkonto zugeordnet wurde, erscheint es hier." />}
    </>
  );
}

function DocumentsPage({ data }: { data: PortalDataset }) {
  return (
    <>
      <PageTitle eyebrow="Dokumentation" title="Berichte & Dokumente" description="Freigegebene Einsatzberichte, Qualitätsnachweise und allgemeine Kundendokumente." />
      <div className="opc-client-two-column">
        <Card style={{ padding: 22 }}>
          <h2 className="opc-client-section-title">Einsatzberichte</h2>
          {data.reports.length ? data.reports.map((row) => documentRow(row, {
            titleKeys: ['report_title', 'title'],
            numberKeys: ['report_number'],
            statusKeys: ['status'],
            dateKeys: ['report_date', 'completed_at', 'updated_at'],
          })) : <p className="opc-client-muted-copy">Noch keine freigegebenen Einsatzberichte.</p>}
        </Card>
        <Card style={{ padding: 22 }}>
          <h2 className="opc-client-section-title">Weitere Dokumente</h2>
          {data.documents.length ? data.documents.map((row) => documentRow(row, {
            titleKeys: ['title', 'document_title', 'filename', 'name'],
            numberKeys: ['document_number', 'reference_number'],
            statusKeys: ['status'],
            dateKeys: ['document_date', 'created_at'],
          })) : <p className="opc-client-muted-copy">Noch keine weiteren Dokumente bereitgestellt.</p>}
        </Card>
      </div>
    </>
  );
}

function RequestsPage({ identity, data, onReload }: { identity: PortalIdentity; data: PortalDataset; onReload: () => Promise<void> }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ category: 'cleaning_needed', title: '', description: '', site_id: '', priority: 'normal' });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Ihre Sitzung ist abgelaufen.');
      const response = await fetch(buildUrl('/api/opc/client-portal'), {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'create_request', ...form }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.error || 'Anfrage konnte nicht erstellt werden.');
      setMessage(result.message || 'Ihre Anfrage wurde erstellt.');
      setForm({ category: 'cleaning_needed', title: '', description: '', site_id: '', priority: 'normal' });
      setShowForm(false);
      await onReload();
    } catch (err: any) {
      setError(err?.message || 'Anfrage konnte nicht erstellt werden.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageTitle
        eyebrow="Service"
        title="Anfragen & Schäden"
        description="Zusätzliche Reinigungen anfragen oder einen Schaden mit allen relevanten Angaben melden."
        action={identity.permissions.canCreateRequests ? <button className="opc-client-primary-button" type="button" onClick={() => setShowForm((value) => !value)}>{showForm ? <X size={16} /> : <Plus size={16} />}{showForm ? 'Schliessen' : 'Neue Anfrage'}</button> : undefined}
      />

      {error ? <div className="opc-client-error">{error}</div> : null}
      {message ? <div className="opc-client-success">{message}</div> : null}

      {showForm ? (
        <Card style={{ padding: 22, marginBottom: 16 }}>
          <form onSubmit={submit} className="opc-client-request-form">
            <label><span>Anfrageart</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="cleaning_needed">Reinigungsanfrage</option><option value="damage">Schadenmeldung</option></select></label>
            <label><span>Standort</span><select value={form.site_id} onChange={(event) => setForm({ ...form, site_id: event.target.value })}><option value="">Kein bestimmter Standort</option>{data.sites.map((site) => <option key={String(site.id)} value={String(site.id)}>{siteLabel(site)}</option>)}</select></label>
            <label><span>Priorität</span><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="low">Niedrig</option><option value="normal">Normal</option><option value="high">Hoch</option></select></label>
            <label className="wide"><span>Titel</span><input required value={form.title} maxLength={180} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Kurze Zusammenfassung" /></label>
            <label className="wide"><span>Beschreibung</span><textarea required value={form.description} maxLength={3000} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Beschreiben Sie Ihr Anliegen möglichst genau." /></label>
            <div className="wide opc-client-form-actions"><button className="opc-client-primary-button" type="submit" disabled={saving}>{saving ? <Loader2 className="opc-spin" size={16} /> : <Send size={16} />}{saving ? 'Wird gesendet…' : 'Anfrage absenden'}</button></div>
          </form>
        </Card>
      ) : null}

      {data.tickets.length ? (
        <div className="opc-client-list-grid">
          {data.tickets.map((ticket) => {
            const site = data.sites.find((row) => String(row.id) === String(ticket.site_id));
            return (
              <Card key={String(ticket.id)} style={{ padding: 22 }}>
                <div className="opc-client-order-card-top"><div className="opc-client-document-icon">{normalize(ticket.category) === 'damage' ? <AlertTriangle size={19} /> : <MessageSquareWarning size={19} />}</div><StatusBadge status={ticket.status} /></div>
                <h2 className="opc-client-card-title">{firstValue(ticket, ['title', 'ticket_title'], 'Kundenanfrage')}</h2>
                <p className="opc-client-body-copy clamp-3">{firstValue(ticket, ['description', 'message'], 'Keine Beschreibung')}</p>
                <div className="opc-client-row-meta"><span>{firstValue(ticket, ['ticket_number'])}</span><span>{formatDate(firstValue(ticket, ['created_at']))}</span>{site ? <span>{siteLabel(site)}</span> : null}</div>
              </Card>
            );
          })}
        </div>
      ) : <EmptyState title="Noch keine Anfragen" description="Neue Anfragen und Schadenmeldungen erscheinen hier mit ihrem Bearbeitungsstatus." />}
    </>
  );
}

function FinancePage({ data }: { data: PortalDataset }) {
  return (
    <>
      <PageTitle eyebrow="Kundendokumente" title="Offerten & Rechnungen" description="Ihre Angebote, Auftragsunterlagen und Rechnungen an einem Ort." />
      <div className="opc-client-two-column">
        <Card style={{ padding: 22 }}>
          <h2 className="opc-client-section-title">Offerten</h2>
          {data.quotes.length ? data.quotes.map((row) => documentRow(row, {
            titleKeys: ['title', 'quote_title', 'subject'],
            numberKeys: ['quote_number', 'number'],
            statusKeys: ['status'],
            dateKeys: ['quote_date', 'issue_date', 'created_at'],
            amountKeys: ['total_chf', 'grand_total_chf', 'total_amount'],
          })) : <p className="opc-client-muted-copy">Noch keine Offerten freigegeben.</p>}
        </Card>
        <Card style={{ padding: 22 }}>
          <h2 className="opc-client-section-title">Rechnungen</h2>
          {data.invoices.length ? data.invoices.map((row) => documentRow(row, {
            titleKeys: ['title', 'invoice_title', 'subject'],
            numberKeys: ['invoice_number', 'number'],
            statusKeys: ['status'],
            dateKeys: ['invoice_date', 'issue_date', 'created_at'],
            amountKeys: ['total_chf', 'grand_total_chf', 'total_amount', 'amount'],
          })) : <p className="opc-client-muted-copy">Noch keine Rechnungen freigegeben.</p>}
        </Card>
      </div>
    </>
  );
}

function SettingsPage({ identity }: { identity: PortalIdentity }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (newPassword.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    setSaving(true);
    try {
      const result = await supabase.auth.updateUser({ password: newPassword });
      if (result.error) throw result.error;
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Ihr Passwort wurde aktualisiert.');
    } catch (err: any) {
      setError(err?.message || 'Passwort konnte nicht geändert werden.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageTitle eyebrow="Konto" title="Einstellungen" description="Ihre persönlichen Zugangsdaten und Kundenportal-Berechtigungen." />
      {error ? <div className="opc-client-error">{error}</div> : null}
      {message ? <div className="opc-client-success">{message}</div> : null}
      <div className="opc-client-two-column">
        <Card style={{ padding: 22 }}>
          <h2 className="opc-client-section-title">Kundenkonto</h2>
          <div className="opc-client-key-value"><span>Name</span><strong>{identity.display_name}</strong></div>
          <div className="opc-client-key-value"><span>Unternehmen</span><strong>{identity.company_name}</strong></div>
          <div className="opc-client-key-value"><span>E-Mail</span><strong>{identity.email || '—'}</strong></div>
          <div className="opc-client-key-value"><span>Telefon</span><strong>{identity.phone || '—'}</strong></div>
        </Card>
        <Card style={{ padding: 22 }}>
          <h2 className="opc-client-section-title">Passwort ändern</h2>
          <form onSubmit={changePassword} className="opc-client-password-form">
            <label><span>Neues Passwort</span><input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
            <label><span>Passwort bestätigen</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
            <button className="opc-client-primary-button" type="submit" disabled={saving}>{saving ? <Loader2 className="opc-spin" size={16} /> : <LockKeyhole size={16} />}{saving ? 'Wird gespeichert…' : 'Passwort speichern'}</button>
          </form>
        </Card>
      </div>
    </>
  );
}

function PortalContent({
  section,
  identity,
  data,
  detail,
  onReload,
}: {
  section: PortalSection;
  identity: PortalIdentity;
  data: PortalDataset;
  detail?: PortalResponse['detail'];
  onReload: () => Promise<void>;
}) {
  if (section === 'overview') return <OverviewPage identity={identity} data={data} />;
  if (section === 'orders') return <OrdersPage data={data} />;
  if (section === 'order-detail' && detail) return <OrderDetailPage detail={detail} />;
  if (section === 'sites') return <SitesPage data={data} />;
  if (section === 'documents') return <DocumentsPage data={data} />;
  if (section === 'requests') return <RequestsPage identity={identity} data={data} onReload={onReload} />;
  if (section === 'finance') return <FinancePage data={data} />;
  if (section === 'settings') return <SettingsPage identity={identity} />;
  return <EmptyState title="Bereich nicht verfügbar" description="Die gewünschte Kundenportalseite konnte nicht geöffnet werden." />;
}

export default function OpcClientPortalApp({ section, itemId }: { section: PortalSection; itemId?: string }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [identity, setIdentity] = useState<PortalIdentity | null>(null);
  const [data, setData] = useState<PortalDataset>(emptyDataset);
  const [detail, setDetail] = useState<PortalResponse['detail']>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem('opc_client_sidebar_collapsed') === 'true');
  const [mobileOpen, setMobileOpen] = useState(false);

  async function loadPortal() {
    setError('');
    try {
      const nextProfile = await loadOpcAuthProfile();
      if (!nextProfile) {
        safeNavigate(buildUrl('/'), { replace: true });
        return;
      }
      if (normalize(nextProfile.role) !== 'client' && normalize(nextProfile.role) !== 'kunde') {
        safeNavigate(buildUrl('/dashboard'), { replace: true });
        return;
      }
      setProfile(nextProfile);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.');

      const query = section === 'order-detail' && itemId ? `?job_id=${encodeURIComponent(itemId)}` : '';
      const response = await fetch(buildUrl(`/api/opc/client-portal${query}`), {
        method: 'GET',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const result = (await response.json().catch(() => null)) as PortalResponse | null;
      if (!response.ok || !result?.ok || !result.portal) {
        throw new Error(result?.error || 'Kundenportal konnte nicht geladen werden.');
      }
      setIdentity(result.portal);
      if (result.data) setData(result.data);
      if (result.detail) setDetail(result.detail);
      setWarnings(result.warnings || result.detail?.warnings || []);
    } catch (err: any) {
      setError(err?.message || 'Kundenportal konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPortal();
  }, [section, itemId]);

  useEffect(() => {
    document.documentElement.style.setProperty('--opc-client-sidebar-width', collapsed ? '82px' : '286px');
    window.localStorage.setItem('opc_client_sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  async function logout() {
    clearCachedOpcAuthProfile();
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } finally {
      safeNavigate(buildUrl('/'), { replace: true });
    }
  }

  if (loading) {
    return <div className="opc-client-loading"><Loader2 size={22} className="opc-spin" /><span>Kundenportal wird geladen…</span><PortalStyles /></div>;
  }

  if (error || !identity || !profile) {
    return (
      <div className="opc-client-loading">
        <Card style={{ maxWidth: 520, padding: 28, textAlign: 'center' }}>
          <AlertTriangle size={25} color={BRAND.red} />
          <h1 style={{ fontSize: 22, margin: '12px 0 8px' }}>Kundenportal nicht verfügbar</h1>
          <p className="opc-client-muted-copy">{error || 'Das Kundenkonto konnte nicht geladen werden.'}</p>
          <a className="opc-client-primary-button" href={buildUrl('/')}>Zur Anmeldung</a>
        </Card>
        <PortalStyles />
      </div>
    );
  }

  const sidebarWidth = collapsed ? 82 : 286;

  return (
    <div className="opc-client-portal-shell">
      <ClientSidebar
        section={section}
        identity={identity}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggle={() => setCollapsed((value) => !value)}
        onCloseMobile={() => setMobileOpen(false)}
        onLogout={() => void logout()}
      />

      <header className="opc-client-mobile-header">
        <button type="button" onClick={() => setMobileOpen(true)}><Menu size={21} /></button>
        <img src={LOGO_URL} alt="Orange Pro Clean GmbH" />
        <div className="opc-client-avatar small">{getInitials(identity.display_name)}</div>
      </header>

      <main className="opc-client-main" style={{ marginLeft: sidebarWidth }}>
        {warnings.length ? <div className="opc-client-warning">Einzelne Datenbereiche konnten nicht vollständig geladen werden. Die verfügbaren Kundeninformationen werden weiterhin angezeigt.</div> : null}
        <PortalContent section={section} identity={identity} data={data} detail={detail} onReload={loadPortal} />
      </main>

      <PortalStyles />
    </div>
  );
}

function PortalStyles() {
  return (
    <style>{`
      :root { --opc-client-sidebar-width: 286px; }
      html, body { margin: 0; min-height: 100%; background: #FAFAFA; color: ${BRAND.text}; font-family: ${pageFont}; }
      * { box-sizing: border-box; }
      a, button, input, select, textarea { font-family: ${pageFont}; }
      .opc-spin { animation: opc-client-spin .9s linear infinite; }
      @keyframes opc-client-spin { to { transform: rotate(360deg); } }
      .opc-client-loading { min-height: 100vh; display: flex; gap: 10px; align-items: center; justify-content: center; padding: 24px; color: ${BRAND.muted}; font-weight: 720; font-family: ${pageFont}; background: #FAFAFA; }
      .opc-client-sidebar { position: fixed; inset: 0 auto 0 0; height: 100vh; background: #FFF; border-right: 1px solid ${BRAND.border}; z-index: 100; display: flex; flex-direction: column; padding: 22px 14px 16px; transition: width .25s ease, transform .25s ease; overflow: hidden; }
      .opc-client-sidebar-logo { min-height: 74px; display: flex; align-items: center; justify-content: center; padding: 4px 8px 14px; }
      .opc-client-sidebar-logo img { width: 218px; max-width: 100%; height: auto; display: block; }
      .opc-client-logo-mark { width: 46px; height: 46px; border-radius: 15px; display: grid; place-items: center; background: ${BRAND.orange}; color: #FFF; font-size: 20px; font-weight: 900; }
      .opc-client-portal-label { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 36px; margin: 2px 4px 10px; border-radius: 12px; background: #FFF7ED; color: #9A3412; font-size: 12px; font-weight: 850; white-space: nowrap; }
      .opc-client-collapse-button { min-height: 42px; border: 0; background: transparent; color: ${BRAND.muted}; display: flex; align-items: center; justify-content: flex-start; gap: 11px; padding: 0 13px; font-size: 13px; font-weight: 720; border-radius: 12px; cursor: pointer; margin-bottom: 8px; }
      .opc-client-collapse-button:hover { background: ${BRAND.soft}; color: ${BRAND.text}; }
      .opc-client-nav { display: flex; flex-direction: column; gap: 5px; overflow-y: auto; flex: 1; }
      .opc-client-nav a { min-height: 46px; display: flex; align-items: center; gap: 13px; padding: 0 14px; border-radius: 14px; text-decoration: none; color: ${BRAND.muted}; font-size: 14px; font-weight: 680; white-space: nowrap; }
      .opc-client-nav a:hover { background: ${BRAND.soft}; color: ${BRAND.text}; }
      .opc-client-nav a.active { background: #F2F2F2; color: ${BRAND.text}; font-weight: 820; }
      .opc-client-sidebar.is-collapsed .opc-client-nav a, .opc-client-sidebar.is-collapsed .opc-client-collapse-button { justify-content: center; padding: 0; }
      .opc-client-sidebar-profile { display: flex; align-items: center; gap: 11px; padding: 14px 6px 0; border-top: 1px solid ${BRAND.border}; }
      .opc-client-sidebar-profile button { width: 38px; height: 38px; border: 0; border-radius: 12px; background: transparent; color: ${BRAND.muted}; cursor: pointer; display: grid; place-items: center; }
      .opc-client-sidebar-profile button:hover { background: ${BRAND.soft}; color: ${BRAND.text}; }
      .opc-client-avatar { width: 42px; height: 42px; border-radius: 50%; background: ${BRAND.black}; color: #FFF; display: grid; place-items: center; font-size: 13px; font-weight: 850; flex-shrink: 0; }
      .opc-client-avatar.small { width: 34px; height: 34px; font-size: 11px; }
      .opc-client-profile-name { font-size: 13px; font-weight: 830; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .opc-client-profile-company { margin-top: 3px; color: ${BRAND.muted}; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .opc-client-main { min-height: 100vh; padding: 34px 40px 120px; transition: margin-left .25s ease; }
      .opc-client-mobile-header { display: none; }
      .opc-client-page-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 22px; }
      .opc-client-page-title h1 { margin: 0; font-size: 34px; line-height: 1.05; letter-spacing: -.045em; font-weight: 900; }
      .opc-client-page-title p { margin: 10px 0 0; color: ${BRAND.muted}; font-size: 14px; line-height: 1.6; max-width: 780px; }
      .opc-client-eyebrow { color: ${BRAND.orange}; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 9px; }
      .opc-client-primary-button { min-height: 44px; padding: 0 16px; border-radius: 13px; border: 1px solid ${BRAND.black}; background: ${BRAND.black}; color: #FFF; display: inline-flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; font-size: 13px; font-weight: 830; cursor: pointer; white-space: nowrap; }
      .opc-client-primary-button:disabled { opacity: .55; cursor: wait; }
      .opc-client-metric-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 14px; margin-bottom: 16px; }
      .opc-client-metric-grid section { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; align-items: center; }
      .opc-client-metric-grid section svg { color: ${BRAND.muted}; }
      .opc-client-metric-grid strong { font-size: 29px; line-height: 1; font-weight: 900; }
      .opc-client-metric-grid span { grid-column: 1 / -1; color: ${BRAND.muted}; font-size: 12px; font-weight: 720; margin-top: 10px; }
      .opc-client-overview-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 14px; }
      .opc-client-card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
      .opc-client-card-heading span { color: ${BRAND.muted}; font-size: 11px; font-weight: 850; text-transform: uppercase; letter-spacing: .06em; }
      .opc-client-card-heading h2 { margin: 6px 0 0; font-size: 18px; line-height: 1.25; font-weight: 880; }
      .opc-client-detail-line { display: flex; align-items: flex-start; gap: 9px; color: ${BRAND.muted}; font-size: 13px; line-height: 1.5; margin-top: 10px; }
      .opc-client-detail-line svg { flex-shrink: 0; margin-top: 1px; }
      .opc-client-muted-copy, .opc-client-body-copy { color: ${BRAND.muted}; font-size: 13px; line-height: 1.65; margin: 8px 0 0; }
      .opc-client-body-copy { color: #374151; }
      .clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
      .opc-client-list-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 14px; }
      .opc-client-order-card { min-height: 245px; padding: 22px; background: #FFF; border: 1px solid ${BRAND.border}; border-radius: 20px; box-shadow: 0 1px 2px rgba(15,17,21,.04); color: ${BRAND.text}; text-decoration: none; display: flex; flex-direction: column; }
      .opc-client-order-card:hover { border-color: #D1D5DB; transform: translateY(-1px); }
      .opc-client-order-card-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .opc-client-order-card h2, .opc-client-card-title { margin: 18px 0 5px; font-size: 18px; line-height: 1.3; font-weight: 880; }
      .opc-client-card-footer { margin-top: auto; padding-top: 18px; border-top: 1px solid ${BRAND.border}; display: flex; align-items: center; justify-content: space-between; gap: 12px; color: ${BRAND.muted}; font-size: 12px; font-weight: 750; }
      .opc-client-document-icon { width: 42px; height: 42px; border-radius: 13px; background: ${BRAND.soft}; display: grid; place-items: center; color: ${BRAND.text}; flex-shrink: 0; }
      .opc-client-small-label { color: ${BRAND.muted}; font-size: 12px; font-weight: 760; }
      .opc-client-two-column { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; }
      .opc-client-section-title { margin: 0 0 16px; font-size: 18px; font-weight: 880; letter-spacing: -.025em; }
      .opc-client-key-value { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding: 13px 0; border-bottom: 1px solid ${BRAND.border}; font-size: 13px; }
      .opc-client-key-value:last-child { border-bottom: 0; }
      .opc-client-key-value span { color: ${BRAND.muted}; }
      .opc-client-key-value strong { text-align: right; }
      .opc-client-document-row { min-height: 68px; display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid ${BRAND.border}; }
      .opc-client-document-row:last-child { border-bottom: 0; }
      .opc-client-row-meta { display: flex; flex-wrap: wrap; gap: 6px 12px; color: ${BRAND.muted}; font-size: 11px; margin-top: 5px; }
      .opc-client-icon-button { width: 38px; height: 38px; border: 1px solid ${BRAND.border}; border-radius: 11px; display: grid; place-items: center; color: ${BRAND.text}; text-decoration: none; flex-shrink: 0; }
      .opc-client-back-link { display: inline-flex; align-items: center; gap: 7px; color: ${BRAND.muted}; font-size: 13px; font-weight: 760; text-decoration: none; }
      .opc-client-request-form { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 14px; }
      .opc-client-request-form label, .opc-client-password-form label { display: grid; gap: 7px; color: ${BRAND.text}; font-size: 12px; font-weight: 800; }
      .opc-client-request-form .wide { grid-column: 1 / -1; }
      .opc-client-request-form input, .opc-client-request-form select, .opc-client-request-form textarea, .opc-client-password-form input { width: 100%; border: 1px solid ${BRAND.border}; border-radius: 13px; background: #FFF; color: ${BRAND.text}; padding: 0 13px; outline: 0; font-size: 14px; }
      .opc-client-request-form input, .opc-client-request-form select, .opc-client-password-form input { height: 46px; }
      .opc-client-request-form textarea { min-height: 120px; padding-top: 12px; resize: vertical; }
      .opc-client-form-actions { display: flex; justify-content: flex-end; }
      .opc-client-password-form { display: grid; gap: 14px; }
      .opc-client-password-form button { justify-self: start; }
      .opc-client-error, .opc-client-success, .opc-client-warning { padding: 13px 15px; border-radius: 14px; font-size: 13px; line-height: 1.5; font-weight: 720; margin-bottom: 16px; }
      .opc-client-error { background: ${BRAND.redBg}; color: ${BRAND.red}; border: 1px solid #FECACA; }
      .opc-client-success { background: ${BRAND.greenBg}; color: ${BRAND.green}; border: 1px solid #BBF7D0; }
      .opc-client-warning { background: ${BRAND.amberBg}; color: ${BRAND.amber}; border: 1px solid #FDE68A; }
      .opc-client-mobile-backdrop { display: none; }
      @media (max-width: 1180px) {
        .opc-client-metric-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
        .opc-client-overview-grid, .opc-client-list-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
      }
      @media (max-width: 820px) {
        .opc-client-sidebar { width: 286px !important; transform: translateX(-105%); box-shadow: 20px 0 50px rgba(0,0,0,.12); }
        .opc-client-sidebar.is-mobile-open { transform: translateX(0); }
        .opc-client-sidebar.is-collapsed .opc-client-nav a, .opc-client-sidebar.is-collapsed .opc-client-collapse-button { justify-content: flex-start; padding: 0 14px; }
        .opc-client-sidebar.is-collapsed .opc-client-nav a span, .opc-client-sidebar.is-collapsed .opc-client-collapse-button span { display: inline; }
        .opc-client-mobile-backdrop { display: block; position: fixed; inset: 0; border: 0; background: rgba(15,17,21,.32); z-index: 90; }
        .opc-client-mobile-header { height: 66px; padding: 0 16px; background: #FFF; border-bottom: 1px solid ${BRAND.border}; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 70; }
        .opc-client-mobile-header button { width: 38px; height: 38px; border: 0; border-radius: 11px; background: ${BRAND.soft}; display: grid; place-items: center; }
        .opc-client-mobile-header img { height: 45px; width: auto; max-width: 190px; object-fit: contain; }
        .opc-client-main { margin-left: 0 !important; padding: 24px 18px 100px; }
        .opc-client-page-title { flex-direction: column; }
        .opc-client-page-title h1 { font-size: 29px; }
        .opc-client-two-column { grid-template-columns: 1fr; }
        .opc-client-request-form { grid-template-columns: 1fr; }
        .opc-client-request-form .wide { grid-column: auto; }
      }
      @media (max-width: 580px) {
        .opc-client-metric-grid, .opc-client-overview-grid, .opc-client-list-grid { grid-template-columns: 1fr; }
        .opc-client-document-row { align-items: flex-start; flex-wrap: wrap; }
        .opc-client-document-row .opc-client-icon-button { margin-left: auto; }
      }
    `}</style>
  );
}
