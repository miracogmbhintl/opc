/**
 * Session Guard Component
 * Wraps dashboard pages to enforce session security
 * - Auto logout after 15 minutes inactivity
 * - Prevents back button bypass after logout
 * - Shows session timeout warnings
 */

import { useEffect, useState } from 'react';
import { 
  startSessionMonitoring, 
  stopMonitoring, 
  checkSessionBeforeRender,
  getRemainingSessionTime 
} from '../lib/session-security';
import MirakaLoadingScreen from './MirakaLoadingScreen';

interface SessionGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
  showTimeoutWarning?: boolean;
}

export default function SessionGuard({ 
  children, 
  redirectTo = '/miraka-co-portal',
  showTimeoutWarning = true 
}: SessionGuardProps) {
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  useEffect(() => {
    let mounted = true;
    let warningTimer: NodeJS.Timeout | null = null;
    let timeUpdateInterval: NodeJS.Timeout | null = null;

    async function validateAndMonitor() {
      // Check if session is valid
      const valid = await checkSessionBeforeRender();

      if (!mounted) return;

      if (!valid) {
        console.log('🚫 Invalid session, redirecting...');
        window.location.replace(redirectTo);
        return;
      }

      setIsValid(true);
      setIsValidating(false);

      // Start session monitoring (15 min inactivity logout)
      startSessionMonitoring();

      // Show warning 2 minutes before timeout
      if (showTimeoutWarning) {
        timeUpdateInterval = setInterval(() => {
          const remaining = getRemainingSessionTime();
          setRemainingTime(remaining);

          // Show warning when 2 minutes remaining
          if (remaining <= 120 && remaining > 0) {
            setShowWarning(true);
          } else {
            setShowWarning(false);
          }
        }, 1000); // Update every second
      }
    }

    validateAndMonitor();

    return () => {
      mounted = false;
      stopMonitoring();
      if (warningTimer) clearTimeout(warningTimer);
      if (timeUpdateInterval) clearInterval(timeUpdateInterval);
    };
  }, [redirectTo, showTimeoutWarning]);

  // Format remaining time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isValidating) {
    return <MirakaLoadingScreen />;
  }

  if (!isValid) {
    return null; // Will redirect
  }

  return (
    <>
      {children}
      
      {/* Session Timeout Warning */}
      {showWarning && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: '#FEF3C7',
            border: '2px solid #F59E0B',
            borderRadius: '12px',
            padding: '16px 20px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 10000,
            maxWidth: '320px',
            animation: 'slideInRight 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
            <div style={{ fontSize: '24px' }}>⚠️</div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 600,
                fontSize: '14px',
                color: '#92400E',
                marginBottom: '4px',
              }}>
                Session Expiring Soon
              </div>
              <div style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '13px',
                color: '#78350F',
                marginBottom: '8px',
              }}>
                Your session will expire in {formatTime(remainingTime)} due to inactivity
              </div>
              <button
                onClick={() => {
                  // Import and call extendSession
                  import('../lib/session-security').then(({ extendSession }) => {
                    extendSession();
                    setShowWarning(false);
                  });
                }}
                style={{
                  background: '#F59E0B',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Poppins, sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Stay Logged In
              </button>
            </div>
            <button
              onClick={() => setShowWarning(false)}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '0',
                lineHeight: 1,
                color: '#92400E',
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
