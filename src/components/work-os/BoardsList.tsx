import { useState, useEffect } from 'react';
import { Folder, Archive, Plus, X } from 'lucide-react';
import { baseUrl } from '../../lib/base-url';

interface Board {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  project_id?: string;
  internal_only: boolean;
  columns_config?: any;
  view_mode?: string;
  is_template: boolean;
  is_archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface BoardsListProps {
  onBoardSelect: (boardId: string) => void;
  onCreateBoard?: () => void;
}

export default function BoardsList({ onBoardSelect, onCreateBoard }: BoardsListProps) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [workspaceFilter, setWorkspaceFilter] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setWorkspaceFilter(params.get('workspace_id'));
  }, []);

  useEffect(() => {
    if (workspaceFilter === undefined) return;
    loadBoards(workspaceFilter, showArchived);
  }, [workspaceFilter, showArchived]);

  const loadBoards = async (workspaceId: string | null, includeArchived: boolean) => {
    setLoading(true);

    try {
      const queryParams = new URLSearchParams();

      if (workspaceId) {
        queryParams.set('workspace_id', workspaceId);
      }

      if (includeArchived) {
        queryParams.set('include_archived', 'true');
      }

      const queryString = queryParams.toString();
      const url = queryString
        ? `/api/work-os/boards?${queryString}`
        : `/api/work-os/boards`;

      const response = await fetch(url, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load boards');
      }

      const data = await response.json();
      setBoards(data.boards || []);
    } catch (error) {
      console.error('Failed to load boards:', error);
      setBoards([]);
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveBoard = async (boardId: string) => {
    try {
      const response = await fetch(`/api/work-os/boards/${boardId}/archive`, {
        method: 'PATCH',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to archive board');
      }

      await loadBoards(workspaceFilter ?? null, showArchived);
    } catch (error) {
      console.error('Failed to archive board:', error);
    }
  };

  const handleClearFilter = () => {
    window.location.href = `${baseUrl}/work-os/boards`;
  };

  const activeBoards = boards.filter((b) => !b.is_archived);
  const archivedBoards = boards.filter((b) => b.is_archived);
  const displayBoards = showArchived ? archivedBoards : activeBoards;

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '400px',
          fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              margin: '0 auto 16px',
              border: '3px solid #F3F4F6',
              borderTopColor: '#1A1A1A',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }}
          />
          <p
            style={{
              fontSize: '14px',
              color: '#6B7280',
              margin: 0
            }}
          >
            Loading boards...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
        padding: '24px'
      }}
    >
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 600,
              color: '#1A1A1A',
              margin: 0
            }}
          >
            {showArchived ? 'Archived Boards' : 'Boards'}
          </h2>

          {workspaceFilter && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#1E40AF',
                fontWeight: 500,
                alignSelf: 'flex-start'
              }}
            >
              <Folder size={14} />
              <span>Filtered by workspace</span>
              <button
                onClick={handleClearFilter}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '16px',
                  height: '16px',
                  padding: 0,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#1E40AF',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#1E3A8A')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#1E40AF')}
                title="Clear filter"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center'
          }}
        >
          <button
            onClick={() => setShowArchived(!showArchived)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: showArchived ? '#1A1A1A' : 'transparent',
              color: showArchived ? '#FFFFFF' : '#1A1A1A',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!showArchived) {
                e.currentTarget.style.background = '#F9FAFB';
              }
            }}
            onMouseLeave={(e) => {
              if (!showArchived) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <Archive size={16} />
            {showArchived ? 'Show Active' : 'Show Archived'}
          </button>

          {onCreateBoard && !showArchived && (
            <button
              onClick={onCreateBoard}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: '#1A1A1A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#2A2A2A')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#1A1A1A')}
            >
              <Plus size={16} />
              New Board
            </button>
          )}
        </div>
      </div>

      {displayBoards.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '14px'
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 16px',
              background: '#F3F4F6',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px'
            }}
          >
            {showArchived ? '📦' : '📋'}
          </div>
          <h3
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#1A1A1A',
              margin: '0 0 8px 0'
            }}
          >
            {showArchived ? 'No archived boards' : 'No boards yet'}
          </h3>
          <p
            style={{
              fontSize: '14px',
              color: '#6B7280',
              margin: 0,
              lineHeight: 1.6
            }}
          >
            {showArchived
              ? 'Archived boards will appear here.'
              : workspaceFilter
              ? 'No boards found in this workspace.'
              : 'Create your first board to get started.'}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px'
          }}
        >
          {displayBoards.map((board) => (
            <div
              key={board.id}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '12px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                position: 'relative'
              }}
              onClick={() => onBoardSelect(board.id)}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#1A1A1A';
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#E5E7EB';
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: '12px'
                }}
              >
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    margin: 0,
                    flex: 1
                  }}
                >
                  {board.name}
                </h3>

                {!showArchived && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleArchiveBoard(board.id);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      padding: 0,
                      background: 'transparent',
                      border: '1px solid #E5E7EB',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      color: '#6B7280',
                      transition: 'all 0.2s',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#F9FAFB';
                      e.currentTarget.style.borderColor = '#1A1A1A';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = '#E5E7EB';
                    }}
                    title="Archive board"
                  >
                    <Archive size={14} />
                  </button>
                )}
              </div>

              {board.description && (
                <p
                  style={{
                    fontSize: '14px',
                    color: '#6B7280',
                    margin: '0 0 12px 0',
                    lineHeight: 1.5
                  }}
                >
                  {board.description}
                </p>
              )}

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}
              >
                {board.internal_only && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 8px',
                      background: '#FEF2F2',
                      color: '#DC2626',
                      fontSize: '11px',
                      fontWeight: 500,
                      borderRadius: '4px'
                    }}
                  >
                    Internal
                  </span>
                )}

                {board.is_template && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 8px',
                      background: '#FEF3C7',
                      color: '#92400E',
                      fontSize: '11px',
                      fontWeight: 500,
                      borderRadius: '4px'
                    }}
                  >
                    Template
                  </span>
                )}

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 8px',
                    background: '#F3F4F6',
                    color: '#6B7280',
                    fontSize: '11px',
                    fontWeight: 500,
                    borderRadius: '4px'
                  }}
                >
                  {new Date(board.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

