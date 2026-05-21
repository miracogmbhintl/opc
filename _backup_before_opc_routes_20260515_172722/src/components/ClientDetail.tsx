import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  Check,
  Clock,
  Edit2,
  FileText,
  MapPin,
  Save,
  User,
  X
} from 'lucide-react';

type ClientStatus = 'active' | 'pending' | 'inactive' | 'archived' | string;

interface OpcClientDetail {
  id: string;
  contact_id: string | null;
  status: ClientStatus;
  client_type: string;
  billing_name: string;
  billing_email: string;
  billing_phone_e164: string;
  billing_address: string;
  internal_notes: string;
  company_name: string;
  full_name: string;
  email: string;
  phone_raw: string;
  phone_e164: string;
  lifecycle_stage: string;
  primary_site_id: string | null;
  primary_site_name: string;
  primary_site_type: string;
  primary_site_address: string;
  primary_site_postal_code: string;
  primary_site_city: string;
  primary_site_country: string;
  active_site_count: number;
  onboarding_case_count: number;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string | null;
}

interface OpcJob {
  job_id: string;
  title: string;
  status: string;
  priority?: string | null;
  planned_start: string | null;
  planned_end: string | null;
  service_category?: string | null;
  estimated_hours?: string | number | null;
  final_hours?: string | number | null;
  report_status?: string | null;
  site_name?: string | null;
  address_text?: string | null;
  city?: string | null;
  job_created_at?: string | null;
  job_updated_at?: string | null;
}

interface ClientDetailProps {
  clientId: string;
  baseUrl?: string;
}

function valueOrDash(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function formatDate(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function getStatusLabel(status?: string | null) {
  const map: Record<string, string> = {
    active: 'Aktiv',
    pending: 'Offen',
    inactive: 'Inaktiv',
    archived: 'Archiviert',
    scheduled: 'Geplant',
    assigned: 'Zugewiesen',
    confirmed: 'Bestätigt',
    on_site: 'Vor Ort',
    in_progress: 'In Arbeit',
    completed: 'Abgeschlossen',
    report_pending: 'Bericht offen',
    report_approved: 'Bericht freigegeben',
    cancelled: 'Storniert',
    draft: 'Entwurf',
    approved: 'Freigegeben',
    sent_to_client: 'An Kunde gesendet'
  };

  return map[status || ''] || valueOrDash(status);
}

function getStatusStyle(status?: string | null) {
  switch (status) {
    case 'active':
    case 'completed':
    case 'approved':
    case 'report_approved':
      return { background: '#DCFCE7', color: '#166534', border: '#BBF7D0' };
    case 'pending':
    case 'scheduled':
    case 'draft':
      return { background: '#F3F4F6', color: '#374151', border: '#E5E7EB' };
    case 'assigned':
    case 'confirmed':
    case 'in_progress':
      return { background: '#DBEAFE', color: '#1E40AF', border: '#BFDBFE' };
    case 'report_pending':
    case 'sent_to_client':
      return { background: '#FEF3C7', color: '#92400E', border: '#FDE68A' };
    case 'inactive':
    case 'archived':
    case 'cancelled':
      return { background: '#FEE2E2', color: '#991B1B', border: '#FCA5A5' };
    default:
      return { background: '#F3F4F6', color: '#374151', border: '#E5E7EB' };
  }
}

function normaliseClient(row: any): OpcClientDetail {
  return {
    id: row.client_id || row.id,
    contact_id: row.contact_id || null,
    status: row.client_status || row.status || 'active',
    client_type: row.client_type || 'unknown',
    billing_name: row.billing_name || row.company_name || 'Unbekannt',
    billing_email: row.billing_email || row.email || '',
    billing_phone_e164: row.billing_phone_e164 || row.phone_e164 || row.phone_raw || '',
    billing_address: row.billing_address || row.primary_site_address || row.address_text || '',
    internal_notes: row.internal_notes || '',
    company_name: row.company_name || row.billing_name || 'Unbekannt',
    full_name: row.full_name || row.contact_person || 'Unbekannt',
    email: row.email || row.billing_email || '',
    phone_raw: row.phone_raw || row.billing_phone_e164 || '',
    phone_e164: row.phone_e164 || row.billing_phone_e164 || '',
    lifecycle_stage: row.lifecycle_stage || 'client',
    primary_site_id: row.primary_site_id || row.client_site_id || null,
    primary_site_name: row.primary_site_name || row.site_name || row.company_name || row.billing_name || '',
    primary_site_type: row.primary_site_type || row.site_type || '',
    primary_site_address: row.primary_site_address || row.address_text || row.billing_address || '',
    primary_site_postal_code: row.primary_site_postal_code || row.postal_code || '',
    primary_site_city: row.primary_site_city || row.city || '',
    primary_site_country: row.country || row.primary_site_country || 'Schweiz',
    active_site_count: Number(row.active_site_count || 0),
    onboarding_case_count: Number(row.onboarding_case_count || 0),
    last_activity_at: row.last_activity_at || null,
    created_at: row.client_created_at || row.created_at || '',
    updated_at: row.client_updated_at || row.updated_at || null
  };
}

export default function ClientDetail({ clientId, baseUrl = '' }: ClientDetailProps) {
  const [resolvedClientId, setResolvedClientId] = useState(clientId);
  const [client, setClient] = useState<OpcClientDetail | null>(null);
  const [editedClient, setEditedClient] = useState<OpcClientDetail | null>(null);
  const [jobs, setJobs] = useState<OpcJob[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  const [loadingClient, setLoadingClient] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [jobError, setJobError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const appBaseUrl = baseUrl || '';

  const displayClient = editMode ? editedClient : client;
  const isOwner = userRole === 'owner';
  const isAdminOrOwner = userRole === 'owner' || userRole === 'admin';

  const statusStyle = useMemo(
    () => getStatusStyle(displayClient?.status),
    [displayClient?.status]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !clientId) return;

    loadPageData();
  }, [mounted, clientId]);

  async function loadPageData() {
    setError('');
    setJobError('');
    setSuccessMessage('');
    setLoadingClient(true);
    setLoadingJobs(true);

    try {
      await checkUserRole();
      const opcClientId = await resolveClientId(clientId);
      setResolvedClientId(opcClientId);

      await Promise.all([
        loadClientData(opcClientId),
        loadClientJobs(opcClientId)
      ]);
    } finally {
      setLoadingClient(false);
      setLoadingJobs(false);
    }
  }

  async function checkUserRole() {
    try {
      const { data } = await supabase
        .from('opc_current_user_access')
        .select('staff_role, is_staff')
        .maybeSingle();

      if (data?.is_staff && data?.staff_role) {
        setUserRole(String(data.staff_role));
      }
    } catch {
      setUserRole(null);
    }
  }

  async function resolveClientId(inputId: string) {
    const { data: directClient } = await supabase
      .from('opc_client_detail_view')
      .select('client_id')
      .eq('client_id', inputId)
      .maybeSingle();

    if (directClient?.client_id) {
      return directClient.client_id;
    }

    const { data: legacyLink } = await supabase
      .from('opc_legacy_client_links')
      .select('opc_client_id')
      .eq('legacy_client_id', inputId)
      .maybeSingle();

    if (legacyLink?.opc_client_id) {
      return legacyLink.opc_client_id;
    }

    return inputId;
  }

  async function loadClientData(opcClientId: string) {
    try {
      const { data, error: fetchError } = await supabase
        .from('opc_client_detail_view')
        .select('*')
        .eq('client_id', opcClientId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!data) throw new Error('Kunde wurde nicht gefunden.');

      const normalised = normaliseClient(data);

      setClient(normalised);
      setEditedClient(normalised);
    } catch (err: any) {
      setClient(null);
      setEditedClient(null);
      setError(err?.message || 'Kundendaten konnten nicht geladen werden.');
    }
  }

  async function loadClientJobs(opcClientId: string) {
    try {
      const { data, error: fetchError } = await supabase
        .from('opc_my_portal_job_feed')
        .select('*')
        .eq('client_id', opcClientId)
        .order('planned_start', { ascending: false })
        .limit(24);

      if (fetchError) throw fetchError;

      setJobs((data || []) as OpcJob[]);
    } catch (err: any) {
      setJobs([]);
      setJobError(err?.message || 'Einsätze konnten nicht geladen werden.');
    }
  }

  async function handleSave() {
    if (!editedClient || !client) return;

    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const { error: clientUpdateError } = await supabase
        .from('opc_clients')
        .update({
          billing_name: editedClient.billing_name,
          billing_email: editedClient.billing_email || null,
          billing_phone_e164: editedClient.billing_phone_e164 || null,
          billing_address: editedClient.billing_address || null,
          internal_notes: editedClient.internal_notes || null,
          status: editedClient.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', resolvedClientId);

      if (clientUpdateError) throw clientUpdateError;

      if (client.contact_id) {
        const { error: contactUpdateError } = await supabase
          .from('opc_contacts')
          .update({
            full_name: editedClient.full_name || null,
            company_name: editedClient.company_name || editedClient.billing_name || null,
            email: editedClient.email || editedClient.billing_email || null,
            phone_raw: editedClient.phone_raw || editedClient.billing_phone_e164 || null,
            phone_e164: editedClient.phone_e164 || editedClient.billing_phone_e164 || null
          })
          .eq('id', client.contact_id);

        if (contactUpdateError) throw contactUpdateError;
      }

      if (client.primary_site_id) {
        const { error: siteUpdateError } = await supabase
          .from('opc_client_sites')
          .update({
            site_name: editedClient.primary_site_name || editedClient.company_name || editedClient.billing_name || null,
            site_type: editedClient.primary_site_type || null,
            address_text: editedClient.primary_site_address || null,
            postal_code: editedClient.primary_site_postal_code || null,
            city: editedClient.primary_site_city || null,
            country: editedClient.primary_site_country || 'Schweiz',
            updated_at: new Date().toISOString()
          })
          .eq('id', client.primary_site_id);

        if (siteUpdateError) throw siteUpdateError;
      }

      await loadClientData(resolvedClientId);

      setEditMode(false);
      setSuccessMessage('Änderungen wurden gespeichert.');

      window.setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Änderungen konnten nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setEditedClient(client);
    setEditMode(false);
    setError('');
    setSuccessMessage('');
  }

  function updateEditedClient<K extends keyof OpcClientDetail>(key: K, value: OpcClientDetail[K]) {
    setEditedClient((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: value };
    });
  }

  function renderField(
    label: string,
    value: string | number | null | undefined,
    field?: keyof OpcClientDetail,
    options?: {
      type?: 'text' | 'email' | 'tel' | 'textarea' | 'select';
      selectOptions?: { value: string; label: string }[];
      disabled?: boolean;
    }
  ) {
    const inputType = options?.type || 'text';

    return (
      <div>
        <label style={styles.label}>{label}</label>

        {editMode && field && !options?.disabled ? (
          inputType === 'textarea' ? (
            <textarea
              value={String(editedClient?.[field] || '')}
              onChange={(event) => updateEditedClient(field, event.target.value as any)}
              rows={4}
              style={{ ...styles.input, resize: 'vertical', minHeight: '96px' }}
            />
          ) : inputType === 'select' ? (
            <select
              value={String(editedClient?.[field] || '')}
              onChange={(event) => updateEditedClient(field, event.target.value as any)}
              style={styles.input}
            >
              {(options?.selectOptions || []).map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={inputType}
              value={String(editedClient?.[field] || '')}
              onChange={(event) => updateEditedClient(field, event.target.value as any)}
              style={styles.input}
            />
          )
        ) : (
          <p style={styles.value}>{valueOrDash(value)}</p>
        )}
      </div>
    );
  }

  if (!mounted) return null;

  if (loadingClient) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner} />
          <p style={styles.mutedText}>Kundendaten werden geladen.</p>
        </div>
      </div>
    );
  }

  if (error && !client) {
    return (
      <div style={styles.page}>
        <div style={styles.errorCard}>
          <p style={styles.errorText}>{error}</p>
          <a href={`${appBaseUrl}/miraka-co-portal/clients`} style={styles.primaryLink}>
            <ArrowLeft size={16} />
            Zurück zu Kunden
          </a>
        </div>
      </div>
    );
  }

  if (!client || !displayClient) return null;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <a href={`${appBaseUrl}/miraka-co-portal/clients`} style={styles.backLink}>
          <ArrowLeft size={16} />
          Zurück zu Kunden
        </a>

        <div style={styles.headerMain}>
          <div style={styles.headerIdentity}>
            <div style={styles.avatar}>
              {(displayClient.billing_name || displayClient.company_name || 'K')
                .split(' ')
                .map((part) => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={styles.statusRow}>
                <span style={{ ...styles.statusBadge, ...statusStyle }}>
                  {getStatusLabel(displayClient.status)}
                </span>
                <span style={styles.smallMuted}>
                  Erstellt am {formatDate(displayClient.created_at)}
                </span>
              </div>

              <h1 style={styles.title}>
                {displayClient.billing_name || displayClient.company_name || 'Kundendetails'}
              </h1>

              <p style={styles.subtitle}>
                {valueOrDash(displayClient.full_name)} · {valueOrDash(displayClient.email || displayClient.billing_email)}
              </p>
            </div>
          </div>

          <div style={styles.actionRow}>
            {!editMode ? (
              isAdminOrOwner && (
                <button onClick={() => setEditMode(true)} style={styles.darkButton}>
                  <Edit2 size={16} />
                  Bearbeiten
                </button>
              )
            ) : (
              <>
                <button onClick={handleCancel} disabled={saving} style={styles.lightButton}>
                  <X size={16} />
                  Abbrechen
                </button>
                <button onClick={handleSave} disabled={saving} style={styles.darkButton}>
                  <Save size={16} />
                  {saving ? 'Speichern...' : 'Speichern'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {successMessage && (
        <div style={styles.successAlert}>
          <Check size={16} />
          {successMessage}
        </div>
      )}

      {error && (
        <div style={styles.errorAlert}>
          {error}
        </div>
      )}

      <div style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <Building2 size={18} />
          <div>
            <strong>{displayClient.active_site_count}</strong>
            <span>Standort(e)</span>
          </div>
        </div>

        <div style={styles.metricCard}>
          <Briefcase size={18} />
          <div>
            <strong>{jobs.length}</strong>
            <span>Einsätze</span>
          </div>
        </div>

        <div style={styles.metricCard}>
          <FileText size={18} />
          <div>
            <strong>{displayClient.onboarding_case_count}</strong>
            <span>Onboarding</span>
          </div>
        </div>

        <div style={styles.metricCard}>
          <Clock size={18} />
          <div>
            <strong>{formatDate(displayClient.last_activity_at)}</strong>
            <span>Letzte Aktivität</span>
          </div>
        </div>
      </div>

      <div style={styles.infoGrid}>
        <section style={styles.card}>
          <div style={styles.cardTitleRow}>
            <Building2 size={18} />
            <h2 style={styles.cardTitle}>Kundendaten</h2>
          </div>

          <div style={styles.fieldStack}>
            {renderField('Rechnungsname', displayClient.billing_name, 'billing_name')}
            {renderField('Firmenname', displayClient.company_name, 'company_name')}
            {renderField('Kundentyp', displayClient.client_type, 'client_type')}
            {renderField('Status', getStatusLabel(displayClient.status), 'status', {
              type: 'select',
              selectOptions: [
                { value: 'active', label: 'Aktiv' },
                { value: 'pending', label: 'Offen' },
                { value: 'inactive', label: 'Inaktiv' },
                { value: 'archived', label: 'Archiviert' }
              ]
            })}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardTitleRow}>
            <User size={18} />
            <h2 style={styles.cardTitle}>Kontakt</h2>
          </div>

          <div style={styles.fieldStack}>
            {renderField('Kontaktperson', displayClient.full_name, 'full_name')}
            {renderField('E-Mail', displayClient.email || displayClient.billing_email, 'email', { type: 'email' })}
            {renderField('Telefon', displayClient.phone_e164 || displayClient.phone_raw || displayClient.billing_phone_e164, 'phone_raw', { type: 'tel' })}
            {renderField('Lifecycle', displayClient.lifecycle_stage, undefined, { disabled: true })}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardTitleRow}>
            <MapPin size={18} />
            <h2 style={styles.cardTitle}>Standort</h2>
          </div>

          <div style={styles.fieldStack}>
            {renderField('Standortname', displayClient.primary_site_name, 'primary_site_name')}
            {renderField('Standorttyp', displayClient.primary_site_type, 'primary_site_type')}
            {renderField('Adresse', displayClient.primary_site_address, 'primary_site_address')}
            {renderField('PLZ', displayClient.primary_site_postal_code, 'primary_site_postal_code')}
            {renderField('Ort', displayClient.primary_site_city, 'primary_site_city')}
            {renderField('Land', displayClient.primary_site_country, 'primary_site_country')}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardTitleRow}>
            <FileText size={18} />
            <h2 style={styles.cardTitle}>Verrechnung & Notizen</h2>
          </div>

          <div style={styles.fieldStack}>
            {renderField('Rechnungs-E-Mail', displayClient.billing_email, 'billing_email', { type: 'email' })}
            {renderField('Rechnungstelefon', displayClient.billing_phone_e164, 'billing_phone_e164', { type: 'tel' })}
            {renderField('Rechnungsadresse', displayClient.billing_address, 'billing_address')}
            {renderField('Interne Notizen', displayClient.internal_notes, 'internal_notes', { type: 'textarea' })}
          </div>
        </section>
      </div>

      <section style={styles.jobsCard}>
        <div style={styles.jobsHeader}>
          <div style={styles.cardTitleRow}>
            <Briefcase size={18} />
            <h2 style={styles.cardTitle}>Einsätze</h2>
            <span style={styles.countBadge}>{jobs.length}</span>
          </div>
        </div>

        {jobError && (
          <div style={styles.errorAlert}>
            {jobError}
          </div>
        )}

        {loadingJobs ? (
          <div style={styles.loadingInline}>
            <div style={styles.spinner} />
            <span>Einsätze werden geladen.</span>
          </div>
        ) : jobs.length === 0 ? (
          <div style={styles.emptyState}>
            <Briefcase size={36} />
            <h3>Keine Einsätze gefunden</h3>
            <p>Für diesen Kunden sind aktuell keine Einsätze sichtbar.</p>
          </div>
        ) : (
          <div style={styles.jobGrid}>
            {jobs.map((job) => {
              const jobStatusStyle = getStatusStyle(job.status);

              return (
                <a
                  key={job.job_id}
                  href={`${appBaseUrl}/opc/admin/job/${job.job_id}`}
                  style={styles.jobCard}
                >
                  <div style={styles.jobTopRow}>
                    <span style={{ ...styles.statusBadge, ...jobStatusStyle }}>
                      {getStatusLabel(job.status)}
                    </span>
                    <span style={styles.smallMuted}>
                      {getStatusLabel(job.report_status)}
                    </span>
                  </div>

                  <h3 style={styles.jobTitle}>
                    {job.title || job.service_category || 'Einsatz'}
                  </h3>

                  <div style={styles.jobMeta}>
                    <span>
                      <Calendar size={13} />
                      {formatDateTime(job.planned_start)}
                    </span>
                    <span>
                      <Clock size={13} />
                      {formatDateTime(job.planned_end)}
                    </span>
                    <span>
                      <MapPin size={13} />
                      {valueOrDash(job.site_name || job.address_text)}
                    </span>
                  </div>

                  <div style={styles.jobFooter}>
                    <span>{valueOrDash(job.service_category)}</span>
                    <span>
                      {valueOrDash(job.final_hours || job.estimated_hours)} Std.
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>

      {isOwner && (
        <section style={styles.ownerNote}>
          <h3>Owner-Hinweis</h3>
          <p>
            Archivierung, Benutzer-Einladung und Passwort-E-Mails wurden aus dieser Frontend-Version entfernt,
            damit keine alten Miraka-API-Routen aufgerufen werden. Diese Funktionen sollten später sauber über
            OPC-spezifische Endpoints ergänzt werden.
          </p>
        </section>
      )}

      <style>{`
        @keyframes opcSpin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          body {
            padding-bottom: 140px;
          }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, any> = {
  page: {
    padding: '20px 24px 160px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
    maxWidth: '100%',
    overflow: 'hidden'
  },
  header: {
    marginBottom: '24px'
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: '#6B7280',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '16px'
  },
  headerMain: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap'
  },
  headerIdentity: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    minWidth: 0,
    flex: '1 1 auto'
  },
  avatar: {
    width: '56px',
    height: '56px',
    borderRadius: '18px',
    background: '#1A1A1A',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: 800,
    flexShrink: 0
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    marginBottom: '8px'
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 10px',
    borderRadius: '999px',
    border: '1px solid',
    fontSize: '11px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  smallMuted: {
    color: '#9CA3AF',
    fontSize: '12px',
    fontWeight: 600
  },
  title: {
    fontSize: '26px',
    fontWeight: 800,
    color: '#111827',
    margin: '0 0 6px 0',
    letterSpacing: '-0.03em',
    lineHeight: 1.15,
    wordBreak: 'break-word'
  },
  subtitle: {
    fontSize: '14px',
    color: '#6B7280',
    margin: 0,
    wordBreak: 'break-word'
  },
  actionRow: {
    display: 'flex',
    gap: '10px',
    flexShrink: 0,
    flexWrap: 'wrap'
  },
  darkButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    height: '46px',
    padding: '0 18px',
    background: '#1A1A1A',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '14px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  lightButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    height: '46px',
    padding: '0 18px',
    background: '#FFFFFF',
    color: '#4B5563',
    border: '1px solid #E5E7EB',
    borderRadius: '14px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  successAlert: {
    padding: '12px 16px',
    background: '#DCFCE7',
    border: '1px solid #86EFAC',
    borderRadius: '12px',
    color: '#166534',
    fontSize: '14px',
    fontWeight: 700,
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  errorAlert: {
    padding: '12px 16px',
    background: '#FEE2E2',
    border: '1px solid #FCA5A5',
    borderRadius: '12px',
    color: '#991B1B',
    fontSize: '14px',
    fontWeight: 700,
    marginBottom: '20px'
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: '14px',
    marginBottom: '18px'
  },
  metricCard: {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '18px',
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: '#111827'
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
    marginBottom: '20px'
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '18px',
    padding: '20px',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
  },
  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#111827'
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 800,
    color: '#111827',
    margin: 0,
    letterSpacing: '-0.02em'
  },
  fieldStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    marginTop: '16px'
  },
  label: {
    fontSize: '12px',
    fontWeight: 800,
    color: '#6B7280',
    display: 'block',
    marginBottom: '5px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  value: {
    fontSize: '15px',
    fontWeight: 650,
    color: '#111827',
    margin: 0,
    lineHeight: 1.5,
    wordBreak: 'break-word'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #E5E7EB',
    borderRadius: '10px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    background: '#FFFFFF',
    color: '#111827'
  },
  jobsCard: {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '18px',
    padding: '20px',
    marginTop: '20px',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
  },
  jobsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '18px',
    flexWrap: 'wrap',
    gap: '12px'
  },
  countBadge: {
    padding: '4px 10px',
    background: '#F3F4F6',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 800,
    color: '#6B7280'
  },
  jobGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '14px'
  },
  jobCard: {
    display: 'block',
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '14px',
    padding: '16px',
    textDecoration: 'none',
    color: '#111827'
  },
  jobTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px'
  },
  jobTitle: {
    fontSize: '15px',
    fontWeight: 800,
    color: '#111827',
    margin: '0 0 12px 0',
    lineHeight: 1.35
  },
  jobMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
    fontSize: '13px',
    color: '#6B7280',
    marginBottom: '14px'
  },
  jobFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    paddingTop: '12px',
    borderTop: '1px solid #F3F4F6',
    fontSize: '12px',
    fontWeight: 800,
    color: '#6B7280'
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px 20px',
    background: '#F9FAFB',
    borderRadius: '14px',
    border: '1px dashed #D1D5DB',
    color: '#9CA3AF'
  },
  loadingCard: {
    padding: '80px 20px',
    textAlign: 'center'
  },
  loadingInline: {
    padding: '32px 20px',
    textAlign: 'center',
    color: '#6B7280',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px'
  },
  spinner: {
    width: '30px',
    height: '30px',
    border: '3px solid #E5E7EB',
    borderTopColor: '#111827',
    borderRadius: '50%',
    animation: 'opcSpin 0.8s linear infinite'
  },
  mutedText: {
    color: '#6B7280',
    fontSize: '14px',
    marginTop: '12px'
  },
  errorCard: {
    textAlign: 'center',
    padding: '80px 20px'
  },
  errorText: {
    color: '#DC2626',
    marginBottom: '16px',
    fontSize: '14px',
    fontWeight: 700
  },
  primaryLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 20px',
    background: '#1A1A1A',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 700,
    borderRadius: '12px',
    textDecoration: 'none'
  },
  ownerNote: {
    background: '#FFFBEB',
    border: '1px solid #FDE68A',
    borderRadius: '18px',
    padding: '18px 20px',
    marginTop: '20px',
    color: '#92400E'
  }
};