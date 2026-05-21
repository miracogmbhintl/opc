/**
 * Files Module Container
 * ✅ FIXED: Complete storage + DB flow
 * - Uploads to client-files bucket
 * - Uses correct column names
 * - Proper storage cleanup on delete
 */

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import MirakaDashboardShell from './MirakaDashboardShell';
import PortalSkeleton from './shared/PortalSkeleton';
import { Upload, Folder, File, X, ChevronRight, FolderOpen, Image as ImageIcon, FileText, Film, Music } from 'lucide-react';

interface Project {
  id: string;
  project_title: string;
}

interface FileItem {
  id: string;
  filename: string;
  size: number | null;
  uploaded_at: string;
  project_id: string | null;
  file_type?: string;
  storage_path?: string;
}

export default function FilesModuleContainer() {
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'client' | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  
  // Modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        window.location.href = '//';
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      const role = profile.role as 'owner' | 'admin' | 'client';
      setUserRole(role);

      // Load files and projects
      await Promise.all([loadFiles(), loadProjects()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('project_files')
        .select('id, filename, size, uploaded_at, project_id, file_type, storage_path')
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      setFiles(data || []);
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_title')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  // Drag and drop handlers
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

  const handleDrop = async (e: React.DragEvent, projectId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    
    if (droppedFiles.length === 0) return;

    await uploadFiles(droppedFiles, projectId || null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    uploadFiles(Array.from(selectedFiles), null);
  };

  const uploadFiles = async (filesToUpload: File[], projectId: string | null) => {
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
          // ✅ Generate storage path
          const timestamp = Date.now();
          const fileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const targetProjectId = projectId || 'unassigned';
          const storagePath = `${targetProjectId}/${timestamp}-${fileName}`;

          console.log('📤 Uploading:', storagePath);

          // ✅ Step 1: Upload to storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('client-files')
            .upload(storagePath, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error('❌ Storage error:', uploadError);
            throw uploadError;
          }

          console.log('✅ Storage success:', uploadData);

          // ✅ Step 2: Insert DB record
          const { data, error } = await supabase
            .from('project_files')
            .insert({
              filename: file.name,              // ✅ Correct column
              bucket: 'client-files',           // ✅ Matches policy
              storage_path: storagePath,        // ✅ Required
              size: file.size,
              project_id: projectId,
              file_type: file.type || 'application/octet-stream',
              uploaded_by: user.id,
              visibility: 'private'
            })
            .select()
            .single();

          if (error) {
            console.error('❌ DB insert error:', error);
            
            // ✅ Cleanup storage
            await supabase.storage
              .from('client-files')
              .remove([storagePath]);
            
            throw error;
          }

          console.log('✅ DB insert success:', data);
        } catch (fileError) {
          console.error(`Failed to upload ${file.name}:`, fileError);
          alert(`Failed to upload ${file.name}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
        }
      }

      await loadFiles();
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

  const handleAssignToProject = async () => {
    if (!selectedFile) return;

    try {
      const { error } = await supabase
        .from('project_files')
        .update({ project_id: selectedProjectId || null })
        .eq('id', selectedFile.id);

      if (error) throw error;

      setShowAssignModal(false);
      setSelectedFile(null);
      setSelectedProjectId('');
      await loadFiles();
    } catch (error) {
      console.error('Error assigning file:', error);
      alert('Failed to assign file to project');
    }
  };

  const handleUnassignFile = async (fileId: string) => {
    try {
      const { error } = await supabase
        .from('project_files')
        .update({ project_id: null })
        .eq('id', fileId);

      if (error) throw error;

      await loadFiles();
    } catch (error) {
      console.error('Error unassigning file:', error);
      alert('Failed to unassign file');
    }
  };

  const handleDeleteFile = async (fileId: string, storagePath?: string) => {
    if (!confirm('Are you sure you want to delete this file? This cannot be undone.')) return;

    try {
      // ✅ Step 1: Delete from storage
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

      await loadFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file');
    }
  };

  const getFileIcon = (filename: string, fileType?: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    if (fileType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) {
      return <ImageIcon size={20} color="#10B981" strokeWidth={1.5} />;
    }
    if (fileType?.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv'].includes(ext || '')) {
      return <Film size={20} color="#8B5CF6" strokeWidth={1.5} />;
    }
    if (fileType?.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac'].includes(ext || '')) {
      return <Music size={20} color="#F59E0B" strokeWidth={1.5} />;
    }
    if (['pdf', 'doc', 'docx', 'txt', 'xlsx', 'ppt'].includes(ext || '')) {
      return <FileText size={20} color="#3B82F6" strokeWidth={1.5} />;
    }
    
    return <File size={20} color="#6B7280" strokeWidth={1.5} />;
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

  // Group files by project
  const unassignedFiles = files.filter(f => !f.project_id);
  const filesByProject = projects.map(project => ({
    project,
    files: files.filter(f => f.project_id === project.id)
  })).filter(p => p.files.length > 0);

  if (loading) {
    return (
      <MirakaDashboardShell 
        requiredRole={userRole || 'admin'} 
        currentPath="/berichte-dateien"
      >
        <PortalSkeleton variant="cards" />
      </MirakaDashboardShell>
    );
  }

  return (
    <MirakaDashboardShell 
      requiredRole={userRole || 'admin'} 
      currentPath="/berichte-dateien"
    >
      <div style={{ 
        padding: '0',
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif"
      }}>
        {/* Page Header */}
        <div className="files-header" style={{ 
          marginBottom: '40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <h1 className="files-title" style={{
              fontSize: '32px',
              fontWeight: '600',
              color: '#1A1A1A',
              margin: '0 0 8px 0',
              letterSpacing: '-0.02em'
            }}>
              Files & Assets
            </h1>
            <p className="files-subtitle" style={{
              fontSize: '16px',
              color: '#7A7A7A',
              margin: 0
            }}>
              Drag & drop files to upload. Organize by project or keep in main library.
            </p>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="upload-button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              background: uploading ? '#9CA3AF' : '#1A1A1A',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: '500',
              borderRadius: '10px',
              border: 'none',
              cursor: uploading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s ease',
              minHeight: '44px'
            }}
            onMouseEnter={(e) => !uploading && (e.currentTarget.style.background = '#000000')}
            onMouseLeave={(e) => !uploading && (e.currentTarget.style.background = '#1A1A1A')}
          >
            <Upload size={18} strokeWidth={1.5} />
            {uploading ? 'Uploading...' : 'Upload Files'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        {/* Main Drop Zone - Unassigned Files */}
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e)}
          className="main-library"
          style={{
            background: dragOver ? '#FFFBEB' : '#FFFFFF',
            border: `1px solid ${dragOver ? '#F59E0B' : '#E5E7EB'}`,
            borderRadius: '20px',
            padding: '32px',
            marginBottom: '32px',
            transition: 'all 0.2s ease',
            minHeight: '200px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px'
          }}>
            <div>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1A1A1A',
                margin: '0 0 4px 0'
              }}>
                Main Library
              </h2>
              <p style={{
                fontSize: '14px',
                color: '#7A7A7A',
                margin: 0
              }}>
                {unassignedFiles.length} unassigned file{unassignedFiles.length !== 1 ? 's' : ''} • Drag files here or click upload
              </p>
            </div>
          </div>

          {unassignedFiles.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#9CA3AF'
            }}>
              <Upload size={48} style={{ margin: '0 auto 16px', opacity: 0.3, strokeWidth: 1.5 }} />
              <p style={{
                fontSize: '14px',
                margin: 0,
                color: '#7A7A7A'
              }}>
                Drop files here or click Upload Files button
              </p>
            </div>
          ) : (
            <div className="files-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '16px'
            }}>
              {unassignedFiles.map((file) => (
                <div
                  key={file.id}
                  style={{
                    background: '#F9FAFB',
                    border: '1px solid #E5E7EB',
                    borderRadius: '12px',
                    padding: '16px',
                    transition: 'all 0.2s ease',
                    cursor: 'default'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#1A1A1A';
                    e.currentTarget.style.background = '#FFFFFF';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#E5E7EB';
                    e.currentTarget.style.background = '#F9FAFB';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    marginBottom: '12px'
                  }}>
                    {getFileIcon(file.filename, file.file_type)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#1A1A1A',
                        margin: '0 0 4px 0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {file.filename}
                      </p>
                      <p style={{
                        fontSize: '12px',
                        color: '#7A7A7A',
                        margin: 0
                      }}>
                        {formatFileSize(file.size)} • {formatDate(file.uploaded_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteFile(file.id, file.storage_path)}
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
                      <X size={16} strokeWidth={1.5} />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedFile(file);
                      setShowAssignModal(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      background: '#F7F7F7',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '500',
                      color: '#1A1A1A',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      minHeight: '40px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#1A1A1A';
                      e.currentTarget.style.color = '#FFFFFF';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#F7F7F7';
                      e.currentTarget.style.color = '#1A1A1A';
                    }}
                  >
                    Assign to Project
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Project Folders */}
        <div>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#1A1A1A',
            margin: '0 0 20px 0'
          }}>
            Project Folders
          </h2>

          {filesByProject.length === 0 ? (
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '20px',
              padding: '60px 20px',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
            }}>
              <FolderOpen size={48} color="#D1D5DB" style={{ margin: '0 auto 16px', strokeWidth: 1.5 }} />
              <p style={{
                fontSize: '14px',
                color: '#7A7A7A',
                margin: 0
              }}>
                No files assigned to projects yet
              </p>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              {filesByProject.map(({ project, files: projectFiles }) => (
                <div
                  key={project.id}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, project.id)}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '20px',
                    padding: '24px',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '20px'
                  }}>
                    <Folder size={24} color="#1A1A1A" strokeWidth={1.5} />
                    <div>
                      <h3 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1A1A1A',
                        margin: '0 0 2px 0'
                      }}>
                        {project.project_title}
                      </h3>
                      <p style={{
                        fontSize: '13px',
                        color: '#7A7A7A',
                        margin: 0
                      }}>
                        {projectFiles.length} file{projectFiles.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="project-files-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '12px'
                  }}>
                    {projectFiles.map((file) => (
                      <div
                        key={file.id}
                        style={{
                          background: '#F9FAFB',
                          border: '1px solid #E5E7EB',
                          borderRadius: '10px',
                          padding: '14px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#1A1A1A';
                          e.currentTarget.style.background = '#FFFFFF';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#E5E7EB';
                          e.currentTarget.style.background = '#F9FAFB';
                        }}
                      >
                        {getFileIcon(file.filename, file.file_type)}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: '13px',
                            fontWeight: '500',
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
                            color: '#7A7A7A',
                            margin: 0
                          }}>
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleUnassignFile(file.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '4px',
                            cursor: 'pointer',
                            color: '#9CA3AF',
                            transition: 'color 0.2s ease',
                            minWidth: '24px',
                            minHeight: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#DC2626'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#9CA3AF'}
                          title="Unassign from project"
                        >
                          <X size={16} strokeWidth={1.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assign to Project Modal */}
        {showAssignModal && selectedFile && (
          <>
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(4px)',
                zIndex: 9998
              }}
              onClick={() => {
                setShowAssignModal(false);
                setSelectedFile(null);
                setSelectedProjectId('');
              }}
            />
            <div
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: '#FFFFFF',
                borderRadius: '20px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                width: '90%',
                maxWidth: '500px',
                zIndex: 9999
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{
                padding: '32px 32px 24px 32px',
                borderBottom: '1px solid #E5E7EB'
              }}>
                <h3 style={{
                  fontSize: '22px',
                  fontWeight: '600',
                  color: '#1A1A1A',
                  margin: '0 0 8px 0'
                }}>
                  Assign File to Project
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#7A7A7A',
                  margin: 0
                }}>
                  Choose which project this file belongs to
                </p>
              </div>

              <div style={{ padding: '24px 32px' }}>
                <p style={{
                  fontSize: '14px',
                  color: '#7A7A7A',
                  margin: '0 0 16px 0'
                }}>
                  <strong style={{ color: '#1A1A1A' }}>{selectedFile.filename}</strong>
                </p>

                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#1A1A1A',
                  marginBottom: '8px'
                }}>
                  Select Project
                </label>

                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '14px',
                    border: '1px solid #E5E5E5',
                    borderRadius: '10px',
                    background: '#FFFFFF',
                    color: '#1A1A1A',
                    cursor: 'pointer',
                    outline: 'none',
                    minHeight: '44px',
                    fontFamily: 'inherit'
                  }}
                >
                  <option value="">Select a project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.project_title}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{
                padding: '20px 32px',
                borderTop: '1px solid #E5E7EB',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px'
              }}>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedFile(null);
                    setSelectedProjectId('');
                  }}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: '500',
                    border: 'none',
                    borderRadius: '10px',
                    background: '#F7F7F7',
                    color: '#1A1A1A',
                    cursor: 'pointer',
                    transition: 'background 0.2s ease',
                    minHeight: '44px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#EEEEEE'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#F7F7F7'}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignToProject}
                  disabled={!selectedProjectId}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: '500',
                    border: 'none',
                    borderRadius: '10px',
                    background: selectedProjectId ? '#1A1A1A' : '#9CA3AF',
                    color: '#FFFFFF',
                    cursor: selectedProjectId ? 'pointer' : 'not-allowed',
                    transition: 'background 0.2s ease',
                    minHeight: '44px'
                  }}
                  onMouseEnter={(e) => selectedProjectId && (e.currentTarget.style.background = '#000000')}
                  onMouseLeave={(e) => selectedProjectId && (e.currentTarget.style.background = '#1A1A1A')}
                >
                  Assign
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Mobile Optimizations */}
      <style>{`
        @media (max-width: 768px) {
          .files-header {
            flex-direction: column !important;
            gap: 20px !important;
            margin-bottom: 24px !important;
          }

          .files-title {
            font-size: 24px !important;
          }

          .files-subtitle {
            font-size: 14px !important;
          }

          .upload-button {
            width: 100% !important;
            justify-content: center !important;
          }

          .main-library {
            padding: 20px !important;
            border-radius: 16px !important;
            margin-bottom: 24px !important;
          }

          .files-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          .project-files-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
        }

        @media (max-width: 640px) {
          .files-title {
            font-size: 22px !important;
            margin-bottom: 6px !important;
          }

          .files-subtitle {
            font-size: 13px !important;
          }

          .main-library {
            padding: 16px !important;
          }
        }
      `}</style>
    </MirakaDashboardShell>
  );
}
