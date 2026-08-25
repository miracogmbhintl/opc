import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import WebflowLoadingScreen from './shared/WebflowLoadingScreen';

export default function AuthRedirectHandler() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timers = new Set<number>();

    const schedule = (callback: () => void, delay: number) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (active) callback();
      }, delay);
      timers.add(timer);
      return timer;
    };

    const navigate = (target: string, delay = 0) => {
      const run = () => {
        if (!active) return;
        window.location.href = target;
      };

      if (delay > 0) schedule(run, delay);
      else run();
    };

    const failAndReturnToLogin = (message: string, delay = 2000) => {
      if (!active) return;
      setError(message);
      navigate(`${baseUrl}/`, delay);
    };

    const checkAuthAndRedirect = async (attempt: number): Promise<void> => {
      try {
        const {
          data: { session: storageSession },
          error: storageError,
        } = await supabase.auth.getSession();

        if (!active) return;

        if (storageError) {
          console.warn('Auth redirect storage session error:', storageError);
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!active) return;

        if (userError || !user) {
          if (attempt < 3) {
            schedule(() => {
              void checkAuthAndRedirect(attempt + 1);
            }, 500);
            return;
          }

          failAndReturnToLogin(
            userError ? 'Authentication failed' : 'Session not found',
            userError ? 2000 : 1000,
          );
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('role, name, full_name')
          .eq('id', user.id)
          .single();

        if (!active) return;

        if (profileError || !profile) {
          console.warn('Auth redirect profile lookup failed:', profileError);
          failAndReturnToLogin('Profile not found');
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) return;

        if (session?.access_token) {
          localStorage.setItem('mco_auth_token', session.access_token);
          localStorage.setItem('mco_user_role', profile.role);
          localStorage.setItem(
            'mco_user_data',
            JSON.stringify({
              id: user.id,
              email: user.email,
              name: profile.full_name || profile.name || user.email,
              username:
                profile.name ||
                profile.full_name ||
                user.email?.split('@')[0] ||
                'User',
            }),
          );
        }

        const allowedRoles = new Set([
          'owner',
          'admin',
          'dispatch',
          'employee',
          'client',
        ]);
        const targetPath = allowedRoles.has(String(profile.role || '').toLowerCase())
          ? '/dashboard'
          : '/';

        navigate(`${baseUrl}${targetPath}`, 2500);
      } catch (err) {
        if (!active) return;
        console.error('Auth redirect failed:', err);
        failAndReturnToLogin('An error occurred');
      }
    };

    const authReady = sessionStorage.getItem('mco_auth_ready');
    const authTarget = sessionStorage.getItem('mco_auth_target');

    if (authReady === 'true' && authTarget) {
      sessionStorage.removeItem('mco_auth_ready');
      sessionStorage.removeItem('mco_auth_target');
      navigate(authTarget);
    } else {
      void checkAuthAndRedirect(0);
    }

    return () => {
      active = false;
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F2F2F2',
          fontFamily: "'Helvetica Neue', sans-serif",
        }}
      >
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            padding: '40px',
            textAlign: 'center',
            maxWidth: '400px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 600,
              marginBottom: '12px',
              color: '#1A1A1A',
            }}
          >
            Authentication Error
          </h2>
          <p
            style={{
              fontSize: '15px',
              color: '#6B6B6B',
              marginBottom: '24px',
            }}
          >
            {error}. Redirecting to login...
          </p>
        </div>
      </div>
    );
  }

  return <WebflowLoadingScreen />;
}
