import type { APIRoute } from 'astro';
import { createOpcSupabaseUserClient } from '../../../../lib/opc-server-env';
import { json, requireTimeImportManager } from '../../../../lib/opc-time-import-server';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const actor = await requireTimeImportManager(request, locals);
    if (actor instanceof Response) return actor;

    const body = await request.json().catch(() => null);
    const batchId = String(body?.batchId || '').trim();
    const resolutions = Array.isArray(body?.resolutions) ? body.resolutions : [];

    if (!batchId) {
      return json({ error: 'Import-Batch fehlt.' }, 400);
    }

    if (!resolutions.length) {
      return json({ error: 'Keine Importentscheidungen übermittelt.' }, 400);
    }

    const userClient = createOpcSupabaseUserClient(locals, actor.token);
    const { data, error } = await userClient.rpc('opc_commit_time_import_batch', {
      p_batch_id: batchId,
      p_resolutions: resolutions,
    });

    if (error) {
      const message = error.message || error.details || error.hint || 'Zeitimport fehlgeschlagen.';
      const status = /PAYROLL|GENEHMIGT|AKTIV|KONFLIKT|CONFLICT|unveränderbar/i.test(message)
        ? 409
        : /Berechtigung|eingeloggt/i.test(message)
          ? 403
          : 422;
      return json({ error: message, code: error.code || null }, status);
    }

    return json({ ok: true, result: data });
  } catch (error: any) {
    console.error('[opc/time-import/commit] failed', error);
    return json({ error: error?.message || 'Zeitimport konnte nicht gespeichert werden.' }, 500);
  }
};
