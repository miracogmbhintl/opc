
/**
 * Webflow Loading Screen Component
 * Unified loading screen using the Webflow LoadInScreen component
 * Can be used anywhere in the app for consistent branding
 */

import { DevLinkProvider } from '../../site-components/DevLinkProvider';
import { LoadInScreen } from '../../site-components/LoadInScreen';
import '../../site-components/global.css';

interface WebflowLoadingScreenProps {
  /** Text to display below the animation (optional) */
  message?: string;
  /** Whether to show as full screen overlay */
  fullScreen?: boolean;
  /** Custom z-index for layering */
  zIndex?: number;
}

export default function WebflowLoadingScreen({
  message,
  fullScreen = true,
  zIndex = 99999
}: WebflowLoadingScreenProps) {
  return (
    <div
      style={{
        position: fullScreen ? 'fixed' : 'relative',
        top: fullScreen ? 0 : undefined,
        left: fullScreen ? 0 : undefined,
        right: fullScreen ? 0 : undefined,
        bottom: fullScreen ? 0 : undefined,
        width: fullScreen ? '100%' : '100%',
        height: fullScreen ? '100%' : '300px',
        minHeight: fullScreen ? '100vh' : '300px',
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F2F2F2',
        overflow: 'hidden',
      }}
    >
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: fullScreen ? 'none' : 'scale(0.35)',
        transformOrigin: 'center',
      }}>
        <DevLinkProvider>
          <LoadInScreen />
        </DevLinkProvider>
      </div>
      
      {message && (
        <div
          style={{
            position: 'absolute',
            bottom: fullScreen ? '80px' : '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '14px',
            color: '#666666',
            fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
            textAlign: 'center',
            maxWidth: '80%',
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}


