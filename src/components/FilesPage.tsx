import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import DashboardLayout from './DashboardLayout';
import { baseUrl } from '../lib/base-url';
import { FolderPlus, Upload, Search, Folder, File, X } from 'lucide-react';
import PortalSkeleton from './shared/PortalSkeleton';

interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  storage_path: string | null;
  soft_deleted: boolean;
  created_at: string;
  updated_at: string;
}

interface Breadcrumb {
  id: string | null;
  name: string;
}

export default function FilesPage() {
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'client' | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: null, name: 'Root' }]);
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [folderName, setFolderName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [selectedItem, setSelectedItem] = useState<FileItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkAuth();
    
    // Check if mobile on mount
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (clientId) {
      loadFiles();
    }
  }, [clientId, currentParentId]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        window.location.href = '/';
        return;
      }

      // Get user role from user_profiles
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role, client_id')
        .eq('id', session.user.id)
        .single();

      if (profileError || !profile) {
        console.error('Error loading profile:', profileError);
        setError('Failed to load user profile');
        setLoading(false);
        return;
      }

      setUserRole(profile.role as 'owner' | 'admin' | 'client');

      // If client, use their client_id; if owner/admin, get from URL or show selector
      if (profile.role === 'client') {
        if (!profile.client_id) {
          setError('No client ID associated with your account');
          setLoading(false);
          return;
        }
        setClientId(profile.client_id);
      } else {
        // For owner/admin, try to get clientId from URL
        const params = new URLSearchParams(window.location.search);
        const urlClientId = params.get('clientId');
        
        if (urlClientId) {
          setClientId(urlClientId);
        } else {
          // Show all files or client selector
          setClientId('all'); // Special value to show all
        }
      }
    } catch (err) {
      console.error('Auth check error:', err);
      setError('Authentication error');
      setLoading(false);
    }
  };

  const loadFiles = async () => {
    if (!clientId) return;

    setLoading(true);
    setError('');

    try {
      if (clientId === 'all') {
        // Load all files for owner/admin
        const { data, error: fetchError } = await supabase
          .from('client_files_items')
          .select('*')
          .is('parent_id', currentParentId)
          .eq('soft_deleted', false)
          .order('type', { ascending: false })
          .order('name', { ascending: true });

        if (fetchError) {
          console.error('Error loading files:', fetchError);
          setError('Failed to load files');
          setItems([]);
        } else {
          setItems(data || []);
        }
      } else {
        // Use RPC function for specific client
        const { data, error: rpcError } = await supabase.rpc('list_client_files', {
          p_client_id: clientId,
          p_parent_id: currentParentId
        });

        if (rpcError) {
          console.error('Error loading files:', rpcError);
          setError('Failed to load files');
          setItems([]);
        } else {
          const sorted = (data || []).sort((a: FileItem, b: FileItem) => {
            if (a.type === b.type) {
              return a.name.localeCompare(b.name);
            }
            return a.type === 'folder' ? -1 : 1;
          });
          setItems(sorted);
        }
      }
    } catch (err) {
      console.error('Unexpected error loading files:', err);
      setError('Something went wrong');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (folder: FileItem) => {
    setCurrentParentId(folder.id);
    setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    const crumb = breadcrumbs[index];
    setCurrentParentId(crumb.id);
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || clientId === 'all' || !folderName.trim()) return;

    setSubmitting(true);
    setError('');

    try {
      const { error: rpcError } = await supabase.rpc('create_client_folder', {
        p_client_id: clientId,
        p_folder_name: folderName.trim(),
        p_parent_id: currentParentId
      });

      if (rpcError) {
        console.error('Error creating folder:', rpcError);
        setError('Failed to create folder');
      } else {
        setShowNewFolderModal(false);
        setFolderName('');
        await loadFiles();
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || clientId === 'all' || !selectedFile) return;

    setSubmitting(true);
    setError('');

    try {
      const fileName = selectedFile.name;
      const fileExtension = fileName.includes('.')
        ? fileName.substring(fileName.lastIndexOf('.') + 1)
        : '';
      const fileSize = selectedFile.size;

      const { error: rpcError } = await supabase.rpc('upload_client_file', {
        p_client_id: clientId,
        p_file_extension: fileExtension,
        p_file_name: fileName,
        p_file_size: fileSize,
        p_parent_id: currentParentId,
        p_storage_path: null
      });

      if (rpcError) {
        console.error('Error uploading file:', rpcError);
        setError('Failed to upload file');
      } else {
        setShowUploadModal(false);
        setSelectedFile(null);
        await loadFiles();
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !renameValue.trim()) return;

    setSubmitting(true);
    setError('');

    try {
      const { error: rpcError } = await supabase.rpc('rename_client_item', {
        p_file_id: selectedItem.id,
        p_new_name: renameValue.trim()
      });

      if (rpcError) {
        console.error('Error renaming item:', rpcError);
        setError('Failed to rename item');
      } else {
        setShowRenameModal(false);
        setRenameValue('');
        setSelectedItem(null);
        await loadFiles();
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;

    setSubmitting(true);
    setError('');

    try {
      const { error: rpcError } = await supabase.rpc('delete_client_item', {
        p_file_id: selectedItem.id,
        p_force: false
      });

      if (rpcError) {
        console.error('Error deleting item:', rpcError);
        setError('Failed to delete item');
      } else {
        setShowDeleteModal(false);
        setSelectedItem(null);
        await loadFiles();
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredItems = items.filter(item => 
    !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!userRole) {
    return <PortalSkeleton variant="cards" />;
  }

  const content = (
    <div style={{ padding: isMobile ? '20px' : '0' }}>
      {/* Page Header */}
      <div style={{ 
        marginBottom: '32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
      }}>
        <div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 600,
            color: '#1A1A1A',
            margin: '0 0 8px 0',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif",
            letterSpacing: '-0.02em'
          }}>
            My Files
          </h1>
          <p style={{
            fontSize: '15px',
            color: '#6B7280',
            margin: 0,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
          }}>
            View, organize and manage your project files
          </p>
        </div>
      </div>

      {/* 3-Button Action Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        marginBottom: showSearch ? '20px' : '24px',
        minHeight: '80px'
      }}>
        {/* New Folder Button */}
        <button
          onClick={() => setShowNewFolderModal(true)}
          disabled={!clientId || clientId === 'all'}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '16px',
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '18px',
            cursor: (!clientId || clientId === 'all') ? 'not-allowed' : 'pointer',
            opacity: (!clientId || clientId === 'all') ? 0.5 : 1,
            transition: 'all 0.2s ease',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            minHeight: '80px'
          }}
          onMouseEnter={(e) => {
            if (clientId && clientId !== 'all') {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
          }}
        >
          <FolderPlus size={28} color="#1A1A1A" strokeWidth={2} />
          <span style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#1A1A1A',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
          }}>
            New Folder
          </span>
        </button>

        {/* Upload Button */}
        <button
          onClick={() => setShowUploadModal(true)}
          disabled={!clientId || clientId === 'all'}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '16px',
            background: (!clientId || clientId === 'all') ? '#9CA3AF' : '#1A1A1A',
            border: 'none',
            borderRadius: '18px',
            cursor: (!clientId || clientId === 'all') ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            minHeight: '80px'
          }}
          onMouseEnter={(e) => {
            if (clientId && clientId !== 'all') {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
              e.currentTarget.style.background = '#2A2A2A';
            }
          }}
          onMouseLeave={(e) => {
            if (clientId && clientId !== 'all') {
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
            Upload
          </span>
        </button>

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

      {/* Search Input - Toggleable */}
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

      {/* Admin/Owner Notice */}
      {clientId === 'all' && (
        <div style={{
          marginBottom: '24px',
          padding: '14px 18px',
          backgroundColor: '#FEF3C7',
          border: '1px solid #FCD34D',
          borderRadius: '14px',
          color: '#78350F',
          fontSize: '14px',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
        }}>
          Select a specific client to manage files. Use the URL parameter ?clientId=...
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          marginBottom: '24px',
          padding: '14px 18px',
          backgroundColor: '#FEF2F2',
          border: '1px solid #FCA5A5',
          borderRadius: '14px',
          color: '#991B1B',
          fontSize: '14px',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
        }}>
          {error}
        </div>
      )}

      {/* Breadcrumbs */}
      {breadcrumbs.length > 1 && (
        <div style={{
          marginBottom: '24px',
          padding: '16px 20px',
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #E5E7EB',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {breadcrumbs.map((crumb, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => handleBreadcrumbClick(index)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '4px 8px',
                    fontSize: '14px',
                    fontWeight: index === breadcrumbs.length - 1 ? 600 : 400,
                    color: index === breadcrumbs.length - 1 ? '#1A1A1A' : '#6B7280',
                    cursor: 'pointer',
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif",
                    borderRadius: '6px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (index < breadcrumbs.length - 1) {
                      e.currentTarget.style.backgroundColor = '#F3F4F6';
                      e.currentTarget.style.color = '#1A1A1A';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = index === breadcrumbs.length - 1 ? '#1A1A1A' : '#6B7280';
                  }}
                >
                  {crumb.name}
                </button>
                {index < breadcrumbs.length - 1 && (
                  <span style={{ color: '#D1D5DB', fontSize: '14px' }}>/</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Files Container */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '22px',
        border: '1px solid #E5E7EB',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '24px' }}>
            <PortalSkeleton variant="table" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{
            padding: '80px 40px',
            textAlign: 'center'
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
              <Folder size={40} color="#D1D5DB" strokeWidth={1.5} />
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
          <div style={{ padding: '24px' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <th style={{
                    textAlign: 'left',
                    padding: '12px 16px 12px 0',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6B7280',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
                  }}>
                    Name
                  </th>
                  <th style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6B7280',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
                  }}>
                    Type
                  </th>
                  <th style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6B7280',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
                  }}>
                    Last Updated
                  </th>
                  <th style={{ width: '160px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: index < filteredItems.length - 1 ? '1px solid #F9FAFB' : 'none',
                      transition: 'background-color 0.15s ease',
                      cursor: item.type === 'folder' ? 'pointer' : 'default'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#F9FAFB';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    onClick={() => {
                      if (item.type === 'folder') {
                        handleFolderClick(item);
                      }
                    }}
                  >
                    <td style={{
                      padding: '16px 16px 16px 0',
                      fontSize: '15px',
                      color: '#1A1A1A',
                      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {item.type === 'folder' ? (
                          <Folder size={20} color="#1A1A1A" strokeWidth={2} />
                        ) : (
                          <File size={20} color="#6B7280" strokeWidth={2} />
                        )}
                        <span style={{ fontWeight: 500 }}>{item.name}</span>
                      </div>
                    </td>
                    <td style={{
                      padding: '16px',
                      fontSize: '14px',
                      color: '#6B7280',
                      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif",
                      textTransform: 'capitalize'
                    }}>
                      {item.type}
                    </td>
                    <td style={{
                      padding: '16px',
                      fontSize: '14px',
                      color: '#6B7280',
                      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
                    }}>
                      {formatDate(item.updated_at || item.created_at)}
                    </td>
                    <td style={{ padding: '16px 0 16px 16px' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(item);
                            setRenameValue(item.name);
                            setShowRenameModal(true);
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
                          Rename
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Results Count */}
      {!loading && filteredItems.length > 0 && (
        <div style={{
          marginTop: '16px',
          fontSize: '14px',
          color: '#6B7280',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
        }}>
          Showing {filteredItems.length} of {items.length} file{items.length === 1 ? '' : 's'}
        </div>
      )}

      {/* Modals */}
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
            onClick={() => !submitting && setShowNewFolderModal(false)}
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
            <form onSubmit={handleCreateFolder}>
              <div style={{ padding: '32px 32px 24px 32px', borderBottom: '1px solid #E5E7EB' }}>
                <h2 style={{
                  margin: '0 0 8px 0',
                  fontSize: '22px',
                  fontWeight: 600,
                  color: '#1A1A1A',
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
                }}>
                  Create New Folder
                </h2>
                <p style={{
                  margin: 0,
                  fontSize: '14px',
                  color: '#7A7A7A',
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
                }}>
                  Enter a name for your new folder
                </p>
              </div>
              <div style={{ padding: '24px 32px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#1A1A1A',
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
                }}>
                  Folder Name
                </label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="Enter folder name"
                  autoFocus
                  required
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '14px',
                    border: '1px solid #E5E5E5',
                    borderRadius: '10px',
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif",
                    outline: 'none',
                    minHeight: '44px'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#E5E5E5'}
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
                  type="button"
                  onClick={() => {
                    setShowNewFolderModal(false);
                    setFolderName('');
                  }}
                  disabled={submitting}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 500,
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif",
                    border: 'none',
                    borderRadius: '10px',
                    backgroundColor: '#F7F7F7',
                    color: '#1A1A1A',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s ease',
                    minHeight: '44px'
                  }}
                  onMouseEnter={(e) => !submitting && (e.currentTarget.style.backgroundColor = '#EEEEEE')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F7F7F7')}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !folderName.trim()}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 500,
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif",
                    border: 'none',
                    borderRadius: '10px',
                    backgroundColor: (submitting || !folderName.trim()) ? '#9CA3AF' : '#1A1A1A',
                    color: '#FFFFFF',
                    cursor: (submitting || !folderName.trim()) ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s ease',
                    minHeight: '44px'
                  }}
                  onMouseEnter={(e) => !submitting && folderName.trim() && (e.currentTarget.style.backgroundColor = '#000000')}
                  onMouseLeave={(e) => !submitting && folderName.trim() && (e.currentTarget.style.backgroundColor = '#1A1A1A')}
                >
                  {submitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {showUploadModal && (
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
            onClick={() => !submitting && setShowUploadModal(false)}
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
            <form onSubmit={handleUploadFile}>
              <div style={{ padding: '32px 32px 24px 32px', borderBottom: '1px solid #E5E7EB' }}>
                <h2 style={{
                  margin: '0 0 8px 0',
                  fontSize: '22px',
                  fontWeight: 600,
                  color: '#1A1A1A',
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
                }}>
                  Upload File
                </h2>
                <p style={{
                  margin: 0,
                  fontSize: '14px',
                  color: '#7A7A7A',
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
                }}>
                  Select a file to upload
                </p>
              </div>
              <div style={{ padding: '24px 32px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#1A1A1A',
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
                }}>
                  Select File
                </label>
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  required
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '14px',
                    border: '1px solid #E5E5E5',
                    borderRadius: '10px',
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif",
                    cursor: 'pointer',
                    minHeight: '44px'
                  }}
                />
                {selectedFile && (
                  <p style={{
                    fontSize: '13px',
                    color: '#6B7280',
                    marginTop: '8px',
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
                  }}>
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
              <div style={{
                padding: '20px 32px',
                borderTop: '1px solid #E5E7EB',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px'
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFile(null);
                  }}
                  disabled={submitting}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 500,
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif",
                    border: 'none',
                    borderRadius: '10px',
                    backgroundColor: '#F7F7F7',
                    color: '#1A1A1A',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s ease',
                    minHeight: '44px'
                  }}
                  onMouseEnter={(e) => !submitting && (e.currentTarget.style.backgroundColor = '#EEEEEE')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F7F7F7')}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 500,
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif",
                    border: 'none',
                    borderRadius: '10px',
                    backgroundColor: submitting ? '#9CA3AF' : '#1A1A1A',
                    color: '#FFFFFF',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s ease',
                    minHeight: '44px'
                  }}
                  onMouseEnter={(e) => !submitting && (e.currentTarget.style.backgroundColor = '#000000')}
                  onMouseLeave={(e) => !submitting && (e.currentTarget.style.backgroundColor = '#1A1A1A')}
                >
                  {submitting ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {showRenameModal && selectedItem && (
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
            onClick={() => !submitting && setShowRenameModal(false)}
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
            <form onSubmit={handleRename}>
              <div style={{ padding: '32px 32px 24px 32px', borderBottom: '1px solid #E5E7EB' }}>
                <h2 style={{
                  margin: '0 0 8px 0',
                  fontSize: '22px',
                  fontWeight: 600,
                  color: '#1A1A1A',
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
                }}>
                  Rename {selectedItem.type === 'folder' ? 'Folder' : 'File'}
                </h2>
                <p style={{
                  margin: 0,
                  fontSize: '14px',
                  color: '#7A7A7A',
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
                }}>
                  Current name: <strong style={{ color: '#1A1A1A' }}>{selectedItem.name}</strong>
                </p>
              </div>
              <div style={{ padding: '24px 32px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#1A1A1A',
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
                }}>
                  New Name
                </label>
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  autoFocus
                  required
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '14px',
                    border: '1px solid #E5E5E5',
                    borderRadius: '10px',
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif",
                    outline: 'none',
                    minHeight: '44px'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#E5E5E5'}
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
                  type="button"
                  onClick={() => {
                    setShowRenameModal(false);
                    setRenameValue('');
                    setSelectedItem(null);
                  }}
                  disabled={submitting}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 500,
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif",
                    border: 'none',
                    borderRadius: '10px',
                    backgroundColor: '#F7F7F7',
                    color: '#1A1A1A',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s ease',
                    minHeight: '44px'
                  }}
                  onMouseEnter={(e) => !submitting && (e.currentTarget.style.backgroundColor = '#EEEEEE')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F7F7F7')}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !renameValue.trim()}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 500,
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif",
                    border: 'none',
                    borderRadius: '10px',
                    backgroundColor: (submitting || !renameValue.trim()) ? '#9CA3AF' : '#1A1A1A',
                    color: '#FFFFFF',
                    cursor: (submitting || !renameValue.trim()) ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s ease',
                    minHeight: '44px'
                  }}
                  onMouseEnter={(e) => !submitting && renameValue.trim() && (e.currentTarget.style.backgroundColor = '#000000')}
                  onMouseLeave={(e) => !submitting && renameValue.trim() && (e.currentTarget.style.backgroundColor = '#1A1A1A')}
                >
                  {submitting ? 'Renaming...' : 'Rename'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

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
            onClick={() => !submitting && setShowDeleteModal(false)}
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
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
              }}>
                Delete {selectedItem.type === 'folder' ? 'Folder' : 'File'}
              </h2>
            </div>
            <div style={{ padding: '24px 32px' }}>
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: '#7A7A7A',
                lineHeight: 1.6,
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif"
              }}>
                Are you sure you want to delete <strong style={{ color: '#1A1A1A' }}>{selectedItem.name}</strong>? This will move it to trash.
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
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedItem(null);
                }}
                disabled={submitting}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif",
                  border: 'none',
                  borderRadius: '10px',
                  backgroundColor: '#F7F7F7',
                  color: '#1A1A1A',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s ease',
                  minHeight: '44px'
                }}
                onMouseEnter={(e) => !submitting && (e.currentTarget.style.backgroundColor = '#EEEEEE')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F7F7F7')}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Segoe UI, Roboto, sans-serif",
                  border: 'none',
                  borderRadius: '10px',
                  backgroundColor: submitting ? '#9CA3AF' : '#DC2626',
                  color: '#FFFFFF',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s ease',
                  minHeight: '44px'
                }}
                onMouseEnter={(e) => !submitting && (e.currentTarget.style.backgroundColor = '#B91C1C')}
                onMouseLeave={(e) => !submitting && (e.currentTarget.style.backgroundColor = '#DC2626')}
              >
                {submitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <DashboardLayout role={userRole}>
      {content}
    </DashboardLayout>
  );
}
