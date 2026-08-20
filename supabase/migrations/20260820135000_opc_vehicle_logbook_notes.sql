-- OPC Fuhrpark vehicle logbook and notes
-- Supports employee vehicle pick-up/return reports, detail-page notes and later insurance/incident reporting.

create extension if not exists pgcrypto;

create or replace function public.opc_is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.opc_staff_roles osr
    where osr.user_id = auth.uid()
      and osr.status = 'active'
      and osr.can_access_portal = true
  );
$$;

create table if not exists public.opc_vehicle_handover_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.opc_fleet_vehicles(id) on delete cascade,
  employee_user_id uuid default auth.uid(),
  employee_id uuid,
  action text not null,
  occurred_at timestamptz not null default now(),
  odometer_km numeric(12,2),
  fuel_level_percent numeric(5,2),
  location_text text,
  note text,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint opc_vehicle_handover_logs_action_check check (
    action in ('picked_up', 'returned', 'handover', 'issue_reported', 'inspection', 'insurance_report')
  )
);

create index if not exists idx_opc_vehicle_handover_logs_vehicle_time
  on public.opc_vehicle_handover_logs(vehicle_id, occurred_at desc);

create index if not exists idx_opc_vehicle_handover_logs_employee_time
  on public.opc_vehicle_handover_logs(employee_user_id, occurred_at desc);

create table if not exists public.opc_vehicle_notes (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.opc_fleet_vehicles(id) on delete cascade,
  note_type text not null default 'general',
  title text,
  body text not null,
  related_trip_id uuid references public.opc_vehicle_trips(id) on delete set null,
  related_work_order_id uuid references public.opc_maintenance_work_orders(id) on delete set null,
  related_employee_id uuid,
  visibility text not null default 'internal',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opc_vehicle_notes_note_type_check check (
    note_type in ('general', 'damage', 'cleaning', 'maintenance', 'handover', 'insurance', 'driver_note')
  ),
  constraint opc_vehicle_notes_visibility_check check (visibility in ('internal', 'owner_only'))
);

create trigger trg_opc_vehicle_notes_updated_at
before update on public.opc_vehicle_notes
for each row execute function public.opc_touch_updated_at();

create index if not exists idx_opc_vehicle_notes_vehicle_time
  on public.opc_vehicle_notes(vehicle_id, created_at desc);

alter table public.opc_vehicle_handover_logs enable row level security;
alter table public.opc_vehicle_notes enable row level security;

-- Employees need to see active vehicles to report pick-up/return. Owner/admin management policies already exist.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'opc_fleet_vehicles'
      and policyname = 'Active staff can read active fleet vehicles'
  ) then
    create policy "Active staff can read active fleet vehicles"
      on public.opc_fleet_vehicles
      for select
      using (public.opc_is_active_staff() and status = 'active');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'opc_vehicle_handover_logs'
      and policyname = 'Owners and admins can manage vehicle handover logs'
  ) then
    create policy "Owners and admins can manage vehicle handover logs"
      on public.opc_vehicle_handover_logs
      for all
      using (public.opc_is_owner_or_admin())
      with check (public.opc_is_owner_or_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'opc_vehicle_handover_logs'
      and policyname = 'Active staff can insert own vehicle handover logs'
  ) then
    create policy "Active staff can insert own vehicle handover logs"
      on public.opc_vehicle_handover_logs
      for insert
      with check (public.opc_is_active_staff() and coalesce(created_by, auth.uid()) = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'opc_vehicle_handover_logs'
      and policyname = 'Active staff can read own vehicle handover logs'
  ) then
    create policy "Active staff can read own vehicle handover logs"
      on public.opc_vehicle_handover_logs
      for select
      using (public.opc_is_active_staff() and (created_by = auth.uid() or employee_user_id = auth.uid()));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'opc_vehicle_notes'
      and policyname = 'Owners and admins can manage vehicle notes'
  ) then
    create policy "Owners and admins can manage vehicle notes"
      on public.opc_vehicle_notes
      for all
      using (public.opc_is_owner_or_admin())
      with check (public.opc_is_owner_or_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'opc_vehicle_notes'
      and policyname = 'Active staff can insert own vehicle notes'
  ) then
    create policy "Active staff can insert own vehicle notes"
      on public.opc_vehicle_notes
      for insert
      with check (public.opc_is_active_staff() and coalesce(created_by, auth.uid()) = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'opc_vehicle_notes'
      and policyname = 'Active staff can read own vehicle notes'
  ) then
    create policy "Active staff can read own vehicle notes"
      on public.opc_vehicle_notes
      for select
      using (public.opc_is_active_staff() and created_by = auth.uid());
  end if;
end $$;
