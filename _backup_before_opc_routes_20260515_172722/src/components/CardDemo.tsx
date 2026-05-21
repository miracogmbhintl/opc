import React, { useState, useEffect } from 'react';
import { Pause } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import '../styles/card-demo.css';

interface Client {
  id: string;
  client_name: string;
  company_name: string;
  contact_person: string;
  status: string;
  email: string;
  phone?: string;
  last_activity_at?: string;
  project_count?: number;
}

interface CardDemoProps {
  baseUrl: string;
}

const CardDemo: React.FC<CardDemoProps> = ({ baseUrl }) => {
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
          console.error('Supabase credentials not found');
          setLoading(false);
          return;
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        const { data, error } = await supabase
          .from('clients')
          .select(`
            id, 
            client_name, 
            company_name, 
            contact_person,
            status, 
            email, 
            phone, 
            last_activity_at
          `)
          .order('last_activity_at', { ascending: false });

        if (error) {
          console.error('Error fetching clients:', error);
        } else {
          console.log('Raw client data:', data);
          // Fetch project counts for each client
          const clientsWithProjectCount = await Promise.all(
            (data || []).map(async (client) => {
              const { count } = await supabase
                .from('projects')
                .select('*', { count: 'exact', head: true })
                .eq('client_id', client.id)
                .eq('status', 'active');
              
              console.log(`Client ${client.company_name}:`, {
                contact_person: client.contact_person,
                project_count: count
              });
              
              return {
                ...client,
                project_count: count || 0
              };
            })
          );
          setClients(clientsWithProjectCount);
        }
      } catch (err) {
        console.error('Failed to fetch clients:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, []);

  const handleSearchToggle = () => {
    setIsSearchActive(!isSearchActive);
    if (isSearchActive) {
      setSearchQuery('');
    }
  };

  const handleAddClient = () => {
    window.location.href = `${baseUrl}/miraka-co-portal/create-client`;
  };

  const filteredClients = clients.filter(client =>
    client.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.company_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusDisplay = (status: string): 'Active' | 'Paused' | 'Inactive' => {
    if (status === 'active') return 'Active';
    if (status === 'suspended') return 'Paused';
    return 'Inactive';
  };

  return (
    <div className="card-demo-container">
      <div className="demo-section">
        <div className="demo-grid">
          {/* Action Card */}
          <div className="action-card">
            <div className={`action-buttons ${isSearchActive ? 'search-active' : ''}`}>
              {!isSearchActive && (
                <button 
                  className="action-btn add-btn"
                  onClick={handleAddClient}
                  aria-label="Add Client"
                >
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
              )}

              <div className={`search-container ${isSearchActive ? 'expanded' : ''}`}>
                {isSearchActive && (
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                )}
                <button 
                  className="action-btn search-btn"
                  onClick={handleSearchToggle}
                  aria-label={isSearchActive ? "Close Search" : "Search Clients"}
                >
                  {isSearchActive ? (
                    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  ) : (
                    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"/>
                      <path d="m21 21-4.35-4.35"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {searchQuery && (
          <div className="search-results">
            <p>Filtering for: <strong>{searchQuery}</strong> ({filteredClients.length} results)</p>
          </div>
        )}
      </div>

      <div className="demo-section">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b6b6b' }}>
            Loading clients...
          </div>
        ) : filteredClients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b6b6b' }}>
            {searchQuery ? 'No clients found matching your search.' : 'No clients available.'}
          </div>
        ) : (
          <div className="clients-grid">
            {filteredClients.map((client) => {
              const statusDisplay = getStatusDisplay(client.status);
              const statusClass = statusDisplay.toLowerCase();
              
              return (
                <div key={client.id} className="card client-card">
                  <div className="client-header">
                    <div className="client-title">
                      <h2>{client.company_name}</h2>
                      <div className={`status-badge ${statusClass}`}>
                        {statusDisplay === 'Active' && (
                          <div className="status-icon status-active" />
                        )}
                        {statusDisplay === 'Paused' && (
                          <Pause className="status-icon status-paused" size={14} />
                        )}
                        {statusDisplay === 'Inactive' && (
                          <div className="status-icon status-inactive" />
                        )}
                        <span>{statusDisplay}</span>
                      </div>
                    </div>
                  </div>

                  <div className="client-stats">
                    <div className="stat-item">
                      <h4 className="stat-label">Contact Person</h4>
                      <h3 className="stat-value" style={{ fontSize: '16px' }}>
                        {client.contact_person || 'No contact'}
                      </h3>
                    </div>
                    <div className="stat-item">
                      <h4 className="stat-label">Projects</h4>
                      <h3 className="stat-value" style={{ fontSize: '16px' }}>
                        {client.project_count || 0}
                      </h3>
                    </div>
                  </div>

                  <div className="client-actions">
                    <a 
                      href={`${baseUrl}/miraka-co-portal/client/${client.id}`} 
                      className="button-secondary small"
                    >
                      View Details
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Add New Client</h2>
            <p>This is where the client creation form would appear.</p>
            <button className="button-secondary small" onClick={() => setIsModalOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardDemo;










