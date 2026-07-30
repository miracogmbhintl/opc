-- Orange Pro Clean GmbH
-- Payroll Reconciliation V2.2
-- Management correction: all work in the payroll period 24.06.2026–23.07.2026
-- was normal Unterhaltsreinigung. No Spezialreinigung was performed.
--
-- This migration:
--   1. explicitly tags the relevant approved time entries as maintenance;
--   2. updates the reconciliation targets to 1.5% public-holiday compensation;
--   3. removes all special-cleaning minimum-wage effects for this period;
--   4. cancels already approved, unpaid test payroll runs that contain the
--      superseded V2 special-cleaning calculation, without deleting their audit trail.
--
-- Mixed personal/role rates for Filip and Herminia remain unchanged.
-- Vacation salary and 13th salary remain accrued, not paid in this period.
--
-- Idempotent.

begin;
set local time zone 'Europe/Zurich';

do $$
begin
  if to_regclass('public.opc_employee_time_entries') is null then
    raise exception 'opc_employee_time_entries fehlt';
  end if;
  if to_regclass('public.opc_payroll_reconciliation_reference') is null then
    raise exception 'opc_payroll_reconciliation_reference fehlt. Zuerst Reconciliation V2 installieren.';
  end if;
  if to_regclass('public.opc_payroll_rule_sets') is null then
    raise exception 'opc_payroll_rule_sets fehlt';
  end if;
  if to_regclass('public.opc_payroll_runs') is null then
    raise exception 'opc_payroll_runs fehlt';
  end if;
end
$$;

create table if not exists
  public.opc_employee_time_entries_backup_20260730_maintenance_v2_2
as
select te.*
from public.opc_employee_time_entries te
where te.employee_id in (
  'da084053-d67a-4d65-984b-bc2ae2880a1c'::uuid,
  'e044673c-2f42-484d-8f8b-5427b696cc1e'::uuid,
  '9ea589e4-5624-4108-bad2-6ab00a63a47d'::uuid,
  'b62debc3-0115-4b4c-b536-240602cd11a2'::uuid,
  '8742eba5-ce71-45a3-a457-489120190cab'::uuid,
  '63a0e241-5383-445e-b778-3136d0e3cdbe'::uuid,
  'c8dc9896-c3b7-4ef1-9f48-b32a8ae295fa'::uuid,
  '0f82f804-f1a4-4eb8-a9da-4bb11d62ff83'::uuid
)
and te.status = 'approved'
and (
  te.work_date between date '2026-06-24' and date '2026-07-23'
  or (
    te.metadata ->> 'payroll_period_override_from' = '2026-06-24'
    and te.metadata ->> 'payroll_period_override_to' = '2026-07-23'
  )
);

-- Explicit management classification. This overrides any customer/job wording.
update public.opc_employee_time_entries te
set
  metadata = coalesce(te.metadata, '{}'::jsonb) || jsonb_build_object(
    'payroll_cleaning_category', 'maintenance',
    'payroll_cleaning_category_label', 'Unterhaltsreinigung',
    'payroll_category_source', 'management_confirmation',
    'payroll_category_confirmed_at', now(),
    'payroll_reconciliation_version', 'opc_payroll_reconciliation_v2_2_maintenance'
  ),
  updated_at = now()
where te.employee_id in (
  'da084053-d67a-4d65-984b-bc2ae2880a1c'::uuid,
  'e044673c-2f42-484d-8f8b-5427b696cc1e'::uuid,
  '9ea589e4-5624-4108-bad2-6ab00a63a47d'::uuid,
  'b62debc3-0115-4b4c-b536-240602cd11a2'::uuid,
  '8742eba5-ce71-45a3-a457-489120190cab'::uuid,
  '63a0e241-5383-445e-b778-3136d0e3cdbe'::uuid,
  'c8dc9896-c3b7-4ef1-9f48-b32a8ae295fa'::uuid,
  '0f82f804-f1a4-4eb8-a9da-4bb11d62ff83'::uuid
)
and te.status = 'approved'
and (
  te.work_date between date '2026-06-24' and date '2026-07-23'
  or (
    te.metadata ->> 'payroll_period_override_from' = '2026-06-24'
    and te.metadata ->> 'payroll_period_override_to' = '2026-07-23'
  )
);

-- The engine may still support special cleaning in the future, but only through
-- an explicit payroll category. Text in customer names/job titles must not decide it.
update public.opc_payroll_rule_sets
set
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'payroll_category_classification_mode', 'explicit_only_default_maintenance',
    'default_payroll_cleaning_category', 'maintenance',
    'customer_and_job_text_classification_enabled', false,
    'payroll_reconciliation_version', 'opc_payroll_reconciliation_v2_2_maintenance',
    'updated_at', now()
  ),
  updated_at = now()
where rule_year = 2026
  and status = 'active';

-- Correct reference values: all hourly work is maintenance cleaning.
insert into public.opc_payroll_reconciliation_reference (
  employee_id, period_from, period_to,
  excel_gross_chf, excel_payout_chf,
  corrected_gross_chf, corrected_payout_chf,
  status, notes, metadata
)
values
  (
    'da084053-d67a-4d65-984b-bc2ae2880a1c', '2026-06-24', '2026-07-23',
    1350.80, 1170.06, 1371.06, 1187.61,
    'excel_understates',
    'All work confirmed as maintenance cleaning. Excel omits the 1.5% public-holiday supplement.',
    jsonb_build_object('cleaning_category', 'maintenance', 'version', 'v2_2')
  ),
  (
    'e044673c-2f42-484d-8f8b-5427b696cc1e', '2026-06-24', '2026-07-23',
    4031.13, 3491.76, 4091.60, 3544.15,
    'excel_understates',
    'Mixed hourly rates remain unchanged. All work is maintenance cleaning; Excel omits the 1.5% public-holiday supplement.',
    jsonb_build_object('cleaning_category', 'maintenance', 'version', 'v2_2')
  ),
  (
    '9ea589e4-5624-4108-bad2-6ab00a63a47d', '2026-06-24', '2026-07-23',
    762.00, 693.57, 773.43, 703.98,
    'excel_period_inconsistent',
    'Excel includes 9 carryover hours dated before 24 June. All work is maintenance cleaning; 1.5% public-holiday supplement added.',
    jsonb_build_object('cleaning_category', 'maintenance', 'version', 'v2_2')
  ),
  (
    'b62debc3-0115-4b4c-b536-240602cd11a2', '2026-06-24', '2026-07-23',
    1529.00, 1194.42, 1551.94, 1214.28,
    'excel_understates',
    'All work is maintenance cleaning. 1.5% public-holiday supplement added; CHF 130 advance retained.',
    jsonb_build_object('cleaning_category', 'maintenance', 'version', 'v2_2')
  ),
  (
    '8742eba5-ce71-45a3-a457-489120190cab', '2026-06-24', '2026-07-23',
    1930.50, 1757.14, 1959.46, 1783.50,
    'excel_understates',
    'One contractual hourly rate of CHF 22.00. All work is maintenance cleaning. Excel omits the 1.5% public-holiday supplement. 13th salary is accrued, not paid.',
    jsonb_build_object('cleaning_category', 'maintenance', 'version', 'v2_2')
  ),
  (
    '63a0e241-5383-445e-b778-3136d0e3cdbe', '2026-06-24', '2026-07-23',
    469.50, 427.34, 476.54, 433.74,
    'excel_understates',
    'One hourly rate of CHF 30.00. All work is maintenance cleaning. Excel omits the 1.5% public-holiday supplement; NBU remains policy-dependent.',
    jsonb_build_object('cleaning_category', 'maintenance', 'version', 'v2_2')
  ),
  (
    'c8dc9896-c3b7-4ef1-9f48-b32a8ae295fa', '2026-06-24', '2026-07-23',
    660.00, 571.69, 669.90, 580.27,
    'excel_understates',
    'All work confirmed as maintenance cleaning. Excel omits the 1.5% public-holiday supplement.',
    jsonb_build_object('cleaning_category', 'maintenance', 'version', 'v2_2')
  ),
  (
    '0f82f804-f1a4-4eb8-a9da-4bb11d62ff83', '2026-06-24', '2026-07-23',
    3201.00, 2772.71, 3249.02, 2814.29,
    'excel_understates',
    'All work is maintenance cleaning. Excel omits the 1.5% public-holiday supplement; CHF 99.75 expenses remain separate.',
    jsonb_build_object('cleaning_category', 'maintenance', 'version', 'v2_2')
  ),
  (
    'd1428879-542b-42a0-9555-a7e13a0ea875', '2026-07-01', '2026-07-31',
    5000.00, 4151.00, 5000.00, 4151.00,
    'matches_provisional_inputs',
    'BVG CHF 140 and source tax 5.2% remain provisional Excel estimates.',
    jsonb_build_object('version', 'v2_2')
  ),
  (
    '63f682f1-4c4f-4948-82ba-07bc028fc0c3', '2026-07-01', '2026-07-31',
    6803.50, 6000.00, 6803.50, 6000.05,
    'excel_arithmetic_error',
    'Exact rounded deductions total CHF 803.45, not CHF 803.50. BVG CHF 219.70 remains provisional.',
    jsonb_build_object('version', 'v2_2')
  )
on conflict (employee_id, period_from, period_to) do update
set
  excel_gross_chf = excluded.excel_gross_chf,
  excel_payout_chf = excluded.excel_payout_chf,
  corrected_gross_chf = excluded.corrected_gross_chf,
  corrected_payout_chf = excluded.corrected_payout_chf,
  status = excluded.status,
  notes = excluded.notes,
  metadata = coalesce(public.opc_payroll_reconciliation_reference.metadata, '{}'::jsonb)
    || excluded.metadata;

-- Preserve immutability but permit an approved, unpaid payroll run to be cancelled.
create or replace function public.opc_guard_finalized_payroll_run()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status in ('approved', 'paid') then
    if tg_op = 'UPDATE'
       and old.status = 'approved'
       and new.status = 'cancelled'
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

-- Cancel only approved/unpaid test runs whose stored totals no longer match
-- the corrected management-confirmed reconciliation target.
update public.opc_payroll_runs r
set
  status = 'cancelled',
  metadata = coalesce(r.metadata, '{}'::jsonb) || jsonb_build_object(
    'cancelled_reason', 'Superseded automatic special-cleaning classification',
    'cancelled_by_migration', 'opc_payroll_reconciliation_v2_2_maintenance',
    'cancelled_at', now(),
    'replacement_required', true
  ),
  updated_at = now(),
  updated_by = auth.uid()
from public.opc_payroll_reconciliation_reference ref
where r.employee_id = ref.employee_id
  and r.period_from = ref.period_from
  and r.period_to = ref.period_to
  and r.status = 'approved'
  and r.paid_at is null
  and (
    r.total_gross_chf is distinct from ref.corrected_gross_chf
    or r.total_payout_chf is distinct from ref.corrected_payout_chf
  )
  and coalesce(r.metadata ->> 'calculation_version', '') in (
    'opc_payroll_reconciliation_v2',
    'opc_payroll_reconciliation_v2_1_clean'
  );

do $$
declare
  v_special_count integer;
  v_unclassified_count integer;
begin
  select count(*)
  into v_special_count
  from public.opc_employee_time_entries te
  where te.employee_id in (
    'da084053-d67a-4d65-984b-bc2ae2880a1c'::uuid,
    'e044673c-2f42-484d-8f8b-5427b696cc1e'::uuid,
    '9ea589e4-5624-4108-bad2-6ab00a63a47d'::uuid,
    'b62debc3-0115-4b4c-b536-240602cd11a2'::uuid,
    '8742eba5-ce71-45a3-a457-489120190cab'::uuid,
    '63a0e241-5383-445e-b778-3136d0e3cdbe'::uuid,
    'c8dc9896-c3b7-4ef1-9f48-b32a8ae295fa'::uuid,
    '0f82f804-f1a4-4eb8-a9da-4bb11d62ff83'::uuid
  )
  and te.status = 'approved'
  and (
    te.work_date between date '2026-06-24' and date '2026-07-23'
    or (
      te.metadata ->> 'payroll_period_override_from' = '2026-06-24'
      and te.metadata ->> 'payroll_period_override_to' = '2026-07-23'
    )
  )
  and te.metadata ->> 'payroll_cleaning_category' = 'special';

  select count(*)
  into v_unclassified_count
  from public.opc_employee_time_entries te
  where te.employee_id in (
    'da084053-d67a-4d65-984b-bc2ae2880a1c'::uuid,
    'e044673c-2f42-484d-8f8b-5427b696cc1e'::uuid,
    '9ea589e4-5624-4108-bad2-6ab00a63a47d'::uuid,
    'b62debc3-0115-4b4c-b536-240602cd11a2'::uuid,
    '8742eba5-ce71-45a3-a457-489120190cab'::uuid,
    '63a0e241-5383-445e-b778-3136d0e3cdbe'::uuid,
    'c8dc9896-c3b7-4ef1-9f48-b32a8ae295fa'::uuid,
    '0f82f804-f1a4-4eb8-a9da-4bb11d62ff83'::uuid
  )
  and te.status = 'approved'
  and (
    te.work_date between date '2026-06-24' and date '2026-07-23'
    or (
      te.metadata ->> 'payroll_period_override_from' = '2026-06-24'
      and te.metadata ->> 'payroll_period_override_to' = '2026-07-23'
    )
  )
  and coalesce(te.metadata ->> 'payroll_cleaning_category', '') <> 'maintenance';

  if v_special_count <> 0 or v_unclassified_count <> 0 then
    raise exception
      'Kategorisierung fehlgeschlagen: special %, nicht maintenance %.',
      v_special_count,
      v_unclassified_count;
  end if;
end
$$;

commit;

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
