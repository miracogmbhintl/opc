import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CarFront, CheckCircle2, Clock3, Fuel, Gauge, MailWarning, MapPin, MessageSquareText, RefreshCw, Save, Wrench } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  OPC_BRAND,
  OPCMetricsGrid,
  OPCMetricCard,
  OPCPageShell,
  opcBlackButtonStyle,
  opcCardStyle,
  opcInputStyle,
  opcResponsiveStyle,
  opcSecondaryButtonStyle,
  opcSelectStyle,
} from './opc/OPCPageTop';

type Vehicle = {
  id: string;
  display_name: string;
  license_plate?: string | null;
  make?: string | null;
  model?: string | null;
  model_year?: number | null;
  vin?: string | null;
  fuel_type?: string | null;
  status?: string | null;
  home_base_label?: string | null;
  notes?: string | null;
};

type VehicleStatus = {
  vehicle_id: string;
  status?: string | null;
  last_seen_at?: string | null;
  last_position_at?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  speed_kmh?: number | null;
  ignition_on?: boolean | null;
  odometer_km?: number | null;
  fuel_level_percent?: number | null;
  fuel_level_liters?: number | null;
  range_km?: number | null;
  battery_voltage?: number | null;
  oil_level_percent?: number | null;
  dtc_active_count?: number | null;
};

type Trip = {
  id: string;
  started_at?: string | null;
  ended_at?: string | null;
  start_address?: string | null;
  end_address?: string | null;
  distance_km?: number | null;
  duration_seconds?: number | null;
  classification?: string | null;
};

type Alert = {
  id: string;
  title?: string | null;
  message?: string | null;
  severity?: string | null;
  detected_at?: string | null;
  status?: string | null;
};

type Handover = {
  id: string;
  action?: string | null;
  occurred_at?: string | null;
  odometer_km?: number | null;
  fuel_level_percent?: number | null;
  location_text?: string | null;
  note?: string | null;
};

type VehicleNote = {
  id: string;
  note_type?: string | null;
  title?: string | null;
  body?: string | null;
  created_at?: string | null;
  created_by?: string | null;
};

type Props = { vehicleId: string };

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatShortDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('de-CH', { day: '2-digit', month: 'long', year: 'numeric' });
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

function formatDuration(seconds?: number | null) {
  const total = Number(seconds || 0);
  if (!Number.isFinite(total) || total <= 0) return '—';
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function getVehicleState(vehicle?: Vehicle | null, status?: VehicleStatus | null) {
  const raw = String(status?.status || vehicle?.status || '').toLowerCase();
  if (raw.includes('maintenance') || raw.includes('repair') || raw.includes('critical')) return 'repair';
  if ((status?.dtc_active_count || 0) > 0 || raw.includes('warning')) return 'check';
  if (raw.includes('offline') || raw.includes('inactive')) return 'offline';
  return 'ok';
}

function StatePill({ state }: { state: string }) {
  const label = state === 'repair' ? 'Reparatur nötig' : state === 'check' ? 'Prüfen' : state === 'offline' ? 'Offline' : 'Okay';
  const color = state === 'repair' ? OPC_BRAND.red : state === 'check' ? OPC_BRAND.amber : state === 'offline' ? OPC_BRAND.muted : OPC_BRAND.green;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: '28px', padding: '0 11px', borderRadius: '999px', border: `1px solid ${OPC_BRAND.border}`, color, fontSize: '12px', fontWeight: 820, background: '#FFFFFF' }}>{label}</span>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div style={{ borderBottom: `1px solid ${OPC_BRAND.border}`, padding: '13px 0' }}>
      <div style={{ color: OPC_BRAND.faint, fontSize: '11px', fontWeight: 820, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '5px' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 760, color: OPC_BRAND.text }}>{value || '—'}</div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ ...opcCardStyle, padding: '20px' }}>
      <h2 style={{ margin: '0 0 14px', fontSize: '17px', fontWeight: 860, letterSpacing: '-0.035em' }}>{title}</h2>
      {children}
    </section>
  );
}

export default function OPCFleetVehicleDetailPage({ vehicleId }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [status, setStatus] = useState<VehicleStatus | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [notes, setNotes] = useState<VehicleNote[]>([]);
  const [noteType, setNoteType] = useState('general');
  const [noteBody, setNoteBody] = useState('');

  const loadVehicle = useCallback(async (silent = false) => {
    if (!vehicleId) return;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const vehicleResult = await supabase
        .from('opc_fleet_vehicles')
        .select('id, display_name, license_plate, make, model, model_year, vin, fuel_type, status, home_base_label, notes')
        .eq('id', vehicleId)
        .maybeSingle();
      if (vehicleResult.error) throw vehicleResult.error;
      setVehicle((vehicleResult.data || null) as Vehicle | null);

      const [statusResult, tripsResult, alertsResult, handoversResult, notesResult] = await Promise.all([
        supabase.from('opc_vehicle_status_current').select('*').eq('vehicle_id', vehicleId).maybeSingle(),
        supabase.from('opc_vehicle_trips').select('id, started_at, ended_at, start_address, end_address, distance_km, duration_seconds, classification').eq('vehicle_id', vehicleId).order('started_at', { ascending: false }).limit(8),
        supabase.from('opc_fleet_alerts').select('id, title, message, severity, detected_at, status').eq('vehicle_id', vehicleId).in('status', ['open', 'acknowledged']).order('detected_at', { ascending: false }).limit(8),
        supabase.from('opc_vehicle_handover_logs').select('id, action, occurred_at, odometer_km, fuel_level_percent, location_text, note').eq('vehicle_id', vehicleId).order('occurred_at', { ascending: false }).limit(12),
        supabase.from('opc_vehicle_notes').select('id, note_type, title, body, created_at, created_by').eq('vehicle_id', vehicleId).order('created_at', { ascending: false }).limit(12),
      ]);

      if (!statusResult.error) setStatus((statusResult.data || null) as VehicleStatus | null);
      if (!tripsResult.error) setTrips((tripsResult.data || []) as Trip[]);
      if (!alertsResult.error) setAlerts((alertsResult.data || []) as Alert[]);
      if (!handoversResult.error) setHandovers((handoversResult.data || []) as Handover[]);
      if (!notesResult.error) setNotes((notesResult.data || []) as VehicleNote[]);
    } catch (err: any) {
      setError(err?.message || 'Fahrzeug konnte nicht geladen werden.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    void loadVehicle();
  }, [loadVehicle]);

  const latestTrip = trips[0];
  const state = getVehicleState(vehicle, status);
  const todayDistance = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return trips.filter((trip) => String(trip.started_at || '').slice(0, 10) === today).reduce((sum, trip) => sum + Number(trip.distance_km || 0), 0);
  }, [trips]);

  async function insertHandover(action: 'picked_up' | 'returned' | 'issue_reported') {
    if (!vehicleId) return;
    setSaving(true);
    try {
      const { error: insertError } = await supabase.from('opc_vehicle_handover_logs').insert({
        vehicle_id: vehicleId,
        action,
        odometer_km: status?.odometer_km || null,
        fuel_level_percent: status?.fuel_level_percent || null,
        note: action === 'picked_up' ? 'Fahrzeug übernommen.' : action === 'returned' ? 'Fahrzeug zurückgegeben.' : 'Problem gemeldet.',
      });
      if (insertError) throw insertError;
      await loadVehicle(true);
    } catch (err: any) {
      setError(err?.message || 'Eintrag konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  async function saveNote() {
    const body = noteBody.trim();
    if (!body || !vehicleId) return;
    setSaving(true);
    try {
      const { error: insertError } = await supabase.from('opc_vehicle_notes').insert({ vehicle_id: vehicleId, note_type: noteType, body });
      if (insertError) throw insertError;
      setNoteBody('');
      await loadVehicle(true);
    } catch (err: any) {
      setError(err?.message || 'Notiz konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <OPCPageShell><div style={{ ...opcCardStyle, padding: '24px', color: OPC_BRAND.muted, fontWeight: 720 }}>Fahrzeug wird geladen...</div></OPCPageShell>;
  }

  if (!vehicle) {
    return <OPCPageShell><div style={{ ...opcCardStyle, padding: '24px', color: OPC_BRAND.red, fontWeight: 720 }}>Fahrzeug nicht gefunden.</div></OPCPageShell>;
  }

  return (
    <OPCPageShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' }}>
        <a href="/fuhrpark" style={{ ...opcSecondaryButtonStyle, width: 'auto', height: '42px' }}><ArrowLeft size={16} /> Zurück</a>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => document.getElementById('opc-vehicle-note')?.scrollIntoView({ behavior: 'smooth' })} style={{ ...opcSecondaryButtonStyle, width: 'auto', height: '42px' }}><MessageSquareText size={16} /> Notiz</button>
          <button type="button" onClick={() => void loadVehicle(true)} style={{ ...opcBlackButtonStyle, width: 'auto', height: '42px' }} disabled={refreshing}><RefreshCw size={16} /> {refreshing ? 'Laden...' : 'Aktualisieren'}</button>
        </div>
      </div>

      <section style={{ ...opcCardStyle, padding: '22px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', minWidth: 0 }}>
            <div style={{ width: '54px', height: '54px', borderRadius: '18px', border: `1px solid ${OPC_BRAND.border}`, background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><CarFront size={25} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', gap: '9px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
                <StatePill state={state} />
                <span style={{ color: OPC_BRAND.muted, fontSize: '12px', fontWeight: 800 }}>{vehicle.status || 'active'}</span>
              </div>
              <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 880, letterSpacing: '-0.055em' }}>{vehicle.display_name}</h1>
              <p style={{ margin: '6px 0 0', color: OPC_BRAND.muted, fontSize: '14px', fontWeight: 650 }}>{vehicle.license_plate || 'Kennzeichen offen'} · {[vehicle.make, vehicle.model, vehicle.model_year].filter(Boolean).join(' ') || 'Fahrzeugdaten offen'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => void insertHandover('picked_up')} disabled={saving} style={{ ...opcSecondaryButtonStyle, width: 'auto', height: '42px' }}><CheckCircle2 size={16} /> Übernehmen</button>
            <button type="button" onClick={() => void insertHandover('returned')} disabled={saving} style={{ ...opcSecondaryButtonStyle, width: 'auto', height: '42px' }}>Zurückgeben</button>
            <button type="button" onClick={() => void insertHandover('issue_reported')} disabled={saving} style={{ ...opcSecondaryButtonStyle, width: 'auto', height: '42px', color: OPC_BRAND.red }}><MailWarning size={16} /> Problem</button>
          </div>
        </div>
      </section>

      <OPCMetricsGrid>
        <OPCMetricCard label="Heute gefahren" value={formatKm(todayDistance)} icon={<Gauge size={19} />} />
        <OPCMetricCard label="Letzte Fahrt" value={formatKm(latestTrip?.distance_km)} icon={<Clock3 size={19} />} />
        <OPCMetricCard label="Tank / Reichweite" value={`${formatFuel(status?.fuel_level_percent)} · ${formatKm(status?.range_km)}`} icon={<Fuel size={19} />} />
        <OPCMetricCard label="Kilometerstand" value={formatKm(status?.odometer_km)} icon={<CarFront size={19} />} />
      </OPCMetricsGrid>

      {error && <div style={{ ...opcCardStyle, padding: '14px 16px', color: OPC_BRAND.red, marginBottom: '16px', fontWeight: 720 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.05fr)', gap: '18px', marginBottom: '18px' }} className="opc-vehicle-detail-grid">
        <SectionCard title="Fahrzeuginformationen">
          <InfoRow label="Marke" value={vehicle.make} />
          <InfoRow label="Modell" value={vehicle.model} />
          <InfoRow label="Jahrgang" value={vehicle.model_year} />
          <InfoRow label="VIN" value={vehicle.vin} />
          <InfoRow label="Kennzeichen" value={vehicle.license_plate} />
          <InfoRow label="Treibstoff" value={vehicle.fuel_type || 'Benzin / Gas'} />
          <InfoRow label="Home Base" value={vehicle.home_base_label} />
        </SectionCard>

        <SectionCard title="Live-Status">
          <InfoRow label="Status" value={state === 'ok' ? 'Okay' : state === 'check' ? 'Prüfen' : state === 'repair' ? 'Reparatur nötig' : 'Offline'} />
          <InfoRow label="Zündung" value={status?.ignition_on == null ? '—' : status.ignition_on ? 'Ein' : 'Aus'} />
          <InfoRow label="Geschwindigkeit" value={`${Math.round(Number(status?.speed_kmh || 0))} km/h`} />
          <InfoRow label="Tank" value={`${formatFuel(status?.fuel_level_percent)}${status?.fuel_level_liters ? ` · ${Math.round(Number(status.fuel_level_liters))} l` : ''}`} />
          <InfoRow label="Batterie" value={status?.battery_voltage ? `${status.battery_voltage} V` : '—'} />
          <InfoRow label="Ölstand" value={formatFuel(status?.oil_level_percent)} />
          <InfoRow label="Aktive Fehler" value={status?.dtc_active_count || 0} />
          <InfoRow label="Letzte Aktivität" value={formatDate(status?.last_seen_at)} />
        </SectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)', gap: '18px', marginBottom: '18px' }} className="opc-vehicle-detail-grid">
        <SectionCard title="Standort">
          <div style={{ position: 'relative', height: '260px', borderRadius: '18px', overflow: 'hidden', border: `1px solid ${OPC_BRAND.border}`, background: '#F3F4F6' }}>
            {status?.latitude && status?.longitude ? (
              <iframe
                title="Fahrzeugstandort"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(status.longitude) - 0.01}%2C${Number(status.latitude) - 0.01}%2C${Number(status.longitude) + 0.01}%2C${Number(status.latitude) + 0.01}&layer=mapnik&marker=${status.latitude}%2C${status.longitude}`}
                style={{ border: 0, width: '100%', height: '100%' }}
                loading="lazy"
              />
            ) : (
              <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: OPC_BRAND.muted, fontWeight: 720 }}><MapPin size={18} /> Noch keine Position</div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Warnungen & Verschleiss">
          {alerts.length === 0 && <div style={{ color: OPC_BRAND.muted, fontSize: '14px', fontWeight: 650 }}>Keine aktiven Warnungen.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {alerts.map((alert) => (
              <div key={alert.id} style={{ border: `1px solid ${OPC_BRAND.border}`, borderRadius: '16px', padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 830, fontSize: '14px' }}><AlertTriangle size={15} />{alert.title || 'Warnung'}</div>
                <div style={{ marginTop: '5px', color: OPC_BRAND.muted, fontSize: '13px', lineHeight: 1.45 }}>{alert.message || alert.severity || 'Keine Beschreibung'}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '18px', marginBottom: '18px' }} className="opc-vehicle-detail-grid">
        <SectionCard title="Letzte Fahrten">
          {trips.length === 0 && <div style={{ color: OPC_BRAND.muted, fontSize: '14px', fontWeight: 650 }}>Noch keine Fahrten vorhanden.</div>}
          {trips.map((trip) => (
            <div key={trip.id} style={{ padding: '13px 0', borderBottom: `1px solid ${OPC_BRAND.border}` }}>
              <div style={{ fontSize: '14px', fontWeight: 820 }}>{formatShortDate(trip.started_at)} · {formatKm(trip.distance_km)}</div>
              <div style={{ marginTop: '5px', color: OPC_BRAND.muted, fontSize: '13px' }}>{trip.start_address || 'Start offen'} → {trip.end_address || 'Ziel offen'}</div>
              <div style={{ marginTop: '5px', color: OPC_BRAND.faint, fontSize: '12px', fontWeight: 720 }}>Dauer {formatDuration(trip.duration_seconds)} · {trip.classification || 'unmatched'}</div>
            </div>
          ))}
        </SectionCard>

        <SectionCard title="Fahrzeuglog">
          {handovers.length === 0 && <div style={{ color: OPC_BRAND.muted, fontSize: '14px', fontWeight: 650 }}>Keine Übergaben oder Probleme erfasst.</div>}
          {handovers.map((entry) => (
            <div key={entry.id} style={{ padding: '13px 0', borderBottom: `1px solid ${OPC_BRAND.border}` }}>
              <div style={{ fontSize: '14px', fontWeight: 820 }}>{entry.action || 'Eintrag'} · {formatDate(entry.occurred_at)}</div>
              <div style={{ marginTop: '5px', color: OPC_BRAND.muted, fontSize: '13px' }}>{entry.note || entry.location_text || 'Keine Notiz'}</div>
              <div style={{ marginTop: '5px', color: OPC_BRAND.faint, fontSize: '12px', fontWeight: 720 }}>Tank {formatFuel(entry.fuel_level_percent)} · KM {formatKm(entry.odometer_km)}</div>
            </div>
          ))}
        </SectionCard>
      </div>

      <section id="opc-vehicle-note" style={{ ...opcCardStyle, padding: '20px', marginBottom: '18px' }}>
        <h2 style={{ margin: '0 0 14px', fontSize: '17px', fontWeight: 860, letterSpacing: '-0.035em' }}>Neue Notiz</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr) 160px', gap: '12px', alignItems: 'start' }} className="opc-vehicle-note-grid">
          <select value={noteType} onChange={(event) => setNoteType(event.target.value)} style={opcSelectStyle}>
            <option value="general">Allgemein</option>
            <option value="damage">Schaden</option>
            <option value="maintenance">Wartung</option>
            <option value="handover">Übergabe</option>
            <option value="insurance">Versicherung</option>
            <option value="driver_note">Fahrer-Notiz</option>
          </select>
          <input id="vehicle-note-input" value={noteBody} onChange={(event) => setNoteBody(event.target.value)} placeholder="Notiz zum Fahrzeug, Fahrer, Schaden oder letzter Fahrt" style={opcInputStyle} />
          <button type="button" onClick={() => void saveNote()} disabled={saving || !noteBody.trim()} style={opcBlackButtonStyle}><Save size={16} /> Speichern</button>
        </div>
      </section>

      <SectionCard title="Notizen">
        {notes.length === 0 && <div style={{ color: OPC_BRAND.muted, fontSize: '14px', fontWeight: 650 }}>Noch keine Notizen.</div>}
        {notes.map((note) => (
          <div key={note.id} style={{ padding: '13px 0', borderBottom: `1px solid ${OPC_BRAND.border}` }}>
            <div style={{ fontSize: '14px', fontWeight: 820 }}>{note.note_type || 'general'} · {formatDate(note.created_at)}</div>
            <div style={{ marginTop: '5px', color: OPC_BRAND.muted, fontSize: '13px', lineHeight: 1.5 }}>{note.body}</div>
          </div>
        ))}
      </SectionCard>

      <style>{opcResponsiveStyle}</style>
      <style>{`
        @media (max-width: 980px) {
          .opc-vehicle-detail-grid,
          .opc-vehicle-note-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </OPCPageShell>
  );
}
