-- OPC Fuhrpark maintenance support copied from the EcoTaxi phase-6 pattern and adapted to OPC.
-- Adds normalized component-health and maintenance-work-order tables used by /fuhrpark/wartung.

create table if not exists public.opc_vehicle_component_health (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.opc_fleet_vehicles(id) on delete cascade,
  component_type text not null,
  component_position text not null default 'vehicle',
  condition_status text not null default 'unknown',
  condition_percent numeric(6,3),
  measurement_value numeric(16,4),
  measurement_unit text,
  source_type text not null default 'autoaid_or_manual',
  measured_at timestamptz not null default now(),
  next_inspection_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opc_vehicle_component_health_condition_status_check check (condition_status in ('unknown', 'ok', 'monitor', 'service_due', 'critical', 'replaced', 'ignored'))
);

create trigger trg_opc_vehicle_component_health_updated_at
before update on public.opc_vehicle_component_health
for each row execute function public.opc_touch_updated_at();

create index if not exists idx_opc_vehicle_component_health_vehicle on public.opc_vehicle_component_health(vehicle_id, condition_status, measured_at desc);
create index if not exists idx_opc_vehicle_component_health_component on public.opc_vehicle_component_health(component_type, condition_status);

create table if not exists public.opc_maintenance_work_orders (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.opc_fleet_vehicles(id) on delete restrict,
  work_order_number text not null unique,
  title text not null,
  description text,
  category text not null default 'repair',
  priority text not null default 'warning',
  status text not null default 'open',
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  assigned_to_user_id uuid,
  service_provider text,
  estimated_cost numeric(14,2),
  actual_cost numeric(14,2),
  currency_code text not null default 'CHF',
  resolution_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opc_maintenance_work_orders_category_check check (category in ('inspection', 'service', 'repair', 'tyres', 'fuel', 'cleaning', 'diagnostic', 'other')),
  constraint opc_maintenance_work_orders_priority_check check (priority in ('info', 'attention', 'warning', 'critical')),
  constraint opc_maintenance_work_orders_status_check check (status in ('open', 'planned', 'in_progress', 'waiting_parts', 'completed', 'cancelled'))
);

create trigger trg_opc_maintenance_work_orders_updated_at
before update on public.opc_maintenance_work_orders
for each row execute function public.opc_touch_updated_at();

create index if not exists idx_opc_maintenance_work_orders_vehicle_status on public.opc_maintenance_work_orders(vehicle_id, status, scheduled_for desc nulls last);
create index if not exists idx_opc_maintenance_work_orders_priority on public.opc_maintenance_work_orders(priority, status, created_at desc);

create table if not exists public.opc_vehicle_cost_entries (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.opc_fleet_vehicles(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  cost_type text not null default 'other',
  amount numeric(14,2) not null default 0,
  currency_code text not null default 'CHF',
  vendor text,
  description text,
  related_work_order_id uuid references public.opc_maintenance_work_orders(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint opc_vehicle_cost_entries_cost_type_check check (cost_type in ('fuel', 'service', 'repair', 'tyres', 'insurance', 'tax', 'leasing', 'cleaning', 'parking', 'fine', 'other'))
);

create index if not exists idx_opc_vehicle_cost_entries_vehicle_time on public.opc_vehicle_cost_entries(vehicle_id, occurred_at desc);
create index if not exists idx_opc_vehicle_cost_entries_work_order on public.opc_vehicle_cost_entries(related_work_order_id);

alter table public.opc_vehicle_component_health enable row level security;
alter table public.opc_maintenance_work_orders enable row level security;
alter table public.opc_vehicle_cost_entries enable row level security;

create policy "Owners and admins can read vehicle component health"
  on public.opc_vehicle_component_health
  for select
  using (public.opc_is_owner_or_admin());

create policy "Owners and admins can manage vehicle component health"
  on public.opc_vehicle_component_health
  for all
  using (public.opc_is_owner_or_admin())
  with check (public.opc_is_owner_or_admin());

create policy "Owners and admins can read maintenance work orders"
  on public.opc_maintenance_work_orders
  for select
  using (public.opc_is_owner_or_admin());

create policy "Owners and admins can manage maintenance work orders"
  on public.opc_maintenance_work_orders
  for all
  using (public.opc_is_owner_or_admin())
  with check (public.opc_is_owner_or_admin());

create policy "Owners and admins can read vehicle costs"
  on public.opc_vehicle_cost_entries
  for select
  using (public.opc_is_owner_or_admin());

create policy "Owners and admins can manage vehicle costs"
  on public.opc_vehicle_cost_entries
  for all
  using (public.opc_is_owner_or_admin())
  with check (public.opc_is_owner_or_admin());
