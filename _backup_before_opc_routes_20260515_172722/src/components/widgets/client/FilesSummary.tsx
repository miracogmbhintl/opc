import React, { useEffect, useState } from 'react';
import WidgetCard from '../shared/WidgetCard';
import WidgetSkeleton from '../shared/WidgetSkeleton';
import { FileText, Download, ExternalLink } from 'lucide-react';

interface FileSummary {
  total_files: number;
  recent_uploads: Array<{
    id: string;
    file_name: string;
    uploaded_at: string;
    project_name?: string;
    file_size?: number;
  }>;
}

interface FilesSummaryProps {
  baseUrl: string;
  limit?: number;
}

export default function FilesSummary({ baseUrl, limit = 3 }: FilesSummaryProps) {
  const [summary, setSummary] = useState<FileSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch files summary
    fetch(`${baseUrl}/api/client/files-summary?limit=${limit}`, {
      credentials: 'include'
    })
      .then(res => {
        if (!res.ok) {
          return { total_files: 0, recent_uploads: [] };
        }
        return res.json();
      })
      .then(data => {
        setSummary(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching files summary:', err);
        setSummary({ total_files: 0, recent_uploads: [] });
        setLoading(false);
      });
  }, [baseUrl, limit]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) return <WidgetSkeleton />;

  return (
    <WidgetCard 
      title="Files" 
      icon={<FileText size={20} />}
      action={
        summary && summary.total_files > 0 && (
          <span className="miraka-badge">{summary.total_files}</span>
        )
      }
    >
      {!summary || summary.total_files === 0 ? (
        <div className="text-center py-6">
          <FileText size={32} className="mx-auto text-[#E5E5E5] mb-2" />
          <p className="text-sm text-[#6B6B6B]">
            No files yet
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Recent Uploads */}
          {summary.recent_uploads.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#6B6B6B] uppercase">
                Recent Uploads
              </p>
              {summary.recent_uploads.map((file) => (
                <div 
                  key={file.id}
                  className="flex items-start gap-3 p-2 rounded-lg bg-[#FAFAFA] hover:bg-[#FFFFFF] transition-colors"
                >
                  <FileText size={16} className="text-[#1A1A1A] mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1A1A] truncate">
                      {file.file_name}
                    </p>
                    {file.project_name && (
                      <p className="text-xs text-[#6B6B6B] mt-0.5">
                        {file.project_name}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-[#9A9A9A]">
                      <span>{formatFileSize(file.file_size)}</span>
                      <span>•</span>
                      <span>{formatDate(file.uploaded_at)}</span>
                    </div>
                  </div>
                  <button 
                    className="text-[#1A1A1A] hover:text-[#2A2A2A] transition-colors"
                    title="Download"
                  >
                    <Download size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* View All Link */}
          <div className="pt-2 border-t border-[#E5E5E5] text-center">
            <a 
              href={`${baseUrl}/miraka-co-portal/client/files`}
              className="text-sm text-[#1A1A1A] hover:text-[#2A2A2A] font-medium transition-colors inline-flex items-center gap-1"
            >
              View All Files 
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}

