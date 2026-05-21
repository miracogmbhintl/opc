import React, { useEffect, useState } from 'react';
import WidgetCard from '../shared/WidgetCard';
import WidgetSkeleton from '../shared/WidgetSkeleton';
import { MessageSquare, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface FeedbackItem {
  id: string;
  title: string;
  project_name: string;
  status: 'pending' | 'reviewed' | 'resolved';
  submitted_at: string;
}

interface FeedbackStatusProps {
  baseUrl: string;
  limit?: number;
}

export default function FeedbackStatus({ baseUrl, limit = 4 }: FeedbackStatusProps) {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, reviewed: 0, resolved: 0 });

  useEffect(() => {
    // Fetch feedback status
    fetch(`${baseUrl}/api/client/feedback-status?limit=${limit}`, {
      credentials: 'include'
    })
      .then(res => {
        if (!res.ok) {
          return { feedback: [], stats: { pending: 0, reviewed: 0, resolved: 0 } };
        }
        return res.json();
      })
      .then(data => {
        setFeedback(data.feedback || []);
        setStats(data.stats || { pending: 0, reviewed: 0, resolved: 0 });
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching feedback status:', err);
        setFeedback([]);
        setStats({ pending: 0, reviewed: 0, resolved: 0 });
        setLoading(false);
      });
  }, [baseUrl, limit]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle size={14} className="text-green-500" />;
      case 'reviewed':
        return <Clock size={14} className="text-blue-500" />;
      default:
        return <AlertCircle size={14} className="text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'miraka-badge success';
      case 'reviewed':
        return 'miraka-badge';
      default:
        return 'miraka-badge warning';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const daysAgo = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysAgo === 0) return 'Today';
    if (daysAgo === 1) return 'Yesterday';
    return `${daysAgo} days ago`;
  };

  if (loading) return <WidgetSkeleton />;

  const totalFeedback = stats.pending + stats.reviewed + stats.resolved;

  return (
    <WidgetCard 
      title="Feedback Status" 
      icon={<MessageSquare size={20} />}
      action={
        totalFeedback > 0 && (
          <span className="miraka-badge">{totalFeedback}</span>
        )
      }
    >
      {totalFeedback === 0 ? (
        <div className="text-center py-6">
          <MessageSquare size={32} className="mx-auto text-[#E5E5E5] mb-2" />
          <p className="text-sm text-[#6B6B6B]">
            No feedback submitted
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-lg bg-yellow-50">
              <p className="text-lg font-bold text-yellow-600">{stats.pending}</p>
              <p className="text-xs text-[#6B6B6B]">Pending</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-blue-50">
              <p className="text-lg font-bold text-blue-600">{stats.reviewed}</p>
              <p className="text-xs text-[#6B6B6B]">Reviewed</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-green-50">
              <p className="text-lg font-bold text-green-600">{stats.resolved}</p>
              <p className="text-xs text-[#6B6B6B]">Resolved</p>
            </div>
          </div>

          {/* Recent Feedback */}
          {feedback.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#E5E5E5]">
              <p className="text-xs font-semibold text-[#6B6B6B] uppercase">
                Recent Feedback
              </p>
              {feedback.map((item) => (
                <div 
                  key={item.id}
                  className="flex items-start gap-2 p-2 rounded-lg bg-[#FAFAFA] hover:bg-[#FFFFFF] transition-colors"
                >
                  {getStatusIcon(item.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1A1A] truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-[#6B6B6B] mt-0.5">
                      {item.project_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`${getStatusBadge(item.status)} text-xs capitalize`}>
                        {item.status}
                      </span>
                      <span className="text-xs text-[#9A9A9A]">
                        {formatDate(item.submitted_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
