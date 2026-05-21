import { useEffect, useState } from 'react';
import { DevLinkProvider } from '../site-components/DevLinkProvider';
import { LoadInScreen } from '../site-components/LoadInScreen';
import '../site-components/global.css';

interface MirakaLoadingScreenProps {
  onComplete?: () => void;
  duration?: number; // Duration in milliseconds
}

export default function MirakaLoadingScreen({ onComplete, duration = 3500 }: MirakaLoadingScreenProps) {
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Set timeout to match the animation duration
    const timer = setTimeout(() => {
      setIsComplete(true);
      if (onComplete) {
        onComplete();
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  if (isComplete) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 99999
    }}>
      <DevLinkProvider>
        <LoadInScreen />
      </DevLinkProvider>
    </div>
  );
}
