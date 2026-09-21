import { maskAhvNumber } from './opc-sensitive-data';

import {
  createExportFile,
  fetchAllExportRows,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  hoursFromMinutes,
  yesNo,
  type OpcExportFile,
} from './opc-data-export-csv';

export type OpcDataExportScope =
  | 'all'
  | 'clients'
  | 'quotes'
  | 'invoices'
  | 'finance'
  | 'employees'
  | 'time'
  | 'payroll'
  | 'jobs'
  | 'inspections'
  | 'inquiries'
  | 'tickets';

const VALID_SCOPES = new Set<OpcDataExportScope>([
  'all',
  'clients',
  'quotes',
  'invoices',
  'finance',
  'employees',
  'time',
  'payroll',
  'jobs',
  'inspections',
  'inquiries',
  'tickets',
]);

export function normalizeDataExportScope(
  value: unknown,
): OpcDataExportScope | null {
  const scope = String(value || '')
    .trim()
    .toLowerCase() as OpcDataExportScope;

  return VALID_SCOPES.has(scope)
    ? scope
    : null;
}

export function getDataExportScopeLabel(
  scope: OpcDataExportScope,
) {
  const labels: Record<OpcDataExportScope, string> = {
    all: 'Gesamter Unternehmensdatenbestand',
    clients: 'Kunden',
    quotes: 'Offerten',
    invoices: 'Rechnungen',
    finance: 'Finanzen',
    employees: 'Mitarbeiter',
    time: 'Zeiterfassung',
    payroll: 'Lohnabrechnung',
    jobs: 'Einsätze',
    inspections: 'Besichtigungen',
    inquiries: 'Anfragen',
    tickets: 'Tickets & Schäden',
  };

  return labels[scope];
}

function exportDate() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function getClientDirectory(supabase: any) {
  const rows = await fetchAllExportRows(
    supabase,
    'opc_client_overview',
    [
      'client_id',
      'billing_name',
      'full_name',
      'company_name',
      'email',
      'billing_email',
    ].join(','),
    'client_created_at',
  );

  return new Map(
    rows.map((row) => [
      String(row.client_id),
      row,
    ]),
  );
}

function clientName(
  directory: Map<string, any>,
  clientId: unknown,
) {
  const row = directory.get(String(clientId || ''));

  return (
    row?.billing_name ||
    row?.company_name ||
    row?.full_name ||
    ''
  );
}

async function getEmployeeDirectory(supabase: any) {
  const rows = await fetchAllExportRows(
    supabase,
    'opc_employees',
    'id,employee_number,legal_first_name,legal_last_name,preferred_name',
    'created_at',
  );

  return new Map(
    rows.map((row) => [
      String(row.id),
      row,
    ]),
  );
}

function employeeName(
  directory: Map<string, any>,
  employeeId: unknown,
) {
  const row = directory.get(String(employeeId || ''));

  return [
    row?.legal_first_name,
    row?.legal_last_name,
  ]
    .filter(Boolean)
    .join(' ') || row?.preferred_name || '';
}

async function buildClientFiles(
  supabase: any,
  stamp: string,
) {
  const clients = await fetchAllExportRows(
    supabase,
    'opc_client_overview',
    [
      'client_id',
      'client_status',
      'client_type',
      'billing_name',
      'billing_email',
      'billing_phone_e164',
      'billing_address',
      'internal_notes',
      'full_name',
      'company_name',
      'email',
      'phone_raw',
      'phone_e164',
      'lifecycle_stage',
      'primary_site_name',
      'primary_site_type',
      'primary_site_address',
      'primary_site_postal_code',
      'primary_site_city',
      'active_site_count',
      'converted_at',
      'onboarding_case_count',
      'last_activity_at',
      'client_created_at',
    ].join(','),
    'client_created_at',
  );

  const clientDirectory = new Map(
    clients.map((row) => [
      String(row.client_id),
      row,
    ]),
  );

  const sites = await fetchAllExportRows(
    supabase,
    'opc_client_sites',
    [
      'client_id',
      'site_name',
      'site_type',
      'status',
      'address_text',
      'postal_code',
      'city',
      'country',
      'access_notes',
      'cleaning_notes',
      'billing_notes',
      'is_primary',
      'is_billable',
      'billing_mode',
      'invoice_position_title',
      'created_at',
    ].join(','),
    'created_at',
  );

  const contacts = await fetchAllExportRows(
    supabase,
    'opc_contacts',
    'id,full_name,company_name,email,phone_raw,phone_e164,preferred_language,lifecycle_stage,notes,created_at',
    'created_at',
  );

  const links = await fetchAllExportRows(
    supabase,
    'opc_client_contact_links',
    'client_id,contact_id,role_label,is_primary,receives_reports,receives_invoices,receives_operations_updates,created_at',
    'created_at',
  );

  const contactsById = new Map(
    contacts.map((row) => [
      String(row.id),
      row,
    ]),
  );

  const contactRows = links.map((link) => ({
    ...link,
    contact:
      contactsById.get(String(link.contact_id)) || {},
    client:
      clientDirectory.get(String(link.client_id)) || {},
  }));

  return [
    createExportFile(
      `Orange_Pro_Clean_Kunden_${stamp}.csv`,
      clients,
      [
        { header: 'Status', value: (r) => r.client_status },
        { header: 'Kundenart', value: (r) => r.client_type },
        { header: 'Rechnungsname', value: (r) => r.billing_name },
        { header: 'Ansprechperson', value: (r) => r.full_name },
        { header: 'Firma', value: (r) => r.company_name },
        { header: 'E-Mail', value: (r) => r.email || r.billing_email },
        { header: 'Telefon', value: (r) => r.phone_e164 || r.phone_raw || r.billing_phone_e164 },
        { header: 'Rechnungsadresse', value: (r) => r.billing_address },
        { header: 'Lebenszyklus', value: (r) => r.lifecycle_stage },
        { header: 'Hauptstandort', value: (r) => r.primary_site_name },
        { header: 'Standortart', value: (r) => r.primary_site_type },
        { header: 'Standortadresse', value: (r) => r.primary_site_address },
        { header: 'PLZ', value: (r) => r.primary_site_postal_code },
        { header: 'Ort', value: (r) => r.primary_site_city },
        { header: 'Aktive Standorte', value: (r) => r.active_site_count },
        { header: 'Onboarding-Fälle', value: (r) => r.onboarding_case_count },
        { header: 'Interne Notizen', value: (r) => r.internal_notes },
        { header: 'Konvertiert am', value: (r) => formatDateTime(r.converted_at) },
        { header: 'Letzte Aktivität', value: (r) => formatDateTime(r.last_activity_at) },
        { header: 'Erstellt am', value: (r) => formatDateTime(r.client_created_at) },
      ],
    ),

    createExportFile(
      `Orange_Pro_Clean_Kunden_Standorte_${stamp}.csv`,
      sites,
      [
        { header: 'Kunde', value: (r) => clientName(clientDirectory, r.client_id) },
        { header: 'Standort', value: (r) => r.site_name },
        { header: 'Standortart', value: (r) => r.site_type },
        { header: 'Status', value: (r) => r.status },
        { header: 'Adresse', value: (r) => r.address_text },
        { header: 'PLZ', value: (r) => r.postal_code },
        { header: 'Ort', value: (r) => r.city },
        { header: 'Land', value: (r) => r.country },
        { header: 'Hauptstandort', value: (r) => yesNo(r.is_primary) },
        { header: 'Verrechenbar', value: (r) => yesNo(r.is_billable) },
        { header: 'Abrechnungsart', value: (r) => r.billing_mode },
        { header: 'Rechnungsposition', value: (r) => r.invoice_position_title },
        { header: 'Zugangshinweise', value: (r) => r.access_notes },
        { header: 'Reinigungshinweise', value: (r) => r.cleaning_notes },
        { header: 'Abrechnungshinweise', value: (r) => r.billing_notes },
        { header: 'Erstellt am', value: (r) => formatDateTime(r.created_at) },
      ],
    ),

    createExportFile(
      `Orange_Pro_Clean_Kunden_Kontakte_${stamp}.csv`,
      contactRows,
      [
        { header: 'Kunde', value: (r) => r.client.billing_name || r.client.company_name || r.client.full_name },
        { header: 'Kontakt', value: (r) => r.contact.full_name },
        { header: 'Firma', value: (r) => r.contact.company_name },
        { header: 'Rolle', value: (r) => r.role_label },
        { header: 'E-Mail', value: (r) => r.contact.email },
        { header: 'Telefon', value: (r) => r.contact.phone_e164 || r.contact.phone_raw },
        { header: 'Sprache', value: (r) => r.contact.preferred_language },
        { header: 'Hauptkontakt', value: (r) => yesNo(r.is_primary) },
        { header: 'Erhält Berichte', value: (r) => yesNo(r.receives_reports) },
        { header: 'Erhält Rechnungen', value: (r) => yesNo(r.receives_invoices) },
        { header: 'Erhält Einsatzupdates', value: (r) => yesNo(r.receives_operations_updates) },
        { header: 'Notizen', value: (r) => r.contact.notes },
        { header: 'Erstellt am', value: (r) => formatDateTime(r.created_at) },
      ],
    ),
  ];
}

async function buildQuoteFiles(
  supabase: any,
  stamp: string,
) {
  const clients = await getClientDirectory(supabase);

  const quotes = await fetchAllExportRows(
    supabase,
    'opc_quotes',
    [
      'id',
      'quote_number',
      'client_id',
      'status',
      'quote_type',
      'title',
      'language',
      'currency',
      'issue_date',
      'valid_until',
      'intro_text',
      'scope_text',
      'service_description_text',
      'terms_text',
      'payment_terms',
      'acceptance_terms',
      'internal_notes',
      'customer_notes',
      'subtotal_chf',
      'discount_chf',
      'tax_rate',
      'tax_chf',
      'total_chf',
      'estimated_hours',
      'estimated_staff_count',
      'sent_at',
      'viewed_at',
      'accepted_at',
      'declined_at',
      'converted_to_job_at',
      'invoiced_at',
      'created_at',
    ].join(','),
    'created_at',
  );

  const quoteDirectory = new Map(
    quotes.map((row) => [
      String(row.id),
      row,
    ]),
  );

  const items = await fetchAllExportRows(
    supabase,
    'opc_quote_items',
    [
      'quote_id',
      'sort_order',
      'item_type',
      'title',
      'description',
      'quantity',
      'unit',
      'unit_price_chf',
      'discount_chf',
      'tax_rate',
      'subtotal_chf',
      'tax_chf',
      'total_chf',
      'created_at',
    ].join(','),
    'created_at',
  );

  return [
    createExportFile(
      `Orange_Pro_Clean_Offerten_${stamp}.csv`,
      quotes,
      [
        { header: 'Offertennummer', value: (r) => r.quote_number },
        { header: 'Kunde', value: (r) => clientName(clients, r.client_id) },
        { header: 'Status', value: (r) => r.status },
        { header: 'Art', value: (r) => r.quote_type },
        { header: 'Titel', value: (r) => r.title },
        { header: 'Sprache', value: (r) => r.language },
        { header: 'Währung', value: (r) => r.currency },
        { header: 'Ausgabedatum', value: (r) => formatDate(r.issue_date) },
        { header: 'Gültig bis', value: (r) => formatDate(r.valid_until) },
        { header: 'Einleitung', value: (r) => r.intro_text },
        { header: 'Leistungsumfang', value: (r) => r.scope_text },
        { header: 'Leistungsbeschreibung', value: (r) => r.service_description_text },
        { header: 'Zahlungsbedingungen', value: (r) => r.payment_terms },
        { header: 'Annahmebedingungen', value: (r) => r.acceptance_terms },
        { header: 'AGB / Bedingungen', value: (r) => r.terms_text },
        { header: 'Kundennotizen', value: (r) => r.customer_notes },
        { header: 'Interne Notizen', value: (r) => r.internal_notes },
        { header: 'Zwischensumme CHF', value: (r) => formatMoney(r.subtotal_chf) },
        { header: 'Rabatt CHF', value: (r) => formatMoney(r.discount_chf) },
        { header: 'MWST %', value: (r) => formatNumber(r.tax_rate) },
        { header: 'MWST CHF', value: (r) => formatMoney(r.tax_chf) },
        { header: 'Gesamt CHF', value: (r) => formatMoney(r.total_chf) },
        { header: 'Geschätzte Stunden', value: (r) => formatNumber(r.estimated_hours) },
        { header: 'Geschätzte Mitarbeitende', value: (r) => r.estimated_staff_count },
        { header: 'Gesendet am', value: (r) => formatDateTime(r.sent_at) },
        { header: 'Angesehen am', value: (r) => formatDateTime(r.viewed_at) },
        { header: 'Angenommen am', value: (r) => formatDateTime(r.accepted_at) },
        { header: 'Abgelehnt am', value: (r) => formatDateTime(r.declined_at) },
        { header: 'In Einsatz umgewandelt am', value: (r) => formatDateTime(r.converted_to_job_at) },
        { header: 'Verrechnet am', value: (r) => formatDateTime(r.invoiced_at) },
        { header: 'Erstellt am', value: (r) => formatDateTime(r.created_at) },
      ],
    ),

    createExportFile(
      `Orange_Pro_Clean_Offerten_Positionen_${stamp}.csv`,
      items,
      [
        {
          header: 'Offertennummer',
          value: (r) =>
            quoteDirectory.get(String(r.quote_id))
              ?.quote_number || '',
        },
        {
          header: 'Kunde',
          value: (r) => {
            const quote =
              quoteDirectory.get(String(r.quote_id));

            return clientName(
              clients,
              quote?.client_id,
            );
          },
        },
        { header: 'Position', value: (r) => r.sort_order },
        { header: 'Art', value: (r) => r.item_type },
        { header: 'Titel', value: (r) => r.title },
        { header: 'Beschreibung', value: (r) => r.description },
        { header: 'Menge', value: (r) => formatNumber(r.quantity) },
        { header: 'Einheit', value: (r) => r.unit },
        { header: 'Einzelpreis CHF', value: (r) => formatMoney(r.unit_price_chf) },
        { header: 'Rabatt CHF', value: (r) => formatMoney(r.discount_chf) },
        { header: 'MWST %', value: (r) => formatNumber(r.tax_rate) },
        { header: 'Zwischensumme CHF', value: (r) => formatMoney(r.subtotal_chf) },
        { header: 'MWST CHF', value: (r) => formatMoney(r.tax_chf) },
        { header: 'Gesamt CHF', value: (r) => formatMoney(r.total_chf) },
      ],
    ),
  ];
}

async function buildInvoiceFiles(
  supabase: any,
  stamp: string,
) {
  const clients = await getClientDirectory(supabase);

  const invoices = await fetchAllExportRows(
    supabase,
    'opc_invoices',
    [
      'id',
      'invoice_number',
      'client_id',
      'status',
      'invoice_type',
      'title',
      'language',
      'currency',
      'issue_date',
      'due_date',
      'intro_text',
      'payment_terms',
      'internal_notes',
      'subtotal_chf',
      'discount_chf',
      'tax_rate',
      'tax_chf',
      'total_chf',
      'paid_chf',
      'balance_chf',
      'sent_at',
      'paid_at',
      'created_at',
    ].join(','),
    'created_at',
  );

  const invoiceDirectory = new Map(
    invoices.map((row) => [
      String(row.id),
      row,
    ]),
  );

  const items = await fetchAllExportRows(
    supabase,
    'opc_invoice_items',
    [
      'invoice_id',
      'sort_order',
      'title',
      'description',
      'quantity',
      'unit',
      'unit_price_chf',
      'discount_chf',
      'tax_rate',
      'subtotal_chf',
      'tax_chf',
      'total_chf',
      'created_at',
    ].join(','),
    'created_at',
  );

  return [
    createExportFile(
      `Orange_Pro_Clean_Rechnungen_${stamp}.csv`,
      invoices,
      [
        { header: 'Rechnungsnummer', value: (r) => r.invoice_number },
        { header: 'Kunde', value: (r) => clientName(clients, r.client_id) },
        { header: 'Status', value: (r) => r.status },
        { header: 'Rechnungsart', value: (r) => r.invoice_type },
        { header: 'Titel', value: (r) => r.title },
        { header: 'Sprache', value: (r) => r.language },
        { header: 'Währung', value: (r) => r.currency },
        { header: 'Rechnungsdatum', value: (r) => formatDate(r.issue_date) },
        { header: 'Fällig am', value: (r) => formatDate(r.due_date) },
        { header: 'Einleitung', value: (r) => r.intro_text },
        { header: 'Zahlungsbedingungen', value: (r) => r.payment_terms },
        { header: 'Interne Notizen', value: (r) => r.internal_notes },
        { header: 'Zwischensumme CHF', value: (r) => formatMoney(r.subtotal_chf) },
        { header: 'Rabatt CHF', value: (r) => formatMoney(r.discount_chf) },
        { header: 'MWST %', value: (r) => formatNumber(r.tax_rate) },
        { header: 'MWST CHF', value: (r) => formatMoney(r.tax_chf) },
        { header: 'Gesamt CHF', value: (r) => formatMoney(r.total_chf) },
        { header: 'Bezahlt CHF', value: (r) => formatMoney(r.paid_chf) },
        { header: 'Offen CHF', value: (r) => formatMoney(r.balance_chf) },
        { header: 'Gesendet am', value: (r) => formatDateTime(r.sent_at) },
        { header: 'Bezahlt am', value: (r) => formatDateTime(r.paid_at) },
        { header: 'Erstellt am', value: (r) => formatDateTime(r.created_at) },
      ],
    ),

    createExportFile(
      `Orange_Pro_Clean_Rechnungen_Positionen_${stamp}.csv`,
      items,
      [
        {
          header: 'Rechnungsnummer',
          value: (r) =>
            invoiceDirectory.get(String(r.invoice_id))
              ?.invoice_number || '',
        },
        {
          header: 'Kunde',
          value: (r) => {
            const invoice =
              invoiceDirectory.get(
                String(r.invoice_id),
              );

            return clientName(
              clients,
              invoice?.client_id,
            );
          },
        },
        { header: 'Position', value: (r) => r.sort_order },
        { header: 'Titel', value: (r) => r.title },
        { header: 'Beschreibung', value: (r) => r.description },
        { header: 'Menge', value: (r) => formatNumber(r.quantity) },
        { header: 'Einheit', value: (r) => r.unit },
        { header: 'Einzelpreis CHF', value: (r) => formatMoney(r.unit_price_chf) },
        { header: 'Rabatt CHF', value: (r) => formatMoney(r.discount_chf) },
        { header: 'MWST %', value: (r) => formatNumber(r.tax_rate) },
        { header: 'Zwischensumme CHF', value: (r) => formatMoney(r.subtotal_chf) },
        { header: 'MWST CHF', value: (r) => formatMoney(r.tax_chf) },
        { header: 'Gesamt CHF', value: (r) => formatMoney(r.total_chf) },
      ],
    ),
  ];
}

async function buildEmployeeFiles(
  supabase: any,
  stamp: string,
) {
  const employees = await fetchAllExportRows(
    supabase,
    'opc_employees',
    [
      'employee_number',
      'legal_first_name',
      'legal_last_name',
      'preferred_name',
      'date_of_birth',
      'gender_code',
      'ahv_number',
      'private_email',
      'business_email',
      'phone_raw',
      'phone_e164',
      'preferred_language',
      'bank_iban',
      'bank_bic',
      'bank_account_holder',
      'status',
      'entry_date',
      'exit_date',
      'internal_notes',
      'personnel_type',
      'payroll_in_scope',
      'portal_access_only',
      'payroll_exclusion_reason',
      'civil_status',
      'birth_place',
      'citizenship_place',
      'profile_completion_status',
      'assignment_status',
      'created_at',
    ].join(','),
    'created_at',
  );

  return [
    createExportFile(
      `Orange_Pro_Clean_Mitarbeiter_${stamp}.csv`,
      employees,
      [
        { header: 'Mitarbeiternummer', value: (r) => r.employee_number },
        { header: 'Vorname', value: (r) => r.legal_first_name },
        { header: 'Nachname', value: (r) => r.legal_last_name },
        { header: 'Bevorzugter Name', value: (r) => r.preferred_name },
        { header: 'Geburtsdatum', value: (r) => formatDate(r.date_of_birth) },
        { header: 'Geschlecht', value: (r) => r.gender_code },
        { header: 'AHV-Nummer', value: (r) => maskAhvNumber(r.ahv_number) },
        { header: 'Private E-Mail', value: (r) => r.private_email },
        { header: 'Geschäftliche E-Mail', value: (r) => r.business_email },
        { header: 'Telefon', value: (r) => r.phone_e164 || r.phone_raw },
        { header: 'Sprache', value: (r) => r.preferred_language },
        { header: 'IBAN', value: (r) => r.bank_iban },
        { header: 'BIC', value: (r) => r.bank_bic },
        { header: 'Kontoinhaber', value: (r) => r.bank_account_holder },
        { header: 'Status', value: (r) => r.status },
        { header: 'Personalart', value: (r) => r.personnel_type },
        { header: 'Payroll aktiv', value: (r) => yesNo(r.payroll_in_scope) },
        { header: 'Nur Portalzugang', value: (r) => yesNo(r.portal_access_only) },
        { header: 'Payroll Ausschlussgrund', value: (r) => r.payroll_exclusion_reason },
        { header: 'Zivilstand', value: (r) => r.civil_status },
        { header: 'Geburtsort', value: (r) => r.birth_place },
        { header: 'Heimatort', value: (r) => r.citizenship_place },
        { header: 'Eintritt', value: (r) => formatDate(r.entry_date) },
        { header: 'Austritt', value: (r) => formatDate(r.exit_date) },
        { header: 'Profilstatus', value: (r) => r.profile_completion_status },
        { header: 'Einsatzstatus', value: (r) => r.assignment_status },
        { header: 'Interne Notizen', value: (r) => r.internal_notes },
        { header: 'Erstellt am', value: (r) => formatDateTime(r.created_at) },
      ],
    ),
  ];
}

async function buildTimeFiles(
  supabase: any,
  stamp: string,
) {
  const rows = await fetchAllExportRows(
    supabase,
    'opc_employee_time_entries',
    [
      'employee_name',
      'work_date',
      'clock_in_at',
      'clock_out_at',
      'break_minutes',
      'total_minutes',
      'status',
      'notes',
      'employee_note',
      'dispatch_note',
      'submitted_at',
      'approved_at',
      'rejected_at',
      'recording_method',
      'created_at',
    ].join(','),
    'work_date',
  );

  return [
    createExportFile(
      `Orange_Pro_Clean_Zeiterfassung_${stamp}.csv`,
      rows,
      [
        { header: 'Mitarbeiter', value: (r) => r.employee_name },
        { header: 'Arbeitstag', value: (r) => formatDate(r.work_date) },
        { header: 'Arbeitsbeginn', value: (r) => formatDateTime(r.clock_in_at) },
        { header: 'Arbeitsende', value: (r) => formatDateTime(r.clock_out_at) },
        { header: 'Pause Minuten', value: (r) => r.break_minutes },
        { header: 'Arbeitszeit Stunden', value: (r) => hoursFromMinutes(r.total_minutes) },
        { header: 'Arbeitszeit Minuten', value: (r) => r.total_minutes },
        { header: 'Status', value: (r) => r.status },
        { header: 'Notizen', value: (r) => r.notes },
        { header: 'Mitarbeiternotiz', value: (r) => r.employee_note },
        { header: 'Managementnotiz', value: (r) => r.dispatch_note },
        { header: 'Erfassungsart', value: (r) => r.recording_method },
        { header: 'Eingereicht am', value: (r) => formatDateTime(r.submitted_at) },
        { header: 'Genehmigt am', value: (r) => formatDateTime(r.approved_at) },
        { header: 'Abgelehnt am', value: (r) => formatDateTime(r.rejected_at) },
        { header: 'Erstellt am', value: (r) => formatDateTime(r.created_at) },
      ],
    ),
  ];
}

async function buildPayrollFiles(
  supabase: any,
  stamp: string,
) {
  const employees =
    await getEmployeeDirectory(supabase);

  const runs = await fetchAllExportRows(
    supabase,
    'opc_payroll_runs',
    [
      'id',
      'run_number',
      'employee_id',
      'period_from',
      'period_to',
      'status',
      'currency_code',
      'total_gross_chf',
      'total_employee_deductions_chf',
      'total_net_chf',
      'total_reimbursements_chf',
      'total_payout_chf',
      'total_employer_contributions_chf',
      'total_employer_cost_chf',
      'calculated_at',
      'approved_at',
      'paid_at',
      'created_at',
    ].join(','),
    'created_at',
  );

  const runDirectory = new Map(
    runs.map((row) => [
      String(row.id),
      row,
    ]),
  );

  const employeeRuns =
    await fetchAllExportRows(
      supabase,
      'opc_payroll_run_employees',
      [
        'id',
        'payroll_run_id',
        'employee_id',
        'salary_type',
        'approved_entry_count',
        'approved_minutes',
        'payable_days',
        'period_working_days',
        'base_salary_chf',
        'gross_salary_chf',
        'employee_deductions_chf',
        'net_salary_chf',
        'reimbursements_chf',
        'other_adjustments_chf',
        'payout_chf',
        'employer_contributions_chf',
        'total_employer_cost_chf',
        'gross_per_hour_chf',
        'net_per_hour_chf',
        'employer_cost_per_hour_chf',
        'created_at',
      ].join(','),
      'created_at',
    );

  const employeeRunDirectory = new Map(
    employeeRuns.map((row) => [
      String(row.id),
      row,
    ]),
  );

  const lines = await fetchAllExportRows(
    supabase,
    'opc_payroll_lines',
    [
      'payroll_run_employee_id',
      'line_group',
      'line_code',
      'description',
      'basis_amount_chf',
      'quantity',
      'rate',
      'employee_amount_chf',
      'employer_amount_chf',
      'sort_order',
      'source',
      'created_at',
    ].join(','),
    'created_at',
  );

  return [
    createExportFile(
      `Orange_Pro_Clean_Lohnlaeufe_${stamp}.csv`,
      runs,
      [
        { header: 'Lohnlauf', value: (r) => r.run_number },
        { header: 'Mitarbeiter', value: (r) => employeeName(employees, r.employee_id) },
        { header: 'Von', value: (r) => formatDate(r.period_from) },
        { header: 'Bis', value: (r) => formatDate(r.period_to) },
        { header: 'Status', value: (r) => r.status },
        { header: 'Währung', value: (r) => r.currency_code },
        { header: 'Bruttolohn CHF', value: (r) => formatMoney(r.total_gross_chf) },
        { header: 'Arbeitnehmerabzüge CHF', value: (r) => formatMoney(r.total_employee_deductions_chf) },
        { header: 'Nettolohn CHF', value: (r) => formatMoney(r.total_net_chf) },
        { header: 'Spesen CHF', value: (r) => formatMoney(r.total_reimbursements_chf) },
        { header: 'Auszahlung CHF', value: (r) => formatMoney(r.total_payout_chf) },
        { header: 'Arbeitgeberbeiträge CHF', value: (r) => formatMoney(r.total_employer_contributions_chf) },
        { header: 'Arbeitgeberkosten CHF', value: (r) => formatMoney(r.total_employer_cost_chf) },
        { header: 'Berechnet am', value: (r) => formatDateTime(r.calculated_at) },
        { header: 'Genehmigt am', value: (r) => formatDateTime(r.approved_at) },
        { header: 'Bezahlt am', value: (r) => formatDateTime(r.paid_at) },
      ],
    ),

    createExportFile(
      `Orange_Pro_Clean_Lohnabrechnung_Details_${stamp}.csv`,
      employeeRuns,
      [
        {
          header: 'Lohnlauf',
          value: (r) =>
            runDirectory.get(
              String(r.payroll_run_id),
            )?.run_number || '',
        },
        { header: 'Mitarbeiter', value: (r) => employeeName(employees, r.employee_id) },
        { header: 'Lohntyp', value: (r) => r.salary_type },
        { header: 'Genehmigte Einträge', value: (r) => r.approved_entry_count },
        { header: 'Genehmigte Stunden', value: (r) => hoursFromMinutes(r.approved_minutes) },
        { header: 'Zahlbare Tage', value: (r) => formatNumber(r.payable_days) },
        { header: 'Arbeitstage Periode', value: (r) => formatNumber(r.period_working_days) },
        { header: 'Grundlohn CHF', value: (r) => formatMoney(r.base_salary_chf) },
        { header: 'Bruttolohn CHF', value: (r) => formatMoney(r.gross_salary_chf) },
        { header: 'Abzüge CHF', value: (r) => formatMoney(r.employee_deductions_chf) },
        { header: 'Nettolohn CHF', value: (r) => formatMoney(r.net_salary_chf) },
        { header: 'Spesen CHF', value: (r) => formatMoney(r.reimbursements_chf) },
        { header: 'Weitere Anpassungen CHF', value: (r) => formatMoney(r.other_adjustments_chf) },
        { header: 'Auszahlung CHF', value: (r) => formatMoney(r.payout_chf) },
        { header: 'Arbeitgeberbeiträge CHF', value: (r) => formatMoney(r.employer_contributions_chf) },
        { header: 'Arbeitgeberkosten CHF', value: (r) => formatMoney(r.total_employer_cost_chf) },
        { header: 'Brutto pro Stunde CHF', value: (r) => formatMoney(r.gross_per_hour_chf) },
        { header: 'Netto pro Stunde CHF', value: (r) => formatMoney(r.net_per_hour_chf) },
        { header: 'Arbeitgeberkosten pro Stunde CHF', value: (r) => formatMoney(r.employer_cost_per_hour_chf) },
      ],
    ),

    createExportFile(
      `Orange_Pro_Clean_Lohnpositionen_${stamp}.csv`,
      lines,
      [
        {
          header: 'Lohnlauf',
          value: (r) => {
            const employeeRun =
              employeeRunDirectory.get(
                String(
                  r.payroll_run_employee_id,
                ),
              );

            return runDirectory.get(
              String(employeeRun?.payroll_run_id),
            )?.run_number || '';
          },
        },
        {
          header: 'Mitarbeiter',
          value: (r) => {
            const employeeRun =
              employeeRunDirectory.get(
                String(
                  r.payroll_run_employee_id,
                ),
              );

            return employeeName(
              employees,
              employeeRun?.employee_id,
            );
          },
        },
        { header: 'Gruppe', value: (r) => r.line_group },
        { header: 'Lohnart', value: (r) => r.line_code },
        { header: 'Beschreibung', value: (r) => r.description },
        { header: 'Basis CHF', value: (r) => formatMoney(r.basis_amount_chf) },
        { header: 'Menge', value: (r) => formatNumber(r.quantity) },
        { header: 'Ansatz', value: (r) => formatNumber(r.rate, 4) },
        { header: 'Arbeitnehmerbetrag CHF', value: (r) => formatMoney(r.employee_amount_chf) },
        { header: 'Arbeitgeberbetrag CHF', value: (r) => formatMoney(r.employer_amount_chf) },
        { header: 'Quelle', value: (r) => r.source },
      ],
    ),
  ];
}

async function buildJobFiles(
  supabase: any,
  stamp: string,
) {
  const rows = await fetchAllExportRows(
    supabase,
    'opc_job_overview',
    [
      'title',
      'job_type',
      'status',
      'priority',
      'planned_start',
      'planned_end',
      'actual_start',
      'actual_end',
      'service_category',
      'estimated_hours',
      'final_hours',
      'billable_amount',
      'currency',
      'report_required',
      'report_approved',
      'report_approved_at',
      'job_created_at',
      'billing_name',
      'full_name',
      'company_name',
      'email',
      'phone_e164',
      'site_name',
      'site_type',
      'address_text',
      'postal_code',
      'city',
      'assignment_count',
      'media_count',
      'damage_count',
      'report_status',
      'report_total_hours',
    ].join(','),
    'job_created_at',
  );

  return [
    createExportFile(
      `Orange_Pro_Clean_Einsaetze_${stamp}.csv`,
      rows,
      [
        { header: 'Einsatz', value: (r) => r.title },
        { header: 'Einsatzart', value: (r) => r.job_type },
        { header: 'Status', value: (r) => r.status },
        { header: 'Priorität', value: (r) => r.priority },
        { header: 'Leistung', value: (r) => r.service_category },
        { header: 'Geplanter Start', value: (r) => formatDateTime(r.planned_start) },
        { header: 'Geplantes Ende', value: (r) => formatDateTime(r.planned_end) },
        { header: 'Tatsächlicher Start', value: (r) => formatDateTime(r.actual_start) },
        { header: 'Tatsächliches Ende', value: (r) => formatDateTime(r.actual_end) },
        { header: 'Geschätzte Stunden', value: (r) => formatNumber(r.estimated_hours) },
        { header: 'Endgültige Stunden', value: (r) => formatNumber(r.final_hours) },
        { header: 'Verrechenbarer Betrag', value: (r) => formatMoney(r.billable_amount) },
        { header: 'Währung', value: (r) => r.currency },
        { header: 'Kunde', value: (r) => r.billing_name || r.company_name || r.full_name },
        { header: 'E-Mail', value: (r) => r.email },
        { header: 'Telefon', value: (r) => r.phone_e164 },
        { header: 'Standort', value: (r) => r.site_name },
        { header: 'Standortart', value: (r) => r.site_type },
        { header: 'Adresse', value: (r) => r.address_text },
        { header: 'PLZ', value: (r) => r.postal_code },
        { header: 'Ort', value: (r) => r.city },
        { header: 'Mitarbeiterzuweisungen', value: (r) => r.assignment_count },
        { header: 'Medien', value: (r) => r.media_count },
        { header: 'Schäden', value: (r) => r.damage_count },
        { header: 'Bericht erforderlich', value: (r) => yesNo(r.report_required) },
        { header: 'Bericht freigegeben', value: (r) => yesNo(r.report_approved) },
        { header: 'Berichtsstatus', value: (r) => r.report_status },
        { header: 'Bericht Stunden', value: (r) => formatNumber(r.report_total_hours) },
        { header: 'Erstellt am', value: (r) => formatDateTime(r.job_created_at) },
      ],
    ),
  ];
}

async function buildInspectionFiles(
  supabase: any,
  stamp: string,
) {
  const clients = await getClientDirectory(supabase);

  const rows = await fetchAllExportRows(
    supabase,
    'opc_site_inspections',
    [
      'inspection_number',
      'client_id',
      'status',
      'inspection_type',
      'requested_service_category',
      'property_type',
      'property_size_m2',
      'room_count',
      'bathroom_count',
      'floor_level',
      'has_elevator',
      'access_notes',
      'parking_notes',
      'key_handover_notes',
      'property_condition_notes',
      'risk_notes',
      'estimator_notes',
      'internal_notes',
      'estimated_hours',
      'estimated_staff_count',
      'scheduled_at',
      'started_at',
      'completed_at',
      'created_at',
    ].join(','),
    'created_at',
  );

  return [
    createExportFile(
      `Orange_Pro_Clean_Besichtigungen_${stamp}.csv`,
      rows,
      [
        { header: 'Besichtigungsnummer', value: (r) => r.inspection_number },
        { header: 'Kunde', value: (r) => clientName(clients, r.client_id) },
        { header: 'Status', value: (r) => r.status },
        { header: 'Besichtigungsart', value: (r) => r.inspection_type },
        { header: 'Gewünschte Leistung', value: (r) => r.requested_service_category },
        { header: 'Objektart', value: (r) => r.property_type },
        { header: 'Fläche m²', value: (r) => formatNumber(r.property_size_m2) },
        { header: 'Zimmer', value: (r) => formatNumber(r.room_count) },
        { header: 'Badezimmer', value: (r) => r.bathroom_count },
        { header: 'Etage', value: (r) => r.floor_level },
        { header: 'Lift vorhanden', value: (r) => yesNo(r.has_elevator) },
        { header: 'Zugangshinweise', value: (r) => r.access_notes },
        { header: 'Parkhinweise', value: (r) => r.parking_notes },
        { header: 'Schlüsselübergabe', value: (r) => r.key_handover_notes },
        { header: 'Objektzustand', value: (r) => r.property_condition_notes },
        { header: 'Risiken', value: (r) => r.risk_notes },
        { header: 'Schätzungsnotizen', value: (r) => r.estimator_notes },
        { header: 'Interne Notizen', value: (r) => r.internal_notes },
        { header: 'Geschätzte Stunden', value: (r) => formatNumber(r.estimated_hours) },
        { header: 'Geschätzte Mitarbeitende', value: (r) => r.estimated_staff_count },
        { header: 'Geplant am', value: (r) => formatDateTime(r.scheduled_at) },
        { header: 'Gestartet am', value: (r) => formatDateTime(r.started_at) },
        { header: 'Abgeschlossen am', value: (r) => formatDateTime(r.completed_at) },
        { header: 'Erstellt am', value: (r) => formatDateTime(r.created_at) },
      ],
    ),
  ];
}

async function buildInquiryFiles(
  supabase: any,
  stamp: string,
) {
  const rows = await fetchAllExportRows(
    supabase,
    'opc_inquiry_overview',
    [
      'status',
      'inquiry_type',
      'source_channel',
      'source_form_name',
      'service_category',
      'requested_date',
      'address_text',
      'postal_code',
      'city',
      'original_message',
      'message_summary',
      'inquiry_created_at',
      'full_name',
      'company_name',
      'email',
      'phone_raw',
      'phone_e164',
      'lifecycle_stage',
      'thread_subject',
      'thread_status',
    ].join(','),
    'inquiry_created_at',
  );

  return [
    createExportFile(
      `Orange_Pro_Clean_Anfragen_${stamp}.csv`,
      rows,
      [
        { header: 'Status', value: (r) => r.status },
        { header: 'Anfrageart', value: (r) => r.inquiry_type },
        { header: 'Quelle', value: (r) => r.source_channel },
        { header: 'Formular', value: (r) => r.source_form_name },
        { header: 'Leistung', value: (r) => r.service_category },
        { header: 'Gewünschtes Datum', value: (r) => r.requested_date },
        { header: 'Name', value: (r) => r.full_name },
        { header: 'Firma', value: (r) => r.company_name },
        { header: 'E-Mail', value: (r) => r.email },
        { header: 'Telefon', value: (r) => r.phone_e164 || r.phone_raw },
        { header: 'Adresse', value: (r) => r.address_text },
        { header: 'PLZ', value: (r) => r.postal_code },
        { header: 'Ort', value: (r) => r.city },
        { header: 'Nachricht', value: (r) => r.original_message },
        { header: 'Zusammenfassung', value: (r) => r.message_summary },
        { header: 'Lebenszyklus', value: (r) => r.lifecycle_stage },
        { header: 'Konversation', value: (r) => r.thread_subject },
        { header: 'Konversationsstatus', value: (r) => r.thread_status },
        { header: 'Erstellt am', value: (r) => formatDateTime(r.inquiry_created_at) },
      ],
    ),
  ];
}

async function buildTicketFiles(
  supabase: any,
  stamp: string,
) {
  const rows = await fetchAllExportRows(
    supabase,
    'opc_tickets',
    [
      'ticket_number',
      'source',
      'status',
      'priority',
      'category',
      'title',
      'description',
      'reporter_name',
      'reporter_email',
      'reporter_phone',
      'assigned_team',
      'assigned_to_name',
      'resolved_at',
      'closed_at',
      'site_name',
      'address_text',
      'postal_code',
      'city',
      'country',
      'facility_name',
      'floor',
      'area_type',
      'created_at',
      'updated_at',
    ].join(','),
    'created_at',
  );

  return [
    createExportFile(
      `Orange_Pro_Clean_Tickets_Schaeden_${stamp}.csv`,
      rows,
      [
        { header: 'Ticketnummer', value: (r) => r.ticket_number },
        { header: 'Quelle', value: (r) => r.source },
        { header: 'Status', value: (r) => r.status },
        { header: 'Priorität', value: (r) => r.priority },
        { header: 'Kategorie', value: (r) => r.category },
        { header: 'Titel', value: (r) => r.title },
        { header: 'Beschreibung', value: (r) => r.description },
        { header: 'Gemeldet von', value: (r) => r.reporter_name },
        { header: 'E-Mail', value: (r) => r.reporter_email },
        { header: 'Telefon', value: (r) => r.reporter_phone },
        { header: 'Zugewiesenes Team', value: (r) => r.assigned_team },
        { header: 'Zugewiesen an', value: (r) => r.assigned_to_name },
        { header: 'Standort', value: (r) => r.site_name },
        { header: 'Adresse', value: (r) => r.address_text },
        { header: 'PLZ', value: (r) => r.postal_code },
        { header: 'Ort', value: (r) => r.city },
        { header: 'Land', value: (r) => r.country },
        { header: 'Bereich', value: (r) => r.facility_name },
        { header: 'Etage', value: (r) => r.floor },
        { header: 'Flächenart', value: (r) => r.area_type },
        { header: 'Gelöst am', value: (r) => formatDateTime(r.resolved_at) },
        { header: 'Geschlossen am', value: (r) => formatDateTime(r.closed_at) },
        { header: 'Erstellt am', value: (r) => formatDateTime(r.created_at) },
        { header: 'Aktualisiert am', value: (r) => formatDateTime(r.updated_at) },
      ],
    ),
  ];
}

export async function buildOpcDataExportFiles(
  supabase: any,
  scope: OpcDataExportScope,
): Promise<OpcExportFile[]> {
  const stamp = exportDate();

  if (scope === 'all') {
    const scopes: OpcDataExportScope[] = [
      'clients',
      'quotes',
      'invoices',
      'employees',
      'time',
      'payroll',
      'jobs',
      'inspections',
      'inquiries',
      'tickets',
    ];

    const files: OpcExportFile[] = [];

    for (const currentScope of scopes) {
      files.push(
        ...(await buildOpcDataExportFiles(
          supabase,
          currentScope,
        )),
      );
    }

    return files;
  }

  if (scope === 'finance') {
    return [
      ...(await buildQuoteFiles(supabase, stamp)),
      ...(await buildInvoiceFiles(supabase, stamp)),
      ...(await buildPayrollFiles(supabase, stamp)),
    ];
  }

  if (scope === 'clients')
    return buildClientFiles(supabase, stamp);

  if (scope === 'quotes')
    return buildQuoteFiles(supabase, stamp);

  if (scope === 'invoices')
    return buildInvoiceFiles(supabase, stamp);

  if (scope === 'employees')
    return buildEmployeeFiles(supabase, stamp);

  if (scope === 'time')
    return buildTimeFiles(supabase, stamp);

  if (scope === 'payroll')
    return buildPayrollFiles(supabase, stamp);

  if (scope === 'jobs')
    return buildJobFiles(supabase, stamp);

  if (scope === 'inspections')
    return buildInspectionFiles(supabase, stamp);

  if (scope === 'inquiries')
    return buildInquiryFiles(supabase, stamp);

  if (scope === 'tickets')
    return buildTicketFiles(supabase, stamp);

  return [];
}
