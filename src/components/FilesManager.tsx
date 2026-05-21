import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import FilePreviewModal from './FilePreviewModal';
import PortalSkeleton from './shared/PortalSkeleton';
import { FolderPlus, Upload, Search, Folder, File, Download, Trash2, Home, ChevronRight } from 'lucide-react';

interface FileItem {
  id: string;
  filename: string;
  file_type?: string;
  size?: number;
  project_id?: string;
  storage_path?: string;
  uploaded_at?: string;
  uploaded_by?: string;
  project_name?: string;
  projects?: { name: string };
  parent_id?: string | null;
  type?: string;
}

interface FolderStructure {
  name: string;
  files: FileItem[];
  subfolders: { [key: string]: FolderStructure };
  projectId?: string;
}

export default function FilesManager() {
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FileItem | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // File preview state
  const [previewFile, setPreviewFile] = useState<any | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Navigation state
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  // Utility functions
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return '–';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const getFileExtension = (name: string) => {
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop()?.toUpperCase() : 'FILE';
  };

  // Build folder structure from files
  const buildFolderStructure = (files: FileItem[]): { [key: string]: FolderStructure } => {
    const structure: { [key: string]: FolderStructure } = {};

    // Group files by project
    const projectGroups: { [key: string]: FileItem[] } = {};
    files.forEach(file => {
      const projectKey = file.project_id || 'unassigned';
      if (!projectGroups[projectKey]) {
        projectGroups[projectKey] = [];
      }
      projectGroups[projectKey].push(file);
    });

    // Create folder structure for each project
    Object.entries(projectGroups).forEach(([projectKey, projectFiles]) => {
      // Use the project_name from the first file, or 'Unassigned' if no project_id exists
      const projectName = projectKey === 'unassigned' 
        ? 'Unassigned' 
        : (projectFiles[0]?.project_name || 'Unnamed Project');
      
      const projectFolder: FolderStructure = {
        name: projectName,
        files: [],
        subfolders: {},
        projectId: projectKey === 'unassigned' ? undefined : projectKey
      };

      // Separate folders and files
      const folders = projectFiles.filter(f => f.type === 'folder');
      const regularFiles = projectFiles.filter(f => f.type !== 'folder');

      // Build folder hierarchy using parent_id
      const folderMap = new Map<string, FolderStructure>();
      
      // First, create all folder objects
      folders.forEach(folder => {
        folderMap.set(folder.id, {
          name: folder.filename,
          files: [],
          subfolders: {},
          projectId: folder.project_id
        });
      });

      // Then, organize folders into hierarchy
      folders.forEach(folder => {
        const folderObj = folderMap.get(folder.id)!;
        
        if (!folder.parent_id) {
          // Root-level folder
          projectFolder.subfolders[folder.filename] = folderObj;
        } else {
          // Nested folder
          const parentFolder = folderMap.get(folder.parent_id);
          if (parentFolder) {
            parentFolder.subfolders[folder.filename] = folderObj;
          }
        }
      });

      // Now place files in their folders
      regularFiles.forEach(file => {
        if (!file.parent_id) {
          // File at project root
          projectFolder.files.push(file);
        } else {
          // File in a folder
          const parentFolder = folderMap.get(file.parent_id);
          if (parentFolder) {
            parentFolder.files.push(file);
          } else {
            // Parent folder not found, put at root
            projectFolder.files.push(file);
          }
        }
      });

      structure[projectName] = projectFolder;
    });

    return structure;
  };

  // Get current folder based on navigation path
  const getCurrentFolder = (): FolderStructure | null => {
    const structure = buildFolderStructure(items);
    
    if (currentPath.length === 0) {
      // Root level - return all projects as a pseudo-folder
      return null;
    }

    let currentFolder = structure[currentPath[0]];
    if (!currentFolder) return null;

    for (let i = 1; i < currentPath.length; i++) {
      currentFolder = currentFolder.subfolders[currentPath[i]];
      if (!currentFolder) return null;
    }

    return currentFolder;
  };

  // Navigate into a folder
  const navigateToFolder = (folderName: string, folderId?: string, projectId?: string) => {
    setCurrentPath([...currentPath, folderName]);
    if (folderId) {
      setCurrentFolderId(folderId);
    }
    if (projectId) {
      setCurrentProjectId(projectId);
    }
  };

  // Navigate to a specific breadcrumb
  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      // Home
      setCurrentPath([]);
      setCurrentFolderId(null);
      setCurrentProjectId(null);
    } else {
      setCurrentPath(currentPath.slice(0, index + 1));
      if (index === 0) {
        // Going back to project root
        setCurrentFolderId(null);
        const structure = buildFolderStructure(items);
        const folder = structure[currentPath[0]];
        setCurrentProjectId(folder?.projectId || null);
      }
      // TODO: We'd need to track folder IDs at each level to properly restore folder ID
      // For now, this will work for single-level navigation
    }
  };

  // Create new folder
  const createFolder = async () => {
    if (!newFolderName.trim() || !currentUserId) return;

    try {
      const folderPath = currentPath.length > 0 
        ? `project-files/${currentUserId}/${currentPath.slice(1).join('/')}/${newFolderName.trim()}/.keep`
        : `project-files/${currentUserId}/${newFolderName.trim()}/.keep`;

      // Create a .keep file to ensure the folder exists in storage
      const keepFile = new Blob([''], { type: 'text/plain' });
      
      const { error: uploadError } = await supabase.storage
        .from('client_files')
        .upload(folderPath, keepFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Folder creation error:', uploadError);
        alert('Failed to create folder: ' + uploadError.message);
        return;
      }

      // Create database record for the .keep file
      const { error: dbError } = await supabase
        .from('project_files')
        .insert({
          filename: '.keep',
          storage_path: folderPath,
          size: 0,
          file_type: 'folder',
          project_id: currentProjectId || null,
          uploaded_by: currentUserId
        });

      if (dbError) {
        console.error('Database record error:', dbError);
      }

      setShowNewFolderModal(false);
      setNewFolderName('');
      await loadFiles();
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Failed to create folder');
    }
  };

  // Load files from project_files table
  const loadFiles = async () => {
    if (!currentUserId) {
      console.log('📁 FilesManager: No currentUserId yet');
      return;
    }

    console.log('📁 FilesManager: Loading files for user:', currentUserId, 'role:', currentUserRole);
    setLoading(true);
    try {
      let query = supabase
        .from('project_files')
        .select(`
          id,
          filename,
          file_type,
          size,
          project_id,
          storage_path,
          uploaded_at,
          uploaded_by,
          parent_id,
          type
        `)
        .order('uploaded_at', { ascending: false });

      // If client, filter to only their projects
      if (currentUserRole === 'client') {
        console.log('📁 FilesManager: User is client, filtering to their projects...');
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('id', currentUserId)
          .single();

        console.log('📁 FilesManager: Profile query result:', { profile, profileError });

        if (profile) {
          const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', profile.id)
            .single();

          console.log('📁 FilesManager: Client query result:', { clientData, clientError });

          if (clientData) {
            const { data: projects, error: projectsError } = await supabase
              .from('projects')
              .select('id')
              .eq('client_id', clientData.id);

            console.log('📁 FilesManager: Projects query result:', { projects, projectsError });

            if (projects && projects.length > 0) {
              const projectIds = projects.map(p => p.id);
              console.log('📁 FilesManager: Filtering to project IDs:', projectIds);
              query = query.in('project_id', projectIds);
            } else {
              console.log('📁 FilesManager: No projects found for client');
              setItems([]);
              setLoading(false);
              return;
            }
          } else {
            console.log('📁 FilesManager: No client record found for user');
            setItems([]);
            setLoading(false);
            return;
          }
        } else {
          console.log('📁 FilesManager: No profile found for user');
          setItems([]);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await query;

      console.log('📁 FilesManager: Files query result:', { data, error, count: data?.length });

      if (error) {
        console.error('❌ FilesManager: Error loading files:', error);
        setItems([]);
      } else {
        // Get project names separately
        const filesWithProjects = await Promise.all(
          (data || [])
            .filter(item => item.filename !== '.keep')
            .map(async (item) => {
              if (item.project_id) {
                const { data: projectData, error: projectError } = await supabase
                  .from('projects')
                  .select('name')
                  .eq('id', item.project_id)
                  .single();
                
                console.log('📁 FilesManager: Project lookup for', item.filename, ':', { 
                  project_id: item.project_id, 
                  projectData, 
                  projectError 
                });
                
                return {
                  ...item,
                  project_name: projectData?.name || 'Unnamed Project'
                };
              }
              console.log('📁 FilesManager: File has no project_id:', item.filename);
              return {
                ...item,
                project_name: 'Unassigned'
              };
            })
        );
        
        console.log('📁 FilesManager: Transformed data:', filesWithProjects);
        setItems(filesWithProjects);
      }
    } catch (error) {
      console.error('❌ FilesManager: Error loading files:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File, projectId?: string) => {
    if (!currentUserId) {
      alert('User ID not found');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || '';
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${timestamp}-${sanitizedName}`;
      
      // Build path based on current navigation
      let filePath = `project-files/${currentUserId}`;
      if (currentPath.length > 0) {
        // We're inside a folder structure
        const folderPath = currentPath.slice(1).join('/');
        filePath = folderPath ? `${filePath}/${folderPath}/${fileName}` : `${filePath}/${fileName}`;
      } else {
        filePath = `${filePath}/${fileName}`;
      }

      const { error: uploadError } = await supabase.storage
        .from('client_files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        alert('Failed to upload file: ' + uploadError.message);
        return;
      }

      // Determine project ID
      let targetProjectId = currentProjectId || projectId;
      if (!targetProjectId && currentUserRole === 'client') {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('id', currentUserId)
          .single();

        if (profile) {
          const { data: clientData } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', profile.id)
            .single();

          if (clientData) {
            const { data: projects } = await supabase
              .from('projects')
              .select('id')
              .eq('client_id', clientData.id)
              .limit(1);

            if (projects && projects.length > 0) {
              targetProjectId = projects[0].id;
            }
          }
        }
      }

      const { error: dbError } = await supabase
        .from('project_files')
        .insert({
          filename: file.name,
          storage_path: filePath,
          size: file.size,
          file_type: file.type || fileExt,
          project_id: targetProjectId || null,
          uploaded_by: currentUserId
        });

      if (dbError) {
        console.error('Database record error:', dbError);
        alert('File uploaded but database record failed: ' + dbError.message);
        return;
      }

      await loadFiles();
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file: ' + (error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const deleteItem = async () => {
    if (!selectedItem) return;

    try {
      // Delete from storage if path exists
      if (selectedItem.storage_path) {
        await supabase.storage
          .from('client_files')
          .remove([selectedItem.storage_path]);
      }

      // Delete from database
      const { error } = await supabase
        .from('project_files')
        .delete()
        .eq('id', selectedItem.id);

      if (error) {
        console.error('Error deleting item:', error);
        alert('Failed to delete: ' + error.message);
        return;
      }

      setShowDeleteModal(false);
      setSelectedItem(null);
      await loadFiles();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete');
    }
  };

  const downloadFile = async (item: FileItem) => {
    if (!item.storage_path) {
      alert('File path not found');
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('client_files')
        .download(item.storage_path);

      if (error) {
        console.error('Download error:', error);
        alert('Failed to download file: ' + error.message);
        return;
      }

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file');
    }
  };

  // Initialize
  useEffect(() => {
    const init = async () => {
      console.log('📁 FilesManager: Initializing...');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('📁 FilesManager: Auth user:', { user: user?.id, authError });
      
      if (user) {
        setCurrentUserId(user.id);
        
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        console.log('📁 FilesManager: Profile role:', { profile, profileError });
        
        if (profile) {
          setCurrentUserRole(profile.role);
          console.log('📁 FilesManager: Set role to:', profile.role);
        }
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadFiles();
    }
  }, [currentUserId, currentUserRole]);

  // Filter items based on search
  const filteredItems = items.filter(item => {
    if (!searchQuery) return true;
    return item.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
           item.project_name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Render current view
  const renderCurrentView = () => {
    const currentFolder = getCurrentFolder();
    const structure = buildFolderStructure(filteredItems);

    if (currentPath.length === 0) {
      // Root level - show all project folders
      const projectFolders = Object.entries(structure);
      
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          {projectFolders.map(([projectName, folder]) => (
            <div
              key={projectName}
              onClick={() => navigateToFolder(projectName, undefined, folder.projectId)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '24px',
                background: '#FAFAFA',
                border: '1px solid #E5E7EB',
                borderRadius: '18px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minHeight: '140px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                e.currentTarget.style.borderColor = '#1A1A1A';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = '#E5E7EB';
              }}
            >
              <Folder size={48} color="#1A1A1A" strokeWidth={1.5} />
              <div style={{
                fontSize: '15px',
                fontWeight: 600,
                color: '#1A1A1A',
                textAlign: 'center',
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
              }}>
                {projectName}
              </div>
              <div style={{
                fontSize: '13px',
                color: '#6B7280',
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
              }}>
                {folder.files.length + Object.keys(folder.subfolders).length} items
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (!currentFolder) {
      return (
        <div style={{ textAlign: 'center', padding: '80px 40px' }}>
          <p style={{ fontSize: '15px', color: '#6B7280' }}>Folder not found</p>
        </div>
      );
    }

    // Inside a folder - show subfolders and files
    const subfolders = Object.entries(currentFolder.subfolders);
    const files = currentFolder.files;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Subfolders */}
        {subfolders.length > 0 && (
          <div>
            <h3 style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#6B7280',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '12px',
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
            }}>
              Folders
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              {subfolders.map(([folderName, folder]) => {
                // Find the folder ID from items
                const folderItem = items.find(item => 
                  item.type === 'folder' && 
                  item.filename === folderName && 
                  item.project_id === currentProjectId &&
                  item.parent_id === currentFolderId
                );
                
                return (
                  <div
                    key={folderName}
                    onClick={() => navigateToFolder(folderName, folderItem?.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px',
                      padding: '24px',
                      background: '#FAFAFA',
                      border: '1px solid #E5E7EB',
                      borderRadius: '18px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      minHeight: '140px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                      e.currentTarget.style.borderColor = '#1A1A1A';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.borderColor = '#E5E7EB';
                    }}
                  >
                    <Folder size={48} color="#1A1A1A" strokeWidth={1.5} />
                    <div style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#1A1A1A',
                      textAlign: 'center',
                      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
                    }}>
                      {folderName}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: '#6B7280',
                      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
                    }}>
                      {folder.files.length} items
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Files */}
        {files.length > 0 && (
          <div>
            <h3 style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#6B7280',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '12px',
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
            }}>
              Files
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {files.map((item, index) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setPreviewFile({
                      id: item.id,
                      filename: item.filename,
                      file_type: item.file_type,
                      size: item.size,
                      storage_path: item.storage_path || '',
                      bucket: 'client_files',
                      uploaded_at: item.uploaded_at,
                      uploaded_by: item.uploaded_by || ''
                    });
                    setShowPreviewModal(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 0',
                    borderBottom: index < files.length - 1 ? '1px solid #F9FAFB' : 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#F9FAFB';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <File size={20} color="#6B7280" strokeWidth={2} />
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '15px',
                        fontWeight: 500,
                        color: '#1A1A1A',
                        marginBottom: '2px',
                        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
                      }}>
                        {item.filename}
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#6B7280',
                        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
                      }}>
                        {getFileExtension(item.filename)} • {formatDate(item.uploaded_at)}
                        {item.size && ` • ${formatFileSize(item.size)}`}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadFile(item);
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '13px',
                        fontWeight: 500,
                        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif",
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        backgroundColor: '#FFFFFF',
                        color: '#1A1A1A',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#F9FAFB';
                        e.currentTarget.style.borderColor = '#1A1A1A';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#FFFFFF';
                        e.currentTarget.style.borderColor = '#E5E7EB';
                      }}
                    >
                      Download
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItem(item);
                        setShowDeleteModal(true);
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '13px',
                        fontWeight: 500,
                        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif",
                        border: '1px solid #FCA5A5',
                        borderRadius: '8px',
                        backgroundColor: '#FFFFFF',
                        color: '#DC2626',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#FEF2F2';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#FFFFFF';
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {subfolders.length === 0 && files.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 40px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 24px',
              backgroundColor: '#F3F4F6',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Folder size={40} color="#D1D5DB" strokeWidth={1.5} />
            </div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: '8px',
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
            }}>
              This folder is empty
            </h3>
            <p style={{
              fontSize: '15px',
              color: '#6B7280',
              marginBottom: '0',
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
            }}>
              Upload files or create a subfolder
            </p>
          </div>
        )}
      </div>
    );
  };

  // Get project name for a file
  const getProjectName = (file: FileItem): string => {
    return file.project_name || file.projects?.name || 'Unassigned';
  };

  return (
    <div style={{ 
      padding: '0',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif",
      paddingBottom: '0',
      marginBottom: '0',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Action Row - Always 3 buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        marginBottom: showSearch ? '20px' : '24px',
        minHeight: '80px'
      }}>
        {/* New Folder Button - Always enabled when user is authenticated */}
        <button
          onClick={() => setShowNewFolderModal(true)}
          disabled={!currentUserId}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '16px',
            background: !currentUserId ? '#E5E7EB' : '#1A1A1A',
            border: 'none',
            borderRadius: '18px',
            cursor: !currentUserId ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            minHeight: '80px',
            opacity: !currentUserId ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (currentUserId) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
              e.currentTarget.style.background = '#2A2A2A';
            }
          }}
          onMouseLeave={(e) => {
            if (currentUserId) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
              e.currentTarget.style.background = '#1A1A1A';
            }
          }}
        >
          <FolderPlus size={28} color={!currentUserId ? '#9CA3AF' : '#FFFFFF'} strokeWidth={2} />
          <span style={{
            fontSize: '14px',
            fontWeight: 600,
            color: !currentUserId ? '#9CA3AF' : '#FFFFFF',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
          }}>
            New Folder
          </span>
        </button>

        {/* Upload Button */}
        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '16px',
            background: (uploading || !currentUserId) ? '#9CA3AF' : '#1A1A1A',
            border: 'none',
            borderRadius: '18px',
            cursor: (uploading || !currentUserId) ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            minHeight: '80px'
          }}
          onMouseEnter={(e) => {
            if (currentUserId && !uploading) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
              e.currentTarget.style.background = '#2A2A2A';
            }
          }}
          onMouseLeave={(e) => {
            if (currentUserId && !uploading) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
              e.currentTarget.style.background = '#1A1A1A';
            }
          }}
        >
          <Upload size={28} color="#FFFFFF" strokeWidth={2} />
          <span style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#FFFFFF',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
          }}>
            {uploading ? 'Uploading...' : 'Upload'}
          </span>
          <input
            type="file"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                uploadFile(file);
                e.target.value = '';
              }
            }}
            disabled={uploading || !currentUserId}
          />
        </label>

        {/* Search Button */}
        <button
          onClick={() => setShowSearch(!showSearch)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '16px',
            background: showSearch ? '#F9FAFB' : '#FFFFFF',
            border: `1px solid ${showSearch ? '#1A1A1A' : '#E5E7EB'}`,
            borderRadius: '18px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            minHeight: '80px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
          }}
        >
          <Search size={28} color="#1A1A1A" strokeWidth={2} />
          <span style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#1A1A1A',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
          }}>
            Search
          </span>
        </button>
      </div>

      {/* Search Input */}
      {showSearch && (
        <div style={{ marginBottom: '24px' }}>
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              height: '48px',
              padding: '0 14px',
              fontSize: '15px',
              border: '1px solid #E6E6E6',
              borderRadius: '16px',
              background: '#FFFFFF',
              color: '#2A2A2A',
              outline: 'none',
              transition: 'all 0.2s ease',
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif",
              fontWeight: 500,
              boxSizing: 'border-box'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#1A1A1A';
              e.currentTarget.style.background = '#FAFAFA';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#E6E6E6';
              e.currentTarget.style.background = '#FFFFFF';
            }}
          />
        </div>
      )}

      {/* Breadcrumb Navigation */}
      {currentPath.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '20px',
          padding: '12px 16px',
          background: '#FAFAFA',
          borderRadius: '12px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => navigateToBreadcrumb(-1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              color: '#6B7280',
              transition: 'all 0.2s ease',
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#FFFFFF';
              e.currentTarget.style.color = '#1A1A1A';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#6B7280';
            }}
          >
            <Home size={16} />
          </button>
          {currentPath.map((folder, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ChevronRight size={16} color="#D1D5DB" />
              <button
                onClick={() => navigateToBreadcrumb(index)}
                style={{
                  padding: '4px 8px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: index === currentPath.length - 1 ? 600 : 500,
                  color: index === currentPath.length - 1 ? '#1A1A1A' : '#6B7280',
                  transition: 'all 0.2s ease',
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
                }}
                onMouseEnter={(e) => {
                  if (index !== currentPath.length - 1) {
                    e.currentTarget.style.background = '#FFFFFF';
                    e.currentTarget.style.color = '#1A1A1A';
                  }
                }}
                onMouseLeave={(e) => {
                  if (index !== currentPath.length - 1) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#6B7280';
                  }
                }}
              >
                {folder}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Files Card */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '22px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
        marginBottom: '0',
        flex: 1,
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ 
          padding: '24px', 
          flex: 1, 
          overflowY: 'auto',
          overflowX: 'hidden'
        }}>
          {loading ? (
            <PortalSkeleton variant="cards" />
          ) : filteredItems.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '80px 40px'
            }}>
              <div style={{
                width: '80px',
                height: '80px',
                margin: '0 auto 24px',
                backgroundColor: '#F3F4F6',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <File size={40} color="#D1D5DB" strokeWidth={1.5} />
              </div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#1A1A1A',
                marginBottom: '8px',
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
              }}>
                {searchQuery ? 'No files found' : 'No files uploaded yet'}
              </h3>
              <p style={{
                fontSize: '15px',
                color: '#6B7280',
                marginBottom: '0',
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
              }}>
                {searchQuery ? 'Try adjusting your search' : 'Upload files to get started'}
              </p>
            </div>
          ) : (
            renderCurrentView()
          )}
        </div>
      </div>

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          isOpen={showPreviewModal}
          onClose={() => {
            setShowPreviewModal(false);
            setPreviewFile(null);
          }}
        />
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              zIndex: 9998,
              backdropFilter: 'blur(4px)'
            }}
            onClick={() => setShowNewFolderModal(false)}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              zIndex: 9999,
              width: '90%',
              maxWidth: '500px',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '32px 32px 24px 32px', borderBottom: '1px solid #E5E7EB' }}>
              <h2 style={{
                margin: '0 0 8px 0',
                fontSize: '22px',
                fontWeight: 600,
                color: '#1A1A1A',
                fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif"
              }}>
                New Folder
              </h2>
            </div>
            <div style={{ padding: '24px 32px' }}>
              <input
                type="text"
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  height: '48px',
                  padding: '0 14px',
                  fontSize: '15px',
                  border: '1px solid #E6E6E6',
                  borderRadius: '16px',
                  background: '#FFFFFF',
                  color: '#2A2A2A',
                  outline: 'none',
                  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                  fontWeight: 500,
                  boxSizing: 'border-box'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFolderName.trim()) {
                    createFolder();
                  }
                }}
              />
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
                  setShowNewFolderModal(false);
                  setNewFolderName('');
                }}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                  border: 'none',
                  borderRadius: '10px',
                  backgroundColor: '#F7F7F7',
                  color: '#1A1A1A',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease',
                  minHeight: '44px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={createFolder}
                disabled={!newFolderName.trim()}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                  border: 'none',
                  borderRadius: '10px',
                  backgroundColor: newFolderName.trim() ? '#1A1A1A' : '#9CA3AF',
                  color: '#FFFFFF',
                  cursor: newFolderName.trim() ? 'pointer' : 'not-allowed',
                  transition: 'background 0.2s ease',
                  minHeight: '44px'
                }}
              >
                Create
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedItem && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              zIndex: 9998,
              backdropFilter: 'blur(4px)'
            }}
            onClick={() => setShowDeleteModal(false)}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              zIndex: 9999,
              width: '90%',
              maxWidth: '500px',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '32px 32px 24px 32px', borderBottom: '1px solid #E5E7EB' }}>
              <h2 style={{
                margin: '0 0 8px 0',
                fontSize: '22px',
                fontWeight: 600,
                color: '#1A1A1A',
                fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif"
              }}>
                Delete File
              </h2>
            </div>
            <div style={{ padding: '24px 32px' }}>
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: '#7A7A7A',
                fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                lineHeight: 1.6
              }}>
                Are you sure you want to delete <strong style={{ color: '#1A1A1A' }}>{selectedItem.filename}</strong>? This action cannot be undone.
              </p>
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
                  setShowDeleteModal(false);
                  setSelectedItem(null);
                }}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                  border: 'none',
                  borderRadius: '10px',
                  backgroundColor: '#F7F7F7',
                  color: '#1A1A1A',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease',
                  minHeight: '44px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#EEEEEE'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#F7F7F7'}
              >
                Cancel
              </button>
              <button
                onClick={deleteItem}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                  border: 'none',
                  borderRadius: '10px',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease',
                  minHeight: '44px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#B91C1C'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#DC2626'}
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}











