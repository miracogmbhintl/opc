/**
 * Tickets Page - Translated Version
 * Supports German and English translations
 * Projects-style card layout
 */

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import { useTranslation } from '../lib/TranslationContext';
import { AlertCircle, CheckCircle2, Clock, Plus, X, ChevronRight, MessageSquare, Search } from 'lucide-react';
import MobileProjectCard from './shared/MobileProjectCard';
import MobileActionButton from './shared/MobileActionButton';

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

export default function TicketsPageTranslated() {
  const { language, t } = useTranslation();

  // Helper function for inline translations
  const tr = (deText: string, enText: string): string => {
    return language === 'de' ? deText : enText;
  };

  // STATE
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [userClientId, setUserClientId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Form state
  const [ticketTitle, setTicketTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<'general' | 'change_request' | 'help' | 'support' | 'rating' | 'other'>('general');
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    initializePage();
  }, []);

  const initializePage = async () => {
    try {
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

        if (userRole === 'client') {
          const { data: clientData } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', user.id)
            .single();

          if (clientData?.id) {
            setUserClientId(clientData.id);
          }
        }

        if (userRole === 'owner' || userRole === 'admin') {
          await loadClients();
        }
      }

      await loadTickets();
    } catch (err) {
      console.error('Error initializing page:', err);
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

      if (role === 'client') {
        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (clientData?.id) {
          query = query.eq('client_id', clientData.id);
        } else {
          setTickets([]);
          setLoading(false);
          return;
        }
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError('Failed to load tickets');
        setTickets([]);
      } else {
        setTickets(data || []);
      }
    } catch (err) {
      setError('Something went wrong');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name, client_name')
        .eq('status', 'active')
        .order('company_name', { ascending: true });

      if (!error && data) {
        setClients(data);
      }
    } catch (err) {
      console.error('Error loading clients:', err);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        setError(tr('Authentifizierung fehlgeschlagen', 'Authentication failed'));
        setSubmitting(false);
        return;
      }

      const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        setError(tr('Konfigurationsfehler', 'Configuration error'));
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

      let clientId = selectedClientId;

      if (role === 'client') {
        const { data: clientData, error: clientError } = await authenticatedClient
          .from('clients')
          .select('id, company_name')
          .eq('user_id', session.user.id)
          .single();

        if (clientError || !clientData?.id) {
          setError(tr('Ihr Konto ist nicht mit einem Client verknüpft', 'Your account is not linked to a client'));
          setSubmitting(false);
          return;
        }
        
        clientId = clientData.id;
      } else {
        if (!clientId) {
          setError(tr('Bitte wählen Sie einen Client aus', 'Please select a client'));
          setSubmitting(false);
          return;
        }
      }

      const ticketData = {
        client_id: clientId,
        ticket_title: ticketTitle.trim(),
        message: message.trim(),
        category,
        status: 'open' as const
      };

      const { data: insertedTicket, error: insertError } = await authenticatedClient
        .from('tickets')
        .insert(ticketData)
        .select()
        .single();

      if (insertError || !insertedTicket) {
        setError(tr('Ticket konnte nicht erstellt werden', 'Failed to create ticket'));
        setSubmitting(false);
        return;
      }

      setShowCreateModal(false);
      resetForm();
      await loadTickets();
      setSubmitting(false);
    } catch (err) {
      setError(tr('Etwas ist schief gelaufen', 'Something went wrong'));
      setSubmitting(false);
    }
  };

  const handleTicketClick = (ticketId: string) => {
    window.location.href = `${baseUrl}/miraka-co-portal/tickets/${ticketId}`;
  };

  const resetForm = () => {
    setTicketTitle('');
    setMessage('');
    setCategory('general');
    setSelectedClientId('');
    setError('');
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

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, { de: string; en: string }> = {
      general: { de: 'Allgemein', en: 'General' },
      change_request: { de: 'Änderungswunsch', en: 'Change Request' },
      help: { de: 'Hilfe', en: 'Help' },
      support: { de: 'Support', en: 'Support' },
      rating: { de: 'Bewertung', en: 'Rating' },
      other: { de: 'Sonstiges', en: 'Other' }
    };
    return language === 'de' ? labels[cat]?.de || cat : labels[cat]?.en || cat;
  };

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      general: '#6B7280',
      change_request: '#1A1A1A',
      help: '#6B7280',
      support: '#1A1A1A',
      rating: '#9CA3AF',
      other: '#9CA3AF'
    };
    return colors[cat] || '#6B7280';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ${tr('her', 'ago')}`;
    if (diffHours < 24) return `${diffHours}h ${tr('her', 'ago')}`;
    if (diffDays < 7) return `${diffDays}d ${tr('her', 'ago')}`;
    return date.toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US');
  };

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch = 
      ticket.ticket_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.client?.company_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterStatus !== 'all' && ticket.status !== filterStatus) return false;
    if (filterCategory !== 'all' && ticket.category !== filterCategory) return false;

    return matchesSearch;
  });

  if (loading) {
    return null;
  }

  return (
    <div style={{
      width: '100%',
      padding: isMobile ? '20px' : '32px',
      boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
    }}>
      {/* Action Row - Unified Button System */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '16px',
        width: '100%',
        marginBottom: searchOpen ? '20px' : '24px'
      }}>
        <MobileActionButton
          icon={<Plus size={20} strokeWidth={2} />}
          onClick={() => setShowCreateModal(true)}
          ariaLabel={tr('Neues Ticket', 'New Ticket')}
        />

        <MobileActionButton
          icon={searchOpen ? <X size={20} strokeWidth={2} /> : <Search size={20} strokeWidth={2} />}
          onClick={() => setSearchOpen(!searchOpen)}
          ariaLabel={searchOpen ? tr('Suche schließen', 'Close Search') : tr('Suchen', 'Search')}
        />
      </div>

      {/* Search Field */}
      {searchOpen && (
        <div style={{
          position: 'relative',
          marginBottom: '16px'
        }}>
          <Search 
            size={18} 
            style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9CA3AF',
              pointerEvents: 'none'
            }}
          />
          <input
            type="text"
            placeholder={tr('Tickets durchsuchen...', 'Search tickets...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: '52px',
              padding: '0 16px 0 46px',
              border: '1px solid #E6E6E6',
              borderRadius: '16px',
              background: '#FFFFFF',
              fontSize: '15px',
              fontWeight: 500,
              color: '#2A2A2A',
              outline: 'none',
              transition: 'all 0.2s ease'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#1A1A1A';
              e.currentTarget.style.background = '#FFFCF5';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#E6E6E6';
              e.currentTarget.style.background = '#FFFFFF';
            }}
          />
        </div>
      )}

      {/* Filters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(2, minmax(220px, 1fr))',
        gap: '16px',
        marginTop: '16px',
        marginBottom: '24px',
        width: '100%'
      }}>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            height: '52px',
            padding: '0 40px 0 16px',
            border: '1px solid #E5E7EB',
            borderRadius: '16px',
            fontSize: '15px',
            fontWeight: 600,
            background: '#FFFFFF',
            color: '#1A1A1A',
            cursor: 'pointer',
            outline: 'none',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%231A1A1A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 14px center'
          }}
        >
          <option value="all">{tr('Alle Status', 'All Status')}</option>
          <option value="open">{tr('Offen', 'Open')}</option>
          <option value="in_progress">{tr('In Bearbeitung', 'In Progress')}</option>
          <option value="resolved">{tr('Gelöst', 'Resolved')}</option>
          <option value="closed">{tr('Geschlossen', 'Closed')}</option>
        </select>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          style={{
            height: '52px',
            padding: '0 40px 0 16px',
            border: '1px solid #E5E7EB',
            borderRadius: '16px',
            fontSize: '15px',
            fontWeight: 600,
            background: '#FFFFFF',
            color: '#1A1A1A',
            cursor: 'pointer',
            outline: 'none',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%231A1A1A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 14px center'
          }}
        >
          <option value="all">{tr('Alle Kategorien', 'All Categories')}</option>
          <option value="general">{tr('Allgemein', 'General')}</option>
          <option value="change_request">{tr('Änderungswunsch', 'Change Request')}</option>
          <option value="help">{tr('Hilfe', 'Help')}</option>
          <option value="support">{tr('Support', 'Support')}</option>
          <option value="rating">{tr('Bewertung', 'Rating')}</option>
          <option value="other">{tr('Sonstiges', 'Other')}</option>
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

      {/* Tickets Card List */}
      {filteredTickets.length === 0 ? (
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '20px',
          padding: '80px 40px',
          textAlign: 'center'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 20px',
            background: '#F3F4F6',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <MessageSquare size={28} color="#9CA3AF" />
          </div>
          <h3 style={{
            margin: '0 0 8px 0',
            fontSize: '18px',
            fontWeight: 600,
            color: '#1A1A1A'
          }}>
            {tr('Keine Tickets gefunden', 'No tickets found')}
          </h3>
          <p style={{
            margin: 0,
            fontSize: '15px',
            color: '#6B7280'
          }}>
            {searchQuery || filterStatus !== 'all' || filterCategory !== 'all'
              ? tr('Versuchen Sie, Ihre Filter anzupassen', 'Try adjusting your filters')
              : tr('Erstellen Sie Ihr erstes Support-Ticket', 'Create your first support ticket')}
          </p>
        </div>
      ) : isMobile ? (
        // MOBILE: Unified Card System
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {filteredTickets.map((ticket) => {
            const statusColorMap: Record<string, 'green' | 'blue' | 'yellow' | 'red' | 'gray'> = {
              open: 'blue',
              in_progress: 'yellow',
              resolved: 'green',
              closed: 'gray'
            };

            const statusLabelMap: Record<string, { de: string; en: string }> = {
              open: { de: 'Offen', en: 'Open' },
              in_progress: { de: 'In Bearbeitung', en: 'In Progress' },
              resolved: { de: 'Gelöst', en: 'Resolved' },
              closed: { de: 'Geschlossen', en: 'Closed' }
            };

            return (
              <MobileProjectCard
                key={ticket.id}
                title={ticket.ticket_title}
                subtitle={role === 'owner' || role === 'admin' ? ticket.client?.company_name : undefined}
                status={{
                  label: language === 'de' 
                    ? statusLabelMap[ticket.status]?.de || ticket.status
                    : statusLabelMap[ticket.status]?.en || ticket.status,
                  color: statusColorMap[ticket.status] || 'gray'
                }}
                stats={[
                  {
                    label: tr('Kategorie', 'Category'),
                    value: getCategoryLabel(ticket.category)
                  },
                  {
                    label: tr('Erstellt', 'Created'),
                    value: formatDate(ticket.created_at)
                  }
                ]}
                ctaText={tr('Details', 'View Details')}
                onCtaClick={() => handleTicketClick(ticket.id)}
                onClick={() => handleTicketClick(ticket.id)}
              />
            );
          })}
        </div>
      ) : (
        // DESKTOP: List/Table View
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '18px',
          overflow: 'hidden'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse'
          }}>
            <thead>
              <tr style={{
                background: '#FAFAFA',
                borderBottom: '1px solid #E5E7EB'
              }}>
                <th style={{
                  padding: '16px 24px',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#6B7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  {tr('Betreff', 'Subject')}
                </th>
                <th style={{
                  padding: '16px 24px',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#6B7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  {tr('Kategorie', 'Category')}
                </th>
                <th style={{
                  padding: '16px 24px',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#6B7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  {tr('Status', 'Status')}
                </th>
                {(role === 'owner' || role === 'admin') && (
                  <th style={{
                    padding: '16px 24px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6B7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    {tr('Client', 'Client')}
                  </th>
                )}
                <th style={{
                  padding: '16px 24px',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#6B7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  {tr('Erstellt', 'Created')}
                </th>
                <th style={{
                  padding: '16px 24px',
                  textAlign: 'right',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#6B7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  {tr('Aktion', 'Action')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((ticket, index) => {
                const statusColors = getStatusColor(ticket.status);
                
                return (
                  <tr
                    key={ticket.id}
                    onClick={() => handleTicketClick(ticket.id)}
                    style={{
                      borderBottom: index < filteredTickets.length - 1 ? '1px solid #E5E7EB' : 'none',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#FAFAFA';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <td style={{
                      padding: '16px 24px',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#1A1A1A',
                      fontFamily: 'Inter, sans-serif'
                    }}>
                      {ticket.ticket_title}
                    </td>
                    <td style={{
                      padding: '16px 24px',
                      fontSize: '14px',
                      color: '#6B7280',
                      fontFamily: 'Inter, sans-serif'
                    }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: '#F3F4F6',
                        fontSize: '13px',
                        fontWeight: 500
                      }}>
                        {getCategoryLabel(ticket.category)}
                      </span>
                    </td>
                    <td style={{
                      padding: '16px 24px',
                      fontSize: '14px',
                      fontFamily: 'Inter, sans-serif'
                    }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: statusColors.bg,
                        color: statusColors.text,
                        fontSize: '13px',
                        fontWeight: 500
                      }}>
                        {getStatusIcon(ticket.status)}
                        {language === 'de' ? (
                          ticket.status === 'open' ? 'Offen' :
                          ticket.status === 'in_progress' ? 'In Bearbeitung' :
                          ticket.status === 'resolved' ? 'Gelöst' : 'Geschlossen'
                        ) : (
                          ticket.status === 'open' ? 'Open' :
                          ticket.status === 'in_progress' ? 'In Progress' :
                          ticket.status === 'resolved' ? 'Resolved' : 'Closed'
                        )}
                      </span>
                    </td>
                    {(role === 'owner' || role === 'admin') && (
                      <td style={{
                        padding: '16px 24px',
                        fontSize: '14px',
                        color: '#6B7280',
                        fontFamily: 'Inter, sans-serif'
                      }}>
                        {ticket.client?.company_name || '-'}
                      </td>
                    )}
                    <td style={{
                      padding: '16px 24px',
                      fontSize: '14px',
                      color: '#6B7280',
                      fontFamily: 'Inter, sans-serif'
                    }}>
                      {formatDate(ticket.created_at)}
                    </td>
                    <td style={{
                      padding: '16px 24px',
                      textAlign: 'right'
                    }}>
                      <a
                        href={`${baseUrl}/miraka-co-portal/tickets/${ticket.id}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          background: '#1A1A1A',
                          color: '#FFFFFF',
                          fontSize: '13px',
                          fontWeight: 500,
                          textDecoration: 'none',
                          transition: 'all 0.15s ease',
                          fontFamily: 'Inter, sans-serif'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#2A2A2A';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#1A1A1A';
                        }}
                      >
                        {tr('Details', 'View')}
                        <ChevronRight size={14} />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
                  {tr('Neues Ticket erstellen', 'Create New Ticket')}
                </h2>
                <button
                  type="button"
                  onClick={() => {
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
                      {tr('Client', 'Client')} <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
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
                      <option value="">{tr('Client auswählen', 'Select a client')}</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.company_name} {client.client_name && `(${client.client_name})`}
                        </option>
                      ))}
                    </select>
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
                    {tr('Betreff', 'Subject')}
                  </label>
                  <input
                    type="text"
                    value={ticketTitle}
                    onChange={(e) => setTicketTitle(e.target.value)}
                    placeholder={tr('Kurze Beschreibung Ihres Anliegens', 'Brief description of your issue')}
                    required
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '14px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      outline: 'none',
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
                    {tr('Nachricht', 'Message')}
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={tr('Detaillierte Informationen zu Ihrem Anliegen', 'Provide detailed information about your issue')}
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
                    {tr('Kategorie', 'Category')}
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
                    <option value="general">{tr('Allgemein', 'General')}</option>
                    <option value="change_request">{tr('Änderungswunsch', 'Change Request')}</option>
                    <option value="help">{tr('Hilfe', 'Help')}</option>
                    <option value="support">{tr('Support', 'Support')}</option>
                    <option value="rating">{tr('Bewertung', 'Rating')}</option>
                    <option value="other">{tr('Sonstiges', 'Other')}</option>
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
                  {tr('Abbrechen', 'Cancel')}
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
                  {submitting ? tr('Erstelle...', 'Creating...') : tr('Ticket erstellen', 'Create Ticket')}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}











