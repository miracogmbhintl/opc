export type ExportRow = Record<string, any>;

export type CsvColumn<T = ExportRow> = {
  header: string;
  value: (row: T) => unknown;
};

export type OpcExportFile = {
  filename: string;
  content: string;
  rowCount: number;
};

const PAGE_SIZE = 1000;

export async function fetchAllExportRows(
  supabase: any,
  table: string,
  selection: string,
  orderBy?: string,
) {
  const rows: ExportRow[] = [];
  let from = 0;

  for (;;) {
    let query = supabase
      .from(table)
      .select(selection)
      .range(from, from + PAGE_SIZE - 1);

    if (orderBy) {
      query = query.order(orderBy, {
        ascending: false,
      });
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(
        `Datenexport ${table} fehlgeschlagen: ${error.message}`,
      );
    }

    const page = Array.isArray(data) ? data : [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;

    from += PAGE_SIZE;

    if (from > 250000) {
      throw new Error(
        `Datenexport ${table} wurde aus Sicherheitsgründen bei 250000 Datensätzen gestoppt.`,
      );
    }
  }

  return rows;
}

export function formatDate(value: unknown) {
  const text = String(value || '').trim();

  if (!text) return '';

  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})/,
  );

  if (!match) return text;

  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function formatDateTime(value: unknown) {
  const text = String(value || '').trim();

  if (!text) return '';

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return text;
  }

  return new Intl.DateTimeFormat('de-CH', {
    timeZone: 'Europe/Zurich',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatMoney(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '';
  }

  const amount = Number(value);

  return Number.isFinite(amount)
    ? amount.toFixed(2)
    : '';
}

export function formatNumber(
  value: unknown,
  decimals = 2,
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '';
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number.toFixed(decimals)
    : '';
}

export function yesNo(value: unknown) {
  if (value === true) return 'Ja';
  if (value === false) return 'Nein';
  return '';
}

export function hoursFromMinutes(value: unknown) {
  const minutes = Number(value || 0);

  if (!Number.isFinite(minutes)) return '';

  return (minutes / 60).toFixed(2);
}

function protectSpreadsheetFormula(value: string) {
  const trimmed = value.trimStart();

  if (/^[=+\-@]/.test(trimmed)) {
    return `'${value}`;
  }

  return value;
}

function csvCell(value: unknown) {
  let text = '';

  if (value === null || value === undefined) {
    text = '';
  } else if (typeof value === 'boolean') {
    text = yesNo(value);
  } else {
    text = String(value);
  }

  text = protectSpreadsheetFormula(text);

  if (
    text.includes(';') ||
    text.includes('"') ||
    text.includes('\n') ||
    text.includes('\r')
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function createCsv<T>(
  rows: T[],
  columns: CsvColumn<T>[],
) {
  const output = [
    columns
      .map((column) => csvCell(column.header))
      .join(';'),
    ...rows.map((row) =>
      columns
        .map((column) => csvCell(column.value(row)))
        .join(';'),
    ),
  ];

  return `\uFEFF${output.join('\r\n')}`;
}

export function createExportFile<T>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[],
): OpcExportFile {
  return {
    filename,
    content: createCsv(rows, columns),
    rowCount: rows.length,
  };
}
