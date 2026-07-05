import type { APIContext } from 'astro';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  createOpcSupabaseAdmin,
  createOpcSupabaseUserClient,
} from './opc-server-env';
import {
  canDeleteOfficeDocuments,
  canManageOfficeDocuments,
  normalizeOfficeRole,
  type OpcOfficeAccess,
  type OpcOfficeRole,
} from './opc-office-types';

export class OpcOfficeHttpError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'OpcOfficeHttpError';
    this.status = status;
  }
}

export type OpcOfficeAuthContext = {
  user: User;
  userName: string;
  token: string;
  role: OpcOfficeRole;
  employeeId: string | null;
  clientId: string | null;
  userClient: SupabaseClient;
  admin: SupabaseClient;
};

function cleanToken(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^['"]|['"]$/g, '')
    .trim();
}

function parseCookieToken(value: unknown) {
  const raw = cleanToken(value);
  if (!raw) return '';

  try {
    const parsed = JSON.parse(decodeURIComponent(raw));

    if (typeof parsed === 'string') return cleanToken(parsed);
    if (parsed?.access_token) return cleanToken(parsed.access_token);
    if (parsed?.currentSession?.access_token) return cleanToken(parsed.currentSession.access_token);
    if (parsed?.session?.access_token) return cleanToken(parsed.session.access_token);
    if (Array.isArray(parsed) && parsed[0]) return cleanToken(parsed[0]);
  } catch {
    // A plain JWT is expected in most deployments.
  }

  return raw;
}

function resolveAccessToken(request: Request, cookies?: APIContext['cookies']) {
  const authorization = cleanToken(request.headers.get('authorization'));
  if (authorization) return authorization;

  const cookieCandidates = [
    cookies?.get('sb-access-token')?.value,
    cookies?.get('opc_auth_token')?.value,
    cookies?.get('mco_auth_token')?.value,
  ];

  for (const candidate of cookieCandidates) {
    const token = parseCookieToken(candidate);
    if (token) return token;
  }

  return '';
}

export async function requireOpcOfficeAuth({
  request,
  locals,
  cookies,
}: Pick<APIContext, 'request' | 'locals' | 'cookies'>): Promise<OpcOfficeAuthContext> {
  const token = resolveAccessToken(request, cookies);

  if (!token) {
    throw new OpcOfficeHttpError('Not authenticated.', 401);
  }

  const userClient = createOpcSupabaseUserClient(locals, token);
  const admin = createOpcSupabaseAdmin(locals);
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(token);

  if (userError || !user) {
    throw new OpcOfficeHttpError('Invalid authentication.', 401);
  }

  const { data: staffRole, error: staffRoleError } = await admin
    .from('opc_staff_roles')
    .select('id, role, status, can_access_portal, employee_id, display_name')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('can_access_portal', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (staffRoleError) {
    throw new OpcOfficeHttpError(`Staff role lookup failed: ${staffRoleError.message}`, 500);
  }

  // Select the complete profile record instead of naming optional legacy columns.
  // The production user_profiles schema does not contain is_owner/is_admin.
  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .limit(1)
    .maybeSingle();

  if (profileError) {
    throw new OpcOfficeHttpError(`Profile lookup failed: ${profileError.message}`, 500);
  }

  const profileRecord = (profile || {}) as Record<string, any>;
  let role: OpcOfficeRole;

  // opc_staff_roles is the authoritative role source for internal OPC users.
  if (staffRole?.role) {
    role = normalizeOfficeRole(staffRole.role);
  } else if (profileRecord.is_owner === true) {
    role = 'owner';
  } else if (profileRecord.is_admin === true) {
    role = 'admin';
  } else {
    role = normalizeOfficeRole(
      profileRecord.role ||
        profileRecord.opc_staff_role ||
        profileRecord.staff_role ||
        user.app_metadata?.opc_role ||
        user.user_metadata?.opc_role,
    );
  }

  let clientId: string | null = null;

  if (role === 'client') {
    const { data: clientUser } = await admin
      .from('opc_client_users')
      .select('client_id')
      .eq('user_id', user.id)
      .in('status', ['active', 'invited'])
      .eq('can_access_client_portal', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    clientId = clientUser?.client_id || null;
  }

  const userName =
    staffRole?.display_name ||
    profileRecord.full_name ||
    profileRecord.display_name ||
    profileRecord.name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.display_name ||
    user.email ||
    'Benutzer';

  return {
    user,
    userName,
    token,
    role,
    employeeId: staffRole?.employee_id || null,
    clientId,
    userClient,
    admin,
  };
}

export async function getOpcOfficeDocumentAccess(
  auth: OpcOfficeAuthContext,
  documentId: string,
): Promise<{ document: any; access: OpcOfficeAccess }> {
  const { data: document, error: documentError } = await auth.admin
    .from('opc_documents')
    .select('*')
    .eq('id', documentId)
    .maybeSingle();

  if (documentError) {
    throw new OpcOfficeHttpError(`Document lookup failed: ${documentError.message}`, 500);
  }

  if (!document || document.status === 'deleted' || document.deleted_at) {
    throw new OpcOfficeHttpError('Document not found.', 404);
  }

  if (canManageOfficeDocuments(auth.role)) {
    return {
      document,
      access: {
        canView: true,
        canEdit: true,
        canDownload: true,
        canShare: true,
        canDelete: canDeleteOfficeDocuments(auth.role),
      },
    };
  }

  const access: OpcOfficeAccess = {
    canView: document.owner_user_id === auth.user.id,
    canEdit: false,
    canDownload: document.owner_user_id === auth.user.id,
    canShare: false,
    canDelete: false,
  };

  const { data: permissions, error: permissionsError } = await auth.admin
    .from('opc_document_permissions')
    .select('principal_type, principal_id, principal_role, can_view, can_edit, can_download, can_share, can_delete, expires_at')
    .eq('document_id', documentId);

  if (permissionsError) {
    throw new OpcOfficeHttpError(`Document permission lookup failed: ${permissionsError.message}`, 500);
  }

  const now = Date.now();

  for (const permission of permissions || []) {
    if (permission.expires_at && new Date(permission.expires_at).getTime() <= now) continue;

    const matches =
      (permission.principal_type === 'user' && permission.principal_id === auth.user.id) ||
      (permission.principal_type === 'role' && permission.principal_role === auth.role) ||
      (permission.principal_type === 'employee' && permission.principal_id === auth.employeeId) ||
      (permission.principal_type === 'client' && permission.principal_id === auth.clientId);

    if (!matches) continue;

    access.canView ||= permission.can_view === true;
    access.canEdit ||= permission.can_edit === true;
    access.canDownload ||= permission.can_download === true;
    access.canShare ||= permission.can_share === true;
    access.canDelete ||= permission.can_delete === true;
  }

  if (access.canEdit) access.canView = true;

  return { document, access };
}

export function officeJson(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

export function officeErrorResponse(error: unknown) {
  const status = error instanceof OpcOfficeHttpError ? error.status : 500;
  const message = error instanceof Error ? error.message : 'Unexpected office integration error.';

  if (status >= 500) {
    console.error('[opc-office]', error);
  }

  return officeJson({ success: false, error: message }, status);
}
