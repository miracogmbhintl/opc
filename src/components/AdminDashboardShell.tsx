import { useState, useRef, useEffect } from 'react';

export default function AdminDashboardShell() {
  const [activeTab, setActiveTab] = useState('Alle');
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('Deutsch');
  const languageButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const tabs = ['Alle', 'Aktiv', 'Inaktiv', 'Gesperrt', 'Test'];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        languageButtonRef.current &&
        !languageButtonRef.current.contains(event.target as Node)
      ) {
        setLanguageDropdownOpen(false);
      }
    }

    if (languageDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [languageDropdownOpen]);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F5F6F8',
      fontFamily: '"Inter", "Helvetica Neue", sans-serif',
      color: '#1A1A1A'
    }}>
      {/* Top Navigation Bar */}
      <nav style={{
        position: 'sticky',
        top: 0,
        height: '64px',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        zIndex: 1000
      }}>
        {/* Left Section - Logo/Title */}
        <div style={{
          fontSize: '14px',
          fontWeight: 700,
          letterSpacing: '-0.01em',
          color: '#1A1A1A'
        }}>
          M&CO STAFF PORTAL
        </div>

        {/* Right Section - Icons */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px'
        }}>
          {/* Chat Icon */}
          <button style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>

          {/* Question Mark Icon */}
          <button style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>

          {/* Globe Icon - Language Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              ref={languageButtonRef}
              onClick={() => setLanguageDropdownOpen(!languageDropdownOpen)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </button>

            {/* Language Dropdown */}
            {languageDropdownOpen && (
              <div
                ref={dropdownRef}
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                  minWidth: '140px',
                  overflow: 'hidden',
                  zIndex: 1100
                }}
              >
                {['English', 'Deutsch'].map((lang) => (
                  <button
                    key={lang}
                    onClick={() => {
                      setSelectedLanguage(lang);
                      setLanguageDropdownOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: 'none',
                      backgroundColor: selectedLanguage === lang ? '#F7F7F7' : '#FFFFFF',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1A1A1A',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#F7F7F7';
                    }}
                    onMouseLeave={(e) => {
                      if (selectedLanguage !== lang) {
                        e.currentTarget.style.backgroundColor = '#FFFFFF';
                      }
                    }}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bell Icon */}
          <button style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>

          {/* User Badge */}
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px',
            fontWeight: 500,
            color: '#1A1A1A',
            cursor: 'pointer'
          }}>
            AD
          </div>
        </div>
      </nav>

      {/* Page Content Area */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '32px 32px 64px 32px'
      }}>
        {/* Title Area */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 700,
            color: '#1A1A1A',
            margin: 0,
            lineHeight: 1.2
          }}>
            Kundenübersicht
          </h1>
        </div>

        {/* Controls Row */}
        <div style={{ marginBottom: '32px' }}>
          {/* Search Bar */}
          <div style={{
            position: 'relative',
            marginBottom: '24px'
          }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9CA3AF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none'
              }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Suche Kunden, Projekte, Kontakte…"
              style={{
                width: '100%',
                padding: '14px 16px 14px 48px',
                fontSize: '15px',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                color: '#1A1A1A',
                outline: 'none',
                fontFamily: 'inherit',
                transition: 'border-color 0.2s ease'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#9CA3AF';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#E5E7EB';
              }}
            />
          </div>

          {/* Filter Tabs */}
          <div style={{
            display: 'flex',
            gap: '32px',
            borderBottom: '1px solid #E5E7EB',
            paddingBottom: '0'
          }}>
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '12px 0',
                  fontSize: '15px',
                  fontWeight: activeTab === tab ? 600 : 500,
                  color: activeTab === tab ? '#1A1A1A' : '#6B6B6B',
                  cursor: 'pointer',
                  position: 'relative',
                  borderBottom: activeTab === tab ? '2px solid #1A1A1A' : '2px solid transparent',
                  marginBottom: '-1px',
                  transition: 'color 0.2s ease',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab) {
                    e.currentTarget.style.color = '#1A1A1A';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab) {
                    e.currentTarget.style.color = '#6B6B6B';
                  }
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Primary Action Button */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '48px'
        }}>
          <button style={{
            backgroundColor: '#1A1A1A',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: '14px',
            padding: '14px 22px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            letterSpacing: '0.02em',
            transition: 'background-color 0.2s ease',
            fontFamily: 'inherit'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#2D2D2D';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#1A1A1A';
          }}>
            NEUEN KUNDEN ANLEGEN
          </button>
        </div>

        {/* Empty State */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '64px 32px',
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
        }}>
          {/* Icon */}
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#E5E7EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>

          {/* Headline */}
          <h3 style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#1A1A1A',
            margin: '0 0 8px 0'
          }}>
            Keine Kunden gefunden
          </h3>

          {/* Subline */}
          <p style={{
            fontSize: '14px',
            color: '#9CA3AF',
            margin: 0,
            fontWeight: 400
          }}>
            Versuchen Sie, Ihre Suche oder Filter anzupassen
          </p>
        </div>
      </div>
    </div>
  );
}
