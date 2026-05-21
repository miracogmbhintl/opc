import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import '../styles/miraka-portal.css';

export default function SetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [strength, setStrength] = useState('');
  const [isInvite, setIsInvite] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    calculateStrength(newPassword);
  }, [newPassword]);

  async function checkSession() {
    // Check if this is an invite link
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    const tokenHash = params.get('token_hash');
    
    console.log('[SetPassword] Checking session...');
    console.log('[SetPassword] Type:', type);
    console.log('[SetPassword] Token hash present:', !!tokenHash);

    if (type === 'invite') {
      console.log('[SetPassword] This is an invite link');
      setIsInvite(true);
    }

    // For invite links, Supabase automatically exchanges the token
    // Just verify we have a session
    const { data, error: sessionError } = await supabase.auth.getSession();

    console.log('[SetPassword] Session data:', data);
    console.log('[SetPassword] Session error:', sessionError);

    if (sessionError || !data.session) {
      // If no session, try to refresh
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      console.log('[SetPassword] Refresh attempt:', refreshData);
      console.log('[SetPassword] Refresh error:', refreshError);

      if (refreshError || !refreshData.session) {
        setError('Invalid or expired link. Please request a new invitation or password reset.');
        setReady(false);
        return;
      }
    }

    console.log('[SetPassword] Session is valid, ready to set password');
    setReady(true);
  }

  function calculateStrength(password: string) {
    if (password.length < 8) {
      setStrength('weak');
      return;
    }

    const hasLetters = /[a-zA-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);

    if (password.length >= 10 && hasLetters && hasNumbers && hasSpecial) {
      setStrength('strong');
    } else if (password.length >= 8 && hasLetters && hasNumbers) {
      setStrength('medium');
    } else {
      setStrength('weak');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      setLoading(false);
      return;
    }

    console.log('[SetPassword] Updating password...');

    const { data: userData, error: userError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    console.log('[SetPassword] Update result:', userData);
    console.log('[SetPassword] Update error:', userError);

    if (userError) {
      setError('Could not update password. The link may have expired. Error: ' + userError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);

    // Redirect to loading screen after 2 seconds
    setTimeout(() => {
      window.location.href = `${baseUrl}/auth-redirect`;
    }, 2000);
  }

  // Error state - invalid/expired link
  if (error && !ready) {
    return (
      <div className="miraka-portal-page">
        <div className="miraka-card miraka-card-centered">
          <div className="miraka-text-center">
            <div className="miraka-logo-text">MIRAKA & CO.</div>
            <h1 className="miraka-title">Invalid Link</h1>
          </div>

          <div className="miraka-message miraka-message-error">
            {error}
          </div>

          <a
            href={`${baseUrl}/miraka-co-portal/forgot-password`}
            className="miraka-btn miraka-btn-secondary miraka-btn-full miraka-mt-3"
            style={{ textDecoration: 'none', marginBottom: '12px' }}
          >
            Request New Password Reset
          </a>

          <a
            href={`${baseUrl}/miraka-co-portal`}
            className="miraka-btn miraka-btn-secondary miraka-btn-full"
            style={{ textDecoration: 'none' }}
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="miraka-portal-page">
        <div className="miraka-card miraka-card-centered">
          <div className="miraka-text-center">
            <div className="miraka-logo-text">MIRAKA & CO.</div>
            <h1 className="miraka-title">Password Set Successfully!</h1>
            <p className="miraka-subtitle">
              {isInvite 
                ? 'Welcome to Miraka & Co! Your account is ready.' 
                : 'Your account is now secured.'}
            </p>
          </div>

          <div className="miraka-message miraka-message-success">
            ✓ Password updated successfully. Redirecting to your dashboard...
          </div>

          <div className="miraka-loading-state" style={{ minHeight: 'auto', marginTop: '24px' }}>
            <div className="miraka-spinner miraka-spinner-large miraka-spinner-dark" />
          </div>
        </div>
      </div>
    );
  }

  // Loading state while checking session
  if (!ready) {
    return (
      <div className="miraka-portal-page">
        <div className="miraka-card miraka-card-centered">
          <div className="miraka-text-center">
            <div className="miraka-logo-text">MIRAKA & CO.</div>
            <h1 className="miraka-title">Verifying...</h1>
          </div>

          <div className="miraka-loading-state" style={{ minHeight: 'auto', marginTop: '24px' }}>
            <div className="miraka-spinner miraka-spinner-large miraka-spinner-dark" />
          </div>
        </div>
      </div>
    );
  }

  // Main form view
  return (
    <div className="miraka-portal-page">
      <div className="miraka-card miraka-card-centered">
        <div className="miraka-text-center">
          <div className="miraka-logo-text">MIRAKA & CO.</div>
          <h1 className="miraka-title">
            {isInvite ? 'Welcome! Set Your Password' : 'Set Your New Password'}
          </h1>
          <p className="miraka-subtitle">
            {isInvite 
              ? 'Create a strong password to secure your Miraka & Co portal access.'
              : 'Enter your new password below to secure your portal access.'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {loading && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(255, 255, 255, 0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '3px solid #E5E5E5',
                  borderTop: '3px solid #1A1A1A',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite',
                  margin: '0 auto 16px'
                }} />
                <p style={{ color: '#6B6B6B', fontSize: '14px' }}>
                  Saving your password...
                </p>
              </div>
            </div>
          )}

          <div className="miraka-form-group">
            <label htmlFor="new-password" className="miraka-label">
              New Password
            </label>
            <div className="miraka-password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                id="new-password"
                className="miraka-input"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
              <button
                type="button"
                className="miraka-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {newPassword && (
              <span className={`miraka-password-strength ${strength}`}>
                Strength: {strength === 'weak' ? 'Weak' : strength === 'medium' ? 'Medium' : 'Strong'}
              </span>
            )}
          </div>

          <div className="miraka-form-group">
            <label htmlFor="confirm-password" className="miraka-label">
              Confirm Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              id="confirm-password"
              className="miraka-input"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          {error && (
            <div className="miraka-message miraka-message-error" style={{ marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="miraka-btn miraka-btn-primary miraka-btn-full"
            disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
          >
            {loading && <div className="miraka-spinner" />}
            {loading ? 'Saving...' : 'Save Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
