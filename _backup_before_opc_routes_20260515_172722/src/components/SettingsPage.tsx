/**
 * Settings Page - Apple-Inspired Minimal Design
 * Visual refinement only - all backend logic preserved
 * Matches the design system used across Owner Dashboard, Files, Clients, etc.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import { User, Bell, Lock, Palette, Shield, Settings as SettingsIcon, CreditCard, Save, Eye, EyeOff, Upload } from 'lucide-react';
import { useTranslation, TranslationProvider } from '../lib/TranslationContext';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: 'owner' | 'admin' | 'client';
  client_id: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface SettingsPageProps {
  role?: 'owner' | 'admin' | 'client';
}

type TabType = 'account' | 'notifications' | 'security' | 'system';

export default function SettingsPage({ role }: SettingsPageProps) {
  return (
    <TranslationProvider>
      <SettingsPageContent role={role} />
    </TranslationProvider>
  );
}

function SettingsPageContent({ role }: SettingsPageProps) {
  // ==========================================
  // TRANSLATION
  // ==========================================
  const { language: currentLanguage, setLanguage: setGlobalLanguage, t } = useTranslation();

  // ==========================================
  // MOBILE DETECTION
  // ==========================================
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ==========================================
  // LOCAL STATE
  // ==========================================
  const [activeTab, setActiveTab] = useState('profile');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Profile form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [username, setUsername] = useState('');
  const [language, setLanguage] = useState(currentLanguage || 'de');
  const [theme, setTheme] = useState('light');

  // Password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Notifications state
  const [emailNotifications, setEmailNotifications] = useState({
    projectUpdates: true,
    newMessages: true,
    fileUploads: true,
    billing: true
  });
  const [pushNotifications, setPushNotifications] = useState(false);

  // Security state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // System state (owner only)
  const [systemSettings, setSystemSettings] = useState({
    autoSyncFiles: true,
    allowClientUploads: true,
    enableProjectChat: true
  });
  const [companyName, setCompanyName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1A1A1A');

  // ==========================================
  // LOAD DATA - UNCHANGED
  // ==========================================

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = `${baseUrl}/miraka-co-portal`;
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error loading profile:', profileError);
        setError('Profil konnte nicht geladen werden');
      } else if (profileData) {
        setProfile(profileData);
        
        // Set form fields from profile data
        setFullName(profileData.name || ''); // Note: DB field is 'name'
        setEmail(profileData.email || user.email || '');
        setAvatarUrl(profileData.avatar_url || '');
        setUsername(profileData.username || profileData.name?.split(' ')[0] || '');
        setCompany(profileData.company_name || '');
        
        // Set language and update global state
        const userLanguage = profileData.language || 'de';
        setLanguage(userLanguage);
        setGlobalLanguage(userLanguage as 'en' | 'de');
        
        // Set theme and apply to UI
        const userTheme = profileData.theme || 'light';
        setTheme(userTheme);
        
        // Apply theme to document
        const root = document.documentElement;
        if (userTheme === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
        
        // Load notification preferences
        setEmailNotifications({
          projectUpdates: profileData.notify_project_updates !== false, // Default true
          newMessages: profileData.notify_new_messages !== false,
          fileUploads: profileData.notify_file_uploads !== false,
          billing: profileData.notify_billing !== false
        });
        setPushNotifications(profileData.push_notifications_enabled || false);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Etwas ist schiefgelaufen');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // SAVE HANDLERS - UNCHANGED BACKEND LOGIC
  // ==========================================

  // ==========================================
  // HANDLERS
  // ==========================================

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Call API endpoint to update profile
      const response = await fetch(`${baseUrl}/api/profile/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          full_name: fullName,
          username: username,
          company_name: company,
          avatar_url: avatarUrl,
          language: language,
          theme: theme
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Einstellungen konnten nicht gespeichert werden');
      }

      // Update global language state
      setGlobalLanguage(language as 'en' | 'de');

      // Update local theme state
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
        localStorage.setItem('mco_theme', 'dark');
      } else {
        root.classList.remove('dark');
        localStorage.setItem('mco_theme', 'light');
      }

      setSuccess('Einstellungen erfolgreich gespeichert!');
      setTimeout(() => setSuccess(''), 3000);
      
      // Reload profile to get updated data
      await loadProfile();
    } catch (err: any) {
      console.error('Save profile error:', err);
      setError(err.message || 'Einstellungen konnten nicht gespeichert werden');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setError('');

      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Bitte laden Sie eine Bilddatei hoch');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Dateigröße muss kleiner als 5MB sein');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        setError('Bild konnte nicht hochgeladen werden');
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        console.error('Update error:', updateError);
        setError('Profil konnte nicht aktualisiert werden');
        return;
      }

      setAvatarUrl(publicUrl);
      setSuccess('Profilbild erfolgreich aktualisiert!');
      setTimeout(() => setSuccess(''), 3000);

    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Etwas ist schiefgelaufen');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Call API endpoint to update notification preferences
      const response = await fetch(`${baseUrl}/api/profile/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          notify_project_updates: emailNotifications.projectUpdates,
          notify_new_messages: emailNotifications.newMessages,
          notify_file_uploads: emailNotifications.fileUploads,
          notify_billing: emailNotifications.billing,
          push_notifications_enabled: pushNotifications
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Einstellungen konnten nicht gespeichert werden');
      }

      setSuccess('Benachrichtigungseinstellungen gespeichert!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Save notifications error:', err);
      setError(err.message || 'Einstellungen konnten nicht gespeichert werden');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (newPassword !== confirmPassword) {
        throw new Error('Passwörter stimmen nicht überein');
      }

      if (newPassword.length < 8) {
        throw new Error('Passwort muss mindestens 8 Zeichen lang sein');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      setSuccess('Passwort erfolgreich aktualisiert!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Passwort konnte nicht aktualisiert werden');
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // TABS CONFIGURATION
  // ==========================================

  const tabs: Array<{ id: TabType; label: string; icon: any; roles: string[] }> = [
    { id: 'account', label: 'Konto', icon: User, roles: ['owner', 'admin', 'client'] },
    { id: 'notifications', label: 'Benachrichtigungen', icon: Bell, roles: ['owner', 'admin', 'client'] },
    { id: 'security', label: 'Sicherheit', icon: Lock, roles: ['owner', 'admin', 'client'] },
    { id: 'system', label: 'System', icon: Shield, roles: ['owner'] }
  ];

  const visibleTabs = tabs.filter(tab => tab.roles.includes(profile?.role || 'client'));

  // ==========================================
  // RENDER
  // ==========================================

  if (loading) {
    return null;
  }

  return (
    <div className="settings-page-container" style={{
      padding: isMobile ? '16px' : '32px',
      minHeight: 'auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
      width: isMobile ? '95vw' : '100%',
      maxWidth: isMobile ? '95vw' : '100%',
      margin: isMobile ? '0 auto' : '0'
    }}>
      {/* Settings Cards Grid */}
      <div className="stats-cards-grid" style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: isMobile ? '12px' : '20px',
        marginBottom: isMobile ? '20px' : '32px'
      }}>
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: isActive ? '#1A1A1A' : '#FFFFFF',
                borderRadius: '14px',
                padding: isMobile ? '16px' : '24px',
                border: `1px solid ${isActive ? '#1A1A1A' : '#E5E7EB'}`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isActive ? '0 4px 12px rgba(0, 0, 0, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.04)'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                  e.currentTarget.style.borderColor = '#1A1A1A';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
                  e.currentTarget.style.borderColor = '#E5E7EB';
                }
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '8px'
              }}>
                <div style={{
                  width: isMobile ? '32px' : '40px',
                  height: isMobile ? '32px' : '40px',
                  borderRadius: '10px',
                  background: isActive ? 'rgba(255, 255, 255, 0.15)' : '#F9FAFB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Icon 
                    size={isMobile ? 16 : 20} 
                    strokeWidth={2} 
                    style={{ color: isActive ? '#FFFFFF' : '#1A1A1A' }}
                  />
                </div>
                <h3 style={{
                  fontSize: isMobile ? '14px' : '18px',
                  fontWeight: 600,
                  color: isActive ? '#FFFFFF' : '#1A1A1A',
                  margin: 0
                }}>
                  {tab.label}
                </h3>
              </div>
            </div>
          );
        })}
      </div>

      {/* Content Area */}
      <div style={{ padding: '0' }}>
        {/* Messages */}
        {error && (
          <div style={{
            padding: '14px 18px',
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: '10px',
            color: '#991B1B',
            fontSize: '14px',
            marginBottom: '24px'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            padding: '14px 18px',
            background: '#F0FDF4',
            border: '1px solid #86EFAC',
            borderRadius: '10px',
            color: '#14532D',
            fontSize: '14px',
            marginBottom: '24px'
          }}>
            {success}
          </div>
        )}

        {/* TAB 1: ACCOUNT (Combined Profile + Account) */}
        {activeTab === 'account' && (
          <div style={{
            background: '#FFFFFF',
            borderRadius: '14px',
            padding: '32px',
            border: '1px solid #E5E7EB',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
          }}>
            <form onSubmit={handleSaveProfile}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Avatar */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    Profilbild
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      background: avatarUrl ? `url(${avatarUrl})` : '#1A1A1A',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                      fontSize: '28px',
                      fontWeight: 600,
                      border: '1px solid #E5E7EB',
                      flexShrink: 0
                    }}>
                      {!avatarUrl && (fullName?.charAt(0) || email?.charAt(0) || 'U')}
                    </div>
                    <div style={{ flex: 1, display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <label
                        htmlFor="avatar-upload"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 20px',
                          background: uploading || saving ? '#F9FAFB' : '#1A1A1A',
                          color: uploading || saving ? '#9CA3AF' : '#FFFFFF',
                          border: '1px solid #E5E7EB',
                          borderRadius: '10px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: uploading || saving ? 'not-allowed' : 'pointer',
                          fontFamily: 'Inter, sans-serif',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <Upload size={16} strokeWidth={2} />
                        <span>{uploading ? 'Wird hochgeladen...' : 'Foto hochladen'}</span>
                      </label>
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        disabled={uploading || saving}
                        style={{ display: 'none' }}
                      />
                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setAvatarUrl('');
                            setSuccess('Profilbild wird beim Speichern entfernt');
                            setTimeout(() => setSuccess(''), 3000);
                          }}
                          disabled={uploading || saving}
                          style={{
                            padding: '10px 20px',
                            background: '#FFFFFF',
                            color: '#DC2626',
                            border: '1px solid #E5E7EB',
                            borderRadius: '10px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: uploading || saving ? 'not-allowed' : 'pointer',
                            fontFamily: 'Inter, sans-serif',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          Entfernen
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    Vollständiger Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Geben Sie Ihren vollständigen Namen ein"
                    disabled={saving}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '15px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      outline: 'none',
                      background: '#FFFFFF',
                      color: '#1A1A1A',
                      fontFamily: 'Inter, sans-serif'
                    }}
                  />
                </div>

                {/* Email - Read Only */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    E-Mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '15px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      background: '#F9FAFB',
                      color: '#6B7280',
                      cursor: 'not-allowed',
                      fontFamily: 'Inter, sans-serif'
                    }}
                  />
                  <span style={{
                    display: 'block',
                    marginTop: '8px',
                    fontSize: '13px',
                    color: '#6B7280',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    E-Mail kann nicht geändert werden
                  </span>
                </div>

                {/* Company */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    Unternehmen
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Geben Sie den Firmennamen ein"
                    disabled={saving}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '15px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      outline: 'none',
                      background: '#FFFFFF',
                      color: '#1A1A1A',
                      fontFamily: 'Inter, sans-serif'
                    }}
                  />
                </div>

                {/* Section Divider */}
                <div style={{
                  borderTop: '1px solid #E5E7EB',
                  marginTop: '12px',
                  marginBottom: '12px'
                }}></div>

                {/* Username */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    Benutzername
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Geben Sie den Benutzernamen ein"
                    disabled={saving}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '15px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      outline: 'none',
                      background: '#FFFFFF',
                      color: '#1A1A1A',
                      fontFamily: 'Inter, sans-serif'
                    }}
                  />
                </div>

                {/* Language */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    Sprache
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    disabled={saving}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '15px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      outline: 'none',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      background: '#FFFFFF',
                      color: '#1A1A1A',
                      fontFamily: 'Inter, sans-serif'
                    }}
                  >
                    <option value="en">English</option>
                    <option value="de">Deutsch</option>
                    <option value="fr">Français</option>
                    <option value="es">Español</option>
                  </select>
                </div>

                {/* Theme */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    Design
                  </label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      disabled={saving}
                      style={{
                        flex: 1,
                        padding: '12px',
                        background: theme === 'light' ? '#1A1A1A' : '#FFFFFF',
                        color: theme === 'light' ? '#FFFFFF' : '#1A1A1A',
                        border: '1px solid #E5E7EB',
                        borderRadius: '10px',
                        fontSize: '15px',
                        fontWeight: 600,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        fontFamily: 'Inter, sans-serif'
                      }}
                    >
                      Hell
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      disabled={saving}
                      style={{
                        flex: 1,
                        padding: '12px',
                        background: theme === 'dark' ? '#1A1A1A' : '#FFFFFF',
                        color: theme === 'dark' ? '#FFFFFF' : '#1A1A1A',
                        border: '1px solid #E5E7EB',
                        borderRadius: '10px',
                        fontSize: '15px',
                        fontWeight: 600,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        fontFamily: 'Inter, sans-serif'
                      }}
                    >
                      Dunkel
                    </button>
                  </div>
                </div>

                {/* Save Button */}
                <div style={{
                  paddingTop: '20px',
                  borderTop: '1px solid #E5E7EB',
                  display: 'flex',
                  justifyContent: 'flex-end'
                }}>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px 28px',
                      background: saving ? '#9CA3AF' : '#1A1A1A',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      fontFamily: 'Inter, sans-serif'
                    }}
                  >
                    <Save size={18} strokeWidth={2} />
                    <span>{saving ? 'Wird gespeichert...' : 'Änderungen speichern'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Email Notifications Card */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '14px',
              padding: '32px',
              border: '1px solid #E5E7EB',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
            }}>
              <h3 style={{
                fontSize: '20px',
                fontWeight: 600,
                color: '#1A1A1A',
                marginBottom: '24px',
                fontFamily: 'Inter, sans-serif'
              }}>
                E-Mail-Benachrichtigungen
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Project Updates */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 18px',
                  background: '#F9FAFB',
                  borderRadius: '12px'
                }}>
                  <div>
                    <div style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#1A1A1A',
                      marginBottom: '4px',
                      fontFamily: 'Inter, sans-serif'
                    }}>
                      Projekt-Updates
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#6B7280',
                      fontFamily: 'Inter, sans-serif'
                    }}>
                      Benachrichtigung über Projektstatusänderungen erhalten
                    </div>
                  </div>
                  <Toggle
                    checked={emailNotifications.projectUpdates}
                    onChange={(checked) => setEmailNotifications({ ...emailNotifications, projectUpdates: checked })}
                  />
                </div>

                {/* New Messages */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 18px',
                  background: '#F9FAFB',
                  borderRadius: '12px'
                }}>
                  <div>
                    <div style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#1A1A1A',
                      marginBottom: '4px',
                      fontFamily: 'Inter, sans-serif'
                    }}>
                      Neue Nachrichten
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#6B7280',
                      fontFamily: 'Inter, sans-serif'
                    }}>
                      Benachrichtigungen für neue Chat-Nachrichten erhalten
                    </div>
                  </div>
                  <Toggle
                    checked={emailNotifications.newMessages}
                    onChange={(checked) => setEmailNotifications({ ...emailNotifications, newMessages: checked })}
                  />
                </div>

                {/* File Uploads */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 18px',
                  background: '#F9FAFB',
                  borderRadius: '12px'
                }}>
                  <div>
                    <div style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#1A1A1A',
                      marginBottom: '4px',
                      fontFamily: 'Inter, sans-serif'
                    }}>
                      Datei-Uploads
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#6B7280',
                      fontFamily: 'Inter, sans-serif'
                    }}>
                      Benachrichtigung erhalten, wenn neue Dateien hochgeladen werden
                    </div>
                  </div>
                  <Toggle
                    checked={emailNotifications.fileUploads}
                    onChange={(checked) => setEmailNotifications({ ...emailNotifications, fileUploads: checked })}
                  />
                </div>

                {/* Billing (Admins only) */}
                {(profile?.role === 'admin' || profile?.role === 'owner') && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px 18px',
                    background: '#F9FAFB',
                    borderRadius: '12px'
                  }}>
                    <div>
                      <div style={{
                        fontSize: '15px',
                        fontWeight: 600,
                        color: '#1A1A1A',
                        marginBottom: '4px',
                        fontFamily: 'Inter, sans-serif'
                      }}>
                        Rechnungsbenachrichtigungen
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#6B7280',
                        fontFamily: 'Inter, sans-serif'
                      }}>
                        Benachrichtigungen zu Abrechnung und Zahlung erhalten
                      </div>
                    </div>
                    <Toggle
                      checked={emailNotifications.billing}
                      onChange={(checked) => setEmailNotifications({ ...emailNotifications, billing: checked })}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* App Notifications Card */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '14px',
              padding: '32px',
              border: '1px solid #E5E7EB',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
            }}>
              <h3 style={{
                fontSize: '20px',
                fontWeight: 600,
                color: '#1A1A1A',
                marginBottom: '24px',
                fontFamily: 'Inter, sans-serif'
              }}>
                Push-Benachrichtigungen
              </h3>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 18px',
                background: '#F9FAFB',
                borderRadius: '12px'
              }}>
                <div>
                  <div style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    marginBottom: '4px',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    Push-Benachrichtigungen aktivieren
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#6B7280',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    Echtzeit-Benachrichtigungen in der App erhalten
                  </div>
                </div>
                <Toggle
                  checked={pushNotifications}
                  onChange={setPushNotifications}
                />
              </div>
            </div>

            {/* Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSaveNotifications}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 28px',
                  background: '#1A1A1A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                <Save size={18} strokeWidth={2} />
                <span>Einstellungen speichern</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: SECURITY */}
        {activeTab === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Change Password Card */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '14px',
              padding: '32px',
              border: '1px solid #E5E7EB',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
            }}>
              <h3 style={{
                fontSize: '20px',
                fontWeight: 600,
                color: '#1A1A1A',
                marginBottom: '24px',
                fontFamily: 'Inter, sans-serif'
              }}>
                Passwort ändern
              </h3>

              <form onSubmit={handleChangePassword}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Old Password */}
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '10px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1A1A1A',
                      fontFamily: 'Inter, sans-serif'
                    }}>
                      Aktuelles Passwort
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showOldPassword ? 'text' : 'password'}
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        placeholder="Aktuelles Passwort eingeben"
                        style={{
                          width: '100%',
                          padding: '12px 44px 12px 16px',
                          fontSize: '15px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '10px',
                          outline: 'none',
                          background: '#FFFFFF',
                          color: '#1A1A1A',
                          fontFamily: 'Inter, sans-serif'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPassword(!showOldPassword)}
                        style={{
                          position: 'absolute',
                          right: '14px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#6B7280',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        {showOldPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '10px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1A1A1A',
                      fontFamily: 'Inter, sans-serif'
                    }}>
                      Neues Passwort
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Neues Passwort eingeben"
                        required
                        style={{
                          width: '100%',
                          padding: '12px 44px 12px 16px',
                          fontSize: '15px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '10px',
                          outline: 'none',
                          background: '#FFFFFF',
                          color: '#1A1A1A',
                          fontFamily: 'Inter, sans-serif'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        style={{
                          position: 'absolute',
                          right: '14px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#6B7280',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    <span style={{
                      display: 'block',
                      marginTop: '8px',
                      fontSize: '13px',
                      color: '#6B7280',
                      fontFamily: 'Inter, sans-serif'
                    }}>
                      Mindestens 8 Zeichen erforderlich
                    </span>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '10px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1A1A1A',
                      fontFamily: 'Inter, sans-serif'
                    }}>
                      Neues Passwort bestätigen
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Neues Passwort bestätigen"
                        required
                        style={{
                          width: '100%',
                          padding: '12px 44px 12px 16px',
                          fontSize: '15px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '10px',
                          outline: 'none',
                          background: '#FFFFFF',
                          color: '#1A1A1A',
                          fontFamily: 'Inter, sans-serif'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={{
                          position: 'absolute',
                          right: '14px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#6B7280',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div style={{
                    paddingTop: '20px',
                    borderTop: '1px solid #E5E7EB',
                    display: 'flex',
                    justifyContent: 'flex-end'
                  }}>
                    <button
                      type="submit"
                      disabled={saving}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px 28px',
                        background: saving ? '#9CA3AF' : '#1A1A1A',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '15px',
                        fontWeight: 600,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        fontFamily: 'Inter, sans-serif'
                      }}
                    >
                      <Lock size={18} strokeWidth={2} />
                      <span>{saving ? 'Wird aktualisiert...' : 'Passwort aktualisieren'}</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Two-Factor Auth Card */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '14px',
              padding: '32px',
              border: '1px solid #E5E7EB',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    marginBottom: '6px',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    Zwei-Faktor-Authentifizierung
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#6B7280',
                    margin: 0,
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    Fügen Sie Ihrem Konto eine zusätzliche Sicherheitsebene hinzu
                  </p>
                </div>
                <Toggle
                  checked={twoFactorEnabled}
                  onChange={setTwoFactorEnabled}
                />
              </div>
            </div>

            {/* Terminate Sessions Card */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '14px',
              padding: '32px',
              border: '1px solid #E5E7EB',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#1A1A1A',
                marginBottom: '10px',
                fontFamily: 'Inter, sans-serif'
              }}>
                Aktive Sitzungen
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#6B7280',
                marginBottom: '18px',
                fontFamily: 'Inter, sans-serif'
              }}>
                Von allen Geräten außer diesem abmelden
              </p>
              <button
                onClick={() => alert('Alle anderen Sitzungen wurden beendet')}
                style={{
                  padding: '12px 24px',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                Alle Sitzungen beenden
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: SYSTEM */}
        {activeTab === 'system' && profile?.role === 'owner' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Automation Settings */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '14px',
              padding: '32px',
              border: '1px solid #E5E7EB',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
            }}>
              <h3 style={{
                fontSize: '20px',
                fontWeight: 600,
                color: '#1A1A1A',
                marginBottom: '24px',
                fontFamily: 'Inter, sans-serif'
              }}>
                Automatisierung
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 18px',
                  background: '#F9FAFB',
                  borderRadius: '12px'
                }}>
                  <span style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    Dateien automatisch synchronisieren
                  </span>
                  <Toggle
                    checked={systemSettings.autoSyncFiles}
                    onChange={(checked) => setSystemSettings({ ...systemSettings, autoSyncFiles: checked })}
                  />
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 18px',
                  background: '#F9FAFB',
                  borderRadius: '12px'
                }}>
                  <span style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    Client-Uploads erlauben
                  </span>
                  <Toggle
                    checked={systemSettings.allowClientUploads}
                    onChange={(checked) => setSystemSettings({ ...systemSettings, allowClientUploads: checked })}
                  />
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 18px',
                  background: '#F9FAFB',
                  borderRadius: '12px'
                }}>
                  <span style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    Projekt-Chat aktivieren
                  </span>
                  <Toggle
                    checked={systemSettings.enableProjectChat}
                    onChange={(checked) => setSystemSettings({ ...systemSettings, enableProjectChat: checked })}
                  />
                </div>
              </div>
            </div>

            {/* Branding */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '14px',
              padding: '32px',
              border: '1px solid #E5E7EB',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
            }}>
              <h3 style={{
                fontSize: '20px',
                fontWeight: 600,
                color: '#1A1A1A',
                marginBottom: '24px',
                fontFamily: 'Inter, sans-serif'
              }}>
                Branding
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    Firmenlogo
                  </label>
                  <button
                    onClick={() => alert('Logo hochladen')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px 24px',
                      background: '#F9FAFB',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      color: '#1A1A1A',
                      fontFamily: 'Inter, sans-serif'
                    }}
                  >
                    <Upload size={18} strokeWidth={2} />
                    <span>Datei auswählen</span>
                  </button>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    Firmenname
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '15px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      outline: 'none',
                      background: '#FFFFFF',
                      color: '#1A1A1A',
                      fontFamily: 'Inter, sans-serif'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    Primärfarbe
                  </label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      style={{
                        width: '60px',
                        height: '48px',
                        border: '1px solid #E5E7EB',
                        borderRadius: '10px',
                        cursor: 'pointer'
                      }}
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        fontSize: '15px',
                        border: '1px solid #E5E7EB',
                        borderRadius: '10px',
                        outline: 'none',
                        fontFamily: 'monospace',
                        background: '#FFFFFF',
                        color: '#1A1A1A'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <label style={{
      position: 'relative',
      display: 'inline-block',
      width: '50px',
      height: '30px',
      cursor: 'pointer',
      flexShrink: 0
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ display: 'none' }}
      />
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: checked ? '#1A1A1A' : '#E5E7EB',
        borderRadius: '15px',
        transition: 'all 0.2s ease'
      }}>
        <div style={{
          position: 'absolute',
          top: '3px',
          left: checked ? '23px' : '3px',
          width: '24px',
          height: '24px',
          background: '#FFFFFF',
          borderRadius: '50%',
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }} />
      </div>
    </label>
  );
}











