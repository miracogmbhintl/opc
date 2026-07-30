-- Orange Pro Clean GmbH
-- Migel Mirkovic: employment ended immediately on 03.07.2026.
-- The employment contract remains permanent in type, but is historically
-- bounded by valid_until. This prevents payroll after the confirmed end date.
-- Idempotent.

begin;
set local time zone 'Europe/Zurich';

do $$
begin
  if to_regclass('public.opc_employment_contracts') is null then
    raise exception 'public.opc_employment_contracts fehlt';
  end if;
end
$$;

create table if not exists
  public.opc_employment_contracts_backup_20260730_migel_end
as
select c.*
from public.opc_employment_contracts c
where c.contract_number = 'OPC-PAY-2026-000013';

update public.opc_employment_contracts c
set
  valid_until = date '2026-07-03',
  planned_end_date = date '2026-07-03',
  metadata = coalesce(c.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'employment_end_confirmed',
        true,
      'employment_end_date',
        '2026-07-03',
      'employment_end_basis',
        'management_confirmation_immediate_termination',
      'employment_end_recorded_at',
        now()
    ),
  notes = case
    when coalesce(c.notes, '') ilike '%Kündigung per 03.07.2026%'
      then c.notes
    when nullif(btrim(coalesce(c.notes, '')), '') is null
      then 'Kündigung per 03.07.2026 mit sofortiger Wirkung; letzter Lohnabrechnungszeitraum endet am 03.07.2026.'
    else c.notes
      || E'\nKündigung per 03.07.2026 mit sofortiger Wirkung; letzter Lohnabrechnungszeitraum endet am 03.07.2026.'
  end,
  updated_at = now(),
  updated_by = auth.uid()
where c.contract_number = 'OPC-PAY-2026-000013';

do $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.opc_employment_contracts c
  where c.contract_number = 'OPC-PAY-2026-000013'
    and c.employee_id =
      '63a0e241-5383-445e-b778-3136d0e3cdbe'::uuid
    and c.valid_until = date '2026-07-03'
    and c.planned_end_date = date '2026-07-03';

  if v_count <> 1 then
    raise exception
      'Migel-Vertragsende konnte nicht eindeutig gespeichert werden.';
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
  c.planned_end_date,
  c.workload_model
from public.opc_employment_contracts c
join public.opc_employees e
  on e.id = c.employee_id
where c.contract_number = 'OPC-PAY-2026-000013';
