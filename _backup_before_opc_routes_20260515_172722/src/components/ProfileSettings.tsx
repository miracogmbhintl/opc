import { useState, useEffect, useRef } from 'react';
import { Camera, Save, X, Trash2, Download, Shield, Bell, Mail, Globe, Lock, User, AlertTriangle, ArrowLeft, Check, Phone, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface ProfileSettingsProps {
  baseUrl: string;
}

export default function ProfileSettings({ baseUrl }: ProfileSettingsProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  
  // User Data
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [language, setLanguage] = useState('en');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  // Company Info
  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [preferredContact, setPreferredContact] = useState<'phone' | 'email'>('email');
  
  // Security
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  
  // UI States
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteRequestDialog, setShowDeleteRequestDialog] = useState(false);
  const [deleteRequestSent, setDeleteRequestSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('mco_auth_token');
    
    if (!token) {
      window.location.href = baseUrl;
      return;
    }

    setIsAuthenticated(true);

    // Load user data from localStorage
    const userData = JSON.parse(localStorage.getItem('mco_user_data') || '{}');
    setFirstName(userData.firstName || 'John');
    setLastName(userData.lastName || 'Doe');
    setEmail(userData.email || 'john.doe@example.com');
    setAvatarUrl(userData.avatar || null);
    
    // Load company info
    const companyData = JSON.parse(localStorage.getItem('mco_company_data') || '{}');
    setCompanyName(companyData.name || '');
    setCompanyPhone(companyData.phone || '');
    setPreferredContact(companyData.preferredContact || 'email');
    
    // Load preferences
    const savedLang = localStorage.getItem('lang') || 'en';
    setLanguage(savedLang);
    
    const emailNotifsEnabled = localStorage.getItem('mco_email_notifications') !== 'false';
    setEmailNotifications(emailNotifsEnabled);
    
    const newsletter = localStorage.getItem('mco_newsletter_optin') === 'true';
    setNewsletterOptIn(newsletter);
  }, [baseUrl]);

  const getUserInitials = () => {
    const firstInitial = firstName.charAt(0).toUpperCase();
    const lastInitial = lastName.charAt(0).toUpperCase();
    return `${firstInitial}${lastInitial}`;
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
        triggerAutosave();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const triggerAutosave = () => {
    setSaveState('saving');
    
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    
    saveTimerRef.current = setTimeout(() => {
      // Save to localStorage
      const userData = {
        firstName,
        lastName,
        email,
        avatar: avatarPreview || avatarUrl,
        name: `${firstName} ${lastName}`
      };
      
      const companyData = {
        name: companyName,
        phone: companyPhone,
        preferredContact
      };
      
      localStorage.setItem('mco_user_data', JSON.stringify(userData));
      localStorage.setItem('mco_company_data', JSON.stringify(companyData));
      localStorage.setItem('lang', language);
      localStorage.setItem('mco_email_notifications', emailNotifications.toString());
      localStorage.setItem('mco_newsletter_optin', newsletterOptIn.toString());
      
      if (avatarPreview) {
        setAvatarUrl(avatarPreview);
        setAvatarPreview(null);
      }
      
      setSaveState('saved');
      
      setTimeout(() => {
        setSaveState('idle');
      }, 2000);
    }, 600);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    
    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Valid email is required';
    }
    
    if (newPassword) {
      if (!currentPassword) {
        newErrors.currentPassword = 'Current password is required';
      }
      if (newPassword.length < 8) {
        newErrors.newPassword = 'Password must be at least 8 characters';
      }
      if (newPassword !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleReturnHome = () => {
    window.location.href = `${baseUrl}/client-dashboard`;
  };

  const sendDeleteRequest = () => {
    setShowDeleteDialog(false);
    setShowDeleteRequestDialog(true);
  };

  const confirmDeleteRequest = () => {
    // Simulate sending delete request
    console.log('Delete request sent to team');
    
    setShowDeleteRequestDialog(false);
    setDeleteRequestSent(true);
    
    setTimeout(() => {
      setDeleteRequestSent(false);
    }, 4000);
  };

  const handleDownloadData = () => {
    const userData = {
      firstName,
      lastName,
      email,
      language,
      companyName,
      companyPhone,
      preferredContact,
      emailNotifications,
      newsletterOptIn
    };
    
    const dataStr = JSON.stringify(userData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'miraka-profile-data.json';
    link.click();
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F2F2F2]" style={{ paddingTop: '84px', paddingBottom: '120px' }}>
      <div className="miraka-container" style={{ maxWidth: '900px', margin: '0 auto', padding: '0 20px' }}>
        
        {/* RETURN HOME BUTTON */}
        <div className="mb-8 mt-12 animate-fade-in-up">
          <button
            onClick={handleReturnHome}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: 'transparent',
              border: '1px solid #E5E5E5',
              borderRadius: '12px',
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 600,
              fontSize: '14px',
              color: '#1A1A1A',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#FAFAFA';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <ArrowLeft size={18} />
            Home
          </button>
        </div>

        {/* PAGE HEADER */}
        <div className="mb-12 animate-fade-in-up">
          <h1 className="font-heading font-bold text-[#1A1A1A] mb-3" style={{ fontSize: '32px' }}>
            Your Profile
          </h1>
          <p className="font-body text-[#777]" style={{ fontSize: '16px' }}>
            Manage your account settings and preferences
          </p>
        </div>

        {/* DELETE REQUEST SUCCESS MESSAGE */}
        {deleteRequestSent && (
          <div 
            className="mb-8 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl animate-fade-in-up"
            style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
              <Check size={14} style={{ color: '#FFFFFF', strokeWidth: 3 }} />
            </div>
            <p className="font-body text-emerald-600 text-sm font-semibold">
              Your deletion request has been sent to our team.
            </p>
          </div>
        )}

        {/* AVATAR & BASIC INFO SECTION */}
        <div className="miraka-card animate-fade-in-up animate-delay-100" style={{ marginBottom: '48px' }}>
          <div className="flex flex-col md:flex-row items-start gap-6 mb-8">
            {/* Avatar Preview */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={handleAvatarClick}
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  border: '3px solid #1A1A1A',
                  backgroundColor: '#FAFAFA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  const overlay = e.currentTarget.querySelector('.avatar-overlay') as HTMLElement;
                  if (overlay) overlay.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  const overlay = e.currentTarget.querySelector('.avatar-overlay') as HTMLElement;
                  if (overlay) overlay.style.opacity = '0';
                }}
              >
                {(avatarPreview || avatarUrl) ? (
                  <img 
                    src={avatarPreview || avatarUrl || ''} 
                    alt="Profile"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                ) : (
                  <span style={{
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 600,
                    fontSize: '32px',
                    color: '#1A1A1A'
                  }}>
                    {getUserInitials()}
                  </span>
                )}
                
                <div 
                  className="avatar-overlay"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    opacity: 0,
                    transition: 'opacity 0.2s ease'
                  }}
                >
                  <Camera size={24} style={{ color: '#FFFFFF' }} />
                </div>
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                style={{ display: 'none' }}
              />
            </div>

            {/* Avatar Info */}
            <div style={{ flex: 1 }}>
              <h3 className="font-heading text-xl font-bold text-[#1A1A1A] mb-2">
                Profile Picture
              </h3>
              <p className="font-body text-sm text-[#6B6B6B] mb-4">
                Click on the avatar to upload a new picture. JPG, PNG or GIF (max. 2MB)
              </p>
              <button
                onClick={handleAvatarClick}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'transparent',
                  border: '1px solid #1A1A1A',
                  borderRadius: '12px',
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#1A1A1A',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#1A1A1A';
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#1A1A1A';
                }}
              >
                Change Avatar
              </button>
            </div>
          </div>

          {/* Basic Info Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <Label className="font-body text-sm font-medium text-[#1A1A1A] block" style={{ marginBottom: '10px' }}>
                First Name
              </Label>
              <Input
                id="profile-firstname"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  triggerAutosave();
                }}
                placeholder="Enter your first name"
                className={`bg-[#FFFFFF] border-[#E5E5E5] text-[#1A1A1A] h-12 ${errors.firstName ? 'border-red-500' : ''}`}
              />
              {errors.firstName && (
                <p className="font-body text-xs text-red-600 mt-1">{errors.firstName}</p>
              )}
            </div>

            <div>
              <Label className="font-body text-sm font-medium text-[#1A1A1A] block" style={{ marginBottom: '10px' }}>
                Last Name
              </Label>
              <Input
                id="profile-lastname"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  triggerAutosave();
                }}
                placeholder="Enter your last name"
                className={`bg-[#FFFFFF] border-[#E5E5E5] text-[#1A1A1A] h-12 ${errors.lastName ? 'border-red-500' : ''}`}
              />
              {errors.lastName && (
                <p className="font-body text-xs text-red-600 mt-1">{errors.lastName}</p>
              )}
            </div>

            <div>
              <Label className="font-body text-sm font-medium text-[#1A1A1A] block" style={{ marginBottom: '10px' }}>
                Email Address
              </Label>
              <Input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  triggerAutosave();
                }}
                placeholder="your.email@example.com"
                className={`bg-[#FFFFFF] border-[#E5E5E5] text-[#1A1A1A] h-12 ${errors.email ? 'border-red-500' : ''}`}
              />
              {errors.email && (
                <p className="font-body text-xs text-red-600 mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <Label className="font-body text-sm font-medium text-[#1A1A1A] block" style={{ marginBottom: '10px' }}>
                Language
              </Label>
              <div style={{ position: 'relative' }}>
                <select
                  id="profile-language"
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                    triggerAutosave();
                  }}
                  style={{
                    width: '100%',
                    height: '48px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E0E0E0',
                    borderRadius: '12px',
                    padding: '0 16px',
                    paddingRight: '40px',
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    fontSize: '15px',
                    color: '#1A1A1A',
                    cursor: 'pointer',
                    appearance: 'none',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FAFAFA'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#E0E0E0'}
                >
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                </select>
                <ChevronDown 
                  size={18} 
                  style={{
                    position: 'absolute',
                    right: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#6B6B6B',
                    pointerEvents: 'none'
                  }}
                />
              </div>
            </div>
          </div>

          {/* COMPANY INFORMATION SECTION */}
          <div style={{ borderTop: '1px solid #E5E5E5', paddingTop: '32px' }}>
            <h3 className="font-heading text-xl font-bold text-[#1A1A1A]" style={{ marginBottom: '20px' }}>
              Company Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="font-body text-sm font-medium text-[#1A1A1A] block" style={{ marginBottom: '10px' }}>
                  Company Name
                </Label>
                <Input
                  id="profile-companyname"
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    triggerAutosave();
                  }}
                  placeholder="Your company name"
                  className="bg-[#FFFFFF] border-[#E5E5E5] text-[#1A1A1A] h-12"
                />
              </div>

              <div>
                <Label className="font-body text-sm font-medium text-[#1A1A1A] block" style={{ marginBottom: '10px' }}>
                  Company Phone Number
                </Label>
                <Input
                  id="profile-companyphone"
                  value={companyPhone}
                  onChange={(e) => {
                    setCompanyPhone(e.target.value);
                    triggerAutosave();
                  }}
                  placeholder="+1 (555) 123-4567"
                  className="bg-[#FFFFFF] border-[#E5E5E5] text-[#1A1A1A] h-12"
                />
              </div>

              <div className="md:col-span-2">
                <Label className="font-body text-sm font-medium text-[#1A1A1A] block" style={{ marginBottom: '10px' }}>
                  Preferred Contact Method
                </Label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <button
                    onClick={() => {
                      setPreferredContact('phone');
                      triggerAutosave();
                    }}
                    style={{
                      flex: 1,
                      height: '48px',
                      borderRadius: '12px',
                      border: preferredContact === 'phone' ? 'none' : '1px solid #E5E5E5',
                      backgroundColor: preferredContact === 'phone' ? '#1A1A1A' : '#F5F5F5',
                      color: preferredContact === 'phone' ? '#FFFFFF' : '#1A1A1A',
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: 600,
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      if (preferredContact !== 'phone') {
                        e.currentTarget.style.backgroundColor = '#EFEFEF';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (preferredContact !== 'phone') {
                        e.currentTarget.style.backgroundColor = '#F5F5F5';
                      }
                    }}
                  >
                    <Phone size={18} />
                    Phone
                  </button>

                  <button
                    onClick={() => {
                      setPreferredContact('email');
                      triggerAutosave();
                    }}
                    style={{
                      flex: 1,
                      height: '48px',
                      borderRadius: '12px',
                      border: preferredContact === 'email' ? 'none' : '1px solid #E5E5E5',
                      backgroundColor: preferredContact === 'email' ? '#1A1A1A' : '#F5F5F5',
                      color: preferredContact === 'email' ? '#FFFFFF' : '#1A1A1A',
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: 600,
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      if (preferredContact !== 'email') {
                        e.currentTarget.style.backgroundColor = '#EFEFEF';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (preferredContact !== 'email') {
                        e.currentTarget.style.backgroundColor = '#F5F5F5';
                      }
                    }}
                  >
                    <Mail size={18} />
                    Email
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECURITY SECTION */}
        <div className="miraka-card animate-fade-in-up animate-delay-200" style={{ marginBottom: '48px' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#1A1A1A]/10 rounded-xl flex items-center justify-center">
              <Shield size={20} className="text-[#1A1A1A]" />
            </div>
            <div>
              <h3 className="font-heading text-xl font-bold text-[#1A1A1A]">Security</h3>
              <p className="font-body text-sm text-[#6B6B6B]">Manage your password and security settings</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <Label className="font-body text-sm font-medium text-[#1A1A1A] block" style={{ marginBottom: '10px' }}>
                Current Password
              </Label>
              <Input
                id="profile-currentpassword"
                type="password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                }}
                placeholder="Enter current password"
                className={`bg-[#FFFFFF] border-[#E5E5E5] text-[#1A1A1A] h-12 ${errors.currentPassword ? 'border-red-500' : ''}`}
              />
              {errors.currentPassword && (
                <p className="font-body text-xs text-red-600 mt-1">{errors.currentPassword}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="font-body text-sm font-medium text-[#1A1A1A] block" style={{ marginBottom: '10px' }}>
                  New Password
                </Label>
                <Input
                  id="profile-newpassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                  }}
                  placeholder="Enter new password"
                  className={`bg-[#FFFFFF] border-[#E5E5E5] text-[#1A1A1A] h-12 ${errors.newPassword ? 'border-red-500' : ''}`}
                />
                {errors.newPassword && (
                  <p className="font-body text-xs text-red-600 mt-1">{errors.newPassword}</p>
                )}
              </div>

              <div>
                <Label className="font-body text-sm font-medium text-[#1A1A1A] block" style={{ marginBottom: '10px' }}>
                  Confirm New Password
                </Label>
                <Input
                  id="profile-confirmpassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                  }}
                  placeholder="Confirm new password"
                  className={`bg-[#FFFFFF] border-[#E5E5E5] text-[#1A1A1A] h-12 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                />
                {errors.confirmPassword && (
                  <p className="font-body text-xs text-red-600 mt-1">{errors.confirmPassword}</p>
                )}
              </div>
            </div>

            {/* Two-Factor Authentication - COMING SOON */}
            <div style={{ marginTop: '32px' }}>
              <div 
                className="p-4 bg-[#FAFAFA] rounded-xl border border-[#E5E5E5]"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.6 }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <h4 className="font-heading font-semibold text-sm text-[#1A1A1A]">
                      Two-Factor Authentication
                    </h4>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        backgroundColor: '#CCCCCC',
                        color: '#FFFFFF',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                    >
                      Coming Soon
                    </span>
                  </div>
                  <p className="font-body text-xs text-[#6B6B6B]">
                    Add an extra layer of security to your account
                  </p>
                </div>
                <div
                  style={{
                    width: '48px',
                    height: '28px',
                    borderRadius: '14px',
                    backgroundColor: '#E5E5E5',
                    position: 'relative',
                    cursor: 'not-allowed'
                  }}
                >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '10px',
                      backgroundColor: '#FFFFFF',
                      position: 'absolute',
                      top: '4px',
                      left: '4px'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PREFERENCES / NOTIFICATIONS SECTION */}
        <div className="miraka-card animate-fade-in-up animate-delay-300" style={{ marginBottom: '48px' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#1A1A1A]/10 rounded-xl flex items-center justify-center">
              <Bell size={20} className="text-[#1A1A1A]" />
            </div>
            <div>
              <h3 className="font-heading text-xl font-bold text-[#1A1A1A]">Preferences & Notifications</h3>
              <p className="font-body text-sm text-[#6B6B6B]">Customize how you receive updates</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Email Notifications */}
            <div 
              className="p-4 bg-[#FAFAFA] rounded-xl border border-[#E5E5E5]"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div>
                <h4 className="font-heading font-semibold text-sm text-[#1A1A1A] mb-1">
                  Email Notifications
                </h4>
                <p className="font-body text-xs text-[#6B6B6B]">
                  Receive email updates about your projects and tasks
                </p>
              </div>
              <button
                onClick={() => {
                  setEmailNotifications(!emailNotifications);
                  triggerAutosave();
                }}
                style={{
                  width: '48px',
                  height: '28px',
                  borderRadius: '14px',
                  backgroundColor: emailNotifications ? '#1A1A1A' : '#E5E5E5',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  border: 'none',
                  flexShrink: 0
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '10px',
                    backgroundColor: '#FFFFFF',
                    position: 'absolute',
                    top: '4px',
                    left: emailNotifications ? '24px' : '4px',
                    transition: 'left 0.2s ease'
                  }}
                />
              </button>
            </div>

            {/* Newsletter Opt-in */}
            <div 
              className="p-4 bg-[#FAFAFA] rounded-xl border border-[#E5E5E5]"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div>
                <h4 className="font-heading font-semibold text-sm text-[#1A1A1A] mb-1">
                  Newsletter Subscription
                </h4>
                <p className="font-body text-xs text-[#6B6B6B]">
                  Stay updated with our latest news and offers
                </p>
              </div>
              <button
                onClick={() => {
                  setNewsletterOptIn(!newsletterOptIn);
                  triggerAutosave();
                }}
                style={{
                  width: '48px',
                  height: '28px',
                  borderRadius: '14px',
                  backgroundColor: newsletterOptIn ? '#1A1A1A' : '#E5E5E5',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  border: 'none',
                  flexShrink: 0
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '10px',
                    backgroundColor: '#FFFFFF',
                    position: 'absolute',
                    top: '4px',
                    left: newsletterOptIn ? '24px' : '4px',
                    transition: 'left 0.2s ease'
                  }}
                />
              </button>
            </div>
          </div>
        </div>

        {/* DANGER ZONE */}
        <div className="miraka-card animate-fade-in-up animate-delay-400" style={{ borderColor: '#fee2e2', marginBottom: '48px' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div>
              <h3 className="font-heading text-xl font-bold text-red-600">Danger Zone</h3>
              <p className="font-body text-sm text-[#6B6B6B]">Irreversible actions — proceed with caution</p>
            </div>
          </div>

          <div className="space-y-4">
            <div 
              className="p-4 bg-[#FAFAFA] rounded-xl border border-[#E5E5E5]"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}
            >
              <div>
                <h4 className="font-heading font-semibold text-sm text-[#1A1A1A] mb-1">
                  Download Your Data
                </h4>
                <p className="font-body text-xs text-[#6B6B6B]">
                  Export all your personal data in JSON format
                </p>
              </div>
              <button
                onClick={handleDownloadData}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'transparent',
                  border: '1px solid #1A1A1A',
                  borderRadius: '12px',
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#1A1A1A',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#1A1A1A';
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#1A1A1A';
                }}
              >
                <Download size={16} />
                Download
              </button>
            </div>

            <div 
              className="p-4 bg-red-50 rounded-xl border border-red-200"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}
            >
              <div>
                <h4 className="font-heading font-semibold text-sm text-red-600 mb-1">
                  Delete Account
                </h4>
                <p className="font-body text-xs text-[#6B6B6B]">
                  Request account deletion — a team member will review
                </p>
              </div>
              <button
                onClick={sendDeleteRequest}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'transparent',
                  border: '1px solid #DC2626',
                  borderRadius: '12px',
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#DC2626',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#DC2626';
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#DC2626';
                }}
              >
                <Trash2 size={16} />
                Request Deletion
              </button>
            </div>
          </div>
        </div>

        {/* SAVE BUTTON - ALWAYS VISIBLE WITH STATE */}
        <div 
          className="sticky bottom-0 bg-[#F2F2F2] py-6 animate-fade-in-up animate-delay-500"
          style={{ 
            borderTop: '1px solid #E5E5E5',
            marginLeft: '-20px',
            marginRight: '-20px',
            paddingLeft: '20px',
            paddingRight: '20px'
          }}
        >
          <button
            id="save-button"
            disabled={saveState === 'saving' || saveState === 'saved'}
            style={{
              width: '100%',
              height: '50px',
              backgroundColor: saveState === 'saving' || saveState === 'saved' ? '#E5E5E5' : '#1A1A1A',
              border: 'none',
              borderRadius: '12px',
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 600,
              fontSize: '15px',
              color: saveState === 'saving' || saveState === 'saved' ? '#A0A0A0' : '#FFFFFF',
              cursor: saveState === 'saving' || saveState === 'saved' ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {saveState === 'saving' ? (
              <>
                <div className="w-4 h-4 border-2 border-[#A0A0A0] border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </>
            ) : saveState === 'saved' ? (
              <>
                <Check size={18} />
                Changes Saved
              </>
            ) : (
              <>
                <Save size={18} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* DELETE ACCOUNT CONFIRMATION DIALOG */}
      {showDeleteDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px'
          }}
          onClick={() => setShowDeleteDialog(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '500px',
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '40px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-4">
              <AlertTriangle size={24} className="text-red-600" />
            </div>

            <h2 style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: '24px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '12px'
            }}>
              Request Account Deletion?
            </h2>

            <p style={{
              fontFamily: 'Helvetica, Arial, sans-serif',
              fontSize: '15px',
              color: '#6B6B6B',
              marginBottom: '32px',
              lineHeight: '1.6'
            }}>
              Are you sure you want to request account deletion? A team member will review your request and contact you before any action is taken.
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowDeleteDialog(false)}
                style={{
                  flex: 1,
                  height: '48px',
                  backgroundColor: 'transparent',
                  border: '1px solid #E5E5E5',
                  borderRadius: '12px',
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#1A1A1A',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FAFAFA'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setShowDeleteRequestDialog(true);
                }}
                style={{
                  flex: 1,
                  height: '48px',
                  backgroundColor: '#DC2626',
                  border: 'none',
                  borderRadius: '12px',
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#B91C1C'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#DC2626'}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE REQUEST CONFIRMATION DIALOG */}
      {showDeleteRequestDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px'
          }}
          onClick={() => setShowDeleteRequestDialog(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '500px',
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '40px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center mb-4">
              <AlertTriangle size={24} className="text-amber-600" />
            </div>

            <h2 style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: '24px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '12px'
            }}>
              Are you sure?
            </h2>

            <p style={{
              fontFamily: 'Helvetica, Arial, sans-serif',
              fontSize: '15px',
              color: '#6B6B6B',
              marginBottom: '32px',
              lineHeight: '1.6'
            }}>
              A team member will review your request and may contact you before proceeding. You can cancel this request at any time by contacting support.
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowDeleteRequestDialog(false)}
                style={{
                  flex: 1,
                  height: '48px',
                  backgroundColor: 'transparent',
                  border: '1px solid #E5E5E5',
                  borderRadius: '12px',
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#1A1A1A',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FAFAFA'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Cancel
              </button>

              <button
                onClick={confirmDeleteRequest}
                style={{
                  flex: 1,
                  height: '48px',
                  backgroundColor: '#1A1A1A',
                  border: 'none',
                  borderRadius: '12px',
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#000000'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1A1A1A'}
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
