interface ComingSoonProps {
  feature: string;
}

export default function ComingSoon({ feature }: ComingSoonProps) {
  return (
    <div className="miraka-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
      <div style={{ 
        width: '80px', 
        height: '80px', 
        margin: '0 auto 24px',
        background: '#E9F3F8',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2A5F8A" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      </div>
      
      <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '12px', color: '#111827' }}>
        {feature} Coming Soon
      </h2>
      
      <p style={{ color: '#6B7280', fontSize: '15px', lineHeight: 1.6, maxWidth: '500px', margin: '0 auto' }}>
        We're working hard to bring you this feature. Check back soon for updates!
      </p>
    </div>
  );
}
