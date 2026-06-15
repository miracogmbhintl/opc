import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  ClipboardList,
  Check,
  Clock,
  Edit2,
  FileText,
  LockKeyhole,
  Mail,
  MapPin,
  PhoneCall,
  Save,
  Send,
  User,
  X,
} from 'lucide-react';
import {
  OPCPageShell,
  OPCMetricsGrid,
  OPCMetricCard,
  OPCListCard,
  OPC_BRAND,
  OPC_PAGE_FONT,
  opcBlackButtonStyle,
  opcSecondaryButtonStyle,
  opcSelectStyle,
  opcInputStyle,
  opcResponsiveStyle,
} from './opc/OPCPageTop';

type ClientStatus = 'active' | 'pending' | 'inactive' | 'archived' | string;
type EmailAction = 'account_setup' | 'password_reset' | 'magic_link' | 'portal_invite';

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

interface OpcClientUser {
  id: string;
  status: string;
  email: string | null;
  can_access_client_portal: boolean;
  invited_at: string | null;
  activated_at: string | null;
  last_login_at: string | null;
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


interface RelatedRecord {
  id: string;
  title: string;
  status?: string | null;
  date?: string | null;
  amount?: string | number | null;
  href?: string | null;
  meta?: string | null;
}

interface RelatedSection {
  key: string;
  title: string;
  records: RelatedRecord[];
}

interface ClientDetailProps {
  clientId: string;
  baseUrl?: string;
}

const SITE_TYPE_OPTIONS = [
  { value: 'office', label: 'Büro' },
  { value: 'residential', label: 'Privat / Wohnung' },
  { value: 'construction_site', label: 'Baustelle' },
  { value: 'staircase', label: 'Treppenhaus' },
  { value: 'commercial', label: 'Gewerbe' },
  { value: 'mixed', label: 'Gemischt' },
  { value: 'other', label: 'Sonstiges' },
];

function valueOrDash(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function cleanText(value?: string | null) {
  const text = String(value || '').trim();
  return text || '';
}

function parseAddressParts(address?: string | null, postalCode?: string | null, city?: string | null) {
  const rawAddress = cleanText(address);
  const rawPostal = cleanText(postalCode);
  const rawCity = cleanText(city);

  if (!rawAddress) {
    return {
      addressText: '',
      postalCode: rawPostal,
      city: rawCity,
    };
  }

  const match = rawAddress.match(/^(.*?)[,\s]+(\d{4})[,\s]+(.+)$/);

  if (!match) {
    return {
      addressText: rawAddress,
      postalCode: rawPostal,
      city: rawCity,
    };
  }

  return {
    addressText: cleanText(match[1]),
    postalCode: rawPostal || cleanText(match[2]),
    city: rawCity || cleanText(match[3]),
  };
}

function buildAddressLine(address?: string | null, postalCode?: string | null, city?: string | null) {
  const street = cleanText(address);
  const zip = cleanText(postalCode);
  const town = cleanText(city);
  const cityLine = [zip, town].filter(Boolean).join(' ');

  return [street, cityLine].filter(Boolean).join(', ');
}

function normalizeSiteType(value?: string | null) {
  const normalized = cleanText(value).toLowerCase();

  const labelMap: Record<string, string> = {
    büro: 'office',
    buero: 'office',
    office: 'office',
    wohnung: 'residential',
    privat: 'residential',
    residential: 'residential',
    baustelle: 'construction_site',
    construction_site: 'construction_site',
    treppenhaus: 'staircase',
    staircase: 'staircase',
    gewerbe: 'commercial',
    commercial: 'commercial',
    gemischt: 'mixed',
    mixed: 'mixed',
    sonstiges: 'other',
    other: 'other',
  };

  return labelMap[normalized] || 'other';
}

function getSiteTypeLabel(value?: string | null) {
  const dbValue = normalizeSiteType(value);
  return SITE_TYPE_OPTIONS.find((item) => item.value === dbValue)?.label || 'Sonstiges';
}

function normalizeStatus(status?: string | null) {
  return String(status || '').trim().toLowerCase();
}

function isCompletedJob(status?: string | null) {
  return ['completed', 'report_approved', 'approved', 'sent_to_client'].includes(normalizeStatus(status));
}

function formatDate(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
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
    minute: '2-digit',
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
    sent_to_client: 'An Kunde gesendet',
    invited: 'Eingeladen',
  };

  return map[status || ''] || valueOrDash(status);
}

function normaliseClient(row: any): OpcClientDetail {
  const addressParts = parseAddressParts(
    row.primary_site_address || row.address_text,
    row.primary_site_postal_code || row.postal_code,
    row.primary_site_city || row.city
  );

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
    primary_site_address: addressParts.addressText,
    primary_site_postal_code: addressParts.postalCode,
    primary_site_city: addressParts.city,
    primary_site_country: row.country || row.primary_site_country || 'Schweiz',
    active_site_count: Number(row.active_site_count || 0),
    onboarding_case_count: Number(row.onboarding_case_count || 0),
    last_activity_at: row.last_activity_at || null,
    created_at: row.client_created_at || row.created_at || '',
    updated_at: row.client_updated_at || row.updated_at || null,
  };
}

function getInitials(name?: string) {
  if (!name) return 'K';

  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}


function formatMoney(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return '';

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) return '';

  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(amount);
}

function pickRelatedTitle(row: Record<string, any>, fallback: string) {
  return (
    cleanText(row.quote_number) ||
    cleanText(row.invoice_number) ||
    cleanText(row.document_number) ||
    cleanText(row.contract_number) ||
    cleanText(row.order_confirmation_number) ||
    cleanText(row.title) ||
    cleanText(row.name) ||
    fallback
  );
}

function pickRelatedDate(row: Record<string, any>) {
  return (
    cleanText(row.issue_date) ||
    cleanText(row.created_at) ||
    cleanText(row.updated_at) ||
    cleanText(row.sent_at) ||
    cleanText(row.signed_at) ||
    null
  );
}

function pickRelatedAmount(row: Record<string, any>) {
  return row.total_chf ?? row.amount_chf ?? row.balance_chf ?? row.total ?? null;
}

function buildRelatedRecord(row: Record<string, any>, fallbackTitle: string, hrefPrefix?: string): RelatedRecord | null {
  const id = cleanText(row.id || row.quote_id || row.invoice_id || row.document_id || row.contract_id);
  if (!id) return null;

  const amount = formatMoney(pickRelatedAmount(row));
  const status = cleanText(row.status);
  const date = pickRelatedDate(row);
  const metaParts = [status ? getStatusLabel(status) : '', date ? formatDate(date) : '', amount].filter(Boolean);

  return {
    id,
    title: pickRelatedTitle(row, fallbackTitle),
    status,
    date,
    amount,
    href: hrefPrefix ? `${hrefPrefix}/${id}` : null,
    meta: metaParts.join(' · '),
  };
}

export default function ClientDetail({ clientId, baseUrl = '' }: ClientDetailProps) {
  const [resolvedClientId, setResolvedClientId] = useState(clientId);
  const [client, setClient] = useState<OpcClientDetail | null>(null);
  const [editedClient, setEditedClient] = useState<OpcClientDetail | null>(null);
  const [clientUser, setClientUser] = useState<OpcClientUser | null>(null);
  const [jobs, setJobs] = useState<OpcJob[]>([]);
  const [relatedSections, setRelatedSections] = useState<RelatedSection[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  const [loadingClient, setLoadingClient] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const [emailAction, setEmailAction] = useState<EmailAction>('account_setup');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [grantingPortal, setGrantingPortal] = useState(false);
  const [sendingThankYouJobId, setSendingThankYouJobId] = useState<string | null>(null);

  const [error, setError] = useState('');
  const [jobError, setJobError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const appBaseUrl = baseUrl || '';
  const displayClient = editMode ? editedClient : client;
  const isAdminOrOwner = userRole === 'owner' || userRole === 'admin';
  const canManageSalesPipeline = ['owner', 'admin', 'dispatch', 'estimator', 'sales'].includes(String(userRole || '').toLowerCase());
  const hasPortalAccess = Boolean(clientUser?.can_access_client_portal);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !clientId) return;
    void loadPageData();
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
        loadClientJobs(opcClientId),
        loadClientUser(opcClientId),
        loadClientRelatedSections(opcClientId),
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

    if (directClient?.client_id) return directClient.client_id;

    const { data: legacyLink } = await supabase
      .from('opc_legacy_client_links')
      .select('opc_client_id')
      .eq('legacy_client_id', inputId)
      .maybeSingle();

    if (legacyLink?.opc_client_id) return legacyLink.opc_client_id;

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

  async function loadClientUser(opcClientId: string) {
    try {
      const { data, error: fetchError } = await supabase
        .from('opc_client_users')
        .select('id, status, email, can_access_client_portal, invited_at, activated_at, last_login_at')
        .eq('client_id', opcClientId)
        .in('status', ['active', 'invited'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      setClientUser((data || null) as OpcClientUser | null);
    } catch {
      setClientUser(null);
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

  async function loadClientRelatedSections(opcClientId: string) {
    const configs: Array<{
      key: string;
      title: string;
      tableCandidates: string[];
      fallbackTitle: string;
      hrefPrefix?: string;
    }> = [
      {
        key: 'quotes',
        title: 'Offerten',
        tableCandidates: ['opc_quotes'],
        fallbackTitle: 'Offerte',
        hrefPrefix: `${appBaseUrl}/offerte`,
      },
      {
        key: 'order_confirmations',
        title: 'Auftragsbestätigungen',
        tableCandidates: ['opc_order_confirmations', 'opc_order_confirmation_documents'],
        fallbackTitle: 'Auftragsbestätigung',
      },
      {
        key: 'contracts',
        title: 'Verträge',
        tableCandidates: ['opc_contracts', 'opc_client_contracts'],
        fallbackTitle: 'Vertrag',
      },
      {
        key: 'invoices',
        title: 'Rechnungen',
        tableCandidates: ['opc_invoices'],
        fallbackTitle: 'Rechnung',
        hrefPrefix: `${appBaseUrl}/rechnung`,
      },
      {
        key: 'documents',
        title: 'Dokumente',
        tableCandidates: ['opc_client_documents', 'opc_documents'],
        fallbackTitle: 'Dokument',
      },
    ];

    const nextSections: RelatedSection[] = [];

    for (const config of configs) {
      for (const table of config.tableCandidates) {
        try {
          const { data, error: fetchError } = await supabase
            .from(table)
            .select('*')
            .eq('client_id', opcClientId)
            .order('created_at', { ascending: false })
            .limit(12);

          if (fetchError || !Array.isArray(data) || data.length === 0) {
            continue;
          }

          const records = data
            .map((row) => buildRelatedRecord(row as Record<string, any>, config.fallbackTitle, config.hrefPrefix))
            .filter(Boolean) as RelatedRecord[];

          if (records.length > 0) {
            nextSections.push({ key: config.key, title: config.title, records });
          }

          break;
        } catch {
          continue;
        }
      }
    }

    setRelatedSections(nextSections);
  }


  async function handleSave() {
    if (!editedClient || !client) return;

    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch(`${appBaseUrl}/api/opc/update-client-details`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: resolvedClientId,
          editedClient,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Änderungen konnten nicht gespeichert werden.');
      }

      await loadClientData(resolvedClientId);
      setEditMode(false);
      setSuccessMessage('Änderungen wurden gespeichert.');
    } catch (err: any) {
      console.error('[ClientDetail] Save failed:', err);
      setError(err?.message || 'Änderungen konnten nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  async function grantPortalAccess() {
    if (!client) return;

    setGrantingPortal(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/opc/grant-client-portal-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: resolvedClientId }),
      });

      const result = (await response.json()) as any;

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Portalzugang konnte nicht freigeschaltet werden.');
      }

      await Promise.all([loadClientUser(resolvedClientId), loadClientData(resolvedClientId)]);
      setSuccessMessage('Portalzugang wurde freigeschaltet. Der Kunde kann jetzt eingeladen werden.');
    } catch (err: any) {
      setError(err?.message || 'Portalzugang konnte nicht freigeschaltet werden.');
    } finally {
      setGrantingPortal(false);
    }
  }

  async function sendClientEmailAction() {
    if (!client) return;

    setSendingEmail(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/opc/client-email-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: resolvedClientId, action: emailAction }),
      });

      const result = (await response.json()) as any;

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'E-Mail konnte nicht gesendet werden.');
      }

      await loadClientUser(resolvedClientId);

      const labels: Record<EmailAction, string> = {
        account_setup: 'Konto-Setup E-Mail wurde gesendet.',
        password_reset: 'Passwort-zurücksetzen E-Mail wurde gesendet.',
        magic_link: 'Magic-Link E-Mail wurde gesendet.',
        portal_invite: 'Portal-Einladung wurde gesendet.',
      };

      setSuccessMessage(labels[emailAction]);
    } catch (err: any) {
      setError(err?.message || 'E-Mail konnte nicht gesendet werden.');
    } finally {
      setSendingEmail(false);
    }
  }

  async function sendThankYouEmail(job: OpcJob) {
    setSendingThankYouJobId(job.job_id);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/opc/send-job-thank-you-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.job_id }),
      });

      const result = (await response.json()) as any;

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Danke-E-Mail konnte nicht gesendet werden.');
      }

      setSuccessMessage('Danke-E-Mail wurde gesendet.');
    } catch (err: any) {
      setError(err?.message || 'Danke-E-Mail konnte nicht gesendet werden.');
    } finally {
      setSendingThankYouJobId(null);
    }
  }

  function handleCancel() {
    setEditedClient(client);
    setEditMode(false);
    setError('');
    setSuccessMessage('');
  }

  function copyBillingAddressToSite() {
    setEditedClient((prev) => {
      if (!prev) return prev;

      const parsed = parseAddressParts(prev.billing_address);

      return {
        ...prev,
        primary_site_address: parsed.addressText,
        primary_site_postal_code: parsed.postalCode,
        primary_site_city: parsed.city,
        primary_site_country: prev.primary_site_country || 'CH',
        primary_site_name: prev.primary_site_name || prev.billing_name || prev.company_name || 'Hauptstandort',
        primary_site_type: prev.primary_site_type || 'other',
      };
    });
  }

  function copySiteAddressToBilling() {
    setEditedClient((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        billing_address: buildAddressLine(
          prev.primary_site_address,
          prev.primary_site_postal_code,
          prev.primary_site_city
        ),
      };
    });
  }


  function startInspection() {
    if (!client) return;

    const params = new URLSearchParams();
    params.set('client_id', resolvedClientId);

    if (client.primary_site_id) params.set('site_id', client.primary_site_id);
    if (client.contact_id) params.set('contact_id', client.contact_id);

    window.location.href = `${appBaseUrl}/besichtigung/neu?${params.toString()}`;
  }

  function startQuote() {
    if (!client) return;

    const params = new URLSearchParams();
    params.set('client_id', resolvedClientId);

    if (client.primary_site_id) params.set('site_id', client.primary_site_id);
    if (client.contact_id) params.set('contact_id', client.contact_id);

    window.location.href = `${appBaseUrl}/offerte/neu?${params.toString()}`;
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
      <div style={fieldItemStyle}>
        <label style={labelStyle}>{label}</label>

        {editMode && field && !options?.disabled ? (
          inputType === 'textarea' ? (
            <textarea
              value={String(editedClient?.[field] || '')}
              onChange={(event) => updateEditedClient(field, event.target.value as any)}
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '96px', paddingTop: '12px' }}
            />
          ) : inputType === 'select' ? (
            <select
              value={String(editedClient?.[field] || '')}
              onChange={(event) => updateEditedClient(field, event.target.value as any)}
              style={inputStyle}
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
              style={inputStyle}
            />
          )
        ) : (
          <p style={valueStyle}>{valueOrDash(value)}</p>
        )}
      </div>
    );
  }

  if (!mounted) return null;

  if (loadingClient) {
    return (
      <OPCPageShell>
        <div style={loadingCardStyle}>Kundendaten werden geladen.</div>
      </OPCPageShell>
    );
  }

  if (error && !client) {
    return (
      <OPCPageShell>
        <div style={errorCardStyle}>
          <p style={errorTextStyle}>{error}</p>
          <a href={`${appBaseUrl}/kunden`} style={{ ...opcBlackButtonStyle, width: 'auto' }}>
            <ArrowLeft size={16} />
            Zurück zu Kunden
          </a>
        </div>
      </OPCPageShell>
    );
  }

  if (!client || !displayClient) return null;

  return (
    <OPCPageShell>
      <div style={topBarStyle}>
        <a href={`${appBaseUrl}/kunden`} style={backLinkStyle}>
          <ArrowLeft size={16} />
          Zurück zu Kunden
        </a>

        <div style={actionRowStyle}>
          {!editMode ? (
            <>
              {isAdminOrOwner && (
                <button onClick={() => setEditMode(true)} style={{ ...opcBlackButtonStyle, width: 'auto' }}>
                  <Edit2 size={16} />
                  Bearbeiten
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={handleCancel} disabled={saving} style={{ ...opcSecondaryButtonStyle, width: 'auto' }}>
                <X size={16} />
                Abbrechen
              </button>

              <button onClick={handleSave} disabled={saving} style={{ ...opcBlackButtonStyle, width: 'auto' }}>
                <Save size={16} />
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
            </>
          )}
        </div>
      </div>

      <section style={heroStyle}>
        <div style={heroContentStyle}>
          <div style={heroIdentityStyle}>
            <div style={avatarStyle}>
              {getInitials(displayClient.billing_name || displayClient.company_name)}
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={statusRowStyle}>
                <span style={statusBadgeStyle}>{getStatusLabel(displayClient.status)}</span>
                <span style={smallMutedStyle}>Erstellt am {formatDate(displayClient.created_at)}</span>
              </div>

              <h1 style={titleStyle}>
                {displayClient.billing_name || displayClient.company_name || 'Kundendetails'}
              </h1>

              <p style={subtitleStyle}>
                {valueOrDash(displayClient.full_name)} · {valueOrDash(displayClient.email || displayClient.billing_email)}
              </p>
            </div>
          </div>

          {(displayClient.phone_e164 || displayClient.phone_raw || displayClient.billing_phone_e164) && (
            <a
              href={`tel:${displayClient.phone_e164 || displayClient.phone_raw || displayClient.billing_phone_e164}`}
              style={phoneButtonStyle}
              aria-label="Kunden anrufen"
              title="Kunden anrufen"
            >
              <PhoneCall size={20} />
            </a>
          )}
        </div>
      </section>

      {successMessage && (
        <div style={successAlertStyle}>
          <Check size={16} />
          {successMessage}
        </div>
      )}

      {error && <div style={errorAlertStyle}>{error}</div>}

      <div style={metricsGridStyle}>
        <OPCMetricCard value={displayClient.active_site_count} label="Standort(e)" icon={<Building2 size={18} />} />
        <OPCMetricCard value={jobs.length} label="Einsätze" icon={<Briefcase size={18} />} />
        <OPCMetricCard value={hasPortalAccess ? 'Aktiv' : 'Intern'} label="Portalzugang" icon={<LockKeyhole size={18} />} />
        <OPCMetricCard value={formatDate(displayClient.last_activity_at)} label="Letzte Aktivität" icon={<Clock size={18} />} />
      </div>

      {canManageSalesPipeline && !editMode && (
        <div style={primaryActionGridStyle}>
          <button type="button" onClick={startInspection} style={primaryActionLightStyle}>
            <ClipboardList size={16} />
            Besichtigung starten
          </button>

          <button type="button" onClick={startQuote} style={primaryActionDarkStyle}>
            <FileText size={16} />
            Offerte erstellen
          </button>
        </div>
      )}

      <div style={topGridStyle}>
        <OPCListCard>
          <CardHeader icon={<Building2 size={18} />} title="Kundendaten" />

          <div style={fieldStackStyle}>
            {renderField('Rechnungsname', displayClient.billing_name, 'billing_name')}
            {renderField('Firmenname', displayClient.company_name, 'company_name')}
            {renderField('Kundentyp', displayClient.client_type, 'client_type', {
              type: 'select',
              selectOptions: [
                { value: 'geschaeftskunden', label: 'Geschäftskunde' },
                { value: 'privatkunden', label: 'Privatkunde' },
                { value: 'baukunden', label: 'Baukunde' },
                { value: 'unknown', label: 'Unbekannt' },
              ],
            })}
            {renderField('Status', getStatusLabel(displayClient.status), 'status', {
              type: 'select',
              selectOptions: [
                { value: 'active', label: 'Aktiv' },
                { value: 'pending', label: 'Offen' },
                { value: 'inactive', label: 'Inaktiv' },
                { value: 'archived', label: 'Archiviert' },
              ],
            })}
          </div>
        </OPCListCard>

        <OPCListCard>
          <CardHeader icon={<User size={18} />} title="Kontakt" />

          <div style={fieldStackStyle}>
            {renderField('Kontaktperson', displayClient.full_name, 'full_name')}
            {renderField('E-Mail', displayClient.email || displayClient.billing_email, 'email', { type: 'email' })}
            {renderField('Telefon', displayClient.phone_e164 || displayClient.phone_raw || displayClient.billing_phone_e164, 'phone_raw', { type: 'tel' })}
            {renderField('Lifecycle', displayClient.lifecycle_stage, undefined, { disabled: true })}
          </div>
        </OPCListCard>
      </div>

      <div style={infoGridStyle}>
        <OPCListCard>
          <CardHeader icon={<MapPin size={18} />} title="Standort" />

          {editMode && (
            <div style={copyButtonsStyle}>
              <button type="button" onClick={copyBillingAddressToSite} style={smallLightButtonStyle}>
                Standort aus Rechnungsadresse übernehmen
              </button>

              <button type="button" onClick={copySiteAddressToBilling} style={smallDarkButtonStyle}>
                Rechnungsadresse = Standort
              </button>
            </div>
          )}

          <div style={fieldStackStyle}>
            {renderField('Standortname', displayClient.primary_site_name, 'primary_site_name')}
            {renderField('Standorttyp', getSiteTypeLabel(displayClient.primary_site_type), 'primary_site_type', {
              type: 'select',
              selectOptions: SITE_TYPE_OPTIONS,
            })}
            {renderField('Adresse', displayClient.primary_site_address, 'primary_site_address')}
            {renderField('PLZ', displayClient.primary_site_postal_code, 'primary_site_postal_code')}
            {renderField('Ort', displayClient.primary_site_city, 'primary_site_city')}
            {renderField('Land', displayClient.primary_site_country, 'primary_site_country')}
          </div>
        </OPCListCard>

        <OPCListCard>
          <CardHeader icon={<FileText size={18} />} title="Verrechnung & Notizen" />

          <div style={fieldStackStyle}>
            {renderField('Rechnungs-E-Mail', displayClient.billing_email, 'billing_email', { type: 'email' })}
            {renderField('Rechnungstelefon', displayClient.billing_phone_e164, 'billing_phone_e164', { type: 'tel' })}
            {renderField('Rechnungsadresse', displayClient.billing_address, 'billing_address')}
            {renderField('Interne Notizen', displayClient.internal_notes, 'internal_notes', { type: 'textarea' })}
          </div>
        </OPCListCard>
      </div>

      {(loadingJobs || jobError || jobs.length > 0) && (
        <section style={{ marginTop: '22px' }}>
          <OPCListCard>
            <div style={jobsHeaderStyle}>
              <CardHeader icon={<Briefcase size={18} />} title="Einsätze" />
              <span style={countBadgeStyle}>{jobs.length}</span>
            </div>

            {jobError && <div style={errorAlertStyle}>{jobError}</div>}

            {loadingJobs ? (
              <div style={emptyJobsStyle}>Einsätze werden geladen.</div>
            ) : jobs.length === 0 ? null : (
              <div>
                {jobs.map((job, index) => (
                  <div
                    key={job.job_id}
                    style={{
                      ...jobRowStyle,
                      borderBottom: index < jobs.length - 1 ? '1px solid #F3F4F6' : 'none',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={jobTitleStyle}>{job.title || 'Einsatz'}</div>
                      <div style={jobMetaStyle}>
                        {[job.service_category, job.site_name, job.address_text, job.city].filter(Boolean).join(' · ')}
                      </div>
                    </div>

                    <div style={jobDateStyle}>
                      <Calendar size={15} />
                      {formatDateTime(job.planned_start)}
                    </div>

                    <span style={statusBadgeStyle}>{getStatusLabel(job.status)}</span>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      {isCompletedJob(job.status) ? (
                        <button
                          type="button"
                          onClick={() => sendThankYouEmail(job)}
                          disabled={sendingThankYouJobId === job.job_id}
                          style={{ ...opcSecondaryButtonStyle, width: 'auto', height: '38px' }}
                        >
                          <Mail size={15} />
                          {sendingThankYouJobId === job.job_id ? 'Sendet...' : 'Danke senden'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </OPCListCard>
        </section>
      )}

      {typeof relatedSections !== 'undefined' && relatedSections.map((section) => (
        <section key={section.key} style={{ marginTop: '22px' }}>
          <OPCListCard>
            <div style={jobsHeaderStyle}>
              <CardHeader icon={<FileText size={18} />} title={section.title} />
              <span style={countBadgeStyle}>{section.records.length}</span>
            </div>

            <div>
              {section.records.map((record, index) => {
                const content = (
                  <>
                    <div style={{ minWidth: 0 }}>
                      <div style={jobTitleStyle}>{record.title}</div>
                      <div style={jobMetaStyle}>{record.meta || 'Keine Details hinterlegt'}</div>
                    </div>
                    <span style={statusBadgeStyle}>{record.status ? getStatusLabel(record.status) : 'Gespeichert'}</span>
                  </>
                );

                return record.href ? (
                  <a
                    key={record.id}
                    href={record.href}
                    style={{
                      ...relatedRowStyle,
                      borderBottom: index < section.records.length - 1 ? '1px solid #F3F4F6' : 'none',
                    }}
                  >
                    {content}
                  </a>
                ) : (
                  <div
                    key={record.id}
                    style={{
                      ...relatedRowStyle,
                      borderBottom: index < section.records.length - 1 ? '1px solid #F3F4F6' : 'none',
                    }}
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </OPCListCard>
        </section>
      ))}

      <section style={{ marginTop: '22px' }}>
        <OPCListCard>
          <CardHeader icon={<LockKeyhole size={18} />} title="Portal & E-Mail Aktionen" />

          <div style={portalBoxStyle}>
            <div>
              <span style={labelStyle}>Portalstatus</span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={statusBadgeStyle}>
                  {hasPortalAccess ? getStatusLabel(clientUser?.status || 'active') : 'Kein Portalzugang'}
                </span>

                {clientUser?.email && <span style={smallMutedStyle}>{clientUser.email}</span>}
              </div>
            </div>

            {!hasPortalAccess && isAdminOrOwner && (
              <button
                type="button"
                onClick={grantPortalAccess}
                disabled={grantingPortal}
                style={{ ...opcBlackButtonStyle, width: 'auto' }}
              >
                <LockKeyhole size={16} />
                {grantingPortal ? 'Wird freigeschaltet...' : 'Portal freischalten'}
              </button>
            )}
          </div>

          <div style={emailActionGridStyle}>
            <select
              value={emailAction}
              onChange={(event) => setEmailAction(event.target.value as EmailAction)}
              style={opcSelectStyle}
            >
              <option value="account_setup">Konto Setup senden</option>
              <option value="password_reset">Passwort zurücksetzen</option>
              <option value="magic_link">Magic Link senden</option>
              <option value="portal_invite">Portal Einladung erneut senden</option>
            </select>

            <button
              type="button"
              onClick={sendClientEmailAction}
              disabled={sendingEmail}
              style={{ ...opcBlackButtonStyle, width: 'auto' }}
            >
              <Send size={16} />
              {sendingEmail ? 'Wird gesendet...' : 'E-Mail senden'}
            </button>
          </div>

          <p style={helperTextStyle}>
            Konto Setup, Passwort zurücksetzen, Magic Link und Portal Einladung laufen über Supabase Auth SMTP.
          </p>
        </OPCListCard>
      </section>

      <style>{`
        ${opcResponsiveStyle}

        @media (max-width: 760px) {
          a[style*="grid-template-columns"],
          div[style*="grid-template-columns"] {
            min-width: 0;
          }
        }
      `}</style>
    </OPCPageShell>
  );
}


function CardHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={cardHeaderStyle}>
      {icon}
      <h2 style={cardTitleStyle}>{title}</h2>
    </div>
  );
}

const primaryActionGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '12px',
  marginTop: '22px',
  marginBottom: '22px',
};

const primaryActionLightStyle: CSSProperties = {
  ...opcSecondaryButtonStyle,
  width: '100%',
  height: '46px',
  borderRadius: '14px',
};

const primaryActionDarkStyle: CSSProperties = {
  ...opcBlackButtonStyle,
  width: '100%',
  height: '46px',
  borderRadius: '14px',
};

const topBarStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  marginBottom: '22px',
};

const backLinkStyle: CSSProperties = {
  height: '42px',
  padding: '0 14px',
  borderRadius: '13px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  fontSize: '13px',
  fontWeight: 760,
  fontFamily: OPC_PAGE_FONT,
  cursor: 'pointer',
  textDecoration: 'none',
};

const actionRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '10px',
  flexWrap: 'wrap',
};

const heroStyle: CSSProperties = {
  background: '#FFFFFF',
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: '20px',
  padding: '22px',
  marginBottom: '22px',
};


const heroContentStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '18px',
};

const heroIdentityStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '18px',
};

const avatarStyle: CSSProperties = {
  width: '64px',
  height: '64px',
  borderRadius: '18px',
  background: OPC_BRAND.black,
  color: '#FFFFFF',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '18px',
  fontWeight: 820,
  flexShrink: 0,
};


const phoneButtonStyle: CSSProperties = {
  width: '52px',
  height: '52px',
  borderRadius: '17px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
  flex: '0 0 auto',
};

const statusRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap',
  marginBottom: '10px',
};

const statusBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '29px',
  padding: '0 11px',
  borderRadius: '999px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#F9FAFB',
  color: OPC_BRAND.muted,
  fontSize: '12px',
  fontWeight: 760,
  whiteSpace: 'nowrap',
};

const smallMutedStyle: CSSProperties = {
  fontSize: '13px',
  color: OPC_BRAND.muted,
  fontWeight: 620,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '30px',
  lineHeight: 1.08,
  letterSpacing: '-0.045em',
  fontWeight: 860,
  color: OPC_BRAND.text,
};

const subtitleStyle: CSSProperties = {
  margin: '10px 0 0',
  fontSize: '14px',
  color: OPC_BRAND.muted,
  fontWeight: 620,
};

const successAlertStyle: CSSProperties = {
  marginBottom: '22px',
  padding: '14px 16px',
  borderRadius: '14px',
  border: '1px solid #BBF7D0',
  background: '#F0FDF4',
  color: OPC_BRAND.green,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '14px',
  fontWeight: 700,
};

const errorAlertStyle: CSSProperties = {
  marginBottom: '22px',
  padding: '14px 16px',
  borderRadius: '14px',
  border: '1px solid #FCA5A5',
  background: '#FEF2F2',
  color: '#991B1B',
  fontSize: '14px',
  fontWeight: 700,
};

const topGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: '22px',
};

const infoGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: '22px',
  marginTop: '22px',
};

const metricsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '22px',
  marginTop: '22px',
};

const cardHeaderStyle: CSSProperties = {
  padding: '18px 20px',
  borderBottom: '1px solid #F3F4F6',
  display: 'flex',
  alignItems: 'center',
  gap: '9px',
};

const cardTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '15px',
  fontWeight: 820,
  color: OPC_BRAND.text,
};

const fieldStackStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: '18px',
  padding: '20px',
  alignItems: 'start',
};

const fieldItemStyle: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 760,
  color: OPC_BRAND.faint,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '7px',
  lineHeight: 1.15,
  overflowWrap: 'anywhere',
};

const valueStyle: CSSProperties = {
  margin: 0,
  fontSize: '14px',
  fontWeight: 720,
  color: OPC_BRAND.text,
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
};

const inputStyle: CSSProperties = {
  ...opcInputStyle,
  height: '44px',
};

const portalBoxStyle: CSSProperties = {
  padding: '20px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '14px',
  borderBottom: '1px solid #F3F4F6',
};

const emailActionGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: '14px',
  padding: '20px 20px 0',
};

const helperTextStyle: CSSProperties = {
  padding: '0 20px 20px',
  margin: '12px 0 0',
  fontSize: '12px',
  fontWeight: 580,
  color: OPC_BRAND.muted,
  lineHeight: 1.5,
};

const copyButtonsStyle: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  padding: '16px 20px 0',
};

const smallLightButtonStyle: CSSProperties = {
  height: '38px',
  padding: '0 13px',
  borderRadius: '12px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  fontSize: '12px',
  fontWeight: 760,
  cursor: 'pointer',
  fontFamily: OPC_PAGE_FONT,
};

const smallDarkButtonStyle: CSSProperties = {
  height: '38px',
  padding: '0 13px',
  borderRadius: '12px',
  border: `1px solid ${OPC_BRAND.black}`,
  background: OPC_BRAND.black,
  color: '#FFFFFF',
  fontSize: '12px',
  fontWeight: 760,
  cursor: 'pointer',
  fontFamily: OPC_PAGE_FONT,
};

const jobsHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: '1px solid #F3F4F6',
};

const countBadgeStyle: CSSProperties = {
  marginRight: '20px',
  height: '28px',
  padding: '0 10px',
  borderRadius: '999px',
  background: '#F9FAFB',
  color: OPC_BRAND.muted,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
  fontWeight: 760,
};

const emptyJobsStyle: CSSProperties = {
  padding: '40px 20px',
  textAlign: 'center',
  color: OPC_BRAND.muted,
  fontSize: '14px',
  fontWeight: 700,
};


const relatedRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: '18px',
  padding: '18px 20px',
  color: OPC_BRAND.text,
  textDecoration: 'none',
};

const jobRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(260px, 1fr) 180px 140px 150px',
  alignItems: 'center',
  gap: '18px',
  padding: '18px 20px',
};

const jobTitleStyle: CSSProperties = {
  fontSize: '15px',
  fontWeight: 800,
  color: OPC_BRAND.text,
  marginBottom: '7px',
};

const jobMetaStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: OPC_BRAND.muted,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
};

const jobDateStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  fontWeight: 700,
  color: OPC_BRAND.text,
};

const loadingCardStyle: CSSProperties = {
  minHeight: '60vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: OPC_BRAND.muted,
  fontSize: '14px',
  fontWeight: 650,
  fontFamily: OPC_PAGE_FONT,
};

const errorCardStyle: CSSProperties = {
  padding: '34px',
  background: '#FFFFFF',
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: '20px',
};

const errorTextStyle: CSSProperties = {
  color: '#991B1B',
  fontWeight: 700,
};
