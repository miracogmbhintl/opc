import type { APIContext } from 'astro';
import { createOpcSupabaseAdmin, getOpcServerEnvValue } from '../../../lib/opc-server-env';
import { getRuntimeEnv } from '../../../lib/google-oauth';
import { getAuthenticatedContext } from '../../../lib/google-calendar';
import { resolveOpcServerAccess } from '../../../lib/opc-server-access';

export const prerender = false;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}

function clean(value?: string | null) {
  const text = String(value || '').trim();
  return text || null;
}

function isCompletedStatus(status?: string | null) {
  return ['completed', 'report_approved', 'approved', 'sent_to_client'].includes(
    String(status || '').trim().toLowerCase()
  );
}

function escapeHtml(value: unknown) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function sendViaExistingTransport(locals: any, payload: Record<string, unknown>) {
  const supabaseUrl = clean(
    getOpcServerEnvValue(locals, 'SUPABASE_URL') ||
    getOpcServerEnvValue(locals, 'PUBLIC_SUPABASE_URL')
  );
  const serviceRoleKey = clean(getOpcServerEnvValue(locals, 'SUPABASE_SERVICE_ROLE_KEY'));

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Mail-Transport ist serverseitig nicht konfiguriert.');
  }

  const failures: string[] = [];
  for (const functionName of ['opc-send-document-email', 'opc-send-document-smtp']) {
    try {
      const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      const result = text ? JSON.parse(text) : {};
      if (!response.ok || result?.ok === false) {
        throw new Error(result?.error || `HTTP ${response.status}`);
      }

      return { functionName, messageId: result?.messageId || null };
    } catch (error: any) {
      failures.push(`${functionName}: ${error?.message || String(error)}`);
    }
  }

  throw new Error(`Danke-E-Mail konnte nicht gesendet werden. ${failures.join(' | ')}`);
}

export async function POST(context: APIContext) {
  const env = getRuntimeEnv(context);

  try {
    const { supabase: serviceSupabase, user } = await getAuthenticatedContext(context.request, env);
    const access = await resolveOpcServerAccess(serviceSupabase, user);

    if (!access.canManageJobs) {
      return jsonResponse({ error: 'Nur Einsatzverantwortliche dürfen Danke-E-Mails senden.' }, 403);
    }

    const supabaseAdmin = createOpcSupabaseAdmin(context.locals);
    const payload = (await context.request.json().catch(() => ({}))) as any;
    const jobId = clean(payload?.jobId);

    if (!jobId) return jsonResponse({ error: 'Missing jobId.' }, 400);

    const { data: job, error: jobError } = await supabaseAdmin
      .from('opc_my_portal_job_feed')
      .select('job_id, client_id, client_name, email, status, job_number, title')
      .eq('job_id', jobId)
      .maybeSingle();

    if (jobError) throw new Error(`Job lookup failed: ${jobError.message}`);
    if (!job) return jsonResponse({ error: 'Einsatz wurde nicht gefunden.' }, 404);

    if (!isCompletedStatus(job.status)) {
      return jsonResponse(
        { error: 'Danke-E-Mail kann nur gesendet werden, wenn der Einsatz abgeschlossen ist.' },
        400
      );
    }

    const email = clean(job.email);
    if (!email) {
      return jsonResponse({ error: 'Für diesen Kunden ist keine E-Mail-Adresse hinterlegt.' }, 400);
    }

    const clientName = clean(job.client_name) || 'Guten Tag';
    const jobLabel = clean(job.job_number) || clean(job.title) || 'Ihren Auftrag';
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111827">
        <p>${escapeHtml(clientName)}</p>
        <p>Vielen Dank für Ihr Vertrauen in Orange Pro Clean GmbH.</p>
        <p>Ihr Auftrag <strong>${escapeHtml(jobLabel)}</strong> wurde abgeschlossen. Wir hoffen, dass Sie mit unserer Arbeit zufrieden sind.</p>
        <p>Falls Sie noch Fragen oder Rückmeldungen haben, können Sie jederzeit auf diese E-Mail antworten.</p>
        <p>Freundliche Grüsse<br>Orange Pro Clean GmbH</p>
      </div>
    `;

    const transport = await sendViaExistingTransport(context.locals, {
      to: email,
      subject: 'Vielen Dank für Ihren Auftrag – Orange Pro Clean GmbH',
      html,
      metadata: {
        document_type: 'job_thank_you',
        job_id: jobId,
        client_id: job.client_id || null,
      },
    });

    const { error: activityError } = await supabaseAdmin.from('opc_client_activity').insert({
      client_id: job.client_id,
      contact_id: null,
      activity_type: 'thank_you_email_sent',
      message: 'Danke-E-Mail für abgeschlossenen Einsatz wurde erfolgreich versendet.',
      created_by: user.id,
      metadata: {
        source: 'client_detail_job_action',
        job_id: jobId,
        email,
        job_status: job.status,
        mail_function: transport.functionName,
        message_id: transport.messageId,
      },
    });

    if (activityError) {
      console.warn('[send-job-thank-you-email] mail sent but activity logging failed:', activityError.message);
    }

    return jsonResponse({
      success: true,
      messageId: transport.messageId,
      functionName: transport.functionName,
    });
  } catch (error: any) {
    console.error('[send-job-thank-you-email] failed:', error);
    return jsonResponse({ error: error?.message || 'Danke-E-Mail konnte nicht gesendet werden.' }, 500);
  }
}
