/**
 * Login Component
 * 
 * Miraka & Co Portal Login Page
 * Clean, minimal, corporate design
 */

import React, { useState } from 'react';
import { supabase, getUserProfile, getDashboardRoute } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate inputs
      if (!email || !password) {
        setError('Please enter both email and password');
        setLoading(false);
        return;
      }

      // Sign in with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError('Authentication failed. Please try again.');
        setLoading(false);
        return;
      }

      // Get user profile with role
      const profile = await getUserProfile(authData.user.id);

      if (!profile) {
        setError('Failed to load user profile. Please contact support.');
        setLoading(false);
        return;
      }

      // Redirect based on role
      const dashboardPath = getDashboardRoute(profile.role);
      window.location.href = dashboardPath;

    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="miraka-login-container">
      <div className="miraka-login-card">
        {/* Logo */}
        <div className="miraka-login-logo">
          <h1>Miraka & Co</h1>
          <p>Client Portal</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="miraka-login-form">
          {error && (
            <div className="miraka-error-message">
              {error}
            </div>
          )}

          <div className="miraka-form-field">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@company.com"
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="miraka-form-field">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button 
            type="submit" 
            className="miraka-login-button"
            disabled={loading}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>

          <div className="miraka-forgot-password">
            <a href="/reset-password">
              Forgot your password?
            </a>
          </div>
        </form>
      </div>

      <style>{`
        .miraka-login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #F7F7F9;
          padding: 20px;
        }

        .miraka-login-card {
          background: #FFFFFF;
          border-radius: 20px;
          padding: 48px 40px;
          width: 100%;
          max-width: 440px;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
        }

        .miraka-login-logo {
          text-align: center;
          margin-bottom: 40px;
        }

        .miraka-login-logo h1 {
          font-family: 'Helvetica', sans-serif;
          font-weight: 700;
          font-size: 32px;
          color: #111827;
          margin: 0 0 8px 0;
        }

        .miraka-login-logo p {
          font-family: 'Helvetica', sans-serif;
          font-weight: 400;
          font-size: 16px;
          color: #6B7280;
          margin: 0;
        }

        .miraka-login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .miraka-error-message {
          background: #FEE2E2;
          border: 1px solid #EF4444;
          color: #991B1B;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 14px;
          font-family: 'Helvetica', sans-serif;
        }

        .miraka-form-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .miraka-form-field label {
          font-family: 'Helvetica', sans-serif;
          font-weight: 600;
          font-size: 14px;
          color: #111827;
        }

        .miraka-form-field input {
          height: 48px;
          padding: 0 16px;
          border: 1px solid #DDDDDD;
          border-radius: 12px;
          font-family: 'Helvetica', sans-serif;
          font-size: 15px;
          color: #111827;
          background: #FFFFFF;
          transition: all 0.2s ease;
        }

        .miraka-form-field input::placeholder {
          color: #9CA3AF;
        }

        .miraka-form-field input:focus {
          outline: none;
          border-color: #2A5F8A;
          background: #E9F3F8;
        }

        .miraka-form-field input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .miraka-login-button {
          height: 48px;
          background: #2A5F8A;
          color: #FFFFFF;
          border: none;
          border-radius: 12px;
          font-family: 'Helvetica', sans-serif;
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: 8px;
        }

        .miraka-login-button:hover:not(:disabled) {
          background: #1E4767;
          transform: translateY(-1px);
        }

        .miraka-login-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .miraka-login-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .miraka-forgot-password {
          text-align: center;
          margin-top: 4px;
        }

        .miraka-forgot-password a {
          font-family: 'Helvetica', sans-serif;
          font-size: 14px;
          color: #2A5F8A;
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .miraka-forgot-password a:hover {
          color: #1E4767;
          text-decoration: underline;
        }

        @media (max-width: 640px) {
          .miraka-login-card {
            padding: 32px 24px;
          }

          .miraka-login-logo h1 {
            font-size: 28px;
          }
        }
      `}</style>
    </div>
  );
}
