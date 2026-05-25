import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type ElementType,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  Bell,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  MonitorCog,
  Save,
  Shield,
  Upload,
  User,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import { readOpcPageCache, writeOpcPageCache } from '../lib/opc-page-cache';
import PortalSkeleton from './shared/PortalSkeleton';

const SETTINGS_PAGE_CACHE_KEY = 'opc:page-cache:settings-profile';

type UserRole = 'owner' | 'admin' | 'employee' | 'client';
type TabType = 'account' | 'notifications' | 'security' | 'system';

interface NotificationSettings {
  projectUpdates: boolean;
  newMessages: boolean;
  fileUploads: boolean;
  billing: boolean;
  dispatchAlerts: boolean;
  reportApprovals: boolean;
  pushNotifications: boolean;
}

interface SystemSettings {
  companyDisplayName: string;
  defaultLanguage: string;
  defaultTimezone: string;
  allowClientUploads: boolean;
  enableEmployeePortal: boolean;
  enableReportApproval: boolean;
  enableDispatchNotifications: boolean;
}

interface ApiProfile {
  id: string;
  source?: 'staff' | 'client';
  email: string;
  name: string;
  full_name: string;
  role: UserRole;
  raw_role?: string | null;
  company: string;
  phone: string;
  avatar_url: string;
  username: string;
  language: string;
  timezone: string;
  theme: string;
  notifications?: Partial<NotificationSettings>;
  system_settings?: Partial<SystemSettings>;
  created_at?: string | null;
  updated_at?: string | null;
  can_access_portal?: boolean;
}

interface SettingsPageProps {
  role?: UserRole;
}

interface ApiResponse<T = any> {
  success: boolean;
  error?: string;
  details?: string;
  profile?: T;
  preferences?: Record<string, any>;
}

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  black: '#111111',
  card: '#FFFFFF',
  soft: '#FAFAFA',
  green: '#166534',
  greenBg: '#F0FDF4',
  red: '#B91C1C',
  redBg: '#FEF2F2',
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  projectUpdates: true,
  newMessages: true,
  fileUploads: true,
  billing: true,
  dispatchAlerts: true,
  reportApprovals: true,
  pushNotifications: false,
};

const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  companyDisplayName: 'Orange Pro Clean GmbH',
  defaultLanguage: 'de',
  defaultTimezone: 'Europe/Zurich',
  allowClientUploads: true,
  enableEmployeePortal: true,
  enableReportApproval: true,
  enableDispatchNotifications: true,
};

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, "Helvetica Neue", Segoe UI, Roboto, sans-serif';

const cardStyle: CSSProperties = {
  background: BRAND.card,
  border: `1px solid ${BRAND.border}`,
  borderRadius: '22px',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

const sectionTitleStyle: CSSProperties = {
  margin: '0 0 6px',
  fontSize: '20px',
  fontWeight: 820,
  letterSpacing: '-0.03em',
};

const sectionDescriptionStyle: CSSProperties = {
  margin: 0,
  color: BRAND.muted,
  fontSize: '14px',
  fontWeight: 540,
};

const primaryButtonStyle: CSSProperties = {
  height: '44px',
  padding: '0 16px',
  borderRadius: '13px',
  border: 'none',
  background: BRAND.black,
  color: '#FFFFFF',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '9px',
  fontSize: '14px',
  fontWeight: 780,
  fontFamily: pageFont,
  cursor: 'pointer',
};

function getInitials(name: string, email: string) {
  const source = name.trim() || email.trim();

  if (!source) return 'U';

  const parts = source
    .replace(/@.*/, '')
    .split(/\s|\.|-/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 1).toUpperCase();
}

function normalizeRole(role?: string | null): UserRole {
  if (role === 'owner' || role === 'admin' || role === 'employee' || role === 'client') {
    return role;
  }

  return 'client';
}

function getRoleLabel(role: UserRole) {
  if (role === 'owner') return 'Inhaber';
  if (role === 'admin') return 'Admin';
  if (role === 'employee') return 'Mitarbeiter';

  return 'Kunde';
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label
      style={{
        display: 'block',
        marginBottom: '8px',
        color: BRAND.text,
        fontSize: '13px',
        fontWeight: 760,
        letterSpacing: '-0.01em',
      }}
    >
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  disabled = false,
  type = 'text',
}: {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => onChange?.(event.target.value)}
      style={{
        width: '100%',
        height: '46px',
        borderRadius: '13px',
        border: `1px solid ${BRAND.border}`,
        background: disabled ? '#F9FAFB' : '#FFFFFF',
        color: disabled ? BRAND.faint : BRAND.text,
        padding: '0 14px',
        outline: 'none',
        boxSizing: 'border-box',
        fontSize: '14px',
        fontWeight: 560,
        fontFamily: pageFont,
      }}
      onFocus={(event) => {
        if (!disabled) event.currentTarget.style.borderColor = BRAND.black;
      }}
      onBlur={(event) => {
        event.currentTarget.style.borderColor = BRAND.border;
      }}
    />
  );
}

function SelectInput({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      style={{
        width: '100%',
        height: '46px',
        borderRadius: '13px',
        border: `1px solid ${BRAND.border}`,
        background: '#FFFFFF',
        color: BRAND.text,
        padding: '0 14px',
        outline: 'none',
        boxSizing: 'border-box',
        fontSize: '14px',
        fontWeight: 560,
        fontFamily: pageFont,
      }}
      onFocus={(event) => {
        event.currentTarget.style.borderColor = BRAND.black;
      }}
      onBlur={(event) => {
        event.currentTarget.style.borderColor = BRAND.border;
      }}
    >
      {children}
    </select>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '18px',
        padding: '16px',
        borderRadius: '16px',
        border: `1px solid ${BRAND.border}`,
        background: '#FFFFFF',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: pageFont,
      }}
    >
      <span>
        <span
          style={{
            display: 'block',
            color: BRAND.text,
            fontSize: '14px',
            fontWeight: 760,
            marginBottom: '4px',
          }}
        >
          {label}
        </span>

        <span
          style={{
            display: 'block',
            color: BRAND.muted,
            fontSize: '13px',
            fontWeight: 520,
            lineHeight: 1.45,
          }}
        >
          {description}
        </span>
      </span>

      <span
        style={{
          width: '46px',
          height: '26px',
          borderRadius: '999px',
          background: checked ? BRAND.black : '#E5E7EB',
          padding: '3px',
          boxSizing: 'border-box',
          flexShrink: 0,
          transition: 'background 0.18s ease',
        }}
      >
        <span
          style={{
            display: 'block',
            width: '20px',
            height: '20px',
            borderRadius: '999px',
            background: '#FFFFFF',
            transform: checked ? 'translateX(20px)' : 'translateX(0)',
            transition: 'transform 0.18s ease',
          }}
        />
      </span>
    </button>
  );
}

function StatusMessage({
  type,
  message,
}: {
  type: 'success' | 'error';
  message: string;
}) {
  if (!message) return null;

  const isSuccess = type === 'success';

  return (
    <div
      style={{
        marginBottom: '18px',
        padding: '13px 15px',
        borderRadius: '14px',
        border: `1px solid ${isSuccess ? '#BBF7D0' : '#FCA5A5'}`,
        background: isSuccess ? BRAND.greenBg : BRAND.redBg,
        color: isSuccess ? BRAND.green : BRAND.red,
        fontSize: '14px',
        fontWeight: 660,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {isSuccess && <CheckCircle2 size={17} />}
      {message}
    </div>
  );
}

function PasswordField({
  value,
  onChange,
  visible,
  onToggle,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  placeholder: string;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <TextInput
        value={value}
        onChange={onChange}
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
      />

      <button
        type="button"
        onClick={onToggle}
        style={{
          position: 'absolute',
          right: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '32px',
          height: '32px',
          borderRadius: '9px',
          border: 'none',
          background: 'transparent',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: BRAND.muted,
        }}
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

export default function SettingsPageTranslated({ role }: SettingsPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<TabType>('account');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profile, setProfile] = useState<ApiProfile | null>(null);

  const [resolvedRole, setResolvedRole] = useState<UserRole>(role || 'client');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [language, setLanguage] = useState('de');
  const [timezone, setTimezone] = useState('Europe/Zurich');
  const [theme, setTheme] = useState('light');

  const [notifications, setNotifications] = useState<NotificationSettings>(
    DEFAULT_NOTIFICATIONS
  );

  const [systemSettings, setSystemSettings] = useState<SystemSettings>(
    DEFAULT_SYSTEM_SETTINGS
  );

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isOwner = resolvedRole === 'owner';

  const tabs = useMemo(() => {
    const baseTabs: Array<{
      id: TabType;
      label: string;
      icon: ElementType;
      ownerOnly?: boolean;
    }> = [
      { id: 'account', label: 'Konto', icon: User },
      { id: 'notifications', label: 'Benachrichtigungen', icon: Bell },
      { id: 'security', label: 'Sicherheit', icon: Lock },
      { id: 'system', label: 'System', icon: Shield, ownerOnly: true },
    ];

    return baseTabs.filter((tab) => !tab.ownerOnly || isOwner);
  }, [isOwner]);

  useEffect(() => {
    const cachedProfile = readOpcPageCache<ApiProfile>(SETTINGS_PAGE_CACHE_KEY);

    if (cachedProfile) {
      applyProfile(cachedProfile);
      setLoading(false);
      void loadProfile({ background: true });
      return;
    }

    void loadProfile();
  }, []);

  useEffect(() => {
    if (!isOwner && activeTab === 'system') {
      setActiveTab('account');
    }
  }, [activeTab, isOwner]);

  function applyProfile(nextProfile: ApiProfile) {
    const detectedRole = normalizeRole(role || nextProfile.role);

    setProfile(nextProfile);
    setResolvedRole(detectedRole);

    const nextFullName = nextProfile.full_name || nextProfile.name || '';

    setFullName(nextFullName);
    setEmail(nextProfile.email || '');
    setCompany(nextProfile.company || DEFAULT_SYSTEM_SETTINGS.companyDisplayName);
    setUsername(nextProfile.username || nextFullName.split(' ')[0] || '');
    setPhone(nextProfile.phone || '');
    setAvatarUrl(nextProfile.avatar_url || '');
    setLanguage(nextProfile.language || 'de');
    setTimezone(nextProfile.timezone || 'Europe/Zurich');
    setTheme(nextProfile.theme || 'light');

    setNotifications({
      ...DEFAULT_NOTIFICATIONS,
      ...(nextProfile.notifications || {}),
    });

    setSystemSettings({
      ...DEFAULT_SYSTEM_SETTINGS,
      ...(nextProfile.system_settings || {}),
      companyDisplayName:
        nextProfile.system_settings?.companyDisplayName ||
        nextProfile.company ||
        DEFAULT_SYSTEM_SETTINGS.companyDisplayName,
      defaultLanguage:
        nextProfile.system_settings?.defaultLanguage ||
        nextProfile.language ||
        DEFAULT_SYSTEM_SETTINGS.defaultLanguage,
      defaultTimezone:
        nextProfile.system_settings?.defaultTimezone ||
        nextProfile.timezone ||
        DEFAULT_SYSTEM_SETTINGS.defaultTimezone,
    });

    const root = document.documentElement;

    if ((nextProfile.theme || 'light') === 'dark') {
      root.classList.add('dark');
      localStorage.setItem('mco_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('mco_theme', 'light');
    }

    localStorage.setItem('lang', nextProfile.language || 'de');
  }

  async function getSessionToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Nicht authentifiziert');
    }

    return session.access_token;
  }

  async function loadProfile(options: { background?: boolean } = {}) {
    const isBackground = Boolean(options.background);

    if (!isBackground) setLoading(true);
    setError('');

    try {
      const accessToken = await getSessionToken();

      const response = await fetch(`${baseUrl}/api/profile/update`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = (await response.json().catch(() => null)) as ApiResponse<ApiProfile> | null;

      if (!response.ok || !result?.success || !result?.profile) {
        throw new Error(
          result?.error || 'Einstellungen konnten nicht geladen werden.'
        );
      }

      const nextProfile = result.profile as ApiProfile;
      applyProfile(nextProfile);
      writeOpcPageCache<ApiProfile>(SETTINGS_PAGE_CACHE_KEY, nextProfile);
    } catch (err: any) {
      console.error('Settings load error:', err);
      setError(err?.message || 'Einstellungen konnten nicht geladen werden.');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }

  async function updateProfilePayload(payload: Record<string, any>) {
    const accessToken = await getSessionToken();

    const response = await fetch(`${baseUrl}/api/profile/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const result = (await response.json().catch(() => null)) as ApiResponse<ApiProfile> | null;

    if (!response.ok || !result?.success) {
      throw new Error(
        result?.error ||
          result?.details ||
          'Einstellungen konnten nicht gespeichert werden.'
      );
    }

    if (result.profile) {
      applyProfile(result.profile as ApiProfile);
    }

    return result;
  }

  async function handleSaveAccount(event?: FormEvent) {
    event?.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await updateProfilePayload({
        full_name: fullName,
        username,
        company,
        phone,
        avatar_url: avatarUrl || '',
        language,
        timezone,
        theme,
      });

      const root = document.documentElement;

      if (theme === 'dark') {
        root.classList.add('dark');
        localStorage.setItem('mco_theme', 'dark');
      } else {
        root.classList.remove('dark');
        localStorage.setItem('mco_theme', 'light');
      }

      localStorage.setItem('lang', language);

      setSuccess('Kontoeinstellungen wurden gespeichert.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Account save error:', err);
      setError(err?.message || 'Kontoeinstellungen konnten nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveNotifications() {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const accessToken = await getSessionToken();

      const response = await fetch(`${baseUrl}/api/profile/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(notifications),
      });

      const result = (await response.json().catch(() => null)) as ApiResponse | null;

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error ||
            result?.details ||
            'Benachrichtigungen konnten nicht gespeichert werden.'
        );
      }

      setNotifications({
        ...DEFAULT_NOTIFICATIONS,
        ...(result.preferences || {}),
      });

      setSuccess('Benachrichtigungen wurden gespeichert.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Notification save error:', err);
      setError(err?.message || 'Benachrichtigungen konnten nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Bitte laden Sie eine Bilddatei hoch.');
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Das Profilbild darf maximal 5MB gross sein.');
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Nicht authentifiziert');
      }

      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('profile-pictures').getPublicUrl(filePath);

      setAvatarUrl(publicUrl);

      await updateProfilePayload({
        avatar_url: publicUrl,
      });

      setSuccess('Profilbild wurde aktualisiert.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      setError(err?.message || 'Profilbild konnte nicht hochgeladen werden.');
    } finally {
      setUploading(false);

      if (event.target) {
        event.target.value = '';
      }
    }
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (newPassword.length < 8) {
        throw new Error('Das neue Passwort muss mindestens 8 Zeichen lang sein.');
      }

      if (newPassword !== confirmPassword) {
        throw new Error('Die Passwörter stimmen nicht überein.');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Passwort wurde aktualisiert.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Password update error:', err);
      setError(err?.message || 'Passwort konnte nicht geändert werden.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSystem() {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await updateProfilePayload({
        company: systemSettings.companyDisplayName,
        language: systemSettings.defaultLanguage,
        timezone: systemSettings.defaultTimezone,
        system_settings: systemSettings,
      });

      setCompany(systemSettings.companyDisplayName);
      setLanguage(systemSettings.defaultLanguage);
      setTimezone(systemSettings.defaultTimezone);

      setSuccess('Systemeinstellungen wurden gespeichert.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('System save error:', err);
      setError(err?.message || 'Systemeinstellungen konnten nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <PortalSkeleton variant="dashboard" />;
  }

  const initials = getInitials(fullName, email);

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100%',
        padding: 0,
        fontFamily: pageFont,
        color: BRAND.text,
      }}
    >
      <div
        className="opc-settings-tabs"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
          gap: '16px',
          marginBottom: '22px',
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                minHeight: '74px',
                borderRadius: '18px',
                border: `1px solid ${isActive ? BRAND.black : BRAND.border}`,
                background: isActive ? BRAND.black : '#FFFFFF',
                color: isActive ? '#FFFFFF' : BRAND.text,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                fontFamily: pageFont,
                fontSize: '14px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: isActive ? '0 12px 30px rgba(0,0,0,0.12)' : 'none',
              }}
            >
              <span
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  background: isActive ? 'rgba(255,255,255,0.12)' : '#F8F8F8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={17} />
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>

      <StatusMessage type="error" message={error} />
      <StatusMessage type="success" message={success} />

      {activeTab === 'account' && (
        <form onSubmit={handleSaveAccount} style={{ ...cardStyle, padding: '26px' }}>
          <div style={{ marginBottom: '28px' }}>
            <h2 style={sectionTitleStyle}>Konto</h2>
            <p style={sectionDescriptionStyle}>
              Persönliche Einstellungen für dein Benutzerkonto.
            </p>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <FieldLabel>Profilbild</FieldLabel>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '999px',
                  background: avatarUrl ? `url(${avatarUrl}) center / cover` : BRAND.black,
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                  fontWeight: 820,
                  flexShrink: 0,
                }}
              >
                {!avatarUrl && initials}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                style={{ display: 'none' }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  height: '38px',
                  padding: '0 15px',
                  borderRadius: '12px',
                  border: 'none',
                  background: uploading ? '#9CA3AF' : BRAND.black,
                  color: '#FFFFFF',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: 780,
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  fontFamily: pageFont,
                }}
              >
                <Upload size={15} />
                {uploading ? 'Wird hochgeladen...' : 'Foto hochladen'}
              </button>

              <div
                style={{
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 11px',
                  borderRadius: '999px',
                  border: `1px solid ${BRAND.border}`,
                  background: '#FAFAFA',
                  color: BRAND.muted,
                  fontSize: '12px',
                  fontWeight: 760,
                }}
              >
                <Shield size={14} />
                {getRoleLabel(resolvedRole)}
              </div>
            </div>
          </div>

          <div className="opc-settings-grid-2" style={twoColumnGridStyle}>
            <div>
              <FieldLabel>Vollständiger Name</FieldLabel>
              <TextInput value={fullName} onChange={setFullName} placeholder="Name eingeben" />
            </div>

            <div>
              <FieldLabel>Benutzername</FieldLabel>
              <TextInput value={username} onChange={setUsername} placeholder="Benutzername eingeben" />
            </div>
          </div>

          <div className="opc-settings-grid-2" style={twoColumnGridStyle}>
            <div>
              <FieldLabel>E-Mail</FieldLabel>
              <TextInput value={email} disabled />
              <p style={{ margin: '7px 0 0', color: BRAND.muted, fontSize: '12px', fontWeight: 560 }}>
                E-Mail kann nicht geändert werden.
              </p>
            </div>

            <div>
              <FieldLabel>Telefon</FieldLabel>
              <TextInput value={phone} onChange={setPhone} placeholder="+41 ..." />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <FieldLabel>Firma</FieldLabel>
            <TextInput value={company} onChange={setCompany} placeholder="Firmenname eingeben" />
          </div>

          <div
            className="opc-settings-grid-3"
            style={{
              borderTop: `1px solid ${BRAND.border}`,
              paddingTop: '24px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '18px',
            }}
          >
            <div>
              <FieldLabel>Sprache</FieldLabel>
              <SelectInput value={language} onChange={setLanguage}>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </SelectInput>
            </div>

            <div>
              <FieldLabel>Zeitzone</FieldLabel>
              <SelectInput value={timezone} onChange={setTimezone}>
                <option value="Europe/Zurich">Europe/Zurich</option>
                <option value="Europe/Berlin">Europe/Berlin</option>
                <option value="Europe/Tirana">Europe/Tirana</option>
                <option value="America/New_York">America/New_York</option>
              </SelectInput>
            </div>

            <div>
              <FieldLabel>Design</FieldLabel>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                }}
              >
                {[
                  { value: 'light', label: 'Hell' },
                  { value: 'dark', label: 'Dunkel' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    style={{
                      height: '46px',
                      borderRadius: '13px',
                      border: `1px solid ${theme === option.value ? BRAND.black : BRAND.border}`,
                      background: theme === option.value ? BRAND.black : '#FFFFFF',
                      color: theme === option.value ? '#FFFFFF' : BRAND.text,
                      fontSize: '13px',
                      fontWeight: 780,
                      cursor: 'pointer',
                      fontFamily: pageFont,
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={buttonRowStyle}>
            <button type="submit" disabled={saving} style={primaryButtonStyle}>
              <Save size={16} />
              {saving ? 'Speichern...' : 'Änderungen speichern'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'notifications' && (
        <section style={{ ...cardStyle, padding: '26px' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={sectionTitleStyle}>Benachrichtigungen</h2>
            <p style={sectionDescriptionStyle}>
              Lege fest, welche Updates du per E-Mail oder im System erhalten möchtest.
            </p>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            <Toggle
              checked={notifications.projectUpdates}
              onChange={(value) => setNotifications((prev) => ({ ...prev, projectUpdates: value }))}
              label="Projektupdates"
              description="Updates zu laufenden Projekten, Fortschritt und Änderungen."
            />

            <Toggle
              checked={notifications.newMessages}
              onChange={(value) => setNotifications((prev) => ({ ...prev, newMessages: value }))}
              label="Neue Nachrichten"
              description="Benachrichtigung, wenn neue Nachrichten im Portal eingehen."
            />

            <Toggle
              checked={notifications.fileUploads}
              onChange={(value) => setNotifications((prev) => ({ ...prev, fileUploads: value }))}
              label="Dateien und Uploads"
              description="Hinweise, wenn neue Berichte, Bilder oder Dokumente hochgeladen werden."
            />

            <Toggle
              checked={notifications.billing}
              onChange={(value) => setNotifications((prev) => ({ ...prev, billing: value }))}
              label="Rechnungen und Zahlungen"
              description="Benachrichtigungen zu Rechnungen, Zahlungen und offenen Beträgen."
            />

            {(resolvedRole === 'owner' || resolvedRole === 'admin') && (
              <>
                <Toggle
                  checked={notifications.dispatchAlerts}
                  onChange={(value) =>
                    setNotifications((prev) => ({ ...prev, dispatchAlerts: value }))
                  }
                  label="Dispatch Alerts"
                  description="Meldungen zu Einsätzen, Mitarbeiterstatus und operativen Änderungen."
                />

                <Toggle
                  checked={notifications.reportApprovals}
                  onChange={(value) =>
                    setNotifications((prev) => ({ ...prev, reportApprovals: value }))
                  }
                  label="Freigaben für Berichte"
                  description="Hinweise, wenn Berichte geprüft oder an Kunden gesendet werden müssen."
                />
              </>
            )}

            <Toggle
              checked={notifications.pushNotifications}
              onChange={(value) =>
                setNotifications((prev) => ({ ...prev, pushNotifications: value }))
              }
              label="Push-Benachrichtigungen"
              description="Vorbereitet für spätere Portal- und Mobile-Benachrichtigungen."
            />
          </div>

          <div style={buttonRowStyle}>
            <button type="button" disabled={saving} onClick={handleSaveNotifications} style={primaryButtonStyle}>
              <Save size={16} />
              {saving ? 'Speichern...' : 'Benachrichtigungen speichern'}
            </button>
          </div>
        </section>
      )}

      {activeTab === 'security' && (
        <section style={{ ...cardStyle, padding: '26px' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={sectionTitleStyle}>Sicherheit</h2>
            <p style={sectionDescriptionStyle}>
              Verwalte Passwort und Sicherheitseinstellungen für dein Konto.
            </p>
          </div>

          <form onSubmit={handleChangePassword}>
            <div style={{ display: 'grid', gap: '16px', maxWidth: '680px' }}>
              <div>
                <FieldLabel>Aktuelles Passwort</FieldLabel>
                <PasswordField
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  visible={showCurrentPassword}
                  onToggle={() => setShowCurrentPassword((prev) => !prev)}
                  placeholder="Aktuelles Passwort"
                />
              </div>

              <div>
                <FieldLabel>Neues Passwort</FieldLabel>
                <PasswordField
                  value={newPassword}
                  onChange={setNewPassword}
                  visible={showNewPassword}
                  onToggle={() => setShowNewPassword((prev) => !prev)}
                  placeholder="Mindestens 8 Zeichen"
                />
              </div>

              <div>
                <FieldLabel>Neues Passwort bestätigen</FieldLabel>
                <PasswordField
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  visible={showConfirmPassword}
                  onToggle={() => setShowConfirmPassword((prev) => !prev)}
                  placeholder="Passwort wiederholen"
                />
              </div>
            </div>

            <div
              style={{
                marginTop: '24px',
                padding: '16px',
                borderRadius: '16px',
                border: `1px solid ${BRAND.border}`,
                background: '#FAFAFA',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
              }}
            >
              <MonitorCog size={18} color={BRAND.muted} style={{ marginTop: '2px' }} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 780, color: BRAND.text, marginBottom: '4px' }}>
                  Zwei-Faktor-Authentifizierung
                </div>
                <div style={{ fontSize: '13px', fontWeight: 540, color: BRAND.muted, lineHeight: 1.5 }}>
                  Diese Funktion ist vorbereitet und kann später mit Supabase Auth oder einem externen Anbieter aktiviert werden.
                </div>
              </div>
            </div>

            <div style={buttonRowStyle}>
              <button type="submit" disabled={saving} style={primaryButtonStyle}>
                <Lock size={16} />
                {saving ? 'Aktualisieren...' : 'Passwort aktualisieren'}
              </button>
            </div>
          </form>
        </section>
      )}

      {activeTab === 'system' && isOwner && (
        <section style={{ ...cardStyle, padding: '26px' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={sectionTitleStyle}>System</h2>
            <p style={sectionDescriptionStyle}>
              Owner-Einstellungen für Portalverhalten, Standards und interne Abläufe.
            </p>
          </div>

          <div
            className="opc-settings-grid-2"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '18px',
              marginBottom: '20px',
            }}
          >
            <div>
              <FieldLabel>System-Firmenname</FieldLabel>
              <TextInput
                value={systemSettings.companyDisplayName}
                onChange={(value) =>
                  setSystemSettings((prev) => ({ ...prev, companyDisplayName: value }))
                }
                placeholder="Orange Pro Clean GmbH"
              />
            </div>

            <div>
              <FieldLabel>Standard-Zeitzone</FieldLabel>
              <SelectInput
                value={systemSettings.defaultTimezone}
                onChange={(value) =>
                  setSystemSettings((prev) => ({ ...prev, defaultTimezone: value }))
                }
              >
                <option value="Europe/Zurich">Europe/Zurich</option>
                <option value="Europe/Berlin">Europe/Berlin</option>
                <option value="Europe/Tirana">Europe/Tirana</option>
              </SelectInput>
            </div>

            <div>
              <FieldLabel>Standardsprache</FieldLabel>
              <SelectInput
                value={systemSettings.defaultLanguage}
                onChange={(value) =>
                  setSystemSettings((prev) => ({ ...prev, defaultLanguage: value }))
                }
              >
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </SelectInput>
            </div>

            <div>
              <FieldLabel>Aktive Rolle</FieldLabel>
              <TextInput value={getRoleLabel(resolvedRole)} disabled />
            </div>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            <Toggle
              checked={systemSettings.allowClientUploads}
              onChange={(value) =>
                setSystemSettings((prev) => ({ ...prev, allowClientUploads: value }))
              }
              label="Kunden-Uploads erlauben"
              description="Kunden können später Dateien direkt im Portal hochladen."
            />

            <Toggle
              checked={systemSettings.enableEmployeePortal}
              onChange={(value) =>
                setSystemSettings((prev) => ({ ...prev, enableEmployeePortal: value }))
              }
              label="Mitarbeiter-Portal aktivieren"
              description="Mitarbeiter können eigene Profile, Einsätze und Aufgaben verwalten."
            />

            <Toggle
              checked={systemSettings.enableReportApproval}
              onChange={(value) =>
                setSystemSettings((prev) => ({ ...prev, enableReportApproval: value }))
              }
              label="Berichtsfreigabe verwenden"
              description="Berichte müssen intern geprüft werden, bevor Kunden sie sehen."
            />

            <Toggle
              checked={systemSettings.enableDispatchNotifications}
              onChange={(value) =>
                setSystemSettings((prev) => ({ ...prev, enableDispatchNotifications: value }))
              }
              label="Dispatch-Benachrichtigungen"
              description="Operative Alerts für neue Einsätze, Statuswechsel und Mitarbeiterantworten."
            />
          </div>

          <div style={buttonRowStyle}>
            <button type="button" disabled={saving} onClick={handleSaveSystem} style={primaryButtonStyle}>
              <Save size={16} />
              {saving ? 'Speichern...' : 'System speichern'}
            </button>
          </div>
        </section>
      )}

      <style>{`
        @media (max-width: 980px) {
          .opc-settings-tabs {
            grid-template-columns: 1fr 1fr !important;
          }

          .opc-settings-grid-3 {
            grid-template-columns: 1fr 1fr !important;
          }
        }

        @media (max-width: 680px) {
          .opc-settings-tabs,
          .opc-settings-grid-2,
          .opc-settings-grid-3 {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

const twoColumnGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '18px',
  marginBottom: '18px',
};

const buttonRowStyle: CSSProperties = {
  marginTop: '26px',
  paddingTop: '18px',
  borderTop: `1px solid ${BRAND.border}`,
  display: 'flex',
  justifyContent: 'flex-end',
};