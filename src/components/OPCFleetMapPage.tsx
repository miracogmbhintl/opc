import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AlertTriangle, CarFront, Clock3, Gauge, MapPin, Navigation, RefreshCw, Route, Satellite } from 'lucide-react';
import { supabase } from '../lib/supabase';

type FleetVehicle = {
  id: string;
  display_name?: string | null;
  license_plate?: string | null;
  vehicle_identifier?: string | null;
  vehicle_type?: string | null;
  status?: string | null;
  autoaid_vehicle_id?: string | null;
};

type VehicleStatus = {
  vehicle_id: string;
  recorded_at?: string | null;
  ignition_on?: boolean | null;
  engine_on?: boolean | null;
  vehicle_speed_kmh?: number | null;
  mileage_km?: number | null;
  fuel_level_percent?: number | null;
  battery_voltage?: number | null;
  dtc_count?: number | null;
  raw_status?: Record<string, unknown> | null;
};

type VehicleLocation = {
  vehicle_id: string;
  recorded_at?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  speed_kmh?: number | null;
  heading_degrees?: number | null;
  address?: string | null;
};

type FleetAlert = {
  id: string;
  vehicle_id?: string | null;
  severity?: string | null;
  alert_type?: string | null;
  title?: string | null;
  message?: string | null;
  status?: string | null;
  created_at?: string | null;
};

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  black: '#0F1115',
  card: '#FFFFFF',
  soft: '#FAFAFA',
  green: '#166534',
  greenBg: '#F0FDF4',
  orange: '#ff6a00',
  orangeBg: '#FFF7ED',
  red: '#B91C1C',
  redBg: '#FEF2F2',
};

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

const cardStyle: CSSProperties = {
  background: BRAND.card,
  border: `1px solid ${BRAND.border}`,
  borderRadius: '20px',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

function fmtDate(value?: string | null) {
  if (!value) return 'Noch keine Daten';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Noch keine Daten';
  return date.toLocaleString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function VehicleMarker({
  vehicle,
  location,
  x,
  y,
}: {
  vehicle: FleetVehicle;
  location: VehicleLocation;
  x: number;
  y: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        display: 'grid',
        placeItems: 'center',
      }}
      title={`${vehicle.display_name || vehicle.license_plate || 'Fahrzeug'} · ${location.address || ''}`}
    >
      <div
        style={{
          width: '42px',
          height: '42px',
          borderRadius: '16px',
          background: BRAND.black,
          color: '#FFFFFF',
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 12px 30px rgba(15, 17, 21, 0.24)',
          border: '3px solid #FFFFFF',
        }}
      >
        <CarFront size={19} />
      </div>
      <div
        style={{
          marginTop: '6px',
          padding: '5px 8px',
          borderRadius: '999px',
          background: '#FFFFFF',
          border: `1px solid ${BRAND.border}`,
          color: BRAND.text,
          fontSize: '11px',
          fontWeight: 820,
          whiteSpace: 'nowrap',
          boxShadow: '0 6px 18px rgba(15, 17, 21, 0.10)',
        }}
      >
        {vehicle.license_plate || vehicle.display_name || 'OPC Fahrzeug'}
      </div>
    </div>
  );
}

export default function OPCFleetMapPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [statuses, setStatuses] = useState<VehicleStatus[]>([]);
  const [locations, setLocations] = useState<VehicleLocation[]>([]);
  const [alerts, setAlerts] = useState<FleetAlert[]>([]);

  async function loadFleet(options: { refresh?: boolean } = {}) {
    if (options.refresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const [vehiclesResult, statusResult, locationResult, alertResult] = await Promise.all([
        supabase
          .from('opc_fleet_vehicles')
          .select('id, display_name, license_plate, vehicle_identifier, vehicle_type, status, autoaid_vehicle_id')
          .order('created_at', { ascending: false }),
        supabase
          .from('opc_vehicle_status_current')
          .select('*'),
        supabase
          .from('opc_vehicle_locations')
          .select('*')
          .order('recorded_at', { ascending: false })
          .limit(250),
        supabase
          .from('opc_fleet_alerts')
          .select('id, vehicle_id, severity, alert_type, title, message, status, created_at')
          .in('status', ['open', 'new', 'active'])
          .order('created_at', { ascending: false })
          .limit(8),
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
    void loadFleet();
  }, []);

  const latestLocationByVehicle = useMemo(() => {
    const map = new Map<string, VehicleLocation>();
    locations.forEach((location) => {
      if (!location.vehicle_id || map.has(location.vehicle_id)) return;
      if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') return;
      map.set(location.vehicle_id, location);
    });
    return map;
  }, [locations]);

  const statusByVehicle = useMemo(() => {
    const map = new Map<string, VehicleStatus>();
    statuses.forEach((status) => {
      if (status.vehicle_id) map.set(status.vehicle_id, status);
    });
    return map;
  }, [statuses]);

  const points = useMemo(() => {
    return vehicles
      .map((vehicle) => ({ vehicle, location: latestLocationByVehicle.get(vehicle.id), status: statusByVehicle.get(vehicle.id) }))
      .filter((point): point is { vehicle: FleetVehicle; location: VehicleLocation; status?: VehicleStatus } => Boolean(point.location));
  }, [latestLocationByVehicle, statusByVehicle, vehicles]);

  const bounds = useMemo(() => {
    if (!points.length) return null;
    const lats = points.map((point) => point.location.latitude as number);
    const lngs = points.map((point) => point.location.longitude as number);
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
  }, [points]);

  function pointToPosition(location: VehicleLocation) {
    if (!bounds || bounds.minLat === bounds.maxLat || bounds.minLng === bounds.maxLng) {
      return { x: 50, y: 50 };
    }

    const lng = location.longitude as number;
    const lat = location.latitude as number;
    const x = 12 + ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 76;
    const y = 88 - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 76;
    return { x, y };
  }

  const onlineCount = points.length;
  const alertCount = alerts.length;
  const movingCount = points.filter((point) => Number(point.location.speed_kmh || point.status?.vehicle_speed_kmh || 0) > 3).length;

  return (
    <div style={{ width: '100%', minHeight: '100%', fontFamily: pageFont, color: BRAND.text }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '18px', marginBottom: '18px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '16px',
                background: BRAND.orangeBg,
                color: BRAND.orange,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Satellite size={22} />
            </span>
            <div>
              <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 860, letterSpacing: '-0.045em' }}>Fuhrpark Live Map</h1>
              <p style={{ margin: '4px 0 0', color: BRAND.muted, fontSize: '14px', fontWeight: 650 }}>
                AutoAid-Fahrzeuge, Live-Positionen, Status und Warnungen im OPC-Portal.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadFleet({ refresh: true })}
          disabled={refreshing}
          style={{
            minHeight: '44px',
            padding: '0 14px',
            borderRadius: '14px',
            border: `1px solid ${BRAND.black}`,
            background: BRAND.black,
            color: '#FFFFFF',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 820,
            cursor: refreshing ? 'wait' : 'pointer',
          }}
        >
          <RefreshCw size={16} />
          {refreshing ? 'Aktualisieren...' : 'Aktualisieren'}
        </button>
      </div>

      {error && (
        <div style={{ ...cardStyle, padding: '14px 16px', marginBottom: '16px', background: BRAND.redBg, borderColor: '#FCA5A5', color: BRAND.red, fontWeight: 720 }}>
          {error}
        </div>
      )}

      <div className="opc-fleet-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '16px' }}>
        {[
          { label: 'Fahrzeuge', value: vehicles.length, icon: CarFront },
          { label: 'Mit Position', value: onlineCount, icon: MapPin },
          { label: 'In Bewegung', value: movingCount, icon: Navigation },
          { label: 'Offene Warnungen', value: alertCount, icon: AlertTriangle },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} style={{ ...cardStyle, padding: '18px', minHeight: '96px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '25px', fontWeight: 860, letterSpacing: '-0.04em' }}>{loading ? '—' : item.value}</div>
                <div style={{ marginTop: '10px', color: BRAND.muted, fontSize: '13px', fontWeight: 720 }}>{item.label}</div>
              </div>
              <span style={{ width: '38px', height: '38px', borderRadius: '13px', border: `1px solid ${BRAND.border}`, display: 'grid', placeItems: 'center', background: '#FAFAFA' }}>
                <Icon size={19} />
              </span>
            </div>
          );
        })}
      </div>

      <div className="opc-fleet-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(340px, 0.55fr)', gap: '16px' }}>
        <div style={{ ...cardStyle, padding: '18px', minHeight: '620px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 840, letterSpacing: '-0.035em' }}>Live Karte</h2>
              <p style={{ margin: '5px 0 0', color: BRAND.muted, fontSize: '13px', fontWeight: 650 }}>
                Positionen werden aus `opc_vehicle_locations` gelesen. Nach dem Pull-Worker erscheinen echte AutoAid-Punkte.
              </p>
            </div>
            <span style={{ padding: '8px 11px', borderRadius: '999px', background: BRAND.soft, color: BRAND.muted, fontSize: '12px', fontWeight: 820 }}>
              {fmtDate(points[0]?.location.recorded_at)}
            </span>
          </div>

          <div
            style={{
              position: 'relative',
              height: '540px',
              borderRadius: '20px',
              border: `1px solid ${BRAND.border}`,
              overflow: 'hidden',
              background:
                'linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 45%, #FFFFFF 100%)',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, opacity: 0.5, backgroundImage: 'linear-gradient(#E5E7EB 1px, transparent 1px), linear-gradient(90deg, #E5E7EB 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
            <div style={{ position: 'absolute', left: '8%', right: '8%', top: '49%', height: '18px', borderRadius: '999px', background: '#E5E7EB', transform: 'rotate(-7deg)' }} />
            <div style={{ position: 'absolute', left: '35%', top: '8%', bottom: '8%', width: '18px', borderRadius: '999px', background: '#E5E7EB', transform: 'rotate(9deg)' }} />
            <div style={{ position: 'absolute', left: '15%', right: '18%', top: '28%', height: '12px', borderRadius: '999px', background: '#FDE68A', opacity: 0.55, transform: 'rotate(10deg)' }} />

            {points.length ? (
              points.map((point) => {
                const position = pointToPosition(point.location);
                return <VehicleMarker key={point.vehicle.id} vehicle={point.vehicle} location={point.location} x={position.x} y={position.y} />;
              })
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: '24px' }}>
                <div>
                  <MapPin size={32} color={BRAND.faint} />
                  <div style={{ marginTop: '12px', color: BRAND.text, fontSize: '15px', fontWeight: 840 }}>Noch keine AutoAid-Positionen</div>
                  <div style={{ marginTop: '6px', color: BRAND.muted, fontSize: '13px', fontWeight: 650, lineHeight: 1.45 }}>
                    Sobald der AutoAid Pull-Worker läuft, werden Fahrzeuge hier wie im EcoTaxi Fleet Map Pattern angezeigt.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '16px', alignContent: 'start' }}>
          <div style={{ ...cardStyle, padding: '18px' }}>
            <h2 style={{ margin: '0 0 14px', fontSize: '18px', fontWeight: 840, letterSpacing: '-0.035em' }}>Fahrzeugstatus</h2>
            <div style={{ display: 'grid', gap: '12px' }}>
              {loading ? (
                <div style={{ color: BRAND.muted, fontSize: '13px', fontWeight: 650 }}>Fuhrparkdaten werden geladen...</div>
              ) : vehicles.length ? (
                vehicles.map((vehicle) => {
                  const location = latestLocationByVehicle.get(vehicle.id);
                  const status = statusByVehicle.get(vehicle.id);
                  return (
                    <div key={vehicle.id} style={{ padding: '14px', borderRadius: '16px', border: `1px solid ${BRAND.border}`, background: '#FFFFFF' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 840 }}>{vehicle.display_name || vehicle.license_plate || 'OPC Fahrzeug'}</div>
                          <div style={{ marginTop: '4px', color: BRAND.muted, fontSize: '12px', fontWeight: 680 }}>
                            {vehicle.license_plate || vehicle.vehicle_identifier || vehicle.autoaid_vehicle_id || 'Ohne Kennung'}
                          </div>
                        </div>
                        <span style={{ padding: '6px 8px', borderRadius: '999px', background: location ? BRAND.greenBg : BRAND.soft, color: location ? BRAND.green : BRAND.muted, fontSize: '11px', fontWeight: 820 }}>
                          {location ? 'Position' : 'Keine Position'}
                        </span>
                      </div>
                      <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', color: BRAND.muted, fontSize: '12px', fontWeight: 680 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Gauge size={14} />{Number(location?.speed_kmh || status?.vehicle_speed_kmh || 0).toFixed(0)} km/h</div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Clock3 size={14} />{fmtDate(location?.recorded_at || status?.recorded_at)}</div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Route size={14} />{status?.mileage_km ? `${Number(status.mileage_km).toFixed(0)} km` : 'km offen'}</div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={14} />{status?.dtc_count || 0} DTC</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ color: BRAND.muted, fontSize: '13px', fontWeight: 650 }}>Noch keine Fahrzeuge in `opc_fleet_vehicles`.</div>
              )}
            </div>
          </div>

          <div style={{ ...cardStyle, padding: '18px' }}>
            <h2 style={{ margin: '0 0 14px', fontSize: '18px', fontWeight: 840, letterSpacing: '-0.035em' }}>Warnungen</h2>
            <div style={{ display: 'grid', gap: '10px' }}>
              {alerts.length ? (
                alerts.map((alert) => (
                  <div key={alert.id} style={{ padding: '12px', borderRadius: '14px', border: `1px solid ${BRAND.border}`, background: alert.severity === 'critical' ? BRAND.redBg : BRAND.soft }}>
                    <div style={{ color: alert.severity === 'critical' ? BRAND.red : BRAND.text, fontSize: '13px', fontWeight: 840 }}>{alert.title || alert.alert_type || 'Fuhrpark-Warnung'}</div>
                    <div style={{ marginTop: '4px', color: BRAND.muted, fontSize: '12px', fontWeight: 650, lineHeight: 1.45 }}>{alert.message || fmtDate(alert.created_at)}</div>
                  </div>
                ))
              ) : (
                <div style={{ color: BRAND.muted, fontSize: '13px', fontWeight: 650 }}>Keine offenen Fuhrpark-Warnungen.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .opc-fleet-stats,
          .opc-fleet-layout {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 680px) {
          .opc-fleet-stats {
            grid-template-columns: 1fr 1fr !important;
          }
          .opc-settings-grid-2,
          .opc-settings-grid-3 {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
