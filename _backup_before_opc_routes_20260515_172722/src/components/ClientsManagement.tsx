import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import { Plus, Search, FileText, X, Users, Mail, Phone, MapPin } from 'lucide-react';
import MirakaDashboardShell from './MirakaDashboardShell';
import MobileActionButton from './shared/MobileActionButton';

interface Client {
  id: string;
  client_name: string;
  company_name: string;
  email: string;
  phone?: string;
  status: string;
  created_at: string;
  address?: string;
  city?: string;
  active_site_count?: number;
}

type RawOpcClient = Record<string, any>;

const getFirstValue = (row: RawOpcClient, keys: string[], fallback = '') => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value);
    }
  }

  return fallback;
};

const mapOpcClientToClient = (row: RawOpcClient): Client => {
  const companyName = getFirstValue(row, [
    'company_name',
    'billing_name',
    'client_name',
    'primary_site_name',
    'full_name',
  ], 'Unbekannt');

  const contactName = getFirstValue(row, [
    'client_name',
    'full_name',
    'contact_person',
    'billing_name',
    'company_name',
  ], companyName);

  return {
    id: getFirstValue(row, ['client_id', 'id', 'contact_id']),
    client_name: contactName,
    company_name: companyName,
    email: getFirstValue(row, ['email', 'billing_email']),
    phone: getFirstValue(row, ['phone_e164', 'billing_phone_e164', 'phone_raw', 'phone']),
    status: getFirstValue(row, ['client_status', 'status', 'lifecycle_stage'], 'active'),
    created_at: getFirstValue(row, [
      'client_created_at',
      'created_at',
      'converted_at',
      'last_activity_at',
      'client_updated_at',
      'updated_at',
    ]),
    address: getFirstValue(row, ['primary_site_address', 'billing_address', 'address_text', 'address']),
    city: getFirstValue(row, ['primary_site_city', 'city']),
    active_site_count: Number(row?.active_site_count ?? 0),
  };
};

export default function ClientsManagement() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      setErrorMessage('');

      if (!supabase) {
        setErrorMessage('Datenbankverbindung nicht verfügbar. Bitte prüfen Sie die Supabase-Konfiguration.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('opc_portal_client_cards')
        .select('*');

      if (error) {
        console.error('OPC client cards error:', error);
        setErrorMessage(`Datenbankfehler: ${error.message}`);
        setLoading(false);
        return;
      }

      const mappedClients = (data || [])
        .map(mapOpcClientToClient)
        .filter((client) => client.id)
        .sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bTime - aTime;
        });

      setClients(mappedClients);
    } catch (err: any) {
      console.error('Exception loading OPC clients:', err);
      setErrorMessage(err.message || 'Kunden konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;

    const query = searchQuery.toLowerCase();

    return clients.filter((client) => {
      return (
        client.client_name?.toLowerCase().includes(query) ||
        client.company_name?.toLowerCase().includes(query) ||
        client.email?.toLowerCase().includes(query) ||
        client.phone?.toLowerCase().includes(query) ||
        client.address?.toLowerCase().includes(query) ||
        client.city?.toLowerCase().includes(query)
      );
    });
  }, [clients, searchQuery]);

  const handleClientClick = (clientId: string) => {
    window.location.href = `${baseUrl}/miraka-co-portal/client/${clientId}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleDateString('de-CH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const normalizedStatus = status || 'active';

    const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
      active: { label: 'Aktiv', bg: '#DCFCE7', text: '#166534' },
      client: { label: 'Kunde', bg: '#DCFCE7', text: '#166534' },
      pending: { label: 'Offen', bg: '#FEF3C7', text: '#92400E' },
      inactive: { label: 'Inaktiv', bg: '#E5E7EB', text: '#374151' },
      archived: { label: 'Archiviert', bg: '#E5E7EB', text: '#374151' },
    };

    const config = statusConfig[normalizedStatus] || {
      label: normalizedStatus,
      bg: '#F3F4F6',
      text: '#374151',
    };

    return (
      <span
        style={{
          display: 'inline-block',
          padding: '4px 12px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: 700,
          background: config.bg,
          color: config.text,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {config.label}
      </span>
    );
  };

  const getInitials = (name?: string) => {
    if (!name) return 'K';

    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('');
  };

  return (
    <MirakaDashboardShell hideTopBar={true}>
      {!mounted || loading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid #F3F4F6',
              borderTop: '3px solid #1A1A1A',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : (
        <div
          style={{
            padding: '0',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              width: '100%',
              gap: '16px',
              marginBottom: searchOpen ? '20px' : '24px',
            }}
          >
            <MobileActionButton
              icon={<FileText size={20} strokeWidth={2} />}
              onClick={() => window.location.href = `${baseUrl}/miraka-co-portal/clients/invoice`}
              ariaLabel="Rechnung"
            />

            <MobileActionButton
              icon={<Plus size={20} strokeWidth={2} />}
              onClick={() => window.location.href = `${baseUrl}/miraka-co-portal/create-client`}
              ariaLabel="Kunde anlegen"
            />

            <MobileActionButton
              icon={searchOpen ? <X size={20} strokeWidth={2} /> : <Search size={20} strokeWidth={2} />}
              onClick={() => setSearchOpen((prev) => !prev)}
              ariaLabel={searchOpen ? 'Suche schliessen' : 'Suchen'}
            />
          </div>

          {searchOpen && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                width: '100%',
                marginBottom: '24px',
              }}
            >
              <div style={{ width: '100%', position: 'relative' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#6B7280',
                    pointerEvents: 'none',
                  }}
                />

                <input
                  type="text"
                  placeholder="Kunden suchen..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  style={{
                    width: '100%',
                    height: '48px',
                    padding: '0 42px',
                    fontSize: '15px',
                    border: '1px solid #E6E6E6',
                    borderRadius: '16px',
                    background: '#FFFFFF',
                    color: '#2A2A2A',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
                    fontWeight: 500,
                  }}
                  onFocus={(event) => {
                    event.currentTarget.style.borderColor = '#1A1A1A';
                    event.currentTarget.style.background = '#FFFCF5';
                  }}
                  onBlur={(event) => {
                    event.currentTarget.style.borderColor = '#E6E6E6';
                    event.currentTarget.style.background = '#FFFFFF';
                  }}
                />
              </div>
            </div>
          )}

          {errorMessage && (
            <div
              style={{
                marginBottom: '24px',
                padding: '16px',
                background: '#FEE2E2',
                border: '1px solid #FCA5A5',
                borderRadius: '10px',
                color: '#991B1B',
                fontSize: '14px',
              }}
            >
              {errorMessage}
            </div>
          )}

          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '14px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden',
            }}
          >
            {filteredClients.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '80px 20px',
                }}
              >
                <Users size={64} strokeWidth={1.5} color="#D1D5DB" style={{ marginBottom: '24px' }} />

                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: '#1A1A1A',
                    margin: '0 0 8px',
                  }}
                >
                  {searchQuery ? 'Keine Kunden gefunden' : 'Noch keine Kunden vorhanden'}
                </h3>

                <p
                  style={{
                    fontSize: '14px',
                    color: '#6B7280',
                    margin: '0 0 24px',
                  }}
                >
                  {searchQuery ? 'Passen Sie die Suche an.' : 'Legen Sie den ersten Kunden an.'}
                </p>

                {!searchQuery && (
                  <button
                    onClick={() => window.location.href = `${baseUrl}/miraka-co-portal/create-client`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      background: '#1A1A1A',
                      color: '#FFFFFF',
                      fontSize: '14px',
                      fontWeight: 700,
                      borderRadius: '10px',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={16} />
                    Kunde anlegen
                  </button>
                )}
              </div>
            ) : (
              <>
                <div
                  className="clients-desktop-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '24px',
                    padding: '24px',
                  }}
                >
                  {filteredClients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => handleClientClick(client.id)}
                      className="client-card"
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #E5E7EB',
                        borderRadius: '20px',
                        padding: '24px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                      }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.transform = 'translateY(-2px)';
                        event.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.08)';
                        event.currentTarget.style.borderColor = '#1A1A1A';
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.transform = 'translateY(0)';
                        event.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)';
                        event.currentTarget.style.borderColor = '#E5E7EB';
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '16px',
                          marginBottom: '20px',
                        }}
                      >
                        <div
                          style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '16px',
                            background: '#1A1A1A',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px',
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {getInitials(client.company_name || client.client_name)}
                        </div>

                        {getStatusBadge(client.status)}
                      </div>

                      <h3
                        style={{
                          fontSize: '18px',
                          fontWeight: 800,
                          color: '#1A1A1A',
                          margin: '0 0 6px',
                          lineHeight: 1.2,
                        }}
                      >
                        {client.company_name || client.client_name}
                      </h3>

                      {client.client_name && client.client_name !== client.company_name && (
                        <p
                          style={{
                            fontSize: '14px',
                            color: '#6B7280',
                            margin: '0 0 14px',
                            fontWeight: 600,
                          }}
                        >
                          {client.client_name}
                        </p>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {client.email && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6B7280' }}>
                            <Mail size={14} />
                            <span>{client.email}</span>
                          </div>
                        )}

                        {client.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6B7280' }}>
                            <Phone size={14} />
                            <span>{client.phone}</span>
                          </div>
                        )}

                        {(client.address || client.city) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6B7280' }}>
                            <MapPin size={14} />
                            <span>
                              {[client.address, client.city].filter(Boolean).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          marginTop: '20px',
                          paddingTop: '16px',
                          borderTop: '1px solid #F3F4F6',
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '12px',
                          color: '#9CA3AF',
                          fontWeight: 600,
                        }}
                      >
                        <span>{client.active_site_count || 0} Standort(e)</span>
                        <span>{formatDate(client.created_at)}</span>
                      </div>
                    </button>
                  ))}
                </div>

                <div
                  className="clients-mobile-cards"
                  style={{
                    display: 'none',
                    padding: '16px',
                  }}
                >
                  {filteredClients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => handleClientClick(client.id)}
                      style={{
                        width: '100%',
                        background: '#FFFFFF',
                        border: '1px solid #E5E7EB',
                        borderRadius: '18px',
                        padding: '18px',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                        <div
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '14px',
                            background: '#1A1A1A',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '15px',
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {getInitials(client.company_name || client.client_name)}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3
                            style={{
                              fontSize: '16px',
                              fontWeight: 800,
                              color: '#1A1A1A',
                              margin: '0 0 6px',
                              lineHeight: 1.2,
                            }}
                          >
                            {client.company_name || client.client_name}
                          </h3>

                          <p
                            style={{
                              fontSize: '13px',
                              color: '#6B7280',
                              margin: '0 0 10px',
                            }}
                          >
                            {[client.city, client.phone || client.email].filter(Boolean).join(' • ') || 'Keine Kontaktdaten'}
                          </p>

                          {getStatusBadge(client.status)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    padding: '0 24px 24px',
                    fontSize: '14px',
                    color: '#6B7280',
                    fontWeight: 600,
                  }}
                >
                  {filteredClients.length} von {clients.length} Kunden
                </div>
              </>
            )}
          </div>

          <style>{`
            @media (max-width: 768px) {
              .clients-desktop-grid {
                display: none !important;
              }

              .clients-mobile-cards {
                display: flex !important;
                flex-direction: column;
                gap: 16px;
              }
            }
          `}</style>
        </div>
      )}
    </MirakaDashboardShell>
  );
}