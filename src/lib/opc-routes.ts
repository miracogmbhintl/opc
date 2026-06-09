export const OPC_ROUTES = {
  login: '/',
  dashboard: '/dashboard',

  inquiries: '/anfragen',
  calendar: '/kalender',

  inspections: '/besichtigungen',
  inspectionDetail: '/besichtigung',
  quotes: '/offerten',
  quoteDetail: '/offerte',
  invoices: '/rechnungen',
  invoiceDetail: '/rechnung',

  clients: '/kunden',
  clientDetail: '/kunde',
  createClient: '/kunde-anlegen',

  jobs: '/einsaetze',
  jobDetail: '/einsatz',
  createJob: '/einsatz-planen',

  files: '/berichte-dateien',
  tickets: '/anfragen-schaeden',
  qrCodes: '/qr-codes',
  settings: '/einstellungen',
  logout: '/logout',

  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  setPassword: '/set-password',
};

export function getOpcDashboardRoute(role?: string | null): string {
  if (role === 'employee') return OPC_ROUTES.jobs;
  // owner, admin, dispatch all get dashboard access
  return OPC_ROUTES.dashboard;
}

export function legacyRouteToOpc(path: string): string {
  const normalizedPath = path || '/';

  const replacements: Array<[RegExp, string]> = [
    [/^\/dashboard$/, OPC_ROUTES.dashboard],

    [/^\/dashboard\/tickets$/, OPC_ROUTES.tickets],
    [/^\/dashboard\/qr-codes$/, OPC_ROUTES.qrCodes],

    [/^\/dashboard\/owner\/clients$/, OPC_ROUTES.clients],
    [/^\/dashboard\/clients$/, OPC_ROUTES.clients],

    [/^\/kunden$/, OPC_ROUTES.clients],
    [/^\/kunde\/(.+)$/, `${OPC_ROUTES.clientDetail}/$1`],
    [/^\/kunde-anlegen$/, OPC_ROUTES.createClient],

    [/^\/anfragen$/, OPC_ROUTES.inquiries],
    [/^\/anfragen-schaeden$/, OPC_ROUTES.tickets],

    [/^\/besichtigungen$/, OPC_ROUTES.inspections],
    [/^\/besichtigung\/(.+)$/, `${OPC_ROUTES.inspectionDetail}/$1`],
    [/^\/offerten$/, OPC_ROUTES.quotes],
    [/^\/offerte\/(.+)$/, `${OPC_ROUTES.quoteDetail}/$1`],
    [/^\/rechnungen$/, OPC_ROUTES.invoices],
    [/^\/rechnung\/(.+)$/, `${OPC_ROUTES.invoiceDetail}/$1`],

    [/^\/kalender$/, OPC_ROUTES.calendar],
    [/^\/calendar$/, OPC_ROUTES.calendar],
    [/^\/dashboard\/calendar$/, OPC_ROUTES.calendar],
    [/^\/dashboard\/kalender$/, OPC_ROUTES.calendar],

    [/^\/einsaetze$/, OPC_ROUTES.jobs],
    [/^\/einsatz\/(.+)$/, `${OPC_ROUTES.jobDetail}/$1`],
    [/^\/einsatz-planen$/, OPC_ROUTES.createJob],

    [/^\/berichte-dateien$/, OPC_ROUTES.files],
    [/^\/qr-codes$/, OPC_ROUTES.qrCodes],
    [/^\/einstellungen$/, OPC_ROUTES.settings],
    [/^\/logout$/, OPC_ROUTES.logout],

    [/^\/reset-password$/, OPC_ROUTES.resetPassword],
    [/^\/forgot-password$/, OPC_ROUTES.forgotPassword],
    [/^\/set-password$/, OPC_ROUTES.setPassword],
  ];

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(normalizedPath)) {
      return normalizedPath.replace(pattern, replacement);
    }
  }

  return normalizedPath === '/' ? OPC_ROUTES.login : normalizedPath;
}
