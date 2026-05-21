import React from 'react';
import { Download, Clock, FileText, HardDrive } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { formatDistanceToNow } from 'date-fns';

interface FileVersion {
  id: string;
  file_id: string;
  version_number: number;
  created_at: string;
  created_by: string | null;
  size_bytes: number;
}

interface FileVersionsPanelProps {
  versions: FileVersion[];
  onDownloadVersion: (versionId: string) => void;
}

export default function FileVersionsPanel({
  versions,
  onDownloadVersion,
}: FileVersionsPanelProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'Unknown date';
    }
  };

  const sortedVersions = [...versions].sort(
    (a, b) => b.version_number - a.version_number
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-[#1A1A1A]" />
          Version History
        </CardTitle>
        <CardDescription>
          {versions.length === 0
            ? 'No versions available'
            : `${versions.length} version${versions.length === 1 ? '' : 's'}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-[#9A9A9A] mb-4" />
            <p className="text-[#6B6B6B] font-medium">No version history available</p>
            <p className="text-sm text-[#9A9A9A] mt-1">
              File versions will appear here once created
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedVersions.map((version, index) => (
              <div
                key={version.id}
                className="flex items-center justify-between p-4 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] hover:bg-[#FFFFFF] hover:border-[#1A1A1A] transition-all"
              >
                <div className="flex items-start gap-4 flex-1">
                  {/* Version Badge */}
                  <div className="flex flex-col items-center justify-center min-w-[60px]">
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        index === 0
                          ? 'bg-[#1A1A1A] text-[#FFFFFF]'
                          : 'bg-[#E5E5E5] text-[#6B6B6B]'
                      }`}
                    >
                      v{version.version_number}
                    </div>
                    {index === 0 && (
                      <span className="text-[10px] text-[#1A1A1A] font-semibold mt-1 uppercase tracking-wide">
                        Latest
                      </span>
                    )}
                  </div>

                  {/* Version Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-[#6B6B6B]" />
                      <span className="text-sm text-[#1A1A1A] font-medium">
                        {formatDate(version.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-[#6B6B6B]" />
                      <span className="text-sm text-[#6B6B6B]">
                        {formatFileSize(version.size_bytes)}
                      </span>
                    </div>
                    {version.created_by && (
                      <div className="mt-1">
                        <span className="text-xs text-[#9A9A9A]">
                          Created by {version.created_by}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Download Button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDownloadVersion(version.id)}
                  className="shrink-0 ml-4"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

