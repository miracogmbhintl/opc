import type { SupabaseClient, User } from '@supabase/supabase-js';

type JsonRecord = Record<string, any>;

export type OpcAssignmentCandidate = {
  id: string;
  source: 'employee';
  employee_id: string;
  staff_role_id: string | null;
  user_id: string | null;
  employee_number: string | null;
  display_name: string;
  email: string | null;
  phone_e164: string | null;
  phone_raw: string | null;
  whatsapp_wa_id: string | null;
  role: string;
  status: string | null;
  assignment_status: string | null;
};

const BLOCKED_EMPLOYEE_STATUSES = new Set([
  'suspended',
  'inactive',
  'terminated',
  'offboarded',
  'archived',
  'deleted',
  'blocked',
]);

const BLOCKED_ASSIGNMENT_STATUSES = new Set([
  'unavailable',
  'inactive',
  'suspended',
  'blocked',
  'deleted',
]);

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizeOpcAssignmentRole(value: unknown) {
  const role = normalize(value);

  if (['godmode', 'superadmin', 'super_admin', 'owner', 'inhaber'].includes(role)) {
    return 'owner';
  }

  if (['dispatch', 'dispatcher', 'disposition'].includes(role)) {
    return 'dispatch';
  }

  if (['admin', 'administrator'].includes(role)) {
    return 'admin';
  }

  if (['employee', 'mitarbeiter', 'cleaner', 'reinigung'].includes(role)) {
    return 'employee';
  }

  if (['client', 'kunde', 'customer'].includes(role)) {
    return 'client';
  }

  return role;
}

function effectiveRole(authRole: unknown, staffRole: unknown) {
  const roles = [authRole, staffRole]
    .map(normalizeOpcAssignmentRole)
    .filter(Boolean);

  if (roles.includes('owner')) return 'owner';
  if (roles.includes('dispatch')) return 'dispatch';
  if (roles.includes('client')) return 'client';
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('employee')) return 'employee';

  // A row in opc_employees is an operational employee unless an explicit
  // access role says otherwise.
  return roles[0] || 'employee';
}

function isActiveStaffRow(row: JsonRecord | null | undefined) {
  const status = normalize(row?.status);
  return !status || ['active', 'aktiv', 'enabled'].includes(status);
}

function isAssignableCandidate(candidate: OpcAssignmentCandidate) {
  const role = normalizeOpcAssignmentRole(candidate.role);
  const employeeStatus = normalize(candidate.status);
  const assignmentStatus = normalize(candidate.assignment_status);

  if (['owner', 'dispatch', 'client'].includes(role)) return false;
  if (BLOCKED_EMPLOYEE_STATUSES.has(employeeStatus)) return false;
  if (BLOCKED_ASSIGNMENT_STATUSES.has(assignmentStatus)) return false;

  return true;
}

async function listAllAuthUsers(adminClient: SupabaseClient) {
  const users: User[] = [];
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw new Error(`Auth-Benutzer konnten nicht geladen werden: ${error.message}`);
    }

    const rows = Array.isArray(data?.users) ? data.users : [];
    users.push(...rows);

    if (rows.length < perPage) break;
    page += 1;
  }

  return users;
}

function chooseStaffRow(rows: JsonRecord[]) {
  return rows.find(isActiveStaffRow) || null;
}

export async function loadOpcAssignmentCandidates(
  adminClient: SupabaseClient,
): Promise<OpcAssignmentCandidate[]> {
  const [employeeResponse, staffResponse, authUsers] = await Promise.all([
    adminClient
      .from('opc_employees')
      .select(
        'id,user_id,staff_role_id,employee_number,legal_first_name,legal_last_name,preferred_name,business_email,private_email,phone_e164,phone_raw,status,assignment_status',
      )
      .order('legal_last_name', { ascending: true }),
    adminClient
      .from('opc_staff_roles')
      .select(
        'id,user_id,employee_id,display_name,email,phone_e164,phone_raw,whatsapp_wa_id,role,status,created_at',
      )
      .order('created_at', { ascending: false }),
    listAllAuthUsers(adminClient),
  ]);

  if (employeeResponse.error) {
    throw new Error(`Mitarbeiter konnten nicht geladen werden: ${employeeResponse.error.message}`);
  }

  if (staffResponse.error) {
    throw new Error(`Portalrollen konnten nicht geladen werden: ${staffResponse.error.message}`);
  }

  const employees = (employeeResponse.data || []) as JsonRecord[];
  const staffRows = (staffResponse.data || []) as JsonRecord[];
  const authById = new Map<string, User>(
    authUsers.map((user): [string, User] => [String(user.id), user]),
  );
  const staffById = new Map(staffRows.map((row) => [String(row.id), row]));
  const staffByUserId = new Map<string, JsonRecord[]>();

  staffRows.forEach((row) => {
    if (!row.user_id) return;
    const key = String(row.user_id);
    const current = staffByUserId.get(key) || [];
    current.push(row);
    staffByUserId.set(key, current);
  });

  return employees
    .map((employee): OpcAssignmentCandidate | null => {
      if (!employee.id) return null;

      const userId = employee.user_id ? String(employee.user_id) : null;
      const linkedStaff = employee.staff_role_id
        ? staffById.get(String(employee.staff_role_id)) || null
        : null;
      const userStaff = userId
        ? chooseStaffRow(staffByUserId.get(userId) || [])
        : null;
      const staff =
        (linkedStaff && isActiveStaffRow(linkedStaff) ? linkedStaff : null) ||
        userStaff ||
        null;
      const authUser = userId ? authById.get(userId) || null : null;
      const authRole =
        authUser?.app_metadata?.role ||
        authUser?.app_metadata?.app_role ||
        null;
      const role = effectiveRole(authRole, staff?.role);
      const displayName =
        String(employee.preferred_name || '').trim() ||
        [employee.legal_first_name, employee.legal_last_name]
          .map((part) => String(part || '').trim())
          .filter(Boolean)
          .join(' ') ||
        String(staff?.display_name || '').trim() ||
        String(employee.business_email || employee.private_email || staff?.email || authUser?.email || '').trim() ||
        `Mitarbeiter ${employee.employee_number || employee.id}`;

      return {
        id: String(employee.id),
        source: 'employee',
        employee_id: String(employee.id),
        staff_role_id: staff?.id ? String(staff.id) : null,
        user_id: userId,
        employee_number: employee.employee_number ? String(employee.employee_number) : null,
        display_name: displayName,
        email:
          employee.business_email ||
          employee.private_email ||
          staff?.email ||
          authUser?.email ||
          null,
        phone_e164: employee.phone_e164 || staff?.phone_e164 || null,
        phone_raw: employee.phone_raw || staff?.phone_raw || null,
        whatsapp_wa_id:
          staff?.whatsapp_wa_id || employee.phone_e164 || employee.phone_raw || null,
        role,
        status: employee.status || null,
        assignment_status: employee.assignment_status || null,
      };
    })
    .filter((candidate): candidate is OpcAssignmentCandidate => Boolean(candidate))
    .filter(isAssignableCandidate)
    .sort((a, b) => a.display_name.localeCompare(b.display_name, 'de'));
}

export async function resolveOpcAssignmentCandidates(
  adminClient: SupabaseClient,
  identifiers: string[],
) {
  const requested = identifiers.map(String).filter(Boolean);
  if (requested.length === 0) return [];

  const candidates = await loadOpcAssignmentCandidates(adminClient);
  const candidateByIdentifier = new Map<string, OpcAssignmentCandidate>();

  candidates.forEach((candidate) => {
    [
      candidate.id,
      candidate.employee_id,
      candidate.staff_role_id,
      candidate.user_id,
    ]
      .filter(Boolean)
      .forEach((identifier) => {
        candidateByIdentifier.set(String(identifier), candidate);
      });
  });

  const resolved: OpcAssignmentCandidate[] = [];
  const seen = new Set<string>();

  requested.forEach((identifier) => {
    const candidate = candidateByIdentifier.get(identifier);
    if (!candidate || seen.has(candidate.id)) return;
    seen.add(candidate.id);
    resolved.push(candidate);
  });

  return resolved;
}
