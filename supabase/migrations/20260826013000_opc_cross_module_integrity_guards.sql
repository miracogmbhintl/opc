-- Orange Pro Clean GmbH
-- Cross-module integrity guards discovered during the 2026-08-26 production audit.
-- This migration is deliberately defensive: it blocks new ambiguous/corrupt states
-- without fabricating or rewriting existing business data.

begin;
set local time zone 'Europe/Zurich';

-- 1. Payroll profile effective periods must never overlap for one employee.
create or replace function public.opc_guard_payroll_profile_overlap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status <> 'active' then return new; end if;

  if exists (
    select 1
    from public.opc_employee_payroll_profiles p
    where p.employee_id = new.employee_id
      and p.status = 'active'
      and p.id <> coalesce(new.id, gen_random_uuid())
      and daterange(p.valid_from, coalesce(p.valid_until, 'infinity'::date), '[]')
          && daterange(new.valid_from, coalesce(new.valid_until, 'infinity'::date), '[]')
  ) then
    raise exception 'Aktives Payroll-Profil überschneidet sich zeitlich mit einem bestehenden Profil für diesen Mitarbeiter.'
      using errcode = '23P01';
  end if;

  return new;
end
$$;

drop trigger if exists trg_opc_guard_payroll_profile_overlap on public.opc_employee_payroll_profiles;
create trigger trg_opc_guard_payroll_profile_overlap
before insert or update of employee_id, status, valid_from, valid_until
on public.opc_employee_payroll_profiles
for each row execute function public.opc_guard_payroll_profile_overlap();

-- 2. Employment contracts may not overlap while active/approved.
create or replace function public.opc_guard_employment_contract_overlap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status not in ('active', 'approved') then return new; end if;

  if exists (
    select 1
    from public.opc_employment_contracts c
    where c.employee_id = new.employee_id
      and c.status in ('active', 'approved')
      and c.id <> coalesce(new.id, gen_random_uuid())
      and daterange(c.valid_from, coalesce(c.valid_until, 'infinity'::date), '[]')
          && daterange(new.valid_from, coalesce(new.valid_until, 'infinity'::date), '[]')
  ) then
    raise exception 'Aktiver Arbeitsvertrag überschneidet sich zeitlich mit einem bestehenden Vertrag für diesen Mitarbeiter.'
      using errcode = '23P01';
  end if;

  return new;
end
$$;

drop trigger if exists trg_opc_guard_employment_contract_overlap on public.opc_employment_contracts;
create trigger trg_opc_guard_employment_contract_overlap
before insert or update of employee_id, status, valid_from, valid_until
on public.opc_employment_contracts
for each row execute function public.opc_guard_employment_contract_overlap();

-- 3. Time-entry pay-rate links must all reference the same employee/effective contract.
create or replace function public.opc_guard_time_entry_pay_rate_links()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entry_employee uuid;
  v_work_date date;
  v_contract_employee uuid;
  v_contract_from date;
  v_contract_until date;
begin
  select employee_id, work_date
    into v_entry_employee, v_work_date
  from public.opc_employee_time_entries
  where id = new.time_entry_id;

  if v_entry_employee is null then
    raise exception 'Zeiteintrag fehlt oder ist keinem Mitarbeiter zugeordnet.';
  end if;

  if v_entry_employee <> new.employee_id then
    raise exception 'Zeiteintrag und Lohnsatz gehören nicht zum selben Mitarbeiter.';
  end if;

  if new.contract_id is not null then
    select employee_id, valid_from, valid_until
      into v_contract_employee, v_contract_from, v_contract_until
    from public.opc_employment_contracts
    where id = new.contract_id;

    if v_contract_employee is null or v_contract_employee <> new.employee_id then
      raise exception 'Arbeitsvertrag gehört nicht zum Mitarbeiter dieses Lohnsatzes.';
    end if;

    if v_work_date < v_contract_from
       or (v_contract_until is not null and v_work_date > v_contract_until) then
      raise exception 'Arbeitsvertrag ist am Datum des Zeiteintrags nicht gültig.';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists trg_opc_guard_time_entry_pay_rate_links on public.opc_time_entry_pay_rates;
create trigger trg_opc_guard_time_entry_pay_rate_links
before insert or update of time_entry_id, employee_id, contract_id
on public.opc_time_entry_pay_rates
for each row execute function public.opc_guard_time_entry_pay_rate_links();

-- 4. Approval/rejection is authoritative in the DB. Finance/report/job-view
-- permissions do not imply time-approval permission.
create or replace function public.opc_can_review_time_entries_strict()
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
      and s.status in ('active', 'aktiv', 'enabled')
      and coalesce(s.can_access_portal, true) = true
      and (
        lower(coalesce(s.role, '')) in ('owner', 'inhaber', 'admin', 'administrator', 'dispatch', 'dispatcher', 'disposition')
        or coalesce(s.can_manage_time_entries, false) = true
      )
  );
$$;

grant execute on function public.opc_can_review_time_entries_strict() to authenticated;

create or replace function public.opc_guard_time_entry_review_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status is distinct from new.status
     and new.status in ('approved', 'rejected')
     and old.status not in ('approved', 'rejected') then
    if not public.opc_can_review_time_entries_strict() then
      raise exception 'Keine Berechtigung zur Genehmigung oder Ablehnung von Zeiteinträgen.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists trg_opc_guard_time_entry_review_transition on public.opc_employee_time_entries;
create trigger trg_opc_guard_time_entry_review_transition
before update of status on public.opc_employee_time_entries
for each row execute function public.opc_guard_time_entry_review_transition();

-- 5. Prevent NEW duplicate open general shifts. Existing stale shifts are not
-- auto-closed because their true end timestamps are unknown.
create or replace function public.opc_guard_single_open_general_shift()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.user_id is null
     or new.job_id is not null
     or new.clock_out_at is not null
     or new.status not in ('open', 'on_break') then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('opc-open-general:' || new.user_id::text, 0));

  if exists (
    select 1
    from public.opc_employee_time_entries e
    where e.user_id = new.user_id
      and e.job_id is null
      and e.clock_out_at is null
      and e.status in ('open', 'on_break')
      and e.id <> coalesce(new.id, gen_random_uuid())
  ) then
    raise exception 'Für diesen Benutzer existiert bereits eine offene allgemeine Schicht.'
      using errcode = '23505';
  end if;

  return new;
end
$$;

drop trigger if exists trg_opc_guard_single_open_general_shift on public.opc_employee_time_entries;
create trigger trg_opc_guard_single_open_general_shift
before insert or update of user_id, job_id, clock_out_at, status
on public.opc_employee_time_entries
for each row execute function public.opc_guard_single_open_general_shift();

-- 6. user_profiles is a VIEW in the live schema, not a writable legacy table.
-- Rebuild it from the canonical opc_staff_roles source and stop classifying normal
-- employees as "client". Dispatch remains legacy-admin compatible; client users
-- are represented by opc_client_users and therefore do not belong in this view.
create or replace view public.user_profiles as
select
  sr.user_id as id,
  coalesce(sr.email, u.email::text) as email,
  coalesce(sr.display_name, u.email::text, 'Orange Pro Clean User'::text) as name,
  coalesce(sr.display_name, u.email::text, 'Orange Pro Clean User'::text) as full_name,
  case
    when lower(coalesce(sr.role, '')) in ('owner', 'inhaber') then 'owner'::text
    when lower(coalesce(sr.role, '')) in ('admin', 'administrator', 'dispatch', 'dispatcher', 'disposition') then 'admin'::text
    else 'employee'::text
  end as role,
  'Orange Pro Clean GmbH'::text as company,
  sr.phone_raw as phone,
  null::text as avatar_url,
  sr.created_at,
  sr.updated_at,
  sr.id as opc_staff_role_id,
  sr.role as opc_staff_role,
  sr.status as opc_status,
  sr.can_access_portal
from public.opc_staff_roles sr
left join auth.users u on u.id = sr.user_id
where sr.user_id is not null
  and sr.status = 'active'
  and sr.can_access_portal = true
  and sr.user_id = auth.uid();

-- 7. A Supabase Auth identity that is still active OPC staff must never be
-- relabelled as a client account by e-mail collision during client-portal setup.
create or replace function public.opc_guard_active_staff_auth_client_collision()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if exists (
    select 1
    from public.opc_staff_roles s
    where s.user_id = new.id
      and s.status in ('active', 'aktiv', 'enabled')
      and coalesce(s.can_access_portal, true) = true
  ) and (
    lower(coalesce(new.raw_app_meta_data ->> 'opc_role', '')) = 'client'
    or lower(coalesce(new.raw_user_meta_data ->> 'opc_role', '')) = 'client'
    or new.raw_app_meta_data ? 'opc_client_id'
    or new.raw_user_meta_data ? 'opc_client_id'
  ) then
    raise exception 'Active OPC staff account cannot be linked as a client portal user.'
      using errcode = '23514';
  end if;

  return new;
end
$$;

drop trigger if exists trg_opc_guard_active_staff_auth_client_collision on auth.users;
create trigger trg_opc_guard_active_staff_auth_client_collision
before update of raw_app_meta_data, raw_user_meta_data on auth.users
for each row execute function public.opc_guard_active_staff_auth_client_collision();

-- 8. payroll_in_scope is payroll governance, not generic HR editing. The HR API
-- writes updated_by, which lets the DB verify that the actor is an Owner.
create or replace function public.opc_guard_payroll_scope_owner_only()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.payroll_in_scope is not distinct from new.payroll_in_scope then
    return new;
  end if;

  if new.updated_by is null or not exists (
    select 1
    from public.opc_staff_roles s
    where s.user_id = new.updated_by
      and s.status in ('active', 'aktiv', 'enabled')
      and lower(coalesce(s.role, '')) in ('owner', 'inhaber')
  ) then
    raise exception 'Nur Owner dürfen payroll_in_scope ändern.'
      using errcode = '42501';
  end if;

  return new;
end
$$;

drop trigger if exists trg_opc_guard_payroll_scope_owner_only on public.opc_employees;
create trigger trg_opc_guard_payroll_scope_owner_only
before update of payroll_in_scope on public.opc_employees
for each row execute function public.opc_guard_payroll_scope_owner_only();

commit;
