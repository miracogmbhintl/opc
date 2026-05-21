import { useState } from 'react';

export default function TestComponent() {
  const [count, setCount] = useState(0);

  return (
    <div style={{
      padding: '40px',
      textAlign: 'center',
      fontFamily: 'Inter, sans-serif'
    }}>
      <h1 style={{ fontSize: '32px', marginBottom: '20px' }}>
        React Test Component
      </h1>
      <p style={{ fontSize: '18px', marginBottom: '20px', color: '#666' }}>
        If you can see this, React is working!
      </p>
      <p style={{ fontSize: '24px', marginBottom: '20px' }}>
        Count: {count}
      </p>
      <button
        onClick={() => setCount(count + 1)}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          background: '#1A1A1A',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer'
        }}
      >
        Increment
      </button>
    </div>
  );
}
