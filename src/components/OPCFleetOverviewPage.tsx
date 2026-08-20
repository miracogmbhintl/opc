import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CarFront,
  CheckCircle2,
  Clock3,
  Fuel,
  Gauge,
  Map,
  RefreshCw,
  Search,
  ShieldAlert,
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
  opcSearchIconStyle,
  opcSecondaryButtonStyle,
  opcSelectStyle,
} from './opc/OPCPageTop';

type FleetVehicle = {
  id: string;
  display_name: string;
  license_plate?: string | null;
  vin?: string | null;
  make?: string | null;
  model?: string | null;
  model_year?: number | null;
  fuel_type?: string | null;
  status?: string | null;
  autoaid_vehicle_id?: string | null;
  autoaid_device_id?: string | null;
  home_base_label?: string | null;
  notes?: string | null;
};

type VehicleStatus = {
  vehicle_id: string;
  last_seen_at?: string | null;
  last_position_at?: string | null;
  odometer_km?: number | null;
  fuel_level_percent?: number | null;
  range_km?: number | null;
  speed_kmh?: number | null;
  battery_voltage?: number | null;
  dtc_active_count?: number | null;
  status?: string | null;
};

type FleetAlert = {
  id: string;
  vehicle_id?: string | null;
  severity?: string | null;
  title?: string | null;
  message?: string | null;
  status?: string | null;
  detected_at?: string | null;
  created_at?: string | null;
};

type VehicleTrip = {
  id: string;
  vehicle_id?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  distance_km?: number | null;
  duration_seconds?: number | null;
  start_address?: string | null;
  end_address?: string | null;
};

type HandoverLog = {
  id: string;
  vehicle_id: string;
  action: string;
  occurred_at?: string | null;
  odometer_km?: number | null;
  fuel_level_percent?: number | null;
  location_text?: string | null;
  note?: string | null;
  created_by?: string | null;
};

type TabKey = 'vehicles' | 'logbook' | 'maintenance';

const statusLabels: Record<string, string> = {
  active: 'Aktiv',
  inactive: 'Inaktiv',
  maintenance: 'Wartung',
  sold: 'Verkauft',
  archived: 'Archiviert',
  online: 'Online',
  driving: 'Fährt',
  stopped: 'Steht',
  offline: 'Offline',
  warning: 'Achtung',
  unknown: 'Unbekannt',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatNumber(value?: number | null, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toLocaleString('de-CH', { maximumFractionDigits: 1 })}${suffix}`;
}

function getVehicleLabel(vehicle: FleetVehicle) {
  return vehicle.display_name || vehicle.license_plate || vehicle.vin || 'OPC Fahrzeug';
}

function getVehicleMeta(vehicle: FleetVehicle) {
  return [vehicle.license_plate, vehicle.make, vehicle.model, vehicle.model_year]
    .filter(Boolean)
    .join(' · ') || 'Fahrzeugdaten noch nicht vollständig';
}

function needsAttention(vehicle: FleetVehicle, status?: VehicleStatus, alerts: FleetAlert[] = []) {
  return (
    vehicle.status === 'maintenance' ||
    status?.status === 'warning' ||
    status?.status === 'maintenance' ||
    Number(status?.dtc_active_count || 0) > 0 ||
    alerts.some((alert) => ['open', 'active', 'new'].includes(String(alert.status || 'open')))
  );
}

export default function OPCFleetOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('vehicles');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [handoverVehicleId, setHandoverVehicleId] = useState('');
  const [handoverNote, setHandoverNote] = useState('');
  const [handoverAction, setHandoverAction] = useState<'picked_up' | 'returned' | 'issue_reported'>('picked_up');
  const [savingLog, setSavingLog] = useState(false);

  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [statuses, setStatuses] = useState<VehicleStatus[]>([]);
  const [alerts, setAlerts] = useState<FleetAlert[]>([]);
  const [trips, setTrips] = useState<VehicleTrip[]>([]);
  const [handoverLogs, setHandoverLogs] = useState<HandoverLog[]>([]);

  const loadFleet = useCallback(async (options: { refresh?: boolean } = {}) => {
    if (options.refresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const [vehicleResult, statusResult, alertResult, tripResult, logResult] = await Promise.all([
        supabase
          .from('opc_fleet_vehicles')
          .select('id, display_name, license_plate, vin, make, model, model_year, fuel_type, status, autoaid_vehicle_id, autoaid_device_id, home_base_label, notes')
          .order('display_name', { ascending: true }),
        supabase.from('opc_vehicle_status_current').select('*'),
        supabase
          .from('opc_fleet_alerts')
          .select('id, vehicle_id, severity, title, message, status, detected_at, created_at')
          .in('status', ['open', 'active', 'new', 'acknowledged'])
          .order('detected_at', { ascending: false })
          .limit(100),
        supabase
          .from('opc_vehicle_trips')
          .select('id, vehicle_id, started_at, ended_at, distance_km, duration_seconds, start_address, end_address')
          .order('started_at', { ascending: false })
          .limit(50),
        supabase
          .from('opc_vehicle_handover_logs')
          .select('id, vehicle_id, action, occurred_at, odometer_km, fuel_level_percent, location_text, note, created_by')
          .order('occurred_at', { ascending: false })
          .limit(50),
      ]);

      if (vehicleResult.error) throw vehicleResult.error;
      if (statusResult.error) throw statusResult.error;
      if (alertResult.error) throw alertResult.error;
      if (tripResult.error) throw tripResult.error;
      if (logResult.error && !String(logResult.error.message || '').includes('does not exist')) throw logResult.error;

      setVehicles((vehicleResult.data || []) as FleetVehicle[]);
      setStatuses((statusResult.data || []) as VehicleStatus[]);
      setAlerts((alertResult.data || []) as FleetAlert[]);
      setTrips((tripResult.data || []) as VehicleTrip[]);
      setHandoverLogs((logResult.data || []) as HandoverLog[]);
    } catch (err: any) {
      setError(err?.message || 'Fuhrparkdaten konnten nicht geladen werden.');
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
    statuses.forEach((status) => {
      if (status.vehicle_id) map.set(status.vehicle_id, status);
    });
    return map;
  }, [statuses]);

  const alertsByVehicle = useMemo(() => {
    const map = new Map<string, FleetAlert[]>();
    alerts.forEach((alert) => {
      if (!alert.vehicle_id) return;
      const next = map.get(alert.vehicle_id) || [];
      next.push(alert);
      map.set(alert.vehicle_id, next);
    });
    return map;
  }, [alerts]);

  const lastTripByVehicle = useMemo(() => {
    const map = new Map<string, VehicleTrip>();
    trips.forEach((trip) => {
      if (trip.vehicle_id && !map.has(trip.vehicle_id)) map.set(trip.vehicle_id, trip);
    });
    return map;
  }, [trips]);

  const filteredVehicles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return vehicles.filter((vehicle) => {
      const status = statusByVehicle.get(vehicle.id);
      const vehicleAlerts = alertsByVehicle.get(vehicle.id) || [];
      const attention = needsAttention(vehicle, status, vehicleAlerts);
      const lowFuel = Number(status?.fuel_level_percent ?? 101) <= 20;
      const runtimeStatus = String(status?.status || vehicle.status || 'unknown');

      if (statusFilter === 'active' && vehicle.status !== 'active') return false;
      if (statusFilter === 'attention' && !attention) return false;
      if (statusFilter === 'low_fuel' && !lowFuel) return false;
      if (statusFilter === 'driving' && Number(status?.speed_kmh || 0) <= 3) return false;
      if (!needle) return true;

      const haystack = [
        vehicle.display_name,
        vehicle.license_plate,
        vehicle.vin,
        vehicle.make,
        vehicle.model,
        vehicle.model_year,
        vehicle.fuel_type,
        runtimeStatus,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [alertsByVehicle, query, statusByVehicle, statusFilter, vehicles]);

  const totalVehicles = vehicles.length;
  const movingCount = vehicles.filter((vehicle) => Number(statusByVehicle.get(vehicle.id)?.speed_kmh || 0) > 3).length;
  const lowFuelCount = vehicles.filter((vehicle) => Number(statusByVehicle.get(vehicle.id)?.fuel_level_percent ?? 101) <= 20).length;
  const attentionCount = vehicles.filter((vehicle) => needsAttention(vehicle, statusByVehicle.get(vehicle.id), alertsByVehicle.get(vehicle.id) || [])).length;

  async function saveHandoverLog() {
    if (!handoverVehicleId) {
      setError('Bitte zuerst ein Fahrzeug auswählen.');
      return;
    }

    setSavingLog(true);
    setError('');

    try {
      const status = statusByVehicle.get(handoverVehicleId);
      const { error: insertError } = await supabase.from('opc_vehicle_handover_logs').insert({
        vehicle_id: handoverVehicleId,
        action: handoverAction,
        odometer_km: status?.odometer_km ?? null,
        fuel_level_percent: status?.fuel_level_percent ?? null,
        note: handoverNote.trim() || null,
      });

      if (insertError) throw insertError;

      setHandoverNote('');
      await loadFleet({ refresh: true });
    } catch (err: any) {
      setError(err?.message || 'Fahrzeuglog konnte nicht gespeichert werden.');
    } finally {
      setSavingLog(false);
    }
  }

  return (
    <OPCPageShell>
      <style>{opcResponsiveStyle}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '18px', marginBottom: '22px' }}>
        <div>
          <p style={{ margin: '0 0 8px', color: OPC_BRAND.faint, fontSize: '12px', fontWeight: 860, letterSpacing: '0.32em' }}>
            ORANGE BROOKLYN FUHRPARK
          </p>
          <h1 style={{ margin: 0, color: OPC_BRAND.text, fontSize: '34px', lineHeight: 1.05, fontWeight: 880, letterSpacing: '-0.055em' }}>
            Fahrzeuge
          </h1>
          <p style={{ margin: '10px 0 0', color: OPC_BRAND.muted, fontSize: '15px', fontWeight: 650 }}>
            Fahrzeugliste, Live-Status, Tankstand, Kilometer, Fahrtenbuch und AutoAid Hinweise.
          </p>
        </div>

        <a href="/fuhrpark/karte" style={{ ...opcBlackButtonStyle, width: 'auto', minWidth: '170px' }}>
          <Map size={16} /> Live Map
        </a>
      </div>

      <OPCMetricsGrid>
        <OPCMetricCard label="Fahrzeuge total" value={loading ? '—' : totalVehicles} icon={<CarFront size={18} />} />
        <OPCMetricCard label="Aktiv auf Fahrt" value={loading ? '—' : movingCount} icon={<Gauge size={18} />} tone={movingCount > 0 ? 'success' : 'neutral'} />
        <OPCMetricCard label="Aufmerksamkeit" value={loading ? '—' : attentionCount} icon={<ShieldAlert size={18} />} tone={attentionCount > 0 ? 'warning' : 'success'} />
        <OPCMetricCard label="Tank tief" value={loading ? '—' : lowFuelCount} icon={<Fuel size={18} />} tone={lowFuelCount > 0 ? 'danger' : 'neutral'} />
      </OPCMetricsGrid>

      <OPCToolbar columns="minmax(0, 1fr) 180px 190px">
        <div style={{ position: 'relative' }}>
          <Search size={18} style={opcSearchIconStyle} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Fahrzeug, Kennzeichen, VIN, Modell oder Status suchen"
            style={opcInputWithIconStyle}
          />
        </div>

        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={opcSelectStyle}>
          <option value="all">Alle Fahrzeuge</option>
          <option value="active">Nur aktiv</option>
          <option value="driving">Aktuell unterwegs</option>
          <option value="attention">Aufmerksamkeit</option>
          <option value="low_fuel">Tank tief</option>
        </select>

        <button type="button" data-opc-wide="true" onClick={() => void loadFleet({ refresh: true })} style={opcBlackButtonStyle} disabled={refreshing}>
          <RefreshCw size={16} /> {refreshing ? 'Laden...' : 'Aktualisieren'}
        </button>
      </OPCToolbar>

      <OPCTabs
        tabs={[
          { key: 'vehicles', label: 'Fahrzeuge', active: activeTab === 'vehicles', onClick: () => setActiveTab('vehicles') },
          { key: 'logbook', label: `Fahrtenbuch · ${handoverLogs.length}`, active: activeTab === 'logbook', onClick: () => setActiveTab('logbook') },
          { key: 'maintenance', label: `Wartung · ${attentionCount}`, active: activeTab === 'maintenance', onClick: () => setActiveTab('maintenance') },
        ]}
      />

      {error && (
        <section style={{ ...opcCardStyle, padding: '14px 16px', marginBottom: '18px', color: OPC_BRAND.red, fontSize: '14px', fontWeight: 720 }}>
          {error}
        </section>
      )}

      {activeTab === 'vehicles' && (
        <section style={{ ...opcCardStyle, overflow: 'hidden' }}>
          {filteredVehicles.length === 0 ? (
            <div style={{ padding: '74px 18px', textAlign: 'center', color: OPC_BRAND.muted, fontSize: '15px', fontWeight: 720 }}>
              Keine passenden Fahrzeuge.
            </div>
          ) : (
            filteredVehicles.map((vehicle) => {
              const status = statusByVehicle.get(vehicle.id);
              const vehicleAlerts = alertsByVehicle.get(vehicle.id) || [];
              const lastTrip = lastTripByVehicle.get(vehicle.id);
              const attention = needsAttention(vehicle, status, vehicleAlerts);
              const lowFuel = Number(status?.fuel_level_percent ?? 101) <= 20;
              const statusLabel = statusLabels[String(status?.status || vehicle.status || 'unknown')] || status?.status || vehicle.status || 'Unbekannt';

              return (
                <article key={vehicle.id} style={{ padding: '18px', borderBottom: `1px solid ${OPC_BRAND.border}` }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) repeat(4, minmax(120px, 0.5fr)) 210px', gap: '16px', alignItems: 'center' }}>
                    <div>
                      <h2 style={{ margin: '0 0 6px', color: OPC_BRAND.text, fontSize: '17px', fontWeight: 860, letterSpacing: '-0.035em' }}>
                        {getVehicleLabel(vehicle)}
                      </h2>
                      <p style={{ margin: 0, color: OPC_BRAND.muted, fontSize: '12px', fontWeight: 650 }}>
                        {getVehicleMeta(vehicle)}
                      </p>
                    </div>

                    <MiniValue label="Status" value={statusLabel} tone={attention ? 'warning' : 'neutral'} />
                    <MiniValue label="Tank" value={formatNumber(status?.fuel_level_percent, '%')} tone={lowFuel ? 'danger' : 'neutral'} />
                    <MiniValue label="Kilometer" value={formatNumber(status?.odometer_km, ' km')} />
                    <MiniValue label="Letzte Fahrt" value={formatNumber(lastTrip?.distance_km, ' km')} />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <a href={`/fuhrpark/fahrzeug/${vehicle.id}`} style={{ ...opcBlackButtonStyle, height: '42px', fontSize: '13px' }}>
                        Details
                      </a>
                      <a href="/fuhrpark/karte" style={{ ...opcSecondaryButtonStyle, height: '42px', fontSize: '13px' }}>
                        Karte
                      </a>
                    </div>
                  </div>

                  {vehicleAlerts.length > 0 && (
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {vehicleAlerts.slice(0, 3).map((alert) => (
                        <span key={alert.id} style={{ padding: '6px 9px', borderRadius: '999px', border: `1px solid ${OPC_BRAND.border}`, color: OPC_BRAND.amber, fontSize: '12px', fontWeight: 760 }}>
                          {alert.title || 'Warnung'}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </section>
      )}

      {activeTab === 'logbook' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.05fr)', gap: '18px' }}>
          <section style={{ ...opcCardStyle, padding: '20px' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 860, letterSpacing: '-0.035em' }}>Fahrzeug übernehmen / melden</h2>
            <p style={{ margin: '0 0 18px', color: OPC_BRAND.muted, fontSize: '13px', fontWeight: 650, lineHeight: 1.5 }}>
              Mitarbeitende können hier Fahrzeugübernahme, Rückgabe oder Schadenmeldung für das Fahrtenbuch erfassen.
            </p>

            <div style={{ display: 'grid', gap: '12px' }}>
              <select value={handoverVehicleId} onChange={(event) => setHandoverVehicleId(event.target.value)} style={opcSelectStyle}>
                <option value="">Fahrzeug auswählen</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {getVehicleLabel(vehicle)} {vehicle.license_plate ? `· ${vehicle.license_plate}` : ''}
                  </option>
                ))}
              </select>

              <select value={handoverAction} onChange={(event) => setHandoverAction(event.target.value as any)} style={opcSelectStyle}>
                <option value="picked_up">Fahrzeug übernommen</option>
                <option value="returned">Fahrzeug zurückgegeben</option>
                <option value="issue_reported">Problem / Schaden gemeldet</option>
              </select>

              <textarea
                value={handoverNote}
                onChange={(event) => setHandoverNote(event.target.value)}
                placeholder="Optional. Beispiel: Fahrzeug sauber übernommen, Tank 75%, keine sichtbaren Schäden."
                style={{
                  minHeight: '118px',
                  padding: '14px',
                  borderRadius: '16px',
                  border: `1px solid ${OPC_BRAND.border}`,
                  outline: 'none',
                  resize: 'vertical',
                  fontSize: '14px',
                  fontWeight: 620,
                  color: OPC_BRAND.text,
                }}
              />

              <button type="button" onClick={() => void saveHandoverLog()} disabled={savingLog} style={{ ...opcBlackButtonStyle, width: '190px' }}>
                <CheckCircle2 size={16} /> {savingLog ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </section>

          <section style={{ ...opcCardStyle, overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${OPC_BRAND.border}` }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 860, letterSpacing: '-0.035em' }}>Letzte Logeinträge</h2>
            </div>
            {handoverLogs.length === 0 ? (
              <div style={{ padding: '64px 18px', textAlign: 'center', color: OPC_BRAND.muted, fontSize: '14px', fontWeight: 720 }}>
                Noch keine Fahrzeug-Logeinträge.
              </div>
            ) : (
              handoverLogs.map((log) => {
                const vehicle = vehicles.find((item) => item.id === log.vehicle_id);
                return (
                  <article key={log.id} style={{ padding: '16px 20px', borderBottom: `1px solid ${OPC_BRAND.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                      <div>
                        <strong style={{ display: 'block', fontSize: '14px', fontWeight: 860, color: OPC_BRAND.text }}>{vehicle ? getVehicleLabel(vehicle) : 'Fahrzeug'}</strong>
                        <span style={{ color: OPC_BRAND.muted, fontSize: '12px', fontWeight: 650 }}>{log.action} · {formatDate(log.occurred_at)}</span>
                      </div>
                      <span style={{ color: OPC_BRAND.muted, fontSize: '12px', fontWeight: 760 }}>{formatNumber(log.odometer_km, ' km')}</span>
                    </div>
                    {log.note && <p style={{ margin: '10px 0 0', color: OPC_BRAND.text, fontSize: '13px', fontWeight: 620, lineHeight: 1.5 }}>{log.note}</p>}
                  </article>
                );
              })
            )}
          </section>
        </div>
      )}

      {activeTab === 'maintenance' && (
        <section style={{ ...opcCardStyle, padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '18px' }}>
          <div>
            <h2 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 860, letterSpacing: '-0.035em' }}>Wartung & Diagnose</h2>
            <p style={{ margin: 0, color: OPC_BRAND.muted, fontSize: '13px', fontWeight: 650 }}>
              Fehlercodes, Wartungslisten und Reparaturempfehlungen werden in der separaten Wartungsansicht geführt.
            </p>
          </div>
          <a href="/fuhrpark/wartung" style={{ ...opcBlackButtonStyle, width: '190px' }}>
            <Wrench size={16} /> Wartung öffnen
          </a>
        </section>
      )}
    </OPCPageShell>
  );
}

function MiniValue({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'warning' | 'danger' }) {
  const color = tone === 'danger' ? OPC_BRAND.red : tone === 'warning' ? OPC_BRAND.amber : OPC_BRAND.text;
  return (
    <div>
      <div style={{ color, fontSize: '14px', fontWeight: 860, marginBottom: '4px' }}>{value}</div>
      <div style={{ color: OPC_BRAND.faint, fontSize: '11px', fontWeight: 820, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}
