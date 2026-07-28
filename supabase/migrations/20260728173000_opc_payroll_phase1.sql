begin;

-- OPC Payroll Phase 1
-- Adds time-versioned employee contribution profiles and immutable payroll runs.
-- Existing opc_employment_contracts and opc_payroll_rule_sets remain authoritative.

do $$
begin
  if to_regclass('public.opc_employees') is null then
    raise exception 'Required table public.opc_employees is missing';
  end if;
  if to_regclass('public.opc_employment_contracts') is null then
    raise exception 'Required table public.opc_employment_contracts is missing';
  end if;
  if to_regclass('public.opc_employee_time_entries') is null then
    raise exception 'Required table public.opc_employee_time_entries is missing';
  end if;
  if to_regclass('public.opc_payroll_rule_sets') is null then
    raise exception 'Required table public.opc_payroll_rule_sets is missing';
  end if;
  if to_regprocedure('public.opc_can_manage_payroll()') is null then
    raise exception 'Required function public.opc_can_manage_payroll() is missing';
  end if;
end
$$;

-- Resolve the current contract_type check constraint without hard-coding a
-- historical enum value in the frontend. The existing contract table is retained.
create or replace function public.opc_resolve_employment_contract_type(
  p_salary_type text,
  p_valid_until date default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_definition text;
  v_candidate text;
begin
  select string_agg(pg_get_constraintdef(c.oid, true), ' ')
  into v_definition
  from pg_constraint c
  where c.conrelid = 'public.opc_employment_contracts'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid, true) ilike '%contract_type%';

  if v_definition is null then
    return 'employment';
  end if;

  if lower(coalesce(p_salary_type, '')) = 'hourly' and v_definition ilike '%''hourly_employment''%' then
    return 'hourly_employment';
  end if;
  if lower(coalesce(p_salary_type, '')) = 'monthly' and v_definition ilike '%''monthly_employment''%' then
    return 'monthly_employment';
  end if;
  if p_valid_until is not null and v_definition ilike '%''fixed_term''%' then
    return 'fixed_term';
  end if;
  if p_valid_until is null and v_definition ilike '%''indefinite''%' then
    return 'indefinite';
  end if;
  if p_valid_until is null and v_definition ilike '%''permanent''%' then
    return 'permanent';
  end if;
  if v_definition ilike '%''employment''%' then
    return 'employment';
  end if;

  select m.captures[1]
  into v_candidate
  from regexp_matches(v_definition, '''([^'']+)''', 'g') as m(captures)
  where m.captures[1] not in ('text')
  limit 1;

  return coalesce(v_candidate, 'employment');
end
$$;

grant execute on function public.opc_resolve_employment_contract_type(text, date) to authenticated;

create table if not exists public.opc_employee_payroll_profiles (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.opc_employees(id) on delete cascade,
  status text not null default 'active' check (status in ('draft','active','inactive')),
  valid_from date not null,
  valid_until date,
  source_tax_subject boolean not null default false,
  source_tax_canton text,
  source_tax_tariff_code text,
  source_tax_rate numeric(9,4) not null default 0 check (source_tax_rate >= 0),
  source_tax_fixed_amount_chf numeric(14,2) not null default 0 check (source_tax_fixed_amount_chf >= 0),
  church_tax boolean not null default false,
  nbu_employee_rate numeric(9,4) not null default 0 check (nbu_employee_rate >= 0),
  nbu_employer_rate numeric(9,4) not null default 0 check (nbu_employer_rate >= 0),
  ktg_employee_rate numeric(9,4) not null default 0 check (ktg_employee_rate >= 0),
  ktg_employer_rate numeric(9,4) not null default 0 check (ktg_employer_rate >= 0),
  gav_employee_rate numeric(9,4) not null default 0 check (gav_employee_rate >= 0),
  gav_employer_rate numeric(9,4) not null default 0 check (gav_employer_rate >= 0),
  bvg_employee_amount_chf numeric(14,2) not null default 0 check (bvg_employee_amount_chf >= 0),
  bvg_employer_amount_chf numeric(14,2) not null default 0 check (bvg_employer_amount_chf >= 0),
  family_allowance_chf numeric(14,2) not null default 0,
  expense_reimbursement_chf numeric(14,2) not null default 0,
  advance_deduction_chf numeric(14,2) not null default 0 check (advance_deduction_chf >= 0),
  other_employee_deduction_chf numeric(14,2) not null default 0 check (other_employee_deduction_chf >= 0),
  other_employer_cost_chf numeric(14,2) not null default 0 check (other_employer_cost_chf >= 0),
  other_adjustment_chf numeric(14,2) not null default 0,
  monthly_salary_proration_method text not null default 'working_days'
    check (monthly_salary_proration_method in ('working_days','calendar_days','none')),
  pay_thirteenth_monthly boolean not null default false,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  check (valid_until is null or valid_until >= valid_from),
  unique (employee_id, valid_from)
);

create index if not exists opc_employee_payroll_profiles_employee_validity_idx
  on public.opc_employee_payroll_profiles(employee_id, valid_from desc, valid_until);

-- Optional rate snapshots for individual time entries. This is required when one
-- employee has multiple hourly rates in the same payroll period.
create table if not exists public.opc_time_entry_pay_rates (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid not null unique references public.opc_employee_time_entries(id) on delete cascade,
  employee_id uuid not null references public.opc_employees(id) on delete cascade,
  contract_id uuid references public.opc_employment_contracts(id) on delete set null,
  hourly_rate_chf numeric(14,4) not null check (hourly_rate_chf > 0),
  rate_source text not null default 'manual'
    check (rate_source in ('manual','contract','excel_reconciliation','payroll_correction','system')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid()
);

create index if not exists opc_time_entry_pay_rates_employee_idx
  on public.opc_time_entry_pay_rates(employee_id, time_entry_id);

create table if not exists public.opc_payroll_runs (
  id uuid primary key default gen_random_uuid(),
  run_number text not null unique,
  employee_id uuid references public.opc_employees(id) on delete restrict,
  period_from date not null,
  period_to date not null,
  status text not null default 'draft'
    check (status in ('draft','calculated','approved','paid','cancelled')),
  rule_set_id uuid references public.opc_payroll_rule_sets(id) on delete restrict,
  currency_code text not null default 'CHF',
  total_gross_chf numeric(14,2) not null default 0,
  total_employee_deductions_chf numeric(14,2) not null default 0,
  total_net_chf numeric(14,2) not null default 0,
  total_reimbursements_chf numeric(14,2) not null default 0,
  total_payout_chf numeric(14,2) not null default 0,
  total_employer_contributions_chf numeric(14,2) not null default 0,
  total_employer_cost_chf numeric(14,2) not null default 0,
  calculated_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  metadata jsonb not null default '{}'::jsonb,
  check (period_to >= period_from)
);

create index if not exists opc_payroll_runs_employee_period_idx
  on public.opc_payroll_runs(employee_id, period_from desc, period_to desc);

create table if not exists public.opc_payroll_run_employees (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.opc_payroll_runs(id) on delete cascade,
  employee_id uuid not null references public.opc_employees(id) on delete restrict,
  contract_id uuid references public.opc_employment_contracts(id) on delete restrict,
  payroll_profile_id uuid references public.opc_employee_payroll_profiles(id) on delete restrict,
  salary_type text not null check (salary_type in ('hourly','monthly')),
  approved_entry_count integer not null default 0 check (approved_entry_count >= 0),
  approved_minutes integer not null default 0 check (approved_minutes >= 0),
  payable_days numeric(10,4) not null default 0,
  period_working_days numeric(10,4) not null default 0,
  base_salary_chf numeric(14,2) not null default 0,
  gross_salary_chf numeric(14,2) not null default 0,
  employee_deductions_chf numeric(14,2) not null default 0,
  net_salary_chf numeric(14,2) not null default 0,
  reimbursements_chf numeric(14,2) not null default 0,
  other_adjustments_chf numeric(14,2) not null default 0,
  payout_chf numeric(14,2) not null default 0,
  employer_contributions_chf numeric(14,2) not null default 0,
  total_employer_cost_chf numeric(14,2) not null default 0,
  gross_per_hour_chf numeric(14,4),
  net_per_hour_chf numeric(14,4),
  employer_cost_per_hour_chf numeric(14,4),
  calculation_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_run_id, employee_id)
);

create table if not exists public.opc_payroll_lines (
  id uuid primary key default gen_random_uuid(),
  payroll_run_employee_id uuid not null references public.opc_payroll_run_employees(id) on delete cascade,
  line_group text not null
    check (line_group in ('earning','employee_deduction','employer_contribution','reimbursement','adjustment')),
  line_code text not null,
  description text not null,
  basis_amount_chf numeric(14,2),
  quantity numeric(14,4),
  rate numeric(9,4),
  employee_amount_chf numeric(14,2) not null default 0,
  employer_amount_chf numeric(14,2) not null default 0,
  sort_order integer not null default 100,
  source text not null default 'payroll_engine',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists opc_payroll_lines_run_employee_idx
  on public.opc_payroll_lines(payroll_run_employee_id, sort_order, line_code);

alter table public.opc_employee_payroll_profiles enable row level security;
alter table public.opc_time_entry_pay_rates enable row level security;
alter table public.opc_payroll_runs enable row level security;
alter table public.opc_payroll_run_employees enable row level security;
alter table public.opc_payroll_lines enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'opc_employee_payroll_profiles',
    'opc_time_entry_pay_rates',
    'opc_payroll_runs',
    'opc_payroll_run_employees',
    'opc_payroll_lines'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_all', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.opc_can_manage_payroll()) with check (public.opc_can_manage_payroll())',
      table_name || '_owner_all',
      table_name
    );
  end loop;
end
$$;

grant select, insert, update, delete on public.opc_employee_payroll_profiles to authenticated;
grant select, insert, update, delete on public.opc_time_entry_pay_rates to authenticated;
grant select, insert, update, delete on public.opc_payroll_runs to authenticated;
grant select, insert, update, delete on public.opc_payroll_run_employees to authenticated;
grant select, insert, update, delete on public.opc_payroll_lines to authenticated;

do $$
begin
  if to_regprocedure('public.opc_set_updated_at()') is not null then
    drop trigger if exists trg_opc_employee_payroll_profiles_updated_at on public.opc_employee_payroll_profiles;
    create trigger trg_opc_employee_payroll_profiles_updated_at
      before update on public.opc_employee_payroll_profiles
      for each row execute function public.opc_set_updated_at();

    drop trigger if exists trg_opc_time_entry_pay_rates_updated_at on public.opc_time_entry_pay_rates;
    create trigger trg_opc_time_entry_pay_rates_updated_at
      before update on public.opc_time_entry_pay_rates
      for each row execute function public.opc_set_updated_at();

    drop trigger if exists trg_opc_payroll_runs_updated_at on public.opc_payroll_runs;
    create trigger trg_opc_payroll_runs_updated_at
      before update on public.opc_payroll_runs
      for each row execute function public.opc_set_updated_at();

    drop trigger if exists trg_opc_payroll_run_employees_updated_at on public.opc_payroll_run_employees;
    create trigger trg_opc_payroll_run_employees_updated_at
      before update on public.opc_payroll_run_employees
      for each row execute function public.opc_set_updated_at();
  end if;
end
$$;

create or replace function public.opc_guard_finalized_payroll_run()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status in ('approved', 'paid') then
    raise exception 'Abgeschlossener Lohnlauf % ist unveränderbar.', old.run_number;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

create or replace function public.opc_guard_finalized_payroll_child()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run_id uuid;
  v_status text;
begin
  if tg_table_name = 'opc_payroll_run_employees' then
    v_run_id := old.payroll_run_id;
  else
    select payroll_run_id into v_run_id
    from public.opc_payroll_run_employees
    where id = old.payroll_run_employee_id;
  end if;

  select status into v_status
  from public.opc_payroll_runs
  where id = v_run_id;

  if v_status in ('approved', 'paid') then
    raise exception 'Positionen eines abgeschlossenen Lohnlaufs sind unveränderbar.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

drop trigger if exists trg_opc_guard_finalized_payroll_run on public.opc_payroll_runs;
create trigger trg_opc_guard_finalized_payroll_run
  before update or delete on public.opc_payroll_runs
  for each row execute function public.opc_guard_finalized_payroll_run();

drop trigger if exists trg_opc_guard_finalized_payroll_employee on public.opc_payroll_run_employees;
create trigger trg_opc_guard_finalized_payroll_employee
  before update or delete on public.opc_payroll_run_employees
  for each row execute function public.opc_guard_finalized_payroll_child();

drop trigger if exists trg_opc_guard_finalized_payroll_line on public.opc_payroll_lines;
create trigger trg_opc_guard_finalized_payroll_line
  before update or delete on public.opc_payroll_lines
  for each row execute function public.opc_guard_finalized_payroll_child();

comment on table public.opc_employee_payroll_profiles is
  'Time-versioned employee-specific payroll deductions, insurance rates and manual payroll amounts.';
comment on table public.opc_time_entry_pay_rates is
  'Per-time-entry hourly-rate snapshots used when a period contains multiple wage rates.';
comment on table public.opc_payroll_runs is
  'Immutable payroll run headers. Finalized calculations are stored as snapshots.';
comment on table public.opc_payroll_run_employees is
  'Per-employee payroll totals and calculation snapshots for a payroll run.';
comment on table public.opc_payroll_lines is
  'Detailed earning, deduction, reimbursement and employer contribution lines.';

commit;
