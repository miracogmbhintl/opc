import type { SupabaseClient, User } from '@supabase/supabase-js';
import { authenticateOpcRequest, normalizeOpcOperationalRole } from './opc-job-access';
import { getOpcServerEnvValue } from './opc-server-env';

type JsonRow = Record<string, any>;

const ACTIVE_STATUSES = new Set(['active', 'aktiv', 'enabled']);
const REPLACEABLE_TIME_STATUSES = new Set(['submitted', 'rejected', 'corrected']);
const ACTIVE_TIME_STATUSES = new Set([
  'open',
  'on_break',
  'active',
  'clocked_in',
  'started',
  'running',
  'in_progress',
]);

const ZURICH_TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Zurich',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export type TimeImportActor = {
  user: User;
  serviceClient: SupabaseClient;
  token: string;
  staffRows: JsonRow[];
};

export type NormalizedAiTimeRow = {
  source_row: number;
  employee_number: string | null;
  employee_name: string | null;
  email: string | null;
  work_date: string | null;
  clock_in_local: string | null;
  clock_out_local: string | null;
  clock_out_next_day: boolean;
  break_minutes: number | null;
  reported_total_minutes: number | null;
  note: string | null;
  job_reference: string | null;
  confidence: number;
  issues: string[];
  raw_source_label: string | null;
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeLookup(value: unknown) {
  return clean(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizeEmployeeNumber(value: unknown) {
  return clean(value).replace(/\s+/g, '').toUpperCase();
}

function normalizeEmail(value: unknown) {
  return clean(value).toLowerCase();
}


function nameTokens(value: unknown) {
  return normalizeLookup(value).split(' ').filter(Boolean);
}

function damerauLevenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0),
  );

  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );

      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        matrix[i][j] = Math.min(
          matrix[i][j],
          matrix[i - 2][j - 2] + cost,
        );
      }
    }
  }

  return matrix[a.length][b.length];
}

function stringSimilarity(aValue: unknown, bValue: unknown) {
  const a = normalizeLookup(aValue);
  const b = normalizeLookup(bValue);

  if (!a || !b) return 0;
  if (a === b) return 1;

  const distance = damerauLevenshtein(a, b);
  return Math.max(0, 1 - distance / Math.max(a.length, b.length));
}

function nameSimilarity(importedValue: unknown, candidateValue: unknown) {
  const imported = normalizeLookup(importedValue);
  const candidate = normalizeLookup(candidateValue);

  if (!imported || !candidate) return 0;
  if (imported === candidate) return 1;

  const importedTokens = nameTokens(imported);
  const candidateTokens = nameTokens(candidate);

  if (
    importedTokens.length >= 2 &&
    candidateTokens.length >= importedTokens.length &&
    candidate.startsWith(`${imported} `)
  ) {
    return 0.98;
  }

  if (
    candidateTokens.length >= 2 &&
    importedTokens.length >= candidateTokens.length &&
    imported.startsWith(`${candidate} `)
  ) {
    return 0.98;
  }

  const full = stringSimilarity(imported, candidate);

  if (importedTokens.length === 1 || candidateTokens.length === 1) {
    const first = stringSimilarity(importedTokens[0], candidateTokens[0]);
    return Math.max(full, first * 0.82);
  }

  const first = stringSimilarity(importedTokens[0], candidateTokens[0]);
  const last = stringSimilarity(
    importedTokens[importedTokens.length - 1],
    candidateTokens[candidateTokens.length - 1],
  );

  return Math.max(
    full,
    (first * 0.42) + (last * 0.46) + (full * 0.12),
  );
}

function statusLooksActive(value: unknown) {
  const status = clean(value).toLowerCase();
  return !['cancelled', 'canceled', 'inactive', 'terminated', 'archived', 'deleted'].includes(status);
}

function activeStaffRow(row: JsonRow) {
  return ACTIVE_STATUSES.has(clean(row.status || 'active').toLowerCase()) && row.can_access_portal !== false;
}

function canManageTimeImport(row: JsonRow) {
  const role = normalizeOpcOperationalRole(row.role);
  return (
    ['owner', 'admin', 'dispatch'].includes(role) ||
    row.can_manage_time_entries === true ||
    row.can_manage_employees === true ||
    row.can_manage_finance === true
  );
}

export async function requireTimeImportManager(request: Request, locals?: any): Promise<TimeImportActor | Response> {
  const auth = await authenticateOpcRequest(request, locals);

  if ('error' in auth) {
    return json({ error: auth.error }, auth.status);
  }

  const authorization = request.headers.get('authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();

  const { data: staffRows, error } = await auth.serviceClient
    .from('opc_staff_roles')
    .select('*')
    .eq('user_id', auth.user.id);

  if (error) {
    return json({ error: 'Berechtigung für Zeitimport konnte nicht geprüft werden.' }, 500);
  }

  const activeRows = ((staffRows || []) as JsonRow[]).filter(activeStaffRow);
  const allowed = activeRows.some(canManageTimeImport);

  if (!allowed) {
    return json(
      {
        error: 'Zeitimporte und Zeitexporte sind nur für berechtigte Owner, Admins oder Dispatch verfügbar.',
      },
      403,
    );
  }

  return {
    user: auth.user,
    serviceClient: auth.serviceClient,
    token,
    staffRows: activeRows,
  };
}

export function getOpenAiTimeImportConfig(locals?: any) {
  const apiKey =
    getOpcServerEnvValue(locals, 'OPENAI_API_KEY') ||
    String(import.meta.env.OPENAI_API_KEY || '').trim();
  const model =
    getOpcServerEnvValue(locals, 'OPENAI_TIME_IMPORT_MODEL') ||
    String(import.meta.env.OPENAI_TIME_IMPORT_MODEL || '').trim() ||
    'gpt-5.4';

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY ist serverseitig nicht konfiguriert.');
  }

  return { apiKey, model };
}

function outputText(response: any) {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const parts: string[] = [];
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content?.text === 'string') {
        parts.push(content.text);
      }
    }
  }

  return parts.join('\n').trim();
}

async function deleteOpenAiFile(apiKey: string, fileId: string) {
  try {
    await fetch(`https://api.openai.com/v1/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch {
    // Best-effort cleanup. The uploaded file also has an expiry.
  }
}

export async function normalizeTimeFileWithOpenAi(file: File, apiKey: string, model: string) {
  const uploadForm = new FormData();
  uploadForm.append('purpose', 'user_data');
  uploadForm.append('file', file, file.name);
  uploadForm.append('expires_after[anchor]', 'created_at');
  uploadForm.append('expires_after[seconds]', '3600');

  const uploadResponse = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: uploadForm,
  });

  const uploadJson = await uploadResponse.json().catch(() => ({}));

  if (!uploadResponse.ok || !uploadJson?.id) {
    throw new Error(
      uploadJson?.error?.message ||
        `OpenAI-Dateiupload fehlgeschlagen (${uploadResponse.status}).`,
    );
  }

  const fileId = String(uploadJson.id);

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      rows: {
        type: 'array',
        maxItems: 500,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            source_row: { type: 'integer', minimum: 1 },
            employee_number: { type: ['string', 'null'] },
            employee_name: { type: ['string', 'null'] },
            email: { type: ['string', 'null'] },
            work_date: { type: ['string', 'null'] },
            clock_in_local: { type: ['string', 'null'] },
            clock_out_local: { type: ['string', 'null'] },
            clock_out_next_day: { type: 'boolean' },
            break_minutes: { type: ['integer', 'null'], minimum: 0 },
            reported_total_minutes: { type: ['integer', 'null'], minimum: 0 },
            note: { type: ['string', 'null'] },
            job_reference: { type: ['string', 'null'] },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            issues: {
              type: 'array',
              items: { type: 'string' },
              maxItems: 12,
            },
            raw_source_label: { type: ['string', 'null'] },
          },
          required: [
            'source_row',
            'employee_number',
            'employee_name',
            'email',
            'work_date',
            'clock_in_local',
            'clock_out_local',
            'clock_out_next_day',
            'break_minutes',
            'reported_total_minutes',
            'note',
            'job_reference',
            'confidence',
            'issues',
            'raw_source_label',
          ],
        },
      },
      document_notes: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 20,
      },
    },
    required: ['rows', 'document_notes'],
  };

  const instructions = [
    'Extrahiere ausschliesslich Arbeitszeit-Zeilen aus der hochgeladenen Datei.',
    'Erfinde keine Mitarbeiter, Personalnummern, Daten oder Uhrzeiten.',
    'employee_number muss unverändert aus der Datei übernommen werden, falls vorhanden.',
    'work_date muss YYYY-MM-DD sein.',
    'clock_in_local und clock_out_local müssen HH:MM im lokalen Schweizer Zeitformat sein.',
    'clock_out_next_day ist nur true, wenn der Austritt tatsächlich am Folgetag liegt.',
    'break_minutes ist die gesamte unbezahlte Pause in Minuten.',
    'reported_total_minutes ist nur der in der Datei ausdrücklich genannte Nettowert; sonst null.',
    'Wenn Angaben fehlen oder widersprüchlich sind, setze das Feld null und beschreibe es in issues.',
    'Mehrere Zeiteinträge derselben Person am selben Tag müssen als separate rows erhalten bleiben.',
    'Wenn ein Arbeitsblatt nur einen Vornamen verwendet, diesen exakt übernehmen; keine Nachnamen raten.',
    'Falls derselbe vollständige Mitarbeitername an anderer Stelle der Arbeitsmappe eindeutig angegeben ist, darf employee_name mit diesem vorhandenen vollständigen Namen ergänzt werden.',
    'Bei XLSX muss raw_source_label nach Möglichkeit Tabellenblatt und Originalzeile enthalten, zum Beispiel Filip!5.',
    'source_row ist die Originalzeilennummer innerhalb des jeweiligen Tabellenblatts und muss nicht workbookweit eindeutig sein.',
    'Keine Datenbank-IDs erzeugen. Keine Zuordnung zu OPC-Mitarbeitern vornehmen.',
  ].join('\n');

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        store: false,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: instructions },
              { type: 'input_file', file_id: fileId },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'opc_time_import',
            strict: true,
            schema,
          },
        },
      }),
    });

    const responseJson = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        responseJson?.error?.message ||
          `OpenAI-Verarbeitung fehlgeschlagen (${response.status}).`,
      );
    }

    const text = outputText(responseJson);
    if (!text) {
      throw new Error('OpenAI hat keine strukturierten Zeitdaten zurückgegeben.');
    }

    const parsed = JSON.parse(text);
    const rows = Array.isArray(parsed?.rows) ? parsed.rows : [];

    if (rows.length > 500) {
      throw new Error('Der Import enthält mehr als 500 erkannte Zeitzeilen. Bitte Datei aufteilen.');
    }

    return {
      responseId: clean(responseJson?.id) || null,
      rows: rows as NormalizedAiTimeRow[],
      documentNotes: Array.isArray(parsed?.document_notes) ? parsed.document_notes : [],
    };
  } finally {
    await deleteOpenAiFile(apiKey, fileId);
  }
}

export async function sha256Hex(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function localTime(value: unknown) {
  const text = clean(value);
  if (!text) return null;
  const match = text.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? `${match[1]}:${match[2]}` : null;
}

function validIsoDate(value: unknown) {
  const text = clean(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function minutesOf(time: string | null) {
  if (!time) return null;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function computeImportedMinutes(
  clockIn: string | null,
  clockOut: string | null,
  nextDay: boolean,
  breakMinutes: number,
) {
  const start = minutesOf(clockIn);
  const end = minutesOf(clockOut);
  if (start === null || end === null) return null;

  let elapsed = end - start;
  if (nextDay || elapsed < 0) elapsed += 24 * 60;

  return Math.max(0, elapsed - Math.max(0, breakMinutes));
}

function formatZurichTime(value: unknown) {
  const text = clean(value);
  if (!text) return null;
  const date = new Date(text);
  if (!Number.isFinite(date.getTime())) return null;
  return ZURICH_TIME_FORMAT.format(date);
}

function numberOrZero(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function minuteDiff(imported: string | null, existing: string | null) {
  const a = minutesOf(imported);
  const b = minutesOf(existing);
  if (a === null || b === null) return null;
  let diff = a - b;
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;
  return diff;
}

function existingSnapshot(row: JsonRow, payrollUsed: boolean) {
  return {
    id: clean(row.id),
    status: clean(row.status),
    clock_in_local: formatZurichTime(row.clock_in_at),
    clock_out_local: formatZurichTime(row.clock_out_at),
    break_minutes: numberOrZero(row.break_minutes),
    total_minutes: numberOrZero(row.total_minutes),
    employee_note: clean(row.employee_note) || null,
    recording_method: clean(row.recording_method) || null,
    payroll_used: payrollUsed,
  };
}

function isLockedExisting(row: JsonRow, payrollUsed: boolean) {
  const status = clean(row.status).toLowerCase();
  if (payrollUsed) return 'Bereits in einem genehmigten oder bezahlten Lohnlauf verwendet.';
  if (status === 'approved') return 'Genehmigte Zeiten sind unveränderbar und müssen über den Korrekturprozess behandelt werden.';
  if (ACTIVE_TIME_STATUSES.has(status) || !row.clock_out_at) {
    return 'Der Mitarbeiter ist in diesem Eintrag noch aktiv oder der Eintrag ist nicht abgeschlossen.';
  }
  if (!REPLACEABLE_TIME_STATUSES.has(status)) {
    return `Status "${status || 'unbekannt'}" darf nicht durch einen Dateiimport überschrieben werden.`;
  }
  return null;
}

export async function buildImportPreview(
  serviceClient: SupabaseClient,
  normalizedRows: NormalizedAiTimeRow[],
) {
  const sourceSheetKey = (row: NormalizedAiTimeRow) => {
    const label = clean(row.raw_source_label);
    if (!label) return null;
    const bang = label.indexOf('!');
    if (bang > 0) return normalizeLookup(label.slice(0, bang));
    const colon = label.indexOf(':');
    if (colon > 0) return normalizeLookup(label.slice(0, colon));
    return null;
  };

  const sheetIdentities = new Map<string, Set<string>>();
  const identityExamples = new Map<string, NormalizedAiTimeRow>();

  for (const row of normalizedRows) {
    const sheetKey = sourceSheetKey(row);
    const identityKey =
      normalizeEmployeeNumber(row.employee_number) ||
      normalizeEmail(row.email) ||
      normalizeLookup(row.employee_name);

    if (!sheetKey || !identityKey) continue;

    const identities = sheetIdentities.get(sheetKey) || new Set<string>();
    identities.add(identityKey);
    sheetIdentities.set(sheetKey, identities);

    if (!identityExamples.has(`${sheetKey}::${identityKey}`)) {
      identityExamples.set(`${sheetKey}::${identityKey}`, row);
    }
  }

  const normalizedRowsWithInheritedIdentity = normalizedRows.map((row) => {
    if (
      normalizeEmployeeNumber(row.employee_number) ||
      normalizeEmail(row.email) ||
      normalizeLookup(row.employee_name)
    ) {
      return row;
    }

    const sheetKey = sourceSheetKey(row);
    if (!sheetKey) return row;

    const identities = Array.from(sheetIdentities.get(sheetKey) || []);
    if (identities.length !== 1) return row;

    const example = identityExamples.get(`${sheetKey}::${identities[0]}`);
    if (!example) return row;

    return {
      ...row,
      employee_number: example.employee_number || null,
      employee_name: example.employee_name || null,
      email: example.email || null,
      issues: Array.from(
        new Set([
          ...(Array.isArray(row.issues) ? row.issues : []),
          'Mitarbeiteridentität wurde eindeutig aus demselben Arbeitsblatt übernommen.',
        ]),
      ),
    };
  });

  const importedValidDates = normalizedRowsWithInheritedIdentity
    .map((row) => validIsoDate(row.work_date))
    .filter(Boolean) as string[];

  const currentYear = new Date().getUTCFullYear();
  const operationalDates = importedValidDates.filter((value) => {
    const year = Number(value.slice(0, 4));
    return year >= currentYear - 2 && year <= currentYear + 1;
  });

  const minOperationalDate = operationalDates.length
    ? [...operationalDates].sort()[0]
    : null;
  const maxOperationalDate = operationalDates.length
    ? [...operationalDates].sort().slice(-1)[0]
    : null;

  let historyQuery = serviceClient
    .from('opc_employee_time_entries')
    .select('employee_id,employee_name,work_date,status,created_at');

  if (minOperationalDate && maxOperationalDate) {
    const lower = new Date(`${minOperationalDate}T12:00:00Z`);
    const upper = new Date(`${maxOperationalDate}T12:00:00Z`);
    lower.setUTCDate(lower.getUTCDate() - 120);
    upper.setUTCDate(upper.getUTCDate() + 30);

    historyQuery = historyQuery
      .gte('work_date', lower.toISOString().slice(0, 10))
      .lte('work_date', upper.toISOString().slice(0, 10));
  }

  const [
    { data: employeesData, error: employeesError },
    { data: staffData, error: staffError },
    { data: contractsData, error: contractsError },
    { data: payrollProfilesData, error: payrollProfilesError },
    { data: historyData, error: historyError },
  ] = await Promise.all([
    serviceClient.from('opc_employees').select('*'),
    serviceClient.from('opc_staff_roles').select('*'),
    serviceClient.from('opc_employment_contracts').select('*'),
    serviceClient.from('opc_employee_payroll_profiles').select('*'),
    historyQuery.limit(10000),
  ]);

  if (employeesError) throw employeesError;
  if (staffError) throw staffError;
  if (contractsError) throw contractsError;
  if (payrollProfilesError) throw payrollProfilesError;
  if (historyError) throw historyError;

  const employees = (employeesData || []) as JsonRow[];
  const allStaffRows = (staffData || []) as JsonRow[];
  const staffRows = allStaffRows.filter(activeStaffRow);
  const contracts = (contractsData || []) as JsonRow[];
  const payrollProfiles = (payrollProfilesData || []) as JsonRow[];
  const historyRows = (historyData || []) as JsonRow[];

  const employeeById = new Map(employees.map((row) => [clean(row.id), row]));
  const staffByEmployee = new Map<string, JsonRow[]>();
  const contractsByEmployee = new Map<string, JsonRow[]>();
  const payrollProfilesByEmployee = new Map<string, JsonRow[]>();
  const historyByEmployee = new Map<string, JsonRow[]>();

  for (const row of allStaffRows) {
    const id = clean(row.employee_id);
    if (!id) continue;
    const list = staffByEmployee.get(id) || [];
    list.push(row);
    staffByEmployee.set(id, list);
  }

  for (const row of contracts) {
    const id = clean(row.employee_id);
    if (!id) continue;
    const list = contractsByEmployee.get(id) || [];
    list.push(row);
    contractsByEmployee.set(id, list);
  }

  for (const row of payrollProfiles) {
    const id = clean(row.employee_id);
    if (!id) continue;
    const list = payrollProfilesByEmployee.get(id) || [];
    list.push(row);
    payrollProfilesByEmployee.set(id, list);
  }

  for (const row of historyRows) {
    const id = clean(row.employee_id);
    if (!id) continue;
    const list = historyByEmployee.get(id) || [];
    list.push(row);
    historyByEmployee.set(id, list);
  }

  type ResolverCandidate = {
    employee: JsonRow;
    employeeId: string;
    employeeNumber: string | null;
    employeeName: string;
    score: number;
    nameScore: number;
    confidence: number;
    reasons: string[];
    exactAlias: boolean;
    activeStaff: boolean;
    activeContract: boolean;
    activePayrollProfile: boolean;
    historyCount: number;
    overlappingWorkDays: number;
    lastWorkDate: string | null;
  };

  type ResolvedIdentity = {
    employee: JsonRow | null;
    matchMethod: string | null;
    matchError: string | null;
    matchConfidence: number;
    matchReasons: string[];
    candidates: ResolverCandidate[];
  };

  const importedGroups = new Map<string, NormalizedAiTimeRow[]>();

  for (const row of normalizedRows) {
    const groupKey =
      normalizeEmployeeNumber(row.employee_number) ||
      normalizeEmail(row.email) ||
      normalizeLookup(row.employee_name) ||
      `row:${row.source_row}`;

    const list = importedGroups.get(groupKey) || [];
    list.push(row);
    importedGroups.set(groupKey, list);
  }

  const identityResolution = new Map<string, ResolvedIdentity>();

  const profileForEmployee = (employee: JsonRow, importedRows: NormalizedAiTimeRow[]) => {
    const employeeId = clean(employee.id);
    const employeeStaff = staffByEmployee.get(employeeId) || [];
    const employeeContracts = contractsByEmployee.get(employeeId) || [];
    const employeePayrollProfiles = payrollProfilesByEmployee.get(employeeId) || [];
    const employeeHistory = historyByEmployee.get(employeeId) || [];

    const activeStaff = employeeStaff.some(activeStaffRow);
    const activeContract = employeeContracts.some((row) => statusLooksActive(row.status || 'active'));
    const activePayrollProfile = employeePayrollProfiles.some((row) =>
      statusLooksActive(row.status || 'active'),
    );

    const aliases = new Set<string>();
    const legalName = [employee.legal_first_name, employee.legal_last_name]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (legalName) aliases.add(legalName);

    for (const row of employeeStaff) {
      if (clean(row.display_name)) aliases.add(clean(row.display_name));
      if (clean(row.name)) aliases.add(clean(row.name));
    }

    for (const row of employeeHistory) {
      if (clean(row.employee_name)) aliases.add(clean(row.employee_name));
    }

    const importedName =
      clean(importedRows.find((row) => clean(row.employee_name))?.employee_name);

    let bestNameScore = 0;
    let exactAlias = false;

    for (const alias of aliases) {
      const similarity = nameSimilarity(importedName, alias);
      bestNameScore = Math.max(bestNameScore, similarity * 100);

      if (
        normalizeLookup(importedName) &&
        normalizeLookup(importedName) === normalizeLookup(alias)
      ) {
        exactAlias = true;
      }
    }

    const importedDateSet = new Set(
      importedRows
        .map((row) => validIsoDate(row.work_date))
        .filter(Boolean) as string[],
    );

    const historyDateSet = new Set(
      employeeHistory.map((row) => clean(row.work_date)).filter(Boolean),
    );

    let overlappingWorkDays = 0;
    for (const date of importedDateSet) {
      if (historyDateSet.has(date)) overlappingWorkDays += 1;
    }

    const lastWorkDate =
      employeeHistory
        .map((row) => clean(row.work_date))
        .filter(Boolean)
        .sort()
        .slice(-1)[0] || null;

    const importedNumber = normalizeEmployeeNumber(
      importedRows.find((row) => normalizeEmployeeNumber(row.employee_number))?.employee_number,
    );
    const importedEmail = normalizeEmail(
      importedRows.find((row) => normalizeEmail(row.email))?.email,
    );

    const employeeNumberExact =
      Boolean(importedNumber) &&
      importedNumber === normalizeEmployeeNumber(employee.employee_number);

    const emailExact =
      Boolean(importedEmail) &&
      employeeStaff.some((row) => normalizeEmail(row.email) === importedEmail);

    let operationalScore = 0;
    const reasons: string[] = [];

    if (employeeNumberExact) {
      operationalScore += 100;
      reasons.push('Mitarbeiter-Nr. exakt');
    }

    if (emailExact) {
      operationalScore += 100;
      reasons.push('E-Mail exakt');
    }

    if (exactAlias) reasons.push('Name exakt im OPC-System');
    else if (bestNameScore >= 94) reasons.push('Name nahezu identisch');
    else if (bestNameScore >= 88) reasons.push('Name mit kleiner Schreibabweichung');

    if (activeStaff) {
      operationalScore += 12;
      reasons.push('aktives Portalprofil');
    }

    if (activeContract) {
      operationalScore += 8;
      reasons.push('aktiver Arbeitsvertrag');
    }

    if (activePayrollProfile) {
      operationalScore += 5;
      reasons.push('aktives Payroll-Profil');
    }

    if (employeeHistory.length > 0) {
      operationalScore += Math.min(
        8,
        2 + Math.log2(employeeHistory.length + 1) * 1.5,
      );
      reasons.push('historische Zeiterfassung vorhanden');
    }

    if (overlappingWorkDays > 0) {
      operationalScore += Math.min(18, overlappingWorkDays * 4);
      reasons.push(`${overlappingWorkDays} gleiche Arbeitstage im System`);
    }

    if (statusLooksActive(employee.status || 'active')) {
      operationalScore += 3;
    }

    const score =
      employeeNumberExact || emailExact
        ? 200 + operationalScore
        : bestNameScore + operationalScore;

    const confidence =
      employeeNumberExact || emailExact
        ? 100
        : Math.max(
            0,
            Math.min(
              99,
              Math.round(
                (bestNameScore * 0.9) +
                Math.min(9, operationalScore * 0.22),
              ),
            ),
          );

    return {
      employee,
      employeeId,
      employeeNumber: clean(employee.employee_number) || null,
      employeeName: legalName || clean(employeeStaff[0]?.display_name) || employeeId,
      score,
      nameScore: bestNameScore,
      confidence,
      reasons,
      exactAlias,
      activeStaff,
      activeContract,
      activePayrollProfile,
      historyCount: employeeHistory.length,
      overlappingWorkDays,
      lastWorkDate,
    } satisfies ResolverCandidate;
  };

  for (const [groupKey, importedRows] of importedGroups.entries()) {
    const importedNumber = normalizeEmployeeNumber(
      importedRows.find((row) => normalizeEmployeeNumber(row.employee_number))?.employee_number,
    );
    const importedEmail = normalizeEmail(
      importedRows.find((row) => normalizeEmail(row.email))?.email,
    );
    const importedName =
      clean(importedRows.find((row) => clean(row.employee_name))?.employee_name);

    const candidates = employees
      .map((employee) => profileForEmployee(employee, importedRows))
      .filter((candidate) => {
        if (importedNumber) {
          return normalizeEmployeeNumber(candidate.employee.employee_number) === importedNumber;
        }

        if (importedEmail) {
          const rows = staffByEmployee.get(candidate.employeeId) || [];
          if (rows.some((row) => normalizeEmail(row.email) === importedEmail)) {
            return true;
          }
        }

        return candidate.nameScore >= 68;
      })
      .sort((a, b) => b.score - a.score || b.nameScore - a.nameScore)
      .slice(0, 5);

    let employee: JsonRow | null = null;
    let matchMethod: string | null = null;
    let matchError: string | null = null;
    let matchConfidence = 0;
    let matchReasons: string[] = [];

    const top = candidates[0];
    const second = candidates[1];
    const margin = top && second
      ? top.score - second.score
      : Number.POSITIVE_INFINITY;

    if (top) {
      const numberExact =
        Boolean(importedNumber) &&
        normalizeEmployeeNumber(top.employee.employee_number) === importedNumber;

      const emailExact =
        Boolean(importedEmail) &&
        (staffByEmployee.get(top.employeeId) || []).some(
          (row) => normalizeEmail(row.email) === importedEmail,
        );

      if (numberExact) {
        employee = top.employee;
        matchMethod = 'employee_number';
      } else if (emailExact) {
        employee = top.employee;
        matchMethod = 'email';
      } else if (
        top.exactAlias &&
        (!second || !second.exactAlias || margin >= 8)
      ) {
        employee = top.employee;
        matchMethod = second?.exactAlias
          ? 'exact_name_deep_resolved'
          : 'exact_name';
      } else if (
        top.nameScore >= 94 &&
        (!second || margin >= 6)
      ) {
        employee = top.employee;
        matchMethod = 'fuzzy_name_high_confidence';
      } else if (
        top.nameScore >= 88 &&
        (top.activeStaff || top.activeContract || top.historyCount > 0) &&
        (!second || margin >= 10)
      ) {
        employee = top.employee;
        matchMethod = 'fuzzy_name_operational';
      } else if (
        nameTokens(importedName).length === 1 &&
        top.nameScore >= 80 &&
        top.activeStaff &&
        (!second || margin >= 14)
      ) {
        employee = top.employee;
        matchMethod = 'unique_first_name_deep';
      }

      if (employee) {
        matchConfidence = top.confidence;
        matchReasons = top.reasons;
      } else {
        const candidateSummary = candidates
          .slice(0, 3)
          .map((candidate) =>
            `${candidate.employeeNumber || 'ohne Nr.'} ${candidate.employeeName} (${candidate.confidence}%)`,
          )
          .join(', ');

        matchError = candidates.length > 1
          ? `Mitarbeiter nicht sicher automatisch zugeordnet. Beste Kandidaten: ${candidateSummary}.`
          : `Mitarbeiter nicht sicher automatisch zugeordnet. Kandidat: ${candidateSummary}.`;
      }
    }

    if (!employee && !matchError) {
      matchError = 'Kein ausreichend passender OPC-Mitarbeiter gefunden.';
    }

    identityResolution.set(groupKey, {
      employee,
      matchMethod,
      matchError,
      matchConfidence,
      matchReasons,
      candidates,
    });
  }

  const matched = normalizedRowsWithInheritedIdentity.map((row) => {
    const groupKey =
      normalizeEmployeeNumber(row.employee_number) ||
      normalizeEmail(row.email) ||
      normalizeLookup(row.employee_name) ||
      `row:${row.source_row}`;

    const resolution = identityResolution.get(groupKey);

    return {
      row,
      employee: resolution?.employee || null,
      matchMethod: resolution?.matchMethod || null,
      matchError: resolution?.matchError || null,
      matchConfidence: resolution?.matchConfidence || 0,
      matchReasons: resolution?.matchReasons || [],
      matchCandidates: resolution?.candidates || [],
    };
  });

  const employeeIds = Array.from(
    new Set(matched.map((item) => clean(item.employee?.id)).filter(Boolean)),
  );
  const validDates = matched
    .map((item) => validIsoDate(item.row.work_date))
    .filter(Boolean) as string[];

  let existingEntries: JsonRow[] = [];
  if (employeeIds.length && validDates.length) {
    const minDate = [...validDates].sort()[0];
    const maxDate = [...validDates].sort().slice(-1)[0];

    const { data, error } = await serviceClient
      .from('opc_employee_time_entries')
      .select('*')
      .in('employee_id', employeeIds)
      .gte('work_date', minDate)
      .lte('work_date', maxDate)
      .order('created_at', { ascending: true });

    if (error) throw error;
    existingEntries = (data || []) as JsonRow[];
  }

  const payrollEntryIds = new Set<string>();
  if (employeeIds.length) {
    const { data: runsData, error: runsError } = await serviceClient
      .from('opc_payroll_runs')
      .select('id,employee_id,status')
      .in('employee_id', employeeIds)
      .in('status', ['approved', 'paid']);

    if (runsError) throw runsError;

    const runIds = ((runsData || []) as JsonRow[]).map((row) => clean(row.id)).filter(Boolean);
    if (runIds.length) {
      const { data: employeeRuns, error: employeeRunsError } = await serviceClient
        .from('opc_payroll_run_employees')
        .select('payroll_run_id,employee_id,calculation_snapshot')
        .in('payroll_run_id', runIds);

      if (employeeRunsError) throw employeeRunsError;

      for (const row of (employeeRuns || []) as JsonRow[]) {
        const ids = Array.isArray(row?.calculation_snapshot?.approved_entry_ids)
          ? row.calculation_snapshot.approved_entry_ids
          : [];
        for (const id of ids) payrollEntryIds.add(clean(id));
      }
    }
  }

  const existingByEmployeeDate = new Map<string, JsonRow[]>();
  for (const entry of existingEntries) {
    const key = `${clean(entry.employee_id)}|${clean(entry.work_date)}`;
    const list = existingByEmployeeDate.get(key) || [];
    list.push(entry);
    existingByEmployeeDate.set(key, list);
  }

  return matched.map((item, index) => {
    const row = item.row;
    const workDate = validIsoDate(row.work_date);
    const clockIn = localTime(row.clock_in_local);
    const clockOut = localTime(row.clock_out_local);
    const breakMinutes = Math.max(0, Math.round(numberOrZero(row.break_minutes)));
    const importedTotal = computeImportedMinutes(
      clockIn,
      clockOut,
      row.clock_out_next_day === true,
      breakMinutes,
    );

    const baseIssues = Array.isArray(row.issues) ? [...row.issues] : [];
    if (!workDate) baseIssues.push('Ungültiges oder fehlendes Arbeitsdatum.');
    if (!clockIn) baseIssues.push('Startzeit fehlt oder ist ungültig.');
    if (!clockOut) baseIssues.push('Endzeit fehlt oder ist ungültig.');
    if (importedTotal !== null && importedTotal <= 0) {
      baseIssues.push('Die berechnete Nettozeit ist 0 Minuten.');
    }

    const employeeId = clean(item.employee?.id) || null;
    const employeeNumber = clean(item.employee?.employee_number) || clean(row.employee_number) || null;
    const employeeName =
      [item.employee?.legal_first_name, item.employee?.legal_last_name].filter(Boolean).join(' ').trim() ||
      clean(row.employee_name) ||
      null;

    const existing = employeeId && workDate
      ? existingByEmployeeDate.get(`${employeeId}|${workDate}`) || []
      : [];

    const snapshots = existing.map((entry) =>
      existingSnapshot(entry, payrollEntryIds.has(clean(entry.id))),
    );

    let conflictType = 'new';
    let lockedReason: string | null = null;
    let overrideAllowed = false;
    let recommendedAction = 'insert';
    let resolution = 'insert';

    if (!employeeId) {
      conflictType = item.matchError?.includes('Mehrere') ? 'employee_ambiguous' : 'employee_unmatched';
      lockedReason = item.matchError || 'Mitarbeiter nicht zugeordnet.';
      recommendedAction = 'keep';
      resolution = 'keep';
    } else if (baseIssues.some((issue) => /datum|startzeit|endzeit|nettozeit/i.test(issue))) {
      conflictType = 'invalid';
      lockedReason = 'Die importierte Zeile enthält unvollständige oder ungültige Zeitangaben.';
      recommendedAction = 'keep';
      resolution = 'keep';
    } else if (existing.length === 0) {
      conflictType = 'new';
      recommendedAction = 'insert';
      resolution = 'insert';
    } else if (existing.length > 1) {
      conflictType = 'multiple_existing';
      lockedReason = 'Mehrere bestehende Einträge am selben Tag gefunden. Kein automatischer Override.';
      recommendedAction = 'review';
      resolution = 'review';
    } else {
      const one = existing[0];
      const payrollUsed = payrollEntryIds.has(clean(one.id));
      const lock = isLockedExisting(one, payrollUsed);

      const existingClockIn = formatZurichTime(one.clock_in_at);
      const existingClockOut = formatZurichTime(one.clock_out_at);
      const existingBreak = numberOrZero(one.break_minutes);
      const existingTotal = numberOrZero(one.total_minutes);

      const exact =
        existingClockIn === clockIn &&
        existingClockOut === clockOut &&
        existingBreak === breakMinutes &&
        (importedTotal === null || existingTotal === importedTotal);

      if (exact) {
        conflictType = 'exact_match';
        recommendedAction = 'keep';
        resolution = 'keep';
      } else {
        conflictType = lock ? 'locked_conflict' : 'time_conflict';
        lockedReason = lock;
        overrideAllowed = !lock;
        recommendedAction = lock ? 'keep' : 'review';
        resolution = lock ? 'keep' : 'review';
      }
    }

    const firstExisting = snapshots[0] || null;
    const conflictFields = firstExisting
      ? {
          clock_in: firstExisting.clock_in_local !== clockIn,
          clock_out: firstExisting.clock_out_local !== clockOut,
          break_minutes: Number(firstExisting.break_minutes || 0) !== breakMinutes,
          total_minutes:
            importedTotal !== null &&
            Number(firstExisting.total_minutes || 0) !== importedTotal,
          differences: {
            clock_in_minutes: minuteDiff(clockIn, firstExisting.clock_in_local),
            clock_out_minutes: minuteDiff(clockOut, firstExisting.clock_out_local),
            break_minutes: breakMinutes - Number(firstExisting.break_minutes || 0),
            total_minutes:
              importedTotal === null
                ? null
                : importedTotal - Number(firstExisting.total_minutes || 0),
          },
        }
      : {};

    return {
      source_row_number: index + 1,
      raw_source_label:
        clean(row.raw_source_label) ||
        (Number(row.source_row || 0) > 0 ? `Zeile ${Number(row.source_row)}` : null),
      employee_id: employeeId,
      employee_number: employeeNumber,
      employee_name: employeeName,
      imported_employee_number: clean(row.employee_number) || null,
      imported_employee_name: clean(row.employee_name) || null,
      imported_email: clean(row.email) || null,
      employee_match_method: item.matchMethod,
      employee_match_confidence: Math.max(0, Math.min(1, Number(item.matchConfidence || 0) / 100)),
      work_date: workDate,
      clock_in_local: clockIn,
      clock_out_local: clockOut,
      clock_out_next_day: row.clock_out_next_day === true,
      break_minutes: breakMinutes,
      total_minutes: importedTotal,
      reported_total_minutes:
        row.reported_total_minutes === null || row.reported_total_minutes === undefined
          ? null
          : Math.max(0, Math.round(numberOrZero(row.reported_total_minutes))),
      note: clean(row.note) || null,
      job_reference: clean(row.job_reference) || null,
      existing_entries: snapshots,
      conflict_fields: conflictFields,
      conflict_type: conflictType,
      locked_reason: lockedReason,
      override_allowed: overrideAllowed,
      recommended_action: recommendedAction,
      resolution,
      issues: baseIssues,
      metadata: {
        ai_confidence: Math.max(0, Math.min(1, Number(row.confidence || 0))),
        ai_issues: baseIssues,
        source_row_in_file: Number(row.source_row || 0) > 0 ? Number(row.source_row) : null,
        source_locator:
          clean(row.raw_source_label) ||
          (Number(row.source_row || 0) > 0 ? `Zeile ${Number(row.source_row)}` : null),
        employee_match: {
          method: item.matchMethod,
          confidence: Number(item.matchConfidence || 0),
          reasons: item.matchReasons || [],
          candidates: (item.matchCandidates || []).slice(0, 3).map((candidate: ResolverCandidate) => ({
            employee_id: candidate.employeeId,
            employee_number: candidate.employeeNumber,
            employee_name: candidate.employeeName,
            confidence: candidate.confidence,
            reasons: candidate.reasons,
            active_staff: candidate.activeStaff,
            active_contract: candidate.activeContract,
            active_payroll_profile: candidate.activePayrollProfile,
            history_count: candidate.historyCount,
            overlapping_work_days: candidate.overlappingWorkDays,
            last_work_date: candidate.lastWorkDate,
          })),
        },
      },
    };
  });
}
