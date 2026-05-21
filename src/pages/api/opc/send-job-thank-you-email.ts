import type { APIContext } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
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

export async function POST({ request }: APIContext) {
  try {
    const supabaseUrl = import.meta.env.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
    const serviceRoleKey =
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY ||
      import.meta.env.SUPABASE_SERVICE_ROLE ||
      import.meta.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        {
          error:
            'Supabase server configuration is missing. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
        },
        500
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const payload = (await request.json()) as any;
    const jobId = clean(payload?.jobId);

    if (!jobId) {
      return jsonResponse({ error: 'Missing jobId.' }, 400);
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from('opc_my_portal_job_feed')
      .select('*')
      .eq('job_id', jobId)
      .maybeSingle();

    if (jobError) {
      throw new Error(`Job lookup failed: ${jobError.message}`);
    }

    if (!job) {
      return jsonResponse({ error: 'Einsatz wurde nicht gefunden.' }, 404);
    }

    if (!isCompletedStatus(job.status)) {
      return jsonResponse(
        {
          error: 'Danke-E-Mail kann nur gesendet werden, wenn der Einsatz abgeschlossen ist.',
        },
        400
      );
    }

    const email = clean(job.email);

    if (!email) {
      return jsonResponse(
        {
          error: 'Für diesen Kunden ist keine E-Mail-Adresse hinterlegt.',
        },
        400
      );
    }

    await supabaseAdmin.from('opc_client_activity').insert({
      client_id: job.client_id,
      contact_id: null,
      activity_type: 'thank_you_email_requested',
      message:
        'Danke-E-Mail wurde für diesen abgeschlossenen Einsatz vorgemerkt. Custom SMTP-Versand muss noch mit einem eigenen Mail-Sender verbunden werden.',
      metadata: {
        source: 'client_detail_job_action',
        job_id: jobId,
        email,
        job_status: job.status,
      },
    });

    return jsonResponse(
      {
        success: false,
        needsCustomMailer: true,
        error:
          'Supabase SMTP sendet Auth-E-Mails. Für freie Danke-E-Mails brauchen wir zusätzlich einen Custom-Mailer oder eine Edge Function.',
      },
      501
    );
  } catch (error: any) {
    console.error('[send-job-thank-you-email] failed:', error);

    return jsonResponse(
      {
        error: error?.message || 'Danke-E-Mail konnte nicht gesendet werden.',
      },
      500
    );
  }
}