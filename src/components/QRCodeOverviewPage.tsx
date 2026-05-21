import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Building2,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  MapPin,
  Plus,
  QrCode,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  OPCPageShell,
  OPCTabs,
  OPCMetricsGrid,
  OPCMetricCard,
  OPCToolbar,
  OPCListCard,
  OPC_BRAND,
  OPC_PAGE_FONT,
  opcResponsiveStyle,
  opcSelectStyle,
  opcInputStyle,
  opcInputWithIconStyle,
  opcSearchIconStyle,
  opcBlackButtonStyle,
  opcSecondaryButtonStyle,
  opcCardStyle,
} from './opc/OPCPageTop';

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
    loadData();
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

  async function loadData() {
    try {
      setLoading(true);
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
    } catch (error: any) {
      console.error('QR-Codes konnten nicht geladen werden:', error);
      setErrorMessage(error?.message || 'QR-Codes konnten nicht geladen werden.');
    } finally {
      setLoading(false);
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

  async function createQrCode(event: React.FormEvent<HTMLFormElement>) {
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
      await loadData();
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
    return (
      <div style={loadingStyle}>
        <Loader2 size={20} className="spin" style={{ marginRight: 8 }} />
        QR-Codes werden geladen...
        <style>{spinStyle}</style>
      </div>
    );
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

      <OPCMetricsGrid>
        <OPCMetricCard value={metrics.total} label="QR-Codes" icon={<QrCode size={18} />} />
        <OPCMetricCard
          value={metrics.active}
          label="Aktiv"
          icon={<CheckCircle2 size={18} />}
          tone="success"
        />
        <OPCMetricCard value={metrics.used} label="Genutzt" icon={<ExternalLink size={18} />} />
        <OPCMetricCard value={metrics.scans} label="Scans gesamt" icon={<RefreshCw size={18} />} />
      </OPCMetricsGrid>

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
          <OPCToolbar columns="minmax(0, 1fr) 180px 190px">
            <div style={{ position: 'relative', minWidth: 0 }}>
              <Search size={17} style={opcSearchIconStyle} />

              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Suche nach Standort, Facility, Kunde oder Token"
                style={opcInputWithIconStyle}
              />
            </div>

            <select
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}
              style={opcSelectStyle}
            >
              <option value="all">Alle QR-Codes</option>
              <option value="active">Nur aktiv</option>
              <option value="inactive">Nur inaktiv</option>
            </select>

            <button
              type="button"
              data-opc-wide="true"
              onClick={() => setActiveTab('create')}
              style={opcBlackButtonStyle}
            >
              <Plus size={17} />
              QR-Code erstellen
            </button>
          </OPCToolbar>

          <OPCListCard>
            {filteredLinks.length === 0 ? (
              <div style={emptyStyle}>
                <QrCode size={24} />
                <strong>Keine QR-Codes vorhanden.</strong>
                <span>Erstelle den ersten QR-Code für einen Standort oder eine Facility.</span>
              </div>
            ) : (
              <>
                <div className="opc-requests-desktop-table">
                  {filteredLinks.map((link, index) => (
                    <div
                      key={link.id}
                      style={{
                        ...desktopRowStyle,
                        borderBottom:
                          index < filteredLinks.length - 1 ? '1px solid #F3F4F6' : 'none',
                      }}
                    >
                      <img
                        src={buildQrImageUrl(link)}
                        alt={link.label || link.facility_label || 'QR-Code'}
                        style={qrImageStyle}
                      />

                      <div style={{ minWidth: 0 }}>
                        <div style={rowTitleStyle}>
                          {link.label || link.facility_label || 'QR-Code'}
                        </div>
                        <div style={rowSubStyle}>{link.token}</div>
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={rowTitleStyle}>{link.site_label || 'Ohne Standort'}</div>
                        <div style={rowSubStyle}>{link.facility_label || 'Keine Facility'}</div>
                      </div>

                      <div style={dateStyle}>{link.use_count || 0}x</div>

                      <div style={dateStyle}>{formatDate(link.last_used_at)}</div>

                      <div style={actionWrapStyle}>
                        <button
                          type="button"
                          onClick={() =>
                            window.open(buildReportUrl(link), '_blank', 'noopener,noreferrer')
                          }
                          style={smallBlackButtonStyle}
                        >
                          <ExternalLink size={14} />
                          Testen
                        </button>

                        <button
                          type="button"
                          onClick={() => copyReportUrl(link)}
                          style={smallSecondaryButtonStyle}
                          title="Link kopieren"
                        >
                          <Copy size={14} />
                        </button>

                        <a
                          href={buildQrImageUrl(link, true)}
                          style={smallSecondaryButtonStyle}
                          title="QR herunterladen"
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="opc-requests-mobile-cards">
                  {filteredLinks.map((link) => (
                    <div key={link.id} style={mobileCardStyle}>
                      <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                        <img
                          src={buildQrImageUrl(link)}
                          alt={link.label || link.facility_label || 'QR-Code'}
                          style={mobileQrImageStyle}
                        />

                        <div style={{ minWidth: 0 }}>
                          <h3 style={mobileTitleStyle}>
                            {link.label || link.facility_label || 'QR-Code'}
                          </h3>
                          <p style={mobileTextStyle}>{link.token}</p>
                        </div>
                      </div>

                      <div style={mobileMetaStyle}>
                        <span>{link.site_label || 'Ohne Standort'}</span>
                        <span>{link.facility_label || 'Keine Facility'}</span>
                        <span>Nutzung: {link.use_count || 0}x</span>
                        <span>Zuletzt: {formatDate(link.last_used_at)}</span>
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() =>
                            window.open(buildReportUrl(link), '_blank', 'noopener,noreferrer')
                          }
                          style={smallBlackButtonStyle}
                        >
                          <ExternalLink size={14} />
                          Testen
                        </button>

                        <button
                          type="button"
                          onClick={() => copyReportUrl(link)}
                          style={smallSecondaryButtonStyle}
                        >
                          <Copy size={14} />
                        </button>

                        <a href={buildQrImageUrl(link, true)} style={smallSecondaryButtonStyle}>
                          <Download size={14} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </OPCListCard>

          {filteredLinks.length > 0 && (
            <div style={countStyle}>
              {filteredLinks.length} von {links.length} QR-Codes
            </div>
          )}
        </>
      ) : (
        <section style={formCardStyle}>
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
                  style={opcSelectStyle}
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
                  style={opcInputStyle}
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
                  style={opcSelectStyle}
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
                    style={opcInputStyle}
                    required={facilityMode === 'new'}
                  />
                </label>

                <label style={labelStyle}>
                  Stockwerk
                  <input
                    value={floor}
                    onChange={(event) => setFloor(event.target.value)}
                    placeholder="z. B. EG"
                    style={opcInputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  Bereichstyp
                  <input
                    value={areaType}
                    onChange={(event) => setAreaType(event.target.value)}
                    placeholder="z. B. WC"
                    style={opcInputStyle}
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
                  style={opcInputStyle}
                />
              </label>

              <label style={labelStyle}>
                Landing-Page Beschreibung
                <input
                  value={publicDescription}
                  onChange={(event) => setPublicDescription(event.target.value)}
                  placeholder="Kurze Beschreibung für die öffentliche Meldeseite"
                  style={opcInputStyle}
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
                style={{ ...opcSecondaryButtonStyle, width: 'auto' }}
                disabled={creating}
              >
                Abbrechen
              </button>

              <button
                type="submit"
                style={{ ...opcBlackButtonStyle, width: 'auto' }}
                disabled={creating}
              >
                {creating ? <Loader2 size={17} className="spin" /> : <QrCode size={17} />}
                {creating ? 'Wird erstellt...' : 'QR-Code erstellen'}
              </button>
            </div>
          </form>
        </section>
      )}

      <style>{`${opcResponsiveStyle}${spinStyle}`}</style>
    </OPCPageShell>
  );
}

const loadingStyle: CSSProperties = {
  minHeight: '60vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: OPC_BRAND.muted,
  fontSize: '14px',
  fontWeight: 650,
  fontFamily: OPC_PAGE_FONT,
};

const warningStyle: CSSProperties = {
  marginBottom: '22px',
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
  marginBottom: '22px',
  padding: '14px 16px',
  borderRadius: '14px',
  border: '1px solid #FCA5A5',
  background: '#FEF2F2',
  color: '#991B1B',
  fontSize: '14px',
  fontWeight: 620,
};

const successStyle: CSSProperties = {
  marginBottom: '22px',
  padding: '14px 16px',
  borderRadius: '14px',
  border: '1px solid #BBF7D0',
  background: '#F0FDF4',
  color: OPC_BRAND.green,
  fontSize: '14px',
  fontWeight: 650,
};

const emptyStyle: CSSProperties = {
  minHeight: '220px',
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
  gridTemplateColumns: '92px minmax(220px, 0.9fr) minmax(260px, 1.2fr) 80px 150px 220px',
  alignItems: 'center',
  gap: '20px',
  padding: '20px 22px',
  background: '#FFFFFF',
  fontFamily: OPC_PAGE_FONT,
};

const qrImageStyle: CSSProperties = {
  width: '70px',
  height: '70px',
  borderRadius: '12px',
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  objectFit: 'contain',
};

const rowTitleStyle: CSSProperties = {
  fontSize: '15px',
  fontWeight: 800,
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
  height: '34px',
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
  width: '34px',
  height: '34px',
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
  borderRadius: '18px',
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
  ...opcCardStyle,
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
  gridTemplateColumns: '1fr 160px 200px',
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
  display: 'flex',
  gap: '10px',
  marginBottom: '14px',
};

const toggleButtonStyle: CSSProperties = {
  height: '40px',
  padding: '0 16px',
  borderRadius: '999px',
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
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '10px',
};

const spinStyle = `
  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (max-width: 980px) {
    form [style*="grid-template-columns: repeat(2"] {
      grid-template-columns: 1fr !important;
    }
  }
`;