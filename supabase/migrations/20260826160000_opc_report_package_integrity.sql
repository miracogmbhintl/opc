begin;

create or replace function public.opc_guard_client_report_package_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.report_id is not null then
    if exists (
      select 1
      from public.opc_client_report_packages p
      where p.report_id = new.report_id
        and p.id is distinct from new.id
    ) then
      raise exception 'Für diesen Bericht existiert bereits eine Kundenansicht.'
        using errcode = '23505';
    end if;
  elsif new.job_id is not null then
    if exists (
      select 1
      from public.opc_client_report_packages p
      where p.report_id is null
        and p.job_id = new.job_id
        and p.id is distinct from new.id
    ) then
      raise exception 'Für diesen Einsatz existiert bereits eine Kundenansicht ohne Bericht-ID.'
        using errcode = '23505';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists trg_opc_guard_client_report_package_identity
  on public.opc_client_report_packages;
create trigger trg_opc_guard_client_report_package_identity
  before insert or update of report_id, job_id
  on public.opc_client_report_packages
  for each row execute function public.opc_guard_client_report_package_identity();

create or replace function public.opc_sync_report_sent_from_client_package()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_table text;
  v_where text;
  v_set text;
  v_count integer;
  v_total integer := 0;
  v_has_id boolean;
  v_has_report_id boolean;
  v_has_job_id boolean;
  v_has_status boolean;
  v_has_sent boolean;
  v_has_updated boolean;
begin
  if coalesce(new.status, '') <> 'sent_to_client' then
    return new;
  end if;

  foreach v_table in array array['opc_job_reports','opc_reports'] loop
    if to_regclass('public.' || v_table) is null then
      continue;
    end if;

    select
      exists(select 1 from information_schema.columns where table_schema='public' and table_name=v_table and column_name='id'),
      exists(select 1 from information_schema.columns where table_schema='public' and table_name=v_table and column_name='report_id'),
      exists(select 1 from information_schema.columns where table_schema='public' and table_name=v_table and column_name='job_id'),
      exists(select 1 from information_schema.columns where table_schema='public' and table_name=v_table and column_name='status'),
      exists(select 1 from information_schema.columns where table_schema='public' and table_name=v_table and column_name='sent_to_client_at'),
      exists(select 1 from information_schema.columns where table_schema='public' and table_name=v_table and column_name='updated_at')
    into v_has_id, v_has_report_id, v_has_job_id, v_has_status, v_has_sent, v_has_updated;

    if not v_has_status then
      continue;
    end if;

    v_where := '';
    if new.report_id is not null then
      if v_has_id and v_has_report_id then
        v_where := '(id = $1 or report_id = $1)';
      elsif v_has_id then
        v_where := 'id = $1';
      elsif v_has_report_id then
        v_where := 'report_id = $1';
      end if;
    end if;

    if v_where = '' and new.job_id is not null and v_has_job_id then
      v_where := 'job_id = $2';
    end if;

    if v_where = '' then
      continue;
    end if;

    v_set := 'status = ''sent_to_client''';
    if v_has_sent then
      v_set := v_set || ', sent_to_client_at = coalesce(sent_to_client_at, $3)';
    end if;
    if v_has_updated then
      v_set := v_set || ', updated_at = now()';
    end if;

    execute format('update public.%I set %s where %s', v_table, v_set, v_where)
      using new.report_id, new.job_id, coalesce(new.sent_to_client_at, now());
    get diagnostics v_count = row_count;
    v_total := v_total + v_count;
  end loop;

  -- If a concrete report_id exists, package and report status are one logical
  -- operation. Never claim success when no canonical report row was updated.
  if new.report_id is not null and v_total = 0 then
    raise exception 'Bericht konnte nicht zusammen mit der Kundenansicht als gesendet markiert werden.';
  end if;

  return new;
end
$$;

drop trigger if exists trg_opc_sync_report_sent_from_client_package
  on public.opc_client_report_packages;
create trigger trg_opc_sync_report_sent_from_client_package
  after insert or update of status, sent_to_client_at
  on public.opc_client_report_packages
  for each row execute function public.opc_sync_report_sent_from_client_package();

commit;
