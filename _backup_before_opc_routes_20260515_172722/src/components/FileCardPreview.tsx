import { Folder, FileText, Image, Film, Music, FileCode, Archive, File, FileSpreadsheet, Presentation } from 'lucide-react';
import { getFileTypeMeta, getPreviewUrl } from '../lib/file-utils';

interface FileCardPreviewProps {
  file: {
    filename: string;
    file_type?: string | null;
    storage_path?: string | null;
    bucket?: string;
    type: 'file' | 'folder';
  };
  supabaseUrl: string;
  isMobile?: boolean;
}

const iconComponents = {
  image: Image,
  video: Film,
  audio: Music,
  pdf: FileText,
  doc: FileText,
  sheet: FileSpreadsheet,
  slides: Presentation,
  archive: Archive,
  code: FileCode,
  file: File,
  folder: Folder
};

export default function FileCardPreview({ file, supabaseUrl, isMobile = false }: FileCardPreviewProps) {
  if (file.type === 'folder') {
    return (
      <div style={{
        width: '100%',
        aspectRatio: '1.45 / 1',
        borderRadius: '14px',
        background: '#FEF3C7',
        border: '1px solid #FDE68A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0
      }}>
        <Folder 
          size={isMobile ? 32 : 40} 
          color="#D97706" 
          strokeWidth={1.5}
        />
      </div>
    );
  }

  const meta = getFileTypeMeta(file.filename, file.file_type);
  const IconComponent = iconComponents[meta.icon];
  
  // For images, show actual thumbnail
  if (meta.category === 'image' && file.storage_path && file.bucket) {
    const imageUrl = getPreviewUrl(file.bucket, file.storage_path, supabaseUrl);
    
    return (
      <div style={{
        width: '100%',
        aspectRatio: '1.45 / 1',
        borderRadius: '14px',
        background: '#F3F4F6',
        border: '1px solid #E5E7EB',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative'
      }}>
        <img
          src={imageUrl}
          alt={file.filename}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
          onError={(e) => {
            // If image fails to load, show icon instead
            const target = e.currentTarget;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.style.display = 'flex';
              parent.style.alignItems = 'center';
              parent.style.justifyContent = 'center';
              parent.style.background = meta.bgColor;
              parent.style.borderColor = meta.color + '20';
              const iconDiv = document.createElement('div');
              iconDiv.innerHTML = `<svg width="${isMobile ? 32 : 40}" height="${isMobile ? 32 : 40}" viewBox="0 0 24 24" fill="none" stroke="${meta.color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
              parent.appendChild(iconDiv);
            }
          }}
        />
        
        {/* File type badge */}
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          padding: '4px 8px',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          borderRadius: '6px',
          fontSize: '10px',
          fontWeight: 700,
          color: '#FFFFFF',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontFamily: 'Poppins, sans-serif'
        }}>
          {meta.badge}
        </div>
      </div>
    );
  }

  // For PDFs, show PDF icon with styled background
  if (meta.category === 'pdf' && file.storage_path && file.bucket) {
    return (
      <div style={{
        width: '100%',
        aspectRatio: '1.45 / 1',
        borderRadius: '14px',
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
        gap: '8px',
        padding: '12px'
      }}>
        {/* PDF Document Icon */}
        <div style={{
          width: isMobile ? '48px' : '56px',
          height: isMobile ? '64px' : '72px',
          background: '#EF4444',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)'
        }}>
          {/* PDF text */}
          <span style={{
            color: '#FFFFFF',
            fontSize: isMobile ? '14px' : '16px',
            fontWeight: 800,
            fontFamily: 'Poppins, sans-serif',
            letterSpacing: '0.5px'
          }}>
            PDF
          </span>
        </div>
        
        {/* File type badge */}
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          padding: '4px 8px',
          background: 'rgba(220, 38, 38, 0.95)',
          backdropFilter: 'blur(8px)',
          borderRadius: '6px',
          fontSize: '10px',
          fontWeight: 700,
          color: '#FFFFFF',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontFamily: 'Poppins, sans-serif'
        }}>
          PDF
        </div>
      </div>
    );
  }

  // For videos, show video element with poster/thumbnail
  if (meta.category === 'video' && file.storage_path && file.bucket) {
    const videoUrl = getPreviewUrl(file.bucket, file.storage_path, supabaseUrl);
    
    return (
      <div style={{
        width: '100%',
        aspectRatio: '1.45 / 1',
        borderRadius: '14px',
        background: '#000000',
        border: '1px solid #E5E7EB',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative'
      }}>
        <video
          src={videoUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none'
          }}
          muted
          preload="metadata"
        />
        
        {/* Play icon overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            width: isMobile ? '44px' : '52px',
            height: isMobile ? '44px' : '52px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
          }}>
            <Film size={isMobile ? 20 : 24} color="#1A1A1A" strokeWidth={2} />
          </div>
        </div>
        
        {/* File type badge */}
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          padding: '4px 8px',
          background: 'rgba(139, 92, 246, 0.95)',
          backdropFilter: 'blur(8px)',
          borderRadius: '6px',
          fontSize: '10px',
          fontWeight: 700,
          color: '#FFFFFF',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontFamily: 'Poppins, sans-serif'
        }}>
          {meta.badge}
        </div>
      </div>
    );
  }

  // For audio files, show waveform-style preview
  if (meta.category === 'audio' && file.storage_path && file.bucket) {
    return (
      <div style={{
        width: '100%',
        aspectRatio: '1.45 / 1',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
        border: '1px solid #E5E7EB',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
        gap: '10px',
        padding: '16px'
      }}>
        <Music size={isMobile ? 32 : 40} color="#FFFFFF" strokeWidth={1.5} />
        
        {/* Waveform visualization */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          height: '40px'
        }}>
          {[20, 35, 50, 30, 45, 25, 40, 55, 35, 45, 30, 50, 25].map((height, i) => (
            <div
              key={i}
              style={{
                width: '3px',
                height: `${height}%`,
                background: 'rgba(255, 255, 255, 0.6)',
                borderRadius: '2px'
              }}
            />
          ))}
        </div>
        
        {/* File type badge */}
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          padding: '4px 8px',
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(8px)',
          borderRadius: '6px',
          fontSize: '10px',
          fontWeight: 700,
          color: '#FFFFFF',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontFamily: 'Poppins, sans-serif'
        }}>
          {meta.badge}
        </div>
      </div>
    );
  }

  // For code files, show preview with syntax-like styling
  if (meta.category === 'code' && file.storage_path && file.bucket) {
    return (
      <div style={{
        width: '100%',
        aspectRatio: '1.45 / 1',
        borderRadius: '14px',
        background: '#1E1E1E',
        border: '1px solid #3E3E3E',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
        padding: '12px',
        gap: '6px'
      }}>
        {/* Mock code lines */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF5F56' }} />
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FFBD2E' }} />
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27C93F' }} />
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', width: '100%' }}>
          <div style={{ height: '4px', width: '60%', background: '#569CD6', borderRadius: '2px' }} />
          <div style={{ height: '4px', width: '80%', background: '#D4D4D4', borderRadius: '2px' }} />
          <div style={{ height: '4px', width: '45%', background: '#CE9178', borderRadius: '2px', marginLeft: '12px' }} />
          <div style={{ height: '4px', width: '70%', background: '#D4D4D4', borderRadius: '2px', marginLeft: '12px' }} />
          <div style={{ height: '4px', width: '50%', background: '#4EC9B0', borderRadius: '2px' }} />
        </div>
        
        <FileCode 
          size={isMobile ? 24 : 28} 
          color="#D4D4D4" 
          strokeWidth={1.5}
          style={{ position: 'absolute', bottom: '12px', right: '12px', opacity: 0.3 }}
        />
        
        {/* File type badge */}
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          padding: '4px 8px',
          background: 'rgba(79, 70, 229, 0.95)',
          backdropFilter: 'blur(8px)',
          borderRadius: '6px',
          fontSize: '10px',
          fontWeight: 700,
          color: '#FFFFFF',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontFamily: 'Poppins, sans-serif'
        }}>
          {meta.badge}
        </div>
      </div>
    );
  }

  // For text/document files, show document preview
  if ((meta.category === 'doc' || meta.category === 'text') && file.storage_path && file.bucket) {
    return (
      <div style={{
        width: '100%',
        aspectRatio: '1.45 / 1',
        borderRadius: '14px',
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
        padding: '16px',
        gap: '6px'
      }}>
        {/* Mock document lines */}
        <div style={{ height: '3px', width: '90%', background: '#1A1A1A', borderRadius: '2px' }} />
        <div style={{ height: '3px', width: '85%', background: '#6B7280', borderRadius: '2px' }} />
        <div style={{ height: '3px', width: '88%', background: '#6B7280', borderRadius: '2px' }} />
        <div style={{ height: '8px' }} />
        <div style={{ height: '3px', width: '92%', background: '#6B7280', borderRadius: '2px' }} />
        <div style={{ height: '3px', width: '78%', background: '#6B7280', borderRadius: '2px' }} />
        <div style={{ height: '3px', width: '85%', background: '#6B7280', borderRadius: '2px' }} />
        <div style={{ height: '3px', width: '60%', background: '#6B7280', borderRadius: '2px' }} />
        
        <FileText 
          size={isMobile ? 24 : 28} 
          color="#9CA3AF" 
          strokeWidth={1.5}
          style={{ position: 'absolute', bottom: '12px', right: '12px', opacity: 0.4 }}
        />
        
        {/* File type badge */}
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          padding: '4px 8px',
          background: 'rgba(59, 130, 246, 0.95)',
          backdropFilter: 'blur(8px)',
          borderRadius: '6px',
          fontSize: '10px',
          fontWeight: 700,
          color: '#FFFFFF',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontFamily: 'Poppins, sans-serif'
        }}>
          {meta.badge}
        </div>
      </div>
    );
  }
  
  // For other file types, show icon with colored background (fallback)
  return (
    <div style={{
      width: '100%',
      aspectRatio: '1.45 / 1',
      borderRadius: '14px',
      background: meta.bgColor,
      border: `1px solid ${meta.color}20`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      flexShrink: 0,
      gap: '8px',
      padding: '12px',
      position: 'relative'
    }}>
      <IconComponent 
        size={isMobile ? 32 : 40} 
        color={meta.color} 
        strokeWidth={1.5}
      />
      
      {/* File type badge */}
      <div style={{
        padding: '4px 10px',
        background: meta.color + '15',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 700,
        color: meta.color,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        fontFamily: 'Poppins, sans-serif'
      }}>
        {meta.badge}
      </div>
    </div>
  );
}




