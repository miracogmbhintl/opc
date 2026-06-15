import { useState, useEffect, useRef, type ReactNode } from 'react';
import { type UserProfile, type UserRole } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import { OPC_ROUTES, getOpcDashboardRoute } from '../lib/opc-routes';
import MirakaSidebar from './MirakaSidebar';
import { TranslationProvider, useTranslation } from '../lib/TranslationContext';
import { loadOpcAuthProfile, writeCachedOpcAuthProfile } from '../lib/opc-auth-cache';
import { safeNavigate } from '../lib/opc-navigation-guard';

interface DashboardShellProps {
  children: ReactNode;
  title?: string;
  requiredRole?: UserRole | UserRole[];
  currentPath?: string;
  hideTopBar?: boolean;
  fullWidth?: boolean;
}

const dashboardFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

function normalizeRole(role?: string | null): UserRole {
  const clean = String(role || '').toLowerCase().trim();

  if (clean === 'owner') return 'owner';
  if (clean === 'admin') return 'admin';
  if (clean === 'dispatch' || clean === 'dispatcher' || clean === 'disposition') return 'dispatch';
  if (clean === 'employee' || clean === 'mitarbeiter') return 'employee';
  if (clean === 'client' || clean === 'kunde') return 'client';

  return 'client';
}


function installOpcSingleNavigationGuard() {
  if (typeof window === 'undefined') return () => undefined;

  const key = '__opc_last_internal_link_navigation__';

  const normalizeHref = (href: string) => {
    try {
      const url = new URL(href, window.location.origin);

      if (url.origin !== window.location.origin) {
        return null;
      }

      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return null;
    }
  };

  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const target = event.target as HTMLElement | null;
    const link = target?.closest?.('a[href]') as HTMLAnchorElement | null;

    if (!link) return;
    if (link.target && link.target !== '_self') return;
    if (link.hasAttribute('download')) return;

    const href = link.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    const targetRoute = normalizeHref(link.href);
    if (!targetRoute) return;

    const currentRoute = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (targetRoute === currentRoute) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const now = Date.now();

    try {
      const raw = window.sessionStorage.getItem(key);
      const previous = raw ? JSON.parse(raw) : null;

      if (
        previous &&
        previous.href === targetRoute &&
        typeof previous.at === 'number' &&
        now - previous.at < 1200
      ) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      window.sessionStorage.setItem(key, JSON.stringify({ href: targetRoute, at: now }));
    } catch {
      return;
    }
  };

  document.addEventListener('click', onClick, true);

  return () => {
    document.removeEventListener('click', onClick, true);
  };
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

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;

    try {
      return window.localStorage.getItem('miraka_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const didRunAuthCheckRef = useRef(false);

  useEffect(() => {
    const cleanupSingleNavigationGuard = installOpcSingleNavigationGuard();
    return cleanupSingleNavigationGuard;
  }, []);

  useEffect(() => {
    const savedState = localStorage.getItem('miraka_sidebar_collapsed');
    const nextCollapsed = savedState === 'true';
    setSidebarCollapsed((current) => (current === nextCollapsed ? current : nextCollapsed));

    const handleSidebarToggle = (event: Event) => {
      const customEvent = event as CustomEvent<{ isCollapsed: boolean }>;
      setSidebarCollapsed(Boolean(customEvent.detail?.isCollapsed));
    };

    window.addEventListener('sidebarToggle', handleSidebarToggle);
    if (!didRunAuthCheckRef.current) {
      didRunAuthCheckRef.current = true;
      void checkAuth();
    }

    return () => {
      window.removeEventListener('sidebarToggle', handleSidebarToggle);
    };
  }, []);

  const isRoleAllowed = (profileRole: UserRole) => {
    if (!requiredRole) return true;

    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    return allowedRoles.map((role) => normalizeRole(role)).includes(normalizeRole(profileRole));
  };

  const handleRoleMismatch = (profileRole: UserRole) => {
    const correctRoute = getOpcDashboardRoute(profileRole);
    const currentBrowserPath = window.location.pathname;

    if (correctRoute && correctRoute !== currentBrowserPath) {
      safeNavigate(`${baseUrl}${correctRoute}`);
      return;
    }

    setError('Du hast keinen Zugriff auf diese Seite.');
    setLoading(false);
  };

  const checkAuth = async () => {
    try {
      const normalizedProfile = await loadOpcAuthProfile();

      if (!normalizedProfile) {
        safeNavigate(`${baseUrl}${OPC_ROUTES.login}`);
        return;
      }

      writeCachedOpcAuthProfile(normalizedProfile);

      const resolvedRole = normalizeRole(normalizedProfile.role);

      if (!isRoleAllowed(resolvedRole)) {
        handleRoleMismatch(resolvedRole);
        return;
      }

      setUser({ ...normalizedProfile, role: resolvedRole });
      setError(null);
      setLoading(false);
    } catch (err: any) {
      console.error('Auth check error:', err);
      setError(err?.message || 'Authentication failed');
      setLoading(false);

      setTimeout(() => {
        safeNavigate(`${baseUrl}${OPC_ROUTES.login}`);
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
          fontFamily: dashboardFont,
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
          fontFamily: dashboardFont,
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
            boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
          }}
        >
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: '22px',
              fontWeight: 860,
              letterSpacing: '-0.035em',
              color: '#111827',
            }}
          >
            {t.errors?.unauthorized || 'Unauthorized'}
          </h2>

          <p
            style={{
              margin: '0 0 24px',
              fontSize: '14px',
              lineHeight: 1.6,
              color: '#6B7280',
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
              borderRadius: '14px',
              background: '#0F1115',
              color: '#FFFFFF',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: 820,
              fontFamily: dashboardFont,
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
        :root {
          --opc-font: ${dashboardFont};
          --opc-text: #111827;
          --opc-muted: #6B7280;
          --opc-border: #E5E7EB;
          --opc-black: #0F1115;
          --opc-card-radius: 20px;
          --opc-control-radius: 14px;
        }

        html,
        body {
          background: #FFFFFF !important;
          font-family: ${dashboardFont} !important;
          color: #111827;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: geometricPrecision;
        }

        .miraka-dashboard-shell {
          min-height: 100vh;
          background: #FFFFFF;
          color: #111827;
          font-family: ${dashboardFont} !important;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: geometricPrecision;
        }

        .miraka-dashboard-shell,
        .miraka-dashboard-shell *,
        .miraka-dashboard-shell *::before,
        .miraka-dashboard-shell *::after {
          box-sizing: border-box;
        }

        .miraka-dashboard-shell :where(button, input, select, textarea, a, label, span, p, h1, h2, h3, h4, h5, h6, small, strong, div) {
          font-family: ${dashboardFont} !important;
        }

        .miraka-dashboard-shell :where(button, a, input, select, textarea) {
          -webkit-tap-highlight-color: transparent;
        }

        .miraka-dashboard-shell :where(button, a) {
          font-synthesis-weight: none;
        }

        .miraka-dashboard-main {
          min-height: 100vh;
          background: #FFFFFF;
          transition: none !important;
          transform: none !important;
          animation: none !important;
        }

        .miraka-dashboard-main.full-width {
          max-width: none;
        }

        .miraka-dashboard-content {
          width: 100%;
          max-width: 100%;
          min-height: 100vh;
          padding: 24px 28px 112px;
          background: #FFFFFF;
          overflow-x: hidden;
          font-family: ${dashboardFont} !important;
        }

        .miraka-dashboard-content > * {
          max-width: 100%;
        }

        .miraka-dashboard-content :where(.opc-jobs-page, .opc-reports-page, .opc-calendar-page, .opc-requests-page, .opc-settings-page, .opc-page, .opc-plan-page) {
          font-family: ${dashboardFont} !important;
          letter-spacing: normal;
        }

        .miraka-dashboard-content :where(input, select, textarea) {
          font-family: ${dashboardFont} !important;
          font-size: 14px;
          font-weight: 650;
        }

        .miraka-dashboard-content :where(button, a) {
          font-family: ${dashboardFont} !important;
        }

        .miraka-dashboard-content :where(.opc-btn, .opc-job-action, .opc-report-action, .opc-jobs-plan-button, .opc-save-button, .opc-soft-button) {
          min-height: 46px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 820;
        }

        .miraka-topbar {
          display: none !important;
        }

        @media (max-width: 1180px) {
          .miraka-dashboard-content {
            padding: 22px 22px 112px;
          }
        }

        @media (max-width: 768px) {
          .miraka-dashboard-main {
            margin-left: 0 !important;
            width: 100% !important;
            background: #FFFFFF;
          }

          .miraka-dashboard-content {
            padding: 18px 16px 120px;
            background: #FFFFFF;
          }
        }

        @media (max-width: 420px) {
          .miraka-dashboard-content {
            padding: 16px 14px 120px;
          }
        }
      `}</style>
    </div>
  );
}
