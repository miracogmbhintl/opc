import { useState, useEffect } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import TaskDetailPanel from './TaskDetailPanel';
import CreateTaskModal from './CreateTaskModal';

interface BoardMetadata {
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

interface Group {
  id: string;
  board_id: string;
  name: string;
  color?: string;
  order_index: number;
  is_collapsed: boolean;
  created_at: string;
  updated_at: string;
}

interface Task {
  id: string;
  group_id: string | null;
  board_id: string;
  name: string;
  description?: string;
  status?: string;
  priority?: string;
  due_date?: string;
  start_date?: string;
  progress_percent?: number;
  position: number;
  custom_fields?: any;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface BoardViewProps {
  boardId: string;
}

export default function BoardView({ boardId }: BoardViewProps) {
  const [board, setBoard] = useState<BoardMetadata | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [initialGroupId, setInitialGroupId] = useState<string | undefined>(undefined);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editError, setEditError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    group_id: '',
    description: '',
    status: '',
    priority: '',
    start_date: '',
    due_date: '',
    progress_percent: ''
  });

  useEffect(() => {
    if (!boardId) {
      setError('Board ID is required');
      setLoading(false);
      return;
    }

    loadBoardData();
  }, [boardId]);

  const loadBoardData = async () => {
    setLoading(true);

    try {
      const boardResponse = await fetch(`/api/work-os/boards/${boardId}`);

      if (!boardResponse.ok) {
        throw new Error('Failed to load board');
      }

      const boardData = await boardResponse.json();
      setBoard(boardData.board || null);

      const [groupsResult, tasksResult] = await Promise.allSettled([
        fetch(`/api/work-os/boards/${boardId}/groups`),
        fetch(`/api/work-os/boards/${boardId}/items`)
      ]);

      if (groupsResult.status === 'fulfilled' && groupsResult.value.ok) {
        const groupsData = await groupsResult.value.json();
        setGroups(groupsData.groups || []);
      } else {
        setGroups([]);
      }

      if (tasksResult.status === 'fulfilled' && tasksResult.value.ok) {
        const tasksData = await tasksResult.value.json();
        setTasks(tasksData.items || []);
      } else {
        setTasks([]);
      }
    } catch (error) {
      console.error('Failed to load board data:', error);
      setBoard(null);
      setGroups([]);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async (): Promise<Task[]> => {
    try {
      const response = await fetch(`/api/work-os/boards/${boardId}/items`);
      if (!response.ok) {
        throw new Error('Failed to reload tasks');
      }
      const data = await response.json();
      const freshTasks = data.items || [];
      setTasks(freshTasks);
      return freshTasks;
    } catch (error) {
      console.error('Failed to reload tasks:', error);
      return [];
    }
  };

  const formatDateForInput = (dateString?: string) => {
    if (!dateString) return '';
    return dateString.split('T')[0];
  };

  const handleBack = () => {
    window.location.href = `${baseUrl}/work-os/boards`;
  };

  const handleTaskClick = (taskId: string) => {
    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
      setIsEditMode(false);
      setEditError('');
      return;
    }

    const task = tasks.find((t) => t.id === taskId);
    setSelectedTaskId(taskId);
    setIsEditMode(false);
    setEditError('');

    if (task) {
      setEditForm({
        name: task.name || '',
        group_id: task.group_id || '',
        description: task.description || '',
        status: task.status || '',
        priority: task.priority || '',
        start_date: task.start_date || '',
        due_date: task.due_date || '',
        progress_percent:
          task.progress_percent !== undefined && task.progress_percent !== null
            ? String(task.progress_percent)
            : ''
      });
    }
  };

  const handleClosePanel = () => {
    setSelectedTaskId(null);
  };

  const handleEditTask = () => {
    const task = tasks.find((t) => t.id === selectedTaskId);
    if (!task) return;

    setEditForm({
      name: task.name || '',
      group_id: task.group_id || '',
      description: task.description || '',
      status: task.status || '',
      priority: task.priority || '',
      start_date: task.start_date || '',
      due_date: task.due_date || '',
      progress_percent:
        task.progress_percent !== undefined && task.progress_percent !== null
          ? String(task.progress_percent)
          : ''
    });
    setEditError('');
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditError('');
  };

  const handleSaveEdit = async () => {
    if (!selectedTaskId || !editForm) return;
    setIsSaving(true);
    setEditError(null);

    try {
      const response = await fetch(`/api/work-os/items/${selectedTaskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to save task');
      }

      const freshTasks = await loadTasks();

      const updatedTask = freshTasks.find((task) => task.id === selectedTaskId);
      if (updatedTask) {
        setEditForm({
          name: updatedTask.name || '',
          group_id: updatedTask.group_id || '',
          description: updatedTask.description || '',
          status: updatedTask.status || '',
          priority: updatedTask.priority || '',
          start_date: updatedTask.start_date || '',
          due_date: updatedTask.due_date || '',
          progress_percent:
            updatedTask.progress_percent !== undefined && updatedTask.progress_percent !== null
              ? String(updatedTask.progress_percent)
              : ''
        });
      }

      setIsEditMode(false);
      setEditError('');
    } catch (error: any) {
      setEditError(error?.message || 'Failed to save task');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenCreateModal = () => {
    setInitialGroupId(undefined);
    setIsCreateModalOpen(true);
  };

  const handleOpenCreateModalForGroup = (groupId: string) => {
    setInitialGroupId(groupId);
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setInitialGroupId(undefined);
  };

  const handleCreateTaskSuccess = () => {
    loadBoardData();
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'done':
        return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
      case 'in_progress':
        return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' };
      case 'blocked':
        return { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' };
      case 'review':
        return { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' };
      case 'todo':
        return { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' };
      default:
        return { bg: '#F9FAFB', text: '#4B5563', border: '#E5E7EB' };
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' };
      case 'high':
        return { bg: '#FFF7ED', text: '#C2410C', border: '#FDBA74' };
      case 'medium':
        return { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' };
      case 'low':
        return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' };
      default:
        return { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' };
    }
  };

  const sortTasks = (items: Task[]) => {
    return [...items].sort((a, b) => {
      if (a.position !== b.position) {
        return a.position - b.position;
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  };

  const getTasksForGroup = (groupId: string) => {
    return sortTasks(tasks.filter((task) => task.group_id === groupId));
  };

  const getOrphanedTasks = () => {
    const groupIds = new Set(groups.map((group) => group.id));
    return sortTasks(tasks.filter((task) => !task.group_id || !groupIds.has(task.group_id)));
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString();
  };

  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) : null;

  const renderTaskCard = (task: Task) => {
    const statusColors = getStatusColor(task.status);
    const priorityColors = getPriorityColor(task.priority);
    const isSelected = selectedTaskId === task.id;

    return (
      <div
        key={task.id}
        onClick={() => handleTaskClick(task.id)}
        style={{
          background: isSelected ? '#F0F9FF' : '#FFFFFF',
          border: isSelected ? '2px solid #2563EB' : '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: isSelected ? '19px' : '20px',
          transition: 'all 0.2s ease',
          boxShadow: isSelected ? '0 4px 6px rgba(37, 99, 235, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.04)',
          cursor: 'pointer'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '8px'
          }}
        >
          <h4
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#1A1A1A',
              margin: 0,
              flex: 1
            }}
          >
            {task.name}
          </h4>

          {task.progress_percent !== undefined && task.progress_percent !== null && (
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#6B7280',
                marginLeft: '12px'
              }}
            >
              {task.progress_percent}%
            </span>
          )}
        </div>

        {task.description && (
          <p
            style={{
              fontSize: '14px',
              color: '#6B7280',
              margin: '0 0 12px 0',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {task.description}
          </p>
        )}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignItems: 'center'
          }}
        >
          {task.status && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 10px',
                background: statusColors.bg,
                color: statusColors.text,
                border: `1px solid ${statusColors.border}`,
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '6px'
              }}
            >
              {task.status.replace('_', ' ')}
            </span>
          )}

          {task.priority && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 10px',
                background: priorityColors.bg,
                color: priorityColors.text,
                border: `1px solid ${priorityColors.border}`,
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '6px'
              }}
            >
              {task.priority}
            </span>
          )}

          {task.due_date && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 10px',
                background: '#F3F4F6',
                color: '#4B5563',
                border: '1px solid #E5E7EB',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '6px'
              }}
            >
              Due: {formatDate(task.due_date)}
            </span>
          )}
        </div>

        {task.progress_percent !== undefined && task.progress_percent !== null && (
          <div
            style={{
              marginTop: '12px',
              width: '100%',
              height: '6px',
              background: '#E5E7EB',
              borderRadius: '3px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${task.progress_percent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #2563EB, #3B82F6)',
                borderRadius: '3px',
                transition: 'width 0.3s ease'
              }}
            />
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FFFFFF',
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
            Loading board...
          </p>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FFFFFF',
          fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
          padding: '40px'
        }}
      >
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 600,
            color: '#1A1A1A',
            margin: '0 0 8px 0'
          }}
        >
          Board not found
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: '#6B7280',
            margin: '0 0 24px 0'
          }}
        >
          This board may have been deleted or you don&apos;t have access.
        </p>
        <button
          onClick={handleBack}
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
            fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
          }}
        >
          <ArrowLeft size={16} />
          Back to Boards
        </button>
      </div>
    );
  }

  const orphanedTasks = getOrphanedTasks();

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        background: '#FAFBFC',
        fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
        position: 'relative'
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'margin-right 0.3s ease'
        }}
      >
        <div
          style={{
            background: '#FFFFFF',
            borderBottom: '1px solid #E5E7EB',
            padding: '20px 32px'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}
          >
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleBack}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#1A1A1A',
                  cursor: 'pointer',
                  fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <ArrowLeft size={16} />
                Back to Boards
              </button>

              <button
                onClick={handleOpenCreateModal}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  background: '#2563EB',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#1D4ED8')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#2563EB')}
              >
                <Plus size={16} />
                New Task
              </button>
            </div>
          </div>

          <h1
            style={{
              fontSize: '28px',
              fontWeight: 600,
              color: '#1A1A1A',
              margin: '0 0 8px 0',
              letterSpacing: '-0.02em'
            }}
          >
            {board.name}
          </h1>

          {board.description && (
            <p
              style={{
                fontSize: '15px',
                color: '#6B7280',
                margin: '0 0 16px 0',
                maxWidth: '600px'
              }}
            >
              {board.description}
            </p>
          )}

          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '6px 12px',
                background: board.internal_only ? '#FEF2F2' : '#EFF6FF',
                color: board.internal_only ? '#DC2626' : '#1E40AF',
                fontSize: '13px',
                fontWeight: 500,
                borderRadius: '6px'
              }}
            >
              {board.internal_only ? 'Internal Only' : 'Shared'}
            </span>

            {board.is_template && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px 12px',
                  background: '#FEF3C7',
                  color: '#92400E',
                  fontSize: '13px',
                  fontWeight: 500,
                  borderRadius: '6px'
                }}
              >
                Template
              </span>
            )}

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '6px 12px',
                background: '#F3F4F6',
                color: '#6B7280',
                fontSize: '13px',
                fontWeight: 500,
                borderRadius: '6px'
              }}
            >
              {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
            </span>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '6px 12px',
                background: '#F3F4F6',
                color: '#6B7280',
                fontSize: '13px',
                fontWeight: 500,
                borderRadius: '6px'
              }}
            >
              Updated {new Date(board.updated_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 32px 32px'
          }}
        >
          {groups.length === 0 && tasks.length === 0 ? (
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
                📋
              </div>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#1A1A1A',
                  margin: '0 0 8px 0'
                }}
              >
                This board is empty
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: '#6B7280',
                  margin: 0,
                  lineHeight: 1.6
                }}
              >
                No groups or tasks are available yet.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}
            >
              {groups.map((group) => {
                const groupTasks = getTasksForGroup(group.id);

                return (
                  <div
                    key={group.id}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '12px',
                      padding: '20px',
                      border: '1px solid #E5E7EB'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '16px',
                        paddingBottom: '12px',
                        borderBottom: '2px solid #E5E7EB'
                      }}
                    >
                      <h3
                        style={{
                          fontSize: '16px',
                          fontWeight: 600,
                          color: '#1F2937',
                          margin: 0,
                          fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
                        }}
                      >
                        {group.name}
                      </h3>

                      <button
                        onClick={() => handleOpenCreateModalForGroup(group.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          background: 'transparent',
                          border: '1px solid #E5E7EB',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 500,
                          color: '#6B7280',
                          cursor: 'pointer',
                          fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#F9FAFB';
                          e.currentTarget.style.color = '#2563EB';
                          e.currentTarget.style.borderColor = '#2563EB';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#6B7280';
                          e.currentTarget.style.borderColor = '#E5E7EB';
                        }}
                      >
                        <Plus size={14} />
                        New Task
                      </button>
                    </div>

                    <div
                      style={{
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}
                    >
                      {groupTasks.length === 0 ? (
                        <div
                          style={{
                            textAlign: 'center',
                            padding: '24px 16px',
                            color: '#6B7280',
                            fontSize: '14px'
                          }}
                        >
                          No tasks in this group.
                        </div>
                      ) : (
                        groupTasks.map((task) => renderTaskCard(task))
                      )}
                    </div>
                  </div>
                );
              })}

              {orphanedTasks.length > 0 && (
                <div
                  style={{
                    background: '#FFFFFF',
                    border: '1px dashed #D1D5DB',
                    borderRadius: '14px',
                    overflow: 'hidden',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
                  }}
                >
                  <div
                    style={{
                      padding: '16px 20px',
                      borderBottom: '1px solid #F3F4F6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <h3
                      style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        color: '#6B7280',
                        margin: 0
                      }}
                    >
                      Other Tasks
                    </h3>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 10px',
                        background: '#F3F4F6',
                        color: '#6B7280',
                        fontSize: '12px',
                        fontWeight: 500,
                        borderRadius: '999px'
                      }}
                    >
                      {orphanedTasks.length}
                    </span>
                  </div>

                  <div
                    style={{
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    {orphanedTasks.map((task) => renderTaskCard(task))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedTask && (
        <TaskDetailPanel
          selectedTask={selectedTask}
          groups={groups}
          isEditMode={isEditMode}
          editForm={editForm}
          setEditForm={setEditForm}
          editError={editError}
          isSaving={isSaving}
          onEditTask={handleEditTask}
          onCancelEdit={handleCancelEdit}
          onSaveEdit={handleSaveEdit}
          onClosePanel={handleClosePanel}
          getStatusColor={getStatusColor}
          getPriorityColor={getPriorityColor}
          formatDate={formatDate}
          formatDateTime={formatDateTime}
          formatDateForInput={formatDateForInput}
        />
      )}

      <CreateTaskModal
        boardId={boardId}
        groups={groups}
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onSuccess={handleCreateTaskSuccess}
        initialGroupId={initialGroupId}
      />

      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}














