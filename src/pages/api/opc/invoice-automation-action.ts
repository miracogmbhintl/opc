import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import {
  getOpcSupabaseAnonKey,
  getOpcSupabaseServiceRoleKey,
  getOpcSupabaseUrl,
} from '../../../lib/opc-server-env';

export const prerender = false;

type ActionName = 'approve_manual' | 'hold' | 'reopen' | 'mark_sent';

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

function normalizeRole(value: unknown) {
  const role = clean(value).toLowerCase();
  if (role === 'inhaber') return 'owner';
  if (role === 'super_admin') return 'superadmin';
  return role;
}

function getToken(request: Request, cookies: any) {
  const authorization = request.headers.get('authorization') || '';
  const bearer = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
  return bearer || cookies.get('sb-access-token')?.value || '';
}

async function assertOwner(admin: any, userId: string) {
  const response = await admin
    .from('opc_staff_roles')
    .select('id,role,status,can_access_portal')
    .eq('user_id', userId)
    .in('status', ['active', 'aktiv', 'enabled'])
    .limit(20);

  if (response.error) throw response.error;

  const allowed = (response.data || []).some((row: Record<string, unknown>) => {
    const role = normalizeRole(row.role);
    return row.can_access_portal !== false && ['owner', 'godmode', 'superadmin'].includes(role);
  });

  if (!allowed) throw new Error('Nur Inhaber dürfen Rechnungsfreigaben bearbeiten.');
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

    await assertOwner(admin, userResponse.data.user.id);

    const body = await request.json() as {
      automation_id?: string;
      action?: ActionName;
      reason?: string;
    };
    const automationId = clean(body.automation_id);
    const action = clean(body.action) as ActionName;
    const reason = clean(body.reason);

    if (!automationId) return jsonResponse({ ok: false, error: 'Automatisierungs-ID fehlt.' }, 400);
    if (!['approve_manual', 'hold', 'reopen', 'mark_sent'].includes(action)) {
      return jsonResponse({ ok: false, error: 'Ungültige Aktion.' }, 400);
    }

    const currentResponse = await admin
      .from('opc_invoice_automation_jobs')
      .select('*')
      .eq('id', automationId)
      .maybeSingle();

    if (currentResponse.error) throw currentResponse.error;
    if (!currentResponse.data) {
      return jsonResponse({ ok: false, error: 'Freigabe wurde nicht gefunden.' }, 404);
    }

    const current = currentResponse.data;
    const now = new Date().toISOString();
    let queueUpdate: Record<string, unknown>;
    let billingStatus: string;

    if (action === 'approve_manual') {
      queueUpdate = {
        status: 'manual_review',
        claimed_at: null,
        blocker_code: 'approved_for_manual_billing',
        blocker_message: reason || 'Vom Inhaber zur manuellen Rechnungsstellung freigegeben.',
        error_message: null,
        updated_at: now,
      };
      billingStatus = 'ready_for_billing';
    } else if (action === 'hold') {
      queueUpdate = {
        status: 'manual_review',
        claimed_at: null,
        blocker_code: 'billing_on_hold',
        blocker_message: reason || 'Rechnungsstellung wurde vom Inhaber zurückgestellt.',
        error_message: null,
        updated_at: now,
      };
      billingStatus = 'billing_blocked';
    } else if (action === 'mark_sent') {
      queueUpdate = {
        status: 'completed',
        completed_at: now,
        claimed_at: null,
        blocker_code: 'manual_invoice_sent',
        blocker_message: reason || 'Rechnung wurde manuell erstellt und versendet.',
        error_message: null,
        updated_at: now,
      };
      billingStatus = 'invoice_sent';
    } else {
      queueUpdate = {
        status: 'pending',
        next_attempt_at: null,
        claimed_at: null,
        completed_at: null,
        cancelled_at: null,
        worker_id: null,
        blocker_code: null,
        blocker_message: null,
        error_message: null,
        updated_at: now,
      };
      billingStatus = 'not_ready';
    }

    const updateResponse = await admin
      .from('opc_invoice_automation_jobs')
      .update(queueUpdate)
      .eq('id', automationId)
      .select('*')
      .single();
    if (updateResponse.error) throw updateResponse.error;

    const jobResponse = await admin
      .from('opc_service_jobs')
      .select('id,invoice_id')
      .eq('id', current.service_job_id)
      .maybeSingle();
    if (jobResponse.error) throw jobResponse.error;

    const jobUpdate = await admin
      .from('opc_service_jobs')
      .update({ billing_status: billingStatus, updated_at: now })
      .eq('id', current.service_job_id);
    if (jobUpdate.error) throw jobUpdate.error;

    if (action === 'mark_sent') {
      const invoiceId = current.invoice_id || jobResponse.data?.invoice_id || null;
      if (invoiceId) {
        const invoiceUpdate = await admin
          .from('opc_invoices')
          .update({ status: 'sent', sent_at: now, updated_at: now })
          .eq('id', invoiceId);
        if (invoiceUpdate.error) throw invoiceUpdate.error;
      }
    }

    return jsonResponse({
      ok: true,
      automation: updateResponse.data,
      billing_status: billingStatus,
      automatic_sending_enabled: false,
    });
  } catch (error: any) {
    console.error('[opc/invoice-automation-action] failed:', error);
    const message = error?.message || 'Aktion ist fehlgeschlagen.';
    const status = /angemeldet|sitzung/i.test(message)
      ? 401
      : /nur inhaber|berechtigung/i.test(message)
        ? 403
        : 500;
    return jsonResponse({ ok: false, error: message }, status);
  }
};
