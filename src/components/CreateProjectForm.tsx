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
  clientNotes: string;
  serviceDescription: string;
  reportRequired: boolean;
}

const initialFormState: FormState = {
  clientId: '',
  clientSiteId: '',
  serviceCategory: 'Allgemeine Reinigung',
  customServiceCategory: '',
  plannedDate: '',
  startTime: '08:00',
  endTime: '10:00',
  status: 'scheduled',
  priority: 'normal',
  estimatedHours: '2',
  dispatcherNotes: '',
  clientNotes: '',
  serviceDescription: '',
  reportRequired: true,
};

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

function toDateTime(date: string, time: string) {
  if (!date || !time) return null;
  return new Date(`${date}T${time}:00`).toISOString();
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
  const [form, setForm] = useState<FormState>(initialFormState);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingSites, setLoadingSites] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [successJobId, setSuccessJobId] = useState<string | null>(null);

  useEffect(() => {
    void loadClients();
  }, []);

  useEffect(() => {
    if (!form.clientId) {
      setSites([]);
      setForm((current) => ({ ...current, clientSiteId: '' }));
      return;
    }

    void loadClientSites(form.clientId);
  }, [form.clientId]);

  const selectedClient = useMemo(() => {
    return clients.find((client) => client.client_id === form.clientId) || null;
  }, [clients, form.clientId]);

  const selectedSite = useMemo(() => {
    return sites.find((site) => site.id === form.clientSiteId) || null;
  }, [sites, form.clientSiteId]);

  const finalServiceCategory =
    form.serviceCategory === 'Andere'
      ? form.customServiceCategory.trim()
      : form.serviceCategory;

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

    return null;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setDatabaseError(null);
    setSuccessJobId(null);

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
        job_type: 'one_time',
        status: form.status,
        priority: form.priority,
        planned_start: plannedStart,
        planned_end: plannedEnd,
        service_category: finalServiceCategory,
        service_description: form.serviceDescription || null,
        estimated_hours: Number(form.estimatedHours || 0),
        dispatcher_notes: form.dispatcherNotes || null,
        client_notes: form.clientNotes || null,
        report_required: form.reportRequired,
        metadata: {
          source: 'portal_einsatz_planen',
          created_from: 'CreateProjectForm',
          selected_site_id: selectedSite.id,
          selected_site_label: getSiteLabel(selectedSite),
          selected_site_address: getSiteAddress(selectedSite),
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
      };

      if (!response.ok) {
        throw new Error(result.error || 'Der Einsatz konnte nicht erstellt werden.');
      }

      const jobId = result.job_id;

      if (!jobId) {
        throw new Error('Der Einsatz wurde erstellt, aber keine Einsatz-ID wurde zurückgegeben.');
      }

      setSuccessJobId(jobId);
      setForm(initialFormState);
      setSites([]);
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
      <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
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
            <span>Der Einsatz wurde erstellt.</span>
            <a
              href={`${baseUrl}/einsatz/${successJobId}`}
              style={{
                color: '#065F46',
                fontWeight: 750,
                textDecoration: 'underline',
              }}
            >
              Einsatz öffnen
            </a>
          </div>
        )}

        <form onSubmit={handleSubmit}>
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
              Kunde und Standort
            </h2>

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
                  <div
                    style={{
                      marginTop: '10px',
                      fontSize: '13px',
                      color: '#6B7280',
                      lineHeight: 1.5,
                    }}
                  >
                    Zugang: {selectedSite.access_notes}
                  </div>
                )}

                {selectedSite?.cleaning_notes && (
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '13px',
                      color: '#6B7280',
                      lineHeight: 1.5,
                    }}
                  >
                    Reinigung: {selectedSite.cleaning_notes}
                  </div>
                )}
              </div>
            </div>
          </div>

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
              Einsatzdaten
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '18px',
              }}
            >
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
                  onChange={(event) => updateField('startTime', event.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <FieldLabel required>Endzeit</FieldLabel>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(event) => updateField('endTime', event.target.value)}
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
                  onChange={(event) => updateField('estimatedHours', event.target.value)}
                  style={inputStyle}
                />
              </div>

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

            <div style={{ marginTop: '18px' }}>
              <FieldLabel>Beschreibung</FieldLabel>
              <textarea
                value={form.serviceDescription}
                onChange={(event) => updateField('serviceDescription', event.target.value)}
                placeholder="Beschreiben Sie kurz, was vor Ort erledigt werden soll."
                style={textareaStyle}
              />
            </div>
          </div>

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
              Hinweise
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '18px' }}>
              <div>
                <FieldLabel>Interne Notizen für Disposition</FieldLabel>
                <textarea
                  value={form.dispatcherNotes}
                  onChange={(event) => updateField('dispatcherNotes', event.target.value)}
                  placeholder="z.B. Zugang prüfen, Schlüssel bei Empfang abholen, regelmässigen Einsatz abklären."
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
          </div>

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
              {submitting ? 'Wird erstellt...' : 'Einsatz erstellen'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @media (max-width: 900px) {
          div[style*="grid-template-columns: repeat(2, minmax(0, 1fr))"] {
            grid-template-columns: 1fr !important;
          }

          form > div:last-child {
            flex-direction: column-reverse !important;
          }

          form > div:last-child a,
          form > div:last-child button {
            width: 100% !important;
          }
        }
      `}</style>
    </MirakaDashboardShell>
  );
}