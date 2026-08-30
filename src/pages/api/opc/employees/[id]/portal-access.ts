import type { APIRoute } from 'astro';
import {
  cleanText,
  errorStatus,
  jsonResponse,
  normalizeEmail,
  requireEmployeeHrAccess,
  safeObject,
  throwOnError,
} from '../../../../../lib/opc-employee-api';
import {
  OPC_STAFF_PERMISSION_DEFINITIONS,
  defaultOpcEmployeePermissions,
  normalizeOpcStaffPermissions,
} from '../../../../../lib/opc-staff-permissions';

export const prerender = false;

type JsonRow = Record<string, any>;

const V10_MARKER = 'OPC_EMPLOYEE_PORTAL_ACCESS_V10';

function nowIso() {
  return new Date().toISOString();
}

function normalizeRole(value: unknown) {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'mitarbeiter') return 'employee';
  return role;
}

function requestOrigin(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function setPasswordRedirect(request: Request) {
  return `${requestOrigin(request)}/set-password`;
}

function permissionPatch(value: unknown) {
  const normalized = normalizeOpcStaffPermissions(value);
  return Object.fromEntries(
    OPC_STAFF_PERMISSION_DEFINITIONS.map((item) => [
      item.key,
      normalized[item.key],
    ]),
  );
}

async function findAuthUserByEmail(
  supabase: any,
  email: string,
) {
  const target = email.trim().toLowerCase();

  for (let page = 1; page <= 20; page += 1) {
    const response = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (response.error) {
      throw new Error(
        `Auth-Benutzersuche fehlgeschlagen: ${response.error.message}`,
      );
    }

    const users = response.data?.users || [];
    const match = users.find(
      (user: any) =>
        String(user.email || '').trim().toLowerCase() === target,
    );

    if (match) return match;
    if (users.length < 100) break;
  }

  return null;
}

async function getEmployeeContext(
  supabase: any,
  employeeId: string,
) {
  const employeeResponse = await supabase
    .from('opc_employees')
    .select(
      'id,employee_number,user_id,staff_role_id,legal_first_name,legal_last_name,preferred_name,business_email,private_email,status',
    )
    .eq('id', employeeId)
    .maybeSingle();

  throwOnError(
    employeeResponse.error,
    'Mitarbeiter konnte nicht geladen werden',
  );

  const employee = employeeResponse.data as JsonRow | null;
  if (!employee) {
    const error = new Error('Mitarbeiter wurde nicht gefunden.');
    (error as any).status = 404;
    throw error;
  }

  let staffRole: JsonRow | null = null;

  if (employee.staff_role_id) {
    const response = await supabase
      .from('opc_staff_roles')
      .select('*')
      .eq('id', employee.staff_role_id)
      .maybeSingle();

    throwOnError(
      response.error,
      'Portalrolle konnte nicht geladen werden',
    );
    staffRole = response.data;
  }

  if (!staffRole) {
    const response = await supabase
      .from('opc_staff_roles')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    throwOnError(
      response.error,
      'Portalrolle konnte nicht geladen werden',
    );
    staffRole = response.data;
  }

  const targetRole = normalizeRole(staffRole?.role);
  const isOwner =
    ['owner', 'godmode', 'superadmin'].includes(targetRole);
  const isPrivileged =
    isOwner || targetRole === 'admin';

  return {
    employee,
    staffRole,
    targetRole,
    isOwner,
    isPrivileged,
  };
}

async function getAuthUserById(
  supabase: any,
  userId: string | null | undefined,
) {
  if (!userId) return null;

  const response = await supabase.auth.admin.getUserById(userId);

  if (response.error) {
    if (
      String(response.error.message || '')
        .toLowerCase()
        .includes('not found')
    ) {
      return null;
    }

    throw new Error(
      `Auth-Benutzer konnte nicht geladen werden: ${response.error.message}`,
    );
  }

  return response.data?.user || null;
}

async function getProfile(
  supabase: any,
  userId: string | null | undefined,
) {
  if (!userId) return null;

  const response = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  throwOnError(
    response.error,
    'Benutzerprofil konnte nicht geladen werden',
  );

  return response.data as JsonRow | null;
}

function serializePortalState({
  employee,
  staffRole,
  authUser,
}: {
  employee: JsonRow;
  staffRole: JsonRow | null;
  authUser: any;
}) {
  const role = normalizeRole(staffRole?.role || 'employee');
  const isOwner =
    ['owner', 'godmode', 'superadmin'].includes(role);
  const isPrivileged =
    isOwner || role === 'admin';

  const permissions = isOwner
    ? Object.fromEntries(
        OPC_STAFF_PERMISSION_DEFINITIONS.map((item) => [
          item.key,
          true,
        ]),
      )
    : staffRole
      ? normalizeOpcStaffPermissions(staffRole)
      : defaultOpcEmployeePermissions();

  const metadata = safeObject(staffRole?.metadata);
  const portalMetadata = safeObject(metadata.portal_access);

  return {
    linked: Boolean(
      staffRole?.id &&
      (
        staffRole?.user_id ||
        authUser?.id ||
        isPrivileged
      )
    ),
    employeeId: String(employee.id),
    userId:
      String(staffRole?.user_id || authUser?.id || '') || null,
    staffRoleId: String(staffRole?.id || '') || null,
    loginEmail: String(
      authUser?.email ||
      staffRole?.email ||
      employee.business_email ||
      employee.private_email ||
      '',
    ),
    role: isOwner ? 'owner' : role,
    isOwner,
    isPrivileged,
    status: String(staffRole?.status || 'inactive'),
    canAccessPortal:
      isOwner ? true : staffRole?.can_access_portal !== false,
    permissions,
    inviteSentAt:
      portalMetadata.last_access_email_at ||
      portalMetadata.invited_at ||
      null,
    auth: {
      exists: Boolean(authUser?.id),
      confirmedAt:
        authUser?.email_confirmed_at ||
        authUser?.confirmed_at ||
        null,
      invitedAt:
        authUser?.invited_at ||
        authUser?.confirmation_sent_at ||
        null,
      lastSignInAt: authUser?.last_sign_in_at || null,
    },
  };
}

async function assertOwnerAccess(args: {
  request: Request;
  locals: any;
  cookies: any;
}) {
  const result = await requireEmployeeHrAccess(args);

  if (!result.access.isOwner) {
    const error = new Error('Owner access required');
    (error as any).status = 403;
    throw error;
  }

  return result;
}

function apiStatus(error: any) {
  if (Number(error?.status) >= 400) {
    return Number(error.status);
  }

  const message = String(error?.message || '');

  if (message === 'Owner access required') return 403;
  return errorStatus(error);
}

async function ensureNoUserConflict({
  supabase,
  authUser,
  employeeId,
}: {
  supabase: any;
  authUser: any;
  employeeId: string;
}) {
  if (!authUser?.id) return;

  const staffResponse = await supabase
    .from('opc_staff_roles')
    .select('id,employee_id,role,status')
    .eq('user_id', authUser.id);

  throwOnError(
    staffResponse.error,
    'Bestehende Portalrollen konnten nicht geprüft werden',
  );

  for (const row of staffResponse.data || []) {
    const role = normalizeRole(row.role);

    if (
      ['owner', 'godmode', 'superadmin', 'admin'].includes(role)
    ) {
      const error = new Error(
        'Diese E-Mail gehört bereits zu einem privilegierten OPC-Konto und kann nicht als Mitarbeiter-Login übernommen werden.',
      );
      (error as any).status = 409;
      throw error;
    }

    if (
      row.employee_id &&
      String(row.employee_id) !== employeeId &&
      !['inactive', 'disabled', 'archived'].includes(
        String(row.status || '').toLowerCase(),
      )
    ) {
      const error = new Error(
        'Diese E-Mail ist bereits mit einem anderen aktiven Mitarbeiter verknüpft.',
      );
      (error as any).status = 409;
      throw error;
    }
  }

  const profile = await getProfile(supabase, authUser.id);
  const profileRole = normalizeRole(profile?.role);

  if (
    profileRole &&
    !['employee', 'mitarbeiter'].includes(profileRole)
  ) {
    const sameEmployee = (staffResponse.data || []).some(
      (row: JsonRow) =>
        String(row.employee_id || '') === employeeId,
    );

    if (!sameEmployee) {
      const error = new Error(
        'Diese E-Mail gehört bereits zu einem anderen Portal-Kontotyp.',
      );
      (error as any).status = 409;
      throw error;
    }
  }
}

async function persistStaffAndProfile({
  supabase,
  access,
  employee,
  staffRole,
  authUser,
  loginEmail,
  canAccessPortal,
  permissions,
  accessEmailSent,
}: {
  supabase: any;
  access: JsonRow;
  employee: JsonRow;
  staffRole: JsonRow | null;
  authUser: any;
  loginEmail: string;
  canAccessPortal: boolean;
  permissions: Record<string, boolean>;
  accessEmailSent: boolean;
}) {
  const displayName =
    [
      employee.legal_first_name,
      employee.legal_last_name,
    ]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    employee.preferred_name ||
    loginEmail;

  const existingMetadata = safeObject(staffRole?.metadata);
  const existingPortalMetadata = safeObject(
    existingMetadata.portal_access,
  );

  const metadata = {
    ...existingMetadata,
    portal_access: {
      ...existingPortalMetadata,
      version: 10,
      source: V10_MARKER,
      updated_at: nowIso(),
      updated_by: access.user.id,
      ...(accessEmailSent
        ? { last_access_email_at: nowIso() }
        : {}),
      ...(!staffRole?.id
        ? { created_at: nowIso(), created_by: access.user.id }
        : {}),
    },
  };

  const staffPayload: JsonRow = {
    user_id: authUser.id,
    employee_id: employee.id,
    role: 'employee',
    status: canAccessPortal ? 'active' : 'inactive',
    display_name: displayName,
    email: loginEmail,
    can_access_portal: canAccessPortal,
    ...permissions,
    metadata,
    updated_at: nowIso(),
  };

  let nextStaff: JsonRow;

  if (staffRole?.id) {
    const response = await supabase
      .from('opc_staff_roles')
      .update(staffPayload)
      .eq('id', staffRole.id)
      .select('*')
      .single();

    throwOnError(
      response.error,
      'Portalrolle konnte nicht aktualisiert werden',
    );

    nextStaff = response.data;
  } else {
    const response = await supabase
      .from('opc_staff_roles')
      .insert({
        ...staffPayload,
        created_at: nowIso(),
      })
      .select('*')
      .single();

    throwOnError(
      response.error,
      'Portalrolle konnte nicht erstellt werden',
    );

    nextStaff = response.data;
  }

  const userMetadata = {
    ...(authUser.user_metadata || {}),
    display_name: displayName,
    full_name: displayName,
    opc_role: 'employee',
    opc_employee_id: employee.id,
    opc_staff_role_id: nextStaff.id,
    portal: 'orange_pro_clean',
  };

  const appMetadata = {
    ...(authUser.app_metadata || {}),
    opc_role: 'employee',
    portal: 'orange_pro_clean',
  };

  const authUpdate = await supabase.auth.admin.updateUserById(
    authUser.id,
    {
      user_metadata: userMetadata,
      app_metadata: appMetadata,
    },
  );

  if (authUpdate.error) {
    throw new Error(
      `Auth-Metadaten konnten nicht aktualisiert werden: ${authUpdate.error.message}`,
    );
  }

  const profileResponse = await supabase
    .from('user_profiles')
    .upsert(
      {
        id: authUser.id,
        email: loginEmail,
        name: displayName,
        full_name: displayName,
        role: 'employee',
        company: 'Orange Pro Clean GmbH',
        opc_staff_role_id: nextStaff.id,
        opc_staff_role: 'employee',
        opc_status: canAccessPortal ? 'active' : 'inactive',
        can_access_portal: canAccessPortal,
        updated_at: nowIso(),
      },
      { onConflict: 'id' },
    );

  throwOnError(
    profileResponse.error,
    'Benutzerprofil konnte nicht synchronisiert werden',
  );

  const employeeResponse = await supabase
    .from('opc_employees')
    .update({
      user_id: authUser.id,
      staff_role_id: nextStaff.id,
      updated_by: access.user.id,
    })
    .eq('id', employee.id);

  throwOnError(
    employeeResponse.error,
    'Personalakte konnte nicht mit dem Login verknüpft werden',
  );

  return {
    staffRole: nextStaff,
    authUser: authUpdate.data?.user || authUser,
  };
}

async function sendAccessEmail({
  supabase,
  request,
  authUser,
  loginEmail,
  employee,
}: {
  supabase: any;
  request: Request;
  authUser: any;
  loginEmail: string;
  employee: JsonRow;
}) {
  const displayName =
    [
      employee.legal_first_name,
      employee.legal_last_name,
    ]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    employee.preferred_name ||
    loginEmail;

  const redirectTo = setPasswordRedirect(request);

  if (!authUser) {
    const inviteResponse =
      await supabase.auth.admin.inviteUserByEmail(
        loginEmail,
        {
          redirectTo,
          data: {
            display_name: displayName,
            full_name: displayName,
            opc_role: 'employee',
            opc_employee_id: employee.id,
            portal: 'orange_pro_clean',
          },
        },
      );

    if (inviteResponse.error || !inviteResponse.data?.user) {
      throw new Error(
        `Einladung konnte nicht versendet werden: ${
          inviteResponse.error?.message ||
          'Kein Auth-Benutzer zurückgegeben'
        }`,
      );
    }

    return {
      authUser: inviteResponse.data.user,
      inviteSent: true,
      accessEmailSent: true,
    };
  }

  const confirmed =
    authUser.email_confirmed_at ||
    authUser.confirmed_at;

  if (!confirmed) {
    const resendResponse = await supabase.auth.resend({
      type: 'signup',
      email: loginEmail,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (resendResponse.error) {
      throw new Error(
        `Einladung konnte nicht erneut versendet werden: ${resendResponse.error.message}`,
      );
    }

    return {
      authUser,
      inviteSent: true,
      accessEmailSent: true,
    };
  }

  const resetResponse =
    await supabase.auth.resetPasswordForEmail(
      loginEmail,
      { redirectTo },
    );

  if (resetResponse.error) {
    throw new Error(
      `Zugangslink konnte nicht versendet werden: ${resetResponse.error.message}`,
    );
  }

  return {
    authUser,
    inviteSent: false,
    accessEmailSent: true,
  };
}

export const GET: APIRoute = async ({
  request,
  locals,
  cookies,
  params,
}) => {
  try {
    const employeeId = cleanText(params.id);

    if (!employeeId) {
      return jsonResponse(
        { success: false, error: 'Mitarbeiter-ID fehlt.' },
        400,
      );
    }

    const { supabase } = await assertOwnerAccess({
      request,
      locals,
      cookies,
    });

    const { employee, staffRole } =
      await getEmployeeContext(supabase, employeeId);

    const authUser = await getAuthUserById(
      supabase,
      staffRole?.user_id || employee.user_id,
    );

    return jsonResponse({
      success: true,
      portal: serializePortalState({
        employee,
        staffRole,
        authUser,
      }),
    });
  } catch (error: any) {
    console.error(
      '[opc/employees/portal-access] GET failed',
      error,
    );

    return jsonResponse(
      {
        success: false,
        error:
          error?.message ||
          'Portal-Zugang konnte nicht geladen werden.',
      },
      apiStatus(error),
    );
  }
};

export const POST: APIRoute = async ({
  request,
  locals,
  cookies,
  params,
}) => {
  try {
    const employeeId = cleanText(params.id);

    if (!employeeId) {
      return jsonResponse(
        { success: false, error: 'Mitarbeiter-ID fehlt.' },
        400,
      );
    }

    const { supabase, access } = await assertOwnerAccess({
      request,
      locals,
      cookies,
    });

    const body = safeObject(await request.json());
    const action =
      cleanText(body.action) || 'create_or_invite';

    const {
      employee,
      staffRole,
      isPrivileged,
    } = await getEmployeeContext(supabase, employeeId);

    if (isPrivileged) {
      return jsonResponse(
        {
          success: false,
          error:
            'Privilegierte Owner-/Admin-Konten werden rollenbasiert verwaltet und können hier nicht verändert werden.',
        },
        409,
      );
    }

    let existingAuthUser = await getAuthUserById(
      supabase,
      staffRole?.user_id || employee.user_id,
    );

    let loginEmail = normalizeEmail(
      body.loginEmail ||
      existingAuthUser?.email ||
      staffRole?.email ||
      employee.business_email ||
      employee.private_email,
    );

    if (!loginEmail) {
      return jsonResponse(
        {
          success: false,
          error:
            'Für den Portal-Zugang ist eine Login-E-Mail erforderlich.',
        },
        400,
      );
    }

    if (!existingAuthUser) {
      existingAuthUser = await findAuthUserByEmail(
        supabase,
        loginEmail,
      );
    }

    if (existingAuthUser) {
      await ensureNoUserConflict({
        supabase,
        authUser: existingAuthUser,
        employeeId,
      });
    }

    const canAccessPortal =
      typeof body.canAccessPortal === 'boolean'
        ? body.canAccessPortal
        : staffRole?.can_access_portal !== false;

    const permissions =
      body.permissions !== undefined
        ? permissionPatch(body.permissions)
        : staffRole
          ? permissionPatch(staffRole)
          : permissionPatch(defaultOpcEmployeePermissions());

    let emailResult = {
      authUser: existingAuthUser,
      inviteSent: false,
      accessEmailSent: false,
    };

    if (
      action === 'create_or_invite' ||
      action === 'send_access_email'
    ) {
      emailResult = await sendAccessEmail({
        supabase,
        request,
        authUser: existingAuthUser,
        loginEmail,
        employee,
      });
    }

    if (!emailResult.authUser) {
      const error = new Error(
        'Auth-Benutzer konnte nicht erstellt oder gefunden werden.',
      );
      (error as any).status = 500;
      throw error;
    }

    const persisted = await persistStaffAndProfile({
      supabase,
      access,
      employee,
      staffRole,
      authUser: emailResult.authUser,
      loginEmail,
      canAccessPortal,
      permissions,
      accessEmailSent: emailResult.accessEmailSent,
    });

    return jsonResponse({
      success: true,
      inviteSent: emailResult.inviteSent,
      accessEmailSent: emailResult.accessEmailSent,
      portal: serializePortalState({
        employee: {
          ...employee,
          user_id: persisted.authUser.id,
          staff_role_id: persisted.staffRole.id,
        },
        staffRole: persisted.staffRole,
        authUser: persisted.authUser,
      }),
    });
  } catch (error: any) {
    console.error(
      '[opc/employees/portal-access] POST failed',
      error,
    );

    return jsonResponse(
      {
        success: false,
        error:
          error?.message ||
          'Portal-Zugang konnte nicht erstellt werden.',
      },
      apiStatus(error),
    );
  }
};

export const PATCH: APIRoute = async ({
  request,
  locals,
  cookies,
  params,
}) => {
  try {
    const employeeId = cleanText(params.id);

    if (!employeeId) {
      return jsonResponse(
        { success: false, error: 'Mitarbeiter-ID fehlt.' },
        400,
      );
    }

    const { supabase, access } = await assertOwnerAccess({
      request,
      locals,
      cookies,
    });

    const body = safeObject(await request.json());

    const {
      employee,
      staffRole,
      isPrivileged,
    } = await getEmployeeContext(supabase, employeeId);

    if (isPrivileged) {
      return jsonResponse(
        {
          success: false,
          error:
            'Privilegierte Owner-/Admin-Konten werden rollenbasiert verwaltet und können hier nicht verändert werden.',
        },
        409,
      );
    }

    if (!staffRole?.id) {
      return jsonResponse(
        {
          success: false,
          error:
            'Für diesen Mitarbeiter existiert noch kein Portal-Zugang.',
        },
        409,
      );
    }

    const authUser = await getAuthUserById(
      supabase,
      staffRole.user_id || employee.user_id,
    );

    if (!authUser) {
      return jsonResponse(
        {
          success: false,
          error:
            'Der verknüpfte Auth-Benutzer konnte nicht gefunden werden.',
        },
        409,
      );
    }

    const canAccessPortal =
      typeof body.canAccessPortal === 'boolean'
        ? body.canAccessPortal
        : staffRole.can_access_portal !== false;

    const permissions =
      body.permissions !== undefined
        ? permissionPatch(body.permissions)
        : permissionPatch(staffRole);

    const persisted = await persistStaffAndProfile({
      supabase,
      access,
      employee,
      staffRole,
      authUser,
      loginEmail:
        String(authUser.email || staffRole.email || '').toLowerCase(),
      canAccessPortal,
      permissions,
      accessEmailSent: false,
    });

    return jsonResponse({
      success: true,
      portal: serializePortalState({
        employee,
        staffRole: persisted.staffRole,
        authUser: persisted.authUser,
      }),
    });
  } catch (error: any) {
    console.error(
      '[opc/employees/portal-access] PATCH failed',
      error,
    );

    return jsonResponse(
      {
        success: false,
        error:
          error?.message ||
          'Portal-Berechtigungen konnten nicht gespeichert werden.',
      },
      apiStatus(error),
    );
  }
};
