import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createOpcSupabaseAdmin,
  getOpcSupabaseServiceRoleKey,
  getOpcSupabaseUrl,
} from './opc-server-env';

export const OPC_EXPORT_SCOPES = [
  'all',
  'clients',
  'quotes',
  'invoices',
  'finance',
  'employees',
  'time',
  'payroll',
  'jobs',
  'inspections',
  'inquiries',
  'tickets',
] as const;

export type OpcExportScope = (typeof OPC_EXPORT_SCOPES)[number];

type OwnerActor = {
  userId: string;
  email: string;
  supabase: SupabaseClient;
};

type ChallengeRow = {
  id: string;
  actor_user_id: string;
  actor_email: string;
  scope: string;
  email_code_hash: string;
  email_code_nonce: string;
  email_code_sent_at: string;
  email_code_expires_at: string;
  email_code_attempts: number;
  postal_code_attempts: number;
  email_verified_at: string | null;
  postal_verified_at: string | null;
  verified_at: string | null;
  consumed_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

const FRIENDLY_OWNER_ONLY =
  'Diese Datenexporte werden aus Sicherheitsgründen ausschließlich an verifizierte Eigentümer der Gesellschaft per E-Mail übermittelt. Wenn Ihr Benutzerkonto als Owner hinterlegt ist, erhalten Sie die angeforderten Daten automatisch an Ihre hinterlegte E-Mail-Adresse.';

const OTP_TTL_SECONDS = 10 * 60;
const RESEND_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const MAX_CHALLENGES_15_MIN = 5;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

export function normalizeExportScope(value: unknown): OpcExportScope | null {
  const scope = clean(value).toLowerCase();
  return (OPC_EXPORT_SCOPES as readonly string[]).includes(scope)
    ? (scope as OpcExportScope)
    : null;
}

function bearerToken(request: Request) {
  const header = clean(request.headers.get('authorization'));
  if (!header.toLowerCase().startsWith('bearer ')) return '';
  return header.slice(7).trim();
}

async function requireOwnerActor(request: Request, locals: any): Promise<OwnerActor> {
  const token = bearerToken(request);
  if (!token) {
    throw Object.assign(new Error('Nicht angemeldet.'), { status: 401 });
  }

  const supabase = createOpcSupabaseAdmin(locals);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const user = authData?.user;

  if (authError || !user) {
    throw Object.assign(new Error('Sitzung ist nicht mehr gültig.'), { status: 401 });
  }

  const email = clean(user.email).toLowerCase();
  if (!email) {
    throw Object.assign(new Error('Für dieses Benutzerkonto ist keine E-Mail-Adresse hinterlegt.'), {
      status: 400,
    });
  }

  const { data: staffRows, error: roleError } = await supabase
    .from('opc_staff_roles')
    .select('id,user_id,role,status,can_access_portal')
    .eq('user_id', user.id)
    .in('status', ['active', 'aktiv', 'enabled'])
    .eq('can_access_portal', true)
    .limit(20);

  if (roleError) {
    throw Object.assign(new Error('Eigentümerstatus konnte nicht geprüft werden.'), {
      status: 500,
    });
  }

  const isOwner = (staffRows || []).some(
    (row: any) => clean(row?.role).toLowerCase() === 'owner',
  );

  if (!isOwner) {
    throw Object.assign(new Error(FRIENDLY_OWNER_ONLY), { status: 403 });
  }

  return {
    userId: user.id,
    email,
    supabase,
  };
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error('Ungültiger Sicherheits-Hash.');
  }

  const out = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < out.length; index += 1) {
    out[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }
  return out;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return bytesToHex(new Uint8Array(digest));
}

function constantTimeStringEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;

  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index] ^ b[index];
  }
  return difference === 0;
}

function randomHex(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return bytesToHex(value);
}

function randomOtp() {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return String(random[0] % 1_000_000).padStart(6, '0');
}

async function emailCodeHash(args: {
  userId: string;
  scope: OpcExportScope;
  nonce: string;
  code: string;
  locals: any;
}) {
  const pepper = getOpcSupabaseServiceRoleKey(args.locals);
  return sha256Hex(
    ['opc-export-email-v1', args.userId, args.scope, args.nonce, args.code, pepper].join('|'),
  );
}

export function normalizePostalExportCode(value: unknown) {
  return clean(value).toUpperCase();
}

async function verifyPostalCode(args: {
  supabase: SupabaseClient;
  postalCode: string;
}) {
  const normalized = normalizePostalExportCode(args.postalCode);
  if (
    normalized.length !== 23 ||
    !/^[A-Z0-9-]{23}$/.test(normalized) ||
    !/[A-Z]/.test(normalized) ||
    !/[0-9]/.test(normalized) ||
    !normalized.includes('-')
  ) {
    return false;
  }

  const { data: config, error } = await args.supabase
    .from('opc_data_export_security_config')
    .select(
      'postal_code_salt,postal_code_hash,postal_code_iterations,postal_code_enabled,postal_code_version',
    )
    .eq('id', 1)
    .maybeSingle();

  if (error) throw new Error(`Unternehmenscode konnte nicht geprüft werden: ${error.message}`);
  if (!config?.postal_code_enabled) return false;

  const saltHex = clean(config.postal_code_salt);
  const expectedHash = clean(config.postal_code_hash).toLowerCase();
  const iterations = Number(config.postal_code_iterations || 0);

  if (!saltHex || !expectedHash || !Number.isFinite(iterations) || iterations < 100_000) {
    throw new Error('Der Unternehmens-Sicherheitscode ist noch nicht vollständig konfiguriert.');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(normalized),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: hexToBytes(saltHex),
      iterations,
    },
    key,
    256,
  );

  return constantTimeStringEqual(
    bytesToHex(new Uint8Array(derived)),
    expectedHash,
  );
}

function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!local || !domain) return 'hinterlegte E-Mail-Adresse';
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(3, Math.min(8, local.length - visible.length)))}@${domain}`;
}

function scopeLabel(scope: OpcExportScope) {
  const labels: Record<OpcExportScope, string> = {
    all: 'Gesamter Unternehmensdatenbestand',
    clients: 'Kundendaten',
    quotes: 'Offerten',
    invoices: 'Rechnungen',
    finance: 'Finanzdaten',
    employees: 'Mitarbeiterdaten',
    time: 'Zeiterfassung',
    payroll: 'Lohndaten',
    jobs: 'Einsätze',
    inspections: 'Besichtigungen',
    inquiries: 'Anfragen',
    tickets: 'Tickets',
  };
  return labels[scope];
}

async function estimateSeconds(supabase: SupabaseClient, scope: OpcExportScope) {
  const fallback: Record<OpcExportScope, number> = {
    all: 45,
    clients: 25,
    quotes: 25,
    invoices: 25,
    finance: 35,
    employees: 30,
    time: 30,
    payroll: 35,
    jobs: 25,
    inspections: 25,
    inquiries: 20,
    tickets: 20,
  };

  try {
    const { data } = await supabase
      .from('opc_data_export_audit')
      .select('requested_at,completed_at')
      .eq('scope', scope)
      .eq('status', 'sent')
      .not('completed_at', 'is', null)
      .order('requested_at', { ascending: false })
      .limit(12);

    const values = (data || [])
      .map((row: any) => {
        const start = Date.parse(clean(row.requested_at));
        const end = Date.parse(clean(row.completed_at));
        return Number.isFinite(start) && Number.isFinite(end) && end > start
          ? Math.round((end - start) / 1000)
          : 0;
      })
      .filter((value: number) => value >= 3 && value <= 600)
      .sort((a: number, b: number) => a - b);

    if (values.length === 0) return fallback[scope];
    const middle = Math.floor(values.length / 2);
    const median = values.length % 2 === 0
      ? Math.round((values[middle - 1] + values[middle]) / 2)
      : values[middle];
    return Math.max(10, Math.min(180, median));
  } catch {
    return fallback[scope];
  }
}

function otpEmailHtml(args: { code: string; scope: OpcExportScope; expiresMinutes: number }) {
  const codeCells = args.code
    .split('')
    .map(
      (digit) => `<td align="center" style="width:42px;height:48px;border:1px solid #dedede;border-radius:10px;background:#f7f7f7;font-family:Helvetica,Arial,sans-serif;font-size:24px;line-height:48px;font-weight:800;color:#1a1a1a;">${digit}</td>`,
    )
    .join('<td width="7" style="font-size:0;line-height:0;">&nbsp;</td>');

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@800;900&display=swap');
:root { color-scheme: light only; supported-color-schemes: light only; }
@media only screen and (max-width:600px){
  .container{width:90%!important;max-width:90%!important;margin:0 auto!important;border-radius:20px!important;box-sizing:border-box!important;}
  .fullwidth{width:100%!important;display:block!important;box-sizing:border-box!important;}
  .title{font-size:34px!important;line-height:35px!important;}
  .bodypad{padding-left:24px!important;padding-right:24px!important;}
  .codecell{width:38px!important;height:46px!important;font-size:22px!important;}
}
</style>
</head>
<body bgcolor="#f2f2f2" style="margin:0;padding:0;background:#f2f2f2!important;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#f2f2f2" style="width:100%;background:#f2f2f2!important;padding:40px 0;">
<tr>
<td align="center">
<table class="container" width="540" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#ffffff" style="max-width:540px;width:100%;background:#ffffff!important;border-radius:20px;margin:0 auto;overflow:hidden;">
<tr>
<td bgcolor="#f7931e" style="background:#f7931e!important;padding:28px 32px;text-align:left;">
<img src="https://cdn.prod.website-files.com/6944470386300e196e5fc347/69495340f6a0fe99fed87217_WHITE%20ORANGE%20PRO%20CLEAN%20LOGO%20ORIGINAL.png" width="65" alt="Orange Pro Clean GmbH" style="display:block;width:65px;height:auto;border:0;">
</td>
</tr>
<tr>
<td class="bodypad" align="left" bgcolor="#ffffff" style="background:#ffffff!important;padding:32px 32px 20px 32px;">
<h1 class="title" style="font-family:'Poppins',Helvetica,Arial,sans-serif;font-size:40px;line-height:40px;font-weight:900;text-transform:uppercase;color:#1a1a1a!important;margin:0;">
DATENEXPORT<br>VERIFIZIEREN
</h1>
</td>
</tr>
<tr>
<td class="bodypad" bgcolor="#ffffff" style="background:#ffffff!important;padding:0 32px 0 32px;color:#1a1a1a!important;">
<p style="margin:0 0 20px 0;font-size:15px;line-height:20px;color:#1a1a1a!important;">
Für den angeforderten Export <strong>${scopeLabel(args.scope)}</strong> wurde eine Sicherheitsprüfung gestartet.
</p>
<p style="margin:0 0 24px 0;font-size:15px;line-height:20px;font-weight:600;color:#222222!important;">
Geben Sie diesen Einmalcode zusammen mit dem per A-Post zugestellten Unternehmens-Sicherheitscode im Portal ein.
</p>
<table cellpadding="0" cellspacing="0" role="presentation" align="center" style="margin:4px auto 26px auto;">
<tr>${codeCells}</tr>
</table>
<p style="margin:0 0 24px 0;font-size:13px;line-height:18px;color:#555555!important;">
Der Einmalcode ist ${args.expiresMinutes} Minuten gültig. Der Unternehmens-Sicherheitscode bleibt dauerhaft gültig, bis die Gesellschaft ihn bewusst rotiert.
</p>
<p style="margin:0 0 24px 0;font-size:13px;line-height:18px;color:#555555!important;">
Wenn Sie keinen Datenexport angefordert haben, ignorieren Sie diese Nachricht bitte. Es werden ohne erfolgreiche doppelte Verifizierung keine Unternehmensdaten exportiert.
</p>
<p style="margin:0 0 4px 0;font-size:15px;line-height:18px;color:#1a1a1a!important;">
Freundliche Grüsse<br>
Ihr Orange Pro Clean Team
</p>
<p style="margin:10px 0 0 0;font-size:10px;line-height:12px;color:#1a1a1a!important;">
Orange Pro Clean GmbH<br>
<a href="mailto:info@orangeproclean.ch" style="color:#1a1a1a!important;text-decoration:none;">info@orangeproclean.ch</a><br>
<a href="https://www.orangeproclean.ch" style="color:#1a1a1a!important;text-decoration:none;">www.orangeproclean.ch</a><br>
<a href="https://maps.app.goo.gl/CZRD3axnahsaVYME8" style="color:#f7931e!important;text-decoration:none;">Hagmattstrasse 7a, 4123 Allschwil, Schweiz</a>
</p>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:16px;">
<tr>
<td align="center">
<a href="https://www.instagram.com/orangeproclean/" style="margin-right:10px;"><img src="https://cdn.prod.website-files.com/68dc2b9c31cb83ac9f84a1af/691b468bb73002ca145fa455_INSTA%20ICON.png" width="20" alt="Instagram" style="border:0;"></a>
<a href="https://www.linkedin.com/company/orangeproclean/" style="margin-right:10px;"><img src="https://cdn.prod.website-files.com/68dc2b9c31cb83ac9f84a1af/691b465a11cb9157b5810634_LINKEDIN%20ICON.png" width="20" alt="LinkedIn" style="border:0;"></a>
<a href="https://x.com/orangeproclean" style="margin-right:10px;"><img src="https://cdn.prod.website-files.com/68dc2b9c31cb83ac9f84a1af/691b468bff22ebb06772beb0_X%20ICON.png" width="20" alt="X" style="border:0;"></a>
<a href="https://www.youtube.com/@orangeproclean" style="margin-right:10px;"><img src="https://cdn.prod.website-files.com/68dc2b9c31cb83ac9f84a1af/691b468b02de50a7f0b710d8_YOUTUBE%20ICON.png" width="20" alt="YouTube" style="border:0;"></a>
<a href="https://www.facebook.com/share/1D2UsgTj8y/?mibextid=wwXIfr"><img src="https://cdn.prod.website-files.com/68dc2b9c31cb83ac9f84a1af/691b468b09b6f9730cd58f15_FACEBOOK%20ICON.png" width="20" alt="Facebook" style="border:0;"></a>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td bgcolor="#ffffff" style="background:#ffffff!important;padding:20px;text-align:center;">
<p style="font-size:8px;line-height:10px;color:#777777!important;margin:0;">
Sie erhalten diese sicherheitsrelevante E-Mail, weil über Ihr authentifiziertes Owner-Konto ein Unternehmensdatenexport angefordert wurde.
Datenschutz:
<a href="https://www.orangeproclean.ch/datenschutz" style="color:#777777!important;text-decoration:underline;">orangeproclean.ch/datenschutz</a>
</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

async function invokeMailFunction(args: {
  locals: any;
  to: string;
  subject: string;
  html: string;
}) {
  const supabaseUrl = getOpcSupabaseUrl(args.locals);
  const serviceRoleKey = getOpcSupabaseServiceRoleKey(args.locals);
  const functionNames = ['opc-send-document-email', 'opc-send-document-smtp'];
  const errors: string[] = [];

  for (const functionName of functionNames) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: args.to,
          subject: args.subject,
          html: args.html,
          metadata: {
            type: 'opc_data_export_verification',
          },
        }),
      });

      const responseText = await response.text();
      let payload: any = null;
      try {
        payload = responseText ? JSON.parse(responseText) : null;
      } catch {
        payload = null;
      }

      if (response.ok && payload?.ok !== false) return;

      const detail = clean(payload?.error) || `HTTP ${response.status}`;
      errors.push(`${functionName}: ${detail}`);
    } catch (error) {
      errors.push(
        `${functionName}: ${error instanceof Error ? error.message : 'Unbekannter Mailfehler'}`,
      );
    }
  }

  throw new Error(errors.join(' | ') || 'Verifizierungscode konnte nicht versendet werden.');
}

export async function startExportVerification(request: Request, locals: any) {
  try {
    const body = await request.json().catch(() => ({}));
    const scope = normalizeExportScope((body as any)?.scope);
    if (!scope) return json({ success: false, error: 'Ungültiger Exportbereich.' }, 400);

    const actor = await requireOwnerActor(request, locals);
    const now = Date.now();
    const fifteenMinutesAgo = new Date(now - 15 * 60_000).toISOString();

    const { data: recentRows, error: recentError } = await actor.supabase
      .from('opc_data_export_verifications')
      .select('id,created_at,email_code_sent_at,consumed_at,revoked_at')
      .eq('actor_user_id', actor.userId)
      .eq('scope', scope)
      .gte('created_at', fifteenMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) throw recentError;

    const recent = recentRows || [];
    if (recent.length >= MAX_CHALLENGES_15_MIN) {
      return json(
        {
          success: false,
          error: 'Zu viele Sicherheitscodes wurden angefordert. Bitte warten Sie einige Minuten und versuchen Sie es erneut.',
          retryAfterSeconds: 300,
        },
        429,
      );
    }

    const latest = recent[0] as any;
    const latestSentAt = latest?.email_code_sent_at ? Date.parse(latest.email_code_sent_at) : 0;
    if (latestSentAt && now - latestSentAt < RESEND_SECONDS * 1000) {
      const retryAfterSeconds = Math.max(
        1,
        RESEND_SECONDS - Math.floor((now - latestSentAt) / 1000),
      );
      return json(
        {
          success: false,
          error: `Ein Sicherheitscode wurde bereits versendet. Bitte warten Sie noch ${retryAfterSeconds} Sekunden.`,
          retryAfterSeconds,
        },
        429,
      );
    }

    await actor.supabase
      .from('opc_data_export_verifications')
      .update({ revoked_at: new Date(now).toISOString() })
      .eq('actor_user_id', actor.userId)
      .eq('scope', scope)
      .is('consumed_at', null)
      .is('revoked_at', null);

    const code = randomOtp();
    const nonce = randomHex(32);
    const expiresAt = new Date(now + OTP_TTL_SECONDS * 1000).toISOString();
    const codeHash = await emailCodeHash({
      userId: actor.userId,
      scope,
      nonce,
      code,
      locals,
    });

    const { data: challenge, error: insertError } = await actor.supabase
      .from('opc_data_export_verifications')
      .insert({
        actor_user_id: actor.userId,
        actor_email: actor.email,
        scope,
        email_code_hash: codeHash,
        email_code_nonce: nonce,
        email_code_sent_at: new Date(now).toISOString(),
        email_code_expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (insertError || !challenge?.id) {
      throw new Error(insertError?.message || 'Sicherheitsprüfung konnte nicht angelegt werden.');
    }

    try {
      await invokeMailFunction({
        locals,
        to: actor.email,
        subject: 'Orange Pro Clean · Verifizierungscode für Datenexport',
        html: otpEmailHtml({
          code,
          scope,
          expiresMinutes: Math.round(OTP_TTL_SECONDS / 60),
        }),
      });
    } catch (mailError) {
      await actor.supabase
        .from('opc_data_export_verifications')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', challenge.id);
      throw mailError;
    }

    return json({
      success: true,
      verificationId: challenge.id,
      recipientMasked: maskEmail(actor.email),
      expiresInSeconds: OTP_TTL_SECONDS,
      resendAfterSeconds: RESEND_SECONDS,
      estimatedSeconds: await estimateSeconds(actor.supabase, scope),
    });
  } catch (error: any) {
    const status = Number(error?.status || 500);
    return json(
      {
        success: false,
        error: clean(error?.message) || 'Sicherheitsprüfung konnte nicht gestartet werden.',
      },
      Number.isFinite(status) ? status : 500,
    );
  }
}

async function loadChallenge(args: {
  supabase: SupabaseClient;
  verificationId: string;
  actorUserId: string;
  actorEmail: string;
  scope: OpcExportScope;
}) {
  const { data, error } = await args.supabase
    .from('opc_data_export_verifications')
    .select('*')
    .eq('id', args.verificationId)
    .eq('actor_user_id', args.actorUserId)
    .eq('actor_email', args.actorEmail)
    .eq('scope', args.scope)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as ChallengeRow | null;
}

function challengeUsable(challenge: ChallengeRow | null) {
  if (!challenge) return false;
  if (challenge.consumed_at || challenge.revoked_at) return false;
  const expires = Date.parse(challenge.email_code_expires_at);
  return Number.isFinite(expires) && expires > Date.now();
}

export async function verifyExportVerification(request: Request, locals: any) {
  try {
    const body = await request.json().catch(() => ({}));
    const scope = normalizeExportScope((body as any)?.scope);
    const verificationId = clean((body as any)?.verificationId);
    const emailCode = clean((body as any)?.emailCode).replace(/\D/g, '');
    const postalCode = normalizePostalExportCode((body as any)?.postalCode);

    if (!scope || !verificationId) {
      return json({ success: false, error: 'Sicherheitsprüfung ist unvollständig.' }, 400);
    }

    const actor = await requireOwnerActor(request, locals);
    const challenge = await loadChallenge({
      supabase: actor.supabase,
      verificationId,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      scope,
    });

    if (!challengeUsable(challenge)) {
      return json(
        {
          success: false,
          error: 'Dieser Verifizierungsvorgang ist abgelaufen. Bitte fordern Sie einen neuen E-Mail-Code an.',
        },
        410,
      );
    }

    if (
      Number(challenge!.email_code_attempts || 0) >= MAX_ATTEMPTS ||
      Number(challenge!.postal_code_attempts || 0) >= MAX_ATTEMPTS
    ) {
      await actor.supabase
        .from('opc_data_export_verifications')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', verificationId);
      return json(
        {
          success: false,
          error: 'Zu viele ungültige Eingaben. Bitte starten Sie die Sicherheitsprüfung erneut.',
        },
        429,
      );
    }

    const expectedEmailHash = await emailCodeHash({
      userId: actor.userId,
      scope,
      nonce: challenge!.email_code_nonce,
      code: emailCode,
      locals,
    });

    const emailValid =
      emailCode.length === 6 &&
      constantTimeStringEqual(expectedEmailHash, clean(challenge!.email_code_hash));

    const postalValid = await verifyPostalCode({
      supabase: actor.supabase,
      postalCode,
    });

    if (!emailValid || !postalValid) {
      const nextEmailAttempts = Number(challenge!.email_code_attempts || 0) + (emailValid ? 0 : 1);
      const nextPostalAttempts = Number(challenge!.postal_code_attempts || 0) + (postalValid ? 0 : 1);
      const shouldRevoke =
        nextEmailAttempts >= MAX_ATTEMPTS || nextPostalAttempts >= MAX_ATTEMPTS;

      await actor.supabase
        .from('opc_data_export_verifications')
        .update({
          email_code_attempts: Math.min(nextEmailAttempts, 10),
          postal_code_attempts: Math.min(nextPostalAttempts, 10),
          revoked_at: shouldRevoke ? new Date().toISOString() : null,
        })
        .eq('id', verificationId)
        .is('consumed_at', null);

      return json(
        {
          success: false,
          error: shouldRevoke
            ? 'Zu viele ungültige Eingaben. Bitte starten Sie die Sicherheitsprüfung erneut.'
            : 'Die Sicherheitscodes konnten nicht bestätigt werden. Bitte prüfen Sie beide Codes und versuchen Sie es erneut.',
          remainingAttempts: Math.max(
            0,
            MAX_ATTEMPTS - Math.max(nextEmailAttempts, nextPostalAttempts),
          ),
        },
        shouldRevoke ? 429 : 400,
      );
    }

    const verifiedAt = new Date().toISOString();
    const { error: updateError } = await actor.supabase
      .from('opc_data_export_verifications')
      .update({
        email_verified_at: verifiedAt,
        postal_verified_at: verifiedAt,
        verified_at: verifiedAt,
      })
      .eq('id', verificationId)
      .eq('actor_user_id', actor.userId)
      .is('consumed_at', null)
      .is('revoked_at', null);

    if (updateError) throw updateError;

    return json({
      success: true,
      verificationId,
      estimatedSeconds: await estimateSeconds(actor.supabase, scope),
    });
  } catch (error: any) {
    const status = Number(error?.status || 500);
    return json(
      {
        success: false,
        error: clean(error?.message) || 'Sicherheitscodes konnten nicht geprüft werden.',
      },
      Number.isFinite(status) ? status : 500,
    );
  }
}

export async function guardAndConsumeExportRequest(request: Request, locals: any) {
  try {
    const body = await request.json().catch(() => ({}));
    const scope = normalizeExportScope((body as any)?.scope);
    const verificationId = clean((body as any)?.verificationId);

    if (!scope || !verificationId) {
      return json(
        {
          success: false,
          error: 'Vor dem Datenexport ist die doppelte Sicherheitsverifizierung erforderlich.',
          verificationRequired: true,
        },
        403,
      );
    }

    const actor = await requireOwnerActor(request, locals);
    const challenge = await loadChallenge({
      supabase: actor.supabase,
      verificationId,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      scope,
    });

    if (!challengeUsable(challenge) || !challenge?.verified_at) {
      return json(
        {
          success: false,
          error: 'Die Sicherheitsverifizierung ist nicht mehr gültig. Bitte starten Sie sie erneut.',
          verificationRequired: true,
        },
        403,
      );
    }

    if (!challenge.email_verified_at || !challenge.postal_verified_at) {
      return json(
        {
          success: false,
          error: 'Beide Sicherheitscodes müssen bestätigt sein.',
          verificationRequired: true,
        },
        403,
      );
    }

    const consumedAt = new Date().toISOString();
    const { data: consumed, error: consumeError } = await actor.supabase
      .from('opc_data_export_verifications')
      .update({ consumed_at: consumedAt })
      .eq('id', verificationId)
      .eq('actor_user_id', actor.userId)
      .eq('scope', scope)
      .is('consumed_at', null)
      .is('revoked_at', null)
      .select('id')
      .maybeSingle();

    if (consumeError) throw consumeError;
    if (!consumed?.id) {
      return json(
        {
          success: false,
          error: 'Diese Exportfreigabe wurde bereits verwendet. Bitte starten Sie eine neue Sicherheitsprüfung.',
          verificationRequired: true,
        },
        409,
      );
    }

    return null;
  } catch (error: any) {
    const status = Number(error?.status || 500);
    return json(
      {
        success: false,
        error: clean(error?.message) || 'Exportfreigabe konnte nicht geprüft werden.',
        verificationRequired: status !== 500,
      },
      Number.isFinite(status) ? status : 500,
    );
  }
}
