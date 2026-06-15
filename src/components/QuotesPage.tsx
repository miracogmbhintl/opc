import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import MirakaDashboardShell from './MirakaDashboardShell';
import { OPCPageShell, opcResponsiveStyle } from './opc/OPCPageTop';
import {
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
  viewed: 'Gesehen',
  accepted: 'Angenommen',
  declined: 'Abgelehnt',
  expired: 'Abgelaufen',
  cancelled: 'Storniert',
  converted_to_job: 'Einsatz erstellt',
  invoiced: 'Verrechnet',
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

function getStatusTone(status?: string | null) {
  const key = normalize(status);

  if (['accepted', 'converted_to_job', 'invoiced'].includes(key)) {
    return { bg: '#F3F4F6', text: BRAND.text, border: BRAND.border };
  }

  if (['sent', 'viewed', 'ready'].includes(key)) {
    return { bg: '#ECFEFF', text: BRAND.blue, border: '#A5F3FC' };
  }

  if (['draft'].includes(key)) {
    return { bg: '#FFFBEB', text: BRAND.amber, border: '#FDE68A' };
  }

  if (['declined', 'expired', 'cancelled'].includes(key)) {
    return { bg: '#FEF2F2', text: BRAND.red, border: '#FECACA' };
  }

  return { bg: '#F9FAFB', text: BRAND.muted, border: BRAND.border };
}

function StatusBadge({ status }: { status?: string | null }) {
  const tone = getStatusTone(status);

  return (
    <span className="opc-quotes-status-badge" style={{ background: tone.bg, color: tone.text, borderColor: tone.border }}>
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
  tone?: 'neutral' | 'success' | 'warning' | 'dark';
}) {
  const valueColor =
    tone === 'success'
      ? BRAND.green
      : tone === 'warning'
        ? BRAND.amber
        : tone === 'dark'
          ? BRAND.black
          : BRAND.text;

  return (
    <div className="opc-quotes-metric-card" style={cardStyle}>
      <div style={{ minWidth: 0 }}>
        <div className="opc-quotes-metric-value" style={{ color: valueColor }}>
          {value}
        </div>
        <div className="opc-quotes-metric-label">{label}</div>
      </div>
      <div className="opc-quotes-metric-icon">{icon}</div>
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
    <article className="opc-quote-card" style={cardStyle}>
      <a href={`${baseUrl}/offerte/${quote.id}`} className="opc-quote-card-link" data-astro-prefetch="false">
        <div className="opc-quote-card-main">
          <div style={{ minWidth: 0 }}>
            <div className="opc-quote-client-number">{clientNumber}</div>
            <h3>{quote.title || quote.quote_number || 'Offerte'}</h3>
            <div className="opc-quote-meta">
              <span>
                <FileText size={14} />
                {quote.quote_number || 'Ohne Nummer'}
              </span>
              <span>
                <Building2 size={14} />
                {clientName}
              </span>
              <span>{siteName}</span>
              <span>
                <CalendarDays size={14} />
                {issueDate}{validUntil ? ` · gültig bis ${validUntil}` : ''}
              </span>
            </div>
          </div>

          <div className="opc-quote-card-side">
            <StatusBadge status={quote.status} />
            <strong>{total}</strong>
          </div>
        </div>
      </a>
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
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

  const filteredQuotes = useMemo(() => {
    const query = normalize(searchQuery);

    return quotes.filter((quote) => {
      const client = quote.client_id ? clientMap.get(quote.client_id) : undefined;
      const site = quote.client_site_id ? siteMap.get(quote.client_site_id) : undefined;
      const matchesStatus = statusFilter === 'all' || normalize(quote.status) === statusFilter;
      const haystack = normalize([
        quote.quote_number,
        quote.title,
        quote.quote_type,
        getClientNumber(client, quote.client_id),
        getClientName(client),
        getSiteName(site),
      ].join(' '));

      return matchesStatus && (!query || haystack.includes(query));
    });
  }, [quotes, clientMap, siteMap, searchQuery, statusFilter]);

  const sentCount = useMemo(() => quotes.filter((quote) => ['sent', 'viewed'].includes(normalize(quote.status))).length, [quotes]);
  const acceptedCount = useMemo(() => quotes.filter((quote) => ['accepted', 'converted_to_job', 'invoiced'].includes(normalize(quote.status))).length, [quotes]);
  const openCount = useMemo(() => quotes.filter((quote) => ['draft', 'ready'].includes(normalize(quote.status))).length, [quotes]);
  const totalPipeline = useMemo(() => quotes.reduce((sum, quote) => sum + Number(quote.total_chf || 0), 0), [quotes]);

  return (
    <MirakaDashboardShell requiredRole={['owner', 'admin', 'dispatch']} currentPath="/offerten" fullWidth hideTopBar>
      <OPCPageShell>
        <div className="opc-quotes-page" style={{ fontFamily: pageFont }}>
          <div className="opc-quotes-metrics">
            <MetricCard value={quotes.length} label="Offerten" icon={<FileText size={18} />} tone="dark" />
            <MetricCard value={openCount} label="Offen" icon={<CalendarDays size={18} />} tone="warning" />
            <MetricCard value={sentCount} label="Gesendet" icon={<Send size={18} />} />
            <MetricCard value={acceptedCount} label="Angenommen" icon={<CheckCircle2 size={18} />} tone="success" />
          </div>

          <section className="opc-quotes-filter-panel" style={cardStyle}>
            <div className="opc-quotes-filter-top">
              <div className="opc-quotes-filter-actions">
                <a href={`${baseUrl}/kunden`} className="opc-filter-button light" data-astro-prefetch="false">
                  <UserRound size={16} />
                  Kunde auswählen
                </a>

                <a href={`${baseUrl}/offerte/neu`} className="opc-filter-button dark" data-astro-prefetch="false">
                  <Plus size={16} />
                  Neue Offerte
                </a>
              </div>

              <div className="opc-quotes-pipeline-hint">
                <WalletCards size={15} />
                <span>Pipeline gesamt</span>
                <strong>{formatMoney(totalPipeline)}</strong>
              </div>
            </div>

            <div className="opc-quotes-search-row">
              <div className="opc-quotes-search">
                <Search size={17} />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Offerte, Kunde, Kundennummer, Adresse suchen"
                />
              </div>

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

          {errorMessage ? <div className="opc-quotes-error">{errorMessage}</div> : null}

          {loading ? (
            <div className="opc-quotes-empty" style={cardStyle}>Offerten werden geladen.</div>
          ) : filteredQuotes.length === 0 ? (
            <div className="opc-quotes-empty" style={cardStyle}>Keine Offerten gefunden.</div>
          ) : (
            <div className="opc-quotes-list">
              {filteredQuotes.map((quote) => {
                const client = quote.client_id ? clientMap.get(quote.client_id) : undefined;
                const site = quote.client_site_id ? siteMap.get(quote.client_site_id) : undefined;

                return <QuoteCard key={quote.id} quote={quote} client={client} site={site} />;
              })}
            </div>
          )}
        </div>

        <style>{`
          ${opcResponsiveStyle}

          .opc-quotes-page {
            padding: 0 0 140px;
            color: ${BRAND.text};
          }

          .opc-quotes-page * {
            box-sizing: border-box;
          }

          .opc-quotes-metrics {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 14px;
          }

          .opc-quotes-metric-card {
            min-height: 96px;
            padding: 18px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
          }

          .opc-quotes-metric-value {
            font-size: 25px;
            line-height: 1;
            font-weight: 820;
            letter-spacing: -0.04em;
            margin-bottom: 10px;
          }

          .opc-quotes-metric-label {
            font-size: 13px;
            font-weight: 720;
            color: ${BRAND.muted};
          }

          .opc-quotes-metric-icon {
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

          .opc-quotes-filter-panel {
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

          .opc-quotes-filter-top {
            display: grid;
            grid-template-columns: minmax(0, 1fr) max-content;
            gap: 8px;
            align-items: stretch;
          }

          .opc-quotes-filter-actions {
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

          .opc-quotes-search-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 220px);
            gap: 8px;
            align-items: stretch;
          }

          .opc-quotes-search {
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

          .opc-quotes-search input {
            width: 100%;
            min-width: 0;
            border: 0;
            outline: 0;
            color: ${BRAND.text};
            font-size: 14px;
            font-weight: 650;
            font-family: ${pageFont};
          }

          .opc-quotes-search-row select {
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

          .opc-quotes-pipeline-hint {
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

          .opc-quotes-pipeline-hint strong {
            color: ${BRAND.text};
            font-weight: 840;
          }

          .opc-quotes-error {
            border: 1px solid #FECACA;
            background: #FEF2F2;
            color: ${BRAND.red};
            padding: 14px 16px;
            border-radius: 16px;
            font-size: 13px;
            font-weight: 720;
            margin-bottom: 14px;
          }

          .opc-quotes-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .opc-quote-card {
            padding: 0;
            overflow: hidden;
          }

          .opc-quote-card-link {
            display: block;
            color: ${BRAND.text};
            text-decoration: none;
            padding: 18px;
          }

          .opc-quote-card-main {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 18px;
            align-items: start;
          }

          .opc-quote-client-number {
            margin-bottom: 6px;
            color: ${BRAND.muted};
            font-size: 12px;
            line-height: 1.2;
            font-weight: 820;
            text-transform: uppercase;
            letter-spacing: 0.02em;
          }

          .opc-quote-card h3 {
            margin: 0;
            color: ${BRAND.text};
            font-size: 20px;
            line-height: 1.18;
            letter-spacing: -0.04em;
            font-weight: 860;
          }

          .opc-quote-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 8px 14px;
            margin-top: 9px;
            color: ${BRAND.muted};
            font-size: 13px;
            line-height: 1.35;
            font-weight: 650;
          }

          .opc-quote-meta span {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            max-width: 100%;
            min-width: 0;
            overflow-wrap: anywhere;
          }

          .opc-quote-card-side {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 8px;
          }

          .opc-quote-card-side strong {
            color: ${BRAND.text};
            font-size: 13px;
            font-weight: 840;
            white-space: nowrap;
          }

          .opc-quotes-status-badge {
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

          .opc-quotes-empty {
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
            .opc-quotes-page {
              padding-bottom: 110px;
            }

            .opc-quotes-metrics {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 10px;
            }

            .opc-quotes-metric-card {
              min-height: 86px;
              padding: 15px;
            }

            .opc-quotes-metric-value {
              font-size: 23px;
            }

            .opc-quotes-search-row {
              grid-template-columns: 1fr;
            }

            .opc-quotes-filter-top {
              grid-template-columns: 1fr;
            }

            .opc-quotes-filter-actions {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .opc-quotes-pipeline-hint {
              justify-content: flex-start;
              width: 100%;
            }

            .opc-filter-button {
              min-height: 46px;
              font-size: 12px;
              padding: 0 8px;
            }

            .opc-quote-card-main {
              grid-template-columns: 1fr;
            }

            .opc-quote-card-side {
              align-items: flex-start;
            }

            .opc-quote-card-link {
              padding: 15px;
            }

            .opc-quote-card h3 {
              font-size: 18px;
            }
          }
        `}</style>
      </OPCPageShell>
    </MirakaDashboardShell>
  );
}
