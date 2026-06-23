import type { APIRoute } from 'astro';
import {
  EMPLOYEE_DOCUMENT_BUCKET,
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
} from '../../../../lib/opc-employee-api';

export const prerender = false;

type JsonRow = Record<string, any>;

function currentRow<T extends JsonRow>(rows: T[]) {
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

function sameValue(a: unknown, b: unknown) {
  return String(a ?? '').trim() === String(b ?? '').trim();
}

function rowsDiffer(existing: JsonRow | null, next: JsonRow, keys: string[]) {
  if (!existing) return true;
  return keys.some((key) => !sameValue(existing[key], next[key]));
}

async function closeHistoricalRow(supabase: any, table: string, row: JsonRow) {
  const today = todayIsoDate();
  if (String(row.valid_from || '') >= today) {
    return false;
  }

  const updatePayload: Record<string, unknown> = {
    valid_until: yesterdayIsoDate(),
    updated_at: new Date().toISOString(),
  };

  if ('is_primary' in row) {
    updatePayload.is_primary = false;
  }

  const response = await supabase
    .from(table)
    .update(updatePayload)
    .eq('id', row.id);

  throwOnError(response.error, `${table} konnte nicht historisiert werden`);
  return true;
}

async function signedDocuments(supabase: any, documents: JsonRow[]) {
  return Promise.all(
    documents.map(async (document) => {
      const bucket = document.storage_bucket || EMPLOYEE_DOCUMENT_BUCKET;
      const path = document.storage_path;
      if (!path) return { ...document, signed_url: null };

      const result = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
      return {
        ...document,
        signed_url: result.error ? null : result.data?.signedUrl || null,
      };
    }),
  );
}

async function loadEmployeeDetail({
  supabase,
  employeeId,
  isOwner,
}: {
  supabase: any;
  employeeId: string;
  isOwner: boolean;
}) {
  const employeeResponse = await supabase
    .from('opc_employees')
    .select('*')
    .eq('id', employeeId)
    .maybeSingle();
  throwOnError(employeeResponse.error, 'Mitarbeiter konnte nicht geladen werden');

  const employee = employeeResponse.data;
  if (!employee) return null;

  const [
    staffResponse,
    entityResponse,
    addressResponse,
    nationalityResponse,
    permitResponse,
    bankResponse,
    qualificationResponse,
    skillResponse,
    skillCatalogResponse,
    availabilityProfileResponse,
    availabilityRuleResponse,
    availabilityExceptionResponse,
    noteResponse,
    emergencyResponse,
    familyResponse,
    documentResponse,
    positionResponse,
    entityOptionsResponse,
    contractResponse,
    classificationResponse,
  ] = await Promise.all([
    employee.staff_role_id
      ? supabase.from('opc_staff_roles').select('*').eq('id', employee.staff_role_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    employee.employing_entity_id
      ? supabase
          .from('opc_legal_entities')
          .select('*')
          .eq('id', employee.employing_entity_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('opc_employee_addresses')
      .select('*')
      .eq('employee_id', employeeId)
      .order('valid_from', { ascending: false }),
    supabase
      .from('opc_employee_nationalities')
      .select('*')
      .eq('employee_id', employeeId)
      .order('valid_from', { ascending: false }),
    supabase
      .from('opc_employee_permits')
      .select('*')
      .eq('employee_id', employeeId)
      .order('valid_from', { ascending: false }),
    supabase
      .from('opc_employee_bank_accounts')
      .select('*')
      .eq('employee_id', employeeId)
      .order('valid_from', { ascending: false }),
    supabase
      .from('opc_employee_qualifications')
      .select('*')
      .eq('employee_id', employeeId)
      .order('is_primary', { ascending: false })
      .order('completed_on', { ascending: false }),
    supabase
      .from('opc_employee_skills')
      .select('*')
      .eq('employee_id', employeeId)
      .order('is_preferred', { ascending: false }),
    supabase
      .from('opc_employee_skill_catalog')
      .select('*')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('opc_employee_availability_profiles')
      .select('*')
      .eq('employee_id', employeeId)
      .order('valid_from', { ascending: false }),
    supabase
      .from('opc_employee_availability_rules')
      .select('*')
      .eq('employee_id', employeeId)
      .order('day_of_week'),
    supabase
      .from('opc_employee_availability_exceptions')
      .select('*')
      .eq('employee_id', employeeId)
      .order('starts_at', { ascending: false })
      .limit(100),
    supabase
      .from('opc_employee_notes')
      .select('*')
      .eq('employee_id', employeeId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('opc_employee_emergency_contacts')
      .select('*')
      .eq('employee_id', employeeId)
      .order('is_primary', { ascending: false }),
    supabase
      .from('opc_employee_family_members')
      .select('*')
      .eq('employee_id', employeeId)
      .order('date_of_birth', { ascending: true }),
    supabase
      .from('opc_employee_documents')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false }),
    supabase.from('opc_positions').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('opc_legal_entities').select('*').eq('status', 'active').order('legal_name'),
    isOwner
      ? supabase
          .from('opc_employment_contracts')
          .select('*')
          .eq('employee_id', employeeId)
          .order('valid_from', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    isOwner
      ? supabase
          .from('opc_contract_pay_classifications')
          .select('*')
          .eq('employee_id', employeeId)
          .order('valid_from', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const allResponses = [
    addressResponse,
    nationalityResponse,
    permitResponse,
    bankResponse,
    qualificationResponse,
    skillResponse,
    skillCatalogResponse,
    availabilityProfileResponse,
    availabilityRuleResponse,
    availabilityExceptionResponse,
    noteResponse,
    emergencyResponse,
    familyResponse,
    documentResponse,
    positionResponse,
    entityOptionsResponse,
    contractResponse,
    classificationResponse,
  ];

  for (const response of allResponses) {
    throwOnError(response.error, 'Mitarbeiterdetail konnte nicht vollständig geladen werden');
  }

  const documents = await signedDocuments(supabase, documentResponse.data || []);
  const catalogById = new Map<string, JsonRow>(
    (skillCatalogResponse.data || []).map(
      (row: JsonRow): [string, JsonRow] => [String(row.id), row],
    ),
  );
  const skills = (skillResponse.data || []).map((row: JsonRow) => ({
    ...row,
    catalog: catalogById.get(String(row.skill_id)) || null,
  }));
  const metadata = safeObject(employee.metadata);
  const positions = positionResponse.data || [];
  const positionById = new Map<string, JsonRow>(
    positions.map((row: JsonRow): [string, JsonRow] => [String(row.id), row]),
  );
  const contracts = contractResponse.data || [];
  const activeContract = currentRow(
    contracts.filter((row: JsonRow) => row.status !== 'cancelled'),
  );
  const operationalPositionId =
    cleanText(metadata.operational_position_id) || cleanText(activeContract?.position_id);
  const operationalPosition = operationalPositionId
    ? positionById.get(String(operationalPositionId)) || null
    : null;

  return {
    employee,
    staff_role: staffResponse.data || null,
    legal_entity: entityResponse.data || null,
    current_address: currentRow(addressResponse.data || []),
    addresses: addressResponse.data || [],
    current_nationality: currentRow(nationalityResponse.data || []),
    nationalities: nationalityResponse.data || [],
    current_permit: currentRow(permitResponse.data || []),
    permits: permitResponse.data || [],
    current_bank_account: currentRow(
      (bankResponse.data || []).filter((row: JsonRow) => row.account_status !== 'closed'),
    ),
    bank_accounts: bankResponse.data || [],
    primary_qualification:
      (qualificationResponse.data || []).find((row: JsonRow) => row.is_primary) ||
      qualificationResponse.data?.[0] ||
      null,
    qualifications: qualificationResponse.data || [],
    skills,
    skill_catalog: skillCatalogResponse.data || [],
    availability_profile: currentRow(availabilityProfileResponse.data || []),
    availability_profiles: availabilityProfileResponse.data || [],
    availability_rules: availabilityRuleResponse.data || [],
    availability_exceptions: availabilityExceptionResponse.data || [],
    notes: (noteResponse.data || []).filter(
      (row: JsonRow) => isOwner || row.visibility_scope !== 'owners_only',
    ),
    emergency_contacts: emergencyResponse.data || [],
    family_members: familyResponse.data || [],
    documents: documents.filter(
      (row: JsonRow) => isOwner || row.access_scope !== 'payroll_owner',
    ),
    positions,
    entities: entityOptionsResponse.data || [],
    operational_position: operationalPosition,
    contracts: isOwner ? contracts : [],
    classifications: isOwner ? classificationResponse.data || [] : [],
  };
}

async function upsertAddress({
  supabase,
  employeeId,
  address,
  actorId,
}: {
  supabase: any;
  employeeId: string;
  address: JsonRow;
  actorId: string;
}) {
  if (!cleanText(address.street) || !cleanText(address.postal_code) || !cleanText(address.city)) {
    return;
  }

  const existingResponse = await supabase
    .from('opc_employee_addresses')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('address_type', 'residence')
    .is('valid_until', null)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  throwOnError(existingResponse.error, 'Bestehende Adresse konnte nicht geprüft werden');

  const payload = {
    employee_id: employeeId,
    address_type: 'residence',
    residence_kind: cleanText(address.residence_kind) || 'main_residence',
    street: cleanText(address.street),
    house_number: cleanText(address.house_number),
    address_addition: cleanText(address.address_addition),
    postal_code: cleanText(address.postal_code),
    city: cleanText(address.city),
    state_region: cleanText(address.state_region),
    canton_code: cleanUpperCode(address.canton_code, 2),
    municipality: cleanText(address.municipality),
    country_code: cleanUpperCode(address.country_code, 2) || 'CH',
    is_primary: true,
    tax_relevant: asBoolean(address.tax_relevant, true),
    valid_from: cleanText(address.valid_from) || todayIsoDate(),
    updated_by: actorId,
    metadata: { ...safeObject(existingResponse.data?.metadata), source: 'mitarbeiter-detail' },
  };

  const keys = [
    'residence_kind',
    'street',
    'house_number',
    'address_addition',
    'postal_code',
    'city',
    'state_region',
    'canton_code',
    'municipality',
    'country_code',
  ];

  if (!existingResponse.data) {
    const response = await supabase.from('opc_employee_addresses').insert({
      ...payload,
      created_by: actorId,
    });
    throwOnError(response.error, 'Adresse konnte nicht angelegt werden');
    return;
  }

  if (!rowsDiffer(existingResponse.data, payload, keys)) {
    const response = await supabase
      .from('opc_employee_addresses')
      .update(payload)
      .eq('id', existingResponse.data.id);
    throwOnError(response.error, 'Adresse konnte nicht aktualisiert werden');
    return;
  }

  const closed = await closeHistoricalRow(
    supabase,
    'opc_employee_addresses',
    existingResponse.data,
  );

  if (!closed) {
    const response = await supabase
      .from('opc_employee_addresses')
      .update(payload)
      .eq('id', existingResponse.data.id);
    throwOnError(response.error, 'Adresse konnte nicht aktualisiert werden');
    return;
  }

  const response = await supabase.from('opc_employee_addresses').insert({
    ...payload,
    valid_from: todayIsoDate(),
    created_by: actorId,
  });
  throwOnError(response.error, 'Neue Adresse konnte nicht angelegt werden');
}

async function upsertNationality({
  supabase,
  employeeId,
  nationality,
  actorId,
}: {
  supabase: any;
  employeeId: string;
  nationality: JsonRow;
  actorId: string;
}) {
  const countryCode = cleanUpperCode(nationality.country_code, 2);
  if (!countryCode) return;

  const existingResponse = await supabase
    .from('opc_employee_nationalities')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('is_primary', true)
    .is('valid_until', null)
    .limit(1)
    .maybeSingle();
  throwOnError(existingResponse.error, 'Nationalität konnte nicht geprüft werden');

  if (existingResponse.data && sameValue(existingResponse.data.country_code, countryCode)) {
    return;
  }

  if (existingResponse.data) {
    const closed = await closeHistoricalRow(
      supabase,
      'opc_employee_nationalities',
      existingResponse.data,
    );
    if (!closed) {
      const response = await supabase
        .from('opc_employee_nationalities')
        .update({ country_code: countryCode, updated_by: actorId })
        .eq('id', existingResponse.data.id);
      throwOnError(response.error, 'Nationalität konnte nicht aktualisiert werden');
      return;
    }
  }

  const response = await supabase.from('opc_employee_nationalities').insert({
    employee_id: employeeId,
    country_code: countryCode,
    is_primary: true,
    valid_from: todayIsoDate(),
    created_by: actorId,
    updated_by: actorId,
    metadata: { source: 'mitarbeiter-detail' },
  });
  throwOnError(response.error, 'Nationalität konnte nicht angelegt werden');
}

async function upsertPermit({
  supabase,
  employeeId,
  permit,
  actorId,
}: {
  supabase: any;
  employeeId: string;
  permit: JsonRow;
  actorId: string;
}) {
  const permitType = cleanText(permit.permit_type);
  if (!permitType) return;

  const existingResponse = await supabase
    .from('opc_employee_permits')
    .select('*')
    .eq('employee_id', employeeId)
    .is('valid_until', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  throwOnError(existingResponse.error, 'Bewilligung konnte nicht geprüft werden');

  const payload = {
    employee_id: employeeId,
    permit_type: permitType,
    permit_number: cleanText(permit.permit_number),
    permit_status: cleanText(permit.permit_status) || 'valid',
    issuing_country_code: cleanUpperCode(permit.issuing_country_code, 2) || 'CH',
    issuing_canton_code: cleanUpperCode(permit.issuing_canton_code, 2),
    is_cross_border_permit: asBoolean(permit.is_cross_border_permit, permitType === 'g'),
    valid_from: cleanText(permit.valid_from),
    valid_until: cleanText(permit.valid_until),
    verification_status: cleanText(permit.verification_status) || 'unverified',
    notes: cleanText(permit.notes),
    updated_by: actorId,
    metadata: { ...safeObject(existingResponse.data?.metadata), source: 'mitarbeiter-detail' },
  };

  if (!existingResponse.data) {
    const response = await supabase.from('opc_employee_permits').insert({
      ...payload,
      created_by: actorId,
    });
    throwOnError(response.error, 'Bewilligung konnte nicht angelegt werden');
    return;
  }

  const response = await supabase
    .from('opc_employee_permits')
    .update(payload)
    .eq('id', existingResponse.data.id);
  throwOnError(response.error, 'Bewilligung konnte nicht aktualisiert werden');
}

async function upsertBankAccount({
  supabase,
  employee,
  bank,
  actorId,
}: {
  supabase: any;
  employee: JsonRow;
  bank: JsonRow;
  actorId: string;
}) {
  const iban = cleanText(bank.iban)?.replace(/\s+/g, '').toUpperCase() || null;
  if (!iban) return;

  const existingResponse = await supabase
    .from('opc_employee_bank_accounts')
    .select('*')
    .eq('employee_id', employee.id)
    .eq('is_primary', true)
    .is('valid_until', null)
    .limit(1)
    .maybeSingle();
  throwOnError(existingResponse.error, 'Bankkonto konnte nicht geprüft werden');

  const payload = {
    employee_id: employee.id,
    bank_name: cleanText(bank.bank_name) || 'Nicht angegeben',
    bank_address_line1: cleanText(bank.bank_address_line1),
    bank_address_line2: cleanText(bank.bank_address_line2),
    bank_postal_code: cleanText(bank.bank_postal_code),
    bank_city: cleanText(bank.bank_city),
    bank_country_code: cleanUpperCode(bank.bank_country_code, 2) || 'CH',
    iban,
    bic: cleanText(bank.bic)?.toUpperCase() || null,
    account_holder:
      cleanText(bank.account_holder) ||
      [employee.legal_first_name, employee.legal_last_name].filter(Boolean).join(' '),
    currency_code: cleanUpperCode(bank.currency_code, 3) || 'CHF',
    account_status: cleanText(bank.account_status) || 'active',
    is_primary: true,
    valid_from: cleanText(bank.valid_from) || todayIsoDate(),
    verification_status: cleanText(bank.verification_status) || 'unverified',
    notes: cleanText(bank.notes),
    updated_by: actorId,
    metadata: { ...safeObject(existingResponse.data?.metadata), source: 'mitarbeiter-detail' },
  };

  if (!existingResponse.data) {
    const response = await supabase.from('opc_employee_bank_accounts').insert({
      ...payload,
      created_by: actorId,
    });
    throwOnError(response.error, 'Bankkonto konnte nicht angelegt werden');
    return;
  }

  if (sameValue(existingResponse.data.iban, iban)) {
    const response = await supabase
      .from('opc_employee_bank_accounts')
      .update(payload)
      .eq('id', existingResponse.data.id);
    throwOnError(response.error, 'Bankkonto konnte nicht aktualisiert werden');
    return;
  }

  const response = await supabase
    .from('opc_employee_bank_accounts')
    .update({
      valid_until: yesterdayIsoDate(),
      is_primary: false,
      account_status: 'inactive',
      updated_by: actorId,
    })
    .eq('id', existingResponse.data.id);
  throwOnError(response.error, 'Altes Bankkonto konnte nicht historisiert werden');

  const insertResponse = await supabase.from('opc_employee_bank_accounts').insert({
    ...payload,
    valid_from: todayIsoDate(),
    created_by: actorId,
  });
  throwOnError(insertResponse.error, 'Neues Bankkonto konnte nicht angelegt werden');
}

async function upsertQualification({
  supabase,
  employeeId,
  qualification,
  actorId,
}: {
  supabase: any;
  employeeId: string;
  qualification: JsonRow;
  actorId: string;
}) {
  const level = cleanText(qualification.qualification_level_code);
  const title = cleanText(qualification.qualification_title);
  if (!level && !title) return;

  const existingResponse = await supabase
    .from('opc_employee_qualifications')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('is_primary', true)
    .limit(1)
    .maybeSingle();
  throwOnError(existingResponse.error, 'Qualifikation konnte nicht geprüft werden');

  const payload = {
    employee_id: employeeId,
    qualification_level_code: level || 'none',
    qualification_title: title || (level === 'none' ? 'Keine formelle Ausbildung' : 'Ausbildungsnachweis'),
    field_of_study: cleanText(qualification.field_of_study),
    occupation_code: cleanText(qualification.occupation_code),
    institution_name: cleanText(qualification.institution_name),
    country_code: cleanUpperCode(qualification.country_code, 2),
    completed_on: cleanText(qualification.completed_on),
    valid_until: cleanText(qualification.valid_until),
    swiss_recognition_status:
      cleanText(qualification.swiss_recognition_status) || 'not_required',
    recognition_authority: cleanText(qualification.recognition_authority),
    recognition_reference: cleanText(qualification.recognition_reference),
    relevant_for_cleaning_gav: asBoolean(qualification.relevant_for_cleaning_gav),
    relevant_for_current_position: asBoolean(
      qualification.relevant_for_current_position,
      true,
    ),
    is_primary: true,
    verification_status: cleanText(qualification.verification_status) || 'unverified',
    notes: cleanText(qualification.notes),
    updated_by: actorId,
    metadata: { ...safeObject(existingResponse.data?.metadata), source: 'mitarbeiter-detail' },
  };

  if (existingResponse.data) {
    const response = await supabase
      .from('opc_employee_qualifications')
      .update(payload)
      .eq('id', existingResponse.data.id);
    throwOnError(response.error, 'Qualifikation konnte nicht aktualisiert werden');
    return;
  }

  const response = await supabase.from('opc_employee_qualifications').insert({
    ...payload,
    created_by: actorId,
  });
  throwOnError(response.error, 'Qualifikation konnte nicht angelegt werden');
}

async function replaceSkills({
  supabase,
  employeeId,
  skills,
  actorId,
}: {
  supabase: any;
  employeeId: string;
  skills: JsonRow[];
  actorId: string;
}) {
  const selectedIds = skills.map((skill) => cleanText(skill.skill_id)).filter(Boolean) as string[];

  const existingResponse = await supabase
    .from('opc_employee_skills')
    .select('*')
    .eq('employee_id', employeeId);
  throwOnError(existingResponse.error, 'Bestehende Skills konnten nicht geladen werden');

  const existingBySkillId = new Map<string, JsonRow>(
    (existingResponse.data || []).map(
      (row: JsonRow): [string, JsonRow] => [String(row.skill_id), row],
    ),
  );

  for (const skill of skills) {
    const skillId = cleanText(skill.skill_id);
    if (!skillId) continue;

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
      metadata: { source: 'mitarbeiter-detail' },
    };

    const existing = existingBySkillId.get(skillId);
    const response = existing
      ? await supabase.from('opc_employee_skills').update(payload).eq('id', existing.id)
      : await supabase.from('opc_employee_skills').insert({ ...payload, created_by: actorId });
    throwOnError(response.error, 'Skill konnte nicht gespeichert werden');
  }

  const deselectedIds = (existingResponse.data || [])
    .filter((row: JsonRow) => !selectedIds.includes(String(row.skill_id)) && row.is_active !== false)
    .map((row: JsonRow) => row.id);

  if (deselectedIds.length) {
    const response = await supabase
      .from('opc_employee_skills')
      .update({ is_active: false, updated_by: actorId })
      .in('id', deselectedIds);
    throwOnError(response.error, 'Abgewählte Skills konnten nicht deaktiviert werden');
  }
}

async function upsertAvailability({
  supabase,
  employeeId,
  availability,
  rules,
  actorId,
}: {
  supabase: any;
  employeeId: string;
  availability: JsonRow;
  rules: JsonRow[];
  actorId: string;
}) {
  const existingResponse = await supabase
    .from('opc_employee_availability_profiles')
    .select('*')
    .eq('employee_id', employeeId)
    .is('valid_until', null)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  throwOnError(existingResponse.error, 'Verfügbarkeitsprofil konnte nicht geprüft werden');

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
    valid_from: cleanText(availability.valid_from) || todayIsoDate(),
    profile_status: cleanText(availability.profile_status) || 'active',
    notes: cleanText(availability.notes),
    updated_by: actorId,
    metadata: { ...safeObject(existingResponse.data?.metadata), source: 'mitarbeiter-detail' },
  };

  let profile: JsonRow;
  if (existingResponse.data) {
    const response = await supabase
      .from('opc_employee_availability_profiles')
      .update(payload)
      .eq('id', existingResponse.data.id)
      .select('*')
      .single();
    throwOnError(response.error, 'Verfügbarkeitsprofil konnte nicht aktualisiert werden');
    profile = response.data;
  } else {
    const response = await supabase
      .from('opc_employee_availability_profiles')
      .insert({ ...payload, created_by: actorId })
      .select('*')
      .single();
    throwOnError(response.error, 'Verfügbarkeitsprofil konnte nicht angelegt werden');
    profile = response.data;
  }

  const deleteResponse = await supabase
    .from('opc_employee_availability_rules')
    .delete()
    .eq('availability_profile_id', profile.id);
  throwOnError(deleteResponse.error, 'Alte Verfügbarkeitszeiten konnten nicht ersetzt werden');

  const insertRows = rules
    .filter((rule) => asBoolean(rule.enabled, true))
    .filter((rule) => asNumber(rule.day_of_week) !== null)
    .map((rule) => ({
      availability_profile_id: profile.id,
      employee_id: employeeId,
      day_of_week: asNumber(rule.day_of_week),
      start_time: cleanText(rule.start_time) || '08:00',
      end_time: cleanText(rule.end_time) || '17:00',
      crosses_midnight: asBoolean(rule.crosses_midnight),
      availability_type: cleanText(rule.availability_type) || 'available',
      is_active: true,
      notes: cleanText(rule.notes),
      valid_from: cleanText(rule.valid_from) || todayIsoDate(),
      created_by: actorId,
      updated_by: actorId,
      metadata: { source: 'mitarbeiter-detail' },
    }));

  if (insertRows.length) {
    const response = await supabase.from('opc_employee_availability_rules').insert(insertRows);
    throwOnError(response.error, 'Verfügbarkeitszeiten konnten nicht gespeichert werden');
  }
}

async function upsertEmergencyContact({
  supabase,
  employeeId,
  emergency,
  actorId,
}: {
  supabase: any;
  employeeId: string;
  emergency: JsonRow;
  actorId: string;
}) {
  if (!cleanText(emergency.full_name) || !cleanText(emergency.phone_raw)) return;

  const existingResponse = await supabase
    .from('opc_employee_emergency_contacts')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('is_primary', true)
    .limit(1)
    .maybeSingle();
  throwOnError(existingResponse.error, 'Notfallkontakt konnte nicht geprüft werden');

  const payload = {
    employee_id: employeeId,
    full_name: cleanText(emergency.full_name),
    relationship_label: cleanText(emergency.relationship_label),
    phone_raw: cleanText(emergency.phone_raw),
    phone_e164: normalizePhone(emergency.phone_e164 || emergency.phone_raw),
    email: normalizeEmail(emergency.email),
    preferred_language: cleanText(emergency.preferred_language),
    is_primary: true,
    notes: cleanText(emergency.notes),
    updated_by: actorId,
    metadata: { ...safeObject(existingResponse.data?.metadata), source: 'mitarbeiter-detail' },
  };

  const response = existingResponse.data
    ? await supabase
        .from('opc_employee_emergency_contacts')
        .update(payload)
        .eq('id', existingResponse.data.id)
    : await supabase
        .from('opc_employee_emergency_contacts')
        .insert({ ...payload, created_by: actorId });
  throwOnError(response.error, 'Notfallkontakt konnte nicht gespeichert werden');
}

export const GET: APIRoute = async ({ request, locals, cookies, params }) => {
  try {
    const employeeId = cleanText(params.id);
    if (!employeeId) {
      return jsonResponse({ success: false, error: 'Keine Mitarbeiter-ID vorhanden.' }, 400);
    }

    const { supabase, access } = await requireEmployeeHrAccess({ request, locals, cookies });
    const detail = await loadEmployeeDetail({
      supabase,
      employeeId,
      isOwner: access.isOwner,
    });

    if (!detail) {
      return jsonResponse({ success: false, error: 'Mitarbeiter wurde nicht gefunden.' }, 404);
    }

    return jsonResponse({
      success: true,
      role: access.role,
      canManagePayroll: access.canManagePayroll,
      detail,
    });
  } catch (error: any) {
    console.error('[opc/employees/id] GET failed', error);
    return jsonResponse(
      { success: false, error: error?.message || 'Mitarbeiter konnte nicht geladen werden.' },
      errorStatus(error),
    );
  }
};

export const PATCH: APIRoute = async ({ request, locals, cookies, params }) => {
  try {
    const employeeId = cleanText(params.id);
    if (!employeeId) {
      return jsonResponse({ success: false, error: 'Keine Mitarbeiter-ID vorhanden.' }, 400);
    }

    const { supabase, access } = await requireEmployeeHrAccess({ request, locals, cookies });
    const body = safeObject(await request.json());

    const employeeResponse = await supabase
      .from('opc_employees')
      .select('*')
      .eq('id', employeeId)
      .maybeSingle();
    throwOnError(employeeResponse.error, 'Mitarbeiter konnte nicht geprüft werden');

    const employee = employeeResponse.data;
    if (!employee) {
      return jsonResponse({ success: false, error: 'Mitarbeiter wurde nicht gefunden.' }, 404);
    }

    const firstName = cleanText(body.legal_first_name) || employee.legal_first_name;
    const lastName = cleanText(body.legal_last_name) || employee.legal_last_name;
    if (!firstName || !lastName) {
      return jsonResponse({ success: false, error: 'Vorname und Nachname sind erforderlich.' }, 400);
    }

    let position: JsonRow | null = null;
    const positionId = cleanText(body.operational_position_id);
    if (positionId) {
      const response = await supabase
        .from('opc_positions')
        .select('*')
        .eq('id', positionId)
        .maybeSingle();
      throwOnError(response.error, 'Position konnte nicht geladen werden');
      position = response.data;
    }

    const metadata = {
      ...safeObject(employee.metadata),
      ...safeObject(body.metadata),
      operational_position_id: position?.id || null,
      operational_position_code: position?.position_code || null,
      operational_position_title: position?.title_de || null,
      last_updated_from: 'mitarbeiter-detail',
      last_updated_by_role: access.role,
    };

    const portalAccessOnly = asBoolean(body.portal_access_only, employee.portal_access_only);
    const payrollInScope = portalAccessOnly
      ? false
      : asBoolean(body.payroll_in_scope, employee.payroll_in_scope);

    const updateResponse = await supabase
      .from('opc_employees')
      .update({
        employing_entity_id: cleanText(body.employing_entity_id) || employee.employing_entity_id,
        legal_first_name: firstName,
        legal_last_name: lastName,
        preferred_name: cleanText(body.preferred_name),
        date_of_birth: cleanText(body.date_of_birth),
        gender_code: cleanText(body.gender_code),
        civil_status: cleanText(body.civil_status),
        birth_place: cleanText(body.birth_place),
        citizenship_place: cleanText(body.citizenship_place),
        ahv_number: cleanText(body.ahv_number),
        private_email: normalizeEmail(body.private_email),
        business_email: normalizeEmail(body.business_email),
        phone_raw: cleanText(body.phone_raw),
        phone_e164: normalizePhone(body.phone_e164 || body.phone_raw),
        fax_number: cleanText(body.fax_number),
        preferred_language: cleanText(body.preferred_language) || 'de-CH',
        us_tax_person: asBoolean(body.us_tax_person),
        status: cleanText(body.status) || employee.status,
        assignment_status: cleanText(body.assignment_status) || employee.assignment_status,
        profile_completion_status:
          cleanText(body.profile_completion_status) || employee.profile_completion_status,
        personnel_type: cleanText(body.personnel_type) || employee.personnel_type,
        payroll_in_scope: payrollInScope,
        portal_access_only: portalAccessOnly,
        payroll_exclusion_reason: payrollInScope
          ? null
          : cleanText(body.payroll_exclusion_reason) || employee.payroll_exclusion_reason,
        entry_date: cleanText(body.entry_date),
        exit_date: cleanText(body.exit_date),
        internal_notes: cleanText(body.internal_notes),
        onboarding_form_signed_at: cleanText(body.onboarding_form_signed_at),
        onboarding_source: cleanText(body.onboarding_source) || employee.onboarding_source,
        updated_by: access.user.id,
        metadata,
      })
      .eq('id', employeeId)
      .select('*')
      .single();
    throwOnError(updateResponse.error, 'Personalakte konnte nicht gespeichert werden');

    if (body.address) {
      await upsertAddress({
        supabase,
        employeeId,
        address: safeObject(body.address),
        actorId: access.user.id,
      });
    }

    if (body.nationality) {
      await upsertNationality({
        supabase,
        employeeId,
        nationality: safeObject(body.nationality),
        actorId: access.user.id,
      });
    }

    if (body.permit) {
      await upsertPermit({
        supabase,
        employeeId,
        permit: safeObject(body.permit),
        actorId: access.user.id,
      });
    }

    if (body.bank_account) {
      await upsertBankAccount({
        supabase,
        employee: updateResponse.data,
        bank: safeObject(body.bank_account),
        actorId: access.user.id,
      });
    }

    if (body.qualification) {
      await upsertQualification({
        supabase,
        employeeId,
        qualification: safeObject(body.qualification),
        actorId: access.user.id,
      });
    }

    if (Array.isArray(body.skills)) {
      await replaceSkills({
        supabase,
        employeeId,
        skills: safeArray<JsonRow>(body.skills),
        actorId: access.user.id,
      });
    }

    if (body.availability || Array.isArray(body.availability_rules)) {
      await upsertAvailability({
        supabase,
        employeeId,
        availability: safeObject(body.availability),
        rules: safeArray<JsonRow>(body.availability_rules),
        actorId: access.user.id,
      });
    }

    if (body.emergency_contact) {
      await upsertEmergencyContact({
        supabase,
        employeeId,
        emergency: safeObject(body.emergency_contact),
        actorId: access.user.id,
      });
    }

    const appendNote = cleanText(body.append_note);
    if (appendNote) {
      const visibility = cleanText(body.append_note_visibility);
      const noteResponse = await supabase.from('opc_employee_notes').insert({
        employee_id: employeeId,
        note_type: cleanText(body.append_note_type) || 'general',
        title: cleanText(body.append_note_title),
        note_text: appendNote,
        visibility_scope:
          access.isOwner && visibility === 'owners_only' ? 'owners_only' : 'hr_admins',
        is_pinned: asBoolean(body.append_note_pinned),
        status: 'active',
        created_by: access.user.id,
        updated_by: access.user.id,
        metadata: { source: 'mitarbeiter-detail' },
      });
      throwOnError(noteResponse.error, 'Notiz konnte nicht gespeichert werden');
    }

    const detail = await loadEmployeeDetail({
      supabase,
      employeeId,
      isOwner: access.isOwner,
    });

    return jsonResponse({
      success: true,
      message: 'Mitarbeiter wurde gespeichert.',
      detail,
    });
  } catch (error: any) {
    console.error('[opc/employees/id] PATCH failed', error);
    return jsonResponse(
      { success: false, error: error?.message || 'Mitarbeiter konnte nicht gespeichert werden.' },
      errorStatus(error),
    );
  }
};
