import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import MirakaDashboardShell from './MirakaDashboardShell';
import {
  OPCPageShell,
  OPC_BRAND,
  OPC_PAGE_FONT,
  opcBlackButtonStyle,
  opcSecondaryButtonStyle,
  opcResponsiveStyle,
} from './opc/OPCPageTop';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  MapPin,
  Plus,
  Search,
  UserRound,
} from 'lucide-react';

type InspectionRow = {
  id: string;
  inspection_number?: string | null;
  client_id: string;
  contact_id: string | null;
  client_site_id: string | null;
  inquiry_id: string | null;
  status: string;
  inspection_type: string;
  requested_service_category: string | null;
  property_type: string | null;
  property_size_m2: number | string | null;
  room_count: number | string | null;
  completed_at: string | null;
  scheduled_at: string | null;
  created_at: string;
};

type ClientMapRow = {
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

type SiteMapRow = {
  id: string;
  site_name?: string | null;
  address_text?: string | null;
  postal_code?: string | null;
  city?: string | null;
};

type StatusFilter = 'all' | 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'converted_to_quote' | 'cancelled';

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  black: '#0F1115',
  card: '#FFFFFF',
  soft: '#FAFAFA',
  red: '#B91C1C',
  green: '#166534',
  amber: '#92400E',
  blue: '#155E75',
};

const statusLabels: Record<string, string> = {
  draft: 'Entwurf',
  scheduled: 'Geplant',
  in_progress: 'In Arbeit',
  completed: 'Abgeschlossen',
  converted_to_quote: 'In Offerte übergeben',
  cancelled: 'Storniert',
};

const cardStyle: CSSProperties = {
  background: BRAND.card,
  border: `1px solid ${BRAND.border}`,
  borderRadius: '20px',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

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

function normalizeText(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function getClientKey(client: ClientMapRow) {
  return client.client_id || client.id || '';
}

function getClientName(client?: ClientMapRow) {
  if (!client) return 'Unbekannter Kunde';
  return client.billing_name || client.company_name || client.full_name || client.email || client.billing_email || 'Unbekannter Kunde';
}

function getClientNumber(client?: ClientMapRow, fallbackClientId?: string | null) {
  if (client?.client_number) return client.client_number;
  if (client?.customer_number) return client.customer_number;
  if (client?.kundennummer) return client.kundennummer;
  if (client?.client_code) return client.client_code;

  const id = fallbackClientId || client?.client_id || client?.id || '';

  if (!id) return 'Ohne Kundennummer';

  return `Kunde ${id.slice(0, 8).toUpperCase()}`;
}

function buildSiteLine(site?: SiteMapRow) {
  if (!site) return 'Kein Standort verknüpft';

  const cityLine = [site.postal_code, site.city].filter(Boolean).join(' ');

  return [site.site_name, site.address_text, cityLine].filter(Boolean).join(' · ') || 'Standort';
}

function buildInspectionDetails(inspection: InspectionRow) {
  return [
    inspection.requested_service_category,
    inspection.property_type,
    inspection.property_size_m2 ? `${inspection.property_size_m2} m²` : '',
    inspection.room_count ? `${inspection.room_count} Zimmer` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

function getStatusLabel(status?: string | null) {
  const key = String(status || '').trim();
  return statusLabels[key] || key || 'Unbekannt';
}

function getStatusTone(status?: string | null) {
  const normalized = normalizeText(status);

  if (normalized === 'completed') {
    return {
      bg: '#F3F4F6',
      text: BRAND.text,
      border: BRAND.border,
    };
  }

  if (normalized === 'converted_to_quote') {
    return {
      bg: '#F9FAFB',
      text: BRAND.text,
      border: BRAND.border,
    };
  }

  if (['draft', 'scheduled', 'in_progress'].includes(normalized)) {
    return {
      bg: '#FFFBEB',
      text: BRAND.amber,
      border: '#FDE68A',
    };
  }

  if (normalized === 'cancelled') {
    return {
      bg: '#FEF2F2',
      text: BRAND.red,
      border: '#FECACA',
    };
  }

  return {
    bg: '#F9FAFB',
    text: BRAND.muted,
    border: BRAND.border,
  };
}

function StatusBadge({ status }: { status: string }) {
  const tone = getStatusTone(status);

  return (
    <span
      className="opc-inspection-status-badge"
      style={{
        minHeight: '30px',
        minWidth: '132px',
        padding: '0 12px',
        borderRadius: 999,
        border: `1px solid ${tone.border}`,
        background: tone.bg,
        color: tone.text,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 780,
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
  value: number | string;
  label: string;
  icon: ReactNode;
  tone?: 'neutral' | 'warning' | 'success' | 'dark';
}) {
  const valueColor =
    tone === 'warning'
      ? BRAND.amber
      : tone === 'success'
        ? BRAND.green
        : tone === 'dark'
          ? BRAND.black
          : BRAND.text;

  return (
    <div className="opc-inspection-metric-card" style={cardStyle}>
      <div style={{ minWidth: 0 }}>
        <div className="opc-inspection-metric-value" style={{ color: valueColor }}>
          {value}
        </div>

        <div className="opc-inspection-metric-label">
          {label}
        </div>
      </div>

      <div className="opc-inspection-metric-icon">
        {icon}
      </div>
    </div>
  );
}

function InspectionCard({
  inspection,
  client,
  site,
}: {
  inspection: InspectionRow;
  client?: ClientMapRow;
  site?: SiteMapRow;
}) {
  const date = formatDate(inspection.completed_at || inspection.scheduled_at || inspection.created_at);
  const details = buildInspectionDetails(inspection);
  const clientName = getClientName(client);
  const siteLine = buildSiteLine(site);
  const clientNumber = getClientNumber(client, inspection.client_id);

  return (
    <article className="opc-inspection-card" style={cardStyle}>
      <a href={`${baseUrl}/besichtigung/${inspection.id}`} className="opc-inspection-card-link">
        <div className="opc-inspection-card-main">
          <div style={{ minWidth: 0 }}>
            <div className="opc-inspection-client-number">
              {clientNumber}
            </div>

            <h3>
              {clientName}
            </h3>

            <div className="opc-inspection-meta">
              <span>
                <MapPin size={14} />
                {siteLine}
              </span>

              {details ? (
                <span>
                  <Building2 size={14} />
                  {details}
                </span>
              ) : null}

              <span>
                <CalendarDays size={14} />
                {date}
              </span>
            </div>
          </div>

          <div className="opc-inspection-card-side">
            <StatusBadge status={inspection.status} />
            {inspection.inspection_number ? (
              <span>{inspection.inspection_number}</span>
            ) : null}
          </div>
        </div>
      </a>
    </article>
  );
}

export default function SiteInspectionsPage() {
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [clientMap, setClientMap] = useState<Map<string, ClientMapRow>>(new Map());
  const [siteMap, setSiteMap] = useState<Map<string, SiteMapRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const didLoadRef = useRef(false);

  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;

    void loadInspections();
  }, []);

  async function loadInspections() {
    setLoading(true);
    setErrorMessage('');

    try {
      if (!supabase) throw new Error('Supabase ist nicht verfügbar.');

      const { data, error } = await supabase
        .from('opc_site_inspections')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(250);

      if (error) throw error;

      const rows = (data || []) as InspectionRow[];

      setInspections(rows);

      const clientIds = Array.from(new Set(rows.map((row) => row.client_id).filter(Boolean)));
      const siteIds = Array.from(new Set(rows.map((row) => row.client_site_id).filter(Boolean))) as string[];

      let clientRows: ClientMapRow[] = [];
      let siteRows: SiteMapRow[] = [];

      if (clientIds.length) {
        const overviewResponse = await supabase
          .from('opc_client_overview')
          .select('*')
          .in('client_id', clientIds);

        if (!overviewResponse.error && Array.isArray(overviewResponse.data)) {
          clientRows = overviewResponse.data as ClientMapRow[];
        } else {
          const fallbackResponse = await supabase
            .from('opc_clients')
            .select('*')
            .in('id', clientIds);

          if (!fallbackResponse.error && Array.isArray(fallbackResponse.data)) {
            clientRows = fallbackResponse.data as ClientMapRow[];
          }
        }
      }

      if (siteIds.length) {
        const sitesResponse = await supabase
          .from('opc_client_sites')
          .select('*')
          .in('id', siteIds);

        if (!sitesResponse.error && Array.isArray(sitesResponse.data)) {
          siteRows = sitesResponse.data as SiteMapRow[];
        }
      }

      setClientMap(
        new Map(
          clientRows
            .map((client) => [getClientKey(client), client] as [string, ClientMapRow])
            .filter(([key]) => Boolean(key)),
        ),
      );

      setSiteMap(
        new Map(
          siteRows
            .map((site) => [site.id, site] as [string, SiteMapRow])
            .filter(([key]) => Boolean(key)),
        ),
      );
    } catch (error: any) {
      setErrorMessage(error?.message || 'Besichtigungen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  const filteredInspections = useMemo(() => {
    const query = normalizeText(searchQuery);

    return inspections.filter((inspection) => {
      const client = clientMap.get(inspection.client_id);
      const site = inspection.client_site_id ? siteMap.get(inspection.client_site_id) : undefined;

      const matchesStatus = statusFilter === 'all' || inspection.status === statusFilter;

      const haystack = normalizeText([
        inspection.inspection_number,
        getClientNumber(client, inspection.client_id),
        inspection.requested_service_category,
        inspection.property_type,
        getClientName(client),
        buildSiteLine(site),
      ].join(' '));

      return matchesStatus && (!query || haystack.includes(query));
    });
  }, [inspections, clientMap, siteMap, searchQuery, statusFilter]);

  const completedCount = useMemo(
    () => inspections.filter((item) => item.status === 'completed').length,
    [inspections],
  );

  const quoteCount = useMemo(
    () => inspections.filter((item) => item.status === 'converted_to_quote').length,
    [inspections],
  );

  const openCount = useMemo(
    () => inspections.filter((item) => ['draft', 'scheduled', 'in_progress'].includes(item.status)).length,
    [inspections],
  );

  return (
    <MirakaDashboardShell requiredRole={['owner', 'admin', 'dispatch']} currentPath="/besichtigungen" fullWidth hideTopBar>
      <OPCPageShell>
        <div className="opc-inspections-page" style={{ fontFamily: OPC_PAGE_FONT }}>
          <div className="opc-inspection-metrics">
            <MetricCard value={inspections.length} label="Besichtigungen" icon={<ClipboardList size={18} />} tone="dark" />
            <MetricCard value={openCount} label="Offen" icon={<CalendarDays size={18} />} tone="warning" />
            <MetricCard value={completedCount} label="Abgeschlossen" icon={<CheckCircle2 size={18} />} tone="success" />
            <MetricCard value={quoteCount} label="In Offerte" icon={<FileText size={18} />} />
          </div>

          <section className="opc-inspection-filter-panel" style={cardStyle}>
            <div className="opc-inspection-filter-actions">
              <a href={`${baseUrl}/kunden`} className="opc-filter-button light" data-astro-prefetch="false">
                <UserRound size={16} />
                Kunde auswählen
              </a>

              <a href={`${baseUrl}/kunde-anlegen`} className="opc-filter-button dark" data-astro-prefetch="false">
                <Plus size={16} />
                Neuer Kunde
              </a>
            </div>

            <div className="opc-inspection-search-row">
              <div className="opc-inspection-search">
                <Search size={17} />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Besichtigung, Kunde, Kundennummer, Adresse suchen"
                />
              </div>

              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Alle Status</option>
                <option value="draft">Entwurf</option>
                <option value="scheduled">Geplant</option>
                <option value="in_progress">In Arbeit</option>
                <option value="completed">Abgeschlossen</option>
                <option value="converted_to_quote">In Offerte übergeben</option>
                <option value="cancelled">Storniert</option>
              </select>
            </div>
          </section>

          {errorMessage ? <div className="opc-inspection-error">{errorMessage}</div> : null}

          {loading ? (
            <div className="opc-inspection-empty" style={cardStyle}>
              Besichtigungen werden geladen.
            </div>
          ) : filteredInspections.length === 0 ? (
            <div className="opc-inspection-empty" style={cardStyle}>
              Keine Besichtigungen gefunden.
            </div>
          ) : (
            <div className="opc-inspections-list">
              {filteredInspections.map((inspection) => {
                const client = clientMap.get(inspection.client_id);
                const site = inspection.client_site_id ? siteMap.get(inspection.client_site_id) : undefined;

                return (
                  <InspectionCard
                    key={inspection.id}
                    inspection={inspection}
                    client={client}
                    site={site}
                  />
                );
              })}
            </div>
          )}
        </div>

        <style>{`
          ${opcResponsiveStyle}

          .opc-inspections-page {
            padding: 0 0 140px;
            color: ${BRAND.text};
          }

          .opc-inspections-page * {
            box-sizing: border-box;
          }

          .opc-inspection-metrics {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 14px;
          }

          .opc-inspection-metric-card {
            min-height: 96px;
            padding: 18px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
          }

          .opc-inspection-metric-value {
            font-size: 25px;
            line-height: 1;
            font-weight: 820;
            letter-spacing: -0.04em;
            margin-bottom: 10px;
          }

          .opc-inspection-metric-label {
            font-size: 13px;
            font-weight: 720;
            color: ${BRAND.muted};
          }

          .opc-inspection-metric-icon {
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

          .opc-inspection-filter-panel {
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

          .opc-inspection-filter-actions {
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
            font-family: ${OPC_PAGE_FONT};
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

          .opc-inspection-search-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 220px);
            gap: 8px;
            align-items: stretch;
          }

          .opc-inspection-search {
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

          .opc-inspection-search input {
            width: 100%;
            min-width: 0;
            border: 0;
            outline: 0;
            color: ${BRAND.text};
            font-size: 14px;
            font-weight: 650;
            font-family: ${OPC_PAGE_FONT};
          }

          .opc-inspection-search-row select {
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
            font-family: ${OPC_PAGE_FONT};
            outline: 0;
          }

          .opc-inspection-error {
            border: 1px solid #FECACA;
            background: #FEF2F2;
            color: ${BRAND.red};
            padding: 14px 16px;
            border-radius: 16px;
            font-size: 13px;
            font-weight: 720;
            margin-bottom: 14px;
          }

          .opc-inspections-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .opc-inspection-card {
            padding: 0;
            overflow: hidden;
          }

          .opc-inspection-card-link {
            display: block;
            color: ${BRAND.text};
            text-decoration: none;
            padding: 18px;
          }

          .opc-inspection-card-main {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 18px;
            align-items: start;
          }

          .opc-inspection-client-number {
            margin-bottom: 6px;
            color: ${BRAND.muted};
            font-size: 12px;
            line-height: 1.2;
            font-weight: 820;
            text-transform: uppercase;
            letter-spacing: 0.02em;
          }

          .opc-inspection-card h3 {
            margin: 0;
            color: ${BRAND.text};
            font-size: 20px;
            line-height: 1.18;
            letter-spacing: -0.04em;
            font-weight: 860;
          }

          .opc-inspection-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 8px 14px;
            margin-top: 9px;
            color: ${BRAND.muted};
            font-size: 13px;
            line-height: 1.35;
            font-weight: 650;
          }

          .opc-inspection-meta span {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            max-width: 100%;
            min-width: 0;
            overflow-wrap: anywhere;
          }

          .opc-inspection-card-side {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 8px;
          }

          .opc-inspection-card-side > span {
            color: ${BRAND.muted};
            font-size: 12px;
            font-weight: 720;
            white-space: nowrap;
          }

          .opc-inspection-empty {
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
            .opc-inspections-page {
              padding-bottom: 110px;
            }

            .opc-inspection-metrics {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 10px;
            }

            .opc-inspection-metric-card {
              min-height: 86px;
              padding: 15px;
            }

            .opc-inspection-metric-value {
              font-size: 23px;
            }

            .opc-inspection-search-row {
              grid-template-columns: 1fr;
            }

            .opc-inspection-filter-actions {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .opc-filter-button {
              min-height: 46px;
              font-size: 12px;
              padding: 0 8px;
            }

            .opc-inspection-card-main {
              grid-template-columns: 1fr;
            }

            .opc-inspection-card-side {
              align-items: flex-start;
            }

            .opc-inspection-card-link {
              padding: 15px;
            }

            .opc-inspection-card h3 {
              font-size: 18px;
            }
          }
        `}</style>
      </OPCPageShell>
    </MirakaDashboardShell>
  );
}