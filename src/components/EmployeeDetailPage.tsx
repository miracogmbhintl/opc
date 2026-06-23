import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  GraduationCap,
  HeartHandshake,
  Landmark,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Save,
  ShieldCheck,
  Upload,
  UserRound,
  UsersRound,
} from 'lucide-react';
import MirakaDashboardShell from './MirakaDashboardShell';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';

type JsonRow = Record<string, any>;
type JsonArray = JsonRow[];

type EmployeeDetailPageProps = {
  employeeId: string;
};

type ApiPayload = {
  success: boolean;
  role?: 'owner' | 'admin';
  canManagePayroll?: boolean;
  detail?: JsonRow;
  error?: string;
};

type DayRule = {
  day_of_week: number;
  label: string;
  enabled: boolean;
  start_time: string;
  end_time: string;
  availability_type: string;
};

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  black: '#0F1115',
  card: '#FFFFFF',
  soft: '#FAFAFA',
  green: '#166534',
  red: '#B91C1C',
  amber: '#92400E',
  blue: '#155E75',
};

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

const cardStyle: CSSProperties = {
  background: BRAND.card,
  border: `1px solid ${BRAND.border}`,
  borderRadius: '20px',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

const DAY_LABELS: Record<number, string> = {
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
  6: 'Samstag',
  7: 'Sonntag',
};

function normalize(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function asArray(value: unknown): JsonArray {
  return Array.isArray(value) ? (value as JsonArray) : [];
}

function safeObject(value: unknown): JsonRow {
  if (value && typeof value === 'object' && !Array.isArray(value)) return { ...(value as JsonRow) };
  return {};
}

function formatDate(value?: string | null) {
  if (!value) return 'Nicht hinterlegt';
  const date = new Date(`${value}`.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return 'Nicht hinterlegt';
  return new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Nicht hinterlegt';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Nicht hinterlegt';
  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function formatStatus(value?: string | null) {
  const labels: Record<string, string> = {
    onboarding: 'Onboarding', active: 'Aktiv', inactive: 'Inaktiv', suspended: 'Gesperrt',
    terminated: 'Ausgetreten', archived: 'Archiviert', available: 'Verfügbar', limited: 'Eingeschränkt',
    unavailable: 'Nicht verfügbar', on_leave: 'Abwesend', complete: 'Vollständig', incomplete: 'Unvollständig',
    in_review: 'In Prüfung', update_required: 'Aktualisierung nötig', verified: 'Verifiziert',
    unverified: 'Nicht verifiziert', valid: 'Gültig', pending: 'Ausstehend', renewal_pending: 'Verlängerung offen',
    expired: 'Abgelaufen', not_required: 'Nicht erforderlich', hourly: 'Stundenlohn', monthly: 'Monatslohn',
    identity_document: 'Identitätsdokument', passport: 'Pass', permit: 'Bewilligung',
    cross_border_certificate: 'Grenzgängerbescheinigung', a1_certificate: 'A1-Bescheinigung',
    ahv_document: 'AHV-Dokument', bank_document: 'Bankbeleg',
    family_allowance_document: 'Familienzulagen', tax_document: 'Steuerdokument',
    insurance_document: 'Versicherungsdokument', medical_certificate: 'Arztzeugnis',
    employment_contract: 'Arbeitsvertrag', contract_addendum: 'Vertragsnachtrag',
    hourly_employment: 'Arbeitsvertrag · Stundenlohn',
    monthly_employment: 'Arbeitsvertrag · Monatslohn',
    fixed_term_employment: 'Arbeitsvertrag · Befristet',
    temporary_employment: 'Arbeitsvertrag · Temporär',
    apprenticeship_contract: 'Lehrvertrag',
    external_service_contract: 'Vertrag · Externe Fachkraft',
    other: 'Andere Datei',
  };
  const key = normalize(value);
  return labels[key] || key.replaceAll('_', ' ') || 'Nicht hinterlegt';
}

function formatPersonnelType(value?: string | null) {
  const labels: Record<string, string> = {
    employee: 'Mitarbeiter/in', owner_employee: 'Inhaber/in mit Anstellung', external_contractor: 'Externe Fachkraft',
    external_infrastructure: 'Externe Infrastruktur', agency_worker: 'Temporär über Agentur',
    temporary_external: 'Temporäre externe Kraft', intern: 'Praktikum', apprentice: 'Lernende/r', other: 'Andere',
  };
  return labels[normalize(value)] || value || 'Nicht klassifiziert';
}

function formatQualification(value?: string | null) {
  const labels: Record<string, string> = {
    none: 'Keine formelle Ausbildung', compulsory_school: 'Obligatorische Schule',
    internal_cleaning_level_ii: 'Branchenweiterbildung Stufe II', eba: 'EBA', efz: 'EFZ',
    federal_professional_certificate: 'Eidg. Fachausweis', federal_diploma: 'Eidg. Diplom', hf: 'HF',
    bachelor: 'Bachelor', master: 'Master', doctorate: 'Doktorat', foreign_vocational: 'Ausländische Berufsausbildung',
    foreign_academic: 'Ausländischer Hochschulabschluss', other: 'Andere',
  };
  return labels[normalize(value)] || value || 'Nicht hinterlegt';
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
}

function employeeName(detail: JsonRow | null) {
  const employee = detail?.employee || {};
  return employee.preferred_name || [employee.legal_first_name, employee.legal_last_name].filter(Boolean).join(' ') || 'Mitarbeiter';
}

function addressText(address: JsonRow | null) {
  if (!address) return '';
  return [
    [address.street, address.house_number].filter(Boolean).join(' '),
    address.address_addition,
    [address.postal_code, address.city].filter(Boolean).join(' '),
    address.country_code,
  ].filter(Boolean).join(', ');
}

function maskAhv(value?: string | null) {
  const text = String(value || '').trim();
  if (!text) return 'Nicht hinterlegt';
  const digits = text.replace(/\D/g, '');
  if (digits.length < 6) return text;
  return `${digits.slice(0, 3)}.••••.••${digits.slice(-2)}`;
}

function statusVisual(detail: JsonRow | null) {
  const status = normalize(detail?.employee?.status);
  if (status === 'active') return { label: 'Aktiv', color: '#16A34A', background: '#DCFCE7', border: '#86EFAC' };
  if (status === 'onboarding') return { label: 'Onboarding', color: '#F59E0B', background: '#FEF3C7', border: '#FDE68A' };
  if (status === 'suspended') return { label: 'Gesperrt', color: '#DC2626', background: '#FEE2E2', border: '#FECACA' };
  return { label: formatStatus(status), color: '#111827', background: '#F3F4F6', border: '#D1D5DB' };
}

async function token() {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Keine aktive Sitzung gefunden.');
  return accessToken;
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const accessToken = await token();
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Accept', 'application/json');
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const payload = (await response.json().catch(() => ({}))) as any;
  if (!response.ok) throw new Error(payload?.error || 'Anfrage fehlgeschlagen.');
  return payload as T;
}

function MetricCard({ label, value, helper, icon }: { label: string; value: ReactNode; helper?: ReactNode; icon: ReactNode }) {
  return (
    <div className="opc-employee-metric-card">
      <div><div className="opc-employee-metric-value">{value}</div><div className="opc-employee-metric-label">{label}</div>{helper ? <div className="opc-employee-metric-helper">{helper}</div> : null}</div>
      <div className="opc-employee-metric-icon">{icon}</div>
    </div>
  );
}

function MiniField({ label, value }: { label: string; value: ReactNode }) {
  const hasValue = value !== null && value !== undefined && value !== '';
  return <div className="opc-employee-mini-field"><span>{label}</span><strong>{hasValue ? value : 'Nicht hinterlegt'}</strong></div>;
}

function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="opc-employee-detail-card"><h3>{title}</h3><div>{children}</div></section>;
}

function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return <div className="opc-employee-section-header"><h2>{title}</h2>{action}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="opc-edit-field"><span>{label}</span>{children}</label>;
}

function makeDayRules(detail: JsonRow | null): DayRule[] {
  const rules = asArray(detail?.availability_rules);
  return Array.from({ length: 7 }, (_, index) => {
    const day = index + 1;
    const row = rules.find((item) => Number(item.day_of_week) === day && item.is_active !== false);
    return {
      day_of_week: day,
      label: DAY_LABELS[day],
      enabled: Boolean(row),
      start_time: String(row?.start_time || '08:00').slice(0, 5),
      end_time: String(row?.end_time || '17:00').slice(0, 5),
      availability_type: row?.availability_type || 'available',
    };
  });
}

function makeDraft(detail: JsonRow | null) {
  const employee = safeObject(detail?.employee);
  const address = safeObject(detail?.current_address);
  const nationality = safeObject(detail?.current_nationality);
  const permit = safeObject(detail?.current_permit);
  const bank = safeObject(detail?.current_bank_account);
  const qualification = safeObject(detail?.primary_qualification);
  const availability = safeObject(detail?.availability_profile);
  const emergency = safeObject(asArray(detail?.emergency_contacts)[0]);

  return {
    legal_first_name: employee.legal_first_name || '', legal_last_name: employee.legal_last_name || '', preferred_name: employee.preferred_name || '',
    date_of_birth: employee.date_of_birth || '', gender_code: employee.gender_code || '', civil_status: employee.civil_status || '',
    birth_place: employee.birth_place || '', citizenship_place: employee.citizenship_place || '', ahv_number: employee.ahv_number || '',
    private_email: employee.private_email || '', business_email: employee.business_email || '', phone_raw: employee.phone_raw || employee.phone_e164 || '',
    fax_number: employee.fax_number || '', preferred_language: employee.preferred_language || 'de-CH', status: employee.status || 'onboarding',
    assignment_status: employee.assignment_status || 'available', profile_completion_status: employee.profile_completion_status || 'incomplete',
    personnel_type: employee.personnel_type || 'employee', payroll_in_scope: employee.payroll_in_scope !== false,
    portal_access_only: employee.portal_access_only === true, payroll_exclusion_reason: employee.payroll_exclusion_reason || '',
    employing_entity_id: employee.employing_entity_id || '', operational_position_id: detail?.operational_position?.id || '',
    entry_date: employee.entry_date || '', exit_date: employee.exit_date || '', us_tax_person: employee.us_tax_person === true,
    internal_notes: employee.internal_notes || '',
    address: {
      street: address.street || '', house_number: address.house_number || '', address_addition: address.address_addition || '',
      postal_code: address.postal_code || '', city: address.city || '', canton_code: address.canton_code || '', country_code: address.country_code || 'CH',
    },
    nationality: { country_code: nationality.country_code || '' },
    permit: {
      permit_type: permit.permit_type || '', permit_number: permit.permit_number || '', permit_status: permit.permit_status || 'valid',
      issuing_country_code: permit.issuing_country_code || 'CH', issuing_canton_code: permit.issuing_canton_code || '',
      is_cross_border_permit: permit.is_cross_border_permit === true, valid_from: permit.valid_from || '', valid_until: permit.valid_until || '', notes: permit.notes || '',
    },
    bank_account: {
      bank_name: bank.bank_name || '', bank_address_line1: bank.bank_address_line1 || '', bank_postal_code: bank.bank_postal_code || '',
      bank_city: bank.bank_city || '', bank_country_code: bank.bank_country_code || 'CH', iban: bank.iban || '', bic: bank.bic || '',
      account_holder: bank.account_holder || '', currency_code: bank.currency_code || 'CHF', verification_status: bank.verification_status || 'unverified', notes: bank.notes || '',
    },
    qualification: {
      qualification_level_code: qualification.qualification_level_code || 'none', qualification_title: qualification.qualification_title || 'Keine formelle Ausbildung',
      field_of_study: qualification.field_of_study || '', institution_name: qualification.institution_name || '', country_code: qualification.country_code || '',
      completed_on: qualification.completed_on || '', swiss_recognition_status: qualification.swiss_recognition_status || 'not_required',
      relevant_for_cleaning_gav: qualification.relevant_for_cleaning_gav === true, relevant_for_current_position: qualification.relevant_for_current_position !== false,
      verification_status: qualification.verification_status || 'unverified', notes: qualification.notes || '',
    },
    availability: {
      availability_mode: availability.availability_mode || 'weekly_schedule', timezone: availability.timezone || 'Europe/Zurich',
      short_notice_available: availability.short_notice_available === true, minimum_notice_hours: availability.minimum_notice_hours ?? '',
      weekend_available: availability.weekend_available === true, saturday_available: availability.saturday_available === true,
      sunday_available: availability.sunday_available === true, public_holiday_available: availability.public_holiday_available === true,
      night_work_available: availability.night_work_available === true, preferred_weekly_hours: availability.preferred_weekly_hours ?? '',
      maximum_weekly_hours: availability.maximum_weekly_hours ?? '', notes: availability.notes || '',
    },
    emergency_contact: {
      full_name: emergency.full_name || '', relationship_label: emergency.relationship_label || '', phone_raw: emergency.phone_raw || emergency.phone_e164 || '',
      email: emergency.email || '', preferred_language: emergency.preferred_language || 'de-CH', notes: emergency.notes || '',
    },
  };
}

export default function EmployeeDetailPage({ employeeId }: EmployeeDetailPageProps) {
  const [detail, setDetail] = useState<JsonRow | null>(null);
  const [role, setRole] = useState<'owner' | 'admin' | ''>('');
  const [canManagePayroll, setCanManagePayroll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<JsonRow>(() => makeDraft(null));
  const [dayRules, setDayRules] = useState<DayRule[]>(() => makeDayRules(null));
  const [selectedSkills, setSelectedSkills] = useState<Record<string, JsonRow>>({});
  const [errorMessage, setErrorMessage] = useState('');
  const [message, setMessage] = useState('');
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [noteTitle, setNoteTitle] = useState('');
  const [documentType, setDocumentType] = useState('identity_document');
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentValidUntil, setDocumentValidUntil] = useState('');
  const [contractUploading, setContractUploading] = useState(false);
  const [contractSubtype, setContractSubtype] = useState('hourly_employment');
  const [contractTitle, setContractTitle] = useState('');
  const [contractValidFrom, setContractValidFrom] = useState('');
  const detailStripRef = useRef<HTMLDivElement | null>(null);

  const loadDetail = useCallback(async (showLoader = true) => {
    if (!employeeId) return;
    if (showLoader) setLoading(true);
    setErrorMessage('');
    try {
      const payload = await apiRequest<ApiPayload>(`/api/opc/employees/${employeeId}`);
      const next = payload.detail || null;
      setDetail(next);
      setRole(payload.role || '');
      setCanManagePayroll(payload.canManagePayroll === true);
      setDraft(makeDraft(next));
      setDayRules(makeDayRules(next));
      const skillsMap: Record<string, JsonRow> = {};
      asArray(next?.skills).filter((skill) => skill.is_active !== false).forEach((skill) => { skillsMap[String(skill.skill_id)] = { ...skill }; });
      setSelectedSkills(skillsMap);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Mitarbeiter konnte nicht geladen werden.');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => { void loadDetail(true); }, [loadDetail]);

  const employee = safeObject(detail?.employee);
  const staff = safeObject(detail?.staff_role);
  const entity = safeObject(detail?.legal_entity);
  const address = safeObject(detail?.current_address);
  const permit = safeObject(detail?.current_permit);
  const bank = safeObject(detail?.current_bank_account);
  const qualification = safeObject(detail?.primary_qualification);
  const availability = safeObject(detail?.availability_profile);
  const position = safeObject(detail?.operational_position);
  const name = employeeName(detail);
  const visual = statusVisual(detail);
  const skills = asArray(detail?.skills).filter((skill) => skill.is_active !== false);
  const documents = asArray(detail?.documents);
  const notes = asArray(detail?.notes);
  const emergency = safeObject(asArray(detail?.emergency_contacts)[0]);
  const contracts = asArray(detail?.contracts);
  const contractDocuments = documents.filter((document) =>
    ['employment_contract', 'contract_addendum'].includes(normalize(document.document_type)),
  );

  const availabilityLabel = availability.availability_mode === '24_7' ? '24/7 verfügbar' : availability.availability_mode === 'on_call' ? 'Auf Abruf' : availability.availability_mode === 'unavailable' ? 'Nicht verfügbar' : availability.availability_mode ? 'Wochenplan' : 'Nicht gepflegt';

  function updateRoot(key: string, value: any) { setDraft((current) => ({ ...current, [key]: value })); }
  function updateNested(group: string, key: string, value: any) { setDraft((current) => ({ ...current, [group]: { ...safeObject(current[group]), [key]: value } })); }
  function updateDay(day: number, patch: Partial<DayRule>) { setDayRules((current) => current.map((rule) => rule.day_of_week === day ? { ...rule, ...patch } : rule)); }
  function toggleSkill(skillId: string) {
    setSelectedSkills((current) => {
      const copy = { ...current };
      if (copy[skillId]) delete copy[skillId];
      else copy[skillId] = { skill_id: skillId, proficiency_level: 'independent', is_preferred: false, can_work_independently: true, can_lead_team: false, years_experience: '' };
      return copy;
    });
  }
  function updateSkill(skillId: string, patch: JsonRow) { setSelectedSkills((current) => ({ ...current, [skillId]: { ...current[skillId], ...patch } })); }

  async function saveDetail(extra: JsonRow = {}) {
    if (!detail || saving) return;
    setSaving(true); setErrorMessage(''); setMessage('');
    try {
      const payload = {
        ...draft,
        skills: Object.values(selectedSkills),
        availability_rules: draft.availability?.availability_mode === 'weekly_schedule' ? dayRules : [],
        ...extra,
      };
      const response = await apiRequest<ApiPayload>(`/api/opc/employees/${employeeId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      setDetail(response.detail || detail);
      setDraft(makeDraft(response.detail || detail));
      setDayRules(makeDayRules(response.detail || detail));
      setEditMode(false);
      setMessage(extra.append_note ? 'Notiz wurde gespeichert.' : 'Mitarbeiter wurde gespeichert.');
      setNoteText(''); setNoteTitle('');
    } catch (error: any) { setErrorMessage(error?.message || 'Speichern fehlgeschlagen.'); }
    finally { setSaving(false); }
  }

  async function uploadFiles(
    files: File[],
    options: {
      documentType: string;
      title?: string;
      validFrom?: string;
      validUntil?: string;
      documentSubtype?: string;
    },
  ) {
    for (const file of files) {
      const formData = new FormData();
      formData.set('employeeId', employeeId);
      formData.set('documentType', options.documentType);
      formData.set('documentSubtype', options.documentSubtype || '');
      formData.set('title', options.title || file.name);
      formData.set('validFrom', options.validFrom || '');
      formData.set('validUntil', options.validUntil || '');
      formData.set('file', file);
      await apiRequest('/api/opc/employees/upload-document', { method: 'POST', body: formData });
    }
  }

  async function handleDocumentUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    setUploading(true); setErrorMessage(''); setMessage('');
    try {
      await uploadFiles(files, {
        documentType,
        title: documentTitle,
        validUntil: documentValidUntil,
      });
      setDocumentTitle(''); setDocumentValidUntil('');
      await loadDetail(false);
      setMessage(`${files.length} Dokument${files.length === 1 ? '' : 'e'} hochgeladen.`);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Dokumente konnten nicht hochgeladen werden.');
    } finally {
      setUploading(false);
    }
  }

  async function handleContractUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    setContractUploading(true); setErrorMessage(''); setMessage('');
    try {
      const documentTypeForContract =
        contractSubtype === 'contract_addendum' ? 'contract_addendum' : 'employment_contract';

      await uploadFiles(files, {
        documentType: documentTypeForContract,
        documentSubtype: contractSubtype,
        title: contractTitle,
        validFrom: contractValidFrom,
      });

      setContractTitle('');
      setContractValidFrom('');
      await loadDetail(false);
      setMessage(`${files.length} Vertragsdatei${files.length === 1 ? '' : 'en'} hochgeladen.`);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Vertrag konnte nicht hochgeladen werden.');
    } finally {
      setContractUploading(false);
    }
  }

  function scrollStrip(direction: 'left' | 'right') {
    const node = detailStripRef.current;
    if (!node) return;
    node.scrollBy({ left: direction === 'right' ? Math.max(320, node.clientWidth * .8) : -Math.max(320, node.clientWidth * .8), behavior: 'smooth' });
  }

  if (loading) {
    return <MirakaDashboardShell title="Mitarbeiterdetails" hideTopBar={false} requiredRole={['owner','admin']} currentPath="/mitarbeiter"><div className="opc-employee-loading" style={{fontFamily: pageFont}}><Loader2 size={19} className="spin" /> Mitarbeiter wird geladen...</div></MirakaDashboardShell>;
  }

  return (
    <MirakaDashboardShell title="Mitarbeiterdetails" hideTopBar={false} fullWidth={false} requiredRole={['owner','admin']} currentPath="/mitarbeiter">
      <div className="opc-employee-page" style={{ fontFamily: pageFont, color: BRAND.text }}>
        <a className="opc-back-link" href={`${baseUrl}/mitarbeiter`}>← Zurück zu Mitarbeiter</a>
        {errorMessage ? <div className="opc-employee-error">{errorMessage}</div> : null}
        {message ? <div className="opc-employee-message">{message}</div> : null}

        {detail ? <>
          <section className="opc-employee-hero" style={cardStyle}>
            <div className="opc-employee-status-dot" style={{background: visual.background, borderColor: visual.border}}><span style={{background: visual.color}} /></div>
            <div className="opc-employee-hero-main">
              <div className="opc-employee-avatar-large">{initials(name)}</div>
              <div>
                <div className="opc-employee-eyebrow">{position.title_de || formatPersonnelType(employee.personnel_type)}</div>
                <h1>{name}</h1>
                <div className="opc-employee-hero-meta"><span>{employee.employee_number}</span><span>{entity.legal_name || 'Rechtsträger fehlt'}</span><span>{staff.role ? `Portal: ${staff.role}` : 'Kein Portalzugang'}</span></div>
              </div>
            </div>
            <div className="opc-employee-hero-actions">
              {(employee.phone_e164 || employee.phone_raw) ? <a className="opc-btn opc-btn-light" href={`tel:${employee.phone_e164 || employee.phone_raw}`}><Phone size={16} />Anrufen</a> : null}
              {(employee.phone_e164 || employee.phone_raw) ? <a className="opc-btn opc-btn-light" target="_blank" rel="noreferrer" href={`https://wa.me/${String(employee.phone_e164 || employee.phone_raw).replace(/\D/g,'')}`}><MessageCircle size={16} />WhatsApp</a> : null}
              <button type="button" className="opc-btn opc-btn-dark" onClick={() => { setDraft(makeDraft(detail)); setDayRules(makeDayRules(detail)); setEditMode((current) => !current); }}>{editMode ? 'Bearbeitung schliessen' : 'Mitarbeiter bearbeiten'}</button>
            </div>
          </section>

          <div className="opc-employee-metrics-grid">
            <MetricCard label="Status" value={visual.label} icon={<CheckCircle2 size={18} />} />
            <MetricCard label="Verfügbarkeit" value={availabilityLabel} helper={`${asArray(detail.availability_rules).length} Zeitfenster`} icon={<Clock3 size={18} />} />
            <MetricCard label="Skills" value={skills.length} helper={skills.filter((skill) => skill.is_preferred).length ? `${skills.filter((skill) => skill.is_preferred).length} bevorzugt` : 'Keine bevorzugt'} icon={<BadgeCheck size={18} />} />
            <MetricCard label="Personalakte" value={formatStatus(employee.profile_completion_status)} icon={<FileText size={18} />} />
          </div>

          {editMode ? (
            <section className="opc-employee-edit-panel" style={cardStyle}>
              <div className="opc-edit-head"><div><h2>Mitarbeiter bearbeiten</h2><p>HR-Stammdaten, Skills und Verfügbarkeit aktualisieren.</p></div><div><button className="opc-btn opc-btn-light" onClick={() => setEditMode(false)}>Abbrechen</button><button className="opc-btn opc-btn-dark" disabled={saving} onClick={() => void saveDetail()}>{saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}Speichern</button></div></div>

              <div className="opc-edit-section"><h3>Personalien und Organisation</h3><div className="opc-edit-grid three">
                <Field label="Vorname"><input value={draft.legal_first_name} onChange={(event) => updateRoot('legal_first_name', event.target.value)} /></Field>
                <Field label="Nachname"><input value={draft.legal_last_name} onChange={(event) => updateRoot('legal_last_name', event.target.value)} /></Field>
                <Field label="Bevorzugter Name"><input value={draft.preferred_name} onChange={(event) => updateRoot('preferred_name', event.target.value)} /></Field>
                <Field label="Rechtsträger"><select value={draft.employing_entity_id} onChange={(event) => updateRoot('employing_entity_id', event.target.value)}>{asArray(detail.entities).map((item) => <option key={item.id} value={item.id}>{item.legal_name}</option>)}</select></Field>
                <Field label="Position"><select value={draft.operational_position_id} onChange={(event) => updateRoot('operational_position_id', event.target.value)}><option value="">Keine Position</option>{asArray(detail.positions).map((item) => <option key={item.id} value={item.id}>{item.title_de}</option>)}</select></Field>
                <Field label="Personentyp"><select value={draft.personnel_type} onChange={(event) => updateRoot('personnel_type', event.target.value)}><option value="employee">Mitarbeiter/in</option><option value="owner_employee">Inhaber/in mit Anstellung</option><option value="external_contractor">Externe Fachkraft</option><option value="external_infrastructure">Externe Infrastruktur</option><option value="agency_worker">Temporär über Agentur</option><option value="temporary_external">Temporäre externe Kraft</option><option value="intern">Praktikum</option><option value="apprentice">Lernende/r</option><option value="other">Andere</option></select></Field>
                <Field label="Geburtsdatum"><input type="date" value={draft.date_of_birth} onChange={(event) => updateRoot('date_of_birth', event.target.value)} /></Field>
                <Field label="Zivilstand"><select value={draft.civil_status} onChange={(event) => updateRoot('civil_status', event.target.value)}><option value="">Nicht angegeben</option><option value="single">Ledig</option><option value="married">Verheiratet</option><option value="registered_partnership">Eingetragene Partnerschaft</option><option value="divorced">Geschieden</option><option value="widowed">Verwitwet</option><option value="separated">Getrennt</option><option value="unknown">Unbekannt</option></select></Field>
                <Field label="AHV-Nummer"><input value={draft.ahv_number} onChange={(event) => updateRoot('ahv_number', event.target.value)} /></Field>
                <Field label="Status"><select value={draft.status} onChange={(event) => updateRoot('status', event.target.value)}><option value="onboarding">Onboarding</option><option value="active">Aktiv</option><option value="inactive">Inaktiv</option><option value="suspended">Gesperrt</option><option value="terminated">Ausgetreten</option><option value="archived">Archiviert</option></select></Field>
                <Field label="Einsatzstatus"><select value={draft.assignment_status} onChange={(event) => updateRoot('assignment_status', event.target.value)}><option value="available">Verfügbar</option><option value="limited">Eingeschränkt</option><option value="unavailable">Nicht verfügbar</option><option value="on_leave">Abwesend</option><option value="inactive">Inaktiv</option></select></Field>
                <Field label="Vollständigkeit"><select value={draft.profile_completion_status} onChange={(event) => updateRoot('profile_completion_status', event.target.value)}><option value="incomplete">Unvollständig</option><option value="in_review">In Prüfung</option><option value="complete">Vollständig</option><option value="update_required">Aktualisierung nötig</option></select></Field>
              </div></div>

              <div className="opc-edit-section"><h3>Kontakt und Adresse</h3><div className="opc-edit-grid three">
                <Field label="Private E-Mail"><input type="email" value={draft.private_email} onChange={(event) => updateRoot('private_email', event.target.value)} /></Field>
                <Field label="Geschäftliche E-Mail"><input type="email" value={draft.business_email} onChange={(event) => updateRoot('business_email', event.target.value)} /></Field>
                <Field label="Telefon"><input value={draft.phone_raw} onChange={(event) => updateRoot('phone_raw', event.target.value)} /></Field>
                <Field label="Strasse"><input value={draft.address.street} onChange={(event) => updateNested('address','street',event.target.value)} /></Field>
                <Field label="Hausnummer"><input value={draft.address.house_number} onChange={(event) => updateNested('address','house_number',event.target.value)} /></Field>
                <Field label="PLZ"><input value={draft.address.postal_code} onChange={(event) => updateNested('address','postal_code',event.target.value)} /></Field>
                <Field label="Ort"><input value={draft.address.city} onChange={(event) => updateNested('address','city',event.target.value)} /></Field>
                <Field label="Kanton"><input maxLength={2} value={draft.address.canton_code} onChange={(event) => updateNested('address','canton_code',event.target.value.toUpperCase())} /></Field>
                <Field label="Land"><input maxLength={2} value={draft.address.country_code} onChange={(event) => updateNested('address','country_code',event.target.value.toUpperCase())} /></Field>
              </div></div>

              <div className="opc-edit-section"><h3>Nationalität, Bewilligung und Bank</h3><div className="opc-edit-grid three">
                <Field label="Nationalität"><input maxLength={2} value={draft.nationality.country_code} onChange={(event) => updateNested('nationality','country_code',event.target.value.toUpperCase())} /></Field>
                <Field label="Bewilligung"><select value={draft.permit.permit_type} onChange={(event) => updateNested('permit','permit_type',event.target.value)}><option value="">Nicht erfasst</option><option value="swiss_citizen">Schweizer Bürger/in</option><option value="b">B</option><option value="c">C</option><option value="l">L</option><option value="g">G</option><option value="s">S</option><option value="not_required">Nicht erforderlich</option><option value="pending">Ausstehend</option><option value="other">Andere</option></select></Field>
                <Field label="Bewilligungsnummer"><input value={draft.permit.permit_number} onChange={(event) => updateNested('permit','permit_number',event.target.value)} /></Field>
                <Field label="Gültig bis"><input type="date" value={draft.permit.valid_until} onChange={(event) => updateNested('permit','valid_until',event.target.value)} /></Field>
                <Field label="Bank"><input value={draft.bank_account.bank_name} onChange={(event) => updateNested('bank_account','bank_name',event.target.value)} /></Field>
                <Field label="IBAN"><input value={draft.bank_account.iban} onChange={(event) => updateNested('bank_account','iban',event.target.value.toUpperCase())} /></Field>
                <Field label="Kontoinhaber"><input value={draft.bank_account.account_holder} onChange={(event) => updateNested('bank_account','account_holder',event.target.value)} /></Field>
                <Field label="BIC"><input value={draft.bank_account.bic} onChange={(event) => updateNested('bank_account','bic',event.target.value.toUpperCase())} /></Field>
              </div></div>

              <div className="opc-edit-section"><h3>Qualifikation</h3><div className="opc-edit-grid three">
                <Field label="Ausbildungsstufe"><select value={draft.qualification.qualification_level_code} onChange={(event) => updateNested('qualification','qualification_level_code',event.target.value)}><option value="none">Keine formelle Ausbildung</option><option value="compulsory_school">Obligatorische Schule</option><option value="internal_cleaning_level_ii">Branchenweiterbildung Stufe II</option><option value="eba">EBA</option><option value="efz">EFZ</option><option value="federal_professional_certificate">Eidg. Fachausweis</option><option value="federal_diploma">Eidg. Diplom</option><option value="hf">HF</option><option value="bachelor">Bachelor</option><option value="master">Master</option><option value="doctorate">Doktorat</option><option value="foreign_vocational">Ausländische Berufsausbildung</option><option value="foreign_academic">Ausländischer Hochschulabschluss</option><option value="other">Andere</option></select></Field>
                <Field label="Abschluss"><input value={draft.qualification.qualification_title} onChange={(event) => updateNested('qualification','qualification_title',event.target.value)} /></Field>
                <Field label="Fachrichtung"><input value={draft.qualification.field_of_study} onChange={(event) => updateNested('qualification','field_of_study',event.target.value)} /></Field>
                <Field label="Institut"><input value={draft.qualification.institution_name} onChange={(event) => updateNested('qualification','institution_name',event.target.value)} /></Field>
                <Field label="Abschlussdatum"><input type="date" value={draft.qualification.completed_on} onChange={(event) => updateNested('qualification','completed_on',event.target.value)} /></Field>
                <Field label="Anerkennung"><select value={draft.qualification.swiss_recognition_status} onChange={(event) => updateNested('qualification','swiss_recognition_status',event.target.value)}><option value="not_required">Nicht erforderlich</option><option value="pending">Ausstehend</option><option value="recognized">Anerkannt</option><option value="partially_recognized">Teilweise anerkannt</option><option value="not_recognized">Nicht anerkannt</option><option value="unknown">Unbekannt</option></select></Field>
              </div></div>

              <div className="opc-edit-section"><h3>Skills</h3><div className="opc-edit-skill-grid">{asArray(detail.skill_catalog).map((catalog) => { const selected = selectedSkills[String(catalog.id)]; return <div className={`opc-edit-skill ${selected ? 'active' : ''}`} key={catalog.id}><button type="button" onClick={() => toggleSkill(String(catalog.id))}><span>{selected ? <CheckCircle2 size={14} /> : null}</span><strong>{catalog.name_de}</strong></button>{selected ? <div><select value={selected.proficiency_level || 'independent'} onChange={(event) => updateSkill(String(catalog.id), { proficiency_level: event.target.value })}><option value="basic">Grundkenntnisse</option><option value="independent">Selbständig</option><option value="advanced">Fortgeschritten</option><option value="lead">Teamleitung</option><option value="trainer">Trainer/in</option></select><label><input type="checkbox" checked={selected.is_preferred === true} onChange={(event) => updateSkill(String(catalog.id), { is_preferred: event.target.checked })} /> Bevorzugt</label></div> : null}</div>; })}</div></div>

              <div className="opc-edit-section"><h3>Verfügbarkeit</h3><div className="opc-edit-grid three">
                <Field label="Modell"><select value={draft.availability.availability_mode} onChange={(event) => updateNested('availability','availability_mode',event.target.value)}><option value="weekly_schedule">Wochenplan</option><option value="24_7">24/7</option><option value="on_call">Auf Abruf</option><option value="limited">Eingeschränkt</option><option value="unavailable">Nicht verfügbar</option></select></Field>
                <Field label="Bevorzugte Wochenstunden"><input value={draft.availability.preferred_weekly_hours} onChange={(event) => updateNested('availability','preferred_weekly_hours',event.target.value)} /></Field>
                <Field label="Maximale Wochenstunden"><input value={draft.availability.maximum_weekly_hours} onChange={(event) => updateNested('availability','maximum_weekly_hours',event.target.value)} /></Field>
              </div>
              <div className="opc-edit-checks">
                <label><input type="checkbox" checked={draft.availability.short_notice_available === true} onChange={(event) => updateNested('availability','short_notice_available',event.target.checked)} /> Kurzfristig verfügbar</label>
                <label><input type="checkbox" checked={draft.availability.weekend_available === true} onChange={(event) => updateNested('availability','weekend_available',event.target.checked)} /> Wochenende möglich</label>
                <label><input type="checkbox" checked={draft.availability.saturday_available === true} onChange={(event) => updateNested('availability','saturday_available',event.target.checked)} /> Samstag möglich</label>
                <label><input type="checkbox" checked={draft.availability.sunday_available === true} onChange={(event) => updateNested('availability','sunday_available',event.target.checked)} /> Sonntag möglich</label>
                <label><input type="checkbox" checked={draft.availability.public_holiday_available === true} onChange={(event) => updateNested('availability','public_holiday_available',event.target.checked)} /> Feiertage möglich</label>
                <label><input type="checkbox" checked={draft.availability.night_work_available === true} onChange={(event) => updateNested('availability','night_work_available',event.target.checked)} /> Nachtarbeit möglich</label>
              </div>
              {draft.availability.availability_mode === 'weekly_schedule' ? <div className="opc-edit-days">{dayRules.map((rule) => <div key={rule.day_of_week} className={rule.enabled ? 'active' : ''}><button type="button" onClick={() => updateDay(rule.day_of_week,{enabled:!rule.enabled})}><span>{rule.enabled ? <CheckCircle2 size={13} /> : null}</span>{rule.label}</button><input disabled={!rule.enabled} type="time" value={rule.start_time} onChange={(event) => updateDay(rule.day_of_week,{start_time:event.target.value})} /><input disabled={!rule.enabled} type="time" value={rule.end_time} onChange={(event) => updateDay(rule.day_of_week,{end_time:event.target.value})} /></div>)}</div> : null}</div>

              <div className="opc-edit-section"><h3>Notfallkontakt und interne Hinweise</h3><div className="opc-edit-grid three">
                <Field label="Notfallkontakt"><input value={draft.emergency_contact.full_name} onChange={(event) => updateNested('emergency_contact','full_name',event.target.value)} /></Field>
                <Field label="Beziehung"><input value={draft.emergency_contact.relationship_label} onChange={(event) => updateNested('emergency_contact','relationship_label',event.target.value)} /></Field>
                <Field label="Telefon"><input value={draft.emergency_contact.phone_raw} onChange={(event) => updateNested('emergency_contact','phone_raw',event.target.value)} /></Field>
                <Field label="E-Mail"><input type="email" value={draft.emergency_contact.email} onChange={(event) => updateNested('emergency_contact','email',event.target.value)} /></Field>
                <Field label="Eintritt"><input type="date" value={draft.entry_date} onChange={(event) => updateRoot('entry_date',event.target.value)} /></Field>
                <Field label="Austritt"><input type="date" value={draft.exit_date} onChange={(event) => updateRoot('exit_date',event.target.value)} /></Field>
              </div><Field label="Interne Hinweise"><textarea value={draft.internal_notes} onChange={(event) => updateRoot('internal_notes',event.target.value)} /></Field></div>
            </section>
          ) : null}

          <div className="opc-section-title-row"><h2>Mitarbeiterdaten</h2><div><button onClick={() => scrollStrip('left')}><ChevronLeft size={16} /></button><button onClick={() => scrollStrip('right')}><ChevronRight size={16} /></button></div></div>
          <div className="opc-employee-detail-strip" ref={detailStripRef}>
            <DetailCard title="Personal"><MiniField label="Personalnummer" value={employee.employee_number} /><MiniField label="Geburtsdatum" value={formatDate(employee.date_of_birth)} /><MiniField label="Zivilstand" value={formatStatus(employee.civil_status)} /><MiniField label="AHV" value={maskAhv(employee.ahv_number)} /></DetailCard>
            <DetailCard title="Kontakt"><MiniField label="Telefon" value={employee.phone_e164 || employee.phone_raw} /><MiniField label="E-Mail" value={employee.business_email || employee.private_email} /><MiniField label="Adresse" value={addressText(address)} /><MiniField label="Sprache" value={employee.preferred_language} /></DetailCard>
            <DetailCard title="Organisation"><MiniField label="Rechtsträger" value={entity.legal_name} /><MiniField label="Position" value={position.title_de} /><MiniField label="Personentyp" value={formatPersonnelType(employee.personnel_type)} /><MiniField label="Eintritt" value={formatDate(employee.entry_date)} /></DetailCard>
            <DetailCard title="Bewilligung"><MiniField label="Nationalität" value={detail.current_nationality?.country_code} /><MiniField label="Ausweis" value={permit.permit_type ? String(permit.permit_type).toUpperCase() : null} /><MiniField label="Status" value={formatStatus(permit.permit_status)} /><MiniField label="Gültig bis" value={formatDate(permit.valid_until)} /></DetailCard>
          </div>

          <div className="opc-employee-main-grid">
            <div className="opc-employee-left-col">
              <section className="opc-section-card" style={cardStyle}><SectionHeader title="Skills und Einsatzarten" />{skills.length ? <div className="opc-skill-display-grid">{skills.map((skill) => <div key={skill.id}><span>{skill.catalog?.category_group || 'Skill'}</span><strong>{skill.catalog?.name_de || 'Skill'}</strong><small>{formatStatus(skill.proficiency_level)}{skill.is_preferred ? ' · bevorzugt' : ''}</small></div>)}</div> : <div className="opc-empty-box">Noch keine Skills hinterlegt.</div>}</section>
              <section className="opc-section-card" style={cardStyle}><SectionHeader title="Verfügbarkeit" /><div className="opc-availability-summary"><MiniField label="Modell" value={availabilityLabel} /><MiniField label="Wochenende" value={availability.weekend_available ? 'Ja' : 'Nein'} /><MiniField label="Samstag" value={availability.saturday_available ? 'Ja' : 'Nein'} /><MiniField label="Sonntag" value={availability.sunday_available ? 'Ja' : 'Nein'} /><MiniField label="Kurzfristig" value={availability.short_notice_available ? 'Ja' : 'Nein'} /><MiniField label="Max. Wochenstunden" value={availability.maximum_weekly_hours ? `${availability.maximum_weekly_hours} h` : null} /></div>{asArray(detail.availability_rules).length ? <div className="opc-availability-list">{asArray(detail.availability_rules).filter((rule) => rule.is_active !== false).map((rule) => <div key={rule.id}><strong>{DAY_LABELS[Number(rule.day_of_week)]}</strong><span>{String(rule.start_time).slice(0,5)} – {String(rule.end_time).slice(0,5)}</span><small>{formatStatus(rule.availability_type)}</small></div>)}</div> : null}</section>
              <section className="opc-section-card" style={cardStyle}><SectionHeader title="Ausbildung und Qualifikation" /><div className="opc-two-col"><div className="opc-info-stack"><MiniField label="Stufe" value={formatQualification(qualification.qualification_level_code)} /><MiniField label="Abschluss" value={qualification.qualification_title} /><MiniField label="Fachrichtung" value={qualification.field_of_study} /><MiniField label="Institut" value={qualification.institution_name} /></div><div className="opc-info-stack"><MiniField label="Abschlussdatum" value={formatDate(qualification.completed_on)} /><MiniField label="Anerkennung" value={formatStatus(qualification.swiss_recognition_status)} /><MiniField label="Verifizierung" value={formatStatus(qualification.verification_status)} /><MiniField label="GAV-relevant" value={qualification.relevant_for_cleaning_gav ? 'Ja' : 'Nein'} /></div></div></section>
              <section className="opc-section-card" style={cardStyle}>
                <SectionHeader
                  title="Dokumente"
                  action={
                    <div className="opc-document-upload-head">
                      <select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
                        <option value="identity_document">Identitätsdokument</option>
                        <option value="passport">Pass</option>
                        <option value="permit">Bewilligung</option>
                        <option value="cross_border_certificate">Grenzgängerbescheinigung</option>
                        <option value="a1_certificate">A1-Bescheinigung</option>
                        <option value="bank_document">Bankbeleg</option>
                        <option value="ahv_document">AHV-Dokument</option>
                        <option value="family_allowance_document">Familienzulagen</option>
                        <option value="medical_certificate">Arztzeugnis</option>
                        <option value="other">Andere Datei</option>
                        {canManagePayroll ? (
                          <>
                            <option value="employment_contract">Arbeitsvertrag</option>
                            <option value="contract_addendum">Vertragsnachtrag</option>
                            <option value="tax_document">Steuerdokument</option>
                            <option value="insurance_document">Versicherungsdokument</option>
                          </>
                        ) : null}
                      </select>
                      <label className="opc-upload-button">
                        {uploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                        Dateien hochladen
                        <input type="file" multiple disabled={uploading} onChange={(event) => void handleDocumentUpload(event)} />
                      </label>
                    </div>
                  }
                />
                <div className="opc-document-meta-row">
                  <input placeholder="Dokumenttitel (optional)" value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} />
                  <input type="date" value={documentValidUntil} onChange={(event) => setDocumentValidUntil(event.target.value)} />
                </div>
                <div className="opc-document-hint">Alle Dateitypen sind zulässig. Pro Datei maximal 50 MB. Dateien werden privat gespeichert und nur über zeitlich begrenzte Links geöffnet.</div>
                {documents.length ? (
                  <div className="opc-document-list">
                    {documents.map((document) => (
                      <a key={document.id} href={document.signed_url || '#'} target="_blank" rel="noreferrer">
                        <span><FileText size={17} /></span>
                        <div>
                          <strong>{document.title || document.file_name}</strong>
                          <small>{formatStatus(document.document_type)} · {formatDateTime(document.created_at)}</small>
                        </div>
                        <Download size={16} />
                      </a>
                    ))}
                  </div>
                ) : <div className="opc-empty-box">Noch keine Dokumente vorhanden.</div>}
              </section>
              {canManagePayroll ? (
                <section className="opc-section-card opc-payroll-owner-card" style={cardStyle}>
                  <SectionHeader title="Vertrag und Lohn · Owner" />
                  <div className="opc-payroll-notice">
                    <ShieldCheck size={18} />
                    <span>Dieser Bereich ist nur für Owner sichtbar.</span>
                  </div>

                  <div className="opc-contract-upload-panel">
                    <div className="opc-contract-upload-copy">
                      <strong>Unterzeichneten Vertrag hinterlegen</strong>
                      <span>Die gewählte Vertragsart wird bereits als Dokument-Untertyp gespeichert. Die automatische Vorlagengenerierung kann später auf genau dieser Auswahl aufbauen.</span>
                    </div>

                    <div className="opc-contract-upload-grid">
                      <select value={contractSubtype} onChange={(event) => setContractSubtype(event.target.value)}>
                        <option value="hourly_employment">Arbeitsvertrag · Stundenlohn</option>
                        <option value="monthly_employment">Arbeitsvertrag · Monatslohn</option>
                        <option value="fixed_term_employment">Arbeitsvertrag · Befristet</option>
                        <option value="temporary_employment">Arbeitsvertrag · Temporär</option>
                        <option value="apprenticeship_contract">Lehrvertrag</option>
                        <option value="external_service_contract">Vertrag · Externe Fachkraft</option>
                        <option value="contract_addendum">Vertragsnachtrag</option>
                      </select>

                      <input
                        placeholder="Vertragstitel (optional)"
                        value={contractTitle}
                        onChange={(event) => setContractTitle(event.target.value)}
                      />

                      <input
                        type="date"
                        value={contractValidFrom}
                        onChange={(event) => setContractValidFrom(event.target.value)}
                        title="Vertragsbeginn"
                      />

                      <label className="opc-upload-button">
                        {contractUploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                        Vertrag hochladen
                        <input type="file" multiple disabled={contractUploading} onChange={(event) => void handleContractUpload(event)} />
                      </label>
                    </div>

                    <button type="button" className="opc-template-button" disabled title="Wird mit den Vertragsvorlagen aktiviert">
                      <FileText size={14} />
                      Vertragsvorlage generieren · folgt
                    </button>
                  </div>

                  {contractDocuments.length ? (
                    <div className="opc-contract-document-list">
                      {contractDocuments.map((document) => (
                        <a key={document.id} href={document.signed_url || '#'} target="_blank" rel="noreferrer">
                          <span><FileText size={16} /></span>
                          <div>
                            <strong>{document.title || document.file_name}</strong>
                            <small>{formatStatus(document.document_subtype || document.document_type)} · {formatDateTime(document.created_at)}</small>
                          </div>
                          <Download size={15} />
                        </a>
                      ))}
                    </div>
                  ) : null}

                  {contracts.length ? (
                    <div className="opc-contract-list">
                      {contracts.map((contract) => (
                        <div key={contract.id}>
                          <strong>{contract.contract_number}</strong>
                          <span>{formatStatus(contract.salary_type)} · {formatStatus(contract.status)}</span>
                          <small>{contract.salary_type === 'hourly' ? `CHF ${contract.hourly_rate_chf || '—'} / h` : `CHF ${contract.monthly_salary_chf || '—'} / Monat`} · ab {formatDate(contract.valid_from)}</small>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {!contracts.length && !contractDocuments.length ? (
                    <div className="opc-empty-box">Noch kein Arbeitsvertrag und keine Vertragsdatei hinterlegt.</div>
                  ) : null}
                </section>
              ) : null}
            </div>

            <aside className="opc-employee-right-col">
              <section className="opc-section-card" style={cardStyle}><SectionHeader title="Kontakt" /><div className="opc-contact-card"><div className="opc-contact-avatar">{initials(name)}</div><div><strong>{name}</strong><span>{employee.phone_e164 || employee.phone_raw || 'Telefon fehlt'}</span><span>{employee.business_email || employee.private_email || 'E-Mail fehlt'}</span></div></div><div className="opc-contact-actions">{(employee.phone_e164 || employee.phone_raw) ? <a href={`tel:${employee.phone_e164 || employee.phone_raw}`}><Phone size={15} />Anrufen</a> : null}{(employee.business_email || employee.private_email) ? <a href={`mailto:${employee.business_email || employee.private_email}`}><Mail size={15} />E-Mail</a> : null}</div></section>
              <section className="opc-section-card" style={cardStyle}><SectionHeader title="Bankverbindung" /><div className="opc-info-stack"><MiniField label="Bank" value={bank.bank_name} /><MiniField label="IBAN" value={bank.iban} /><MiniField label="Kontoinhaber" value={bank.account_holder} /><MiniField label="Verifizierung" value={formatStatus(bank.verification_status)} /></div></section>
              <section className="opc-section-card" style={cardStyle}><SectionHeader title="Notfallkontakt" /><div className="opc-info-stack"><MiniField label="Name" value={emergency.full_name} /><MiniField label="Beziehung" value={emergency.relationship_label} /><MiniField label="Telefon" value={emergency.phone_e164 || emergency.phone_raw} /><MiniField label="E-Mail" value={emergency.email} /></div></section>
              <section className="opc-section-card" style={cardStyle}><SectionHeader title="Notiz erfassen" /><div className="opc-note-form"><select value={noteType} onChange={(event) => setNoteType(event.target.value)}><option value="general">Allgemein</option><option value="availability">Verfügbarkeit</option><option value="skill">Skill</option><option value="preference">Präferenz</option><option value="performance">Leistung</option><option value="restriction">Einschränkung</option><option value="training">Schulung</option><option value="incident">Vorfall</option><option value="other">Andere</option></select><input placeholder="Titel (optional)" value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} /><textarea placeholder="Interne Notiz zum Mitarbeiter" value={noteText} onChange={(event) => setNoteText(event.target.value)} /><button className="opc-btn opc-btn-dark" disabled={saving || !noteText.trim()} onClick={() => void saveDetail({ append_note: noteText, append_note_type: noteType, append_note_title: noteTitle })}><Plus size={15} />Notiz speichern</button></div></section>
              <section className="opc-section-card" style={cardStyle}><SectionHeader title="Notizen" />{notes.length ? <div className="opc-note-list">{notes.map((note) => <div key={note.id}><div><strong>{note.title || formatStatus(note.note_type)}</strong><span>{note.visibility_scope === 'owners_only' ? 'Owner' : 'HR'}</span></div><p>{note.note_text}</p><small>{formatDateTime(note.created_at)}</small></div>)}</div> : <div className="opc-empty-box">Keine Notizen vorhanden.</div>}</section>
              <section className="opc-section-card" style={cardStyle}><SectionHeader title="Kurzinfo" /><div className="opc-info-stack"><MiniField label="Mitarbeiter-ID" value={employee.id} /><MiniField label="Staff-Role-ID" value={employee.staff_role_id} /><MiniField label="User-ID" value={employee.user_id} /><MiniField label="Payroll" value={employee.payroll_in_scope ? 'Im Umfang' : 'Ausgeschlossen'} /><MiniField label="Letzte Änderung" value={formatDateTime(employee.updated_at)} /></div></section>
            </aside>
          </div>
        </> : <div className="opc-empty-box" style={cardStyle}>Mitarbeiter wurde nicht gefunden.</div>}
      </div>

      <style>{`
        .opc-employee-page { width: 100%; padding: 0 0 140px; overflow-x: hidden; }
        .opc-employee-page * { box-sizing: border-box; }
        .opc-employee-loading { min-height: 60vh; display: flex; align-items: center; justify-content: center; gap: 9px; color: ${BRAND.muted}; font-size: 14px; font-weight: 680; }
        .opc-back-link { display: inline-flex; align-items: center; height: 38px; padding: 0 14px; margin-bottom: 14px; border: 1px solid ${BRAND.border}; border-radius: 999px; color: ${BRAND.text}; text-decoration: none; font-size: 13px; font-weight: 760; background: #FFFFFF; }
        .opc-employee-error, .opc-employee-message { border-radius: 16px; padding: 14px 16px; margin-bottom: 14px; font-size: 13px; font-weight: 720; }
        .opc-employee-error { border: 1px solid #FECACA; background: #FEF2F2; color: ${BRAND.red}; }
        .opc-employee-message { border: 1px solid #A7F3D0; background: #ECFDF5; color: #047857; }
        .opc-employee-hero { position: relative; padding: 22px; margin-bottom: 14px; }
        .opc-employee-hero-main { display: flex; align-items: center; gap: 14px; padding-right: 54px; }
        .opc-employee-avatar-large { width: 58px; height: 58px; border-radius: 18px; border: 1px solid ${BRAND.border}; background: ${BRAND.soft}; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 860; flex-shrink: 0; }
        .opc-employee-status-dot { position: absolute; top: 20px; right: 20px; width: 42px; height: 42px; border-radius: 999px; border: 1px solid; display: flex; align-items: center; justify-content: center; }
        .opc-employee-status-dot span { width: 18px; height: 18px; border-radius: 999px; }
        .opc-employee-eyebrow { color: ${BRAND.muted}; font-size: 12px; font-weight: 760; margin-bottom: 5px; }
        .opc-employee-hero h1 { margin: 0; color: ${BRAND.text}; font-size: 29px; line-height: 1.05; letter-spacing: -0.045em; font-weight: 860; }
        .opc-employee-hero-meta { display: flex; flex-wrap: wrap; gap: 7px 13px; margin-top: 8px; color: ${BRAND.muted}; font-size: 12px; font-weight: 700; }
        .opc-employee-hero-actions { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 18px; }
        .opc-btn { min-height: 42px; border-radius: 13px; border: 1px solid ${BRAND.border}; padding: 0 14px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-family: ${pageFont}; font-size: 13px; font-weight: 780; cursor: pointer; text-decoration: none; }
        .opc-btn-light { background: #FFFFFF; color: ${BRAND.text}; }
        .opc-btn-dark { background: ${BRAND.black}; border-color: ${BRAND.black}; color: #FFFFFF; }
        .opc-btn:disabled { opacity: .6; cursor: wait; }
        .opc-employee-metrics-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; margin-bottom: 18px; }
        .opc-employee-metric-card { min-height: 82px; padding: 16px 18px; display: flex; justify-content: space-between; align-items: center; gap: 12px; background: #FFFFFF; border: 1px solid ${BRAND.border}; border-radius: 18px; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
        .opc-employee-metric-value { font-size: 21px; line-height: 1.08; font-weight: 860; letter-spacing: -.035em; }
        .opc-employee-metric-label { margin-top: 5px; color: ${BRAND.muted}; font-size: 12px; font-weight: 820; }
        .opc-employee-metric-helper { margin-top: 3px; color: ${BRAND.faint}; font-size: 11px; font-weight: 650; }
        .opc-employee-metric-icon { width: 36px; height: 36px; border: 1px solid ${BRAND.border}; border-radius: 13px; display: flex; align-items: center; justify-content: center; background: ${BRAND.soft}; flex-shrink: 0; }
        .opc-employee-edit-panel { padding: 18px; margin-bottom: 18px; }
        .opc-edit-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 18px; }
        .opc-edit-head h2 { margin: 0; font-size: 19px; font-weight: 860; letter-spacing: -.03em; }
        .opc-edit-head p { margin: 5px 0 0; color: ${BRAND.muted}; font-size: 12px; font-weight: 650; }
        .opc-edit-head > div:last-child { display: flex; gap: 8px; }
        .opc-edit-section { padding-top: 16px; margin-top: 16px; border-top: 1px solid ${BRAND.border}; }
        .opc-edit-section h3 { margin: 0 0 12px; font-size: 14px; font-weight: 850; }
        .opc-edit-grid { display: grid; gap: 10px; }
        .opc-edit-grid.three { grid-template-columns: repeat(3,minmax(0,1fr)); }
        .opc-edit-field { display: grid; gap: 6px; color: ${BRAND.muted}; font-size: 11px; font-weight: 780; min-width: 0; }
        .opc-edit-field input, .opc-edit-field select, .opc-edit-field textarea, .opc-edit-skill select, .opc-edit-days input { width: 100%; min-height: 42px; border: 1px solid ${BRAND.border}; border-radius: 13px; padding: 9px 11px; background: #FFFFFF; color: ${BRAND.text}; outline: 0; font-family: ${pageFont}; font-size: 12px; font-weight: 700; }
        .opc-edit-skill-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
        .opc-edit-skill { border: 0; border-radius: 12px; overflow: hidden; }
        .opc-edit-skill.active { background: ${BRAND.soft}; box-shadow: inset 0 0 0 1px ${BRAND.border}; }
        .opc-edit-skill > button { width: 100%; min-height: 36px; border: 0; background: transparent; display: flex; align-items: center; gap: 8px; padding: 5px 7px; text-align: left; font-family: ${pageFont}; cursor: pointer; }
        .opc-edit-skill > button span { width: 18px; height: 18px; border: 2px solid ${BRAND.text}; border-radius: 999px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .opc-edit-skill.active > button span { background: ${BRAND.black}; border-color: ${BRAND.black}; color: #FFFFFF; }
        .opc-edit-skill > button strong { font-size: 12px; }
        .opc-edit-skill > div { padding: 4px 8px 9px 33px; display: grid; gap: 7px; }
        .opc-edit-skill label { color: ${BRAND.muted}; font-size: 11px; font-weight: 700; }
        .opc-edit-skill label { display: flex; align-items: center; gap: 7px; }
        .opc-edit-skill input[type="checkbox"],
        .opc-edit-checks input[type="checkbox"] {
          appearance: none;
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          margin: 0;
          border: 2px solid ${BRAND.text};
          border-radius: 999px;
          background: #FFFFFF;
          flex-shrink: 0;
          cursor: pointer;
        }
        .opc-edit-skill input[type="checkbox"]:checked,
        .opc-edit-checks input[type="checkbox"]:checked {
          background: ${BRAND.black};
          box-shadow: inset 0 0 0 3px #FFFFFF;
        }
        .opc-edit-checks { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 5px 12px; margin-top: 10px; }
        .opc-edit-checks label { min-height: 30px; border: 0; border-radius: 0; padding: 3px 0; display: flex; align-items: center; gap: 7px; color: ${BRAND.text}; font-size: 11px; font-weight: 720; }
        .opc-edit-field textarea { min-height: 90px; resize: vertical; }
        .opc-edit-days { display: grid; gap: 7px; margin-top: 12px; }
        .opc-edit-days > div { display: grid; grid-template-columns: minmax(140px,1fr) repeat(2,minmax(100px,.7fr)); gap: 8px; padding: 8px; border: 1px solid ${BRAND.border}; border-radius: 14px; }
        .opc-edit-days > div.active { background: ${BRAND.soft}; }
        .opc-edit-days button { border: 0; background: transparent; display: flex; align-items: center; gap: 8px; font-family: ${pageFont}; font-size: 12px; font-weight: 780; cursor: pointer; }
        .opc-edit-days button span { width: 24px; height: 24px; border: 1px solid ${BRAND.border}; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
        .opc-edit-days > div.active button span { background: ${BRAND.black}; border-color: ${BRAND.black}; color: #FFFFFF; }
        .opc-section-title-row { display: flex; align-items: center; justify-content: space-between; margin: 0 2px 10px; }
        .opc-section-title-row h2 { margin: 0; font-size: 17px; font-weight: 860; letter-spacing: -.03em; }
        .opc-section-title-row > div { display: flex; gap: 7px; }
        .opc-section-title-row button { width: 34px; height: 34px; border-radius: 11px; border: 1px solid ${BRAND.border}; background: #FFFFFF; color: ${BRAND.text}; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .opc-employee-detail-strip { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(260px,1fr); gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; margin-bottom: 18px; }
        .opc-employee-detail-strip::-webkit-scrollbar { display:none; }
        .opc-employee-detail-card { min-height: 220px; padding: 17px; border: 1px solid ${BRAND.border}; border-radius: 18px; background: #FFFFFF; scroll-snap-align: start; }
        .opc-employee-detail-card h3 { margin: 0 0 13px; font-size: 14px; font-weight: 850; }
        .opc-employee-detail-card > div { display: grid; gap: 10px; }
        .opc-employee-mini-field { display: grid; gap: 3px; padding-bottom: 9px; border-bottom: 1px solid #F3F4F6; min-width: 0; }
        .opc-employee-mini-field:last-child { border-bottom: 0; }
        .opc-employee-mini-field span { color: ${BRAND.muted}; font-size: 11px; font-weight: 700; }
        .opc-employee-mini-field strong { color: ${BRAND.text}; font-size: 13px; line-height: 1.35; font-weight: 760; overflow-wrap: anywhere; }
        .opc-employee-main-grid { display: grid; grid-template-columns: minmax(0,1.65fr) minmax(300px,.8fr); gap: 14px; align-items: start; }
        .opc-employee-left-col, .opc-employee-right-col { display: grid; gap: 14px; }
        .opc-section-card { padding: 18px; }
        .opc-employee-section-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 15px; }
        .opc-employee-section-header h2 { margin: 0; font-size: 16px; font-weight: 860; letter-spacing: -.025em; }
        .opc-empty-box { min-height: 86px; border: 1px dashed ${BRAND.borderStrong}; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: ${BRAND.muted}; font-size: 12px; font-weight: 650; text-align: center; padding: 15px; }
        .opc-skill-display-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 9px; }
        .opc-skill-display-grid > div { border: 1px solid ${BRAND.border}; border-radius: 14px; padding: 11px; display: grid; gap: 4px; }
        .opc-skill-display-grid span, .opc-skill-display-grid small { color: ${BRAND.muted}; font-size: 10px; font-weight: 700; text-transform: capitalize; }
        .opc-skill-display-grid strong { font-size: 12px; font-weight: 800; }
        .opc-availability-summary { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; }
        .opc-availability-list { margin-top: 14px; display: grid; gap: 7px; }
        .opc-availability-list > div { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center; border: 1px solid ${BRAND.border}; border-radius: 13px; padding: 10px 11px; }
        .opc-availability-list strong { font-size: 12px; }
        .opc-availability-list span, .opc-availability-list small { color: ${BRAND.muted}; font-size: 11px; font-weight: 700; }
        .opc-two-col { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; }
        .opc-info-stack { display: grid; gap: 10px; }
        .opc-document-upload-head { display: flex; gap: 8px; }
        .opc-document-upload-head select, .opc-document-meta-row input, .opc-note-form select, .opc-note-form input, .opc-note-form textarea { min-height: 40px; border: 1px solid ${BRAND.border}; border-radius: 12px; padding: 8px 10px; background: #FFFFFF; color: ${BRAND.text}; font-family: ${pageFont}; font-size: 11px; font-weight: 700; outline: 0; }
        .opc-upload-button { min-height: 40px; border-radius: 12px; border: 1px solid ${BRAND.black}; background: ${BRAND.black}; color: #FFFFFF; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 0 12px; font-size: 11px; font-weight: 800; cursor: pointer; }
        .opc-upload-button input { display:none; }
        .opc-document-meta-row { display: grid; grid-template-columns: minmax(0,1fr) 170px; gap: 8px; margin-bottom: 12px; }
        .opc-document-hint { margin: -3px 0 12px; color: ${BRAND.muted}; font-size: 10px; line-height: 1.45; font-weight: 650; }
        .opc-document-list { display: grid; gap: 8px; }
        .opc-document-list a { display: grid; grid-template-columns: 35px minmax(0,1fr) auto; gap: 10px; align-items: center; padding: 10px; border: 1px solid ${BRAND.border}; border-radius: 14px; text-decoration: none; color: ${BRAND.text}; }
        .opc-document-list a > span { width: 35px; height: 35px; border-radius: 11px; background: ${BRAND.soft}; display: flex; align-items: center; justify-content: center; }
        .opc-document-list strong { display:block; font-size: 12px; }
        .opc-document-list small { display:block; margin-top:3px; color:${BRAND.muted}; font-size:10px; }
        .opc-payroll-owner-card { border-color: #D1D5DB !important; }
        .opc-payroll-notice { display:flex; align-items:center; gap:8px; border:1px solid ${BRAND.border}; background:${BRAND.soft}; border-radius:13px; padding:10px 11px; color:${BRAND.muted}; font-size:11px; font-weight:700; margin-bottom:10px; }
        .opc-contract-upload-panel { border: 1px solid ${BRAND.border}; border-radius: 14px; padding: 12px; margin-bottom: 10px; background: #FFFFFF; }
        .opc-contract-upload-copy { display: grid; gap: 4px; margin-bottom: 10px; }
        .opc-contract-upload-copy strong { font-size: 12px; }
        .opc-contract-upload-copy span { color: ${BRAND.muted}; font-size: 10px; line-height: 1.45; font-weight: 650; }
        .opc-contract-upload-grid { display: grid; grid-template-columns: minmax(0,1.15fr) minmax(0,1fr) 150px auto; gap: 8px; }
        .opc-contract-upload-grid select, .opc-contract-upload-grid input { width: 100%; min-width: 0; min-height: 40px; border: 1px solid ${BRAND.border}; border-radius: 12px; padding: 8px 10px; background: #FFFFFF; color: ${BRAND.text}; font-family: ${pageFont}; font-size: 11px; font-weight: 700; outline: 0; }
        .opc-template-button { min-height: 38px; margin-top: 8px; border: 1px dashed ${BRAND.borderStrong}; border-radius: 11px; padding: 0 11px; background: ${BRAND.soft}; color: ${BRAND.muted}; display: inline-flex; align-items: center; justify-content: center; gap: 7px; font-family: ${pageFont}; font-size: 10px; font-weight: 760; }
        .opc-contract-document-list { display: grid; gap: 8px; margin-bottom: 10px; }
        .opc-contract-document-list a { display: grid; grid-template-columns: 34px minmax(0,1fr) auto; gap: 9px; align-items: center; padding: 9px 10px; border: 1px solid ${BRAND.border}; border-radius: 13px; text-decoration: none; color: ${BRAND.text}; }
        .opc-contract-document-list a > span { width: 34px; height: 34px; border-radius: 10px; background: ${BRAND.soft}; display: flex; align-items: center; justify-content: center; }
        .opc-contract-document-list strong { display: block; font-size: 11px; }
        .opc-contract-document-list small { display: block; margin-top: 3px; color: ${BRAND.muted}; font-size: 9px; }
        .opc-contract-list { display:grid; gap:8px; }
        .opc-contract-list > div { border:1px solid ${BRAND.border}; border-radius:13px; padding:11px; display:grid; gap:4px; }
        .opc-contract-list strong { font-size:12px; } .opc-contract-list span,.opc-contract-list small { color:${BRAND.muted}; font-size:10px; font-weight:700; }
        .opc-contact-card { display:flex; align-items:center; gap:11px; }
        .opc-contact-avatar { width:44px; height:44px; border-radius:14px; border:1px solid ${BRAND.border}; background:${BRAND.soft}; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:850; flex-shrink:0; }
        .opc-contact-card strong,.opc-contact-card span { display:block; } .opc-contact-card strong{font-size:13px;} .opc-contact-card span{color:${BRAND.muted};font-size:11px;font-weight:650;margin-top:3px;}
        .opc-contact-actions { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-top:12px; }
        .opc-contact-actions a { min-height:40px; border:1px solid ${BRAND.border}; border-radius:12px; display:flex; align-items:center; justify-content:center; gap:7px; color:${BRAND.text}; text-decoration:none; font-size:11px; font-weight:780; }
        .opc-note-form { display:grid; gap:8px; } .opc-note-form textarea { min-height:88px; resize:vertical; }
        .opc-note-list { display:grid; gap:8px; }
        .opc-note-list > div { border:1px solid ${BRAND.border}; border-radius:14px; padding:11px; }
        .opc-note-list > div > div { display:flex; justify-content:space-between; gap:8px; } .opc-note-list strong{font-size:12px;} .opc-note-list span{font-size:10px;color:${BRAND.muted};font-weight:700;}
        .opc-note-list p { margin:8px 0; color:${BRAND.text}; font-size:12px; line-height:1.5; white-space:pre-wrap; } .opc-note-list small{color:${BRAND.faint};font-size:10px;font-weight:650;}
        .spin { animation: opcEmployeeSpin .8s linear infinite; } @keyframes opcEmployeeSpin { to{transform:rotate(360deg);} }
        @media(min-width:1180px){.opc-employee-metrics-grid{grid-template-columns:repeat(4,minmax(0,1fr));}.opc-employee-detail-strip{grid-auto-columns:minmax(280px,1fr);}}
        @media(max-width:980px){.opc-employee-main-grid{grid-template-columns:1fr;}.opc-edit-grid.three{grid-template-columns:repeat(2,minmax(0,1fr));}}
        @media(max-width:720px){
          .opc-employee-page{padding-bottom:110px;}.opc-employee-hero{padding:17px;}.opc-employee-hero-main{align-items:flex-start;}.opc-employee-hero h1{font-size:24px;}.opc-employee-hero-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));}.opc-employee-hero-actions .opc-btn{width:100%;}.opc-employee-hero-actions .opc-btn-dark{grid-column:1/-1;}
          .opc-edit-head{display:grid;}.opc-edit-head>div:last-child{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));}.opc-edit-grid.three,.opc-two-col,.opc-availability-summary{grid-template-columns:1fr;}.opc-edit-skill-grid{grid-template-columns:repeat(2,minmax(0,1fr));}.opc-edit-checks{grid-template-columns:repeat(2,minmax(0,1fr));}.opc-edit-days>div{grid-template-columns:1fr 1fr;}.opc-edit-days button{grid-column:1/-1;}.opc-skill-display-grid{grid-template-columns:1fr;}.opc-availability-list>div{grid-template-columns:1fr auto;}.opc-availability-list small{grid-column:1/-1;}.opc-document-upload-head{display:grid;grid-template-columns:1fr;}.opc-document-meta-row{grid-template-columns:1fr;}.opc-contract-upload-grid{grid-template-columns:1fr;}.opc-upload-button{width:100%;}.opc-section-card{padding:15px;}
        }
        @media(max-width:460px){
          .opc-edit-skill-grid,.opc-edit-checks{grid-template-columns:1fr;}
        }
      `}</style>
    </MirakaDashboardShell>
  );
}
