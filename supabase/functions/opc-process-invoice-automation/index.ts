import { processDueInvoiceAutomations } from '../_shared/opc-invoice-automation.ts';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function constantTimeEqual(left: string, right: string) {
  if (!left || !right || left.length !== right.length) return false;

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
}

Deno.serve(async (request) => {
  if (request.method === 'GET') {
    return json({
      ok: true,
      service: 'opc-process-invoice-automation',
      runtime: 'supabase-edge-function',
    });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed.' }, 405);
  }

  try {
    const expectedSecret = clean(Deno.env.get('OPC_AUTOMATION_SECRET'));
    const suppliedSecret = clean(request.headers.get('x-opc-automation-secret'));

    if (!expectedSecret) {
      return json(
        {
          ok: false,
          error: 'OPC_AUTOMATION_SECRET ist in den Supabase Function Secrets nicht konfiguriert.',
        },
        500,
      );
    }

    if (!constantTimeEqual(suppliedSecret, expectedSecret)) {
      return json({ ok: false, error: 'Nicht autorisiert.' }, 401);
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const requestedLimit = Number(body.limit || 10);
    const limit = Math.max(
      1,
      Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 10, 25),
    );

    const summary = await processDueInvoiceAutomations({
      source: null,
      limit,
      workerId: clean(body.worker_id) || 'supabase-pg-cron',
    });

    console.log('[opc-process-invoice-automation] completed', summary);
    return json({ ok: true, ...summary });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'Rechnungsautomatisierung ist fehlgeschlagen.';

    console.error('[opc-process-invoice-automation] failed', error);
    return json({ ok: false, error: message }, 500);
  }
});
