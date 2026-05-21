import React from 'react';
import { X, FolderInput, Trash2, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';

interface FilesBulkActionsBarProps {
  selectedCount: number;
  onBulkMove: () => void;
  onBulkDelete: () => void;
  onBulkRestore: () => void;
  onClearSelection: () => void;
}

export default function FilesBulkActionsBar({
  selectedCount,
  onBulkMove,
  onBulkDelete,
  onBulkRestore,
  onClearSelection,
}: FilesBulkActionsBarProps) {
  // Don't render if no items selected
  if (selectedCount === 0) {
    return null;
  }

  const isDisabled = selectedCount === 0;

  return (
    <>
      {/* Backdrop overlay */}
      <div className="fixed inset-0 bg-black/20 z-40 pointer-events-none animate-in fade-in duration-200" />

      {/* Action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-300">
        <div className="bg-[#1A1A1A] border-t border-[#333333] shadow-2xl">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              {/* Left: Selection count */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-[#1A1A1A] text-[#FFFFFF] font-bold text-sm">
                  {selectedCount}
                </div>
                <div className="flex flex-col">
                  <span className="text-[#FFFFFF] font-semibold text-sm">
                    {selectedCount} {selectedCount === 1 ? 'file' : 'files'} selected
                  </span>
                  <span className="text-[#9A9A9A] text-xs">
                    Choose an action to apply
                  </span>
                </div>
              </div>

              {/* Right: Action buttons */}
              <div className="flex items-center gap-2">
                {/* Move Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBulkMove}
                  disabled={isDisabled}
                  className="bg-[#FFFFFF] text-[#1A1A1A] border-[#E5E5E5] hover:bg-[#1A1A1A] hover:text-[#FFFFFF] hover:border-[#1A1A1A] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FolderInput className="h-4 w-4 mr-2" />
                  Move
                </Button>

                {/* Restore Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBulkRestore}
                  disabled={isDisabled}
                  className="bg-[#FFFFFF] text-[#1A1A1A] border-[#E5E5E5] hover:bg-[#22C55E] hover:text-[#FFFFFF] hover:border-[#22C55E] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore
                </Button>

                {/* Delete Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBulkDelete}
                  disabled={isDisabled}
                  className="bg-[#FFFFFF] text-[#1A1A1A] border-[#E5E5E5] hover:bg-[#DC2626] hover:text-[#FFFFFF] hover:border-[#DC2626] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>

                {/* Divider */}
                <div className="h-8 w-px bg-[#333333] mx-2" />

                {/* Clear Selection Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearSelection}
                  className="text-[#FFFFFF] hover:bg-[#333333] hover:text-[#FFFFFF]"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom spacer to prevent content from being hidden */}
      <div className="h-20" />
    </>
  );
}

