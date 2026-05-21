import { Clock, Upload, FolderPlus, Edit3, Move, Trash2, CornerUpLeft, FileText, AlertCircle } from 'lucide-react';

// ==========================================
// TYPE DEFINITIONS
// ==========================================

interface ActivityLog {
  id: string;
  action: string;
  role: string;
  performed_by: string | null;
  created_at: string;
  meta: Record<string, any>;
}

interface FileActivityTimelineProps {
  logs: ActivityLog[];
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function getActionIcon(action: string) {
  const iconMap: Record<string, JSX.Element> = {
    upload: <Upload size={16} />,
    create_folder: <FolderPlus size={16} />,
    rename: <Edit3 size={16} />,
    move: <Move size={16} />,
    delete: <Trash2 size={16} />,
    restore: <CornerUpLeft size={16} />,
    hard_delete: <AlertCircle size={16} />,
    download: <FileText size={16} />
  };

  return iconMap[action] || <FileText size={16} />;
}

function getActionLabel(action: string): string {
  const labelMap: Record<string, string> = {
    upload: 'Uploaded',
    create_folder: 'Created folder',
    rename: 'Renamed',
    move: 'Moved',
    delete: 'Deleted',
    restore: 'Restored',
    hard_delete: 'Permanently deleted',
    download: 'Downloaded'
  };

  return labelMap[action] || action.replace(/_/g, ' ');
}

function getActionColor(action: string): string {
  const colorMap: Record<string, string> = {
    upload: '#3B82F6',      // Blue
    create_folder: '#10B981', // Green
    rename: '#F59E0B',      // Amber
    move: '#8B5CF6',        // Purple
    delete: '#EF4444',      // Red
    restore: '#10B981',     // Green
    hard_delete: '#DC2626', // Dark red
    download: '#6B7280'     // Gray
  };

  return colorMap[action] || '#6B7280';
}

function getRoleBadgeColor(role: string): { bg: string; text: string; border: string } {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    admin: { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
    owner: { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' },
    client: { bg: '#E0E7FF', text: '#3730A3', border: '#A5B4FC' },
    system: { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' }
  };

  return colorMap[role] || colorMap.system;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Less than 1 minute
  if (diffMins < 1) {
    return 'Just now';
  }

  // Less than 1 hour
  if (diffMins < 60) {
    return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  }

  // Less than 24 hours
  if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  }

  // Less than 7 days
  if (diffDays < 7) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  }

  // Older than 7 days - show date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

function getActivityDescription(log: ActivityLog): string {
  const { action, meta, performed_by } = log;

  // Handle null performed_by
  const actor = performed_by || 'System';

  // Base description
  let description = `${getActionLabel(action)}`;

  // Add context from meta if available
  if (meta) {
    if (action === 'rename' && meta.old_name && meta.new_name) {
      description = `Renamed "${meta.old_name}" to "${meta.new_name}"`;
    } else if (action === 'move' && meta.destination) {
      description = `Moved to ${meta.destination}`;
    } else if (action === 'upload' && meta.file_name) {
      description = `Uploaded "${meta.file_name}"`;
    } else if (action === 'create_folder' && meta.folder_name) {
      description = `Created folder "${meta.folder_name}"`;
    } else if (action === 'delete' && meta.item_name) {
      description = `Deleted "${meta.item_name}"`;
    } else if (action === 'restore' && meta.item_name) {
      description = `Restored "${meta.item_name}"`;
    }
  }

  return description;
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function FileActivityTimeline({ logs }: FileActivityTimelineProps) {
  
  // ==========================================
  // EMPTY STATE
  // ==========================================

  if (!logs || logs.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        fontFamily: 'Inter, sans-serif'
      }}>
        <Clock size={48} color="#D1D5DB" style={{ marginBottom: '16px' }} />
        <h3 style={{
          fontSize: '16px',
          fontWeight: 600,
          color: '#1A1A1A',
          margin: '0 0 8px 0'
        }}>
          No activity yet
        </h3>
        <p style={{
          fontSize: '14px',
          color: '#6B7280',
          margin: 0,
          textAlign: 'center'
        }}>
          File actions will appear here
        </p>
      </div>
    );
  }

  // ==========================================
  // TIMELINE RENDERING
  // ==========================================

  return (
    <div style={{
      padding: '0',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Timeline Container */}
      <div style={{
        position: 'relative',
        paddingLeft: '40px'
      }}>
        {/* Vertical Line */}
        <div style={{
          position: 'absolute',
          left: '15px',
          top: '8px',
          bottom: '0',
          width: '2px',
          background: '#E5E7EB'
        }} />

        {/* Timeline Items */}
        {logs.map((log, index) => {
          const actionColor = getActionColor(log.action);
          const roleBadge = getRoleBadgeColor(log.role);
          const isLast = index === logs.length - 1;

          return (
            <div
              key={log.id}
              style={{
                position: 'relative',
                paddingBottom: isLast ? '0' : '24px'
              }}
            >
              {/* Timeline Dot */}
              <div style={{
                position: 'absolute',
                left: '-33px',
                top: '4px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#FFFFFF',
                border: `2px solid ${actionColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: actionColor,
                zIndex: 1
              }}>
                {getActionIcon(log.action)}
              </div>

              {/* Activity Card */}
              <div style={{
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '12px',
                padding: '16px',
                transition: 'all 0.2s ease'
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '8px',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  {/* Description */}
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <p style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#1A1A1A',
                      margin: '0 0 4px 0',
                      lineHeight: '1.4'
                    }}>
                      {getActivityDescription(log)}
                    </p>
                    <p style={{
                      fontSize: '13px',
                      color: '#6B7280',
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Clock size={12} />
                      {formatTimestamp(log.created_at)}
                    </p>
                  </div>

                  {/* Role Badge */}
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: roleBadge.bg,
                    border: `1px solid ${roleBadge.border}`,
                    fontSize: '12px',
                    fontWeight: 500,
                    color: roleBadge.text,
                    textTransform: 'capitalize',
                    whiteSpace: 'nowrap'
                  }}>
                    {log.role}
                  </div>
                </div>

                {/* Actor */}
                {log.performed_by && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid #F3F4F6'
                  }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#F3F4F6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#6B7280'
                    }}>
                      {log.performed_by.charAt(0).toUpperCase()}
                    </div>
                    <span style={{
                      fontSize: '13px',
                      color: '#6B7280'
                    }}>
                      {log.performed_by}
                    </span>
                  </div>
                )}

                {/* System Action (no performer) */}
                {!log.performed_by && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid #F3F4F6'
                  }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#F3F4F6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#6B7280'
                    }}>
                      ⚙️
                    </div>
                    <span style={{
                      fontSize: '13px',
                      color: '#6B7280',
                      fontStyle: 'italic'
                    }}>
                      System action
                    </span>
                  </div>
                )}

                {/* Metadata (Optional Debug Info) */}
                {log.meta && Object.keys(log.meta).length > 0 && (
                  <details style={{
                    marginTop: '12px',
                    fontSize: '12px'
                  }}>
                    <summary style={{
                      cursor: 'pointer',
                      color: '#6B7280',
                      userSelect: 'none'
                    }}>
                      View details
                    </summary>
                    <div style={{
                      marginTop: '8px',
                      padding: '8px',
                      background: '#F9FAFB',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      color: '#374151',
                      overflow: 'auto',
                      maxHeight: '150px'
                    }}>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {JSON.stringify(log.meta, null, 2)}
                      </pre>
                    </div>
                  </details>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
