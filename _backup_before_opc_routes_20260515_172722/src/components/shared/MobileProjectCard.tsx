import React from 'react';

interface MobileProjectCardProps {
  title: string;
  subtitle?: string;
  status: {
    label: string;
    color: 'green' | 'blue' | 'yellow' | 'red' | 'gray';
  };
  stats: Array<{
    label: string;
    value: string;
  }>;
  ctaText: string;
  onCtaClick: () => void;
  onClick?: () => void;
}

const STATUS_COLORS = {
  green: '#22C55E',
  blue: '#3B82F6',
  yellow: '#F59E0B',
  red: '#EF4444',
  gray: '#9CA3AF'
};

export default function MobileProjectCard({
  title,
  subtitle,
  status,
  stats,
  ctaText,
  onCtaClick,
  onClick
}: MobileProjectCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#FFFFFF',
        borderRadius: '22px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
        border: '1px solid #E6E6E6',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}
    >
      {/* Header Section */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 600,
            color: '#1A1A1A',
            fontFamily: 'Poppins, sans-serif',
            flex: 1
          }}>
            {title}
          </h2>
          
          {/* Status Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#1A1A1A',
            flexShrink: 0
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: STATUS_COLORS[status.color]
            }} />
            <span>{status.label}</span>
          </div>
        </div>
        
        {subtitle && (
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#6B7280',
            fontFamily: 'Inter, sans-serif'
          }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Stats Section - 2 columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px',
        paddingTop: '16px'
      }}>
        {stats.map((stat, index) => (
          <div key={index} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <h4 style={{
              fontSize: '13px',
              fontWeight: 500,
              color: '#F37021',
              opacity: 0.7,
              margin: 0,
              fontFamily: 'Inter Tight, sans-serif'
            }}>
              {stat.label}
            </h4>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#1A1A1A',
              margin: 0,
              fontFamily: 'Poppins, sans-serif',
              wordBreak: 'break-word'
            }}>
              {stat.value}
            </h3>
          </div>
        ))}
      </div>

      {/* CTA Button - full width black */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCtaClick();
        }}
        style={{
          width: '100%',
          height: '50px',
          padding: '10px',
          fontSize: '15px',
          fontWeight: 800,
          background: '#1A1A1A',
          color: '#F2F2F2',
          border: 'none',
          borderRadius: '12px',
          cursor: 'pointer',
          fontFamily: 'Poppins, sans-serif',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          WebkitTapHighlightColor: 'rgba(0, 0, 0, 0.1)'
        }}
      >
        {ctaText}
      </button>
    </div>
  );
}
