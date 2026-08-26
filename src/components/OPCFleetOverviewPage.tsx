import { useCallback, useEffect, useMemo, useState } from 'react';
import { CarFront, ClipboardList, Map as MapIcon, RefreshCw, Search, Wrench } from 'lucide-react';
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

type TabKey = 'map' | 'vehicles' | 'logbook' | 'maintenance';

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
};

type VehicleStatus = {
  vehicle_id: string;
  status?: string | null;
  last_seen_at?: string | null;
  speed_kmh?: number | null;
  odometer_km?: number | null;
  fuel_level_percent?: number | null;
  range_km?: number | null;
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
};

type WorkOrder = {
  id: string;
  vehicle_id?: string | null;
  title?: string | null;
  priority?: string | null;
  status?: string | null;
  scheduled_for?: string | null;
};

const LOGISTICS_LOCATION = {
  label: 'Logistikstandort',
  address: 'Wattwerkstrasse 2, 4416 Bubendorf',
  lat: 47.45695,
  lng: 7.74378,
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

function mapPreviewUrl() {
  const span = 0.018;
  const { lat, lng } = LOGISTICS_LOCATION;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - span}%2C${lat - span}%2C${lng + span}%2C${lat + span}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function normalizeStatus(vehicle: Vehicle, status?: VehicleStatus) {
  const raw = String(status?.status || vehicle.status || '').toLowerCase();
  if (raw.includes('maintenance') || raw.includes('repair') || raw.includes('critical')) return 'repair';
  if ((status?.dtc_active_count || 0) > 0 || raw.includes('warning')) return 'check';
  if (raw.includes('inactive') || raw.includes('offline')) return 'offline';
  if (raw.includes('driving')) return 'driving';
  return 'ok';
}

function StatusPill({ state }: { state: string }) {
  const label = state === 'repair' ? 'Reparatur nötig' : state === 'check' ? 'Prüfen' : state === 'offline' ? 'Offline' : state === 'driving' ? 'In Fahrt' : 'Okay';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: '28px', padding: '0 11px', borderRadius: '999px', border: `1px solid ${OPC_BRAND.border}`, background: '#FFFFFF', color: OPC_BRAND.text, fontSize: '12px', fontWeight: 820, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

function VehicleRow({ vehicle, status, latestTrip }: { vehicle: Vehicle; status?: VehicleStatus; latestTrip?: Trip }) {
  const state = normalizeStatus(vehicle, status);
  return (
    <a href={`/fuhrpark/fahrzeug/${vehicle.id}`} style={{ ...opcCardStyle, padding: '16px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) 120px 130px 140px 140px', gap: '14px', alignItems: 'center', textDecoration: 'none', color: OPC_BRAND.text }} className="opc-fleet-row">
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '14px', border: `1px solid ${OPC_BRAND.border}`, background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><CarFront size={19} /></div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 850, letterSpacing: '-0.035em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vehicle.display_name || 'Fahrzeug'}</div>
          <div style={{ marginTop: '4px', color: OPC_BRAND.muted, fontSize: '12px', fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vehicle.license_plate || 'Kennzeichen offen'} · {[vehicle.make, vehicle.model, vehicle.model_year].filter(Boolean).join(' ') || 'Fahrzeugdaten offen'}</div>
        </div>
      </div>
      <StatusPill state={state} />
      <div><div style={{ color: OPC_BRAND.faint, fontSize: '11px', fontWeight: 820 }}>Tank</div><div style={{ marginTop: 3, fontWeight: 820 }}>{formatFuel(status?.fuel_level_percent)}</div></div>
      <div><div style={{ color: OPC_BRAND.faint, fontSize: '11px', fontWeight: 820 }}>KM-Stand</div><div style={{ marginTop: 3, fontWeight: 820 }}>{formatKm(status?.odometer_km)}</div></div>
      <div><div style={{ color: OPC_BRAND.faint, fontSize: '11px', fontWeight: 820 }}>Letzte Fahrt</div><div style={{ marginTop: 3, fontWeight: 820 }}>{formatKm(latestTrip?.distance_km)}</div></div>
    </a>
  );
}

function CompactEmpty({ onSync, syncing, syncMessage }: { onSync: () => void; syncing: boolean; syncMessage: string }) {
  return (
    <div style={{ ...opcCardStyle, padding: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: '16px', fontWeight: 850, letterSpacing: '-0.035em' }}>Keine Fahrzeuge erfasst</div>
        <div style={{ marginTop: '5px', color: OPC_BRAND.muted, fontSize: '13px', fontWeight: 620 }}>{syncMessage || 'Fahrzeuge erscheinen nach der Synchronisation oder nach manueller Anlage.'}</div>
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button type="button" onClick={onSync} disabled={syncing} style={{ ...opcBlackButtonStyle, width: 'auto', height: '42px' }}><RefreshCw size={16} /> {syncing ? 'Lädt...' : 'Synchronisieren'}</button>
        <a href="/einstellungen" style={{ ...opcSecondaryButtonStyle, width: 'auto', height: '42px' }}>Einstellungen</a>
        <a href="/fuhrpark/fahrzeug/demo" style={{ ...opcSecondaryButtonStyle, width: 'auto', height: '42px' }}>Demo-Fahrzeug</a>
      </div>
    </div>
  );
}

export default function OPCFleetOverviewPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('map');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [error, setError] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [statuses, setStatuses] = useState<VehicleStatus[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);

  const loadFleet = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const vehiclesResult = await supabase
        .from('opc_fleet_vehicles')
        .select('id, display_name, license_plate, make, model, model_year, fuel_type, status, vin, home_base_label')
        .order('display_name', { ascending: true });
      if (vehiclesResult.error) throw vehiclesResult.error;
      setVehicles((vehiclesResult.data || []) as Vehicle[]);

      const [statusResult, tripResult, workOrderResult] = await Promise.all([
        supabase.from('opc_vehicle_status_current').select('vehicle_id, status, last_seen_at, speed_kmh, odometer_km, fuel_level_percent, range_km, dtc_active_count'),
        supabase.from('opc_vehicle_trips').select('id, vehicle_id, started_at, ended_at, start_address, end_address, distance_km').order('started_at', { ascending: false }).limit(40),
        supabase.from('opc_maintenance_work_orders').select('id, vehicle_id, title, priority, status, scheduled_for').in('status', ['open', 'planned', 'in_progress', 'waiting_parts']).order('created_at', { ascending: false }).limit(40),
      ]);

      if (!statusResult.error) setStatuses((statusResult.data || []) as VehicleStatus[]);
      if (!tripResult.error) setTrips((tripResult.data || []) as Trip[]);
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
      const haystack = [vehicle.display_name, vehicle.license_plate, vehicle.make, vehicle.model, vehicle.vin, vehicle.home_base_label].filter(Boolean).join(' ').toLowerCase();
      return matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [query, statusByVehicle, statusFilter, vehicles]);

  const drivingCount = vehicles.filter((vehicle) => normalizeStatus(vehicle, statusByVehicle.get(vehicle.id)) === 'driving').length;
  const checkCount = vehicles.filter((vehicle) => normalizeStatus(vehicle, statusByVehicle.get(vehicle.id)) === 'check').length;
  const repairCount = vehicles.filter((vehicle) => normalizeStatus(vehicle, statusByVehicle.get(vehicle.id)) === 'repair').length;

  async function runSync() {
    setSyncing(true);
    setSyncMessage('');
    setError('');
    try {
      const response = await fetch('/api/integrations/autoaid/pull', { method: 'POST', credentials: 'include' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(payload?.message || 'AutoAid Synchronisation fehlgeschlagen.');
      setSyncMessage(payload?.message || 'Synchronisation abgeschlossen.');
      await loadFleet(true);
      setActiveTab('vehicles');
    } catch (err: any) {
      setSyncMessage(err?.message || 'AutoAid Synchronisation fehlgeschlagen.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <OPCPageShell>
      <OPCMetricsGrid>
        <OPCMetricCard label="Aktive Fahrzeuge" value={loading ? '—' : vehicles.length} icon={<CarFront size={19} />} />
        <OPCMetricCard label="In Fahrt" value={loading ? '—' : drivingCount} icon={<Gauge size={19} />} />
        <OPCMetricCard label="Prüfen" value={loading ? '—' : checkCount} icon={<Wrench size={19} />} />
        <OPCMetricCard label="Reparatur nötig" value={loading ? '—' : repairCount} icon={<Wrench size={19} />} />
      </OPCMetricsGrid>

      <OPCToolbar columns="minmax(0, 1fr) 170px 180px 140px">
        <div style={{ position: 'relative' }}>
          <Search size={17} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: OPC_BRAND.faint }} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Fahrzeug, Kennzeichen, VIN oder Standort suchen" style={opcInputWithIconStyle} />
        </div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={opcSelectStyle}>
          <option value="all">Alle Status</option>
          <option value="ok">Okay</option>
          <option value="driving">In Fahrt</option>
          <option value="check">Prüfen</option>
          <option value="repair">Reparatur nötig</option>
          <option value="offline">Offline</option>
        </select>
        <button type="button" onClick={runSync} disabled={syncing} style={opcBlackButtonStyle}><RefreshCw size={16} /> {syncing ? 'Lädt...' : 'Synchronisieren'}</button>
        <a href="/fuhrpark/karte" style={opcSecondaryButtonStyle}><MapIcon size={16} /> Karte</a>
      </OPCToolbar>

      <OPCTabs tabs={[
        { key: 'map', label: 'Karte', active: activeTab === 'map', onClick: () => setActiveTab('map') },
        { key: 'vehicles', label: 'Fahrzeuge', active: activeTab === 'vehicles', onClick: () => setActiveTab('vehicles') },
        { key: 'logbook', label: 'Fahrtenbuch', active: activeTab === 'logbook', onClick: () => setActiveTab('logbook') },
        { key: 'maintenance', label: 'Wartung', active: activeTab === 'maintenance', onClick: () => setActiveTab('maintenance') },
      ]} />

      {error && <div style={{ ...opcCardStyle, padding: '14px 16px', color: OPC_BRAND.red, marginBottom: '14px', fontWeight: 720 }}>{error}</div>}

      {activeTab === 'map' && (
        <section style={{ ...opcCardStyle, padding: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: '14px', alignItems: 'stretch' }} className="opc-fleet-map-preview-grid">
            <div style={{ position: 'relative', height: 330, borderRadius: 18, overflow: 'hidden', border: `1px solid ${OPC_BRAND.border}`, background: '#F3F4F6' }}>
              <iframe title="Fuhrpark Karte Vorschau" src={mapPreviewUrl()} loading="lazy" style={{ border: 0, width: '100%', height: '100%' }} />
              <div style={{ position: 'absolute', left: 14, top: 14, ...opcCardStyle, padding: '10px 12px' }}>
                <div style={{ fontSize: 14, fontWeight: 850 }}>Logistikstandort</div>
                <div style={{ marginTop: 3, color: OPC_BRAND.muted, fontSize: 12, fontWeight: 650 }}>{LOGISTICS_LOCATION.address}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ ...opcCardStyle, padding: '16px', flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 850, letterSpacing: '-0.035em', marginBottom: 8 }}>Karte</div>
                <div style={{ color: OPC_BRAND.muted, fontSize: 13, lineHeight: 1.5, fontWeight: 620 }}>Home Base, Fahrzeugpositionen und Status bleiben hier als Vorschau sichtbar. Für die operative Ansicht öffnest du die grosse Karte.</div>
              </div>
              <a href="/fuhrpark/karte" style={{ ...opcBlackButtonStyle, height: 44 }}><MapIcon size={16} /> Zur grossen Karte</a>
              <a href="/fuhrpark/fahrzeug/demo" style={{ ...opcSecondaryButtonStyle, height: 44 }}><CarFront size={16} /> Demo-Fahrzeug öffnen</a>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'vehicles' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredVehicles.length === 0 && <CompactEmpty onSync={runSync} syncing={syncing} syncMessage={syncMessage} />}
          {filteredVehicles.map((vehicle) => (
            <VehicleRow key={vehicle.id} vehicle={vehicle} status={statusByVehicle.get(vehicle.id)} latestTrip={latestTripByVehicle.get(vehicle.id)} />
          ))}
        </section>
      )}

      {activeTab === 'logbook' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {trips.length === 0 && <div style={{ ...opcCardStyle, padding: '18px' }}><div style={{ fontSize: 16, fontWeight: 850 }}>Keine Fahrten im Verlauf</div><div style={{ marginTop: 5, color: OPC_BRAND.muted, fontSize: 13, fontWeight: 620 }}>Der Fahrtenverlauf wird gefüllt, sobald AutoAid-Fahrten verarbeitet werden.</div></div>}
          {trips.map((trip) => {
            const vehicle = trip.vehicle_id ? vehicles.find((item) => item.id === trip.vehicle_id) : undefined;
            return (
              <div key={trip.id} style={{ ...opcCardStyle, padding: '16px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 140px 140px', gap: '14px', alignItems: 'center' }} className="opc-fleet-row">
                <div><div style={{ fontSize: 15, fontWeight: 850 }}>{vehicle?.display_name || 'Fahrt'}</div><div style={{ marginTop: 4, color: OPC_BRAND.muted, fontSize: 12, fontWeight: 650 }}>{trip.start_address || 'Start offen'} → {trip.end_address || 'Ziel offen'}</div></div>
                <div><div style={{ color: OPC_BRAND.faint, fontSize: 11, fontWeight: 820 }}>Distanz</div><div style={{ marginTop: 3, fontWeight: 820 }}>{formatKm(trip.distance_km)}</div></div>
                <div><div style={{ color: OPC_BRAND.faint, fontSize: 11, fontWeight: 820 }}>Start</div><div style={{ marginTop: 3, fontWeight: 820 }}>{formatDate(trip.started_at)}</div></div>
              </div>
            );
          })}
        </section>
      )}

      {activeTab === 'maintenance' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {workOrders.length === 0 && <div style={{ ...opcCardStyle, padding: '18px' }}><div style={{ fontSize: 16, fontWeight: 850 }}>Keine offenen Wartungen</div><div style={{ marginTop: 5, color: OPC_BRAND.muted, fontSize: 13, fontWeight: 620 }}>Fällige Arbeiten und Empfehlungen erscheinen im Wartungsbereich.</div><a href="/fuhrpark/wartung" style={{ ...opcSecondaryButtonStyle, width: 'auto', height: 42, marginTop: 12 }}>Wartung öffnen</a></div>}
          {workOrders.map((order) => {
            const vehicle = order.vehicle_id ? vehicles.find((item) => item.id === order.vehicle_id) : undefined;
            return (
              <div key={order.id} style={{ ...opcCardStyle, padding: '16px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 140px 160px', gap: '14px', alignItems: 'center' }} className="opc-fleet-row">
                <div><div style={{ fontSize: 15, fontWeight: 850 }}>{order.title || 'Wartung'}</div><div style={{ marginTop: 4, color: OPC_BRAND.muted, fontSize: 12, fontWeight: 650 }}>{vehicle?.display_name || 'Fahrzeug'} · {order.priority || 'Priorität offen'}</div></div>
                <div><div style={{ color: OPC_BRAND.faint, fontSize: 11, fontWeight: 820 }}>Status</div><div style={{ marginTop: 3, fontWeight: 820 }}>{order.status || 'open'}</div></div>
                <a href="/fuhrpark/wartung" style={{ ...opcSecondaryButtonStyle, height: 42 }}>Wartung öffnen</a>
              </div>
            );
          })}
        </section>
      )}

      <style>{opcResponsiveStyle}</style>
      <style>{`
        @media (max-width: 1100px) {
          .opc-fleet-map-preview-grid,
          .opc-fleet-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </OPCPageShell>
  );
}
