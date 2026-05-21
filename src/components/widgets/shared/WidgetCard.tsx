import React from 'react';

interface WidgetCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export default function WidgetCard({ 
  title, 
  icon, 
  children, 
  className = '',
  action,
  onClick,
  style = {}
}: WidgetCardProps) {
  return (
    <div 
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '14px',
        padding: '20px',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
        transition: 'all 0.2s ease',
        height: '100%',
        ...style
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: '16px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon && (
            <div style={{ color: '#1A1A1A', display: 'flex', alignItems: 'center' }}>
              {icon}
            </div>
          )}
          <h3 style={{
            fontSize: '13px',
            fontWeight: 500,
            color: '#6B7280',
            margin: 0,
            letterSpacing: '0.3px'
          }}>
            {title}
          </h3>
        </div>
        {action && <div>{action}</div>}
      </div>
      <div>
        {children}
      </div>
    </div>
  );
}
