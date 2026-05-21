/**
 * File type utilities for the Miraka & Co file system
 * Handles file type detection, icons, previews, and metadata
 */

export interface FileTypeMeta {
  category: 'image' | 'video' | 'audio' | 'pdf' | 'document' | 'spreadsheet' | 'presentation' | 'archive' | 'code' | 'text' | 'folder' | 'unknown';
  badge: string;
  icon: 'image' | 'video' | 'audio' | 'pdf' | 'doc' | 'sheet' | 'slides' | 'archive' | 'code' | 'file' | 'folder';
  previewable: boolean;
  color: string;
  bgColor: string;
}

const extensionMap: Record<string, FileTypeMeta> = {
  // Images
  'jpg': { category: 'image', badge: 'JPG', icon: 'image', previewable: true, color: '#059669', bgColor: '#D1FAE5' },
  'jpeg': { category: 'image', badge: 'JPEG', icon: 'image', previewable: true, color: '#059669', bgColor: '#D1FAE5' },
  'png': { category: 'image', badge: 'PNG', icon: 'image', previewable: true, color: '#059669', bgColor: '#D1FAE5' },
  'gif': { category: 'image', badge: 'GIF', icon: 'image', previewable: true, color: '#059669', bgColor: '#D1FAE5' },
  'svg': { category: 'image', badge: 'SVG', icon: 'image', previewable: true, color: '#059669', bgColor: '#D1FAE5' },
  'webp': { category: 'image', badge: 'WEBP', icon: 'image', previewable: true, color: '#059669', bgColor: '#D1FAE5' },
  'heic': { category: 'image', badge: 'HEIC', icon: 'image', previewable: false, color: '#059669', bgColor: '#D1FAE5' },
  
  // Videos
  'mp4': { category: 'video', badge: 'MP4', icon: 'video', previewable: true, color: '#7C3AED', bgColor: '#EDE9FE' },
  'mov': { category: 'video', badge: 'MOV', icon: 'video', previewable: true, color: '#7C3AED', bgColor: '#EDE9FE' },
  'avi': { category: 'video', badge: 'AVI', icon: 'video', previewable: true, color: '#7C3AED', bgColor: '#EDE9FE' },
  'webm': { category: 'video', badge: 'WEBM', icon: 'video', previewable: true, color: '#7C3AED', bgColor: '#EDE9FE' },
  'mkv': { category: 'video', badge: 'MKV', icon: 'video', previewable: false, color: '#7C3AED', bgColor: '#EDE9FE' },
  
  // Audio
  'mp3': { category: 'audio', badge: 'MP3', icon: 'audio', previewable: true, color: '#DB2777', bgColor: '#FCE7F3' },
  'wav': { category: 'audio', badge: 'WAV', icon: 'audio', previewable: true, color: '#DB2777', bgColor: '#FCE7F3' },
  'ogg': { category: 'audio', badge: 'OGG', icon: 'audio', previewable: true, color: '#DB2777', bgColor: '#FCE7F3' },
  'm4a': { category: 'audio', badge: 'M4A', icon: 'audio', previewable: true, color: '#DB2777', bgColor: '#FCE7F3' },
  'aac': { category: 'audio', badge: 'AAC', icon: 'audio', previewable: true, color: '#DB2777', bgColor: '#FCE7F3' },
  
  // PDF
  'pdf': { category: 'pdf', badge: 'PDF', icon: 'pdf', previewable: true, color: '#DC2626', bgColor: '#FEE2E2' },
  
  // Documents
  'doc': { category: 'document', badge: 'DOC', icon: 'doc', previewable: false, color: '#2563EB', bgColor: '#DBEAFE' },
  'docx': { category: 'document', badge: 'DOCX', icon: 'doc', previewable: false, color: '#2563EB', bgColor: '#DBEAFE' },
  'odt': { category: 'document', badge: 'ODT', icon: 'doc', previewable: false, color: '#2563EB', bgColor: '#DBEAFE' },
  'rtf': { category: 'document', badge: 'RTF', icon: 'doc', previewable: false, color: '#2563EB', bgColor: '#DBEAFE' },
  
  // Spreadsheets
  'xls': { category: 'spreadsheet', badge: 'XLS', icon: 'sheet', previewable: false, color: '#059669', bgColor: '#D1FAE5' },
  'xlsx': { category: 'spreadsheet', badge: 'XLSX', icon: 'sheet', previewable: false, color: '#059669', bgColor: '#D1FAE5' },
  'csv': { category: 'spreadsheet', badge: 'CSV', icon: 'sheet', previewable: true, color: '#059669', bgColor: '#D1FAE5' },
  'ods': { category: 'spreadsheet', badge: 'ODS', icon: 'sheet', previewable: false, color: '#059669', bgColor: '#D1FAE5' },
  
  // Presentations
  'ppt': { category: 'presentation', badge: 'PPT', icon: 'slides', previewable: false, color: '#EA580C', bgColor: '#FFEDD5' },
  'pptx': { category: 'presentation', badge: 'PPTX', icon: 'slides', previewable: false, color: '#EA580C', bgColor: '#FFEDD5' },
  'odp': { category: 'presentation', badge: 'ODP', icon: 'slides', previewable: false, color: '#EA580C', bgColor: '#FFEDD5' },
  
  // Archives
  'zip': { category: 'archive', badge: 'ZIP', icon: 'archive', previewable: false, color: '#78716C', bgColor: '#E7E5E4' },
  'rar': { category: 'archive', badge: 'RAR', icon: 'archive', previewable: false, color: '#78716C', bgColor: '#E7E5E4' },
  '7z': { category: 'archive', badge: '7Z', icon: 'archive', previewable: false, color: '#78716C', bgColor: '#E7E5E4' },
  'tar': { category: 'archive', badge: 'TAR', icon: 'archive', previewable: false, color: '#78716C', bgColor: '#E7E5E4' },
  'gz': { category: 'archive', badge: 'GZ', icon: 'archive', previewable: false, color: '#78716C', bgColor: '#E7E5E4' },
  
  // Code
  'js': { category: 'code', badge: 'JS', icon: 'code', previewable: true, color: '#F59E0B', bgColor: '#FEF3C7' },
  'ts': { category: 'code', badge: 'TS', icon: 'code', previewable: true, color: '#3B82F6', bgColor: '#DBEAFE' },
  'jsx': { category: 'code', badge: 'JSX', icon: 'code', previewable: true, color: '#06B6D4', bgColor: '#CFFAFE' },
  'tsx': { category: 'code', badge: 'TSX', icon: 'code', previewable: true, color: '#0EA5E9', bgColor: '#E0F2FE' },
  'html': { category: 'code', badge: 'HTML', icon: 'code', previewable: true, color: '#DC2626', bgColor: '#FEE2E2' },
  'css': { category: 'code', badge: 'CSS', icon: 'code', previewable: true, color: '#2563EB', bgColor: '#DBEAFE' },
  'json': { category: 'code', badge: 'JSON', icon: 'code', previewable: true, color: '#65A30D', bgColor: '#ECFCCB' },
  'xml': { category: 'code', badge: 'XML', icon: 'code', previewable: true, color: '#EA580C', bgColor: '#FFEDD5' },
  'py': { category: 'code', badge: 'PY', icon: 'code', previewable: true, color: '#3B82F6', bgColor: '#DBEAFE' },
  'java': { category: 'code', badge: 'JAVA', icon: 'code', previewable: true, color: '#DC2626', bgColor: '#FEE2E2' },
  
  // Text
  'txt': { category: 'text', badge: 'TXT', icon: 'file', previewable: true, color: '#6B7280', bgColor: '#F3F4F6' },
  'md': { category: 'text', badge: 'MD', icon: 'file', previewable: true, color: '#6B7280', bgColor: '#F3F4F6' },
  'log': { category: 'text', badge: 'LOG', icon: 'file', previewable: true, color: '#6B7280', bgColor: '#F3F4F6' },
};

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

export function getFileTypeMeta(filename: string, mimeType?: string | null): FileTypeMeta {
  // Check extension first
  const ext = getFileExtension(filename);
  if (ext && extensionMap[ext]) {
    return extensionMap[ext];
  }
  
  // Fall back to mime type
  if (mimeType) {
    const type = mimeType.toLowerCase();
    
    if (type.startsWith('image/')) {
      return { category: 'image', badge: ext.toUpperCase() || 'IMG', icon: 'image', previewable: true, color: '#059669', bgColor: '#D1FAE5' };
    }
    if (type.startsWith('video/')) {
      return { category: 'video', badge: ext.toUpperCase() || 'VIDEO', icon: 'video', previewable: true, color: '#7C3AED', bgColor: '#EDE9FE' };
    }
    if (type.startsWith('audio/')) {
      return { category: 'audio', badge: ext.toUpperCase() || 'AUDIO', icon: 'audio', previewable: true, color: '#DB2777', bgColor: '#FCE7F3' };
    }
    if (type === 'application/pdf') {
      return { category: 'pdf', badge: 'PDF', icon: 'pdf', previewable: true, color: '#DC2626', bgColor: '#FEE2E2' };
    }
    if (type.startsWith('text/')) {
      return { category: 'text', badge: ext.toUpperCase() || 'TXT', icon: 'file', previewable: true, color: '#6B7280', bgColor: '#F3F4F6' };
    }
  }
  
  // Unknown type
  return { 
    category: 'unknown', 
    badge: ext.toUpperCase() || '?', 
    icon: 'file', 
    previewable: false, 
    color: '#6B7280', 
    bgColor: '#F3F4F6' 
  };
}

export function getPreviewUrl(bucket: string, storagePath: string, supabaseUrl: string): string {
  // Remove protocol from URL if present
  const cleanUrl = supabaseUrl.replace(/^https?:\/\//, '');
  return `https://${cleanUrl}/storage/v1/object/public/${bucket}/${storagePath}`;
}

export function canPreviewInline(meta: FileTypeMeta): boolean {
  return meta.previewable;
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes === 0) return '0 KB';
  
  const kb = bytes / 1024;
  if (kb < 1) return '1 KB';
  if (kb < 1024) return `${Math.round(kb)} KB`;
  
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}
