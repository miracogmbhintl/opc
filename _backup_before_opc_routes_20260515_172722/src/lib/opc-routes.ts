export const OPC_ROUTES = {
  login: '/',
  dashboard: '/dashboard',

  clients: '/kunden',
  clientDetail: '/kunde',
  createClient: '/kunde-anlegen',

  jobs: '/einsaetze',
  jobDetail: '/einsatz',
  createJob: '/einsatz-planen',

  files: '/berichte-dateien',
  tickets: '/anfragen-schaeden',
  settings: '/einstellungen',
  logout: '/logout',

  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  setPassword: '/set-password',
};

export function getOpcDashboardRoute(role?: string | null): string {
  if (role === 'employee') return OPC_ROUTES.jobs;
  return OPC_ROUTES.dashboard;
}

export function legacyRouteToOpc(path: string): string {
  return path
    .replace('/miraka-co-portal/owner-dashboard', OPC_ROUTES.dashboard)
    .replace('/miraka-co-portal/admin-dashboard', OPC_ROUTES.dashboard)
    .replace('/miraka-co-portal/client-dashboard', OPC_ROUTES.dashboard)
    .replace('/miraka-co-portal/clients', OPC_ROUTES.clients)
    .replace('/miraka-co-portal/client/', `${OPC_ROUTES.clientDetail}/`)
    .replace('/miraka-co-portal/projects', OPC_ROUTES.jobs)
    .replace('/miraka-co-portal/project/', `${OPC_ROUTES.jobDetail}/`)
    .replace('/miraka-co-portal/create-project', OPC_ROUTES.createJob)
    .replace('/miraka-co-portal/create-client', OPC_ROUTES.createClient)
    .replace('/miraka-co-portal/files', OPC_ROUTES.files)
    .replace('/miraka-co-portal/tickets', OPC_ROUTES.tickets)
    .replace('/miraka-co-portal/settings', OPC_ROUTES.settings)
    .replace('/miraka-co-portal/logout', OPC_ROUTES.logout)
    .replace('/miraka-co-portal/reset-password', OPC_ROUTES.resetPassword)
    .replace('/miraka-co-portal/forgot-password', OPC_ROUTES.forgotPassword)
    .replace('/miraka-co-portal/set-password', OPC_ROUTES.setPassword)
    .replace('/miraka-co-portal', OPC_ROUTES.login);
}