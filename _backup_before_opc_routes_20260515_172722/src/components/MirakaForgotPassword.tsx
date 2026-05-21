import { useState } from 'react';
import { getSupabaseClient } from '../lib/supabase-client';
import { baseUrl } from '../lib/base-url';
import { useTranslation } from '../lib/TranslationContext';

export default function MirakaForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [emailError, setEmailError] = useState('');

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailError('');

    // Validation
    if (!email) {
      setEmailError(t.errors.required);
      return;
    }

    if (!validateEmail(email)) {
      setEmailError(t.errors.invalidEmail);
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      
      // Send password reset email
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${baseUrl}/miraka-co-portal/reset-password`,
      });

      if (resetError) {
        console.error('Reset password error:', resetError);
        throw new Error(resetError.message);
      }

      setSuccess(true);

    } catch (err: any) {
      console.error('Forgot password error:', err);
      setError(err.message || t.errors.generic);
      setLoading(false);
    }
  };

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
            Check Your Email
          </h2>

          {/* Message */}
          <p style={{
            fontSize: '15px',
            color: '#666666',
            marginBottom: '24px',
            lineHeight: 1.6,
            fontFamily: "'Inter', 'Helvetica Neue', sans-serif"
          }}>
            We've sent a password reset link to <strong>{email}</strong>. 
            Please check your email and click the link to reset your password.
          </p>

          {/* Info Box */}
          <div style={{
            background: '#F5F5F5',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
            textAlign: 'left'
          }}>
            <p style={{
              fontSize: '13px',
              color: '#666666',
              margin: 0,
              lineHeight: 1.6,
              fontFamily: "'Inter', 'Helvetica Neue', sans-serif"
            }}>
              <strong>Didn't receive the email?</strong><br />
              • Check your spam/junk folder<br />
              • Make sure you entered the correct email<br />
              • Wait a few minutes and check again
            </p>
          </div>

          {/* Back to Login Button */}
          <a 
            href={`${baseUrl}/miraka-co-portal`}
            style={{
              width: '100%',
              height: '48px',
              background: '#000000',
              color: '#FFFFFF',
              fontSize: '15px',
              fontWeight: 600,
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#111111';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#000000';
            }}
          >
            Back to Login
          </a>
        </div>
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
            {t.auth.forgotPassword}
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#666666',
            margin: 0,
            fontFamily: "'Inter', 'Helvetica Neue', sans-serif"
          }}>
            Enter your email and we'll send you a link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Email Field */}
          <div style={{ marginBottom: '18px' }}>
            <label 
              htmlFor="email"
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
              {t.auth.email}
            </label>
            <input
              type="email"
              id="email"
              placeholder={t.auth.emailPlaceholder}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError('');
                setError('');
              }}
              disabled={loading}
              style={{
                width: '100%',
                height: '48px',
                padding: '0 16px',
                fontSize: '15px',
                borderRadius: '12px',
                border: `1.5px solid ${emailError ? '#EF4444' : '#E5E5E5'}`,
                background: '#FFFFFF',
                color: '#000000',
                outline: 'none',
                transition: 'border-color 0.2s ease',
                fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                if (!emailError) {
                  e.target.style.borderColor = '#000000';
                }
              }}
              onBlur={(e) => {
                if (!emailError) {
                  e.target.style.borderColor = '#E5E5E5';
                }
              }}
            />
            {emailError && (
              <span style={{
                display: 'block',
                fontSize: '13px',
                color: '#EF4444',
                marginTop: '6px',
                fontFamily: "'Inter', 'Helvetica Neue', sans-serif"
              }}>
                {emailError}
              </span>
            )}
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
            {loading ? t.status.loading.toUpperCase() : 'Send Reset Link'.toUpperCase()}
          </button>

          {/* Back to Login Link */}
          <div style={{
            textAlign: 'center',
            marginTop: '16px'
          }}>
            <a 
              href={`${baseUrl}/miraka-co-portal`}
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
