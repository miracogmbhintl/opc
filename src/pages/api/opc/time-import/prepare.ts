import type { APIRoute } from 'astro';
import {
  buildImportPreview,
  getOpenAiTimeImportConfig,
  json,
  normalizeTimeFileWithOpenAi,
  requireTimeImportManager,
  sha256Hex,
} from '../../../../lib/opc-time-import-server';

const ALLOWED_EXTENSIONS = new Set(['csv', 'tsv', 'xlsx', 'xls', 'pdf', 'txt']);
const MAX_FILE_BYTES = 15 * 1024 * 1024;

function extension(name: string) {
  const clean = String(name || '').trim();
  const index = clean.lastIndexOf('.');
  return index >= 0 ? clean.slice(index + 1).toLowerCase() : '';
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const actor = await requireTimeImportManager(request, locals);
    if (actor instanceof Response) return actor;

    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return json({ error: 'Bitte eine Zeitdatei auswählen.' }, 400);
    }

    if (!file.size || file.size > MAX_FILE_BYTES) {
      return json({ error: 'Die Datei muss zwischen 1 Byte und 15 MB gross sein.' }, 400);
    }

    const ext = extension(file.name);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return json(
        {
          error: 'Unterstützte Formate: CSV, TSV, XLSX, XLS, PDF und TXT.',
        },
        400,
      );
    }

    const { apiKey, model } = getOpenAiTimeImportConfig(locals);
    const [fileHash, aiResult] = await Promise.all([
      sha256Hex(file),
      normalizeTimeFileWithOpenAi(file, apiKey, model),
    ]);

    if (!aiResult.rows.length) {
      return json(
        {
          error: 'In der Datei wurden keine Arbeitszeit-Zeilen erkannt.',
          documentNotes: aiResult.documentNotes,
        },
        422,
      );
    }

    const previewRows = await buildImportPreview(actor.serviceClient, aiResult.rows);

    const counts = {
      total: previewRows.length,
      new: previewRows.filter((row) => row.conflict_type === 'new').length,
      exact: previewRows.filter((row) => row.conflict_type === 'exact_match').length,
      conflicts: previewRows.filter((row) =>
        ['time_conflict', 'multiple_existing', 'locked_conflict'].includes(row.conflict_type),
      ).length,
      blocked: previewRows.filter((row) =>
        ['locked_conflict', 'employee_unmatched', 'employee_ambiguous', 'invalid'].includes(row.conflict_type),
      ).length,
    };

    const { data: batch, error: batchError } = await actor.serviceClient
      .from('opc_time_import_batches')
      .insert({
        created_by: actor.user.id,
        status: 'review',
        filename: file.name,
        file_sha256: fileHash,
        file_size_bytes: file.size,
        mime_type: file.type || null,
        ai_model: model,
        ai_response_id: aiResult.responseId,
        total_rows: counts.total,
        new_rows: counts.new,
        exact_rows: counts.exact,
        conflict_rows: counts.conflicts,
        blocked_rows: counts.blocked,
        metadata: {
          document_notes: aiResult.documentNotes,
          source: 'openai_time_import',
        },
      })
      .select('*')
      .single();

    if (batchError) throw batchError;

    const insertRows = previewRows.map((row) => ({
      batch_id: batch.id,
      ...row,
    }));

    const { data: stagedRows, error: rowsError } = await actor.serviceClient
      .from('opc_time_import_rows')
      .insert(insertRows)
      .select('*')
      .order('source_row_number', { ascending: true });

    if (rowsError) {
      await actor.serviceClient
        .from('opc_time_import_batches')
        .delete()
        .eq('id', batch.id);
      throw rowsError;
    }

    return json({
      batch,
      counts,
      rows: stagedRows || [],
      documentNotes: aiResult.documentNotes,
    });
  } catch (error: any) {
    console.error('[opc/time-import/prepare] failed', error);
    return json(
      {
        error:
          error?.message ||
          error?.details ||
          error?.hint ||
          'Zeitimport konnte nicht vorbereitet werden.',
      },
      500,
    );
  }
};
