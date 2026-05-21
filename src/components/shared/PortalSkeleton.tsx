type PortalSkeletonProps = {
  variant?: 'dashboard' | 'detail' | 'table' | 'cards';
  title?: string;
};

function SkeletonBlock({
  width = '100%',
  height = 16,
  radius = 10
}: {
  width?: string | number;
  height?: string | number;
  radius?: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background:
          'linear-gradient(90deg, #F1F1F1 0%, #E7E7E7 45%, #F4F4F4 100%)',
        backgroundSize: '220% 100%',
        animation: 'opcSkeletonPulse 1.25s ease-in-out infinite'
      }}
    />
  );
}

function MetricSkeleton() {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E8E8',
        borderRadius: 20,
        padding: 22,
        minHeight: 130
      }}
    >
      <SkeletonBlock width="42%" height={12} />
      <div style={{ height: 22 }} />
      <SkeletonBlock width="58%" height={30} radius={12} />
      <div style={{ height: 18 }} />
      <SkeletonBlock width="76%" height={10} radius={8} />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E8E8',
        borderRadius: 22,
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          padding: '20px 22px',
          borderBottom: '1px solid #EFEFEF',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16
        }}
      >
        <SkeletonBlock width="28%" height={18} />
        <SkeletonBlock width={120} height={32} radius={999} />
      </div>

      {[1, 2, 3, 4, 5].map((row) => (
        <div
          key={row}
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr 0.8fr 0.7fr',
            gap: 18,
            padding: '18px 22px',
            borderBottom: row === 5 ? 'none' : '1px solid #F1F1F1'
          }}
        >
          <SkeletonBlock height={14} />
          <SkeletonBlock height={14} />
          <SkeletonBlock height={14} />
          <SkeletonBlock height={14} />
        </div>
      ))}
    </div>
  );
}

export default function PortalSkeleton({
  variant = 'dashboard',
  title
}: PortalSkeletonProps) {
  const isDashboard = variant === 'dashboard';
  const isDetail = variant === 'detail';
  const isTable = variant === 'table';
  const isCards = variant === 'cards';

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100%',
        padding: '32px',
        background: '#FAFAFA',
        fontFamily:
          "'Inter Tight', 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif"
      }}
      aria-live="polite"
      aria-busy="true"
    >
      <style>
        {`
          @keyframes opcSkeletonPulse {
            0% { background-position: 220% 0; }
            100% { background-position: -220% 0; }
          }
        `}
      </style>

      <div
        style={{
          maxWidth: 1440,
          margin: '0 auto'
        }}
      >
        <div style={{ marginBottom: 28 }}>
          <SkeletonBlock width={title ? '18%' : '26%'} height={34} radius={14} />
          <div style={{ height: 14 }} />
          <SkeletonBlock width="38%" height={13} radius={8} />
        </div>

        {(isDashboard || isCards) && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 18,
              marginBottom: 22
            }}
          >
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </div>
        )}

        {isDetail && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.3fr 0.7fr',
              gap: 22,
              marginBottom: 22
            }}
          >
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E8E8E8',
                borderRadius: 22,
                padding: 26,
                minHeight: 360
              }}
            >
              <SkeletonBlock width="34%" height={24} radius={12} />
              <div style={{ height: 24 }} />
              <SkeletonBlock width="100%" height={14} />
              <div style={{ height: 14 }} />
              <SkeletonBlock width="92%" height={14} />
              <div style={{ height: 14 }} />
              <SkeletonBlock width="84%" height={14} />
              <div style={{ height: 34 }} />
              <SkeletonBlock width="48%" height={16} />
              <div style={{ height: 18 }} />
              <SkeletonBlock width="100%" height={84} radius={18} />
            </div>

            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E8E8E8',
                borderRadius: 22,
                padding: 24,
                minHeight: 360
              }}
            >
              <SkeletonBlock width="44%" height={20} radius={12} />
              <div style={{ height: 24 }} />
              <SkeletonBlock width="100%" height={44} radius={14} />
              <div style={{ height: 12 }} />
              <SkeletonBlock width="100%" height={44} radius={14} />
              <div style={{ height: 12 }} />
              <SkeletonBlock width="100%" height={44} radius={14} />
            </div>
          </div>
        )}

        {(isDashboard || isTable) && <TableSkeleton />}

        {isCards && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 18
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((card) => (
              <div
                key={card}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E8E8E8',
                  borderRadius: 22,
                  padding: 22,
                  minHeight: 180
                }}
              >
                <SkeletonBlock width="52%" height={18} radius={10} />
                <div style={{ height: 22 }} />
                <SkeletonBlock width="100%" height={12} />
                <div style={{ height: 12 }} />
                <SkeletonBlock width="82%" height={12} />
                <div style={{ height: 28 }} />
                <SkeletonBlock width="46%" height={32} radius={999} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}