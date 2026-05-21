/**
 * Ticket Detail Page - Miraka & Co Modern Portal Design
 * VERSION: 6.0 (2026-01-04) - MOBILE-FIRST REDESIGN
 * 
 * FEATURES:
 * - Modern MCO Portal design language
 * - Premium mobile-first layout
 * - Cleaner hierarchy and spacing
 * - Refined card system
 * - Dark primary buttons
 * - Better visual grouping
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import MirakaSidebar from './MirakaSidebar';
import {
  ArrowLeft, Clock, AlertCircle, CheckCircle, XCircle, Edit, Trash2, Save, X,
  MessageSquare, Lock, Users, History, Plus, AlertTriangle, ChevronLeft, User, Calendar, Tag
} from 'lucide-react';

// ==========================================
// TYPES
// ==========================================

interface TicketDetail {
  id: string;
  ticket_title: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  category: 'general' | 'change_request' | 'help' | 'support' | 'rating' | 'other';
  client_id: string;
  project_id?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  last_modified_by?: string;
  client?: {
    company_name: string;
    client_name: string;
  };
  project?: {
    title: string;
  };
}

interface TicketNote {
  id: string;
  ticket_id: string;
  user_id: string;
  note_type: 'staff' | 'client';
  content: string;
  created_at: string;
  updated_at: string;
  user?: {
    full_name?: string;
    name?: string;
    email?: string;
  };
}

interface ActivityLog {
  id: string;
  ticket_id: string;
  user_id: string;
  action: string;
  old_value?: string;
  new_value?: string;
  description: string;
  created_at: string;
  user?: {
    full_name?: string;
    name?: string;
    email?: string;
  };
}

interface TicketDetailPageProps {
  ticketId: string;
}

type UserRole = 'owner' | 'admin' | 'client';

// ==========================================
// COMPONENT
// ==========================================

export default function TicketDetailPage({ ticketId }: TicketDetailPageProps) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [notes, setNotes] = useState<TicketNote[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [role, setRole] = useState<UserRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editCategory, setEditCategory] = useState<'general' | 'change_request' | 'help' | 'support' | 'rating' | 'other'>('general');
  const [editStatus, setEditStatus] = useState<'open' | 'in_progress' | 'resolved' | 'closed'>('open');

  // Notes state
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteType, setNewNoteType] = useState<'staff' | 'client'>('client');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    initializePage();

    // Mobile detection
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);

    // Listen for sidebar toggle
    const handleSidebarToggle = (e: CustomEvent) => {
      setSidebarCollapsed(e.detail.isCollapsed);
    };

    window.addEventListener('sidebarToggle', handleSidebarToggle as EventListener);

    // Check initial sidebar state
    const savedState = localStorage.getItem('miraka_sidebar_collapsed');
    if (savedState === 'true') {
      setSidebarCollapsed(true);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('sidebarToggle', handleSidebarToggle as EventListener);
    };
  }, [ticketId]);

  const initializePage = async () => {
    try {
      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = `${baseUrl}/miraka-co-portal`;
        return;
      }

      setCurrentUserId(user.id);

      // Get user profile and role
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        window.location.href = `${baseUrl}/miraka-co-portal`;
        return;
      }

      const userRole = profile.role as UserRole;
      setRole(userRole);

      // Load all data
      await Promise.all([
        loadTicket(userRole),
        loadNotes(userRole),
        loadActivityLog(userRole)
      ]);
    } catch (err) {
      console.error('Error initializing page:', err);
      setError('Failed to initialize page');
      setLoading(false);
    }
  };

  const loadTicket = async (userRole?: UserRole) => {
    setLoading(true);
    setError('');
    
    try {
      const { data, error: fetchError } = await supabase
        .from('tickets')
        .select(`
          *,
          clients!tickets_client_id_fkey (
            company_name,
            client_name,
            user_id
          ),
          projects!tickets_project_id_fkey (
            title:project_title
          )
        `)
        .eq('id', ticketId)
        .single();

      if (fetchError) {
        setError(fetchError.code === 'PGRST116' ? 'Ticket not found or access denied' : `Failed to load ticket: ${fetchError.message}`);
        setLoading(false);
        return;
      }

      if (!data) {
        setError('Ticket not found');
        setLoading(false);
        return;
      }
      
      const ticketData: TicketDetail = {
        ...data,
        client: data.clients ? {
          company_name: data.clients.company_name,
          client_name: data.clients.client_name
        } : undefined,
        project: data.projects ? {
          title: data.projects.title
        } : undefined
      };
      
      setTicket(ticketData);
      setEditTitle(ticketData.ticket_title);
      setEditMessage(ticketData.message);
      setEditCategory(ticketData.category);
      setEditStatus(ticketData.status);
      setLoading(false);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Something went wrong');
      setLoading(false);
    }
  };

  const loadNotes = async (userRole?: UserRole) => {
    try {
      const { data: notesData, error: notesError} = await supabase
        .from('ticket_notes')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (notesError) {
        console.error('Error loading notes:', notesError);
        return;
      }

      if (!notesData || notesData.length === 0) {
        setNotes([]);
        return;
      }

      const userIds = [...new Set(notesData.map(note => note.user_id))];

      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, name, full_name, email')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error loading user profiles:', profilesError);
        setNotes(notesData.map(note => ({
          ...note,
          user: { email: 'Unknown' }
        })));
        return;
      }

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const notesWithUsers = notesData.map(note => ({
        ...note,
        user: profileMap.get(note.user_id) || { email: 'Unknown' }
      }));

      setNotes(notesWithUsers);
    } catch (err) {
      console.error('Error loading notes:', err);
    }
  };

  const loadActivityLog = async (userRole?: UserRole) => {
    try {
      const { data: logsData, error: logsError } = await supabase
        .from('ticket_activity_log')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (logsError) {
        console.error('Error loading activity log:', logsError);
        return;
      }

      if (!logsData || logsData.length === 0) {
        setActivityLog([]);
        return;
      }

      const userIds = [...new Set(logsData.map(log => log.user_id))];

      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, name, full_name, email')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error loading user profiles:', profilesError);
        setActivityLog(logsData.map(log => ({
          ...log,
          user: { email: 'Unknown' }
        })));
        return;
      }

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const logsWithUsers = logsData.map(log => ({
        ...log,
        user: profileMap.get(log.user_id) || { email: 'Unknown' }
      }));

      setActivityLog(logsWithUsers);
    } catch (err) {
      console.error('Error loading activity log:', err);
    }
  };

  const handleSaveChanges = async () => {
    if (!ticket) return;

    setSaving(true);
    setError('');

    try {
      const updates: any = {
        ticket_title: editTitle.trim(),
        message: editMessage.trim(),
        updated_at: new Date().toISOString(),
        last_modified_by: currentUserId
      };

      if (role === 'owner' || role === 'admin') {
        updates.category = editCategory;
        updates.status = editStatus;
      }

      const { error: updateError } = await supabase
        .from('tickets')
        .update(updates)
        .eq('id', ticketId);

      if (updateError) {
        setError(`Failed to update ticket: ${updateError.message}`);
      } else {
        await Promise.all([
          loadTicket(role!),
          loadActivityLog(role!)
        ]);
        setIsEditing(false);
      }
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNoteContent.trim() || !currentUserId) return;

    setSavingNote(true);
    try {
      const { error } = await supabase
        .from('ticket_notes')
        .insert({
          ticket_id: ticketId,
          user_id: currentUserId,
          note_type: role === 'client' ? 'client' : newNoteType,
          content: newNoteContent.trim()
        });

      if (error) {
        console.error('Error adding note:', error);
        alert('Failed to add note');
      } else {
        setNewNoteContent('');
        setShowAddNote(false);
        await loadNotes(role!);
      }
    } catch (err) {
      console.error('Error adding note:', err);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDelete = async () => {
    if (!ticket) return;

    setDeleting(true);
    try {
      const { error: deleteError } = await supabase
        .from('tickets')
        .delete()
        .eq('id', ticketId);

      if (deleteError) {
        setError(`Failed to delete ticket: ${deleteError.message}`);
        setDeleting(false);
        setShowDeleteModal(false);
      } else {
        window.location.href = `${baseUrl}/miraka-co-portal/tickets`;
      }
    } catch (err) {
      setError('Something went wrong');
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleCancelEdit = () => {
    if (ticket) {
      setEditTitle(ticket.ticket_title);
      setEditMessage(ticket.message);
      setEditCategory(ticket.category);
      setEditStatus(ticket.status);
    }
    setIsEditing(false);
    setError('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return { bg: '#DBEAFE', text: '#1E40AF', icon: AlertCircle };
      case 'in_progress': return { bg: '#FEF3C7', text: '#92400E', icon: Clock };
      case 'resolved': return { bg: '#D1FAE5', text: '#065F46', icon: CheckCircle };
      case 'closed': return { bg: '#E5E7EB', text: '#374151', icon: XCircle };
      default: return { bg: '#F3F4F6', text: '#6B7280', icon: AlertCircle };
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      general: 'Allgemein',
      change_request: 'Änderungsanfrage',
      help: 'Hilfe',
      support: 'Support',
      rating: 'Bewertung',
      other: 'Sonstiges'
    };
    return labels[category] || category;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('de-DE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `vor ${diffMins}m`;
    if (diffHours < 24) return `vor ${diffHours}h`;
    if (diffDays < 7) return `vor ${diffDays}T`;
    return formatDate(dateStr);
  };

  const getUserDisplayName = (user?: { full_name?: string; name?: string; email?: string }) => {
    if (!user) return 'Unbekannt';
    return user.full_name || user.name || user.email || 'Unbekannt';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      open: 'Offen',
      in_progress: 'In Bearbeitung',
      resolved: 'Gelöst',
      closed: 'Geschlossen'
    };
    return labels[status] || status;
  };

  const isAdmin = role === 'owner' || role === 'admin';
  const contentPadding = sidebarCollapsed ? '80px' : '260px';

  // ==========================================
  // RENDER: LOADING
  // ==========================================

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#F2F2F2'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #E5E7EB',
          borderTopColor: '#1A1A1A',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ==========================================
  // RENDER: ERROR (NO TICKET)
  // ==========================================

  if (error && !ticket) {
    return (
      <>
        <MirakaSidebar role={role} currentPath="/miraka-co-portal/tickets" />
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F2F2F2',
          paddingLeft: isMobile ? '0' : contentPadding,
          padding: '20px',
          transition: 'padding-left 0.3s ease'
        }}>
          <AlertCircle size={48} color="#D1D5DB" strokeWidth={1.5} style={{ marginBottom: '16px' }} />
          <span style={{ 
            fontSize: '15px', 
            color: '#6B7280', 
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            {error}
          </span>
          <a
            href={`${baseUrl}/miraka-co-portal/tickets`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: '#1A1A1A',
              color: '#FFFFFF',
              textDecoration: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 600
            }}
          >
            <ArrowLeft size={18} />
            Zurück zu Tickets
          </a>
        </div>
      </>
    );
  }

  if (!ticket) return null;

  const statusColors = getStatusColor(ticket.status);
  const StatusIcon = statusColors.icon;

  // ==========================================
  // RENDER: TICKET DETAIL
  // ==========================================

  return (
    <>
      <MirakaSidebar role={role} currentPath="/miraka-co-portal/tickets" />
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 10000,
              backdropFilter: 'blur(4px)'
            }}
            onClick={() => !deleting && setShowDeleteModal(false)}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#FFFFFF',
              borderRadius: '18px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              zIndex: 10001,
              width: '90%',
              maxWidth: '420px',
              padding: '28px'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                margin: '0 auto 16px',
                background: '#FEF2F2',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AlertTriangle size={28} color="#DC2626" strokeWidth={2} />
              </div>
              <h2 style={{
                fontSize: '18px',
                fontWeight: 700,
                color: '#1A1A1A',
                marginBottom: '8px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
              }}>
                Ticket löschen?
              </h2>
              <p style={{
                fontSize: '14px',
                color: '#6B7280',
                lineHeight: 1.6,
                margin: 0
              }}>
                Diese Aktion kann nicht rückgängig gemacht werden. Das Ticket und alle Notizen werden dauerhaft gelöscht.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: '#F7F7F7',
                  border: '1px solid #E5E7EB',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#1A1A1A',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.5 : 1
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: deleting ? '#FCA5A5' : '#DC2626',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.6 : 1
                }}
              >
                {deleting ? 'Wird gelöscht...' : 'Endgültig löschen'}
              </button>
            </div>
          </div>
        </>
      )}

      <div style={{
        minHeight: '100vh',
        background: '#F2F2F2',
        paddingLeft: isMobile ? '0' : contentPadding,
        paddingBottom: isMobile ? '120px' : '40px',
        transition: 'padding-left 0.3s ease',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
      }}>
        <div style={{ padding: '0' }} className="ticket-detail-container">
          {/* Modern Header Card */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '14px',
            padding: '24px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            marginBottom: '32px'
          }}>
            {/* Back Button + Edit Button Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <a
                href={`${baseUrl}/miraka-co-portal/tickets`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  background: '#F7F7F7',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#1A1A1A',
                  border: '1px solid #E5E7EB',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#EBEBEB'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#F7F7F7'}
              >
                <ArrowLeft size={18} strokeWidth={2.5} />
                {!isMobile && 'Zurück'}
              </a>

              {!isEditing ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setIsEditing(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      background: '#1A1A1A',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#2A2A2A'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#1A1A1A'}
                  >
                    <Edit size={16} strokeWidth={2.5} />
                    {!isMobile && 'Bearbeiten'}
                  </button>
                  
                  {isAdmin && (
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        background: '#DC2626',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#B91C1C'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#DC2626'}
                    >
                      <Trash2 size={16} strokeWidth={2.5} />
                      {!isMobile && 'Löschen'}
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleCancelEdit}
                    disabled={saving}
                    style={{
                      padding: '8px 14px',
                      background: '#F7F7F7',
                      border: '1px solid #E5E7EB',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1A1A1A',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.5 : 1
                    }}
                  >
                    <X size={16} />
                  </button>
                  <button
                    onClick={handleSaveChanges}
                    disabled={saving}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      background: saving ? '#9CA3AF' : '#1A1A1A',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#FFFFFF',
                      cursor: saving ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Save size={16} strokeWidth={2.5} />
                    {saving ? 'Speichern...' : 'Speichern'}
                  </button>
                </div>
              )}
            </div>

            {/* Title */}
            {!isEditing ? (
              <h1 style={{
                fontSize: isMobile ? '22px' : '26px',
                fontWeight: 700,
                color: '#1A1A1A',
                margin: '0 0 12px 0',
                lineHeight: '1.3',
                letterSpacing: '-0.02em'
              }}>
                {ticket.ticket_title}
              </h1>
            ) : (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                style={{
                  fontSize: isMobile ? '22px' : '26px',
                  fontWeight: 700,
                  color: '#1A1A1A',
                  margin: '0 0 12px 0',
                  lineHeight: '1.3',
                  letterSpacing: '-0.02em',
                  border: '1px solid #E5E7EB',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  width: '100%',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
            )}

            {/* Meta Row */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              fontSize: '13px', 
              color: '#6B7280',
              marginBottom: '14px',
              flexWrap: 'wrap'
            }}>
              <Calendar size={14} />
              <span style={{ fontWeight: 500 }}>{formatDate(ticket.created_at)}</span>
              {ticket.updated_at !== ticket.created_at && (
                <>
                  <span style={{ color: '#D1D5DB' }}>•</span>
                  <Clock size={14} />
                  <span style={{ fontWeight: 500 }}>Aktualisiert {formatRelativeTime(ticket.updated_at)}</span>
                </>
              )}
            </div>

            {/* Status & Category Pills */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {!isEditing || role === 'client' ? (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  background: statusColors.bg,
                  borderRadius: '12px',
                  border: 'none'
                }}>
                  <StatusIcon size={15} color={statusColors.text} strokeWidth={2.5} />
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: statusColors.text
                  }}>
                    {getStatusLabel(ticket.status)}
                  </span>
                </div>
              ) : (
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  style={{
                    padding: '8px 14px',
                    fontSize: '13px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '12px',
                    background: '#FFFFFF',
                    color: '#1A1A1A',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  <option value="open">Offen</option>
                  <option value="in_progress">In Bearbeitung</option>
                  <option value="resolved">Gelöst</option>
                  <option value="closed">Geschlossen</option>
                </select>
              )}

              {!isEditing || role === 'client' ? (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  background: '#F7F7F7',
                  border: '1px solid #E5E7EB',
                  borderRadius: '12px'
                }}>
                  <Tag size={15} color="#6B7280" strokeWidth={2.5} />
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#6B7280'
                  }}>
                    {getCategoryLabel(ticket.category)}
                  </span>
                </div>
              ) : (
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as any)}
                  style={{
                    padding: '8px 14px',
                    fontSize: '13px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '12px',
                    background: '#FFFFFF',
                    color: '#1A1A1A',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  <option value="general">Allgemein</option>
                  <option value="change_request">Änderungsanfrage</option>
                  <option value="help">Hilfe</option>
                  <option value="support">Support</option>
                  <option value="rating">Bewertung</option>
                  <option value="other">Sonstiges</option>
                </select>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              padding: '14px 18px',
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: '12px',
              color: '#991B1B',
              fontSize: '14px',
              fontWeight: 500,
              marginBottom: '20px'
            }}>
              {error}
            </div>
          )}

          {/* Description Card */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '18px',
            padding: isMobile ? '22px' : '28px',
            marginBottom: isMobile ? '16px' : '20px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
          }}>
            <h2 style={{
              fontSize: '15px',
              fontWeight: 700,
              color: '#1A1A1A',
              marginBottom: '14px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Beschreibung
            </h2>
            
            {!isEditing ? (
              <p style={{
                fontSize: '15px',
                lineHeight: '1.7',
                color: '#1A1A1A',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {ticket.message}
              </p>
            ) : (
              <textarea
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                rows={10}
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '15px',
                  lineHeight: '1.7',
                  color: '#1A1A1A',
                  border: '1px solid #E5E7EB',
                  borderRadius: '12px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box'
                }}
              />
            )}
          </div>

          {/* Notes Card */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '18px',
            padding: isMobile ? '22px' : '28px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '18px',
              gap: '12px'
            }}>
              <h2 style={{
                fontSize: '15px',
                fontWeight: 700,
                color: '#1A1A1A',
                margin: 0,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Notizen
              </h2>
              
              {!showAddNote && (
                <button
                  onClick={() => {
                    setShowAddNote(true);
                    setNewNoteType(role === 'client' ? 'client' : 'staff');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    background: '#1A1A1A',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#2A2A2A'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#1A1A1A'}
                >
                  <Plus size={14} strokeWidth={2.5} />
                  Hinzufügen
                </button>
              )}
            </div>

            {/* Add Note Form */}
            {showAddNote && (
              <div style={{
                padding: isMobile ? '18px' : '20px',
                background: '#F7F7F7',
                borderRadius: '12px',
                marginBottom: '18px'
              }}>
                {isAdmin && (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          value="staff"
                          checked={newNoteType === 'staff'}
                          onChange={(e) => setNewNoteType(e.target.value as 'staff')}
                        />
                        <Lock size={14} />
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>Nur Mitarbeiter</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          value="client"
                          checked={newNoteType === 'client'}
                          onChange={(e) => setNewNoteType(e.target.value as 'client')}
                        />
                        <Users size={14} />
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>Für Kunde sichtbar</span>
                      </label>
                    </div>
                  </div>
                )}

                <textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Notiz hinzufügen..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '14px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '12px',
                    marginBottom: '12px',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                />

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleAddNote}
                    disabled={savingNote || !newNoteContent.trim()}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: savingNote || !newNoteContent.trim() ? '#9CA3AF' : '#1A1A1A',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: savingNote || !newNoteContent.trim() ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {savingNote ? 'Wird gespeichert...' : 'Speichern'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddNote(false);
                      setNewNoteContent('');
                    }}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: '#F7F7F7',
                      color: '#1A1A1A',
                      border: '1px solid #E5E7EB',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {/* Notes List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {notes.filter(note => isAdmin || note.note_type === 'client').length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '32px 20px',
                  color: '#9CA3AF'
                }}>
                  <MessageSquare size={32} color="#D1D5DB" style={{ margin: '0 auto 12px' }} />
                  <p style={{ 
                    fontSize: '14px', 
                    fontWeight: 500, 
                    margin: 0,
                    marginBottom: '4px'
                  }}>
                    Noch keine Notizen
                  </p>
                  <p style={{ fontSize: '13px', margin: 0, color: '#D1D5DB' }}>
                    Fügen Sie eine Notiz hinzu, um anzufangen
                  </p>
                </div>
              ) : (
                notes
                  .filter(note => isAdmin || note.note_type === 'client')
                  .map((note) => (
                    <div
                      key={note.id}
                      style={{
                        padding: isMobile ? '16px' : '18px',
                        background: note.note_type === 'staff' ? '#FEF3C7' : '#DBEAFE',
                        border: `1px solid ${note.note_type === 'staff' ? '#FDE68A' : '#BFDBFE'}`,
                        borderRadius: '12px'
                      }}
                    >
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        marginBottom: '10px', 
                        flexWrap: 'wrap',
                        fontSize: '12px'
                      }}>
                        {note.note_type === 'staff' ? (
                          <Lock size={13} color="#92400E" strokeWidth={2.5} />
                        ) : (
                          <Users size={13} color="#1E40AF" strokeWidth={2.5} />
                        )}
                        <span style={{ 
                          fontWeight: 700,
                          color: note.note_type === 'staff' ? '#92400E' : '#1E40AF',
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px'
                        }}>
                          {note.note_type === 'staff' ? 'Mitarbeiter' : 'Kunde'}
                        </span>
                        <span style={{ color: '#D1D5DB' }}>•</span>
                        <span style={{ fontWeight: 500, color: '#6B7280' }}>
                          {getUserDisplayName(note.user)}
                        </span>
                        <span style={{ color: '#D1D5DB' }}>•</span>
                        <span style={{ fontWeight: 500, color: '#9CA3AF' }}>
                          {formatRelativeTime(note.created_at)}
                        </span>
                      </div>
                      <p style={{
                        fontSize: '15px',
                        lineHeight: '1.6',
                        color: '#1A1A1A',
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}>
                        {note.content}
                      </p>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Activity Log - Admin Only */}
          {isAdmin && activityLog.length > 0 && (
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '18px',
              padding: isMobile ? '22px' : '28px',
              marginTop: isMobile ? '16px' : '20px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                <History size={16} color="#1A1A1A" strokeWidth={2.5} />
                <h2 style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#1A1A1A',
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Aktivitätsprotokoll
                </h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {activityLog.map((log, index) => (
                  <div
                    key={log.id}
                    style={{
                      paddingBottom: index < activityLog.length - 1 ? '14px' : '0',
                      borderBottom: index < activityLog.length - 1 ? '1px solid #F3F4F6' : 'none'
                    }}
                  >
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1A1A1A',
                      marginBottom: '6px'
                    }}>
                      {log.description}
                    </div>
                    <div style={{ 
                      fontSize: '13px', 
                      color: '#6B7280',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexWrap: 'wrap'
                    }}>
                      <span style={{ fontWeight: 600 }}>{getUserDisplayName(log.user)}</span>
                      <span style={{ color: '#D1D5DB' }}>•</span>
                      <span style={{ fontWeight: 500, color: '#9CA3AF' }}>
                        {formatRelativeTime(log.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .ticket-detail-container {
            padding: 5px !important;
          }
          
          .ticket-detail-container > div {
            margin-bottom: 16px !important;
          }
          
          .ticket-detail-container h1 {
            font-size: 22px !important;
          }
          
          .ticket-detail-container button,
          .ticket-detail-container a {
            font-size: 13px !important;
            padding: 8px 12px !important;
          }
        }
      `}</style>
    </>
  );
}






