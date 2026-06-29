import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import {
  getOpcSupabaseAnonKey,
  getOpcSupabaseServiceRoleKey,
  getOpcSupabaseUrl,
} from '../../../lib/opc-server-env';

export const prerender = false;

type ActionName = 'cancel' | 'retry' | 'schedule_now' | 'manual_review';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function getToken(request: Request, cookies: any) {
  const authorization = request.headers.get('authorization') || '';
  const bearer = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
  return bearer || cookies.get('sb-access-token')?.value || '';
}

async function assertAdmin(admin: any, userId: string) {
  const response = await admin
    .from('opc_staff_roles')
    .select('id,role,status,can_access_portal,can_manage_jobs,can_manage_clients')
    .eq('user_id', userId)
    .in('status', ['active', 'aktiv', 'enabled'])
    .limit(1)
    .maybeSingle();

  if (response.error) throw response.error;

  const role = clean(response.data?.role).toLowerCase();
  const allowed = Boolean(
    response.data &&
      response.data.can_access_portal !== false &&
      (
        ['owner', 'admin', 'dispatch', 'godmode', 'superadmin', 'super_admin'].includes(role) ||
        response.data.can_manage_jobs === true ||
        response.data.can_manage_clients === true
      ),
  );

  if (!allowed) throw new Error('Keine Berechtigung für Rechnungsautomatisierungen.');
}

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const supabaseUrl = getOpcSupabaseUrl(locals);
    const anonKey = getOpcSupabaseAnonKey(locals);
    const serviceRoleKey = getOpcSupabaseServiceRoleKey(locals);
    const token = getToken(request, cookies);

    if (!token) return jsonResponse({ ok: false, error: 'Nicht angemeldet.' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const userResponse = await userClient.auth.getUser();
    if (userResponse.error || !userResponse.data.user) {
      return jsonResponse({ ok: false, error: 'Sitzung ist ungültig oder abgelaufen.' }, 401);
    }

    await assertAdmin(admin, userResponse.data.user.id);

    const body = await request.json() as {
      automation_id?: string;
      action?: ActionName;
      reason?: string;
    };

    const automationId = clean(body.automation_id);
    const action = clean(body.action) as ActionName;
    const reason = clean(body.reason);

    if (!automationId) {
      return jsonResponse({ ok: false, error: 'Automatisierungs-ID fehlt.' }, 400);
    }

    if (!['cancel', 'retry', 'schedule_now', 'manual_review'].includes(action)) {
      return jsonResponse({ ok: false, error: 'Ungültige Aktion.' }, 400);
    }

    const currentResponse = await admin
      .from('opc_invoice_automation_jobs')
      .select('*')
      .eq('id', automationId)
      .maybeSingle();

    if (currentResponse.error) throw currentResponse.error;
    if (!currentResponse.data) {
      return jsonResponse({ ok: false, error: 'Automatisierung wurde nicht gefunden.' }, 404);
    }

    const current = currentResponse.data;
    if (current.status === 'completed' && action !== 'manual_review') {
      return jsonResponse(
        { ok: false, error: 'Eine bereits abgeschlossene Automatisierung kann nicht erneut geplant oder storniert werden.' },
        409,
      );
    }

    const now = new Date().toISOString();
    let update: Record<string, unknown>;

    if (action === 'cancel') {
      update = {
        status: 'cancelled',
        cancelled_at: now,
        claimed_at: null,
        blocker_code: 'cancelled_by_admin',
        blocker_message: reason || 'Automatisierung wurde manuell gestoppt.',
        error_message: null,
        updated_at: now,
      };
    } else if (action === 'manual_review') {
      update = {
        status: 'manual_review',
        claimed_at: null,
        blocker_code: 'manual_review_requested',
        blocker_message: reason || 'Automatisierung wurde zur manuellen Prüfung markiert.',
        error_message: null,
        updated_at: now,
      };
    } else {
      update = {
        status: 'pending',
        scheduled_for: action === 'schedule_now' ? now : current.scheduled_for,
        next_attempt_at: now,
        claimed_at: null,
        completed_at: null,
        cancelled_at: null,
        worker_id: null,
        blocker_code: null,
        blocker_message: null,
        error_message: null,
        updated_at: now,
      };
    }

    const updateResponse = await admin
      .from('opc_invoice_automation_jobs')
      .update(update)
      .eq('id', automationId)
      .select('*')
      .single();

    if (updateResponse.error) throw updateResponse.error;

    if (action === 'cancel' || action === 'manual_review') {
      await admin
        .from('opc_service_jobs')
        .update({
          billing_status: action === 'cancel' ? 'automation_cancelled' : 'manual_review',
          updated_at: now,
        })
        .eq('id', current.service_job_id);
    } else {
      await admin
        .from('opc_service_jobs')
        .update({
          billing_status: 'invoice_scheduled',
          updated_at: now,
        })
        .eq('id', current.service_job_id);
    }

    return jsonResponse({ ok: true, automation: updateResponse.data });
  } catch (error: any) {
    console.error('[opc/invoice-automation-action] failed:', error);

    const message = error?.message || 'Aktion ist fehlgeschlagen.';
    const status = /angemeldet|sitzung/i.test(message)
      ? 401
      : /berechtigung/i.test(message)
        ? 403
        : 500;

    return jsonResponse({ ok: false, error: message }, status);
  }
};
