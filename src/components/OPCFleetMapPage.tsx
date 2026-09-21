import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CarFront, LocateFixed, MapPin, RefreshCw, Search, Wifi, WifiOff, Wrench } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { OPC_BRAND, OPC_PAGE_FONT, opcBlackButtonStyle, opcCardStyle, opcInputWithIconStyle, opcSecondaryButtonStyle, opcSelectStyle } from './opc/OPCPageTop';

type Vehicle = {
  id: string;
  display_name: string;
  license_plate?: string | null;
  make?: string | null;
  model?: string | null;
  status?: string | null;
};

type VehicleStatus = {
  vehicle_id: string;
  last_seen_at?: string | null;
  status?: string | null;
  speed_kmh?: number | null;
  fuel_level_percent?: number | null;
  range_km?: number | null;
  odometer_km?: number | null;
  dtc_active_count?: number | null;
};

type VehicleLocation = {
  vehicle_id: string;
  recorded_at?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  speed_kmh?: number | null;
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

function stateFor(vehicle?: Vehicle, status?: VehicleStatus) {
  const raw = String(status?.status || vehicle?.status || '').toLowerCase();
  if (raw.includes('maintenance') || (status?.dtc_active_count || 0) > 0) return 'warning';
  if (raw.includes('offline') || raw.includes('inactive')) return 'offline';
  return 'online';
}

function mapUrl(points: Array<{ location: VehicleLocation }>, selected?: VehicleLocation | null) {
  const source = selected || points[0]?.location;
  const lat = Number(source?.latitude || 47.5596);
  const lng = Number(source?.longitude || 7.5886);
  const span = points.length > 1 ? 0.08 : 0.02;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - span}%2C${lat - span}%2C${lng + span}%2C${lat + span}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export default function OPCFleetMapPage() {
  const mapShellRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [statuses, setStatuses] = useState<VehicleStatus[]>([]);
  const [locations, setLocations] = useState<VehicleLocation[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadFleet = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [vehiclesResult, statusResult, locationResult] = await Promise.all([
        supabase.from('opc_fleet_vehicles').select('id, display_name, license_plate, make, model, status').order('display_name', { ascending: true }),
        supabase.from('opc_vehicle_status_current').select('vehicle_id, last_seen_at, status, speed_kmh, fuel_level_percent, range_km, odometer_km, dtc_active_count'),
        supabase.from('opc_vehicle_locations').select('vehicle_id, recorded_at, latitude, longitude, address, speed_kmh').order('recorded_at', { ascending: false }).limit(300),
      ]);
      if (vehiclesResult.error) throw vehiclesResult.error;
      setVehicles((vehiclesResult.data || []) as Vehicle[]);
      if (!statusResult.error) setStatuses((statusResult.data || []) as VehicleStatus[]);
      if (!locationResult.error) setLocations((locationResult.data || []) as VehicleLocation[]);
    } catch (err: any) {
      setError(err?.message || 'Fuhrpark-Karte konnte nicht geladen werden.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadFleet();
  }, [loadFleet]);

  const statusByVehicle = useMemo(() => {
    const map = new Map<string, VehicleStatus>();
    statuses.forEach((status) => status.vehicle_id && map.set(status.vehicle_id, status));
    return map;
  }, [statuses]);

  const latestLocationByVehicle = useMemo(() => {
    const map = new Map<string, VehicleLocation>();
    locations.forEach((location) => {
      if (!location.vehicle_id || map.has(location.vehicle_id)) return;
      if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') return;
      map.set(location.vehicle_id, location);
    });
    return map;
  }, [locations]);

  const points = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return vehicles
      .map((vehicle) => ({ vehicle, status: statusByVehicle.get(vehicle.id), location: latestLocationByVehicle.get(vehicle.id) }))
      .filter((entry): entry is { vehicle: Vehicle; status?: VehicleStatus; location: VehicleLocation } => Boolean(entry.location))
      .filter((entry) => {
        const state = stateFor(entry.vehicle, entry.status);
        const matchesStatus = statusFilter === 'all' || statusFilter === state;
        const haystack = [entry.vehicle.display_name, entry.vehicle.license_plate, entry.vehicle.make, entry.vehicle.model, entry.location.address].filter(Boolean).join(' ').toLowerCase();
        return matchesStatus && (!needle || haystack.includes(needle));
      });
  }, [latestLocationByVehicle, query, statusByVehicle, statusFilter, vehicles]);

  const selected = points.find((point) => point.vehicle.id === selectedVehicleId) || points[0] || null;
  const onlineCount = points.filter((point) => stateFor(point.vehicle, point.status) === 'online').length;
  const warningCount = points.filter((point) => stateFor(point.vehicle, point.status) === 'warning').length;
  const offlineCount = vehicles.length - onlineCount - warningCount;

  function handleFocusMap() {
    mapShellRef.current?.querySelector('iframe')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  return (
    <div
      ref={mapShellRef}
      style={{
        position: 'relative',
        width: 'calc(100% + 56px)',
        height: 'calc(100vh - 0px)',
        minHeight: '720px',
        margin: '-24px -28px -112px',
        overflow: 'hidden',
        background: '#F3F4F6',
        fontFamily: OPC_PAGE_FONT,
        color: OPC_BRAND.text,
        overscrollBehavior: 'contain',
      }}
    >
      <iframe
        title="Fuhrpark Live Map"
        src={mapUrl(points, selected?.location || null)}
        loading="lazy"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 0,
          background: '#EEF2F7',
        }}
      />

      <div style={{ position: 'absolute', top: 18, left: 18, right: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, pointerEvents: 'none' }}>
        <div style={{ ...opcCardStyle, padding: '12px 14px', minWidth: 240, pointerEvents: 'auto' }}>
          <div style={{ fontSize: '15px', fontWeight: 870, letterSpacing: '-0.035em' }}>Fuhrpark Karte</div>
          <div style={{ marginTop: 4, color: OPC_BRAND.muted, fontSize: 12, fontWeight: 650 }}>{loading ? 'Lädt...' : `${points.length} sichtbar · ${formatDate(selected?.location.recorded_at)}`}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 142px 42px 42px', gap: 10, pointerEvents: 'auto' }} className="opc-map-controls">
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: OPC_BRAND.faint, pointerEvents: 'none' }} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Fahrzeug suchen" style={{ ...opcInputWithIconStyle, height: 42, background: '#FFFFFF' }} />
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ ...opcSelectStyle, height: 42, background: '#FFFFFF' }}>
            <option value="all">Alle</option>
            <option value="online">Online</option>
            <option value="warning">Prüfen</option>
            <option value="offline">Offline</option>
          </select>
          <button type="button" onClick={handleFocusMap} style={{ ...opcSecondaryButtonStyle, width: 42, height: 42, padding: 0 }} title="Karte fokussieren"><LocateFixed size={16} /></button>
          <button type="button" onClick={() => void loadFleet(true)} disabled={refreshing} style={{ ...opcBlackButtonStyle, width: 42, height: 42, padding: 0 }} title="Aktualisieren"><RefreshCw size={16} /></button>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 18, bottom: 18, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', pointerEvents: 'none' }}>
        <div style={{ ...opcCardStyle, padding: '10px 12px', display: 'flex', gap: 14, alignItems: 'center', pointerEvents: 'auto' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 750 }}><CarFront size={15} /> {vehicles.length} Fahrzeuge</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 750, color: OPC_BRAND.green }}><Wifi size={15} /> {onlineCount} Online</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 750, color: OPC_BRAND.amber }}><Wrench size={15} /> {warningCount} Prüfen</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 750, color: OPC_BRAND.muted }}><WifiOff size={15} /> {Math.max(0, offlineCount)} Offline</span>
        </div>
      </div>

      {selected && (
        <aside style={{ position: 'absolute', right: 18, bottom: 18, width: 340, maxWidth: 'calc(100% - 36px)', pointerEvents: 'auto', ...opcCardStyle, padding: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 13, border: `1px solid ${OPC_BRAND.border}`, background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CarFront size={19} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.vehicle.display_name}</div>
              <div style={{ marginTop: 3, color: OPC_BRAND.muted, fontSize: 12, fontWeight: 650 }}>{selected.vehicle.license_plate || 'Kennzeichen offen'} · {formatDate(selected.location.recorded_at)}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div style={{ border: `1px solid ${OPC_BRAND.border}`, borderRadius: 14, padding: 10 }}><div style={{ color: OPC_BRAND.faint, fontSize: 11, fontWeight: 820 }}>Tank</div><div style={{ marginTop: 3, fontSize: 15, fontWeight: 850 }}>{formatFuel(selected.status?.fuel_level_percent)}</div></div>
            <div style={{ border: `1px solid ${OPC_BRAND.border}`, borderRadius: 14, padding: 10 }}><div style={{ color: OPC_BRAND.faint, fontSize: 11, fontWeight: 820 }}>KM-Stand</div><div style={{ marginTop: 3, fontSize: 15, fontWeight: 850 }}>{formatKm(selected.status?.odometer_km)}</div></div>
          </div>
          <div style={{ color: OPC_BRAND.muted, fontSize: 13, lineHeight: 1.45, marginBottom: 12 }}>{selected.location.address || 'Adresse nicht hinterlegt'}</div>
          <a href={`/fuhrpark/fahrzeug/${selected.vehicle.id}`} style={{ ...opcBlackButtonStyle, height: 42 }}>Fahrzeug öffnen</a>
        </aside>
      )}

      {points.length > 1 && (
        <div style={{ position: 'absolute', left: 18, top: 92, display: 'flex', flexDirection: 'column', gap: 8, width: 250, maxHeight: 'calc(100vh - 190px)', overflow: 'auto', pointerEvents: 'auto' }} className="opc-map-list">
          {points.slice(0, 12).map((point) => (
            <button key={point.vehicle.id} type="button" onClick={() => setSelectedVehicleId(point.vehicle.id)} style={{ ...opcCardStyle, padding: '10px 12px', textAlign: 'left', cursor: 'pointer', borderColor: selected?.vehicle.id === point.vehicle.id ? OPC_BRAND.black : OPC_BRAND.border }}>
              <div style={{ fontSize: 13, fontWeight: 830 }}>{point.vehicle.display_name}</div>
              <div style={{ marginTop: 3, color: OPC_BRAND.muted, fontSize: 12, fontWeight: 650 }}>{point.vehicle.license_plate || 'Kennzeichen offen'} · {Math.round(Number(point.location.speed_kmh || point.status?.speed_kmh || 0))} km/h</div>
            </button>
          ))}
        </div>
      )}

      {error && <div style={{ position: 'absolute', left: 18, right: 18, top: 82, ...opcCardStyle, padding: 12, color: OPC_BRAND.red, fontWeight: 720 }}>{error}</div>}

      <style>{`
        .opc-map-controls input,
        .opc-map-controls select,
        .opc-map-controls button { box-shadow: 0 1px 2px rgba(15,17,21,.06); }
        @media (max-width: 980px) {
          .opc-map-controls { grid-template-columns: 1fr 120px 42px 42px !important; width: 100%; }
          .opc-map-list { display: none !important; }
        }
        @media (max-width: 720px) {
          .opc-map-controls { grid-template-columns: 1fr 42px 42px !important; }
          .opc-map-controls select { display: none !important; }
        }
      `}</style>
    </div>
  );
}
