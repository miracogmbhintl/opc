import type { APIContext } from 'astro';
import { createOpcSupabaseAdmin } from '../../../lib/opc-server-env';

export const prerender = false;

type EmailAction =
  | 'account_setup'
  | 'password_reset'
  | 'magic_link'
  | 'portal_invite';

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

function getSupabaseAdmin(locals: any) {
  return createOpcSupabaseAdmin(locals);
}

function getRedirectUrl(request: Request, action: EmailAction) {
  const origin = new URL(request.url).origin;

  if (action === 'password_reset') {
    return `${origin}/reset-password`;
  }

  if (action === 'magic_link') {
    return `${origin}/dashboard`;
  }

  return `${origin}/set-password`;
}

export async function POST({ request, locals }: APIContext) {
  try {
    const supabaseAdmin = getSupabaseAdmin(locals);
    const payload = (await request.json()) as any;

    const clientId = clean(payload?.clientId);
    const action = clean(payload?.action) as EmailAction | null;

    if (!clientId || !action) {
      return jsonResponse({ error: 'Missing clientId or action.' }, 400);
    }

    if (!['account_setup', 'password_reset', 'magic_link', 'portal_invite'].includes(action)) {
      return jsonResponse({ error: 'Unknown email action.' }, 400);
    }

    const { data: client, error: clientError } = await supabaseAdmin
      .from('opc_clients')
      .select('id, contact_id, billing_name, billing_email, billing_phone_e164, client_type')
      .eq('id', clientId)
      .maybeSingle();

    if (clientError) {
      throw new Error(`Client lookup failed: ${clientError.message}`);
    }

    if (!client) {
      return jsonResponse({ error: 'Client not found.' }, 404);
    }

    const { data: contact, error: contactError } = await supabaseAdmin
      .from('opc_contacts')
      .select('id, full_name, company_name, email, phone_raw, phone_e164')
      .eq('id', client.contact_id)
      .maybeSingle();

    if (contactError) {
      throw new Error(`Contact lookup failed: ${contactError.message}`);
    }

    const email = clean(contact?.email) || clean(client.billing_email);

    if (!email) {
      return jsonResponse(
        {
          error: 'Dieser Kunde hat keine E-Mail-Adresse. Bitte zuerst eine E-Mail hinterlegen.',
        },
        400
      );
    }

    const redirectTo = getRedirectUrl(request, action);
    const displayName =
      clean(contact?.full_name) ||
      clean(contact?.company_name) ||
      clean(client.billing_name) ||
      'Kunde';

    if (action === 'account_setup' || action === 'portal_invite') {
      const { data: existingPortalUser } = await supabaseAdmin
        .from('opc_client_users')
        .select('id, status')
        .eq('client_id', clientId)
        .limit(1)
        .maybeSingle();

      if (!existingPortalUser) {
        return jsonResponse(
          {
            error:
              'Für diesen Kunden ist noch kein Portalzugang vorbereitet. Bitte zuerst Portal freischalten.',
          },
          400
        );
      }

      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: {
          client_id: clientId,
          contact_id: client.contact_id,
          display_name: displayName,
          source: 'opc_client_detail',
        },
      });

      if (inviteError) {
        throw new Error(`Supabase invitation failed: ${inviteError.message}`);
      }

      await supabaseAdmin
        .from('opc_client_users')
        .update({
          status: 'invited',
          invited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: {
            source: 'client_detail_email_action',
            last_email_action: action,
          },
        })
        .eq('id', existingPortalUser.id);
    }

    if (action === 'password_reset') {
      const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (resetError) {
        throw new Error(`Password reset failed: ${resetError.message}`);
      }
    }

    if (action === 'magic_link') {
      const { error: magicError } = await supabaseAdmin.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: redirectTo,
        },
      });

      if (magicError) {
        throw new Error(`Magic link failed: ${magicError.message}`);
      }
    }

    await supabaseAdmin.from('opc_client_activity').insert({
      client_id: clientId,
      contact_id: client.contact_id,
      activity_type: `email_${action}`,
      message:
        action === 'account_setup'
          ? 'Konto-Setup E-Mail wurde gesendet.'
          : action === 'password_reset'
            ? 'Passwort-zurücksetzen E-Mail wurde gesendet.'
            : action === 'magic_link'
              ? 'Magic-Link E-Mail wurde gesendet.'
              : 'Portal-Einladung wurde erneut gesendet.',
      metadata: {
        source: 'client_detail',
        action,
        email,
      },
    });

    return jsonResponse({
      success: true,
      action,
      email,
    });
  } catch (error: any) {
    console.error('[client-email-action] failed:', error);

    return jsonResponse(
      {
        error: error?.message || 'E-Mail konnte nicht gesendet werden.',
      },
      500
    );
  }
}