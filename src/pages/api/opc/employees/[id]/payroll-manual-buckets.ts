import type { APIRoute } from 'astro';
import {
  cleanText,
  errorStatus,
  jsonResponse,
  requireEmployeeHrAccess,
  safeArray,
  safeObject,
  throwOnError,
} from '../../../../../lib/opc-employee-api';

export const prerender = false;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORIES = new Set(['maintenance', 'special', 'other']);

function isoDate(value: unknown) {
  const text = cleanText(value) || '';
  return ISO_DATE.test(text) ? text : '';
}

function number(value: unknown) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundFour(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function entryMinutes(entry: Record<string, any>) {
  const stored = number(entry.total_minutes);
  if (stored > 0) return Math.round(stored);

  const startedAt = cleanText(entry.clock_in_at);
  const endedAt = cleanText(entry.clock_out_at);
  if (!startedAt || !endedAt) return 0;

  const started = new Date(startedAt).getTime();
  const ended = new Date(endedAt).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended <= started) return 0;

  return Math.max(
    0,
    Math.floor((ended - started) / 60000) - Math.round(number(entry.break_minutes)),
  );
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

async function loadPeriod(supabase: any, employeeId: string, periodFrom: string, periodTo: string) {
  const [bucketResponse, entryResponse] = await Promise.all([
    supabase
      .from('opc_payroll_manual_rate_buckets')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('period_from', periodFrom)
      .eq('period_to', periodTo)
      .eq('status', 'active')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('opc_employee_time_entries')
      .select('id,work_date,total_minutes,clock_in_at,clock_out_at,break_minutes,status,metadata')
      .eq('employee_id', employeeId)
      .eq('status', 'approved')
      .gte('work_date', periodFrom)
      .lte('work_date', periodTo)
      .order('work_date', { ascending: true }),
  ]);

  throwOnError(bucketResponse.error, 'Manuelle Payroll-Stunden konnten nicht geladen werden');
  throwOnError(entryResponse.error, 'Genehmigte Arbeitszeiten konnten nicht geladen werden');

  const buckets = bucketResponse.data || [];
  const trackedMinutes = (entryResponse.data || []).reduce(
    (sum: number, entry: Record<string, any>) => sum + entryMinutes(entry),
    0,
  );

  return {
    mode: buckets.length ? 'manual' : 'time_entries',
    buckets,
    trackedMinutes,
    trackedHours: roundFour(trackedMinutes / 60),
  };
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
    const payload = await loadPeriod(supabase, employeeId, periodFrom, periodTo);
    return jsonResponse({ success: true, ...payload });
  } catch (error: any) {
    console.error('[opc/employees/id/payroll-manual-buckets] GET failed', error);
    const denied = String(error?.message || '').includes('Payroll access denied');
    return jsonResponse(
      { success: false, error: denied ? 'Keine Berechtigung für Payroll.' : error?.message || 'Manuelle Payroll-Stunden konnten nicht geladen werden.' },
      denied ? 403 : errorStatus(error),
    );
  }
};

export const PUT: APIRoute = async ({ request, locals, cookies, params }) => {
  try {
    const employeeId = cleanText(params.id);
    if (!employeeId) {
      return jsonResponse({ success: false, error: 'Mitarbeiter-ID fehlt.' }, 400);
    }

    const body = safeObject(await request.json().catch(() => ({})));
    const periodFrom = isoDate(body.periodFrom);
    const periodTo = isoDate(body.periodTo);
    const mode = cleanText(body.mode) || 'manual';

    if (!periodFrom || !periodTo || periodFrom > periodTo) {
      return jsonResponse({ success: false, error: 'Ungültiger Abrechnungszeitraum.' }, 400);
    }
    if (!['manual', 'time_entries'].includes(mode)) {
      return jsonResponse({ success: false, error: 'Ungültiger Payroll-Eingabemodus.' }, 400);
    }

    const { supabase } = await authorize({ request, locals, cookies });

    let normalized: Array<Record<string, any>> = [];
    if (mode === 'manual') {
      const rows = safeArray(body.buckets);
      if (!rows.length) {
        return jsonResponse({ success: false, error: 'Im manuellen Modus ist mindestens eine Lohnzeile erforderlich.' }, 400);
      }
      if (rows.length > 50) {
        return jsonResponse({ success: false, error: 'Maximal 50 manuelle Stundenansätze pro Lohnlauf sind erlaubt.' }, 400);
      }

      normalized = rows.map((raw, index) => {
        const row = safeObject(raw);
        const hours = number(row.hours);
        const hourlyRateChf = number(row.hourlyRateChf);
        const cleaningCategory = cleanText(row.cleaningCategory) || 'other';

        if (!(hours > 0 && hours <= 1000)) {
          throw new Error(`Zeile ${index + 1}: Stunden müssen grösser 0 sein.`);
        }
        if (!(hourlyRateChf > 0 && hourlyRateChf <= 10000)) {
          throw new Error(`Zeile ${index + 1}: Stundenansatz muss grösser 0 sein.`);
        }
        if (!CATEGORIES.has(cleaningCategory)) {
          throw new Error(`Zeile ${index + 1}: Ungültige Reinigungskategorie.`);
        }

        return {
          hours: roundFour(hours),
          hourly_rate_chf: Math.round((hourlyRateChf + Number.EPSILON) * 10000) / 10000,
          cleaning_category: cleaningCategory,
          label: cleanText(row.label),
          notes: cleanText(row.notes),
          sort_order: number(row.sortOrder) || (index + 1) * 10,
        };
      });
    }

    const replaceResponse = await supabase.rpc('opc_replace_payroll_manual_rate_buckets', {
      p_employee_id: employeeId,
      p_period_from: periodFrom,
      p_period_to: periodTo,
      p_buckets: normalized,
      p_reason: cleanText(body.reason),
    });
    throwOnError(replaceResponse.error, 'Manuelle Payroll-Stunden konnten nicht gespeichert werden');

    const payload = await loadPeriod(supabase, employeeId, periodFrom, periodTo);
    return jsonResponse({
      success: true,
      saved: normalized.length,
      ...payload,
    });
  } catch (error: any) {
    console.error('[opc/employees/id/payroll-manual-buckets] PUT failed', error);
    const denied = String(error?.message || '').includes('Payroll access denied');
    return jsonResponse(
      { success: false, error: denied ? 'Keine Berechtigung für Payroll.' : error?.message || 'Manuelle Payroll-Stunden konnten nicht gespeichert werden.' },
      denied ? 403 : errorStatus(error),
    );
  }
};
