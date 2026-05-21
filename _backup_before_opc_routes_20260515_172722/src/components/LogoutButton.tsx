import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { logout } from '../lib/auth-client';

interface LogoutButtonProps {
  baseUrl: string;
  variant?: 'icon' | 'text' | 'full';
  className?: string;
}

export default function LogoutButton({ baseUrl, variant = 'icon', className = '' }: LogoutButtonProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    
    const confirmed = window.confirm('Are you sure you want to log out?');
    if (!confirmed) return;

    setIsLoggingOut(true);
    
    try {
      await logout(baseUrl || '/');
    } catch (err) {
      console.error('Logout error:', err);
      setIsLoggingOut(false);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className={`logout-btn-icon ${className}`}
        title="Log out"
        style={{
          background: 'transparent',
          border: 'none',
          padding: '6px',
          cursor: isLoggingOut ? 'not-allowed' : 'pointer',
          transition: 'opacity 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isLoggingOut ? 0.5 : 1,
        }}
      >
        <LogOut size={18} style={{ color: '#1A1A1A', strokeWidth: 1.5 }} />
      </button>
    );
  }

  if (variant === 'text') {
    return (
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className={`logout-btn-text ${className}`}
        style={{
          background: 'transparent',
          border: 'none',
          padding: '8px 16px',
          cursor: isLoggingOut ? 'not-allowed' : 'pointer',
          fontFamily: 'Inter, Helvetica, Arial, sans-serif',
          fontSize: '14px',
          color: '#1A1A1A',
          transition: 'all 0.2s ease',
          opacity: isLoggingOut ? 0.5 : 1,
        }}
      >
        {isLoggingOut ? 'Logging out...' : 'Log out'}
      </button>
    );
  }

  // Full button
  return (
    <button
      onClick={handleLogout}
      disabled={isLoggingOut}
      className={`logout-btn-full ${className}`}
      style={{
        background: '#DC2626',
        border: 'none',
        borderRadius: '6px',
        padding: '10px 20px',
        cursor: isLoggingOut ? 'not-allowed' : 'pointer',
        fontFamily: 'Poppins, sans-serif',
        fontSize: '14px',
        fontWeight: 600,
        color: '#FFFFFF',
        transition: 'all 0.2s ease',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        opacity: isLoggingOut ? 0.6 : 1,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
      onMouseEnter={(e) => {
        if (!isLoggingOut) {
          e.currentTarget.style.background = '#B91C1C';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#DC2626';
      }}
    >
      <LogOut size={16} style={{ strokeWidth: 2 }} />
      {isLoggingOut ? 'Logging out...' : 'Log out'}
    </button>
  );
}
