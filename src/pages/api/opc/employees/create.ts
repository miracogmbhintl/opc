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
  splitDisplayName,
  throwOnError,
  todayIsoDate,
} from '../../../../lib/opc-employee-api';

export const prerender = false;

type JsonRow = Record<string, any>;

function employeeName(body: JsonRow, staff: JsonRow | null) {
  const fallback = splitDisplayName(staff?.display_name || staff?.email || '');
  return {
    firstName: cleanText(body.legal_first_name) || fallback.firstName,
    lastName: cleanText(body.legal_last_name) || fallback.lastName,
  };
}

async function findDefaultEntity(supabase: any) {
  const preferred = await supabase
    .from('opc_legal_entities')
    .select('*')
    .eq('status', 'active')
    .eq('is_payroll_employer_for_opc', true)
    .limit(1)
    .maybeSingle();

  if (!preferred.error && preferred.data) return preferred.data;

  const fallback = await supabase
    .from('opc_legal_entities')
    .select('*')
    .eq('status', 'active')
    .order('is_opc_group_entity', { ascending: false })
    .limit(1)
    .maybeSingle();

  throwOnError(fallback.error, 'Kein Rechtsträger konnte geladen werden');
  return fallback.data;
}

async function insertOptionalRows({
  supabase,
  employee,
  body,
  access,
}: {
  supabase: any;
  employee: JsonRow;
  body: JsonRow;
  access: JsonRow;
}) {
  const employeeId = String(employee.id);
  const today = todayIsoDate();
  const address = safeObject(body.address);
  const nationality = safeObject(body.nationality);
  const permit = safeObject(body.permit);
  const bank = safeObject(body.bank_account);
  const qualification = safeObject(body.qualification);
  const availability = safeObject(body.availability);
  const emergency = safeObject(body.emergency_contact);
  const selectedSkills = safeArray<JsonRow>(body.skills);
  const availabilityRules = safeArray<JsonRow>(body.availability_rules);
  const initialNote = cleanText(body.initial_note);

  if (cleanText(address.street) && cleanText(address.postal_code) && cleanText(address.city)) {
    const response = await supabase.from('opc_employee_addresses').insert({
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
      tax_relevant: true,
      valid_from: cleanText(address.valid_from) || today,
      created_by: access.user.id,
      updated_by: access.user.id,
      metadata: { source: 'mitarbeiter-anlegen' },
    });
    throwOnError(response.error, 'Adresse konnte nicht gespeichert werden');
  }

  const nationalityCode = cleanUpperCode(nationality.country_code, 2);
  if (nationalityCode) {
    const response = await supabase.from('opc_employee_nationalities').insert({
      employee_id: employeeId,
      country_code: nationalityCode,
      is_primary: true,
      valid_from: cleanText(nationality.valid_from) || today,
      created_by: access.user.id,
      updated_by: access.user.id,
      metadata: { source: 'mitarbeiter-anlegen' },
    });
    throwOnError(response.error, 'Nationalität konnte nicht gespeichert werden');
  }

  const permitType = cleanText(permit.permit_type);
  if (permitType) {
    const response = await supabase.from('opc_employee_permits').insert({
      employee_id: employeeId,
      permit_type: permitType,
      permit_number: cleanText(permit.permit_number),
      permit_status: cleanText(permit.permit_status) || (permitType === 'pending' ? 'pending' : 'valid'),
      issuing_country_code: cleanUpperCode(permit.issuing_country_code, 2) || 'CH',
      issuing_canton_code: cleanUpperCode(permit.issuing_canton_code, 2),
      is_cross_border_permit: asBoolean(permit.is_cross_border_permit, permitType === 'g'),
      valid_from: cleanText(permit.valid_from),
      valid_until: cleanText(permit.valid_until),
      verification_status: cleanText(permit.verification_status) || 'unverified',
      notes: cleanText(permit.notes),
      created_by: access.user.id,
      updated_by: access.user.id,
      metadata: { source: 'mitarbeiter-anlegen' },
    });
    throwOnError(response.error, 'Bewilligung konnte nicht gespeichert werden');
  }

  const iban = cleanText(bank.iban)?.replace(/\s+/g, '').toUpperCase() || null;
  if (iban) {
    const response = await supabase.from('opc_employee_bank_accounts').insert({
      employee_id: employeeId,
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
      account_status: 'active',
      is_primary: true,
      valid_from: cleanText(bank.valid_from) || today,
      verification_status: cleanText(bank.verification_status) || 'unverified',
      notes: cleanText(bank.notes),
      created_by: access.user.id,
      updated_by: access.user.id,
      metadata: { source: 'mitarbeiter-anlegen' },
    });
    throwOnError(response.error, 'Bankkonto konnte nicht gespeichert werden');
  }

  const qualificationLevel = cleanText(qualification.qualification_level_code);
  const qualificationTitle = cleanText(qualification.qualification_title);
  if (qualificationLevel || qualificationTitle) {
    const response = await supabase.from('opc_employee_qualifications').insert({
      employee_id: employeeId,
      qualification_level_code: qualificationLevel || 'none',
      qualification_title:
        qualificationTitle ||
        (qualificationLevel === 'none' ? 'Keine formelle Ausbildung' : 'Ausbildungsnachweis'),
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
      created_by: access.user.id,
      updated_by: access.user.id,
      metadata: { source: 'mitarbeiter-anlegen' },
    });
    throwOnError(response.error, 'Qualifikation konnte nicht gespeichert werden');
  }

  if (selectedSkills.length) {
    const skillRows = selectedSkills
      .filter((skill) => cleanText(skill.skill_id))
      .map((skill) => ({
        employee_id: employeeId,
        skill_id: cleanText(skill.skill_id),
        proficiency_level: cleanText(skill.proficiency_level) || 'independent',
        is_willing: asBoolean(skill.is_willing, true),
        is_preferred: asBoolean(skill.is_preferred),
        can_work_independently: asBoolean(skill.can_work_independently, true),
        can_lead_team: asBoolean(skill.can_lead_team),
        years_experience: asNumber(skill.years_experience),
        notes: cleanText(skill.notes),
        is_active: true,
        created_by: access.user.id,
        updated_by: access.user.id,
        metadata: { source: 'mitarbeiter-anlegen' },
      }));

    const response = await supabase.from('opc_employee_skills').insert(skillRows);
    throwOnError(response.error, 'Skills konnten nicht gespeichert werden');
  }

  const availabilityResponse = await supabase
    .from('opc_employee_availability_profiles')
    .insert({
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
      valid_from: cleanText(availability.valid_from) || today,
      profile_status: 'active',
      notes: cleanText(availability.notes),
      created_by: access.user.id,
      updated_by: access.user.id,
      metadata: { source: 'mitarbeiter-anlegen' },
    })
    .select('*')
    .single();

  throwOnError(availabilityResponse.error, 'Verfügbarkeitsprofil konnte nicht gespeichert werden');

  if (availabilityRules.length && availabilityResponse.data?.id) {
    const ruleRows = availabilityRules
      .filter((rule) => asBoolean(rule.enabled, true))
      .filter((rule) => asNumber(rule.day_of_week) !== null)
      .map((rule) => ({
        availability_profile_id: availabilityResponse.data.id,
        employee_id: employeeId,
        day_of_week: asNumber(rule.day_of_week),
        start_time: cleanText(rule.start_time) || '08:00',
        end_time: cleanText(rule.end_time) || '17:00',
        crosses_midnight: asBoolean(rule.crosses_midnight),
        availability_type: cleanText(rule.availability_type) || 'available',
        is_active: true,
        notes: cleanText(rule.notes),
        valid_from: cleanText(rule.valid_from) || today,
        created_by: access.user.id,
        updated_by: access.user.id,
        metadata: { source: 'mitarbeiter-anlegen' },
      }));

    if (ruleRows.length) {
      const response = await supabase.from('opc_employee_availability_rules').insert(ruleRows);
      throwOnError(response.error, 'Verfügbarkeitszeiten konnten nicht gespeichert werden');
    }
  }

  if (cleanText(emergency.full_name) && cleanText(emergency.phone_raw)) {
    const response = await supabase.from('opc_employee_emergency_contacts').insert({
      employee_id: employeeId,
      full_name: cleanText(emergency.full_name),
      relationship_label: cleanText(emergency.relationship_label),
      phone_raw: cleanText(emergency.phone_raw),
      phone_e164: normalizePhone(emergency.phone_e164 || emergency.phone_raw),
      email: normalizeEmail(emergency.email),
      preferred_language: cleanText(emergency.preferred_language),
      is_primary: true,
      notes: cleanText(emergency.notes),
      created_by: access.user.id,
      updated_by: access.user.id,
      metadata: { source: 'mitarbeiter-anlegen' },
    });
    throwOnError(response.error, 'Notfallkontakt konnte nicht gespeichert werden');
  }

  if (initialNote) {
    const response = await supabase.from('opc_employee_notes').insert({
      employee_id: employeeId,
      note_type: cleanText(body.initial_note_type) || 'onboarding',
      title: cleanText(body.initial_note_title) || 'Erstaufnahme',
      note_text: initialNote,
      visibility_scope:
        access.isOwner && cleanText(body.initial_note_visibility) === 'owners_only'
          ? 'owners_only'
          : 'hr_admins',
      is_pinned: asBoolean(body.initial_note_pinned),
      status: 'active',
      created_by: access.user.id,
      updated_by: access.user.id,
      metadata: { source: 'mitarbeiter-anlegen' },
    });
    throwOnError(response.error, 'Notiz konnte nicht gespeichert werden');
  }
}

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  let createdEmployeeId: string | null = null;

  try {
    const { supabase, access } = await requireEmployeeHrAccess({ request, locals, cookies });
    const body = safeObject(await request.json());
    const staffRoleId = cleanText(body.staff_role_id);

    let staff: JsonRow | null = null;
    if (staffRoleId) {
      const staffResponse = await supabase
        .from('opc_staff_roles')
        .select('*')
        .eq('id', staffRoleId)
        .maybeSingle();
      throwOnError(staffResponse.error, 'Portalnutzer konnte nicht geladen werden');
      staff = staffResponse.data;

      if (!staff) {
        return jsonResponse({ success: false, error: 'Der ausgewählte Portalnutzer existiert nicht.' }, 400);
      }

      const existingResponse = await supabase
        .from('opc_employees')
        .select('id,employee_number')
        .eq('staff_role_id', staffRoleId)
        .maybeSingle();
      throwOnError(existingResponse.error, 'Personalaktenprüfung fehlgeschlagen');

      if (existingResponse.data) {
        return jsonResponse(
          {
            success: false,
            error: 'Für diesen Portalnutzer existiert bereits eine Personalakte.',
            employeeId: existingResponse.data.id,
          },
          409,
        );
      }
    }

    const name = employeeName(body, staff);
    if (!name.firstName || !name.lastName) {
      return jsonResponse(
        { success: false, error: 'Vorname und Nachname sind erforderlich.' },
        400,
      );
    }

    let entity: JsonRow | null = null;
    const requestedEntityId = cleanText(body.employing_entity_id);
    if (requestedEntityId) {
      const entityResponse = await supabase
        .from('opc_legal_entities')
        .select('*')
        .eq('id', requestedEntityId)
        .eq('status', 'active')
        .maybeSingle();
      throwOnError(entityResponse.error, 'Rechtsträger konnte nicht geladen werden');
      entity = entityResponse.data;
    } else {
      entity = await findDefaultEntity(supabase);
    }

    if (!entity) {
      return jsonResponse({ success: false, error: 'Bitte einen Rechtsträger auswählen.' }, 400);
    }

    const personnelType = cleanText(body.personnel_type) || 'employee';
    const externalTypes = new Set([
      'external_contractor',
      'external_infrastructure',
      'agency_worker',
      'temporary_external',
    ]);
    const portalAccessOnly = asBoolean(
      body.portal_access_only,
      personnelType === 'external_infrastructure',
    );
    const payrollInScope = portalAccessOnly
      ? false
      : asBoolean(body.payroll_in_scope, !externalTypes.has(personnelType));

    const positionId = cleanText(body.operational_position_id);
    let position: JsonRow | null = null;
    if (positionId) {
      const positionResponse = await supabase
        .from('opc_positions')
        .select('*')
        .eq('id', positionId)
        .eq('is_active', true)
        .maybeSingle();
      throwOnError(positionResponse.error, 'Position konnte nicht geladen werden');
      position = positionResponse.data;
    }

    const metadata = {
      ...safeObject(body.metadata),
      operational_position_id: position?.id || null,
      operational_position_code: position?.position_code || null,
      operational_position_title: position?.title_de || null,
      created_from: 'mitarbeiter-anlegen',
      created_by_role: access.role,
      source_staff_role_id: staff?.id || null,
    };

    const employeeResponse = await supabase
      .from('opc_employees')
      .insert({
        staff_role_id: staff?.id || null,
        user_id: staff?.user_id || null,
        employing_entity_id: entity.id,
        legal_first_name: name.firstName,
        legal_last_name: name.lastName,
        preferred_name: cleanText(body.preferred_name),
        date_of_birth: cleanText(body.date_of_birth),
        gender_code: cleanText(body.gender_code),
        civil_status: cleanText(body.civil_status),
        birth_place: cleanText(body.birth_place),
        citizenship_place: cleanText(body.citizenship_place),
        ahv_number: cleanText(body.ahv_number),
        private_email: normalizeEmail(body.private_email),
        business_email: normalizeEmail(body.business_email || staff?.email),
        phone_raw: cleanText(body.phone_raw || staff?.phone_raw),
        phone_e164: normalizePhone(body.phone_e164 || body.phone_raw || staff?.phone_e164),
        fax_number: cleanText(body.fax_number),
        preferred_language: cleanText(body.preferred_language) || 'de-CH',
        us_tax_person: asBoolean(body.us_tax_person),
        status: cleanText(body.status) || 'onboarding',
        assignment_status: cleanText(body.assignment_status) || 'available',
        profile_completion_status: cleanText(body.profile_completion_status) || 'incomplete',
        personnel_type: personnelType,
        payroll_in_scope: payrollInScope,
        portal_access_only: portalAccessOnly,
        payroll_exclusion_reason: payrollInScope
          ? null
          : cleanText(body.payroll_exclusion_reason) ||
            'Nicht Bestandteil der aktuellen Orange Pro Clean Lohnabrechnung.',
        entry_date: cleanText(body.entry_date),
        exit_date: cleanText(body.exit_date),
        internal_notes: cleanText(body.internal_notes),
        onboarding_form_signed_at: cleanText(body.onboarding_form_signed_at),
        onboarding_form_received_at: cleanText(body.onboarding_form_received_at),
        onboarding_source: cleanText(body.onboarding_source) || 'portal_manual',
        created_by: access.user.id,
        updated_by: access.user.id,
        metadata,
      })
      .select('*')
      .single();

    throwOnError(employeeResponse.error, 'Personalakte konnte nicht erstellt werden');
    createdEmployeeId = String(employeeResponse.data.id);

    await insertOptionalRows({
      supabase,
      employee: employeeResponse.data,
      body,
      access,
    });

    return jsonResponse(
      {
        success: true,
        employeeId: employeeResponse.data.id,
        employeeNumber: employeeResponse.data.employee_number,
        message: 'Mitarbeiter wurde erfolgreich angelegt.',
      },
      201,
    );
  } catch (error: any) {
    console.error('[opc/employees/create] POST failed', error);

    if (createdEmployeeId) {
      try {
        const { supabase } = await requireEmployeeHrAccess({ request, locals, cookies });
        await supabase.from('opc_employees').delete().eq('id', createdEmployeeId);
      } catch (cleanupError) {
        console.error('[opc/employees/create] cleanup failed', cleanupError);
      }
    }

    return jsonResponse(
      {
        success: false,
        error: error?.message || 'Mitarbeiter konnte nicht erstellt werden.',
      },
      errorStatus(error),
    );
  }
};
