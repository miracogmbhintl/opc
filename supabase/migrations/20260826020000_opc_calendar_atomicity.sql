-- Orange Pro Clean GmbH
-- Calendar atomicity + durable external Google cleanup tracking.

begin;
set local time zone 'Europe/Zurich';

create table if not exists public.opc_calendar_external_cleanup_queue (
  id uuid primary key default gen_random_uuid(),
  calendar_event_id uuid,
  google_account_id uuid,
  google_calendar_id text,
  google_event_id text,
  requested_by uuid,
  status text not null default 'pending' check (status in ('pending','done','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.opc_calendar_external_cleanup_queue enable row level security;
revoke all on public.opc_calendar_external_cleanup_queue from public, anon, authenticated;
grant select, insert, update, delete on public.opc_calendar_external_cleanup_queue to service_role;

create or replace function public.opc_save_calendar_event_atomic(
  p_event_id uuid,
  p_payload jsonb,
  p_attendees jsonb default '[]'::jsonb,
  p_actor_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_saved public.opc_calendar_events%rowtype;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Ungültiger Kalender-Payload.';
  end if;

  v_start := nullif(p_payload->>'starts_at', '')::timestamptz;
  v_end := nullif(p_payload->>'ends_at', '')::timestamptz;

  if v_start is null or v_end is null then
    raise exception 'Start- und Endzeit fehlen.';
  end if;

  if v_end <= v_start then
    raise exception 'Endzeit muss nach der Startzeit liegen.';
  end if;

  if p_event_id is null then
    insert into public.opc_calendar_events (
      calendar_id,
      event_type,
      status,
      title,
      description,
      starts_at,
      ends_at,
      timezone,
      is_all_day,
      location_name,
      location_address,
      client_id,
      contact_id,
      client_site_id,
      inquiry_id,
      job_id,
      source_channel,
      source_external_id,
      requires_acceptance,
      created_by,
      updated_by,
      metadata,
      google_sync_status,
      google_sync_error
    ) values (
      nullif(p_payload->>'calendar_id','')::uuid,
      coalesce(nullif(p_payload->>'event_type',''), 'internal'),
      coalesce(nullif(p_payload->>'status',''), 'confirmed'),
      nullif(p_payload->>'title',''),
      nullif(p_payload->>'description',''),
      v_start,
      v_end,
      coalesce(nullif(p_payload->>'timezone',''), 'Europe/Zurich'),
      coalesce((p_payload->>'is_all_day')::boolean, false),
      nullif(p_payload->>'location_name',''),
      nullif(p_payload->>'location_address',''),
      nullif(p_payload->>'client_id','')::uuid,
      nullif(p_payload->>'contact_id','')::uuid,
      nullif(p_payload->>'client_site_id','')::uuid,
      nullif(p_payload->>'inquiry_id','')::uuid,
      nullif(p_payload->>'job_id','')::uuid,
      coalesce(nullif(p_payload->>'source_channel',''), 'portal'),
      nullif(p_payload->>'source_external_id',''),
      coalesce((p_payload->>'requires_acceptance')::boolean, false),
      p_actor_user_id,
      p_actor_user_id,
      coalesce(p_payload->'metadata', '{}'::jsonb),
      'not_synced',
      null
    )
    returning * into v_saved;
  else
    update public.opc_calendar_events e
    set calendar_id = nullif(p_payload->>'calendar_id','')::uuid,
        event_type = coalesce(nullif(p_payload->>'event_type',''), e.event_type),
        status = coalesce(nullif(p_payload->>'status',''), e.status),
        title = nullif(p_payload->>'title',''),
        description = nullif(p_payload->>'description',''),
        starts_at = v_start,
        ends_at = v_end,
        timezone = coalesce(nullif(p_payload->>'timezone',''), 'Europe/Zurich'),
        is_all_day = coalesce((p_payload->>'is_all_day')::boolean, false),
        location_name = nullif(p_payload->>'location_name',''),
        location_address = nullif(p_payload->>'location_address',''),
        client_id = nullif(p_payload->>'client_id','')::uuid,
        contact_id = nullif(p_payload->>'contact_id','')::uuid,
        client_site_id = nullif(p_payload->>'client_site_id','')::uuid,
        inquiry_id = nullif(p_payload->>'inquiry_id','')::uuid,
        job_id = nullif(p_payload->>'job_id','')::uuid,
        source_channel = coalesce(nullif(p_payload->>'source_channel',''), 'portal'),
        source_external_id = nullif(p_payload->>'source_external_id',''),
        requires_acceptance = coalesce((p_payload->>'requires_acceptance')::boolean, false),
        updated_by = p_actor_user_id,
        metadata = coalesce(p_payload->'metadata', '{}'::jsonb),
        updated_at = now()
    where e.id = p_event_id
    returning * into v_saved;

    if v_saved.id is null then
      raise exception 'Kalendereintrag wurde nicht gefunden.';
    end if;
  end if;

  delete from public.opc_calendar_event_attendees
  where event_id = v_saved.id;

  if p_attendees is not null and jsonb_typeof(p_attendees) = 'array' then
    insert into public.opc_calendar_event_attendees (
      event_id,
      staff_role_id,
      user_id,
      attendee_role,
      status,
      notified_at,
      notification_status
    )
    select
      v_saved.id,
      nullif(x.staff_role_id,'')::uuid,
      nullif(x.user_id,'')::uuid,
      coalesce(nullif(x.attendee_role,''), 'assigned_worker'),
      coalesce(nullif(x.status,''), 'accepted'),
      nullif(x.notified_at,'')::timestamptz,
      coalesce(nullif(x.notification_status,''), 'pending')
    from jsonb_to_recordset(p_attendees) as x(
      staff_role_id text,
      user_id text,
      attendee_role text,
      status text,
      notified_at text,
      notification_status text
    )
    where nullif(x.staff_role_id,'') is not null;
  end if;

  return to_jsonb(v_saved);
end
$$;

revoke all on function public.opc_save_calendar_event_atomic(uuid, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.opc_save_calendar_event_atomic(uuid, jsonb, jsonb, uuid) to service_role;

create or replace function public.opc_delete_calendar_event_local_atomic(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  delete from public.opc_calendar_event_attendees where event_id = p_event_id;
  delete from public.opc_calendar_events where id = p_event_id;
  get diagnostics v_count = row_count;
  return v_count = 1;
end
$$;

revoke all on function public.opc_delete_calendar_event_local_atomic(uuid) from public, anon, authenticated;
grant execute on function public.opc_delete_calendar_event_local_atomic(uuid) to service_role;

commit;
