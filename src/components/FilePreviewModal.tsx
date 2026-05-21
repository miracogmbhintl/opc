import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  ImageIcon,
  Film,
  Music,
  FileCode,
  Archive,
  File,
  Loader2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { getFileTypeMeta, formatFileSize, formatDate } from '../lib/file-utils';

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY
);

interface FilePreviewModalProps {
  file: {
    id: string;
    filename: string;
    file_type: string | null;
    size: number | null;
    storage_path: string;
    bucket: string;
    uploaded_at: string;
    uploaded_by?: string;
  };
  allFiles?: Array<{
    id: string;
    filename: string;
    file_type: string | null;
    size: number | null;
    storage_path: string;
    bucket: string;
    uploaded_at: string;
    uploaded_by?: string;
  }>;
  currentIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (index: number) => void;
}

const iconComponents = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  pdf: FileText,
  doc: FileText,
  code: FileCode,
  file: File,
  archive: Archive
};

function FilePreviewMeta({
  meta,
  size,
  uploadedAt,
  isImagePreview = false
}: {
  meta: any;
  size: number | null;
  uploadedAt: string;
  isImagePreview?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap',
        fontFamily: 'Inter, sans-serif',
        fontSize: '13px',
        color: isImagePreview ? 'rgba(255, 255, 255, 0.72)' : '#9CA3AF',
        fontWeight: 500
      }}
    >
      {!isImagePreview && (
        <span
          style={{
            padding: '3px 9px',
            background: meta.bgColor,
            borderRadius: '6px',
            color: meta.color,
            fontWeight: 700,
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontFamily: 'Poppins, sans-serif'
          }}
        >
          {meta.badge}
        </span>
      )}
      <span>{formatFileSize(size)}</span>
      <span>•</span>
      <span>{formatDate(uploadedAt)}</span>
    </div>
  );
}

function FilePreviewActions({
  fileUrl,
  loading,
  onDownload,
  onOpenInNewTab,
  isMobile,
  isImagePreview = false
}: {
  fileUrl: string | null;
  loading: boolean;
  onDownload: () => void;
  onOpenInNewTab: () => void;
  isMobile: boolean;
  isImagePreview?: boolean;
}) {
  const buttonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: isMobile ? '6px' : '8px',
    padding: isMobile ? '10px 16px' : '10px 18px',
    background: isImagePreview ? 'rgba(255, 255, 255, 0.08)' : '#1A1A1A',
    color: '#FFFFFF',
    border: isImagePreview ? '1px solid rgba(255, 255, 255, 0.14)' : 'none',
    borderRadius: '10px',
    fontFamily: 'Poppins, sans-serif',
    fontSize: isMobile ? '12px' : '13px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    cursor: fileUrl && !loading ? 'pointer' : 'not-allowed',
    transition: 'all 0.2s ease',
    opacity: fileUrl && !loading ? 1 : 0.5,
    flex: isMobile ? 1 : 'none',
    minWidth: 0,
    whiteSpace: 'nowrap' as const
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    background: 'transparent',
    color: isImagePreview ? '#FFFFFF' : '#1A1A1A',
    border: isImagePreview
      ? '1px solid rgba(255, 255, 255, 0.18)'
      : '1px solid #E5E7EB'
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: isMobile ? '8px' : '10px',
        width: isMobile ? '100%' : 'auto',
        flexWrap: isMobile ? 'nowrap' : 'wrap'
      }}
    >
      <button
        onClick={onDownload}
        disabled={!fileUrl || loading}
        style={buttonStyle}
        onMouseEnter={(e) => {
          if (fileUrl && !loading) {
            e.currentTarget.style.background = isImagePreview
              ? 'rgba(255, 255, 255, 0.14)'
              : '#2A2A2A';
            if (isImagePreview) {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.24)';
            }
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isImagePreview
            ? 'rgba(255, 255, 255, 0.08)'
            : '#1A1A1A';
          if (isImagePreview) {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)';
          }
        }}
      >
        <Download size={isMobile ? 14 : 16} />
        Download
      </button>

      <button
        onClick={onOpenInNewTab}
        disabled={!fileUrl || loading}
        style={secondaryButtonStyle}
        onMouseEnter={(e) => {
          if (fileUrl && !loading) {
            e.currentTarget.style.background = isImagePreview
              ? 'rgba(255, 255, 255, 0.08)'
              : '#F9FAFB';
            e.currentTarget.style.borderColor = isImagePreview
              ? 'rgba(255, 255, 255, 0.24)'
              : '#1A1A1A';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = isImagePreview
            ? 'rgba(255, 255, 255, 0.18)'
            : '#E5E7EB';
        }}
      >
        <ExternalLink size={isMobile ? 14 : 16} />
        Open
      </button>
    </div>
  );
}

function ViewerTopButton({
  label,
  icon,
  onClick,
  disabled = false,
  isMobile = false,
  close = false
}: {
  label?: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  isMobile?: boolean;
  close?: boolean;
}) {
  const mobileSquare = isMobile || close;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label || (close ? 'Close preview' : 'Action')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: mobileSquare ? '0px' : '8px',
        width: mobileSquare ? (isMobile ? '46px' : '48px') : 'auto',
        minWidth: mobileSquare ? (isMobile ? '46px' : '48px') : 'auto',
        height: isMobile ? '46px' : '48px',
        padding: mobileSquare ? '0px' : '0 16px',
        background: 'rgba(0, 0, 0, 0.38)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        borderRadius: '14px',
        color: '#FFFFFF',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        opacity: disabled ? 0.45 : 1,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.28)',
        fontFamily: 'Poppins, sans-serif',
        fontSize: '13px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        flexShrink: 0
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.56)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.28)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.38)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {icon}
      {!mobileSquare && label}
    </button>
  );
}

function FilePreviewModalHeader({
  file,
  meta,
  IconComponent,
  fileUrl,
  loading,
  onClose,
  onDownload,
  onOpenInNewTab,
  isMobile,
  isImagePreview
}: {
  file: FilePreviewModalProps['file'];
  meta: any;
  IconComponent: any;
  fileUrl: string | null;
  loading: boolean;
  onClose: () => void;
  onDownload: () => void;
  onOpenInNewTab: () => void;
  isMobile: boolean;
  isImagePreview: boolean;
}) {
  const closeButtonBase = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    background: 'transparent',
    color: isImagePreview ? '#FFFFFF' : '#1A1A1A',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    flexShrink: 0,
    zIndex: 20,
    padding: 0
  };

  if (isMobile) {
    return (
      <div
        style={{
          padding: '20px 20px 16px 20px',
          borderBottom: '1px solid #E5E7EB',
          position: 'sticky',
          top: 0,
          background: '#FFFFFF',
          zIndex: 10,
          borderTopLeftRadius: '18px',
          borderTopRightRadius: '18px'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            marginBottom: '16px',
            minWidth: 0
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: meta.bgColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <IconComponent size={22} color={meta.color} strokeWidth={1.5} />
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 0,
              paddingTop: '2px'
            }}
          >
            <h2
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: '16px',
                fontWeight: 700,
                color: '#1A1A1A',
                margin: '0 0 6px 0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.01em',
                lineHeight: 1.3
              }}
            >
              {file.filename}
            </h2>

            <FilePreviewMeta meta={meta} size={file.size} uploadedAt={file.uploaded_at} />
          </div>

          <button
            onClick={onClose}
            aria-label="Close preview"
            style={closeButtonBase}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#F3F4F6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <X size={22} strokeWidth={2.5} />
          </button>
        </div>

        <FilePreviewActions
          fileUrl={fileUrl}
          loading={loading}
          onDownload={onDownload}
          onOpenInNewTab={onOpenInNewTab}
          isMobile={isMobile}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '20px',
        padding: '24px 28px',
        borderBottom: '1px solid #E5E7EB',
        position: 'sticky',
        top: 0,
        background: '#FFFFFF',
        zIndex: 10,
        borderTopLeftRadius: '18px',
        borderTopRightRadius: '18px'
      }}
    >
      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '14px',
          background: meta.bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        <IconComponent size={26} color={meta.color} strokeWidth={1.5} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <h2
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: '17px',
            fontWeight: 700,
            color: '#1A1A1A',
            margin: '0 0 8px 0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '-0.01em'
          }}
        >
          {file.filename}
        </h2>

        <FilePreviewMeta meta={meta} size={file.size} uploadedAt={file.uploaded_at} />
      </div>

      <div
        style={{
          display: 'flex',
          gap: '10px',
          flexShrink: 0,
          alignItems: 'center'
        }}
      >
        <FilePreviewActions
          fileUrl={fileUrl}
          loading={loading}
          onDownload={onDownload}
          onOpenInNewTab={onOpenInNewTab}
          isMobile={false}
        />

        <button
          onClick={onClose}
          aria-label="Close preview"
          style={closeButtonBase}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#F3F4F6';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <X size={22} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

export default function FilePreviewModal({
  file,
  allFiles = [],
  currentIndex = 0,
  isOpen,
  onClose,
  onNavigate
}: FilePreviewModalProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [zoom, setZoom] = useState(100);

  const meta = getFileTypeMeta(file.filename, file.file_type);
  const IconComponent = iconComponents[meta.icon as keyof typeof iconComponents] || File;
  const isImagePreview = meta.category === 'image';
  const isPdfPreview = meta.category === 'pdf';
  const isDarkPreview = isImagePreview || isPdfPreview;

  // Touch swipe state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const hasMultipleFiles = allFiles.length > 1;
  const canNavigatePrev = hasMultipleFiles && currentIndex > 0;
  const canNavigateNext = hasMultipleFiles && currentIndex < allFiles.length - 1;

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 300));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 25));
  };

  const handlePrevFile = () => {
    if (canNavigatePrev && onNavigate) {
      setZoom(100);
      onNavigate(currentIndex - 1);
    }
  };

  const handleNextFile = () => {
    if (canNavigateNext && onNavigate) {
      setZoom(100);
      onNavigate(currentIndex + 1);
    }
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    setZoom(100);
  }, [file?.id]);

  useEffect(() => {
    if (!isOpen || !file) return;

    const loadFile = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: urlError } = await supabase.storage
          .from(file.bucket)
          .createSignedUrl(file.storage_path, 3600, {
            download: false
          });

        if (urlError) {
          throw new Error(`Failed to load file: ${urlError.message}`);
        }

        if (!data?.signedUrl) {
          throw new Error('No URL returned from storage');
        }

        setFileUrl(data.signedUrl);
      } catch (err: any) {
        setError(err.message || 'Failed to load file preview');
      } finally {
        setLoading(false);
      }
    };

    loadFile();
  }, [isOpen, file, meta.category]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrevFile();
      } else if (e.key === 'ArrowRight') {
        handleNextFile();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, onClose, canNavigatePrev, canNavigateNext]);

  // Handle touch swipe
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && canNavigateNext) {
      handleNextFile();
    } else if (isRightSwipe && canNavigatePrev) {
      handlePrevFile();
    }
  };

  const handleDownload = async () => {
    if (!fileUrl) return;

    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[FilePreview] Download failed:', err);
      alert('Failed to download file');
    }
  };

  const handleOpenInNewTab = () => {
    if (fileUrl) window.open(fileUrl, '_blank');
  };

  const renderPreview = () => {
    if (loading) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: isDarkPreview
              ? isMobile
                ? 'calc(100vh - 160px)'
                : 'calc(100vh - 190px)'
              : isMobile
                ? '300px'
                : '400px',
            gap: '20px',
            color: isDarkPreview ? '#FFFFFF' : '#1A1A1A'
          }}
        >
          <Loader2
            size={isMobile ? 40 : 48}
            color={isDarkPreview ? '#FFFFFF' : '#1A1A1A'}
            style={{ animation: 'spin 1s linear infinite' }}
          />
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '15px',
              color: isDarkPreview ? 'rgba(255, 255, 255, 0.68)' : '#6B7280',
              fontWeight: 500,
              margin: 0
            }}
          >
            Loading preview...
          </p>
        </div>
      );
    }

    if (error) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: isDarkPreview
              ? isMobile
                ? 'calc(100vh - 160px)'
                : 'calc(100vh - 190px)'
              : isMobile
                ? '300px'
                : '400px',
            gap: '24px',
            padding: isMobile ? '30px 20px' : '40px'
          }}
        >
          <div
            style={{
              width: isMobile ? '64px' : '80px',
              height: isMobile ? '64px' : '80px',
              borderRadius: '50%',
              background: '#FEE2E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={isMobile ? 32 : 40} color="#DC2626" />
          </div>

          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <p
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: isMobile ? '16px' : '18px',
                color: isDarkPreview ? '#FFFFFF' : '#1A1A1A',
                fontWeight: 700,
                margin: '0 0 8px 0'
              }}
            >
              Preview Error
            </p>
            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
                color: isDarkPreview ? 'rgba(255, 255, 255, 0.68)' : '#6B7280',
                lineHeight: 1.6,
                margin: 0
              }}
            >
              {error}
            </p>
          </div>
        </div>
      );
    }

    if (!fileUrl) return null;

    const previewMaxHeight = isMobile ? '60vh' : '65vh';

    if (meta.category === 'image') {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          <div
            style={{
              flex: 1,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative'
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <img
              src={fileUrl}
              alt={file.filename}
              draggable={false}
              style={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: 0,
                boxShadow: 'none',
                userSelect: 'none',
                transform: `scale(${zoom / 100})`,
                transition: 'transform 0.2s ease-out'
              }}
            />

            {canNavigatePrev && (
              <button
                onClick={handlePrevFile}
                aria-label="Previous file"
                style={{
                  position: 'absolute',
                  left: isMobile ? '14px' : '24px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: isMobile ? '58px' : '72px',
                  height: isMobile ? '58px' : '72px',
                  borderRadius: '999px',
                  background: 'rgba(0, 0, 0, 0.42)',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                  boxShadow: '0 10px 28px rgba(0, 0, 0, 0.28)',
                  zIndex: 20
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.58)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.28)';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.42)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                }}
              >
                <ChevronLeft size={isMobile ? 30 : 40} strokeWidth={2.5} />
              </button>
            )}

            {canNavigateNext && (
              <button
                onClick={handleNextFile}
                aria-label="Next file"
                style={{
                  position: 'absolute',
                  right: isMobile ? '14px' : '24px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: isMobile ? '58px' : '72px',
                  height: isMobile ? '58px' : '72px',
                  borderRadius: '999px',
                  background: 'rgba(0, 0, 0, 0.42)',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                  boxShadow: '0 10px 28px rgba(0, 0, 0, 0.28)',
                  zIndex: 20
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.58)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.28)';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.42)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                }}
              >
                <ChevronRight size={isMobile ? 30 : 40} strokeWidth={2.5} />
              </button>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: isMobile ? '16px' : '20px',
              background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.46) 100%)',
              width: '100%',
              justifyContent: 'center'
            }}
          >
            <ViewerTopButton
              label={!isMobile ? '-25%' : undefined}
              icon={<ZoomOut size={18} />}
              onClick={handleZoomOut}
              disabled={zoom <= 25}
              isMobile={isMobile}
            />

            <span
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: 700,
                color: '#FFFFFF',
                minWidth: isMobile ? '54px' : '64px',
                textAlign: 'center'
              }}
            >
              {zoom}%
            </span>

            <ViewerTopButton
              label={!isMobile ? '+25%' : undefined}
              icon={<ZoomIn size={18} />}
              onClick={handleZoomIn}
              disabled={zoom >= 300}
              isMobile={isMobile}
            />
          </div>
        </div>
      );
    }

    if (meta.category === 'pdf') {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            overflow: 'hidden',
            position: 'relative'
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div
            style={{
              flex: 1,
              width: '100%',
              maxWidth: isMobile ? '100%' : '920px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}
          >
            <iframe
              src={`${fileUrl}#view=FitH&toolbar=1&navpanes=0`}
              title={file.filename}
              style={{
                width: '100%',
                height: isMobile ? 'calc(100vh - 200px)' : 'calc(100vh - 220px)',
                minHeight: isMobile ? '400px' : '500px',
                border: 'none',
                borderRadius: '12px',
                background: '#FFFFFF',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)'
              }}
            />

            {canNavigatePrev && (
              <button
                onClick={handlePrevFile}
                aria-label="Previous file"
                style={{
                  position: 'absolute',
                  left: isMobile ? '14px' : '24px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: isMobile ? '58px' : '72px',
                  height: isMobile ? '58px' : '72px',
                  borderRadius: '999px',
                  background: 'rgba(0, 0, 0, 0.42)',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                  boxShadow: '0 10px 28px rgba(0, 0, 0, 0.28)',
                  zIndex: 20
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.58)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.28)';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.42)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                }}
              >
                <ChevronLeft size={isMobile ? 30 : 40} strokeWidth={2.5} />
              </button>
            )}

            {canNavigateNext && (
              <button
                onClick={handleNextFile}
                aria-label="Next file"
                style={{
                  position: 'absolute',
                  right: isMobile ? '14px' : '24px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: isMobile ? '58px' : '72px',
                  height: isMobile ? '58px' : '72px',
                  borderRadius: '999px',
                  background: 'rgba(0, 0, 0, 0.42)',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                  boxShadow: '0 10px 28px rgba(0, 0, 0, 0.28)',
                  zIndex: 20
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.58)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.28)';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.42)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                }}
              >
                <ChevronRight size={isMobile ? 30 : 40} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      );
    }

    if (meta.category === 'video') {
      return (
        <div
          style={{
            width: '100%',
            borderRadius: '14px',
            overflow: 'hidden',
            background: '#000000'
          }}
        >
          <video
            controls
            preload="metadata"
            style={{
              width: '100%',
              maxHeight: previewMaxHeight,
              display: 'block'
            }}
          >
            <source src={fileUrl} type={file.file_type || 'video/mp4'} />
            Your browser does not support video playback.
          </video>
        </div>
      );
    }

    if (meta.category === 'audio') {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: isMobile ? '250px' : '300px',
            gap: isMobile ? '24px' : '32px',
            padding: isMobile ? '30px 20px' : '40px',
            background: '#FAFAFA',
            borderRadius: '14px'
          }}
        >
          <div
            style={{
              width: isMobile ? '96px' : '120px',
              height: isMobile ? '96px' : '120px',
              borderRadius: '50%',
              background: meta.bgColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Music size={isMobile ? 44 : 56} color={meta.color} strokeWidth={1.5} />
          </div>
          <audio
            controls
            preload="metadata"
            style={{
              width: '100%',
              maxWidth: isMobile ? '100%' : '500px',
              outline: 'none'
            }}
          >
            <source src={fileUrl} type={file.file_type || 'audio/mpeg'} />
            Your browser does not support audio playback.
          </audio>
        </div>
      );
    }

    if (meta.category === 'text' || meta.category === 'code') {
      return (
        <div
          style={{
            width: '100%',
            minHeight: isMobile ? '300px' : '400px',
            maxHeight: previewMaxHeight,
            overflow: 'auto',
            borderRadius: '14px',
            border: '1px solid #E5E7EB',
            background: '#FFFFFF'
          }}
        >
          <iframe
            src={fileUrl}
            title={file.filename}
            style={{
              width: '100%',
              minHeight: isMobile ? '300px' : '400px',
              border: 'none'
            }}
          />
        </div>
      );
    }

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: isMobile ? '300px' : '400px',
          gap: isMobile ? '20px' : '28px',
          padding: isMobile ? '40px 20px' : '60px 40px',
          background: '#FAFAFA',
          borderRadius: '14px'
        }}
      >
        <div
          style={{
            width: isMobile ? '96px' : '120px',
            height: isMobile ? '96px' : '120px',
            borderRadius: '50%',
            background: meta.bgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)'
          }}
        >
          <IconComponent size={isMobile ? 44 : 56} color={meta.color} strokeWidth={1.5} />
        </div>

        <div style={{ textAlign: 'center', maxWidth: '420px' }}>
          <div
            style={{
              display: 'inline-block',
              padding: '6px 14px',
              background: meta.bgColor,
              borderRadius: '8px',
              marginBottom: '16px'
            }}
          >
            <span
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: '13px',
                fontWeight: 700,
                color: meta.color,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              {meta.badge}
            </span>
          </div>

          <p
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: isMobile ? '16px' : '18px',
              color: '#1A1A1A',
              fontWeight: 700,
              margin: '0 0 12px 0',
              lineHeight: 1.3
            }}
          >
            Preview not available
          </p>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              color: '#6B7280',
              margin: '0 0 28px 0',
              lineHeight: 1.6,
              padding: '0 20px'
            }}
          >
            This file type cannot be previewed inline. Download the file to view it on your device.
          </p>

          <button
            onClick={handleDownload}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: isMobile ? '12px 24px' : '14px 28px',
              background: '#1A1A1A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              fontFamily: 'Poppins, sans-serif',
              fontSize: '14px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#2A2A2A';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#1A1A1A';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
            }}
          >
            <Download size={18} />
            Download File
          </button>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: isDarkPreview ? 'rgba(0, 0, 0, 0.88)' : 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: isDarkPreview ? '0px' : '10px',
          backdropFilter: isDarkPreview ? 'blur(12px)' : 'blur(8px)',
          WebkitBackdropFilter: isDarkPreview ? 'blur(12px)' : 'blur(8px)',
          animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: isDarkPreview ? 'transparent' : '#FFFFFF',
            borderRadius: isDarkPreview ? '0px' : '18px',
            maxWidth: isDarkPreview ? '100%' : isMobile ? '100%' : '1000px',
            width: isDarkPreview ? '100%' : '100%',
            height: isDarkPreview ? '100vh' : 'auto',
            maxHeight: isDarkPreview ? '100vh' : '100%',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: isDarkPreview ? 'none' : '0 24px 64px rgba(0, 0, 0, 0.3)',
            animation: 'slideUp 0.3s ease-out',
            border: isDarkPreview ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
            overflow: 'hidden',
            position: 'relative'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Floating Top Bar for Image Preview */}
          {isDarkPreview && (
            <>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: isMobile ? '120px' : '140px',
                  background:
                    'linear-gradient(180deg, rgba(0,0,0,0.66) 0%, rgba(0,0,0,0.38) 55%, rgba(0,0,0,0) 100%)',
                  zIndex: 19,
                  pointerEvents: 'none'
                }}
              />

              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                  padding: isMobile ? '14px 14px 0 14px' : '18px 20px 0 20px',
                  zIndex: 30
                }}
              >
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <div
                    style={{
                      maxWidth: isMobile ? '100%' : '560px',
                      padding: isMobile ? '12px 14px' : '14px 16px',
                      background: 'rgba(0, 0, 0, 0.38)',
                      border: '1px solid rgba(255, 255, 255, 0.14)',
                      borderRadius: '16px',
                      backdropFilter: 'blur(14px)',
                      WebkitBackdropFilter: 'blur(14px)',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.28)'
                    }}
                  >
                    <h2
                      style={{
                        fontFamily: 'Poppins, sans-serif',
                        fontSize: isMobile ? '14px' : '15px',
                        fontWeight: 700,
                        color: '#FFFFFF',
                        margin: '0 0 6px 0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {file.filename}
                    </h2>
                    {!isMobile && (
                      <FilePreviewMeta
                        meta={meta}
                        size={file.size}
                        uploadedAt={file.uploaded_at}
                        isImagePreview
                      />
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'center',
                    flexShrink: 0
                  }}
                >
                  <ViewerTopButton
                    label="Download"
                    icon={<Download size={20} />}
                    onClick={handleDownload}
                    disabled={!fileUrl || loading}
                    isMobile={isMobile}
                  />
                  <ViewerTopButton
                    label="Open"
                    icon={<ExternalLink size={20} />}
                    onClick={handleOpenInNewTab}
                    disabled={!fileUrl || loading}
                    isMobile={isMobile}
                  />
                  <ViewerTopButton
                    icon={<X size={22} strokeWidth={2.5} />}
                    onClick={onClose}
                    close
                    isMobile={isMobile}
                  />
                </div>
              </div>
            </>
          )}

          {!isDarkPreview && (
            <FilePreviewModalHeader
              file={file}
              meta={meta}
              IconComponent={IconComponent}
              fileUrl={fileUrl}
              loading={loading}
              onClose={onClose}
              onDownload={handleDownload}
              onOpenInNewTab={handleOpenInNewTab}
              isMobile={isMobile}
              isImagePreview={isImagePreview}
            />
          )}

          <div
            style={{
              padding: isDarkPreview ? '0px' : isMobile ? '16px' : '24px',
              paddingTop: isDarkPreview ? (isMobile ? '90px' : '98px') : undefined,
              overflowY: isDarkPreview ? 'hidden' : 'auto',
              flex: 1,
              minHeight: 0,
              display: isDarkPreview ? 'flex' : 'block',
              alignItems: isDarkPreview ? 'center' : 'stretch',
              justifyContent: isDarkPreview ? 'center' : 'flex-start',
              background: 'transparent'
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '100%',
                height: isDarkPreview ? '100%' : 'auto'
              }}
            >
              {renderPreview()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}







