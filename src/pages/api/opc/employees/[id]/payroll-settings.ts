import type { APIRoute } from 'astro';
import {
  asBoolean,
  asNumber,
  cleanText,
  cleanUpperCode,
  errorStatus,
  jsonResponse,
  requireEmployeeHrAccess,
  safeObject,
  throwOnError,
} from '../../../../../lib/opc-employee-api';

export const prerender = false;

type JsonRow = Record<string, any>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isoDate(value: unknown) {
  const text = cleanText(value) || '';
  return ISO_DATE.test(text) ? text : null;
}

function money(value: unknown) {
  const number = asNumber(value);
  return number === null ? null : Math.round((number + Number.EPSILON) * 100) / 100;
}

function rate(value: unknown) {
  const number = asNumber(value);
  return number === null ? 0 : Math.round((number + Number.EPSILON) * 10000) / 10000;
}

async function authorize(context: {
  request: Request;
  locals: any;
  cookies: any;
}) {
  const result = await requireEmployeeHrAccess(context);
  if (!result.access.canManagePayroll) {
    throw new Error('Payroll access denied');
  }
  return result;
}

async function loadSettings(supabase: any, employeeId: string) {
  const [employeeResponse, contractResponse, profileResponse, ruleResponse] = await Promise.all([
    supabase
      .from('opc_employees')
      .select('id,employee_number,legal_first_name,legal_last_name,entry_date,exit_date,payroll_in_scope')
      .eq('id', employeeId)
      .maybeSingle(),
    supabase
      .from('opc_employment_contracts')
      .select('*')
      .eq('employee_id', employeeId)
      .order('valid_from', { ascending: false }),
    supabase
      .from('opc_employee_payroll_profiles')
      .select('*')
      .eq('employee_id', employeeId)
      .order('valid_from', { ascending: false }),
    supabase
      .from('opc_payroll_rule_sets')
      .select('*')
      .eq('status', 'active')
      .order('valid_from', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  throwOnError(employeeResponse.error, 'Mitarbeiter konnte nicht geladen werden');
  throwOnError(contractResponse.error, 'Arbeitsverträge konnten nicht geladen werden');
  throwOnError(profileResponse.error, 'Payroll-Profile konnten nicht geladen werden');
  throwOnError(ruleResponse.error, 'Payroll-Regelsatz konnte nicht geladen werden');

  if (!employeeResponse.data) throw new Error('Mitarbeiter wurde nicht gefunden.');

  return {
    employee: employeeResponse.data,
    contracts: contractResponse.data || [],
    payrollProfiles: profileResponse.data || [],
    activeRuleSet: ruleResponse.data || null,
  };
}

export const GET: APIRoute = async ({ request, locals, cookies, params }) => {
  try {
    const employeeId = cleanText(params.id);
    if (!employeeId) return jsonResponse({ success: false, error: 'Mitarbeiter-ID fehlt.' }, 400);

    const { supabase } = await authorize({ request, locals, cookies });
    const settings = await loadSettings(supabase, employeeId);
    return jsonResponse({ success: true, ...settings });
  } catch (error: any) {
    console.error('[opc/employees/id/payroll-settings] GET failed', error);
    const denied = String(error?.message || '').includes('Payroll access denied');
    return jsonResponse(
      { success: false, error: denied ? 'Keine Berechtigung für Payroll.' : error?.message || 'Payroll-Einstellungen konnten nicht geladen werden.' },
      denied ? 403 : errorStatus(error),
    );
  }
};

export const PUT: APIRoute = async ({ request, locals, cookies, params }) => {
  try {
    const employeeId = cleanText(params.id);
    if (!employeeId) return jsonResponse({ success: false, error: 'Mitarbeiter-ID fehlt.' }, 400);

    const body = safeObject(await request.json().catch(() => ({})));
    const action = cleanText(body.action);
    const { supabase, access } = await authorize({ request, locals, cookies });
    const actorId = access.user.id;

    const employeeResponse = await supabase
      .from('opc_employees')
      .select('id,employee_number,legal_first_name,legal_last_name,entry_date')
      .eq('id', employeeId)
      .maybeSingle();
    throwOnError(employeeResponse.error, 'Mitarbeiter konnte nicht geladen werden');
    const employee = employeeResponse.data as JsonRow | null;
    if (!employee) return jsonResponse({ success: false, error: 'Mitarbeiter wurde nicht gefunden.' }, 404);

    if (action === 'save_contract') {
      const contract = safeObject(body.contract);
      const salaryType = (cleanText(contract.salary_type) || '').toLowerCase();
      if (!['hourly', 'monthly'].includes(salaryType)) {
        return jsonResponse({ success: false, error: 'Lohnart muss hourly oder monthly sein.' }, 400);
      }

      const validFrom = isoDate(contract.valid_from) || isoDate(employee.entry_date);
      const validUntil = isoDate(contract.valid_until);
      if (!validFrom) {
        return jsonResponse({ success: false, error: 'Vertragsbeginn fehlt.' }, 400);
      }
      if (validUntil && validUntil < validFrom) {
        return jsonResponse({ success: false, error: 'Vertragsende liegt vor dem Vertragsbeginn.' }, 400);
      }

      const hourlyRate = money(contract.hourly_rate_chf);
      const monthlySalary = money(contract.monthly_salary_chf);
      if (salaryType === 'hourly' && (!hourlyRate || hourlyRate <= 0)) {
        return jsonResponse({ success: false, error: 'Für Stundenlohn ist ein positiver Stundenansatz erforderlich.' }, 400);
      }
      if (salaryType === 'monthly' && (!monthlySalary || monthlySalary <= 0)) {
        return jsonResponse({ success: false, error: 'Für Monatslohn ist ein positiver Monatslohn erforderlich.' }, 400);
      }

      const employeeNumber = cleanText(employee.employee_number) || employeeId.slice(0, 8);
      const contractId = cleanText(contract.id);
      const contractNumber = cleanText(contract.contract_number) ||
        `OPC-AV-${employeeNumber}-${validFrom.replaceAll('-', '')}`;

      let contractType = cleanText(contract.contract_type);
      if (!contractType) {
        const typeResponse = await supabase.rpc('opc_resolve_employment_contract_type', {
          p_salary_type: salaryType,
          p_valid_until: validUntil,
        });
        throwOnError(typeResponse.error, 'Vertragsart konnte nicht aufgelöst werden');
        contractType = cleanText(typeResponse.data) || 'employment';
      }

      const payload = {
        employee_id: employeeId,
        contract_number: contractNumber,
        contract_type: contractType,
        salary_type: salaryType,
        status: cleanText(contract.status) || 'active',
        valid_from: validFrom,
        valid_until: validUntil,
        weekly_hours: asNumber(contract.weekly_hours),
        employment_percentage: asNumber(contract.employment_percentage),
        pay_currency: 'CHF',
        hourly_rate_chf: salaryType === 'hourly' ? hourlyRate : null,
        monthly_salary_chf: salaryType === 'monthly' ? monthlySalary : null,
        annual_salary_chf: salaryType === 'monthly' && monthlySalary
          ? Math.round(monthlySalary * 12 * 100) / 100
          : null,
        is_gav_applicable: asBoolean(contract.is_gav_applicable, true),
        gav_name: cleanText(contract.gav_name) || 'GAV Reinigungsbranche Deutschschweiz',
        gav_category: cleanText(contract.gav_category),
        gav_level: cleanText(contract.gav_level),
        qualification_level: cleanText(contract.qualification_level),
        holiday_days: asNumber(contract.holiday_days),
        holiday_pay_percentage: rate(contract.holiday_pay_percentage),
        public_holiday_percentage: rate(contract.public_holiday_percentage),
        thirteenth_salary_percentage: rate(contract.thirteenth_salary_percentage ?? 0),
        ordinary_work_country_code: 'CH',
        ordinary_work_canton_code: cleanUpperCode(contract.ordinary_work_canton_code, 2),
        ordinary_work_city: cleanText(contract.ordinary_work_city),
        notes: cleanText(contract.notes),
        approved_at: new Date().toISOString(),
        approved_by: actorId,
        updated_by: actorId,
        rate_composition: cleanText(contract.rate_composition) || 'base_excluding_supplements',
        monthly_salary_includes_13th: asBoolean(contract.monthly_salary_includes_13th, false),
        planned_duration_type: validUntil ? 'fixed_term' : 'indefinite',
        planned_end_date: validUntil,
        workload_model: cleanText(contract.workload_model) || 'variable_hours',
        reference_weekly_hours: asNumber(contract.reference_weekly_hours),
        guaranteed_weekly_hours: asNumber(contract.guaranteed_weekly_hours),
        overtime_assessment_mode: cleanText(contract.overtime_assessment_mode) || 'manual',
        fixed_salary_covers_variable_hours: asBoolean(
          contract.fixed_salary_covers_variable_hours,
          salaryType === 'monthly',
        ),
        metadata: {
          ...safeObject(contract.metadata),
          source: 'employee_payroll_owner_panel',
          updated_by_payroll_phase: 'phase1_v1',
        },
      };

      let response;
      if (contractId) {
        response = await supabase
          .from('opc_employment_contracts')
          .update(payload)
          .eq('id', contractId)
          .eq('employee_id', employeeId)
          .select('*')
          .single();
      } else {
        response = await supabase
          .from('opc_employment_contracts')
          .insert({ ...payload, created_by: actorId })
          .select('*')
          .single();
      }
      throwOnError(response.error, 'Arbeitsvertrag konnte nicht gespeichert werden');

      const settings = await loadSettings(supabase, employeeId);
      return jsonResponse({ success: true, contract: response.data, ...settings });
    }

    if (action === 'save_profile') {
      const profile = safeObject(body.profile);
      const validFrom = isoDate(profile.valid_from) || isoDate(employee.entry_date);
      const validUntil = isoDate(profile.valid_until);
      if (!validFrom) return jsonResponse({ success: false, error: 'Gültig-ab-Datum fehlt.' }, 400);
      if (validUntil && validUntil < validFrom) {
        return jsonResponse({ success: false, error: 'Gültig-bis liegt vor Gültig-ab.' }, 400);
      }

      const payload = {
        employee_id: employeeId,
        status: cleanText(profile.status) || 'active',
        valid_from: validFrom,
        valid_until: validUntil,
        source_tax_subject: asBoolean(profile.source_tax_subject, false),
        source_tax_canton: cleanUpperCode(profile.source_tax_canton, 2),
        source_tax_tariff_code: cleanText(profile.source_tax_tariff_code),
        source_tax_rate: rate(profile.source_tax_rate),
        source_tax_fixed_amount_chf: money(profile.source_tax_fixed_amount_chf) || 0,
        church_tax: asBoolean(profile.church_tax, false),
        nbu_employee_rate: rate(profile.nbu_employee_rate),
        nbu_employer_rate: rate(profile.nbu_employer_rate),
        ktg_employee_rate: rate(profile.ktg_employee_rate),
        ktg_employer_rate: rate(profile.ktg_employer_rate),
        gav_employee_rate: rate(profile.gav_employee_rate),
        gav_employer_rate: rate(profile.gav_employer_rate),
        bvg_employee_amount_chf: money(profile.bvg_employee_amount_chf) || 0,
        bvg_employer_amount_chf: money(profile.bvg_employer_amount_chf) || 0,
        family_allowance_chf: money(profile.family_allowance_chf) || 0,
        expense_reimbursement_chf: money(profile.expense_reimbursement_chf) || 0,
        advance_deduction_chf: money(profile.advance_deduction_chf) || 0,
        other_employee_deduction_chf: money(profile.other_employee_deduction_chf) || 0,
        other_employer_cost_chf: money(profile.other_employer_cost_chf) || 0,
        other_adjustment_chf: money(profile.other_adjustment_chf) || 0,
        monthly_salary_proration_method:
          cleanText(profile.monthly_salary_proration_method) || 'working_days',
        pay_thirteenth_monthly: asBoolean(profile.pay_thirteenth_monthly, false),
        notes: cleanText(profile.notes),
        metadata: {
          ...safeObject(profile.metadata),
          source: 'employee_payroll_owner_panel',
          updated_by_payroll_phase: 'phase1_v1',
        },
        updated_by: actorId,
      };

      const profileId = cleanText(profile.id);
      let response;
      if (profileId) {
        response = await supabase
          .from('opc_employee_payroll_profiles')
          .update(payload)
          .eq('id', profileId)
          .eq('employee_id', employeeId)
          .select('*')
          .single();
      } else {
        response = await supabase
          .from('opc_employee_payroll_profiles')
          .upsert({ ...payload, created_by: actorId }, { onConflict: 'employee_id,valid_from' })
          .select('*')
          .single();
      }
      throwOnError(response.error, 'Payroll-Profil konnte nicht gespeichert werden');

      const settings = await loadSettings(supabase, employeeId);
      return jsonResponse({ success: true, payrollProfile: response.data, ...settings });
    }

    return jsonResponse({ success: false, error: 'Unbekannte Payroll-Aktion.' }, 400);
  } catch (error: any) {
    console.error('[opc/employees/id/payroll-settings] PUT failed', error);
    const denied = String(error?.message || '').includes('Payroll access denied');
    return jsonResponse(
      { success: false, error: denied ? 'Keine Berechtigung für Payroll.' : error?.message || 'Payroll-Einstellungen konnten nicht gespeichert werden.' },
      denied ? 403 : errorStatus(error),
    );
  }
};
