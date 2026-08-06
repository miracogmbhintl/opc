begin;

alter table public.opc_site_inspection_media
  add column if not exists uploaded_by uuid;

create index if not exists opc_site_inspection_media_uploaded_by_idx
  on public.opc_site_inspection_media (uploaded_by, inspection_id);

create table if not exists public.opc_site_inspection_media_trash (
  media_id uuid primary key,
  inspection_id uuid not null,
  client_id uuid,
  uploaded_by uuid,
  bucket_id text,
  object_path text,
  file_name text,
  media_type text,
  media_snapshot jsonb not null,
  deleted_at timestamptz not null default now(),
  deleted_by uuid not null,
  deleted_by_role text not null,
  deleted_by_name text,
  delete_reason text,
  restore_until timestamptz not null,
  permanently_deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists opc_site_inspection_media_trash_inspection_idx
  on public.opc_site_inspection_media_trash (inspection_id, deleted_at desc);

create index if not exists opc_site_inspection_media_trash_restore_idx
  on public.opc_site_inspection_media_trash (restore_until)
  where permanently_deleted_at is null;

create table if not exists public.opc_site_inspection_media_audit (
  id uuid primary key default gen_random_uuid(),
  media_id uuid,
  inspection_id uuid,
  client_id uuid,
  action text not null check (action in ('uploaded', 'deleted', 'restored', 'permanently_deleted')),
  actor_user_id uuid,
  actor_role text,
  actor_display_name text,
  reason text,
  media_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists opc_site_inspection_media_audit_inspection_idx
  on public.opc_site_inspection_media_audit (inspection_id, created_at desc);

create index if not exists opc_site_inspection_media_audit_media_idx
  on public.opc_site_inspection_media_audit (media_id, created_at desc);

alter table public.opc_site_inspection_media_trash enable row level security;
alter table public.opc_site_inspection_media_audit enable row level security;

revoke all on table public.opc_site_inspection_media_trash from anon, authenticated;
revoke all on table public.opc_site_inspection_media_audit from anon, authenticated;
grant all on table public.opc_site_inspection_media_trash to service_role;
grant all on table public.opc_site_inspection_media_audit to service_role;

create or replace function public.opc_set_inspection_media_uploaded_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.uploaded_by is null then
    new.uploaded_by := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists opc_set_inspection_media_uploaded_by on public.opc_site_inspection_media;
create trigger opc_set_inspection_media_uploaded_by
before insert on public.opc_site_inspection_media
for each row
execute function public.opc_set_inspection_media_uploaded_by();

create or replace function public.opc_soft_delete_inspection_media(
  p_media_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
  p_actor_display_name text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_media public.opc_site_inspection_media%rowtype;
  v_snapshot jsonb;
begin
  select *
  into v_media
  from public.opc_site_inspection_media
  where id = p_media_id
  for update;

  if not found then
    raise exception 'Besichtigungsmedium wurde nicht gefunden.';
  end if;

  v_snapshot := to_jsonb(v_media);

  insert into public.opc_site_inspection_media_trash (
    media_id,
    inspection_id,
    client_id,
    uploaded_by,
    bucket_id,
    object_path,
    file_name,
    media_type,
    media_snapshot,
    deleted_at,
    deleted_by,
    deleted_by_role,
    deleted_by_name,
    delete_reason,
    restore_until
  ) values (
    v_media.id,
    v_media.inspection_id,
    v_media.client_id,
    v_media.uploaded_by,
    v_media.bucket_id,
    v_media.object_path,
    v_media.file_name,
    v_media.media_type,
    v_snapshot,
    now(),
    p_actor_user_id,
    lower(coalesce(nullif(trim(p_actor_role), ''), 'unknown')),
    nullif(trim(coalesce(p_actor_display_name, '')), ''),
    nullif(trim(coalesce(p_reason, '')), ''),
    now() + interval '30 days'
  )
  on conflict (media_id) do update set
    media_snapshot = excluded.media_snapshot,
    deleted_at = excluded.deleted_at,
    deleted_by = excluded.deleted_by,
    deleted_by_role = excluded.deleted_by_role,
    deleted_by_name = excluded.deleted_by_name,
    delete_reason = excluded.delete_reason,
    restore_until = excluded.restore_until,
    permanently_deleted_at = null;

  delete from public.opc_site_inspection_media
  where id = p_media_id;

  insert into public.opc_site_inspection_media_audit (
    media_id,
    inspection_id,
    client_id,
    action,
    actor_user_id,
    actor_role,
    actor_display_name,
    reason,
    media_snapshot
  ) values (
    v_media.id,
    v_media.inspection_id,
    v_media.client_id,
    'deleted',
    p_actor_user_id,
    lower(coalesce(nullif(trim(p_actor_role), ''), 'unknown')),
    nullif(trim(coalesce(p_actor_display_name, '')), ''),
    nullif(trim(coalesce(p_reason, '')), ''),
    v_snapshot
  );

  return jsonb_build_object(
    'success', true,
    'media_id', v_media.id,
    'restore_until', now() + interval '30 days'
  );
end;
$$;

create or replace function public.opc_restore_inspection_media(
  p_media_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
  p_actor_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trash public.opc_site_inspection_media_trash%rowtype;
begin
  select *
  into v_trash
  from public.opc_site_inspection_media_trash
  where media_id = p_media_id
  for update;

  if not found then
    raise exception 'Gelöschtes Besichtigungsmedium wurde nicht gefunden.';
  end if;

  if v_trash.permanently_deleted_at is not null then
    raise exception 'Das Medium wurde bereits endgültig gelöscht.';
  end if;

  if v_trash.restore_until < now() then
    raise exception 'Die Wiederherstellungsfrist von 30 Tagen ist abgelaufen.';
  end if;

  insert into public.opc_site_inspection_media
  select restored.*
  from jsonb_populate_record(
    null::public.opc_site_inspection_media,
    v_trash.media_snapshot
  ) as restored;

  delete from public.opc_site_inspection_media_trash
  where media_id = p_media_id;

  insert into public.opc_site_inspection_media_audit (
    media_id,
    inspection_id,
    client_id,
    action,
    actor_user_id,
    actor_role,
    actor_display_name,
    media_snapshot
  ) values (
    v_trash.media_id,
    v_trash.inspection_id,
    v_trash.client_id,
    'restored',
    p_actor_user_id,
    lower(coalesce(nullif(trim(p_actor_role), ''), 'unknown')),
    nullif(trim(coalesce(p_actor_display_name, '')), ''),
    v_trash.media_snapshot
  );

  return jsonb_build_object(
    'success', true,
    'media_id', v_trash.media_id
  );
end;
$$;

revoke all on function public.opc_soft_delete_inspection_media(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.opc_restore_inspection_media(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.opc_soft_delete_inspection_media(uuid, uuid, text, text, text) to service_role;
grant execute on function public.opc_restore_inspection_media(uuid, uuid, text, text) to service_role;

comment on column public.opc_site_inspection_media.uploaded_by is
  'Authenticated user who originally uploaded the inspection medium.';

comment on table public.opc_site_inspection_media_trash is
  'Soft-deleted inspection media retained for owner restoration for 30 days.';

comment on table public.opc_site_inspection_media_audit is
  'Immutable audit trail for inspection media deletion and restoration.';

commit;
