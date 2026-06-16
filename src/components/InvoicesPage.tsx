import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import MirakaDashboardShell from './MirakaDashboardShell';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
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

type StatusFilter =
  | 'all'
  | 'open'
  | 'draft'
  | 'ready'
  | 'sent'
  | 'paid'
  | 'partially_paid'
  | 'overdue'
  | 'cancelled';

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  black: '#0F1115',
  card: '#FFFFFF',
  soft: '#FAFAFA',
  red: '#B91C1C',
  green: '#166534',
  amber: '#92400E',
  blue: '#155E75',
};

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

const statusLabels: Record<string, string> = {
  all: 'Alle Status',
  open: 'Offene Rechnungen',
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

function isOpenInvoice(invoice: InvoiceRow) {
  const key = normalize(invoice.status);

  if (['paid', 'cancelled', 'void'].includes(key)) return false;
  if (['draft', 'ready', 'sent', 'partially_paid', 'overdue'].includes(key)) return true;

  const balance = Number(invoice.balance_chf || 0);
  return Number.isFinite(balance) && balance > 0;
}

function getInvoiceBalance(invoice: InvoiceRow) {
  const balance = Number(invoice.balance_chf || 0);
  return Number.isFinite(balance) && balance > 0 ? balance : 0;
}

function getStatusTone(status?: string | null) {
  const key = normalize(status);

  if (['overdue', 'cancelled', 'void'].includes(key)) {
    return { bg: '#FEF2F2', text: BRAND.red, border: '#FECACA' };
  }

  if (key === 'paid') {
    return { bg: '#F3F4F6', text: BRAND.text, border: BRAND.border };
  }

  return { bg: '#F9FAFB', text: BRAND.muted, border: BRAND.border };
}

function StatusBadge({ status }: { status?: string | null }) {
  const tone = getStatusTone(status);

  return (
    <span
      className="opc-status-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '98px',
        height: '28px',
        padding: '0 12px',
        borderRadius: '999px',
        border: `1px solid ${tone.border}`,
        background: tone.bg,
        color: tone.text,
        fontSize: '12px',
        fontWeight: 760,
        whiteSpace: 'nowrap',
      }}
    >
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
  icon?: ReactNode;
  tone?: 'neutral' | 'danger' | 'dark';
}) {
  const valueColor = tone === 'danger' ? BRAND.red : tone === 'dark' ? BRAND.black : BRAND.text;

  return (
    <div
      className="opc-invoices-metric-card"
      style={{
        ...cardStyle,
        minHeight: '96px',
        padding: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          className="opc-invoices-metric-value"
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
          className="opc-invoices-metric-label"
          style={{
            fontSize: '13px',
            fontWeight: 720,
            color: BRAND.muted,
          }}
        >
          {label}
        </div>
      </div>

      {icon && (
        <div
          className="opc-invoices-metric-icon"
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
      )}
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
      <div className="opc-invoice-card-main">
        <div style={{ minWidth: 0 }}>
          <h3>{invoice.title || invoice.invoice_number || 'Rechnung'}</h3>

          <div className="opc-invoice-meta">
            <span>
              <FileText size={14} />
              {invoice.invoice_number || 'Ohne Nummer'}
            </span>

            <span>
              <UserRound size={14} />
              {clientNumber}
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

      <div className="opc-invoice-card-actions">
        <a className="opc-invoice-action dark" href={`${baseUrl}/rechnung/${invoice.id}`} data-astro-prefetch="false">
          Rechnung öffnen
        </a>
      </div>
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
  const [clientFilter, setClientFilter] = useState('all');
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

  const clientOptions = useMemo(() => {
    const map = new Map<string, string>();

    invoices.forEach((invoice) => {
      const key = invoice.client_id || '';
      if (!key) return;

      const client = clientMap.get(key);
      map.set(key, getClientName(client, invoice));
    });

    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'de'));
  }, [invoices, clientMap]);

  const filteredInvoices = useMemo(() => {
    const query = normalize(searchQuery);

    return invoices.filter((invoice) => {
      const client = invoice.client_id ? clientMap.get(invoice.client_id) : undefined;
      const site = invoice.client_site_id ? siteMap.get(invoice.client_site_id) : undefined;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'open' && isOpenInvoice(invoice)) ||
        normalize(invoice.status) === statusFilter;

      const matchesClient = clientFilter === 'all' || invoice.client_id === clientFilter;

      const haystack = normalize([
        invoice.invoice_number,
        invoice.title,
        invoice.invoice_type,
        getClientNumber(client, invoice.client_id),
        getClientName(client, invoice),
        getSiteName(site),
      ].join(' '));

      return matchesStatus && matchesClient && (!query || haystack.includes(query));
    });
  }, [invoices, clientMap, siteMap, searchQuery, statusFilter, clientFilter]);

  const sentCount = useMemo(() => invoices.filter((invoice) => normalize(invoice.status) === 'sent').length, [invoices]);
  const overdueCount = useMemo(() => invoices.filter((invoice) => normalize(invoice.status) === 'overdue').length, [invoices]);
  const openBalance = useMemo(() => invoices.reduce((sum, invoice) => sum + getInvoiceBalance(invoice), 0), [invoices]);

  return (
    <MirakaDashboardShell requiredRole={['owner', 'admin', 'dispatch']} currentPath="/rechnung" hideTopBar>
      <div className="opc-invoices-page" style={{ fontFamily: pageFont, color: BRAND.text }}>
        <div className="opc-invoices-metrics">
          <MetricCard value={invoices.length} label="Rechnungen" icon={<FileText size={17} />} />
          <MetricCard value={sentCount} label="Gesendet" icon={<Send size={17} />} />
          <MetricCard value={formatMoney(openBalance)} label="Offener Betrag" icon={<WalletCards size={17} />} />
          <MetricCard
            value={overdueCount}
            label="Überfällig"
            icon={<AlertTriangle size={17} />}
            tone={overdueCount > 0 ? 'danger' : 'neutral'}
          />
        </div>

        <section className="opc-invoices-filter-panel" style={cardStyle}>
          <div className="opc-invoices-search">
            <Search size={17} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Rechnungen suchen..."
            />
          </div>

          <div className="opc-invoices-status-buttons" aria-label="Rechnungen filtern">
            <button
              type="button"
              className={statusFilter === 'all' ? 'active' : ''}
              onClick={() => setStatusFilter('all')}
            >
              Alle
            </button>

            <button
              type="button"
              className={statusFilter === 'open' ? 'active' : ''}
              onClick={() => setStatusFilter('open')}
            >
              Offen
            </button>

            <button
              type="button"
              className={statusFilter === 'paid' ? 'active' : ''}
              onClick={() => setStatusFilter('paid')}
            >
              Bezahlt
            </button>
          </div>

          <div className="opc-invoices-action-row">
            <a href={`${baseUrl}/kunden`} className="opc-invoice-filter-button" data-astro-prefetch="false">
              <UserRound size={16} />
              Kunde auswählen
            </a>

            <a href={`${baseUrl}/rechnung/neu`} className="opc-invoice-filter-button dark" data-astro-prefetch="false">
              <Plus size={16} />
              Neue Rechnung
            </a>
          </div>

          <div className="opc-invoices-select-row">
            <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
              <option value="all">Alle Kunden</option>
              {clientOptions.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>

            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Alle Status</option>
              <option value="open">Offene Rechnungen</option>
              <option value="draft">Entwurf</option>
              <option value="ready">Bereit</option>
              <option value="sent">Gesendet</option>
              <option value="paid">Bezahlt</option>
              <option value="partially_paid">Teilweise bezahlt</option>
              <option value="overdue">Überfällig</option>
              <option value="cancelled">Storniert</option>
            </select>
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
        html,
        body {
          width: 100%;
          min-width: 0;
          margin: 0;
          padding: 0;
        }

        body {
          overflow-x: hidden;
        }

        body > astro-island {
          width: 100%;
          max-width: none;
          margin: 0;
          padding: 0;
          display: block;
        }

        .opc-invoices-page {
          width: 100%;
          max-width: none;
          min-width: 0;
          margin: 0;
          padding: 0 0 140px;
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

        .opc-invoices-filter-panel {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          padding: 16px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          align-items: stretch;
          margin-bottom: 18px;
          overflow: visible;
        }

        .opc-invoices-search {
          width: 100%;
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

        .opc-invoices-status-buttons {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          min-width: 0;
        }

        .opc-invoices-status-buttons button {
          width: 100%;
          height: 46px;
          min-width: 0;
          border: 1px solid ${BRAND.border};
          border-radius: 14px;
          background: #FFFFFF;
          color: ${BRAND.muted};
          padding: 0 12px;
          font-size: 13px;
          font-weight: 820;
          font-family: ${pageFont};
          cursor: pointer;
          white-space: nowrap;
        }

        .opc-invoices-status-buttons button.active {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-invoices-action-row {
          width: 100%;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 8px;
          align-items: stretch;
        }

        .opc-invoice-filter-button {
          width: 100%;
          min-height: 46px;
          border-radius: 14px;
          border: 1px solid ${BRAND.border};
          background: #FFFFFF;
          color: ${BRAND.text};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 12px;
          font-size: 13px;
          font-weight: 820;
          font-family: ${pageFont};
          text-decoration: none;
          cursor: pointer;
          white-space: nowrap;
        }

        .opc-invoice-filter-button.dark {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-invoices-select-row {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .opc-invoices-select-row select {
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
          padding: 18px;
        }

        .opc-invoice-card-main {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 18px;
          align-items: start;
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

        .opc-invoice-card-side > span:last-child {
          color: ${BRAND.muted};
          font-size: 12px;
          font-weight: 720;
          white-space: nowrap;
        }

        .opc-invoice-card-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 16px;
        }

        .opc-invoice-action {
          min-height: 42px;
          border-radius: 13px;
          border: 1px solid ${BRAND.border};
          background: #FFFFFF;
          color: ${BRAND.text};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 14px;
          font-size: 13px;
          font-weight: 760;
          font-family: ${pageFont};
          text-decoration: none;
          cursor: pointer;
          white-space: nowrap;
        }

        .opc-invoice-action.dark {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
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

        @media (max-width: 720px) {
          .opc-invoices-page {
            padding-bottom: 110px;
          }

          .opc-invoices-action-row,
          .opc-invoices-select-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .opc-invoice-filter-button {
            min-height: 46px;
            font-size: 12px;
            padding: 0 8px;
          }

          .opc-invoice-card-actions {
            flex-direction: column;
          }

          .opc-invoice-action {
            width: 100%;
          }

          .opc-invoice-card-main {
            grid-template-columns: 1fr;
          }

          .opc-invoice-card-side {
            align-items: flex-start;
          }

          .opc-invoice-card {
            padding: 15px;
          }

          .opc-invoice-card h3 {
            font-size: 18px;
          }

          .opc-invoices-metric-value {
            font-size: 22px !important;
          }
        }
      `}</style>
    </MirakaDashboardShell>
  );
}
