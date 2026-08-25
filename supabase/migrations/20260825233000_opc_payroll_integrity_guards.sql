begin;
set local time zone 'Europe/Zurich';

-- Future payroll finalizations for one employee must never overlap and must not
-- reuse a time entry that is already part of another approved/paid payroll run.
-- Existing historical rows are intentionally left untouched; this guard applies
-- only to inserts/updates performed after the migration is installed.
create or replace function public.opc_guard_payroll_run_overlap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.opc_payroll_runs%rowtype;
  v_duplicate_entry_id text;
  v_duplicate_run_number text;
begin
  if new.status not in ('approved', 'paid') or new.employee_id is null then
    return new;
  end if;

  -- Serialize finalization attempts per employee so two simultaneous requests
  -- cannot both pass the integrity checks.
  perform pg_advisory_xact_lock(
    hashtextextended('opc_payroll_run:' || new.employee_id::text, 0)
  );

  select r.*
  into v_existing
  from public.opc_payroll_runs r
  where r.employee_id = new.employee_id
    and r.id is distinct from new.id
    and r.status in ('approved', 'paid')
    and r.period_from <= new.period_to
    and r.period_to >= new.period_from
  order by r.period_from, r.created_at
  limit 1;

  if found then
    raise exception
      'Lohnlauf überschneidet sich mit abgeschlossenem Lohnlauf % (% bis %).',
      v_existing.run_number,
      v_existing.period_from,
      v_existing.period_to;
  end if;

  -- Period checks alone are insufficient because a payroll-period override can
  -- theoretically move a time entry into another period. Compare the immutable
  -- calculation snapshots as a second line of defence.
  select
    current_entry.entry_id,
    existing_run.run_number
  into
    v_duplicate_entry_id,
    v_duplicate_run_number
  from public.opc_payroll_run_employees current_employee_run
  cross join lateral jsonb_array_elements_text(
    coalesce(
      current_employee_run.calculation_snapshot -> 'approved_entry_ids',
      '[]'::jsonb
    )
  ) as current_entry(entry_id)
  join public.opc_payroll_runs existing_run
    on existing_run.employee_id = new.employee_id
   and existing_run.id is distinct from new.id
   and existing_run.status in ('approved', 'paid')
  join public.opc_payroll_run_employees existing_employee_run
    on existing_employee_run.payroll_run_id = existing_run.id
   and existing_employee_run.employee_id = new.employee_id
  cross join lateral jsonb_array_elements_text(
    coalesce(
      existing_employee_run.calculation_snapshot -> 'approved_entry_ids',
      '[]'::jsonb
    )
  ) as existing_entry(entry_id)
  where current_employee_run.payroll_run_id = new.id
    and current_employee_run.employee_id = new.employee_id
    and existing_entry.entry_id = current_entry.entry_id
  limit 1;

  if found then
    raise exception
      'Zeiteintrag % ist bereits im abgeschlossenen Lohnlauf % enthalten.',
      v_duplicate_entry_id,
      v_duplicate_run_number;
  end if;

  return new;
end
$$;

-- Preserve immutability of approved/paid payrolls, while allowing the two
-- legitimate lifecycle transitions that the application needs:
-- approved -> paid and approved -> cancelled (only while unpaid).
create or replace function public.opc_guard_finalized_payroll_run()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status = 'paid' then
    raise exception 'Bezahlter Lohnlauf % ist unveränderbar.', old.run_number;
  end if;

  if old.status = 'approved' then
    if tg_op = 'UPDATE'
       and new.status = 'paid'
    then
      if old.paid_at is not null then
        raise exception 'Lohnlauf % ist bereits als bezahlt markiert.', old.run_number;
      end if;

      if new.paid_at is null then
        raise exception 'Beim Markieren als bezahlt muss paid_at gesetzt werden.';
      end if;

      if (
        to_jsonb(new)
          - array['status','paid_at','metadata','updated_at','updated_by']::text[]
      ) is distinct from (
        to_jsonb(old)
          - array['status','paid_at','metadata','updated_at','updated_by']::text[]
      ) then
        raise exception
          'Beim Markieren als bezahlt dürfen keine Beträge oder Periodendaten verändert werden.';
      end if;

      return new;
    end if;

    if tg_op = 'UPDATE'
       and new.status = 'cancelled'
       and old.paid_at is null
    then
      if (
        to_jsonb(new)
          - array['status','metadata','updated_at','updated_by']::text[]
      ) is distinct from (
        to_jsonb(old)
          - array['status','metadata','updated_at','updated_by']::text[]
      ) then
        raise exception
          'Beim Stornieren dürfen keine Beträge oder Periodendaten verändert werden.';
      end if;

      return new;
    end if;

    raise exception 'Abgeschlossener Lohnlauf % ist unveränderbar.', old.run_number;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end
$$;

drop trigger if exists trg_opc_guard_payroll_run_overlap
  on public.opc_payroll_runs;
create trigger trg_opc_guard_payroll_run_overlap
  before insert or update of employee_id, period_from, period_to, status
  on public.opc_payroll_runs
  for each row execute function public.opc_guard_payroll_run_overlap();

commit;
