import { useState, useEffect } from 'react';
import { Plus, X, FolderOpen, Briefcase } from 'lucide-react';
import { baseUrl } from '../../lib/base-url';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  type: string;
  color?: string;
  client_id?: string;
  is_archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  boardCount?: number;
}

interface Client {
  id: string;
  name: string;
  email?: string;
}

export default function WorkOsOverview() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [highlightedWorkspaceId, setHighlightedWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    setLoading(true);
    try {
      console.log('[WorkOsOverview] Loading workspaces...');
      const workspacesRes = await fetch('/api/work-os/workspaces', {
        credentials: 'include'
      });
      
      console.log('[WorkOsOverview] Workspaces response status:', workspacesRes.status);
      
      if (workspacesRes.ok) {
        const data = await workspacesRes.json();
        const workspacesData = data.workspaces || [];
        
        console.log('[WorkOsOverview] Loaded workspaces:', workspacesData.length);
        
        // Load board counts for each workspace
        if (workspacesData.length > 0) {
          const workspacesWithCounts = await Promise.all(
            workspacesData.map(async (ws: Workspace) => {
              const boardsRes = await fetch(`/api/work-os/boards?workspace_id=${ws.id}`, {
                credentials: 'include'
              });
              if (boardsRes.ok) {
                const boardsData = await boardsRes.json();
                return { ...ws, boardCount: boardsData.boards?.length || 0 };
              }
              return { ...ws, boardCount: 0 };
            })
          );
          setWorkspaces(workspacesWithCounts);
        } else {
          setWorkspaces([]);
        }
      } else {
        const errorData = await workspacesRes.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[WorkOsOverview] Failed to load workspaces:', errorData);
      }
    } catch (error) {
      console.error('[WorkOsOverview] Failed to load workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async (workspace: { name: string; description?: string; type: string; color: string; client_id?: string }) => {
    try {
      const body: any = {
        name: workspace.name,
        type: workspace.type,
        color: workspace.color
      };

      if (workspace.description && workspace.description.trim()) {
        body.description = workspace.description.trim();
      }

      if (workspace.type === 'client' && workspace.client_id && workspace.client_id.trim()) {
        body.client_id = workspace.client_id.trim();
      }

      console.log('[WorkOsOverview] ========== CREATE WORKSPACE REQUEST ==========');
      console.log('[WorkOsOverview] Payload:', JSON.stringify(body, null, 2));
      console.log('[WorkOsOverview] Request URL:', '/api/work-os/workspaces');
      console.log('[WorkOsOverview] Method: POST');
      console.log('[WorkOsOverview] Credentials: include');
      console.log('[WorkOsOverview] Content-Type: application/json');

      const response = await fetch('/api/work-os/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      console.log('[WorkOsOverview] ========== CREATE WORKSPACE RESPONSE ==========');
      console.log('[WorkOsOverview] Status:', response.status);
      console.log('[WorkOsOverview] Status Text:', response.statusText);
      console.log('[WorkOsOverview] Headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const data = await response.json();
        console.log('[WorkOsOverview] ✅ Workspace created successfully:', data.workspace.id);
        console.log('[WorkOsOverview] Workspace details:', JSON.stringify(data.workspace, null, 2));
        
        const newWorkspace = { ...data.workspace, boardCount: 0 };
        
        // Add to list
        setWorkspaces([newWorkspace, ...workspaces]);
        
        // Highlight the new workspace
        setHighlightedWorkspaceId(newWorkspace.id);
        setTimeout(() => setHighlightedWorkspaceId(null), 2000);
        
        // Close modal
        setShowCreateWorkspace(false);
      } else {
        const responseText = await response.text();
        console.log('[WorkOsOverview] ❌ Response body (raw):', responseText);
        
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { error: responseText || 'Unknown error' };
        }
        
        console.log('[WorkOsOverview] ❌ Error data (parsed):', errorData);
        
        // Detailed status-specific error messages
        let errorMessage = errorData.error || 'Failed to create workspace';
        
        if (response.status === 401) {
          console.error('[WorkOsOverview] ❌ 401 UNAUTHORIZED - Auth failure');
          errorMessage = 'Authentication failed. Please refresh the page and try again.';
        } else if (response.status === 400) {
          console.error('[WorkOsOverview] ❌ 400 BAD REQUEST - Invalid payload:', errorData);
          errorMessage = `Invalid request: ${errorData.error || 'Check the form fields'}`;
        } else if (response.status === 403) {
          console.error('[WorkOsOverview] ❌ 403 FORBIDDEN - Permission denied');
          errorMessage = 'You do not have permission to create workspaces.';
        } else if (response.status === 500) {
          console.error('[WorkOsOverview] ❌ 500 SERVER ERROR - Database or server issue:', errorData);
          errorMessage = `Server error: ${errorData.details || errorData.error || 'Internal error'}`;
        }
        
        console.error('[WorkOsOverview] Final error message:', errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('[WorkOsOverview] ❌ Exception during create workspace:', error);
      throw error;
    }
  };

  const handleOpenWorkspace = (workspaceId: string) => {
    window.location.href = `${baseUrl}/work-os/boards?workspace_id=${workspaceId}`;
  };

  const handleViewBoards = () => {
    window.location.href = `${baseUrl}/work-os/boards`;
  };

  return (
    <div
      style={{
        padding: '24px',
        fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
      }}
    >
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '32px',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 600,
              color: '#1A1A1A',
              margin: '0 0 4px 0',
              letterSpacing: '-0.02em'
            }}
          >
            Workspaces
          </h1>
          <p
            style={{
              fontSize: '15px',
              color: '#6B7280',
              margin: 0
            }}
          >
            Organize your boards into dedicated workspaces
          </p>
        </div>

        <button
          onClick={() => setShowCreateWorkspace(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            background: '#1A1A1A',
            color: '#FFFFFF',
            fontSize: '14px',
            fontWeight: 500,
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            transition: 'background 0.2s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#2A2A2A')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#1A1A1A')}
        >
          <Plus size={16} />
          New Workspace
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px'
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                background: '#F9FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: '14px',
                padding: '24px',
                height: '140px',
                animation: 'pulse 1.5s ease-in-out infinite'
              }}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && workspaces.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '80px 20px',
            background: '#FFFFFF',
            border: '2px dashed #E5E7EB',
            borderRadius: '16px'
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 24px',
              background: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <FolderOpen size={40} color="#6B7280" />
          </div>

          <h3
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '8px',
              margin: '0 0 8px 0'
            }}
          >
            No workspaces yet
          </h3>

          <p
            style={{
              fontSize: '15px',
              color: '#6B7280',
              margin: '0 0 28px 0',
              maxWidth: '400px',
              marginLeft: 'auto',
              marginRight: 'auto',
              lineHeight: 1.6
            }}
          >
            Workspaces help you organize boards by team, project, or client. Create your first workspace to get started.
          </p>

          <button
            onClick={() => setShowCreateWorkspace(true)}
            style={{
              padding: '12px 24px',
              background: '#1A1A1A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
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
            Create Your First Workspace
          </button>
        </div>
      )}

      {/* Workspaces Grid */}
      {!loading && workspaces.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px'
          }}
        >
          {/* All Boards Overview Card */}
          <div
            onClick={handleViewBoards}
            style={{
              background: '#FFFFFF',
              border: '2px solid #E5E7EB',
              borderRadius: '14px',
              padding: '24px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#1A1A1A';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#E5E7EB';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)';
            }}
          >
            <div
              style={{
                fontSize: '13px',
                color: '#6B7280',
                marginBottom: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              All Boards
            </div>

            <div
              style={{
                fontSize: '48px',
                fontWeight: 700,
                color: '#1A1A1A',
                lineHeight: 1,
                marginBottom: '12px'
              }}
            >
              {workspaces.reduce((sum, ws) => sum + (ws.boardCount || 0), 0)}
            </div>

            <div
              style={{
                fontSize: '14px',
                color: '#6B7280',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Briefcase size={14} />
              <span>Across {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* User Workspaces */}
          {workspaces
            .filter((ws) => !ws.is_archived)
            .map((workspace) => (
              <div
                key={workspace.id}
                onClick={() => handleOpenWorkspace(workspace.id)}
                style={{
                  background: workspace.color || '#3B82F6',
                  border: highlightedWorkspaceId === workspace.id ? '3px solid #1A1A1A' : '2px solid transparent',
                  borderRadius: '14px',
                  padding: '24px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  color: '#FFFFFF',
                  transform: highlightedWorkspaceId === workspace.id ? 'scale(1.02)' : 'scale(1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)';
                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)';
                }}
                onMouseLeave={(e) => {
                  const isHighlighted = highlightedWorkspaceId === workspace.id;
                  e.currentTarget.style.transform = isHighlighted ? 'scale(1.02)' : 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                }}
              >
                <div
                  style={{
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.9)',
                    marginBottom: '4px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  {workspace.type === 'internal' ? 'Internal' : 'Client'}
                </div>

                <h3
                  style={{
                    fontSize: '20px',
                    fontWeight: 600,
                    color: '#FFFFFF',
                    margin: '0 0 12px 0',
                    lineHeight: 1.3
                  }}
                >
                  {workspace.name}
                </h3>

                {workspace.description && (
                  <p
                    style={{
                      fontSize: '14px',
                      color: 'rgba(255,255,255,0.85)',
                      margin: '0 0 16px 0',
                      lineHeight: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {workspace.description}
                  </p>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: 'auto'
                  }}
                >
                  <div
                    style={{
                      fontSize: '32px',
                      fontWeight: 700,
                      color: '#FFFFFF',
                      lineHeight: 1
                    }}
                  >
                    {workspace.boardCount || 0}
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      color: 'rgba(255,255,255,0.9)',
                      fontWeight: 500
                    }}
                  >
                    {workspace.boardCount === 1 ? 'board' : 'boards'}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Create Workspace Modal */}
      {showCreateWorkspace && (
        <CreateWorkspaceModal
          onClose={() => setShowCreateWorkspace(false)}
          onCreate={handleCreateWorkspace}
        />
      )}

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
}

interface CreateWorkspaceModalProps {
  onClose: () => void;
  onCreate: (workspace: { name: string; description?: string; type: string; color: string; client_id?: string }) => Promise<void>;
}

function CreateWorkspaceModal({ onClose, onCreate }: CreateWorkspaceModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [type, setType] = useState('internal');
  const [clientId, setClientId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  // Load clients when modal opens
  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoadingClients(true);
    try {
      const response = await fetch(`${baseUrl}/api/clients/list`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      } else {
        console.error('[CreateWorkspaceModal] Failed to load clients:', response.status);
      }
    } catch (error) {
      console.error('[CreateWorkspaceModal] Error loading clients:', error);
    } finally {
      setLoadingClients(false);
    }
  };

  const colors = [
    { value: '#3B82F6', name: 'Blue' },
    { value: '#8B5CF6', name: 'Purple' },
    { value: '#EC4899', name: 'Pink' },
    { value: '#F59E0B', name: 'Amber' },
    { value: '#10B981', name: 'Green' },
    { value: '#06B6D4', name: 'Cyan' },
    { value: '#EF4444', name: 'Red' },
    { value: '#6366F1', name: 'Indigo' }
  ];

  const isFormValid = () => {
    if (!name.trim()) return false;
    if (type === 'client' && !clientId.trim()) return false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;

    setError('');
    setIsSubmitting(true);

    try {
      const workspace: any = {
        name: name.trim(),
        type,
        color
      };

      if (description.trim()) {
        workspace.description = description.trim();
      }

      if (type === 'client' && clientId.trim()) {
        workspace.client_id = clientId.trim();
      }

      await onCreate(workspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
      setIsSubmitting(false);
    }
  };

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
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998,
          backdropFilter: 'blur(4px)',
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
          background: '#FFFFFF',
          borderRadius: '16px',
          padding: '0',
          width: '90%',
          maxWidth: '480px',
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
            padding: '24px 24px 20px 24px',
            borderBottom: '1px solid #E5E7EB'
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
            Create New Workspace
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
                htmlFor="workspace-name"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#1A1A1A',
                  marginBottom: '8px'
                }}
              >
                Workspace Name *
              </label>
              <input
                id="workspace-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                placeholder="e.g. Marketing Projects"
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '15px',
                  color: '#1A1A1A',
                  backgroundColor: isSubmitting ? '#F9FAFB' : '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: '10px',
                  outline: 'none',
                  transition: 'border 0.2s',
                  fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
                  cursor: isSubmitting ? 'not-allowed' : 'text',
                  boxSizing: 'border-box'
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
                htmlFor="workspace-description"
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
                id="workspace-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                placeholder="Brief description of this workspace..."
                rows={2}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '14px',
                  color: '#1A1A1A',
                  backgroundColor: isSubmitting ? '#F9FAFB' : '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: '10px',
                  outline: 'none',
                  transition: 'border 0.2s',
                  fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
                  resize: 'vertical',
                  cursor: isSubmitting ? 'not-allowed' : 'text',
                  boxSizing: 'border-box'
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

            {/* Type Field */}
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="workspace-type"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#1A1A1A',
                  marginBottom: '8px'
                }}
              >
                Type *
              </label>
              <select
                id="workspace-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '15px',
                  color: '#1A1A1A',
                  backgroundColor: isSubmitting ? '#F9FAFB' : '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: '10px',
                  outline: 'none',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
                  boxSizing: 'border-box'
                }}
              >
                <option value="internal">Internal</option>
                <option value="client">Client</option>
              </select>
            </div>

            {/* Client ID Field (conditional) */}
            {type === 'client' && (
              <div style={{ marginBottom: '20px' }}>
                <label
                  htmlFor="client-id"
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#1A1A1A',
                    marginBottom: '8px'
                  }}
                >
                  Select Client *
                </label>
                <select
                  id="client-id"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  disabled={isSubmitting || loadingClients}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '15px',
                    color: clientId ? '#1A1A1A' : '#9CA3AF',
                    backgroundColor: (isSubmitting || loadingClients) ? '#F9FAFB' : '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '10px',
                    outline: 'none',
                    cursor: (isSubmitting || loadingClients) ? 'not-allowed' : 'pointer',
                    fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
                    transition: 'border 0.2s',
                    boxSizing: 'border-box',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 14px center',
                    backgroundSize: '16px 16px',
                    paddingRight: '40px'
                  }}
                  onFocus={(e) => {
                    if (!isSubmitting && !loadingClients) {
                      e.currentTarget.style.borderColor = '#1A1A1A';
                    }
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E5E7EB';
                  }}
                >
                  <option value="" disabled>
                    {loadingClients ? 'Loading clients...' : 'Choose a client'}
                  </option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} {client.email ? `(${client.email})` : ''}
                    </option>
                  ))}
                  {!loadingClients && clients.length === 0 && (
                    <option value="" disabled>
                      No clients available
                    </option>
                  )}
                </select>
              </div>
            )}

            {/* Color Field */}
            <div style={{ marginBottom: error ? '20px' : '0' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#1A1A1A',
                  marginBottom: '12px'
                }}
              >
                Color *
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '12px'
                }}
              >
                {colors.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    disabled={isSubmitting}
                    title={c.name}
                    style={{
                      width: '100%',
                      height: '52px',
                      background: c.value,
                      borderRadius: '10px',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      border: color === c.value ? '3px solid #1A1A1A' : '2px solid transparent',
                      transition: 'all 0.2s',
                      transform: color === c.value ? 'scale(1.05)' : 'scale(1)',
                      opacity: isSubmitting ? 0.6 : 1,
                      boxShadow: color === c.value ? '0 4px 8px rgba(0,0,0,0.15)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSubmitting && color !== c.value) {
                        e.currentTarget.style.transform = 'scale(1.03)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (color !== c.value) {
                        e.currentTarget.style.transform = 'scale(1)';
                      }
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  borderRadius: '8px',
                  marginTop: '20px'
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
              disabled={isSubmitting || !isFormValid()}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#FFFFFF',
                backgroundColor: isSubmitting || !isFormValid() ? '#9CA3AF' : '#1A1A1A',
                border: 'none',
                borderRadius: '8px',
                cursor: isSubmitting || !isFormValid() ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
                fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting && isFormValid()) {
                  e.currentTarget.style.backgroundColor = '#2A2A2A';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting && isFormValid()) {
                  e.currentTarget.style.backgroundColor = '#1A1A1A';
                }
              }}
            >
              {isSubmitting ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}






