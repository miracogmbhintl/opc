-- Orange Pro Clean GmbH
-- Zero-downtime live Supabase audit
-- 2026-08-25
--
-- READ-ONLY: this file contains SELECT statements only.
-- It is designed to be pasted into the Supabase SQL editor against production.
-- Do not add UPDATE/DELETE/INSERT/ALTER statements to this audit file.

-- ============================================================================
-- 1. DATABASE IDENTITY / VERSION / TIMEZONE
-- ============================================================================
select
  current_database() as database_name,
  current_user as database_user,
  version() as postgres_version,
  current_setting('TimeZone') as database_timezone,
  now() as database_now,
  now() at time zone 'Europe/Zurich' as zurich_now;

-- ============================================================================
-- 2. OPC STAFF STATUS + ROLE/CAPABILITY DISTRIBUTION
-- ============================================================================
select
  lower(coalesce(status, '<null>')) as status,
  lower(coalesce(role, '<null>')) as role,
  count(*) as row_count,
  count(*) filter (where can_access_portal is true) as portal_enabled,
  count(*) filter (where can_submit_time_logs is true) as time_submit_enabled,
  count(*) filter (where can_view_all_jobs is true) as view_all_jobs_enabled,
  count(*) filter (where can_manage_jobs is true) as manage_jobs_enabled,
  count(*) filter (where can_manage_employees is true) as manage_employees_enabled,
  count(*) filter (where can_manage_reports is true) as manage_reports_enabled,
  count(*) filter (where can_manage_finance is true) as manage_finance_enabled
from public.opc_staff_roles
group by 1, 2
order by 1, 2;

-- Duplicate currently-valid staff-role rows by auth user.
select
  user_id,
  count(*) as active_role_rows,
  array_agg(id order by created_at desc) as staff_role_ids,
  array_agg(role order by created_at desc) as roles,
  array_agg(status order by created_at desc) as statuses,
  array_agg(email order by created_at desc) as emails
from public.opc_staff_roles
where lower(coalesce(status, 'active')) in ('active', 'aktiv', 'enabled')
  and coalesce(can_access_portal, true) is true
  and user_id is not null
group by user_id
having count(*) > 1
order by count(*) desc, user_id;

-- Duplicate currently-valid staff-role rows by email.
select
  lower(email) as email,
  count(*) as active_role_rows,
  array_agg(id order by created_at desc) as staff_role_ids,
  array_agg(user_id order by created_at desc) as user_ids,
  array_agg(role order by created_at desc) as roles
from public.opc_staff_roles
where lower(coalesce(status, 'active')) in ('active', 'aktiv', 'enabled')
  and coalesce(can_access_portal, true) is true
  and nullif(trim(email), '') is not null
group by lower(email)
having count(*) > 1
order by count(*) desc, lower(email);

-- Full capability snapshot for active/compatible staff rows.
select
  id,
  user_id,
  employee_id,
  display_name,
  email,
  role,
  status,
  can_access_portal,
  can_submit_time_logs,
  can_view_assigned_jobs,
  can_view_all_jobs,
  can_manage_jobs,
  can_manage_employees,
  can_manage_reports,
  can_manage_finance
from public.opc_staff_roles
where lower(coalesce(status, 'active')) in ('active', 'aktiv', 'enabled')
order by lower(coalesce(role, '')), lower(coalesce(display_name, email, ''));

-- ============================================================================
-- 3. AUTHORITATIVE TABLE COLUMNS (detect schema drift safely)
-- ============================================================================
select
  table_schema,
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema in ('public', 'storage')
  and table_name in (
    'opc_staff_roles',
    'user_profiles',
    'opc_employees',
    'employees',
    'opc_employee_time_entries',
    'opc_service_jobs',
    'opc_job_assignments',
    'opc_job_reports',
    'opc_recurring_job_series',
    'opc_site_inspections',
    'opc_site_inspection_media',
    'opc_site_inspection_media_trash',
    'opc_clients',
    'opc_contacts',
    'opc_client_sites',
    'opc_client_contact_links',
    'opc_client_users',
    'opc_tickets',
    'opc_quotes',
    'opc_invoices',
    'opc_documents',
    'opc_document_versions',
    'objects',
    'buckets'
  )
order by table_schema, table_name, ordinal_position;

-- ============================================================================
-- 4. CRITICAL TIME-TRACKING RPC DEFINITIONS
-- ============================================================================
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_function_result(p.oid) as result_type,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  pg_get_userbyid(p.proowner) as owner,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'opc_clock_in_employee',
    'opc_clock_out_employee',
    'opc_start_employee_break',
    'opc_end_employee_break',
    'opc_approve_employee_time_entry',
    'opc_reject_employee_time_entry',
    'opc_get_team_time_presence'
  )
order by p.proname, pg_get_function_identity_arguments(p.oid);

-- Function EXECUTE grants for the same critical RPCs.
select
  routine_schema,
  routine_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
    'opc_clock_in_employee',
    'opc_clock_out_employee',
    'opc_start_employee_break',
    'opc_end_employee_break',
    'opc_approve_employee_time_entry',
    'opc_reject_employee_time_entry',
    'opc_get_team_time_presence'
  )
order by routine_name, grantee;

-- ============================================================================
-- 5. TIME-TRACKING DATA INTEGRITY
-- ============================================================================
select
  lower(coalesce(status, '<null>')) as status,
  count(*) as row_count,
  min(work_date) as earliest_work_date,
  max(work_date) as latest_work_date
from public.opc_employee_time_entries
group by 1
order by 1;

-- More than one currently-open time entry for a user is a critical integrity issue.
select
  user_id,
  count(*) as open_entry_count,
  array_agg(id order by clock_in_at desc nulls last) as entry_ids,
  array_agg(status order by clock_in_at desc nulls last) as statuses,
  min(clock_in_at) as earliest_open_clock_in,
  max(clock_in_at) as latest_open_clock_in
from public.opc_employee_time_entries
where clock_out_at is null
  and lower(coalesce(status, 'open')) in (
    'open', 'on_break', 'active', 'clocked_in', 'started', 'running', 'in_progress'
  )
group by user_id
having count(*) > 1
order by count(*) desc, user_id;

-- Open entries belonging to staff rows that are no longer currently usable.
select
  e.id as time_entry_id,
  e.user_id,
  e.staff_role_id,
  e.employee_id,
  e.work_date,
  e.clock_in_at,
  e.status as time_status,
  s.role as staff_role,
  s.status as staff_status,
  s.can_access_portal,
  s.can_submit_time_logs
from public.opc_employee_time_entries e
left join public.opc_staff_roles s
  on s.id = e.staff_role_id
  or (s.user_id is not null and s.user_id = e.user_id)
where e.clock_out_at is null
  and lower(coalesce(e.status, 'open')) in (
    'open', 'on_break', 'active', 'clocked_in', 'started', 'running', 'in_progress'
  )
  and (
    s.id is null
    or lower(coalesce(s.status, '')) not in ('active', 'aktiv', 'enabled')
    or coalesce(s.can_access_portal, false) is false
    or coalesce(s.can_submit_time_logs, false) is false
  )
order by e.clock_in_at;

-- ============================================================================
-- 6. RLS POLICIES FOR CRITICAL TABLES + STORAGE
-- ============================================================================
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where (schemaname = 'public' and tablename in (
    'opc_staff_roles',
    'opc_employee_time_entries',
    'opc_service_jobs',
    'opc_job_assignments',
    'opc_job_reports',
    'opc_site_inspections',
    'opc_site_inspection_media',
    'opc_clients',
    'opc_contacts',
    'opc_client_sites',
    'opc_client_contact_links',
    'opc_client_users',
    'opc_tickets',
    'opc_quotes',
    'opc_invoices',
    'opc_documents',
    'opc_document_versions'
  ))
  or (schemaname = 'storage' and tablename in ('objects', 'buckets'))
order by schemaname, tablename, policyname;

-- RLS enabled/forced flags.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p')
  and (
    (n.nspname = 'public' and c.relname like 'opc_%')
    or (n.nspname = 'storage' and c.relname in ('objects', 'buckets'))
  )
order by n.nspname, c.relname;

-- ============================================================================
-- 7. TRIGGERS ON CRITICAL TABLES
-- ============================================================================
select
  event_object_schema as table_schema,
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation,
  action_orientation,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in (
    'opc_staff_roles',
    'opc_employee_time_entries',
    'opc_service_jobs',
    'opc_job_assignments',
    'opc_job_reports',
    'opc_site_inspections',
    'opc_site_inspection_media',
    'opc_clients',
    'opc_contacts',
    'opc_client_sites',
    'opc_client_contact_links',
    'opc_quotes',
    'opc_invoices',
    'opc_documents',
    'opc_document_versions'
  )
order by event_object_table, trigger_name, event_manipulation;

-- ============================================================================
-- 8. CONSTRAINTS
-- ============================================================================
select
  n.nspname as schema_name,
  c.relname as table_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'opc_staff_roles',
    'opc_employee_time_entries',
    'opc_service_jobs',
    'opc_job_assignments',
    'opc_job_reports',
    'opc_site_inspection_media',
    'opc_clients',
    'opc_contacts',
    'opc_client_sites',
    'opc_client_contact_links',
    'opc_quotes',
    'opc_invoices',
    'opc_documents',
    'opc_document_versions'
  )
order by c.relname, con.conname;

-- ============================================================================
-- 9. INDEXES
-- ============================================================================
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'opc_staff_roles',
    'opc_employee_time_entries',
    'opc_service_jobs',
    'opc_job_assignments',
    'opc_job_reports',
    'opc_site_inspection_media',
    'opc_clients',
    'opc_contacts',
    'opc_client_sites',
    'opc_client_contact_links',
    'opc_quotes',
    'opc_invoices',
    'opc_documents',
    'opc_document_versions'
  )
order by tablename, indexname;

-- ============================================================================
-- 10. INSPECTION MEDIA RETRY / IDEMPOTENCY AUDIT
-- ============================================================================
select
  count(*) as total_media_rows,
  count(*) filter (where metadata ? 'upload_token') as rows_with_upload_token,
  count(*) filter (where object_path ~ '/opc-[^/]+-') as rows_with_tokenized_object_path
from public.opc_site_inspection_media;

select
  inspection_id,
  uploaded_by,
  metadata ->> 'upload_token' as upload_token,
  count(*) as row_count,
  array_agg(id order by created_at) as media_ids
from public.opc_site_inspection_media
where nullif(metadata ->> 'upload_token', '') is not null
group by inspection_id, uploaded_by, metadata ->> 'upload_token'
having count(*) > 1
order by count(*) desc;

-- ============================================================================
-- 11. SERVICE-JOB SCHEMA / RECURRENCE LINK INTEGRITY
-- ============================================================================
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'opc_service_jobs'
  and column_name in (
    'planned_start',
    'planned_end',
    'recurring_series_id',
    'occurrence_date',
    'occurrence_key',
    'series_version',
    'quote_id',
    'order_confirmation_id',
    'billing_status',
    'invoice_id'
  )
order by column_name;

-- Jobs missing an assignment despite having moved into an operational status.
select
  j.id,
  j.client_id,
  j.client_site_id,
  j.title,
  j.status,
  j.planned_start,
  count(a.id) as assignment_count
from public.opc_service_jobs j
left join public.opc_job_assignments a on a.job_id = j.id
where lower(coalesce(j.status, '')) in (
  'assigned', 'confirmed', 'on_site', 'onsite', 'in_progress', 'started', 'running'
)
group by j.id, j.client_id, j.client_site_id, j.title, j.status, j.planned_start
having count(a.id) = 0
order by j.planned_start desc nulls last;

-- Jobs missing report shell rows, where the application expects report creation.
select
  j.id,
  j.client_id,
  j.title,
  j.status,
  j.planned_start,
  count(r.id) as report_count
from public.opc_service_jobs j
left join public.opc_job_reports r on r.job_id = j.id
where lower(coalesce(j.status, '')) not in ('cancelled', 'canceled', 'draft')
group by j.id, j.client_id, j.title, j.status, j.planned_start
having count(r.id) = 0
order by j.planned_start desc nulls last;

-- ============================================================================
-- 12. CLIENT-CREATION PARTIAL-STATE AUDIT
-- ============================================================================
-- Clients without a primary site.
select
  c.id as client_id,
  c.contact_id,
  c.billing_name,
  c.billing_email,
  c.status,
  c.created_at,
  count(s.id) as site_count,
  count(s.id) filter (where s.is_primary is true) as primary_site_count
from public.opc_clients c
left join public.opc_client_sites s on s.client_id = c.id
group by c.id, c.contact_id, c.billing_name, c.billing_email, c.status, c.created_at
having count(s.id) = 0 or count(s.id) filter (where s.is_primary is true) = 0
order by c.created_at desc;

-- Clients whose contact_id has no corresponding client-contact link.
select
  c.id as client_id,
  c.contact_id,
  c.billing_name,
  c.billing_email,
  c.created_at
from public.opc_clients c
left join public.opc_client_contact_links l
  on l.client_id = c.id
 and l.contact_id = c.contact_id
where c.contact_id is not null
  and l.client_id is null
order by c.created_at desc;

-- Potential duplicate clients by normalized email.
select
  lower(trim(billing_email)) as billing_email,
  count(*) as client_count,
  array_agg(id order by created_at) as client_ids,
  array_agg(billing_name order by created_at) as billing_names
from public.opc_clients
where nullif(trim(billing_email), '') is not null
group by lower(trim(billing_email))
having count(*) > 1
order by count(*) desc, lower(trim(billing_email));

-- ============================================================================
-- 13. DOCUMENT STORAGE / VERSION INTEGRITY
-- ============================================================================
select
  d.id as document_id,
  d.client_id,
  d.title,
  d.status,
  d.created_at,
  count(v.id) as version_count
from public.opc_documents d
left join public.opc_document_versions v on v.document_id = d.id
group by d.id, d.client_id, d.title, d.status, d.created_at
having count(v.id) = 0
order by d.created_at desc;

-- Private document versions whose bucket/object path is incomplete.
select
  id,
  document_id,
  bucket_id,
  object_path,
  created_at
from public.opc_document_versions
where nullif(trim(coalesce(bucket_id, '')), '') is null
   or nullif(trim(coalesce(object_path, '')), '') is null
order by created_at desc;

-- ============================================================================
-- 14. TABLE PRIVILEGES
-- ============================================================================
select
  table_schema,
  table_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema in ('public', 'storage')
  and (
    (table_schema = 'public' and table_name like 'opc_%')
    or (table_schema = 'storage' and table_name in ('objects', 'buckets'))
  )
  and grantee in ('anon', 'authenticated', 'service_role', 'public')
order by table_schema, table_name, grantee, privilege_type;

-- ============================================================================
-- 15. END-OF-AUDIT COUNTS
-- ============================================================================
select
  (select count(*) from public.opc_staff_roles) as staff_roles,
  (select count(*) from public.opc_employee_time_entries) as time_entries,
  (select count(*) from public.opc_service_jobs) as service_jobs,
  (select count(*) from public.opc_job_assignments) as job_assignments,
  (select count(*) from public.opc_site_inspection_media) as inspection_media,
  (select count(*) from public.opc_clients) as clients,
  (select count(*) from public.opc_documents) as documents,
  now() as audit_completed_at;
