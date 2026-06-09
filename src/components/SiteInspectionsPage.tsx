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
  OPC_PAGE_FONT,
  opcBlackButtonStyle,
  opcSecondaryButtonStyle,
  opcInputStyle,
  opcSelectStyle,
  opcResponsiveStyle,
} from './opc/OPCPageTop';
import { CalendarDays, ClipboardList, FileText, MapPin, Plus, Search, UserRound } from 'lucide-react';

type InspectionRow = {
  id: string;
  inspection_number: string;
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
  id: string;
  billing_name?: string | null;
  company_name?: string | null;
  full_name?: string | null;
};

type SiteMapRow = {
  id: string;
  site_name?: string | null;
  address_text?: string | null;
  postal_code?: string | null;
  city?: string | null;
};

type StatusFilter = 'all' | 'draft' | 'scheduled' | 'completed' | 'converted_to_quote';

const statusLabels: Record<string, string> = {
  draft: 'Entwurf',
  scheduled: 'Geplant',
  in_progress: 'In Arbeit',
  completed: 'Abgeschlossen',
  converted_to_quote: 'In Offerte übergeben',
  cancelled: 'Storniert',
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

function getClientName(client?: ClientMapRow) {
  if (!client) return 'Unbekannter Kunde';
  return client.billing_name || client.company_name || client.full_name || 'Unbekannter Kunde';
}

function buildSiteLine(site?: SiteMapRow) {
  if (!site) return 'Kein Standort verknüpft';
  const cityLine = [site.postal_code, site.city].filter(Boolean).join(' ');
  return [site.site_name, site.address_text, cityLine].filter(Boolean).join(' · ') || 'Standort';
}

export default function SiteInspectionsPage() {
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [clientMap, setClientMap] = useState<Map<string, ClientMapRow>>(new Map());
  const [siteMap, setSiteMap] = useState<Map<string, SiteMapRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
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

      const [clientsResponse, sitesResponse] = await Promise.all([
        clientIds.length
          ? supabase.from('opc_clients').select('id, billing_name, company_name, full_name').in('id', clientIds)
          : Promise.resolve({ data: [], error: null } as any),
        siteIds.length
          ? supabase.from('opc_client_sites').select('id, site_name, address_text, postal_code, city').in('id', siteIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (clientsResponse.error) console.warn('Clients konnten nicht geladen werden:', clientsResponse.error.message);
      if (sitesResponse.error) console.warn('Standorte konnten nicht geladen werden:', sitesResponse.error.message);

      setClientMap(new Map((clientsResponse.data || []).map((client: ClientMapRow) => [client.id, client])));
      setSiteMap(new Map((sitesResponse.data || []).map((site: SiteMapRow) => [site.id, site])));
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
        inspection.requested_service_category,
        inspection.property_type,
        getClientName(client),
        buildSiteLine(site),
      ].join(' '));

      return matchesStatus && (!query || haystack.includes(query));
    });
  }, [inspections, clientMap, siteMap, searchQuery, statusFilter]);

  const completedCount = inspections.filter((item) => item.status === 'completed').length;
  const quoteCount = inspections.filter((item) => item.status === 'converted_to_quote').length;
  const draftCount = inspections.filter((item) => ['draft', 'scheduled', 'in_progress'].includes(item.status)).length;

  return (
    <MirakaDashboardShell requiredRole={['owner', 'admin', 'dispatch']} currentPath="/besichtigungen" fullWidth hideTopBar>
      <OPCPageShell>
        <div style={pageHeaderStyle}>
          <div>
            <p style={eyebrowStyle}>Sales Pipeline</p>
            <h1 style={titleStyle}>Besichtigungen</h1>
            <p style={subtitleStyle}>Vor-Ort-Erfassung, Bilder und Übergabe in Offerten.</p>
          </div>

          <a href={`${baseUrl}/kunden`} style={{ ...opcSecondaryButtonStyle, width: 'auto' }}>
            <UserRound size={16} />
            Kunde auswählen
          </a>
        </div>

        <OPCMetricsGrid>
          <OPCMetricCard value={inspections.length} label="Besichtigungen" icon={<ClipboardList size={18} />} />
          <OPCMetricCard value={draftCount} label="Offen" icon={<CalendarDays size={18} />} tone="warning" />
          <OPCMetricCard value={completedCount} label="Abgeschlossen" icon={<MapPin size={18} />} tone="success" />
          <OPCMetricCard value={quoteCount} label="In Offerte" icon={<FileText size={18} />} />
        </OPCMetricsGrid>

        <OPCToolbar columns="minmax(0, 1fr) 210px auto">
          <div style={{ position: 'relative' }}>
            <Search size={17} style={{ position: 'absolute', left: 14, top: 15, color: OPC_BRAND.faint }} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Besichtigung, Kunde, Adresse suchen"
              style={{ ...opcInputStyle, paddingLeft: 42 }}
            />
          </div>

          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} style={opcSelectStyle}>
            <option value="all">Alle Status</option>
            <option value="draft">Entwurf</option>
            <option value="scheduled">Geplant</option>
            <option value="completed">Abgeschlossen</option>
            <option value="converted_to_quote">In Offerte übergeben</option>
          </select>

          <a href={`${baseUrl}/kunde-anlegen`} style={{ ...opcBlackButtonStyle, width: 'auto' }}>
            <Plus size={16} />
            Neuer Kunde
          </a>
        </OPCToolbar>

        <OPCListCard>
          {errorMessage && <div style={errorStyle}>{errorMessage}</div>}

          {loading ? (
            <div style={emptyStyle}>Besichtigungen werden geladen.</div>
          ) : filteredInspections.length === 0 ? (
            <div style={emptyStyle}>Keine Besichtigungen gefunden.</div>
          ) : (
            <div>
              {filteredInspections.map((inspection, index) => {
                const client = clientMap.get(inspection.client_id);
                const site = inspection.client_site_id ? siteMap.get(inspection.client_site_id) : undefined;

                return (
                  <a
                    key={inspection.id}
                    href={`${baseUrl}/besichtigung/${inspection.id}`}
                    style={{
                      ...rowStyle,
                      borderBottom: index < filteredInspections.length - 1 ? `1px solid ${OPC_BRAND.border}` : 'none',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={rowTitleStyle}>{inspection.inspection_number}</div>
                      <div style={rowMetaStyle}>{getClientName(client)} · {buildSiteLine(site)}</div>
                      <div style={rowSubStyle}>
                        {[inspection.requested_service_category, inspection.property_type, inspection.property_size_m2 ? `${inspection.property_size_m2} m²` : '', inspection.room_count ? `${inspection.room_count} Zimmer` : '']
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>

                    <div style={dateStyle}>{formatDate(inspection.completed_at || inspection.scheduled_at || inspection.created_at)}</div>
                    <span style={badgeStyle}>{statusLabels[inspection.status] || inspection.status}</span>
                  </a>
                );
              })}
            </div>
          )}
        </OPCListCard>

        <style>{opcResponsiveStyle}</style>
      </OPCPageShell>
    </MirakaDashboardShell>
  );
}

const pageHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  gap: 18,
  marginBottom: 24,
};

const eyebrowStyle: CSSProperties = {
  margin: '0 0 8px',
  fontSize: 12,
  fontWeight: 780,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: OPC_BRAND.faint,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1.05,
  letterSpacing: '-0.05em',
  fontWeight: 880,
  color: OPC_BRAND.text,
};

const subtitleStyle: CSSProperties = {
  margin: '10px 0 0',
  color: OPC_BRAND.muted,
  fontSize: 14,
  fontWeight: 620,
};

const rowStyle: CSSProperties = {
  minHeight: 92,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 140px 170px',
  gap: 16,
  alignItems: 'center',
  padding: '18px 20px',
  textDecoration: 'none',
  color: OPC_BRAND.text,
};

const rowTitleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 840,
  marginBottom: 6,
};

const rowMetaStyle: CSSProperties = {
  fontSize: 13,
  color: OPC_BRAND.muted,
  fontWeight: 680,
  marginBottom: 5,
};

const rowSubStyle: CSSProperties = {
  fontSize: 12,
  color: OPC_BRAND.faint,
  fontWeight: 620,
};

const dateStyle: CSSProperties = {
  fontSize: 13,
  color: OPC_BRAND.muted,
  fontWeight: 700,
};

const badgeStyle: CSSProperties = {
  height: 32,
  padding: '0 12px',
  borderRadius: 999,
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#F9FAFB',
  color: OPC_BRAND.muted,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 760,
  whiteSpace: 'nowrap',
};

const emptyStyle: CSSProperties = {
  padding: 32,
  textAlign: 'center',
  color: OPC_BRAND.muted,
  fontWeight: 680,
};

const errorStyle: CSSProperties = {
  margin: 16,
  padding: 14,
  borderRadius: 14,
  border: '1px solid #FCA5A5',
  background: '#FEF2F2',
  color: '#991B1B',
  fontSize: 14,
  fontWeight: 700,
};
