import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Clock3,
  KeyRound,
  Loader2,
  MapPin,
  Save,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import { removeOpcPageCache } from '../lib/opc-page-cache';

type JsonRow = Record<string, any>;
type TabKey =
  | 'employee'
  | 'address'
  | 'permit'
  | 'bank'
  | 'qualification'
  | 'availability'
  | 'skills'
  | 'emergency'
  | 'notes'
  | 'portal';

type DetailPayload = {
  success: boolean;
  role?: 'owner' | 'admin';
  detail?: JsonRow;
  error?: string;
};

type EmployeeAdminControlProps = {
  employeeId: string;
  onSaved?: () => void;
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

function safeObject(value: unknown): JsonRow {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as JsonRow) } : {};
}

function asArray(value: unknown): JsonRow[] {
  return Array.isArray(value) ? (value as JsonRow[]) : [];
}

function bool(value: unknown) {
  return value === true;
}

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Keine aktive Sitzung gefunden.');
  return token;
}

async function apiGet<T>(path: string): Promise<T> {
  const token = await accessToken();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const payload = (await response.json().catch(() => ({}))) as any;
  if (!response.ok) throw new Error(payload?.error || 'Daten konnten nicht geladen werden.');
  return payload as T;
}

async function apiPatch(path: string, body: unknown) {
  const token = await accessToken();
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as any;
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || 'Änderung konnte nicht gespeichert werden.');
  }
  return payload;
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`opc-admin-field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</label>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button type="button" className={`opc-admin-toggle ${checked ? 'active' : ''}`} onClick={() => onChange(!checked)}>
      <span>{checked ? <CheckCircle2 size={13} /> : null}</span>
      {label}
    </button>
  );
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
  const staff = safeObject(detail?.staff_role);

  return {
    employee: {
      legal_first_name: employee.legal_first_name || '',
      legal_last_name: employee.legal_last_name || '',
      preferred_name: employee.preferred_name || '',
      date_of_birth: employee.date_of_birth || '',
      gender_code: employee.gender_code || '',
      civil_status: employee.civil_status || '',
      birth_place: employee.birth_place || '',
      citizenship_place: employee.citizenship_place || '',
      ahv_number: employee.ahv_number || '',
      private_email: employee.private_email || '',
      business_email: employee.business_email || '',
      phone_raw: employee.phone_raw || employee.phone_e164 || '',
      fax_number: employee.fax_number || '',
      preferred_language: employee.preferred_language || 'de-CH',
      status: employee.status || 'onboarding',
      assignment_status: employee.assignment_status || 'available',
      profile_completion_status: employee.profile_completion_status || 'incomplete',
      personnel_type: employee.personnel_type || 'employee',
      payroll_in_scope: employee.payroll_in_scope !== false,
      portal_access_only: employee.portal_access_only === true,
      payroll_exclusion_reason: employee.payroll_exclusion_reason || '',
      employing_entity_id: employee.employing_entity_id || '',
      operational_position_id: detail?.operational_position?.id || '',
      entry_date: employee.entry_date || '',
      exit_date: employee.exit_date || '',
      us_tax_person: employee.us_tax_person === true,
      internal_notes: employee.internal_notes || '',
    },
    address: {
      street: address.street || '',
      house_number: address.house_number || '',
      address_addition: address.address_addition || '',
      postal_code: address.postal_code || '',
      city: address.city || '',
      canton_code: address.canton_code || '',
      municipality: address.municipality || '',
      state_region: address.state_region || '',
      country_code: address.country_code || 'CH',
      tax_relevant: address.tax_relevant !== false,
    },
    nationality: { country_code: nationality.country_code || '' },
    permit: {
      id: permit.id || '',
      permit_type: permit.permit_type || '',
      permit_number: permit.permit_number || '',
      permit_status: permit.permit_status || 'valid',
      issuing_country_code: permit.issuing_country_code || 'CH',
      issuing_canton_code: permit.issuing_canton_code || '',
      is_cross_border_permit: permit.is_cross_border_permit === true,
      valid_from: permit.valid_from || '',
      valid_until: permit.valid_until || '',
      verification_status: permit.verification_status || 'unverified',
      notes: permit.notes || '',
    },
    bank: {
      bank_name: bank.bank_name || '',
      bank_address_line1: bank.bank_address_line1 || '',
      bank_address_line2: bank.bank_address_line2 || '',
      bank_postal_code: bank.bank_postal_code || '',
      bank_city: bank.bank_city || '',
      bank_country_code: bank.bank_country_code || 'CH',
      iban: bank.iban || '',
      bic: bank.bic || '',
      account_holder: bank.account_holder || '',
      currency_code: bank.currency_code || 'CHF',
      verification_status: bank.verification_status || 'unverified',
      notes: bank.notes || '',
    },
    qualification: {
      qualification_level_code: qualification.qualification_level_code || 'none',
      qualification_title: qualification.qualification_title || 'Keine formelle Ausbildung',
      field_of_study: qualification.field_of_study || '',
      occupation_code: qualification.occupation_code || '',
      institution_name: qualification.institution_name || '',
      country_code: qualification.country_code || '',
      completed_on: qualification.completed_on || '',
      valid_until: qualification.valid_until || '',
      swiss_recognition_status: qualification.swiss_recognition_status || 'not_required',
      recognition_authority: qualification.recognition_authority || '',
      recognition_reference: qualification.recognition_reference || '',
      relevant_for_cleaning_gav: qualification.relevant_for_cleaning_gav === true,
      relevant_for_current_position: qualification.relevant_for_current_position !== false,
      verification_status: qualification.verification_status || 'unverified',
      notes: qualification.notes || '',
    },
    availability: {
      availability_mode: availability.availability_mode || 'weekly_schedule',
      timezone: availability.timezone || 'Europe/Zurich',
      short_notice_available: availability.short_notice_available === true,
      minimum_notice_hours: availability.minimum_notice_hours ?? '',
      weekend_available: availability.weekend_available === true,
      saturday_available: availability.saturday_available === true,
      sunday_available: availability.sunday_available === true,
      public_holiday_available: availability.public_holiday_available === true,
      night_work_available: availability.night_work_available === true,
      preferred_weekly_hours: availability.preferred_weekly_hours ?? '',
      maximum_weekly_hours: availability.maximum_weekly_hours ?? '',
      notes: availability.notes || '',
    },
    emergency: {
      full_name: emergency.full_name || '',
      relationship_label: emergency.relationship_label || '',
      phone_raw: emergency.phone_raw || emergency.phone_e164 || '',
      email: emergency.email || '',
      preferred_language: emergency.preferred_language || 'de-CH',
      notes: emergency.notes || '',
    },
    portal: {
      role: staff.role || 'employee',
      status: staff.status || 'active',
      can_access_portal: staff.can_access_portal !== false,
      can_submit_time_logs: staff.can_submit_time_logs !== false,
      can_view_all_jobs: bool(staff.can_view_all_jobs),
      can_manage_jobs: bool(staff.can_manage_jobs),
      can_manage_employees: bool(staff.can_manage_employees),
      can_manage_reports: bool(staff.can_manage_reports),
      can_manage_finance: bool(staff.can_manage_finance),
    },
  };
}

function makeRules(detail: JsonRow | null) {
  const rows = asArray(detail?.availability_rules);
  return Array.from({ length: 7 }, (_, index) => {
    const day = index + 1;
    const existing = rows.find((row) => Number(row.day_of_week) === day && row.is_active !== false);
    return {
      day_of_week: day,
      enabled: Boolean(existing),
      start_time: String(existing?.start_time || '08:00').slice(0, 5),
      end_time: String(existing?.end_time || '17:00').slice(0, 5),
      availability_type: existing?.availability_type || 'available',
    };
  });
}

function makeSkills(detail: JsonRow | null) {
  const selected = new Map(asArray(detail?.skills).map((row) => [String(row.skill_id), row]));
  return asArray(detail?.skill_catalog).map((catalog) => {
    const row = selected.get(String(catalog.id));
    return {
      catalog,
      selected: Boolean(row && row.is_active !== false),
      proficiency_level: row?.proficiency_level || 'independent',
      is_preferred: row?.is_preferred === true,
      can_work_independently: row?.can_work_independently !== false,
      can_lead_team: row?.can_lead_team === true,
      years_experience: row?.years_experience ?? '',
    };
  });
}

export default function EmployeeAdminControl({ employeeId, onSaved }: EmployeeAdminControlProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>('employee');
  const [detail, setDetail] = useState<JsonRow | null>(null);
  const [role, setRole] = useState<'owner' | 'admin' | ''>('');
  const [draft, setDraft] = useState<JsonRow>(() => makeDraft(null));
  const [rules, setRules] = useState<JsonRow[]>(() => makeRules(null));
  const [skills, setSkills] = useState<JsonRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [noteVisibility, setNoteVisibility] = useState('hr_admins');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load(showLoader = true) {
    if (!employeeId) return;
    if (showLoader) setLoading(true);
    setError('');
    try {
      const [payload, accessPayload] = await Promise.all([
        apiGet<DetailPayload>(`/api/opc/employees/${employeeId}`),
        apiGet<any>(`/api/opc/employees/${employeeId}/admin-profile`),
      ]);
      const next = payload.detail ? { ...payload.detail, staff_role: accessPayload?.staff_role || payload.detail.staff_role || null } : null;
      setDetail(next);
      setRole(payload.role || accessPayload?.role || '');
      setDraft(makeDraft(next));
      setRules(makeRules(next));
      setSkills(makeSkills(next));
    } catch (reason: any) {
      setError(reason?.message || 'Mitarbeiterdaten konnten nicht geladen werden.');
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  useEffect(() => {
    if (open && !detail) void load(true);
  }, [open]);

  const tabs = useMemo(() => {
    const base: Array<{ key: TabKey; label: string; icon: ReactNode }> = [
      { key: 'employee', label: 'Stammdaten', icon: <UserRound size={15} /> },
      { key: 'address', label: 'Kontakt & Adresse', icon: <MapPin size={15} /> },
      { key: 'permit', label: 'Nationalität & Bewilligung', icon: <ShieldCheck size={15} /> },
      { key: 'bank', label: 'Bank', icon: <Banknote size={15} /> },
      { key: 'qualification', label: 'Qualifikation', icon: <BadgeCheck size={15} /> },
      { key: 'availability', label: 'Verfügbarkeit', icon: <Clock3 size={15} /> },
      { key: 'skills', label: 'Skills', icon: <BriefcaseBusiness size={15} /> },
      { key: 'emergency', label: 'Notfallkontakt', icon: <UsersRound size={15} /> },
      { key: 'notes', label: 'Notizen', icon: <Building2 size={15} /> },
    ];
    if (role === 'owner') base.push({ key: 'portal', label: 'Portal & Rechte', icon: <KeyRound size={15} /> });
    return base;
  }, [role]);

  function update(group: string, key: string, value: any) {
    setDraft((current) => ({ ...current, [group]: { ...safeObject(current[group]), [key]: value } }));
  }

  function updateRule(day: number, patch: JsonRow) {
    setRules((current) => current.map((rule) => Number(rule.day_of_week) === day ? { ...rule, ...patch } : rule));
  }

  async function save(section: string, data: JsonRow, success: string) {
    if (saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiPatch(`/api/opc/employees/${employeeId}/admin-profile`, { section, data });
      removeOpcPageCache('opc:page-cache:employees:summary:v1');
      await load(false);
      setMessage(success);
      onSaved?.();
    } catch (reason: any) {
      setError(reason?.message || 'Änderung konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  async function removeSection(section: string, success: string) {
    if (!window.confirm('Bist du sicher?')) return;
    await save(section, { clear: true }, success);
  }

  const employee = safeObject(draft.employee);
  const address = safeObject(draft.address);
  const nationality = safeObject(draft.nationality);
  const permit = safeObject(draft.permit);
  const bank = safeObject(draft.bank);
  const qualification = safeObject(draft.qualification);
  const availability = safeObject(draft.availability);
  const emergency = safeObject(draft.emergency);
  const portal = safeObject(draft.portal);

  return (
    <div className="opc-admin-control">
      <div className="opc-admin-control-bar">
        <div>
          <strong>HR & Berechtigungen</strong>
          <span>Gezielte Bearbeitung ohne Nebenwirkungen auf andere Mitarbeiterdaten.</span>
        </div>
        <button type="button" className="opc-admin-open" onClick={() => setOpen((value) => !value)}>
          {open ? <X size={15} /> : <ShieldCheck size={15} />}
          {open ? 'Schliessen' : 'Mitarbeiter bearbeiten'}
        </button>
      </div>

      {open ? (
        <div className="opc-admin-panel">
          {loading ? <div className="opc-admin-loading"><Loader2 className="spin" size={17} /> Daten werden geladen...</div> : null}
          {error ? <div className="opc-admin-alert error">{error}</div> : null}
          {message ? <div className="opc-admin-alert success">{message}</div> : null}

          {!loading && detail ? (
            <>
              <div className="opc-admin-tabs">
                {tabs.map((item) => (
                  <button key={item.key} type="button" className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}>
                    {item.icon}{item.label}
                  </button>
                ))}
              </div>

              {tab === 'employee' ? (
                <section className="opc-admin-section">
                  <div className="opc-admin-section-head"><div><h3>Stammdaten und Organisation</h3><p>Personalien, Organisation und Beschäftigungsstatus.</p></div></div>
                  <div className="opc-admin-grid">
                    <Field label="Vorname"><input value={employee.legal_first_name} onChange={(e) => update('employee','legal_first_name',e.target.value)} /></Field>
                    <Field label="Nachname"><input value={employee.legal_last_name} onChange={(e) => update('employee','legal_last_name',e.target.value)} /></Field>
                    <Field label="Bevorzugter Name"><input value={employee.preferred_name} onChange={(e) => update('employee','preferred_name',e.target.value)} /></Field>
                    <Field label="Geburtsdatum"><input type="date" value={employee.date_of_birth} onChange={(e) => update('employee','date_of_birth',e.target.value)} /></Field>
                    <Field label="Geschlecht"><select value={employee.gender_code} onChange={(e) => update('employee','gender_code',e.target.value)}><option value="">Nicht angegeben</option><option value="female">Weiblich</option><option value="male">Männlich</option><option value="diverse">Divers</option><option value="unknown">Nicht angegeben</option></select></Field>
                    <Field label="Zivilstand"><select value={employee.civil_status} onChange={(e) => update('employee','civil_status',e.target.value)}><option value="">Nicht angegeben</option><option value="single">Ledig</option><option value="married">Verheiratet</option><option value="registered_partnership">Eingetragene Partnerschaft</option><option value="divorced">Geschieden</option><option value="widowed">Verwitwet</option><option value="separated">Getrennt</option><option value="unknown">Unbekannt</option></select></Field>
                    <Field label="Geburtsort"><input value={employee.birth_place} onChange={(e) => update('employee','birth_place',e.target.value)} /></Field>
                    <Field label="Bürger-/Heimatort"><input value={employee.citizenship_place} onChange={(e) => update('employee','citizenship_place',e.target.value)} /></Field>
                    <Field label="AHV-Nummer"><input value={employee.ahv_number} onChange={(e) => update('employee','ahv_number',e.target.value)} /></Field>
                    <Field label="Bevorzugte Sprache"><input value={employee.preferred_language} onChange={(e) => update('employee','preferred_language',e.target.value)} /></Field>
                    <Field label="Rechtsträger"><select value={employee.employing_entity_id} onChange={(e) => update('employee','employing_entity_id',e.target.value)}><option value="">Kein Rechtsträger</option>{asArray(detail.entities).map((row) => <option key={row.id} value={row.id}>{row.legal_name}</option>)}</select></Field>
                    <Field label="Position"><select value={employee.operational_position_id} onChange={(e) => update('employee','operational_position_id',e.target.value)}><option value="">Keine Position</option>{asArray(detail.positions).map((row) => <option key={row.id} value={row.id}>{row.title_de}</option>)}</select></Field>
                    <Field label="Personentyp"><select value={employee.personnel_type} onChange={(e) => update('employee','personnel_type',e.target.value)}><option value="employee">Mitarbeiter/in</option><option value="owner_employee">Inhaber/in mit Anstellung</option><option value="external_contractor">Externe Fachkraft</option><option value="external_infrastructure">Externe Infrastruktur</option><option value="agency_worker">Temporär über Agentur</option><option value="temporary_external">Temporäre externe Kraft</option><option value="intern">Praktikum</option><option value="apprentice">Lernende/r</option><option value="other">Andere</option></select></Field>
                    <Field label="Status"><select value={employee.status} onChange={(e) => update('employee','status',e.target.value)}><option value="onboarding">Onboarding</option><option value="active">Aktiv</option><option value="inactive">Inaktiv</option><option value="suspended">Gesperrt</option><option value="terminated">Ausgetreten</option><option value="archived">Archiviert</option></select></Field>
                    <Field label="Einsatzstatus"><select value={employee.assignment_status} onChange={(e) => update('employee','assignment_status',e.target.value)}><option value="available">Verfügbar</option><option value="limited">Eingeschränkt</option><option value="unavailable">Nicht verfügbar</option><option value="on_leave">Abwesend</option><option value="inactive">Inaktiv</option></select></Field>
                    <Field label="Personalakte"><select value={employee.profile_completion_status} onChange={(e) => update('employee','profile_completion_status',e.target.value)}><option value="incomplete">Unvollständig</option><option value="in_review">In Prüfung</option><option value="complete">Vollständig</option><option value="update_required">Aktualisierung nötig</option></select></Field>
                    <Field label="Eintritt"><input type="date" value={employee.entry_date} onChange={(e) => update('employee','entry_date',e.target.value)} /></Field>
                    <Field label="Austritt"><input type="date" value={employee.exit_date} onChange={(e) => update('employee','exit_date',e.target.value)} /></Field>
                  </div>
                  <div className="opc-admin-toggle-grid">
                    <Toggle checked={employee.payroll_in_scope === true} onChange={(v) => update('employee','payroll_in_scope',v)} label="In Payroll berücksichtigen" />
                    <Toggle checked={employee.portal_access_only === true} onChange={(v) => update('employee','portal_access_only',v)} label="Nur Portalzugang" />
                    <Toggle checked={employee.us_tax_person === true} onChange={(v) => update('employee','us_tax_person',v)} label="US-Steuerperson" />
                  </div>
                  <Field label="Payroll-Ausschlussgrund" wide><input value={employee.payroll_exclusion_reason} onChange={(e) => update('employee','payroll_exclusion_reason',e.target.value)} /></Field>
                  <Field label="Interne Hinweise" wide><textarea value={employee.internal_notes} onChange={(e) => update('employee','internal_notes',e.target.value)} /></Field>
                  <div className="opc-admin-actions"><button disabled={saving} onClick={() => void save('employee', employee, 'Stammdaten wurden gespeichert.')}><Save size={14} />Speichern</button></div>
                </section>
              ) : null}

              {tab === 'address' ? (
                <section className="opc-admin-section">
                  <div className="opc-admin-section-head"><div><h3>Kontakt und Adresse</h3><p>Änderungen an der Wohnadresse werden sauber historisiert.</p></div></div>
                  <div className="opc-admin-grid">
                    <Field label="Private E-Mail"><input type="email" value={employee.private_email} onChange={(e) => update('employee','private_email',e.target.value)} /></Field>
                    <Field label="Geschäftliche E-Mail"><input type="email" value={employee.business_email} onChange={(e) => update('employee','business_email',e.target.value)} /></Field>
                    <Field label="Telefon"><input value={employee.phone_raw} onChange={(e) => update('employee','phone_raw',e.target.value)} /></Field>
                    <Field label="Fax"><input value={employee.fax_number} onChange={(e) => update('employee','fax_number',e.target.value)} /></Field>
                    <Field label="Strasse"><input value={address.street} onChange={(e) => update('address','street',e.target.value)} /></Field>
                    <Field label="Hausnummer"><input value={address.house_number} onChange={(e) => update('address','house_number',e.target.value)} /></Field>
                    <Field label="Adresszusatz"><input value={address.address_addition} onChange={(e) => update('address','address_addition',e.target.value)} /></Field>
                    <Field label="PLZ"><input value={address.postal_code} onChange={(e) => update('address','postal_code',e.target.value)} /></Field>
                    <Field label="Ort"><input value={address.city} onChange={(e) => update('address','city',e.target.value)} /></Field>
                    <Field label="Gemeinde"><input value={address.municipality} onChange={(e) => update('address','municipality',e.target.value)} /></Field>
                    <Field label="Kanton"><input maxLength={2} value={address.canton_code} onChange={(e) => update('address','canton_code',e.target.value.toUpperCase())} /></Field>
                    <Field label="Region"><input value={address.state_region} onChange={(e) => update('address','state_region',e.target.value)} /></Field>
                    <Field label="Land"><input maxLength={2} value={address.country_code} onChange={(e) => update('address','country_code',e.target.value.toUpperCase())} /></Field>
                  </div>
                  <div className="opc-admin-toggle-grid"><Toggle checked={address.tax_relevant !== false} onChange={(v) => update('address','tax_relevant',v)} label="Steuerrelevante Hauptadresse" /></div>
                  <div className="opc-admin-actions split"><button className="danger" onClick={() => void removeSection('address','Adresse wurde entfernt.')}>Adresse entfernen</button><button disabled={saving} onClick={() => void (async () => { await save('employee', { private_email: employee.private_email, business_email: employee.business_email, phone_raw: employee.phone_raw, fax_number: employee.fax_number }, 'Kontaktdaten wurden gespeichert.'); await save('address', address, 'Adresse wurde gespeichert.'); })()}><Save size={14} />Speichern</button></div>
                </section>
              ) : null}

              {tab === 'permit' ? (
                <section className="opc-admin-section">
                  <div className="opc-admin-section-head"><div><h3>Nationalität und Bewilligung</h3><p>Die aktuelle Bewilligung wird aktualisiert statt bei jedem Speichern dupliziert.</p></div></div>
                  <div className="opc-admin-grid">
                    <Field label="Nationalität (ISO-2)"><input maxLength={2} value={nationality.country_code} onChange={(e) => update('nationality','country_code',e.target.value.toUpperCase())} /></Field>
                    <Field label="Bewilligung"><select value={permit.permit_type} onChange={(e) => update('permit','permit_type',e.target.value)}><option value="">Nicht erfasst</option><option value="swiss_citizen">Schweizer Bürger/in</option><option value="b">B</option><option value="c">C</option><option value="l">L</option><option value="g">G</option><option value="s">S</option><option value="not_required">Nicht erforderlich</option><option value="pending">Ausstehend</option><option value="other">Andere</option></select></Field>
                    <Field label="Bewilligungsnummer"><input value={permit.permit_number} onChange={(e) => update('permit','permit_number',e.target.value)} /></Field>
                    <Field label="Status"><select value={permit.permit_status} onChange={(e) => update('permit','permit_status',e.target.value)}><option value="valid">Gültig</option><option value="pending">Ausstehend</option><option value="renewal_pending">Verlängerung offen</option><option value="expired">Abgelaufen</option><option value="revoked">Entzogen</option></select></Field>
                    <Field label="Ausstellungsland"><input maxLength={2} value={permit.issuing_country_code} onChange={(e) => update('permit','issuing_country_code',e.target.value.toUpperCase())} /></Field>
                    <Field label="Ausstellungskanton"><input maxLength={2} value={permit.issuing_canton_code} onChange={(e) => update('permit','issuing_canton_code',e.target.value.toUpperCase())} /></Field>
                    <Field label="Gültig ab"><input type="date" value={permit.valid_from} onChange={(e) => update('permit','valid_from',e.target.value)} /></Field>
                    <Field label="Gültig bis"><input type="date" value={permit.valid_until} onChange={(e) => update('permit','valid_until',e.target.value)} /></Field>
                    <Field label="Verifizierung"><select value={permit.verification_status} onChange={(e) => update('permit','verification_status',e.target.value)}><option value="unverified">Nicht verifiziert</option><option value="verified">Verifiziert</option><option value="pending">Ausstehend</option></select></Field>
                  </div>
                  <div className="opc-admin-toggle-grid"><Toggle checked={permit.is_cross_border_permit === true} onChange={(v) => update('permit','is_cross_border_permit',v)} label="Grenzgängerbewilligung" /></div>
                  <Field label="Notizen" wide><textarea value={permit.notes} onChange={(e) => update('permit','notes',e.target.value)} /></Field>
                  <div className="opc-admin-actions split"><div><button className="danger" onClick={() => void removeSection('nationality','Nationalität wurde entfernt.')}>Nationalität entfernen</button><button className="danger" onClick={() => void removeSection('permit','Bewilligung wurde entfernt.')}>Bewilligung entfernen</button></div><button disabled={saving} onClick={() => void (async () => { await save('nationality', nationality, 'Nationalität wurde gespeichert.'); await save('permit', permit, 'Bewilligung wurde gespeichert.'); })()}><Save size={14} />Speichern</button></div>
                </section>
              ) : null}

              {tab === 'bank' ? (
                <section className="opc-admin-section">
                  <div className="opc-admin-section-head"><div><h3>Bankverbindung</h3><p>Ein IBAN-Wechsel wird als neue primäre Bankverbindung historisiert.</p></div></div>
                  <div className="opc-admin-grid">
                    <Field label="Bank"><input value={bank.bank_name} onChange={(e) => update('bank','bank_name',e.target.value)} /></Field>
                    <Field label="IBAN"><input value={bank.iban} onChange={(e) => update('bank','iban',e.target.value.toUpperCase())} /></Field>
                    <Field label="BIC"><input value={bank.bic} onChange={(e) => update('bank','bic',e.target.value.toUpperCase())} /></Field>
                    <Field label="Kontoinhaber"><input value={bank.account_holder} onChange={(e) => update('bank','account_holder',e.target.value)} /></Field>
                    <Field label="Bankadresse"><input value={bank.bank_address_line1} onChange={(e) => update('bank','bank_address_line1',e.target.value)} /></Field>
                    <Field label="Bankadresse Zusatz"><input value={bank.bank_address_line2} onChange={(e) => update('bank','bank_address_line2',e.target.value)} /></Field>
                    <Field label="PLZ"><input value={bank.bank_postal_code} onChange={(e) => update('bank','bank_postal_code',e.target.value)} /></Field>
                    <Field label="Ort"><input value={bank.bank_city} onChange={(e) => update('bank','bank_city',e.target.value)} /></Field>
                    <Field label="Land"><input maxLength={2} value={bank.bank_country_code} onChange={(e) => update('bank','bank_country_code',e.target.value.toUpperCase())} /></Field>
                    <Field label="Währung"><input maxLength={3} value={bank.currency_code} onChange={(e) => update('bank','currency_code',e.target.value.toUpperCase())} /></Field>
                    <Field label="Verifizierung"><select value={bank.verification_status} onChange={(e) => update('bank','verification_status',e.target.value)}><option value="unverified">Nicht verifiziert</option><option value="pending">Ausstehend</option><option value="verified">Verifiziert</option></select></Field>
                  </div>
                  <Field label="Notizen" wide><textarea value={bank.notes} onChange={(e) => update('bank','notes',e.target.value)} /></Field>
                  <div className="opc-admin-actions split"><button className="danger" onClick={() => void removeSection('bank_account','Bankverbindung wurde entfernt.')}>Bankverbindung entfernen</button><button disabled={saving} onClick={() => void save('bank_account', bank, 'Bankverbindung wurde gespeichert.')}><Save size={14} />Speichern</button></div>
                </section>
              ) : null}

              {tab === 'qualification' ? (
                <section className="opc-admin-section">
                  <div className="opc-admin-section-head"><div><h3>Qualifikation</h3><p>Ausbildung, Anerkennung, GAV-Relevanz und Verifizierung.</p></div></div>
                  <div className="opc-admin-grid">
                    <Field label="Ausbildungsstufe"><select value={qualification.qualification_level_code} onChange={(e) => update('qualification','qualification_level_code',e.target.value)}><option value="none">Keine formelle Ausbildung</option><option value="compulsory_school">Obligatorische Schule</option><option value="internal_cleaning_level_ii">Branchenweiterbildung Stufe II</option><option value="eba">EBA</option><option value="efz">EFZ</option><option value="federal_professional_certificate">Eidg. Fachausweis</option><option value="federal_diploma">Eidg. Diplom</option><option value="hf">HF</option><option value="bachelor">Bachelor</option><option value="master">Master</option><option value="doctorate">Doktorat</option><option value="foreign_vocational">Ausländische Berufsausbildung</option><option value="foreign_academic">Ausländischer Hochschulabschluss</option><option value="other">Andere</option></select></Field>
                    <Field label="Abschluss"><input value={qualification.qualification_title} onChange={(e) => update('qualification','qualification_title',e.target.value)} /></Field>
                    <Field label="Fachrichtung"><input value={qualification.field_of_study} onChange={(e) => update('qualification','field_of_study',e.target.value)} /></Field>
                    <Field label="Berufscode"><input value={qualification.occupation_code} onChange={(e) => update('qualification','occupation_code',e.target.value)} /></Field>
                    <Field label="Institut"><input value={qualification.institution_name} onChange={(e) => update('qualification','institution_name',e.target.value)} /></Field>
                    <Field label="Land"><input maxLength={2} value={qualification.country_code} onChange={(e) => update('qualification','country_code',e.target.value.toUpperCase())} /></Field>
                    <Field label="Abschlussdatum"><input type="date" value={qualification.completed_on} onChange={(e) => update('qualification','completed_on',e.target.value)} /></Field>
                    <Field label="Gültig bis"><input type="date" value={qualification.valid_until} onChange={(e) => update('qualification','valid_until',e.target.value)} /></Field>
                    <Field label="Anerkennung"><select value={qualification.swiss_recognition_status} onChange={(e) => update('qualification','swiss_recognition_status',e.target.value)}><option value="not_required">Nicht erforderlich</option><option value="pending">Ausstehend</option><option value="recognized">Anerkannt</option><option value="partially_recognized">Teilweise anerkannt</option><option value="not_recognized">Nicht anerkannt</option><option value="unknown">Unbekannt</option></select></Field>
                    <Field label="Anerkennungsstelle"><input value={qualification.recognition_authority} onChange={(e) => update('qualification','recognition_authority',e.target.value)} /></Field>
                    <Field label="Referenz"><input value={qualification.recognition_reference} onChange={(e) => update('qualification','recognition_reference',e.target.value)} /></Field>
                    <Field label="Verifizierung"><select value={qualification.verification_status} onChange={(e) => update('qualification','verification_status',e.target.value)}><option value="unverified">Nicht verifiziert</option><option value="pending">Ausstehend</option><option value="verified">Verifiziert</option></select></Field>
                  </div>
                  <div className="opc-admin-toggle-grid"><Toggle checked={qualification.relevant_for_cleaning_gav === true} onChange={(v) => update('qualification','relevant_for_cleaning_gav',v)} label="GAV-relevant" /><Toggle checked={qualification.relevant_for_current_position !== false} onChange={(v) => update('qualification','relevant_for_current_position',v)} label="Für aktuelle Position relevant" /></div>
                  <Field label="Notizen" wide><textarea value={qualification.notes} onChange={(e) => update('qualification','notes',e.target.value)} /></Field>
                  <div className="opc-admin-actions split"><button className="danger" onClick={() => void removeSection('qualification','Qualifikation wurde entfernt.')}>Qualifikation entfernen</button><button disabled={saving} onClick={() => void save('qualification', qualification, 'Qualifikation wurde gespeichert.')}><Save size={14} />Speichern</button></div>
                </section>
              ) : null}

              {tab === 'availability' ? (
                <section className="opc-admin-section">
                  <div className="opc-admin-section-head"><div><h3>Verfügbarkeit</h3><p>Dieser Bereich wird nur gespeichert, wenn du hier auf Speichern klickst.</p></div></div>
                  <div className="opc-admin-grid">
                    <Field label="Modell"><select value={availability.availability_mode} onChange={(e) => update('availability','availability_mode',e.target.value)}><option value="weekly_schedule">Wochenplan</option><option value="24_7">24/7</option><option value="on_call">Auf Abruf</option><option value="limited">Eingeschränkt</option><option value="unavailable">Nicht verfügbar</option></select></Field>
                    <Field label="Zeitzone"><input value={availability.timezone} onChange={(e) => update('availability','timezone',e.target.value)} /></Field>
                    <Field label="Mindestvorlauf (h)"><input type="number" min="0" value={availability.minimum_notice_hours} onChange={(e) => update('availability','minimum_notice_hours',e.target.value)} /></Field>
                    <Field label="Bevorzugte Wochenstunden"><input type="number" min="0" value={availability.preferred_weekly_hours} onChange={(e) => update('availability','preferred_weekly_hours',e.target.value)} /></Field>
                    <Field label="Maximale Wochenstunden"><input type="number" min="0" value={availability.maximum_weekly_hours} onChange={(e) => update('availability','maximum_weekly_hours',e.target.value)} /></Field>
                  </div>
                  <div className="opc-admin-toggle-grid"><Toggle checked={availability.short_notice_available === true} onChange={(v) => update('availability','short_notice_available',v)} label="Kurzfristig verfügbar" /><Toggle checked={availability.weekend_available === true} onChange={(v) => update('availability','weekend_available',v)} label="Wochenende möglich" /><Toggle checked={availability.saturday_available === true} onChange={(v) => update('availability','saturday_available',v)} label="Samstag" /><Toggle checked={availability.sunday_available === true} onChange={(v) => update('availability','sunday_available',v)} label="Sonntag" /><Toggle checked={availability.public_holiday_available === true} onChange={(v) => update('availability','public_holiday_available',v)} label="Feiertage" /><Toggle checked={availability.night_work_available === true} onChange={(v) => update('availability','night_work_available',v)} label="Nachtarbeit" /></div>
                  {availability.availability_mode === 'weekly_schedule' ? <div className="opc-admin-days">{rules.map((rule) => <div key={rule.day_of_week} className={rule.enabled ? 'active' : ''}><Toggle checked={rule.enabled === true} onChange={(v) => updateRule(rule.day_of_week,{enabled:v})} label={DAY_LABELS[Number(rule.day_of_week)]} /><input disabled={!rule.enabled} type="time" value={rule.start_time} onChange={(e) => updateRule(rule.day_of_week,{start_time:e.target.value})} /><input disabled={!rule.enabled} type="time" value={rule.end_time} onChange={(e) => updateRule(rule.day_of_week,{end_time:e.target.value})} /><select disabled={!rule.enabled} value={rule.availability_type} onChange={(e) => updateRule(rule.day_of_week,{availability_type:e.target.value})}><option value="available">Verfügbar</option><option value="preferred">Bevorzugt</option><option value="on_call">Auf Abruf</option></select></div>)}</div> : null}
                  <Field label="Notizen" wide><textarea value={availability.notes} onChange={(e) => update('availability','notes',e.target.value)} /></Field>
                  <div className="opc-admin-actions"><button disabled={saving} onClick={() => void save('availability', { availability, rules: availability.availability_mode === 'weekly_schedule' ? rules : [] }, 'Verfügbarkeit wurde gespeichert.')}><Save size={14} />Speichern</button></div>
                </section>
              ) : null}

              {tab === 'skills' ? (
                <section className="opc-admin-section">
                  <div className="opc-admin-section-head"><div><h3>Skills</h3><p>Skills werden nur in diesem Bereich geändert.</p></div></div>
                  <div className="opc-admin-skill-grid">{skills.map((item, index) => <div key={item.catalog.id} className={item.selected ? 'active' : ''}><Toggle checked={item.selected === true} onChange={(value) => setSkills((current) => current.map((row, i) => i === index ? { ...row, selected: value } : row))} label={item.catalog.name_de || 'Skill'} />{item.selected ? <div className="opc-admin-skill-fields"><select value={item.proficiency_level} onChange={(e) => setSkills((current) => current.map((row,i) => i === index ? { ...row, proficiency_level: e.target.value } : row))}><option value="basic">Grundkenntnisse</option><option value="independent">Selbständig</option><option value="advanced">Fortgeschritten</option><option value="lead">Teamleitung</option><option value="trainer">Trainer/in</option></select><Toggle checked={item.is_preferred === true} onChange={(v) => setSkills((current) => current.map((row,i) => i === index ? { ...row, is_preferred:v } : row))} label="Bevorzugt" /><Toggle checked={item.can_work_independently !== false} onChange={(v) => setSkills((current) => current.map((row,i) => i === index ? { ...row, can_work_independently:v } : row))} label="Selbständig einsetzbar" /><Toggle checked={item.can_lead_team === true} onChange={(v) => setSkills((current) => current.map((row,i) => i === index ? { ...row, can_lead_team:v } : row))} label="Teamleitung" /></div> : null}</div>)}</div>
                  <div className="opc-admin-actions"><button disabled={saving} onClick={() => void save('skills', { skills: skills.filter((item) => item.selected).map((item) => ({ skill_id: item.catalog.id, proficiency_level: item.proficiency_level, is_preferred: item.is_preferred, can_work_independently: item.can_work_independently, can_lead_team: item.can_lead_team, years_experience: item.years_experience })) }, 'Skills wurden gespeichert.')}><Save size={14} />Speichern</button></div>
                </section>
              ) : null}

              {tab === 'emergency' ? (
                <section className="opc-admin-section">
                  <div className="opc-admin-section-head"><div><h3>Notfallkontakt</h3><p>Der Kontakt kann auch vollständig entfernt werden.</p></div></div>
                  <div className="opc-admin-grid">
                    <Field label="Name"><input value={emergency.full_name} onChange={(e) => update('emergency','full_name',e.target.value)} /></Field>
                    <Field label="Beziehung"><input value={emergency.relationship_label} onChange={(e) => update('emergency','relationship_label',e.target.value)} /></Field>
                    <Field label="Telefon"><input value={emergency.phone_raw} onChange={(e) => update('emergency','phone_raw',e.target.value)} /></Field>
                    <Field label="E-Mail"><input type="email" value={emergency.email} onChange={(e) => update('emergency','email',e.target.value)} /></Field>
                    <Field label="Sprache"><input value={emergency.preferred_language} onChange={(e) => update('emergency','preferred_language',e.target.value)} /></Field>
                  </div>
                  <Field label="Notizen" wide><textarea value={emergency.notes} onChange={(e) => update('emergency','notes',e.target.value)} /></Field>
                  <div className="opc-admin-actions split"><button className="danger" onClick={() => void removeSection('emergency_contact','Notfallkontakt wurde entfernt.')}>Notfallkontakt entfernen</button><button disabled={saving} onClick={() => void save('emergency_contact', emergency, 'Notfallkontakt wurde gespeichert.')}><Save size={14} />Speichern</button></div>
                </section>
              ) : null}

              {tab === 'notes' ? (
                <section className="opc-admin-section">
                  <div className="opc-admin-section-head"><div><h3>Interne Notizen</h3><p>Notizen werden separat gespeichert und verändern keine Stammdaten.</p></div></div>
                  <div className="opc-admin-grid">
                    <Field label="Typ"><select value={noteType} onChange={(e) => setNoteType(e.target.value)}><option value="general">Allgemein</option><option value="availability">Verfügbarkeit</option><option value="skill">Skill</option><option value="preference">Präferenz</option><option value="performance">Leistung</option><option value="restriction">Einschränkung</option><option value="training">Schulung</option><option value="incident">Vorfall</option><option value="other">Andere</option></select></Field>
                    <Field label="Titel"><input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} /></Field>
                    {role === 'owner' ? <Field label="Sichtbarkeit"><select value={noteVisibility} onChange={(e) => setNoteVisibility(e.target.value)}><option value="hr_admins">HR / Admin</option><option value="owners_only">Nur Owner</option></select></Field> : null}
                  </div>
                  <Field label="Notiz" wide><textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Interne Notiz zum Mitarbeiter" /></Field>
                  <div className="opc-admin-actions"><button disabled={saving || !noteText.trim()} onClick={() => void (async () => { await save('note', { note_text: noteText, title: noteTitle, note_type: noteType, visibility_scope: noteVisibility }, 'Notiz wurde gespeichert.'); setNoteText(''); setNoteTitle(''); })()}><Save size={14} />Notiz speichern</button></div>
                  <div className="opc-admin-note-list">{asArray(detail.notes).map((note) => <div key={note.id}><div><strong>{note.title || note.note_type || 'Notiz'}</strong><span>{note.visibility_scope === 'owners_only' ? 'Owner' : 'HR'}</span></div><p>{note.note_text}</p></div>)}</div>
                </section>
              ) : null}

              {tab === 'portal' && role === 'owner' ? (
                <section className="opc-admin-section">
                  <div className="opc-admin-section-head"><div><h3>Portal & Berechtigungen</h3><p>Owner-only. Die Portalrolle wird zusätzlich mit dem Legacy-Profil synchronisiert.</p></div></div>
                  {!detail.staff_role ? <div className="opc-admin-alert error">Für diese Personalakte ist noch keine Portalrolle verknüpft.</div> : null}
                  <div className="opc-admin-grid">
                    <Field label="Portalrolle"><select value={portal.role} onChange={(e) => update('portal','role',e.target.value)}><option value="owner">Owner</option><option value="admin">Admin</option><option value="dispatch">Disposition</option><option value="employee">Mitarbeiter</option></select></Field>
                    <Field label="Status"><select value={portal.status} onChange={(e) => update('portal','status',e.target.value)}><option value="active">Aktiv</option><option value="inactive">Inaktiv</option><option value="suspended">Gesperrt</option></select></Field>
                  </div>
                  <div className="opc-admin-permission-grid">
                    <Toggle checked={portal.can_access_portal !== false} onChange={(v) => update('portal','can_access_portal',v)} label="Portalzugang" />
                    <Toggle checked={portal.can_submit_time_logs !== false} onChange={(v) => update('portal','can_submit_time_logs',v)} label="Zeiten erfassen" />
                    <Toggle checked={portal.can_view_all_jobs === true} onChange={(v) => update('portal','can_view_all_jobs',v)} label="Alle Einsätze sehen" />
                    <Toggle checked={portal.can_manage_jobs === true} onChange={(v) => update('portal','can_manage_jobs',v)} label="Einsätze verwalten" />
                    <Toggle checked={portal.can_manage_employees === true} onChange={(v) => update('portal','can_manage_employees',v)} label="Mitarbeiter verwalten" />
                    <Toggle checked={portal.can_manage_reports === true} onChange={(v) => update('portal','can_manage_reports',v)} label="Berichte verwalten" />
                    <Toggle checked={portal.can_manage_finance === true} onChange={(v) => update('portal','can_manage_finance',v)} label="Finanzen verwalten" />
                  </div>
                  <div className="opc-admin-owner-note"><ShieldCheck size={17} /><span>Bei der Rolle Owner werden die operativen Berechtigungen serverseitig automatisch vollständig aktiviert.</span></div>
                  <div className="opc-admin-actions"><button disabled={saving || !detail.staff_role} onClick={() => void save('portal_access', portal, 'Portalrolle und Berechtigungen wurden gespeichert.')}><Save size={14} />Rechte speichern</button></div>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      <style>{`
        .opc-admin-control{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text",Inter,"Helvetica Neue",Arial,sans-serif;margin:0 0 14px;width:100%;color:#111827}
        .opc-admin-control *{box-sizing:border-box}.opc-admin-control-bar{min-height:72px;padding:14px 16px;border:1px solid #E5E7EB;border-radius:18px;background:#fff;display:flex;align-items:center;justify-content:space-between;gap:14px;box-shadow:0 1px 2px rgba(15,23,42,.04)}
        .opc-admin-control-bar>div{display:grid;gap:4px}.opc-admin-control-bar strong{font-size:14px;font-weight:850}.opc-admin-control-bar span{font-size:11px;color:#6B7280;font-weight:650}.opc-admin-open,.opc-admin-actions button{min-height:40px;border:1px solid #111827;background:#111827;color:white;border-radius:12px;padding:0 13px;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:12px;font-weight:780;cursor:pointer}
        .opc-admin-panel{margin-top:10px;border:1px solid #E5E7EB;border-radius:18px;background:#fff;padding:14px}.opc-admin-loading{min-height:100px;display:flex;align-items:center;justify-content:center;gap:8px;color:#6B7280;font-size:12px;font-weight:700}.spin{animation:opc-spin 1s linear infinite}@keyframes opc-spin{to{transform:rotate(360deg)}}
        .opc-admin-alert{padding:11px 13px;border-radius:12px;margin-bottom:10px;font-size:12px;font-weight:700}.opc-admin-alert.error{background:#FEF2F2;border:1px solid #FECACA;color:#B91C1C}.opc-admin-alert.success{background:#ECFDF5;border:1px solid #A7F3D0;color:#047857}
        .opc-admin-tabs{display:flex;gap:7px;overflow-x:auto;padding:0 0 12px;scrollbar-width:none}.opc-admin-tabs::-webkit-scrollbar{display:none}.opc-admin-tabs button{height:36px;border:1px solid #E5E7EB;background:#fff;color:#4B5563;border-radius:11px;padding:0 11px;display:flex;align-items:center;gap:6px;white-space:nowrap;font-size:11px;font-weight:760;cursor:pointer}.opc-admin-tabs button.active{background:#111827;border-color:#111827;color:#fff}
        .opc-admin-section{border-top:1px solid #F3F4F6;padding-top:14px}.opc-admin-section-head{display:flex;justify-content:space-between;gap:12px;margin-bottom:13px}.opc-admin-section-head h3{margin:0;font-size:16px;font-weight:850;letter-spacing:-.02em}.opc-admin-section-head p{margin:4px 0 0;color:#6B7280;font-size:11px;font-weight:650}
        .opc-admin-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.opc-admin-field{display:grid;gap:5px;min-width:0;color:#6B7280;font-size:10px;font-weight:780}.opc-admin-field.wide{margin-top:10px}.opc-admin-field input,.opc-admin-field select,.opc-admin-field textarea,.opc-admin-days input,.opc-admin-days select,.opc-admin-skill-fields select{width:100%;min-height:40px;border:1px solid #E5E7EB;border-radius:11px;background:#fff;color:#111827;padding:8px 10px;font-family:inherit;font-size:12px;font-weight:700;outline:0}.opc-admin-field textarea{min-height:80px;resize:vertical}
        .opc-admin-toggle-grid,.opc-admin-permission-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:10px}.opc-admin-toggle{min-height:36px;border:1px solid #E5E7EB;border-radius:11px;background:#fff;color:#374151;padding:6px 9px;display:flex;align-items:center;gap:7px;text-align:left;font-size:11px;font-weight:720;cursor:pointer}.opc-admin-toggle>span{width:17px;height:17px;border:1.5px solid #111827;border-radius:999px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}.opc-admin-toggle.active>span{background:#111827;color:#fff}
        .opc-admin-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.opc-admin-actions.split{justify-content:space-between}.opc-admin-actions.split>div{display:flex;gap:7px;flex-wrap:wrap}.opc-admin-actions button:disabled{opacity:.55;cursor:wait}.opc-admin-actions button.danger{background:#fff;color:#B91C1C;border-color:#FECACA}
        .opc-admin-days{display:grid;gap:7px;margin-top:10px}.opc-admin-days>div{display:grid;grid-template-columns:minmax(150px,1fr) 110px 110px 130px;gap:7px;align-items:center;padding:7px;border:1px solid #E5E7EB;border-radius:12px}.opc-admin-days>div.active{background:#FAFAFA}.opc-admin-skill-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.opc-admin-skill-grid>div{border:1px solid #E5E7EB;border-radius:12px;padding:8px}.opc-admin-skill-grid>div.active{background:#FAFAFA}.opc-admin-skill-fields{display:grid;gap:6px;margin-top:7px}.opc-admin-note-list{display:grid;gap:7px;margin-top:12px}.opc-admin-note-list>div{border:1px solid #E5E7EB;border-radius:12px;padding:10px}.opc-admin-note-list>div>div{display:flex;justify-content:space-between;gap:8px}.opc-admin-note-list strong{font-size:11px}.opc-admin-note-list span{font-size:10px;color:#6B7280}.opc-admin-note-list p{margin:6px 0 0;font-size:11px;line-height:1.45;color:#374151;white-space:pre-wrap}.opc-admin-owner-note{margin-top:10px;border:1px solid #E5E7EB;background:#FAFAFA;border-radius:12px;padding:10px;display:flex;align-items:center;gap:8px;color:#4B5563;font-size:11px;font-weight:680}
        @media(max-width:900px){.opc-admin-grid,.opc-admin-toggle-grid,.opc-admin-permission-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.opc-admin-days>div{grid-template-columns:1fr 1fr}.opc-admin-skill-grid{grid-template-columns:1fr}}
        @media(max-width:600px){.opc-admin-control-bar{align-items:flex-start;flex-direction:column}.opc-admin-open{width:100%}.opc-admin-grid,.opc-admin-toggle-grid,.opc-admin-permission-grid{grid-template-columns:1fr}.opc-admin-actions.split{flex-direction:column}.opc-admin-actions.split>button{width:100%}.opc-admin-actions.split>div{width:100%}.opc-admin-actions.split>div button{flex:1}.opc-admin-days>div{grid-template-columns:1fr}.opc-admin-skill-grid{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
}
