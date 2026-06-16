import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import MirakaDashboardShell from './MirakaDashboardShell';
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

type StatusFilter =
  | 'all'
  | 'open'
  | 'draft'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'converted_to_quote'
  | 'cancelled';

type TypeFilter = 'all' | string;

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  black: '#0F1115',
  card: '#FFFFFF',
  red: '#B91C1C',
};

const statusLabels: Record<string, string> = {
  all: 'Alle Status',
  open: 'Offene Besichtigungen',
  draft: 'Entwurf',
  scheduled: 'Geplant',
  in_progress: 'In Arbeit',
  completed: 'Abgeschlossen',
  converted_to_quote: 'In Offerte übergeben',
  cancelled: 'Storniert',
};

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

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
  const key = normalizeText(status);
  return statusLabels[key] || key.replace(/_/g, ' ') || 'Unbekannt';
}

function isOpenInspection(status?: string | null) {
  return ['draft', 'scheduled', 'in_progress'].includes(normalizeText(status));
}

function getStatusTone(status?: string | null) {
  const normalized = normalizeText(status);

  if (normalized === 'cancelled') {
    return {
      bg: '#FEF2F2',
      text: BRAND.red,
      border: '#FECACA',
    };
  }

  if (normalized === 'completed' || normalized === 'converted_to_quote') {
    return {
      bg: '#F3F4F6',
      text: BRAND.text,
      border: BRAND.border,
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
}: {
  value: number | string;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <div
      className="opc-inspections-metric-card"
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
          className="opc-inspections-metric-value"
          style={{
            fontSize: '25px',
            lineHeight: 1,
            fontWeight: 820,
            letterSpacing: '-0.04em',
            color: BRAND.text,
            marginBottom: '10px',
          }}
        >
          {value}
        </div>

        <div
          className="opc-inspections-metric-label"
          style={{
            fontSize: '13px',
            fontWeight: 720,
            color: BRAND.muted,
          }}
        >
          {label}
        </div>
      </div>

      {icon ? (
        <div
          className="opc-inspections-metric-icon"
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
      ) : null}
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
      <div className="opc-inspection-card-main">
        <div style={{ minWidth: 0 }}>
          <h3>{clientName}</h3>

          <div className="opc-inspection-meta">
            <span>
              <UserRound size={14} />
              {clientNumber}
            </span>

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
          {inspection.inspection_number ? <span>{inspection.inspection_number}</span> : null}
        </div>
      </div>

      <div className="opc-inspection-card-actions">
        <a className="opc-inspection-action dark" href={`${baseUrl}/besichtigung/${inspection.id}`} data-astro-prefetch="false">
          Besichtigung öffnen
        </a>
      </div>
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
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
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

  const availableTypes = useMemo(() => {
    const types = Array.from(new Set(inspections.map((item) => item.inspection_type).filter(Boolean)));

    return types.sort((a, b) => String(a).localeCompare(String(b), 'de'));
  }, [inspections]);

  const filteredInspections = useMemo(() => {
    const query = normalizeText(searchQuery);

    return inspections.filter((inspection) => {
      const client = clientMap.get(inspection.client_id);
      const site = inspection.client_site_id ? siteMap.get(inspection.client_site_id) : undefined;

      const normalizedStatus = normalizeText(inspection.status);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'open' && isOpenInspection(inspection.status)) ||
        normalizedStatus === statusFilter;

      const matchesType = typeFilter === 'all' || normalizeText(inspection.inspection_type) === normalizeText(typeFilter);

      const haystack = normalizeText(
        [
          inspection.inspection_number,
          getClientNumber(client, inspection.client_id),
          inspection.inspection_type,
          inspection.requested_service_category,
          inspection.property_type,
          getClientName(client),
          buildSiteLine(site),
          getStatusLabel(inspection.status),
        ].join(' '),
      );

      return matchesStatus && matchesType && (!query || haystack.includes(query));
    });
  }, [inspections, clientMap, siteMap, searchQuery, statusFilter, typeFilter]);

  const completedCount = useMemo(
    () => inspections.filter((item) => normalizeText(item.status) === 'completed').length,
    [inspections],
  );

  const quoteCount = useMemo(
    () => inspections.filter((item) => normalizeText(item.status) === 'converted_to_quote').length,
    [inspections],
  );

  const openCount = useMemo(
    () => inspections.filter((item) => isOpenInspection(item.status)).length,
    [inspections],
  );

  if (loading) {
    return (
      <MirakaDashboardShell requiredRole={['owner', 'admin', 'dispatch']} currentPath="/besichtigungen" hideTopBar>
        <div
          style={{
            minHeight: '60vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: BRAND.muted,
            fontSize: '14px',
            fontWeight: 650,
            fontFamily: pageFont,
          }}
        >
          Besichtigungen werden geladen...
        </div>
      </MirakaDashboardShell>
    );
  }

  return (
    <MirakaDashboardShell requiredRole={['owner', 'admin', 'dispatch']} currentPath="/besichtigungen" hideTopBar>
      <div className="opc-inspections-page" style={{ fontFamily: pageFont, color: BRAND.text }}>
        {errorMessage ? <div className="opc-inspections-error">{errorMessage}</div> : null}

        <div className="opc-inspections-metrics">
          <MetricCard value={inspections.length} label="Besichtigungen" icon={<ClipboardList size={17} />} />
          <MetricCard value={openCount} label="Offen" icon={<CalendarDays size={17} />} />
          <MetricCard value={completedCount} label="Abgeschlossen" icon={<CheckCircle2 size={17} />} />
          <MetricCard value={quoteCount} label="In Offerte" icon={<FileText size={17} />} />
        </div>

        <section className="opc-inspections-filter-panel" style={cardStyle}>
          <div className="opc-inspections-search">
            <Search size={17} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Besichtigungen suchen..."
            />
          </div>

          <div className="opc-inspections-quick-buttons" aria-label="Besichtigungen filtern">
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
              className={statusFilter === 'completed' ? 'active' : ''}
              onClick={() => setStatusFilter('completed')}
            >
              Abgeschlossen
            </button>
          </div>

          <div className="opc-inspections-action-row">
            <a href={`${baseUrl}/kunden`} className="opc-inspections-panel-button" data-astro-prefetch="false">
              <UserRound size={15} />
              Kunde auswählen
            </a>

            <a href={`${baseUrl}/kunde-anlegen`} className="opc-inspections-panel-button dark" data-astro-prefetch="false">
              <Plus size={16} />
              Neuer Kunde
            </a>
          </div>

          <div className="opc-inspections-select-row">
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">Alle Besichtigungsarten</option>
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {type || 'Ohne Typ'}
                </option>
              ))}
            </select>

            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Alle Status</option>
              <option value="open">Offene Besichtigungen</option>
              <option value="draft">Entwurf</option>
              <option value="scheduled">Geplant</option>
              <option value="in_progress">In Arbeit</option>
              <option value="completed">Abgeschlossen</option>
              <option value="converted_to_quote">In Offerte übergeben</option>
              <option value="cancelled">Storniert</option>
            </select>
          </div>
        </section>

        {filteredInspections.length === 0 ? (
          <div className="opc-inspections-empty" style={cardStyle}>
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
        html,
        body {
          width: 100%;
          min-width: 0;
          min-height: 100%;
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

        .opc-inspections-page {
          width: 100%;
          max-width: none;
          min-width: 0;
          margin: 0;
          padding: 0 0 140px;
        }

        .opc-inspections-page * {
          box-sizing: border-box;
        }

        .opc-inspections-error {
          border: 1px solid #FECACA;
          background: #FEF2F2;
          color: ${BRAND.red};
          padding: 14px 16px;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 720;
          margin-bottom: 14px;
        }

        .opc-inspections-metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }

        .opc-inspections-filter-panel {
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

        .opc-inspections-search {
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

        .opc-inspections-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          color: ${BRAND.text};
          font-size: 14px;
          font-weight: 650;
          font-family: ${pageFont};
        }

        .opc-inspections-quick-buttons {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .opc-inspections-quick-buttons button {
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

        .opc-inspections-quick-buttons button.active {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-inspections-action-row {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          align-items: stretch;
        }

        .opc-inspections-panel-button,
        .opc-inspection-action {
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

        .opc-inspections-panel-button.dark,
        .opc-inspection-action.dark {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-inspections-select-row {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .opc-inspections-select-row select {
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

        .opc-inspections-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .opc-inspection-card {
          padding: 18px;
        }

        .opc-inspection-card-main {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 18px;
          align-items: start;
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

        .opc-inspection-card-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 16px;
        }

        .opc-inspection-action {
          width: auto;
          min-height: 42px;
          border-radius: 13px;
          padding: 0 14px;
          font-weight: 760;
        }

        .opc-inspections-empty {
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
          .opc-inspections-page {
            padding-bottom: 110px;
          }

          .opc-inspections-action-row,
          .opc-inspections-select-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .opc-inspections-panel-button {
            min-height: 46px;
            font-size: 12px;
            padding: 0 8px;
          }

          .opc-inspection-card-actions {
            flex-direction: column;
          }

          .opc-inspection-action {
            width: 100%;
          }

          .opc-inspection-card-main {
            grid-template-columns: 1fr;
          }

          .opc-inspection-card-side {
            align-items: flex-start;
          }

          .opc-inspection-card {
            padding: 15px;
          }

          .opc-inspection-card h3 {
            font-size: 18px;
          }
        }
      `}</style>
    </MirakaDashboardShell>
  );
}
