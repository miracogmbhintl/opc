import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';
import {
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  GraduationCap,
  HeartHandshake,
  Landmark,
  Loader2,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Upload,
  X,
  UserRound,
  UsersRound,
} from 'lucide-react';
import MirakaDashboardShell from './MirakaDashboardShell';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';

type JsonRow = Record<string, any>;

type SkillSelection = {
  skill_id: string;
  proficiency_level: string;
  is_preferred: boolean;
  can_work_independently: boolean;
  can_lead_team: boolean;
  years_experience: string;
};

type DayRule = {
  day_of_week: number;
  label: string;
  enabled: boolean;
  start_time: string;
  end_time: string;
  availability_type: 'available' | 'preferred' | 'on_call';
};

type PendingDocument = {
  id: string;
  file: File;
  document_type: string;
  title: string;
  valid_until: string;
};

type FormState = {
  staff_role_id: string;
  employing_entity_id: string;
  operational_position_id: string;
  legal_first_name: string;
  legal_last_name: string;
  preferred_name: string;
  date_of_birth: string;
  gender_code: string;
  civil_status: string;
  birth_place: string;
  citizenship_place: string;
  ahv_number: string;
  private_email: string;
  business_email: string;
  phone_raw: string;
  fax_number: string;
  preferred_language: string;
  status: string;
  assignment_status: string;
  profile_completion_status: string;
  personnel_type: string;
  payroll_in_scope: boolean;
  portal_access_only: boolean;
  payroll_exclusion_reason: string;
  entry_date: string;
  exit_date: string;
  us_tax_person: boolean;
  onboarding_form_signed_at: string;
  onboarding_source: string;
  address: {
    street: string;
    house_number: string;
    address_addition: string;
    postal_code: string;
    city: string;
    canton_code: string;
    country_code: string;
  };
  nationality: {
    country_code: string;
  };
  permit: {
    permit_type: string;
    permit_number: string;
    permit_status: string;
    issuing_country_code: string;
    issuing_canton_code: string;
    is_cross_border_permit: boolean;
    valid_from: string;
    valid_until: string;
    notes: string;
  };
  bank_account: {
    bank_name: string;
    bank_address_line1: string;
    bank_postal_code: string;
    bank_city: string;
    bank_country_code: string;
    iban: string;
    bic: string;
    account_holder: string;
    currency_code: string;
    notes: string;
  };
  qualification: {
    qualification_level_code: string;
    qualification_title: string;
    field_of_study: string;
    institution_name: string;
    country_code: string;
    completed_on: string;
    swiss_recognition_status: string;
    relevant_for_cleaning_gav: boolean;
    relevant_for_current_position: boolean;
    verification_status: string;
    notes: string;
  };
  availability: {
    availability_mode: string;
    timezone: string;
    short_notice_available: boolean;
    minimum_notice_hours: string;
    weekend_available: boolean;
    saturday_available: boolean;
    sunday_available: boolean;
    public_holiday_available: boolean;
    night_work_available: boolean;
    preferred_weekly_hours: string;
    maximum_weekly_hours: string;
    notes: string;
  };
  emergency_contact: {
    full_name: string;
    relationship_label: string;
    phone_raw: string;
    email: string;
    preferred_language: string;
    notes: string;
  };
  initial_note: string;
  initial_note_type: string;
  initial_note_title: string;
  initial_note_visibility: string;
};

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
  amber: '#92400E',
};

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

const cardStyle: CSSProperties = {
  background: BRAND.card,
  border: `1px solid ${BRAND.border}`,
  borderRadius: '20px',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

const DAY_RULES: DayRule[] = [
  { day_of_week: 1, label: 'Montag', enabled: true, start_time: '08:00', end_time: '17:00', availability_type: 'available' },
  { day_of_week: 2, label: 'Dienstag', enabled: true, start_time: '08:00', end_time: '17:00', availability_type: 'available' },
  { day_of_week: 3, label: 'Mittwoch', enabled: true, start_time: '08:00', end_time: '17:00', availability_type: 'available' },
  { day_of_week: 4, label: 'Donnerstag', enabled: true, start_time: '08:00', end_time: '17:00', availability_type: 'available' },
  { day_of_week: 5, label: 'Freitag', enabled: true, start_time: '08:00', end_time: '17:00', availability_type: 'available' },
  { day_of_week: 6, label: 'Samstag', enabled: false, start_time: '08:00', end_time: '17:00', availability_type: 'available' },
  { day_of_week: 7, label: 'Sonntag', enabled: false, start_time: '08:00', end_time: '17:00', availability_type: 'available' },
];

function initialForm(): FormState {
  return {
    staff_role_id: '',
    employing_entity_id: '',
    operational_position_id: '',
    legal_first_name: '',
    legal_last_name: '',
    preferred_name: '',
    date_of_birth: '',
    gender_code: '',
    civil_status: '',
    birth_place: '',
    citizenship_place: '',
    ahv_number: '',
    private_email: '',
    business_email: '',
    phone_raw: '',
    fax_number: '',
    preferred_language: 'de-CH',
    status: 'onboarding',
    assignment_status: 'available',
    profile_completion_status: 'incomplete',
    personnel_type: 'employee',
    payroll_in_scope: true,
    portal_access_only: false,
    payroll_exclusion_reason: '',
    entry_date: '',
    exit_date: '',
    us_tax_person: false,
    onboarding_form_signed_at: '',
    onboarding_source: 'portal_manual',
    address: {
      street: '',
      house_number: '',
      address_addition: '',
      postal_code: '',
      city: '',
      canton_code: 'BL',
      country_code: 'CH',
    },
    nationality: {
      country_code: '',
    },
    permit: {
      permit_type: '',
      permit_number: '',
      permit_status: 'valid',
      issuing_country_code: 'CH',
      issuing_canton_code: 'BL',
      is_cross_border_permit: false,
      valid_from: '',
      valid_until: '',
      notes: '',
    },
    bank_account: {
      bank_name: '',
      bank_address_line1: '',
      bank_postal_code: '',
      bank_city: '',
      bank_country_code: 'CH',
      iban: '',
      bic: '',
      account_holder: '',
      currency_code: 'CHF',
      notes: '',
    },
    qualification: {
      qualification_level_code: 'none',
      qualification_title: 'Keine formelle Ausbildung',
      field_of_study: '',
      institution_name: '',
      country_code: '',
      completed_on: '',
      swiss_recognition_status: 'not_required',
      relevant_for_cleaning_gav: false,
      relevant_for_current_position: true,
      verification_status: 'unverified',
      notes: '',
    },
    availability: {
      availability_mode: 'weekly_schedule',
      timezone: 'Europe/Zurich',
      short_notice_available: false,
      minimum_notice_hours: '24',
      weekend_available: false,
      saturday_available: false,
      sunday_available: false,
      public_holiday_available: false,
      night_work_available: false,
      preferred_weekly_hours: '',
      maximum_weekly_hours: '',
      notes: '',
    },
    emergency_contact: {
      full_name: '',
      relationship_label: '',
      phone_raw: '',
      email: '',
      preferred_language: 'de-CH',
      notes: '',
    },
    initial_note: '',
    initial_note_type: 'onboarding',
    initial_note_title: 'Erstaufnahme',
    initial_note_visibility: 'hr_admins',
  };
}

async function getToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Keine aktive Sitzung gefunden.');
  return token;
}

async function apiGet<T>(path: string): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const payload = (await response.json().catch(() => ({}))) as any;
  if (!response.ok) throw new Error(payload?.error || 'Anfrage fehlgeschlagen.');
  return payload as T;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as any;
  if (!response.ok) throw new Error(payload?.error || 'Mitarbeiter konnte nicht gespeichert werden.');
  return payload as T;
}

async function uploadEmployeeDocument(employeeId: string, document: PendingDocument) {
  const token = await getToken();
  const formData = new FormData();
  formData.set('employeeId', employeeId);
  formData.set('documentType', document.document_type);
  formData.set('title', document.title || document.file.name);
  formData.set('validUntil', document.valid_until);
  formData.set('file', document.file);

  const response = await fetch(`${baseUrl}/api/opc/employees/upload-document`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    body: formData,
  });

  const payload = (await response.json().catch(() => ({}))) as any;
  if (!response.ok) throw new Error(payload?.error || `${document.file.name} konnte nicht hochgeladen werden.`);
  return payload;
}

function splitName(value: string) {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
  };
}

function SectionCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="opc-employee-plan-card" style={cardStyle}>
      <div className="opc-employee-plan-card-header">
        <div className="opc-employee-plan-card-icon">{icon}</div>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="opc-employee-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  helper,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  helper?: string;
}) {
  return (
    <button
      type="button"
      className={`opc-toggle-row ${checked ? 'active' : ''}`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <span className="opc-toggle-box">{checked ? <CheckCircle2 size={15} /> : null}</span>
      <span>
        <strong>{label}</strong>
        {helper ? <small>{helper}</small> : null}
      </span>
    </button>
  );
}

export default function EmployeeCreatePage() {
  const [form, setForm] = useState<FormState>(() => initialForm());
  const [dayRules, setDayRules] = useState<DayRule[]>(DAY_RULES);
  const [selectedSkills, setSelectedSkills] = useState<Record<string, SkillSelection>>({});
  const [entities, setEntities] = useState<JsonRow[]>([]);
  const [positions, setPositions] = useState<JsonRow[]>([]);
  const [skills, setSkills] = useState<JsonRow[]>([]);
  const [staffOptions, setStaffOptions] = useState<JsonRow[]>([]);
  const [role, setRole] = useState<'owner' | 'admin' | ''>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [message, setMessage] = useState('');
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [pendingDocumentType, setPendingDocumentType] = useState('identity_document');
  const [pendingDocumentTitle, setPendingDocumentTitle] = useState('');
  const [pendingDocumentValidUntil, setPendingDocumentValidUntil] = useState('');

  useEffect(() => {
    void loadOptions();
  }, []);

  async function loadOptions() {
    setLoading(true);
    setErrorMessage('');

    try {
      const payload = await apiGet<any>('/api/opc/employees');
      const nextEntities = payload.options?.entities || [];
      const nextPositions = payload.options?.positions || [];
      const nextStaff = payload.options?.unlinkedStaff || [];

      setEntities(nextEntities);
      setPositions(nextPositions);
      setSkills(payload.options?.skills || []);
      setStaffOptions(nextStaff);
      setRole(payload.role || '');

      const params = new URLSearchParams(window.location.search);
      const requestedStaffRoleId = params.get('staffRoleId') || '';
      const selectedStaff = nextStaff.find((item: JsonRow) => String(item.id) === requestedStaffRoleId);
      const defaultEntity =
        nextEntities.find((entity: JsonRow) => entity.is_payroll_employer_for_opc) || nextEntities[0] || null;
      const defaultPosition =
        nextPositions.find((position: JsonRow) => position.position_code === 'cleaning_maintenance') ||
        nextPositions[0] ||
        null;

      setForm((current) => {
        const next = {
          ...current,
          employing_entity_id: current.employing_entity_id || defaultEntity?.id || '',
          operational_position_id: current.operational_position_id || defaultPosition?.id || '',
          staff_role_id: requestedStaffRoleId || current.staff_role_id,
        };

        if (selectedStaff) {
          const name = splitName(selectedStaff.display_name || '');
          next.legal_first_name = name.firstName;
          next.legal_last_name = name.lastName;
          next.business_email = selectedStaff.email || '';
          next.phone_raw = selectedStaff.phone_e164 || selectedStaff.phone_raw || '';
        }

        return next;
      });
    } catch (error: any) {
      setErrorMessage(error?.message || 'Formularoptionen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  function setRoot<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setNested<K extends 'address' | 'nationality' | 'permit' | 'bank_account' | 'qualification' | 'availability' | 'emergency_contact'>(
    group: K,
    key: keyof FormState[K],
    value: any,
  ) {
    setForm((current) => ({
      ...current,
      [group]: {
        ...current[group],
        [key]: value,
      },
    }));
  }

  function handleStaffChange(staffRoleId: string) {
    const staff = staffOptions.find((item) => String(item.id) === staffRoleId);
    setForm((current) => {
      if (!staff) return { ...current, staff_role_id: staffRoleId };
      const name = splitName(staff.display_name || '');
      return {
        ...current,
        staff_role_id: staffRoleId,
        legal_first_name: current.legal_first_name || name.firstName,
        legal_last_name: current.legal_last_name || name.lastName,
        business_email: current.business_email || staff.email || '',
        phone_raw: current.phone_raw || staff.phone_e164 || staff.phone_raw || '',
      };
    });
  }

  function toggleSkill(skillId: string) {
    setSelectedSkills((current) => {
      const copy = { ...current };
      if (copy[skillId]) {
        delete copy[skillId];
      } else {
        copy[skillId] = {
          skill_id: skillId,
          proficiency_level: 'independent',
          is_preferred: false,
          can_work_independently: true,
          can_lead_team: false,
          years_experience: '',
        };
      }
      return copy;
    });
  }

  function updateSkill(skillId: string, patch: Partial<SkillSelection>) {
    setSelectedSkills((current) => ({
      ...current,
      [skillId]: {
        ...current[skillId],
        ...patch,
      },
    }));
  }

  function updateDayRule(day: number, patch: Partial<DayRule>) {
    setDayRules((current) =>
      current.map((rule) => (rule.day_of_week === day ? { ...rule, ...patch } : rule)),
    );
  }

  const groupedSkills = useMemo(() => {
    const groups = new Map<string, JsonRow[]>();
    skills.forEach((skill) => {
      const key = skill.category_group || 'weitere';
      groups.set(key, [...(groups.get(key) || []), skill]);
    });
    return Array.from(groups.entries());
  }, [skills]);

  const selectedPosition = useMemo(
    () => positions.find((position) => String(position.id) === form.operational_position_id) || null,
    [form.operational_position_id, positions],
  );

  const selectedEntity = useMemo(
    () => entities.find((entity) => String(entity.id) === form.employing_entity_id) || null,
    [entities, form.employing_entity_id],
  );

  const displayName =
    [form.legal_first_name, form.legal_last_name].filter(Boolean).join(' ') || 'Mitarbeiter anlegen';
  const availabilityLabel =
    form.availability.availability_mode === '24_7'
      ? '24/7'
      : form.availability.availability_mode === 'on_call'
        ? 'Auf Abruf'
        : form.availability.availability_mode === 'unavailable'
          ? 'Nicht verfügbar'
          : `${dayRules.filter((rule) => rule.enabled).length} Tage`;

  function handlePendingDocuments(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    setPendingDocuments((current) => [
      ...current,
      ...files.map((file, index) => ({
        id: `${Date.now()}-${index}-${file.name}`,
        file,
        document_type: pendingDocumentType,
        title: pendingDocumentTitle.trim(),
        valid_until: pendingDocumentValidUntil,
      })),
    ]);

    setPendingDocumentTitle('');
  }

  function removePendingDocument(id: string) {
    setPendingDocuments((current) => current.filter((document) => document.id !== id));
  }

  async function handleSave() {
    if (saving) return;
    setErrorMessage('');
    setMessage('');

    if (!form.legal_first_name.trim() || !form.legal_last_name.trim()) {
      setErrorMessage('Bitte Vorname und Nachname eintragen.');
      return;
    }

    if (!form.employing_entity_id) {
      setErrorMessage('Bitte einen Rechtsträger auswählen.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...form,
        phone_e164: form.phone_raw,
        skills: Object.values(selectedSkills),
        availability_rules:
          form.availability.availability_mode === 'weekly_schedule'
            ? dayRules.map((rule) => ({ ...rule }))
            : [],
      };

      const response = await apiPost<any>('/api/opc/employees/create', payload);

      let uploadedCount = 0;
      const uploadErrors: string[] = [];

      for (const document of pendingDocuments) {
        try {
          await uploadEmployeeDocument(response.employeeId, document);
          uploadedCount += 1;
        } catch (uploadError: any) {
          uploadErrors.push(uploadError?.message || `${document.file.name} konnte nicht hochgeladen werden.`);
        }
      }

      if (uploadErrors.length) {
        setMessage(
          `Mitarbeiter wurde gespeichert. ${uploadedCount} Dokument${uploadedCount === 1 ? '' : 'e'} hochgeladen. ${uploadErrors.length} Upload${uploadErrors.length === 1 ? '' : 's'} konnten nicht abgeschlossen werden.`,
        );
      } else {
        setMessage(
          pendingDocuments.length
            ? `Mitarbeiter und ${uploadedCount} Dokument${uploadedCount === 1 ? '' : 'e'} wurden gespeichert.`
            : 'Mitarbeiter wurde gespeichert. Die Personalakte wird geöffnet.',
        );
      }

      window.setTimeout(() => {
        window.location.href = `${baseUrl}/mitarbeiter/${response.employeeId}`;
      }, uploadErrors.length ? 1200 : 450);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Mitarbeiter konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <MirakaDashboardShell hideTopBar={true} requiredRole={['owner', 'admin']} currentPath="/mitarbeiter">
        <div className="opc-employee-create-loading" style={{ fontFamily: pageFont }}>
          <Loader2 size={19} className="spin" />
          Mitarbeiterformular wird geladen...
        </div>
      </MirakaDashboardShell>
    );
  }

  return (
    <MirakaDashboardShell
      hideTopBar={true}
      requiredRole={['owner', 'admin']}
      currentPath="/mitarbeiter"
    >
      <div className="opc-employee-create-page" style={{ fontFamily: pageFont, color: BRAND.text }}>
        <a href={`${baseUrl}/mitarbeiter`} className="opc-back-link">
          ← Zurück zu Mitarbeiter
        </a>

        {errorMessage ? <div className="opc-create-error">{errorMessage}</div> : null}
        {message ? <div className="opc-create-message">{message}</div> : null}

        <section className="opc-create-hero" style={cardStyle}>
          <div className="opc-create-status-dot"><span /></div>
          <div className="opc-create-eyebrow">Neue Personalakte</div>
          <h1>{displayName}</h1>
          <div className="opc-create-hero-meta">
            <span>{selectedPosition?.title_de || 'Position noch nicht gewählt'}</span>
            <span>{selectedEntity?.legal_name || 'Rechtsträger noch nicht gewählt'}</span>
            <span>{form.staff_role_id ? 'Mit Portalnutzer verknüpft' : 'Ohne Portalzugang'}</span>
          </div>
        </section>

        <div className="opc-create-metrics-grid">
          <div className="opc-create-metric-card">
            <div><div className="opc-create-metric-value">{form.status === 'active' ? 'Aktiv' : 'Onboarding'}</div><div className="opc-create-metric-label">Status</div></div>
            <div className="opc-create-metric-icon"><CheckCircle2 size={18} /></div>
          </div>
          <div className="opc-create-metric-card">
            <div><div className="opc-create-metric-value">{form.profile_completion_status === 'complete' ? 'Vollständig' : 'Im Aufbau'}</div><div className="opc-create-metric-label">Personalakte</div></div>
            <div className="opc-create-metric-icon"><FileText size={18} /></div>
          </div>
          <div className="opc-create-metric-card">
            <div><div className="opc-create-metric-value">{Object.keys(selectedSkills).length}</div><div className="opc-create-metric-label">Skills ausgewählt</div></div>
            <div className="opc-create-metric-icon"><BadgeCheck size={18} /></div>
          </div>
          <div className="opc-create-metric-card">
            <div><div className="opc-create-metric-value">{availabilityLabel}</div><div className="opc-create-metric-label">Verfügbarkeit</div></div>
            <div className="opc-create-metric-icon"><Clock3 size={18} /></div>
          </div>
        </div>

        <div className="opc-create-main">
          <SectionCard title="Portal und Zuordnung" icon={<UsersRound size={17} />}>
            <div className="opc-form-grid two">
              <Field label="Bestehenden Portalnutzer übernehmen">
                <select value={form.staff_role_id} onChange={(event) => handleStaffChange(event.target.value)}>
                  <option value="">Neue Person ohne Portalverknüpfung</option>
                  {staffOptions.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.display_name || staff.email} · {staff.role}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Rechtsträger *">
                <select value={form.employing_entity_id} onChange={(event) => setRoot('employing_entity_id', event.target.value)}>
                  <option value="">Rechtsträger auswählen</option>
                  {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.legal_name}</option>)}
                </select>
              </Field>
              <Field label="Personentyp">
                <select
                  value={form.personnel_type}
                  onChange={(event) => {
                    const value = event.target.value;
                    const external = ['external_contractor', 'external_infrastructure', 'agency_worker', 'temporary_external'].includes(value);
                    setForm((current) => ({
                      ...current,
                      personnel_type: value,
                      payroll_in_scope: external ? false : current.payroll_in_scope,
                      portal_access_only: value === 'external_infrastructure',
                    }));
                  }}
                >
                  <option value="employee">Mitarbeiter/in</option>
                  <option value="owner_employee">Inhaber/in mit Anstellung</option>
                  <option value="external_contractor">Externe Fachkraft</option>
                  <option value="external_infrastructure">Externe Infrastruktur</option>
                  <option value="agency_worker">Temporär über Agentur</option>
                  <option value="temporary_external">Temporäre externe Kraft</option>
                  <option value="intern">Praktikum</option>
                  <option value="apprentice">Lernende/r</option>
                  <option value="other">Andere</option>
                </select>
              </Field>
              <Field label="Position">
                <select value={form.operational_position_id} onChange={(event) => setRoot('operational_position_id', event.target.value)}>
                  <option value="">Position auswählen</option>
                  {positions.map((position) => <option key={position.id} value={position.id}>{position.title_de}</option>)}
                </select>
              </Field>
              <Field label="Personalstatus">
                <select value={form.status} onChange={(event) => setRoot('status', event.target.value)}>
                  <option value="onboarding">Onboarding</option>
                  <option value="active">Aktiv</option>
                  <option value="inactive">Inaktiv</option>
                  <option value="suspended">Gesperrt</option>
                </select>
              </Field>
              <Field label="Einsatzstatus">
                <select value={form.assignment_status} onChange={(event) => setRoot('assignment_status', event.target.value)}>
                  <option value="available">Verfügbar</option>
                  <option value="limited">Eingeschränkt</option>
                  <option value="unavailable">Nicht verfügbar</option>
                  <option value="on_leave">Abwesend</option>
                  <option value="inactive">Inaktiv</option>
                </select>
              </Field>
            </div>
            <div className="opc-toggle-grid">
              <Toggle checked={form.payroll_in_scope} onChange={(value) => setRoot('payroll_in_scope', value)} label="Für OPC-Lohnabrechnung vorgesehen" helper="Die tatsächlichen Lohnwerte bleiben Owner-only." />
              <Toggle checked={form.portal_access_only} onChange={(value) => setForm((current) => ({ ...current, portal_access_only: value, payroll_in_scope: value ? false : current.payroll_in_scope }))} label="Nur Portal-/Infrastrukturzugang" helper="Kein Bestandteil der OPC-Lohnabrechnung." />
            </div>
            {!form.payroll_in_scope ? (
              <Field label="Grund für den Ausschluss">
                <textarea value={form.payroll_exclusion_reason} onChange={(event) => setRoot('payroll_exclusion_reason', event.target.value)} placeholder="Begründung für Payroll-Ausschluss" />
              </Field>
            ) : null}
          </SectionCard>

          <SectionCard title="Personalien" icon={<UserRound size={17} />}>
            <div className="opc-form-grid three">
              <Field label="Vorname *"><input value={form.legal_first_name} onChange={(event) => setRoot('legal_first_name', event.target.value)} /></Field>
              <Field label="Nachname *"><input value={form.legal_last_name} onChange={(event) => setRoot('legal_last_name', event.target.value)} /></Field>
              <Field label="Bevorzugter Name"><input value={form.preferred_name} onChange={(event) => setRoot('preferred_name', event.target.value)} /></Field>
              <Field label="Geburtsdatum"><input type="date" value={form.date_of_birth} onChange={(event) => setRoot('date_of_birth', event.target.value)} /></Field>
              <Field label="Geschlecht">
                <select value={form.gender_code} onChange={(event) => setRoot('gender_code', event.target.value)}>
                  <option value="">Nicht angegeben</option><option value="female">Weiblich</option><option value="male">Männlich</option><option value="diverse">Divers</option><option value="unspecified">Keine Angabe</option>
                </select>
              </Field>
              <Field label="Zivilstand">
                <select value={form.civil_status} onChange={(event) => setRoot('civil_status', event.target.value)}>
                  <option value="">Nicht angegeben</option><option value="single">Ledig</option><option value="married">Verheiratet</option><option value="registered_partnership">Eingetragene Partnerschaft</option><option value="divorced">Geschieden</option><option value="widowed">Verwitwet</option><option value="separated">Getrennt</option><option value="unknown">Unbekannt</option>
                </select>
              </Field>
              <Field label="Geburtsort"><input value={form.birth_place} onChange={(event) => setRoot('birth_place', event.target.value)} /></Field>
              <Field label="Bürgerort"><input value={form.citizenship_place} onChange={(event) => setRoot('citizenship_place', event.target.value)} /></Field>
              <Field label="AHV-/Versicherungsnummer"><input value={form.ahv_number} onChange={(event) => setRoot('ahv_number', event.target.value)} placeholder="756.0000.0000.00" /></Field>
            </div>
            <div className="opc-toggle-grid one">
              <Toggle checked={form.us_tax_person} onChange={(value) => setRoot('us_tax_person', value)} label="US-Steuerperson" helper="Markiert FATCA-/US-Person-Prüfbedarf." />
            </div>
          </SectionCard>

          <SectionCard title="Kontakt und Adresse" icon={<MapPin size={17} />}>
            <div className="opc-form-grid three">
              <Field label="Private E-Mail"><input type="email" value={form.private_email} onChange={(event) => setRoot('private_email', event.target.value)} /></Field>
              <Field label="Geschäftliche E-Mail"><input type="email" value={form.business_email} onChange={(event) => setRoot('business_email', event.target.value)} /></Field>
              <Field label="Telefon"><input value={form.phone_raw} onChange={(event) => setRoot('phone_raw', event.target.value)} placeholder="+41 79 ..." /></Field>
              <Field label="Fax"><input value={form.fax_number} onChange={(event) => setRoot('fax_number', event.target.value)} /></Field>
              <Field label="Sprache">
                <select value={form.preferred_language} onChange={(event) => setRoot('preferred_language', event.target.value)}>
                  <option value="de-CH">Deutsch</option><option value="fr-CH">Französisch</option><option value="it-CH">Italienisch</option><option value="en">Englisch</option><option value="sq">Albanisch</option>
                </select>
              </Field>
              <Field label="Eintrittsdatum"><input type="date" value={form.entry_date} onChange={(event) => setRoot('entry_date', event.target.value)} /></Field>
            </div>
            <div className="opc-form-grid two">
              <Field label="Strasse *"><input value={form.address.street} onChange={(event) => setNested('address', 'street', event.target.value)} /></Field>
              <Field label="Hausnummer"><input value={form.address.house_number} onChange={(event) => setNested('address', 'house_number', event.target.value)} /></Field>
              <Field label="Adresszusatz"><input value={form.address.address_addition} onChange={(event) => setNested('address', 'address_addition', event.target.value)} /></Field>
              <Field label="PLZ *"><input value={form.address.postal_code} onChange={(event) => setNested('address', 'postal_code', event.target.value)} /></Field>
              <Field label="Ort *"><input value={form.address.city} onChange={(event) => setNested('address', 'city', event.target.value)} /></Field>
              <Field label="Kanton/Region"><input value={form.address.canton_code} onChange={(event) => setNested('address', 'canton_code', event.target.value.toUpperCase())} maxLength={2} /></Field>
              <Field label="Land"><input value={form.address.country_code} onChange={(event) => setNested('address', 'country_code', event.target.value.toUpperCase())} maxLength={2} /></Field>
            </div>
          </SectionCard>

          <SectionCard title="Nationalität und Bewilligung" icon={<ShieldCheck size={17} />}>
            <div className="opc-form-grid three">
              <Field label="Nationalität"><input value={form.nationality.country_code} onChange={(event) => setNested('nationality', 'country_code', event.target.value.toUpperCase())} maxLength={2} placeholder="CH, IT, DE, FR ..." /></Field>
              <Field label="Ausländerausweis">
                <select
                  value={form.permit.permit_type}
                  onChange={(event) => {
                    const value = event.target.value;
                    setNested('permit', 'permit_type', value);
                    setNested('permit', 'is_cross_border_permit', value === 'g');
                  }}
                >
                  <option value="">Nicht erfasst</option><option value="swiss_citizen">Schweizer Bürger/in</option><option value="b">Ausweis B</option><option value="c">Ausweis C</option><option value="l">Ausweis L</option><option value="g">Ausweis G</option><option value="s">Ausweis S</option><option value="ci">Ausweis Ci</option><option value="n">Ausweis N</option><option value="f">Ausweis F</option><option value="not_required">Nicht erforderlich</option><option value="pending">Ausstehend</option><option value="other">Andere</option>
                </select>
              </Field>
              <Field label="Bewilligungsnummer"><input value={form.permit.permit_number} onChange={(event) => setNested('permit', 'permit_number', event.target.value)} /></Field>
              <Field label="Bewilligungsstatus">
                <select value={form.permit.permit_status} onChange={(event) => setNested('permit', 'permit_status', event.target.value)}>
                  <option value="valid">Gültig</option><option value="pending">Ausstehend</option><option value="renewal_pending">Verlängerung ausstehend</option><option value="expired">Abgelaufen</option><option value="revoked">Widerrufen</option><option value="not_required">Nicht erforderlich</option>
                </select>
              </Field>
              <Field label="Ausstellender Kanton"><input value={form.permit.issuing_canton_code} onChange={(event) => setNested('permit', 'issuing_canton_code', event.target.value.toUpperCase())} maxLength={2} /></Field>
              <Field label="Gültig ab"><input type="date" value={form.permit.valid_from} onChange={(event) => setNested('permit', 'valid_from', event.target.value)} /></Field>
              <Field label="Gültig bis"><input type="date" value={form.permit.valid_until} onChange={(event) => setNested('permit', 'valid_until', event.target.value)} /></Field>
            </div>
            <div className="opc-toggle-grid one">
              <Toggle checked={form.permit.is_cross_border_permit} onChange={(value) => setNested('permit', 'is_cross_border_permit', value)} label="Grenzgängerbewilligung" helper="Für Personen mit Wohnsitz ausserhalb der Schweiz." />
            </div>
          </SectionCard>

          <SectionCard title="Bankverbindung" icon={<Landmark size={17} />}>
            <div className="opc-form-grid three">
              <Field label="Bank"><input value={form.bank_account.bank_name} onChange={(event) => setNested('bank_account', 'bank_name', event.target.value)} placeholder="PostFinance, UBS ..." /></Field>
              <Field label="IBAN"><input value={form.bank_account.iban} onChange={(event) => setNested('bank_account', 'iban', event.target.value.toUpperCase())} placeholder="CH..." /></Field>
              <Field label="Kontoinhaber"><input value={form.bank_account.account_holder} onChange={(event) => setNested('bank_account', 'account_holder', event.target.value)} placeholder={displayName} /></Field>
              <Field label="BIC/SWIFT"><input value={form.bank_account.bic} onChange={(event) => setNested('bank_account', 'bic', event.target.value.toUpperCase())} /></Field>
              <Field label="Bankadresse"><input value={form.bank_account.bank_address_line1} onChange={(event) => setNested('bank_account', 'bank_address_line1', event.target.value)} /></Field>
              <Field label="Bankort"><input value={form.bank_account.bank_city} onChange={(event) => setNested('bank_account', 'bank_city', event.target.value)} /></Field>
            </div>
          </SectionCard>

          <SectionCard title="Ausbildung und Qualifikation" icon={<GraduationCap size={17} />}>
            <div className="opc-form-grid three">
              <Field label="Ausbildungsstufe">
                <select
                  value={form.qualification.qualification_level_code}
                  onChange={(event) => {
                    const value = event.target.value;
                    setNested('qualification', 'qualification_level_code', value);
                    if (value === 'none') setNested('qualification', 'qualification_title', 'Keine formelle Ausbildung');
                  }}
                >
                  <option value="none">Keine formelle Ausbildung</option><option value="compulsory_school">Obligatorische Schule</option><option value="internal_cleaning_level_ii">Anerkannte Branchenweiterbildung Stufe II</option><option value="eba">EBA</option><option value="efz">EFZ</option><option value="federal_professional_certificate">Eidg. Fachausweis</option><option value="federal_diploma">Eidg. Diplom</option><option value="hf">HF</option><option value="bachelor">Bachelor</option><option value="master">Master</option><option value="doctorate">Doktorat</option><option value="foreign_vocational">Ausländische Berufsausbildung</option><option value="foreign_academic">Ausländischer Hochschulabschluss</option><option value="other">Andere</option>
                </select>
              </Field>
              <Field label="Abschlussbezeichnung"><input value={form.qualification.qualification_title} onChange={(event) => setNested('qualification', 'qualification_title', event.target.value)} /></Field>
              <Field label="Fachrichtung"><input value={form.qualification.field_of_study} onChange={(event) => setNested('qualification', 'field_of_study', event.target.value)} /></Field>
              <Field label="Institut/Schule"><input value={form.qualification.institution_name} onChange={(event) => setNested('qualification', 'institution_name', event.target.value)} /></Field>
              <Field label="Ausbildungsland"><input value={form.qualification.country_code} onChange={(event) => setNested('qualification', 'country_code', event.target.value.toUpperCase())} maxLength={2} /></Field>
              <Field label="Abschlussdatum"><input type="date" value={form.qualification.completed_on} onChange={(event) => setNested('qualification', 'completed_on', event.target.value)} /></Field>
              <Field label="Schweizer Anerkennung">
                <select value={form.qualification.swiss_recognition_status} onChange={(event) => setNested('qualification', 'swiss_recognition_status', event.target.value)}>
                  <option value="not_required">Nicht erforderlich</option><option value="pending">Ausstehend</option><option value="recognized">Anerkannt</option><option value="partially_recognized">Teilweise anerkannt</option><option value="not_recognized">Nicht anerkannt</option><option value="unknown">Unbekannt</option>
                </select>
              </Field>
            </div>
            <div className="opc-toggle-grid">
              <Toggle checked={form.qualification.relevant_for_current_position} onChange={(value) => setNested('qualification', 'relevant_for_current_position', value)} label="Für aktuelle Position relevant" />
              <Toggle checked={form.qualification.relevant_for_cleaning_gav} onChange={(value) => setNested('qualification', 'relevant_for_cleaning_gav', value)} label="Für Reinigungs-GAV relevant" />
            </div>
          </SectionCard>

          <SectionCard title="Skills und Einsatzarten" icon={<BadgeCheck size={17} />}>
            <div className="opc-skill-groups">
              {groupedSkills.map(([group, groupSkills]) => (
                <div className="opc-skill-group" key={group}>
                  <h3>{group.replaceAll('_', ' ')}</h3>
                  <div className="opc-skill-grid">
                    {groupSkills.map((skill) => {
                      const selected = selectedSkills[String(skill.id)];
                      return (
                        <div key={skill.id} className={`opc-skill-item ${selected ? 'active' : ''}`}>
                          <button type="button" className="opc-skill-select" onClick={() => toggleSkill(String(skill.id))}>
                            <span>{selected ? <CheckCircle2 size={15} /> : null}</span>
                            <strong>{skill.name_de}</strong>
                          </button>
                          {selected ? (
                            <div className="opc-skill-options">
                              <select value={selected.proficiency_level} onChange={(event) => updateSkill(String(skill.id), { proficiency_level: event.target.value })}>
                                <option value="basic">Grundkenntnisse</option><option value="independent">Selbständig</option><option value="advanced">Fortgeschritten</option><option value="lead">Teamleitung</option><option value="trainer">Trainer/in</option>
                              </select>
                              <label><input type="checkbox" checked={selected.is_preferred} onChange={(event) => updateSkill(String(skill.id), { is_preferred: event.target.checked })} /> Bevorzugter Skill</label>
                              <label><input type="checkbox" checked={selected.can_lead_team} onChange={(event) => updateSkill(String(skill.id), { can_lead_team: event.target.checked })} /> Kann Team führen</label>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Verfügbarkeit" icon={<CalendarDays size={17} />}>
            <div className="opc-form-grid three">
              <Field label="Modell">
                <select value={form.availability.availability_mode} onChange={(event) => setNested('availability', 'availability_mode', event.target.value)}>
                  <option value="weekly_schedule">Wochenplan</option><option value="24_7">24/7 verfügbar</option><option value="on_call">Auf Abruf</option><option value="limited">Eingeschränkt</option><option value="unavailable">Nicht verfügbar</option>
                </select>
              </Field>
              <Field label="Bevorzugte Wochenstunden"><input inputMode="decimal" value={form.availability.preferred_weekly_hours} onChange={(event) => setNested('availability', 'preferred_weekly_hours', event.target.value)} /></Field>
              <Field label="Maximale Wochenstunden"><input inputMode="decimal" value={form.availability.maximum_weekly_hours} onChange={(event) => setNested('availability', 'maximum_weekly_hours', event.target.value)} /></Field>
            </div>
            <div className="opc-toggle-grid">
              <Toggle checked={form.availability.short_notice_available} onChange={(value) => setNested('availability', 'short_notice_available', value)} label="Kurzfristig verfügbar" />
              <Toggle checked={form.availability.weekend_available} onChange={(value) => setNested('availability', 'weekend_available', value)} label="Wochenende möglich" />
              <Toggle checked={form.availability.saturday_available} onChange={(value) => setNested('availability', 'saturday_available', value)} label="Samstag möglich" />
              <Toggle checked={form.availability.sunday_available} onChange={(value) => setNested('availability', 'sunday_available', value)} label="Sonntag möglich" />
              <Toggle checked={form.availability.public_holiday_available} onChange={(value) => setNested('availability', 'public_holiday_available', value)} label="Feiertage möglich" />
              <Toggle checked={form.availability.night_work_available} onChange={(value) => setNested('availability', 'night_work_available', value)} label="Nachtarbeit möglich" />
            </div>

            {form.availability.availability_mode === 'weekly_schedule' ? (
              <div className="opc-day-rules">
                {dayRules.map((rule) => (
                  <div key={rule.day_of_week} className={`opc-day-rule ${rule.enabled ? 'active' : ''}`}>
                    <button type="button" className="opc-day-enable" onClick={() => updateDayRule(rule.day_of_week, { enabled: !rule.enabled })}>
                      <span>{rule.enabled ? <CheckCircle2 size={14} /> : null}</span>
                      <strong>{rule.label}</strong>
                    </button>
                    <input type="time" disabled={!rule.enabled} value={rule.start_time} onChange={(event) => updateDayRule(rule.day_of_week, { start_time: event.target.value })} />
                    <input type="time" disabled={!rule.enabled} value={rule.end_time} onChange={(event) => updateDayRule(rule.day_of_week, { end_time: event.target.value })} />
                    <select disabled={!rule.enabled} value={rule.availability_type} onChange={(event) => updateDayRule(rule.day_of_week, { availability_type: event.target.value as DayRule['availability_type'] })}>
                      <option value="available">Verfügbar</option><option value="preferred">Bevorzugt</option><option value="on_call">Auf Abruf</option>
                    </select>
                  </div>
                ))}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Notfallkontakt und interne Notiz" icon={<HeartHandshake size={17} />}>
            <div className="opc-form-grid three">
              <Field label="Notfallkontakt"><input value={form.emergency_contact.full_name} onChange={(event) => setNested('emergency_contact', 'full_name', event.target.value)} /></Field>
              <Field label="Beziehung"><input value={form.emergency_contact.relationship_label} onChange={(event) => setNested('emergency_contact', 'relationship_label', event.target.value)} placeholder="Ehepartner, Tochter ..." /></Field>
              <Field label="Telefon"><input value={form.emergency_contact.phone_raw} onChange={(event) => setNested('emergency_contact', 'phone_raw', event.target.value)} /></Field>
              <Field label="E-Mail"><input type="email" value={form.emergency_contact.email} onChange={(event) => setNested('emergency_contact', 'email', event.target.value)} /></Field>
            </div>
            <div className="opc-form-grid two">
              <Field label="Notiztyp">
                <select value={form.initial_note_type} onChange={(event) => setRoot('initial_note_type', event.target.value)}>
                  <option value="onboarding">Onboarding</option><option value="general">Allgemein</option><option value="availability">Verfügbarkeit</option><option value="skill">Skill</option><option value="preference">Präferenz</option><option value="restriction">Einschränkung</option><option value="training">Schulung</option><option value="other">Andere</option>
                </select>
              </Field>
              <Field label="Notiztitel"><input value={form.initial_note_title} onChange={(event) => setRoot('initial_note_title', event.target.value)} /></Field>
            </div>
            <Field label="Interne Notiz"><textarea value={form.initial_note} onChange={(event) => setRoot('initial_note', event.target.value)} placeholder="Besondere Fähigkeiten, Präferenzen, Einsatzhinweise oder Einschränkungen." /></Field>
          </SectionCard>

          <SectionCard title="Onboarding-Unterlagen" icon={<FileText size={17} />}>
            <div className="opc-create-document-controls">
              <Field label="Dokumenttyp">
                <select value={pendingDocumentType} onChange={(event) => setPendingDocumentType(event.target.value)}>
                  <option value="identity_document">Identitätsdokument</option>
                  <option value="passport">Pass</option>
                  <option value="permit">Bewilligung</option>
                  <option value="bank_document">Bankbeleg</option>
                  <option value="ahv_document">AHV-Dokument</option>
                  <option value="family_allowance_document">Familienzulagen</option>
                  <option value="medical_certificate">Arztzeugnis</option>
                  <option value="other">Andere Datei</option>
                  {role === 'owner' ? (
                    <>
                      <option value="employment_contract">Arbeitsvertrag</option>
                      <option value="contract_addendum">Vertragsnachtrag</option>
                      <option value="tax_document">Steuerdokument</option>
                      <option value="insurance_document">Versicherungsdokument</option>
                    </>
                  ) : null}
                </select>
              </Field>

              <Field label="Dokumenttitel">
                <input
                  value={pendingDocumentTitle}
                  onChange={(event) => setPendingDocumentTitle(event.target.value)}
                  placeholder="Optional – sonst Dateiname"
                />
              </Field>

              <Field label="Gültig bis">
                <input
                  type="date"
                  value={pendingDocumentValidUntil}
                  onChange={(event) => setPendingDocumentValidUntil(event.target.value)}
                />
              </Field>

              <label className="opc-create-file-button">
                <Upload size={16} />
                Dateien auswählen
                <input type="file" multiple onChange={handlePendingDocuments} />
              </label>
            </div>

            <div className="opc-create-document-hint">
              Alle Dateitypen sind möglich. Pro Datei maximal 50 MB. Verträge und sensible Payroll-Dokumente bleiben Owner-only.
            </div>

            {pendingDocuments.length ? (
              <div className="opc-create-document-list">
                {pendingDocuments.map((document) => (
                  <div key={document.id}>
                    <span><FileText size={16} /></span>
                    <div>
                      <strong>{document.title || document.file.name}</strong>
                      <small>{document.file.name} · {(document.file.size / 1024 / 1024).toFixed(2)} MB</small>
                    </div>
                    <button type="button" onClick={() => removePendingDocument(document.id)} aria-label="Datei entfernen">
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="opc-create-document-empty">Noch keine Dateien ausgewählt.</div>
            )}
          </SectionCard>

          <div className="opc-create-bottom-actions" style={cardStyle}>
            <a className="opc-create-save light" href={`${baseUrl}/mitarbeiter`}>Abbrechen</a>
            <button type="button" className="opc-create-save" disabled={saving} onClick={() => void handleSave()}>
              {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
              {saving ? 'Speichert...' : 'Mitarbeiter erstellen'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .opc-employee-create-page { padding: 0 0 140px; }
        .opc-employee-create-page * { box-sizing: border-box; }
        .opc-employee-create-loading { min-height: 60vh; display: flex; align-items: center; justify-content: center; gap: 9px; color: ${BRAND.muted}; font-size: 14px; font-weight: 680; }
        .opc-back-link { display: inline-flex; align-items: center; height: 38px; padding: 0 14px; margin-bottom: 14px; border: 1px solid ${BRAND.border}; border-radius: 999px; color: ${BRAND.text}; text-decoration: none; font-size: 13px; font-weight: 760; background: #FFFFFF; }
        .opc-create-error, .opc-create-message { border-radius: 16px; padding: 14px 16px; font-size: 13px; font-weight: 720; margin-bottom: 14px; }
        .opc-create-error { border: 1px solid #FECACA; background: #FEF2F2; color: ${BRAND.red}; }
        .opc-create-message { border: 1px solid #A7F3D0; background: #ECFDF5; color: #047857; }
        .opc-create-hero { position: relative; padding: 24px; margin-bottom: 14px; }
        .opc-create-status-dot { position: absolute; top: 20px; right: 20px; width: 42px; height: 42px; border-radius: 999px; border: 1px solid #FDE68A; background: #FEF3C7; display: flex; align-items: center; justify-content: center; }
        .opc-create-status-dot span { width: 18px; height: 18px; border-radius: 999px; background: #F59E0B; }
        .opc-create-eyebrow { color: ${BRAND.muted}; font-size: 12px; font-weight: 760; margin-bottom: 6px; }
        .opc-create-hero h1 { margin: 0; padding-right: 56px; color: ${BRAND.text}; font-size: 29px; line-height: 1.05; letter-spacing: -0.045em; font-weight: 860; }
        .opc-create-hero-meta { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-top: 9px; color: ${BRAND.muted}; font-size: 13px; font-weight: 720; }
        .opc-create-metrics-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
        .opc-create-metric-card { min-height: 74px; padding: 16px 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #FFFFFF; border: 1px solid ${BRAND.border}; border-radius: 18px; box-shadow: 0 1px 2px rgba(15,23,42,0.04); }
        .opc-create-metric-value { font-size: 22px; line-height: 1.05; font-weight: 860; letter-spacing: -0.035em; color: ${BRAND.text}; }
        .opc-create-metric-label { margin-top: 5px; font-size: 12px; font-weight: 820; color: ${BRAND.muted}; }
        .opc-create-metric-icon { width: 36px; height: 36px; border: 1px solid ${BRAND.border}; border-radius: 13px; display: flex; align-items: center; justify-content: center; color: ${BRAND.black}; background: ${BRAND.soft}; flex-shrink: 0; }
        .opc-create-main { display: grid; gap: 14px; }
        .opc-employee-plan-card { padding: 18px; }
        .opc-employee-plan-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
        .opc-employee-plan-card-header h2 { margin: 0; color: ${BRAND.text}; font-size: 17px; letter-spacing: -0.025em; font-weight: 850; }
        .opc-employee-plan-card-icon { width: 34px; height: 34px; border-radius: 12px; border: 1px solid ${BRAND.border}; background: ${BRAND.soft}; display: flex; align-items: center; justify-content: center; color: ${BRAND.black}; }
        .opc-form-grid { display: grid; gap: 12px; margin-bottom: 12px; }
        .opc-form-grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .opc-form-grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .opc-employee-field { display: grid; gap: 6px; color: ${BRAND.muted}; font-size: 12px; font-weight: 780; min-width: 0; margin-bottom: 12px; }
        .opc-employee-field > span { color: ${BRAND.muted}; }
        .opc-employee-field small { color: ${BRAND.faint}; font-size: 11px; font-weight: 650; }
        .opc-employee-field input, .opc-employee-field select, .opc-employee-field textarea, .opc-day-rule input, .opc-day-rule select, .opc-skill-options select { width: 100%; min-width: 0; min-height: 44px; border: 1px solid ${BRAND.border}; border-radius: 14px; padding: 10px 12px; background: #FFFFFF; color: ${BRAND.text}; outline: 0; font-family: ${pageFont}; font-size: 13px; font-weight: 700; }
        .opc-employee-field textarea { min-height: 100px; resize: vertical; }
        .opc-toggle-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; margin: 4px 0 14px; }
        .opc-toggle-grid.one { grid-template-columns: 1fr; }
        .opc-toggle-row { width: 100%; min-height: 48px; border: 1px solid ${BRAND.border}; border-radius: 14px; padding: 8px 10px; background: #FFFFFF; display: flex; align-items: center; gap: 9px; text-align: left; color: ${BRAND.text}; font-family: ${pageFont}; cursor: pointer; }
        .opc-toggle-row.active { border-color: #D1D5DB; background: ${BRAND.soft}; }
        .opc-toggle-box { width: 18px; height: 18px; border: 2px solid ${BRAND.text}; border-radius: 999px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .opc-toggle-row.active .opc-toggle-box { background: ${BRAND.black}; border-color: ${BRAND.black}; color: #FFFFFF; }
        .opc-toggle-row strong { display: block; font-size: 13px; font-weight: 820; }
        .opc-toggle-row small { display: block; margin-top: 3px; color: ${BRAND.muted}; font-size: 11px; font-weight: 650; }
        .opc-skill-groups { display: grid; gap: 18px; }
        .opc-skill-group h3 { margin: 0 0 9px; color: ${BRAND.muted}; font-size: 12px; font-weight: 850; text-transform: capitalize; }
        .opc-skill-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
        .opc-skill-item { border: 0; border-radius: 12px; background: transparent; overflow: hidden; }
        .opc-skill-item.active { background: ${BRAND.soft}; box-shadow: inset 0 0 0 1px ${BRAND.border}; }
        .opc-skill-select { width: 100%; min-height: 36px; border: 0; background: transparent; display: flex; align-items: center; gap: 9px; padding: 5px 7px; text-align: left; font-family: ${pageFont}; color: ${BRAND.text}; cursor: pointer; }
        .opc-skill-select span { width: 18px; height: 18px; border: 2px solid ${BRAND.text}; border-radius: 999px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .opc-skill-item.active .opc-skill-select span { background: ${BRAND.black}; border-color: ${BRAND.black}; color: #FFFFFF; }
        .opc-skill-select strong { font-size: 12px; line-height: 1.3; font-weight: 790; }
        .opc-skill-options { padding: 4px 8px 9px 34px; display: grid; gap: 7px; }
        .opc-skill-options label { color: ${BRAND.muted}; font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 7px; }
        .opc-day-rules { display: grid; gap: 8px; margin-top: 14px; }
        .opc-day-rule { display: grid; grid-template-columns: minmax(140px, 1.2fr) repeat(2, minmax(100px, .75fr)) minmax(120px, 1fr); gap: 8px; align-items: center; padding: 9px; border: 1px solid ${BRAND.border}; border-radius: 15px; background: #FFFFFF; }
        .opc-day-rule.active { background: ${BRAND.soft}; }
        .opc-day-enable { min-height: 42px; border: 0; background: transparent; color: ${BRAND.text}; display: flex; align-items: center; gap: 9px; text-align: left; font-family: ${pageFont}; cursor: pointer; }
        .opc-day-enable span { width: 18px; height: 18px; border: 2px solid ${BRAND.text}; border-radius: 999px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .opc-day-rule.active .opc-day-enable span { background: ${BRAND.black}; border-color: ${BRAND.black}; color: #FFFFFF; }
        .opc-day-enable strong { font-size: 12px; font-weight: 800; }
        .opc-skill-options input[type="checkbox"] {
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
        .opc-skill-options input[type="checkbox"]:checked {
          background: ${BRAND.black};
          box-shadow: inset 0 0 0 3px #FFFFFF;
        }
        .opc-create-document-controls { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr) minmax(150px,.7fr) auto; gap: 10px; align-items: end; }
        .opc-create-document-controls .opc-employee-field { margin-bottom: 0; }
        .opc-create-file-button { min-height: 44px; border: 1px solid ${BRAND.black}; border-radius: 14px; background: ${BRAND.black}; color: #FFFFFF; padding: 0 14px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-size: 12px; font-weight: 820; cursor: pointer; white-space: nowrap; }
        .opc-create-file-button input { display: none; }
        .opc-create-document-hint { margin-top: 9px; color: ${BRAND.muted}; font-size: 11px; line-height: 1.45; font-weight: 650; }
        .opc-create-document-list { display: grid; gap: 8px; margin-top: 12px; }
        .opc-create-document-list > div { display: grid; grid-template-columns: 34px minmax(0,1fr) 34px; gap: 9px; align-items: center; padding: 9px 10px; border: 1px solid ${BRAND.border}; border-radius: 13px; background: #FFFFFF; }
        .opc-create-document-list > div > span { width: 34px; height: 34px; border-radius: 10px; background: ${BRAND.soft}; display: flex; align-items: center; justify-content: center; }
        .opc-create-document-list strong { display: block; font-size: 12px; overflow-wrap: anywhere; }
        .opc-create-document-list small { display: block; margin-top: 3px; color: ${BRAND.muted}; font-size: 10px; }
        .opc-create-document-list button { width: 32px; height: 32px; border: 1px solid ${BRAND.border}; border-radius: 10px; background: #FFFFFF; color: ${BRAND.text}; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .opc-create-document-empty { min-height: 64px; margin-top: 12px; border: 1px dashed ${BRAND.border}; border-radius: 13px; display: flex; align-items: center; justify-content: center; color: ${BRAND.muted}; font-size: 11px; font-weight: 650; }
        .opc-create-expandable { padding: 0; overflow: hidden; }
        .opc-create-expandable summary { min-height: 60px; padding: 0 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; cursor: pointer; list-style: none; }
        .opc-create-expandable summary span { display: flex; align-items: center; gap: 9px; color: ${BRAND.text}; font-size: 14px; font-weight: 820; }
        .opc-create-expandable summary strong { color: ${BRAND.muted}; font-size: 11px; }
        .opc-create-expandable p { margin: 0; padding: 0 18px 18px; color: ${BRAND.muted}; font-size: 13px; line-height: 1.55; font-weight: 650; }
        .opc-create-bottom-actions { padding: 14px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .opc-create-save { min-height: 46px; border-radius: 14px; border: 1px solid ${BRAND.black}; background: ${BRAND.black}; color: #FFFFFF; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 14px; font-family: ${pageFont}; font-size: 13px; font-weight: 820; text-decoration: none; cursor: pointer; }
        .opc-create-save.light { background: #FFFFFF; border-color: ${BRAND.border}; color: ${BRAND.text}; }
        .opc-create-save:disabled { opacity: .6; cursor: wait; }
        .spin { animation: opcCreateSpin .8s linear infinite; }
        @keyframes opcCreateSpin { to { transform: rotate(360deg); } }
        @media (min-width: 1180px) { .opc-create-metrics-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
        @media (max-width: 900px) { .opc-form-grid.three { grid-template-columns: repeat(2, minmax(0, 1fr)); } .opc-day-rule { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 720px) {
          .opc-employee-create-page { padding-bottom: 118px; overflow-x: hidden; }
          .opc-create-hero { padding: 15px; margin-bottom: 10px; }
          .opc-create-status-dot { width: 34px; height: 34px; top: 14px; right: 14px; }
          .opc-create-status-dot span { width: 14px; height: 14px; }
          .opc-create-hero h1 { font-size: 22px; padding-right: 44px; }
          .opc-create-hero-meta { font-size: 11px; gap: 5px 9px; }
          .opc-create-metrics-grid { gap: 8px; margin-bottom: 12px; }
          .opc-create-metric-card { min-height: 66px; padding: 11px 12px; border-radius: 15px; }
          .opc-create-metric-value { font-size: 18px; }
          .opc-create-metric-label { font-size: 10px; }
          .opc-create-metric-icon { width: 31px; height: 31px; border-radius: 10px; }
          .opc-create-main { gap: 10px; }
          .opc-employee-plan-card { padding: 12px; border-radius: 16px !important; }
          .opc-employee-plan-card-header { margin-bottom: 12px; }
          .opc-employee-plan-card-header h2 { font-size: 15px; }
          .opc-employee-plan-card-icon { width: 30px; height: 30px; }
          .opc-form-grid { gap: 8px; margin-bottom: 8px; }
          .opc-form-grid.two, .opc-form-grid.three { grid-template-columns: 1fr; }
          .opc-employee-field { margin-bottom: 8px; gap: 5px; font-size: 11px; }
          .opc-employee-field input, .opc-employee-field select, .opc-employee-field textarea, .opc-day-rule input, .opc-day-rule select, .opc-skill-options select { min-height: 42px; }
          .opc-toggle-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
          .opc-toggle-row { min-height: 44px; padding: 7px 8px; }
          .opc-toggle-row strong { font-size: 11px; }
          .opc-toggle-row small { display: none; }
          .opc-skill-groups { gap: 13px; }
          .opc-skill-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px 8px; }
          .opc-skill-select strong { font-size: 11px; }
          .opc-skill-options { padding-left: 32px; }
          .opc-day-rule { grid-template-columns: minmax(90px, 1fr) 1fr 1fr; gap: 6px; padding: 7px; }
          .opc-day-enable { grid-column: auto; min-height: 40px; }
          .opc-day-rule select { grid-column: 1 / -1; }
          .opc-create-document-controls { grid-template-columns: 1fr; gap: 7px; }
          .opc-create-file-button { width: 100%; }
          .opc-create-bottom-actions { position: sticky; bottom: 76px; z-index: 4; padding: 10px; gap: 8px; border-radius: 16px !important; background: rgba(255,255,255,.97) !important; backdrop-filter: blur(10px); }
          .opc-create-save { min-height: 44px; font-size: 12px; padding: 0 10px; }
        }

        @media (max-width: 460px) {
          .opc-toggle-grid,
          .opc-skill-grid {
            grid-template-columns: 1fr;
          }

          .opc-day-rule {
            grid-template-columns: 1fr 1fr;
          }

          .opc-day-enable {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </MirakaDashboardShell>
  );
}
