import { useState } from 'react';
import { getSupabaseClient } from '../lib/supabase-client';
import { baseUrl } from '../lib/base-url';

const ORANGE_PRO_CLEAN_LOGO =
  'https://cdn.prod.website-files.com/6944470386300e196e5fc347/6949534529e8342842456097_REGULAR%20COLOR%20ORANGE%20PRO%20CLEAN%20LOGO%20ORIGINAL.png';

export default function MirakaForgotPassword() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setEmailError('');
    setStatusMessage('');
    setErrorMessage('');

    if (!email.trim()) {
      setEmailError('Bitte geben Sie Ihre E-Mail-Adresse ein.');
      return;
    }

    if (!validateEmail(email.trim())) {
      setEmailError('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseClient();

      const redirectUrl = `${window.location.origin}${baseUrl}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      });

      if (error) {
        throw new Error(error.message);
      }

      setStatusMessage(
        'Wenn diese E-Mail-Adresse registriert ist, wurde ein Link zum Zurücksetzen des Passworts gesendet.'
      );
    } catch (error: any) {
      setErrorMessage(error?.message || 'Der Link konnte nicht gesendet werden. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#FFFFFF',
        padding: '16px',
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #F0F0F0',
          maxWidth: '420px',
          width: '100%',
          padding: '32px 24px',
          boxSizing: 'border-box',
        }}
      >

        <div
          style={{
            textAlign: 'center',
            marginBottom: '24px',
          }}
        >
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: '#000000',
              margin: '0 0 8px',
              letterSpacing: '-0.02em',
            }}
          >
            Passwort vergessen?
          </h1>

          <p
            style={{
              fontSize: '14px',
              color: '#666666',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Geben Sie Ihre E-Mail-Adresse ein. Wir senden Ihnen einen Link zum Zurücksetzen des Passworts.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
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
              }}
            >
              E-Mail
            </label>

            <input
              type="email"
              id="email"
              placeholder="name@beispiel.ch"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailError('');
                setErrorMessage('');
                setStatusMessage('');
              }}
              disabled={loading}
              autoComplete="email"
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
                boxSizing: 'border-box',
              }}
              onFocus={(event) => {
                if (!emailError) {
                  event.currentTarget.style.borderColor = '#000000';
                }
              }}
              onBlur={(event) => {
                event.currentTarget.style.borderColor = emailError ? '#EF4444' : '#E5E5E5';
              }}
            />

            {emailError && (
              <span
                style={{
                  display: 'block',
                  fontSize: '13px',
                  color: '#EF4444',
                  marginTop: '6px',
                }}
              >
                {emailError}
              </span>
            )}
          </div>

          {errorMessage && (
            <div
              style={{
                marginBottom: '18px',
                padding: '12px',
                background: '#FEE2E2',
                borderRadius: '8px',
                border: '1px solid #EF4444',
              }}
            >
              <span
                style={{
                  fontSize: '14px',
                  color: '#991B1B',
                  display: 'block',
                  lineHeight: 1.5,
                }}
              >
                {errorMessage}
              </span>
            </div>
          )}

          {statusMessage && (
            <div
              style={{
                marginBottom: '18px',
                padding: '12px',
                background: '#DCFCE7',
                borderRadius: '8px',
                border: '1px solid #86EFAC',
              }}
            >
              <span
                style={{
                  fontSize: '14px',
                  color: '#166534',
                  display: 'block',
                  lineHeight: 1.5,
                }}
              >
                {statusMessage}
              </span>
            </div>
          )}

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
              marginBottom: '0px',
            }}
            onMouseEnter={(event) => {
              if (!loading) {
                event.currentTarget.style.background = '#111111';
              }
            }}
            onMouseLeave={(event) => {
              if (!loading) {
                event.currentTarget.style.background = '#000000';
              }
            }}
          >
            {loading ? 'WIRD GESENDET...' : 'LINK SENDEN'}
          </button>

          <div
            style={{
              textAlign: 'center',
              marginTop: '16px',
            }}
          >
            <a
              href={`${baseUrl}/`}
              style={{
                fontSize: '14px',
                color: '#666666',
                textDecoration: 'none',
                transition: 'color 0.2s ease',
                fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.color = '#000000';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.color = '#666666';
              }}
            >
              Zurück zur Anmeldung
            </a>
          </div>
        </form>

        <div
          style={{
            textAlign: 'center',
            marginTop: '32px',
            paddingTop: '18px',
            borderTop: '1px solid #F0F0F0',
          }}
        >
          <p
            style={{
              fontSize: '13px',
              color: '#999999',
              margin: 0,
            }}
          >
            © 2026 Miraka & Co. GmbH. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}