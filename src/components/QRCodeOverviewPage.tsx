import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import PortalSkeleton from './shared/PortalSkeleton';
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Plus,
  QrCode,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  OPCPageShell,
  OPCTabs,
  OPC_BRAND,
  OPC_PAGE_FONT,
} from './opc/OPCPageTop';
import { readOpcPageCache, writeOpcPageCache } from '../lib/opc-page-cache';

type SiteOption = {
  id: string;
  client_id: string | null;
  label: string;
  raw?: Record<string, any>;
};

type FacilityOption = {
  id: string;
  client_id: string | null;
  site_id: string;
  label: string;
  raw?: Record<string, any>;
};

type QRLink = {
  id: string;
  token: string;
  label: string | null;
  public_title: string | null;
  public_description: string | null;
  is_active: boolean;
  use_count: number;
  last_used_at: string | null;
  created_at: string | null;
  updated_at: string | null;

  client_id: string | null;
  site_id: string | null;
  facility_id: string | null;

  client_label: string;
  site_label: string;
  facility_label: string;

  report_path: string;
};

type ApiResponse = {
  ok: boolean;
  links?: QRLink[];
  sites?: SiteOption[];
  facilities?: FacilityOption[];
  warnings?: string[];
  error?: string;
};

const QR_CODES_CACHE_KEY = 'opc:page-cache:qr-codes';

const qrCardStyle: CSSProperties = {
  background: '#FFFFFF',
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: '20px',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

const qrInputStyle: CSSProperties = {
  width: '100%',
  height: '46px',
  borderRadius: '14px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  outline: 'none',
  padding: '0 12px',
  fontSize: '14px',
  fontWeight: 650,
  fontFamily: OPC_PAGE_FONT,
  boxSizing: 'border-box',
};

const qrInputWithIconStyle: CSSProperties = {
  ...qrInputStyle,
  padding: '0 14px 0 42px',
};

const qrSelectStyle: CSSProperties = {
  width: '100%',
  height: '46px',
  borderRadius: '14px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  outline: 'none',
  padding: '0 12px',
  fontSize: '13px',
  fontWeight: 760,
  fontFamily: OPC_PAGE_FONT,
  boxSizing: 'border-box',
};

const qrSearchIconStyle: CSSProperties = {
  position: 'absolute',
  left: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  color: '#9CA3AF',
  pointerEvents: 'none',
};

const qrBlackButtonStyle: CSSProperties = {
  width: '100%',
  minHeight: '46px',
  borderRadius: '14px',
  border: `1px solid ${OPC_BRAND.black}`,
  background: OPC_BRAND.black,
  color: '#FFFFFF',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '0 12px',
  fontSize: '13px',
  fontWeight: 820,
  fontFamily: OPC_PAGE_FONT,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  cursor: 'pointer',
};

const qrSecondaryButtonStyle: CSSProperties = {
  width: '100%',
  minHeight: '46px',
  borderRadius: '14px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '0 12px',
  fontSize: '13px',
  fontWeight: 820,
  fontFamily: OPC_PAGE_FONT,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  cursor: 'pointer',
};

function QRMetricCard({
  value,
  label,
  icon,
}: {
  value: number;
  label: string;
  icon: ReactNode;
}) {
  return (
    <div className="opc-qr-metric-card" style={qrCardStyle}>
      <div style={{ minWidth: 0 }}>
        <div className="opc-qr-metric-value">{value}</div>
        <div className="opc-qr-metric-label">{label}</div>
      </div>

      <div className="opc-qr-metric-icon">{icon}</div>
    </div>
  );
}

type ActiveTab = 'overview' | 'create';
type ActiveFilter = 'all' | 'active' | 'inactive';
type FacilityMode = 'new' | 'existing';

function formatDate(value: string | null | undefined) {
  if (!value) return 'Noch nicht genutzt';

  try {
    return new Intl.DateTimeFormat('de-CH', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getAppOrigin() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

function buildReportUrl(link: QRLink) {
  const path = link.report_path || `/report/${link.token}`;
  return `${getAppOrigin()}${path}`;
}

function buildQrImageUrl(link: QRLink, download = false) {
  const reportUrl = buildReportUrl(link);
  const filename = link.label || link.facility_label || 'orange-pro-clean-qr-code';

  const params = new URLSearchParams({
    text: reportUrl,
    size: download ? '1200' : '420',
    filename,
  });

  if (download) params.set('download', '1');

  return `/api/opc/qr-code-image?${params.toString()}`;
}

export default function QRCodeOverviewPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  const [links, setLinks] = useState<QRLink[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [facilities, setFacilities] = useState<FacilityOption[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');

  const [facilityMode, setFacilityMode] = useState<FacilityMode>('new');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedFacilityId, setSelectedFacilityId] = useState('');

  const [facilityName, setFacilityName] = useState('');
  const [floor, setFloor] = useState('');
  const [areaType, setAreaType] = useState('');
  const [label, setLabel] = useState('');
  const [publicTitle, setPublicTitle] = useState('Meldung erstellen');
  const [publicDescription, setPublicDescription] = useState(
    'Der Standort wurde automatisch erkannt. Beschreiben Sie kurz, was geprüft werden soll.'
  );

  useEffect(() => {
    const cached = readOpcPageCache<ApiResponse>(QR_CODES_CACHE_KEY);

    if (cached?.ok) {
      setLinks(cached.links || []);
      setSites(cached.sites || []);
      setFacilities(cached.facilities || []);
      setWarnings(cached.warnings || []);
      setLoading(false);
      void loadData({ background: true });
      return;
    }

    void loadData();
  }, []);

  const selectedSite = useMemo(() => {
    return sites.find((site) => site.id === selectedSiteId) || null;
  }, [selectedSiteId, sites]);

  const filteredFacilitiesForSite = useMemo(() => {
    if (!selectedSiteId) return [];
    return facilities.filter((facility) => facility.site_id === selectedSiteId);
  }, [facilities, selectedSiteId]);

  const filteredLinks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return links.filter((link) => {
      const matchesActive =
        activeFilter === 'all' ||
        (activeFilter === 'active' && link.is_active === true) ||
        (activeFilter === 'inactive' && link.is_active !== true);

      if (!matchesActive) return false;

      if (!query) return true;

      return [
        link.label,
        link.client_label,
        link.site_label,
        link.facility_label,
        link.token,
        link.public_title,
        link.public_description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [links, searchQuery, activeFilter]);

  const metrics = useMemo(() => {
    return {
      total: links.length,
      active: links.filter((link) => link.is_active === true).length,
      used: links.filter((link) => Number(link.use_count || 0) > 0).length,
      scans: links.reduce((sum, link) => sum + Number(link.use_count || 0), 0),
    };
  }, [links]);

  async function loadData(options: { background?: boolean } = {}) {
    const isBackground = Boolean(options.background);

    try {
      if (!isBackground) setLoading(true);
      setErrorMessage('');

      const response = await fetch('/api/opc/qr-codes', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        credentials: 'same-origin',
      });

      const result = (await response.json()) as ApiResponse;

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'QR-Codes konnten nicht geladen werden.');
      }

      setLinks(result.links || []);
      setSites(result.sites || []);
      setFacilities(result.facilities || []);
      setWarnings(result.warnings || []);

      writeOpcPageCache<ApiResponse>(QR_CODES_CACHE_KEY, {
        ok: true,
        links: result.links || [],
        sites: result.sites || [],
        facilities: result.facilities || [],
        warnings: result.warnings || [],
      });
    } catch (error: any) {
      console.error('QR-Codes konnten nicht geladen werden:', error);
      setErrorMessage(error?.message || 'QR-Codes konnten nicht geladen werden.');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }

  function resetForm() {
    setFacilityMode('new');
    setSelectedSiteId('');
    setSelectedFacilityId('');
    setFacilityName('');
    setFloor('');
    setAreaType('');
    setLabel('');
    setPublicTitle('Meldung erstellen');
    setPublicDescription(
      'Der Standort wurde automatisch erkannt. Beschreiben Sie kurz, was geprüft werden soll.'
    );
  }

  async function createQrCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setCreating(true);
      setErrorMessage('');
      setSuccessMessage('');

      if (!selectedSiteId) {
        throw new Error('Bitte Standort auswählen.');
      }

      if (facilityMode === 'existing' && !selectedFacilityId) {
        throw new Error('Bitte bestehende Facility auswählen.');
      }

      if (facilityMode === 'new' && !facilityName.trim()) {
        throw new Error('Bitte Facility / Bereich eintragen.');
      }

      const response = await fetch('/api/opc/qr-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          site_id: selectedSiteId,
          client_id: selectedSite?.client_id || null,
          facility_id: facilityMode === 'existing' ? selectedFacilityId : null,
          facility_name: facilityMode === 'new' ? facilityName.trim() : null,
          floor: floor.trim() || null,
          area_type: areaType.trim() || null,
          label: label.trim() || facilityName.trim() || 'QR-Code',
          public_title: publicTitle.trim() || 'Meldung erstellen',
          public_description:
            publicDescription.trim() ||
            'Der Standort wurde automatisch erkannt. Beschreiben Sie kurz, was geprüft werden soll.',
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'QR-Code konnte nicht erstellt werden.');
      }

      setSuccessMessage('QR-Code wurde erstellt.');
      resetForm();
      setActiveTab('overview');
      await loadData({ background: true });
    } catch (error: any) {
      console.error('QR-Code konnte nicht erstellt werden:', error);
      setErrorMessage(error?.message || 'QR-Code konnte nicht erstellt werden.');
    } finally {
      setCreating(false);
    }
  }

  async function copyReportUrl(link: QRLink) {
    try {
      await navigator.clipboard.writeText(buildReportUrl(link));
      setSuccessMessage('Landing Page Link wurde kopiert.');
    } catch {
      setErrorMessage('Link konnte nicht kopiert werden.');
    }
  }

  if (loading) {
    return <PortalSkeleton variant="cards" />;
  }

  return (
    <OPCPageShell>
      <OPCTabs
        tabs={[
          {
            key: 'overview',
            label: 'QR-Codes',
            active: activeTab === 'overview',
            onClick: () => setActiveTab('overview'),
          },
          {
            key: 'create',
            label: 'QR-Code erstellen',
            active: activeTab === 'create',
            onClick: () => setActiveTab('create'),
          },
        ]}
      />

      <div className="opc-qr-metrics">
        <QRMetricCard value={metrics.total} label="QR-Codes" icon={<QrCode size={18} />} />
        <QRMetricCard value={metrics.active} label="Aktiv" icon={<CheckCircle2 size={18} />} />
        <QRMetricCard value={metrics.used} label="Genutzt" icon={<ExternalLink size={18} />} />
        <QRMetricCard value={metrics.scans} label="Scans gesamt" icon={<RefreshCw size={18} />} />
      </div>

      {warnings.length > 0 && (
        <div style={warningStyle}>
          {warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      )}

      {errorMessage && <div style={errorStyle}>{errorMessage}</div>}

      {successMessage && <div style={successStyle}>{successMessage}</div>}

      {activeTab === 'overview' ? (
        <>
          <section className="opc-qr-filter-panel" style={qrCardStyle}>
            <div className="opc-qr-search">
              <Search size={17} style={qrSearchIconStyle} />

              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="QR-Codes suchen..."
                style={qrInputWithIconStyle}
              />
            </div>

            <div className="opc-qr-filter-row">
              <select
                value={activeFilter}
                onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}
                style={qrSelectStyle}
              >
                <option value="all">Alle QR-Codes</option>
                <option value="active">Nur aktiv</option>
                <option value="inactive">Nur inaktiv</option>
              </select>

              <button
                type="button"
                onClick={() => setActiveTab('create')}
                style={qrBlackButtonStyle}
              >
                <Plus size={17} />
                QR-Code erstellen
              </button>
            </div>
          </section>

          {filteredLinks.length === 0 ? (
            <div className="opc-qr-empty-card" style={qrCardStyle}>
              <QrCode size={24} />
              <strong>Keine QR-Codes vorhanden.</strong>
              <span>Erstelle den ersten QR-Code für einen Standort oder eine Facility.</span>
            </div>
          ) : (
            <div className="opc-qr-list">
              {filteredLinks.map((link) => (
                <article key={link.id} className="opc-qr-card" style={qrCardStyle}>
                  <div className="opc-qr-card-main">
                    <img
                      src={buildQrImageUrl(link)}
                      alt={link.label || link.facility_label || 'QR-Code'}
                      className="opc-qr-card-image"
                    />

                    <div className="opc-qr-card-content">
                      <h3>{link.label || link.facility_label || 'QR-Code'}</h3>
                      <p className="opc-qr-token">{link.token}</p>

                      <div className="opc-qr-meta">
                        <span>{link.site_label || 'Ohne Standort'}</span>
                        <span>{link.facility_label || 'Keine Facility'}</span>
                        <span>Nutzung: {link.use_count || 0}x</span>
                        <span>Zuletzt: {formatDate(link.last_used_at)}</span>
                      </div>
                    </div>

                    <div className="opc-qr-card-side">
                      <span className="opc-qr-use-pill">{link.is_active ? 'Aktiv' : 'Inaktiv'}</span>
                      <span>{link.use_count || 0} Scans</span>
                    </div>
                  </div>

                  <div className="opc-qr-card-actions">
                    <button
                      type="button"
                      onClick={() =>
                        window.open(buildReportUrl(link), '_blank', 'noopener,noreferrer')
                      }
                      className="opc-qr-action dark"
                    >
                      <ExternalLink size={15} />
                      Testen
                    </button>

                    <button
                      type="button"
                      onClick={() => copyReportUrl(link)}
                      className="opc-qr-action"
                    >
                      <Copy size={15} />
                      Link kopieren
                    </button>

                    <a href={buildQrImageUrl(link, true)} className="opc-qr-action">
                      <Download size={15} />
                      QR herunterladen
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}

          {filteredLinks.length > 0 && (
            <div style={countStyle}>
              {filteredLinks.length} von {links.length} QR-Codes
            </div>
          )}
        </>
      ) : (
        <section className="opc-qr-form-card" style={formCardStyle}>
          <form onSubmit={createQrCode}>
            <div style={formGridTwoStyle}>
              <label style={labelStyle}>
                Standort
                <select
                  value={selectedSiteId}
                  onChange={(event) => {
                    setSelectedSiteId(event.target.value);
                    setSelectedFacilityId('');
                  }}
                  style={qrSelectStyle}
                  required
                >
                  <option value="">Standort auswählen</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={labelStyle}>
                Interner QR-Name
                <input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="z. B. WC Herren EG"
                  style={qrInputStyle}
                />
              </label>
            </div>

            <div style={toggleRowStyle}>
              <button
                type="button"
                onClick={() => setFacilityMode('new')}
                style={{
                  ...toggleButtonStyle,
                  ...(facilityMode === 'new' ? toggleButtonActiveStyle : {}),
                }}
              >
                Neue Facility
              </button>

              <button
                type="button"
                onClick={() => setFacilityMode('existing')}
                style={{
                  ...toggleButtonStyle,
                  ...(facilityMode === 'existing' ? toggleButtonActiveStyle : {}),
                }}
              >
                Bestehende Facility
              </button>
            </div>

            {facilityMode === 'existing' ? (
              <label style={{ ...labelStyle, marginBottom: 14 }}>
                Facility auswählen
                <select
                  value={selectedFacilityId}
                  onChange={(event) => setSelectedFacilityId(event.target.value)}
                  style={qrSelectStyle}
                  required
                  disabled={!selectedSiteId}
                >
                  <option value="">
                    {selectedSiteId ? 'Facility auswählen' : 'Zuerst Standort auswählen'}
                  </option>

                  {filteredFacilitiesForSite.map((facility) => (
                    <option key={facility.id} value={facility.id}>
                      {facility.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div style={formGridThreeStyle}>
                <label style={labelStyle}>
                  Facility / Bereich
                  <input
                    value={facilityName}
                    onChange={(event) => setFacilityName(event.target.value)}
                    placeholder="z. B. WC Herren, Eingang, Treppenhaus"
                    style={qrInputStyle}
                    required={facilityMode === 'new'}
                  />
                </label>

                <label style={labelStyle}>
                  Stockwerk
                  <input
                    value={floor}
                    onChange={(event) => setFloor(event.target.value)}
                    placeholder="z. B. EG"
                    style={qrInputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  Bereichstyp
                  <input
                    value={areaType}
                    onChange={(event) => setAreaType(event.target.value)}
                    placeholder="z. B. WC"
                    style={qrInputStyle}
                  />
                </label>
              </div>
            )}

            <div style={formGridTwoStyle}>
              <label style={labelStyle}>
                Landing-Page Titel
                <input
                  value={publicTitle}
                  onChange={(event) => setPublicTitle(event.target.value)}
                  placeholder="Meldung erstellen"
                  style={qrInputStyle}
                />
              </label>

              <label style={labelStyle}>
                Landing-Page Beschreibung
                <input
                  value={publicDescription}
                  onChange={(event) => setPublicDescription(event.target.value)}
                  placeholder="Kurze Beschreibung für die öffentliche Meldeseite"
                  style={qrInputStyle}
                />
              </label>
            </div>

            <div style={formActionsStyle}>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setActiveTab('overview');
                }}
                style={qrSecondaryButtonStyle}
                disabled={creating}
              >
                Abbrechen
              </button>

              <button
                type="submit"
                style={qrBlackButtonStyle}
                disabled={creating}
              >
                {creating ? <Loader2 size={17} className="spin" /> : <QrCode size={17} />}
                {creating ? 'Wird erstellt...' : 'QR-Code erstellen'}
              </button>
            </div>
          </form>
        </section>
      )}

      <style>{spinStyle}</style>
    </OPCPageShell>
  );
}


const warningStyle: CSSProperties = {
  marginBottom: '14px',
  padding: '14px 16px',
  borderRadius: '14px',
  border: '1px solid #FDBA74',
  background: '#FFF7ED',
  color: '#9A3412',
  fontSize: '13px',
  fontWeight: 620,
  display: 'grid',
  gap: '6px',
};

const errorStyle: CSSProperties = {
  marginBottom: '14px',
  padding: '14px 16px',
  borderRadius: '14px',
  border: '1px solid #FCA5A5',
  background: '#FEF2F2',
  color: '#991B1B',
  fontSize: '14px',
  fontWeight: 620,
};

const successStyle: CSSProperties = {
  marginBottom: '14px',
  padding: '14px 16px',
  borderRadius: '14px',
  border: '1px solid #BBF7D0',
  background: '#F0FDF4',
  color: OPC_BRAND.green,
  fontSize: '14px',
  fontWeight: 650,
};

const emptyStyle: CSSProperties = {
  minHeight: '180px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  gap: '10px',
  padding: '34px',
  color: OPC_BRAND.muted,
  textAlign: 'center',
  fontFamily: OPC_PAGE_FONT,
};

const desktopRowStyle: CSSProperties = {
  width: '100%',
  display: 'grid',
  gridTemplateColumns: '82px minmax(200px, 0.9fr) minmax(240px, 1.2fr) 72px 140px 210px',
  alignItems: 'center',
  gap: '16px',
  padding: '18px 20px',
  background: '#FFFFFF',
  fontFamily: OPC_PAGE_FONT,
};

const qrImageStyle: CSSProperties = {
  width: '64px',
  height: '64px',
  borderRadius: '12px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  objectFit: 'contain',
};

const rowTitleStyle: CSSProperties = {
  fontSize: '14px',
  fontWeight: 820,
  color: OPC_BRAND.text,
  letterSpacing: '-0.015em',
  marginBottom: '7px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const rowSubStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: OPC_BRAND.muted,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const dateStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 760,
  color: OPC_BRAND.text,
  whiteSpace: 'nowrap',
};

const actionWrapStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  justifyContent: 'flex-end',
  alignItems: 'center',
};

const smallBlackButtonStyle: CSSProperties = {
  height: '36px',
  padding: '0 12px',
  borderRadius: '12px',
  border: `1px solid ${OPC_BRAND.black}`,
  background: OPC_BRAND.black,
  color: '#FFFFFF',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '7px',
  fontSize: '12px',
  fontWeight: 760,
  fontFamily: OPC_PAGE_FONT,
  cursor: 'pointer',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
};

const smallSecondaryButtonStyle: CSSProperties = {
  width: '36px',
  height: '36px',
  borderRadius: '12px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
  fontWeight: 760,
  fontFamily: OPC_PAGE_FONT,
  cursor: 'pointer',
  textDecoration: 'none',
  boxSizing: 'border-box',
};

const mobileCardStyle: CSSProperties = {
  width: '100%',
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: '20px',
  background: '#FFFFFF',
  padding: '16px',
  textAlign: 'left',
  fontFamily: OPC_PAGE_FONT,
};

const mobileQrImageStyle: CSSProperties = {
  width: '78px',
  height: '78px',
  borderRadius: '12px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  objectFit: 'contain',
  flexShrink: 0,
};

const mobileTitleStyle: CSSProperties = {
  margin: '0 0 6px',
  fontSize: '15px',
  lineHeight: 1.25,
  fontWeight: 820,
  color: OPC_BRAND.text,
};

const mobileTextStyle: CSSProperties = {
  margin: 0,
  fontSize: '13px',
  fontWeight: 600,
  color: OPC_BRAND.muted,
  wordBreak: 'break-word',
};

const mobileMetaStyle: CSSProperties = {
  display: 'grid',
  gap: '7px',
  fontSize: '13px',
  fontWeight: 560,
  color: OPC_BRAND.muted,
  marginBottom: '12px',
};

const countStyle: CSSProperties = {
  marginTop: '15px',
  fontSize: '13px',
  fontWeight: 620,
  color: OPC_BRAND.muted,
};

const formCardStyle: CSSProperties = {
  ...qrCardStyle,
  padding: '18px',
  marginBottom: '22px',
};

const formGridTwoStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '14px',
  marginBottom: '14px',
};

const formGridThreeStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 160px 200px',
  gap: '14px',
  marginBottom: '14px',
};

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
  fontSize: '13px',
  fontWeight: 760,
  color: OPC_BRAND.text,
};

const toggleRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '8px',
  marginBottom: '14px',
};

const toggleButtonStyle: CSSProperties = {
  height: '46px',
  padding: '0 12px',
  borderRadius: '14px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  fontSize: '13px',
  fontWeight: 760,
  fontFamily: OPC_PAGE_FONT,
  cursor: 'pointer',
};

const toggleButtonActiveStyle: CSSProperties = {
  background: OPC_BRAND.black,
  borderColor: OPC_BRAND.black,
  color: '#FFFFFF',
};

const formActionsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '8px',
};

const spinStyle = `
  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .opc-qr-metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 14px;
  }

  .opc-qr-metric-card {
    min-height: 96px;
    padding: 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }

  .opc-qr-metric-value {
    font-size: 25px;
    line-height: 1;
    font-weight: 820;
    letter-spacing: -0.04em;
    color: ${OPC_BRAND.text};
    margin-bottom: 10px;
  }

  .opc-qr-metric-label {
    font-size: 13px;
    font-weight: 720;
    color: ${OPC_BRAND.muted};
  }

  .opc-qr-metric-icon {
    width: 38px;
    height: 38px;
    border-radius: 13px;
    border: 1px solid ${OPC_BRAND.border};
    background: #FAFAFA;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${OPC_BRAND.black};
    flex-shrink: 0;
  }

  .opc-qr-filter-panel {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    padding: 16px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    align-items: stretch;
    margin-bottom: 18px;
    overflow: visible;
  }

  .opc-qr-search {
    position: relative;
    width: 100%;
    min-width: 0;
  }

  .opc-qr-search input::placeholder {
    color: #9CA3AF;
    font-weight: 700;
  }

  .opc-qr-filter-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    width: 100%;
  }

  .opc-qr-filter-row button,
  .opc-qr-filter-row select,
  .opc-qr-form-card button,
  .opc-qr-form-card input,
  .opc-qr-form-card select {
    min-width: 0;
  }

  .opc-qr-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }

  .opc-qr-empty-card {
    min-height: 180px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 10px;
    padding: 34px;
    color: ${OPC_BRAND.muted};
    text-align: center;
    font-family: ${OPC_PAGE_FONT};
    margin-bottom: 18px;
  }

  .opc-qr-card {
    padding: 18px;
    width: 100%;
  }

  .opc-qr-card-main {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 18px;
    align-items: start;
  }

  .opc-qr-card-image {
    width: 78px;
    height: 78px;
    border-radius: 13px;
    border: 1px solid ${OPC_BRAND.border};
    background: #FFFFFF;
    object-fit: contain;
    flex-shrink: 0;
  }

  .opc-qr-card-content {
    min-width: 0;
  }

  .opc-qr-card h3 {
    margin: 0;
    color: ${OPC_BRAND.text};
    font-size: 20px;
    line-height: 1.18;
    letter-spacing: -0.04em;
    font-weight: 860;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .opc-qr-token {
    margin: 7px 0 0;
    color: ${OPC_BRAND.muted};
    font-size: 13px;
    line-height: 1.35;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .opc-qr-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
    margin-top: 9px;
    color: ${OPC_BRAND.muted};
    font-size: 13px;
    line-height: 1.35;
    font-weight: 650;
  }

  .opc-qr-meta span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .opc-qr-meta span + span::before {
    content: '·';
    margin-right: 14px;
    color: ${OPC_BRAND.muted};
  }

  .opc-qr-card-side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  .opc-qr-card-side > span:last-child {
    color: ${OPC_BRAND.muted};
    font-size: 12px;
    font-weight: 720;
    white-space: nowrap;
  }

  .opc-qr-use-pill {
    min-width: 86px;
    height: 28px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid ${OPC_BRAND.border};
    background: #F9FAFB;
    color: ${OPC_BRAND.text};
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 760;
    white-space: nowrap;
  }

  .opc-qr-card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 16px;
  }

  .opc-qr-action {
    min-height: 42px;
    border-radius: 13px;
    border: 1px solid ${OPC_BRAND.border};
    background: #FFFFFF;
    color: ${OPC_BRAND.text};
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0 14px;
    font-size: 13px;
    font-weight: 760;
    font-family: ${OPC_PAGE_FONT};
    text-decoration: none;
    cursor: pointer;
    white-space: nowrap;
  }

  .opc-qr-action.dark {
    background: ${OPC_BRAND.black};
    border-color: ${OPC_BRAND.black};
    color: #FFFFFF;
  }

  .opc-requests-desktop-table,
  .opc-requests-mobile-cards {
    display: none !important;
  }

  .opc-qr-form-card {
    padding: 18px;
    margin-bottom: 22px;
  }

  .opc-qr-form-card form {
    margin: 0;
  }

  @media (max-width: 980px) {
    form [style*="grid-template-columns: repeat(2"],
    form [style*="grid-template-columns: 1fr 160px 200px"] {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 720px) {
    .opc-qr-metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .opc-qr-metric-card {
      min-height: 86px;
      padding: 15px;
    }

    .opc-qr-metric-value {
      font-size: 23px;
    }

    .opc-qr-metric-label {
      font-size: 12px;
      line-height: 1.2;
    }

    .opc-qr-metric-icon {
      width: 34px;
      height: 34px;
    }

    .opc-qr-filter-panel {
      padding: 14px;
      border-radius: 18px !important;
    }

    .opc-qr-filter-row {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .opc-qr-filter-row button,
    .opc-qr-filter-row select {
      min-height: 46px;
      font-size: 12px !important;
      padding-left: 8px !important;
      padding-right: 8px !important;
    }

    .opc-qr-card {
      padding: 15px;
    }

    .opc-qr-card-main {
      grid-template-columns: auto minmax(0, 1fr);
      gap: 14px;
    }

    .opc-qr-card-side {
      grid-column: 1 / -1;
      align-items: flex-start;
      flex-direction: row;
      flex-wrap: wrap;
    }

    .opc-qr-card h3 {
      font-size: 18px;
    }

    .opc-qr-meta {
      display: grid;
      gap: 7px;
    }

    .opc-qr-meta span + span::before {
      content: none;
      margin: 0;
    }

    .opc-qr-card-actions {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .opc-qr-action {
      width: 100%;
    }
  }

  @media (max-width: 520px) {
    .opc-qr-filter-row {
      grid-template-columns: 1fr;
    }
  }
`;
