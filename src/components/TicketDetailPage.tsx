import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  ImageIcon,
  Loader2,
  QrCode,
  Save,
} from 'lucide-react';
import {
  OPCPageShell,
  OPCMetricsGrid,
  OPCMetricCard,
  OPCListCard,
  OPC_BRAND,
  OPC_PAGE_FONT,
  opcBlackButtonStyle,
  opcSecondaryButtonStyle,
  opcResponsiveStyle,
  opcSelectStyle,
  opcInputStyle,
} from './opc/OPCPageTop';

type Ticket = Record<string, any>;

type TicketMedia = {
  id: string;
  ticket_id: string;
  bucket_id: string | null;
  storage_path: string | null;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  created_at: string | null;
  display_url: string | null;
  signed_url: string | null;
  public_url: string | null;
};

type TicketEvent = {
  id: string;
  event_type: string | null;
  message: string | null;
  actor_type: string | null;
  actor_user_id?: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  old_status: string | null;
  new_status: string | null;
  visibility?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string | null;
};

type ApiResponse = {
  ok: boolean;
  ticket?: Ticket;
  media?: TicketMedia[];
  events?: TicketEvent[];
  error?: string;
};

type Props = {
  ticketId: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';

  try {
    return new Intl.DateTimeFormat('de-CH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function statusLabel(status: string | null | undefined) {
  if (status === 'new') return 'Neu';
  if (status === 'open') return 'Offen';
  if (status === 'in_progress' || status === 'in-progress') return 'In Bearbeitung';
  if (status === 'resolved') return 'Erledigt';
  if (status === 'closed') return 'Geschlossen';
  return status || 'Neu';
}

function priorityLabel(priority: string | null | undefined) {
  if (priority === 'low') return 'Niedrig';
  if (priority === 'normal') return 'Normal';
  if (priority === 'high') return 'Hoch';
  return priority || 'Normal';
}

function categoryLabel(category: string | null | undefined) {
  if (category === 'damage') return 'Schaden';
  if (category === 'cleaning_needed') return 'Reinigungsbedarf';
  if (category === 'recleaning') return 'Nachreinigung';
  if (category === 'material_missing') return 'Material fehlt';
  if (category === 'complaint') return 'Beschwerde';
  if (category === 'praise') return 'Lob';
  if (category === 'other') return 'Sonstiges';
  return 'Allgemein';
}

function sourceLabel(source: string | null | undefined) {
  if (source === 'public_qr') return 'QR-Code Meldung';
  if (source === 'portal') return 'Portal';
  if (source === 'manual') return 'Manuell';
  if (source === 'whatsapp') return 'WhatsApp';
  if (source === 'telegram') return 'Telegram';
  return source || 'Unbekannt';
}

function getFacilityLine(ticket: Ticket) {
  return [ticket.facility_name, ticket.floor, ticket.area_type].filter(Boolean).join(' · ');
}

function getAddressLine(ticket: Ticket) {
  return [ticket.address_text, ticket.postal_code, ticket.city, ticket.country].filter(Boolean).join(', ');
}

function eventActorLabel(event: TicketEvent) {
  if (event.actor_name) return event.actor_email ? `${event.actor_name} · ${event.actor_email}` : event.actor_name;

  const metaName = event.metadata?.actor_name;
  const metaEmail = event.metadata?.actor_email;

  if (metaName) return metaEmail ? `${metaName} · ${metaEmail}` : metaName;
  if (event.actor_type === 'public') return 'Öffentliche QR-Meldung';
  if (event.actor_type === 'staff') return 'Orange Pro Clean Team';

  return event.actor_type || 'System';
}

export default function TicketDetailPage({ ticketId }: Props) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [media, setMedia] = useState<TicketMedia[]>([]);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [status, setStatus] = useState('new');
  const [priority, setPriority] = useState('normal');
  const [category, setCategory] = useState('other');
  const [internalNote, setInternalNote] = useState('');

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  async function loadTicket() {
    try {
      setLoading(true);
      setErrorMessage('');

      const response = await fetch(`/api/opc/ticket-detail?id=${encodeURIComponent(ticketId)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });

      const result = (await response.json()) as ApiResponse;

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Ticket konnte nicht geladen werden.');
      }

      const loadedTicket = result.ticket || null;

      setTicket(loadedTicket);
      setMedia(result.media || []);
      setEvents(result.events || []);

      setStatus(loadedTicket?.status || 'new');
      setPriority(loadedTicket?.priority || 'normal');
      setCategory(loadedTicket?.category || 'other');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Ticket konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  async function updateTicket(next?: Partial<{ status: string; priority: string; category: string }>) {
    try {
      setSaving(true);
      setErrorMessage('');
      setSuccessMessage('');

      const payload = {
        id: ticketId,
        status: next?.status || status,
        priority: next?.priority || priority,
        category: next?.category || category,
        internal_note: internalNote,
      };

      const response = await fetch('/api/opc/ticket-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Ticket konnte nicht aktualisiert werden.');
      }

      setSuccessMessage('Ticket wurde aktualisiert.');
      setInternalNote('');
      await loadTicket();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Ticket konnte nicht aktualisiert werden.');
    } finally {
      setSaving(false);
    }
  }

  const facilityLine = useMemo(() => {
    if (!ticket) return '';
    return getFacilityLine(ticket);
  }, [ticket]);

  const addressLine = useMemo(() => {
    if (!ticket) return '';
    return getAddressLine(ticket);
  }, [ticket]);

  if (loading) {
    return (
      <div style={loadingStyle}>
        <Loader2 size={20} className="spin" style={{ marginRight: 8 }} />
        Ticket wird geladen...
        <style>{spinStyle}</style>
      </div>
    );
  }

  if (errorMessage && !ticket) {
    return (
      <OPCPageShell>
        <button type="button" onClick={() => window.history.back()} style={backButtonStyle}>
          <ArrowLeft size={17} />
          Zurück
        </button>

        <div style={errorStyle}>
          <AlertTriangle size={18} />
          {errorMessage}
        </div>
      </OPCPageShell>
    );
  }

  if (!ticket) return null;

  return (
    <OPCPageShell>
      <div style={topBarStyle}>
        <button type="button" onClick={() => window.history.back()} style={backButtonStyle}>
          <ArrowLeft size={17} />
          Zurück
        </button>

        <button type="button" onClick={loadTicket} style={{ ...opcSecondaryButtonStyle, width: 'auto' }}>
          Aktualisieren
        </button>
      </div>

      {errorMessage && <div style={errorStyle}>{errorMessage}</div>}
      {successMessage && <div style={successStyle}>{successMessage}</div>}

      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>{ticket.ticket_number || ticket.id}</div>
          <h1 style={titleStyle}>{ticket.title || categoryLabel(ticket.category)}</h1>
          <p style={subtitleStyle}>{ticket.description || 'Keine Beschreibung vorhanden.'}</p>
        </div>

        <div style={badgeWrapStyle}>
          <span style={badgeStyle}>{sourceLabel(ticket.source)}</span>
          <span style={badgeStyle}>{statusLabel(ticket.status)}</span>
          <span style={badgeStyle}>{priorityLabel(ticket.priority)}</span>
        </div>
      </section>

      <OPCMetricsGrid>
        <OPCMetricCard value={statusLabel(ticket.status)} label="Status" icon={<CheckCircle2 size={18} />} />
        <OPCMetricCard value={categoryLabel(ticket.category)} label="Kategorie" icon={<QrCode size={18} />} />
        <OPCMetricCard value={media.length} label="Bild(er)" icon={<ImageIcon size={18} />} />
        <OPCMetricCard value={formatDate(ticket.created_at)} label="Eingang" icon={<CalendarClock size={18} />} />
      </OPCMetricsGrid>

      <section style={actionCardStyle}>
        <div style={sectionHeaderStyle}>Bearbeitung</div>

        <div style={actionGridStyle}>
          <button
            type="button"
            disabled={saving}
            onClick={() => updateTicket({ status: 'in_progress' })}
            style={status === 'in_progress' ? activeActionButtonStyle : actionButtonStyle}
          >
            Übernehmen / In Bearbeitung
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => updateTicket({ status: 'resolved' })}
            style={status === 'resolved' ? activeActionButtonStyle : actionButtonStyle}
          >
            Als erledigt markieren
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => updateTicket({ status: 'new' })}
            style={status === 'new' ? activeActionButtonStyle : actionButtonStyle}
          >
            Wieder öffnen
          </button>
        </div>

        <div style={editGridStyle}>
          <label style={labelStyle}>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)} style={opcSelectStyle}>
              <option value="new">Neu</option>
              <option value="in_progress">In Bearbeitung</option>
              <option value="resolved">Erledigt</option>
              <option value="closed">Geschlossen</option>
            </select>
          </label>

          <label style={labelStyle}>
            Priorität
            <select value={priority} onChange={(event) => setPriority(event.target.value)} style={opcSelectStyle}>
              <option value="low">Niedrig</option>
              <option value="normal">Normal</option>
              <option value="high">Hoch</option>
            </select>
          </label>

          <label style={labelStyle}>
            Kategorie
            <select value={category} onChange={(event) => setCategory(event.target.value)} style={opcSelectStyle}>
              <option value="recleaning">Nachreinigung</option>
              <option value="cleaning_needed">Reinigungsbedarf</option>
              <option value="damage">Schaden</option>
              <option value="material_missing">Material fehlt</option>
              <option value="complaint">Beschwerde</option>
              <option value="praise">Lob</option>
              <option value="other">Sonstiges</option>
            </select>
          </label>
        </div>

        <div style={noteGridStyle}>
          <label style={labelStyle}>
            Interne Notiz
            <input
              value={internalNote}
              onChange={(event) => setInternalNote(event.target.value)}
              placeholder="Nur intern sichtbar. Beispiel: Mitarbeiter informiert, Nachreinigung geplant."
              style={opcInputStyle}
            />
          </label>

          <button
            type="button"
            disabled={saving}
            onClick={() => updateTicket()}
            style={{ ...opcBlackButtonStyle, width: 'auto', alignSelf: 'end' }}
          >
            {saving ? <Loader2 size={17} className="spin" /> : <Save size={17} />}
            Speichern
          </button>
        </div>
      </section>

      <div style={detailGridStyle}>
        <OPCListCard>
          <div style={sectionHeaderStyle}>Standort & Facility</div>

          <div style={infoGridStyle}>
            <InfoBlock label="Kunde" value={ticket.client_name || ticket.site_name || '—'} />
            <InfoBlock label="Standort" value={ticket.site_name || '—'} />
            <InfoBlock label="Adresse" value={addressLine || '—'} />
            <InfoBlock label="Facility" value={facilityLine || '—'} />
          </div>
        </OPCListCard>

        <OPCListCard>
          <div style={sectionHeaderStyle}>Meldende Person</div>

          <div style={infoGridStyle}>
            <InfoBlock label="Name" value={ticket.reporter_name || 'Nicht angegeben'} />
            <InfoBlock label="Telefon" value={ticket.reporter_phone || 'Nicht angegeben'} />
            <InfoBlock label="E-Mail" value={ticket.reporter_email || 'Nicht angegeben'} />
            <InfoBlock label="Quelle" value={sourceLabel(ticket.source)} />
          </div>
        </OPCListCard>
      </div>

      <section style={{ marginTop: 22 }}>
        <OPCListCard>
          <div style={sectionHeaderStyle}>Bilder</div>

          {media.length === 0 ? (
            <div style={emptyMediaStyle}>
              <ImageIcon size={22} />
              Keine Bilder vorhanden.
            </div>
          ) : (
            <div style={mediaGridStyle}>
              {media.map((item) => (
                <a key={item.id} href={item.display_url || '#'} target="_blank" rel="noreferrer" style={mediaCardStyle}>
                  {item.display_url ? (
                    <img src={item.display_url} alt={item.original_filename || 'Ticket Bild'} style={mediaImageStyle} />
                  ) : (
                    <div style={mediaPlaceholderStyle}>
                      <ImageIcon size={24} />
                    </div>
                  )}

                  <div style={mediaFooterStyle}>
                    <span style={mediaNameStyle}>{item.original_filename || 'Bild'}</span>
                    <span style={mediaActionStyle}>
                      Öffnen <ExternalLink size={13} />
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </OPCListCard>
      </section>

      <section style={{ marginTop: 22 }}>
        <OPCListCard>
          <div style={sectionHeaderStyle}>Interner Verlauf</div>

          {events.length === 0 ? (
            <div style={emptyMediaStyle}>
              <CalendarClock size={22} />
              Kein Verlauf vorhanden.
            </div>
          ) : (
            <div>
              {events.map((event, index) => (
                <div
                  key={event.id || index}
                  style={{
                    ...eventRowStyle,
                    borderBottom: index < events.length - 1 ? '1px solid #F3F4F6' : 'none',
                  }}
                >
                  <div>
                    <div style={eventTitleStyle}>{event.message || event.event_type || 'Ereignis'}</div>
                    <div style={eventMetaStyle}>
                      {eventActorLabel(event)} · {formatDate(event.created_at)}
                    </div>
                  </div>

                  {event.new_status ? <span style={badgeStyle}>{statusLabel(event.new_status)}</span> : null}
                </div>
              ))}
            </div>
          )}
        </OPCListCard>
      </section>

      <style>{`${opcResponsiveStyle}${spinStyle}`}</style>
    </OPCPageShell>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={infoLabelStyle}>{label}</div>
      <div style={infoValueStyle}>{value}</div>
    </div>
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

const topBarStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  marginBottom: 22,
};

const backButtonStyle: CSSProperties = {
  height: '42px',
  padding: '0 14px',
  borderRadius: '13px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontSize: '13px',
  fontWeight: 760,
  fontFamily: OPC_PAGE_FONT,
  cursor: 'pointer',
};

const heroStyle: CSSProperties = {
  background: '#FFFFFF',
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: '20px',
  padding: '22px',
  marginBottom: '22px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 18,
};

const eyebrowStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 820,
  color: OPC_BRAND.muted,
  marginBottom: 8,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '28px',
  lineHeight: 1.1,
  letterSpacing: '-0.04em',
  fontWeight: 860,
  color: OPC_BRAND.text,
};

const subtitleStyle: CSSProperties = {
  margin: '10px 0 0',
  fontSize: '14px',
  lineHeight: 1.55,
  color: OPC_BRAND.muted,
  fontWeight: 560,
};

const badgeWrapStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
};

const badgeStyle: CSSProperties = {
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#F8FAFC',
  color: OPC_BRAND.muted,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
  fontWeight: 760,
  whiteSpace: 'nowrap',
};

const actionCardStyle: CSSProperties = {
  background: '#FFFFFF',
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: '20px',
  marginBottom: 22,
  overflow: 'hidden',
};

const actionGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 12,
  padding: 20,
  borderBottom: '1px solid #F3F4F6',
};

const actionButtonStyle: CSSProperties = {
  height: 44,
  borderRadius: 14,
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  fontSize: 13,
  fontWeight: 760,
  cursor: 'pointer',
  fontFamily: OPC_PAGE_FONT,
};

const activeActionButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  background: OPC_BRAND.black,
  borderColor: OPC_BRAND.black,
  color: '#FFFFFF',
};

const editGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 14,
  padding: '20px 20px 0',
};

const noteGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: 14,
  padding: 20,
};

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  fontSize: 13,
  fontWeight: 760,
  color: OPC_BRAND.text,
};

const detailGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 22,
};

const sectionHeaderStyle: CSSProperties = {
  padding: '18px 20px',
  borderBottom: '1px solid #F3F4F6',
  fontSize: '15px',
  fontWeight: 820,
  color: OPC_BRAND.text,
};

const infoGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 18,
  padding: 20,
};

const infoLabelStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 760,
  color: OPC_BRAND.faint,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 7,
};

const infoValueStyle: CSSProperties = {
  fontSize: '14px',
  fontWeight: 720,
  color: OPC_BRAND.text,
  lineHeight: 1.35,
};

const mediaGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 14,
  padding: 20,
};

const mediaCardStyle: CSSProperties = {
  display: 'block',
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: 16,
  overflow: 'hidden',
  background: '#FFFFFF',
  color: 'inherit',
  textDecoration: 'none',
};

const mediaImageStyle: CSSProperties = {
  width: '100%',
  height: 180,
  objectFit: 'cover',
  display: 'block',
  background: '#F8FAFC',
};

const mediaPlaceholderStyle: CSSProperties = {
  width: '100%',
  height: 180,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#F8FAFC',
  color: OPC_BRAND.muted,
};

const mediaFooterStyle: CSSProperties = {
  padding: 12,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
};

const mediaNameStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: OPC_BRAND.text,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const mediaActionStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 760,
  color: OPC_BRAND.muted,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  whiteSpace: 'nowrap',
};

const emptyMediaStyle: CSSProperties = {
  minHeight: 150,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  color: OPC_BRAND.muted,
  fontSize: '14px',
  fontWeight: 700,
};

const eventRowStyle: CSSProperties = {
  padding: '16px 20px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
};

const eventTitleStyle: CSSProperties = {
  fontSize: '14px',
  fontWeight: 760,
  color: OPC_BRAND.text,
  marginBottom: 5,
};

const eventMetaStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 620,
  color: OPC_BRAND.muted,
};

const errorStyle: CSSProperties = {
  marginBottom: 22,
  padding: '14px 16px',
  borderRadius: '14px',
  border: '1px solid #FCA5A5',
  background: '#FEF2F2',
  color: '#991B1B',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: '14px',
  fontWeight: 700,
};

const successStyle: CSSProperties = {
  marginBottom: 22,
  padding: '14px 16px',
  borderRadius: '14px',
  border: '1px solid #BBF7D0',
  background: '#F0FDF4',
  color: OPC_BRAND.green,
  fontSize: '14px',
  fontWeight: 700,
};

const spinStyle = `
  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (max-width: 980px) {
    [style*="grid-template-columns: repeat(2"],
    [style*="grid-template-columns: repeat(3"],
    [style*="grid-template-columns: 1fr auto"] {
      grid-template-columns: 1fr !important;
    }
  }
`;
