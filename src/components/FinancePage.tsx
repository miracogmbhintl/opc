import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import MirakaDashboardShell from './MirakaDashboardShell';
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarDays,
  FileText,
  FolderOpen,
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

type QuoteRow = {
  id: string;
  quote_number?: string | null;
  client_id?: string | null;
  client_site_id?: string | null;
  inspection_id?: string | null;
  status?: string | null;
  title?: string | null;
  quote_type?: string | null;
  issue_date?: string | null;
  valid_until?: string | null;
  total_chf?: number | string | null;
  created_at?: string | null;
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

type FinanceSection = 'quotes' | 'invoices' | 'expenses' | 'payroll';

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  black: '#0F1115',
  card: '#FFFFFF',
  soft: '#FAFAFA',
  red: '#B91C1C',
};

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

const statusLabels: Record<string, string> = {
  open: 'Offen',
  draft: 'Entwurf',
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

function toNumber(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function formatMoney(value: number | string | null | undefined) {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(toNumber(value));
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

function getCreatedTime(record: { created_at?: string | null }) {
  const time = record.created_at ? new Date(record.created_at).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function getInvoiceBalance(invoice: InvoiceRow) {
  const explicitBalance = toNumber(invoice.balance_chf);
  if (explicitBalance > 0) return explicitBalance;

  if (!isProbablyOpenByStatus(invoice.status)) return 0;

  const total = toNumber(invoice.total_chf);
  const paid = toNumber(invoice.paid_chf);
  return Math.max(total - paid, 0);
}

function isProbablyOpenByStatus(status?: string | null) {
  const key = normalize(status);
  return ['draft', 'ready', 'sent', 'partially_paid', 'overdue', 'open'].includes(key);
}

function getRevenueAmount(invoice: InvoiceRow) {
  const paid = toNumber(invoice.paid_chf);
  if (paid > 0) return paid;

  const status = normalize(invoice.status);
  if (status === 'paid') return toNumber(invoice.total_chf);

  return toNumber(invoice.total_chf);
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

function MetricCard({ value, label, icon }: { value: ReactNode; label: string; icon?: ReactNode }) {
  return (
    <div
      className="opc-finance-metric-card"
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
          className="opc-finance-metric-value"
          style={{
            fontSize: '25px',
            lineHeight: 1,
            fontWeight: 820,
            letterSpacing: '-0.04em',
            color: BRAND.text,
            marginBottom: '10px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </div>

        <div
          className="opc-finance-metric-label"
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
          className="opc-finance-metric-icon"
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

function FinanceButton({
  active,
  title,
  onClick,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`opc-finance-option-button ${active ? 'active' : ''}`} onClick={onClick}>
      {title}
    </button>
  );
}

function QuoteCard({ quote, client, site }: { quote: QuoteRow; client?: ClientRow; site?: SiteRow }) {
  const clientName = getClientName(client);
  const clientNumber = getClientNumber(client, quote.client_id);
  const siteName = getSiteName(site);
  const total = formatMoney(quote.total_chf);
  const issueDate = formatDate(quote.issue_date || quote.created_at);
  const validUntil = quote.valid_until ? formatDate(quote.valid_until) : '';
  const title = quote.title || quote.quote_type || 'Offerte';
  const number = quote.quote_number || 'Ohne Offertennummer';

  return (
    <article className="opc-finance-invoice-card" style={cardStyle}>
      <div className="opc-finance-invoice-card-main">
        <div style={{ minWidth: 0 }}>
          <h3>{title}</h3>

          <div className="opc-finance-invoice-meta">
            <span>
              <FileText size={14} />
              {number}
            </span>

            <span>
              <Building2 size={14} />
              {clientName}
            </span>

            <span>
              <UserRound size={14} />
              {clientNumber}
            </span>

            <span>
              <CalendarDays size={14} />
              {issueDate}{validUntil ? ` · gültig bis ${validUntil}` : ''}
            </span>

            <span>
              <Building2 size={14} />
              {siteName}
            </span>
          </div>
        </div>

        <div className="opc-finance-invoice-card-side">
          <StatusBadge status={quote.status} />
          <strong>{total}</strong>
        </div>
      </div>

      <div className="opc-finance-invoice-card-actions">
        <a className="opc-finance-invoice-action dark" href={`${baseUrl}/offerte/${quote.id}`} data-astro-prefetch="false">
          Offerte öffnen
        </a>
      </div>
    </article>
  );
}

function InvoiceCard({ invoice, client, site }: { invoice: InvoiceRow; client?: ClientRow; site?: SiteRow }) {
  const clientName = getClientName(client, invoice);
  const clientNumber = getClientNumber(client, invoice.client_id);
  const siteName = getSiteName(site);
  const total = formatMoney(invoice.total_chf);
  const balance = formatMoney(getInvoiceBalance(invoice));
  const issueDate = formatDate(invoice.issue_date || invoice.created_at);
  const dueDate = invoice.due_date ? formatDate(invoice.due_date) : '';
  const title = invoice.title || invoice.invoice_type || 'Rechnung';
  const number = invoice.invoice_number || 'Ohne Rechnungsnummer';

  return (
    <article className="opc-finance-invoice-card" style={cardStyle}>
      <div className="opc-finance-invoice-card-main">
        <div style={{ minWidth: 0 }}>
          <h3>{title}</h3>

          <div className="opc-finance-invoice-meta">
            <span>{number}</span>

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

        <div className="opc-finance-invoice-card-side">
          <StatusBadge status={invoice.status} />
          <strong>{total}</strong>
          <span>Offen: {balance}</span>
        </div>
      </div>

      <div className="opc-finance-invoice-card-actions">
        <a className="opc-finance-invoice-action dark" href={`${baseUrl}/rechnung/${invoice.id}`} data-astro-prefetch="false">
          Rechnung öffnen
        </a>
      </div>
    </article>
  );
}

function EmptySection() {
  return (
    <div className="opc-finance-placeholder" style={cardStyle}>
      <FolderOpen size={44} strokeWidth={1.5} color="#D1D5DB" />
      <h3>Keine Einträge gefunden.</h3>
      <p>Sobald Einträge vorhanden sind, erscheinen sie hier.</p>
    </div>
  );
}

function FinanceMoreLink({ href, label }: { href: string; label: string }) {
  return (
    <a className="opc-finance-more-link" href={href} data-astro-prefetch="false">
      <span>{label}</span>
      <ArrowUpRight size={16} />
    </a>
  );
}

export default function FinancePage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [clientMap, setClientMap] = useState<Map<string, ClientRow>>(new Map());
  const [siteMap, setSiteMap] = useState<Map<string, SiteRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeSection, setActiveSection] = useState<FinanceSection>('quotes');
  const didLoadRef = useRef(false);

  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    void loadFinanceData();
  }, []);

  async function loadFinanceData() {
    setLoading(true);
    setErrorMessage('');

    try {
      if (!supabase) throw new Error('Supabase ist nicht verfügbar.');

      const [invoiceResponse, quoteResponse] = await Promise.all([
        supabase
          .from('opc_invoices')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(250),
        supabase
          .from('opc_quotes')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(250),
      ]);

      if (invoiceResponse.error) throw invoiceResponse.error;
      if (quoteResponse.error) throw quoteResponse.error;

      const rows = (invoiceResponse.data || []) as InvoiceRow[];
      const quoteRows = (quoteResponse.data || []) as QuoteRow[];

      setInvoices(rows);
      setQuotes(quoteRows);

      const clientIds = Array.from(
        new Set([
          ...rows.map((row) => row.client_id).filter(Boolean),
          ...quoteRows.map((row) => row.client_id).filter(Boolean),
        ]),
      ) as string[];

      const siteIds = Array.from(
        new Set([
          ...rows.map((row) => row.client_site_id).filter(Boolean),
          ...quoteRows.map((row) => row.client_site_id).filter(Boolean),
        ]),
      ) as string[];

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
      setErrorMessage(error?.message || 'Finanzdaten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  const latestInvoices = useMemo(
    () => [...invoices].sort((a, b) => getCreatedTime(b) - getCreatedTime(a)),
    [invoices],
  );

  const latestQuotes = useMemo(
    () => [...quotes].sort((a, b) => getCreatedTime(b) - getCreatedTime(a)),
    [quotes],
  );

  const revenueTotal = useMemo(
    () => invoices.reduce((sum, invoice) => sum + getRevenueAmount(invoice), 0),
    [invoices],
  );

  const expensesTotal = 0;
  const openBalance = useMemo(
    () => invoices.reduce((sum, invoice) => sum + getInvoiceBalance(invoice), 0),
    [invoices],
  );

  const profitMargin = '—';
  const shownQuotes = latestQuotes.slice(0, 2);
  const shownLatestInvoices = latestInvoices.slice(0, 2);

  function renderInvoiceList(rows: InvoiceRow[]) {
    if (loading) {
      return <div className="opc-finance-empty" style={cardStyle}>Finanzdaten werden geladen.</div>;
    }

    if (rows.length === 0) {
      return <EmptySection />;
    }

    return (
      <div className="opc-finance-list">
        {rows.map((invoice) => {
          const client = invoice.client_id ? clientMap.get(invoice.client_id) : undefined;
          const site = invoice.client_site_id ? siteMap.get(invoice.client_site_id) : undefined;

          return <InvoiceCard key={invoice.id} invoice={invoice} client={client} site={site} />;
        })}
      </div>
    );
  }


  function renderQuoteList(rows: QuoteRow[]) {
    if (loading) {
      return <div className="opc-finance-empty" style={cardStyle}>Finanzdaten werden geladen.</div>;
    }

    if (rows.length === 0) {
      return <EmptySection />;
    }

    return (
      <div className="opc-finance-list">
        {rows.map((quote) => {
          const client = quote.client_id ? clientMap.get(quote.client_id) : undefined;
          const site = quote.client_site_id ? siteMap.get(quote.client_site_id) : undefined;

          return <QuoteCard key={quote.id} quote={quote} client={client} site={site} />;
        })}
      </div>
    );
  }

  return (
    <MirakaDashboardShell requiredRole={['owner']} currentPath="/finanzen" hideTopBar>
      <div className="opc-finance-page" style={{ fontFamily: pageFont, color: BRAND.text }}>
        {errorMessage ? <div className="opc-finance-error">{errorMessage}</div> : null}

        <div className="opc-finance-metrics">
          <MetricCard value={formatMoney(revenueTotal)} label="Umsatz" icon={<WalletCards size={17} />} />
          <MetricCard value={profitMargin} label="Gewinnmarge" icon={<WalletCards size={17} />} />
          <MetricCard value={formatMoney(expensesTotal)} label="Ausgaben" icon={<FileText size={17} />} />
          <MetricCard value={formatMoney(openBalance)} label="Offene Rechnungen" icon={<AlertTriangle size={17} />} />
        </div>

        <div className="opc-finance-option-grid" aria-label="Finanzbereich auswählen">
          <FinanceButton
            active={activeSection === 'quotes'}
            title="Offerte"
            onClick={() => setActiveSection('quotes')}
          />

          <FinanceButton
            active={activeSection === 'invoices'}
            title="Rechnungen"
            onClick={() => setActiveSection('invoices')}
          />

          <FinanceButton
            active={activeSection === 'expenses'}
            title="Ausgaben"
            onClick={() => setActiveSection('expenses')}
          />

          <FinanceButton
            active={activeSection === 'payroll'}
            title="Lohn"
            onClick={() => setActiveSection('payroll')}
          />
        </div>

        {activeSection === 'quotes' ? (
          <section className="opc-finance-section">
            {renderQuoteList(shownQuotes)}
            <FinanceMoreLink href={`${baseUrl}/offerten`} label="Weitere Offerten" />
          </section>
        ) : null}

        {activeSection === 'invoices' ? (
          <section className="opc-finance-section">
            {renderInvoiceList(shownLatestInvoices)}
            <FinanceMoreLink href={`${baseUrl}/rechnung`} label="Weitere Rechnungen" />
          </section>
        ) : null}

        {activeSection === 'expenses' ? (
          <section className="opc-finance-section">
            <EmptySection />
            <FinanceMoreLink href={`${baseUrl}/finanzen/ausgaben`} label="Ausgaben öffnen" />
          </section>
        ) : null}

        {activeSection === 'payroll' ? (
          <section className="opc-finance-section">
            <EmptySection />
            <FinanceMoreLink href={`${baseUrl}/finanzen/lohn`} label="Lohn öffnen" />
          </section>
        ) : null}
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

        .opc-finance-page {
          width: 100%;
          max-width: none;
          min-width: 0;
          margin: 0;
          padding: 0 0 140px;
        }

        .opc-finance-page * {
          box-sizing: border-box;
        }

        .opc-finance-error {
          border: 1px solid #FECACA;
          background: #FEF2F2;
          color: ${BRAND.red};
          padding: 14px 16px;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 720;
          margin-bottom: 14px;
        }

        .opc-finance-metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }

        .opc-finance-option-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 14px;
        }

        .opc-finance-option-button {
          width: 100%;
          min-height: 46px;
          border: 1px solid ${BRAND.border};
          border-radius: 14px;
          background: #FFFFFF;
          color: ${BRAND.muted};
          box-shadow: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 12px;
          text-align: center;
          cursor: pointer;
          font-family: ${pageFont};
          font-size: 13px;
          line-height: 1;
          letter-spacing: 0;
          font-weight: 820;
          white-space: nowrap;
        }

        .opc-finance-option-button.active {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-finance-section {
          display: grid;
          gap: 12px;
        }

        .opc-finance-more-link {
          width: 100%;
          min-height: 46px;
          border-radius: 14px;
          border: 1px solid ${BRAND.black};
          background: ${BRAND.black};
          color: #FFFFFF;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 14px;
          font-size: 13px;
          font-weight: 820;
          font-family: ${pageFont};
          text-decoration: none;
          cursor: pointer;
          white-space: nowrap;
        }

        .opc-finance-more-link svg {
          flex: 0 0 auto;
        }

        .opc-finance-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .opc-finance-invoice-card {
          padding: 18px;
        }

        .opc-finance-invoice-card-main {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 18px;
          align-items: start;
        }

        .opc-finance-invoice-card h3 {
          margin: 0;
          color: ${BRAND.text};
          font-size: 20px;
          line-height: 1.18;
          letter-spacing: -0.04em;
          font-weight: 860;
        }

        .opc-finance-invoice-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          margin-top: 9px;
          color: ${BRAND.muted};
          font-size: 13px;
          line-height: 1.35;
          font-weight: 650;
        }

        .opc-finance-invoice-meta span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .opc-finance-invoice-card-side {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
        }

        .opc-finance-invoice-card-side strong {
          color: ${BRAND.text};
          font-size: 16px;
          line-height: 1;
          font-weight: 840;
          white-space: nowrap;
        }

        .opc-finance-invoice-card-side > span:not(.opc-status-badge) {
          color: ${BRAND.muted};
          font-size: 12px;
          font-weight: 720;
          white-space: nowrap;
        }

        .opc-finance-invoice-card-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 16px;
        }

        .opc-finance-invoice-action {
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

        .opc-finance-invoice-action.dark {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-finance-empty,
        .opc-finance-placeholder {
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

        .opc-finance-placeholder {
          min-height: 260px;
          padding: 70px 22px;
          display: grid;
          place-items: center;
          text-align: center;
          gap: 8px;
        }

        .opc-finance-placeholder svg {
          margin-bottom: 6px;
        }

        .opc-finance-placeholder h3 {
          margin: 6px 0 0;
          color: ${BRAND.text};
          font-size: 17px;
          line-height: 1.2;
          letter-spacing: 0;
          font-weight: 760;
        }

        .opc-finance-placeholder p {
          margin: 0;
          color: ${BRAND.muted};
          font-size: 14px;
          line-height: 1.45;
          font-weight: 560;
        }

        @media (max-width: 720px) {
          .opc-finance-page {
            padding-bottom: 110px;
          }

          .opc-finance-option-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .opc-finance-option-button {
            min-height: 46px;
            border-radius: 14px;
            font-size: 13px;
          }

          .opc-finance-more-link {
            width: 100%;
          }

          .opc-finance-invoice-card-actions {
            flex-direction: column;
          }

          .opc-finance-invoice-action {
            width: 100%;
          }

          .opc-finance-invoice-card-main {
            grid-template-columns: 1fr;
          }

          .opc-finance-invoice-card-side {
            align-items: flex-start;
          }

          .opc-finance-invoice-card {
            padding: 15px;
          }

          .opc-finance-invoice-card h3 {
            font-size: 18px;
          }
        }
      `}</style>
    </MirakaDashboardShell>
  );
}
