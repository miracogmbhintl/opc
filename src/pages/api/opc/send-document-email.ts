import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { getOpcServerEnvValue } from '../../../lib/opc-server-env';

export const prerender = false;

const MAX_REQUEST_BYTES = 20 * 1024 * 1024;
const MAX_HTML_CHARS = 500_000;
const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 12 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set([
  'quote',
  'order_confirmation',
  'invoice',
  'reminder',
  'dunning',
]);

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
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store, max-age=0',
    },
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
    throw new Error('SUPABASE_SERVICE_ROLE_KEY fehlt.');
  }

  if (serviceRoleKey.startsWith('sb_publishable_') || serviceRoleKey.toLowerCase().includes('anon')) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY ist kein Service-Role-Key.');
  }
}

function getSupabaseConfig(locals: any) {
  const supabaseUrl = clean(getEnvValue(locals, 'SUPABASE_URL')) || clean(getEnvValue(locals, 'PUBLIC_SUPABASE_URL'));
  const serviceRoleKey = clean(getEnvValue(locals, 'SUPABASE_SERVICE_ROLE_KEY'));

  if (!supabaseUrl) throw new Error('Supabase URL fehlt.');
  assertServerKeyLooksSafe(serviceRoleKey);

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ''),
    serviceRoleKey,
  };
}

function getSupabaseAdmin(locals: any) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig(locals);

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getAuthenticatedUser(request: Request, cookies: any, supabaseAdmin: any) {
  const cookieToken = cookies.get('sb-access-token')?.value || '';
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const token = bearerToken || cookieToken;

  if (!token) throw new Error('Nicht authentifiziert. Bitte neu anmelden.');

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
    .in('status', ['active', 'aktiv', 'enabled'])
    .eq('can_access_portal', true)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Rollenprüfung fehlgeschlagen: ${error.message}`);

  const role = String(data?.role || '').toLowerCase();
  const allowed = Boolean(
    data && (
      ['owner', 'admin', 'dispatch', 'estimator', 'sales'].includes(role) ||
      data.can_manage_clients === true ||
      data.can_manage_jobs === true
    )
  );

  if (!allowed) throw new Error('Keine Berechtigung für Dokumentenversand.');
}

function approximateDecodedBytes(base64: string) {
  const cleanBase64 = String(base64 || '').replace(/\s/g, '');
  if (!cleanBase64) return 0;
  const padding = cleanBase64.endsWith('==') ? 2 : cleanBase64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor(cleanBase64.length * 3 / 4) - padding);
}

function metadataValue(payload: RequestBody, key: string) {
  const metadata = payload?.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return '';
  return clean((metadata as Record<string, unknown>)[key]);
}

function assertDocumentContext(payload: RequestBody) {
  const documentType = metadataValue(payload, 'document_type').toLowerCase();
  if (!ALLOWED_DOCUMENT_TYPES.has(documentType)) {
    throw new Error('Dokumentenversand erfordert einen gültigen document_type.');
  }

  if (documentType === 'quote' || documentType === 'order_confirmation') {
    if (!metadataValue(payload, 'quote_id')) {
      throw new Error('Dokumentenversand erfordert quote_id.');
    }
    return;
  }

  if (!metadataValue(payload, 'invoice_id')) {
    throw new Error('Dokumentenversand erfordert invoice_id.');
  }
}

function validatePayload(payload: RequestBody) {
  const to = clean(payload?.to);
  const subject = clean(payload?.subject);
  const html = clean(payload?.html);

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error('Gültige Empfänger-E-Mail fehlt.');
  }
  if (!subject) throw new Error('Betreff fehlt.');
  if (subject.length > 300) throw new Error('Betreff ist zu lang.');
  if (!html) throw new Error('HTML-Inhalt fehlt.');
  if (html.length > MAX_HTML_CHARS) throw new Error('E-Mail-Inhalt ist zu groß.');

  if (payload.attachments && !Array.isArray(payload.attachments)) {
    throw new Error('Anhänge haben ein ungültiges Format.');
  }

  const attachments = payload.attachments || [];
  if (attachments.length > MAX_ATTACHMENTS) {
    throw new Error(`Maximal ${MAX_ATTACHMENTS} Anhänge sind erlaubt.`);
  }

  let totalBytes = 0;
  for (const attachment of attachments) {
    if (!clean(attachment?.filename) || !clean(attachment?.contentBase64)) {
      throw new Error('Anhang ist unvollständig.');
    }

    const bytes = approximateDecodedBytes(attachment.contentBase64);
    if (bytes > MAX_ATTACHMENT_BYTES) {
      throw new Error(`Anhang ${attachment.filename} überschreitet die maximale Größe.`);
    }
    totalBytes += bytes;
  }

  if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
    throw new Error('Gesamtgröße der Anhänge ist zu groß.');
  }

  assertDocumentContext(payload);
}

function getPayloadInvoiceId(payload: RequestBody) {
  return metadataValue(payload, 'invoice_id');
}

async function assertInvoiceCanBeEmailed(supabaseAdmin: any, payload: RequestBody) {
  const invoiceId = getPayloadInvoiceId(payload);
  if (!invoiceId) return;

  const { data, error } = await supabaseAdmin
    .from('opc_invoice_send_preflight')
    .select('invoice_id, recipient_email, can_send_email, send_blocker_message')
    .eq('invoice_id', invoiceId)
    .maybeSingle();

  if (error) throw new Error(`E-Mail-Prüfung fehlgeschlagen: ${error.message}`);
  if (!data) throw new Error('Rechnung konnte für die E-Mail-Prüfung nicht gefunden werden.');

  const recipientEmail = clean(data.recipient_email);
  if (data.can_send_email === false || !recipientEmail) {
    throw new Error(
      clean(data.send_blocker_message) ||
      'Für diesen Kunden ist keine E-Mail-Adresse hinterlegt.'
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
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
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
    throw new Error(`${functionName} failed with HTTP ${response.status}: ${data?.error || response.statusText}`);
  }

  return data || { ok: true };
}

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return jsonResponse({ ok: false, error: 'Anfrage ist zu groß.' }, 413);
    }

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
    const status = /authentifiziert|sitzung/i.test(message)
      ? 401
      : /berechtigung/i.test(message)
        ? 403
        : /zu groß|maximal/i.test(message)
          ? 413
          : /erfordert|fehlt|ungültig|gültige/i.test(message)
            ? 400
            : 500;

    return jsonResponse({ ok: false, error: message }, status);
  }
};
