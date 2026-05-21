/**
 * Project Files Drop Zone
 * ✅ FIXED: Proper storage upload + DB insert flow
 * - Uploads to storage FIRST
 * - Uses correct column names (filename, not name)
 * - Uses client-files bucket
 * - Follows path structure: <project_id>/<filename>
 */

import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Upload, File, X, Image as ImageIcon, FileText, Film, Music } from 'lucide-react';

interface ProjectFilesDropZoneProps {
  projectId: string;
  files: Array<{
    id: string;
    filename: string;
    size: number | null;
    uploaded_at: string;
    file_type?: string;
  }>;
  onFilesChange: () => void;
}

export default function ProjectFilesDropZone({ projectId, files, onFilesChange }: ProjectFilesDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    
    if (droppedFiles.length === 0) return;

    await uploadFiles(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    uploadFiles(Array.from(selectedFiles));
  };

  const uploadFiles = async (filesToUpload: File[]) => {
    setUploading(true);

    try {
      // ✅ Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert('You must be logged in to upload files');
        setUploading(false);
        return;
      }

      for (const file of filesToUpload) {
        try {
          // ✅ Step 1: Generate storage path
          const timestamp = Date.now();
          const fileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const storagePath = `${projectId}/${timestamp}-${fileName}`;

          console.log('📤 Uploading:', storagePath);

          // ✅ Step 2: Upload to storage FIRST
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('client-files')  // ✅ Correct bucket
            .upload(storagePath, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error('❌ Storage error:', uploadError);
            throw uploadError;
          }

          console.log('✅ Storage success:', uploadData);

          // ✅ Step 3: Insert DB record (correct schema)
          const { data: fileRecord, error: insertError } = await supabase
            .from('project_files')
            .insert({
              project_id: projectId,
              filename: file.name,        // ✅ Correct column name
              bucket: 'client-files',     // ✅ Matches policy
              storage_path: storagePath,
              size: file.size,
              file_type: file.type || 'application/octet-stream',
              uploaded_by: user.id,
              visibility: 'private'
            })
            .select()
            .single();

          if (insertError) {
            console.error('❌ DB insert error:', insertError);
            
            // ✅ Cleanup: Remove uploaded file
            await supabase.storage
              .from('client-files')
              .remove([storagePath]);
            
            throw insertError;
          }

          console.log('✅ DB insert success:', fileRecord);
        } catch (fileError) {
          console.error(`Failed to upload ${file.name}:`, fileError);
          alert(`Failed to upload ${file.name}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
        }
      }

      onFilesChange();
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload files');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteFile = async (fileId: string, storagePath?: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      // ✅ Step 1: Delete from storage if path exists
      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from('client-files')
          .remove([storagePath]);
        
        if (storageError) {
          console.warn('Storage delete warning:', storageError);
        }
      }

      // ✅ Step 2: Delete DB record
      const { error } = await supabase
        .from('project_files')
        .delete()
        .eq('id', fileId);

      if (error) throw error;

      onFilesChange();
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file');
    }
  };

  const getFileIcon = (filename: string, fileType?: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    if (fileType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) {
      return <ImageIcon size={20} color="#10B981" />;
    }
    if (fileType?.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv'].includes(ext || '')) {
      return <Film size={20} color="#8B5CF6" />;
    }
    if (fileType?.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac'].includes(ext || '')) {
      return <Music size={20} color="#F59E0B" />;
    }
    if (['pdf', 'doc', 'docx', 'txt', 'xlsx', 'ppt'].includes(ext || '')) {
      return <FileText size={20} color="#3B82F6" />;
    }
    
    return <File size={20} color="#6B7280" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: '14px',
      padding: '32px',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
      marginBottom: '32px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#1A1A1A',
            margin: '0 0 4px 0'
          }}>
            Files
          </h2>
          <p style={{
            fontSize: '13px',
            color: '#6B7280',
            margin: 0
          }}>
            Drag & drop files here or click upload
          </p>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            background: uploading ? '#9CA3AF' : '#F3F4F6',
            color: '#1A1A1A',
            border: 'none',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: uploading ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s ease'
          }}
          onMouseOver={(e) => !uploading && (e.currentTarget.style.background = '#E5E7EB')}
          onMouseOut={(e) => !uploading && (e.currentTarget.style.background = '#F3F4F6')}
        >
          <Upload size={16} />
          {uploading ? 'Uploading...' : 'Upload'}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? '#F59E0B' : '#E5E7EB'}`,
          borderRadius: '10px',
          padding: '24px',
          background: dragOver ? '#FFFBEB' : '#F9FAFB',
          transition: 'all 0.2s ease',
          minHeight: '120px'
        }}
      >
        {files.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            color: '#9CA3AF'
          }}>
            <Upload size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p style={{
              fontSize: '14px',
              margin: '0 0 4px 0',
              color: '#6B7280',
              fontWeight: 500
            }}>
              Drop files here to upload
            </p>
            <p style={{
              fontSize: '12px',
              margin: 0,
              color: '#9CA3AF'
            }}>
              or click the Upload button above
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '12px'
          }}>
            {files.map((file) => (
              <div
                key={file.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#1A1A1A';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {getFileIcon(file.filename, file.file_type)}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#1A1A1A',
                    margin: '0 0 4px 0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {file.filename}
                  </p>
                  <p style={{
                    fontSize: '11px',
                    color: '#6B7280',
                    margin: 0
                  }}>
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteFile(file.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '4px',
                    cursor: 'pointer',
                    color: '#9CA3AF',
                    transition: 'color 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#DC2626'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#9CA3AF'}
                  title="Delete file"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
