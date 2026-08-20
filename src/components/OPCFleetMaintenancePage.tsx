import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CarFront, CheckCircle2, RefreshCw, Search, ShieldAlert, Wrench } from 'lucide-react';
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

type TabKey = 'due' | 'orders' | 'dtc' | 'healthy';

type Vehicle = {
  id: string;
  display_name: string;
  license_plate?: string | null;
  make?: string | null;
  model?: string | null;
  status?: string | null;
};

type WorkOrder = {
  id: string;
  vehicle_id?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  priority?: string | null;
  status?: string | null;
  scheduled_for?: string | null;
  estimated_cost?: number | null;
  service_provider?: string | null;
};

type ComponentHealth = {
  id: string;
  vehicle_id?: string | null;
  component_type?: string | null;
  component_position?: string | null;
  condition_status?: string | null;
  condition_percent?: number | null;
  measurement_value?: number | null;
  measurement_unit?: string | null;
  next_inspection_at?: string | null;
  notes?: string | null;
};

type Dtc = {
  id: string;
  vehicle_id?: string | null;
  code?: string | null;
  description?: string | null;
  severity?: string | null;
  status?: string | null;
  last_seen_at?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function statusTone(status?: string | null) {
  const raw = String(status || '').toLowerCase();
  if (raw.includes('critical') || raw.includes('service_due')) return 'critical';
  if (raw.includes('monitor') || raw.includes('warning') || raw.includes('open')) return 'warning';
  if (raw.includes('ok') || raw.includes('completed')) return 'ok';
  return 'neutral';
}

function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'warning' | 'critical' | 'ok' }) {
  const color = tone === 'critical' ? OPC_BRAND.red : tone === 'warning' ? OPC_BRAND.amber : tone === 'ok' ? OPC_BRAND.green : OPC_BRAND.muted;
  return <span style={{ display: 'inline-flex', height: '26px', padding: '0 10px', borderRadius: '999px', border: `1px solid ${OPC_BRAND.border}`, color, background: '#FFFFFF', fontSize: '12px', fontWeight: 820, alignItems: 'center' }}>{children}</span>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ ...opcCardStyle, padding: '28px', textAlign: 'center' }}>
      <div style={{ fontSize: '16px', fontWeight: 850, letterSpacing: '-0.03em', marginBottom: '8px' }}>{title}</div>
      <div style={{ color: OPC_BRAND.muted, fontSize: '14px', lineHeight: 1.55 }}>{text}</div>
    </div>
  );
}

export default function OPCFleetMaintenancePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('due');
  const [query, setQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [components, setComponents] = useState<ComponentHealth[]>([]);
  const [dtcs, setDtcs] = useState<Dtc[]>([]);

  const loadMaintenance = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const vehiclesResult = await supabase.from('opc_fleet_vehicles').select('id, display_name, license_plate, make, model, status').order('display_name', { ascending: true });
      if (vehiclesResult.error) throw vehiclesResult.error;
      setVehicles((vehiclesResult.data || []) as Vehicle[]);

      const [ordersResult, componentsResult, dtcResult] = await Promise.all([
        supabase.from('opc_maintenance_work_orders').select('id, vehicle_id, title, description, category, priority, status, scheduled_for, estimated_cost, service_provider').order('created_at', { ascending: false }).limit(100),
        supabase.from('opc_vehicle_component_health').select('id, vehicle_id, component_type, component_position, condition_status, condition_percent, measurement_value, measurement_unit, next_inspection_at, notes').order('measured_at', { ascending: false }).limit(100),
        supabase.from('opc_vehicle_dtc_codes').select('id, vehicle_id, code, description, severity, status, last_seen_at').order('last_seen_at', { ascending: false }).limit(100),
      ]);

      if (!ordersResult.error) setOrders((ordersResult.data || []) as WorkOrder[]);
      if (!componentsResult.error) setComponents((componentsResult.data || []) as ComponentHealth[]);
      if (!dtcResult.error) setDtcs((dtcResult.data || []) as Dtc[]);
    } catch (err: any) {
      setError(err?.message || 'Wartungsdaten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadMaintenance();
  }, [loadMaintenance]);

  const vehicleById = useMemo(() => {
    const map = new Map<string, Vehicle>();
    vehicles.forEach((vehicle) => map.set(vehicle.id, vehicle));
    return map;
  }, [vehicles]);

  const dueComponents = useMemo(() => components.filter((item) => ['monitor', 'service_due', 'critical'].includes(String(item.condition_status || '').toLowerCase())), [components]);
  const openOrders = useMemo(() => orders.filter((order) => !['completed', 'cancelled'].includes(String(order.status || '').toLowerCase())), [orders]);
  const activeDtcs = useMemo(() => dtcs.filter((dtc) => String(dtc.status || 'active').toLowerCase() === 'active'), [dtcs]);
  const healthyVehicles = useMemo(() => vehicles.filter((vehicle) => {
    const hasDue = dueComponents.some((entry) => entry.vehicle_id === vehicle.id);
    const hasDtc = activeDtcs.some((entry) => entry.vehicle_id === vehicle.id);
    const hasOrder = openOrders.some((entry) => entry.vehicle_id === vehicle.id);
    return !hasDue && !hasDtc && !hasOrder;
  }), [activeDtcs, dueComponents, openOrders, vehicles]);

  const matchesQuery = (vehicleId?: string | null, text = '') => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    const vehicle = vehicleId ? vehicleById.get(vehicleId) : undefined;
    return [vehicle?.display_name, vehicle?.license_plate, vehicle?.make, vehicle?.model, text].filter(Boolean).join(' ').toLowerCase().includes(needle);
  };

  const filteredDue = dueComponents.filter((entry) => matchesQuery(entry.vehicle_id, `${entry.component_type} ${entry.notes}`) && (priorityFilter === 'all' || String(entry.condition_status) === priorityFilter));
  const filteredOrders = openOrders.filter((entry) => matchesQuery(entry.vehicle_id, `${entry.title} ${entry.description}`) && (priorityFilter === 'all' || String(entry.priority) === priorityFilter));
  const filteredDtcs = activeDtcs.filter((entry) => matchesQuery(entry.vehicle_id, `${entry.code} ${entry.description}`) && (priorityFilter === 'all' || String(entry.severity) === priorityFilter));

  return (
    <OPCPageShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '22px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 860, letterSpacing: '-0.055em' }}>Wartung</h1>
          <p style={{ margin: '7px 0 0', color: OPC_BRAND.muted, fontSize: '14px', fontWeight: 620 }}>Fällige Arbeiten, Fehlercodes und Reparaturempfehlungen.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <a href="/fuhrpark" style={{ ...opcSecondaryButtonStyle, width: 'auto' }}><CarFront size={16} /> Fahrzeuge</a>
          <button type="button" onClick={() => void loadMaintenance(true)} disabled={refreshing} style={{ ...opcBlackButtonStyle, width: 'auto' }}><RefreshCw size={16} /> {refreshing ? 'Laden...' : 'Aktualisieren'}</button>
        </div>
      </div>

      <OPCMetricsGrid>
        <OPCMetricCard label="Fahrzeuge fällig" value={loading ? '—' : dueComponents.length} icon={<Wrench size={19} />} tone="warning" />
        <OPCMetricCard label="Offene Arbeiten" value={loading ? '—' : openOrders.length} icon={<AlertTriangle size={19} />} />
        <OPCMetricCard label="Aktive Fehler" value={loading ? '—' : activeDtcs.length} icon={<ShieldAlert size={19} />} tone="danger" />
        <OPCMetricCard label="Ohne Aufmerksamkeit" value={loading ? '—' : healthyVehicles.length} icon={<CheckCircle2 size={19} />} tone="success" />
      </OPCMetricsGrid>

      <OPCToolbar columns="minmax(0, 1fr) 180px 160px">
        <div style={{ position: 'relative' }}>
          <Search size={17} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: OPC_BRAND.faint }} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Fahrzeug, Kennzeichen, Fehler oder Empfehlung suchen" style={opcInputWithIconStyle} />
        </div>
        <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} style={opcSelectStyle}>
          <option value="all">Alle Prioritäten</option>
          <option value="critical">Kritisch</option>
          <option value="warning">Warnung</option>
          <option value="attention">Aufmerksamkeit</option>
          <option value="service_due">Service fällig</option>
          <option value="monitor">Beobachten</option>
        </select>
        <button type="button" onClick={() => void loadMaintenance(true)} style={opcBlackButtonStyle}><RefreshCw size={16} /> Neu laden</button>
      </OPCToolbar>

      <OPCTabs tabs={[
        { key: 'due', label: `Fällige Wartung · ${dueComponents.length}`, active: activeTab === 'due', onClick: () => setActiveTab('due') },
        { key: 'orders', label: `Wartungsliste · ${openOrders.length}`, active: activeTab === 'orders', onClick: () => setActiveTab('orders') },
        { key: 'dtc', label: `Aktive Fehler · ${activeDtcs.length}`, active: activeTab === 'dtc', onClick: () => setActiveTab('dtc') },
        { key: 'healthy', label: `Okay · ${healthyVehicles.length}`, active: activeTab === 'healthy', onClick: () => setActiveTab('healthy') },
      ]} />

      {error && <div style={{ ...opcCardStyle, padding: '14px 16px', color: OPC_BRAND.red, marginBottom: '16px', fontWeight: 720 }}>{error}</div>}

      <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {activeTab === 'due' && filteredDue.length === 0 && <EmptyState title="Keine passenden Wartungsdaten" text="Komponentenzustände von AutoAid oder manuelle Prüfungen erscheinen hier." />}
        {activeTab === 'due' && filteredDue.map((item) => {
          const vehicle = item.vehicle_id ? vehicleById.get(item.vehicle_id) : undefined;
          const tone = statusTone(item.condition_status);
          return (
            <div key={item.id} style={{ ...opcCardStyle, padding: '18px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 140px 130px 150px', gap: '16px', alignItems: 'center' }} className="opc-maintenance-row">
              <div>
                <div style={{ fontSize: '15px', fontWeight: 850 }}>{vehicle?.display_name || 'Fahrzeug'} · {item.component_type || 'Komponente'}</div>
                <div style={{ marginTop: '5px', color: OPC_BRAND.muted, fontSize: '13px', lineHeight: 1.45 }}>{vehicle?.license_plate || 'Kennzeichen offen'} · {item.notes || 'Prüfung empfohlen'}</div>
              </div>
              <Pill tone={tone === 'critical' ? 'critical' : tone === 'warning' ? 'warning' : 'neutral'}>{item.condition_status || 'unknown'}</Pill>
              <div style={{ fontSize: '13px', fontWeight: 720 }}>{item.condition_percent ? `${Math.round(Number(item.condition_percent))}%` : item.measurement_value ? `${item.measurement_value} ${item.measurement_unit || ''}` : '—'}</div>
              <a href={vehicle ? `/fuhrpark/fahrzeug/${vehicle.id}` : '/fuhrpark'} style={{ ...opcSecondaryButtonStyle, height: '42px' }}>Details öffnen</a>
            </div>
          );
        })}

        {activeTab === 'orders' && filteredOrders.length === 0 && <EmptyState title="Keine offenen Arbeiten" text="Geplante Reparaturen, Services und Diagnosen erscheinen hier." />}
        {activeTab === 'orders' && filteredOrders.map((order) => {
          const vehicle = order.vehicle_id ? vehicleById.get(order.vehicle_id) : undefined;
          return (
            <div key={order.id} style={{ ...opcCardStyle, padding: '18px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 140px 130px 150px', gap: '16px', alignItems: 'center' }} className="opc-maintenance-row">
              <div>
                <div style={{ fontSize: '15px', fontWeight: 850 }}>{order.title || 'Wartungsarbeit'}</div>
                <div style={{ marginTop: '5px', color: OPC_BRAND.muted, fontSize: '13px', lineHeight: 1.45 }}>{vehicle?.display_name || 'Fahrzeug'} · {vehicle?.license_plate || 'Kennzeichen offen'} · {order.description || 'Keine Beschreibung'}</div>
              </div>
              <Pill tone={statusTone(order.priority) === 'critical' ? 'critical' : 'warning'}>{order.priority || 'warning'}</Pill>
              <div style={{ fontSize: '13px', fontWeight: 720 }}>{order.status || 'open'}</div>
              <a href={vehicle ? `/fuhrpark/fahrzeug/${vehicle.id}` : '/fuhrpark'} style={{ ...opcSecondaryButtonStyle, height: '42px' }}>Details öffnen</a>
            </div>
          );
        })}

        {activeTab === 'dtc' && filteredDtcs.length === 0 && <EmptyState title="Keine aktiven Fehlercodes" text="AutoAid-DTCs erscheinen hier, sobald der Pull-Worker Daten schreibt." />}
        {activeTab === 'dtc' && filteredDtcs.map((dtc) => {
          const vehicle = dtc.vehicle_id ? vehicleById.get(dtc.vehicle_id) : undefined;
          return (
            <div key={dtc.id} style={{ ...opcCardStyle, padding: '18px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 140px 130px 150px', gap: '16px', alignItems: 'center' }} className="opc-maintenance-row">
              <div>
                <div style={{ fontSize: '15px', fontWeight: 850 }}>{dtc.code || 'Fehlercode'} · {vehicle?.display_name || 'Fahrzeug'}</div>
                <div style={{ marginTop: '5px', color: OPC_BRAND.muted, fontSize: '13px', lineHeight: 1.45 }}>{dtc.description || 'Keine Beschreibung'} · zuletzt {formatDate(dtc.last_seen_at)}</div>
              </div>
              <Pill tone={statusTone(dtc.severity) === 'critical' ? 'critical' : 'warning'}>{dtc.severity || 'unknown'}</Pill>
              <div style={{ fontSize: '13px', fontWeight: 720 }}>{dtc.status || 'active'}</div>
              <a href={vehicle ? `/fuhrpark/fahrzeug/${vehicle.id}` : '/fuhrpark'} style={{ ...opcSecondaryButtonStyle, height: '42px' }}>Details öffnen</a>
            </div>
          );
        })}

        {activeTab === 'healthy' && healthyVehicles.length === 0 && <EmptyState title="Keine Fahrzeuge ohne Aufmerksamkeit" text="Sobald Fahrzeuge ohne Warnungen vorhanden sind, werden sie hier angezeigt." />}
        {activeTab === 'healthy' && healthyVehicles.map((vehicle) => (
          <div key={vehicle.id} style={{ ...opcCardStyle, padding: '18px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 140px 150px', gap: '16px', alignItems: 'center' }} className="opc-maintenance-row">
            <div>
              <div style={{ fontSize: '15px', fontWeight: 850 }}>{vehicle.display_name}</div>
              <div style={{ marginTop: '5px', color: OPC_BRAND.muted, fontSize: '13px' }}>{vehicle.license_plate || 'Kennzeichen offen'} · {[vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Fahrzeugdaten offen'}</div>
            </div>
            <Pill tone="ok">Okay</Pill>
            <a href={`/fuhrpark/fahrzeug/${vehicle.id}`} style={{ ...opcSecondaryButtonStyle, height: '42px' }}>Details öffnen</a>
          </div>
        ))}
      </section>

      <style>{opcResponsiveStyle}</style>
      <style>{`
        @media (max-width: 980px) {
          .opc-maintenance-row {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
        }
      `}</style>
    </OPCPageShell>
  );
}
