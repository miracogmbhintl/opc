begin;

create or replace function public.opc_is_active_portal_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.opc_staff_roles s
    where s.user_id = auth.uid()
      and s.status in ('active','aktiv','enabled')
      and coalesce(s.can_access_portal, true) = true
      and lower(coalesce(s.role,'')) not in ('client','kunde')
  );
$$;

revoke all on function public.opc_is_active_portal_staff() from public, anon;
grant execute on function public.opc_is_active_portal_staff() to authenticated;

-- Work OS currently has one application-level access class: active OPC staff.
-- The API middleware enforces the same boundary. These policies make that rule
-- reproducible at the database layer instead of relying on an unknown live RLS
-- configuration.
do $$
declare
  v_table text;
  v_tables text[] := array[
    'work_os_workspaces',
    'work_os_boards',
    'work_os_groups',
    'work_os_tasks',
    'work_os_comments',
    'work_os_activity_log'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass('public.' || v_table) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', v_table);
    execute format('drop policy if exists %I on public.%I', v_table || '_opc_staff_all_v1', v_table);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.opc_is_active_portal_staff()) with check (public.opc_is_active_portal_staff())',
      v_table || '_opc_staff_all_v1',
      v_table
    );

    -- RLS is authoritative; grants merely permit the operation to reach policy evaluation.
    execute format('grant select, insert, update, delete on public.%I to authenticated', v_table);
    execute format('revoke all on public.%I from anon', v_table);
  end loop;
end
$$;

commit;
