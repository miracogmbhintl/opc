import { useState, useEffect } from 'react';
import BoardsList from './BoardsList';
import CreateBoardModal from './CreateBoardModal';
import { baseUrl } from '../../lib/base-url';

export default function BoardsPageContainer() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [workspaceFilter, setWorkspaceFilter] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Get workspace filter from URL
    const params = new URLSearchParams(window.location.search);
    setWorkspaceFilter(params.get('workspace_id'));
  }, []);

  const handleBoardSelect = (boardId: string) => {
    window.location.href = `${baseUrl}/work-os/boards/${boardId}`;
  };

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
  };

  const handleCreateSuccess = () => {
    // Reload boards by incrementing refresh key
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <>
      <BoardsList
        key={refreshKey}
        onBoardSelect={handleBoardSelect}
        onCreateBoard={handleOpenCreateModal}
      />

      <CreateBoardModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onSuccess={handleCreateSuccess}
        workspaceId={workspaceFilter}
      />
    </>
  );
}

