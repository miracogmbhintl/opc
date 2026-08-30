import type { APIRoute } from 'astro';
import {
  cleanText,
  errorStatus,
  jsonResponse,
  requireEmployeeHrAccess,
  safeObject,
} from '../../../../../lib/opc-employee-api';
import { maskAhvNumber } from '../../../../../lib/opc-sensitive-data';

export const prerender = false;

type JsonRow = Record<string, any>;

type QueryResult = {
  data?: any;
  error?: any;
};

function zurichDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function currentRow<T extends JsonRow>(rows: T[]) {
  const today = zurichDate();
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

function warningMessage(label: string, error: any) {
  const detail = String(error?.message || error || 'Unbekannter Fehler').trim();
  return `${label}: ${detail}`;
}

async function optionalRows(label: string, promise: PromiseLike<QueryResult>, warnings: string[]) {
  try {
    const response = await promise;
    if (response?.error) {
      warnings.push(warningMessage(label, response.error));
      return [] as JsonRow[];
    }
    return Array.isArray(response?.data) ? (response.data as JsonRow[]) : [];
  } catch (error) {
    warnings.push(warningMessage(label, error));
    return [] as JsonRow[];
  }
}

async function optionalOne(label: string, promise: PromiseLike<QueryResult>, warnings: string[]) {
  try {
    const response = await promise;
    if (response?.error) {
      warnings.push(warningMessage(label, response.error));
      return null;
    }
    return (response?.data || null) as JsonRow | null;
  } catch (error) {
    warnings.push(warningMessage(label, error));
    return null;
  }
}

export const GET: APIRoute = async ({ request, locals, cookies, params }) => {
  try {
    const employeeId = cleanText(params.id);
    if (!employeeId) {
      return jsonResponse({ success: false, error: 'Keine Mitarbeiter-ID vorhanden.' }, 400);
    }

    const { supabase, access } = await requireEmployeeHrAccess({ request, locals, cookies });
    const employeeResponse = await supabase
      .from('opc_employees')
      .select('*')
      .eq('id', employeeId)
      .maybeSingle();

    if (employeeResponse.error) {
      throw new Error(`Mitarbeiter konnte nicht geladen werden: ${employeeResponse.error.message}`);
    }
    const employee = employeeResponse.data as JsonRow | null;
    if (!employee) {
      return jsonResponse({ success: false, error: 'Mitarbeiter wurde nicht gefunden.' }, 404);
    }

    const warnings: string[] = [];

    const [
      staffRole,
      legalEntity,
      addresses,
      nationalities,
      permits,
      bankAccounts,
      qualifications,
      skillRows,
      skillCatalog,
      availabilityProfiles,
      availabilityRules,
      availabilityExceptions,
      notes,
      emergencyContacts,
      familyMembers,
      documents,
      positions,
      entities,
      contracts,
      classifications,
    ] = await Promise.all([
      employee.staff_role_id
        ? optionalOne(
            'Portalrolle konnte nicht geladen werden',
            supabase.from('opc_staff_roles').select('*').eq('id', employee.staff_role_id).maybeSingle(),
            warnings,
          )
        : Promise.resolve(null),
      employee.employing_entity_id
        ? optionalOne(
            'Rechtsträger konnte nicht geladen werden',
            supabase.from('opc_legal_entities').select('*').eq('id', employee.employing_entity_id).maybeSingle(),
            warnings,
          )
        : Promise.resolve(null),
      optionalRows(
        'Adressen konnten nicht geladen werden',
        supabase.from('opc_employee_addresses').select('*').eq('employee_id', employeeId).order('valid_from', { ascending: false }),
        warnings,
      ),
      optionalRows(
        'Nationalitäten konnten nicht geladen werden',
        supabase.from('opc_employee_nationalities').select('*').eq('employee_id', employeeId).order('valid_from', { ascending: false }),
        warnings,
      ),
      optionalRows(
        'Bewilligungen konnten nicht geladen werden',
        supabase.from('opc_employee_permits').select('*').eq('employee_id', employeeId).order('valid_from', { ascending: false }),
        warnings,
      ),
      optionalRows(
        'Bankverbindungen konnten nicht geladen werden',
        supabase.from('opc_employee_bank_accounts').select('*').eq('employee_id', employeeId).order('valid_from', { ascending: false }),
        warnings,
      ),
      optionalRows(
        'Qualifikationen konnten nicht geladen werden',
        supabase.from('opc_employee_qualifications').select('*').eq('employee_id', employeeId).order('is_primary', { ascending: false }).order('completed_on', { ascending: false }),
        warnings,
      ),
      optionalRows(
        'Skills konnten nicht geladen werden',
        supabase.from('opc_employee_skills').select('*').eq('employee_id', employeeId).order('is_preferred', { ascending: false }),
        warnings,
      ),
      optionalRows(
        'Skill-Katalog konnte nicht geladen werden',
        supabase.from('opc_employee_skill_catalog').select('*').eq('is_active', true).order('sort_order'),
        warnings,
      ),
      optionalRows(
        'Verfügbarkeitsprofil konnte nicht geladen werden',
        supabase.from('opc_employee_availability_profiles').select('*').eq('employee_id', employeeId).order('valid_from', { ascending: false }),
        warnings,
      ),
      optionalRows(
        'Verfügbarkeitsregeln konnten nicht geladen werden',
        supabase.from('opc_employee_availability_rules').select('*').eq('employee_id', employeeId).order('day_of_week'),
        warnings,
      ),
      optionalRows(
        'Verfügbarkeitsausnahmen konnten nicht geladen werden',
        supabase.from('opc_employee_availability_exceptions').select('*').eq('employee_id', employeeId).order('starts_at', { ascending: false }).limit(100),
        warnings,
      ),
      optionalRows(
        'Notizen konnten nicht geladen werden',
        supabase.from('opc_employee_notes').select('*').eq('employee_id', employeeId).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
        warnings,
      ),
      optionalRows(
        'Notfallkontakte konnten nicht geladen werden',
        supabase.from('opc_employee_emergency_contacts').select('*').eq('employee_id', employeeId).order('is_primary', { ascending: false }),
        warnings,
      ),
      optionalRows(
        'Familienangaben konnten nicht geladen werden',
        supabase.from('opc_employee_family_members').select('*').eq('employee_id', employeeId).order('date_of_birth', { ascending: true }),
        warnings,
      ),
      optionalRows(
        'Dokumente konnten nicht geladen werden',
        supabase.from('opc_employee_documents').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false }),
        warnings,
      ),
      optionalRows(
        'Positionen konnten nicht geladen werden',
        supabase.from('opc_positions').select('*').eq('is_active', true).order('sort_order'),
        warnings,
      ),
      optionalRows(
        'Rechtsträger-Liste konnte nicht geladen werden',
        supabase.from('opc_legal_entities').select('*').eq('status', 'active').order('legal_name'),
        warnings,
      ),
      access.isOwner
        ? optionalRows(
            'Arbeitsverträge konnten nicht geladen werden',
            supabase.from('opc_employment_contracts').select('*').eq('employee_id', employeeId).order('valid_from', { ascending: false }),
            warnings,
          )
        : Promise.resolve([]),
      access.isOwner
        ? optionalRows(
            'Lohnklassifikationen konnten nicht geladen werden',
            supabase.from('opc_contract_pay_classifications').select('*').eq('employee_id', employeeId).order('valid_from', { ascending: false }),
            warnings,
          )
        : Promise.resolve([]),
    ]);

    const catalogById = new Map<string, JsonRow>(
      skillCatalog.map((row: JsonRow): [string, JsonRow] => [String(row.id), row]),
    );
    const skills = skillRows.map((row: JsonRow) => ({
      ...row,
      catalog: catalogById.get(String(row.skill_id)) || null,
    }));

    const metadata = safeObject(employee.metadata);
    const positionById = new Map<string, JsonRow>(
      positions.map((row: JsonRow): [string, JsonRow] => [String(row.id), row]),
    );
    const activeContract = currentRow(
      contracts.filter((row: JsonRow) => String(row.status || '').toLowerCase() !== 'cancelled'),
    );
    const operationalPositionId =
      cleanText(metadata.operational_position_id) || cleanText(activeContract?.position_id);
    const operationalPosition = operationalPositionId
      ? positionById.get(String(operationalPositionId)) || null
      : null;

    const stableDocuments = documents
      .filter((row: JsonRow) => access.isOwner || row.access_scope !== 'payroll_owner')
      .map((row: JsonRow) => ({
        ...row,
        signed_url: `/api/opc/employees/document-download?documentId=${encodeURIComponent(String(row.id))}`,
      }));

    const detail = {
      employee: {
        ...employee,
        ahv_number: maskAhvNumber(employee.ahv_number) || null,
      },
      staff_role: staffRole,
      legal_entity: legalEntity,
      current_address: currentRow(addresses),
      addresses,
      current_nationality: currentRow(nationalities),
      nationalities,
      current_permit: currentRow(permits),
      permits,
      current_bank_account: currentRow(
        bankAccounts.filter((row: JsonRow) => row.account_status !== 'closed'),
      ),
      bank_accounts: bankAccounts,
      primary_qualification:
        qualifications.find((row: JsonRow) => row.is_primary) || qualifications[0] || null,
      qualifications,
      skills,
      skill_catalog: skillCatalog,
      availability_profile: currentRow(availabilityProfiles),
      availability_profiles: availabilityProfiles,
      availability_rules: availabilityRules,
      availability_exceptions: availabilityExceptions,
      notes: notes.filter((row: JsonRow) => access.isOwner || row.visibility_scope !== 'owners_only'),
      emergency_contacts: emergencyContacts,
      family_members: familyMembers,
      documents: stableDocuments,
      positions,
      entities,
      operational_position: operationalPosition,
      contracts: access.isOwner ? contracts : [],
      classifications: access.isOwner ? classifications : [],
      load_warnings: warnings,
    };

    return jsonResponse({
      success: true,
      role: access.role,
      canManagePayroll: access.canManagePayroll,
      detail,
      warnings,
      partial: warnings.length > 0,
    });
  } catch (error: any) {
    console.error('[opc/employees/id/resilient-detail] GET failed', error);
    return jsonResponse(
      { success: false, error: error?.message || 'Mitarbeiter konnte nicht geladen werden.' },
      errorStatus(error),
    );
  }
};
