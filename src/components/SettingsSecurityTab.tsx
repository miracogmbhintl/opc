/**
 * Security Tab Component for Settings Page
 * Separate file for easier maintenance
 */

import { Save, Eye, EyeOff } from 'lucide-react';

interface SecurityTabProps {
  language: string;
  tr: (de: string, en: string) => string;
  oldPassword: string;
  setOldPassword: (val: string) => void;
  newPassword: string;
  setNewPassword: (val: string) => void;
  confirmPassword: string;
  setConfirmPassword: (val: string) => void;
  showOldPassword: boolean;
  setShowOldPassword: (val: boolean) => void;
  showNewPassword: boolean;
  setShowNewPassword: (val: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (val: boolean) => void;
  twoFactorEnabled: boolean;
  setTwoFactorEnabled: (val: boolean) => void;
  saving: boolean;
  handleChangePassword: (e: React.FormEvent) => void;
  Toggle: React.ComponentType<{ checked: boolean; onChange: (val: boolean) => void }>;
}

export default function SecurityTab({
  language,
  tr,
  oldPassword,
  setOldPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  showOldPassword,
  setShowOldPassword,
  showNewPassword,
  setShowNewPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  twoFactorEnabled,
  setTwoFactorEnabled,
  saving,
  handleChangePassword,
  Toggle
}: SecurityTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Change Password */}
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
          {tr('Passwort ändern', 'Change Password')}
        </h3>

        <form onSubmit={handleChangePassword}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Current Password */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '10px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#1A1A1A',
                fontFamily: 'Inter, sans-serif'
              }}>
                {tr('Aktuelles Passwort', 'Current Password')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showOldPassword ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder={tr('Aktuelles Passwort eingeben', 'Enter current password')}
                  disabled={saving}
                  style={{
                    width: '100%',
                    padding: '12px 48px 12px 16px',
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
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    color: '#6B7280'
                  }}
                >
                  {showOldPassword ? <EyeOff size={18} /> : <Eye size={18} />}
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
                {tr('Neues Passwort', 'New Password')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={tr('Neues Passwort eingeben', 'Enter new password')}
                  disabled={saving}
                  style={{
                    width: '100%',
                    padding: '12px 48px 12px 16px',
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
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    color: '#6B7280'
                  }}
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <span style={{
                display: 'block',
                marginTop: '8px',
                fontSize: '13px',
                color: '#6B7280',
                fontFamily: 'Inter, sans-serif'
              }}>
                {tr('Mindestens 8 Zeichen', 'Must be at least 8 characters')}
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
                {tr('Neues Passwort bestätigen', 'Confirm New Password')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={tr('Neues Passwort bestätigen', 'Confirm new password')}
                  disabled={saving}
                  style={{
                    width: '100%',
                    padding: '12px 48px 12px 16px',
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
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    color: '#6B7280'
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Update Button */}
            <div style={{
              paddingTop: '12px',
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
                <span>{saving ? tr('Wird aktualisiert...', 'Updating...') : tr('Passwort aktualisieren', 'Update Password')}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Two-Factor Authentication */}
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
          marginBottom: '12px',
          fontFamily: 'Inter, sans-serif'
        }}>
          {tr('Zwei-Faktor-Authentifizierung', 'Two-Factor Authentication')}
        </h3>
        <p style={{
          fontSize: '14px',
          color: '#6B7280',
          marginBottom: '24px',
          fontFamily: 'Inter, sans-serif'
        }}>
          {tr('Fügen Sie eine zusätzliche Sicherheitsebene zu Ihrem Konto hinzu', 'Add an extra layer of security to your account')}
        </p>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 18px',
          background: '#F9FAFB',
          borderRadius: '12px'
        }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#1A1A1A', marginBottom: '4px', fontFamily: 'Inter, sans-serif' }}>
              {tr('2FA-Status', '2FA Status')}
            </div>
            <div style={{ fontSize: '14px', color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>
              {twoFactorEnabled ? tr('Aktiviert', 'Enabled') : tr('Deaktiviert', 'Disabled')}
            </div>
          </div>
          <Toggle checked={twoFactorEnabled} onChange={setTwoFactorEnabled} />
        </div>
      </div>

      {/* Active Sessions */}
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
          marginBottom: '12px',
          fontFamily: 'Inter, sans-serif'
        }}>
          {tr('Aktive Sitzungen', 'Active Sessions')}
        </h3>
        <p style={{
          fontSize: '14px',
          color: '#6B7280',
          marginBottom: '24px',
          fontFamily: 'Inter, sans-serif'
        }}>
          {tr('Von allen Geräten außer diesem abmelden', 'Sign out from all devices except this one')}
        </p>
        <button
          type="button"
          style={{
            padding: '12px 24px',
            background: '#FFFFFF',
            color: '#DC2626',
            border: '1px solid #DC2626',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#DC2626';
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#FFFFFF';
            e.currentTarget.style.color = '#DC2626';
          }}
        >
          {tr('Alle Sitzungen beenden', 'Terminate All Sessions')}
        </button>
      </div>
    </div>
  );
}
