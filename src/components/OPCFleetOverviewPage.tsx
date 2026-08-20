import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CarFront,
  ClipboardList,
  Fuel,
  Gauge,
  Map as MapIcon,
  RefreshCw,
  Search,
  Wrench,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  OPC_BRAND,
  OPCMetricsGrid,
  OPCMetricCard,
  OPCPageShell,
  OPCTabs,
  OPCToolbar,
  opcBlackButtonStyle,
  opcCardStyle,
  opcInputWithIconStyle,
  opcResponsiveStyle,
  opcSecondaryButtonStyle,
  opcSelectStyle,
} from './opc/OPCPageTop';

type TabKey = 'vehicles' | 'logbook' | 'maintenance' | 'handover';

type Vehicle = {
  id: string;
  display_name: string;
  license_plate?: string | null;
  make?: string | null;
  model?: string | null;
  model_year?: number | null;
  fuel_type?: string | null;
  status?: string | null;
  vin?: string | null;
  home_base_label?: string | null;
  assigned_employee_id?: string | null;
};

type VehicleStatus = {
  vehicle_id: string;
  status?: string | null;
  last_seen_at?: string | null;
  speed_kmh?: number | null;
  odometer_km?: number | null;
  fuel_level_percent?: number | null;
  fuel_level_liters?: number | null;
  range_km?: number | null;
  battery_voltage?: number | null;
  dtc_active_count?: number | null;
};

type Trip = {
  id: string;
  vehicle_id?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  start_address?: string | null;
  end_address?: string | null;
  distance_km?: number | null;
  duration_seconds?: number | null;
  classification?: string | null;
};

type HandoverLog = {
  id: string;
  vehicle_id?: string | null;
  action?: string | null;
  occurred_at?: string | null;
  note?: string | null;
  odometer_km?: number | null;
  fuel_level_percent?: number | null;
  location_text?: string | null;
};

type WorkOrder = {
  id: string;
  vehicle_id?: string | null;
  title?: string | null;
  priority?: string | null;
  status?: string | null;
  scheduled_for?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatKm(value?: number | null) {
  const next = Number(value);
  if (!Number.isFinite(next)) return '—';
  return `${Math.round(next).toLocaleString('de-CH')} km`;
}

function formatFuel(value?: number | null) {
  const next = Number(value);
  if (!Number.isFinite(next)) return '—';
  return `${Math.round(next)}%`;
}

function actionLabel(action?: string | null) {
  switch (action) {
    case 'picked_up':
      return 'Übernommen';
    case 'returned':
      return 'Zurückgegeben';
    case 'issue_reported':
      return 'Problem gemeldet';
    case 'insurance_report':
      return 'Versicherungsnotiz';
    case 'inspection':
      return 'Kontrolle';
    default:
      return 'Eintrag';
  }
}

function normalizeStatus(vehicle: Vehicle, status?: VehicleStatus) {
  const raw = String(status?.status || vehicle.status || '').toLowerCase();
  if (raw.includes('maintenance') || raw.includes('repair') || raw.includes('critical')) return 'repair';
  if ((status?.dtc_active_count || 0) > 0 || raw.includes('warning')) return 'check';
  if (raw.includes('inactive') || raw.includes('offline')) return 'offline';
  return 'ok';
}

function StatusPill({ state }: { state: string }) {
  const label = state === 'repair' ? 'Reparatur nötig' : state === 'check' ? 'Prüfen' : state === 'offline' ? 'Offline' : 'Okay';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '26px',
        padding: '0 10px',
        borderRadius: '999px',
        border: `1px solid ${OPC_BRAND.border}`,
        background: '#FFFFFF',
        color: OPC_BRAND.text,
        fontSize: '12px',
        fontWeight: 780,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function CompactEmptyState({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div style={{ ...opcCardStyle, padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '16px', fontWeight: 840, letterSpacing: '-0.035em', marginBottom: '5px' }}>{title}</div>
        <div style={{ color: OPC_BRAND.muted, fontSize: '13px', lineHeight: 1.45, fontWeight: 600 }}>{text}</div>
      </div>
      {children && <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>{children}</div>}
    </div>
  );
}

function VehicleRow({ vehicle, status, latestTrip }: { vehicle: Vehicle; status?: VehicleStatus; latestTrip?: Trip }) {
  const state = normalizeStatus(vehicle, status);
  return (
    <a
      href={`/fuhrpark/fahrzeug/${vehicle.id}`}
      style={{
        ...opcCardStyle,
        padding: '16px 18px',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.3fr) 125px 120px 120px 130px',
        gap: '14px',
        alignItems: 'center',
        textDecoration: 'none',
        color: OPC_BRAND.text,
      }}
      className="opc-fleet-row"
    >
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
        <div style={{ width: '38px', height: '38px', borderRadius: '14px', border: `1px solid ${OPC_BRAND.border}`, background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CarFront size={18} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 840, letterSpacing: '-0.035em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vehicle.display_name || 'Fahrzeug'}</div>
          <div style={{ marginTop: '3px', color: OPC_BRAND.muted, fontSize: '12px', fontWeight: 620, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {vehicle.license_plate || 'Kennzeichen offen'} · {[vehicle.make, vehicle.model, vehicle.model_year].filter(Boolean).join(' ') || 'Modell offen'}
          </div>
        </div>
      </div>
      <StatusPill state={state} />
      <div style={{ color: OPC_BRAND.text, fontSize: '13px', fontWeight: 720 }}>{formatFuel(status?.fuel_level_percent)}</div>
      <div style={{ color: OPC_BRAND.text, fontSize: '13px', fontWeight: 720 }}>{formatKm(status?.odometer_km)}</div>
      <div style={{ color: OPC_BRAND.muted, fontSize: '12px', fontWeight: 620 }}>{latestTrip?.started_at ? formatDate(latestTrip.started_at) : formatDate(status?.last_seen_at)}</div>
    </a>
  );
}

function SmallEntryCard({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ ...opcCardStyle, padding: '16px 18px' }}>
      <div style={{ fontSize: '15px', fontWeight: 830, letterSpacing: '-0.03em' }}>{title}</div>
      <div style={{ marginTop: '5px', color: OPC_BRAND.muted, fontSize: '13px', lineHeight: 1.45, fontWeight: 600 }}>{text}</div>
    </div>
  );
}

export default function OPCFleetOverviewPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('vehicles');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [statuses, setStatuses] = useState<VehicleStatus[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [handovers, setHandovers] = useState<HandoverLog[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);

  const loadFleet = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const vehiclesResult = await supabase
        .from('opc_fleet_vehicles')
        .select('id, display_name, license_plate, make, model, model_year, fuel_type, status, vin, home_base_label, assigned_employee_id')
        .order('display_name', { ascending: true });

      if (vehiclesResult.error) throw vehiclesResult.error;
      setVehicles((vehiclesResult.data || []) as Vehicle[]);

      const [statusResult, tripResult, handoverResult, workOrderResult] = await Promise.all([
        supabase.from('opc_vehicle_status_current').select('vehicle_id, status, last_seen_at, speed_kmh, odometer_km, fuel_level_percent, fuel_level_liters, range_km, battery_voltage, dtc_active_count'),
        supabase.from('opc_vehicle_trips').select('id, vehicle_id, started_at, ended_at, start_address, end_address, distance_km, duration_seconds, classification').order('started_at', { ascending: false }).limit(40),
        supabase.from('opc_vehicle_handover_logs').select('id, vehicle_id, action, occurred_at, note, odometer_km, fuel_level_percent, location_text').order('occurred_at', { ascending: false }).limit(40),
        supabase.from('opc_maintenance_work_orders').select('id, vehicle_id, title, priority, status, scheduled_for').in('status', ['open', 'planned', 'in_progress', 'waiting_parts']).order('created_at', { ascending: false }).limit(40),
      ]);

      if (!statusResult.error) setStatuses((statusResult.data || []) as VehicleStatus[]);
      if (!tripResult.error) setTrips((tripResult.data || []) as Trip[]);
      if (!handoverResult.error) setHandovers((handoverResult.data || []) as HandoverLog[]);
      if (!workOrderResult.error) setWorkOrders((workOrderResult.data || []) as WorkOrder[]);
    } catch (err: any) {
      setError(err?.message || 'Fuhrpark konnte nicht geladen werden.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadFleet();
  }, [loadFleet]);

  const handleSync = async () => {
    setSyncing(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/integrations/autoaid/pull', { method: 'POST' });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.success === false) {
        throw new Error(String(payload?.error || 'AutoAid Synchronisation fehlgeschlagen.'));
      }

      const count = Number(payload?.vehicles || payload?.upserted_vehicles || 0);
      setNotice(count > 0 ? `${count} Fahrzeuge synchronisiert.` : 'Synchronisation abgeschlossen.');
      await loadFleet(true);
    } catch (err: any) {
      setError(err?.message || 'AutoAid Synchronisation fehlgeschlagen.');
    } finally {
      setSyncing(false);
    }
  };

  const statusByVehicle = useMemo(() => {
    const map = new globalThis.Map<string, VehicleStatus>();
    statuses.forEach((status) => status.vehicle_id && map.set(status.vehicle_id, status));
    return map;
  }, [statuses]);

  const latestTripByVehicle = useMemo(() => {
    const map = new globalThis.Map<string, Trip>();
    trips.forEach((trip) => {
      if (trip.vehicle_id && !map.has(trip.vehicle_id)) map.set(trip.vehicle_id, trip);
    });
    return map;
  }, [trips]);

  const filteredVehicles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return vehicles.filter((vehicle) => {
      const status = statusByVehicle.get(vehicle.id);
      const state = normalizeStatus(vehicle, status);
      const matchesStatus = statusFilter === 'all' || statusFilter === state;
      const haystack = [vehicle.display_name, vehicle.license_plate, vehicle.make, vehicle.model, vehicle.vin, vehicle.home_base_label]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [query, statusByVehicle, statusFilter, vehicles]);

  const metrics = useMemo(() => {
    const inMotion = vehicles.filter((vehicle) => Number(statusByVehicle.get(vehicle.id)?.speed_kmh || 0) > 2).length;
    const check = vehicles.filter((vehicle) => normalizeStatus(vehicle, statusByVehicle.get(vehicle.id)) === 'check').length;
    const repair = vehicles.filter((vehicle) => normalizeStatus(vehicle, statusByVehicle.get(vehicle.id)) === 'repair').length;
    return { active: vehicles.length, inMotion, check, repair };
  }, [statusByVehicle, vehicles]);

  const todayTrips = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return trips.filter((trip) => String(trip.started_at || '').slice(0, 10) === today);
  }, [trips]);

  const lastHandovers = handovers.slice(0, 4);
  const lastTrips = trips.slice(0, 4);
  const openWorkOrders = workOrders.length;

  return (
    <OPCPageShell>
      <OPCMetricsGrid>
        <OPCMetricCard label="Aktive Fahrzeuge" value={loading ? '—' : metrics.active} icon={<CarFront size={19} />} />
        <OPCMetricCard label="In Fahrt" value={loading ? '—' : metrics.inMotion} icon={<Gauge size={19} />} />
        <OPCMetricCard label="Prüfen" value={loading ? '—' : metrics.check} icon={<AlertTriangle size={19} />} />
        <OPCMetricCard label="Reparatur nötig" value={loading ? '—' : metrics.repair} icon={<Wrench size={19} />} />
      </OPCMetricsGrid>

      <OPCToolbar columns="minmax(0, 1fr) 170px 170px 140px">
        <div style={{ position: 'relative' }}>
          <Search size={17} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: OPC_BRAND.faint }} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Fahrzeug, Kennzeichen, VIN oder Standort suchen" style={opcInputWithIconStyle} />
        </div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={opcSelectStyle}>
          <option value="all">Alle Status</option>
          <option value="ok">Okay</option>
          <option value="check">Prüfen</option>
          <option value="repair">Reparatur nötig</option>
          <option value="offline">Offline</option>
        </select>
        <button type="button" onClick={handleSync} disabled={syncing} style={opcBlackButtonStyle}>
          <RefreshCw size={16} /> {syncing ? 'Sync...' : 'Synchronisieren'}
        </button>
        <a href="/fuhrpark/karte" style={opcSecondaryButtonStyle}><MapIcon size={16} /> Karte</a>
      </OPCToolbar>

      <OPCTabs tabs={[
        { key: 'vehicles', label: 'Fahrzeuge', active: activeTab === 'vehicles', onClick: () => setActiveTab('vehicles') },
        { key: 'logbook', label: 'Fahrtenbuch', active: activeTab === 'logbook', onClick: () => setActiveTab('logbook') },
        { key: 'maintenance', label: 'Wartung', active: activeTab === 'maintenance', onClick: () => setActiveTab('maintenance') },
        { key: 'handover', label: 'Übergaben', active: activeTab === 'handover', onClick: () => setActiveTab('handover') },
      ]} />

      {error && <div style={{ ...opcCardStyle, padding: '14px 16px', color: OPC_BRAND.red, fontWeight: 720 }}>{error}</div>}
      {notice && !error && <div style={{ ...opcCardStyle, padding: '14px 16px', color: OPC_BRAND.text, fontWeight: 720 }}>{notice}</div>}

      {activeTab === 'vehicles' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredVehicles.length === 0 ? (
            <CompactEmptyState title="Keine Fahrzeuge erfasst" text="Fahrzeuge erscheinen hier nach der Synchronisation oder nach manueller Anlage.">
              <button type="button" onClick={handleSync} disabled={syncing} style={{ ...opcBlackButtonStyle, width: 'auto', minWidth: '170px' }}>
                <RefreshCw size={16} /> {syncing ? 'Laden...' : 'Synchronisieren'}
              </button>
              <a href="/einstellungen" style={{ ...opcSecondaryButtonStyle, width: 'auto' }}>Einstellungen</a>
            </CompactEmptyState>
          ) : (
            filteredVehicles.map((vehicle) => (
              <VehicleRow key={vehicle.id} vehicle={vehicle} status={statusByVehicle.get(vehicle.id)} latestTrip={latestTripByVehicle.get(vehicle.id)} />
            ))
          )}
        </section>
      )}

      {activeTab === 'logbook' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {lastTrips.length === 0 ? (
            <CompactEmptyState title="Keine Fahrten im Verlauf" text="Fahrten werden nach der Synchronisation hier angezeigt." />
          ) : (
            lastTrips.map((trip) => {
              const vehicle = trip.vehicle_id ? vehicles.find((item) => item.id === trip.vehicle_id) : undefined;
              return (
                <div key={trip.id} style={{ ...opcCardStyle, padding: '16px 18px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 130px 130px', gap: '14px', alignItems: 'center' }} className="opc-fleet-row">
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 840 }}>{vehicle?.display_name || 'Fahrt'}</div>
                    <div style={{ marginTop: '4px', color: OPC_BRAND.muted, fontSize: '12px', fontWeight: 620 }}>{trip.start_address || 'Start offen'} → {trip.end_address || 'Ende offen'}</div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 720 }}>{formatKm(trip.distance_km)}</div>
                  <div style={{ color: OPC_BRAND.muted, fontSize: '12px', fontWeight: 620 }}>{formatDate(trip.started_at)}</div>
                </div>
              );
            })
          )}
        </section>
      )}

      {activeTab === 'maintenance' && (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }} className="opc-fleet-split">
          <SmallEntryCard title="Offene Wartung" text={`${openWorkOrders} offene Arbeiten.`} />
          <SmallEntryCard title="Fahrten heute" text={`${todayTrips.length} Fahrten heute.`} />
          <a href="/fuhrpark/wartung" style={{ ...opcBlackButtonStyle, height: '48px', textDecoration: 'none' }}><Wrench size={16} /> Wartung öffnen</a>
          <a href="/fuhrpark/karte" style={{ ...opcSecondaryButtonStyle, height: '48px', textDecoration: 'none' }}><MapIcon size={16} /> Karte öffnen</a>
        </section>
      )}

      {activeTab === 'handover' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {lastHandovers.length === 0 ? (
            <CompactEmptyState title="Keine Übergaben" text="Übernahmen, Rückgaben und Problemberichte erscheinen hier." />
          ) : (
            lastHandovers.map((entry) => {
              const vehicle = entry.vehicle_id ? vehicles.find((item) => item.id === entry.vehicle_id) : undefined;
              return (
                <div key={entry.id} style={{ ...opcCardStyle, padding: '16px 18px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 130px 120px', gap: '14px', alignItems: 'center' }} className="opc-fleet-row">
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 840 }}>{actionLabel(entry.action)} · {vehicle?.display_name || 'Fahrzeug'}</div>
                    <div style={{ marginTop: '4px', color: OPC_BRAND.muted, fontSize: '12px', fontWeight: 620 }}>{entry.note || entry.location_text || 'Keine Notiz'}</div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 720 }}><ClipboardList size={14} /> {formatFuel(entry.fuel_level_percent)}</div>
                  <div style={{ color: OPC_BRAND.muted, fontSize: '12px', fontWeight: 620 }}>{formatDate(entry.occurred_at)}</div>
                </div>
              );
            })
          )}
        </section>
      )}

      <style>{opcResponsiveStyle}</style>
      <style>{`
        @media (max-width: 980px) {
          .opc-fleet-row {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
          .opc-fleet-split {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </OPCPageShell>
  );
}
