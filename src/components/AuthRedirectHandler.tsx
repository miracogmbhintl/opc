import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import WebflowLoadingScreen from './shared/WebflowLoadingScreen';

export default function AuthRedirectHandler() {
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    console.log('🔵 AuthRedirectHandler: Component mounted');
    console.log('🔵 AuthRedirectHandler: baseUrl is:', baseUrl || '(empty string - dev mode)');
    
    // Check if we have preloaded auth data from login
    const authReady = sessionStorage.getItem('mco_auth_ready');
    const authTarget = sessionStorage.getItem('mco_auth_target');
    
    if (authReady === 'true' && authTarget) {
      console.log('🚀 AuthRedirectHandler: Found preloaded auth data!');
      console.log('🚀 AuthRedirectHandler: Instant redirect to:', authTarget);
      
      // Clear the session storage flags
      sessionStorage.removeItem('mco_auth_ready');
      sessionStorage.removeItem('mco_auth_target');
      
      // Redirect immediately - the Webflow loading screen on index.astro will still be visible
      // so the user sees a smooth transition without any extra loading spinners
      window.location.href = authTarget;
      return;
    }
    
    // Fallback: if no preloaded data, fetch it (for page refreshes or direct navigation)
    console.log('🔵 AuthRedirectHandler: No preloaded data, fetching...');
    checkAuthAndRedirect();
  }, []);

  const checkAuthAndRedirect = async () => {
    try {
      console.log('🔵 AuthRedirectHandler: Getting session (attempt', retryCount + 1, ')...');
      
      // First try to get the current session from storage
      const { data: { session: storageSession }, error: storageError } = await supabase.auth.getSession();
      
      if (storageError) {
        console.error('❌ AuthRedirectHandler: Storage session error:', storageError);
      } else {
        console.log('📦 AuthRedirectHandler: Storage session:', storageSession ? 'Found' : 'Not found');
      }

      // Then get the user from the API (this refreshes the session)
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('❌ AuthRedirectHandler: User error:', userError);
        
        // Retry up to 3 times if the session isn't ready yet
        if (retryCount < 3) {
          console.log('⏱️ AuthRedirectHandler: Retrying in 500ms...');
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            checkAuthAndRedirect();
          }, 500);
          return;
        }
        
        setError('Authentication failed');
        setTimeout(() => {
          window.location.href = `${baseUrl}/`;
        }, 2000);
        return;
      }

      if (!user) {
        console.log('⚠️ AuthRedirectHandler: No user found');
        
        // Retry up to 3 times if the session isn't ready yet
        if (retryCount < 3) {
          console.log('⏱️ AuthRedirectHandler: Retrying in 500ms...');
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            checkAuthAndRedirect();
          }, 500);
          return;
        }
        
        setTimeout(() => {
          window.location.href = `${baseUrl}/`;
        }, 1000);
        return;
      }

      console.log('✅ AuthRedirectHandler: User found:', user.id);
      console.log('📧 User email:', user.email);
      console.log('🔵 AuthRedirectHandler: Fetching user profile...');

      // Get user profile to determine role
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role, name, full_name')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('❌ AuthRedirectHandler: Profile error:', profileError);
        console.error('Error details:', JSON.stringify(profileError, null, 2));
        setError('Profile not found');
        setTimeout(() => {
          window.location.href = `${baseUrl}/`;
        }, 2000);
        return;
      }

      if (!profile) {
        console.error('❌ AuthRedirectHandler: No profile found');
        setError('Profile not found');
        setTimeout(() => {
          window.location.href = `${baseUrl}/`;
        }, 2000);
        return;
      }

      console.log('✅ AuthRedirectHandler: Profile loaded');
      console.log('📋 Profile role:', profile.role);
      console.log('📋 Profile name:', profile.name || profile.full_name || '(no name)');

      // Store auth data in localStorage for ChatButton
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        localStorage.setItem('mco_auth_token', session.access_token);
        localStorage.setItem('mco_user_role', profile.role);
        localStorage.setItem('mco_user_data', JSON.stringify({
          id: user.id,
          email: user.email,
          name: profile.full_name || profile.name || user.email,
          username: profile.name || profile.full_name || user.email?.split('@')[0] || 'User'
        }));
        console.log('✅ AuthRedirectHandler: Stored auth data in localStorage for chat');
      }

      // Determine redirect URL based on role
      let targetPath = '';
      
      switch (profile.role) {
        case 'owner':
          targetPath = '/dashboard';
          console.log('🔵 AuthRedirectHandler: Determined role: OWNER');
          break;
        case 'admin':
          targetPath = '/dashboard';
          console.log('🔵 AuthRedirectHandler: Determined role: ADMIN');
          break;
        case 'client':
          targetPath = '/dashboard';
          console.log('🔵 AuthRedirectHandler: Determined role: CLIENT');
          break;
        default:
          console.warn('⚠️ AuthRedirectHandler: Unknown role:', profile.role);
          console.warn('⚠️ Defaulting to login page');
          targetPath = '/';
      }

      const targetUrl = baseUrl + targetPath;
      console.log('✅ AuthRedirectHandler: Target URL determined:', targetUrl);
      console.log('⏱️ AuthRedirectHandler: Waiting for loading animation...');
      
      // Wait for the loading animation, then redirect
      setTimeout(() => {
        console.log('🚀 AuthRedirectHandler: Redirecting now to:', targetUrl);
        window.location.href = targetUrl;
      }, 2500); // 2.5 seconds to show loading screen
      
    } catch (err) {
      console.error('❌ AuthRedirectHandler: Unexpected error:', err);
      console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      setError('An error occurred');
      setTimeout(() => {
        window.location.href = `${baseUrl}/`;
      }, 2000);
    }
  };

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F2F2F2',
        fontFamily: "'Helvetica Neue', sans-serif"
      }}>
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '40px',
          textAlign: 'center',
          maxWidth: '400px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px'
          }}>⚠️</div>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            marginBottom: '12px',
            color: '#1A1A1A'
          }}>
            Authentication Error
          </h2>
          <p style={{
            fontSize: '15px',
            color: '#6B6B6B',
            marginBottom: '24px'
          }}>
            {error}. Redirecting to login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <WebflowLoadingScreen />
  );
}




