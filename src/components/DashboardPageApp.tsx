// OPC_DASHBOARD_SINGLE_ISLAND_V1
import MirakaDashboardShell from './MirakaDashboardShell';
import DashboardHomeEntry from './DashboardHomeEntry';

export default function DashboardPageApp() {
  return (
    <MirakaDashboardShell
      title="Orange Pro Clean Dashboard"
      requiredRole={[
        'owner',
        'admin',
        'dispatch',
        'employee',
        'client',
      ]}
      currentPath="/dashboard"
      hideTopBar={true}
    >
      <DashboardHomeEntry />
    </MirakaDashboardShell>
  );
}
