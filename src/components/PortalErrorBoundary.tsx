import { Component, type ErrorInfo, type ReactNode } from 'react';

type PortalErrorBoundaryProps = {
  children: ReactNode;
};

type PortalErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export default class PortalErrorBoundary extends Component<
  PortalErrorBoundaryProps,
  PortalErrorBoundaryState
> {
  state: PortalErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: unknown): PortalErrorBoundaryState {
    return {
      hasError: true,
      message:
        error instanceof Error && error.message
          ? error.message
          : 'Unbekannter Darstellungsfehler',
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[OPC Portal] React render error', {
      error,
      componentStack: info.componentStack,
    });
  }

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#f6f7f8',
          fontFamily:
            'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div
          role="alert"
          style={{
            width: '100%',
            maxWidth: 620,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 18,
            padding: 28,
            boxShadow: '0 18px 50px rgba(0,0,0,.08)',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: '#f36f21',
              marginBottom: 10,
            }}
          >
            Orange Pro Clean Portal
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 22,
              lineHeight: 1.25,
              color: '#111827',
            }}
          >
            Diese Seite konnte nicht vollständig dargestellt werden.
          </h1>

          <p
            style={{
              margin: '12px 0 0',
              color: '#6b7280',
              lineHeight: 1.55,
              fontSize: 14,
            }}
          >
            Der Fehler wurde abgefangen, damit keine leere Seite angezeigt wird.
            Lade die Seite erneut oder gehe zurück zum Dashboard.
          </p>

          {this.state.message ? (
            <div
              style={{
                marginTop: 16,
                padding: '10px 12px',
                borderRadius: 10,
                background: '#f9fafb',
                color: '#6b7280',
                fontSize: 12,
                overflowWrap: 'anywhere',
              }}
            >
              {this.state.message}
            </div>
          ) : null}

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              marginTop: 20,
            }}
          >
            <button
              type="button"
              onClick={this.reload}
              style={{
                border: 0,
                borderRadius: 10,
                padding: '11px 16px',
                background: '#111827',
                color: '#fff',
                fontWeight: 750,
                cursor: 'pointer',
              }}
            >
              Seite neu laden
            </button>

            <a
              href="/dashboard"
              style={{
                borderRadius: 10,
                padding: '11px 16px',
                background: '#fff',
                color: '#111827',
                border: '1px solid #d1d5db',
                fontWeight: 750,
                textDecoration: 'none',
              }}
            >
              Zum Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }
}
