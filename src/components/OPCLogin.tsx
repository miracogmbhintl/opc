import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createClient } from '@supabase/supabase-js';
import { safeNavigate } from '../lib/opc-navigation-guard';
import { clearCachedOpcAuthProfile, writeCachedOpcAuthProfile } from '../lib/opc-auth-cache';

const LOGO_URL =
  'https://cdn.prod.website-files.com/6944470386300e196e5fc347/6949534529e8342842456097_REGULAR%20COLOR%20ORANGE%20PRO%20CLEAN%20LOGO%20ORIGINAL.png';

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  }
);

const AUTH_COOKIE_SYNC_KEY = 'opc:auth-cookie-sync-at:v1';

async function syncLoginSessionToServer(session: {
  access_token: string;
  refresh_token: string;
}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch('/api/auth/set-session', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }),
      signal: controller.signal,
    });

    if (response.ok) {
      window.localStorage.setItem(
        AUTH_COOKIE_SYNC_KEY,
        String(Date.now()),
      );
    }

    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

export default function OPCLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionChecking, setSessionChecking] = useState(true);
  const resumeStartedRef = useRef(false);

  // OPC_LOGIN_SESSION_RESUME_V1
  useEffect(() => {
    if (resumeStartedRef.current) return;
    resumeStartedRef.current = true;

    let mounted = true;

    async function resumeSession() {
      try {
        const { data, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError || !data.session) {
          if (mounted) setSessionChecking(false);
          return;
        }

        let session = data.session;
        const expiresAtMs = Number(session.expires_at || 0) * 1000;

        if (
          expiresAtMs > 0 &&
          expiresAtMs <= Date.now() + 60_000
        ) {
          const refreshed = await supabase.auth.refreshSession();
          if (refreshed.data.session) {
            session = refreshed.data.session;
          }
        }

        window.localStorage.removeItem('mco_logged_out');
        window.sessionStorage.removeItem('mco_logged_out');
        window.localStorage.setItem(
          'opc_auth_token',
          session.access_token,
        );
        window.localStorage.setItem(
          'opc_user_id',
          session.user.id,
        );
        window.localStorage.setItem(
          'opc_user_email',
          session.user.email || '',
        );

        await syncLoginSessionToServer(session);

        if (mounted) {
          safeNavigate('/dashboard', { replace: true });
        }
      } catch {
        if (mounted) setSessionChecking(false);
      }
    }

    void resumeSession();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      if (!email.trim() || !password.trim()) {
        throw new Error('Bitte E-Mail und Passwort eingeben.');
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        throw new Error(authError.message || 'Login fehlgeschlagen.');
      }

      if (!data?.session?.access_token || !data?.session?.refresh_token) {
        throw new Error('Session konnte nicht erstellt werden.');
      }

      const response = await fetch('/api/auth/set-session', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || 'Server-Session konnte nicht gesetzt werden.');
      }

      localStorage.setItem(
        AUTH_COOKIE_SYNC_KEY,
        String(Date.now()),
      );


      clearCachedOpcAuthProfile();

      const rawRole =
        data.user.user_metadata?.app_role ||
        data.user.user_metadata?.role ||
        data.user.app_metadata?.app_role ||
        data.user.app_metadata?.role;

      const normalizedRole = String(rawRole || '').trim().toLowerCase();
      const knownRole =
        normalizedRole === 'godmode'
          ? 'owner'
          : normalizedRole === 'dispatcher' || normalizedRole === 'disposition'
            ? 'dispatch'
            : normalizedRole === 'mitarbeiter' || normalizedRole === 'staff'
              ? 'employee'
              : normalizedRole === 'kunde'
                ? 'client'
                : normalizedRole;

      if (['owner', 'admin', 'dispatch', 'employee', 'client'].includes(knownRole)) {
        writeCachedOpcAuthProfile({
          id: data.user.id,
          email: data.user.email || email.trim().toLowerCase(),
          full_name:
            data.user.user_metadata?.full_name ||
            data.user.user_metadata?.name ||
            data.user.email ||
            'User',
          role: knownRole as any,
          created_at: '',
          updated_at: '',
        });
      }

      localStorage.removeItem('mco_logged_out');
      sessionStorage.removeItem('mco_logged_out');
      localStorage.setItem('opc_auth_token', data.session.access_token);
      localStorage.setItem('opc_user_id', data.user.id);
      localStorage.setItem('opc_user_email', data.user.email || email.trim().toLowerCase());

      safeNavigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Login fehlgeschlagen.');
      setLoading(false);
    }
  }

  if (sessionChecking) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <div style={styles.logoWrap}>
            <img
              src={LOGO_URL}
              alt="Orange Pro Clean GmbH"
              style={styles.logo}
            />
          </div>
          <div style={styles.sessionStatus}>
            Sitzung wird geprüft...
          </div>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.logoWrap}>
          <img src={LOGO_URL} alt="Orange Pro Clean GmbH" style={styles.logo} />
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label htmlFor="email" style={styles.label}>
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              placeholder="name@beispiel.ch"
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="password" style={styles.label}>
              Passwort
            </label>
            <input
              id="password"
              type="password"
              value={password}
              placeholder="••••••••"
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
            />
          </div>

          {error ? <div style={styles.error}>{error}</div> : null}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'ANMELDEN...' : 'ANMELDEN'}
          </button>

          <a href="/forgot-password" style={styles.link}>
            Passwort vergessen?
          </a>
        </form>

        <div style={styles.footer}>
          © 2026 Orange Pro Clean GmbH. All rights reserved.
        </div>
      </section>
    </main>
  );
}

const font =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Arial, sans-serif';

const styles: Record<string, any> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f3f3f3',
    padding: '20px',
    fontFamily: font,
    boxSizing: 'border-box',
  },
  card: {
    width: '100%',
    maxWidth: '390px',
    background: '#ffffff',
    borderRadius: '24px',
    border: '1px solid #ececec',
    boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
    padding: '34px 26px 24px',
    boxSizing: 'border-box',
  },
  logoWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '26px',
  },
  logo: {
    width: '205px',
    maxWidth: '100%',
    height: 'auto',
    display: 'block',
  },
  form: {
    width: '100%',
  },
  sessionStatus: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: '14px',
    fontWeight: 650,
    padding: '8px 0 2px',
  },
  field: {
    marginBottom: '18px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '13px',
    fontWeight: 700,
    color: '#222222',
  },
  input: {
    width: '100%',
    height: '46px',
    borderRadius: '12px',
    border: '1px solid #dddddd',
    background: '#ffffff',
    padding: '0 14px',
    fontSize: '14px',
    color: '#111111',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: font,
  },
  error: {
    marginBottom: '14px',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#991b1b',
    fontSize: '13px',
    lineHeight: 1.45,
    fontWeight: 600,
  },
  button: {
    width: '100%',
    height: '46px',
    borderRadius: '12px',
    border: 'none',
    background: '#000000',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 800,
    letterSpacing: '0.04em',
    cursor: 'pointer',
    marginTop: '6px',
    fontFamily: font,
  },
  link: {
    display: 'block',
    textAlign: 'center',
    marginTop: '16px',
    color: '#6b7280',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: 500,
  },
  footer: {
    marginTop: '28px',
    paddingTop: '18px',
    borderTop: '1px solid #efefef',
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: '12px',
  },
};
