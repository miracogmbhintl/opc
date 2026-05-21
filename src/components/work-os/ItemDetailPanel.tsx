import { useState, useEffect } from 'react';
import { X, MessageSquare, Activity, Send, Paperclip, Upload, File, Download, Trash2, FileText, Image as ImageIcon, FileSpreadsheet } from 'lucide-react';
import { baseUrl } from '../../lib/base-url';
import { supabase } from '../../lib/supabase';

interface Comment {
  id: string;
  content: string;
  author: string;
  timestamp: string;
  isInternal: boolean;
}

interface ActivityLog {
  id: string;
  type: string;
  description: string;
  user: string;
  timestamp: string;
}

interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
}

interface ItemDetail {
  id: string;
  name: string;
  values: Record<string, any>;
  comments: Comment[];
  activity: ActivityLog[];
  files: FileAttachment[];
}

interface ItemDetailPanelProps {
  itemId: string;
  boardId: string;
  onClose: () => void;
}

/**
 * ItemDetailPanel - Production Ready Side Popup
 * 
 * Features:
 * - Overview tab with item details
 * - Comments with internal notes capability
 * - File uploads with drag & drop
 * - Activity timeline
 * - Responsive 480px width panel
 * - Clean Miraka design system styling
 */
export default function ItemDetailPanel({ itemId, boardId, onClose }: ItemDetailPanelProps) {
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'comments' | 'activity' | 'files'>('overview');
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadItem();
  }, [itemId]);

  const loadItem = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/work-os/items/${itemId}`);
      if (response.ok) {
        const data = await response.json();
        setItem(data.item);
      }
    } catch (error) {
      console.error('Failed to load item:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendComment = async () => {
    if (!newComment.trim()) return;

    setSending(true);
    try {
      const response = await fetch(`/api/work-os/items/${itemId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newComment.trim(),
          isInternal
        })
      });

      if (response.ok) {
        const data = await response.json();
        setItem(prev => prev ? {
          ...prev,
          comments: [...prev.comments, data.comment]
        } : prev);
        setNewComment('');
      }
    } catch (error) {
      console.error('Failed to send comment:', error);
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (files: FileList) => {
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch(`/api/work-os/items/${itemId}/files`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setItem(prev => prev ? {
          ...prev,
          files: [...prev.files, ...data.files]
        } : prev);
      }
    } catch (error) {
      console.error('Failed to upload files:', error);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Delete this file?')) return;

    try {
      const response = await fetch(`/api/work-os/items/${itemId}/files/${fileId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setItem(prev => prev ? {
          ...prev,
          files: prev.files.filter(f => f.id !== fileId)
        } : prev);
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '480px',
      height: '100%',
      background: '#FFFFFF',
      borderLeft: '1px solid #E5E7EB',
      boxShadow: '-4px 0 16px rgba(0, 0, 0, 0.08)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: 600,
          color: '#1A1A1A',
          margin: 0,
          fontFamily: 'Poppins, sans-serif'
        }}>
          {loading ? 'Loading...' : item?.name || 'Item Details'}
        </h2>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: '#6B6B6B',
            display: 'flex',
            alignItems: 'center',
            transition: 'color 0.15s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#1A1A1A'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#6B6B6B'}
        >
          <X size={20} />
        </button>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #E5E7EB',
        background: '#FAFAFA'
      }}>
        {(['overview', 'comments', 'files', 'activity'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '12px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '4px solid #1A1A1A' : '4px solid transparent',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: activeTab === tab ? 600 : 500,
              color: activeTab === tab ? '#1A1A1A' : '#6B6B6B',
              fontFamily: 'Inter, sans-serif',
              textTransform: 'capitalize',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              borderRadius: 0
            }}
          >
            {tab === 'files' && <Paperclip size={14} />}
            {tab}
            {tab === 'comments' && item && item.comments.length > 0 && (
              <span style={{
                fontSize: '11px',
                background: '#E6E6E6',
                padding: '2px 6px',
                borderRadius: '8px'
              }}>
                {item.comments.length}
              </span>
            )}
            {tab === 'files' && item && item.files && item.files.length > 0 && (
              <span style={{
                fontSize: '11px',
                background: '#E6E6E6',
                padding: '2px 6px',
                borderRadius: '8px'
              }}>
                {item.files.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px'
      }}>
        {loading ? (
          <div style={{ 
            padding: '40px', 
            display: 'flex', 
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div style={{
              width: '24px',
              height: '24px',
              border: '2px solid #E5E5E5',
              borderTop: '2px solid #1A1A1A',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite'
            }} />
          </div>
        ) : activeTab === 'overview' ? (
          <OverviewTab item={item} />
        ) : activeTab === 'comments' ? (
          <CommentsTab
            comments={item?.comments || []}
            newComment={newComment}
            setNewComment={setNewComment}
            isInternal={isInternal}
            setIsInternal={setIsInternal}
            onSend={handleSendComment}
            sending={sending}
          />
        ) : activeTab === 'files' ? (
          <FilesTab
            files={item?.files || []}
            onUpload={handleFileUpload}
            onDelete={handleDeleteFile}
          />
        ) : (
          <ActivityTab activity={item?.activity || []} />
        )}
      </div>
    </div>
  );
}

/* ==========================================
   OVERVIEW TAB
   ========================================== */
function OverviewTab({ item }: { item: ItemDetail | null }) {
  if (!item) return null;

  const entries = Object.entries(item.values);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0'
    }}>
      {entries.map(([key, value], index) => (
        <div key={key}>
          <div style={{
            padding: '20px 0'
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#6B6B6B',
              marginBottom: '8px',
              fontFamily: 'Inter, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {key.replace(/_/g, ' ')}
            </div>
            <div style={{
              fontSize: '15px',
              color: '#1A1A1A',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500
            }}>
              {value || '—'}
            </div>
          </div>
          {index < entries.length - 1 && (
            <div style={{
              height: '2px',
              background: '#E6E6E6',
              width: '100%'
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ==========================================
   COMMENTS TAB
   ========================================== */
interface CommentsTabProps {
  comments: Comment[];
  newComment: string;
  setNewComment: (value: string) => void;
  isInternal: boolean;
  setIsInternal: (value: boolean) => void;
  onSend: () => void;
  sending: boolean;
}

function CommentsTab({
  comments,
  newComment,
  setNewComment,
  isInternal,
  setIsInternal,
  onSend,
  sending
}: CommentsTabProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      {comments.length === 0 ? (
        <div style={{
          padding: '32px',
          textAlign: 'center',
          color: '#6B6B6B',
          fontSize: '14px',
          fontFamily: 'Inter, sans-serif'
        }}>
          No comments yet
        </div>
      ) : (
        comments.map(comment => (
          <div
            key={comment.id}
            style={{
              padding: '12px',
              background: comment.isInternal ? '#FEF3C7' : '#F9FAFB',
              border: `1px solid ${comment.isInternal ? '#FDE68A' : '#E6E6E6'}`,
              borderRadius: '6px'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <div style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#1A1A1A',
                fontFamily: 'Inter, sans-serif'
              }}>
                {comment.author}
              </div>
              <div style={{
                fontSize: '11px',
                color: '#6B6B6B',
                fontFamily: 'Inter, sans-serif'
              }}>
                {new Date(comment.timestamp).toLocaleString()}
              </div>
            </div>
            {comment.isInternal && (
              <div style={{
                fontSize: '10px',
                fontWeight: 600,
                color: '#92400E',
                marginBottom: '6px',
                fontFamily: 'Inter, sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Internal Note
              </div>
            )}
            <div style={{
              fontSize: '13px',
              color: '#1A1A1A',
              fontFamily: 'Inter, sans-serif',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap'
            }}>
              {comment.content}
            </div>
          </div>
        ))
      )}

      <div style={{
        position: 'sticky',
        bottom: 0,
        background: '#FFFFFF',
        paddingTop: '16px',
        borderTop: '1px solid #E6E6E6',
        marginTop: '16px'
      }}>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          style={{
            width: '100%',
            minHeight: '80px',
            padding: '12px',
            border: '1px solid #E6E6E6',
            borderRadius: '6px',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            resize: 'vertical',
            marginBottom: '12px'
          }}
        />

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: '#6B6B6B',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif'
          }}>
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Internal note (hidden from clients)
          </label>

          <button
            onClick={onSend}
            disabled={!newComment.trim() || sending}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              background: newComment.trim() && !sending ? '#1A1A1A' : '#E6E6E6',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: newComment.trim() && !sending ? 'pointer' : 'not-allowed',
              fontFamily: 'Inter, sans-serif'
            }}
          >
            <Send size={14} />
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================
   ACTIVITY TAB
   ========================================== */
function ActivityTab({ activity }: { activity: ActivityLog[] }) {
  if (activity.length === 0) {
    return (
      <div style={{
        padding: '32px',
        textAlign: 'center',
        color: '#6B6B6B',
        fontSize: '14px',
        fontFamily: 'Inter, sans-serif'
      }}>
        No activity yet
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      {activity.map(log => (
        <div
          key={log.id}
          style={{
            padding: '12px',
            background: '#F9FAFB',
            border: '1px solid #E6E6E6',
            borderRadius: '6px'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '6px'
          }}>
            <Activity size={14} color="#6B6B6B" />
            <div style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#1A1A1A',
              fontFamily: 'Inter, sans-serif'
            }}>
              {log.type}
            </div>
          </div>
          <div style={{
            fontSize: '13px',
            color: '#1A1A1A',
            marginBottom: '6px',
            fontFamily: 'Inter, sans-serif'
          }}>
            {log.description}
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#6B6B6B',
            fontFamily: 'Inter, sans-serif'
          }}>
            <span>{log.user}</span>
            <span>{new Date(log.timestamp).toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ==========================================
   FILES TAB
   ========================================== */
interface FilesTabProps {
  files: FileAttachment[];
  onUpload: (files: FileList) => void;
  onDelete: (fileId: string) => void;
}

function FilesTab({ files, onUpload, onDelete }: FilesTabProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      onUpload(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onUpload(e.target.files);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon size={20} color="#6B6B6B" />;
    if (type.includes('spreadsheet') || type.includes('excel')) return <FileSpreadsheet size={20} color="#6B6B6B" />;
    if (type.includes('pdf') || type.includes('document')) return <FileText size={20} color="#6B6B6B" />;
    return <File size={20} color="#6B6B6B" />;
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>
      {/* Upload Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          border: isDragging ? '2px dashed #1A1A1A' : '2px dashed #E6E6E6',
          borderRadius: '8px',
          padding: '32px',
          textAlign: 'center',
          background: isDragging ? '#FAFAFA' : 'transparent',
          transition: 'all 0.2s',
          cursor: 'pointer'
        }}
        onClick={() => document.getElementById('file-upload')?.click()}
      >
        <Upload size={32} color={isDragging ? '#1A1A1A' : '#9A9A9A'} style={{ margin: '0 auto 12px' }} />
        <p style={{
          fontSize: '14px',
          fontWeight: 500,
          color: '#1A1A1A',
          margin: '0 0 6px 0',
          fontFamily: 'Inter, sans-serif'
        }}>
          Drop files here or click to browse
        </p>
        <p style={{
          fontSize: '12px',
          color: '#6B6B6B',
          margin: 0,
          fontFamily: 'Inter, sans-serif'
        }}>
          Supports: Images, PDFs, Documents, Spreadsheets
        </p>
        <input
          id="file-upload"
          type="file"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {/* Files List */}
      {files.length === 0 ? (
        <div style={{
          padding: '32px',
          textAlign: 'center',
          color: '#6B6B6B',
          fontSize: '14px',
          fontFamily: 'Inter, sans-serif'
        }}>
          No files uploaded yet
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#6B6B6B',
            fontFamily: 'Inter, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '4px'
          }}>
            Uploaded Files ({files.length})
          </div>

          {files.map(file => (
            <div
              key={file.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                background: '#F9FAFB',
                border: '1px solid #E6E6E6',
                borderRadius: '6px',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#F2F2F2'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#F9FAFB'}
            >
              <div style={{ flexShrink: 0 }}>
                {getFileIcon(file.type)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#1A1A1A',
                  fontFamily: 'Inter, sans-serif',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {file.name}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: '#6B6B6B',
                  fontFamily: 'Inter, sans-serif',
                  display: 'flex',
                  gap: '8px',
                  marginTop: '2px'
                }}>
                  <span>{formatFileSize(file.size)}</span>
                  <span>•</span>
                  <span>{file.uploadedBy}</span>
                  <span>•</span>
                  <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div style={{
                display: 'flex',
                gap: '6px',
                flexShrink: 0
              }}>
                <a
                  href={file.url}
                  download={file.name}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    color: '#6B6B6B',
                    borderRadius: '4px',
                    textDecoration: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#E6E6E6';
                    e.currentTarget.style.color = '#1A1A1A';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#6B6B6B';
                  }}
                >
                  <Download size={16} />
                </a>

                <button
                  onClick={() => onDelete(file.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    color: '#6B6B6B',
                    borderRadius: '4px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#FEE2E2';
                    e.currentTarget.style.color = '#DC2626';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#6B6B6B';
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




