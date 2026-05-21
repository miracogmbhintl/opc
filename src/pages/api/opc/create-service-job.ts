import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY =
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY ||
  import.meta.env.SUPABASE_SERVICE_KEY ||
  import.meta.env.SERVICE_ROLE_KEY;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function requireString(value: unknown, label: string) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} fehlt.`);
  }

  return value.trim();
}

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse(
        {
          error:
            'Supabase server configuration is missing. Check PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.',
        },
        500
      );
    }

    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return jsonResponse({ error: 'Nicht angemeldet.' }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: 'Session ist ungültig oder abgelaufen.' }, 401);
    }

    const { data: staffRole, error: staffError } = await adminClient
      .from('opc_staff_roles')
      .select(
        `
        id,
        user_id,
        role,
        status,
        can_access_portal,
        can_manage_jobs
      `
      )
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (staffError) {
      return jsonResponse({ error: staffError.message }, 500);
    }

    const allowedRoles = ['owner', 'admin', 'dispatch'];
    const isAllowed =
      staffRole &&
      staffRole.can_access_portal === true &&
      staffRole.can_manage_jobs === true &&
      allowedRoles.includes(staffRole.role);

    if (!isAllowed) {
      return jsonResponse({ error: 'Keine Berechtigung, Einsätze zu erstellen.' }, 403);
    }

    const body = await request.json();

    const clientId = requireString(body.client_id, 'Kunde');
    const clientSiteId = requireString(body.client_site_id, 'Standort');
    const title = requireString(body.title, 'Titel');
    const plannedStart = requireString(body.planned_start, 'Startzeit');
    const plannedEnd = requireString(body.planned_end, 'Endzeit');
    const serviceCategory = requireString(body.service_category, 'Dienstleistung');

    const { data: site, error: siteError } = await adminClient
      .from('opc_client_sites')
      .select('id, client_id, contact_id, site_name, address_text, postal_code, city, country')
      .eq('id', clientSiteId)
      .eq('client_id', clientId)
      .single();

    if (siteError || !site) {
      return jsonResponse(
        {
          error: 'Der ausgewählte Standort gehört nicht zu diesem Kunden oder wurde nicht gefunden.',
        },
        400
      );
    }

    const insertPayload = {
      client_id: clientId,
      client_site_id: clientSiteId,
      contact_id: body.contact_id || site.contact_id || null,
      title,
      job_type: body.job_type || 'cleaning',
      status: body.status || 'scheduled',
      priority: body.priority || 'normal',
      planned_start: plannedStart,
      planned_end: plannedEnd,
      service_category: serviceCategory,
      service_description: body.service_description || null,
      estimated_hours: Number(body.estimated_hours || 0),
      dispatcher_notes: body.dispatcher_notes || null,
      employee_notes: body.employee_notes || null,
      client_notes: body.client_notes || null,
      internal_notes: body.internal_notes || null,
      report_required: body.report_required !== false,
      metadata: {
        ...(body.metadata || {}),
        created_via: 'portal_api',
        created_by_user_id: user.id,
        created_by_staff_role_id: staffRole.id,
        selected_site_id: site.id,
        selected_site_name: site.site_name,
        selected_site_address: site.address_text,
      },
    };

    const { data: createdJob, error: insertError } = await adminClient
      .from('opc_service_jobs')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertError) {
      return jsonResponse({ error: insertError.message }, 500);
    }

    const jobId = createdJob?.id;

    if (!jobId) {
      return jsonResponse({ error: 'Einsatz wurde erstellt, aber keine ID wurde zurückgegeben.' }, 500);
    }

    if (body.report_required !== false) {
      const reportPayload = {
        job_id: jobId,
        client_id: clientId,
        client_site_id: clientSiteId,
        status: 'draft',
        report_title: title,
        report_summary: body.service_description || null,
        total_hours: 0,
        total_minutes: 0,
        before_photos: [],
        after_photos: [],
        time_logs: [],
        damage_reports: [],
        metadata: {
          created_via: 'portal_api',
          created_by_user_id: user.id,
          created_by_staff_role_id: staffRole.id,
          source: 'einsatz_planen',
        },
      };

      await adminClient.from('opc_job_reports').insert(reportPayload);
    }

    return jsonResponse({
      success: true,
      job_id: jobId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Serverfehler.';
    return jsonResponse({ error: message }, 500);
  }
};