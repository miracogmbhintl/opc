import { useState, useEffect, FormEvent } from 'react';
import { X } from 'lucide-react';

interface Group {
  id: string;
  name: string;
  color?: string;
}

interface CreateTaskModalProps {
  boardId: string;
  groups: Group[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialGroupId?: string;
}

export default function CreateTaskModal({
  boardId,
  groups,
  isOpen,
  onClose,
  onSuccess,
  initialGroupId
}: CreateTaskModalProps) {
  const [name, setName] = useState('');
  const [groupId, setGroupId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [progressPercent, setProgressPercent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill group when modal opens with initialGroupId
  useEffect(() => {
    if (isOpen && initialGroupId) {
      setGroupId(initialGroupId);
    } else if (isOpen && !initialGroupId) {
      setGroupId('');
    }
  }, [isOpen, initialGroupId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Task name is required');
      return;
    }

    if (progressPercent && (parseInt(progressPercent) < 0 || parseInt(progressPercent) > 100)) {
      setError('Progress must be between 0 and 100');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        name: name.trim(),
        group_id: groupId || null
      };

      if (description.trim()) payload.description = description.trim();
      if (status) payload.status = status;
      if (priority) payload.priority = priority;
      if (startDate) payload.start_date = startDate;
      if (dueDate) payload.due_date = dueDate;
      if (progressPercent) payload.progress_percent = parseInt(progressPercent);

      const response = await fetch(`/api/work-os/boards/${boardId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create task');
      }

      // Reset form
      setName('');
      setGroupId('');
      setDescription('');
      setStatus('');
      setPriority('');
      setStartDate('');
      setDueDate('');
      setProgressPercent('');

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setName('');
    setGroupId('');
    setDescription('');
    setStatus('');
    setPriority('');
    setStartDate('');
    setDueDate('');
    setProgressPercent('');
    setError(null);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px'
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: '#1A1A1A',
              margin: 0
            }}
          >
            Create New Task
          </h2>

          <button
            onClick={handleClose}
            disabled={isSubmitting}
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
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              color: '#6B7280',
              opacity: isSubmitting ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px'
            }}
          >
            {error && (
              <div
                style={{
                  padding: '12px 16px',
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '8px',
                  color: '#DC2626',
                  fontSize: '14px',
                  marginBottom: '20px'
                }}
              >
                {error}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="task-name"
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#1A1A1A'
                }}
              >
                Task Name <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                id="task-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isSubmitting}
                placeholder="Enter task name"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '15px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  background: isSubmitting ? '#F9FAFB' : '#FFFFFF',
                  color: '#1A1A1A',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => (e.target.style.borderColor = '#2563EB')}
                onBlur={(e) => (e.target.style.borderColor = '#E5E7EB')}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="task-group"
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#1A1A1A'
                }}
              >
                Group
              </label>
              <select
                id="task-group"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '15px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  background: isSubmitting ? '#F9FAFB' : '#FFFFFF',
                  color: '#1A1A1A',
                  outline: 'none',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => (e.target.style.borderColor = '#2563EB')}
                onBlur={(e) => (e.target.style.borderColor = '#E5E7EB')}
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
              <label
                htmlFor="task-description"
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#1A1A1A'
                }}
              >
                Description
              </label>
              <textarea
                id="task-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                placeholder="Add a description (optional)"
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '15px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  background: isSubmitting ? '#F9FAFB' : '#FFFFFF',
                  color: '#1A1A1A',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => (e.target.style.borderColor = '#2563EB')}
                onBlur={(e) => (e.target.style.borderColor = '#E5E7EB')}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label
                  htmlFor="task-status"
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A'
                  }}
                >
                  Status
                </label>
                <select
                  id="task-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '15px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    background: isSubmitting ? '#F9FAFB' : '#FFFFFF',
                    color: '#1A1A1A',
                    outline: 'none',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#2563EB')}
                  onBlur={(e) => (e.target.style.borderColor = '#E5E7EB')}
                >
                  <option value="">Select status</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="task-priority"
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A'
                  }}
                >
                  Priority
                </label>
                <select
                  id="task-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '15px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    background: isSubmitting ? '#F9FAFB' : '#FFFFFF',
                    color: '#1A1A1A',
                    outline: 'none',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#2563EB')}
                  onBlur={(e) => (e.target.style.borderColor = '#E5E7EB')}
                >
                  <option value="">Select priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label
                  htmlFor="task-start-date"
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A'
                  }}
                >
                  Start Date
                </label>
                <input
                  id="task-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '15px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    background: isSubmitting ? '#F9FAFB' : '#FFFFFF',
                    color: '#1A1A1A',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#2563EB')}
                  onBlur={(e) => (e.target.style.borderColor = '#E5E7EB')}
                />
              </div>

              <div>
                <label
                  htmlFor="task-due-date"
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A'
                  }}
                >
                  Due Date
                </label>
                <input
                  id="task-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '15px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    background: isSubmitting ? '#F9FAFB' : '#FFFFFF',
                    color: '#1A1A1A',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#2563EB')}
                  onBlur={(e) => (e.target.style.borderColor = '#E5E7EB')}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="task-progress"
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#1A1A1A'
                }}
              >
                Progress (%)
              </label>
              <input
                id="task-progress"
                type="number"
                min="0"
                max="100"
                value={progressPercent}
                onChange={(e) => setProgressPercent(e.target.value)}
                disabled={isSubmitting}
                placeholder="0-100"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '15px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  background: isSubmitting ? '#F9FAFB' : '#FFFFFF',
                  color: '#1A1A1A',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => (e.target.style.borderColor = '#2563EB')}
                onBlur={(e) => (e.target.style.borderColor = '#E5E7EB')}
              />
            </div>
          </div>

          <div
            style={{
              padding: '20px 24px',
              borderTop: '1px solid #E5E7EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              background: '#FAFBFC'
            }}
          >
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#6B7280',
                background: 'transparent',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.5 : 1,
                transition: 'all 0.2s'
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#FFFFFF',
                background: isSubmitting || !name.trim() ? '#9CA3AF' : '#2563EB',
                border: 'none',
                borderRadius: '8px',
                cursor: isSubmitting || !name.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


