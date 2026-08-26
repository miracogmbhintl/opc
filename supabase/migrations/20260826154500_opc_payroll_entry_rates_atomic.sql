begin;

create or replace function public.opc_replace_time_entry_pay_rates_atomic(
  p_employee_id uuid,
  p_rates jsonb,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row jsonb;
  v_time_entry_id uuid;
  v_contract_id uuid;
  v_rate numeric;
  v_saved integer := 0;
  v_deleted integer := 0;
  v_entry record;
begin
  if p_employee_id is null then raise exception 'Mitarbeiter-ID fehlt.'; end if;
  if p_rates is null or jsonb_typeof(p_rates) <> 'array' then raise exception 'Ungültige Stundenansätze.'; end if;
  if jsonb_array_length(p_rates) > 500 then raise exception 'Maximal 500 Stundenansätze pro Anfrage.'; end if;

  perform pg_advisory_xact_lock(hashtextextended('opc-pay-rates:' || p_employee_id::text, 0));

  for v_row in select value from jsonb_array_elements(p_rates) loop
    v_time_entry_id := nullif(v_row->>'time_entry_id','')::uuid;
    if v_time_entry_id is null then continue; end if;

    select id, employee_id, status
      into v_entry
    from public.opc_employee_time_entries
    where id = v_time_entry_id
    for share;

    if v_entry.id is null
       or v_entry.employee_id is distinct from p_employee_id
       or v_entry.status <> 'approved' then
      raise exception 'Zeiteintrag % gehört nicht zum Mitarbeiter oder ist nicht genehmigt.', v_time_entry_id;
    end if;

    v_rate := nullif(v_row->>'hourly_rate_chf','')::numeric;
    v_contract_id := nullif(v_row->>'contract_id','')::uuid;

    if v_rate is null or v_rate <= 0 then
      delete from public.opc_time_entry_pay_rates
      where employee_id = p_employee_id and time_entry_id = v_time_entry_id;
      if found then v_deleted := v_deleted + 1; end if;
      continue;
    end if;

    insert into public.opc_time_entry_pay_rates (
      time_entry_id, employee_id, contract_id, hourly_rate_chf, rate_source,
      notes, metadata, created_by, updated_by
    ) values (
      v_time_entry_id,
      p_employee_id,
      v_contract_id,
      v_rate,
      coalesce(nullif(v_row->>'rate_source',''),'manual'),
      nullif(v_row->>'notes',''),
      coalesce(v_row->'metadata','{}'::jsonb),
      p_actor_user_id,
      p_actor_user_id
    )
    on conflict (time_entry_id) do update set
      employee_id = excluded.employee_id,
      contract_id = excluded.contract_id,
      hourly_rate_chf = excluded.hourly_rate_chf,
      rate_source = excluded.rate_source,
      notes = excluded.notes,
      metadata = excluded.metadata,
      updated_by = excluded.updated_by,
      updated_at = now();

    v_saved := v_saved + 1;
  end loop;

  return jsonb_build_object('saved', v_saved, 'deleted', v_deleted);
end
$$;

revoke all on function public.opc_replace_time_entry_pay_rates_atomic(uuid,jsonb,uuid)
  from public, anon, authenticated;
grant execute on function public.opc_replace_time_entry_pay_rates_atomic(uuid,jsonb,uuid)
  to service_role;

commit;
