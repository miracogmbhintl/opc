export const OPC_STAFF_PERMISSION_DEFINITIONS = [
  {
    key: 'can_view_assigned_jobs',
    label: 'Zugewiesene Einsätze sehen',
    description: 'Eigene zugewiesene Einsätze und Einsatzdetails öffnen.',
    group: 'standard',
    defaultValue: true,
  },
  {
    key: 'can_upload_job_media',
    label: 'Einsatzmedien hochladen',
    description: 'Fotos und Dateien zu zugewiesenen Einsätzen hochladen.',
    group: 'standard',
    defaultValue: true,
  },
  {
    key: 'can_submit_time_logs',
    label: 'Arbeitszeiten erfassen',
    description: 'Eigene Arbeitszeiten starten, beenden und einreichen.',
    group: 'standard',
    defaultValue: true,
  },
  {
    key: 'can_report_damages',
    label: 'Schäden melden',
    description: 'Schäden und Vorfälle zu Einsätzen erfassen.',
    group: 'standard',
    defaultValue: true,
  },
  {
    key: 'can_view_all_jobs',
    label: 'Alle Einsätze sehen',
    description: 'Nicht nur eigene, sondern sämtliche freigegebenen Einsätze sehen.',
    group: 'extended',
    defaultValue: false,
  },
  {
    key: 'can_manage_time_entries',
    label: 'Zeiten kontrollieren',
    description: 'Zeiteinträge anderer Mitarbeitender prüfen und bearbeiten.',
    group: 'management',
    defaultValue: false,
  },
  {
    key: 'can_manage_jobs',
    label: 'Einsätze verwalten',
    description: 'Einsätze erstellen, ändern und zuweisen.',
    group: 'management',
    defaultValue: false,
  },
  {
    key: 'can_manage_reports',
    label: 'Berichte verwalten',
    description: 'Berichte prüfen und administrative Berichtsfunktionen verwenden.',
    group: 'management',
    defaultValue: false,
  },
  {
    key: 'can_manage_employees',
    label: 'Mitarbeiter verwalten',
    description: 'HR- und Mitarbeiterfunktionen verwenden.',
    group: 'management',
    defaultValue: false,
  },
  {
    key: 'can_manage_inquiries',
    label: 'Anfragen verwalten',
    description: 'Kunden- und Interessenten-Anfragen bearbeiten.',
    group: 'management',
    defaultValue: false,
  },
  {
    key: 'can_manage_onboarding',
    label: 'Onboarding verwalten',
    description: 'Onboarding-Prozesse administrieren.',
    group: 'management',
    defaultValue: false,
  },
  {
    key: 'can_manage_clients',
    label: 'Kunden verwalten',
    description: 'Kundenstammdaten und Kundenbereiche verwalten.',
    group: 'management',
    defaultValue: false,
  },
  {
    key: 'can_manage_finance',
    label: 'Finanzen verwalten',
    description: 'Finanz- und Abrechnungsbereiche administrieren.',
    group: 'sensitive',
    defaultValue: false,
  },
  {
    key: 'can_manage_settings',
    label: 'Systemeinstellungen verwalten',
    description: 'Administrative Systemeinstellungen ändern.',
    group: 'sensitive',
    defaultValue: false,
  },
] as const;

export type OpcStaffPermissionKey =
  (typeof OPC_STAFF_PERMISSION_DEFINITIONS)[number]['key'];

export type OpcStaffPermissions =
  Record<OpcStaffPermissionKey, boolean>;

export function defaultOpcEmployeePermissions(): OpcStaffPermissions {
  return Object.fromEntries(
    OPC_STAFF_PERMISSION_DEFINITIONS.map((item) => [
      item.key,
      item.defaultValue,
    ]),
  ) as OpcStaffPermissions;
}

export function normalizeOpcStaffPermissions(
  value: unknown,
): OpcStaffPermissions {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const defaults = defaultOpcEmployeePermissions();

  return Object.fromEntries(
    OPC_STAFF_PERMISSION_DEFINITIONS.map((item) => [
      item.key,
      typeof source[item.key] === 'boolean'
        ? source[item.key]
        : defaults[item.key],
    ]),
  ) as OpcStaffPermissions;
}

export const OPC_EMPLOYEE_PORTAL_ACCESS_DEFAULT = {
  enabled: false,
  sendInvite: true,
  loginEmail: '',
  permissions: defaultOpcEmployeePermissions(),
};

export type OpcEmployeePortalAccessDraft = {
  enabled: boolean;
  sendInvite: boolean;
  loginEmail: string;
  permissions: OpcStaffPermissions;
};
