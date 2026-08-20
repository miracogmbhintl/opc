import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
  const color = state === 'repair' ? OPC_BRAND.red : state === 'check' ? OPC_BRAND.amber : state === 'offline' ? OPC_BRAND.muted : OPC_BRAND.green;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '28px',
        padding: '0 11px',
        borderRadius: '999px',
        border: `1px solid ${OPC_BRAND.border}`,
        background: '#FFFFFF',
        color,
        fontSize: '12px',
        fontWeight: 820,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function CompactMetric({ value, label }: { value: number | string; label: string }) {
  return (
    <div style={{ ...opcCardStyle, padding: '18px 20px', minHeight: '82px' }}>
      <div style={{ fontSize: '26px', lineHeight: 1, fontWeight: 860, letterSpacing: '-0.055em' }}>{value}</div>
      <div style={{ marginTop: '9px', color: OPC_BRAND.muted, fontSize: '13px', fontWeight: 760 }}>{label}</div>
    </div>
  );
}

function SectionHeader({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', marginBottom: '14px', flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 860, letterSpacing: '-0.045em' }}>{title}</h2>
        {text && <p style={{ margin: '5px 0 0', color: OPC_BRAND.muted, fontSize: '13px', fontWeight: 620 }}>{text}</p>}
      </div>
      {action}
    </div>
  );
}

function WorkflowCard({ icon, title, text, action, disabled }: { icon: ReactNode; title: string; text: string; action: string; disabled?: boolean }) {
  return (
    <div style={{ ...opcCardStyle, padding: '20px', minHeight: '140px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '14px', border: `1px solid ${OPC_BRAND.border}`, background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 850, letterSpacing: '-0.035em' }}>{title}</div>
          <p style={{ margin: '6px 0 0', color: OPC_BRAND.muted, fontSize: '13px', lineHeight: 1.45, fontWeight: 620 }}>{text}</p>
        </div>
      </div>
      <button type="button" disabled={disabled} style={{ ...opcSecondaryButtonStyle, width: '100%', opacity: disabled ? 0.55 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
        {action}
      </button>
    </div>
  );
}

function EmptyState({ title, text, actions }: { title: string; text: string; actions?: ReactNode }) {
  return (
    <div style={{ ...opcCardStyle, padding: '22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '17px', fontWeight: 850, letterSpacing: '-0.035em', marginBottom: '7px' }}>{title}</div>
        <div style={{ color: OPC_BRAND.muted, fontSize: '14px', lineHeight: 1.55, fontWeight: 620 }}>{text}</div>
      </div>
      {actions && <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>{actions}</div>}
    </div>
  );
}

function InfoListCard({ title, icon, items }: { title: string; icon: ReactNode; items: Array<{ label: string; text: string }> }) {
  return (
    <div style={{ ...opcCardStyle, padding: '22px', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '18px' }}>
        <div style={{ width: '38px', height: '38px', borderRadius: '14px', border: `1px solid ${OPC_BRAND.border}`, background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <div style={{ fontSize: '16px', fontWeight: 850, letterSpacing: '-0.035em' }}>{title}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {items.map((item) => (
          <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '26px minmax(0, 1fr)', gap: '10px', alignItems: 'flex-start' }}>
            <div style={{ width: '26px', height: '26px', borderRadius: '999px', border: `1px solid ${OPC_BRAND.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: OPC_BRAND.muted, fontSize: '12px', fontWeight: 800 }}>•</div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 820, letterSpacing: '-0.02em' }}>{item.label}</div>
              <div style={{ marginTop: '2px', color: OPC_BRAND.muted, fontSize: '12px', lineHeight: 1.45, fontWeight: 620 }}>{item.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VehicleRow({ vehicle, status, latestTrip }: { vehicle: Vehicle; status?: VehicleStatus; latestTrip?: Trip }) {
  const state = normalizeStatus(vehicle, status);
  return (
    <a href={`/fuhrpark/fahrzeug/${vehicle.id}`} style={{ ...opcCardStyle, padding: '18px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) 150px 140px 140px 150px', gap: '16px', alignItems: 'center', textDecoration: 'none', color: OPC_BRAND.text }}>
      <div style={{ display: 'flex', gap: '13px', alignItems: 'center', minWidth: 0 }}>
        <div style={{ width: '42px', height: '42px', borderRadius: '15px', border: `1px solid ${OPC_BRAND.border}`, background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><CarFront size={20} /></div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '16px', fontWeight: 850, letterSpacing: '-0.035em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vehicle.display_name || 'Fahrzeug'}</div>
          <div style={{ marginTop: '4px', color: OPC_BRAND.muted, fontSize: '13px', fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {vehicle.license_plate || 'Kennzeichen offen'} · {[vehicle.make, vehicle.model, vehicle.model_year].filter(Boolean).join(' ') || vehicle.vin || 'Fahrzeugdaten offen'}
          </div>
        </div>
      </div>
      <StatusPill state={state} />
      <div style={{ fontSize: '13px', fontWeight: 720 }}><Fuel size={14} style={{ verticalAlign: '-2px', marginRight: '6px' }} />{formatFuel(status?.fuel_level_percent)}</div>
      <div style={{ fontSize: '13px', fontWeight: 720 }}><Gauge size={14} style={{ verticalAlign: '-2px', marginRight: '6px' }} />{formatKm(status?.odometer_km)}</div>
      <div style={{ color: OPC_BRAND.muted, fontSize: '12px', fontWeight: 650, textAlign: 'right' }}>{latestTrip ? `${formatKm(latestTrip.distance_km)} letzte Fahrt` : formatDate(status?.last_seen_at)}</div>
    </a>
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
  const [syncMessage, setSyncMessage] = useState('');
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

  async function syncAutoAid() {
    setSyncing(true);
    setSyncMessage('');
    setError('');

    try {
      const response = await fetch('/api/integrations/autoaid/pull', { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || 'AutoAid Synchronisation fehlgeschlagen.');
      }
      setSyncMessage(payload?.message || 'AutoAid Fahrzeuge synchronisiert.');
      await loadFleet(true);
    } catch (err: any) {
      setError(err?.message || 'AutoAid Synchronisation fehlgeschlagen.');
    } finally {
      setSyncing(false);
    }
  }

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
      const haystack = [vehicle.display_name, vehicle.license_plate, vehicle.make, vehicle.model, vehicle.vin, vehicle.home_base_label]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [query, statusByVehicle, statusFilter, vehicles]);

  const metrics = useMemo(() => {
    const driving = vehicles.filter((vehicle) => Number(statusByVehicle.get(vehicle.id)?.speed_kmh || 0) > 3).length;
    const check = vehicles.filter((vehicle) => normalizeStatus(vehicle, statusByVehicle.get(vehicle.id)) === 'check').length;
    const repair = vehicles.filter((vehicle) => normalizeStatus(vehicle, statusByVehicle.get(vehicle.id)) === 'repair').length;
    return { active: vehicles.length, driving, check, repair };
  }, [statusByVehicle, vehicles]);

  const todayTrips = trips.filter((trip) => trip.started_at && new Date(trip.started_at).toDateString() === new Date().toDateString());
  const openWorkOrders = workOrders.filter((order) => ['open', 'planned', 'in_progress', 'waiting_parts'].includes(String(order.status || '')));
  const firstVehicle = vehicles[0];

  return (
    <OPCPageShell>
      <OPCMetricsGrid>
        <OPCMetricCard label="Aktive Fahrzeuge" value={loading ? '—' : metrics.active} icon={<CarFront size={19} />} />
        <OPCMetricCard label="In Fahrt" value={loading ? '—' : metrics.driving} icon={<Gauge size={19} />} />
        <OPCMetricCard label="Prüfen" value={loading ? '—' : metrics.check} icon={<AlertTriangle size={19} />} tone="warning" />
        <OPCMetricCard label="Reparatur nötig" value={loading ? '—' : metrics.repair} icon={<Wrench size={19} />} tone="danger" />
      </OPCMetricsGrid>

      <section style={{ marginTop: '24px' }}>
        <SectionHeader title="Heute" text="Aktueller Fahrzeugbetrieb und direkte Mitarbeiterschritte." />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(360px, 0.75fr)', gap: '18px', alignItems: 'stretch' }} className="opc-fleet-today-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }} className="opc-fleet-compact-metrics">
              <CompactMetric value={metrics.driving} label="Aktuell unterwegs" />
              <CompactMetric value={todayTrips.length} label="Fahrten heute" />
              <CompactMetric value={handovers.length} label="Letzte Übergaben" />
              <CompactMetric value={openWorkOrders.length} label="Offene Wartung" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }} className="opc-fleet-workflows">
              <WorkflowCard icon={<CarFront size={18} />} title="Fahrzeug übernehmen" text="Übernahme, Kilometerstand, Tankstand und Notiz dokumentieren." action={firstVehicle ? 'Übernahme starten' : 'Noch kein Fahrzeug'} disabled={!firstVehicle} />
              <WorkflowCard icon={<ClipboardList size={18} />} title="Rückgabe erfassen" text="Zustand, Tank, Standort und Bemerkung nach Nutzung speichern." action={firstVehicle ? 'Rückgabe starten' : 'Noch kein Fahrzeug'} disabled={!firstVehicle} />
              <WorkflowCard icon={<AlertTriangle size={18} />} title="Problem melden" text="Schaden, Warnlampe, Defekt oder Versicherungsnotiz ablegen." action={firstVehicle ? 'Problem erfassen' : 'Noch kein Fahrzeug'} disabled={!firstVehicle} />
            </div>
          </div>
          <InfoListCard
            title="Ablauf"
            icon={<ClockIcon />}
            items={[
              { label: 'Fahrzeug übernehmen', text: 'Vor Fahrtbeginn Fahrzeug, Kilometerstand und Tankstand bestätigen.' },
              { label: 'Fahrt dokumentieren', text: 'AutoAid ergänzt Position, Strecke, Status und Kilometer automatisch.' },
              { label: 'Rückgabe erfassen', text: 'Nach der Nutzung Zustand, Standort und Bemerkungen hinterlegen.' },
              { label: 'Wartung prüfen', text: 'Warnungen, Fehlercodes und Reparaturempfehlungen werden gesammelt.' },
            ]}
          />
        </div>
      </section>

      <OPCToolbar columns="minmax(0, 1fr) 170px 170px 190px 160px" style={{ marginTop: '22px' } as any}>
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
        <a href="/fuhrpark/karte" style={opcSecondaryButtonStyle}><MapIcon size={16} /> Live Map</a>
        <button type="button" onClick={() => void syncAutoAid()} style={opcSecondaryButtonStyle} disabled={syncing}>{syncing ? 'Synchronisiert...' : 'AutoAid Sync'}</button>
        <button type="button" data-opc-wide="true" onClick={() => void loadFleet(true)} style={opcBlackButtonStyle} disabled={refreshing}><RefreshCw size={16} /> {refreshing ? 'Laden...' : 'Neu laden'}</button>
      </OPCToolbar>

      <OPCTabs tabs={[
        { key: 'vehicles', label: 'Fahrzeuge', active: activeTab === 'vehicles', onClick: () => setActiveTab('vehicles') },
        { key: 'logbook', label: 'Fahrtenbuch', active: activeTab === 'logbook', onClick: () => setActiveTab('logbook') },
        { key: 'maintenance', label: 'Wartung', active: activeTab === 'maintenance', onClick: () => setActiveTab('maintenance') },
        { key: 'handover', label: 'Übergaben', active: activeTab === 'handover', onClick: () => setActiveTab('handover') },
      ]} />

      {error && <div style={{ ...opcCardStyle, padding: '14px 16px', color: OPC_BRAND.red, marginBottom: '14px', fontWeight: 720 }}>{error}</div>}
      {syncMessage && <div style={{ ...opcCardStyle, padding: '14px 16px', color: OPC_BRAND.green, marginBottom: '14px', fontWeight: 720 }}>{syncMessage}</div>}

      {activeTab === 'vehicles' && (
        <section>
          <SectionHeader title="Fahrzeuge" text="Aktive Fahrzeuge, Status, Tank, Kilometerstand und letzte Nutzung." action={<button type="button" onClick={() => void syncAutoAid()} style={{ ...opcSecondaryButtonStyle, width: 'auto' }} disabled={syncing}>{syncing ? 'Synchronisiert...' : '+ AutoAid Sync'}</button>} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredVehicles.length === 0 && (
              <EmptyState
                title="Noch keine Fahrzeuge sichtbar"
                text="Starte die AutoAid-Synchronisation. Wenn AutoAid Fahrzeuge zurückliefert, werden sie hier als echte Fahrzeugkarten angezeigt."
                actions={(
                  <>
                    <button type="button" onClick={() => void syncAutoAid()} style={opcBlackButtonStyle} disabled={syncing}>{syncing ? 'Synchronisiert...' : 'AutoAid synchronisieren'}</button>
                    <a href="/einstellungen" style={opcSecondaryButtonStyle}>AutoAid Einstellungen</a>
                    <a href="/fuhrpark/karte" style={opcSecondaryButtonStyle}>Live Map öffnen</a>
                  </>
                )}
              />
            )}
            {filteredVehicles.map((vehicle) => (
              <VehicleRow key={vehicle.id} vehicle={vehicle} status={statusByVehicle.get(vehicle.id)} latestTrip={latestTripByVehicle.get(vehicle.id)} />
            ))}
          </div>
        </section>
      )}

      {activeTab === 'logbook' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {trips.length === 0 && <EmptyState title="Keine Fahrten im Verlauf" text="Der Fahrtenverlauf wird gefüllt, sobald AutoAid-Fahrten verarbeitet werden." />}
          {trips.map((trip) => {
            const vehicle = vehicles.find((entry) => entry.id === trip.vehicle_id);
            return (
              <div key={trip.id} style={{ ...opcCardStyle, padding: '18px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 130px 130px 130px', gap: '16px', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 840 }}>{vehicle?.display_name || 'Fahrzeug'}</div>
                  <div style={{ marginTop: '5px', color: OPC_BRAND.muted, fontSize: '13px', fontWeight: 620 }}>{trip.start_address || 'Start offen'} → {trip.end_address || 'Ziel offen'}</div>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 720 }}>{formatDate(trip.started_at)}</div>
                <div style={{ fontSize: '13px', fontWeight: 720 }}>{formatKm(trip.distance_km)}</div>
                <div style={{ textAlign: 'right', color: OPC_BRAND.muted, fontSize: '12px', fontWeight: 700 }}>{trip.classification || 'unmatched'}</div>
              </div>
            );
          })}
        </section>
      )}

      {activeTab === 'maintenance' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {workOrders.length === 0 && <EmptyState title="Keine offenen Wartungen" text="Offene Arbeiten, Fehler und Reparaturempfehlungen erscheinen hier." actions={<a href="/fuhrpark/wartung" style={opcSecondaryButtonStyle}>Wartung öffnen</a>} />}
          {workOrders.map((order) => {
            const vehicle = vehicles.find((entry) => entry.id === order.vehicle_id);
            return (
              <div key={order.id} style={{ ...opcCardStyle, padding: '18px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px 120px 150px', gap: '16px', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 840 }}>{order.title || 'Wartungsarbeit'}</div>
                  <div style={{ marginTop: '5px', color: OPC_BRAND.muted, fontSize: '13px', fontWeight: 620 }}>{vehicle?.display_name || 'Fahrzeug'} · {vehicle?.license_plate || 'Kennzeichen offen'}</div>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 720 }}>{order.priority || 'warning'}</div>
                <div style={{ fontSize: '13px', fontWeight: 720 }}>{order.status || 'open'}</div>
                <a href="/fuhrpark/wartung" style={{ ...opcSecondaryButtonStyle, height: '42px' }}>Öffnen</a>
              </div>
            );
          })}
        </section>
      )}

      {activeTab === 'handover' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {handovers.length === 0 && <EmptyState title="Keine Übergaben erfasst" text="Mitarbeitende können Fahrzeugübernahmen, Rückgaben und Probleme hier dokumentieren." />}
          {handovers.map((log) => {
            const vehicle = vehicles.find((entry) => entry.id === log.vehicle_id);
            return (
              <div key={log.id} style={{ ...opcCardStyle, padding: '18px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 140px 120px 120px', gap: '16px', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 840 }}>{vehicle?.display_name || 'Fahrzeug'} · {actionLabel(log.action)}</div>
                  <div style={{ marginTop: '5px', color: OPC_BRAND.muted, fontSize: '13px', fontWeight: 620 }}>{log.note || log.location_text || 'Keine Notiz'}</div>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 720 }}>{formatDate(log.occurred_at)}</div>
                <div style={{ fontSize: '13px', fontWeight: 720 }}>{formatFuel(log.fuel_level_percent)}</div>
                <div style={{ fontSize: '13px', fontWeight: 720, textAlign: 'right' }}><ClipboardList size={14} style={{ verticalAlign: '-2px', marginRight: '6px' }} />Log</div>
              </div>
            );
          })}
        </section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '24px' }} className="opc-fleet-bottom-grid">
        <div>
          <SectionHeader title="Letzte Fahrten" />
          {trips.length === 0 ? <EmptyState title="Keine Fahrten im Verlauf" text="Der Fahrtenverlauf wird gefüllt, sobald AutoAid-Fahrten verarbeitet werden." /> : null}
        </div>
        <div>
          <SectionHeader title="Letzte Meldungen" />
          {handovers.length === 0 ? <EmptyState title="Keine Meldungen" text="Übergaben, Rückgaben und Problemberichte werden hier als Verlauf angezeigt." /> : null}
        </div>
      </div>

      <style>{opcResponsiveStyle}</style>
      <style>{`
        @media (max-width: 1180px) {
          .opc-fleet-today-grid,
          .opc-fleet-bottom-grid {
            grid-template-columns: 1fr !important;
          }
          .opc-fleet-compact-metrics,
          .opc-fleet-workflows {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 760px) {
          .opc-fleet-compact-metrics,
          .opc-fleet-workflows {
            grid-template-columns: 1fr !important;
          }
          a[href^="/fuhrpark/fahrzeug/"] {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
        }
      `}</style>
    </OPCPageShell>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
