import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { baseUrl } from '../lib/base-url';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MessageSquare,
  QrCode,
  Search,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import {
  OPCPageShell,
  OPCTabs,
  OPCMetricsGrid,
  OPCMetricCard,
  OPCToolbar,
  OPCListCard,
  OPC_BRAND,
  OPC_PAGE_FONT,
  opcResponsiveStyle,
  opcSelectStyle,
  opcBlackButtonStyle,
} from './opc/OPCPageTop';

type Ticket = {
  id: string;
  ticket_number: string | null;
  source: string | null;
  status: string;
  priority: string;
  category: string | null;
  title: string | null;
  description: string | null;
  reporter_name: string | null;
  reporter_phone: string | null;
  reporter_email: string | null;
  client_id: string | null;
  site_id: string | null;
  facility_id: string | null;
  public_link_id: string | null;
  created_at: string;
  updated_at?: string | null;
  site_label: string;
  facility_label: string;
  media_count: number;
};

type ApiResponse = {
  ok: boolean;
  tickets?: Ticket[];
  error?: string;
};

type ActiveTab = 'tickets' | 'damages';
type StatusFilter = 'all' | 'open' | 'in_progress' | 'done';
type TypeFilter = 'all' | 'ticket' | 'qr_ticket' | 'damage';

type TicketItem = {
  id: string;
  type: 'ticket' | 'qr_ticket' | 'damage';
  status: string;
  statusGroup: 'open' | 'in_progress' | 'done';
  title: string;
  description: string;
  clientName: string;
  siteName: string;
  facilityName: string;
  createdAt: string;
  updatedAt: string;
  mediaCount: number;
  raw: Ticket;
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';

  try {
    return new Intl.DateTimeFormat('de-CH', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function normalizeStatus(status: string | null | undefined): TicketItem['statusGroup'] {
  const clean = String(status || '').toLowerCase().trim();

  if (clean === 'resolved' || clean === 'closed' || clean === 'done' || clean === 'completed') {
    return 'done';
  }

  if (clean === 'in_progress' || clean === 'in-progress' || clean === 'processing') {
    return 'in_progress';
  }

  return 'open';
}

function statusLabel(status: string | null | undefined) {
  const group = normalizeStatus(status);

  if (group === 'done') return 'Erledigt';
  if (group === 'in_progress') return 'In Bearbeitung';
  return 'Offen';
}

function categoryLabel(category: string | null) {
  if (category === 'damage') return 'Schaden';
  if (category === 'cleaning_needed') return 'Reinigungsbedarf';
  if (category === 'recleaning') return 'Nachreinigung';
  if (category === 'material_missing') return 'Material fehlt';
  if (category === 'complaint') return 'Beschwerde';
  if (category === 'praise') return 'Lob';
  if (category === 'other') return 'Sonstiges';
  return 'Allgemein';
}

function mapTicket(row: Ticket): TicketItem {
  const type: TicketItem['type'] =
    row.category === 'damage'
      ? 'damage'
      : row.source === 'public_qr'
        ? 'qr_ticket'
        : 'ticket';

  return {
    id: row.id,
    type,
    status: row.status || 'new',
    statusGroup: normalizeStatus(row.status),
    title:
      row.title ||
      (type === 'damage'
        ? 'Schaden'
        : type === 'qr_ticket'
          ? 'QR-Code Meldung'
          : 'Ticket'),
    description: row.description || categoryLabel(row.category),
    clientName: row.site_label || 'Ohne Kunde',
    siteName: row.site_label || 'Ohne Standort',
    facilityName: row.facility_label || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    mediaCount: row.media_count || 0,
    raw: row,
  };
}

function TypeBadge({ type }: { type: TicketItem['type'] }) {
  const label =
    type === 'damage' ? 'Schaden' : type === 'qr_ticket' ? 'QR-Code Meldung' : 'Ticket';

  const style: CSSProperties =
    type === 'damage'
      ? { background: '#FEF2F2', color: OPC_BRAND.red }
      : type === 'qr_ticket'
        ? { background: '#FFF7ED', color: OPC_BRAND.orange }
        : { background: '#F8FAFC', color: OPC_BRAND.muted };

  return (
    <span
      style={{
        minHeight: '30px',
        padding: '0 12px',
        borderRadius: '999px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 760,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {label}
    </span>
  );
}

function StatusBadge({ item }: { item: TicketItem }) {
  const style: CSSProperties =
    item.statusGroup === 'done'
      ? { background: '#DCFCE7', color: OPC_BRAND.green }
      : item.statusGroup === 'in_progress'
        ? { background: '#ECFEFF', color: OPC_BRAND.blue }
        : { background: '#F8FAFC', color: OPC_BRAND.muted };

  return (
    <span
      style={{
        minHeight: '30px',
        padding: '0 12px',
        borderRadius: '999px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 760,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {statusLabel(item.status)}
    </span>
  );
}

export default function TicketsOverviewPage() {
  const [items, setItems] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [activeTab, setActiveTab] = useState<ActiveTab>('tickets');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    try {
      setLoading(true);
      setErrorMessage('');

      const response = await fetch('/api/opc/tickets', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });

      const result = (await response.json()) as ApiResponse;

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Tickets & Schäden konnten nicht geladen werden.');
      }

      setItems((result.tickets || []).map(mapTicket));
    } catch (error: any) {
      setErrorMessage(error?.message || 'Tickets & Schäden konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  const metrics = useMemo(() => {
    const ticketItems = items.filter((item) => item.type === 'ticket' || item.type === 'qr_ticket');
    const damageItems = items.filter((item) => item.type === 'damage');

    return {
      ticketsOpen: ticketItems.filter((item) => item.statusGroup !== 'done').length,
      qrMessages: ticketItems.filter((item) => item.type === 'qr_ticket').length,
      damagesOpen: damageItems.filter((item) => item.statusGroup !== 'done').length,
      done: items.filter((item) => item.statusGroup === 'done').length,
    };
  }, [items]);

  const tabItems = useMemo(() => {
    return items.filter((item) => {
      if (activeTab === 'tickets') return item.type === 'ticket' || item.type === 'qr_ticket';
      return item.type === 'damage';
    });
  }, [activeTab, items]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return tabItems.filter((item) => {
      if (statusFilter !== 'all' && item.statusGroup !== statusFilter) return false;
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;

      if (!query) return true;

      return [
        item.title,
        item.description,
        item.clientName,
        item.siteName,
        item.facilityName,
        statusLabel(item.status),
        item.type,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [tabItems, searchQuery, statusFilter, typeFilter]);

  function openItem(item: TicketItem) {
    window.location.href = `${baseUrl}/anfragen-schaeden/${item.id}`;
  }

  if (loading) {
    return (
      <div style={loadingStyle}>
        <Loader2 size={20} className="spin" style={{ marginRight: 8 }} />
        Tickets & Schäden werden geladen...
        <style>{spinStyle}</style>
      </div>
    );
  }

  return (
    <OPCPageShell>
      <OPCTabs
        tabs={[
          {
            key: 'tickets',
            label: 'Tickets',
            active: activeTab === 'tickets',
            onClick: () => {
              setActiveTab('tickets');
              setTypeFilter('all');
            },
          },
          {
            key: 'damages',
            label: 'Schäden',
            active: activeTab === 'damages',
            onClick: () => {
              setActiveTab('damages');
              setTypeFilter('all');
            },
          },
        ]}
      />

      <OPCMetricsGrid>
        <OPCMetricCard value={metrics.ticketsOpen} label="Offene Tickets" icon={<MessageSquare size={18} />} />
        <OPCMetricCard value={metrics.qrMessages} label="QR-Code Meldungen" icon={<QrCode size={18} />} />
        <OPCMetricCard
          value={metrics.damagesOpen}
          label="Schäden offen"
          icon={<ShieldAlert size={18} />}
          tone={metrics.damagesOpen > 0 ? 'danger' : 'neutral'}
        />
        <OPCMetricCard value={metrics.done} label="Erledigt" icon={<CheckCircle2 size={18} />} tone="success" />
      </OPCMetricsGrid>

      <OPCToolbar columns="minmax(0, 1fr) 180px 190px 190px">
        <div style={{ position: 'relative', minWidth: 0 }}>
          <Search size={17} style={searchIconStyle} />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={
              activeTab === 'tickets'
                ? 'Suche nach Kunde, Standort, Ticket oder QR-Code'
                : 'Suche nach Kunde, Standort, Schaden oder Einsatz'
            }
            style={{ ...inputWithIconStyle }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          style={opcSelectStyle}
        >
          <option value="all">Alle Status</option>
          <option value="open">Offen</option>
          <option value="in_progress">In Bearbeitung</option>
          <option value="done">Erledigt</option>
        </select>

        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
          style={opcSelectStyle}
        >
          <option value="all">Alle Typen</option>
          {activeTab === 'tickets' ? (
            <>
              <option value="ticket">Tickets</option>
              <option value="qr_ticket">QR-Code Meldungen</option>
            </>
          ) : (
            <option value="damage">Schäden</option>
          )}
        </select>

        <a
          href={activeTab === 'tickets' ? `${baseUrl}/qr-codes` : `${baseUrl}/einsaetze`}
          style={opcBlackButtonStyle}
        >
          <Wrench size={17} />
          {activeTab === 'tickets' ? 'QR-Codes' : 'Zum Einsatz'}
        </a>
      </OPCToolbar>

      {errorMessage && <div style={errorStyle}>{errorMessage}</div>}

      <OPCListCard>
        {filteredItems.length === 0 ? (
          <div style={emptyStyle}>
            <CheckCircle2 size={24} />
            <strong>Keine Einträge vorhanden.</strong>
            <span>
              {activeTab === 'tickets'
                ? 'Neue Tickets und QR-Code Meldungen erscheinen hier.'
                : 'Schäden erscheinen hier.'}
            </span>
          </div>
        ) : (
          <>
            <div className="opc-requests-desktop-table">
              {filteredItems.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item)}
                  style={{
                    ...desktopRowStyle,
                    borderBottom: index < filteredItems.length - 1 ? '1px solid #F3F4F6' : 'none',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={rowTitleStyle}>{item.title}</div>
                    <div style={rowSubStyle}>{item.description}</div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={rowTitleStyle}>{item.clientName || 'Ohne Kunde'}</div>
                    <div style={rowSubStyle}>
                      {[item.siteName, item.facilityName].filter(Boolean).join(', ') || '-'}
                    </div>
                  </div>

                  <div>
                    <TypeBadge type={item.type} />
                  </div>

                  <div style={dateStyle}>{formatDate(item.updatedAt || item.createdAt)}</div>

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                    <StatusBadge item={item} />
                    <span style={openButtonStyle}>Öffnen</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="opc-requests-mobile-cards">
              {filteredItems.map((item) => (
                <div key={item.id} style={mobileCardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={rowTitleStyle}>{item.title}</div>
                      <div style={rowSubStyle}>{item.clientName}</div>
                    </div>
                    <StatusBadge item={item} />
                  </div>

                  <div style={{ display: 'grid', gap: 7, marginBottom: 12, color: OPC_BRAND.muted, fontSize: 13 }}>
                    <span>{[item.siteName, item.facilityName].filter(Boolean).join(', ') || '-'}</span>
                    <span>{item.description}</span>
                    <span>{formatDate(item.updatedAt || item.createdAt)}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <TypeBadge type={item.type} />
                    <button type="button" onClick={() => openItem(item)} style={smallOpenButtonStyle}>
                      Öffnen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </OPCListCard>

      <style>{`${opcResponsiveStyle}${spinStyle}`}</style>
    </OPCPageShell>
  );
}

const loadingStyle: CSSProperties = {
  minHeight: '60vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: OPC_BRAND.muted,
  fontSize: '14px',
  fontWeight: 650,
  fontFamily: OPC_PAGE_FONT,
};

const searchIconStyle: CSSProperties = {
  position: 'absolute',
  left: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  color: OPC_BRAND.faint,
  pointerEvents: 'none',
};

const inputWithIconStyle: CSSProperties = {
  width: '100%',
  height: '48px',
  padding: '0 14px 0 42px',
  borderRadius: '14px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  outline: 'none',
  fontSize: '14px',
  fontWeight: 560,
  fontFamily: OPC_PAGE_FONT,
  boxSizing: 'border-box',
};

const errorStyle: CSSProperties = {
  marginBottom: '22px',
  padding: '14px 16px',
  borderRadius: '14px',
  border: '1px solid #FCA5A5',
  background: '#FEF2F2',
  color: OPC_BRAND.red,
  fontSize: '14px',
  fontWeight: 620,
};

const emptyStyle: CSSProperties = {
  minHeight: '220px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  gap: '10px',
  padding: '34px',
  color: OPC_BRAND.muted,
  textAlign: 'center',
};

const desktopRowStyle: CSSProperties = {
  width: '100%',
  display: 'grid',
  gridTemplateColumns: 'minmax(260px, 1.15fr) minmax(230px, 1fr) 150px 140px 180px',
  alignItems: 'center',
  gap: '20px',
  padding: '20px 22px',
  border: 'none',
  background: '#FFFFFF',
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: OPC_PAGE_FONT,
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

const dateStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 760,
  color: OPC_BRAND.text,
  whiteSpace: 'nowrap',
};

const openButtonStyle: CSSProperties = {
  height: '34px',
  padding: '0 12px',
  borderRadius: '12px',
  background: OPC_BRAND.black,
  color: '#FFFFFF',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
  fontWeight: 760,
};

const smallOpenButtonStyle: CSSProperties = {
  height: '32px',
  padding: '0 12px',
  borderRadius: '999px',
  border: `1px solid ${OPC_BRAND.black}`,
  background: OPC_BRAND.black,
  color: '#FFFFFF',
  fontSize: '12px',
  fontWeight: 760,
  cursor: 'pointer',
};

const mobileCardStyle: CSSProperties = {
  width: '100%',
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: '18px',
  background: '#FFFFFF',
  padding: '16px',
  textAlign: 'left',
  fontFamily: OPC_PAGE_FONT,
};

const spinStyle = `
  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
