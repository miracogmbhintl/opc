import { useState, useEffect, useMemo } from 'react';
import { baseUrl } from '../lib/base-url';
import { supabase } from '../lib/supabase';
import MirakaDashboardShell from './MirakaDashboardShell';
import AdminProjectsList from './AdminProjectsList';
import { Plus } from 'lucide-react';

interface Project {
  id: string;
  project_title: string;
  category: string | null;
  status: 'active' | 'pending' | 'completed' | 'at_risk';
  deadline: string;
  progress_percent: number;
  client_id: string;
  client?: {
    id: string;
    company_name: string;
    client_name: string;
  };
}

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
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
          client:clients(id, company_name, client_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProjects(data as Project[] || []);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = useMemo(() => {
    if (!searchQuery) return projects;
    
    const query = searchQuery.toLowerCase();
    return projects.filter((project) => {
      return (
        project.project_title.toLowerCase().includes(query) ||
        project.client?.company_name?.toLowerCase().includes(query) ||
        project.category?.toLowerCase().includes(query)
      );
    });
  }, [projects, searchQuery]);

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, { bg: string; text: string }> = {
      'in_progress': { bg: '#DBEAFE', text: '#1E40AF' },
      'active': { bg: '#DCFCE7', text: '#166534' },
      'on_hold': { bg: '#FEF3C7', text: '#92400E' },
      'completed': { bg: '#DCFCE7', text: '#166534' }
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

  if (loading) {
    return null;
  }

  return (
    <MirakaDashboardShell hideTopBar={true}>
      <div style={{ 
        padding: '0',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
      }}>
        {/* Page Header with Search and Create Button */}
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
            onClick={() => window.location.href = `${baseUrl}/miraka-co-portal/create-project`}
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Create Project
          </button>
        </div>

        {/* Projects Card */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '14px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden'
        }}>
          {filteredProjects.length === 0 ? (
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
                  onClick={() => window.location.href = `${baseUrl}/miraka-co-portal/create-project`}
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Create Your First Project
                </button>
              )}
            </div>
          ) : (
            <div style={{ padding: '24px' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <th style={{
                      textAlign: 'left',
                      padding: '12px 16px 12px 0',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6B7280',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                    }}>
                      Project Title
                    </th>
                    <th style={{
                      textAlign: 'left',
                      padding: '12px 16px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6B7280',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                    }}>
                      Client
                    </th>
                    <th style={{
                      textAlign: 'left',
                      padding: '12px 16px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6B7280',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                    }}>
                      Category
                    </th>
                    <th style={{
                      textAlign: 'left',
                      padding: '12px 16px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6B7280',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                    }}>
                      Status
                    </th>
                    <th style={{
                      textAlign: 'left',
                      padding: '12px 16px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6B7280',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                    }}>
                      Progress
                    </th>
                    <th style={{
                      textAlign: 'left',
                      padding: '12px 0 12px 16px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6B7280',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                    }}>
                      Deadline
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project, index) => (
                    <tr 
                      key={project.id}
                      onClick={() => window.location.href = `${baseUrl}/miraka-co-portal/project/${project.id}`}
                      style={{ 
                        borderBottom: index < filteredProjects.length - 1 ? '1px solid #F9FAFB' : 'none',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{
                        padding: '16px 16px 16px 0',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#1A1A1A',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                      }}>
                        {project.project_title}
                      </td>
                      <td style={{
                        padding: '16px',
                        fontSize: '14px',
                        color: '#6B7280',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                      }}>
                        {project.client?.company_name || project.client?.client_name || '-'}
                      </td>
                      <td style={{
                        padding: '16px',
                        fontSize: '14px',
                        color: '#6B7280',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                      }}>
                        {project.category || '-'}
                      </td>
                      <td style={{ padding: '16px' }}>
                        {getStatusBadge(project.status)}
                      </td>
                      <td style={{
                        padding: '16px',
                        fontSize: '14px',
                        color: '#6B7280',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                      }}>
                        {project.progress_percent}%
                      </td>
                      <td style={{
                        padding: '16px 0 16px 16px',
                        fontSize: '14px',
                        color: '#6B7280',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
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
    </MirakaDashboardShell>
  );
}








