
import React from 'react';
import { Search, X, FileText, Folder, Image, LayoutGrid } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';

type FilterType = 'all' | 'files' | 'folders' | 'images';

interface FilesSearchBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

export default function FilesSearchBar({
  query,
  onQueryChange,
  activeFilter,
  onFilterChange,
}: FilesSearchBarProps) {
  const handleClearSearch = () => {
    onQueryChange('');
  };

  const getFilterIcon = (filter: FilterType) => {
    switch (filter) {
      case 'all':
        return <LayoutGrid className="h-4 w-4" />;
      case 'files':
        return <FileText className="h-4 w-4" />;
      case 'folders':
        return <Folder className="h-4 w-4" />;
      case 'images':
        return <Image className="h-4 w-4" />;
      default:
        return <LayoutGrid className="h-4 w-4" />;
    }
  };

  const getFilterLabel = (filter: FilterType): string => {
    switch (filter) {
      case 'all':
        return 'All';
      case 'files':
        return 'Files';
      case 'folders':
        return 'Folders';
      case 'images':
        return 'Images';
      default:
        return 'All';
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9A9A9A] pointer-events-none" />
        <Input
          type="text"
          placeholder="Search files, folders, or images..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="pl-11 pr-10 h-12 bg-[#FFFFFF] border-[#E6E6E6] text-[#1A1A1A] placeholder:text-[#9A9A9A] focus:border-[#1A1A1A] focus:ring-[#1A1A1A]"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-[#FAFAFA]"
            aria-label="Clear search"
          >
            <X className="h-4 w-4 text-[#6B6B6B]" />
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <Tabs value={activeFilter} onValueChange={(value) => onFilterChange(value as FilterType)}>
        <TabsList className="w-full grid grid-cols-4 bg-[#FAFAFA] border border-[#E6E6E6] p-1 h-auto">
          <TabsTrigger
            value="all"
            className="flex items-center justify-center gap-2 data-[state=active]:bg-[#FFFFFF] data-[state=active]:text-[#1A1A1A] data-[state=active]:shadow-sm py-2.5 px-3 text-sm font-semibold transition-all"
          >
            {getFilterIcon('all')}
            <span className="hidden sm:inline">{getFilterLabel('all')}</span>
          </TabsTrigger>
          <TabsTrigger
            value="files"
            className="flex items-center justify-center gap-2 data-[state=active]:bg-[#FFFFFF] data-[state=active]:text-[#1A1A1A] data-[state=active]:shadow-sm py-2.5 px-3 text-sm font-semibold transition-all"
          >
            {getFilterIcon('files')}
            <span className="hidden sm:inline">{getFilterLabel('files')}</span>
          </TabsTrigger>
          <TabsTrigger
            value="folders"
            className="flex items-center justify-center gap-2 data-[state=active]:bg-[#FFFFFF] data-[state=active]:text-[#1A1A1A] data-[state=active]:shadow-sm py-2.5 px-3 text-sm font-semibold transition-all"
          >
            {getFilterIcon('folders')}
            <span className="hidden sm:inline">{getFilterLabel('folders')}</span>
          </TabsTrigger>
          <TabsTrigger
            value="images"
            className="flex items-center justify-center gap-2 data-[state=active]:bg-[#FFFFFF] data-[state=active]:text-[#1A1A1A] data-[state=active]:shadow-sm py-2.5 px-3 text-sm font-semibold transition-all"
          >
            {getFilterIcon('images')}
            <span className="hidden sm:inline">{getFilterLabel('images')}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Active Search Indicator */}
      {query && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#6B6B6B]">
            Searching for:
          </span>
          <span className="font-semibold text-[#1A1A1A] bg-[#1A1A1A]/20 px-3 py-1 rounded-full">
            "{query}"
          </span>
          {activeFilter !== 'all' && (
            <>
              <span className="text-[#6B6B6B]">in</span>
              <span className="font-semibold text-[#1A1A1A] bg-[#E5E5E5] px-3 py-1 rounded-full flex items-center gap-1.5">
                {getFilterIcon(activeFilter)}
                {getFilterLabel(activeFilter)}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

