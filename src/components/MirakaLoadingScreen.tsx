import { useEffect, useState } from 'react';
import WebflowLoadingScreen from './shared/WebflowLoadingScreen';

interface MirakaLoadingScreenProps {
  onComplete?: () => void;
  duration?: number;
}

export default function MirakaLoadingScreen({
  onComplete,
  duration = 2500
}: MirakaLoadingScreenProps) {
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsComplete(true);
      onComplete?.();
    }, duration);

    return () => window.clearTimeout(timer);
  }, [duration, onComplete]);

  if (isComplete) {
    return null;
  }

  return <WebflowLoadingScreen />;
}