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
  user_id?: string | null;
  employee_id?: string | null;
  display_name?: string | null;
  email?: string | null;
  phone_e164?: string | null;
  phone_raw?: string | null;
  whatsapp_wa_id?: string | null;
  role?: string | null;
  status?: string | null;
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

function getEmployeeName(employee?: EmployeeOption | null) {
  if (!employee) return 'Mitarbeiter';
  return employee.display_name || employee.email || employee.phone_e164 || employee.phone_raw || 'Mitarbeiter';
}

function FieldLabel({ children, required = false }: { children: ReactNode; required?: boolean }) {
  return (
    <label
      style={{
        display: 'block',
        fontSize: '13px',
        fontWeight: 700,
        color: '#111111',
        marginBottom: '7px',
      }}
    >
      {children}
      {required && <span style={{ color: '#D97706' }}> *</span>}
    </label>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '22px',
        padding: '26px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        marginBottom: '22px',
      }}
    >
      <h2
        style={{
          margin: '0 0 20px',
          fontSize: '17px',
          fontWeight: 760,
          color: '#111111',
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h2>

      {children}
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  height: '46px',
  border: '1px solid #E5E7EB',
  borderRadius: '12px',
  padding: '0 14px',
  fontSize: '14px',
  color: '#111111',
  outline: 'none',
  fontFamily: 'inherit',
  background: '#FFFFFF',
  boxSizing: 'border-box',
};

const textareaStyle: CSSProperties = {
  width: '100%',
  minHeight: '110px',
  border: '1px solid #E5E7EB',
  borderRadius: '12px',
  padding: '13px 14px',
  fontSize: '14px',
  color: '#111111',
  outline: 'none',
  fontFamily: 'inherit',
  background: '#FFFFFF',
  resize: 'vertical',
  boxSizing: 'border-box',
  lineHeight: 1.5,
};

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
  const [endTimeTouched, setEndTimeTouched] = useState(false);

  useEffect(() => {
    void loadClients();
    void loadEmployees();
  }, []);

  useEffect(() => {
    if (!form.clientId) {
      setSites([]);
      setForm((current) => ({ ...current, clientSiteId: '' }));
      return;
    }

    void loadClientSites(form.clientId);
  }, [form.clientId]);

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
        `
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
      const { data, error } = await supabase
        .from('opc_staff_roles')
        .select('id,user_id,employee_id,display_name,email,phone_e164,phone_raw,whatsapp_wa_id,role,status')
        .order('display_name', { ascending: true });

      if (error) throw new Error(error.message);

      const rows = ((data || []) as EmployeeOption[]).filter((employee) => {
        const role = normalize(employee.role);
        const status = normalize(employee.status);
        const isEmployee =
          role === 'employee' ||
          role === 'mitarbeiter' ||
          role === 'cleaner' ||
          role === 'reinigung' ||
          role === '';
        const isActive =
          !status || status === 'active' || status === 'aktiv' || status === 'enabled';

        return employee.id && isEmployee && isActive;
      });

      setEmployees(rows);
    } catch {
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
        setSites(loadedSites);
        setForm((current) => ({
          ...current,
          clientSiteId: loadedSites[0].id,
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
        client_id: selectedClient.client_id,
        client_site_id: selectedSite.id,
        contact_id: selectedSite.contact_id || selectedClient.contact_id || null,
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
      title="Einsatz planen"
      requiredRole={['owner', 'admin', 'dispatch']}
      currentPath="/einsatz-planen"
      hideTopBar={false}
      fullWidth={false}
    >
      <div style={{ maxWidth: '1080px', margin: '0 auto', fontFamily: pageFont }}>
        <div style={{ marginBottom: '28px' }}>
          <a
            href={`${baseUrl}/einsaetze`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              color: '#6B7280',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '18px',
            }}
          >
            Zurück zu Einsätze
          </a>

          <h1
            style={{
              margin: 0,
              fontSize: '34px',
              lineHeight: 1.1,
              fontWeight: 780,
              letterSpacing: '-0.04em',
              color: '#111111',
            }}
          >
            Einsatz planen
          </h1>

          <p
            style={{
              margin: '10px 0 0',
              fontSize: '15px',
              color: '#6B7280',
              lineHeight: 1.6,
            }}
          >
            Erfassen Sie einen neuen Reinigungseinsatz für einen bestehenden Kunden.
          </p>
        </div>

        {databaseError && (
          <div
            style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#991B1B',
              borderRadius: '14px',
              padding: '16px',
              marginBottom: '18px',
              fontSize: '14px',
              fontWeight: 650,
              lineHeight: 1.5,
            }}
          >
            {databaseError}
          </div>
        )}

        {successJobId && (
          <div
            style={{
              background: '#ECFDF5',
              border: '1px solid #A7F3D0',
              color: '#065F46',
              borderRadius: '14px',
              padding: '16px',
              marginBottom: '18px',
              fontSize: '14px',
              fontWeight: 650,
              lineHeight: 1.5,
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <span>
              {successCount > 1
                ? `${successCount} Einsätze wurden erstellt.`
                : 'Der Einsatz wurde erstellt.'}
            </span>
            <a
              href={`${baseUrl}/einsatz/${successJobId}`}
              style={{
                color: '#065F46',
                fontWeight: 750,
                textDecoration: 'underline',
              }}
            >
              Ersten Einsatz öffnen
            </a>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Card title="Kunde und Standort">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '18px' }}>
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

              <div
                style={{
                  border: '1px solid #F3F4F6',
                  background: '#FAFAFA',
                  borderRadius: '16px',
                  padding: '16px',
                }}
              >
                <div
                  style={{
                    fontSize: '13px',
                    color: '#6B7280',
                    fontWeight: 700,
                    marginBottom: '6px',
                  }}
                >
                  Ausgewählter Standort
                </div>

                <div
                  style={{
                    fontSize: '14px',
                    color: '#111111',
                    fontWeight: 650,
                    lineHeight: 1.5,
                  }}
                >
                  {selectedSite
                    ? getSiteLabel(selectedSite)
                    : form.clientId
                      ? 'Bitte Standort auswählen.'
                      : 'Wählen Sie zuerst einen Kunden aus.'}
                </div>

                {selectedSite?.access_notes && (
                  <div style={{ marginTop: '10px', fontSize: '13px', color: '#6B7280', lineHeight: 1.5 }}>
                    Zugang: {selectedSite.access_notes}
                  </div>
                )}

                {selectedSite?.cleaning_notes && (
                  <div style={{ marginTop: '6px', fontSize: '13px', color: '#6B7280', lineHeight: 1.5 }}>
                    Reinigung: {selectedSite.cleaning_notes}
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card title="Einsatzdaten">
            <div className="opc-form-grid-two">
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

              {form.serviceCategory === 'Andere' && (
                <div>
                  <FieldLabel required>Eigene Dienstleistung</FieldLabel>
                  <input
                    value={form.customServiceCategory}
                    onChange={(event) => updateField('customServiceCategory', event.target.value)}
                    placeholder="z.B. Praxisreinigung"
                    style={inputStyle}
                  />
                </div>
              )}

              <div>
                <FieldLabel required>Datum</FieldLabel>
                <input
                  type="date"
                  value={form.plannedDate}
                  onChange={(event) => updateField('plannedDate', event.target.value)}
                  style={inputStyle}
                />
              </div>

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

              <div>
                <FieldLabel>Status</FieldLabel>
                <select value={form.status} onChange={(event) => updateField('status', event.target.value)} style={inputStyle}>
                  {statusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel>Priorität</FieldLabel>
                <select value={form.priority} onChange={(event) => updateField('priority', event.target.value)} style={inputStyle}>
                  {priorityOptions.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginTop: '18px' }}>
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
                      <input value={computedEndDate || '-'} readOnly style={{ ...inputStyle, background: '#FAFAFA' }} />
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
              <div style={{ marginTop: '18px' }}>
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
              <div
                style={{
                  marginTop: '18px',
                  border: '1px solid #F3F4F6',
                  background: '#FAFAFA',
                  borderRadius: '16px',
                  padding: '14px',
                  fontSize: '13px',
                  color: '#6B7280',
                  lineHeight: 1.5,
                  fontWeight: 650,
                }}
              >
                Jeder generierte Termin wird als eigener Einsatz gespeichert. Dadurch bleiben Fotos, Zeiten, Notizen und Berichte pro Tag getrennt.
              </div>
            )}
          </Card>

          <Card title="Mitarbeiter zuweisen">
            {loadingEmployees ? (
              <div style={{ color: '#6B7280', fontSize: '14px', fontWeight: 650 }}>Mitarbeiter werden geladen...</div>
            ) : employees.length === 0 ? (
              <div style={{ color: '#6B7280', fontSize: '14px', fontWeight: 650 }}>Keine aktiven Mitarbeiter gefunden.</div>
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
              <div style={{ marginTop: '18px' }}>
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

          <Card title="Interne Hinweise">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '18px' }}>
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

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '14px',
                  color: '#111111',
                  fontWeight: 650,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={form.reportRequired}
                  onChange={(event) => updateField('reportRequired', event.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                Bericht für diesen Einsatz vorbereiten
              </label>
            </div>
          </Card>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              marginBottom: '60px',
            }}
          >
            <a
              href={`${baseUrl}/einsaetze`}
              style={{
                height: '46px',
                padding: '0 18px',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
                background: '#FFFFFF',
                color: '#111111',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 650,
              }}
            >
              Abbrechen
            </a>

            <button
              type="submit"
              disabled={submitting}
              style={{
                height: '46px',
                padding: '0 20px',
                borderRadius: '12px',
                border: 'none',
                background: submitting ? '#9CA3AF' : '#111111',
                color: '#FFFFFF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
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
        .opc-form-grid-two {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
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
          border: 1px solid #E5E7EB;
          background: #FFFFFF;
          color: #111111;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
          font-family: inherit;
        }

        .opc-choice-pill.active {
          background: #111111;
          color: #FFFFFF;
          border-color: #111111;
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
          border: 1px solid #E5E7EB;
          border-radius: 16px;
          padding: 11px;
          background: #FFFFFF;
          color: #111111;
          text-align: left;
          cursor: pointer;
          font-family: inherit;
        }

        .opc-employee-card.active {
          border-color: #111111;
          background: #FAFAFA;
        }

        .opc-employee-avatar {
          width: 42px;
          height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: #111111;
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
          color: #111111;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .opc-employee-copy span {
          font-size: 12px;
          font-weight: 650;
          color: #6B7280;
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
          color: #6B7280;
          font-size: 12px;
          font-weight: 760;
          white-space: nowrap;
        }

        .opc-employee-card.active .opc-employee-check {
          background: #111111;
          color: #FFFFFF;
        }

        @media (max-width: 900px) {
          .opc-form-grid-two,
          .opc-employee-grid {
            grid-template-columns: 1fr !important;
          }

          form > div:last-child {
            flex-direction: column-reverse !important;
          }

          form > div:last-child a,
          form > div:last-child button {
            width: 100% !important;
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
        }
      `}</style>
    </MirakaDashboardShell>
  );
}
