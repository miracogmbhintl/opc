-- OPC AutoAid / Fuhrpark foundation
-- Creates the secure integration settings table plus the normalized fleet/telemetry tables.
-- Frontend must never read provider secrets directly; use server API endpoints with owner checks.

create extension if not exists pgcrypto;

create or replace function public.opc_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.opc_is_owner_or_admin()
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
      and osr.role in ('owner', 'admin')
  );
$$;

create or replace function public.opc_is_owner()
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
      and osr.role = 'owner'
  );
$$;

create table if not exists public.opc_integration_settings (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  enabled boolean not null default false,
  api_base_url text not null default '',
  api_key_encrypted text,
  api_key_last4 text,
  api_key_set_at timestamptz,
  webhook_secret_hash text,
  webhook_secret_last4 text,
  pull_interval_minutes integer not null default 15,
  ingest_mode text not null default 'pull_and_push',
  settings jsonb not null default '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opc_integration_settings_provider_check check (provider in ('autoaid', 'google_calendar', 'whatsapp', 'other')),
  constraint opc_integration_settings_pull_interval_check check (pull_interval_minutes between 1 and 1440),
  constraint opc_integration_settings_ingest_mode_check check (ingest_mode in ('pull_only', 'push_only', 'pull_and_push'))
);

create trigger trg_opc_integration_settings_updated_at
before update on public.opc_integration_settings
for each row execute function public.opc_touch_updated_at();

create table if not exists public.opc_fleet_vehicles (
  id uuid primary key default gen_random_uuid(),
  autoaid_vehicle_id text unique,
  autoaid_device_id text,
  autoaid_device_imei text,
  license_plate text,
  display_name text not null,
  vin text,
  make text,
  model text,
  model_year integer,
  fuel_type text,
  status text not null default 'active',
  assigned_employee_id uuid,
  home_base_label text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opc_fleet_vehicles_status_check check (status in ('active', 'inactive', 'maintenance', 'sold', 'archived'))
);

create trigger trg_opc_fleet_vehicles_updated_at
before update on public.opc_fleet_vehicles
for each row execute function public.opc_touch_updated_at();

create table if not exists public.opc_autoaid_events_raw (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'autoaid',
  provider_event_id text,
  autoaid_device_id text,
  autoaid_vehicle_id text,
  vehicle_id uuid references public.opc_fleet_vehicles(id) on delete set null,
  trip_provider_id text,
  event_type text,
  data_type text,
  recorded_at timestamptz,
  received_at timestamptz not null default now(),
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text
);

create index if not exists idx_opc_autoaid_events_raw_recorded_at on public.opc_autoaid_events_raw(recorded_at desc);
create index if not exists idx_opc_autoaid_events_raw_vehicle_id on public.opc_autoaid_events_raw(vehicle_id, recorded_at desc);
create index if not exists idx_opc_autoaid_events_raw_device_id on public.opc_autoaid_events_raw(autoaid_device_id, recorded_at desc);
create index if not exists idx_opc_autoaid_events_raw_event_type on public.opc_autoaid_events_raw(event_type, recorded_at desc);

create table if not exists public.opc_vehicle_status_current (
  vehicle_id uuid primary key references public.opc_fleet_vehicles(id) on delete cascade,
  last_seen_at timestamptz,
  last_position_at timestamptz,
  latitude double precision,
  longitude double precision,
  heading double precision,
  speed_kmh double precision,
  altitude_m double precision,
  gps_quality text,
  ignition_on boolean,
  odometer_km numeric(12,2),
  fuel_level_percent numeric(5,2),
  fuel_level_liters numeric(8,2),
  range_km numeric(10,2),
  battery_voltage numeric(8,2),
  oil_level_percent numeric(5,2),
  adblue_level_percent numeric(5,2),
  dtc_active_count integer not null default 0,
  status text not null default 'unknown',
  current_trip_id uuid,
  raw_status jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint opc_vehicle_status_current_status_check check (status in ('unknown', 'online', 'driving', 'stopped', 'offline', 'warning', 'maintenance'))
);

create index if not exists idx_opc_vehicle_status_current_last_seen on public.opc_vehicle_status_current(last_seen_at desc);
create index if not exists idx_opc_vehicle_status_current_location on public.opc_vehicle_status_current(latitude, longitude);

create table if not exists public.opc_vehicle_locations (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.opc_fleet_vehicles(id) on delete cascade,
  autoaid_device_id text,
  autoaid_vehicle_id text,
  recorded_at timestamptz not null,
  latitude double precision not null,
  longitude double precision not null,
  speed_kmh double precision,
  heading double precision,
  altitude_m double precision,
  ignition_on boolean,
  trip_provider_id text,
  source_event_id uuid references public.opc_autoaid_events_raw(id) on delete set null,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_opc_vehicle_locations_vehicle_time on public.opc_vehicle_locations(vehicle_id, recorded_at desc);
create index if not exists idx_opc_vehicle_locations_time on public.opc_vehicle_locations(recorded_at desc);

create table if not exists public.opc_vehicle_trips (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'autoaid',
  provider_trip_id text unique,
  vehicle_id uuid references public.opc_fleet_vehicles(id) on delete set null,
  autoaid_vehicle_id text,
  autoaid_device_id text,
  started_at timestamptz,
  ended_at timestamptz,
  start_address text,
  end_address text,
  start_latitude double precision,
  start_longitude double precision,
  end_latitude double precision,
  end_longitude double precision,
  distance_km numeric(12,2),
  duration_seconds integer,
  idle_seconds integer,
  route_polyline text,
  matched_job_id uuid,
  matched_employee_id uuid,
  classification text not null default 'unmatched',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opc_vehicle_trips_classification_check check (classification in ('unmatched', 'job_related', 'commute', 'private', 'maintenance', 'review'))
);

create trigger trg_opc_vehicle_trips_updated_at
before update on public.opc_vehicle_trips
for each row execute function public.opc_touch_updated_at();

create index if not exists idx_opc_vehicle_trips_vehicle_time on public.opc_vehicle_trips(vehicle_id, started_at desc);
create index if not exists idx_opc_vehicle_trips_job on public.opc_vehicle_trips(matched_job_id);

create table if not exists public.opc_vehicle_stops (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.opc_fleet_vehicles(id) on delete cascade,
  trip_id uuid references public.opc_vehicle_trips(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer,
  latitude double precision,
  longitude double precision,
  address text,
  matched_job_id uuid,
  stop_type text not null default 'unknown',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint opc_vehicle_stops_stop_type_check check (stop_type in ('unknown', 'customer_site', 'break', 'traffic', 'fuel', 'maintenance', 'home_base', 'private', 'review'))
);

create index if not exists idx_opc_vehicle_stops_vehicle_time on public.opc_vehicle_stops(vehicle_id, started_at desc);
create index if not exists idx_opc_vehicle_stops_duration on public.opc_vehicle_stops(duration_seconds desc nulls last);

create table if not exists public.opc_vehicle_dtc_codes (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.opc_fleet_vehicles(id) on delete cascade,
  autoaid_vehicle_id text,
  autoaid_device_id text,
  ecu_type text,
  code text not null,
  description text,
  severity text not null default 'unknown',
  status text not null default 'active',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  cleared_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  constraint opc_vehicle_dtc_codes_status_check check (status in ('active', 'cleared', 'ignored', 'review')),
  constraint opc_vehicle_dtc_codes_severity_check check (severity in ('unknown', 'info', 'warning', 'critical'))
);

create index if not exists idx_opc_vehicle_dtc_codes_vehicle_status on public.opc_vehicle_dtc_codes(vehicle_id, status, last_seen_at desc);

create table if not exists public.opc_fleet_alerts (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.opc_fleet_vehicles(id) on delete cascade,
  alert_type text not null,
  severity text not null default 'info',
  title text not null,
  message text,
  status text not null default 'open',
  detected_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  resolved_at timestamptz,
  resolved_by uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opc_fleet_alerts_status_check check (status in ('open', 'acknowledged', 'resolved', 'ignored')),
  constraint opc_fleet_alerts_severity_check check (severity in ('info', 'warning', 'critical'))
);

create trigger trg_opc_fleet_alerts_updated_at
before update on public.opc_fleet_alerts
for each row execute function public.opc_touch_updated_at();

create index if not exists idx_opc_fleet_alerts_status on public.opc_fleet_alerts(status, detected_at desc);
create index if not exists idx_opc_fleet_alerts_vehicle on public.opc_fleet_alerts(vehicle_id, detected_at desc);

alter table public.opc_integration_settings enable row level security;
alter table public.opc_fleet_vehicles enable row level security;
alter table public.opc_autoaid_events_raw enable row level security;
alter table public.opc_vehicle_status_current enable row level security;
alter table public.opc_vehicle_locations enable row level security;
alter table public.opc_vehicle_trips enable row level security;
alter table public.opc_vehicle_stops enable row level security;
alter table public.opc_vehicle_dtc_codes enable row level security;
alter table public.opc_fleet_alerts enable row level security;

create policy "Owners can manage integration settings"
  on public.opc_integration_settings
  for all
  using (public.opc_is_owner())
  with check (public.opc_is_owner());

create policy "Owners and admins can read fleet vehicles"
  on public.opc_fleet_vehicles
  for select
  using (public.opc_is_owner_or_admin());

create policy "Owners and admins can manage fleet vehicles"
  on public.opc_fleet_vehicles
  for all
  using (public.opc_is_owner_or_admin())
  with check (public.opc_is_owner_or_admin());

create policy "Owners and admins can read raw AutoAid events"
  on public.opc_autoaid_events_raw
  for select
  using (public.opc_is_owner_or_admin());

create policy "Owners and admins can read vehicle status"
  on public.opc_vehicle_status_current
  for select
  using (public.opc_is_owner_or_admin());

create policy "Owners and admins can read vehicle locations"
  on public.opc_vehicle_locations
  for select
  using (public.opc_is_owner_or_admin());

create policy "Owners and admins can read vehicle trips"
  on public.opc_vehicle_trips
  for select
  using (public.opc_is_owner_or_admin());

create policy "Owners and admins can manage vehicle trips"
  on public.opc_vehicle_trips
  for all
  using (public.opc_is_owner_or_admin())
  with check (public.opc_is_owner_or_admin());

create policy "Owners and admins can read vehicle stops"
  on public.opc_vehicle_stops
  for select
  using (public.opc_is_owner_or_admin());

create policy "Owners and admins can manage vehicle stops"
  on public.opc_vehicle_stops
  for all
  using (public.opc_is_owner_or_admin())
  with check (public.opc_is_owner_or_admin());

create policy "Owners and admins can read vehicle diagnostics"
  on public.opc_vehicle_dtc_codes
  for select
  using (public.opc_is_owner_or_admin());

create policy "Owners and admins can manage vehicle diagnostics"
  on public.opc_vehicle_dtc_codes
  for all
  using (public.opc_is_owner_or_admin())
  with check (public.opc_is_owner_or_admin());

create policy "Owners and admins can read fleet alerts"
  on public.opc_fleet_alerts
  for select
  using (public.opc_is_owner_or_admin());

create policy "Owners and admins can manage fleet alerts"
  on public.opc_fleet_alerts
  for all
  using (public.opc_is_owner_or_admin())
  with check (public.opc_is_owner_or_admin());

insert into public.opc_integration_settings (
  provider,
  enabled,
  api_base_url,
  pull_interval_minutes,
  ingest_mode,
  settings
)
values (
  'autoaid',
  false,
  'https://api.autoaid.de',
  15,
  'pull_and_push',
  '{"source":"owner_settings","notes":"AutoAid ECU/GPS integration placeholder. Add encrypted API key via OPC owner settings."}'::jsonb
)
on conflict (provider) do nothing;
