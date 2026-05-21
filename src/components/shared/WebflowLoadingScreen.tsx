interface WebflowLoadingScreenProps {
  /** Text to display below the animation */
  message?: string;
  /** Whether to show as full screen overlay */
  fullScreen?: boolean;
  /** Custom z-index for layering */
  zIndex?: number;
  /** Main brand text shown at the bottom */
  brandName?: string;
}

/**
 * Instagram-inspired loading screen
 * Used for route/session loading states across the portal.
 */
export default function WebflowLoadingScreen({
  message,
  fullScreen = true,
  zIndex = 99999,
  brandName = 'ORANGE PRO CLEAN'
}: WebflowLoadingScreenProps) {
  const size = fullScreen ? 88 : 64;

  return (
    <div
      style={{
        position: fullScreen ? 'fixed' : 'relative',
        inset: fullScreen ? 0 : undefined,
        width: '100%',
        height: fullScreen ? '100%' : '300px',
        minHeight: fullScreen ? '100vh' : '300px',
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(circle at 50% 42%, #FFFFFF 0%, #FFFFFF 34%, #F8F8F8 100%)',
        overflow: 'hidden',
        fontFamily:
          "'Inter Tight', 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif"
      }}
      aria-live="polite"
      aria-busy="true"
    >
      <style>
        {`
          @keyframes opcLoaderFloat {
            0% { transform: translateY(0) scale(1); opacity: 1; }
            50% { transform: translateY(-4px) scale(1.025); opacity: 0.92; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
          }

          @keyframes opcLoaderRing {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          @keyframes opcLoaderFade {
            0% { opacity: 0.35; transform: translateY(3px); }
            50% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0.35; transform: translateY(3px); }
          }

          @keyframes opcLoaderBar {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(0%); }
            100% { transform: translateX(100%); }
          }
        `}
      </style>

      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: fullScreen ? '22px' : '16px'
        }}
      >
        <div
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '28px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background:
              'linear-gradient(135deg, #FF7A1A 0%, #F05A1A 38%, #111111 100%)',
            boxShadow:
              '0 18px 45px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255,255,255,0.45)',
            animation: 'opcLoaderFloat 1.65s ease-in-out infinite'
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: '10px',
              borderRadius: '22px',
              border: '3px solid rgba(255,255,255,0.9)'
            }}
          />

          <div
            style={{
              width: `${Math.round(size * 0.34)}px`,
              height: `${Math.round(size * 0.34)}px`,
              borderRadius: '999px',
              border: '3px solid rgba(255,255,255,0.95)',
              background: 'rgba(255,255,255,0.08)'
            }}
          />

          <div
            style={{
              position: 'absolute',
              top: `${Math.round(size * 0.23)}px`,
              right: `${Math.round(size * 0.23)}px`,
              width: `${Math.round(size * 0.11)}px`,
              height: `${Math.round(size * 0.11)}px`,
              borderRadius: '999px',
              background: '#FFFFFF'
            }}
          />

          <div
            style={{
              position: 'absolute',
              inset: '-7px',
              borderRadius: '34px',
              border: '1px solid rgba(240, 90, 26, 0.28)',
              borderTopColor: 'rgba(240, 90, 26, 0.9)',
              animation: 'opcLoaderRing 1.25s linear infinite'
            }}
          />
        </div>

        {message && (
          <div
            style={{
              fontSize: fullScreen ? '13px' : '12px',
              lineHeight: 1.5,
              color: '#6B7280',
              letterSpacing: '0.01em',
              textAlign: 'center',
              maxWidth: fullScreen ? '320px' : '220px'
            }}
          >
            {message}
          </div>
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: fullScreen ? '42px' : '20px',
          transform: 'translateX(-50%)',
          width: 'min(280px, 72vw)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}
      >
        <div
          style={{
            width: '100%',
            height: '2px',
            borderRadius: '999px',
            background: '#E7E7E7',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: '55%',
              height: '100%',
              borderRadius: '999px',
              background:
                'linear-gradient(90deg, rgba(240,90,26,0), rgba(240,90,26,0.95), rgba(240,90,26,0))',
              animation: 'opcLoaderBar 1.35s ease-in-out infinite'
            }}
          />
        </div>

        <div
          style={{
            animation: 'opcLoaderFade 1.8s ease-in-out infinite',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              fontSize: '10px',
              lineHeight: 1,
              color: '#A3A3A3',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '6px'
            }}
          >
            from
          </div>

          <div
            style={{
              fontSize: '12px',
              lineHeight: 1,
              color: '#111111',
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap'
            }}
          >
            {brandName}
          </div>
        </div>
      </div>
    </div>
  );
}