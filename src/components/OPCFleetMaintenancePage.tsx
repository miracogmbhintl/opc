import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  AlertTriangle,
  BatteryCharging,
  CalendarClock,
  CarFront,
  CheckCircle2,
  Gauge,
  Plus,
  Search,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  OPC_BRAND,
  OPCMetricCard,
  OPCPageShell,
  opcBlackButtonStyle,
  opcInputWithIconStyle,
  opcResponsiveStyle,
  OPC_PAGE_FONT,
} from './opc/OPCPageTop';

type Tab = 'due' | 'orders' | 'faults';
type AnyRow = Record<string, any>;

type VehicleMaintenance = {
  vehicle: AnyRow;
  state: AnyRow | null;
  faults: AnyRow[];
  health: AnyRow[];
  orders: AnyRow[];
  suggestion: string;
  urgency: 'critical' | 'warning' | 'attention' | 'ok';
  dueLabel: string;
};

export default function OPCFleetMaintenancePage() {
  const [tab, setTab] = useState<Tab>('due');
  const [items, setItems] = useState<VehicleMaintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError('');

    try {
      const vehicleResult = await supabase
        .from('opc_fleet_vehicles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (vehicleResult.error) throw vehicleResult.error;

      const vehicles = (vehicleResult.data || []).filter((vehicle: AnyRow) => !['sold', 'archived'].includes(String(vehicle.status)));
      const [states, faults, health, orders] = await Promise.all([
        safeRows('opc_vehicle_status_current'),
        safeRows('opc_vehicle_dtc_codes'),
        safeRows('opc_vehicle_component_health'),
        safeRows('opc_maintenance_work_orders'),
      ]);

      const stateByVehicle = new Map(states.map((row) => [String(row.vehicle_id), row]));
      const faultByVehicle = groupBy(faults.filter((row) => !['cleared', 'ignored'].includes(String(row.status))), 'vehicle_id');
      const healthByVehicle = groupBy(health, 'vehicle_id');
      const orderByVehicle = groupBy(orders, 'vehicle_id');

      setItems(vehicles.map((vehicle: AnyRow) => {
        const vehicleFaults = faultByVehicle.get(String(vehicle.id)) || [];
        const vehicleHealth = healthByVehicle.get(String(vehicle.id)) || [];
        const vehicleOrders = orderByVehicle.get(String(vehicle.id)) || [];
        const recommendation = maintenanceSuggestion(vehicle, stateByVehicle.get(String(vehicle.id)) || null, vehicleFaults, vehicleHealth, vehicleOrders);
        return {
          vehicle,
          state: stateByVehicle.get(String(vehicle.id)) || null,
          faults: vehicleFaults,
          health: vehicleHealth,
          orders: vehicleOrders,
          ...recommendation,
        };
      }));
    } catch (loadError: any) {
      setError(loadError?.message || 'Fuhrpark-Wartungsdaten konnten nicht geladen werden.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => items.filter((item) => {
    const haystack = `${vehicleLabel(item.vehicle)} ${item.vehicle.license_plate} ${item.vehicle.vin} ${item.vehicle.make} ${item.vehicle.model} ${item.suggestion}`.toLowerCase();
    if (!haystack.includes(query.toLowerCase())) return false;
    if (tab === 'faults') return item.faults.length > 0;
    if (tab === 'orders') return item.orders.length > 0;
    return item.urgency !== 'ok' || item.orders.some((order) => !['completed', 'cancelled'].includes(String(order.status)));
  }), [items, query, tab]);

  const openOrders = items.flatMap((item) => item.orders).filter((order) => !['completed', 'cancelled'].includes(String(order.status))).length;
  const criticalFaults = items.flatMap((item) => item.faults).filter((fault) => String(fault.severity) === 'critical').length;
  const vehiclesDue = items.filter((item) => item.urgency !== 'ok').length;
  const healthyVehicles = items.filter((item) => item.urgency === 'ok').length;

  return (
    <OPCPageShell>
      <div style={pageHeaderStyle}>
        <div>
          <div style={eyebrowStyle}>ORANGE BROOKLYN FUHRPARK</div>
          <h1 style={pageTitleStyle}>Wartung & Diagnose</h1>
          <p style={pageSubtitleStyle}>AutoAid Fehlercodes, Fahrzeugzustand, Wartungslisten und Reparaturempfehlungen im OPC-Portal.</p>
        </div>
        <a href="/fuhrpark" style={{ ...opcBlackButtonStyle, width: 'auto', minWidth: '180px' }}><CarFront size={17} />Live Map</a>
      </div>

      <div className="opc-requests-metrics" style={metricsStyle}>
        <OPCMetricCard label="Fahrzeuge fällig" value={vehiclesDue} icon={<CalendarClock size={18} />} tone={vehiclesDue ? 'warning' : 'success'} />
        <OPCMetricCard label="Offene Arbeiten" value={openOrders} icon={<Wrench size={18} />} tone={openOrders ? 'warning' : 'neutral'} />
        <OPCMetricCard label="Kritische Fehler" value={criticalFaults} icon={<ShieldAlert size={18} />} tone={criticalFaults ? 'danger' : 'success'} />
        <OPCMetricCard label="Ohne Aufmerksamkeit" value={healthyVehicles} icon={<CheckCircle2 size={18} />} tone="success" />
      </div>

      <div className="opc-fleet-maintenance-tabs" style={tabsStyle}>
        <button type="button" onClick={() => setTab('due')} style={{ ...tabStyle, ...(tab === 'due' ? tabActiveStyle : {}) }}>Fällige Wartung · {vehiclesDue}</button>
        <button type="button" onClick={() => setTab('orders')} style={{ ...tabStyle, ...(tab === 'orders' ? tabActiveStyle : {}) }}>Wartungsliste · {openOrders}</button>
        <button type="button" onClick={() => setTab('faults')} style={{ ...tabStyle, ...(tab === 'faults' ? tabActiveStyle : {}) }}>Aktive Fehler · {items.flatMap((item) => item.faults).length}</button>
      </div>

      <section className="opc-fleet-maintenance-toolbar" style={toolbarStyle}>
        <div style={{ position: 'relative', minWidth: 0, flex: 1 }}>
          <Search size={18} style={searchIconStyle} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Fahrzeug, Kennzeichen, Fehler oder Empfehlung suchen" style={opcInputWithIconStyle} />
        </div>
        <button type="button" onClick={() => void load()} style={{ ...opcBlackButtonStyle, width: 'auto', minWidth: '190px' }}><Plus size={17} />Neu laden</button>
      </section>

      {error ? <div style={errorStyle}>{error}</div> : null}
      {loading ? <div style={emptyStyle}>Wartungsübersicht wird geladen…</div> : null}
      {!loading && !filtered.length ? <div style={emptyStyle}><CheckCircle2 size={22} /><span>Keine passenden Wartungsdaten.</span></div> : null}

      <div style={listStyle}>
        {filtered.map((item) => <MaintenanceVehicleCard key={item.vehicle.id} item={item} tab={tab} />)}
      </div>

      <style>{`
        ${opcResponsiveStyle}
        @media(max-width:1000px){
          .opc-fleet-maintenance-vehicle-main{align-items:flex-start!important;flex-wrap:wrap!important}
          .opc-fleet-maintenance-stats{width:100%!important}
        }
        @media(max-width:680px){
          .opc-fleet-maintenance-tabs,.opc-fleet-maintenance-stats{grid-template-columns:1fr!important}
          .opc-fleet-maintenance-due{grid-template-columns:1fr!important}
          .opc-fleet-maintenance-toolbar{flex-direction:column!important;align-items:stretch!important}
          .opc-fleet-maintenance-toolbar button{width:100%!important}
        }
      `}</style>
    </OPCPageShell>
  );
}

function MaintenanceVehicleCard({ item, tab }: { item: VehicleMaintenance; tab: Tab }) {
  const imageUrl = item.vehicle.metadata?.image_url || '';
  const activeOrders = item.orders.filter((order) => !['completed', 'cancelled'].includes(String(order.status)));

  return (
    <section style={vehicleCardStyle}>
      <div className="opc-fleet-maintenance-vehicle-main" style={vehicleMainStyle}>
        <div style={imageStyle}>{imageUrl ? <img src={imageUrl} alt={vehicleLabel(item.vehicle)} style={imageImgStyle} /> : <CarFront size={34} />}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={vehicleTitleRowStyle}>
            <span style={vehicleTitleStyle}>{vehicleLabel(item.vehicle)}</span>
            <StatusPill urgency={item.urgency}>{item.dueLabel}</StatusPill>
          </div>
          <div style={vehicleMetaStyle}>{item.vehicle.license_plate || item.vehicle.vin || 'Kein Kennzeichen'} · {[item.vehicle.make, item.vehicle.model].filter(Boolean).join(' ') || 'Modell nicht erfasst'}</div>
          <div style={suggestionStyle}><Wrench size={16} /><span><strong>Empfohlene Aktion:</strong> {item.suggestion}</span></div>
        </div>
        <div className="opc-fleet-maintenance-stats" style={vehicleStatsStyle}>
          <MiniStat icon={<Gauge size={17} />} label="Kilometer" value={item.state?.odometer_km ? `${Math.round(Number(item.state.odometer_km)).toLocaleString('de-CH')} km` : '—'} />
          <MiniStat icon={<BatteryCharging size={17} />} label="Tank / Reichweite" value={item.state?.fuel_level_percent != null ? `${Math.round(Number(item.state.fuel_level_percent))}%` : item.state?.range_km ? `${Math.round(Number(item.state.range_km))} km` : '—'} />
          <MiniStat icon={<AlertTriangle size={17} />} label="Fehler" value={item.faults.length} />
        </div>
      </div>

      <div style={recordsStyle}>
        {tab === 'faults' ? item.faults.slice(0, 5).map((fault) => (
          <div key={fault.id} style={recordStyle}>
            <span><strong>{fault.code || fault.ecu_type || 'Fahrzeugfehler'}</strong><small>{fault.description || 'Keine Diagnosebeschreibung'} · zuletzt {formatDate(fault.last_seen_at, true)}</small></span>
            <StatusPill urgency={fault.severity === 'critical' ? 'critical' : 'warning'}>{titleCase(fault.severity)}</StatusPill>
          </div>
        )) : null}

        {tab === 'orders' ? activeOrders.slice(0, 5).map((order) => (
          <div key={order.id} style={recordStyle}>
            <span><strong>{order.work_order_number || order.title}</strong><small>{order.title} · {order.scheduled_for ? `Geplant ${formatDate(order.scheduled_for, true)}` : 'Nicht geplant'}</small></span>
            <StatusPill urgency={order.priority === 'critical' ? 'critical' : 'attention'}>{titleCase(order.status)}</StatusPill>
          </div>
        )) : null}

        {tab === 'due' ? (
          <div className="opc-fleet-maintenance-due" style={dueDetailStyle}>
            <div><span style={detailLabelStyle}>Komponenten-Signale</span><strong>{item.health.filter((row) => ['service_due', 'critical', 'monitor'].includes(String(row.condition_status))).length}</strong></div>
            <div><span style={detailLabelStyle}>Offene Arbeiten</span><strong>{activeOrders.length}</strong></div>
            <div><span style={detailLabelStyle}>Letzte Telemetrie</span><strong>{formatDate(item.state?.last_seen_at || item.state?.updated_at, true)}</strong></div>
            <div><span style={detailLabelStyle}>Status</span><strong>{titleCase(item.state?.status || item.vehicle.status || 'unknown')}</strong></div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function StatusPill({ urgency, children }: { urgency: string; children: ReactNode }) {
  const palette = urgency === 'critical' ? ['#FEF2F2','#991B1B','#FCA5A5'] : urgency === 'warning' ? ['#FFFBEB','#92400E','#FDE68A'] : urgency === 'attention' ? ['#EFF6FF','#1D4ED8','#BFDBFE'] : ['#F0FDF4','#166534','#BBF7D0'];
  return <span style={{ ...pillStyle, background: palette[0], color: palette[1], borderColor: palette[2] }}>{children}</span>;
}

function MiniStat({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return <div style={miniStatStyle}><span style={miniIconStyle}>{icon}</span><span><small>{label}</small><strong>{value}</strong></span></div>;
}

function groupBy(rows: AnyRow[], key: string) {
  const map = new Map<string, AnyRow[]>();
  rows.forEach((row) => {
    const id = String(row[key] || '');
    if (!id) return;
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push(row);
  });
  return map;
}

function maintenanceSuggestion(vehicle: AnyRow, state: AnyRow | null, faults: AnyRow[], health: AnyRow[], orders: AnyRow[]) {
  const critical = faults.find((fault) => String(fault.severity) === 'critical') || health.find((row) => String(row.condition_status) === 'critical');
  if (critical) return { suggestion: critical.description || critical.notes || `Sofortige Prüfung: ${titleCase(critical.ecu_type || critical.component_type || 'Fahrzeug')}`, urgency: 'critical' as const, dueLabel: 'Sofort prüfen' };

  if (Number(state?.dtc_active_count || 0) > 0 || faults.length > 0) return { suggestion: 'AutoAid Fehlercodes prüfen, Diagnose auslesen und Reparaturbedarf beurteilen', urgency: 'warning' as const, dueLabel: 'Fehlercodes aktiv' };

  const tire = health.find((row) => String(row.component_type).toLowerCase().includes('reifen') || String(row.component_type).toLowerCase().includes('tire'));
  if (tire && ['monitor','service_due'].includes(String(tire.condition_status))) return { suggestion: Number(tire.condition_percent) <= 25 ? 'Betroffene Reifen ersetzen und Spur prüfen' : 'Reifendruck, Profiltiefe und Zustand prüfen', urgency: 'warning' as const, dueLabel: 'Reifen prüfen' };

  const brake = faults.find((fault) => String(fault.ecu_type || fault.description).toLowerCase().includes('brake')) || health.find((row) => String(row.component_type).toLowerCase().includes('brake') && ['monitor','service_due'].includes(String(row.condition_status)));
  if (brake) return { suggestion: 'Bremsen, Beläge, Scheiben, Flüssigkeit und Fehlercodes vor dem nächsten Einsatz prüfen', urgency: 'warning' as const, dueLabel: 'Bremsprüfung' };

  if (state?.oil_level_percent != null && Number(state.oil_level_percent) <= 20) return { suggestion: 'Ölstand prüfen, nachfüllen und mögliche Leckage kontrollieren', urgency: 'warning' as const, dueLabel: 'Ölstand tief' };
  if (state?.fuel_level_percent != null && Number(state.fuel_level_percent) <= 15) return { suggestion: 'Fahrzeug vor dem nächsten Einsatz tanken oder Reichweite prüfen', urgency: 'attention' as const, dueLabel: 'Tank tief' };

  const activeOrder = orders.find((order) => !['completed','cancelled'].includes(String(order.status)));
  if (activeOrder) return { suggestion: activeOrder.title || 'Offene Wartungsarbeit abschliessen', urgency: 'attention' as const, dueLabel: titleCase(activeOrder.status) };

  if (vehicle.status === 'maintenance' || state?.status === 'maintenance') return { suggestion: 'Manuelle Fuhrparkprüfung durchführen und Wartung dokumentieren', urgency: 'warning' as const, dueLabel: 'Wartung' };

  return { suggestion: 'Keine aktuelle Wartungsaktion empfohlen', urgency: 'ok' as const, dueLabel: 'Keine Aktion' };
}

function vehicleLabel(vehicle: AnyRow) {
  return vehicle.display_name || vehicle.license_plate || vehicle.vin || vehicle.autoaid_vehicle_id || 'OPC Fahrzeug';
}

function formatDate(value: any, time = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('de-CH', time ? { day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit' } : { day:'2-digit',month:'short',year:'numeric' }).format(date);
}

function titleCase(value: any) {
  return String(value || 'Unbekannt').replace(/_/g,' ').replace(/\b\w/g,(char) => char.toUpperCase());
}

async function safeRows(table: string): Promise<AnyRow[]> {
  try {
    const result = await supabase.from(table).select('*').limit(2000);
    return result.error ? [] : result.data || [];
  } catch {
    return [];
  }
}

const pageHeaderStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '20px', marginBottom: '22px', flexWrap: 'wrap' };
const eyebrowStyle: CSSProperties = { fontSize: '12px', letterSpacing: '.16em', fontWeight: 820, color: OPC_BRAND.muted, marginBottom: '10px' };
const pageTitleStyle: CSSProperties = { margin: 0, fontSize: '34px', lineHeight: 1, letterSpacing: '-.045em', fontWeight: 860, color: OPC_BRAND.text };
const pageSubtitleStyle: CSSProperties = { margin: '12px 0 0', fontSize: '15px', color: OPC_BRAND.muted, fontWeight: 600 };
const metricsStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '16px', marginBottom: '22px' };
const tabsStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '10px', marginBottom: '22px' };
const tabStyle: CSSProperties = { height: '48px', borderRadius: '15px', border: `1px solid ${OPC_BRAND.border}`, background: '#FFF', color: OPC_BRAND.text, fontSize: '14px', fontWeight: 760, cursor: 'pointer', fontFamily: OPC_PAGE_FONT };
const tabActiveStyle: CSSProperties = { background: OPC_BRAND.black, color: '#FFF', borderColor: OPC_BRAND.black };
const toolbarStyle: CSSProperties = { padding: '18px', border: `1px solid ${OPC_BRAND.border}`, borderRadius: '20px', background: '#FFF', marginBottom: '22px', display: 'flex', alignItems: 'center', gap: '12px' };
const searchIconStyle: CSSProperties = { position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: OPC_BRAND.faint };
const listStyle: CSSProperties = { display: 'grid', gap: '16px' };
const vehicleCardStyle: CSSProperties = { border: `1px solid ${OPC_BRAND.border}`, borderRadius: '20px', background: '#FFF', overflow: 'hidden', boxShadow: '0 1px 2px rgba(15,17,21,.04)' };
const vehicleMainStyle: CSSProperties = { padding: '20px', display: 'flex', alignItems: 'center', gap: '18px' };
const imageStyle: CSSProperties = { width: '112px', height: '82px', borderRadius: '16px', border: `1px solid ${OPC_BRAND.border}`, background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 };
const imageImgStyle: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' };
const vehicleTitleRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' };
const vehicleTitleStyle: CSSProperties = { color: OPC_BRAND.text, textDecoration: 'none', fontSize: '18px', fontWeight: 840 };
const vehicleMetaStyle: CSSProperties = { marginTop: '6px', color: OPC_BRAND.muted, fontSize: '13px', fontWeight: 620 };
const suggestionStyle: CSSProperties = { marginTop: '12px', display: 'flex', alignItems: 'flex-start', gap: '8px', color: OPC_BRAND.text, fontSize: '13px', lineHeight: 1.45 };
const vehicleStatsStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3,minmax(110px,1fr))', gap: '10px' };
const miniStatStyle: CSSProperties = { minWidth: '116px', padding: '12px', border: `1px solid ${OPC_BRAND.border}`, borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '9px' };
const miniIconStyle: CSSProperties = { width: '34px', height: '34px', borderRadius: '10px', background: '#F9FAFB', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
const recordsStyle: CSSProperties = { borderTop: `1px solid ${OPC_BRAND.border}` };
const recordStyle: CSSProperties = { minHeight: '70px', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', borderBottom: `1px solid ${OPC_BRAND.border}`, color: OPC_BRAND.text, textDecoration: 'none' };
const dueDetailStyle: CSSProperties = { padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '16px', alignItems: 'center' };
const detailLabelStyle: CSSProperties = { display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.07em', color: OPC_BRAND.muted, fontWeight: 760, marginBottom: '5px' };
const pillStyle: CSSProperties = { minHeight: '28px', padding: '5px 10px', borderRadius: '999px', border: '1px solid', fontSize: '12px', fontWeight: 760, whiteSpace: 'nowrap' };
const emptyStyle: CSSProperties = { minHeight: '220px', border: `1px dashed ${OPC_BRAND.borderStrong}`, borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: OPC_BRAND.muted, fontWeight: 700 };
const errorStyle: CSSProperties = { padding: '14px 16px', marginBottom: '20px', borderRadius: '12px', border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#991B1B', fontWeight: 700 };
