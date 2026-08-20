import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  AlertTriangle,
  BatteryCharging,
  CarFront,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
  Route,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  OPC_BRAND,
  OPC_PAGE_FONT,
  opcBlackButtonStyle,
  opcSecondaryButtonStyle,
} from './opc/OPCPageTop';

type FleetVehicle = {
  id: string;
  display_name?: string | null;
  license_plate?: string | null;
  autoaid_vehicle_id?: string | null;
  autoaid_device_id?: string | null;
  autoaid_device_imei?: string | null;
  vin?: string | null;
  make?: string | null;
  model?: string | null;
  model_year?: number | null;
  fuel_type?: string | null;
  status?: string | null;
  home_base_label?: string | null;
  notes?: string | null;
  metadata?: Record<string, any> | null;
};

type VehicleStatus = {
  vehicle_id: string;
  last_seen_at?: string | null;
  last_position_at?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  speed_kmh?: number | null;
  heading?: number | null;
  ignition_on?: boolean | null;
  odometer_km?: number | null;
  fuel_level_percent?: number | null;
  range_km?: number | null;
  battery_voltage?: number | null;
  oil_level_percent?: number | null;
  adblue_level_percent?: number | null;
  dtc_active_count?: number | null;
  status?: string | null;
  raw_status?: Record<string, unknown> | null;
};

type VehicleLocation = {
  vehicle_id: string;
  recorded_at?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  speed_kmh?: number | null;
  heading?: number | null;
  ignition_on?: boolean | null;
  payload?: Record<string, unknown> | null;
};

type FleetAlert = {
  id: string;
  vehicle_id?: string | null;
  severity?: string | null;
  alert_type?: string | null;
  title?: string | null;
  message?: string | null;
  status?: string | null;
  detected_at?: string | null;
  created_at?: string | null;
};

type FleetPoint = {
  vehicle: FleetVehicle;
  status?: VehicleStatus;
  location?: VehicleLocation;
  latitude: number;
  longitude: number;
  online: boolean;
  moving: boolean;
  attention: boolean;
};

const BASEL_BBOX = '7.500,47.470,7.730,47.620';
const BASEL_MARKER = '47.5596,7.5886';

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

function isOnline(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() < 20 * 60_000;
}

function vehicleLabel(vehicle: FleetVehicle) {
  return vehicle.display_name || vehicle.license_plate || vehicle.vin || vehicle.autoaid_vehicle_id || 'OPC Fahrzeug';
}

function vehicleSubline(vehicle: FleetVehicle) {
  const model = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
  const plate = vehicle.license_plate ? ` · ${vehicle.license_plate}` : '';
  return `${model || vehicle.fuel_type || 'Fahrzeug'}${plate}`;
}

function buildMapSource(bbox: string, marker: string) {
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(marker)}`;
}

function clamp(value: number, min = 7, max = 93) {
  return Math.max(min, Math.min(max, value));
}

function Summary({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div style={summaryItemStyle}>
      <span style={summaryIconStyle}>{icon}</span>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={detailStyle}>
      <small>{label}</small>
      <strong>{value || '—'}</strong>
    </div>
  );
}

function StatusPill({ tone, children }: { tone: 'ok' | 'warning' | 'danger' | 'neutral'; children: ReactNode }) {
  const palette =
    tone === 'danger'
      ? ['#FEF2F2', '#991B1B', '#FCA5A5']
      : tone === 'warning'
        ? ['#FFFBEB', '#92400E', '#FDE68A']
        : tone === 'ok'
          ? ['#F0FDF4', '#166534', '#BBF7D0']
          : ['#F9FAFB', OPC_BRAND.muted, OPC_BRAND.border];

  return (
    <span
      style={{
        minHeight: '28px',
        padding: '5px 10px',
        borderRadius: '999px',
        border: `1px solid ${palette[2]}`,
        background: palette[0],
        color: palette[1],
        fontSize: '12px',
        fontWeight: 760,
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

export default function OPCFleetMapPage() {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [statuses, setStatuses] = useState<VehicleStatus[]>([]);
  const [locations, setLocations] = useState<VehicleLocation[]>([]);
  const [alerts, setAlerts] = useState<FleetAlert[]>([]);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [mapVersion, setMapVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [mapSource, setMapSource] = useState(buildMapSource(BASEL_BBOX, BASEL_MARKER));

  useEffect(() => {
    void loadFleet();
    const timer = window.setInterval(() => void loadFleet({ silent: true }), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  async function loadFleet(options: { silent?: boolean } = {}) {
    if (!options.silent) setRefreshing(true);
    setError('');

    try {
      const [vehiclesResult, statusResult, locationResult, alertResult] = await Promise.all([
        supabase
          .from('opc_fleet_vehicles')
          .select('id, display_name, license_plate, autoaid_vehicle_id, autoaid_device_id, autoaid_device_imei, vin, make, model, model_year, fuel_type, status, home_base_label, notes, metadata')
          .order('created_at', { ascending: false }),
        supabase.from('opc_vehicle_status_current').select('*'),
        supabase
          .from('opc_vehicle_locations')
          .select('*')
          .order('recorded_at', { ascending: false })
          .limit(500),
        supabase
          .from('opc_fleet_alerts')
          .select('id, vehicle_id, severity, alert_type, title, message, status, detected_at, created_at')
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
      setRefreshing(false);
    }
  }

  const latestLocationByVehicle = useMemo(() => {
    const map = new Map<string, VehicleLocation>();
    locations.forEach((location) => {
      if (!location.vehicle_id || map.has(String(location.vehicle_id))) return;
      if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') return;
      map.set(String(location.vehicle_id), location);
    });
    return map;
  }, [locations]);

  const statusByVehicle = useMemo(() => {
    const map = new Map<string, VehicleStatus>();
    statuses.forEach((status) => {
      if (status.vehicle_id) map.set(String(status.vehicle_id), status);
    });
    return map;
  }, [statuses]);

  const alertByVehicle = useMemo(() => {
    const map = new Map<string, FleetAlert[]>();
    alerts.forEach((alert) => {
      if (!alert.vehicle_id) return;
      const id = String(alert.vehicle_id);
      if (!map.has(id)) map.set(id, []);
      map.get(id)!.push(alert);
    });
    return map;
  }, [alerts]);

  const points = useMemo<FleetPoint[]>(() => {
    return vehicles
      .map((vehicle) => {
        const status = statusByVehicle.get(vehicle.id);
        const location = latestLocationByVehicle.get(vehicle.id);
        const latitude = typeof status?.latitude === 'number' ? status.latitude : location?.latitude;
        const longitude = typeof status?.longitude === 'number' ? status.longitude : location?.longitude;

        if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;

        const lastSeen = status?.last_seen_at || status?.last_position_at || location?.recorded_at;
        const speed = Number(status?.speed_kmh ?? location?.speed_kmh ?? 0);
        const vehicleAlerts = alertByVehicle.get(vehicle.id) || [];
        const attention = vehicleAlerts.length > 0 || Number(status?.dtc_active_count || 0) > 0 || ['warning', 'maintenance'].includes(String(status?.status || vehicle.status || '').toLowerCase());

        return {
          vehicle,
          status,
          location,
          latitude,
          longitude,
          online: isOnline(lastSeen),
          moving: speed > 3,
          attention,
        };
      })
      .filter((point): point is FleetPoint => Boolean(point));
  }, [alertByVehicle, latestLocationByVehicle, statusByVehicle, vehicles]);

  const filtered = useMemo(() => {
    return points.filter((point) => {
      const normalizedStatus = String(point.status?.status || point.vehicle.status || '').toLowerCase();
      if (selectedStatus === 'all') return true;
      if (selectedStatus === 'online') return point.online;
      if (selectedStatus === 'offline') return !point.online;
      if (selectedStatus === 'moving') return point.moving;
      if (selectedStatus === 'attention') return point.attention;
      return normalizedStatus === selectedStatus;
    });
  }, [points, selectedStatus]);

  const bounds = useMemo(() => {
    if (!points.length) return { minLng: 7.5, minLat: 47.47, maxLng: 7.73, maxLat: 47.62 };
    const lats = points.map((point) => point.latitude);
    const lngs = points.map((point) => point.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latPad = Math.max((maxLat - minLat) * 0.35, 0.025);
    const lngPad = Math.max((maxLng - minLng) * 0.35, 0.035);
    return {
      minLat: minLat - latPad,
      maxLat: maxLat + latPad,
      minLng: minLng - lngPad,
      maxLng: maxLng + lngPad,
    };
  }, [points]);

  useEffect(() => {
    const marker = points[0] ? `${points[0].latitude},${points[0].longitude}` : BASEL_MARKER;
    const bbox = `${bounds.minLng},${bounds.minLat},${bounds.maxLng},${bounds.maxLat}`;
    setMapSource(buildMapSource(bbox, marker));
  }, [bounds, points]);

  useEffect(() => {
    if (selectedVehicleId && vehicles.some((vehicle) => vehicle.id === selectedVehicleId)) return;
    setSelectedVehicleId(filtered[0]?.vehicle.id || vehicles[0]?.id || null);
  }, [filtered, selectedVehicleId, vehicles]);

  function pointToPosition(point: FleetPoint) {
    const x = clamp(((point.longitude - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100);
    const y = clamp(100 - ((point.latitude - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100);
    return { x, y };
  }

  function locateUser() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const deltaLat = 0.08;
      const deltaLng = 0.11;
      const bbox = `${lng - deltaLng},${lat - deltaLat},${lng + deltaLng},${lat + deltaLat}`;
      setMapSource(buildMapSource(bbox, `${lat},${lng}`));
      setMapVersion((value) => value + 1);
    });
  }

  function refresh() {
    void loadFleet();
    setMapVersion((value) => value + 1);
  }

  const selectedPoint = filtered.find((point) => point.vehicle.id === selectedVehicleId) || filtered[0] || points[0] || null;
  const selectedAlerts = selectedPoint ? alertByVehicle.get(selectedPoint.vehicle.id) || [] : [];
  const lowFuel = points.filter((point) => Number(point.status?.fuel_level_percent ?? 100) <= 20).length;
  const onlineCount = points.filter((point) => point.online).length;
  const attentionCount = points.filter((point) => point.attention).length;

  return (
    <div className="opc-fleet-map-page" style={pageStyle}>
      <iframe
        key={`${mapSource}-${mapVersion}`}
        title="OPC Fuhrpark Live Map"
        src={mapSource}
        style={iframeStyle}
        loading="eager"
        referrerPolicy="no-referrer-when-downgrade"
      />

      {filtered.map((point) => {
        const { x, y } = pointToPosition(point);
        const active = selectedPoint?.vehicle.id === point.vehicle.id;
        return (
          <button
            key={point.vehicle.id}
            type="button"
            onClick={() => setSelectedVehicleId(point.vehicle.id)}
            style={{
              ...markerStyle,
              left: `${x}%`,
              top: `${y}%`,
              background: point.attention ? '#991B1B' : point.moving ? OPC_BRAND.black : '#FFFFFF',
              color: point.attention || point.moving ? '#FFFFFF' : OPC_BRAND.text,
              borderColor: active ? '#FF6A00' : '#FFFFFF',
              transform: `translate(-50%, -50%) scale(${active ? 1.08 : 1})`,
            }}
            title={vehicleLabel(point.vehicle)}
          >
            <CarFront size={18} />
          </button>
        );
      })}

      <div className="ecotaxi-map-toolbar" style={toolbarStyle}>
        <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)} aria-label="Fahrzeuge filtern" style={selectStyle}>
          <option value="all">Alle Fahrzeuge</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="moving">In Bewegung</option>
          <option value="attention">Warnung / Wartung</option>
          <option value="maintenance">Wartung</option>
        </select>
        <button type="button" onClick={locateUser} style={iconButtonStyle} title="Standort anzeigen"><LocateFixed size={18} /></button>
        <button type="button" onClick={refresh} style={iconButtonStyle} title="Aktualisieren"><RefreshCw size={18} /></button>
      </div>

      <div className="ecotaxi-map-summary" style={summaryStyle}>
        <Summary icon={<CarFront size={17} />} value={filtered.length} label="Sichtbar" />
        <Summary icon={<Wifi size={17} />} value={onlineCount} label="Online" />
        <Summary icon={<WifiOff size={17} />} value={points.length - onlineCount} label="Offline" />
        <Summary icon={<BatteryCharging size={17} />} value={lowFuel} label="Tiefstand" />
      </div>

      <aside className="opc-fleet-map-panel" style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', marginBottom: '14px' }}>
          <div>
            <div style={eyebrowStyle}>ORANGE BROOKLYN FUHRPARK</div>
            <h1 style={panelTitleStyle}>Live Map</h1>
            <p style={panelSubtitleStyle}>AutoAid Positionen, Status, Warnungen und Wartungssignale.</p>
          </div>
          <button type="button" onClick={refresh} disabled={refreshing} style={{ ...opcBlackButtonStyle, width: 'auto', height: '44px', minWidth: '44px', padding: '0 13px' }}>
            <RefreshCw size={16} />
          </button>
        </div>

        {error ? <div style={errorStyle}>{error}</div> : null}

        {!selectedPoint ? (
          <div style={emptyStyle}>
            <MapPin size={20} />
            <span>Noch keine AutoAid-Positionen vorhanden.</span>
          </div>
        ) : (
          <>
            <section style={selectedCardStyle}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px' }}>
                <div>
                  <h2 style={vehicleTitleStyle}>{vehicleLabel(selectedPoint.vehicle)}</h2>
                  <p style={vehicleMetaStyle}>{vehicleSubline(selectedPoint.vehicle)}</p>
                </div>
                <StatusPill tone={selectedPoint.attention ? 'warning' : selectedPoint.online ? 'ok' : 'neutral'}>
                  {selectedPoint.attention ? 'Prüfen' : selectedPoint.online ? 'Online' : 'Offline'}
                </StatusPill>
              </div>

              <div style={detailGridStyle}>
                <Detail label="Letzter Kontakt" value={fmtDate(selectedPoint.status?.last_seen_at || selectedPoint.location?.recorded_at)} />
                <Detail label="Tempo" value={`${Math.round(Number(selectedPoint.status?.speed_kmh ?? selectedPoint.location?.speed_kmh ?? 0))} km/h`} />
                <Detail label="Kilometer" value={selectedPoint.status?.odometer_km ? `${Math.round(Number(selectedPoint.status.odometer_km)).toLocaleString('de-CH')} km` : '—'} />
                <Detail label="Reichweite" value={selectedPoint.status?.range_km ? `${Math.round(Number(selectedPoint.status.range_km))} km` : '—'} />
              </div>
            </section>

            <div style={quickActionsStyle}>
              <a href="/fuhrpark/wartung" style={{ ...opcSecondaryButtonStyle, height: '42px' }}><Wrench size={16} /> Wartung</a>
              <a href="/fuhrpark/karte" style={{ ...opcSecondaryButtonStyle, height: '42px' }}><Route size={16} /> Karte</a>
            </div>

            <section style={miniSectionStyle}>
              <h3 style={miniSectionTitleStyle}>Fahrzeugstatus</h3>
              <div style={signalListStyle}>
                <Detail label="Kraftstoff" value={selectedPoint.status?.fuel_level_percent != null ? `${Math.round(Number(selectedPoint.status.fuel_level_percent))}%` : '—'} />
                <Detail label="Batterie" value={selectedPoint.status?.battery_voltage != null ? `${Number(selectedPoint.status.battery_voltage).toFixed(1)} V` : '—'} />
                <Detail label="Öl" value={selectedPoint.status?.oil_level_percent != null ? `${Math.round(Number(selectedPoint.status.oil_level_percent))}%` : '—'} />
                <Detail label="Fehlercodes" value={Number(selectedPoint.status?.dtc_active_count || 0)} />
              </div>
            </section>

            <section style={miniSectionStyle}>
              <h3 style={miniSectionTitleStyle}>Warnungen</h3>
              {!selectedAlerts.length ? (
                <div style={mutedLineStyle}>Keine offenen Fuhrpark-Warnungen.</div>
              ) : (
                selectedAlerts.slice(0, 3).map((alert) => (
                  <div key={alert.id} style={alertLineStyle}>
                    <AlertTriangle size={16} />
                    <span><strong>{alert.title}</strong><small>{alert.message || alert.alert_type}</small></span>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </aside>

      <style>{`
        .opc-fleet-map-page iframe{display:block}
        @media(max-width:1080px){
          .opc-fleet-map-panel{left:18px!important;right:18px!important;top:auto!important;bottom:98px!important;width:auto!important;max-height:46vh!important;overflow:auto!important}
          .ecotaxi-map-summary{left:18px!important;right:18px!important;bottom:18px!important;grid-template-columns:repeat(4,minmax(0,1fr))!important}
        }
        @media(max-width:768px){
          .opc-fleet-map-page{height:calc(100vh - 36px)!important;min-height:720px!important}
          .ecotaxi-map-toolbar{top:12px!important;right:12px!important;left:72px!important}
          .ecotaxi-map-toolbar select{flex:1!important;min-width:0!important}
          .ecotaxi-map-summary{grid-template-columns:repeat(2,minmax(0,1fr))!important}
          .opc-fleet-map-panel{left:12px!important;right:12px!important;bottom:142px!important}
        }
      `}</style>
    </div>
  );
}

const pageStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: 'calc(100vh - 48px)',
  minHeight: '720px',
  overflow: 'hidden',
  background: '#EEF0F3',
  borderRadius: '24px',
  border: `1px solid ${OPC_BRAND.border}`,
  fontFamily: OPC_PAGE_FONT,
};

const iframeStyle: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, background: '#EEF0F3' };
const toolbarStyle: CSSProperties = { position: 'absolute', zIndex: 20, top: '18px', right: '18px', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', border: `1px solid ${OPC_BRAND.border}`, borderRadius: '17px', background: 'rgba(255,255,255,.95)', backdropFilter: 'blur(12px)', boxShadow: '0 12px 34px rgba(15,17,21,.14)' };
const selectStyle: CSSProperties = { minWidth: '190px', height: '44px', borderRadius: '13px', border: `1px solid ${OPC_BRAND.border}`, background: '#FFF', padding: '0 13px', color: OPC_BRAND.text, fontSize: '14px', fontWeight: 760, fontFamily: OPC_PAGE_FONT };
const iconButtonStyle: CSSProperties = { width: '44px', height: '44px', borderRadius: '13px', border: `1px solid ${OPC_BRAND.border}`, background: '#FFF', color: OPC_BRAND.text, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 };
const summaryStyle: CSSProperties = { position: 'absolute', zIndex: 20, left: '18px', bottom: '18px', display: 'grid', gridTemplateColumns: 'repeat(4,minmax(112px,1fr))', gap: '4px', padding: '10px', border: `1px solid ${OPC_BRAND.border}`, borderRadius: '17px', background: 'rgba(255,255,255,.95)', backdropFilter: 'blur(12px)', boxShadow: '0 12px 34px rgba(15,17,21,.14)' };
const summaryItemStyle: CSSProperties = { minWidth: '110px', minHeight: '42px', padding: '0 10px', display: 'grid', gridTemplateColumns: '22px auto 1fr', alignItems: 'center', gap: '7px', fontFamily: OPC_PAGE_FONT, color: OPC_BRAND.text };
const summaryIconStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: OPC_BRAND.black };
const markerStyle: CSSProperties = { position: 'absolute', zIndex: 15, width: '46px', height: '46px', borderRadius: '16px', border: '3px solid #FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 12px 30px rgba(15,17,21,.22)', transition: 'transform .16s ease, background .16s ease, border-color .16s ease' };
const panelStyle: CSSProperties = { position: 'absolute', zIndex: 22, top: '92px', right: '18px', width: '390px', padding: '18px', border: `1px solid ${OPC_BRAND.border}`, borderRadius: '22px', background: 'rgba(255,255,255,.96)', backdropFilter: 'blur(16px)', boxShadow: '0 18px 54px rgba(15,17,21,.18)', fontFamily: OPC_PAGE_FONT };
const eyebrowStyle: CSSProperties = { fontSize: '11px', letterSpacing: '.15em', color: OPC_BRAND.muted, fontWeight: 820, marginBottom: '7px' };
const panelTitleStyle: CSSProperties = { margin: 0, fontSize: '30px', lineHeight: 1, letterSpacing: '-.05em', fontWeight: 880, color: OPC_BRAND.text };
const panelSubtitleStyle: CSSProperties = { margin: '8px 0 0', color: OPC_BRAND.muted, fontSize: '13px', fontWeight: 650, lineHeight: 1.45 };
const selectedCardStyle: CSSProperties = { border: `1px solid ${OPC_BRAND.border}`, borderRadius: '18px', padding: '16px', background: '#FFFFFF', marginBottom: '12px' };
const vehicleTitleStyle: CSSProperties = { margin: 0, fontSize: '18px', fontWeight: 860, letterSpacing: '-.035em', color: OPC_BRAND.text };
const vehicleMetaStyle: CSSProperties = { margin: '6px 0 0', fontSize: '13px', fontWeight: 640, color: OPC_BRAND.muted };
const detailGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '10px', marginTop: '14px' };
const detailStyle: CSSProperties = { minHeight: '58px', padding: '10px', border: `1px solid ${OPC_BRAND.border}`, borderRadius: '14px', display: 'grid', alignContent: 'center', gap: '5px' };
const quickActionsStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' };
const miniSectionStyle: CSSProperties = { border: `1px solid ${OPC_BRAND.border}`, borderRadius: '18px', padding: '14px', background: '#FFFFFF', marginBottom: '12px' };
const miniSectionTitleStyle: CSSProperties = { margin: '0 0 11px', fontSize: '15px', fontWeight: 840, letterSpacing: '-.03em', color: OPC_BRAND.text };
const signalListStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '8px' };
const mutedLineStyle: CSSProperties = { color: OPC_BRAND.muted, fontSize: '13px', fontWeight: 650, lineHeight: 1.45 };
const alertLineStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: '9px', padding: '10px 0', color: OPC_BRAND.text, borderTop: `1px solid ${OPC_BRAND.border}` };
const errorStyle: CSSProperties = { padding: '12px 13px', marginBottom: '12px', borderRadius: '14px', border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#991B1B', fontSize: '13px', fontWeight: 760 };
const emptyStyle: CSSProperties = { minHeight: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px', border: `1px dashed ${OPC_BRAND.border}`, borderRadius: '18px', color: OPC_BRAND.muted, fontSize: '13px', fontWeight: 700 };
