-- Orange Pro Clean GmbH
-- Transactional service-job deletion.
-- The API authenticates/authorizes the actor; this RPC guarantees that local
-- assignment/calendar/job changes are committed together or not at all.

begin;

create or replace function public.opc_delete_service_job_atomic(
  p_job_id uuid,
  p_actor_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_ids uuid[] := '{}'::uuid[];
  v_deleted_count integer := 0;
begin
  if p_job_id is null then
    raise exception 'job_id fehlt.';
  end if;

  if not exists (select 1 from public.opc_service_jobs where id = p_job_id) then
    return jsonb_build_object(
      'job_id', p_job_id,
      'deleted', true,
      'already_missing', true,
      'removed_legacy_calendar_event_count', 0
    );
  end if;

  select coalesce(array_agg(distinct e.id), '{}'::uuid[])
    into v_event_ids
  from public.opc_calendar_events e
  where e.job_id = p_job_id
     or e.metadata @> jsonb_build_object('job_id', p_job_id::text)
     or e.metadata @> jsonb_build_object('source_job_id', p_job_id::text);

  update public.opc_job_assignments
  set status = 'removed',
      updated_at = now()
  where job_id = p_job_id
    and lower(coalesce(status, '')) not in (
      'removed','unassigned','cancelled','canceled','deleted','inactive','rejected'
    );

  if coalesce(array_length(v_event_ids, 1), 0) > 0 then
    delete from public.opc_calendar_event_attendees
    where event_id = any(v_event_ids);

    delete from public.opc_calendar_events
    where id = any(v_event_ids);
  end if;

  delete from public.opc_service_jobs
  where id = p_job_id;

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count <> 1 then
    raise exception 'Einsatz konnte nicht atomar gelöscht werden.';
  end if;

  return jsonb_build_object(
    'job_id', p_job_id,
    'deleted', true,
    'hard_deleted', true,
    'removed_legacy_calendar_event_count', coalesce(array_length(v_event_ids, 1), 0),
    'actor_user_id', p_actor_user_id
  );
end
$$;

revoke all on function public.opc_delete_service_job_atomic(uuid, uuid) from public, anon, authenticated;
grant execute on function public.opc_delete_service_job_atomic(uuid, uuid) to service_role;

commit;
