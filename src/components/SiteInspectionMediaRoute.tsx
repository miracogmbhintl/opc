import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  Clock3,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import SiteInspectionDetailPage from './SiteInspectionDetailPage';
import MirakaDashboardShell from './MirakaDashboardShell';
import { supabase, type UserProfile, type UserRole } from '../lib/supabase';
import { loadOpcAuthProfile } from '../lib/opc-auth-cache';
import { OPCPageShell, OPCListCard, OPC_BRAND, OPC_PAGE_FONT } from './opc/OPCPageTop';

const API_PATH = '/api/opc/inspection-media';

type MediaRow = {
  id: string;
  inspection_id: string;
  uploaded_by?: string | null;
  file_name?: string | null;
  object_path?: string | null;
  media_type?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  created_at?: string | null;
  preview_url?: string | null;
  can_delete?: boolean;
};

type DeletedMediaRow = {
  media_id: string;
  inspection_id: string;
  uploaded_by?: string | null;
  file_name?: string | null;
  object_path?: string | null;
  media_type?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_by_role?: string | null;
  deleted_by_name?: string | null;
  delete_reason?: string | null;
  restore_until?: string | null;
  preview_url?: string | null;
  can_restore?: boolean;
};

type AuditRow = {
  id: string;
  media_id?: string | null;
  action: string;
  actor_user_id?: string | null;
  actor_role?: string | null;
  actor_display_name?: string | null;
  reason?: string | null;
  media_snapshot?: Record<string, any> | null;
  created_at?: string | null;
};

type InspectionSummary = {
  id: string;
  inspection_number?: string | null;
  status?: string | null;
  requested_service_category?: string | null;
  scheduled_at?: string | null;
  address?: string | null;
};

type MediaPayload = {
  actor: {
    id: string;
    role: UserRole;
    display_name?: string | null;
  };
  inspection: InspectionSummary;
  media: MediaRow[];
  deleted: DeletedMediaRow[];
  audit: AuditRow[];
};

type MediaPanelProps = {
  inspectionId: string;
  role: UserRole;
  employeeMode?: boolean;
};

function normalizeRole(value: unknown): UserRole {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'owner' || role === 'godmode') return 'owner';
  if (role === 'admin') return 'admin';
  if (['dispatch', 'dispatcher', 'disposition'].includes(role)) return 'dispatch';
  if (['employee', 'mitarbeiter', 'staff'].includes(role)) return 'employee';
  return 'client';
}

async function getAccessToken() {
  if (!supabase) throw new Error('Supabase ist nicht verfügbar.');

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Die Sitzung ist abgelaufen. Bitte neu anmelden.');
  }

  return session.access_token;
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const accessToken = await getAccessToken();
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `Anfrage fehlgeschlagen (${response.status}).`);
  }

  return payload;
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('de-CH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatFileSize(value?: number | null) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function daysRemaining(value?: string | null) {
  if (!value) return 0;
  const end = new Date(value).getTime();
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000)));
}

function fileNameFromSnapshot(row: AuditRow) {
  return String(
    row.media_snapshot?.file_name ||
      row.media_snapshot?.object_path ||
      row.media_id ||
      'Bild',
  );
}

function actionLabel(value: string) {
  const labels: Record<string, string> = {
    uploaded: 'Hochgeladen',
    deleted: 'Gelöscht',
    restored: 'Wiederhergestellt',
    permanently_deleted: 'Endgültig gelöscht',
  };
  return labels[value] || value;
}

function roleLabel(value?: string | null) {
  const labels: Record<string, string> = {
    owner: 'Owner',
    admin: 'Admin',
    dispatch: 'Disposition',
    employee: 'Mitarbeiter',
  };
  return labels[String(value || '').toLowerCase()] || String(value || 'Unbekannt');
}

function MediaPreview({ row }: { row: MediaRow | DeletedMediaRow }) {
  const type = String(row.media_type || 'image');

  return (
    <a
      href={row.preview_url || '#'}
      target="_blank"
      rel="noreferrer"
      style={previewLinkStyle}
      onClick={(event) => {
        if (!row.preview_url) event.preventDefault();
      }}
    >
      <div style={previewStyle}>
        {type === 'image' && row.preview_url ? (
          <img src={row.preview_url} alt={row.file_name || 'Besichtigungsbild'} style={previewImageStyle} loading="lazy" />
        ) : type === 'video' && row.preview_url ? (
          <video src={row.preview_url} style={previewImageStyle} muted playsInline preload="metadata" />
        ) : type === 'document' ? (
          <FileText size={24} />
        ) : type === 'image' ? (
          <ImageIcon size={24} />
        ) : (
          <Camera size={24} />
        )}
      </div>
    </a>
  );
}

function InspectionMediaPanel({ inspectionId, role, employeeMode = false }: MediaPanelProps) {
  const [payload, setPayload] = useState<MediaPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [workingId, setWorkingId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isOwner = role === 'owner';
  const isAdmin = role === 'admin';
  const canSeeAudit = isOwner || isAdmin;

  useEffect(() => {
    void loadMedia();
  }, [inspectionId]);

  async function loadMedia() {
    setLoading(true);
    setErrorMessage('');

    try {
      const result = await apiFetch(`${API_PATH}?inspection_id=${encodeURIComponent(inspectionId)}`);
      setPayload(result as MediaPayload);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Besichtigungsmedien konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length) return;

    setUploading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const body = new FormData();
      body.set('inspection_id', inspectionId);
      Array.from(fileList).forEach((file) => body.append('files', file));

      const result = await apiFetch(API_PATH, {
        method: 'POST',
        body,
      });

      setSuccessMessage(`${result.uploaded_count || fileList.length} Datei(en) wurden hochgeladen.`);
      await loadMedia();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Upload fehlgeschlagen.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function deleteMedia(row: MediaRow) {
    const confirmed = window.confirm(
      `Soll „${row.file_name || 'dieses Bild'}“ wirklich aus der Besichtigung entfernt werden?\n\nNur ein Owner kann es innerhalb von 30 Tagen wiederherstellen.`,
    );
    if (!confirmed) return;

    const reason = window.prompt('Löschgrund (optional):', '') || '';
    setWorkingId(row.id);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await apiFetch(API_PATH, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_id: row.id, reason }),
      });

      setSuccessMessage('Das Bild wurde aus der Besichtigung entfernt.');
      await loadMedia();
      window.dispatchEvent(new CustomEvent('opc:inspection-media-changed'));
      if (!employeeMode) window.setTimeout(() => window.location.reload(), 250);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Bild konnte nicht gelöscht werden.');
    } finally {
      setWorkingId('');
    }
  }

  async function restoreMedia(row: DeletedMediaRow) {
    const confirmed = window.confirm(
      `Soll „${row.file_name || 'dieses Bild'}“ wieder in die Besichtigung eingesetzt werden?`,
    );
    if (!confirmed) return;

    setWorkingId(row.media_id);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await apiFetch(API_PATH, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_id: row.media_id }),
      });

      setSuccessMessage('Das Bild wurde wiederhergestellt.');
      await loadMedia();
      window.dispatchEvent(new CustomEvent('opc:inspection-media-changed'));
      if (!employeeMode) window.setTimeout(() => window.location.reload(), 250);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Bild konnte nicht wiederhergestellt werden.');
    } finally {
      setWorkingId('');
    }
  }

  const inspectionTitle = useMemo(() => {
    const inspection = payload?.inspection;
    if (!inspection) return 'Besichtigungsbilder';

    return [
      inspection.inspection_number,
      inspection.requested_service_category,
    ].filter(Boolean).join(' · ') || 'Besichtigungsbilder';
  }, [payload]);

  if (loading) {
    return <div style={emptyStyle}>Bilder und Löschprotokoll werden geladen.</div>;
  }

  return (
    <div style={panelStackStyle}>
      {employeeMode && payload?.inspection ? (
        <section style={employeeHeroStyle}>
          <div>
            <p style={eyebrowStyle}>Besichtigung</p>
            <h1 style={employeeTitleStyle}>{inspectionTitle}</h1>
            <p style={employeeSubtitleStyle}>
              {[payload.inspection.address, payload.inspection.scheduled_at ? formatDateTime(payload.inspection.scheduled_at) : '']
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <span style={roleBadgeStyle}>Mitarbeiter · Medienzugriff</span>
        </section>
      ) : null}

      {successMessage ? <div style={successStyle}>{successMessage}</div> : null}
      {errorMessage ? <div style={errorStyle}>{errorMessage}</div> : null}

      {employeeMode ? (
        <OPCListCard>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Bilder & Dateien</h2>
              <p style={sectionDescriptionStyle}>
                Eigene falsch hochgeladene Bilder können entfernt werden. Fremde Bilder bleiben geschützt.
              </p>
            </div>
            <label style={primaryButtonStyle}>
              <UploadCloud size={16} />
              {uploading ? 'Upload läuft...' : 'Medien hochladen'}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,application/pdf"
                disabled={uploading}
                onChange={(event) => void uploadFiles(event.target.files)}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          <MediaGrid
            rows={payload?.media || []}
            workingId={workingId}
            onDelete={deleteMedia}
            emptyText="Noch keine Medien für diese Besichtigung."
          />
        </OPCListCard>
      ) : null}

      {isOwner ? (
        <OPCListCard>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Aktive Medien verwalten</h2>
              <p style={sectionDescriptionStyle}>
                Owner können jedes Bild entfernen. Die Datei bleibt während 30 Tagen wiederherstellbar.
              </p>
            </div>
            <button type="button" style={secondaryButtonStyle} onClick={() => void loadMedia()}>
              <RefreshCw size={15} />
              Aktualisieren
            </button>
          </div>

          <MediaGrid
            rows={payload?.media || []}
            workingId={workingId}
            onDelete={deleteMedia}
            emptyText="Keine aktiven Medien vorhanden."
          />
        </OPCListCard>
      ) : null}

      {canSeeAudit ? (
        <OPCListCard>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Gelöschte Bilder & Löschprotokoll</h2>
              <p style={sectionDescriptionStyle}>
                Admins sehen, wer was gelöscht hat. Nur Owner können innerhalb von 30 Tagen wiederherstellen.
              </p>
            </div>
            <div style={securityBadgeStyle}>
              <ShieldCheck size={16} />
              {isOwner ? 'Owner-Wiederherstellung aktiv' : 'Audit-Ansicht'}
            </div>
          </div>

          <div style={deletedSectionStyle}>
            {(payload?.deleted || []).length === 0 ? (
              <div style={emptyStyle}>Keine gelöschten Medien vorhanden.</div>
            ) : (
              <div style={mediaGridStyle}>
                {(payload?.deleted || []).map((row) => {
                  const remaining = daysRemaining(row.restore_until);

                  return (
                    <article key={row.media_id} style={deletedCardStyle}>
                      <MediaPreview row={row} />
                      <div style={cardBodyStyle}>
                        <strong style={fileNameStyle}>{row.file_name || row.object_path || 'Bild'}</strong>
                        <span style={metaStyle}>Gelöscht: {formatDateTime(row.deleted_at)}</span>
                        <span style={metaStyle}>
                          Von: {row.deleted_by_name || 'Unbekannt'} · {roleLabel(row.deleted_by_role)}
                        </span>
                        {row.delete_reason ? <span style={reasonStyle}>Grund: {row.delete_reason}</span> : null}
                        <span style={remaining > 0 ? restoreWindowStyle : expiredStyle}>
                          <Clock3 size={14} />
                          {remaining > 0
                            ? `${remaining} Tag(e) wiederherstellbar`
                            : 'Wiederherstellungsfrist abgelaufen'}
                        </span>

                        {isOwner ? (
                          <button
                            type="button"
                            disabled={!row.can_restore || workingId === row.media_id}
                            style={{
                              ...restoreButtonStyle,
                              opacity: row.can_restore ? 1 : 0.45,
                              cursor: row.can_restore ? 'pointer' : 'not-allowed',
                            }}
                            onClick={() => void restoreMedia(row)}
                          >
                            <RotateCcw size={15} />
                            {workingId === row.media_id ? 'Wird wiederhergestellt...' : 'Wiederherstellen'}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div style={auditWrapStyle}>
            <h3 style={auditTitleStyle}>Aktivitätsprotokoll</h3>
            {(payload?.audit || []).length === 0 ? (
              <div style={emptyStyle}>Noch keine protokollierten Löschvorgänge.</div>
            ) : (
              <div style={auditListStyle}>
                {(payload?.audit || []).map((row) => (
                  <div key={row.id} style={auditRowStyle}>
                    <div style={{ minWidth: 0 }}>
                      <strong style={auditActionStyle}>{actionLabel(row.action)} · {fileNameFromSnapshot(row)}</strong>
                      <span style={auditMetaStyle}>
                        {row.actor_display_name || 'Unbekannt'} · {roleLabel(row.actor_role)} · {formatDateTime(row.created_at)}
                      </span>
                      {row.reason ? <span style={auditReasonStyle}>Grund: {row.reason}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </OPCListCard>
      ) : null}
    </div>
  );
}

function MediaGrid({
  rows,
  workingId,
  onDelete,
  emptyText,
}: {
  rows: MediaRow[];
  workingId: string;
  onDelete: (row: MediaRow) => void;
  emptyText: string;
}) {
  if (!rows.length) return <div style={emptyStyle}>{emptyText}</div>;

  return (
    <div style={mediaGridStyle}>
      {rows.map((row) => (
        <article key={row.id} style={mediaCardStyle}>
          <MediaPreview row={row} />
          <div style={cardBodyStyle}>
            <strong style={fileNameStyle}>{row.file_name || row.object_path || 'Bild'}</strong>
            <span style={metaStyle}>
              {[formatFileSize(row.file_size_bytes), row.created_at ? formatDateTime(row.created_at) : '']
                .filter(Boolean)
                .join(' · ')}
            </span>

            {row.can_delete ? (
              <button
                type="button"
                disabled={workingId === row.id}
                style={deleteButtonStyle}
                onClick={() => onDelete(row)}
              >
                <Trash2 size={15} />
                {workingId === row.id ? 'Wird entfernt...' : 'Bild löschen'}
              </button>
            ) : (
              <span style={protectedStyle}>Nur eigener Upload löschbar</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function EmployeeInspectionMediaPage({ inspectionId }: { inspectionId: string }) {
  return (
    <MirakaDashboardShell requiredRole="employee" currentPath={`/besichtigung/${inspectionId}`} fullWidth hideTopBar>
      <OPCPageShell>
        <InspectionMediaPanel inspectionId={inspectionId} role="employee" employeeMode />
      </OPCPageShell>
    </MirakaDashboardShell>
  );
}

function InspectionMediaAuditPortal({ inspectionId, role }: { inspectionId: string; role: UserRole }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let mounted = true;
    let portalNode: HTMLDivElement | null = null;

    const attach = () => {
      if (!mounted || portalNode) return Boolean(portalNode);

      const mediaHeader = document.querySelector('.opc-inspection-media-header');
      const mediaSection = mediaHeader?.closest('section');
      const dashboardContent = document.querySelector('.miraka-dashboard-content');
      const parent = mediaSection?.parentElement || dashboardContent;

      if (!parent) return false;

      portalNode = document.createElement('div');
      portalNode.dataset.opcInspectionMediaAudit = 'true';
      portalNode.style.marginTop = '22px';

      if (mediaSection?.parentElement) {
        mediaSection.insertAdjacentElement('afterend', portalNode);
      } else {
        parent.appendChild(portalNode);
      }

      setTarget(portalNode);
      return true;
    };

    if (!attach()) {
      const observer = new MutationObserver(() => {
        if (attach()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });

      const timeout = window.setTimeout(() => observer.disconnect(), 10_000);

      return () => {
        mounted = false;
        window.clearTimeout(timeout);
        observer.disconnect();
        portalNode?.remove();
      };
    }

    return () => {
      mounted = false;
      portalNode?.remove();
    };
  }, [inspectionId]);

  if (!target) return null;
  return createPortal(<InspectionMediaPanel inspectionId={inspectionId} role={role} />, target);
}

export default function SiteInspectionMediaRoute({ inspectionId }: { inspectionId: string }) {
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);

  useEffect(() => {
    let active = true;

    void loadOpcAuthProfile()
      .then((result) => {
        if (active) setProfile(result);
      })
      .catch(() => {
        if (active) setProfile(null);
      });

    return () => {
      active = false;
    };
  }, []);

  if (profile === undefined) {
    return <div style={routeLoadingStyle}>Besichtigung wird geladen.</div>;
  }

  const role = normalizeRole(profile?.role);
  const isNew = inspectionId === 'neu' || inspectionId === 'new';

  if (role === 'employee' && !isNew) {
    return <EmployeeInspectionMediaPage inspectionId={inspectionId} />;
  }

  return (
    <>
      <SiteInspectionDetailPage inspectionId={inspectionId} />
      {!isNew && (role === 'owner' || role === 'admin') ? (
        <InspectionMediaAuditPortal inspectionId={inspectionId} role={role} />
      ) : null}
    </>
  );
}

const panelStackStyle: CSSProperties = {
  display: 'grid',
  gap: 22,
  fontFamily: OPC_PAGE_FONT,
};

const routeLoadingStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: OPC_PAGE_FONT,
  color: OPC_BRAND.muted,
  fontWeight: 700,
};

const employeeHeroStyle: CSSProperties = {
  background: '#FFFFFF',
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: 20,
  padding: 22,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 18,
};

const eyebrowStyle: CSSProperties = {
  margin: '0 0 7px',
  color: OPC_BRAND.faint,
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const employeeTitleStyle: CSSProperties = {
  margin: 0,
  color: OPC_BRAND.text,
  fontSize: 34,
  lineHeight: 1,
  letterSpacing: '-0.05em',
  fontWeight: 880,
};

const employeeSubtitleStyle: CSSProperties = {
  margin: '10px 0 0',
  color: OPC_BRAND.muted,
  fontSize: 14,
  fontWeight: 650,
};

const roleBadgeStyle: CSSProperties = {
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: 999,
  background: '#F9FAFB',
  color: OPC_BRAND.text,
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: 'nowrap',
};

const sectionHeaderStyle: CSSProperties = {
  minHeight: 82,
  padding: '18px 20px',
  borderBottom: `1px solid ${OPC_BRAND.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: OPC_BRAND.text,
  fontSize: 16,
  fontWeight: 840,
  letterSpacing: '-0.02em',
};

const sectionDescriptionStyle: CSSProperties = {
  margin: '5px 0 0',
  color: OPC_BRAND.muted,
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 640,
};

const primaryButtonStyle: CSSProperties = {
  minHeight: 42,
  padding: '0 15px',
  borderRadius: 14,
  border: '1px solid #0F1115',
  background: '#0F1115',
  color: '#FFFFFF',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontSize: 13,
  fontWeight: 820,
  cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: 40,
  padding: '0 14px',
  borderRadius: 13,
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
};

const securityBadgeStyle: CSSProperties = {
  minHeight: 36,
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid #BBF7D0',
  background: '#F0FDF4',
  color: '#166534',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  fontSize: 12,
  fontWeight: 800,
};

const mediaGridStyle: CSSProperties = {
  padding: 20,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
  gap: 14,
};

const mediaCardStyle: CSSProperties = {
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: 16,
  background: '#FAFAFA',
  overflow: 'hidden',
};

const deletedCardStyle: CSSProperties = {
  ...mediaCardStyle,
  background: '#FFFDFB',
};

const previewLinkStyle: CSSProperties = {
  color: 'inherit',
  textDecoration: 'none',
  display: 'block',
};

const previewStyle: CSSProperties = {
  height: 130,
  background: '#FFFFFF',
  borderBottom: `1px solid ${OPC_BRAND.border}`,
  color: OPC_BRAND.muted,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const previewImageStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

const cardBodyStyle: CSSProperties = {
  padding: 13,
  display: 'grid',
  gap: 7,
};

const fileNameStyle: CSSProperties = {
  color: OPC_BRAND.text,
  fontSize: 13,
  fontWeight: 790,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const metaStyle: CSSProperties = {
  color: OPC_BRAND.muted,
  fontSize: 11,
  lineHeight: 1.4,
  fontWeight: 640,
};

const reasonStyle: CSSProperties = {
  color: '#7C2D12',
  background: '#FFF7ED',
  border: '1px solid #FED7AA',
  borderRadius: 10,
  padding: '7px 8px',
  fontSize: 11,
  lineHeight: 1.35,
  fontWeight: 680,
};

const deleteButtonStyle: CSSProperties = {
  marginTop: 4,
  minHeight: 36,
  borderRadius: 11,
  border: '1px solid #FECACA',
  background: '#FEF2F2',
  color: '#991B1B',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
};

const restoreButtonStyle: CSSProperties = {
  marginTop: 4,
  minHeight: 36,
  borderRadius: 11,
  border: '1px solid #BBF7D0',
  background: '#F0FDF4',
  color: '#166534',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  fontSize: 12,
  fontWeight: 800,
};

const protectedStyle: CSSProperties = {
  marginTop: 4,
  color: OPC_BRAND.faint,
  fontSize: 11,
  fontWeight: 680,
};

const deletedSectionStyle: CSSProperties = {
  borderBottom: `1px solid ${OPC_BRAND.border}`,
};

const restoreWindowStyle: CSSProperties = {
  color: '#166534',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
  fontWeight: 760,
};

const expiredStyle: CSSProperties = {
  ...restoreWindowStyle,
  color: '#991B1B',
};

const auditWrapStyle: CSSProperties = {
  padding: 20,
};

const auditTitleStyle: CSSProperties = {
  margin: '0 0 12px',
  color: OPC_BRAND.text,
  fontSize: 14,
  fontWeight: 820,
};

const auditListStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
};

const auditRowStyle: CSSProperties = {
  padding: 12,
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: 13,
  background: '#FAFAFA',
};

const auditActionStyle: CSSProperties = {
  display: 'block',
  color: OPC_BRAND.text,
  fontSize: 12,
  fontWeight: 790,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const auditMetaStyle: CSSProperties = {
  display: 'block',
  marginTop: 4,
  color: OPC_BRAND.muted,
  fontSize: 11,
  fontWeight: 640,
};

const auditReasonStyle: CSSProperties = {
  display: 'block',
  marginTop: 5,
  color: '#7C2D12',
  fontSize: 11,
  fontWeight: 680,
};

const emptyStyle: CSSProperties = {
  padding: 24,
  textAlign: 'center',
  color: OPC_BRAND.muted,
  fontSize: 13,
  fontWeight: 680,
};

const successStyle: CSSProperties = {
  padding: 13,
  borderRadius: 13,
  border: '1px solid #BBF7D0',
  background: '#F0FDF4',
  color: '#166534',
  fontSize: 13,
  fontWeight: 730,
};

const errorStyle: CSSProperties = {
  padding: 13,
  borderRadius: 13,
  border: '1px solid #FECACA',
  background: '#FEF2F2',
  color: '#991B1B',
  fontSize: 13,
  fontWeight: 730,
};
