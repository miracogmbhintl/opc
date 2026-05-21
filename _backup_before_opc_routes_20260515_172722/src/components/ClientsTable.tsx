import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Client {
  id: string;
  company_name: string;
  client_name: string;
  email: string;
  phone: string | null;
  status: 'active' | 'pending' | 'inactive';
  created_at: string;
}

interface ClientsTableProps {
  userRole?: string;
  baseUrl?: string;
}

export default function ClientsTable({ userRole = '', baseUrl = '' }: ClientsTableProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Check if user has access
  const hasAccess = userRole === 'owner' || userRole === 'admin';

  useEffect(() => {
    if (hasAccess) {
      loadClients();
    } else {
      setLoading(false);
    }
  }, [hasAccess]);

  useEffect(() => {
    // Filter clients based on search query
    if (searchQuery.trim() === '') {
      setFilteredClients(clients);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = clients.filter(client => 
        client.company_name?.toLowerCase().includes(query) ||
        client.client_name?.toLowerCase().includes(query) ||
        client.email?.toLowerCase().includes(query)
      );
      setFilteredClients(filtered);
    }
  }, [searchQuery, clients]);

  async function loadClients() {
    setLoading(true);
    setError(false);

    try {
      const { data, error: fetchError } = await supabase
        .from('clients')
        .select('id, company_name, client_name, email, phone, status, created_at')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching clients:', fetchError);
        setError(true);
      } else {
        setClients(data || []);
        setFilteredClients(data || []);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function toggleRowSelection(id: string) {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  }

  function handleRowClick(client: Client, e: React.MouseEvent) {
    // Prevent navigation when clicking on checkbox, button, or link
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' || 
      target.tagName === 'BUTTON' || 
      target.tagName === 'A' ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('a')
    ) {
      return;
    }

    // Navigate to client detail page
    window.location.href = `${baseUrl}/miraka-co-portal/client/${client.id}`;
  }

  function handleAction(action: string, client: Client) {
    console.log(`[${action}] on client`, client.id);
    
    if (action === 'view-details') {
      window.location.href = `${baseUrl}/miraka-co-portal/client/${client.id}`;
    } else if (action === 'edit-client') {
      window.location.href = `${baseUrl}/miraka-co-portal/client/${client.id}`;
    }
    
    setOpenDropdown(null);
  }

  function formatDate(dateString: string) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case 'active':
        return {
          backgroundColor: '#D1FAE5',
          color: '#059669',
          border: '1px solid #6EE7B7'
        };
      case 'pending':
        return {
          backgroundColor: '#FEF3C7',
          color: '#D97706',
          border: '1px solid #FCD34D'
        };
      case 'inactive':
        return {
          backgroundColor: '#F3F4F6',
          color: '#6B7280',
          border: '1px solid #D1D5DB'
        };
      default:
        return {
          backgroundColor: '#F3F4F6',
          color: '#6B7280',
          border: '1px solid #D1D5DB'
        };
    }
  }

  // Access restricted
  if (!hasAccess) {
    return (
      <div style={{
        padding: '40px 24px',
        textAlign: 'center',
        color: '#6B7280',
        fontSize: '14px'
      }}>
        Access restricted.
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div style={{
        padding: '40px 24px',
        textAlign: 'center',
        color: '#6B7280',
        fontSize: '14px'
      }}>
        Loading clients…
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{
        padding: '40px 24px',
        textAlign: 'center',
        color: '#6B7280',
        fontSize: '14px'
      }}>
        Unable to load client list.
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      backgroundColor: '#FFFFFF',
      border: '1px solid #ECECEC',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
    }}>
      {/* Header with Search */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 600,
          color: '#111827',
          margin: 0,
          fontFamily: "'Poppins', sans-serif"
        }}>
          Clients
        </h2>

        <input
          type="text"
          placeholder="Search clients…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: '8px 14px',
            fontSize: '14px',
            border: '1px solid #DADCE0',
            borderRadius: '8px',
            backgroundColor: '#FFFFFF',
            color: '#111827',
            outline: 'none',
            transition: 'border 0.15s ease',
            minWidth: '240px',
            fontFamily: "'Inter', sans-serif"
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#2A5F8A'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#DADCE0'}
        />
      </div>

      {/* No Results */}
      {filteredClients.length === 0 && !loading && (
        <div style={{
          padding: '40px 24px',
          textAlign: 'center',
          color: '#6B7280',
          fontSize: '14px',
          fontFamily: "'Inter', sans-serif"
        }}>
          No clients found for this search.
        </div>
      )}

      {/* Table */}
      {filteredClients.length > 0 && (
        <div style={{
          overflowX: 'auto'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
            fontFamily: "'Inter', sans-serif"
          }}>
            <thead>
              <tr style={{
                backgroundColor: '#FAFBFC',
                borderBottom: '1px solid #E3E6EA'
              }}>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: '#6B7280',
                  width: '40px'
                }}>
                  <input
                    type="checkbox"
                    style={{
                      width: '16px',
                      height: '16px',
                      cursor: 'pointer'
                    }}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRows(new Set(filteredClients.map(c => c.id)));
                      } else {
                        setSelectedRows(new Set());
                      }
                    }}
                    checked={selectedRows.size === filteredClients.length && filteredClients.length > 0}
                  />
                </th>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: '#6B7280'
                }}>
                  Company
                </th>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: '#6B7280'
                }}>
                  Contact Person
                </th>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: '#6B7280'
                }}>
                  Email
                </th>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: '#6B7280'
                }}
                className="hide-mobile-phone">
                  Phone
                </th>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: '#6B7280'
                }}>
                  Status
                </th>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: '#6B7280'
                }}
                className="hide-mobile-date">
                  Created
                </th>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'right',
                  fontWeight: 600,
                  color: '#6B7280',
                  width: '60px'
                }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr
                  key={client.id}
                  onClick={(e) => handleRowClick(client, e)}
                  style={{
                    borderBottom: '1px solid #E3E6EA',
                    transition: 'background 0.15s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#F9FAFB';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td style={{
                    padding: '12px 16px'
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedRows.has(client.id)}
                      onChange={() => toggleRowSelection(client.id)}
                      style={{
                        width: '16px',
                        height: '16px',
                        cursor: 'pointer'
                      }}
                    />
                  </td>
                  <td style={{
                    padding: '12px 16px',
                    color: '#111827',
                    fontWeight: 500
                  }}>
                    {client.company_name || '—'}
                  </td>
                  <td style={{
                    padding: '12px 16px',
                    color: '#111827'
                  }}>
                    {client.client_name || '—'}
                  </td>
                  <td style={{
                    padding: '12px 16px'
                  }}>
                    <a
                      href={`mailto:${client.email}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        color: '#2A5F8A',
                        textDecoration: 'none',
                        transition: 'color 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#1e4a64';
                        e.currentTarget.style.textDecoration = 'underline';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#2A5F8A';
                        e.currentTarget.style.textDecoration = 'none';
                      }}
                    >
                      {client.email}
                    </a>
                  </td>
                  <td style={{
                    padding: '12px 16px',
                    color: '#6B7280'
                  }}
                  className="hide-mobile-phone">
                    {client.phone || '—'}
                  </td>
                  <td style={{
                    padding: '12px 16px'
                  }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'capitalize',
                      ...getStatusStyle(client.status)
                    }}>
                      {client.status}
                    </span>
                  </td>
                  <td style={{
                    padding: '12px 16px',
                    color: '#6B7280'
                  }}
                  className="hide-mobile-date">
                    {formatDate(client.created_at)}
                  </td>
                  <td style={{
                    padding: '12px 16px',
                    textAlign: 'right',
                    position: 'relative'
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdown(openDropdown === client.id ? null : client.id);
                      }}
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        fontSize: '18px',
                        color: '#6B7280',
                        transition: 'color 0.15s ease',
                        lineHeight: 1
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#111827';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#6B7280';
                      }}
                    >
                      ⋯
                    </button>

                    {openDropdown === client.id && (
                      <>
                        <div
                          style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 999
                          }}
                          onClick={() => setOpenDropdown(null)}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            right: '0',
                            marginTop: '4px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #E3E6EA',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                            minWidth: '160px',
                            zIndex: 1000,
                            overflow: 'hidden'
                          }}
                        >
                          <button
                            onClick={() => handleAction('view-details', client)}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '10px 16px',
                              textAlign: 'left',
                              backgroundColor: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '13px',
                              color: '#111827',
                              transition: 'background 0.15s ease',
                              fontFamily: "'Inter', sans-serif"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#F9FAFB';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            View Details
                          </button>
                          <button
                            onClick={() => handleAction('edit-client', client)}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '10px 16px',
                              textAlign: 'left',
                              backgroundColor: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '13px',
                              color: '#111827',
                              transition: 'background 0.15s ease',
                              fontFamily: "'Inter', sans-serif"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#F9FAFB';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            Edit Client
                          </button>
                          <button
                            onClick={() => handleAction('archive-client', client)}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '10px 16px',
                              textAlign: 'left',
                              backgroundColor: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '13px',
                              color: '#111827',
                              transition: 'background 0.15s ease',
                              fontFamily: "'Inter', sans-serif"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#F9FAFB';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            Archive Client
                          </button>
                          <button
                            onClick={() => handleAction('delete-client', client)}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '10px 16px',
                              textAlign: 'left',
                              backgroundColor: 'transparent',
                              border: 'none',
                              borderTop: '1px solid #E3E6EA',
                              cursor: 'pointer',
                              fontSize: '13px',
                              color: '#DC2626',
                              transition: 'background 0.15s ease',
                              fontFamily: "'Inter', sans-serif"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#FEE2E2';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            Delete Client
                          </button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Responsive Styles */}
      <style>{`
        @media (max-width: 768px) {
          .hide-mobile-phone,
          .hide-mobile-date {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
