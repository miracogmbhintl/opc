import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowLeft } from 'lucide-react';

type MobileBackBubbleProps = {
  label?: string;
  fallbackHref?: string;
};

export default function MobileBackBubble({
  label = 'Zurück',
  fallbackHref = '/dashboard',
}: MobileBackBubbleProps) {
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCanGoBack(window.history.length > 1);
  }, []);

  function handleBack() {
    if (typeof window === 'undefined') return;

    if (canGoBack) {
      window.history.back();
      return;
    }

    window.location.href = fallbackHref;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleBack}
        aria-label={label}
        style={buttonStyle}
      >
        <ArrowLeft size={18} />
        <span style={labelStyle}>{label}</span>
      </button>

      <style>{`
        @media (min-width: 861px) {
          .opc-mobile-back-bubble {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}

const buttonStyle: CSSProperties = {
  position: 'fixed',
  left: 16,
  top: 16,
  zIndex: 9999,
  height: 42,
  minWidth: 42,
  padding: '0 13px',
  borderRadius: 999,
  border: '1px solid rgba(17, 24, 39, 0.10)',
  background: 'rgba(255, 255, 255, 0.96)',
  color: '#111827',
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontSize: 13,
  fontWeight: 760,
  cursor: 'pointer',
  WebkitBackdropFilter: 'blur(14px)',
  backdropFilter: 'blur(14px)',
};

const labelStyle: CSSProperties = {
  lineHeight: 1,
};
