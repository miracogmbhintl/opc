import type { APIRoute } from 'astro';
import {
  errorStatus,
  jsonResponse,
  maskIban,
  requireEmployeeHrAccess,
  safeObject,
  throwOnError,
} from '../../../../lib/opc-employee-api';

export const prerender = false;

type JsonRow = Record<string, any>;

function currentRow<T extends JsonRow>(rows: T[], date = new Date()) {
  const today = date.toISOString().slice(0, 10);
  return (
    rows
      .filter((row) => {
        const from = row.valid_from ? String(row.valid_from) : '0000-01-01';
        const until = row.valid_until ? String(row.valid_until) : '9999-12-31';
        return from <= today && until >= today;
      })
      .sort((a, b) => String(b.valid_from || '').localeCompare(String(a.valid_from || '')))[0] ||
    rows[0] ||
    null
  );
}

function currentAvailability({
  employeeId,
  profiles,
  rules,
  exceptions,
}: {
  employeeId: string;
  profiles: JsonRow[];
  rules: JsonRow[];
  exceptions: JsonRow[];
}) {
  const now = new Date();
  const weekday = ((now.getDay() + 6) % 7) + 1;
  const currentException = exceptions.find((row) => {
    if (String(row.employee_id) !== employeeId || row.status === 'cancelled') return false;
    const start = new Date(row.starts_at).getTime();
    const end = new Date(row.ends_at).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && Date.now() >= start && Date.now() <= end;
  });

  if (currentException) {
    const type = String(currentException.exception_type || '');
    if (['unavailable', 'vacation', 'sick', 'training'].includes(type)) {
      return { available: false, label: type === 'vacation' ? 'Ferien' : type === 'sick' ? 'Krank' : 'Nicht verfügbar' };
    }
    if (['available', 'on_call'].includes(type)) {
      return { available: true, label: type === 'on_call' ? 'Auf Abruf' : 'Verfügbar' };
    }
  }

  const employeeProfiles = profiles.filter((row) => String(row.employee_id) === employeeId);
  const profile = currentRow(employeeProfiles);
  if (!profile) return { available: null, label: 'Nicht gepflegt' };

  const mode = String(profile.availability_mode || 'weekly_schedule');
  if (mode === '24_7') return { available: true, label: '24/7 verfügbar' };
  if (mode === 'on_call') return { available: true, label: 'Auf Abruf' };
  if (mode === 'unavailable') return { available: false, label: 'Nicht verfügbar' };

  const dayRules = rules.filter(
    (row) =>
      String(row.employee_id) === employeeId &&
      Number(row.day_of_week) === weekday &&
      row.is_active !== false,
  );

  if (dayRules.length > 0) {
    const preferred = dayRules.some((row) => row.availability_type === 'preferred');
    return { available: true, label: preferred ? 'Bevorzugt verfügbar' : 'Verfügbar' };
  }

  return { available: false, label: 'Heute nicht verfügbar' };
}

function choosePosition({
  employee,
  contracts,
  positionsById,
}: {
  employee: JsonRow;
  contracts: JsonRow[];
  positionsById: Map<string, JsonRow>;
}) {
  const metadata = safeObject(employee.metadata);
  const operationalPositionId = String(metadata.operational_position_id || '');
  const contract = currentRow(
    contracts.filter((row) => String(row.employee_id) === String(employee.id) && row.status !== 'cancelled'),
  );
  const positionId = operationalPositionId || String(contract?.position_id || '');
  const position = positionId ? positionsById.get(positionId) || null : null;

  return {
    id: position?.id || positionId || null,
    code: position?.position_code || metadata.operational_position_code || null,
    title: position?.title_de || metadata.operational_position_title || null,
  };
}

export const GET: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const { supabase, access } = await requireEmployeeHrAccess({ request, locals, cookies });

    const [
      employeeResponse,
      staffResponse,
      entityResponse,
      positionResponse,
      skillCatalogResponse,
      skillResponse,
      availabilityProfileResponse,
      availabilityRuleResponse,
      availabilityExceptionResponse,
      addressResponse,
      bankResponse,
      contractResponse,
    ] = await Promise.all([
      supabase.from('opc_employees').select('*').order('legal_last_name', { ascending: true }),
      supabase
        .from('opc_staff_roles')
        .select('id,user_id,employee_id,email,display_name,phone_raw,phone_e164,whatsapp_wa_id,role,status,can_access_portal,created_at')
        .order('display_name', { ascending: true }),
      supabase.from('opc_legal_entities').select('*').eq('status', 'active').order('legal_name'),
      supabase.from('opc_positions').select('*').eq('is_active', true).order('sort_order'),
      supabase
        .from('opc_employee_skill_catalog')
        .select('*')
        .eq('is_active', true)
        .order('sort_order'),
      supabase.from('opc_employee_skills').select('employee_id,skill_id,is_active,is_preferred,proficiency_level'),
      supabase.from('opc_employee_availability_profiles').select('*'),
      supabase.from('opc_employee_availability_rules').select('*'),
      supabase
        .from('opc_employee_availability_exceptions')
        .select('*')
        .gte('ends_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('opc_employee_addresses').select('*').order('valid_from', { ascending: false }),
      supabase
        .from('opc_employee_bank_accounts')
        .select('employee_id,iban,bank_name,is_primary,account_status,valid_from,valid_until'),
      supabase
        .from('opc_employment_contracts')
        .select('id,employee_id,position_id,status,valid_from,valid_until'),
    ]);

    throwOnError(employeeResponse.error, 'Mitarbeiter konnten nicht geladen werden');
    throwOnError(staffResponse.error, 'Portalrollen konnten nicht geladen werden');
    throwOnError(entityResponse.error, 'Rechtsträger konnten nicht geladen werden');
    throwOnError(positionResponse.error, 'Positionen konnten nicht geladen werden');
    throwOnError(skillCatalogResponse.error, 'Skill-Katalog konnte nicht geladen werden');
    throwOnError(skillResponse.error, 'Mitarbeiter-Skills konnten nicht geladen werden');
    throwOnError(availabilityProfileResponse.error, 'Verfügbarkeitsprofile konnten nicht geladen werden');
    throwOnError(availabilityRuleResponse.error, 'Verfügbarkeitsregeln konnten nicht geladen werden');
    throwOnError(availabilityExceptionResponse.error, 'Verfügbarkeitsausnahmen konnten nicht geladen werden');
    throwOnError(addressResponse.error, 'Mitarbeiteradressen konnten nicht geladen werden');
    throwOnError(bankResponse.error, 'Bankverbindungen konnten nicht geladen werden');
    throwOnError(contractResponse.error, 'Positionszuordnungen konnten nicht geladen werden');

    const employees = (employeeResponse.data || []) as JsonRow[];
    const staffRows = ((staffResponse.data || []) as JsonRow[]).filter((row) =>
      ['owner', 'admin', 'dispatch', 'dispatcher', 'disposition', 'employee', 'mitarbeiter']
        .includes(String(row.role || '').trim().toLowerCase()),
    );
    const entities = (entityResponse.data || []) as JsonRow[];
    const positions = (positionResponse.data || []) as JsonRow[];
    const skillCatalog = (skillCatalogResponse.data || []) as JsonRow[];
    const employeeSkills = (skillResponse.data || []) as JsonRow[];
    const availabilityProfiles = (availabilityProfileResponse.data || []) as JsonRow[];
    const availabilityRules = (availabilityRuleResponse.data || []) as JsonRow[];
    const availabilityExceptions = (availabilityExceptionResponse.data || []) as JsonRow[];
    const addresses = (addressResponse.data || []) as JsonRow[];
    const bankAccounts = (bankResponse.data || []) as JsonRow[];
    const contracts = (contractResponse.data || []) as JsonRow[];

    const staffById = new Map<string, JsonRow>(
      staffRows.map((row): [string, JsonRow] => [String(row.id), row]),
    );
    const staffByUserId = new Map<string, JsonRow>(
      staffRows
        .filter((row) => row.user_id)
        .map((row): [string, JsonRow] => [String(row.user_id), row]),
    );
    const entityById = new Map<string, JsonRow>(
      entities.map((row): [string, JsonRow] => [String(row.id), row]),
    );
    const positionsById = new Map<string, JsonRow>(
      positions.map((row): [string, JsonRow] => [String(row.id), row]),
    );
    const skillById = new Map<string, JsonRow>(
      skillCatalog.map((row): [string, JsonRow] => [String(row.id), row]),
    );
    const linkedStaffRoleIds = new Set<string>();

    const hrRows = employees.map((employee) => {
      const staff =
        (employee.staff_role_id ? staffById.get(String(employee.staff_role_id)) : null) ||
        (employee.user_id ? staffByUserId.get(String(employee.user_id)) : null) ||
        null;

      if (staff?.id) linkedStaffRoleIds.add(String(staff.id));

      const employeeId = String(employee.id);
      const entity = employee.employing_entity_id
        ? entityById.get(String(employee.employing_entity_id)) || null
        : null;
      const address = currentRow(
        addresses.filter(
          (row) => String(row.employee_id) === employeeId && row.address_type === 'residence',
        ),
      );
      const bank = currentRow(
        bankAccounts.filter(
          (row) => String(row.employee_id) === employeeId && row.account_status !== 'closed',
        ),
      );
      const availability = currentAvailability({
        employeeId,
        profiles: availabilityProfiles,
        rules: availabilityRules,
        exceptions: availabilityExceptions,
      });
      const activeSkills = employeeSkills.filter(
        (row) => String(row.employee_id) === employeeId && row.is_active !== false,
      );
      const preferredSkills = activeSkills
        .filter((row) => row.is_preferred)
        .map((row) => skillById.get(String(row.skill_id))?.name_de)
        .filter(Boolean)
        .slice(0, 3);
      const position = choosePosition({ employee, contracts, positionsById });

      return {
        id: employee.id,
        employee_id: employee.id,
        source: 'hr',
        employee_number: employee.employee_number,
        staff_role_id: employee.staff_role_id,
        user_id: employee.user_id,
        legal_first_name: employee.legal_first_name,
        legal_last_name: employee.legal_last_name,
        preferred_name: employee.preferred_name,
        display_name:
          employee.preferred_name ||
          [employee.legal_first_name, employee.legal_last_name].filter(Boolean).join(' '),
        private_email: employee.private_email,
        business_email: employee.business_email || staff?.email || null,
        email: employee.business_email || employee.private_email || staff?.email || null,
        phone_raw: employee.phone_raw || staff?.phone_raw || null,
        phone_e164: employee.phone_e164 || staff?.phone_e164 || null,
        whatsapp_wa_id: staff?.whatsapp_wa_id || employee.phone_e164 || null,
        status: employee.status,
        assignment_status: employee.assignment_status,
        profile_completion_status: employee.profile_completion_status,
        personnel_type: employee.personnel_type,
        payroll_in_scope: employee.payroll_in_scope,
        portal_access_only: employee.portal_access_only,
        portal_role: staff?.role || null,
        portal_status: staff?.status || null,
        can_access_portal: staff?.can_access_portal === true,
        entity_id: entity?.id || employee.employing_entity_id || null,
        entity_code: entity?.entity_code || null,
        entity_name: entity?.legal_name || null,
        position,
        city: address?.city || null,
        country_code: address?.country_code || null,
        active_skill_count: activeSkills.length,
        preferred_skills: preferredSkills,
        availability_mode:
          currentRow(availabilityProfiles.filter((row) => String(row.employee_id) === employeeId))
            ?.availability_mode || null,
        is_available_today: availability.available,
        availability_label: availability.label,
        bank_name: bank?.bank_name || null,
        iban_masked: maskIban(bank?.iban),
        entry_date: employee.entry_date,
        exit_date: employee.exit_date,
        created_at: employee.created_at,
        updated_at: employee.updated_at,
      };
    });

    const portalOnlyRows = staffRows
      .filter((staff) => !linkedStaffRoleIds.has(String(staff.id)))
      .map((staff) => ({
        id: `staff:${staff.id}`,
        employee_id: null,
        source: 'portal_only',
        employee_number: null,
        staff_role_id: staff.id,
        user_id: staff.user_id,
        legal_first_name: null,
        legal_last_name: null,
        preferred_name: null,
        display_name: staff.display_name || staff.email || 'Portalnutzer',
        private_email: null,
        business_email: staff.email || null,
        email: staff.email || null,
        phone_raw: staff.phone_raw || null,
        phone_e164: staff.phone_e164 || null,
        whatsapp_wa_id: staff.whatsapp_wa_id || staff.phone_e164 || null,
        status: staff.status || 'active',
        assignment_status: 'available',
        profile_completion_status: 'missing',
        personnel_type: 'unclassified',
        payroll_in_scope: null,
        portal_access_only: true,
        portal_role: staff.role || null,
        portal_status: staff.status || null,
        can_access_portal: staff.can_access_portal === true,
        entity_id: null,
        entity_code: null,
        entity_name: null,
        position: { id: null, code: null, title: null },
        city: null,
        country_code: null,
        active_skill_count: 0,
        preferred_skills: [],
        availability_mode: null,
        is_available_today: null,
        availability_label: 'Personalakte fehlt',
        bank_name: null,
        iban_masked: null,
        entry_date: null,
        exit_date: null,
        created_at: staff.created_at,
        updated_at: staff.created_at,
      }));

    const rows = [...hrRows, ...portalOnlyRows].sort((a, b) =>
      String(a.display_name || '').localeCompare(String(b.display_name || ''), 'de'),
    );

    return jsonResponse({
      success: true,
      role: access.role,
      canManagePayroll: access.canManagePayroll,
      employees: rows,
      options: {
        entities,
        positions,
        skills: skillCatalog,
        unlinkedStaff: portalOnlyRows.map((row) => ({
          id: row.staff_role_id,
          user_id: row.user_id,
          display_name: row.display_name,
          email: row.email,
          phone_raw: row.phone_raw,
          phone_e164: row.phone_e164,
          role: row.portal_role,
          status: row.portal_status,
        })),
      },
    });
  } catch (error: any) {
    console.error('[opc/employees/index] GET failed', error);
    return jsonResponse(
      {
        success: false,
        error: error?.message || 'Mitarbeiter konnten nicht geladen werden.',
      },
      errorStatus(error),
    );
  }
};
