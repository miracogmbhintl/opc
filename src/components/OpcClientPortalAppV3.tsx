import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Download,
  FileText,
  LockKeyhole,
  MapPin,
  MessageSquare,
  Plus,
  ReceiptText,
  Search,
  Send,
  ShieldAlert,
  WalletCards,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import MirakaDashboardShell from './MirakaDashboardShell';
import PortalSkeleton from './shared/PortalSkeleton';
import {
  OPCPageShell,
  OPCTabs,
  OPCMetricsGrid,
  OPCMetricCard,
  OPCToolbar,
  OPCListCard,
  OPC_BRAND,
  OPC_PAGE_FONT,
  opcResponsiveStyle,
  opcSelectStyle,
  opcInputStyle,
  opcInputWithIconStyle,
  opcSearchIconStyle,
  opcBlackButtonStyle,
  opcSecondaryButtonStyle,
  opcCardStyle,
} from './opc/OPCPageTop';

type AnyRow = Record<string, any>;
type PortalSection =
  | 'overview'
  | 'orders'
  | 'order-detail'
  | 'sites'
  | 'documents'
  | 'requests'
  | 'finance'
  | 'quote-detail'
  | 'invoice-detail'
  | 'settings';

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
  detail?: AnyRow;
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

function buildUrl(path: string) {
  return `${String(baseUrl || '').replace(/\/$/, '')}${path}`;
}

function normalize(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function metadata(row: AnyRow | null | undefined) {
  const value = row?.metadata;
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRow : {};
}

function firstValue(row: AnyRow | null | undefined, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') return String(value);
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
  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value: unknown) {
  if (!value) return 'Termin folgt';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'Termin folgt';
  return new Intl.DateTimeFormat('de-CH', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function jobTitle(row: AnyRow) {
  return firstValue(row, ['title', 'job_title', 'service_category', 'job_type'], 'Reinigungsauftrag');
}

function jobStart(row: AnyRow) {
  return firstValue(row, ['planned_start', 'start_time', 'scheduled_at', 'date_time']);
}

function siteName(row: AnyRow | null | undefined) {
  return firstValue(row, ['site_name', 'name', 'title', 'address_text'], 'Standort');
}

function siteAddress(row: AnyRow | null | undefined) {
  const direct = firstValue(row, ['address_text', 'formatted_address']);
  const city = [firstValue(row, ['postal_code', 'zip']), firstValue(row, ['city'])].filter(Boolean).join(' ');
  if (direct) return city && !direct.includes(city) ? `${direct}, ${city}` : direct;
  return [firstValue(row, ['street', 'address']), city].filter(Boolean).join(', ');
}

function documentTitle(row: AnyRow, type: 'quote' | 'invoice') {
  return firstValue(
    row,
    type === 'quote' ? ['title', 'quote_title', 'subject'] : ['title', 'invoice_title', 'subject'],
    type === 'quote' ? 'Offerte' : 'Rechnung',
  );
}

function documentNumber(row: AnyRow, type: 'quote' | 'invoice') {
  return firstValue(row, type === 'quote' ? ['quote_number', 'number'] : ['invoice_number', 'number']);
}

function documentTotal(row: AnyRow) {
  return numberValue(row, ['total_chf', 'grand_total_chf', 'total_amount', 'amount']);
}

function documentUrl(row: AnyRow | null | undefined) {
  const keys = ['download_url', 'file_url', 'public_url', 'pdf_url', 'document_url', 'signed_url'];
  return firstValue(row, keys) || firstValue(metadata(row), keys);
}

function statusLabel(status: unknown) {
  const clean = normalize(status);
  const labels: Record<string, string> = {
    draft: 'Entwurf',
    ready: 'Bereit',
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
    declined: 'Abgelehnt',
    sent: 'Versendet',
    viewed: 'Gesehen',
    paid: 'Bezahlt',
    partially_paid: 'Teilbezahlt',
    overdue: 'Überfällig',
    cancelled: 'Storniert',
  };
  return labels[clean] || clean.replace(/_/g, ' ') || 'Unbekannt';
}

function statusGroup(status: unknown): 'done' | 'progress' | 'danger' | 'neutral' {
  const clean = normalize(status);
  if (['completed', 'approved', 'report_approved', 'sent_to_client', 'published', 'resolved', 'closed', 'accepted', 'paid'].includes(clean)) return 'done';
  if (['in_progress', 'on_site', 'started', 'running', 'open', 'new'].includes(clean)) return 'progress';
  if (['overdue', 'cancelled', 'declined', 'expired', 'rejected'].includes(clean)) return 'danger';
  return 'neutral';
}

function StatusBadge({ status }: { status: unknown }) {
  const group = statusGroup(status);
  const style: CSSProperties =
    group === 'done'
      ? { background: '#DCFCE7', color: OPC_BRAND.green }
      : group === 'progress'
        ? { background: '#FFF7ED', color: '#9A3412' }
        : group === 'danger'
          ? { background: '#FEF2F2', color: OPC_BRAND.red }
          : { background: '#F8FAFC', color: OPC_BRAND.muted };

  return <span style={{ ...pillStyle, ...style }}>{statusLabel(status)}</span>;
}

function PageIntro({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div style={pageIntroStyle}>
      <div>
        <h1 style={pageTitleStyle}>{title}</h1>
        <p style={pageDescriptionStyle}>{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

function currentPathFor(section: PortalSection) {
  if (section === 'orders' || section === 'order-detail' || section === 'sites') return '/einsaetze';
  if (section === 'requests') return '/anfragen-schaeden';
  if (section === 'documents' || section === 'finance' || section === 'quote-detail' || section === 'invoice-detail') return '/berichte-dateien';
  if (section === 'settings') return '/einstellungen';
  return '/dashboard';
}

function OverviewPage({ identity, data }: { identity: PortalIdentity; data: PortalDataset }) {
  const now = Date.now();
  const upcoming = data.jobs.filter((job) => {
    const time = new Date(jobStart(job)).getTime();
    return Number.isFinite(time) && time >= now && !['completed', 'cancelled', 'report_approved'].includes(normalize(job.status));
  });
  const active = data.jobs.filter((job) => ['assigned', 'confirmed', 'in_progress', 'on_site', 'started', 'running'].includes(normalize(job.status)));
  const openTickets = data.tickets.filter((ticket) => ['new', 'open', 'in_progress'].includes(normalize(ticket.status)));
  const openInvoices = data.invoices.filter((invoice) => ['sent', 'open', 'overdue', 'pending', 'partially_paid'].includes(normalize(invoice.status)));
  const nextJob = [...upcoming].sort((a, b) => new Date(jobStart(a)).getTime() - new Date(jobStart(b)).getTime())[0];

  return (
    <OPCPageShell>
      <PageIntro title={`Guten Tag, ${identity.display_name.split(/\s+/)[0] || identity.display_name}`} description={`Kundenportal von ${identity.company_name}`} />
      <OPCMetricsGrid>
        <OPCMetricCard value={upcoming.length} label="Bevorstehende Einsätze" icon={<CalendarDays size={18} />} />
        <OPCMetricCard value={active.length} label="Aktive Aufträge" icon={<ClipboardList size={18} />} />
        <OPCMetricCard value={openTickets.length} label="Offene Anfragen" icon={<MessageSquare size={18} />} />
        <OPCMetricCard value={openInvoices.length} label="Offene Rechnungen" icon={<CircleDollarSign size={18} />} tone={openInvoices.length ? 'warning' : 'neutral'} />
      </OPCMetricsGrid>

      <div style={overviewGridStyle}>
        <section style={{ ...opcCardStyle, padding: 22 }}>
          <div style={sectionTopStyle}><div><span style={eyebrowStyle}>Nächster Einsatz</span><h2 style={sectionTitleStyle}>{nextJob ? jobTitle(nextJob) : 'Kein Einsatz geplant'}</h2></div><CalendarDays size={20} /></div>
          {nextJob ? (
            <>
              <div style={detailLineStyle}><CalendarDays size={16} />{formatDateTime(jobStart(nextJob))}</div>
              <div style={detailLineStyle}><MapPin size={16} />{firstValue(nextJob, ['site_name', 'site_address', 'city'], 'Standort gemäss Auftrag')}</div>
              <a href={buildUrl(`/kundenportal/auftrag/${nextJob.id}`)} style={{ ...opcBlackButtonStyle, width: 'auto', marginTop: 20 }}>Auftrag öffnen</a>
            </>
          ) : <p style={mutedCopyStyle}>Neue bestätigte Termine erscheinen automatisch hier.</p>}
        </section>

        <section style={{ ...opcCardStyle, padding: 22 }}>
          <div style={sectionTopStyle}><div><span style={eyebrowStyle}>Schnellzugriff</span><h2 style={sectionTitleStyle}>Kundenbereiche</h2></div></div>
          <QuickLink href="/kundenportal/auftraege" icon={<ClipboardList size={18} />} label="Meine Aufträge" />
          <QuickLink href="/kundenportal/dokumente" icon={<FileText size={18} />} label="Berichte & Dokumente" />
          <QuickLink href="/kundenportal/finanzen" icon={<WalletCards size={18} />} label="Offerten & Rechnungen" />
          <QuickLink href="/kundenportal/anfragen" icon={<MessageSquare size={18} />} label="Anfragen & Schäden" />
        </section>
      </div>

      <style>{opcResponsiveStyle}</style>
    </OPCPageShell>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return <a href={buildUrl(href)} style={quickLinkStyle}>{icon}<span>{label}</span><span>Öffnen</span></a>;
}

function OrdersPage({ data, showSites = false }: { data: PortalDataset; showSites?: boolean }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const sites = new Map(data.sites.map((site) => [String(site.id), site]));
  const filtered = useMemo(() => data.jobs.filter((job) => {
    const matchesStatus = status === 'all' || normalize(job.status) === status;
    const site = sites.get(String(job.client_site_id || job.site_id || ''));
    const haystack = [jobTitle(job), firstValue(job, ['service_category', 'job_type']), siteName(site), siteAddress(site), statusLabel(job.status)].join(' ').toLowerCase();
    return matchesStatus && (!search.trim() || haystack.includes(search.trim().toLowerCase()));
  }), [data.jobs, data.sites, search, status]);

  const active = data.jobs.filter((job) => ['assigned', 'confirmed', 'in_progress', 'on_site', 'started', 'running'].includes(normalize(job.status))).length;
  const completed = data.jobs.filter((job) => ['completed', 'report_approved', 'approved', 'sent_to_client'].includes(normalize(job.status))).length;

  if (showSites) return <SitesPage data={data} />;

  return (
    <OPCPageShell>
      <OPCTabs tabs={[
        { key: 'orders', label: 'Meine Aufträge', active: true, onClick: () => window.location.assign(buildUrl('/kundenportal/auftraege')) },
        { key: 'sites', label: 'Standorte', active: false, onClick: () => window.location.assign(buildUrl('/kundenportal/standorte')) },
      ]} />
      <OPCMetricsGrid>
        <OPCMetricCard value={data.jobs.length} label="Aufträge" icon={<ClipboardList size={18} />} />
        <OPCMetricCard value={active} label="Aktiv" icon={<CalendarDays size={18} />} />
        <OPCMetricCard value={completed} label="Abgeschlossen" icon={<CheckCircle2 size={18} />} tone="success" />
        <OPCMetricCard value={data.sites.length} label="Standorte" icon={<Building2 size={18} />} />
      </OPCMetricsGrid>
      <OPCToolbar columns="minmax(0, 1fr) 220px">
        <div style={{ position: 'relative', minWidth: 0 }}><Search size={17} style={opcSearchIconStyle} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Aufträge oder Standorte suchen..." style={opcInputWithIconStyle} /></div>
        <select value={status} onChange={(event) => setStatus(event.target.value)} style={opcSelectStyle}>
          <option value="all">Alle Status</option><option value="scheduled">Geplant</option><option value="confirmed">Bestätigt</option><option value="in_progress">In Bearbeitung</option><option value="completed">Abgeschlossen</option><option value="report_approved">Bericht freigegeben</option>
        </select>
      </OPCToolbar>
      <OPCListCard>
        {filtered.length ? <div className="opc-client-desktop-table">{filtered.map((job, index) => {
          const site = sites.get(String(job.client_site_id || job.site_id || ''));
          return <a key={String(job.id)} href={buildUrl(`/kundenportal/auftrag/${job.id}`)} style={{ ...desktopRowStyle, gridTemplateColumns: 'minmax(280px, 1.2fr) minmax(220px, 1fr) minmax(240px, 1fr) 150px 92px', borderBottom: index < filtered.length - 1 ? '1px solid #F3F4F6' : 'none' }}><RowTitle icon={<ClipboardList size={18} />} title={jobTitle(job)} subtitle={firstValue(job, ['service_category', 'job_type'], 'Reinigung')} /><div style={dateStyle}>{formatDateTime(jobStart(job))}</div><div><div style={rowTitleStyle}>{siteName(site)}</div><div style={rowSubStyle}>{siteAddress(site) || '—'}</div></div><StatusBadge status={job.status} /><span style={openButtonStyle}>Öffnen</span></a>;
        })}</div> : <EmptyBlock title="Keine Aufträge vorhanden" text="Neue bestätigte Aufträge erscheinen automatisch hier." />}
      </OPCListCard>
      <style>{`${opcResponsiveStyle}${portalResponsiveStyle}`}</style>
    </OPCPageShell>
  );
}

function SitesPage({ data }: { data: PortalDataset }) {
  const [search, setSearch] = useState('');
  const filtered = data.sites.filter((site) => [siteName(site), siteAddress(site), firstValue(site, ['site_type'])].join(' ').toLowerCase().includes(search.toLowerCase()));
  return (
    <OPCPageShell>
      <OPCTabs tabs={[
        { key: 'orders', label: 'Meine Aufträge', active: false, onClick: () => window.location.assign(buildUrl('/kundenportal/auftraege')) },
        { key: 'sites', label: 'Standorte', active: true, onClick: () => window.location.assign(buildUrl('/kundenportal/standorte')) },
      ]} />
      <OPCMetricsGrid>
        <OPCMetricCard value={data.sites.length} label="Standorte" icon={<Building2 size={18} />} />
        <OPCMetricCard value={data.jobs.length} label="Aufträge" icon={<ClipboardList size={18} />} />
        <OPCMetricCard value={data.reports.length} label="Berichte" icon={<FileText size={18} />} />
        <OPCMetricCard value={data.tickets.filter((row) => !['resolved', 'closed'].includes(normalize(row.status))).length} label="Offene Anfragen" icon={<MessageSquare size={18} />} />
      </OPCMetricsGrid>
      <OPCToolbar columns="minmax(0, 1fr)"><div style={{ position: 'relative', minWidth: 0 }}><Search size={17} style={opcSearchIconStyle} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Standorte durchsuchen..." style={opcInputWithIconStyle} /></div></OPCToolbar>
      <OPCListCard>{filtered.length ? filtered.map((site, index) => {
        const jobs = data.jobs.filter((job) => String(job.client_site_id || job.site_id || '') === String(site.id));
        return <div key={String(site.id)} style={{ ...desktopRowStyle, gridTemplateColumns: 'minmax(300px, 1.2fr) minmax(280px, 1fr) 160px', borderBottom: index < filtered.length - 1 ? '1px solid #F3F4F6' : 'none' }}><RowTitle icon={<Building2 size={18} />} title={siteName(site)} subtitle={statusLabel(firstValue(site, ['site_type'], 'Standort'))} /><div><div style={rowTitleStyle}>{siteAddress(site) || 'Adresse nicht hinterlegt'}</div><div style={rowSubStyle}>Reinigungsobjekt</div></div><span style={countBadgeStyle}>{jobs.length} {jobs.length === 1 ? 'Auftrag' : 'Aufträge'}</span></div>;
      }) : <EmptyBlock title="Keine Standorte vorhanden" text="Zugeordnete Kundenstandorte erscheinen hier." />}</OPCListCard>
      <style>{opcResponsiveStyle}</style>
    </OPCPageShell>
  );
}

function DocumentsPage({ data, initialTab = 'reports' }: { data: PortalDataset; initialTab?: 'reports' | 'quotes' | 'invoices' }) {
  const [tab, setTab] = useState<'reports' | 'quotes' | 'invoices'>(initialTab);
  const [search, setSearch] = useState('');
  const rows = tab === 'reports' ? data.reports : tab === 'quotes' ? data.quotes : data.invoices;
  const filtered = rows.filter((row) => [firstValue(row, ['title', 'report_title', 'quote_number', 'invoice_number']), firstValue(row, ['status']), firstValue(row, ['description'])].join(' ').toLowerCase().includes(search.toLowerCase()));
  return (
    <OPCPageShell>
      <OPCTabs tabs={[
        { key: 'reports', label: 'Berichte & Dateien', active: tab === 'reports', onClick: () => setTab('reports') },
        { key: 'quotes', label: 'Offerten', active: tab === 'quotes', onClick: () => setTab('quotes') },
        { key: 'invoices', label: 'Rechnungen', active: tab === 'invoices', onClick: () => setTab('invoices') },
      ]} />
      <OPCMetricsGrid>
        <OPCMetricCard value={data.reports.length} label="Freigegebene Berichte" icon={<FileText size={18} />} />
        <OPCMetricCard value={data.quotes.length} label="Offerten" icon={<ReceiptText size={18} />} />
        <OPCMetricCard value={data.invoices.length} label="Rechnungen" icon={<WalletCards size={18} />} />
        <OPCMetricCard value={data.invoices.filter((row) => ['sent', 'open', 'overdue', 'partially_paid'].includes(normalize(row.status))).length} label="Offene Rechnungen" icon={<CircleDollarSign size={18} />} />
      </OPCMetricsGrid>
      <OPCToolbar columns="minmax(0, 1fr)"><div style={{ position: 'relative', minWidth: 0 }}><Search size={17} style={opcSearchIconStyle} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Dokumente durchsuchen..." style={opcInputWithIconStyle} /></div></OPCToolbar>
      <OPCListCard>{filtered.length ? filtered.map((row, index) => {
        const type = tab === 'quotes' ? 'quote' as const : tab === 'invoices' ? 'invoice' as const : null;
        const href = type === 'quote' ? `/kundenportal/offerte/${row.id}` : type === 'invoice' ? `/kundenportal/rechnung/${row.id}` : documentUrl(row);
        const content = <><RowTitle icon={type === 'invoice' ? <WalletCards size={18} /> : <FileText size={18} />} title={type ? documentTitle(row, type) : firstValue(row, ['report_title', 'title'], 'Einsatzbericht')} subtitle={type ? documentNumber(row, type) : formatDate(firstValue(row, ['report_date', 'completed_at', 'updated_at']))} /><div style={dateStyle}>{formatDate(firstValue(row, ['issue_date', 'report_date', 'created_at', 'updated_at']))}</div><div style={dateStyle}>{type ? formatMoney(documentTotal(row)) : firstValue(row, ['description'], 'Qualitätsbericht')}</div><StatusBadge status={row.status} /><span style={openButtonStyle}>{href ? 'Öffnen' : 'Verfügbar'}</span></>;
        const style = { ...desktopRowStyle, gridTemplateColumns: 'minmax(300px, 1.2fr) 170px minmax(200px, 1fr) 150px 92px', borderBottom: index < filtered.length - 1 ? '1px solid #F3F4F6' : 'none' };
        return href ? <a key={String(row.id)} href={type ? buildUrl(href) : href} target={!type ? '_blank' : undefined} rel={!type ? 'noreferrer' : undefined} style={style}>{content}</a> : <div key={String(row.id)} style={style}>{content}</div>;
      }) : <EmptyBlock title="Keine Dokumente vorhanden" text="Freigegebene Dokumente erscheinen hier." />}</OPCListCard>
      <style>{opcResponsiveStyle}</style>
    </OPCPageShell>
  );
}

function RequestsPage({ identity, data, reload }: { identity: PortalIdentity; data: PortalDataset; reload: () => Promise<void> }) {
  const [tab, setTab] = useState<'tickets' | 'damages'>('tickets');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ category: 'cleaning_needed', title: '', description: '', site_id: '', priority: 'normal' });
  const rows = data.tickets.filter((row) => tab === 'damages' ? normalize(row.category) === 'damage' : normalize(row.category) !== 'damage');
  const filtered = rows.filter((row) => (status === 'all' || normalize(row.status) === status) && [row.title, row.description, row.ticket_number, statusLabel(row.status)].join(' ').toLowerCase().includes(search.toLowerCase()));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Ihre Sitzung ist abgelaufen.');
      const response = await fetch(buildUrl('/api/opc/client-portal'), { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'create_request', ...form }) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.error || 'Anfrage konnte nicht erstellt werden.');
      setMessage(result.message || 'Ihre Anfrage wurde erstellt.');
      setForm({ category: 'cleaning_needed', title: '', description: '', site_id: '', priority: 'normal' });
      setShowForm(false);
      await reload();
    } catch (err: any) { setError(err?.message || 'Anfrage konnte nicht erstellt werden.'); } finally { setSaving(false); }
  }

  return (
    <OPCPageShell>
      <OPCTabs tabs={[
        { key: 'tickets', label: 'Anfragen', active: tab === 'tickets', onClick: () => setTab('tickets') },
        { key: 'damages', label: 'Schäden', active: tab === 'damages', onClick: () => setTab('damages') },
      ]} />
      <OPCMetricsGrid>
        <OPCMetricCard value={data.tickets.filter((row) => normalize(row.category) !== 'damage' && !['resolved', 'closed'].includes(normalize(row.status))).length} label="Offene Anfragen" icon={<MessageSquare size={18} />} />
        <OPCMetricCard value={data.tickets.filter((row) => normalize(row.category) === 'damage' && !['resolved', 'closed'].includes(normalize(row.status))).length} label="Schäden offen" icon={<ShieldAlert size={18} />} tone="danger" />
        <OPCMetricCard value={data.tickets.filter((row) => normalize(row.status) === 'in_progress').length} label="In Bearbeitung" icon={<AlertTriangle size={18} />} tone="warning" />
        <OPCMetricCard value={data.tickets.filter((row) => ['resolved', 'closed'].includes(normalize(row.status))).length} label="Erledigt" icon={<CheckCircle2 size={18} />} tone="success" />
      </OPCMetricsGrid>
      <OPCToolbar columns="minmax(0, 1fr) 190px 190px">
        <div style={{ position: 'relative', minWidth: 0 }}><Search size={17} style={opcSearchIconStyle} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Anfragen durchsuchen..." style={opcInputWithIconStyle} /></div>
        <select value={status} onChange={(event) => setStatus(event.target.value)} style={opcSelectStyle}><option value="all">Alle Status</option><option value="new">Neu</option><option value="open">Offen</option><option value="in_progress">In Bearbeitung</option><option value="resolved">Erledigt</option></select>
        {identity.permissions.canCreateRequests ? <button type="button" style={opcBlackButtonStyle} onClick={() => setShowForm((value) => !value)}><Plus size={17} />Neue Anfrage</button> : <span />}
      </OPCToolbar>
      {error ? <div style={errorStyle}>{error}</div> : null}{message ? <div style={successStyle}>{message}</div> : null}
      {showForm ? <section style={{ ...opcCardStyle, padding: 20, marginBottom: 22 }}><form onSubmit={submit} style={formGridStyle}><label style={labelStyle}><span>Anfrageart</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} style={opcSelectStyle}><option value="cleaning_needed">Reinigungsanfrage</option><option value="damage">Schadenmeldung</option></select></label><label style={labelStyle}><span>Standort</span><select value={form.site_id} onChange={(event) => setForm({ ...form, site_id: event.target.value })} style={opcSelectStyle}><option value="">Kein bestimmter Standort</option>{data.sites.map((site) => <option key={String(site.id)} value={String(site.id)}>{siteName(site)}</option>)}</select></label><label style={labelStyle}><span>Priorität</span><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} style={opcSelectStyle}><option value="low">Niedrig</option><option value="normal">Normal</option><option value="high">Hoch</option></select></label><label style={{ ...labelStyle, gridColumn: '1 / -1' }}><span>Titel</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} style={opcInputStyle} /></label><label style={{ ...labelStyle, gridColumn: '1 / -1' }}><span>Beschreibung</span><textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} style={{ ...opcInputStyle, height: 120, paddingTop: 12, resize: 'vertical' }} /></label><button type="submit" disabled={saving} style={{ ...opcBlackButtonStyle, width: 'auto', gridColumn: '1 / -1', justifySelf: 'end' }}><Send size={17} />{saving ? 'Wird gesendet…' : 'Anfrage absenden'}</button></form></section> : null}
      <OPCListCard>{filtered.length ? filtered.map((row, index) => <div key={String(row.id)} style={{ ...desktopRowStyle, gridTemplateColumns: 'minmax(320px, 1.3fr) minmax(220px, 1fr) 170px 150px', borderBottom: index < filtered.length - 1 ? '1px solid #F3F4F6' : 'none' }}><RowTitle icon={normalize(row.category) === 'damage' ? <ShieldAlert size={18} /> : <MessageSquare size={18} />} title={firstValue(row, ['title', 'ticket_title'], 'Kundenanfrage')} subtitle={firstValue(row, ['ticket_number'])} /><div><div style={rowTitleStyle}>{firstValue(row, ['description'], 'Keine Beschreibung')}</div><div style={rowSubStyle}>{firstValue(row, ['priority'], 'normal')}</div></div><div style={dateStyle}>{formatDate(firstValue(row, ['created_at']))}</div><StatusBadge status={row.status} /></div>) : <EmptyBlock title="Keine Einträge vorhanden" text="Neue Anfragen und Schadenmeldungen erscheinen hier." />}</OPCListCard>
      <style>{`${opcResponsiveStyle}${portalResponsiveStyle}`}</style>
    </OPCPageShell>
  );
}

function OrderDetailPage({ detail }: { detail: AnyRow }) {
  const job = detail.job || {};
  const site = detail.site || {};
  const reports = Array.isArray(detail.reports) ? detail.reports.filter((row: AnyRow) => ['approved', 'report_approved', 'sent_to_client', 'published', 'completed'].includes(normalize(row.status)) || metadata(row).client_visible === true) : [];
  return <OPCPageShell><a href={buildUrl('/kundenportal/auftraege')} data-opc-back="true" style={backLinkStyle}><ArrowLeft size={17} />Zurück zu meinen Aufträgen</a><PageIntro title={jobTitle(job)} description={firstValue(job, ['service_description'], 'Auftragsdetails und freigegebene Dokumentation.')} action={<StatusBadge status={job.status} />} /><div style={detailGridStyle}><section style={{ ...opcCardStyle, padding: 22 }}><h2 style={sectionTitleStyle}>Termin und Standort</h2><div style={detailLineStyle}><CalendarDays size={16} />{formatDateTime(jobStart(job))}</div><div style={detailLineStyle}><MapPin size={16} />{`${siteName(site)}${siteAddress(site) ? ` · ${siteAddress(site)}` : ''}`}</div></section><section style={{ ...opcCardStyle, padding: 22 }}><h2 style={sectionTitleStyle}>Vereinbarte Leistung</h2><KeyValue label="Dienstleistung" value={firstValue(job, ['service_category', 'job_type'], 'Reinigung')} /><KeyValue label="Geschätzter Aufwand" value={`${numberValue(job, ['estimated_hours', 'planned_hours']) || '—'} Std.`} /><KeyValue label="Priorität" value={statusLabel(firstValue(job, ['priority'], 'normal'))} /></section></div><div style={{ marginTop: 22 }}><OPCListCard>{reports.length ? reports.map((row: AnyRow, index: number) => <div key={String(row.id)} style={{ ...desktopRowStyle, gridTemplateColumns: 'minmax(300px, 1fr) 180px 160px', borderBottom: index < reports.length - 1 ? '1px solid #F3F4F6' : 'none' }}><RowTitle icon={<FileText size={18} />} title={firstValue(row, ['report_title', 'title'], 'Einsatzbericht')} subtitle="Freigegebener Bericht" /><div style={dateStyle}>{formatDate(firstValue(row, ['report_date', 'completed_at', 'updated_at']))}</div><StatusBadge status={row.status} /></div>) : <EmptyBlock title="Noch kein Bericht freigegeben" text="Freigegebene Berichte erscheinen automatisch hier." />}</OPCListCard></div><style>{opcResponsiveStyle}</style></OPCPageShell>;
}

function DocumentDetailPage({ identity, detail, type }: { identity: PortalIdentity; detail: AnyRow; type: 'quote' | 'invoice' }) {
  const document = (type === 'quote' ? detail.quote : detail.invoice) || {};
  const items = Array.isArray(detail.items) ? detail.items : [];
  const subtotal = numberValue(document, ['subtotal_chf']) || items.reduce((sum: number, item: AnyRow) => sum + numberValue(item, ['subtotal_chf']), 0);
  const tax = numberValue(document, ['tax_chf']) || items.reduce((sum: number, item: AnyRow) => sum + numberValue(item, ['tax_chf']), 0);
  const total = documentTotal(document) || subtotal + tax;
  const pdf = documentUrl(document);
  return <OPCPageShell><a href={buildUrl('/kundenportal/finanzen')} data-opc-back="true" style={backLinkStyle}><ArrowLeft size={17} />Zurück zu Offerten & Rechnungen</a><PageIntro title={documentTitle(document, type)} description={`${documentNumber(document, type)} · ${formatDate(firstValue(document, ['issue_date', 'created_at']))}`} action={<div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><StatusBadge status={document.status} />{pdf ? <a href={pdf} target="_blank" rel="noreferrer" style={{ ...opcSecondaryButtonStyle, width: 'auto' }}><Download size={17} />PDF öffnen</a> : null}</div>} /><section style={{ ...opcCardStyle, padding: 22, marginBottom: 22 }}><div style={documentHeaderGridStyle}><KeyValue label="Kunde" value={identity.company_name} /><KeyValue label={type === 'quote' ? 'Offertennummer' : 'Rechnungsnummer'} value={documentNumber(document, type)} /><KeyValue label={type === 'quote' ? 'Gültig bis' : 'Fällig am'} value={formatDate(firstValue(document, type === 'quote' ? ['valid_until'] : ['due_date']))} /><KeyValue label="Status" value={statusLabel(document.status)} /></div></section><OPCListCard><div style={itemHeaderStyle}><span>Leistung</span><span>Menge</span><span>Einzelpreis</span><span>Total</span></div>{items.map((item: AnyRow, index: number) => <div key={String(item.id || index)} style={{ ...itemRowStyle, borderBottom: index < items.length - 1 ? '1px solid #F3F4F6' : 'none' }}><div><div style={rowTitleStyle}>{firstValue(item, ['title'], `Position ${index + 1}`)}</div><div style={rowSubStyle}>{firstValue(item, ['description'])}</div></div><div style={dateStyle}>{numberValue(item, ['quantity'])} {firstValue(item, ['unit'])}</div><div style={dateStyle}>{formatMoney(numberValue(item, ['unit_price_chf']))}</div><div style={dateStyle}>{formatMoney(numberValue(item, ['total_chf', 'subtotal_chf']))}</div></div>)}</OPCListCard><section style={{ ...opcCardStyle, padding: 22, marginTop: 22, marginLeft: 'auto', maxWidth: 460 }}><KeyValue label="Zwischensumme" value={formatMoney(subtotal)} /><KeyValue label={`MwSt. ${numberValue(document, ['tax_rate']) || 8.1}%`} value={formatMoney(tax)} /><div style={totalStyle}><span>Gesamtbetrag</span><strong>{formatMoney(total)}</strong></div>{type === 'invoice' ? <KeyValue label="Offener Betrag" value={formatMoney(numberValue(document, ['balance_chf']) || total - numberValue(document, ['paid_chf']))} /> : null}</section><style>{opcResponsiveStyle}</style></OPCPageShell>;
}

function SettingsPage({ identity }: { identity: PortalIdentity }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setError(''); setMessage(''); if (newPassword.length < 8) return setError('Das Passwort muss mindestens 8 Zeichen lang sein.'); if (newPassword !== confirmPassword) return setError('Die Passwörter stimmen nicht überein.'); setSaving(true); try { const result = await supabase.auth.updateUser({ password: newPassword }); if (result.error) throw result.error; setNewPassword(''); setConfirmPassword(''); setMessage('Passwort aktualisiert.'); } catch (err: any) { setError(err?.message || 'Passwort konnte nicht geändert werden.'); } finally { setSaving(false); } }
  return <OPCPageShell><PageIntro title="Einstellungen" description="Persönliche Zugangsdaten und Sicherheit Ihres Kundenkontos." />{error ? <div style={errorStyle}>{error}</div> : null}{message ? <div style={successStyle}>{message}</div> : null}<div style={detailGridStyle}><section style={{ ...opcCardStyle, padding: 22 }}><h2 style={sectionTitleStyle}>Kundenkonto</h2><KeyValue label="Name" value={identity.display_name} /><KeyValue label="Unternehmen" value={identity.company_name} /><KeyValue label="E-Mail" value={identity.email || '—'} /><KeyValue label="Telefon" value={identity.phone || '—'} /></section><section style={{ ...opcCardStyle, padding: 22 }}><h2 style={sectionTitleStyle}>Passwort ändern</h2><form onSubmit={submit} style={{ display: 'grid', gap: 14 }}><label style={labelStyle}><span>Neues Passwort</span><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} style={opcInputStyle} /></label><label style={labelStyle}><span>Passwort bestätigen</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} style={opcInputStyle} /></label><button type="submit" disabled={saving} style={opcBlackButtonStyle}><LockKeyhole size={17} />{saving ? 'Wird gespeichert…' : 'Passwort speichern'}</button></form></section></div><style>{opcResponsiveStyle}</style></OPCPageShell>;
}

function RowTitle({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return <div style={rowTitleWrapStyle}><div style={rowIconStyle}>{icon}</div><div style={{ minWidth: 0 }}><div style={rowTitleStyle}>{title}</div><div style={rowSubStyle}>{subtitle}</div></div></div>;
}

function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return <div style={keyValueStyle}><span>{label}</span><strong>{value}</strong></div>;
}

function EmptyBlock({ title, text }: { title: string; text: string }) {
  return <div style={emptyStyle}><CheckCircle2 size={24} /><strong>{title}</strong><span>{text}</span></div>;
}

export default function OpcClientPortalAppV3({ section, itemId }: { section: PortalSection; itemId?: string }) {
  const [identity, setIdentity] = useState<PortalIdentity | null>(null);
  const [data, setData] = useState<PortalDataset>(emptyDataset);
  const [detail, setDetail] = useState<AnyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Ihre Sitzung ist abgelaufen.');
      let endpoint = '/api/opc/client-portal/data';
      if (section === 'order-detail' && itemId) endpoint = `/api/opc/client-portal?job_id=${encodeURIComponent(itemId)}`;
      if (section === 'quote-detail' && itemId) endpoint = `/api/opc/client-portal/quote/${encodeURIComponent(itemId)}`;
      if (section === 'invoice-detail' && itemId) endpoint = `/api/opc/client-portal/invoice/${encodeURIComponent(itemId)}`;
      const response = await fetch(buildUrl(endpoint), { cache: 'no-store', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
      const result = await response.json().catch(() => null) as PortalResponse | null;
      if (!response.ok || !result?.ok || !result.portal) throw new Error(result?.error || 'Kundenportal konnte nicht geladen werden.');
      setIdentity(result.portal);
      if (result.data) setData(result.data);
      setDetail(result.detail || null);
    } catch (err: any) { setError(err?.message || 'Kundenportal konnte nicht geladen werden.'); } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [section, itemId]);

  return (
    <MirakaDashboardShell hideTopBar requiredRole="client" currentPath={currentPathFor(section)}>
      {loading ? <PortalSkeleton variant="table" /> : error || !identity ? <div style={errorPageStyle}><AlertTriangle size={24} /><strong>Kundenportal nicht verfügbar</strong><span>{error || 'Das Kundenkonto konnte nicht geladen werden.'}</span></div> : section === 'overview' ? <OverviewPage identity={identity} data={data} /> : section === 'orders' ? <OrdersPage data={data} /> : section === 'sites' ? <OrdersPage data={data} showSites /> : section === 'documents' ? <DocumentsPage data={data} /> : section === 'finance' ? <DocumentsPage data={data} initialTab="quotes" /> : section === 'requests' ? <RequestsPage identity={identity} data={data} reload={load} /> : section === 'order-detail' && detail ? <OrderDetailPage detail={detail} /> : section === 'quote-detail' && detail ? <DocumentDetailPage identity={identity} detail={detail} type="quote" /> : section === 'invoice-detail' && detail ? <DocumentDetailPage identity={identity} detail={detail} type="invoice" /> : section === 'settings' ? <SettingsPage identity={identity} /> : <EmptyBlock title="Bereich nicht verfügbar" text="Die gewünschte Seite konnte nicht geöffnet werden." />}
    </MirakaDashboardShell>
  );
}

const pageIntroStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, marginBottom: 22 };
const pageTitleStyle: CSSProperties = { margin: 0, fontSize: 31, lineHeight: 1.05, letterSpacing: '-0.045em', fontWeight: 860, color: OPC_BRAND.text };
const pageDescriptionStyle: CSSProperties = { margin: '9px 0 0', fontSize: 14, lineHeight: 1.55, fontWeight: 600, color: OPC_BRAND.muted };
const eyebrowStyle: CSSProperties = { display: 'block', marginBottom: 7, fontSize: 11, fontWeight: 800, color: OPC_BRAND.muted, textTransform: 'uppercase', letterSpacing: '0.06em' };
const sectionTitleStyle: CSSProperties = { margin: 0, fontSize: 18, lineHeight: 1.25, fontWeight: 820, letterSpacing: '-0.025em', color: OPC_BRAND.text };
const sectionTopStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 18 };
const overviewGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(300px, .65fr)', gap: 16 };
const quickLinkStyle: CSSProperties = { minHeight: 54, display: 'grid', gridTemplateColumns: '24px 1fr auto', alignItems: 'center', gap: 12, borderTop: '1px solid #F3F4F6', color: OPC_BRAND.text, textDecoration: 'none', fontSize: 13, fontWeight: 760 };
const detailLineStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 12, color: OPC_BRAND.muted, fontSize: 13, lineHeight: 1.5, fontWeight: 600 };
const mutedCopyStyle: CSSProperties = { margin: 0, color: OPC_BRAND.muted, fontSize: 13, lineHeight: 1.6 };
const pillStyle: CSSProperties = { minHeight: 30, padding: '0 12px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 760, whiteSpace: 'nowrap' };
const desktopRowStyle: CSSProperties = { width: '100%', display: 'grid', alignItems: 'center', gap: 20, padding: '20px 22px', border: 'none', background: '#FFFFFF', textAlign: 'left', cursor: 'pointer', fontFamily: OPC_PAGE_FONT, color: OPC_BRAND.text, textDecoration: 'none' };
const rowTitleWrapStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 };
const rowIconStyle: CSSProperties = { width: 40, height: 40, borderRadius: 13, border: `1px solid ${OPC_BRAND.border}`, background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const rowTitleStyle: CSSProperties = { fontSize: 15, fontWeight: 800, color: OPC_BRAND.text, letterSpacing: '-0.015em', marginBottom: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const rowSubStyle: CSSProperties = { fontSize: 13, fontWeight: 600, color: OPC_BRAND.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const dateStyle: CSSProperties = { fontSize: 13, fontWeight: 760, color: OPC_BRAND.text };
const openButtonStyle: CSSProperties = { height: 34, padding: '0 12px', borderRadius: 12, background: OPC_BRAND.black, color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 760 };
const countBadgeStyle: CSSProperties = { ...pillStyle, background: '#F8FAFC', color: OPC_BRAND.muted, justifySelf: 'end' };
const emptyStyle: CSSProperties = { minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, padding: 34, color: OPC_BRAND.muted, textAlign: 'center' };
const detailGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 };
const keyValueStyle: CSSProperties = { minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, borderBottom: '1px solid #F3F4F6', fontSize: 13, color: OPC_BRAND.muted };
const backLinkStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 18, color: OPC_BRAND.muted, textDecoration: 'none', fontSize: 13, fontWeight: 760 };
const documentHeaderGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(240px, 1.4fr) repeat(3, minmax(150px, .7fr))', gap: 18 };
const itemHeaderStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(280px, 1.4fr) 140px 170px 170px', gap: 20, padding: '15px 22px', background: '#FAFAFA', color: OPC_BRAND.muted, fontSize: 12, fontWeight: 760 };
const itemRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(280px, 1.4fr) 140px 170px 170px', gap: 20, alignItems: 'center', padding: '20px 22px' };
const totalStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 18, padding: '18px 0', fontSize: 16, color: OPC_BRAND.text, borderBottom: '1px solid #F3F4F6' };
const formGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 };
const labelStyle: CSSProperties = { display: 'grid', gap: 7, fontSize: 13, fontWeight: 720, color: OPC_BRAND.text };
const errorStyle: CSSProperties = { marginBottom: 22, padding: '14px 16px', borderRadius: 14, border: '1px solid #FCA5A5', background: '#FEF2F2', color: OPC_BRAND.red, fontSize: 14, fontWeight: 620 };
const successStyle: CSSProperties = { marginBottom: 22, padding: '14px 16px', borderRadius: 14, border: '1px solid #86EFAC', background: '#F0FDF4', color: OPC_BRAND.green, fontSize: 14, fontWeight: 620 };
const errorPageStyle: CSSProperties = { minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: OPC_BRAND.muted, fontFamily: OPC_PAGE_FONT };
const portalResponsiveStyle = `@media (max-width: 1100px){.opc-client-desktop-table a{grid-template-columns:minmax(240px,1fr) 180px 180px 130px 82px!important}.opc-client-desktop-table a>div:nth-child(3){display:none}}@media (max-width: 820px){.opc-client-desktop-table a{display:flex!important;flex-direction:column;align-items:flex-start!important;gap:12px!important}.opc-client-desktop-table a>span{align-self:flex-start}.opc-requests-page>div[style*="grid-template-columns"]{grid-template-columns:1fr!important}}`;
