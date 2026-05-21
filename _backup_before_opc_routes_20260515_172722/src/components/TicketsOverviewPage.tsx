/**
 * Tickets Overview Page - Projects-Style Card Layout
 * Visual update only - ALL backend logic preserved
 * Supabase integration for real-time ticket management
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import { 
  Plus, Search, Trash2, MessageSquare, AlertCircle, CheckCircle2, Clock, TrendingUp
} from 'lucide-react';

// ==========================================
// TYPES
// ==========================================

interface TicketData {
  id: string;
  subject: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  project_title?: string;
  project_id?: string;
  client_id?: string;
  client_name?: string;
  creator_id: string;
  creator_name: string;
  assignee_id?: string;
  assignee_name?: string;
  last_updated: string;
  created_at: string;
  is_internal: boolean;
  message_count: number;
}

interface TicketsOverviewPageProps {
  role: 'owner' | 'admin' | 'client';
}

// ==========================================
// MOCK DATA ADAPTER - Linked to Users
// ==========================================

const mockTickets: TicketData[] = [
  {
    id: 'TKT-001',
    subject: 'Website deployment issue on staging',
    status: 'open',
    priority: 'high',
    project_title: 'Website Redesign',
    project_id: 'proj-1',
    client_id: 'client-1',
    client_name: 'Acme Corporation',
    creator_id: 'user-client-1',
    creator_name: 'Sarah Johnson',
    assignee_id: 'user-admin-1',
    assignee_name: 'John Smith',
    last_updated: new Date().toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(),
    is_internal: false,
    message_count: 3
  },
  {
    id: 'TKT-002',
    subject: 'Logo file request for social media',
    status: 'in-progress',
    priority: 'medium',
    project_title: 'Brand Identity',
    project_id: 'proj-2',
    client_id: 'client-2',
    client_name: 'Tech Startup Inc',
    creator_id: 'user-client-2',
    creator_name: 'Mike Chen',
    assignee_id: 'user-admin-1',
    assignee_name: 'John Smith',
    last_updated: new Date(Date.now() - 3600000).toISOString(),
    created_at: new Date(Date.now() - 172800000).toISOString(),
    is_internal: false,
    message_count: 5
  },
  {
    id: 'TKT-003',
    subject: 'Question about hosting renewal',
    status: 'resolved',
    priority: 'low',
    project_title: 'Website Maintenance',
    project_id: 'proj-1',
    client_id: 'client-1',
    client_name: 'Acme Corporation',
    creator_id: 'user-client-1',
    creator_name: 'Sarah Johnson',
    assignee_id: 'user-admin-2',
    assignee_name: 'Emma Davis',
    last_updated: new Date(Date.now() - 7200000).toISOString(),
    created_at: new Date(Date.now() - 259200000).toISOString(),
    is_internal: false,
    message_count: 2
  }
];

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function TicketsOverviewPage({ role }: TicketsOverviewPageProps) {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [isMobile, setIsMobile] = useState(false);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load tickets on mount
  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual Supabase query when schema is ready
      // const { data, error } = await supabase
      //   .from('tickets')
      //   .select('*, projects(title), clients(name), creators:user_profiles!creator_id(full_name), assignees:user_profiles!assignee_id(full_name)')
      //   .order('created_at', { ascending: false });
      
      // For now, use mock data
      await new Promise(resolve => setTimeout(resolve, 800));
      setTickets(mockTickets);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter tickets
  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.project_title?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Status Badge
  const StatusBadge = ({ status }: { status: string }) => {
    const colors: Record<string, { bg: string; text: string }> = {
      'open': { bg: '#DBEAFE', text: '#1E40AF' },
      'in-progress': { bg: '#FEF3C7', text: '#92400E' },
      'resolved': { bg: '#D1FAE5', text: '#065F46' },
      'closed': { bg: '#F3F4F6', text: '#6B7280' }
    };
    const color = colors[status] || colors['open'];

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '13px',
        fontWeight: 600,
        background: color.bg,
        color: color.text,
        textTransform: 'capitalize'
      }}>
        {status.replace('-', ' ')}
      </span>
    );
  };

  // Priority Badge
  const PriorityBadge = ({ priority }: { priority: string }) => {
    const colors: Record<string, { bg: string; text: string }> = {
      'low': { bg: '#F3F4F6', text: '#6B7280' },
      'medium': { bg: '#DBEAFE', text: '#1E40AF' },
      'high': { bg: '#FED7AA', text: '#9A3412' },
      'urgent': { bg: '#FECACA', text: '#991B1B' }
    };
    const color = colors[priority] || colors['low'];

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '13px',
        fontWeight: 600,
        background: color.bg,
        color: color.text,
        textTransform: 'capitalize'
      }}>
        {priority}
      </span>
    );
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return null;
  }

  return (
    <div style={{
      marginLeft: isMobile ? '0' : '280px',
      minHeight: '100vh',
      background: '#F2F2F2',
      padding: isMobile ? '24px' : '48px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
    }}>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{
          margin: '0 0 8px 0',
          fontSize: '28px',
          fontWeight: 700,
          color: '#1A1A1A',
          letterSpacing: '-0.02em'
        }}>
          Support Tickets
        </h1>
        <p style={{
          margin: '0 0 20px 0',
          fontSize: '15px',
          color: '#6B7280',
          fontWeight: 500
        }}>
          {filteredTickets.length} {filteredTickets.length === 1 ? 'ticket' : 'tickets'}
        </p>

        {/* Action Row - 2 Big Buttons */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '16px',
          width: '100%',
          marginBottom: searchOpen ? '20px' : '0'
        }}>
          <button
            onClick={() => window.location.href = `${baseUrl}/miraka-co-portal/tickets/new`}
            style={{
              width: '100%',
              height: '72px',
              borderRadius: '22px',
              background: '#1A1A1A',
              color: '#FFFFFF',
              border: '1px solid #1A1A1A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#2A2A2A';
              e.currentTarget.style.borderColor = '#2A2A2A';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#1A1A1A';
              e.currentTarget.style.borderColor = '#1A1A1A';
            }}
          >
            <Plus size={20} strokeWidth={2} />
            New Ticket
          </button>

          <button
            onClick={() => setSearchOpen(!searchOpen)}
            style={{
              width: '100%',
              height: '72px',
              borderRadius: '22px',
              background: '#1A1A1A',
              color: '#FFFFFF',
              border: '1px solid #1A1A1A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#2A2A2A';
              e.currentTarget.style.borderColor = '#2A2A2A';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#1A1A1A';
              e.currentTarget.style.borderColor = '#1A1A1A';
            }}
          >
            <Search size={20} strokeWidth={2} />
            Search
          </button>
        </div>
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
            placeholder="Search tickets..."
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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
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
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="in-progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
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
          <option value="all">All Priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

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
            No tickets found
          </h3>
          <p style={{
            margin: 0,
            fontSize: '15px',
            color: '#6B7280'
          }}>
            {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first support ticket'}
          </p>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {filteredTickets.map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => window.location.href = `${baseUrl}/miraka-co-portal/tickets/${ticket.id}`}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '20px',
                padding: '24px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.08)';
                e.currentTarget.style.borderColor = '#D1D5DB';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.borderColor = '#E5E7EB';
              }}
            >
              {/* Top Row - Title + Status */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '12px',
                gap: '16px'
              }}>
                <h3 style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#1A1A1A',
                  lineHeight: '1.4'
                }}>
                  {ticket.subject}
                </h3>
                <StatusBadge status={ticket.status} />
              </div>

              {/* Metadata Line */}
              <div style={{
                fontSize: '13px',
                color: '#9CA3AF',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap'
              }}>
                <span>{ticket.id}</span>
                <span>•</span>
                <span>{ticket.client_name}</span>
                <span>•</span>
                <span>{ticket.project_title || '—'}</span>
                {ticket.is_internal && (
                  <>
                    <span style={{
                      background: '#F3F4F6',
                      color: '#6B7280',
                      borderRadius: '999px',
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: 600
                    }}>
                      Internal
                    </span>
                  </>
                )}
              </div>

              {/* Info Grid - Priority + Updated */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr',
                gap: '16px',
                paddingTop: '16px',
                borderTop: '1px solid #F3F4F6',
                marginBottom: '16px'
              }}>
                <div>
                  <div style={{
                    fontSize: '11px',
                    color: '#9A9A9A',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '6px',
                    fontWeight: 600
                  }}>
                    Priority
                  </div>
                  <PriorityBadge priority={ticket.priority} />
                </div>
                <div>
                  <div style={{
                    fontSize: '11px',
                    color: '#9A9A9A',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '6px',
                    fontWeight: 600
                  }}>
                    Updated
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#1A1A1A',
                    fontWeight: 600
                  }}>
                    {formatDate(ticket.last_updated)}
                  </div>
                </div>
              </div>

              {/* Assignee + Message Count */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '12px',
                borderTop: '1px solid #F3F4F6',
                marginBottom: '20px'
              }}>
                <div style={{
                  fontSize: '13px',
                  color: '#6B7280',
                  fontWeight: 500
                }}>
                  {ticket.assignee_name || '—'}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  background: '#F3F4F6',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#6B7280'
                }}>
                  <MessageSquare size={14} />
                  {ticket.message_count}
                </div>
              </div>

              {/* View Details Button */}
              <div style={{
                height: '56px',
                borderRadius: '18px',
                background: '#1A1A1A',
                color: '#FFFFFF',
                fontSize: '15px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                View Ticket
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
