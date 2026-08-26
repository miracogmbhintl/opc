begin;
set local time zone 'Europe/Zurich';

-- Prevent ambiguous active employment contracts for the same employee.
create or replace function public.opc_guard_active_employment_contract_overlap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conflict record;
begin
  if coalesce(new.status, '') <> 'active' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('opc_contract:' || new.employee_id::text, 0));

  select id, contract_number, valid_from, valid_until
  into v_conflict
  from public.opc_employment_contracts c
  where c.employee_id = new.employee_id
    and c.id is distinct from new.id
    and c.status = 'active'
    and c.valid_from <= coalesce(new.valid_until, 'infinity'::date)
    and coalesce(c.valid_until, 'infinity'::date) >= new.valid_from
  order by c.valid_from desc
  limit 1;

  if found then
    raise exception
      'Aktiver Arbeitsvertrag überschneidet sich mit Vertrag % (% bis %).',
      coalesce(v_conflict.contract_number, v_conflict.id::text),
      v_conflict.valid_from,
      coalesce(v_conflict.valid_until::text, 'unbefristet');
  end if;

  return new;
end
$$;

drop trigger if exists trg_opc_guard_active_employment_contract_overlap
  on public.opc_employment_contracts;
create trigger trg_opc_guard_active_employment_contract_overlap
  before insert or update of employee_id, status, valid_from, valid_until
  on public.opc_employment_contracts
  for each row execute function public.opc_guard_active_employment_contract_overlap();

-- Prevent ambiguous active payroll contribution profiles.
create or replace function public.opc_guard_active_payroll_profile_overlap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conflict record;
begin
  if coalesce(new.status, '') <> 'active' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('opc_payroll_profile:' || new.employee_id::text, 0));

  select id, valid_from, valid_until
  into v_conflict
  from public.opc_employee_payroll_profiles p
  where p.employee_id = new.employee_id
    and p.id is distinct from new.id
    and p.status = 'active'
    and p.valid_from <= coalesce(new.valid_until, 'infinity'::date)
    and coalesce(p.valid_until, 'infinity'::date) >= new.valid_from
  order by p.valid_from desc
  limit 1;

  if found then
    raise exception
      'Aktives Payroll-Profil überschneidet sich mit Profil % (% bis %).',
      v_conflict.id,
      v_conflict.valid_from,
      coalesce(v_conflict.valid_until::text, 'unbefristet');
  end if;

  return new;
end
$$;

drop trigger if exists trg_opc_guard_active_payroll_profile_overlap
  on public.opc_employee_payroll_profiles;
create trigger trg_opc_guard_active_payroll_profile_overlap
  before insert or update of employee_id, status, valid_from, valid_until
  on public.opc_employee_payroll_profiles
  for each row execute function public.opc_guard_active_payroll_profile_overlap();

-- A pay-rate override must always belong to the employee of the time entry and,
-- when a contract is supplied, to a contract of that same employee covering the
-- worked date.
create or replace function public.opc_guard_time_entry_pay_rate_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entry record;
  v_contract record;
begin
  select id, employee_id, clock_in_at
  into v_entry
  from public.opc_employee_time_entries
  where id = new.time_entry_id;

  if not found then
    raise exception 'Zeiteintrag % existiert nicht.', new.time_entry_id;
  end if;

  if v_entry.employee_id is distinct from new.employee_id then
    raise exception 'Lohnansatz-Mitarbeiter stimmt nicht mit dem Zeiteintrag überein.';
  end if;

  if new.contract_id is not null then
    select id, employee_id, valid_from, valid_until
    into v_contract
    from public.opc_employment_contracts
    where id = new.contract_id;

    if not found then
      raise exception 'Arbeitsvertrag % existiert nicht.', new.contract_id;
    end if;

    if v_contract.employee_id is distinct from new.employee_id then
      raise exception 'Arbeitsvertrag gehört nicht zum Mitarbeiter des Zeiteintrags.';
    end if;

    if v_entry.clock_in_at is not null and (
      v_entry.clock_in_at::date < v_contract.valid_from
      or (v_contract.valid_until is not null and v_entry.clock_in_at::date > v_contract.valid_until)
    ) then
      raise exception 'Arbeitsvertrag ist am Datum des Zeiteintrags nicht gültig.';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists trg_opc_guard_time_entry_pay_rate_identity
  on public.opc_time_entry_pay_rates;
create trigger trg_opc_guard_time_entry_pay_rate_identity
  before insert or update of time_entry_id, employee_id, contract_id
  on public.opc_time_entry_pay_rates
  for each row execute function public.opc_guard_time_entry_pay_rate_identity();

-- Prevent duplicate open general shifts even for direct REST writes that bypass
-- opc_clock_in_employee(). Existing stale/open rows are intentionally not
-- modified by this migration.
create or replace function public.opc_guard_single_open_general_shift()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing_id uuid;
begin
  if new.user_id is null
     or new.job_id is not null
     or new.clock_out_at is not null
     or coalesce(new.status, '') not in ('open', 'on_break')
  then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('opc_open_general:' || new.user_id::text, 0));

  select e.id
  into v_existing_id
  from public.opc_employee_time_entries e
  where e.user_id = new.user_id
    and e.id is distinct from new.id
    and e.job_id is null
    and e.clock_out_at is null
    and e.status in ('open', 'on_break')
  limit 1;

  if found then
    raise exception 'Für diesen Benutzer existiert bereits ein offener allgemeiner Zeiteintrag (%).', v_existing_id;
  end if;

  return new;
end
$$;

drop trigger if exists trg_opc_guard_single_open_general_shift
  on public.opc_employee_time_entries;
create trigger trg_opc_guard_single_open_general_shift
  before insert or update of user_id, job_id, clock_out_at, status
  on public.opc_employee_time_entries
  for each row execute function public.opc_guard_single_open_general_shift();

-- user_profiles is a compatibility mirror only, but several older screens still
-- read it. Never collapse employee/dispatch to client. Abort the migration if an
-- old role CHECK cannot represent the canonical staff roles; that is safer than
-- installing a half-working synchronizer.
do $$
declare
  v_role_checks text;
begin
  if to_regclass('public.user_profiles') is null then
    raise exception 'Required compatibility table public.user_profiles is missing.';
  end if;

  select string_agg(pg_get_constraintdef(c.oid, true), ' ')
  into v_role_checks
  from pg_constraint c
  where c.conrelid = 'public.user_profiles'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid, true) ilike '%role%';

  if v_role_checks is not null and (
    v_role_checks not ilike '%employee%'
    or v_role_checks not ilike '%dispatch%'
  ) then
    raise exception 'user_profiles.role CHECK must allow employee and dispatch before staff-role synchronization can be installed: %', v_role_checks;
  end if;
end
$$;

create or replace function public.opc_sync_legacy_profile_staff_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_has_is_owner boolean;
  v_has_is_admin boolean;
begin
  if new.user_id is null then
    return new;
  end if;

  v_role := lower(trim(coalesce(new.role, 'employee')));
  if v_role in ('inhaber','godmode') then v_role := 'owner'; end if;
  if v_role = 'administrator' then v_role := 'admin'; end if;
  if v_role in ('dispatcher','disposition') then v_role := 'dispatch'; end if;
  if v_role in ('mitarbeiter','staff') then v_role := 'employee'; end if;

  if v_role not in ('owner','admin','dispatch','employee') then
    v_role := 'employee';
  end if;

  update public.user_profiles
  set role = v_role
  where id = new.user_id;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'is_owner'
  ) into v_has_is_owner;
  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'is_admin'
  ) into v_has_is_admin;

  if v_has_is_owner then
    execute 'update public.user_profiles set is_owner = $1 where id = $2'
      using (v_role = 'owner'), new.user_id;
  end if;
  if v_has_is_admin then
    execute 'update public.user_profiles set is_admin = $1 where id = $2'
      using (v_role = 'admin'), new.user_id;
  end if;

  return new;
end
$$;

drop trigger if exists trg_opc_sync_legacy_profile_staff_role
  on public.opc_staff_roles;
create trigger trg_opc_sync_legacy_profile_staff_role
  after insert or update of user_id, role
  on public.opc_staff_roles
  for each row execute function public.opc_sync_legacy_profile_staff_role();

-- Repair existing compatibility rows only where an active staff role already
-- exists. This does not create users or change staff permissions.
update public.user_profiles p
set role = case
  when lower(trim(s.role)) in ('owner','inhaber','godmode') then 'owner'
  when lower(trim(s.role)) in ('admin','administrator') then 'admin'
  when lower(trim(s.role)) in ('dispatch','dispatcher','disposition') then 'dispatch'
  else 'employee'
end
from public.opc_staff_roles s
where s.user_id = p.id
  and s.status in ('active','aktiv','enabled')
  and s.can_access_portal = true
  and p.role is distinct from case
    when lower(trim(s.role)) in ('owner','inhaber','godmode') then 'owner'
    when lower(trim(s.role)) in ('admin','administrator') then 'admin'
    when lower(trim(s.role)) in ('dispatch','dispatcher','disposition') then 'dispatch'
    else 'employee'
  end;

commit;
