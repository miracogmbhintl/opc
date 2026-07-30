// OPC_DASHBOARD_SINGLE_ISLAND_V1
import MirakaDashboardShell from './MirakaDashboardShell';
import DashboardHomeRouter from './DashboardHomeRouter';

export default function DashboardPageApp() {
  return (
    <MirakaDashboardShell
      title="Orange Pro Clean Dashboard"
      requiredRole={[
        'owner',
        'admin',
        'dispatch',
        'employee',
      ]}
      currentPath="/dashboard"
      hideTopBar={true}
    >
      <DashboardHomeRouter />
    </MirakaDashboardShell>
  );
}
