import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  MapPin,
  MessageSquare,
  Paperclip,
  Plus,
  ReceiptText,
  Save,
  Search,
  Send,
  ShieldAlert,
  Upload,
  WalletCards,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import {
  downloadPdf,
  generateInvoicePdfDocument,
  generateQuotePdfDocument,
} from '../lib/opc-document-pdf';
import MirakaDashboardShell from './MirakaDashboardShell';
import OpcClientPortalAppV3 from './OpcClientPortalAppV3';
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
  | 'site-detail'
  | 'documents'
  | 'requests'
  | 'ticket-detail'
  | 'cleaning-request'
  | 'finance'
  | 'quote-detail'
  | 'invoice-detail'
  | 'settings';

type PortalIdentity = {
  user_id?: string;
  client_id?: string;
  display_name: string;
  email?: string;
  phone?: string;
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

type ApiResponse = {
  ok: boolean;
  error?: string;
  message?: string;
  portal?: PortalIdentity;
  data?: PortalDataset;
  detail?: AnyRow;
  ticket?: AnyRow;
  site?: AnyRow;
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

function metadata(row: AnyRow | null | undefined) {
  const value = row?.metadata;
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRow : {};
}

function formatDate(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
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
  return firstValue(row, type === 'quote' ? ['title', 'quote_title', 'subject'] : ['title', 'invoice_title', 'subject'], type === 'quote' ? 'Offerte' : 'Rechnung');
}

function documentNumber(row: AnyRow, type: 'quote' | 'invoice') {
  return firstValue(row, type === 'quote' ? ['quote_number', 'number'] : ['invoice_number', 'number']);
}

function documentUrl(row: AnyRow | null | undefined) {
  const keys = ['download_url', 'file_url', 'public_url', 'pdf_url', 'document_url', 'signed_url'];
  return firstValue(row, keys) || firstValue(metadata(row), keys);
}

function statusLabel(status: unknown) {
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
    low: 'Niedrig',
    normal: 'Normal',
    high: 'Hoch',
  };
  const clean = normalize(status);
  return labels[clean] || clean.replace(/_/g, ' ') || 'Unbekannt';
}

function StatusBadge({ status }: { status: unknown }) {
  const clean = normalize(status);
  const done = ['completed', 'approved', 'report_approved', 'sent_to_client', 'published', 'resolved', 'closed', 'accepted', 'paid'].includes(clean);
  const progress = ['in_progress', 'on_site', 'started', 'running', 'open', 'new'].includes(clean);
  const danger = ['overdue', 'cancelled', 'declined', 'expired', 'rejected'].includes(clean);
  const style = done
    ? { background: '#DCFCE7', color: OPC_BRAND.green }
    : progress
      ? { background: '#FFF7ED', color: '#9A3412' }
      : danger
        ? { background: '#FEF2F2', color: OPC_BRAND.red }
        : { background: '#F8FAFC', color: OPC_BRAND.muted };
  return <span style={{ ...pillStyle, ...style }}>{statusLabel(status)}</span>;
}

function currentPathFor(section: PortalSection) {
  if (['orders', 'order-detail', 'sites', 'site-detail', 'cleaning-request'].includes(section)) return '/einsaetze';
  if (['requests', 'ticket-detail'].includes(section)) return '/anfragen-schaeden';
  if (['documents', 'finance', 'quote-detail', 'invoice-detail'].includes(section)) return '/berichte-dateien';
  if (section === 'settings') return '/einstellungen';
  return '/dashboard';
}

async function authToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Ihre Sitzung ist abgelaufen.');
  return token;
}

async function apiRequest(path: string, init: RequestInit = {}) {
  const token = await authToken();
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');
  const response = await fetch(buildUrl(path), { ...init, cache: 'no-store', headers });
  const result = await response.json().catch(() => null) as ApiResponse | null;
  if (!response.ok || !result?.ok) throw new Error(result?.error || 'Aktion konnte nicht ausgeführt werden.');
  return result;
}

function DetailHero({ backHref, backLabel, title, description, action }: { backHref: string; backLabel: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <section style={{ ...opcCardStyle, padding: 24, marginBottom: 18 }}>
      <a href={buildUrl(backHref)} style={backLinkStyle}><ArrowLeft size={17} />{backLabel}</a>
      <div className="opc-client-detail-hero-row">
        <div>
          <h1 style={pageTitleStyle}>{title}</h1>
          {description ? <p style={pageDescriptionStyle}>{description}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
    </section>
  );
}

function OrdersPage({ data }: { data: PortalDataset }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const sites = new Map(data.sites.map((site) => [String(site.id), site]));
  const filtered = useMemo(() => data.jobs.filter((job) => {
    const site = sites.get(String(job.client_site_id || job.site_id || ''));
    const matchesStatus = status === 'all' || normalize(job.status) === status;
    const haystack = [jobTitle(job), siteName(site), siteAddress(site), statusLabel(job.status)].join(' ').toLowerCase();
    return matchesStatus && (!search.trim() || haystack.includes(search.trim().toLowerCase()));
  }), [data.jobs, data.sites, search, status]);

  const active = data.jobs.filter((job) => ['assigned', 'confirmed', 'in_progress', 'on_site', 'started', 'running'].includes(normalize(job.status))).length;
  const completed = data.jobs.filter((job) => ['completed', 'report_approved', 'approved', 'sent_to_client'].includes(normalize(job.status))).length;

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
      {filtered.length ? <div className="opc-client-card-grid">{filtered.map((job) => {
        const site = sites.get(String(job.client_site_id || job.site_id || ''));
        return <a key={String(job.id)} href={buildUrl(`/kundenportal/auftrag/${job.id}`)} style={freeCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}><div style={iconBoxStyle}><ClipboardList size={18} /></div><StatusBadge status={job.status} /></div>
          <div><h2 style={cardTitleStyle}>{jobTitle(job)}</h2><p style={cardSubStyle}>{firstValue(job, ['service_category', 'job_type'], 'Reinigung')}</p></div>
          <div style={cardMetaWrapStyle}><span><CalendarDays size={15} />{formatDateTime(jobStart(job))}</span><span><MapPin size={15} />{siteName(site)} · {siteAddress(site) || 'Adresse offen'}</span></div>
          <span style={{ ...opcBlackButtonStyle, width: '100%' }}>Auftrag öffnen</span>
        </a>;
      })}</div> : <EmptyBlock title="Keine Aufträge vorhanden" text="Neue bestätigte Aufträge erscheinen automatisch hier." />}
      <style>{`${opcResponsiveStyle}${responsiveCss}`}</style>
    </OPCPageShell>
  );
}

function OrderDetailPage({ detail }: { detail: AnyRow }) {
  const job = detail.job || {};
  const site = detail.site || {};
  const reports = Array.isArray(detail.reports) ? detail.reports.filter((row: AnyRow) => ['approved', 'report_approved', 'sent_to_client', 'published', 'completed'].includes(normalize(row.status)) || metadata(row).client_visible === true) : [];
  const requestHref = `/kundenportal/reinigung-anfragen?type=change_request&job_id=${encodeURIComponent(String(job.id || ''))}&site_id=${encodeURIComponent(String(site.id || ''))}`;

  return <OPCPageShell>
    <DetailHero backHref="/kundenportal/auftraege" backLabel="Zurück zu meinen Aufträgen" title={jobTitle(job)} description={firstValue(job, ['service_description'], 'Auftragsdetails und freigegebene Dokumentation.')} action={<StatusBadge status={job.status} />} />
    <div className="opc-client-two-column">
      <section style={{ ...opcCardStyle, padding: 22 }}><h2 style={sectionTitleStyle}>Termin und Standort</h2><DetailLine icon={<CalendarDays size={16} />} text={formatDateTime(jobStart(job))} /><DetailLine icon={<MapPin size={16} />} text={`${siteName(site)}${siteAddress(site) ? ` · ${siteAddress(site)}` : ''}`} /></section>
      <section style={{ ...opcCardStyle, padding: 22 }}><h2 style={sectionTitleStyle}>Vereinbarte Leistung</h2><KeyValue label="Dienstleistung" value={firstValue(job, ['service_category', 'job_type'], 'Reinigung')} /><KeyValue label="Geschätzter Aufwand" value={`${numberValue(job, ['estimated_hours', 'planned_hours']) || '—'} Std.`} /><KeyValue label="Priorität" value={statusLabel(firstValue(job, ['priority'], 'normal'))} /></section>
    </div>
    <section style={{ ...opcCardStyle, padding: 20, marginTop: 18 }}>
      <div className="opc-client-section-header"><div><h2 style={sectionTitleStyle}>Änderungen und Zusatzleistungen</h2><p style={sectionDescriptionStyle}>Terminänderung, zusätzliche Reinigung oder eine andere Anpassung anfragen.</p></div><a href={buildUrl(requestHref)} style={opcBlackButtonStyle}><MessageSquare size={17} />Änderung anfordern</a></div>
    </section>
    <section style={{ ...opcCardStyle, padding: 20, marginTop: 18 }}><div className="opc-client-section-header"><div><h2 style={sectionTitleStyle}>Berichte und Dokumentation</h2><p style={sectionDescriptionStyle}>Nur freigegebene Berichte werden angezeigt.</p></div></div>{reports.length ? <div style={{ display: 'grid', gap: 10 }}>{reports.map((row: AnyRow) => {
      const url = documentUrl(row);
      const content = <><div style={rowTitleWrapStyle}><div style={iconBoxStyle}><FileText size={18} /></div><div><div style={rowTitleStyle}>{firstValue(row, ['report_title', 'title'], 'Einsatzbericht')}</div><div style={rowSubStyle}>{formatDate(firstValue(row, ['report_date', 'completed_at', 'updated_at']))}</div></div></div><StatusBadge status={row.status} />{url ? <ExternalLink size={17} /> : null}</>;
      return url ? <a key={String(row.id)} href={url} target="_blank" rel="noreferrer" style={documentRowStyle}>{content}</a> : <div key={String(row.id)} style={documentRowStyle}>{content}</div>;
    })}</div> : <EmptyBlock title="Noch kein Bericht freigegeben" text="Freigegebene Berichte erscheinen automatisch hier." />}</section>
    <style>{`${opcResponsiveStyle}${responsiveCss}`}</style>
  </OPCPageShell>;
}

function SitesPage({ data, reload }: { data: PortalDataset; reload: () => Promise<void> }) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ site_name: '', site_type: 'other', address_text: '', postal_code: '', city: '', country: 'Schweiz', building_size_m2: '', floors: '', access_notes: '' });
  const filtered = data.sites.filter((site) => [siteName(site), siteAddress(site), firstValue(site, ['site_type'])].join(' ').toLowerCase().includes(search.toLowerCase()));

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const result = await apiRequest('/api/opc/client-portal/sites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      setMessage(result.message || 'Standort wurde ergänzt.');
      setShowForm(false);
      setForm({ site_name: '', site_type: 'other', address_text: '', postal_code: '', city: '', country: 'Schweiz', building_size_m2: '', floors: '', access_notes: '' });
      await reload();
    } catch (err: any) { setError(err?.message || 'Standort konnte nicht erstellt werden.'); } finally { setSaving(false); }
  }

  return <OPCPageShell>
    <OPCTabs tabs={[
      { key: 'orders', label: 'Meine Aufträge', active: false, onClick: () => window.location.assign(buildUrl('/kundenportal/auftraege')) },
      { key: 'sites', label: 'Standorte', active: true, onClick: () => window.location.assign(buildUrl('/kundenportal/standorte')) },
    ]} />
    <div className="opc-client-section-header" style={{ marginBottom: 18 }}><div><h1 style={pageTitleStyle}>Standorte</h1><p style={pageDescriptionStyle}>Ihre Reinigungsobjekte verwalten und neue Standorte ergänzen.</p></div><button type="button" style={opcBlackButtonStyle} onClick={() => setShowForm((value) => !value)}><Plus size={17} />Standort ergänzen</button></div>
    <OPCMetricsGrid><OPCMetricCard value={data.sites.length} label="Standorte" icon={<Building2 size={18} />} /><OPCMetricCard value={data.jobs.length} label="Aufträge" icon={<ClipboardList size={18} />} /><OPCMetricCard value={data.reports.length} label="Berichte" icon={<FileText size={18} />} /><OPCMetricCard value={data.tickets.filter((row) => !['resolved', 'closed'].includes(normalize(row.status))).length} label="Offene Anfragen" icon={<MessageSquare size={18} />} /></OPCMetricsGrid>
    {error ? <MessageBox type="error" text={error} /> : null}{message ? <MessageBox type="success" text={message} /> : null}
    {showForm ? <section style={{ ...opcCardStyle, padding: 20, marginBottom: 18 }}><form onSubmit={submit} className="opc-client-form-grid"><InputField label="Standortname" value={form.site_name} onChange={(value) => setForm({ ...form, site_name: value })} required /><SelectField label="Objektart" value={form.site_type} onChange={(value) => setForm({ ...form, site_type: value })} options={[['office', 'Büro'], ['commercial', 'Gewerbe'], ['residential', 'Wohnobjekt'], ['hotel', 'Hotel'], ['medical', 'Praxis / Medizin'], ['other', 'Andere']]} /><InputField label="Strasse und Nummer" value={form.address_text} onChange={(value) => setForm({ ...form, address_text: value })} required /><InputField label="PLZ" value={form.postal_code} onChange={(value) => setForm({ ...form, postal_code: value })} required /><InputField label="Ort" value={form.city} onChange={(value) => setForm({ ...form, city: value })} required /><InputField label="Land" value={form.country} onChange={(value) => setForm({ ...form, country: value })} /><InputField label="Gebäudegrösse m² optional" value={form.building_size_m2} onChange={(value) => setForm({ ...form, building_size_m2: value })} /><InputField label="Etagen optional" value={form.floors} onChange={(value) => setForm({ ...form, floors: value })} /><TextAreaField label="Zugangs- oder Objektinformationen" value={form.access_notes} onChange={(value) => setForm({ ...form, access_notes: value })} wide /><button type="submit" disabled={saving} style={{ ...opcBlackButtonStyle, justifySelf: 'end' }}><Save size={17} />{saving ? 'Wird gespeichert…' : 'Standort speichern'}</button></form></section> : null}
    <OPCToolbar columns="minmax(0, 1fr)"><div style={{ position: 'relative', minWidth: 0 }}><Search size={17} style={opcSearchIconStyle} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Standorte durchsuchen..." style={opcInputWithIconStyle} /></div></OPCToolbar>
    {filtered.length ? <div className="opc-client-card-grid">{filtered.map((site) => {
      const jobs = data.jobs.filter((job) => String(job.client_site_id || job.site_id || '') === String(site.id));
      return <a key={String(site.id)} href={buildUrl(`/kundenportal/standort/${site.id}`)} style={freeCardStyle}><div style={{ display: 'flex', justifyContent: 'space-between' }}><div style={iconBoxStyle}><Building2 size={18} /></div><span style={countBadgeStyle}>{jobs.length} {jobs.length === 1 ? 'Auftrag' : 'Aufträge'}</span></div><div><h2 style={cardTitleStyle}>{siteName(site)}</h2><p style={cardSubStyle}>{statusLabel(firstValue(site, ['site_type'], 'Standort'))}</p></div><div style={cardMetaWrapStyle}><span><MapPin size={15} />{siteAddress(site) || 'Adresse nicht hinterlegt'}</span></div><span style={{ ...opcSecondaryButtonStyle, width: '100%' }}>Standort öffnen <ChevronRight size={16} /></span></a>;
    })}</div> : <EmptyBlock title="Keine Standorte vorhanden" text="Zugeordnete Kundenstandorte erscheinen hier." />}
    <style>{`${opcResponsiveStyle}${responsiveCss}`}</style>
  </OPCPageShell>;
}

function SiteDetailPage({ detail, reload }: { detail: AnyRow; reload: () => Promise<void> }) {
  const site = detail.site || {};
  const jobs = Array.isArray(detail.jobs) ? detail.jobs : [];
  const tickets = Array.isArray(detail.tickets) ? detail.tickets : [];
  const meta = metadata(site);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ site_name: siteName(site), site_type: firstValue(site, ['site_type'], 'other'), address_text: firstValue(site, ['address_text']), postal_code: firstValue(site, ['postal_code']), city: firstValue(site, ['city']), country: firstValue(site, ['country'], 'Schweiz'), building_size_m2: firstValue(meta, ['building_size_m2']), floors: firstValue(meta, ['floors']), access_notes: firstValue(meta, ['access_notes']), client_notes: firstValue(meta, ['client_notes']) });

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try { const result = await apiRequest(`/api/opc/client-portal/site/${site.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); setMessage(result.message || 'Standort wurde gespeichert.'); await reload(); } catch (err: any) { setError(err?.message || 'Standort konnte nicht gespeichert werden.'); } finally { setSaving(false); }
  }

  return <OPCPageShell>
    <DetailHero backHref="/kundenportal/standorte" backLabel="Zurück zu Standorten" title={siteName(site)} description={siteAddress(site)} action={<a href={buildUrl(`/kundenportal/reinigung-anfragen?site_id=${encodeURIComponent(String(site.id))}`)} style={opcBlackButtonStyle}><Plus size={17} />Reinigung anfordern</a>} />
    {error ? <MessageBox type="error" text={error} /> : null}{message ? <MessageBox type="success" text={message} /> : null}
    <section style={{ ...opcCardStyle, padding: 22 }}><div className="opc-client-section-header"><div><h2 style={sectionTitleStyle}>Standortangaben</h2><p style={sectionDescriptionStyle}>Adresse und objektspezifische Angaben können aktualisiert werden.</p></div></div><form onSubmit={save} className="opc-client-form-grid"><InputField label="Standortname" value={form.site_name} onChange={(value) => setForm({ ...form, site_name: value })} required /><SelectField label="Objektart" value={form.site_type} onChange={(value) => setForm({ ...form, site_type: value })} options={[['office', 'Büro'], ['commercial', 'Gewerbe'], ['residential', 'Wohnobjekt'], ['hotel', 'Hotel'], ['medical', 'Praxis / Medizin'], ['other', 'Andere']]} /><InputField label="Strasse und Nummer" value={form.address_text} onChange={(value) => setForm({ ...form, address_text: value })} required /><InputField label="PLZ" value={form.postal_code} onChange={(value) => setForm({ ...form, postal_code: value })} required /><InputField label="Ort" value={form.city} onChange={(value) => setForm({ ...form, city: value })} required /><InputField label="Land" value={form.country} onChange={(value) => setForm({ ...form, country: value })} /><InputField label="Gebäudegrösse m²" value={form.building_size_m2} onChange={(value) => setForm({ ...form, building_size_m2: value })} /><InputField label="Etagen" value={form.floors} onChange={(value) => setForm({ ...form, floors: value })} /><TextAreaField label="Zugangsinformationen" value={form.access_notes} onChange={(value) => setForm({ ...form, access_notes: value })} wide /><TextAreaField label="Bemerkungen zum Objekt" value={form.client_notes} onChange={(value) => setForm({ ...form, client_notes: value })} wide /><button type="submit" disabled={saving} style={{ ...opcBlackButtonStyle, justifySelf: 'end' }}><Save size={17} />{saving ? 'Wird gespeichert…' : 'Änderungen speichern'}</button></form></section>
    <div className="opc-client-two-column" style={{ marginTop: 18 }}><section style={{ ...opcCardStyle, padding: 20 }}><h2 style={sectionTitleStyle}>Aufträge an diesem Standort</h2><p style={sectionDescriptionStyle}>{jobs.length} Auftrag/Aufträge</p><div style={{ display: 'grid', gap: 10, marginTop: 16 }}>{jobs.slice(0, 6).map((job: AnyRow) => <a key={String(job.id)} href={buildUrl(`/kundenportal/auftrag/${job.id}`)} style={simpleLinkRowStyle}><div><strong>{jobTitle(job)}</strong><span>{formatDateTime(jobStart(job))}</span></div><StatusBadge status={job.status} /></a>)}</div></section><section style={{ ...opcCardStyle, padding: 20 }}><h2 style={sectionTitleStyle}>Anfragen zu diesem Standort</h2><p style={sectionDescriptionStyle}>{tickets.length} Anfrage(n)</p><div style={{ display: 'grid', gap: 10, marginTop: 16 }}>{tickets.slice(0, 6).map((ticket: AnyRow) => <a key={String(ticket.id)} href={buildUrl(`/kundenportal/anfrage/${ticket.id}`)} style={simpleLinkRowStyle}><div><strong>{firstValue(ticket, ['title'], 'Anfrage')}</strong><span>{firstValue(ticket, ['ticket_number'])}</span></div><StatusBadge status={ticket.status} /></a>)}</div></section></div>
    <style>{`${opcResponsiveStyle}${responsiveCss}`}</style>
  </OPCPageShell>;
}

function RequestsPage({ identity, data }: { identity: PortalIdentity; data: PortalDataset }) {
  const [tab, setTab] = useState<'tickets' | 'damages'>('tickets');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const rows = data.tickets.filter((row) => tab === 'damages' ? normalize(row.category) === 'damage' : normalize(row.category) !== 'damage');
  const filtered = rows.filter((row) => (status === 'all' || normalize(row.status) === status) && [row.title, row.description, row.ticket_number].join(' ').toLowerCase().includes(search.toLowerCase()));
  return <OPCPageShell>
    <OPCTabs tabs={[{ key: 'tickets', label: 'Anfragen', active: tab === 'tickets', onClick: () => setTab('tickets') }, { key: 'damages', label: 'Schäden', active: tab === 'damages', onClick: () => setTab('damages') }]} />
    <OPCMetricsGrid><OPCMetricCard value={data.tickets.filter((row) => normalize(row.category) !== 'damage' && !['resolved', 'closed'].includes(normalize(row.status))).length} label="Offene Anfragen" icon={<MessageSquare size={18} />} /><OPCMetricCard value={data.tickets.filter((row) => normalize(row.category) === 'damage' && !['resolved', 'closed'].includes(normalize(row.status))).length} label="Schäden offen" icon={<ShieldAlert size={18} />} tone="danger" /><OPCMetricCard value={data.tickets.filter((row) => normalize(row.status) === 'in_progress').length} label="In Bearbeitung" icon={<AlertTriangle size={18} />} tone="warning" /><OPCMetricCard value={data.tickets.filter((row) => ['resolved', 'closed'].includes(normalize(row.status))).length} label="Erledigt" icon={<CheckCircle2 size={18} />} tone="success" /></OPCMetricsGrid>
    <OPCToolbar columns="minmax(0, 1fr) 190px 240px"><div style={{ position: 'relative', minWidth: 0 }}><Search size={17} style={opcSearchIconStyle} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Anfragen durchsuchen..." style={opcInputWithIconStyle} /></div><select value={status} onChange={(event) => setStatus(event.target.value)} style={opcSelectStyle}><option value="all">Alle Status</option><option value="new">Neu</option><option value="open">Offen</option><option value="in_progress">In Bearbeitung</option><option value="resolved">Erledigt</option></select>{identity.permissions.canCreateRequests !== false ? <a href={buildUrl('/kundenportal/reinigung-anfragen')} style={opcBlackButtonStyle}><Plus size={17} />Neue Reinigung anfordern</a> : <span />}</OPCToolbar>
    {filtered.length ? <div className="opc-client-card-grid">{filtered.map((row) => <a key={String(row.id)} href={buildUrl(`/kundenportal/anfrage/${row.id}`)} style={freeCardStyle}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}><div style={iconBoxStyle}>{normalize(row.category) === 'damage' ? <ShieldAlert size={18} /> : <MessageSquare size={18} />}</div><StatusBadge status={row.status} /></div><div><h2 style={cardTitleStyle}>{firstValue(row, ['title'], 'Kundenanfrage')}</h2><p style={cardSubStyle}>{firstValue(row, ['ticket_number'])}</p></div><p style={descriptionClampStyle}>{firstValue(row, ['description'], 'Keine Beschreibung')}</p><div style={cardMetaWrapStyle}><span><Clock3 size={15} />{formatDate(firstValue(row, ['created_at']))}</span><span>Priorität: {statusLabel(row.priority)}</span></div><span style={{ ...opcSecondaryButtonStyle, width: '100%' }}>Anfrage öffnen <ChevronRight size={16} /></span></a>)}</div> : <EmptyBlock title="Keine Einträge vorhanden" text="Neue Anfragen und Schadenmeldungen erscheinen hier." />}
    <style>{`${opcResponsiveStyle}${responsiveCss}`}</style>
  </OPCPageShell>;
}

function TicketDetailPage({ detail, data, reload }: { detail: AnyRow; data: PortalDataset; reload: () => Promise<void> }) {
  const ticket = detail.ticket || {};
  const events = Array.isArray(detail.events) ? detail.events : [];
  const media = Array.isArray(detail.media) ? detail.media : [];
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({ title: firstValue(ticket, ['title']), description: firstValue(ticket, ['description']), priority: firstValue(ticket, ['priority'], 'normal'), category: firstValue(ticket, ['category'], 'other'), site_id: firstValue(ticket, ['site_id']) });

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try { const result = await apiRequest(`/api/opc/client-portal/ticket/${ticket.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); setMessage(result.message || 'Änderungen wurden gespeichert.'); await reload(); } catch (err: any) { setError(err?.message || 'Änderungen konnten nicht gespeichert werden.'); } finally { setSaving(false); }
  }

  async function addUpdate(event: FormEvent) {
    event.preventDefault(); setSending(true); setError(''); setMessage('');
    try { const formData = new FormData(); formData.set('comment', comment); files.forEach((file) => formData.append('files', file)); const result = await apiRequest(`/api/opc/client-portal/ticket/${ticket.id}`, { method: 'POST', body: formData }); setMessage(result.message || 'Ergänzung wurde gespeichert.'); setComment(''); setFiles([]); await reload(); } catch (err: any) { setError(err?.message || 'Ergänzung konnte nicht gespeichert werden.'); } finally { setSending(false); }
  }

  return <OPCPageShell>
    <DetailHero backHref="/kundenportal/anfragen" backLabel="Zurück zu Anfragen & Schäden" title={firstValue(ticket, ['title'], 'Kundenanfrage')} description={`${firstValue(ticket, ['ticket_number'])} · ${formatDate(firstValue(ticket, ['created_at']))}`} action={<StatusBadge status={ticket.status} />} />
    {error ? <MessageBox type="error" text={error} /> : null}{message ? <MessageBox type="success" text={message} /> : null}
    <div className="opc-client-two-column"><section style={{ ...opcCardStyle, padding: 22 }}><h2 style={sectionTitleStyle}>Anfrage bearbeiten</h2><p style={sectionDescriptionStyle}>Titel, Beschreibung, Priorität und Standort können ergänzt werden.</p><form onSubmit={save} style={{ display: 'grid', gap: 14, marginTop: 18 }}><InputField label="Titel" value={form.title} onChange={(value) => setForm({ ...form, title: value })} required /><TextAreaField label="Beschreibung" value={form.description} onChange={(value) => setForm({ ...form, description: value })} /><SelectField label="Priorität" value={form.priority} onChange={(value) => setForm({ ...form, priority: value })} options={[['low', 'Niedrig'], ['normal', 'Normal'], ['high', 'Hoch']]} /><SelectField label="Anfrageart" value={form.category} onChange={(value) => setForm({ ...form, category: value })} options={[['cleaning_needed', 'Reinigungsanfrage'], ['damage', 'Schaden'], ['recleaning', 'Nachreinigung'], ['material_missing', 'Material fehlt'], ['complaint', 'Beschwerde'], ['praise', 'Lob'], ['other', 'Andere']]} /><SelectField label="Standort" value={form.site_id} onChange={(value) => setForm({ ...form, site_id: value })} options={[['', 'Kein bestimmter Standort'], ...data.sites.map((site) => [String(site.id), siteName(site)] as [string, string])]} /><button type="submit" disabled={saving} style={opcBlackButtonStyle}><Save size={17} />{saving ? 'Wird gespeichert…' : 'Änderungen speichern'}</button></form></section>
    <section style={{ ...opcCardStyle, padding: 22 }}><h2 style={sectionTitleStyle}>Nachricht oder Datei ergänzen</h2><p style={sectionDescriptionStyle}>Bilder, PDF- oder Word-Dateien bis 15 MB.</p><form onSubmit={addUpdate} style={{ display: 'grid', gap: 14, marginTop: 18 }}><TextAreaField label="Nachricht" value={comment} onChange={setComment} /><label style={labelStyle}><span>Dateien</span><input type="file" multiple accept="image/*,.pdf,.doc,.docx" onChange={(event) => setFiles(Array.from(event.target.files || []))} style={fileInputStyle} /></label>{files.length ? <div style={selectedFilesStyle}>{files.map((file) => <span key={`${file.name}-${file.size}`}><Paperclip size={14} />{file.name}</span>)}</div> : null}<button type="submit" disabled={sending} style={opcBlackButtonStyle}><Upload size={17} />{sending ? 'Wird hochgeladen…' : 'Ergänzung speichern'}</button></form></section></div>
    {media.length ? <section style={{ ...opcCardStyle, padding: 20, marginTop: 18 }}><h2 style={sectionTitleStyle}>Anhänge</h2><div className="opc-client-media-grid">{media.map((file: AnyRow) => <a key={String(file.id)} href={file.display_url || '#'} target="_blank" rel="noreferrer" style={mediaCardStyle}>{String(file.mime_type || '').startsWith('image/') ? <ImageIcon size={22} /> : <FileText size={22} />}<div><strong>{firstValue(file, ['original_filename'], 'Datei')}</strong><span>{formatDate(file.created_at)}</span></div><Download size={17} /></a>)}</div></section> : null}
    <section style={{ ...opcCardStyle, padding: 20, marginTop: 18 }}><h2 style={sectionTitleStyle}>Verlauf</h2><p style={sectionDescriptionStyle}>Änderungen von Orange Pro Clean und Ihrem Kundenkonto.</p><div style={{ display: 'grid', gap: 0, marginTop: 18 }}>{events.length ? events.map((event: AnyRow) => <div key={String(event.id)} style={timelineRowStyle}><div style={timelineDotStyle} /><div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}><strong>{firstValue(event, ['actor_name'], 'Orange Pro Clean')}</strong><span style={rowSubStyle}>{formatDateTime(event.created_at)}</span></div><p style={{ margin: '7px 0 0', color: OPC_BRAND.muted, lineHeight: 1.55, fontSize: 13 }}>{firstValue(event, ['message'], 'Änderung vorgenommen.')}</p></div></div>) : <EmptyBlock title="Noch kein Verlauf" text="Änderungen erscheinen automatisch hier." />}</div></section>
    <style>{`${opcResponsiveStyle}${responsiveCss}`}</style>
  </OPCPageShell>;
}

function CleaningRequestPage({ data }: { data: PortalDataset }) {
  const query = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({ service_category: query.get('type') || 'maintenance', title: '', description: '', site_id: query.get('site_id') || '', priority: 'normal', preferred_date: '', address_text: '', postal_code: '', city: '', country: 'Schweiz', building_size_m2: '', floors: '', requested_services: '', notes: '', job_id: query.get('job_id') || '' });
  const selectedSite = data.sites.find((site) => String(site.id) === form.site_id);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try { const payload = new FormData(); Object.entries(form).forEach(([key, value]) => payload.set(key, value)); files.forEach((file) => payload.append('files', file)); const result = await apiRequest('/api/opc/client-portal/cleaning-request', { method: 'POST', body: payload }); setMessage(result.message || 'Ihre Anfrage wurde übermittelt.'); setFiles([]); } catch (err: any) { setError(err?.message || 'Anfrage konnte nicht übermittelt werden.'); } finally { setSaving(false); }
  }

  return <OPCPageShell>
    <DetailHero backHref="/kundenportal/anfragen" backLabel="Zurück zu Anfragen & Schäden" title={form.service_category === 'change_request' ? 'Änderung anfordern' : 'Neue Reinigung anfordern'} description="Beschreiben Sie die gewünschte Leistung. Orange Pro Clean erhält die Anfrage direkt zur Prüfung und Offertstellung." />
    {error ? <MessageBox type="error" text={error} /> : null}{message ? <MessageBox type="success" text={message} /> : null}
    <section style={{ ...opcCardStyle, padding: 22 }}><form onSubmit={submit} className="opc-client-form-grid"><SelectField label="Reinigungsart" value={form.service_category} onChange={(value) => setForm({ ...form, service_category: value })} options={[['maintenance', 'Unterhaltsreinigung'], ['special', 'Spezialreinigung'], ['emergency', 'Notreinigung'], ['move', 'Umzugsreinigung'], ['window', 'Fenster- und Glasreinigung'], ['construction', 'Baureinigung'], ['deep', 'Grundreinigung'], ['office', 'Büroreinigung'], ['change_request', 'Änderung zu bestehendem Auftrag'], ['other', 'Andere Reinigung']]} /><SelectField label="Priorität" value={form.priority} onChange={(value) => setForm({ ...form, priority: value })} options={[['low', 'Niedrig'], ['normal', 'Normal'], ['high', 'Hoch']]} /><InputField label="Wunschtermin optional" type="date" value={form.preferred_date} onChange={(value) => setForm({ ...form, preferred_date: value })} /><SelectField label="Bestehender Standort" value={form.site_id} onChange={(value) => setForm({ ...form, site_id: value })} options={[['', 'Neue oder andere Adresse'], ...data.sites.map((site) => [String(site.id), `${siteName(site)} · ${siteAddress(site)}`] as [string, string])]} />{selectedSite ? <div style={{ ...labelStyle, padding: 14, borderRadius: 14, background: '#FAFAFA' }}><span>Gewählter Standort</span><strong>{siteName(selectedSite)}</strong><small>{siteAddress(selectedSite)}</small></div> : <><InputField label="Strasse und Nummer" value={form.address_text} onChange={(value) => setForm({ ...form, address_text: value })} required={!form.site_id} /><InputField label="PLZ" value={form.postal_code} onChange={(value) => setForm({ ...form, postal_code: value })} required={!form.site_id} /><InputField label="Ort" value={form.city} onChange={(value) => setForm({ ...form, city: value })} required={!form.site_id} /><InputField label="Land" value={form.country} onChange={(value) => setForm({ ...form, country: value })} /></>}<InputField label="Gebäudegrösse m² optional" value={form.building_size_m2} onChange={(value) => setForm({ ...form, building_size_m2: value })} /><InputField label="Etagen optional" value={form.floors} onChange={(value) => setForm({ ...form, floors: value })} /><InputField label="Titel optional" value={form.title} onChange={(value) => setForm({ ...form, title: value })} wide /><TextAreaField label="Beschreibung der gewünschten Reinigung" value={form.description} onChange={(value) => setForm({ ...form, description: value })} wide required /><TextAreaField label="Benötigte Leistungen / zu prüfende Bereiche" value={form.requested_services} onChange={(value) => setForm({ ...form, requested_services: value })} wide /><TextAreaField label="Weitere Bemerkungen" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} wide /><label style={{ ...labelStyle, gridColumn: '1 / -1' }}><span>Bilder und Dokumente</span><input type="file" multiple accept="image/*,.pdf,.doc,.docx" onChange={(event) => setFiles(Array.from(event.target.files || []))} style={fileInputStyle} /></label>{files.length ? <div style={{ ...selectedFilesStyle, gridColumn: '1 / -1' }}>{files.map((file) => <span key={`${file.name}-${file.size}`}><Paperclip size={14} />{file.name}</span>)}</div> : null}<button type="submit" disabled={saving} style={{ ...opcBlackButtonStyle, gridColumn: '1 / -1', justifySelf: 'end' }}><Send size={17} />{saving ? 'Wird übermittelt…' : 'Anfrage an Orange Pro Clean senden'}</button></form></section>
    <style>{`${opcResponsiveStyle}${responsiveCss}`}</style>
  </OPCPageShell>;
}

function splitStreet(value: string) {
  const match = String(value || '').trim().match(/^(.+?)\s+(\d+[a-zA-Z]?)$/);
  return match ? { street: match[1], houseNo: match[2] } : { street: String(value || '').trim(), houseNo: '' };
}

function alphanumToNumberString(value: string) {
  return value.toUpperCase().split('').map((char) => /\d/.test(char) ? char : String(char.charCodeAt(0) - 55)).join('');
}

function mod97(value: string) {
  let checksum = 0;
  for (const char of value) checksum = (checksum * 10 + Number(char)) % 97;
  return checksum;
}

function creditorReference(number: string) {
  const base = String(number || '').replace(/[^0-9A-Z]/gi, '').toUpperCase() || String(Date.now()).slice(-10);
  const check = 98 - mod97(alphanumToNumberString(`${base}RF00`));
  return `RF${String(check).padStart(2, '0')}${base}`;
}

function invoiceQrData(invoice: AnyRow, balance: number) {
  const client = invoice.client_snapshot || {};
  const site = invoice.site_snapshot || {};
  const name = firstValue(client, ['billing_name', 'company_name', 'full_name', 'name'], firstValue(invoice, ['title'], 'Kunde'));
  const address = firstValue(client, ['billing_address', 'address_text', 'address']) || firstValue(site, ['address_text', 'address']);
  const postal = firstValue(site, ['postal_code', 'postcode', 'zip']) || firstValue(client, ['postal_code', 'postcode', 'zip']);
  const city = firstValue(site, ['city']) || firstValue(client, ['city', 'billing_city']);
  const debtor = splitStreet(address.split(',')[0] || address);
  const creditor = splitStreet('Grosspeteranlage 29');
  const reference = creditorReference(firstValue(invoice, ['invoice_number']));
  const amount = balance.toFixed(2);
  return ['SPC', '0200', '1', 'CH5808401000079197833', 'K', 'Orange Pro Clean GmbH', creditor.street, creditor.houseNo, '4052', 'Basel', 'CH', '', '', '', '', '', '', '', amount, 'CHF', 'K', name, debtor.street, debtor.houseNo, postal, city, 'CH', 'SCOR', reference, `Rechnung ${firstValue(invoice, ['invoice_number'])}`, 'EPD'].join('\n');
}

function DocumentDetailPage({ identity, detail, type }: { identity: PortalIdentity; detail: AnyRow; type: 'quote' | 'invoice' }) {
  const document = (type === 'quote' ? detail.quote : detail.invoice) || {};
  const items = Array.isArray(detail.items) ? detail.items : [];
  const subtotal = numberValue(document, ['subtotal_chf']) || items.reduce((sum: number, item: AnyRow) => sum + numberValue(item, ['subtotal_chf']), 0);
  const tax = numberValue(document, ['tax_chf']) || items.reduce((sum: number, item: AnyRow) => sum + numberValue(item, ['tax_chf']), 0);
  const total = numberValue(document, ['total_chf', 'grand_total_chf', 'total_amount']) || subtotal + tax;
  const paid = numberValue(document, ['paid_chf', 'paid_amount']);
  const balance = type === 'invoice' ? numberValue(document, ['open_chf', 'balance_chf', 'open_amount']) || Math.max(total - paid, 0) : total;
  const attachment = documentUrl(document);
  const [downloading, setDownloading] = useState(false);

  async function download() {
    if (attachment) { window.open(attachment, '_blank', 'noopener,noreferrer'); return; }
    setDownloading(true);
    try {
      const totals = { subtotal, discount: numberValue(document, ['discount_chf']), taxRate: numberValue(document, ['tax_rate']) || 8.1, tax, total, balance };
      if (type === 'quote') {
        const pdf = await generateQuotePdfDocument({ quote: document, items, totals, documentType: 'quote' });
        downloadPdf(pdf, `${documentNumber(document, 'quote') || 'Offerte'}.pdf`);
      } else {
        const pdf = await generateInvoicePdfDocument({ invoice: document, items, totals });
        downloadPdf(pdf, `${documentNumber(document, 'invoice') || 'Rechnung'}.pdf`);
      }
    } finally { setDownloading(false); }
  }

  const qrPayload = type === 'invoice' ? invoiceQrData(document, balance) : '';
  return <OPCPageShell>
    <DetailHero backHref="/kundenportal/finanzen" backLabel="Zurück zu Offerten & Rechnungen" title={documentTitle(document, type)} description={`${documentNumber(document, type)} · ${formatDate(firstValue(document, ['issue_date', 'created_at']))}`} action={<div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}><StatusBadge status={document.status} /><button type="button" onClick={() => void download()} disabled={downloading} style={opcBlackButtonStyle}><Download size={17} />{downloading ? 'PDF wird erstellt…' : attachment ? 'Original-PDF herunterladen' : 'PDF herunterladen'}</button></div>} />
    <section style={{ ...opcCardStyle, padding: 22, marginBottom: 18 }}><div className="opc-client-document-meta"><KeyValue label="Kunde" value={identity.company_name} /><KeyValue label={type === 'quote' ? 'Offertennummer' : 'Rechnungsnummer'} value={documentNumber(document, type)} /><KeyValue label={type === 'quote' ? 'Gültig bis' : 'Fällig am'} value={formatDate(firstValue(document, type === 'quote' ? ['valid_until', 'valid_to'] : ['due_date']))} /><KeyValue label="Status" value={statusLabel(document.status)} /></div></section>
    <section style={{ ...opcCardStyle, overflow: 'hidden', marginBottom: 18 }}><div className="opc-client-item-header"><span>Leistung</span><span>Menge</span><span>Einzelpreis</span><span>Total</span></div>{items.map((item: AnyRow, index: number) => <div key={String(item.id || index)} className="opc-client-item-row"><div><strong>{firstValue(item, ['title', 'description'], 'Position')}</strong><span>{firstValue(item, ['description'])}</span></div><strong>{firstValue(item, ['quantity'], '1')} {firstValue(item, ['unit'])}</strong><strong>{formatMoney(numberValue(item, ['unit_price_chf']))}</strong><strong>{formatMoney(numberValue(item, ['total_chf', 'subtotal_chf']))}</strong></div>)}</section>
    <div className="opc-client-document-bottom"><section style={{ ...opcCardStyle, padding: 22 }}><h2 style={sectionTitleStyle}>{type === 'invoice' ? 'Zahlungsinformationen' : 'Dokumentinformationen'}</h2>{type === 'invoice' ? <><KeyValue label="Rechnungsdatum" value={formatDate(document.issue_date)} /><KeyValue label="Fälligkeitsdatum" value={formatDate(document.due_date)} /><KeyValue label="Offener Betrag" value={formatMoney(balance)} /><p style={{ ...sectionDescriptionStyle, marginTop: 16 }}>{firstValue(document, ['payment_terms'], `Bitte bezahlen Sie den offenen Betrag bis zum ${formatDate(document.due_date)}.`)}</p></> : <><KeyValue label="Offertendatum" value={formatDate(document.issue_date)} /><KeyValue label="Gültig bis" value={formatDate(document.valid_until)} /><p style={{ ...sectionDescriptionStyle, marginTop: 16 }}>{firstValue(document, ['customer_notes', 'intro_text'], 'Diese Offerte kann unverändert als PDF heruntergeladen werden.')}</p></>}</section><section style={{ ...opcCardStyle, padding: 22 }}><KeyValue label="Zwischensumme" value={formatMoney(subtotal)} /><KeyValue label={`MwSt. ${numberValue(document, ['tax_rate']) || 8.1}%`} value={formatMoney(tax)} /><div style={totalRowStyle}><span>Gesamtbetrag</span><strong>{formatMoney(total)}</strong></div>{type === 'invoice' ? <KeyValue label="Offener Betrag" value={formatMoney(balance)} /> : null}</section></div>
    {type === 'invoice' ? <section style={{ ...opcCardStyle, padding: 22, marginTop: 18 }}><div className="opc-client-qr-grid"><div><h2 style={sectionTitleStyle}>QR-Zahlung</h2><p style={sectionDescriptionStyle}>Der QR-Code enthält die Zahlungsangaben dieser Rechnung. Für den verbindlichen Zahlungsbeleg kann zusätzlich das PDF heruntergeladen werden.</p><KeyValue label="Zahlbar an" value="Orange Pro Clean GmbH" /><KeyValue label="IBAN" value="CH58 0840 1000 0791 9783 3" /><KeyValue label="Betrag" value={formatMoney(balance)} /><KeyValue label="Fällig am" value={formatDate(document.due_date)} /></div><div style={qrBoxStyle}><QRCodeCanvas value={qrPayload} size={210} level="M" marginSize={2} /><strong>CHF {balance.toFixed(2)}</strong></div></div></section> : null}
    <style>{`${opcResponsiveStyle}${responsiveCss}`}</style>
  </OPCPageShell>;
}

function InputField({ label, value, onChange, required = false, wide = false, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; wide?: boolean; type?: string }) {
  return <label style={{ ...labelStyle, gridColumn: wide ? '1 / -1' : undefined }}><span>{label}</span><input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} style={opcInputStyle} /></label>;
}

function TextAreaField({ label, value, onChange, wide = false, required = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean; required?: boolean }) {
  return <label style={{ ...labelStyle, gridColumn: wide ? '1 / -1' : undefined }}><span>{label}</span><textarea value={value} required={required} onChange={(event) => onChange(event.target.value)} style={{ ...opcInputStyle, minHeight: 120, height: 'auto', paddingTop: 12, resize: 'vertical' }} /></label>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <label style={labelStyle}><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} style={opcSelectStyle}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}

function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return <div style={keyValueStyle}><span>{label}</span><strong>{value || '—'}</strong></div>;
}

function DetailLine({ icon, text }: { icon: ReactNode; text: string }) {
  return <div style={detailLineStyle}>{icon}<span>{text}</span></div>;
}

function EmptyBlock({ title, text }: { title: string; text: string }) {
  return <div style={emptyStyle}><CheckCircle2 size={24} /><strong>{title}</strong><span>{text}</span></div>;
}

function MessageBox({ type, text }: { type: 'error' | 'success'; text: string }) {
  return <div style={type === 'error' ? errorStyle : successStyle}>{text}</div>;
}

export default function OpcClientPortalAppV4({ section, itemId }: { section: PortalSection; itemId?: string }) {
  const delegated = ['overview', 'documents', 'finance', 'settings'].includes(section);
  const [identity, setIdentity] = useState<PortalIdentity | null>(null);
  const [data, setData] = useState<PortalDataset>(emptyDataset);
  const [detail, setDetail] = useState<AnyRow | null>(null);
  const [loading, setLoading] = useState(!delegated);
  const [error, setError] = useState('');

  async function load() {
    if (delegated) return;
    setLoading(true); setError('');
    try {
      const datasetResult = await apiRequest('/api/opc/client-portal/data');
      if (!datasetResult.portal) throw new Error('Kundenkonto konnte nicht geladen werden.');
      setIdentity(datasetResult.portal);
      setData(datasetResult.data || emptyDataset);
      let detailResult: ApiResponse | null = null;
      if (section === 'order-detail' && itemId) detailResult = await apiRequest(`/api/opc/client-portal?job_id=${encodeURIComponent(itemId)}`);
      if (section === 'ticket-detail' && itemId) detailResult = await apiRequest(`/api/opc/client-portal/ticket/${encodeURIComponent(itemId)}`);
      if (section === 'site-detail' && itemId) detailResult = await apiRequest(`/api/opc/client-portal/site/${encodeURIComponent(itemId)}`);
      if (section === 'quote-detail' && itemId) detailResult = await apiRequest(`/api/opc/client-portal/quote/${encodeURIComponent(itemId)}`);
      if (section === 'invoice-detail' && itemId) detailResult = await apiRequest(`/api/opc/client-portal/invoice/${encodeURIComponent(itemId)}`);
      setDetail(detailResult?.detail || null);
    } catch (err: any) { setError(err?.message || 'Kundenportal konnte nicht geladen werden.'); } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [section, itemId]);

  if (delegated) return <OpcClientPortalAppV3 section={section as any} itemId={itemId} />;

  return <MirakaDashboardShell hideTopBar requiredRole="client" currentPath={currentPathFor(section)}>
    {loading ? <PortalSkeleton variant={section.includes('detail') ? 'detail' : 'table'} /> : error || !identity ? <div style={errorPageStyle}><AlertTriangle size={24} /><strong>Kundenportal nicht verfügbar</strong><span>{error || 'Die Seite konnte nicht geladen werden.'}</span><button type="button" onClick={() => void load()} style={opcSecondaryButtonStyle}>Erneut versuchen</button></div> : section === 'orders' ? <OrdersPage data={data} /> : section === 'order-detail' && detail ? <OrderDetailPage detail={detail} /> : section === 'sites' ? <SitesPage data={data} reload={load} /> : section === 'site-detail' && detail ? <SiteDetailPage detail={detail} reload={load} /> : section === 'requests' ? <RequestsPage identity={identity} data={data} /> : section === 'ticket-detail' && detail ? <TicketDetailPage detail={detail} data={data} reload={load} /> : section === 'cleaning-request' ? <CleaningRequestPage data={data} /> : section === 'quote-detail' && detail ? <DocumentDetailPage identity={identity} detail={detail} type="quote" /> : section === 'invoice-detail' && detail ? <DocumentDetailPage identity={identity} detail={detail} type="invoice" /> : <EmptyBlock title="Bereich nicht verfügbar" text="Die gewünschte Seite konnte nicht geöffnet werden." />}
  </MirakaDashboardShell>;
}

const pageTitleStyle: CSSProperties = { margin: 0, fontSize: 31, lineHeight: 1.05, letterSpacing: '-0.045em', fontWeight: 860, color: OPC_BRAND.text };
const pageDescriptionStyle: CSSProperties = { margin: '9px 0 0', fontSize: 14, lineHeight: 1.55, fontWeight: 600, color: OPC_BRAND.muted };
const sectionTitleStyle: CSSProperties = { margin: 0, fontSize: 20, lineHeight: 1.2, fontWeight: 860, letterSpacing: '-0.03em', color: OPC_BRAND.text };
const sectionDescriptionStyle: CSSProperties = { margin: '6px 0 0', color: OPC_BRAND.muted, fontSize: 13, lineHeight: 1.5, fontWeight: 620 };
const pillStyle: CSSProperties = { minHeight: 30, padding: '0 12px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 760, whiteSpace: 'nowrap' };
const freeCardStyle: CSSProperties = { ...opcCardStyle, padding: 20, minHeight: 260, display: 'grid', alignContent: 'space-between', gap: 18, textDecoration: 'none', color: OPC_BRAND.text };
const iconBoxStyle: CSSProperties = { width: 42, height: 42, borderRadius: 14, border: `1px solid ${OPC_BRAND.border}`, background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const cardTitleStyle: CSSProperties = { margin: 0, fontSize: 20, fontWeight: 860, letterSpacing: '-0.03em', lineHeight: 1.18, color: OPC_BRAND.text };
const cardSubStyle: CSSProperties = { margin: '7px 0 0', color: OPC_BRAND.muted, fontSize: 13, fontWeight: 650 };
const cardMetaWrapStyle: CSSProperties = { display: 'grid', gap: 9, color: OPC_BRAND.muted, fontSize: 13, fontWeight: 650 };
const descriptionClampStyle: CSSProperties = { margin: 0, color: OPC_BRAND.muted, fontSize: 13, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' };
const countBadgeStyle: CSSProperties = { ...pillStyle, background: '#F8FAFC', color: OPC_BRAND.muted };
const backLinkStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 18, color: OPC_BRAND.muted, textDecoration: 'none', fontSize: 13, fontWeight: 760 };
const detailLineStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 14, color: OPC_BRAND.muted, fontSize: 13, lineHeight: 1.5, fontWeight: 620 };
const keyValueStyle: CSSProperties = { minHeight: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, borderBottom: '1px solid #F3F4F6', fontSize: 13, color: OPC_BRAND.muted };
const emptyStyle: CSSProperties = { ...opcCardStyle, minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, padding: 34, color: OPC_BRAND.muted, textAlign: 'center' };
const rowTitleWrapStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 };
const rowTitleStyle: CSSProperties = { fontSize: 15, fontWeight: 800, color: OPC_BRAND.text, marginBottom: 5 };
const rowSubStyle: CSSProperties = { fontSize: 13, fontWeight: 600, color: OPC_BRAND.muted };
const documentRowStyle: CSSProperties = { minHeight: 68, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: 14, alignItems: 'center', padding: '12px 14px', border: `1px solid ${OPC_BRAND.border}`, borderRadius: 14, textDecoration: 'none', color: OPC_BRAND.text };
const simpleLinkRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14, border: `1px solid ${OPC_BRAND.border}`, borderRadius: 14, textDecoration: 'none', color: OPC_BRAND.text };
const labelStyle: CSSProperties = { display: 'grid', gap: 7, fontSize: 13, fontWeight: 720, color: OPC_BRAND.text };
const fileInputStyle: CSSProperties = { ...opcInputStyle, height: 'auto', minHeight: 52, padding: 12 };
const selectedFilesStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 };
const mediaCardStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '32px minmax(0, 1fr) 20px', gap: 12, alignItems: 'center', padding: 14, border: `1px solid ${OPC_BRAND.border}`, borderRadius: 14, color: OPC_BRAND.text, textDecoration: 'none' };
const timelineRowStyle: CSSProperties = { position: 'relative', display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr)', gap: 12, padding: '0 0 22px' };
const timelineDotStyle: CSSProperties = { width: 12, height: 12, borderRadius: '50%', background: OPC_BRAND.black, marginTop: 4, boxShadow: '0 0 0 5px #F3F4F6' };
const totalRowStyle: CSSProperties = { minHeight: 62, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, fontSize: 18, color: OPC_BRAND.text };
const qrBoxStyle: CSSProperties = { display: 'grid', justifyItems: 'center', gap: 12, padding: 18, border: `1px solid ${OPC_BRAND.border}`, borderRadius: 16, background: '#FFFFFF' };
const errorStyle: CSSProperties = { marginBottom: 18, padding: '14px 16px', borderRadius: 14, border: '1px solid #FCA5A5', background: '#FEF2F2', color: OPC_BRAND.red, fontSize: 14, fontWeight: 620 };
const successStyle: CSSProperties = { marginBottom: 18, padding: '14px 16px', borderRadius: 14, border: '1px solid #86EFAC', background: '#F0FDF4', color: OPC_BRAND.green, fontSize: 14, fontWeight: 620 };
const errorPageStyle: CSSProperties = { minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: OPC_BRAND.muted, fontFamily: OPC_PAGE_FONT };
const responsiveCss = `
.opc-client-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.opc-client-two-column{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.opc-client-section-header,.opc-client-detail-hero-row{display:flex;justify-content:space-between;align-items:flex-start;gap:18px}
.opc-client-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.opc-client-media-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:16px}
.opc-client-document-meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}
.opc-client-item-header,.opc-client-item-row{display:grid;grid-template-columns:minmax(280px,1.4fr) 140px 170px 170px;gap:20px;align-items:center}
.opc-client-item-header{padding:15px 22px;background:#FAFAFA;color:#6B7280;font-size:12px;font-weight:760}
.opc-client-item-row{padding:20px 22px;border-top:1px solid #F3F4F6}
.opc-client-item-row>div{display:grid;gap:6px}.opc-client-item-row span{color:#6B7280;font-size:13px}
.opc-client-document-bottom{display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,.65fr);gap:16px}
.opc-client-qr-grid{display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:24px;align-items:start}
@media(max-width:1200px){.opc-client-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.opc-client-form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.opc-client-media-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.opc-client-document-meta{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:900px){.opc-client-two-column,.opc-client-document-bottom,.opc-client-qr-grid{grid-template-columns:1fr}.opc-client-item-header{display:none}.opc-client-item-row{grid-template-columns:1fr 1fr;padding:18px}.opc-client-item-row>div{grid-column:1/-1}.opc-client-section-header,.opc-client-detail-hero-row{flex-direction:column}.opc-client-section-header>a,.opc-client-section-header>button{width:100%}}
@media(max-width:700px){.opc-client-card-grid,.opc-client-form-grid,.opc-client-media-grid,.opc-client-document-meta{grid-template-columns:1fr}.opc-client-item-row{grid-template-columns:1fr}.opc-client-item-row>*{grid-column:1}.opc-client-document-meta>div{min-width:0}.opc-client-detail-hero-row>div,.opc-client-detail-hero-row button{width:100%}}
`;