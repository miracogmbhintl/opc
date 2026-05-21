
import React from 'react';
import { Shield, Database, Clock, AlertTriangle, FileText, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import FileActivityTimeline from './FileActivityTimeline';
import FileVersionsPanel from './FileVersionsPanel';
import FilePermissionsMatrix from './FilePermissionsMatrix';
import { formatDistanceToNow } from 'date-fns';

interface FileMetadata {
  id: string;
  name: string;
  type: string;
  storage_path: string;
  created_at: string;
  deleted_at?: string;
  bin_expires_at?: string;
}

interface FileActivityLog {
  id: string;
  action: 'uploaded' | 'downloaded' | 'deleted' | 'restored' | 'moved' | 'renamed' | 'shared';
  user_id: string | null;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface FileVersion {
  id: string;
  file_id: string;
  version_number: number;
  created_at: string;
  created_by: string | null;
  size_bytes: number;
}

interface FilePermission {
  user_id: string;
  role: 'admin' | 'owner' | 'client';
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
}

interface FileForensicsPanelProps {
  file: FileMetadata;
  logs: FileActivityLog[];
  versions: FileVersion[];
  permissions: FilePermission[];
}

export default function FileForensicsPanel({
  file,
  logs,
  versions,
  permissions,
}: FileForensicsPanelProps) {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const relative = formatDistanceToNow(date, { addSuffix: true });
      const absolute = date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      return `${absolute} (${relative})`;
    } catch {
      return 'Invalid date';
    }
  };

  const isDeleted = Boolean(file.deleted_at);
  const isExpiring = Boolean(file.bin_expires_at);

  return (
    <div className="w-full space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#1A1A1A] to-[#333333] text-[#FFFFFF] rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-[#1A1A1A] flex items-center justify-center">
              <Shield className="h-6 w-6 text-[#FFFFFF]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">File Forensics</h2>
              <p className="text-[#FFFFFF] text-sm">
                Complete audit trail and metadata inspection
              </p>
            </div>
          </div>
          <Badge variant="outline" className="bg-[#FFFFFF]/10 text-[#FFFFFF] border-[#FFFFFF]/20">
            Admin Only
          </Badge>
        </div>
      </div>

      {/* File Status Alerts */}
      {isDeleted && (
        <Card className="border-red-500/50 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-red-900 mb-1">File Deleted</h4>
                <p className="text-sm text-red-700">
                  This file was deleted {formatDate(file.deleted_at!)}
                </p>
                {isExpiring && (
                  <p className="text-xs text-red-600 mt-2">
                    <strong>Permanent deletion:</strong> {formatDate(file.bin_expires_at!)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File Metadata Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-[#1A1A1A]" />
            File Metadata
          </CardTitle>
          <CardDescription>Core file information and identifiers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File ID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#FAFAFA] rounded-lg border border-[#E6E6E6]">
            <div className="md:col-span-1">
              <label className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wide">
                File ID
              </label>
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-[#FFFFFF] border border-[#E6E6E6] rounded text-sm font-mono text-[#1A1A1A]">
                {file.id}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(file.id, 'id')}
                className="shrink-0"
              >
                {copiedField === 'id' ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* File Name */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#FAFAFA] rounded-lg border border-[#E6E6E6]">
            <div className="md:col-span-1">
              <label className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wide">
                File Name
              </label>
            </div>
            <div className="md:col-span-2">
              <div className="px-3 py-2 bg-[#FFFFFF] border border-[#E6E6E6] rounded text-sm text-[#1A1A1A]">
                {file.name}
              </div>
            </div>
          </div>

          {/* File Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#FAFAFA] rounded-lg border border-[#E6E6E6]">
            <div className="md:col-span-1">
              <label className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wide">
                Type
              </label>
            </div>
            <div className="md:col-span-2">
              <Badge variant="secondary" className="font-mono">
                {file.type}
              </Badge>
            </div>
          </div>

          {/* Storage Path */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#FAFAFA] rounded-lg border border-[#E6E6E6]">
            <div className="md:col-span-1">
              <label className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wide">
                Storage Path
              </label>
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-[#FFFFFF] border border-[#E6E6E6] rounded text-xs font-mono text-[#1A1A1A] break-all">
                {file.storage_path}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(file.storage_path, 'path')}
                className="shrink-0"
              >
                {copiedField === 'path' ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[#FAFAFA] rounded-lg border border-[#E6E6E6]">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-[#6B6B6B]" />
                <label className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wide">
                  Created
                </label>
              </div>
              <p className="text-sm text-[#1A1A1A]">{formatDate(file.created_at)}</p>
            </div>

            {file.deleted_at && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <label className="text-xs font-semibold text-red-700 uppercase tracking-wide">
                    Deleted
                  </label>
                </div>
                <p className="text-sm text-red-900">{formatDate(file.deleted_at)}</p>
              </div>
            )}

            {file.bin_expires_at && (
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <label className="text-xs font-semibold text-orange-700 uppercase tracking-wide">
                    Expires
                  </label>
                </div>
                <p className="text-sm text-orange-900">{formatDate(file.bin_expires_at)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Accordion Sections */}
      <Accordion type="multiple" defaultValue={['activity', 'versions', 'permissions']} className="space-y-4">
        {/* Activity Timeline */}
        <AccordionItem value="activity" className="border rounded-lg bg-[#FFFFFF] px-6">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-[#1A1A1A]" />
              <span className="font-semibold text-[#1A1A1A]">Activity Timeline</span>
              <Badge variant="secondary" className="ml-2">
                {logs.length} {logs.length === 1 ? 'event' : 'events'}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <FileActivityTimeline activities={logs} />
          </AccordionContent>
        </AccordionItem>

        {/* Version History */}
        <AccordionItem value="versions" className="border rounded-lg bg-[#FFFFFF] px-6">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-[#1A1A1A]" />
              <span className="font-semibold text-[#1A1A1A]">Version History</span>
              <Badge variant="secondary" className="ml-2">
                {versions.length} {versions.length === 1 ? 'version' : 'versions'}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <FileVersionsPanel
              versions={versions}
              onDownloadVersion={(versionId) => {
                console.log('Download version:', versionId);
              }}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Permissions */}
        <AccordionItem value="permissions" className="border rounded-lg bg-[#FFFFFF] px-6">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-[#1A1A1A]" />
              <span className="font-semibold text-[#1A1A1A]">Access Permissions</span>
              <Badge variant="secondary" className="ml-2">
                {permissions.length} {permissions.length === 1 ? 'user' : 'users'}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <FilePermissionsMatrix permissions={permissions} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Footer Notice */}
      <Card className="bg-[#FAFAFA] border-[#E6E6E6]">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-[#6B6B6B] mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-[#6B6B6B]">
                <strong>Admin Notice:</strong> This forensics panel provides read-only access to file metadata,
                activity logs, versions, and permissions. No modifications can be made from this interface.
                All data reflects the current state in the database.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

