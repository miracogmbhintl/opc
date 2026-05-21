import { useState, useRef, useEffect } from 'react';
import { baseUrl } from '../lib/base-url';

interface TopBarProps {
  pageTitle?: string;
  userName?: string;
  userRole?: string;
}

export default function TopBar({ pageTitle = 'Dashboard', userName = 'User', userRole = 'client' }: TopBarProps) {
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const languageButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    <header style={{
      position: 'sticky',
      top: 0,
      height: '72px',
      backgroundColor: '#1A1A1A',
      borderBottom: '1px solid #E5E7EB',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      zIndex: 100,
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
    }}>
      {/* Left Section - Page Title */}
      <div>
        <h1 style={{
          fontSize: '20px',
          fontWeight: 700,
          color: '#1A1A1A',
          margin: 0,
          fontFamily: "'Poppins', sans-serif",
        }}>
          {pageTitle}
        </h1>
      </div>

      {/* Right Section - Actions & User */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
      }}>
        {/* Chat Icon */}
        <a
          href={`${baseUrl}/chat`}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            transition: 'background-color 0.2s ease',
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F7F7F7';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </a>

        {/* Help/Guides Icon */}
        <a
          href={`${baseUrl}/how-to-guides`}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            transition: 'background-color 0.2s ease',
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F7F7F7';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </a>

        {/* Language Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            ref={languageButtonRef}
            onClick={() => setLanguageDropdownOpen(!languageDropdownOpen)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F7F7F7';
            }}
            onMouseLeave={(e) => {
              if (!languageDropdownOpen) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </button>

          {/* Language Dropdown Menu */}
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
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                minWidth: '140px',
                overflow: 'hidden',
                zIndex: 1100,
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
                    fontWeight: selectedLanguage === lang ? 600 : 500,
                    color: '#1A1A1A',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                    fontFamily: "'Inter', sans-serif",
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

        {/* Notifications Icon */}
        <button
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            transition: 'background-color 0.2s ease',
            position: 'relative',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F7F7F7';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {/* Notification Badge */}
          <span style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            width: '8px',
            height: '8px',
            backgroundColor: '#DC2626',
            borderRadius: '50%',
            border: '2px solid #FFFFFF',
          }} />
        </button>

        {/* Divider */}
        <div style={{
          width: '1px',
          height: '32px',
          backgroundColor: '#E5E7EB',
        }} />

        {/* User Info */}
        <a
          href={`${baseUrl}/kunde/profile`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 12px',
            borderRadius: '10px',
            transition: 'background-color 0.2s ease',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F7F7F7';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {/* User Avatar */}
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: '#D6C39A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 600,
            color: '#0D0D0D',
          }}>
            {userName.charAt(0).toUpperCase()}
          </div>

          {/* User Details (Hidden on mobile) */}
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}>
            <span style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#1A1A1A',
              fontFamily: "'Inter', sans-serif",
              lineHeight: 1.2,
            }}>
              {userName}
            </span>
            <span style={{
              fontSize: '12px',
              fontWeight: 400,
              color: '#6B6B6B',
              fontFamily: "'Inter', sans-serif",
              textTransform: 'capitalize',
              lineHeight: 1,
            }}>
              {userRole}
            </span>
          </div>
        </a>
      </div>

      <style>{`
        @media (max-width: 768px) {
          header {
            padding: 0 16px !important;
            height: 64px !important;
          }

          header > div:first-child h1 {
            font-size: 18px !important;
          }

          header > div:last-child {
            gap: 12px !important;
          }

          header > div:last-child > a:last-child > div:last-child {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
}

