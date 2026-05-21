import { useState, useEffect } from 'react';
import { baseUrl } from '../lib/base-url';

type OpcPortalRole = 'owner' | 'admin' | 'dispatch' | 'employee' | 'client';

interface DashboardSidebarProps {
  role: OpcPortalRole;
  currentPath: string;
  onLogout: () => void;
}

const OPC_LOGO =
  'https://cdn.prod.website-files.com/6944470386300e196e5fc347/6949534529e8342842456097_REGULAR%20COLOR%20ORANGE%20PRO%20CLEAN%20LOGO%20ORIGINAL.png';

const OPC_ICON =
  'https://cdn.prod.website-files.com/6944470386300e196e5fc347/694ff7f9812baa5c05309365_Orange%20Pro%20Clean%20GmbH%20WEBICON.png';

export default function DashboardSidebar({ role, currentPath, onLogout }: DashboardSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      if (!mobile) {
        setMobileOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const navigation: Record<OpcPortalRole, Array<{ name: string; path: string; icon: string }>> = {
    owner: [
      { name: 'Übersicht', path: `${baseUrl}/dashboard/owner`, icon: 'grid' },
      { name: 'Kunden', path: `${baseUrl}/dashboard/owner/clients`, icon: 'users' },
      { name: 'Einsätze', path: `${baseUrl}/dashboard/projects`, icon: 'folder' },
      { name: 'Berichte & Dateien', path: `${baseUrl}/dashboard/files`, icon: 'file' },
      { name: 'Anfragen / Schäden', path: `${baseUrl}/dashboard/tickets`, icon: 'message' },
      { name: 'Einstellungen', path: `${baseUrl}/dashboard/settings`, icon: 'settings' },
    ],
    admin: [
      { name: 'Übersicht', path: `${baseUrl}/dashboard/admin`, icon: 'grid' },
      { name: 'Kunden', path: `${baseUrl}/dashboard/admin/clients`, icon: 'users' },
      { name: 'Einsätze', path: `${baseUrl}/dashboard/projects`, icon: 'folder' },
      { name: 'Berichte & Dateien', path: `${baseUrl}/dashboard/files`, icon: 'file' },
      { name: 'Anfragen / Schäden', path: `${baseUrl}/dashboard/tickets`, icon: 'message' },
      { name: 'Einstellungen', path: `${baseUrl}/dashboard/settings`, icon: 'settings' },
    ],
    dispatch: [
      { name: 'Übersicht', path: `${baseUrl}/dashboard/admin`, icon: 'grid' },
      { name: 'Kunden', path: `${baseUrl}/dashboard/admin/clients`, icon: 'users' },
      { name: 'Einsätze', path: `${baseUrl}/dashboard/projects`, icon: 'folder' },
      { name: 'Berichte & Dateien', path: `${baseUrl}/dashboard/files`, icon: 'file' },
      { name: 'Anfragen / Schäden', path: `${baseUrl}/dashboard/tickets`, icon: 'message' },
      { name: 'Einstellungen', path: `${baseUrl}/dashboard/settings`, icon: 'settings' },
    ],
    employee: [
      { name: 'Meine Einsätze', path: `${baseUrl}/dashboard/client/projects`, icon: 'folder' },
      { name: 'Berichte & Dateien', path: `${baseUrl}/dashboard/client/files`, icon: 'file' },
      { name: 'Nachrichten', path: `${baseUrl}/dashboard/client/tickets`, icon: 'message' },
      { name: 'Einstellungen', path: `${baseUrl}/dashboard/client/settings`, icon: 'settings' },
    ],
    client: [
      { name: 'Übersicht', path: `${baseUrl}/dashboard/client`, icon: 'grid' },
      { name: 'Einsätze', path: `${baseUrl}/dashboard/client/projects`, icon: 'folder' },
      { name: 'Berichte & Dateien', path: `${baseUrl}/dashboard/client/files`, icon: 'file' },
      { name: 'Anfragen / Schäden', path: `${baseUrl}/dashboard/client/tickets`, icon: 'message' },
      { name: 'Einstellungen', path: `${baseUrl}/dashboard/client/settings`, icon: 'settings' },
    ],
  };

  const navItems = navigation[role] || navigation.client;

  const getIcon = (icon: string) => {
    const icons: Record<string, JSX.Element> = {
      grid: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      ),
      users: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      ),
      folder: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
      ),
      file: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <polyline points="13 2 13 9 20 9"></polyline>
        </svg>
      ),
      message: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      ),
      settings: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 1v6m0 6v6m0-18a2 2 0 0 0-2-2m2 2a2 2 0 0 1 2-2m-2 22a2 2 0 0 0 2 2m-2-2a2 2 0 0 1-2 2m13-11h-6m-6 0H1m22 0a2 2 0 0 0 2-2m-2 2a2 2 0 0 1 2 2M1 12a2 2 0 0 1-2-2m2 2a2 2 0 0 0-2 2"></path>
        </svg>
      ),
    };

    return icons[icon] || icons.grid;
  };

  return (
    <>
      {isMobile && (
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{
            position: 'fixed',
            top: '16px',
            left: '16px',
            zIndex: 200,
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            padding: '10px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      )}

      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 150,
            animation: 'fadeIn 0.2s ease',
          }}
        />
      )}

      <aside
        style={{
          width: isMobile ? '280px' : collapsed ? '80px' : '260px',
          height: '100vh',
          backgroundColor: '#FFFFFF',
          borderRight: '1px solid #E5E7EB',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          left: isMobile ? (mobileOpen ? '0' : '-280px') : '0',
          top: 0,
          transition: isMobile ? 'left 0.3s ease' : 'width 0.3s ease',
          zIndex: 160,
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            padding: isMobile ? '24px 20px' : '24px 20px',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed && !isMobile ? 'center' : 'space-between',
            minHeight: '82px',
          }}
        >
          {collapsed && !isMobile ? (
            <img
              src={OPC_ICON}
              alt="Orange Pro Clean"
              style={{
                width: '38px',
                height: '38px',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : (
            <img
              src={OPC_LOGO}
              alt="Orange Pro Clean GmbH"
              style={{
                width: '100%',
                maxWidth: '170px',
                height: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          )}

          {!isMobile && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              style={{
                background: 'none',
                border: 'none',
                padding: '8px',
                cursor: 'pointer',
                color: '#6B7280',
                borderRadius: '6px',
                transition: 'all 0.2s ease',
                marginLeft: collapsed ? 0 : '8px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F3F4F6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          )}

          {isMobile && (
            <button
              onClick={() => setMobileOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                padding: '8px',
                cursor: 'pointer',
                color: '#6B7280',
                borderRadius: '6px',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>

        <nav style={{ flex: 1, padding: '20px 12px', overflowY: 'auto' }}>
          {navItems.map((item) => {
            const isActive = currentPath === item.path || currentPath.startsWith(item.path + '/');

            return (
              <a
                key={item.path}
                href={item.path}
                onClick={() => isMobile && setMobileOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: collapsed && !isMobile ? '0' : '12px',
                  justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                  padding: collapsed && !isMobile ? '12px 0' : isMobile ? '14px 16px' : '12px 16px',
                  marginBottom: '4px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  color: isActive ? '#FF6600' : '#6B7280',
                  backgroundColor: isActive ? '#FFF3EA' : 'transparent',
                  fontFamily: "'Inter', 'Helvetica', sans-serif",
                  fontSize: isMobile ? '15px' : '14px',
                  fontWeight: isActive ? 600 : 500,
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = '#F9FAFB';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
                title={collapsed && !isMobile ? item.name : undefined}
              >
                {getIcon(item.icon)}
                {(!collapsed || isMobile) && <span>{item.name}</span>}
              </a>
            );
          })}
        </nav>

        <div style={{ padding: '20px 12px', borderTop: '1px solid #E5E7EB' }}>
          <button
            onClick={() => {
              if (isMobile) setMobileOpen(false);
              onLogout();
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: collapsed && !isMobile ? '0' : '12px',
              justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
              padding: collapsed && !isMobile ? '12px 0' : isMobile ? '14px 16px' : '12px 16px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#DC2626',
              fontFamily: "'Inter', 'Helvetica', sans-serif",
              fontSize: isMobile ? '15px' : '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#FEF2F2';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title={collapsed && !isMobile ? 'Abmelden' : undefined}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            {(!collapsed || isMobile) && <span>Abmelden</span>}
          </button>
        </div>
      </aside>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}