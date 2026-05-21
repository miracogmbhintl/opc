/**
 * Minimal inline spinner for actual loading operations
 * Use ONLY when there's a real delay (API calls, file uploads, etc.)
 */
export default function MinimalSpinner({ 
  size = 20, 
  color = '#6B6B6B' 
}: { 
  size?: number; 
  color?: string; 
}) {
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        border: `2px solid #E5E5E5`,
        borderTop: `2px solid ${color}`,
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite'
      }}
    />
  );
}
