import { useState, useEffect, type ReactNode } from 'react';
import { type UserProfile, type UserRole } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import { OPC_ROUTES, getOpcDashboardRoute } from '../lib/opc-routes';
import MirakaSidebar from './MirakaSidebar';
import { TranslationProvider, useTranslation } from '../lib/TranslationContext';
import {
  loadOpcAuthProfile,
  readCachedOpcAuthProfile,
  writeCachedOpcAuthProfile,
} from '../lib/opc-auth-cache';

function readCachedUserProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null;

  try {
    const rawUserData = localStorage.getItem('mco_user_data') || localStorage.getItem('mco_auth');
    const cachedRole = localStorage.getItem('mco_user_role') as UserRole | null;

    if (!rawUserData || !cachedRole) return null;

    const cached = JSON.parse(rawUserData);

    if (!cached?.id) return null;

    return {
      id: cached.id,
      email: cached.email || '',
      name: cached.username || cached.name || cached.full_name || cached.email || 'User',
      full_name: cached.name || cached.full_name || cached.username || cached.email || 'User',
      role: cachedRole,
      created_at: cached.created_at || '',
      updated_at: cached.updated_at || '',
    } as UserProfile;
  } catch {
    return null;
  }
}

interface DashboardShellProps {
  children: ReactNode;
  title?: string;
  requiredRole?: UserRole | UserRole[];
  currentPath?: string;
  hideTopBar?: boolean;
  fullWidth?: boolean;
}

export default function MirakaDashboardShell({
  children,
  title = '',
  requiredRole,
  currentPath = '',
  hideTopBar = true,
  fullWidth = false,
}: DashboardShellProps) {
  return (
    <TranslationProvider>
      <DashboardShellContent
        title={title}
        requiredRole={requiredRole}
        currentPath={currentPath}
        hideTopBar={hideTopBar}
        fullWidth={fullWidth}
      >
        {children}
      </DashboardShellContent>
    </TranslationProvider>
  );
}

function DashboardShellContent({
  children,
  requiredRole,
  currentPath = '',
  fullWidth = false,
}: DashboardShellProps) {
  let t: any;

  try {
    t = useTranslation().t;
  } catch {
    t = {
      status: { loading: 'Loading...' },
      errors: { unauthorized: 'Unauthorized' },
      auth: { login: 'Return to Login' },
    };
  }

  const cachedUserProfile = readCachedOpcAuthProfile() || readCachedUserProfile();
  const [loading, setLoading] = useState(!cachedUserProfile);
  const [user, setUser] = useState<UserProfile | null>(cachedUserProfile);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;

    try {
      return window.localStorage.getItem('miraka_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const savedState = localStorage.getItem('miraka_sidebar_collapsed');
    const nextCollapsed = savedState === 'true';
    setSidebarCollapsed((current) => (current === nextCollapsed ? current : nextCollapsed));

    const handleSidebarToggle = (event: Event) => {
      const customEvent = event as CustomEvent<{ isCollapsed: boolean }>;
      setSidebarCollapsed(Boolean(customEvent.detail?.isCollapsed));
    };

    window.addEventListener('sidebarToggle', handleSidebarToggle);
    void checkAuth();

    return () => {
      window.removeEventListener('sidebarToggle', handleSidebarToggle);
    };
  }, []);

  const isRoleAllowed = (profileRole: UserRole) => {
    if (!requiredRole) return true;

    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    return allowedRoles.includes(profileRole);
  };

  const handleRoleMismatch = (profileRole: UserRole) => {
    const correctRoute = getOpcDashboardRoute(profileRole);
    const currentBrowserPath = window.location.pathname;

    if (correctRoute && correctRoute !== currentBrowserPath) {
      window.location.href = `${baseUrl}${correctRoute}`;
      return;
    }

    setError('Du hast keinen Zugriff auf diese Seite.');
    setLoading(false);
  };

  const checkAuth = async () => {
    try {
      const cachedProfile = readCachedOpcAuthProfile();

      if (cachedProfile) {
        if (!isRoleAllowed(cachedProfile.role as UserRole)) {
          handleRoleMismatch(cachedProfile.role as UserRole);
          return;
        }

        setUser(cachedProfile);
        setError(null);
        setLoading(false);
        return;
      }

      const normalizedProfile = await loadOpcAuthProfile();

      if (!normalizedProfile) {
        window.location.href = `${baseUrl}${OPC_ROUTES.login}`;
        return;
      }

      writeCachedOpcAuthProfile(normalizedProfile);

      if (!isRoleAllowed(normalizedProfile.role as UserRole)) {
        handleRoleMismatch(normalizedProfile.role as UserRole);
        return;
      }

      setUser(normalizedProfile);
      setError(null);
      setLoading(false);
    } catch (err: any) {
      console.error('Auth check error:', err);
      setError(err?.message || 'Authentication failed');
      setLoading(false);

      setTimeout(() => {
        window.location.href = `${baseUrl}${OPC_ROUTES.login}`;
      }, 2000);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: '3px solid #E5E7EB',
              borderTopColor: '#111111',
              animation: 'miraka-spin 1s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <style>{`
            @keyframes miraka-spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '20px',
            padding: '32px',
            textAlign: 'center',
            boxShadow: '0 12px 32px rgba(15, 17, 21, 0.06)',
          }}
        >
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: '22px',
              fontWeight: 700,
              color: '#111111',
            }}
          >
            {t.errors?.unauthorized || 'Unauthorized'}
          </h2>

          <p
            style={{
              margin: '0 0 24px',
              fontSize: '14px',
              lineHeight: 1.6,
              color: '#666666',
            }}
          >
            {error}
          </p>

          <a
            href={`${baseUrl}${OPC_ROUTES.login}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '44px',
              padding: '0 18px',
              borderRadius: '12px',
              background: '#111111',
              color: '#FFFFFF',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            {t.auth?.login || 'Return to Login'}
          </a>
        </div>
      </div>
    );
  }

  const mainOffset = sidebarCollapsed ? 80 : 260;

  return (
    <div className="miraka-dashboard-shell">
      <MirakaSidebar
        role={(user?.role || 'client') as UserRole}
        currentPath={currentPath || window.location.pathname}
      />

      <div
        className={fullWidth ? 'miraka-dashboard-main full-width' : 'miraka-dashboard-main'}
        style={{
          marginLeft: `${mainOffset}px`,
          width: fullWidth ? `calc(100% - ${mainOffset}px)` : undefined,
        }}
      >
        <main className="miraka-dashboard-content">
          {children}
        </main>
      </div>

      <style>{`
        html,
        body {
          background: #FFFFFF !important;
        }

        .miraka-dashboard-shell {
          min-height: 100vh;
          background: #FFFFFF;
          font-family: 'Inter', 'Helvetica Neue', sans-serif;
        }

        .miraka-dashboard-main {
          min-height: 100vh;
          background: #FFFFFF;
          transition: none !important;\n          transform: none !important;\n          animation: none !important;
        }

        .miraka-dashboard-content {
          padding: 32px;
          background: #FFFFFF;
          min-height: 100vh;
        }

        .miraka-topbar {
          display: none !important;
        }

        @media (max-width: 768px) {
          .miraka-dashboard-main {
            margin-left: 0 !important;
            width: 100% !important;
            background: #FFFFFF;
          }

          .miraka-dashboard-content {
            padding: 20px 16px 120px;
            background: #FFFFFF;
          }
        }
      `}</style>
    </div>
  );
}
