import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { baseUrl } from '../../lib/base-url';

interface CreateBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  workspaceId: string | null;
}

export default function CreateBoardModal({
  isOpen,
  onClose,
  onSuccess,
  workspaceId
}: CreateBoardModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [internalOnly, setInternalOnly] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [defaultWorkspaceId, setDefaultWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setName('');
      setDescription('');
      setInternalOnly(false);
      setError('');
    }
  }, [isOpen]);

  useEffect(() => {
    // Load default workspace if none provided
    if (isOpen && !workspaceId) {
      loadDefaultWorkspace();
    } else if (workspaceId) {
      setDefaultWorkspaceId(workspaceId);
    }
  }, [isOpen, workspaceId]);

  const loadDefaultWorkspace = async () => {
    try {
      const response = await fetch(`/api/work-os/workspaces?limit=1`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.workspaces && data.workspaces.length > 0) {
          setDefaultWorkspaceId(data.workspaces[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load default workspace:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;

    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/work-os/boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          description: description || undefined,
          workspace_id: workspaceId || undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create board');
      }

      // Success
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to create board:', err);
      setError(err instanceof Error ? err.message : 'Failed to create board');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998,
          animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '480px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          zIndex: 9999,
          fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
          animation: 'slideIn 0.2s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>
          {`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideIn {
              from { 
                opacity: 0;
                transform: translate(-50%, -48%);
              }
              to { 
                opacity: 1;
                transform: translate(-50%, -50%);
              }
            }
          `}
        </style>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid #E5E7EB'
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
            Create New Board
          </h2>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              padding: 0,
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              color: '#6B7280',
              transition: 'all 0.2s',
              opacity: isSubmitting ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.background = '#F3F4F6';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '24px' }}>
            {/* Name Field */}
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="board-name"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#1A1A1A',
                  marginBottom: '8px'
                }}
              >
                Board Name *
              </label>
              <input
                id="board-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                placeholder="e.g. Marketing Campaign 2024"
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '14px',
                  color: '#1A1A1A',
                  backgroundColor: isSubmitting ? '#F9FAFB' : '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'border 0.2s',
                  fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
                  cursor: isSubmitting ? 'not-allowed' : 'text'
                }}
                onFocus={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.borderColor = '#1A1A1A';
                  }
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                }}
              />
            </div>

            {/* Description Field */}
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="board-description"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#1A1A1A',
                  marginBottom: '8px'
                }}
              >
                Description (optional)
              </label>
              <textarea
                id="board-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                placeholder="Brief description of this board..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '14px',
                  color: '#1A1A1A',
                  backgroundColor: isSubmitting ? '#F9FAFB' : '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'border 0.2s',
                  fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
                  resize: 'vertical',
                  cursor: isSubmitting ? 'not-allowed' : 'text'
                }}
                onFocus={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.borderColor = '#1A1A1A';
                  }
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                }}
              />
            </div>

            {/* Internal Only Checkbox */}
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  userSelect: 'none'
                }}
              >
                <input
                  type="checkbox"
                  checked={internalOnly}
                  onChange={(e) => setInternalOnly(e.target.checked)}
                  disabled={isSubmitting}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer'
                  }}
                />
                <span
                  style={{
                    fontSize: '14px',
                    color: '#1A1A1A',
                    fontWeight: 500
                  }}
                >
                  Internal Only
                </span>
              </label>
              <p
                style={{
                  fontSize: '12px',
                  color: '#6B7280',
                  margin: '6px 0 0 28px',
                  lineHeight: 1.5
                }}
              >
                Internal boards are only visible to team members
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}
              >
                <p
                  style={{
                    fontSize: '13px',
                    color: '#DC2626',
                    margin: 0,
                    lineHeight: 1.5
                  }}
                >
                  {error}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '16px 24px',
              borderTop: '1px solid #E5E7EB'
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#1A1A1A',
                backgroundColor: 'transparent',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
                opacity: isSubmitting ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.backgroundColor = '#F9FAFB';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
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
                backgroundColor: isSubmitting || !name.trim() ? '#9CA3AF' : '#1A1A1A',
                border: 'none',
                borderRadius: '8px',
                cursor: isSubmitting || !name.trim() ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
                fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting && name.trim()) {
                  e.currentTarget.style.backgroundColor = '#2A2A2A';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting && name.trim()) {
                  e.currentTarget.style.backgroundColor = '#1A1A1A';
                }
              }}
            >
              {isSubmitting ? 'Creating...' : 'Create Board'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}



