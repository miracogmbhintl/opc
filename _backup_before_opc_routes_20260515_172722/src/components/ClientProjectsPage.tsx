import React, { useState, useEffect, useMemo } from 'react';
import { Pause, Plus, Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import '../styles/card-demo.css';
import MobileActionButton from './shared/MobileActionButton';

interface Project {
  id: string;
  project_title: string;
  category: string | null;
  status: 'active' | 'pending' | 'completed' | 'at_risk' | 'in_progress' | 'on_hold';
  deadline: string | null;
  progress_percent: number | null;
  client_id: string;
  created_at?: string;
}

interface ClientProjectsPageProps {
  baseUrl?: string;
}

const ClientProjectsPage: React.FC<ClientProjectsPageProps> = ({ baseUrl = '' }) => {
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      // Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('[ClientProjectsPage] No authenticated user');
        setLoading(false);
        return;
      }

      // Get client info for this user
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (clientError || !clientData) {
        console.error('[ClientProjectsPage] Client not found:', clientError);
        setLoading(false);
        return;
      }

      setClientId(clientData.id);

      // Get projects filtered by this client's ID
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          project_title,
          category,
          status,
          deadline,
          progress_percent,
          client_id,
          created_at
        `)
        .eq('client_id', clientData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProjects((data as Project[]) || []);
    } catch (error) {
      console.error('Failed to load client projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchToggle = () => {
    setIsSearchActive(!isSearchActive);
    if (isSearchActive) {
      setSearchQuery('');
    }
  };

  const handleRequestProject = () => {
    window.location.href = `${baseUrl}/miraka-co-portal/client/request-project`;
  };

  const filteredProjects = useMemo(() => {
    if (!searchQuery) return projects;

    const query = searchQuery.toLowerCase();
    return projects.filter((project) => {
      return (
        project.project_title?.toLowerCase().includes(query) ||
        project.category?.toLowerCase().includes(query) ||
        project.status?.toLowerCase().includes(query)
      );
    });
  }, [projects, searchQuery]);

  const getStatusDisplay = (status: string): 'Active' | 'Paused' | 'Inactive' => {
    if (status === 'active' || status === 'in_progress') return 'Aktiv';
    if (status === 'paused' || status === 'on_hold') return 'Pausiert';
    return 'Inaktiv';
  };

  const getStatusBadge = (status: string) => {
    const normalized = status?.toLowerCase() || 'pending';

    const statusColors: Record<string, { bg: string; text: string }> = {
      in_progress: { bg: '#DBEAFE', text: '#1E40AF' },
      active: { bg: '#DCFCE7', text: '#166534' },
      completed: { bg: '#DCFCE7', text: '#166534' },
      pending: { bg: '#FEF3C7', text: '#92400E' },
      on_hold: { bg: '#FEF3C7', text: '#92400E' },
      at_risk: { bg: '#FEE2E2', text: '#B91C1C' }
    };

    const colors = statusColors[normalized] || { bg: '#F3F4F6', text: '#6B7280' };
    const displayStatus = normalized.replace(/_/g, ' ');

    return (
      <span
        style={{
          display: 'inline-block',
          padding: '4px 12px',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: 500,
          background: colors.bg,
          color: colors.text,
          textTransform: 'capitalize'
        }}
      >
        {displayStatus}
      </span>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div
      style={{
        padding: '0',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
      }}
    >
      {/* MOBILE VIEW - Card Layout with Action Buttons */}
      <div className="mobile-only-view">
        {/* Top Action Buttons - Unified System */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '16px',
          width: '100%',
          marginBottom: isSearchActive ? '20px' : '24px',
          padding: '0 20px'
        }}>
          <MobileActionButton
            icon={<Plus size={20} strokeWidth={2} />}
            onClick={handleRequestProject}
            ariaLabel="Request Project"
          />

          <MobileActionButton
            icon={isSearchActive ? <X size={20} strokeWidth={2} /> : <Search size={20} strokeWidth={2} />}
            onClick={handleSearchToggle}
            ariaLabel={isSearchActive ? 'Close Search' : 'Search Projects'}
          />
        </div>

        {/* Search Field */}
        {isSearchActive && (
          <div style={{
            position: 'relative',
            marginBottom: '24px',
            padding: '0 20px'
          }}>
            <Search 
              size={16}
              style={{
                position: 'absolute',
                left: '34px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#6B7280',
                pointerEvents: 'none'
              }}
            />
            <input
              type="text"
              placeholder="Projekte suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
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
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
                fontWeight: 500
              }}
            />
          </div>
        )}

        {/* Search Results */}
        {searchQuery && (
          <div style={{
            padding: '16px 20px',
            marginBottom: '24px'
          }}>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: '#6B7280',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
            }}>
              Filtern nach: <strong style={{ color: '#1A1A1A' }}>{searchQuery}</strong> ({filteredProjects.length} Ergebnisse)
            </p>
          </div>
        )}

        {/* Project Cards - Keep existing card-demo-container */}
        <div className="card-demo-container">
          <div className="demo-section">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b6b6b' }}>
                Projekte werden geladen...
              </div>
            ) : filteredProjects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b6b6b' }}>
                {searchQuery ? 'Keine Projekte gefunden, die Ihrer Suche entsprechen.' : 'Keine Projekte verfügbar.'}
              </div>
            ) : (
              <div className="clients-grid">
                {filteredProjects.map((project) => {
                  const statusDisplay = getStatusDisplay(project.status);
                  const statusClass = statusDisplay.toLowerCase();

                  return (
                    <div key={project.id} className="card client-card">
                      <div className="client-header">
                        <div className="client-title">
                          <h2>{project.project_title}</h2>
                          <div className={`status-badge ${statusClass}`}>
                            {statusDisplay === 'Active' && <div className="status-icon status-active" />}
                            {statusDisplay === 'Paused' && (
                              <Pause className="status-icon status-paused" size={14} />
                            )}
                            {statusDisplay === 'Inactive' && <div className="status-icon status-inactive" />}
                            <span>{statusDisplay}</span>
                          </div>
                        </div>
                      </div>

                      <div className="client-stats">
                        <div className="stat-item">
                          <h4 className="stat-label">Kategorie</h4>
                          <h3 className="stat-value" style={{ fontSize: '16px' }}>
                            {project.category || 'Keine Kategorie'}
                          </h3>
                        </div>
                        <div className="stat-item">
                          <h4 className="stat-label">Fortschritt</h4>
                          <h3 className="stat-value" style={{ fontSize: '16px' }}>
                            {project.progress_percent || 0}%
                          </h3>
                        </div>
                      </div>

                      <div className="client-actions">
                        <a
                          href={`${baseUrl}/miraka-co-portal/project/${project.id}`}
                          className="button-secondary small"
                        >
                          Details anzeigen
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DESKTOP VIEW - Table Layout */}
      <div className="desktop-only-view">
        {/* Header with Search and Request Project Button */}
        <div
          style={{
            marginBottom: '32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          {/* Search Bar */}
          <input
            type="text"
            placeholder="Projekte suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: '1',
              maxWidth: '400px',
              height: '48px',
              padding: '0 14px',
              fontSize: '15px',
              border: '1px solid #E6E6E6',
              borderRadius: '16px',
              background: '#FFFFFF',
              color: '#2A2A2A',
              outline: 'none',
              transition: 'all 0.2s ease',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
              fontWeight: 500
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#1A1A1A';
              e.currentTarget.style.background = '#FFFCF5';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#E6E6E6';
              e.currentTarget.style.background = '#FFFFFF';
            }}
          />

          {/* Request Project Button */}
          <button
            onClick={handleRequestProject}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 20px',
              background: '#1A1A1A',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '10px',
              textDecoration: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.2s ease',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#2A2A2A')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#1A1A1A')}
          >
            <Plus size={16} />
            Neues Projekt anfordern
          </button>
        </div>

        {/* Projects Table */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '14px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <div style={{ color: '#6B7280' }}>Projekte werden geladen...</div>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '80px 20px'
              }}
            >
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#D1D5DB"
                strokeWidth="1.5"
                style={{ margin: '0 auto 24px' }}
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#1A1A1A',
                  marginBottom: '8px',
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                }}
              >
                {searchQuery ? 'Keine Projekte gefunden' : 'Noch keine Projekte'}
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: '#6B7280',
                  marginBottom: '24px',
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                }}
              >
                {searchQuery ? 'Versuchen Sie, Ihre Suche anzupassen' : 'Noch keine aktiven Projekte verfügbar'}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleRequestProject}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 20px',
                    background: '#1A1A1A',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontWeight: 500,
                    borderRadius: '10px',
                    textDecoration: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.2s ease',
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#2A2A2A')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#1A1A1A')}
                >
                  <Plus size={16} />
                  Ihr erstes Projekt anfordern
                </button>
              )}
            </div>
          ) : (
            <div style={{ padding: '24px' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse'
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '12px 16px 12px 0',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#6B7280',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                        fontFamily:
                          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                      }}
                    >
                      Projekttitel
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#6B7280',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                        fontFamily:
                          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                      }}
                    >
                      Kategorie
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#6B7280',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                        fontFamily:
                          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                      }}
                    >
                      Status
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#6B7280',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                        fontFamily:
                          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                      }}
                    >
                      Fortschritt
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '12px 0 12px 16px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#6B7280',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                        fontFamily:
                          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                      }}
                    >
                      Frist
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project, index) => (
                    <tr
                      key={project.id}
                      onClick={() => (window.location.href = `${baseUrl}/miraka-co-portal/project/${project.id}`)}
                      style={{
                        borderBottom: index < filteredProjects.length - 1 ? '1px solid #F9FAFB' : 'none',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td
                        style={{
                          padding: '16px 16px 16px 0',
                          fontSize: '14px',
                          fontWeight: 500,
                          color: '#1A1A1A',
                          fontFamily:
                            '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                        }}
                      >
                        {project.project_title}
                      </td>
                      <td
                        style={{
                          padding: '16px',
                          fontSize: '14px',
                          color: '#6B7280',
                          fontFamily:
                            '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                        }}
                      >
                        {project.category || '-'}
                      </td>
                      <td style={{ padding: '16px' }}>{getStatusBadge(project.status)}</td>
                      <td
                        style={{
                          padding: '16px',
                          fontSize: '14px',
                          color: '#6B7280',
                          fontFamily:
                            '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                        }}
                      >
                        {project.progress_percent ?? 0}%
                      </td>
                      <td
                        style={{
                          padding: '16px 0 16px 16px',
                          fontSize: '14px',
                          color: '#6B7280',
                          fontFamily:
                            '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                        }}
                      >
                        {formatDate(project.deadline)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Results Count */}
        {filteredProjects.length > 0 && (
          <div
            style={{
              marginTop: '16px',
              fontSize: '14px',
              color: '#6B7280',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
            }}
          >
            Zeige {filteredProjects.length} von {projects.length} Projekt{projects.length === 1 ? '' : 'en'}
          </div>
        )}
      </div>

      {/* Responsive CSS */}
      <style>{`
        .mobile-only-view {
          display: none;
        }

        .desktop-only-view {
          display: block;
        }

        @media (max-width: 768px) {
          .mobile-only-view {
            display: block;
          }

          .desktop-only-view {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

export default ClientProjectsPage;







