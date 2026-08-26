import { AlertTriangle, ArrowLeft, CarFront, CheckCircle2, Clock3, Fuel, Gauge, MapPin, MessageSquareText, RefreshCw, Save } from 'lucide-react';
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

const LOGISTICS_LOCATION = {
  address: 'Wattwerkstrasse 2, 4416 Bubendorf',
  lat: 47.45695,
  lng: 7.74378,
};

function mapUrl() {
  const span = 0.016;
  const { lat, lng } = LOGISTICS_LOCATION;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - span}%2C${lat - span}%2C${lng + span}%2C${lat + span}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderBottom: `1px solid ${OPC_BRAND.border}`, padding: '12px 0' }}>
      <div style={{ color: OPC_BRAND.faint, fontSize: '11px', fontWeight: 820, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '5px' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 760, color: OPC_BRAND.text }}>{value}</div>
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

export default function OPCFleetVehicleDemoPage() {
  return (
    <OPCPageShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' }}>
        <a href="/fuhrpark" style={{ ...opcSecondaryButtonStyle, width: 'auto', height: '42px' }}><ArrowLeft size={16} /> Zurück</a>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => document.getElementById('opc-demo-vehicle-note')?.scrollIntoView({ behavior: 'smooth' })} style={{ ...opcSecondaryButtonStyle, width: 'auto', height: '42px' }}><MessageSquareText size={16} /> Notiz</button>
          <button type="button" style={{ ...opcBlackButtonStyle, width: 'auto', height: '42px' }}><RefreshCw size={16} /> Aktualisieren</button>
        </div>
      </div>

      <section style={{ ...opcCardStyle, padding: '22px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', minWidth: 0 }}>
            <div style={{ width: '54px', height: '54px', borderRadius: '18px', border: `1px solid ${OPC_BRAND.border}`, background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><CarFront size={25} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', gap: '9px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', height: '28px', padding: '0 11px', borderRadius: '999px', border: `1px solid ${OPC_BRAND.border}`, background: '#FFFFFF', fontSize: '12px', fontWeight: 820 }}>Okay</span>
                <span style={{ color: OPC_BRAND.muted, fontSize: '12px', fontWeight: 800 }}>AutoAid online</span>
              </div>
              <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 880, letterSpacing: '-0.055em' }}>Opel Vivaro OPC-01</h1>
              <p style={{ margin: '6px 0 0', color: OPC_BRAND.muted, fontSize: '14px', fontWeight: 650 }}>BL 284 910 · Opel Vivaro 2021</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" style={{ ...opcSecondaryButtonStyle, width: 'auto', height: '42px' }}><CheckCircle2 size={16} /> Übernehmen</button>
            <button type="button" style={{ ...opcSecondaryButtonStyle, width: 'auto', height: '42px' }}>Zurückgeben</button>
            <button type="button" style={{ ...opcSecondaryButtonStyle, width: 'auto', height: '42px' }}><AlertTriangle size={16} /> Problem</button>
          </div>
        </div>
      </section>

      <OPCMetricsGrid>
        <OPCMetricCard label="Heute gefahren" value="24 km" icon={<Gauge size={19} />} />
        <OPCMetricCard label="Letzte Fahrt" value="18 km" icon={<Clock3 size={19} />} />
        <OPCMetricCard label="Tank / Reichweite" value="68% · 520 km" icon={<Fuel size={19} />} />
        <OPCMetricCard label="Kilometerstand" value="82’450 km" icon={<CarFront size={19} />} />
      </OPCMetricsGrid>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.05fr)', gap: '18px', marginBottom: '18px' }} className="opc-demo-vehicle-grid">
        <SectionCard title="Fahrzeuginformationen">
          <InfoRow label="Marke" value="Opel" />
          <InfoRow label="Modell" value="Vivaro" />
          <InfoRow label="Jahrgang" value="2021" />
          <InfoRow label="VIN" value="W0V0XAHB0M1234567" />
          <InfoRow label="Kennzeichen" value="BL 284 910" />
          <InfoRow label="Treibstoff" value="Diesel" />
          <InfoRow label="Home Base" value={LOGISTICS_LOCATION.address} />
        </SectionCard>

        <SectionCard title="Live-Status">
          <InfoRow label="Status" value="Okay" />
          <InfoRow label="Zündung" value="Aus" />
          <InfoRow label="Geschwindigkeit" value="0 km/h" />
          <InfoRow label="Tank" value="68% · 48 l" />
          <InfoRow label="Batterie" value="12.6 V" />
          <InfoRow label="Ölstand" value="84%" />
          <InfoRow label="Aktive Fehler" value="0" />
          <InfoRow label="Letzte Aktivität" value="Heute, 17:42" />
        </SectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)', gap: '18px', marginBottom: '18px' }} className="opc-demo-vehicle-grid">
        <SectionCard title="Standort">
          <div style={{ position: 'relative', height: '260px', borderRadius: '18px', overflow: 'hidden', border: `1px solid ${OPC_BRAND.border}`, background: '#F3F4F6' }}>
            <iframe title="Demo Fahrzeugstandort" src={mapUrl()} style={{ border: 0, width: '100%', height: '100%' }} loading="lazy" />
            <div style={{ position: 'absolute', left: 12, top: 12, ...opcCardStyle, padding: '9px 11px' }}>
              <div style={{ fontSize: 13, fontWeight: 850 }}>Logistikstandort</div>
              <div style={{ marginTop: 3, color: OPC_BRAND.muted, fontSize: 12, fontWeight: 650 }}>{LOGISTICS_LOCATION.address}</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Warnungen & Verschleiss">
          <div style={{ color: OPC_BRAND.muted, fontSize: '14px', fontWeight: 650, marginBottom: 12 }}>Keine aktiven Warnungen.</div>
          <InfoRow label="Nächster Service" value="in 2’100 km" />
          <InfoRow label="Reifen" value="Vorne 71%, hinten 74%" />
          <InfoRow label="Bremsen" value="Normaler Verschleiss" />
        </SectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '18px', marginBottom: '18px' }} className="opc-demo-vehicle-grid">
        <SectionCard title="Letzte Fahrten">
          {[
            ['Heute', '18 km', 'Bubendorf → Basel → Bubendorf', '35 Minuten'],
            ['Gestern', '42 km', 'Bubendorf → Muttenz → Reinach', '1h 10m'],
            ['18.08.2026', '27 km', 'Bubendorf → Liestal → Bubendorf', '48 Minuten'],
          ].map(([date, distance, route, duration]) => (
            <div key={`${date}-${distance}`} style={{ padding: '13px 0', borderBottom: `1px solid ${OPC_BRAND.border}` }}>
              <div style={{ fontSize: '14px', fontWeight: 820 }}>{date} · {distance}</div>
              <div style={{ marginTop: '5px', color: OPC_BRAND.muted, fontSize: '13px' }}>{route}</div>
              <div style={{ marginTop: '5px', color: OPC_BRAND.faint, fontSize: '12px', fontWeight: 720 }}>Dauer {duration} · automatisch erkannt</div>
            </div>
          ))}
        </SectionCard>

        <SectionCard title="Fahrzeuglog">
          {[
            ['Zurückgegeben', 'Heute, 17:42', 'Tank 68%, keine Schäden gemeldet.'],
            ['Übernommen', 'Heute, 07:15', 'Kilometerstand und Fahrzeugzustand bestätigt.'],
            ['Kontrolle', '18.08.2026, 18:20', 'Innenraum sauber, Materialkiste vollständig.'],
          ].map(([action, date, note]) => (
            <div key={`${action}-${date}`} style={{ padding: '13px 0', borderBottom: `1px solid ${OPC_BRAND.border}` }}>
              <div style={{ fontSize: '14px', fontWeight: 820 }}>{action} · {date}</div>
              <div style={{ marginTop: '5px', color: OPC_BRAND.muted, fontSize: '13px' }}>{note}</div>
            </div>
          ))}
        </SectionCard>
      </div>

      <section id="opc-demo-vehicle-note" style={{ ...opcCardStyle, padding: '20px', marginBottom: '18px' }}>
        <h2 style={{ margin: '0 0 14px', fontSize: '17px', fontWeight: 860, letterSpacing: '-0.035em' }}>Neue Notiz</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr) 160px', gap: '12px', alignItems: 'start' }} className="opc-demo-vehicle-note-grid">
          <select style={opcSelectStyle} defaultValue="general">
            <option value="general">Allgemein</option>
            <option value="damage">Schaden</option>
            <option value="maintenance">Wartung</option>
            <option value="handover">Übergabe</option>
          </select>
          <input placeholder="Notiz zum Fahrzeug, Fahrer, Schaden oder letzter Fahrt" style={opcInputStyle} />
          <button type="button" style={opcBlackButtonStyle}><Save size={16} /> Speichern</button>
        </div>
      </section>

      <SectionCard title="Notizen">
        <div style={{ padding: '13px 0', borderBottom: `1px solid ${OPC_BRAND.border}` }}>
          <div style={{ fontSize: '14px', fontWeight: 820 }}>Allgemein · Heute, 17:44</div>
          <div style={{ marginTop: '5px', color: OPC_BRAND.muted, fontSize: '13px', lineHeight: 1.5 }}>Demo-Seite für Designabgleich vor der AutoAid-Live-Anbindung.</div>
        </div>
      </SectionCard>

      <style>{opcResponsiveStyle}</style>
      <style>{`
        @media (max-width: 980px) {
          .opc-demo-vehicle-grid,
          .opc-demo-vehicle-note-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </OPCPageShell>
  );
}
