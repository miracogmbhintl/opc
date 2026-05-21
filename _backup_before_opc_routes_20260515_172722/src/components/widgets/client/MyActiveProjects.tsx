import React, { useEffect, useState } from 'react';
import WidgetCard from '../shared/WidgetCard';
import WidgetSkeleton from '../shared/WidgetSkeleton';
import { Folder, ExternalLink } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  status: string;
  progress?: number;
  updated_at: string;
}

interface MyActiveProjectsProps {
  baseUrl: string;
  limit?: number;
}

export default function MyActiveProjects({ baseUrl, limit = 3 }: MyActiveProjectsProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${baseUrl}/api/projects/list?status=active&limit=${limit}`, {
      credentials: 'include'
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch projects');
        return res.json();
      })
      .then(data => {
        setProjects(data.projects || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching projects:', err);
        setProjects([]);
        setLoading(false);
      });
  }, [baseUrl, limit]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: '#22C55E',
      pending: '#F59E0B',
      completed: '#1A1A1A',
      at_risk: '#EF4444'
    };
    return colors[status] || '#6B7280';
  };

  if (loading) return <WidgetSkeleton />;

  return (
    <WidgetCard 
      title="My Active Projects" 
      icon={<Folder size={18} />}
      action={
        projects.length > 0 ? (
          <span style={{
            fontSize: '12px',
            fontWeight: 500,
            color: '#1A1A1A',
            padding: '4px 10px',
            background: '#F3F4F6',
            borderRadius: '6px'
          }}>
            {projects.length}
          </span>
        ) : null
      }
    >
      {projects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Folder size={32} style={{ margin: '0 auto 8px', color: '#E5E7EB' }} />
          <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
            No active projects
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {projects.map((project) => (
            <div 
              key={project.id}
              style={{
                padding: '12px',
                borderRadius: '10px',
                background: '#F9FAFB',
                border: '1px solid #E5E7EB',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#FFFFFF';
                e.currentTarget.style.borderColor = '#D1D5DB';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#F9FAFB';
                e.currentTarget.style.borderColor = '#E5E7EB';
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '8px',
                marginBottom: '8px'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h5 style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#1A1A1A',
                    margin: 0,
                    marginBottom: '6px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {project.name}
                  </h5>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: getStatusColor(project.status),
                    padding: '3px 8px',
                    background: '#FFFFFF',
                    borderRadius: '4px',
                    display: 'inline-block',
                    textTransform: 'capitalize',
                    border: `1px solid ${getStatusColor(project.status)}20`
                  }}>
                    {project.status.replace('_', ' ')}
                  </span>
                </div>
                <a 
                  href={`${baseUrl}/miraka-co-portal/project/${project.id}`}
                  style={{
                    color: '#6B7280',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'color 0.2s ease',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#1A1A1A'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#6B7280'}
                  title="View project"
                >
                  <ExternalLink size={16} />
                </a>
              </div>

              {project.progress !== undefined && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    color: '#6B7280',
                    marginBottom: '4px'
                  }}>
                    <span>Progress</span>
                    <span style={{ fontWeight: 600, color: '#1A1A1A' }}>
                      {project.progress}%
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
                      width: `${project.progress}%`,
                      height: '100%',
                      background: '#1A1A1A',
                      transition: 'width 0.3s ease',
                      borderRadius: '3px'
                    }} />
                  </div>
                </div>
              )}
            </div>
          ))}

          <div style={{ paddingTop: '8px', textAlign: 'center' }}>
            <a 
              href={`${baseUrl}/miraka-co-portal/client/projects`}
              style={{
                fontSize: '13px',
                color: '#1A1A1A',
                textDecoration: 'none',
                fontWeight: 500,
                transition: 'color 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#6B7280'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#1A1A1A'}
            >
              View All Projects →
            </a>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}

