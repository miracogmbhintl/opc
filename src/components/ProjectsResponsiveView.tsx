import React, { useState, useEffect, useMemo } from 'react';
import { Pause, Plus, Search, X } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import '../styles/card-demo.css';

interface Project {
  id: string;
  project_title: string;
  category: string;
  status: string;
  progress: number;
  progress_percent?: number;
  client_id?: string;
  created_at?: string;
  deadline?: string;
  client?: {
    company_name?: string;
    client_name?: string;
  };
}

interface ProjectsResponsiveViewProps {
  baseUrl: string;
}

const ProjectsResponsiveView: React.FC<ProjectsResponsiveViewProps> = ({ baseUrl }) => {
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
          console.error('Supabase credentials not found');
          setLoading(false);
          return;
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        const { data, error } = await supabase
          .from('projects')
          .select(`
            id, 
            project_title, 
            category,
            status, 
            progress,
            progress_percent,
            client_id,
            created_at,
            deadline,
            clients (
              company_name,
              client_name
            )
          `)
          .order('deadline', { ascending: false, nullsFirst: false });

        if (error) {
          console.error('Error fetching projects:', error);
        } else {
          console.log('Raw project data:', data);
          // Map the nested client data
          const mappedData = (data || []).map(project => ({
            ...project,
            client: project.clients?.[0] || null
          }));
          setProjects(mappedData);
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const handleSearchToggle = () => {
    setIsSearchActive(!isSearchActive);
    if (isSearchActive) {
      setSearchQuery('');
    }
  };

  const handleAddProject = () => {
    window.location.href = `${baseUrl}/einsatz-planen`;
  };

  const filteredProjects = useMemo(() => {
    if (!searchQuery) return projects;
    
    const query = searchQuery.toLowerCase();
    return projects.filter((project) => {
      return (
        project.project_title.toLowerCase().includes(query) ||
        project.client?.company_name?.toLowerCase().includes(query) ||
        project.client?.client_name?.toLowerCase().includes(query) ||
        (project.category && project.category.toLowerCase().includes(query))
      );
    });
  }, [projects, searchQuery]);

  const getStatusDisplay = (status: string): 'Active' | 'Paused' | 'Inactive' => {
    if (status === 'active' || status === 'in_progress') return 'Active';
    if (status === 'paused' || status === 'on_hold') return 'Paused';
    return 'Inactive';
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, { bg: string; text: string }> = {
      'pending': { bg: '#DBEAFE', text: '#1E40AF' },
      'at_risk': { bg: '#FEF3C7', text: '#92400E' },
      'completed': { bg: '#DCFCE7', text: '#166534' },
      'active': { bg: '#DCFCE7', text: '#166534' },
      'in_progress': { bg: '#DCFCE7', text: '#166534' }
    };

    const colors = statusColors[status] || { bg: '#F3F4F6', text: '#6B7280' };
    const displayStatus = status.replace(/_/g, ' ');

    return (
      <span style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '13px',
        fontWeight: 500,
        background: colors.bg,
        color: colors.text,
        textTransform: 'capitalize'
      }}>
        {displayStatus}
      </span>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div style={{ 
      padding: '0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
    }}>
      {/* MOBILE VIEW - Card Layout */}
      <div className="mobile-only-view">
        <div className="card-demo-container">
          <div className="demo-section">
            <div className="demo-grid">
              {/* Action Card */}
              <div className="action-card">
                <div className={`action-buttons ${isSearchActive ? 'search-active' : ''}`}>
                  {!isSearchActive && (
                    <button 
                      className="action-btn add-btn"
                      onClick={handleAddProject}
                      aria-label="Add Project"
                    >
                      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </button>
                  )}

                  <div className={`search-container ${isSearchActive ? 'expanded' : ''}`}>
                    {isSearchActive && (
                      <input
                        type="text"
                        className="search-input"
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                      />
                    )}
                    <button 
                      className="action-btn search-btn"
                      onClick={handleSearchToggle}
                      aria-label={isSearchActive ? "Close Search" : "Search Projects"}
                    >
                      {isSearchActive ? (
                        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      ) : (
                        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="11" cy="11" r="8"/>
                          <path d="m21 21-4.35-4.35"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {searchQuery && (
              <div className="search-results">
                <p>Filtering for: <strong>{searchQuery}</strong> ({filteredProjects.length} results)</p>
              </div>
            )}
          </div>

          <div className="demo-section">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b6b6b' }}>
                Loading projects...
              </div>
            ) : filteredProjects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b6b6b' }}>
                {searchQuery ? 'No projects found matching your search.' : 'No projects available.'}
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
                            {statusDisplay === 'Active' && (
                              <div className="status-icon status-active" />
                            )}
                            {statusDisplay === 'Paused' && (
                              <Pause className="status-icon status-paused" size={14} />
                            )}
                            {statusDisplay === 'Inactive' && (
                              <div className="status-icon status-inactive" />
                            )}
                            <span>{statusDisplay}</span>
                          </div>
                        </div>
                      </div>

                      <div className="client-stats">
                        <div className="stat-item">
                          <h4 className="stat-label">Category</h4>
                          <h3 className="stat-value" style={{ fontSize: '16px' }}>
                            {project.category || 'No category'}
                          </h3>
                        </div>
                        <div className="stat-item">
                          <h4 className="stat-label">Progress</h4>
                          <h3 className="stat-value" style={{ fontSize: '16px' }}>
                            {project.progress_percent || project.progress || 0}%
                          </h3>
                        </div>
                      </div>

                      <div className="client-actions">
                        <a 
                          href={`${baseUrl}/einsatz/${project.id}`} 
                          className="button-secondary small"
                        >
                          View Details
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

      {/* DESKTOP VIEW - List/Table Layout */}
      <div className="desktop-only-view">
        {/* Page Header */}
        <div style={{ 
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px'
        }}>
          {/* Search Bar */}
          <input
            type="text"
            placeholder="Search projects..."
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
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
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

          {/* Create Project Button */}
          <button
            onClick={handleAddProject}
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
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#2A2A2A'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#1A1A1A'}
          >
            <Plus size={16} />
            Create Project
          </button>
        </div>

        {/* Projects Table */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #ECECEC',
          borderRadius: '16px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <div style={{ color: '#6B7280' }}>Loading projects...</div>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '80px 20px'
            }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" style={{ margin: '0 auto 24px' }}>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#1A1A1A',
                marginBottom: '8px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
              }}>
                {searchQuery ? 'No projects found' : 'No projects yet'}
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#6B7280',
                marginBottom: '24px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
              }}>
                {searchQuery ? 'Try adjusting your search' : 'Create your first project to get started'}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleAddProject}
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
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#2A2A2A'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#1A1A1A'}
                >
                  <Plus size={16} />
                  Create Your First Project
                </button>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '13px',
                fontFamily: "'Inter', sans-serif"
              }}>
                <thead>
                  <tr style={{
                    borderBottom: '1px solid #E3E6EA'
                  }}>
                    <th style={{
                      textAlign: 'left',
                      padding: '12px 16px',
                      fontWeight: 600,
                      color: '#6B7280'
                    }}>
                      Project Title
                    </th>
                    <th style={{
                      textAlign: 'left',
                      padding: '12px 16px',
                      fontWeight: 600,
                      color: '#6B7280'
                    }}>
                      Client
                    </th>
                    <th style={{
                      textAlign: 'left',
                      padding: '12px 16px',
                      fontWeight: 600,
                      color: '#6B7280'
                    }}>
                      Category
                    </th>
                    <th style={{
                      textAlign: 'left',
                      padding: '12px 16px',
                      fontWeight: 600,
                      color: '#6B7280'
                    }}>
                      Status
                    </th>
                    <th style={{
                      textAlign: 'left',
                      padding: '12px 16px',
                      fontWeight: 600,
                      color: '#6B7280'
                    }}>
                      Progress
                    </th>
                    <th style={{
                      textAlign: 'left',
                      padding: '12px 16px',
                      fontWeight: 600,
                      color: '#6B7280'
                    }}>
                      Deadline
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project, index) => (
                    <tr 
                      key={project.id}
                      onClick={() => window.location.href = `${baseUrl}/einsatz/${project.id}`}
                      style={{ 
                        borderBottom: index < filteredProjects.length - 1 ? '1px solid #E3E6EA' : 'none',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{
                        padding: '12px 16px',
                        color: '#111827',
                        fontWeight: 500
                      }}>
                        {project.project_title}
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        color: '#6B7280'
                      }}>
                        {project.client?.company_name || project.client?.client_name || '—'}
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        color: '#6B7280'
                      }}>
                        {project.category || '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {getStatusBadge(project.status)}
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        color: '#6B7280'
                      }}>
                        {project.progress_percent || project.progress || 0}%
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        color: '#6B7280'
                      }}>
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
          <div style={{
            marginTop: '16px',
            fontSize: '14px',
            color: '#6B7280',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
          }}>
            Showing {filteredProjects.length} of {projects.length} projects
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

export default ProjectsResponsiveView;




