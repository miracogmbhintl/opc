import React, { useEffect, useState } from 'react';
import WidgetCard from '../shared/WidgetCard';
import WidgetSkeleton from '../shared/WidgetSkeleton';
import { Clock } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface Activity {
  id: string;
  user: string;
  action: string;
  project: string;
  timestamp: string;
  type: 'update' | 'comment' | 'file' | 'milestone';
}

interface TeamActivityFeedProps {
  baseUrl: string;
  limit?: number;
}

export default function TeamActivityFeed({ baseUrl, limit = 8 }: TeamActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
  }, [limit]);

  const loadActivities = async () => {
    try {
      // Get recent project updates
      const { data: projects, error } = await supabase
        .from('projects')
        .select(`
          id,
          project_title,
          status,
          updated_at,
          client:clients(company_name)
        `)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Transform projects into activities
      const activities: Activity[] = (projects || []).map((project: any) => {
        const timeAgo = getTimeAgo(project.updated_at);
        const clientName = project.client?.company_name || 'Unknown Client';
        
        return {
          id: project.id,
          user: clientName,
          action: `updated status to ${project.status}`,
          project: project.project_title,
          timestamp: timeAgo,
          type: 'update' as const
        };
      });

      setActivities(activities);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) return <WidgetSkeleton />;

  const getActivityIcon = (type: Activity['type']) => {
    const colors = {
      update: '#3B82F6',
      comment: '#8B5CF6',
      file: '#10B981',
      milestone: '#F59E0B'
    };
    return (
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: colors[type],
        flexShrink: 0
      }} />
    );
  };

  return (
    <WidgetCard title="Team Activity" icon={<Clock size={18} />}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
        {activities.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#6B7280', textAlign: 'center', padding: '20px 0' }}>
            No recent activity
          </p>
        ) : (
          activities.map((activity, index) => (
            <div
              key={activity.id}
              style={{
                display: 'flex',
                gap: '10px',
                paddingBottom: '12px',
                borderBottom: index < activities.length - 1 ? '1px solid #F9FAFB' : 'none',
                transition: 'background 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#FAFBFC'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                paddingTop: '2px'
              }}>
                {getActivityIcon(activity.type)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: '14px',
                  color: '#1A1A1A',
                  margin: 0,
                  marginBottom: '2px',
                  lineHeight: 1.4
                }}>
                  <span style={{ fontWeight: 500 }}>{activity.user}</span>{' '}
                  <span style={{ color: '#6B7280' }}>{activity.action}</span>
                </p>
                <p style={{
                  fontSize: '14px',
                  color: '#1A1A1A',
                  margin: 0,
                  marginBottom: '4px',
                  fontWeight: 500
                }}>
                  {activity.project}
                </p>
                <p style={{
                  fontSize: '13px',
                  color: '#6B7280',
                  margin: 0
                }}>
                  {activity.timestamp}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </WidgetCard>
  );
}
