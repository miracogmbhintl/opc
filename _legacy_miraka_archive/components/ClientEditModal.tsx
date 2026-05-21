import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import { Search, Building2, User, MapPin, FileText } from 'lucide-react';

interface ClientData {
  id: string;
  // User profile
  email: string;
  full_name: string;
  
  // Company information
  company_name: string;
  website?: string;
  industry?: string;
  tax_id?: string;
  
  // Contact information
  client_name: string;
  phone?: string;
  preferred_contact?: 'email' | 'phone';
  
  // Address information
  street?: string;
  street_number?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  
  // Internal
  internal_notes?: string;
  status: 'active' | 'pending' | 'inactive';
}

interface ClientEditModalProps {
  clientId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
  baseUrl?: string;
}

// Common industries list (same as create form)
const INDUSTRIES = [
  'Accommodation & Food Services', 'Administrative Services', 'Agriculture & Farming',
  'Arts & Entertainment', 'Automotive', 'Construction', 'Consulting', 'Education',
  'Energy & Utilities', 'Finance & Insurance', 'Healthcare', 'Hospitality',
  'Information Technology', 'Legal Services', 'Manufacturing', 'Marketing & Advertising',
  'Media & Communications', 'Non-Profit', 'Professional Services', 'Real Estate',
  'Retail', 'Technology', 'Telecommunications', 'Transportation & Logistics',
  'Travel & Tourism', 'Wholesale Trade', 'Other'
];

// Common countries list (same as create form)
const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Argentina', 'Armenia', 'Australia',
  'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium',
  'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil',
  'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada',
  'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros',
  'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Djibouti',
  'Dominica', 'Dominican Republic', 'East Timor', 'Ecuador', 'Egypt', 'El Salvador',
  'Equatorial Guinea', 'Eritrea', 'Estonia', 'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon',
  'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea',
  'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia',
  'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan',
  'Kenya', 'Kiribati', 'North Korea', 'South Korea', 'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Laos',
  'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg',
  'Macedonia', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands',
  'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro',
  'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand',
  'Nicaragua', 'Niger', 'Nigeria', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama',
  'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania',
  'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines',
  'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles',
  'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa',
  'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Swaziland', 'Sweden', 'Switzerland',
  'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Togo', 'Tonga', 'Trinidad and Tobago',
  'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates',
  'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City',
  'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
];

export default function ClientEditModal({ clientId, isOpen, onClose, onSave, baseUrl = '' }: ClientEditModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'company' | 'address' | 'internal'>('company');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [originalEmail, setOriginalEmail] = useState(''); // Track original email
  const [originalName, setOriginalName] = useState(''); // Track original name to detect changes
  
  // Search states for dropdowns
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [industrySearch, setIndustrySearch] = useState('');
  const [showIndustryDropdown, setShowIndustryDropdown] = useState(false);
  
  const [formData, setFormData] = useState<ClientData>({
    id: clientId,
    email: '',
    full_name: '',
    company_name: '',
    website: '',
    industry: '',
    tax_id: '',
    client_name: '',
    phone: '',
    preferred_contact: 'email',
    street: '',
    street_number: '',
    city: '',
    state: '',
    zip_code: '',
    country: '',
    internal_notes: '',
    status: 'active'
  });

  // Initialize form data and store original email when modal opens
  useEffect(() => {
    if (isOpen && client) {
      setFormData({
        company_name: client.company_name || '',
        client_name: client.client_name || '',
        email: client.email || '',
        phone: client.phone || '',
        website: client.website || '',
        industry: client.industry || '',
        tax_id: client.tax_id || '',
        preferred_contact: client.preferred_contact || '',
        street: client.street || '',
        street_number: client.street_number || '',
        city: client.city || '',
        state: client.state || '',
        zip_code: client.zip_code || '',
        country: client.country || '',
        internal_notes: client.internal_notes || '',
        status: client.status || 'active',
        business_certificate: client.business_certificate || ''
      });
      setOriginalEmail(client.email || ''); // Store original email
      setOriginalName(client.client_name || ''); // Store original name
      setError('');
    }
  }, [isOpen, client]);

  async function loadClientData() {
    setLoading(true);
    setError('');

    try {
      console.log('[ClientEditModal] Fetching client data...');
      
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (clientError) throw clientError;

      console.log('[ClientEditModal] Client data loaded:', clientData);

      setFormData({
        id: clientId,
        email: clientData.email || '',
        full_name: clientData.client_name || '',
        company_name: clientData.company_name || '',
        website: clientData.website || '',
        industry: clientData.industry || '',
        tax_id: clientData.tax_id || '',
        client_name: clientData.client_name || '',
        phone: clientData.phone || '',
        preferred_contact: clientData.preferred_contact || 'email',
        street: clientData.street || '',
        street_number: clientData.street_number || '',
        city: clientData.city || '',
        state: clientData.state || '',
        zip_code: clientData.zip_code || '',
        country: clientData.country || '',
        internal_notes: clientData.internal_notes || '',
        status: clientData.status || 'active'
      });
      
      // Store original email for comparison
      setOriginalEmail(clientData.email || '');
      setOriginalName(clientData.client_name || '');
    } catch (err: any) {
      console.error('[ClientEditModal] Error loading client data:', err);
      setError(`Failed to load client data: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      console.log('[ClientEditModal] Saving client data:', formData);
      
      // Check if email changed
      const emailChanged = formData.email.toLowerCase().trim() !== originalEmail.toLowerCase().trim();
      
      if (emailChanged) {
        console.log('[ClientEditModal] Email changed, updating via admin API...');
        
        // Get current session for authorization
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated');
        }

        // Call admin API to update email in all tables (auth.users, user_profiles, clients)
        const emailUpdateResponse = await fetch(`${baseUrl}/api/admin/update-client-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            clientId: clientId,
            newEmail: formData.email
          })
        });

        if (!emailUpdateResponse.ok) {
          const errorData = await emailUpdateResponse.json();
          throw new Error(errorData.error || 'Failed to update email');
        }

        const emailUpdateResult = await emailUpdateResponse.json();
        console.log('[ClientEditModal] Email updated successfully:', emailUpdateResult);
      }

      // Update all other client fields (excluding email since it's already updated if changed)
      const { error: clientError } = await supabase
        .from('clients')
        .update({
          company_name: formData.company_name,
          website: formData.website,
          industry: formData.industry,
          tax_id: formData.tax_id,
          client_name: formData.client_name,
          phone: formData.phone,
          preferred_contact: formData.preferred_contact,
          street: formData.street,
          street_number: formData.street_number,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zip_code,
          country: formData.country,
          internal_notes: formData.internal_notes,
          status: formData.status,
          updated_at: new Date().toISOString()
          // Note: NOT updating email here - it's handled by the admin API above
        })
        .eq('id', clientId);

      if (clientError) throw clientError;

      console.log('[ClientEditModal] Client data saved successfully');

      // Update user_profiles table (non-email fields)
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          full_name: formData.full_name || formData.client_name
          // Note: NOT updating email here - it's handled by the admin API above
        })
        .eq('id', clientId);

      if (profileError && profileError.code !== 'PGRST116') {
        console.warn('[ClientEditModal] Profile update warning:', profileError);
      }

      setSuccessMessage('✓ Changes saved successfully!');
      
      if (onSave) {
        onSave();
      }
      
      await loadClientData();
      
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('[ClientEditModal] Error saving client data:', err);
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  function handleInputChange(field: keyof ClientData, value: string) {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }

  const filteredCountries = COUNTRIES.filter(country =>
    country.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const filteredIndustries = INDUSTRIES.filter(industry =>
    industry.toLowerCase().includes(industrySearch.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998,
          backdropFilter: 'blur(4px)'
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          zIndex: 9999,
          width: '90%',
          maxWidth: '800px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '24px 32px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '22px',
            fontWeight: 600,
            color: '#111827',
            fontFamily: "'Poppins', sans-serif"
          }}>
            Edit Client
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              color: '#6B7280',
              cursor: 'pointer',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F3F4F6';
              e.currentTarget.style.color = '#111827';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#6B7280';
            }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #E5E7EB',
          padding: '0 32px',
          gap: '4px',
          flexShrink: 0,
          overflowX: 'auto'
        }}>
          <button
            onClick={() => setActiveTab('company')}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
              color: activeTab === 'company' ? '#1A1A1A' : '#6B7280',
              borderBottom: activeTab === 'company' ? '2px solid #1A1A1A' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginBottom: '-1px',
              whiteSpace: 'nowrap'
            }}
          >
            <Building2 size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
            Company
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
              color: activeTab === 'profile' ? '#1A1A1A' : '#6B7280',
              borderBottom: activeTab === 'profile' ? '2px solid #1A1A1A' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginBottom: '-1px',
              whiteSpace: 'nowrap'
            }}
          >
            <User size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
            Contact
          </button>
          <button
            onClick={() => setActiveTab('address')}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
              color: activeTab === 'address' ? '#1A1A1A' : '#6B7280',
              borderBottom: activeTab === 'address' ? '2px solid #1A1A1A' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginBottom: '-1px',
              whiteSpace: 'nowrap'
            }}
          >
            <MapPin size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
            Address
          </button>
          <button
            onClick={() => setActiveTab('internal')}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
              color: activeTab === 'internal' ? '#1A1A1A' : '#6B7280',
              borderBottom: activeTab === 'internal' ? '2px solid #1A1A1A' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginBottom: '-1px',
              whiteSpace: 'nowrap'
            }}
          >
            <FileText size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
            Internal
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: '32px',
          overflowY: 'auto',
          flex: 1,
          minHeight: 0
        }}>
          {loading ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#6B7280',
              fontSize: '14px'
            }}>
              Loading client data...
            </div>
          ) : (
            <>
              {/* Company Info Tab */}
              {activeTab === 'company' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#374151'
                      }}>
                        Company Name *
                      </label>
                      <input
                        type="text"
                        value={formData.company_name || ''}
                        onChange={(e) => handleInputChange('company_name', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          fontSize: '14px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '10px',
                          outline: 'none',
                          transition: 'border 0.2s ease'
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                        onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                      />
                    </div>

                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#374151'
                      }}>
                        Website
                      </label>
                      <input
                        type="url"
                        value={formData.website || ''}
                        onChange={(e) => handleInputChange('website', e.target.value)}
                        placeholder="https://example.com"
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          fontSize: '14px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '10px',
                          outline: 'none',
                          transition: 'border 0.2s ease'
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                        onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                      />
                    </div>

                    <div style={{ position: 'relative' }}>
                      <label style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#374151'
                      }}>
                        Industry
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          value={formData.industry || industrySearch}
                          onChange={(e) => {
                            setIndustrySearch(e.target.value);
                            setFormData({ ...formData, industry: '' });
                            setShowIndustryDropdown(true);
                          }}
                          onFocus={() => setShowIndustryDropdown(true)}
                          placeholder="Search or select"
                          style={{
                            width: '100%',
                            padding: '10px 14px 10px 38px',
                            fontSize: '14px',
                            border: '1px solid #E5E7EB',
                            borderRadius: '10px',
                            outline: 'none',
                            transition: 'border 0.2s ease'
                          }}
                          onFocusCapture={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                          onBlur={(e) => {
                            setTimeout(() => setShowIndustryDropdown(false), 200);
                            e.currentTarget.style.borderColor = '#E5E7EB';
                          }}
                        />
                        <Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        
                        {showIndustryDropdown && filteredIndustries.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            marginTop: '4px',
                            background: '#FFFFFF',
                            border: '1px solid #E5E7EB',
                            borderRadius: '10px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            zIndex: 1000
                          }}>
                            {filteredIndustries.map((industry) => (
                              <div
                                key={industry}
                                onClick={() => {
                                  setFormData({ ...formData, industry });
                                  setIndustrySearch('');
                                  setShowIndustryDropdown(false);
                                }}
                                style={{
                                  padding: '10px 14px',
                                  fontSize: '14px',
                                  color: '#1A1A1A',
                                  cursor: 'pointer',
                                  transition: 'background 0.15s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                {industry}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#374151'
                      }}>
                        Tax ID / VAT Number
                      </label>
                      <input
                        type="text"
                        value={formData.tax_id || ''}
                        onChange={(e) => handleInputChange('tax_id', e.target.value)}
                        placeholder="e.g., CHE-123.456.789"
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          fontSize: '14px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '10px',
                          outline: 'none',
                          transition: 'border 0.2s ease'
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                        onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#374151'
                    }}>
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => handleInputChange('status', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        fontSize: '14px',
                        border: '1px solid #E5E7EB',
                        borderRadius: '10px',
                        outline: 'none',
                        backgroundColor: '#FFFFFF',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Contact Info Tab */}
              {activeTab === 'profile' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#374151'
                      }}>
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={formData.client_name || ''}
                        onChange={(e) => handleInputChange('client_name', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          fontSize: '14px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '10px',
                          outline: 'none',
                          transition: 'border 0.2s ease'
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                        onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                      />
                    </div>

                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#374151'
                      }}>
                        Email Address *
                      </label>
                      <input
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          fontSize: '14px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '10px',
                          outline: 'none',
                          transition: 'border 0.2s ease'
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                        onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                      />
                    </div>

                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#374151'
                      }}>
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={formData.phone || ''}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        placeholder="+1 (555) 123-4567"
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          fontSize: '14px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '10px',
                          outline: 'none',
                          transition: 'border 0.2s ease'
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                        onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                      />
                    </div>

                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#374151'
                      }}>
                        Preferred Contact
                      </label>
                      <select
                        value={formData.preferred_contact || 'email'}
                        onChange={(e) => handleInputChange('preferred_contact', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          fontSize: '14px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '10px',
                          outline: 'none',
                          backgroundColor: '#FFFFFF',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Address Tab */}
              {activeTab === 'address' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#374151'
                      }}>
                        Street
                      </label>
                      <input
                        type="text"
                        value={formData.street || ''}
                        onChange={(e) => handleInputChange('street', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          fontSize: '14px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '10px',
                          outline: 'none',
                          transition: 'border 0.2s ease'
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                        onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                      />
                    </div>

                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#374151'
                      }}>
                        Number
                      </label>
                      <input
                        type="text"
                        value={formData.street_number || ''}
                        onChange={(e) => handleInputChange('street_number', e.target.value)}
                        placeholder="No."
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          fontSize: '14px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '10px',
                          outline: 'none',
                          transition: 'border 0.2s ease'
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                        onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#374151'
                      }}>
                        City
                      </label>
                      <input
                        type="text"
                        value={formData.city || ''}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          fontSize: '14px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '10px',
                          outline: 'none',
                          transition: 'border 0.2s ease'
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                        onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                      />
                    </div>

                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#374151'
                      }}>
                        State/Province
                      </label>
                      <input
                        type="text"
                        value={formData.state || ''}
                        onChange={(e) => handleInputChange('state', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          fontSize: '14px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '10px',
                          outline: 'none',
                          transition: 'border 0.2s ease'
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                        onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                      />
                    </div>

                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#374151'
                      }}>
                        ZIP/Postal Code
                      </label>
                      <input
                        type="text"
                        value={formData.zip_code || ''}
                        onChange={(e) => handleInputChange('zip_code', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          fontSize: '14px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '10px',
                          outline: 'none',
                          transition: 'border 0.2s ease'
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                        onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                      />
                    </div>

                    <div style={{ position: 'relative' }}>
                      <label style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#374151'
                      }}>
                        Country
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          value={formData.country || countrySearch}
                          onChange={(e) => {
                            setCountrySearch(e.target.value);
                            setFormData({ ...formData, country: '' });
                            setShowCountryDropdown(true);
                          }}
                          onFocus={() => setShowCountryDropdown(true)}
                          placeholder="Search or select"
                          style={{
                            width: '100%',
                            padding: '10px 14px 10px 38px',
                            fontSize: '14px',
                            border: '1px solid #E5E7EB',
                            borderRadius: '10px',
                            outline: 'none',
                            transition: 'border 0.2s ease'
                          }}
                          onFocusCapture={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                          onBlur={(e) => {
                            setTimeout(() => setShowCountryDropdown(false), 200);
                            e.currentTarget.style.borderColor = '#E5E7EB';
                          }}
                        />
                        <Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        
                        {showCountryDropdown && filteredCountries.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            marginTop: '4px',
                            background: '#FFFFFF',
                            border: '1px solid #E5E7EB',
                            borderRadius: '10px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            zIndex: 1000
                          }}>
                            {filteredCountries.map((country) => (
                              <div
                                key={country}
                                onClick={() => {
                                  setFormData({ ...formData, country });
                                  setCountrySearch('');
                                  setShowCountryDropdown(false);
                                }}
                                style={{
                                  padding: '10px 14px',
                                  fontSize: '14px',
                                  color: '#1A1A1A',
                                  cursor: 'pointer',
                                  transition: 'background 0.15s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                {country}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Internal Notes Tab */}
              {activeTab === 'internal' && (
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#374151'
                  }}>
                    Internal Notes (Admin Only)
                  </label>
                  <textarea
                    value={formData.internal_notes || ''}
                    onChange={(e) => handleInputChange('internal_notes', e.target.value)}
                    rows={8}
                    placeholder="Add any internal notes about this client..."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '14px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: "'Inter', sans-serif"
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                  />
                </div>
              )}

              {/* Messages */}
              {error && (
                <div style={{
                  marginTop: '20px',
                  padding: '12px 16px',
                  backgroundColor: '#FEE2E2',
                  border: '1px solid #FCA5A5',
                  borderRadius: '10px',
                  color: '#991B1B',
                  fontSize: '14px'
                }}>
                  {error}
                </div>
              )}

              {successMessage && (
                <div style={{
                  marginTop: '20px',
                  padding: '12px 16px',
                  backgroundColor: '#D1FAE5',
                  border: '1px solid #6EE7B7',
                  borderRadius: '10px',
                  color: '#065F46',
                  fontSize: '14px',
                  fontWeight: 600
                }}>
                  {successMessage}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px 32px',
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          flexShrink: 0
        }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 600,
              border: '1px solid #E5E7EB',
              borderRadius: '10px',
              backgroundColor: '#FFFFFF',
              color: '#374151',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!saving) e.currentTarget.style.backgroundColor = '#F9FAFB';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 600,
              border: 'none',
              borderRadius: '10px',
              backgroundColor: '#1A1A1A',
              color: '#FFFFFF',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!saving) e.currentTarget.style.backgroundColor = '#C5B289';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1A1A1A';
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}







