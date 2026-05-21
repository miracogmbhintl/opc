import React, { useEffect, useState } from 'react';
import WidgetCard from './WidgetCard';
import WidgetSkeleton from './WidgetSkeleton';
import { TrendingUp } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface Project {
  id: string;
  project_title: string;
  status: string;
  deadline: string;
  progress_percent: number;
}

interface ProjectStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  averageProgress: number;
  upcomingDeadlines: Project[];
}

interface TotalProjectProgressWidgetProps {
  baseUrl: string;
  role?: 'owner' | 'admin' | 'client';
  userId?: string;
  clientId?: string;
}

export default function TotalProjectProgressWidget({ 
  baseUrl, 
  role = 'owner',
  userId,
  clientId
}: TotalProjectProgressWidgetProps) {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProjectStats();
  }, [role, userId, clientId]);

  const loadProjectStats = async () => {
    try {
      // SECURITY: For client role, clientId is REQUIRED
      if (role === 'client' && !clientId) {
        console.error('[TotalProjectProgressWidget] SECURITY ERROR: Client role requires clientId');
        setStats({
          totalProjects: 0,
          activeProjects: 0,
          completedProjects: 0,
          averageProgress: 0,
          upcomingDeadlines: []
        });
        setLoading(false);
        return;
      }

      console.log('[TotalProjectProgressWidget] Loading with:', { role, userId, clientId });

      let query = supabase
        .from('projects')
        .select('id, project_title, status, deadline, progress_percent');

      // Role-based filtering
      if (role === 'client' && clientId) {
        // Client: only their projects
        console.log('[TotalProjectProgressWidget] Filtering by client_id:', clientId);
        query = query.eq('client_id', clientId);
      } else if (role === 'admin' && userId) {
        // Admin: only assigned projects (if admin_id field exists)
        // For now, show all projects (same as owner)
        // In production, add: .eq('admin_id', userId)
      }
      // Owner: no filter, shows all projects

      const { data: projects, error: projectsError } = await query;

      if (projectsError) throw projectsError;

      console.log('[TotalProjectProgressWidget] Loaded projects:', projects?.length || 0);

      if (!projects || projects.length === 0) {
        setStats({
          totalProjects: 0,
          activeProjects: 0,
          completedProjects: 0,
          averageProgress: 0,
          upcomingDeadlines: []
        });
        setLoading(false);
        return;
      }

      // Calculate stats
      const activeProjects = projects.filter(p => p.status !== 'completed');
      const completedProjects = projects.filter(p => p.status === 'completed');
      
      // Average progress (exclude completed = 100%)
      const progressSum = activeProjects.reduce((sum, p) => sum + (p.progress_percent || 0), 0);
      const averageProgress = activeProjects.length > 0 
        ? Math.round(progressSum / activeProjects.length)
        : (completedProjects.length > 0 ? 100 : 0);

      // Get upcoming deadlines (next 3 active projects sorted by deadline)
      const upcomingDeadlines = activeProjects
        .filter(p => p.deadline)
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
        .slice(0, 3);

      setStats({
        totalProjects: projects.length,
        activeProjects: activeProjects.length,
        completedProjects: completedProjects.length,
        averageProgress,
        upcomingDeadlines
      });

      setLoading(false);
    } catch (err) {
      console.error('Error loading project stats:', err);
      setError('Unable to load project progress');
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 7) return `${diffDays} days`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) return <WidgetSkeleton />;

  if (error) {
    return (
      <WidgetCard title="Total Project Progress" icon={<TrendingUp size={18} />}>
        <p style={{ fontSize: '14px', color: '#6B7280', textAlign: 'center', padding: '20px 0' }}>
          {error}
        </p>
      </WidgetCard>
    );
  }

  // Empty state
  if (!stats || stats.totalProjects === 0) {
    // Calculate 100% circle
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const offset = 0; // 100% complete = 0 offset

    return (
      <WidgetCard title="Total Project Progress" icon={<TrendingUp size={18} />}>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          padding: '20px',
          gap: '24px'
        }}>
          {/* 100% Complete Circle */}
          <div style={{ position: 'relative', width: '120px', height: '120px' }}>
            <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
              {/* Background circle */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                stroke="#F3F4F6"
                strokeWidth="10"
                fill="none"
              />
              {/* Progress circle - 100% complete in green */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                stroke="#22C55E"
                strokeWidth="10"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ 
                  transition: 'stroke-dashoffset 0.5s ease',
                }}
              />
            </svg>
            
            {/* Center text */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '36px',
                fontWeight: 600,
                color: '#22C55E',
                lineHeight: 1
              }}>
                100%
              </div>
              <div style={{
                fontSize: '13px',
                color: '#9CA3AF',
                marginTop: '4px'
              }}>
                Ready
              </div>
            </div>
          </div>

          {/* Message */}
          <div style={{ textAlign: 'center' }}>
            <h4 style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#1A1A1A',
              margin: '0 0 8px 0'
            }}>
              No Projects Yet
            </h4>
            <p style={{ 
              fontSize: '14px', 
              color: '#6B7280', 
              margin: '0 0 20px 0' 
            }}>
              Get started by creating your first project
            </p>
          </div>

          {/* Start a New Project Button */}
          <a
            href={`${baseUrl}/miraka-co-portal/create-project`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 24px',
              background: '#1A1A1A',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '10px',
              textDecoration: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#2A2A2A';
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#1A1A1A';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Start a New Project
          </a>
        </div>
      </WidgetCard>
    );
  }

  // Calculate circular progress
  const progress = stats.averageProgress;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  console.log('[TotalProjectProgressWidget] Progress:', progress, 'Show checkmark:', progress === 100);

  return (
    <WidgetCard title="Total Project Progress" icon={<TrendingUp size={18} />}>
      <div 
        data-widget="total-progress" 
        data-version="2.0.0"
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '20px'
        }}>
        {/* CIRCULAR PROGRESS - PRIMARY METRIC */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '120px', height: '120px' }}>
            <svg
              width="120"
              height="120"
              style={{ transform: 'rotate(-90deg)' }}
            >
              {/* Background circle */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                stroke="#F3F4F6"
                strokeWidth="10"
                fill="none"
              />
              {/* Progress circle */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                stroke={progress === 100 ? "#22C55E" : "#1A1A1A"}
                strokeWidth="10"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ 
                  transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease',
                }}
              />
            </svg>
            
            {/* Center content */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center'
            }}>
              {progress === 100 ? (
                // Green checkmark icon for 100%
                <svg 
                  width="48" 
                  height="48" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="#22C55E" 
                  strokeWidth="3" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
                // Percentage display for < 100%
                <>
                  <div style={{
                    fontSize: '36px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    lineHeight: 1
                  }}>
                    {progress}%
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: '#9CA3AF',
                    marginTop: '4px'
                  }}>
                    Complete
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* SUMMARY LINE - SECONDARY */}
        <div style={{
          textAlign: 'center',
          fontSize: '13px',
          color: '#6B7280',
          paddingBottom: '12px',
          borderBottom: '1px solid #E5E7EB'
        }}>
          {stats.totalProjects} Projects · {stats.activeProjects} Active · {stats.completedProjects} Done
        </div>

        {/* UPCOMING DEADLINES - TERTIARY */}
        {stats.upcomingDeadlines.length > 0 && (
          <div>
            <h4 style={{
              fontSize: '13px',
              fontWeight: 500,
              color: '#6B7280',
              margin: '0 0 12px 0',
              letterSpacing: '0.3px'
            }}>
              Upcoming Deadlines
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stats.upcomingDeadlines.map((project, index) => (
                <div
                  key={project.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    paddingBottom: '12px',
                    borderBottom: index < stats.upcomingDeadlines.length - 1 ? '1px solid #F9FAFB' : 'none',
                    transition: 'background 0.2s ease',
                    cursor: 'pointer',
                    borderRadius: '6px',
                    padding: '8px',
                    margin: '-8px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#FAFBFC'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  onClick={() => window.location.href = `${baseUrl}/miraka-co-portal/project/${project.id}`}
                >
                  {/* Project name and deadline */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '8px'
                  }}>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#1A1A1A',
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {project.project_title}
                    </span>
                    <span style={{
                      fontSize: '13px',
                      color: '#6B7280',
                      whiteSpace: 'nowrap'
                    }}>
                      {formatDate(project.deadline)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      flex: 1,
                      height: '6px',
                      background: '#F3F4F6',
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${project.progress_percent}%`,
                        height: '100%',
                        background: '#1A1A1A',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <span style={{ 
                      fontSize: '13px', 
                      fontWeight: 500, 
                      color: '#6B7280', 
                      minWidth: '40px',
                      textAlign: 'right'
                    }}>
                      {project.progress_percent}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state for deadlines */}
        {stats.upcomingDeadlines.length === 0 && stats.totalProjects > 0 && (
          <div style={{
            textAlign: 'center',
            padding: '20px 0',
            fontSize: '13px',
            color: '#6B7280'
          }}>
            {stats.completedProjects === stats.totalProjects 
              ? 'All projects completed' 
              : 'No upcoming deadlines'}
          </div>
        )}
      </div>
    </WidgetCard>
  );
}






