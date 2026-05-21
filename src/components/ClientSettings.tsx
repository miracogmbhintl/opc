








/**
 * Client Settings Component
 * Matches Admin Dashboard card-based design
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, Lock, Bell, Eye, EyeOff, Save, Upload } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  phone: string | null;
  role: string;
  avatar_url: string | null;
  username: string | null;
  language: string | null;
  timezone: string | null;
  theme: string | null;
  created_at: string;
}

type TabType = 'profile' | 'security' | 'notifications';

export default function ClientSettings() {
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    company: '',
    phone: '',
    username: '',
    language: 'de',
    timezone: 'Europe/Zurich',
    theme: 'light',
  });
  const [avatarUrl, setAvatarUrl] = useState('');

  // Security state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Notifications state
  const [emailNotifications, setEmailNotifications] = useState({
    projectUpdates: true,
    newMessages: true,
    fileUploads: true,
    billing: true,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setProfile(data as UserProfile);
      setFormData({
        full_name: data.full_name || '',
        company: data.company || '',
        phone: data.phone || '',
        username: data.username || '',
        language: data.language || 'de',
        timezone: data.timezone || 'Europe/Zurich',
        theme: data.theme || 'light',
      });
      setAvatarUrl(data.avatar_url || '');

    } catch (err: any) {
      console.error('Error loading profile:', err);
      setError('Profil konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          full_name: formData.full_name,
          company: formData.company || null,
          phone: formData.phone || null,
          username: formData.username || null,
          language: formData.language,
          timezone: formData.timezone,
          theme: formData.theme,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setSuccess('Profil erfolgreich aktualisiert!');
      await loadProfile();
      setTimeout(() => setSuccess(''), 3000);

    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Profil konnte nicht aktualisiert werden');
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
        setError('Bitte laden Sie eine Bilddatei hoch');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError('Dateigröße muss kleiner als 5MB sein');
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
        setError('Bild konnte nicht hochgeladen werden');
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
      setSuccess('Profilbild wird beim Speichern aktualisiert');
      setTimeout(() => setSuccess(''), 3000);

    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Etwas ist schiefgelaufen');
    } finally {
      setUploading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      setSuccess('Passwort erfolgreich geändert!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(''), 3000);

    } catch (err: any) {
      console.error('Error changing password:', err);
      setError(err.message || 'Passwort konnte nicht geändert werden');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = () => {
    setSuccess('Benachrichtigungseinstellungen gespeichert!');
    setTimeout(() => setSuccess(''), 3000);
  };

  if (loading) {
    return null;
  }

  if (!profile) {
    return (
      <div style={{
        background: '#FFFFFF',
        borderRadius: '14px',
        padding: '32px',
        border: '1px solid #E5E7EB'
      }}>
        <p style={{ color: '#EF4444', margin: 0 }}>Profil konnte nicht geladen werden</p>
      </div>
    );
  }

  const tabs: Array<{ id: TabType; label: string; icon: any }> = [
    { id: 'profile', label: 'Mein Profil', icon: User },
    { id: 'security', label: 'Sicherheit', icon: Lock },
    { id: 'notifications', label: 'Benachrichtigungen', icon: Bell },
  ];

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Settings Cards Grid - Matching Admin Dashboard */}
      <div className="stats-cards-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: isActive ? '#1A1A1A' : '#FFFFFF',
                borderRadius: '14px',
                padding: '24px',
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
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: isActive ? 'rgba(255, 255, 255, 0.15)' : '#F9FAFB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Icon 
                    size={20} 
                    strokeWidth={2} 
                    style={{ color: isActive ? '#FFFFFF' : '#1A1A1A' }}
                  />
                </div>
                <h3 style={{
                  fontSize: '18px',
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

      {/* Responsive CSS */}
      <style>{`
        @media (max-width: 1023px) {
          .stats-cards-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        
        @media (max-width: 599px) {
          .stats-cards-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Content Area */}
      <div>
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

        {/* TAB 1: PROFILE */}
        {activeTab === 'profile' && (
          <div style={{
            background: '#FFFFFF',
            borderRadius: '14px',
            padding: '32px',
            border: '1px solid #E5E7EB',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
          }}>
            <form onSubmit={handleUpdateProfile}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Avatar */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A'
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
                      {!avatarUrl && (formData.full_name?.charAt(0) || profile.email?.charAt(0) || 'U')}
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
                            transition: 'all 0.2s ease'
                          }}
                        >
                          Entfernen
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A'
                  }}>
                    Vollständiger Name
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Max Mustermann"
                    required
                    disabled={saving}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '15px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      outline: 'none',
                      background: '#FFFFFF',
                      color: '#1A1A1A'
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
                    color: '#1A1A1A'
                  }}>
                    E-Mail-Adresse
                  </label>
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '15px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      background: '#F9FAFB',
                      color: '#6B7280',
                      cursor: 'not-allowed'
                    }}
                  />
                  <span style={{
                    display: 'block',
                    marginTop: '8px',
                    fontSize: '13px',
                    color: '#6B7280'
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
                    color: '#1A1A1A'
                  }}>
                    Unternehmen
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Firmenname"
                    disabled={saving}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '15px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      outline: 'none',
                      background: '#FFFFFF',
                      color: '#1A1A1A'
                    }}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A'
                  }}>
                    Telefon
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+49 (123) 456-7890"
                    disabled={saving}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '15px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      outline: 'none',
                      background: '#FFFFFF',
                      color: '#1A1A1A'
                    }}
                  />
                </div>

                {/* Username */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A'
                  }}>
                    Benutzername
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="Benutzername"
                    disabled={saving}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '15px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      outline: 'none',
                      background: '#FFFFFF',
                      color: '#1A1A1A'
                    }}
                  />
                  <span style={{
                    display: 'block',
                    marginTop: '8px',
                    fontSize: '13px',
                    color: '#6B7280'
                  }}>
                    Anzeigename für Ihr Profil
                  </span>
                </div>

                {/* Language */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A'
                  }}>
                    Sprache
                  </label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
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
                      cursor: saving ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <option value="de">Deutsch</option>
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                  </select>
                  <span style={{
                    display: 'block',
                    marginTop: '8px',
                    fontSize: '13px',
                    color: '#6B7280'
                  }}>
                    Bevorzugte Sprache für die Benutzeroberfläche
                  </span>
                </div>

                {/* Timezone */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A'
                  }}>
                    Zeitzone
                  </label>
                  <select
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
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
                      cursor: saving ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <option value="Europe/Zurich">Europe/Zurich (CET)</option>
                    <option value="Europe/Berlin">Europe/Berlin (CET)</option>
                    <option value="Europe/Vienna">Europe/Vienna (CET)</option>
                    <option value="Europe/Paris">Europe/Paris (CET)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="America/New_York">America/New York (EST)</option>
                    <option value="America/Los_Angeles">America/Los Angeles (PST)</option>
                  </select>
                  <span style={{
                    display: 'block',
                    marginTop: '8px',
                    fontSize: '13px',
                    color: '#6B7280'
                  }}>
                    Ihre lokale Zeitzone
                  </span>
                </div>

                {/* Theme */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A'
                  }}>
                    Design
                  </label>
                  <select
                    value={formData.theme}
                    onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
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
                      cursor: saving ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <option value="light">Hell</option>
                    <option value="dark">Dunkel</option>
                  </select>
                  <span style={{
                    display: 'block',
                    marginTop: '8px',
                    fontSize: '13px',
                    color: '#6B7280'
                  }}>
                    Bevorzugtes Farbschema
                  </span>
                </div>

                {/* Save Button */}
                <div style={{
                  paddingTop: '20px',
                  borderTop: '1px solid #E5E7EB',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px'
                }}>
                  <button
                    type="button"
                    onClick={loadProfile}
                    disabled={saving}
                    style={{
                      padding: '12px 24px',
                      background: '#FFFFFF',
                      color: '#1A1A1A',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: saving ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Zurücksetzen
                  </button>
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
                      cursor: saving ? 'not-allowed' : 'pointer'
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

        {/* TAB 2: SECURITY */}
        {activeTab === 'security' && (
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
              marginBottom: '24px'
            }}>
              Passwort ändern
            </h3>

            <form onSubmit={handleChangePassword}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* New Password */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A'
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
                      minLength={8}
                      style={{
                        width: '100%',
                        padding: '12px 44px 12px 16px',
                        fontSize: '15px',
                        border: '1px solid #E5E7EB',
                        borderRadius: '10px',
                        outline: 'none',
                        background: '#FFFFFF',
                        color: '#1A1A1A'
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
                    color: '#6B7280'
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
                    color: '#1A1A1A'
                  }}>
                    Passwort bestätigen
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
                        color: '#1A1A1A'
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
                  justifyContent: 'flex-end',
                  gap: '12px'
                }}>
                  <button
                    type="button"
                    onClick={() => {
                      setNewPassword('');
                      setConfirmPassword('');
                      setError('');
                    }}
                    disabled={saving}
                    style={{
                      padding: '12px 24px',
                      background: '#FFFFFF',
                      color: '#1A1A1A',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: saving ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Abbrechen
                  </button>
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
                      cursor: saving ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Lock size={18} strokeWidth={2} />
                    <span>{saving ? 'Wird aktualisiert...' : 'Passwort aktualisieren'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
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
              marginBottom: '24px'
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
                    marginBottom: '4px'
                  }}>
                    Projekt-Updates
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#6B7280'
                  }}>
                    Benachrichtigung über Projektstatusänderungen erhalten
                  </div>
                </div>
                <Toggle
                  checked={emailNotifications.projectUpdates}
                  onChange={(checked) =>
                    setEmailNotifications({ ...emailNotifications, projectUpdates: checked })
                  }
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
                    marginBottom: '4px'
                  }}>
                    Neue Nachrichten
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#6B7280'
                  }}>
                    Benachrichtigungen für neue Chat-Nachrichten erhalten
                  </div>
                </div>
                <Toggle
                  checked={emailNotifications.newMessages}
                  onChange={(checked) =>
                    setEmailNotifications({ ...emailNotifications, newMessages: checked })
                  }
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
                    marginBottom: '4px'
                  }}>
                    Datei-Uploads
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#6B7280'
                  }}>
                    Benachrichtigung erhalten, wenn neue Dateien hochgeladen werden
                  </div>
                </div>
                <Toggle
                  checked={emailNotifications.fileUploads}
                  onChange={(checked) =>
                    setEmailNotifications({ ...emailNotifications, fileUploads: checked })
                  }
                />
              </div>

              {/* Billing Notifications */}
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
                    marginBottom: '4px'
                  }}>
                    Rechnungen & Zahlungen
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#6B7280'
                  }}>
                    Benachrichtigungen für Rechnungen und Zahlungserinnerungen erhalten
                  </div>
                </div>
                <Toggle
                  checked={emailNotifications.billing}
                  onChange={(checked) =>
                    setEmailNotifications({ ...emailNotifications, billing: checked })
                  }
                />
              </div>
            </div>

            {/* Save Button */}
            <div style={{
              marginTop: '24px',
              paddingTop: '24px',
              borderTop: '1px solid #E5E7EB',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
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
                  cursor: 'pointer'
                }}
              >
                <Save size={18} strokeWidth={2} />
                <span>Einstellungen speichern</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Toggle Component
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











