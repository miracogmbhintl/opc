-- Orange Pro Clean GmbH
-- Lock down internal audit/migration tables and anonymous SECURITY DEFINER mutators.
-- This intentionally preserves authenticated grants, but RLS limits the listed
-- internal tables to Owner/Admin/Dispatch so active operational users are not
-- globally blocked by a blanket privilege revoke.

begin;

-- Anonymous users must never be able to execute state-changing SECURITY DEFINER
-- functions. Read-only public helpers are intentionally left untouched.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
      and (p.proname like 'opc\_%' escape '\\' or p.proname = 'create_job_storage_link')
      and p.prosrc ~* '(^|[^a-z])(insert|update|delete|truncate)([^a-z]|$)'
  loop
    execute format('revoke execute on function %s from public, anon', r.signature);
  end loop;
end
$$;

-- Backup/staging/review/mapping tables discovered by the live audit were exposed
-- with broad anonymous CRUD and RLS disabled. Enable RLS and allow only active
-- operational management roles through the normal authenticated client.
do $$
declare
  t text;
  tables text[] := array[
    'opc_time_backup_20260728_excel_v3',
    'opc_archive_client_links',
    'opc_archive_document_live_migration_map',
    'opc_backup_calendar_events_wrong_time_20260613_0120_0125',
    'opc_backup_delete_fitness_muehlematt_20260613_assignments',
    'opc_backup_delete_fitness_muehlematt_20260613_calendar_attendee',
    'opc_backup_delete_fitness_muehlematt_20260613_calendar_events',
    'opc_backup_delete_fitness_muehlematt_20260613_damage_reports',
    'opc_backup_delete_fitness_muehlematt_20260613_jobs',
    'opc_backup_delete_fitness_muehlematt_20260613_media',
    'opc_backup_delete_fitness_muehlematt_20260613_time_logs',
    'opc_backup_jobs_wrong_time_20260613_0120_0125',
    'opc_clients_backup_before_archive_enrichment_20260616',
    'opc_contact_enrichment_review_stage',
    'opc_contact_sync_review_stage',
    'opc_contacts_backup_before_archive_enrichment_20260616',
    'opc_customer_documents_duplicate_cleanup_backup_20260615',
    'opc_document_import_stage',
    'opc_document_sync_review_stage',
    'opc_employee_name_mappings',
    'opc_employee_payroll_profiles_backup_20260728_excel_abzuege_v1',
    'opc_employee_time_entries_backup_excel_20260624',
    'opc_google_calendar_import_candidates',
    'opc_google_employee_mappings',
    'opc_google_series_assignment_mappings',
    'opc_google_site_mappings',
    'opc_invoice_items_backup_before_archive_enrichment_20260616',
    'opc_invoice_items_backup_before_archive_live_migration_20260616',
    'opc_invoices_backup_before_archive_enrichment_20260616',
    'opc_invoices_backup_before_archive_live_migration_20260616',
    'opc_migration_backup_tc_frick_20260701',
    'opc_migration_backup_update_fitness_20260701',
    'opc_missing_email_client_review',
    'opc_missing_email_review',
    'opc_quote_items_backup_before_archive_enrichment_20260616',
    'opc_quote_items_backup_before_archive_live_migration_20260616',
    'opc_quotes_backup_before_archive_enrichment_20260616',
    'opc_quotes_backup_before_archive_live_migration_20260616'
  ];
begin
  foreach t in array tables loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon', t);
    execute format('drop policy if exists opc_internal_management_access on public.%I', t);
    execute format(
      'create policy opc_internal_management_access on public.%I for all to authenticated using (public.opc_is_owner_admin_dispatch()) with check (public.opc_is_owner_admin_dispatch())',
      t
    );
  end loop;
end
$$;

-- Future closed time entries must not retain a live break marker. Historical
-- rows are deliberately not rewritten because some are already payroll-relevant.
create or replace function public.opc_clear_break_marker_on_closed_time_entry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.clock_out_at is not null then
    new.break_started_at := null;
  end if;
  return new;
end
$$;

drop trigger if exists trg_opc_clear_break_marker_on_closed_time_entry on public.opc_employee_time_entries;
create trigger trg_opc_clear_break_marker_on_closed_time_entry
before insert or update of clock_out_at, break_started_at
on public.opc_employee_time_entries
for each row execute function public.opc_clear_break_marker_on_closed_time_entry();

commit;
