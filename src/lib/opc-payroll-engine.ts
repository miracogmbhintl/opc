import {
  cleanText,
  errorStatus,
  safeObject,
  throwOnError,
  todayIsoDate,
} from './opc-employee-api';
import { maskAhvNumber } from './opc-sensitive-data';

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
    nominalHourlyRate?: number;
    minimumHourlyRate?: number;
    category?: string;
    minutes: number;
    hours: number;
    amount: number;
    contractId: string | null;
    source: string;
    timeEntryCount: number;
  }>;
  accruals: Array<{
    code: string;
    label: string;
    basisAmount: number;
    rate: number;
    amount: number;
    status: string;
  }>;
  periodAdjustments: JsonRow[];
  reconciliation: JsonRow | null;
  lines: PayrollLine[];
  warnings: string[];
  payrollDocument: JsonRow;
  filename: string;
  snapshot: JsonRow;
};

export class PayrollDomainError extends Error {
  code: string;
  httpStatus: number;

  constructor(code: string, message: string, httpStatus = 422) {
    super(message);
    this.name = 'PayrollDomainError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export function payrollErrorStatus(error: any) {
  if (error instanceof PayrollDomainError) {
    return error.httpStatus;
  }

  return errorStatus(error);
}

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

function calendarMonthBounds(value: string) {
  const from = `${value.slice(0, 7)}-01`;
  const date = dateAtNoon(from);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return { from, to: dateKey(date) };
}

function isCompleteCalendarMonth(from: string, to: string) {
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) return false;
  const bounds = calendarMonthBounds(from);
  return from === bounds.from && to === bounds.to;
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
    year: '',
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
  const metadata = safeObject(item.metadata);
  const basisOverride = cleanText(metadata.document_basis);
  const rateOverride = cleanText(metadata.document_rate);
  return {
    label: item.description,
    basis: basisOverride || (item.basisAmount === null
      ? item.quantity === null
        ? ''
        : `${item.quantity}`
      : `CHF ${item.basisAmount.toFixed(2)}`),
    rate: rateOverride || (item.rate === null
      ? ''
      : `${item.rate.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')} %`),
    amount,
  };
}


function normalizeService(value: unknown) {
  return (cleanText(value) || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function entryServiceType(entry: JsonRow) {
  const metadata = safeObject(entry.metadata);
  return cleanText(entry.service_type) || cleanText(metadata.service_type) || '';
}

function entryObjectName(entry: JsonRow) {
  const metadata = safeObject(entry.metadata);
  return cleanText(entry.object_name) || cleanText(metadata.object_name) || '';
}

function serviceCategory(entry: JsonRow): 'maintenance' | 'special' | 'other' {
  const metadata = safeObject(entry.metadata);
  const explicitCategory = normalizeService(
    entry.payroll_cleaning_category
      || metadata.payroll_cleaning_category
      || metadata.gav_cleaning_category
      || metadata.cleaning_category,
  );

  if (['special', 'spezial', 'spezialreinigung'].includes(explicitCategory)) {
    return 'special';
  }
  if (['maintenance', 'unterhalt', 'unterhaltsreinigung'].includes(explicitCategory)) {
    return 'maintenance';
  }

  // OPC management decision:
  // Do not infer payroll categories from customer names, job titles or words such
  // as Fenster, Grund-, Fein- or Umzugsreinigung. Unless a payroll category is
  // explicitly assigned, the entry is treated as Unterhaltsreinigung.
  return 'maintenance';
}

function metadataNumber(metadata: JsonRow, key: string, fallback: number) {
  const parsed = asNumber(metadata[key]);
  return parsed > 0 ? parsed : fallback;
}

function accrualDocumentLine(item: PayrollCalculation['accruals'][number]) {
  return {
    label: item.label,
    basis: `CHF ${item.basisAmount.toFixed(2)}`,
    rate: `${item.rate.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')} %`,
    amount: item.amount,
    status: item.status,
  };
}

async function loadPayrollData(
  supabase: any,
  employeeId: string,
  periodFrom: string,
  periodTo: string,
) {
  const [
    employeeResponse,
    addressResponse,
    contractResponse,
    profileResponse,
    ruleSetResponse,
    adjustmentResponse,
    reconciliationResponse,
  ] = await Promise.all([
      supabase.from('opc_employees').select('*').eq('id', employeeId).maybeSingle(),
      supabase
        .from('opc_employee_addresses')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('address_type', 'residence')
        .order('valid_from', { ascending: false })
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false }),
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
      supabase
        .from('opc_payroll_period_adjustments')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('status', 'active')
        .lte('period_from', periodTo)
        .gte('period_to', periodFrom)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('opc_payroll_reconciliation_reference')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('period_from', periodFrom)
        .eq('period_to', periodTo)
        .maybeSingle(),
    ]);

  throwOnError(employeeResponse.error, 'Mitarbeiter konnte nicht geladen werden');
  throwOnError(addressResponse.error, 'Mitarbeiteradresse konnte nicht geladen werden');
  throwOnError(contractResponse.error, 'Arbeitsverträge konnten nicht geladen werden');
  throwOnError(profileResponse.error, 'Payroll-Profil konnte nicht geladen werden');
  throwOnError(ruleSetResponse.error, 'Payroll-Regelsatz konnte nicht geladen werden');
  throwOnError(adjustmentResponse.error, 'Periodische Lohnkorrekturen konnten nicht geladen werden');
  throwOnError(reconciliationResponse.error, 'Payroll-Abgleich konnte nicht geladen werden');

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
    .gte('work_date', addDays(periodFrom, -90))
    .lte('work_date', periodTo)
    .order('work_date', { ascending: true })
    .order('created_at', { ascending: true });
  throwOnError(timeResponse.error, 'Genehmigte Arbeitszeiten konnten nicht geladen werden');

  const entries = ((timeResponse.data || []) as JsonRow[]).filter((entry) => {
    const workDate = isoDate(entry.work_date);
    if (workDate >= periodFrom && workDate <= periodTo) return true;
    const metadata = safeObject(entry.metadata);
    return isoDate(metadata.payroll_period_override_from) === periodFrom &&
      isoDate(metadata.payroll_period_override_to) === periodTo;
  });
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
  const addressToday = todayIsoDate();

  // A newly generated payroll document uses the employee's current residence
  // address at generation time. Historical address rows remain available for
  // auditing, but the payroll period no longer forces an old address onto a
  // newly generated preview or PDF.
  const address =
    addressRows.find((row) => {
      const from = isoDate(row.valid_from) || '0000-01-01';
      const until = isoDate(row.valid_until) || '9999-12-31';
      return row.is_primary === true && from <= addressToday && until >= addressToday;
    }) ||
    addressRows.find((row) => {
      const from = isoDate(row.valid_from) || '0000-01-01';
      const until = isoDate(row.valid_until) || '9999-12-31';
      return from <= addressToday && until >= addressToday;
    }) ||
    addressRows[0] || {};

  return {
    employee,
    address,
    contracts,
    contract,
    profile,
    ruleSet,
    entries,
    payRates,
    periodAdjustments: (adjustmentResponse.data || []) as JsonRow[],
    reconciliationReference: (reconciliationResponse.data || null) as JsonRow | null,
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

  const {
    employee,
    address,
    contracts,
    contract,
    profile,
    ruleSet,
    entries,
    payRates,
    periodAdjustments,
    reconciliationReference,
  } = await loadPayrollData(supabase, employeeId, periodFrom, periodTo);

  const positiveEntries = entries
    .map((entry) => ({ entry, minutes: netMinutes(entry) }))
    .filter(({ minutes }) => minutes > 0);
  const carryoverEntries = positiveEntries.filter(({ entry }) => {
    const workDate = isoDate(entry.work_date);
    return workDate < periodFrom || workDate > periodTo;
  });
  const totalMinutes = positiveEntries.reduce((sum, item) => sum + item.minutes, 0);
  const totalHours = roundFour(totalMinutes / 60);
  const salaryType = String(contract.salary_type).toLowerCase() as 'hourly' | 'monthly';
  const lines: PayrollLine[] = [];
  const warnings: string[] = [];
  const accruals: PayrollCalculation['accruals'] = [];
  const rateBreakdown: PayrollCalculation['rateBreakdown'] = [];
  const profileMetadata = safeObject(profile.metadata);
  const ruleMetadata = safeObject(ruleSet.metadata);
  const gavApplicable = contract.is_gav_applicable === true;

  if (carryoverEntries.length) {
    const carryoverHours = roundFour(
      carryoverEntries.reduce((sum, item) => sum + item.minutes, 0) / 60,
    );
    warnings.push(
      `${carryoverHours.toFixed(2)} Stunden aus früheren Arbeitstagen werden gemäss Excel als Übertrag in diesem Abrechnungszeitraum berücksichtigt.`,
    );
  }

  let baseSalary = 0;
  let payableDays = 0;
  let periodWorkingDays = countWorkingDays(periodFrom, periodTo);

  if (salaryType === 'hourly') {
    if (!positiveEntries.length) {
      throw new PayrollDomainError(
        'NO_APPROVED_HOURS',
        'Im Zeitraum bestehen keine genehmigten Arbeitsstunden.',
        422,
      );
    }

    const minimumMaintenanceRate = metadataNumber(
      ruleMetadata,
      'gav_minimum_hourly_maintenance_i_chf',
      21.4,
    );
    const minimumSpecialRate = metadataNumber(
      ruleMetadata,
      'gav_minimum_hourly_special_i_chf',
      23.4,
    );
    const publicHolidayMaintenanceRate = metadataNumber(
      ruleMetadata,
      'public_holiday_maintenance_rate',
      1.5,
    );
    const publicHolidaySpecialRate = metadataNumber(
      ruleMetadata,
      'public_holiday_special_rate',
      3.6,
    );

    const baseBuckets = new Map<string, {
      nominalHourlyRate: number;
      minutes: number;
      amount: number;
      contractId: string | null;
      source: string;
      timeEntryIds: string[];
    }>();
    const minimumAdjustmentBuckets = new Map<string, {
      category: 'maintenance' | 'special';
      nominalHourlyRate: number;
      minimumHourlyRate: number;
      minutes: number;
      amount: number;
      timeEntryIds: string[];
    }>();
    const publicHolidayBuckets = new Map<string, {
      category: 'maintenance' | 'special';
      publicHolidayRate: number;
      effectiveBasis: number;
      timeEntryIds: string[];
    }>();
    const missingDates = new Set<string>();
    let unknownCategoryCount = 0;
    let minimumAdjustmentEntryCount = 0;
    let minimumAdjustmentMinutes = 0;
    let minimumAdjustmentAmount = 0;
    const payRateByEntryId = new Map(
      payRates.map((row) => [String(row.time_entry_id), row]),
    );

    for (const { entry, minutes } of positiveEntries) {
      const workDate = isoDate(entry.work_date);
      const activeContract = contractForDate(contracts, workDate, 'hourly');
      const entryRate = payRateByEntryId.get(String(entry.id));
      const nominalHourlyRate = entryRate && asNumber(entryRate.hourly_rate_chf) > 0
        ? asNumber(entryRate.hourly_rate_chf)
        : asNumber(activeContract?.hourly_rate_chf);
      const contractId = cleanText(entryRate?.contract_id) || cleanText(activeContract?.id);
      const source = entryRate
        ? cleanText(entryRate.rate_source) || 'time_entry_rate'
        : 'employment_contract';
      const category = serviceCategory(entry);
      const minimumHourlyRate = gavApplicable
        ? category === 'maintenance'
          ? minimumMaintenanceRate
          : category === 'special'
            ? minimumSpecialRate
            : 0
        : 0;
      const effectiveHourlyRate = Math.max(nominalHourlyRate, minimumHourlyRate);
      const publicHolidayRate = gavApplicable
        ? category === 'maintenance'
          ? publicHolidayMaintenanceRate
          : category === 'special'
            ? publicHolidaySpecialRate
            : 0
        : 0;

      if (nominalHourlyRate <= 0) {
        missingDates.add(workDate || String(entry.work_date || ''));
        continue;
      }
      if (entryRate && cleanText(entryRate.employee_id) !== employeeId) {
        throw new Error(`Ungültiger Lohnansatz für Zeiteintrag ${entry.id}: Mitarbeiter stimmt nicht überein.`);
      }
      if (category === 'other' && gavApplicable) {
        unknownCategoryCount += 1;
      }

      const nominalAmount = (minutes / 60) * nominalHourlyRate;
      const effectiveAmount = (minutes / 60) * effectiveHourlyRate;
      const adjustmentAmount = effectiveAmount - nominalAmount;

      const baseKey = [
        source,
        contractId || 'none',
        nominalHourlyRate.toFixed(4),
      ].join(':');
      const baseBucket = baseBuckets.get(baseKey) || {
        nominalHourlyRate,
        minutes: 0,
        amount: 0,
        contractId,
        source,
        timeEntryIds: [],
      };
      baseBucket.minutes += minutes;
      baseBucket.amount += nominalAmount;
      baseBucket.timeEntryIds.push(String(entry.id));
      baseBuckets.set(baseKey, baseBucket);

      if (
        adjustmentAmount > 0 &&
        (category === 'maintenance' || category === 'special')
      ) {
        const correctionKey = [
          category,
          nominalHourlyRate.toFixed(4),
          minimumHourlyRate.toFixed(4),
        ].join(':');
        const correctionBucket = minimumAdjustmentBuckets.get(correctionKey) || {
          category,
          nominalHourlyRate,
          minimumHourlyRate,
          minutes: 0,
          amount: 0,
          timeEntryIds: [],
        };
        correctionBucket.minutes += minutes;
        correctionBucket.amount += adjustmentAmount;
        correctionBucket.timeEntryIds.push(String(entry.id));
        minimumAdjustmentBuckets.set(correctionKey, correctionBucket);
        minimumAdjustmentEntryCount += 1;
        minimumAdjustmentMinutes += minutes;
        minimumAdjustmentAmount += adjustmentAmount;
      }

      if (
        publicHolidayRate > 0 &&
        (category === 'maintenance' || category === 'special')
      ) {
        const holidayKey = `${category}:${publicHolidayRate.toFixed(4)}`;
        const holidayBucket = publicHolidayBuckets.get(holidayKey) || {
          category,
          publicHolidayRate,
          effectiveBasis: 0,
          timeEntryIds: [],
        };
        holidayBucket.effectiveBasis += effectiveAmount;
        holidayBucket.timeEntryIds.push(String(entry.id));
        publicHolidayBuckets.set(holidayKey, holidayBucket);
      }
    }

    if (missingDates.size) {
      throw new Error(
        'Für folgende Arbeitstage wurde kein gültiger Stundenlohnvertrag gefunden: ' +
          Array.from(missingDates).sort().map(formatDate).join(', '),
      );
    }

    const sortedBaseBuckets = Array.from(baseBuckets.values()).sort((a, b) =>
      a.nominalHourlyRate - b.nominalHourlyRate || a.source.localeCompare(b.source),
    );

    for (const bucket of sortedBaseBuckets) {
      const amount = roundMoney(bucket.amount);
      baseSalary += amount;
      const hours = roundFour(bucket.minutes / 60);
      rateBreakdown.push({
        hourlyRate: roundMoney(bucket.nominalHourlyRate),
        nominalHourlyRate: roundMoney(bucket.nominalHourlyRate),
        minimumHourlyRate: 0,
        minutes: bucket.minutes,
        hours,
        amount,
        contractId: bucket.contractId,
        source: bucket.source,
        timeEntryCount: bucket.timeEntryIds.length,
      });
      lines.push(line('earning', 'BASIC_HOURLY_PAY', 'Grundlohn Stundenlohn', {
        basisAmount: bucket.nominalHourlyRate,
        quantity: hours,
        employeeAmount: amount,
        sortOrder: 10,
        source: bucket.source,
        metadata: {
          contract_id: bucket.contractId,
          minutes: bucket.minutes,
          time_entry_ids: bucket.timeEntryIds,
          nominal_hourly_rate_chf: bucket.nominalHourlyRate,
          document_basis: `${hours.toFixed(2)} Std.`,
          document_rate: `CHF ${bucket.nominalHourlyRate.toFixed(2)}`,
        },
      }));
    }

    const sortedCorrections = Array.from(minimumAdjustmentBuckets.values()).sort((a, b) =>
      a.category.localeCompare(b.category) ||
      a.nominalHourlyRate - b.nominalHourlyRate,
    );

    for (const bucket of sortedCorrections) {
      const amount = roundMoney(bucket.amount);
      const hours = roundFour(bucket.minutes / 60);
      baseSalary += amount;
      lines.push(line(
        'earning',
        'GAV_MINIMUM_WAGE_ADJUSTMENT',
        bucket.category === 'special'
          ? 'GAV-Mindestlohnkorrektur Spezialreinigung'
          : 'GAV-Mindestlohnkorrektur Unterhaltsreinigung',
        {
          employeeAmount: amount,
          sortOrder: 20,
          source: 'gav_rule_set',
          metadata: {
            category: bucket.category,
            minutes: bucket.minutes,
            time_entry_ids: bucket.timeEntryIds,
            nominal_hourly_rate_chf: bucket.nominalHourlyRate,
            minimum_hourly_rate_chf: bucket.minimumHourlyRate,
            document_basis: `${hours.toFixed(2)} Std.`,
            document_rate: `CHF ${(bucket.minimumHourlyRate - bucket.nominalHourlyRate).toFixed(2)}/Std.`,
          },
        },
      ));
    }

    const sortedHolidayBuckets = Array.from(publicHolidayBuckets.values()).sort((a, b) =>
      a.category.localeCompare(b.category),
    );

    for (const bucket of sortedHolidayBuckets) {
      const basis = roundMoney(bucket.effectiveBasis);
      const amount = percentageAmount(basis, bucket.publicHolidayRate);
      lines.push(line('earning', 'PUBLIC_HOLIDAY_PAY',
        bucket.category === 'special'
          ? 'Feiertagsentschädigung Spezialreinigung'
          : 'Feiertagsentschädigung Unterhaltsreinigung', {
          basisAmount: basis,
          rate: bucket.publicHolidayRate,
          employeeAmount: amount,
          sortOrder: 30,
          source: 'gav_rule_set',
          metadata: {
            category: bucket.category,
            time_entry_ids: bucket.timeEntryIds,
          },
        }));
    }

    if (minimumAdjustmentEntryCount > 0) {
      warnings.push(
        `GAV-Mindestlohnkorrektur intern angewendet: ${minimumAdjustmentEntryCount} Zeiteinträge, ${roundFour(minimumAdjustmentMinutes / 60).toFixed(2)} Stunden, CHF ${roundMoney(minimumAdjustmentAmount).toFixed(2)}.`,
      );
    }

    if (unknownCategoryCount > 0) {
      warnings.push(
        `Für ${unknownCategoryCount} Zeiteinträge konnte keine GAV-Kategorie für die Feiertagsentschädigung bestimmt werden.`,
      );
    }

    const entitlementBasis = roundMoney(
      lines
        .filter((item) => item.lineGroup === 'earning')
        .filter((item) => [
          'BASIC_HOURLY_PAY',
          'GAV_MINIMUM_WAGE_ADJUSTMENT',
          'PUBLIC_HOLIDAY_PAY',
        ].includes(item.lineCode))
        .reduce((sum, item) => sum + item.employeeAmount, 0),
    );

    const holidayRate = asNumber(contract.holiday_pay_percentage) || (gavApplicable ? 8.33 : 0);
    const payVacationMonthly = profileMetadata.pay_vacation_monthly === true;
    if (holidayRate > 0) {
      const amount = percentageAmount(entitlementBasis, holidayRate);
      if (payVacationMonthly) {
        lines.push(line('earning', 'HOLIDAY_PAY', 'Ferienentschädigung', {
          basisAmount: entitlementBasis,
          rate: holidayRate,
          employeeAmount: amount,
          sortOrder: 20,
          source: 'employment_contract',
        }));
      } else {
        accruals.push({
          code: 'VACATION_PAY_ACCRUAL',
          label: 'Ferienlohn-Rückstellung (nicht ausbezahlt)',
          basisAmount: entitlementBasis,
          rate: holidayRate,
          amount,
          status: 'accrued',
        });
      }
    }

    const thirteenthRate = asNumber(contract.thirteenth_salary_percentage) || (gavApplicable ? 100 : 0);
    const monthlyAccrualRate = thirteenthRate > 0 ? thirteenthRate / 12 : 0;
    if (monthlyAccrualRate > 0) {
      const amount = percentageAmount(entitlementBasis, monthlyAccrualRate);
      if (profile.pay_thirteenth_monthly === true) {
        lines.push(line('earning', 'THIRTEENTH_SALARY', 'Anteil 13. Monatslohn', {
          basisAmount: entitlementBasis,
          rate: monthlyAccrualRate,
          employeeAmount: amount,
          sortOrder: 40,
          source: 'employment_contract',
        }));
      } else {
        accruals.push({
          code: 'THIRTEENTH_SALARY_ACCRUAL',
          label: 'Rückstellung 13. Monatslohn (nicht ausbezahlt)',
          basisAmount: entitlementBasis,
          rate: monthlyAccrualRate,
          amount,
          status: 'accrued',
        });
        warnings.push(
          `Der 13. Monatslohn wird in dieser Abrechnung nicht ausbezahlt. Rückstellung für den Zeitraum: CHF ${amount.toFixed(2)}.`,
        );
      }
    }
  } else {
    const monthlySalary = asNumber(contract.monthly_salary_chf);
    if (monthlySalary <= 0) {
      throw new Error('Der aktive Monatslohnvertrag enthält keinen gültigen Monatslohn.');
    }

    if (!isCompleteCalendarMonth(periodFrom, periodTo)) {
      const expected = calendarMonthBounds(periodFrom);
      throw new Error(
        `Fix-/Monatslohn muss über einen vollständigen Kalendermonat abgerechnet werden: ${formatDate(expected.from)} bis ${formatDate(expected.to)}.`,
      );
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

    if (contract.monthly_salary_includes_13th !== true) {
      const thirteenthRate = asNumber(contract.thirteenth_salary_percentage);
      if (thirteenthRate > 0) {
        const monthlyAccrualRate = thirteenthRate / 12;
        const amount = percentageAmount(baseSalary, monthlyAccrualRate);
        if (profile.pay_thirteenth_monthly === true) {
          lines.push(line('earning', 'THIRTEENTH_SALARY', 'Anteil 13. Monatslohn', {
            basisAmount: baseSalary,
            rate: monthlyAccrualRate,
            employeeAmount: amount,
            sortOrder: 20,
            source: 'employment_contract',
          }));
        } else {
          accruals.push({
            code: 'THIRTEENTH_SALARY_ACCRUAL',
            label: 'Rückstellung 13. Monatslohn (nicht ausbezahlt)',
            basisAmount: baseSalary,
            rate: monthlyAccrualRate,
            amount,
            status: 'accrued',
          });
        }
      }
    }

    if (totalMinutes === 0) {
      warnings.push('Für den Fixlohnzeitraum bestehen keine genehmigten Arbeitsstunden; Kosten pro Stunde können nicht berechnet werden.');
    }
  }

  const periodDeductionAdjustments: JsonRow[] = [];
  for (const adjustment of periodAdjustments) {
    const type = String(adjustment.adjustment_type || '').toLowerCase();
    const amount = roundMoney(asNumber(adjustment.amount_chf));
    const description = cleanText(adjustment.description) || 'Periodische Lohnkorrektur';
    if (amount <= 0) continue;

    if (type === 'earning') {
      lines.push(line('earning', cleanText(adjustment.code) || 'PERIOD_EARNING', description, {
        employeeAmount: amount,
        sortOrder: asNumber(adjustment.sort_order) || 60,
        source: 'payroll_period_adjustment',
        metadata: { adjustment_id: adjustment.id },
      }));
    } else if (type === 'reimbursement') {
      if (adjustment.affects_payout === false) {
        accruals.push({
          code: cleanText(adjustment.code) || 'INFORMATIONAL_REIMBURSEMENT',
          label: `${description} (separat / nicht in Auszahlung)`,
          basisAmount: amount,
          rate: 0,
          amount,
          status: 'informational',
        });
      } else {
        lines.push(line('reimbursement', cleanText(adjustment.code) || 'PERIOD_REIMBURSEMENT', description, {
          employeeAmount: amount,
          sortOrder: asNumber(adjustment.sort_order) || 310,
          source: 'payroll_period_adjustment',
          metadata: { adjustment_id: adjustment.id },
        }));
      }
    } else if (type === 'adjustment') {
      const signedAmount = adjustment.direction === 'deduction' ? -amount : amount;
      lines.push(line('adjustment', cleanText(adjustment.code) || 'PERIOD_ADJUSTMENT', description, {
        employeeAmount: signedAmount,
        sortOrder: asNumber(adjustment.sort_order) || 320,
        source: 'payroll_period_adjustment',
        metadata: { adjustment_id: adjustment.id },
      }));
    } else if (type === 'employer_cost') {
      lines.push(line('employer_contribution', cleanText(adjustment.code) || 'PERIOD_EMPLOYER_COST', description, {
        employerAmount: amount,
        sortOrder: asNumber(adjustment.sort_order) || 290,
        source: 'payroll_period_adjustment',
        metadata: { adjustment_id: adjustment.id },
      }));
    } else if (type === 'deduction' || type === 'advance') {
      periodDeductionAdjustments.push(adjustment);
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
  const nbuMode = String(profileMetadata.nbu_eligibility_mode || 'auto').toLowerCase();
  const nbuEligible = nbuMode === 'always'
    ? true
    : nbuMode === 'never'
      ? false
      : Math.max(contractualWeeklyHours, actualAverageWeeklyHours) >= nbuThreshold;
  if (nbuMode === 'always' && Math.max(contractualWeeklyHours, actualAverageWeeklyHours) < nbuThreshold) {
    warnings.push('NBU wird gemäss hinterlegter OPC-/Excel-Einstufung abgezogen, obwohl der aktuelle Periodendurchschnitt unter 8 Stunden pro Woche liegt. Versicherungseinstufung prüfen.');
  }
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
      employeeRate: gavApplicable ? asNumber(profile.gav_employee_rate) : 0,
      employerRate: gavApplicable ? asNumber(profile.gav_employer_rate) : 0,
      sort: 150,
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

  if (profileMetadata.bvg_amount_confirmed !== true && (bvgEmployee > 0 || bvgEmployer > 0)) {
    warnings.push('BVG-Betrag stammt aus einer provisorischen Excel-/Schätzwert-Hinterlegung und muss mit dem Vorsorgeplan abgeglichen werden.');
  }

  if (
    profile.source_tax_subject === true &&
    String(profileMetadata.source_tax_status || '').toLowerCase().includes('provisional')
  ) {
    warnings.push('Quellensteuer ist als provisorischer Excel-Wert hinterlegt. Kantonalen Tarif und Tarifcode vor definitiver Meldung prüfen.');
  }
  if (profile.source_tax_subject === true && (!cleanText(profile.source_tax_canton) || !cleanText(profile.source_tax_tariff_code))) {
    warnings.push('Quellensteuerpflichtig, aber Kanton oder Tarifcode fehlt.');
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

  for (const adjustment of periodDeductionAdjustments) {
    const amount = roundMoney(asNumber(adjustment.amount_chf));
    const type = String(adjustment.adjustment_type || '').toLowerCase();
    lines.push(line('employee_deduction', cleanText(adjustment.code) || (type === 'advance' ? 'ADVANCE' : 'PERIOD_DEDUCTION'),
      cleanText(adjustment.description) || (type === 'advance' ? 'Vorschuss / bereits ausbezahlt' : 'Periodischer Abzug'), {
        employeeAmount: amount,
        sortOrder: asNumber(adjustment.sort_order) || (type === 'advance' ? 180 : 190),
        source: 'payroll_period_adjustment',
        metadata: { adjustment_id: adjustment.id },
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

  const reconciliation = reconciliationReference
    ? {
        referenceId: reconciliationReference.employee_id || employeeId,
        status: cleanText(reconciliationReference.status) || null,
        excelGrossSalary: roundMoney(asNumber(reconciliationReference.excel_gross_chf)),
        excelPayout: roundMoney(asNumber(reconciliationReference.excel_payout_chf)),
        expectedGrossSalary: roundMoney(asNumber(reconciliationReference.corrected_gross_chf)),
        expectedPayout: roundMoney(asNumber(reconciliationReference.corrected_payout_chf)),
        grossDifference: roundMoney(
          grossSalary - asNumber(reconciliationReference.corrected_gross_chf),
        ),
        payoutDifference: roundMoney(
          payout - asNumber(reconciliationReference.corrected_payout_chf),
        ),
        notes: cleanText(reconciliationReference.notes) || null,
        matches:
          Math.abs(grossSalary - asNumber(reconciliationReference.corrected_gross_chf)) <= 0.05 &&
          Math.abs(payout - asNumber(reconciliationReference.corrected_payout_chf)) <= 0.05,
      }
    : null;

  if (reconciliation && !reconciliation.matches) {
    warnings.push(
      `Kontrollabweichung zum geprüften Excel-Abgleich: Brutto ${reconciliation.grossDifference >= 0 ? '+' : ''}CHF ${reconciliation.grossDifference.toFixed(2)}, Auszahlung ${reconciliation.payoutDifference >= 0 ? '+' : ''}CHF ${reconciliation.payoutDifference.toFixed(2)}. Lohnlauf darf nicht abgeschlossen werden.`,
    );
  }

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
      ahvNumber: maskAhvNumber(employee.ahv_number),
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
    calculation_version: 'opc_payroll_reconciliation_v2_2_maintenance',
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
    period_adjustments: periodAdjustments.map((row) => safeObject(row)),
    reconciliation,
    accruals,
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
    accruals,
    periodAdjustments,
    reconciliation,
    lines,
    warnings,
    payrollDocument,
    filename,
    snapshot,
  };
}

export async function calculateEmployeeZeroPayroll({
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

  const {
    employee,
    address,
    contract,
    profile,
    ruleSet,
  } = await loadPayrollData(supabase, employeeId, periodFrom, periodTo);

  const salaryType = String(contract.salary_type || '').toLowerCase() as 'hourly' | 'monthly';
  if (!['hourly', 'monthly'].includes(salaryType)) {
    throw new Error(`Nicht unterstützte Lohnart im Vertrag: ${salaryType || 'leer'}.`);
  }

  const lines: PayrollLine[] = [];
  const warnings: string[] = [
    'Nullsummen-Lohnabrechnung wurde administrativ erzeugt. Alle Lohnbestandteile, Abzüge und Auszahlungen wurden bewusst auf CHF 0.00 gesetzt.',
  ];

  const profileMetadata = safeObject(profile.metadata);
  const ruleMetadata = safeObject(ruleSet.metadata);
  const gavApplicable = contract.is_gav_applicable === true;

  if (salaryType === 'hourly') {
    const hourlyRate = asNumber(contract.hourly_rate_chf);
    lines.push(line('earning', 'BASIC_HOURLY_PAY', 'Grundlohn Stundenlohn', {
      basisAmount: hourlyRate,
      quantity: 0,
      employeeAmount: 0,
      sortOrder: 10,
      source: 'zero_payroll_backend',
      metadata: {
        contract_id: contract.id || null,
        document_basis: '0.00 Std.',
        document_rate: hourlyRate > 0 ? `CHF ${hourlyRate.toFixed(2)}` : '',
        zero_payroll: true,
      },
    }));

    const publicHolidayRate = gavApplicable
      ? metadataNumber(
          ruleMetadata,
          'public_holiday_maintenance_rate',
          asNumber(contract.public_holiday_percentage),
        )
      : asNumber(contract.public_holiday_percentage);

    if (publicHolidayRate > 0) {
      lines.push(line('earning', 'PUBLIC_HOLIDAY_PAY_MAINTENANCE', 'Feiertagsentschädigung Unterhaltsreinigung', {
        basisAmount: 0,
        rate: publicHolidayRate,
        employeeAmount: 0,
        sortOrder: 30,
        source: 'zero_payroll_backend',
        metadata: {
          contract_id: contract.id || null,
          document_basis: 'CHF 0.00',
          zero_payroll: true,
        },
      }));
    }
  } else {
    const monthlySalary = asNumber(contract.monthly_salary_chf);
    lines.push(line('earning', 'MONTHLY_SALARY', 'Monatslohn', {
      basisAmount: monthlySalary,
      quantity: 0,
      employeeAmount: 0,
      sortOrder: 10,
      source: 'zero_payroll_backend',
      metadata: {
        contract_id: contract.id || null,
        proration_method: 'zero_payroll_backend',
        document_basis: monthlySalary > 0 ? `CHF ${monthlySalary.toFixed(2)}` : 'CHF 0.00',
        document_rate: '0',
        zero_payroll: true,
      },
    }));
  }

  const contributionBasis = 0;
  const grossSalary = 0;
  const employeeDeductions = 0;
  const netSalary = 0;
  const reimbursements = 0;
  const otherAdjustments = 0;
  const payout = 0;
  const employerContributions = 0;
  const totalEmployerCost = 0;
  const totalMinutes = 0;
  const totalHours = 0;
  const payableDays = 0;
  const periodWorkingDays = countWorkingDays(periodFrom, periodTo);

  const ahvEmployeeRate = asNumber(ruleSet.ahv_employee_rate);
  const ahvEmployerRate = asNumber(ruleSet.ahv_employer_rate);
  const alvEmployeeRate = asNumber(ruleSet.alv_employee_rate);
  const alvEmployerRate = asNumber(ruleSet.alv_employer_rate);

  lines.push(line('employee_deduction', 'AHV_IV_EO', 'AHV/IV/EO Arbeitnehmer', {
    basisAmount: 0,
    rate: ahvEmployeeRate,
    employeeAmount: 0,
    sortOrder: 110,
    source: 'zero_payroll_backend',
    metadata: { rule_set_id: ruleSet.id || null, zero_payroll: true },
  }));
  lines.push(line('employer_contribution', 'AHV_IV_EO_EMPLOYER', 'AHV/IV/EO Arbeitgeber', {
    basisAmount: 0,
    rate: ahvEmployerRate,
    employerAmount: 0,
    sortOrder: 210,
    source: 'zero_payroll_backend',
    metadata: { rule_set_id: ruleSet.id || null, zero_payroll: true },
  }));
  lines.push(line('employee_deduction', 'ALV', 'ALV Arbeitnehmer', {
    basisAmount: 0,
    rate: alvEmployeeRate,
    employeeAmount: 0,
    sortOrder: 120,
    source: 'zero_payroll_backend',
    metadata: { rule_set_id: ruleSet.id || null, annual_cap_chf: ruleSet.alv_annual_max_chf, zero_payroll: true },
  }));
  lines.push(line('employer_contribution', 'ALV_EMPLOYER', 'ALV Arbeitgeber', {
    basisAmount: 0,
    rate: alvEmployerRate,
    employerAmount: 0,
    sortOrder: 220,
    source: 'zero_payroll_backend',
    metadata: { rule_set_id: ruleSet.id || null, annual_cap_chf: ruleSet.alv_annual_max_chf, zero_payroll: true },
  }));

  const nbuMode = String(profileMetadata.nbu_eligibility_mode || 'auto').toLowerCase();
  const nbuEligible = nbuMode === 'never' ? false : asNumber(profile.nbu_employee_rate) > 0 || asNumber(profile.nbu_employer_rate) > 0;

  const profileRatePairs: Array<{
    code: string;
    employerCode: string;
    label: string;
    employeeRate: number;
    employerRate: number;
    sort: number;
  }> = [
    {
      code: 'NBU',
      employerCode: 'NBU_EMPLOYER',
      label: 'NBU',
      employeeRate: nbuEligible ? asNumber(profile.nbu_employee_rate) : 0,
      employerRate: nbuEligible ? asNumber(profile.nbu_employer_rate) : 0,
      sort: 130,
    },
    {
      code: 'KTG',
      employerCode: 'KTG_EMPLOYER',
      label: 'KTG',
      employeeRate: asNumber(profile.ktg_employee_rate),
      employerRate: asNumber(profile.ktg_employer_rate),
      sort: 140,
    },
    {
      code: 'GAV',
      employerCode: 'GAV_EMPLOYER',
      label: 'GAV-Beitrag',
      employeeRate: gavApplicable ? asNumber(profile.gav_employee_rate) : 0,
      employerRate: gavApplicable ? asNumber(profile.gav_employer_rate) : 0,
      sort: 150,
    },
  ];

  for (const item of profileRatePairs) {
    if (item.employeeRate > 0) {
      lines.push(line('employee_deduction', item.code, `${item.label} Arbeitnehmer`, {
        basisAmount: 0,
        rate: item.employeeRate,
        employeeAmount: 0,
        sortOrder: item.sort,
        source: 'zero_payroll_backend',
        metadata: { payroll_profile_id: profile.id || null, zero_payroll: true },
      }));
    }
    if (item.employerRate > 0) {
      lines.push(line('employer_contribution', item.employerCode, `${item.label} Arbeitgeber`, {
        basisAmount: 0,
        rate: item.employerRate,
        employerAmount: 0,
        sortOrder: item.sort + 100,
        source: 'zero_payroll_backend',
        metadata: { payroll_profile_id: profile.id || null, zero_payroll: true },
      }));
    }
  }

  if (asNumber(profile.bvg_employee_amount_chf) > 0) {
    lines.push(line('employee_deduction', 'BVG', 'BVG Arbeitnehmer', {
      employeeAmount: 0,
      sortOrder: 160,
      source: 'zero_payroll_backend',
      metadata: { payroll_profile_id: profile.id || null, zero_payroll: true },
    }));
  }
  if (asNumber(profile.bvg_employer_amount_chf) > 0) {
    lines.push(line('employer_contribution', 'BVG_EMPLOYER', 'BVG Arbeitgeber', {
      employerAmount: 0,
      sortOrder: 260,
      source: 'zero_payroll_backend',
      metadata: { payroll_profile_id: profile.id || null, zero_payroll: true },
    }));
  }

  if (profile.source_tax_subject === true) {
    const sourceTaxRate = asNumber(profile.source_tax_rate);
    lines.push(line('employee_deduction', 'SOURCE_TAX', 'Quellensteuer', {
      basisAmount: 0,
      rate: sourceTaxRate,
      employeeAmount: 0,
      sortOrder: 170,
      source: 'zero_payroll_backend',
      metadata: {
        canton: profile.source_tax_canton || null,
        tariff_code: profile.source_tax_tariff_code || null,
        fixed_amount: false,
        zero_payroll: true,
      },
    }));
  }

  const fullName = [employee.legal_first_name, employee.legal_last_name]
    .map(cleanText)
    .filter(Boolean)
    .join(' ');
  const heading = monthHeading(periodFrom, periodTo);
  const earnings = lines.filter((item) => item.lineGroup === 'earning').map(documentLine);
  const deductions = lines.filter((item) => item.lineGroup === 'employee_deduction').map(documentLine);
  const reimbursementsForDocument: JsonRow[] = [];

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
      ahvNumber: maskAhvNumber(employee.ahv_number),
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
    calculation_version: 'opc_payroll_zero_sum_v1',
    zero_payroll: true,
    employee_id: employeeId,
    employee_number: employee.employee_number || null,
    period_from: periodFrom,
    period_to: periodTo,
    salary_type: salaryType,
    contract: safeObject(contract),
    payroll_profile: safeObject(profile),
    rule_set: safeObject(ruleSet),
    approved_entry_ids: [],
    time_entry_pay_rates: [],
    period_adjustments: [],
    reconciliation: null,
    accruals: [],
    contribution_basis_chf: contributionBasis,
    totals: {
      entries_count: 0,
      minutes: 0,
      hours: 0,
      gross_salary_chf: 0,
      employee_deductions_chf: 0,
      net_salary_chf: 0,
      reimbursements_chf: 0,
      other_adjustments_chf: 0,
      payout_chf: 0,
      employer_contributions_chf: 0,
      total_employer_cost_chf: 0,
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
    entriesCount: 0,
    totalMinutes,
    totalHours,
    payableDays,
    periodWorkingDays,
    baseSalary: 0,
    grossSalary,
    employeeDeductions,
    netSalary,
    reimbursements,
    otherAdjustments,
    payout,
    employerContributions,
    totalEmployerCost,
    grossPerHour: null,
    netPerHour: null,
    employerCostPerHour: null,
    rateBreakdown: [],
    accruals: [],
    periodAdjustments: [],
    reconciliation: null,
    lines,
    warnings,
    payrollDocument,
    filename,
    snapshot,
  };
}
