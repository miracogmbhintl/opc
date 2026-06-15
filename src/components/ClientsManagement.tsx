import { useEffect, useRef, useMemo, useState, type CSSProperties } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import { readOpcPageCache, writeOpcPageCache } from '../lib/opc-page-cache';
import { safeNavigate } from '../lib/opc-navigation-guard';
import {
  Building2,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  UserRound,
  Users,
} from 'lucide-react';
import MirakaDashboardShell from './MirakaDashboardShell';
import PortalSkeleton from './shared/PortalSkeleton';
import {
  OPCPageShell,
  OPCTabs,
  OPCMetricsGrid,
  OPCMetricCard,
  OPC_BRAND,
  OPC_PAGE_FONT,
  opcBlackButtonStyle,
  opcInputWithIconStyle,
  opcSearchIconStyle,
  opcSelectStyle,
  opcResponsiveStyle,
} from './opc/OPCPageTop';

interface Client {
  id: string;
  contact_id?: string;
  client_name: string;
  company_name: string;
  email: string;
  phone?: string;
  status: string;
  client_type: string;
  created_at: string;
  address?: string;
  city?: string;
  active_site_count?: number;
  portal_user_id?: string;
  portal_status?: string;
  can_access_portal: boolean;
}

type RawOpcClient = Record<string, any>;
type ActiveTab = 'all' | 'internal' | 'portal';
type ClientTypeFilter = 'all' | 'privatkunden' | 'geschaeftskunden' | 'baukunden' | 'unknown';
type SortOrder = 'name_asc' | 'name_desc' | 'oldest' | 'newest';

const CLIENTS_PAGE_CACHE_KEY = 'opc:page-cache:clients-management:v6-toolbar-tabs-fixed';

const clientTypeLabels: Record<string, string> = {
  privatkunden: 'Privatkunde',
  geschaeftskunden: 'Geschäftskunde',
  baukunden: 'Baukunde',
  unknown: 'Unbekannt',
};

function getFirstValue(row: RawOpcClient | undefined, keys: string[], fallback = '') {
  if (!row) return fallback;

  for (const key of keys) {
    const value = row?.[key];

    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value);
    }
  }

  return fallback;
}

function normalizeText(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function formatClientType(type?: string | null) {
  const normalized = normalizeText(type) || 'unknown';
  return clientTypeLabels[normalized] || normalized;
}

function isCorporateType(type?: string | null) {
  return normalizeText(type) === 'geschaeftskunden';
}

function mapOpcClientToClient(row: RawOpcClient, portalMap: Map<string, RawOpcClient>): Client {
  const id = getFirstValue(row, ['client_id', 'id', 'contact_id']);
  const contactId = getFirstValue(row, ['contact_id']);

  const companyName = getFirstValue(
    row,
    ['company_name', 'billing_name', 'client_name', 'primary_site_name', 'full_name'],
    'Unbekannt'
  );

  const contactName = getFirstValue(
    row,
    ['full_name', 'client_name', 'contact_person', 'billing_name', 'company_name'],
    companyName
  );

  const clientType = getFirstValue(row, ['client_type'], 'unknown');
  const portalUser = id ? portalMap.get(id) : undefined;
  const portalStatus = getFirstValue(portalUser || row, [
    'status',
    'portal_status',
    'client_user_status',
  ]);

  const portalCanAccess = Boolean(portalUser?.can_access_client_portal);
  const usablePortalStatus = ['active', 'invited'].includes(normalizeText(portalStatus));

  const hasPortalAccess =
    (Boolean(portalUser) && portalCanAccess && usablePortalStatus) ||
    Boolean(row?.can_access_portal) ||
    Boolean(row?.can_access_client_portal);

  return {
    id,
    contact_id: contactId,
    client_name: contactName,
    company_name: companyName,
    email: getFirstValue(row, ['email', 'billing_email']),
    phone: getFirstValue(row, ['phone_e164', 'billing_phone_e164', 'phone_raw', 'phone']),
    status: getFirstValue(row, ['client_status', 'status', 'lifecycle_stage'], 'active'),
    client_type: clientType,
    created_at: getFirstValue(row, [
      'client_created_at',
      'created_at',
      'converted_at',
      'last_activity_at',
      'client_updated_at',
      'updated_at',
    ]),
    address: getFirstValue(row, [
      'primary_site_address',
      'billing_address',
      'address_text',
      'address',
    ]),
    city: getFirstValue(row, ['primary_site_city', 'city']),
    active_site_count: Number(row?.active_site_count ?? 0),
    portal_user_id: getFirstValue(portalUser || row, ['id', 'portal_user_id', 'client_user_id']),
    portal_status: portalStatus,
    can_access_portal: hasPortalAccess,
  };
}

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeText(status) || 'active';

  const isActive = ['active', 'client'].includes(normalized);
  const isPending = ['pending', 'lead', 'inquiry', 'qualified'].includes(normalized);

  const style = isActive
    ? { bg: '#F0FDF4', text: OPC_BRAND.green, border: '#BBF7D0', label: 'Aktiv' }
    : isPending
      ? { bg: '#FFFBEB', text: OPC_BRAND.amber, border: '#FDE68A', label: 'Offen' }
      : {
          bg: '#F9FAFB',
          text: OPC_BRAND.muted,
          border: OPC_BRAND.border,
          label: status || 'Unbekannt',
        };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '30px',
        padding: '0 12px',
        borderRadius: '999px',
        border: `1px solid ${style.border}`,
        background: style.bg,
        color: style.text,
        fontSize: '12px',
        fontWeight: 760,
        whiteSpace: 'nowrap',
      }}
    >
      {style.label}
    </span>
  );
}

function PortalBadge({ client }: { client: Client }) {
  if (client.can_access_portal) {
    const label = normalizeText(client.portal_status) === 'invited' ? 'Einladung offen' : 'Portal aktiv';

    return (
      <span style={portalBadgeStyle}>
        <LockKeyhole size={13} />
        {label}
      </span>
    );
  }

  return (
    <span style={internalBadgeStyle}>
      <UserRound size={13} />
      Intern
    </span>
  );
}

function EmptyState({
  searchQuery,
  activeTab,
}: {
  searchQuery: string;
  activeTab: ActiveTab;
}) {
  const text =
    activeTab === 'portal'
      ? 'Es gibt aktuell keine Kunden mit Portalzugang.'
      : searchQuery
        ? 'Passen Sie die Suche oder Filter an.'
        : 'Legen Sie den ersten Kunden an.';

  return (
    <div style={emptyStateStyle}>
      <Users size={46} strokeWidth={1.5} color="#D1D5DB" style={{ marginBottom: '18px' }} />

      <h3 style={emptyTitleStyle}>Keine Kunden gefunden</h3>

      <p style={emptyTextStyle}>{text}</p>

      <a href={`${baseUrl}/kunde-anlegen`} data-astro-prefetch="false" style={{ ...opcBlackButtonStyle, width: 'auto' }}>
        <Plus size={17} />
        Kunde anlegen
      </a>
    </div>
  );
}

export default function ClientsManagement() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [clientTypeFilter, setClientTypeFilter] = useState<ClientTypeFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [grantingClientId, setGrantingClientId] = useState<string | null>(null);
  const didInitialClientsLoadRef = useRef(false);

  useEffect(() => {
    if (didInitialClientsLoadRef.current) return;
    didInitialClientsLoadRef.current = true;

    const cachedClients = readOpcPageCache<Client[]>(CLIENTS_PAGE_CACHE_KEY);

    if (cachedClients) {
      setClients(cachedClients);
      setLoading(false);
      void loadClients({ background: true });
      return;
    }

    void loadClients();
  }, []);

  async function loadClients(options: { background?: boolean } = {}) {
    const isBackground = Boolean(options.background);

    if (!isBackground) setLoading(true);
    setErrorMessage('');

    try {
      if (!supabase) {
        setErrorMessage('Datenbankverbindung nicht verfügbar. Bitte prüfen Sie die Supabase-Konfiguration.');
        return;
      }

      const [clientsResponse, portalUsersResponse] = await Promise.all([
        supabase.from('opc_portal_client_cards').select('*'),
        supabase.from('opc_client_users').select('*').limit(1000),
      ]);

      if (clientsResponse.error) throw clientsResponse.error;

      if (portalUsersResponse.error) {
        console.warn('Portal users could not be loaded:', portalUsersResponse.error.message);
      }

      const portalMap = new Map<string, RawOpcClient>();

      (portalUsersResponse.data || []).forEach((portalUser: RawOpcClient) => {
        if (portalUser.client_id) {
          portalMap.set(String(portalUser.client_id), portalUser);
        }
      });

      const mappedClients = (clientsResponse.data || [])
        .map((row: RawOpcClient) => mapOpcClientToClient(row, portalMap))
        .filter((client: Client) => client.id)
        .sort((a: Client, b: Client) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bTime - aTime;
        });

      setClients(mappedClients);
      writeOpcPageCache<Client[]>(CLIENTS_PAGE_CACHE_KEY, mappedClients);
    } catch (error: any) {
      console.error('Kunden konnten nicht geladen werden:', error);
      setErrorMessage(error?.message || 'Kunden konnten nicht geladen werden.');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }

  async function grantPortalAccess(client: Client) {
    setGrantingClientId(client.id);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/opc/grant-client-portal-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id }),
      });

      const result = (await response.json()) as any;

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Portalzugang konnte nicht freigeschaltet werden.');
      }

      setClients((previousClients) =>
        previousClients.map((existingClient) =>
          existingClient.id === client.id
            ? {
                ...existingClient,
                can_access_portal: true,
                portal_user_id: result.clientUserId,
                portal_status: result.status || 'invited',
                client_type: 'geschaeftskunden',
              }
            : existingClient
        )
      );

      setSuccessMessage('Portalzugang wurde freigeschaltet. Der Kunde ist jetzt unter Portal-Kunden sichtbar.');
    } catch (error: any) {
      console.error('Portalzugang konnte nicht freigeschaltet werden:', error);
      setErrorMessage(error?.message || 'Portalzugang konnte nicht freigeschaltet werden.');
    } finally {
      setGrantingClientId(null);
    }
  }

  const metrics = useMemo(() => {
    const portalClients = clients.filter((client) => client.can_access_portal);
    const internalClients = clients.filter((client) => !client.can_access_portal);
    const corporateClients = clients.filter((client) => isCorporateType(client.client_type));

    return {
      total: clients.length,
      portal: portalClients.length,
      internal: internalClients.length,
      corporate: corporateClients.length,
    };
  }, [clients]);

  const filteredClients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = clients.filter((client) => {
      const matchesTab =
        activeTab === 'all' ||
        (activeTab === 'portal' && client.can_access_portal) ||
        (activeTab === 'internal' && !client.can_access_portal);

      if (!matchesTab) return false;

      const matchesType =
        clientTypeFilter === 'all' || normalizeText(client.client_type) === clientTypeFilter;

      if (!matchesType) return false;

      if (!query) return true;

      return [
        client.client_name,
        client.company_name,
        client.email,
        client.phone,
        client.address,
        client.city,
        formatClientType(client.client_type),
        client.can_access_portal ? 'portal' : 'intern',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });

    return [...filtered].sort((a, b) => {
      const aName = (a.company_name || a.client_name || '').trim();
      const bName = (b.company_name || b.client_name || '').trim();

      if (sortOrder === 'name_asc') {
        return aName.localeCompare(bName, 'de-CH', { sensitivity: 'base' });
      }

      if (sortOrder === 'name_desc') {
        return bName.localeCompare(aName, 'de-CH', { sensitivity: 'base' });
      }

      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;

      if (sortOrder === 'oldest') {
        return aTime - bTime;
      }

      return bTime - aTime;
    });
  }, [clients, searchQuery, activeTab, clientTypeFilter, sortOrder]);

  function handleClientClick(clientId: string) {
    safeNavigate(`${baseUrl}/kunde/${clientId}`);
  }

  if (loading) {
    return (
      <MirakaDashboardShell hideTopBar={true} requiredRole={['owner', 'admin', 'dispatch']}>
        <PortalSkeleton variant="table" />
      </MirakaDashboardShell>
    );
  }

  return (
    <MirakaDashboardShell hideTopBar={true} requiredRole={['owner', 'admin', 'dispatch']}>
      <OPCPageShell>
        <div className="opc-clients-tabs-horizontal">
          <OPCTabs
            tabs={[
              {
                key: 'all',
                label: 'Alle Kunden',
                active: activeTab === 'all',
                onClick: () => setActiveTab('all'),
              },
              {
                key: 'internal',
                label: 'Kontakte',
                active: activeTab === 'internal',
                onClick: () => setActiveTab('internal'),
              },
              {
                key: 'portal',
                label: 'Portal',
                active: activeTab === 'portal',
                onClick: () => setActiveTab('portal'),
              },
            ]}
          />
        </div>

        <div className="opc-clients-metrics-2x2">
          <OPCMetricsGrid>
            <OPCMetricCard value={metrics.total} label="Alle Kunden" icon={<Users size={18} />} />
            <OPCMetricCard value={metrics.internal} label="Kontakte" icon={<UserRound size={18} />} />
            <OPCMetricCard value={metrics.portal} label="Portal-Kunden" icon={<LockKeyhole size={18} />} />
            <OPCMetricCard value={metrics.corporate} label="Geschäftskunden" icon={<Building2 size={18} />} />
          </OPCMetricsGrid>
        </div>

        <div style={clientsToolbarCardStyle}>
          <div className="opc-clients-toolbar-grid" style={clientsToolbarGridStyle}>
            <div className="opc-clients-toolbar-search" style={{ position: 'relative', minWidth: 0 }}>
              <Search size={17} style={opcSearchIconStyle} />

              <input
                type="text"
                placeholder="Suche nach Kunde, Kontakt, E-Mail, Telefon oder Standort"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                style={opcInputWithIconStyle}
              />
            </div>

            <select
              value={clientTypeFilter}
              onChange={(event) => setClientTypeFilter(event.target.value as ClientTypeFilter)}
              style={opcSelectStyle}
            >
              <option value="all">Alle Kundentypen</option>
              <option value="geschaeftskunden">Geschäftskunden</option>
              <option value="privatkunden">Privatkunden</option>
              <option value="baukunden">Baukunden</option>
              <option value="unknown">Unbekannt</option>
            </select>

            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as SortOrder)}
              style={opcSelectStyle}
            >
              <option value="name_asc">Name A bis Z</option>
              <option value="name_desc">Name Z bis A</option>
              <option value="oldest">Älteste zuerst</option>
              <option value="newest">Neueste zuerst</option>
            </select>

            <a
              className="opc-clients-toolbar-action"
              href={`${baseUrl}/kunde-anlegen`} data-astro-prefetch="false"
              style={{
                ...opcBlackButtonStyle,
                width: '100%',
              }}
            >
              <Plus size={17} />
              Kunde anlegen
            </a>
          </div>
        </div>

        {successMessage && <div style={successStyle}>{successMessage}</div>}
        {errorMessage && <div style={errorStyle}>{errorMessage}</div>}

        <div className="opc-clients-standalone-list" style={clientsListStyle}>
          {filteredClients.length === 0 ? (
            <EmptyState searchQuery={searchQuery} activeTab={activeTab} />
          ) : (
            <>
              <div className="opc-requests-desktop-table opc-clients-desktop-list" style={desktopListStyle}>
                {filteredClients.map((client) => (
                  <div
                    key={client.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClientClick(client.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleClientClick(client.id);
                    }}
                    style={desktopRowStyle}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={rowTitleStyle}>{client.company_name || client.client_name}</div>
                      <div style={rowSubStyle}>{client.client_name || '—'}</div>
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={rowTitleStyle}>
                        {client.email || client.phone || 'Keine Kontaktdaten'}
                      </div>
                      <div style={rowSubStyle}>{client.phone || client.email || '—'}</div>
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={rowTitleStyle}>
                        {[client.address, client.city].filter(Boolean).join(', ') || 'Kein Standort'}
                      </div>
                      <div style={rowSubStyle}>
                        {(client.active_site_count || 0) + ' Standort(e)'}
                      </div>
                    </div>

                    <div>
                      <PortalBadge client={client} />
                    </div>

                    <div>
                      <StatusBadge status={client.status} />
                    </div>

                    <div style={rowActionStyle}>
                      {!client.can_access_portal ? (
                        <button
                          type="button"
                          disabled={grantingClientId === client.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            void grantPortalAccess(client);
                          }}
                          style={{
                            ...smallBlackButtonStyle,
                            opacity: grantingClientId === client.id ? 0.65 : 1,
                          }}
                        >
                          <LockKeyhole size={14} />
                          Portal
                        </button>
                      ) : (
                        <span style={smallLightPillStyle}>Portal aktiv</span>
                      )}

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleClientClick(client.id);
                        }}
                        style={smallOpenButtonStyle}
                      >
                        Öffnen
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="opc-requests-mobile-cards opc-clients-mobile-list" style={mobileCardsListStyle}>
                {filteredClients.map((client) => (
                  <article key={client.id} style={mobileCardStyle}>
                    <div style={mobileTopStyle}>
                      <div>
                        <h3 style={mobileTitleStyle}>{client.company_name || client.client_name}</h3>
                        <p style={mobileSubStyle}>{client.client_name || '—'}</p>
                      </div>

                      <StatusBadge status={client.status} />
                    </div>

                    <div style={mobileInfoGridStyle}>
                      {client.email && (
                        <span>
                          <Mail size={14} />
                          {client.email}
                        </span>
                      )}

                      {client.phone && (
                        <span>
                          <Phone size={14} />
                          {client.phone}
                        </span>
                      )}

                      {(client.address || client.city) && (
                        <span>
                          <MapPin size={14} />
                          {[client.address, client.city].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>

                    <div style={mobileBottomStyle}>
                      <PortalBadge client={client} />

                      <button
                        type="button"
                        onClick={() => handleClientClick(client.id)}
                        style={smallOpenButtonStyle}
                      >
                        Öffnen
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>

        {filteredClients.length > 0 && (
          <div style={countStyle}>
            {filteredClients.length} von {clients.length} Kunden
          </div>
        )}

        <style>{`${opcResponsiveStyle}${clientsResponsiveStyle}`}</style>
      </OPCPageShell>
    </MirakaDashboardShell>
  );
}

const clientsToolbarCardStyle: CSSProperties = {
  width: '100%',
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: '22px',
  background: '#FFFFFF',
  padding: '22px',
  marginBottom: '28px',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
  boxSizing: 'border-box',
};

const clientsToolbarGridStyle: CSSProperties = {
  width: '100%',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 220px 220px 190px',
  gap: '14px',
  alignItems: 'center',
  boxSizing: 'border-box',
};

const successStyle: CSSProperties = {
  marginBottom: '22px',
  padding: '14px 16px',
  borderRadius: '14px',
  border: '1px solid #BBF7D0',
  background: '#F0FDF4',
  color: OPC_BRAND.green,
  fontSize: '14px',
  fontWeight: 650,
};

const errorStyle: CSSProperties = {
  marginBottom: '22px',
  padding: '14px 16px',
  borderRadius: '14px',
  border: '1px solid #FCA5A5',
  background: '#FEF2F2',
  color: '#991B1B',
  fontSize: '14px',
  fontWeight: 620,
};

const clientsListStyle: CSSProperties = {
  width: '100%',
  display: 'block',
  margin: 0,
  padding: 0,
};

const desktopListStyle: CSSProperties = {
  width: '100%',
  display: 'grid',
  gap: '14px',
  margin: 0,
  padding: 0,
};

const mobileCardsListStyle: CSSProperties = {
  width: '100%',
  display: 'none',
  gap: '14px',
  margin: 0,
  padding: 0,
};

const desktopRowStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  display: 'grid',
  gridTemplateColumns:
    'minmax(220px, 1.1fr) minmax(210px, 1fr) minmax(220px, 1fr) 130px 100px 170px',
  alignItems: 'center',
  gap: '18px',
  padding: '20px 22px',
  background: '#FFFFFF',
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: '18px',
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: OPC_PAGE_FONT,
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

const rowTitleStyle: CSSProperties = {
  fontSize: '15px',
  fontWeight: 800,
  color: OPC_BRAND.text,
  letterSpacing: '-0.015em',
  marginBottom: '7px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const rowSubStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: OPC_BRAND.muted,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const rowActionStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  justifyContent: 'flex-end',
  alignItems: 'center',
};

const smallBlackButtonStyle: CSSProperties = {
  height: '34px',
  padding: '0 12px',
  borderRadius: '12px',
  border: `1px solid ${OPC_BRAND.black}`,
  background: OPC_BRAND.black,
  color: '#FFFFFF',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '7px',
  fontSize: '12px',
  fontWeight: 760,
  fontFamily: OPC_PAGE_FONT,
  cursor: 'pointer',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
};

const smallOpenButtonStyle: CSSProperties = {
  height: '34px',
  padding: '0 12px',
  borderRadius: '12px',
  border: `1px solid ${OPC_BRAND.black}`,
  background: OPC_BRAND.black,
  color: '#FFFFFF',
  fontSize: '12px',
  fontWeight: 760,
  fontFamily: OPC_PAGE_FONT,
  cursor: 'pointer',
};

const smallLightPillStyle: CSSProperties = {
  height: '34px',
  padding: '0 12px',
  borderRadius: '12px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#F9FAFB',
  color: OPC_BRAND.muted,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
  fontWeight: 760,
  whiteSpace: 'nowrap',
};

const portalBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  height: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  border: `1px solid ${OPC_BRAND.borderStrong}`,
  background: '#F9FAFB',
  color: OPC_BRAND.black,
  fontSize: '12px',
  fontWeight: 760,
  whiteSpace: 'nowrap',
};

const internalBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  height: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.muted,
  fontSize: '12px',
  fontWeight: 760,
  whiteSpace: 'nowrap',
};

const mobileCardStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: '18px',
  background: '#FFFFFF',
  padding: '16px',
  textAlign: 'left',
  fontFamily: OPC_PAGE_FONT,
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

const mobileTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '14px',
};

const mobileTitleStyle: CSSProperties = {
  margin: '0 0 6px',
  fontSize: '16px',
  lineHeight: 1.25,
  fontWeight: 820,
  color: OPC_BRAND.text,
};

const mobileSubStyle: CSSProperties = {
  margin: 0,
  fontSize: '13px',
  fontWeight: 600,
  color: OPC_BRAND.muted,
};

const mobileInfoGridStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
  fontSize: '13px',
  fontWeight: 600,
  color: OPC_BRAND.muted,
  marginBottom: '14px',
};

const mobileBottomStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap',
};

const countStyle: CSSProperties = {
  marginTop: '15px',
  fontSize: '13px',
  fontWeight: 620,
  color: OPC_BRAND.muted,
};

const emptyStateStyle: CSSProperties = {
  padding: '78px 22px',
  textAlign: 'center',
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: '18px',
  background: '#FFFFFF',
};

const emptyTitleStyle: CSSProperties = {
  margin: '0 0 8px',
  fontSize: '17px',
  fontWeight: 760,
  color: OPC_BRAND.text,
};

const emptyTextStyle: CSSProperties = {
  margin: '0 0 22px',
  fontSize: '14px',
  fontWeight: 560,
  color: OPC_BRAND.muted,
};

const clientsResponsiveStyle = `
  .opc-clients-tabs-horizontal {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    width: 100% !important;
    gap: 12px !important;
    margin-bottom: 22px !important;
  }

  .opc-clients-tabs-horizontal > * {
    display: contents !important;
  }

  .opc-clients-tabs-horizontal button {
    width: 100% !important;
    min-width: 0 !important;
  }

  .opc-clients-metrics-2x2 .opc-time-metrics,
  .opc-clients-metrics-2x2 .opc-page-metrics,
  .opc-clients-metrics-2x2 .opc-metrics-grid,
  .opc-clients-metrics-2x2 > div {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 16px !important;
    width: 100% !important;
    margin-bottom: 22px !important;
  }

  .opc-clients-toolbar-grid select {
    min-width: 0 !important;
    width: 100% !important;
  }

  .opc-clients-standalone-list,
  .opc-clients-desktop-list,
  .opc-clients-mobile-list,
  .opc-requests-desktop-table,
  .opc-requests-mobile-cards {
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
    background: transparent !important;
    border: 0 !important;
    box-shadow: none !important;
  }

  .opc-clients-mobile-list > *,
  .opc-clients-desktop-list > * {
    width: 100% !important;
    box-sizing: border-box !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }

  @media (max-width: 960px) {
    .opc-requests-desktop-table {
      display: none !important;
    }

    .opc-requests-mobile-cards {
      display: grid !important;
      gap: 14px !important;
    }
  }

  @media (min-width: 961px) {
    .opc-requests-mobile-cards {
      display: none !important;
    }
  }

  @media (max-width: 680px) {
    .opc-clients-tabs-horizontal {
      display: grid !important;
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      width: 100% !important;
      gap: 8px !important;
      margin-bottom: 18px !important;
    }

    .opc-clients-tabs-horizontal > * {
      display: contents !important;
    }

    .opc-clients-tabs-horizontal button {
      width: 100% !important;
      min-width: 0 !important;
    }

    .opc-clients-toolbar-grid {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      width: 100% !important;
      gap: 12px !important;
    }

    .opc-clients-toolbar-search {
      grid-column: 1 / -1 !important;
    }

    .opc-clients-toolbar-action {
      grid-column: 1 / -1 !important;
      width: 100% !important;
    }

    .opc-clients-toolbar-grid select {
      grid-column: auto !important;
      width: 100% !important;
      min-width: 0 !important;
    }

    .opc-clients-metrics-2x2 .opc-time-metrics,
    .opc-clients-metrics-2x2 .opc-page-metrics,
    .opc-clients-metrics-2x2 .opc-metrics-grid,
    .opc-clients-metrics-2x2 > div {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 10px !important;
      margin-bottom: 18px !important;
    }
  }
`;