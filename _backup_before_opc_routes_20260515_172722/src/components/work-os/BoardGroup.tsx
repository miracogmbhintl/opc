import { useState, useEffect } from 'react';
import { Plus, MoreVertical, GripVertical, Trash2, Edit2, CheckCircle2, Circle, Clock, AlertCircle, User, Calendar } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
  dueDate?: string;
  description?: string;
}

interface Group {
  id: string;
  name: string;
  color: string;
  tasks: Task[];
  collapsed: boolean;
}

interface BoardGroupProps {
  boardId: string;
  workspaceColor?: string;
  onTaskUpdate?: (groupId: string, tasks: Task[]) => void;
  showCreateGroupModal?: boolean;
  onCloseCreateGroupModal?: () => void;
}

export default function BoardGroup({ boardId, workspaceColor = '#1A1A1A', onTaskUpdate, showCreateGroupModal, onCloseCreateGroupModal }: BoardGroupProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [draggedTask, setDraggedTask] = useState<{ groupId: string; taskId: string } | null>(null);
  const [draggedGroup, setDraggedGroup] = useState<string | null>(null);
  const [showTaskModal, setShowTaskModal] = useState<{ groupId: string } | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<{ groupId: string; taskId: string } | null>(null);

  useEffect(() => {
    loadGroups();
  }, [boardId]);

  const loadGroups = () => {
    const stored = localStorage.getItem(`board_${boardId}_groups`);
    if (stored) {
      setGroups(JSON.parse(stored));
    } else {
      // Initialize with sample data
      const initialGroups: Group[] = [
        {
          id: '1',
          name: 'Design Phase',
          color: '#3B82F6',
          tasks: [
            {
              id: '1-1',
              title: 'Create wireframes',
              status: 'completed',
              priority: 'high',
              assignee: 'John Doe',
              dueDate: '2026-02-20'
            },
            {
              id: '1-2',
              title: 'Design mockups',
              status: 'in-progress',
              priority: 'high',
              assignee: 'Jane Smith',
              dueDate: '2026-02-25'
            }
          ]
        },
        {
          id: '2',
          name: 'Development',
          color: '#10B981',
          tasks: [
            {
              id: '2-1',
              title: 'Set up project structure',
              status: 'not-started',
              priority: 'medium',
              assignee: 'Mike Johnson',
              dueDate: '2026-03-01'
            }
          ]
        }
      ];
      setGroups(initialGroups);
      saveGroups(initialGroups);
    }
  };

  const saveGroups = (updatedGroups: Group[]) => {
    localStorage.setItem(`board_${boardId}_groups`, JSON.stringify(updatedGroups));
    setGroups(updatedGroups);
  };

  const calculateProgress = (tasks: Task[]) => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.status === 'completed').length;
    return Math.round((completed / tasks.length) * 100);
  };

  const getStatusCounts = (tasks: Task[]) => {
    return {
      completed: tasks.filter(t => t.status === 'completed').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      notStarted: tasks.filter(t => t.status === 'not-started').length,
      blocked: tasks.filter(t => t.status === 'blocked').length
    };
  };

  const handleCreateGroup = (name: string, color: string) => {
    const newGroup: Group = {
      id: Date.now().toString(),
      name,
      color,
      tasks: [],
      collapsed: false
    };
    saveGroups([...groups, newGroup]);
    setShowTaskModal(null);
  };

  const handleCreateTask = (groupId: string, title: string, priority: Task['priority']) => {
    const newTask: Task = {
      id: `${groupId}-${Date.now()}`,
      title,
      status: 'not-started',
      priority,
      assignee: '',
      dueDate: ''
    };

    const updatedGroups = groups.map(g => 
      g.id === groupId 
        ? { ...g, tasks: [...g.tasks, newTask] }
        : g
    );
    saveGroups(updatedGroups);
    setShowTaskModal(null);
  };

  const handleUpdateTask = (groupId: string, taskId: string, field: keyof Task, value: any) => {
    const updatedGroups = groups.map(g => 
      g.id === groupId 
        ? { 
            ...g, 
            tasks: g.tasks.map(t => 
              t.id === taskId ? { ...t, [field]: value } : t
            )
          }
        : g
    );
    saveGroups(updatedGroups);
    
    if (onTaskUpdate) {
      const group = updatedGroups.find(g => g.id === groupId);
      if (group) onTaskUpdate(groupId, group.tasks);
    }
  };

  const handleDeleteGroup = (groupId: string) => {
    if (!confirm('Delete this group and all its tasks?')) return;
    saveGroups(groups.filter(g => g.id !== groupId));
  };

  const handleDeleteTask = (groupId: string, taskId: string) => {
    const updatedGroups = groups.map(g => 
      g.id === groupId 
        ? { ...g, tasks: g.tasks.filter(t => t.id !== taskId) }
        : g
    );
    saveGroups(updatedGroups);
  };

  const toggleGroupCollapse = (groupId: string) => {
    const updatedGroups = groups.map(g => 
      g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
    );
    saveGroups(updatedGroups);
  };

  // Drag and Drop Handlers
  const handleTaskDragStart = (groupId: string, taskId: string) => {
    setDraggedTask({ groupId, taskId });
  };

  const handleTaskDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleTaskDrop = (targetGroupId: string, targetIndex: number) => {
    if (!draggedTask) return;

    const { groupId: sourceGroupId, taskId } = draggedTask;
    
    const sourceGroup = groups.find(g => g.id === sourceGroupId);
    const task = sourceGroup?.tasks.find(t => t.id === taskId);
    
    if (!task) return;

    let updatedGroups = [...groups];

    updatedGroups = updatedGroups.map(g => 
      g.id === sourceGroupId 
        ? { ...g, tasks: g.tasks.filter(t => t.id !== taskId) }
        : g
    );

    updatedGroups = updatedGroups.map(g => {
      if (g.id === targetGroupId) {
        const newTasks = [...g.tasks];
        newTasks.splice(targetIndex, 0, task);
        return { ...g, tasks: newTasks };
      }
      return g;
    });

    saveGroups(updatedGroups);
    setDraggedTask(null);
  };

  const handleGroupDragStart = (groupId: string) => {
    setDraggedGroup(groupId);
  };

  const handleGroupDrop = (targetIndex: number) => {
    if (!draggedGroup) return;

    const sourceIndex = groups.findIndex(g => g.id === draggedGroup);
    if (sourceIndex === -1) return;

    const updatedGroups = [...groups];
    const [movedGroup] = updatedGroups.splice(sourceIndex, 1);
    updatedGroups.splice(targetIndex, 0, movedGroup);

    saveGroups(updatedGroups);
    setDraggedGroup(null);
  };

  return (
    <div style={{
      padding: '0',
      width: '100%',
      minHeight: '100vh',
      background: '#F9FAFB'
    }}>
      {/* Groups */}
      <div style={{
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '32px'
      }}>
        {groups.map((group, groupIndex) => {
          const progress = calculateProgress(group.tasks);
          const statusCounts = getStatusCounts(group.tasks);

          return (
            <div
              key={group.id}
              draggable
              onDragStart={() => handleGroupDragStart(group.id)}
              onDragOver={handleTaskDragOver}
              onDrop={() => handleGroupDrop(groupIndex)}
              style={{
                background: '#FFFFFF',
                border: `2px solid ${group.color}`,
                borderRadius: '14px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                transition: 'all 0.2s'
              }}
            >
              {/* Group Header */}
              <div
                style={{
                  padding: '20px 24px',
                  background: `${group.color}10`,
                  borderBottom: `1px solid ${group.color}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'grab'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <GripVertical size={20} color="#6B6B6B" />
                  
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '3px',
                      background: group.color
                    }}
                  />

                  {editingGroup === group.id ? (
                    <input
                      type="text"
                      defaultValue={group.name}
                      autoFocus
                      onBlur={(e) => {
                        const updatedGroups = groups.map(g => 
                          g.id === group.id ? { ...g, name: e.target.value } : g
                        );
                        saveGroups(updatedGroups);
                        setEditingGroup(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                      onInput={(e) => {
                        const target = e.currentTarget;
                        const length = target.value.length || 1;
                        target.style.width = `${Math.max(20, length * 11)}px`;
                      }}
                      style={{
                        fontSize: '18px',
                        fontWeight: 600,
                        fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
                        border: 'none',
                        borderBottom: `2px solid ${group.color}`,
                        borderRadius: '0',
                        padding: '0',
                        margin: '0',
                        color: '#1A1A1A',
                        outline: 'none',
                        background: 'transparent',
                        width: `${Math.max(20, group.name.length * 11)}px`,
                        display: 'inline-block',
                        lineHeight: 'normal',
                        height: 'auto',
                        boxSizing: 'content-box'
                      }}
                    />
                  ) : (
                    <h3
                      onClick={() => setEditingGroup(group.id)}
                      style={{
                        fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
                        fontSize: '18px',
                        fontWeight: 600,
                        color: '#1A1A1A',
                        margin: 0,
                        padding: 0,
                        cursor: 'pointer',
                        borderRadius: '0',
                        transition: 'opacity 0.15s',
                        display: 'inline-block',
                        lineHeight: 'normal',
                        height: 'auto'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '0.7';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                    >
                      {group.name}
                    </h3>
                  )}

                  <span style={{
                    fontSize: '13px',
                    color: '#6B6B6B',
                    fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
                  }}>
                    ({group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'})
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {/* Status Indicators */}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {statusCounts.completed > 0 && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        background: '#10B98120',
                        borderRadius: '6px'
                      }}>
                        <CheckCircle2 size={14} color="#10B981" />
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#10B981',
                          fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
                        }}>
                          {statusCounts.completed}
                        </span>
                      </div>
                    )}
                    
                    {statusCounts.inProgress > 0 && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        background: '#3B82F620',
                        borderRadius: '6px'
                      }}>
                        <Clock size={14} color="#3B82F6" />
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#3B82F6',
                          fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
                        }}>
                          {statusCounts.inProgress}
                        </span>
                      </div>
                    )}

                    {statusCounts.blocked > 0 && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        background: '#DC262620',
                        borderRadius: '6px'
                      }}>
                        <AlertCircle size={14} color="#DC2626" />
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#DC2626',
                          fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
                        }}>
                          {statusCounts.blocked}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '120px',
                      height: '8px',
                      background: '#E5E7EB',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${progress}%`,
                        height: '100%',
                        background: group.color,
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1A1A1A',
                      fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
                      minWidth: '40px'
                    }}>
                      {progress}%
                    </span>
                  </div>

                  <button
                    onClick={() => toggleGroupCollapse(group.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>
                      {group.collapsed ? '▼' : '▲'}
                    </span>
                  </button>

                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setActiveMenu(activeMenu === group.id ? null : group.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                    >
                      <MoreVertical size={20} color="#6B6B6B" />
                    </button>

                    {activeMenu === group.id && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '4px',
                        background: '#FFFFFF',
                        border: '1px solid #E5E7EB',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        zIndex: 100,
                        minWidth: '160px',
                        overflow: 'hidden'
                      }}>
                        <button
                          onClick={() => {
                            setEditingGroup(group.id);
                            setActiveMenu(null);
                          }}
                          style={menuItemStyle}
                        >
                          <Edit2 size={16} />
                          Rename Group
                        </button>
                        <button
                          onClick={() => {
                            handleDeleteGroup(group.id);
                            setActiveMenu(null);
                          }}
                          style={{
                            ...menuItemStyle,
                            color: '#DC2626',
                            borderBottom: 'none'
                          }}
                        >
                          <Trash2 size={16} />
                          Delete Group
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Table with Column Headers Inside Group */}
              {!group.collapsed && (
                <div style={{ 
                  padding: '0',
                  overflow: 'auto' 
                }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse'
                  }}>
                    <thead>
                      <tr style={{
                        background: '#FFFFFF',
                        borderBottom: '2px solid #E5E5E5'
                      }}>
                        <th style={{
                          ...tableHeaderStyle,
                          width: '50px',
                          textAlign: 'center'
                        }}>
                          
                        </th>
                        <th style={{
                          ...tableHeaderStyle,
                          minWidth: '300px',
                          textAlign: 'left'
                        }}>
                          Task
                        </th>
                        <th style={{
                          ...tableHeaderStyle,
                          width: '180px'
                        }}>
                          Status
                        </th>
                        <th style={{
                          ...tableHeaderStyle,
                          width: '140px'
                        }}>
                          Priority
                        </th>
                        <th style={{
                          ...tableHeaderStyle,
                          width: '200px'
                        }}>
                          Assignee
                        </th>
                        <th style={{
                          ...tableHeaderStyle,
                          width: '160px'
                        }}>
                          Due Date
                        </th>
                        <th style={{
                          ...tableHeaderStyle,
                          width: '80px',
                          textAlign: 'center'
                        }}>
                          
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.tasks.map((task, taskIndex) => (
                        <tr
                          key={task.id}
                          draggable
                          onDragStart={() => handleTaskDragStart(group.id, task.id)}
                          onDragOver={handleTaskDragOver}
                          onDrop={() => handleTaskDrop(group.id, taskIndex)}
                          style={{
                            background: '#FFFFFF',
                            borderBottom: '1px solid #F2F2F2',
                            transition: 'all 0.2s',
                            cursor: 'grab'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#FAFAFA';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#FFFFFF';
                          }}
                        >
                          {/* Drag Handle */}
                          <td style={tableCellStyle}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px'
                            }}>
                              <GripVertical size={16} color="#9CA3AF" />
                              <button
                                onClick={() => {
                                  const newStatus = task.status === 'completed' ? 'not-started' : 'completed';
                                  handleUpdateTask(group.id, task.id, 'status', newStatus);
                                }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: 0,
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                              >
                                {task.status === 'completed' ? (
                                  <CheckCircle2 size={20} color="#10B981" />
                                ) : (
                                  <Circle size={20} color="#9CA3AF" />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* Task Name */}
                          <td style={tableCellStyle}>
                            {editingTask?.groupId === group.id && editingTask?.taskId === task.id ? (
                              <input
                                type="text"
                                defaultValue={task.title}
                                autoFocus
                                onBlur={(e) => {
                                  if (e.target.value.trim()) {
                                    handleUpdateTask(group.id, task.id, 'title', e.target.value.trim());
                                  }
                                  setEditingTask(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                  } else if (e.key === 'Escape') {
                                    setEditingTask(null);
                                  }
                                }}
                                onInput={(e) => {
                                  const target = e.currentTarget;
                                  const length = target.value.length || 1;
                                  target.style.width = `${Math.max(20, length * 9)}px`;
                                }}
                                style={{
                                  fontSize: '15px',
                                  fontWeight: 500,
                                  color: '#1A1A1A',
                                  fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
                                  border: 'none',
                                  borderBottom: '2px solid #1A1A1A',
                                  borderRadius: '0',
                                  padding: '0',
                                  margin: '0',
                                  outline: 'none',
                                  background: 'transparent',
                                  width: `${Math.max(20, task.title.length * 9)}px`,
                                  display: 'inline-block',
                                  lineHeight: 'normal',
                                  height: 'auto',
                                  boxSizing: 'content-box'
                                }}
                              />
                            ) : (
                              <span
                                onClick={() => setEditingTask({ groupId: group.id, taskId: task.id })}
                                style={{
                                  fontSize: '15px',
                                  fontWeight: 500,
                                  color: task.status === 'completed' ? '#9CA3AF' : '#1A1A1A',
                                  textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                                  fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
                                  cursor: 'pointer',
                                  padding: '0',
                                  margin: '0',
                                  borderRadius: '0',
                                  display: 'inline-block',
                                  transition: 'opacity 0.15s',
                                  lineHeight: 'normal',
                                  height: 'auto'
                                }}
                                onMouseEnter={(e) => {
                                  if (task.status !== 'completed') {
                                    e.currentTarget.style.opacity = '0.7';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.opacity = '1';
                                }}
                              >
                                {task.title}
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td style={tableCellStyle}>
                            <select
                              value={task.status}
                              onChange={(e) => handleUpdateTask(group.id, task.id, 'status', e.target.value)}
                              style={{
                                ...inputStyle,
                                cursor: 'pointer',
                                minWidth: '120px'
                              }}
                            >
                              <option value="todo">To Do</option>
                              <option value="in-progress">In Progress</option>
                              <option value="completed">Completed</option>
                            </select>
                          </td>

                          {/* Priority */}
                          <td style={tableCellStyle}>
                            <select
                              value={task.priority}
                              onChange={(e) => handleUpdateTask(group.id, task.id, 'priority', e.target.value)}
                              style={{
                                ...inputStyle,
                                cursor: 'pointer',
                                minWidth: '110px'
                              }}
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </td>

                          {/* Assignee */}
                          <td style={tableCellStyle}>
                            <input
                              type="text"
                              value={task.assignee || ''}
                              onChange={(e) => handleUpdateTask(group.id, task.id, 'assignee', e.target.value)}
                              placeholder="Unassigned"
                              style={{
                                ...inputStyle,
                                width: '140px'
                              }}
                            />
                          </td>

                          {/* Due Date */}
                          <td style={tableCellStyle}>
                            <input
                              type="date"
                              value={task.dueDate || ''}
                              onChange={(e) => handleUpdateTask(group.id, task.id, 'dueDate', e.target.value)}
                              style={{
                                ...inputStyle,
                                cursor: 'pointer',
                                width: '150px'
                              }}
                            />
                          </td>

                          {/* Actions */}
                          <td style={{ ...tableCellStyle, textAlign: 'right' as const }}>
                            <button
                              onClick={() => handleDeleteTask(group.id, task.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#9CA3AF',
                                padding: '4px',
                                borderRadius: '6px',
                                fontSize: '16px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#FEE2E2';
                                e.currentTarget.style.color = '#DC2626';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = '#9CA3AF';
                              }}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}

                      {/* Add Task Row */}
                      <tr
                        onDragOver={handleTaskDragOver}
                        onDrop={() => handleTaskDrop(group.id, group.tasks.length)}
                        style={{
                          background: '#FAFAFA',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => setShowTaskModal({ groupId: group.id })}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = `${group.color}10`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#FAFAFA';
                        }}
                      >
                        <td colSpan={7} style={{
                          padding: '20px',
                          textAlign: 'center'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            color: '#6B6B6B'
                          }}>
                            <Plus size={18} />
                            <span style={{
                              fontSize: '14px',
                              fontWeight: 500,
                              fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
                            }}>
                              Add Task
                            </span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Task Modal */}
      {showTaskModal && (
        <CreateTaskModal
          groupId={showTaskModal.groupId}
          onClose={() => setShowTaskModal(null)}
          onCreate={handleCreateTask}
        />
      )}

      {/* Create Group Modal */}
      {showCreateGroupModal && onCloseCreateGroupModal && (
        <CreateGroupModal
          onClose={onCloseCreateGroupModal}
          onCreate={handleCreateGroup}
        />
      )}
    </div>
  );
}

const getStatusColor = (status: Task['status']) => {
  switch (status) {
    case 'completed': return '#10B981';
    case 'in-progress': return '#3B82F6';
    case 'blocked': return '#DC2626';
    default: return '#9CA3AF';
  }
};

const getPriorityColor = (priority: Task['priority']) => {
  switch (priority) {
    case 'high': return '#DC2626';
    case 'medium': return '#F59E0B';
    default: return '#6B7280';
  }
};

const menuItemStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid #F2F2F2',
  cursor: 'pointer',
  fontSize: '13px',
  color: '#1A1A1A',
  fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  textAlign: 'left',
  fontWeight: 500,
  transition: 'background 0.15s'
};

const cardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: '16px',
  border: '1px solid #E5E5E5',
  overflow: 'hidden',
  marginBottom: '16px',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)'
};

const headerStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderBottom: '1px solid #E5E5E5',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px'
};

// Consistent button style - 36px height
const buttonStyle: React.CSSProperties = {
  height: '36px',
  padding: '0 14px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s',
  fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #E5E5E5',
  background: '#FFFFFF',
  color: '#1A1A1A'
};

// Consistent input/select style - 36px height
const inputStyle: React.CSSProperties = {
  height: '36px',
  padding: '0 12px',
  border: '1px solid #E5E5E5',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 500,
  color: '#1A1A1A',
  background: '#FFFFFF',
  fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
};

const tableHeaderStyle: React.CSSProperties = {
  background: '#FFFFFF',
  borderBottom: '2px solid #E5E5E5',
  padding: '10px 20px',
  fontSize: '13px',
  fontWeight: 600,
  color: '#1A1A1A',
  textAlign: 'left' as const,
  fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
};

const tableCellStyle: React.CSSProperties = {
  padding: '12px 20px',
  borderBottom: '1px solid #F3F4F6',
  fontSize: '15px',
  color: '#1A1A1A',
  verticalAlign: 'middle',
  fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
};

// Create Task Modal Component
function CreateTaskModal({ groupId, onClose, onCreate }: {
  groupId: string;
  onClose: () => void;
  onCreate: (groupId: string, title: string, priority: Task['priority']) => void;
}) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onCreate(groupId, title.trim(), priority);
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)'
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 700,
          color: '#1A1A1A',
          marginBottom: '24px',
          fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
        }}>
          Create New Task
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '8px',
              fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
            }}>
              Task Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Create wireframes"
              autoFocus
              style={{
                width: '100%',
                height: '42px',
                padding: '0 14px',
                border: '1px solid #E6E6E6',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
              }}
            />
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '8px',
              fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
            }}>
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Task['priority'])}
              style={{
                width: '100%',
                height: '42px',
                padding: '0 14px',
                border: '1px solid #E6E6E6',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
                cursor: 'pointer'
              }}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                background: 'transparent',
                border: '1px solid #E6E6E6',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#1A1A1A',
                cursor: 'pointer',
                fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              style={{
                padding: '10px 20px',
                background: title.trim() ? '#1A1A1A' : '#E6E6E6',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#FFFFFF',
                cursor: title.trim() ? 'pointer' : 'not-allowed',
                fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
              }}
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Create Group Modal Component
function CreateGroupModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (name: string, color: string) => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#DBEAFE');

  const colorOptions = [
    { value: '#DBEAFE', label: 'Blue' },
    { value: '#FEF3C7', label: 'Yellow' },
    { value: '#E0E7FF', label: 'Purple' },
    { value: '#D1FAE5', label: 'Green' },
    { value: '#FEE2E2', label: 'Red' },
    { value: '#FCE7F3', label: 'Pink' }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim(), color);
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)'
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 700,
          color: '#1A1A1A',
          marginBottom: '24px',
          fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
        }}>
          Create New Group
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '8px',
              fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
            }}>
              Group Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Planning, In Progress, Done"
              autoFocus
              style={{
                width: '100%',
                height: '42px',
                padding: '0 14px',
                border: '1px solid #E6E6E6',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
              }}
            />
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '8px',
              fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
            }}>
              Color
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: '12px'
            }}>
              {colorOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setColor(option.value)}
                  style={{
                    width: '48px',
                    height: '48px',
                    background: option.value,
                    border: color === option.value ? '3px solid #1A1A1A' : '2px solid #E6E6E6',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    transform: color === option.value ? 'scale(1.1)' : 'scale(1)'
                  }}
                  title={option.label}
                />
              ))}
            </div>
          </div>

          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                background: 'transparent',
                border: '1px solid #E6E6E6',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#1A1A1A',
                cursor: 'pointer',
                fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              style={{
                padding: '10px 20px',
                background: name.trim() ? '#1A1A1A' : '#E6E6E6',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#FFFFFF',
                cursor: name.trim() ? 'pointer' : 'not-allowed',
                fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
              }}
            >
              Create Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}




























