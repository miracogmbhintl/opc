/**
 * Orange Pro Clean Sidebar
 * Same component name preserved to avoid breaking existing imports.
 */

import { useEffect, useState } from 'react';
import { supabase, UserProfile } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  FileText,
  MessageSquare,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface MirakaSidebarProps {
  role: string;
  currentPath?: string;
}

const OPC_LOGO =
  'https://cdn.prod.website-files.com/6944470386300e196e5fc347/6949534529e8342842456097_REGULAR%20COLOR%20ORANGE%20PRO%20CLEAN%20LOGO%20ORIGINAL.png';

export default function MirakaSidebar({ role, currentPath = '' }: MirakaSidebarProps) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  useEffect(() => {
    loadUserProfile();

    const savedState = localStorage.getItem('miraka_sidebar_collapsed');
    if (savedState === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  const loadUserProfile = async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) return;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (profile) {
      setUser(profile as UserProfile);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = `${baseUrl}/miraka-co-portal`;
  };

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('miraka_sidebar_collapsed', String(newState));

    window.dispatchEvent(
      new CustomEvent('sidebarToggle', {
        detail: { isCollapsed: newState },
      })
    );
  };

  const getNavItems = () => {
    const ownerAdminItems = [
      {
        href: `${baseUrl}/miraka-co-portal/owner-dashboard`,
        label: 'Übersicht',
        icon: LayoutDashboard,
        key: 'owner-dashboard',
      },
      {
        href: `${baseUrl}/miraka-co-portal/clients`,
        label: 'Kunden',
        icon: Users,
        key: 'clients',
      },
      {
        href: `${baseUrl}/miraka-co-portal/projects`,
        label: 'Einsätze',
        icon: Briefcase,
        key: 'projects',
      },
      {
        href: `${baseUrl}/miraka-co-portal/files`,
        label: 'Berichte & Dateien',
        icon: FileText,
        key: 'files',
      },
      {
        href: `${baseUrl}/miraka-co-portal/tickets`,
        label: 'Anfragen & Schäden',
        icon: MessageSquare,
        key: 'tickets',
      },
      {
        href: `${baseUrl}/miraka-co-portal/settings`,
        label: 'Einstellungen',
        icon: Settings,
        key: 'settings',
      },
    ];

    const clientItems = [
      {
        href: `${baseUrl}/miraka-co-portal/client-dashboard`,
        label: 'Übersicht',
        icon: LayoutDashboard,
        key: 'client-dashboard',
      },
      {
        href: `${baseUrl}/miraka-co-portal/client/projects`,
        label: 'Meine Einsätze',
        icon: Briefcase,
        key: 'projects',
      },
      {
        href: `${baseUrl}/miraka-co-portal/client/files`,
        label: 'Berichte & Dateien',
        icon: FileText,
        key: 'files',
      },
      {
        href: `${baseUrl}/miraka-co-portal/client/tickets`,
        label: 'Nachrichten',
        icon: MessageSquare,
        key: 'tickets',
      },
      {
        href: `${baseUrl}/miraka-co-portal/client/settings`,
        label: 'Einstellungen',
        icon: Settings,
        key: 'settings',
      },
    ];

    return role === 'client' ? clientItems : ownerAdminItems;
  };

  const navItems = getNavItems();

  const isActive = (itemKey: string) => {
    return currentPath.includes(itemKey);
  };

  const roleLabel =
    role === 'owner'
      ? 'Inhaber'
      : role === 'admin'
        ? 'Admin'
        : role === 'dispatch'
          ? 'Disposition'
          : role === 'employee'
            ? 'Mitarbeiter'
            : 'Kunde';

  return (
    <>
      <aside
        style={{
          width: isCollapsed ? '80px' : '260px',
          background: '#FFFFFF',
          borderRight: '1px solid #E5E5E5',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          height: '100vh',
          left: 0,
          top: 0,
          fontFamily:
            "'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
          zIndex: 100,
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
        }}
        className="miraka-desktop-sidebar"
      >
        <div
          style={{
            padding: isCollapsed ? '28px 18px' : '30px 22px',
            borderBottom: '1px solid #E5E5E5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '86px',
          }}
        >
          {!isCollapsed ? (
            <img
              src={OPC_LOGO}
              alt="Orange Pro Clean"
              style={{
                maxWidth: '190px',
                width: '100%',
                height: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : (
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: '#FF7A00',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: 800,
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              O
            </div>
          )}
        </div>

        <nav
          style={{
            flex: 1,
            padding: '24px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          <button
            onClick={toggleSidebar}
            title={isCollapsed ? 'Sidebar öffnen' : 'Sidebar schliessen'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: isCollapsed ? '12px 0' : '10px 16px',
              borderRadius: '10px',
              color: '#6B6B6B',
              background: 'transparent',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.2s ease',
              cursor: 'pointer',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              border: 'none',
              width: '100%',
              fontFamily: "'Inter', sans-serif",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#F2F2F2';
              e.currentTarget.style.color = '#1A1A1A';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#6B6B6B';
            }}
          >
            {isCollapsed ? (
              <ChevronRight size={20} strokeWidth={2} style={{ flexShrink: 0 }} />
            ) : (
              <>
                <ChevronLeft size={20} strokeWidth={2} style={{ flexShrink: 0 }} />
                <span>Einklappen</span>
              </>
            )}
          </button>

          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.key);

            return (
              <a
                key={item.key}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: isCollapsed ? '12px 0' : '10px 16px',
                  borderRadius: '10px',
                  color: active ? '#1A1A1A' : '#6B6B6B',
                  background: active ? '#F2F2F2' : 'transparent',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: active ? 600 : 500,
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  fontFamily: "'Inter', sans-serif",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = '#F2F2F2';
                    e.currentTarget.style.color = '#1A1A1A';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#6B6B6B';
                  }
                }}
              >
                <Icon size={20} strokeWidth={2} style={{ flexShrink: 0 }} />
                {!isCollapsed && <span>{item.label}</span>}
              </a>
            );
          })}
        </nav>

        <div
          style={{
            padding: '20px 24px',
            borderTop: '1px solid #E5E5E5',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            overflow: 'hidden',
            flexDirection: isCollapsed ? 'column' : 'row',
            visibility: 'visible',
            opacity: 1,
            zIndex: 10,
            position: 'relative',
            background: '#FFFFFF',
          }}
          className="miraka-sidebar-footer-section"
        >
          {user && (
            <>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#1A1A1A',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 600,
                  flexShrink: 0,
                  textTransform: 'uppercase',
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                {user.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
              </div>

              {!isCollapsed && (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#1A1A1A',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      {user.full_name || user.email?.split('@')[0] || 'User'}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#6B6B6B',
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      {roleLabel}
                    </div>
                  </div>

                  <div
                    className="miraka-logout-button-wrapper"
                    style={{
                      display: 'flex !important' as any,
                      visibility: 'visible !important' as any,
                      opacity: '1 !important' as any,
                      pointerEvents: 'auto !important' as any,
                      flexShrink: 0,
                    }}
                  >
                    <button
                      onClick={handleLogout}
                      title="Abmelden"
                      className="miraka-logout-button"
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'transparent',
                        color: '#6B6B6B',
                        display: 'flex !important' as any,
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        flexShrink: 0,
                        visibility: 'visible !important' as any,
                        opacity: '1 !important' as any,
                        zIndex: '999 !important' as any,
                        pointerEvents: 'auto !important' as any,
                        position: 'relative',
                        padding: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#1A1A1A';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#6B6B6B';
                      }}
                    >
                      <LogOut size={20} strokeWidth={2} />
                    </button>
                  </div>
                </>
              )}

              {isCollapsed && (
                <div
                  className="miraka-logout-button-wrapper"
                  style={{
                    display: 'flex !important' as any,
                    visibility: 'visible !important' as any,
                    opacity: '1 !important' as any,
                    pointerEvents: 'auto !important' as any,
                    flexShrink: 0,
                  }}
                >
                  <button
                    onClick={handleLogout}
                    title="Abmelden"
                    className="miraka-logout-button"
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'transparent',
                      color: '#6B6B6B',
                      display: 'flex !important' as any,
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      flexShrink: 0,
                      visibility: 'visible !important' as any,
                      opacity: '1 !important' as any,
                      zIndex: '999 !important' as any,
                      pointerEvents: 'auto !important' as any,
                      position: 'relative',
                      padding: 0,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#1A1A1A';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#6B6B6B';
                    }}
                  >
                    <LogOut size={20} strokeWidth={2} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      <div
        id="miraka-sidebar-spacer"
        className="miraka-desktop-sidebar-spacer"
        style={{
          width: isCollapsed ? '80px' : '260px',
          flexShrink: 0,
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />

      <div
        className="miraka-mobile-nav mobile-drawer-shell"
        style={{
          display: 'none',
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          fontFamily: "'Inter', sans-serif",
          pointerEvents: 'none',
        }}
      >
        <div
          onClick={() => setIsMobileExpanded(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
            opacity: isMobileExpanded ? 1 : 0,
            pointerEvents: isMobileExpanded ? 'auto' : 'none',
            transition: 'opacity 0.3s ease',
            zIndex: 9998,
          }}
        />

        <div
          style={{
            position: 'relative',
            margin: '0 auto 20px',
            background: '#0D0D0D',
            borderRadius: isMobileExpanded ? '24px' : '27px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            border: '1px solid rgba(249,250,251,0.08)',
            overflow: 'hidden',
            pointerEvents: 'auto',
            width: isMobileExpanded ? '90vw' : 'fit-content',
            transition: 'all 0.4s ease',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              padding: isMobileExpanded ? '12px' : '9px',
              display: 'flex',
              flexDirection: isMobileExpanded ? 'column' : 'row',
              gap: isMobileExpanded ? '8px' : '6px',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {!isMobileExpanded && (
              <>
                <button
                  onClick={() => setIsMobileExpanded(true)}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '18px',
                    border: 'none',
                    background: 'transparent',
                    color: '#F9FAFB',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {navItems.slice(0, 4).map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.key);

                  return (
                    <a
                      key={item.key}
                      href={item.href}
                      className="mobile-drawer-item"
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: active ? 'rgba(255,122,0,0.22)' : 'transparent',
                        color: '#F9FAFB',
                        textDecoration: 'none',
                        transition: 'background 0.2s ease',
                      }}
                    >
                      <Icon size={20} strokeWidth={2} />
                    </a>
                  );
                })}
              </>
            )}

            {isMobileExpanded && (
              <>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.key);

                  return (
                    <a
                      key={item.key}
                      href={item.href}
                      onClick={() => setIsMobileExpanded(false)}
                      className="mobile-drawer-item"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '14px 16px',
                        borderRadius: '18px',
                        background: active ? 'rgba(255,122,0,0.16)' : 'transparent',
                        color: 'rgba(255,255,255,0.92)',
                        WebkitTextFillColor: 'rgba(255,255,255,0.92)',
                        fontSize: '15px',
                        fontWeight: 500,
                        width: '100%',
                        textDecoration: 'none',
                        opacity: 1,
                      }}
                    >
                      <Icon size={20} strokeWidth={2} style={{ color: 'rgba(255,255,255,0.92)', flexShrink: 0 }} />
                      <span
                        className="mobile-drawer-label"
                        style={{
                          color: 'rgba(255,255,255,0.92)',
                          WebkitTextFillColor: 'rgba(255,255,255,0.92)',
                          opacity: 1,
                        }}
                      >
                        {item.label}
                      </span>
                    </a>
                  );
                })}

                <button
                  onClick={handleLogout}
                  className="mobile-drawer-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px 16px',
                    borderRadius: '18px',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.92)',
                    WebkitTextFillColor: 'rgba(255,255,255,0.92)',
                    fontSize: '15px',
                    fontWeight: 500,
                    width: '100%',
                    textDecoration: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    marginTop: '8px',
                    borderTop: '1px solid rgba(249,250,251,0.08)',
                    paddingTop: '20px',
                    opacity: 1,
                  }}
                >
                  <LogOut size={20} strokeWidth={2} style={{ color: 'rgba(255,255,255,0.92)', flexShrink: 0 }} />
                  <span
                    className="mobile-drawer-label"
                    style={{
                      color: 'rgba(255,255,255,0.92)',
                      WebkitTextFillColor: 'rgba(255,255,255,0.92)',
                      opacity: 1,
                    }}
                  >
                    Abmelden
                  </span>
                </button>

                <button
                  onClick={() => setIsMobileExpanded(false)}
                  className="mobile-drawer-item"
                  style={{
                    marginTop: '4px',
                    padding: '14px 16px',
                    borderRadius: '18px',
                    background: 'rgba(249,250,251,0.1)',
                    color: 'rgba(255,255,255,0.92)',
                    WebkitTextFillColor: 'rgba(255,255,255,0.92)',
                    border: 'none',
                    width: '100%',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: 1,
                  }}
                >
                  <span
                    className="mobile-drawer-label"
                    style={{
                      color: 'rgba(255,255,255,0.92)',
                      WebkitTextFillColor: 'rgba(255,255,255,0.92)',
                      opacity: 1,
                    }}
                  >
                    Menü schliessen
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .miraka-logout-button-wrapper {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
        }

        .miraka-logout-button {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
        }

        .miraka-sidebar-footer-section {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
        }

        @media (max-width: 768px) {
          .miraka-desktop-sidebar,
          .miraka-desktop-sidebar-spacer {
            display: none !important;
          }

          .miraka-mobile-nav {
            display: block !important;
          }

          body {
            padding-bottom: 120px;
          }
        }

        @media (min-width: 769px) {
          .miraka-mobile-nav {
            display: none !important;
          }
        }

        .mobile-drawer-shell .mobile-drawer-label {
          color: rgba(255,255,255,0.92) !important;
          -webkit-text-fill-color: rgba(255,255,255,0.92) !important;
          opacity: 1 !important;
        }

        .mobile-drawer-shell .mobile-drawer-item {
          color: rgba(255,255,255,0.92) !important;
        }

        .mobile-drawer-shell .mobile-drawer-item span {
          color: rgba(255,255,255,0.92) !important;
          -webkit-text-fill-color: rgba(255,255,255,0.92) !important;
        }

        .mobile-drawer-shell a,
        .mobile-drawer-shell button {
          color: rgba(255,255,255,0.92) !important;
        }

        .mobile-drawer-shell svg {
          color: rgba(255,255,255,0.92) !important;
          stroke: rgba(255,255,255,0.92) !important;
        }
      `}</style>
    </>
  );
}