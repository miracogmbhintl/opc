import React from 'react';

interface MobileActionButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  ariaLabel?: string;
}

export default function MobileActionButton({ icon, onClick, ariaLabel }: MobileActionButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        width: '100%',
        height: '72px',
        borderRadius: '22px',
        border: '1px solid #1A1A1A',
        background: '#1A1A1A',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 600,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
        WebkitTapHighlightColor: 'rgba(255, 255, 255, 0.1)'
      }}
    >
      {icon}
    </button>
  );
}
