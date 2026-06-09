import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import MirakaDashboardShell from './MirakaDashboardShell';
import {
  OPCPageShell,
  OPCMetricsGrid,
  OPCMetricCard,
  OPCToolbar,
  OPCListCard,
  OPC_BRAND,
  opcBlackButtonStyle,
  opcInputStyle,
  opcSelectStyle,
  opcResponsiveStyle,
} from './opc/OPCPageTop';
import { CheckCircle2, FileText, Search, Send, WalletCards } from 'lucide-react';

type QuoteRow = {
  id: string;
  quote_number: string;
  client_id: string;
  client_site_id: string | null;
  inspection_id: string | null;
  status: string;
  title: string;
  quote_type: string;
  issue_date: string;
  valid_until: string | null;
  total_chf: number | string;
  created_at: string;
};

type ClientRow = { id: string; billing_name?: string | null; company_name?: string | null; full_name?: string | null };
type SiteRow = { id: string; site_name?: string | null; address_text?: string | null; city?: string | null };
type StatusFilter = 'all' | 'draft' | 'ready' | 'sent' | 'accepted' | 'converted_to_job' | 'invoiced';

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

function normalize(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function formatMoney(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(amount);
}

function getClientName(client?: ClientRow) {
  if (!client) return 'Unbekannter Kunde';
  return client.billing_name || client.company_name || client.full_name || 'Unbekannter Kunde';
}

function getSiteName(site?: SiteRow) {
  if (!site) return '';
  return [site.site_name, site.address_text, site.city].filter(Boolean).join(' · ');
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [clientMap, setClientMap] = useState<Map<string, ClientRow>>(new Map());
  const [siteMap, setSiteMap] = useState<Map<string, SiteRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
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

      const clientIds = Array.from(new Set(rows.map((row) => row.client_id).filter(Boolean)));
      const siteIds = Array.from(new Set(rows.map((row) => row.client_site_id).filter(Boolean))) as string[];

      const [clientsResponse, sitesResponse] = await Promise.all([
        clientIds.length ? supabase.from('opc_clients').select('id, billing_name, company_name, full_name').in('id', clientIds) : Promise.resolve({ data: [], error: null } as any),
        siteIds.length ? supabase.from('opc_client_sites').select('id, site_name, address_text, city').in('id', siteIds) : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (clientsResponse.error) console.warn(clientsResponse.error.message);
      if (sitesResponse.error) console.warn(sitesResponse.error.message);

      setClientMap(new Map((clientsResponse.data || []).map((client: ClientRow) => [client.id, client])));
      setSiteMap(new Map((sitesResponse.data || []).map((site: SiteRow) => [site.id, site])));
    } catch (error: any) {
      setErrorMessage(error?.message || 'Offerten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  const filteredQuotes = useMemo(() => {
    const query = normalize(searchQuery);

    return quotes.filter((quote) => {
      const client = clientMap.get(quote.client_id);
      const site = quote.client_site_id ? siteMap.get(quote.client_site_id) : undefined;
      const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;
      const haystack = normalize([quote.quote_number, quote.title, getClientName(client), getSiteName(site), quote.quote_type].join(' '));
      return matchesStatus && (!query || haystack.includes(query));
    });
  }, [quotes, clientMap, siteMap, searchQuery, statusFilter]);

  const sentCount = quotes.filter((quote) => ['sent', 'viewed'].includes(quote.status)).length;
  const acceptedCount = quotes.filter((quote) => ['accepted', 'converted_to_job', 'invoiced'].includes(quote.status)).length;
  const totalPipeline = quotes.reduce((sum, quote) => sum + Number(quote.total_chf || 0), 0);

  return (
    <MirakaDashboardShell requiredRole={['owner', 'admin', 'dispatch']} currentPath="/offerten" fullWidth hideTopBar>
      <OPCPageShell>
        <div style={pageHeaderStyle} className="opc-mobile-page-header">
          <div>
            <p style={eyebrowStyle}>Sales Pipeline</p>
            <h1 style={titleStyle}>Offerten</h1>
            <p style={subtitleStyle}>Offerten aus Besichtigungen bearbeiten, speichern und später versenden.</p>
          </div>
          <a href={`${baseUrl}/besichtigungen`} style={{ ...opcBlackButtonStyle, width: 'auto' }}>
            <FileText size={16} />
            Besichtigungen öffnen
          </a>
        </div>

        <OPCMetricsGrid>
          <OPCMetricCard value={quotes.length} label="Offerten" icon={<FileText size={18} />} />
          <OPCMetricCard value={sentCount} label="Gesendet" icon={<Send size={18} />} />
          <OPCMetricCard value={acceptedCount} label="Angenommen" icon={<CheckCircle2 size={18} />} tone="success" />
          <OPCMetricCard value={formatMoney(totalPipeline)} label="Pipeline" icon={<WalletCards size={18} />} />
        </OPCMetricsGrid>

        <OPCToolbar columns="minmax(0, 1fr) 220px">
          <div style={{ position: 'relative' }}>
            <Search size={17} style={{ position: 'absolute', left: 14, top: 15, color: OPC_BRAND.faint }} />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Offerte, Kunde, Adresse suchen" style={{ ...opcInputStyle, paddingLeft: 42 }} />
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} style={opcSelectStyle}>
            <option value="all">Alle Status</option>
            <option value="draft">Entwurf</option>
            <option value="ready">Bereit</option>
            <option value="sent">Gesendet</option>
            <option value="accepted">Angenommen</option>
            <option value="converted_to_job">Einsatz erstellt</option>
            <option value="invoiced">Verrechnet</option>
          </select>
        </OPCToolbar>

        <OPCListCard>
          {errorMessage && <div style={errorStyle}>{errorMessage}</div>}

          {loading ? (
            <div style={emptyStyle}>Offerten werden geladen.</div>
          ) : filteredQuotes.length === 0 ? (
            <div style={emptyStyle}>Keine Offerten gefunden.</div>
          ) : (
            <div>
              {filteredQuotes.map((quote, index) => {
                const client = clientMap.get(quote.client_id);
                const site = quote.client_site_id ? siteMap.get(quote.client_site_id) : undefined;

                return (
                  <a key={quote.id} href={`${baseUrl}/offerte/${quote.id}`} className="opc-quotes-row" style={{ ...rowStyle, borderBottom: index < filteredQuotes.length - 1 ? `1px solid ${OPC_BRAND.border}` : 'none' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={rowTitleStyle}>{quote.quote_number} · {quote.title}</div>
                      <div style={rowMetaStyle}>{getClientName(client)}{getSiteName(site) ? ` · ${getSiteName(site)}` : ''}</div>
                      <div style={rowSubStyle}>Erstellt am {formatDate(quote.issue_date || quote.created_at)}{quote.valid_until ? ` · gültig bis ${formatDate(quote.valid_until)}` : ''}</div>
                    </div>
                    <div style={moneyStyle}>{formatMoney(quote.total_chf)}</div>
                    <span style={badgeStyle}>{statusLabels[quote.status] || quote.status}</span>
                  </a>
                );
              })}
            </div>
          )}
        </OPCListCard>

        <style>{`${opcResponsiveStyle}
          @media (max-width: 760px) {
            .opc-mobile-page-header { flex-direction: column !important; align-items: stretch !important; }
            .opc-mobile-page-header a { width: 100% !important; }
            .opc-inspections-row, .opc-quotes-row { grid-template-columns: 1fr !important; gap: 10px !important; padding: 18px !important; align-items: start !important; }
          }
`}</style>
      </OPCPageShell>
    </MirakaDashboardShell>
  );
}

const pageHeaderStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 18, marginBottom: 24 };
const eyebrowStyle: CSSProperties = { margin: '0 0 8px', fontSize: 12, fontWeight: 780, letterSpacing: '0.08em', textTransform: 'uppercase', color: OPC_BRAND.faint };
const titleStyle: CSSProperties = { margin: 0, fontSize: 34, lineHeight: 1.05, letterSpacing: '-0.05em', fontWeight: 880, color: OPC_BRAND.text };
const subtitleStyle: CSSProperties = { margin: '10px 0 0', color: OPC_BRAND.muted, fontSize: 14, fontWeight: 620 };
const rowStyle: CSSProperties = { minHeight: 88, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 140px 160px', gap: 16, alignItems: 'center', padding: '18px 20px', textDecoration: 'none', color: OPC_BRAND.text };
const rowTitleStyle: CSSProperties = { fontSize: 15, fontWeight: 840, marginBottom: 6 };
const rowMetaStyle: CSSProperties = { fontSize: 13, color: OPC_BRAND.muted, fontWeight: 680, marginBottom: 5 };
const rowSubStyle: CSSProperties = { fontSize: 12, color: OPC_BRAND.faint, fontWeight: 620 };
const moneyStyle: CSSProperties = { fontSize: 14, fontWeight: 820, color: OPC_BRAND.text };
const badgeStyle: CSSProperties = { height: 32, padding: '0 12px', borderRadius: 999, border: `1px solid ${OPC_BRAND.border}`, background: '#F9FAFB', color: OPC_BRAND.muted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 760, whiteSpace: 'nowrap' };
const emptyStyle: CSSProperties = { padding: 32, textAlign: 'center', color: OPC_BRAND.muted, fontWeight: 680 };
const errorStyle: CSSProperties = { margin: 16, padding: 14, borderRadius: 14, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#991B1B', fontSize: 14, fontWeight: 700 };
