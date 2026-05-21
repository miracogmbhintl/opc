import { useState, useEffect } from 'react';
import { baseUrl } from '../lib/base-url';
import { supabase } from '../lib/supabase';
import MirakaDashboardShell from './MirakaDashboardShell';

interface Client {
  id: string;
  company_name: string;
  client_name: string;
}

interface ProjectCategory {
  id: string;
  name: string;
  description: string;
}

export default function CreateProjectForm() {
  const [clients, setClients] = useState<Client[]>([]);
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    project_title: '',
    client_id: '',
    category: '',
    status: 'active' as 'active' | 'pending' | 'completed' | 'at_risk',
    deadline: '',
    notes: '',
    description: ''
  });

  useEffect(() => {
    loadClients();
    loadCategories();
  }, []);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name, client_name')
        .eq('status', 'active')
        .order('company_name', { ascending: true });

      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error('Failed to load clients:', err);
    } finally {
      setLoadingClients(false);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('project_categories')
        .select('id, name, description')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error loading categories from database:', error);
        // Fallback to hardcoded categories if table doesn't exist
        setCategories([
          { id: '1', name: 'Communications', description: 'Communication and outreach projects' },
          { id: '2', name: 'Content', description: 'Content creation and management projects' },
          { id: '3', name: 'Design', description: 'Design and creative projects' },
          { id: '4', name: 'Internal', description: 'Internal company projects' },
          { id: '5', name: 'Website', description: 'Website development and maintenance' },
          { id: '6', name: 'Website / Branding', description: 'Combined website and branding projects' }
        ]);
      } else {
        console.log('Categories loaded from database:', data);
        setCategories(data || []);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
      // Fallback to hardcoded categories
      setCategories([
        { id: '1', name: 'Communications', description: 'Communication and outreach projects' },
        { id: '2', name: 'Content', description: 'Content creation and management projects' },
        { id: '3', name: 'Design', description: 'Design and creative projects' },
        { id: '4', name: 'Internal', description: 'Internal company projects' },
        { id: '5', name: 'Website', description: 'Website development and maintenance' },
        { id: '6', name: 'Website / Branding', description: 'Combined website and branding projects' }
      ]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate required fields
      if (!formData.project_title.trim()) {
        throw new Error('Project title is required');
      }
      if (!formData.client_id) {
        throw new Error('Please select a client');
      }
      if (!formData.deadline) {
        throw new Error('Deadline is required');
      }

      // Create project via server endpoint
      const response = await fetch(`${baseUrl}/api/projects/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: formData.project_title.trim(),
          client_id: formData.client_id,
          category: formData.category.trim() || null,
          status: formData.status,
          deadline: formData.deadline,
          progress: 0, // Always start at 0%
          notes: formData.notes.trim(),
          description: formData.description.trim()
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create project');
      }

      setSuccess(true);
      
      // Redirect after short delay
      setTimeout(() => {
        window.location.href = `${baseUrl}/miraka-co-portal/projects`;
      }, 1500);

    } catch (err: any) {
      console.error('Failed to create project:', err);
      setError(err.message || 'Failed to create project');
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (success) {
    return (
      <MirakaDashboardShell>
        <div style={{
          minHeight: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#DCFCE7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h3 style={{
              fontSize: '20px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '8px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
            }}>
              Project Created Successfully!
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#6B7280',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
            }}>
              Redirecting to projects...
            </p>
          </div>
        </div>
      </MirakaDashboardShell>
    );
  }

  return (
    <MirakaDashboardShell>
      {/* Page Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <button
            onClick={() => window.location.href = `${baseUrl}/miraka-co-portal/projects`}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              color: '#6B7280',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#1A1A1A'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#6B7280'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 600,
            color: '#1A1A1A',
            margin: 0,
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
            letterSpacing: '-0.02em'
          }}>
            Create New Project
          </h1>
        </div>
        <p style={{
          fontSize: '15px',
          color: '#6B7280',
          margin: 0,
          paddingLeft: '32px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
        }}>
          Add a new project for a client
        </p>
      </div>

      {/* Form Card */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '14px',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
        padding: '32px'
      }}>
        {error && (
          <div style={{
            padding: '12px 16px',
            background: '#FEE2E2',
            border: '1px solid #FCA5A5',
            borderRadius: '10px',
            marginBottom: '24px',
            fontSize: '14px',
            color: '#991B1B',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Project Title */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '8px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
            }}>
              Project Title *
            </label>
            <input
              type="text"
              name="project_title"
              value={formData.project_title}
              onChange={handleChange}
              placeholder="Enter project title"
              required
              style={{
                width: '100%',
                height: '48px',
                padding: '0 14px',
                fontSize: '15px',
                border: '1px solid #E6E6E6',
                borderRadius: '16px',
                background: '#FFFFFF',
                color: '#2A2A2A',
                outline: 'none',
                transition: 'all 0.2s ease',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
                fontWeight: 500,
                boxSizing: 'border-box'
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
          </div>

          {/* Client Selection */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '8px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
            }}>
              Client *
            </label>
            <select
              name="client_id"
              value={formData.client_id}
              onChange={handleChange}
              required
              disabled={loadingClients}
              style={{
                width: '100%',
                height: '48px',
                padding: '0 14px',
                paddingRight: '40px',
                fontSize: '15px',
                border: '1px solid #E6E6E6',
                borderRadius: '16px',
                background: '#FFFFFF',
                color: '#2A2A2A',
                outline: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
                fontWeight: 600,
                appearance: 'none',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#1A1A1A';
                e.currentTarget.style.background = '#FAFAFA';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#E6E6E6';
                e.currentTarget.style.background = '#FFFFFF';
              }}
            >
              <option value="">Select a client</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.company_name || client.client_name}
                </option>
              ))}
            </select>
          </div>

          {/* Category and Status - Side by Side */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '24px',
            marginBottom: '24px'
          }}>
            {/* Category */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 600,
                color: '#1A1A1A',
                marginBottom: '8px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
              }}>
                Category
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                disabled={loadingCategories}
                style={{
                  width: '100%',
                  height: '48px',
                  padding: '0 14px',
                  paddingRight: '40px',
                  fontSize: '15px',
                  border: '1px solid #E6E6E6',
                  borderRadius: '16px',
                  background: '#FFFFFF',
                  color: '#2A2A2A',
                  outline: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
                  fontWeight: 600,
                  appearance: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#1A1A1A';
                  e.currentTarget.style.background = '#FAFAFA';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E6E6E6';
                  e.currentTarget.style.background = '#FFFFFF';
                }}
              >
                <option value="">Select a category</option>
                {categories.length > 0 ? (
                  categories.map(category => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))
                ) : (
                  !loadingCategories && <option value="" disabled>No categories available</option>
                )}
              </select>
            </div>

            {/* Status */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 600,
                color: '#1A1A1A',
                marginBottom: '8px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
              }}>
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                style={{
                  width: '100%',
                  height: '48px',
                  padding: '0 14px',
                  paddingRight: '40px',
                  fontSize: '15px',
                  border: '1px solid #E6E6E6',
                  borderRadius: '16px',
                  background: '#FFFFFF',
                  color: '#2A2A2A',
                  outline: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
                  fontWeight: 600,
                  appearance: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#1A1A1A';
                  e.currentTarget.style.background = '#FAFAFA';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E6E6E6';
                  e.currentTarget.style.background = '#FFFFFF';
                }}
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="at_risk">At Risk</option>
              </select>
            </div>
          </div>

          {/* Deadline and Notes - Side by Side */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '24px',
            marginBottom: '24px'
          }}>
            {/* Deadline */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 600,
                color: '#1A1A1A',
                marginBottom: '8px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
              }}>
                Deadline *
              </label>
              <input
                type="date"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
                required
                style={{
                  width: '100%',
                  height: '48px',
                  padding: '0 14px',
                  fontSize: '15px',
                  border: '1px solid #E6E6E6',
                  borderRadius: '16px',
                  background: '#FFFFFF',
                  color: '#2A2A2A',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
                  fontWeight: 500,
                  boxSizing: 'border-box'
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
            </div>

            {/* Project Notes */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 600,
                color: '#1A1A1A',
                marginBottom: '8px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
              }}>
                Project Notes
              </label>
              <input
                type="text"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="e.g., High priority, Rush project"
                style={{
                  width: '100%',
                  height: '48px',
                  padding: '0 14px',
                  fontSize: '15px',
                  border: '1px solid #E6E6E6',
                  borderRadius: '16px',
                  background: '#FFFFFF',
                  color: '#2A2A2A',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
                  fontWeight: 500,
                  boxSizing: 'border-box'
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
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: '32px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '8px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
            }}>
              Project Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe the project scope, objectives, and deliverables..."
              rows={6}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '15px',
                border: '1px solid #E6E6E6',
                borderRadius: '16px',
                background: '#FFFFFF',
                color: '#2A2A2A',
                outline: 'none',
                resize: 'vertical',
                transition: 'all 0.2s ease',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
                fontWeight: 500,
                lineHeight: 1.6,
                boxSizing: 'border-box'
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
          </div>

          {/* Form Actions */}
          <div style={{
            display: 'flex',
            gap: '12px',
            paddingTop: '24px',
            borderTop: '1px solid #F3F4F6'
          }}>
            <button
              type="button"
              onClick={() => window.location.href = `${baseUrl}/miraka-co-portal/projects`}
              disabled={loading}
              style={{
                padding: '10px 20px',
                background: '#FFFFFF',
                color: '#1A1A1A',
                fontSize: '14px',
                fontWeight: 500,
                borderRadius: '10px',
                border: '1px solid #E5E7EB',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
                opacity: loading ? 0.5 : 1
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.background = '#F9FAFB')}
              onMouseLeave={(e) => e.currentTarget.style.background = '#FFFFFF'}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 20px',
                background: '#1A1A1A',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 500,
                borderRadius: '10px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
                opacity: loading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.background = '#2A2A2A')}
              onMouseLeave={(e) => e.currentTarget.style.background = '#1A1A1A'}
            >
              {loading ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderTopColor: '#FFFFFF',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </MirakaDashboardShell>
  );
}










