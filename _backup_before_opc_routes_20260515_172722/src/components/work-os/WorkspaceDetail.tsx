import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Grid, MoreVertical, Edit2, Trash2, Archive, ExternalLink, Clock, User, ChevronDown, ChevronUp, ChevronRight, X } from 'lucide-react';
import { baseUrl } from '../../lib/base-url';
import BoardTemplateSelector from './BoardTemplateSelector';
import KanbanView from './KanbanView';
import TableView from './TableView';
import ActivityBar from './ActivityBar';

interface Workspace {
  id: string;
  name: string;
  color: string;
  description?: string;
  createdAt: string;
  createdBy?: string;
  lastModified?: string;
  lastModifiedBy?: string;
}

interface Board {
  id: string;
  name: string;
  type: 'Project' | 'Content' | 'CRM' | 'Dispatch';
  visibility: 'Internal' | 'Client';
  openItems: number;
  totalItems: number;
  lastUpdated: string;
  workspace?: string;
}

interface WorkspaceStats {
  totalBoards: number;
  totalItems: number;
  openItems: number;
  completedItems: number;
}

export default function WorkspaceDetail({ baseUrl: baseUrlProp }: { baseUrl: string }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [stats, setStats] = useState<WorkspaceStats>({
    totalBoards: 0,
    totalItems: 0,
    openItems: 0,
    completedItems: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'table'>('list');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const workspaceId = window.location.pathname.split('/').pop();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const userName = currentUser.email || currentUser.name || 'Unknown User';

  useEffect(() => {
    loadWorkspaceData();
  }, [workspaceId]);

  const loadWorkspaceData = async () => {
    setLoading(true);
    try {
      // Load workspace from localStorage
      const workspaces = JSON.parse(localStorage.getItem('workos_workspaces') || '[]');
      const foundWorkspace = workspaces.find((w: Workspace) => w.id === workspaceId);
      
      if (foundWorkspace) {
        setWorkspace(foundWorkspace);
      }

      // Load boards from localStorage
      const allBoards = JSON.parse(localStorage.getItem('workos_boards') || '[]');
      const workspaceBoards = allBoards.filter((b: any) => b.workspace === workspaceId);
      setBoards(workspaceBoards);

      // Calculate stats
      const totalItems = workspaceBoards.reduce((sum: number, b: any) => sum + (b.totalItems || 0), 0);
      const openItems = workspaceBoards.reduce((sum: number, b: any) => sum + (b.openItems || 0), 0);
      
      setStats({
        totalBoards: workspaceBoards.length,
        totalItems: totalItems,
        openItems: openItems,
        completedItems: totalItems - openItems
      });
    } catch (error) {
      console.error('Failed to load workspace data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspace) return;
    if (!confirm(`Delete "${workspace.name}"? All boards will be moved to "All Boards".`)) return;

    try {
      const workspaces = JSON.parse(localStorage.getItem('workos_workspaces') || '[]');
      const updatedWorkspaces = workspaces.filter((w: Workspace) => w.id !== workspace.id);
      localStorage.setItem('workos_workspaces', JSON.stringify(updatedWorkspaces));

      // Remove workspace assignment from boards
      const allBoards = JSON.parse(localStorage.getItem('workos_boards') || '[]');
      const updatedBoards = allBoards.map((b: any) =>
        b.workspace === workspace.id ? { ...b, workspace: null } : b
      );
      localStorage.setItem('workos_boards', JSON.stringify(updatedBoards));

      window.location.href = `${baseUrl}/work-os`;
    } catch (error) {
      console.error('Failed to delete workspace:', error);
    }
  };

  const handleCreateBoard = () => {
    setShowCreateModal(true);
  };

  const handleArchiveBoard = async (boardId: string) => {
    if (!confirm('Archive this board?')) return;
    
    try {
      const allBoards = JSON.parse(localStorage.getItem('workos_boards') || '[]');
      const updatedBoards = allBoards.filter((b: any) => b.id !== boardId);
      localStorage.setItem('workos_boards', JSON.stringify(updatedBoards));
      setBoards(boards.filter(b => b.id !== boardId));
      setActiveMenu(null);
      loadWorkspaceData();
    } catch (error) {
      console.error('Failed to archive board:', error);
    }
  };

  const handleOpenBoard = (boardId: string) => {
    const board = boards.find(b => b.id === boardId);
    if (board) {
      setSelectedBoard(board);
    }
  };

  const closeBoard = () => {
    setSelectedBoard(null);
  };

  if (loading) {
    return (
      <div style={{
        padding: '40px',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px'
      }}>
        <div style={{
          fontSize: '15px',
          color: '#6B6B6B',
          fontFamily: 'Inter, sans-serif'
        }}>
          Loading workspace...
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div style={{
        padding: '40px',
        width: '100%',
        textAlign: 'center'
      }}>
        <h2 style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: '22px',
          fontWeight: 600,
          color: '#1A1A1A',
          marginBottom: '12px'
        }}>
          Workspace not found
        </h2>
        <button
          onClick={() => window.location.href = `${baseUrl}/work-os`}
          style={{
            padding: '10px 20px',
            background: '#1A1A1A',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif'
          }}
        >
          Back to Tasks
        </button>
      </div>
    );
  }

  if (selectedBoard) {
    return (
      <div style={{ width: '100%', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '20px 40px',
          borderBottom: '1px solid #E5E7EB',
          background: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <button
            onClick={closeBoard}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'transparent',
              border: 'none',
              color: '#6B6B6B',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              padding: '4px 0'
            }}
          >
            <ArrowLeft size={16} />
            Back to {workspace.name}
          </button>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '8px 16px',
                background: viewMode === 'list' ? '#1A1A1A' : 'transparent',
                color: viewMode === 'list' ? '#FFFFFF' : '#6B6B6B',
                border: '1px solid #E6E6E6',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              style={{
                padding: '8px 16px',
                background: viewMode === 'kanban' ? '#1A1A1A' : 'transparent',
                color: viewMode === 'kanban' ? '#FFFFFF' : '#6B6B6B',
                border: '1px solid #E6E6E6',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              Kanban
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding: '8px 16px',
                background: viewMode === 'table' ? '#1A1A1A' : 'transparent',
                color: viewMode === 'table' ? '#FFFFFF' : '#6B6B6B',
                border: '1px solid #E6E6E6',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              Table
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {viewMode === 'kanban' && <KanbanView boardId={selectedBoard.id} baseUrl={baseUrl} />}
          {viewMode === 'table' && <TableView boardId={selectedBoard.id} baseUrl={baseUrl} />}
          {viewMode === 'list' && (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ color: '#6B6B6B', fontFamily: 'Inter, sans-serif' }}>
                List view coming soon...
              </p>
            </div>
          )}
        </div>

        <ActivityBar boardId={selectedBoard.id} />
      </div>
    );
  }

  return (
    <div style={{
      padding: '40px',
      width: '100%'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px'
      }}>
        <button
          onClick={() => window.location.href = `${baseUrl}/work-os`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'transparent',
            border: 'none',
            color: '#6B6B6B',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            padding: '4px 0'
          }}
        >
          <ArrowLeft size={16} />
          Back to Tasks
        </button>

        <button
          onClick={handleCreateBoard}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: '#1A1A1A',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            transition: 'all 0.2s',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#2A2A2A';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#1A1A1A';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <Plus size={18} />
          New Board
        </button>
      </div>

      {/* Main Content - Matches Tickets Page Layout */}
      <div style={{ padding: '0' }}>
        {/* Page Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '24px'
          }}>
            <div>
              <h1 style={{
                fontSize: '28px',
                fontWeight: 600,
                color: '#1A1A1A',
                margin: '0 0 4px 0',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
                letterSpacing: '-0.02em'
              }}>
                {workspace.name}
              </h1>
              <p style={{
                fontSize: '15px',
                color: '#6B7280',
                margin: 0,
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
              }}>
                {workspace.description || 'Manage boards in this workspace'}
              </p>
            </div>

            <button
              onClick={handleCreateBoard}
              className="work-os-btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: '#1A1A1A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.2s ease',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#2A2A2A'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#1A1A1A'}
            >
              <Plus size={18} strokeWidth={2} />
              <span>New Board</span>
            </button>
          </div>

          {/* Stats Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px'
          }}>
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '14px',
              padding: '20px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              transition: 'box-shadow 0.2s ease'
            }}>
              <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '8px', fontWeight: 500, letterSpacing: '0.3px' }}>
                Total Boards
              </div>
              <div style={{ fontSize: '36px', fontWeight: 600, color: '#1A1A1A', lineHeight: 1, marginBottom: '4px' }}>
                {stats.totalBoards}
              </div>
              <div style={{ fontSize: '13px', color: '#9CA3AF' }}>
                In this workspace
              </div>
            </div>

            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '14px',
              padding: '20px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              transition: 'box-shadow 0.2s ease'
            }}>
              <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '8px', fontWeight: 500, letterSpacing: '0.3px' }}>
                Total Items
              </div>
              <div style={{ fontSize: '36px', fontWeight: 600, color: '#1A1A1A', lineHeight: 1, marginBottom: '4px' }}>
                {stats.totalItems}
              </div>
              <div style={{ fontSize: '13px', color: '#9CA3AF' }}>
                Across all boards
              </div>
            </div>

            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '14px',
              padding: '20px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              transition: 'box-shadow 0.2s ease'
            }}>
              <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '8px', fontWeight: 500, letterSpacing: '0.3px' }}>
                Open Items
              </div>
              <div style={{ fontSize: '36px', fontWeight: 600, color: '#1A1A1A', lineHeight: 1, marginBottom: '4px' }}>
                {stats.openItems}
              </div>
              <div style={{ fontSize: '13px', color: '#9CA3AF' }}>
                In progress
              </div>
            </div>

            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '14px',
              padding: '20px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              transition: 'box-shadow 0.2s ease'
            }}>
              <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '8px', fontWeight: 500, letterSpacing: '0.3px' }}>
                Completed
              </div>
              <div style={{ fontSize: '36px', fontWeight: 600, color: '#1A1A1A', lineHeight: 1, marginBottom: '4px' }}>
                {stats.completedItems}
              </div>
              <div style={{ fontSize: '13px', color: '#9CA3AF' }}>
                Finished items
              </div>
            </div>
          </div>
        </div>

        {/* Boards List or Empty State */}
        {boards.length === 0 ? (
          /* Empty State */
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '14px',
            padding: '80px 20px',
            textAlign: 'center',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 16px',
              background: '#F3F4F6',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Grid size={32} color="#9CA3AF" strokeWidth={1.5} />
            </div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '8px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
            }}>
              No boards found
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#6B7280',
              marginBottom: '24px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
            }}>
              Create your first board to get started
            </p>
            <button
              onClick={handleCreateBoard}
              style={{
                padding: '10px 20px',
                background: '#1A1A1A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
              }}
            >
              Create Board
            </button>
          </div>
        ) : (
          /* Boards List */
          <div style={{
            display: 'grid',
            gap: '16px'
          }}>
            {boards.map(board => (
              <div
                key={board.id}
                onClick={() => handleOpenBoard(board.id)}
                style={{
                  background: '#FFFFFF',
                  padding: '24px',
                  borderRadius: '14px',
                  border: '1px solid #E5E7EB',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#9CA3AF';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <div
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '3px',
                          background: workspace.color
                        }}
                      />
                      <h3 style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        color: '#1A1A1A',
                        margin: 0,
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                      }}>
                        {board.name}
                      </h3>

                      <div style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 500,
                        background: '#F3F4F6',
                        color: '#1A1A1A'
                      }}>
                        {board.type}
                      </div>

                      <div style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 500,
                        background: board.visibility === 'Internal' ? '#F3F4F6' : '#EFF6FF',
                        color: board.visibility === 'Internal' ? '#1A1A1A' : '#1E40AF'
                      }}>
                        {board.visibility}
                      </div>
                    </div>

                    <p style={{
                      fontSize: '14px',
                      color: '#6B7280',
                      marginBottom: '12px',
                      lineHeight: 1.6,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                    }}>
                      {board.openItems} open items · {board.totalItems} total items
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{
                        fontSize: '13px',
                        color: '#9CA3AF',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                      }}>
                        Last updated: {new Date(board.lastUpdated).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Chevron Icon */}
                  <div style={{ 
                    marginLeft: '20px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <ChevronRight size={20} color="#9CA3AF" strokeWidth={2} />
                  </div>
                </div>

                {/* 3-dot menu button - separate from card click */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenu(activeMenu === board.id ? null : board.id);
                  }}
                  style={{
                    position: 'absolute',
                    top: '20px',
                    right: '50px',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '6px',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <MoreVertical size={18} color="#6B6B6B" />
                </div>

                {activeMenu === board.id && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      right: '50px',
                      top: '52px',
                      background: '#FFFFFF',
                      border: '1px solid #E6E6E6',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      zIndex: 100,
                      minWidth: '160px',
                      overflow: 'hidden'
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenBoard(board.id);
                        setActiveMenu(null);
                      }}
                      style={{
                        ...boardMenuItemStyle,
                        minHeight: '40px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <ExternalLink size={14} />
                      Open Board
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenu(null);
                      }}
                      style={{
                        ...boardMenuItemStyle,
                        minHeight: '40px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <Edit2 size={14} />
                      Rename
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchiveBoard(board.id);
                      }}
                      style={{
                        ...boardMenuItemStyle,
                        color: '#DC2626',
                        borderBottom: 'none',
                        minHeight: '40px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#FEF2F2'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <Archive size={14} />
                      Archive
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateBoardModal
          workspaceId={workspaceId!}
          workspaceColor={workspace.color}
          onClose={() => setShowCreateModal(false)}
          onCreated={(board) => {
            setBoards([...boards, board]);
            setShowCreateModal(false);
            loadWorkspaceData();
          }}
        />
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: '14px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
      transition: 'all 0.2s ease',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '4px',
          height: '100%',
          background: color
        }}
      />
      <div style={{ color: '#6B6B6B' }}>
        {icon}
      </div>
      <div style={{
        fontSize: '28px',
        fontWeight: 700,
        color: '#1A1A1A',
        fontFamily: 'Poppins, sans-serif'
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '13px',
        color: '#6B7280',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 500,
        letterSpacing: '0.3px'
      }}>
        {label}
      </div>
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid #F2F2F2',
  cursor: 'pointer',
  fontSize: '13px',
  color: '#1A1A1A',
  fontFamily: 'Inter, sans-serif',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  textAlign: 'left',
  fontWeight: 500,
  transition: 'background 0.15s'
};

const typeBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '4px 10px',
  background: '#F2F2F2',
  color: '#1A1A1A',
  fontSize: '12px',
  fontWeight: 500,
  borderRadius: '4px',
  fontFamily: 'Inter, sans-serif'
};

const boardMenuItemStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid #F2F2F2',
  cursor: 'pointer',
  fontSize: '13px',
  color: '#1A1A1A',
  fontFamily: 'Inter, sans-serif',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  textAlign: 'left',
  transition: 'background 0.15s'
};

interface CreateBoardModalProps {
  workspaceId: string;
  workspaceColor: string;
  onClose: () => void;
  onCreated: (board: Board) => void;
}

function CreateBoardModal({ workspaceId, workspaceColor, onClose, onCreated }: CreateBoardModalProps) {
  const [step, setStep] = useState<'template' | 'details'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<Board['type']>('Project');
  const [visibility, setVisibility] = useState<Board['visibility']>('Internal');
  const [creating, setCreating] = useState(false);

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    if (template.id === 'blank') {
      setName('');
    } else {
      setName(template.name);
    }
    setStep('details');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    try {
      const newBoard: Board = {
        id: Date.now().toString(),
        name: name.trim(),
        type,
        visibility,
        openItems: 0,
        totalItems: 0,
        lastUpdated: new Date().toISOString()
      };

      const allBoards = JSON.parse(localStorage.getItem('workos_boards') || '[]');
      const updatedBoards = [...allBoards, { ...newBoard, workspace: workspaceId }];
      localStorage.setItem('workos_boards', JSON.stringify(updatedBoards));

      onCreated(newBoard);
    } catch (error) {
      console.error('Failed to create board:', error);
    } finally {
      setCreating(false);
    }
  };

  if (step === 'template') {
    return (
      <BoardTemplateSelector
        onSelectTemplate={handleTemplateSelect}
        onCancel={onClose}
      />
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(2px)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          padding: '32px',
          width: '480px',
          maxWidth: '90%',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          border: `2px solid ${workspaceColor}`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: '22px',
          fontWeight: 600,
          color: '#1A1A1A',
          margin: '0 0 8px 0'
        }}>
          Create Board
        </h2>

        {selectedTemplate?.id !== 'blank' && (
          <p style={{
            fontSize: '13px',
            color: '#6B6B6B',
            fontFamily: 'Inter, sans-serif',
            margin: '0 0 24px 0'
          }}>
            Using template: <strong>{selectedTemplate?.name}</strong>
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '8px',
              fontFamily: 'Inter, sans-serif'
            }}>
              Board Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q1 Projects"
              autoFocus
              style={{
                width: '100%',
                height: '42px',
                padding: '0 14px',
                border: '1px solid #E6E6E6',
                borderRadius: '16px',
                fontSize: '14px',
                fontFamily: 'Inter, sans-serif',
                background: '#FFFFFF',
                color: '#1A1A1A'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '8px',
              fontFamily: 'Inter, sans-serif'
            }}>
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as Board['type'])}
              style={{
                width: '100%',
                height: '42px',
                padding: '0 14px',
                border: '1px solid #E6E6E6',
                borderRadius: '16px',
                fontSize: '14px',
                fontFamily: 'Inter, sans-serif',
                background: '#FFFFFF',
                color: '#1A1A1A',
                cursor: 'pointer'
              }}
            >
              <option value="Project">Project</option>
              <option value="Content">Content</option>
              <option value="CRM">CRM</option>
              <option value="Dispatch">Dispatch</option>
            </select>
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '8px',
              fontFamily: 'Inter, sans-serif'
            }}>
              Visibility
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Board['visibility'])}
              style={{
                width: '100%',
                height: '42px',
                padding: '0 14px',
                border: '1px solid #E6E6E6',
                borderRadius: '16px',
                fontSize: '14px',
                fontFamily: 'Inter, sans-serif',
                background: '#FFFFFF',
                color: '#1A1A1A',
                cursor: 'pointer'
              }}
            >
              <option value="Internal">Internal</option>
              <option value="Client">Client</option>
            </select>
          </div>

          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={() => setStep('template')}
              style={{
                padding: '10px 20px',
                background: 'transparent',
                border: '1px solid #E6E6E6',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#1A1A1A',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!name.trim() || creating}
              style={{
                padding: '10px 20px',
                background: name.trim() && !creating ? workspaceColor : '#E6E6E6',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#FFFFFF',
                cursor: name.trim() && !creating ? 'pointer' : 'not-allowed',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              {creating ? 'Creating...' : 'Create Board'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}











