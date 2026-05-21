import React, { useState, useMemo } from 'react';
import { FolderPlus, Upload, Search, LayoutGrid, List, ChevronRight, ArrowLeft, File as FileIcon, Folder, Image, FileText, X } from 'lucide-react';
import FilePreviewModal from './FilePreviewModal';

interface FilesModuleUIProps {
  files: any[];
  currentPath: string[];
  onNavigate: (folderId: string | null, folderName: string) => void;
  onBack: () => void;
  onCreateFolder: () => void;
  onUpload: () => void;
  loading?: boolean;
}

export default function FilesModuleUI({
  files,
  currentPath,
  onNavigate,
  onBack,
  onCreateFolder,
  onUpload,
  loading = false
}: FilesModuleUIProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  
  // ✅ File preview state
  const [previewFile, setPreviewFile] = useState<any | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // ✅ Handle file/folder click
  const handleItemClick = (item: any) => {
    if (item.type === 'folder') {
      onNavigate(item.id, item.filename);
    } else {
      // Open file preview
      console.log('👁️ Opening file preview:', item.filename);
      setPreviewFile(item);
      setShowPreviewModal(true);
    }
  };

  // ✅ Close preview modal
  const handleClosePreview = () => {
    setShowPreviewModal(false);
    setPreviewFile(null);
  };

  // ==========================================
  // TYPE DEFINITIONS
  // ==========================================

  interface FileItem {
    id: string;
    name: string;
    type: 'folder' | 'file';
    mime_type?: string;
    file_extension?: string;
    file_size?: number;
    parent_id: string | null;
    project_id: string;
    soft_deleted: boolean;
    deleted_at?: string;
    updated_at: string;
    created_at: string;
  }

  interface FilesModuleUIProps {
    projectId: string;
    items: FileItem[];
    currentFolderId: string | null;
    onUpload?: (file: File, folderId: string | null, projectId: string) => void;
    onCreateFolder?: (name: string, parentId: string | null, projectId: string) => void;
    onRename?: (itemId: string, newName: string) => void;
    onMove?: (itemId: string, newParentId: string | null) => void;
    onDelete?: (itemId: string) => void;
    onRestore?: (itemId: string) => void;
    onPermanentDelete?: (itemId: string) => void;
    onEmptyBin?: (projectId: string) => void;
    onNavigateToFolder?: (folderId: string | null) => void;
    onNavigateToAllFiles?: () => void;
  }

  type TabType = 'folders' | 'documents' | 'images' | 'bin';

  // ==========================================
  // MAIN COMPONENT
  // ==========================================

  return (
    <div style={{ padding: '0', fontFamily: 'Inter, sans-serif' }}>
      
      {/* PAGE HEADER */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '32px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 600,
            color: '#1A1A1A',
            margin: '0 0 8px 0',
            letterSpacing: '-0.02em'
          }}>
            Files
          </h1>
          <p style={{
            fontSize: '15px',
            color: '#6B7280',
            margin: 0
          }}>
            Manage documents, images, and folders for this project
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              background: '#F3F4F6',
              color: '#1A1A1A',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#E5E7EB'}
            onMouseOut={(e) => e.currentTarget.style.background = '#F3F4F6'}
          >
            <Upload size={16} />
            Upload
          </button>

          <button
            onClick={() => setShowNewFolderModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              background: '#F3F4F6',
              color: '#1A1A1A',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#E5E7EB'}
            onMouseOut={(e) => e.currentTarget.style.background = '#F3F4F6'}
          >
            <FolderPlus size={16} />
            New Folder
          </button>

          <button
            onClick={onNavigateToAllFiles}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              background: '#1A1A1A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#2A2A2A'}
            onMouseOut={(e) => e.currentTarget.style.background = '#1A1A1A'}
          >
            All Files
          </button>
        </div>
      </div>

      {/* MAIN CARD */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '14px',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
        overflow: 'hidden'
      }}>
        
        {/* TAB BAR */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #E5E7EB',
          padding: '0 24px',
          gap: '8px'
        }}>
          {[
            { id: 'folders' as TabType, label: 'Folders', count: tabCounts.folders },
            { id: 'documents' as TabType, label: 'Documents', count: tabCounts.documents },
            { id: 'images' as TabType, label: 'Images', count: tabCounts.images },
            { id: 'bin' as TabType, label: 'Bin', count: tabCounts.bin }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '16px 20px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #1A1A1A' : '2px solid transparent',
                color: activeTab === tab.id ? '#1A1A1A' : '#6B7280',
                fontSize: '14px',
                fontWeight: activeTab === tab.id ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseOver={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.color = '#1A1A1A';
                }
              }}
              onMouseOut={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.color = '#6B7280';
                }
              }}
            >
              {tab.label}
              <span style={{
                fontSize: '12px',
                padding: '2px 6px',
                borderRadius: '10px',
                background: activeTab === tab.id ? '#F3F4F6' : '#F9FAFB',
                color: '#6B7280'
              }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* TOOLBAR */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '8px 12px',
              fontSize: '14px',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              outline: 'none',
              width: '250px',
              transition: 'border-color 0.2s ease'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#1A1A1A'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
          />

          {activeTab === 'bin' && tabCounts.bin > 0 && (
            <button
              onClick={handleEmptyBin}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                background: '#FEE',
                color: '#DC2626',
                border: '1px solid #FCA5A5',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#FEF2F2';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#FEE';
              }}
            >
              <Trash2 size={14} />
              Empty Bin
            </button>
          )}
        </div>

        {/* FILE AREA WITH DRAG & DROP */}
        <div
          onDrop={handleFileDrop}
          onDragOver={handleFileDragOver}
          onDragLeave={handleFileDragLeave}
          style={{
            padding: '24px',
            minHeight: '400px',
            position: 'relative',
            background: isDragging ? '#F9FAFB' : '#FFFFFF',
            transition: 'background 0.2s ease'
          }}
        >
          
          {/* DRAG OVERLAY */}
          {isDragging && activeTab !== 'bin' && (
            <div style={{
              position: 'absolute',
              inset: '24px',
              border: '2px dashed #1A1A1A',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.95)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              pointerEvents: 'none',
              zIndex: 10
            }}>
              <Upload size={48} color="#1A1A1A" />
              <p style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#1A1A1A',
                margin: 0
              }}>
                Drop file to upload
              </p>
            </div>
          )}

          {/* EMPTY STATE */}
          {filteredItems.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px'
            }}>
              {activeTab === 'bin' ? (
                <>
                  <Trash2 size={64} color="#D1D5DB" style={{ margin: '0 auto 24px' }} />
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    marginBottom: '8px'
                  }}>
                    Bin is empty
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#6B7280',
                    margin: 0
                  }}>
                    Deleted files will appear here
                  </p>
                </>
              ) : (
                <>
                  {activeTab === 'folders' ? (
                    <Folder size={64} color="#D1D5DB" style={{ margin: '0 auto 24px' }} />
                  ) : activeTab === 'images' ? (
                    <ImageIcon size={64} color="#D1D5DB" style={{ margin: '0 auto 24px' }} />
                  ) : (
                    <FileText size={64} color="#D1D5DB" style={{ margin: '0 auto 24px' }} />
                  )}
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    marginBottom: '8px'
                  }}>
                    No {activeTab} found
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#6B7280',
                    margin: 0
                  }}>
                    {searchQuery ? 'Try a different search term' : 'Upload files or create a folder to get started'}
                  </p>
                </>
              )}
            </div>
          )}

          {/* FILE LIST */}
          {filteredItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {filteredItems.map((item, index) => (
                <div
                  key={item.id}
                  draggable={!item.soft_deleted}
                  onDragStart={(e) => handleDragStart(e, item)}
                  onDragOver={(e) => handleDragOver(e, item)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, item)}
                  onDragEnd={handleDragEnd}
                  onClick={() => {
                    if (item.type === 'folder' && !item.soft_deleted) {
                      onNavigateToFolder?.(item.id);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    borderBottom: index < filteredItems.length - 1 ? '1px solid #F3F4F6' : 'none',
                    cursor: item.type === 'folder' && !item.soft_deleted ? 'pointer' : 'default',
                    background: dragOverFolderId === item.id ? '#F0F9FF' : 'transparent',
                    border: dragOverFolderId === item.id ? '2px solid #3B82F6' : '2px solid transparent',
                    borderRadius: '8px',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    if (item.type === 'folder' && !item.soft_deleted && !dragOverFolderId) {
                      e.currentTarget.style.background = '#F9FAFB';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!dragOverFolderId) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <div style={{ color: item.soft_deleted ? '#9CA3AF' : '#6B7280' }}>
                      {getFileIcon(item)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: item.soft_deleted ? '#9CA3AF' : '#1A1A1A',
                        marginBottom: '2px',
                        textDecoration: item.soft_deleted ? 'line-through' : 'none'
                      }}>
                        {item.name}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        color: '#6B7280',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span>{item.type === 'folder' ? 'Folder' : 'File'}</span>
                        <span>•</span>
                        <span>{formatDate(item.updated_at)}</span>
                        {item.file_size && (
                          <>
                            <span>•</span>
                            <span>{formatFileSize(item.file_size)}</span>
                          </>
                        )}
                        {item.soft_deleted && item.deleted_at && (
                          <>
                            <span>•</span>
                            <span style={{ color: '#DC2626', fontWeight: 500 }}>
                              {getDaysUntilDeletion(item.deleted_at)} days until permanent deletion
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* THREE-DOT MENU */}
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === item.id ? null : item.id);
                      }}
                      style={{
                        padding: '6px',
                        background: 'none',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#6B7280',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = '#F3F4F6';
                        e.currentTarget.style.color = '#1A1A1A';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'none';
                        e.currentTarget.style.color = '#6B7280';
                      }}
                    >
                      <MoreVertical size={18} />
                    </button>

                    {/* DROPDOWN MENU */}
                    {openMenuId === item.id && (
                      <>
                        <div
                          style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 998
                          }}
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: '100%',
                            marginTop: '4px',
                            background: '#FFFFFF',
                            border: '1px solid #E5E7EB',
                            borderRadius: '10px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                            minWidth: '180px',
                            zIndex: 999,
                            overflow: 'hidden'
                          }}
                        >
                          {item.soft_deleted ? (
                            <>
                              <button
                                onClick={() => handleRestore(item)}
                                style={{
                                  width: '100%',
                                  padding: '10px 16px',
                                  background: 'none',
                                  border: 'none',
                                  textAlign: 'left',
                                  fontSize: '14px',
                                  color: '#1A1A1A',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  transition: 'background 0.2s ease'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = '#F9FAFB'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                              >
                                <CornerUpLeft size={16} />
                                Restore
                              </button>
                              <div style={{ height: '1px', background: '#E5E7EB', margin: '0 8px' }} />
                              <button
                                onClick={() => handlePermanentDelete(item)}
                                style={{
                                  width: '100%',
                                  padding: '10px 16px',
                                  background: 'none',
                                  border: 'none',
                                  textAlign: 'left',
                                  fontSize: '14px',
                                  color: '#DC2626',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  transition: 'background 0.2s ease'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = '#FEF2F2'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                              >
                                <Trash2 size={16} />
                                Delete Permanently
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedItem(item);
                                  setRenameValue(item.name);
                                  setShowRenameModal(true);
                                  setOpenMenuId(null);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '10px 16px',
                                  background: 'none',
                                  border: 'none',
                                  textAlign: 'left',
                                  fontSize: '14px',
                                  color: '#1A1A1A',
                                  cursor: 'pointer',
                                  transition: 'background 0.2s ease'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = '#F9FAFB'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                              >
                                Rename
                              </button>
                              <button
                                onClick={() => {
                                  alert('Move functionality: Wire to onMove handler');
                                  setOpenMenuId(null);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '10px 16px',
                                  background: 'none',
                                  border: 'none',
                                  textAlign: 'left',
                                  fontSize: '14px',
                                  color: '#1A1A1A',
                                  cursor: 'pointer',
                                  transition: 'background 0.2s ease'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = '#F9FAFB'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                              >
                                Move
                              </button>
                              <div style={{ height: '1px', background: '#E5E7EB', margin: '0 8px' }} />
                              <button
                                onClick={() => handleDelete(item)}
                                style={{
                                  width: '100%',
                                  padding: '10px 16px',
                                  background: 'none',
                                  border: 'none',
                                  textAlign: 'left',
                                  fontSize: '14px',
                                  color: '#DC2626',
                                  cursor: 'pointer',
                                  transition: 'background 0.2s ease'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = '#FEF2F2'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* ✅ Click indicator */}
                  <div style={{
                    fontSize: '13px',
                    color: '#9CA3AF',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    {item.type === 'folder' ? 'Open' : 'Preview'}
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* HIDDEN FILE INPUT */}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* NEW FOLDER MODAL */}
      {showNewFolderModal && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 9998,
              backdropFilter: 'blur(4px)'
            }}
            onClick={() => setShowNewFolderModal(false)}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#FFFFFF',
              borderRadius: '14px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              zIndex: 9999,
              width: '90%',
              maxWidth: '460px',
              overflow: 'hidden'
            }}
          >
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #E5E7EB',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 600,
                color: '#1A1A1A'
              }}>
                Create New Folder
              </h2>
              <button
                onClick={() => setShowNewFolderModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: '#6B7280',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '24px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#1A1A1A'
              }}>
                Folder Name
              </label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '14px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '10px',
                  outline: 'none'
                }}
                onKeyPress={(e) => e.key === 'Enter' && newFolderName.trim() && handleCreateFolder()}
              />
            </div>
            <div style={{
              padding: '20px 24px',
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
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  border: '1px solid #E5E7EB',
                  borderRadius: '10px',
                  background: '#FFFFFF',
                  color: '#1A1A1A',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  border: 'none',
                  borderRadius: '10px',
                  background: !newFolderName.trim() ? '#9CA3AF' : '#1A1A1A',
                  color: '#FFFFFF',
                  cursor: !newFolderName.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                Create
              </button>
            </div>
          </div>
        </>
      )}

      {/* RENAME MODAL */}
      {showRenameModal && selectedItem && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 9998,
              backdropFilter: 'blur(4px)'
            }}
            onClick={() => setShowRenameModal(false)}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#FFFFFF',
              borderRadius: '14px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              zIndex: 9999,
              width: '90%',
              maxWidth: '460px',
              overflow: 'hidden'
            }}
          >
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #E5E7EB',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 600,
                color: '#1A1A1A'
              }}>
                Rename {selectedItem.type === 'folder' ? 'Folder' : 'File'}
              </h2>
              <button
                onClick={() => setShowRenameModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: '#6B7280',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '24px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#1A1A1A'
              }}>
                New Name
              </label>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '14px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '10px',
                  outline: 'none'
                }}
                onKeyPress={(e) => e.key === 'Enter' && renameValue.trim() && handleRename()}
              />
            </div>
            <div style={{
              padding: '20px 24px',
              borderTop: '1px solid #E5E7EB',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => {
                  setShowRenameModal(false);
                  setRenameValue('');
                  setSelectedItem(null);
                }}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  border: '1px solid #E5E7EB',
                  borderRadius: '10px',
                  background: '#FFFFFF',
                  color: '#1A1A1A',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                disabled={!renameValue.trim()}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  border: 'none',
                  borderRadius: '10px',
                  background: !renameValue.trim() ? '#9CA3AF' : '#1A1A1A',
                  color: '#FFFFFF',
                  cursor: !renameValue.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                Rename
              </button>
            </div>
          </div>
        </>
      )}

      {/* ✅ File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          isOpen={showPreviewModal}
          onClose={handleClosePreview}
        />
      )}
    </div>
  );
}


