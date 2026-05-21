/**
 * Tickets Page - Apple Style UI
 * Full CRUD for support tickets with role-based access
 * Supabase integration for real-time ticket management
 * 
 * UPDATED: Fixed client ticket loading - now queries clients table by user_id
 * UPDATED: Fixed ticket creation - now uses authenticated Supabase client
 * ADDED: Client selection for admin/owner roles
 * ADDED: Auto-close modal after ticket creation
 * ADDED: Click to navigate to ticket detail page
 * VERSION: 3.0 (2026-01-04) - AUTHENTICATION FIX COMPLETE
 */

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import { AlertCircle, CheckCircle2, Clock, Filter, Plus, Search, X, ChevronRight, MessageSquare } from 'lucide-react';

interface Ticket {
  id: string;
  client_id: string;
  project_id?: string;
  ticket_title: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  category: 'general' | 'change_request' | 'help' | 'support' | 'rating' | 'other';
  created_at: string;
  updated_at: string;
  client?: {
    company_name: string;
  };
}

interface Client {
  id: string;
  company_name: string;
  client_name: string;
}

type UserRole = 'owner' | 'admin' | 'client';

export default function TicketsPage() {
  // ==========================================
  // STATE
  // ==========================================

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [userClientId, setUserClientId] = useState<string | null>(null);

  // Form state
  const [ticketTitle, setTicketTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<'general' | 'change_request' | 'help' | 'support' | 'rating' | 'other'>('general');
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // ==========================================
  // LOAD DATA
  // ==========================================

  useEffect(() => {
    initializePage();
  }, []);


  // Add responsive styles for stats cards
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 640px) {
        .stats-cards-grid {
          grid-template-columns: 1fr !important;
        }
      }
    `;
    if (!document.querySelector('style[data-tickets-responsive]')) {
      style.setAttribute('data-tickets-responsive', 'true');
      document.head.appendChild(style);
    }
  }, []);


  const initializePage = async () => {
    console.log('🎫 TicketsPage v3.0 initializing...');
    
    try {
      // Get user and role first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = `${baseUrl}/miraka-co-portal`;
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile) {
        const userRole = profile.role as UserRole;
        setRole(userRole);
        console.log('🎫 User role detected:', userRole);

        // If client, get their client_id from clients table
        if (userRole === 'client') {
          console.log('🎫 Looking up client_id for user:', user.id);
          const { data: clientData } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', user.id)
            .single();

          if (clientData?.id) {
            console.log('✅ Found client_id:', clientData.id);
            setUserClientId(clientData.id);
          } else {
            console.warn('⚠️ No client record found for this user');
          }
        }

        // Load clients if admin or owner
        if (userRole === 'owner' || userRole === 'admin') {
          console.log('🎫 Loading clients for', userRole);
          await loadClients();
        }
      }

      // Load tickets
      await loadTickets();
    } catch (err) {
      console.error('❌ Error initializing page:', err);
      setError('Failed to initialize');
      setLoading(false);
    }
  };

  const loadTickets = async () => {
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = `${baseUrl}/miraka-co-portal`;
        return;
      }

      let query = supabase
        .from('tickets')
        .select(`
          *,
          client:clients(company_name)
        `)
        .order('created_at', { ascending: false });

      // Role-based filtering - FIXED FOR CLIENTS
      if (role === 'client') {
        // Get client_id from clients table by user_id
        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (clientData?.id) {
          console.log('🎫 Filtering tickets for client_id:', clientData.id);
          query = query.eq('client_id', clientData.id);
        } else {
          console.warn('⚠️ No client_id found - no tickets will be shown');
          setTickets([]);
          setLoading(false);
          return;
        }
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('❌ Error loading tickets:', fetchError);
        setError('Failed to load tickets');
        setTickets([]);
      } else {
        console.log(`✅ Loaded ${data?.length || 0} tickets`);
        setTickets(data || []);
      }
    } catch (err) {
      console.error('❌ Unexpected error:', err);
      setError('Something went wrong');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      console.log('🎫 Fetching clients from database...');
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name, client_name')
        .eq('status', 'active')
        .order('company_name', { ascending: true });

      if (error) {
        console.error('❌ Error loading clients:', error);
      } else {
        console.log(`✅ Loaded ${data?.length || 0} clients for dropdown`);
        setClients(data || []);
      }
    } catch (err) {
      console.error('❌ Unexpected error loading clients:', err);
    }
  };

  // ==========================================
  // TICKET CRUD
  // ==========================================

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎫 TICKET CREATION STARTED (v3.0)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 Form Data:');
    console.log('   - Title:', ticketTitle);
    console.log('   - Message:', message.substring(0, 50) + '...');
    console.log('   - Category:', category);
    console.log('👤 User Context:');
    console.log('   - Role:', role);
    console.log('   - Selected Client ID:', selectedClientId || 'none');
    console.log('   - User Client ID:', userClientId || 'none');

    try {
      // Step 1: Get session and create authenticated client
      console.log('🔐 Step 1: Getting session and creating authenticated client...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('❌ Session error:', sessionError);
        setError('Authentication failed. Please log in again.');
        setSubmitting(false);
        return;
      }
      
      console.log('✅ Session retrieved');
      console.log('   - User ID:', session.user.id);
      console.log('   - Email:', session.user.email);

      // Create authenticated Supabase client with user's JWT token
      const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        console.error('❌ Supabase configuration missing');
        setError('Configuration error. Please contact support.');
        setSubmitting(false);
        return;
      }

      const authenticatedClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }
      });

      console.log('✅ Authenticated Supabase client created');

      // Step 2: Determine client_id based on role
      let clientId = selectedClientId;

      if (role === 'client') {
        console.log('🔍 Step 2: Client role detected - fetching client_id...');
        console.log('   - Querying clients table for user_id:', session.user.id);
        
        const { data: clientData, error: clientError } = await authenticatedClient
          .from('clients')
          .select('id, company_name')
          .eq('user_id', session.user.id)
          .single();

        console.log('📊 Client query result:', {
          data: clientData,
          error: clientError
        });

        if (clientError) {
          console.error('❌ Error fetching client:', clientError);
          setError(`Database error: ${clientError.message}`);
          setSubmitting(false);
          return;
        }

        if (!clientData?.id) {
          console.error('❌ No client_id found for user');
          setError('Your account is not linked to a client. Please contact support.');
          setSubmitting(false);
          return;
        }
        
        clientId = clientData.id;
        console.log('✅ Client record found:');
        console.log('   - Client ID:', clientId);
        console.log('   - Company:', clientData.company_name);
      } else {
        // Admin/Owner must select a client
        console.log('🔍 Step 2: Admin/Owner role - using selected client...');
        if (!clientId) {
          console.error('❌ No client selected by admin/owner');
          setError('Please select a client');
          setSubmitting(false);
          return;
        }
        console.log('✅ Using selected client_id:', clientId);
      }

      // Step 3: Insert ticket with authenticated client
      console.log('💾 Step 3: Inserting ticket with authenticated client...');
      const ticketData = {
        client_id: clientId,
        ticket_title: ticketTitle.trim(),
        message: message.trim(),
        category,
        status: 'open' as const
      };
      
      console.log('📦 Ticket data to insert:', ticketData);

      const { data: insertedTicket, error: insertError } = await authenticatedClient
        .from('tickets')
        .insert(ticketData)
        .select()
        .single();

      console.log('📊 Insert result:', {
        data: insertedTicket,
        error: insertError
      });

      if (insertError) {
        console.error('❌ Insert error:', insertError);
        console.log('📋 Error details:');
        console.log('   - Code:', insertError.code);
        console.log('   - Message:', insertError.message);
        console.log('   - Details:', insertError.details);
        console.log('   - Hint:', insertError.hint);
        
        setError(`Failed to create ticket: ${insertError.message}`);
        setSubmitting(false);
        return;
      }

      if (!insertedTicket) {
        console.error('❌ Insert returned NULL');
        setError('Ticket creation failed. Please try again.');
        setSubmitting(false);
        return;
      }

      console.log('✅ Ticket created successfully!');
      console.log('   - Ticket ID:', insertedTicket.id);
      console.log('   - Title:', insertedTicket.ticket_title);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎉 TICKET CREATION COMPLETE');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Success! Close modal, reset form, and refresh
      setShowCreateModal(false);
      resetForm();
      await loadTickets();
      setSubmitting(false);
    } catch (err) {
      console.error('❌ Unexpected error:', err);
      console.log('📋 Error object:', JSON.stringify(err, null, 2));
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  const handleTicketClick = (ticketId: string) => {
    // Navigate to ticket detail page
    window.location.href = `${baseUrl}/miraka-co-portal/tickets/${ticketId}`;
  };

  // ==========================================
  // HELPERS
  // ==========================================

  const resetForm = () => {
    setTicketTitle('');
    setMessage('');
    setCategory('general');
    setSelectedClientId('');
    setError('');
    console.log('🎫 Form reset complete');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <AlertCircle size={16} color="#6B7280" />;
      case 'in_progress':
        return <Clock size={16} color="#6B7280" />;
      case 'resolved':
        return <CheckCircle2 size={16} color="#6B7280" />;
      case 'closed':
        return <CheckCircle2 size={16} color="#9CA3AF" />;
      default:
        return <MessageSquare size={16} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' };
      case 'in_progress':
        return { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' };
      case 'resolved':
        return { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' };
      case 'closed':
        return { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' };
      default:
        return { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' };
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      general: 'General',
      change_request: 'Change Request',
      help: 'Help',
      support: 'Support',
      rating: 'Rating',
      other: 'Other'
    };
    return labels[category] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      general: '#6B7280',
      change_request: '#1A1A1A',
      help: '#6B7280',
      support: '#1A1A1A',
      rating: '#9CA3AF',
      other: '#9CA3AF'
    };
    return colors[category] || '#6B7280';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredTickets = tickets.filter((ticket) => {
    if (filterStatus !== 'all' && ticket.status !== filterStatus) return false;
    if (filterCategory !== 'all' && ticket.category !== filterCategory) return false;
    return true;
  });

  // ==========================================
  // STATS
  // ==========================================

  const stats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === 'open').length,
    inProgress: tickets.filter((t) => t.status === 'in_progress').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length
  };

  // ==========================================
  // RENDER
  // ==========================================

  if (loading) {
    return null;
  }

  return (
    <div style={{ padding: '32px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px'
        }}>
          <div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: 600,
              color: '#1A1A1A',
              margin: '0 0 4px 0',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
              letterSpacing: '-0.02em'
            }}>
              Support Tickets
            </h1>
            <p style={{
              fontSize: '15px',
              color: '#6B7280',
              margin: 0,
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
            }}>
              {role === 'client' ? 'View and manage your support requests' : 'Manage client support tickets'}
            </p>
          </div>

          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center'
          }}>
            <button
              onClick={() => {
                console.log('🎫 Opening create ticket modal');
                console.log('🎫 Current role:', role);
                console.log('🎫 Available clients:', clients.length);
                setShowCreateModal(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: '#1A1A1A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.2s ease',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#2A2A2A'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#1A1A1A'}
            >
              <Plus size={18} strokeWidth={2} />
              <span>New Ticket</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px'
        }}
        className="stats-cards-grid">
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '14px',
            padding: '20px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            transition: 'box-shadow 0.2s ease'
          }}>
            <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '8px', fontWeight: 500, letterSpacing: '0.3px' }}>
              Total Tickets
            </div>
            <div style={{ fontSize: '36px', fontWeight: 600, color: '#1A1A1A', lineHeight: 1, marginBottom: '4px' }}>
              {stats.total}
            </div>
            <div style={{ fontSize: '13px', color: '#9CA3AF' }}>
              All requests
            </div>
          </div>

          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '14px',
            padding: '20px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            transition: 'box-shadow 0.2s ease'
          }}>
            <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '8px', fontWeight: 500, letterSpacing: '0.3px' }}>
              Open
            </div>
            <div style={{ fontSize: '36px', fontWeight: 600, color: '#1A1A1A', lineHeight: 1, marginBottom: '4px' }}>
              {stats.open}
            </div>
            <div style={{ fontSize: '13px', color: '#9CA3AF' }}>
              Awaiting response
            </div>
          </div>

          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '14px',
            padding: '20px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            transition: 'box-shadow 0.2s ease'
          }}>
            <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '8px', fontWeight: 500, letterSpacing: '0.3px' }}>
              In Progress
            </div>
            <div style={{ fontSize: '36px', fontWeight: 600, color: '#1A1A1A', lineHeight: 1, marginBottom: '4px' }}>
              {stats.inProgress}
            </div>
            <div style={{ fontSize: '13px', color: '#9CA3AF' }}>
              Being worked on
            </div>
          </div>

          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '14px',
            padding: '20px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            transition: 'box-shadow 0.2s ease'
          }}>
            <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '8px', fontWeight: 500, letterSpacing: '0.3px' }}>
              Resolved
            </div>
            <div style={{ fontSize: '36px', fontWeight: 600, color: '#1A1A1A', lineHeight: 1, marginBottom: '4px' }}>
              {stats.resolved}
            </div>
            <div style={{ fontSize: '13px', color: '#9CA3AF' }}>
              Completed
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px'
      }}>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid #E5E7EB',
            background: '#FFFFFF',
            fontSize: '14px',
            color: '#1A1A1A',
            cursor: 'pointer',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
          }}
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid #E5E7EB',
            background: '#FFFFFF',
            fontSize: '14px',
            color: '#1A1A1A',
            cursor: 'pointer',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
          }}
        >
          <option value="all">All Categories</option>
          <option value="general">General</option>
          <option value="change_request">Change Request</option>
          <option value="help">Help</option>
          <option value="support">Support</option>
          <option value="rating">Rating</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '14px 18px',
          background: '#FEF2F2',
          border: '1px solid #FCA5A5',
          borderRadius: '10px',
          color: '#991B1B',
          fontSize: '14px',
          marginBottom: '24px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
        }}>
          {error}
        </div>
      )}

      {/* Tickets List */}
      {filteredTickets.length === 0 ? (
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '14px',
          padding: '80px 20px',
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
            <MessageSquare size={32} color="#9CA3AF" strokeWidth={1.5} />
          </div>
          <h3 style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#1A1A1A',
            marginBottom: '8px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
          }}>
            No tickets found
          </h3>
          <p style={{
            fontSize: '14px',
            color: '#6B7280',
            marginBottom: '24px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
          }}>
            Create your first support ticket to get started
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '10px 20px',
              background: '#1A1A1A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
            }}
          >
            Create Ticket
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gap: '16px'
        }}>
          {filteredTickets.map((ticket) => {
            const statusColors = getStatusColor(ticket.status);
            
            return (
              <div
                key={ticket.id}
                style={{
                  background: '#FFFFFF',
                  padding: '24px',
                  borderRadius: '14px',
                  border: '1px solid #E5E7EB',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#9CA3AF';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                onClick={() => handleTicketClick(ticket.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <h3 style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        color: '#1A1A1A',
                        margin: 0,
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                      }}>
                        {ticket.ticket_title}
                      </h3>

                      <div style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 500,
                        background: '#F3F4F6',
                        color: getCategoryColor(ticket.category)
                      }}>
                        {getCategoryLabel(ticket.category)}
                      </div>
                    </div>

                    <p style={{
                      fontSize: '14px',
                      color: '#6B7280',
                      marginBottom: '12px',
                      lineHeight: 1.6,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                    }}>
                      {ticket.message.length > 150 ? ticket.message.substring(0, 150) + '...' : ticket.message}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {/* Status Badge */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        background: statusColors.bg,
                        border: `1px solid ${statusColors.border}`
                      }}>
                        {getStatusIcon(ticket.status)}
                        <span style={{
                          fontSize: '13px',
                          color: statusColors.text,
                          textTransform: 'capitalize',
                          fontWeight: 500,
                          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                        }}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </div>

                      <span style={{
                        fontSize: '13px',
                        color: '#9CA3AF',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                      }}>
                        {formatDate(ticket.created_at)}
                      </span>

                      {role !== 'client' && ticket.client && (
                        <span style={{
                          fontSize: '13px',
                          color: '#6B7280',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                        }}>
                          {ticket.client.company_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Chevron Icon */}
                  <div style={{ 
                    marginLeft: '20px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <ChevronRight size={20} color="#9CA3AF" strokeWidth={2} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 9998,
              backdropFilter: 'blur(2px)'
            }}
            onClick={() => {
              if (!submitting) {
                console.log('🎫 Modal backdrop clicked - closing');
                setShowCreateModal(false);
                resetForm();
              }
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#FFFFFF',
              borderRadius: '14px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              zIndex: 9999,
              width: '90%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleCreateTicket}>
              <div style={{
                padding: '24px 28px',
                borderBottom: '1px solid #E5E7EB',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                background: '#FFFFFF',
                zIndex: 1,
                borderTopLeftRadius: '14px',
                borderTopRightRadius: '14px'
              }}>
                <h2 style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 600,
                  color: '#1A1A1A',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                }}>
                  Create New Ticket
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    console.log('🎫 Close button clicked');
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  disabled={submitting}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    padding: '4px',
                    color: '#6B7280',
                    opacity: submitting ? 0.5 : 1
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Client Selection (Admin/Owner Only) */}
                {(role === 'owner' || role === 'admin') && (
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#1A1A1A',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                    }}>
                      Client <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <select
                      value={selectedClientId}
                      onChange={(e) => {
                        console.log('🎫 Client selected:', e.target.value);
                        setSelectedClientId(e.target.value);
                      }}
                      required
                      disabled={submitting}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        fontSize: '14px',
                        border: '1px solid #E5E7EB',
                        borderRadius: '10px',
                        outline: 'none',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
                        background: '#FFFFFF',
                        opacity: submitting ? 0.6 : 1
                      }}
                    >
                      <option value="">Select a client</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.company_name} {client.client_name && `(${client.client_name})`}
                        </option>
                      ))}
                    </select>
                    {clients.length === 0 && (
                      <p style={{
                        fontSize: '12px',
                        color: '#DC2626',
                        marginTop: '6px',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                      }}>
                        No active clients found. Please create a client first.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                  }}>
                    Subject
                  </label>
                  <input
                    type="text"
                    value={ticketTitle}
                    onChange={(e) => setTicketTitle(e.target.value)}
                    placeholder="Brief description of your issue"
                    required
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '14px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      outline: 'none',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
                      opacity: submitting ? 0.6 : 1
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                  }}>
                    Message
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide detailed information about your issue"
                    required
                    disabled={submitting}
                    rows={5}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '14px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
                      opacity: submitting ? 0.6 : 1
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                  }}>
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '14px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      outline: 'none',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
                      opacity: submitting ? 0.6 : 1
                    }}
                  >
                    <option value="general">General</option>
                    <option value="change_request">Change Request</option>
                    <option value="help">Help</option>
                    <option value="support">Support</option>
                    <option value="rating">Rating</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{
                padding: '20px 28px',
                borderTop: '1px solid #E5E7EB',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                position: 'sticky',
                bottom: 0,
                background: '#FFFFFF',
                borderBottomLeftRadius: '14px',
                borderBottomRightRadius: '14px'
              }}>
                <button
                  type="button"
                  onClick={() => {
                    console.log('🎫 Cancel button clicked');
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  disabled={submitting}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 500,
                    border: '1px solid #E5E7EB',
                    borderRadius: '10px',
                    background: '#FFFFFF',
                    color: '#1A1A1A',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.5 : 1,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 500,
                    border: 'none',
                    borderRadius: '10px',
                    background: submitting ? '#9CA3AF' : '#1A1A1A',
                    color: '#FFFFFF',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                  }}
                >
                  {submitting ? 'Creating...' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

    </div>
  );
}











