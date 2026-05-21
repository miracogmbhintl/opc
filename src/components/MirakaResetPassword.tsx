import { useState, useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabase-client';
import { baseUrl } from '../lib/base-url';
import { useTranslation } from '../lib/TranslationContext';

type PasswordStrength = 'weak' | 'medium' | 'strong';

export default function MirakaResetPassword() {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>('weak');
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  useEffect(() => {
    checkSession();
    
    // Listen for auth state changes
    const supabase = getSupabaseClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session);
      
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Password recovery mode detected');
        setIsRecoveryMode(true);
        setHasSession(true);
        setCheckingSession(false);
      } else if (event === 'SIGNED_IN' && session) {
        console.log('User signed in via magic link or recovery');
        setHasSession(true);
        setCheckingSession(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkSession = async () => {
    try {
      const supabase = getSupabaseClient();
      
      // Check URL hash for recovery tokens
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      
      console.log('URL hash params:', { type, hasAccessToken: !!accessToken });

      if (type === 'recovery' && accessToken) {
        console.log('Recovery link detected');
        setIsRecoveryMode(true);
        setHasSession(true);
        setCheckingSession(false);
        return;
      }

      // Check for existing session
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session check error:', error);
        throw error;
      }
      
      if (data.session) {
        console.log('Active session found');
        setHasSession(true);
      } else {
        console.log('No active session');
        setHasSession(false);
        setError('Invalid or expired reset link. Please request a new password reset.');
      }
    } catch (err: any) {
      console.error('Session check error:', err);
      setError('Unable to verify reset link. Please try again.');
    } finally {
      setCheckingSession(false);
    }
  };

  const calculatePasswordStrength = (pwd: string): PasswordStrength => {
    if (pwd.length < 8) return 'weak';
    
    let strength = 0;
    if (pwd.length >= 12) strength++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++;
    
    if (strength >= 3) return 'strong';
    if (strength >= 2) return 'medium';
    return 'weak';
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setPasswordStrength(calculatePasswordStrength(value));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!password) {
      setError(t.errors.required);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        console.error('Password update error:', updateError);
        throw updateError;
      }

      console.log('Password updated successfully');
      setSuccess(true);

      // Redirect after 3 seconds
      setTimeout(() => {
        window.location.href = `${baseUrl}/`;
      }, 3000);

    } catch (err: any) {
      console.error('Password update error:', err);
      setError(err.message || 'Failed to update password. Please try again.');
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F2F2F2',
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif"
      }}>
        <div style={{
          textAlign: 'center'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #E5E5E5',
            borderTopColor: '#000000',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <div style={{
            fontSize: '16px',
            color: '#666666'
          }}>
            {t.status.loading}
          </div>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!hasSession && !checkingSession) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F2F2F2',
        padding: '16px',
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif"
      }}>
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          maxWidth: '420px',
          width: '100%',
          padding: '40px 24px',
          textAlign: 'center'
        }}>
          {/* Error Icon */}
          <div style={{
            width: '64px',
            height: '64px',
            background: '#FEE2E2',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px'
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>

          {/* Title */}
          <h2 style={{
            fontSize: '22px',
            fontWeight: 600,
            color: '#000000',
            marginBottom: '12px',
            fontFamily: "'Poppins', sans-serif"
          }}>
            Invalid Reset Link
          </h2>

          {/* Message */}
          <p style={{
            fontSize: '15px',
            color: '#666666',
            marginBottom: '24px',
            lineHeight: 1.6
          }}>
            {error || 'This password reset link is invalid or has expired. Please request a new one.'}
          </p>

          {/* Back to Login Button */}
          <a 
            href={`${baseUrl}/forgot-password`}
            style={{
              width: '100%',
              height: '48px',
              background: '#000000',
              color: '#FFFFFF',
              fontSize: '15px',
              fontWeight: 600,
              borderRadius: '12px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '12px',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#111111';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#000000';
            }}
          >
            Request New Reset Link
          </a>

          <a 
            href={`${baseUrl}/`}
            style={{
              display: 'block',
              textAlign: 'center',
              fontSize: '14px',
              color: '#666666',
              textDecoration: 'none',
              fontFamily: "'Inter', 'Helvetica Neue', sans-serif"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#000000';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#666666';
            }}
          >
            ← Back to Login
          </a>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F2F2F2',
        padding: '16px',
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif"
      }}>
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          maxWidth: '420px',
          width: '100%',
          padding: '40px 24px',
          textAlign: 'center'
        }}>
          {/* Success Icon */}
          <div style={{
            width: '64px',
            height: '64px',
            background: '#D1FAE5',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px'
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          {/* Title */}
          <h2 style={{
            fontSize: '22px',
            fontWeight: 600,
            color: '#000000',
            marginBottom: '12px',
            fontFamily: "'Poppins', sans-serif"
          }}>
            Password Updated Successfully
          </h2>

          {/* Message */}
          <p style={{
            fontSize: '15px',
            color: '#666666',
            marginBottom: '24px',
            lineHeight: 1.6
          }}>
            Your password has been reset. Redirecting you to login...
          </p>

          {/* Loading Animation */}
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #E5E5E5',
            borderTopColor: '#10B981',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }} />
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F2F2F2',
      padding: '16px',
      fontFamily: "'Inter', 'Helvetica Neue', sans-serif"
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '20px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        maxWidth: '420px',
        width: '100%',
        padding: '32px 24px'
      }}>
        {/* Logo */}
        <div style={{
          textAlign: 'center',
          marginBottom: '24px'
        }}>
          <img 
            src="https://cdn.prod.website-files.com/68dc2b9c31cb83ac9f84a1af/68e0480bc44f1d28032afb51_LOGO%20MIRAKA%20%26%20CO%20PLAIN%20TEXT.png"
            alt="Miraka & Co."
            style={{
              maxWidth: '180px',
              width: '100%',
              height: 'auto'
            }}
          />
        </div>

        {/* Title */}
        <div style={{
          textAlign: 'center',
          marginBottom: '24px'
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 600,
            color: '#000000',
            marginBottom: '8px',
            fontFamily: "'Poppins', sans-serif"
          }}>
            Set New Password
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#666666',
            margin: 0,
            fontFamily: "'Inter', 'Helvetica Neue', sans-serif"
          }}>
            Please enter your new password below.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Password Field */}
          <div style={{ marginBottom: '18px' }}>
            <label 
              htmlFor="password"
              style={{
                display: 'block',
                fontWeight: 500,
                fontSize: '14px',
                color: '#000000',
                marginBottom: '6px',
                textAlign: 'left',
                fontFamily: "'Inter', 'Helvetica Neue', sans-serif"
              }}
            >
              New Password
            </label>
            <input
              type="password"
              id="password"
              placeholder="Enter new password (min 8 characters)"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                height: '48px',
                padding: '0 16px',
                fontSize: '15px',
                borderRadius: '12px',
                border: '1.5px solid #E5E5E5',
                background: '#FFFFFF',
                color: '#000000',
                outline: 'none',
                transition: 'border-color 0.2s ease',
                fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#000000';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#E5E5E5';
              }}
            />
            
            {/* Password Strength Indicator */}
            {password && (
              <div style={{
                display: 'flex',
                gap: '4px',
                marginTop: '8px'
              }}>
                <div style={{
                  flex: 1,
                  height: '4px',
                  borderRadius: '2px',
                  background: passwordStrength === 'weak' || passwordStrength === 'medium' || passwordStrength === 'strong' ? '#EF4444' : '#E5E5E5'
                }} />
                <div style={{
                  flex: 1,
                  height: '4px',
                  borderRadius: '2px',
                  background: passwordStrength === 'medium' || passwordStrength === 'strong' ? '#F59E0B' : '#E5E5E5'
                }} />
                <div style={{
                  flex: 1,
                  height: '4px',
                  borderRadius: '2px',
                  background: passwordStrength === 'strong' ? '#10B981' : '#E5E5E5'
                }} />
              </div>
            )}
            
            {password && (
              <div style={{
                fontSize: '13px',
                marginTop: '6px',
                fontFamily: "'Inter', 'Helvetica Neue', sans-serif"
              }}>
                Password strength: <strong style={{ 
                  color: passwordStrength === 'weak' ? '#EF4444' : passwordStrength === 'medium' ? '#F59E0B' : '#10B981'
                }}>
                  {passwordStrength.toUpperCase()}
                </strong>
              </div>
            )}
          </div>

          {/* Confirm Password Field */}
          <div style={{ marginBottom: '18px' }}>
            <label 
              htmlFor="confirmPassword"
              style={{
                display: 'block',
                fontWeight: 500,
                fontSize: '14px',
                color: '#000000',
                marginBottom: '6px',
                textAlign: 'left',
                fontFamily: "'Inter', 'Helvetica Neue', sans-serif"
              }}
            >
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError('');
              }}
              disabled={loading}
              style={{
                width: '100%',
                height: '48px',
                padding: '0 16px',
                fontSize: '15px',
                borderRadius: '12px',
                border: '1.5px solid #E5E5E5',
                background: '#FFFFFF',
                color: '#000000',
                outline: 'none',
                transition: 'border-color 0.2s ease',
                fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#000000';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#E5E5E5';
              }}
            />
          </div>

          {/* General Error Message */}
          {error && (
            <div style={{ 
              marginBottom: '18px',
              padding: '12px',
              background: '#FEE2E2',
              borderRadius: '8px',
              border: '1px solid #EF4444'
            }}>
              <span style={{
                fontSize: '14px',
                color: '#991B1B',
                display: 'block',
                fontFamily: "'Inter', 'Helvetica Neue', sans-serif"
              }}>
                {error}
              </span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: '48px',
              background: loading ? '#333333' : '#000000',
              color: '#FFFFFF',
              fontSize: '15px',
              fontWeight: 600,
              borderRadius: '12px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s ease',
              fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '12px'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#111111';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#000000';
              }
            }}
          >
            {loading ? t.status.loading.toUpperCase() : 'Update Password'.toUpperCase()}
          </button>

          {/* Back to Login Link */}
          <div style={{
            textAlign: 'center',
            marginTop: '16px'
          }}>
            <a 
              href={`${baseUrl}/`}
              style={{
                fontSize: '14px',
                color: '#666666',
                textDecoration: 'none',
                transition: 'color 0.2s ease',
                fontFamily: "'Inter', 'Helvetica Neue', sans-serif"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#000000';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#666666';
              }}
            >
              ← Back to Login
            </a>
          </div>
        </form>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: '32px',
          paddingTop: '20px',
          borderTop: '1px solid #F0F0F0'
        }}>
          <p style={{
            fontSize: '13px',
            color: '#999999',
            margin: 0,
            fontFamily: "'Inter', 'Helvetica Neue', sans-serif"
          }}>
            © 2025 M&CO. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
