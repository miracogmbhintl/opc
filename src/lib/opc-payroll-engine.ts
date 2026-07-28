import {
  cleanText,
  safeObject,
  throwOnError,
} from './opc-employee-api';

type JsonRow = Record<string, any>;

export type PayrollLine = {
  lineGroup: 'earning' | 'employee_deduction' | 'employer_contribution' | 'reimbursement' | 'adjustment';
  lineCode: string;
  description: string;
  basisAmount: number | null;
  quantity: number | null;
  rate: number | null;
  employeeAmount: number;
  employerAmount: number;
  sortOrder: number;
  source: string;
  metadata?: JsonRow;
};

export type PayrollCalculation = {
  employee: JsonRow;
  address: JsonRow;
  contract: JsonRow;
  payrollProfile: JsonRow;
  ruleSet: JsonRow;
  periodFrom: string;
  periodTo: string;
  salaryType: 'hourly' | 'monthly';
  entriesCount: number;
  totalMinutes: number;
  totalHours: number;
  payableDays: number;
  periodWorkingDays: number;
  baseSalary: number;
  grossSalary: number;
  employeeDeductions: number;
  netSalary: number;
  reimbursements: number;
  otherAdjustments: number;
  payout: number;
  employerContributions: number;
  totalEmployerCost: number;
  grossPerHour: number | null;
  netPerHour: number | null;
  employerCostPerHour: number | null;
  rateBreakdown: Array<{
    hourlyRate: number;
    minutes: number;
    hours: number;
    amount: number;
    contractId: string | null;
    source: string;
    timeEntryCount: number;
  }>;
  lines: PayrollLine[];
  warnings: string[];
  payrollDocument: JsonRow;
  filename: string;
  snapshot: JsonRow;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function asNumber(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundFour(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function isoDate(value: unknown) {
  const text = cleanText(value) || '';
  return ISO_DATE.test(text) ? text : '';
}

function dateAtNoon(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = dateAtNoon(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

function maxDate(a: string, b: string) {
  return a >= b ? a : b;
}

function minDate(a: string, b: string) {
  return a <= b ? a : b;
}

function overlapRange(
  periodFrom: string,
  periodTo: string,
  validFrom: string,
  validUntil: string,
) {
  const from = maxDate(periodFrom, validFrom || '0000-01-01');
  const to = minDate(periodTo, validUntil || '9999-12-31');
  return from <= to ? { from, to } : null;
}

function countCalendarDays(from: string, to: string) {
  const start = dateAtNoon(from).getTime();
  const end = dateAtNoon(to).getTime();
  return Math.floor((end - start) / 86400000) + 1;
}

function countWorkingDays(from: string, to: string) {
  let total = 0;
  let cursor = from;
  while (cursor <= to) {
    const day = dateAtNoon(cursor).getUTCDay();
    if (day !== 0 && day !== 6) total += 1;
    cursor = addDays(cursor, 1);
  }
  return total;
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

  return {
    month: `${formatDate(from)} – ${formatDate(to)}`,
    year: String(toDate.getUTCFullYear()),
  };
}

function safeFilename(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
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

function activeRowOn(row: JsonRow, date: string) {
  const status = (cleanText(row.status) || 'active').toLowerCase();
  if (['cancelled', 'canceled', 'draft', 'inactive', 'terminated'].includes(status)) return false;
  const from = isoDate(row.valid_from) || '0000-01-01';
  const until = isoDate(row.valid_until) || '9999-12-31';
  return from <= date && until >= date;
}

function contractForDate(contracts: JsonRow[], date: string, salaryType?: string) {
  return contracts
    .filter((row) => activeRowOn(row, date))
    .filter((row) => !salaryType || String(row.salary_type || '').toLowerCase() === salaryType)
    .sort((a, b) => String(b.valid_from || '').localeCompare(String(a.valid_from || '')))[0] || null;
}

function profileForPeriod(profiles: JsonRow[], periodFrom: string, periodTo: string) {
  return profiles
    .filter((row) => {
      const status = (cleanText(row.status) || 'active').toLowerCase();
      if (status !== 'active') return false;
      const from = isoDate(row.valid_from) || '0000-01-01';
      const until = isoDate(row.valid_until) || '9999-12-31';
      return from <= periodTo && until >= periodFrom;
    })
    .sort((a, b) => String(b.valid_from || '').localeCompare(String(a.valid_from || '')))[0] || {};
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

  return Math.max(
    0,
    Math.floor((ended - started) / 60000) - Math.round(asNumber(entry.break_minutes)),
  );
}

function percentageAmount(basis: number, rate: number) {
  return roundMoney((basis * rate) / 100);
}

function line(
  lineGroup: PayrollLine['lineGroup'],
  lineCode: string,
  description: string,
  options: Partial<PayrollLine> = {},
): PayrollLine {
  return {
    lineGroup,
    lineCode,
    description,
    basisAmount: options.basisAmount ?? null,
    quantity: options.quantity ?? null,
    rate: options.rate ?? null,
    employeeAmount: roundMoney(options.employeeAmount || 0),
    employerAmount: roundMoney(options.employerAmount || 0),
    sortOrder: options.sortOrder ?? 100,
    source: options.source || 'payroll_engine',
    metadata: options.metadata || {},
  };
}

function documentLine(item: PayrollLine) {
  const amount = item.lineGroup === 'employer_contribution'
    ? item.employerAmount
    : item.employeeAmount;
  return {
    label: item.description,
    basis: item.basisAmount === null
      ? item.quantity === null
        ? ''
        : `${item.quantity}`
      : `CHF ${item.basisAmount.toFixed(2)}`,
    rate: item.rate === null ? '' : `${item.rate.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')} %`,
    amount,
  };
}

async function loadPayrollData(
  supabase: any,
  employeeId: string,
  periodFrom: string,
  periodTo: string,
) {
  const [employeeResponse, addressResponse, contractResponse, profileResponse, ruleSetResponse] =
    await Promise.all([
      supabase.from('opc_employees').select('*').eq('id', employeeId).maybeSingle(),
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
      supabase
        .from('opc_employee_payroll_profiles')
        .select('*')
        .eq('employee_id', employeeId)
        .order('valid_from', { ascending: false }),
      supabase
        .from('opc_payroll_rule_sets')
        .select('*')
        .eq('status', 'active')
        .lte('valid_from', periodTo)
        .or(`valid_until.is.null,valid_until.gte.${periodFrom}`)
        .order('valid_from', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  throwOnError(employeeResponse.error, 'Mitarbeiter konnte nicht geladen werden');
  throwOnError(addressResponse.error, 'Mitarbeiteradresse konnte nicht geladen werden');
  throwOnError(contractResponse.error, 'Arbeitsverträge konnten nicht geladen werden');
  throwOnError(profileResponse.error, 'Payroll-Profil konnte nicht geladen werden');
  throwOnError(ruleSetResponse.error, 'Payroll-Regelsatz konnte nicht geladen werden');

  const employee = employeeResponse.data as JsonRow | null;
  if (!employee) throw new Error('Mitarbeiter wurde nicht gefunden.');
  if (employee.payroll_in_scope === false) {
    throw new Error('Dieser Mitarbeiter ist vom Payroll-Umfang ausgeschlossen.');
  }

  const contracts = (contractResponse.data || []) as JsonRow[];
  const contract = contractForDate(contracts, periodTo) || contractForDate(contracts, periodFrom);
  if (!contract) {
    throw new Error('Für den Abrechnungszeitraum besteht kein aktiver Arbeitsvertrag.');
  }

  const salaryType = String(contract.salary_type || '').toLowerCase();
  if (!['hourly', 'monthly'].includes(salaryType)) {
    throw new Error(`Nicht unterstützte Lohnart im Vertrag: ${salaryType || 'leer'}.`);
  }

  const profile = profileForPeriod(profileResponse.data || [], periodFrom, periodTo);
  const ruleSet = ruleSetResponse.data as JsonRow | null;
  if (!ruleSet) {
    throw new Error('Für den Abrechnungszeitraum wurde kein aktiver Payroll-Regelsatz gefunden.');
  }

  const timeResponse = await supabase
    .from('opc_employee_time_entries')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('status', 'approved')
    .gte('work_date', periodFrom)
    .lte('work_date', periodTo)
    .order('work_date', { ascending: true })
    .order('created_at', { ascending: true });
  throwOnError(timeResponse.error, 'Genehmigte Arbeitszeiten konnten nicht geladen werden');

  const entries = (timeResponse.data || []) as JsonRow[];
  let payRates: JsonRow[] = [];
  const entryIds = entries.map((entry) => cleanText(entry.id)).filter(Boolean) as string[];
  if (entryIds.length) {
    const payRateResponse = await supabase
      .from('opc_time_entry_pay_rates')
      .select('*')
      .eq('employee_id', employeeId)
      .in('time_entry_id', entryIds);
    throwOnError(payRateResponse.error, 'Zeiteintrag-Lohnansätze konnten nicht geladen werden');
    payRates = (payRateResponse.data || []) as JsonRow[];
  }

  const addressRows = (addressResponse.data || []) as JsonRow[];
  const address =
    addressRows.find((row) => {
      const from = isoDate(row.valid_from) || '0000-01-01';
      const until = isoDate(row.valid_until) || '9999-12-31';
      return from <= periodTo && until >= periodFrom;
    }) || addressRows[0] || {};

  return {
    employee,
    address,
    contracts,
    contract,
    profile,
    ruleSet,
    entries,
    payRates,
  };
}

export async function calculateEmployeePayroll({
  supabase,
  employeeId,
  periodFrom,
  periodTo,
}: {
  supabase: any;
  employeeId: string;
  periodFrom: string;
  periodTo: string;
}): Promise<PayrollCalculation> {
  if (!ISO_DATE.test(periodFrom) || !ISO_DATE.test(periodTo) || periodFrom > periodTo) {
    throw new Error('Ungültiger Abrechnungszeitraum.');
  }

  const { employee, address, contracts, contract, profile, ruleSet, entries, payRates } =
    await loadPayrollData(supabase, employeeId, periodFrom, periodTo);

  const positiveEntries = entries
    .map((entry) => ({ entry, minutes: netMinutes(entry) }))
    .filter(({ minutes }) => minutes > 0);
  const totalMinutes = positiveEntries.reduce((sum, item) => sum + item.minutes, 0);
  const totalHours = roundFour(totalMinutes / 60);
  const salaryType = String(contract.salary_type).toLowerCase() as 'hourly' | 'monthly';
  const lines: PayrollLine[] = [];
  const warnings: string[] = [];
  const rateBreakdown: PayrollCalculation['rateBreakdown'] = [];

  let baseSalary = 0;
  let payableDays = 0;
  let periodWorkingDays = countWorkingDays(periodFrom, periodTo);

  if (salaryType === 'hourly') {
    if (!positiveEntries.length) {
      throw new Error('Im Zeitraum bestehen keine genehmigten Arbeitsstunden.');
    }

    const buckets = new Map<string, {
      hourlyRate: number;
      minutes: number;
      amount: number;
      contractId: string | null;
      source: string;
      timeEntryIds: string[];
    }>();
    const missingDates = new Set<string>();
    const payRateByEntryId = new Map(
      payRates.map((row) => [String(row.time_entry_id), row]),
    );

    for (const { entry, minutes } of positiveEntries) {
      const workDate = isoDate(entry.work_date);
      const activeContract = contractForDate(contracts, workDate, 'hourly');
      const entryRate = payRateByEntryId.get(String(entry.id));
      const hourlyRate = entryRate && asNumber(entryRate.hourly_rate_chf) > 0
        ? asNumber(entryRate.hourly_rate_chf)
        : asNumber(activeContract?.hourly_rate_chf);
      const contractId = cleanText(entryRate?.contract_id) || cleanText(activeContract?.id);
      const source = entryRate
        ? cleanText(entryRate.rate_source) || 'time_entry_rate'
        : 'employment_contract';

      if (hourlyRate <= 0) {
        missingDates.add(workDate || String(entry.work_date || ''));
        continue;
      }
      if (entryRate && cleanText(entryRate.employee_id) !== employeeId) {
        throw new Error(`Ungültiger Lohnansatz für Zeiteintrag ${entry.id}: Mitarbeiter stimmt nicht überein.`);
      }

      const key = `${source}:${contractId || 'none'}:${hourlyRate.toFixed(4)}`;
      const bucket = buckets.get(key) || {
        hourlyRate,
        minutes: 0,
        amount: 0,
        contractId,
        source,
        timeEntryIds: [],
      };
      bucket.minutes += minutes;
      bucket.amount += (minutes / 60) * hourlyRate;
      bucket.timeEntryIds.push(String(entry.id));
      buckets.set(key, bucket);
    }

    if (missingDates.size) {
      throw new Error(
        'Für folgende Arbeitstage wurde kein gültiger Stundenlohnvertrag gefunden: ' +
          Array.from(missingDates).sort().map(formatDate).join(', '),
      );
    }

    for (const bucket of Array.from(buckets.values()).sort((a, b) => a.hourlyRate - b.hourlyRate)) {
      const amount = roundMoney(bucket.amount);
      baseSalary += amount;
      rateBreakdown.push({
        hourlyRate: roundMoney(bucket.hourlyRate),
        minutes: bucket.minutes,
        hours: roundFour(bucket.minutes / 60),
        amount,
        contractId: bucket.contractId,
        source: bucket.source,
        timeEntryCount: bucket.timeEntryIds.length,
      });
      lines.push(line('earning', 'BASIC_HOURLY_PAY', 'Grundlohn Stundenlohn', {
        basisAmount: bucket.hourlyRate,
        quantity: roundFour(bucket.minutes / 60),
        employeeAmount: amount,
        sortOrder: 10,
        source: bucket.source,
        metadata: {
          contract_id: bucket.contractId,
          minutes: bucket.minutes,
          time_entry_ids: bucket.timeEntryIds,
        },
      }));
    }

    const holidayRate = asNumber(contract.holiday_pay_percentage);
    const publicHolidayRate = asNumber(contract.public_holiday_percentage);
    const thirteenthRate = asNumber(contract.thirteenth_salary_percentage);
    const rateComposition = String(contract.rate_composition || 'base_excluding_supplements');

    if (rateComposition !== 'all_inclusive') {
      if (holidayRate > 0) {
        const amount = percentageAmount(baseSalary, holidayRate);
        lines.push(line('earning', 'HOLIDAY_PAY', 'Ferienzuschlag', {
          basisAmount: roundMoney(baseSalary), rate: holidayRate, employeeAmount: amount, sortOrder: 20,
          source: 'employment_contract',
        }));
      }
      if (publicHolidayRate > 0) {
        const amount = percentageAmount(baseSalary, publicHolidayRate);
        lines.push(line('earning', 'PUBLIC_HOLIDAY_PAY', 'Feiertagszuschlag', {
          basisAmount: roundMoney(baseSalary), rate: publicHolidayRate, employeeAmount: amount, sortOrder: 30,
          source: 'employment_contract',
        }));
      }
      if (thirteenthRate > 0) {
        const monthlyAccrualRate = thirteenthRate / 12;
        const amount = percentageAmount(baseSalary, monthlyAccrualRate);
        lines.push(line('earning', 'THIRTEENTH_SALARY', 'Anteil 13. Monatslohn', {
          basisAmount: roundMoney(baseSalary), rate: monthlyAccrualRate, employeeAmount: amount, sortOrder: 40,
          source: 'employment_contract',
        }));
      }
    }
  } else {
    const monthlySalary = asNumber(contract.monthly_salary_chf);
    if (monthlySalary <= 0) {
      throw new Error('Der aktive Monatslohnvertrag enthält keinen gültigen Monatslohn.');
    }

    const contractOverlap = overlapRange(
      periodFrom,
      periodTo,
      isoDate(contract.valid_from) || periodFrom,
      isoDate(contract.valid_until) || periodTo,
    );
    if (!contractOverlap) {
      throw new Error('Der Monatslohnvertrag überschneidet den Abrechnungszeitraum nicht.');
    }

    const method = String(profile.monthly_salary_proration_method || 'working_days');
    let divisor = 1;
    let payable = 1;
    if (method === 'working_days') {
      divisor = Math.max(1, countWorkingDays(periodFrom, periodTo));
      payable = countWorkingDays(contractOverlap.from, contractOverlap.to);
      periodWorkingDays = divisor;
      payableDays = payable;
    } else if (method === 'calendar_days') {
      divisor = Math.max(1, countCalendarDays(periodFrom, periodTo));
      payable = countCalendarDays(contractOverlap.from, contractOverlap.to);
      periodWorkingDays = divisor;
      payableDays = payable;
    } else {
      payableDays = periodWorkingDays;
    }

    const factor = method === 'none' ? 1 : payable / divisor;
    baseSalary = roundMoney(monthlySalary * factor);
    lines.push(line('earning', 'MONTHLY_SALARY', 'Monatslohn', {
      basisAmount: monthlySalary,
      quantity: roundFour(factor),
      employeeAmount: baseSalary,
      sortOrder: 10,
      source: 'employment_contract',
      metadata: {
        contract_id: contract.id,
        proration_method: method,
        payable_days: payableDays,
        period_days: periodWorkingDays,
      },
    }));

    if (profile.pay_thirteenth_monthly === true && contract.monthly_salary_includes_13th !== true) {
      const thirteenthRate = asNumber(contract.thirteenth_salary_percentage);
      if (thirteenthRate > 0) {
        const monthlyAccrualRate = thirteenthRate / 12;
        const amount = percentageAmount(baseSalary, monthlyAccrualRate);
        lines.push(line('earning', 'THIRTEENTH_SALARY', 'Anteil 13. Monatslohn', {
          basisAmount: baseSalary,
          rate: monthlyAccrualRate,
          employeeAmount: amount,
          sortOrder: 20,
          source: 'employment_contract',
        }));
      }
    }

    if (totalMinutes === 0) {
      warnings.push('Für den Fixlohnzeitraum bestehen keine genehmigten Arbeitsstunden; Kosten pro Stunde können nicht berechnet werden.');
    }
  }

  const familyAllowance = asNumber(profile.family_allowance_chf);
  if (familyAllowance !== 0) {
    lines.push(line('earning', 'FAMILY_ALLOWANCE', 'Familien-/Kinderzulage', {
      employeeAmount: familyAllowance,
      sortOrder: 50,
      source: 'employee_payroll_profile',
    }));
  }

  const grossSalary = roundMoney(
    lines
      .filter((item) => item.lineGroup === 'earning')
      .reduce((sum, item) => sum + item.employeeAmount, 0),
  );

  const contributionBasis = roundMoney(
    lines
      .filter((item) => item.lineGroup === 'earning' && item.lineCode !== 'FAMILY_ALLOWANCE')
      .reduce((sum, item) => sum + item.employeeAmount, 0),
  );

  const ahvEmployeeRate = asNumber(ruleSet.ahv_employee_rate);
  const ahvEmployerRate = asNumber(ruleSet.ahv_employer_rate);
  const alvEmployeeRate = asNumber(ruleSet.alv_employee_rate);
  const alvEmployerRate = asNumber(ruleSet.alv_employer_rate);
  const monthlyAlvCap = asNumber(ruleSet.alv_annual_max_chf) / 12;
  const periodCalendarDays = countCalendarDays(periodFrom, periodTo);
  const proportionalAlvCap = roundMoney(monthlyAlvCap * Math.min(1, periodCalendarDays / 30));
  const alvBasis = Math.min(contributionBasis, proportionalAlvCap || contributionBasis);

  const ahvEmployee = percentageAmount(contributionBasis, ahvEmployeeRate);
  const ahvEmployer = percentageAmount(contributionBasis, ahvEmployerRate);
  const alvEmployee = percentageAmount(alvBasis, alvEmployeeRate);
  const alvEmployer = percentageAmount(alvBasis, alvEmployerRate);

  lines.push(line('employee_deduction', 'AHV_IV_EO', 'AHV/IV/EO Arbeitnehmer', {
    basisAmount: contributionBasis, rate: ahvEmployeeRate, employeeAmount: ahvEmployee, sortOrder: 110,
    source: 'payroll_rule_set', metadata: { rule_set_id: ruleSet.id },
  }));
  lines.push(line('employer_contribution', 'AHV_IV_EO_EMPLOYER', 'AHV/IV/EO Arbeitgeber', {
    basisAmount: contributionBasis, rate: ahvEmployerRate, employerAmount: ahvEmployer, sortOrder: 210,
    source: 'payroll_rule_set', metadata: { rule_set_id: ruleSet.id },
  }));
  lines.push(line('employee_deduction', 'ALV', 'ALV Arbeitnehmer', {
    basisAmount: alvBasis, rate: alvEmployeeRate, employeeAmount: alvEmployee, sortOrder: 120,
    source: 'payroll_rule_set', metadata: { rule_set_id: ruleSet.id, annual_cap_chf: ruleSet.alv_annual_max_chf },
  }));
  lines.push(line('employer_contribution', 'ALV_EMPLOYER', 'ALV Arbeitgeber', {
    basisAmount: alvBasis, rate: alvEmployerRate, employerAmount: alvEmployer, sortOrder: 220,
    source: 'payroll_rule_set', metadata: { rule_set_id: ruleSet.id, annual_cap_chf: ruleSet.alv_annual_max_chf },
  }));

  const periodWeeks = Math.max(1 / 7, periodCalendarDays / 7);
  const actualAverageWeeklyHours = totalHours / periodWeeks;
  const contractualWeeklyHours = Math.max(
    asNumber(contract.weekly_hours),
    asNumber(contract.reference_weekly_hours),
    asNumber(contract.guaranteed_weekly_hours),
  );
  const nbuThreshold = asNumber(ruleSet.nbu_weekly_hours_threshold);
  const nbuEligible = Math.max(contractualWeeklyHours, actualAverageWeeklyHours) >= nbuThreshold;
  if (!nbuEligible && (asNumber(profile.nbu_employee_rate) > 0 || asNumber(profile.nbu_employer_rate) > 0)) {
    warnings.push(`NBU wurde nicht berechnet, weil die Wochenstunden unter ${nbuThreshold.toFixed(2)} Stunden liegen.`);
  }

  const profileRatePairs: Array<{
    code: string;
    employerCode: string;
    label: string;
    employeeRate: number;
    employerRate: number;
    sort: number;
  }> = [
    {
      code: 'NBU', employerCode: 'NBU_EMPLOYER', label: 'NBU',
      employeeRate: nbuEligible ? asNumber(profile.nbu_employee_rate) : 0,
      employerRate: nbuEligible ? asNumber(profile.nbu_employer_rate) : 0,
      sort: 130,
    },
    {
      code: 'KTG', employerCode: 'KTG_EMPLOYER', label: 'KTG',
      employeeRate: asNumber(profile.ktg_employee_rate), employerRate: asNumber(profile.ktg_employer_rate), sort: 140,
    },
    {
      code: 'GAV', employerCode: 'GAV_EMPLOYER', label: 'GAV-Beitrag',
      employeeRate: asNumber(profile.gav_employee_rate), employerRate: asNumber(profile.gav_employer_rate), sort: 150,
    },
  ];

  for (const item of profileRatePairs) {
    if (item.employeeRate > 0) {
      lines.push(line('employee_deduction', item.code, `${item.label} Arbeitnehmer`, {
        basisAmount: contributionBasis,
        rate: item.employeeRate,
        employeeAmount: percentageAmount(contributionBasis, item.employeeRate),
        sortOrder: item.sort,
        source: 'employee_payroll_profile',
        metadata: { payroll_profile_id: profile.id || null },
      }));
    }
    if (item.employerRate > 0) {
      lines.push(line('employer_contribution', item.employerCode, `${item.label} Arbeitgeber`, {
        basisAmount: contributionBasis,
        rate: item.employerRate,
        employerAmount: percentageAmount(contributionBasis, item.employerRate),
        sortOrder: item.sort + 100,
        source: 'employee_payroll_profile',
        metadata: { payroll_profile_id: profile.id || null },
      }));
    }
  }

  const bvgEmployee = asNumber(profile.bvg_employee_amount_chf);
  const bvgEmployer = asNumber(profile.bvg_employer_amount_chf);
  const annualizedContributionBasis = contributionBasis * 12;
  if (
    annualizedContributionBasis >= asNumber(ruleSet.bvg_entry_threshold_chf) &&
    bvgEmployee <= 0 &&
    bvgEmployer <= 0
  ) {
    warnings.push('Der hochgerechnete Lohn erreicht die BVG-Eintrittsschwelle, aber es sind keine BVG-Beträge hinterlegt. Bitte Vorsorgeausweis prüfen.');
  }
  if (bvgEmployee > 0) {
    lines.push(line('employee_deduction', 'BVG', 'BVG Arbeitnehmer', {
      employeeAmount: bvgEmployee,
      sortOrder: 160,
      source: 'employee_payroll_profile',
    }));
  }
  if (bvgEmployer > 0) {
    lines.push(line('employer_contribution', 'BVG_EMPLOYER', 'BVG Arbeitgeber', {
      employerAmount: bvgEmployer,
      sortOrder: 260,
      source: 'employee_payroll_profile',
    }));
  }

  if (profile.source_tax_subject === true) {
    const fixed = asNumber(profile.source_tax_fixed_amount_chf);
    const rate = asNumber(profile.source_tax_rate);
    const amount = fixed > 0 ? roundMoney(fixed) : percentageAmount(grossSalary, rate);
    if (amount > 0) {
      lines.push(line('employee_deduction', 'SOURCE_TAX', 'Quellensteuer', {
        basisAmount: fixed > 0 ? null : grossSalary,
        rate: fixed > 0 ? null : rate,
        employeeAmount: amount,
        sortOrder: 170,
        source: 'employee_payroll_profile',
        metadata: {
          canton: profile.source_tax_canton || null,
          tariff_code: profile.source_tax_tariff_code || null,
          fixed_amount: fixed > 0,
        },
      }));
    } else {
      warnings.push('Mitarbeiter ist quellensteuerpflichtig, aber es ist weder ein Satz noch ein fixer Quellensteuerbetrag hinterlegt.');
    }
  }

  const advance = asNumber(profile.advance_deduction_chf);
  if (advance > 0) {
    lines.push(line('employee_deduction', 'ADVANCE', 'Vorschuss / bereits ausbezahlt', {
      employeeAmount: advance,
      sortOrder: 180,
      source: 'employee_payroll_profile',
    }));
  }

  const otherEmployeeDeduction = asNumber(profile.other_employee_deduction_chf);
  if (otherEmployeeDeduction > 0) {
    lines.push(line('employee_deduction', 'OTHER_DEDUCTION', 'Weitere Abzüge', {
      employeeAmount: otherEmployeeDeduction,
      sortOrder: 190,
      source: 'employee_payroll_profile',
    }));
  }

  const reimbursement = asNumber(profile.expense_reimbursement_chf);
  if (reimbursement !== 0) {
    lines.push(line('reimbursement', 'EXPENSE_REIMBURSEMENT', 'Spesen / Rückerstattung', {
      employeeAmount: reimbursement,
      sortOrder: 310,
      source: 'employee_payroll_profile',
    }));
  }

  const otherAdjustment = asNumber(profile.other_adjustment_chf);
  if (otherAdjustment !== 0) {
    lines.push(line('adjustment', 'OTHER_ADJUSTMENT', 'Weitere Bezüge / Abzüge', {
      employeeAmount: otherAdjustment,
      sortOrder: 320,
      source: 'employee_payroll_profile',
    }));
  }

  const otherEmployerCost = asNumber(profile.other_employer_cost_chf);
  if (otherEmployerCost > 0) {
    lines.push(line('employer_contribution', 'OTHER_EMPLOYER_COST', 'Weitere Arbeitgeberkosten', {
      employerAmount: otherEmployerCost,
      sortOrder: 290,
      source: 'employee_payroll_profile',
    }));
  }

  const employeeDeductions = roundMoney(
    lines
      .filter((item) => item.lineGroup === 'employee_deduction')
      .reduce((sum, item) => sum + item.employeeAmount, 0),
  );
  const netSalary = roundMoney(grossSalary - employeeDeductions);
  const reimbursements = roundMoney(
    lines
      .filter((item) => item.lineGroup === 'reimbursement')
      .reduce((sum, item) => sum + item.employeeAmount, 0),
  );
  const otherAdjustments = roundMoney(
    lines
      .filter((item) => item.lineGroup === 'adjustment')
      .reduce((sum, item) => sum + item.employeeAmount, 0),
  );
  const payout = roundMoney(netSalary + reimbursements + otherAdjustments);
  const employerContributions = roundMoney(
    lines
      .filter((item) => item.lineGroup === 'employer_contribution')
      .reduce((sum, item) => sum + item.employerAmount, 0),
  );
  const totalEmployerCost = roundMoney(grossSalary + employerContributions + reimbursements);

  const grossPerHour = totalMinutes > 0 ? roundFour(grossSalary / (totalMinutes / 60)) : null;
  const netPerHour = totalMinutes > 0 ? roundFour(netSalary / (totalMinutes / 60)) : null;
  const employerCostPerHour = totalMinutes > 0
    ? roundFour(totalEmployerCost / (totalMinutes / 60))
    : null;

  const fullName = [employee.legal_first_name, employee.legal_last_name]
    .map(cleanText)
    .filter(Boolean)
    .join(' ');
  const heading = monthHeading(periodFrom, periodTo);
  const earnings = lines.filter((item) => item.lineGroup === 'earning').map(documentLine);
  const deductions = lines.filter((item) => item.lineGroup === 'employee_deduction').map(documentLine);
  const reimbursementsForDocument = lines
    .filter((item) => item.lineGroup === 'reimbursement' || item.lineGroup === 'adjustment')
    .map(documentLine);

  const payrollDocument = {
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
      totalDeductions: employeeDeductions,
      netSalary,
      totalReimbursements: reimbursements,
      otherAdjustments,
      payout,
      earnings,
      deductions,
      reimbursements: reimbursementsForDocument,
    },
  };

  const fileIdentity = cleanText(employee.employee_number) || fullName || employeeId;
  const filename = safeFilename(`Lohnabrechnung_${fileIdentity}_${periodFrom}_${periodTo}.pdf`);

  const snapshot = {
    calculation_version: 'opc_payroll_phase1_v1',
    employee_id: employeeId,
    employee_number: employee.employee_number || null,
    period_from: periodFrom,
    period_to: periodTo,
    salary_type: salaryType,
    contract: safeObject(contract),
    payroll_profile: safeObject(profile),
    rule_set: safeObject(ruleSet),
    approved_entry_ids: positiveEntries.map((item) => item.entry.id),
    time_entry_pay_rates: payRates.map((row) => safeObject(row)),
    contribution_basis_chf: contributionBasis,
    totals: {
      entries_count: positiveEntries.length,
      minutes: totalMinutes,
      hours: totalHours,
      gross_salary_chf: grossSalary,
      employee_deductions_chf: employeeDeductions,
      net_salary_chf: netSalary,
      reimbursements_chf: reimbursements,
      other_adjustments_chf: otherAdjustments,
      payout_chf: payout,
      employer_contributions_chf: employerContributions,
      total_employer_cost_chf: totalEmployerCost,
    },
    warnings,
  };

  return {
    employee,
    address,
    contract,
    payrollProfile: profile,
    ruleSet,
    periodFrom,
    periodTo,
    salaryType,
    entriesCount: positiveEntries.length,
    totalMinutes,
    totalHours,
    payableDays,
    periodWorkingDays,
    baseSalary: roundMoney(baseSalary),
    grossSalary,
    employeeDeductions,
    netSalary,
    reimbursements,
    otherAdjustments,
    payout,
    employerContributions,
    totalEmployerCost,
    grossPerHour,
    netPerHour,
    employerCostPerHour,
    rateBreakdown,
    lines,
    warnings,
    payrollDocument,
    filename,
    snapshot,
  };
}
