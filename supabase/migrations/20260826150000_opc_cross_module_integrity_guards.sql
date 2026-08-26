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

commit;
