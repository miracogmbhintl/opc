-- Orange Pro Clean GmbH
-- Payroll Reconciliation V2
-- Excel period: 24.06.2026 - 23.07.2026
--
-- Corrects:
--   * GAV contribution effective 01.05.2026: AN 0.40 %, AG 0.15 %
--   * Hourly 13th salary is accrued, not automatically paid monthly
--   * Vacation salary is accrued unless explicitly configured for monthly payout
--   * GAV minimum hourly wages and public-holiday compensation are rule metadata
--   * Mixed rates for Filip and Herminia are assigned to exact Excel source rows
--   * Luciano's CHF 130 advance is period-specific
--   * Herminia's three pre-period Excel rows are treated as a documented carryover
--   * Sara/Pravin BVG values are stored as provisional Excel estimates
--
-- Idempotent. Existing finalized payroll runs are not changed.

begin;
set local time zone 'Europe/Zurich';

do $$
begin
  if to_regclass('public.opc_employee_payroll_profiles') is null then
    raise exception 'opc_employee_payroll_profiles fehlt';
  end if;
  if to_regclass('public.opc_time_entry_pay_rates') is null then
    raise exception 'opc_time_entry_pay_rates fehlt';
  end if;
  if to_regclass('public.opc_employment_contracts') is null then
    raise exception 'opc_employment_contracts fehlt';
  end if;
  if to_regclass('public.opc_payroll_rule_sets') is null then
    raise exception 'opc_payroll_rule_sets fehlt';
  end if;
  if to_regprocedure('public.opc_can_manage_payroll()') is null then
    raise exception 'opc_can_manage_payroll() fehlt';
  end if;
end
$$;

create table if not exists public.opc_payroll_period_adjustments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.opc_employees(id) on delete cascade,
  period_from date not null,
  period_to date not null,
  adjustment_type text not null check (
    adjustment_type in ('earning','deduction','advance','reimbursement','adjustment','employer_cost')
  ),
  code text not null,
  description text not null,
  amount_chf numeric(14,2) not null check (amount_chf > 0),
  direction text not null default 'addition' check (direction in ('addition','deduction')),
  affects_payout boolean not null default true,
  status text not null default 'active' check (status in ('draft','active','cancelled')),
  sort_order integer not null default 300,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  check (period_to >= period_from),
  unique (employee_id, period_from, period_to, code)
);

create index if not exists opc_payroll_period_adjustments_employee_period_idx
  on public.opc_payroll_period_adjustments(employee_id, period_from, period_to, status);

alter table public.opc_payroll_period_adjustments enable row level security;
drop policy if exists opc_payroll_period_adjustments_owner_all
  on public.opc_payroll_period_adjustments;
create policy opc_payroll_period_adjustments_owner_all
  on public.opc_payroll_period_adjustments
  for all to authenticated
  using (public.opc_can_manage_payroll())
  with check (public.opc_can_manage_payroll());

grant select, insert, update, delete
  on public.opc_payroll_period_adjustments to authenticated;

-- Preserve current relevant rows before correction.
create table if not exists public.opc_payroll_reconciliation_backup_20260729_v2 as
select
  'profile'::text as record_type,
  p.id as record_id,
  to_jsonb(p) as record_data,
  now() as backed_up_at
from public.opc_employee_payroll_profiles p
where p.employee_id in (
  'da084053-d67a-4d65-984b-bc2ae2880a1c'::uuid,
  'e044673c-2f42-484d-8f8b-5427b696cc1e'::uuid,
  '9ea589e4-5624-4108-bad2-6ab00a63a47d'::uuid,
  'b62debc3-0115-4b4c-b536-240602cd11a2'::uuid,
  '8742eba5-ce71-45a3-a457-489120190cab'::uuid,
  '63a0e241-5383-445e-b778-3136d0e3cdbe'::uuid,
  'c8dc9896-c3b7-4ef1-9f48-b32a8ae295fa'::uuid,
  '0f82f804-f1a4-4eb8-a9da-4bb11d62ff83'::uuid,
  'd1428879-542b-42a0-9555-a7e13a0ea875'::uuid,
  '63f682f1-4c4f-4948-82ba-07bc028fc0c3'::uuid
)
union all
select
  'contract'::text,
  c.id,
  to_jsonb(c),
  now()
from public.opc_employment_contracts c
where c.contract_number like 'OPC-PAY-2026-%';

-- Federal / GAV 2026 metadata used by the engine.
update public.opc_payroll_rule_sets
set
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'gav_employee_execution_rate', 0.40,
    'gav_employer_execution_rate', 0.15,
    'gav_total_execution_rate', 0.55,
    'gav_execution_rate_valid_from', '2026-05-01',
    'gav_minimum_hourly_maintenance_i_chf', 21.40,
    'gav_minimum_hourly_special_i_chf', 23.40,
    'public_holiday_maintenance_rate', 1.50,
    'public_holiday_special_rate', 3.60,
    'vacation_accrual_default_rate', 8.33,
    'thirteenth_salary_entitlement_rate', 100.00,
    'payroll_reconciliation_version', 'opc_payroll_reconciliation_v2',
    'updated_at', now()
  ),
  updated_at = now()
where rule_year = 2026
  and status = 'active';

-- GAV cleaning staff: employee 0.40 %, employer 0.15 %.
update public.opc_employee_payroll_profiles p
set
  gav_employee_rate = 0.4000,
  gav_employer_rate = 0.1500,
  pay_thirteenth_monthly = false,
  advance_deduction_chf = 0,
  metadata = coalesce(p.metadata, '{}'::jsonb) || jsonb_build_object(
    'pay_vacation_monthly', false,
    'thirteenth_salary_payout_mode', 'annual_or_exit',
    'nbu_eligibility_mode', 'always',
    'nbu_eligibility_source', 'excel_opc_insurance_assumption_pending_policy_confirmation',
    'gav_rate_valid_from', '2026-05-01',
    'payroll_reconciliation_version', 'opc_payroll_reconciliation_v2',
    'updated_at', now()
  ),
  updated_at = now(),
  updated_by = auth.uid()
where p.employee_id in (
  'da084053-d67a-4d65-984b-bc2ae2880a1c'::uuid,
  'e044673c-2f42-484d-8f8b-5427b696cc1e'::uuid,
  '9ea589e4-5624-4108-bad2-6ab00a63a47d'::uuid,
  'b62debc3-0115-4b4c-b536-240602cd11a2'::uuid,
  '8742eba5-ce71-45a3-a457-489120190cab'::uuid,
  '63a0e241-5383-445e-b778-3136d0e3cdbe'::uuid,
  'c8dc9896-c3b7-4ef1-9f48-b32a8ae295fa'::uuid,
  '0f82f804-f1a4-4eb8-a9da-4bb11d62ff83'::uuid,
  'd1428879-542b-42a0-9555-a7e13a0ea875'::uuid
)
  and p.status = 'active'
  and p.valid_from <= date '2026-07-23'
  and (p.valid_until is null or p.valid_until >= date '2026-06-24');

-- Pravin is not currently classified as GAV-covered in the source workbook.
update public.opc_employee_payroll_profiles p
set
  gav_employee_rate = 0,
  gav_employer_rate = 0,
  pay_thirteenth_monthly = false,
  advance_deduction_chf = 0,
  metadata = coalesce(p.metadata, '{}'::jsonb) || jsonb_build_object(
    'pay_vacation_monthly', false,
    'thirteenth_salary_payout_mode', 'annual_or_manual',
    'nbu_eligibility_mode', 'always',
    'payroll_reconciliation_version', 'opc_payroll_reconciliation_v2',
    'updated_at', now()
  ),
  updated_at = now(),
  updated_by = auth.uid()
where p.employee_id = '63f682f1-4c4f-4948-82ba-07bc028fc0c3'::uuid
  and p.status = 'active'
  and p.valid_from <= date '2026-07-23'
  and (p.valid_until is null or p.valid_until >= date '2026-06-24');

-- Store the Excel BVG values as explicitly provisional estimates.
update public.opc_employee_payroll_profiles p
set
  bvg_employee_amount_chf = case
    when p.employee_id = 'd1428879-542b-42a0-9555-a7e13a0ea875'::uuid then 140.00
    when p.employee_id = '63f682f1-4c4f-4948-82ba-07bc028fc0c3'::uuid then 219.70
    else p.bvg_employee_amount_chf
  end,
  metadata = coalesce(p.metadata, '{}'::jsonb) || jsonb_build_object(
    'bvg_amount_confirmed', false,
    'bvg_source', 'provisional_excel_estimate',
    'bvg_requires_pension_plan_confirmation', true,
    'updated_at', now()
  ),
  updated_at = now(),
  updated_by = auth.uid()
where p.employee_id in (
  'd1428879-542b-42a0-9555-a7e13a0ea875'::uuid,
  '63f682f1-4c4f-4948-82ba-07bc028fc0c3'::uuid
)
  and p.status = 'active'
  and p.valid_from <= date '2026-07-23'
  and (p.valid_until is null or p.valid_until >= date '2026-06-24');

-- Hourly GAV contracts accrue vacation and 13th salary; neither is paid monthly.
update public.opc_employment_contracts c
set
  holiday_pay_percentage = 8.3300,
  public_holiday_percentage = 0,
  thirteenth_salary_percentage = 100.0000,
  rate_composition = 'base_excluding_supplements',
  metadata = coalesce(c.metadata, '{}'::jsonb) || jsonb_build_object(
    'vacation_payout_mode', 'accrual',
    'public_holiday_calculation', 'category_specific_gav_2026',
    'thirteenth_salary_payout_mode', 'annual_or_exit',
    'payroll_reconciliation_version', 'opc_payroll_reconciliation_v2',
    'updated_at', now()
  ),
  updated_at = now(),
  updated_by = auth.uid()
where c.contract_number in (
  'OPC-PAY-2026-000010',
  'OPC-PAY-2026-000011',
  'OPC-PAY-2026-000019',
  'OPC-PAY-2026-000006',
  'OPC-PAY-2026-000007',
  'OPC-PAY-2026-000013',
  'OPC-PAY-2026-000016',
  'OPC-PAY-2026-000015'
);

-- Sara: Excel assumes GAV coverage. Keep this explicit but marked for role confirmation.
update public.opc_employment_contracts c
set
  is_gav_applicable = true,
  gav_name = 'GAV Reinigungsbranche Deutschschweiz',
  thirteenth_salary_percentage = 100.0000,
  metadata = coalesce(c.metadata, '{}'::jsonb) || jsonb_build_object(
    'gav_role_classification_status', 'provisional_excel_assumption',
    'thirteenth_salary_payout_mode', 'annual_or_exit',
    'payroll_reconciliation_version', 'opc_payroll_reconciliation_v2',
    'updated_at', now()
  ),
  updated_at = now(),
  updated_by = auth.uid()
where c.contract_number = 'OPC-PAY-2026-000014';

-- Exact mixed hourly-rate rows from the authoritative Excel import.
do $$
declare
  v_count integer;
  v_minutes integer;
begin
  with expected(source_sheet, source_row, employee_id, hourly_rate_chf, expected_minutes) as (
    values
      ('Filip  OrangeProClean_Stundener', 7,  'e044673c-2f42-484d-8f8b-5427b696cc1e'::uuid, 30.00::numeric, 30),
      ('Filip  OrangeProClean_Stundener', 13, 'e044673c-2f42-484d-8f8b-5427b696cc1e'::uuid, 30.00::numeric, 570),
      ('Filip  OrangeProClean_Stundener', 33, 'e044673c-2f42-484d-8f8b-5427b696cc1e'::uuid, 30.00::numeric, 390),
      ('Filip  OrangeProClean_Stundener', 34, 'e044673c-2f42-484d-8f8b-5427b696cc1e'::uuid, 30.00::numeric, 540),
      ('Herminia Monteiro OrangeProClea', 11, '9ea589e4-5624-4108-bad2-6ab00a63a47d'::uuid, 25.00::numeric, 180),
      ('Herminia Monteiro OrangeProClea', 12, '9ea589e4-5624-4108-bad2-6ab00a63a47d'::uuid, 25.00::numeric, 180),
      ('Herminia Monteiro OrangeProClea', 15, '9ea589e4-5624-4108-bad2-6ab00a63a47d'::uuid, 25.00::numeric, 180),
      ('Herminia Monteiro OrangeProClea', 16, '9ea589e4-5624-4108-bad2-6ab00a63a47d'::uuid, 25.00::numeric, 180)
  )
  select count(*), coalesce(sum(te.total_minutes), 0)
  into v_count, v_minutes
  from expected x
  join public.opc_employee_time_entries te
    on te.employee_id = x.employee_id
   and te.metadata ->> 'source_sheet' = x.source_sheet
   and (te.metadata ->> 'source_row')::integer = x.source_row
   and te.total_minutes = x.expected_minutes
   and te.status = 'approved';

  if v_count <> 8 or v_minutes <> 2250 then
    raise exception
      'Mixed-rate preflight failed. Expected 8 rows / 2250 minutes, found % rows / % minutes.',
      v_count, v_minutes;
  end if;
end
$$;

with expected(source_sheet, source_row, employee_id, hourly_rate_chf) as (
  values
    ('Filip  OrangeProClean_Stundener', 7,  'e044673c-2f42-484d-8f8b-5427b696cc1e'::uuid, 30.00::numeric),
    ('Filip  OrangeProClean_Stundener', 13, 'e044673c-2f42-484d-8f8b-5427b696cc1e'::uuid, 30.00::numeric),
    ('Filip  OrangeProClean_Stundener', 33, 'e044673c-2f42-484d-8f8b-5427b696cc1e'::uuid, 30.00::numeric),
    ('Filip  OrangeProClean_Stundener', 34, 'e044673c-2f42-484d-8f8b-5427b696cc1e'::uuid, 30.00::numeric),
    ('Herminia Monteiro OrangeProClea', 11, '9ea589e4-5624-4108-bad2-6ab00a63a47d'::uuid, 25.00::numeric),
    ('Herminia Monteiro OrangeProClea', 12, '9ea589e4-5624-4108-bad2-6ab00a63a47d'::uuid, 25.00::numeric),
    ('Herminia Monteiro OrangeProClea', 15, '9ea589e4-5624-4108-bad2-6ab00a63a47d'::uuid, 25.00::numeric),
    ('Herminia Monteiro OrangeProClea', 16, '9ea589e4-5624-4108-bad2-6ab00a63a47d'::uuid, 25.00::numeric)
), matched as (
  select
    te.id as time_entry_id,
    te.employee_id,
    x.hourly_rate_chf,
    (
      select c.id
      from public.opc_employment_contracts c
      where c.employee_id = te.employee_id
        and c.salary_type = 'hourly'
        and c.status in ('active','approved')
        and c.valid_from <= te.work_date
        and (c.valid_until is null or c.valid_until >= te.work_date)
      order by c.valid_from desc
      limit 1
    ) as contract_id,
    x.source_sheet,
    x.source_row
  from expected x
  join public.opc_employee_time_entries te
    on te.employee_id = x.employee_id
   and te.metadata ->> 'source_sheet' = x.source_sheet
   and (te.metadata ->> 'source_row')::integer = x.source_row
   and te.status = 'approved'
)
insert into public.opc_time_entry_pay_rates (
  time_entry_id,
  employee_id,
  contract_id,
  hourly_rate_chf,
  rate_source,
  notes,
  metadata
)
select
  m.time_entry_id,
  m.employee_id,
  m.contract_id,
  m.hourly_rate_chf,
  'excel_reconciliation',
  'Abweichender Rollen-/Einsatzsatz aus Excel 24.06.2026-23.07.2026',
  jsonb_build_object(
    'source_sheet', m.source_sheet,
    'source_row', m.source_row,
    'reconciliation_version', 'opc_payroll_reconciliation_v2'
  )
from matched m
on conflict (time_entry_id) do update
set
  employee_id = excluded.employee_id,
  contract_id = excluded.contract_id,
  hourly_rate_chf = excluded.hourly_rate_chf,
  rate_source = excluded.rate_source,
  notes = excluded.notes,
  metadata = coalesce(public.opc_time_entry_pay_rates.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now(),
  updated_by = auth.uid();

-- Herminia: the Excel total contains 9 hours dated 10/12 June, outside the printed period.
-- Keep original work dates, but include them as a disclosed carryover in this exact payroll period.
update public.opc_employee_time_entries te
set
  metadata = coalesce(te.metadata, '{}'::jsonb) || jsonb_build_object(
    'payroll_period_override_from', '2026-06-24',
    'payroll_period_override_to', '2026-07-23',
    'payroll_period_override_reason', 'Excel total includes pre-period hours as carryover',
    'payroll_reconciliation_version', 'opc_payroll_reconciliation_v2'
  ),
  updated_at = now()
where te.employee_id = '9ea589e4-5624-4108-bad2-6ab00a63a47d'::uuid
  and te.metadata ->> 'source_sheet' = 'Herminia Monteiro OrangeProClea'
  and (te.metadata ->> 'source_row')::integer in (10, 11, 12)
  and te.status = 'approved';

-- Period-specific advance, not a recurring employee-profile deduction.
insert into public.opc_payroll_period_adjustments (
  employee_id, period_from, period_to, adjustment_type, code,
  description, amount_chf, direction, affects_payout, status, sort_order, metadata
)
values (
  'b62debc3-0115-4b4c-b536-240602cd11a2'::uuid,
  date '2026-06-24', date '2026-07-23',
  'advance', 'ADVANCE_20260712',
  'Vorschuss / bereits ausbezahlt am 12.07.2026',
  130.00, 'deduction', true, 'active', 180,
  jsonb_build_object('source', 'excel', 'paid_by', 'Sara', 'reconciliation_version', 'opc_payroll_reconciliation_v2')
)
on conflict (employee_id, period_from, period_to, code) do update
set
  amount_chf = excluded.amount_chf,
  description = excluded.description,
  status = 'active',
  metadata = excluded.metadata,
  updated_at = now(),
  updated_by = auth.uid();

-- Sebastian's CHF 99.75 expenses are shown in Excel as separate/already handled,
-- therefore they are disclosed but not added to the payroll payout.
insert into public.opc_payroll_period_adjustments (
  employee_id, period_from, period_to, adjustment_type, code,
  description, amount_chf, direction, affects_payout, status, sort_order, metadata
)
values (
  '0f82f804-f1a4-4eb8-a9da-4bb11d62ff83'::uuid,
  date '2026-06-24', date '2026-07-23',
  'reimbursement', 'EXPENSES_SEPARATE_202607',
  'Spesen gemäss Excel separat behandelt',
  99.75, 'addition', false, 'active', 315,
  jsonb_build_object('source', 'excel', 'paid_separately', true, 'reconciliation_version', 'opc_payroll_reconciliation_v2')
)
on conflict (employee_id, period_from, period_to, code) do update
set
  amount_chf = excluded.amount_chf,
  description = excluded.description,
  affects_payout = false,
  status = 'active',
  metadata = excluded.metadata,
  updated_at = now(),
  updated_by = auth.uid();

-- Reference figures for the reconciliation audit.
create table if not exists public.opc_payroll_reconciliation_reference (
  employee_id uuid not null references public.opc_employees(id) on delete cascade,
  period_from date not null,
  period_to date not null,
  excel_gross_chf numeric(14,2) not null,
  excel_payout_chf numeric(14,2) not null,
  corrected_gross_chf numeric(14,2) not null,
  corrected_payout_chf numeric(14,2) not null,
  status text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  primary key (employee_id, period_from, period_to)
);

alter table public.opc_payroll_reconciliation_reference enable row level security;
drop policy if exists opc_payroll_reconciliation_reference_owner_select
  on public.opc_payroll_reconciliation_reference;
create policy opc_payroll_reconciliation_reference_owner_select
  on public.opc_payroll_reconciliation_reference
  for select to authenticated
  using (public.opc_can_manage_payroll());
grant select on public.opc_payroll_reconciliation_reference to authenticated;

insert into public.opc_payroll_reconciliation_reference (
  employee_id, period_from, period_to,
  excel_gross_chf, excel_payout_chf,
  corrected_gross_chf, corrected_payout_chf,
  status, notes, metadata
)
values
  ('da084053-d67a-4d65-984b-bc2ae2880a1c', '2026-06-24', '2026-07-23', 1350.80, 1170.06, 1392.81, 1206.46, 'excel_understates', 'Special-cleaning minimum wage and public-holiday compensation missing in Excel.', '{}'::jsonb),
  ('e044673c-2f42-484d-8f8b-5427b696cc1e', '2026-06-24', '2026-07-23', 4031.13, 3491.76, 4116.42, 3565.64, 'excel_understates', 'Mixed rates preserved; public-holiday compensation missing in Excel.', '{}'::jsonb),
  ('8742eba5-ce71-45a3-a457-489120190cab', '2026-06-24', '2026-07-23', 1930.50, 1757.14, 2020.66, 1839.20, 'excel_understates', '13th salary is accrued, not paid; special minimum wage and public-holiday compensation added.', '{}'::jsonb),
  ('b62debc3-0115-4b4c-b536-240602cd11a2', '2026-06-24', '2026-07-23', 1529.00, 1194.42, 1551.94, 1214.28, 'excel_understates', 'Public-holiday compensation added; CHF 130 advance retained.', '{}'::jsonb),
  ('63a0e241-5383-445e-b778-3136d0e3cdbe', '2026-06-24', '2026-07-23', 469.50, 427.34, 483.79, 440.34, 'excel_understates', 'Public-holiday compensation missing in Excel; NBU classification remains policy-dependent.', '{}'::jsonb),
  ('c8dc9896-c3b7-4ef1-9f48-b32a8ae295fa', '2026-06-24', '2026-07-23', 660.00, 571.69, 715.80, 620.02, 'excel_understates', 'Special-cleaning minimum wage and public-holiday compensation missing in Excel.', '{}'::jsonb),
  ('9ea589e4-5624-4108-bad2-6ab00a63a47d', '2026-06-24', '2026-07-23', 762.00, 693.57, 773.43, 703.98, 'excel_period_inconsistent', 'Excel includes 9 hours dated before 24 June; treated as disclosed carryover. Public-holiday compensation added.', '{}'::jsonb),
  ('0f82f804-f1a4-4eb8-a9da-4bb11d62ff83', '2026-06-24', '2026-07-23', 3201.00, 2772.71, 3316.34, 2872.60, 'excel_understates', 'Special-cleaning minimum wage and public-holiday compensation added; CHF 99.75 expenses remain separate.', '{}'::jsonb),
  ('d1428879-542b-42a0-9555-a7e13a0ea875', '2026-07-01', '2026-07-31', 5000.00, 4151.00, 5000.00, 4151.00, 'matches_provisional_inputs', 'BVG CHF 140 and source tax 5.2% are provisional Excel estimates; GAV role classification requires confirmation.', '{}'::jsonb),
  ('63f682f1-4c4f-4948-82ba-07bc028fc0c3', '2026-07-01', '2026-07-31', 6803.50, 6000.00, 6803.50, 6000.05, 'excel_arithmetic_error', 'Exact rounded deductions total CHF 803.45, not CHF 803.50. BVG CHF 219.70 remains provisional.', '{}'::jsonb)
on conflict (employee_id, period_from, period_to) do update
set
  excel_gross_chf = excluded.excel_gross_chf,
  excel_payout_chf = excluded.excel_payout_chf,
  corrected_gross_chf = excluded.corrected_gross_chf,
  corrected_payout_chf = excluded.corrected_payout_chf,
  status = excluded.status,
  notes = excluded.notes,
  metadata = excluded.metadata;

commit;

-- Compact result.
select
  e.employee_number,
  concat_ws(' ', e.legal_first_name, e.legal_last_name) as employee_name,
  r.period_from,
  r.period_to,
  r.excel_gross_chf,
  r.corrected_gross_chf,
  r.excel_payout_chf,
  r.corrected_payout_chf,
  r.status,
  r.notes
from public.opc_payroll_reconciliation_reference r
join public.opc_employees e on e.id = r.employee_id
order by r.period_from, employee_name;
