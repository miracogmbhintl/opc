import React from 'react';

export default function WidgetSkeleton() {
  return (
    <div className="miraka-card animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-6 h-6 bg-[#E5E5E5] rounded"></div>
        <div className="h-5 w-32 bg-[#E5E5E5] rounded"></div>
      </div>
      <div className="space-y-3">
        <div className="h-4 bg-[#E5E5E5] rounded w-full"></div>
        <div className="h-4 bg-[#E5E5E5] rounded w-3/4"></div>
        <div className="h-4 bg-[#E5E5E5] rounded w-5/6"></div>
      </div>
    </div>
  );
}
