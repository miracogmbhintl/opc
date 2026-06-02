/**
 * Orange Pro Clean Sidebar
 * Fixed active-route matching.
 * Adds separate /anfragen route.
 * Adds /kalender route.
 * Keeps /anfragen-schaeden separate from /anfragen.
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { supabase, type UserProfile } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import { OPC_ROUTES } from '../lib/opc-routes';
import {
  AlertTriangle,
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  QrCode,
  Settings,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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

const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 280;
const RAIL_PADDING_LEFT = 14;
const ICON_RAIL_WIDTH = 48;

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

  if (!cleaned) return 'A';

  const parts = cleaned.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }

  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

export default function MirakaSidebar({ role, currentPath = '' }: MirakaSidebarProps) {
  const normalizedRole = normalizeRole(role);

  const routes = useMemo(
    () => ({
      login: routeFor('login', '/'),
      dashboard: routeFor('dashboard', '/dashboard'),

      inquiries: routeFor('inquiries', '/anfragen'),
      calendar: routeFor('calendar', '/kalender'),

      clients: routeFor('clients', '/kunden'),
      jobs: routeFor('jobs', '/einsaetze'),
      files: routeFor('files', '/berichte-dateien'),
      tickets: routeFor('tickets', '/anfragen-schaeden'),
      qrCodes: routeFor('qrCodes', '/qr-codes'),
      timeTracking: routeFor('timeTracking', '/zeiterfassung'),
      settings: routeFor('settings', '/einstellungen'),
      logout: routeFor('logout', '/logout'),
    }),
    []
  );

  const [user, setUser] = useState<UserProfile | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;

    const savedState = window.localStorage.getItem(STORAGE_KEY_COLLAPSED);
    return savedState === 'true';
  });

  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [resolvedPath, setResolvedPath] = useState(currentPath);
  const [showCollapsedFooter, setShowCollapsedFooter] = useState(isCollapsed);

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
      setShowCollapsedFooter(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowCollapsedFooter(true);
    }, 430);

    return () => window.clearTimeout(timer);
  }, [isCollapsed]);

  async function loadUserProfile() {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profile) {
        setUser(profile as UserProfile);
      }
    } catch (error) {
      console.warn('Sidebar profile load failed:', error);
    }
  }

  async function handleLogout() {
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

      window.location.href = buildUrl(routes.login);
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
        href: buildUrl(routes.timeTracking),
        label: 'Zeiterfassung',
        icon: Clock3,
        key: 'time-tracking',
        match: [routes.timeTracking, '/zeiterfassung', '/zeiterfassung/'],
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
        key: 'employee-overview',
        match: [routes.dashboard, '/dashboard'],
      },
      {
        href: buildUrl(routes.calendar),
        label: 'Kalender',
        icon: CalendarDays,
        key: 'employee-calendar',
        match: [routes.calendar, '/kalender', '/calendar', '/dashboard/calendar', '/dashboard/kalender'],
      },
      {
        href: buildUrl(routes.timeTracking),
        label: 'Zeiterfassung',
        icon: Clock3,
        key: 'employee-time-tracking',
        match: [routes.timeTracking, '/zeiterfassung', '/zeiterfassung/'],
      },
      {
        href: buildUrl(routes.jobs),
        label: 'Einsätze',
        icon: Briefcase,
        key: 'employee-jobs',
        match: [routes.jobs, '/einsaetze', '/dashboard/jobs'],
      },
      {
        href: buildUrl(routes.tickets),
        label: 'Tickets & Schäden',
        icon: AlertTriangle,
        key: 'employee-tickets',
        match: [routes.tickets, '/anfragen-schaeden', '/dashboard/tickets'],
      },
      {
        href: buildUrl(routes.files),
        label: 'Berichte & Dateien',
        icon: FileText,
        key: 'employee-files',
        match: [routes.files, '/berichte-dateien', '/dashboard/files'],
      },
    ];

    const clientItems: NavItem[] = [
      {
        href: buildUrl(routes.dashboard),
        label: 'Übersicht',
        icon: LayoutDashboard,
        key: 'client-overview',
        match: [routes.dashboard, '/dashboard'],
      },
      {
        href: buildUrl(routes.jobs),
        label: 'Einsätze',
        icon: Briefcase,
        key: 'client-jobs',
        match: [routes.jobs, '/einsaetze', '/dashboard/jobs'],
      },
      {
        href: buildUrl(routes.tickets),
        label: 'Tickets & Schäden',
        icon: AlertTriangle,
        key: 'client-tickets',
        match: [routes.tickets, '/anfragen-schaeden', '/dashboard/tickets'],
      },
      {
        href: buildUrl(routes.files),
        label: 'Berichte & Dateien',
        icon: FileText,
        key: 'client-files',
        match: [routes.files, '/berichte-dateien', '/dashboard/files'],
      },
      {
        href: buildUrl(routes.settings),
        label: 'Einstellungen',
        icon: Settings,
        key: 'client-settings',
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

  const userDisplayName = getUserDisplayName(user);
  const initials = getInitials(userDisplayName);

  const revealLabelStyle: CSSProperties = {
    opacity: isCollapsed ? 0 : 1,
    maxWidth: isCollapsed ? '0px' : '190px',
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
    borderRadius: isCollapsed ? '16px' : '14px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    border: 'none',
    width: isCollapsed ? `${ICON_RAIL_WIDTH}px` : '100%',
    height: `${ICON_RAIL_WIDTH}px`,
    fontFamily: 'Inter, Helvetica, Arial, sans-serif',
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
          borderRight: '1px solid #E8E8E8',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          height: '100vh',
          left: 0,
          top: 0,
          fontFamily: 'Inter, Helvetica, Arial, sans-serif',
          zIndex: 100,
          transition: SIDEBAR_WIDTH_TRANSITION,
          overflow: 'hidden',
          willChange: 'width',
        }}
      >
        <div
          style={{
            height: '102px',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: `${RAIL_PADDING_LEFT}px`,
            paddingRight: isCollapsed ? '12px' : '18px',
            borderBottom: '1px solid #EDEDED',
            flexShrink: 0,
            boxSizing: 'border-box',
            transition: `padding 420ms ${SIDEBAR_EASE}`,
          }}
        >
          <a
            href={buildUrl(routes.dashboard)}
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
                borderRadius: '13px',
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
                height: '62px',
                width: '182px',
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
            padding: '22px 14px 10px 14px',
            borderBottom: '1px solid #EDEDED',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={toggleSidebar}
            style={{
              ...desktopButtonBaseStyle,
              background: 'transparent',
              color: '#707070',
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
            gap: '7px',
            padding: '22px 14px',
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
                title={isCollapsed ? item.label : undefined}
                style={{
                  ...desktopButtonBaseStyle,
                  background: active ? '#F3F3F1' : 'transparent',
                  color: active ? '#111111' : '#6C6C6C',
                  textDecoration: 'none',
                }}
              >
                {active ? (
                  <span
                    style={{
                      position: 'absolute',
                      left: '-14px',
                      width: '3px',
                      height: '24px',
                      borderRadius: '999px',
                      background: '#F7931F',
                    }}
                  />
                ) : null}

                <span style={iconSlotStyle}>
                  <Icon
                    size={21}
                    strokeWidth={active ? 2.35 : 2.1}
                    color={active ? '#F7931F' : '#6C6C6C'}
                  />
                </span>

                <span
                  style={{
                    ...revealLabelStyle,
                    fontSize: '14px',
                    fontWeight: active ? 900 : 760,
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
            height: '92px',
            borderTop: '1px solid #EDEDED',
            padding: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {showCollapsedFooter && isCollapsed ? (
            <button
              type="button"
              onClick={handleLogout}
              title="Abmelden"
              style={{
                width: `${ICON_RAIL_WIDTH}px`,
                height: `${ICON_RAIL_WIDTH}px`,
                minWidth: `${ICON_RAIL_WIDTH}px`,
                borderRadius: '999px',
                background: '#111111',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 900,
                fontFamily: 'inherit',
              }}
            >
              {initials}
            </button>
          ) : (
            <>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  minWidth: '44px',
                  borderRadius: '999px',
                  background: '#111111',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 900,
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
            </>
          )}
        </div>
      </aside>

      <button
        type="button"
        className="miraka-sidebar-mobile-toggle"
        onClick={() => setIsMobileExpanded(true)}
        style={{
          position: 'fixed',
          left: '16px',
          top: '16px',
          zIndex: 210,
          width: '46px',
          height: '46px',
          borderRadius: '14px',
          background: '#F7931F',
          color: '#ffffff',
          border: 'none',
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 14px 35px rgba(0,0,0,0.18)',
          fontWeight: 900,
        }}
      >
        O
      </button>

      {isMobileExpanded ? (
        <div
          className="miraka-sidebar-mobile-overlay"
          onClick={() => setIsMobileExpanded(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.34)',
            zIndex: 220,
            display: 'none',
          }}
        >
          <aside
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(86vw, 320px)',
              height: '100vh',
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              padding: '18px',
              boxSizing: 'border-box',
              boxShadow: '20px 0 60px rgba(0,0,0,0.18)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                paddingBottom: '18px',
                borderBottom: '1px solid #ededed',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '14px',
                  background: '#F7931F',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                }}
              >
                O
              </div>

              <img
                src={OPC_LOGO}
                alt="Orange Pro Clean GmbH"
                style={{
                  height: '58px',
                  width: '180px',
                  objectFit: 'contain',
                  objectPosition: 'left center',
                }}
              />
            </div>

            <nav
              style={{
                display: 'grid',
                gap: '8px',
                paddingTop: '18px',
                flex: 1,
                overflowY: 'auto',
              }}
            >
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);

                return (
                  <a
                    key={item.key}
                    href={item.href}
                    style={{
                      minHeight: '48px',
                      borderRadius: '14px',
                      background: active ? '#F3F3F1' : 'transparent',
                      color: active ? '#111111' : '#666666',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '0 14px',
                      textDecoration: 'none',
                      fontSize: '14px',
                      fontWeight: active ? 900 : 750,
                    }}
                  >
                    <Icon size={20} color={active ? '#F7931F' : '#666666'} />
                    {item.label}
                  </a>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={handleLogout}
              style={{
                minHeight: '46px',
                borderRadius: '14px',
                border: 'none',
                background: '#111111',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: 850,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              <LogOut size={18} />
              Abmelden
            </button>
          </aside>
        </div>
      ) : null}

      <style>{`
        @media (max-width: 768px) {
          .miraka-sidebar-desktop {
            display: none !important;
          }

          .miraka-sidebar-mobile-toggle {
            display: flex !important;
          }

          .miraka-sidebar-mobile-overlay {
            display: block !important;
          }

          :root {
            --miraka-sidebar-width: 0px !important;
            --opc-sidebar-width: 0px !important;
          }
        }
      `}</style>
    </>
  );
}