import nodemailer from 'npm:nodemailer@6.9.15';

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function firstEnv(...names: string[]) {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value && value.trim()) return value.trim();
  }
  return '';
}

function getRequiredEnv(label: string, ...names: string[]) {
  const value = firstEnv(...names);
  if (!value) throw new Error(`Missing Edge Function secret: ${label} (${names.join(' or ')})`);
  return value;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildFromAddress() {
  const explicitFrom = firstEnv('OPC_SMTP_FROM', 'SMTP_FROM');
  if (explicitFrom) return explicitFrom;

  const fromEmail = firstEnv('OPC_SMTP_FROM_EMAIL', 'SMTP_FROM_EMAIL', 'OPC_SMTP_USER', 'SMTP_USER');
  const fromName = firstEnv('OPC_SMTP_FROM_NAME', 'SMTP_FROM_NAME') || 'Orange Pro Clean GmbH';

  if (!fromEmail) return 'Orange Pro Clean GmbH <info@orangeproclean.ch>';
  return `${fromName} <${fromEmail}>`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  try {
    const body = await request.json() as RequestBody;

    if (!body.to) throw new Error('Recipient email is missing.');
    if (!body.subject) throw new Error('Subject is missing.');
    if (!body.html) throw new Error('HTML body is missing.');

    const host = getRequiredEnv('SMTP host', 'OPC_SMTP_HOST', 'SMTP_HOST');
    const port = Number(firstEnv('OPC_SMTP_PORT', 'SMTP_PORT') || 587);
    const user = getRequiredEnv('SMTP user', 'OPC_SMTP_USER', 'SMTP_USER');
    const pass = getRequiredEnv('SMTP password', 'OPC_SMTP_PASS', 'SMTP_PASS');
    const from = buildFromAddress();
    const replyTo = firstEnv('OPC_SMTP_REPLY_TO', 'SMTP_REPLY_TO', 'SMTP_FROM_EMAIL', 'OPC_SMTP_FROM_EMAIL', 'SMTP_USER', 'OPC_SMTP_USER') || 'info@orangeproclean.ch';

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const attachments = (body.attachments || []).map((attachment) => ({
      filename: attachment.filename,
      content: Uint8Array.from(atob(attachment.contentBase64), (char) => char.charCodeAt(0)),
      contentType: attachment.contentType || 'application/pdf',
    }));

    const result = await transporter.sendMail({
      from,
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      replyTo,
      subject: body.subject,
      html: body.html,
      attachments,
    });

    return jsonResponse({ ok: true, messageId: result.messageId || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown email error';
    console.error('opc-send-document-email failed:', message);
    return jsonResponse({ ok: false, error: message }, 400);
  }
});
