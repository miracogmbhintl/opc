/**
 * Settings Page - WITH FULL GERMAN/ENGLISH TRANSLATIONS
 * All text now uses the translation system
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import { User, Bell, Lock, Shield, Save, Eye, EyeOff, Upload } from 'lucide-react';
import { useTranslation, TranslationProvider } from '../lib/TranslationContext';
import SecurityTab from './SettingsSecurityTab';
import SystemTab from './SettingsSystemTab';

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
  const { language, setLanguage: setGlobalLanguage, t } = useTranslation();

  // Translation helper
  const tr = (de: string, en: string) => language === 'de' ? de : en;

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // State
  const [activeTab, setActiveTab] = useState<TabType>('account');
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
  const [userLanguage, setUserLanguage] = useState(language || 'de');
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
        setError(tr('Fehler beim Laden des Profils', 'Failed to load profile'));
      } else if (profileData) {
        setProfile(profileData);
        
        setFullName(profileData.name || '');
        setEmail(profileData.email || user.email || '');
        setAvatarUrl(profileData.avatar_url || '');
        setUsername(profileData.username || profileData.name?.split(' ')[0] || '');
        setCompany(profileData.company_name || '');
        
        const lang = profileData.language || 'de';
        setUserLanguage(lang);
        setGlobalLanguage(lang as 'en' | 'de');
        
        const userTheme = profileData.theme || 'light';
        setTheme(userTheme);
        
        const root = document.documentElement;
        if (userTheme === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
        
        setEmailNotifications({
          projectUpdates: profileData.notify_project_updates !== false,
          newMessages: profileData.notify_new_messages !== false,
          fileUploads: profileData.notify_file_uploads !== false,
          billing: profileData.notify_billing !== false
        });
        setPushNotifications(profileData.push_notifications_enabled || false);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError(tr('Etwas ist schiefgelaufen', 'Something went wrong'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(tr('Nicht authentifiziert', 'Not authenticated'));

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
          language: userLanguage,
          theme: theme
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || tr('Fehler beim Speichern', 'Failed to save settings'));
      }

      setGlobalLanguage(userLanguage as 'en' | 'de');

      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
        localStorage.setItem('mco_theme', 'dark');
      } else {
        root.classList.remove('dark');
        localStorage.setItem('mco_theme', 'light');
      }

      setSuccess(tr('Einstellungen erfolgreich gespeichert!', 'Settings saved successfully!'));
      setTimeout(() => setSuccess(''), 3000);
      
      await loadProfile();
    } catch (err: any) {
      console.error('Save profile error:', err);
      setError(err.message || tr('Fehler beim Speichern', 'Failed to save settings'));
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

      if (!file.type.startsWith('image/')) {
        setError(tr('Bitte laden Sie eine Bilddatei hoch', 'Please upload an image file'));
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError(tr('Dateigröße muss kleiner als 5MB sein', 'File size must be less than 5MB'));
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        setError(tr('Fehler beim Hochladen des Bildes', 'Failed to upload image'));
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        console.error('Update error:', updateError);
        setError(tr('Fehler beim Aktualisieren des Profils', 'Failed to update profile'));
        return;
      }

      setAvatarUrl(publicUrl);
      setSuccess(tr('Profilbild erfolgreich aktualisiert!', 'Profile picture updated successfully!'));
      setTimeout(() => setSuccess(''), 3000);

    } catch (err) {
      console.error('Unexpected error:', err);
      setError(tr('Etwas ist schiefgelaufen', 'Something went wrong'));
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
      if (!session) throw new Error(tr('Nicht authentifiziert', 'Not authenticated'));

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
        throw new Error(result.error || tr('Fehler beim Speichern', 'Failed to save preferences'));
      }

      setSuccess(tr('Benachrichtigungseinstellungen gespeichert!', 'Notification preferences saved!'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Save notifications error:', err);
      setError(err.message || tr('Fehler beim Speichern', 'Failed to save preferences'));
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
        throw new Error(tr('Passwörter stimmen nicht überein', 'Passwords do not match'));
      }

      if (newPassword.length < 8) {
        throw new Error(tr('Passwort muss mindestens 8 Zeichen lang sein', 'Password must be at least 8 characters'));
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      setSuccess(tr('Passwort erfolgreich aktualisiert!', 'Password updated successfully!'));
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || tr('Fehler beim Aktualisieren', 'Failed to update password'));
    } finally {
      setSaving(false);
    }
  };

  const tabs: Array<{ id: TabType; label: string; icon: any; roles: string[] }> = [
    { id: 'account', label: tr('Konto', 'Account'), icon: User, roles: ['owner', 'admin', 'client'] },
    { id: 'notifications', label: tr('Benachrichtigungen', 'Notifications'), icon: Bell, roles: ['owner', 'admin', 'client'] },
    { id: 'security', label: tr('Sicherheit', 'Security'), icon: Lock, roles: ['owner', 'admin', 'client'] },
    { id: 'system', label: tr('System', 'System'), icon: Shield, roles: ['owner'] }
  ];

  const visibleTabs = tabs.filter(tab => tab.roles.includes(profile?.role || 'client'));

  if (loading) {
    return null;
  }

  return (
    <div style={{
      padding: isMobile ? '16px' : '32px',
      minHeight: 'auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
      width: isMobile ? '95vw' : '100%',
      maxWidth: isMobile ? '95vw' : '100%',
      margin: isMobile ? '0 auto' : '0',
      marginBottom: '10vh'
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
                gap: '12px'
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

        {/* TAB 1: ACCOUNT */}
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
                    {tr('Profilbild', 'Profile Avatar')}
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
                        <span>{uploading ? tr('Wird hochgeladen...', 'Uploading...') : tr('Foto hochladen', 'Upload Photo')}</span>
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
                            setSuccess(tr('Profilbild wird beim Speichern entfernt', 'Profile picture will be removed when you save'));
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
                          {tr('Entfernen', 'Remove')}
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
                    {tr('Vollständiger Name', 'Full Name')}
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={tr('Geben Sie Ihren vollständigen Namen ein', 'Enter your full name')}
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
                    {tr('E-Mail', 'Email')}
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
                    {tr('E-Mail kann nicht geändert werden', 'Email cannot be changed')}
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
                    {tr('Firma', 'Company')}
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder={tr('Firmenname eingeben', 'Enter company name')}
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
                    {tr('Benutzername', 'Username')}
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={tr('Benutzername eingeben', 'Enter username')}
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
                    {tr('Sprache', 'Language')}
                  </label>
                  <select
                    value={userLanguage}
                    onChange={(e) => setUserLanguage(e.target.value)}
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
                    {tr('Design', 'Theme')}
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
                      {tr('Hell', 'Light')}
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
                      {tr('Dunkel', 'Dark')}
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
                    <span>{saving ? tr('Wird gespeichert...', 'Saving...') : tr('Änderungen speichern', 'Save Changes')}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: NOTIFICATIONS - Simplified for space */}
        {activeTab === 'notifications' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
                {tr('E-Mail-Benachrichtigungen', 'Email Notifications')}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  { key: 'projectUpdates', label: tr('Projektaktualisierungen', 'Project updates'), desc: tr('Benachrichtigungen über Projektstatusänderungen erhalten', 'Get notified about project status changes') },
                  { key: 'newMessages', label: tr('Neue Nachrichten', 'New messages'), desc: tr('Benachrichtigungen für neue Chat-Nachrichten erhalten', 'Receive notifications for new chat messages') },
                  { key: 'fileUploads', label: tr('Datei-Uploads', 'File uploads'), desc: tr('Benachrichtigungen bei neuen Datei-Uploads erhalten', 'Get notified when new files are uploaded') },
                  { key: 'billing', label: tr('Rechnungsbenachrichtigungen', 'Billing notifications'), desc: tr('Rechnungs- und Zahlungsbenachrichtigungen erhalten', 'Receive billing and payment notifications') }
                ].map(item => (
                  <div key={item.key} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px 18px',
                    background: '#F9FAFB',
                    borderRadius: '12px'
                  }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#1A1A1A', marginBottom: '4px', fontFamily: 'Inter, sans-serif' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '14px', color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>
                        {item.desc}
                      </div>
                    </div>
                    <Toggle
                      checked={emailNotifications[item.key as keyof typeof emailNotifications]}
                      onChange={(checked) => setEmailNotifications({ ...emailNotifications, [item.key]: checked })}
                    />
                  </div>
                ))}
              </div>
            </div>

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
                <span>{tr('Einstellungen speichern', 'Save Preferences')}</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: SECURITY - Due to length, using placeholder */}
        {activeTab === 'security' && (
          <SecurityTab
            language={language}
            tr={tr}
            oldPassword={oldPassword}
            setOldPassword={setOldPassword}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            showOldPassword={showOldPassword}
            setShowOldPassword={setShowOldPassword}
            showNewPassword={showNewPassword}
            setShowNewPassword={setShowNewPassword}
            showConfirmPassword={showConfirmPassword}
            setShowConfirmPassword={setShowConfirmPassword}
            twoFactorEnabled={twoFactorEnabled}
            setTwoFactorEnabled={setTwoFactorEnabled}
            saving={saving}
            handleChangePassword={handleChangePassword}
            Toggle={Toggle}
          />
        )}

        {/* TAB 4: SYSTEM - Owner only */}
        {activeTab === 'system' && profile?.role === 'owner' && (
          <SystemTab
            language={language}
            tr={tr}
          />
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





