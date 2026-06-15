import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import MirakaDashboardShell from './MirakaDashboardShell';
import { OPCPageShell, opcResponsiveStyle } from './opc/OPCPageTop';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileText,
  Plus,
  Search,
  Send,
  UserRound,
  WalletCards,
} from 'lucide-react';

type InvoiceRow = {
  id: string;
  invoice_number?: string | null;
  client_id?: string | null;
  client_site_id?: string | null;
  quote_id?: string | null;
  status?: string | null;
  title?: string | null;
  invoice_type?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  total_chf?: number | string | null;
  balance_chf?: number | string | null;
  paid_chf?: number | string | null;
  created_at?: string | null;
  client_snapshot?: Record<string, any> | null;
};

type ClientRow = {
  id?: string;
  client_id?: string;
  client_number?: string | null;
  customer_number?: string | null;
  kundennummer?: string | null;
  client_code?: string | null;
  billing_name?: string | null;
  company_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  billing_email?: string | null;
};

type SiteRow = {
  id: string;
  site_name?: string | null;
  address_text?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
};

type StatusFilter = 'all' | 'draft' | 'ready' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  black: '#0F1115',
  card: '#FFFFFF',
  red: '#B91C1C',
  green: '#166534',
  amber: '#92400E',
  blue: '#155E75',
};

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

const statusLabels: Record<string, string> = {
  draft: 'Entwurf',
  ready: 'Bereit',
  sent: 'Gesendet',
  paid: 'Bezahlt',
  partially_paid: 'Teilweise bezahlt',
  overdue: 'Überfällig',
  cancelled: 'Storniert',
  void: 'Ungültig',
};

const cardStyle: CSSProperties = {
  background: BRAND.card,
  border: `1px solid ${BRAND.border}`,
  borderRadius: '20px',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

function normalize(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function formatDate(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatMoney(value: number | string | null | undefined) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(Number.isFinite(amount) ? amount : 0);
}

function getClientKey(client: ClientRow) {
  return client.client_id || client.id || '';
}

function getSnapshotValue(invoice: InvoiceRow, keys: string[]) {
  const snapshot = invoice.client_snapshot || {};

  for (const key of keys) {
    const value = snapshot[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') return String(value);
  }

  return '';
}

function getClientName(client?: ClientRow, invoice?: InvoiceRow) {
  if (client) {
    return client.billing_name || client.company_name || client.full_name || client.email || client.billing_email || 'Unbekannter Kunde';
  }

  if (invoice) {
    return getSnapshotValue(invoice, ['billing_name', 'company_name', 'full_name', 'name', 'email']) || 'Unbekannter Kunde';
  }

  return 'Unbekannter Kunde';
}

function getClientNumber(client?: ClientRow, fallbackClientId?: string | null) {
  if (client?.client_number) return client.client_number;
  if (client?.customer_number) return client.customer_number;
  if (client?.kundennummer) return client.kundennummer;
  if (client?.client_code) return client.client_code;

  const id = fallbackClientId || client?.client_id || client?.id || '';
  if (!id) return 'Ohne Kundennummer';

  return `Kunde ${id.slice(0, 8).toUpperCase()}`;
}

function getSiteName(site?: SiteRow) {
  if (!site) return 'Kein Standort verknüpft';

  const address = site.address_text || site.address || '';
  const cityLine = [site.postal_code, site.city].filter(Boolean).join(' ');

  return [site.site_name, address, cityLine, site.country].filter(Boolean).join(' · ') || 'Standort';
}

function getStatusLabel(status?: string | null) {
  const key = normalize(status);
  return statusLabels[key] || key || 'Unbekannt';
}

function getStatusTone(status?: string | null) {
  const key = normalize(status);

  if (key === 'paid') {
    return { bg: '#F3F4F6', text: BRAND.text, border: BRAND.border };
  }

  if (['sent', 'partially_paid', 'ready'].includes(key)) {
    return { bg: '#ECFEFF', text: BRAND.blue, border: '#A5F3FC' };
  }

  if (['draft'].includes(key)) {
    return { bg: '#FFFBEB', text: BRAND.amber, border: '#FDE68A' };
  }

  if (['overdue', 'cancelled', 'void'].includes(key)) {
    return { bg: '#FEF2F2', text: BRAND.red, border: '#FECACA' };
  }

  return { bg: '#F9FAFB', text: BRAND.muted, border: BRAND.border };
}

function StatusBadge({ status }: { status?: string | null }) {
  const tone = getStatusTone(status);

  return (
    <span className="opc-invoices-status-badge" style={{ background: tone.bg, color: tone.text, borderColor: tone.border }}>
      {getStatusLabel(status)}
    </span>
  );
}

function MetricCard({
  value,
  label,
  icon,
  tone = 'neutral',
}: {
  value: string | number;
  label: string;
  icon: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'dark';
}) {
  const valueColor =
    tone === 'success'
      ? BRAND.green
      : tone === 'warning'
        ? BRAND.amber
        : tone === 'danger'
          ? BRAND.red
          : tone === 'dark'
            ? BRAND.black
            : BRAND.text;

  return (
    <div className="opc-invoices-metric-card" style={cardStyle}>
      <div style={{ minWidth: 0 }}>
        <div className="opc-invoices-metric-value" style={{ color: valueColor }}>
          {value}
        </div>
        <div className="opc-invoices-metric-label">{label}</div>
      </div>
      <div className="opc-invoices-metric-icon">{icon}</div>
    </div>
  );
}

function InvoiceCard({ invoice, client, site }: { invoice: InvoiceRow; client?: ClientRow; site?: SiteRow }) {
  const clientName = getClientName(client, invoice);
  const clientNumber = getClientNumber(client, invoice.client_id);
  const siteName = getSiteName(site);
  const total = formatMoney(invoice.total_chf);
  const balance = formatMoney(invoice.balance_chf);
  const issueDate = formatDate(invoice.issue_date || invoice.created_at);
  const dueDate = invoice.due_date ? formatDate(invoice.due_date) : '';

  return (
    <article className="opc-invoice-card" style={cardStyle}>
      <a href={`${baseUrl}/rechnung/${invoice.id}`} className="opc-invoice-card-link" data-astro-prefetch="false">
        <div className="opc-invoice-card-main">
          <div style={{ minWidth: 0 }}>
            <div className="opc-invoice-client-number">{clientNumber}</div>
            <h3>{invoice.title || invoice.invoice_number || 'Rechnung'}</h3>
            <div className="opc-invoice-meta">
              <span>
                <FileText size={14} />
                {invoice.invoice_number || 'Ohne Nummer'}
              </span>
              <span>
                <Building2 size={14} />
                {clientName}
              </span>
              <span>{siteName}</span>
              <span>
                <CalendarDays size={14} />
                {issueDate}{dueDate ? ` · fällig bis ${dueDate}` : ''}
              </span>
            </div>
          </div>

          <div className="opc-invoice-card-side">
            <StatusBadge status={invoice.status} />
            <strong>{total}</strong>
            <span>Offen: {balance}</span>
          </div>
        </div>
      </a>
    </article>
  );
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [clientMap, setClientMap] = useState<Map<string, ClientRow>>(new Map());
  const [siteMap, setSiteMap] = useState<Map<string, SiteRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const didLoadRef = useRef(false);

  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    void loadInvoices();
  }, []);

  async function loadInvoices() {
    setLoading(true);
    setErrorMessage('');

    try {
      if (!supabase) throw new Error('Supabase ist nicht verfügbar.');

      const { data, error } = await supabase
        .from('opc_invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(250);

      if (error) throw error;

      const rows = (data || []) as InvoiceRow[];
      setInvoices(rows);

      const clientIds = Array.from(new Set(rows.map((row) => row.client_id).filter(Boolean))) as string[];
      const siteIds = Array.from(new Set(rows.map((row) => row.client_site_id).filter(Boolean))) as string[];

      let clientRows: ClientRow[] = [];
      let siteRows: SiteRow[] = [];

      if (clientIds.length) {
        const overviewResponse = await supabase
          .from('opc_client_overview')
          .select('*')
          .in('client_id', clientIds);

        if (!overviewResponse.error && Array.isArray(overviewResponse.data)) {
          clientRows = overviewResponse.data as ClientRow[];
        } else {
          const fallbackResponse = await supabase
            .from('opc_clients')
            .select('*')
            .in('id', clientIds);

          if (!fallbackResponse.error && Array.isArray(fallbackResponse.data)) {
            clientRows = fallbackResponse.data as ClientRow[];
          }
        }
      }

      if (siteIds.length) {
        const sitesResponse = await supabase
          .from('opc_client_sites')
          .select('*')
          .in('id', siteIds);

        if (!sitesResponse.error && Array.isArray(sitesResponse.data)) {
          siteRows = sitesResponse.data as SiteRow[];
        }
      }

      setClientMap(
        new Map(
          clientRows
            .map((client) => [getClientKey(client), client] as [string, ClientRow])
            .filter(([key]) => Boolean(key)),
        ),
      );

      setSiteMap(
        new Map(
          siteRows
            .map((site) => [site.id, site] as [string, SiteRow])
            .filter(([key]) => Boolean(key)),
        ),
      );
    } catch (error: any) {
      setErrorMessage(error?.message || 'Rechnungen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  const filteredInvoices = useMemo(() => {
    const query = normalize(searchQuery);

    return invoices.filter((invoice) => {
      const client = invoice.client_id ? clientMap.get(invoice.client_id) : undefined;
      const site = invoice.client_site_id ? siteMap.get(invoice.client_site_id) : undefined;
      const matchesStatus = statusFilter === 'all' || normalize(invoice.status) === statusFilter;
      const haystack = normalize([
        invoice.invoice_number,
        invoice.title,
        invoice.invoice_type,
        getClientNumber(client, invoice.client_id),
        getClientName(client, invoice),
        getSiteName(site),
      ].join(' '));

      return matchesStatus && (!query || haystack.includes(query));
    });
  }, [invoices, clientMap, siteMap, searchQuery, statusFilter]);

  const sentCount = useMemo(() => invoices.filter((invoice) => normalize(invoice.status) === 'sent').length, [invoices]);
  const paidCount = useMemo(() => invoices.filter((invoice) => normalize(invoice.status) === 'paid').length, [invoices]);
  const overdueCount = useMemo(() => invoices.filter((invoice) => normalize(invoice.status) === 'overdue').length, [invoices]);
  const openBalance = useMemo(() => invoices.reduce((sum, invoice) => sum + Number(invoice.balance_chf || 0), 0), [invoices]);

  return (
    <MirakaDashboardShell requiredRole={['owner', 'admin', 'dispatch']} currentPath="/rechnung" fullWidth hideTopBar>
      <OPCPageShell>
        <div className="opc-invoices-page" style={{ fontFamily: pageFont }}>
          <div className="opc-invoices-metrics">
            <MetricCard value={invoices.length} label="Rechnungen" icon={<FileText size={18} />} tone="dark" />
            <MetricCard value={sentCount} label="Gesendet" icon={<Send size={18} />} />
            <MetricCard value={paidCount} label="Bezahlt" icon={<CheckCircle2 size={18} />} tone="success" />
            <MetricCard value={overdueCount} label="Überfällig" icon={<AlertTriangle size={18} />} tone={overdueCount > 0 ? 'danger' : 'neutral'} />
          </div>

          <section className="opc-invoices-filter-panel" style={cardStyle}>
            <div className="opc-invoices-filter-actions">
              <a href={`${baseUrl}/kunden`} className="opc-filter-button light" data-astro-prefetch="false">
                <UserRound size={16} />
                Kunde auswählen
              </a>

              <a href={`${baseUrl}/rechnung/neu`} className="opc-filter-button dark" data-astro-prefetch="false">
                <Plus size={16} />
                Neue Rechnung
              </a>
            </div>

            <div className="opc-invoices-search-row">
              <div className="opc-invoices-search">
                <Search size={17} />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Rechnung, Kunde, Kundennummer, Adresse suchen"
                />
              </div>

              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Alle Status</option>
                <option value="draft">Entwurf</option>
                <option value="ready">Bereit</option>
                <option value="sent">Gesendet</option>
                <option value="paid">Bezahlt</option>
                <option value="partially_paid">Teilweise bezahlt</option>
                <option value="overdue">Überfällig</option>
                <option value="cancelled">Storniert</option>
              </select>
            </div>

            <div className="opc-invoices-balance-hint">
              <WalletCards size={15} />
              Offener Betrag: <strong>{formatMoney(openBalance)}</strong>
            </div>
          </section>

          {errorMessage ? <div className="opc-invoices-error">{errorMessage}</div> : null}

          {loading ? (
            <div className="opc-invoices-empty" style={cardStyle}>Rechnungen werden geladen.</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="opc-invoices-empty" style={cardStyle}>Keine Rechnungen gefunden.</div>
          ) : (
            <div className="opc-invoices-list">
              {filteredInvoices.map((invoice) => {
                const client = invoice.client_id ? clientMap.get(invoice.client_id) : undefined;
                const site = invoice.client_site_id ? siteMap.get(invoice.client_site_id) : undefined;

                return <InvoiceCard key={invoice.id} invoice={invoice} client={client} site={site} />;
              })}
            </div>
          )}
        </div>

        <style>{`
          ${opcResponsiveStyle}

          .opc-invoices-page {
            padding: 0 0 140px;
            color: ${BRAND.text};
          }

          .opc-invoices-page * {
            box-sizing: border-box;
          }

          .opc-invoices-metrics {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 14px;
          }

          .opc-invoices-metric-card {
            min-height: 96px;
            padding: 18px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
          }

          .opc-invoices-metric-value {
            font-size: 25px;
            line-height: 1;
            font-weight: 820;
            letter-spacing: -0.04em;
            margin-bottom: 10px;
          }

          .opc-invoices-metric-label {
            font-size: 13px;
            font-weight: 720;
            color: ${BRAND.muted};
          }

          .opc-invoices-metric-icon {
            width: 38px;
            height: 38px;
            border-radius: 13px;
            border: 1px solid ${BRAND.border};
            background: #FAFAFA;
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${BRAND.black};
            flex-shrink: 0;
          }

          .opc-invoices-filter-panel {
            width: 100%;
            max-width: 100%;
            min-width: 0;
            padding: 16px;
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
            margin-bottom: 18px;
            overflow: visible;
          }

          .opc-invoices-filter-actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }

          .opc-filter-button {
            min-height: 46px;
            border-radius: 14px;
            border: 1px solid ${BRAND.border};
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 0 12px;
            color: ${BRAND.text};
            font-size: 13px;
            font-weight: 820;
            font-family: ${pageFont};
            text-decoration: none;
            white-space: nowrap;
          }

          .opc-filter-button.light {
            background: #FFFFFF;
          }

          .opc-filter-button.dark {
            background: ${BRAND.black};
            border-color: ${BRAND.black};
            color: #FFFFFF;
          }

          .opc-invoices-search-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 220px);
            gap: 8px;
            align-items: stretch;
          }

          .opc-invoices-search {
            min-width: 0;
            height: 46px;
            border: 1px solid ${BRAND.border};
            border-radius: 14px;
            background: #FFFFFF;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 0 12px;
            color: ${BRAND.muted};
          }

          .opc-invoices-search input {
            width: 100%;
            min-width: 0;
            border: 0;
            outline: 0;
            color: ${BRAND.text};
            font-size: 14px;
            font-weight: 650;
            font-family: ${pageFont};
          }

          .opc-invoices-search-row select {
            width: 100%;
            min-width: 0;
            height: 46px;
            border: 1px solid ${BRAND.border};
            border-radius: 14px;
            background: #FFFFFF;
            color: ${BRAND.text};
            padding: 0 12px;
            font-size: 13px;
            font-weight: 760;
            font-family: ${pageFont};
            outline: 0;
          }

          .opc-invoices-balance-hint {
            min-height: 42px;
            border-radius: 14px;
            border: 1px solid #F3F4F6;
            background: #FAFAFA;
            color: ${BRAND.muted};
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 0 12px;
            font-size: 13px;
            font-weight: 720;
          }

          .opc-invoices-balance-hint strong {
            color: ${BRAND.text};
            font-weight: 840;
          }

          .opc-invoices-error {
            border: 1px solid #FECACA;
            background: #FEF2F2;
            color: ${BRAND.red};
            padding: 14px 16px;
            border-radius: 16px;
            font-size: 13px;
            font-weight: 720;
            margin-bottom: 14px;
          }

          .opc-invoices-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .opc-invoice-card {
            padding: 0;
            overflow: hidden;
          }

          .opc-invoice-card-link {
            display: block;
            color: ${BRAND.text};
            text-decoration: none;
            padding: 18px;
          }

          .opc-invoice-card-main {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 18px;
            align-items: start;
          }

          .opc-invoice-client-number {
            margin-bottom: 6px;
            color: ${BRAND.muted};
            font-size: 12px;
            line-height: 1.2;
            font-weight: 820;
            text-transform: uppercase;
            letter-spacing: 0.02em;
          }

          .opc-invoice-card h3 {
            margin: 0;
            color: ${BRAND.text};
            font-size: 20px;
            line-height: 1.18;
            letter-spacing: -0.04em;
            font-weight: 860;
          }

          .opc-invoice-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 8px 14px;
            margin-top: 9px;
            color: ${BRAND.muted};
            font-size: 13px;
            line-height: 1.35;
            font-weight: 650;
          }

          .opc-invoice-meta span {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            max-width: 100%;
            min-width: 0;
            overflow-wrap: anywhere;
          }

          .opc-invoice-card-side {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 8px;
          }

          .opc-invoice-card-side strong {
            color: ${BRAND.text};
            font-size: 13px;
            font-weight: 840;
            white-space: nowrap;
          }

          .opc-invoice-card-side span:last-child {
            color: ${BRAND.muted};
            font-size: 12px;
            font-weight: 720;
            white-space: nowrap;
          }

          .opc-invoices-status-badge {
            min-height: 30px;
            min-width: 132px;
            padding: 0 12px;
            border-radius: 999px;
            border: 1px solid;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 780;
            white-space: nowrap;
          }

          .opc-invoices-empty {
            min-height: 120px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${BRAND.muted};
            font-size: 14px;
            font-weight: 650;
            text-align: center;
            padding: 22px;
          }

          @media (max-width: 760px) {
            .opc-invoices-page {
              padding-bottom: 110px;
            }

            .opc-invoices-metrics {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 10px;
            }

            .opc-invoices-metric-card {
              min-height: 86px;
              padding: 15px;
            }

            .opc-invoices-metric-value {
              font-size: 23px;
            }

            .opc-invoices-search-row {
              grid-template-columns: 1fr;
            }

            .opc-invoices-filter-actions {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .opc-filter-button {
              min-height: 46px;
              font-size: 12px;
              padding: 0 8px;
            }

            .opc-invoice-card-main {
              grid-template-columns: 1fr;
            }

            .opc-invoice-card-side {
              align-items: flex-start;
            }

            .opc-invoice-card-link {
              padding: 15px;
            }

            .opc-invoice-card h3 {
              font-size: 18px;
            }
          }
        `}</style>
      </OPCPageShell>
    </MirakaDashboardShell>
  );
}
