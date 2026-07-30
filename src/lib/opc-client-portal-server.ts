import type { SupabaseClient, User } from '@supabase/supabase-js';
import { authenticateOpcRequest } from './opc-job-access';

type AnyRow = Record<string, any>;

export type OpcClientPortalPermissions = {
  canViewJobs: boolean;
  canViewReports: boolean;
  canViewMedia: boolean;
  canViewDamageReports: boolean;
  canViewInvoices: boolean;
  canCreateRequests: boolean;
  canSendMessages: boolean;
};

export type OpcClientPortalAccess = {
  user: User;
  clientUser: AnyRow;
  client: AnyRow;
  contact: AnyRow | null;
  clientId: string;
  contactId: string | null;
  permissions: OpcClientPortalPermissions;
};

function enabled(value: unknown, fallback = false) {
  if (value === null || value === undefined) return fallback;
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;

  return ['true', '1', 'yes', 'ja', 'active', 'enabled'].includes(
    String(value).trim().toLowerCase(),
  );
}

function permissionsFromRow(row: AnyRow): OpcClientPortalPermissions {
  return {
    canViewJobs: enabled(row.can_view_jobs, true),
    canViewReports: enabled(row.can_view_reports, true),
    canViewMedia: enabled(row.can_view_media, true),
    canViewDamageReports: enabled(row.can_view_damage_reports, true),
    canViewInvoices: enabled(row.can_view_invoices, true),
    canCreateRequests: enabled(row.can_create_requests, true),
    canSendMessages: enabled(row.can_send_messages, true),
  };
}

async function findClientUser(
  serviceClient: SupabaseClient,
  user: User,
): Promise<AnyRow | null> {
  const directResult = await serviceClient
    .from('opc_client_users')
    .select('*')
    .eq('user_id', user.id)
    .eq('can_access_client_portal', true)
    .in('status', ['active', 'invited'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (directResult.error) {
    throw new Error(`Kundenportal-Zuordnung konnte nicht geladen werden: ${directResult.error.message}`);
  }

  if (directResult.data) return directResult.data as AnyRow;

  if (!user.email) return null;

  const emailResult = await serviceClient
    .from('opc_client_users')
    .select('*')
    .ilike('email', user.email)
    .eq('can_access_client_portal', true)
    .in('status', ['active', 'invited'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (emailResult.error) {
    throw new Error(`Kundenportal-E-Mail-Zuordnung konnte nicht geladen werden: ${emailResult.error.message}`);
  }

  return (emailResult.data || null) as AnyRow | null;
}

async function activateInvitedClientUser(
  serviceClient: SupabaseClient,
  clientUser: AnyRow,
  user: User,
) {
  const status = String(clientUser.status || '').trim().toLowerCase();
  const needsUserLink = !clientUser.user_id || String(clientUser.user_id) !== user.id;

  if (status !== 'invited' && !needsUserLink) return clientUser;

  const payload: AnyRow = {
    user_id: user.id,
    status: 'active',
    updated_at: new Date().toISOString(),
  };

  const result = await serviceClient
    .from('opc_client_users')
    .update(payload)
    .eq('id', clientUser.id)
    .select('*')
    .single();

  if (result.error) {
    throw new Error(`Kundenportal-Zugang konnte nicht aktiviert werden: ${result.error.message}`);
  }

  return result.data as AnyRow;
}

export async function resolveOpcClientPortalAccess(
  serviceClient: SupabaseClient,
  user: User,
): Promise<OpcClientPortalAccess | null> {
  let clientUser = await findClientUser(serviceClient, user);

  if (!clientUser?.client_id) return null;

  clientUser = await activateInvitedClientUser(serviceClient, clientUser, user);

  const clientId = String(clientUser.client_id);
  const contactId = clientUser.contact_id ? String(clientUser.contact_id) : null;

  const [clientResult, contactResult] = await Promise.all([
    serviceClient.from('opc_clients').select('*').eq('id', clientId).maybeSingle(),
    contactId
      ? serviceClient.from('opc_contacts').select('*').eq('id', contactId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (clientResult.error) {
    throw new Error(`Kundendaten konnten nicht geladen werden: ${clientResult.error.message}`);
  }

  if (!clientResult.data) return null;

  if (contactResult.error) {
    throw new Error(`Kontakt konnte nicht geladen werden: ${contactResult.error.message}`);
  }

  return {
    user,
    clientUser,
    client: clientResult.data as AnyRow,
    contact: (contactResult.data || null) as AnyRow | null,
    clientId,
    contactId,
    permissions: permissionsFromRow(clientUser),
  };
}

export async function authenticateOpcClientPortalRequest(request: Request, locals?: any) {
  const authenticated = await authenticateOpcRequest(request, locals);

  if ('error' in authenticated) return authenticated;

  const access = await resolveOpcClientPortalAccess(
    authenticated.serviceClient,
    authenticated.user,
  );

  if (!access) {
    return {
      error: 'Kein aktiver Kundenportal-Zugang gefunden.' as const,
      status: 403 as const,
    };
  }

  return {
    ...authenticated,
    access,
  };
}

export function opcClientPortalJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}
