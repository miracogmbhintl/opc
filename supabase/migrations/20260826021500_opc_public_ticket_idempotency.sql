-- Orange Pro Clean GmbH
-- Public QR submission idempotency and abuse control.

begin;

create table if not exists public.opc_public_ticket_submissions (
  id uuid primary key default gen_random_uuid(),
  public_link_id uuid not null references public.opc_facility_public_links(id) on delete cascade,
  idempotency_key text not null,
  client_fingerprint text not null,
  ticket_id uuid references public.opc_tickets(id) on delete set null,
  ticket_number text,
  state text not null default 'reserved' check (state in ('reserved','ticket_created','complete','failed')),
  media_warning_count integer not null default 0 check (media_warning_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (public_link_id, idempotency_key)
);

create index if not exists opc_public_ticket_submissions_rate_idx
  on public.opc_public_ticket_submissions(public_link_id, client_fingerprint, created_at desc);

alter table public.opc_public_ticket_submissions enable row level security;
revoke all on public.opc_public_ticket_submissions from public, anon, authenticated;
grant select, insert, update, delete on public.opc_public_ticket_submissions to service_role;

create or replace function public.opc_reserve_public_ticket_submission(
  p_public_link_id uuid,
  p_idempotency_key text,
  p_client_fingerprint text,
  p_hourly_limit integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.opc_public_ticket_submissions%rowtype;
  v_recent_count integer;
  v_created public.opc_public_ticket_submissions%rowtype;
begin
  if p_public_link_id is null or coalesce(trim(p_idempotency_key), '') = '' then
    raise exception 'Ungültige Submission-ID.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'opc-public-ticket:' || p_public_link_id::text || ':' || coalesce(p_client_fingerprint, ''),
      0
    )
  );

  select * into v_existing
  from public.opc_public_ticket_submissions
  where public_link_id = p_public_link_id
    and idempotency_key = p_idempotency_key
  limit 1;

  if v_existing.id is not null then
    return jsonb_build_object(
      'reservation_id', v_existing.id,
      'existing', true,
      'state', v_existing.state,
      'ticket_id', v_existing.ticket_id,
      'ticket_number', v_existing.ticket_number,
      'media_warning_count', v_existing.media_warning_count
    );
  end if;

  select count(*)::integer into v_recent_count
  from public.opc_public_ticket_submissions
  where public_link_id = p_public_link_id
    and client_fingerprint = p_client_fingerprint
    and created_at >= now() - interval '1 hour';

  if v_recent_count >= greatest(1, least(coalesce(p_hourly_limit, 10), 50)) then
    raise exception 'RATE_LIMIT: Zu viele Meldungen in kurzer Zeit.'
      using errcode = 'P0001';
  end if;

  insert into public.opc_public_ticket_submissions (
    public_link_id,
    idempotency_key,
    client_fingerprint,
    state
  ) values (
    p_public_link_id,
    p_idempotency_key,
    p_client_fingerprint,
    'reserved'
  )
  returning * into v_created;

  return jsonb_build_object(
    'reservation_id', v_created.id,
    'existing', false,
    'state', v_created.state,
    'ticket_id', null,
    'ticket_number', null,
    'media_warning_count', 0
  );
end
$$;

revoke all on function public.opc_reserve_public_ticket_submission(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.opc_reserve_public_ticket_submission(uuid, text, text, integer) to service_role;

commit;
