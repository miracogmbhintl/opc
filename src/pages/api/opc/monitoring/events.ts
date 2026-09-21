import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import {
  getOpcPublicOrigin,
  getOpcServerEnvValue,
  getOpcSupabaseServiceRoleKey,
  getOpcSupabaseUrl,
} from '../../../../lib/opc-server-env';

export const prerender = false;

type AnyRow = Record<string, any>;
type Severity = 'critical' | 'error' | 'warning' | 'info';

const ACTIVE_STATUSES = ['active', 'aktiv', 'enabled'];
const SEVERITIES = new Set<Severity>(['critical', 'error', 'warning', 'info']);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}

function clean(value: unknown, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function redact(value: unknown, max = 12000) {
  return clean(value, max)
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]')
    .replace(/(SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|apikey)\s*[:=]\s*[^\s<]+/gi, '$1=[REDACTED]');
}

function safeContext(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  try {
    return JSON.parse(
      JSON.stringify(value, (_key, item) => {
        if (typeof item === 'string') return redact(item, 4000);
        return item;
      }),
    );
  } catch {
    return {};
  }
}

function escapeHtml(value: unknown) {
  return clean(value, 12000)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function bearerToken(request: Request, cookies: any) {
  const header = clean(request.headers.get('authorization'), 6000);
  const bearer = header.replace(/^Bearer\s+/i, '').trim();
  return bearer || clean(cookies.get('sb-access-token')?.value, 6000);
}

function normalizeRole(value: unknown) {
  const role = clean(value, 80).toLowerCase();
  if (['owner', 'inhaber', 'godmode'].includes(role)) return 'owner';
  return role;
}

function normalizeSeverity(value: unknown): Severity {
  const severity = clean(value, 40).toLowerCase() as Severity;
  return SEVERITIES.has(severity) ? severity : 'error';
}

async function hashText(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function serviceClient(locals: any) {
  return createClient(
    getOpcSupabaseUrl(locals),
    getOpcSupabaseServiceRoleKey(locals),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

async function authenticatedContext(request: Request, cookies: any, admin: any) {
  const token = bearerToken(request, cookies);
  if (!token) return null;

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: roleRows } = await admin
    .from('opc_staff_roles')
    .select('id,user_id,employee_id,role,status,can_access_portal,display_name,email')
    .eq('user_id', data.user.id)
    .in('status', ACTIVE_STATUSES)
    .limit(20);

  const roles = (roleRows || []) as AnyRow[];
  const role =
    roles
      .filter((row) => row.can_access_portal !== false)
      .sort((left, right) => {
        const score = (row: AnyRow) => {
          const value = normalizeRole(row.role);
          if (value === 'owner') return 500;
          if (value === 'admin') return 400;
          if (value === 'dispatch') return 300;
          if (value === 'employee') return 200;
          return 100;
        };

        return score(right) - score(left);
      })[0] || null;

  return {
    user: data.user,
    role,
    roles,
  };
}

function isOwner(context: Awaited<ReturnType<typeof authenticatedContext>>) {
  if (!context) return false;

  return context.roles.some((row: AnyRow) => {
    const status = clean(row.status, 40).toLowerCase();
    return (
      ACTIVE_STATUSES.includes(status) &&
      row.can_access_portal !== false &&
      normalizeRole(row.role) === 'owner'
    );
  });
}

async function alertRecipients(_admin: any, locals: any) {
  const configured = getOpcServerEnvValue(locals, 'OPC_MONITORING_ALERT_EMAILS');

  if (configured) {
    return Array.from(
      new Set(
        configured
          .split(/[;,]/)
          .map((value) => clean(value, 320).toLowerCase())
          .filter((value) => value.includes('@')),
      ),
    );
  }

  return ['support@miraka.ch'];
}

async function invokeMailer(
  locals: any,
  to: string,
  subject: string,
  html: string,
  eventId: string,
) {
  const supabaseUrl = getOpcSupabaseUrl(locals);
  const serviceRoleKey = getOpcSupabaseServiceRoleKey(locals);
  const functionNames = ['opc-send-document-email', 'opc-send-document-smtp'];
  const failures: string[] = [];

  for (const functionName of functionNames) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
        body: JSON.stringify({
          to,
          subject,
          html,
          metadata: {
            source: 'opc_monitoring',
            monitoring_event_id: eventId,
          },
        }),
      });

      const text = await response.text();

      if (response.ok) {
        return { ok: true, functionName };
      }

      failures.push(`${functionName}: HTTP ${response.status} ${clean(text, 1000)}`);
    } catch (error: any) {
      failures.push(`${functionName}: ${clean(error?.message || error, 1000)}`);
    }
  }

  return {
    ok: false,
    error: failures.join(' | ') || 'No mailer function available.',
  };
}

function buildAlertHtml(event: AnyRow, monitorUrl: string) {
  const context = JSON.stringify(event.context || {}, null, 2);

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f6f6f6;padding:32px;color:#111827">
      <div style="max-width:760px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:28px">
        <div style="font-size:12px;font-weight:700;color:#6b7280;margin-bottom:8px">ORANGE PRO CLEAN · ERROR MONITORING</div>
        <h1 style="font-size:22px;margin:0 0 18px">${escapeHtml(event.message)}</h1>

        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:7px 0;color:#6b7280">Severity</td><td style="padding:7px 0;font-weight:700">${escapeHtml(event.severity)}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280">Source</td><td style="padding:7px 0">${escapeHtml(event.source)} · ${escapeHtml(event.event_type)}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280">Route</td><td style="padding:7px 0">${escapeHtml(event.route)}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280">User</td><td style="padding:7px 0">${escapeHtml(event.user_label || event.user_email || event.user_id || 'Unknown')}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280">Language</td><td style="padding:7px 0">${escapeHtml(event.language || '—')}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280">Browser / Device</td><td style="padding:7px 0">${escapeHtml(event.browser || '—')} · ${escapeHtml(event.device || '—')}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280">Occurrences</td><td style="padding:7px 0">${escapeHtml(event.occurrence_count || 1)}</td></tr>
        </table>

        <div style="margin-top:22px">
          <div style="font-size:12px;font-weight:700;color:#6b7280;margin-bottom:6px">STACKTRACE</div>
          <pre style="white-space:pre-wrap;word-break:break-word;background:#f7f7f7;border-radius:12px;padding:14px;font-size:12px;line-height:1.5">${escapeHtml(event.stack || 'No stacktrace available.')}</pre>
        </div>

        <div style="margin-top:18px">
          <div style="font-size:12px;font-weight:700;color:#6b7280;margin-bottom:6px">CONTEXT</div>
          <pre style="white-space:pre-wrap;word-break:break-word;background:#f7f7f7;border-radius:12px;padding:14px;font-size:12px;line-height:1.5">${escapeHtml(context)}</pre>
        </div>

        <a href="${escapeHtml(monitorUrl)}" style="display:inline-block;margin-top:22px;background:#0f1115;color:#fff;text-decoration:none;border-radius:12px;padding:12px 18px;font-weight:700">
          Fehler im Monitoring öffnen
        </a>
      </div>
    </div>
  `;
}

async function sendImmediateAlert(
  admin: any,
  locals: any,
  request: Request,
  event: AnyRow,
) {
  if (!['critical', 'error'].includes(clean(event.severity, 40).toLowerCase())) {
    return { sent: false, skipped: true };
  }

  const recipients = await alertRecipients(admin, locals);

  if (!recipients.length) {
    return {
      sent: false,
      error: 'No active owner monitoring email recipient found.',
    };
  }

  const origin = getOpcPublicOrigin(locals, request);
  const monitorUrl = `${origin}/monitoring-status?event=${encodeURIComponent(event.id)}`;
  const subject =
    `[OPC ERROR] ${clean(event.severity, 40).toUpperCase()} · ` +
    `${clean(event.source, 80)} · ${clean(event.event_type, 120)}`;

  const html = buildAlertHtml(event, monitorUrl);
  const errors: string[] = [];
  let sent = 0;

  for (const recipient of recipients) {
    const result = await invokeMailer(locals, recipient, subject, html, event.id);

    if (result.ok) sent += 1;
    else errors.push(`${recipient}: ${result.error}`);
  }

  return {
    sent: sent > 0,
    sentCount: sent,
    recipients,
    error: errors.join(' | '),
  };
}

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const admin = serviceClient(locals);

  try {
    const auth = await authenticatedContext(request, cookies, admin);

    if (!auth?.user) {
      return json({ ok: false, error: 'Authentication required.' }, 401);
    }

    const body = (await request.json()) as AnyRow;
    const severity = normalizeSeverity(body.severity);
    const source = clean(body.source || 'Frontend', 120);
    const eventType = clean(body.eventType || 'Runtime Error', 160);
    const message = redact(body.message, 4000);
    const route = clean(body.route || '/', 500);

    if (!message) {
      return json({ ok: false, error: 'Message is required.' }, 400);
    }

    const fingerprint =
      clean(body.fingerprint, 180) ||
      (await hashText(`${source}|${eventType}|${message}|${route}`));

    const now = new Date();
    const nowIso = now.toISOString();
    const dedupeSince = new Date(now.getTime() - 10 * 60_000).toISOString();

    const { data: existing } = await admin
      .from('opc_monitoring_events')
      .select('*')
      .eq('fingerprint', fingerprint)
      .is('resolved_at', null)
      .gte('last_seen_at', dedupeSince)
      .order('last_seen_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const role = auth.role;
    const basePayload = {
      severity,
      source,
      event_type: eventType,
      message,
      route,
      stack: redact(body.stack, 12000),
      context: safeContext(body.context),
      user_id: auth.user.id,
      staff_role_id: role?.id || null,
      employee_id: role?.employee_id || null,
      user_label:
        clean(body.userLabel, 200) ||
        clean(role?.display_name, 200) ||
        clean(auth.user.email, 320),
      user_email: clean(auth.user.email, 320),
      language: clean(body.language, 40),
      browser: clean(body.browser, 80),
      device: clean(body.device, 80),
      user_agent: redact(body.userAgent, 1200),
      session_id: clean(body.sessionId, 180),
      fingerprint,
      last_seen_at: nowIso,
    };

    let event: AnyRow;
    let deduped = false;

    if (existing?.id) {
      deduped = true;

      const { data, error } = await admin
        .from('opc_monitoring_events')
        .update({
          ...basePayload,
          occurrence_count: Number(existing.occurrence_count || 1) + 1,
        })
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) throw error;
      event = data;
    } else {
      const { data, error } = await admin
        .from('opc_monitoring_events')
        .insert({
          ...basePayload,
          first_seen_at: nowIso,
          occurrence_count: 1,
        })
        .select('*')
        .single();

      if (error) throw error;
      event = data;
    }

    let emailResult: AnyRow = { sent: false, skipped: deduped };

    if (!deduped && !event.email_sent_at) {
      emailResult = await sendImmediateAlert(admin, locals, request, event);

      await admin
        .from('opc_monitoring_events')
        .update({
          email_sent_at: emailResult.sent ? new Date().toISOString() : null,
          email_error: clean(emailResult.error, 4000) || null,
        })
        .eq('id', event.id);
    }

    return json({
      ok: true,
      id: event.id,
      deduped,
      emailSent: Boolean(emailResult.sent),
    });
  } catch (error: any) {
    console.error('[opc/monitoring/events] POST failed', error);

    return json(
      {
        ok: false,
        error: clean(error?.message || 'Monitoring event could not be stored.', 1200),
      },
      500,
    );
  }
};

export const GET: APIRoute = async ({ request, locals, cookies }) => {
  const admin = serviceClient(locals);

  try {
    const auth = await authenticatedContext(request, cookies, admin);

    if (!auth?.user) {
      return json({ ok: false, error: 'Authentication required.' }, 401);
    }

    if (!isOwner(auth)) {
      return json({ ok: false, error: 'Owner access required.' }, 403);
    }

    const url = new URL(request.url);
    const range = clean(url.searchParams.get('range') || '24h', 20);
    const hours = range === '30d' ? 24 * 30 : range === '7d' ? 24 * 7 : 24;
    const since = new Date(Date.now() - hours * 60 * 60_000).toISOString();

    const { data, error } = await admin
      .from('opc_monitoring_events')
      .select('*')
      .gte('last_seen_at', since)
      .order('last_seen_at', { ascending: false })
      .limit(1000);

    if (error) throw error;

    return json({
      ok: true,
      range,
      events: data || [],
      health: {
        portal: 'operational',
        authentication: 'operational',
        database: 'operational',
        api: 'operational',
      },
    });
  } catch (error: any) {
    console.error('[opc/monitoring/events] GET failed', error);

    return json(
      {
        ok: false,
        error: clean(error?.message || 'Monitoring events could not be loaded.', 1200),
      },
      500,
    );
  }
};

export const PATCH: APIRoute = async ({ request, locals, cookies }) => {
  const admin = serviceClient(locals);

  try {
    const auth = await authenticatedContext(request, cookies, admin);

    if (!auth?.user) {
      return json({ ok: false, error: 'Authentication required.' }, 401);
    }

    if (!isOwner(auth)) {
      return json({ ok: false, error: 'Owner access required.' }, 403);
    }

    const body = (await request.json()) as AnyRow;
    const id = clean(body.id, 100);
    const resolved = body.resolved !== false;

    if (!id) {
      return json({ ok: false, error: 'Event id is required.' }, 400);
    }

    const { data, error } = await admin
      .from('opc_monitoring_events')
      .update({
        resolved_at: resolved ? new Date().toISOString() : null,
        resolved_by: resolved ? auth.user.id : null,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    return json({ ok: true, event: data });
  } catch (error: any) {
    console.error('[opc/monitoring/events] PATCH failed', error);

    return json(
      {
        ok: false,
        error: clean(error?.message || 'Monitoring event could not be updated.', 1200),
      },
      500,
    );
  }
};
