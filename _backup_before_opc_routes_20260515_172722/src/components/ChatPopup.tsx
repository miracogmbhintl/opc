

import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender_type: 'client' | 'admin' | 'owner';
  message: string;
  timestamp: string;
  sender_name?: string;
}

interface ChatResponse {
  success: boolean;
  messages?: ChatMessage[];
  message?: ChatMessage;
}

interface ChatPopupProps {
  userId: string;
  userRole: 'client' | 'admin' | 'owner';
  userName: string;
  userAvatar?: string;
  baseUrl: string;
  isReady?: boolean;
}

export default function ChatPopup({ userId, userRole, userName, baseUrl, isReady = false }: ChatPopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Trigger animation when ready
  useEffect(() => {
    if (isReady) {
      // Small delay to ensure the element is mounted
      setTimeout(() => setShouldAnimate(true), 100);
    }
  }, [isReady]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadMessages();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/chat/messages?userId=${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('mco_auth_token')}`
        }
      });
      const data = await response.json() as ChatResponse;
      if (data.success && data.messages) {
        setMessages(data.messages);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageToSend = newMessage;
    setNewMessage('');

    try {
      const response = await fetch(`${baseUrl}/api/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mco_auth_token')}`
        },
        body: JSON.stringify({
          userId,
          message: messageToSend,
          senderType: userRole
        })
      });

      const data = await response.json() as ChatResponse;
      if (data.success && data.message) {
        setMessages(prev => [...prev, data.message!]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageToSend);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'Gerade eben';
    if (minutes < 60) return `vor ${minutes} Min`;
    if (hours < 24) return `vor ${hours} Std`;
    return date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' });
  };

  return (
    <>
      {/* Chat Button - Miraka Schwarz with Slide-up Animation */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="miraka-chat-button"
          style={{
            position: 'fixed',
            bottom: '32px',
            right: '32px',
            width: '64px',
            height: '64px',
            background: '#DA291C',
            border: 'none',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(218, 41, 28, 0.25)',
            transition: 'all 0.25s ease',
            zIndex: 999998,
            pointerEvents: 'auto',
            // Animation styles
            opacity: shouldAnimate ? 1 : 0,
            transform: shouldAnimate ? 'translateY(0)' : 'translateY(100px)',
            transitionProperty: 'transform, opacity, background, box-shadow',
            transitionDuration: '0.6s',
            transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = shouldAnimate ? 'translateY(0) scale(1.05)' : 'translateY(100px)';
            e.currentTarget.style.background = '#E63C30';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = shouldAnimate ? 'translateY(0) scale(1)' : 'translateY(100px)';
            e.currentTarget.style.background = '#DA291C';
          }}
          aria-label="Chat öffnen"
        >
          <MessageCircle style={{ width: '28px', height: '28px', color: '#FFFFFF', strokeWidth: 2 }} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              background: '#1A1A1A',
              color: '#FFFFFF',
              borderRadius: '50%',
              width: '22px',
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 700,
              border: '2px solid #FFFFFF',
              fontFamily: 'Poppins, sans-serif'
            }}>
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat Window - Miraka Design */}
      {isOpen && (
        <div 
          className="miraka-chat-window"
          style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          width: '420px',
          height: '600px',
          background: '#FFFFFF',
          borderRadius: '22px',
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.12)',
          border: '1px solid #E5E5E5',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 999999,
          overflow: 'hidden',
          fontFamily: 'Inter, Helvetica, Arial, sans-serif',
          pointerEvents: 'auto',
          // Add subtle entrance animation for chat window
          animation: 'slideUpFadeIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          {/* Header - Miraka Style */}
          <div style={{
            padding: '24px 28px',
            background: '#FAFAFA',
            borderBottom: '1px solid #E5E5E5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: '#1A1A1A',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 700,
                fontSize: '16px',
                color: '#FFFFFF',
                position: 'relative'
              }}>
                MC
                <span style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '2px',
                  width: '12px',
                  height: '12px',
                  background: '#22C55E',
                  border: '2.5px solid #FAFAFA',
                  borderRadius: '50%'
                }} />
              </div>
              <div>
                <h3 style={{
                  margin: 0,
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '17px',
                  fontWeight: 700,
                  color: '#1A1A1A',
                  lineHeight: 1.2
                }}>
                  Miraka & Co.
                </h3>
                <p style={{
                  margin: '2px 0 0 0',
                  fontSize: '13px',
                  color: '#6B6B6B',
                  fontWeight: 500,
                  lineHeight: 1.2
                }}>
                  Support Team
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                width: '38px',
                height: '38px',
                background: '#FFFFFF',
                border: '1px solid #E5E5E5',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#FAFAFA';
                e.currentTarget.style.borderColor = '#1A1A1A';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#FFFFFF';
                e.currentTarget.style.borderColor = '#E5E5E5';
              }}
              aria-label="Chat schließen"
            >
              <X style={{ width: '20px', height: '20px', color: '#1A1A1A', strokeWidth: 2.5 }} />
            </button>
          </div>

          {/* Messages Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            background: '#F2F2F2',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {isLoading ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: '14px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid #E5E5E5',
                  borderTopColor: '#1A1A1A',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <p style={{
                  fontSize: '14px',
                  color: '#6B6B6B',
                  margin: 0,
                  fontWeight: 500
                }}>
                  Nachrichten werden geladen...
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                textAlign: 'center',
                padding: '40px 20px'
              }}>
                <MessageCircle style={{ width: '56px', height: '56px', color: '#9A9A9A', strokeWidth: 1.5, marginBottom: '18px' }} />
                <h4 style={{
                  margin: '0 0 10px 0',
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#1A1A1A'
                }}>
                  Willkommen beim Support
                </h4>
                <p style={{
                  margin: 0,
                  fontSize: '14px',
                  color: '#6B6B6B',
                  lineHeight: 1.5,
                  fontWeight: 500
                }}>
                  Stellen Sie uns Ihre Fragen – wir sind für Sie da.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOutgoing = msg.sender_type === userRole;
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isOutgoing ? 'flex-end' : 'flex-start',
                      gap: '6px'
                    }}
                  >
                    <div style={{
                      maxWidth: '75%',
                      padding: '14px 18px',
                      borderRadius: isOutgoing ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: isOutgoing ? '#1A1A1A' : '#FFFFFF',
                      border: isOutgoing ? 'none' : '1px solid #E5E5E5',
                      boxShadow: isOutgoing ? '0 2px 8px rgba(0, 0, 0, 0.1)' : '0 1px 3px rgba(0, 0, 0, 0.06)'
                    }}>
                      <p style={{
                        margin: 0,
                        fontSize: '14px',
                        lineHeight: 1.5,
                        color: isOutgoing ? '#FFFFFF' : '#1A1A1A',
                        fontWeight: 500,
                        wordWrap: 'break-word'
                      }}>
                        {msg.message}
                      </p>
                    </div>
                    <span style={{
                      fontSize: '11px',
                      color: '#9A9A9A',
                      fontWeight: 500,
                      paddingLeft: isOutgoing ? '0' : '8px',
                      paddingRight: isOutgoing ? '8px' : '0'
                    }}>
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form
            onSubmit={handleSendMessage}
            style={{
              padding: '20px 24px',
              background: '#FFFFFF',
              borderTop: '1px solid #E5E5E5',
              display: 'flex',
              gap: '12px'
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Nachricht schreiben..."
              style={{
                flex: 1,
                height: '48px',
                padding: '0 18px',
                background: '#FFFFFF',
                border: '1px solid #E6E6E6',
                borderRadius: '16px',
                fontSize: '14px',
                color: '#1A1A1A',
                fontFamily: 'Inter, Helvetica, Arial, sans-serif',
                fontWeight: 500,
                outline: 'none',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#1A1A1A';
                e.currentTarget.style.background = '#FAFAFA';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#E6E6E6';
                e.currentTarget.style.background = '#FFFFFF';
              }}
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              style={{
                width: '48px',
                height: '48px',
                background: newMessage.trim() ? '#1A1A1A' : '#E5E5E5',
                border: 'none',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease',
                boxShadow: newMessage.trim() ? '0 2px 8px rgba(0, 0, 0, 0.1)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (newMessage.trim()) {
                  e.currentTarget.style.background = '#2A2A2A';
                  e.currentTarget.style.transform = 'scale(1.02)';
                }
              }}
              onMouseLeave={(e) => {
                if (newMessage.trim()) {
                  e.currentTarget.style.background = '#1A1A1A';
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
              aria-label="Nachricht senden"
            >
              <Send style={{
                width: '20px',
                height: '20px',
                color: newMessage.trim() ? '#FFFFFF' : '#9A9A9A',
                strokeWidth: 2.5
              }} />
            </button>
          </form>
        </div>
      )}

      <style>{`
        @keyframes slideUpFadeIn {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        @media (max-width: 768px) {
          /* Permanently hide chat button and window on mobile */
          .miraka-chat-button,
          .miraka-chat-window {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
        }
      `}</style>
    </>
  );
}









