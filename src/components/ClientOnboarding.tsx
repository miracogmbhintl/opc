import { useState, useEffect } from 'react';
import { Plus, X, Upload, Check, Save } from 'lucide-react';
import { executeEnhancedOnboarding, getStaffMembers, type EnhancedOnboardingParams } from '../lib/supabase-onboarding-enhanced';

interface ClientOnboardingProps {
  baseUrl: string;
}

interface StaffMember {
  id: string;
  name: string;
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  deadline: string;
  assignedTo: string;
}

const AUTOSAVE_KEY = 'client_onboarding_draft';
const AUTOSAVE_INTERVAL = 3000; // 3 seconds

export default function ClientOnboarding({ baseUrl }: ClientOnboardingProps) {
  // State Management
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [onboardingResult, setOnboardingResult] = useState<any>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Client Info
  const [companyName, setCompanyName] = useState('');
  const [clientName, setClientName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'suspended' | 'test'>('active');
  const [language, setLanguage] = useState('de');
  const [timezone, setTimezone] = useState('Europe/Berlin');
  const [preferredContactMethod, setPreferredContactMethod] = useState('email');

  // Tags
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [customTags, setCustomTags] = useState<string[]>([]);

  const predefinedTags = ['VIP', 'High Priority', 'Recurring', 'Agency', 'Startup', 'Enterprise', 'E-Commerce', 'SaaS'];

  // SEO & Business
  const [domain, setDomain] = useState('');
  const [website, setWebsite] = useState('');
  const [gmbProfileUrl, setGmbProfileUrl] = useState('');
  const [instagram, setInstagram] = useState('');
  const [linkedin, setLinkedin] = useState('');

  // Branding
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#1A1A1A');
  const [secondaryColor, setSecondaryColor] = useState('#FFFFFF');
  const [accentColor, setAccentColor] = useState('#F37021');
  const [darkModeDefault, setDarkModeDefault] = useState(false);

  // Client Settings
  const [notifyOnMilestones, setNotifyOnMilestones] = useState(true);
  const [notifyOnNewFiles, setNotifyOnNewFiles] = useState(true);
  const [notifyOnNotes, setNotifyOnNotes] = useState(true);
  const [allowClientBrandCustomization, setAllowClientBrandCustomization] = useState(false);

  // Project Info
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectCategory, setProjectCategory] = useState('Website');
  const [projectManagerId, setProjectManagerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');

  // Team Members
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);

  // Milestones
  const [milestoneMode, setMilestoneMode] = useState<'manual' | 'ai_assisted'>('ai_assisted');
  const [autoGenerateTimeline, setAutoGenerateTimeline] = useState(true);
  const [manualMilestones, setManualMilestones] = useState<Milestone[]>([]);

  // Checklist
  const [checklist, setChecklist] = useState([
    { label: 'Logo and Branding', checked: false },
    { label: 'Content and Copy', checked: false },
    { label: 'Images and Media', checked: false },
    { label: 'Access Credentials', checked: false },
    { label: 'Domain and Hosting', checked: false },
    { label: 'Social Media', checked: false },
    { label: 'Contract Signed', checked: false },
    { label: 'Deposit Received', checked: false },
  ]);

  // Notes
  const [internalNotes, setInternalNotes] = useState('');
  const [clientVisibleNotes, setClientVisibleNotes] = useState('');

  // Files (not saved in localStorage due to size)
  const [initialFiles, setInitialFiles] = useState<Array<{
    file: File;
    fileType: 'contract' | 'email_log' | 'reference' | 'briefing' | 'legal' | 'asset' | 'miscellaneous';
    description?: string;
  }>>([]);

  // Load staff members
  useEffect(() => {
    const loadStaff = async () => {
      const staff = await getStaffMembers();
      setStaffMembers(staff);
    };
    loadStaff();
  }, []);

  // Load saved draft on mount
  useEffect(() => {
    const loadDraft = () => {
      try {
        const saved = localStorage.getItem(AUTOSAVE_KEY);
        if (saved) {
          const draft = JSON.parse(saved);
          setCompanyName(draft.companyName || '');
          setClientName(draft.clientName || '');
          setEmail(draft.email || '');
          setPhone(draft.phone || '');
          setContactPerson(draft.contactPerson || '');
          setStatus(draft.status || 'active');
          setLanguage(draft.language || 'de');
          setTimezone(draft.timezone || 'Europe/Berlin');
          setPreferredContactMethod(draft.preferredContactMethod || 'email');
          setSelectedTags(draft.selectedTags || []);
          setCustomTags(draft.customTags || []);
          setDomain(draft.domain || '');
          setWebsite(draft.website || '');
          setGmbProfileUrl(draft.gmbProfileUrl || '');
          setInstagram(draft.instagram || '');
          setLinkedin(draft.linkedin || '');
          setPrimaryColor(draft.primaryColor || '#1A1A1A');
          setSecondaryColor(draft.secondaryColor || '#FFFFFF');
          setAccentColor(draft.accentColor || '#F37021');
          setDarkModeDefault(draft.darkModeDefault || false);
          setNotifyOnMilestones(draft.notifyOnMilestones ?? true);
          setNotifyOnNewFiles(draft.notifyOnNewFiles ?? true);
          setNotifyOnNotes(draft.notifyOnNotes ?? true);
          setAllowClientBrandCustomization(draft.allowClientBrandCustomization || false);
          setProjectTitle(draft.projectTitle || '');
          setProjectDescription(draft.projectDescription || '');
          setProjectCategory(draft.projectCategory || 'Website');
          setProjectManagerId(draft.projectManagerId || '');
          setStartDate(draft.startDate || '');
          setDeadline(draft.deadline || '');
          setSelectedTeamMembers(draft.selectedTeamMembers || []);
          setMilestoneMode(draft.milestoneMode || 'ai_assisted');
          setAutoGenerateTimeline(draft.autoGenerateTimeline ?? true);
          setManualMilestones(draft.manualMilestones || []);
          setChecklist(draft.checklist || checklist);
          setInternalNotes(draft.internalNotes || '');
          setClientVisibleNotes(draft.clientVisibleNotes || '');
          setLastSaved(new Date(draft.savedAt));
          console.log('✅ Draft loaded from autosave');
        }
      } catch (error) {
        console.error('Failed to load draft:', error);
      }
    };
    loadDraft();
  }, []);

  // Autosave effect
  useEffect(() => {
    const saveDraft = () => {
      try {
        setIsSaving(true);
        const draft = {
          companyName,
          clientName,
          email,
          phone,
          contactPerson,
          status,
          language,
          timezone,
          preferredContactMethod,
          selectedTags,
          customTags,
          domain,
          website,
          gmbProfileUrl,
          instagram,
          linkedin,
          primaryColor,
          secondaryColor,
          accentColor,
          darkModeDefault,
          notifyOnMilestones,
          notifyOnNewFiles,
          notifyOnNotes,
          allowClientBrandCustomization,
          projectTitle,
          projectDescription,
          projectCategory,
          projectManagerId,
          startDate,
          deadline,
          selectedTeamMembers,
          milestoneMode,
          autoGenerateTimeline,
          manualMilestones,
          checklist,
          internalNotes,
          clientVisibleNotes,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(draft));
        setLastSaved(new Date());
        setTimeout(() => setIsSaving(false), 500);
      } catch (error) {
        console.error('Failed to save draft:', error);
        setIsSaving(false);
      }
    };

    const timer = setTimeout(saveDraft, AUTOSAVE_INTERVAL);
    return () => clearTimeout(timer);
  }, [
    companyName, clientName, email, phone, contactPerson, status, language, timezone,
    preferredContactMethod, selectedTags, customTags, domain, website, gmbProfileUrl,
    instagram, linkedin, primaryColor, secondaryColor, accentColor, darkModeDefault,
    notifyOnMilestones, notifyOnNewFiles, notifyOnNotes, allowClientBrandCustomization,
    projectTitle, projectDescription, projectCategory, projectManagerId, startDate, deadline,
    selectedTeamMembers, milestoneMode, autoGenerateTimeline, manualMilestones, checklist,
    internalNotes, clientVisibleNotes
  ]);

  // Tag Management
  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const addCustomTag = () => {
    if (customTagInput.trim() && !customTags.includes(customTagInput.trim())) {
      setCustomTags([...customTags, customTagInput.trim()]);
      setCustomTagInput('');
    }
  };

  const removeCustomTag = (tag: string) => {
    setCustomTags(customTags.filter(t => t !== tag));
  };

  // Milestone Management
  const addMilestone = () => {
    setManualMilestones([
      ...manualMilestones,
      {
        id: `milestone-${Date.now()}`,
        title: '',
        description: '',
        deadline: '',
        assignedTo: '',
      },
    ]);
  };

  const updateMilestone = (id: string, field: string, value: string) => {
    setManualMilestones(
      manualMilestones.map(m => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const removeMilestone = (id: string) => {
    setManualMilestones(manualMilestones.filter(m => m.id !== id));
  };

  // File Management
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fileType: any) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => ({
        file,
        fileType,
        description: '',
      }));
      setInitialFiles([...initialFiles, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setInitialFiles(initialFiles.filter((_, i) => i !== index));
  };

  // Clear draft
  const clearDraft = () => {
    localStorage.removeItem(AUTOSAVE_KEY);
    setLastSaved(null);
  };

  // Validation - PROJECT MANAGER IS NOW OPTIONAL
  const isFormValid = () => {
    return companyName && clientName && email && projectTitle;
  };

  // Handle Submit
  const handleSubmit = async () => {
    if (!isFormValid()) {
      alert('Please fill in all required fields: Company Name, Client Name, Email, and Project Title');
      return;
    }

    setIsSubmitting(true);

    try {
      const params: EnhancedOnboardingParams = {
        companyName,
        clientName,
        email,
        phone,
        contactPerson: contactPerson || clientName,
        status,
        language,
        timezone,
        preferredContactMethod,
        tags: selectedTags,
        customTags,
        domain,
        website,
        gmbProfileUrl,
        instagram,
        linkedin,
        logoFile: logoFile || undefined,
        primaryColor,
        secondaryColor,
        accentColor,
        darkModeDefault,
        notifyOnMilestones,
        notifyOnNewFiles,
        notifyOnNotes,
        allowClientBrandCustomization,
        projectTitle,
        projectDescription,
        projectCategory,
        projectManagerId, // Optional now
        startDate,
        deadline,
        teamMemberIds: selectedTeamMembers,
        milestoneMode,
        autoGenerateTimeline,
        manualMilestones: manualMilestones.map(m => ({
          title: m.title,
          description: m.description,
          deadline: m.deadline,
          assignedTo: m.assignedTo,
        })),
        checklist,
        internalNotes,
        clientVisibleNotes,
        initialFiles,
      };

      const result = await executeEnhancedOnboarding(params, baseUrl);

      if (result.success) {
        clearDraft(); // Clear draft on success
        setOnboardingResult(result);
        setShowSuccess(true);
      } else {
        alert(`Onboarding failed: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess && onboardingResult) {
    return (
      <div style={{ minHeight: '100vh', background: '#F2F2F2', padding: '40px 20px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '6px',
            padding: '40px',
            border: '1px solid #E5E5E5',
          }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#22C55E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <Check size={32} style={{ color: '#FFFFFF', strokeWidth: 2 }} />
              </div>
              <h1 style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: '28px',
                fontWeight: 600,
                color: '#1A1A1A',
                marginBottom: '8px',
              }}>
                Client Onboarding Complete!
              </h1>
              <p style={{
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontSize: '15px',
                color: '#6B6B6B',
              }}>
                The client account and project have been successfully created.
              </p>
            </div>

            <div style={{
              background: '#FAFAFA',
              borderRadius: '6px',
              padding: '24px',
              marginBottom: '24px',
            }}>
              <h3 style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: '16px',
                fontWeight: 600,
                color: '#1A1A1A',
                marginBottom: '16px',
              }}>
                Client Details
              </h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '14px', color: '#6B6B6B' }}>Client Name:</span>
                  <span style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '14px', color: '#1A1A1A', fontWeight: 600 }}>{clientName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '14px', color: '#6B6B6B' }}>Company:</span>
                  <span style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '14px', color: '#1A1A1A', fontWeight: 600 }}>{companyName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '14px', color: '#6B6B6B' }}>Email:</span>
                  <span style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '14px', color: '#1A1A1A', fontWeight: 600 }}>{email}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '14px', color: '#6B6B6B' }}>Temporary Password:</span>
                  <span style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '14px', color: '#F37021', fontWeight: 600 }}>{onboardingResult.temporaryPassword}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '14px', color: '#6B6B6B' }}>Login URL:</span>
                  <span style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '14px', color: '#1A1A1A', fontWeight: 600 }}>{baseUrl}</span>
                </div>
              </div>
            </div>

            <div style={{
              background: '#FAFAFA',
              borderRadius: '6px',
              padding: '24px',
              marginBottom: '32px',
            }}>
              <h3 style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: '16px',
                fontWeight: 600,
                color: '#1A1A1A',
                marginBottom: '16px',
              }}>
                Project Details
              </h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '14px', color: '#6B6B6B' }}>Project Title:</span>
                  <span style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '14px', color: '#1A1A1A', fontWeight: 600 }}>{projectTitle}</span>
                </div>
                {startDate && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '14px', color: '#6B6B6B' }}>Start Date:</span>
                    <span style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '14px', color: '#1A1A1A', fontWeight: 600 }}>{startDate}</span>
                  </div>
                )}
                {deadline && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '14px', color: '#6B6B6B' }}>Deadline:</span>
                    <span style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '14px', color: '#1A1A1A', fontWeight: 600 }}>{deadline}</span>
                  </div>
                )}
                {projectManagerId && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '14px', color: '#6B6B6B' }}>Project Manager:</span>
                    <span style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '14px', color: '#1A1A1A', fontWeight: 600 }}>
                      {staffMembers.find(s => s.id === projectManagerId)?.name || 'N/A'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <button
                onClick={() => {
                  const credentials = `Client Portal Credentials\n\nEmail: ${email}\nPassword: ${onboardingResult.temporaryPassword}\nLogin URL: ${baseUrl}`;
                  navigator.clipboard.writeText(credentials);
                  alert('Credentials copied to clipboard!');
                }}
                style={{
                  padding: '12px 24px',
                  background: '#1A1A1A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Copy Credentials
              </button>
              <button
                onClick={() => window.location.href = `${baseUrl}/admin/client/${onboardingResult.client.id}`}
                style={{
                  padding: '12px 24px',
                  background: '#F37021',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Go to Client Detail
              </button>
              <button
                onClick={() => window.location.href = `${baseUrl}/admin-dashboard`}
                style={{
                  padding: '12px 24px',
                  background: 'transparent',
                  color: '#1A1A1A',
                  border: '1px solid #E5E5E5',
                  borderRadius: '6px',
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => {
                  setShowSuccess(false);
                  setOnboardingResult(null);
                  // Reset form
                  setCompanyName('');
                  setClientName('');
                  setEmail('');
                  setProjectTitle('');
                  setProjectManagerId('');
                }}
                style={{
                  padding: '12px 24px',
                  background: 'transparent',
                  color: '#1A1A1A',
                  border: '1px solid #E5E5E5',
                  borderRadius: '6px',
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Create Another Client
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F2F2F2', padding: '40px 20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header with Autosave Indicator */}
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: '32px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '8px',
            }}>
              Client Onboarding
            </h1>
            <p style={{
              fontFamily: 'Helvetica, Arial, sans-serif',
              fontSize: '15px',
              color: '#6B6B6B',
            }}>
              Create a new client account and their first project
            </p>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: isSaving ? '#FFFCF5' : '#F0FDF4',
            borderRadius: '6px',
            border: `1px solid ${isSaving ? '#1A1A1A' : '#BBF7D0'}`,
          }}>
            <Save size={16} style={{ color: isSaving ? '#1A1A1A' : '#22C55E' }} />
            <span style={{
              fontFamily: 'Helvetica, Arial, sans-serif',
              fontSize: '13px',
              color: isSaving ? '#6B6B6B' : '#15803D',
              fontWeight: 600,
            }}>
              {isSaving ? 'Saving...' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : 'Autosave enabled'}
            </span>
          </div>
        </div>

        {/* Form */}
        <div style={{ display: 'grid', gap: '24px' }}>
          {/* CLIENT INFORMATION */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '6px',
            padding: '32px',
            border: '1px solid #E5E5E5',
          }}>
            <h2 style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: '20px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '24px',
            }}>
              Client Information
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontFamily: 'Helvetica, Arial, sans-serif',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#1A1A1A',
                }}>
                  Company Name *
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>Client Name *</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div>
                <label>Contact Person</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                />
              </div>
              <div>
                <label>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="test">Test</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div>
                <label>Language</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>
              <div>
                <label>Timezone</label>
                <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  <option value="Europe/Berlin">Europe/Berlin</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="America/Los_Angeles">America/Los_Angeles</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
          </div>

          {/* TAGS */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '6px',
            padding: '32px',
            border: '1px solid #E5E5E5',
          }}>
            <h2 style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: '20px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '16px',
            }}>
              Tags
            </h2>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ marginBottom: '8px', display: 'block' }}>Predefined Tags</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {predefinedTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: '6px 12px',
                      background: selectedTags.includes(tag) ? '#1A1A1A' : '#FFFFFF',
                      color: selectedTags.includes(tag) ? '#FFFFFF' : '#1A1A1A',
                      border: '1px solid #E5E5E5',
                      borderRadius: '6px',
                      fontFamily: 'Helvetica, Arial, sans-serif',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ marginBottom: '8px', display: 'block' }}>Custom Tags</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="text"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  placeholder="Enter custom tag"
                  style={{ flex: 1 }}
                  onKeyPress={(e) => e.key === 'Enter' && addCustomTag()}
                />
                <button
                  onClick={addCustomTag}
                  style={{
                    padding: '0 16px',
                    background: '#1A1A1A',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {customTags.map(tag => (
                  <div
                    key={tag}
                    style={{
                      padding: '6px 12px',
                      background: '#F37021',
                      color: '#FFFFFF',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    {tag}
                    <X
                      size={14}
                      style={{ cursor: 'pointer' }}
                      onClick={() => removeCustomTag(tag)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SEO & BUSINESS INFO */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '6px',
            padding: '32px',
            border: '1px solid #E5E5E5',
          }}>
            <h2 style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: '20px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '24px',
            }}>
              SEO & Business Information
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div>
                <label>Domain</label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="example.com"
                />
              </div>
              <div>
                <label>Website</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <label>Google Business Profile</label>
                <input
                  type="url"
                  value={gmbProfileUrl}
                  onChange={(e) => setGmbProfileUrl(e.target.value)}
                  placeholder="https://g.page/..."
                />
              </div>
              <div>
                <label>Instagram</label>
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@username"
                />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label>LinkedIn</label>
                <input
                  type="url"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
            </div>
          </div>

          {/* BRANDING */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '6px',
            padding: '32px',
            border: '1px solid #E5E5E5',
          }}>
            <h2 style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: '20px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '24px',
            }}>
              Branding Configuration
            </h2>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label>Logo Upload</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                />
                {logoFile && (
                  <p style={{ fontSize: '13px', color: '#6B6B6B', marginTop: '4px' }}>
                    Selected: {logoFile.name}
                  </p>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div>
                  <label>Primary Color</label>
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    style={{ width: '100%', height: '48px' }}
                  />
                </div>
                <div>
                  <label>Secondary Color</label>
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    style={{ width: '100%', height: '48px' }}
                  />
                </div>
                <div>
                  <label>Accent Color</label>
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    style={{ width: '100%', height: '48px' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="darkMode"
                  checked={darkModeDefault}
                  onChange={(e) => setDarkModeDefault(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <label htmlFor="darkMode" style={{ margin: 0 }}>Enable Dark Mode by Default</label>
              </div>
            </div>
          </div>

          {/* CLIENT SETTINGS */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '6px',
            padding: '32px',
            border: '1px solid #E5E5E5',
          }}>
            <h2 style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: '20px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '24px',
            }}>
              Client Settings
            </h2>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="notifyMilestones"
                  checked={notifyOnMilestones}
                  onChange={(e) => setNotifyOnMilestones(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <label htmlFor="notifyMilestones" style={{ margin: 0 }}>Notify on Milestones</label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="notifyFiles"
                  checked={notifyOnNewFiles}
                  onChange={(e) => setNotifyOnNewFiles(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <label htmlFor="notifyFiles" style={{ margin: 0 }}>Notify on New Files</label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="notifyNotes"
                  checked={notifyOnNotes}
                  onChange={(e) => setNotifyOnNotes(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <label htmlFor="notifyNotes" style={{ margin: 0 }}>Notify on Notes</label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="allowBranding"
                  checked={allowClientBrandCustomization}
                  onChange={(e) => setAllowClientBrandCustomization(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <label htmlFor="allowBranding" style={{ margin: 0 }}>Allow Client Brand Customization</label>
              </div>
            </div>
          </div>

          {/* PROJECT SETUP */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '6px',
            padding: '32px',
            border: '1px solid #E5E5E5',
          }}>
            <h2 style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: '20px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '24px',
            }}>
              Project Setup
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label>Project Title *</label>
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  required
                />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label>Project Description</label>
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  rows={4}
                />
              </div>
              <div>
                <label>Category</label>
                <select value={projectCategory} onChange={(e) => setProjectCategory(e.target.value)}>
                  <option value="Website">Website</option>
                  <option value="E-Commerce">E-Commerce</option>
                  <option value="App">App</option>
                  <option value="Branding">Branding</option>
                  <option value="SEO">SEO</option>
                  <option value="Marketing">Marketing</option>
                </select>
              </div>
              <div>
                <label>Project Manager</label>
                <select
                  value={projectManagerId}
                  onChange={(e) => setProjectManagerId(e.target.value)}
                >
                  <option value="">No Project Manager (Optional)</option>
                  {staffMembers.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label>Deadline</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* TEAM MEMBERS */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '6px',
            padding: '32px',
            border: '1px solid #E5E5E5',
          }}>
            <h2 style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: '20px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '16px',
            }}>
              Additional Team Members
            </h2>
            <div style={{ display: 'grid', gap: '8px' }}>
              {staffMembers.filter(m => m.id !== projectManagerId).map(member => (
                <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id={`team-${member.id}`}
                    checked={selectedTeamMembers.includes(member.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTeamMembers([...selectedTeamMembers, member.id]);
                      } else {
                        setSelectedTeamMembers(selectedTeamMembers.filter(id => id !== member.id));
                      }
                    }}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <label htmlFor={`team-${member.id}`} style={{ margin: 0 }}>{member.name}</label>
                </div>
              ))}
            </div>
          </div>

          {/* MILESTONES */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '6px',
            padding: '32px',
            border: '1px solid #E5E5E5',
          }}>
            <h2 style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: '20px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '16px',
            }}>
              Project Milestones
            </h2>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <button
                  onClick={() => setMilestoneMode('ai_assisted')}
                  style={{
                    padding: '8px 16px',
                    background: milestoneMode === 'ai_assisted' ? '#1A1A1A' : '#FFFFFF',
                    color: milestoneMode === 'ai_assisted' ? '#FFFFFF' : '#1A1A1A',
                    border: '1px solid #E5E5E5',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  AI-Assisted Timeline
                </button>
                <button
                  onClick={() => setMilestoneMode('manual')}
                  style={{
                    padding: '8px 16px',
                    background: milestoneMode === 'manual' ? '#1A1A1A' : '#FFFFFF',
                    color: milestoneMode === 'manual' ? '#FFFFFF' : '#1A1A1A',
                    border: '1px solid #E5E5E5',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Manual Milestones
                </button>
              </div>

              {milestoneMode === 'ai_assisted' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="autoGenerate"
                    checked={autoGenerateTimeline}
                    onChange={(e) => setAutoGenerateTimeline(e.target.checked)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <label htmlFor="autoGenerate" style={{ margin: 0 }}>
                    Auto-generate standard 5-phase timeline
                  </label>
                </div>
              )}

              {milestoneMode === 'manual' && (
                <div>
                  <button
                    onClick={addMilestone}
                    style={{
                      padding: '8px 16px',
                      background: '#F37021',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: 600,
                      marginBottom: '16px',
                    }}
                  >
                    <Plus size={16} />
                    Add Milestone
                  </button>
                  {manualMilestones.map((milestone) => (
                    <div
                      key={milestone.id}
                      style={{
                        background: '#FAFAFA',
                        padding: '16px',
                        borderRadius: '6px',
                        marginBottom: '12px',
                        border: '1px solid #E5E5E5',
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                        <div>
                          <label>Title</label>
                          <input
                            type="text"
                            value={milestone.title}
                            onChange={(e) => updateMilestone(milestone.id, 'title', e.target.value)}
                          />
                        </div>
                        <div>
                          <label>Deadline</label>
                          <input
                            type="date"
                            value={milestone.deadline}
                            onChange={(e) => updateMilestone(milestone.id, 'deadline', e.target.value)}
                          />
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <label>Description</label>
                          <input
                            type="text"
                            value={milestone.description}
                            onChange={(e) => updateMilestone(milestone.id, 'description', e.target.value)}
                          />
                        </div>
                        <div>
                          <label>Assigned To</label>
                          <select
                            value={milestone.assignedTo}
                            onChange={(e) => updateMilestone(milestone.id, 'assignedTo', e.target.value)}
                          >
                            <option value="">Unassigned</option>
                            {staffMembers.map(member => (
                              <option key={member.id} value={member.id}>
                                {member.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                          <button
                            onClick={() => removeMilestone(milestone.id)}
                            style={{
                              padding: '8px 16px',
                              background: '#DC2626',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              width: '100%',
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CHECKLIST */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '6px',
            padding: '32px',
            border: '1px solid #E5E5E5',
          }}>
            <h2 style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: '20px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '16px',
            }}>
              Project Requirements Checklist
            </h2>
            <div style={{ display: 'grid', gap: '12px' }}>
              {checklist.map((item, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id={`checklist-${index}`}
                    checked={item.checked}
                    onChange={(e) => {
                      const newChecklist = [...checklist];
                      newChecklist[index].checked = e.target.checked;
                      setChecklist(newChecklist);
                    }}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <label htmlFor={`checklist-${index}`} style={{ margin: 0 }}>{item.label}</label>
                </div>
              ))}
            </div>
          </div>

          {/* INITIAL FILES */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '6px',
            padding: '32px',
            border: '1px solid #E5E5E5',
          }}>
            <h2 style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: '20px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '16px',
            }}>
              Initial Files
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
              {[
                { label: 'Contract', type: 'contract' },
                { label: 'Email Communication', type: 'email_log' },
                { label: 'Reference Files', type: 'reference' },
                { label: 'Briefing', type: 'briefing' },
                { label: 'Legal Documents', type: 'legal' },
                { label: 'Assets', type: 'asset' },
              ].map(({ label, type }) => (
                <div key={type}>
                  <label style={{
                    display: 'block',
                    padding: '12px',
                    background: '#FAFAFA',
                    borderRadius: '6px',
                    border: '1px dashed #E5E5E5',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}>
                    <Upload size={20} style={{ display: 'block', margin: '0 auto 4px' }} />
                    {label}
                    <input
                      type="file"
                      multiple
                      onChange={(e) => handleFileUpload(e, type)}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              ))}
            </div>
            {initialFiles.length > 0 && (
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                  Uploaded Files ({initialFiles.length})
                </h4>
                {initialFiles.map((fileItem, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '8px 12px',
                      background: '#FAFAFA',
                      borderRadius: '6px',
                      marginBottom: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '13px' }}>{fileItem.file.name}</span>
                    <button
                      onClick={() => removeFile(index)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#DC2626',
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* NOTES */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '6px',
            padding: '32px',
            border: '1px solid #E5E5E5',
          }}>
            <h2 style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: '20px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '24px',
            }}>
              Project Notes
            </h2>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label>Internal Notes (Admin Only)</label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={4}
                  placeholder="These notes are only visible to staff members"
                />
              </div>
              <div>
                <label>Client-Visible Notes</label>
                <textarea
                  value={clientVisibleNotes}
                  onChange={(e) => setClientVisibleNotes(e.target.value)}
                  rows={4}
                  placeholder="These notes will be visible to the client in their dashboard"
                />
              </div>
            </div>
          </div>

          {/* SUBMIT */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '6px',
            padding: '32px',
            border: '1px solid #E5E5E5',
            display: 'flex',
            gap: '16px',
            justifyContent: 'flex-end',
          }}>
            <button
              onClick={() => window.history.back()}
              disabled={isSubmitting}
              style={{
                padding: '12px 32px',
                background: 'transparent',
                color: '#1A1A1A',
                border: '1px solid #E5E5E5',
                borderRadius: '6px',
                fontFamily: 'Poppins, sans-serif',
                fontSize: '14px',
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isFormValid() || isSubmitting}
              style={{
                padding: '12px 32px',
                background: isFormValid() && !isSubmitting ? '#1A1A1A' : '#E5E5E5',
                color: isFormValid() && !isSubmitting ? '#FFFFFF' : '#9A9A9A',
                border: 'none',
                borderRadius: '6px',
                fontFamily: 'Poppins, sans-serif',
                fontSize: '14px',
                fontWeight: 600,
                cursor: isFormValid() && !isSubmitting ? 'pointer' : 'not-allowed',
              }}
            >
              {isSubmitting ? 'Creating Client...' : 'Create Client & Project'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

