-- OPC owner promotion + HR permission consistency
-- opc_staff_roles is the authoritative access source.

begin;

-- Sara Batista: promote the authoritative OPC staff role to Owner.
update public.opc_staff_roles
set
  role = 'owner',
  status = 'active',
  can_access_portal = true,
  can_submit_time_logs = true,
  can_view_all_jobs = true,
  can_manage_jobs = true,
  can_manage_employees = true,
  can_manage_reports = true,
  can_manage_finance = true,
  updated_at = now()
where user_id = '7dcbbbb5-9087-45bc-9e2a-55f2507bf884'::uuid
   or lower(coalesce(email, '')) = 's.batista@orangeproclean.ch';

-- user_profiles is a compatibility VIEW in the production database and is not
-- directly updatable. Keep opc_staff_roles authoritative and install a narrow
-- compatibility trigger so legacy role-only writes cannot break portal-role edits.
create or replace function public.opc_user_profiles_role_compat_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Only legacy role flags may be written through this compatibility view.
  -- No HR/personnel data is persisted here; opc_staff_roles remains authoritative.
  if (to_jsonb(new) - 'role' - 'is_owner' - 'is_admin')
     is distinct from
     (to_jsonb(old) - 'role' - 'is_owner' - 'is_admin') then
    raise exception 'user_profiles is read-only except compatibility role flags';
  end if;

  return new;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'user_profiles'
      and c.relkind = 'v'
  ) then
    execute 'drop trigger if exists opc_user_profiles_role_compat_update on public.user_profiles';
    execute 'create trigger opc_user_profiles_role_compat_update instead of update on public.user_profiles for each row execute function public.opc_user_profiles_role_compat_update()';
  end if;
end
$$;

-- Ensure Sara's HR row and portal role stay linked when both records already exist.
update public.opc_employees e
set
  staff_role_id = s.id,
  user_id = coalesce(e.user_id, s.user_id),
  updated_at = now()
from public.opc_staff_roles s
where (
    s.user_id = '7dcbbbb5-9087-45bc-9e2a-55f2507bf884'::uuid
    or lower(coalesce(s.email, '')) = 's.batista@orangeproclean.ch'
  )
  and (
    e.user_id = s.user_id
    or lower(coalesce(e.business_email, '')) = lower(coalesce(s.email, ''))
    or lower(coalesce(e.private_email, '')) = lower(coalesce(s.email, ''))
  )
  and e.staff_role_id is distinct from s.id;

-- Audit helper: surfaces employees with more than one currently-valid permit candidate.
-- It does not delete historical permit data automatically.
create or replace view public.opc_employee_permit_duplicate_audit
with (security_invoker = true)
as
select
  employee_id,
  count(*) as candidate_count,
  array_agg(id order by created_at desc) as permit_ids,
  array_agg(permit_type order by created_at desc) as permit_types,
  array_agg(valid_until order by created_at desc) as valid_until_values
from public.opc_employee_permits
where coalesce(permit_status, 'valid') not in ('revoked', 'cancelled')
  and (valid_from is null or valid_from <= current_date)
  and (valid_until is null or valid_until >= current_date)
group by employee_id
having count(*) > 1;

comment on view public.opc_employee_permit_duplicate_audit is
  'Server-side audit view for employees with multiple currently-valid permit candidates. No automatic deletion is performed.';

-- Never expose the permit audit view to normal portal sessions.
revoke all on public.opc_employee_permit_duplicate_audit from public;
revoke all on public.opc_employee_permit_duplicate_audit from anon;
revoke all on public.opc_employee_permit_duplicate_audit from authenticated;
grant select on public.opc_employee_permit_duplicate_audit to service_role;

commit;
