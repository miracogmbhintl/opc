import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CarFront, LocateFixed, MapPin, RefreshCw, Wifi, WifiOff, Wrench } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { OPC_BRAND, OPC_PAGE_FONT } from './opc/OPCPageTop';

type FleetVehicle = {
  id: string;
  display_name?: string | null;
  license_plate?: string | null;
  status?: string | null;
  autoaid_vehicle_id?: string | null;
  autoaid_device_id?: string | null;
  vin?: string | null;
  make?: string | null;
  model?: string | null;
  model_year?: number | null;
  fuel_type?: string | null;
};

type VehicleStatus = {
  vehicle_id: string;
  last_seen_at?: string | null;
  last_position_at?: string | null;
  ignition_on?: boolean | null;
  speed_kmh?: number | null;
  odometer_km?: number | null;
  fuel_level_percent?: number | null;
  range_km?: number | null;
  battery_voltage?: number | null;
  oil_level_percent?: number | null;
  dtc_active_count?: number | null;
  status?: string | null;
};

type VehicleLocation = {
  vehicle_id: string;
  recorded_at?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  speed_kmh?: number | null;
  heading?: number | null;
  address?: string | null;
};

type FleetAlert = {
  id: string;
  vehicle_id?: string | null;
  severity?: string | null;
  title?: string | null;
  message?: string | null;
  status?: string | null;
  detected_at?: string | null;
};

const mapOuterStyle: CSSProperties = {
  position: 'relative',
  width: 'calc(100% + 56px)',
  height: '100vh',
  minHeight: '720px',
  margin: '-24px -28px -112px',
  overflow: 'hidden',
  background: '#EEF2F7',
  fontFamily: OPC_PAGE_FONT,
  color: OPC_BRAND.text,
  overscrollBehavior: 'contain',
  touchAction: 'pan-x pan-y',
};

const glassStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.90)',
  border: `1px solid ${OPC_BRAND.border}`,
  boxShadow: '0 14px 40px rgba(15, 17, 21, 0.12)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
};

function parseNumber(value: unknown): number | null {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function vehicleLabel(vehicle?: FleetVehicle) {
  if (!vehicle) return 'Fahrzeug';
  return vehicle.display_name || vehicle.license_plate || vehicle.vin || 'OPC Fahrzeug';
}

function isOnline(status?: VehicleStatus, location?: VehicleLocation) {
  const value = status?.last_seen_at || status?.last_position_at || location?.recorded_at;
  if (!value) return false;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  return Date.now() - time < 45 * 60 * 1000;
}

function MiniStat({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
      <span style={{ color: OPC_BRAND.black, display: 'inline-flex', alignItems: 'center' }}>{icon}</span>
      <strong style={{ fontSize: '18px', fontWeight: 860, letterSpacing: '-0.035em' }}>{value}</strong>
      <span style={{ color: OPC_BRAND.text, fontSize: '14px', fontWeight: 650, whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );
}

export default function OPCFleetMapPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [statuses, setStatuses] = useState<VehicleStatus[]>([]);
  const [locations, setLocations] = useState<VehicleLocation[]>([]);
  const [alerts, setAlerts] = useState<FleetAlert[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function loadFleet(refresh = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const [vehiclesResult, statusResult, locationResult, alertResult] = await Promise.all([
        supabase
          .from('opc_fleet_vehicles')
          .select('id, display_name, license_plate, autoaid_vehicle_id, autoaid_device_id, vin, make, model, model_year, fuel_type, status')
          .order('display_name', { ascending: true }),
        supabase.from('opc_vehicle_status_current').select('*'),
        supabase
          .from('opc_vehicle_locations')
          .select('vehicle_id, recorded_at, latitude, longitude, speed_kmh, heading, address')
          .order('recorded_at', { ascending: false })
          .limit(400),
        supabase
          .from('opc_fleet_alerts')
          .select('id, vehicle_id, severity, title, message, status, detected_at')
          .in('status', ['open', 'acknowledged'])
          .order('detected_at', { ascending: false })
          .limit(20),
      ]);

      if (vehiclesResult.error) throw vehiclesResult.error;
      if (statusResult.error) throw statusResult.error;
      if (locationResult.error) throw locationResult.error;
      if (alertResult.error) throw alertResult.error;

      setVehicles((vehiclesResult.data || []) as FleetVehicle[]);
      setStatuses((statusResult.data || []) as VehicleStatus[]);
      setLocations((locationResult.data || []) as VehicleLocation[]);
      setAlerts((alertResult.data || []) as FleetAlert[]);
    } catch (err: any) {
      setError(err?.message || 'Fuhrparkdaten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadFleet(false);
  }, []);

  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;

    const preventBrowserZoom = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
      }
    };

    el.addEventListener('wheel', preventBrowserZoom, { passive: false });
    return () => el.removeEventListener('wheel', preventBrowserZoom);
  }, []);

  const statusByVehicle = useMemo(() => {
    const map = new Map<string, VehicleStatus>();
    statuses.forEach((status) => {
      if (status.vehicle_id) map.set(status.vehicle_id, status);
    });
    return map;
  }, [statuses]);

  const latestLocationByVehicle = useMemo(() => {
    const map = new Map<string, VehicleLocation>();
    locations.forEach((location) => {
      if (!location.vehicle_id || map.has(location.vehicle_id)) return;
      if (parseNumber(location.latitude) === null || parseNumber(location.longitude) === null) return;
      map.set(location.vehicle_id, location);
    });
    return map;
  }, [locations]);

  const vehicleRows = useMemo(() => {
    return vehicles.map((vehicle) => {
      const status = statusByVehicle.get(vehicle.id);
      const location = latestLocationByVehicle.get(vehicle.id);
      const online = isOnline(status, location);
      const warningCount = alerts.filter((alert) => alert.vehicle_id === vehicle.id).length;
      const lowFuel = Number(status?.fuel_level_percent || 0) > 0 && Number(status?.fuel_level_percent || 0) < 15;
      return { vehicle, status, location, online, warningCount, lowFuel };
    });
  }, [alerts, latestLocationByVehicle, statusByVehicle, vehicles]);

  const visibleRows = useMemo(() => {
    return vehicleRows.filter((row) => {
      if (vehicleFilter === 'online') return row.online;
      if (vehicleFilter === 'offline') return !row.online;
      if (vehicleFilter === 'warning') return row.warningCount > 0 || row.lowFuel || (row.status?.dtc_active_count || 0) > 0;
      return true;
    });
  }, [vehicleFilter, vehicleRows]);

  const selected = useMemo(() => {
    return vehicleRows.find((row) => row.vehicle.id === selectedVehicleId) || visibleRows[0] || null;
  }, [selectedVehicleId, vehicleRows, visibleRows]);

  const points = visibleRows.filter((row) => row.location && parseNumber(row.location.latitude) !== null && parseNumber(row.location.longitude) !== null);
  const onlineCount = vehicleRows.filter((row) => row.online).length;
  const offlineCount = vehicleRows.length - onlineCount;
  const lowFuelCount = vehicleRows.filter((row) => row.lowFuel).length;

  const bounds = useMemo(() => {
    if (!points.length) return null;
    const lats = points.map((point) => Number(point.location?.latitude));
    const lngs = points.map((point) => Number(point.location?.longitude));
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
  }, [points]);

  const mapUrl = useMemo(() => {
    if (selected?.location?.latitude && selected.location.longitude) {
      const lat = Number(selected.location.latitude);
      const lon = Number(selected.location.longitude);
      return `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.15}%2C${lat - 0.09}%2C${lon + 0.15}%2C${lat + 0.09}&layer=mapnik&marker=${lat}%2C${lon}`;
    }

    return 'https://www.openstreetmap.org/export/embed.html?bbox=7.4200%2C47.4200%2C7.7800%2C47.6900&layer=mapnik&marker=47.5596%2C7.5886';
  }, [selected]);

  function pointToPosition(location: VehicleLocation) {
    if (!bounds || bounds.minLat === bounds.maxLat || bounds.minLng === bounds.maxLng) return { x: 50, y: 50 };
    const lat = Number(location.latitude);
    const lon = Number(location.longitude);
    const x = 8 + ((lon - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 84;
    const y = 88 - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 76;
    return { x, y };
  }

  return (
    <div ref={mapRef} className="opc-fleet-map-fullscreen" style={mapOuterStyle}>
      <iframe
        title="OPC Fuhrpark Live Map"
        src={mapUrl}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
      />

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(90deg, rgba(255,255,255,0.14), transparent 28%, transparent 72%, rgba(255,255,255,0.10))' }} />

      <div
        className="opc-fleet-map-title"
        style={{
          position: 'absolute',
          left: '20px',
          top: '20px',
          ...glassStyle,
          borderRadius: '22px',
          padding: '14px 18px',
          maxWidth: '420px',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 860, letterSpacing: '0.20em', color: OPC_BRAND.muted, textTransform: 'uppercase' }}>OPC Fuhrpark</div>
        <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CarFront size={21} />
          <h1 style={{ margin: 0, fontSize: '28px', lineHeight: 1, fontWeight: 880, letterSpacing: '-0.05em' }}>Live Map</h1>
        </div>
        <p style={{ margin: '8px 0 0', color: OPC_BRAND.muted, fontSize: '13px', fontWeight: 650, lineHeight: 1.35 }}>
          Position, Status, Tankstand und Warnungen aus AutoAid.
        </p>
      </div>

      <div
        className="opc-fleet-map-controls"
        style={{
          position: 'absolute',
          right: '20px',
          bottom: '92px',
          ...glassStyle,
          borderRadius: '22px',
          padding: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          pointerEvents: 'auto',
        }}
      >
        <select
          aria-label="Fahrzeugfilter"
          value={vehicleFilter}
          onChange={(event) => setVehicleFilter(event.target.value)}
          style={{
            width: '210px',
            height: '46px',
            borderRadius: '14px',
            border: `1px solid ${OPC_BRAND.border}`,
            background: '#FFFFFF',
            color: OPC_BRAND.text,
            padding: '0 12px',
            fontSize: '14px',
            fontWeight: 760,
            fontFamily: OPC_PAGE_FONT,
            outline: 'none',
          }}
        >
          <option value="all">Alle Fahrzeuge</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="warning">Warnungen</option>
        </select>

        <button type="button" title="Auf aktuelle Flotte zentrieren" style={mapButtonStyle}>
          <LocateFixed size={20} />
        </button>
        <button type="button" title="Aktualisieren" onClick={() => void loadFleet(true)} disabled={refreshing} style={mapButtonStyle}>
          <RefreshCw size={20} />
        </button>
      </div>

      {points.map((row) => {
        const location = row.location as VehicleLocation;
        const position = pointToPosition(location);
        return (
          <button
            key={row.vehicle.id}
            type="button"
            onClick={() => setSelectedVehicleId(row.vehicle.id)}
            style={{
              position: 'absolute',
              left: `${position.x}%`,
              top: `${position.y}%`,
              transform: 'translate(-50%, -50%)',
              width: '42px',
              height: '42px',
              borderRadius: '16px',
              border: '3px solid #FFFFFF',
              background: row.online ? OPC_BRAND.black : '#6B7280',
              color: '#FFFFFF',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              boxShadow: '0 14px 34px rgba(15, 17, 21, 0.24)',
              zIndex: selectedVehicleId === row.vehicle.id ? 10 : 5,
            }}
            title={vehicleLabel(row.vehicle)}
          >
            <CarFront size={19} />
          </button>
        );
      })}

      <div
        className="opc-fleet-map-stats"
        style={{
          position: 'absolute',
          left: '20px',
          bottom: '20px',
          ...glassStyle,
          borderRadius: '24px',
          padding: '15px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '28px',
          pointerEvents: 'auto',
        }}
      >
        <MiniStat icon={<CarFront size={18} />} value={points.length} label="Sichtbar" />
        <MiniStat icon={<Wifi size={18} />} value={onlineCount} label="Online" />
        <MiniStat icon={<WifiOff size={18} />} value={offlineCount} label="Offline" />
        <MiniStat icon={<Wrench size={18} />} value={lowFuelCount} label="Tiefstand" />
      </div>

      <div
        className="opc-fleet-map-drawer"
        style={{
          position: 'absolute',
          right: '20px',
          bottom: '20px',
          width: '360px',
          ...glassStyle,
          borderRadius: '24px',
          padding: '18px',
          pointerEvents: 'auto',
        }}
      >
        {selected ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 860, letterSpacing: '0.18em', color: OPC_BRAND.muted, textTransform: 'uppercase' }}>
                  {selected.vehicle.license_plate || 'Ohne Kennzeichen'}
                </div>
                <h2 style={{ margin: '4px 0 0', fontSize: '22px', lineHeight: 1.05, fontWeight: 880, letterSpacing: '-0.045em' }}>{vehicleLabel(selected.vehicle)}</h2>
                <p style={{ margin: '7px 0 0', color: OPC_BRAND.muted, fontSize: '13px', lineHeight: 1.45, fontWeight: 650 }}>
                  {selected.vehicle.make || 'Marke offen'} {selected.vehicle.model || ''} · {selected.status?.status || selected.vehicle.status || 'Status offen'}
                </p>
              </div>
              <a
                href={`/fuhrpark/fahrzeug/${selected.vehicle.id}`}
                style={{
                  height: '40px',
                  padding: '0 12px',
                  borderRadius: '13px',
                  border: `1px solid ${OPC_BRAND.black}`,
                  background: OPC_BRAND.black,
                  color: '#FFFFFF',
                  display: 'inline-flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                  fontSize: '12px',
                  fontWeight: 820,
                  whiteSpace: 'nowrap',
                }}
              >
                Details
              </a>
            </div>

            <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <MapFact label="Tank" value={selected.status?.fuel_level_percent != null ? `${Math.round(Number(selected.status.fuel_level_percent))}%` : '—'} />
              <MapFact label="Reichweite" value={selected.status?.range_km != null ? `${Math.round(Number(selected.status.range_km))} km` : '—'} />
              <MapFact label="Kilometer" value={selected.status?.odometer_km != null ? `${Math.round(Number(selected.status.odometer_km)).toLocaleString('de-CH')} km` : '—'} />
              <MapFact label="Letzte Sichtung" value={formatDate(selected.status?.last_seen_at || selected.location?.recorded_at)} />
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minHeight: '72px' }}>
            <MapPin size={22} color={OPC_BRAND.muted} />
            <div>
              <strong style={{ fontSize: '14px', fontWeight: 820 }}>Noch keine AutoAid-Positionen vorhanden.</strong>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: OPC_BRAND.muted, fontWeight: 650, lineHeight: 1.35 }}>
                Sobald der Pull-Worker läuft, erscheinen die Fahrzeuge direkt auf dieser Karte.
              </p>
            </div>
          </div>
        )}

        {error && <div style={{ marginTop: '12px', color: OPC_BRAND.red, fontSize: '12px', fontWeight: 720 }}>{error}</div>}
        {loading && <div style={{ marginTop: '12px', color: OPC_BRAND.muted, fontSize: '12px', fontWeight: 720 }}>Lade Fuhrparkdaten...</div>}
      </div>

      <style>{`
        .opc-fleet-map-fullscreen iframe {
          touch-action: pan-x pan-y;
        }

        @media (max-width: 1180px) {
          .opc-fleet-map-fullscreen {
            width: calc(100% + 44px) !important;
            margin: -22px -22px -112px !important;
          }

          .opc-fleet-map-title {
            max-width: 360px !important;
          }

          .opc-fleet-map-drawer {
            width: 320px !important;
          }
        }

        @media (max-width: 860px) {
          .opc-fleet-map-fullscreen {
            width: calc(100% + 32px) !important;
            margin: -18px -16px -120px !important;
            min-height: 720px !important;
          }

          .opc-fleet-map-title {
            left: 12px !important;
            right: 12px !important;
            top: 12px !important;
            max-width: none !important;
          }

          .opc-fleet-map-controls {
            left: 12px !important;
            right: 12px !important;
            bottom: 104px !important;
          }

          .opc-fleet-map-controls select {
            width: 100% !important;
          }

          .opc-fleet-map-stats {
            left: 12px !important;
            right: 12px !important;
            bottom: 12px !important;
            gap: 14px !important;
            overflow-x: auto;
          }

          .opc-fleet-map-drawer {
            left: 12px !important;
            right: 12px !important;
            bottom: 176px !important;
            width: auto !important;
          }
        }
      `}</style>
    </div>
  );
}

const mapButtonStyle: CSSProperties = {
  width: '46px',
  height: '46px',
  borderRadius: '14px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

function MapFact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: `1px solid ${OPC_BRAND.border}`, borderRadius: '15px', background: 'rgba(255,255,255,0.72)', padding: '10px 11px' }}>
      <div style={{ color: OPC_BRAND.muted, fontSize: '10px', letterSpacing: '0.12em', fontWeight: 860, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ marginTop: '4px', color: OPC_BRAND.text, fontSize: '14px', fontWeight: 820 }}>{value}</div>
    </div>
  );
}
