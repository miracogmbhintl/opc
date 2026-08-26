import type { APIRoute } from 'astro';
import {
  asNumber,
  cleanText,
  errorStatus,
  jsonResponse,
  requireEmployeeHrAccess,
  safeObject,
  throwOnError,
} from '../../../../../lib/opc-employee-api';

export const prerender = false;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isoDate(value: unknown) {
  const text = cleanText(value) || '';
  return ISO_DATE.test(text) ? text : '';
}

async function authorize(context: { request: Request; locals: any; cookies: any }) {
  const result = await requireEmployeeHrAccess(context);
  if (!result.access.canManagePayroll) throw new Error('Payroll access denied');
  return result;
}

async function loadEntries(supabase: any, employeeId: string, periodFrom: string, periodTo: string) {
  const entryResponse = await supabase
    .from('opc_employee_time_entries')
    .select('id,employee_id,work_date,total_minutes,clock_in_at,clock_out_at,metadata,status')
    .eq('employee_id', employeeId)
    .eq('status', 'approved')
    .gte('work_date', periodFrom)
    .lte('work_date', periodTo)
    .order('work_date', { ascending: true })
    .order('clock_in_at', { ascending: true });
  throwOnError(entryResponse.error, 'Zeiteinträge konnten nicht geladen werden');

  const entries = entryResponse.data || [];
  const ids = entries.map((row: any) => cleanText(row.id)).filter(Boolean) as string[];
  let overrides: any[] = [];
  if (ids.length) {
    const rateResponse = await supabase
      .from('opc_time_entry_pay_rates')
      .select('*')
      .eq('employee_id', employeeId)
      .in('time_entry_id', ids);
    throwOnError(rateResponse.error, 'Individuelle Stundenansätze konnten nicht geladen werden');
    overrides = rateResponse.data || [];
  }

  const byEntry = new Map(overrides.map((row: any) => [String(row.time_entry_id), row]));
  return entries.map((entry: any) => ({
    ...entry,
    pay_rate: byEntry.get(String(entry.id)) || null,
  }));
}

export const GET: APIRoute = async ({ request, locals, cookies, params }) => {
  try {
    const employeeId = cleanText(params.id);
    const url = new URL(request.url);
    const periodFrom = isoDate(url.searchParams.get('from'));
    const periodTo = isoDate(url.searchParams.get('to'));
    if (!employeeId || !periodFrom || !periodTo || periodFrom > periodTo) {
      return jsonResponse({ success: false, error: 'Mitarbeiter und gültiger Zeitraum sind erforderlich.' }, 400);
    }

    const { supabase } = await authorize({ request, locals, cookies });
    const entries = await loadEntries(supabase, employeeId, periodFrom, periodTo);
    return jsonResponse({ success: true, entries });
  } catch (error: any) {
    const denied = String(error?.message || '').includes('Payroll access denied');
    return jsonResponse(
      { success: false, error: denied ? 'Keine Berechtigung für Payroll.' : error?.message || 'Stundenansätze konnten nicht geladen werden.' },
      denied ? 403 : errorStatus(error),
    );
  }
};

export const PUT: APIRoute = async ({ request, locals, cookies, params }) => {
  try {
    const employeeId = cleanText(params.id);
    if (!employeeId) return jsonResponse({ success: false, error: 'Mitarbeiter-ID fehlt.' }, 400);

    const { supabase, access } = await authorize({ request, locals, cookies });
    const body = safeObject(await request.json().catch(() => ({})));
    const rates = Array.isArray(body.rates) ? body.rates.map(safeObject) : [];
    if (rates.length > 500) {
      return jsonResponse({ success: false, error: 'Maximal 500 Stundenansätze pro Anfrage.' }, 400);
    }

    const ids = rates.map((row) => cleanText(row.timeEntryId)).filter(Boolean) as string[];
    if (!ids.length) return jsonResponse({ success: true, saved: 0, deleted: 0 });

    const entryResponse = await supabase
      .from('opc_employee_time_entries')
      .select('id,employee_id,status')
      .eq('employee_id', employeeId)
      .in('id', ids);
    throwOnError(entryResponse.error, 'Zeiteinträge konnten nicht validiert werden');

    const validIds = new Set(
      (entryResponse.data || [])
        .filter((row: any) => row.status === 'approved')
        .map((row: any) => String(row.id)),
    );
    const invalidIds = ids.filter((id) => !validIds.has(id));
    if (invalidIds.length) {
      return jsonResponse({ success: false, error: 'Mindestens ein Zeiteintrag gehört nicht zum Mitarbeiter oder ist nicht genehmigt.' }, 400);
    }

    const normalizedRates = rates
      .map((row) => {
        const timeEntryId = cleanText(row.timeEntryId);
        if (!timeEntryId) return null;
        const amount = asNumber(row.hourlyRateChf);
        return {
          time_entry_id: timeEntryId,
          contract_id: cleanText(row.contractId),
          hourly_rate_chf:
            amount === null || amount <= 0
              ? null
              : Math.round((amount + Number.EPSILON) * 10000) / 10000,
          rate_source: cleanText(row.rateSource) || 'manual',
          notes: cleanText(row.notes),
          metadata: {
            ...safeObject(row.metadata),
            source: 'employee_payroll_owner_panel',
          },
        };
      })
      .filter(Boolean);

    const { data, error } = await supabase.rpc('opc_replace_time_entry_pay_rates_atomic', {
      p_employee_id: employeeId,
      p_rates: normalizedRates,
      p_actor_user_id: access.user.id,
    });
    throwOnError(error, 'Stundenansätze konnten nicht atomar gespeichert werden');

    return jsonResponse({
      success: true,
      saved: Number(data?.saved || 0),
      deleted: Number(data?.deleted || 0),
    });
  } catch (error: any) {
    const denied = String(error?.message || '').includes('Payroll access denied');
    return jsonResponse(
      { success: false, error: denied ? 'Keine Berechtigung für Payroll.' : error?.message || 'Stundenansätze konnten nicht gespeichert werden.' },
      denied ? 403 : errorStatus(error),
    );
  }
};
