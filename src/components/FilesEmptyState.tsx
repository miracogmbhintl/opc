import React from 'react';
import { Button } from './ui/button';

interface FilesEmptyStateProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export default function FilesEmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
}: FilesEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] py-12 px-6 text-center">
      {/* Icon Container */}
      <div className="mb-6 flex items-center justify-center h-20 w-20 rounded-full bg-[#FAFAFA] border-2 border-[#E6E6E6] text-[#9A9A9A]">
        {icon}
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold text-[#1A1A1A] mb-2">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm text-[#6B6B6B] max-w-md mb-6 leading-relaxed">
        {description}
      </p>

      {/* Optional Action Button */}
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="bg-[#1A1A1A] text-[#FFFFFF] hover:bg-[#2A2A2A] font-semibold"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

