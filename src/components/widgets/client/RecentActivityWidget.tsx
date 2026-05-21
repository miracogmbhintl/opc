import React, { useEffect, useState } from 'react';
import WidgetCard from '../shared/WidgetCard';
import WidgetSkeleton from '../shared/WidgetSkeleton';
import { Activity, FileText, MessageSquare, CheckCircle } from 'lucide-react';

interface ActivityItem {
  id: string;
  action: string;
  project_name?: string;
  created_at: string;
  type: 'update' | 'comment' | 'milestone' | 'file';
}

interface RecentActivityWidgetProps {
  baseUrl: string;
  limit?: number;
}

export default function RecentActivityWidget({ 
  baseUrl, 
  limit = 5 
}: RecentActivityWidgetProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch client's recent activity
    fetch(`${baseUrl}/api/client/recent-activity?limit=${limit}`, {
      credentials: 'include'
    })
      .then(res => {
        if (!res.ok) {
          return { activities: [] };
        }
        return res.json();
      })
      .then(data => {
        setActivities(data.activities || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching recent activity:', err);
        setActivities([]);
        setLoading(false);
      });
  }, [baseUrl, limit]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'comment':
        return <MessageSquare size={16} />;
      case 'milestone':
        return <CheckCircle size={16} />;
      case 'file':
        return <FileText size={16} />;
      default:
        return <Activity size={16} />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (loading) return <WidgetSkeleton />;

  return (
    <WidgetCard 
      title="Recent Activity" 
      icon={<Activity size={20} />}
    >
      {activities.length === 0 ? (
        <p className="text-sm text-[#6B6B6B] text-center py-4">
          No recent activity
        </p>
      ) : (
        <div className="space-y-2">
          {activities.map((activity) => (
            <div 
              key={activity.id}
              className="flex gap-3 p-3 rounded-lg bg-[#FAFAFA] hover:bg-[#FFFFFF] transition-colors"
            >
              <div className="text-[#1A1A1A] mt-0.5">
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#1A1A1A]">
                  {activity.action}
                  {activity.project_name && (
                    <span className="text-[#1A1A1A] font-medium">
                      {' '}{activity.project_name}
                    </span>
                  )}
                </p>
                <p className="text-xs text-[#6B6B6B] mt-1">
                  {formatTimeAgo(activity.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

