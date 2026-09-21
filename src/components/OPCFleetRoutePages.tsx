import { Component, type ErrorInfo, type ReactNode } from 'react';
import MirakaDashboardShell from './MirakaDashboardShell';
import OPCFleetOverviewPage from './OPCFleetOverviewPage';
import OPCFleetMapPage from './OPCFleetMapPage';
import OPCFleetMaintenancePage from './OPCFleetMaintenancePage';
import OPCFleetVehicleDetailPage from './OPCFleetVehicleDetailPage';
import type { UserRole } from '../lib/supabase';

const allowedRoles: UserRole[] = ['owner', 'admin', 'dispatch', 'employee'];

class OPCFleetRuntimeBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Fuhrpark konnte im Browser nicht geladen werden.',
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('OPC Fuhrpark runtime error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <section
          style={{
            border: '1px solid #FCA5A5',
            background: '#FEF2F2',
            color: '#B91C1C',
            borderRadius: '20px',
            padding: '20px',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, Helvetica, Arial, sans-serif',
            fontWeight: 720,
          }}
        >
          <div style={{ fontSize: '18px', fontWeight: 860, marginBottom: '8px' }}>
            Fuhrpark konnte nicht geladen werden.
          </div>
          <div style={{ fontSize: '14px', lineHeight: 1.55 }}>
            {this.state.error}
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}

function FleetShell({
  children,
  currentPath = '/fuhrpark',
}: {
  children: ReactNode;
  currentPath?: string;
}) {
  return (
    <MirakaDashboardShell
      requiredRole={allowedRoles}
      currentPath={currentPath}
      fullWidth={true}
    >
      <OPCFleetRuntimeBoundary>{children}</OPCFleetRuntimeBoundary>
    </MirakaDashboardShell>
  );
}

export function OPCFleetOverviewRoutePage() {
  return (
    <FleetShell currentPath="/fuhrpark">
      <OPCFleetOverviewPage />
    </FleetShell>
  );
}

export function OPCFleetMapRoutePage() {
  return (
    <FleetShell currentPath="/fuhrpark">
      <OPCFleetMapPage />
    </FleetShell>
  );
}

export function OPCFleetMaintenanceRoutePage() {
  return (
    <FleetShell currentPath="/fuhrpark">
      <OPCFleetMaintenancePage />
    </FleetShell>
  );
}

export function OPCFleetVehicleDetailRoutePage({ vehicleId }: { vehicleId: string }) {
  return (
    <FleetShell currentPath="/fuhrpark">
      <OPCFleetVehicleDetailPage vehicleId={vehicleId} />
    </FleetShell>
  );
}
