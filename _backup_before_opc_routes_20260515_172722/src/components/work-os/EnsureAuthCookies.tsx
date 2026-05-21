import { useState, useEffect, type ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

interface EnsureAuthCookiesProps {
  children: ReactNode;
}

/**
 * EnsureAuthCookies
 * 
 * Ensures auth cookies are set before rendering Work OS pages.
 * If session exists but cookies are missing, calls set-session API.
 */
export default function EnsureAuthCookies({ children }: EnsureAuthCookiesProps) {
  const [cookiesReady, setCookiesReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const ensureCookies = async () => {
      try {
        console.log('[EnsureAuthCookies] Checking session and cookies...');
        
        // Create Supabase client
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        
        // Get current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[EnsureAuthCookies] Session error:', error);
          setChecking(false);
          setCookiesReady(true); // Allow render even on error
          return;
        }

        if (!session) {
          console.log('[EnsureAuthCookies] No session found');
          setChecking(false);
          setCookiesReady(true);
          return;
        }

        console.log('[EnsureAuthCookies] Session found, ensuring cookies are set...');

        // Call set-session to ensure cookies are set
        const response = await fetch('/api/auth/set-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }),
        });

        if (!response.ok) {
          console.error('[EnsureAuthCookies] Failed to set cookies:', response.status);
        } else {
          console.log('[EnsureAuthCookies] Cookies set successfully');
        }

        // Small delay to ensure cookies are written
        await new Promise(resolve => setTimeout(resolve, 100));

        setChecking(false);
        setCookiesReady(true);

      } catch (error) {
        console.error('[EnsureAuthCookies] Error:', error);
        setChecking(false);
        setCookiesReady(true); // Allow render even on error
      }
    };

    ensureCookies();
  }, []);

  // Show minimal loading state while checking
  if (checking || !cookiesReady) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '200px',
          fontFamily: "'Inter Tight', sans-serif",
        }}
      >
        <div
          style={{
            width: '24px',
            height: '24px',
            border: '3px solid #E5E7EB',
            borderTop: '3px solid #1A1A1A',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    );
  }

  return <>{children}</>;
}
