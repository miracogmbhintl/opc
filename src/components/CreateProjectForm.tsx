import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import MirakaDashboardShell from './MirakaDashboardShell';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';

interface ClientOption {
  client_id: string;
  contact_id?: string | null;
  billing_name?: string | null;
  company_name?: string | null;
  full_name?: string | null;
  billing_email?: string | null;
  billing_phone_e164?: string | null;
  primary_site_id?: string | null;
  primary_site_name?: string | null;
  primary_site_address?: string | null;
  primary_site_postal_code?: string | null;
  primary_site_city?: string | null;
}

interface SiteOption {
  id: string;
  client_id: string;
  contact_id?: string | null;
  site_name?: string | null;
  site_type?: string | null;
  address_text?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  access_notes?: string | null;
  cleaning_notes?: string | null;
  billing_notes?: string | null;
  service_requirements?: unknown;
  metadata?: Record<string, unknown> | null;
}

interface EmployeeOption {
  id: string;
  source?: 'employee' | 'staff' | string;
  user_id?: string | null;
  employee_id?: string | null;
  staff_role_id?: string | null;
  employee_number?: string | null;
  display_name?: string | null;
  email?: string | null;
  phone_e164?: string | null;
  phone_raw?: string | null;
  whatsapp_wa_id?: string | null;
  role?: string | null;
  status?: string | null;
  assignment_status?: string | null;
}

type RecurrenceType = 'none' | 'daily' | 'weekdays' | 'monthly_count';
type PeriodPreset = '3_months' | '6_months' | '12_months' | 'custom';

interface FormState {
  clientId: string;
  clientSiteId: string;
  serviceCategory: string;
  customServiceCategory: string;
  plannedDate: string;
  startTime: string;
  endTime: string;
  status: string;
  priority: string;
  estimatedHours: string;
  dispatcherNotes: string;
  internalNotes: string;
  clientNotes: string;
  serviceDescription: string;
  reportRequired: boolean;
  recurrenceType: RecurrenceType;
  recurrenceWeekdays: number[];
  monthlyCount: string;
  periodPreset: PeriodPreset;
  customEndDate: string;
  assignedEmployeeIds: string[];
  assignmentNote: string;
}

interface QuoteJobPrefill {
  source?: string;
  quote_id?: string;
  quote_number?: string;
  order_confirmation_id?: string;
  client_id?: string;
  client_site_id?: string;
  contact_id?: string;
  title?: string;
  service_category?: string;
  service_description?: string;
  estimated_hours?: string | number;
  estimated_staff_count?: string | number;
  dispatcher_notes?: string;
  internal_notes?: string;
  total_chf?: string | number;
}

const serviceOptions = [
  'Allgemeine Reinigung',
  'Treppenhausreinigung',
  'Fensterreinigung',
  'Endreinigung',
  'Büroreinigung',
  'Unterhaltsreinigung',
  'Spezialreinigung',
  'Andere',
];

const statusOptions = [
  { value: 'scheduled', label: 'Geplant' },
  { value: 'assigned', label: 'Zugewiesen' },
];

const priorityOptions = [
  { value: 'low', label: 'Niedrig' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Hoch' },
];

const weekdayOptions = [
  { value: 1, label: 'Mo' },
  { value: 2, label: 'Di' },
  { value: 3, label: 'Mi' },
  { value: 4, label: 'Do' },
  { value: 5, label: 'Fr' },
  { value: 6, label: 'Sa' },
  { value: 7, label: 'So' },
];

const periodOptions: { value: PeriodPreset; label: string }[] = [
  { value: '3_months', label: '3 Monate' },
  { value: '6_months', label: '6 Monate' },
  { value: '12_months', label: '12 Monate' },
  { value: 'custom', label: 'Eigenes Enddatum' },
];

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  black: '#0F1115',
  card: '#FFFFFF',
  soft: '#FAFAFA',
  green: '#166534',
  red: '#B91C1C',
};

const cardStyle: CSSProperties = {
  background: BRAND.card,
  border: `1px solid ${BRAND.border}`,
  borderRadius: '20px',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: '44px',
  border: `1px solid ${BRAND.border}`,
  borderRadius: '14px',
  padding: '10px 12px',
  fontSize: '14px',
  fontWeight: 620,
  color: BRAND.text,
  outline: 'none',
  fontFamily: pageFont,
  background: '#FFFFFF',
  boxSizing: 'border-box',
};

const textareaStyle: CSSProperties = {
  width: '100%',
  minHeight: '110px',
  border: `1px solid ${BRAND.border}`,
  borderRadius: '14px',
  padding: '10px 12px',
  fontSize: '14px',
  fontWeight: 620,
  color: BRAND.text,
  outline: 'none',
  fontFamily: pageFont,
  background: '#FFFFFF',
  resize: 'vertical',
  boxSizing: 'border-box',
  lineHeight: 1.5,
};

function todayInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const local = new Date(today.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function createInitialFormState(): FormState {
  return {
    clientId: '',
    clientSiteId: '',
    serviceCategory: 'Allgemeine Reinigung',
    customServiceCategory: '',
    plannedDate: todayInputValue(),
    startTime: '08:00',
    endTime: '10:00',
    status: 'scheduled',
    priority: 'normal',
    estimatedHours: '2',
    dispatcherNotes: '',
    internalNotes: '',
    clientNotes: '',
    serviceDescription: '',
    reportRequired: true,
    recurrenceType: 'none',
    recurrenceWeekdays: [1, 2, 3, 4, 5],
    monthlyCount: '1',
    periodPreset: '3_months',
    customEndDate: '',
    assignedEmployeeIds: [],
    assignmentNote: '',
  };
}

function toDateTime(date: string, time: string) {
  if (!date || !time) return null;
  return new Date(`${date}T${time}:00`).toISOString();
}

function addMinutesToTime(time: string, minutes: number) {
  if (!time || !Number.isFinite(minutes)) return time;

  const [hourRaw, minuteRaw] = time.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time;

  const date = new Date(2000, 0, 1, hour, minute, 0, 0);
  date.setMinutes(date.getMinutes() + minutes);

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getPeriodEndDate(startDate: string, preset: PeriodPreset, customEndDate: string) {
  if (!startDate) return '';
  if (preset === 'custom') return customEndDate;

  const months = preset === '3_months' ? 3 : preset === '6_months' ? 6 : 12;
  const date = new Date(`${startDate}T00:00:00`);

  if (Number.isNaN(date.getTime())) return '';

  date.setMonth(date.getMonth() + months);
  date.setDate(date.getDate() - 1);

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function getClientName(client?: ClientOption | null) {
  if (!client) return '';
  return client.billing_name || client.company_name || client.full_name || 'Unbekannter Kunde';
}

function getSiteName(site?: SiteOption | null) {
  if (!site) return '';
  return site.site_name || site.address_text || 'Standort ohne Namen';
}

function getSiteAddress(site?: SiteOption | null) {
  if (!site) return '';

  return [site.address_text, site.postal_code, site.city, site.country]
    .filter(Boolean)
    .join(', ');
}

function getSiteLabel(site?: SiteOption | null) {
  if (!site) return '';

  const name = getSiteName(site);
  const address = getSiteAddress(site);

  return address ? `${name} · ${address}` : name;
}

function getFallbackPrimarySite(client?: ClientOption | null): SiteOption | null {
  if (!client?.primary_site_id) return null;

  return {
    id: client.primary_site_id,
    client_id: client.client_id,
    contact_id: client.contact_id || null,
    site_name: client.primary_site_name || getClientName(client),
    address_text: client.primary_site_address || null,
    postal_code: client.primary_site_postal_code || null,
    city: client.primary_site_city || null,
    country: 'Schweiz',
  };
}

function normalize(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function cleanSourceId(value: unknown) {
  const text = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : '';
}

function readQuoteJobPrefill(): QuoteJobPrefill | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  let stored: QuoteJobPrefill = {};

  try {
    const raw = window.localStorage.getItem('opc_quote_job_prefill');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        stored = parsed as QuoteJobPrefill;
      }
    }
  } catch {
    stored = {};
  }

  const quoteId = cleanSourceId(params.get('quote_id') || stored.quote_id);
  const orderConfirmationId = cleanSourceId(
    params.get('order_confirmation_id') || stored.order_confirmation_id,
  );
  const clientId = cleanSourceId(params.get('client_id') || stored.client_id);
  const clientSiteId = cleanSourceId(
    params.get('client_site_id') || stored.client_site_id,
  );
  const contactId = cleanSourceId(params.get('contact_id') || stored.contact_id);

  if (!quoteId && !clientId) return null;

  return {
    ...stored,
    quote_id: quoteId || undefined,
    order_confirmation_id: orderConfirmationId || undefined,
    client_id: clientId || undefined,
    client_site_id: clientSiteId || undefined,
    contact_id: contactId || undefined,
  };
}

function getEmployeeName(employee?: EmployeeOption | null) {
  if (!employee) return 'Mitarbeiter';
  return employee.display_name || employee.email || employee.phone_e164 || employee.phone_raw || 'Mitarbeiter';
}

function FieldLabel({ children, required = false }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="opc-field-label">
      {children}
      {required && <span> *</span>}
    </label>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="opc-plan-card" style={cardStyle}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function CreateProjectForm() {
  const [form, setForm] = useState<FormState>(() => createInitialFormState());
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingSites, setLoadingSites] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [successJobId, setSuccessJobId] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number>(0);
  const [successWarnings, setSuccessWarnings] = useState<string[]>([]);
  const [endTimeTouched, setEndTimeTouched] = useState(false);
  const [sourceQuoteId, setSourceQuoteId] = useState('');
  const [sourceQuoteNumber, setSourceQuoteNumber] = useState('');
  const [sourceOrderConfirmationId, setSourceOrderConfirmationId] = useState('');
  const [sourceContactId, setSourceContactId] = useState('');
  const [requestedSiteId, setRequestedSiteId] = useState('');

  useEffect(() => {
    void loadClients();
    void loadEmployees();
  }, []);

  useEffect(() => {
    const prefill = readQuoteJobPrefill();
    if (!prefill) return;

    const serviceCategory = String(prefill.service_category || '').trim();
    const isKnownService = serviceOptions.includes(serviceCategory);
    const estimatedHours = String(prefill.estimated_hours ?? '').trim();

    setSourceQuoteId(cleanSourceId(prefill.quote_id));
    setSourceQuoteNumber(String(prefill.quote_number || '').trim());
    setSourceOrderConfirmationId(cleanSourceId(prefill.order_confirmation_id));
    setSourceContactId(cleanSourceId(prefill.contact_id));
    setRequestedSiteId(cleanSourceId(prefill.client_site_id));

    setForm((current) => ({
      ...current,
      clientId: cleanSourceId(prefill.client_id) || current.clientId,
      clientSiteId: cleanSourceId(prefill.client_site_id) || current.clientSiteId,
      serviceCategory: serviceCategory
        ? (isKnownService ? serviceCategory : 'Andere')
        : current.serviceCategory,
      customServiceCategory: serviceCategory && !isKnownService
        ? serviceCategory
        : current.customServiceCategory,
      serviceDescription: String(prefill.service_description || current.serviceDescription || ''),
      estimatedHours: estimatedHours || current.estimatedHours,
      dispatcherNotes: String(prefill.dispatcher_notes || current.dispatcherNotes || ''),
      internalNotes: String(prefill.internal_notes || current.internalNotes || ''),
    }));
  }, []);

  useEffect(() => {
    if (!form.clientId) {
      setSites([]);
      setForm((current) => ({ ...current, clientSiteId: '' }));
      return;
    }

    void loadClientSites(form.clientId);
  }, [form.clientId, requestedSiteId]);

  useEffect(() => {
    if (endTimeTouched) return;

    const hours = Number(String(form.estimatedHours || '').replace(',', '.'));
    if (!Number.isFinite(hours) || hours <= 0) return;

    const nextEndTime = addMinutesToTime(form.startTime, Math.round(hours * 60));
    setForm((current) => ({ ...current, endTime: nextEndTime }));
  }, [endTimeTouched, form.estimatedHours, form.startTime]);

  const selectedClient = useMemo(() => {
    return clients.find((client) => client.client_id === form.clientId) || null;
  }, [clients, form.clientId]);

  const selectedSite = useMemo(() => {
    return sites.find((site) => site.id === form.clientSiteId) || null;
  }, [sites, form.clientSiteId]);

  const selectedEmployees = useMemo(() => {
    const ids = new Set(form.assignedEmployeeIds);
    return employees.filter((employee) => ids.has(employee.id));
  }, [employees, form.assignedEmployeeIds]);

  const finalServiceCategory =
    form.serviceCategory === 'Andere'
      ? form.customServiceCategory.trim()
      : form.serviceCategory;

  const computedEndDate = useMemo(
    () => getPeriodEndDate(form.plannedDate, form.periodPreset, form.customEndDate),
    [form.customEndDate, form.periodPreset, form.plannedDate],
  );

  const isRecurring = form.recurrenceType !== 'none';

  async function loadClients() {
    setLoadingClients(true);
    setDatabaseError(null);

    try {
      const { data, error } = await supabase
        .from('opc_client_overview')
        .select(
          `
          client_id,
          contact_id,
          billing_name,
          company_name,
          full_name,
          billing_email,
          billing_phone_e164,
          primary_site_id,
          primary_site_name,
          primary_site_address,
          primary_site_postal_code,
          primary_site_city
        `,
        )
        .order('billing_name', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      setClients((data || []) as ClientOption[]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Kunden konnten nicht geladen werden.';

      setDatabaseError(`Database error: ${message}`);
      setClients([]);
    } finally {
      setLoadingClients(false);
    }
  }

  async function loadEmployees() {
    setLoadingEmployees(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Sitzung ist abgelaufen.');
      }

      const response = await fetch(
        `${baseUrl}/api/opc/assignment-candidates`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: 'no-store',
        },
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            'Mitarbeiter konnten nicht geladen werden.',
        );
      }

      setEmployees(
        Array.isArray(payload?.candidates)
          ? (payload.candidates as EmployeeOption[])
          : [],
      );
    } catch (error) {
      console.error(
        '[CreateProjectForm] assignment candidates failed',
        error,
      );
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  }

  async function loadClientSites(clientId: string) {
    setLoadingSites(true);
    setDatabaseError(null);
    setSites([]);
    setForm((current) => ({ ...current, clientSiteId: '' }));

    try {
      const { data, error } = await supabase
        .from('opc_client_sites')
        .select('*')
        .eq('client_id', clientId)
        .order('site_name', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      const loadedSites = ((data || []) as SiteOption[]).filter((site) => site.id);

      if (loadedSites.length > 0) {
        const requestedSite = requestedSiteId
          ? loadedSites.find((site) => site.id === requestedSiteId)
          : null;
        const selectedSiteId = requestedSite?.id || loadedSites[0].id;

        setSites(loadedSites);
        setForm((current) => ({
          ...current,
          clientSiteId: selectedSiteId,
        }));
        return;
      }

      const clientForFallback = clients.find((client) => client.client_id === clientId) || null;
      const fallbackSite = getFallbackPrimarySite(clientForFallback);

      if (fallbackSite) {
        setSites([fallbackSite]);
        setForm((current) => ({
          ...current,
          clientSiteId: fallbackSite.id,
        }));
        return;
      }

      setSites([]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Standorte konnten nicht geladen werden.';

      setDatabaseError(`Database error: ${message}`);
      setSites([]);
    } finally {
      setLoadingSites(false);
    }
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleWeekday(day: number) {
    setForm((current) => {
      const exists = current.recurrenceWeekdays.includes(day);
      const next = exists
        ? current.recurrenceWeekdays.filter((item) => item !== day)
        : [...current.recurrenceWeekdays, day].sort((a, b) => a - b);

      return { ...current, recurrenceWeekdays: next };
    });
  }

  function toggleEmployee(employeeId: string) {
    setForm((current) => {
      const exists = current.assignedEmployeeIds.includes(employeeId);
      const next = exists
        ? current.assignedEmployeeIds.filter((id) => id !== employeeId)
        : [...current.assignedEmployeeIds, employeeId];

      return {
        ...current,
        assignedEmployeeIds: next,
        status: next.length > 0 && current.status === 'scheduled' ? 'assigned' : current.status,
      };
    });
  }

  function validateForm() {
    if (!form.clientId) return 'Bitte wählen Sie einen Kunden aus.';
    if (!form.clientSiteId) return 'Bitte wählen Sie einen Standort aus.';
    if (!finalServiceCategory) return 'Bitte wählen oder erfassen Sie eine Dienstleistung.';
    if (!form.plannedDate) return 'Bitte erfassen Sie ein Datum.';
    if (!form.startTime) return 'Bitte erfassen Sie eine Startzeit.';
    if (!form.endTime) return 'Bitte erfassen Sie eine Endzeit.';

    const plannedStart = toDateTime(form.plannedDate, form.startTime);
    const plannedEnd = toDateTime(form.plannedDate, form.endTime);

    if (!plannedStart || !plannedEnd) {
      return 'Datum oder Zeit ist ungültig.';
    }

    if (new Date(plannedEnd).getTime() <= new Date(plannedStart).getTime()) {
      return 'Die Endzeit muss nach der Startzeit liegen.';
    }

    if (isRecurring) {
      if (!computedEndDate) return 'Bitte erfassen Sie ein Enddatum für den wiederkehrenden Einsatz.';

      const start = new Date(`${form.plannedDate}T00:00:00`).getTime();
      const end = new Date(`${computedEndDate}T00:00:00`).getTime();

      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
        return 'Das Enddatum der Wiederholung muss nach dem Startdatum liegen.';
      }

      if (form.recurrenceType === 'weekdays' && form.recurrenceWeekdays.length === 0) {
        return 'Bitte wählen Sie mindestens einen Wochentag aus.';
      }

      if (form.recurrenceType === 'monthly_count') {
        const count = Number(form.monthlyCount);
        if (!Number.isFinite(count) || count < 1 || count > 4) {
          return 'Die monatliche Anzahl muss zwischen 1 und 4 liegen.';
        }
      }
    }

    return null;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setDatabaseError(null);
    setSuccessJobId(null);
    setSuccessCount(0);
    setSuccessWarnings([]);

    const validationError = validateForm();

    if (validationError) {
      setDatabaseError(validationError);
      return;
    }

    if (!selectedClient) {
      setDatabaseError('Der ausgewählte Kunde konnte nicht gefunden werden.');
      return;
    }

    if (!selectedSite) {
      setDatabaseError('Der ausgewählte Standort konnte nicht gefunden werden.');
      return;
    }

    const plannedStart = toDateTime(form.plannedDate, form.startTime);
    const plannedEnd = toDateTime(form.plannedDate, form.endTime);

    if (!plannedStart || !plannedEnd) {
      setDatabaseError('Datum oder Zeit ist ungültig.');
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.');
      }

      const title = `${finalServiceCategory} · ${getClientName(selectedClient)}`;

      const payload = {
        quote_id: sourceQuoteId || null,
        order_confirmation_id: sourceOrderConfirmationId || null,
        client_id: selectedClient.client_id,
        client_site_id: selectedSite.id,
        contact_id: sourceContactId || selectedSite.contact_id || selectedClient.contact_id || null,
        title,
        job_type: isRecurring ? 'recurring' : 'one_time',
        status: form.assignedEmployeeIds.length > 0 ? 'assigned' : form.status,
        priority: form.priority,
        planned_date: form.plannedDate,
        start_time: form.startTime,
        end_time: form.endTime,
        planned_start: plannedStart,
        planned_end: plannedEnd,
        service_category: finalServiceCategory,
        service_description: form.serviceDescription || null,
        estimated_hours: Number(form.estimatedHours || 0),
        dispatcher_notes: form.dispatcherNotes || null,
        internal_notes: form.internalNotes || null,
        client_notes: form.clientNotes || null,
        report_required: form.reportRequired,
        assigned_employee_ids: form.assignedEmployeeIds,
        assignment_note: form.assignmentNote || null,
        recurrence: {
          enabled: isRecurring,
          type: form.recurrenceType,
          start_date: form.plannedDate,
          end_date: isRecurring ? computedEndDate : form.plannedDate,
          weekdays: form.recurrenceWeekdays,
          monthly_count: Number(form.monthlyCount || 1),
          period_preset: form.periodPreset,
        },
        metadata: {
          source: 'portal_einsatz_planen',
          created_from: 'CreateProjectForm',
          selected_site_id: selectedSite.id,
          selected_site_label: getSiteLabel(selectedSite),
          selected_site_address: getSiteAddress(selectedSite),
          recurrence_enabled: isRecurring,
          recurrence_type: form.recurrenceType,
          quote_id: sourceQuoteId || null,
          source_quote_id: sourceQuoteId || null,
          source_quote_number: sourceQuoteNumber || null,
          order_confirmation_id: sourceOrderConfirmationId || null,
          created_from_quote: Boolean(sourceQuoteId),
        },
      };

      const response = await fetch(`${baseUrl}/api/opc/create-service-job`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        job_id?: string;
        job_ids?: string[];
        created_count?: number;
        assigned_employee_count?: number;
        warnings?: string[];
        assignment_sync?: {
          requested_employee_count?: number;
          created?: number;
          failed?: number;
          errors?: Array<{ error?: string }>;
        };
        calendar_sync?: {
          failed?: number;
          errors?: Array<{ error?: string }>;
        };
      };

      if (!response.ok) {
        throw new Error(result.error || 'Der Einsatz konnte nicht erstellt werden.');
      }

      const jobId = result.job_id || result.job_ids?.[0] || null;

      if (!jobId) {
        throw new Error('Der Einsatz wurde erstellt, aber keine Einsatz-ID wurde zurückgegeben.');
      }

      setSuccessJobId(jobId);
      setSuccessCount(result.created_count || result.job_ids?.length || 1);
      setSuccessWarnings(
        Array.isArray(result.warnings)
          ? result.warnings.map(String).filter(Boolean)
          : [],
      );

      try {
        window.localStorage.removeItem('opc_quote_job_prefill');
      } catch {
        // localStorage can be unavailable without affecting the created job.
      }

      setSourceQuoteId('');
      setSourceQuoteNumber('');
      setSourceOrderConfirmationId('');
      setSourceContactId('');
      setRequestedSiteId('');
      setForm(createInitialFormState());
      setSites([]);
      setEndTimeTouched(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Der Einsatz konnte nicht erstellt werden.';

      setDatabaseError(`Database error: ${message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <MirakaDashboardShell
      requiredRole={['owner', 'admin', 'dispatch']}
      currentPath="/einsatz-planen"
      hideTopBar={true}
      fullWidth={true}
    >
      <div className="opc-create-page" style={{ fontFamily: pageFont }}>
        <a href={`${baseUrl}/einsaetze`} className="opc-back-link">
          ← Zurück zu Einsätze
        </a>

        {databaseError && (
          <div className="opc-plan-error">
            {databaseError}
          </div>
        )}

        {successJobId && (
          <div className="opc-plan-message">
            <span>
              {successCount > 1
                ? `${successCount} Einsätze wurden erstellt.`
                : 'Der Einsatz wurde erstellt.'}
            </span>

            <a href={`${baseUrl}/einsatz/${successJobId}`}>
              Ersten Einsatz öffnen
            </a>

            {successWarnings.length > 0 ? (
              <div
                style={{
                  marginTop: 10,
                  color: '#92400E',
                  fontSize: 13,
                  fontWeight: 650,
                }}
              >
                {successWarnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        <form onSubmit={handleSubmit} className="opc-create-form">
          <Card title="Kunde und Standort">
            <div className="opc-customer-grid">
              <div>
                <FieldLabel required>Kunde</FieldLabel>
                <select
                  value={form.clientId}
                  onChange={(event) => {
                    updateField('clientId', event.target.value);
                    updateField('clientSiteId', '');
                  }}
                  disabled={loadingClients}
                  style={inputStyle}
                >
                  <option value="">
                    {loadingClients ? 'Kunden werden geladen...' : 'Kunden auswählen'}
                  </option>

                  {clients.map((client) => (
                    <option key={client.client_id} value={client.client_id}>
                      {getClientName(client)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel required>Standort</FieldLabel>
                <select
                  value={form.clientSiteId}
                  onChange={(event) => updateField('clientSiteId', event.target.value)}
                  disabled={!form.clientId || loadingSites || sites.length === 0}
                  style={inputStyle}
                >
                  <option value="">
                    {!form.clientId
                      ? 'Zuerst Kunden auswählen'
                      : loadingSites
                        ? 'Standorte werden geladen...'
                        : sites.length === 0
                          ? 'Keine Standorte vorhanden'
                          : 'Standort auswählen'}
                  </option>

                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {getSiteLabel(site)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="opc-selected-site-box">
              <span>Ausgewählter Standort</span>

              <strong>
                {selectedSite
                  ? getSiteLabel(selectedSite)
                  : form.clientId
                    ? 'Bitte Standort auswählen.'
                    : 'Wählen Sie zuerst einen Kunden aus.'}
              </strong>

              {selectedSite?.access_notes && (
                <p>Zugang: {selectedSite.access_notes}</p>
              )}

              {selectedSite?.cleaning_notes && (
                <p>Reinigung: {selectedSite.cleaning_notes}</p>
              )}
            </div>
          </Card>

          <Card title="Einsatzdaten">
            <div className="opc-einsatzdaten-row two">
              <div>
                <FieldLabel required>Dienstleistung</FieldLabel>
                <select
                  value={form.serviceCategory}
                  onChange={(event) => updateField('serviceCategory', event.target.value)}
                  style={inputStyle}
                >
                  {serviceOptions.map((service) => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel required>Datum</FieldLabel>
                <input
                  type="date"
                  value={form.plannedDate}
                  onChange={(event) => updateField('plannedDate', event.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            {form.serviceCategory === 'Andere' && (
              <div className="opc-einsatzdaten-full">
                <FieldLabel required>Eigene Dienstleistung</FieldLabel>
                <input
                  value={form.customServiceCategory}
                  onChange={(event) => updateField('customServiceCategory', event.target.value)}
                  placeholder="z.B. Praxisreinigung"
                  style={inputStyle}
                />
              </div>
            )}

            <div className="opc-einsatzdaten-row three">
              <div>
                <FieldLabel required>Startzeit</FieldLabel>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(event) => {
                    updateField('startTime', event.target.value);
                    if (!endTimeTouched) {
                      const hours = Number(String(form.estimatedHours || '').replace(',', '.'));
                      if (Number.isFinite(hours) && hours > 0) {
                        updateField('endTime', addMinutesToTime(event.target.value, Math.round(hours * 60)));
                      }
                    }
                  }}
                  style={inputStyle}
                />
              </div>

              <div>
                <FieldLabel required>Endzeit</FieldLabel>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(event) => {
                    setEndTimeTouched(true);
                    updateField('endTime', event.target.value);
                  }}
                  style={inputStyle}
                />
              </div>

              <div>
                <FieldLabel>Geschätzte Stunden</FieldLabel>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={form.estimatedHours}
                  onChange={(event) => {
                    updateField('estimatedHours', event.target.value);
                    if (!endTimeTouched) {
                      const hours = Number(String(event.target.value || '').replace(',', '.'));
                      if (Number.isFinite(hours) && hours > 0) {
                        updateField('endTime', addMinutesToTime(form.startTime, Math.round(hours * 60)));
                      }
                    }
                  }}
                  style={inputStyle}
                />
              </div>
            </div>

            <div className="opc-einsatzdaten-row two">
              <div>
                <FieldLabel>Status</FieldLabel>
                <select
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value)}
                  style={inputStyle}
                >
                  {statusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel>Priorität</FieldLabel>
                <select
                  value={form.priority}
                  onChange={(event) => updateField('priority', event.target.value)}
                  style={inputStyle}
                >
                  {priorityOptions.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="opc-einsatzdaten-full">
              <FieldLabel>Beschreibung</FieldLabel>
              <textarea
                value={form.serviceDescription}
                onChange={(event) => updateField('serviceDescription', event.target.value)}
                placeholder="Beschreiben Sie kurz, was vor Ort erledigt werden soll."
                style={textareaStyle}
              />
            </div>
          </Card>

          <Card title="Wiederholung">
            <div className="opc-form-grid-two">
              <div>
                <FieldLabel>Wiederholung</FieldLabel>
                <select
                  value={form.recurrenceType}
                  onChange={(event) => updateField('recurrenceType', event.target.value as RecurrenceType)}
                  style={inputStyle}
                >
                  <option value="none">Keine Wiederholung</option>
                  <option value="daily">Täglich</option>
                  <option value="weekdays">Bestimmte Wochentage</option>
                  <option value="monthly_count">Monatlich nach Anzahl</option>
                </select>
              </div>

              {isRecurring && (
                <>
                  <div>
                    <FieldLabel>Zeitraum</FieldLabel>
                    <select
                      value={form.periodPreset}
                      onChange={(event) => updateField('periodPreset', event.target.value as PeriodPreset)}
                      style={inputStyle}
                    >
                      {periodOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {form.periodPreset === 'custom' ? (
                    <div>
                      <FieldLabel required>Enddatum</FieldLabel>
                      <input
                        type="date"
                        value={form.customEndDate}
                        onChange={(event) => updateField('customEndDate', event.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  ) : (
                    <div>
                      <FieldLabel>Enddatum</FieldLabel>
                      <input value={computedEndDate || '-'} readOnly style={{ ...inputStyle, background: BRAND.soft }} />
                    </div>
                  )}

                  {form.recurrenceType === 'monthly_count' && (
                    <div>
                      <FieldLabel>Häufigkeit pro Monat</FieldLabel>
                      <select
                        value={form.monthlyCount}
                        onChange={(event) => updateField('monthlyCount', event.target.value)}
                        style={inputStyle}
                      >
                        <option value="1">1x monatlich</option>
                        <option value="2">2x monatlich</option>
                        <option value="3">3x monatlich</option>
                        <option value="4">4x monatlich</option>
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>

            {isRecurring && form.recurrenceType === 'weekdays' && (
              <div className="opc-weekday-block">
                <FieldLabel required>Wochentage</FieldLabel>
                <div className="opc-weekday-row">
                  {weekdayOptions.map((day) => {
                    const active = form.recurrenceWeekdays.includes(day.value);

                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleWeekday(day.value)}
                        className={active ? 'opc-choice-pill active' : 'opc-choice-pill'}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {isRecurring && (
              <div className="opc-recurrence-note">
                Jeder generierte Termin wird als eigener Einsatz gespeichert. Dadurch bleiben Fotos, Zeiten, Notizen und Berichte pro Tag getrennt.
              </div>
            )}
          </Card>

          <Card title="Mitarbeiter zuweisen">
            {loadingEmployees ? (
              <div className="opc-empty-box">Mitarbeiter werden geladen...</div>
            ) : employees.length === 0 ? (
              <div className="opc-empty-box">Keine aktiven Mitarbeiter gefunden.</div>
            ) : (
              <div className="opc-employee-grid">
                {employees.map((employee) => {
                  const active = form.assignedEmployeeIds.includes(employee.id);

                  return (
                    <button
                      key={employee.id}
                      type="button"
                      onClick={() => toggleEmployee(employee.id)}
                      className={active ? 'opc-employee-card active' : 'opc-employee-card'}
                    >
                      <span className="opc-employee-avatar">{getEmployeeName(employee).slice(0, 1).toUpperCase()}</span>
                      <span className="opc-employee-copy">
                        <strong>{getEmployeeName(employee)}</strong>
                        <span>{employee.email || employee.phone_e164 || employee.phone_raw || 'Kontakt nicht hinterlegt'}</span>
                      </span>
                      <span className="opc-employee-check">{active ? 'Ausgewählt' : 'Zuweisen'}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedEmployees.length > 0 && (
              <div className="opc-assignment-note">
                <FieldLabel>Zuweisungsnotiz</FieldLabel>
                <textarea
                  value={form.assignmentNote}
                  onChange={(event) => updateField('assignmentNote', event.target.value)}
                  placeholder="Optionale Notiz für die zugewiesenen Mitarbeiter."
                  style={{ ...textareaStyle, minHeight: '86px' }}
                />
              </div>
            )}
          </Card>

          <details className="opc-expandable-card">
            <summary>
              <span>Interne Hinweise</span>
              <strong>Selten benötigt</strong>
            </summary>

            <div className="opc-expandable-body">
              <div>
                <FieldLabel>Dispo-Notizen</FieldLabel>
                <textarea
                  value={form.dispatcherNotes}
                  onChange={(event) => updateField('dispatcherNotes', event.target.value)}
                  placeholder="z.B. Zugang prüfen, Schlüssel bei Empfang abholen, regelmässigen Einsatz abklären."
                  style={textareaStyle}
                />
              </div>

              <div>
                <FieldLabel>Interne Notizen</FieldLabel>
                <textarea
                  value={form.internalNotes}
                  onChange={(event) => updateField('internalNotes', event.target.value)}
                  placeholder="Interne Hinweise für Admin, Disposition oder spätere Bearbeitung."
                  style={textareaStyle}
                />
              </div>

              <div>
                <FieldLabel>Hinweis für Kunde</FieldLabel>
                <textarea
                  value={form.clientNotes}
                  onChange={(event) => updateField('clientNotes', event.target.value)}
                  placeholder="Optionaler Hinweis, der später im Kundenkontext verwendet werden kann."
                  style={textareaStyle}
                />
              </div>

              <label className="opc-checkbox-row">
                <input
                  type="checkbox"
                  checked={form.reportRequired}
                  onChange={(event) => updateField('reportRequired', event.target.checked)}
                />
                Bericht für diesen Einsatz vorbereiten
              </label>
            </div>
          </details>

          <div className="opc-bottom-actions" style={cardStyle}>
            <a href={`${baseUrl}/einsaetze`} className="opc-action-button light">
              Abbrechen
            </a>

            <button
              type="submit"
              disabled={submitting}
              className="opc-action-button dark"
            >
              {submitting
                ? isRecurring
                  ? 'Einsätze werden erstellt...'
                  : 'Wird erstellt...'
                : isRecurring
                  ? 'Wiederkehrende Einsätze erstellen'
                  : 'Einsatz erstellen'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .opc-create-page {
          width: 100%;
          max-width: none;
          margin: 0;
          padding: 0 0 140px;
          color: ${BRAND.text};
        }

        .opc-create-page * {
          box-sizing: border-box;
        }

        .opc-create-page input,
        .opc-create-page select {
          height: 56px !important;
          min-height: 56px !important;
          border-radius: 18px !important;
          font-size: 15px !important;
          font-weight: 720 !important;
          line-height: 1.2 !important;
        }

        .opc-create-page select {
          appearance: none !important;
          -webkit-appearance: none !important;
          background-color: #FFFFFF !important;
          background-image:
            linear-gradient(45deg, transparent 50%, ${BRAND.text} 50%),
            linear-gradient(135deg, ${BRAND.text} 50%, transparent 50%);
          background-position:
            calc(100% - 18px) calc(50% - 4px),
            calc(100% - 18px) calc(50% + 4px);
          background-size:
            7px 7px,
            7px 7px;
          background-repeat: no-repeat;
          padding-right: 42px !important;
        }

        .opc-create-page input[type="date"],
        .opc-create-page input[type="time"],
        .opc-create-page input[type="number"] {
          appearance: none;
          -webkit-appearance: none;
        }


        .opc-back-link {
          display: inline-flex;
          align-items: center;
          height: 34px;
          padding: 0 13px;
          margin-bottom: 12px;
          border: 1px solid ${BRAND.border};
          border-radius: 999px;
          color: ${BRAND.text};
          text-decoration: none;
          font-size: 13px;
          font-weight: 760;
          background: #FFFFFF;
        }

        .opc-create-form {
          display: grid;
          gap: 12px;
        }

        .opc-plan-card,
        .opc-expandable-card,
        .opc-bottom-actions {
          background: #FFFFFF;
          border: 1px solid ${BRAND.border};
          border-radius: 20px;
          box-shadow: 0 1px 2px rgba(15, 17, 21, 0.04);
        }

        .opc-plan-card {
          padding: 16px 18px;
        }

        .opc-plan-card h2 {
          margin: 0 0 14px;
          color: ${BRAND.text};
          font-size: 18px;
          line-height: 1.15;
          letter-spacing: -0.035em;
          font-weight: 840;
        }

        .opc-field-label {
          display: block;
          font-size: 12px;
          font-weight: 760;
          color: #374151;
          margin-bottom: 7px;
          letter-spacing: -0.01em;
        }

        .opc-field-label span {
          color: #D97706;
        }

        .opc-plan-error,
        .opc-plan-message {
          border-radius: 18px;
          padding: 16px 18px;
          font-size: 14px;
          font-weight: 720;
          margin-bottom: 14px;
        }

        .opc-plan-error {
          border: 1px solid #FECACA;
          color: #991B1B;
          background: #FEF2F2;
        }

        .opc-plan-message {
          border: 1px solid #BBF7D0;
          color: #166534;
          background: #F0FDF4;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .opc-plan-message a {
          color: #166534;
          font-weight: 800;
          text-decoration: underline;
        }

        .opc-customer-grid,
        .opc-form-grid-two,
        .opc-einsatzdaten-row.two {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .opc-einsatzdaten-row.three {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .opc-einsatzdaten-row,
        .opc-einsatzdaten-full {
          margin-bottom: 12px;
        }

        .opc-einsatzdaten-full:last-child,
        .opc-einsatzdaten-row:last-child {
          margin-bottom: 0;
        }

        .opc-selected-site-box {
          border: 1px solid #F3F4F6;
          border-radius: 16px;
          background: #FAFAFA;
          padding: 13px 14px;
          margin-top: 12px;
          color: ${BRAND.text};
        }

        .opc-selected-site-box span {
          display: block;
          color: ${BRAND.muted};
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 5px;
        }

        .opc-selected-site-box strong {
          display: block;
          font-size: 13px;
          font-weight: 820;
          color: ${BRAND.text};
          line-height: 1.45;
        }

        .opc-selected-site-box p {
          margin: 6px 0 0;
          color: ${BRAND.muted};
          font-size: 12px;
          font-weight: 650;
          line-height: 1.45;
        }

        .opc-weekday-block,
        .opc-assignment-note {
          margin-top: 18px;
        }

        .opc-weekday-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .opc-choice-pill {
          height: 40px;
          min-width: 52px;
          padding: 0 14px;
          border-radius: 999px;
          border: 1px solid ${BRAND.border};
          background: #FFFFFF;
          color: ${BRAND.text};
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
          font-family: ${pageFont};
        }

        .opc-choice-pill.active {
          background: ${BRAND.black};
          color: #FFFFFF;
          border-color: ${BRAND.black};
        }

        .opc-recurrence-note,
        .opc-empty-box {
          border: 1px solid #F3F4F6;
          background: #FAFAFA;
          border-radius: 16px;
          padding: 14px;
          font-size: 13px;
          color: ${BRAND.muted};
          line-height: 1.5;
          font-weight: 650;
        }

        .opc-recurrence-note {
          margin-top: 18px;
        }

        .opc-employee-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .opc-employee-card {
          width: 100%;
          display: grid;
          grid-template-columns: 42px minmax(0, 1fr) auto;
          gap: 11px;
          align-items: center;
          border: 1px solid ${BRAND.border};
          border-radius: 16px;
          padding: 11px;
          background: #FFFFFF;
          color: ${BRAND.text};
          text-align: left;
          cursor: pointer;
          font-family: ${pageFont};
        }

        .opc-employee-card.active {
          border-color: ${BRAND.black};
          background: #FAFAFA;
        }

        .opc-employee-avatar {
          width: 42px;
          height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: ${BRAND.black};
          color: #FFFFFF;
          font-size: 14px;
          font-weight: 860;
        }

        .opc-employee-copy {
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .opc-employee-copy strong {
          font-size: 14px;
          font-weight: 780;
          color: ${BRAND.text};
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .opc-employee-copy span {
          font-size: 12px;
          font-weight: 650;
          color: ${BRAND.muted};
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .opc-employee-check {
          min-height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 11px;
          border-radius: 999px;
          background: #F3F4F6;
          color: ${BRAND.muted};
          font-size: 12px;
          font-weight: 760;
          white-space: nowrap;
        }

        .opc-employee-card.active .opc-employee-check {
          background: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-expandable-card {
          overflow: hidden;
        }

        .opc-expandable-card summary {
          min-height: 58px;
          padding: 0 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          cursor: pointer;
          list-style: none;
          color: ${BRAND.text};
          font-size: 19px;
          font-weight: 860;
          letter-spacing: -0.035em;
        }

        .opc-expandable-card summary::-webkit-details-marker {
          display: none;
        }

        .opc-expandable-card summary strong {
          color: ${BRAND.muted};
          font-size: 12px;
          font-weight: 760;
          letter-spacing: 0;
        }

        .opc-expandable-card[open] summary {
          border-bottom: 1px solid #F3F4F6;
        }

        .opc-expandable-body {
          display: grid;
          grid-template-columns: 1fr;
          gap: 18px;
          padding: 18px;
        }

        .opc-checkbox-row {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          color: ${BRAND.text};
          font-weight: 650;
          cursor: pointer;
        }

        .opc-checkbox-row input {
          width: 16px;
          height: 16px;
        }

        .opc-bottom-actions {
          padding: 12px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 60px;
        }

        .opc-action-button {
          min-height: 46px;
          padding: 0 18px;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 820;
          font-family: ${pageFont};
          text-decoration: none;
          cursor: pointer;
          border: 1px solid ${BRAND.border};
          white-space: nowrap;
        }

        .opc-action-button.light {
          background: #FFFFFF;
          color: ${BRAND.text};
        }

        .opc-action-button.dark {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-action-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 900px) {
          .opc-create-page {
            padding: 0 0 110px;
          }

          .opc-plan-card {
            padding: 14px;
            border-radius: 18px !important;
          }

          .opc-plan-card h2 {
            font-size: 18px;
          }

          .opc-customer-grid,
          .opc-form-grid-two,
          .opc-employee-grid {
            grid-template-columns: 1fr !important;
          }

          .opc-einsatzdaten-row.two {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .opc-einsatzdaten-row.three {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }

          .opc-einsatzdaten-row.two,
          .opc-einsatzdaten-row.three {
            gap: 8px;
          }

          .opc-einsatzdaten-row.two input,
          .opc-einsatzdaten-row.two select,
          .opc-einsatzdaten-row.three input,
          .opc-einsatzdaten-row.three select {
            height: 52px !important;
            min-height: 52px !important;
            padding-left: 10px !important;
            padding-right: 34px !important;
            font-size: 13px !important;
          }

          .opc-bottom-actions {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            padding: 12px;
          }

          .opc-action-button {
            padding: 0 10px;
            font-size: 13px;
          }

          .opc-employee-card {
            grid-template-columns: 38px minmax(0, 1fr);
          }

          .opc-employee-avatar {
            width: 38px;
            height: 38px;
          }

          .opc-employee-check {
            grid-column: 1 / -1;
            width: 100%;
          }

          .opc-expandable-card summary {
            min-height: 54px;
            padding: 0 14px;
            font-size: 17px;
          }

          .opc-expandable-body {
            padding: 14px;
          }
        }

        @media (max-width: 560px) {
          .opc-einsatzdaten-row.two {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .opc-einsatzdaten-row.three {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }

          .opc-einsatzdaten-row.three .opc-field-label,
          .opc-einsatzdaten-row.two .opc-field-label {
            font-size: 11px;
          }

          .opc-einsatzdaten-row.three input,
          .opc-einsatzdaten-row.three select {
            height: 50px !important;
            min-height: 50px !important;
            font-size: 12px !important;
            padding-left: 8px !important;
            padding-right: 30px !important;
          }
        }
      `}</style>
    </MirakaDashboardShell>
  );
}