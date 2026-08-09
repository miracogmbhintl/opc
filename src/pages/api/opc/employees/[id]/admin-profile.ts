import type { APIRoute } from 'astro';
import {
  asBoolean,
  asNumber,
  cleanText,
  cleanUpperCode,
  errorStatus,
  jsonResponse,
  normalizeEmail,
  normalizePhone,
  requireEmployeeHrAccess,
  safeArray,
  safeObject,
  throwOnError,
  todayIsoDate,
  yesterdayIsoDate,
} from '../../../../../lib/opc-employee-api';

export const prerender = false;

type JsonRow = Record<string, any>;
type Section =
  | 'employee'
  | 'address'
  | 'nationality'
  | 'permit'
  | 'bank_account'
  | 'qualification'
  | 'availability'
  | 'skills'
  | 'emergency_contact'
  | 'note'
  | 'portal_access';

function hasOwn(row: JsonRow, key: string) {
  return Object.prototype.hasOwnProperty.call(row, key);
}

function normalizeRole(value: unknown) {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'inhaber' || role === 'godmode') return 'owner';
  if (role === 'administrator') return 'admin';
  if (role === 'dispatcher' || role === 'disposition') return 'dispatch';
  if (role === 'mitarbeiter' || role === 'staff') return 'employee';
  return role;
}

function currentRow(rows: JsonRow[]) {
  const today = todayIsoDate();
  return (
    rows
      .filter((row) => {
        const from = String(row.valid_from || '0000-01-01');
        const until = String(row.valid_until || '9999-12-31');
        return from <= today && until >= today;
      })
      .sort((a, b) => String(b.valid_from || '').localeCompare(String(a.valid_from || '')))[0] ||
    rows[0] ||
    null
  );
}

async function loadEmployee(supabase: any, employeeId: string) {
  const response = await supabase
    .from('opc_employees')
    .select('*')
    .eq('id', employeeId)
    .maybeSingle();
  throwOnError(response.error, 'Mitarbeiter konnte nicht geladen werden');
  if (!response.data) throw new Error('Mitarbeiter wurde nicht gefunden.');
  return response.data as JsonRow;
}

async function saveEmployeeSection(
  supabase: any,
  employee: JsonRow,
  data: JsonRow,
  actorId: string,
) {
  const update: JsonRow = { updated_by: actorId };
  const textFields = [
    'preferred_name',
    'date_of_birth',
    'gender_code',
    'civil_status',
    'birth_place',
    'citizenship_place',
    'ahv_number',
    'fax_number',
    'preferred_language',
    'status',
    'assignment_status',
    'profile_completion_status',
    'personnel_type',
    'payroll_exclusion_reason',
    'entry_date',
    'exit_date',
    'internal_notes',
  ];

  if (hasOwn(data, 'legal_first_name')) {
    const value = cleanText(data.legal_first_name);
    if (!value) throw new Error('Vorname darf nicht leer sein.');
    update.legal_first_name = value;
  }
  if (hasOwn(data, 'legal_last_name')) {
    const value = cleanText(data.legal_last_name);
    if (!value) throw new Error('Nachname darf nicht leer sein.');
    update.legal_last_name = value;
  }

  textFields.forEach((field) => {
    if (hasOwn(data, field)) update[field] = cleanText(data[field]);
  });

  if (hasOwn(data, 'private_email')) update.private_email = normalizeEmail(data.private_email);
  if (hasOwn(data, 'business_email')) update.business_email = normalizeEmail(data.business_email);
  if (hasOwn(data, 'phone_raw')) {
    update.phone_raw = cleanText(data.phone_raw);
    update.phone_e164 = normalizePhone(data.phone_raw);
  }
  if (hasOwn(data, 'us_tax_person')) update.us_tax_person = asBoolean(data.us_tax_person);
  if (hasOwn(data, 'payroll_in_scope')) update.payroll_in_scope = asBoolean(data.payroll_in_scope);
  if (hasOwn(data, 'portal_access_only')) update.portal_access_only = asBoolean(data.portal_access_only);
  if (hasOwn(data, 'employing_entity_id')) update.employing_entity_id = cleanText(data.employing_entity_id);

  if (hasOwn(data, 'operational_position_id')) {
    const positionId = cleanText(data.operational_position_id);
    let position: JsonRow | null = null;
    if (positionId) {
      const response = await supabase.from('opc_positions').select('*').eq('id', positionId).maybeSingle();
      throwOnError(response.error, 'Position konnte nicht geladen werden');
      if (!response.data) throw new Error('Die ausgewählte Position existiert nicht mehr.');
      position = response.data;
    }

    update.metadata = {
      ...safeObject(employee.metadata),
      operational_position_id: position?.id || null,
      operational_position_code: position?.position_code || null,
      operational_position_title: position?.title_de || null,
      last_updated_from: 'mitarbeiter-admin-editor',
      last_updated_at: new Date().toISOString(),
    };
  }

  if (Object.keys(update).length === 1) return;

  const response = await supabase
    .from('opc_employees')
    .update(update)
    .eq('id', employee.id);
  throwOnError(response.error, 'Personalien konnten nicht gespeichert werden');
}

async function saveAddressSection(
  supabase: any,
  employeeId: string,
  data: JsonRow,
  actorId: string,
) {
  const existingResponse = await supabase
    .from('opc_employee_addresses')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('address_type', 'residence')
    .is('valid_until', null)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  throwOnError(existingResponse.error, 'Bestehende Adresse konnte nicht geladen werden');
  const existing = existingResponse.data as JsonRow | null;

  if (asBoolean(data.clear)) {
    if (!existing) return;
    if (String(existing.valid_from || '') >= todayIsoDate()) {
      const response = await supabase.from('opc_employee_addresses').delete().eq('id', existing.id);
      throwOnError(response.error, 'Adresse konnte nicht entfernt werden');
    } else {
      const response = await supabase
        .from('opc_employee_addresses')
        .update({ valid_until: yesterdayIsoDate(), is_primary: false, updated_by: actorId })
        .eq('id', existing.id);
      throwOnError(response.error, 'Adresse konnte nicht beendet werden');
    }
    return;
  }

  const street = cleanText(data.street);
  const postalCode = cleanText(data.postal_code);
  const city = cleanText(data.city);
  if (!street || !postalCode || !city) {
    throw new Error('Für eine Adresse sind Strasse, PLZ und Ort erforderlich.');
  }

  const payload = {
    employee_id: employeeId,
    address_type: 'residence',
    residence_kind: cleanText(data.residence_kind) || existing?.residence_kind || 'main_residence',
    street,
    house_number: cleanText(data.house_number),
    address_addition: cleanText(data.address_addition),
    postal_code: postalCode,
    city,
    state_region: cleanText(data.state_region),
    canton_code: cleanUpperCode(data.canton_code, 2),
    municipality: cleanText(data.municipality),
    country_code: cleanUpperCode(data.country_code, 2) || 'CH',
    is_primary: true,
    tax_relevant: asBoolean(data.tax_relevant, true),
    updated_by: actorId,
    metadata: { ...safeObject(existing?.metadata), source: 'mitarbeiter-admin-editor' },
  };

  if (!existing) {
    const response = await supabase.from('opc_employee_addresses').insert({
      ...payload,
      valid_from: todayIsoDate(),
      created_by: actorId,
    });
    throwOnError(response.error, 'Adresse konnte nicht angelegt werden');
    return;
  }

  if (String(existing.valid_from || '') >= todayIsoDate()) {
    const response = await supabase.from('opc_employee_addresses').update(payload).eq('id', existing.id);
    throwOnError(response.error, 'Adresse konnte nicht aktualisiert werden');
    return;
  }

  const closeResponse = await supabase
    .from('opc_employee_addresses')
    .update({ valid_until: yesterdayIsoDate(), is_primary: false, updated_by: actorId })
    .eq('id', existing.id);
  throwOnError(closeResponse.error, 'Vorherige Adresse konnte nicht historisiert werden');

  const insertResponse = await supabase.from('opc_employee_addresses').insert({
    ...payload,
    valid_from: todayIsoDate(),
    created_by: actorId,
  });
  throwOnError(insertResponse.error, 'Neue Adresse konnte nicht angelegt werden');
}

async function saveNationalitySection(
  supabase: any,
  employeeId: string,
  data: JsonRow,
  actorId: string,
) {
  const existingResponse = await supabase
    .from('opc_employee_nationalities')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('is_primary', true)
    .is('valid_until', null)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  throwOnError(existingResponse.error, 'Nationalität konnte nicht geladen werden');
  const existing = existingResponse.data as JsonRow | null;

  const countryCode = cleanUpperCode(data.country_code, 2);
  if (asBoolean(data.clear) || !countryCode) {
    if (!existing) return;
    if (String(existing.valid_from || '') >= todayIsoDate()) {
      const response = await supabase.from('opc_employee_nationalities').delete().eq('id', existing.id);
      throwOnError(response.error, 'Nationalität konnte nicht entfernt werden');
    } else {
      const response = await supabase
        .from('opc_employee_nationalities')
        .update({ valid_until: yesterdayIsoDate(), is_primary: false, updated_by: actorId })
        .eq('id', existing.id);
      throwOnError(response.error, 'Nationalität konnte nicht beendet werden');
    }
    return;
  }

  if (existing && String(existing.country_code || '') === countryCode) return;

  if (existing) {
    if (String(existing.valid_from || '') >= todayIsoDate()) {
      const response = await supabase
        .from('opc_employee_nationalities')
        .update({ country_code: countryCode, updated_by: actorId })
        .eq('id', existing.id);
      throwOnError(response.error, 'Nationalität konnte nicht aktualisiert werden');
      return;
    }

    const closeResponse = await supabase
      .from('opc_employee_nationalities')
      .update({ valid_until: yesterdayIsoDate(), is_primary: false, updated_by: actorId })
      .eq('id', existing.id);
    throwOnError(closeResponse.error, 'Vorherige Nationalität konnte nicht historisiert werden');
  }

  const response = await supabase.from('opc_employee_nationalities').insert({
    employee_id: employeeId,
    country_code: countryCode,
    is_primary: true,
    valid_from: todayIsoDate(),
    created_by: actorId,
    updated_by: actorId,
    metadata: { source: 'mitarbeiter-admin-editor' },
  });
  throwOnError(response.error, 'Nationalität konnte nicht angelegt werden');
}

async function savePermitSection(
  supabase: any,
  employeeId: string,
  data: JsonRow,
  actorId: string,
) {
  const rowsResponse = await supabase
    .from('opc_employee_permits')
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });
  throwOnError(rowsResponse.error, 'Bewilligungen konnten nicht geladen werden');
  const rows = (rowsResponse.data || []) as JsonRow[];
  const requestedId = cleanText(data.id);
  const existing = requestedId
    ? rows.find((row) => String(row.id) === requestedId) || null
    : currentRow(rows);

  if (asBoolean(data.clear) || !cleanText(data.permit_type)) {
    if (!existing) return;
    const response = await supabase.from('opc_employee_permits').delete().eq('id', existing.id);
    throwOnError(response.error, 'Bewilligung konnte nicht entfernt werden');
    return;
  }

  const permitType = cleanText(data.permit_type)!;
  const payload = {
    employee_id: employeeId,
    permit_type: permitType,
    permit_number: cleanText(data.permit_number),
    permit_status: cleanText(data.permit_status) || 'valid',
    issuing_country_code: cleanUpperCode(data.issuing_country_code, 2) || 'CH',
    issuing_canton_code: cleanUpperCode(data.issuing_canton_code, 2),
    is_cross_border_permit: asBoolean(data.is_cross_border_permit, permitType === 'g'),
    valid_from: cleanText(data.valid_from),
    valid_until: cleanText(data.valid_until),
    verification_status: cleanText(data.verification_status) || 'unverified',
    notes: cleanText(data.notes),
    updated_by: actorId,
    metadata: { ...safeObject(existing?.metadata), source: 'mitarbeiter-admin-editor' },
  };

  const response = existing
    ? await supabase.from('opc_employee_permits').update(payload).eq('id', existing.id)
    : await supabase.from('opc_employee_permits').insert({ ...payload, created_by: actorId });
  throwOnError(response.error, 'Bewilligung konnte nicht gespeichert werden');
}

async function saveBankSection(
  supabase: any,
  employee: JsonRow,
  data: JsonRow,
  actorId: string,
) {
  const existingResponse = await supabase
    .from('opc_employee_bank_accounts')
    .select('*')
    .eq('employee_id', employee.id)
    .eq('is_primary', true)
    .neq('account_status', 'closed')
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  throwOnError(existingResponse.error, 'Bankverbindung konnte nicht geladen werden');
  const existing = existingResponse.data as JsonRow | null;

  const iban = cleanText(data.iban)?.replace(/\s+/g, '').toUpperCase() || null;
  if (asBoolean(data.clear) || !iban) {
    if (!existing) return;
    const response = await supabase
      .from('opc_employee_bank_accounts')
      .update({
        account_status: 'closed',
        is_primary: false,
        valid_until: todayIsoDate(),
        updated_by: actorId,
      })
      .eq('id', existing.id);
    throwOnError(response.error, 'Bankverbindung konnte nicht entfernt werden');
    return;
  }

  const payload = {
    employee_id: employee.id,
    bank_name: cleanText(data.bank_name) || 'Nicht angegeben',
    bank_address_line1: cleanText(data.bank_address_line1),
    bank_address_line2: cleanText(data.bank_address_line2),
    bank_postal_code: cleanText(data.bank_postal_code),
    bank_city: cleanText(data.bank_city),
    bank_country_code: cleanUpperCode(data.bank_country_code, 2) || 'CH',
    iban,
    bic: cleanText(data.bic)?.toUpperCase() || null,
    account_holder:
      cleanText(data.account_holder) ||
      [employee.legal_first_name, employee.legal_last_name].filter(Boolean).join(' '),
    currency_code: cleanUpperCode(data.currency_code, 3) || 'CHF',
    verification_status: cleanText(data.verification_status) || 'unverified',
    account_status: 'active',
    is_primary: true,
    notes: cleanText(data.notes),
    updated_by: actorId,
    metadata: { ...safeObject(existing?.metadata), source: 'mitarbeiter-admin-editor' },
  };

  if (existing && String(existing.iban || '').replace(/\s+/g, '').toUpperCase() === iban) {
    const response = await supabase.from('opc_employee_bank_accounts').update(payload).eq('id', existing.id);
    throwOnError(response.error, 'Bankverbindung konnte nicht aktualisiert werden');
    return;
  }

  if (existing) {
    const closeResponse = await supabase
      .from('opc_employee_bank_accounts')
      .update({ account_status: 'inactive', is_primary: false, valid_until: todayIsoDate(), updated_by: actorId })
      .eq('id', existing.id);
    throwOnError(closeResponse.error, 'Vorherige Bankverbindung konnte nicht historisiert werden');
  }

  const response = await supabase.from('opc_employee_bank_accounts').insert({
    ...payload,
    valid_from: todayIsoDate(),
    created_by: actorId,
  });
  throwOnError(response.error, 'Bankverbindung konnte nicht angelegt werden');
}

async function saveQualificationSection(
  supabase: any,
  employeeId: string,
  data: JsonRow,
  actorId: string,
) {
  const existingResponse = await supabase
    .from('opc_employee_qualifications')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('is_primary', true)
    .limit(1)
    .maybeSingle();
  throwOnError(existingResponse.error, 'Qualifikation konnte nicht geladen werden');
  const existing = existingResponse.data as JsonRow | null;

  const level = cleanText(data.qualification_level_code);
  const title = cleanText(data.qualification_title);
  if (asBoolean(data.clear) || (!level && !title)) {
    if (!existing) return;
    const response = await supabase.from('opc_employee_qualifications').delete().eq('id', existing.id);
    throwOnError(response.error, 'Qualifikation konnte nicht entfernt werden');
    return;
  }

  const payload = {
    employee_id: employeeId,
    qualification_level_code: level || 'none',
    qualification_title: title || (level === 'none' ? 'Keine formelle Ausbildung' : 'Ausbildungsnachweis'),
    field_of_study: cleanText(data.field_of_study),
    occupation_code: cleanText(data.occupation_code),
    institution_name: cleanText(data.institution_name),
    country_code: cleanUpperCode(data.country_code, 2),
    completed_on: cleanText(data.completed_on),
    valid_until: cleanText(data.valid_until),
    swiss_recognition_status: cleanText(data.swiss_recognition_status) || 'not_required',
    recognition_authority: cleanText(data.recognition_authority),
    recognition_reference: cleanText(data.recognition_reference),
    relevant_for_cleaning_gav: asBoolean(data.relevant_for_cleaning_gav),
    relevant_for_current_position: asBoolean(data.relevant_for_current_position, true),
    is_primary: true,
    verification_status: cleanText(data.verification_status) || 'unverified',
    notes: cleanText(data.notes),
    updated_by: actorId,
    metadata: { ...safeObject(existing?.metadata), source: 'mitarbeiter-admin-editor' },
  };

  const response = existing
    ? await supabase.from('opc_employee_qualifications').update(payload).eq('id', existing.id)
    : await supabase.from('opc_employee_qualifications').insert({ ...payload, created_by: actorId });
  throwOnError(response.error, 'Qualifikation konnte nicht gespeichert werden');
}

async function saveSkillsSection(
  supabase: any,
  employeeId: string,
  data: JsonRow,
  actorId: string,
) {
  const skills = safeArray<JsonRow>(data.skills);
  const existingResponse = await supabase
    .from('opc_employee_skills')
    .select('*')
    .eq('employee_id', employeeId);
  throwOnError(existingResponse.error, 'Bestehende Skills konnten nicht geladen werden');

  const existingBySkillId = new Map<string, JsonRow>(
    (existingResponse.data || []).map((row: JsonRow) => [String(row.skill_id), row]),
  );
  const selected = new Set<string>();

  for (const skill of skills) {
    const skillId = cleanText(skill.skill_id);
    if (!skillId) continue;
    selected.add(skillId);
    const payload = {
      employee_id: employeeId,
      skill_id: skillId,
      proficiency_level: cleanText(skill.proficiency_level) || 'independent',
      is_willing: asBoolean(skill.is_willing, true),
      is_preferred: asBoolean(skill.is_preferred),
      can_work_independently: asBoolean(skill.can_work_independently, true),
      can_lead_team: asBoolean(skill.can_lead_team),
      years_experience: asNumber(skill.years_experience),
      certification_valid_until: cleanText(skill.certification_valid_until),
      notes: cleanText(skill.notes),
      is_active: true,
      updated_by: actorId,
      metadata: { source: 'mitarbeiter-admin-editor' },
    };
    const existing = existingBySkillId.get(skillId);
    const response = existing
      ? await supabase.from('opc_employee_skills').update(payload).eq('id', existing.id)
      : await supabase.from('opc_employee_skills').insert({ ...payload, created_by: actorId });
    throwOnError(response.error, 'Skill konnte nicht gespeichert werden');
  }

  const deactivateIds = (existingResponse.data || [])
    .filter((row: JsonRow) => row.is_active !== false && !selected.has(String(row.skill_id)))
    .map((row: JsonRow) => row.id);
  if (deactivateIds.length) {
    const response = await supabase
      .from('opc_employee_skills')
      .update({ is_active: false, updated_by: actorId })
      .in('id', deactivateIds);
    throwOnError(response.error, 'Abgewählte Skills konnten nicht deaktiviert werden');
  }
}

async function saveAvailabilitySection(
  supabase: any,
  employeeId: string,
  data: JsonRow,
  actorId: string,
) {
  const availability = safeObject(data.availability);
  const existingResponse = await supabase
    .from('opc_employee_availability_profiles')
    .select('*')
    .eq('employee_id', employeeId)
    .is('valid_until', null)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  throwOnError(existingResponse.error, 'Verfügbarkeitsprofil konnte nicht geladen werden');
  const existing = existingResponse.data as JsonRow | null;

  const payload = {
    employee_id: employeeId,
    availability_mode: cleanText(availability.availability_mode) || 'weekly_schedule',
    timezone: cleanText(availability.timezone) || 'Europe/Zurich',
    short_notice_available: asBoolean(availability.short_notice_available),
    minimum_notice_hours: asNumber(availability.minimum_notice_hours),
    weekend_available: asBoolean(availability.weekend_available),
    saturday_available: asBoolean(availability.saturday_available),
    sunday_available: asBoolean(availability.sunday_available),
    public_holiday_available: asBoolean(availability.public_holiday_available),
    night_work_available: asBoolean(availability.night_work_available),
    preferred_weekly_hours: asNumber(availability.preferred_weekly_hours),
    maximum_weekly_hours: asNumber(availability.maximum_weekly_hours),
    profile_status: cleanText(availability.profile_status) || 'active',
    notes: cleanText(availability.notes),
    updated_by: actorId,
    metadata: { ...safeObject(existing?.metadata), source: 'mitarbeiter-admin-editor' },
  };

  let profile: JsonRow;
  if (existing) {
    const response = await supabase
      .from('opc_employee_availability_profiles')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single();
    throwOnError(response.error, 'Verfügbarkeit konnte nicht aktualisiert werden');
    profile = response.data;
  } else {
    const response = await supabase
      .from('opc_employee_availability_profiles')
      .insert({ ...payload, valid_from: todayIsoDate(), created_by: actorId })
      .select('*')
      .single();
    throwOnError(response.error, 'Verfügbarkeit konnte nicht angelegt werden');
    profile = response.data;
  }

  if (!Array.isArray(data.rules)) return;

  const deleteResponse = await supabase
    .from('opc_employee_availability_rules')
    .delete()
    .eq('availability_profile_id', profile.id);
  throwOnError(deleteResponse.error, 'Vorherige Wochenzeiten konnten nicht ersetzt werden');

  const rows = safeArray<JsonRow>(data.rules)
    .filter((rule) => asBoolean(rule.enabled, true))
    .map((rule) => ({
      availability_profile_id: profile.id,
      employee_id: employeeId,
      day_of_week: asNumber(rule.day_of_week),
      start_time: cleanText(rule.start_time) || '08:00',
      end_time: cleanText(rule.end_time) || '17:00',
      crosses_midnight: asBoolean(rule.crosses_midnight),
      availability_type: cleanText(rule.availability_type) || 'available',
      is_active: true,
      valid_from: todayIsoDate(),
      notes: cleanText(rule.notes),
      created_by: actorId,
      updated_by: actorId,
      metadata: { source: 'mitarbeiter-admin-editor' },
    }))
    .filter((row) => row.day_of_week !== null);

  if (rows.length) {
    const response = await supabase.from('opc_employee_availability_rules').insert(rows);
    throwOnError(response.error, 'Wochenzeiten konnten nicht gespeichert werden');
  }
}

async function saveEmergencySection(
  supabase: any,
  employeeId: string,
  data: JsonRow,
  actorId: string,
) {
  const existingResponse = await supabase
    .from('opc_employee_emergency_contacts')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('is_primary', true)
    .limit(1)
    .maybeSingle();
  throwOnError(existingResponse.error, 'Notfallkontakt konnte nicht geladen werden');
  const existing = existingResponse.data as JsonRow | null;

  const fullName = cleanText(data.full_name);
  const phoneRaw = cleanText(data.phone_raw);
  if (asBoolean(data.clear) || (!fullName && !phoneRaw && !cleanText(data.email))) {
    if (!existing) return;
    const response = await supabase.from('opc_employee_emergency_contacts').delete().eq('id', existing.id);
    throwOnError(response.error, 'Notfallkontakt konnte nicht entfernt werden');
    return;
  }

  const payload = {
    employee_id: employeeId,
    full_name: fullName,
    relationship_label: cleanText(data.relationship_label),
    phone_raw: phoneRaw,
    phone_e164: normalizePhone(phoneRaw),
    email: normalizeEmail(data.email),
    preferred_language: cleanText(data.preferred_language) || 'de-CH',
    is_primary: true,
    notes: cleanText(data.notes),
    updated_by: actorId,
    metadata: { ...safeObject(existing?.metadata), source: 'mitarbeiter-admin-editor' },
  };

  const response = existing
    ? await supabase.from('opc_employee_emergency_contacts').update(payload).eq('id', existing.id)
    : await supabase.from('opc_employee_emergency_contacts').insert({ ...payload, created_by: actorId });
  throwOnError(response.error, 'Notfallkontakt konnte nicht gespeichert werden');
}

async function saveNoteSection(
  supabase: any,
  employeeId: string,
  data: JsonRow,
  actorId: string,
  isOwner: boolean,
) {
  const text = cleanText(data.note_text);
  if (!text) throw new Error('Die Notiz darf nicht leer sein.');
  const requestedVisibility = cleanText(data.visibility_scope);
  const response = await supabase.from('opc_employee_notes').insert({
    employee_id: employeeId,
    note_type: cleanText(data.note_type) || 'general',
    title: cleanText(data.title),
    note_text: text,
    visibility_scope: isOwner && requestedVisibility === 'owners_only' ? 'owners_only' : 'hr_admins',
    is_pinned: asBoolean(data.is_pinned),
    status: 'active',
    created_by: actorId,
    updated_by: actorId,
    metadata: { source: 'mitarbeiter-admin-editor' },
  });
  throwOnError(response.error, 'Notiz konnte nicht gespeichert werden');
}

async function resolveStaffRole(supabase: any, employee: JsonRow) {
  if (employee.staff_role_id) {
    const response = await supabase
      .from('opc_staff_roles')
      .select('*')
      .eq('id', employee.staff_role_id)
      .maybeSingle();
    throwOnError(response.error, 'Portalrolle konnte nicht geladen werden');
    if (response.data) return response.data as JsonRow;
  }

  if (employee.user_id) {
    const response = await supabase
      .from('opc_staff_roles')
      .select('*')
      .eq('user_id', employee.user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    throwOnError(response.error, 'Portalrolle konnte nicht über User-ID geladen werden');
    if (response.data) return response.data as JsonRow;
  }

  const email = normalizeEmail(employee.business_email || employee.private_email);
  if (email) {
    const response = await supabase
      .from('opc_staff_roles')
      .select('*')
      .ilike('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    throwOnError(response.error, 'Portalrolle konnte nicht über E-Mail geladen werden');
    if (response.data) return response.data as JsonRow;
  }

  return null;
}

async function savePortalAccessSection(
  supabase: any,
  employee: JsonRow,
  data: JsonRow,
  actorId: string,
) {
  const targetRole = normalizeRole(data.role);
  if (!['owner', 'admin', 'dispatch', 'employee'].includes(targetRole)) {
    throw new Error('Ungültige Portalrolle.');
  }

  const staff = await resolveStaffRole(supabase, employee);
  if (!staff) throw new Error('Für diesen Mitarbeiter existiert noch keine Portalrolle.');

  if (String(staff.user_id || '') === actorId && targetRole !== 'owner') {
    throw new Error('Der eigene Owner-Zugang kann hier nicht herabgestuft werden.');
  }

  if (normalizeRole(staff.role) === 'owner' && targetRole !== 'owner') {
    const ownersResponse = await supabase
      .from('opc_staff_roles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'owner')
      .in('status', ['active', 'aktiv', 'enabled'])
      .eq('can_access_portal', true);
    throwOnError(ownersResponse.error, 'Owner-Anzahl konnte nicht geprüft werden');
    if (Number(ownersResponse.count || 0) <= 1) {
      throw new Error('Der letzte aktive Owner kann nicht herabgestuft werden.');
    }
  }

  const ownerDefaults = targetRole === 'owner';
  const update: JsonRow = {
    role: targetRole,
    status: cleanText(data.status) || 'active',
    can_access_portal: hasOwn(data, 'can_access_portal') ? asBoolean(data.can_access_portal) : true,
    can_submit_time_logs: ownerDefaults ? true : asBoolean(data.can_submit_time_logs, staff.can_submit_time_logs !== false),
    can_view_all_jobs: ownerDefaults ? true : asBoolean(data.can_view_all_jobs, staff.can_view_all_jobs === true),
    can_manage_jobs: ownerDefaults ? true : asBoolean(data.can_manage_jobs, staff.can_manage_jobs === true),
    can_manage_employees: ownerDefaults ? true : asBoolean(data.can_manage_employees, staff.can_manage_employees === true),
    can_manage_reports: ownerDefaults ? true : asBoolean(data.can_manage_reports, staff.can_manage_reports === true),
    can_manage_finance: ownerDefaults ? true : asBoolean(data.can_manage_finance, staff.can_manage_finance === true),
    updated_at: new Date().toISOString(),
  };

  const response = await supabase
    .from('opc_staff_roles')
    .update(update)
    .eq('id', staff.id);
  throwOnError(response.error, 'Portalrechte konnten nicht gespeichert werden');

  if (String(employee.staff_role_id || '') !== String(staff.id)) {
    const employeeResponse = await supabase
      .from('opc_employees')
      .update({ staff_role_id: staff.id, updated_by: actorId })
      .eq('id', employee.id);
    throwOnError(employeeResponse.error, 'Portalrolle konnte nicht mit der Personalakte verknüpft werden');
  }

  if (staff.user_id) {
    const profileResponse = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', staff.user_id)
      .maybeSingle();

    if (!profileResponse.error && profileResponse.data) {
      const legacyRole = targetRole === 'owner' ? 'owner' : targetRole === 'admin' ? 'admin' : 'client';
      const profileUpdate: JsonRow = { role: legacyRole };
      if ('is_owner' in profileResponse.data) profileUpdate.is_owner = targetRole === 'owner';
      if ('is_admin' in profileResponse.data) profileUpdate.is_admin = targetRole === 'admin';
      const syncResponse = await supabase
        .from('user_profiles')
        .update(profileUpdate)
        .eq('id', staff.user_id);
      throwOnError(syncResponse.error, 'Legacy-Profilrolle konnte nicht synchronisiert werden');
    }
  }
}

export const GET: APIRoute = async ({ request, locals, cookies, params }) => {
  try {
    const employeeId = cleanText(params.id);
    if (!employeeId) return jsonResponse({ success: false, error: 'Keine Mitarbeiter-ID vorhanden.' }, 400);

    const { supabase, access } = await requireEmployeeHrAccess({ request, locals, cookies });
    const employee = await loadEmployee(supabase, employeeId);
    const staffRole = await resolveStaffRole(supabase, employee);

    return jsonResponse({
      success: true,
      role: access.role,
      staff_role: staffRole,
    });
  } catch (error: any) {
    console.error('[opc/employees/admin-profile] GET failed', error);
    return jsonResponse(
      { success: false, error: error?.message || 'Portalrolle konnte nicht geladen werden.' },
      errorStatus(error),
    );
  }
};

export const PATCH: APIRoute = async ({ request, locals, cookies, params }) => {
  try {
    const employeeId = cleanText(params.id);
    if (!employeeId) return jsonResponse({ success: false, error: 'Keine Mitarbeiter-ID vorhanden.' }, 400);

    const { supabase, access } = await requireEmployeeHrAccess({ request, locals, cookies });
    const body = safeObject(await request.json());
    const section = cleanText(body.section) as Section | null;
    const data = safeObject(body.data);
    const allowed: Section[] = [
      'employee',
      'address',
      'nationality',
      'permit',
      'bank_account',
      'qualification',
      'availability',
      'skills',
      'emergency_contact',
      'note',
      'portal_access',
    ];

    if (!section || !allowed.includes(section)) {
      return jsonResponse({ success: false, error: 'Ungültiger Bearbeitungsbereich.' }, 400);
    }

    const employee = await loadEmployee(supabase, employeeId);

    if (section === 'portal_access') {
      if (!access.isOwner) {
        return jsonResponse({ success: false, error: 'Nur Owner dürfen Portalrollen und Berechtigungen ändern.' }, 403);
      }
      await savePortalAccessSection(supabase, employee, data, access.user.id);
    } else if (section === 'employee') {
      await saveEmployeeSection(supabase, employee, data, access.user.id);
    } else if (section === 'address') {
      await saveAddressSection(supabase, employeeId, data, access.user.id);
    } else if (section === 'nationality') {
      await saveNationalitySection(supabase, employeeId, data, access.user.id);
    } else if (section === 'permit') {
      await savePermitSection(supabase, employeeId, data, access.user.id);
    } else if (section === 'bank_account') {
      await saveBankSection(supabase, employee, data, access.user.id);
    } else if (section === 'qualification') {
      await saveQualificationSection(supabase, employeeId, data, access.user.id);
    } else if (section === 'skills') {
      await saveSkillsSection(supabase, employeeId, data, access.user.id);
    } else if (section === 'availability') {
      await saveAvailabilitySection(supabase, employeeId, data, access.user.id);
    } else if (section === 'emergency_contact') {
      await saveEmergencySection(supabase, employeeId, data, access.user.id);
    } else if (section === 'note') {
      await saveNoteSection(supabase, employeeId, data, access.user.id, access.isOwner);
    }

    return jsonResponse({ success: true, section });
  } catch (error: any) {
    console.error('[opc/employees/admin-profile] PATCH failed', error);
    const message = String(error?.message || 'Mitarbeiterdaten konnten nicht gespeichert werden.');
    const status = /nicht gefunden/i.test(message)
      ? 404
      : /erforderlich|ungültig|darf nicht|letzte aktive|letzten aktiven/i.test(message)
        ? 400
        : errorStatus(error);
    return jsonResponse({ success: false, error: message }, status);
  }
};
