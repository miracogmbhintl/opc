import React, { useState, useEffect } from 'react';
import { Pause } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import '../styles/card-demo.css';

interface Project {
  id: string;
  project_title: string;
  category: string;
  status: string;
  progress: number;
  client_id?: string;
  created_at?: string;
}

interface ProjectCardViewProps {
  baseUrl: string;
}

const ProjectCardView: React.FC<ProjectCardViewProps> = ({ baseUrl }) => {
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
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
          .from('projects')
          .select(`
            id, 
            project_title, 
            category,
            status, 
            progress,
            client_id,
            created_at,
            deadline
          `)
          .order('deadline', { ascending: false, nullsFirst: false });

        if (error) {
          console.error('Error fetching projects:', error);
        } else {
          console.log('Raw project data:', data);
          setProjects(data || []);
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const handleSearchToggle = () => {
    setIsSearchActive(!isSearchActive);
    if (isSearchActive) {
      setSearchQuery('');
    }
  };

  const handleAddProject = () => {
    window.location.href = `${baseUrl}/einsatz-planen`;
  };

  const filteredProjects = projects.filter(project =>
    project.project_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (project.category && project.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getStatusDisplay = (status: string): 'Active' | 'Paused' | 'Inactive' => {
    if (status === 'active' || status === 'in_progress') return 'Active';
    if (status === 'paused' || status === 'on_hold') return 'Paused';
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
                  onClick={handleAddProject}
                  aria-label="Add Project"
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
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                )}
                <button 
                  className="action-btn search-btn"
                  onClick={handleSearchToggle}
                  aria-label={isSearchActive ? "Close Search" : "Search Projects"}
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
            <p>Filtering for: <strong>{searchQuery}</strong> ({filteredProjects.length} results)</p>
          </div>
        )}
      </div>

      <div className="demo-section">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b6b6b' }}>
            Loading projects...
          </div>
        ) : filteredProjects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b6b6b' }}>
            {searchQuery ? 'No projects found matching your search.' : 'No projects available.'}
          </div>
        ) : (
          <div className="clients-grid">
            {filteredProjects.map((project) => {
              const statusDisplay = getStatusDisplay(project.status);
              const statusClass = statusDisplay.toLowerCase();
              
              return (
                <div key={project.id} className="card client-card">
                  <div className="client-header">
                    <div className="client-title">
                      <h2>{project.project_title}</h2>
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
                      <h4 className="stat-label">Category</h4>
                      <h3 className="stat-value" style={{ fontSize: '16px' }}>
                        {project.category || 'No category'}
                      </h3>
                    </div>
                    <div className="stat-item">
                      <h4 className="stat-label">Progress</h4>
                      <h3 className="stat-value" style={{ fontSize: '16px' }}>
                        {project.progress || 0}%
                      </h3>
                    </div>
                  </div>

                  <div className="client-actions">
                    <a 
                      href={`${baseUrl}/einsatz/${project.id}`} 
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
    </div>
  );
};

export default ProjectCardView;

