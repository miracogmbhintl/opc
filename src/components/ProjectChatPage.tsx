
/**
 * Project Chat Page - Apple-Inspired Minimal Design
 * Visual shell with preserved backend logic
 * All chat functionality maintained exactly as-is
 * 
 * STEP 14: Visual polish - removed marginLeft, normalized spacing and typography
 */

import { useState, useEffect, useRef } from 'react';
import { useProjects, useProjectChat } from '../hooks/use-projects';
import { getCurrentClientId } from '../lib/supabase-projects';
import { getUserProfile } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import Chat from './Chat';
import { MessageSquare } from 'lucide-react';

interface Message {
  id: string;
  sender_id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
  sender?: {
    name: string;
    role: string;
  };
}

export default function ProjectChatPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [currentMessage, setCurrentMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { projects, loading: projectsLoading } = useProjects();
  const { messages, sendMessage, loading: chatLoading } = useProjectChat(selectedProjectId);

  useEffect(() => {
    loadUserRole();
  }, []);

  useEffect(() => {
    // Auto-select first project if none selected
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadUserRole = async () => {
    try {
      const profile = await getUserProfile();
      setUserRole(profile.role);
    } catch (error) {
      console.error('Failed to load user role:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim() || !selectedProjectId || sending) return;

    setSending(true);
    try {
      await sendMessage(currentMessage, false);
      setCurrentMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#1A1A1A';
      case 'at_risk': return '#6B7280';
      case 'completed': return '#9CA3AF';
      default: return '#6B7280';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // Filter internal messages for clients
  const visibleMessages = userRole === 'client' 
    ? messages.filter(msg => !msg.is_internal)
    : messages;

  if (projectsLoading) {
    return null;
  }

  if (projects.length === 0) {
    return (
      <div style={{ padding: '0' }}>
        {/* Page Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 600,
            color: '#1A1A1A',
            margin: '0 0 4px 0',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
            letterSpacing: '-0.02em'
          }}>
            Project Chat
          </h1>
          <p style={{
            fontSize: '15px',
            color: '#6B7280',
            margin: 0,
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
          }}>
            Internal communication for your projects
          </p>
        </div>

        {/* Empty State */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '14px',
          padding: '80px 40px',
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
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9CA3AF"
              strokeWidth="1.5"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h3 style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#1A1A1A',
            margin: '0 0 8px 0',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
          }}>
            No projects available
          </h3>
          <p style={{
            fontSize: '14px',
            color: '#6B7280',
            margin: 0,
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
          }}>
            Projects will appear here when available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 600,
          color: '#1A1A1A',
          margin: '0 0 4px 0',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
          letterSpacing: '-0.02em'
        }}>
          Project Chat
        </h1>
        <p style={{
          fontSize: '15px',
          color: '#6B7280',
          margin: 0,
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
        }}>
          Internal communication for this project
        </p>
      </div>

      {/* Main Chat Container */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '300px 1fr',
        gap: '24px',
        height: 'calc(100vh - 280px)',
        minHeight: '600px'
      }}>
        {/* Left Sidebar - Project List */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '14px',
          padding: '24px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <h2 style={{
            fontSize: '17px',
            fontWeight: 600,
            color: '#1A1A1A',
            margin: '0 0 16px 0',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
          }}>
            Projects
          </h2>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            overflowY: 'auto',
            flex: 1
          }}>
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => setSelectedProjectId(project.id)}
                style={{
                  padding: '14px',
                  background: selectedProjectId === project.id ? '#F9FAFB' : '#FFFFFF',
                  border: `1px solid ${selectedProjectId === project.id ? '#1A1A1A' : '#E5E7EB'}`,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (selectedProjectId !== project.id) {
                    e.currentTarget.style.background = '#F9FAFB';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedProjectId !== project.id) {
                    e.currentTarget.style.background = '#FFFFFF';
                  }
                }}
              >
                <div style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#1A1A1A',
                  marginBottom: '6px',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                }}>
                  {project.project_title}
                </div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: getStatusColor(project.status),
                  textTransform: 'capitalize',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                }}>
                  {project.status.replace('_', ' ')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Chat Window */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '14px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Chat Header */}
          <div style={{
            padding: '24px 32px',
            borderBottom: '1px solid #E5E7EB'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#1A1A1A',
              margin: '0 0 4px 0',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
            }}>
              {selectedProject?.project_title || 'Select a project'}
            </h2>
            <p style={{
              fontSize: '13px',
              color: '#6B7280',
              margin: 0,
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
            }}>
              {selectedProject && `${selectedProject.client?.company_name || 'Client Communication'}`}
            </p>
          </div>

          {/* Messages Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {chatLoading ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#6B7280'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid #F3F4F6',
                  borderTopColor: '#1A1A1A',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
              </div>
            ) : visibleMessages.length === 0 ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                height: '100%',
                textAlign: 'center'
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
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#9CA3AF"
                    strokeWidth="1.5"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#1A1A1A',
                  margin: '0 0 6px 0',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                }}>
                  No messages yet
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#6B7280',
                  margin: 0,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                }}>
                  Project communication will appear here
                </p>
              </div>
            ) : (
              visibleMessages.map((message) => {
                const isAdmin = message.sender?.role === 'admin' || message.sender?.role === 'owner';
                return (
                  <div
                    key={message.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      maxWidth: '70%'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '6px'
                    }}>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#1A1A1A',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                      }}>
                        {message.sender?.name || 'Unknown'}
                      </span>
                      <span style={{
                        fontSize: '12px',
                        color: '#6B7280',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                      }}>
                        {formatTime(message.created_at)}
                      </span>
                      {message.is_internal && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#1A1A1A',
                          background: '#F3F4F6',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                        }}>
                          INTERNAL
                        </span>
                      )}
                    </div>
                    <div style={{
                      padding: '12px 16px',
                      background: '#F9FAFB',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: '#1A1A1A',
                      lineHeight: 1.6,
                      width: '100%',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                    }}>
                      {message.body}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input Bar */}
          <form 
            onSubmit={handleSendMessage}
            style={{
              padding: '24px 32px',
              borderTop: '1px solid #E5E7EB',
              display: 'flex',
              gap: '12px'
            }}
          >
            <input
              type="text"
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              placeholder="Type your message..."
              disabled={sending}
              style={{
                flex: 1,
                padding: '10px 14px',
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '10px',
                color: '#1A1A1A',
                fontSize: '14px',
                outline: 'none',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
              }}
            />
            <button
              type="submit"
              disabled={sending || !currentMessage.trim()}
              style={{
                padding: '10px 20px',
                background: sending || !currentMessage.trim() ? '#E5E7EB' : '#1A1A1A',
                border: 'none',
                borderRadius: '10px',
                color: sending || !currentMessage.trim() ? '#6B7280' : '#FFFFFF',
                fontSize: '14px',
                fontWeight: 500,
                cursor: sending || !currentMessage.trim() ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s ease',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
              }}
              onMouseEnter={(e) => {
                if (!sending && currentMessage.trim()) {
                  e.currentTarget.style.background = '#2A2A2A';
                }
              }}
              onMouseLeave={(e) => {
                if (!sending && currentMessage.trim()) {
                  e.currentTarget.style.background = '#1A1A1A';
                }
              }}
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}



