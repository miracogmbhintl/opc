import { useState, useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabase-client';
import { baseUrl } from '../lib/base-url';
import { ArrowLeft, Search, Building2, User, Mail, Phone, Globe, Briefcase, MapPin, StickyNote, FileText, Upload, X } from 'lucide-react';
import { Button } from './ui/button';

interface Client {
  id: string;
  company_name: string;
  client_name: string;
  email: string;
  phone?: string;
  created_at: string;
}

interface FormData {
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  website: string;
  industry: string;
  taxId: string;
  preferredContact: 'email' | 'phone';
  street: string;
  streetNumber: string;
  city: string;
  zipCode: string;
  state: string;
  country: string;
  internalNotes: string;
}

// Common industries list
const INDUSTRIES = [
  'Accommodation & Food Services',
  'Administrative Services',
  'Agriculture & Farming',
  'Arts & Entertainment',
  'Automotive',
  'Construction',
  'Consulting',
  'Education',
  'Energy & Utilities',
  'Finance & Insurance',
  'Healthcare',
  'Hospitality',
  'Information Technology',
  'Legal Services',
  'Manufacturing',
  'Marketing & Advertising',
  'Media & Communications',
  'Non-Profit',
  'Professional Services',
  'Real Estate',
  'Retail',
  'Technology',
  'Telecommunications',
  'Transportation & Logistics',
  'Travel & Tourism',
  'Wholesale Trade',
  'Other'
];

// Common countries list
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

export default function AdminClientCreator() {
  const [formData, setFormData] = useState<FormData>({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    website: '',
    industry: '',
    taxId: '',
    preferredContact: 'email',
    street: '',
    streetNumber: '',
    city: '',
    zipCode: '',
    state: '',
    country: '',
    internalNotes: ''
  });

  const [businessCertificate, setBusinessCertificate] = useState<File | null>(null);
  const [certificateUrl, setCertificateUrl] = useState<string | null>(null);
  const [uploadingCertificate, setUploadingCertificate] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Search states
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [industrySearch, setIndustrySearch] = useState('');
  const [showIndustryDropdown, setShowIndustryDropdown] = useState(false);

  useEffect(() => {
    checkUserRole();
    loadClients();
  }, []);

  const checkUserRole = async () => {
    const { data: { user } } = await getSupabaseClient().auth.getUser();
    if (user) {
      const { data: profile } = await getSupabaseClient()
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      setUserRole(profile?.role || null);
    }
  };

  const loadClients = async () => {
    setLoadingClients(true);
    try {
      const { data, error } = await getSupabaseClient()
        .from('clients')
        .select('id, company_name, client_name, email, phone, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading clients:', error);
      } else {
        setClients(data || []);
      }
    } catch (err) {
      console.error('Error loading clients:', err);
    } finally {
      setLoadingClients(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type (PDF, images)
      const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!validTypes.includes(file.type)) {
        setMessage({ 
          type: 'error', 
          text: 'Please upload a PDF, JPG, or PNG file' 
        });
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setMessage({ 
          type: 'error', 
          text: 'File size must be less than 10MB' 
        });
        return;
      }

      setBusinessCertificate(file);
      setMessage(null);
    }
  };

  const removeFile = () => {
    setBusinessCertificate(null);
    setCertificateUrl(null);
  };

  const uploadCertificate = async (clientId: string): Promise<string | null> => {
    if (!businessCertificate) return null;

    setUploadingCertificate(true);
    try {
      const fileExt = businessCertificate.name.split('.').pop();
      const fileName = `${clientId}/business-certificate-${Date.now()}.${fileExt}`;

      const { data, error } = await getSupabaseClient().storage
        .from('client-documents')
        .upload(fileName, businessCertificate, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Error uploading certificate:', error);
        return null;
      }

      const { data: { publicUrl } } = getSupabaseClient()
        .from('client-documents')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (err) {
      console.error('Error uploading certificate:', err);
      return null;
    } finally {
      setUploadingCertificate(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.companyName || !formData.contactPerson || !formData.email) {
      setMessage({ type: 'error', text: 'Please fill in all required fields (Company Name, Contact Person, Email)' });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Get current session token
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session) {
        setMessage({ type: 'error', text: 'Session expired. Please log in again.' });
        setLoading(false);
        return;
      }

      // Create payload with all fields
      const payload = {
        companyName: formData.companyName.trim(),
        fullName: formData.contactPerson.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || null,
        website: formData.website.trim() || null,
        industry: formData.industry || null,
        taxId: formData.taxId.trim() || null,
        preferredContact: formData.preferredContact,
        address: {
          street: formData.street.trim() || null,
          streetNumber: formData.streetNumber.trim() || null,
          city: formData.city.trim() || null,
          zipCode: formData.zipCode.trim() || null,
          state: formData.state.trim() || null,
          country: formData.country || null
        },
        internalNotes: formData.internalNotes.trim() || null
      };

      const response = await fetch(`${baseUrl}/api/admin/create-client-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        let successMessage = '✓ Client account created successfully!';

        // Upload certificate if provided
        if (businessCertificate && result.userId) {
          const uploadedUrl = await uploadCertificate(result.userId);
          if (uploadedUrl) {
            // Update client record with certificate URL
            await getSupabaseClient()
              .from('clients')
              .update({ business_certificate_url: uploadedUrl })
              .eq('user_id', result.userId);
            
            successMessage += ' Business certificate uploaded.';
          } else {
            successMessage += ' Warning: Certificate upload failed.';
          }
        }

        successMessage += ' An email with password setup instructions has been sent.';

        setMessage({ 
          type: 'success', 
          text: successMessage
        });
        
        // Clear form
        setFormData({
          companyName: '',
          contactPerson: '',
          email: '',
          phone: '',
          website: '',
          industry: '',
          taxId: '',
          preferredContact: 'email',
          street: '',
          streetNumber: '',
          city: '',
          zipCode: '',
          state: '',
          country: '',
          internalNotes: ''
        });
        setCountrySearch('');
        setIndustrySearch('');
        setBusinessCertificate(null);
        setCertificateUrl(null);

        // Reload clients list
        await loadClients();

        // Scroll to top to show success message
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setMessage({ 
          type: 'error', 
          text: `Error: ${result.error || 'Unknown error occurred'}` 
        });
      }
    } catch (err) {
      setMessage({ 
        type: 'error', 
        text: `Error: ${(err as Error).message}` 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter countries based on search
  const filteredCountries = COUNTRIES.filter(country =>
    country.toLowerCase().includes(countrySearch.toLowerCase())
  );

  // Filter industries based on search
  const filteredIndustries = INDUSTRIES.filter(industry =>
    industry.toLowerCase().includes(industrySearch.toLowerCase())
  );

  // Only show to owner/admin
  if (!userRole || !['owner', 'admin'].includes(userRole)) {
    return null;
  }

  return (
    <div style={{
      padding: '0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
    }}>
      {/* Back Button */}
      <a
        href={`${baseUrl}/miraka-co-portal/clients`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          background: 'transparent',
          color: '#6B7280',
          fontSize: '14px',
          fontWeight: 500,
          borderRadius: '8px',
          textDecoration: 'none',
          border: '1px solid #E5E7EB',
          marginBottom: '24px',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#F9FAFB';
          e.currentTarget.style.color = '#1A1A1A';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#6B7280';
        }}
      >
        <ArrowLeft size={16} />
        Back to Clients
      </a>

      {/* Success/Error Message */}
      {message && (
        <div style={{
          padding: '16px 20px',
          borderRadius: '10px',
          marginBottom: '32px',
          backgroundColor: message.type === 'success' ? '#DCFCE7' : '#FEE2E2',
          border: `1px solid ${message.type === 'success' ? '#86EFAC' : '#FCA5A5'}`,
          color: message.type === 'success' ? '#166534' : '#991B1B',
          fontSize: '14px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
        }}>
          {message.text}
        </div>
      )}

      {/* Form Card */}
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '14px',
        padding: '40px',
        marginBottom: '32px',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
      }}>
        <form onSubmit={handleSubmit}>
          {/* Company Information */}
          <div style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <Building2 size={20} color="#1A1A1A" />
              <h2 style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#1A1A1A',
                margin: 0
              }}>
                Company Information
              </h2>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '20px'
            }}>
              {/* Company Name */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#6B7280',
                  marginBottom: '6px'
                }}>
                  Company Name *
                </label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  required
                  placeholder="Enter company name"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '10px',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                />
              </div>

              {/* Website */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#6B7280',
                  marginBottom: '6px'
                }}>
                  Website
                </label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="https://example.com"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '10px',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                />
              </div>

              {/* Industry - Searchable Dropdown */}
              <div style={{ position: 'relative' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#6B7280',
                  marginBottom: '6px'
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
                    placeholder="Search or select industry"
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 38px',
                      fontSize: '14px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      outline: 'none',
                      transition: 'border-color 0.15s ease'
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

              {/* Tax ID Number */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#6B7280',
                  marginBottom: '6px'
                }}>
                  Tax ID / VAT Number
                </label>
                <input
                  type="text"
                  name="taxId"
                  value={formData.taxId}
                  onChange={handleChange}
                  placeholder="e.g., CHE-123.456.789"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '10px',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                />
              </div>
            </div>
          </div>

          {/* Contact Person */}
          <div style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <User size={20} color="#1A1A1A" />
              <h2 style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#1A1A1A',
                margin: 0
              }}>
                Contact Person
              </h2>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '20px'
            }}>
              {/* Full Name */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#6B7280',
                  marginBottom: '6px'
                }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  name="contactPerson"
                  value={formData.contactPerson}
                  onChange={handleChange}
                  required
                  placeholder="Enter contact person name"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '10px',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                />
              </div>

              {/* Email */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#6B7280',
                  marginBottom: '6px'
                }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="email@example.com"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '10px',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                />
              </div>

              {/* Phone */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#6B7280',
                  marginBottom: '6px'
                }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1 (555) 123-4567"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '10px',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                />
              </div>

              {/* Preferred Contact Method */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#6B7280',
                  marginBottom: '6px'
                }}>
                  Preferred Contact Method
                </label>
                <select
                  name="preferredContact"
                  value={formData.preferredContact}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '10px',
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                </select>
              </div>
            </div>
          </div>

          {/* Address */}
          <div style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <MapPin size={20} color="#1A1A1A" />
              <h2 style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#1A1A1A',
                margin: 0
              }}>
                Address
              </h2>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '20px'
            }}>
              {/* Street & Number */}
              <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#6B7280',
                    marginBottom: '6px'
                  }}>
                    Street
                  </label>
                  <input
                    type="text"
                    name="street"
                    value={formData.street}
                    onChange={handleChange}
                    placeholder="Enter street name"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '14px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      outline: 'none',
                      transition: 'border-color 0.15s ease'
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#6B7280',
                    marginBottom: '6px'
                  }}>
                    Number
                  </label>
                  <input
                    type="text"
                    name="streetNumber"
                    value={formData.streetNumber}
                    onChange={handleChange}
                    placeholder="No."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '14px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      outline: 'none',
                      transition: 'border-color 0.15s ease'
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                  />
                </div>
              </div>

              {/* City */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#6B7280',
                  marginBottom: '6px'
                }}>
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Enter city"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '10px',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                />
              </div>

              {/* State/Province */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#6B7280',
                  marginBottom: '6px'
                }}>
                  State/Province
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="Enter state or province"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '10px',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                />
              </div>

              {/* ZIP Code */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#6B7280',
                  marginBottom: '6px'
                }}>
                  ZIP/Postal Code
                </label>
                <input
                  type="text"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleChange}
                  placeholder="Enter ZIP code"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '10px',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                />
              </div>

              {/* Country - Searchable Dropdown */}
              <div style={{ position: 'relative' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#6B7280',
                  marginBottom: '6px'
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
                    placeholder="Search or select country"
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 38px',
                      fontSize: '14px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      outline: 'none',
                      transition: 'border-color 0.15s ease'
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

          {/* Internal Notes & Business Certificate - Side by Side */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '24px'
            }}>
              {/* Internal Notes */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <StickyNote size={20} color="#1A1A1A" />
                  <h2 style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    margin: 0
                  }}>
                    Internal Notes
                  </h2>
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#6B7280',
                    marginBottom: '6px'
                  }}>
                    Notes (Only visible to admins)
                  </label>
                  <textarea
                    name="internalNotes"
                    value={formData.internalNotes}
                    onChange={handleChange}
                    rows={5}
                    placeholder="Add any internal notes about this client..."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '14px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
                      transition: 'border-color 0.15s ease'
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                  />
                </div>
              </div>

              {/* Business Certificate Upload */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <FileText size={20} color="#1A1A1A" />
                  <h2 style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    margin: 0
                  }}>
                    Business Certificate
                  </h2>
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#6B7280',
                    marginBottom: '6px'
                  }}>
                    Upload Document (PDF, JPG, PNG - Max 10MB)
                  </label>
                  
                  {!businessCertificate ? (
                    <label style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      height: '166px',
                      border: '2px dashed #E5E7EB',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      backgroundColor: '#FAFAFA'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#1A1A1A';
                      e.currentTarget.style.backgroundColor = '#F9FAFB';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#E5E7EB';
                      e.currentTarget.style.backgroundColor = '#FAFAFA';
                    }}
                    >
                      <Upload size={32} color="#9CA3AF" style={{ marginBottom: '8px' }} />
                      <span style={{ fontSize: '14px', color: '#6B7280', marginBottom: '4px' }}>
                        Click to upload or drag and drop
                      </span>
                      <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
                        PDF, JPG, PNG (max 10MB)
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />
                    </label>
                  ) : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      backgroundColor: '#F9FAFB'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText size={20} color="#1A1A1A" />
                        <div>
                          <div style={{ fontSize: '14px', color: '#1A1A1A', fontWeight: 500 }}>
                            {businessCertificate.name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6B7280' }}>
                            {(businessCertificate.size / 1024 / 1024).toFixed(2)} MB
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeFile}
                        style={{
                          padding: '6px',
                          border: 'none',
                          borderRadius: '6px',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <X size={16} color="#6B7280" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <a
              href={`${baseUrl}/miraka-co-portal/clients`}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 500,
                border: '1px solid #E5E7EB',
                borderRadius: '10px',
                backgroundColor: '#FFFFFF',
                color: '#6B7280',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                display: 'inline-block'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
            >
              Cancel
            </a>
            <button
              type="submit"
              disabled={loading || uploadingCertificate}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 500,
                border: 'none',
                borderRadius: '10px',
                backgroundColor: (loading || uploadingCertificate) ? '#9CA3AF' : '#1A1A1A',
                color: '#FFFFFF',
                cursor: (loading || uploadingCertificate) ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => !(loading || uploadingCertificate) && (e.currentTarget.style.backgroundColor = '#2A2A2A')}
              onMouseLeave={(e) => !(loading || uploadingCertificate) && (e.currentTarget.style.backgroundColor = '#1A1A1A')}
            >
              {loading ? 'Creating Account...' : uploadingCertificate ? 'Uploading...' : 'Create Client Account'}
            </button>
          </div>
        </form>
      </div>

      {/* Recently Created Clients */}
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #E5E7EB'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 600,
            color: '#1A1A1A'
          }}>
            Recently Created Clients
          </h2>
        </div>

        {loadingClients ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#6B7280',
            fontSize: '14px'
          }}>
            Loading clients...
          </div>
        ) : clients.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#6B7280',
            fontSize: '14px'
          }}>
            No clients created yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <th style={{
                    padding: '12px 24px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6B7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Company Name
                  </th>
                  <th style={{
                    padding: '12px 24px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6B7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Contact Person
                  </th>
                  <th style={{
                    padding: '12px 24px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6B7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Email
                  </th>
                  <th style={{
                    padding: '12px 24px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6B7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Phone
                  </th>
                  <th style={{
                    padding: '12px 24px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6B7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {clients.slice(0, 10).map((client, index) => (
                  <tr
                    key={client.id}
                    style={{
                      borderBottom: index < Math.min(clients.length, 10) - 1 ? '1px solid #F9FAFB' : 'none',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{
                      padding: '14px 24px',
                      fontSize: '14px',
                      color: '#1A1A1A',
                      fontWeight: 500
                    }}>
                      {client.company_name}
                    </td>
                    <td style={{
                      padding: '14px 24px',
                      fontSize: '14px',
                      color: '#1A1A1A'
                    }}>
                      {client.client_name}
                    </td>
                    <td style={{
                      padding: '14px 24px',
                      fontSize: '14px',
                      color: '#6B7280'
                    }}>
                      {client.email}
                    </td>
                    <td style={{
                      padding: '14px 24px',
                      fontSize: '14px',
                      color: '#6B7280'
                    }}>
                      {client.phone || '—'}
                    </td>
                    <td style={{
                      padding: '14px 24px',
                      fontSize: '14px',
                      color: '#6B7280'
                    }}>
                      {formatDate(client.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

