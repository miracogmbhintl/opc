import { useState, useEffect } from 'react';
import { baseUrl } from '../lib/base-url';

interface SidebarProps {
  currentPath: string;
  userRole?: string;
  userName?: string;
  userEmail?: string;
}

export default function Sidebar({ currentPath, userRole = 'client', userName = 'User', userEmail = '' }: SidebarProps) {
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  // Navigation items based on role
  const getNavigationItems = () => {
    const baseItems = [
      { label: 'Dashboard', href: `${baseUrl}/`, icon: 'home' },
      { label: 'Projects', href: `${baseUrl}/client-dashboard`, icon: 'briefcase' },
      { label: 'Media Library', href: `${baseUrl}/media-library`, icon: 'image' },
    ];

    // Add admin/owner specific items
    if (userRole === 'admin' || userRole === 'owner') {
      baseItems.push({ label: 'Team', href: `${baseUrl}/admin/team`, icon: 'users' });
    }

    if (userRole === 'owner') {
      baseItems.push({ label: 'Client Accounts', href: `${baseUrl}/admin/clients`, icon: 'user-check' });
    }

    baseItems.push({ label: 'Profile Settings', href: `${baseUrl}/kunde/profile`, icon: 'settings' });

    return baseItems;
  };

  const navigationItems = getNavigationItems();

  // Get icon SVG
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'home':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        );
      case 'briefcase':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        );
      case 'image':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        );
      case 'users':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        );
      case 'user-check':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <polyline points="17 11 19 13 23 9" />
          </svg>
        );
      case 'settings':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v6m0 6v6m6-12v6m0 6v6M6 1v6m0 6v6" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
          </svg>
        );
      default:
        return null;
    }
  };

  const isActive = (href: string) => {
    // Remove baseUrl for comparison
    const normalizedHref = href.replace(baseUrl, '');
    const normalizedPath = currentPath.replace(baseUrl, '');
    
    if (normalizedHref === '/' && normalizedPath === '/') {
      return true;
    }
    
    if (normalizedHref !== '/' && normalizedPath.startsWith(normalizedHref)) {
      return true;
    }
    
    return false;
  };

  return (
    <>
      {/* Sidebar */}
      <aside
        className="sidebar-wrapper"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          width: '280px',
          backgroundColor: '#0D0D0D',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
          transition: 'transform 0.3s ease',
        }}
      >
        {/* Logo/Brand Section */}
        <div style={{
          padding: '32px 24px',
          borderBottom: '1px solid rgba(249, 250, 251, 0.1)',
        }}>
          <img 
            src="https://cdn.prod.website-files.com/68dc2b9c31cb83ac9f84a1af/68e0480bc44f1d28032afb51_LOGO%20MIRAKA%20%26%20CO%20PLAIN%20TEXT.png"
            alt="MIRAKA & CO."
            style={{
              width: '100%',
              maxWidth: '180px',
              height: 'auto',
              display: 'block',
              filter: 'brightness(0) invert(1)',
            }}
          />
        </div>

        {/* Navigation Links */}
        <nav style={{
          flex: 1,
          padding: '24px 0',
          overflowY: 'auto',
        }}>
          {navigationItems.map((item) => {
            const active = isActive(item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 24px',
                  color: active ? '#1A1A1A' : '#F9FAFB',
                  textDecoration: 'none',
                  fontSize: '15px',
                  fontWeight: active ? 600 : 500,
                  fontFamily: "'Inter', sans-serif",
                  transition: 'all 0.2s ease',
                  backgroundColor: active ? 'rgba(214, 195, 154, 0.08)' : 'transparent',
                  borderLeft: active ? '3px solid #1A1A1A' : '3px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'rgba(249, 250, 251, 0.05)';
                    e.currentTarget.style.color = '#1A1A1A';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#F9FAFB';
                  }
                }}
              >
                {getIcon(item.icon)}
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        {/* User Info Section */}
        <div style={{
          padding: '24px',
          borderTop: '1px solid rgba(249, 250, 251, 0.1)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            {/* User Avatar */}
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#1A1A1A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 600,
              color: '#0D0D0D',
            }}>
              {userName.charAt(0).toUpperCase()}
            </div>

            {/* User Details */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#F9FAFB',
                fontFamily: "'Inter', sans-serif",
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {userName}
              </div>
              <div style={{
                fontSize: '12px',
                fontWeight: 400,
                color: 'rgba(249, 250, 251, 0.6)',
                fontFamily: "'Inter', sans-serif",
                textTransform: 'capitalize',
              }}>
                {userRole}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION */}
      <div
        className="miraka-mobile-nav"
        style={{
          display: 'none',
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          fontFamily: "'Inter', sans-serif",
          pointerEvents: 'none'
        }}
      >
        {/* Backdrop */}
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
            zIndex: -1
          }}
        />

        {/* Navigation Island */}
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
            transition: 'all 0.4s ease'
          }}
        >
          <div
            style={{
              padding: isMobileExpanded ? '12px' : '9px',
              display: 'flex',
              flexDirection: isMobileExpanded ? 'column' : 'row',
              gap: isMobileExpanded ? '8px' : '6px',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >

            {/* COLLAPSED STATE */}
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
                    cursor: 'pointer'
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {navigationItems.slice(0, 4).map(item => {
                  const active = isActive(item.href);

                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: active ? '#1A1A1A' : 'transparent',
                        color: '#F9FAFB',
                        textDecoration: 'none',
                        transition: 'background 0.2s ease'
                      }}
                    >
                      {getIcon(item.icon)}
                    </a>
                  );
                })}
              </>
            )}

            {/* EXPANDED STATE */}
            {isMobileExpanded && (
              <>
                {navigationItems.map(item => {
                  const active = isActive(item.href);

                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileExpanded(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '14px 16px',
                        borderRadius: '18px',
                        background: active ? 'rgba(214,195,154,0.08)' : 'transparent',
                        color: '#F9FAFB',
                        fontSize: '15px',
                        fontWeight: 500,
                        width: '100%',
                        textDecoration: 'none'
                      }}
                    >
                      {getIcon(item.icon)}
                      <span>{item.label}</span>
                    </a>
                  );
                })}

                {/* Logout Button */}
                <a
                  href={`${baseUrl}/logout`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px 16px',
                    borderRadius: '18px',
                    background: 'transparent',
                    color: '#F9FAFB',
                    fontSize: '15px',
                    fontWeight: 500,
                    width: '100%',
                    textDecoration: 'none',
                    marginTop: '8px',
                    borderTop: '1px solid rgba(249,250,251,0.08)',
                    paddingTop: '20px'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Sign Out</span>
                </a>

                <button
                  onClick={() => setIsMobileExpanded(false)}
                  style={{
                    marginTop: '4px',
                    padding: '14px 16px',
                    borderRadius: '18px',
                    background: 'rgba(249,250,251,0.1)',
                    color: '#F9FAFB',
                    border: 'none',
                    width: '100%',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Close Menu
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .sidebar-wrapper {
            display: none !important;
          }

          .mobile-menu-button {
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
      `}</style>
    </>
  );
}



