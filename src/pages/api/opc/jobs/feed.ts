import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

type AnyRow = Record<string, any>;

function getSupabaseUrl() {
  const value =
    import.meta.env.PUBLIC_SUPABASE_URL ||
    import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.SUPABASE_URL;

  if (!value) throw new Error('Missing Supabase URL.');
  return value;
}

function getAnonKey() {
  const value =
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.SUPABASE_ANON_KEY;

  if (!value) throw new Error('Missing Supabase anon key.');
  return value;
}

function getServiceKey() {
  const value =
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY ||
    import.meta.env.SUPABASE_SERVICE_KEY ||
    import.meta.env.SERVICE_ROLE_KEY;

  if (!value) throw new Error('Missing Supabase service role key.');
  return value;
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');

  if (header?.toLowerCase().startsWith('bearer ')) {
    return header.slice(7);
  }

  return null;
}

function createUserSupabase(request: Request) {
  const token = getBearerToken(request);

  return createClient(getSupabaseUrl(), getAnonKey(), {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function createServiceSupabase() {
  return createClient(getSupabaseUrl(), getServiceKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeRole(value: unknown): string {
  const role = String(value || '').toLowerCase().trim();

  if (role === 'owner') return 'owner';
  if (role === 'admin') return 'admin';
  if (role === 'dispatch' || role === 'dispatcher' || role === 'disposition') return 'dispatch';
  if (role === 'employee' || role === 'mitarbeiter') return 'employee';
  if (role === 'client' || role === 'kunde') return 'client';

  return 'client';
}

function isAdminRole(role: string) {
  return ['owner', 'admin', 'dispatch'].includes(normalizeRole(role));
}

function chooseEffectiveRole(staffRows: AnyRow[], profileRole: string) {
  const activeRows = staffRows.filter(
    (row) => String(row.status || 'active').toLowerCase() === 'active'
  );

  if (activeRows.some((row) => normalizeRole(row.role) === 'owner')) return 'owner';
  if (activeRows.some((row) => normalizeRole(row.role) === 'admin')) return 'admin';
  if (activeRows.some((row) => normalizeRole(row.role) === 'dispatch')) return 'dispatch';
  if (activeRows.some((row) => normalizeRole(row.role) === 'employee')) return 'employee';

  return profileRole;
}

async function fetchAllRows(
  buildQuery: (from: number, to: number) => any,
  pageSize = 1000
) {
  const rows: AnyRow[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const result = await buildQuery(from, to);

    if (result.error) throw result.error;

    const page = result.data || [];
    rows.push(...page);

    if (page.length < pageSize) break;

    from += pageSize;
  }

  return rows;
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean).map(String)));
}

function chunk<T>(items: T[], size = 500) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function resolveCurrentUserContext(
  serviceSupabase: ReturnType<typeof createClient>,
  userId: string
) {
  const { data: profile } = await serviceSupabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  const profileRole = normalizeRole(
    profile?.role || profile?.opc_staff_role || profile?.staff_role || profile?.position
  );

  const { data: staffRoles } = await serviceSupabase
    .from('opc_staff_roles')
    .select('*')
    .eq('user_id', userId);

  const activeStaffRoleRows = (staffRoles || []).filter(
    (row: AnyRow) => String(row.status || 'active').toLowerCase() === 'active'
  );

  const currentRole = chooseEffectiveRole(activeStaffRoleRows, profileRole);

  const staffRoleIds = uniqueValues(activeStaffRoleRows.map((row: AnyRow) => row.id));
  const employeeIds = uniqueValues(activeStaffRoleRows.map((row: AnyRow) => row.employee_id));

  const canViewAllJobs =
    isAdminRole(currentRole) ||
    activeStaffRoleRows.some(
      (row: AnyRow) => row.can_view_all_jobs === true || row.can_manage_jobs === true
    );

  const canViewAssignedJobs =
    canViewAllJobs ||
    activeStaffRoleRows.some((row: AnyRow) => row.can_view_assigned_jobs === true);

  return {
    currentRole,
    staffRoleIds,
    employeeIds,
    canViewAllJobs,
    canViewAssignedJobs,
  };
}

async function fetchAssignedJobIds(
  serviceSupabase: ReturnType<typeof createClient>,
  employeeIds: string[]
) {
  if (employeeIds.length === 0) return [];

  const jobIds = new Set<string>();

  for (const employeeIdChunk of chunk(employeeIds, 100)) {
    const rows = await fetchAllRows((from, to) =>
      serviceSupabase
        .from('opc_job_assignments')
        .select('job_id')
        .in('employee_id', employeeIdChunk)
        .not('job_id', 'is', null)
        .range(from, to)
    );

    rows.forEach((row) => {
      if (row.job_id) jobIds.add(String(row.job_id));
    });
  }

  return Array.from(jobIds);
}

async function fetchJobsByIds(
  serviceSupabase: ReturnType<typeof createClient>,
  jobIds: string[]
) {
  const jobs: AnyRow[] = [];

  for (const idChunk of chunk(jobIds, 300)) {
    const rows = await fetchAllRows((from, to) =>
      serviceSupabase
        .from('opc_service_jobs')
        .select('*')
        .in('id', idChunk)
        .order('planned_start', { ascending: true, nullsFirst: false })
        .range(from, to)
    );

    jobs.push(...rows);
  }

  return jobs;
}

async function fetchAllVisibleJobs(
  serviceSupabase: ReturnType<typeof createClient>,
  fromIso: string,
  toIso: string
) {
  return fetchAllRows((from, to) =>
    serviceSupabase
      .from('opc_service_jobs')
      .select('*')
      .or(`planned_start.is.null,planned_start.lte.${toIso}`)
      .or(`planned_end.is.null,planned_end.gte.${fromIso}`)
      .order('planned_start', { ascending: true, nullsFirst: false })
      .range(from, to)
  );
}

async function fetchLookupById(
  serviceSupabase: ReturnType<typeof createClient>,
  table: string,
  ids: string[],
  select: string
) {
  const map = new Map<string, AnyRow>();

  for (const idChunk of chunk(ids, 300)) {
    const { data, error } = await serviceSupabase
      .from(table)
      .select(select)
      .in('id', idChunk);

    if (error) throw error;

    (data || []).forEach((row: AnyRow) => {
      if (row.id) map.set(String(row.id), row);
    });
  }

  return map;
}

function flattenJob(
  job: AnyRow,
  siteMap: Map<string, AnyRow>,
  clientMap: Map<string, AnyRow>,
  contactMap: Map<string, AnyRow>
) {
  const site = job.client_site_id ? siteMap.get(String(job.client_site_id)) : null;
  const client = job.client_id ? clientMap.get(String(job.client_id)) : null;
  const contactId = job.contact_id || client?.contact_id || site?.contact_id || null;
  const contact = contactId ? contactMap.get(String(contactId)) : null;

  return {
    ...job,
    job_id: job.id,
    client_name:
      client?.billing_name ||
      client?.company_name ||
      contact?.company_name ||
      contact?.full_name ||
      'Ohne Kunde',
    billing_name: client?.billing_name || null,
    company_name: client?.company_name || contact?.company_name || null,
    full_name: contact?.full_name || null,
    email: contact?.email || client?.billing_email || null,
    phone_raw: contact?.phone_raw || client?.billing_phone_e164 || null,
    phone_e164: contact?.phone_e164 || client?.billing_phone_e164 || null,
    site_name: site?.site_name || null,
    site_address: site?.address_text || null,
    address_text: site?.address_text || null,
    site_city: site?.city || null,
    city: site?.city || null,
    postal_code: site?.postal_code || null,
    country: site?.country || null,
    access_notes: site?.access_notes || null,
    cleaning_notes: site?.cleaning_notes || null,
    billing_notes: site?.billing_notes || null,
    report_status: job.report_approved ? 'report_approved' : job.status,
  };
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const userSupabase = createUserSupabase(request);
    const serviceSupabase = createServiceSupabase();

    const {
      data: { user },
      error: userError,
    } = await userSupabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
      });
    }

    const context = await resolveCurrentUserContext(serviceSupabase, user.id);

    const now = new Date();
    const fromIso = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 90).toISOString();
    const toIso = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 400).toISOString();

    let jobs: AnyRow[] = [];

    if (context.canViewAllJobs || isAdminRole(context.currentRole)) {
      jobs = await fetchAllVisibleJobs(serviceSupabase, fromIso, toIso);
    } else if (
      normalizeRole(context.currentRole) === 'employee' &&
      context.canViewAssignedJobs &&
      context.employeeIds.length > 0
    ) {
      const assignedJobIds = await fetchAssignedJobIds(serviceSupabase, context.employeeIds);
      jobs = assignedJobIds.length > 0 ? await fetchJobsByIds(serviceSupabase, assignedJobIds) : [];

      jobs = jobs.filter((job) => {
        if (!job.planned_start && !job.planned_end) return true;

        const start = job.planned_start ? new Date(job.planned_start).getTime() : null;
        const end = job.planned_end ? new Date(job.planned_end).getTime() : null;
        const from = new Date(fromIso).getTime();
        const to = new Date(toIso).getTime();

        return (start === null || start <= to) && (end === null || end >= from);
      });
    } else {
      jobs = [];
    }

    const siteIds = uniqueValues(jobs.map((job) => job.client_site_id));
    const clientIds = uniqueValues(jobs.map((job) => job.client_id));
    const contactIdsFromJobs = uniqueValues(jobs.map((job) => job.contact_id));

    const [siteMap, clientMap] = await Promise.all([
      fetchLookupById(
        serviceSupabase,
        'opc_client_sites',
        siteIds,
        '*'
      ),
      fetchLookupById(
        serviceSupabase,
        'opc_clients',
        clientIds,
        '*'
      ),
    ]);

    const contactIdsFromClients = uniqueValues(
      Array.from(clientMap.values()).map((client) => client.contact_id)
    );
    const contactIdsFromSites = uniqueValues(
      Array.from(siteMap.values()).map((site) => site.contact_id)
    );

    const contactIds = uniqueValues([
      ...contactIdsFromJobs,
      ...contactIdsFromClients,
      ...contactIdsFromSites,
    ]);

    const contactMap = await fetchLookupById(
      serviceSupabase,
      'opc_contacts',
      contactIds,
      '*'
    );

    const flatJobs = jobs
      .map((job) => flattenJob(job, siteMap, clientMap, contactMap))
      .sort((a, b) => {
        const aTime = a.planned_start ? new Date(a.planned_start).getTime() : 0;
        const bTime = b.planned_start ? new Date(b.planned_start).getTime() : 0;
        return aTime - bTime;
      });

    return new Response(
      JSON.stringify({
        jobs: flatJobs,
        currentRole: context.currentRole,
        currentEmployeeIds: context.employeeIds,
        canViewAllJobs: context.canViewAllJobs,
        canViewAssignedJobs: context.canViewAssignedJobs,
      }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[opc/jobs/feed] failed', error);

    return new Response(
      JSON.stringify({
        error:
          error?.message ||
          error?.details ||
          error?.hint ||
          error?.code ||
          'Jobs could not be loaded.',
        details: error,
      }),
      { status: 500 }
    );
  }
};
