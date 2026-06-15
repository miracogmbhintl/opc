/**
 * Orange Pro Clean Sidebar
 * Uses the same sidebar behavior/design structure as the reference Miraka sidebar.
 * Only OPC-specific parts remain changed: logo, navigation pages, roles, and user information.
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { supabase, type UserProfile } from '../lib/supabase';
import { loadOpcAuthProfile, readCachedOpcAuthProfile, clearCachedOpcAuthProfile } from '../lib/opc-auth-cache';
import { baseUrl } from '../lib/base-url';
import { OPC_ROUTES } from '../lib/opc-routes';
import {
  AlertTriangle,
  Briefcase,
  CalendarDays,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  QrCode,
  Settings,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { safeNavigate } from '../lib/opc-navigation-guard';

interface MirakaSidebarProps {
  role: string;
  currentPath?: string;
}

type NormalizedRole = 'owner' | 'admin' | 'dispatch' | 'employee' | 'client';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  key: string;
  match: string[];
};

const OPC_LOGO =
  'https://cdn.prod.website-files.com/6944470386300e196e5fc347/6949534529e8342842456097_REGULAR%20COLOR%20ORANGE%20PRO%20CLEAN%20LOGO%20ORIGINAL.png';

const STORAGE_KEY_COLLAPSED = 'miraka_sidebar_collapsed';

const COLLAPSED_WIDTH = 70;
const EXPANDED_WIDTH = 260;
const RAIL_PADDING_LEFT = 12;
const ICON_RAIL_WIDTH = 40;

const SIDEBAR_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const SIDEBAR_WIDTH_TRANSITION = `width 420ms ${SIDEBAR_EASE}`;

function routeFor(key: string, fallback: string) {
  const routes = OPC_ROUTES as Record<string, string | undefined>;
  return routes[key] || fallback;
}

function buildUrl(path: string) {
  if (!path) return baseUrl || '/';

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const normalizedBase = (baseUrl || '').replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${normalizedBase}${normalizedPath}`;
}

function normalizePath(path: string) {
  if (!path) return '/';

  try {
    const url = new URL(path, 'https://orangeproclean.local');
    return url.pathname.replace(/\/$/, '') || '/';
  } catch {
    return path.replace(/\/$/, '') || '/';
  }
}

function normalizeRole(role: string): NormalizedRole {
  const cleanRole = String(role || '').toLowerCase().trim();

  if (cleanRole === 'owner') return 'owner';
  if (cleanRole === 'admin') return 'admin';

  if (
    cleanRole === 'dispatch' ||
    cleanRole === 'dispatcher' ||
    cleanRole === 'disposition'
  ) {
    return 'dispatch';
  }

  if (cleanRole === 'employee' || cleanRole === 'mitarbeiter') return 'employee';
  if (cleanRole === 'client' || cleanRole === 'kunde') return 'client';

  return 'client';
}

function getRoleLabel(role: string) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === 'owner') return 'Inhaber';
  if (normalizedRole === 'admin') return 'Admin';
  if (normalizedRole === 'dispatch') return 'Disposition';
  if (normalizedRole === 'employee') return 'Mitarbeiter';

  return 'Kunde';
}

function getUserDisplayName(user: UserProfile | null) {
  const profile = user as any;

  return (
    profile?.full_name ||
    profile?.name ||
    profile?.display_name ||
    profile?.email ||
    'Benutzer'
  );
}

function getInitials(name: string) {
  const cleaned = String(name || '')
    .replace(/&/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim();

  if (!cleaned) return 'O';

  const parts = cleaned.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }

  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

export default function MirakaSidebar({ role, currentPath = '' }: MirakaSidebarProps) {
  const routes = useMemo(
    () => ({
      login: routeFor('login', '/'),
      dashboard: routeFor('dashboard', '/dashboard'),

      inquiries: routeFor('inquiries', '/anfragen'),
      calendar: routeFor('calendar', '/kalender'),

      clients: routeFor('clients', '/kunden'),
      jobs: routeFor('jobs', '/einsaetze'),
      timeTracking: routeFor('timeTracking', '/zeiterfassung'),
      files: routeFor('files', '/berichte-dateien'),
      tickets: routeFor('tickets', '/anfragen-schaeden'),
      qrCodes: routeFor('qrCodes', '/qr-codes'),
      settings: routeFor('settings', '/einstellungen'),
      logout: routeFor('logout', '/logout'),
    }),
    []
  );

  const [user, setUser] = useState<UserProfile | null>(null);
  const normalizedRole = normalizeRole((user as any)?.role || role);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;

    const savedState = window.localStorage.getItem(STORAGE_KEY_COLLAPSED);
    return savedState === 'true';
  });

  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [resolvedPath, setResolvedPath] = useState(currentPath);
  const [showCollapsedLogout, setShowCollapsedLogout] = useState(false);

  useEffect(() => {
    loadUserProfile();

    if (typeof window !== 'undefined') {
      setResolvedPath(currentPath || window.location.pathname);
    }
  }, [currentPath]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updatePath = () => {
      setResolvedPath(window.location.pathname);
    };

    window.addEventListener('popstate', updatePath);
    document.addEventListener('astro:page-load', updatePath);

    return () => {
      window.removeEventListener('popstate', updatePath);
      document.removeEventListener('astro:page-load', updatePath);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const width = isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

    document.documentElement.style.setProperty('--miraka-sidebar-width', `${width}px`);
    document.documentElement.style.setProperty('--opc-sidebar-width', `${width}px`);

    window.dispatchEvent(
      new CustomEvent('sidebarToggle', {
        detail: {
          isCollapsed,
          width,
        },
      })
    );
  }, [isCollapsed]);

  useEffect(() => {
    if (!isCollapsed) {
      setShowCollapsedLogout(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowCollapsedLogout(true);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [isCollapsed]);

  async function loadUserProfile() {
    try {
      const liveProfile = await loadOpcAuthProfile();

      if (liveProfile) {
        setUser(liveProfile);
        return;
      }

      const cachedProfile = readCachedOpcAuthProfile();

      if (cachedProfile) {
        setUser(cachedProfile);
        return;
      }

      if (typeof window === 'undefined') return;

      const rawUserData =
        window.localStorage.getItem('mco_user_data') ||
        window.localStorage.getItem('mco_auth');

      const cachedRole = window.localStorage.getItem('mco_user_role');

      if (rawUserData && cachedRole) {
        const cached = JSON.parse(rawUserData);

        setUser({
          id: cached.id,
          email: cached.email || '',
          full_name:
            cached.full_name ||
            cached.name ||
            cached.username ||
            cached.email ||
            'Benutzer',
          role: normalizeRole(cachedRole),
          created_at: '',
          updated_at: '',
        } as UserProfile);
      }
    } catch (error) {
      console.warn('Sidebar profile load failed:', error);
    }
  }

  async function handleLogout() {
    clearCachedOpcAuthProfile();

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('Supabase sign out failed:', error);
    }

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('mco_auth');
      window.localStorage.removeItem('mco_auth_token');
      window.localStorage.removeItem('mco_user_role');
      window.localStorage.removeItem('mco_user_data');
      window.localStorage.removeItem('opc_auth_token');
      window.localStorage.removeItem('opc_access');
      window.localStorage.removeItem('opc_user_id');
      window.localStorage.removeItem('opc_user_email');

      window.sessionStorage.removeItem('mco_auth_target');
      window.sessionStorage.removeItem('mco_auth_ready');

      safeNavigate(buildUrl(routes.login), { replace: true });
    }
  }

  function toggleSidebar() {
    const newState = !isCollapsed;

    setIsCollapsed(newState);

    try {
      window.localStorage.setItem(STORAGE_KEY_COLLAPSED, String(newState));
    } catch {
      // Sidebar still works without localStorage.
    }
  }

  const navigationItems = useMemo<NavItem[]>(() => {
    const ownerAdminDispatchItems: NavItem[] = [
      {
        href: buildUrl(routes.dashboard),
        label: 'Übersicht',
        icon: LayoutDashboard,
        key: 'overview',
        match: [routes.dashboard, '/dashboard'],
      },
      {
        href: buildUrl(routes.clients),
        label: 'Kunden',
        icon: Users,
        key: 'clients',
        match: [routes.clients, '/kunden', '/dashboard/owner/clients', '/dashboard/clients'],
      },
      {
        href: buildUrl(routes.inquiries),
        label: 'Anfragen',
        icon: Inbox,
        key: 'inquiries',
        match: [routes.inquiries, '/anfragen'],
      },
      {
        href: buildUrl(routes.calendar),
        label: 'Kalender',
        icon: CalendarDays,
        key: 'calendar',
        match: [routes.calendar, '/kalender', '/calendar', '/dashboard/calendar', '/dashboard/kalender'],
      },
      {
        href: buildUrl(routes.jobs),
        label: 'Einsätze',
        icon: Briefcase,
        key: 'jobs',
        match: [routes.jobs, '/einsaetze', '/dashboard/jobs'],
      },
      {
        href: buildUrl(routes.timeTracking),
        label: 'Zeiterfassung',
        icon: Clock,
        key: 'zeiterfassung',
        match: [routes.timeTracking, '/zeiterfassung', '/dashboard/zeiterfassung'],
      },
      {
        href: buildUrl(routes.tickets),
        label: 'Tickets & Schäden',
        icon: AlertTriangle,
        key: 'tickets',
        match: [routes.tickets, '/anfragen-schaeden', '/dashboard/tickets'],
      },
      {
        href: buildUrl(routes.qrCodes),
        label: 'QR-Codes',
        icon: QrCode,
        key: 'qr-codes',
        match: [routes.qrCodes, '/qr-codes', '/dashboard/qr-codes'],
      },
      {
        href: buildUrl(routes.files),
        label: 'Berichte & Dateien',
        icon: FileText,
        key: 'files',
        match: [routes.files, '/berichte-dateien', '/dashboard/files'],
      },
      {
        href: buildUrl(routes.settings),
        label: 'Einstellungen',
        icon: Settings,
        key: 'settings',
        match: [routes.settings, '/einstellungen', '/dashboard/settings'],
      },
    ];

    const employeeItems: NavItem[] = [
      {
        href: buildUrl(routes.dashboard),
        label: 'Übersicht',
        icon: LayoutDashboard,
        key: 'overview',
        match: [routes.dashboard, '/dashboard'],
      },
      {
        href: buildUrl(routes.timeTracking),
        label: 'Zeiterfassung',
        icon: Clock,
        key: 'zeiterfassung',
        match: [routes.timeTracking, '/zeiterfassung', '/dashboard/zeiterfassung'],
      },
      {
        href: buildUrl(routes.jobs),
        label: 'Einsätze',
        icon: Briefcase,
        key: 'jobs',
        match: [routes.jobs, '/einsaetze', '/dashboard/jobs'],
      },
      {
        href: buildUrl(routes.calendar),
        label: 'Kalender',
        icon: CalendarDays,
        key: 'calendar',
        match: [routes.calendar, '/kalender', '/calendar', '/dashboard/calendar', '/dashboard/kalender'],
      },
      {
        href: buildUrl(routes.settings),
        label: 'Einstellungen',
        icon: Settings,
        key: 'settings',
        match: [routes.settings, '/einstellungen', '/dashboard/settings'],
      },
    ];

    const clientItems: NavItem[] = [
      {
        href: buildUrl(routes.dashboard),
        label: 'Übersicht',
        icon: LayoutDashboard,
        key: 'overview',
        match: [routes.dashboard, '/dashboard'],
      },
      {
        href: buildUrl(routes.jobs),
        label: 'Einsätze',
        icon: Briefcase,
        key: 'jobs',
        match: [routes.jobs, '/einsaetze', '/dashboard/jobs'],
      },
      {
        href: buildUrl(routes.tickets),
        label: 'Tickets & Schäden',
        icon: AlertTriangle,
        key: 'tickets',
        match: [routes.tickets, '/anfragen-schaeden', '/dashboard/tickets'],
      },
      {
        href: buildUrl(routes.files),
        label: 'Berichte & Dateien',
        icon: FileText,
        key: 'files',
        match: [routes.files, '/berichte-dateien', '/dashboard/files'],
      },
      {
        href: buildUrl(routes.settings),
        label: 'Einstellungen',
        icon: Settings,
        key: 'settings',
        match: [routes.settings, '/einstellungen', '/dashboard/settings'],
      },
    ];

    if (normalizedRole === 'owner' || normalizedRole === 'admin' || normalizedRole === 'dispatch') {
      return ownerAdminDispatchItems;
    }

    if (normalizedRole === 'employee') {
      return employeeItems;
    }

    return clientItems;
  }, [normalizedRole, routes]);

  const activePath = normalizePath(resolvedPath);

  function isActive(item: NavItem) {
    return item.match.some((candidate) => {
      const normalizedCandidate = normalizePath(candidate);

      if (!normalizedCandidate || normalizedCandidate === '/') {
        return activePath === '/';
      }

      return (
        activePath === normalizedCandidate ||
        activePath.startsWith(`${normalizedCandidate}/`)
      );
    });
  }

  const mobilePrimaryButtons =
    normalizedRole === 'client'
      ? ['overview', 'jobs', 'tickets', 'settings']
      : normalizedRole === 'employee'
        ? ['overview', 'zeiterfassung', 'jobs', 'calendar', 'settings']
        : ['overview', 'zeiterfassung', 'jobs', 'settings'];

  function toggleMobileNav() {
    setIsMobileExpanded(!isMobileExpanded);
  }

  function handleMobileNavigate() {
    setIsMobileExpanded(false);
  }

  const userDisplayName = getUserDisplayName(user);
  const initials = getInitials(userDisplayName);

  const revealLabelStyle: CSSProperties = {
    opacity: isCollapsed ? 0 : 1,
    maxWidth: isCollapsed ? '0px' : '180px',
    marginLeft: isCollapsed ? '0px' : '12px',
    transform: isCollapsed ? 'translateX(-6px)' : 'translateX(0)',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    pointerEvents: isCollapsed ? 'none' : 'auto',
    transition: isCollapsed
      ? `
        opacity 90ms ease,
        max-width 220ms ${SIDEBAR_EASE},
        margin-left 260ms ${SIDEBAR_EASE},
        transform 120ms ease
      `
      : `
        opacity 180ms ease 140ms,
        max-width 360ms ${SIDEBAR_EASE},
        margin-left 320ms ${SIDEBAR_EASE},
        transform 220ms ${SIDEBAR_EASE} 110ms
      `,
  };

  const desktopButtonBaseStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '0px',
    padding: '0px',
    borderRadius: isCollapsed ? '16px' : '12px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    border: 'none',
    width: isCollapsed ? `${ICON_RAIL_WIDTH}px` : '100%',
    height: `${ICON_RAIL_WIDTH}px`,
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    textAlign: 'left',
    position: 'relative',
    flexShrink: 0,
    boxSizing: 'border-box',
    willChange: 'width, background, color',
    transition: `
      width 420ms ${SIDEBAR_EASE},
      border-radius 260ms ${SIDEBAR_EASE},
      background 180ms ease,
      color 180ms ease
    `,
  };

  const iconSlotStyle: CSSProperties = {
    width: `${ICON_RAIL_WIDTH}px`,
    height: `${ICON_RAIL_WIDTH}px`,
    minWidth: `${ICON_RAIL_WIDTH}px`,
    maxWidth: `${ICON_RAIL_WIDTH}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  return (
    <>
      <aside
        className="miraka-sidebar-desktop"
        style={{
          width: isCollapsed ? `${COLLAPSED_WIDTH}px` : `${EXPANDED_WIDTH}px`,
          background: '#ffffff',
          borderRight: '1px solid #E5E5E5',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          height: '100vh',
          left: 0,
          top: 0,
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          zIndex: 100,
          transition: SIDEBAR_WIDTH_TRANSITION,
          overflow: 'hidden',
          willChange: 'width',
        }}
      >
        <div
          style={{
            height: '96px',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: `${RAIL_PADDING_LEFT}px`,
            paddingRight: isCollapsed ? '12px' : '16px',
            borderBottom: 'none',
            flexShrink: 0,
            boxSizing: 'border-box',
            transition: `padding 420ms ${SIDEBAR_EASE}`,
          }}
        >
          <a
            href={buildUrl(routes.dashboard)}
            data-astro-prefetch="false"
            title="Orange Pro Clean GmbH"
            style={{
              display: 'flex',
              alignItems: 'center',
              width: isCollapsed ? `${ICON_RAIL_WIDTH}px` : '100%',
              minWidth: `${ICON_RAIL_WIDTH}px`,
              overflow: 'hidden',
              textDecoration: 'none',
              transition: `width 420ms ${SIDEBAR_EASE}`,
            }}
          >
            <div
              style={{
                width: `${ICON_RAIL_WIDTH}px`,
                minWidth: `${ICON_RAIL_WIDTH}px`,
                height: `${ICON_RAIL_WIDTH}px`,
                borderRadius: '14px',
                background: '#F7931F',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px',
                fontWeight: 900,
                letterSpacing: '-0.04em',
              }}
            >
              O
            </div>

            <img
              src={OPC_LOGO}
              alt="Orange Pro Clean GmbH"
              style={{
                height: '58px',
                width: '178px',
                objectFit: 'contain',
                objectPosition: 'left center',
                marginLeft: isCollapsed ? '0px' : '14px',
                opacity: isCollapsed ? 0 : 1,
                transform: isCollapsed ? 'translateX(-8px)' : 'translateX(0)',
                transition: isCollapsed
                  ? `opacity 100ms ease, margin-left 260ms ${SIDEBAR_EASE}, transform 160ms ease`
                  : `opacity 220ms ease 130ms, margin-left 320ms ${SIDEBAR_EASE}, transform 240ms ${SIDEBAR_EASE} 110ms`,
              }}
            />
          </a>
        </div>

        <div
          style={{
            padding: `8px 12px 8px ${RAIL_PADDING_LEFT}px`,
            borderBottom: 'none',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={toggleSidebar}
            title={isCollapsed ? 'Ausklappen' : 'Einklappen'}
            style={{
              ...desktopButtonBaseStyle,
              background: 'transparent',
              color: '#7A7A7A',
            }}
          >
            <span style={iconSlotStyle}>
              {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </span>

            <span
              style={{
                ...revealLabelStyle,
                fontSize: '14px',
                fontWeight: 800,
              }}
            >
              Einklappen
            </span>
          </button>
        </div>

        <nav
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: `0px 0px 0px ${RAIL_PADDING_LEFT}px`,
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);

            return (
              <a
                key={item.key}
                href={item.href}
                data-astro-prefetch="false"
                title={isCollapsed ? item.label : undefined}
                style={{
                  ...desktopButtonBaseStyle,
                  background: active ? '#F7F7F7' : 'transparent',
                  color: active ? '#1A1A1A' : '#7A7A7A',
                  textDecoration: 'none',
                }}
              >
                <span style={iconSlotStyle}>
                  <Icon size={20} strokeWidth={1.5} />
                </span>

                <span
                  style={{
                    ...revealLabelStyle,
                    fontSize: '14px',
                    fontWeight: 500,
                  }}
                >
                  {item.label}
                </span>
              </a>
            );
          })}
        </nav>

        <div
          style={{
            position: 'relative',
            height: isCollapsed ? '144px' : '88px',
            borderTop: 'none',
            padding: `16px 12px 16px ${RAIL_PADDING_LEFT}px`,
            display: 'flex',
            alignItems: 'flex-end',
            gap: '12px',
            flexShrink: 0,
            overflow: 'hidden',
            boxSizing: 'border-box',
            transition: `height 420ms ${SIDEBAR_EASE}`,
          }}
        >
          <button
            type="button"
            onClick={handleLogout}
            title="Abmelden"
            aria-label="Abmelden"
            style={{
              position: 'absolute',
              left: `${RAIL_PADDING_LEFT}px`,
              bottom: '76px',
              width: `${ICON_RAIL_WIDTH}px`,
              height: `${ICON_RAIL_WIDTH}px`,
              minWidth: `${ICON_RAIL_WIDTH}px`,
              borderRadius: '14px',
              background: '#F4F4F2',
              color: '#6C6C6C',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isCollapsed && showCollapsedLogout ? 1 : 0,
              transform: isCollapsed && showCollapsedLogout ? 'translateY(0)' : 'translateY(10px)',
              pointerEvents: isCollapsed && showCollapsedLogout ? 'auto' : 'none',
              transition: `
                opacity 220ms ease,
                transform 260ms ${SIDEBAR_EASE},
                background 180ms ease,
                color 180ms ease
              `,
            }}
          >
            <LogOut size={19} />
          </button>

          <div
            title={userDisplayName}
            style={{
              width: isCollapsed ? `${ICON_RAIL_WIDTH}px` : '44px',
              height: isCollapsed ? `${ICON_RAIL_WIDTH}px` : '44px',
              minWidth: isCollapsed ? `${ICON_RAIL_WIDTH}px` : '44px',
              borderRadius: '999px',
              background: '#111111',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              transition: `
                width 420ms ${SIDEBAR_EASE},
                height 420ms ${SIDEBAR_EASE},
                min-width 420ms ${SIDEBAR_EASE}
              `,
            }}
          >
            {initials}
          </div>

          <div
            style={{
              ...revealLabelStyle,
              display: 'grid',
              gap: '3px',
              flex: 1,
              minWidth: 0,
            }}
          >
            <strong
              style={{
                fontSize: '13px',
                lineHeight: 1.2,
                color: '#111111',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {userDisplayName}
            </strong>

            <span
              style={{
                fontSize: '12px',
                lineHeight: 1.2,
                color: '#777777',
              }}
            >
              {getRoleLabel(role)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            title="Abmelden"
            aria-label="Abmelden"
            style={{
              width: '34px',
              height: '34px',
              minWidth: '34px',
              borderRadius: '10px',
              border: 'none',
              background: 'transparent',
              color: '#777777',
              display: isCollapsed ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <LogOut size={19} />
          </button>
        </div>
      </aside>

      <div
        className="miraka-mobile-nav"
        style={{
          display: 'none',
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          pointerEvents: 'none',
        }}
      ></div>

      <div
        className="miraka-mobile-nav"
        style={{
          display: 'none',
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          pointerEvents: 'none',
        }}
      >
        <div
          onClick={() => setIsMobileExpanded(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: -1,
            opacity: isMobileExpanded ? 1 : 0,
            pointerEvents: isMobileExpanded ? 'auto' : 'none',
            transition: 'opacity 0.3s ease',
          }}
        />

        <div
          style={{
            position: 'relative',
            margin: '0 auto 20px',
            background: '#FFFFFF',
            borderRadius: isMobileExpanded ? '24px' : '27px',
            boxShadow:
              '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
            overflow: 'hidden',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            pointerEvents: 'auto',
            width: isMobileExpanded ? '90vw' : 'fit-content',
            maxWidth: isMobileExpanded ? '90vw' : 'none',
            transition:
              'width 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), border-radius 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        >
          <div
            style={{
              padding: isMobileExpanded ? '12px' : '9px',
              display: 'flex',
              flexDirection: isMobileExpanded ? 'column' : 'row',
              gap: isMobileExpanded ? '8px' : '6.75px',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {!isMobileExpanded && (
              <>
                <button
                  type="button"
                  onClick={toggleMobileNav}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '5.625px',
                    borderRadius: '18px',
                    background: 'transparent',
                    color: '#7A7A7A',
                    border: 'none',
                    cursor: 'pointer',
                    width: '49.5px',
                    height: '49.5px',
                    transition: 'background 0.3s ease, color 0.3s ease',
                    flexShrink: 0,
                  }}
                >
                  <ChevronUp size={27} strokeWidth={1.5} />
                </button>

                {mobilePrimaryButtons.map((buttonKey) => {
                  const item = navigationItems.find((nav) => nav.key === buttonKey);

                  if (!item) return null;

                  const Icon = item.icon;
                  const active = isActive(item);
                  const isPrimaryAction = item.key === 'zeiterfassung';

                  return (
                    <a
                      key={item.key}
                      href={item.href}
                      onClick={handleMobileNavigate}
                      title={item.label}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '5.625px',
                        borderRadius: '18px',
                        background: active
                          ? '#F7F7F7'
                          : isPrimaryAction
                            ? '#1A1A1A'
                            : 'transparent',
                        color: active
                          ? '#1A1A1A'
                          : isPrimaryAction
                            ? '#FFFFFF'
                            : '#7A7A7A',
                        border: 'none',
                        cursor: 'pointer',
                        width: '49.5px',
                        height: '49.5px',
                        flexShrink: 0,
                        transition: 'background 0.2s ease',
                        textDecoration: 'none',
                      }}
                    >
                      <Icon
                        size={isPrimaryAction ? 29.25 : 27}
                        strokeWidth={isPrimaryAction ? 2 : 1.5}
                      />
                    </a>
                  );
                })}
              </>
            )}

            {isMobileExpanded &&
              navigationItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);

                return (
                  <a
                    key={item.key}
                    href={item.href}
                    onClick={handleMobileNavigate}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 16px',
                      borderRadius: '18px',
                      background: active ? '#F7F7F7' : 'transparent',
                      color: active ? '#1A1A1A' : '#7A7A7A',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '15px',
                      fontWeight: 500,
                      width: '100%',
                      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                      textAlign: 'left',
                      textDecoration: 'none',
                    }}
                  >
                    <Icon size={24} strokeWidth={1.5} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                  </a>
                );
              })}

            {isMobileExpanded && (
              <>
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px 16px',
                    borderRadius: '18px',
                    background: 'transparent',
                    color: '#DC2626',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '15px',
                    fontWeight: 500,
                    width: '100%',
                    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                    textAlign: 'left',
                  }}
                >
                  <LogOut size={24} strokeWidth={1.5} />
                  <span style={{ flex: 1 }}>Abmelden</span>
                </button>

                <button
                  type="button"
                  onClick={toggleMobileNav}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    padding: '14px',
                    borderRadius: '18px',
                    background: '#1A1A1A',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '15px',
                    fontWeight: 600,
                    width: '100%',
                    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                    transition: 'background 0.3s ease, color 0.3s ease',
                    marginTop: '4px',
                  }}
                >
                  <ChevronDown size={24} strokeWidth={2} />
                  <span style={{ whiteSpace: 'nowrap' }}>Menü schließen</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .miraka-sidebar-desktop nav {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .miraka-sidebar-desktop nav::-webkit-scrollbar {
          display: none;
        }

        @media (max-width: 768px) {
          .miraka-sidebar-desktop {
            display: none !important;
          }

          .miraka-mobile-nav {
            display: block !important;
          }

          :root {
            --miraka-sidebar-width: 0px !important;
            --opc-sidebar-width: 0px !important;
          }
        }

        @media (min-width: 769px) {
          .miraka-mobile-nav {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
