import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { getOpcServerEnvValue } from '../../../lib/opc-server-env';

export const prerender = false;

type AttachmentInput = {
  filename: string;
  contentBase64: string;
  contentType?: string;
};

type RequestBody = {
  to: string;
  subject: string;
  html: string;
  cc?: string;
  bcc?: string;
  attachments?: AttachmentInput[];
  metadata?: Record<string, unknown>;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function clean(value: unknown) {
  const text = String(value || '').trim();
  return text || '';
}

function getEnvValue(locals: any, key: string) {
  return getOpcServerEnvValue(locals, key);
}

function assertServerKeyLooksSafe(serviceRoleKey: string) {
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY fehlt. Die interne Versand-API braucht den Service-Role-Key, um die Edge Function serverseitig aufzurufen.');
  }

  if (serviceRoleKey.startsWith('sb_publishable_') || serviceRoleKey.includes('anon')) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY sieht wie ein anon/publishable key aus. Erwartet wird der Service-Role-Key.');
  }
}

function getSupabaseConfig(locals: any) {
  const supabaseUrl = clean(getEnvValue(locals, 'SUPABASE_URL')) || clean(getEnvValue(locals, 'PUBLIC_SUPABASE_URL'));
  const serviceRoleKey = clean(getEnvValue(locals, 'SUPABASE_SERVICE_ROLE_KEY'));

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL oder PUBLIC_SUPABASE_URL fehlt.');
  }

  assertServerKeyLooksSafe(serviceRoleKey);

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ''),
    serviceRoleKey,
  };
}

function getSupabaseAdmin(locals: any) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig(locals);

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getAuthenticatedUser(request: Request, cookies: any, supabaseAdmin: any) {
  const cookieToken = cookies.get('sb-access-token')?.value || '';
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : '';
  const token = bearerToken || cookieToken;

  if (!token) {
    throw new Error('Nicht authentifiziert. Bitte neu anmelden.');
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data?.user) {
    throw new Error(error?.message || 'Ungültige Sitzung. Bitte neu anmelden.');
  }

  return data.user;
}

async function assertCanSendDocuments(supabaseAdmin: any, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('opc_staff_roles')
    .select('id, role, status, can_access_portal, can_manage_clients, can_manage_jobs')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('can_access_portal', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Rollenprüfung fehlgeschlagen: ${error.message}`);
  }

  const role = String(data?.role || '').toLowerCase();
  const allowed = Boolean(
    data &&
      (
        ['owner', 'admin', 'dispatch', 'estimator', 'sales'].includes(role) ||
        data.can_manage_clients === true ||
        data.can_manage_jobs === true
      )
  );

  if (!allowed) {
    throw new Error('Keine Berechtigung für Dokumentenversand.');
  }
}

function validatePayload(payload: RequestBody) {
  if (!clean(payload?.to)) throw new Error('Empfänger-E-Mail fehlt.');
  if (!clean(payload?.subject)) throw new Error('Betreff fehlt.');
  if (!clean(payload?.html)) throw new Error('HTML-Inhalt fehlt.');

  if (payload.attachments && !Array.isArray(payload.attachments)) {
    throw new Error('Anhänge haben ein ungültiges Format.');
  }
}

function getPayloadInvoiceId(payload: RequestBody) {
  const metadata = payload?.metadata;

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return '';
  }

  return clean((metadata as Record<string, unknown>).invoice_id);
}

async function assertInvoiceCanBeEmailed(supabaseAdmin: any, payload: RequestBody) {
  const invoiceId = getPayloadInvoiceId(payload);

  if (!invoiceId) {
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('opc_invoice_send_preflight')
    .select('invoice_id, recipient_email, can_send_email, send_blocker_message')
    .eq('invoice_id', invoiceId)
    .maybeSingle();

  if (error) {
    throw new Error(`E-Mail-Prüfung fehlgeschlagen: ${error.message}`);
  }

  if (!data) {
    throw new Error('Rechnung konnte für die E-Mail-Prüfung nicht gefunden werden.');
  }

  const recipientEmail = clean(data.recipient_email);

  if (data.can_send_email === false || !recipientEmail) {
    throw new Error(
      clean(data.send_blocker_message) ||
        'Für diesen Kunden ist keine E-Mail-Adresse hinterlegt. Bitte ergänzen Sie eine E-Mail-Adresse im Kundenkontakt oder tragen Sie eine Empfängeradresse für diese Rechnung ein.'
    );
  }
}

async function invokeMailerFunction({
  functionName,
  payload,
  supabaseUrl,
  serviceRoleKey,
}: {
  functionName: string;
  payload: RequestBody;
  supabaseUrl: string;
  serviceRoleKey: string;
}) {
  const url = `${supabaseUrl}/functions/v1/${functionName}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok || data?.ok === false) {
    throw new Error(
      `${functionName} failed with HTTP ${response.status}: ${data?.error || data?.raw || text || response.statusText}`
    );
  }

  return data || { ok: true };
}

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const payload = (await request.json()) as RequestBody;
    validatePayload(payload);

    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig(locals);
    const supabaseAdmin = getSupabaseAdmin(locals);
    const user = await getAuthenticatedUser(request, cookies, supabaseAdmin);
    await assertCanSendDocuments(supabaseAdmin, user.id);
    await assertInvoiceCanBeEmailed(supabaseAdmin, payload);

    const functionNames = ['opc-send-document-email', 'opc-send-document-smtp'];
    const failures: string[] = [];

    for (const functionName of functionNames) {
      try {
        const result = await invokeMailerFunction({
          functionName,
          payload,
          supabaseUrl,
          serviceRoleKey,
        });

        return jsonResponse({
          ok: true,
          functionName,
          messageId: result?.messageId || null,
        });
      } catch (error: any) {
        failures.push(error?.message || String(error));
      }
    }

    return jsonResponse(
      {
        ok: false,
        error: 'Keine Mail-Edge-Function konnte erfolgreich senden.',
        details: failures.join(' | '),
      },
      502
    );
  } catch (error: any) {
    console.error('[opc/send-document-email] failed:', error);

    const message = error?.message || 'Dokumenten-E-Mail konnte nicht gesendet werden.';
    const status = /authentifiziert|sitzung/i.test(message) ? 401 : /berechtigung/i.test(message) ? 403 : 500;

    return jsonResponse(
      {
        ok: false,
        error: message,
      },
      status
    );
  }
};
