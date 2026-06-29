import type { APIRoute } from 'astro';
import {
  cleanText,
  errorStatus,
  jsonResponse,
  requireEmployeeHrAccess,
  safeObject,
  throwOnError,
} from '../../../../../lib/opc-employee-api';

export const prerender = false;

type JsonRow = Record<string, any>;

type RateBucket = {
  hourlyRate: number;
  minutes: number;
  amountRaw: number;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function asNumber(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isoDate(value: unknown) {
  const text = cleanText(value);
  return ISO_DATE.test(text) ? text : '';
}

function dateAtNoon(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dateAtNoon(value));
}

function formatHours(minutes: number) {
  return new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minutes / 60);
}

function monthHeading(from: string, to: string) {
  const fromDate = dateAtNoon(from);
  const toDate = dateAtNoon(to);
  const sameMonth =
    fromDate.getUTCFullYear() === toDate.getUTCFullYear() &&
    fromDate.getUTCMonth() === toDate.getUTCMonth();

  if (sameMonth) {
    return {
      month: new Intl.DateTimeFormat('de-CH', {
        month: 'long',
        timeZone: 'UTC',
      }).format(fromDate),
      year: String(fromDate.getUTCFullYear()),
    };
  }

  const sameYear = fromDate.getUTCFullYear() === toDate.getUTCFullYear();
  const shortDate = (date: Date, includeYear: boolean) =>
    new Intl.DateTimeFormat('de-CH', {
      day: '2-digit',
      month: 'long',
      ...(includeYear ? { year: 'numeric' as const } : {}),
      timeZone: 'UTC',
    }).format(date);

  return {
    month: `${shortDate(fromDate, !sameYear)} – ${shortDate(toDate, false)}`,
    year: sameYear ? String(fromDate.getUTCFullYear()) : String(toDate.getUTCFullYear()),
  };
}

function activeOn(contract: JsonRow, workDate: string) {
  const from = isoDate(contract.valid_from) || '0000-01-01';
  const until = isoDate(contract.valid_until) || '9999-12-31';
  const status = (cleanText(contract.status) || '').toLowerCase();
  const salaryType = (cleanText(contract.salary_type) || '').toLowerCase();

  return (
    salaryType === 'hourly' &&
    !['cancelled', 'draft'].includes(status) &&
    from <= workDate &&
    until >= workDate &&
    asNumber(contract.hourly_rate_chf) > 0
  );
}

function contractForDate(contracts: JsonRow[], workDate: string) {
  return contracts
    .filter((contract) => activeOn(contract, workDate))
    .sort((a, b) => {
      const priorityDifference = asNumber(b.__rate_priority) - asNumber(a.__rate_priority);
      if (priorityDifference) return priorityDifference;
      return String(b.valid_from || '').localeCompare(String(a.valid_from || ''));
    })[0] || null;
}

function hourlyRateOverride(employee: JsonRow) {
  const metadata = safeObject(employee.metadata);
  const override = safeObject(metadata.payroll_hourly_rate_override);
  const hourlyRate = asNumber(override.hourly_rate_chf);
  const validFrom = isoDate(override.valid_from);
  const validUntil = isoDate(override.valid_until);

  if (hourlyRate <= 0 || !validFrom) return null;

  return {
    salary_type: 'hourly',
    status: 'active',
    hourly_rate_chf: hourlyRate,
    valid_from: validFrom,
    valid_until: validUntil || null,
    __rate_priority: 1000,
    __rate_source: 'employee_metadata_override',
  };
}

function netMinutes(entry: JsonRow) {
  const stored = asNumber(entry.total_minutes);
  if (stored > 0) return Math.round(stored);

  const startedAt = cleanText(entry.clock_in_at);
  const endedAt = cleanText(entry.clock_out_at);
  if (!startedAt || !endedAt) return 0;

  const started = new Date(startedAt).getTime();
  const ended = new Date(endedAt).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended <= started) return 0;

  const grossMinutes = Math.floor((ended - started) / 60000);
  return Math.max(0, grossMinutes - Math.round(asNumber(entry.break_minutes)));
}

function employeeSalutation(employee: JsonRow) {
  const gender = (cleanText(employee.gender_code) || '').toLowerCase();
  const lastName = cleanText(employee.legal_last_name);
  const fullName = [employee.legal_first_name, employee.legal_last_name]
    .map(cleanText)
    .filter(Boolean)
    .join(' ');

  if (['female', 'f', 'woman', 'weiblich'].includes(gender) && lastName) {
    return `Sehr geehrte Frau ${lastName}`;
  }
  if (['male', 'm', 'man', 'männlich', 'maennlich'].includes(gender) && lastName) {
    return `Sehr geehrter Herr ${lastName}`;
  }
  return fullName ? `Guten Tag ${fullName}` : 'Guten Tag';
}

function safeFilename(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
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

    if (!periodFrom || !periodTo) {
      return jsonResponse(
        { success: false, error: 'Bitte geben Sie einen gültigen Zeitraum von und bis an.' },
        400,
      );
    }
    if (periodFrom > periodTo) {
      return jsonResponse(
        { success: false, error: 'Das Startdatum darf nicht nach dem Enddatum liegen.' },
        400,
      );
    }

    const durationDays = Math.floor(
      (dateAtNoon(periodTo).getTime() - dateAtNoon(periodFrom).getTime()) / 86400000,
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

    const employeeResponse = await supabase
      .from('opc_employees')
      .select('*')
      .eq('id', employeeId)
      .maybeSingle();
    throwOnError(employeeResponse.error, 'Mitarbeiter konnte nicht geladen werden');

    const employee = employeeResponse.data as JsonRow | null;
    if (!employee) {
      return jsonResponse({ success: false, error: 'Mitarbeiter wurde nicht gefunden.' }, 404);
    }
    if (employee.payroll_in_scope === false) {
      return jsonResponse(
        { success: false, error: 'Dieser Mitarbeiter ist vom Payroll-Umfang ausgeschlossen.' },
        400,
      );
    }

    const [addressResponse, contractResponse] = await Promise.all([
      supabase
        .from('opc_employee_addresses')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('address_type', 'residence')
        .order('valid_from', { ascending: false }),
      supabase
        .from('opc_employment_contracts')
        .select('*')
        .eq('employee_id', employeeId)
        .order('valid_from', { ascending: false }),
    ]);

    throwOnError(addressResponse.error, 'Mitarbeiteradresse konnte nicht geladen werden');
    throwOnError(contractResponse.error, 'Arbeitsverträge konnten nicht geladen werden');

    let timeQuery = supabase
      .from('opc_employee_time_entries')
      .select('*')
      .eq('status', 'approved')
      .gte('work_date', periodFrom)
      .lte('work_date', periodTo)
      .order('work_date', { ascending: true })
      .order('created_at', { ascending: true });

    const staffRoleId = cleanText(employee.staff_role_id);
    if (staffRoleId) {
      timeQuery = timeQuery.or(
        `employee_id.eq.${employeeId},staff_role_id.eq.${staffRoleId}`,
      );
    } else {
      timeQuery = timeQuery.eq('employee_id', employeeId);
    }

    const timeResponse = await timeQuery;
    throwOnError(timeResponse.error, 'Genehmigte Arbeitszeiten konnten nicht geladen werden');

    const entries = (timeResponse.data || []).filter((entry: JsonRow) => {
      if (cleanText(entry.employee_id) === employeeId) return true;
      return Boolean(staffRoleId && cleanText(entry.staff_role_id) === staffRoleId);
    });

    const positiveEntries = entries
      .map((entry: JsonRow) => ({ entry, minutes: netMinutes(entry) }))
      .filter(({ minutes }: { minutes: number }) => minutes > 0);

    if (!positiveEntries.length) {
      return jsonResponse(
        {
          success: false,
          error: 'Im gewählten Zeitraum wurden keine genehmigten Arbeitsstunden gefunden.',
        },
        400,
      );
    }

    const contracts = (contractResponse.data || []) as JsonRow[];
    const overrideContract = hourlyRateOverride(employee);
    const rateSources = overrideContract ? [overrideContract, ...contracts] : contracts;
    const buckets = new Map<string, RateBucket>();
    const missingContractDates = new Set<string>();

    for (const { entry, minutes } of positiveEntries) {
      const workDate = isoDate(entry.work_date);
      const contract = contractForDate(rateSources, workDate);
      if (!contract) {
        missingContractDates.add(workDate || cleanText(entry.work_date));
        continue;
      }

      const hourlyRate = asNumber(contract.hourly_rate_chf);
      const key = hourlyRate.toFixed(4);
      const bucket = buckets.get(key) || { hourlyRate, minutes: 0, amountRaw: 0 };
      bucket.minutes += minutes;
      bucket.amountRaw += (minutes / 60) * hourlyRate;
      buckets.set(key, bucket);
    }

    if (missingContractDates.size) {
      return jsonResponse(
        {
          success: false,
          error:
            'Für folgende Arbeitstage wurde kein gültiger Stundenansatz gefunden: ' +
            Array.from(missingContractDates).sort().map(formatDate).join(', '),
        },
        400,
      );
    }

    const rateBreakdown = Array.from(buckets.values())
      .sort((a, b) => a.hourlyRate - b.hourlyRate)
      .map((bucket) => ({
        hourlyRate: roundMoney(bucket.hourlyRate),
        minutes: bucket.minutes,
        hours: roundMoney(bucket.minutes / 60),
        amount: roundMoney(bucket.amountRaw),
      }));

    const totalMinutes = rateBreakdown.reduce((sum, row) => sum + row.minutes, 0);
    const grossSalary = roundMoney(
      Array.from(buckets.values()).reduce((sum, row) => sum + row.amountRaw, 0),
    );

    const addressRows = (addressResponse.data || []) as JsonRow[];
    const address =
      addressRows.find((row) => {
        const from = isoDate(row.valid_from) || '0000-01-01';
        const until = isoDate(row.valid_until) || '9999-12-31';
        return from <= periodTo && until >= periodFrom;
      }) || addressRows[0] || {};

    const fullName = [employee.legal_first_name, employee.legal_last_name]
      .map(cleanText)
      .filter(Boolean)
      .join(' ');
    const heading = monthHeading(periodFrom, periodTo);

    const earnings = rateBreakdown.map((row) => ({
      label: 'Grundlohn (Stundenlohn)',
      basis: `${formatHours(row.minutes)} Stunden`,
      rate: `CHF ${row.hourlyRate.toFixed(2)} / Std.`,
      amount: row.amount,
    }));

    const payroll = {
      document: {
        city: 'Basel',
        date: formatDate(new Date().toISOString().slice(0, 10)),
      },
      employee: {
        fullName,
        street: [address.street, address.house_number].map(cleanText).filter(Boolean).join(' '),
        postalCode: cleanText(address.postal_code),
        city: cleanText(address.city),
        country: cleanText(address.country_code) || 'CH',
        salutationLine: employeeSalutation(employee),
        employeeNumber: cleanText(employee.employee_number),
        ahvNumber: cleanText(employee.ahv_number),
      },
      payroll: {
        month: heading.month,
        year: heading.year,
        periodFrom: formatDate(periodFrom),
        periodTo: formatDate(periodTo),
        grossSalary,
        totalDeductions: 0,
        netSalary: grossSalary,
        totalReimbursements: 0,
        otherAdjustments: 0,
        payout: grossSalary,
        earnings,
        deductions: [],
        reimbursements: [],
      },
    };

    const fileIdentity = cleanText(employee.employee_number) || fullName || employeeId;
    const filename = safeFilename(
      `Lohnabrechnung_${fileIdentity}_${periodFrom}_${periodTo}.pdf`,
    );

    return jsonResponse({
      success: true,
      payroll,
      filename,
      summary: {
        periodFrom,
        periodTo,
        entriesCount: positiveEntries.length,
        totalMinutes,
        totalHours: roundMoney(totalMinutes / 60),
        grossSalary,
        rateBreakdown,
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
