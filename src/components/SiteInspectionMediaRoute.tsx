import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  FileText,
  Image as ImageIcon,
  UploadCloud,
  X,
} from 'lucide-react';
import SiteInspectionDetailPage from './SiteInspectionDetailPage';
import MirakaDashboardShell from './MirakaDashboardShell';
import { supabase, type UserProfile, type UserRole } from '../lib/supabase';
import { loadOpcAuthProfile } from '../lib/opc-auth-cache';
import { inspectionMediaApiFetch, uploadInspectionMediaFiles } from '../lib/opc-inspection-media-client';
import {
  OPCPageShell,
  OPCListCard,
  OPC_BRAND,
  OPC_PAGE_FONT,
} from './opc/OPCPageTop';

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
  sort_order?: number | null;
  created_at?: string | null;
  preview_url?: string | null;
  can_delete?: boolean;
};

type InspectionSummary = {
  id: string;
  inspection_number?: string | null;
  requested_service_category?: string | null;
  scheduled_at?: string | null;
  address?: string | null;
};

type MediaPayload = {
  inspection: InspectionSummary;
  media: MediaRow[];
};

function normalizeRole(value: unknown): UserRole {
  const role = String(value || '').trim().toLowerCase();

  if (role === 'owner' || role === 'godmode') return 'owner';
  if (role === 'admin') return 'admin';
  if (['dispatch', 'dispatcher', 'disposition'].includes(role)) return 'dispatch';
  if (['employee', 'mitarbeiter', 'staff'].includes(role)) return 'employee';

  return 'client';
}

async function apiFetch(
  path: string,
  init: RequestInit = {},
) {
  return inspectionMediaApiFetch(
    path,
    init,
    {
      attempts: 3,
      timeoutMs:
        init.method === 'POST'
          ? 120000
          : 30000,
    },
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('de-CH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function MediaPreview({ row }: { row: MediaRow }) {
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
          <img
            src={row.preview_url}
            alt={row.file_name || 'Besichtigungsbild'}
            style={previewImageStyle}
            loading="lazy"
          />
        ) : type === 'video' && row.preview_url ? (
          <video
            src={row.preview_url}
            style={previewImageStyle}
            muted
            playsInline
            preload="metadata"
          />
        ) : type === 'document' ? (
          <FileText size={24} />
        ) : type === 'image' ? (
          <ImageIcon size={24} />
        ) : (
          <Camera size={24} />
        )}
      </div>
      <div style={fileNameStyle}>{row.file_name || row.object_path || 'Bild'}</div>
    </a>
  );
}

function InlineDeleteButton({
  busy,
  onDelete,
}: {
  busy: boolean;
  onDelete: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="Bild löschen"
      title="Bild löschen"
      disabled={busy}
      style={{
        ...inlineDeleteButtonStyle,
        opacity: busy ? 0.58 : 1,
        cursor: busy ? 'wait' : 'pointer',
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDelete();
      }}
    >
      {busy ? <span style={busyDotStyle}>…</span> : <X size={15} strokeWidth={2.4} />}
    </button>
  );
}

function EmployeeInspectionMediaPage({ inspectionId }: { inspectionId: string }) {
  const [payload, setPayload] = useState<MediaPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [workingId, setWorkingId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;

    void apiFetch(`${API_PATH}?inspection_id=${encodeURIComponent(inspectionId)}`)
      .then((result) => {
        if (active) setPayload(result as MediaPayload);
      })
      .catch((error: any) => {
        if (active) {
          setErrorMessage(
            error?.message || 'Besichtigungsmedien konnten nicht geladen werden.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [inspectionId]);

  async function reloadMedia() {
    const result = await apiFetch(
      `${API_PATH}?inspection_id=${encodeURIComponent(inspectionId)}`,
    );
    setPayload(result as MediaPayload);
  }

  async function uploadFiles(
    fileList: FileList | null,
  ) {
    if (!fileList?.length) return;

    setUploading(true);
    setErrorMessage('');

    try {
      const files = Array.from(fileList);

      const {
        failedFiles,
      } = await uploadInspectionMediaFiles(
        inspectionId,
        files,
      );

      await reloadMedia();

      if (failedFiles.length > 0) {
        setErrorMessage(
          `${failedFiles.length} von ${files.length} Medien konnten nicht hochgeladen werden. ` +
          failedFiles
            .map(
              (failure) =>
                `${failure.fileName}: ${failure.message}`,
            )
            .join(' | '),
        );
      }
    } catch (error: any) {
      setErrorMessage(
        error?.message || 'Upload fehlgeschlagen.',
      );
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function deleteMedia(row: MediaRow) {
    if (!window.confirm('Bist du sicher?')) return;

    setWorkingId(row.id);
    setErrorMessage('');

    try {
      await apiFetch(API_PATH, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_id: row.id, reason: '' }),
      });

      setPayload((current) =>
        current
          ? {
              ...current,
              media: current.media.filter((item) => item.id !== row.id),
            }
          : current,
      );
    } catch (error: any) {
      setErrorMessage(error?.message || 'Bild konnte nicht gelöscht werden.');
    } finally {
      setWorkingId('');
    }
  }

  const inspectionTitle = useMemo(() => {
    const inspection = payload?.inspection;
    if (!inspection) return 'Besichtigungsbilder';

    return [inspection.inspection_number, inspection.requested_service_category]
      .filter(Boolean)
      .join(' · ') || 'Besichtigungsbilder';
  }, [payload]);

  return (
    <MirakaDashboardShell
      requiredRole="employee"
      currentPath={`/besichtigung/${inspectionId}`}
      fullWidth
      hideTopBar
    >
      <OPCPageShell>
        <section style={employeeHeroStyle}>
          <div>
            <p style={eyebrowStyle}>Besichtigung</p>
            <h1 style={employeeTitleStyle}>{inspectionTitle}</h1>
            <p style={employeeSubtitleStyle}>
              {[
                payload?.inspection?.address,
                formatDateTime(payload?.inspection?.scheduled_at),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </section>

        {errorMessage ? <div style={errorStyle}>{errorMessage}</div> : null}

        <OPCListCard>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Bilder & Dateien</h2>
            <label
              style={{
                ...primaryButtonStyle,
                opacity: uploading ? 0.6 : 1,
                cursor: uploading ? 'wait' : 'pointer',
              }}
            >
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

          {loading ? (
            <div style={emptyStyle}>Bilder werden geladen.</div>
          ) : !payload?.media?.length ? (
            <div style={emptyStyle}>Noch keine Medien vorhanden.</div>
          ) : (
            <div style={mediaGridStyle}>
              {payload.media.map((row) => (
                <article key={row.id} style={mediaCardStyle}>
                  <MediaPreview row={row} />
                  {row.can_delete ? (
                    <InlineDeleteButton
                      busy={workingId === row.id}
                      onDelete={() => void deleteMedia(row)}
                    />
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </OPCListCard>
      </OPCPageShell>
    </MirakaDashboardShell>
  );
}

function OwnerGalleryDeleteControls({ inspectionId }: { inspectionId: string }) {
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [targets, setTargets] = useState<HTMLElement[]>([]);
  const [workingId, setWorkingId] = useState('');

  useEffect(() => {
    let active = true;

    async function loadRows() {
      if (!supabase) return;

      const { data, error } = await supabase
        .from('opc_site_inspection_media')
        .select('id,inspection_id,file_name,object_path,media_type,sort_order,created_at')
        .eq('inspection_id', inspectionId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (!active || error) return;
      setRows((data || []) as MediaRow[]);
    }

    void loadRows();

    return () => {
      active = false;
    };
  }, [inspectionId]);

  useEffect(() => {
    let frame = 0;

    const syncTargets = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const nodes = Array.from(
          document.querySelectorAll<HTMLElement>(
            '.opc-inspection-media-grid > div',
          ),
        );

        nodes.forEach((node) => {
          node.style.position = 'relative';
        });

        setTargets(nodes);
      });
    };

    syncTargets();

    const observer = new MutationObserver(syncTargets);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [inspectionId, rows.length]);

  async function deleteMedia(row: MediaRow) {
    if (!window.confirm('Bist du sicher?')) return;

    setWorkingId(row.id);

    try {
      await apiFetch(API_PATH, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_id: row.id, reason: '' }),
      });

      setRows((current) => current.filter((item) => item.id !== row.id));
      window.dispatchEvent(new CustomEvent('opc:inspection-media-changed'));
      window.setTimeout(() => window.location.reload(), 120);
    } catch (error: any) {
      window.alert(error?.message || 'Bild konnte nicht gelöscht werden.');
    } finally {
      setWorkingId('');
    }
  }

  return (
    <>
      {rows.map((row, index) => {
        const target = targets[index];
        if (!target) return null;

        return createPortal(
          <InlineDeleteButton
            busy={workingId === row.id}
            onDelete={() => void deleteMedia(row)}
          />,
          target,
        );
      })}
    </>
  );
}

export default function SiteInspectionMediaRoute({
  inspectionId,
}: {
  inspectionId: string;
}) {
  const [profile, setProfile] = useState<UserProfile | null | undefined>(
    undefined,
  );

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
      {!isNew && role === 'owner' ? (
        <OwnerGalleryDeleteControls inspectionId={inspectionId} />
      ) : null}
    </>
  );
}

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
  marginBottom: 22,
  padding: 22,
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: 20,
  background: '#FFFFFF',
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

const sectionHeaderStyle: CSSProperties = {
  minHeight: 76,
  padding: '0 20px',
  borderBottom: `1px solid ${OPC_BRAND.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
  flexWrap: 'wrap',
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: OPC_BRAND.text,
  fontSize: 15,
  fontWeight: 820,
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
};

const mediaGridStyle: CSSProperties = {
  padding: 20,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
  gap: 14,
};

const mediaCardStyle: CSSProperties = {
  position: 'relative',
  padding: 12,
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: 14,
  background: '#FAFAFA',
};

const previewLinkStyle: CSSProperties = {
  display: 'block',
  color: 'inherit',
  textDecoration: 'none',
};

const previewStyle: CSSProperties = {
  height: 82,
  marginBottom: 10,
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: 12,
  background: '#FFFFFF',
  color: OPC_BRAND.muted,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
};

const previewImageStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

const fileNameStyle: CSSProperties = {
  color: OPC_BRAND.muted,
  fontSize: 12,
  fontWeight: 680,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const inlineDeleteButtonStyle: CSSProperties = {
  position: 'absolute',
  top: 7,
  right: 7,
  zIndex: 4,
  width: 28,
  height: 28,
  padding: 0,
  border: '1px solid rgba(15, 23, 42, 0.14)',
  borderRadius: 999,
  background: 'rgba(255, 255, 255, 0.94)',
  color: '#111827',
  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.16)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  backdropFilter: 'blur(8px)',
};

const busyDotStyle: CSSProperties = {
  display: 'block',
  marginTop: -5,
  fontSize: 18,
  lineHeight: 1,
  fontWeight: 800,
};

const emptyStyle: CSSProperties = {
  padding: 28,
  textAlign: 'center',
  color: OPC_BRAND.muted,
  fontSize: 13,
  fontWeight: 680,
};

const errorStyle: CSSProperties = {
  marginBottom: 22,
  padding: 14,
  borderRadius: 14,
  border: '1px solid #FCA5A5',
  background: '#FEF2F2',
  color: '#991B1B',
  fontSize: 14,
  fontWeight: 700,
};
