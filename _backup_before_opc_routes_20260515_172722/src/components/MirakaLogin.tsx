import { useState, useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabase-client';
import { baseUrl } from '../lib/base-url';
import { useTranslation } from '../lib/TranslationContext';

export default function MirakaLogin() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [configError, setConfigError] = useState<string>('');
  const [testingConnection, setTestingConnection] = useState(true);

  console.log('🎨 MirakaLogin: Rendering component', { 
    testingConnection, 
    mounted, 
    configError: configError ? 'YES' : 'NO' 
  });

  useEffect(() => {
    console.log('🟢 MirakaLogin: Component mounted - START');
    console.log('🟢 MirakaLogin: Starting initialization...');
    
    const initializeAuth = async () => {
      console.log('🔍 Checking environment variables...');
      console.log('   import.meta.env.PUBLIC_SUPABASE_URL:', import.meta.env.PUBLIC_SUPABASE_URL);
      console.log('   import.meta.env.PUBLIC_SUPABASE_ANON_KEY exists:', !!import.meta.env.PUBLIC_SUPABASE_ANON_KEY);
      
      // Check if Supabase is configured
      const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'https://bmyshfmcfpiztllidenr.supabase.co';
      const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJteXNoZm1jZnBpenRsbGlkZW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MTY4NDYsImV4cCI6MjA4MDA5Mjg0Nn0.5ydFm5AntUn7cJVXWHo_yBIY88fBJSyuMgafVftJ3Qg';
      
      console.log('🔍 Using Supabase config...');
      console.log('   URL:', supabaseUrl);
      console.log('   Key exists:', !!supabaseKey);

      // Skip URL validation for now
      console.log('⏭️ Skipping URL validation...');

      // Skip Supabase connection test for now
      console.log('⏭️ Skipping Supabase connection test...');
      console.log('✅ Setting mounted to true...');
      setMounted(true);
      setTestingConnection(false);
      console.log('✅ MirakaLogin: Initialization complete');
    };

    initializeAuth();
  }, []);

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailError('');
    setPasswordError('');

    console.log('🔵 MirakaLogin: Form submitted');

    // Validation
    if (!email) {
      setEmailError(t.errors.required);
      return;
    }

    if (!validateEmail(email)) {
      setEmailError(t.errors.invalidEmail);
      return;
    }

    if (!password) {
      setPasswordError(t.errors.required);
      return;
    }

    if (password.length < 6) {
      setPasswordError(t.errors.minLength);
      return;
    }

    console.log('✅ MirakaLogin: Validation passed');
    setLoading(true);

    try {
      console.log('🔵 MirakaLogin: Attempting sign in...');
      
      // Sign in with Supabase
      const supabase = getSupabaseClient();
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error('❌ MirakaLogin: Auth error:', authError);
        
        // Handle specific error cases
        if (authError.message.includes('Invalid login credentials')) {
          throw new Error(t.auth.invalidCredentials);
        } else if (authError.message.includes('Email not confirmed')) {
          throw new Error('Please confirm your email address before logging in.');
        } else if (authError.message.includes('Invalid API key') || 
                   authError.message.includes('apikey')) {
          throw new Error('Authentication service error: Invalid API credentials. Please contact support.');
        } else {
          throw new Error(authError.message);
        }
      }

      if (!authData.user) {
        console.error('❌ MirakaLogin: No user returned');
        throw new Error('No user returned from authentication');
      }

      console.log('✅ MirakaLogin: User authenticated:', authData.user.id);
      console.log('🔵 MirakaLogin: Fetching user profile and preparing redirect...');

      // Fetch user profile to verify it exists and determine role
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role, name, full_name')
        .eq('id', authData.user.id)
        .single();

      if (profileError) {
        console.error('❌ MirakaLogin: Profile error:', profileError);
        throw new Error('Unable to fetch user profile: ' + profileError.message);
      }

      if (!profile) {
        console.error('❌ MirakaLogin: No profile found');
        throw new Error('Unable to fetch user profile');
      }

      console.log('✅ MirakaLogin: Profile loaded, role:', profile.role);

      // Store auth data and target URL in sessionStorage for instant redirect
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        // Set HTTP-only cookies for server-side API routes
        console.log('🔵 MirakaLogin: Setting session cookies...');
        try {
          const setCookiesResponse = await fetch(`${baseUrl}/api/auth/set-session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              access_token: session.access_token,
              refresh_token: session.refresh_token
            })
          });

          if (!setCookiesResponse.ok) {
            console.error('❌ Failed to set session cookies');
          } else {
            console.log('✅ MirakaLogin: Session cookies set successfully');
          }
        } catch (cookieError) {
          console.error('❌ Error setting session cookies:', cookieError);
        }

        // Store for chat button
        localStorage.setItem('mco_auth_token', session.access_token);
        localStorage.setItem('mco_user_role', profile.role);
        localStorage.setItem('mco_user_data', JSON.stringify({
          id: authData.user.id,
          email: authData.user.email,
          name: profile.full_name || profile.name || authData.user.email,
          username: profile.name || profile.full_name || authData.user.email?.split('@')[0] || 'User'
        }));
        console.log('✅ MirakaLogin: Stored auth data in localStorage for chat');
        
        // Pre-calculate target URL and store in sessionStorage
        let targetPath = '';
        switch (profile.role) {
          case 'owner':
            targetPath = '/miraka-co-portal/owner-dashboard';
            break;
          case 'admin':
            targetPath = '/miraka-co-portal/admin-dashboard';
            break;
          case 'client':
            targetPath = '/miraka-co-portal/client-dashboard';
            break;
          default:
            targetPath = '/miraka-co-portal';
        }
        
        sessionStorage.setItem('mco_auth_target', baseUrl + targetPath);
        sessionStorage.setItem('mco_auth_ready', 'true');
        console.log('✅ MirakaLogin: Pre-calculated target URL:', baseUrl + targetPath);
      }

      console.log('🔵 MirakaLogin: Redirecting to auth-redirect page...');
      console.log('🔵 MirakaLogin: Target URL:', `${baseUrl}/auth-redirect`);

      // Redirect to loading screen (it will handle instant redirect with preloaded data)
      window.location.href = `${baseUrl}/auth-redirect`;

    } catch (err: any) {
      console.error('❌ MirakaLogin: Error:', err);
      setError(err.message || t.errors.generic);
      setLoading(false);
    }
  };

  // Show loading state while testing connection
  if (testingConnection || !mounted) {
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

  // Show configuration error
  if (configError) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F2F2F2',
        padding: '20px',
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif"
      }}>
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          maxWidth: '600px',
          width: '100%',
          padding: '40px',
          textAlign: 'center'
        }}>
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
          <h2 style={{
            fontSize: '24px',
            fontWeight: 600,
            color: '#000000',
            marginBottom: '12px',
            fontFamily: "'Poppins', sans-serif"
          }}>
            {t.errors.serverError}
          </h2>
          <p style={{
            fontSize: '15px',
            color: '#DC2626',
            marginBottom: '24px',
            lineHeight: 1.6,
            fontWeight: 500
          }}>
            {configError}
          </p>
          
          <div style={{
            background: '#F5F5F5',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'left',
            marginBottom: '24px'
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#000000',
              marginBottom: '12px',
              fontFamily: "'Inter', sans-serif"
            }}>
              How to fix:
            </h3>
            <ol style={{
              fontSize: '14px',
              color: '#333333',
              lineHeight: 1.8,
              paddingLeft: '20px',
              margin: 0
            }}>
              <li>Open your <code style={{
                background: '#E5E5E5',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '13px',
                fontFamily: 'monospace'
              }}>.env</code> file</li>
              <li>Verify your Supabase credentials are correct:
                <div style={{
                  background: '#FFFFFF',
                  borderRadius: '8px',
                  padding: '12px',
                  marginTop: '8px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  border: '1px solid #E5E5E5'
                }}>
                  PUBLIC_SUPABASE_URL="..."<br/>
                  PUBLIC_SUPABASE_ANON_KEY="..."
                </div>
              </li>
              <li>Get your Supabase credentials from: <a href="https://app.supabase.com" target="_blank" rel="noopener noreferrer" style={{
                color: '#000000',
                textDecoration: 'underline'
              }}>app.supabase.com</a> → Settings → API</li>
              <li style={{ fontWeight: 600, color: '#DC2626' }}>Restart your dev server after updating</li>
            </ol>
          </div>

          <button
            onClick={() => window.location.reload()}
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
              letterSpacing: '0.5px'
            }}
          >
            {t.common.refresh}
          </button>
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
            onError={(e) => {
              console.error('❌ Image failed to load');
              e.currentTarget.style.display = 'none';
            }}
            onLoad={() => {
              console.log('✅ Logo loaded successfully');
            }}
          />
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
              {t.auth.password}
            </label>
            <input
              type="password"
              id="password"
              placeholder={t.auth.passwordPlaceholder}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordError('');
                setError('');
              }}
              disabled={loading}
              style={{
                width: '100%',
                height: '48px',
                padding: '0 16px',
                fontSize: '15px',
                borderRadius: '12px',
                border: `1.5px solid ${passwordError ? '#EF4444' : '#E5E5E5'}`,
                background: '#FFFFFF',
                color: '#000000',
                outline: 'none',
                transition: 'border-color 0.2s ease',
                fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                if (!passwordError) {
                  e.target.style.borderColor = '#000000';
                }
              }}
              onBlur={(e) => {
                if (!passwordError) {
                  e.target.style.borderColor = '#E5E5E5';
                }
              }}
            />
            {passwordError && (
              <span style={{
                display: 'block',
                fontSize: '13px',
                color: '#EF4444',
                marginTop: '6px',
                fontFamily: "'Inter', 'Helvetica Neue', sans-serif"
              }}>
                {passwordError}
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

          {/* Primary Button - Sign In */}
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
            {loading ? t.status.loading.toUpperCase() : t.auth.signIn.toUpperCase()}
          </button>

          {/* Forgot Password Link */}
          <div style={{
            textAlign: 'center',
            marginTop: '16px'
          }}>
            <a 
              href={`${baseUrl}/miraka-co-portal/forgot-password`}
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
              {t.auth.forgotPassword}
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









