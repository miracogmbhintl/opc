import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CarFront, CheckCircle2, Gauge, Plus, Search, ShieldAlert, Wrench } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  OPC_BRAND,
  OPCMetricCard,
  OPCMetricsGrid,
  OPCPageShell,
  OPCTabs,
  opcBlackButtonStyle,
  opcCardStyle,
  opcInputWithIconStyle,
  opcResponsiveStyle,
  opcSearchIconStyle,
  opcSecondaryButtonStyle,
} from './opc/OPCPageTop';

type FleetVehicle = {
  id: string;
  display_name?: string | null;
  license_plate?: string | null;
  make?: string | null;
  model?: string | null;
  status?: string | null;
};

type VehicleStatus = {
  vehicle_id: string;
  status?: string | null;
  last_seen_at?: string | null;
  odometer_km?: number | null;
  fuel_level_percent?: number | null;
  range_km?: number | null;
  oil_level_percent?: number | null;
  battery_voltage?: number | null;
  dtc_active_count?: number | null;
};

type DtcCode = {
  id: string;
  vehicle_id?: string | null;
  code?: string | null;
  description?: string | null;
  severity?: string | null;
  status?: string | null;
  last_seen_at?: string | null;
};

type WorkOrder = {
  id: string;
  vehicle_id?: string | null;
  work_order_number?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  priority?: string | null;
  status?: string | null;
  scheduled_for?: string | null;
  estimated_cost?: number | null;
};

type ComponentHealth = {
  id: string;
  vehicle_id?: string | null;
  component_type?: string | null;
  condition_status?: string | null;
  condition_percent?: number | null;
  measurement_value?: number | null;
  measurement_unit?: string | null;
  next_inspection_at?: string | null;
  notes?: string | null;
};

type TabKey = 'due' | 'work' | 'errors';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function vehicleName(vehicle?: FleetVehicle) {
  if (!vehicle) return 'Unbekanntes Fahrzeug';
  return vehicle.display_name || vehicle.license_plate || 'OPC Fahrzeug';
}

function statusLabel(value?: string | null) {
  const clean = String(value || '').toLowerCase();
  if (clean === 'critical') return 'Kritisch';
  if (clean === 'service_due') return 'Service fällig';
  if (clean === 'monitor') return 'Beobachten';
  if (clean === 'warning') return 'Warnung';
  if (clean === 'open') return 'Offen';
  if (clean === 'planned') return 'Geplant';
  if (clean === 'in_progress') return 'In Arbeit';
  if (clean === 'ok') return 'OK';
  return value || 'Offen';
}

function VehicleLine({
  vehicle,
  title,
  meta,
  badge,
  icon,
  actionHref,
}: {
  vehicle?: FleetVehicle;
  title: string;
  meta: ReactNode;
  badge?: string;
  icon: ReactNode;
  actionHref?: string;
}) {
  return (
    <article
      style={{
        ...opcCardStyle,
        padding: '18px 20px',
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 1fr) minmax(0, 1.4fr) 150px',
        gap: '16px',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            border: `1px solid ${OPC_BRAND.border}`,
            display: 'grid',
            placeItems: 'center',
            background: '#FAFAFA',
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 840, letterSpacing: '-0.025em' }}>{vehicleName(vehicle)}</h3>
          <p style={{ margin: '5px 0 0', color: OPC_BRAND.muted, fontSize: 12, fontWeight: 650 }}>
            {vehicle?.license_plate || 'Kein Kennzeichen'} · {vehicle?.make || 'Marke offen'} {vehicle?.model || ''}
          </p>
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <strong style={{ display: 'block', fontSize: 14, fontWeight: 820, color: OPC_BRAND.text }}>{title}</strong>
        <div style={{ marginTop: 6, color: OPC_BRAND.muted, fontSize: 12, fontWeight: 650, lineHeight: 1.45 }}>{meta}</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
        {badge && (
          <span
            style={{
              padding: '7px 10px',
              borderRadius: 999,
              border: `1px solid ${OPC_BRAND.border}`,
              background: '#FAFAFA',
              color: OPC_BRAND.text,
              fontSize: 11,
              fontWeight: 820,
              whiteSpace: 'nowrap',
            }}
          >
            {badge}
          </span>
        )}
        {actionHref && (
          <a
            href={actionHref}
            style={{
              ...opcSecondaryButtonStyle,
              width: 'auto',
              minWidth: 92,
              height: 40,
              fontSize: 12,
            }}
          >
            Details
          </a>
        )}
      </div>
    </article>
  );
}

export default function OPCFleetMaintenancePage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('due');
  const [error, setError] = useState('');
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [statuses, setStatuses] = useState<VehicleStatus[]>([]);
  const [dtcs, setDtcs] = useState<DtcCode[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [healthRows, setHealthRows] = useState<ComponentHealth[]>([]);

  async function loadData(refresh = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const [vehicleResult, statusResult, dtcResult, workResult, healthResult] = await Promise.all([
        supabase.from('opc_fleet_vehicles').select('id, display_name, license_plate, make, model, status').order('display_name'),
        supabase.from('opc_vehicle_status_current').select('*'),
        supabase.from('opc_vehicle_dtc_codes').select('id, vehicle_id, code, description, severity, status, last_seen_at').in('status', ['active', 'review']).order('last_seen_at', { ascending: false }).limit(80),
        supabase.from('opc_maintenance_work_orders').select('*').in('status', ['open', 'planned', 'in_progress', 'waiting_parts']).order('scheduled_for', { ascending: true, nullsFirst: false }).limit(80),
        supabase.from('opc_vehicle_component_health').select('*').in('condition_status', ['monitor', 'service_due', 'critical']).order('measured_at', { ascending: false }).limit(80),
      ]);

      if (vehicleResult.error) throw vehicleResult.error;
      if (statusResult.error) throw statusResult.error;
      if (dtcResult.error) throw dtcResult.error;
      if (workResult.error) throw workResult.error;
      if (healthResult.error) throw healthResult.error;

      setVehicles((vehicleResult.data || []) as FleetVehicle[]);
      setStatuses((statusResult.data || []) as VehicleStatus[]);
      setDtcs((dtcResult.data || []) as DtcCode[]);
      setWorkOrders((workResult.data || []) as WorkOrder[]);
      setHealthRows((healthResult.data || []) as ComponentHealth[]);
    } catch (err: any) {
      setError(err?.message || 'Wartungsdaten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadData(false);
  }, []);

  const vehicleById = useMemo(() => {
    const map = new Map<string, FleetVehicle>();
    vehicles.forEach((vehicle) => map.set(vehicle.id, vehicle));
    return map;
  }, [vehicles]);

  const statusByVehicle = useMemo(() => {
    const map = new Map<string, VehicleStatus>();
    statuses.forEach((status) => map.set(status.vehicle_id, status));
    return map;
  }, [statuses]);

  const dueVehicleIds = useMemo(() => {
    const ids = new Set<string>();
    healthRows.forEach((row) => row.vehicle_id && ids.add(row.vehicle_id));
    dtcs.forEach((row) => row.vehicle_id && ids.add(row.vehicle_id));
    workOrders.forEach((row) => row.vehicle_id && ids.add(row.vehicle_id));
    statuses.forEach((status) => {
      if ((status.dtc_active_count || 0) > 0 || Number(status.fuel_level_percent || 100) < 15 || Number(status.oil_level_percent || 100) < 25) {
        ids.add(status.vehicle_id);
      }
    });
    return ids;
  }, [dtcs, healthRows, statuses, workOrders]);

  const lowerSearch = search.trim().toLowerCase();
  const matchesVehicle = (vehicle?: FleetVehicle) => {
    if (!lowerSearch) return true;
    const haystack = `${vehicle?.display_name || ''} ${vehicle?.license_plate || ''} ${vehicle?.make || ''} ${vehicle?.model || ''}`.toLowerCase();
    return haystack.includes(lowerSearch);
  };

  const filteredDueVehicles = vehicles.filter((vehicle) => dueVehicleIds.has(vehicle.id) && matchesVehicle(vehicle));
  const filteredWorkOrders = workOrders.filter((row) => matchesVehicle(vehicleById.get(row.vehicle_id || '')) || `${row.title || ''} ${row.description || ''}`.toLowerCase().includes(lowerSearch));
  const filteredDtcs = dtcs.filter((row) => matchesVehicle(vehicleById.get(row.vehicle_id || '')) || `${row.code || ''} ${row.description || ''}`.toLowerCase().includes(lowerSearch));

  const healthyCount = Math.max(vehicles.length - dueVehicleIds.size, 0);
  const criticalCount = dtcs.filter((row) => row.severity === 'critical').length + healthRows.filter((row) => row.condition_status === 'critical').length;

  return (
    <OPCPageShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 860, letterSpacing: '0.20em', textTransform: 'uppercase', color: OPC_BRAND.muted, marginBottom: 8 }}>OPC Fuhrpark</div>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1, fontWeight: 880, letterSpacing: '-0.055em' }}>Wartung & Diagnose</h1>
          <p style={{ margin: '10px 0 0', color: OPC_BRAND.muted, fontSize: 14, fontWeight: 650 }}>
            Fahrzeugzustand, AutoAid-Fehlercodes, Wartungsarbeiten und Reparaturempfehlungen.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/fuhrpark" style={{ ...opcSecondaryButtonStyle, width: 'auto', minWidth: 130 }}>Fuhrpark</a>
          <a href="/fuhrpark/karte" style={{ ...opcBlackButtonStyle, width: 'auto', minWidth: 132 }}><CarFront size={16} /> Live Map</a>
        </div>
      </div>

      <OPCMetricsGrid>
        <OPCMetricCard label="Fahrzeuge fällig" value={dueVehicleIds.size} icon={<Wrench size={18} />} tone={dueVehicleIds.size ? 'warning' : 'success'} />
        <OPCMetricCard label="Offene Arbeiten" value={workOrders.length} icon={<Gauge size={18} />} tone={workOrders.length ? 'warning' : 'neutral'} />
        <OPCMetricCard label="Kritische Fehler" value={criticalCount} icon={<ShieldAlert size={18} />} tone={criticalCount ? 'danger' : 'success'} />
        <OPCMetricCard label="Ohne Aufmerksamkeit" value={healthyCount} icon={<CheckCircle2 size={18} />} tone="success" />
      </OPCMetricsGrid>

      <section style={{ ...opcCardStyle, padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 180px', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={opcSearchIconStyle} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Fahrzeug, Kennzeichen, Fehler oder Empfehlung suchen"
              style={opcInputWithIconStyle}
            />
          </div>
          <button type="button" onClick={() => void loadData(true)} disabled={refreshing} style={opcBlackButtonStyle}>
            <Plus size={16} /> {refreshing ? 'Laden...' : 'Neu laden'}
          </button>
        </div>
      </section>

      <OPCTabs
        tabs={[
          { key: 'due', label: `Fällige Wartung · ${filteredDueVehicles.length}`, active: activeTab === 'due', onClick: () => setActiveTab('due') },
          { key: 'work', label: `Wartungsliste · ${filteredWorkOrders.length}`, active: activeTab === 'work', onClick: () => setActiveTab('work') },
          { key: 'errors', label: `Aktive Fehler · ${filteredDtcs.length}`, active: activeTab === 'errors', onClick: () => setActiveTab('errors') },
        ]}
      />

      {error && <div style={{ ...opcCardStyle, borderColor: '#FCA5A5', background: '#FEF2F2', color: OPC_BRAND.red, padding: 16, marginBottom: 16, fontWeight: 720 }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {activeTab === 'due' && filteredDueVehicles.map((vehicle) => {
          const status = statusByVehicle.get(vehicle.id);
          const components = healthRows.filter((row) => row.vehicle_id === vehicle.id);
          const activeDtcs = dtcs.filter((row) => row.vehicle_id === vehicle.id);
          const openWork = workOrders.filter((row) => row.vehicle_id === vehicle.id);
          const recommendation = components[0]?.notes || activeDtcs[0]?.description || openWork[0]?.title || 'Fahrzeug prüfen und nächsten Service festlegen.';
          return (
            <VehicleLine
              key={vehicle.id}
              vehicle={vehicle}
              title={recommendation}
              icon={<Wrench size={18} />}
              badge={statusLabel(components[0]?.condition_status || activeDtcs[0]?.severity || openWork[0]?.priority || 'Prüfen')}
              actionHref={`/fuhrpark/fahrzeug/${vehicle.id}`}
              meta={
                <>
                  Tank {status?.fuel_level_percent != null ? `${Math.round(Number(status.fuel_level_percent))}%` : '—'} · Fehler {status?.dtc_active_count || activeDtcs.length} · Kilometer {status?.odometer_km != null ? `${Math.round(Number(status.odometer_km)).toLocaleString('de-CH')} km` : '—'}
                </>
              }
            />
          );
        })}

        {activeTab === 'work' && filteredWorkOrders.map((order) => {
          const vehicle = vehicleById.get(order.vehicle_id || '');
          return (
            <VehicleLine
              key={order.id}
              vehicle={vehicle}
              title={order.title || 'Wartungsarbeit'}
              icon={<Wrench size={18} />}
              badge={statusLabel(order.status)}
              actionHref={vehicle ? `/fuhrpark/fahrzeug/${vehicle.id}` : undefined}
              meta={
                <>
                  {order.category || 'Arbeit'} · Priorität {statusLabel(order.priority)} · Termin {formatDate(order.scheduled_for)} · Kostenschätzung {order.estimated_cost ? `CHF ${Number(order.estimated_cost).toFixed(2)}` : '—'}
                </>
              }
            />
          );
        })}

        {activeTab === 'errors' && filteredDtcs.map((dtc) => {
          const vehicle = vehicleById.get(dtc.vehicle_id || '');
          return (
            <VehicleLine
              key={dtc.id}
              vehicle={vehicle}
              title={`${dtc.code || 'Fehlercode'} · ${dtc.description || 'Keine Beschreibung hinterlegt'}`}
              icon={<AlertTriangle size={18} />}
              badge={statusLabel(dtc.severity)}
              actionHref={vehicle ? `/fuhrpark/fahrzeug/${vehicle.id}` : undefined}
              meta={<>Status {statusLabel(dtc.status)} · zuletzt gesehen {formatDate(dtc.last_seen_at)}</>}
            />
          );
        })}

        {!loading && activeTab === 'due' && filteredDueVehicles.length === 0 && <EmptyState />}
        {!loading && activeTab === 'work' && filteredWorkOrders.length === 0 && <EmptyState />}
        {!loading && activeTab === 'errors' && filteredDtcs.length === 0 && <EmptyState />}
        {loading && <EmptyState text="Wartungsdaten werden geladen..." />}
      </div>

      <style>{`${opcResponsiveStyle}
        @media (max-width: 980px) {
          article[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </OPCPageShell>
  );
}

function EmptyState({ text = 'Keine passenden Wartungsdaten.' }: { text?: string }) {
  return (
    <section style={{ ...opcCardStyle, padding: '42px 18px', textAlign: 'center' }}>
      <CheckCircle2 size={22} color={OPC_BRAND.muted} />
      <div style={{ marginTop: 12, color: OPC_BRAND.muted, fontSize: 14, fontWeight: 760 }}>{text}</div>
    </section>
  );
}
