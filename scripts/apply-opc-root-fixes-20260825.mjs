import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, value) {
  fs.writeFileSync(path, value);
}

function replaceRegex(source, regex, replacement, label) {
  if (!regex.test(source)) {
    throw new Error(`Patch target not found: ${label}`);
  }
  return source.replace(regex, replacement);
}

function replaceText(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Patch target not found: ${label}`);
  }
  return source.replace(before, after);
}

const jobPath = 'src/pages/api/opc/create-service-job.ts';
let job = read(jobPath);

const dateHelpers = `const OPC_OPERATION_TIME_ZONE = 'Europe/Zurich';
const OPC_OPERATION_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: OPC_OPERATION_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function utcDateParts(date: Date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function toDateOnly(date: Date) {
  const { year, month, day } = utcDateParts(date);
  return \`${'${year}'}-${'${String(month).padStart(2, \'0\')}'}-${'${String(day).padStart(2, \'0\')}'}\`;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0, 12)).getUTCDate();
}

function clampDay(year: number, monthIndex: number, day: number) {
  return Math.min(Math.max(1, day), daysInMonth(year, monthIndex));
}

function parseDateOnly(value: string) {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function operationZoneParts(date: Date) {
  const parts = Object.fromEntries(
    OPC_OPERATION_DATE_TIME_FORMATTER
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function toIsoDateTime(dateOnly: string, time: string) {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(dateOnly) || !/^\\d{2}:\\d{2}$/.test(time)) {
    throw new Error('Datum oder Uhrzeit ist ungültig.');
  }

  const [year, month, day] = dateOnly.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error('Uhrzeit ist ungültig.');
  }

  const desiredWallClock = Date.UTC(year, month - 1, day, hour, minute, 0);
  let timestamp = desiredWallClock;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const zoned = operationZoneParts(new Date(timestamp));
    const representedWallClock = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
    );
    const correction = desiredWallClock - representedWallClock;
    if (Math.abs(correction) < 1000) break;
    timestamp += correction;
  }

  const finalParts = operationZoneParts(new Date(timestamp));
  if (
    finalParts.year !== year ||
    finalParts.month !== month ||
    finalParts.day !== day ||
    finalParts.hour !== hour ||
    finalParts.minute !== minute
  ) {
    throw new Error(
      \`Die lokale Einsatzzeit ${'${dateOnly}'} ${'${time}'} existiert in Europe/Zurich wegen der Zeitumstellung nicht eindeutig. Bitte eine andere Uhrzeit wählen.\`,
    );
  }

  return new Date(timestamp).toISOString();
}

function getTimeFromIso(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '08:00';
  const parts = operationZoneParts(date);
  return \`${'${String(parts.hour).padStart(2, \'0\')}'}:${'${String(parts.minute).padStart(2, \'0\')}'}\`;
}

function normalizeJsDayToUserDay(jsDay: number) {
  return jsDay === 0 ? 7 : jsDay;
}`;

job = replaceRegex(
  job,
  /function toDateOnly\(date: Date\) \{[\s\S]*?function normalizeJsDayToUserDay\(jsDay: number\) \{\n  return jsDay === 0 \? 7 : jsDay;\n\}/,
  dateHelpers,
  'create-service-job date helpers',
);

job = replaceText(job, 'cursor.getDay()', 'cursor.getUTCDay()', 'weekday UTC calculation');
job = replaceText(job, 'const startDay = start.getDate();', 'const startDay = start.getUTCDate();', 'monthly start day UTC');
job = replaceText(
  job,
  'let monthCursor = new Date(start.getFullYear(), start.getMonth(), 1);',
  'let monthCursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1, 12));',
  'monthly cursor UTC',
);
job = replaceText(job, 'const year = monthCursor.getFullYear();', 'const year = monthCursor.getUTCFullYear();', 'monthly year UTC');
job = replaceText(job, 'const month = monthCursor.getMonth();', 'const month = monthCursor.getUTCMonth();', 'monthly month UTC');
job = replaceText(job, 'const candidate = new Date(year, month, day);', 'const candidate = new Date(Date.UTC(year, month, day, 12));', 'monthly candidate UTC');
job = replaceText(job, 'monthCursor = new Date(year, month + 1, 1);', 'monthCursor = new Date(Date.UTC(year, month + 1, 1, 12));', 'monthly next cursor UTC');

const strictInsertJobs = `async function insertJobs(adminClient: any, payloads: JsonRecord[]): Promise<string[]> {
  const canonicalPayloads = payloads.map((payload) => compactPayload(payload));
  const { data, error } = await adminClient
    .from('opc_service_jobs')
    .insert(canonicalPayloads)
    .select('id');

  if (error || !Array.isArray(data)) {
    throw new Error(error?.message || 'Einsätze konnten nicht erstellt werden.');
  }

  return data.map((row: JsonRecord) => String(row.id)).filter(Boolean);
}

function buildAssignmentVariants`;

job = replaceRegex(
  job,
  /async function insertJobs\(adminClient: any, payloads: JsonRecord\[\]\): Promise<string\[\]> \{[\s\S]*?\n\}\n\nfunction buildAssignmentVariants/,
  strictInsertJobs,
  'strict service-job insert',
);

write(jobPath, job);

const employeeApiPath = 'src/lib/opc-employee-api.ts';
let employeeApi = read(employeeApiPath);
const zurichDateHelpers = `function dateInZurich(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function shiftIsoDate(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return \`${'${date.getUTCFullYear()}'}-${'${String(date.getUTCMonth() + 1).padStart(2, \'0\')}'}-${'${String(date.getUTCDate()).padStart(2, \'0\')}'}\`;
}

export function todayIsoDate() {
  return dateInZurich(new Date());
}

export function yesterdayIsoDate() {
  return shiftIsoDate(todayIsoDate(), -1);
}`;

employeeApi = replaceRegex(
  employeeApi,
  /export function todayIsoDate\(\) \{[\s\S]*?export function yesterdayIsoDate\(\) \{[\s\S]*?\n\}/,
  zurichDateHelpers,
  'employee API Zurich dates',
);
write(employeeApiPath, employeeApi);

console.log('Applied OPC root fixes: Europe/Zurich scheduling, strict job inserts, Zurich HR dates.');
