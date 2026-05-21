import React, { useEffect, useState } from 'react';
import WidgetCard from '../shared/WidgetCard';
import WidgetSkeleton from '../shared/WidgetSkeleton';
import { Calendar, Clock, AlertCircle } from 'lucide-react';

interface Deadline {
  id: string;
  title: string;
  project_name: string;
  due_date: string;
  priority: 'high' | 'medium' | 'low';
  status: 'upcoming' | 'due_soon' | 'overdue';
}

interface UpcomingDeadlinesProps {
  baseUrl: string;
  limit?: number;
}

export default function UpcomingDeadlines({ baseUrl, limit = 4 }: UpcomingDeadlinesProps) {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch upcoming deadlines
    fetch(`${baseUrl}/api/client/upcoming-deadlines?limit=${limit}`, {
      credentials: 'include'
    })
      .then(res => {
        if (!res.ok) {
          return { deadlines: [] };
        }
        return res.json();
      })
      .then(data => {
        setDeadlines(data.deadlines || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching deadlines:', err);
        setDeadlines([]);
        setLoading(false);
      });
  }, [baseUrl, limit]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'overdue':
        return 'text-red-500 bg-red-50';
      case 'due_soon':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-blue-500 bg-blue-50';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'miraka-badge error';
      case 'medium':
        return 'miraka-badge warning';
      default:
        return 'miraka-badge';
    }
  };

  const formatDueDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const daysUntil = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) return `${Math.abs(daysUntil)} days overdue`;
    if (daysUntil === 0) return 'Due today';
    if (daysUntil === 1) return 'Due tomorrow';
    return `Due in ${daysUntil} days`;
  };

  if (loading) return <WidgetSkeleton />;

  return (
    <WidgetCard 
      title="Upcoming Deadlines" 
      icon={<Calendar size={20} />}
      action={
        deadlines.length > 0 && (
          <span className="miraka-badge">{deadlines.length}</span>
        )
      }
    >
      {deadlines.length === 0 ? (
        <div className="text-center py-6">
          <Calendar size={32} className="mx-auto text-[#E5E5E5] mb-2" />
          <p className="text-sm text-[#6B6B6B]">
            No upcoming deadlines
          </p>
          <p className="text-xs text-[#9A9A9A] mt-1">
            You're all caught up!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {deadlines.map((deadline) => (
            <div 
              key={deadline.id}
              className={`p-3 rounded-lg border transition-colors ${getStatusColor(deadline.status)}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <h5 className="text-sm font-semibold text-[#1A1A1A] truncate">
                    {deadline.title}
                  </h5>
                  <p className="text-xs text-[#6B6B6B] mt-1">
                    {deadline.project_name}
                  </p>
                </div>
                <span className={`${getPriorityBadge(deadline.priority)} text-xs capitalize`}>
                  {deadline.priority}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-2 text-xs">
                {deadline.status === 'overdue' ? (
                  <AlertCircle size={14} className="text-red-500" />
                ) : (
                  <Clock size={14} className="text-current" />
                )}
                <span className="font-medium">
                  {formatDueDate(deadline.due_date)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
