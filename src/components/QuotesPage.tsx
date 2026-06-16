import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import MirakaDashboardShell from './MirakaDashboardShell';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  FileText,
  Plus,
  Search,
  UserRound,
  WalletCards,
} from 'lucide-react';

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

type StatusFilter = 'all' | 'draft' | 'ready' | 'sent' | 'accepted' | 'converted_to_job' | 'invoiced';
type QuoteStageFilter = 'all' | 'open' | 'accepted';

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  black: '#0F1115',
  card: '#FFFFFF',
  soft: '#FAFAFA',
  red: '#B91C1C',
};

const openPipelineStatuses = new Set(['draft', 'ready', 'sent', 'viewed']);
const acceptedStatuses = new Set(['accepted', 'converted_to_job', 'invoiced']);

const statusLabels: Record<string, string> = {
  all: 'Alle Status',
  draft: 'Entwurf',
  ready: 'Bereit',
  sent: 'Gesendet',
  viewed: 'Gesehen',
  accepted: 'Angenommen',
  declined: 'Abgelehnt',
  expired: 'Abgelaufen',
  cancelled: 'Storniert',
  converted_to_job: 'Einsatz erstellt',
  invoiced: 'Verrechnet',
};

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

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

function getClientName(client?: ClientRow) {
  if (!client) return 'Unbekannter Kunde';

  return client.billing_name || client.company_name || client.full_name || client.email || client.billing_email || 'Unbekannter Kunde';
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

function getQuoteTypeLabel(value?: string | null) {
  const clean = String(value || '').trim();
  if (!clean) return 'Offerte';

  return clean.replace(/_/g, ' ');
}

function StatusBadge({ status }: { status?: string | null }) {
  return (
    <span className="opc-status-badge">
      {getStatusLabel(status)}
    </span>
  );
}

function MetricCard({
  value,
  label,
  icon,
}: {
  value: string | number;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <div
      className="opc-jobs-metric-card"
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
          className="opc-jobs-metric-value"
          style={{
            fontSize: '25px',
            lineHeight: 1,
            fontWeight: 820,
            letterSpacing: '-0.04em',
            color: BRAND.text,
            marginBottom: '10px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {value}
        </div>

        <div
          className="opc-jobs-metric-label"
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
          className="opc-jobs-metric-icon"
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

function QuoteCard({ quote, client, site }: { quote: QuoteRow; client?: ClientRow; site?: SiteRow }) {
  const clientName = getClientName(client);
  const clientNumber = getClientNumber(client, quote.client_id);
  const siteName = getSiteName(site);
  const total = formatMoney(quote.total_chf);
  const issueDate = formatDate(quote.issue_date || quote.created_at);
  const validUntil = quote.valid_until ? formatDate(quote.valid_until) : '';

  return (
    <article className="opc-job-card opc-quote-card" style={cardStyle}>
      <div className="opc-job-card-main">
        <div style={{ minWidth: 0 }}>
          <h3>{quote.title || quote.quote_number || 'Offerte'}</h3>

          <div className="opc-job-meta">
            <span>
              <FileText size={14} />
              {quote.quote_number || 'Ohne Nummer'}
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

        <div className="opc-job-card-side">
          <StatusBadge status={quote.status} />
          <span>{total}</span>
        </div>
      </div>

      <div className="opc-job-card-actions">
        <a className="opc-job-action dark" href={`${baseUrl}/offerte/${quote.id}`} data-astro-prefetch="false">
          Offerte öffnen
        </a>
      </div>
    </article>
  );
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [clientMap, setClientMap] = useState<Map<string, ClientRow>>(new Map());
  const [siteMap, setSiteMap] = useState<Map<string, SiteRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<QuoteStageFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [quoteTypeFilter, setQuoteTypeFilter] = useState('all');
  const didLoadRef = useRef(false);

  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    void loadQuotes();
  }, []);

  async function loadQuotes() {
    setLoading(true);
    setErrorMessage('');

    try {
      if (!supabase) throw new Error('Supabase ist nicht verfügbar.');

      const { data, error } = await supabase
        .from('opc_quotes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(250);

      if (error) throw error;

      const rows = (data || []) as QuoteRow[];
      setQuotes(rows);

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
      setErrorMessage(error?.message || 'Offerten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  const availableQuoteTypes = useMemo(() => {
    const quoteTypes = quotes
      .map((quote) => String(quote.quote_type || '').trim())
      .filter(Boolean);

    return Array.from(new Set<string>(quoteTypes)).sort((a, b) =>
      getQuoteTypeLabel(a).localeCompare(getQuoteTypeLabel(b), 'de'),
    );
  }, [quotes]);

  const filteredQuotes = useMemo(() => {
    const query = normalize(searchQuery);

    return quotes.filter((quote) => {
      const status = normalize(quote.status);
      const client = quote.client_id ? clientMap.get(quote.client_id) : undefined;
      const site = quote.client_site_id ? siteMap.get(quote.client_site_id) : undefined;

      const matchesStage =
        stageFilter === 'all' ||
        (stageFilter === 'open' && openPipelineStatuses.has(status)) ||
        (stageFilter === 'accepted' && acceptedStatuses.has(status));

      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      const matchesType = quoteTypeFilter === 'all' || normalize(quote.quote_type) === normalize(quoteTypeFilter);

      const haystack = normalize([
        quote.quote_number,
        quote.title,
        quote.quote_type,
        getClientNumber(client, quote.client_id),
        getClientName(client),
        getSiteName(site),
        getStatusLabel(quote.status),
      ].join(' '));

      return matchesStage && matchesStatus && matchesType && (!query || haystack.includes(query));
    });
  }, [quotes, clientMap, siteMap, searchQuery, stageFilter, statusFilter, quoteTypeFilter]);

  const acceptedCount = useMemo(
    () => quotes.filter((quote) => acceptedStatuses.has(normalize(quote.status))).length,
    [quotes],
  );

  const openQuotes = useMemo(
    () => quotes.filter((quote) => openPipelineStatuses.has(normalize(quote.status))),
    [quotes],
  );

  const totalPipeline = useMemo(
    () => quotes.reduce((sum, quote) => sum + Number(quote.total_chf || 0), 0),
    [quotes],
  );

  return (
    <MirakaDashboardShell
      hideTopBar={true}
      requiredRole={['owner', 'admin', 'dispatch']}
      currentPath="/offerten"
    >
      <div className="opc-jobs-page opc-quotes-page" style={{ width: '100%', maxWidth: 'none', margin: 0, paddingLeft: 0, paddingRight: 0, fontFamily: pageFont, color: BRAND.text }}>
        {errorMessage ? <div className="opc-jobs-error">{errorMessage}</div> : null}

        <div className="opc-jobs-metrics">
          <MetricCard value={quotes.length} label="Offerten" icon={<FileText size={17} />} />
          <MetricCard value={openQuotes.length} label="Offen" icon={<CalendarDays size={17} />} />
          <MetricCard value={formatMoney(totalPipeline)} label="Pipeline" icon={<WalletCards size={17} />} />
          <MetricCard value={acceptedCount} label="Angenommen" icon={<CheckCircle2 size={17} />} />
        </div>

        <section className="opc-jobs-filter-panel" style={cardStyle}>
          <div className="opc-jobs-search">
            <Search size={17} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Offerten suchen..."
            />
          </div>

          <div className="opc-jobs-date-buttons" aria-label="Offerten filtern">
            <button
              type="button"
              className={stageFilter === 'all' ? 'active' : ''}
              onClick={() => setStageFilter('all')}
            >
              Alle
            </button>

            <button
              type="button"
              className={stageFilter === 'open' ? 'active' : ''}
              onClick={() => setStageFilter('open')}
            >
              Offen
            </button>

            <button
              type="button"
              className={stageFilter === 'accepted' ? 'active' : ''}
              onClick={() => setStageFilter('accepted')}
            >
              Angenommen
            </button>
          </div>

          <div className="opc-jobs-date-plan-row">
            <a className="opc-date-popup-trigger" href={`${baseUrl}/kunden`} data-astro-prefetch="false">
              <UserRound size={16} />
              Kunde auswählen
            </a>

            <a className="opc-jobs-plan-button" href={`${baseUrl}/offerte/neu`} data-astro-prefetch="false">
              <Plus size={16} />
              Neue Offerte
            </a>
          </div>

          <div className="opc-jobs-select-row">
            <select value={quoteTypeFilter} onChange={(event) => setQuoteTypeFilter(event.target.value)}>
              <option value="all">Alle Offertentypen</option>
              {availableQuoteTypes.map((quoteType) => (
                <option key={quoteType} value={quoteType}>
                  {getQuoteTypeLabel(quoteType)}
                </option>
              ))}
            </select>

            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Alle Status</option>
              <option value="draft">Entwurf</option>
              <option value="ready">Bereit</option>
              <option value="sent">Gesendet</option>
              <option value="accepted">Angenommen</option>
              <option value="converted_to_job">Einsatz erstellt</option>
              <option value="invoiced">Verrechnet</option>
            </select>
          </div>
        </section>

        {loading ? (
          <div className="opc-jobs-empty" style={cardStyle}>Offerten werden geladen.</div>
        ) : filteredQuotes.length === 0 ? (
          <div className="opc-jobs-empty" style={cardStyle}>Keine Offerten gefunden.</div>
        ) : (
          <div className="opc-jobs-list">
            {filteredQuotes.map((quote) => {
              const client = quote.client_id ? clientMap.get(quote.client_id) : undefined;
              const site = quote.client_site_id ? siteMap.get(quote.client_site_id) : undefined;

              return <QuoteCard key={quote.id} quote={quote} client={client} site={site} />;
            })}
          </div>
        )}
      </div>

      <style>{`
        .opc-jobs-page {
          padding: 0 0 140px;
        }

        .opc-quotes-page {
          width: 100% !important;
          max-width: none !important;
          min-width: 0 !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
        }

        .opc-quotes-page > * {
          max-width: none !important;
        }

        .opc-page-shell,
        .opc-page-container,
        .opc-page-content,
        .opc-responsive-shell,
        .opc-content-shell,
        .opc-dashboard-page-shell,
        .opc-dashboard-content-shell,
        .miraka-page-shell,
        .miraka-page-container,
        .miraka-content-shell {
          max-width: none !important;
        }

        .opc-page-shell,
        .opc-page-container,
        .opc-responsive-shell,
        .opc-content-shell,
        .opc-dashboard-page-shell,
        .opc-dashboard-content-shell {
          padding-left: 0 !important;
          padding-right: 0 !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
        }

        .opc-jobs-page * {
          box-sizing: border-box;
        }

        .opc-quotes-page {
          padding: 0 0 140px;
        }


        .opc-jobs-error {
          border: 1px solid #FECACA;
          background: #FEF2F2;
          color: ${BRAND.red};
          padding: 14px 16px;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 720;
          margin-bottom: 14px;
        }

        .opc-jobs-metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }

        .opc-jobs-filter-panel {
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

        .opc-jobs-search {
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

        .opc-jobs-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          color: ${BRAND.text};
          font-size: 14px;
          font-weight: 650;
          font-family: ${pageFont};
        }

        .opc-jobs-search input::placeholder {
          color: #9CA3AF;
          font-weight: 700;
        }

        .opc-jobs-date-buttons {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          min-width: 0;
        }

        .opc-jobs-date-buttons button {
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

        .opc-jobs-date-buttons button.active {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-jobs-date-plan-row {
          width: 100%;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 8px;
          align-items: stretch;
        }

        .opc-date-popup-trigger,
        .opc-jobs-plan-button {
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

        .opc-jobs-plan-button {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-jobs-select-row {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .opc-jobs-select-row select {
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

        .opc-jobs-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .opc-job-card {
          padding: 18px;
        }

        .opc-job-card-main {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 18px;
          align-items: start;
        }

        .opc-job-card h3 {
          margin: 0;
          color: ${BRAND.text};
          font-size: 20px;
          line-height: 1.18;
          letter-spacing: -0.04em;
          font-weight: 860;
        }

        .opc-job-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          margin-top: 9px;
          color: ${BRAND.muted};
          font-size: 13px;
          line-height: 1.35;
          font-weight: 650;
        }

        .opc-job-meta span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-width: 0;
          max-width: 100%;
          overflow-wrap: anywhere;
        }

        .opc-job-card-side {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
        }

        .opc-job-card-side > span {
          color: ${BRAND.muted};
          font-size: 12px;
          font-weight: 720;
          white-space: nowrap;
        }

        .opc-status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 98px;
          height: 28px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid ${BRAND.border};
          background: #F9FAFB;
          color: ${BRAND.muted};
          font-size: 12px;
          font-weight: 760;
          white-space: nowrap;
        }

        .opc-job-card-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 16px;
        }

        .opc-job-action {
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

        .opc-job-action.dark {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-jobs-empty {
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
          .opc-jobs-page {
            padding-bottom: 110px;
          }

          .opc-jobs-date-plan-row,
          .opc-jobs-select-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .opc-date-popup-trigger,
          .opc-jobs-plan-button {
            min-height: 46px;
            font-size: 12px;
            padding: 0 8px;
          }

          .opc-job-card-actions {
            flex-direction: column;
          }

          .opc-job-action {
            width: 100%;
          }

          .opc-job-card-main {
            grid-template-columns: 1fr;
          }

          .opc-job-card-side {
            align-items: flex-start;
          }

          .opc-job-card {
            padding: 15px;
          }

          .opc-job-card h3 {
            font-size: 18px;
          }
        }
      `}</style>
    </MirakaDashboardShell>
  );
}
