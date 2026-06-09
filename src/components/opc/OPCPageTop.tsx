import type { CSSProperties, ReactNode } from 'react';

export const OPC_BRAND = {
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  black: '#0F1115',
  card: '#FFFFFF',
  soft: '#FAFAFA',
  red: '#B91C1C',
  amber: '#92400E',
  green: '#166534',
};

export const OPC_PAGE_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

export const opcCardStyle: CSSProperties = {
  background: OPC_BRAND.card,
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: '20px',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

export const opcSelectStyle: CSSProperties = {
  width: '100%',
  height: '48px',
  padding: '0 13px',
  borderRadius: '14px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  outline: 'none',
  fontSize: '14px',
  fontWeight: 620,
  fontFamily: OPC_PAGE_FONT,
  boxSizing: 'border-box',
};

export const opcInputStyle: CSSProperties = {
  width: '100%',
  height: '46px',
  padding: '0 13px',
  borderRadius: '13px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  outline: 'none',
  fontSize: '14px',
  fontWeight: 560,
  fontFamily: OPC_PAGE_FONT,
  boxSizing: 'border-box',
};

export const opcInputWithIconStyle: CSSProperties = {
  width: '100%',
  height: '48px',
  padding: '0 14px 0 42px',
  borderRadius: '14px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  outline: 'none',
  fontSize: '14px',
  fontWeight: 560,
  fontFamily: OPC_PAGE_FONT,
  boxSizing: 'border-box',
};

export const opcSearchIconStyle: CSSProperties = {
  position: 'absolute',
  left: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  color: OPC_BRAND.faint,
  pointerEvents: 'none',
};

export const opcBlackButtonStyle: CSSProperties = {
  width: '100%',
  height: '48px',
  borderRadius: '14px',
  border: `1px solid ${OPC_BRAND.black}`,
  background: OPC_BRAND.black,
  color: '#FFFFFF',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '9px',
  padding: '0 16px',
  fontSize: '14px',
  fontWeight: 760,
  fontFamily: OPC_PAGE_FONT,
  cursor: 'pointer',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
};

export const opcSecondaryButtonStyle: CSSProperties = {
  width: '100%',
  height: '48px',
  borderRadius: '14px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '9px',
  padding: '0 16px',
  fontSize: '14px',
  fontWeight: 760,
  fontFamily: OPC_PAGE_FONT,
  cursor: 'pointer',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
};

export function OPCPageShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="opc-requests-page"
      style={{
        padding: 0,
        fontFamily: OPC_PAGE_FONT,
        color: OPC_BRAND.text,
      }}
    >
      {children}
    </div>
  );
}

export function OPCTabs({
  tabs,
}: {
  tabs: Array<{
    key: string;
    label: string;
    active: boolean;
    onClick: () => void;
  }>;
}) {
  return (
    <div
      className="opc-requests-tabs"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
        gap: '10px',
        marginBottom: '22px',
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={tab.onClick}
          style={{
            height: '48px',
            borderRadius: '15px',
            border: `1px solid ${tab.active ? OPC_BRAND.black : OPC_BRAND.border}`,
            background: tab.active ? OPC_BRAND.black : '#FFFFFF',
            color: tab.active ? '#FFFFFF' : OPC_BRAND.text,
            fontSize: '14px',
            fontWeight: 760,
            cursor: 'pointer',
            fontFamily: OPC_PAGE_FONT,
            boxSizing: 'border-box',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function OPCMetricsGrid({ children }: { children: ReactNode }) {
  return (
    <div
      className="opc-requests-metrics"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '16px',
        marginBottom: '22px',
      }}
    >
      {children}
    </div>
  );
}

export function OPCMetricCard({
  label,
  value,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  tone?: 'neutral' | 'danger' | 'warning' | 'success';
}) {
  const valueColor =
    tone === 'danger'
      ? OPC_BRAND.red
      : tone === 'warning'
        ? OPC_BRAND.amber
        : tone === 'success'
          ? OPC_BRAND.green
          : OPC_BRAND.text;

  return (
    <div
      style={{
        ...opcCardStyle,
        minHeight: '112px',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        boxSizing: 'border-box',
      }}
    >
      <div>
        <div
          style={{
            fontSize: '26px',
            lineHeight: 1,
            fontWeight: 820,
            letterSpacing: '-0.04em',
            color: valueColor,
            marginBottom: '12px',
          }}
        >
          {value}
        </div>

        <div
          style={{
            fontSize: '13px',
            fontWeight: 720,
            color: OPC_BRAND.muted,
          }}
        >
          {label}
        </div>
      </div>

      <div
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '13px',
          border: `1px solid ${OPC_BRAND.border}`,
          background: '#FAFAFA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: OPC_BRAND.black,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
    </div>
  );
}

export function OPCToolbar({
  children,
  columns = 'minmax(0, 1fr) 180px 190px 190px',
}: {
  children: ReactNode;
  columns?: string;
}) {
  return (
    <section
      style={{
        ...opcCardStyle,
        padding: '18px',
        marginBottom: '22px',
      }}
    >
      <div
        className="opc-requests-controls"
        style={{
          display: 'grid',
          gridTemplateColumns: columns,
          gap: '12px',
          alignItems: 'center',
        }}
      >
        {children}
      </div>
    </section>
  );
}

export function OPCListCard({ children }: { children: ReactNode }) {
  return (
    <section
      style={{
        ...opcCardStyle,
        overflow: 'hidden',
      }}
    >
      {children}
    </section>
  );
}

export const opcResponsiveStyle = `
  .opc-requests-mobile-cards {
    display: none;
  }

  .opc-requests-page,
  .opc-requests-page * {
    min-width: 0;
  }

  .opc-requests-page {
    max-width: 100%;
    overflow-x: hidden;
  }

  @media (max-width: 1280px) {
    .opc-requests-metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }

    .opc-requests-controls {
      grid-template-columns: minmax(0, 1fr) 170px 180px !important;
    }

    .opc-requests-controls a,
    .opc-requests-controls button[data-opc-wide="true"] {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 980px) {
    .opc-requests-tabs {
      grid-template-columns: 1fr !important;
    }

    .opc-requests-controls {
      grid-template-columns: 1fr !important;
    }

    .opc-requests-controls a,
    .opc-requests-controls button[data-opc-wide="true"] {
      grid-column: auto;
    }

    .opc-requests-desktop-table {
      display: none !important;
    }

    .opc-requests-mobile-cards {
      display: flex !important;
      flex-direction: column;
      gap: 14px;
      padding: 14px;
    }
  }

  @media (max-width: 860px) {
    .opc-requests-metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 10px !important;
    }

    .opc-requests-metrics > * {
      min-width: 0 !important;
    }
  }

  @media (max-width: 760px) {
    html,
    body {
      max-width: 100%;
      overflow-x: hidden;
    }

    .opc-requests-page {
      padding-bottom: 150px !important;
      overflow-x: hidden !important;
    }

    .opc-requests-page input,
    .opc-requests-page select,
    .opc-requests-page textarea {
      font-size: 16px !important;
    }

    .opc-requests-page button,
    .opc-requests-page a {
      max-width: 100%;
    }
  }

  @media (max-width: 640px) {
    .opc-requests-metrics {
      grid-template-columns: 1fr !important;
    }
  }
`;