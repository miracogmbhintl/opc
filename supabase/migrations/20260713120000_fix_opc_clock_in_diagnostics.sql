begin;

create or replace function public.opc_clock_in_employee(
  p_employee_note text default null::text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_staff_role_id uuid;
  v_employee_id uuid;
  v_employee_name text;
  v_existing_id uuid;
  v_existing_work_date date;
  v_existing_status text;
  v_entry_id uuid;
begin
  if v_user_id is null then
    raise exception 'Nicht eingeloggt.';
  end if;

  select sr.id, sr.employee_id, sr.display_name
  into v_staff_role_id, v_employee_id, v_employee_name
  from public.opc_staff_roles sr
  where sr.user_id = v_user_id
    and lower(coalesce(sr.status, 'active')) in ('active', 'aktiv', 'enabled')
    and sr.can_access_portal = true
    and sr.can_submit_time_logs = true
  order by sr.created_at desc
  limit 1;

  if v_staff_role_id is null then
    raise exception 'Kein aktives Mitarbeiterprofil mit Zeiterfassungsrecht.';
  end if;

  select te.id, te.work_date, te.status
  into v_existing_id, v_existing_work_date, v_existing_status
  from public.opc_employee_time_entries te
  where te.user_id = v_user_id
    and te.job_id is null
    and te.clock_out_at is null
    and te.status in ('open', 'on_break')
  order by te.created_at desc
  limit 1;

  if v_existing_id is not null then
    insert into public.opc_employee_time_entry_events (
      time_entry_id, user_id, staff_role_id, event_type, event_note, metadata
    )
    values (
      v_existing_id,
      v_user_id,
      v_staff_role_id,
      'clock_in',
      'Erneuter Startversuch bei bereits offenem Zeiteintrag',
      jsonb_build_object(
        'source', 'general_day_time',
        'existing_entry', true,
        'existing_work_date', v_existing_work_date,
        'existing_status', v_existing_status,
        'attempted_at', now()
      )
    );

    return v_existing_id;
  end if;

  insert into public.opc_employee_time_entries (
    user_id, staff_role_id, employee_id, employee_name,
    job_id, assignment_id, work_date, clock_in_at, status,
    employee_note, recording_method, metadata
  )
  values (
    v_user_id,
    v_staff_role_id,
    v_employee_id,
    coalesce(v_employee_name, 'Mitarbeiter'),
    null,
    null,
    timezone('Europe/Zurich', now())::date,
    now(),
    'open',
    nullif(trim(p_employee_note), ''),
    'self',
    jsonb_build_object('source', 'general_day_time')
  )
  returning id into v_entry_id;

  insert into public.opc_employee_time_entry_events (
    time_entry_id, user_id, staff_role_id, event_type, event_note, metadata
  )
  values (
    v_entry_id,
    v_user_id,
    v_staff_role_id,
    'clock_in',
    nullif(trim(p_employee_note), ''),
    jsonb_build_object('source', 'general_day_time')
  );

  return v_entry_id;
end;
$function$;

commit;
