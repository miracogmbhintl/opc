import React, { useEffect, useState } from 'react';
import WidgetCard from '../shared/WidgetCard';
import WidgetSkeleton from '../shared/WidgetSkeleton';
import { Activity, X, ChevronRight, Calendar, TrendingUp } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface HealthStats {
  healthy: number;
  atRisk: number;
  delayed: number;
  completed: number;
}

interface Project {
  id: string;
  project_title: string;
  status: string;
  deadline: string;
  progress_percent: number;
  client?: {
    company_name: string;
  };
  healthStatus: 'healthy' | 'atRisk' | 'delayed' | 'completed';
}

interface ProjectHealthOverviewProps {
  baseUrl: string;
}

export default function ProjectHealthOverview({ baseUrl }: ProjectHealthOverviewProps) {
  const [stats, setStats] = useState<HealthStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'healthy' | 'atRisk' | 'delayed' | 'completed'>('healthy');

  useEffect(() => {
    loadProjectHealth();
  }, []);

  const loadProjectHealth = async () => {
    try {
      // Get all projects (including completed)
      const { data: projectsData, error } = await supabase
        .from('projects')
        .select(`
          id,
          project_title,
          status,
          deadline,
          progress_percent,
          client:clients(company_name)
        `)
        .order('deadline', { ascending: true });

      if (error) throw error;

      // Calculate health based on deadline and progress
      let healthy = 0;
      let atRisk = 0;
      let delayed = 0;
      let completed = 0;

      const now = new Date();
      const processedProjects: Project[] = [];

      (projectsData || []).forEach((project: any) => {
        const deadline = new Date(project.deadline);
        const daysUntilDeadline = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const progress = project.progress_percent || 0;

        let healthStatus: 'healthy' | 'atRisk' | 'delayed' | 'completed';

        // Completed projects
        if (project.status === 'completed' || progress >= 100) {
          completed++;
          healthStatus = 'completed';
        }
        // Delayed: Past deadline and not 100% complete
        else if (daysUntilDeadline < 0 && progress < 100) {
          delayed++;
          healthStatus = 'delayed';
        }
        // At Risk: Less than 7 days and less than 70% complete
        else if (daysUntilDeadline < 7 && progress < 70) {
          atRisk++;
          healthStatus = 'atRisk';
        }
        // Healthy: Everything else
        else {
          healthy++;
          healthStatus = 'healthy';
        }

        processedProjects.push({
          ...project,
          client: Array.isArray(project.client) && project.client.length > 0 ? project.client[0] : project.client,
          healthStatus
        });
      });

      setStats({ healthy, atRisk, delayed, completed });
      setProjects(processedProjects);
    } catch (error) {
      console.error('Error loading project health:', error);
      setStats({ healthy: 0, atRisk: 0, delayed: 0, completed: 0 });
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredProjects = () => {
    return projects.filter(p => p.healthStatus === activeTab);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleProjectClick = (projectId: string) => {
    window.location.href = `${baseUrl}/miraka-co-portal/project/${projectId}`;
  };

  const handleTotalProjectsClick = () => {
    window.location.href = `${baseUrl}/miraka-co-portal/projects`;
  };

  if (loading) return <WidgetSkeleton />;

  const total = (stats?.healthy || 0) + (stats?.atRisk || 0) + (stats?.delayed || 0);

  return (
    <>
      <WidgetCard 
        title="Project Health" 
        icon={<Activity size={18} />}
        onClick={() => setShowModal(true)}
        style={{ cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Healthy Projects */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#6B7280', letterSpacing: '0.3px' }}>Healthy</span>
              <span style={{
                fontSize: '36px',
                fontWeight: 600,
                color: '#22C55E',
                lineHeight: 1,
                marginBottom: '4px'
              }}>
                {stats?.healthy}
              </span>
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              background: '#F3F4F6',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${total > 0 ? ((stats?.healthy || 0) / total) * 100 : 0}%`,
                height: '100%',
                background: '#22C55E',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          {/* At Risk Projects */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#6B7280', letterSpacing: '0.3px' }}>At Risk</span>
              <span style={{
                fontSize: '36px',
                fontWeight: 600,
                color: '#F59E0B',
                lineHeight: 1,
                marginBottom: '4px'
              }}>
                {stats?.atRisk}
              </span>
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              background: '#F3F4F6',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${total > 0 ? ((stats?.atRisk || 0) / total) * 100 : 0}%`,
                height: '100%',
                background: '#F59E0B',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          {/* Delayed Projects */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#6B7280', letterSpacing: '0.3px' }}>Delayed</span>
              <span style={{
                fontSize: '36px',
                fontWeight: 600,
                color: '#EF4444',
                lineHeight: 1,
                marginBottom: '4px'
              }}>
                {stats?.delayed}
              </span>
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              background: '#F3F4F6',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${total > 0 ? ((stats?.delayed || 0) / total) * 100 : 0}%`,
                height: '100%',
                background: '#EF4444',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          {/* Total - Clickable */}
          <div 
            onClick={(e) => {
              e.stopPropagation();
              handleTotalProjectsClick();
            }}
            style={{
              marginTop: '4px',
              paddingTop: '12px',
              borderTop: '1px solid #E5E7EB',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              transition: 'opacity 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500, letterSpacing: '0.3px' }}>
              Total Projects
            </span>
            <span style={{
              fontSize: '36px',
              fontWeight: 600,
              color: '#1A1A1A',
              lineHeight: 1
            }}>
              {total}
            </span>
          </div>
        </div>
      </WidgetCard>

      {/* Modal Popup */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #E5E7EB',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Activity size={24} style={{ color: '#1A1A1A' }} />
                <h2 style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 600,
                  color: '#1A1A1A'
                }}>
                  Project Health Overview
                </h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  transition: 'background 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#F3F4F6'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <X size={20} style={{ color: '#6B7280' }} />
              </button>
            </div>

            {/* Tabs - Fixed Width Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              padding: '20px 24px',
              borderBottom: '1px solid #E5E7EB'
            }}>
              <button
                onClick={() => setActiveTab('healthy')}
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: activeTab === 'healthy' ? '#DCFCE7' : '#F3F4F6',
                  color: activeTab === 'healthy' ? '#166534' : '#6B7280',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'healthy') {
                    e.currentTarget.style.background = '#E5E7EB';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'healthy') {
                    e.currentTarget.style.background = '#F3F4F6';
                  }
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 500 }}>Healthy</span>
                <span style={{ fontSize: '20px', fontWeight: 700 }}>{stats?.healthy || 0}</span>
              </button>
              <button
                onClick={() => setActiveTab('atRisk')}
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: activeTab === 'atRisk' ? '#FEF3C7' : '#F3F4F6',
                  color: activeTab === 'atRisk' ? '#92400E' : '#6B7280',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'atRisk') {
                    e.currentTarget.style.background = '#E5E7EB';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'atRisk') {
                    e.currentTarget.style.background = '#F3F4F6';
                  }
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 500 }}>At Risk</span>
                <span style={{ fontSize: '20px', fontWeight: 700 }}>{stats?.atRisk || 0}</span>
              </button>
              <button
                onClick={() => setActiveTab('delayed')}
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: activeTab === 'delayed' ? '#FEE2E2' : '#F3F4F6',
                  color: activeTab === 'delayed' ? '#991B1B' : '#6B7280',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'delayed') {
                    e.currentTarget.style.background = '#E5E7EB';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'delayed') {
                    e.currentTarget.style.background = '#F3F4F6';
                  }
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 500 }}>Delayed</span>
                <span style={{ fontSize: '20px', fontWeight: 700 }}>{stats?.delayed || 0}</span>
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: activeTab === 'completed' ? '#E5E7EB' : '#F3F4F6',
                  color: activeTab === 'completed' ? '#374151' : '#6B7280',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'completed') {
                    e.currentTarget.style.background = '#E5E7EB';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'completed') {
                    e.currentTarget.style.background = '#F3F4F6';
                  }
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 500 }}>Completed</span>
                <span style={{ fontSize: '20px', fontWeight: 700 }}>{stats?.completed || 0}</span>
              </button>
            </div>

            {/* Project List */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 24px'
            }}>
              {getFilteredProjects().length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#6B7280'
                }}>
                  <p style={{ margin: 0, fontSize: '14px' }}>
                    No {activeTab} projects found
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {getFilteredProjects().map((project) => (
                    <div
                      key={project.id}
                      onClick={() => handleProjectClick(project.id)}
                      style={{
                        padding: '16px',
                        background: '#FAFBFC',
                        borderRadius: '12px',
                        border: '1px solid #E5E7EB',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#F3F4F6';
                        e.currentTarget.style.borderColor = '#1A1A1A';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#FAFBFC';
                        e.currentTarget.style.borderColor = '#E5E7EB';
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '12px'
                      }}>
                        <div style={{ flex: 1 }}>
                          <h4 style={{
                            margin: '0 0 4px 0',
                            fontSize: '15px',
                            fontWeight: 600,
                            color: '#1A1A1A'
                          }}>
                            {project.project_title}
                          </h4>
                          <p style={{
                            margin: 0,
                            fontSize: '13px',
                            color: '#6B7280'
                          }}>
                            {project.client?.company_name || 'No client'}
                          </p>
                        </div>
                        <ChevronRight size={20} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                      </div>

                      <div style={{
                        display: 'flex',
                        gap: '16px',
                        alignItems: 'center',
                        fontSize: '13px',
                        color: '#6B7280'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={14} />
                          <span>{formatDate(project.deadline)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <TrendingUp size={14} />
                          <span>{project.progress_percent}%</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div style={{
                        marginTop: '12px',
                        width: '100%',
                        height: '6px',
                        background: '#E5E7EB',
                        borderRadius: '3px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${project.progress_percent}%`,
                          height: '100%',
                          background: 
                            activeTab === 'healthy' ? '#22C55E' :
                            activeTab === 'atRisk' ? '#F59E0B' :
                            activeTab === 'delayed' ? '#EF4444' : '#6B7280',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #E5E7EB',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '10px 20px',
                  background: '#F3F4F6',
                  color: '#1A1A1A',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#E5E7EB'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#F3F4F6'}
              >
                Close
              </button>
              <button
                onClick={handleTotalProjectsClick}
                style={{
                  padding: '10px 20px',
                  background: '#1A1A1A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#2A2A2A'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#1A1A1A'}
              >
                View All Projects
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
