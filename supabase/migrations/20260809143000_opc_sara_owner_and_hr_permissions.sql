-- OPC owner promotion + HR permission consistency
-- Promotes Sara Batista to a real Owner role and keeps legacy profile role in sync.

begin;

-- Sara Batista: authoritative OPC staff role.
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

-- Keep the legacy profile compatible with owner-only pages that still read user_profiles.
update public.user_profiles
set role = 'owner'
where id = '7dcbbbb5-9087-45bc-9e2a-55f2507bf884'::uuid;

-- Some historical user_profiles installations also expose is_owner/is_admin flags.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'is_owner'
  ) then
    execute $sql$
      update public.user_profiles
      set is_owner = true
      where id = '7dcbbbb5-9087-45bc-9e2a-55f2507bf884'::uuid
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'is_admin'
  ) then
    execute $sql$
      update public.user_profiles
      set is_admin = true
      where id = '7dcbbbb5-9087-45bc-9e2a-55f2507bf884'::uuid
    $sql$;
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
create or replace view public.opc_employee_permit_duplicate_audit as
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
  'Read-only audit view for employees with multiple currently-valid permit candidates. No automatic deletion is performed.';

commit;
