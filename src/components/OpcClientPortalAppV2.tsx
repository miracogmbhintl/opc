import {
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Download,
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
  type LucideIcon,
} from 'lucide-react';
import { supabase, type UserProfile } from '../lib/supabase';
import { clearCachedOpcAuthProfile, loadOpcAuthProfile } from '../lib/opc-auth-cache';
import { baseUrl } from '../lib/base-url';
import { safeNavigate } from '../lib/opc-navigation-guard';

import { rememberOpcAuthReturnTarget, clearOpcAuthReturnTarget } from '../lib/opc-auth-return';
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

type DocumentDetail = { quote?: AnyRow; invoice?: AnyRow; items: AnyRow[] };
type PortalResponse = {
  ok: boolean;
  error?: string;
  portal?: PortalIdentity;
  data?: PortalDataset;
  detail?: AnyRow;
};
type NavItem = { section: PortalSection; href: string; label: string; icon: LucideIcon };

const LOGO_URL =
  'https://cdn.prod.website-files.com/6944470386300e196e5fc347/6949534529e8342842456097_REGULAR%20COLOR%20ORANGE%20PRO%20CLEAN%20LOGO%20ORIGINAL.png';

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  black: '#0F1115',
  card: '#FFFFFF',
  soft: '#FAFAFA',
  orange: '#FF7A00',
  green: '#166534',
  greenBg: '#F0FDF4',
  amber: '#92400E',
  amberBg: '#FFFBEB',
  red: '#B91C1C',
  redBg: '#FEF2F2',
};

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';
const emptyDataset: PortalDataset = { sites: [], jobs: [], reports: [], tickets: [], quotes: [], invoices: [], documents: [] };
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
function snapshotValue(row: AnyRow | null | undefined, snapshotKey: string, keys: string[]) {
  const snapshot = row?.[snapshotKey];
  return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? firstValue(snapshot as AnyRow, keys)
    : '';
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
  return date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatDateTime(value: unknown) {
  if (!value) return 'Termin folgt';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'Termin folgt';
  return date.toLocaleString('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatMoney(value: unknown) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', minimumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0);
}
function formatQuantity(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? new Intl.NumberFormat('de-CH', { maximumFractionDigits: 2 }).format(amount) : '0';
}
function getInitials(value: string) {
  const parts = String(value || '').replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return 'K';
  return parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
function statusLabel(status: unknown) {
  const clean = normalize(status);
  const labels: Record<string, string> = {
    draft: 'Entwurf', ready: 'Bereit', new: 'Neu', open: 'Offen', scheduled: 'Geplant', assigned: 'Zugewiesen', confirmed: 'Bestätigt',
    on_site: 'Vor Ort', onsite: 'Vor Ort', in_progress: 'In Bearbeitung', started: 'Gestartet', running: 'Läuft', completed: 'Abgeschlossen',
    submitted: 'Eingereicht', approved: 'Freigegeben', report_approved: 'Bericht freigegeben', sent_to_client: 'An Kunde gesendet', published: 'Veröffentlicht',
    resolved: 'Erledigt', closed: 'Geschlossen', accepted: 'Angenommen', declined: 'Abgelehnt', expired: 'Abgelaufen', sent: 'Versendet', viewed: 'Gesehen',
    paid: 'Bezahlt', partially_paid: 'Teilbezahlt', overdue: 'Überfällig', cancelled: 'Storniert', low: 'Niedrig', normal: 'Normal', high: 'Hoch',
    office: 'Büro', commercial: 'Gewerbe',
  };
  return labels[clean] || clean.replace(/_/g, ' ') || 'Unbekannt';
}
function statusTone(status: unknown) {
  const clean = normalize(status);
  if (['completed', 'approved', 'report_approved', 'sent_to_client', 'published', 'paid', 'resolved', 'closed', 'accepted'].includes(clean)) return { color: BRAND.green, background: BRAND.greenBg, border: '#BBF7D0' };
  if (['overdue', 'cancelled', 'declined', 'expired', 'rejected'].includes(clean)) return { color: BRAND.red, background: BRAND.redBg, border: '#FECACA' };
  if (['in_progress', 'on_site', 'onsite', 'started', 'running', 'open', 'new', 'high'].includes(clean)) return { color: BRAND.amber, background: BRAND.amberBg, border: '#FDE68A' };
  return { color: BRAND.muted, background: '#F9FAFB', border: BRAND.border };
}
function StatusBadge({ status }: { status: unknown }) {
  const tone = statusTone(status);
  return <span className="opc-cp-status" style={{ color: tone.color, background: tone.background, borderColor: tone.border }}>{statusLabel(status)}</span>;
}
function Card({ children, style, className = '' }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  return <section className={`opc-cp-card ${className}`} style={style}>{children}</section>;
}
function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="opc-cp-page-title"><div><div className="opc-cp-eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action ? <div className="opc-cp-page-action">{action}</div> : null}</div>;
}
function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return <a className="opc-cp-primary-button" href={buildUrl(href)}>{children}</a>;
}
function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return <a className="opc-cp-secondary-button" href={buildUrl(href)}>{children}</a>;
}
function EmptyState({ title, description }: { title: string; description: string }) {
  return <Card className="opc-cp-empty"><div className="opc-cp-empty-icon"><FileText size={20} /></div><div><strong>{title}</strong><p>{description}</p></div></Card>;
}
function documentUrl(row: AnyRow | null | undefined) {
  const keys = ['download_url', 'file_url', 'public_url', 'pdf_url', 'document_url', 'signed_url'];
  return firstValue(row, keys) || firstValue(metadata(row), keys);
}
function siteLabel(site: AnyRow | null | undefined) {
  return firstValue(site, ['site_name', 'name', 'title', 'address_text'], 'Standort');
}
function siteAddress(site: AnyRow | null | undefined) {
  const addressText = firstValue(site, ['address_text', 'formatted_address']);
  const location = [firstValue(site, ['postal_code', 'zip']), firstValue(site, ['city'])].filter(Boolean).join(' ');
  if (addressText) return location && !addressText.includes(location) ? `${addressText}, ${location}` : addressText;
  return [firstValue(site, ['street', 'address']), location].filter(Boolean).join(', ');
}
function jobStart(job: AnyRow) { return firstValue(job, ['planned_start', 'start_time', 'scheduled_at', 'date_time']); }
function jobStatus(job: AnyRow) { return firstValue(job, ['status', 'job_status'], 'scheduled'); }
function jobTitle(job: AnyRow) { return firstValue(job, ['title', 'job_title', 'service_category', 'job_type'], 'Reinigungsauftrag'); }
function reportTitle(report: AnyRow) { return firstValue(report, ['report_title', 'title', 'name'], 'Einsatzbericht'); }
function documentTitle(row: AnyRow, type: 'quote' | 'invoice') {
  return firstValue(row, type === 'quote' ? ['title', 'quote_title', 'subject'] : ['title', 'invoice_title', 'subject'], type === 'quote' ? 'Offerte' : 'Rechnung');
}
function documentNumber(row: AnyRow, type: 'quote' | 'invoice') {
  return firstValue(row, type === 'quote' ? ['quote_number', 'number'] : ['invoice_number', 'number']);
}
function documentTotal(row: AnyRow) { return numberValue(row, ['total_chf', 'grand_total_chf', 'total_amount', 'amount']); }
function customerNameFromDocument(row: AnyRow, identity: PortalIdentity) {
  return snapshotValue(row, 'client_snapshot', ['billing_name', 'company_name', 'business_name', 'full_name', 'contact_name', 'name']) || identity.company_name;
}
function customerAddressFromDocument(row: AnyRow) {
  const snapshot = row?.client_snapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return '';
  const source = snapshot as AnyRow;
  return firstValue(source, ['billing_address', 'address_text', 'formatted_address']) || [firstValue(source, ['billing_street', 'street', 'address_line_1']), [firstValue(source, ['billing_postal_code', 'postal_code', 'zip']), firstValue(source, ['billing_city', 'city'])].filter(Boolean).join(' '), firstValue(source, ['country'])].filter(Boolean).join(', ');
}

function ClientSidebar({ section, identity, collapsed, mobileOpen, onToggle, onCloseMobile, onLogout }: { section: PortalSection; identity: PortalIdentity; collapsed: boolean; mobileOpen: boolean; onToggle: () => void; onCloseMobile: () => void; onLogout: () => void }) {
  const width = collapsed ? 72 : 260;
  return <>{mobileOpen ? <button className="opc-cp-mobile-backdrop" type="button" onClick={onCloseMobile} aria-label="Menü schliessen" /> : null}<aside className={`opc-cp-sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`} style={{ width }}><div className="opc-cp-sidebar-logo">{collapsed ? <div className="opc-cp-logo-mark">O</div> : <img src={LOGO_URL} alt="Orange Pro Clean GmbH" />}</div><div className="opc-cp-sidebar-caption"><ShieldCheck size={15} />{!collapsed ? <span>Kundenportal</span> : null}</div><button className="opc-cp-collapse-button" type="button" onClick={onToggle}>{collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}{!collapsed ? <span>Einklappen</span> : null}</button><nav className="opc-cp-nav">{navItems.map((item) => { const Icon = item.icon; const active = section === item.section || (section === 'order-detail' && item.section === 'orders') || ((section === 'quote-detail' || section === 'invoice-detail') && item.section === 'finance'); return <a key={item.section} href={buildUrl(item.href)} className={active ? 'active' : ''} title={collapsed ? item.label : undefined} onClick={onCloseMobile}><Icon size={19} strokeWidth={1.9} />{!collapsed ? <span>{item.label}</span> : null}</a>; })}</nav><div className="opc-cp-sidebar-profile"><div className="opc-cp-avatar">{getInitials(identity.display_name)}</div>{!collapsed ? <div className="opc-cp-profile-copy"><div>{identity.display_name}</div><span>{identity.company_name}</span></div> : null}<button type="button" onClick={onLogout} title="Abmelden"><LogOut size={18} /></button></div></aside></>;
}
function MetricCard({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return <Card className="opc-cp-metric-card"><div><strong>{value}</strong><span>{label}</span></div><div className="opc-cp-metric-icon"><Icon size={18} /></div></Card>;
}
function SimpleListRow({ icon, title, meta, trailing, href }: { icon: ReactNode; title: string; meta: ReactNode; trailing?: ReactNode; href?: string }) {
  const content = <><div className="opc-cp-row-icon">{icon}</div><div className="opc-cp-row-copy"><strong>{title}</strong><div>{meta}</div></div>{trailing ? <div className="opc-cp-row-trailing">{trailing}</div> : null}</>;
  return href ? <a className="opc-cp-list-row is-link" href={buildUrl(href)}>{content}</a> : <div className="opc-cp-list-row">{content}</div>;
}

function OverviewPage({ identity, data }: { identity: PortalIdentity; data: PortalDataset }) {
  const now = Date.now();
  const completed = new Set(['completed', 'approved', 'report_approved', 'sent_to_client']);
  const upcomingJobs = data.jobs.filter((job) => { const time = new Date(jobStart(job)).getTime(); return Number.isFinite(time) && time >= now && !completed.has(normalize(jobStatus(job))); }).sort((a, b) => new Date(jobStart(a)).getTime() - new Date(jobStart(b)).getTime());
  const activeJobs = data.jobs.filter((job) => ['assigned', 'confirmed', 'on_site', 'onsite', 'in_progress', 'started', 'running'].includes(normalize(jobStatus(job))));
  const openTickets = data.tickets.filter((ticket) => ['new', 'open', 'in_progress'].includes(normalize(ticket.status)));
  const openInvoices = data.invoices.filter((invoice) => ['sent', 'open', 'overdue', 'pending', 'partially_paid'].includes(normalize(invoice.status)));
  const nextJob = upcomingJobs[0] || null;
  const firstName = identity.display_name.split(/\s+/)[0] || identity.display_name;
  const recentDocuments = [...data.quotes.map((row) => ({ row, type: 'quote' as const })), ...data.invoices.map((row) => ({ row, type: 'invoice' as const }))].sort((a, b) => new Date(firstValue(b.row, ['issue_date', 'created_at'])).getTime() - new Date(firstValue(a.row, ['issue_date', 'created_at'])).getTime()).slice(0, 3);
  return <><PageTitle eyebrow="Kundenportal" title={`Guten Tag, ${firstName}`} description={`Alle Informationen zu ${identity.company_name}: Aufträge, Termine, Berichte, Dokumente und Anfragen.`} action={<PrimaryLink href="/kundenportal/anfragen"><Plus size={16} /> Neue Anfrage</PrimaryLink>} /><div className="opc-cp-metric-grid"><MetricCard icon={CalendarDays} value={upcomingJobs.length} label="Bevorstehende Einsätze" /><MetricCard icon={ClipboardList} value={activeJobs.length} label="Aktive Aufträge" /><MetricCard icon={MessageSquareWarning} value={openTickets.length} label="Offene Anfragen" /><MetricCard icon={CircleDollarSign} value={openInvoices.length} label="Offene Rechnungen" /></div><div className="opc-cp-dashboard-grid"><Card className="opc-cp-feature-card"><div className="opc-cp-card-heading"><div><span>Nächster Einsatz</span><h2>{nextJob ? jobTitle(nextJob) : 'Kein Termin geplant'}</h2></div><div className="opc-cp-heading-icon"><CalendarDays size={20} /></div></div>{nextJob ? <><div className="opc-cp-detail-line"><Clock3 size={16} /><span>{formatDateTime(jobStart(nextJob))}</span></div><div className="opc-cp-detail-line"><MapPin size={16} /><span>{firstValue(nextJob, ['site_name', 'site_address', 'address_text', 'city'], 'Standort gemäss Auftrag')}</span></div><div className="opc-cp-feature-actions"><PrimaryLink href={`/kundenportal/auftrag/${nextJob.id}`}>Auftrag öffnen <ChevronRight size={16} /></PrimaryLink></div></> : <p className="opc-cp-muted">Sobald ein neuer Einsatz bestätigt ist, erscheint er an dieser Stelle.</p>}</Card><Card className="opc-cp-quick-card"><div className="opc-cp-card-heading compact"><div><span>Schnellzugriff</span><h2>Kundenbereiche</h2></div></div><div className="opc-cp-quick-links"><a href={buildUrl('/kundenportal/auftraege')}><ClipboardList size={18} /><span>Meine Aufträge</span><ChevronRight size={16} /></a><a href={buildUrl('/kundenportal/dokumente')}><FileText size={18} /><span>Berichte & Dokumente</span><ChevronRight size={16} /></a><a href={buildUrl('/kundenportal/finanzen')}><ReceiptText size={18} /><span>Offerten & Rechnungen</span><ChevronRight size={16} /></a></div></Card></div><div className="opc-cp-two-column"><Card className="opc-cp-list-card"><div className="opc-cp-section-header"><div><span>Dokumentation</span><h2>Letzte Berichte</h2></div><SecondaryLink href="/kundenportal/dokumente">Alle ansehen</SecondaryLink></div>{data.reports.slice(0, 3).length ? data.reports.slice(0, 3).map((report) => <SimpleListRow key={String(report.id)} icon={<FileText size={18} />} title={reportTitle(report)} meta={<><span>{formatDate(firstValue(report, ['report_date', 'completed_at', 'updated_at']))}</span><StatusBadge status={report.status} /></>} />) : <div className="opc-cp-card-empty">Noch keine freigegebenen Berichte.</div>}</Card><Card className="opc-cp-list-card"><div className="opc-cp-section-header"><div><span>Kundendokumente</span><h2>Letzte Dokumente</h2></div><SecondaryLink href="/kundenportal/finanzen">Alle ansehen</SecondaryLink></div>{recentDocuments.map(({ row, type }) => <SimpleListRow key={`${type}-${row.id}`} href={type === 'quote' ? `/kundenportal/offerte/${row.id}` : `/kundenportal/rechnung/${row.id}`} icon={type === 'quote' ? <FileText size={18} /> : <ReceiptText size={18} />} title={documentTitle(row, type)} meta={<><span>{documentNumber(row, type)}</span><span>{formatMoney(documentTotal(row))}</span></>} trailing={<StatusBadge status={row.status} />} />)}{!recentDocuments.length ? <div className="opc-cp-card-empty">Noch keine Offerten oder Rechnungen.</div> : null}</Card></div></>;
}

function OrdersPage({ data }: { data: PortalDataset }) {
  const sorted = [...data.jobs].sort((a, b) => new Date(jobStart(b)).getTime() - new Date(jobStart(a)).getTime());
  const sites = new Map(data.sites.map((site) => [String(site.id), site]));
  return <><PageTitle eyebrow="Aufträge" title="Meine Aufträge" description="Geplante, laufende und abgeschlossene Reinigungsaufträge Ihres Unternehmens." />{sorted.length ? <Card className="opc-cp-table-card"><div className="opc-cp-table-head opc-cp-orders-grid"><span>Auftrag</span><span>Termin</span><span>Standort</span><span>Status</span><span /></div>{sorted.map((job) => { const site = sites.get(String(job.client_site_id || job.site_id || '')); return <a className="opc-cp-table-row opc-cp-orders-grid" href={buildUrl(`/kundenportal/auftrag/${job.id}`)} key={String(job.id)}><div className="opc-cp-table-title"><div className="opc-cp-row-icon"><ClipboardList size={18} /></div><div><strong>{jobTitle(job)}</strong><span>{firstValue(job, ['service_category', 'job_type'], 'Reinigung')}</span></div></div><div>{formatDateTime(jobStart(job))}</div><div>{site ? `${siteLabel(site)}${siteAddress(site) ? ` · ${siteAddress(site)}` : ''}` : firstValue(job, ['site_name', 'site_address', 'city'], 'Standort gemäss Auftrag')}</div><div><StatusBadge status={jobStatus(job)} /></div><div className="opc-cp-row-arrow"><ChevronRight size={18} /></div></a>; })}</Card> : <EmptyState title="Noch keine Aufträge" description="Bestätigte Reinigungsaufträge erscheinen automatisch in diesem Bereich." />}</>;
}

function OrderDetailPage({ detail }: { detail: AnyRow }) {
  const job = detail.job || {};
  const site = detail.site || null;
  const reports = Array.isArray(detail.reports) ? detail.reports.filter((report: AnyRow) => ['approved', 'report_approved', 'sent_to_client', 'published', 'completed'].includes(normalize(report.status)) || metadata(report).client_visible === true) : [];
  return <><a className="opc-cp-back-link" href={buildUrl('/kundenportal/auftraege')}><ArrowLeft size={17} /> Zurück zu meinen Aufträgen</a><PageTitle eyebrow="Auftragsdetails" title={jobTitle(job)} description={firstValue(job, ['service_description'], 'Informationen und freigegebene Dokumentation zu diesem Auftrag.')} action={<StatusBadge status={jobStatus(job)} />} /><div className="opc-cp-two-column"><Card className="opc-cp-detail-card"><div className="opc-cp-card-heading compact"><div><span>Einsatz</span><h2>Termin und Standort</h2></div><CalendarDays size={20} /></div><div className="opc-cp-detail-line"><CalendarDays size={17} /><span>{formatDateTime(jobStart(job))}</span></div><div className="opc-cp-detail-line"><Clock3 size={17} /><span>Geplantes Ende: {formatDateTime(firstValue(job, ['planned_end', 'end_time']))}</span></div><div className="opc-cp-detail-line"><MapPin size={17} /><span>{site ? `${siteLabel(site)}${siteAddress(site) ? ` · ${siteAddress(site)}` : ''}` : 'Standort gemäss Auftrag'}</span></div></Card><Card className="opc-cp-detail-card"><div className="opc-cp-card-heading compact"><div><span>Leistungsumfang</span><h2>Vereinbarte Leistung</h2></div><ClipboardList size={20} /></div><div className="opc-cp-key-value"><span>Dienstleistung</span><strong>{firstValue(job, ['service_category', 'job_type'], 'Reinigung')}</strong></div><div className="opc-cp-key-value"><span>Geschätzter Aufwand</span><strong>{numberValue(job, ['estimated_hours', 'planned_hours']) || '—'} Std.</strong></div><div className="opc-cp-key-value"><span>Priorität</span><strong>{statusLabel(firstValue(job, ['priority'], 'normal'))}</strong></div></Card></div>{firstValue(job, ['client_notes']) ? <Card className="opc-cp-text-card"><div className="opc-cp-section-header"><div><span>Kundenhinweise</span><h2>Ihre Hinweise</h2></div></div><p>{firstValue(job, ['client_notes'])}</p></Card> : null}<Card className="opc-cp-list-card opc-cp-detail-reports"><div className="opc-cp-section-header"><div><span>Dokumentation</span><h2>Berichte zu diesem Auftrag</h2></div></div>{reports.length ? reports.map((report: AnyRow) => <SimpleListRow key={String(report.id)} icon={<FileText size={18} />} title={reportTitle(report)} meta={<span>{formatDate(firstValue(report, ['report_date', 'completed_at', 'updated_at']))}</span>} trailing={<StatusBadge status={report.status} />} />) : <div className="opc-cp-card-empty">Für diesen Auftrag wurde noch kein Bericht freigegeben.</div>}</Card></>;
}

function SitesPage({ data }: { data: PortalDataset }) {
  return <><PageTitle eyebrow="Objekte" title="Standorte" description="Ihre hinterlegten Liegenschaften, Filialen und Reinigungsobjekte." />{data.sites.length ? <div className="opc-cp-site-grid">{data.sites.map((site) => { const jobs = data.jobs.filter((job) => String(job.client_site_id || job.site_id || '') === String(site.id)); return <Card key={String(site.id)} className="opc-cp-site-card"><div className="opc-cp-card-heading compact"><div><span>{jobs.length} {jobs.length === 1 ? 'Auftrag' : 'Aufträge'}</span><h2>{siteLabel(site)}</h2></div><div className="opc-cp-heading-icon"><Building2 size={19} /></div></div><div className="opc-cp-detail-line"><MapPin size={16} /><span>{siteAddress(site) || 'Adresse nicht hinterlegt'}</span></div>{firstValue(site, ['site_type']) ? <div className="opc-cp-detail-line"><Building2 size={16} /><span>{statusLabel(firstValue(site, ['site_type']))}</span></div> : null}</Card>; })}</div> : <EmptyState title="Keine Standorte hinterlegt" description="Sobald ein Objekt einem Kundenkonto zugeordnet wurde, erscheint es hier." />}</>;
}

function DocumentsPage({ data }: { data: PortalDataset }) {
  return <><PageTitle eyebrow="Dokumentation" title="Berichte & Dokumente" description="Freigegebene Einsatzberichte, Qualitätsnachweise und allgemeine Kundendokumente." /><div className="opc-cp-two-column"><Card className="opc-cp-list-card"><div className="opc-cp-section-header"><div><span>Qualitätsnachweise</span><h2>Einsatzberichte</h2></div></div>{data.reports.length ? data.reports.map((report) => <SimpleListRow key={String(report.id)} icon={<FileText size={18} />} title={reportTitle(report)} meta={<><span>{formatDate(firstValue(report, ['report_date', 'completed_at', 'updated_at']))}</span><StatusBadge status={report.status} /></>} trailing={documentUrl(report) ? <a className="opc-cp-icon-button" href={documentUrl(report)} target="_blank" rel="noreferrer"><Download size={17} /></a> : undefined} />) : <div className="opc-cp-card-empty">Noch keine freigegebenen Einsatzberichte.</div>}</Card><Card className="opc-cp-list-card"><div className="opc-cp-section-header"><div><span>Dateien</span><h2>Weitere Dokumente</h2></div></div>{data.documents.length ? data.documents.map((row) => <SimpleListRow key={String(row.id)} icon={<FileText size={18} />} title={firstValue(row, ['title', 'document_title', 'filename', 'name'], 'Dokument')} meta={<><span>{firstValue(row, ['document_number', 'reference_number'])}</span><span>{formatDate(firstValue(row, ['document_date', 'created_at']))}</span></>} trailing={documentUrl(row) ? <a className="opc-cp-icon-button" href={documentUrl(row)} target="_blank" rel="noreferrer"><Download size={17} /></a> : undefined} />) : <div className="opc-cp-card-empty">Noch keine weiteren Dokumente bereitgestellt.</div>}</Card></div></>;
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
      await onReload();
    } catch (err: any) { setError(err?.message || 'Anfrage konnte nicht erstellt werden.'); } finally { setSaving(false); }
  }
  return <><PageTitle eyebrow="Service" title="Anfragen & Schäden" description="Zusätzliche Reinigungen anfragen oder einen Schaden mit allen relevanten Angaben melden." action={identity.permissions.canCreateRequests ? <button className="opc-cp-primary-button" type="button" onClick={() => setShowForm((value) => !value)}>{showForm ? <X size={16} /> : <Plus size={16} />}{showForm ? 'Schliessen' : 'Neue Anfrage'}</button> : undefined} />{error ? <div className="opc-cp-error">{error}</div> : null}{message ? <div className="opc-cp-success">{message}</div> : null}{showForm ? <Card className="opc-cp-form-card"><form onSubmit={submit} className="opc-cp-request-form"><label><span>Anfrageart</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="cleaning_needed">Reinigungsanfrage</option><option value="damage">Schadenmeldung</option></select></label><label><span>Standort</span><select value={form.site_id} onChange={(event) => setForm({ ...form, site_id: event.target.value })}><option value="">Kein bestimmter Standort</option>{data.sites.map((site) => <option key={String(site.id)} value={String(site.id)}>{siteLabel(site)}</option>)}</select></label><label><span>Priorität</span><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="low">Niedrig</option><option value="normal">Normal</option><option value="high">Hoch</option></select></label><label className="wide"><span>Titel</span><input required value={form.title} maxLength={180} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Kurze Zusammenfassung" /></label><label className="wide"><span>Beschreibung</span><textarea required value={form.description} maxLength={3000} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Beschreiben Sie Ihr Anliegen möglichst genau." /></label><div className="wide opc-cp-form-actions"><button className="opc-cp-primary-button" type="submit" disabled={saving}>{saving ? <Loader2 className="opc-cp-spin" size={16} /> : <Send size={16} />}{saving ? 'Wird gesendet…' : 'Anfrage absenden'}</button></div></form></Card> : null}{data.tickets.length ? <Card className="opc-cp-table-card"><div className="opc-cp-table-head opc-cp-ticket-grid"><span>Anfrage</span><span>Standort</span><span>Erstellt</span><span>Status</span></div>{data.tickets.map((ticket) => { const site = data.sites.find((row) => String(row.id) === String(ticket.site_id)); return <div className="opc-cp-table-row opc-cp-ticket-grid" key={String(ticket.id)}><div className="opc-cp-table-title"><div className="opc-cp-row-icon">{normalize(ticket.category) === 'damage' ? <AlertTriangle size={18} /> : <MessageSquareWarning size={18} />}</div><div><strong>{firstValue(ticket, ['title', 'ticket_title'], 'Kundenanfrage')}</strong><span>{firstValue(ticket, ['ticket_number'])}</span></div></div><div>{site ? siteLabel(site) : '—'}</div><div>{formatDate(firstValue(ticket, ['created_at']))}</div><div><StatusBadge status={ticket.status} /></div></div>; })}</Card> : <EmptyState title="Noch keine Anfragen" description="Neue Anfragen und Schadenmeldungen erscheinen hier mit ihrem Bearbeitungsstatus." />}</>;
}

function FinancePage({ data }: { data: PortalDataset }) {
  return <><PageTitle eyebrow="Kundendokumente" title="Offerten & Rechnungen" description="Ihre Angebote, Auftragsunterlagen und Rechnungen an einem Ort." /><div className="opc-cp-two-column"><Card className="opc-cp-list-card"><div className="opc-cp-section-header"><div><span>Angebote</span><h2>Offerten</h2></div></div>{data.quotes.length ? data.quotes.map((row) => <SimpleListRow key={String(row.id)} href={`/kundenportal/offerte/${row.id}`} icon={<FileText size={18} />} title={documentTitle(row, 'quote')} meta={<><span>{documentNumber(row, 'quote')}</span><span>{formatDate(firstValue(row, ['issue_date', 'created_at']))}</span><strong>{formatMoney(documentTotal(row))}</strong></>} trailing={<><StatusBadge status={row.status} /><ChevronRight size={18} /></>} />) : <div className="opc-cp-card-empty">Noch keine Offerten freigegeben.</div>}</Card><Card className="opc-cp-list-card"><div className="opc-cp-section-header"><div><span>Abrechnung</span><h2>Rechnungen</h2></div></div>{data.invoices.length ? data.invoices.map((row) => <SimpleListRow key={String(row.id)} href={`/kundenportal/rechnung/${row.id}`} icon={<ReceiptText size={18} />} title={documentTitle(row, 'invoice')} meta={<><span>{documentNumber(row, 'invoice')}</span><span>{formatDate(firstValue(row, ['issue_date', 'created_at']))}</span><strong>{formatMoney(documentTotal(row))}</strong></>} trailing={<><StatusBadge status={row.status} /><ChevronRight size={18} /></>} />) : <div className="opc-cp-card-empty">Noch keine Rechnungen freigegeben.</div>}</Card></div></>;
}

function DocumentItems({ items }: { items: AnyRow[] }) {
  return <Card className="opc-cp-document-items"><div className="opc-cp-section-header"><div><span>Leistungsübersicht</span><h2>Positionen</h2></div></div><div className="opc-cp-item-table-head"><span>Leistung</span><span>Menge</span><span>Einzelpreis</span><span>Total</span></div>{items.map((item, index) => <div className="opc-cp-item-row" key={String(item.id || index)}><div><strong>{firstValue(item, ['title'], `Position ${index + 1}`)}</strong>{firstValue(item, ['description']) ? <p>{firstValue(item, ['description'])}</p> : null}</div><div>{formatQuantity(item.quantity)} {firstValue(item, ['unit'])}</div><div>{formatMoney(numberValue(item, ['unit_price_chf']))}</div><div><strong>{formatMoney(numberValue(item, ['total_chf', 'subtotal_chf']))}</strong></div></div>)}</Card>;
}
function TotalsCard({ document, items, invoice = false }: { document: AnyRow; items: AnyRow[]; invoice?: boolean }) {
  const subtotal = numberValue(document, ['subtotal_chf']) || items.reduce((sum, item) => sum + numberValue(item, ['subtotal_chf']), 0);
  const discount = numberValue(document, ['discount_chf']);
  const tax = numberValue(document, ['tax_chf']) || items.reduce((sum, item) => sum + numberValue(item, ['tax_chf']), 0);
  const total = documentTotal(document) || subtotal - discount + tax;
  const paid = numberValue(document, ['paid_chf']);
  const balance = numberValue(document, ['balance_chf']) || Math.max(total - paid, 0);
  return <Card className="opc-cp-totals-card"><div className="opc-cp-key-value"><span>Zwischensumme</span><strong>{formatMoney(subtotal)}</strong></div>{discount ? <div className="opc-cp-key-value"><span>Rabatt</span><strong>- {formatMoney(discount)}</strong></div> : null}<div className="opc-cp-key-value"><span>MwSt. {numberValue(document, ['tax_rate']) || 8.1}%</span><strong>{formatMoney(tax)}</strong></div><div className="opc-cp-total-line"><span>Gesamtbetrag</span><strong>{formatMoney(total)}</strong></div>{invoice ? <><div className="opc-cp-key-value"><span>Bezahlt</span><strong>{formatMoney(paid)}</strong></div><div className="opc-cp-balance-line"><span>Offener Betrag</span><strong>{formatMoney(balance)}</strong></div></> : null}</Card>;
}
function QuoteDetailPage({ identity, detail }: { identity: PortalIdentity; detail: DocumentDetail }) {
  const quote = detail.quote || {}; const items = detail.items || []; const pdf = documentUrl(quote);
  return <><a className="opc-cp-back-link" href={buildUrl('/kundenportal/finanzen')}><ArrowLeft size={17} /> Zurück zu Offerten & Rechnungen</a><PageTitle eyebrow="Offerte" title={documentTitle(quote, 'quote')} description={`${documentNumber(quote, 'quote')} · Erstellt am ${formatDate(firstValue(quote, ['issue_date', 'created_at']))}`} action={<div className="opc-cp-title-actions"><StatusBadge status={quote.status} />{pdf ? <a className="opc-cp-secondary-button" href={pdf} target="_blank" rel="noreferrer"><Download size={16} /> PDF öffnen</a> : null}</div>} /><Card className="opc-cp-document-header"><div><span>Kunde</span><strong>{customerNameFromDocument(quote, identity)}</strong><p>{customerAddressFromDocument(quote) || identity.email}</p></div><div><span>Offertennummer</span><strong>{documentNumber(quote, 'quote')}</strong></div><div><span>Offertendatum</span><strong>{formatDate(firstValue(quote, ['issue_date']))}</strong></div><div><span>Gültig bis</span><strong>{formatDate(firstValue(quote, ['valid_until']))}</strong></div></Card>{firstValue(quote, ['intro_text']) ? <Card className="opc-cp-text-card"><div className="opc-cp-section-header"><div><span>Einleitung</span><h2>Offertentext</h2></div></div><p className="preserve-lines">{firstValue(quote, ['intro_text'])}</p></Card> : null}<div className="opc-cp-document-layout"><DocumentItems items={items} /><TotalsCard document={quote} items={items} /></div>{firstValue(quote, ['scope_text', 'service_description_text']) ? <Card className="opc-cp-text-card"><div className="opc-cp-section-header"><div><span>Leistungsumfang</span><h2>Beschreibung</h2></div></div><p className="preserve-lines">{firstValue(quote, ['service_description_text', 'scope_text'])}</p></Card> : null}{firstValue(quote, ['customer_notes']) ? <Card className="opc-cp-text-card"><div className="opc-cp-section-header"><div><span>Hinweise</span><h2>Weitere Informationen</h2></div></div><p className="preserve-lines">{firstValue(quote, ['customer_notes'])}</p></Card> : null}</>;
}
function InvoiceDetailPage({ identity, detail }: { identity: PortalIdentity; detail: DocumentDetail }) {
  const invoice = detail.invoice || {}; const items = detail.items || []; const pdf = documentUrl(invoice);
  return <><a className="opc-cp-back-link" href={buildUrl('/kundenportal/finanzen')}><ArrowLeft size={17} /> Zurück zu Offerten & Rechnungen</a><PageTitle eyebrow="Rechnung" title={documentTitle(invoice, 'invoice')} description={`${documentNumber(invoice, 'invoice')} · Erstellt am ${formatDate(firstValue(invoice, ['issue_date', 'created_at']))}`} action={<div className="opc-cp-title-actions"><StatusBadge status={invoice.status} />{pdf ? <a className="opc-cp-secondary-button" href={pdf} target="_blank" rel="noreferrer"><Download size={16} /> PDF öffnen</a> : null}</div>} /><Card className="opc-cp-document-header"><div><span>Kunde</span><strong>{customerNameFromDocument(invoice, identity)}</strong><p>{customerAddressFromDocument(invoice) || identity.email}</p></div><div><span>Rechnungsnummer</span><strong>{documentNumber(invoice, 'invoice')}</strong></div><div><span>Rechnungsdatum</span><strong>{formatDate(firstValue(invoice, ['issue_date']))}</strong></div><div><span>Fällig am</span><strong>{formatDate(firstValue(invoice, ['due_date']))}</strong></div></Card>{firstValue(invoice, ['intro_text']) ? <Card className="opc-cp-text-card"><div className="opc-cp-section-header"><div><span>Einleitung</span><h2>Rechnungstext</h2></div></div><p className="preserve-lines">{firstValue(invoice, ['intro_text'])}</p></Card> : null}<div className="opc-cp-document-layout"><DocumentItems items={items} /><TotalsCard document={invoice} items={items} invoice /></div>{firstValue(invoice, ['payment_terms']) ? <Card className="opc-cp-text-card"><div className="opc-cp-section-header"><div><span>Zahlung</span><h2>Zahlungsbedingungen</h2></div></div><p className="preserve-lines">{firstValue(invoice, ['payment_terms'])}</p></Card> : null}</>;
}

function SettingsPage({ identity }: { identity: PortalIdentity }) {
  const [newPassword, setNewPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState(''); const [saving, setSaving] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  async function changePassword(event: FormEvent) { event.preventDefault(); setError(''); setMessage(''); if (newPassword.length < 8) return setError('Das Passwort muss mindestens 8 Zeichen lang sein.'); if (newPassword !== confirmPassword) return setError('Die Passwörter stimmen nicht überein.'); setSaving(true); try { const result = await supabase.auth.updateUser({ password: newPassword }); if (result.error) throw result.error; setNewPassword(''); setConfirmPassword(''); setMessage('Ihr Passwort wurde aktualisiert.'); } catch (err: any) { setError(err?.message || 'Passwort konnte nicht geändert werden.'); } finally { setSaving(false); } }
  return <><PageTitle eyebrow="Konto" title="Einstellungen" description="Ihre persönlichen Zugangsdaten und Kundenportal-Berechtigungen." />{error ? <div className="opc-cp-error">{error}</div> : null}{message ? <div className="opc-cp-success">{message}</div> : null}<div className="opc-cp-two-column"><Card className="opc-cp-detail-card"><div className="opc-cp-card-heading compact"><div><span>Profil</span><h2>Kundenkonto</h2></div><ShieldCheck size={20} /></div><div className="opc-cp-key-value"><span>Name</span><strong>{identity.display_name}</strong></div><div className="opc-cp-key-value"><span>Unternehmen</span><strong>{identity.company_name}</strong></div><div className="opc-cp-key-value"><span>E-Mail</span><strong>{identity.email || '—'}</strong></div><div className="opc-cp-key-value"><span>Telefon</span><strong>{identity.phone || '—'}</strong></div></Card><Card className="opc-cp-detail-card"><div className="opc-cp-card-heading compact"><div><span>Sicherheit</span><h2>Passwort ändern</h2></div><LockKeyhole size={20} /></div><form onSubmit={changePassword} className="opc-cp-password-form"><label><span>Neues Passwort</span><input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><label><span>Passwort bestätigen</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label><button className="opc-cp-primary-button" type="submit" disabled={saving}>{saving ? <Loader2 className="opc-cp-spin" size={16} /> : <LockKeyhole size={16} />}{saving ? 'Wird gespeichert…' : 'Passwort speichern'}</button></form></Card></div></>;
}

function PortalContent({ section, identity, data, detail, documentDetail, onReload }: { section: PortalSection; identity: PortalIdentity; data: PortalDataset; detail?: AnyRow; documentDetail?: DocumentDetail; onReload: () => Promise<void> }) {
  if (section === 'overview') return <OverviewPage identity={identity} data={data} />;
  if (section === 'orders') return <OrdersPage data={data} />;
  if (section === 'order-detail' && detail) return <OrderDetailPage detail={detail} />;
  if (section === 'sites') return <SitesPage data={data} />;
  if (section === 'documents') return <DocumentsPage data={data} />;
  if (section === 'requests') return <RequestsPage identity={identity} data={data} onReload={onReload} />;
  if (section === 'finance') return <FinancePage data={data} />;
  if (section === 'quote-detail' && documentDetail) return <QuoteDetailPage identity={identity} detail={documentDetail} />;
  if (section === 'invoice-detail' && documentDetail) return <InvoiceDetailPage identity={identity} detail={documentDetail} />;
  if (section === 'settings') return <SettingsPage identity={identity} />;
  return <EmptyState title="Bereich nicht verfügbar" description="Die gewünschte Kundenportalseite konnte nicht geöffnet werden." />;
}

export default function OpcClientPortalAppV2({ section, itemId }: { section: PortalSection; itemId?: string }) {
  const [profile, setProfile] = useState<UserProfile | null>(null); const [identity, setIdentity] = useState<PortalIdentity | null>(null); const [data, setData] = useState<PortalDataset>(emptyDataset); const [detail, setDetail] = useState<AnyRow>(); const [documentDetail, setDocumentDetail] = useState<DocumentDetail>(); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem('opc_client_sidebar_collapsed') === 'true'); const [mobileOpen, setMobileOpen] = useState(false);
  async function authenticatedFetch(path: string) { const { data: sessionData } = await supabase.auth.getSession(); const token = sessionData.session?.access_token; if (!token) throw new Error('Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.'); const response = await fetch(buildUrl(path), { method: 'GET', cache: 'no-store', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }); const result = await response.json().catch(() => null) as PortalResponse | null; if (!response.ok || !result?.ok || !result.portal) throw new Error(result?.error || 'Kundenportal konnte nicht geladen werden.'); return result; }
  async function loadPortal() { setError(''); setLoading(true); try { const nextProfile = await loadOpcAuthProfile(); if (!nextProfile) { rememberOpcAuthReturnTarget(); safeNavigate(buildUrl('/'), { replace: true }); return; } if (!['client', 'kunde'].includes(normalize(nextProfile.role))) { safeNavigate(buildUrl('/dashboard'), { replace: true }); return; } setProfile(nextProfile); if (section === 'quote-detail' && itemId) { const result = await authenticatedFetch(`/api/opc/client-portal/quote/${encodeURIComponent(itemId)}`); setIdentity(result.portal || null); setDocumentDetail(result.detail as DocumentDetail); return; } if (section === 'invoice-detail' && itemId) { const result = await authenticatedFetch(`/api/opc/client-portal/invoice/${encodeURIComponent(itemId)}`); setIdentity(result.portal || null); setDocumentDetail(result.detail as DocumentDetail); return; } if (section === 'order-detail' && itemId) { const result = await authenticatedFetch(`/api/opc/client-portal?job_id=${encodeURIComponent(itemId)}`); setIdentity(result.portal || null); setDetail(result.detail); return; } const result = await authenticatedFetch('/api/opc/client-portal/data'); setIdentity(result.portal || null); setData(result.data || emptyDataset); } catch (err: any) { setError(err?.message || 'Kundenportal konnte nicht geladen werden.'); } finally { setLoading(false); } }
  useEffect(() => { void loadPortal(); }, [section, itemId]);
  useEffect(() => { document.documentElement.style.setProperty('--opc-client-sidebar-width', collapsed ? '72px' : '260px'); window.localStorage.setItem('opc_client_sidebar_collapsed', String(collapsed)); }, [collapsed]);
  async function logout() { clearOpcAuthReturnTarget(); clearCachedOpcAuthProfile(); try { await supabase.auth.signOut({ scope: 'local' }); } finally { safeNavigate(buildUrl('/'), { replace: true }); } }
  if (loading) return <div className="opc-cp-loading"><Loader2 size={22} className="opc-cp-spin" /><span>Kundenportal wird geladen…</span><PortalStyles /></div>;
  if (error || !identity || !profile) return <div className="opc-cp-loading"><Card className="opc-cp-error-card"><AlertTriangle size={25} color={BRAND.red} /><h1>Kundenportal nicht verfügbar</h1><p>{error || 'Das Kundenkonto konnte nicht geladen werden.'}</p><a className="opc-cp-primary-button" href={buildUrl('/')}>Zur Anmeldung</a></Card><PortalStyles /></div>;
  const sidebarWidth = collapsed ? 72 : 260;
  return <div className="opc-cp-shell"><ClientSidebar section={section} identity={identity} collapsed={collapsed} mobileOpen={mobileOpen} onToggle={() => setCollapsed((value) => !value)} onCloseMobile={() => setMobileOpen(false)} onLogout={() => void logout()} /><header className="opc-cp-mobile-header"><button type="button" onClick={() => setMobileOpen(true)}><Menu size={21} /></button><img src={LOGO_URL} alt="Orange Pro Clean GmbH" /><div className="opc-cp-avatar small">{getInitials(identity.display_name)}</div></header><main className="opc-cp-main" style={{ marginLeft: sidebarWidth }}><div className="opc-cp-content"><PortalContent section={section} identity={identity} data={data} detail={detail} documentDetail={documentDetail} onReload={loadPortal} /></div></main><PortalStyles /></div>;
}

function PortalStyles() {
  return <style>{`
    :root{--opc-client-sidebar-width:260px}html,body{margin:0;min-height:100%;background:#fff;color:${BRAND.text};font-family:${pageFont}}*{box-sizing:border-box}a,button,input,select,textarea{font-family:${pageFont}}.opc-cp-spin{animation:opc-cp-spin .9s linear infinite}@keyframes opc-cp-spin{to{transform:rotate(360deg)}}
    .opc-cp-shell{min-height:100vh;background:#fff}.opc-cp-loading{min-height:100vh;display:flex;gap:10px;align-items:center;justify-content:center;padding:24px;color:${BRAND.muted};font-weight:720;background:#fff}.opc-cp-card{background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:20px;box-shadow:0 1px 2px rgba(15,17,21,.04)}
    .opc-cp-sidebar{position:fixed;inset:0 auto 0 0;height:100vh;background:#fff;border-right:1px solid ${BRAND.border};z-index:100;display:flex;flex-direction:column;padding:20px 12px 16px;transition:width .3s cubic-bezier(.22,1,.36,1),transform .25s ease;overflow:hidden}.opc-cp-sidebar-logo{min-height:90px;display:flex;align-items:center;justify-content:center;padding:4px 8px 18px}.opc-cp-sidebar-logo img{width:190px;max-width:100%;height:auto;display:block}.opc-cp-logo-mark{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:${BRAND.orange};color:#fff;font-size:19px;font-weight:900}.opc-cp-sidebar-caption{min-height:30px;display:flex;align-items:center;justify-content:center;gap:7px;margin:0 4px 10px;color:${BRAND.orange};font-size:11px;font-weight:850;letter-spacing:.02em;white-space:nowrap}.opc-cp-collapse-button{min-height:40px;border:0;background:transparent;color:${BRAND.muted};display:flex;align-items:center;justify-content:flex-start;gap:10px;padding:0 13px;font-size:13px;font-weight:700;border-radius:12px;cursor:pointer;margin-bottom:7px}.opc-cp-collapse-button:hover{background:${BRAND.soft};color:${BRAND.text}}.opc-cp-nav{display:flex;flex-direction:column;gap:4px;overflow-y:auto;flex:1}.opc-cp-nav a{min-height:42px;display:flex;align-items:center;gap:12px;padding:0 13px;border-radius:12px;text-decoration:none;color:${BRAND.muted};font-size:14px;font-weight:560;white-space:nowrap;transition:background .16s ease,color .16s ease}.opc-cp-nav a:hover{background:${BRAND.soft};color:${BRAND.text}}.opc-cp-nav a.active{background:#f2f2f2;color:${BRAND.text};font-weight:720}.opc-cp-sidebar.is-collapsed .opc-cp-nav a,.opc-cp-sidebar.is-collapsed .opc-cp-collapse-button{justify-content:center;padding:0}.opc-cp-sidebar-profile{display:flex;align-items:center;gap:10px;padding:14px 3px 0;border-top:1px solid ${BRAND.border}}.opc-cp-sidebar-profile button{width:36px;height:36px;border:0;border-radius:11px;background:transparent;color:${BRAND.muted};cursor:pointer;display:grid;place-items:center}.opc-cp-sidebar-profile button:hover{background:${BRAND.soft};color:${BRAND.text}}.opc-cp-avatar{width:40px;height:40px;border-radius:50%;background:${BRAND.black};color:#fff;display:grid;place-items:center;font-size:12px;font-weight:850;flex-shrink:0}.opc-cp-avatar.small{width:34px;height:34px;font-size:11px}.opc-cp-profile-copy{flex:1;min-width:0}.opc-cp-profile-copy div{font-size:13px;font-weight:760;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.opc-cp-profile-copy span{display:block;margin-top:2px;color:${BRAND.muted};font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .opc-cp-main{min-height:100vh;padding:32px 38px 110px;transition:margin-left .3s cubic-bezier(.22,1,.36,1);background:#fff}.opc-cp-content{width:100%;max-width:1440px;margin:0 auto}.opc-cp-mobile-header{display:none}.opc-cp-page-title{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:22px}.opc-cp-page-title h1{margin:0;font-size:30px;line-height:1.08;letter-spacing:-.04em;font-weight:850}.opc-cp-page-title p{margin:9px 0 0;color:${BRAND.muted};font-size:14px;line-height:1.55;max-width:760px}.opc-cp-eyebrow{color:${BRAND.orange};font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}.opc-cp-page-action,.opc-cp-title-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.opc-cp-primary-button,.opc-cp-secondary-button{min-height:46px;padding:0 16px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;font-size:14px;font-weight:760;cursor:pointer;white-space:nowrap}.opc-cp-primary-button{border:1px solid ${BRAND.black};background:${BRAND.black};color:#fff}.opc-cp-secondary-button{border:1px solid ${BRAND.border};background:#fff;color:${BRAND.text}}.opc-cp-primary-button:disabled{opacity:.55;cursor:wait}.opc-cp-status{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border:1px solid;border-radius:999px;font-size:12px;font-weight:780;white-space:nowrap}
    .opc-cp-metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:16px}.opc-cp-metric-card{min-height:112px;padding:20px;display:flex;align-items:center;justify-content:space-between;gap:16px}.opc-cp-metric-card strong{display:block;font-size:27px;line-height:1;font-weight:830;letter-spacing:-.04em;margin-bottom:12px}.opc-cp-metric-card span{color:${BRAND.muted};font-size:13px;font-weight:700}.opc-cp-metric-icon,.opc-cp-heading-icon{width:38px;height:38px;border-radius:13px;border:1px solid ${BRAND.border};background:${BRAND.soft};display:grid;place-items:center;color:${BRAND.black};flex-shrink:0}.opc-cp-dashboard-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(320px,.7fr);gap:16px;margin-bottom:16px}.opc-cp-feature-card,.opc-cp-quick-card,.opc-cp-detail-card,.opc-cp-site-card,.opc-cp-text-card,.opc-cp-form-card{padding:22px}.opc-cp-feature-actions{margin-top:20px}.opc-cp-card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:18px}.opc-cp-card-heading.compact{margin-bottom:16px}.opc-cp-card-heading span,.opc-cp-section-header span{color:${BRAND.muted};font-size:11px;font-weight:820;text-transform:uppercase;letter-spacing:.06em}.opc-cp-card-heading h2,.opc-cp-section-header h2{margin:6px 0 0;font-size:18px;line-height:1.25;font-weight:820;letter-spacing:-.025em}.opc-cp-detail-line{display:flex;align-items:flex-start;gap:9px;color:${BRAND.muted};font-size:13px;line-height:1.5;margin-top:10px}.opc-cp-detail-line svg{flex-shrink:0;margin-top:1px}.opc-cp-muted{color:${BRAND.muted};font-size:13px;line-height:1.6;margin:8px 0 0}.opc-cp-quick-links{display:grid;gap:8px}.opc-cp-quick-links a{min-height:48px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:0 12px;border:1px solid ${BRAND.border};border-radius:14px;color:${BRAND.text};text-decoration:none;font-size:13px;font-weight:700}.opc-cp-quick-links a:hover{background:${BRAND.soft}}
    .opc-cp-two-column{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.opc-cp-list-card{overflow:hidden}.opc-cp-section-header{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid ${BRAND.border}}.opc-cp-section-header .opc-cp-secondary-button{min-height:38px;padding:0 12px;font-size:12px}.opc-cp-list-row{min-height:76px;display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid ${BRAND.border};color:${BRAND.text};text-decoration:none}.opc-cp-list-row:last-child{border-bottom:0}.opc-cp-list-row.is-link:hover{background:${BRAND.soft}}.opc-cp-row-icon{width:40px;height:40px;border-radius:12px;background:${BRAND.soft};display:grid;place-items:center;color:${BRAND.text};flex-shrink:0}.opc-cp-row-copy{flex:1;min-width:0}.opc-cp-row-copy strong{display:block;font-size:14px;font-weight:780;line-height:1.35}.opc-cp-row-copy>div{display:flex;align-items:center;gap:8px 12px;flex-wrap:wrap;margin-top:5px;color:${BRAND.muted};font-size:11px}.opc-cp-row-copy>div strong{color:${BRAND.text};font-size:12px}.opc-cp-row-trailing{display:flex;align-items:center;gap:8px;color:${BRAND.muted}}.opc-cp-card-empty{padding:24px 20px;color:${BRAND.muted};font-size:13px}
    .opc-cp-table-card{overflow:hidden}.opc-cp-table-head,.opc-cp-table-row{display:grid;align-items:center;gap:18px}.opc-cp-table-head{min-height:46px;padding:0 20px;background:${BRAND.soft};border-bottom:1px solid ${BRAND.border};color:${BRAND.muted};font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.opc-cp-table-row{min-height:88px;padding:14px 20px;border-bottom:1px solid ${BRAND.border};color:${BRAND.muted};font-size:13px;line-height:1.45;text-decoration:none}.opc-cp-table-row:last-child{border-bottom:0}a.opc-cp-table-row:hover{background:${BRAND.soft}}.opc-cp-orders-grid{grid-template-columns:minmax(260px,1.5fr) minmax(170px,.8fr) minmax(240px,1.2fr) minmax(120px,.55fr) 24px}.opc-cp-ticket-grid{grid-template-columns:minmax(280px,1.4fr) minmax(190px,.8fr) minmax(120px,.55fr) minmax(130px,.55fr)}.opc-cp-table-title{display:flex;align-items:center;gap:12px;min-width:0}.opc-cp-table-title strong{display:block;color:${BRAND.text};font-size:14px;font-weight:780}.opc-cp-table-title span{display:block;margin-top:4px;color:${BRAND.muted};font-size:11px}.opc-cp-row-arrow{display:grid;place-items:center}.opc-cp-back-link{display:inline-flex;align-items:center;gap:7px;margin-bottom:18px;color:${BRAND.muted};font-size:13px;font-weight:700;text-decoration:none}.opc-cp-key-value{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:13px 0;border-bottom:1px solid ${BRAND.border};font-size:13px}.opc-cp-key-value:last-child{border-bottom:0}.opc-cp-key-value span{color:${BRAND.muted}}.opc-cp-key-value strong{text-align:right}.opc-cp-text-card{margin-top:16px}.opc-cp-text-card .opc-cp-section-header{min-height:auto;padding:0 0 16px}.opc-cp-text-card p{margin:0;color:#374151;font-size:13px;line-height:1.7}.preserve-lines{white-space:pre-line}.opc-cp-detail-reports{margin-top:16px}.opc-cp-site-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
    .opc-cp-form-card{margin-bottom:16px}.opc-cp-request-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.opc-cp-request-form label,.opc-cp-password-form label{display:grid;gap:7px;color:${BRAND.text};font-size:12px;font-weight:760}.opc-cp-request-form .wide{grid-column:1/-1}.opc-cp-request-form input,.opc-cp-request-form select,.opc-cp-request-form textarea,.opc-cp-password-form input{width:100%;border:1px solid ${BRAND.border};border-radius:14px;background:#fff;color:${BRAND.text};font-size:14px;outline:none}.opc-cp-request-form input,.opc-cp-request-form select,.opc-cp-password-form input{height:48px;padding:0 13px}.opc-cp-request-form textarea{min-height:130px;padding:13px;resize:vertical}.opc-cp-form-actions{display:flex;justify-content:flex-end}.opc-cp-error,.opc-cp-success{margin-bottom:16px;padding:13px 15px;border-radius:14px;font-size:13px;font-weight:700}.opc-cp-error{border:1px solid #fca5a5;background:${BRAND.redBg};color:${BRAND.red}}.opc-cp-success{border:1px solid #bbf7d0;background:${BRAND.greenBg};color:${BRAND.green}}.opc-cp-icon-button{width:38px;height:38px;border:1px solid ${BRAND.border};border-radius:11px;display:grid;place-items:center;color:${BRAND.text};text-decoration:none;flex-shrink:0}.opc-cp-empty{min-height:110px;display:flex;align-items:center;gap:14px;padding:24px}.opc-cp-empty-icon{width:42px;height:42px;border-radius:13px;background:${BRAND.soft};display:grid;place-items:center}.opc-cp-empty strong{font-size:15px}.opc-cp-empty p{margin:6px 0 0;color:${BRAND.muted};font-size:13px}.opc-cp-password-form{display:grid;gap:14px}.opc-cp-password-form .opc-cp-primary-button{justify-self:start}
    .opc-cp-document-header{display:grid;grid-template-columns:minmax(280px,1.5fr) repeat(3,minmax(150px,.65fr));gap:20px;padding:22px;margin-bottom:16px}.opc-cp-document-header>div{padding-right:18px;border-right:1px solid ${BRAND.border}}.opc-cp-document-header>div:last-child{border-right:0}.opc-cp-document-header span{display:block;color:${BRAND.muted};font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:7px}.opc-cp-document-header strong{display:block;font-size:14px;font-weight:780}.opc-cp-document-header p{margin:5px 0 0;color:${BRAND.muted};font-size:12px;line-height:1.45}.opc-cp-document-layout{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(280px,.65fr);gap:16px;align-items:start;margin-top:16px}.opc-cp-document-items{overflow:hidden}.opc-cp-document-items .opc-cp-section-header{border-bottom:1px solid ${BRAND.border}}.opc-cp-item-table-head,.opc-cp-item-row{display:grid;grid-template-columns:minmax(260px,1.6fr) 110px 130px 130px;gap:14px;align-items:center}.opc-cp-item-table-head{min-height:42px;padding:0 20px;background:${BRAND.soft};color:${BRAND.muted};font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.opc-cp-item-row{min-height:78px;padding:14px 20px;border-top:1px solid ${BRAND.border};color:${BRAND.muted};font-size:13px}.opc-cp-item-row strong{color:${BRAND.text};font-size:13px;font-weight:760}.opc-cp-item-row p{margin:5px 0 0;color:${BRAND.muted};font-size:12px;line-height:1.5}.opc-cp-totals-card{padding:20px;position:sticky;top:24px}.opc-cp-total-line,.opc-cp-balance-line{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:10px;padding-top:16px;border-top:1px solid ${BRAND.borderStrong}}.opc-cp-total-line strong{font-size:20px;letter-spacing:-.03em}.opc-cp-balance-line{color:${BRAND.orange};font-size:14px;font-weight:800}.opc-cp-error-card{max-width:520px;padding:28px;text-align:center}.opc-cp-error-card h1{font-size:22px;margin:12px 0 8px}.opc-cp-error-card p{color:${BRAND.muted};font-size:13px;line-height:1.6}.opc-cp-mobile-backdrop{display:none}
    @media(max-width:1180px){.opc-cp-metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.opc-cp-dashboard-grid{grid-template-columns:1fr}.opc-cp-orders-grid{grid-template-columns:minmax(240px,1.3fr) minmax(160px,.8fr) minmax(220px,1fr) minmax(110px,.5fr) 24px}.opc-cp-document-header{grid-template-columns:repeat(2,minmax(0,1fr))}.opc-cp-document-header>div{border-right:0;border-bottom:1px solid ${BRAND.border};padding-bottom:14px}}
    @media(max-width:920px){.opc-cp-sidebar{width:260px!important;transform:translateX(-105%);box-shadow:20px 0 50px rgba(15,17,21,.12)}.opc-cp-sidebar.is-mobile-open{transform:translateX(0)}.opc-cp-mobile-backdrop{display:block;position:fixed;inset:0;border:0;background:rgba(15,17,21,.32);z-index:90}.opc-cp-mobile-header{height:72px;padding:0 18px;border-bottom:1px solid ${BRAND.border};display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:#fff;z-index:80}.opc-cp-mobile-header button{width:38px;height:38px;border:1px solid ${BRAND.border};background:#fff;border-radius:11px;display:grid;place-items:center}.opc-cp-mobile-header img{width:154px}.opc-cp-main{margin-left:0!important;padding:24px 20px 110px}.opc-cp-two-column,.opc-cp-site-grid,.opc-cp-document-layout{grid-template-columns:1fr}.opc-cp-totals-card{position:static}.opc-cp-table-head{display:none}.opc-cp-table-row,.opc-cp-orders-grid,.opc-cp-ticket-grid{grid-template-columns:1fr!important;gap:10px}.opc-cp-table-row{padding:18px}.opc-cp-row-arrow{display:none}.opc-cp-request-form{grid-template-columns:1fr}.opc-cp-request-form .wide{grid-column:auto}.opc-cp-item-table-head{display:none}.opc-cp-item-row{grid-template-columns:1fr 1fr}.opc-cp-item-row>div:first-child{grid-column:1/-1}}
    @media(max-width:640px){.opc-cp-main{padding:20px 14px 110px}.opc-cp-page-title{flex-direction:column}.opc-cp-page-title h1{font-size:27px}.opc-cp-page-action,.opc-cp-page-action>*,.opc-cp-title-actions{width:100%}.opc-cp-title-actions .opc-cp-status{width:auto}.opc-cp-metric-grid{grid-template-columns:1fr;gap:10px}.opc-cp-document-header{grid-template-columns:1fr}.opc-cp-document-header>div{border-bottom:1px solid ${BRAND.border}}.opc-cp-item-row{grid-template-columns:1fr}.opc-cp-item-row>div:first-child{grid-column:auto}.opc-cp-list-row{align-items:flex-start}.opc-cp-row-trailing{flex-direction:column;align-items:flex-end}}
  `}</style>;
}
