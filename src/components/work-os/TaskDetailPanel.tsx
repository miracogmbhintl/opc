import React from 'react';
import { X, Edit2 } from 'lucide-react';

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

interface TaskDetailPanelProps {
  selectedTask: Task;
  groups: Group[];
  isEditMode: boolean;
  editForm: {
    name: string;
    group_id: string;
    description: string;
    status: string;
    priority: string;
    start_date: string;
    due_date: string;
    progress_percent: string;
  };
  setEditForm: React.Dispatch<React.SetStateAction<{
    name: string;
    group_id: string;
    description: string;
    status: string;
    priority: string;
    start_date: string;
    due_date: string;
    progress_percent: string;
  }>>;
  editError: string;
  isSaving: boolean;
  onEditTask: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onClosePanel: () => void;
  getStatusColor: (status?: string) => { bg: string; text: string; border: string };
  getPriorityColor: (priority?: string) => { bg: string; text: string; border: string };
  formatDate: (dateString?: string) => string;
  formatDateTime: (dateString?: string) => string;
  formatDateForInput: (dateString?: string) => string;
}

export default function TaskDetailPanel({
  selectedTask,
  groups,
  isEditMode,
  editForm,
  setEditForm,
  editError,
  isSaving,
  onEditTask,
  onCancelEdit,
  onSaveEdit,
  onClosePanel,
  getStatusColor,
  getPriorityColor,
  formatDate,
  formatDateTime,
  formatDateForInput
}: TaskDetailPanelProps) {
  const fieldStyle = {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
    color: '#1A1A1A',
    background: '#FFFFFF',
    transition: 'all 0.2s'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: '#6B7280',
    margin: '0 0 8px 0',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em'
  };

  return (
    <div
      style={{
        width: '400px',
        background: '#FFFFFF',
        borderLeft: '1px solid #E5E7EB',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.05)'
      }}
    >
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#FAFBFC'
        }}
      >
        <h2
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#1A1A1A',
            margin: 0
          }}
        >
          {isEditMode ? 'Edit Task' : 'Task Details'}
        </h2>

        <div style={{ display: 'flex', gap: '8px' }}>
          {!isEditMode && (
            <button
              onClick={onEditTask}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                background: '#2563EB',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#1D4ED8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#2563EB';
              }}
              title="Edit task"
            >
              <Edit2 size={16} />
              Edit
            </button>
          )}

          <button
            onClick={onClosePanel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              padding: 0,
              background: 'transparent',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#6B7280',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#F3F4F6';
              e.currentTarget.style.borderColor = '#1A1A1A';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = '#E5E7EB';
            }}
            title="Close panel"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px'
        }}
      >
        {!isEditMode ? (
          <>
            <h3
              style={{
                fontSize: '20px',
                fontWeight: 600,
                color: '#1A1A1A',
                margin: '0 0 20px 0',
                lineHeight: 1.3
              }}
            >
              {selectedTask.name}
            </h3>

            {selectedTask.description && (
              <div style={{ marginBottom: '24px' }}>
                <h4 style={labelStyle}>Description</h4>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#1A1A1A',
                    margin: 0,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {selectedTask.description}
                </p>
              </div>
            )}

            {selectedTask.group_id && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={labelStyle}>Group</h4>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#1A1A1A',
                    margin: 0
                  }}
                >
                  {groups.find((g) => g.id === selectedTask.group_id)?.name || 'Unknown'}
                </p>
              </div>
            )}

            {selectedTask.status && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={labelStyle}>Status</h4>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '6px 12px',
                    background: getStatusColor(selectedTask.status).bg,
                    color: getStatusColor(selectedTask.status).text,
                    border: `1px solid ${getStatusColor(selectedTask.status).border}`,
                    fontSize: '13px',
                    fontWeight: 500,
                    borderRadius: '6px'
                  }}
                >
                  {selectedTask.status.replace('_', ' ')}
                </span>
              </div>
            )}

            {selectedTask.priority && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={labelStyle}>Priority</h4>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '6px 12px',
                    background: getPriorityColor(selectedTask.priority).bg,
                    color: getPriorityColor(selectedTask.priority).text,
                    border: `1px solid ${getPriorityColor(selectedTask.priority).border}`,
                    fontSize: '13px',
                    fontWeight: 500,
                    borderRadius: '6px'
                  }}
                >
                  {selectedTask.priority}
                </span>
              </div>
            )}

            {(selectedTask.progress_percent !== undefined && selectedTask.progress_percent !== null) && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={labelStyle}>Progress</h4>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: '8px',
                      background: '#E5E7EB',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      style={{
                        width: `${selectedTask.progress_percent}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #2563EB, #3B82F6)',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1A1A1A',
                      minWidth: '45px',
                      textAlign: 'right'
                    }}
                  >
                    {selectedTask.progress_percent}%
                  </span>
                </div>
              </div>
            )}

            {selectedTask.start_date && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={labelStyle}>Start Date</h4>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#1A1A1A',
                    margin: 0
                  }}
                >
                  {formatDate(selectedTask.start_date)}
                </p>
              </div>
            )}

            {selectedTask.due_date && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={labelStyle}>Due Date</h4>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#1A1A1A',
                    margin: 0
                  }}
                >
                  {formatDate(selectedTask.due_date)}
                </p>
              </div>
            )}

            <div
              style={{
                marginTop: '32px',
                paddingTop: '20px',
                borderTop: '1px solid #E5E7EB'
              }}
            >
              <div style={{ marginBottom: '16px' }}>
                <h4 style={labelStyle}>Created</h4>
                <p
                  style={{
                    fontSize: '13px',
                    color: '#6B7280',
                    margin: 0
                  }}
                >
                  {formatDateTime(selectedTask.created_at)}
                </p>
              </div>

              <div>
                <h4 style={labelStyle}>Last Updated</h4>
                <p
                  style={{
                    fontSize: '13px',
                    color: '#6B7280',
                    margin: 0
                  }}
                >
                  {formatDateTime(selectedTask.updated_at)}
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Name *</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                style={fieldStyle}
                placeholder="Task name"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Group</label>
              <select
                value={editForm.group_id}
                onChange={(e) => setEditForm({ ...editForm, group_id: e.target.value })}
                style={fieldStyle}
              >
                <option value="">No Group</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Description</label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                style={{ ...fieldStyle, minHeight: '100px', resize: 'vertical' as const }}
                placeholder="Add a description..."
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                style={fieldStyle}
              >
                <option value="">Not Set</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Priority</label>
              <select
                value={editForm.priority}
                onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                style={fieldStyle}
              >
                <option value="">Not Set</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Start Date</label>
              <input
                type="date"
                value={formatDateForInput(editForm.start_date)}
                onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                style={fieldStyle}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Due Date</label>
              <input
                type="date"
                value={formatDateForInput(editForm.due_date)}
                onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                style={fieldStyle}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Progress (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={editForm.progress_percent}
                onChange={(e) => setEditForm({ ...editForm, progress_percent: e.target.value })}
                style={fieldStyle}
                placeholder="0-100"
              />
            </div>

            {editError && (
              <div
                style={{
                  marginBottom: '20px',
                  padding: '12px 16px',
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '8px',
                  color: '#DC2626',
                  fontSize: '13px',
                  fontWeight: 500
                }}
              >
                {editError}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: '12px',
                marginTop: '24px'
              }}
            >
              <button
                onClick={onSaveEdit}
                disabled={isSaving}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  background: isSaving ? '#9CA3AF' : '#2563EB',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
                }}
                onMouseEnter={(e) => {
                  if (!isSaving) e.currentTarget.style.background = '#1D4ED8';
                }}
                onMouseLeave={(e) => {
                  if (!isSaving) e.currentTarget.style.background = '#2563EB';
                }}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>

              <button
                onClick={onCancelEdit}
                disabled={isSaving}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  background: 'transparent',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  color: '#6B7280',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
                }}
                onMouseEnter={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.background = '#F9FAFB';
                    e.currentTarget.style.borderColor = '#1A1A1A';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = '#E5E7EB';
                  }
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

