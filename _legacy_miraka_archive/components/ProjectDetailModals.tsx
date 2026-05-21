import { X } from 'lucide-react';

interface EditProjectModalProps {
  show: boolean;
  onClose: () => void;
  form: {
    project_title: string;
    description: string;
    status: string;
    start_date: string;
    deadline: string;
    client_id: string;
  };
  onChange: (field: string, value: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  userRole?: 'admin' | 'owner' | 'client' | 'freelancer';
  clients?: Array<{ id: string; company_name: string; client_name: string }>;
  loadingClients?: boolean;
}

export function EditProjectModal({ 
  show, 
  onClose, 
  form, 
  onChange, 
  onSubmit, 
  submitting,
  userRole,
  clients = [],
  loadingClients = false
}: EditProjectModalProps) {
  if (!show) return null;

  const canReassignClient = userRole === 'owner' || userRole === 'admin';

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
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 600,
            color: '#1A1A1A'
          }}>
            Edit Project
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#F3F4F6'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={20} style={{ color: '#6B7280' }} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={onSubmit} style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {/* Client Reassignment (Owner/Admin Only) */}
          {canReassignClient && (
            <>
              <div style={{
                padding: '12px 16px',
                background: '#FEF3C7',
                border: '1px solid #F59E0B',
                borderRadius: '12px',
                fontSize: '13px',
                color: '#92400E',
                lineHeight: 1.5
              }}>
                ⚠️ Changing the client will reassign this project to another company
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#2A2A2A'
                }}>
                  Assigned Client *
                </label>
                {loadingClients ? (
                  <div style={{
                    width: '100%',
                    height: '48px',
                    padding: '0 14px',
                    borderRadius: '16px',
                    border: '1px solid #E6E6E6',
                    background: '#F9FAFB',
                    display: 'flex',
                    alignItems: 'center',
                    color: '#6B7280',
                    fontSize: '14px'
                  }}>
                    Loading clients...
                  </div>
                ) : (
                  <select
                    value={form.client_id}
                    onChange={(e) => onChange('client_id', e.target.value)}
                    required
                    style={{
                      width: '100%',
                      height: '48px',
                      padding: '0 14px',
                      paddingRight: '40px',
                      borderRadius: '16px',
                      border: '1px solid #E6E6E6',
                      backgroundColor: '#FFFFFF',
                      color: '#2A2A2A',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      appearance: 'none'
                    }}
                  >
                    <option value="">Select a client...</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.company_name || client.client_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </>
          )}

          <div>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#2A2A2A'
            }}>
              Project Title *
            </label>
            <input
              type="text"
              value={form.project_title}
              onChange={(e) => onChange('project_title', e.target.value)}
              required
              style={{
                width: '100%',
                height: '48px',
                padding: '0 14px',
                borderRadius: '16px',
                border: '1px solid #E6E6E6',
                background: '#FFFFFF',
                color: '#2A2A2A',
                fontSize: '15px',
                fontWeight: 500
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#2A2A2A'
            }}>
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => onChange('description', e.target.value)}
              rows={4}
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '14px',
                borderRadius: '16px',
                border: '1px solid #E6E6E6',
                background: '#FFFFFF',
                color: '#2A2A2A',
                fontSize: '15px',
                fontWeight: 500,
                lineHeight: 1.6,
                resize: 'vertical'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#2A2A2A'
            }}>
              Status *
            </label>
            <select
              value={form.status}
              onChange={(e) => onChange('status', e.target.value)}
              required
              style={{
                width: '100%',
                height: '48px',
                padding: '0 14px',
                paddingRight: '40px',
                borderRadius: '16px',
                border: '1px solid #E6E6E6',
                backgroundColor: '#FFFFFF',
                color: '#2A2A2A',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                appearance: 'none'
              }}
            >
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="at_risk">At Risk</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#2A2A2A'
            }}>
              Start Date
            </label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => onChange('start_date', e.target.value)}
              style={{
                width: '100%',
                height: '48px',
                padding: '0 14px',
                borderRadius: '16px',
                border: '1px solid #E6E6E6',
                background: '#FFFFFF',
                color: '#2A2A2A',
                fontSize: '15px',
                fontWeight: 500
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#2A2A2A'
            }}>
              Deadline
            </label>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => onChange('deadline', e.target.value)}
              style={{
                width: '100%',
                height: '48px',
                padding: '0 14px',
                borderRadius: '16px',
                border: '1px solid #E6E6E6',
                background: '#FFFFFF',
                color: '#2A2A2A',
                fontSize: '15px',
                fontWeight: 500
              }}
            />
          </div>
        </form>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '10px 20px',
              background: '#F3F4F6',
              color: '#1A1A1A',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s ease',
              opacity: submitting ? 0.5 : 1
            }}
            onMouseEnter={(e) => !submitting && (e.currentTarget.style.background = '#E5E7EB')}
            onMouseLeave={(e) => !submitting && (e.currentTarget.style.background = '#F3F4F6')}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={onSubmit}
            disabled={submitting}
            style={{
              padding: '10px 20px',
              background: submitting ? '#9CA3AF' : '#1A1A1A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => !submitting && (e.currentTarget.style.background = '#2A2A2A')}
            onMouseLeave={(e) => !submitting && (e.currentTarget.style.background = '#1A1A1A')}
          >
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CreateMilestoneModalProps {
  show: boolean;
  onClose: () => void;
  form: {
    title: string;
    description: string;
    status: string;
    due_date: string;
  };
  onChange: (field: string, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
}

export function CreateMilestoneModal({ show, onClose, form, onChange, onSubmit, submitting }: CreateMilestoneModalProps) {
  if (!show) return null;

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
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 600,
            color: '#1A1A1A'
          }}>
            Create Milestone
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#F3F4F6'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={20} style={{ color: '#6B7280' }} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={onSubmit} style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {/* Info Banner */}
          <div style={{
            padding: '12px 16px',
            background: '#DBEAFE',
            border: '1px solid #93C5FD',
            borderRadius: '12px',
            fontSize: '13px',
            color: '#1E40AF',
            lineHeight: 1.5
          }}>
            💡 Each milestone added updates project progress automatically
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#2A2A2A'
            }}>
              Milestone Title *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => onChange('title', e.target.value)}
              required
              placeholder="E.g., Design Phase Complete"
              style={{
                width: '100%',
                height: '48px',
                padding: '0 14px',
                borderRadius: '16px',
                border: '1px solid #E6E6E6',
                background: '#FFFFFF',
                color: '#2A2A2A',
                fontSize: '15px',
                fontWeight: 500
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#2A2A2A'
            }}>
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => onChange('description', e.target.value)}
              rows={4}
              placeholder="Describe what needs to be accomplished..."
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '14px',
                borderRadius: '16px',
                border: '1px solid #E6E6E6',
                background: '#FFFFFF',
                color: '#2A2A2A',
                fontSize: '15px',
                fontWeight: 500,
                lineHeight: 1.6,
                resize: 'vertical'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#2A2A2A'
            }}>
              Status *
            </label>
            <select
              value={form.status}
              onChange={(e) => onChange('status', e.target.value)}
              required
              style={{
                width: '100%',
                height: '48px',
                padding: '0 14px',
                paddingRight: '40px',
                borderRadius: '16px',
                border: '1px solid #E6E6E6',
                backgroundColor: '#FFFFFF',
                color: '#2A2A2A',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                appearance: 'none'
              }}
            >
              <option value="planned">Planned</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#2A2A2A'
            }}>
              Due Date
            </label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => onChange('due_date', e.target.value)}
              style={{
                width: '100%',
                height: '48px',
                padding: '0 14px',
                borderRadius: '16px',
                border: '1px solid #E6E6E6',
                background: '#FFFFFF',
                color: '#2A2A2A',
                fontSize: '15px',
                fontWeight: 500
              }}
            />
          </div>
        </form>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '10px 20px',
              background: '#F3F4F6',
              color: '#1A1A1A',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s ease',
              opacity: submitting ? 0.5 : 1
            }}
            onMouseEnter={(e) => !submitting && (e.currentTarget.style.background = '#E5E7EB')}
            onMouseLeave={(e) => !submitting && (e.currentTarget.style.background = '#F3F4F6')}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={onSubmit}
            disabled={submitting}
            style={{
              padding: '10px 20px',
              background: submitting ? '#9CA3AF' : '#1A1A1A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => !submitting && (e.currentTarget.style.background = '#2A2A2A')}
            onMouseLeave={(e) => !submitting && (e.currentTarget.style.background = '#1A1A1A')}
          >
            {submitting ? 'Creating...' : 'Create Milestone'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CreateMessageModalProps {
  show: boolean;
  onClose: () => void;
  form: {
    message: string;
  };
  onChange: (field: string, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
}

export function CreateMessageModal({ show, onClose, form, onChange, onSubmit, submitting }: CreateMessageModalProps) {
  if (!show) return null;

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
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 600,
            color: '#1A1A1A'
          }}>
            Send Message
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#F3F4F6'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={20} style={{ color: '#6B7280' }} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={onSubmit} style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#2A2A2A'
            }}>
              Message *
            </label>
            <textarea
              value={form.message}
              onChange={(e) => onChange('message', e.target.value)}
              rows={6}
              required
              placeholder="Type your message here..."
              style={{
                width: '100%',
                minHeight: '180px',
                padding: '14px',
                borderRadius: '16px',
                border: '1px solid #E6E6E6',
                background: '#FFFFFF',
                color: '#2A2A2A',
                fontSize: '15px',
                fontWeight: 500,
                lineHeight: 1.6,
                resize: 'vertical'
              }}
            />
          </div>
        </form>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '10px 20px',
              background: '#F3F4F6',
              color: '#1A1A1A',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s ease',
              opacity: submitting ? 0.5 : 1
            }}
            onMouseEnter={(e) => !submitting && (e.currentTarget.style.background = '#E5E7EB')}
            onMouseLeave={(e) => !submitting && (e.currentTarget.style.background = '#F3F4F6')}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={onSubmit}
            disabled={submitting}
            style={{
              padding: '10px 20px',
              background: submitting ? '#9CA3AF' : '#1A1A1A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => !submitting && (e.currentTarget.style.background = '#2A2A2A')}
            onMouseLeave={(e) => !submitting && (e.currentTarget.style.background = '#1A1A1A')}
          >
            {submitting ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CreateTicketModalProps {
  show: boolean;
  onClose: () => void;
  form: {
    title: string;
    description: string;
    priority: string;
    category: string;
  };
  onChange: (field: string, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
}

export function CreateTicketModal({ show, onClose, form, onChange, onSubmit, submitting }: CreateTicketModalProps) {
  if (!show) return null;

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
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 600,
            color: '#1A1A1A'
          }}>
            Create Ticket
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#F3F4F6'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={20} style={{ color: '#6B7280' }} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={onSubmit} style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#2A2A2A'
            }}>
              Ticket Title *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => onChange('title', e.target.value)}
              required
              placeholder="E.g., Issue with project file"
              style={{
                width: '100%',
                height: '48px',
                padding: '0 14px',
                borderRadius: '16px',
                border: '1px solid #E6E6E6',
                background: '#FFFFFF',
                color: '#2A2A2A',
                fontSize: '15px',
                fontWeight: 500
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#2A2A2A'
            }}>
              Description *
            </label>
            <textarea
              value={form.description}
              onChange={(e) => onChange('description', e.target.value)}
              rows={4}
              required
              placeholder="Describe the issue in detail..."
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '14px',
                borderRadius: '16px',
                border: '1px solid #E6E6E6',
                background: '#FFFFFF',
                color: '#2A2A2A',
                fontSize: '15px',
                fontWeight: 500,
                lineHeight: 1.6,
                resize: 'vertical'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#2A2A2A'
            }}>
              Priority *
            </label>
            <select
              value={form.priority}
              onChange={(e) => onChange('priority', e.target.value)}
              required
              style={{
                width: '100%',
                height: '48px',
                padding: '0 14px',
                paddingRight: '40px',
                borderRadius: '16px',
                border: '1px solid #E6E6E6',
                backgroundColor: '#FFFFFF',
                color: '#2A2A2A',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                appearance: 'none'
              }}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#2A2A2A'
            }}>
              Category *
            </label>
            <select
              value={form.category}
              onChange={(e) => onChange('category', e.target.value)}
              required
              style={{
                width: '100%',
                height: '48px',
                padding: '0 14px',
                paddingRight: '40px',
                borderRadius: '16px',
                border: '1px solid #E6E6E6',
                backgroundColor: '#FFFFFF',
                color: '#2A2A2A',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                appearance: 'none'
              }}
            >
              <option value="general">General</option>
              <option value="bug">Bug</option>
              <option value="feature">Feature Request</option>
              <option value="support">Support</option>
              <option value="question">Question</option>
            </select>
          </div>
        </form>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '10px 20px',
              background: '#F3F4F6',
              color: '#1A1A1A',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s ease',
              opacity: submitting ? 0.5 : 1
            }}
            onMouseEnter={(e) => !submitting && (e.currentTarget.style.background = '#E5E7EB')}
            onMouseLeave={(e) => !submitting && (e.currentTarget.style.background = '#F3F4F6')}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={onSubmit}
            disabled={submitting}
            style={{
              padding: '10px 20px',
              background: submitting ? '#9CA3AF' : '#1A1A1A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => !submitting && (e.currentTarget.style.background = '#2A2A2A')}
            onMouseLeave={(e) => !submitting && (e.currentTarget.style.background = '#1A1A1A')}
          >
            {submitting ? 'Creating...' : 'Create Ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}




