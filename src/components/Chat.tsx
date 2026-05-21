import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Send, Paperclip, X } from 'lucide-react';

// Temporary stub functions
type User = any;
type ChatRoom = any;
type ChatMessage = any;
const getCurrentUser = async () => null;
const getChatRooms = async () => [];
const getMessages = async (_roomId: string) => [];
const getUsers = async () => [];
const sendMessage = async (_data: any) => ({});
const uploadFile = async (_file: File) => ({ url: '' });
const updateOnlineStatus = async (_status: string) => ({});
const subscribeToMessages = (_roomId: string, _callback: any) => ({ unsubscribe: () => {} });
const subscribeToUserStatus = (_userId: string, _callback: any) => ({ unsubscribe: () => {} });

interface ChatProps {
  baseUrl: string;
}

const Chat: React.FC<ChatProps> = ({ baseUrl }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize chat
  useEffect(() => {
    initializeChat();

    return () => {
      if (currentUser) {
        updateOnlineStatus(currentUser.id, false);
      }
    };
  }, []);

  const initializeChat = async () => {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
      window.location.href = `${baseUrl}/`;
      return;
    }

    setCurrentUser(user);
    await updateOnlineStatus(user.id, true);

    // Load initial data
    const [roomsData, usersData] = await Promise.all([
      getChatRooms(),
      getUsers(),
    ]);

    setRooms(roomsData);
    setUsers(usersData);

    // Select first room by default
    if (roomsData.length > 0) {
      selectRoom(roomsData[0]);
    }

    // Subscribe to user status changes
    const statusChannel = subscribeToUserStatus((updatedUser) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
      );
    });

    return () => {
      statusChannel.unsubscribe();
    };
  };

  // Select a room
  const selectRoom = async (room: ChatRoom) => {
    setSelectedRoom(room);
    const messagesData = await getMessages(room.id);
    setMessages(messagesData);

    // Subscribe to new messages
    const messageChannel = subscribeToMessages(room.id, (newMessage) => {
      setMessages((prev) => [...prev, newMessage]);
    });

    return () => {
      messageChannel.unsubscribe();
    };
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Remove selected file
  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser || !selectedRoom) return;
    if (!messageText.trim() && !selectedFile) return;

    setIsSending(true);

    try {
      let fileUrl: string | undefined;
      let fileName: string | undefined;
      let fileType: string | undefined;

      // Upload file if selected
      if (selectedFile) {
        setIsUploading(true);
        fileUrl = await uploadFile(selectedFile, currentUser.id);
        fileName = selectedFile.name;
        fileType = selectedFile.type;
        setIsUploading(false);
      }

      // Send message
      await sendMessage(
        selectedRoom.id,
        currentUser.id,
        messageText.trim() || '(File attachment)',
        fileUrl,
        fileName,
        fileType
      );

      // Reset form
      setMessageText('');
      removeFile();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
      setIsUploading(false);
    }
  };

  // Get user initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const time = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    if (date.toDateString() === today.toDateString()) {
      return `Today at ${time}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${time}`;
    } else {
      return `${date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })} at ${time}`;
    }
  };

  if (!currentUser) {
    return (
      <div className="chat-loading">
        <p>Loading chat...</p>
      </div>
    );
  }

  return (
    <div className="chat-container">
      {/* Left Sidebar - Users & Rooms */}
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h3>Team Chat</h3>
        </div>

        {/* Chat Rooms */}
        <div className="chat-rooms">
          <div className="chat-rooms-title">Rooms</div>
          {rooms.map((room) => (
            <button
              key={room.id}
              className={`chat-room-item ${
                selectedRoom?.id === room.id ? 'active' : ''
              }`}
              onClick={() => selectRoom(room)}
            >
              <span className="chat-room-name">{room.name}</span>
            </button>
          ))}
        </div>

        {/* Online Users */}
        <div className="chat-users">
          <div className="chat-users-title">Team Members</div>
          {users
            .filter((u) => u.role === 'admin' || u.role === 'staff')
            .map((user) => (
              <div key={user.id} className="chat-user-item">
                <div className="chat-user-avatar">
                  {getInitials(user.full_name)}
                </div>
                <div className="chat-user-info">
                  <span className="chat-user-name">{user.full_name}</span>
                  <span
                    className={`chat-user-status ${
                      user.is_online ? 'online' : 'offline'
                    }`}
                  >
                    {user.is_online ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div
                  className={`chat-user-indicator ${
                    user.is_online ? 'online' : ''
                  }`}
                />
              </div>
            ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="chat-main">
        {selectedRoom ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <h2>{selectedRoom.name}</h2>
              <p>
                {messages.length} message{messages.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Messages */}
            <div className="chat-messages">
              {messages.map((message) => {
                const isOwnMessage = message.user_id === currentUser.id;
                return (
                  <div
                    key={message.id}
                    className={`chat-message ${
                      isOwnMessage ? 'outgoing' : 'incoming'
                    }`}
                  >
                    {!isOwnMessage && (
                      <div className="chat-message-avatar">
                        {getInitials(message.user?.full_name || 'Unknown')}
                      </div>
                    )}
                    <div className="chat-message-content">
                      {!isOwnMessage && (
                        <div className="chat-message-sender">
                          {message.user?.full_name || 'Unknown User'}
                        </div>
                      )}
                      <div className="chat-message-bubble">
                        <p>{message.content}</p>
                        {message.file_url && (
                          <div className="chat-message-file">
                            {message.file_type?.startsWith('image/') ? (
                              <img
                                src={message.file_url}
                                alt={message.file_name}
                                className="chat-message-image"
                              />
                            ) : (
                              <a
                                href={message.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="chat-message-file-link"
                              >
                                📎 {message.file_name}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="chat-message-time">
                        {formatTime(message.created_at)}
                      </div>
                    </div>
                    {isOwnMessage && (
                      <div className="chat-message-avatar">
                        {getInitials(currentUser.full_name)}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="chat-input-container">
              {selectedFile && (
                <div className="chat-file-preview">
                  <span className="chat-file-name">📎 {selectedFile.name}</span>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="chat-file-remove"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="chat-input-form">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.doc,.docx"
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="chat-attach-button"
                  disabled={isUploading || isSending}
                >
                  <Paperclip size={20} />
                </button>
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  className="chat-input-field"
                  disabled={isUploading || isSending}
                />
                <button
                  type="submit"
                  className="chat-send-button"
                  disabled={
                    (!messageText.trim() && !selectedFile) ||
                    isUploading ||
                    isSending
                  }
                >
                  {isUploading ? (
                    'Uploading...'
                  ) : isSending ? (
                    'Sending...'
                  ) : (
                    <Send size={20} />
                  )}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="chat-empty">
            <p>Select a room to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
