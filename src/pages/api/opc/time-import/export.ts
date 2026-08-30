import type { APIRoute } from 'astro';
import { json, requireTimeImportManager } from '../../../../lib/opc-time-import-server';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function csvSafe(value: unknown) {
  let text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function formatLocalTime(value: unknown) {
  const text = String(value || '').trim();
  if (!text) return '';
  const date = new Date(text);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('de-CH', {
    timeZone: 'Europe/Zurich',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const actor = await requireTimeImportManager(request, locals);
    if (actor instanceof Response) return actor;

    const url = new URL(request.url);
    const from = String(url.searchParams.get('from') || '');
    const to = String(url.searchParams.get('to') || '');

    if (!ISO_DATE.test(from) || !ISO_DATE.test(to) || from > to) {
      return json({ error: 'Ungültiger Exportzeitraum.' }, 400);
    }

    const [{ data: entries, error: entriesError }, { data: employees, error: employeesError }] =
      await Promise.all([
        actor.serviceClient
          .from('opc_employee_time_entries')
          .select('*')
          .gte('work_date', from)
          .lte('work_date', to)
          .order('work_date', { ascending: true })
          .order('clock_in_at', { ascending: true }),
        actor.serviceClient
          .from('opc_employees')
          .select('id,employee_number,legal_first_name,legal_last_name'),
      ]);

    if (entriesError) throw entriesError;
    if (employeesError) throw employeesError;

    const employeeMap = new Map(
      (employees || []).map((employee: any) => [String(employee.id), employee]),
    );

    const headers = [
      'Mitarbeiter-Nr.',
      'Mitarbeiter',
      'Datum',
      'Start',
      'Ende',
      'Pause Min.',
      'Netto Min.',
      'Status',
      'Notiz',
    ];

    const lines = [headers.map(csvSafe).join(';')];

    for (const entry of entries || []) {
      const employee = employeeMap.get(String(entry.employee_id || '')) as any;
      const name =
        [employee?.legal_first_name, employee?.legal_last_name].filter(Boolean).join(' ').trim() ||
        entry.employee_name ||
        '';

      lines.push(
        [
          employee?.employee_number || '',
          name,
          entry.work_date || '',
          formatLocalTime(entry.clock_in_at),
          formatLocalTime(entry.clock_out_at),
          Number(entry.break_minutes || 0),
          Number(entry.total_minutes || 0),
          entry.status || '',
          entry.employee_note || '',
        ]
          .map(csvSafe)
          .join(';'),
      );
    }

    const csv = `\uFEFF${lines.join('\r\n')}\r\n`;
    const filename = `Zeiterfassung_${from}_${to}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('[opc/time-import/export] failed', error);
    return json({ error: error?.message || 'Zeiten konnten nicht exportiert werden.' }, 500);
  }
};
