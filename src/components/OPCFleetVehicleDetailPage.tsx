import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CarFront,
  CheckCircle2,
  Clock3,
  FileText,
  Fuel,
  Gauge,
  MapPin,
  MessageSquareText,
  RefreshCw,
  Route,
  Save,
  Wrench,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  OPC_BRAND,
  OPCMetricsGrid,
  OPCMetricCard,
  OPCPageShell,
  opcBlackButtonStyle,
  opcCardStyle,
  opcResponsiveStyle,
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
  latitude?: number | null;
  longitude?: number | null;
  speed_kmh?: number | null;
  odometer_km?: number | null;
  fuel_level_percent?: number | null;
  fuel_level_liters?: number | null;
  range_km?: number | null;
  battery_voltage?: number | null;
  oil_level_percent?: number | null;
  dtc_active_count?: number | null;
  ignition_on?: boolean | null;
  status?: string | null;
  raw_status?: Record<string, unknown> | null;
};

type VehicleTrip = {
  id: string;
  started_at?: string | null;
  ended_at?: string | null;
  start_address?: string | null;
  end_address?: string | null;
  distance_km?: number | null;
  duration_seconds?: number | null;
  classification?: string | null;
};

type FleetAlert = {
  id: string;
  severity?: string | null;
  title?: string | null;
  message?: string | null;
  status?: string | null;
  detected_at?: string | null;
  created_at?: string | null;
};

type DtcCode = {
  id: string;
  code: string;
  description?: string | null;
  severity?: string | null;
  status?: string | null;
  last_seen_at?: string | null;
};

type VehicleNote = {
  id: string;
  note_type?: string | null;
  title?: string | null;
  body: string;
  created_by?: string | null;
  created_at?: string | null;
};

type HandoverLog = {
  id: string;
  action: string;
  occurred_at?: string | null;
  odometer_km?: number | null;
  fuel_level_percent?: number | null;
  location_text?: string | null;
  note?: string | null;
  created_by?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('de-CH', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCompactDate(value?: string | null) {
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

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function vehicleName(vehicle?: FleetVehicle | null) {
  return vehicle?.display_name || vehicle?.license_plate || vehicle?.vin || 'OPC Fahrzeug';
}

function vehicleStatusLabel(vehicle?: FleetVehicle | null, status?: VehicleStatus | null) {
  if (vehicle?.status === 'maintenance' || status?.status === 'maintenance') return 'Reparatur nötig';
  if (status?.status === 'warning' || Number(status?.dtc_active_count || 0) > 0) return 'Prüfen';
  if (vehicle?.status === 'inactive') return 'Nicht aktiv';
  if (status?.status === 'driving') return 'Unterwegs';
  if (status?.status === 'online') return 'Okay';
  return vehicle?.status === 'active' ? 'Okay' : 'Unbekannt';
}

export default function OPCFleetVehicleDetailPage({ vehicleId }: { vehicleId: string }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [vehicle, setVehicle] = useState<FleetVehicle | null>(null);
  const [status, setStatus] = useState<VehicleStatus | null>(null);
  const [trips, setTrips] = useState<VehicleTrip[]>([]);
  const [alerts, setAlerts] = useState<FleetAlert[]>([]);
  const [dtcs, setDtcs] = useState<DtcCode[]>([]);
  const [notes, setNotes] = useState<VehicleNote[]>([]);
  const [handoverLogs, setHandoverLogs] = useState<HandoverLog[]>([]);
  const [noteType, setNoteType] = useState('general');
  const [noteText, setNoteText] = useState('');
  const [handoverNote, setHandoverNote] = useState('');

  const loadVehicle = useCallback(async (options: { refresh?: boolean } = {}) => {
    if (!vehicleId) return;
    if (options.refresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const [vehicleResult, statusResult, tripsResult, alertsResult, dtcResult, notesResult, handoverResult] = await Promise.all([
        supabase
          .from('opc_fleet_vehicles')
          .select('id, display_name, license_plate, vin, make, model, model_year, fuel_type, status, autoaid_vehicle_id, autoaid_device_id, home_base_label, notes')
          .eq('id', vehicleId)
          .single(),
        supabase.from('opc_vehicle_status_current').select('*').eq('vehicle_id', vehicleId).maybeSingle(),
        supabase
          .from('opc_vehicle_trips')
          .select('id, started_at, ended_at, start_address, end_address, distance_km, duration_seconds, classification')
          .eq('vehicle_id', vehicleId)
          .order('started_at', { ascending: false })
          .limit(12),
        supabase
          .from('opc_fleet_alerts')
          .select('id, severity, title, message, status, detected_at, created_at')
          .eq('vehicle_id', vehicleId)
          .in('status', ['open', 'active', 'new', 'acknowledged'])
          .order('detected_at', { ascending: false })
          .limit(20),
        supabase
          .from('opc_vehicle_dtc_codes')
          .select('id, code, description, severity, status, last_seen_at')
          .eq('vehicle_id', vehicleId)
          .in('status', ['active', 'review'])
          .order('last_seen_at', { ascending: false })
          .limit(20),
        supabase
          .from('opc_vehicle_notes')
          .select('id, note_type, title, body, created_by, created_at')
          .eq('vehicle_id', vehicleId)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('opc_vehicle_handover_logs')
          .select('id, action, occurred_at, odometer_km, fuel_level_percent, location_text, note, created_by')
          .eq('vehicle_id', vehicleId)
          .order('occurred_at', { ascending: false })
          .limit(30),
      ]);

      if (vehicleResult.error) throw vehicleResult.error;
      if (statusResult.error) throw statusResult.error;
      if (tripsResult.error) throw tripsResult.error;
      if (alertsResult.error) throw alertsResult.error;
      if (dtcResult.error) throw dtcResult.error;
      if (notesResult.error && !String(notesResult.error.message || '').includes('does not exist')) throw notesResult.error;
      if (handoverResult.error && !String(handoverResult.error.message || '').includes('does not exist')) throw handoverResult.error;

      setVehicle(vehicleResult.data as FleetVehicle);
      setStatus((statusResult.data || null) as VehicleStatus | null);
      setTrips((tripsResult.data || []) as VehicleTrip[]);
      setAlerts((alertsResult.data || []) as FleetAlert[]);
      setDtcs((dtcResult.data || []) as DtcCode[]);
      setNotes((notesResult.data || []) as VehicleNote[]);
      setHandoverLogs((handoverResult.data || []) as HandoverLog[]);
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

  const lastTrip = trips[0] || null;
  const healthLabel = vehicleStatusLabel(vehicle, status);
  const healthTone = healthLabel === 'Reparatur nötig' ? 'danger' : healthLabel === 'Prüfen' ? 'warning' : 'success';

  const todayDistance = useMemo(() => {
    const today = new Date().toDateString();
    return trips
      .filter((trip) => trip.started_at && new Date(trip.started_at).toDateString() === today)
      .reduce((sum, trip) => sum + Number(trip.distance_km || 0), 0);
  }, [trips]);

  async function saveNote() {
    if (!vehicleId || !noteText.trim()) return;
    setSaving(true);
    setError('');

    try {
      const { error: insertError } = await supabase.from('opc_vehicle_notes').insert({
        vehicle_id: vehicleId,
        note_type: noteType,
        body: noteText.trim(),
      });
      if (insertError) throw insertError;
      setNoteText('');
      await loadVehicle({ refresh: true });
    } catch (err: any) {
      setError(err?.message || 'Notiz konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  async function saveHandover(action: 'picked_up' | 'returned' | 'issue_reported') {
    if (!vehicleId) return;
    setSaving(true);
    setError('');

    try {
      const { error: insertError } = await supabase.from('opc_vehicle_handover_logs').insert({
        vehicle_id: vehicleId,
        action,
        odometer_km: status?.odometer_km ?? null,
        fuel_level_percent: status?.fuel_level_percent ?? null,
        note: handoverNote.trim() || null,
      });
      if (insertError) throw insertError;
      setHandoverNote('');
      await loadVehicle({ refresh: true });
    } catch (err: any) {
      setError(err?.message || 'Fahrzeuglog konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <OPCPageShell>
        <section style={{ ...opcCardStyle, padding: '72px 18px', textAlign: 'center', color: OPC_BRAND.muted, fontSize: '15px', fontWeight: 720 }}>
          Fahrzeug wird geladen...
        </section>
      </OPCPageShell>
    );
  }

  return (
    <OPCPageShell>
      <style>{opcResponsiveStyle}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'center', marginBottom: '22px' }}>
        <a href="/fuhrpark" style={{ ...opcSecondaryButtonStyle, width: '118px' }}>
          <ArrowLeft size={16} /> Zurück
        </a>
        <div style={{ display: 'flex', gap: '10px' }}>
          <a href="/fuhrpark/karte" style={{ ...opcSecondaryButtonStyle, width: '132px' }}>
            <MapPin size={16} /> Karte
          </a>
          <button type="button" onClick={() => void loadVehicle({ refresh: true })} style={{ ...opcSecondaryButtonStyle, width: '150px' }} disabled={refreshing}>
            <RefreshCw size={16} /> {refreshing ? 'Laden...' : 'Aktualisieren'}
          </button>
        </div>
      </div>

      {error && (
        <section style={{ ...opcCardStyle, padding: '14px 16px', marginBottom: '18px', color: OPC_BRAND.red, fontSize: '14px', fontWeight: 720 }}>
          {error}
        </section>
      )}

      <section style={{ ...opcCardStyle, padding: '24px 22px', marginBottom: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '18px' }}>
          <div>
            <p style={{ margin: '0 0 8px', color: OPC_BRAND.faint, fontSize: '12px', fontWeight: 860, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              {vehicle?.license_plate || vehicle?.fuel_type || 'Fahrzeug'}
            </p>
            <h1 style={{ margin: '0 0 8px', color: OPC_BRAND.text, fontSize: '28px', lineHeight: 1.1, fontWeight: 880, letterSpacing: '-0.055em' }}>
              {vehicleName(vehicle)}
            </h1>
            <p style={{ margin: 0, color: OPC_BRAND.muted, fontSize: '14px', fontWeight: 650 }}>
              Fahrzeugstatus, Live-Sensoren, Fahrtenbuch, Kilometerstand und Notizen.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <StatusPill label={healthLabel} tone={healthTone} />
            <StatusPill label={vehicle?.status || 'unknown'} tone="neutral" />
          </div>
        </div>
      </section>

      <OPCMetricsGrid>
        <OPCMetricCard label="Heute gefahren" value={formatNumber(todayDistance, ' km')} icon={<Route size={18} />} />
        <OPCMetricCard label="Tank / Reichweite" value={`${formatNumber(status?.fuel_level_percent, '%')} / ${formatNumber(status?.range_km, ' km')}`} icon={<Fuel size={18} />} tone={Number(status?.fuel_level_percent ?? 101) <= 20 ? 'danger' : 'neutral'} />
        <OPCMetricCard label="Kilometerstand" value={formatNumber(status?.odometer_km, ' km')} icon={<Gauge size={18} />} />
        <OPCMetricCard label="Letzte Fahrt" value={formatNumber(lastTrip?.distance_km, ' km')} icon={<Clock3 size={18} />} />
      </OPCMetricsGrid>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.05fr)', gap: '18px', marginBottom: '18px' }}>
        <InfoCard title="Fahrzeuginformationen">
          <InfoGrid items={[
            ['Marke', vehicle?.make || '—'],
            ['Modell', vehicle?.model || '—'],
            ['Jahrgang', vehicle?.model_year ? String(vehicle.model_year) : '—'],
            ['VIN', vehicle?.vin || '—'],
            ['Kennzeichen', vehicle?.license_plate || '—'],
            ['Treibstoff', vehicle?.fuel_type || 'Benzin/Diesel'],
            ['AutoAid Vehicle ID', vehicle?.autoaid_vehicle_id || '—'],
            ['Home Base', vehicle?.home_base_label || '—'],
          ]} />
        </InfoCard>

        <InfoCard title="Live-Status">
          <InfoGrid items={[
            ['Status', healthLabel],
            ['Zündung', status?.ignition_on ? 'Ein' : 'Aus / unbekannt'],
            ['Geschwindigkeit', formatNumber(status?.speed_kmh, ' km/h')],
            ['Tankstand', formatNumber(status?.fuel_level_percent, '%')],
            ['Batterie', formatNumber(status?.battery_voltage, ' V')],
            ['Ölstand', formatNumber(status?.oil_level_percent, '%')],
            ['Aktive Fehler', String(status?.dtc_active_count ?? dtcs.length)],
            ['Letzte Aktivität', formatCompactDate(status?.last_seen_at)],
          ]} />
        </InfoCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(360px, 0.85fr)', gap: '18px', marginBottom: '18px' }}>
        <section style={{ ...opcCardStyle, overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: `1px solid ${OPC_BRAND.border}` }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 860, letterSpacing: '-0.035em' }}>Letzte Fahrten</h2>
          </div>
          {trips.length === 0 ? (
            <EmptyState text="Noch keine AutoAid-Fahrten vorhanden." />
          ) : (
            trips.map((trip) => (
              <article key={trip.id} style={{ padding: '16px 20px', borderBottom: `1px solid ${OPC_BRAND.border}` }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 110px', gap: '14px', alignItems: 'center' }}>
                  <div>
                    <strong style={{ display: 'block', color: OPC_BRAND.text, fontSize: '14px', fontWeight: 860 }}>{formatDate(trip.started_at)}</strong>
                    <span style={{ color: OPC_BRAND.muted, fontSize: '12px', fontWeight: 650 }}>{trip.start_address || 'Start nicht gesetzt'} → {trip.end_address || 'Ziel nicht gesetzt'}</span>
                  </div>
                  <MiniValue label="Distanz" value={formatNumber(trip.distance_km, ' km')} />
                  <MiniValue label="Dauer" value={formatDuration(trip.duration_seconds)} />
                </div>
              </article>
            ))
          )}
        </section>

        <section style={{ ...opcCardStyle, padding: '18px' }}>
          <h2 style={{ margin: '0 0 14px', fontSize: '18px', fontWeight: 860, letterSpacing: '-0.035em' }}>Kurzstandort</h2>
          <div style={{ height: '260px', borderRadius: '18px', overflow: 'hidden', border: `1px solid ${OPC_BRAND.border}`, background: '#F9FAFB', position: 'relative' }}>
            <iframe
              title="Fahrzeug Standort"
              src={mapUrl(status?.latitude, status?.longitude)}
              style={{ width: '100%', height: '100%', border: 0, filter: 'saturate(0.88) contrast(1.02)' }}
            />
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '34px', height: '34px', borderRadius: '999px', background: OPC_BRAND.black, color: '#FFFFFF', display: 'grid', placeItems: 'center', border: '3px solid #FFFFFF', boxShadow: '0 10px 24px rgba(15,17,21,0.22)' }}>
              <CarFront size={17} />
            </div>
          </div>
          <p style={{ margin: '12px 0 0', color: OPC_BRAND.muted, fontSize: '12px', fontWeight: 650 }}>
            Letzte Position: {formatCompactDate(status?.last_position_at)}
          </p>
        </section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '18px', marginBottom: '18px' }}>
        <section style={{ ...opcCardStyle, overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: `1px solid ${OPC_BRAND.border}` }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 860, letterSpacing: '-0.035em' }}>Warnungen & Verschleiss</h2>
          </div>
          {alerts.length === 0 && dtcs.length === 0 ? (
            <EmptyState text="Keine offenen Warnungen oder Fehlercodes." />
          ) : (
            <>
              {alerts.map((alert) => (
                <AlertRow key={alert.id} title={alert.title || 'Warnung'} text={alert.message || 'AutoAid Warnung'} date={alert.detected_at || alert.created_at} tone={alert.severity === 'critical' ? 'danger' : 'warning'} />
              ))}
              {dtcs.map((dtc) => (
                <AlertRow key={dtc.id} title={dtc.code} text={dtc.description || 'Diagnosecode aktiv'} date={dtc.last_seen_at} tone={dtc.severity === 'critical' ? 'danger' : 'warning'} />
              ))}
            </>
          )}
        </section>

        <section style={{ ...opcCardStyle, padding: '20px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 860, letterSpacing: '-0.035em' }}>Fahrzeug übernehmen / melden</h2>
          <p style={{ margin: '0 0 14px', color: OPC_BRAND.muted, fontSize: '13px', fontWeight: 650 }}>
            Für Fahrtenbuch, Übergabe, Rückgabe und spätere Versicherungs-/Schadenberichte.
          </p>
          <textarea
            value={handoverNote}
            onChange={(event) => setHandoverNote(event.target.value)}
            placeholder="Optional. Beispiel: Fahrzeug übernommen, Tank 80%, keine sichtbaren Schäden."
            style={{ width: '100%', minHeight: '108px', padding: '14px', borderRadius: '16px', border: `1px solid ${OPC_BRAND.border}`, outline: 'none', resize: 'vertical', fontSize: '14px', fontWeight: 620, color: OPC_BRAND.text, boxSizing: 'border-box' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', marginTop: '12px' }}>
            <button type="button" onClick={() => void saveHandover('picked_up')} disabled={saving} style={opcBlackButtonStyle}>Übernommen</button>
            <button type="button" onClick={() => void saveHandover('returned')} disabled={saving} style={opcSecondaryButtonStyle}>Zurückgegeben</button>
            <button type="button" onClick={() => void saveHandover('issue_reported')} disabled={saving} style={opcSecondaryButtonStyle}>Problem</button>
          </div>
        </section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)', gap: '18px' }}>
        <section style={{ ...opcCardStyle, padding: '20px' }}>
          <h2 style={{ margin: '0 0 14px', fontSize: '18px', fontWeight: 860, letterSpacing: '-0.035em' }}>Neue Notiz</h2>
          <select value={noteType} onChange={(event) => setNoteType(event.target.value)} style={{ ...opcSelectStyle, marginBottom: '12px' }}>
            <option value="general">Allgemein</option>
            <option value="damage">Schaden</option>
            <option value="maintenance">Wartung</option>
            <option value="handover">Übergabe</option>
            <option value="insurance">Versicherung</option>
            <option value="driver_note">Fahrer-Notiz</option>
          </select>
          <textarea
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            placeholder="Notiz zum Fahrzeug. Sichtbar mit Zeitstempel und Verfasser im Fahrzeugverlauf."
            style={{ width: '100%', minHeight: '130px', padding: '14px', borderRadius: '16px', border: `1px solid ${OPC_BRAND.border}`, outline: 'none', resize: 'vertical', fontSize: '14px', fontWeight: 620, color: OPC_BRAND.text, boxSizing: 'border-box' }}
          />
          <button type="button" onClick={() => void saveNote()} disabled={saving || !noteText.trim()} style={{ ...opcBlackButtonStyle, width: '180px', marginTop: '12px' }}>
            <Save size={16} /> Notiz speichern
          </button>
        </section>

        <section style={{ ...opcCardStyle, overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: `1px solid ${OPC_BRAND.border}` }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 860, letterSpacing: '-0.035em' }}>Fahrzeuglog & Notizen</h2>
          </div>
          {notes.length === 0 && handoverLogs.length === 0 ? (
            <EmptyState text="Noch keine Notizen oder Fahrtenbuch-Meldungen." />
          ) : (
            <>
              {handoverLogs.slice(0, 8).map((log) => (
                <LogRow key={`handover-${log.id}`} icon={<CarFront size={16} />} title={handoverLabel(log.action)} text={log.note || `${formatNumber(log.odometer_km, ' km')} · Tank ${formatNumber(log.fuel_level_percent, '%')}`} date={log.occurred_at} />
              ))}
              {notes.slice(0, 8).map((note) => (
                <LogRow key={`note-${note.id}`} icon={<MessageSquareText size={16} />} title={note.note_type || 'Notiz'} text={note.body} date={note.created_at} />
              ))}
            </>
          )}
        </section>
      </div>
    </OPCPageShell>
  );
}

function mapUrl(latitude?: number | null, longitude?: number | null) {
  const lat = typeof latitude === 'number' ? latitude : 47.5596;
  const lng = typeof longitude === 'number' ? longitude : 7.5886;
  const delta = 0.035;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function handoverLabel(action: string) {
  if (action === 'picked_up') return 'Fahrzeug übernommen';
  if (action === 'returned') return 'Fahrzeug zurückgegeben';
  if (action === 'issue_reported') return 'Problem gemeldet';
  if (action === 'insurance_report') return 'Versicherungsreport';
  return action;
}

function StatusPill({ label, tone }: { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const color = tone === 'danger' ? OPC_BRAND.red : tone === 'warning' ? OPC_BRAND.amber : tone === 'success' ? OPC_BRAND.green : OPC_BRAND.muted;
  return (
    <span style={{ padding: '8px 13px', borderRadius: '999px', border: `1px solid ${OPC_BRAND.border}`, color, background: '#FFFFFF', fontSize: '12px', fontWeight: 820 }}>
      {label}
    </span>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ ...opcCardStyle, padding: '20px' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 860, letterSpacing: '-0.035em' }}>{title}</h2>
      {children}
    </section>
  );
}

function InfoGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px 28px' }}>
      {items.map(([label, value]) => (
        <MiniValue key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function MiniValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: OPC_BRAND.faint, fontSize: '11px', fontWeight: 820, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '5px' }}>{label}</div>
      <div style={{ color: OPC_BRAND.text, fontSize: '14px', fontWeight: 760, lineHeight: 1.35, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: '62px 18px', textAlign: 'center', color: OPC_BRAND.muted, fontSize: '14px', fontWeight: 720 }}>
      {text}
    </div>
  );
}

function AlertRow({ title, text, date, tone }: { title: string; text: string; date?: string | null; tone: 'warning' | 'danger' }) {
  const color = tone === 'danger' ? OPC_BRAND.red : OPC_BRAND.amber;
  return (
    <article style={{ padding: '16px 20px', borderBottom: `1px solid ${OPC_BRAND.border}` }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <span style={{ width: '34px', height: '34px', borderRadius: '12px', border: `1px solid ${OPC_BRAND.border}`, display: 'grid', placeItems: 'center', color }}>
          <AlertTriangle size={16} />
        </span>
        <div>
          <strong style={{ display: 'block', color: OPC_BRAND.text, fontSize: '14px', fontWeight: 860 }}>{title}</strong>
          <p style={{ margin: '5px 0 0', color: OPC_BRAND.muted, fontSize: '13px', fontWeight: 620, lineHeight: 1.45 }}>{text}</p>
          <span style={{ display: 'block', marginTop: '6px', color: OPC_BRAND.faint, fontSize: '11px', fontWeight: 720 }}>{formatCompactDate(date)}</span>
        </div>
      </div>
    </article>
  );
}

function LogRow({ icon, title, text, date }: { icon: React.ReactNode; title: string; text: string; date?: string | null }) {
  return (
    <article style={{ padding: '16px 20px', borderBottom: `1px solid ${OPC_BRAND.border}` }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <span style={{ width: '34px', height: '34px', borderRadius: '12px', border: `1px solid ${OPC_BRAND.border}`, display: 'grid', placeItems: 'center', color: OPC_BRAND.text }}>
          {icon}
        </span>
        <div>
          <strong style={{ display: 'block', color: OPC_BRAND.text, fontSize: '14px', fontWeight: 860 }}>{title}</strong>
          <p style={{ margin: '5px 0 0', color: OPC_BRAND.muted, fontSize: '13px', fontWeight: 620, lineHeight: 1.45 }}>{text}</p>
          <span style={{ display: 'block', marginTop: '6px', color: OPC_BRAND.faint, fontSize: '11px', fontWeight: 720 }}>{formatCompactDate(date)}</span>
        </div>
      </div>
    </article>
  );
}
