/**
 * Simple File Uploader
 * ✅ FIXED: Matches Supabase schema and RLS policies
 * - Uses 'filename' (not 'name')
 * - Uses 'client-files' bucket consistently
 * - Uploads to storage BEFORE DB insert
 * - Follows policy path structure: <project_id>/<filename>
 */

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Upload, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface SimpleFileUploaderProps {
  projectId: string;
  onUploadComplete?: () => void;
}

export default function SimpleFileUploader({ projectId, onUploadComplete }: SimpleFileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError('');
      setSuccess('');
    }
  };

  const uploadFile = async () => {
    if (!selectedFile || !projectId) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      // ✅ Step 1: Get authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('Authentication required. Please log in.');
      }

      // ✅ Step 2: Generate storage path (follows policy: <project_id>/<filename>)
      const timestamp = Date.now();
      const fileName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${projectId}/${timestamp}-${fileName}`;

      console.log('📤 Uploading to storage:', storagePath);

      // ✅ Step 3: Upload file to Supabase Storage (client-files bucket)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('client-files')  // ✅ Matches policies: bucket_id = 'client-files'
        .upload(storagePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Storage upload error:', uploadError);
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      console.log('✅ Storage upload successful:', uploadData);

      // ✅ Step 4: Create database record (matches schema exactly)
      const fileRecord = {
        project_id: projectId,           // UUID - required by policies
        filename: selectedFile.name,     // ✅ Correct column name (not 'name')
        bucket: 'client-files',          // ✅ Matches policy: bucket_id = 'client-files'
        storage_path: storagePath,       // Path in storage
        size: selectedFile.size,         // bigint
        file_type: selectedFile.type || 'application/octet-stream',
        uploaded_by: user.id,            // UUID - for RLS
        visibility: 'private'            // Default visibility
      };

      console.log('💾 Creating database record:', fileRecord);

      // ✅ Step 5: Insert to project_files table
      const { data: dbData, error: dbError } = await supabase
        .from('project_files')
        .insert([fileRecord])
        .select('id, filename, uploaded_at')
        .single();

      if (dbError) {
        console.error('❌ Database insert error:', dbError);
        
        // ✅ Cleanup: Delete uploaded file if DB insert fails
        console.log('🧹 Cleaning up storage...');
        await supabase.storage
          .from('client-files')
          .remove([storagePath]);

        throw new Error(`Database insert failed: ${dbError.message}`);
      }

      console.log('✅ Database record created:', dbData);

      setSuccess(`File "${selectedFile.name}" uploaded successfully!`);
      setSelectedFile(null);
      
      // Reset file input
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }

      // Call callback if provided
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (err) {
      console.error('❌ Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{
      padding: '24px',
      background: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: '14px',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
    }}>
      <h3 style={{
        fontSize: '18px',
        fontWeight: 600,
        color: '#1A1A1A',
        marginBottom: '16px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
      }}>
        Upload File
      </h3>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '12px 16px',
          background: '#FEF2F2',
          border: '1px solid #FCA5A5',
          borderRadius: '10px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#991B1B',
          fontSize: '14px'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div style={{
          padding: '12px 16px',
          background: '#D1FAE5',
          border: '1px solid #A7F3D0',
          borderRadius: '10px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#065F46',
          fontSize: '14px'
        }}>
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* File Input */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '13px',
          fontWeight: 600,
          color: '#1A1A1A',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
        }}>
          Select File
        </label>
        <input
          id="file-input"
          type="file"
          onChange={handleFileSelect}
          disabled={uploading}
          style={{
            width: '100%',
            padding: '10px 14px',
            fontSize: '14px',
            border: '1px solid #E5E7EB',
            borderRadius: '10px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
            cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.6 : 1
          }}
        />
        {selectedFile && (
          <div style={{
            marginTop: '8px',
            padding: '8px 12px',
            background: '#F9FAFB',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#6B7280',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>
              {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </span>
            {!uploading && (
              <button
                onClick={() => {
                  setSelectedFile(null);
                  const fileInput = document.getElementById('file-input') as HTMLInputElement;
                  if (fileInput) fileInput.value = '';
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#6B7280'
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Upload Button */}
      <button
        onClick={uploadFile}
        disabled={!selectedFile || uploading}
        style={{
          width: '100%',
          padding: '12px 20px',
          fontSize: '14px',
          fontWeight: 500,
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
          border: 'none',
          borderRadius: '10px',
          background: (!selectedFile || uploading) ? '#9CA3AF' : '#1A1A1A',
          color: '#FFFFFF',
          cursor: (!selectedFile || uploading) ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          if (selectedFile && !uploading) {
            e.currentTarget.style.background = '#2A2A2A';
          }
        }}
        onMouseLeave={(e) => {
          if (selectedFile && !uploading) {
            e.currentTarget.style.background = '#1A1A1A';
          }
        }}
      >
        {uploading ? (
          <>
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderTopColor: '#FFFFFF',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
            <span>Uploading...</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </>
        ) : (
          <>
            <Upload size={18} />
            <span>Upload File</span>
          </>
        )}
      </button>

      {/* Debug Info (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: '#F9FAFB',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#6B7280',
          fontFamily: 'monospace'
        }}>
          <div>✅ Bucket: client-files</div>
          <div>✅ Path: {projectId}/timestamp-filename</div>
          <div>✅ Project ID: {projectId}</div>
          <div>File selected: {selectedFile ? 'Yes' : 'No'}</div>
        </div>
      )}
    </div>
  );
}
