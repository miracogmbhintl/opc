-- Orange Pro Clean GmbH
-- Repair: open-ended payroll contracts must not be classified as fixed_term.
-- Idempotent and limited to the ten payroll backfill contracts.

begin;

do $$
begin
  if to_regclass('public.opc_employment_contracts') is null then
    raise exception 'public.opc_employment_contracts fehlt';
  end if;

  if to_regprocedure(
    'public.opc_resolve_employment_contract_type(text,date)'
  ) is null then
    raise exception
      'public.opc_resolve_employment_contract_type(text,date) fehlt';
  end if;
end
$$;

create table if not exists
  public.opc_employment_contracts_backup_20260728_contract_type_repair
as
select c.*
from public.opc_employment_contracts c
where c.contract_number in (
  'OPC-PAY-2026-000010',
  'OPC-PAY-2026-000011',
  'OPC-PAY-2026-000019',
  'OPC-PAY-2026-000006',
  'OPC-PAY-2026-000007',
  'OPC-PAY-2026-000013',
  'OPC-PAY-2026-000016',
  'OPC-PAY-2026-000015',
  'OPC-PAY-2026-000014',
  'OPC-PAY-2026-000005'
);

update public.opc_employment_contracts c
set
  contract_type = public.opc_resolve_employment_contract_type(
    c.salary_type,
    null::date
  ),
  planned_duration_type = 'indefinite',
  planned_end_date = null,
  metadata = coalesce(c.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'contract_type_repair',
        'opc_contract_type_permanent_repair_v1',
      'repair_reason',
        'open_ended_contract_was_incorrectly_resolved_with_valid_from_as_valid_until',
      'repaired_at',
        now()
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
  'OPC-PAY-2026-000015',
  'OPC-PAY-2026-000014',
  'OPC-PAY-2026-000005'
)
  and c.valid_until is null;

do $$
declare
  v_bad_count integer;
begin
  select count(*)
  into v_bad_count
  from public.opc_employment_contracts c
  where c.contract_number in (
    'OPC-PAY-2026-000010',
    'OPC-PAY-2026-000011',
    'OPC-PAY-2026-000019',
    'OPC-PAY-2026-000006',
    'OPC-PAY-2026-000007',
    'OPC-PAY-2026-000013',
    'OPC-PAY-2026-000016',
    'OPC-PAY-2026-000015',
    'OPC-PAY-2026-000014',
    'OPC-PAY-2026-000005'
  )
    and (
      c.valid_until is not null
      or c.contract_type is distinct from
        public.opc_resolve_employment_contract_type(
          c.salary_type,
          null::date
        )
      or c.planned_duration_type is distinct from 'indefinite'
      or c.planned_end_date is not null
    );

  if v_bad_count <> 0 then
    raise exception
      'Contract-Type-Reparatur fehlgeschlagen: % Verträge sind weiterhin inkonsistent.',
      v_bad_count;
  end if;
end
$$;

commit;

select
  e.employee_number,
  concat_ws(
    ' ',
    e.legal_first_name,
    e.legal_last_name
  ) as employee_name,
  c.contract_number,
  c.contract_type,
  c.salary_type,
  c.valid_from,
  c.valid_until,
  c.planned_duration_type,
  c.planned_end_date,
  c.workload_model,
  c.weekly_hours,
  c.reference_weekly_hours,
  c.guaranteed_weekly_hours
from public.opc_employment_contracts c
join public.opc_employees e
  on e.id = c.employee_id
where c.contract_number in (
  'OPC-PAY-2026-000010',
  'OPC-PAY-2026-000011',
  'OPC-PAY-2026-000019',
  'OPC-PAY-2026-000006',
  'OPC-PAY-2026-000007',
  'OPC-PAY-2026-000013',
  'OPC-PAY-2026-000016',
  'OPC-PAY-2026-000015',
  'OPC-PAY-2026-000014',
  'OPC-PAY-2026-000005'
)
order by employee_name;
