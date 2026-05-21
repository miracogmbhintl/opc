import { useEffect, useState } from 'react';
import { baseUrl } from '../lib/base-url';
import { supabase } from '../lib/supabase';
import { CheckCircle2, Clock, FileText, MessageSquare, AlertCircle, ArrowRight, ExternalLink, FolderOpen, Plus, Calendar } from 'lucide-react';
import PortalSkeleton from './shared/PortalSkeleton';

interface ProjectSummary {
  id: string;
  project_title: string;
  status: string;
  progress_percent: number;
  deadline: string;
  category?: string;
  updated_at?: string;
  client?: {
    company_name: string;
  };
}

interface FileItem {
  id: string;
  filename: string;
  uploaded_at: string;
  project_id?: string;
  project?: {
    project_title: string;
  };
}

interface Ticket {
  id: string;
  ticket_title: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  category: string;
  created_at: string;
  message: string;
}

interface DashboardStats {
  activeProjects: number;
  totalFiles: number;
  openTickets: number;
  completedProjects: number;
  pendingApprovals: number;
  unreadMessages: number;
  newFiles: number;
}

export default function ClientDashboardHome() {
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0,
    totalFiles: 0,
    openTickets: 0,
    completedProjects: 0,
    pendingApprovals: 0,
    unreadMessages: 0,
    newFiles: 0
  });
  const [featuredProject, setFeaturedProject] = useState<ProjectSummary | null>(null);
  const [recentProjects, setRecentProjects] = useState<ProjectSummary[]>([]);
  const [recentFiles, setRecentFiles] = useState<FileItem[]>([]);
  const [openTickets, setOpenTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('[ClientDashboard] No authenticated user');
        setLoading(false);
        return;
      }

      // Get client info
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, company_name')
        .eq('user_id', user.id)
        .single();

      if (clientError || !clientData) {
        console.error('[ClientDashboard] Client not found:', clientError);
        setLoading(false);
        return;
      }

      setClientId(clientData.id);

      // Get all projects
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('client_id', clientData.id)
        .order('updated_at', { ascending: false });

      if (projectsError) throw projectsError;

      const activeProjects = projects?.filter(p => p.status !== 'completed') || [];
      const completedProjects = projects?.filter(p => p.status === 'completed') || [];

      // Set featured project (first active, or last completed)
      if (activeProjects.length > 0) {
        setFeaturedProject(activeProjects[0]);
      } else if (completedProjects.length > 0) {
        setFeaturedProject(completedProjects[0]);
      }

      // Set recent projects (all projects for display)
      setRecentProjects(projects || []);

      // Get files count
      const { count: filesCount } = await supabase
        .from('project_files')
        .select('*', { count: 'exact', head: true })
        .in('project_id', (projects || []).map(p => p.id));

      // Get recent files (last 5)
      const { data: filesData } = await supabase
        .from('project_files')
        .select(`
          id,
          filename,
          uploaded_at,
          project_id,
          type
        `)
        .in('project_id', (projects || []).map(p => p.id))
        .neq('type', 'folder')
        .order('uploaded_at', { ascending: false })
        .limit(5);

      // Enrich files with project names
      const enrichedFiles = await Promise.all(
        (filesData || []).map(async (file) => {
          if (file.project_id) {
            const project = projects?.find(p => p.id === file.project_id);
            return {
              ...file,
              project: project ? { project_title: project.project_title } : undefined
            };
          }
          return file;
        })
      );

      setRecentFiles(enrichedFiles);

      // Get open tickets count
      const { count: ticketsCount } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientData.id)
        .in('status', ['open', 'in_progress']);

      // Get open tickets data
      const { data: ticketsData } = await supabase
        .from('tickets')
        .select('id, ticket_title, status, category, created_at, message')
        .eq('client_id', clientData.id)
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(5);

      setOpenTickets(ticketsData || []);

      // Calculate new files (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const newFilesCount = enrichedFiles.filter(f => 
        new Date(f.uploaded_at) > sevenDaysAgo
      ).length;

      // Get pending approvals count (projects with status 'approval')
      const pendingApprovals = projects?.filter(p => p.status === 'approval').length || 0;

      setStats({
        activeProjects: activeProjects.length,
        totalFiles: filesCount || 0,
        openTickets: ticketsCount || 0,
        completedProjects: completedProjects.length,
        pendingApprovals,
        unreadMessages: ticketsCount || 0, // Using tickets as proxy
        newFiles: newFilesCount
      });

      setLoading(false);
    } catch (error) {
      console.error('[ClientDashboard] Error loading data:', error);
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Frist überschritten';
    if (diffDays === 0) return 'Heute fällig';
    if (diffDays === 1) return 'Morgen fällig';
    if (diffDays <= 7) return `Fällig in ${diffDays} Tagen`;
    
    return `Fällig am ${date.toLocaleDateString('de-DE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })}`;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `vor ${diffMins}m`;
    if (diffHours < 24) return `vor ${diffHours}h`;
    if (diffDays < 7) return `vor ${diffDays}T`;
    
    return date.toLocaleDateString('de-DE', { month: 'short', day: 'numeric' });
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { bg: string; text: string; label: string }> = {
      'active': { bg: '#DCFCE7', text: '#166534', label: 'Aktiv' },
      'pending': { bg: '#DBEAFE', text: '#1E40AF', label: 'Ausstehend' },
      'at_risk': { bg: '#FEF3C7', text: '#92400E', label: 'Gefährdet' },
      'completed': { bg: '#E5E7EB', text: '#374151', label: 'Abgeschlossen' },
      'approval': { bg: '#FCE7F3', text: '#831843', label: 'Genehmigung erforderlich' }
    };
    return configs[status] || { bg: '#F3F4F6', text: '#6B7280', label: status };
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const config = getStatusConfig(status);
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 14px',
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: 600,
        background: config.bg,
        color: config.text,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
      }}>
        {config.label}
      </span>
    );
  };

  const getProjectStatusLine = (project: ProjectSummary) => {
    if (project.status === 'completed') {
      return `Abgeschlossen am ${new Date(project.updated_at || '').toLocaleDateString('de-DE', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })}`;
    }
    if (project.deadline) {
      const date = new Date(project.deadline);
      const today = new Date();
      const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) return 'Frist überschritten';
      return formatDate(project.deadline);
    }
    if (project.updated_at) {
      return `Aktualisiert ${formatTimeAgo(project.updated_at)}`;
    }
    return 'In Bearbeitung';
  };

  if (loading) {
    return <PortalSkeleton variant="dashboard" />;
  }

  const hasActiveProjects = stats.activeProjects > 0;
  const allCompleted = !hasActiveProjects && stats.completedProjects > 0;

  return (
    <div style={{ padding: '0', maxWidth: '1200px', margin: '0 auto', paddingBottom: '120px' }}>
      {/* Hero Section - Featured Project Card */}
      {featuredProject ? (
        <div style={{
          background: 'linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%)',
          borderRadius: '18px',
          padding: '28px',
          marginBottom: '20px',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.1)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Background Pattern */}
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '300px',
            height: '300px',
            background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Project Title & Status */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                justifyContent: 'space-between',
                gap: '16px',
                marginBottom: '10px'
              }}>
                <h1 style={{
                  fontSize: '28px',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  margin: 0,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
                  letterSpacing: '-0.02em',
                  lineHeight: '1.2',
                  flex: 1
                }}>
                  {featuredProject.project_title}
                </h1>
                <div style={{ flexShrink: 0 }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    background: getStatusConfig(featuredProject.status).bg,
                    color: getStatusConfig(featuredProject.status).text,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                  }}>
                    {getStatusConfig(featuredProject.status).label}
                  </span>
                </div>
              </div>

              {/* Meta Info - Single Clean Line */}
              <div style={{ 
                color: 'rgba(255, 255, 255, 0.65)',
                fontSize: '14px',
                fontWeight: 500
              }}>
                {getProjectStatusLine(featuredProject)}
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px'
              }}>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.8)'
                }}>
                  Fortschritt
                </span>
                <span style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#FFFFFF'
                }}>
                  {featuredProject.progress_percent}%
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '10px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '5px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${featuredProject.progress_percent}%`,
                  height: '100%',
                  background: featuredProject.progress_percent === 100 
                    ? 'linear-gradient(90deg, #22C55E, #16A34A)' 
                    : 'linear-gradient(90deg, #FFFFFF, rgba(255, 255, 255, 0.8))',
                  transition: 'width 0.5s ease',
                  borderRadius: '5px'
                }} />
              </div>
            </div>

            {/* Action Buttons - Only 2 */}
            <div style={{ 
              display: 'flex', 
              gap: '10px',
              flexWrap: 'wrap'
            }}>
              <a
                href={`${baseUrl}/einsatz/${featuredProject.id}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 22px',
                  background: '#FFFFFF',
                  color: '#1A1A1A',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: '10px',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
                  border: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Projekt anzeigen
                <ArrowRight size={16} />
              </a>
              
              <a
                href={`${baseUrl}/berichte-dateien`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 22px',
                  background: 'rgba(255, 255, 255, 0.12)',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: '10px',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                }}
              >
                <FileText size={16} />
                Dateien öffnen
              </a>
            </div>
          </div>
        </div>
      ) : (
        // No projects state
        <div style={{
          background: 'linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%)',
          borderRadius: '18px',
          padding: '48px 32px',
          marginBottom: '20px',
          textAlign: 'center',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 20px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FolderOpen size={32} color="rgba(255, 255, 255, 0.7)" />
          </div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 700,
            color: '#FFFFFF',
            margin: '0 0 10px 0',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
          }}>
            Willkommen in Ihrem Portal
          </h1>
          <p style={{
            fontSize: '15px',
            color: 'rgba(255, 255, 255, 0.65)',
            margin: '0 0 24px 0',
            maxWidth: '400px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}>
            Starten Sie mit der Anfrage eines neuen Projekts
          </p>
          <a
            href={`${baseUrl}/anfragen-schaeden`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: '#FFFFFF',
              color: '#1A1A1A',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '10px',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Plus size={16} />
            Neues Projekt anfordern
          </a>
        </div>
      )}

      {/* Recent Projects Section */}
      {recentProjects.length > 0 && (
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '20px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#1A1A1A',
              margin: 0,
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
              letterSpacing: '-0.01em'
            }}>
              Ihre Projekte
            </h2>
            {recentProjects.length > 3 && (
              <a
                href={`${baseUrl}/einsaetze`}
                style={{
                  fontSize: '14px',
                  color: '#1A1A1A',
                  textDecoration: 'none',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'opacity 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.6'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                Alle anzeigen
                <ArrowRight size={14} />
              </a>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentProjects.slice(0, 5).map((project, index) => (
              <a
                key={project.id}
                href={`${baseUrl}/einsatz/${project.id}`}
                style={{
                  display: 'block',
                  background: '#FAFAFA',
                  border: '1px solid #E5E7EB',
                  borderRadius: '12px',
                  padding: '16px',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#F3F4F6';
                  e.currentTarget.style.borderColor = '#1A1A1A';
                  e.currentTarget.style.transform = 'translateX(3px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#FAFAFA';
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '12px',
                  gap: '12px'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      color: '#1A1A1A',
                      margin: '0 0 6px 0',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {project.project_title}
                    </h3>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      flexWrap: 'wrap',
                      fontSize: '13px',
                      color: '#6B7280'
                    }}>
                      {project.category && <span>{project.category}</span>}
                      {project.deadline && (
                        <>
                          <span>•</span>
                          <span>{formatDate(project.deadline)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={project.status} />
                </div>

                {/* Progress Bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <div style={{
                    flex: 1,
                    height: '6px',
                    background: '#E5E7EB',
                    borderRadius: '3px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${project.progress_percent}%`,
                      height: '100%',
                      background: project.progress_percent === 100 ? '#22C55E' : '#1A1A1A',
                      transition: 'width 0.5s ease',
                      borderRadius: '3px'
                    }} />
                  </div>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    minWidth: '42px',
                    textAlign: 'right'
                  }}>
                    {project.progress_percent}%
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Open Tickets Section */}
      {openTickets.length > 0 && (
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '20px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#1A1A1A',
              margin: 0,
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
              letterSpacing: '-0.01em'
            }}>
              Offene Tickets
            </h2>
            {openTickets.length > 3 && (
              <a
                href={`${baseUrl}/anfragen-schaeden`}
                style={{
                  fontSize: '14px',
                  color: '#1A1A1A',
                  textDecoration: 'none',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'opacity 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.6'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                Alle anzeigen
                <ArrowRight size={14} />
              </a>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {openTickets.slice(0, 5).map((ticket, index) => {
              const getTicketStatusConfig = (status: string) => {
                const configs: Record<string, { bg: string; text: string; label: string }> = {
                  'open': { bg: '#DBEAFE', text: '#1E40AF', label: 'Offen' },
                  'in_progress': { bg: '#FEF3C7', text: '#92400E', label: 'In Bearbeitung' },
                  'resolved': { bg: '#D1FAE5', text: '#065F46', label: 'Gelöst' },
                  'closed': { bg: '#E5E7EB', text: '#374151', label: 'Geschlossen' }
                };
                return configs[status] || { bg: '#F3F4F6', text: '#6B7280', label: status };
              };

              const getCategoryLabel = (category: string) => {
                const labels: Record<string, string> = {
                  'general': 'Allgemein',
                  'change_request': 'Änderungsanfrage',
                  'help': 'Hilfe',
                  'support': 'Support',
                  'rating': 'Bewertung',
                  'other': 'Sonstiges'
                };
                return labels[category] || category;
              };

              const statusConfig = getTicketStatusConfig(ticket.status);

              return (
                <a
                  key={ticket.id}
                  href={`${baseUrl}/anfragen-schaeden/${ticket.id}`}
                  style={{
                    display: 'block',
                    background: '#FAFAFA',
                    border: '1px solid #E5E7EB',
                    borderRadius: '12px',
                    padding: '16px',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#F3F4F6';
                    e.currentTarget.style.borderColor = '#1A1A1A';
                    e.currentTarget.style.transform = 'translateX(3px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#FAFAFA';
                    e.currentTarget.style.borderColor = '#E5E7EB';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '10px',
                    gap: '12px'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        color: '#1A1A1A',
                        margin: '0 0 6px 0',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {ticket.ticket_title}
                      </h3>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        flexWrap: 'wrap',
                        fontSize: '13px',
                        color: '#6B7280'
                      }}>
                        <span>{getCategoryLabel(ticket.category)}</span>
                        <span>•</span>
                        <span>{formatTimeAgo(ticket.created_at)}</span>
                      </div>
                    </div>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: 600,
                      background: statusConfig.bg,
                      color: statusConfig.text,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
                      flexShrink: 0
                    }}>
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Message Preview */}
                  <p style={{
                    margin: 0,
                    fontSize: '14px',
                    color: '#6B7280',
                    lineHeight: '1.5',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {ticket.message}
                  </p>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Files Section */}
      {recentFiles.length > 0 && (
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '20px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#1A1A1A',
              margin: 0,
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
              letterSpacing: '-0.01em'
            }}>
              Aktuelle Dateien
            </h2>
            <a
              href={`${baseUrl}/berichte-dateien`}
              style={{
                fontSize: '14px',
                color: '#1A1A1A',
                textDecoration: 'none',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'opacity 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.6'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              Alle anzeigen
              <ArrowRight size={14} />
            </a>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {recentFiles.map((file, index) => (
              <div
                key={file.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: index < recentFiles.length - 1 ? '1px solid #F3F4F6' : 'none',
                  transition: 'background 0.2s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#FAFAFA';
                  e.currentTarget.style.paddingLeft = '10px';
                  e.currentTarget.style.paddingRight = '10px';
                  e.currentTarget.style.marginLeft = '-10px';
                  e.currentTarget.style.marginRight = '-10px';
                  e.currentTarget.style.borderRadius = '8px';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.paddingLeft = '0';
                  e.currentTarget.style.paddingRight = '0';
                  e.currentTarget.style.marginLeft = '0';
                  e.currentTarget.style.marginRight = '0';
                  e.currentTarget.style.borderRadius = '0';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    background: '#F3F4F6',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <FileText size={18} color="#6B7280" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#1A1A1A',
                      marginBottom: '3px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {file.filename}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: '#6B7280',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      {file.project?.project_title && (
                        <>
                          <span>{file.project.project_title}</span>
                          <span>•</span>
                        </>
                      )}
                      <span>{formatTimeAgo(file.uploaded_at)}</span>
                    </div>
                  </div>
                </div>
                <ExternalLink size={16} color="#9CA3AF" style={{ flexShrink: 0, marginLeft: '8px' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions - Bottom */}
      <div style={{
        background: '#FAFAFA',
        border: '1px solid #E5E7EB',
        borderRadius: '16px',
        padding: '22px',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
      }}>
        <h3 style={{
          fontSize: '16px',
          fontWeight: 600,
          color: '#1A1A1A',
          margin: '0 0 16px 0',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
        }}>
          Schnellaktionen
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px'
        }}>
          <a
            href={`${baseUrl}/einsaetze`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 16px',
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '10px',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#1A1A1A';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#E5E7EB';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <FolderOpen size={18} color="#1A1A1A" />
            <span style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#1A1A1A',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
            }}>
              Alle Projekte anzeigen
            </span>
          </a>

          <a
            href={`${baseUrl}/berichte-dateien`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 16px',
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '10px',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#1A1A1A';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#E5E7EB';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <FileText size={18} color="#1A1A1A" />
            <span style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#1A1A1A',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
            }}>
              Dateien zugreifen
            </span>
          </a>

          <a
            href={`${baseUrl}/anfragen-schaeden`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 16px',
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '10px',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#1A1A1A';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#E5E7EB';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <MessageSquare size={18} color="#1A1A1A" />
            <span style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#1A1A1A',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
            }}>
              Support erhalten
            </span>
          </a>

          <a
            href={`${baseUrl}/anfragen-schaeden`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 16px',
              background: '#1A1A1A',
              border: '1px solid #1A1A1A',
              borderRadius: '10px',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#2A2A2A';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#1A1A1A';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Plus size={18} color="#FFFFFF" />
            <span style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#FFFFFF',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
            }}>
              Neues Projekt anfordern
            </span>
          </a>
        </div>
      </div>

      {/* Mobile Responsive Styles */}
      <style>{`
        @media (max-width: 768px) {
          /* Hero section adjustments */
          div[style*="linear-gradient(135deg, #1A1A1A"] {
            padding: 22px !important;
            margin-bottom: 16px !important;
          }

          /* Hero title */
          h1[style*="font-size: 28px"] {
            font-size: 22px !important;
          }

          /* Section spacing on mobile */
          div[style*="padding: 24px"] {
            padding: 18px !important;
            margin-bottom: 16px !important;
          }

          /* Section titles */
          h2[style*="font-size: 20px"] {
            font-size: 18px !important;
          }

          /* Quick actions grid - keep 2x2 on mobile */
          div[style*="grid-template-columns: repeat(2, 1fr)"] {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }

          /* Quick action buttons more compact on mobile */
          div[style*="grid-template-columns: repeat(2, 1fr)"]a {
            padding: 12px 14px !important;
            font-size: 13px !important;
          }

          div[style*="grid-template-columns: repeat(2, 1fr)"]a svg {
            width: 16px !important;
            height: 16px !important;
          }

          /* Hero action buttons full width */
          div[style*="flex-wrap: wrap"]a {
            width: 100%;
            justify-content: center;
          }

          /* Project cards more compact */
          div[style*="padding: 16px"] {
            padding: 14px !important;
          }

          /* File rows more compact */
          div[style*="padding: 12px 0"] {
            padding: 10px 0 !important;
          }

          /* Reduce metric card number size on mobile */
          div[style*="font-size: 32px"] {
            font-size: 28px !important;
          }
        }
      `}</style>
    </div>
  );
}











