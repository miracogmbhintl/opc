import type { APIRoute } from 'astro';
import {
  cleanText,
  errorStatus,
  jsonResponse,
  requireEmployeeHrAccess,
  safeObject,
  throwOnError,
} from '../../../../lib/opc-employee-api';
import { calculateEmployeePayroll } from '../../../../lib/opc-payroll-engine';

export const prerender = false;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isoDate(value: unknown) {
  const text = cleanText(value) || '';
  return ISO_DATE.test(text) ? text : '';
}

function runNumber(employeeNumber: string, periodFrom: string, periodTo: string) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const employeePart = employeeNumber.replace(/[^a-zA-Z0-9]+/g, '-');
  return `OPC-LR-${employeePart}-${periodFrom.replaceAll('-', '')}-${periodTo.replaceAll('-', '')}-${stamp}`;
}

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  let cleanupSupabase: any = null;
  let createdRunId: string | null = null;
  try {
    const body = safeObject(await request.json().catch(() => ({})));
    const employeeId = cleanText(body.employeeId);
    const periodFrom = isoDate(body.periodFrom);
    const periodTo = isoDate(body.periodTo);

    if (!employeeId || !periodFrom || !periodTo || periodFrom > periodTo) {
      return jsonResponse({ success: false, error: 'Mitarbeiter und gültiger Zeitraum sind erforderlich.' }, 400);
    }

    const { supabase, access } = await requireEmployeeHrAccess({ request, locals, cookies });
    cleanupSupabase = supabase;
    if (!access.canManagePayroll) {
      return jsonResponse({ success: false, error: 'Keine Berechtigung für Payroll.' }, 403);
    }

    const calculation = await calculateEmployeePayroll({
      supabase,
      employeeId,
      periodFrom,
      periodTo,
    });

    const existingResponse = await supabase
      .from('opc_payroll_runs')
      .select('id,run_number,status')
      .eq('employee_id', employeeId)
      .eq('period_from', periodFrom)
      .eq('period_to', periodTo)
      .in('status', ['approved', 'paid'])
      .limit(1)
      .maybeSingle();
    throwOnError(existingResponse.error, 'Bestehender Lohnlauf konnte nicht geprüft werden');

    if (existingResponse.data) {
      return jsonResponse(
        {
          success: false,
          error: `Für diesen Zeitraum besteht bereits der abgeschlossene Lohnlauf ${existingResponse.data.run_number}.`,
          existingRun: existingResponse.data,
        },
        409,
      );
    }

    const actorId = access.user.id;
    const number = runNumber(
      cleanText(calculation.employee.employee_number) || employeeId.slice(0, 8),
      periodFrom,
      periodTo,
    );

    const runResponse = await supabase
      .from('opc_payroll_runs')
      .insert({
        run_number: number,
        employee_id: employeeId,
        period_from: periodFrom,
        period_to: periodTo,
        status: 'calculated',
        rule_set_id: calculation.ruleSet.id || null,
        currency_code: 'CHF',
        total_gross_chf: calculation.grossSalary,
        total_employee_deductions_chf: calculation.employeeDeductions,
        total_net_chf: calculation.netSalary,
        total_reimbursements_chf: calculation.reimbursements,
        total_payout_chf: calculation.payout,
        total_employer_contributions_chf: calculation.employerContributions,
        total_employer_cost_chf: calculation.totalEmployerCost,
        calculated_at: new Date().toISOString(),
        approved_at: null,
        approved_by: null,
        created_by: actorId,
        updated_by: actorId,
        metadata: {
          calculation_version: 'opc_payroll_phase1_v1',
          source: 'employee_payroll_owner_panel',
          filename: calculation.filename,
          warnings: calculation.warnings,
        },
      })
      .select('*')
      .single();
    throwOnError(runResponse.error, 'Lohnlauf konnte nicht angelegt werden');
    createdRunId = runResponse.data.id;

    const employeeRunResponse = await supabase
      .from('opc_payroll_run_employees')
      .insert({
        payroll_run_id: runResponse.data.id,
        employee_id: employeeId,
        contract_id: calculation.contract.id || null,
        payroll_profile_id: calculation.payrollProfile.id || null,
        salary_type: calculation.salaryType,
        approved_entry_count: calculation.entriesCount,
        approved_minutes: calculation.totalMinutes,
        payable_days: calculation.payableDays,
        period_working_days: calculation.periodWorkingDays,
        base_salary_chf: calculation.baseSalary,
        gross_salary_chf: calculation.grossSalary,
        employee_deductions_chf: calculation.employeeDeductions,
        net_salary_chf: calculation.netSalary,
        reimbursements_chf: calculation.reimbursements,
        other_adjustments_chf: calculation.otherAdjustments,
        payout_chf: calculation.payout,
        employer_contributions_chf: calculation.employerContributions,
        total_employer_cost_chf: calculation.totalEmployerCost,
        gross_per_hour_chf: calculation.grossPerHour,
        net_per_hour_chf: calculation.netPerHour,
        employer_cost_per_hour_chf: calculation.employerCostPerHour,
        calculation_snapshot: calculation.snapshot,
      })
      .select('*')
      .single();
    throwOnError(employeeRunResponse.error, 'Mitarbeiterabrechnung konnte nicht gespeichert werden');

    if (calculation.lines.length) {
      const lineResponse = await supabase.from('opc_payroll_lines').insert(
        calculation.lines.map((item) => ({
          payroll_run_employee_id: employeeRunResponse.data.id,
          line_group: item.lineGroup,
          line_code: item.lineCode,
          description: item.description,
          basis_amount_chf: item.basisAmount,
          quantity: item.quantity,
          rate: item.rate,
          employee_amount_chf: item.employeeAmount,
          employer_amount_chf: item.employerAmount,
          sort_order: item.sortOrder,
          source: item.source,
          metadata: item.metadata || {},
        })),
      );
      throwOnError(lineResponse.error, 'Lohnpositionen konnten nicht gespeichert werden');
    }

    const approvedResponse = await supabase
      .from('opc_payroll_runs')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: actorId,
        updated_by: actorId,
      })
      .eq('id', runResponse.data.id)
      .eq('status', 'calculated')
      .select('*')
      .single();
    throwOnError(approvedResponse.error, 'Lohnlauf konnte nicht abgeschlossen werden');
    createdRunId = null;

    return jsonResponse({
      success: true,
      run: approvedResponse.data,
      employeeRun: employeeRunResponse.data,
      payroll: calculation.payrollDocument,
      filename: calculation.filename,
      summary: {
        salaryType: calculation.salaryType,
        totalHours: calculation.totalHours,
        grossSalary: calculation.grossSalary,
        employeeDeductions: calculation.employeeDeductions,
        netSalary: calculation.netSalary,
        payout: calculation.payout,
        employerContributions: calculation.employerContributions,
        totalEmployerCost: calculation.totalEmployerCost,
        employerCostPerHour: calculation.employerCostPerHour,
        warnings: calculation.warnings,
      },
    });
  } catch (error: any) {
    if (createdRunId && cleanupSupabase) {
      try {
        await cleanupSupabase
          .from('opc_payroll_runs')
          .delete()
          .eq('id', createdRunId)
          .eq('status', 'calculated');
      } catch (cleanupError) {
        console.error('[opc/payroll-runs/finalize] cleanup failed', cleanupError);
      }
    }
    console.error('[opc/payroll-runs/finalize] POST failed', error);
    return jsonResponse(
      { success: false, error: error?.message || 'Lohnlauf konnte nicht abgeschlossen werden.' },
      errorStatus(error),
    );
  }
};
