import type { APIRoute } from 'astro';
import {
  cleanText,
  errorStatus,
  jsonResponse,
  requireEmployeeHrAccess,
} from '../../../../../lib/opc-employee-api';
import { calculateEmployeePayroll } from '../../../../../lib/opc-payroll-engine';

export const prerender = false;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isoDate(value: unknown) {
  const text = cleanText(value) || '';
  return ISO_DATE.test(text) ? text : '';
}

export const GET: APIRoute = async ({ request, locals, cookies, params }) => {
  try {
    const employeeId = cleanText(params.id);
    if (!employeeId) {
      return jsonResponse({ success: false, error: 'Keine Mitarbeiter-ID vorhanden.' }, 400);
    }

    const url = new URL(request.url);
    const periodFrom = isoDate(url.searchParams.get('from'));
    const periodTo = isoDate(url.searchParams.get('to'));
    if (!periodFrom || !periodTo || periodFrom > periodTo) {
      return jsonResponse({ success: false, error: 'Ungültiger Abrechnungszeitraum.' }, 400);
    }

    const durationDays = Math.floor(
      (new Date(`${periodTo}T12:00:00Z`).getTime() -
        new Date(`${periodFrom}T12:00:00Z`).getTime()) /
        86400000,
    );
    if (durationDays > 366) {
      return jsonResponse(
        { success: false, error: 'Der Abrechnungszeitraum darf höchstens 366 Tage umfassen.' },
        400,
      );
    }

    const { supabase, access } = await requireEmployeeHrAccess({ request, locals, cookies });
    if (!access.canManagePayroll) {
      return jsonResponse(
        { success: false, error: 'Sie haben keine Berechtigung für Lohnabrechnungen.' },
        403,
      );
    }

    const calculation = await calculateEmployeePayroll({
      supabase,
      employeeId,
      periodFrom,
      periodTo,
    });

    return jsonResponse({
      success: true,
      payroll: calculation.payrollDocument,
      filename: calculation.filename,
      summary: {
        periodFrom,
        periodTo,
        salaryType: calculation.salaryType,
        entriesCount: calculation.entriesCount,
        totalMinutes: calculation.totalMinutes,
        totalHours: calculation.totalHours,
        payableDays: calculation.payableDays,
        periodWorkingDays: calculation.periodWorkingDays,
        baseSalary: calculation.baseSalary,
        grossSalary: calculation.grossSalary,
        employeeDeductions: calculation.employeeDeductions,
        netSalary: calculation.netSalary,
        reimbursements: calculation.reimbursements,
        otherAdjustments: calculation.otherAdjustments,
        payout: calculation.payout,
        employerContributions: calculation.employerContributions,
        totalEmployerCost: calculation.totalEmployerCost,
        grossPerHour: calculation.grossPerHour,
        netPerHour: calculation.netPerHour,
        employerCostPerHour: calculation.employerCostPerHour,
        rateBreakdown: calculation.rateBreakdown,
        warnings: calculation.warnings,
        contractId: calculation.contract.id || null,
        payrollProfileId: calculation.payrollProfile.id || null,
        ruleSetId: calculation.ruleSet.id || null,
      },
    });
  } catch (error: any) {
    console.error('[opc/employees/id/payroll-preview] GET failed', error);
    return jsonResponse(
      { success: false, error: error?.message || 'Lohnabrechnung konnte nicht erstellt werden.' },
      errorStatus(error),
    );
  }
};
