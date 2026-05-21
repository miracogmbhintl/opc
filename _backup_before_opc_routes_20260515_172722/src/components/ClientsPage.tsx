import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Send, User, Search, FileText } from 'lucide-react';

interface Client {
  id: string;
  company_name: string;
  client_name: string;
  email: string;
  phone: string | null;
  status: string;
  created_at: string;
  user_id?: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  const [formData, setFormData] = useState({
    company_name: '',
    client_name: '',
    email: '',
    phone: '',
    status: 'active'
  });

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadClients = async () => {
    setLoading(true);
    setError('');

    try {
      const { data, error: fetchError } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error loading clients:', fetchError);
        setError('Failed to load clients');
      } else {
        setClients(data || []);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const { error: insertError } = await supabase
        .from('clients')
        .insert([
          {
            company_name: formData.company_name,
            client_name: formData.client_name,
            email: formData.email,
            phone: formData.phone || null,
            status: formData.status
          }
        ]);

      if (insertError) {
        console.error('Error creating client:', insertError);
        setError('Failed to create client');
      } else {
        setShowCreateModal(false);
        setFormData({
          company_name: '',
          client_name: '',
          email: '',
          phone: '',
          status: 'active'
        });
        await loadClients();
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    setSubmitting(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          email: formData.email,
          phone: formData.phone || null
        })
        .eq('id', selectedClient.id);

      if (updateError) {
        console.error('Error updating client:', updateError);
        setError('Failed to update client');
      } else {
        setShowEditModal(false);
        setSelectedClient(null);
        await loadClients();
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedClient) return;

    setSubmitting(true);
    setError('');

    try {
      const { error: deleteError } = await supabase
        .from('clients')
        .delete()
        .eq('id', selectedClient.id);

      if (deleteError) {
        console.error('Error deleting client:', deleteError);
        setError('Failed to delete client');
      } else {
        setShowDeleteModal(false);
        setSelectedClient(null);
        await loadClients();
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendPasswordReset = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/miraka-co-portal/set-password`
      });

      if (error) {
        console.error('Error sending reset email:', error);
        alert('Failed to send password reset email');
      } else {
        alert('Password reset email sent successfully');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('Something went wrong');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;

    const query = searchQuery.toLowerCase();

    return clients.filter((client) => {
      return (
        client.company_name.toLowerCase().includes(query) ||
        client.client_name.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query) ||
        (client.phone && client.phone.toLowerCase().includes(query))
      );
    });
  }, [clients, searchQuery]);

  if (loading) {
    return null;
  }

  return (
    <div
      style={{
        padding: '40px',
        maxWidth: '1400px',
        margin: '0 auto',
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif"
      }}
    >
      <div style={{ marginBottom: '32px' }}>
        {/* Page Title */}
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <h1
            style={{
              fontSize: '32px',
              fontWeight: '600',
              color: '#1A1A1A',
              margin: '0 0 8px 0'
            }}
          >
            Clients
          </h1>
          <p
            style={{
              fontSize: '16px',
              color: '#7A7A7A',
              margin: 0
            }}
          >
            {clients.length} {clients.length === 1 ? 'client' : 'clients'} total
          </p>
        </div>

        {/* Full-Width 3-Button Toolbar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            width: '100%',
            gap: '16px',
            marginBottom: searchOpen ? '20px' : '0'
          }}
        >
          <button
            type="button"
            onClick={() => {
              window.location.href = '/miraka-co-portal/clients/invoice';
            }}
            style={{
              width: '100%',
              height: '72px',
              borderRadius: '22px',
              border: '1px solid #1A1A1A',
              background: '#1A1A1A',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '14px',
              fontWeight: 600
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
            <FileText size={20} strokeWidth={2} />
            {!isMobile && 'Create Invoice'}
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            style={{
              width: '100%',
              height: '72px',
              borderRadius: '22px',
              border: '1px solid #1A1A1A',
              background: '#1A1A1A',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '14px',
              fontWeight: 600
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
            {!isMobile && 'Add Client'}
          </button>

          <button
            type="button"
            onClick={() => {
              const next = !searchOpen;
              setSearchOpen(next);
              if (!next) setSearchQuery('');
            }}
            style={{
              width: '100%',
              height: '72px',
              borderRadius: '22px',
              border: '1px solid #1A1A1A',
              background: '#1A1A1A',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '14px',
              fontWeight: 600
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
            {!isMobile && 'Search'}
          </button>
        </div>

        {/* Full-Width Search Field */}
        {searchOpen && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
              marginTop: '0'
            }}
          >
            <div
              style={{
                width: '100%',
                position: 'relative'
              }}
            >
              <Search
                size={18}
                style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#6B7280',
                  pointerEvents: 'none'
                }}
              />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '52px',
                  padding: '0 16px 0 46px',
                  fontSize: '15px',
                  border: '1px solid #E6E6E6',
                  borderRadius: '16px',
                  background: '#FFFFFF',
                  color: '#2A2A2A',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                  fontWeight: 500
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
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            marginBottom: '24px',
            padding: '16px 20px',
            background: '#FEE2E2',
            border: '1px solid #DC2626',
            borderRadius: '12px',
            color: '#DC2626',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          {error}
        </div>
      )}

      {filteredClients.length === 0 ? (
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            padding: '80px 40px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            textAlign: 'center'
          }}
        >
          <User
            size={48}
            style={{
              margin: '0 auto 16px',
              opacity: 0.3,
              display: 'block',
              strokeWidth: 1.5
            }}
          />
          <p
            style={{
              fontSize: '16px',
              fontWeight: '500',
              color: '#1A1A1A',
              margin: '0 0 8px 0'
            }}
          >
            {searchQuery ? 'No clients found' : 'No clients yet'}
          </p>
          <p
            style={{
              fontSize: '14px',
              color: '#7A7A7A',
              margin: 0
            }}
          >
            {searchQuery ? 'Try a different search term' : 'Create your first client to get started'}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '24px'
          }}
        >
          {filteredClients.map((client) => (
            <div
              key={client.id}
              style={{
                background: '#FFFFFF',
                borderRadius: '20px',
                padding: '28px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '20px'
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: '#F7F7F7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1A1A1A'
                  }}
                >
                  {getInitials(client.client_name)}
                </div>
                <span
                  style={{
                    padding: '4px 12px',
                    background: client.status === 'active' ? '#E5F5EE' : '#F7F7F7',
                    color: client.status === 'active' ? '#0E7A4D' : '#7A7A7A',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '500',
                    textTransform: 'capitalize'
                  }}
                >
                  {client.status}
                </span>
              </div>

              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#1A1A1A',
                  margin: '0 0 4px 0'
                }}
              >
                {client.company_name}
              </h3>

              <p
                style={{
                  fontSize: '14px',
                  color: '#7A7A7A',
                  margin: '0 0 16px 0'
                }}
              >
                {client.client_name}
              </p>

              <div
                style={{
                  padding: '16px 0',
                  borderTop: '1px solid #F2F2F2',
                  borderBottom: '1px solid #F2F2F2',
                  marginBottom: '16px'
                }}
              >
                <div
                  style={{
                    fontSize: '13px',
                    color: '#7A7A7A',
                    marginBottom: '8px',
                    wordBreak: 'break-all'
                  }}
                >
                  {client.email}
                </div>
                {client.phone && (
                  <div
                    style={{
                      fontSize: '13px',
                      color: '#7A7A7A'
                    }}
                  >
                    {client.phone}
                  </div>
                )}
                <div
                  style={{
                    fontSize: '12px',
                    color: '#7A7A7A',
                    marginTop: '8px'
                  }}
                >
                  Created {formatDate(client.created_at)}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '8px'
                }}
              >
                <button
                  onClick={() => {
                    setSelectedClient(client);
                    setFormData({
                      company_name: client.company_name,
                      client_name: client.client_name,
                      email: client.email,
                      phone: client.phone || '',
                      status: client.status
                    });
                    setShowEditModal(true);
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: '#F7F7F7',
                    color: '#1A1A1A',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'background 0.2s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#EEEEEE')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#F7F7F7')}
                >
                  <Edit2 size={14} strokeWidth={1.5} />
                  Edit
                </button>
                <button
                  onClick={() => {
                    setSelectedClient(client);
                    setShowDeleteModal(true);
                  }}
                  style={{
                    padding: '10px',
                    background: '#FEE2E2',
                    color: '#DC2626',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#FECACA')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#FEE2E2')}
                  title="Delete"
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => !submitting && setShowCreateModal(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '20px',
              padding: '32px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.15)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '28px' }}>
                <h2
                  style={{
                    fontSize: '22px',
                    fontWeight: '600',
                    color: '#1A1A1A',
                    margin: '0 0 8px 0'
                  }}
                >
                  Create New Client
                </h2>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#7A7A7A',
                    margin: 0
                  }}
                >
                  Add a new client to your portal
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '28px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#1A1A1A',
                      marginBottom: '8px'
                    }}
                  >
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    required
                    disabled={submitting}
                    placeholder="Acme Inc."
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: '1px solid #E5E5E5',
                      background: '#FFFFFF',
                      fontSize: '14px',
                      color: '#1A1A1A',
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                      fontFamily: 'inherit'
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#1A1A1A')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#E5E5E5')}
                  />
                  <p style={{ fontSize: '12px', color: '#7A7A7A', margin: '6px 0 0 0' }}>
                    Cannot be changed after creation
                  </p>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#1A1A1A',
                      marginBottom: '8px'
                    }}
                  >
                    Client Name *
                  </label>
                  <input
                    type="text"
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    required
                    disabled={submitting}
                    placeholder="John Smith"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: '1px solid #E5E5E5',
                      background: '#FFFFFF',
                      fontSize: '14px',
                      color: '#1A1A1A',
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                      fontFamily: 'inherit'
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#1A1A1A')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#E5E5E5')}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#1A1A1A',
                      marginBottom: '8px'
                    }}
                  >
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={submitting}
                    placeholder="john@acme.com"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: '1px solid #E5E5E5',
                      background: '#FFFFFF',
                      fontSize: '14px',
                      color: '#1A1A1A',
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                      fontFamily: 'inherit'
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#1A1A1A')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#E5E5E5')}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#1A1A1A',
                      marginBottom: '8px'
                    }}
                  >
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={submitting}
                    placeholder="+1 234 567 8900"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: '1px solid #E5E5E5',
                      background: '#FFFFFF',
                      fontSize: '14px',
                      color: '#1A1A1A',
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                      fontFamily: 'inherit'
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#1A1A1A')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#E5E5E5')}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                  style={{
                    padding: '10px 20px',
                    background: '#F7F7F7',
                    color: '#1A1A1A',
                    borderRadius: '10px',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'background 0.2s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#EEEEEE')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#F7F7F7')}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 20px',
                    background: '#1A1A1A',
                    color: '#FFFFFF',
                    borderRadius: '10px',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.6 : 1,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => !submitting && (e.currentTarget.style.background = '#000000')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#1A1A1A')}
                >
                  {submitting ? 'Creating...' : 'Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedClient && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => !submitting && setShowEditModal(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '20px',
              padding: '32px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.15)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleEdit}>
              <div style={{ marginBottom: '28px' }}>
                <h2
                  style={{
                    fontSize: '22px',
                    fontWeight: '600',
                    color: '#1A1A1A',
                    margin: '0 0 8px 0'
                  }}
                >
                  Edit Client
                </h2>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#7A7A7A',
                    margin: 0
                  }}
                >
                  {selectedClient.company_name}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '28px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#1A1A1A',
                      marginBottom: '8px'
                    }}
                  >
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    disabled
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: '1px solid #E5E5E5',
                      background: '#F7F7F7',
                      fontSize: '14px',
                      color: '#7A7A7A',
                      cursor: 'not-allowed',
                      fontFamily: 'inherit'
                    }}
                  />
                  <p style={{ fontSize: '12px', color: '#7A7A7A', margin: '6px 0 0 0' }}>
                    Company name cannot be changed
                  </p>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#1A1A1A',
                      marginBottom: '8px'
                    }}
                  >
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: '1px solid #E5E5E5',
                      background: '#FFFFFF',
                      fontSize: '14px',
                      color: '#1A1A1A',
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                      fontFamily: 'inherit'
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#1A1A1A')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#E5E5E5')}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#1A1A1A',
                      marginBottom: '8px'
                    }}
                  >
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: '1px solid #E5E5E5',
                      background: '#FFFFFF',
                      fontSize: '14px',
                      color: '#1A1A1A',
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                      fontFamily: 'inherit'
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#1A1A1A')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#E5E5E5')}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleSendPasswordReset(selectedClient.email)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    background: '#F7F7F7',
                    color: '#1A1A1A',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'background 0.2s ease',
                    width: 'fit-content'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#EEEEEE')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#F7F7F7')}
                >
                  <Send size={14} strokeWidth={1.5} />
                  Send Password Reset
                </button>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={submitting}
                  style={{
                    padding: '10px 20px',
                    background: '#F7F7F7',
                    color: '#1A1A1A',
                    borderRadius: '10px',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'background 0.2s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#EEEEEE')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#F7F7F7')}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 20px',
                    background: '#1A1A1A',
                    color: '#FFFFFF',
                    borderRadius: '10px',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.6 : 1,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => !submitting && (e.currentTarget.style.background = '#000000')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#1A1A1A')}
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && selectedClient && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => !submitting && setShowDeleteModal(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '20px',
              padding: '32px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.15)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: '24px' }}>
              <h2
                style={{
                  fontSize: '22px',
                  fontWeight: '600',
                  color: '#1A1A1A',
                  margin: '0 0 8px 0'
                }}
              >
                Delete Client
              </h2>
              <p
                style={{
                  fontSize: '14px',
                  color: '#7A7A7A',
                  margin: 0,
                  lineHeight: 1.6
                }}
              >
                Are you sure you want to delete <strong>{selectedClient.company_name}</strong>? This action cannot be undone.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={submitting}
                style={{
                  padding: '10px 20px',
                  background: '#F7F7F7',
                  color: '#1A1A1A',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#EEEEEE')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#F7F7F7')}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                style={{
                  padding: '10px 20px',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.6 : 1,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => !submitting && (e.currentTarget.style.background = '#B91C1C')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#DC2626')}
              >
                {submitting ? 'Deleting...' : 'Delete Client'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
