import { useState, useEffect } from 'react';
import { Clock, User, ChevronUp, ChevronDown } from 'lucide-react';

interface Activity {
  id: string;
  user: string;
  action: string;
  itemName?: string;
  columnName?: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
}

interface ActivityBarProps {
  boardId: string;
}

export default function ActivityBar({ boardId }: ActivityBarProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadActivities();
    
    // Listen for activity updates
    const handleActivityUpdate = (e: CustomEvent) => {
      if (e.detail?.boardId === boardId) {
        loadActivities();
      }
    };
    
    window.addEventListener('board-activity-updated' as any, handleActivityUpdate);
    return () => window.removeEventListener('board-activity-updated' as any, handleActivityUpdate);
  }, [boardId]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const boardActivities = JSON.parse(
        localStorage.getItem(`workos_board_${boardId}_activities`) || '[]'
      );
      setActivities(boardActivities);
    } catch (error) {
      console.error('Failed to load activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const renderActivityText = (activity: Activity) => {
    if (activity.action === 'created') {
      return (
        <>
          created item <strong>{activity.itemName}</strong>
        </>
      );
    }
    
    if (activity.action === 'updated') {
      return (
        <>
          updated <strong>{activity.columnName}</strong> in{' '}
          <strong>{activity.itemName}</strong>
          {activity.oldValue && activity.newValue && (
            <span style={{ color: '#6B7280', marginLeft: '4px' }}>
              from "{activity.oldValue}" to "{activity.newValue}"
            </span>
          )}
        </>
      );
    }

    if (activity.action === 'deleted') {
      return (
        <>
          deleted item <strong>{activity.itemName}</strong>
        </>
      );
    }

    if (activity.action === 'moved') {
      return (
        <>
          moved <strong>{activity.itemName}</strong>
          {activity.oldValue && activity.newValue && (
            <span style={{ color: '#6B7280', marginLeft: '4px' }}>
              from "{activity.oldValue}" to "{activity.newValue}"
            </span>
          )}
        </>
      );
    }

    if (activity.action === 'commented') {
      return (
        <>
          commented on <strong>{activity.itemName}</strong>
        </>
      );
    }

    return <>{activity.action}</>;
  };

  const displayedActivities = isExpanded ? activities : activities.slice(0, 3);

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderTop: '1px solid #E5E7EB',
        transition: 'all 0.3s ease'
      }}
    >
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          borderBottom: isExpanded ? '1px solid #E5E7EB' : 'none',
          transition: 'background 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#F9FAFB';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#FFFFFF';
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Clock size={16} color="#6B7280" strokeWidth={2} />
          <span style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#1A1A1A',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
            letterSpacing: '0.3px'
          }}>
            Recent Activity
          </span>
          {activities.length > 0 && (
            <span style={{
              padding: '2px 8px',
              background: '#F3F4F6',
              color: '#6B7280',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '10px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
            }}>
              {activities.length}
            </span>
          )}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {!isExpanded && activities.length > 3 && (
            <span style={{
              fontSize: '12px',
              color: '#9CA3AF',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
            }}>
              +{activities.length - 3} more
            </span>
          )}
          {isExpanded ? (
            <ChevronDown size={18} color="#6B7280" strokeWidth={2} />
          ) : (
            <ChevronUp size={18} color="#6B7280" strokeWidth={2} />
          )}
        </div>
      </div>

      {/* Activity List */}
      {isExpanded && (
        <div
          style={{
            maxHeight: '320px',
            overflowY: 'auto',
            padding: '0'
          }}
        >
          {loading ? (
            <div style={{
              padding: '32px',
              textAlign: 'center',
              color: '#9CA3AF',
              fontSize: '13px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
            }}>
              Loading activities...
            </div>
          ) : activities.length === 0 ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                margin: '0 auto 12px',
                background: '#F3F4F6',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Clock size={24} color="#D1D5DB" strokeWidth={1.5} />
              </div>
              <p style={{
                fontSize: '13px',
                color: '#9CA3AF',
                margin: 0,
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
              }}>
                No recent activity
              </p>
            </div>
          ) : (
            <div style={{ padding: '12px 0' }}>
              {displayedActivities.map((activity, index) => (
                <div
                  key={activity.id}
                  style={{
                    padding: '12px 32px',
                    display: 'flex',
                    gap: '14px',
                    borderBottom: index < displayedActivities.length - 1 ? '1px solid #F3F4F6' : 'none',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#F9FAFB';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {/* User Avatar */}
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#1A1A1A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#FFFFFF',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
                      textTransform: 'uppercase'
                    }}>
                      {activity.user.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Activity Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '13px',
                      color: '#1A1A1A',
                      lineHeight: '1.5',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
                      marginBottom: '2px'
                    }}>
                      <span style={{ fontWeight: 600, color: '#1A1A1A' }}>
                        {activity.user}
                      </span>
                      {' '}
                      {renderActivityText(activity)}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#9CA3AF',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                    }}>
                      {formatTimestamp(activity.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick preview when collapsed */}
      {!isExpanded && activities.length > 0 && (
        <div style={{ padding: '8px 32px 16px' }}>
          {displayedActivities.map((activity, index) => (
            <div
              key={activity.id}
              style={{
                fontSize: '12px',
                color: '#6B7280',
                marginBottom: index < displayedActivities.length - 1 ? '6px' : 0,
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              <span style={{ fontWeight: 600, color: '#1A1A1A' }}>
                {activity.user}
              </span>
              {' '}
              {renderActivityText(activity)}
              {' '}
              <span style={{ color: '#9CA3AF' }}>
                · {formatTimestamp(activity.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Export helper function for logging activities from other components
export function useActivityLogger(boardId: string) {
  const logActivity = (activity: Omit<Activity, 'id' | 'timestamp' | 'user'>) => {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const userName = currentUser.email || currentUser.name || 'Unknown User';

    const newActivity: Activity = {
      ...activity,
      user: userName,
      id: Date.now().toString(),
      timestamp: new Date().toISOString()
    };

    const boardActivities = JSON.parse(
      localStorage.getItem(`workos_board_${boardId}_activities`) || '[]'
    );
    
    const updatedActivities = [newActivity, ...boardActivities].slice(0, 50);
    localStorage.setItem(`workos_board_${boardId}_activities`, JSON.stringify(updatedActivities));

    // Trigger custom event to update ActivityBar
    window.dispatchEvent(new CustomEvent('board-activity-updated', { detail: { boardId } }));
  };

  return { logActivity };
}
